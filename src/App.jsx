import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import SignIn from './pages/Kirish/SignIn';
import AdminPanel from './pages/AdminPanel/AdminPanel';
import SkladPanel from './pages/Sklad/SkladPanel';
import Menyu from './pages/KassaUser/Menyu';
import Logout from './pages/Chiqish/logout';
import Dastafka from './pages/Dastafka/DeliveryPanel';
import Sotuv from './pages/Sotuv/Korish';


function App() {
  const [role, setRole] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

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

    return React.cloneElement(children, { token: currentToken });
  };

  return (
    <BrowserRouter>
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
        <Route
          path="/sotuv/*"
          element={
            <PrivateRoute allowedRoles={['MARKETING']}>
              <Sotuv token={token} />
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