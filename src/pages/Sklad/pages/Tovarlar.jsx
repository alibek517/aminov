import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const Notification = ({ message, type, onClose }) => (
  <div
    className={`p-4 rounded-lg shadow-md ${
      type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
    } mb-4 transition-all duration-300 ease-in-out`}
  >
    {message}
    <button className="ml-4 text-sm underline hover:text-gray-900" onClick={onClose}>
      Yopish
    </button>
  </div>
);

const Kirim = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();
  const API_URL = 'https://suddocs.uz';

  const formatQuantity = (qty) =>
    qty >= 0 ? new Intl.NumberFormat('uz-UZ').format(qty) + ' дона' : '0 дона';

  const axiosWithAuth = async (config) => {
    const token = localStorage.getItem('access_token') || 'mock-token';
    const headers = { ...config.headers, Authorization: `Bearer ${token}` };
    try {
      const response = await axios({ ...config, headers });
      return response;
    } catch (error) {
      if (error.response?.status === 401) {
        localStorage.clear();
        navigate('/login');
        throw new Error('Sessiya tugadi');
      }
      throw error;
    }
  };

  useEffect(() => {
    const branchIdFromStorage = localStorage.getItem('branchId');
    if (branchIdFromStorage) {
      setSelectedBranchId(branchIdFromStorage);
    } else {
      setNotification({ message: 'Filial ID topilmadi', type: 'error' });
    }
  }, []);

  const [branches, setBranches] = useState([]);

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const branchesRes = await axiosWithAuth({ method: 'get', url: `${API_URL}/branches` });
        setBranches(branchesRes.data);
      } catch (err) {
        console.error('Failed to fetch branches:', err);
      }
    };
    fetchBranches();
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    const branchId = Number(selectedBranchId);
    const storedBranchId = Number(localStorage.getItem('branchId'));
    
    // Only allow operations on the branch from localStorage
    if (branchId !== storedBranchId) {
            setProducts([]);
      setLoading(false);
      return;
    }

    const isValidBranchId = !isNaN(branchId) && Number.isInteger(branchId) && branchId > 0;

    if (!isValidBranchId) {
      setNotification({ message: 'Filial tanlanmagan', type: 'error' });
      setProducts([]);
      setLoading(false);
      return;
    }

    try {
      const queryParams = new URLSearchParams();
      queryParams.append('branchId', branchId.toString());
      queryParams.append('includeZeroQuantity', 'true');
      const productsRes = await axiosWithAuth({
        method: 'get',
        url: `${API_URL}/products?${queryParams.toString()}`,
      });
      setProducts(productsRes.data);
    } catch (err) {
      setNotification({ message: err.message || "Ma'lumotlarni yuklashda xatolik", type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [navigate, selectedBranchId]);

  useEffect(() => {
    if (selectedBranchId) {
      loadData();
    }
  }, [loadData, selectedBranchId]);

  const validateFields = () => {
    const newErrors = {};
    if (!quantity || isNaN(quantity) || Number(quantity) <= 0)
      newErrors.quantity = "Miqdor 0 dan katta bo'lishi kerak";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAddStock = async () => {
    if (!validateFields()) {
      setNotification({ message: "Barcha maydonlarni to'g'ri to'ldiring", type: 'error' });
      return;
    }
    
    // Check if user is operating on their own branch
    const storedBranchId = Number(localStorage.getItem('branchId'));
    if (Number(selectedBranchId) !== storedBranchId) {
      setNotification({ message: 'Faqat sizning filialingizda miqdor qo\'shish mumkin', type: 'error' });
      return;
    }
    
    setSubmitting(true);
    try {
      const userId = Number(localStorage.getItem('userId')) || 1;
      const selectedProduct = products.find((p) => p.id === Number(selectedProductId));
      const payload = {
        userId,
        type: 'PURCHASE',
        status: 'PENDING',
        total: selectedProduct.price * Number(quantity),
        finalTotal: selectedProduct.price * Number(quantity),
        fromBranchId: Number(selectedBranchId),
        items: [
          {
            productId: Number(selectedProductId),
            quantity: Number(quantity),
            price: selectedProduct.price || 0,
            total: selectedProduct.price * Number(quantity),
          },
        ],
      };
      await axiosWithAuth({
        method: 'post',
        url: `${API_URL}/transactions`,
        data: payload,
      });
      setModalOpen(false);
      resetForm();
      loadData();
    } catch (err) {
      setNotification({
        message: err.response?.data?.message || "Miqdor qo'shishda xatolik",
        type: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedProductId('');
    setQuantity('');
    setErrors({});
  };

  const closeModal = () => {
    setModalOpen(false);
    resetForm();
  };

  const filteredProducts = products.filter((p) => {
    const lowerSearch = searchTerm.toLowerCase();
    const isLast4 = searchTerm.length === 4 && /^\d{4}$/.test(searchTerm);
    return (
      p.name.toLowerCase().includes(lowerSearch) ||
      (p.model && p.model.toLowerCase().includes(lowerSearch)) ||
      (p.barcode && p.barcode.toLowerCase().includes(lowerSearch)) ||
      (isLast4 && p.barcode && p.barcode.endsWith(searchTerm))
    );
  });

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">Кирим</h1>

      {notification && <Notification {...notification} onClose={() => setNotification(null)} />}

      <div className="mb-6">
        <label className="block text-lg font-semibold text-gray-800 mb-3">Филиални танланг</label>
        <select
          value={selectedBranchId}
          onChange={(e) => setSelectedBranchId(e.target.value)}
          className="w-full max-w-md px-5 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
        >
          <option value="">Филиални танланг</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-center text-gray-600">Юкланмоқда...</div>
      ) : (
        <>
          <div className="mb-4">
            <input
              type="text"
              placeholder="Қидирув: номи, модели, баркод ёки охирги 4 рақам..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full p-2 border rounded-md focus:outline-none focus:border-blue-500 border-gray-300 transition-all duration-200"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full bg-white border border-gray-200 rounded-lg shadow-md">
              <thead>
                <tr className="bg-gray-100 text-gray-700">
                  <th className="p-4 text-left font-semibold">ID</th>
                  <th className="p-4 text-left font-semibold">Номи</th>
                  <th className="p-4 text-left font-semibold">Модели</th>
                  <th className="p-4 text-left font-semibold">Баркод</th>
                  <th className="p-4 text-left font-semibold">Филиал</th>
                  <th className="p-4 text-left font-semibold">Миқдор</th>
                  <th className="p-4 text-left font-semibold">Амаллар</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.length > 0 ? (
                  filteredProducts.map((product) => (
                    <tr key={product.id} className="border-b border-gray-200 last:border-none">
                      <td className="p-4 text-gray-800">#{product.id}</td>
                      <td className="p-4 text-gray-800">{product.name}</td>
                      <td className="p-4 text-gray-800">{product.model || "N/A"}</td>
                      <td className="p-4 text-gray-800">{product.barcode || "N/A"}</td>
                      <td className="p-4 text-gray-800">{product.branch?.name || "Номаълум"}</td>
                      <td className="p-4 text-gray-800">{formatQuantity(product.quantity)}</td>
                      <td className="p-4">
                        <button
                          onClick={() => {
                            setSelectedProductId(product.id);
                            setModalOpen(true);
                          }}
                          disabled={Number(selectedBranchId) !== Number(localStorage.getItem('branchId'))}
                          className={`px-3 py-1 rounded-md transition-all duration-200 ${
                            Number(selectedBranchId) === Number(localStorage.getItem('branchId'))
                              ? 'bg-blue-500 text-white hover:bg-blue-600'
                              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          }`}
                        >
                          Миқдор қўшиш
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="p-4 text-center text-gray-600">
                      Маҳсулотлар топилмади
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {modalOpen && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-full max-w-md">
                <div className="flex justify-between mb-4">
                  <h3 className="text-xl font-semibold text-gray-800">Миқдор Қўшиш</h3>
                  <button onClick={closeModal} className="text-gray-600 hover:text-gray-900">
                    X
                  </button>
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    <tr>
                      <td className="py-2 text-gray-700">Маҳсулот</td>
                      <td className="py-2 text-gray-800">
                        {products.find((p) => p.id === selectedProductId)?.name || "Номаълум"}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 text-gray-700">Модели</td>
                      <td className="py-2 text-gray-800">
                        {products.find((p) => p.id === selectedProductId)?.model || "N/A"}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 text-gray-700">Баркод</td>
                      <td className="py-2 text-gray-800">
                        {products.find((p) => p.id === selectedProductId)?.barcode || "N/A"}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 text-gray-700">Миқдор</td>
                      <td>
                        <input
                          type="number"
                          value={quantity}
                          onChange={(e) => setQuantity(e.target.value)}
                          className={`w-full p-2 border rounded-md focus:outline-none focus:border-blue-500 ${
                            errors.quantity ? 'border-red-500' : 'border-gray-300'
                          } transition-all duration-200`}
                          min="1"
                        />
                        {errors.quantity && (
                          <span className="text-red-500 text-xs">{errors.quantity}</span>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div className="flex gap-2 mt-4">
                  <button
                    onClick={handleAddStock}
                    disabled={submitting}
                    className="flex-1 bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:bg-gray-400 transition-all duration-200"
                  >
                    {submitting ? 'Юкланмоқда...' : 'Сақлаш'}
                  </button>
                  <button
                    onClick={closeModal}
                    className="flex-1 bg-gray-200 px-4 py-2 rounded-md hover:bg-gray-300 transition-all duration-200"
                  >
                    Бекор
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Kirim;