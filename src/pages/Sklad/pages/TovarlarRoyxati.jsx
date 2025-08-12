import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const TovarlarRoyxati = () => {
  const [products, setProducts] = useState([]);
  const [branches, setBranches] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadBranch, setUploadBranch] = useState('');
  const [uploadCategory, setUploadCategory] = useState('');
  const [uploadStatus, setUploadStatus] = useState('IN_STORE');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [editName, setEditName] = useState('');
  const [editBarcode, setEditBarcode] = useState('');
  const [editModel, setEditModel] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editBranch, setEditBranch] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editQuantity, setEditQuantity] = useState('');
  const [createName, setCreateName] = useState('');
  const [createBarcode, setCreateBarcode] = useState('');
  const [createModel, setCreateModel] = useState('');
  const [createPrice, setCreatePrice] = useState('');
  const [createQuantity, setCreateQuantity] = useState('');
  const [createStatus, setCreateStatus] = useState('IN_STORE');
  const [createBranch, setCreateBranch] = useState('');
  const [createCategory, setCreateCategory] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createMarketPrice, setCreateMarketPrice] = useState('');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();
  const API_URL = 'https://suddocs.uz';

  const formatPrice = (price) => (price >= 0 ? new Intl.NumberFormat('uz-UZ').format(price) + ' so\'m' : 'Noma\'lum');
  const formatQuantity = (qty) => (qty >= 0 ? new Intl.NumberFormat('uz-UZ').format(qty) + ' dona' : 'Noma\'lum');

  const statusOptions = [
    { value: 'IN_WAREHOUSE', label: 'Skladda' },
    { value: 'IN_STORE', label: 'Do\'konda' },
    { value: 'SOLD', label: 'Sotilgan' },
    { value: 'DEFECTIVE', label: 'Nuqsonli' },
    { value: 'RETURNED', label: 'Qaytarilgan' },
    { value: 'CARRIER', label: 'Tashuvchi' },
  ];

  const axiosWithAuth = async (config) => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      navigate('/login');
      throw new Error('No token found');
    }
    const headers = { ...config.headers, Authorization: `Bearer ${token}` };
    try {
      const response = await axios({ ...config, headers });
      return response;
    } catch (error) {
      if (error.response?.status === 401) {
        localStorage.clear();
        navigate('/login');
        throw new Error('Session expired');
      }
      throw error;
    }
  };

  useEffect(() => {
    const fetchBranchesAndCategories = async () => {
      try {
        const [branchesRes, categoriesRes] = await Promise.all([
          axiosWithAuth({ method: 'get', url: `${API_URL}/branches` }),
          axiosWithAuth({ method: 'get', url: `${API_URL}/categories` }),
        ]);
        setBranches(branchesRes.data);
        setCategories(categoriesRes.data);
      } catch (err) {
        setNotification({ message: err.message || 'Filial va kategoriyalarni yuklashda xatolik', type: 'error' });
      }
    };
    fetchBranchesAndCategories();
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
      if (searchTerm.trim()) queryParams.append('search', searchTerm);
      const productsRes = await axiosWithAuth({ method: 'get', url: `${API_URL}/products?${queryParams.toString()}` });
      setProducts(productsRes.data);
    } catch (err) {
      setNotification({ message: err.message || 'Ma\'lumotlarni yuklashda xatolik', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [navigate, searchTerm, selectedBranchId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openEditModal = (product) => {
    setSelectedProduct(product);
    setEditName(product.name);
    setEditBarcode(product.barcode || '');
    setEditModel(product.model || '');
    setEditPrice(product.price ? product.price.toString() : '0');
    setEditQuantity(product.quantity ? product.quantity.toString() : '0');
    setEditStatus(product.status || 'IN_STORE');
    setEditBranch(product.branchId ? product.branchId.toString() : selectedBranchId || '');
    setEditCategory(product.categoryId ? product.categoryId.toString() : '');
    setErrors({});
    setShowEditModal(true);
  };

  const openCreateModal = () => {
    setCreateName('');
    setCreateBarcode('');
    setCreateModel('');
    setCreatePrice('');
    setCreateQuantity('');
    setCreateStatus('IN_STORE');
    setCreateBranch(selectedBranchId || '');
    setCreateCategory('');
    setCreateDescription('');
    setCreateMarketPrice('');
    setErrors({});
    setShowCreateModal(true);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setSelectedProduct(null);
    setEditName('');
    setEditBarcode('');
    setEditModel('');
    setEditPrice('');
    setEditQuantity('');
    setEditStatus('');
    setEditBranch('');
    setEditCategory('');
    setErrors({});
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setCreateName('');
    setCreateBarcode('');
    setCreateModel('');
    setCreatePrice('');
    setCreateQuantity('');
    setCreateStatus('IN_STORE');
    setCreateBranch('');
    setCreateCategory('');
    setCreateDescription('');
    setCreateMarketPrice('');
    setErrors({});
  };

  const closeUploadModal = () => {
    setShowUploadModal(false);
    setSelectedFile(null);
    setUploadBranch('');
    setUploadCategory('');
    setUploadStatus('IN_STORE');
    setErrors({});
  };

  const validateFields = (isCreate = false) => {
    const newErrors = {};
    const name = isCreate ? createName : editName;
    const barcode = isCreate ? createBarcode : editBarcode;
    const model = isCreate ? createModel : editModel;
    const price = isCreate ? createPrice : editPrice;
    const quantity = isCreate ? createQuantity : editQuantity;
    const branch = isCreate ? createBranch : editBranch;
    const category = isCreate ? createCategory : editCategory;

    if (!name.trim()) newErrors.name = 'Nomi kiritilishi shart';
    if (!barcode.trim()) newErrors.barcode = 'Shtrix kiritilishi shart';
    if (!model.trim()) newErrors.model = 'Model kiritilishi shart';
    if (!price || isNaN(price) || Number(price) < 0) newErrors.price = 'Narx 0 dan katta yoki teng bo\'lishi kerak';
    if (!quantity || isNaN(quantity) || Number(quantity) < 0) newErrors.quantity = 'Miqdor 0 dan katta yoki teng bo\'lishi kerak';
    if (!branch) newErrors.branch = 'Filial tanlanishi shart';
    if (!category) newErrors.category = 'Kategoriya tanlanishi shart';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateUploadFields = () => {
    const newErrors = {};
    if (!uploadBranch) newErrors.branch = 'Filial tanlanishi shart';
    if (!uploadCategory) newErrors.category = 'Kategoriya tanlanishi shart';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!validateFields()) {
      setNotification({ message: 'Barcha maydonlarni to\'g\'ri to\'ldiring', type: 'error' });
      return;
    }
    setSubmitting(true);
    try {
      await axiosWithAuth({
        method: 'put',
        url: `${API_URL}/products/${selectedProduct.id}`,
        data: {
          name: editName,
          barcode: editBarcode,
          model: editModel,
          price: Number(editPrice),
          quantity: Number(editQuantity),
          status: editStatus,
          branchId: Number(editBranch),
          categoryId: Number(editCategory),
        },
      });
      setNotification({ message: 'Mahsulot muvaffaqiyatli yangilandi', type: 'success' });
      closeEditModal();
      loadData();
    } catch (err) {
      setNotification({ message: err.response?.data?.message || 'Mahsulotni yangilashda xatolik', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!validateFields(true)) {
      setNotification({ message: 'Barcha maydonlarni to\'g\'ri to\'ldiring', type: 'error' });
      return;
    }
    setSubmitting(true);
    try {
      await axiosWithAuth({
        method: 'post',
        url: `${API_URL}/products`,
        data: {
          name: createName,
          barcode: createBarcode,
          model: createModel,
          price: Number(createPrice),
          quantity: Number(createQuantity),
          status: createStatus,
          branchId: Number(createBranch),
          categoryId: Number(createCategory),
          description: createDescription || undefined,
          marketPrice: createMarketPrice ? Number(createMarketPrice) : undefined,
        },
      });
      setNotification({ message: 'Mahsulot muvaffaqiyatli qo\'shildi', type: 'success' });
      closeCreateModal();
      loadData();
    } catch (err) {
      setNotification({ message: err.response?.data?.message || 'Mahsulot qo\'shishda xatolik', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (product) => {
    if (!window.confirm(`"${product.name}" mahsulotini o\'chirishni xohlaysizmi?`)) return;
    setSubmitting(true);
    try {
      await axiosWithAuth({
        method: 'delete',
        url: `${API_URL}/products/${product.id}`,
      });
      setNotification({ message: 'Mahsulot o\'chirildi', type: 'success' });
      loadData();
    } catch (err) {
      setNotification({ message: err.response?.data?.message || 'Mahsulotni o\'chirishda xatolik', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setShowUploadModal(true);
    }
  };

  const handleUploadSubmit = async () => {
    if (!validateUploadFields() || !selectedFile) {
      setNotification({ message: 'Barcha maydonlarni to\'g\'ri to\'ldiring va fayl yuklang', type: 'error' });
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('branchId', uploadBranch);
      formData.append('categoryId', uploadCategory);
      formData.append('status', uploadStatus);
      await axiosWithAuth({
        method: 'post',
        url: `${API_URL}/products/upload`,
        data: formData,
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setNotification({ message: 'Mahsulotlar muvaffaqiyatli qo\'shildi', type: 'success' });
      closeUploadModal();
      loadData();
    } catch (err) {
      setNotification({ message: err.response?.data?.message || 'Mahsulotlar qo\'shishda xatolik', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Mahsulotlar</h1>
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
      <button
        onClick={openCreateModal}
        className="bg-green-500 text-white p-2 rounded mb-4"
        disabled={submitting}
      >
        Yangi Mahsulot Qo'shish
      </button>
      <input
        type="file"
        accept=".xlsx, .xls"
        onChange={handleFileUpload}
        className="mb-4"
      />
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Mahsulotlarni qidiring..."
        className="w-full p-2 border rounded mb-4"
      />
      {notification && (
        <div className={`p-4 rounded ${notification.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'} mb-4`}>
          {notification.message}
          <button className="ml-4 text-sm underline" onClick={() => setNotification(null)}>Yopish</button>
        </div>
      )}
      {loading ? (
        <div className="text-center">Yuklanmoqda...</div>
      ) : (
        <>
          <table className="w-full bg-white border rounded mb-4">
            <thead>
              <tr className="bg-gray-200">
                <th className="p-2 text-left">ID</th>
                <th className="p-2 text-left">Nomi</th>
                <th className="p-2 text-left">Shtrix</th>
                <th className="p-2 text-left">Model</th>
                <th className="p-2 text-left">Filial</th>
                <th className="p-2 text-left">Kategoriya</th>
                <th className="p-2 text-left">Narx</th>
                <th className="p-2 text-left">Miqdor</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-left">Amallar</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} className="border-b">
                  <td className="p-2">#{product.id}</td>
                  <td className="p-2">{product.name}</td>
                  <td className="p-2">{product.barcode || 'N/A'}</td>
                  <td className="p-2">{product.model || 'N/A'}</td>
                  <td className="p-2">{product.branch?.name || 'Noma\'lum'}</td>
                  <td className="p-2">{product.category?.name || 'Noma\'lum'}</td>
                  <td className="p-2">{formatPrice(product.price)}</td>
                  <td className="p-2">{formatQuantity(product.quantity)}</td>
                  <td className="p-2">
                    {product.status === 'IN_WAREHOUSE' ? 'Skladda' : product.status === 'IN_STORE' ? 'Do\'konda' : 'Sotilgan'}
                  </td>
                  <td className="p-2">
                    <button
                      onClick={() => openEditModal(product)}
                      className="bg-blue-500 text-white p-1 rounded mr-2"
                      disabled={submitting}
                    >
                      Tahrirlash
                    </button>
                    <button
                      onClick={() => handleDelete(product)}
                      className="bg-red-500 text-white p-1 rounded"
                      disabled={submitting}
                    >
                      O\'chirish
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {showEditModal && selectedProduct && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded p-4 w-full max-w-md">
                <div className="flex justify-between mb-4">
                  <h3 className="text-lg font-bold">Mahsulotni Tahrirlash</h3>
                  <button onClick={closeEditModal} className="text-gray-600">X</button>
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    <tr>
                      <td className="py-1">Nomi</td>
                      <td>
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className={`w-full p-1 border rounded ${errors.name ? 'border-red-500' : ''}`}
                        />
                        {errors.name && <span className="text-red-500 text-xs">{errors.name}</span>}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1">Shtrix</td>
                      <td>
                        <input
                          value={editBarcode}
                          onChange={(e) => setEditBarcode(e.target.value)}
                          className={`w-full p-1 border rounded ${errors.barcode ? 'border-red-500' : ''}`}
                        />
                        {errors.barcode && <span className="text-red-500 text-xs">{errors.barcode}</span>}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1">Model</td>
                      <td>
                        <input
                          value={editModel}
                          onChange={(e) => setEditModel(e.target.value)}
                          className={`w-full p-1 border rounded ${errors.model ? 'border-red-500' : ''}`}
                        />
                        {errors.model && <span className="text-red-500 text-xs">{errors.model}</span>}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1">Narx</td>
                      <td>
                        <input
                          type="number"
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          className={`w-full p-1 border rounded ${errors.price ? 'border-red-500' : ''}`}
                        />
                        {errors.price && <span className="text-red-500 text-xs">{errors.price}</span>}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1">Miqdor</td>
                      <td>
                        <input
                          type="number"
                          value={editQuantity}
                          onChange={(e) => setEditQuantity(e.target.value)}
                          className={`w-full p-1 border rounded ${errors.quantity ? 'border-red-500' : ''}`}
                        />
                        {errors.quantity && <span className="text-red-500 text-xs">{errors.quantity}</span>}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1">Status</td>
                      <td>
                        <select
                          value={editStatus}
                          onChange={(e) => setEditStatus(e.target.value)}
                          className="w-full p-1 border rounded"
                        >
                          {statusOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1">Filial</td>
                      <td>
                        <select
                          value={editBranch}
                          onChange={(e) => setEditBranch(e.target.value)}
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
                      <td className="py-1">Kategoriya</td>
                      <td>
                        <select
                          value={editCategory}
                          onChange={(e) => setEditCategory(e.target.value)}
                          className={`w-full p-1 border rounded ${errors.category ? 'border-red-500' : ''}`}
                        >
                          <option value="">Tanlang</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                        {errors.category && <span className="text-red-500 text-xs">{errors.category}</span>}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={handleEditSubmit}
                    disabled={submitting}
                    className="flex-1 bg-blue-500 text-white p-2 rounded disabled:bg-gray-400"
                  >
                    {submitting ? 'Yuklanmoqda...' : 'Saqlash'}
                  </button>
                  <button
                    onClick={closeEditModal}
                    className="flex-1 bg-gray-200 p-2 rounded"
                  >
                    Bekor
                  </button>
                </div>
              </div>
            </div>
          )}
          {showCreateModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded p-4 w-full max-w-md">
                <div className="flex justify-between mb-4">
                  <h3 className="text-lg font-bold">Yangi Mahsulot Qo'shish</h3>
                  <button onClick={closeCreateModal} className="text-gray-600">X</button>
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    <tr>
                      <td className="py-1">Nomi</td>
                      <td>
                        <input
                          value={createName}
                          onChange={(e) => setCreateName(e.target.value)}
                          className={`w-full p-1 border rounded ${errors.name ? 'border-red-500' : ''}`}
                        />
                        {errors.name && <span className="text-red-500 text-xs">{errors.name}</span>}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1">Shtrix</td>
                      <td>
                        <input
                          value={createBarcode}
                          onChange={(e) => setCreateBarcode(e.target.value)}
                          className={`w-full p-1 border rounded ${errors.barcode ? 'border-red-500' : ''}`}
                        />
                        {errors.barcode && <span className="text-red-500 text-xs">{errors.barcode}</span>}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1">Model</td>
                      <td>
                        <input
                          value={createModel}
                          onChange={(e) => setCreateModel(e.target.value)}
                          className={`w-full p-1 border rounded ${errors.model ? 'border-red-500' : ''}`}
                        />
                        {errors.model && <span className="text-red-500 text-xs">{errors.model}</span>}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1">Narx</td>
                      <td>
                        <input
                          type="number"
                          value={createPrice}
                          onChange={(e) => setCreatePrice(e.target.value)}
                          className={`w-full p-1 border rounded ${errors.price ? 'border-red-500' : ''}`}
                        />
                        {errors.price && <span className="text-red-500 text-xs">{errors.price}</span>}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1">Bozor Narxi</td>
                      <td>
                        <input
                          type="number"
                          value={createMarketPrice}
                          onChange={(e) => setCreateMarketPrice(e.target.value)}
                          className="w-full p-1 border rounded"
                        />
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1">Miqdor</td>
                      <td>
                        <input
                          type="number"
                          value={createQuantity}
                          onChange={(e) => setCreateQuantity(e.target.value)}
                          className={`w-full p-1 border rounded ${errors.quantity ? 'border-red-500' : ''}`}
                        />
                        {errors.quantity && <span className="text-red-500 text-xs">{errors.quantity}</span>}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1">Tavsif</td>
                      <td>
                        <textarea
                          value={createDescription}
                          onChange={(e) => setCreateDescription(e.target.value)}
                          className="w-full p-1 border rounded"
                        />
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1">Status</td>
                      <td>
                        <select
                          value={createStatus}
                          onChange={(e) => setCreateStatus(e.target.value)}
                          className="w-full p-1 border rounded"
                        >
                          {statusOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1">Filial</td>
                      <td>
                        <select
                          value={createBranch}
                          onChange={(e) => setCreateBranch(e.target.value)}
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
                      <td className="py-1">Kategoriya</td>
                      <td>
                        <select
                          value={createCategory}
                          onChange={(e) => setCreateCategory(e.target.value)}
                          className={`w-full p-1 border rounded ${errors.category ? 'border-red-500' : ''}`}
                        >
                          <option value="">Tanlang</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                        {errors.category && <span className="text-red-500 text-xs">{errors.category}</span>}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={handleCreateSubmit}
                    disabled={submitting}
                    className="flex-1 bg-blue-500 text-white p-2 rounded disabled:bg-gray-400"
                  >
                    {submitting ? 'Yuklanmoqda...' : 'Saqlash'}
                  </button>
                  <button
                    onClick={closeCreateModal}
                    className="flex-1 bg-gray-200 p-2 rounded"
                  >
                    Bekor
                  </button>
                </div>
              </div>
            </div>
          )}
          {showUploadModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded p-4 w-full max-w-md">
                <div className="flex justify-between mb-4">
                  <h3 className="text-lg font-bold">Excel orqali qo\'shish</h3>
                  <button onClick={closeUploadModal} className="text-gray-600">X</button>
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    <tr>
                      <td className="py-1">Filial</td>
                      <td>
                        <select
                          value={uploadBranch}
                          onChange={(e) => setUploadBranch(e.target.value)}
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
                      <td className="py-1">Kategoriya</td>
                      <td>
                        <select
                          value={uploadCategory}
                          onChange={(e) => setUploadCategory(e.target.value)}
                          className={`w-full p-1 border rounded ${errors.category ? 'border-red-500' : ''}`}
                        >
                          <option value="">Tanlang</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                        {errors.category && <span className="text-red-500 text-xs">{errors.category}</span>}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1">Status</td>
                      <td>
                        <select
                          value={uploadStatus}
                          onChange={(e) => setUploadStatus(e.target.value)}
                          className="w-full p-1 border rounded"
                        >
                          {statusOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={handleUploadSubmit}
                    disabled={submitting}
                    className="flex-1 bg-blue-500 text-white p-2 rounded disabled:bg-gray-400"
                  >
                    {submitting ? 'Yuklanmoqda...' : 'Saqlash'}
                  </button>
                  <button
                    onClick={closeUploadModal}
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

export default TovarlarRoyxati;