import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Dashboard from './Dashboard';
import SalesManagement from './SalesManagement';
import DefectiveManagement from './DefectiveManagement';
import ReturnedTransactions from './ReturnedTransactions';
import Sotuvchilar from './Sotuvchilar'; 
import Mijozlar from './Mijozlar'; 

function Menyu({ token, socket, locationPermission, locationError }) {
  return (
    <Sidebar token={token} socket={socket} locationPermission={locationPermission} locationError={locationError}>
      <Routes>
        <Route path="/dashboard" element={<Dashboard token={token} socket={socket} />} />
        <Route path="/mijozlar" element={<Mijozlar token={token} socket={socket} />} />
        <Route path="/sotuvchilar" element={<Sotuvchilar token={token} socket={socket} />} />
        <Route path="/sales" element={<SalesManagement token={token} socket={socket} />} />
        <Route path="/defective" element={<DefectiveManagement token={token} socket={socket} />} />
        <Route path="/returned" element={<ReturnedTransactions token={token} socket={socket} />} />
        <Route path="/" element={<Navigate to="/kasir/dashboard" replace />} />
      </Routes>
    </Sidebar>
  );
}

export default Menyu;