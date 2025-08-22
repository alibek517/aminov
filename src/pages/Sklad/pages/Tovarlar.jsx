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
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [branch, setBranch] = useState('');
  const [quantity, setQuantity] = useState('');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const navigate = useNavigate();
  const API_URL = 'https://suddocs.uz';

  const formatQuantity = (qty) => (qty >= 0 ? new Intl.NumberFormat('uz-UZ').format(qty) + ' dona' : '0 dona');

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
    const fetchBranches = async () => {
      try {
        const branchesRes = await axiosWithAuth({ method: 'get', url: `${API_URL}/branches` });
        const branchesData = branchesRes.data;
        setBranches(branchesData);

        // Avtomatik ravishda "Ombor" filialini tanlash
        const omborBranch = branchesData.find((b) => b.name === 'Ombor');
        if (omborBranch) {
          setSelectedBranchId(omborBranch.id.toString());
          setBranch(omborBranch.id.toString());
        } else {
          setNotification({ message: '"Ombor" filiali topilmadi', type: 'error' });
        }
      } catch (err) {
        setNotification({ message: err.message || 'Filiallarni yuklashda xatolik', type: 'error' });
      }
    };
    fetchBranches();
  }, [navigate]);

  const loadData = useCallback(async () => {
    setLoading(true);
    const branchId = Number(selectedBranchId);
    const isValidBranchId = !isNaN(branchId) && Number.isInteger(branchId) && branchId > 0;

    if (!isValidBranchId) {
      setNotification({ message: 'Filialni tanlang', type: 'error' });
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
      setNotification({ message: err.message || 'Ma\'lumotlarni yuklashda xatolik', type: 'error' });
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
    if (!selectedProductId) newErrors.product = 'Tovar tanlanishi shart';
    if (!branch) newErrors.branch = 'Filial tanlanishi shart';
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
        fromBranchId: Number(branch),
        items: [
          {
            productId: Number(selectedProductId),
            quantity: Number(quantity),
            price: selectedProduct.price || 0,
            total: selectedProduct.price * Number(quantity),
          },
        ],
      };
      console.log('Submitting STOCK_ADJUSTMENT transaction:', payload);
      await axiosWithAuth({
        method: 'post',
        url: `${API_URL}/transactions`,
        data: payload,
      });
      setNotification({ message: "Miqdor muvaffaqiyatli qo'shildi", type: 'success' });
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
    setBranch(selectedBranchId || '');
    setQuantity('');
    setErrors({});
  };

  const closeModal = () => {
    setModalOpen(false);
    resetForm();
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">Kirim</h1>
      <select
        value={selectedBranchId}
        onChange={(e) => {
          setSelectedBranchId(e.target.value);
          setBranch(e.target.value);
        }}
        className="w-full max-w-xs p-2 border border-gray-300 rounded-md mb-6 bg-white text-gray-700 focus:outline-none focus:border-blue-500 transition-all duration-200"
      >
        <option value="">Filial tanlang</option>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
      {notification && <Notification {...notification} onClose={() => setNotification(null)} />}
      <button
        onClick={() => setModalOpen(true)}
        className="bg-blue-500 text-white px-4 py-2 rounded-md mb-6 hover:bg-blue-600 transition-all duration-200"
      >
        Miqdor Qo'shish
      </button>
      {loading ? (
        <div className="text-center text-gray-600">Yuklanmoqda...</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full bg-white border border-gray-200 rounded-lg shadow-md">
              <thead>
                <tr className="bg-gray-100 text-gray-700">
                  <th className="p-4 text-left font-semibold">ID</th>
                  <th className="p-4 text-left font-semibold">Nomi</th>
                  <th className="p-4 text-left font-semibold">Filial</th>
                  <th className="p-4 text-left font-semibold">Miqdor</th>
                </tr>
              </thead>
              <tbody>
                {products.length > 0 ? (
                  products.map((product) => (
                    <tr key={product.id} className="border-b border-gray-200 last:border-none">
                      <td className="p-4 text-gray-800">#{product.id}</td>
                      <td className="p-4 text-gray-800">{product.name}</td>
                      <td className="p-4 text-gray-800">{product.branch?.name || "Noma'lum"}</td>
                      <td className="p-4 text-gray-800">{formatQuantity(product.quantity)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="p-4 text-center text-gray-600">
                      Tovarlar topilmadi
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {modalOpen && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-full max-w-md transform transition-all duration-300 scale-95 modal-open:scale-100">
                <div className="flex justify-between mb-4">
                  <h3 className="text-xl font-semibold text-gray-800">Miqdor Qo'shish</h3>
                  <button onClick={closeModal} className="text-gray-600 hover:text-gray-900">
                    X
                  </button>
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    <tr>
                      <td className="py-2 text-gray-700">Tovar</td>
                      <td>
                        <select
                          value={selectedProductId}
                          onChange={(e) => setSelectedProductId(e.target.value)}
                          className={`w-full p-2 border rounded-md focus:outline-none focus:border-blue-500 ${
                            errors.product ? 'border-red-500' : 'border-gray-300'
                          } transition-all duration-200`}
                        >
                          <option value="">Tanlang</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                        {errors.product && <span className="text-red-500 text-xs">{errors.product}</span>}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 text-gray-700">Filial</td>
                      <td>
                        <select
                          value={branch}
                          onChange={(e) => setBranch(e.target.value)}
                          className={`w-full p-2 border rounded-md focus:outline-none focus:border-blue-500 ${
                            errors.branch ? 'border-red-500' : 'border-gray-300'
                          } transition-all duration-200`}
                        >
                          <option value="">Tanlang</option>
                          {branches.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name}
                            </option>
                          ))}
                        </select>
                        {errors.branch && <span className="text-red-500 text-xs">{errors.branch}</span>}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 text-gray-700">Miqdor</td>
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
                        {errors.quantity && <span className="text-red-500 text-xs">{errors.quantity}</span>}
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
                    {submitting ? 'Yuklanmoqda...' : 'Saqlash'}
                  </button>
                  <button
                    onClick={closeModal}
                    className="flex-1 bg-gray-200 px-4 py-2 rounded-md hover:bg-gray-300 transition-all duration-200"
                  >
                    Bekor
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