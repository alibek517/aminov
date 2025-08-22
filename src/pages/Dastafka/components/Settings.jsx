import React from 'react';
import { Globe, Bell, Shield, LogOut } from 'lucide-react';
import Logout from "./Chiqish/logout"

function Settings({ t, language, setLanguage }) {
  const [showLogoutModal, setShowLogoutModal] = React.useState(false);

  const handleLogoutConfirm = () => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('userRole');
  localStorage.removeItem('user');
  localStorage.removeItem('userId');
  localStorage.removeItem('selectedBranchId');
  window.location.href = '/login'; // Можно через navigate, если есть useNavigate
};

const handleLogoutCancel = () => {
  setShowLogoutModal(false);
};


  const languages = [
    { code: 'uz-latn', name: 'O\'zbekcha (Lotin)', flag: '🇺🇿' },
    { code: 'uz-cyrl', name: 'Ўзбекча (Кирил)', flag: '🇺🇿' },
    { code: 'ru', name: 'Русский', flag: '🇷🇺' }
  ];

  return (
    <div className="p-4 space-y-0">
      {/* Language Settings */}
      <div className="bg-white rounded-xl shadow-sm border mb-3 border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t.language}</h3>
        <div className="space-y-2">
          {languages.map(lang => (
            <button
              key={lang.code}
              onClick={() => setLanguage(lang.code)}
              className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                language === lang.code 
                  ? 'bg-blue-50 text-blue-600 border border-blue-200' 
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center space-x-3">
                <span className="text-xl">{lang.flag}</span>
                <span className="font-medium">{lang.name}</span>
              </div>
              {language === lang.code && (
                <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Notification Settings */}
      <div style={{marginBottom: "15px"}} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t.notifications}</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Bell className="w-5 h-5 text-gray-600" />
              <span className="text-gray-900">{t.newOrders}</span>
            </div>
            <div className="relative">
              <input
                type="checkbox"
                defaultChecked
                className="sr-only"
              />
              <div className="w-10 h-6 bg-blue-600 rounded-full shadow-inner"></div>
              <div className="absolute w-4 h-4 bg-white rounded-full shadow inset-y-1 right-1 transition-transform duration-300 ease-in-out"></div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Bell className="w-5 h-5 text-gray-600" />
              <span className="text-gray-900">{t.statusUpdates}</span>
            </div>
            <div className="relative">
              <input
                type="checkbox"
                defaultChecked
                className="sr-only"
              />
              <div className="w-10 h-6 bg-blue-600 rounded-full shadow-inner"></div>
              <div className="absolute w-4 h-4 bg-white rounded-full shadow inset-y-1 right-1 transition-transform duration-300 ease-in-out"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Account Settings */}
      <div  style={{marginBottom: "15px"}} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t.account}</h3>
        <div className="space-y-3">
          <button className="w-full flex items-center space-x-3 p-3 rounded-lg text-left hover:bg-gray-50 transition-colors">
            <Shield className="w-5 h-5 text-gray-600" />
            <span className="text-gray-900">{t.privacy}</span>
          </button>
          <button className="w-full flex items-center space-x-3 p-3 rounded-lg text-left hover:bg-gray-50 transition-colors">
            <Globe className="w-5 h-5 text-gray-600" />
            <span className="text-gray-900">{t.about}</span>
          </button>
        </div>
      </div>

      {/* Logout */}
<div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
  <button
    onClick={() => setShowLogoutModal(true)}
    className="w-full flex items-center justify-center space-x-3 p-3 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
  >
    <LogOut className="w-5 h-5" />
    <span className="font-medium">{t.logout}</span>
  </button>
</div>
{showLogoutModal && (
  <Logout onConfirm={handleLogoutConfirm} onCancel={handleLogoutCancel} />
)}
    </div>
  );
}

export default Settings;