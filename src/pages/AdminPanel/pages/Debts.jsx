import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Search, Eye, CheckCircle, X, Loader2, CreditCard } from 'lucide-react';

const Debts = ({ selectedBranchId: propSelectedBranchId }) => {
  const BASE_URL = 'https://suddocs.uz';
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [creditTransactions, setCreditTransactions] = useState([]);
  const [summary, setSummary] = useState({ totalCredit: 0, totalTransactions: 0 });
  const [search, setSearch] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState(
    propSelectedBranchId || localStorage.getItem('selectedBranchId') || ''
  );
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [showTransactionModal, setShowTransactionModal] = useState(false);

  const formatCurrency = (amount) => new Intl.NumberFormat('uz-UZ', { style: 'currency', currency: 'UZS' }).format(amount || 0);

  const fetchCreditTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        navigate('/login');
        return;
      }
      
      const params = new URLSearchParams();
      if (selectedBranchId) params.append('branchId', selectedBranchId);
      params.append('type', 'SALE'); // Only get sales transactions
      params.append('paymentMethod', 'CREDIT'); // Filter for credit payments
      
      const res = await fetch(`${BASE_URL}/transactions?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      
      if (res.status === 401) {
        localStorage.removeItem('access_token');
        navigate('/login');
        return;
      }
      
      if (!res.ok) throw new Error('Ma\'lumotlarni olishda xatolik');
      
      const data = await res.json();
      console.log('Raw transaction data from backend:', data);
      
      const creditData = Array.isArray(data) ? data.filter(t => 
        t.paymentMethod === 'CREDIT' || t.paymentStatus === 'PENDING'
      ) : [];
      
      console.log('Filtered credit transactions:', creditData);
      setCreditTransactions(creditData);
      
      // Calculate summary
      const totalCredit = creditData.reduce((sum, t) => sum + (t.totalAmount || 0), 0);
      console.log('Calculated summary:', { totalCredit, totalTransactions: creditData.length });
      setSummary({ totalCredit, totalTransactions: creditData.length });
      
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [selectedBranchId, BASE_URL, navigate]);

  useEffect(() => { 
    fetchCreditTransactions(); 
  }, [fetchCreditTransactions]);

  useEffect(() => {
    if (propSelectedBranchId !== undefined) {
      setSelectedBranchId(propSelectedBranchId);
    }
  }, [propSelectedBranchId]);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'selectedBranchId') {
        setSelectedBranchId(e.newValue || '');
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const filteredTransactions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return creditTransactions;
    return creditTransactions.filter((t) =>
      (t.customer?.firstName || '').toLowerCase().includes(q) ||
      (t.customer?.lastName || '').toLowerCase().includes(q) ||
      (t.customer?.phone || '').includes(q) ||
      (t.id?.toString() || '').includes(q)
    );
  }, [creditTransactions, search]);

  const openTransactionModal = (transaction) => {
    setSelectedTransaction(transaction);
    setShowTransactionModal(true);
  };

  const closeTransactionModal = () => {
    setShowTransactionModal(false);
    setSelectedTransaction(null);
  };

  const getPaymentStatusBadge = (status) => {
    switch (status) {
      case 'PAID':
        return 'bg-green-100 text-green-800';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'OVERDUE':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentStatusText = (status) => {
    switch (status) {
      case 'PAID':
        return 'To\'langan';
      case 'PENDING':
        return 'Kutilmoqda';
      case 'OVERDUE':
        return 'Muddati o\'tgan';
      default:
        return 'Noma\'lum';
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Кредит сотишлар</h1>
              <p className="text-gray-500 mt-1">Кредит бўлиб сотилган товарлар</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={fetchCreditTransactions}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                Yangilash
              </button>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <CreditCard className="text-blue-600" size={24} />
                <div>
                  <p className="text-sm text-blue-600 font-medium">Жами кредит</p>
                  <p className="text-2xl font-bold text-blue-900">{formatCurrency(summary.totalCredit)}</p>
                </div>
              </div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-green-600 text-sm font-bold">{summary.totalTransactions}</span>
                </div>
                <div>
                  <p className="text-sm text-green-600 font-medium">Кредит транзакциялар</p>
                  <p className="text-2xl font-bold text-green-900">{summary.totalTransactions}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Мижоз исми, телефони ёки транзакция ID сини киритинг..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Мижоз
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Сумма
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ҳолат
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Сана
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Амаллар
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="animate-spin" size={20} />
                        <span>Юкланимоқда...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-4 text-center text-gray-500">
                      Кредит транзакциялар топилмади
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((transaction) => (
                    <tr key={transaction.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        #{transaction.id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {transaction.customer ? 
                            `${transaction.customer.firstName || ''} ${transaction.customer.lastName || ''}`.trim() || 'N/A' 
                            : 'N/A'
                          }
                        </div>
                        <div className="text-sm text-gray-500">
                          {transaction.customer?.phone || 'Telefon yo\'q'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                        {formatCurrency(transaction.totalAmount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPaymentStatusBadge(transaction.paymentStatus)}`}>
                          {getPaymentStatusText(transaction.paymentStatus)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {transaction.createdAt ? new Date(transaction.createdAt).toLocaleDateString('uz-UZ') : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => openTransactionModal(transaction)}
                          className="text-blue-600 hover:text-blue-900 flex items-center gap-1"
                        >
                          <Eye size={16} />
                          Кўриш
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
        {showTransactionModal && selectedTransaction && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Транзакция #{selectedTransaction.id}
                  </h3>
                  <button
                    onClick={closeTransactionModal}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X size={24} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Мижоз маълумотлари</h4>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p><span className="font-medium">Исм:</span> {selectedTransaction.customer?.firstName} {selectedTransaction.customer?.lastName}</p>
                      <p><span className="font-medium">Телефон:</span> {selectedTransaction.customer?.phone || 'N/A'}</p>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Товарлар</h4>
                    <div className="space-y-2">
                      {selectedTransaction.products?.map((product, index) => (
                        <div key={index} className="bg-gray-50 rounded-lg p-3">
                          <p><span className="font-medium">Номи:</span> {product.product?.name || product.name}</p>
                          <p><span className="font-medium">Миқдори:</span> {product.quantity}</p>
                          <p><span className="font-medium">Нархи:</span> {formatCurrency(product.price)}</p>
                          <p><span className="font-medium">Жами:</span> {formatCurrency(product.price * product.quantity)}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Тўлов маълумотлари</h4>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p><span className="font-medium">Жами сумма:</span> {formatCurrency(selectedTransaction.totalAmount)}</p>
                      <p><span className="font-medium">Тўлов усули:</span> {selectedTransaction.paymentMethod || 'N/A'}</p>
                      <p><span className="font-medium">Ҳолат:</span> {getPaymentStatusText(selectedTransaction.paymentStatus)}</p>
                      <p><span className="font-medium">Сана:</span> {selectedTransaction.createdAt ? new Date(selectedTransaction.createdAt).toLocaleDateString('uz-UZ') : 'N/A'}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={closeTransactionModal}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                  >
                    Yopish
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Debts;