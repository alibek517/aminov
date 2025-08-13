import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Filter,
  Plus,
  Edit3,
  Trash2,
  Package,
  CheckCircle,
  Clock,
  AlertTriangle,
  RotateCcw,
  X,
  Save,
  ScanLine,
  Eye,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const PRODUCT_STATUSES = [
  { value: 'IN_WAREHOUSE', label: 'Омборда' },
  { value: 'IN_STORE', label: 'Дўконда' },
  { value: 'SOLD', label: 'Сотилган' },
  { value: 'DEFECTIVE', label: 'Брак' },
  { value: 'RETURNED', label: 'Қайтарилган' },
];

const getStatusIcon = (status) => {
  switch (status) {
    case 'IN_WAREHOUSE':
    case 'IN_STORE':
      return CheckCircle;
    case 'SOLD':
      return Clock;
    case 'DEFECTIVE':
      return AlertTriangle;
    case 'RETURNED':
      return RotateCcw;
    default:
      return Package;
  }
};

const getStatusColor = (status) => {
  switch (status) {
    case 'IN_WAREHOUSE':
    case 'IN_STORE':
      return 'text-green-500';
    case 'SOLD':
      return 'text-blue-500';
    case 'DEFECTIVE':
      return 'text-red-500';
    case 'RETURNED':
      return 'text-yellow-500';
    default:
      return 'text-gray-500';
  }
};

const getStatusText = (status) => {
  const statusObj = PRODUCT_STATUSES.find((s) => s.value === status);
  return statusObj ? statusObj.label : 'Номаълум';
};

