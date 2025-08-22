// DeliveryPanel.jsx
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Routes, Route, Navigate } from 'react-router-dom';
import io from 'socket.io-client';
import { MapPin, Package, User, Settings as SettingsIcon } from 'lucide-react';
import Dashboard from './components/Dashboard';
import Orders from './components/Orders';
import Profile from './components/Profile';
import Settings from './components/Settings';
import { translations } from './utils/translations';

function DeliveryPanel({ token }) {
  const [language, setLanguage] = useState('uz-latn');
  const [location, setLocation] = useState(null); // Stores { latitude, longitude, address }
  const [isAvailable, setIsAvailable] = useState(true);
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState('');
  const [userId, setUserId] = useState(null);
  const [orders, setOrders] = useState([
    {
      id: 1,
      customer: 'Alisher Karimov',
      phone: '+998901234567',
      address: 'Toshkent sh., Yunusobod t., 12-uy',
      product: 'Samsung Galaxy S24',
      price: '12,000,000',
      status: 'pending',
      time: '10:30',
      distance: '2.5 km',
    },
    {
      id: 2,
      customer: 'Malika Tosheva',
      phone: '+998909876543',
      address: 'Toshkent sh., Chilonzor t., 5-uy',
      product: 'iPhone 15 Pro',
      price: '18,500,000',
      status: 'assigned',
      time: '11:45',
      distance: '4.2 km',
    },
    {
      id: 3,
      customer: 'Bobur Rahimov',
      phone: '+998901111111',
      address: 'Toshkent sh., Sergeli t., 8-uy',
      product: 'MacBook Air M2',
      price: '15,000,000',
      status: 'pending',
      time: '14:20',
      distance: '1.8 km',
    },
  ]);

  const t = translations[language];
  const navigate = useNavigate();
  const locationPath = useLocation();

  // Determine active tab from the current route
  const getActiveTab = () => {
    const path = locationPath.pathname.split('/').pop() || 'dashboard';
    return ['dashboard', 'orders', 'profile', 'settings'].includes(path) ? path : 'dashboard';
  };

  const activeTab = getActiveTab();

  useEffect(() => {
    if (!token) {
      setError(t.noTokenError || 'Iltimos, amal qiluvchi JWT token taqdim eting');
      console.error('No token provided');
      return;
    }

    const userData = JSON.parse(localStorage.getItem('user') || '{}');
    const id = localStorage.getItem('userId');
    setUserId(id);

    const socketIo = io('https://suddocs.uz/', {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      secure: true,
    });

    socketIo.on('connect', () => {
      setIsConnected(true);
      setError('');
      console.log('Socket.IO connected for AUDITOR, userId:', id);
      if (id) updateLocation(socketIo, id);
    });

    socketIo.on('connect_error', (err) => {
      setError(`${t.connectionError || 'Ulanish muvaffaqiyatsiz'}: ${err.message}`);
      setIsConnected(false);
      console.error('Socket.IO connect error:', err);
    });

    socketIo.on('error', (data) => {
      setError(data.message || t.serverError || 'Serverda xato yuz berdi');
      console.error('Socket.IO error:', data);
    });

    socketIo.on('locationUpdateConfirmed', (data) => {
      console.log('Location update confirmed:', data);
      // Validate location data before updating state
      if (
        data?.location &&
        typeof data.location.latitude === 'number' &&
        typeof data.location.longitude === 'number'
      ) {
        setLocation({
          latitude: data.location.latitude,
          longitude: data.location.longitude,
          address: data.location.address || 'Unknown',
        });
      } else {
        console.error('Invalid location data received:', data);
        setError(t.invalidLocationData || 'Noto‘g‘ri joylashuv ma‘lumotlari olindi');
      }
    });

    setSocket(socketIo);

    const interval = setInterval(() => {
      if (isConnected && id) {
        updateLocation(socketIo, id);
      }
    }, 300000);

    return () => {
      socketIo.disconnect();
      console.log('Socket.IO disconnected');
      clearInterval(interval);
    };
  }, [token, isConnected, t]);

  const updateLocation = async (socket, userId) => {
    if (!userId) {
      console.error('No userId available for location update');
      setError(t.noUserIdError || 'Foydalanuvchi ID topilmadi');
      return;
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          const address = await getAddress(latitude, longitude);
          const newLocation = { latitude, longitude, address };
          socket.emit('updateLocation', {
            userId,
            latitude,
            longitude,
            address,
            isOnline: true,
          });
          console.log('Sent periodic location:', { userId, latitude, longitude, address });
          setLocation(newLocation);
        },
        (error) => {
          console.error('Geolocation error:', error);
          const fallbackLocation = {
            latitude: 41.3111,
            longitude: 69.2797,
            address: 'Unknown',
          };
          socket.emit('updateLocation', {
            userId,
            latitude: fallbackLocation.latitude,
            longitude: fallbackLocation.longitude,
            address: fallbackLocation.address,
            isOnline: true,
          });
          console.log('Sent fallback location for user:', userId);
          setLocation(fallbackLocation);
          setError(t.geolocationError || 'Joylashuvni olishda xato yuz berdi. Standart joylashuv ishlatildi.');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      console.error('Geolocation not supported');
      const fallbackLocation = {
        latitude: 41.3111,
        longitude: 69.2797,
        address: 'Unknown',
      };
      socket.emit('updateLocation', {
        userId,
        latitude: fallbackLocation.latitude,
        longitude: fallbackLocation.longitude,
        address: fallbackLocation.address,
        isOnline: true,
      });
      console.log('Sent fallback location for user:', userId);
      setLocation(fallbackLocation);
      setError(t.geolocationNotSupported || 'Brauzer joylashuvni qo‘llab-quvvatlamaydi.');
    }
  };

  const getAddress = async (latitude, longitude) => {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=YOUR_GOOGLE_MAPS_API_KEY`
      );
      const data = await response.json();
      return data.results[0]?.formatted_address || 'Unknown';
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      return 'Unknown';
    }
  };

  const handleTabChange = (tab) => {
    navigate(`/dastafka/${tab}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Package className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold text-gray-900">TechCourier</h1>
            </div>
            <div className="flex items-center space-x-2">
              <div
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  isAvailable ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}
              >
                {isAvailable ? t.available : t.busy}
              </div>
            </div>
          </div>
          <div className="mt-2">
            <p className={isConnected ? 'text-green-500' : 'text-red-500'}>
              {t.connection}: {isConnected ? t.connected : t.disconnected}
            </p>
            {error && <p className="text-red-500">{error}</p>}
            <p className="text-blue-500">{t.userId}: {userId || 'N/A'}</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-md mx-auto pb-20">
        <Routes>
          <Route
            path="/dashboard"
            element={
              <Dashboard
                t={t}
                location={location}
                isAvailable={isAvailable}
                setIsAvailable={setIsAvailable}
                orders={orders}
              />
            }
          />
          <Route path="/orders" element={<Orders t={t} orders={orders} setOrders={setOrders} />} />
          <Route path="/profile" element={<Profile t={t} />} />
          <Route path="*" element={<Navigate to="/dastafka/dashboard" replace />} />
        </Routes>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
        <div className="max-w-md mx-auto px-4">
          <div className="flex items-center justify-around py-2">
            <button
              onClick={() => handleTabChange('dashboard')}
              className={`flex flex-col items-center justify-center py-2 px-4 rounded-lg transition-colors ${
                activeTab === 'dashboard' ? 'text-blue-600 bg-blue-50' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <MapPin className="w-5 h-5" />
              <span className="text-xs mt-1">{t.dashboard}</span>
            </button>
            <button
              onClick={() => handleTabChange('orders')}
              className={`flex flex-col items-center justify-center py-2 px-4 rounded-lg transition-colors ${
                activeTab === 'orders' ? 'text-blue-600 bg-blue-50' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Package className="w-5 h-5" />
              <span className="text-xs mt-1">{t.orders}</span>
            </button>
            <button
              onClick={() => handleTabChange('profile')}
              className={`flex flex-col items-center justify-center py-2 px-4 rounded-lg transition-colors ${
                activeTab === 'profile' ? 'text-blue-600 bg-blue-50' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <User className="w-5 h-5" />
              <span className="text-xs mt-1">{t.profile}</span>
            </button>
            <button
              onClick={() => handleTabChange('settings')}
              className={`flex flex-col items-center justify-center py-2 px-4 rounded-lg transition-colors ${
                activeTab === 'settings' ? 'text-blue-600 bg-blue-50' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <SettingsIcon className="w-5 h-5" />
              <span className="text-xs mt-1">{t.settings}</span>
            </button>
          </div>
        </div>
      </nav>
    </div>
  );
}

export default DeliveryPanel;