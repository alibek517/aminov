import React from 'react';

const Notification = ({ message, type = 'error', onClose }) => {
  return (
    <div
      className={`fixed top-4 right-4 p-4 rounded border ${
        type === 'error'
          ? 'bg-red-50 border-red-200 text-red-700'
          : 'bg-green-50 border-green-200 text-green-700'
      } flex items-center gap-2 z-50`}
    >
      <span>{message}</span>
      <button
        onClick={onClose}
        className="ml-2 text-sm hover:text-red-900"
      >
        X
      </button>
    </div>
  );
};

export default Notification;