import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Scan, RotateCcw, CheckCircle } from "lucide-react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const DefectiveManagement = ({ selectedBranchId }) => {
  const [products, setProducts] = useState([]);
  const [defectiveProducts, setDefectiveProducts] = useState([]);
  const [fixedProducts, setFixedProducts] = useState([]);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [returnBarcodeInput, setReturnBarcodeInput] = useState("");
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [restoreCounts, setRestoreCounts] = useState({});

  const navigate = useNavigate();
  const API_BASE_URL = "https://suddocs.uz";

  const branchId = (() => {
    const storedBranchId = localStorage.getItem("branchId");
    const propBranchId = selectedBranchId;
    const id = storedBranchId || propBranchId;
    const parsedId = Number(id);
    return !isNaN(parsedId) && Number.isInteger(parsedId) && parsedId > 0 ? parsedId : null;
  })();

  const getToken = () => localStorage.getItem("access_token");

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
    }

    return response.json();
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!branchId) {
        setError("Filialni tanlang");
        setProducts([]);
        setDefectiveProducts([]);
        setFixedProducts([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const productsUrl = `${API_BASE_URL}/products?branchId=${branchId}`;
        const defectiveUrl = `${API_BASE_URL}/products/defective?branchId=${branchId}`;
        const fixedUrl = `${API_BASE_URL}/products/fixed?branchId=${branchId}`;
        const [productsRes, categoriesRes, defectiveRes, fixedRes] = await Promise.all([
          fetchWithAuth(productsUrl),
          fetchWithAuth(`${API_BASE_URL}/categories`),
          fetchWithAuth(defectiveUrl),
          fetchWithAuth(fixedUrl),
        ]);

        setProducts(productsRes);
        setCategories(categoriesRes);
        setDefectiveProducts(defectiveRes);
        setFixedProducts(fixedRes);
        setError(null);
      } catch (err) {
        setError("Ma'lumotlarni yuklashda xatolik: " + err.message);
        toast.error("Ma'lumotlarni yuklashda xatolik: " + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [branchId, navigate]);

  const updateProductStatus = async (barcode, status) => {
    if (!barcode.trim()) {
      toast.error("Barcode kiriting!");
      return;
    }

    const product = products.find((p) => p.barcode === barcode.trim());
    if (!product) {
      toast.error("Mahsulot topilmadi!");
      return;
    }
    if (product.status === status) {
      toast.warning(`Bu mahsulot allaqachon ${status} deb belgilangan!`);
      return;
    }

    try {
      await fetchWithAuth(`${API_BASE_URL}/products/${product.id}`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });

      setProducts(
        products.map((p) => (p.id === product.id ? { ...p, status } : p))
      );

      if (status === "DEFECTIVE") {
        setBarcodeInput("");
      } else if (status === "RETURNED") {
        setReturnBarcodeInput("");
      }
    } catch (err) {
      toast.error("Statusni o'zgartirishda xatolik: " + err.message);
    }
  };

  const restoreProduct = async (productId, restoreCount) => {
    const product = defectiveProducts.find((p) => p.id === productId);
    if (!product) {
      toast.error("Mahsulot topilmadi!");
      return;
    }
    if (restoreCount <= 0 || restoreCount > product.defectiveQuantity) {
      toast.error("Noto'g'ri qaytarish miqdori!");
      return;
    }

    try {
      const updatedProduct = await fetchWithAuth(`${API_BASE_URL}/products/${product.id}/restore-defective`, {
        method: "PUT",
        body: JSON.stringify({ restoreCount }),
      });

      // Update defective products
      setDefectiveProducts(prev =>
        prev.map(p =>
          p.id === productId
            ? updatedProduct
            : p
        ).filter(p => p.defectiveQuantity > 0)
      );

      // If fully restored, add to fixed
      if (updatedProduct.defectiveQuantity === 0) {
        setFixedProducts(prev => [...prev, updatedProduct]);
      }

      // Update main products list if needed
      setProducts(prev =>
        prev.map(p =>
          p.id === productId ? updatedProduct : p
        )
      );

      setRestoreCounts(prev => ({ ...prev, [productId]: "" }));
      toast.success("Mahsulot muvaffaqiyatli tuzatildi!");
    } catch (err) {
      toast.error("Qayta faollashtirishda xatolik: " + err.message);
    }
  };

  const returnedProducts = products.filter((p) => p.status === "RETURNED");

  return (
    <div className="ml-[255px] space-y-6 p-4">
      <ToastContainer position="top-right" autoClose={3000} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Brak va Qaytarilgan Mahsulotlar
          </h1>
          <p className="text-gray-600 mt-1">
            Mahsulotlarni brak, qaytarilgan yoki tuzatilgan deb belgilash
          </p>
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Brak */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-red-100 p-2 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Brak Mahsulot
                </h2>
                <p className="text-gray-600 text-sm">
                  Barcode orqali brak deb belgilash
                </p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="relative">
                <Scan className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  placeholder="Barcode kiriting..."
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-lg"
                  onKeyPress={(e) =>
                    e.key === "Enter" && updateProductStatus(barcodeInput, "DEFECTIVE")
                  }
                />
              </div>
              <button
                onClick={() => updateProductStatus(barcodeInput, "DEFECTIVE")}
                className="w-full bg-red-600 hover:bg-red-700 text-white py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
              >
                <AlertTriangle className="w-5 h-5" />
                <span>Brak deb belgilash</span>
              </button>
            </div>
          </div>

          {/* Qaytarilgan */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-orange-100 p-2 rounded-lg">
                <RotateCcw className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Qaytarilgan Mahsulot
                </h2>
                <p className="text-gray-600 text-sm">
                  Barcode orqali qaytarilgan deb belgilash
                </p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="relative">
                <Scan className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={returnBarcodeInput}
                  onChange={(e) => setReturnBarcodeInput(e.target.value)}
                  placeholder="Barcode kiriting..."
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-lg"
                  onKeyPress={(e) =>
                    e.key === "Enter" && updateProductStatus(returnBarcodeInput, "RETURNED")
                  }
                />
              </div>
              <button
                onClick={() => updateProductStatus(returnBarcodeInput, "RETURNED")}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
              >
                <RotateCcw className="w-5 h-5" />
                <span>Qaytarilgan deb belgilash</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Brak List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-xl font-semibold text-gray-900">
            Brak Mahsulotlar ({defectiveProducts.length})
          </h2>
        </div>
        <div className="p-6">
          {defectiveProducts.length === 0 ? (
            <div className="text-center py-8">
              <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Brak mahsulotlar yo'q</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-red-100">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-red-700">ID</th>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-red-700">Название</th>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-red-700">Категория</th>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-red-700">Филиал</th>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-red-700">Штрихкод</th>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-red-700">Defective Miqdori</th>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-red-700">Tuzatish Miqdori</th>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-red-700"></th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {defectiveProducts.map((product) => (
                    <tr key={product.id}>
                      <td className="px-4 py-2 text-sm text-gray-900">{product.id}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{product.name}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {categories.find((cat) => String(cat.id) === String(product.categoryId))?.name || "Неизвестно"}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900">{product.branch?.name || "No'malum"}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{product.barcode || "—"}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{product.defectiveQuantity || 0}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">
                        <input
                          type="number"
                          min="1"
                          max={product.defectiveQuantity}
                          value={restoreCounts[product.id] || ""}
                          onChange={(e) =>
                            setRestoreCounts((prev) => ({
                              ...prev,
                              [product.id]: e.target.value,
                            }))
                          }
                          placeholder="Miqdor"
                          className="w-24 px-2 py-1 border border-gray-300 rounded-lg"
                        />
                      </td>
                      <td className="px-4 py-2 text-sm text-right">
                        <button
                          onClick={() => restoreProduct(product.id, Number(restoreCounts[product.id]))}
                          className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                        >
                          Tuzatildi
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Fixed List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-xl font-semibold text-gray-900">
            Tuzatilgan Mahsulotlar ({fixedProducts.length})
          </h2>
        </div>
        <div className="p-6">
          {fixedProducts.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Tuzatilgan mahsulotlar yo'q</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-green-100">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-green-700">ID</th>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-green-700">Название</th>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-green-700">Категория</th>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-green-700">Филиал</th>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-green-700">Штрихкод</th>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-green-700">Miqdori</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {fixedProducts.map((product) => (
                    <tr key={product.id}>
                      <td className="px-4 py-2 text-sm text-gray-900">{product.id}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{product.name}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {categories.find((c) => String(c.id) === String(product.categoryId))?.name || "Неизвестно"}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900">{product.branch?.name || "No'malum"}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{product.barcode || "—"}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{product.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Returned List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-xl font-semibold text-gray-900">
            Qaytarilgan Mahsulotlar ({returnedProducts.length})
          </h2>
        </div>
        <div className="p-6">
          {returnedProducts.length === 0 ? (
            <div className="text-center py-8">
              <RotateCcw className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Qaytarilgan mahsulotlar yo'q</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-orange-100">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-orange-700">ID</th>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-orange-700">Название</th>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-orange-700">Категория</th>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-orange-700">Филиал</th>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-orange-700">Штрихкод</th>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-orange-700"></th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {returnedProducts.map((product) => (
                    <tr key={product.id}>
                      <td className="px-4 py-2 text-sm text-gray-900">{product.id}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{product.name}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {categories.find((c) => String(c.id) === String(product.categoryId))?.name || "Неизвестно"}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900">{product.branch?.name || "No'malum"}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{product.barcode || "—"}</td>
                      <td className="px-4 py-2 text-sm text-right">
                        <button
                          onClick={() => restoreProduct(product.id, product.quantity)}
                          className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                        >
                          Восстановить
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DefectiveManagement;