import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { formatCurrency } from '../../utils/currencyFormat';

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

  // Helper to get interest rate consistently
  const getInterestRate = (transaction) => {
    if (transaction.interestRate != null) {
      const rate = Number(transaction.interestRate) / 100; // Assuming interestRate is in percentage (e.g., 10 for 10%)
      console.log(`getInterestRate: transaction ${transaction.id} has interestRate ${transaction.interestRate}% -> ${rate}`);
      return rate;
    }
    if (transaction.items && transaction.items.length > 0) {
      const itemWithRate = transaction.items.find(item => item.creditPercent != null);
      if (itemWithRate) {
        const rate = Number(itemWithRate.creditPercent); // creditPercent is already a decimal
        console.log(`getInterestRate: transaction ${transaction.id} has item creditPercent ${itemWithRate.creditPercent} -> ${rate}`);
        return rate;
      }
    }
    console.log(`getInterestRate: transaction ${transaction.id} no interest rate found, defaulting to 0`);
    return 0; // Default to no interest if none found
  };

  // Helpers to compute accurate paid/remaining amounts across different transaction shapes
  const calculateTransactionRemaining = (t) => {
    // If schedules exist, compute remaining strictly from schedules
    if (Array.isArray(t?.paymentSchedules) && t.paymentSchedules.length > 0) {
      const schedules = t.paymentSchedules;
      const remainingFromSchedules = schedules.reduce((sum, sc) => {
        const payment = Number(sc?.payment || 0);
        const paid = Number(sc?.paidAmount || 0);
        return sum + Math.max(0, payment - paid);
      }, 0);
      console.debug(`Transaction ${t.id}: remaining from schedules = ${remainingFromSchedules}`);
      return Math.max(0, remainingFromSchedules);
    }

    // No schedules: fall back to remainingBalance if present, otherwise derive from totals
    const downPayment = Number.isFinite(Number(t?.downPayment)) ? Number(t.downPayment) : 0;
    const baseAmount = Number.isFinite(Number(t?.finalTotal || t?.total)) ? Number(t.finalTotal || t.total) : 0;
    const remainingBase = Math.max(0, baseAmount - downPayment);
    const creditRepaymentAmount = Number(t?.creditRepaymentAmount || 0);
    const remaining = Math.max(0, remainingBase - creditRepaymentAmount);
    console.log(`Transaction ${t.id} fallback calculation: base=${baseAmount}, downPayment=${downPayment}, creditRepaymentAmount=${creditRepaymentAmount}, remaining=${remaining}`);
    return remaining;
  };

  const calculateTransactionPaid = (t) => {
    const downPayment = Number(t?.downPayment || 0);

    if (Array.isArray(t?.paymentSchedules) && t.paymentSchedules.length > 0) {
      const schedulesPaid = t.paymentSchedules.reduce((sum, sc) => sum + Number(sc?.paidAmount || 0), 0);
      return downPayment + schedulesPaid;
    }

    // No schedules: upfront + credit repayments
    const creditRepaymentAmount = Number(t?.creditRepaymentAmount || 0);
    const totalPaid = downPayment + creditRepaymentAmount;
    if (Number(t?.amountPaid || 0) !== totalPaid) {
      console.warn(`Paid amount mismatch for transaction ${t.id}: stored=${t.amountPaid}, calculated=${totalPaid}`);
    }
    return totalPaid;
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
      } catch { }
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
      if (!Array.isArray(response.data)) {
        throw new Error('Invalid customers data format');
      }
      const allCustomers = response.data;

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
      setNotification({ message: 'Мижозларни юклашда хатолик: ' + error.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const loadCustomerTransactions = async (customerId) => {
    try {
      setLoading(true);
      const response = await axiosWithAuth.get(`/transactions?customerId=${customerId}&limit=100`);
      let transactions = response.data.transactions || [];
      
      // Fetch detailed transactions with payment schedules
      const detailedTransactions = [];
      for (const tx of transactions) {
        try {
          const detailResponse = await axiosWithAuth.get(`/transactions/${tx.id}`);
          detailedTransactions.push(detailResponse.data);
        } catch (err) {
          console.warn(`Failed to fetch details for transaction ${tx.id}:`, err);
          detailedTransactions.push(tx); // fallback to original transaction
        }
      }
      transactions = detailedTransactions;
      // Enrich from local storage meta (termUnit/days/interestRate) if available
      let metaMap = {};
      try {
        const metaRaw = localStorage.getItem('tx_term_units');
        metaMap = metaRaw ? JSON.parse(metaRaw) : {};
        if (typeof metaMap !== 'object' || metaMap === null) {
          console.warn('Invalid tx_term_units in localStorage');
          metaMap = {};
        }
        if (metaMap && typeof metaMap === 'object') {
          transactions = transactions.map((tx) => {
            const meta = metaMap[String(tx.id)];
            return meta ? { ...tx, ...meta } : tx;
          });
        }
      } catch (e) {
        console.error('Error parsing tx_term_units:', e);
        metaMap = {};
      }
      // store raw USD values; conversion is done on render via exchangeRate
      const allTransactions = [];
      for (const transaction of transactions) {
        console.log('Processing transaction:', {
          id: transaction.id,
          paymentType: transaction.paymentType,
          hasSchedules: !!(transaction.paymentSchedules && transaction.paymentSchedules.length > 0),
          schedulesCount: transaction.paymentSchedules ? transaction.paymentSchedules.length : 0,
          termUnit: transaction.termUnit
        });
        
        if (Array.isArray(transaction.paymentSchedules) && transaction.paymentSchedules.length > 0) {
          allTransactions.push(...transaction.paymentSchedules.map(schedule => ({
            ...schedule,
            transaction: transaction,
            customer: transaction.customer,
            isPaymentSchedule: true,
            isVirtual: false
          })));
        } else {
          const downPayment = Number(transaction.downPayment || 0);
          const baseAmount = Number(transaction.finalTotal || transaction.total || 0);
          const initialCredit = baseAmount - downPayment;
          const calculatedRemaining = calculateTransactionRemaining(transaction);

          if (transaction.paymentType === 'INSTALLMENT') {
            const months = (transaction.items || []).map(it => Number(it.creditMonth || 0)).filter(Boolean)[0] || 1;
            const monthlyPayment = initialCredit / months;

            // Fetch credit repayments for this transaction
            let repayments = [];
            try {
              const repRes = await axiosWithAuth.get(`/credit-repayments?transactionId=${transaction.id}`);
              repayments = Array.isArray(repRes.data) ? repRes.data : [];
            } catch (err) {
              console.error(`Failed to fetch credit-repayments for tx ${transaction.id}:`, err);
            }

            // Group paid by month
            const paidPerMonth = {};
            repayments.forEach(rep => {
              const m = rep.month;
              if (m) {
                paidPerMonth[m] = (paidPerMonth[m] || 0) + Number(rep.amount || 0);
              }
            });

            // Create virtual schedules with fixed payments based on initial credit
            let cumulativePayment = 0;
            for (let month = 1; month <= months; month++) {
              const mStr = month.toString();
              const isLastMonth = month === months;
              const monthPayment = isLastMonth ? initialCredit - cumulativePayment : monthlyPayment;
              cumulativePayment += monthPayment;

              const paid = paidPerMonth[mStr] || 0;
              const remaining = Math.max(0, monthPayment - paid);

              allTransactions.push({
                id: `installment-${transaction.id}-${month}`,
                transaction: transaction,
                customer: transaction.customer,
                isPaymentSchedule: true,
                isVirtual: true,
                month: mStr,
                payment: monthPayment,
                paidAmount: paid,
                remainingBalance: remaining,
                isPaid: remaining <= 0,
                paidAt: null,
                paidChannel: null,
                paidBy: null,
                rating: null
              });
            }
            
            console.log('Created installment schedules:', {
              transactionId: transaction.id,
              months: months,
              monthlyPayment: monthlyPayment,
              initialCredit: initialCredit
            });
          } else {
            // For other transactions without schedules (single schedule)
            const paid = Number(transaction.creditRepaymentAmount || 0);
            const remaining = Math.max(0, initialCredit - paid);

            allTransactions.push({
              id: `transaction-${transaction.id}`,
              transaction: transaction,
              customer: transaction.customer,
              isPaymentSchedule: false,
              isVirtual: true,
              payment: initialCredit,
              paidAmount: paid,
              remainingBalance: remaining,
              month: '1',
              isPaid: remaining <= 0,
              paidAt: null,
              paidChannel: null,
              paidBy: null,
              rating: null
            });
          }
          
          console.log('Transaction without schedules debug:', {
            transactionId: transaction.id,
            paymentType: transaction.paymentType,
            finalTotal: transaction.finalTotal,
            amountPaid: transaction.amountPaid,
            storedRemainingBalance: transaction.remainingBalance,
            calculatedRemaining: calculatedRemaining,
            termUnit: transaction.termUnit,
            days: transaction.days,
            months: transaction.months
          });
        }
      }
      console.log('Loaded transactions for customer:', {
        customerId: customerId,
        transactionsCount: transactions.length,
        allTransactionsCount: allTransactions.length,
        sampleTransaction: allTransactions[0],
        dailyInstallments: allTransactions.filter(t => !t.isPaymentSchedule)
      });
      
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
    // Guard: do not allow paying later months if previous months are not fully paid
    if (selectedSchedule.isPaymentSchedule && selectedSchedule.transaction?.termUnit !== 'DAYS') {
      const txSchedules = paymentSchedules.filter(ps => ps.transaction.id === selectedSchedule.transaction.id);
      const payable = isSchedulePayable(selectedSchedule, txSchedules, selectedSchedule.transaction?.termUnit);
      if (!payable) {
        setNotification({ message: 'Илтимос, аввалги ой(лар)ни тўлиқ тўланг', type: 'error' });
        return;
      }
    }
    const maxPayment = selectedSchedule.isPaymentSchedule
      ? Number(selectedSchedule.payment) - Number(selectedSchedule.paidAmount || 0)
      : Number(selectedSchedule.remainingBalance || 0);
      
    console.log('Payment validation debug:', {
      selectedSchedule: {
        isPaymentSchedule: selectedSchedule.isPaymentSchedule,
        payment: selectedSchedule.payment,
        paidAmount: selectedSchedule.paidAmount,
        remainingBalance: selectedSchedule.remainingBalance
      },
      maxPayment: maxPayment,
      paymentAmount: Number(paymentAmount)
    });
    
    if (Number(paymentAmount) > maxPayment) {
      setNotification({ message: `Тўлов миқдори ${formatCurrency(maxPayment)} дан кам бўлиши керак`, type: 'error' });
      return;
    }

    try {
      setLoading(true);

      const transaction = selectedSchedule.transaction;
      
      if (selectedSchedule.isPaymentSchedule && !selectedSchedule.isVirtual) {
        // For real payment schedules, update the schedule directly
        const currentPaidAmount = selectedSchedule.paidAmount || 0;
        const newPaidAmount = currentPaidAmount + Number(paymentAmount);
        const isFullyPaid = newPaidAmount >= selectedSchedule.payment;

        const paymentScheduleUpdate = {
          paidAmount: newPaidAmount,
          isPaid: isFullyPaid,
          paidAt: new Date().toISOString(),
          paidChannel: paymentChannel,
          rating: paymentRating,
          // Add the delta amount for proper tracking
          amountDelta: Number(paymentAmount)
        };

        console.log('Payment update data:', {
          scheduleId: selectedSchedule.id,
          paymentChannel: paymentChannel,
          paymentChannelType: typeof paymentChannel,
          paymentAmount: paymentAmount,
          updateData: paymentScheduleUpdate
        });

        console.log('Frontend: About to send API call with paidChannel:', paymentChannel);

        try {
          console.log('Updating payment schedule with:', {
            ...paymentScheduleUpdate,
            creditRepaymentAmount: Number(paymentAmount),
            repaymentDate: new Date().toISOString(),
            paidByUserId: Number(localStorage.getItem('userId')) || undefined
          });
          const response = await axiosWithAuth.put(`/payment-schedules/${selectedSchedule.id}`, {
            ...paymentScheduleUpdate,
            creditRepaymentAmount: Number(paymentAmount),
            repaymentDate: new Date().toISOString(),
            paidByUserId: Number(localStorage.getItem('userId')) || undefined
          });
          console.log('Payment schedule updated successfully. Response:', response.data);
          
          // Store payment log for Dashboard.jsx to read
          try {
            const creditRepaymentData = {
              transactionId: transaction.id,
              scheduleId: selectedSchedule.id,
              amount: Number(paymentAmount),
              channel: paymentChannel,
              month: selectedSchedule.month,
              paidAt: new Date().toISOString(),
              paidByUserId: Number(localStorage.getItem('userId')) || null,
            };
            
            await axiosWithAuth.post(`${API_URL}/credit-repayments`, creditRepaymentData);
            console.log('Payment log saved to backend:', creditRepaymentData);
          } catch (error) {
            console.error('Failed to save payment log to backend:', error);
          }
        } catch (error) {
          console.log('Янги майдонлар мавжуд эмас, асосий майдонлардан фойдаланилмоқда');
          console.log('Frontend: Fallback API call with paidChannel:', paymentChannel);
          // Ensure paidChannel is included in fallback
          const fallbackResponse = await axiosWithAuth.put(`/payment-schedules/${selectedSchedule.id}`, {
            ...paymentScheduleUpdate,
            paidChannel: paymentChannel // Explicitly include paidChannel in fallback
          });
          console.log('Fallback payment schedule update response:', fallbackResponse.data);
          
          // Store payment log even for fallback case
          try {
            const creditRepaymentData = {
              transactionId: transaction.id,
              scheduleId: selectedSchedule.id,
              amount: Number(paymentAmount),
              channel: paymentChannel,
              month: String(selectedSchedule.month), // Convert to string
              monthNumber: Number(selectedSchedule.month), // Add numeric value
              paidAt: new Date().toISOString(),
              paidByUserId: Number(localStorage.getItem('userId')) || null,
              branchId: transaction.fromBranchId || transaction.branchId || null,
            };
            
            console.log('Sending fallback credit repayment data:', creditRepaymentData);
            console.log('Month type:', typeof creditRepaymentData.month, 'Value:', creditRepaymentData.month);
            
            await axiosWithAuth.post(`${API_URL}/credit-repayments`, creditRepaymentData);
            console.log('Payment log saved to backend (fallback):', creditRepaymentData);
          } catch (error) {
            console.error('Failed to save payment log to backend (fallback):', error);
          }
        }
      } else {
        // For virtual schedules or transactions without schedules
        let repaymentData = {
          transactionId: selectedSchedule.transaction.id,
          scheduleId: selectedSchedule.id,
          amount: Number(paymentAmount),
          channel: paymentChannel,
          paidAt: new Date().toISOString(),
          paidByUserId: Number(localStorage.getItem('userId')) || null,
          branchId: selectedSchedule.transaction.fromBranchId || selectedSchedule.transaction.branchId || null,
        };

        if (selectedSchedule.transaction.termUnit === 'DAYS') {
          // Daily repayment (no month)
          await axiosWithAuth.post(`${API_URL}/daily-repayments`, repaymentData);
          console.log('Daily repayment saved to backend:', repaymentData);
        } else {
          // Credit repayment (with month)
          repaymentData = {
            ...repaymentData,
            month: String(selectedSchedule.month),
            monthNumber: Number(selectedSchedule.month),
          };
          await axiosWithAuth.post(`${API_URL}/credit-repayments`, repaymentData);
          console.log('Credit/Installment payment saved to backend:', repaymentData);
        }
        
        // Update transaction remaining balance
        const currentRemaining = transaction.remainingBalance || transaction.finalTotal;
        const newRemaining = Math.max(0, currentRemaining - Number(paymentAmount));
        
        console.log('Payment debug:', {
          transactionId: transaction.id,
          currentRemaining: currentRemaining,
          paymentAmount: Number(paymentAmount),
          newRemaining: newRemaining,
          termUnit: transaction.termUnit
        });
        
        const transactionUpdate = {
          remainingBalance: newRemaining,
          creditRepaymentAmount: (transaction.creditRepaymentAmount || 0) + Number(paymentAmount),
          lastRepaymentDate: new Date().toISOString()
        };
        
        try {
          if (transaction.status !== 'COMPLETED' && transaction.status !== 'CANCELLED') {
            await axiosWithAuth.put(`/transactions/${transaction.id}`, transactionUpdate);
            console.log('Transaction updated successfully');
          } else {
            console.log(`Transaction ${transaction.id} is ${transaction.status}, skipping update. Repayment record created successfully.`);
          }
        } catch (error) {
          console.error('Failed to update transaction:', error);
        }
      }

      console.log('Payment completed successfully. Reloading customer transactions...');
      setNotification({ message: 'Тўлов муваффақиятли амалга оширилди', type: 'success' });
      setShowPaymentModal(false);
      setSelectedSchedule(null);
      setPaymentAmount('');
      setPaymentChannel('CASH');
      setPaymentRating('YAXSHI');

      if (selectedCustomer) {
        console.log('Reloading transactions for customer:', selectedCustomer.id);
        loadCustomerTransactions(selectedCustomer.id);
      }
    } catch (error) {
      console.error('Тўловни амалга оширишда хатолик:', error);
      setNotification({ message: 'Тўловни амалга оширишда хатолик', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return "Номаълум";
    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) return "Номаълум";
    return parsedDate.toLocaleDateString('uz-UZ') + ' ' + parsedDate.toLocaleTimeString('uz-UZ', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getPaymentStatus = (schedule) => {
    if (schedule.isPaid) return { text: 'Тўланған', color: 'text-green-600' };
    if (schedule.paidAmount > 0) return { text: 'Қисман тўланған', color: 'text-yellow-600' };
    return { text: 'Тўланмаған', color: 'text-red-600' };
  };

  // Only allow paying month N when all previous months are fully paid
  const isSchedulePayable = (schedule, allSchedules = [], termUnit) => {
    if (termUnit === 'DAYS') return true; // only one entry
    const monthNum = Number(schedule?.month || 0);
    if (!monthNum || !Array.isArray(allSchedules)) return true;
    for (const sc of allSchedules) {
      const m = Number(sc?.month || 0);
      if (m > 0 && m < monthNum) {
        const remaining = Math.max(0, Number(sc?.payment || 0) - Number(sc?.paidAmount || 0));
        if (remaining > 0) return false;
      }
    }
    return true;
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Кредит Мижозлари ва Тўловлари</h1>

      {notification && (
        <div className={`${notification.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
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
                      className={`p-3 rounded-lg cursor-pointer transition-colors ${selectedCustomer?.id === customer.id
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

                          {/* Down Payment Summary */}
                          {(() => {
                            const creditTransactions = (customer.transactions || []).filter((t) => t.paymentType === 'CREDIT' || t.paymentType === 'INSTALLMENT');
                            if (creditTransactions.length === 0) return null;

                            const totalDownPayment = creditTransactions.reduce((sum, t) => sum + Number(t?.downPayment || 0), 0);
                            if (totalDownPayment > 0) {
                              return (
                                <div className="mt-1 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                                  💰 Олдиндан: {formatCurrency(totalDownPayment)}
                                </div>
                              );
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
                        const productBarcode = (t.items || []).map(it => it.product?.barcode || it.barcode || '').join(', ');
                        const months = (t.items || []).map(it => Number(it.creditMonth || 0)).filter(Boolean)[0] || (Array.isArray(t.paymentSchedules) ? t.paymentSchedules.length : 0);
                        const percent = (t.items || []).map(it => (typeof it.creditPercent === 'number' ? Number(it.creditPercent) : null)).find(v => v != null);
                        // Also try to get interest rate from transaction level
                        const transactionInterestRate = t.interestRate || (percent ? percent * 100 : null);


                        const schedules = paymentSchedules.filter(ps => ps.transaction.id === t.id);
                        const totalAmount = Number(t.finalTotal || 0);
                        const paidAmountCompact = calculateTransactionPaid(t);
                        const remainingCompact = calculateTransactionRemaining(t);
                        return (
                          <div key={t.id} className="border rounded-lg bg-white">
                            <button onClick={toggle} className="w-full text-left p-4 flex items-start justify-between">
                              <div>
                                <div className="font-medium text-lg">{productNames || `#${t.id}`}</div>
                                <small>{productBarcode || `#${t.id}`}</small>
                                <div className="text-sm text-gray-600">
                                  {typeLabel(t.paymentType)} {
                                    t.termUnit === 'DAYS' 
                                      ? (t.days ? `— ${t.days} кун (1 та тўлов)` : '') 
                                      : (months ? `— ${months} ой` : '')
                                  }
                                  {percent != null ? `, ${(percent * 100).toFixed(0)}%` : ''}
                                  {paidAmountCompact > 0 && remainingCompact > 0 && (
                                    <span className="ml-2 inline-block text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 align-middle">Қисман тўланған</span>
                                  )}
                                </div>
                                {t.termUnit === 'DAYS' && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    Асосий сумма: {formatCurrency(t.total || totalAmount)} | Тўланған: {formatCurrency(paidAmountCompact)} | Қолган: {formatCurrency(calculateTransactionRemaining(t))} | {t.days || 0} кун ичида тўлаш керак
                                  </div>
                                )}
                                {t.downPayment && t.downPayment > 0 && (
                                  <div className="text-xs text-blue-600 mt-1">
                                    💰 Олдиндан олинған: {formatCurrency(t.downPayment)}
                                  </div>
                                )}
                                <div className="text-xs text-gray-500">Сана: {formatDate(t.createdAt)}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-lg font-bold">{formatCurrency(calculateTransactionPaid(t) + calculateTransactionRemaining(t))}</div>
                                <div className="text-xs text-gray-600">Тўланған: {formatCurrency(calculateTransactionPaid(t))}</div>
                                <div className="text-xs text-gray-600">Қолган: {formatCurrency(calculateTransactionRemaining(t))}</div>


                                {calculateTransactionRemaining(t) <= 0 && (
                                  <div className="mt-1 inline-block bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">Тўлиқ тўланған</div>
                                )}
                              </div>
                            </button>
                            {isOpen && (
                              <div className="px-4 pb-4">
                                {(t.paymentType === 'CREDIT' || t.paymentType === 'INSTALLMENT') && schedules.length > 0 ? (
                                  <div className="mb-3">
                                    <div className="text-sm font-medium mb-2">
                                      {t.termUnit === 'DAYS' ? 'Кунлик тўлов' : 'Тўлов жадвали'}
                                    </div>
                                    <div className="text-xs text-gray-600 mb-2">
                                      {t.termUnit === 'DAYS' 
                                        ? `Кунлар: ${t.days || 0} | Тўланған: ${schedules.filter(sc => Number(sc?.paidAmount || 0) >= Number(sc?.payment || 0)).length}/1`
                                        : `Тўланған ойлар: ${schedules.filter(sc => Number(sc?.paidAmount || 0) >= Number(sc?.payment || 0)).length}/${schedules.length}`
                                      }
                                    </div>
                                    <div className="overflow-x-auto">
                                      <table className="w-full text-sm border">
                                        <thead className="bg-gray-50">
                                          <tr>
                                            <th className="px-2 py-1 text-left">{t.termUnit === 'DAYS' ? 'Кун' : 'Ой'}</th>
                                            <th className="px-2 py-1 text-left">Тўлов</th>
                                            <th className="px-2 py-1 text-left">Тўланған</th>
                                            <th className="px-2 py-1 text-left">Қолган</th>
                                            <th className="px-2 py-1 text-left">Ҳолат</th>
                                            <th className="px-2 py-1 text-left">Тўланған куни</th>
                                            <th className="px-2 py-1 text-left">Канал</th>
                                            <th className="px-2 py-1 text-left">Қабул қилған</th>
                                            <th className="px-2 py-1 text-left">Баҳо</th>
                                            <th className="px-2 py-1 text-left">Тўлов вақти</th>
                                            <th className="px-2 py-1 text-left">Амал</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                          {schedules.sort((a, b) => (a.month || 0) - (b.month || 0)).map(sc => {
                                            const rem = Number(sc.payment || 0) - Number(sc.paidAmount || 0);
                                            const st = getPaymentStatus(sc);
                                            const txSchedules = paymentSchedules.filter(ps => ps.transaction.id === sc.transaction.id);
                                            const payable = isSchedulePayable(sc, txSchedules, t.termUnit);
                                            return (
                                              <tr key={sc.id} className="align-top">
                                                <td className="px-2 py-1">
                                                  {t.termUnit === 'DAYS' ? `${sc.daysCount || t.days || 0} кун` : sc.month}
                                                </td>
                                                <td className="px-2 py-1">{formatCurrency(sc.payment)}</td>
                                                <td className="px-2 py-1">{formatCurrency(sc.paidAmount)}</td>
                                                <td className="px-2 py-1">{formatCurrency((Number(sc.payment || 0) - Number(sc.paidAmount || 0)))}</td>
                                                <td className={`px-2 py-1 text-xs ${st.color}`}>{st.text}</td>
                                                <td className="px-2 py-1">{sc.paidAt ? formatDate(sc.paidAt) : '-'}</td>
                                                <td className="px-2 py-1">{sc.paidChannel === 'CARD' ? 'Карта' : (sc.paidChannel === 'CASH' ? 'Нақд' : '-')}</td>
                                                <td className="px-2 py-1">{sc.paidBy ? `${sc.paidBy.firstName || ''} ${sc.paidBy.lastName || ''}`.trim() : '-'}</td>
                                                <td className="px-2 py-1">
                                                  {sc.rating ? (
                                                    <span className={`text-xs px-2 py-1 rounded ${sc.rating === 'YAXSHI'
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
                                                    if (t.termUnit === 'DAYS') {
                                                      // Kunlik bo'lib to'lash uchun kunlar soni keyin to'lov muddati
                                                      const dueDate = new Date(t.createdAt || Date.now());
                                                      if (!t.createdAt) {
                                                        console.warn(`Missing createdAt for transaction ${t.id}, using current date`);
                                                      }
                                                      dueDate.setDate(dueDate.getDate() + (sc.daysCount || t.days || 0));
                                                      const now = new Date();
                                                      const isOverdue = dueDate < now && rem > 0;
                                                      return (
                                                        <span className={`text-xs ${isOverdue ? 'text-red-600 font-bold' : 'text-gray-600'}`}>
                                                          {formatDate(dueDate)}
                                                          {isOverdue && <span className="ml-1">⚠️</span>}
                                                        </span>
                                                      );
                                                    } else {
                                                      // Oylik bo'lib to'lash uchun oylar soni keyin to'lov muddati
                                                      const dueDate = new Date(t.createdAt || Date.now());
                                                      if (!t.createdAt) {
                                                        console.warn(`Missing createdAt for transaction ${t.id}, using current date`);
                                                      }
                                                      dueDate.setMonth(dueDate.getMonth() + sc.month);
                                                      const now = new Date();
                                                      const isOverdue = dueDate < now && rem > 0;
                                                      return (
                                                        <span className={`text-xs ${isOverdue ? 'text-red-600 font-bold' : 'text-gray-600'}`}>
                                                          {formatDate(dueDate)}
                                                          {isOverdue && <span className="ml-1">⚠️</span>}
                                                        </span>
                                                      );
                                                    }
                                                  })()}
                                                </td>
                                                <td className="px-2 py-1">
                                                  {rem > 0 ? (
                                                    <button
                                                      onClick={() => { if (!payable) return; setSelectedSchedule({ ...sc, transaction: t }); setPaymentAmount(rem.toString()); setShowPaymentModal(true); }}
                                                      disabled={!payable}
                                                      className={`px-3 py-1 rounded text-xs ${payable ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
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
                                    {(t.items || []).map((it, i) => (
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
                      <strong>Тўланған:</strong> {formatCurrency(selectedSchedule.paidAmount)}
                    </p>
                    <p className="text-gray-600 mb-2">
                      <strong>Қолган:</strong> {formatCurrency(selectedSchedule.payment - selectedSchedule.paidAmount)}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-bold text-gray-900">
                      <strong>Умумий сумма:</strong> {formatCurrency(selectedSchedule.transaction.total || selectedSchedule.payment)}
                    </p>
                    <p className="text-gray-600 mb-2">
                      <strong>Тўланған:</strong> {formatCurrency(selectedSchedule.paidAmount)}
                    </p>
                    <p className="text-gray-600 mb-2">
                      <strong>Қолган:</strong> {formatCurrency(selectedSchedule.remainingBalance)}
                    </p>
                    {selectedSchedule.transaction.termUnit === 'DAYS' && (
                      <p className="text-gray-600 mb-2">
                        <strong>Тўлов тури:</strong> {selectedSchedule.transaction.days} кун ичида 1 та тўлов
                      </p>
                    )}
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
                    <input type="radio" name="paymentChannel" value="CASH" checked={paymentChannel === 'CASH'} onChange={() => setPaymentChannel('CASH')} />
                    <span>Нақд</span>
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="paymentChannel" value="CARD" checked={paymentChannel === 'CARD'} onChange={() => setPaymentChannel('CARD')} />
                    <span>Карта</span>
                  </label>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Ой баҳоси</label>
                <div className="flex items-center gap-6 text-sm">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="paymentRating" value="YAXSHI" checked={paymentRating === 'YAXSHI'} onChange={() => setPaymentRating('YAXSHI')} />
                    <span className="text-green-600 font-medium">Яхши</span>
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="paymentRating" value="YOMON" checked={paymentRating === 'YOMON'} onChange={() => setPaymentRating('YOMON')} />
                    <span className="text-red-600 font-medium">Ёмон</span>
                  </label>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Тўлов Миқдори</label>
                <input 
                  type="number" 
                  value={paymentAmount} 
                  onChange={(e) => setPaymentAmount(e.target.value)} 
                  className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" 
                  min="0.01" 
                  max={(() => {
                    const max = selectedSchedule.isPaymentSchedule 
                      ? (selectedSchedule.payment - selectedSchedule.paidAmount) 
                      : selectedSchedule.remainingBalance;
                    console.log('Payment input max calculation:', {
                      isPaymentSchedule: selectedSchedule.isPaymentSchedule,
                      payment: selectedSchedule.payment,
                      paidAmount: selectedSchedule.paidAmount,
                      remainingBalance: selectedSchedule.remainingBalance,
                      max: max
                    });
                    return max;
                  })()} 
                  step="0" 
                />
                <div className="text-xs text-gray-500 mt-1">
                  Максимал тўлов: {formatCurrency(selectedSchedule.isPaymentSchedule 
                    ? (selectedSchedule.payment - selectedSchedule.paidAmount) 
                    : selectedSchedule.remainingBalance)}
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button onClick={() => { setShowPaymentModal(false); setSelectedSchedule(null); setPaymentAmount(''); setPaymentChannel('CASH'); }} className="px-4 py-2 text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">Бекор қилиш</button>
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