import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DollarSign, Plus, Edit, Trash2, RefreshCw, CheckCircle } from 'lucide-react';

const ExchangeRates = () => {
  const [exchangeRates, setExchangeRates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingRate, setEditingRate] = useState(null);
  const [formData, setFormData] = useState({
    fromCurrency: 'USD',
    toCurrency: 'UZS',
    rate: '',
    isActive: true,
    branchId: ''
  });
  const [branches, setBranches] = useState([]);
  const [notification, setNotification] = useState(null);
  const navigate = useNavigate();
  const token = localStorage.getItem('access_token');
  const API_URL = 'https://suddocs.uz';

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    fetchExchangeRates();
    fetchBranches();
  }, [token, navigate]);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const fetchExchangeRates = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/currency-exchange-rates`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch exchange rates');
      }
      
      const data = await response.json();
      setExchangeRates(data);
    } catch (error) {
      setNotification({ message: error.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const fetchBranches = async () => {
    try {
      const response = await fetch(`${API_URL}/branches`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setBranches(data);
      }
    } catch (error) {
      console.error('Failed to fetch branches:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const url = editingRate 
        ? `${API_URL}/currency-exchange-rates/${editingRate.id}`
        : `${API_URL}/currency-exchange-rates`;
      
      const method = editingRate ? 'PATCH' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          rate: parseFloat(formData.rate),
          branchId: formData.branchId ? parseInt(formData.branchId) : null,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save exchange rate');
      }
      
      setNotification({ 
        message: `Курс ${editingRate ? 'янгиланди' : 'яратилди'}`, 
        type: 'success' 
      });
      
      resetForm();
      fetchExchangeRates();
    } catch (error) {
      setNotification({ message: error.message, type: 'error' });
    }
  };

  const setActiveRate = async (rate) => {
    try {
      const response = await fetch(`${API_URL}/currency-exchange-rates/${rate.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive: true }),
      });
      if (!response.ok) {
        throw new Error('Failed to set active rate');
      }
      // Update UI state: mark clicked as active, others inactive
      setExchangeRates((prev) =>
        prev.map((r) => ({ ...r, isActive: r.id === rate.id }))
      );
      
      setNotification({ message: 'Faol kurs belgilandi', type: 'success' });
    } catch (e) {
      setNotification({ message: e.message || 'Faol kursni belgilashda xatolik', type: 'error' });
    }
  };

  const handleEdit = (rate) => {
    setEditingRate(rate);
    setFormData({
      fromCurrency: rate.fromCurrency,
      toCurrency: rate.toCurrency,
      rate: rate.rate.toString(),
      isActive: rate.isActive,
      branchId: rate.branchId?.toString() || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Курсни ўчиришни тасдиқлайсизми?')) {
      return;
    }
    
    try {
      const response = await fetch(`${API_URL}/currency-exchange-rates/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete exchange rate');
      }
      
      setNotification({ message: 'Курс ўчирилди', type: 'success' });
      fetchExchangeRates();
    } catch (error) {
      setNotification({ message: error.message, type: 'error' });
    }
  };

  const resetForm = () => {
    setFormData({
      fromCurrency: 'USD',
      toCurrency: 'UZS',
      rate: '',
      isActive: true,
      branchId: ''
    });
    setEditingRate(null);
    setShowForm(false);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('uz-UZ').format(amount);
  };

  return (
    <div className="п-6 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Валюта курслари</h1>
          <p className="text-gray-600 mt-1">Доллар ва сўм курсларини бошқариш</p>
        </div>
    
      </div>

      {notification && (
        <div className={`p-4 rounded mb-4 ${
          notification.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
        }`}>
          {notification.message}
          <button className="ml-4 text-sm underline" onClick={() => setNotification(null)}>
            Ёпиш
          </button>
        </div>
      )}

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {editingRate ? 'Курсни таҳрирлаш' : 'Янги курс қўшиш'}
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Қайси валютадан
                </label>
                <select
                  value={formData.fromCurrency}
                  onChange={(e) => setFormData({ ...formData, fromCurrency: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="USD">USD - Доллар</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Қайси валютага
                </label>
                <select
                  value={formData.toCurrency}
                  onChange={(e) => setFormData({ ...formData, toCurrency: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="UZS">UZS - Сўм</option>
                </select>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Курс (1 {formData.fromCurrency} = ? {formData.toCurrency})
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.rate}
                  onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Масалан: 12500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Филиал
                </label>
                <select
                  value={formData.branchId}
                  onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Барча филиаллар учун</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            
            
            <div className="flex gap-3">
              <button
                type="submit"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                {editingRate ? 'Янгилаш' : 'Сақлаш'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors"
              >
                Бекор қилиш
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">Мавжуд курслар</h3>
            <button
              onClick={fetchExchangeRates}
              className="text-blue-600 hover:text-blue-700 transition-colors"
            >
              <RefreshCw size={20} />
            </button>
          </div>
        </div>
        
        {loading ? (
          <div className="п-6 text-center text-gray-600">Юкланмоқда...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Валюта
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Курс
                  </th>
                 
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ҳолат
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Яратилган
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Амаллар
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {exchangeRates.map((rate) => (
                  <tr key={rate.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <DollarSign size={16} className="text-green-600" />
                        <span className="font-medium">
                          {rate.fromCurrency} → {rate.toCurrency}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-semibold text-green-600">
                        1 {rate.fromCurrency} = {formatCurrency(rate.rate)} {rate.toCurrency}
                      </span>
                    </td>
                   
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        rate.isActive 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {rate.isActive ? 'Фаол' : 'Фаол эмас'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {new Date(rate.createdAt).toLocaleDateString('uz-Cyrl-UZ')}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2 items-center">
                        <button
                          onClick={() => handleEdit(rate)}
                          className="text-blue-600 hover:text-blue-700 transition-colors"
                          title="Таҳрирлаш"
                        >
                          <Edit size={16} />
                        </button>
                        
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {exchangeRates.length === 0 && (
              <div className="p-6 text-center text-gray-500">
                Ҳеч қандай курс топилмади
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExchangeRates;
