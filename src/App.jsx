import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import io from 'socket.io-client';
import SignIn from './pages/Kirish/SignIn';
import AdminPanel from './pages/AdminPanel/AdminPanel';
import SkladPanel from './pages/Sklad/SkladPanel';
import Menyu from './pages/KassaUser/Menyu';
import Logout from './pages/Chiqish/logout';
import Dastafka from './pages/Dastafka/DeliveryPanel';


function App() {
  const [role, setRole] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [socket, setSocket] = useState(null);
  const [locationPermission, setLocationPermission] = useState(null);
  const [locationError, setLocationError] = useState('');

  const getCurrentLocation = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
        },
        (error) => {
          let errorMessage = 'Location access denied';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Geolokatsiya ruxsati berilmagan';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Joylashuv ma\'lumoti mavjud emas';
              break;
            case error.TIMEOUT:
              errorMessage = 'Geolokatsiya so\'rovi vaqt tugadi';
              break;
            default:
              errorMessage = 'Geolokatsiya xatosi yuz berdi';
              break;
          }
          reject(new Error(errorMessage));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 
        }
      );
    });
  };

  const getAddressFromCoordinates = async (latitude, longitude) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1&accept-language=uz,en`
      );
      const data = await response.json();
      
      if (data && data.display_name) {
        return data.display_name;
      }
      
      return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    } catch (error) {
      console.error('Address lookup error:', error);
      return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    }
  };

  useEffect(() => {
    const savedRole = localStorage.getItem('userRole');
    const savedToken = localStorage.getItem('access_token');

    console.log('App.jsx: Initial check - Role:', savedRole, 'Token:', !!savedToken);

    if (savedToken) {
      fetch('https://suddocs.uz/auth/profile', {
        headers: {
          Authorization: `Bearer ${savedToken}`,
        },
      })
        .then((response) => {
          if (response.ok) {
            return response.json();
          }
          throw new Error('Invalid token');
        })
        .then((data) => {
          console.log('App.jsx: Profile data:', data);
          setRole(savedRole);
          setToken(savedToken);
          
          initializeSocket(savedToken);
        })
        .catch((error) => {
          console.error('App.jsx: Token validation error:', error.message);
          setRole(null);
          setToken(null);
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setRole(savedRole);
      setToken(null);
      setIsLoading(false);
    }
  }, []);

  const initializeSocket = (userToken) => {
    if (socket) {
      socket.disconnect();
    }

    console.log('Initializing socket connection...');
    
    const socketIo = io('https://suddocs.uz/', {
      path: '/socket.io',
      auth: { token: userToken },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      secure: true,
      timeout: 20000,
    });

    socketIo.on('connect', () => {
      console.log('Socket connected successfully');
      setSocket(socketIo);
      
      requestLocationAndSend(socketIo);
      
      const locationInterval = setInterval(() => {
        updateLocationPeriodically(socketIo);
      }, 30000);

      socketIo.on('disconnect', () => {
        clearInterval(locationInterval);
      });
    });

    socketIo.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
      setSocket(null);
    });

    socketIo.on('error', (data) => {
      console.error('Socket error:', data);
    });

    socketIo.on('locationUpdateConfirmed', (data) => {
      console.log('Location update confirmed:', data);
    });

    return socketIo;
  };

  const requestLocationAndSend = async (socketConnection) => {
    try {
      console.log('Requesting location permission...');
      const location = await getCurrentLocation();
      const address = await getAddressFromCoordinates(location.latitude, location.longitude);
      
      console.log('Location obtained:', { ...location, address });
      
      setLocationPermission('granted');
      setLocationError('');
      
      if (socketConnection && socketConnection.connected) {
        socketConnection.emit('updateLocation', {
          latitude: location.latitude,
          longitude: location.longitude,
          address: address,
          isOnline: true
        });
        
        console.log('Location sent to backend');
      }
    } catch (error) {
      console.error('Location error:', error);
      setLocationPermission('denied');
      setLocationError(error.message);
      
      if (socketConnection && socketConnection.connected) {
        socketConnection.emit('updateLocation', {
          latitude: 41.3111,
          longitude: 69.2797,
          address: 'Toshkent, O\'zbekiston (Default)',
          isOnline: true
        });
        
        console.log('Default location sent to backend');
      }
    }
  };

  const updateLocationPeriodically = async (socketConnection) => {
    if (!socketConnection || !socketConnection.connected) return;

    try {
      const location = await getCurrentLocation();
      const address = await getAddressFromCoordinates(location.latitude, location.longitude);
      
      socketConnection.emit('updateLocation', {
        latitude: location.latitude,
        longitude: location.longitude,
        address: address,
        isOnline: true
      });
      
      console.log('Location updated periodically');
    } catch (error) {
      console.log('Periodic location update failed:', error.message);
      socketConnection.emit('updateLocation', {
        latitude: 41.3111,
        longitude: 69.2797,
        address: 'Toshkent, O\'zbekiston (Default)',
        isOnline: true
      });
    }
  };

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (socket && socket.connected) {
        socket.emit('updateLocation', {
          latitude: 41.3111,
          longitude: 69.2797,
          address: 'Offline',
          isOnline: false
        });
        socket.disconnect();
      }
    };

    const handleVisibilityChange = () => {
      if (socket && socket.connected) {
        if (document.hidden) {
          console.log('Page hidden - keeping online status');
        } else {
          updateLocationPeriodically(socket);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      if (socket) {
        socket.disconnect();
      }
    };
  }, [socket]);

  const PrivateRoute = ({ children, allowedRoles }) => {
    if (isLoading) {
      return (
        <>
          <div
            style={{
              width: '40px',
              height: '40px',
              border: '4px solid #ccc',
              borderTop: '4px solid #3498db',
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: 'auto',
            }}
          ></div>
          <style>
            {`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}
          </style>
        </>
      );
    }

    const currentRole = localStorage.getItem('userRole');
    const currentToken = localStorage.getItem('access_token');
    console.log('PrivateRoute: Role:', currentRole, 'Token:', !!currentToken, 'Allowed:', allowedRoles);

    if (!currentRole || !currentToken) {
      console.log('PrivateRoute: No role or token, redirecting to /');
      return <Navigate to="/" replace />;
    }

    if (!allowedRoles.includes(currentRole)) {
      console.log('PrivateRoute: Role not allowed, redirecting to /');
      return <Navigate to="/" replace />;
    }

    return React.cloneElement(children, { 
      token: currentToken, 
      socket: socket,
      locationPermission: locationPermission,
      locationError: locationError 
    });
  };

  return (
    <BrowserRouter>
      {locationError && (
        <div style={{
          position: 'fixed',
          top: '10px',
          right: '10px',
          background: '#ff6b6b',
          color: 'white',
          padding: '10px',
          borderRadius: '5px',
          zIndex: 9999,
          fontSize: '12px',
          maxWidth: '300px'
        }}>
          <strong>Geolokatsiya xatosi:</strong> {locationError}
          <br />
          <small>Default lokatsiya ishlatilmoqda</small>
        </div>
      )}
      
      {locationPermission === 'granted' && (
        <div> </div>
      )}

      <Routes>
        <Route path="/" element={<SignIn />} />
        <Route
          path="/admin/*"
          element={
            <PrivateRoute allowedRoles={['ADMIN', 'MANAGER']}>
              <AdminPanel token={token} />
            </PrivateRoute>
          }
        />
        <Route
          path="/kasir/*"
          element={
            <PrivateRoute allowedRoles={['CASHIER']}>
              <Menyu token={token} />
            </PrivateRoute>
          }
        />
        <Route
          path="/sklad/*"
          element={
            <PrivateRoute allowedRoles={['WAREHOUSE']}>
              <SkladPanel token={token} />
            </PrivateRoute>
          }
        />
        <Route
          path="/dastafka/*"
          element={
            <PrivateRoute allowedRoles={['AUDITOR']}>
              <Dastafka token={token} />
            </PrivateRoute>
          }
        />
        <Route path="/logout" element={<Logout />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;