import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { DollarSign, Calendar, User, TrendingUp } from 'lucide-react';
import { formatCurrency, formatCurrencyUSD } from '../../utils/currencyFormat';

const Notification = ({ message, type, onClose }) => (
  <div
    className={`p-4 rounded ${type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'} mb-4`}
  >
    {message}
    <button className="ml-4 text-sm underline" onClick={onClose}>
      Yopish
    </button>
  </div>
);

function Sotuvchilar() {
  const [users, setUsers] = useState([]);
  const [branches, setBranches] = useState([]); // Barcha filiallar
  const [selectedUserId, setSelectedUserId] = useState(''); 
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notification, setNotification] = useState(null);
  const [loading, setLoading] = useState(false);
  const [salesData, setSalesData] = useState([]);
  const [earningsSummary, setEarningsSummary] = useState({});
  const [exchangeRate, setExchangeRate] = useState(12500); 
  const navigate = useNavigate();
  const token = localStorage.getItem('access_token');
  const branchId = localStorage.getItem('branchId');
  const API_URL = 'https://suddocs.uz';

  const didInitDatesRef = useRef(false);
  useEffect(() => {
    if (didInitDatesRef.current) return;
    didInitDatesRef.current = true;
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
    
    setStartDate(startOfDay.toISOString().split('T')[0]);
    setEndDate(endOfDay.toISOString().split('T')[0]);
  }, []);

  // Auto-hide notification after 1.5 seconds
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => setNotification(null), 1500);
    return () => clearTimeout(timer);
  }, [notification]);

  // Fetch exchange rate
  useEffect(() => {
    if (token) {
      fetchExchangeRate();
    }
  }, [token]);

  // Validate date range
  useEffect(() => {
    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      setNotification({
        message: 'Тугаш сана бошланғич санадан кейин бўлиши керак',
        type: 'error',
      });
      setEndDate(startDate);
    }
  }, [startDate, endDate]);

  // Fetch exchange rate from /currency-exchange-rates endpoint
  const fetchExchangeRate = async () => {
    try {
      const response = await fetch(`${API_URL}/currency-exchange-rates`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          const firstExchangeRate = data[0];
          if (firstExchangeRate && firstExchangeRate.rate) {
            setExchangeRate(firstExchangeRate.rate);
          }
        } else {
          console.warn('No exchange rates found in response');
        }
      }
    } catch (error) {
      console.error('Failed to fetch exchange rate:', error);
      // Keep default rate if fetch fails
    }
  };

  // Authentication-enabled fetch function
  const fetchWithAuth = async (url) => {
    if (!token) {
      navigate('/login');
      throw new Error('No token found');
    }
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
    const response = await fetch(url, { headers });
    if (!response.ok) {
      if (response.status === 401) {
        localStorage.clear();
        navigate('/login');
        throw new Error('Session expired');
      }
      throw new Error('Request failed');
    }
    return response.json();
  };

  // Fetch branches
  const didInitBranchesRef = useRef(false);
  useEffect(() => {
    if (didInitBranchesRef.current) return;
    didInitBranchesRef.current = true;
    const fetchBranches = async () => {
      try {
        setLoading(true);
        const branchData = await fetchWithAuth(`${API_URL}/branches`);
        setBranches(branchData);
      } catch (err) {
        setNotification({ message: err.message || 'Filiallarni yuklashda xatolik', type: 'error' });
      } finally {
        setLoading(false);
      }
    };
    fetchBranches();
  }, []);

  // Fetch users with MARKETING role (guard)
  const didInitUsersRef = useRef(false);
  useEffect(() => {
    if (didInitUsersRef.current) return;
    didInitUsersRef.current = true;
    const fetchUsers = async () => {
      try {
        setLoading(true);
        const userData = await fetchWithAuth(`${API_URL}/users`);
        const marketingUsers = userData.filter((user) => user.role === 'MARKETING');
        setUsers(marketingUsers);
      } catch (err) {
        setNotification({ message: err.message || 'Foydalanuvchilarni yuklashda xatolik', type: 'error' });
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  // Fetch sales data based on selected user and date range
  const fetchSalesData = async () => {
    if (!startDate || !endDate) return;

    setLoading(true);
    setNotification(null);

    try {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      let allTransactions = [];
      let queryBase = `?startDate=${start.toISOString()}&endDate=${end.toISOString()}&type=SALE`;
      
      if (selectedUserId && selectedUserId !== '') {
        // Tanlangan sotuvchi uchun barcha filiallarda agregatsiya
        for (const branch of branches) {
          let queryParams = `${queryBase}&branchId=${branch.id}&soldByUserId=${selectedUserId}`;
          const data = await fetchWithAuth(`${API_URL}/transactions${queryParams}`);
          const transactions = data.transactions || data || [];
          allTransactions = [...allTransactions, ...transactions];
        }
      } else {
        // Barca sotuvchilar uchun faqat joriy filial
        let queryParams = `${queryBase}&branchId=${branchId}`;
        const data = await fetchWithAuth(`${API_URL}/transactions${queryParams}`);
        const transactions = data.transactions || data || [];
        allTransactions = transactions;
      }

      // Process sales data
      const processedData = allTransactions.map(tx => ({
        id: tx.id,
        userId: tx.soldByUserId || tx.userId,
        branchId: tx.fromBranchId || branchId, // Filial ID saqlash
        customerName: tx.customer ? 
          (tx.customer.fullName || `${tx.customer.firstName || ''} ${tx.customer.lastName || ''}`.trim()) : 
          'Noma\'lum',
        totalInSom: tx.finalTotal, // So'mda (backenddan allaqachon so'm)
        total: tx.finalTotal / exchangeRate, // USD ga o'tkazish
        paymentType: tx.paymentType,
        createdAt: tx.createdAt,
        items: tx.items || []
      }));

      setSalesData(processedData);

      // Calculate earnings summary by salesperson (agregatsiya)
      const summary = {};
      processedData.forEach(sale => {
        const userId = sale.userId;
        if (!summary[userId]) {
          summary[userId] = {
            totalSales: 0, // USD
            totalSalesInSom: 0, // UZS
            transactionCount: 0,
            cashSales: 0, // USD
            cardSales: 0, // USD
            creditSales: 0, // USD
            branches: new Set() // Qaysi filiallarda sotgan
          };
        }
        
        summary[userId].totalSales += sale.total;
        summary[userId].totalSalesInSom += sale.totalInSom;
        summary[userId].transactionCount += 1;
        summary[userId].branches.add(sale.branchId);
        
        switch (sale.paymentType) {
          case 'CASH':
            summary[userId].cashSales += sale.total;
            break;
          case 'CARD':
            summary[userId].cardSales += sale.total;
            break;
          case 'CREDIT':
          case 'INSTALLMENT':
            summary[userId].creditSales += sale.total;
            break;
        }
      });

      // Setlarni arrayga aylantirish
      Object.values(summary).forEach(s => {
        s.branches = Array.from(s.branches);
      });

      setEarningsSummary(summary);

    } catch (err) {
      console.error('Error fetching sales data:', err);
      setNotification({ message: err.message || 'Ma\'lumotlarni yuklashda xatolik', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Manual refresh function
  const handleRefresh = () => {
    fetchSalesData();
  };

  // Fetch sales data based on selected user and date range
  useEffect(() => {
    if (token && startDate && endDate && branches.length > 0) {
      fetchSalesData();
    } else if (!token) {
      navigate('/login');
    }
  }, [selectedUserId, startDate, endDate, navigate, token, branchId, exchangeRate, branches]);



  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('uz-Cyrl-UZ');
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('uz-Cyrl-UZ', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPaymentTypeLabel = (type) => {
    switch (type) {
      case 'CASH': return 'Naqd';
      case 'CARD': return 'Karta';
      case 'CREDIT': return 'Kredit';
      case 'INSTALLMENT': return 'Bo\'lib to\'lash';
      default: return 'Noma\'lum';
    }
  };

  const getPaymentTypeColor = (type) => {
    switch (type) {
      case 'CASH': return 'text-green-600 bg-green-100';
      case 'CARD': return 'text-blue-600 bg-blue-100';
      case 'CREDIT': return 'text-purple-600 bg-purple-100';
      case 'INSTALLMENT': return 'text-orange-600 bg-orange-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getBranchName = (branchId) => {
    const branch = branches.find(b => b.id === branchId);
    return branch ? branch.name : 'Noma\'lum';
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Сотувчилар маоши</h1>
        <p className="text-gray-600 mt-1">Сотувчилар маоши бўйича маълумотлар</p>
        <div className="mt-2 text-sm text-gray-500">
          <span className="font-medium">Joriy kurs:</span> 1 USD = {formatCurrency(exchangeRate)}
        </div>
      </div>

      {/* Date Range Inputs and User Select */}
      <div className="flex flex-col sm:flex-row sm:space-x-4 mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Бошланғич сана</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          />
          <p className="text-xs text-gray-500 mt-1">
            {startDate && `00:00 - ${new Date(startDate).toLocaleDateString('uz-Cyrl-UZ')}`}
          </p>
        </div>
        <div className="flex-1 mt-4 sm:mt-0">
          <label className="block text-sm font-medium text-gray-700 mb-1">Тугаш сана</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          />
          <p className="text-xs text-gray-500 mt-1">
            {endDate && `${new Date(endDate).toLocaleDateString('uz-Cyrl-UZ')} - 23:59`}
          </p>
        </div>
        <div className="flex-1 mt-4 sm:mt-0">
          <label className="block text-sm font-medium text-gray-700 mb-1">Сотувчи</label>
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          >
            <option value="">Барча сотивчилар</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.firstName} {user.lastName}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            {selectedUserId === '' ? 'Барча сотивчилар кўрсатилади (joriy filial)' : 
             `Танланган: ${users.find(u => u.id === parseInt(selectedUserId))?.firstName} ${users.find(u => u.id === parseInt(selectedUserId))?.lastName} (barcha filiallar)`}
          </p>
        </div>
        <div className="flex-1 mt-4 sm:mt-0 flex items-end">
          <button
            onClick={handleRefresh}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Yangilash
          </button>
        </div>
      </div>

      {notification && <Notification {...notification} onClose={() => setNotification(null)} />}

      {loading ? (
        <div className="text-center text-gray-600">Yuklanmoqda...</div>
      ) : (
        <>
          {Object.keys(earningsSummary).length > 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Sotuvchilar bo'yicha xulosa</h2>
              <ul className="space-y-6">
                {Object.entries(earningsSummary).map(([userId, summary]) => {
                  const user = users.find((u) => u.id === parseInt(userId));
                  if (!user) return null;

                  if (selectedUserId && selectedUserId !== '' && parseInt(userId) !== parseInt(selectedUserId)) {
                    return null;
                  }

                  return (
                    <li key={userId} className="border-b border-gray-200 pb-4">
                      <div className="text-base font-medium text-gray-900">
                        {user.firstName} {user.lastName}
                      </div>
                    
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Jami sotuv (UZS):</span>
                          <span className="text-sm font-semibold text-blue-600">
                            {formatCurrency(summary.totalSalesInSom)}
                          </span>
                        </div>
                        
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
              <div className="text-gray-400 mb-4">
                <User size={48} className="mx-auto" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Ma'lumot topilmadi</h3>
              <p className="text-gray-500">
                {startDate && endDate ? (
                  <>
                    {formatDate(startDate)} 00:00 - {formatDate(endDate)} 23:59 oralig'ida
                    {selectedUserId ? ' tanlangan sotuvchi uchun (barcha filiallar)' : ' hech qanday sotuv ma\'lumoti yo\'q (joriy filial)'}
                  </>
                ) : (
                  'Sana oralig\'i tanlanmagan'
                )}
              </p>
              <div className="mt-4 text-sm text-gray-400">
                <p>Filtrlarni tekshiring yoki boshqa sana oralig\'ini tanlang</p>
              </div>
            </div>
          )}

          {/* Sales Data Table */}
          {salesData.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mt-6">
              <div className="p-6 border-b border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900">Сотув маълумотлари</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {startDate && endDate && (
                    <>
                      {formatDate(startDate)} 00:00 - {formatDate(endDate)} 23:59
                      {selectedUserId && (
                        <span className="ml-2">
                          | Сотувчи: {users.find((u) => u.id === parseInt(selectedUserId))?.firstName}{' '}
                          {users.find((u) => u.id === parseInt(selectedUserId))?.lastName} (barcha filiallar)
                        </span>
                      )}
                    </>
                  )}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Сотувчи
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Филиал
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Мижоз
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Умумий (UZS)
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        To'lov turi
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Сана / Вақт
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {salesData
                      .filter((sale) => {
                        if (selectedUserId && selectedUserId !== '') {
                          return parseInt(sale.userId) === parseInt(selectedUserId);
                        }
                        return true;
                      })
                      .map((sale) => (
                        <tr key={sale.id} className="hover:bg-gray-50 transition-colors duration-150">
                          <td className="px-6 py-4 text-gray-900">#{sale.id}</td>
                          <td className="px-6 py-4 text-gray-700">
                            {users.find((u) => u.id === sale.userId)?.firstName || 'Sklad'}{' '}
                            {users.find((u) => u.id === sale.userId)?.lastName || ''}
                          </td>
                          <td className="px-6 py-4 text-gray-700">
                            {getBranchName(sale.branchId)}
                          </td>
                          <td className="px-6 py-4 text-gray-700">{sale.customerName}</td>
                          <td className="px-6 py-4 text-gray-700 font-medium">
                            {formatCurrency(sale.totalInSom, 'UZS')}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${getPaymentTypeColor(
                                sale.paymentType
                              )}`}
                            >
                              {getPaymentTypeLabel(sale.paymentType)}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-gray-900">{formatDate(sale.createdAt)}</div>
                            <div className="text-xs text-gray-500">{formatTime(sale.createdAt)}</div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Sotuvchilar;