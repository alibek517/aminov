import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { BarChart3, ShoppingCart, AlertTriangle, Package, LogOut, Users, Ban, Menu, X, RotateCcw } from 'lucide-react';
import Logout from '../Chiqish/logout';
import { formatAmount, formatCurrency } from '../../utils/currencyFormat';

const Sidebar = ({ token, socket, locationPermission, locationError, children }) => {
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState(() => {
    return localStorage.getItem('selectedBranchId') || '';
  });
  const [branches, setBranches] = useState([{ id: '', name: 'Барча филиаллар' }]);
  const [error, setError] = useState(null);
  const [exchangeRate, setExchangeRate] = useState(0);
  const [exchangeRateLoading, setExchangeRateLoading] = useState(false);
  const navigate = useNavigate();

  const menuItems = [
    { id: 'dashboard', label: 'Хисобот', icon: BarChart3, path: '/kasir/dashboard' },
    { id: 'sales', label: 'Сотиш', icon: ShoppingCart, path: '/kasir/sales' },
    { id: 'defective', label: 'Брак/Қайтариш', icon: AlertTriangle, path: '/kasir/defective' },
    { id: 'returned', label: 'Қайтарилганлар', icon: RotateCcw, path: '/kasir/returned' },
    { id: 'mijozlar', label: 'Кредит', icon: Users, path: '/kasir/mijozlar' },
    { id: 'sotuvchilar', label: 'Сотувчилар моаши', icon: Users, path: '/kasir/sotuvchilar' },
  ];

  const fetchWithAuth = async (url, options = {}) => {
    if (!token) {
      navigate('/login');
      throw new Error('Токен топилмади. Илтимос, қайтадан киринг.');
    }

    const headers = {
      ...options.headers,
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    const response = await fetch(url, { ...options, headers });
    if (response.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('userRole');
      localStorage.removeItem('user');
      localStorage.removeItem('userId');
      localStorage.removeItem('selectedBranchId');
      navigate('/login');
      throw new Error('Рухсатсиз: Сессия муддати тугади. Илтимос, қайтадан киринг.');
    }

    if (!response.ok) {
      throw new Error('Филиалларни юклаб олишда хатолик.');
    }

    return response;
  };

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const response = await fetchWithAuth('https://suddocs.uz/branches');
        const data = await response.json();
        setBranches([{ id: '', name: 'Барча филиаллар' }, ...data]);
        if (selectedBranchId && !data.some((branch) => branch.id.toString() === selectedBranchId)) {
          setSelectedBranchId('');
          localStorage.setItem('selectedBranchId', '');
        }
      } catch (err) {
        setError(err.message);
      }
    };

    fetchBranches();
    const onVisibility = () => {
      if (!document.hidden) fetchExchangeRate();
    };
    document.addEventListener('visibilitychange', onVisibility);
    // initial fetch
    fetchExchangeRate();
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [selectedBranchId, navigate, token]);

  // Save selected branch to localStorage
  useEffect(() => {
    localStorage.setItem('selectedBranchId', selectedBranchId);

    const handleStorageChange = (e) => {
      if (e.key === 'selectedBranchId') {
        setSelectedBranchId(e.newValue || '');
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [selectedBranchId]);

  const handleLogoutConfirm = () => {
    localStorage.removeItem('userRole');
    localStorage.removeItem('user');
    localStorage.removeItem('userId');
    localStorage.removeItem('selectedBranchId');
    localStorage.removeItem('access_token');
    if (socket) {
      socket.disconnect();
    }
    navigate('/login');
  };

  const handleLogoutCancel = () => {
    setShowLogoutModal(false);
  };

  const handleBranchChange = (e) => {
    setSelectedBranchId(e.target.value);
  };

  const fetchExchangeRate = async () => {
    try {
      setExchangeRateLoading(true);
      // Try current-rate endpoint first
      try {
        const resp = await fetchWithAuth('https://suddocs.uz/currency-exchange-rates/current-rate?fromCurrency=USD&toCurrency=UZS');
        const data = await resp.json();
        if (data && data.rate) {
          setExchangeRate(Number(data.rate));
        } else {
          throw new Error('No rate in current-rate response');
        }
      } catch {
        // Fallback to list endpoint and prefer active USD→UZS
        const listResp = await fetchWithAuth('https://suddocs.uz/currency-exchange-rates');
        const arr = await listResp.json();
        const list = Array.isArray(arr) ? arr : [];
        const active = list.find(r => r.isActive && r.fromCurrency === 'USD' && r.toCurrency === 'UZS');
        const rate = Number(active?.rate ?? list[0]?.rate) || 0;
        if (rate > 0) setExchangeRate(rate);
      }
    } catch (e) {
    } finally {
      setExchangeRateLoading(false);
    }
  };

  // Get user data from localStorage
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const userName = user.fullName || user.name || user.username || 'Фойдаланувчи';
  const userRole = localStorage.getItem('userRole') || 'Кассир';
  // Get branch name from branches array based on selectedBranchId
  const selectedBranch = branches.find(branch => branch.id.toString() === selectedBranchId);
  const userBranchName = selectedBranch ? selectedBranch.name : (user.branch || 'nomalum');
  const initials = userName
    .split(' ')
    .map(word => word.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex h-screen bg-gray-50 w-full">
      <div
        className={`${sidebarOpen ? "translate-x-0" : "-translate-x-full"
          } fixed inset-y-0 left-0 z-50 w-64 transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 text-white flex flex-col`}
        style={{ backgroundColor: '#00020F' }}
      >
        <div className="p-4 lg:p-6">
          <img
            src="/Baner_Zippy.png"
            alt="Zippy логотипи"
            className="object-contain filter brightness-110 contrast-110 transition-all duration-300 hover:scale-105 hover:brightness-125"
          />
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden mt-3 p-2 rounded-md text-gray-300 hover:text-white"
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', position: 'absolute', top: '10px', right: '10px' }}
          >
            <X size={20} />
          </button>
          <hr className="my-2" />
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img style={{ borderRadius: "50%", width: '60px' }} src="/AminovHolding.jpg" alt="" />
            <div>
              <h1 className="text-xl font-bold text-white">Аминов</h1>
              <p className="text-sm text-gray-400">Савдо тизими</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 lg:p-4">
          <ul className="space-y-2">
            {menuItems.map((item) => (
              <li key={item.id}>
                <NavLink
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-all duration-200 ${isActive
                      ? 'bg-gradient-to-r from-[#1178f8]/20 to-[#1178f8]/10 text-[#1178f8] border border-[#1178f8]/30 shadow-lg shadow-[#1178f8]/20'
                      : 'text-gray-300 hover:bg-white/5 hover:text-white hover:shadow-md'
                    }`
                  }
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="p-3 lg:p-4 absolute bottom-0 left-0 right-0">
          <button
            onClick={() => setShowLogoutModal(true)}
            className="w-full flex items-center space-x-3 px-4 py-2 text-gray-300 hover:bg-red-500/10 hover:text-red-400 rounded-lg transition-all duration-200 hover:border-red-500/20 border border-transparent"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-sm">Чиқиш</span>
          </button>
        </div>
      </div>

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col overflow-hidden w-full">
        <header className="bg-white shadow-sm">
          <div className="flex flex-wrap justify-between items-center px-4 lg:px-6 py-3 gap-y-2">
            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-600 mr-2"
              >
                <Menu size={20} />
              </button>
            </div>

            <div className="flex items-center space-x-4 w-full justify-end lg:w-auto">
              <div className="text-right mr-4">
                <div className="text-sm text-gray-600">Валюта курси:</div>
                <div className="text-lg font-semibold text-blue-600 flex items-center gap-2 justify-end">
                  1 USD = {exchangeRate.toLocaleString('uz-UZ')} сўм
                </div>
              </div>
              <div className="flex items-center">
                <div
                  style={{ marginBottom: "5px" }}
                  className="flex items-center space-x-3"
                >
                  <div className="w-10 h-10 bg-[#1178f8] rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-white">
                      {initials}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {userName}
                    </p>
                    <p className="text-xxs text-gray-600">
                      {userRole === "CASHIER" ? "Кассир" : (userRole || "Кассир")}
                    </p>
                    <p className="text-xxs text-gray-600">
                      {userBranchName}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 lg:p-6 w-full">
          <div className="w-full h-full min-h-0">
            {children}
          </div>
        </main>
      </div>

      {showLogoutModal && (
        <Logout
          onConfirm={handleLogoutConfirm}
          onCancel={handleLogoutCancel}
        />
      )}
    </div>
  );
};

export default Sidebar;