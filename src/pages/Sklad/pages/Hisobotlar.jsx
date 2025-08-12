import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const Notification = ({ message, type, onClose }) => (
  <div className={`p-4 rounded ${type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'} mb-4`}>
    {message}
    <button className="ml-4 text-sm underline" onClick={onClose}>Yopish</button>
  </div>
);

const Hisobotlar = ({ selectedBranchId }) => {
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('month');
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

  const getDateRange = () => {
    const today = new Date();
    const endDate = new Date(today);
    let startDate;
    switch (selectedPeriod) {
      case 'week':
        startDate = new Date(today.setDate(today.getDate() - 7));
        break;
      case 'month':
        startDate = new Date(today.setDate(today.getDate() - 30));
        break;
      case 'quarter':
        startDate = new Date(today.setDate(today.getDate() - 90));
        break;
      case 'year':
        startDate = new Date(today.setDate(today.getDate() - 365));
        break;
      default:
        startDate = new Date(today.setDate(today.getDate() - 30));
    }
    return { startDate: startDate.toISOString().split('T')[0], endDate: endDate.toISOString().split('T')[0] };
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setNotification(null);
    try {
      const branchId = Number(selectedBranchId);
      const isValidBranchId = !isNaN(branchId) && Number.isInteger(branchId) && branchId > 0;
      if (!isValidBranchId) {
        setNotification({ message: 'Filial tanlang', type: 'error' });
        return;
      }
      const { startDate, endDate } = getDateRange();
      const queryParams = `?startDate=${startDate}&endDate=${endDate}`;
      console.log('Fetching report:', `${API_URL}/product-transfers/report/${branchId}${queryParams}`);
      const res = await axiosWithAuth({ method: 'get', url: `${API_URL}/product-transfers/report/${branchId}${queryParams}` });
      setReportData(res.data);
    } catch (err) {
      const message = err.response?.data?.message || 'Ma\'lumotlarni yuklashda xatolik';
      console.error('Error details:', err.response?.data);
      setNotification({ message, type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [navigate, selectedBranchId, selectedPeriod]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Hisobotlar</h1>
      {notification && <Notification {...notification} onClose={() => setNotification(null)} />}
      <select
        value={selectedPeriod}
        onChange={(e) => setSelectedPeriod(e.target.value)}
        className="border rounded p-2 mb-4"
      >
        <option value="week">Bu hafta</option>
        <option value="month">Bu oy</option>
        <option value="quarter">Bu chorak</option>
        <option value="year">Bu yil</option>
      </select>
      {loading ? (
        <div className="text-center">Yuklanmoqda...</div>
      ) : (
        <>
          <h2 className="text-xl font-bold mb-2">Tovar Qoldig'i Hisoboti</h2>
          <table className="w-full bg-white border rounded">
            <thead>
              <tr className="bg-gray-200">
                <th className="p-2 text-left">Mahsulot</th>
                <th className="p-2 text-left">Boshlang'ich Qoldiq</th>
                <th className="p-2 text-left">Kirim</th>
                <th className="p-2 text-left">Chiqim</th>
                <th className="p-2 text-left">Yakuniy Qoldiq</th>
              </tr>
            </thead>
            <tbody>
              {reportData.map((item) => (
                <tr key={item.productId} className="border-b">
                  <td className="p-2">{item.productName}</td>
                  <td className="p-2">{formatQuantity(item.initialQuantity)}</td>
                  <td className="p-2">{formatQuantity(item.inflow)}</td>
                  <td className="p-2">{formatQuantity(item.outflow)}</td>
                  <td className="p-2">{formatQuantity(item.finalQuantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
};

export default Hisobotlar;