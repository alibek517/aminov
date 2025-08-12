// TransactionReport.jsx
import React, { useState, useEffect } from 'react';
import { Eye, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const TransactionReport = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [stockHistory, setStockHistory] = useState([]);
  const [showDetails, setShowDetails] = useState(false);
  const navigate = useNavigate();

  const BASE_URL = 'https://suddocs.uz/transactions'; // Replace with your actual base URL

  const transactionTypes = {
    SALE: { label: 'Sotuv', color: 'bg-green-100 text-green-800' },
    RETURN: { label: 'Qaytarish', color: 'bg-yellow-100 text-yellow-800' },
    TRANSFER: { label: 'Otkazma', color: 'bg-blue-100 text-blue-800' },
    WRITE_OFF: { label: 'Yozib tashlash', color: 'bg-red-100 text-red-800' },
    STOCK_ADJUSTMENT: { label: 'Zaxira tuzatish', color: 'bg-purple-100 text-purple-800' },
  };

  const stockHistoryTypes = {
    INFLOW: { label: 'Kirim', color: 'bg-blue-100 text-blue-800' },
    OUTFLOW: { label: 'Chiqim', color: 'bg-red-100 text-red-800' },
    ADJUSTMENT: { label: 'Tuzatish', color: 'bg-purple-100 text-purple-800' },
    RETURN: { label: 'Qaytarish', color: 'bg-yellow-100 text-yellow-800' },
  };

  const formatDate = (dateString) => {
    return dateString
      ? new Date(dateString).toLocaleDateString('uz-UZ', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        })
      : 'N/A';
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('uz-UZ', { style: 'currency', currency: 'UZS' }).format(amount || 0);
  };

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        console.error('No access token found in localStorage');
        navigate('/login');
        throw new Error('Авторизация токени топилмади');
      }

      const response = await fetch(`${BASE_URL}/api/transactions`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.log(response);
        
        const errorMessage = errorData.message || `HTTP ${response.status}: Failed to fetch transactions`;
        console.error('Fetch error:', errorMessage);
        if (response.status === 401) {
          localStorage.removeItem('access_token');
          navigate('/login');
          toast.error('Sessiya tugadi. Iltimos, qayta kiring.');
        } else {
          toast.error(errorMessage);
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setTransactions(data.transactions || []);
    } catch (error) {
      console.error('Error fetching transactions:', error.message);
      toast.error(error.message || 'Маълумотларни олишда хатолик юз берди');
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactionDetailsAndHistory = async (id) => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        console.error('No access token found in localStorage');
        navigate('/login');
        throw new Error('Авторизация токени топилмади');
      }

      // Fetch transaction details
      const transactionResponse = await fetch(`${BASE_URL}/transactions/${id}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!transactionResponse.ok) {
        const errorData = await transactionResponse.json().catch(() => ({}));
        const errorMessage = errorData.message || `HTTP ${transactionResponse.status}: Failed to fetch transaction details`;
        console.error('Fetch error:', errorMessage);
        if (transactionResponse.status === 401) {
          localStorage.removeItem('access_token');
          navigate('/login');
          toast.error('Sessiya tugadi. Iltimos, qayta kiring.');
        }
        throw new Error(errorMessage);
      }

      const transactionData = await transactionResponse.json();

      // Fetch stock history
      const historyResponse = await fetch(`${BASE_URL}/transactions/stock-history/by-transaction/${id}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!historyResponse.ok) {
        const errorData = await historyResponse.json().catch(() => ({}));
        const errorMessage = errorData.message || `HTTP ${historyResponse.status}: Failed to fetch stock history`;
        console.error('Fetch error:', errorMessage);
        throw new Error(errorMessage);
      }

      const historyData = await historyResponse.json();
      setSelectedTransaction(transactionData);
      setStockHistory(historyData.stockHistory || []);
      setShowDetails(true);
    } catch (error) {
      console.error('Error fetching transaction details or history:', error.message);
      toast.error(error.message || 'Тафсилотларни олишда хатолик юз берди');
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 mb-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">Tranzaksiyalar Hisoboti</h1>
            <button
              onClick={fetchTransactions}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors text-sm sm:text-base disabled:opacity-50"
              disabled={loading}
              title="Ma'lumotlarni yangilash"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              Yangilash
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">ID</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Mijoz</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Turi</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Umumiy Summa</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Chegirma</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Yakuniy Summa</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Sana</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan="8" className="px-4 py-8 text-center">
                      <RefreshCw className="w-5 h-5 animate-spin text-blue-500 mx-auto" />
                    </td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-4 py-8 text-center text-gray-500">
                      Hech qanday tranzaksiya topilmadi
                    </td>
                  </tr>
                ) : (
                  transactions.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-900">#{item.id}</td>
                      <td className="px-4 py-3 text-gray-900">{item.customer?.name || 'N/A'}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            transactionTypes[item.type]?.color || 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {transactionTypes[item.type]?.label || item.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-900">{formatCurrency(item.total)}</td>
                      <td className="px-4 py-3 text-gray-900">{formatCurrency(item.discount)}</td>
                      <td className="px-4 py-3 text-gray-900">{formatCurrency(item.finalTotal)}</td>
                      <td className="px-4 py-3 text-gray-900">{formatDate(item.createdAt)}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => fetchTransactionDetailsAndHistory(item.id)}
                          className="flex items-center gap-1 text-blue-500 hover:text-blue-700 text-sm"
                          title="Tranzaksiya tafsilotlarini ko'rish"
                        >
                          <Eye size={14} />
                          Ko'rish
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Transaction Details Modal */}
        {showDetails && selectedTransaction && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-5 w-full max-w-lg">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800">
                  Tranzaksiya Tafsilotlari #{selectedTransaction.id}
                </h3>
                <button
                  onClick={() => setShowDetails(false)}
                  className="text-gray-500 hover:text-gray-700"
                  title="Yopish"
                >
                  ✕
                </button>
              </div>
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-gray-600">Mijoz</p>
                    <p className="font-medium">{selectedTransaction.customer?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Turi</p>
                    <p className="font-medium">{transactionTypes[selectedTransaction.type]?.label || selectedTransaction.type}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Umumiy Summa</p>
                    <p className="font-medium">{formatCurrency(selectedTransaction.total)}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Chegirma</p>
                    <p className="font-medium">{formatCurrency(selectedTransaction.discount)}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Yakuniy Summa</p>
                    <p className="font-medium">{formatCurrency(selectedTransaction.finalTotal)}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">To'lov Turi</p>
                    <p className="font-medium">{selectedTransaction.paymentType || 'N/A'}</p>
                  </div>
                </div>
                <div>
                  <p className="text-gray-600">Mahsulotlar</p>
                  <ul className="list-disc pl-5">
                    {selectedTransaction.items?.map((item) => (
                      <li key={item.id}>
                        {item.product?.name || 'N/A'} - {item.quantity} dona, {formatCurrency(item.total)}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-gray-600">Zaxira Tarixi</p>
                  <ul className="list-disc pl-5">
                    {stockHistory.length === 0 ? (
                      <li>Hech qanday zaxira tarixi topilmadi</li>
                    ) : (
                      stockHistory.map((history) => (
                        <li key={history.id}>
                          {history.product?.name || 'N/A'} - {history.quantity} dona (
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded-full ${
                              stockHistoryTypes[history.type]?.color || 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {stockHistoryTypes[history.type]?.label || history.type}
                          </span>
                          ), {formatDate(history.createdAt)}
                        </li>
                      ))
                    )}
                  </ul>
                </div>
                <div>
                  <p className="text-gray-600">Yaratilgan Sana</p>
                  <p>{formatDate(selectedTransaction.createdAt)}</p>
                </div>
                <div>
                  <p className="text-gray-600">Foydalanuvchi</p>
                  <p>{selectedTransaction.user?.name || 'N/A'}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
};

export default TransactionReport;