const Inventory = ({ selectedBranchId: propSelectedBranchId }) => {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [branches, setBranches] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState(null);
  const [currentProduct, setCurrentProduct] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    barcode: '',
    description: '',
    categoryId: '',
    branchId: propSelectedBranchId || localStorage.getItem('selectedBranchId') || '',
    price: 0,
    marketPrice: null,
    quantity: 0,
    status: 'IN_WAREHOUSE',
  });
  const [selectedBranchId, setSelectedBranchId] = useState(
    propSelectedBranchId || localStorage.getItem('selectedBranchId') || ''
  );
  const nameInputRef = useRef(null);

  const API_BASE_URL = 'https://suddocs.uz';

  const fetchWithAuth = async (url, options = {}) => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      navigate('/login');
      throw new Error('No token found. Please login again.');
    }

    const headers = {
      ...options.headers,
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    const response = await fetch(url, { ...options, headers });
    if (response.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('userRole');
      localStorage.removeItem('user');
      localStorage.removeItem('userId');
      navigate('/login');
      throw new Error('Unauthorized: Session expired. Please login again.');
    }

    if (!response.ok) {
    }

    return response;
  };

  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'selectedBranchId') {
        setSelectedBranchId(e.newValue || '');
        setFormData((prev) => ({ ...prev, branchId: e.newValue || '' }));
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  useEffect(() => {
    if (propSelectedBranchId !== undefined) {
      setSelectedBranchId(propSelectedBranchId);
      setFormData((prev) => ({ ...prev, branchId: propSelectedBranchId }));
    }
  }, [propSelectedBranchId]);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const [productsResponse, categoriesResponse, branchesResponse] = await Promise.all([
          fetchWithAuth(`${API_BASE_URL}/products`),
          fetchWithAuth(`${API_BASE_URL}/categories`),
          fetchWithAuth(`${API_BASE_URL}/branches`),
        ]);

        const [productsData, categoriesData, branchesData] = await Promise.all([
          productsResponse.json(),
          categoriesResponse.json(),
          branchesResponse.json(),
        ]);

        setProducts(productsData);
        setCategories(categoriesData);
        setBranches(branchesData);

        if (selectedBranchId && !branchesData.some((b) => b.id.toString() === selectedBranchId)) {
          setSelectedBranchId('');
          localStorage.setItem('selectedBranchId', '');
          setFormData((prev) => ({ ...prev, branchId: '' }));
        }
      } catch (error) {
        console.error('Error loading data:', error);
        toast.danger('Маълумотларни юклашда хатолик юз берди: ' + error.message);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    if (isModalOpen && (modalMode === 'add' || modalMode === 'edit') && nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, [isModalOpen, modalMode]);

  const updateProductStatus = (product) => {
    if (PRODUCT_STATUSES.map((s) => s.value).includes(product.status)) {
      return product;
    }
    let status = product.status;
    if (product.quantity === 0) {
      status = 'SOLD';
    } else {
      status = 'IN_WAREHOUSE';
    }
    return { ...product, status };
  };

  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.barcode?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    const matchesCategory =
      selectedCategory === 'all' || product.categoryId.toString() === selectedCategory;
    const matchesBranch = !selectedBranchId || product.branchId.toString() === selectedBranchId;
    return matchesSearch && matchesCategory && matchesBranch;
  });

  const handleAddProduct = async () => {
    if (!formData.name || !formData.categoryId || !formData.branchId || !formData.status) {
      toast.danger('Илтимос, мажбурий майдонларни тўлдиринг!');
      return;
    }

    const newProduct = {
      name: formData.name,
      barcode: formData.barcode || null,
      description: formData.description || null,
      categoryId: Number(formData.categoryId),
      status: formData.status,
      branchId: Number(formData.branchId),
      price: Number(formData.price),
      marketPrice: formData.marketPrice ? Number(formData.marketPrice) : null,
      quantity: Number(formData.quantity),
    };

    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/products`, {
        method: 'POST',
        body: JSON.stringify(newProduct),
      });
      const addedProduct = await response.json();
      setProducts([...products, updateProductStatus(addedProduct)]);
      setIsModalOpen(false);
      resetForm();
      toast.success(`${newProduct.name} маҳсулоти муваффақиятли қўшилди!`);
    } catch (error) {
      console.error('Error adding product:', error);
      toast.danger('Маҳсулот қўшишда хатолик юз берди: ' + error.message);
    }
  };

  const handleEditProduct = async () => {
    if (!currentProduct || !formData.name || !formData.categoryId || !formData.branchId || !formData.status) {
      toast.danger('Илтимос, мажбурий майдонларни тўлдиринг!');
      return;
    }

    const updatedProduct = {
      name: formData.name,
      barcode: formData.barcode || null,
      description: formData.description || null,
      categoryId: Number(formData.categoryId),
      status: formData.status,
      branchId: Number(formData.branchId),
      price: Number(formData.price),
      marketPrice: formData.marketPrice ? Number(formData.marketPrice) : null,
      quantity: Number(formData.quantity),
    };

    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/products/${currentProduct.id}`, {
        method: 'PUT',
        body: JSON.stringify(updatedProduct),
      });
      const updatedData = await response.json();
      setProducts(
        products.map((p) => (p.id === currentProduct.id ? updateProductStatus(updatedData) : p))
      );
      setIsModalOpen(false);
      setCurrentProduct(null);
      resetForm();
      toast.success(`${updatedProduct.name} маҳсулоти муваффақиятли янгиланди!`);
    } catch (error) {
      console.error('Error updating product:', error);
      toast.danger('Маҳсулотни янгилашда хатолик юз берди: ' + error.message);
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (window.confirm('Бу маҳсулотни ўчиришни хоҳлайсизми?')) {
      try {
        await fetchWithAuth(`${API_BASE_URL}/products/${productId}`, {
          method: 'DELETE',
        });
        setProducts(products.filter((p) => p.id !== productId));
        toast.success('Маҳсулот муваффақиятли ўчирилди!');
      } catch (error) {
        console.error('Error deleting product:', error);
        toast.danger('Маҳсулотни ўчиришда хатолик юз берди: ' + error.message);
      }
    }
  };

  const handleRefresh = async () => {
    try {
      setIsLoading(true);
      const response = await fetchWithAuth(`${API_BASE_URL}/products`);
      const updatedProducts = await response.json();
      setProducts(updatedProducts.map((product) => updateProductStatus(product)));
    } catch (error) {
      console.error('Error refreshing products:', error);
      toast.danger('Маҳсулотларни янгилашда хатолик юз берди: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleScanBarcode = () => {
    const scannedBarcode = prompt('Штрих-кодни киритинг (сканер симуляцияси):');
    if (scannedBarcode) {
      setFormData((prev) => ({ ...prev, barcode: scannedBarcode }));
    }
  };

  const openAddModal = () => {
    setModalMode('add');
    setIsModalOpen(true);
    resetForm();
  };

  const openEditModal = (product) => {
    setCurrentProduct(product);
    setFormData({
      name: product.name,
      barcode: product.barcode || '',
      description: product.description || '',
      categoryId: product.categoryId.toString(),
      branchId: product.branchId.toString(),
      price: product.price,
      marketPrice: product.marketPrice || '',
      quantity: product.quantity,
      status: product.status,
    });
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const openViewModal = (product) => {
    setCurrentProduct(product);
    setModalMode('view');
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      barcode: '',
      description: '',
      categoryId: '',
      branchId: selectedBranchId,
      price: 0,
      marketPrice: null,
      quantity: 0,
      status: 'IN_WAREHOUSE',
    });
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setCurrentProduct(null);
    resetForm();
  };

  const handleModalSave = () => {
    if (modalMode === 'add') {
      handleAddProduct();
    } else if (modalMode === 'edit') {
      handleEditProduct();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-0 flex flex-col justify-center items-center gap-5">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 w-full">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Инвентар Бошқаруви</h1>
          <p className="text-gray-600 mt-1">Маҳсулотлар ва захираларни бошқаринг</p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={handleRefresh}
            className="flex items-center px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-all duration-200 transform hover:scale-105"
          >
            <RotateCcw size={20} className="mr-2" />
            Янгилаш
          </button>
          <button
            onClick={openAddModal}
            className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 transform hover:scale-105"
          >
            <Plus size={20} className="mr-2" />
            Янги Маҳсулот
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 w-full">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
              size={20}
            />
            <input
              type="text"
              placeholder="Маҳсулот номи ёки штрих-код бўйича қидиринг..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
            />
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center">
              <Filter className="text-gray-400 mr-2" size={20} />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              >
                <option value="all">Барча категорилар</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 w-full">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center">
            <div className="p-3 bg-blue-50 rounded-lg mr-4">
              <Package className="text-blue-600" size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Жами Маҳсулотлар</p>
              <p className="text-2xl font-bold text-gray-900">{filteredProducts.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center">
            <div className="p-3 bg-green-50 rounded-lg mr-4">
              <CheckCircle className="text-green-600" size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Омборда / Дўконда</p>
              <p className="text-2xl font-bold text-gray-900">
                {filteredProducts.filter((p) => p.status === 'IN_WAREHOUSE' || p.status === 'IN_STORE')
                  .length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center">
            <div className="p-3 bg-blue-50 rounded-lg mr-4">
              <Clock className="text-blue-600" size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Сотилган</p>
              <p className="text-2xl font-bold text-gray-900">
                {filteredProducts.filter((p) => p.status === 'SOLD').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center">
            <div className="p-3 bg-red-50 rounded-lg mr-4">
              <AlertTriangle className="text-red-600" size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Брак</p>
              <p className="text-2xl font-bold text-gray-900">
                {filteredProducts.filter((p) => p.status === 'DEFECTIVE').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center">
            <div className="p-3 bg-yellow-50 rounded-lg mr-4">
              <RotateCcw className="text-yellow-600" size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Қайтарилган</p>
              <p className="text-2xl font-bold text-gray-900">
                {filteredProducts.filter((p) => p.status === 'RETURNED').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden w-full">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Маҳсулот
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Категория
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Нарx (Олинган)
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Нарx (Сотув)
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Захира
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ҳолат
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Филиал
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Амаллар
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredProducts.map((product) => (
                <tr
                  key={product.id}
                  className="hover:bg-gray-50 transition-colors duration-150"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{product.name}</div>
                    <div className="text-sm text-gray-500">
                      ID: {product.id} {product.barcode && `• Штрих-код: ${product.barcode}`}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-3 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                      {categories.find((c) => c.id === product.categoryId)?.name || 'Номаълум'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {product.price.toLocaleString()} сўм
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {product.marketPrice ? `${product.marketPrice.toLocaleString()} сўм` : 'Белгиланмаган'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{product.quantity} дона</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {getStatusIcon(product.status) && (
                        React.createElement(getStatusIcon(product.status), {
                          className: getStatusColor(product.status),
                          size: 20,
                        })
                      )}
                      <span className="ml-2 text-sm text-gray-700">
                        {getStatusText(product.status)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {branches.find((b) => b.id === product.branchId)?.name || 'Номаълум'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => openViewModal(product)}
                        className="text-gray-600 hover:text-gray-900 p-2 rounded-lg hover:bg-gray-100 transition-all duration-200"
                        title="Кўриш"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        onClick={() => openEditModal(product)}
                        className="text-blue-600 hover:text-blue-900 p-2 rounded-lg hover:bg-blue-50 transition-all duration-200"
                        title="Таҳрирлаш"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(product.id)}
                        className="text-red-600 hover:text-red-900 p-2 rounded-lg hover:bg-red-50 transition-all duration-200"
                        title="Ўчириш"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <Package className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Маҳсулот топилмади</h3>
            <p className="mt-1 text-sm text-gray-500">Қидирув критерияларига мос маҳсулот йўқ.</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">
                {modalMode === 'add'
                  ? 'Янги Маҳсулот Қўшиш'
                  : modalMode === 'edit'
                  ? 'Маҳсулотни Таҳрирлаш'
                  : 'Маҳсулот Маълумотлари'}
              </h2>
              <button
                onClick={handleModalClose}
                className="text-gray-400 hover:text-red-700 p-1 rounded-full hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              {modalMode === 'view' && currentProduct ? (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-0">
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">
                          Маҳсулот номи
                        </label>
                        <p className="text-lg font-semibold text-gray-900">{currentProduct.name}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">
                          ID / Штрих-код
                        </label>
                        <p className="text-gray-900">
                          {currentProduct.id}{' '}
                          {currentProduct.barcode && ` /  ${currentProduct.barcode}`}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">
                          Категория
                        </label>
                        <span className="inline-block px-3 py-1 text-sm font-medium bg-gray-100 text-gray-800 rounded-full">
                          {categories.find((c) => c.id === currentProduct.categoryId)?.name ||
                            'Номаълум'}
                        </span>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">
                          Филиал
                        </label>
                        <p className="text-gray-900">
                          {branches.find((b) => b.id === currentProduct.branchId)?.name ||
                            'Номаълум'}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">
                          Нарx (Олинган)
                        </label>
                        <p className="text-lg font-semibold text-gray-900">
                          {currentProduct.price.toLocaleString()} сўм
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">
                          Нарx (Сотув)
                        </label>
                        <p className="text-lg font-semibold text-gray-900">
                          {currentProduct.marketPrice
                            ? `${currentProduct.marketPrice.toLocaleString()} сўм`
                            : 'Белгиланмаган'}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">
                          Захира
                        </label>
                        <p className="text-gray-900">{currentProduct.quantity} дона</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">
                          Ҳолат
                        </label>
                        <div className="flex items-center">
                          {React.createElement(getStatusIcon(currentProduct.status), {
                            className: getStatusColor(currentProduct.status),
                            size: 20,
                          })}
                          <span className="ml-2 text-gray-900">
                            {getStatusText(currentProduct.status)}
                          </span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">
                          Охирги янгиланиш
                        </label>
                        <p className="text-gray-900">
                          {new Date(currentProduct.updatedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                  {currentProduct.description && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-2">
                        Тавсиф
                      </label>
                      <p className="text-gray-900 bg-gray-50 p-4 rounded-lg">
                        {currentProduct.description}
                      </p>
                    </div>
                  )}
                  <div className="flex justify-end space-x-3 pt-4 border-t">
                    <button
                      onClick={() => openEditModal(currentProduct)}
                      className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                    >
                      <Edit3 size={16} className="mr-2" />
                      Таҳрирлаш
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Маҳсулот номи *
                      </label>
                      <input
                        type="text"
                        ref={nameInputRef}
                        value={formData.name}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, name: e.target.value }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Маҳсулот номини киритинг"
                      />
                    </div>
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Штрих-код
                        </label>
                        <input
                          type="text"
                          value={formData.barcode}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, barcode: e.target.value }))
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Штрих-код"
                        />
                      </div>
                      <button
                        onClick={handleScanBarcode}
                        className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 color-customBlue hover:text-gray-800 transition-all duration-200"
                        title="Штрих-кодни сканерлаш"
                      >
                        <ScanLine size={26} />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Категория *
                      </label>
                      <select
                        value={formData.categoryId}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, categoryId: e.target.value }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">Категорияни танланг</option>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Филиал *
                      </label>
                      <select
                        value={formData.branchId}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, branchId: e.target.value }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        disabled={selectedBranchId !== ''}
                      >
                        <option value="">Филиални танланг</option>
                        {branches.map((branch) => (
                          <option key={branch.id} value={branch.id}>
                            {branch.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Нарx (Олинган, сўм)
                      </label>
                      <input
                        min="0"
                        type="number"
                        value={formData.price}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, price: Number(e.target.value) }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Нарx (Сотув, сўм)
                      </label>
                      <input
                        min="0"
                        type="number"
                        value={formData.marketPrice || ''}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            marketPrice: e.target.value ? Number(e.target.value) : null,
                          }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Сотув нарxини киритинг (ихтиёрий)"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Захира (дона)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.quantity}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, quantity: Number(e.target.value) }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Ҳолат *
                      </label>
                      <select
                        value={formData.status}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, status: e.target.value }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">Ҳолатни танланг</option>
                        {PRODUCT_STATUSES.map((status) => (
                          <option key={status.value} value={status.value}>
                            {status.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Тавсиф
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, description: e.target.value }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows={3}
                      placeholder="Маҳсулот ҳақида қўшимча маълумот"
                    />
                  </div>
                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={handleModalClose}
                      className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200"
                    >
                      Бекор қилиш
                    </button>
                    <button
                      onClick={handleModalSave}
                      className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                    >
                      <Save size={16} className="mr-2" />
                      {modalMode === 'add' ? 'Сақлаш' : 'Янгилаш'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
};

export default Inventory;