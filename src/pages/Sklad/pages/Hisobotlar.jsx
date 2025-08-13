import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { AlertCircle, Loader2, Calendar, TrendingUp } from 'lucide-react';

const Notification = ({ message, type, onClose }) => (
  <div className={`p-4 rounded-lg flex items-center gap-3 mb-4 ${
    type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' :
    type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' :
    'bg-blue-50 text-blue-700 border border-blue-200'
  }`}>
    <AlertCircle size={20} />
    <span className="flex-1">{message}</span>
    <button className="text-sm underline hover:no-underline transition-all" onClick={onClose}>Yopish</button>
  </div>
);

const Hisobotlar = () => {
  const [reportData, setReportData] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [debugMode, setDebugMode] = useState(false);
  const [rawApiResponse, setRawApiResponse] = useState(null);
  const API_URL = 'https://suddocs.uz';

  const formatCurrency = (amount) =>
    (amount !== null && amount !== undefined && !Number.isNaN(Number(amount)))
      ? new Intl.NumberFormat('uz-UZ').format(Number(amount)) + " so'm"
      : "Noma'lum";

  const formatQuantity = (qty) => {
    if (qty === null || qty === undefined || qty === '') return "Noma'lum";
    const n = Number(qty);
    return !Number.isNaN(n) ? new Intl.NumberFormat('uz-UZ').format(n) + ' dona' : String(qty);
  };

  const formatDate = (date) => {
    if (!date) return "Noma'lum";
    try {
      return new Date(date).toLocaleDateString('uz-UZ');
    } catch {
      return "Noma'lum";
    }
  };

  const extractFieldValue = (obj, possibleKeys = []) => {
    for (const key of possibleKeys) {
      if (!key) continue;
      const parts = key.split('.');
      let cur = obj;
      let found = true;
      for (const part of parts) {
        if (cur === null || cur === undefined) { found = false; break; }
        if (/^\d+$/.test(part)) {
          const idx = parseInt(part, 10);
          if (!Array.isArray(cur) || idx >= cur.length) { found = false; break; }
          cur = cur[idx];
        } else {
          if (cur[part] === undefined) { found = false; break; }
          cur = cur[part];
        }
      }
      if (found && cur !== undefined && cur !== null) return cur;
    }
    return null;
  };

  const axiosWithAuth = async (config) => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      setNotification({ message: 'Sessiya topilmadi, iltimos tizimga kiring', type: 'error' });
      setTimeout(() => window.location.href = '/login', 2000);
      throw new Error('No token found');
    }
    const headers = {
      ...config.headers,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    try {
      return await axios({ ...config, headers });
    } catch (error) {
      if (error.response?.status === 401) {
        setNotification({ message: 'Sessiya tugadi, iltimos qayta kiring', type: 'error' });
        localStorage.clear();
        setTimeout(() => window.location.href = '/login', 2000);
        throw new Error('Session expired');
      }
      throw error;
    }
  };

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const res = await axiosWithAuth({ method: 'get', url: `${API_URL}/branches` });
        const branchesData = Array.isArray(res.data) ? res.data : res.data.branches || [];
        setBranches(branchesData);
        const omborBranch = branchesData.find((b) => b.name.toLowerCase() === 'ombor');
        if (omborBranch) setSelectedBranchId(omborBranch.id.toString());
        else setNotification({ message: '"Ombor" filiali topilmadi', type: 'error' });
      } catch (err) {
        setNotification({ message: err.message || 'Filiallar yuklashda xatolik', type: 'error' });
      }
    };
    fetchBranches();
  }, []);

  const getDateRange = () => {
    const today = new Date();
    const endDate = new Date(today);
    let startDate;
    switch (selectedPeriod) {
      case 'week': startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000); break;
      case 'month': startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000); break;
      case 'quarter': startDate = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000); break;
      case 'year': startDate = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000); break;
      default: startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    };
  };

  const findProductArrayKey = (tx) => {
    const keys = ['products', 'items', 'order_items', 'line_items', 'cart', 'lines'];
    return keys.find(k => Array.isArray(tx[k]));
  };

  const toNumberOrNull = (v) => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const fetchProductName = async (productId) => {
    try {
      const res = await axiosWithAuth({
        method: 'get',
        url: `${API_URL}/products/${productId}`,
        timeout: 5000
      });
      return res.data.name ?? res.data.productName ?? res.data.title ?? `Product ${productId}`;
    } catch (err) {
      console.warn(`Failed to fetch product name for ID ${productId}:`, err);
      return `Product ${productId}`;
    }
  };

  const generateReceipt = () => {
    if (reportData.length === 0) {
      setNotification({ message: 'Chek yaratish uchun tranzaksiyalar mavjud emas', type: 'error' });
      return;
    }

    const periodLabels = {
      'week': 'Oxirgi 7 kun',
      'month': 'Oxirgi 30 kun',
      'quarter': 'Oxirgi 90 kun',
      'year': 'Oxirgi 1 yil'
    };
    const periodLabel = periodLabels[selectedPeriod] || 'Belgilanmagan muddat';
    const branchName = branches.find(b => b.id.toString() === selectedBranchId)?.name || 'Noma\'lum';
    const date = new Date().toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' });
    let totalQuantity = 0;
    let totalAmount = 0;

    const receiptLines = reportData.map((row, index) => {
      const quantity = toNumberOrNull(row.quantity);
      const price = toNumberOrNull(row.price);
      const total = toNumberOrNull(row.total) ?? (quantity !== null && price !== null ? quantity * price : 0);
      
      totalQuantity += quantity || 0;
      totalAmount += total || 0;

      return `
Nomer: ${index + 1}
Tovar: ${row.productName || 'Noma\'lum'}
Soni: ${formatQuantity(row.quantity)}
Narxi: ${formatCurrency(row.price)}
Jami: ${formatCurrency(total)}
Filial: ${row.branchName || 'Noma\'lum'}
Sana: ${formatDate(row.transactionDate)}
-----------------------`;
    }).join('\n');

    const receiptContent = `
Hisobot Cheki
Filial: ${branchName}
Muddat: ${periodLabel}
Sana: ${date}
====================
${receiptLines}
====================
Umumiy soni: ${formatQuantity(totalQuantity)}
Umumiy summa: ${formatCurrency(totalAmount)}
====================
    `;

    const blob = new Blob([receiptContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `report_receipt_${selectedPeriod}_${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setNotification({ message: 'Chek muvaffaqiyatli yuklandi', type: 'success' });
  };

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    setNotification(null);

    if (!selectedBranchId) {
      setNotification({ message: 'Iltimos, filialni tanlang', type: 'error' });
      setLoading(false);
      return;
    }

    try {
      const { startDate, endDate } = getDateRange();
      const queryParams = `?startDate=${startDate}&endDate=${endDate}&branchId=${selectedBranchId}`;

      const res = await axiosWithAuth({
        method: 'get',
        url: `${API_URL}/transactions${queryParams}`,
        timeout: 10000
      });

      setRawApiResponse(res.data);

      let transactions = [];
      if (Array.isArray(res.data)) transactions = res.data;
      else if (res.data.data && Array.isArray(res.data.data)) transactions = res.data.data;
      else if (res.data.transactions && Array.isArray(res.data.transactions)) transactions = res.data.transactions;
      else if (res.data.results && Array.isArray(res.data.results)) transactions = res.data.results;

      const flattened = [];

      for (const tx of transactions) {
        const arrKey = findProductArrayKey(tx);

        if (arrKey) {
          for (const prod of tx[arrKey]) {
            const rawQuantity = prod.quantity ?? prod.qty ?? prod.amount ?? prod.count ??
              extractFieldValue(prod, ['quantity', 'qty', 'amount', 'count']) ??
              extractFieldValue(tx, ['quantity', 'qty', 'amount', 'count']);
            const rawPrice = prod.price ?? prod.unit_price ?? prod.unitPrice ??
              extractFieldValue(prod, ['price', 'unit_price', 'unitPrice']) ??
              extractFieldValue(tx, ['price', 'unit_price', 'unitPrice']);
            const rawTotal = prod.total ?? prod.totalAmount ?? prod.total_amount ?? prod.sum ??
              extractFieldValue(prod, ['total', 'totalAmount', 'total_amount', 'sum']) ??
              extractFieldValue(tx, ['total', 'totalAmount', 'total_amount', 'sum']);
            const rawBranchId = tx.branchId ?? tx.branch_id ?? extractFieldValue(tx, ['branch.id', 'branchId', 'branch_id']);

            const quantity = toNumberOrNull(rawQuantity);
            const price = toNumberOrNull(rawPrice);
            const total = toNumberOrNull(rawTotal) ?? (quantity !== null && price !== null ? quantity * price : 0);
            const branchId = toNumberOrNull(rawBranchId);
            const branchName = branchId ? branches.find(b => b.id.toString() === branchId.toString())?.name : null;
            const productId = prod.id ?? tx.productId;

            let productName = prod.productName ?? prod.name ?? prod.product_name ?? prod.title ?? prod.item_name ?? prod.product_title ?? prod.item_title ??
              extractFieldValue(prod, [
                'title',
                'productTitle',
                'product.name',
                'product.title',
                'item.name',
                'item.title',
                'item_name',
                'product_title',
                'item_title',
                'items.0.name',
                'items.0.title',
                'products.0.name',
                'products.0.title'
              ]);

            if (!productName || productName.includes('Recovered product')) {
              productName = productId ? `Product ${productId}` : 'Noma\'lum';
              console.warn(`Missing or invalid product name for productId ${productId}, using fallback:`, tx, prod);
            }

            if (!branchId) {
              console.warn(`Missing branchId for transaction:`, tx, prod);
            }

            flattened.push({
              productId,
              transactionDate: tx.date ?? tx.createdAt ?? tx.created_at ?? tx.timestamp,
              productName,
              quantity,
              price,
              total,
              branchId,
              branchName: branchName || 'Noma\'lum'
            });
          }
        } else {
          const rawQuantity = tx.quantity ?? tx.qty ?? tx.amount ?? tx.count ??
            extractFieldValue(tx, ['items.0.quantity', 'products.0.quantity']);
          const rawPrice = tx.price ?? tx.unit_price ?? tx.total ?? tx.sum ??
            extractFieldValue(tx, ['items.0.price', 'products.0.price']);
          const rawTotal = tx.total ?? tx.totalAmount ?? tx.sum ??
            extractFieldValue(tx, ['items.0.total', 'products.0.total']);
          const rawBranchId = tx.branchId ?? tx.branch_id ?? extractFieldValue(tx, ['branch.id', 'branchId', 'branch_id']);

          const quantity = toNumberOrNull(rawQuantity);
          const price = toNumberOrNull(rawPrice);
          const total = toNumberOrNull(rawTotal) ?? (quantity !== null && price !== null ? quantity * price : 0);
          const branchId = toNumberOrNull(rawBranchId);
          const branchName = branchId ? branches.find(b => b.id.toString() === branchId.toString())?.name : null;
          const productId = tx.productId;

          let productName = extractFieldValue(tx, [
            'productName',
            'product.name',
            'name',
            'title',
            'item_name',
            'product_title',
            'item_title',
            'items.0.name',
            'items.0.title',
            'products.0.name',
            'products.0.title',
            'item.name',
            'item.title'
          ]);

          if (!productName || productName.includes('Recovered product')) {
            productName = productId ? `Product ${productId}` : 'Noma\'lum';
            console.warn(`Missing or invalid product name for productId ${productId}, using fallback:`, tx);
          }

          if (!branchId) {
            console.warn(`Missing branchId for transaction:`, tx);
          }

          flattened.push({
            productId,
            transactionDate: tx.date ?? tx.createdAt ?? tx.created_at ?? tx.timestamp,
            productName,
            quantity,
            price,
            total,
            branchId,
            branchName: branchName || 'Noma\'lum'
          });
        }
      }

      setReportData(flattened);

      if (flattened.length === 0) {
      } else {
        const hasProduct342 = flattened.some(row => row.productId === 342);
        if (!hasProduct342) {
          console.warn('Product 342 not found in transactions');
        }
      }
    } catch (err) {
      let message = "Ma'lumotlarni yuklashda xatolik";
      if (err.message?.toLowerCase().includes('token')) message = err.message;
      else if (err.code === 'ECONNABORTED') message = "So'rov vaqti tugadi - Internetni tekshiring";
      else if (err.response?.data?.message) message = err.response.data.message;
      else if (err.response?.status) message = `Server xatosi: ${err.response.status}`;

      console.error('API Error:', err, 'Response:', err.response?.data);
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod, selectedBranchId, branches]);

  useEffect(() => {
    if (selectedBranchId) loadTransactions();
  }, [loadTransactions, selectedBranchId]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
          <TrendingUp size={28} />
          Hisobotlar
        </h1>
        <div className="flex gap-4">
          <select
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            className="border rounded-lg px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Filial tanlang</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="border rounded-lg px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="week">Oxirgi 7 kun</option>
            <option value="month">Oxirgi 30 kun</option>
            <option value="quarter">Oxirgi 90 kun</option>
            <option value="year">Oxirgi 1 yil</option>
          </select>
        </div>
      </div>

      {notification && <Notification {...notification} onClose={() => setNotification(null)} />}

      <div className="flex justify-end mb-4">
        <button
          onClick={generateReceipt}
          disabled={loading || reportData.length === 0}
          className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:bg-gray-400 transition-all duration-200 flex items-center gap-2"
        >
          <Calendar size={20} />
          Chekni Yuklash
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="animate-spin" size={32} />
        </div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-lg shadow">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="p-3">Nomer</th>
                <th className="p-3">Tovar Nomi</th>
                <th className="p-3">Miqdor</th>
                <th className="p-3">Narx</th>
                <th className="p-3">Jami</th>
                <th className="p-3">Filial</th>
                <th className="p-3">Sana</th>
              </tr>
            </thead>
            <tbody>
              {reportData.map((row, index) => (
                <tr key={index} className="border-t hover:bg-gray-50">
                  <td className="p-3">{index + 1}</td>
                  <td className="p-3">{row.productName || "Noma'lum"}</td>
                  <td className="p-3">{formatQuantity(row.quantity)}</td>
                  <td className="p-3">{formatCurrency(row.price)}</td>
                  <td className="p-3">{formatCurrency(row.total)}</td>
                  <td className="p-3">{row.branchName || "Noma'lum"}</td>
                  <td className="p-3">{formatDate(row.transactionDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {debugMode && (
        <pre className="mt-4 bg-gray-100 p-4 rounded text-xs overflow-auto max-h-96">
          {JSON.stringify({ rawApiResponse, reportData }, null, 2)}
        </pre>
      )}
    </div>
  );
};

export default Hisobotlar;