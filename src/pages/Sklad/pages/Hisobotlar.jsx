import React, { useState, useEffect, useCallback } from 'react';
import { Eye, RefreshCw, User as UserIcon, X as XIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const TransactionReport = ({ selectedBranchId: propSelectedBranchId }) => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [filters, setFilters] = useState(() => {
    const todayStr = new Date().toLocaleDateString('en-CA');
    return { startDate: todayStr, endDate: todayStr };
  });
  const [productSales, setProductSales] = useState([]);
  const [dailySales, setDailySales] = useState([]);
  const [salesTotals, setSalesTotals] = useState({ totalQuantity: 0, totalAmount: 0 });
  const [warehouseSummaries, setWarehouseSummaries] = useState([]);
  const [overallRepaymentTotal, setOverallRepaymentTotal] = useState(0);
  const [overallRepaymentCash, setOverallRepaymentCash] = useState(0);
  const [overallRepaymentCard, setOverallRepaymentCard] = useState(0);
  const [showWarehouseModal, setShowWarehouseModal] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);
  const [selectedTransactionItems, setSelectedTransactionItems] = useState(null);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedBranchId, setSelectedBranchId] = useState(
    propSelectedBranchId || localStorage.getItem('selectedBranchId') || ''
  );
  // New state for exchange rate
  const [exchangeRate, setExchangeRate] = useState(12650); // Static USD to UZS rate (e.g., 1 USD = 12,650 UZS)
  const navigate = useNavigate();

  const BASE_URL = 'https://suddocs.uz';

  // Optional: Fetch exchange rate dynamically
  useEffect(() => {
    const fetchExchangeRate = async () => {
      try {
        // Example API: Replace with actual currency API endpoint
        const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
        const data = await response.json();
        setExchangeRate(data.rates.UZS || 12650); // Fallback to static rate
      } catch (error) {
        console.error('Error fetching exchange rate:', error);
        toast.error('Курсни олишда хатолик юз берди, стандарт курс ишлатилди');
      }
    };
    // Uncomment to enable dynamic fetching
    // fetchExchangeRate();
  }, []);

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
  }, [selectedBranchId, filters.startDate, filters.endDate, exchangeRate]);

  const transactionTypes = {
    SALE: { label: 'Сотув', color: 'bg-green-100 text-green-800' },
    RETURN: { label: 'Қайтариш', color: 'bg-yellow-100 text-yellow-800' },
    TRANSFER: { label: 'Ўтказма', color: 'bg-blue-100 text-blue-800' },
    WRITE_OFF: { label: 'Ёзиб ташлаш', color: 'bg-red-100 text-red-800' },
    STOCK_ADJUSTMENT: { label: 'Захира тузатиш', color: 'bg-purple-100 text-purple-800' },
    PURCHASE: { label: 'Кирим', color: 'bg-indigo-100 text-indigo-800' },
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
      : 'Н/И';
  };

  // Modified formatAmount to handle USD to UZS conversion
  const formatAmount = (value, isUSD = true) => {
    const num = Math.floor(Number(value) || 0);
    const converted = isUSD ? num * exchangeRate : num; // Convert if in USD
    return converted.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' сўм';
  };

  const getPaymentTypeLabel = (pt) => {
    switch (pt) {
      case 'CASH':
        return 'Нақд';
      case 'CARD':
        return 'Карта';
      case 'CREDIT':
        return 'Кредит';
      case 'INSTALLMENT':
        return 'Бўлиб тўлаш';
      default:
        return pt || 'Н/И';
    }
  };

  const getCustomerName = (customer) => {
    if (!customer) return 'Йўқ';
    return customer.fullName || 'Йўқ';
  };

  const getUserName = (user) => {
    if (!user) return 'Йўқ';
    return `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Йўқ';
  };

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    setProductSales([]);
    setWarehouseSummaries([]);
    setDailySales([]);
    setSalesTotals({ totalQuantity: 0, totalAmount: 0 });
    setOverallRepaymentTotal(0);
    setOverallRepaymentCash(0);
    setOverallRepaymentCard(0);
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        console.error('No access token found in localStorage');
        navigate('/login');
        throw new Error('Авторизация токени топилмади');
      }

      const params = new URLSearchParams();
      if (filters.startDate) {
        const startIso = new Date(`${filters.startDate}T00:00:00`).toISOString();
        params.append('startDate', startIso);
      }
      if (filters.endDate) {
        const endIso = new Date(`${filters.endDate}T23:59:59`).toISOString();
        params.append('endDate', endIso);
      }
      if (selectedBranchId) params.append('branchId', selectedBranchId);
      params.append('limit', 'all');

      const response = await fetch(`${BASE_URL}/transactions?${params.toString()}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || 'Сервер хатоси';
        console.error('Fetch error:', errorMessage);
        if (response.status === 401) {
          localStorage.removeItem('access_token');
          navigate('/login');
          toast.error('Сессия тугади. Илтимос, қайта киринг.');
        } else {
          toast.error(errorMessage);
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('Raw transaction data:', data);

      const transactions = data.transactions || data || [];
      console.log('Extracted transactions:', transactions);

      setTransactions(transactions);

      const productMap = new Map();
      const dailyMap = new Map();
      let totalQuantity = 0;
      let totalAmount = 0;
      const warehouseMap = new Map();

      if (Array.isArray(transactions)) {
        transactions.forEach((transaction, index) => {
          console.log(`Processing transaction ${index}:`, transaction);

          const warehouseUser = transaction.user?.role === 'WAREHOUSE'
            ? transaction.user
            : (transaction.soldBy?.role === 'WAREHOUSE' ? transaction.soldBy : null);
          const isWarehouse = !!warehouseUser;

          if (isWarehouse) {
            const wid = warehouseUser.id;
            if (!warehouseMap.has(wid)) {
              warehouseMap.set(wid, {
                id: wid,
                name: `${warehouseUser.firstName || ''} ${warehouseUser.lastName || ''}`.trim() || warehouseUser.username || `#${wid}`,
                purchaseTotal: 0,
                adjustmentTotal: 0,
                transferTotal: 0,
                transferCount: 0,
                saleTotal: 0,
                cashTotal: 0,
                cardTotal: 0,
                creditTotal: 0,
                installmentTotal: 0,
                upfrontTotal: 0,
                repaymentTotal: 0,
                repayments: [],
                soldQuantity: 0,
                soldAmount: 0,
                otherTotal: 0,
                total: 0,
                transactions: [],
              });
            }
            const wagg = warehouseMap.get(wid);
            const finalW = Number(transaction.finalTotal || transaction.total || 0) * exchangeRate; // Convert USD to UZS
            switch (transaction.type) {
              case 'PURCHASE':
                wagg.purchaseTotal += finalW;
                break;
              case 'STOCK_ADJUSTMENT':
                wagg.adjustmentTotal += finalW;
                break;
              case 'TRANSFER':
                wagg.transferTotal += finalW;
                wagg.transferCount += 1;
                break;
              case 'SALE':
                wagg.saleTotal += finalW;
                switch (transaction.paymentType) {
                  case 'CASH':
                    wagg.cashTotal += finalW;
                    break;
                  case 'CARD':
                    wagg.cardTotal += finalW;
                    break;
                  case 'CREDIT':
                    wagg.creditTotal += finalW;
                    wagg.upfrontTotal += (Number(transaction.amountPaid || 0) + Number(transaction.downPayment || 0)) * exchangeRate;
                    break;
                  case 'INSTALLMENT':
                    wagg.installmentTotal += finalW;
                    wagg.upfrontTotal += (Number(transaction.amountPaid || 0) + Number(transaction.downPayment || 0)) * exchangeRate;
                    break;
                  default:
                    break;
                }
                if (Array.isArray(transaction.items)) {
                  for (const it of transaction.items) {
                    const nameRaw = it.product?.name || it.name || '';
                    const qty = Number(it.quantity) || 0;
                    const amount = (it.total != null ? Number(it.total) : (Number(it.price) || 0) * qty) * exchangeRate; // Convert item total/price
                    if (!nameRaw || qty <= 0 || amount <= 0) continue;
                    wagg.soldQuantity += qty;
                    wagg.soldAmount += amount;

                    const productId = it.productId || it.id;
                    const productName = nameRaw;
                    if (productMap.has(productId)) {
                      productMap.get(productId).quantity += qty;
                      productMap.get(productId).amount += amount;
                    } else {
                      productMap.set(productId, {
                        id: productId,
                        name: productName,
                        quantity: qty,
                        amount: amount,
                      });
                    }
                    totalQuantity += qty;
                    totalAmount += amount;
                  }
                }
                break;
              default:
                wagg.otherTotal += finalW;
                break;
            }
            wagg.total += finalW;
            wagg.transactions.push({
              id: transaction.id,
              createdAt: transaction.createdAt,
              type: transaction.type,
              finalTotal: finalW,
              soldByName: getUserName(transaction.soldBy) || getUserName(transaction.user) || '-',
              fromBranchName: transaction.fromBranch?.name || transaction.fromBranchName || transaction.fromBranchId || transaction.branchFromId,
              toBranchName: transaction.toBranch?.name || transaction.toBranchName || transaction.toBranchId || transaction.branchToId,
              paymentType: transaction.paymentType,
              amountPaid: Number(transaction.amountPaid || 0) * exchangeRate,
              downPayment: Number(transaction.downPayment || 0) * exchangeRate,
              items: transaction.items || [],
              customer: transaction.customer || null,
              deliveryType: transaction.deliveryType,
              deliveryAddress: transaction.deliveryAddress,
              repayments: Array.isArray(transaction.paymentSchedules) 
                ? transaction.paymentSchedules
                    .filter(s => s && s.isPaid && s.paidAt)
                    .map(s => ({
                      scheduleId: s.id,
                      paidAt: s.paidAt,
                      amount: Number(s.paidAmount || 0) * exchangeRate,
                      month: s.month,
                    })) 
                : [],
            });
          }

          if (Array.isArray(transaction.paymentSchedules)) {
            const startBound = filters.startDate ? new Date(`${filters.startDate}T00:00:00`) : null;
            const endBound = filters.endDate ? new Date(`${filters.endDate}T23:59:59`) : null;
            for (const s of transaction.paymentSchedules) {
              if (!s || !s.isPaid || !s.paidAt) continue;
              const pDate = new Date(s.paidAt);
              const inRange = (!startBound || pDate >= startBound) && (!endBound || pDate <= endBound);
              if (!inRange) continue;
              const installment = Number(s.paidAmount || 0) * exchangeRate;
              if (Number.isNaN(installment) || installment <= 0) continue;
              const recipient = (s.paidBy && s.paidBy.role === 'WAREHOUSE') ? s.paidBy : null;
              if (!recipient) continue;
              if (!warehouseMap.has(recipient.id)) {
                warehouseMap.set(recipient.id, {
                  id: recipient.id,
                  name: `${recipient.firstName || ''} ${recipient.lastName || ''}`.trim() || recipient.username || `#${recipient.id}`,
                  purchaseTotal: 0,
                  adjustmentTotal: 0,
                  transferTotal: 0,
                  transferCount: 0,
                  saleTotal: 0,
                  cashTotal: 0,
                  cardTotal: 0,
                  creditTotal: 0,
                  installmentTotal: 0,
                  upfrontTotal: 0,
                  repaymentTotal: 0,
                  repayments: [],
                  soldQuantity: 0,
                  soldAmount: 0,
                  otherTotal: 0,
                  total: 0,
                  transactions: [],
                });
              }
              const recipAgg = warehouseMap.get(recipient.id);
              recipAgg.repaymentTotal += installment;
              recipAgg.repayments.push({
                scheduleId: s.id,
                paidAt: s.paidAt,
                amount: installment,
                channel: s.paidChannel || null,
                transactionId: transaction.id,
                month: s.month,
                customer: transaction.customer || null,
                paymentType: transaction.paymentType,
                paidBy: s.paidBy || null,
                soldBy: transaction.soldBy || null,
              });
            }
          }

          if (transaction.type === 'SALE' && isWarehouse) {
            const date = transaction.createdAt ? new Date(transaction.createdAt).toDateString() : 'Unknown';
            if (dailyMap.has(date)) {
              dailyMap.get(date).amount += (transaction.finalTotal || transaction.total || 0) * exchangeRate;
              dailyMap.get(date).count += 1;
            } else {
              dailyMap.set(date, { date, amount: (transaction.finalTotal || transaction.total || 0) * exchangeRate, count: 1 });
            }
          }
        });
      } else {
        console.log('Transactions is not an array:', typeof transactions, transactions);
      }

      try {
        let repaymentSum = 0;
        let repaymentCash = 0;
        let repaymentCard = 0;
        const startBound = filters.startDate ? new Date(`${filters.startDate}T00:00:00`) : null;
        const endBound = filters.endDate ? new Date(`${filters.endDate}T23:59:59`) : null;

        const token = localStorage.getItem('access_token');
        const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
        const urlBase = new URL(`${BASE_URL}/transactions`);
        const paramsCommon = new URLSearchParams();
        if (selectedBranchId) paramsCommon.append('branchId', selectedBranchId);
        paramsCommon.append('limit', 'all');

        const urls = [
          `${urlBase}?${new URLSearchParams({ ...Object.fromEntries(paramsCommon), paymentType: 'CREDIT' }).toString()}`,
          `${urlBase}?${new URLSearchParams({ ...Object.fromEntries(paramsCommon), paymentType: 'INSTALLMENT' }).toString()}`
        ];

        const [creditRes, installmentRes] = await Promise.all([
          fetch(urls[0], { headers }),
          fetch(urls[1], { headers })
        ]);

        const creditData = creditRes.ok ? await creditRes.json().catch(() => ({})) : {};
        const installmentData = installmentRes.ok ? await installmentRes.json().catch(() => ({})) : {};
        const creditTx = Array.isArray(creditData?.transactions) ? creditData.transactions : (Array.isArray(creditData) ? creditData : []);
        const installmentTx = Array.isArray(installmentData?.transactions) ? installmentData.transactions : (Array.isArray(installmentData) ? installmentData : []);
        const allCreditTx = [...creditTx, ...installmentTx];

        for (const t of allCreditTx) {
          if (t.type !== 'SALE') continue;
          if (selectedBranchId && String(t.fromBranchId || '') !== String(selectedBranchId)) continue;
          const warehouseUser = t.user?.role === 'WAREHOUSE' ? t.user : (t.soldBy?.role === 'WAREHOUSE' ? t.soldBy : null);
          if (!warehouseUser) continue;
          const schedules = Array.isArray(t.paymentSchedules) ? t.paymentSchedules : [];
          for (const s of schedules) {
            if (!s || !s.isPaid || !s.paidAt) continue;
            const pDate = new Date(s.paidAt);
            const inRange = (!startBound || pDate >= startBound) && (!endBound || pDate <= endBound);
            if (!inRange) continue;
            const installment = Number(s.paidAmount || 0) * exchangeRate;
            if (!Number.isNaN(installment) && installment > 0) {
              const recipient = (s.paidBy && s.paidBy.role === 'WAREHOUSE') ? s.paidBy : null;
              if (!recipient) continue;
              repaymentSum += installment;
              const ch = (s.paidChannel || 'CASH').toUpperCase();
              if (ch === 'CARD') repaymentCard += installment; else repaymentCash += installment;
            }
          }
        }

        setOverallRepaymentTotal(repaymentSum);
        setOverallRepaymentCash(repaymentCash);
        setOverallRepaymentCard(repaymentCard);
      } catch (e) {
        console.warn('Failed to compute overall repayment total:', e);
        setOverallRepaymentTotal(0);
        setOverallRepaymentCash(0);
        setOverallRepaymentCard(0);
      }

      console.log('Processed data:', {
        products: Array.from(productMap.values()),
        daily: Array.from(dailyMap.values()),
        totals: { totalQuantity, totalAmount }
      });

      const productArray = Array.from(productMap.values()).filter(p => (p.quantity || 0) > 0 && (p.amount || 0) > 0);
      setProductSales(productArray);
      const warehouseArray = Array.from(warehouseMap.values());
      setWarehouseSummaries(warehouseArray);
      setDailySales(Array.from(dailyMap.values()));
      setSalesTotals({ totalQuantity, totalAmount });
    } catch (error) {
      console.error('Error fetching transactions:', error.message);
      toast.error(error.message || 'Маълумотларни олишда хатолик юз берди');
    } finally {
      setLoading(false);
    }
  }, [filters.startDate, filters.endDate, selectedBranchId, navigate, exchangeRate]);

  const fetchTransactionDetails = async (id) => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        console.error('No access token found in localStorage');
        navigate('/login');
        throw new Error('Авторизация токени топилмади');
      }

      const transactionResponse = await fetch(`${BASE_URL}/transactions/${id}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!transactionResponse.ok) {
        const errorData = await transactionResponse.json().catch(() => ({}));
        const errorMessage = errorData.message || 'Сервер хатоси';
        console.error('Fetch error:', errorMessage);
        if (transactionResponse.status === 401) {
          localStorage.removeItem('access_token');
          navigate('/login');
          toast.error('Сессия тугади. Илтимос, қайта киринг.');
        }
        throw new Error(errorMessage);
      }

      const transactionData = await transactionResponse.json();
      // Convert monetary values in transactionData
      transactionData.finalTotal = Number(transactionData.finalTotal || 0) * exchangeRate;
      transactionData.total = Number(transactionData.total || 0) * exchangeRate;
      if (Array.isArray(transactionData.items)) {
        transactionData.items = transactionData.items.map(item => ({
          ...item,
          price: Number(item.price || 0) * exchangeRate,
          total: Number(item.total || 0) * exchangeRate,
        }));
      }
      setSelectedTransaction(transactionData);
      setShowDetails(true);
    } catch (error) {
      console.error('Error fetching transaction details:', error.message);
      toast.error(error.message || 'Тафсилотларни олишда хатолик юз берди');
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 mb-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">Транзакциялар Ҳисоботи</h1>
              {selectedBranchId && (
                <p className="text-sm text-gray-600 mt-1">
                  Филиал ID: {selectedBranchId}
                </p>
              )}
              <p className="text-sm text-gray-600 mt-1">
                USD to UZS kursi: {exchangeRate.toLocaleString('uz-UZ')} сўм
              </p>
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
              <button
                onClick={() => { fetchTransactions(); }}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors text-sm sm:text-base disabled:opacity-50"
                disabled={loading}
                title="Маълумотларни янгилаш"
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                Янгилаш
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 mb-4">
          <h2 className="text-lg font-semibold mb-3">Ҳисобот — Содда Кўриниш</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="p-3 rounded-lg border bg-white shadow-sm">
              <div className="text-sm text-gray-600">Жами Сотилган Дона</div>
              <div className="text-2xl font-bold text-gray-900">{salesTotals.totalQuantity}</div>
            </div>
            <div className="p-3 rounded-lg border bg-green-50 shadow-sm">
              <div className="text-sm text-green-700">Жами Тушум</div>
              <div className="text-2xl font-bold text-green-900">{formatAmount(salesTotals.totalAmount, false)}</div>
            </div>
            <div className="p-3 rounded-lg border bg-blue-50 shadow-sm">
              <div className="text-sm text-blue-700">Омбор Ходимлари</div>
              <div className="text-2xl font-bold text-blue-900">{warehouseSummaries.length}</div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 rounded-lg border bg-amber-50 shadow-sm">
              <div className="text-sm text-amber-700">Олдиндан Олинган</div>
              <div className="text-2xl font-bold text-amber-900">{formatAmount(
                warehouseSummaries.reduce((s,w)=>s + Number(w.upfrontTotal||0), 0),
                false
              )}</div>
            </div>
          </div>
          <br/>

          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-semibold text-gray-600">
              Омбор Ходимлари ({warehouseSummaries.length})
            </div>
          </div>
          <div className="border-t my-3" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm rounded-lg overflow-hidden">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-center text-gray-600">Омбор Ходими</th>
                  <th className="px-4 py-3 text-center text-gray-600">Нақд</th>
                  <th className="px-4 py-3 text-center text-gray-600">Карта</th>
                  <th className="px-4 py-3 text-center text-gray-600">Кредит</th>
                  <th className="px-4 py-3 text-center text-gray-600">Бўлиб Тўлаш</th>
                  <th className="px-4 py-3 text-center text-gray-600">Олдиндан Олинган</th>
                  <th className="px-4 py-3 text-center text-gray-600">Сотилган Дона</th>
                  <th className="px-4 py-3 text-center text-gray-600">Кассадаги Пул</th>
                  <th className="px-4 py-3 text-center text-gray-600">Кўриш</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {warehouseSummaries.map((w) => (
                  <tr key={w.id} className="hover:bg-green-50/40">
                    <td className="px-4 py-3 text-center">{w.name}</td>
                    <td className="px-4 py-3 text-center">{formatAmount(w.cashTotal, false)}</td>
                    <td className="px-4 py-3 text-center">{formatAmount(w.cardTotal, false)}</td>
                    <td className="px-4 py-3 text-center">{formatAmount(w.creditTotal, false)}</td>
                    <td className="px-4 py-3 text-center">{formatAmount(w.installmentTotal, false)}</td>
                    <td className="px-4 py-3 text-center">{formatAmount(w.upfrontTotal, false)}</td>
                    <td className="px-4 py-3 text-center">{w.soldQuantity}</td>
                    <td className="px-4 py-3 text-center">{formatAmount(
                      (Number(w.cashTotal||0)) + (Number(w.upfrontTotal||0)) +
                      (Array.isArray(w.repayments) ? w.repayments.filter(r => (r.channel||'CASH').toUpperCase()==='CASH').reduce((s,r)=> s + Number(r.amount||0), 0) : 0),
                      false
                    )}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => { setSelectedWarehouse(w); setShowWarehouseModal(true); }}
                        className="text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 font-medium"
                      >
                        <Eye size={14} /> Кўриш
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Маҳсулот</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Сотилган Дона</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Сумма</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr><td colSpan="3" className="px-4 py-4 text-center">Юкланмоқда...</td></tr>
                ) : productSales.length === 0 ? (
                  <tr><td colSpan="3" className="px-4 py-4 text-center text-gray-500">Маълумот Йўқ</td></tr>
                ) : (
                  productSales.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">{p.name || `#${p.id}`}</td>
                      <td className="px-4 py-3">{p.quantity}</td>
                      <td className="px-4 py-3">{formatAmount(p.amount, false)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {showWarehouseModal && selectedWarehouse && (
          <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center">
            <div className="bg-white w-[95vw] h-[95vh] rounded-lg shadow-xl flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <h3 className="text-lg font-semibold">{selectedWarehouse.name} — Омбор Операциялари</h3>
                <button
                  className="text-gray-500 hover:text-gray-700"
                  onClick={() => { setShowWarehouseModal(false); setSelectedWarehouse(null); }}
                >
                  <XIcon size={20} />
                </button>
              </div>
              <div className="p-4 overflow-auto flex-1">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                  <div className="p-3 rounded border"><div className="text-sm text-gray-500">Нақд</div><div className="font-semibold">{formatAmount(selectedWarehouse.cashTotal, false)}</div></div>
                  <div className="p-3 rounded border"><div className="text-sm text-gray-500">Карта</div><div className="font-semibold">{formatAmount(selectedWarehouse.cardTotal, false)}</div></div>
                  <div className="p-3 rounded border"><div className="text-sm text-gray-500">Кредит</div><div className="font-semibold">{formatAmount(selectedWarehouse.creditTotal, false)}</div></div>
                  <div className="p-3 rounded border"><div className="text-sm text-gray-500">Бўлиб Тўлаш</div><div className="font-semibold">{formatAmount(selectedWarehouse.installmentTotal, false)}</div></div>
                  <div className="p-3 rounded border"><div className="text-sm text-gray-500">Олдиндан Олинган</div><div className="font-semibold">{formatAmount(selectedWarehouse.upfrontTotal, false)}</div></div>
                  <div className="p-3 rounded border bg-purple-50">
                    <div className="text-sm">Кредитдан Тўланган</div>
                    <div className="text-xl font-bold">{formatAmount(selectedWarehouse.repaymentTotal || 0, false)}</div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <div className="text-xs">Нақд</div>
                        <div className="font-semibold">{formatAmount((selectedWarehouse.repayments||[]).filter(r=> (r.channel||'CASH').toUpperCase()==='CASH').reduce((s,r)=> s+Number(r.amount||0),0), false)}</div>
                      </div>
                      <div>
                        <div className="text-xs">Карта</div>
                        <div className="font-semibold">{formatAmount((selectedWarehouse.repayments||[]).filter(r=> (r.channel||'CASH').toUpperCase()==='CARD').reduce((s,r)=> s+Number(r.amount||0),0), false)}</div>
                      </div>
                    </div>
                  </div>
                  <div className="p-3 rounded border"><div className="text-sm text-gray-500">Сотилган Дона</div><div className="font-semibold">{selectedWarehouse.soldQuantity}</div></div>
                  <div className="p-3 rounded border"><div className="text-sm text-gray-500">Сотилган Сумма</div><div className="font-semibold">{formatAmount(selectedWarehouse.soldAmount, false)}</div></div>
                </div>

                {Array.isArray(selectedWarehouse.repayments) && selectedWarehouse.repayments.length > 0 && (
                  <div className="mb-4">
                    <div className="text-sm font-semibold text-gray-700 mb-2">Кредитдан Тўловлар (Ойлар Бўйича)</div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left">Ой</th>
                            <th className="px-3 py-2 text-left">Тўланган Куни</th>
                            <th className="px-3 py-2 text-left">Сумма</th>
                            <th className="px-3 py-2 text-left">Транзакция</th>
                            <th className="px-3 py-2 text-left">Мижоз</th>
                            <th className="px-3 py-2 text-left">Қабул Қилган</th>
                            <th className="px-3 py-2 text-left">Сотган</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {selectedWarehouse.repayments.map((r, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-3 py-2">{r.month}</td>
                              <td className="px-3 py-2">{formatDate(r.paidAt)}</td>
                              <td className="px-3 py-2">{formatAmount(r.amount, false)}</td>
                              <td className="px-3 py-2">#{r.transactionId}</td>
                              <td className="px-3 py-2">{r.customer?.fullName || '-'}</td>
                              <td className="px-3 py-2">{r.paidBy ? `${r.paidBy.firstName || ''} ${r.paidBy.lastName || ''}`.trim() : '-'}</td>
                              <td className="px-3 py-2">{r.soldBy ? `${r.soldBy.firstName || ''} ${r.soldBy.lastName || ''}`.trim() : '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left">ID</th>
                        <th className="px-3 py-2 text-left">Сана</th>
                        <th className="px-3 py-2 text-left">Тури</th>
                        <th className="px-3 py-2 text-left">Сотган</th>
                        <th className="px-3 py-2 text-left">Якуний</th>
                        <th className="px-3 py-2 text-left">Кимдан</th>
                        <th className="px-3 py-2 text-left">Кимга</th>
                        <th className="px-3 py-2 text-left">Кўриш</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {(selectedWarehouse.transactions || []).map((t) => (
                        <tr key={t.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2">#{t.id}</td>
                          <td className="px-3 py-2">{formatDate(t.createdAt)}</td>
                          <td className="px-3 py-2">{transactionTypes[t.type]?.label || t.type}</td>
                          <td className="px-3 py-2">{t.soldByName || '-'}</td>
                          <td className="px-3 py-2">{formatAmount(t.finalTotal, false)}</td>
                          <td className="px-3 py-2">{t.fromBranchName || '-'}</td>
                          <td className="px-3 py-2">{t.toBranchName || '-'}</td>
                          <td className="px-3 py-2">
                            <button
                              className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                              onClick={() => { setSelectedTransactionItems(t); }}
                            >
                              <Eye size={14} /> Кўриш
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedTransactionItems && (
          <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center">
            <div className="bg-white w-[90vw] h-[90vh] rounded-lg shadow-xl flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <h3 className="text-lg font-semibold">Транзакция #{selectedTransactionItems.id}</h3>
                <div className="flex items-center gap-2">
                  <button
                    className="text-gray-600 hover:text-gray-800 flex items-center gap-1"
                    onClick={() => {
                      const c = selectedTransactionItems.customer || {};
                      const merged = {
                        ...c,
                        address: c.address || selectedTransactionItems.deliveryAddress || c.address,
                        deliveryAddress: selectedTransactionItems.deliveryAddress || c.deliveryAddress || c.address,
                      };
                      setSelectedCustomer(merged);
                      setShowCustomerModal(true);
                    }}
                  >
                    <UserIcon size={16} /> Мижоз Маълумоти
                  </button>
                  <button
                    className="text-gray-500 hover:text-gray-700"
                    onClick={() => setSelectedTransactionItems(null)}
                  >
                    <XIcon size={20} />
                  </button>
                </div>
              </div>
              <div className="p-4 overflow-auto flex-1">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                  <div className="p-3 rounded border"><div className="text-sm text-gray-500">Тўлов Тури</div><div className="font-semibold">{getPaymentTypeLabel(selectedTransactionItems.paymentType)}</div></div>
                  <div className="p-3 rounded border"><div className="text-sm text-gray-500">Якуний</div><div className="font-semibold">{formatAmount(selectedTransactionItems.finalTotal, false)}</div></div>
                </div>

                {Array.isArray(selectedTransactionItems.repayments) && selectedTransactionItems.repayments.length > 0 && (
                  <div className="mb-4">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left">Ой</th>
                            <th className="px-3 py-2 text-left">Тўланган Куни</th>
                            <th className="px-3 py-2 text-left">Сумма</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {(selectedTransactionItems.repayments || []).filter((r) => {
                            const p = r?.paidAt ? new Date(r.paidAt) : null;
                            const sb = filters.startDate ? new Date(`${filters.startDate}T00:00:00`) : null;
                            const eb = filters.endDate ? new Date(`${filters.endDate}T23:59:59`) : null;
                            if (!p) return false;
                            const inRange = (!sb || p >= sb) && (!eb || p <= eb);
                            return inRange;
                          }).map((r, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-3 py-2">{r.month}</td>
                              <td className="px-3 py-2">{formatDate(r.paidAt)}</td>
                              <td className="px-3 py-2">{formatAmount(r.amount, false)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left">Маҳсулот</th>
                        <th className="px-3 py-2 text-left">Миқдор</th>
                        <th className="px-3 py-2 text-left">Жами</th>
                        <th className="px-3 py-2 text-left">Кредит/Бўлиб</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {(selectedTransactionItems.items || []).map((it, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-3 py-2">{it.product?.name || it.name || '-'}</td>
                          <td className="px-3 py-2">{it.quantity}</td>
                          <td className="px-3 py-2">{formatAmount((Number(it.price)||0) * (Number(it.quantity)||0), false)}</td>
                          <td className="px-3 py-2">
                            {(it.creditMonth || it.creditPercent) ? (
                              <span>
                                {it.creditMonth || '-'} ой, {typeof it.creditPercent === 'number' ? `${(it.creditPercent * 100).toFixed(0)}%` : '-'}
                              </span>
                            ) : (
                              '-'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {showCustomerModal && selectedCustomer && (
          <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center">
            <div className="bg-white w-[600px] max-w-[95vw] rounded-lg shadow-xl">
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <h3 className="text-lg font-semibold">Мижоз Маълумотлари</h3>
                <button
                  className="text-gray-500 hover:text-gray-700"
                  onClick={() => { setShowCustomerModal(false); setSelectedCustomer(null); }}
                >
                  <XIcon size={20} />
                </button>
              </div>
              <div className="p-4 space-y-2 text-sm">
                <p><span className="text-gray-600">Ф.И.Ш:</span> <span className="font-medium">{selectedCustomer.fullName || '-'}</span></p>
                <p><span className="text-gray-600">Телефон:</span> <span className="font-medium">{selectedCustomer.phone || '-'}</span></p>
                <p><span className="text-gray-600">Паспорт:</span> <span className="font-medium">{selectedCustomer.passportSeries || '-'}</span></p>
                <p><span className="text-gray-600">ЖШШИР:</span> <span className="font-medium">{selectedCustomer.jshshir || '-'}</span></p>
                <p><span className="text-gray-600">Манзил:</span> <span className="font-medium">{selectedCustomer.address || selectedCustomer.deliveryAddress || '-'}</span></p>
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