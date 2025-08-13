import React, { forwardRef } from 'react';
import { X } from 'lucide-react';

const Receipt = forwardRef(({ order, onClose }, ref) => {
  if (!order || !order.items || !Array.isArray(order.items)) {
    return (
      <div ref={ref} className="bg-white p-6 max-w-md w-[90%] mx-auto rounded-lg shadow-lg">
        <h1 className="text-xl font-bold text-red-600">Xatolik</h1>
        <p>Chek ma'lumotlari noto‘g‘ri yoki mavjud emas.</p>
        <button
          onClick={onClose}
          className="mt-4 w-full bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 transition-colors"
        >
          Yopish
        </button>
      </div>
    );
  }

  const formatCurrency = (amount) =>
    typeof amount === 'number' && !isNaN(amount)
      ? `${new Intl.NumberFormat('uz-UZ').format(amount)} so‘m`
      : 'Noma‘lum';

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('uz-UZ', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Noma‘lum';
    }
  };

  return (
    <div
      ref={ref}
      className="bg-white p-6 max-w-md w-[90%] mx-auto rounded-lg shadow-lg"
      style={{ fontFamily: 'Arial, sans-serif' }}
    >
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold text-gray-800">Chek #{order.id || 'Noma‘lum'}</h1>
        <button onClick={onClose} className="text-gray-500 hover:text-red-500">
          <X size={24} />
        </button>
      </div>
      <div className="text-sm text-gray-700 mb-4">
        <p><strong>Sana:</strong> {formatDate(order.date)}</p>
        <p><strong>Kassir:</strong> {order.cashier || 'Noma‘lum'}</p>
        <p><strong>Mijoz:</strong> {order.customer || 'Noma‘lum'}</p>
        <p>
          <strong>Yetkazib berish usuli:</strong>{' '}
          {order.deliveryMethod === 'delivery'
            ? 'Yetkazib berish'
            : order.deliveryMethod === 'self_pickup'
            ? 'O‘zi olib ketish'
            : 'Noma‘lum'}
        </p>
        <p>
          <strong>To‘lov usuli:</strong>{' '}
          {order.paymentMethod === 'cash'
            ? 'Naqd'
            : order.paymentMethod === 'card'
            ? 'Karta'
            : order.paymentMethod === 'credit'
            ? 'Kredit'
            : 'Noma‘lum'}
        </p>
        {order.paymentMethod === 'credit' && (
          <>
            <p><strong>Kredit summasi:</strong> {formatCurrency(order.creditTotal || 0)}</p>
            <p><strong>Bergan summa:</strong> {formatCurrency(order.amountPaid || 0)}</p>
            <p><strong>Qoldiq balans:</strong> {formatCurrency(order.remainingBalance || 0)}</p>
          </>
        )}
        {order.paymentMethod !== 'credit' && (
          <p><strong>Bergan summa:</strong> {formatCurrency(order.amountPaid || 0)}</p>
        )}
        <p><strong>Qaytarish kodi:</strong> {order.returnCode || 'Noma‘lum'}</p>
      </div>
      <h2 className="text-lg font-semibold text-gray-800 mb-2">Mahsulotlar</h2>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm text-gray-700">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2 text-left font-medium" style={{ width: '5%' }}>№</th>
              <th className="p-2 text-left font-medium" style={{ width: '30%' }}>Mahsulot</th>
              <th className="p-2 text-left font-medium" style={{ width: '20%' }}>Kategoriya</th>
              <th className="p-2 text-left font-medium" style={{ width: '15%' }}>Narx</th>
              <th className="p-2 text-left font-medium" style={{ width: '10%' }}>Soni</th>
              <th className="p-2 text-left font-medium" style={{ width: '20%' }}>Jami</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, index) => (
              <tr key={item.id || index} className="border-b border-gray-200">
                <td className="p-2">{index + 1}</td>
                <td className="p-2">{item.name || 'Noma‘lum'}</td>
                <td className="p-2">{item.category || 'Umumiy'}</td>
                <td className="p-2">{formatCurrency(item.price)}</td>
                <td className="p-2">{item.quantity || 0}</td>
                <td className="p-2">{formatCurrency(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-lg font-bold text-gray-800 mt-4">Jami: {formatCurrency(order.total)}</p>
      <button
        onClick={onClose}
        className="mt-4 w-full bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 transition-colors"
      >
        Yopish
      </button>
    </div>
  );
});

export default Receipt;