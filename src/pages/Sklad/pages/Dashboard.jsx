import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

const Notification = ({ message, type, onClose }) => (
  <div className={`p-4 rounded ${type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'} mb-4`}>
    {message}
    <button className="ml-4 text-sm underline" onClick={onClose}>Yopish</button>
  </div>
);

const Dashboard = () => {
  const [transactions, setTransactions] = useState([]);
  const [products, setProducts] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [branchesLoading, setBranchesLoading] = useState(true);
  const [notification, setNotification] = useState(null);
  const navigate = useNavigate();
  const API_URL = 'https://suddocs.uz';

  const formatCurrency = (amount) => (amount >= 0 ? new Intl.NumberFormat('uz-UZ').format(amount) + ' so\'m' : 'Noma\'lum');
  const formatQuantity = (qty) => (qty >= 0 ? new Intl.NumberFormat('uz-UZ').format(qty) + ' dona' : 'Noma\'lum');
  const formatDate = (date) => new Date(date).toLocaleDateString('uz-UZ');

  const axiosWithAuth = async (config) => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      setNotification({ message: 'Sessiya topilmadi, iltimos tizimga kiring', type: 'error' });
      setTimeout(() => navigate('/login'), 2000);
      throw new Error('No token found');
    }
    const headers = { ...config.headers, Authorization: `Bearer ${token}` };
    try {
      const response = await axios({ ...config, headers });
      return response;
    } catch (error) {
      if (error.response?.status === 401) {
        setNotification({ message: 'Sessiya tugadi, iltimos qayta kiring', type: 'error' });
        localStorage.clear();
        setTimeout(() => navigate('/login'), 2000);
        throw new Error('Session expired');
      }
      throw error;
    }
  };

  useEffect(() => {
    const fetchBranches = async () => {
      setBranchesLoading(true);
      try {
        const branchesRes = await axiosWithAuth({ method: 'get', url: `${API_URL}/branches` });
        const branchesData = branchesRes.data || [];
        setBranches(branchesData);
        
        if (branchesData.length > 0) {
          // Automatically select "Ombor" branch (case-insensitive)
          const omborBranch = branchesData.find((b) => b.name.toLowerCase() === 'ombor');
          if (omborBranch) {
            setSelectedBranchId(omborBranch.id.toString());
          } else {
            // If no "Ombor" branch, select the first one
            setSelectedBranchId(branchesData[0].id.toString());
          }
        } else {
          setNotification({ message: 'Filiallar topilmadi', type: 'error' });
        }
      } catch (err) {
        console.error('Error fetching branches:', err);
        setNotification({ message: err.message || 'Filiallarni yuklashda xatolik', type: 'error' });
      } finally {
        setBranchesLoading(false);
      }
    };
    fetchBranches();
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setNotification(null);

    const branchId = Number(selectedBranchId);
    const isValidBranchId = !isNaN(branchId) && Number.isInteger(branchId) && branchId > 0;

    if (!isValidBranchId) {
      setNotification({ message: 'Filialni tanlang', type: 'error' });
      setTransactions([]);
      setProducts([]);
      setLoading(false);
      return;
    }

    try {
      const queryParams = new URLSearchParams();
      queryParams.append('branchId', branchId);
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        queryParams.append('startDate', start.toISOString().split('T')[0]);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        queryParams.append('endDate', end.toISOString().split('T')[0]);
      }

      console.log('Fetching transactions:', `${API_URL}/transactions?${queryParams.toString()}`);
      console.log('Fetching products:', `${API_URL}/products?${queryParams.toString()}`);

      const [transactionsRes, productsRes] = await Promise.all([
        axiosWithAuth({ method: 'get', url: `${API_URL}/transactions?${queryParams.toString()}` }),
        axiosWithAuth({ method: 'get', url: `${API_URL}/products?${queryParams.toString()}` }),
      ]);
      
      // Backend returns { transactions: [...], pagination: {...} } for transactions
      const transactionsData = transactionsRes.data.transactions || transactionsRes.data || [];
      const productsData = productsRes.data || [];
      
      console.log('Transactions data:', transactionsData);
      console.log('Products data:', productsData);
      
      setTransactions(transactionsData);
      setProducts(productsData);
    } catch (err) {
      console.error('Error fetching data:', err);
      const message = err.response?.data?.message || err.message || 'Ma\'lumotlarni yuklashda xatolik';
      console.error('Error details:', err.response?.data);
      setNotification({ message, type: 'error' });
      setTransactions([]);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [selectedBranchId, startDate, endDate]);

  useEffect(() => {
    if (selectedBranchId) {
      loadData();
    }
  }, [loadData, selectedBranchId, startDate, endDate]);

  const calculateStatistics = () => {
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);
    const previousMonth = new Date(currentMonth);
    previousMonth.setMonth(currentMonth.getMonth() - 1);

    // Normalize date range for daily inflows
    const startOfDay = new Date(startDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(endDate);
    endOfDay.setHours(23, 59, 59, 999);

    const currentInflows = transactions
      .filter((tx) => tx.type === 'PURCHASE' && new Date(tx.createdAt) >= currentMonth)
      .reduce((sum, tx) => sum + (tx.items ? tx.items.reduce((s, item) => s + (item.quantity || 0), 0) : 0), 0);
    const currentOutflows = transactions
      .filter((tx) => (tx.type === 'SALE' || tx.type === 'STOCK_ADJUSTMENT') && new Date(tx.createdAt) >= currentMonth)
      .reduce((sum, tx) => sum + (tx.items ? tx.items.reduce((s, item) => s + (item.quantity || 0), 0) : 0), 0);
    const previousInflows = transactions
      .filter((tx) => tx.type === 'PURCHASE' && new Date(tx.createdAt) >= previousMonth && new Date(tx.createdAt) < currentMonth)
      .reduce((sum, tx) => sum + (tx.items ? tx.items.reduce((s, item) => s + (item.quantity || 0), 0) : 0), 0);
    const previousOutflows = transactions
      .filter((tx) => (tx.type === 'SALE' || tx.type === 'STOCK_ADJUSTMENT') && new Date(tx.createdAt) >= previousMonth && new Date(tx.createdAt) < currentMonth)
      .reduce((sum, tx) => sum + (tx.items ? tx.items.reduce((s, item) => s + (item.quantity || 0), 0) : 0), 0);
    const dailyInflows = transactions
      .filter((tx) => tx.type === 'PURCHASE' && new Date(tx.createdAt) >= startOfDay && new Date(tx.createdAt) <= endOfDay)
      .reduce((sum, tx) => sum + (tx.items ? tx.items.reduce((s, item) => s + (item.quantity || 0), 0) : 0), 0);

    const inflowGrowth = previousInflows === 0 ? (currentInflows > 0 ? 100 : 0) : ((currentInflows - previousInflows) / previousInflows) * 100;
    const outflowGrowth = previousOutflows === 0 ? (currentOutflows > 0 ? 100 : 0) : ((currentOutflows - previousOutflows) / previousOutflows) * 100;

    return {
      totalInflows: currentInflows,
      totalOutflows: currentOutflows,
      dailyInflows,
      inflowGrowth: inflowGrowth.toFixed(2),
      outflowGrowth: outflowGrowth.toFixed(2),
    };
  };

  const stats = calculateStatistics();

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">Boshqaruv Paneli</h1>
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <select
          value={selectedBranchId}
          onChange={(e) => setSelectedBranchId(e.target.value)}
          disabled={branchesLoading}
          className="w-full max-w-xs p-2 border border-gray-300 rounded-md bg-white text-gray-700 focus:outline-none focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
        >
          <option value="">{branchesLoading ? 'Yuklanmoqda...' : 'Filial tanlang'}</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <div className="flex gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Boshlanish sanasi</label>
            <DatePicker
              selected={startDate}
              onChange={(date) => {
                setStartDate(date);
                if (date > endDate) setEndDate(date); // Ensure endDate is not before startDate
              }}
              selectsStart
              startDate={startDate}
              endDate={endDate}
              dateFormat="dd/MM/yyyy"
              className="w-full max-w-xs p-2 border border-gray-300 rounded-md bg-white text-gray-700 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Tugash sanasi</label>
            <DatePicker
              selected={endDate}
              onChange={(date) => setEndDate(date)}
              selectsEnd
              startDate={startDate}
              endDate={endDate}
              minDate={startDate}
              dateFormat="dd/MM/yyyy"
              className="w-full max-w-xs p-2 border border-gray-300 rounded-md bg-white text-gray-700 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>
      {notification && <Notification {...notification} onClose={() => setNotification(null)} />}
      {loading ? (
        <div className="text-center text-gray-600">Yuklanmoqda...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Jami Kirim (Bu Oy)</h3>
              <p className="text-2xl font-bold text-gray-900">{formatQuantity(stats.totalInflows)}</p>
              <p className={`text-sm mt-1 ${stats.inflowGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                O'sish: {stats.inflowGrowth >= 0 ? '+' : ''}{stats.inflowGrowth}%
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Jami Chiqim (Bu Oy)</h3>
              <p className="text-2xl font-bold text-gray-900">{formatQuantity(stats.totalOutflows)}</p>
              <p className={`text-sm mt-1 ${stats.outflowGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                O'sish: {stats.outflowGrowth >= 0 ? '+' : ''}{stats.outflowGrowth}%
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Kunlik Kirim</h3>
              <p className="text-2xl font-bold text-gray-900">{formatQuantity(stats.dailyInflows)}</p>
            </div>
          </div>
          <h3 className="text-xl font-semibold text-gray-800 mb-4">So'nggi Tranzaksiyalar</h3>
          <div className="overflow-x-auto">
            <table className="w-full bg-white border border-gray-200 rounded-lg shadow-md">
              <thead>
                <tr className="bg-gray-100 text-gray-700">
                  <th className="p-4 text-left font-semibold">ID</th>
                  <th className="p-4 text-left font-semibold">Turi</th>
                  <th className="p-4 text-left font-semibold">Mijoz</th>
                  <th className="p-4 text-left font-semibold">Umumiy</th>
                  <th className="p-4 text-left font-semibold">Sana</th>
                </tr>
              </thead>
              <tbody>
                {transactions && transactions.length > 0 ? (
                  transactions.slice(0, 5).map((transaction) => (
                    <tr key={transaction.id} className="border-b border-gray-200 last:border-none">
                      <td className="p-4 text-gray-800">#{transaction.id}</td>
                      <td className="p-4 text-gray-800">{transaction.type || 'Noma\'lum'}</td>
                      <td className="p-4 text-gray-800">
                        {transaction.customer ? 
                          (transaction.customer.fullName || 
                           `${transaction.customer.firstName || ''} ${transaction.customer.lastName || ''}`.trim() || 
                           'Noma\'lum') : 
                          'Noma\'lum'}
                      </td>
                      <td className="p-4 text-gray-800">{formatCurrency(transaction.finalTotal || 0)}</td>
                      <td className="p-4 text-gray-800">{transaction.createdAt ? formatDate(transaction.createdAt) : 'Noma\'lum'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="p-4 text-center text-gray-600">
                      Tranzaksiyalar topilmadi
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;