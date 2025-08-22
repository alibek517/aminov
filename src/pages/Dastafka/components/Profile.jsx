import React from 'react';
import { User, Phone, MapPin, Package, Star, Calendar } from 'lucide-react';

function Profile({ t }) {
  const courierData = {
    name: 'Sardor Yusupov',
    phone: '+998901234567',
    email: 'sardor@example.com',
    rating: 4.8,
    totalOrders: 245,
    completedOrders: 238,
    joinDate: '2023-01-15'
  };

  return (
    <div className="p-4 space-y-6">
      {/* Profile Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
            <User className="w-8 h-8 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900">{courierData.name}</h2>
            <p className="text-sm text-gray-600">{t.courier}</p>
            <div className="flex items-center space-x-1 mt-1">
              <Star className="w-4 h-4 text-yellow-500 fill-current" />
              <span className="text-sm font-medium text-gray-900">{courierData.rating}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Contact Information */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t.contactInfo}</h3>
        <div className="space-y-3">
          <div className="flex items-center space-x-3">
            <Phone className="w-5 h-5 text-gray-600" />
            <span className="text-gray-900">{courierData.phone}</span>
          </div>
          <div className="flex items-center space-x-3">
            <MapPin className="w-5 h-5 text-gray-600" />
            <span className="text-gray-900">{courierData.email}</span>
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t.statistics}</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Package className="w-5 h-5 text-blue-600" />
              <span className="text-sm text-gray-600">{t.totalOrders}</span>
            </div>
            <span className="text-2xl font-bold text-gray-900">{courierData.totalOrders}</span>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Package className="w-5 h-5 text-green-600" />
              <span className="text-sm text-gray-600">{t.completedOrders}</span>
            </div>
            <span className="text-2xl font-bold text-gray-900">{courierData.completedOrders}</span>
          </div>
        </div>
      </div>

      {/* Work Information */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t.workInfo}</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-600">{t.joinDate}</span>
            <span className="text-gray-900">{courierData.joinDate}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">{t.successRate}</span>
            <span className="text-green-600 font-medium">
              {Math.round((courierData.completedOrders / courierData.totalOrders) * 100)}%
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">{t.rating}</span>
            <div className="flex items-center space-x-1">
              <Star className="w-4 h-4 text-yellow-500 fill-current" />
              <span className="text-gray-900 font-medium">{courierData.rating}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Profile;