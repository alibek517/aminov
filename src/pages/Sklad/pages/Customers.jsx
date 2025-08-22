import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const Mijozlar = () => {
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [paymentSchedules, setPaymentSchedules] = useState([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentChannel, setPaymentChannel] = useState('CASH');
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

  // Filter o'zgarganda ma'lumotlarni qayta yuklash
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
  }, []);

  useEffect(() => {
    // Filter customers based on search term (only credit customers)
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
      
      // Filter customers to only show those with credit transactions
      const customersWithCredit = response.data.filter(customer => {
        if (!customer.transactions || customer.transactions.length === 0) return false;
        
        // Check if customer has any CREDIT or INSTALLMENT transactions
        return customer.transactions.some(transaction => 
          transaction.paymentType === 'CREDIT' || transaction.paymentType === 'INSTALLMENT'
        );
      });
      
      setCustomers(customersWithCredit);
      setFilteredCustomers(customersWithCredit);
      console.log('Loaded customers with credit:', customersWithCredit);
      
      // Debug: Show customers with their credit transaction counts
      customersWithCredit.forEach(customer => {
        const creditTransactions = customer.transactions.filter(t => 
          t.paymentType === 'CREDIT' || t.paymentType === 'INSTALLMENT'
        );
        console.log(`Customer: ${customer.fullName} (ID: ${customer.id}) - Credit Transactions: ${creditTransactions.length}`);
        creditTransactions.forEach(transaction => {
          console.log(`  - Transaction ${transaction.id}: ${transaction.paymentType} - ${transaction.finalTotal} - Paid: ${transaction.amountPaid || 0}`);
        });
      });
    } catch (error) {
      console.error('Error loading customers:', error);
      setNotification({ message: 'Мижозларни юклашда хато', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const loadCustomerTransactions = async (customerId) => {
    try {
      setLoading(true);
      const response = await axiosWithAuth.get(`/transactions?customerId=${customerId}&limit=100`);
      const transactions = response.data.transactions || [];
      
      console.log('Loaded transactions:', transactions);
      
      // Barcha transactionlarni va ularning payment schedule larini olish
      const allTransactions = [];
      for (const transaction of transactions) {
        console.log('Processing transaction:', transaction);
        console.log('Payment type:', transaction.paymentType);
        console.log('Payment schedules:', transaction.paymentSchedules);
        
        if (transaction.paymentSchedules && transaction.paymentSchedules.length > 0) {
          // Kredit/bo'lib tolash uchun har bir payment schedule ni alohida ko'rsatish
          allTransactions.push(...transaction.paymentSchedules.map(schedule => ({
            ...schedule,
            transaction: transaction,
            customer: transaction.customer,
            isPaymentSchedule: true
          })));
        } else {
          // Naqd pul yoki karta to'lovlari uchun transaction ni to'g'ridan-to'g'ri ko'rsatish
          allTransactions.push({
            id: `transaction-${transaction.id}`,
            transaction: transaction,
            customer: transaction.customer,
            isPaymentSchedule: false,
            payment: transaction.finalTotal,
            paidAmount: transaction.amountPaid || 0,
            remainingBalance: transaction.remainingBalance || 0,
            month: 1,
            isPaid: transaction.amountPaid >= transaction.finalTotal
          });
        }
      }
      
      console.log('All transactions processed:', allTransactions);
      setPaymentSchedules(allTransactions);
      setSelectedCustomer(customers.find(c => c.id === customerId));
    } catch (error) {
      console.error('Error loading customer transactions:', error);
      setNotification({ message: 'Мижоз маълумотларини юклашда хато', type: 'error' });
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
        
        // Update payment schedule with payment details
        const paymentScheduleUpdate = {
          paidAmount: newPaidAmount,
          isPaid: isFullyPaid,
          paidAt: new Date().toISOString(),
          paidChannel: paymentChannel
        };
        
        // Add new fields if they exist in the backend
        try {
          await axiosWithAuth.put(`/payment-schedules/${selectedSchedule.id}`, {
            ...paymentScheduleUpdate,
            creditRepaymentAmount: Number(paymentAmount),
            repaymentDate: new Date().toISOString(),
            paidByUserId: Number(localStorage.getItem('userId')) || undefined
          });
        } catch (error) {
          // Fallback to basic fields if new fields don't exist
          console.log('New fields not available, using basic fields');
          await axiosWithAuth.put(`/payment-schedules/${selectedSchedule.id}`, paymentScheduleUpdate);
        }
      }

      // Update transaction with new payment amounts
      const transactionUpdate = {
        amountPaid: newTransactionPaid,
        remainingBalance: newRemainingBalance
      };
      
      // Add new fields if they exist in the backend
      try {
        await axiosWithAuth.put(`/transactions/${transaction.id}`, {
          ...transactionUpdate,
          creditRepaymentAmount: (transaction.creditRepaymentAmount || 0) + Number(paymentAmount),
          lastRepaymentDate: new Date().toISOString()
        });
      } catch (error) {
        // Fallback to basic fields if new fields don't exist
        console.log('New fields not available, using basic fields');
        await axiosWithAuth.put(`/transactions/${transaction.id}`, transactionUpdate);
      }

      setNotification({ message: 'Тўлов муваффақиятли амалга оширилди', type: 'success' });
      setShowPaymentModal(false);
      setSelectedSchedule(null);
      setPaymentAmount('');
      setPaymentChannel('CASH');
      
      if (selectedCustomer) {
        loadCustomerTransactions(selectedCustomer.id);
      }
    } catch (error) {
      console.error('Error processing payment:', error);
      setNotification({ message: 'Тўловни амалга оширишда хато', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return amount != null && Number.isFinite(Number(amount))
      ? new Intl.NumberFormat('uz-UZ').format(Number(amount)) + " сўм"
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
        {/* Mijozlar ro'yxati */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Кредит Мижозлари</h2>
            
            {/* Search input */}
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
                              const creditTransactions = customer.transactions.filter(t => 
                                t.paymentType === 'CREDIT' || t.paymentType === 'INSTALLMENT'
                              );
                              
                              if (creditTransactions.length === 0) return null;
                              
                              const totalCredit = creditTransactions.reduce((sum, t) => sum + (t.finalTotal || 0), 0);
                              const totalPaid = creditTransactions.reduce((sum, t) => sum + (t.amountPaid || 0), 0);
                              const remaining = totalCredit - totalPaid;
                              
                              if (remaining <= 0) {
                                return (
                                  <div className="bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                                    Тўланган
                                  </div>
                                );
                              } else if (totalPaid > 0) {
                                return (
                                  <div className="bg-yellow-500 text-white text-xs px-2 py-1 rounded-full">
                                    {formatCurrency(totalPaid)} / {formatCurrency(totalCredit)}
                                  </div>
                                );
                              } else {
                                return (
                                  <div className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                                    {formatCurrency(totalCredit)}
                                  </div>
                                );
                              }
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

        {/* Customer ma'lumotlari va to'lov jadvali */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">
              {selectedCustomer ? `${selectedCustomer.fullName} - Маълумотлар` : 'Маълумотлар'}
            </h2>
            
            {selectedCustomer ? (
              <div className="space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
                {/* Customer ma'lumotlari */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold mb-2">Мижоз маълумотлари</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Тўлиқ исм:</span> {selectedCustomer.fullName}
                    </div>
                    <div>
                      <span className="font-medium">Телефон:</span> {selectedCustomer.phone}
                    </div>
                    {selectedCustomer.email && (
                      <div>
                        <span className="font-medium">Электрон почта:</span> {selectedCustomer.email}
                      </div>
                    )}
                    {selectedCustomer.address && (
                      <div>
                        <span className="font-medium">Манзил:</span> {selectedCustomer.address}
                      </div>
                    )}
                  </div>
                </div>

                {/* Mijoz transactionlari statistikasi */}
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3 className="font-semibold mb-3 text-blue-800">Мижоз статистикаси</h3>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                    <div className="text-center">
                      <div className="font-medium text-blue-700">Жами транзакциялар</div>
                      <div className="text-lg font-bold text-blue-600">{paymentSchedules.length}</div>
                    </div>
                    <div className="text-center">
                      <div className="font-medium text-green-700">Нақд пул</div>
                      <div className="text-lg font-bold text-green-600">
                        {paymentSchedules.filter(item => item.transaction.paymentType === 'CASH').length}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="font-medium text-purple-700">Карта</div>
                      <div className="text-lg font-bold text-purple-600">
                        {paymentSchedules.filter(item => item.transaction.paymentType === 'CARD').length}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="font-medium text-orange-700">Кредит</div>
                      <div className="text-lg font-bold text-orange-600">
                        {paymentSchedules.filter(item => item.transaction.paymentType === 'CREDIT').length}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="font-medium text-red-700">Бўлиб тўлаш</div>
                      <div className="text-lg font-bold text-red-600">
                        {paymentSchedules.filter(item => item.transaction.paymentType === 'INSTALLMENT').length}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Transactionlar ro'yxati */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-semibold">Сотиб олинган маҳсулотлар</h3>
                    <div className="flex items-center space-x-2">
                      <label className="text-sm text-gray-600">Тўлов тури:</label>
                      <select
                        value={transactionTypeFilter}
                        onChange={(e) => setTransactionTypeFilter(e.target.value)}
                        className="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="ALL">Ҳаммаси</option>
                        <option value="CASH">Нақд пул</option>
                        <option value="CARD">Карта</option>
                        <option value="CREDIT">Кредит</option>
                        <option value="INSTALLMENT">Бўлиб тўлаш</option>
                      </select>
                      {transactionTypeFilter !== 'ALL' && (
                        <button
                          onClick={() => setTransactionTypeFilter('ALL')}
                          className="px-2 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600 transition-colors"
                        >
                          Ҳаммасини кўрсатиш
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {/* Qidiruv */}
                  <div className="mb-4">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Маҳсулот номи ёки транзакция ID бўйича қидириш..."
                        value={transactionSearchTerm}
                        onChange={(e) => setTransactionSearchTerm(e.target.value)}
                        className="w-full p-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                      {transactionSearchTerm && (
                        <button
                          onClick={() => setTransactionSearchTerm('')}
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {/* Transactionlar statistikasi */}
                  <div className="bg-gray-50 p-3 rounded mb-4">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                      <div className="text-center">
                        <div className="font-medium text-gray-700">Жами</div>
                        <div className="text-lg font-bold text-blue-600">{paymentSchedules.length}</div>
                        <div className="text-xs text-gray-500">
                          {formatCurrency(paymentSchedules.reduce((sum, item) => sum + (item.payment || 0), 0))}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="font-medium text-gray-700">Нақд пул</div>
                        <div className="text-lg font-bold text-green-600">
                          {paymentSchedules.filter(item => item.transaction.paymentType === 'CASH').length}
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatCurrency(paymentSchedules.filter(item => item.transaction.paymentType === 'CASH').reduce((sum, item) => sum + (item.payment || 0), 0))}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="font-medium text-gray-700">Карта</div>
                        <div className="text-lg font-bold text-purple-600">
                          {paymentSchedules.filter(item => item.transaction.paymentType === 'CARD').length}
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatCurrency(paymentSchedules.filter(item => item.transaction.paymentType === 'CARD').reduce((sum, item) => sum + (item.payment || 0), 0))}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="font-medium text-gray-700">Кредит</div>
                        <div className="text-lg font-bold text-orange-600">
                          {paymentSchedules.filter(item => item.transaction.paymentType === 'CREDIT').length}
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatCurrency(paymentSchedules.filter(item => item.transaction.paymentType === 'CREDIT').reduce((sum, item) => sum + (item.payment || 0), 0))}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="font-medium text-gray-700">Бўлиб тўлаш</div>
                        <div className="text-lg font-bold text-red-600">
                          {paymentSchedules.filter(item => item.transaction.paymentType === 'INSTALLMENT').length}
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatCurrency(paymentSchedules.filter(item => item.transaction.paymentType === 'INSTALLMENT').reduce((sum, item) => sum + (item.payment || 0), 0))}
                        </div>
                      </div>
                    </div>
                  </div>
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
                        return (
                          <div key={t.id} className="border rounded-lg bg-white">
                            <button onClick={toggle} className="w-full text-left p-4 flex items-start justify-between">
                              <div>
                                <div className="font-medium text-lg">{productNames || `#${t.id}`}</div>
                                <div className="text-sm text-gray-600">{typeLabel(t.paymentType)} {months ? `— ${months} ой` : ''}{percent != null ? `, ${(percent*100).toFixed(0)}%` : ''}</div>
                                <div className="text-xs text-gray-500">Сана: {formatDate(t.createdAt)}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-lg font-bold">{formatCurrency(t.finalTotal)}</div>
                                {(t.downPayment || t.amountPaid) ? (
                                  <div className="text-xs text-gray-600">Бошланғич: {formatCurrency(Number(t.downPayment||0)+Number(t.amountPaid||0))}</div>
                                ) : null}
                                <div className="text-xs text-gray-600">Қолган: {formatCurrency(Number(t.remainingBalance||0))}</div>
                              </div>
                            </button>
                            {isOpen && (
                              <div className="px-4 pb-4">
                                {(t.paymentType === 'CREDIT' || t.paymentType === 'INSTALLMENT') && schedules.length > 0 ? (
                                  <div className="mb-3">
                                    <div className="text-sm font-medium mb-2">Тўлов жадвали</div>
                                    <div className="overflow-x-auto">
                                      <table className="w-full text-sm border">
                                        <thead className="bg-gray-50">
                                          <tr>
                                            <th className="px-2 py-1 text-left">Ой</th>
                                            <th className="px-2 py-1 text-left">Тўлов</th>
                                            <th className="px-2 py-1 text-left">Тўланган</th>
                                            <th className="px-2 py-1 text-left">Қолган</th>
                                            <th className="px-2 py-1 text-left">Ҳолат</th>
                                            <th className="px-2 py-1 text-left">Тўланган куни</th>
                                            <th className="px-2 py-1 text-left">Канал</th>
                                            <th className="px-2 py-1 text-left">Қабул қилган</th>
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
                                                <td className="px-2 py-1">{formatCurrency(rem)}</td>
                                                <td className={`px-2 py-1 text-xs ${st.color}`}>{st.text}</td>
                                                <td className="px-2 py-1">{sc.paidAt ? formatDate(sc.paidAt) : '-'}</td>
                                                <td className="px-2 py-1">{sc.paidChannel === 'CARD' ? 'Карта' : (sc.paidChannel === 'CASH' ? 'Нақд' : '-')}</td>
                                                <td className="px-2 py-1">{sc.paidBy ? `${sc.paidBy.firstName || ''} ${sc.paidBy.lastName || ''}`.trim() : '-'}</td>
                                                <td className="px-2 py-1">
                                                  {rem > 0 && (
                                                    <button
                                                      onClick={() => { setSelectedSchedule({ ...sc, transaction: t, isPaymentSchedule: true }); setPaymentAmount(rem.toString()); setShowPaymentModal(true); }}
                                                      className="bg-blue-500 text-white px-3 py-1 rounded text-xs hover:bg-blue-600"
                                                    >
                                                      Тўлаш
                                                    </button>
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

      {/* To'lov modal */}
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
              
              {/* To'lov kanali tanlash */}
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

              {/* Amount */}
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

export default Mijozlar;