import React, { useState, useEffect, useCallback } from 'react';
import { Eye, RefreshCw, User as UserIcon, X as XIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const TransactionReport = ({ selectedBranchId: propSelectedBranchId }) => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
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
  const [overallUpfrontTotal, setOverallUpfrontTotal] = useState(0);
  const [salesCashTotal, setSalesCashTotal] = useState(0);
  const [salesCardTotal, setSalesCardTotal] = useState(0);
  const [selectedTransactionItems, setSelectedTransactionItems] = useState(null);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedBranchId, setSelectedBranchId] = useState(
    propSelectedBranchId || localStorage.getItem('selectedBranchId') || ''
  );
  const [exchangeRate, setExchangeRate] = useState(12650);
  const [warehouseViewModes, setWarehouseViewModes] = useState({});
  const [productNameCache, setProductNameCache] = useState({}); // productId -> name
  // New state for chiqim history modal
  const [showChiqimHistory, setShowChiqimHistory] = useState(false);
  const navigate = useNavigate();

  const BASE_URL = 'https://suddocs.uz';

  // Date formatting
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

  // Amount formatting
  const formatAmount = (value, isUSD = true) => {
    const num = Number(value) || 0;
    if (Number.isNaN(num)) return '0 сўм';
    const converted = isUSD ? num * exchangeRate : num;
    return Math.floor(converted).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' сўм';
  };

  // Payment type label
  const getPaymentTypeLabel = (pt) => {
    switch (pt) {
      case 'CASH': return 'Нақд';
      case 'CARD': return 'Карта';
      case 'CREDIT': return 'Кредит';
      case 'INSTALLMENT': return 'Бўлиб тўлаш';
      default: return pt || 'Н/И';
    }
  };

  // Customer name
  const getCustomerName = (customer) => {
    if (!customer) return 'Йўқ';
    return customer.fullName || 'Йўқ';
  };

  // User name
  const getUserName = (user) => {
    if (!user) return 'Йўқ';
    return `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Йўқ';
  };

  // Transaction direction
  const getTransactionDirection = (t) => {
    switch (t.type) {
      case 'SALE': 
        return 'chiqim';
      case 'RETURN': 
        return 'kirim';
      case 'TRANSFER':
        const isFromCurrentBranch = String(t.fromBranchId) === String(selectedBranchId);
        const isToCurrentBranch = String(t.toBranchId) === String(selectedBranchId);
        if (isFromCurrentBranch && isToCurrentBranch) {
          return 'both';
        } else if (isFromCurrentBranch) {
          return 'chiqim';
        } else if (isToCurrentBranch) {
          return 'kirim';
        }
        return 'other';
      case 'WRITE_OFF': 
        return 'chiqim';
      case 'STOCK_ADJUSTMENT':
        if (!Array.isArray(t.items) || t.items.length === 0) return 'other';
        const totalQty = t.items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
        if (totalQty > 0) return 'kirim';
        if (totalQty < 0) return 'chiqim';
        return 'other';
      case 'PURCHASE': 
        return 'kirim';
      default: 
        return 'other';
    }
  };

  // Transaction types
  const transactionTypes = {
    SALE: { label: 'Сотув', color: 'bg-green-100 text-green-800' },
    RETURN: { label: 'Қайтариш', color: 'bg-yellow-100 text-yellow-800' },
    TRANSFER: { label: 'Ўтказма', color: 'bg-blue-100 text-blue-800' },
    WRITE_OFF: { label: 'Ёзиб ташлаш', color: 'bg-red-100 text-red-800' },
    STOCK_ADJUSTMENT: { label: 'Захира тузатиш', color: 'bg-purple-100 text-purple-800' },
    PURCHASE: { label: 'Кирим', color: 'bg-indigo-100 text-indigo-800' },
  };

  // Dynamic product name resolvers (pick first available *name/*title field from backend)
  const getAnyStringField = (obj) => {
    if (!obj || typeof obj !== 'object') return '';
    for (const key of Object.keys(obj)) {
      if (/(name|title)/i.test(key) && typeof obj[key] === 'string' && obj[key].trim()) {
        return obj[key];
      }
    }
    return '';
  };
  const getProductDisplayName = (item) => {
    return (
      (item?.productId && productNameCache[item.productId]) ||
      getAnyStringField(item?.product) ||
      getAnyStringField(item) ||
      (typeof item?.productId !== 'undefined' ? `#${item.productId}` : (typeof item?.id !== 'undefined' ? `#${item.id}` : '-'))
    );
  };

  // Set exchange rate from backend
  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem('access_token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch(`${BASE_URL}/currency-exchange-rates`, { headers });
        const data = await res.json().catch(() => ([]));
        const rate = Array.isArray(data) && data[0]?.rate ? Number(data[0].rate) : null;
        if (rate && Number.isFinite(rate) && rate > 0) setExchangeRate(rate);
      } catch {
        // fallback keeps default
      }
    })();
  }, []);

  // Monitor localStorage changes
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'selectedBranchId') {
        setSelectedBranchId(e.newValue || '');
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Update branch ID
  useEffect(() => {
    if (propSelectedBranchId !== undefined) {
      setSelectedBranchId(propSelectedBranchId);
    }
  }, [propSelectedBranchId]);

  // Fetch transactions
  useEffect(() => {
    if (selectedBranchId !== undefined) {
      fetchTransitions();
    }
  }, [selectedBranchId, filters.startDate, filters.endDate, exchangeRate]);

  const fetchTransitions = useCallback(async () => {
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
      const transactions = data.transactions || data || [];

      // Use backend-provided values as-is (assuming UZS already)
      const normalizedTransactions = transactions.map((t) => ({
        ...t,
        total: Number(t.total || 0),
        finalTotal: Number(t.finalTotal || t.total || 0),
        amountPaid: Number(t.amountPaid || 0),
        downPayment: Number(t.downPayment || 0),
        items: Array.isArray(t.items)
          ? t.items.map((item) => ({
              ...item,
              price: Number(item.price || 0),
              total: Number(item.total || (Number(item.price || 0) * Number(item.quantity || 0))),
            }))
          : [],
      }));

      setTransactions(normalizedTransactions);

      // Prefetch product names by productId when product detail is missing
      try {
        const idsToFetch = new Set();
        for (const tr of normalizedTransactions) {
          if (!Array.isArray(tr.items)) continue;
          for (const it of tr.items) {
            const pid = it?.productId;
            const hasName = !!(it?.product?.name || it?.name || it?.productName);
            if (pid && !hasName && !(pid in productNameCache)) idsToFetch.add(pid);
          }
        }
        if (idsToFetch.size > 0) {
          const token = localStorage.getItem('access_token');
          const headers = token ? { Authorization: `Bearer ${token}` } : {};
          const entries = await Promise.all(
            Array.from(idsToFetch).map(async (pid) => {
              try {
                const res = await fetch(`${BASE_URL}/products/${pid}`, { headers });
                if (!res.ok) return [pid, `#${pid}`];
                const data = await res.json().catch(() => null);
                const name = data?.name || data?.productName || data?.title || `#${pid}`;
                return [pid, name];
              } catch {
                return [pid, `#${pid}`];
              }
            })
          );
          setProductNameCache((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
        }
      } catch (e) {
        // ignore prefetch errors
      }

      const productMap = new Map();
      const dailyMap = new Map();
      let totalQuantity = 0; // deprecated in favor of tmpSalesQty but keep var to avoid large diff
      let totalAmount = 0;   // deprecated in favor of tmpSalesTotal but keep var to avoid large diff
      let tmpSalesCash = 0;
      let tmpSalesCard = 0;
      let tmpUpfrontOverall = 0;
      let tmpSalesTotal = 0; // legacy sales total (SALE only)
      let tmpFinalColumnSum = 0; // sum of Якýний across all fetched transactions (UZS)
      let tmpSalesQty = 0;
      const warehouseMap = new Map();

      if (Array.isArray(normalizedTransactions)) {
        normalizedTransactions.forEach((transaction) => {
          const warehouseUser = transaction.user?.role === 'WAREHOUSE'
            ? transaction.user
            : (transaction.soldBy?.role === 'WAREHOUSE' ? transaction.soldBy : null);
          const isWarehouse = !!warehouseUser;

          // Always accumulate Yakuniy column sum in so'm (no conversion)
          tmpFinalColumnSum += Number(transaction.finalTotal || transaction.total || 0);
          
          if (transaction.type === 'SALE') {
            if (transaction.paymentType === 'CASH') tmpSalesCash += Number(transaction.finalTotal || 0);
            if (transaction.paymentType === 'CARD') tmpSalesCard += Number(transaction.finalTotal || 0);
            if (transaction.paymentType === 'CREDIT' || transaction.paymentType === 'INSTALLMENT') {
              // Count upfront received at sale time (amountPaid + downPayment) in so'm; exclude later repayments
              tmpUpfrontOverall += Number(transaction.amountPaid || 0) + Number(transaction.downPayment || 0);
            }
            tmpSalesTotal += Number(transaction.finalTotal || 0);
            if (Array.isArray(transaction.items)) {
              for (const it of transaction.items) {
                const qty = Number(it.quantity) || 0;
                if (qty > 0) tmpSalesQty += qty;
              }
            }
          }

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
            const finalW = transaction.finalTotal;
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
                    // Count upfront (amountPaid + downPayment) only at sale creation
                    wagg.upfrontTotal += (Number(transaction.amountPaid || 0) + Number(transaction.downPayment || 0));
                    break;
                  case 'INSTALLMENT':
                    wagg.installmentTotal += finalW;
                    // Count upfront (amountPaid + downPayment) only at sale creation
                    wagg.upfrontTotal += (Number(transaction.amountPaid || 0) + Number(transaction.downPayment || 0));
                    break;
                  default:
                    break;
                }
                if (Array.isArray(transaction.items)) {
                  for (const it of transaction.items) {
                    const nameRaw = it.product?.name || it.name || '';
                    const qty = Number(it.quantity) || 0;
                    const amount = it.total;
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
              fromBranchId: transaction.fromBranch?.id || transaction.fromBranchId || transaction.branchFromId,
              toBranchId: transaction.toBranch?.id || transaction.toBranchId || transaction.branchToId,
              fromBranchName: transaction.fromBranch?.name || transaction.fromBranchName || transaction.fromBranchId || transaction.branchFromId,
              toBranchName: transaction.toBranch?.name || transaction.toBranchName || transaction.toBranchId || transaction.branchToId,
              paymentType: transaction.paymentType,
              amountPaid: transaction.amountPaid,
              downPayment: transaction.downPayment,
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
                      amount: Number(s.paidAmount || 0),
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
              const installment = Number(s.paidAmount || 0);
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
              dailyMap.get(date).amount += transaction.finalTotal;
              dailyMap.get(date).count += 1;
            } else {
              dailyMap.set(date, { date, amount: transaction.finalTotal, count: 1 });
            }
          }
        });
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
          const schedules = Array.isArray(t.paymentSchedules) ? t.paymentSchedules : [];
          for (const s of schedules) {
            if (!s || !s.isPaid || !s.paidAt) continue;
            const pDate = new Date(s.paidAt);
            const inRange = (!startBound || pDate >= startBound) && (!endBound || pDate <= endBound);
            if (!inRange) continue;
            const installment = Number(s.paidAmount || 0);
            if (!Number.isNaN(installment) && installment > 0) {
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

      const productArray = Array.from(productMap.values()).filter(p => (p.quantity || 0) > 0 && (p.amount || 0) > 0);
      setProductSales(productArray);
      const warehouseArray = Array.from(warehouseMap.values());
      setWarehouseSummaries(warehouseArray);
      setDailySales(Array.from(dailyMap.values()));
      // Жами Тушум: exclude CARD from overall total
      setSalesTotals({ totalQuantity: tmpSalesQty, totalAmount: Math.max(0, tmpFinalColumnSum - tmpSalesCard) });
      // Expose separate cash/card windows
      setSalesCashTotal(tmpSalesCash);
      setSalesCardTotal(tmpSalesCard);
      setOverallUpfrontTotal(tmpUpfrontOverall);

      const initialViewModes = {};
      warehouseArray.forEach(w => {
        initialViewModes[w.id] = 'all';
      });
      setWarehouseViewModes(initialViewModes);
    } catch (error) {
      console.error('Error fetching transactions:', error.message);
      toast.error(error.message || 'Маълумотларни олишда хатолик юз берди');
    } finally {
      setLoading(false);
    }
  }, [filters.startDate, filters.endDate, selectedBranchId, navigate, exchangeRate]);

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 mb-4">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">Транзакциялар Ҳисоботи</h1>
            {selectedBranchId && (
              <p className="text-sm text-gray-600 mt-1">Филиал ID: {selectedBranchId}</p>
            )}
            <p className="text-sm text-gray-600 mt-1">
              Валюта курси: 1 USD = {exchangeRate.toLocaleString('uz-UZ')} сўм
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
              onClick={fetchTransitions}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors text-sm sm:text-base disabled:opacity-50"
              disabled={loading}
              title="Маълумотларни янгилаш"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              Янгилаш
            </button>
            {/* New button to show chiqim history */}

          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-3 sm:p-4 mb-4">
        <h2 className="text-base font-semibold mb-2">Ҳисобот — Содда Кўриниш</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 mb-3">
          <div className="p-2 rounded-lg border bg-white shadow-sm">
            <div className="text-xs text-gray-600">Жами Сотилган Дона</div>
            <div className="text-xl font-bold text-gray-900">{salesTotals.totalQuantity}</div>
          </div>
          <div className="p-2 rounded-lg border bg-green-50 shadow-sm">
            <div className="text-xs text-green-700">Жами Тушум</div>
            <div className="text-xl font-bold text-green-900">{formatAmount(salesTotals.totalAmount, false)}</div>
          </div>
          <div className="p-2 rounded-lg border bg-white shadow-sm">
            <div className="text-xs text-gray-700">Нақд</div>
            <div className="text-xl font-bold text-gray-900">{formatAmount(salesCashTotal, false)}</div>
          </div>
          <div className="p-2 rounded-lg border bg-white shadow-sm">
            <div className="text-xs text-gray-700">Карта</div>
            <div className="text-xl font-bold text-gray-900">{formatAmount(salesCardTotal, false)}</div>
          </div>
          <div className="p-2 rounded-lg border bg-blue-50 shadow-sm">
            <div className="text-xs text-blue-700">Омбор Ходимлари</div>
            <div className="text-xl font-bold text-blue-900">{warehouseSummaries.length}</div>
          </div>
        </div>
      </div>

      {warehouseSummaries.map((w) => (
        <div key={w.id} className="bg-white rounded-lg shadow-sm p-4 sm:p-6 mb-4">
          <h3 className="text-lg font-semibold mb-3">{w.name} — Транзакциялар</h3>
          <div className="flex gap-2 mb-3">
            <button
              className={`px-3 py-1 rounded ${warehouseViewModes[w.id] === 'all' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800'}`}
              onClick={() => setWarehouseViewModes((prev) => ({ ...prev, [w.id]: 'all' }))}
            >
              Ҳаммаси
            </button>
            <button
              className={`px-3 py-1 rounded ${warehouseViewModes[w.id] === 'kirim' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-800'}`}
              onClick={() => setWarehouseViewModes((prev) => ({ ...prev, [w.id]: 'kirim' }))}
            >
              Кирим
            </button>
            <button
              className={`px-3 py-1 rounded ${warehouseViewModes[w.id] === 'chiqim' ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-800'}`}
              onClick={() => setWarehouseViewModes((prev) => ({ ...prev, [w.id]: 'chiqim' }))}
            >
              Чиқим
            </button>
            <button
              className="px-3 py-1 rounded bg-amber-500 text-white"
              onClick={() => setShowChiqimHistory(true)}
              title="Филиалга ўтказмалар"
            >
              Филиалга ўтказмалар
            </button>
          </div>
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
                  <th className="px-3 py-2 text-left">Маҳсулотлар</th>
                  <th className="px-3 py-2 text-left">Кўриш</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan="9" className="px-3 py-2 text-center">Юкланмоқда...</td>
                  </tr>
                ) : w.transactions.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="px-3 py-2 text-center">Маълумот Йўқ</td>
                  </tr>
                ) : (
                  w.transactions
                    .filter(t => {
                      const direction = getTransactionDirection(t);
                      const viewMode = warehouseViewModes[w.id];
                      
                      if (viewMode === 'all') return true;
                      
                      if (viewMode === 'kirim') {
                        if (t.type === 'TRANSFER') {
                          return String(t.toBranchId) === String(selectedBranchId);
                        }
                        return direction === 'kirim';
                      }
                      
                      if (viewMode === 'chiqim') {
                        if (t.type === 'TRANSFER') {
                          return String(t.fromBranchId) === String(selectedBranchId);
                        }
                        if (t.type === 'SALE' && t.paymentType === 'CASH') {
                          return true;
                        }
                        return direction === 'chiqim' && t.paymentType !== 'CASH';
                      }
                      
                      return direction === viewMode;
                    })
                    .map((t) => (
                      <tr key={t.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2">#{t.id}</td>
                        <td className="px-3 py-2">{formatDate(t.createdAt)}</td>
                        <td className="px-3 py-2">{transactionTypes[t.type]?.label || t.type}</td>
                        <td className="px-3 py-2">{t.soldByName || '-'}</td>
                        <td className="px-3 py-2">{formatAmount(t.finalTotal, false)}</td>
                        <td className="px-3 py-2">{t.fromBranchName || '-'}</td>
                        <td className="px-3 py-2">{t.toBranchName || '-'}</td>
                        <td className="px-3 py-2 max-w-[280px]">
                          {Array.isArray(t.items) && t.items.length > 0 ? (
                            <div className="space-y-1 text-xs text-gray-800">
                              {t.items.map((it, idx) => {
                                const name = getProductDisplayName(it) || `#${it?.productId || it?.id || idx}`;
                                const qty = Number(it?.quantity) || 0;
                                const price = Number(it?.price) || 0;
                                const total = Number(it?.total || (qty * price)) || 0;
                                return (
                                  <div key={idx} className="flex items-center justify-between gap-2">
                                    <span className="truncate">{name} x{qty}</span>
                                    <span className="whitespace-nowrap">{formatAmount(total, false)}</span>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-500">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                        <button
  className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
  onClick={async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;
      const res = await fetch(`${BASE_URL}/transactions/${t.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const full = await res.json();
      setSelectedTransactionItems(full);
    } catch (e) {
      // fallback to existing t if fetch fails
      setSelectedTransactionItems(t);
    }
  }}
>
  <Eye size={14} /> Кўриш
</button>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 mb-4">
        <h3 className="text-md font-semibold mb-2">Сотилган Маҳсулотлар</h3>
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

      {/* Chiqim History Modal */}
      {showChiqimHistory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-6xl max-h-[80vh] overflow-y-auto shadow-xl">
            <div className="flex justify-between mb-4">
              <h3 className="text-lg font-bold">Чиқим Тарихи</h3>
              <button
                onClick={() => setShowChiqimHistory(false)}
                className="text-gray-600 hover:text-gray-800 transition-all"
              >
                <XIcon size={20} />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border">
                <thead>
                  <tr className="bg-gray-100 text-left">
                    <th className="p-3">ID</th>
                    <th className="p-3">Тип</th>
                    <th className="p-3">Сана</th>
                    <th className="p-3">Жами</th>
                    <th className="p-3">Тўлов тури</th>
                    <th className="p-3">Филиал</th>
                    <th className="p-3">Мижоз</th>
                    <th className="p-3">Маҳсулотлар</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.filter(t => getTransactionDirection(t) === 'chiqim').length > 0 ? (
                    transactions
                      .filter(t => getTransactionDirection(t) === 'chiqim')
                      .map((transfer) => (
                        <tr key={transfer.id} className="border-t">
                          <td className="p-3">#{transfer.id}</td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-1 rounded text-xs ${
                                transfer.type === 'SALE'
                                  ? 'bg-green-100 text-green-800'
                                  : transfer.type === 'TRANSFER'
                                  ? 'bg-blue-100 text-blue-800'
                                  : transfer.type === 'WRITE_OFF'
                                  ? 'bg-red-100 text-red-800'
                                  : transfer.type === 'STOCK_ADJUSTMENT'
                                  ? 'bg-purple-100 text-purple-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {transactionTypes[transfer.type]?.label || transfer.type}
                            </span>
                          </td>
                          <td className="p-3">{formatDate(transfer.createdAt)}</td>
                          <td className="p-3">{formatAmount((transfer.finalTotal || transfer.total), false)}</td>
                          <td className="p-3">{getPaymentTypeLabel(transfer.paymentType) || 'Ўтказма'}</td>
                          <td className="p-3">{transfer.fromBranch?.name || transfer.fromBranchName || transfer.fromBranchId || "Noma'lum"}</td>
                          <td className="p-3">
                            {getCustomerName(transfer.customer) ||
                              (transfer.customer?.firstName && transfer.customer?.lastName
                                ? `${transfer.customer.firstName} ${transfer.customer.lastName}`
                                : 'Ўтказма')}
                          </td>
                          <td className="p-3">
                            {(transfer.items || []).map((item, idx) => (
                              <div key={idx} className="text-sm">
                                {getProductDisplayName(item)} x{item.quantity}
                              </div>
                            ))}
                          </td>
                        </tr>
                      ))
                  ) : (
                    <tr>
                      <td colSpan="8" className="p-3 text-center">
                        Чиқим транзакциялари топилмади
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
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
              <div className="mb-3 text-sm text-gray-700">
                <span className="font-semibold">Маҳсулотлар:</span>
                <span className="ml-2">
                  {(selectedTransactionItems.items || [])
                    .map((it) => getProductDisplayName(it))
                    .filter(Boolean)
                    .join(', ') || '-'}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                <div className="p-3 rounded border">
                  <div className="text-sm text-gray-500">Тўлов Тури</div>
                  <div className="font-semibold">{getPaymentTypeLabel(selectedTransactionItems.paymentType)}</div>
                </div>
                <div className="p-3 rounded border">
                  <div className="text-sm text-gray-500">Якуний</div>
                  <div className="font-semibold">{formatAmount(selectedTransactionItems.finalTotal, false)}</div>
                </div>
                <div className="p-3 rounded border">
                  <div className="text-sm text-gray-500">Тўланган</div>
                  <div className="font-semibold">{formatAmount((selectedTransactionItems.amountPaid || 0) + (selectedTransactionItems.downPayment || 0), false)}</div>
                </div>
                <div className="p-3 rounded border">
                  <div className="text-sm text-gray-500">Қолган</div>
                  <div className="font-semibold">{formatAmount((selectedTransactionItems.finalTotal || 0) - ((selectedTransactionItems.amountPaid || 0) + (selectedTransactionItems.downPayment || 0)), false)}</div>
                </div>
              </div>

              {Array.isArray(selectedTransactionItems.repayments) && selectedTransactionItems.repayments.length > 0 && (
                <div className="mb-4">
                  <div className="text-sm font-semibold text-gray-700 mb-2">Кредитдан Тўловлар</div>
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
                      {!(selectedTransactionItems?.paymentType === 'CREDIT' || selectedTransactionItems?.paymentType === 'INSTALLMENT') && (
                        <th className="px-3 py-2 text-left">Нарх</th>
                      )}
                      <th className="px-3 py-2 text-left">Жами</th>
                      <th className="px-3 py-2 text-left">Кредит/Бўлиб</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {(selectedTransactionItems.items || []).map((it, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-2">{getProductDisplayName(it)}</td>
                        <td className="px-3 py-2">{it.quantity}</td>
                        {!(selectedTransactionItems?.paymentType === 'CREDIT' || selectedTransactionItems?.paymentType === 'INSTALLMENT') && (
                          <td className="px-3 py-2">{formatAmount(it.price, false)}</td>
                        )}
                        <td className="px-3 py-2">{formatAmount(it.total, false)}</td>
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

      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
};

export default TransactionReport;