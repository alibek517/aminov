import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, User, Lock, Calculator, DollarSign } from 'lucide-react';
import './Signin.css';

const users = [
  { id: 1, username: 'kasir', password: '1111', name: 'Kasir', role: 'CASHIER' },
  { id: 2, username: 'admin', password: '1111', name: 'Admin', role: 'ADMIN' },
  { id: 3, username: 'dastafka', password: '1111', name: 'Dastafka', role: 'DELIVERY' },
  { id: 4, username: 'sklad', password: '1111', name: 'Sklad', role: 'STORAGE' },
  
];

const SignIn = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [focusedField, setFocusedField] = useState('');
  const [errors, setErrors] = useState({ username: '', password: '' });

  useEffect(() => {
    const role = localStorage.getItem('userRole');
    if (role) redirectByRole(role);
  }, []);

  const redirectByRole = (role) => {
    switch (role) {
      case 'CASHIER': navigate('/kasir'); break;
      case 'ADMIN': navigate('/admin'); break;
      case 'DELIVERY': navigate('/dastafka'); break;
      case 'STORAGE': navigate('/sklad'); break;
      default: navigate('/');
    }
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrors({ username: '', password: '' });

    const foundUser = users.find(
      u => u.username === username.trim() && u.password === password.trim()
    );

    await new Promise(res => setTimeout(res, 800));

    if (foundUser) {
      localStorage.setItem('userRole', foundUser.role);
      localStorage.setItem('user', foundUser.name);
      localStorage.setItem('userId', foundUser.id);
      redirectByRole(foundUser.role);
    } else {
      const usernameExists = users.find(u => u.username === username.trim());
      setErrors({
        username: usernameExists ? '' : 'Foydalanuvchi topilmadi',
        password: usernameExists ? 'Parol noto\'g'ri' : '',
      });
    }

    setIsLoading(false);
  };

  return (
    <div className="signin-container">
      <div className="signin-card">
        <div className="signin-header">
          <div className="logo-container"><Calculator className="logo-icon" /></div>
          <h1 className="kirish">Foydalanuvchi Kirish</h1>
          <p className="subtitle">
            <DollarSign className="subtitle-icon" /> Tizimga xush kelibsiz
          </p>
        </div>

        <form className="signin-form" onSubmit={handleSignIn}>
          <div className="form-group">
            <label>Foydalanuvchi nomi</label>
            <div className="input-container">
              <User className={`input-icon ${focusedField === 'username' ? 'focused' : ''} ${errors.username ? 'error' : ''}`} />
              <input
                type="text"
                placeholder="Login"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onFocus={() => setFocusedField('username')}
                onBlur={() => setFocusedField('')}
                className={`form-input ${errors.username ? 'error' : ''}`}
              />
            </div>
            {errors.username && <div className="error-message">{errors.username}</div>}
          </div>

          <div className="form-group">
            <label>Parol</label>
            <div className="password-field">
              <Lock className={`input-icon ${focusedField === 'password' ? 'focused' : ''} ${errors.password ? 'error' : ''}`} />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Parol"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField('')}
                className={`form-input password-input ${errors.password ? 'error' : ''}`}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="toggle-password">
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
          <p>Yangi foydalanuvchimisiz? <span className="admin-link">Admin bilan bog'laning</span></p>
        </div>
      </div>
    </div>
  );
};

export default SignIn;