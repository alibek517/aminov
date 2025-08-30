import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Search, Eye, CheckCircle, X, Loader2, CreditCard } from 'lucide-react';
import { formatAmount, formatCurrency } from '../../../utils/currencyFormat';

const Debts = ({ selectedBranchId: propSelectedBranchId }) => {
  const BASE_URL = 'https://suddocs.uz';
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [creditTransactions, setCreditTransactions] = useState([]);
  const [summary, setSummary] = useState({ totalCredit: 0, totalTransactions: 0 });
  const [search, setSearch] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState(
    propSelectedBranchId || localStorage.getItem('selectedBranchId') || localStorage.getItem('branchId') || ''
  );
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [showTransactionModal, setShowTransactionModal] = useState(false);

  const formatAmount = (value) => {
    const num = Math.floor(Number(value) || 0);
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  };
  const formatDate = (date) => (date ? new Date(date).toLocaleDateString('uz-UZ') : 'N/A');
  const addMonths = (date, months) => {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    return d;
  };

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
      params.append('type', 'SALE'); // Only sales
      params.append('limit', 'all');
      
      const res = await fetch(`${BASE_URL}/transactions?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      
      if (res.status === 401) {
        localStorage.removeItem('access_token');
        navigate('/login');
        return;
      }
      
      if (!res.ok) throw new Error('Ma\'lumotlarni olishda xatolik');
      
      const raw = await res.json();
      const list = raw?.transactions || raw || [];

      // Enrich credit/installment transactions with schedule analytics
      const now = new Date();
      const creditData = list
        .filter(t => (t.paymentType === 'CREDIT' || t.paymentType === 'INSTALLMENT'))
        .map(t => {
          const schedulesRaw = Array.isArray(t.paymentSchedules) ? t.paymentSchedules : [];
          const baseDate = t.createdAt ? new Date(t.createdAt) : null;
          const schedules = schedulesRaw.map((s) => {
            const dueDate = baseDate ? addMonths(baseDate, s.month) : null;
            const payment = Number(s.payment || 0);
            const paidAmount = Number(s.paidAmount || 0);
            const unpaidAmount = Math.max(0, payment - paidAmount);
            const isOverdue = unpaidAmount > 0 && !!dueDate && dueDate < now && !s.isPaid;
            const daysOverdue = isOverdue && dueDate ? Math.floor((now - dueDate) / (1000 * 60 * 60 * 24)) : 0;
            return { ...s, payment, paidAmount, unpaidAmount, dueDate, isOverdue, daysOverdue };
          });
          const unpaid = schedules.filter(s => s.unpaidAmount > 0);
          const overdueDaysList = unpaid.filter(s => s.isOverdue).map(s => Number(s.daysOverdue || 0));
          const maxDaysOverdue = overdueDaysList.length > 0 ? Math.max(...overdueDaysList) : 0;
          const nextSchedule = unpaid.sort((a,b) => (a.month||0) - (b.month||0))[0] || null;
          const monthsTaken = schedules.length > 0 ? Math.max(...schedules.map(s => s.month || 0)) : 0;
          const monthsRemaining = unpaid.length;
          const totalPayable = schedules.reduce((sum, s) => sum + s.payment, 0);
          const totalPaidFromSchedules = schedules.reduce((sum, s) => sum + s.paidAmount, 0);
          const upfrontPaid = (Number(t.downPayment) || 0) + (Number(t.amountPaid) || 0);
          const totalPaid = totalPaidFromSchedules + upfrontPaid;
          const outstanding = Math.max(0, totalPayable - totalPaid);
          const lastPaid = schedules
            .filter(s => (Number(s.paidAmount||0) > 0 || s.isPaid) && s.paidAt)
            .sort((a,b) => new Date(b.paidAt) - new Date(a.paidAt))[0] || null;
          const lastPaidBy = lastPaid?.paidBy || null;
          const lastPaidByName = lastPaidBy ? `${lastPaidBy.firstName || ''} ${lastPaidBy.lastName || ''}`.trim() : null;
          return {
            ...t,
            schedules,
            unpaidSchedules: unpaid,
            nextSchedule,
            monthsTaken,
            monthsRemaining,
            totalPayable,
            totalPaid,
            outstanding,
            maxDaysOverdue,
            lastPaidBy,
            lastPaidByName,
          };
        });

      // Sort: most overdue (by days) first; then by highest outstanding; then by next unpaid month
      creditData.sort((a,b) => {
        const ad = Number(a.maxDaysOverdue || 0);
        const bd = Number(b.maxDaysOverdue || 0);
        if (ad !== bd) return bd - ad; // overdue first, largest days on top
        const ao = Number(a.outstanding || 0);
        const bo = Number(b.outstanding || 0);
        if (ao !== bo) return bo - ao; // higher outstanding next
        const am = a.nextSchedule?.month || 9999;
        const bm = b.nextSchedule?.month || 9999;
        if (am !== bm) return am - bm; // earlier month next
        return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
      });

      setCreditTransactions(creditData);

      const totalCredit = creditData.reduce((sum, t) => sum + (Number(t.outstanding) || 0), 0);
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

  // Ensure data loads on first open reliably and when returning to the tab
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCreditTransactions();
    }, 300);
    window.addEventListener('focus', fetchCreditTransactions);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', fetchCreditTransactions);
    };
  }, [fetchCreditTransactions]);

  useEffect(() => {
    if (propSelectedBranchId !== undefined) {
      setSelectedBranchId(propSelectedBranchId);
    }
  }, [propSelectedBranchId]);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'selectedBranchId' || e.key === 'branchId') {
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

  const getScheduleStatus = (s) => {
    if (!s) return 'PENDING';
    if (s.isPaid || (Number(s.unpaidAmount) || 0) === 0) return 'PAID';
    if ((Number(s.paidAmount) || 0) > 0 && (Number(s.unpaidAmount) || 0) > 0 && s.isOverdue) return 'OVERDUE';
    if (s.isOverdue) return 'OVERDUE';
    if ((Number(s.paidAmount) || 0) > 0) return 'PENDING';
    return 'PENDING';
  };

  const getScheduleBadge = (s) => getPaymentStatusBadge(getScheduleStatus(s));

  return (
<div className="p-6 bg-gray-50 min-h-screen">
<div className="p-6 bg-gray-50 min-h-screen">
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
                Янгилаш
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
                  <p className="text-2xl font-bold text-blue-900">{formatAmount(summary.totalCredit)}</p>
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
                    Қолган сумма
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Навбатдаги ой
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Навбатдаги тўлов
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
                    <td colSpan="8" className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="animate-spin" size={20} />
                        <span>Юкланмоқда...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-4 text-center text-gray-500">
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
                          {transaction.customer?.fullName || `${transaction.customer?.firstName || ''} ${transaction.customer?.lastName || ''}`.trim() || 'N/A'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {transaction.customer?.phone || 'Телефон йўқ'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                        {formatAmount(transaction.outstanding ?? transaction.remainingBalance ?? 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {transaction.nextSchedule?.month || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatAmount(transaction.nextSchedule?.unpaidAmount || transaction.nextSchedule?.payment || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          (Number(transaction.outstanding || 0) <= 0)
                            ? 'bg-green-100 text-green-800'
                            : (Number(transaction.maxDaysOverdue || 0) > 3)
                              ? 'bg-red-200 text-red-900'
                              : (Number(transaction.maxDaysOverdue || 0) > 0)
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-gray-100 text-gray-800'
                        }`}>
                          {(Number(transaction.outstanding || 0) <= 0)
                            ? "To'langan"
                            : (Number(transaction.maxDaysOverdue || 0) > 0)
                              ? "Muddati o'tgan"
                              : 'Kutilmoqda'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(transaction.lastRepaymentDate || transaction.createdAt)}
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
            <div className="bg-white rounded-lg w-full max-w-5xl max-h-[90vh] overflow-y-auto">
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
                      <p><span className="font-medium">Ф.И.Ш:</span> {selectedTransaction.customer?.fullName || `${selectedTransaction.customer?.firstName || ''} ${selectedTransaction.customer?.lastName || ''}`.trim() || 'N/A'}</p>
                      <p><span className="font-medium">Телефон:</span> {selectedTransaction.customer?.phone || 'N/A'}</p>
                      <p><span className="font-medium">Паспорт:</span> {selectedTransaction.customer?.passportSeries || '-'}</p>
                      <p><span className="font-medium">ЖШШИР:</span> {selectedTransaction.customer?.jshshir || '-'}</p>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Товарлар</h4>
                    <div className="space-y-2">
                      {(selectedTransaction.items || selectedTransaction.products || []).map((product, index) => (
                        <div key={index} className="bg-gray-50 rounded-lg p-3">
                          <p><span className="font-medium">Номи:</span> {product.product?.name || product.productName || product.name}</p>
                          <p><span className="font-medium">Миқдори:</span> {product.quantity}</p>
                          <p><span className="font-medium">Нархи:</span> {formatAmount(product.price)}</p>
                          <p><span className="font-medium">Жами:</span> {formatAmount((Number(product.price)||0) * (Number(product.quantity)||0))}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Тўлов маълумотлари</h4>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p><span className="font-medium">Жами сумма (фоиз билан):</span> {formatAmount(selectedTransaction.totalPayable || selectedTransaction.finalTotal || selectedTransaction.totalAmount || 0)}</p>
                      <p><span className="font-medium">Тўланган:</span> {formatAmount(selectedTransaction.totalPaid || selectedTransaction.amountPaid || 0)}</p>
                      <p><span className="font-medium">Қолган сумма:</span> {formatAmount(selectedTransaction.outstanding || selectedTransaction.remainingBalance || 0)}</p>
                      <p><span className="font-medium">Навбатдаги ой:</span> {selectedTransaction.nextSchedule?.month || '-'}</p>
                      <p><span className="font-medium">Навбатдаги тўлов:</span> {formatAmount(selectedTransaction.nextSchedule?.unpaidAmount || selectedTransaction.nextSchedule?.payment || 0)}</p>
                      {selectedTransaction.nextSchedule?.isOverdue && (
                        <p className="text-red-600"><span className="font-medium">Кечиккан кун:</span> {selectedTransaction.nextSchedule?.daysOverdue}</p>
                      )}
                      <p><span className="font-medium">Олинган ойлар:</span> {selectedTransaction.monthsTaken || '-'}</p>
                      <p><span className="font-medium">Қолган ойлар:</span> {selectedTransaction.monthsRemaining || '-'}</p>
                      <p><span className="font-medium">Сўнгги тўлов санаси:</span> {formatDate(selectedTransaction.lastRepaymentDate || selectedTransaction.createdAt)}</p>
                      <p><span className="font-medium">Сўнгги тўловни қабул қилган:</span> {selectedTransaction.lastPaidByName || (selectedTransaction.lastPaidBy ? `${selectedTransaction.lastPaidBy.firstName || ''} ${selectedTransaction.lastPaidBy.lastName || ''}`.trim() : '-')}</p>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Тўлов жадвали</h4>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ой</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Муддати</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Тўлов</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Тўланган</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Қолган</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ҳолат</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Тўланган куни</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Қабул қилган</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {(selectedTransaction.schedules || selectedTransaction.paymentSchedules || []).map((s, idx) => (
                            <tr key={idx}>
                              <td className="px-4 py-2 text-sm text-gray-900">{s.month}</td>
                              <td className="px-4 py-2 text-sm text-gray-900">{s.dueDate ? formatDate(s.dueDate) : '-'}</td>
                              <td className="px-4 py-2 text-sm text-gray-900">{formatAmount(s.payment)}</td>
                              <td className="px-4 py-2 text-sm text-gray-900">{formatAmount(s.paidAmount || 0)}</td>
                              <td className="px-4 py-2 text-sm text-gray-900">{formatAmount(s.unpaidAmount || Math.max(0, (s.payment || 0) - (s.paidAmount || 0)))}</td>
                              <td className="px-4 py-2 whitespace-nowrap">
                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getScheduleBadge(s)}`}>
                                  {getPaymentStatusText(getScheduleStatus(s))}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-900">{(s.isPaid || (Number(s.paidAmount || 0) > 0)) ? formatDate(s.paidAt || s.paymentDate || s.paidDate || s.datePaid || s.updatedAt || s.createdAt) : '-'}</td>
                              <td className="px-4 py-2 text-sm text-gray-900">{s.paidBy ? `${s.paidBy.firstName || ''} ${s.paidBy.lastName || ''}`.trim() : '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={closeTransactionModal}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                  >
                    Ёпиш
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