import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Home, TrendingUp, TrendingDown, BarChart3, Box, Settings, LogOut, Bell, Users } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Chiqim from './pages/Chiqim';
import Tovarlar from './pages/Tovarlar';
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
  const [activeTab, setActiveTab] = useState('dashboard');
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
    { id: 'dashboard', name: 'Dashboard', icon: Home, path: '/sklad/dashboard' },
    { id: 'tovarlar', name: 'Kirim', icon: TrendingUp, path: '/sklad/tovarlar' },
    { id: 'chiqim', name: 'Chiqim', icon: TrendingDown, path: '/sklad/chiqim' },
    { id: 'tovarlarroyxati', name: "Tovarlar Ro'yxati", icon: Box, path: '/sklad/tovarlarroyxati' },
    { id: 'hisobotlar', name: 'Hisobotlar', icon: BarChart3, path: '/sklad/hisobotlar' },
    { id: 'customers', name: 'Mijozlar', icon: Users, path: '/sklad/customers' },
  ];

  useEffect(() => {
    // Set activeTab based on the current URL path
    const currentPath = location.pathname;
    const activeNav = navigation.find((item) => item.path === currentPath);
    if (activeNav) {
      setActiveTab(activeNav.id);
    } else if (currentPath === '/sklad' || currentPath === '/sklad/') {
      setActiveTab('dashboard');
      navigate('/sklad/dashboard', { replace: true });
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
    setActiveTab('dashboard');
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
      case 'dashboard':
        return <Dashboard selectedBranchId={selectedBranchId} />;
      case 'chiqim':
        return <Chiqim selectedBranchId={selectedBranchId} />;
      case 'tovarlar':
        return <Tovarlar selectedBranchId={selectedBranchId} />;
      case 'tovarlarroyxati':
        return <TovarlarRoyxati selectedBranchId={selectedBranchId} />;
      case 'hisobotlar':
        return <Hisobotlar selectedBranchId={selectedBranchId} />;
      case 'customers':
        return <Customers selectedBranchId={selectedBranchId} />;
      default:
        return <Dashboard selectedBranchId={selectedBranchId} />;
    }
  };

  return (
    <AuthContext.Provider value={{ token, setToken }}>
      <div className="flex min-h-screen bg-gray-100">
        <div className="fixed top-0 left-0 h-full w-64 bg-white shadow-md z-50">
          <div className="flex items-center p-4 border-b">
            <div className="flex items-center space-x-2">
              <Settings className="w-6 h-6 text-blue-600" />
              <div>
                <h1 className="text-lg font-semibold">Men Texnika</h1>
                <p className="text-xs text-gray-600">Sklad Tizimi</p>
              </div>
            </div>
          </div>

          <nav className="mt-4 px-4 space-y-2">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavigation(item)}
                  className={`w-full flex items-center space-x-3 p-2 rounded ${
                    activeTab === item.id ? 'bg-blue-100 text-blue-600' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.name}</span>
                </button>
              );
            })}
          </nav>

          <div className="absolute bottom-4 left-4 right-4">
            <button
              onClick={() => setShowLogoutModal(true)}
              className="w-full flex items-center space-x-3 p-2 text-red-600 hover:bg-red-50 rounded"
            >
              <LogOut className="w-5 h-5" />
              <span>Chiqish</span>
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
                <select
                  value={selectedBranchId}
                  onChange={handleBranchChange}
                  className="border rounded p-2"
                >
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
                <span>{userName}</span>
                <span>{currentTime}</span>
              </div>
              <Bell className="w-6 h-6 text-gray-600" />
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