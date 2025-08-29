import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const Мижозлар = () => {
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [paymentSchedules, setPaymentSchedules] = useState([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentChannel, setPaymentChannel] = useState('CASH');
  const [paymentRating, setPaymentRating] = useState('YAXSHI');
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  useEffect(() => {
    if (!notification) return;
    const t = setTimeout(() => setNotification(null), 1500);
    return () => clearTimeout(t);
  }, [notification]);
  const [transactionTypeFilter, setTransactionTypeFilter] = useState('ALL');
  const [transactionSearchTerm, setTransactionSearchTerm] = useState('');
  const [expandedTransactions, setExpandedTransactions] = useState({});
  const API_URL = 'https://suddocs.uz';
  const [exchangeRate, setExchangeRate] = useState(12650);

  // Helpers to compute accurate paid/remaining amounts across different transaction shapes
  const calculateTransactionRemaining = (t) => {
    const finalTotal = Number(t?.finalTotal || 0);
    if (t && typeof t.remainingBalance === 'number' && Number.isFinite(t.remainingBalance)) {
      return Math.max(0, Number(t.remainingBalance));
    }
    if (Array.isArray(t?.paymentSchedules) && t.paymentSchedules.length > 0) {
      const schedulesPaid = t.paymentSchedules.reduce((sum, sc) => sum + Number(sc?.paidAmount || 0), 0);
      const downPayment = Number(t?.downPayment || 0);
      const totalPaid = schedulesPaid + downPayment;
      return Math.max(0, finalTotal - totalPaid);
    }
    const paidFallback = Number(t?.amountPaid || 0) + Number(t?.downPayment || 0);
    return Math.max(0, finalTotal - paidFallback);
  };

  const calculateTransactionPaid = (t) => {
    const finalTotal = Number(t?.finalTotal || 0);
    const remaining = calculateTransactionRemaining(t);
    return Math.max(0, finalTotal - remaining);
  };

  useEffect(() => {
    if (selectedCustomer) {
      loadCustomerTransactions(selectedCustomer.id);
    }
  }, [transactionTypeFilter]);

  const axiosWithAuth = axios.create({
    baseURL: API_URL,
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
      'Content-Type': 'application/json',
    },
  });

  const didInitCustomersRef = useRef(false);
  useEffect(() => {
    if (didInitCustomersRef.current) return;
    didInitCustomersRef.current = true;
    loadCustomers();
    // fetch exchange rate once
    (async () => {
      try {
        const res = await axiosWithAuth.get('/currency-exchange-rates');
        const rate = Array.isArray(res.data) && res.data[0]?.rate ? Number(res.data[0].rate) : null;
        if (rate) setExchangeRate(rate);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredCustomers(customers);
    } else {
      const filtered = customers.filter(customer => 
        customer.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.phone?.includes(searchTerm)
      );
      setFilteredCustomers(filtered);
    }
  }, [searchTerm, customers]);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const response = await axiosWithAuth.get('/customers?skip=0&take=1000');
      const allCustomers = Array.isArray(response.data) ? response.data : [];

      const customersWithCredit = allCustomers.filter((customer) => {
        if (!Array.isArray(customer.transactions) || customer.transactions.length === 0) return false;
        const creditTransactions = customer.transactions.filter((t) => t.paymentType === 'CREDIT' || t.paymentType === 'INSTALLMENT');
        return creditTransactions.length > 0;
      });

      setCustomers(customersWithCredit);
      setFilteredCustomers(customersWithCredit);
      console.log('Юкланган кредит тарихи бор мижозлар:', customersWithCredit);
    } catch (error) {
      console.error('Мижозларни юклашда хатолик:', error);
      setNotification({ message: 'Мижозларни юклашда хатолик', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const loadCustomerTransactions = async (customerId) => {
    try {
      setLoading(true);
      const response = await axiosWithAuth.get(`/transactions?customerId=${customerId}&limit=100`);
      let transactions = response.data.transactions || [];
      // Enrich from local storage meta (termUnit/days/interestRate) if available
      try {
        const metaRaw = localStorage.getItem('tx_term_units');
        const metaMap = metaRaw ? JSON.parse(metaRaw) : {};
        if (metaMap && typeof metaMap === 'object') {
          transactions = transactions.map((tx) => {
            const meta = metaMap[String(tx.id)];
            return meta ? { ...tx, ...meta } : tx;
          });
        }
      } catch {}
      // store raw USD values; conversion is done on render via exchangeRate
      const allTransactions = [];
      for (const transaction of transactions) {
        if (transaction.paymentSchedules && transaction.paymentSchedules.length > 0) {
          allTransactions.push(...transaction.paymentSchedules.map(schedule => ({
            ...schedule,
            transaction: transaction,
            customer: transaction.customer,
            isPaymentSchedule: true
          })));
        } else {
          allTransactions.push({
            id: `transaction-${transaction.id}`,
            transaction: transaction,
            customer: transaction.customer,
            isPaymentSchedule: false,
            payment: transaction.finalTotal,
            paidAmount: transaction.amountPaid || 0,
            remainingBalance: transaction.remainingBalance || 0,
            month: 1,
            isPaid: (transaction.amountPaid || 0) >= (transaction.finalTotal || 0)
          });
        }
      }
      setPaymentSchedules(allTransactions);
      setSelectedCustomer(customers.find(c => c.id === customerId));
    } catch (error) {
      console.error('Мижоз транзакцияларини юклашда хатолик:', error);
      setNotification({ message: 'Мижоз маълумотларини юклашда хатолик', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!selectedSchedule || !paymentAmount || Number(paymentAmount) <= 0) {
      setNotification({ message: 'Тўлов миқдори тўғри киритилиши керак', type: 'error' });
      return;
    }

    try {
      setLoading(true);
      
      const transaction = selectedSchedule.transaction;
      const currentTransactionPaid = transaction.amountPaid || 0;
      const newTransactionPaid = currentTransactionPaid + Number(paymentAmount);
      const newRemainingBalance = Math.max(0, transaction.finalTotal - newTransactionPaid);
      
      if (selectedSchedule.isPaymentSchedule) {
        const currentPaidAmount = selectedSchedule.paidAmount || 0;
        const newPaidAmount = currentPaidAmount + Number(paymentAmount);
        const isFullyPaid = newPaidAmount >= selectedSchedule.payment;
        
        const paymentScheduleUpdate = {
          paidAmount: newPaidAmount,
          isPaid: isFullyPaid,
          paidAt: new Date().toISOString(),
          paidChannel: paymentChannel,
          rating: paymentRating
        };
        
        try {
          await axiosWithAuth.put(`/payment-schedules/${selectedSchedule.id}`, {
            ...paymentScheduleUpdate,
            creditRepaymentAmount: Number(paymentAmount),
            repaymentDate: new Date().toISOString(),
            paidByUserId: Number(localStorage.getItem('userId')) || undefined
          });
        } catch (error) {
          console.log('Янги майдонлар мавжуд эмас, асосий майдонлардан фойдаланилмоқда');
          await axiosWithAuth.put(`/payment-schedules/${selectedSchedule.id}`, paymentScheduleUpdate);
        }
      } else {
        // Daily installment (no schedule): store a local repayment log for dashboards/reports
        try {
          const logsRaw = localStorage.getItem('tx_daily_repayments');
          const logs = logsRaw ? JSON.parse(logsRaw) : [];
          logs.push({
            transactionId: selectedSchedule.transaction.id,
            amount: Number(paymentAmount),
            paidAt: new Date().toISOString(),
            channel: paymentChannel,
            paidByUserId: Number(localStorage.getItem('userId')) || null,
            customerId: selectedSchedule.transaction.customer?.id || null,
            branchId: selectedSchedule.transaction.fromBranchId || selectedSchedule.transaction.branchId || null,
          });
          localStorage.setItem('tx_daily_repayments', JSON.stringify(logs));
        } catch {}
      }

      const transactionUpdate = {
        amountPaid: newTransactionPaid,
        remainingBalance: newRemainingBalance
      };
      
      try {
        await axiosWithAuth.put(`/transactions/${transaction.id}`, {
          ...transactionUpdate,
          creditRepaymentAmount: (transaction.creditRepaymentAmount || 0) + Number(paymentAmount),
          lastRepaymentDate: new Date().toISOString()
        });
      } catch (error) {
        console.log('Янги майдонлар мавжуд эмас, асосий майдонлардан фойдаланилмоқда');
        await axiosWithAuth.put(`/transactions/${transaction.id}`, transactionUpdate);
      }

      setNotification({ message: 'Тўлов муваффақиятли амалга оширилди', type: 'success' });
      setShowPaymentModal(false);
      setSelectedSchedule(null);
      setPaymentAmount('');
      setPaymentChannel('CASH');
      setPaymentRating('YAXSHI');
      
      if (selectedCustomer) {
        loadCustomerTransactions(selectedCustomer.id);
      }
    } catch (error) {
      console.error('Тўловни амалга оширишда хатолик:', error);
      setNotification({ message: 'Тўловни амалга оширишда хатолик', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    const uzs = Number(amount);
    return uzs != null && Number.isFinite(uzs)
      ? new Intl.NumberFormat('uz-UZ').format(uzs) + " сўм"
      : "0 сўм";
  };

  const formatDate = (date) => {
    return date ? new Date(date).toLocaleDateString('uz-UZ') : "Номаълум";
  };

  const getPaymentStatus = (schedule) => {
    if (schedule.isPaid) return { text: 'Тўланган', color: 'text-green-600' };
    if (schedule.paidAmount > 0) return { text: 'Қисман тўланган', color: 'text-yellow-600' };
    return { text: 'Тўланмаган', color: 'text-red-600' };
  };

  return (
<div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Кредит Мижозлари ва Тўловлари</h1>

      {notification && (
        <div className={`${
          notification.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        } mb-4 p-4 rounded-lg`}>
          {notification.message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Кредит Мижозлари</h2>
            
            <div className="mb-4">
              <input
                type="text"
                placeholder="Кредит мижозини қидириш..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            

            {loading ? (
              <div className="text-center py-4">Юкланмоқда...</div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredCustomers.length > 0 ? (
                  filteredCustomers.map((customer) => (
                      <div
                        key={customer.id}
                        onClick={() => loadCustomerTransactions(customer.id)}
                        className={`p-3 rounded-lg cursor-pointer transition-colors ${
                          selectedCustomer?.id === customer.id
                            ? 'bg-blue-100 border-blue-300 border'
                            : 'bg-gray-50 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="font-medium">{customer.fullName}</div>
                            <div className="text-sm text-gray-600">{customer.phone}</div>
                            {customer.email && (
                              <div className="text-sm text-gray-500">{customer.email}</div>
                            )}
                          </div>
                          <div className="text-right">
                            {(() => {
                              const creditTransactions = (customer.transactions || []).filter((t) => t.paymentType === 'CREDIT' || t.paymentType === 'INSTALLMENT');
                              if (creditTransactions.length === 0) return null;

                              const totalCredit = creditTransactions.reduce((sum, t) => sum + Number(t?.finalTotal || 0), 0);
                              const totalRemaining = creditTransactions.reduce((sum, t) => sum + calculateTransactionRemaining(t), 0);
                              const totalPaid = Math.max(0, totalCredit - totalRemaining);

                              if (totalRemaining <= 0) return null;

                              if (totalPaid > 0) {
                                return (
                                  <div className="bg-yellow-500 text-white text-xs px-2 py-1 rounded-full">
                                    {formatCurrency(totalPaid)} / {formatCurrency(totalCredit)}
                                  </div>
                                );
                              }
                              return (
                                <div className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                                  {formatCurrency(totalCredit)}
                                </div>
                              );
                            })()}
                            
                            {/* Rating indicator */}
                            {(() => {
                              const creditTransactions = (customer.transactions || []).filter((t) => t.paymentType === 'CREDIT' || t.paymentType === 'INSTALLMENT');
                              if (creditTransactions.length === 0) return null;

                              let totalMonths = 0;
                              let goodMonths = 0;
                              let badMonths = 0;

                              creditTransactions.forEach(transaction => {
                                if (transaction.paymentSchedules) {
                                  transaction.paymentSchedules.forEach(schedule => {
                                    totalMonths++;
                                    if (schedule.rating === 'YAXSHI') {
                                      goodMonths++;
                                    } else if (schedule.rating === 'YOMON') {
                                      badMonths++;
                                    }
                                  });
                                }
                              });

                              if (totalMonths > 0) {
                                if (badMonths > goodMonths) {
                                  return (
                                    <div className="mt-1 bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full">
                                      Ёмон ({badMonths}/{totalMonths})
                                    </div>
                                  );
                                } else if (goodMonths > badMonths) {
                                  return (
                                    <div className="mt-1 bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                                      Яхши ({goodMonths}/{totalMonths})
                                    </div>
                                  );
                                } else {
                                  return (
                                    <div className="mt-1 bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded-full">
                                      Нейтрал ({goodMonths}/{totalMonths})
                                    </div>
                                  );
                                }
                              }
                              return null;
                            })()}
                          </div>
                        </div>
                      </div>
                    ))
                ) : (
                  <div className="text-center text-gray-500 py-4">
                    {searchTerm ? 'Қидирув натижаси топилмади' : 'Кредит мижозлари мавжуд эмас'}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">
              {selectedCustomer ? `${selectedCustomer.fullName} - Маълумотлар` : 'Маълумотлар'}
            </h2>
            
            {selectedCustomer ? (
              <div className="space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
                <div>
                  <div className="space-y-3">
                    {(() => {
                      const uniqueTxMap = new Map(paymentSchedules.map(ps => [ps.transaction.id, ps.transaction]));
                      let txs = Array.from(uniqueTxMap.values());
                      if (transactionTypeFilter !== 'ALL') {
                        txs = txs.filter(t => t.paymentType === transactionTypeFilter);
                      }
                      if (transactionSearchTerm) {
                        const s = transactionSearchTerm.toLowerCase();
                        txs = txs.filter(t => {
                          const names = (t.items || []).map(it => it.product?.name || '').join(' ').toLowerCase();
                          const idStr = String(t.id || '');
                          return names.includes(s) || idStr.includes(s);
                        });
                      }
                      if (txs.length === 0) {
                        return (
                          <div className="text-center text-gray-500 py-8">
                            {paymentSchedules.length === 0
                              ? 'Бу мижоз ҳали ҳеч қандай маҳсулот сотиб олмаган'
                              : `"${transactionTypeFilter === 'ALL' ? 'Ҳаммаси' : transactionTypeFilter === 'CASH' ? 'Нақд пул' : transactionTypeFilter === 'CARD' ? 'Карта' : transactionTypeFilter === 'CREDIT' ? 'Кредит' : 'Бўлиб тўлаш'}" туридаги тўловлар топилмади`}
                            {transactionSearchTerm && (
                              <div className="mt-2 text-sm text-gray-500">Қидирув: "{transactionSearchTerm}"</div>
                            )}
                          </div>
                        );
                      }
                      const typeLabel = (pt) => pt === 'CASH' ? 'Нақд' : pt === 'CARD' ? 'Карта' : pt === 'CREDIT' ? 'Кредит' : pt === 'INSTALLMENT' ? 'Бўлиб тўлаш' : pt;
                      return txs.map((t) => {
                        const isOpen = !!expandedTransactions[t.id];
                        const toggle = () => setExpandedTransactions(prev => ({ ...prev, [t.id]: !prev[t.id] }));
                        const productNames = (t.items || []).map(it => it.product?.name || it.name || '').join(', ');
                        const months = (t.items || []).map(it => Number(it.creditMonth || 0)).filter(Boolean)[0] || (Array.isArray(t.paymentSchedules) ? t.paymentSchedules.length : 0);
                        const percent = (t.items || []).map(it => (typeof it.creditPercent === 'number' ? Number(it.creditPercent) : null)).find(v => v != null);
                        const schedules = Array.isArray(t.paymentSchedules) ? t.paymentSchedules : [];
                        const totalAmount = Number(t.finalTotal || 0);
                        const paidAmountCompact = calculateTransactionPaid(t);
                        const remainingCompact = Math.max(0, totalAmount - paidAmountCompact);
                        return (
                          <div key={t.id} className="border rounded-lg bg-white">
                            <button onClick={toggle} className="w-full text-left p-4 flex items-start justify-between">
                              <div>
                                <div className="font-medium text-lg">{productNames || `#${t.id}`}</div>
                                <div className="text-sm text-gray-600">{typeLabel(t.paymentType)} {t.termUnit === 'DAYS' ? (t.days ? `— ${t.days} кун` : '') : (months ? `— ${months} ой` : '')}{percent != null ? `, ${(percent*100).toFixed(0)}%` : ''}
                                  {paidAmountCompact > 0 && remainingCompact > 0 && (
                                    <span className="ml-2 inline-block text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 align-middle">Қисман тўланган</span>
                                  )}
                                </div>
                                {t.termUnit === 'DAYS' && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    Асосий сумма: {formatCurrency(totalAmount)} | Тўланган: {formatCurrency(paidAmountCompact)} | Қолган: {formatCurrency(remainingCompact)}
                                  </div>
                                )}
                                <div className="text-xs text-gray-500">Сана: {formatDate(t.createdAt)}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-lg font-bold">{formatCurrency(t.finalTotal)}</div>
                                <div className="text-xs text-gray-600">Тўланган: {formatCurrency(calculateTransactionPaid(t))}</div>
                                <div className="text-xs text-gray-600">Қолган: {formatCurrency(calculateTransactionRemaining(t))}</div>
                                {calculateTransactionRemaining(t) <= 0 && (
                                  <div className="mt-1 inline-block bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">Тўлиқ тўланган</div>
                                )}
                              </div>
                            </button>
                            {isOpen && (
                              <div className="px-4 pb-4">
                                {(t.paymentType === 'CREDIT' || t.paymentType === 'INSTALLMENT') && schedules.length > 0 ? (
                                  <div className="mb-3">
                                    <div className="text-sm font-medium mb-2">Тўлов жадвали</div>
                                    <div className="text-xs text-gray-600 mb-2">
                                      Тўланган ойлар: {schedules.filter(sc => Number(sc?.paidAmount || 0) >= Number(sc?.payment || 0)).length}/{schedules.length}
                                    </div>
                                    <div className="overflow-x-auto">
                                      <table className="w-full text-sm border">
                                        <thead className="bg-gray-50">
                                          <tr>
                                            <th className="px-2 py-1 text-left">Ой/Кун</th>
                                            <th className="px-2 py-1 text-left">Тўлов</th>
                                            <th className="px-2 py-1 text-left">Тўланган</th>
                                            <th className="px-2 py-1 text-left">Қолган</th>
                                            <th className="px-2 py-1 text-left">Ҳолат</th>
                                            <th className="px-2 py-1 text-left">Тўланган куни</th>
                                            <th className="px-2 py-1 text-left">Канал</th>
                                            <th className="px-2 py-1 text-left">Қабул қилган</th>
                                            <th className="px-2 py-1 text-left">Баҳо</th>
                                            <th className="px-2 py-1 text-left">Тўлов вақти</th>
                                            <th className="px-2 py-1 text-left">Амал</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                          {schedules.sort((a,b)=> (a.month||0)-(b.month||0)).map(sc => {
                                            const rem = Number(sc.payment||0) - Number(sc.paidAmount||0);
                                            const st = getPaymentStatus(sc);
                                            return (
                                              <tr key={sc.id} className="align-top">
                                                <td className="px-2 py-1">{sc.month}</td>
                                                <td className="px-2 py-1">{formatCurrency(sc.payment)}</td>
                                                <td className="px-2 py-1">{formatCurrency(sc.paidAmount)}</td>
                                                <td className="px-2 py-1">{formatCurrency((Number(sc.payment||0)-Number(sc.paidAmount||0)))}</td>
                                                <td className={`px-2 py-1 text-xs ${st.color}`}>{st.text}</td>
                                                <td className="px-2 py-1">{sc.paidAt ? formatDate(sc.paidAt) : '-'}</td>
                                                <td className="px-2 py-1">{sc.paidChannel === 'CARD' ? 'Карта' : (sc.paidChannel === 'CASH' ? 'Нақд' : '-')}</td>
                                                <td className="px-2 py-1">{sc.paidBy ? `${sc.paidBy.firstName || ''} ${sc.paidBy.lastName || ''}`.trim() : '-'}</td>
                                                <td className="px-2 py-1">
                                                  {sc.rating ? (
                                                    <span className={`text-xs px-2 py-1 rounded ${
                                                      sc.rating === 'YAXSHI' 
                                                        ? 'bg-green-100 text-green-800' 
                                                        : 'bg-red-100 text-red-800'
                                                    }`}>
                                                      {sc.rating === 'YAXSHI' ? 'Яхши' : 'Ёмон'}
                                                    </span>
                                                  ) : (
                                                    <span className="text-xs text-gray-400">—</span>
                                                  )}
                                                </td>
                                                <td className="px-2 py-1">
                                                  {(() => {
                                                    const dueDate = new Date(t.createdAt);
                                                    dueDate.setMonth(dueDate.getMonth() + sc.month);
                                                    const now = new Date();
                                                    const isOverdue = dueDate < now && rem > 0;
                                                    return (
                                                      <span className={`text-xs ${isOverdue ? 'text-red-600 font-bold' : 'text-gray-600'}`}>
                                                        {formatDate(dueDate)}
                                                        {isOverdue && <span className="ml-1">⚠️</span>}
                                                      </span>
                                                    );
                                                  })()}
                                                </td>
                                                <td className="px-2 py-1">
                                                  {rem > 0 ? (
                                                    <button
                                                      onClick={() => { setSelectedSchedule({ ...sc, transaction: t, isPaymentSchedule: true }); setPaymentAmount(rem.toString()); setShowPaymentModal(true); }}
                                                      className="bg-blue-500 text-white px-3 py-1 rounded text-xs hover:bg-blue-600"
                                                    >
                                                      Тўлаш
                                                    </button>
                                                  ) : (
                                                    <span className="text-xs text-gray-400">—</span>
                                                  )}
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                ) : null}
                                <div>
                                  <div className="text-sm font-medium mb-2">Маҳсулотлар</div>
                                  <div className="space-y-2">
                                    {(t.items||[]).map((it, i) => (
                                      <div key={i} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                                        <div className="font-medium text-sm">{it.product?.name || it.name}</div>
                                        <div className="text-xs text-gray-600">{it.quantity} дона × {formatCurrency(it.price)}</div>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {(() => {
                                  if (!(t.paymentType === 'CREDIT' || t.paymentType === 'INSTALLMENT')) return null;
                                  const total = Number(t.finalTotal || 0);
                                  const paid = calculateTransactionPaid(t);
                                  const remaining = Math.max(0, total - paid);
                                  if (remaining <= 0) return null;
                                  return (
                                    <div className="mt-3 bg-blue-50 border border-blue-200 rounded p-2">
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="text-sm text-blue-800">Қолган: <span className="font-semibold">{formatCurrency(remaining)}</span></div>
                                        <div className="flex items-center gap-2">
                                          <input
                                            type="number"
                                            min="1"
                                            value={paymentAmount}
                                            onChange={(e)=>setPaymentAmount(e.target.value)}
                                            placeholder="Сумма"
                                            className="w-28 p-1.5 border border-blue-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
                                          />
                                          <button
                                            onClick={() => {
                                              const amt = Number(paymentAmount);
                                              setSelectedSchedule({
                                                transaction: t,
                                                isPaymentSchedule: false,
                                                payment: total,
                                                paidAmount: paid,
                                                remainingBalance: remaining,
                                              });
                                              setPaymentAmount(!isNaN(amt) && amt>0 ? String(amt) : String(remaining));
                                              setShowPaymentModal(true);
                                            }}
                                            className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1.5 rounded"
                                          >
                                            Тўлаш
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                Мижоз танланг
              </div>
            )}
          </div>
        </div>
      </div>

      {showPaymentModal && selectedSchedule && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-xl font-semibold text-gray-900">Кредит Тўлови Қилиш</h3>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <p className="text-gray-600 mb-2">
                  <strong>{selectedSchedule.transaction.customer.fullName}</strong> учун
                </p>
                <p className="text-gray-600 mb-2">
                  <strong>Маҳсулот:</strong> {selectedSchedule.transaction.items?.map(item => item.product?.name).join(', ')}
                </p>
                <p className="text-gray-600 mb-2">
                  <strong>Тўлов тури:</strong> {
                    selectedSchedule.transaction.paymentType === 'CREDIT' ? 'Кредит' : 
                    selectedSchedule.transaction.paymentType === 'INSTALLMENT' ? 'Бўлиб тўлаш' : 
                    selectedSchedule.transaction.paymentType === 'CASH' ? 'Нақд пул' : 'Карта'
                  }
                </p>
                {selectedSchedule.isPaymentSchedule ? (
                  <>
                    <p className="text-gray-600 mb-2">
                      <strong>{selectedSchedule.month}-ой тўлови:</strong> {formatCurrency(selectedSchedule.payment)}
                    </p>
                    <p className="text-gray-600 mb-2">
                      <strong>Тўланган:</strong> {formatCurrency(selectedSchedule.paidAmount)}
                    </p>
                    <p className="text-gray-600 mb-2">
                      <strong>Қолган:</strong> {formatCurrency(selectedSchedule.payment - selectedSchedule.paidAmount)}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-bold text-gray-900">
                      <strong>Умумий сумма:</strong> {formatCurrency(selectedSchedule.payment)}
                    </p>
                    <p className="text-gray-600 mb-2">
                      <strong>Тўланган:</strong> {formatCurrency(selectedSchedule.paidAmount)}
                    </p>
                    <p className="text-gray-600 mb-2">
                      <strong>Қолган:</strong> {formatCurrency(selectedSchedule.remainingBalance)}
                    </p>
                  </>
                )}
                {selectedSchedule.transaction.downPayment && selectedSchedule.transaction.downPayment > 0 && (
                  <p className="text-gray-600 mb-2">
                    <strong>Бошланғич тўлов:</strong> {formatCurrency(selectedSchedule.transaction.downPayment)}
                  </p>
                )}
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Тўлов канали</label>
                <div className="flex items-center gap-6 text-sm">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="paymentChannel" value="CASH" checked={paymentChannel==='CASH'} onChange={()=>setPaymentChannel('CASH')} />
                    <span>Нақд</span>
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="paymentChannel" value="CARD" checked={paymentChannel==='CARD'} onChange={()=>setPaymentChannel('CARD')} />
                    <span>Карта</span>
                  </label>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Ой баҳоси</label>
                <div className="flex items-center gap-6 text-sm">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="paymentRating" value="YAXSHI" checked={paymentRating==='YAXSHI'} onChange={()=>setPaymentRating('YAXSHI')} />
                    <span className="text-green-600 font-medium">Яхши</span>
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="paymentRating" value="YOMON" checked={paymentRating==='YOMON'} onChange={()=>setPaymentRating('YOMON')} />
                    <span className="text-red-600 font-medium">Ёмон</span>
                  </label>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Тўлов Миқдори</label>
                <input type="number" value={paymentAmount} onChange={(e)=>setPaymentAmount(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" min="0.01" max={selectedSchedule.isPaymentSchedule ? (selectedSchedule.payment - selectedSchedule.paidAmount) : selectedSchedule.remainingBalance} step="0.01" />
              </div>

              <div className="flex justify-end space-x-3">
                <button onClick={()=>{ setShowPaymentModal(false); setSelectedSchedule(null); setPaymentAmount(''); setPaymentChannel('CASH'); }} className="px-4 py-2 text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">Бекор қилиш</button>
                <button onClick={handlePayment} disabled={loading || !paymentAmount || Number(paymentAmount) <= 0} className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50">{loading ? 'Жараёнда...' : 'Кредит Тўлови Қилиш'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Мижозлар;