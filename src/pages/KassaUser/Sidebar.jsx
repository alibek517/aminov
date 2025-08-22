import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { BarChart3, ShoppingCart, AlertTriangle, Package, LogOut, Users, Ban } from 'lucide-react';
import Logout from '../Chiqish/logout'; 

const Sidebar = ({ token, socket, locationPermission, locationError }) => {
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState(() => {
    return localStorage.getItem('selectedBranchId') || '';
  });
  const [branches, setBranches] = useState([{ id: '', name: 'Барча филиаллар' }]);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const menuItems = [
    { id: 'dashboard', label: 'Бошқарув панели', icon: BarChart3, path: '/kasir/dashboard' },
    { id: 'sales', label: 'Сотиш', icon: ShoppingCart, path: '/kasir/sales' },
    { id: 'defective', label: 'Брак/Қайтариш', icon: AlertTriangle, path: '/kasir/defective' },
    { id: 'braklar', label: 'Брак махсулотлар', icon: Ban, path: '/kasir/braks' },  
    { id: 'mijozlar', label: 'Мижозлар', icon: Users, path: '/kasir/mijozlar' },
    { id: 'sotuvchilar', label: 'Сотувчилар моаши', icon: Users, path: '/kasir/sotuvchilar' },
  ];

  // Fetch branches from API
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

  // Get user data from localStorage
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const userName = user.fullName || user.name || user.username || 'Фойдаланувчи';
  const userRole = localStorage.getItem('userRole') || 'Кассир';
  const initials = userName
    .split(' ')
    .map(word => word.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
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
            <p className="text-sm text-gray-400">Савдо тизими</p>
          </div>
        
        {error && <span className="mt-2 text-red-500 text-sm">{error}</span>}
        {locationError && (
          <span className="mt-2 text-red-500 text-sm">
            <strong>Геолокация хатоси:</strong> {locationError}
          </span>
        )}
      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {menuItems.map((item) => (
            <li key={item.id}>
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  `w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-all duration-200 ${
                    isActive
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

      <div className="p-4">
        <div className="flex items-center space-x-3 mb-3">
          <div className="w-10 h-10 bg-gradient-to-br from-[#1178f8] to-[#0f5cb8] rounded-full flex items-center justify-center shadow-lg">
            <span className="text-sm font-medium text-white">{initials}</span>
          </div>
          <div>
            <p className="text-sm font-medium text-white">{userName}</p>
            <p className="text-xs text-gray-400">{userRole === 'CASHIER' ? 'Кассир' : userRole || 'Кассир'}</p>
          </div>
        </div>
        
        <button
          onClick={() => setShowLogoutModal(true)}
          className="w-full flex items-center space-x-3 px-4 py-2 text-gray-300 hover:bg-red-500/10 hover:text-red-400 rounded-lg transition-all duration-200 hover:border-red-500/20 border border-transparent"
        >
          <LogOut className="w-4 h-4" />
          <span className="text-sm">Чиқиш</span>
        </button>
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