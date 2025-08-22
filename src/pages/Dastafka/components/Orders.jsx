import React, { useState } from 'react';
import { Package, Clock, CheckCircle, Phone, MapPin, AlertCircle } from 'lucide-react';

function Orders({ t, orders, setOrders }) {
  const [filter, setFilter] = useState('all');

  const filteredOrders = orders.filter(order => {
    if (filter === 'all') return true;
    return order.status === filter;
  });

  const handleAcceptOrder = (orderId) => {
    setOrders(orders.map(order => 
      order.id === orderId 
        ? { ...order, status: 'assigned' }
        : order
    ));
  };

  const handleCompleteOrder = (orderId) => {
    setOrders(orders.map(order => 
      order.id === orderId 
        ? { ...order, status: 'completed' }
        : order
    ));
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-orange-600" />;
      case 'assigned':
        return <Package className="w-4 h-4 text-blue-600" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-orange-100 text-orange-800';
      case 'assigned':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-4 space-y-6">
      {/* Filter Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2">
        <div className="flex space-x-1">
          <button
            onClick={() => setFilter('all')}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
              filter === 'all' 
                ? 'bg-blue-600 text-white' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {t.all}
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
              filter === 'pending' 
                ? 'bg-orange-600 text-white' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {t.pending}
          </button>
          <button
            onClick={() => setFilter('assigned')}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
              filter === 'assigned' 
                ? 'bg-blue-600 text-white' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {t.assigned}
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
              filter === 'completed' 
                ? 'bg-green-600 text-white' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {t.completed}
          </button>
        </div>
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {filteredOrders.length > 0 ? (
          filteredOrders.map(order => (
            <div key={order.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  {getStatusIcon(order.status)}
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                    {t[order.status]}
                  </span>
                </div>
                <span className="text-sm text-gray-500">{order.time}</span>
              </div>

              <div className="space-y-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{order.customer}</h3>
                  <p className="text-sm text-gray-600">{order.product}</p>
                </div>

                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <MapPin className="w-4 h-4" />
                  <span>{order.address}</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <span className="text-lg font-bold text-gray-900">{order.price} {t.currency}</span>
                    <span className="text-sm text-gray-500">{order.distance}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <a 
                      href={`tel:${order.phone}`} 
                      className="p-2 bg-gray-100 rounded-lg text-gray-600 hover:bg-gray-200 transition-colors"
                    >
                      <Phone className="w-4 h-4" />
                    </a>
                  </div>
                </div>

                {order.status === 'pending' && (
                  <button
                    onClick={() => handleAcceptOrder(order.id)}
                    className="w-full py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                  >
                    {t.acceptOrder}
                  </button>
                )}

                {order.status === 'assigned' && (
                  <button
                    onClick={() => handleCompleteOrder(order.id)}
                    className="w-full py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
                  >
                    {t.completeOrder}
                  </button>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">{t.noOrders}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Orders;