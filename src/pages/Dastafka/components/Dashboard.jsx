import React from 'react';
import { MapPin, Package, Clock, CheckCircle, AlertCircle, Phone } from 'lucide-react';

function Dashboard({ t, location, isAvailable, setIsAvailable, orders }) {
  const pendingOrders = orders.filter(order => order.status === 'pending');
  const assignedOrders = orders.filter(order => order.status === 'assigned');
  const completedOrders = orders.filter(order => order.status === 'completed');

  return (
    <div className="p-4 space-y-6">
      {/* Status Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{t.status}</h2>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${isAvailable ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-gray-700">
              {isAvailable ? t.available : t.busy}
            </span>
          </div>
          <button
            onClick={() => setIsAvailable(!isAvailable)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              isAvailable 
                ? 'bg-red-100 text-red-800 hover:bg-red-200' 
                : 'bg-green-100 text-green-800 hover:bg-green-200'
            }`}
          >
            {isAvailable ? t.setBusy : t.setAvailable}
          </button>
        </div>
      </div>

      {/* Location Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{t.location}</h2>
        <div className="flex items-center space-x-3">
          <MapPin className="w-5 h-5 text-blue-600" />
          <div>
            {location ? (
              <div className="text-sm text-gray-600">
                <p>{t.latitude}: {location.latitude.toFixed(6)}</p>
                <p>{t.longitude}: {location.longitude.toFixed(6)}</p>
              </div>
            ) : (
              <p className="text-sm text-gray-500">{t.locationLoading}</p>
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <Clock className="w-5 h-5 text-orange-600" />
            <span className="text-2xl font-bold text-gray-900">{pendingOrders.length}</span>
          </div>
          <p className="text-sm text-gray-600">{t.pending}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <Package className="w-5 h-5 text-blue-600" />
            <span className="text-2xl font-bold text-gray-900">{assignedOrders.length}</span>
          </div>
          <p className="text-sm text-gray-600">{t.assigned}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="text-2xl font-bold text-gray-900">{completedOrders.length}</span>
          </div>
          <p className="text-sm text-gray-600">{t.completed}</p>
        </div>
      </div>

      {/* Active Orders */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{t.activeOrders}</h2>
        {assignedOrders.length > 0 ? (
          <div className="space-y-3">
            {assignedOrders.map(order => (
              <div key={order.id} className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-gray-900">{order.customer}</h3>
                  <span className="text-sm text-blue-600 font-medium">{order.distance}</span>
                </div>
                <p className="text-sm text-gray-600 mb-2">{order.product}</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">{order.time}</span>
                  <div className="flex items-center space-x-2">
                    <a 
                      href={`tel:${order.phone}`} 
                      className="p-2 bg-blue-600 rounded-lg text-white hover:bg-blue-700 transition-colors"
                    >
                      <Phone className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500">{t.noActiveOrders}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;