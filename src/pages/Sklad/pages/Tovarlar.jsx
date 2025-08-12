import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

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
        setBranches(branchesRes.data);
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
      const productsRes = await axiosWithAuth({ method: 'get', url: `${API_URL}/products?${queryParams.toString()}` });
      setProducts(productsRes.data);
    } catch (err) {
      setNotification({ message: err.message || 'Ma\'lumotlarni yuklashda xatolik', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [navigate, selectedBranchId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const validateFields = () => {
    const newErrors = {};
    if (!selectedProductId) newErrors.product = 'Tovar tanlanishi shart';
    if (!branch) newErrors.branch = 'Filial tanlanishi shart';
    if (!quantity || isNaN(quantity) || Number(quantity) <= 0) newErrors.quantity = 'Miqdor 0 dan katta bo\'lishi kerak';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAddStock = async () => {
    if (!validateFields()) {
      setNotification({ message: 'Barcha maydonlarni to\'g\'ri to\'ldiring', type: 'error' });
      return;
    }
    setSubmitting(true);
    try {
      const userId = Number(localStorage.getItem('userId')) || 1;
      const selectedProduct = products.find(p => p.id === Number(selectedProductId));
      const payload = {
        userId,
        type: 'STOCK_ADJUSTMENT',
        status: 'PENDING',
        total: 0,
        finalTotal: 0,
        branchId: Number(branch),
        items: [{
          productId: Number(selectedProductId),
          quantity: Number(quantity),
          price: selectedProduct.price || 0,
          total: 0,
        }],
      };
      console.log('Submitting STOCK_ADJUSTMENT transaction:', payload);
      await axiosWithAuth({
        method: 'post',
        url: `${API_URL}/transactions`,
        data: payload,
      });
      setNotification({ message: 'Miqdor muvaffaqiyatli qo\'shildi', type: 'success' });
      setModalOpen(false);
      resetForm();
      loadData();
    } catch (err) {
      setNotification({ message: err.response?.data?.message || 'Miqdor qo\'shishda xatolik', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedProductId('');
    setBranch('');
    setQuantity('');
    setErrors({});
  };

  const closeModal = () => {
    setModalOpen(false);
    resetForm();
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Kirim</h1>
      <select
        value={selectedBranchId}
        onChange={(e) => setSelectedBranchId(e.target.value)}
        className="w-full p-2 border rounded mb-4"
      >
        <option value="">Filial tanlang</option>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>{b.name}</option>
        ))}
      </select>
      {notification && (
        <div className={`p-4 rounded ${notification.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'} mb-4`}>
          {notification.message}
          <button className="ml-4 text-sm underline" onClick={() => setNotification(null)}>Yopish</button>
        </div>
      )}
      <button
        onClick={() => setModalOpen(true)}
        className="bg-blue-500 text-white p-2 rounded mb-4"
      >
        Miqdor Qo'shish
      </button>
      {loading ? (
        <div className="text-center">Yuklanmoqda...</div>
      ) : (
        <>
          <table className="w-full bg-white border rounded mb-4">
            <thead>
              <tr className="bg-gray-200">
                <th className="p-2 text-left">ID</th>
                <th className="p-2 text-left">Nomi</th>
                <th className="p-2 text-left">Filial</th>
                <th className="p-2 text-left">Miqdor</th>
              </tr>
            </thead>
            <tbody>
              {products.length > 0 ? (
                products.map((product) => (
                  <tr key={product.id} className="border-b">
                    <td className="p-2">#{product.id}</td>
                    <td className="p-2">{product.name}</td>
                    <td className="p-2">{product.branch?.name || 'Noma\'lum'}</td>
                    <td className="p-2">{formatQuantity(product.quantity)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="p-2 text-center">Tovarlar topilmadi</td>
                </tr>
              )}
            </tbody>
          </table>
          {modalOpen && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded p-4 w-full max-w-md">
                <div className="flex justify-between mb-4">
                  <h3 className="text-lg font-bold">Miqdor Qo'shish</h3>
                  <button onClick={closeModal} className="text-gray-600">X</button>
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    <tr>
                      <td className="py-1">Tovar</td>
                      <td>
                        <select
                          value={selectedProductId}
                          onChange={(e) => setSelectedProductId(e.target.value)}
                          className={`w-full p-1 border rounded ${errors.product ? 'border-red-500' : ''}`}
                        >
                          <option value="">Tanlang</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                        {errors.product && <span className="text-red-500 text-xs">{errors.product}</span>}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1">Filial</td>
                      <td>
                        <select
                          value={branch}
                          onChange={(e) => setBranch(e.target.value)}
                          className={`w-full p-1 border rounded ${errors.branch ? 'border-red-500' : ''}`}
                        >
                          <option value="">Tanlang</option>
                          {branches.map((b) => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                          ))}
                        </select>
                        {errors.branch && <span className="text-red-500 text-xs">{errors.branch}</span>}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1">Miqdor</td>
                      <td>
                        <input
                          type="number"
                          value={quantity}
                          onChange={(e) => setQuantity(e.target.value)}
                          className={`w-full p-1 border rounded ${errors.quantity ? 'border-red-500' : ''}`}
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
                    className="flex-1 bg-blue-500 text-white p-2 rounded disabled:bg-gray-400"
                  >
                    {submitting ? 'Yuklanmoqda...' : 'Saqlash'}
                  </button>
                  <button
                    onClick={closeModal}
                    className="flex-1 bg-gray-200 p-2 rounded"
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