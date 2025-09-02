import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatAmount, formatCurrency } from '../../../utils/currencyFormat';

const DefectiveManagement = () => {
  const navigate = useNavigate();
  const API_URL = 'https://suddocs.uz';
  const token = localStorage.getItem('access_token');
  const branchId = localStorage.getItem('branchId');
  const selectedBranchIdLS = localStorage.getItem('selectedBranchId');

  const [soldProducts, setSoldProducts] = useState([]);
  const [logs, setLogs] = useState([]);
  const [allLogs, setAllLogs] = useState([]);
  const [soldSearch, setSoldSearch] = useState('');
  const [timeFilter, setTimeFilter] = useState(''); // Time filter (hour)
  const [notification, setNotification] = useState(null);
  const [loading, setLoading] = useState(false);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalData, setModalData] = useState(null); // { transaction, item }
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState('');
  const [cashAmount, setCashAmount] = useState(''); // required > 0
  const [exchangeRate, setExchangeRate] = useState(0);
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0]; // Format: YYYY-MM-DD
  });

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
    fetchDefectiveLogs();
    fetchExchangeRate();
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
        // returned transactions still show remaining items

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
      setLogs(list.filter(l => ['RETURN'].includes(String(l.actionType).toUpperCase())));
    } catch (e) {
      // ignore
    }
  };

  const fetchExchangeRate = async () => {
    try {
      // Try current-rate endpoint first
      const rateResp = await fetch(`${API_URL}/currency-exchange-rates/current-rate?fromCurrency=USD&toCurrency=UZS`, { headers: authHeaders() });
      if (rateResp.ok) {
        const rateJson = await rateResp.json();
        const rate = Number(rateJson?.rate) || 0;
        if (rate > 0) {
          setExchangeRate(rate);
          return;
        }
      }
      
      // Fallback to list endpoint
      const listResp = await fetch(`${API_URL}/currency-exchange-rates`, { headers: authHeaders() });
      if (listResp.ok) {
        const arr = await listResp.json();
        const active = (Array.isArray(arr) ? arr : []).find(r => r.isActive && r.fromCurrency === 'USD' && r.toCurrency === 'UZS');
        const rate = Number(active?.rate ?? arr?.[0]?.rate) || 0;
        if (rate > 0) setExchangeRate(rate);
      }
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

      // Check if this product has been partially/fully returned (reduce availability)
      const productReturns = allLogs.filter(log => {
        const isSameProduct = Number(log.productId) === Number(row.productId);
        const isSameTx = String(log.transactionId) === String(row.transactionId);
        const isSameDay = (() => {
          const d = new Date(log.createdAt);
          return d >= startOfDay && d <= endOfDay;
        })();
        const type = String(log.actionType).toUpperCase();
        const isReturn = type === 'RETURN';
        return isSameProduct && isSameTx && isSameDay && isReturn;
      });

      const totalReturnedQty = productReturns.reduce((sum, log) => {
        const type = String(log.actionType).toUpperCase();
        if (type === 'RETURN') {
          return sum + (Number(log.quantity) || 0);
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
          const saleDate = new Date(sale.createdAt);
          const saleHour = saleDate.getHours();
          const saleMinutes = saleDate.getMinutes();
          
          // Show sales within ±30 minutes range (e.g., 3:00 shows 2:30-3:30)
          const targetTimeInMinutes = targetHour * 60; // Convert target hour to minutes
          const saleTimeInMinutes = saleHour * 60 + saleMinutes; // Convert sale time to minutes
          
          // Calculate the time difference in minutes
          let timeDiff = Math.abs(saleTimeInMinutes - targetTimeInMinutes);
          
          // Handle midnight case (e.g., 23:30 vs 00:30)
          if (timeDiff > 12 * 60) { // If difference is more than 12 hours
            timeDiff = 24 * 60 - timeDiff; // Adjust for midnight crossing
          }
          
          // Return true if within ±30 minutes (30 minutes = 0.5 hours)
          return timeDiff <= 30;
        });
      }
    }

    return filteredSales;
  }, [soldProducts, soldSearch, timeFilter, selectedDate, allLogs]);

  const visibleIndividualSales = useMemo(() => {
    return individualSales.filter(sale => {
      // Skip products with zero quantity
      if ((Number(sale.quantity) || 0) <= 0) return false;

      // Skip products that are fully returned
      if (sale.availableForReturn <= 0) return false;

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
    setQuantity(1);
    setReason('');
    setCashAmount('');
    setShowModal(true);
  };

  const maxQtyForProduct = useMemo(() => {
    if (!modalData) return 0;
    // For sold products, use the available quantity for return (original - already returned)
    return Number(modalData.availableForReturn || modalData.quantity) || 0;
  }, [modalData, allLogs]);

  const submitAction = async () => {
    if (!modalData) {
      setNotification({ message: 'Маҳсулот маълумотлари топилмади', type: 'error' });
      return;
    }
    
    const amt = Number(cashAmount);
    const safeCashAmount = isNaN(amt) ? 0 : Math.max(0, amt);
    
    const qty = Number(quantity);
    if (!qty || qty <= 0 || qty > maxQtyForProduct) {
      setNotification({ message: `Миқдор 1..${maxQtyForProduct} орасида бўлиши керак`, type: 'error' });
      return;
    }
    
    if (!reason.trim()) {
      setNotification({ message: 'Сабаб мажбурий', type: 'error' });
      return;
    }
  
    setLoading(true);
    try {
      const unifiedEndpoint = `${API_URL}/defective-logs`;
      const body = {
        productId: modalData.productId,
        actionType: 'RETURN',
        quantity: qty,
        description: reason,
        branchId: Number(selectedBranchIdLS || branchId),
        isFromSale: true,
        transactionId: modalData.transactionId,
        cashAdjustmentDirection: 'MINUS', // Force MINUS for RETURN
        cashAmount: safeCashAmount,
        handledByUserId: Number(localStorage.getItem('userId')) || undefined,
      };
      
      console.log('Submitting return payload:', JSON.stringify(body, null, 2));
      let res = await fetch(unifiedEndpoint, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      
      if (res.status === 404) {
        const legacy = `${API_URL}/defective-logs/return`;
        console.log(`Falling back to legacy endpoint: ${legacy}`);
        res = await fetch(legacy, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify(body),
        });
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
        throw new Error(`API Error: ${errMsg} (Status: ${res.status})`);
      }
  
      console.log('Return operation completed successfully');

      const qtyDelta = Number(qty) || 0;
      const nowIso = new Date().toISOString();
      
      // Add the log entry
      const logEntry = {
        id: `local-${Date.now()}`,
        productId: modalData.productId,
        actionType: 'RETURN',
        quantity: qtyDelta,
        description: reason,
        createdAt: nowIso,
        userId: currentUserId,
        transactionId: modalData.transactionId,
        cashAmount: -safeCashAmount, // Always negative for returns
      };
      
      setAllLogs(prev => [...prev, logEntry]);
      
      // Update sold products - remove or reduce the quantity
      setSoldProducts(prev =>
        prev
          .map(item => {
            if (item.transactionId === modalData.transactionId && item.productId === modalData.productId) {
              const newQty = Math.max(0, Number(item.quantity) - qtyDelta);
              // If all quantity is returned, remove the item completely
              return newQty > 0 ? { ...item, quantity: newQty } : null;
            }
            return item;
          })
          .filter(Boolean)
      );
      
      // Refresh data to ensure consistency
      await Promise.all([fetchSoldTransactions(), fetchDefectiveLogs()]);
      
      // Force a complete refresh of the sold products to reflect backend changes
      setTimeout(() => {
        fetchSoldTransactions();
      }, 1000);
  
      const summaryMessage = `${qtyDelta} дона маҳсулот қайтарилди. Кассадан ${formatCurrency(safeCashAmount)} олинди.`;
      
      setNotification({ message: summaryMessage, type: 'success' });
      setShowModal(false);
      await fetchDefectiveLogs();
    } catch (e) {
      console.error('API Error:', e.message, e);
      setNotification({ message: `Хатолик: ${e.message || 'Сервер хатоси'}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Қайтариш</h1>
          <p className="text-gray-600 mt-1">Сотилган махсулотларни қайтариш (вақт ва сана билан)</p>
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
                step="0"
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value)}
                placeholder="Соат (0-23)"
                className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 border-gray-300"
              />
              <div className="text-xs text-gray-500 mt-1">
                {timeFilter && !isNaN(Number(timeFilter)) && Number(timeFilter) >= 0 && Number(timeFilter) <= 23 ? (
                  <span className="text-blue-600 font-medium">
                    🔍 Кўрсатилади: {Number(timeFilter)}:00 ± 30 дақиқа
                  </span>
                ) : (
                  'Масалан: 3 = 2:30-3:30 соатларидаги сотишлар'
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
                | Вақт: {Number(timeFilter)}:00 ± 30 дақиқа
              </span>
            )}
          </div>
          <div className="text-xs text-gray-600 mt-2">
            <span className="text-green-600">💰 Сотилган: {visibleIndividualSales.length} та</span>
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
                    Нарх: {formatCurrency(sale.sellingPrice || sale.price)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    ID: #{sale.transactionId}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {showModal && modalData && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[85vh] md:max-h-[90vh] flex flex-col">
            <div className="p-5 border-b flex-shrink-0">
              <div className="text-lg font-semibold">Қайтариш</div>
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
                  </div>

                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="font-medium text-gray-700 mb-2">Нарх: {formatCurrency(modalData.sellingPrice || modalData.price)}</div>
                    {modalData.sellingPrice && modalData.price && modalData.sellingPrice !== modalData.price && (
                      <div className={`text-sm ${Number(modalData.sellingPrice) > Number(modalData.price) ? 'text-green-600' : 'text-red-600'}`}>
                        {Number(modalData.sellingPrice) > Number(modalData.price) ? '+' : ''}
                        {((Number(modalData.sellingPrice) - Number(modalData.price)) / Number(modalData.price) * 100).toFixed(1)}%
                        ({formatCurrency(modalData.sellingPrice - modalData.price)})
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
                    <label className="block text-sm text-gray-700 mb-2 font-medium">Миқдор</label>
                    <input
                      type="number"
                      min={1}
                      max={maxQtyForProduct}
                      step="0"
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
                    <label className="block text-sm text-gray-700 mb-2 font-medium">Кассадан олинадиган пул (so'm)</label>
                    <input
                      type="number"
                      min={0}
                      step="0"
                      value={cashAmount}
                      onChange={(e) => setCashAmount(e.target.value)}
                      className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 border-gray-300"
                      placeholder="0"
                    />
                    <div className="text-xs text-gray-500 mt-1">
                      💡 Қайтарилган маҳсулот нархи кассага қўшилади
                    </div>
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
