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
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  useEffect(() => {
    if (!notification) return;
    const t = setTimeout(() => setNotification(null), 1500);
    return () => clearTimeout(t);
  }, [notification]);
  const [transactionTypeFilter, setTransactionTypeFilter] = useState('ALL');
  const [transactionSearchTerm, setTransactionSearchTerm] = useState('');
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
    // Filter customers based on search term
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
      setCustomers(response.data);
      setFilteredCustomers(response.data);
      console.log('Loaded customers:', response.data);
      
      // Debug: Show customers with their transaction counts
      response.data.forEach(customer => {
        console.log(`Customer: ${customer.fullName} (ID: ${customer.id}) - Transactions: ${customer.transactions?.length || 0}`);
        if (customer.transactions && customer.transactions.length > 0) {
          customer.transactions.forEach(transaction => {
            console.log(`  - Transaction ${transaction.id}: ${transaction.paymentType} - ${transaction.finalTotal}`);
          });
        }
      });
    } catch (error) {
      console.error('Error loading customers:', error);
      setNotification({ message: 'Mijozlarni yuklashda xatolik', type: 'error' });
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
      setNotification({ message: 'Mijoz ma\'lumotlarini yuklashda xatolik', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!selectedSchedule || !paymentAmount || Number(paymentAmount) <= 0) {
      setNotification({ message: 'To\'lov miqdori to\'g\'ri kiritilishi kerak', type: 'error' });
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
        
        await axiosWithAuth.put(`/payment-schedules/${selectedSchedule.id}`, {
          paidAmount: newPaidAmount,
          isPaid: isFullyPaid,
          paidAt: new Date().toISOString()
        });
      }

      await axiosWithAuth.put(`/transactions/${transaction.id}`, {
        amountPaid: newTransactionPaid,
        remainingBalance: newRemainingBalance
      });

      setNotification({ message: 'To\'lov muvaffaqiyatli amalga oshirildi', type: 'success' });
      setShowPaymentModal(false);
      setSelectedSchedule(null);
      setPaymentAmount('');
      
      if (selectedCustomer) {
        loadCustomerTransactions(selectedCustomer.id);
      }
    } catch (error) {
      console.error('Error processing payment:', error);
      setNotification({ message: 'To\'lovni amalga oshirishda xatolik', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return amount != null && Number.isFinite(Number(amount))
      ? new Intl.NumberFormat('uz-UZ').format(Number(amount)) + " so'm"
      : "0 so'm";
  };

  const formatDate = (date) => {
    return date ? new Date(date).toLocaleDateString('uz-UZ') : "Noma'lum";
  };

  const getPaymentStatus = (schedule) => {
    if (schedule.isPaid) return { text: 'To\'langan', color: 'text-green-600' };
    if (schedule.paidAmount > 0) return { text: 'Qisman to\'langan', color: 'text-yellow-600' };
    return { text: 'To\'lanmagan', color: 'text-red-600' };
  };

  return (
    <div className="ml-[255px] space-y-6 p-4">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Mijozlar va Kredit To'lovlari</h1>

      {notification && (
        <div className={`mb-4 p-4 rounded-lg ${
          notification.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {notification.message}
      </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Mijozlar ro'yxati */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Mijozlar</h2>
            
            {/* Search input */}
            <div className="mb-4">
              <input
                type="text"
                placeholder="Telefon yoki ism bo'yicha qidirish..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            

            {loading ? (
              <div className="text-center py-4">Yuklanmoqda...</div>
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
                            {customer.transactions && customer.transactions.length > 0 ? (
                              <div className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                                {customer.transactions.length} ta
                              </div>
                            ) : (
                              <div className="bg-gray-300 text-gray-600 text-xs px-2 py-1 rounded-full">
                                0 ta
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                ) : (
                  <div className="text-center text-gray-500 py-4">
                    {searchTerm ? 'Qidiruv natijasi topilmadi' : 'Mijozlar mavjud emas'}
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
              {selectedCustomer ? `${selectedCustomer.fullName} - Ma'lumotlar` : 'Ma\'lumotlar'}
            </h2>
            
            {selectedCustomer ? (
              <div className="space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
                {/* Customer ma'lumotlari */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold mb-2">Mijoz ma'lumotlari</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">To'liq ism:</span> {selectedCustomer.fullName}
                    </div>
                    <div>
                      <span className="font-medium">Telefon:</span> {selectedCustomer.phone}
                    </div>
                    {selectedCustomer.email && (
                      <div>
                        <span className="font-medium">Email:</span> {selectedCustomer.email}
                      </div>
                    )}
                    {selectedCustomer.address && (
                      <div>
                        <span className="font-medium">Manzil:</span> {selectedCustomer.address}
                      </div>
                    )}
                  </div>
                </div>

                {/* Mijoz transactionlari statistikasi */}
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3 className="font-semibold mb-3 text-blue-800">Mijoz statistikasi</h3>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                    <div className="text-center">
                      <div className="font-medium text-blue-700">Jami transactionlar</div>
                      <div className="text-lg font-bold text-blue-600">{paymentSchedules.length}</div>
                    </div>
                    <div className="text-center">
                      <div className="font-medium text-green-700">Naqd pul</div>
                      <div className="text-lg font-bold text-green-600">
                        {paymentSchedules.filter(item => item.transaction.paymentType === 'CASH').length}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="font-medium text-purple-700">Karta</div>
                      <div className="text-lg font-bold text-purple-600">
                        {paymentSchedules.filter(item => item.transaction.paymentType === 'CARD').length}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="font-medium text-orange-700">Kredit</div>
                      <div className="text-lg font-bold text-orange-600">
                        {paymentSchedules.filter(item => item.transaction.paymentType === 'CREDIT').length}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="font-medium text-red-700">Bo'lib tolash</div>
                      <div className="text-lg font-bold text-red-600">
                        {paymentSchedules.filter(item => item.transaction.paymentType === 'INSTALLMENT').length}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Transactionlar ro'yxati */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-semibold">Sotib olingan mahsulotlar</h3>
                    <div className="flex items-center space-x-2">
                      <label className="text-sm text-gray-600">To'lov turi:</label>
                      <select
                        value={transactionTypeFilter}
                        onChange={(e) => setTransactionTypeFilter(e.target.value)}
                        className="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="ALL">Hammasi</option>
                        <option value="CASH">Naqd pul</option>
                        <option value="CARD">Karta</option>
                        <option value="CREDIT">Kredit</option>
                        <option value="INSTALLMENT">Bo'lib tolash</option>
                      </select>
                      {transactionTypeFilter !== 'ALL' && (
                        <button
                          onClick={() => setTransactionTypeFilter('ALL')}
                          className="px-2 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600 transition-colors"
                        >
                          Hammasini ko'rsatish
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {/* Qidiruv */}
                  <div className="mb-4">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Mahsulot nomi yoki transaction ID bo'yicha qidirish..."
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
                        <div className="font-medium text-gray-700">Jami</div>
                        <div className="text-lg font-bold text-blue-600">{paymentSchedules.length}</div>
                        <div className="text-xs text-gray-500">
                          {formatCurrency(paymentSchedules.reduce((sum, item) => sum + (item.payment || 0), 0))}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="font-medium text-gray-700">Naqd pul</div>
                        <div className="text-lg font-bold text-green-600">
                          {paymentSchedules.filter(item => item.transaction.paymentType === 'CASH').length}
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatCurrency(paymentSchedules.filter(item => item.transaction.paymentType === 'CASH').reduce((sum, item) => sum + (item.payment || 0), 0))}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="font-medium text-gray-700">Karta</div>
                        <div className="text-lg font-bold text-purple-600">
                          {paymentSchedules.filter(item => item.transaction.paymentType === 'CARD').length}
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatCurrency(paymentSchedules.filter(item => item.transaction.paymentType === 'CARD').reduce((sum, item) => sum + (item.payment || 0), 0))}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="font-medium text-gray-700">Kredit</div>
                        <div className="text-lg font-bold text-orange-600">
                          {paymentSchedules.filter(item => item.transaction.paymentType === 'CREDIT').length}
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatCurrency(paymentSchedules.filter(item => item.transaction.paymentType === 'CREDIT').reduce((sum, item) => sum + (item.payment || 0), 0))}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="font-medium text-gray-700">Bo'lib tolash</div>
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
                    {paymentSchedules.length > 0 ? (
                      paymentSchedules
                        .filter((item) => {
                          // To'lov turi bo'yicha filtrlash
                          if (transactionTypeFilter !== 'ALL' && item.transaction.paymentType !== transactionTypeFilter) {
                            return false;
                          }
                          
                          // Qidiruv bo'yicha filtrlash
                          if (transactionSearchTerm) {
                            const searchLower = transactionSearchTerm.toLowerCase();
                            const productNames = item.transaction.items?.map(item => item.product?.name).join(' ').toLowerCase() || '';
                            const transactionId = item.transaction.id?.toString() || '';
                            
                            if (!productNames.includes(searchLower) && !transactionId.includes(searchLower)) {
                              return false;
                            }
                          }
                          
                          return true;
                        })
                        .map((item) => {
                        const transaction = item.transaction;
                        const isPaymentSchedule = item.isPaymentSchedule;
                        
                        if (isPaymentSchedule) {
                          // Kredit/bo'lib tolash uchun payment schedule ko'rsatish
                          const status = getPaymentStatus(item);
                          const remaining = item.payment - item.paidAmount;
                          
                          return (
                            <div key={item.id} className="border rounded-lg p-4 bg-white">
                              <div className="flex justify-between items-start mb-3">
                                <div>
                                  <h4 className="font-medium text-lg">
                                    {transaction.items?.map(item => item.product?.name).join(', ')}
                                  </h4>
                                  <p className="text-sm text-gray-600">
                                    {transaction.paymentType === 'CREDIT' ? 'Kredit' : 
                                     transaction.paymentType === 'INSTALLMENT' ? 'Bo\'lib tolash' : 
                                     transaction.paymentType === 'CASH' ? 'Naqd pul' : 'Karta'}
                                  </p>
                                  <p className="text-sm text-gray-500">
                                    Sana: {formatDate(transaction.createdAt)}
                                  </p>
                                  {transaction.soldBy && (
                                    <p className="text-sm text-gray-500">
                                      Sotuvchi: {transaction.soldBy.firstName || transaction.soldBy.lastName || 'Noma\'lum'} 
                                      ({transaction.soldBy.role})
                                    </p>
                                  )}
                                </div>
                                <div className="text-right">
                                  <div className="text-lg font-bold">
                                    {formatCurrency(transaction.finalTotal)}
                                  </div>
                                  {transaction.downPayment && transaction.downPayment > 0 && (
                                    <div className="text-sm text-gray-600">
                                      Boshlang'ich: {formatCurrency(transaction.downPayment)}
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              {/* Payment schedule */}
                              <div className="bg-gray-50 p-3 rounded">
                                <div className="flex justify-between items-center mb-2">
                                  <span className="font-medium">{item.month}-oy to'lovi</span>
                                  <span className={`px-2 py-1 rounded text-xs ${status.color}`}>
                                    {status.text}
                                  </span>
                                </div>
                                <div className="grid grid-cols-3 gap-4 text-sm">
                                  <div>
                                    <span className="text-gray-600">To'lov:</span>
                                    <div className="font-medium">{formatCurrency(item.payment)}</div>
                                  </div>
                                  <div>
                                    <span className="text-gray-600">To'langan:</span>
                                    <div className="font-medium">{formatCurrency(item.paidAmount)}</div>
                                  </div>
                                  <div>
                                    <span className="text-gray-600">Qolgan:</span>
                                    <div className="font-medium">{formatCurrency(remaining)}</div>
                                  </div>
                                </div>
                                {remaining > 0 && (
                                  <button
                                    onClick={() => {
                                      setSelectedSchedule(item);
                                      setPaymentAmount(remaining.toString());
                                      setShowPaymentModal(true);
                                    }}
                                    className="mt-2 bg-blue-500 text-white px-4 py-2 rounded text-sm hover:bg-blue-600 transition-colors"
                                  >
                                    To'lov qilish
                                  </button>
                                )}
                              </div>
                              
                              {/* Mahsulotlar ro'yxati */}
                              <div className="mt-4 border-t pt-4">
                                <h5 className="font-medium text-sm mb-3 text-gray-700">Mahsulotlar</h5>
                                <div className="space-y-2">
                                  {transaction.items?.map((item, index) => (
                                    <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                                      <div className="flex-1">
                                        <div className="font-medium text-sm">{item.product?.name}</div>
                                        <div className="text-xs text-gray-600">
                                          Miqdori: {item.quantity} | Narxi: {formatCurrency(item.price)}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          );
                        } else {
                          // Naqd pul yoki karta to'lovlari uchun oddiy ko'rsatish - ular darhol to'lanadi
                          const status = { text: 'To\'langan', color: 'text-green-600' };
                          
                          return (
                            <div key={item.id} className="border rounded-lg p-4 bg-white">
                              <div className="flex justify-between items-start mb-3">
                                <div>
                                  <h4 className="font-medium text-lg">
                                    {transaction.items?.map(item => item.product?.name).join(', ')}
                                  </h4>
                                  <p className="text-sm text-gray-600">
                                    {transaction.paymentType === 'CREDIT' ? 'Kredit' : 
                                     transaction.paymentType === 'INSTALLMENT' ? 'Bo\'lib tolash' : 
                                     transaction.paymentType === 'CASH' ? 'Naqd pul' : 'Karta'}
                                  </p>
                                  <p className="text-sm text-gray-500">
                                    Sana: {formatDate(transaction.createdAt)}
                                  </p>
                                  {transaction.soldBy && (
                                    <p className="text-sm text-gray-500">
                                      Sotuvchi: {transaction.soldBy.firstName || transaction.soldBy.lastName || 'Noma\'lum'} 
                                      ({transaction.soldBy.role})
                                    </p>
                                  )}
                                </div>
                                <div className="text-right">
                                  <div className="text-lg font-bold">
                                    {formatCurrency(transaction.finalTotal)}
                                  </div>
                                  {transaction.downPayment && transaction.downPayment > 0 && (
                                    <div className="text-sm text-gray-600">
                                      Boshlang'ich: {formatCurrency(transaction.downPayment)}
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              {/* To'lov ma'lumotlari */}
                              <div className="bg-gray-50 p-3 rounded">
                                <div className="flex justify-between items-center mb-2">
                                  <span className="font-medium">To'lov ma'lumotlari</span>
                                  <span className={`px-2 py-1 rounded text-xs ${status.color}`}>
                                    {status.text}
                                  </span>
                                </div>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  <div>
                                    <span className="text-gray-600">Umumiy summa:</span>
                                    <div className="font-medium">{formatCurrency(item.payment)}</div>
                                  </div>
                                  <div>
                                    <span className="text-gray-600">To'lov holati:</span>
                                    <div className="font-medium text-green-600">To'langan</div>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Mahsulotlar ro'yxati */}
                              <div className="mt-4 border-t pt-4">
                                <h5 className="font-medium text-sm mb-3 text-gray-700">Mahsulotlar</h5>
                                <div className="space-y-2">
                                  {transaction.items?.map((item, index) => (
                                    <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                                      <div className="flex-1">
                                        <div className="font-medium text-sm">{item.product?.name}</div>
                                        <div className="text-xs text-gray-600">
                                          Miqdori: {item.quantity} | Narxi: {formatCurrency(item.price)}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          );
                        }
                      })
                    ) : (
                      <div className="text-center text-gray-500 py-8">
                        {paymentSchedules.length === 0 
                          ? 'Bu mijoz hali hech qanday mahsulot sotib olmagan'
                          : `"${transactionTypeFilter === 'ALL' ? 'Hammasi' : 
                              transactionTypeFilter === 'CASH' ? 'Naqd pul' :
                              transactionTypeFilter === 'CARD' ? 'Karta' :
                              transactionTypeFilter === 'CREDIT' ? 'Kredit' : 'Bo\'lib tolash'}" turidagi to'lovlar topilmadi`
                        }
                        {transactionSearchTerm && (
                          <div className="mt-2 text-sm text-gray-500">
                            Qidiruv: "{transactionSearchTerm}"
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                Mijoz tanlang
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
              <h3 className="text-xl font-semibold text-gray-900">
                To'lov Qilish
              </h3>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <p className="text-gray-600 mb-2">
                  <strong>{selectedSchedule.transaction.customer.fullName}</strong> uchun
                </p>
                <p className="text-gray-600 mb-2">
                  <strong>Mahsulot:</strong> {selectedSchedule.transaction.items?.map(item => item.product?.name).join(', ')}
                </p>
                <p className="text-gray-600 mb-2">
                  <strong>To'lov turi:</strong> {
                    selectedSchedule.transaction.paymentType === 'CREDIT' ? 'Kredit' : 
                    selectedSchedule.transaction.paymentType === 'INSTALLMENT' ? 'Bo\'lib tolash' : 
                    selectedSchedule.transaction.paymentType === 'CASH' ? 'Naqd pul' : 'Karta'
                  }
                </p>
                {selectedSchedule.isPaymentSchedule ? (
                  <>
                    <p className="text-gray-600 mb-2">
                      <strong>{selectedSchedule.month}-oy to'lovi:</strong> {formatCurrency(selectedSchedule.payment)}
                    </p>
                    <p className="text-gray-600 mb-2">
                      <strong>To'langan:</strong> {formatCurrency(selectedSchedule.paidAmount)}
                    </p>
                    <p className="text-gray-600 mb-2">
                      <strong>Qolgan:</strong> {formatCurrency(selectedSchedule.payment - selectedSchedule.paidAmount)}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-bold text-gray-900">
                      <strong>Umumiy summa:</strong> {formatCurrency(selectedSchedule.payment)}
                    </p>
                    <p className="text-gray-600 mb-2">
                      <strong>To'langan:</strong> {formatCurrency(selectedSchedule.paidAmount)}
                    </p>
                    <p className="text-gray-600 mb-2">
                      <strong>Qolgan:</strong> {formatCurrency(selectedSchedule.remainingBalance)}
                    </p>
                  </>
                )}
                {selectedSchedule.transaction.downPayment && selectedSchedule.transaction.downPayment > 0 && (
                  <p className="text-gray-600 mb-2">
                    <strong>Boshlang'ich to'lov:</strong> {formatCurrency(selectedSchedule.transaction.downPayment)}
                  </p>
                )}
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  To'lov Miqdori
                </label>
                        <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0.01"
                  max={selectedSchedule.isPaymentSchedule ? 
                    selectedSchedule.payment - selectedSchedule.paidAmount : 
                    selectedSchedule.remainingBalance}
                  step="0.01"
                />
              </div>

              <div className="flex justify-end space-x-3">
                  <button
                  onClick={() => {
                    setShowPaymentModal(false);
                    setSelectedSchedule(null);
                    setPaymentAmount('');
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Bekor qilish
                  </button>
                  <button
                  onClick={handlePayment}
                  disabled={loading || !paymentAmount || Number(paymentAmount) <= 0}
                  className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                  {loading ? 'Jarayonda...' : 'To\'lov Qilish'}
                  </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Mijozlar;