import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { MapPin, Users, RefreshCw, Eye, X, Navigation } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import io from 'socket.io-client';
import 'leaflet/dist/leaflet.css';
import './LocationApp.css';

// Leaflet marker icon setup
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const containerStyle = {
  width: '100%',
  height: '600px',
  borderRadius: '12px',
  border: '1px solid #e5e7eb',
  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
};

// Component to handle map bounds and smooth panning
const MapBounds = ({ locations, userLocation, followUser, userId }) => {
  const map = useMap();
  useEffect(() => {
    if (followUser && userLocation && !isTashkentLocation(userLocation.latitude, userLocation.longitude)) {
      map.flyTo([userLocation.latitude, userLocation.longitude], 16, { animate: true, duration: 0.5 });
    } else if (locations.length > 0 || userLocation) {
      const validLocations = [
        ...(userLocation && !isTashkentLocation(userLocation.latitude, userLocation.longitude)
          ? [{ latitude: userLocation.latitude, longitude: userLocation.longitude }]
          : []),
        ...locations.filter(
          (loc) => loc.latitude && loc.longitude && !isTashkentLocation(loc.latitude, loc.longitude)
        ),
      ];
      if (validLocations.length > 0) {
        const bounds = L.latLngBounds(validLocations.map((loc) => [loc.latitude, loc.longitude]));
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16, animate: true });
      } else {
        map.setView([41.8349, 60.3888], 12, { animate: true }); // Default to Gurlan
      }
    }
  }, [locations, userLocation, followUser, map]);
  return null;
};

// Helper function to check for Tashkent default coordinates
const isTashkentLocation = (latitude, longitude) => {
  return (
    (Math.abs(latitude - 41.3111) < 0.01 && Math.abs(longitude - 69.2797) < 0.01) ||
    (Math.abs(latitude - 41.2995) < 0.01 && Math.abs(longitude - 69.2401) < 0.01)
  );
};

