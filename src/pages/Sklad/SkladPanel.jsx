import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { TrendingDown, BarChart3, Box, Settings, LogOut, Bell, Users, Menu, X, TrendingUp } from 'lucide-react';
import Chiqim from './pages/Chiqim';
import Tovarlar from './pages/Tovarlar';
import TovarlarniQaytarish from './pages/TovarlarniQaytarish';
import Qaytarilganlar from './pages/Qaytarilganlar';
import TovarlarRoyxati from './pages/TovarlarRoyxati';
import Hisobotlar from './pages/Hisobotlar';
import Customers from './pages/Customers';
import Logout from '../Chiqish/logout';

// AuthContext
export const AuthContext = React.createContext({
  token: null,
  setToken: () => {},
});

// ErrorBoundary
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="text-center py-16">
          <h3 className="text-lg font-semibold text-red-600">Xatolik yuz berdi</h3>
          <p className="text-slate-500">Iltimos, sahifani qayta yuklang yoki administrator bilan bog'laning.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

function SkladPanel() {
  const [token, setToken] = useState(localStorage.getItem('access_token') || 'mock-token');
  const [activeTab, setActiveTab] = useState('chiqim');
  const [currentTime, setCurrentTime] = useState(
    new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })
  );
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState(() => localStorage.getItem('branchId') || '');
  const [branches, setBranches] = useState([]);
  const [error, setError] = useState(null);
  const [userName, setUserName] = useState('Test User');
  const [exchangeRate, setExchangeRate] = useState(0);
  const [exchangeRateLoading, setExchangeRateLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  const navigation = [
    { id: 'chiqim', name: 'Чиким', icon: TrendingUp, path: '/sklad/chiqim' },
    { id: 'tovarlar', name: 'Товарлар', icon: TrendingDown, path: '/sklad/tovarlar' },   // 🔥 yangi qo‘shildi
    { id: 'tovarlarroyxati', name: "Товарлар Руйхати", icon: Box, path: '/sklad/tovarlarroyxati' },
    { id: 'tovarlarniqaytarish', name: 'Товарларни қайтариш', icon: TrendingDown, path: '/sklad/tovarlarniqaytarish' },
    { id: 'qaytarilganlar', name: 'Қайтарилганлар', icon: TrendingDown, path: '/sklad/qaytarilganlar' },
    { id: 'hisobotlar', name: 'Хисоботлар', icon: BarChart3, path: '/sklad/hisobotlar' },
    { id: 'customers', name: 'Кредит', icon: Users, path: '/sklad/customers' },
  ];


  useEffect(() => {
    const currentPath = location.pathname;
    const activeNav = navigation.find((item) => item.path === currentPath);
    if (activeNav) {
      setActiveTab(activeNav.id);
    } else if (currentPath === '/sklad' || currentPath === '/sklad/') {
      setActiveTab('chiqim');
      navigate('/sklad/chiqim', { replace: true });
    }

    const user = localStorage.getItem('user');
    if (user) {
      try {
        const parsedUser = JSON.parse(user);
        setUserName(parsedUser.name || parsedUser.firstName || 'User');
      } catch (e) {
        setUserName('User');
      }
    }

    const fetchBranches = async () => {
      try {
        console.log('Fetching branches with token:', token ? 'Token exists' : 'No token');
        const response = await fetch('https://suddocs.uz/branches', {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
        console.log('Branches response status:', response.status);
        if (!response.ok) throw new Error(`Failed to fetch branches: ${response.status}`);
        const data = await response.json();
        console.log('Branches data:', data);
        const branchesArray = Array.isArray(data) ? data : (data.branches || []);
        setBranches(branchesArray);
        setError(null);
      } catch (err) {
        console.error('Error fetching branches:', err);
        setBranches([]);
        setError(err.message || 'Failed to fetch branches');
      }
    };

    fetchBranches();

    // fetch latest immediately
    fetchExchangeRate();

    // no localStorage syncing for exchange rate; rely on API fetches

    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }));
    }, 1000);

    const onVisibility = () => {
      if (!document.hidden) fetchExchangeRate();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(timer);
      // nothing else to cleanup
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [selectedBranchId, token, location.pathname, navigate]);



  const handleLogoutConfirm = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('branchId');
    localStorage.removeItem('user');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userId');
    setToken(null);
    setActiveTab('chiqim');
    setShowLogoutModal(false);
    navigate('/sklad');
  };

  const handleLogoutCancel = () => {
    setShowLogoutModal(false);
  };

  const fetchExchangeRate = async () => {
    try {
      setExchangeRateLoading(true);
      const token = localStorage.getItem('access_token');
      if (token) {
        // Try current-rate endpoint first
        const resp = await fetch('https://suddocs.uz/currency-exchange-rates/current-rate?fromCurrency=USD&toCurrency=UZS', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (resp.ok) {
          const data = await resp.json();
          if (data && data.rate) {
            setExchangeRate(Number(data.rate));
          } else {
            throw new Error('No rate in current-rate response');
          }
        } else {
          throw new Error('current-rate failed');
        }
      }
    } catch (e) {
      // Fallback to list endpoint
      try {
        const token = localStorage.getItem('access_token');
        if (token) {
          const listResp = await fetch('https://suddocs.uz/currency-exchange-rates', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (listResp.ok) {
            const arr = await listResp.json();
            const list = Array.isArray(arr) ? arr : [];
            const active = list.find(r => r.isActive && r.fromCurrency === 'USD' && r.toCurrency === 'UZS');
            const rate = Number(active?.rate ?? list[0]?.rate) || 0;
            if (rate > 0) setExchangeRate(rate);
          }
        }
      } catch {}
    } finally {
      setExchangeRateLoading(false);
    }
  };



  const handleNavigation = (item) => {
    setActiveTab(item.id);
    setSidebarOpen(false);
    navigate(item.path);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'chiqim':
        return <Chiqim selectedBranchId={selectedBranchId} exchangeRate={exchangeRate} />;
      case 'tovarlar':
        return <Tovarlar selectedBranchId={selectedBranchId} />;   // 🔥 yangi qo‘shildi
      case 'tovarlarroyxati':
        return <TovarlarRoyxati selectedBranchId={selectedBranchId} />;
      case 'tovarlarniqaytarish':
        return <TovarlarniQaytarish selectedBranchId={selectedBranchId} />;
      case 'qaytarilganlar':
        return <Qaytarilganlar selectedBranchId={selectedBranchId} />;
      case 'hisobotlar':
        return <Hisobotlar selectedBranchId={selectedBranchId} />;
      case 'customers':
        return <Customers selectedBranchId={selectedBranchId} />;
      default:
        return <Chiqim selectedBranchId={selectedBranchId} />;
    }
  };


  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const userNamee = user.fullName || user.name || user.username || 'User';
  const userRole = localStorage.getItem('userRole') || 'Warehouse';
  const initials = userName.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <AuthContext.Provider value={{ token, setToken }}>
      <div className="flex h-screen bg-gray-50 w-full">
        <div
          className={`${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
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
              style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)',position:'absolute',top:'10px',right:'10px' }}
            >
              <X size={20} />
            </button>
            <hr className="my-2" />
            <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
              <img style={{borderRadius:"50%",width:'60px'}} src="/AminovHolding.jpg" alt="" />
              <div>
              <h1 className="text-xl font-bold text-white">Аминов</h1>
              <p className="text-sm text-gray-400">Склад тизими</p>
              </div>
            </div>
            {error && <span className="mt-2 text-red-500 text-sm">{error}</span>}
          </div>

          <nav className="flex-1 p-3 lg:p-4">
            <ul className="space-y-2">
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => handleNavigation(item)}
                      className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-all duration-200 ${
                        isActive
                          ? 'bg-gradient-to-r from-[#1178f8]/20 to-[#1178f8]/10 text-[#1178f8] border border-[#1178f8]/30 shadow-lg shadow-[#1178f8]/20'
                          : 'text-gray-300 hover:bg-white/5 hover:text-white hover:shadow-md'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="font-medium">{item.name}</span>
                    </button>
                  </li>
                );
              })}
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
                <div className="flex items-center gap-2">
                  {selectedBranchId && (
                    <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                      {branches.find(b => b.id.toString() === selectedBranchId)?.name || 'Filial'}
                    </span>
                  )}
                </div>
                {error && (
                  <span className="ml-2 text-red-500 text-sm">{error}</span>
                )}
              </div>

              <div className="flex items-center space-x-4 w-full justify-end lg:w-auto">
                <div className="text-right mr-4">
                  <div className="text-sm text-gray-600">Valyuta kursi:</div>
                  <div className="text-lg font-semibold text-blue-600 flex items-center gap-2 justify-end">
                    1 USD = {exchangeRate.toLocaleString('uz-UZ')} so'm
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
                        {userNamee}
                      </p>
                      <p className="text-xxs text-gray-600">
                        {userRole === "WAREHOUSE" ? "Sklad" : userRole || "Sklad"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 lg:p-6 w-full">
            <div className="w-full h-full min-h-0">
              {error && <div className="text-red-600 mb-4">{error}</div>}
              <ErrorBoundary>
                {renderContent()}
              </ErrorBoundary>
            </div>
          </main>
        </div>

        {showLogoutModal && (
          <Logout onConfirm={handleLogoutConfirm} onCancel={handleLogoutCancel} />
        )}
      </div>
    </AuthContext.Provider>
  );
}

export default SkladPanel;