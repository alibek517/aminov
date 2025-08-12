import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

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
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const navigate = useNavigate();
  const API_URL = 'https://suddocs.uz';

  const formatCurrency = (amount) => (amount >= 0 ? new Intl.NumberFormat('uz-UZ').format(amount) + ' so\'m' : 'Noma\'lum');
  const formatQuantity = (qty) => (qty >= 0 ? new Intl.NumberFormat('uz-UZ').format(qty) + ' dona' : 'Noma\'lum');
  const formatDate = (date) => new Date(date).toLocaleDateString('uz-UZ');

  const axiosWithAuth = async (config) => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      navigate('/login');
      throw new Error('No token found');
    }
    const headers = { ...config.headers, Authorization: `Bearer ${token}` };
    try {
      const response = await axios({ ...config, headers });
      return response;
    } catch (error) {
      if (error.response?.status === 401) {
        localStorage.clear();
        navigate('/login');
        throw new Error('Session expired');
      }
      throw error;
    }
  };

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const branchesRes = await axiosWithAuth({ method: 'get', url: `${API_URL}/branches` });
        setBranches(branchesRes.data);
      } catch (err) {
        setNotification({ message: err.message || 'Filiallarni yuklashda xatolik', type: 'error' });
      }
    };
    fetchBranches();
  }, [navigate]);

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
      const queryParams = `?branchId=${branchId}`;
      console.log('Fetching transactions:', `${API_URL}/transactions${queryParams}`);
      console.log('Fetching products:', `${API_URL}/products${queryParams}`);

      const [transactionsRes, productsRes] = await Promise.all([
        axiosWithAuth({ method: 'get', url: `${API_URL}/transactions${queryParams}` }),
        axiosWithAuth({ method: 'get', url: `${API_URL}/products${queryParams}` }),
      ]);
      setTransactions(transactionsRes.data);
      setProducts(productsRes.data);
    } catch (err) {
      const message = err.response?.data?.message || 'Ma\'lumotlarni yuklashda xatolik';
      console.error('Error details:', err.response?.data);
      setNotification({ message, type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [navigate, selectedBranchId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const calculateStatistics = () => {
    const currentMonth = new Date();
    currentMonth.setDate(1);
    const previousMonth = new Date(currentMonth);
    previousMonth.setMonth(currentMonth.getMonth() - 1);

    const currentInflows = transactions
      .filter((tx) => tx.type === 'PURCHASE' && new Date(tx.createdAt) >= currentMonth)
      .reduce((sum, tx) => sum + tx.items.reduce((s, item) => s + item.quantity, 0), 0);
    const currentOutflows = transactions
      .filter((tx) => (tx.type === 'SALE' || tx.type === 'STOCK_ADJUSTMENT') && new Date(tx.createdAt) >= currentMonth)
      .reduce((sum, tx) => sum + tx.items.reduce((s, item) => s + item.quantity, 0), 0);
    const previousInflows = transactions
      .filter((tx) => tx.type === 'PURCHASE' && new Date(tx.createdAt) >= previousMonth && new Date(tx.createdAt) < currentMonth)
      .reduce((sum, tx) => sum + tx.items.reduce((s, item) => s + item.quantity, 0), 0);
    const previousOutflows = transactions
      .filter((tx) => (tx.type === 'SALE' || tx.type === 'STOCK_ADJUSTMENT') && new Date(tx.createdAt) >= previousMonth && new Date(tx.createdAt) < currentMonth)
      .reduce((sum, tx) => sum + tx.items.reduce((s, item) => s + item.quantity, 0), 0);

    const inflowGrowth = previousInflows === 0 ? (currentInflows > 0 ? 100 : 0) : ((currentInflows - previousInflows) / previousInflows) * 100;
    const outflowGrowth = previousOutflows === 0 ? (currentOutflows > 0 ? 100 : 0) : ((currentOutflows - previousOutflows) / previousOutflows) * 100;

    return {
      totalInflows: currentInflows,
      totalOutflows: currentOutflows,
      inflowGrowth: inflowGrowth.toFixed(2),
      outflowGrowth: outflowGrowth.toFixed(2),
    };
  };

  const stats = calculateStatistics();

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Boshqaruv Paneli</h1>
      <select
        value={selectedBranchId}
        onChange={(e) => setSelectedBranchId(e.target.value)}
        className="w-full p-2 border rounded mb-4"
      >
        <option value="">Filial tanlang</option>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>{b.name}</option>
        ))}
      </select>
      {notification && <Notification {...notification} onClose={() => setNotification(null)} />}
      {loading ? (
        <div className="text-center">Yuklanmoqda...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="bg-white p-4 rounded shadow">
              <h3 className="text-lg font-bold">Jami Kirim (Bu Oy)</h3>
              <p>{formatQuantity(stats.totalInflows)}</p>
              <p className={`text-sm ${stats.inflowGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                O'sish: {stats.inflowGrowth >= 0 ? '+' : ''}{stats.inflowGrowth}%
              </p>
            </div>
            <div className="bg-white p-4 rounded shadow">
              <h3 className="text-lg font-bold">Jami Chiqim (Bu Oy)</h3>
              <p>{formatQuantity(stats.totalOutflows)}</p>
              <p className={`text-sm ${stats.outflowGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                O'sish: {stats.outflowGrowth >= 0 ? '+' : ''}{stats.outflowGrowth}%
              </p>
            </div>
          </div>
          <h3 className="text-lg font-bold mb-2">So'nggi Tranzaksiyalar</h3>
          <table className="w-full bg-white border rounded">
            <thead>
              <tr className="bg-gray-200">
                <th className="p-2 text-left">ID</th>
                <th className="p-2 text-left">Turi</th>
                <th className="p-2 text-left">Mijoz</th>
                <th className="p-2 text-left">Umumiy</th>
                <th className="p-2 text-left">Sana</th>
              </tr>
            </thead>
            <tbody>
              {transactions.slice(0, 5).map((transaction) => (
                <tr key={transaction.id} className="border-b">
                  <td className="p-2">#{transaction.id}</td>
                  <td className="p-2">{transaction.type}</td>
                  <td className="p-2">
                    {transaction.customer ? `${transaction.customer.firstName} ${transaction.customer.lastName}` : 'Noma\'lum'}
                  </td>
                  <td className="p-2">{formatCurrency(transaction.finalTotal)}</td>
                  <td className="p-2">{formatDate(transaction.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
};

export default Dashboard;