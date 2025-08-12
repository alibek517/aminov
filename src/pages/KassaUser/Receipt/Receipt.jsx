
import React, { forwardRef } from "react";
import { X } from "lucide-react";

const Receipt = forwardRef(({ order, onClose }, ref) => {
  // Validate order prop
  if (!order || !order.items || !Array.isArray(order.items)) {
    return (
      <div ref={ref} className="bg-white p-6 max-w-md mx-auto">
        <h1 className="text-xl font-bold text-red-600">Xatolik</h1>
        <p>Chek ma'lumotlari noto‘g‘ri yoki mavjud emas.</p>
      </div>
    );
  }

  return (
    <div ref={ref} className="bg-white p-6 max-w-md mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">Chek #{order.id}</h1>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-red-400"
        >
          <X size={24} />
        </button>
      </div>
      <p>Sana: {new Date(order.date).toLocaleString("uz-UZ")}</p>
      <p>Kassir: {order.cashier}</p>
      <p>Mijoz: {order.customer}</p>
      <p>
        Yetkazib berish usuli:{" "}
        {order.deliveryMethod === "delivery" ? "Yetkazib berish" : "O‘zi olib ketish"}
      </p>
      <p>
        To‘lov usuli:{" "}
        {order.paymentMethod === "cash"
          ? "Naqd"
          : order.paymentMethod === "card"
          ? "Karta"
          : "Kredit"}
      </p>
      <h2 className="text-lg font-medium mt-4 mb-2">Mahsulotlar</h2>
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="px-2 py-1 text-left text-sm">№</th>
            <th className="px-2 py-1 text-left text-sm">Mahsulot</th>
            <th className="px-2 py-1 text-left text-sm">Kategoriya</th>
            <th className="px-2 py-1 text-left text-sm">Narx</th>
            <th className="px-2 py-1 text-left text-sm">Soni</th>
            <th className="px-2 py-1 text-left text-sm">Jami</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item, index) => (
            <tr key={item.id} className="border-b border-gray-200">
              <td className="px-2 py-1 text-sm">{index + 1}</td>
              <td className="px-2 py-1 text-sm">{item.name}</td>
              <td className="px-2 py-1 text-sm">{item.category}</td>
              <td className="px-2 py-1 text-sm">{item.price.toLocaleString()} so‘m</td>
              <td className="px-2 py-1 text-sm">{item.quantity}</td>
              <td className="px-2 py-1 text-sm">{item.total.toLocaleString()} so‘m</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-lg font-bold mt-4">
        Jami: {order.total.toLocaleString()} so‘m
      </p>
      <p className="mt-2">Qaytarish kodi: {order.returnCode}</p>
    </div>
  );
});

export default Receipt;
