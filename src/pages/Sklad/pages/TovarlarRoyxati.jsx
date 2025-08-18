import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const Notification = ({ message, type, onClose }) => (
  <div
    className={`p-4 rounded-lg shadow-md ${
      type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
    } mb-4`}
  >
    {message}
    <button className="ml-4 text-sm underline hover:text-gray-900" onClick={onClose}>
      Yopish
    </button>
  </div>
);

const TovarlarRoyxati = () => {
  const [products, setProducts] = useState([]);
  const [defectiveProducts, setDefectiveProducts] = useState([]);
  const [fixedProducts, setFixedProducts] = useState([]);
  const [branches, setBranches] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDefectiveModal, setShowDefectiveModal] = useState(false);
  const [showBulkDefectiveModal, setShowBulkDefectiveModal] = useState(false);
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
  const [createMarketPrice, setCreateMarketPrice] = useState('');
  const [defectiveCount, setDefectiveCount] = useState('');
  const [defectiveDescription, setDefectiveDescription] = useState('');
  const [bulkDefectiveDescription, setBulkDefectiveDescription] = useState('');
  const [isFullDefective, setIsFullDefective] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [selectedDefectiveProducts, setSelectedDefectiveProducts] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const fileInputRef = useRef(null);
  const navigate = useNavigate();
  const API_URL = 'https://suddocs.uz';

  const formatPrice = (price) => (price >= 0 ? new Intl.NumberFormat('uz-UZ').format(price) + " so'm" : "Noma'lum");
  const formatQuantity = (qty) => (qty >= 0 ? new Intl.NumberFormat('uz-UZ').format(qty) + ' dona' : "Noma'lum");

  const statusOptions = [
    { value: 'IN_WAREHOUSE', label: 'Skladda' },
    { value: 'IN_STORE', label: "Do'konda" },
    { value: 'SOLD', label: 'Sotilgan' },
    { value: 'DEFECTIVE', label: 'Nuqsonli' },
    { value: 'RETURNED', label: 'Qaytarilgan' },
    { value: 'CARRIER', label: 'Tashuvchi' },
    { value: 'FIXED', label: 'Tuzatilgan' },
  ];

  const generateReceipt = (product, quantity, price) => {
    const date = new Date().toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' });
    const receiptContent = `
      Chek
      -----------------------
      Tovar: ${product.name}
      Soni: ${formatQuantity(quantity)}
      Narxi: ${formatPrice(price)}
      Sana: ${date}
      -----------------------
    `;
    const blob = new Blob([receiptContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `receipt_${product.id}_${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const axiosWithAuth = async (config) => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      setNotification({ message: 'Sessiya topilmadi, iltimos tizimga kiring', type: 'error' });
      setTimeout(() => navigate('/login'), 2000);
      throw new Error('No token found');
    }
    const headers = { ...config.headers, Authorization: `Bearer ${token}` };
    try {
      const response = await axios({ ...config, headers });
      return response;
    } catch (error) {
      if (error.response?.status === 401) {
        setNotification({ message: 'Sessiya tugadi, iltimos qayta kiring', type: 'error' });
        localStorage.clear();
        setTimeout(() => navigate('/login'), 2000);
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
        const branchesData = branchesRes.data;
        setBranches(branchesData);
        setCategories(categoriesRes.data);

        const omborBranch = branchesData.find((b) => b.name.toLowerCase() === 'ombor');
        if (omborBranch) {
          setSelectedBranchId(omborBranch.id.toString());
          setEditBranch(omborBranch.id.toString());
          setCreateBranch(omborBranch.id.toString());
          setUploadBranch(omborBranch.id.toString());
        } else {
          setNotification({ message: '"Ombor" filiali topilmadi', type: 'error' });
        }
      } catch (err) {
        setNotification({ message: err.message || 'Filial va kategoriyalarni yuklashda xatolik', type: 'error' });
      }
    };
    fetchBranchesAndCategories();
  }, []);

  const loadAllProducts = useCallback(async () => {
    setLoading(true);
    const branchId = Number(selectedBranchId);
    const isValidBranchId = !isNaN(branchId) && Number.isInteger(branchId) && branchId > 0;

    if (!isValidBranchId) {
      setNotification({ message: 'Filialni tanlang', type: 'error' });
      setProducts([]);
      setSelectedProducts([]);
      setLoading(false);
      return;
    }

    try {
      const queryParams = new URLSearchParams();
      queryParams.append('branchId', branchId.toString());
      if (searchTerm.trim()) queryParams.append('search', searchTerm);
      queryParams.append('includeZeroQuantity', 'true');
      const productsRes = await axiosWithAuth({
        method: 'get',
        url: `${API_URL}/products?${queryParams.toString()}`,
      });
      setProducts(productsRes.data);
      setSelectedProducts([]);
    } catch (err) {
      setNotification({ message: err.message || "Ma'lumotlarni yuklashda xatolik", type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [searchTerm, selectedBranchId]);

  const loadDefectiveProducts = useCallback(async () => {
    setLoading(true);
    const branchId = Number(selectedBranchId);
    const isValidBranchId = !isNaN(branchId) && Number.isInteger(branchId) && branchId > 0;

    if (!isValidBranchId) {
      setDefectiveProducts([]);
      setSelectedDefectiveProducts([]);
      setLoading(false);
      return;
    }

    try {
      const queryParams = new URLSearchParams();
      queryParams.append('branchId', branchId.toString());
      const defectiveRes = await axiosWithAuth({
        method: 'get',
        url: `${API_URL}/products/defective?${queryParams.toString()}`,
      });
      setDefectiveProducts(defectiveRes.data);
      setSelectedDefectiveProducts([]);
    } catch (err) {
      setNotification({ message: err.message || "Defective mahsulotlarni yuklashda xatolik", type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [selectedBranchId]);

  const loadFixedProducts = useCallback(async () => {
    setLoading(true);
    const branchId = Number(selectedBranchId);
    const isValidBranchId = !isNaN(branchId) && Number.isInteger(branchId) && branchId > 0;

    if (!isValidBranchId) {
      setFixedProducts([]);
      setLoading(false);
      return;
    }

    try {
      const queryParams = new URLSearchParams();
      queryParams.append('branchId', branchId.toString());
      const fixedRes = await axiosWithAuth({
        method: 'get',
        url: `${API_URL}/products/fixed?${queryParams.toString()}`,
      });
      setFixedProducts(fixedRes.data);
    } catch (err) {
      setNotification({ message: err.message || "Fixed mahsulotlarni yuklashda xatolik", type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [selectedBranchId]);

  useEffect(() => {
    if (selectedBranchId) {
      loadAllProducts();
      loadDefectiveProducts();
      loadFixedProducts();
    }
  }, [loadAllProducts, loadDefectiveProducts, loadFixedProducts, selectedBranchId, searchTerm]);

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
    setCreateMarketPrice('');
    setErrors({});
    setShowCreateModal(true);
  };

  const openDefectiveModal = (product, fullDefective = false) => {
    setSelectedProduct(product);
    setDefectiveCount(fullDefective ? product.quantity.toString() : '1');
    setDefectiveDescription('');
    setIsFullDefective(fullDefective);
    setErrors({});
    setShowDefectiveModal(true);
  };

  const openBulkDefectiveModal = () => {
    if (selectedProducts.length === 0) {
      setNotification({ message: "Hech qanday mahsulot tanlanmadi", type: 'error' });
      return;
    }
    setBulkDefectiveDescription('');
    setErrors({});
    setShowBulkDefectiveModal(true);
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
    setEditBranch(selectedBranchId || '');
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
    setCreateBranch(selectedBranchId || '');
    setCreateCategory('');
    setCreateMarketPrice('');
    setErrors({});
  };

  const closeUploadModal = () => {
    setShowUploadModal(false);
    setSelectedFile(null);
    setUploadBranch(selectedBranchId || '');
    setUploadCategory('');
    setUploadStatus('IN_STORE');
    setErrors({});
  };

  const closeDefectiveModal = () => {
    setShowDefectiveModal(false);
    setSelectedProduct(null);
    setDefectiveCount('');
    setDefectiveDescription('');
    setIsFullDefective(false);
    setErrors({});
  };

  const closeBulkDefectiveModal = () => {
    setShowBulkDefectiveModal(false);
    setBulkDefectiveDescription('');
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
    if (!price || isNaN(price) || Number(price) < 0)
      newErrors.price = "Narx 0 dan katta yoki teng bo'lishi kerak";
    if (!quantity || isNaN(quantity) || Number(quantity) < 0)
      newErrors.quantity = "Miqdor 0 dan katta yoki teng bo'lishi kerak";
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

  const validateDefectiveFields = () => {
    const newErrors = {};
    const count = Number(defectiveCount);
    if (isNaN(count) || count <= 0 || count > selectedProduct.quantity) {
      newErrors.defectiveCount = `Miqdor 1 dan ${selectedProduct.quantity} gacha bo'lishi kerak`;
    }
    if (!defectiveDescription.trim()) {
      newErrors.defectiveDescription = 'Sabab kiritilishi shart';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateBulkDefectiveFields = () => {
    const newErrors = {};
    if (!bulkDefectiveDescription.trim()) {
      newErrors.bulkDefectiveDescription = 'Sabab kiritilishi shart';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!validateFields()) {
      setNotification({ message: "Barcha maydonlarni to'g'ri to'ldiring", type: 'error' });
      return;
    }
    setSubmitting(true);
    try {
      const wasSold = selectedProduct.status !== 'SOLD' && editStatus === 'SOLD';
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
      if (wasSold) {
        generateReceipt(selectedProduct, Number(editQuantity), Number(editPrice));
      }
      closeEditModal();
      loadAllProducts();
      loadDefectiveProducts();
      loadFixedProducts();
    } catch (err) {
      setNotification({
        message: err.response?.data?.message || 'Mahsulotni yangilashda xatolik',
        type: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!validateFields(true)) {
      setNotification({ message: "Barcha maydonlarni to'g'ri to'ldiring", type: 'error' });
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
          marketPrice: createMarketPrice ? Number(createMarketPrice) : undefined,
        },
      });
      setNotification({ message: "Mahsulot muvaffaqiyatli qo'shildi", type: 'success' });
      closeCreateModal();
      loadAllProducts();
      loadDefectiveProducts();
      loadFixedProducts();
    } catch (err) {
      setNotification({
        message: err.response?.data?.message || "Mahsulot qo'shishda xatolik",
        type: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

const handleDefectiveSubmit = async () => {
  if (!validateDefectiveFields()) {
    setNotification({ message: "Barcha maydonlarni to'g'ri to'ldiring", type: 'error' });
    return;
  }
  setSubmitting(true);
  try {
    const count = Number(defectiveCount);
    let url, data;
    
    if (isFullDefective || count === selectedProduct.quantity) {
      url = `${API_URL}/products/${selectedProduct.id}/mark-defective`;
      data = { 
        description: defectiveDescription 
      };
    } else {
      url = `${API_URL}/products/${selectedProduct.id}/partial-defective`;
      data = { 
        defectiveCount: count, 
        description: defectiveDescription 
      };
    }
    
    console.log('Sending request to:', url, 'with data:', data);
    
    const response = await axiosWithAuth({
      method: 'put',
      url,
      data,
    });
    
    setNotification({ 
      message: 'Mahsulot muvaffaqiyatli defective qilib belgilandi', 
      type: 'success' 
    });
    closeDefectiveModal();
    loadAllProducts();
    loadDefectiveProducts();
    loadFixedProducts();
  } catch (err) {
    console.error('Error in handleDefectiveSubmit:', err.response?.data || err.message);
    setNotification({
      message: err.response?.data?.message || 'Mahsulotni defective qilishda xatolik',
      type: 'error',
    });
  } finally {
    setSubmitting(false);
  }
};

  const handleBulkDefectiveSubmit = async () => {
    if (!validateBulkDefectiveFields()) {
      setNotification({ message: "Sabab kiritilishi shart", type: 'error' });
      return;
    }
    setSubmitting(true);
    try {
      await axiosWithAuth({
        method: 'post',
        url: `${API_URL}/products/bulk-defective`,
        data: { ids: selectedProducts.map((id) => id.toString()), description: bulkDefectiveDescription },
      });
      setNotification({ message: 'Tanlangan mahsulotlar defective qilib belgilandi', type: 'success' });
      closeBulkDefectiveModal();
      setSelectedProducts([]);
      loadAllProducts();
      loadDefectiveProducts();
      loadFixedProducts();
    } catch (err) {
      setNotification({
        message: err.response?.data?.message || 'Bulk defective qilishda xatolik',
        type: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkRestore = async () => {
    if (selectedDefectiveProducts.length === 0) {
      setNotification({ message: "Hech qanday mahsulot tanlanmadi", type: 'error' });
      return;
    }
    if (!window.confirm(`${selectedDefectiveProducts.length} ta defective mahsulotni tuzatishni xohlaysizmi?`)) return;
    setSubmitting(true);
    try {
      await axiosWithAuth({
        method: 'post',
        url: `${API_URL}/products/bulk-restore-defective`,
        data: { ids: selectedDefectiveProducts.map((id) => id.toString()) },
      });
      setNotification({ message: 'Tanlangan defective mahsulotlar tuzatildi', type: 'success' });
      setSelectedDefectiveProducts([]);
      loadAllProducts();
      loadDefectiveProducts();
      loadFixedProducts();
    } catch (err) {
      setNotification({
        message: err.response?.data?.message || 'Bulk tuzatishda xatolik',
        type: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (product) => {
    if (!window.confirm(`"${product.name}" mahsulotini o'chirishni xohlaysizmi?`)) return;
    setSubmitting(true);
    try {
      await axiosWithAuth({
        method: 'delete',
        url: `${API_URL}/products/${product.id}`,
      });
      setNotification({ message: "Mahsulot o'chirildi", type: 'success' });
      loadAllProducts();
      loadDefectiveProducts();
      loadFixedProducts();
    } catch (err) {
      setNotification({
        message: err.response?.data?.message || "Mahsulotni o'chirishda xatolik",
        type: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedProducts.length === 0) {
      setNotification({ message: "Hech qanday mahsulot tanlanmadi", type: 'error' });
      return;
    }
    if (!window.confirm(`${selectedProducts.length} ta mahsulotni o'chirishni xohlaysizmi?`)) return;
    setSubmitting(true);
    try {
      await axiosWithAuth({
        method: 'delete',
        url: `${API_URL}/products/bulk`,
        data: { ids: selectedProducts.map((id) => id.toString()) },
      });
      setNotification({ message: "Tanlangan mahsulotlar o'chirildi", type: 'success' });
      setSelectedProducts([]);
      loadAllProducts();
      loadDefectiveProducts();
      loadFixedProducts();
    } catch (err) {
      setNotification({
        message: err.response?.data?.message || "Mahsulotlarni o'chirishda xatolik",
        type: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectProduct = (productId) => {
    setSelectedProducts((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
  };

  const handleSelectDefectiveProduct = (productId) => {
    setSelectedDefectiveProducts((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
  };

  const handleSelectAll = (type) => {
    if (type === 'all') {
      if (selectedProducts.length === products.length) {
        setSelectedProducts([]);
      } else {
        setSelectedProducts(products.map((product) => product.id));
      }
    } else if (type === 'defective') {
      if (selectedDefectiveProducts.length === defectiveProducts.length) {
        setSelectedDefectiveProducts([]);
      } else {
        setSelectedDefectiveProducts(defectiveProducts.map((product) => product.id));
      }
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
      setNotification({ message: "Barcha maydonlarni to'g'ri to'ldiring va fayl yuklang", type: 'error' });
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
      setNotification({ message: "Mahsulotlar muvaffaqiyatli qo'shildi", type: 'success' });
      closeUploadModal();
      loadAllProducts();
      loadDefectiveProducts();
      loadFixedProducts();
    } catch (err) {
      setNotification({
        message: err.response?.data?.message || "Mahsulotlar qo'shishda xatolik",
        type: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const renderTable = (data, selected, onSelect, onSelectAll, type) => (
    <div className="overflow-x-auto">
      <table className="w-full bg-white border border-gray-200 rounded-lg shadow-md">
        <thead>
          <tr className="bg-gray-100 text-gray-700">
            <th className="p-4 text-left font-semibold">
              <input
                type="checkbox"
                checked={selected.length === data.length && data.length > 0}
                onChange={() => onSelectAll(type)}
              />
            </th>
            <th className="p-4 text-left font-semibold">ID</th>
            <th className="p-4 text-left font-semibold">Nomi</th>
            <th className="p-4 text-left font-semibold">Shtrix</th>
            <th className="p-4 text-left font-semibold">Model</th>
            <th className="p-4 text-left font-semibold">Filial</th>
            <th className="p-4 text-left font-semibold">Kategoriya</th>
            <th className="p-4 text-left font-semibold">Narx</th>
            <th className="p-4 text-left font-semibold">Miqdor</th>
            <th className="p-4 text-left font-semibold">Defective Miqdor</th>
            <th className="p-4 text-left font-semibold">Status</th>
            <th className="p-4 text-left font-semibold min-w-[280px] w-72">Amallar</th>
          </tr>
        </thead>
        <tbody>
          {data.map((product) => (
            <tr key={product.id} className="border-b border-gray-200 last:border-none">
              <td className="p-4">
                <input
                  type="checkbox"
                  checked={selected.includes(product.id)}
                  onChange={() => onSelect(product.id)}
                />
              </td>
              <td className="p-4 text-gray-800">#{product.id}</td>
              <td className="p-4 text-gray-800">{product.name}</td>
              <td className="p-4 text-gray-800">{product.barcode || 'N/A'}</td>
              <td className="p-4 text-gray-800">{product.model || 'N/A'}</td>
              <td className="p-4 text-gray-800">{product.branch?.name || "Noma'lum"}</td>
              <td className="p-4 text-gray-800">{product.category?.name || "Noma'lum"}</td>
              <td className="p-4 text-gray-800">{formatPrice(product.price)}</td>
              <td className="p-4 text-gray-800">{formatQuantity(product.quantity)}</td>
              <td className="p-4 text-gray-800">{formatQuantity(product.defectiveQuantity)}</td>
              <td className="p-4 text-gray-800">
                {statusOptions.find((opt) => opt.value === product.status)?.label || product.status}
              </td>
              <td className="p-4 min-w-[280px] w-72">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => openEditModal(product)}
                    className="btn btn-primary w-full"
                    disabled={submitting}
                  >
                    Tahrirlash
                  </button>
                  <button
                    onClick={() => handleDelete(product)}
                    className="btn btn-danger w-full"
                    disabled={submitting}
                  >
                    O'chirish
                  </button>
                  {type === 'all' && product.quantity > 0 && (
                    <>
                      <button
                        onClick={() => openDefectiveModal(product, true)}
                        className="btn btn-warning w-full"
                        disabled={submitting}
                      >
                        To'liq Brak
                      </button>
                      <button
                        onClick={() => openDefectiveModal(product, false)}
                        className="btn btn-orange w-full"
                        disabled={submitting}
                      >
                        Qisman Brak
                      </button>
                    </>
                  )}
                  {type === 'defective' && product.defectiveQuantity > 0 && (
                    <button
                      onClick={() => {
                        const restoreCount = product.defectiveQuantity;
                        handleRestore(product.id, restoreCount);
                      }}
                      className="btn btn-success w-full"
                      disabled={submitting}
                    >
                      Tuzatish
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const handleRestore = async (id, restoreCount) => {
    setSubmitting(true);
    try {
      await axiosWithAuth({
        method: 'put',
        url: `${API_URL}/products/${id}/restore-defective`,
        data: { restoreCount },
      });
      setNotification({ message: 'Defective mahsulot tuzatildi', type: 'success' });
      loadAllProducts();
      loadDefectiveProducts();
      loadFixedProducts();
    } catch (err) {
      setNotification({
        message: err.response?.data?.message || 'Tuzatishda xatolik',
        type: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">Mahsulotlar</h1>
      <select
        value={selectedBranchId}
        onChange={(e) => {
          setSelectedBranchId(e.target.value);
          setEditBranch(e.target.value);
          setCreateBranch(e.target.value);
          setUploadBranch(e.target.value);
        }}
        className="w-full max-w-xs p-2 border border-gray-300 rounded-md mb-6 bg-white text-gray-700 focus:outline-none focus:border-blue-500"
      >
        <option value="">Filial tanlang</option>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
      <div className="flex gap-4 mb-6">
        <button
          onClick={openCreateModal}
          className="btn btn-success"
          disabled={submitting}
        >
          Yangi Mahsulot Qo'shish
        </button>
        <input
          type="file"
          accept=".xlsx, .xls"
          onChange={handleFileUpload}
          className="file-input"
          ref={fileInputRef}
        />
        {/* Bulk delete button removed as requested */}
      </div>
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Mahsulotlarni qidiring..."
        className="w-full max-w-xs p-2 border border-gray-300 rounded-md mb-6 bg-white text-gray-700 focus:outline-none focus:border-blue-500"
      />
      {notification && <Notification {...notification} onClose={() => setNotification(null)} />}
      <div className="flex mb-4">
        <button
          onClick={() => setActiveTab('all')}
          className={`${activeTab === 'all' ? 'tab tab-active' : 'tab tab-inactive'} rounded-l-md`}
        >
          Barchasi
        </button>
        <button
          onClick={() => setActiveTab('defective')}
          className={`${activeTab === 'defective' ? 'tab tab-active' : 'tab tab-inactive'}`}
        >
          Defective
        </button>
        <button
          onClick={() => setActiveTab('fixed')}
          className={`${activeTab === 'fixed' ? 'tab tab-active' : 'tab tab-inactive'} rounded-r-md`}
        >
          Fixed
        </button>
      </div>
      {loading ? (
        <div className="text-center text-gray-600">Yuklanmoqda...</div>
      ) : (
        <>
          {activeTab === 'all' && (
            <>
              <button
                onClick={openBulkDefectiveModal}
                className="btn btn-warning mb-4"
                disabled={submitting || selectedProducts.length === 0}
              >
                Tanlanganlarni Defective Qilish
              </button>
              {renderTable(products, selectedProducts, handleSelectProduct, handleSelectAll, 'all')}
            </>
          )}
          {activeTab === 'defective' && (
            <>
              <button
                onClick={handleBulkRestore}
                className="btn btn-success mb-4"
                disabled={submitting || selectedDefectiveProducts.length === 0}
              >
                Tanlanganlarni Tuzatish
              </button>
              {renderTable(defectiveProducts, selectedDefectiveProducts, handleSelectDefectiveProduct, handleSelectAll, 'defective')}
            </>
          )}
          {activeTab === 'fixed' && (
            renderTable(fixedProducts, [], () => {}, () => {}, 'fixed')
          )}
        </>
      )}
      {showEditModal && selectedProduct && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-lg max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 border-b pb-3">
              <h3 className="text-xl font-semibold text-gray-800">Mahsulotni Tahrirlash</h3>
              <button onClick={closeEditModal} className="text-gray-500 hover:text-gray-700">
                X
              </button>
            </div>
            <table className="w-full text-sm">
              <tbody>
                <tr>
                  <td className="py-2 text-gray-700">Nomi</td>
                  <td>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className={`w-full p-2 border rounded-md focus:outline-none focus:border-blue-500 ${
                        errors.name ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.name && <span className="text-red-500 text-xs">{errors.name}</span>}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 text-gray-700">Shtrix</td>
                  <td>
                    <input
                      value={editBarcode}
                      onChange={(e) => setEditBarcode(e.target.value)}
                      className={`w-full p-2 border rounded-md focus:outline-none focus:border-blue-500 ${
                        errors.barcode ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.barcode && <span className="text-red-500 text-xs">{errors.barcode}</span>}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 text-gray-700">Model</td>
                  <td>
                    <input
                      value={editModel}
                      onChange={(e) => setEditModel(e.target.value)}
                      className={`w-full p-2 border rounded-md focus:outline-none focus:border-blue-500 ${
                        errors.model ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.model && <span className="text-red-500 text-xs">{errors.model}</span>}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 text-gray-700">Narx</td>
                  <td>
                    <input
                      type="number"
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                      className={`w-full p-2 border rounded-md focus:outline-none focus:border-blue-500 ${
                        errors.price ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.price && <span className="text-red-500 text-xs">{errors.price}</span>}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 text-gray-700">Miqdor</td>
                  <td>
                    <input
                      type="number"
                      value={editQuantity}
                      onChange={(e) => setEditQuantity(e.target.value)}
                      className={`w-full p-2 border rounded-md focus:outline-none focus:border-blue-500 ${
                        errors.quantity ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.quantity && <span className="text-red-500 text-xs">{errors.quantity}</span>}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 text-gray-700">Status</td>
                  <td>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:border-blue-500"
                    >
                      {statusOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
                <tr>
                  <td className="py-2 text-gray-700">Filial</td>
                  <td>
                    <select
                      value={editBranch}
                      onChange={(e) => setEditBranch(e.target.value)}
                      className={`w-full p-2 border rounded-md focus:outline-none focus:border-blue-500 ${
                        errors.branch ? 'border-red-500' : 'border-gray-300'
                      }`}
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
                  <td className="py-2 text-gray-700">Kategoriya</td>
                  <td>
                    <select
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                      className={`w-full p-2 border rounded-md focus:outline-none focus:border-blue-500 ${
                        errors.category ? 'border-red-500' : 'border-gray-300'
                      }`}
                    >
                      <option value="">Tanlang</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
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
                className="btn btn-primary flex-1"
              >
                {submitting ? 'Yuklanmoqda...' : 'Saqlash'}
              </button>
              <button
                onClick={closeEditModal}
                className="btn btn-secondary flex-1"
              >
                Bekor
              </button>
            </div>
          </div>
        </div>
      )}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-lg max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 border-b pb-3">
              <h3 className="text-lg font-semibold text-gray-800">Yangi Mahsulot Qo'shish</h3>
              <button onClick={closeCreateModal} className="text-gray-500 hover:text-gray-700 text-base font-bold">
                X
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nomi</label>
                <input
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  className={`w-full p-1.5 border rounded-md focus:outline-none focus:border-blue-500 ${
                    errors.name ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.name && <span className="text-red-500 text-xs">{errors.name}</span>}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Shtrix</label>
                <input
                  value={createBarcode}
                  onChange={(e) => setCreateBarcode(e.target.value)}
                  className={`w-full p-1.5 border rounded-md focus:outline-none focus:border-blue-500 ${
                    errors.barcode ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.barcode && <span className="text-red-500 text-xs">{errors.barcode}</span>}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Model</label>
                <input
                  value={createModel}
                  onChange={(e) => setCreateModel(e.target.value)}
                  className={`w-full p-1.5 border rounded-md focus:outline-none focus:border-blue-500 ${
                    errors.model ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.model && <span className="text-red-500 text-xs">{errors.model}</span>}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Narx</label>
                <input
                  type="number"
                  value={createPrice}
                  onChange={(e) => setCreatePrice(e.target.value)}
                  className={`w-full p-1.5 border rounded-md focus:outline-none focus:border-blue-500 ${
                    errors.price ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.price && <span className="text-red-500 text-xs">{errors.price}</span>}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Bozor Narxi</label>
                <input
                  type="number"
                  value={createMarketPrice}
                  onChange={(e) => setCreateMarketPrice(e.target.value)}
                  className="w-full p-1.5 border border-gray-300 rounded-md focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Miqdor</label>
                <input
                  type="number"
                  value={createQuantity}
                  onChange={(e) => setCreateQuantity(e.target.value)}
                  className={`w-full p-1.5 border rounded-md focus:outline-none focus:border-blue-500 ${
                    errors.quantity ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.quantity && <span className="text-red-500 text-xs">{errors.quantity}</span>}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={createStatus}
                  onChange={(e) => setCreateStatus(e.target.value)}
                  className="w-full p-1.5 border border-gray-300 rounded-md focus:outline-none focus:border-blue-500"
                >
                  {statusOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Filial</label>
                <select
                  value={createBranch}
                  onChange={(e) => setCreateBranch(e.target.value)}
                  className={`w-full p-1.5 border rounded-md focus:outline-none focus:border-blue-500 ${
                    errors.branch ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">Tanlang</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
                {errors.branch && <span className="text-red-500 text-xs">{errors.branch}</span>}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Kategoriya</label>
                <select
                  value={createCategory}
                  onChange={(e) => setCreateCategory(e.target.value)}
                  className={`w-full p-1.5 border rounded-md focus:outline-none focus:border-blue-500 ${
                    errors.category ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">Tanlang</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {errors.category && <span className="text-red-500 text-xs">{errors.category}</span>}
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleCreateSubmit}
                disabled={submitting}
                className="btn btn-primary flex-1"
              >
                {submitting ? 'Yuklanmoqda...' : 'Saqlash'}
              </button>
              <button
                onClick={closeCreateModal}
                className="btn btn-secondary flex-1"
              >
                Bekor
              </button>
            </div>
          </div>
        </div>
      )}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-lg max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 border-b pb-3">
              <h3 className="text-xl font-semibold text-gray-800">Excel orqali qo'shish</h3>
              <button onClick={closeUploadModal} className="text-gray-500 hover:text-gray-700">
                X
              </button>
            </div>
            <table className="w-full text-sm">
              <tbody>
                <tr>
                  <td className="py-2 text-gray-700">Filial</td>
                  <td>
                    <select
                      value={uploadBranch}
                      onChange={(e) => setUploadBranch(e.target.value)}
                      className={`w-full p-2 border rounded-md focus:outline-none focus:border-blue-500 ${
                        errors.branch ? 'border-red-500' : 'border-gray-300'
                      }`}
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
                  <td className="py-2 text-gray-700">Kategoriya</td>
                  <td>
                    <select
                      value={uploadCategory}
                      onChange={(e) => setUploadCategory(e.target.value)}
                      className={`w-full p-2 border rounded-md focus:outline-none focus:border-blue-500 ${
                        errors.category ? 'border-red-500' : 'border-gray-300'
                      }`}
                    >
                      <option value="">Tanlang</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    {errors.category && <span className="text-red-500 text-xs">{errors.category}</span>}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 text-gray-700">Status</td>
                  <td>
                    <select
                      value={uploadStatus}
                      onChange={(e) => setUploadStatus(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:border-blue-500"
                    >
                      {statusOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
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
                className="btn btn-primary flex-1"
              >
                {submitting ? 'Yuklanmoqda...' : 'Saqlash'}
              </button>
              <button
                onClick={closeUploadModal}
                className="btn btn-secondary flex-1"
              >
                Bekor
              </button>
            </div>
          </div>
        </div>
      )}
      {showDefectiveModal && selectedProduct && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-lg max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 border-b pb-3">
              <h3 className="text-xl font-semibold text-gray-800">
                {isFullDefective ? 'Mahsulotni To\'liq Brak Qilish' : 'Mahsulotni Qisman Brak Qilish'}
              </h3>
              <button onClick={closeDefectiveModal} className="text-gray-500 hover:text-gray-700">
                X
              </button>
            </div>
            <table className="w-full text-sm">
              <tbody>
                <tr>
                  <td className="py-2 text-gray-700">Mahsulot</td>
                  <td className="py-2 text-gray-800">{selectedProduct.name}</td>
                </tr>
                <tr>
                  <td className="py-2 text-gray-700">Jami Miqdor</td>
                  <td className="py-2 text-gray-800">{formatQuantity(selectedProduct.quantity)}</td>
                </tr>
                {!isFullDefective && (
                  <tr>
                    <td className="py-2 text-gray-700">Brak Miqdori</td>
                    <td>
                      <input
                        type="number"
                        value={defectiveCount}
                        onChange={(e) => setDefectiveCount(e.target.value)}
                        className={`w-full p-2 border rounded-md focus:outline-none focus:border-blue-500 ${
                          errors.defectiveCount ? 'border-red-500' : 'border-gray-300'
                        }`}
                        min="1"
                        max={selectedProduct.quantity}
                      />
                      {errors.defectiveCount && <span className="text-red-500 text-xs">{errors.defectiveCount}</span>}
                    </td>
                  </tr>
                )}
                <tr>
                  <td className="py-2 text-gray-700">Sabab</td>
                  <td>
                    <textarea
                      value={defectiveDescription}
                      onChange={(e) => setDefectiveDescription(e.target.value)}
                      className={`w-full p-2 border rounded-md focus:outline-none focus:border-blue-500 ${
                        errors.defectiveDescription ? 'border-red-500' : 'border-gray-300'
                      }`}
                      rows="3"
                    />
                    {errors.defectiveDescription && <span className="text-red-500 text-xs">{errors.defectiveDescription}</span>}
                  </td>
                </tr>
              </tbody>
            </table>
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleDefectiveSubmit}
                disabled={submitting}
                className="btn btn-warning flex-1"
              >
                {submitting ? 'Yuklanmoqda...' : 'Saqlash'}
              </button>
              <button
                onClick={closeDefectiveModal}
                className="btn btn-secondary flex-1"
              >
                Bekor
              </button>
            </div>
          </div>
        </div>
      )}
      {showBulkDefectiveModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-lg max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 border-b pb-3">
              <h3 className="text-xl font-semibold text-gray-800">Tanlangan Mahsulotlarni Defective Qilish</h3>
              <button onClick={closeBulkDefectiveModal} className="text-gray-500 hover:text-gray-700">
                X
              </button>
            </div>
            <div className="py-2">
              <label className="block text-gray-700">Sabab</label>
              <textarea
                value={bulkDefectiveDescription}
                onChange={(e) => setBulkDefectiveDescription(e.target.value)}
                className={`w-full p-2 border rounded-md focus:outline-none focus:border-blue-500 ${
                  errors.bulkDefectiveDescription ? 'border-red-500' : 'border-gray-300'
                }`}
                rows="3"
              />
              {errors.bulkDefectiveDescription && <span className="text-red-500 text-xs">{errors.bulkDefectiveDescription}</span>}
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleBulkDefectiveSubmit}
                disabled={submitting}
                className="btn btn-warning flex-1"
              >
                {submitting ? 'Yuklanmoqda...' : 'Saqlash'}
              </button>
              <button
                onClick={closeBulkDefectiveModal}
                className="btn btn-secondary flex-1"
              >
                Bekor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TovarlarRoyxati;