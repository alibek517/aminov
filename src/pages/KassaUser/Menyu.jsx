import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './Sidebar'; // Adjust path as needed
import Dashboard from './Dashboard'; // Adjust path as needed
import SalesManagement from './SalesManagement'; // Adjust path as needed
import DefectiveManagement from './DefectiveManagement'; // Adjust path as needed

function Menyu({ token, socket, locationPermission, locationError }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar token={token} socket={socket} locationPermission={locationPermission} locationError={locationError} />
      <main className="flex-1 p-8">
        <Routes>
          <Route path="/dashboard" element={<Dashboard token={token} socket={socket} />} />
          <Route path="/sales" element={<SalesManagement token={token} socket={socket} />} />
          <Route path="/defective" element={<DefectiveManagement token={token} socket={socket} />} />
          <Route path="/" element={<Navigate to="/kasir/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default Menyu;