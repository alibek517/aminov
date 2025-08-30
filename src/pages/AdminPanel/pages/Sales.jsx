import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, RefreshCw } from 'lucide-react';
import { formatAmount, formatCurrency } from '../../../utils/currencyFormat';

const Sales = ({ selectedBranchId: propSelectedBranchId }) => {
  const navigate = useNavigate();
  const [sales, setSales] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState(
    propSelectedBranchId || localStorage.getItem('selectedBranchId') || ''
  );

  const fetchWithAuth = async (url, options = {}) => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      navigate('/login');
      throw new Error('No token');
    }
    const headers = {
      ...options.headers,
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
    const response = await fetch(url, { ...options, headers });
    if (response.status === 401) {
      localStorage.removeItem('access_token');
      navigate('/login');
      throw new Error('Unauthorized');
    }
    if (!response.ok) throw new Error('Request failed');
    return response;
  };

  const loadSales = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedBranchId) params.append('branchId', selectedBranchId);
      const res = await fetchWithAuth(`https://suddocs.uz/transactions?type=SALE&${params.toString()}`);
      const data = await res.json();
      setSales(Array.isArray(data) ? data : []);
      setError('');
    } catch (e) {
      setError(e.message || 'Xatolik');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSales();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranchId]);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'selectedBranchId') {
        setSelectedBranchId(e.newValue || '');
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const filtered = useMemo(() => {
    return sales.filter((s) => {
      const text = `${s.id} ${s.customerId || ''} ${(s.items || []).map(i => i.productId).join(' ')}`.toLowerCase();
      return text.includes(search.toLowerCase());
    });
  }, [sales, search]);

  const formatAmount = (value) => {
    const num = Math.floor(Number(value) || 0);
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  };

  if (loading) return <div className="p-6">Юкланмоқда...</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Сотувлар</h1>
        <button onClick={loadSales} className="flex items-center px-4 py-2 bg-gray-800 text-white rounded-lg">
          <RefreshCw size={16} className="mr-2" /> Янгилаш
        </button>
      </div>
      <div className="bg-white rounded-xl shadow-sm border p-4 flex gap-4 items-center">
        <div className="flex-1 relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ID, мижоз ёки маҳсулот бўйича қидиринг"
            className="w-full pl-9 pr-3 py-2 border rounded-lg"
          />
        </div>
        <Filter size={18} className="text-gray-400" />
      </div>
      <div className="bg-white rounded-xl shadow-sm border overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Мижоз</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Жами</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Сана</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((t) => (
              <tr key={t.id} className="hover:bg-gray-50">
                <td className="px-6 py-3">{t.id}</td>
                <td className="px-6 py-3">{t.customerId || '-'}</td>
                <td className="px-6 py-3">{formatAmount(t.total || 0)}</td>
                <td className="px-6 py-3">{new Date(t.createdAt).toLocaleString('uz-Cyrl-UZ')}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-6 text-center text-gray-500">Маълумот йўқ</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Sales;
