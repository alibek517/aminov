import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, User, Lock, Building2 } from 'lucide-react';
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
  const hasCheckedAuthRef = useRef(false);
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    if (hasCheckedAuthRef.current) return;
    hasCheckedAuthRef.current = true;
    const role = localStorage.getItem('userRole');
    const token = localStorage.getItem('access_token');

    if (role && token && !isLoading && location.pathname === '/') {
      try {
        const decodedToken = jwtDecode(token);
        if (decodedToken.exp * 1000 < Date.now()) {
          localStorage.clear();
          setErrors({ username: '', password: 'Сессия тугади. Илтимос, қайта киринг.' });
          return;
        }
        redirectByRole(role);
      } catch (error) {
        localStorage.clear();
        setErrors({ username: '', password: 'Нотўғри токен. Илтимос, қайта киринг.' });
      }
    }
  }, []);

  const redirectByRole = (role) => {
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
        case 'MARKETING':
        navigate('/sotuv', { replace: true });
        break;
      default:
        navigate('/', { replace: true });
    }
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;

    if (!username.trim() || !password.trim()) {
      setErrors({
        username: !username.trim() ? 'Фойдаланувчи номи киритиш керак' : '',
        password: !password.trim() ? 'Парол киритиш керак' : '',
      });
      return;
    }

    setIsLoading(true);
    isSubmittingRef.current = true;
    setErrors({ username: '', password: '' });

    try {
      const response = await axios.post(
        'https://suddocs.uz/auth/login',
        {
          username: username.trim(),
          password: password.trim(),
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          withCredentials: true,
        }
      );

      const { access_token, user } = response.data;
      if (!access_token || !user || !user.role) {
        throw new Error('Invalid response structure from server');
      }

      try {
        const decodedToken = jwtDecode(access_token);
        localStorage.setItem('access_token', access_token);
        localStorage.setItem('userRole', user.role);
        // Only store branchId if it's a valid number, otherwise store null
        if (user.branchId && !isNaN(Number(user.branchId))) {
          localStorage.setItem('branchId', user.branchId.toString());
        } else {
          localStorage.removeItem('branchId'); // Remove if invalid or null
        }
        const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
        const displayName = fullName || user.name || user.username || 'User';
        localStorage.setItem('user', JSON.stringify({
          name: displayName,
          fullName: fullName || '',
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          username: user.username || '',
        }));
        localStorage.setItem('userId', user.id);

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
                },
                (error) => {
                  socket.emit('updateLocation', {
                    userId: user.id,
                    latitude: 41.3111, 
                    longitude: 69.2797,
                    address: 'Unknown',
                    isOnline: true,
                  });
                  setErrors({ username: '', password: 'Жойлашувни олишда хато юз берди. Стандарт жойлашув ишлатилди.' });
                },
                { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
              );
            } else {
              socket.emit('updateLocation', {
                userId: user.id,
                latitude: 41.3111,
                longitude: 69.2797,
                address: 'Unknown',
                isOnline: true,
              });
              setErrors({ username: '', password: 'Браузер жойлашувни қўллаб-қувватламайди.' });
            }
          });

          socket.on('connect_error', (err) => {
            setErrors({ username: '', password: `Уланиш хатоси: ${err.message}` });
          });

          socket.on('locationUpdateConfirmed', (data) => {
          });

          socket.on('error', (data) => {
            setErrors({ username: '', password: data.message || 'Сервер хатоси.' });
          });
        }

        setUsername('');
        setPassword('');
        redirectByRole(user.role);
      } catch (error) {
        throw new Error('Invalid token format');
      }
    } catch (error) {
      setErrors({
        username: '',
        password:
          error.response?.status === 401
            ? 'Фойдаланувчи номи ёки парол нотўғри'
            : error.response?.status === 429
            ? 'Жуда кўп уринишлар. Илтимос, кейинроқ қайта уриниб кўринг.'
            : error.message === 'Network Error'
            ? 'Интернет алоқаси йўқ. Илтимос, тармоқни текширинг.'
            : 'Хатолик юз берди. Илтимос, қайта уриниб кўринг.',
      });
    } finally {
      setIsLoading(false);
      isSubmittingRef.current = false;
    }
  };

  return (
    <div className="signin-container">
      <div className="signin-card">
       <div className="signin-header flex flex-col items-center justify-center py-8 px-4 sm:px-6 lg:px-8 bg-gray-50">
         <div className="brand-section mb-6 transition-transform duration-300 hover:scale-105">
        <img 
          src="/Zippy_logo.png" 
          alt="Zippy Logo" 
          className="w-12 h-12 sm:w-16 sm:h-16 object-contain"
        />
         <div className="login-title text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">
          Тизимга кириш
        </h2>
        <p className="login-subtitle text-sm sm:text-base text-gray-600">
          Ишчи ҳисобингизга киринг
        </p>
      </div>
      </div>
    </div>

        <form className="signin-form" onSubmit={handleSignIn}>
          <div className="form-section">
            <div className="form-group">
              <label className="form-label">Фойдаланувчи номи</label>
              <div className="input-wrapper">
                <User className={`input-icon ${focusedField === 'username' ? 'focused' : ''} ${errors.username ? 'error' : ''}`} />
                <input
                  type="text"
                  placeholder="Фойдаланувчи номи киритинг"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onFocus={() => setFocusedField('username')}
                  onBlur={() => setFocusedField('')}
                  className={`form-input ${errors.username ? 'error' : ''}`}
                  disabled={isLoading}
                  name="username"
                  autoComplete="username"
                />
              </div>
              {errors.username && <div className="error-text">{errors.username}</div>}
            </div>

            <div className="form-group">
              <label className="form-label">Парол</label>
              <div className="input-wrapper">
                <Lock className={`input-icon ${focusedField === 'password' ? 'focused' : ''} ${errors.password ? 'error' : ''}`} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Паролни киритинг"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField('')}
                  className={`form-input password-input ${errors.password ? 'error' : ''}`}
                  disabled={isLoading}
                  name="current-password"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="password-toggle"
                  disabled={isLoading}
                  aria-label="Паролни кўрсатиш/яшириш"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && <div className="error-text">{errors.password}</div>}
            </div>
          </div>

          <button type="submit" className="submit-button" disabled={isLoading}>
            <span className="button-text">
              {isLoading ? 'Кириляпти...' : 'Тизимга кириш'}
            </span>
            {isLoading && <div className="loading-indicator"></div>}
          </button>
        </form>

        <div className="signin-footer">
          <div className="footer-divider"></div>
          <p className="help-text">
            Тизимга киришда муаммо борми? 
            <span className="contact-link">Админ билан боғланинг</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignIn;