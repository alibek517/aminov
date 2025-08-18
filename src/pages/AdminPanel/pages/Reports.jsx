import React, { useState, useEffect, useCallback } from 'react';
import { Eye, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const TransactionReport = ({ selectedBranchId: propSelectedBranchId }) => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingSales, setLoadingSales] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [filters, setFilters] = useState({ startDate: '', endDate: '', productId: '' });
  const [productSales, setProductSales] = useState([]);
  const [dailySales, setDailySales] = useState([]);
  const [salesTotals, setSalesTotals] = useState({ totalQuantity: 0, totalAmount: 0 });
  const [selectedBranchId, setSelectedBranchId] = useState(
    propSelectedBranchId || localStorage.getItem('selectedBranchId') || ''
  );
  const navigate = useNavigate();

  const BASE_URL = 'https://suddocs.uz';

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'selectedBranchId') {
        setSelectedBranchId(e.newValue || '');
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    if (propSelectedBranchId !== undefined) {
      setSelectedBranchId(propSelectedBranchId);
    }
  }, [propSelectedBranchId]);

  useEffect(() => {
    if (selectedBranchId !== undefined) {
      fetchTransactions();
    }
  }, [selectedBranchId, fetchTransactions]);

  useEffect(() => {
    if (propSelectedBranchId !== undefined) {
      setSelectedBranchId(propSelectedBranchId);
    }
  }, [propSelectedBranchId]);

  const transactionTypes = {
    SALE: { label: 'Sotuv', color: 'bg-green-100 text-green-800' },
    RETURN: { label: 'Qaytarish', color: 'bg-yellow-100 text-yellow-800' },
    TRANSFER: { label: 'Otkazma', color: 'bg-blue-100 text-blue-800' },
    WRITE_OFF: { label: 'Yozib tashlash', color: 'bg-red-100 text-red-800' },
    STOCK_ADJUSTMENT: { label: 'Zaxira tuzatish', color: 'bg-purple-100 text-purple-800' },
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
    if (!amount || amount === 0) return '0 сўм';
    
    // For large numbers, use custom formatting
    if (amount >= 1_000_000_000) {
      return `${(amount / 1_000_000_000).toFixed(1)} миллиард сўм`;
    } else if (amount >= 1_000_000) {
      return `${(amount / 1_000_000).toFixed(1)} миллион сўм`;
    } else if (amount >= 1_000) {
      return `${(amount / 1_000).toFixed(0)} минг сўм`;
    }
    
    // For smaller numbers, use standard formatting
    return new Intl.NumberFormat('uz-UZ', { 
      style: 'currency', 
      currency: 'UZS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getCustomerName = (customer) => {
    if (!customer) return 'N/A';
    return `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'N/A';
  };

  const getUserName = (user) => {
    if (!user) return 'N/A';
    return `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'N/A';
  };

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        console.error('No access token found in localStorage');
        navigate('/login');
        throw new Error('Авторизация токени топилмади');
      }

      const params = new URLSearchParams();
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.productId) params.append('productId', filters.productId);
      if (selectedBranchId) params.append('branchId', selectedBranchId);

      const response = await fetch(`${BASE_URL}/transactions?${params.toString()}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || 'Server error';
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
      console.log('Raw transaction data:', data);
      
      // Extract transactions from the response - backend returns { transactions: [], pagination: {} }
      const transactions = data.transactions || data || [];
      console.log('Extracted transactions:', transactions);
      
      setTransactions(transactions);
      
      // Process the data to create product sales summary
      const productMap = new Map();
      const dailyMap = new Map();
      let totalQuantity = 0;
      let totalAmount = 0;

      if (Array.isArray(transactions)) {
        transactions.forEach((transaction, index) => {
          console.log(`Processing transaction ${index}:`, transaction);
          
          if (transaction.items && Array.isArray(transaction.items)) {
            transaction.items.forEach((item, pIndex) => {
              console.log(`Processing item ${pIndex}:`, item);
              const productId = item.productId || item.id;
              const productName = item.product?.name || item.name || 'Unknown Product';
              
              if (productMap.has(productId)) {
                productMap.get(productId).quantity += item.quantity || 0;
                productMap.get(productId).amount += (item.price || 0) * (item.quantity || 0);
              } else {
                productMap.set(productId, {
                  id: productId,
                  name: productName,
                  quantity: item.quantity || 0,
                  amount: (item.price || 0) * (item.quantity || 0)
                });
              }
              
              totalQuantity += item.quantity || 0;
              totalAmount += (item.price || 0) * (item.quantity || 0);
            });
          } else {
            console.log(`Transaction ${index} has no items or items is not an array:`, transaction.items);
          }

          // Daily sales
          const date = transaction.createdAt ? new Date(transaction.createdAt).toDateString() : 'Unknown';
          if (dailyMap.has(date)) {
            dailyMap.get(date).amount += transaction.totalAmount || 0;
            dailyMap.get(date).count += 1;
          } else {
            dailyMap.set(date, { date, amount: transaction.totalAmount || 0, count: 1 });
          }
        });
      } else {
        console.log('Transactions is not an array:', typeof transactions, transactions);
      }

      console.log('Processed data:', {
        products: Array.from(productMap.values()),
        daily: Array.from(dailyMap.values()),
        totals: { totalQuantity, totalAmount }
      });

      setProductSales(Array.from(productMap.values()));
      setDailySales(Array.from(dailyMap.values()));
      setSalesTotals({ totalQuantity, totalAmount });
    } catch (error) {
      console.error('Error fetching transactions:', error.message);
      toast.error(error.message || 'Маълумотларни олишда хатолик юз берди');
    } finally {
      setLoading(false);
    }
  }, [filters.startDate, filters.endDate, filters.productId, selectedBranchId, navigate]);

  const fetchTransactionDetails = async (id) => {
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
        const errorMessage = errorData.message || 'Server error';
        console.error('Fetch error:', errorMessage);
        if (transactionResponse.status === 401) {
          localStorage.removeItem('access_token');
          navigate('/login');
          toast.error('Sessiya tugadi. Iltimos, qayta kiring.');
        }
        throw new Error(errorMessage);
      }

      const transactionData = await transactionResponse.json();
      setSelectedTransaction(transactionData);
      setShowDetails(true);
    } catch (error) {
      console.error('Error fetching transaction details:', error.message);
      toast.error(error.message || 'Тафсилотларни олишда хатолик юз берди');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 mb-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">Tranzaksiyalar Hisoboti</h1>
              {selectedBranchId && (
                <p className="text-sm text-gray-600 mt-1">
                  Филиал ID: {selectedBranchId}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value }))}
                className="border rounded px-2 py-1 text-sm"
              />
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value }))}
                className="border rounded px-2 py-1 text-sm"
              />
              <input
                type="number"
                placeholder="Mahsulot ID"
                value={filters.productId}
                onChange={(e) => setFilters((f) => ({ ...f, productId: e.target.value }))}
                className="border rounded px-2 py-1 text-sm w-36"
              />
              <button
                onClick={() => { fetchTransactions(); }}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors text-sm sm:text-base disabled:opacity-50"
                disabled={loading || loadingSales}
                title="Ma'lumotlarni yangilash"
              >
                <RefreshCw size={16} className={loading || loadingSales ? 'animate-spin' : ''} />
                Yangilash
              </button>
            </div>
          </div>
        </div>

        {/* Product Sales Summary */}
        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 mb-4">
          <h2 className="text-lg font-semibold mb-3">Mahsulot bo'yicha sotuvlar (sodda)</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="p-3 rounded border">
              <div className="text-sm text-gray-500">Jami sotilgan dona</div>
              <div className="text-xl font-semibold">{salesTotals.totalQuantity}</div>
            </div>
            <div className="p-3 rounded border">
              <div className="text-sm text-gray-500">Jami tushum</div>
              <div className="text-xl font-semibold">{formatCurrency(salesTotals.totalAmount)}</div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Mahsulot</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Sotilgan dona</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Summasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loadingSales ? (
                  <tr><td colSpan="3" className="px-4 py-4 text-center">Yuklanmoqda...</td></tr>
                ) : productSales.length === 0 ? (
                  <tr><td colSpan="3" className="px-4 py-4 text-center text-gray-500">Ma'lumot yo'q</td></tr>
                ) : (
                  productSales.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">{p.name || `#${p.id}`}</td>
                      <td className="px-4 py-3">{p.quantity}</td>
                      <td className="px-4 py-3">{formatCurrency(p.amount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Daily Sales Summary */}
        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 mb-4">
          <h2 className="text-lg font-semibold mb-3">Kunlar bo'yicha sotuvlar</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Sana</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Tranzaksiyalar soni</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Summasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loadingSales ? (
                  <tr><td colSpan="3" className="px-4 py-4 text-center">Yuklanmoqda...</td></tr>
                ) : dailySales.length === 0 ? (
                  <tr><td colSpan="3" className="px-4 py-4 text-center text-gray-500">Ma'lumot yo'q</td></tr>
                ) : (
                  dailySales.map((d) => (
                    <tr key={d.date} className="hover:bg-gray-50">
                      <td className="px-4 py-3">{d.date}</td>
                      <td className="px-4 py-3">{d.count}</td>
                      <td className="px-4 py-3">{formatCurrency(d.amount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
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
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Yakuniy Summa</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Sana</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="px-4 py-8 text-center">
                      <RefreshCw className="w-5 h-5 animate-spin text-blue-500 mx-auto" />
                    </td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
                      Hech qanday tranzaksiya topilmadi
                    </td>
                  </tr>
                ) : (
                  transactions.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-900">#{item.id}</td>
                      <td className="px-4 py-3 text-gray-900">{getCustomerName(item.customer)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            transactionTypes[item.type]?.color || 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {transactionTypes[item.type]?.label || item.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-900">{formatCurrency(item.totalAmount || item.total || 0)}</td>
                      <td className="px-4 py-3 text-gray-900">{formatCurrency(item.totalAmount || item.finalTotal || item.total || 0)}</td>
                      <td className="px-4 py-3 text-gray-900">{formatDate(item.createdAt)}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => fetchTransactionDetails(item.id)}
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
                    <p className="font-medium">{getCustomerName(selectedTransaction.customer)}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Turi</p>
                    <p className="font-medium">{transactionTypes[selectedTransaction.type]?.label || selectedTransaction.type}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Umumiy Summa</p>
                    <p className="font-medium">{formatCurrency(selectedTransaction.totalAmount || selectedTransaction.total || 0)}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Yakuniy Summa</p>
                    <p className="font-medium">{formatCurrency(selectedTransaction.totalAmount || selectedTransaction.finalTotal || selectedTransaction.total || 0)}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">To'lov Turi</p>
                    <p className="font-medium">{selectedTransaction.paymentType || 'N/A'}</p>
                  </div>
                </div>
                <div>
                  <p className="text-gray-600">Mahsulotlar</p>
                  <ul className="list-disc pl-5">
                    {selectedTransaction.products?.map((item, index) => (
                      <li key={index}>
                        {item.product?.name || item.name || 'N/A'} - {item.quantity || 0} dona, {formatCurrency(item.price || 0)}
                      </li>
                    )) || selectedTransaction.items?.map((item) => (
                      <li key={item.id}>
                        {item.product?.name || 'N/A'} - {item.quantity} dona, {formatCurrency(item.total)}
                      </li>
                    )) || <li>Hech qanday mahsulot topilmadi</li>}
                  </ul>
                </div>
                <div>
                  <p className="text-gray-600">Yaratilgan Sana</p>
                  <p>{formatDate(selectedTransaction.createdAt)}</p>
                </div>
                <div>
                  <p className="text-gray-600">Foydalanuvchi</p>
                  <p>{getUserName(selectedTransaction.user)}</p>
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