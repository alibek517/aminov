import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { TrendingDown, BarChart3, Box, Settings, LogOut, Bell, Users } from 'lucide-react';
import Chiqim from './pages/Chiqim';
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
  const [selectedBranchId, setSelectedBranchId] = useState(() => localStorage.getItem('selectedBranchId') || '');
  const [branches, setBranches] = useState([{ id: '', name: 'Барча филиаллар' }]);
  const [error, setError] = useState(null);
  const [userName, setUserName] = useState('Test User');

  const navigate = useNavigate();
  const location = useLocation();

  const navigation = [
    { id: 'chiqim', name: 'Чиким', icon: TrendingDown, path: '/sklad/chiqim' },
    { id: 'tovarlarroyxati', name: "Товарлар Руйхати", icon: Box, path: '/sklad/tovarlarroyxati' },
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
        const response = await fetch('https://suddocs.uz/branches', {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
        if (!response.ok) throw new Error('Failed to fetch branches');
        const data = await response.json();
        setBranches([{ id: '', name: 'Барча филиаллар' }, ... (Array.isArray(data) ? data : data.branches || [])]);  // Safe extraction
      } catch (err) {
        setBranches([
          { id: '', name: 'Барча филиаллар' },
          { id: '1', name: 'Main Branch' },
          { id: '2', name: 'Branch 2' },
        ]);
        setError(err.message || 'Failed to fetch branches');
      }
    };

    fetchBranches();

    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }));
    }, 1000);

    return () => clearInterval(timer);
  }, [selectedBranchId, token, location.pathname, navigate]);

  useEffect(() => {
    localStorage.setItem('selectedBranchId', selectedBranchId);
  }, [selectedBranchId]);

  const handleLogoutConfirm = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('selectedBranchId');
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

  const handleBranchChange = (e) => {
    setSelectedBranchId(e.target.value);
    // No navigation; content re-renders with new selectedBranchId
  };

  const handleNavigation = (item) => {
    setActiveTab(item.id);
    navigate(item.path);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'chiqim':
        return <Chiqim selectedBranchId={selectedBranchId} />;
      case 'tovarlarroyxati':
        return <TovarlarRoyxati selectedBranchId={selectedBranchId} />;
      case 'hisobotlar':
        return <Hisobotlar selectedBranchId={selectedBranchId} />;
      case 'customers':
        return <Customers selectedBranchId={selectedBranchId} />;
      default:
        return <Chiqim selectedBranchId={selectedBranchId} />;
    }
  };

  return (
    <AuthContext.Provider value={{ token, setToken }}>
      <div className="flex min-h-screen bg-gray-100">
        <div 
          style={{backgroundColor: '#00020F'}} 
          className="w-64 min-h-screen flex flex-col fixed top-0 left-0 h-full z-50 text-white"
        >
          <div className="p-6">
            <img 
              src="/Baner_Zippy.png" 
              alt="Zippy логотипи" 
              className="object-contain filter brightness-110 contrast-110 transition-all duration-300 hover:scale-105 hover:brightness-125" 
            />
            <hr className="my-2" />
            <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
              <h1 className="text-xl font-bold text-white">Аминов</h1>
              <p className="text-sm text-gray-400">Склад тизими</p>
            </div>
            {error && <span className="mt-2 text-red-500 text-sm">{error}</span>}
          </div>

          <nav className="flex-1 p-4">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavigation(item)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-all duration-200 ${
                    activeTab === item.id
                      ? 'bg-gradient-to-r from-[#1178f8]/20 to-[#1178f8]/10 text-[#1178f8] border border-[#1178f8]/30 shadow-lg shadow-[#1178f8]/20'
                      : 'text-gray-300 hover:bg-white/5 hover:text-white hover:shadow-md'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.name}</span>
                </button>
              );
            })}
          </nav>

          <div className="p-4">
            <button
              onClick={() => setShowLogoutModal(true)}
              className="w-full flex items-center space-x-3 px-4 py-2 text-gray-300 hover:bg-red-500/10 hover:text-red-400 rounded-lg transition-all duration-200 hover:border-red-500/20 border border-transparent"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm">Чиқиш</span>
            </button>
          </div>
        </div>

        {showLogoutModal && (
          <Logout onConfirm={handleLogoutConfirm} onCancel={handleLogoutCancel} />
        )}

        <div className="flex-1 flex flex-col ml-64">
          <header className="bg-white shadow-sm">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center space-x-4">
                
                <span>Foydalanuvchi nomi: {userName}</span>
              </div>
                <span>{currentTime}</span>
            </div>
          </header>

          <main className="flex-1 p-6">
            {error && <div className="text-red-600 mb-4">{error}</div>}  {/* Display branch fetch errors */}
            <ErrorBoundary>
              {renderContent()}
            </ErrorBoundary>
          </main>
        </div>
      </div>
    </AuthContext.Provider>
  );
}

export default SkladPanel;