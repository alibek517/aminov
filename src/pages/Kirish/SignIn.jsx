import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, User, Lock, Calculator, DollarSign } from 'lucide-react';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import io from 'socket.io-client';
import './SignIn.css';

const SignIn = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [focusedField, setFocusedField] = useState('');
  const [errors, setErrors] = useState({ username: '', password: '' });

  useEffect(() => {
    const role = localStorage.getItem('userRole');
    const token = localStorage.getItem('access_token');

    if (role && token && !isLoading && location.pathname === '/') {
      try {
        const decodedToken = jwtDecode(token);
        if (decodedToken.exp * 1000 < Date.now()) {
          console.log('Token expired, clearing localStorage');
          localStorage.clear();
          setErrors({ username: '', password: 'Sessiya tugadi. Iltimos, qayta kiring.' });
          return;
        }
        console.log('Valid token and role found, redirecting:', role);
        redirectByRole(role);
      } catch (error) {
        console.error('Invalid token:', error);
        localStorage.clear();
        setErrors({ username: '', password: 'Noto‘g‘ri token. Iltimos, qayta kiring.' });
      }
    }
  }, [isLoading, location.pathname]);

  const redirectByRole = (role) => {
    console.log('Redirecting to role:', role);
    switch (role) {
      case 'CASHIER':
        navigate('/kasir', { replace: true });
        break;
      case 'MANAGER':
      case 'ADMIN':
        navigate('/admin', { replace: true });
        break;
      case 'WAREHOUSE':
        navigate('/sklad', { replace: true });
        break;
      case 'AUDITOR':
        navigate('/dastafka', { replace: true });
        break;
      default:
        navigate('/', { replace: true });
    }
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    console.log('Form submitted, handleSignIn called');
    console.log('Entered Email:', username.trim());
    console.log('Entered Password:', password.trim());

    if (!username.trim() || !password.trim()) {
      setErrors({
        username: !username.trim() ? 'Email kiritish kerak' : '',
        password: !password.trim() ? 'Parol kiritish kerak' : '',
      });
      return;
    }

    setIsLoading(true);
    setErrors({ username: '', password: '' });

    try {
      console.log('Sending login request to /auth/login');
      const response = await axios.post(
        'https://suddocs.uz/auth/login',
        {
          email: username.trim(),
          password: password.trim(),
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          withCredentials: true,
        }
      );
      console.log('Login successful:', response.data);

      const { access_token, user } = response.data;
      if (!access_token || !user || !user.role) {
        throw new Error('Invalid response structure from server');
      }

      try {
        const decodedToken = jwtDecode(access_token);
        localStorage.setItem('access_token', access_token);
        localStorage.setItem('userRole', user.role);
        localStorage.setItem('branchId', user.branchId);
        localStorage.setItem('user', JSON.stringify({
          name: user.name || '',
          firstName: user.firstName || '',
          lastName: user.lastName || '',
        }));
        localStorage.setItem('userId', user.id);
        console.log('Stored token and user data:', { role: user.role, userId: user.id });

        if (user.role === 'AUDITOR') {
          const socket = io('https://suddocs.uz/', {
            path: '/socket.io',
            auth: { token: access_token },
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            secure: true,
          });

          socket.on('connect', () => {
            console.log('Socket.IO connected for AUDITOR, userId:', user.id);
            if (navigator.geolocation) {
              navigator.geolocation.getCurrentPosition(
                (position) => {
                  const { latitude, longitude } = position.coords;
                  socket.emit('updateLocation', {
                    latitude,
                    longitude,
                    address: '',
                    userId: user.id,
                  });
                  console.log('Sent initial location:', { userId: user.id, latitude, longitude });
                },
                (error) => {
                  console.error('Geolocation error:', error);
                  socket.emit('updateLocation', {
                    userId: user.id,
                    latitude: 41.3111, 
                    longitude: 69.2797,
                    address: 'Unknown',
                    isOnline: true,
                  });
                  console.log('Sent fallback location for user:', user.id);
                  setErrors({ username: '', password: 'Joylashuvni olishda xato yuz berdi. Standart joylashuv ishlatildi.' });
                },
                { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
              );
            } else {
              console.error('Geolocation not supported');
              socket.emit('updateLocation', {
                userId: user.id,
                latitude: 41.3111,
                longitude: 69.2797,
                address: 'Unknown',
                isOnline: true,
              });
              console.log('Sent fallback location for user:', user.id);
              setErrors({ username: '', password: 'Brauzer joylashuvni qo‘llab-quvvatlamaydi.' });
            }
          });

          socket.on('connect_error', (err) => {
            console.error('Socket.IO connection error:', err.message);
            setErrors({ username: '', password: `Ulanish xatosi: ${err.message}` });
          });

          socket.on('locationUpdateConfirmed', (data) => {
            console.log('Location update confirmed:', data);
          });

          socket.on('error', (data) => {
            console.error('Socket.IO error:', data);
            setErrors({ username: '', password: data.message || 'Server xatosi.' });
          });
        }

        setUsername('');
        setPassword('');
        redirectByRole(user.role);
      } catch (error) {
        throw new Error('Invalid token format');
      }
    } catch (error) {
      console.error('Login error:', error.response ? error.response.data : error.message);
      setErrors({
        username: '',
        password:
          error.response?.status === 401
            ? 'Foydalanuvchi yoki parol noto‘g‘ri'
            : error.response?.status === 429
            ? 'Juda ko‘p urinishlar. Iltimos, keyinroq qayta urinib ko‘ring.'
            : error.message === 'Network Error'
            ? 'Internet aloqasi yo‘q. Iltimos, tarmoqni tekshiring.'
            : 'Xatolik yuz berdi. Iltimos, qayta urinib ko‘ring.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="signin-container">
      <div className="signin-card">
        <div className="signin-header">
          <div className="logo-container">
            <Calculator className="logo-icon" />
          </div>
          <h1 className="kirish">Foydalanuvchi Kirish</h1>
          <p className="subtitle">
            <DollarSign className="subtitle-icon" /> Tizimga xush kelibsiz
          </p>
        </div>
        <form className="signin-form" onSubmit={handleSignIn}>
          <div className="form-group">
            <label>Foydalanuvchi nomi</label>
            <div className="input-container">
              <User
                className={`input-icon ${focusedField === 'username' ? 'focused' : ''} ${
                  errors.username ? 'error' : ''
                }`}
              />
              <input
                type="text"
                placeholder="Email"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onFocus={() => setFocusedField('username')}
                onBlur={() => setFocusedField('')}
                className={`form-input ${errors.username ? 'error' : ''}`}
                disabled={isLoading}
              />
            </div>
            {errors.username && <div className="error-message">{errors.username}</div>}
          </div>
          <div className="form-group">
            <label>Parol</label>
            <div className="password-field">
              <Lock
                className={`input-icon ${focusedField === 'password' ? 'focused' : ''} ${
                  errors.password ? 'error' : ''
                }`}
              />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Parol"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField('')}
                className={`form-input password-input ${errors.password ? 'error' : ''}`}
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="toggle-password"
                disabled={isLoading}
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </button>
            </div>
            {errors.password && <div className="error-message">{errors.password}</div>}
          </div>
          <button type="submit" className="submit-btn" disabled={isLoading}>
            {isLoading ? 'Kirish...' : 'Tizimga Kirish'}
          </button>
        </form>
        <div className="signin-footer">
          <p>
            Yangi foydalanuvchimisiz? <span className="admin-link">Admin bilan bog‘laning</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignIn;