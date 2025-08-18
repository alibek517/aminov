import React, { useEffect, useMemo, useState, useRef } from 'react';

const BrakMaxsulotlar = () => {
  const [logs, setLogs] = useState([]);
  const [defectiveProducts, setDefectiveProducts] = useState([]);
  const [soldProductIds, setSoldProductIds] = useState(new Set());
  const [soldKeys, setSoldKeys] = useState(new Set());
  const [saleTimesById, setSaleTimesById] = useState({});
  const [saleTimesByKey, setSaleTimesByKey] = useState({});
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  useEffect(() => {
    if (!notification) return;
    const t = setTimeout(() => setNotification(null), 1500);
    return () => clearTimeout(t);
  }, [notification]);
  const [search, setSearch] = useState('');

  const token = localStorage.getItem('access_token');
  const branchId = localStorage.getItem('branchId');
  const API_URL = 'https://suddocs.uz';

  const didInitRef = useRef(false);
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    const fetchLogs = async () => {
      if (!token) return;
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/defective-logs?branchId=${branchId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setNotification({ type: 'error', message: err.message || 'Brak loglarini yuklashda xatolik' });
          return;
        }
        const data = await res.json();
        setLogs(Array.isArray(data) ? data : []);
      } catch (e) {
        setNotification({ type: 'error', message: 'Brak loglarini yuklashda xatolik' });
      } finally {
        setLoading(false);
      }
    };
    const fetchDefectiveProducts = async () => {
      if (!token) return;
      try {
        const res = await fetch(`${API_URL}/defective-logs/defective-products?branchId=${branchId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        if (!res.ok) return;
        const data = await res.json();
        setDefectiveProducts(Array.isArray(data) ? data : []);
      } catch {}
    };
    const makeKey = (p) => {
      if (!p) return '';
      const barcode = (p.barcode || '').trim().toLowerCase();
      if (barcode) return `bc:${barcode}`;
      const name = (p.name || '').trim().toLowerCase();
      const model = (p.model || '').trim().toLowerCase();
      return `nm:${name}|${model}`;
    };

    const fetchSold = async () => {
      if (!token) return;
      try {
        const res = await fetch(`${API_URL}/transactions?branchId=${branchId}&type=SALE`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        if (!res.ok) return;
        const data = await res.json();
        const transactions = data.transactions || data || [];
        const ids = new Set();
        const keys = new Set();
        const timesById = {};
        const timesByKey = {};
        transactions.forEach((tx) => {
          const t = tx.createdAt ? new Date(tx.createdAt).getTime() : 0;
          (tx.items || []).forEach((it) => {
            const pid = it.productId || it.product?.id;
            if (pid) {
              ids.add(pid);
              timesById[pid] = timesById[pid] ? Math.min(timesById[pid], t) : t;
            }
            const key = makeKey(it.product || {});
            if (key) {
              keys.add(key);
              timesByKey[key] = timesByKey[key] ? Math.min(timesByKey[key], t) : t;
            }
          });
        });
        setSoldProductIds(ids);
        setSoldKeys(keys);
        setSaleTimesById(timesById);
        setSaleTimesByKey(timesByKey);
      } catch {}
    };
    fetchLogs();
    fetchDefectiveProducts();
    fetchSold();
  }, []);

  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter((log) => {
      const p = log.product || {};
      return (
        (p.name || '').toLowerCase().includes(q) ||
        (p.model || '').toLowerCase().includes(q) ||
        (p.barcode || '').toLowerCase().includes(q)
      );
    });
  }, [logs, search]);

  const groupByProduct = (items) => {
    const map = new Map();
    items.forEach((log) => {
      const pid = log.productId;
      if (!pid) return;
      if (!map.has(pid)) {
        map.set(pid, {
          productId: pid,
          name: log.product?.name,
          model: log.product?.model,
          barcode: log.product?.barcode,
          total: 0,
          entries: [],
        });
      }
      const agg = map.get(pid);
      const qty = Number(log.quantity) || 0;
      agg.total += qty;
      agg.entries.push({
        id: log.id,
        date: log.createdAt,
        description: log.description,
        quantity: qty,
      });
    });
    // sort by total desc
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  };

  const inStoreGroups = useMemo(() => {
    // Classify logs strictly by time vs earliest sale time
    const makeKey = (p) => {
      if (!p) return '';
      const barcode = (p.barcode || '').trim().toLowerCase();
      if (barcode) return `bc:${barcode}`;
      const name = (p.name || '').trim().toLowerCase();
      const model = (p.model || '').trim().toLowerCase();
      return `nm:${name}|${model}`;
    };
    const storeLogs = filteredLogs.filter((l) => {
      if (l.actionType !== 'DEFECTIVE') return false;
      const logTime = l.createdAt ? new Date(l.createdAt).getTime() : 0;
      const pid = l.productId;
      const key = makeKey(l.product || {});
      const saleT = pid && saleTimesById[pid] ? saleTimesById[pid] : key && saleTimesByKey[key] ? saleTimesByKey[key] : undefined;
      // In-store if never sold OR log is before earliest sale time
      if (saleT === undefined) return true;
      return logTime < saleT;
    });
    return groupByProduct(storeLogs);
  }, [filteredLogs, saleTimesById, saleTimesByKey]);

  const soldGroups = useMemo(() => {
    const makeKey = (p) => {
      if (!p) return '';
      const barcode = (p.barcode || '').trim().toLowerCase();
      if (barcode) return `bc:${barcode}`;
      const name = (p.name || '').trim().toLowerCase();
      const model = (p.model || '').trim().toLowerCase();
      return `nm:${name}|${model}`;
    };
    const soldLogs = filteredLogs.filter((l) => {
      if (l.actionType !== 'DEFECTIVE') return false;
      const logTime = l.createdAt ? new Date(l.createdAt).getTime() : 0;
      const pid = l.productId;
      const key = makeKey(l.product || {});
      const saleT = pid && saleTimesById[pid] ? saleTimesById[pid] : key && saleTimesByKey[key] ? saleTimesByKey[key] : undefined;
      // Sold-after if there is a sale and log is same/after earliest sale time
      return saleT !== undefined && logTime >= saleT;
    });
    return groupByProduct(soldLogs);
  }, [filteredLogs, saleTimesById, saleTimesByKey]);

  const formatDate = (d) => (d ? new Date(d).toLocaleDateString('uz-UZ') : '');

  return (
    <div className="ml-[255px] space-y-6 p-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Brak Maxsulotlar</h1>
          <p className="text-gray-600 mt-1">Dokonda brak bo‘lgan va sotilgandan keyin brak qilingan maxsulotlar</p>
        </div>
      </div>

      {notification && (
        <div className={`p-4 rounded-lg border ${notification.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
          {notification.message}
          <button className="ml-4 text-sm underline" onClick={() => setNotification(null)}>Yopish</button>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Qidirish (nomi, barcode, modeli)</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Mahsulot nomi, barcode yoki modelini kiriting..."
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Dokonda brak bo'lgan */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">Dokonda brak bo‘lgan</h3>
              <span className="text-sm text-gray-500">Jami: {inStoreGroups.reduce((s, g) => s + g.total, 0)} dona</span>
            </div>
            {loading ? (
              <div className="text-gray-500">Yuklanmoqda...</div>
            ) : inStoreGroups.length === 0 ? (
              <div className="text-gray-500">Ma'lumot yo‘q</div>
            ) : (
              <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                {inStoreGroups.map((g) => (
                  <div key={g.productId} className="p-3 bg-gray-50 rounded border">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{g.name}</div>
                        <div className="text-xs text-gray-600">{g.model ? `${g.model} · ` : ''}{g.barcode ? `Barcode: ${g.barcode}` : ''}</div>
                      </div>
                      <div className="text-right text-sm font-semibold text-red-600">{g.total} dona</div>
                    </div>
                    <div className="mt-2 space-y-1">
                      {g.entries.map((e) => (
                        <div key={e.id} className="text-xs text-gray-700">
                          {formatDate(e.date)} — {e.description} ({e.quantity} dona)
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sotilgandan keyin brak bo‘lgan */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">Sotilgandan keyin brak bo‘lgan</h3>
              <span className="text-sm text-gray-500">Jami: {soldGroups.reduce((s, g) => s + g.total, 0)} dona</span>
            </div>
            {loading ? (
              <div className="text-gray-500">Yuklanmoqda...</div>
            ) : soldGroups.length === 0 ? (
              <div className="text-gray-500">Ma'lumot yo‘q</div>
            ) : (
              <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                {soldGroups.map((g) => (
                  <div key={g.productId} className="p-3 bg-gray-50 rounded border">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{g.name}</div>
                        <div className="text-xs text-gray-600">{g.model ? `${g.model} · ` : ''}{g.barcode ? `Barcode: ${g.barcode}` : ''}</div>
                      </div>
                      <div className="text-right text-sm font-semibold text-red-600">{g.total} dona</div>
                    </div>
                    <div className="mt-2 space-y-1">
                      {g.entries.map((e) => (
                        <div key={e.id} className="text-xs text-gray-700">
                          {formatDate(e.date)} — {e.description} ({e.quantity} dona)
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BrakMaxsulotlar;