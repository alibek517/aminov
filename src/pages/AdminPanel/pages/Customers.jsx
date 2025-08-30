import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Edit3, Trash2 } from 'lucide-react';
import { formatAmount, formatCurrency } from '../../../utils/currencyFormat';

const Customers = ({ selectedBranchId: propSelectedBranchId }) => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null); // 'add' | 'edit' | null
  const [current, setCurrent] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', address: '' });
  const [selectedBranchId] = useState(propSelectedBranchId || localStorage.getItem('selectedBranchId') || '');

  const fetchWithAuth = async (url, options = {}) => {
    const token = localStorage.getItem('access_token');
    if (!token) { navigate('/login'); throw new Error('No token'); }
    const headers = { ...options.headers, 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) { localStorage.removeItem('access_token'); navigate('/login'); throw new Error('Unauthorized'); }
    if (!res.ok) throw new Error('Request failed');
    return res;
  };

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetchWithAuth('https://suddocs.uz/customers');
      const data = await res.json();
      setCustomers(Array.isArray(data) ? data : []);
      setError('');
    } catch (e) {
      setError(e.message || 'Xatolik');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return customers.filter(c => `${c.id} ${c.name} ${c.phone || ''} ${c.address || ''}`.toLowerCase().includes(search.toLowerCase()));
  }, [customers, search]);

  const openAdd = () => { setForm({ name: '', phone: '', address: '' }); setCurrent(null); setModal('add'); };
  const openEdit = (c) => { setForm({ name: c.name || '', phone: c.phone || '', address: c.address || '' }); setCurrent(c); setModal('edit'); };
  const close = () => { setModal(null); setCurrent(null); };

  const submit = async (e) => {
    e.preventDefault();
    try {
      const payload = { name: form.name, phone: form.phone || null, address: form.address || null };
      if (modal === 'add') {
        const res = await fetchWithAuth('https://suddocs.uz/customers', { method: 'POST', body: JSON.stringify(payload) });
        const c = await res.json();
        setCustomers(prev => [...prev, c]);
      } else if (modal === 'edit' && current) {
        const res = await fetchWithAuth(`https://suddocs.uz/customers/${current.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        const c = await res.json();
        setCustomers(prev => prev.map(x => x.id === c.id ? c : x));
      }
      close();
    } catch (e) { alert(e.message || 'Xatolik'); }
  };

  const remove = async (c) => {
    if (!window.confirm('Mijozni o‘chirasizmi?')) return;
    try {
      await fetchWithAuth(`https://suddocs.uz/customers/${c.id}`, { method: 'DELETE' });
      setCustomers(prev => prev.filter(x => x.id !== c.id));
    } catch (e) { alert(e.message || 'Xatolik'); }
  };

  if (loading) return <div className="p-6">Юкланмоқда...</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Мижозлар</h1>
        <button onClick={openAdd} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg">
          <Plus size={16} className="mr-2" /> Қўшиш
        </button>
      </div>
      <div className="bg-white rounded-xl shadow-sm border p-4 flex gap-4 items-center">
        <div className="flex-1 relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Исм, телефон ёки манзил"
            className="w-full pl-9 pr-3 py-2 border rounded-lg"
          />
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-sm border overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Исм</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Телефон</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Манзил</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-6 py-3">{c.id}</td>
                <td className="px-6 py-3">{c.name}</td>
                <td className="px-6 py-3">{c.phone || '-'}</td>
                <td className="px-6 py-3">{c.address || '-'}</td>
                <td className="px-6 py-3 text-right whitespace-nowrap">
                  <button onClick={() => openEdit(c)} className="text-blue-600 hover:text-blue-800 mr-3">
                    <Edit3 size={16} />
                  </button>
                  <button onClick={() => remove(c)} className="text-red-600 hover:text-red-800">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-6 text-center text-gray-500">Маълумот йўқ</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4">{modal === 'add' ? "Мижоз қўшиш" : "Мижозни таҳрирлаш"}</h2>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Исм</label>
                <input value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} className="mt-1 w-full border rounded-lg px-3 py-2" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Телефон</label>
                <input value={form.phone} onChange={(e)=>setForm({...form,phone:e.target.value})} className="mt-1 w-full border rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Манзил</label>
                <input value={form.address} onChange={(e)=>setForm({...form,address:e.target.value})} className="mt-1 w-full border rounded-lg px-3 py-2" />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={close} className="px-4 py-2 bg-gray-100 rounded-lg">Бекор қилиш</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg">Сақлаш</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Customers;