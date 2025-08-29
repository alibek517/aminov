import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const DefectiveManagement = () => {
  const navigate = useNavigate();
  const API_URL = 'https://suddocs.uz';
  const token = localStorage.getItem('access_token');
  const branchId = localStorage.getItem('branchId');
  const selectedBranchIdLS = localStorage.getItem('selectedBranchId');

  const [soldProducts, setSoldProducts] = useState([]);
  const [products, setProducts] = useState([]); // all products in branch for exchange search
  const [logs, setLogs] = useState([]);
  const [allLogs, setAllLogs] = useState([]);
  const [soldSearch, setSoldSearch] = useState('');
  const [timeFilter, setTimeFilter] = useState(''); // Time filter (hour)
  const [notification, setNotification] = useState(null);
  const [loading, setLoading] = useState(false);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalData, setModalData] = useState(null); // { transaction, item }
  const [actionType, setActionType] = useState(''); // RETURN | EXCHANGE (required)
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState('');
  const [cashDirection, setCashDirection] = useState(''); // PLUS | MINUS (required)
  const [cashAmount, setCashAmount] = useState(''); // required > 0
  const [exchangeWithProductId, setExchangeWithProductId] = useState(''); // required when EXCHANGE
  const [exchangeQty, setExchangeQty] = useState('');
  const [exchangeQuery, setExchangeQuery] = useState('');
  const [exchangeMarketingId, setExchangeMarketingId] = useState('');
  const [exchangeMarketingQuery, setExchangeMarketingQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0]; // Format: YYYY-MM-DD
  });

  // Exchange price preview (base ± cash)
  const exchangeBasePrice = useMemo(() => {
    // Base on the current sold item's price
    return Number(modalData?.sellingPrice ?? modalData?.price ?? 0) || 0;
  }, [modalData]);

  const computedExchangePrice = useMemo(() => {
    if (actionType !== 'EXCHANGE') return 0;
    const adj = Number(cashAmount) || 0;
    const delta = cashDirection === 'PLUS' ? adj : (cashDirection === 'MINUS' ? -adj : 0);
    const price = Math.max(0, Number(exchangeBasePrice) + delta);
    return price;
  }, [actionType, cashDirection, cashAmount, exchangeBasePrice]);

  const didInit = useRef(false);
  const currentUserId = Number(localStorage.getItem('userId')) || null;

  useEffect(() => {
    if (!notification) return;
    const t = setTimeout(() => setNotification(null), 1800);
    return () => clearTimeout(t);
  }, [notification]);

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    if (!token) {
      navigate('/login');
      return;
    }
    fetchSoldTransactions();
    fetchBranchProducts();
    fetchDefectiveLogs();
    fetchUsers();
  }, []);

  const authHeaders = () => ({
          Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  });

  const fetchSoldTransactions = async () => {
    try {
      const res = await fetch(`${API_URL}/transactions?type=SALE`, { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json().catch(() => ({}));
      const arr = data?.transactions || data || [];
      // Flatten items with transaction info
        const sold = [];
      for (const tx of Array.isArray(arr) ? arr : []) {
        // Do not skip transactions with status "RETURN" so that partially
        // exchanged/returned transactions still show remaining items
        
        if (!Array.isArray(tx.items)) continue;
        for (const it of tx.items) {
          const pid = it.productId || it.product?.id;
          if (!pid) continue;
                sold.push({
                  transactionId: tx.id,
                  createdAt: tx.createdAt,
                  customer: tx.customer || null,
                  price: it.price,
                  sellingPrice: it.sellingPrice || it.price, // Actual selling price
                  originalPrice: it.originalPrice || it.price, // Original product price
                  quantity: it.quantity,
                  productId: pid,
                  product: it.product || null,
                });
        }
      }
        setSoldProducts(sold);
    } catch (e) {
      // ignore
    }
  };

  const fetchDefectiveLogs = async () => {
    try {
      const res = await fetch(`${API_URL}/defective-logs`, { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json().catch(() => []);
      const list = Array.isArray(data) ? data : (Array.isArray(data.items) ? data.items : []);
      
      // Keep all logs for totals and filtered ones for item availability calc if needed
      setAllLogs(list);
      setLogs(list.filter(l => ['RETURN', 'EXCHANGE'].includes(String(l.actionType).toUpperCase())));
    } catch (e) {
      // ignore
    }
  };

  const updateProductQuantity = async (productId, delta) => {
    try {
      // Read current product
      const getRes = await fetch(`${API_URL}/products/${productId}`, { headers: authHeaders() });
      if (!getRes.ok) return false;
      const prod = await getRes.json().catch(() => null);
      if (!prod || typeof prod !== 'object') return false;
      const currentQty = Number(prod.quantity) || 0;
      const newQty = Math.max(0, currentQty + Number(delta));

      // Persist
      const putBody = {
        name: prod.name,
        barcode: prod.barcode,
        categoryId: prod.categoryId,
        branchId: prod.branchId,
        price: prod.price,
        marketPrice: prod.marketPrice,
        model: prod.model,
        status: prod.status,
        quantity: newQty,
        description: prod.description,
      };
      const putRes = await fetch(`${API_URL}/products/${productId}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(putBody),
      });
      return putRes.ok;
    } catch (e) {
      return false;
    }
  };

  const fetchProductById = async (productId) => {
    try {
      const res = await fetch(`${API_URL}/products/${productId}`, { headers: authHeaders() });
      if (!res.ok) return null;
      return await res.json().catch(() => null);
    } catch (e) {
      return null;
    }
  };

  const createSaleForExchange = async (productId, qty, sellerIdOverride) => {
    try {
      const replacement = await fetchProductById(productId);
      if (!replacement) return false;
      const unitPrice = Number(replacement.marketPrice ?? replacement.price ?? 0) || 0;
      const total = unitPrice * Number(qty);
      const payload = {
        type: 'SALE',
        status: 'COMPLETED',
        total: total,
        finalTotal: total,
        amountPaid: 0,
        userId: Number(localStorage.getItem('userId')) || undefined,
        paymentType: 'CASH',
        fromBranchId: Number(branchId),
        soldByUserId: Number(sellerIdOverride || localStorage.getItem('userId')) || undefined,
        items: [
          {
            productId: Number(productId),
            productName: replacement.name,
            quantity: Number(qty),
            price: unitPrice,
            total: total,
          },
        ],
      };
      const res = await fetch(`${API_URL}/transactions`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      return res.ok;
    } catch (e) {
      return false;
    }
  };

  const fetchBranchProducts = async () => {
    try {
      const url = `${API_URL}/products`;
      const res = await fetch(url, { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json().catch(() => []);
      const list = Array.isArray(data) ? data : (Array.isArray(data.products) ? data.products : []);
      setProducts(list);
    } catch (e) {
      // ignore
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_URL}/users`, { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json().catch(() => []);
      const list = Array.isArray(data) ? data : (Array.isArray(data.users) ? data.users : []);
      const isMarketingUser = (u) => {
        const r = u?.role;
        if (Array.isArray(u?.roles)) {
          return u.roles.some((x) => String(x).toUpperCase().includes('MARKET'));
        }
        return String(r || '').toUpperCase().includes('MARKET');
      };
      setUsers(list.filter(isMarketingUser));
    } catch (e) {
      // ignore
    }
  };

  const individualSales = useMemo(() => {
    const sales = [];
    
    // Filter sold products by selected date
    const selectedDateObj = new Date(selectedDate);
    const startOfDay = new Date(selectedDateObj.getFullYear(), selectedDateObj.getMonth(), selectedDateObj.getDate());
    const endOfDay = new Date(selectedDateObj.getFullYear(), selectedDateObj.getMonth(), selectedDateObj.getDate(), 23, 59, 59);
    
    for (const row of soldProducts) {
      // Check if transaction date matches selected date
      const transactionDate = new Date(row.createdAt);
      if (transactionDate < startOfDay || transactionDate > endOfDay) {
        continue; // Skip transactions not on selected date
      }
      
      // Check if this product has been partially/fully returned or exchanged (reduce availability)
      const productReturns = allLogs.filter(log => {
        const isSameProduct = Number(log.productId) === Number(row.productId);
        const isSameTx = String(log.transactionId) === String(row.transactionId);
        const isSameDay = (() => {
          const d = new Date(log.createdAt);
          return d >= startOfDay && d <= endOfDay;
        })();
        const type = String(log.actionType).toUpperCase();
        const isReturnOrExchange = type === 'RETURN' || type === 'EXCHANGE';
        return isSameProduct && isSameTx && isSameDay && isReturnOrExchange;
      });
      
      const totalReturnedQty = productReturns.reduce((sum, log) => {
        const type = String(log.actionType).toUpperCase();
        if (type === 'RETURN') {
          return sum + (Number(log.quantity) || 0);
        }
        if (type === 'EXCHANGE') {
          // Some backends record exchanged amount in `quantity`, some in `replacementQuantity`
          const exchanged = Number(log.quantity) || Number(log.replacementQuantity) || 0;
          return sum + exchanged;
        }
        return sum;
      }, 0);
      const availableForReturn = Math.max(0, Number(row.quantity) - totalReturnedQty);
      
      // Hide products that are fully returned
      if (availableForReturn <= 0) {
        continue;
      }
      
      // Create individual sale entry
      sales.push({
        productId: row.productId,
        name: row.product?.name || '',
        model: row.product?.model || '',
        barcode: row.product?.barcode || '',
        quantity: Number(row.quantity) || 0,
        availableForReturn: availableForReturn,
        returnedQty: totalReturnedQty,
        price: row.price,
        sellingPrice: row.sellingPrice,
        originalPrice: row.originalPrice,
        transactionId: row.transactionId,
        createdAt: row.createdAt,
        saleTime: new Date(row.createdAt).toLocaleTimeString('uz-UZ', { 
          hour: '2-digit', 
          minute: '2-digit',
          timeZone: 'Asia/Tashkent'
        }),
        saleDate: new Date(row.createdAt).toLocaleDateString('uz-UZ', { 
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          timeZone: 'Asia/Tashkent'
        })
      });
    }
    
    // Add exchanged products (products given in exchange)
    const exchangedProducts = allLogs.filter(log => 
      log.actionType === 'EXCHANGE' && 
      log.exchangeWithProductId &&
      log.replacementQuantity > 0
    );
    
    for (const exchange of exchangedProducts) {
      const exchangeDate = new Date(exchange.createdAt);
      if (exchangeDate >= startOfDay && exchangeDate <= endOfDay) {
        // Find the product details
        const product = products.find(p => Number(p.id) === Number(exchange.exchangeWithProductId));
        if (product) {
          sales.push({
            productId: exchange.exchangeWithProductId,
            name: product.name || '',
            model: product.model || '',
            barcode: product.barcode || '',
            quantity: Number(exchange.replacementQuantity) || 0,
            availableForReturn: Number(product.quantity) || 0, // Current stock
            returnedQty: 0,
            price: product.price || 0,
            sellingPrice: product.price || 0,
            originalPrice: product.price || 0,
            transactionId: `EXCHANGE-${exchange.id}`,
            createdAt: exchange.createdAt,
            isExchanged: true, // Mark as exchanged product
            exchangeTime: new Date(exchange.createdAt).toLocaleTimeString('uz-UZ', { 
              hour: '2-digit', 
              minute: '2-digit',
              timeZone: 'Asia/Tashkent'
            }),
            exchangeDate: new Date(exchange.createdAt).toLocaleDateString('uz-UZ', { 
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              timeZone: 'Asia/Tashkent'
            })
          });
        }
      }
    }
    
    // Sort by creation time (newest first)
    sales.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // Filter by search term
    let filteredSales = sales;
    
    if (soldSearch.trim()) {
      filteredSales = filteredSales.filter(sale =>
        (sale.name || '').toLowerCase().includes(soldSearch.trim().toLowerCase()) ||
        (sale.model || '').toLowerCase().includes(soldSearch.trim().toLowerCase()) ||
        (sale.barcode || '').toLowerCase().includes(soldSearch.trim().toLowerCase())
      );
    }
    
    // Filter by time (optional)
    if (timeFilter.trim()) {
      const targetHour = Number(timeFilter);
      if (!isNaN(targetHour) && targetHour >= 0 && targetHour <= 23) {
        filteredSales = filteredSales.filter(sale => {
          const saleHour = new Date(sale.createdAt).getHours();
          // Show sales within ±30 minutes range (e.g., 3:00 shows 2:30-3:30)
          const lowerBound = (targetHour - 1 + 24) % 24; // Handle midnight case
          const upperBound = (targetHour + 1) % 24;
          
          if (lowerBound <= upperBound) {
            // Normal case: 2 <= hour <= 4
            return saleHour >= lowerBound && saleHour <= upperBound;
          } else {
            // Midnight case: 23 <= hour <= 1
            return saleHour >= lowerBound || saleHour <= upperBound;
          }
        });
      }
    }
    
    return filteredSales;
  }, [soldProducts, soldSearch, timeFilter, selectedDate, allLogs, products]);

  const visibleIndividualSales = useMemo(() => {
    return individualSales.filter(sale => {
      // Skip products with zero quantity
      if ((Number(sale.quantity) || 0) <= 0) return false;
      
      // Skip products that are fully returned
      if (sale.availableForReturn <= 0) return false;
      
      // Skip exchanged products that have been fully returned
      if (sale.isExchanged) {
        const productReturns = allLogs.filter(log => 
          log.productId === sale.productId && 
          String(log.actionType).toUpperCase() === 'RETURN'
        );
        const totalReturnedQty = productReturns.reduce((sum, log) => sum + (Number(log.quantity) || 0), 0);
        if (totalReturnedQty >= Number(sale.quantity)) return false;
      }
      
      return true;
    });
  }, [individualSales, allLogs]);

  // Compute current totals of cash adjustments (+ and -) from fetched logs for current user only 
  const cashAdjustTotals = useMemo(() => {
    let plus = 0;
    let minus = 0;
    
    if (!currentUserId) {
      return { plus, minus };
    }
    
    // Filter by selected date
    const selectedDateObj = new Date(selectedDate);
    const startOfDay = new Date(selectedDateObj.getFullYear(), selectedDateObj.getMonth(), selectedDateObj.getDate());
    const endOfDay = new Date(selectedDateObj.getFullYear(), selectedDateObj.getMonth(), selectedDateObj.getDate(), 23, 59, 59);
    
    for (const log of Array.isArray(allLogs) ? allLogs : []) {
      // Only count logs created by the current user and on selected date
      if (Number(log.userId) === currentUserId) {
        const logDate = new Date(log.createdAt);
        if (logDate >= startOfDay && logDate <= endOfDay) {
          const raw = Number(log?.cashAmount ?? 0) || 0;
          if (raw > 0) plus += raw; else if (raw < 0) minus += Math.abs(raw);
        }
      }
    }
    
    return { plus, minus };
  }, [allLogs, currentUserId, selectedDate]);

  const openModal = (item) => {
    setModalData(item);
    setActionType('');
    setQuantity(1);
    setReason('');
    setCashDirection('');
    setCashAmount('');
    setExchangeWithProductId('');
    setExchangeQty('');
    setExchangeQuery('');
    setExchangeMarketingId('');
    setExchangeMarketingQuery('');
    setShowModal(true);
  };

  const maxQtyForProduct = useMemo(() => {
    if (!modalData) return 0;
    
    if (modalData.isExchanged) {
      // For exchanged products, use current stock quantity minus returned quantity
      const productReturns = allLogs.filter(log => 
        log.productId === modalData.productId && 
        String(log.actionType).toUpperCase() === 'RETURN'
      );
      const totalReturnedQty = productReturns.reduce((sum, log) => sum + (Number(log.quantity) || 0), 0);
      return Math.max(0, Number(modalData.availableForReturn) - totalReturnedQty);
    } else {
      // For sold products, use the available quantity for return (original - already returned)
      return Number(modalData.availableForReturn || modalData.quantity) || 0;
    }
  }, [modalData, allLogs]);

  const replacementMaxQty = useMemo(() => {
    if (!exchangeWithProductId) return 0;
    const pid = Number(exchangeWithProductId);
    const p = products.find((x) => Number(x?.id) === pid);
    return p ? Number(p.quantity) || 0 : 0;
  }, [exchangeWithProductId, products]);

  const submitAction = async () => {
    if (!modalData) return;
    if (!actionType) { setNotification({ message: 'Амалиётни танланг (Қайтариш/Алмаштириш)', type: 'error' }); return; }
    if (actionType === 'RETURN') {
      if (cashDirection !== 'MINUS') setCashDirection('MINUS');
    } else if (actionType !== 'EXCHANGE' && !cashDirection) {
      setNotification({ message: 'Касса йўналишини танланг (+/−)', type: 'error' }); return;
    }
    const amt = Number(cashAmount);
    // Make cash amount optional; if not provided, backend can compute or we treat as 0
    const safeCashAmount = isNaN(amt) ? 0 : Math.max(0, amt);
    const qty = Number(quantity);
    if (!qty || qty <= 0 || qty > maxQtyForProduct) {
      setNotification({ message: `Миқдор 1..${maxQtyForProduct} орасида бўлиши керак`, type: 'error' });
      return;
    }
    // Extra guard: ensure for RETURN we never subtract more than this row's sold quantity
    if (actionType === 'RETURN') {
      const currentRow = soldProducts.find(
        (i) => i.transactionId === modalData.transactionId && i.productId === modalData.productId
      );
      const rowQty = Number(currentRow?.quantity || 0);
      if (!currentRow || rowQty <= 0) {
        setNotification({ message: 'Бу сотув топилмади ёки миқдор 0', type: 'error' });
        return;
      }
      if (qty > rowQty) {
        setNotification({ message: `Сотилган миқдордан кўп қайтариб бўлмайди (сотилган: ${rowQty})`, type: 'error' });
        return;
      }
    }
    if (!reason.trim()) { setNotification({ message: 'Сабаб мажбурий', type: 'error' }); return; }
    if (actionType === 'EXCHANGE' && !exchangeWithProductId) {
      setNotification({ message: 'Алмаштириш учун маҳсулотни танланг', type: 'error' });
      return;
    }
    if (actionType === 'EXCHANGE') {
      if (!cashDirection) { setNotification({ message: 'Касса йўналишини танланг (+/−)', type: 'error' }); return; }
      const eq = Number(exchangeQty);
      if (!eq || eq <= 0) { setNotification({ message: 'Yangi mahsulot miqdorini киритинг', type: 'error' }); return; }
      if (replacementMaxQty > 0 && eq > replacementMaxQty) {
        setNotification({ message: `Yangi mahsulot миқдори максимал: ${replacementMaxQty}`, type: 'error' }); return;
      }
      // Marketing (seller) must be chosen
      const sellerIdNum = Number(exchangeMarketingId);
      if (!sellerIdNum || sellerIdNum <= 0) { setNotification({ message: 'Маркетинг ходимини киритинг (ID)', type: 'error' }); return; }
    }

    setLoading(true);
    try {
      // Prefer unified endpoint; fall back to legacy split endpoints if not found
      // Compute replacement unit price for EXCHANGE from base price +/- cash adjustment
      let computedReplacementUnitPrice = undefined;
      if (actionType === 'EXCHANGE' && exchangeWithProductId) {
        computedReplacementUnitPrice = Number(computedExchangePrice) || 0;
      }
      const unifiedEndpoint = `${API_URL}/defective-logs`;
      const body = {
        productId: modalData.productId,
        actionType,
        quantity: qty,
        description: reason,
        branchId: Number(selectedBranchIdLS || branchId),
        isFromSale: true,
        transactionId: modalData.transactionId, 
        // For EXCHANGE we do not adjust cashbox; only record price used for the sale
        cashAdjustmentDirection: actionType === 'EXCHANGE' ? undefined : cashDirection,
        cashAmount: actionType === 'EXCHANGE' ? 0 : safeCashAmount,
        handledByUserId: Number(localStorage.getItem('userId')) || undefined,
        ...(actionType === 'EXCHANGE' ? { 
          exchangeWithProductId: Number(exchangeWithProductId), 
          replacementQuantity: Number(exchangeQty),
          replacementUnitPrice: computedReplacementUnitPrice,
          replacementSoldByUserId: Number(exchangeMarketingId) || undefined,
        } : {}),
      };
      let res = await fetch(unifiedEndpoint, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) });
      if (res.status === 404) {
        const legacy = actionType === 'RETURN'
          ? `${API_URL}/defective-logs/return`
          : `${API_URL}/defective-logs/exchange`;
        res = await fetch(legacy, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) });
      }
      if (!res.ok) {
        let errMsg = 'Сервер хатоси';
        try {
          const err = await res.json();
          errMsg = err?.message || JSON.stringify(err) || errMsg;
        } catch (_) {
          try {
            errMsg = await res.text();
          } catch (_) {}
        }
        throw new Error(errMsg);
      }
      
      // Note: transaction status PATCH is not supported on backend; skip updating status
       
      // Backend automatically handles inventory updates, so we don't need to do it locally
      // This prevents double-counting issues where products get added twice
      console.log(`${actionType} operation completed - backend handles inventory updates`);

      // UI adjustments through logs so availability recalculates correctly
      const qtyDelta = Number(qty) || 0;
      const nowIso = new Date().toISOString();
      if (actionType === 'RETURN') {
        // Fallback inventory add for returned product (in case backend didn't adjust immediately)
        await updateProductQuantity(modalData.productId, qtyDelta);
        // Add a local log so the item disappears if fully returned
        setAllLogs(prev => [
          ...prev,
          {
            id: `local-${Date.now()}`,
            productId: modalData.productId,
            actionType: 'RETURN',
            quantity: qtyDelta,
            description: reason,
            createdAt: nowIso,
            userId: currentUserId,
            transactionId: modalData.transactionId,
          },
        ]);
        // Decrease the sold item locally by the chosen quantity
        setSoldProducts(prev => prev
          .map(item => {
            if (item.transactionId === modalData.transactionId && item.productId === modalData.productId) {
              const newQty = Math.max(0, Number(item.quantity) - qtyDelta);
              return newQty > 0 ? { ...item, quantity: newQty } : null;
            }
            return item;
          })
          .filter(Boolean)
        );
      } else if (actionType === 'EXCHANGE') {
        // Add a local log marking the original item as exchanged by qtyDelta
        setAllLogs(prev => [
          ...prev,
          {
            id: `local-${Date.now()}-ex`,
            productId: modalData.productId,
            actionType: 'EXCHANGE',
            quantity: qtyDelta,
            exchangeWithProductId: Number(exchangeWithProductId),
            replacementQuantity: Number(exchangeQty),
            replacementUnitPrice: Number(computedExchangePrice) || 0,
            description: reason,
            createdAt: nowIso,
            userId: currentUserId,
            transactionId: modalData.transactionId,
          },
        ]);
        // Decrease the sold item locally by the chosen quantity
        setSoldProducts(prev => prev
          .map(item => {
            if (item.transactionId === modalData.transactionId && item.productId === modalData.productId) {
              const newQty = Math.max(0, Number(item.quantity) - qtyDelta);
              return newQty > 0 ? { ...item, quantity: newQty } : null;
            }
            return item;
          })
          .filter(Boolean)
        );

        // Backend will add replacement; refresh products and sold list
        await fetchSoldTransactions();
        await fetchBranchProducts();
      }
      
      setNotification({ message: 'Амал муваффақиятли бажарилди', type: 'success' });
      setShowModal(false);
      // Avoid sold refetch here so removed item does not reappear
      await Promise.all([fetchDefectiveLogs()]);
    } catch (e) {
      setNotification({ message: e.message || 'Хатолик юз берди', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Қайтариш / Алмаштириш</h1>
          <p className="text-gray-600 mt-1">Сотилган ва алмаштирилган махсулотлар алоҳида кўрсатилади (вақт ва сана билан)</p>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-600">Касса тузатишлар (ўзингиз):</div>
          <div className="text-sm mt-1">
            <span className="text-green-600 font-semibold mr-3">+ {cashAdjustTotals.plus.toLocaleString('uz-UZ')} so'm</span>
            <span className="text-red-600 font-semibold">- {cashAdjustTotals.minus.toLocaleString('uz-UZ')} so'm</span>
          </div>
        </div>
      </div>

      {notification && (
        <div className={`p-3 rounded border text-sm mb-4 ${notification.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
          <div className="flex items-center justify-between">
            <span>{notification.message}</span>
            <button className="underline" onClick={() => setNotification(null)}>Ёпиш</button>
          </div>
        </div>
      )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="mb-3">
          <label className="block text-sm text-gray-700 mb-1">Сана танланг</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => {
              setSelectedDate(e.target.value);
              // Clear time filter when date changes since time filtering is per-day
              setTimeFilter('');
            }}
            className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 border-gray-300 mb-3"
          />
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Сотилган махсулот қидириш</label>
              <input
                value={soldSearch}
                onChange={(e) => setSoldSearch(e.target.value)}
                placeholder="Номи, баркод, модели"
                className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 border-gray-300"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Вақт фильтри (ихтиёрий)</label>
              <input
                type="number"
                min="0"
                max="23"
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value)}
                placeholder="Соат (0-23)"
                className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 border-gray-300"
              />
              <div className="text-xs text-gray-500 mt-1">
                {timeFilter && !isNaN(Number(timeFilter)) && Number(timeFilter) >= 0 && Number(timeFilter) <= 23 ? (
                  <span className="text-blue-600 font-medium">
                    🔍 Кўрсатилади: {(Number(timeFilter) - 1 + 24) % 24}:00 - {(Number(timeFilter) + 1) % 24}:00
                  </span>
                ) : (
                  'Масалан: 3 = 2:00-4:00 соатларидаги сотишлар'
                )}
              </div>
            </div>
          </div>
          
          {/* Clear Filters Button */}
          {(soldSearch || timeFilter) && (
            <div className="mt-3">
              <button
                onClick={() => {
                  setSoldSearch('');
                  setTimeFilter('');
                }}
                className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded border"
              >
                🔍 Фильтрларни тозалаш
              </button>
            </div>
          )}
        </div>

        {/* Results Summary */}
        <div className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="text-sm text-blue-800">
            <span className="font-medium">Натижа:</span> {visibleIndividualSales.length} та махсулот топилди
            {timeFilter && !isNaN(Number(timeFilter)) && (
              <span className="ml-2">
                | Вақт: {Number(timeFilter)}:00 ± 1 соат
              </span>
            )}
          </div>
          <div className="text-xs text-gray-600 mt-2">
            {(() => {
              const soldCount = visibleIndividualSales.filter(sale => !sale.isExchanged).length;
              const exchangedCount = visibleIndividualSales.filter(sale => sale.isExchanged).length;
              
              return (
                <>
                  <span className="text-green-600">💰 Сотилган: {soldCount} та</span>
                  {exchangedCount > 0 && (
                    <span className="text-purple-600 ml-3">🔄 Алмаштирилган: {exchangedCount} та</span>
                  )}
                </>
              );
            })()}
          </div>
        </div>

        <div className="space-y-2 max-h-[480px] overflow-y-auto">
          {visibleIndividualSales.length === 0 ? (
            <div className="text-gray-500 text-center py-8">Мос сотилган махсулот топилмади</div>) : (
            visibleIndividualSales.map((sale, index) => (
              <div
                key={`${sale.transactionId}-${sale.productId}-${index}`}
                className="flex items-center justify-between p-3 border rounded hover:bg-gray-50 cursor-pointer"
                onClick={() => openModal({ 
                  productId: sale.productId, 
                  name: sale.name, 
                  model: sale.model, 
                  barcode: sale.barcode, 
                  price: sale.price, 
                  sellingPrice: sale.sellingPrice,
                  originalPrice: sale.originalPrice,
                  quantity: sale.quantity,
                  transactionId: sale.transactionId,
                  createdAt: sale.createdAt
                })}
              >
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{sale.name}</div>
                  <div className="text-xs text-gray-600 mt-1">
                    {sale.model && <span className="mr-3">Модель: {sale.model}</span>}
                    {sale.barcode && <span>Баркод: {sale.barcode}</span>}
                  </div>
                  <div className="text-xs text-green-600 mt-1">
                    💰 Сотилган: {sale.saleDate} | {sale.saleTime}
                  </div>
                </div>
                <div className="text-right ml-4">
                  <div className="text-sm text-gray-900">
                    Миқдор: {sale.quantity} дона
                    {sale.returnedQty > 0 && (
                      <span className="text-red-600 ml-2">(Қайтарилган: {sale.returnedQty})</span>
                    )}
                  </div>
                  <div className="text-xs text-blue-600 mt-1">
                    Нарх: {Number(sale.sellingPrice || sale.price).toLocaleString('uz-UZ')} so'm
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    ID: #{sale.transactionId}
                  </div>
                  {sale.isExchanged ? (
                    <div className="text-xs text-purple-600 mt-1">
                      🔄 Алмаштирилган: {sale.exchangeDate} | {sale.exchangeTime}
                    </div>
                  ) : (
                    <div className="text-xs text-green-600 mt-1">
                      💰 Сотилган: {sale.saleDate} | {sale.saleTime}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
            </div>

      {showModal && modalData && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-4xl max-h-[85vh] md:max-h-[90vh] flex flex-col">
            <div className="p-5 border-b flex-shrink-0">
              <div className="text-lg font-semibold">Қайтариш / Алмаштириш</div>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
                {/* Left column - Product info */}
                <div className="space-y-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-gray-700 font-medium text-lg mb-3">{modalData.name}</div>
                    {modalData.model && <div className="text-gray-600 mb-2">Модель: {modalData.model}</div>}
                    {modalData.barcode && <div className="text-gray-600 mb-2">Баркод: {modalData.barcode}</div>}
                    <div className="text-gray-600 font-medium mb-2">Макс. миқдор: {maxQtyForProduct}</div>
                    {modalData.returnedQty > 0 && (
                      <div className="text-red-600 text-sm mb-2">
                        ↩️ Қайтарилган: {modalData.returnedQty} дона
                      </div>
                    )}
                    {modalData.isExchanged && (
                      <div className="text-purple-600 text-sm mb-2">
                        🔄 Алмаштирилган: {modalData.exchangeDate} | {modalData.exchangeTime}
                      </div>
                    )}
                  </div>
                  
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="font-medium text-gray-700 mb-2">Нарх: {Number(modalData.sellingPrice || modalData.price).toLocaleString('uz-UZ')} so'm</div>
                    {modalData.sellingPrice && modalData.price && modalData.sellingPrice !== modalData.price && (
                      <div className={`text-sm ${Number(modalData.sellingPrice) > Number(modalData.price) ? 'text-green-600' : 'text-red-600'}`}>
                        {Number(modalData.sellingPrice) > Number(modalData.price) ? '+' : ''}
                        {((Number(modalData.sellingPrice) - Number(modalData.price)) / Number(modalData.price) * 100).toFixed(1)}% 
                        ({Number(modalData.sellingPrice - modalData.price).toLocaleString('uz-UZ')} so'm)
                      </div>
                    )}
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-lg text-sm">
                    <div className="text-gray-600 mb-1">ID: #{modalData.transactionId}</div>
                    <div className="text-gray-600">Сана: {new Date(modalData.createdAt).toLocaleDateString('uz-UZ')}</div>
                  </div>
                </div>
                
                {/* Right column - Form fields */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-700 mb-2 font-medium">Амалиётни танланг</label>
                    <div className="flex items-center gap-6">
                      <label className="inline-flex items-center gap-2 text-sm">
                        <input type="radio" name="act" value="RETURN" checked={actionType === 'RETURN'} onChange={() => setActionType('RETURN')} className="mr-2" /> 
                        <span className="font-medium">Қайтариш</span>
                      </label>
                      <label className="inline-flex items-center gap-2 text-sm">
                        <input type="radio" name="act" value="EXCHANGE" checked={actionType === 'EXCHANGE'} onChange={() => setActionType('EXCHANGE')} className="mr-2" /> 
                        <span className="font-medium">Алмаштириш</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-700 mb-2 font-medium">Миқдор</label>
                    <input
                      type="number"
                      min={1}
                      max={maxQtyForProduct}
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 border-gray-300"
                    />
                    <div className="text-xs text-gray-500 mt-1">Макс: {maxQtyForProduct} дона</div>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-700 mb-2 font-medium">Сабаб</label>
                    <textarea
                      rows={3}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 border-gray-300"
                      placeholder="Изоҳ киритинг"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-700 mb-2 font-medium">Касса</label>
                    <div className="flex items-center gap-6">
                      <label className="inline-flex items-center gap-2 text-sm">
                        <input type="radio" name="cash" value="PLUS" checked={cashDirection === 'PLUS'} onChange={() => setCashDirection('PLUS')} className="mr-2" /> 
                        <span className="font-medium">+ кассага</span>
                      </label>
                      <label className="inline-flex items-center gap-2 text-sm">
                        <input type="radio" name="cash" value="MINUS" checked={cashDirection === 'MINUS'} onChange={() => setCashDirection('MINUS')} className="mr-2" /> 
                        <span className="font-medium">− кассадан</span>
                      </label>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm text-gray-700 mb-2 font-medium">Сумма (so'm)</label>
                    <input
                      type="number"
                      min={0}
                      value={cashAmount}
                      onChange={(e) => setCashAmount(e.target.value)}
                      className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 border-gray-300"
                      placeholder="0"
                    />
                  </div>
                  
                  {actionType === 'EXCHANGE' && (
                    <div className="space-y-3 bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <div className="text-sm font-medium text-blue-800 mb-3">🔄 Алмаштириш маълумотлари</div>
                      
                      <div>
                        <label className="block text-sm text-gray-700 mb-2 font-medium">Алмаштириш учун маҳсулот</label>
                        <input
                          list="exchange-products"
                          value={exchangeQuery}
                          onChange={(e) => {
                            const v = e.target.value;
                            setExchangeQuery(v);
                            let pid = null;
                            // Try parse #ID at the end
                            const hashIdx = v.lastIndexOf('#');
                            if (hashIdx !== -1) {
                              const idStr = v.substring(hashIdx + 1).trim();
                              const num = Number(idStr);
                              if (!isNaN(num) && num > 0) pid = num;
                            }
                            if (pid === null) {
                              const direct = Number(v.trim());
                              if (!isNaN(direct) && direct > 0) pid = direct;
                            }
                            let match = null;
                            if (pid !== null) {
                              match = products.find(p => Number(p.id) === pid);
                            } else {
                              match = products.find(p => {
                                const label = `${p.name || ''} | ${p.model || ''} | ${p.barcode || ''} | #${p.id}`.toLowerCase();
                                return label === v.toLowerCase();
                              });
                            }
                            if (match && match.id) {
                              setExchangeWithProductId(String(match.id));
                            }
                          }}
                          placeholder="Номи | Модели | Баркод | #ID"
                          className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 border-gray-300"
                        />
                        <datalist id="exchange-products">
                          {products.map((p) => (
                            <option key={p.id} value={`${p.name || ''} | ${p.model || ''} | ${p.barcode || ''} | #${p.id}`} />
                          ))}
                        </datalist>
                        <div className="text-xs text-gray-500 mt-1">Танланган: {exchangeWithProductId ? `#${exchangeWithProductId}` : '-'}</div>
                      </div>
                      
                      <div>
                        <label className="block text-sm text-gray-700 mb-2 font-medium">Yangi маҳсулот миқдори</label>
                        <input
                          type="number"
                          min={1}
                          max={Math.max(0, replacementMaxQty)}
                          value={exchangeQty}
                          onChange={(e) => setExchangeQty(e.target.value)}
                          className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 border-gray-300"
                          placeholder="0"
                        />
                        <div className="text-xs text-gray-500 mt-1">Макс: {replacementMaxQty || 0} дона</div>
                      </div>

                      <div>
                        <label className="block text-sm text-gray-700 mb-2 font-medium">Маркетинг ходими</label>
                        <input
                          list="marketing-users"
                          value={exchangeMarketingQuery}
                          onChange={(e) => {
                            const v = e.target.value;
                            setExchangeMarketingQuery(v);
                            const match = users.find(u => {
                              const label = `${u.firstName || ''} ${u.lastName || ''} | ${u.phone || ''}`.trim().toLowerCase();
                              return label === v.trim().toLowerCase();
                            });
                            if (match && match.id) {
                              setExchangeMarketingId(String(match.id));
                            }
                          }}
                          className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 border-gray-300"
                          placeholder="Ism familya | Telefon шу билан қидиринг"
                        />
                        <datalist id="marketing-users">
                          {users.map((u) => (
                            <option key={u.id} value={`${u.firstName || ''} ${u.lastName || ''} | ${u.phone || ''}`} />
                          ))}
                        </datalist>
                        <div className="text-xs text-gray-500 mt-1">Танланган: {(() => {
                          const u = users.find(x => String(x.id) === String(exchangeMarketingId));
                          return u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() || '-' : '-';
                        })()}</div>
                      </div>

                      {/* Exchange price preview */}
                      <div className="text-xs bg-white border rounded p-2">
                        <div className="font-medium text-gray-700 mb-1">Нарх ҳисоб-китоби</div>
                        <div>
                        {/* База: {Number(modalData.sellingPrice || modalData.price).toLocaleString('uz-UZ')} so'm */}

                          База: {Number(exchangeBasePrice).toLocaleString('uz-UZ')} so'm
                          {cashDirection ? (
                            <> {cashDirection === 'PLUS' ? ' + ' : ' − '} {Number(cashAmount || 0).toLocaleString('uz-UZ')} so'm =
                              <span className="ml-1 font-semibold text-blue-700">{Number(computedExchangePrice).toLocaleString('uz-UZ')} so'm</span>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg p-3 text-xs">
                    <div className="font-medium mb-2">💡 Эслатма:</div>
                    <div className="mb-1">🔄 <strong>Қайтариш:</strong> {quantity} дона сотилгандан айрилади, дўконга қўшилади</div>
                    <div>🔄 <strong>Алмаштириш:</strong> {quantity} дона дўконга қўшилади, {exchangeQty || quantity} дона дўкондан айрилади</div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      onClick={() => setShowModal(false)}
                      className="px-6 py-3 text-sm rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium"
                    >
                      Бекор
                    </button>
                    <button
                      onClick={submitAction}
                      disabled={loading}
                      className="px-8 py-3 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 font-medium"
                    >
                      {loading ? 'Жараёнда...' : 'Тасдиқлаш'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DefectiveManagement;