const LocationApp = ({ token, selectedBranchId }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState('');
  const [userRole, setUserRole] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [adminLocations, setAdminLocations] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDeliverer, setSelectedDeliverer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [mapView, setMapView] = useState(true);
  const [userLocation, setUserLocation] = useState(null);
  const [lastValidLocation, setLastValidLocation] = useState(null);
  const [userId, setUserId] = useState(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [followUser, setFollowUser] = useState(false);
  const markerRefs = useRef({});

  // Check geolocation permission
  const checkGeolocationPermission = async () => {
    if (!navigator.permissions) {
      console.warn('Permissions API not supported');
      return 'unknown';
    }
    try {
      const result = await navigator.permissions.query({ name: 'geolocation' });
      return result.state;
    } catch (err) {
      console.error('Error checking geolocation permission:', err);
      return 'unknown';
    }
  };

  // Get geolocation with retry logic
  const getGeolocation = useCallback((retries = 7, timeout = 15000) => {
    return new Promise((resolve, reject) => {
      let attempts = 0;

      const tryGetLocation = () => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude, accuracy } = position.coords;
            console.log('Geolocation success:', { latitude, longitude, accuracy });
            if (accuracy > 100) {
              console.warn(`Low geolocation accuracy: ${accuracy} meters`);
              setError('Geolokatsiya aniqligi past, iltimos, GPS yoqing yoki tashqarida urinib ko‘ring.');
              setShowToast(true);
              reject(new Error('Low geolocation accuracy'));
              return;
            }
            if (isTashkentLocation(latitude, longitude)) {
              console.warn('Received default Tashkent coordinates, ignoring...');
              setError('Standart Toshkent koordinatalari, iltimos, qayta urining.');
              setShowToast(true);
              reject(new Error('Default Tashkent coordinates'));
              return;
            }
            resolve({ latitude, longitude });
          },
          (err) => {
            attempts++;
            console.error(`Geolocation attempt ${attempts} failed:`, err);
            if (err.code === 1) {
              setPermissionDenied(true);
              setError('Geolokatsiya ruxsati rad etildi. Iltimos, sozlamalardan ruxsat bering.');
              setShowToast(true);
              reject(new Error('Permission denied'));
            } else if (err.code === 3 && attempts < retries) {
              console.log(`Retrying geolocation, attempt ${attempts + 1}/${retries}`);
              setTimeout(tryGetLocation, 2000);
            } else {
              setError(`Geolokatsiya olishda xato: ${err.message}. Oxirgi joylashuv ishlatilmoqda.`);
              setShowToast(true);
              reject(err);
            }
          },
          { enableHighAccuracy: true, timeout, maximumAge: 1000 }
        );
      };

      tryGetLocation();
    });
  }, []);

  // Manual retry for geolocation
  const retryGeolocation = async () => {
    setLoading(true);
    setError('');
    setShowToast(false);
    try {
      const { latitude, longitude } = await getGeolocation(7, 15000);
      setUserLocation({ latitude, longitude });
      setLastValidLocation({ latitude, longitude });
      setPermissionDenied(false);
      console.log('Manual geolocation retry successful:', { latitude, longitude });
      setError('Joylashuv muvaffaqiyatli yangilandi!');
      setShowToast(true);
    } catch (err) {
      setError('Geolokatsiya olishda xato yuz berdi. Iltimos, qayta urinib ko‘ring yoki GPS yoqing.');
      setShowToast(true);
      console.error('Manual geolocation retry failed:', err);
      if (lastValidLocation) {
        setUserLocation(lastValidLocation);
      }
    } finally {
      setLoading(false);
    }
  };

  // Refresh data
  const refreshData = useCallback(() => {
    if (!socket || !isConnected) return;

    setLoading(true);
    console.log('Manually refreshing data...');
    const branchIdNum = selectedBranchId ? parseInt(selectedBranchId, 10) : undefined;
    if (userRole === 'ADMIN') {
      socket.emit('requestAllLocations');
      socket.emit('getAllOnlineUsers', { branchId: isNaN(branchIdNum) ? undefined : branchIdNum });
    } else {
      socket.emit('getAllOnlineUsers', { branchId: isNaN(branchIdNum) ? undefined : branchIdNum });
    }
    setTimeout(() => setLoading(false), 2000);
  }, [socket, isConnected, userRole, selectedBranchId]);

  // Geolocation watch for real-time movement
  useEffect(() => {
    let watchId;

    const startGeolocation = async () => {
      if (!navigator.geolocation) {
        setError('Brauzer geolokatsiyani qo‘llab-quvvatlamaydi.');
        setShowToast(true);
        console.error('Geolocation not supported by browser');
        return;
      }

      const permissionStatus = await checkGeolocationPermission();
      if (permissionStatus === 'denied') {
        setPermissionDenied(true);
        setError('Geolokatsiya ruxsati rad etildi. Iltimos, sozlamalardan ruxsat bering.');
        setShowToast(true);
        return;
      }

      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          console.log('Geolocation watch success:', { latitude, longitude, accuracy });
          if (accuracy > 100) {
            console.warn(`Low geolocation accuracy: ${accuracy} meters`);
            setError('Geolokatsiya aniqligi past, iltimos, GPS yoqing yoki tashqarida urinib ko‘ring.');
            setShowToast(true);
            return;
          }
          if (isTashkentLocation(latitude, longitude)) {
            console.warn('Received default Tashkent coordinates, ignoring...');
            setError('Standart Toshkent koordinatalari, iltimos, qayta urining.');
            setShowToast(true);
            return;
          }
          setUserLocation({ latitude, longitude });
          setLastValidLocation({ latitude, longitude });
          setPermissionDenied(false);

          // Update user marker with smooth transition
          if (markerRefs.current[userId]) {
            markerRefs.current[userId].setLatLng([latitude, longitude]);
            // Trigger pulse animation
            const markerElement = markerRefs.current[userId].getElement();
            if (markerElement) {
              markerElement.classList.remove('pulse');
              void markerElement.offsetWidth; // Force reflow
              markerElement.classList.add('pulse');
            }
          }
        },
        (err) => {
          console.error('Geolocation watch error:', err);
          if (err.code === 1) {
            setPermissionDenied(true);
            setError('Geolokatsiya ruxsati rad etildi. Iltimos, sozlamalardan ruxsat bering.');
          } else if (err.code === 3) {
            setError('Geolokatsiya vaqtinchalik ishlamadi. Oxirgi joylashuv ishlatilmoqda.');
            if (lastValidLocation) {
              setUserLocation(lastValidLocation);
            }
          } else {
            setError(`Geolokatsiya olishda xato: ${err.message}`);
          }
          setShowToast(true);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 1000 }
      );
    };

    startGeolocation();

    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [lastValidLocation, userId]);

  // Socket connection
  useEffect(() => {
    if (!token) {
      setError('Iltimos, amal qiluvchi JWT token taqdim eting.');
      setShowToast(true);
      console.error('No token provided');
      return;
    }

    console.log('Initializing socket connection...');
    const socketIo = io('https://suddocs.uz/', {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      secure: true,
      timeout: 30000,
    });

    socketIo.on('connect', () => {
      setIsConnected(true);
      setError('');
      setShowToast(false);
      setLastUpdated(new Date());
      console.log('Socket.IO connected successfully');

      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUserRole(payload.role);
        setUserId(payload.sub);
        console.log('User role set:', payload.role, 'User ID:', payload.sub);
      } catch (err) {
        setError('Token formati noto‘g‘ri.');
        setShowToast(true);
        console.error('Token decode error:', err);
      }
    });

    socketIo.on('disconnect', (reason) => {
      setIsConnected(false);
      console.log('Socket.IO disconnected:', reason);
      setError(`Ulanish uzildi: ${reason}`);
      setShowToast(true);
    });

    socketIo.on('connect_error', (err) => {
      setError(`Ulanish muvaffaqiyatsiz: ${err.message}`);
      setShowToast(true);
      setIsConnected(false);
      console.error('Socket.IO connect error:', err);
    });

    socketIo.on('error', (data) => {
      const errorMsg = data.message || 'Serverda xato yuz berdi.';
      setError(errorMsg);
      setShowToast(true);
      console.error('Socket.IO error:', data);
    });

    socketIo.on('onlineUsersUpdated', (users) => {
      console.log('onlineUsersUpdated received:', users?.length || 0, 'users');
      if (Array.isArray(users)) {
        const filteredUsers = users.filter(
          (user) => user.latitude && user.longitude && user.isOnline && !isTashkentLocation(user.latitude, user.longitude)
        );
        setOnlineUsers(filteredUsers);
        setLastUpdated(new Date());
        console.log('Filtered online users:', filteredUsers.length);
      }
    });

    socketIo.on('onlineUsers', (users) => {
      console.log('onlineUsers received:', users?.length || 0, 'users');
      if (Array.isArray(users)) {
        const filteredUsers = users.filter(
          (user) => user.latitude && user.longitude && user.isOnline && !isTashkentLocation(user.latitude, user.longitude)
        );
        setOnlineUsers(filteredUsers);
        setLastUpdated(new Date());
        console.log('Filtered online users from onlineUsers:', filteredUsers.length);
      }
    });

    socketIo.on('adminAllLocations', (locations) => {
      console.log('adminAllLocations received:', locations?.length || 0, 'locations');
      if (Array.isArray(locations)) {
        const filteredLocations = locations.filter(
          (loc) => loc.latitude && loc.longitude && loc.isOnline && !isTashkentLocation(loc.latitude, loc.longitude)
        );
        setAdminLocations(filteredLocations);
        setLastUpdated(new Date());
        console.log('Filtered admin locations:', filteredLocations.length);
      }
    });

    socketIo.on('adminLocationUpdate', (location) => {
      console.log('adminLocationUpdate received:', location);
      if (location && location.latitude && location.longitude && !isTashkentLocation(location.latitude, location.longitude)) {
        setAdminLocations((prev) => {
          const filtered = prev.filter((loc) => loc.userId !== location.userId);
          return location.isOnline ? [...filtered, location] : filtered;
        });
        setLastUpdated(new Date());

        if (markerRefs.current[location.userId]) {
          markerRefs.current[location.userId].setLatLng([location.latitude, location.longitude]);
          const markerElement = markerRefs.current[location.userId].getElement();
          if (markerElement) {
            markerElement.classList.remove('pulse');
            void markerElement.offsetWidth; // Force reflow
            markerElement.classList.add('pulse');
          }
        }
      }
    });

    socketIo.on('locationUpdated', (location) => {
      console.log('locationUpdated received:', location);
      if (location && location.latitude && location.longitude && !isTashkentLocation(location.latitude, location.longitude)) {
        setOnlineUsers((prev) => {
          const filtered = prev.filter((user) => user.userId !== location.userId);
          return location.isOnline ? [...filtered, location] : filtered;
        });
        setLastUpdated(new Date());

        if (markerRefs.current[location.userId]) {
          markerRefs.current[location.userId].setLatLng([location.latitude, location.longitude]);
          const markerElement = markerRefs.current[location.userId].getElement();
          if (markerElement) {
            markerElement.classList.remove('pulse');
            void markerElement.offsetWidth; // Force reflow
            markerElement.classList.add('pulse');
          }
        }
      }
    });

    setSocket(socketIo);

    return () => {
      console.log('Cleaning up socket connection...');
      socketIo.disconnect();
    };
  }, [token]);

  // Periodic location updates
  useEffect(() => {
    if (socket && isConnected && userLocation && userId && !isTashkentLocation(userLocation.latitude, userLocation.longitude)) {
      const interval = setInterval(() => {
        socket.emit('updateLocation', {
          userId,
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          isOnline: true,
        });
        console.log('Periodic location update sent:', userLocation);
      }, 3000); // Reduced to 3 seconds for faster updates

      return () => clearInterval(interval);
    }
  }, [socket, isConnected, userLocation, userId]);

  // Auto-refresh for admin/users
  useEffect(() => {
    if (userRole === 'ADMIN' && socket && isConnected) {
      console.log('Admin connected, requesting initial data...');
      const branchIdNum = selectedBranchId ? parseInt(selectedBranchId, 10) : undefined;
      setTimeout(() => {
        socket.emit('requestAllLocations');
        socket.emit('getAllOnlineUsers', { branchId: isNaN(branchIdNum) ? undefined : branchIdNum });
      }, 1000);

      const interval = setInterval(() => {
        console.log('Auto-refreshing admin data...');
        socket.emit('requestAllLocations');
        socket.emit('getAllOnlineUsers', { branchId: isNaN(branchIdNum) ? undefined : branchIdNum });
      }, 15000); // Reduced to 15 seconds for faster updates

      return () => clearInterval(interval);
    } else if (socket && isConnected) {
      console.log('Regular user connected, requesting online users...');
      const branchIdNum = selectedBranchId ? parseInt(selectedBranchId, 10) : undefined;
      setTimeout(() => {
        socket.emit('getAllOnlineUsers', { branchId: isNaN(branchIdNum) ? undefined : branchIdNum });
      }, 1000);

      const interval = setInterval(() => {
        console.log('Auto-refreshing user data...');
        socket.emit('getAllOnlineUsers', { branchId: isNaN(branchIdNum) ? undefined : branchIdNum });
      }, 15000);

      return () => clearInterval(interval);
    }
  }, [userRole, socket, isConnected, selectedBranchId]);

  // Toast auto-dismiss
  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => setShowToast(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [showToast]);

  const openModal = (deliverer) => {
    setSelectedDeliverer(deliverer);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedDeliverer(null);
  };

  const toggleFollowUser = () => {
    setFollowUser((prev) => !prev);
  };

  const allLocations = useMemo(() => {
    const combined = [...onlineUsers, ...adminLocations];
    const unique = combined.filter(
      (loc, index, self) =>
        loc.latitude &&
        loc.longitude &&
        loc.isOnline &&
        !isTashkentLocation(loc.latitude, loc.longitude) &&
        index === self.findIndex((l) => l.userId === loc.userId),
    );
    return unique.sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen));
  }, [onlineUsers, adminLocations]);

  const getRoleColor = (role) => {
    switch (role) {
      case 'ADMIN':
        return '#ef4444';
      case 'AUDITOR':
        return '#3b82f6';
      case 'MANAGER':
        return '#8b5cf6';
      case 'CASHIER':
        return '#10b981';
      case 'WAREHOUSE':
        return '#f59e0b';
      default:
        return '#6b7280';
    }
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case 'ADMIN':
        return '👑';
      case 'AUDITOR':
        return '🔍';
      case 'MANAGER':
        return '📊';
      case 'CASHIER':
        return '💰';
      case 'WAREHOUSE':
        return '📦';
      default:
        return '👤';
    }
  };

  const getCustomIcon = (isCurrentUser, role) => {
    const color = isCurrentUser ? '#ff0000' : getRoleColor(role || 'UNKNOWN');
    const size = isCurrentUser ? 32 : 28;
    return new L.DivIcon({
      html: `<div class="marker-icon${isCurrentUser ? ' current-user' : ''}" style="background-color: ${color}; width: ${size}px; height: ${size}px; border-radius: 50%; border: 2px solid #ffffff; display: flex; align-items: center; justify-content: center; color: #ffffff; font-size: ${size * 0.5}px; font-weight: bold; transition: transform 0.3s ease;">${getRoleIcon(role || 'UNKNOWN')}</div>`,
      className: '',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2],
    });
  };

  console.log('Final combined locations:', allLocations.length);

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <MapPin className="w-7 h-7" />
              Online Foydalanuvchilar Geolokatsiyasi
            </h1>
            <p className="text-blue-100 mt-1">Real vaqtda foydalanuvchi joylashuvini kuzatish</p>
          </div>
          {lastUpdated && (
            <span className="text-sm text-blue-100">
              Oxirgi yangilanish: {lastUpdated.toLocaleTimeString('uz-UZ')}
            </span>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6 relative">
        {/* Toast Notification */}
        {showToast && error && (
          <div className="fixed top-4 right-4 bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded-lg shadow-md z-50 animate-slide-in">
            {error}
            {permissionDenied && (
              <p className="mt-2">
                Iltimos, telefon sozlamalarida brauzer uchun geolokatsiya ruxsatini yoqing yoki{' '}
                <button
                  onClick={retryGeolocation}
                  className="underline text-blue-600"
                  disabled={loading}
                >
                  qayta urinib ko‘ring
                </button>.
              </p>
            )}
          </div>
        )}

        {/* Status Bar */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <p className={`font-semibold ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
                {isConnected ? 'Ulangan' : 'Uzilgan'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              <p className="text-blue-600 font-semibold">Rol: {userRole || 'Yuklanmoqda...'}</p>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-purple-600" />
              <p className="text-purple-600 font-semibold">Online: {allLocations.length}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-600">Filial: {selectedBranchId || 'Barcha filiallar'}</span>
            </div>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="mb-6 flex gap-3 flex-wrap">
          <button
            onClick={refreshData}
            disabled={!socket || !isConnected || loading}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-white font-medium transition-all ${
              loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 active:scale-95'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Yuklanmoqda...' : 'Yangilash'}
          </button>
          <button
            onClick={() => setMapView(!mapView)}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-all active:scale-95"
          >
            <MapPin className="w-4 h-4" />
            {mapView ? 'Jadval ko\'rinishi' : 'Xarita ko\'rinishi'}
          </button>
          <button
            onClick={retryGeolocation}
            disabled={loading}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-white font-medium transition-all ${
              loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-yellow-600 hover:bg-yellow-700 active:scale-95'
            }`}
          >
            <MapPin className="w-4 h-4" />
            Joylashuvni qayta olish
          </button>
          <button
            onClick={toggleFollowUser}
            disabled={!userLocation || loading}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-white font-medium transition-all ${
              followUser ? 'bg-orange-600 hover:bg-orange-700' : 'bg-teal-600 hover:bg-teal-700'
            } ${!userLocation || loading ? 'bg-gray-400 cursor-not-allowed' : 'active:scale-95'}`}
          >
            <Navigation className="w-4 h-4" />
            {followUser ? 'Kuzatishni to\'xtatish' : 'Meni kuzatish'}
          </button>
          {userRole === 'ADMIN' && (
            <button
              onClick={() => socket?.emit('requestAllLocations')}
              disabled={!socket || !isConnected}
              className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 disabled:bg-gray-400 transition-all active:scale-95"
            >
              <Users className="w-4 h-4" />
              Admin ma'lumoti
            </button>
          )}
        </div>

        {/* Map or Table View */}
        {mapView ? (
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-600" />
              Xarita ko'rinishi ({allLocations.length} foydalanuvchi)
            </h2>
            {allLocations.length === 0 && !userLocation ? (
              <div className="text-center p-4 bg-gray-100 rounded-lg">
                <p>Hech qanday online foydalanuvchi topilmadi.</p>
              </div>
            ) : (
              <MapContainer
                center={[userLocation?.latitude || 41.8349, userLocation?.longitude || 60.3888]}
                zoom={12}
                style={containerStyle}
                scrollWheelZoom={true}
                zoomControl={false}
                className="leaflet-container"
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <ZoomControl position="topright" />
                <MapBounds locations={allLocations} userLocation={userLocation} followUser={followUser} userId={userId} />
                {allLocations.map((loc) => (
                  <Marker
                    key={loc.userId}
                    position={[loc.latitude, loc.longitude]}
                    icon={getCustomIcon(loc.userId === userId, loc.user?.role)}
                    ref={(ref) => {
                      if (ref) markerRefs.current[loc.userId] = ref;
                    }}
                  >
                    <Popup>
                      <div className="p-3 max-w-xs">
                        <div className="flex items-center gap-3 mb-2">
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center text-white text-lg font-bold"
                            style={{ backgroundColor: getRoleColor(loc.user?.role || 'UNKNOWN') }}
                          >
                            {getRoleIcon(loc.user?.role || 'UNKNOWN')}
                          </div>
                          <div>
                            <p className="font-semibold text-sm">{loc.user?.name || 'Noma\'lum'}</p>
                            <p className="text-xs text-gray-600">{loc.user?.role || 'N/A'}</p>
                          </div>
                        </div>
                        <p className="text-xs">
                          <strong>Kenglik:</strong> {loc.latitude.toFixed(6)}
                        </p>
                        <p className="text-xs">
                          <strong>Uzunlik:</strong> {loc.longitude.toFixed(6)}
                        </p>
                        <p className="text-xs">
                          <strong>Oxirgi ko'rish:</strong> {new Date(loc.lastSeen).toLocaleString('uz-UZ')}
                        </p>
                        <p className="text-xs">
                          <strong>Manzil:</strong> {loc.address || 'Mavjud emas'}
                        </p>
                      </div>
                    </Popup>
                  </Marker>
                ))}
                {userLocation && !isTashkentLocation(userLocation.latitude, userLocation.longitude) && (
                  <Marker
                    position={[userLocation.latitude, userLocation.longitude]}
                    icon={getCustomIcon(true, userRole)}
                    ref={(ref) => {
                      if (ref) markerRefs.current[userId] = ref;
                    }}
                  >
                    <Popup>
                      <div className="p-3 max-w-xs">
                        <p className="font-semibold text-sm">Sizning joylashuvingiz</p>
                        <p className="text-xs">
                          <strong>Kenglik:</strong> {userLocation.latitude.toFixed(6)}
                        </p>
                        <p className="text-xs">
                          <strong>Uzunlik:</strong> {userLocation.longitude.toFixed(6)}
                        </p>
                      </div>
                    </Popup>
                  </Marker>
                )}
              </MapContainer>
            )}
          </div>
        ) : (
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              Jadval ko'rinishi ({allLocations.length} foydalanuvchi)
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {allLocations.map((loc) => (
                <div
                  key={loc.userId}
                  className="bg-white p-4 rounded-lg shadow-sm border hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-content: center; text-white text-sm font-bold"
                      style={{ backgroundColor: getRoleColor(loc.user?.role || 'UNKNOWN') }}
                    >
                      {getRoleIcon(loc.user?.role || 'UNKNOWN')}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{loc.user?.name || 'Noma\'lum'}</p>
                      <p className="text-xs text-gray-500">{loc.user?.role || 'N/A'}</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600">
                    <strong>Kenglik:</strong> {loc.latitude.toFixed(6)}
                  </p>
                  <p className="text-xs text-gray-600">
                    <strong>Uzunlik:</strong> {loc.longitude.toFixed(6)}
                  </p>
                  <p className="text-xs text-gray-600">
                    <strong>Oxirgi ko'rish:</strong> {new Date(loc.lastSeen).toLocaleString('uz-UZ')}
                  </p>
                  <p className="text-xs text-gray-600">
                    <strong>Manzil:</strong> {loc.address || 'Mavjud emas'}
                  </p>
                  <button
                    onClick={() => openModal(loc)}
                    className="mt-2 flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm"
                  >
                    <Eye className="w-4 h-4" />
                    Batafsil
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modal */}
        {modalOpen && selectedDeliverer && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full relative">
              <button
                onClick={closeModal}
                className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-blue-600" />
                Foydalanuvchi ma'lumotlari
              </h3>
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white text-lg font-bold"
                  style={{ backgroundColor: getRoleColor(selectedDeliverer.user?.role || 'UNKNOWN') }}
                >
                  {getRoleIcon(selectedDeliverer.user?.role || 'UNKNOWN')}
                </div>
                <div>
                  <p className="font-medium text-sm">{selectedDeliverer.user?.name || 'Noma\'lum'}</p>
                  <p className="text-xs text-gray-600">{selectedDeliverer.user?.role || 'N/A'}</p>
                </div>
              </div>
              <p className="text-xs mb-2">
                <strong>Kenglik:</strong> {selectedDeliverer.latitude.toFixed(6)}
              </p>
              <p className="text-xs mb-2">
                <strong>Uzunlik:</strong> {selectedDeliverer.longitude.toFixed(6)}
              </p>
              <p className="text-xs mb-2">
                <strong>Oxirgi ko'rish:</strong> {new Date(selectedDeliverer.lastSeen).toLocaleString('uz-UZ')}
              </p>
              <p className="text-xs mb-2">
                <strong>Manzil:</strong> {selectedDeliverer.address || 'Mavjud emas'}
              </p>
              <button
                onClick={closeModal}
                className="mt-4 w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-all"
              >
                Yopish
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LocationApp;