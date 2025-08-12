import React, { useState, useEffect, useMemo, useRef } from "react";
import ReactToPrint from "react-to-print";
import { useNavigate } from "react-router-dom";
import {
  ShoppingCart,
  Search,
  Plus,
  Package,
  X,
  ScanLine,
  Trash2,
} from "lucide-react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { jsPDF } from "jspdf";
import Receipt from "./Receipt/Receipt";

const SalesManagement = ({ selectedBranchId }) => {
  const [showReceipt, setShowReceipt] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [cart, setCart] = useState([]);
  const [customerName, setCustomerName] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState("self-pickup");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const navigate = useNavigate();
  const receiptRef = useRef();

  const API_BASE_URL = "https://suddocs.uz";

  const statusTranslations = {
    IN_WAREHOUSE: "На складе",
    IN_STORE: "В магазине",
    SOLD: "Продан",
    DEFECTIVE: "Бракованный",
    RETURNED: "Возвращён",
  };

  const nameMap = {
    IN_WAREHOUSE: "Omborda",
    IN_STORE: "Do‘konda",
    SOLD: "Sotilgan",
    DEFECTIVE: "Brok",
    RETURNED: "Qaytarilgan",
  };

  const getToken = () => localStorage.getItem("access_token");

  // Retrieve branchId from localStorage, fallback to prop
  const branchId = (() => {
    const storedBranchId = localStorage.getItem("branchId");
    const propBranchId = selectedBranchId;
    const id = storedBranchId || propBranchId;
    const parsedId = Number(id);
    return !isNaN(parsedId) && Number.isInteger(parsedId) && parsedId > 0 ? parsedId : null;
  })();

  const fetchWithAuth = async (url, options = {}) => {
    const token = getToken();
    if (!token) {
      navigate("/login");
      throw new Error("No token found. Please login again.");
    }

    const headers = {
      ...options.headers,
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };

    const response = await fetch(url, { ...options, headers });
    if (response.status === 401) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("userRole");
      localStorage.removeItem("user");
      localStorage.removeItem("userId");
      localStorage.removeItem("branchId");
      navigate("/login", { replace: true });
      throw new Error("Unauthorized: Session expired. Please login again.");
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    }

    return response.json();
  };

  useEffect(() => {
    const loadData = async () => {
      if (!branchId) {
        setError("Filialni tanlang");
        setProducts([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const productsUrl = `${API_BASE_URL}/products?branchId=${branchId}`;
        const [productsData, categoriesData] = await Promise.all([
          fetchWithAuth(productsUrl),
          fetchWithAuth(`${API_BASE_URL}/categories`),
        ]);
        setProducts(productsData);
        setCategories(categoriesData);
        setError(null);
      } catch (err) {
        setError("Ma'lumotlarni yuklashda xatolik: " + err.message);
        toast.error("Ma'lumotlarni yuklashda xatolik: " + err.message);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [branchId, navigate]);

  useEffect(() => {
    let barcode = "";
    const handleKeyPress = (e) => {
      if (e.key === "Enter") {
        if (barcode) {
          const scannedProduct = products.find(
            (p) =>
              p.barcode === barcode ||
              p.id.toString() === barcode ||
              p.name.toLowerCase().includes(barcode.toLowerCase())
          );
          if (scannedProduct) {
            addToCart(scannedProduct);
          } else {
            toast.error("Mahsulot topilmadi!");
          }
          barcode = "";
          setSearchTerm("");
        }
      } else {
        barcode += e.key;
        setSearchTerm((prev) => prev + e.key);
      }
    };

    window.addEventListener("keypress", handleKeyPress);
    return () => window.removeEventListener("keypress", handleKeyPress);
  }, [products]);

  const handleManualBarcode = () => {
    const barcode = prompt("Shtrix-kod, ID yoki nom kiriting:");
    if (barcode) {
      const scannedProduct = products.find(
        (p) =>
          p.barcode === barcode ||
          p.id.toString() === barcode ||
          p.name.toLowerCase().includes(barcode.toLowerCase())
      );
      if (scannedProduct) {
        addToCart(scannedProduct);
      } else {
        toast.error("Mahsulot topilmadi!");
      }
    }
  };

  const categoryOptions = useMemo(() => {
    return [{ id: "all", name: "Barcha kategoriyalar" }, ...categories];
  }, [categories]);

  const filteredProducts = useMemo(() => {
    return products.filter(
      (product) =>
        (selectedCategory === "all" ||
          String(product.categoryId) === String(selectedCategory)) &&
        (product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          product.id.toString().includes(searchTerm) ||
          (product.barcode?.includes(searchTerm) ?? false))
    );
  }, [products, searchTerm, selectedCategory]);

  const addToCart = (product) => {
    const productStatus = statusTranslations[product.status] || product.status;
    if (["DEFECTIVE", "RETURNED", "SOLD"].includes(product.status)) {
      toast.error(
        `Mahsulot ${nameMap[product.status] || productStatus} holatida! Iltimos, boshqa mahsulot tanlang.`
      );
      return;
    }
    if (product.quantity === 0) {
      toast.error(`Mahsulot ${productStatus} holatida mavjud emas!`);
      return;
    }
    const existingItem = cart.find((item) => item.id === product.id);
    if (existingItem) {
      if (existingItem.quantity >= product.quantity) {
        toast.error(
          `${nameMap[product.status] || productStatus} yetarli mahsulot yo'q!`
        );
        return;
      }
      setCart(
        cart.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter((item) => item.id !== productId));
    toast.info("Mahsulot savatdan o‘chirildi");
  };

  const updateQuantity = (productId, quantity) => {
    const product = products.find((p) => p.id === productId);
    if (quantity <= 0) {
      removeFromCart(productId);
    } else if (quantity > product.quantity) {
      toast.error(
        `Yetarli mahsulot ${statusTranslations[product.status] || product.status} holatida yo'q!`
      );
    } else {
      setCart(
        cart.map((item) =>
          item.id === productId ? { ...item, quantity } : item
        )
      );
    }
  };

  const getTotalAmount = () => {
    return cart.reduce((total, item) => total + item.price * item.quantity, 0);
  };

  const generateReceipt = () => {
    const receiptId = `order_${new Date().toISOString().replace(/[-:T.]/g, "")}`;
    const receipt = {
      id: receiptId,
      date: new Date().toISOString(),
      cashier: localStorage.getItem("user") || "Noma‘lum Kassir",
      customer: customerName || "Noma‘lum Mijoz",
      items: cart.map((item) => ({
        id: item.id,
        name: item.name,
        category:
          categories.find((c) => c.id === item.categoryId)?.name || "Noma‘lum",
        quantity: item.quantity,
        price: item.price,
        total: item.price * item.quantity,
      })),
      total: getTotalAmount(),
      returnCode: Math.random().toString(36).substring(2, 10).toUpperCase(),
      branchId: branchId || null,
      deliveryMethod,
      paymentMethod,
    };

    fetchWithAuth(`${API_BASE_URL}/api/receipts`, {
      method: "POST",
      body: JSON.stringify(receipt),
    })
      .then(() => {
      })
      .catch((err) => {
        console.error("Failed to save receipt:", err);
        toast.error("Chekni saqlashda xatolik: " + err.message);
      });

    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Chek #${receipt.id}`, 10, 10);
    doc.setFontSize(12);
    doc.text(`Sana: ${new Date(receipt.date).toLocaleString("uz-UZ")}`, 10, 20);
    doc.text(`Kassir: ${receipt.cashier}`, 10, 30);
    doc.text(`Mijoz: ${receipt.customer}`, 10, 40);
    doc.text(
      `Yetkazib berish usuli: ${
        receipt.deliveryMethod === "delivery"
          ? "Yetkazib berish"
          : "O‘zi olib ketish"
      }`,
      10,
      50
    );
    doc.text(
      `To‘lov usuli: ${
        receipt.paymentMethod === "cash"
          ? "Naqd"
          : receipt.paymentMethod === "card"
          ? "Karta"
          : "Kredit"
      }`,
      10,
      60
    );
    doc.text("Mahsulotlar:", 10, 70);
    let y = 80;
    doc.setFontSize(10);
    doc.text("№  Mahsulot  Kategoriya  Narx  Soni  Jami", 10, y);
    y += 5;
    doc.line(10, y, 200, y);
    y += 5;
    receipt.items.forEach((item, index) => {
      doc.text(
        `${index + 1}  ${item.name}  ${item.category}  ${item.price.toLocaleString()} so'm  ${item.quantity}  ${item.total.toLocaleString()} so'm`,
        10,
        y
      );
      y += 10;
    });
    doc.setFontSize(12);
    doc.text(`Jami: ${receipt.total.toLocaleString()} so'm`, 10, y);
    doc.text(`Qaytarish kodi: ${receipt.returnCode}`, 10, y + 10);
    doc.save(`receipt_${receipt.id}.pdf`);

    return receipt;
  };

  const completeSale = async () => {
    if (cart.length === 0) {
      toast.error("Savat bo‘sh! Iltimos, mahsulot qo‘shing.");
      return;
    }

    const hasEnoughStock = cart.every((item) => {
      const product = products.find((p) => p.id === item.id);
      return product.quantity >= item.quantity;
    });

    if (!hasEnoughStock) {
      const outOfStockItem = cart.find((item) => {
        const product = products.find((p) => p.id === item.id);
        return product.quantity < item.quantity;
      });
      const product = products.find((p) => p.id === outOfStockItem.id);
      toast.error(
        `Yetarli mahsulot ${statusTranslations[product.status] || product.status} holatida yo'q!`
      );
      return;
    }

    setShowConfirmModal(true);
  };

  const confirmSale = async () => {
    try {
      await Promise.all(
        cart.map((item) => {
          const product = products.find((p) => p.id === item.id);
          const newQuantity = product.quantity - item.quantity;
          return fetchWithAuth(`${API_BASE_URL}/products/${item.id}`, {
            method: "PUT",
            body: JSON.stringify({
              quantity: newQuantity,
              status: newQuantity === 0 ? "SOLD" : product.status,
            }),
          });
        })
      );

      const receipt = generateReceipt();

      await fetchWithAuth(`${API_BASE_URL}/api/sales`, {
        method: "POST",
        body: JSON.stringify({
          customer: customerName || "Noma‘lum Mijoz",
          items: cart,
          total: getTotalAmount(),
          date: new Date().toISOString(),
          receiptId: receipt.id,
          branchId: branchId || null,
          deliveryMethod,
          paymentMethod,
        }),
      });

      setProducts(
        products.map((p) => {
          const cartItem = cart.find((item) => item.id === p.id);
          if (cartItem) {
            const newQuantity = p.quantity - cartItem.quantity;
            return {
              ...p,
              quantity: newQuantity,
              status: newQuantity === 0 ? "SOLD" : p.status,
            };
          }
          return p;
        })
      );

      setCart([]);
      setCustomerName("");
      setDeliveryMethod("self-pickup");
      setPaymentMethod("cash");
      setShowSaleModal(false);
      setShowConfirmModal(false);
    } catch (err) {
      toast.error(
        err.message.includes("Unauthorized")
          ? "Autentifikatsiya xatosi! Kirish sahifasiga yo‘naltirilmoqda."
          : "Sotishda xatolik: " + err.message
      );
      console.error("Error completing sale:", err);
      setShowConfirmModal(false);
    }
  };

  return (
    <div className="ml-[260px] space-y-6 p-4">
      <ToastContainer position="top-right" autoClose={3000} />
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <h1 className="text-3xl font-bold text-gray-900">Sotish Tizimi</h1>
          <p className="text-gray-600 mt-1">Mahsulotlarni sotish va savdo qilish</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowSaleModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Savat ({cart.length})</span>
          </button>
        </div>
      </div>

      <div className="flex space-x-2 mb-4 overflow-x-auto">
        {categoryOptions.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(String(cat.id))}
            className={`px-4 py-2 rounded-lg whitespace-nowrap ${
              selectedCategory === String(cat.id)
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            } transition-colors`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="relative flex items-center">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Mahsulot nomi, ID yoki barcode bilan qidiring..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent text-lg"
          />
          <button
            onClick={handleManualBarcode}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            title="Shtrix-kodni qo'lda kiritish"
          >
            <ScanLine size={20} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p>Yuklanmoqda...</p>
        </div>
      ) : error ? (
        <div className="text-center py-12 text-red-600">{error}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">ID</th>
                <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Название</th>
                <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Категория</th>
                <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Штрихкод</th>
                <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Цена</th>
                <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Остаток</th>
                <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Статус</th>
                <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Действие</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {filteredProducts.map((product) => (
                <tr key={product.id}>
                  <td className="px-4 py-2 text-sm text-gray-900">{product.id}</td>
                  <td className="px-4 py-2 text-sm text-gray-900">{product.name}</td>
                  <td className="px-4 py-2 text-sm text-gray-900">
                    {categories.find((c) => String(c.id) === String(product.categoryId))?.name || "Неизвестно"}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-900">{product.barcode || "Нет"}</td>
                  <td className="px-4 py-2 text-sm text-gray-900">
                    {(product.marketPrice || product.price).toLocaleString()} сум
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-900">{product.quantity} шт</td>
                  <td className="px-4 py-2 text-sm text-gray-900">
                    {statusTranslations[product.status] || product.status}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-900">
                    <button
                      onClick={() => addToCart(product)}
                      disabled={product.quantity === 0}
                      className={`py-1 px-3 rounded-md text-sm ${
                        product.quantity === 0
                          ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                          : "bg-blue-600 hover:bg-blue-700 text-white"
                      } transition-colors`}
                    >
                      {product.quantity === 0 ? "Нет в наличии" : "Добавить"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filteredProducts.length === 0 && !loading && !error && (
        <div className="text-center py-12">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Mahsulot topilmadi</h3>
          <p className="text-gray-600">Qidiruv so'zini o'zgartiring</p>
        </div>
      )}

      {showSaleModal && (
        <div className="fixed inset-0 bg-black backdrop-blur-sm bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">Sotish Savati</h3>
                <button
                  onClick={() => setShowSaleModal(false)}
                  className="text-gray-400 hover:text-red-400 hover:bg-gray-100 rounded-md transition-colors p-1"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mijoz nomi (ixtiyoriy)
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Mijoz nomini kiriting (ixtiyoriy)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Yetkazib berish usuli
                </label>
                <select
                  value={deliveryMethod}
                  onChange={(e) => setDeliveryMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                >
                  <option value="self-pickup">O‘zi olib ketish</option>
                  <option value="delivery">Yetkazib berish</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  To‘lov usuli
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                >
                  <option value="cash">Naqd</option>
                  <option value="card">Karta</option>
                  <option value="credit">Kredit</option>
                </select>
              </div>

              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-4">Savatdagi mahsulotlar</h4>
                {cart.length === 0 ? (
                  <div className="text-center py-8">
                    <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">Savat bo'sh</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">№</th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Mahsulot</th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Kategoriya</th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Narx</th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Soni</th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Jami</th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-700"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {cart.map((item, index) => (
                          <tr key={item.id} className="border-b border-gray-200">
                            <td className="px-4 py-2 text-sm">{index + 1}</td>
                            <td className="px-4 py-2 text-sm">{item.name}</td>
                            <td className="px-4 py-2 text-sm">
                              {categories.find((c) => String(c.id) === String(item.categoryId))?.name || "Noma‘lum"}
                            </td>
                            <td className="px-4 py-2 text-sm">{item.price.toLocaleString()} so'm</td>
                            <td className="px-4 py-2 text-sm">
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                  className="w-6 h-6 bg-gray-200 hover:bg-gray-300 rounded-full flex items-center justify-center"
                                >
                                  -
                                </button>
                                <span className="w-8 text-center">{item.quantity}</span>
                                <button
                                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                  className="w-6 h-6 bg-gray-200 hover:bg-gray-300 rounded-full flex items-center justify-center"
                                >
                                  +
                                </button>
                              </div>
                            </td>
                            <td className="px-4 py-2 text-sm">{(item.price * item.quantity).toLocaleString()} so'm</td>
                            <td className="px-4 py-2 text-sm">
                              <button
                                onClick={() => removeFromCart(item.id)}
                                className="text-red-600 hover:text-red-800"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {cart.length > 0 && (
                <div className="border-t border-gray-100 pt-4">
                  <div className="flex items-center justify-between text-xl font-bold">
                    <span>Jami summa:</span>
                    <span className="text-blue-600">{getTotalAmount().toLocaleString()} so'm</span>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-100">
                <button
                  onClick={() => setShowSaleModal(false)}
                  className="px-4 py-2 text-gray-600 hover:text-red-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Bekor qilish
                </button>
                <button
                  onClick={completeSale}
                  disabled={cart.length === 0}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg transition-colors"
                >
                  Sotishni yakunlash
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-xl font-semibold text-gray-900">Sotishni tasdiqlash</h3>
            </div>
            <div className="p-6">
              <p className="text-gray-600 mb-4">
                <strong>{cart.length}</strong> ta mahsulotni{" "}
                <strong>{customerName || "Noma‘lum Mijoz"}</strong> uchun sotishni tasdiqlaysizmi? <br />
                Yetkazib berish usuli:{" "}
                <strong>{deliveryMethod === "delivery" ? "Yetkazib berish" : "O‘zi olib ketish"}</strong> <br />
                To‘lov usuli:{" "}
                <strong>
                  {paymentMethod === "cash" ? "Naqd" : paymentMethod === "card" ? "Karta" : "Kredit"}
                </strong> <br />
                Jami summa: <strong className="text-lg">{getTotalAmount().toLocaleString()} so'm</strong>
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Bekor qilish
                </button>
                <ReactToPrint
                  trigger={() => (
                    <button className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
                      Tasdiqlash va chop etish
                    </button>
                  )}
                  content={() => receiptRef.current}
                  onBeforePrint={confirmSale}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="hidden">
        <Receipt ref={receiptRef} order={cart} onClose={() => setShowReceipt(false)} />
      </div>
    </div>
  );
};

export default SalesManagement;