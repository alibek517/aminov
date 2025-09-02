import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatAmount, formatCurrency } from '../../utils/currencyFormat';
import { RotateCcw, Eye, Calendar, User, Package, Building } from 'lucide-react';

const ReturnedTransactions = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('access_token');
  const selectedBranchId = localStorage.getItem('selectedBranchId') || '';
  
  const [returnedTransactions, setReturnedTransactions] = useState([]);
  const [defectiveLogs, setDefectiveLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [viewMode, setViewMode] = useState('logs'); // 'transactions' or 'logs'
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [selectedLog, setSelectedLog] = useState(null);

  const authHeaders = () => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  });

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    fetchReturnedData();
  }, [selectedDate, selectedBranchId]);

  const fetchReturnedData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch all transactions to find ones with returned items
      const transactionsResponse = await fetch(
        `https://suddocs.uz/transactions?type=SALE&limit=1000${selectedBranchId ? `&branchId=${selectedBranchId}` : ''}`,
        { headers: authHeaders() }
      );
      
      if (!transactionsResponse.ok) throw new Error('Failed to fetch transactions');
      
      const transactionsData = await transactionsResponse.json();
      const allTransactions = transactionsData.transactions || transactionsData || [];

      // Fetch defective logs (returns)
      const logsResponse = await fetch(
        `https://suddocs.uz/defective-logs${selectedBranchId ? `?branchId=${selectedBranchId}` : ''}`,
        { headers: authHeaders() }
      );
      
      if (!logsResponse.ok) throw new Error('Failed to fetch defective logs');
      
      const logsData = await logsResponse.json();
      const allLogs = Array.isArray(logsData) ? logsData : (Array.isArray(logsData.items) ? logsData.items : []);
      
      // Filter return logs for selected date
      const selectedDateObj = new Date(selectedDate);
      const startOfDay = new Date(selectedDateObj.getFullYear(), selectedDateObj.getMonth(), selectedDateObj.getDate());
      const endOfDay = new Date(selectedDateObj.getFullYear(), selectedDateObj.getMonth(), selectedDateObj.getDate(), 23, 59, 59);
      
      const returnLogs = allLogs.filter(log => {
        const logDate = new Date(log.createdAt);
        return log.actionType === 'RETURN' && 
               logDate >= startOfDay && 
               logDate <= endOfDay;
      });

      setDefectiveLogs(returnLogs);

      // Find transactions that have returned items
      const transactionsWithReturns = [];
      const processedTransactionIds = new Set();

      for (const log of returnLogs) {
        if (!log.transactionId || processedTransactionIds.has(log.transactionId)) continue;
        
        const transaction = allTransactions.find(t => t.id === log.transactionId);
        if (transaction) {
          // Get all return logs for this transaction
          const transactionReturns = returnLogs.filter(l => l.transactionId === log.transactionId);
          
          // Calculate total returned amount
          const totalReturnedAmount = transactionReturns.reduce((sum, returnLog) => {
            return sum + (returnLog.cashAmount ? Math.abs(returnLog.cashAmount) : 0);
          }, 0);

          transactionsWithReturns.push({
            ...transaction,
            returnLogs: transactionReturns,
            totalReturnedAmount,
            returnDate: transactionReturns[0]?.createdAt
          });
          
          processedTransactionIds.add(log.transactionId);
        }
      }

      // Sort by return date (newest first)
      transactionsWithReturns.sort((a, b) => new Date(b.returnDate) - new Date(a.returnDate));
      
      setReturnedTransactions(transactionsWithReturns);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('uz-UZ', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getPaymentTypeLabel = (paymentType) => {
    switch (paymentType) {
      case 'CASH': return 'Нақд';
      case 'CARD': return 'Карта';
      case 'CREDIT': return 'Кредит';
      case 'INSTALLMENT': return 'Бўлиб тўлаш';
      default: return paymentType || 'Номаълум';
    }
  };

     const LogDetailsModal = ({ log, onClose }) => (
     <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
       <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
         <div className="p-4 border-b flex items-center justify-between bg-gradient-to-r from-red-50 to-orange-50">
           <div className="font-semibold text-lg text-gray-800">
             Қайтариш лог #{log.id}
           </div>
           <button
             onClick={onClose}
             className="text-gray-500 hover:text-gray-700 p-2 hover:bg-gray-100 rounded-full transition-colors"
           >
             ✕
           </button>
         </div>
         <div className="p-6 overflow-y-auto">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
             <div className="bg-red-50 p-4 rounded-lg border border-red-200">
               <div className="text-sm font-medium text-red-800 mb-3 flex items-center gap-2">
                 <Package size={16} />
                 Маҳсулот маълумотлари
               </div>
               <div className="space-y-2 text-sm">
                 <div><strong>Номи:</strong> {log.product?.name || '-'}</div>
                 <div><strong>Коди:</strong> {log.product?.barcode || '-'}</div>
                 <div><strong>Миқдори:</strong> {log.quantity} дона</div>
                 <div><strong>Сабаб:</strong> {log.description || '-'}</div>
               </div>
             </div>
             <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
               <div className="text-sm font-medium text-blue-800 mb-3 flex items-center gap-2">
                 <Calendar size={16} />
                 Қайтариш маълумотлари
               </div>
               <div className="space-y-2 text-sm">
                 <div><strong>Вақт:</strong> {formatDate(log.createdAt)}</div>
                 <div><strong>Транзакция:</strong> #{log.transactionId}</div>
                 <div><strong>Пул миқдори:</strong> {formatAmount(Math.abs(log.cashAmount || 0))}</div>
                 <div><strong>Ходим:</strong> {log.user ? `${log.user.firstName || ''} ${log.user.lastName || ''}`.trim() : '-'}</div>
               </div>
             </div>
           </div>

           {log.product && (
             <div className="mb-6">
               <div className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                 <Package size={16} />
                 Маҳсулот tavsifi
               </div>
               <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                   <div><strong>Категория:</strong> {log.product.category?.id || '-'}</div>

                   <div><strong>Модель:</strong> {log.product.model || '-'}</div>
                 </div>
               </div>
             </div>
           )}

           {log.branch && (
             <div className="mb-6">
               <div className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                 <Building size={16} />
                 Филиал маълумотлари
               </div>
               <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                 <div className="text-sm">
                   <div><strong>Номи:</strong> {log.branch.name || '-'}</div>
                   <div><strong>Манзил:</strong> {log.branch.address || '-'}</div>

                 </div>
               </div>
             </div>
           )}
         </div>
         <div className="p-4 border-t bg-gray-50 flex items-center justify-between">
           <div className="text-sm text-gray-600">
             <strong>Қайтарилган сумма:</strong> {formatAmount(Math.abs(log.cashAmount || 0))}
           </div>
           <button
             onClick={onClose}
             className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
           >
             Ёпиш
           </button>
         </div>
       </div>
     </div>
   );

   const TransactionDetailsModal = ({ transaction, onClose }) => (
     <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
       <div className="bg-white rounded-xl shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden">
         <div className="p-4 border-b flex items-center justify-between bg-gradient-to-r from-blue-50 to-red-50">
           <div className="font-semibold text-lg text-gray-800">
             Транзакция #{transaction.id} — Қайтарилган маҳсулотлар
           </div>
           <button
             onClick={onClose}
             className="text-gray-500 hover:text-gray-700 p-2 hover:bg-gray-100 rounded-full transition-colors"
           >
             ✕
           </button>
         </div>
         <div className="p-6 overflow-y-auto">
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
             <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
               <div className="text-sm font-medium text-blue-800 mb-3 flex items-center gap-2">
                 <User size={16} />
                 Мижоз маълумотлари
               </div>
               <div className="space-y-2 text-sm">
                 <div><strong>Тўлиқ исм:</strong> {transaction.customer?.fullName || '-'}</div>
                 <div><strong>Телефон:</strong> {transaction.customer?.phone || '-'}</div>
                 <div><strong>Манзил:</strong> {transaction.customer?.address || '-'}</div>
                 <div><strong>Паспорт:</strong> {transaction.customer?.passportNumber || '-'}</div>
               </div>
             </div>
             <div className="bg-green-50 p-4 rounded-lg border border-green-200">
               <div className="text-sm font-medium text-green-800 mb-3 flex items-center gap-2">
                 <Calendar size={16} />
                 Сотув маълумотлари
               </div>
               <div className="space-y-2 text-sm">
                 <div><strong>Сотув санаси:</strong> {formatDate(transaction.createdAt)}</div>
                 <div><strong>Тўлов тури:</strong> {getPaymentTypeLabel(transaction.paymentType)}</div>
                 <div><strong>Жами сумма:</strong> {formatAmount(transaction.finalTotal || transaction.total)}</div>
                 <div><strong>Олдиндан тўланган:</strong> {formatAmount(transaction.amountPaid || 0)}</div>
               </div>
             </div>
             <div className="bg-red-50 p-4 rounded-lg border border-red-200">
               <div className="text-sm font-medium text-red-800 mb-3 flex items-center gap-2">
                 <RotateCcw size={16} />
                 Қайтариш маълумотлари
               </div>
               <div className="space-y-2 text-sm">
                 <div><strong>Қайтариш санаси:</strong> {formatDate(transaction.returnDate)}</div>
                 <div><strong>Қайтарилган сумма:</strong> {formatAmount(transaction.totalReturnedAmount)}</div>
                 <div><strong>Қайтарилган маҳсулотлар:</strong> {transaction.returnLogs.length} та</div>
                 <div><strong>Қолган сумма:</strong> {formatAmount((transaction.finalTotal || transaction.total) - transaction.totalReturnedAmount)}</div>
               </div>
             </div>
           </div>

                     <div className="mb-6">
             <div className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
               <Package size={16} />
               Қайтарилган маҳсулотлар
             </div>
             <div className="overflow-x-auto">
               <table className="w-full text-sm border border-gray-200 rounded-lg">
                 <thead className="bg-red-50">
                   <tr>
                     <th className="px-4 py-3 text-left text-xs font-medium text-red-800 uppercase tracking-wider border-b border-red-200">
                       Маҳсулот номи
                     </th>
                     <th className="px-4 py-3 text-left text-xs font-medium text-red-800 uppercase tracking-wider border-b border-red-200">
                       Миқдор
                     </th>
                     <th className="px-4 py-3 text-left text-xs font-medium text-red-800 uppercase tracking-wider border-b border-red-200">
                       Сабаб
                     </th>
                     <th className="px-4 py-3 text-left text-xs font-medium text-red-800 uppercase tracking-wider border-b border-red-200">
                       Қайтарилган пул
                     </th>
                     <th className="px-4 py-3 text-left text-xs font-medium text-red-800 uppercase tracking-wider border-b border-red-200">
                       Қайтариш вақти
                     </th>
                     <th className="px-4 py-3 text-left text-xs font-medium text-red-800 uppercase tracking-wider border-b border-red-200">
                       Ходим
                     </th>
                   </tr>
                 </thead>
                 <tbody className="bg-white divide-y divide-red-100">
                   {transaction.returnLogs.map((log, idx) => (
                     <tr key={idx} className="hover:bg-red-50">
                       <td className="px-4 py-3">
                         <div className="font-medium text-gray-900">{log.product?.name || '-'}</div>
                         <div className="text-xs text-gray-500">{log.product?.code || '-'}</div>
                       </td>
                       <td className="px-4 py-3">
                         <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                           {log.quantity} дона
                         </span>
                       </td>
                       <td className="px-4 py-3">
                         <div className="text-gray-900">{log.description || '-'}</div>
                       </td>
                       <td className="px-4 py-3">
                         <div className="font-semibold text-red-600">
                           {formatAmount(Math.abs(log.cashAmount || 0))}
                         </div>
                       </td>
                       <td className="px-4 py-3">
                         <div className="text-gray-900">{formatDate(log.createdAt)}</div>
                       </td>
                       <td className="px-4 py-3">
                         <div className="text-gray-900">
                           {log.user ? `${log.user.firstName || ''} ${log.user.lastName || ''}`.trim() : '-'}
                         </div>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
           </div>

                     {transaction.items && transaction.items.length > 0 && (
             <div className="mb-6">
               <div className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                 <ShoppingCart size={16} />
                 Барча маҳсулотлар (асосий транзакция)
               </div>
               <div className="overflow-x-auto">
                 <table className="w-full text-sm border border-gray-200 rounded-lg">
                   <thead className="bg-gray-50">
                     <tr>
                       <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-b border-gray-200">
                         Маҳсулот номи
                       </th>
                       <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-b border-gray-200">
                         Миқдор
                       </th>
                       <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-b border-gray-200">
                         Нарх
                       </th>
                       <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-b border-gray-200">
                         Жами
                       </th>
                       <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-b border-gray-200">
                         Ҳолат
                       </th>
                     </tr>
                   </thead>
                   <tbody className="bg-white divide-y divide-gray-200">
                     {transaction.items.map((item, idx) => (
                       <tr key={idx} className="hover:bg-gray-50">
                         <td className="px-4 py-3">
                           <div className="font-medium text-gray-900">{item.product?.name || '-'}</div>
                           <div className="text-xs text-gray-500">{item.product?.code || '-'}</div>
                         </td>
                         <td className="px-4 py-3">
                           <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                             {item.quantity} дона
                           </span>
                         </td>
                         <td className="px-4 py-3">
                           <div className="font-medium text-gray-900">{formatAmount(item.price)}</div>
                         </td>
                         <td className="px-4 py-3">
                           <div className="font-semibold text-gray-900">{formatAmount(item.total)}</div>
                         </td>
                         <td className="px-4 py-3">
                           <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                             item.status === 'RETURNED' 
                               ? 'bg-red-100 text-red-800' 
                               : 'bg-green-100 text-green-800'
                           }`}>
                             {item.status === 'RETURNED' ? 'Қайтарилган' : 'Фаол'}
                           </span>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
             </div>
           )}
                 </div>
         <div className="p-4 border-t bg-gray-50 flex items-center justify-between">
           <div className="text-sm text-gray-600">
             <strong>Жами қайтарилган:</strong> {formatAmount(transaction.totalReturnedAmount)} | 
             <strong>Қолган:</strong> {formatAmount((transaction.finalTotal || transaction.total) - transaction.totalReturnedAmount)}
           </div>
           <button
             onClick={onClose}
             className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
           >
             Ёпиш
           </button>
         </div>
      </div>
    </div>
  );

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <RotateCcw className="text-red-600" size={28} />
            Қайтарилганлар
          </h1>
          <p className="text-gray-600 mt-1">Қайтарилган транзакциялар ва Кайтарилганлар</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('transactions')}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'transactions'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Транзакциялар
            </button>
            <button
              onClick={() => setViewMode('logs')}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'logs'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Кайтарилганлар
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-8">
          <div className="text-gray-500">Юкланмоқда...</div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          {viewMode === 'transactions' ? (
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Қайтарилган Транзакциялар</h2>
                <div className="text-sm text-gray-600">
                  Жами: {returnedTransactions.length} та транзакция
                </div>
              </div>
              
              {returnedTransactions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Танланган санада қайтарилган транзакциялар топилмади
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Транзакция
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Мижоз
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Сотув санаси
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Қайтариш санаси
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Тўлов тури
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Жами сумма
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Қайтарилган
                        </th>
                                                 <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                           Амаллар
                         </th>
                         <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                           Батафсил
                         </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {returnedTransactions.map((transaction) => (
                        <tr key={transaction.id} className="hover:bg-gray-50">
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              #{transaction.id}
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {transaction.customer?.fullName || '-'}
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {formatDate(transaction.createdAt)}
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {formatDate(transaction.returnDate)}
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                              {getPaymentTypeLabel(transaction.paymentType)}
                            </span>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {formatAmount(transaction.finalTotal || transaction.total)}
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-red-600">
                              {formatAmount(transaction.totalReturnedAmount)}
                            </div>
                          </td>
                                                     <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                             <button
                               onClick={() => setSelectedTransaction(transaction)}
                               className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-900"
                             >
                               <Eye size={16} />
                               Кўриш
                             </button>
                           </td>
                           <td className="px-4 py-4 whitespace-nowrap text-center">
                             <button
                               onClick={() => setSelectedTransaction(transaction)}
                               className="inline-flex items-center justify-center w-8 h-8 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded-full transition-colors"
                               title="Батафсил ma'lumot"
                             >
                               <Eye size={16} />
                             </button>
                           </td>
                         </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Қайтариш Кайтарилганлар</h2>
                <div className="text-sm text-gray-600">
                  Жами: {defectiveLogs.length} та ёзув
                </div>
              </div>
              
              {defectiveLogs.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Танланган санада қайтариш Кайтарилганлар топилмади
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Вақт
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Транзакция
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Маҳсулот
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Миқдор
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Сабаб
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Пул миқдори
                        </th>
                                                 <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                           Ходим
                         </th>
                         <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                           Батафсил
                         </th>
                       </tr>
                     </thead>
                     <tbody className="bg-white divide-y divide-gray-200">
                       {defectiveLogs.map((log, idx) => (
                         <tr key={idx} className="hover:bg-gray-50">
                           <td className="px-4 py-4 whitespace-nowrap">
                             <div className="text-sm text-gray-900">
                               {formatDate(log.createdAt)}
                             </div>
                           </td>
                           <td className="px-4 py-4 whitespace-nowrap">
                             <div className="text-sm font-medium text-gray-900">
                               #{log.transactionId}
                             </div>
                           </td>
                           <td className="px-4 py-4 whitespace-nowrap">
                             <div className="text-sm text-gray-900">
                               {log.product?.name || '-'}
                             </div>
                           </td>
                           <td className="px-4 py-4 whitespace-nowrap">
                             <div className="text-sm text-gray-900">
                               {log.quantity} дона
                             </div>
                           </td>
                           <td className="px-4 py-4 whitespace-nowrap">
                             <div className="text-sm text-gray-900">
                               {log.description || '-'}
                             </div>
                           </td>
                           <td className="px-4 py-4 whitespace-nowrap">
                             <div className="text-sm font-medium text-red-600">
                               {formatAmount(Math.abs(log.cashAmount || 0))}
                             </div>
                           </td>
                           <td className="px-4 py-4 whitespace-nowrap">
                             <div className="text-sm text-gray-900">
                               {log.user ? `${log.user.firstName || ''} ${log.user.lastName || ''}`.trim() : '-'}
                             </div>
                           </td>
                           <td className="px-4 py-4 whitespace-nowrap text-center">
                             <button
                               onClick={() => setSelectedLog(log)}
                               className="inline-flex items-center justify-center w-8 h-8 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded-full transition-colors"
                               title="Батафсил ma'lumot"
                             >
                               <Eye size={16} />
                             </button>
                           </td>
                         </tr>
                       ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

             {selectedTransaction && (
         <TransactionDetailsModal
           transaction={selectedTransaction}
           onClose={() => setSelectedTransaction(null)}
         />
       )}

       {selectedLog && (
         <LogDetailsModal
           log={selectedLog}
           onClose={() => setSelectedLog(null)}
         />
       )}
    </div>
  );
};

export default ReturnedTransactions;
