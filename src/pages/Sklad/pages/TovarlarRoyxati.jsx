import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

// Notification component remains unchanged
const Notification = ({ message, type, onClose }) => (
  <div
    className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg border-l-4 ${
      type === 'error'
        ? 'bg-red-50 border-red-400 text-red-700'
        : 'bg-green-50 border-green-400 text-green-700'
    } max-w-md`}
  >
    <div className="flex items-center">
      <div className="flex-shrink-0">
        {type === 'error' ? (
          <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
        ) : (
          <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </div>
      <div className="ml-3">
        <p className="text-sm font-medium">{message}</p>
      </div>
      <div className="ml-auto pl-3">
        <button
          onClick={onClose}
          className="inline-flex text-gray-400 hover:text-gray-600 focus:outline-none"
        >
          <svg className="h-5 w-5" viewBox="0 0 20 24" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
    </div>
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
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [selectedDefectiveProducts, setSelectedDefectiveProducts] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [exchangeRate, setExchangeRate] = useState(0);
  const [lastExchangeRateUpdate, setLastExchangeRateUpdate] = useState(null);
  const [exchangeRateLoading, setExchangeRateLoading] = useState(false);
  const [exchangeRateCheckInterval, setExchangeRateCheckInterval] = useState(null);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();
  const API_URL = 'https://suddocs.uz';

  const formatPrice = (price) =>
    price >= 0
      ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price)
      : 'Unknown';

  const formatPriceSom = (price) => {
    if (price >= 0) {
      const priceInSom = price * exchangeRate;
      return new Intl.NumberFormat('uz-UZ').format(priceInSom) + ' so\'m';
    }
    return 'Noma\'lum';
  };

  const formatMarketPriceSom = (marketPrice) => {
    if (marketPrice >= 0) {
      const priceInSom = marketPrice * exchangeRate;
      return new Intl.NumberFormat('uz-UZ').format(priceInSom) + ' so\'m';
    }
    return 'Noma\'lum';
  };

  const fetchExchangeRate = async () => {
    try {
      setExchangeRateLoading(true);
      const token = localStorage.getItem('access_token');
      if (token) {
        const response = await axios.get(`${API_URL}/currency-exchange-rates`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (response.data && Array.isArray(response.data) && response.data.length > 0) {
          const firstExchangeRate = response.data[0];
          if (firstExchangeRate && firstExchangeRate.rate) {
            const oldRate = exchangeRate;
            setExchangeRate(firstExchangeRate.rate);
            setLastExchangeRateUpdate(new Date());
            
            if (oldRate !== 0 && oldRate !== firstExchangeRate.rate) {
              setNotification({ 
                message: `Valyuta kursi yangilandi: 1 USD = ${firstExchangeRate.rate.toLocaleString('uz-UZ')} so'm`, 
                type: 'success' 
              });
            }
          }
        } else {
          console.warn('No exchange rates found in response');
        }
      }
    } catch (error) {
      console.error('Failed to fetch exchange rate:', error);
    } finally {
      setExchangeRateLoading(false);
    }
  };

  const startExchangeRateMonitoring = useCallback(() => {
    if (exchangeRateCheckInterval) {
      clearInterval(exchangeRateCheckInterval);
    }

    const interval = setInterval(async () => {
      try {
        const token = localStorage.getItem('access_token');
        if (token) {
          const response = await axios.get(`${API_URL}/currency-exchange-rates/current-rate?fromCurrency=USD&toCurrency=UZS`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (response.data && response.data.rate) {
            const oldRate = exchangeRate;
            if (oldRate !== response.data.rate) {
              setExchangeRate(response.data.rate);
              setLastExchangeRateUpdate(new Date());
              
              setNotification({ 
                message: `Valyuta kursi avtomatik yangilandi: 1 USD = ${response.data.rate.toLocaleString('uz-UZ')} so'm`, 
                type: 'success' 
              });
            }
          }
        }
      } catch (error) {
        console.log('Background exchange rate check failed:', error);
      }
    }, 10000);

    setExchangeRateCheckInterval(interval);
    return interval;
  }, [exchangeRate]);

  const startRealTimeMonitoring = useCallback(() => {
    let checkCount = 0;
    const maxChecks = 20;
    
    const performCheck = async () => {
      try {
        const token = localStorage.getItem('access_token');
        if (token) {
          const response = await axios.get(`${API_URL}/currency-exchange-rates/current-rate?fromCurrency=USD&toCurrency=UZS`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (response.data && response.data.rate) {
            const oldRate = exchangeRate;
            if (oldRate !== response.data.rate) {
              setExchangeRate(response.data.rate);
              setLastExchangeRateUpdate(new Date());
              
              setNotification({ 
                message: `Valyuta kursi real-time yangilandi: 1 USD = ${response.data.rate.toLocaleString('uz-UZ')} so'm`, 
                type: 'success' 
              });
              
              checkCount = 0;
            }
          }
        }
      } catch (error) {
        console.log('Real-time exchange rate check failed:', error);
      }
      
      if (checkCount < maxChecks) {
        checkCount++;
        const delay = Math.min(1000 * Math.pow(1.2, checkCount), 8000);
        setTimeout(performCheck, delay);
      }
    };
    
    performCheck();
  }, [exchangeRate]);

  const startUltraFastMonitoring = useCallback(() => {
    const performUltraFastCheck = async () => {
      try {
        const token = localStorage.getItem('access_token');
        if (token) {
          const response = await axios.get(`${API_URL}/currency-exchange-rates/current-rate?fromCurrency=USD&toCurrency=UZS`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (response.data && response.data.rate) {
            const oldRate = exchangeRate;
            if (oldRate !== response.data.rate) {
              setExchangeRate(response.data.rate);
              setLastExchangeRateUpdate(new Date());
              
              setNotification({ 
                message: `Valyuta kursi darhol yangilandi: 1 USD = ${response.data.rate.toLocaleString('uz-UZ')} so'm`, 
                type: 'success' 
              });
            }
          }
        }
      } catch (error) {
        console.log('Ultra-fast exchange rate check failed:', error);
      }
      
      setTimeout(performUltraFastCheck, 2000);
    };
    
    performUltraFastCheck();
  }, [exchangeRate]);

  const startSSEMonitoring = useCallback(() => {
    try {
      const token = localStorage.getItem('access_token');
      if (token) {
        const eventSource = new EventSource(`${API_URL}/currency-exchange-rates/stream?token=${token}`);
        
        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.rate && data.rate !== exchangeRate) {
              setExchangeRate(data.rate);
              setLastExchangeRateUpdate(new Date());
              
              setNotification({ 
                message: `Valyuta kursi real-time yangilandi: 1 USD = ${data.rate.toLocaleString('uz-UZ')} so'm`, 
                type: 'success' 
              });
            }
          } catch (error) {
            console.log('SSE data parsing error:', error);
          }
        };
        
        eventSource.onerror = (error) => {
          console.log('SSE connection error:', error);
          eventSource.close();
        };
        
        return () => {
          eventSource.close();
        };
      }
    } catch (error) {
      console.log('SSE monitoring failed:', error);
    }
  }, [exchangeRate]);

  const startWebSocketMonitoring = useCallback(() => {
    try {
      const token = localStorage.getItem('access_token');
      if (token) {
        const ws = new WebSocket(`${API_URL.replace('https', 'wss')}/currency-exchange-rates/ws?token=${token}`);
        
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'EXCHANGE_RATE_UPDATE' && data.rate && data.rate !== exchangeRate) {
              setExchangeRate(data.rate);
              setLastExchangeRateUpdate(new Date());
              
              setNotification({ 
                message: `Valyuta kursi WebSocket orqali yangilandi: 1 USD = ${data.rate.toLocaleString('uz-UZ')} so'm`, 
                type: 'success' 
              });
            }
          } catch (error) {
            console.log('WebSocket data parsing error:', error);
          }
        };
        
        ws.onerror = (error) => {
          console.log('WebSocket connection error:', error);
        };
        
        ws.onclose = () => {
          console.log('WebSocket connection closed');
        };
        
        return () => {
          ws.close();
        };
      }
    } catch (error) {
      console.log('WebSocket monitoring failed:', error);
    }
  }, [exchangeRate]);

  const formatQuantity = (qty) => (qty >= 0 ? new Intl.NumberFormat('uz-UZ').format(qty) + ' dona' : 'Noma\'lum');

  const statusOptions = [
    { value: 'IN_WAREHOUSE', label: 'Skladda', color: 'bg-blue-100 text-blue-800' },
    { value: 'IN_STORE', label: 'Do\'konda', color: 'bg-green-100 text-green-800' },
    { value: 'SOLD', label: 'Sotilgan', color: 'bg-purple-100 text-purple-800' },
    { value: 'DEFECTIVE', label: 'Nuqsonli', color: 'bg-red-100 text-red-800' },
    { value: 'RETURNED', label: 'Qaytarilgan', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'CARRIER', label: 'Tashuvchi', color: 'bg-indigo-100 text-indigo-800' },
    { value: 'FIXED', label: 'Tuzatilgan', color: 'bg-emerald-100 text-emerald-800' },
  ];

  const generateReceipt = (product, quantity, price) => {
    const date = new Date().toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' });
    const marketPrice = product.marketPrice || product.price;
    const receiptContent = `
      Chek
      -----------------------
      Tovar: ${product.name}
      Soni: ${formatQuantity(quantity)}
      Narx (USD): ${formatPrice(marketPrice)}
      Narx (сом): ${formatMarketPriceSom(marketPrice)}
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
    fetchExchangeRate();
    
    const monitoringInterval = startExchangeRateMonitoring();
    startRealTimeMonitoring();
    startUltraFastMonitoring();
    const sseCleanup = startSSEMonitoring();
    const wsCleanup = startWebSocketMonitoring();
    
    return () => {
      if (monitoringInterval) {
        clearInterval(monitoringInterval);
      }
      if (exchangeRateCheckInterval) {
        clearInterval(exchangeRateCheckInterval);
      }
      if (sseCleanup) {
        sseCleanup();
      }
      if (wsCleanup) {
        wsCleanup();
      }
    };
  }, [startExchangeRateMonitoring, startRealTimeMonitoring, startUltraFastMonitoring, startSSEMonitoring, startWebSocketMonitoring]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchExchangeRate();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
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
      if (searchTerm.trim()) {
        queryParams.append('search', searchTerm);
        queryParams.append('searchBy', 'name,barcode,model');
      }
      queryParams.append('includeZeroQuantity', 'true');
      const productsRes = await axiosWithAuth({
        method: 'get',
        url: `${API_URL}/products?${queryParams.toString()}`,
      });
      setProducts(productsRes.data);
      setSelectedProducts([]);
    } catch (err) {
      setNotification({ message: err.message || 'Ma\'lumotlarni yuklashda xatolik', type: 'error' });
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
      setNotification({ message: err.message || 'Nuqsonli mahsulotlarni yuklashda xatolik', type: 'error' });
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
      setNotification({ message: err.message || 'Tuzatilgan mahsulotlarni yuklashda xatolik', type: 'error' });
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
  }, [loadAllProducts, loadDefectiveProducts, loadFixedProducts, selectedBranchId]);

  const isOmborBranch = () => {
    const branch = branches.find((b) => b.id.toString() === selectedBranchId);
    return branch && branch.name.toLowerCase() === 'ombor';
  };

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

  const openDefectiveModal = (product) => {
    setSelectedProduct(product);
    setDefectiveCount('1');
    setDefectiveDescription('');
    setErrors({});
    setShowDefectiveModal(true);
  };

  const openUploadModal = () => {
    setSelectedFile(null);
    setUploadBranch(selectedBranchId || '');
    setUploadCategory('');
    setUploadStatus('IN_STORE');
    setErrors({});
    setShowUploadModal(true);
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
    if (!selectedFile) newErrors.file = 'Fayl tanlanishi shart';
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
      await axiosWithAuth({
        method: 'put',
        url: `${API_URL}/products/${selectedProduct.id}/partial-defective`,
        data: { defectiveCount: Number(defectiveCount), description: defectiveDescription },
      });
      setNotification({
        message: 'Mahsulot muvaffaqiyatli defective qilib belgilandi',
        type: 'success',
      });
      closeDefectiveModal();
      loadAllProducts();
      loadDefectiveProducts();
      loadFixedProducts();
    } catch (err) {
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
        data: { ids: selectedProducts.map((id) => Number(id)), description: bulkDefectiveDescription },
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
        data: { ids: selectedDefectiveProducts.map((id) => Number(id)) },
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
        url: `${API_URL}/products/${product.id}?hard=true`,
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
      const numericIds = selectedProducts.map((id) => Number(id)).filter((n) => Number.isFinite(n));
      try {
        await axiosWithAuth({
          method: 'delete',
          url: `${API_URL}/products/bulk?hard=true`,
          data: { ids: numericIds },
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (err) {
        const message = err?.response?.data?.message || '';
        if (
          err?.response?.status === 400 &&
          (message.includes('numeric string is expected') || message.includes('Validation failed'))
        ) {
          await Promise.all(
            numericIds.map((id) =>
              axiosWithAuth({ method: 'delete', url: `${API_URL}/products/${id}?hard=true` })
            )
          );
        } else {
          throw err;
        }
      }
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
    setSelectedProducts((prev) => {
      if (prev.includes(productId)) {
        return prev.filter((id) => id !== productId);
      } else if (prev.length < 50) {
        return [...prev, productId];
      } else {
        setNotification({ message: "50 tadan ortiq mahsulot tanlab bo'lmaydi", type: 'error' });
        return prev;
      }
    });
  };

  const handleSelect50 = () => {
    const availableProducts = products.filter((product) => !selectedProducts.includes(product.id));
    const productsToSelect = availableProducts.slice(0, 50 - selectedProducts.length).map((product) => product.id);
    setSelectedProducts((prev) => [...prev, ...productsToSelect]);
    if (productsToSelect.length > 0) {
      setNotification({ message: `${productsToSelect.length} ta mahsulot tanlandi`, type: 'success' });
    } else {
      setNotification({ message: "Tanlash uchun yetarli mahsulot yo'q", type: 'error' });
    }
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
      if (selectedProducts.length === products.length || selectedProducts.length >= 50) {
        setSelectedProducts([]);
      } else {
        const newSelection = products.slice(0, 50).map((product) => product.id);
        setSelectedProducts(newSelection);
        setNotification({ message: `${newSelection.length} ta mahsulot tanlandi`, type: 'success' });
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
    }
  };

  const handleUploadSubmit = async () => {
    if (!validateUploadFields()) {
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

  const renderTable = (data, selected, onSelect, onSelectAll, type) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden w-full">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
              {type === 'all' && (
                <th className="px-3 py-2 text-left text-base font-semibold text-gray-600 uppercase tracking-wider">Tanla</th>
              )}
              <th className="px-3 py-2 text-left text-base font-semibold text-gray-600 uppercase tracking-wider">ID</th>
              <th className="px-3 py-2 text-left text-base font-semibold text-gray-600 uppercase tracking-wider">Nomi</th>
              <th className="px-3 py-2 text-left text-base font-semibold text-gray-600 uppercase tracking-wider">Shtrix</th>
              <th className="px-3 py-2 text-left text-base font-semibold text-gray-600 uppercase tracking-wider">Model</th>
              <th className="px-3 py-2 text-left text-base font-semibold text-gray-600 uppercase tracking-wider">Kategoriya</th>
              <th className="px-3 py-2 text-left text-base font-semibold text-gray-600 uppercase tracking-wider">Narx (USD)</th>
              <th className="px-3 py-2 text-left text-base font-semibold text-gray-600 uppercase tracking-wider">Narx (сом)</th>
              <th className="px-3 py-2 text-left text-base font-semibold text-gray-600 uppercase tracking-wider">Sotish narxi (USD)</th>
              <th className="px-3 py-2 text-left text-base font-semibold text-gray-600 uppercase tracking-wider">Sotish narxi (сом)</th>
              <th className="px-3 py-2 text-left text-base font-semibold text-gray-600 uppercase tracking-wider">Miqdor</th>
              <th className="px-3 py-2 text-left text-base font-semibold text-gray-600 uppercase tracking-wider">Nuqsonli</th>
              <th className="px-3 py-2 text-left text-base font-semibold text-gray-600 uppercase tracking-wider">Amallar</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((product, index) => (
              <tr key={product.id} className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-gray-100 transition-colors duration-150`}>
                {type === 'all' && (
                  <td className="px-3 py-2 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selected.includes(product.id)}
                      onChange={() => onSelect(product.id)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      disabled={!isOmborBranch() || selectedProducts.length >= 50 && !selected.includes(product.id)}
                    />
                  </td>
                )}
                <td className="px-3 py-2 whitespace-nowrap text-base font-semibold text-gray-900">#{product.id}</td>
                <td className="px-3 py-2 whitespace-nowrap text-base text-gray-900 max-w-xs truncate" title={product.name}>{product.name}</td>
                <td className="px-3 py-2 whitespace-nowrap text-base text-gray-600">{product.barcode || 'N/A'}</td>
                <td className="px-3 py-2 whitespace-nowrap text-base text-gray-600">{product.model || 'N/A'}</td>
                <td className="px-3 py-2 whitespace-nowrap text-base text-gray-600">{product.category?.name || 'Noma\'lum'}</td>
                <td className="px-3 py-2 whitespace-nowrap text-base font-semibold text-gray-900">{formatPrice(product.price)}</td>
                <td className="px-3 py-2 whitespace-nowrap text-base font-semibold text-gray-900">{formatPriceSom(product.price)}</td>
                <td className="px-3 py-2 whitespace-nowrap text-base font-semibold text-gray-900">{formatPrice(product.marketPrice)}</td>
                <td className="px-3 py-2 whitespace-nowrap text-base font-semibold text-gray-900">{formatMarketPriceSom(product.marketPrice)}</td>
                <td className="px-3 py-2 whitespace-nowrap text-base text-gray-900">{formatQuantity(product.quantity)}</td>
                <td className="px-3 py-2 whitespace-nowrap text-base text-gray-600">{formatQuantity(product.defectiveQuantity)}</td>
                <td className="px-3 py-2 whitespace-nowrap text-base font-medium">
                  <div className="flex flex-col space-y-1">
                    {isOmborBranch() && (
                      <>
                        <button
                          onClick={() => openEditModal(product)}
                          disabled={submitting}
                          className="inline-flex items-center px-1.5 py-0.5 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Tahrir
                        </button>
                        <button
                          onClick={() => handleDelete(product)}
                          disabled={submitting}
                          className="inline-flex items-center px-1.5 py-0.5 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          O'chirish
                        </button>
                      </>
                    )}
                    {type === 'defective' && product.defectiveQuantity > 0 && (
                      <button
                        onClick={() => {
                          const restoreCount = product.defectiveQuantity;
                          handleRestore(product.id, restoreCount);
                        }}
                        disabled={submitting}
                        className="inline-flex items-center px-1.5 py-0.5 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                      >
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
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
      {data.length === 0 && (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <h3 className="mt-2 text-base font-medium text-gray-900">Hech qanday mahsulot topilmadi</h3>
          <p className="mt-1 text-sm text-gray-500">Filialni tanlang yoki qidiruv so'zini o'zgartiring</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Mahsulotlar Boshqaruvi</h1>
        <p className="text-gray-700 text-lg">Barcha mahsulotlarni ko'rish, tahrirlash va boshqarish</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <label className="block text-lg font-semibold text-gray-800 mb-3">Filialni tanlang</label>
        <select
          value={selectedBranchId}
          onChange={(e) => {
            setSelectedBranchId(e.target.value);
            setEditBranch(e.target.value);
            setCreateBranch(e.target.value);
            setUploadBranch(e.target.value);
          }}
          className="w-full max-w-md px-5 py-3 border border-gray-300 rounded-lg bg-white text-gray-800 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
        >
          <option value="">Filialni tanlang</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex flex-wrap gap-5 items-center justify-between">
          <div className="flex flex-wrap gap-5 items-center">
            <button
              onClick={openCreateModal}
              disabled={submitting || !isOmborBranch()}
              className="inline-flex items-center px-5 py-3 border border-transparent text-xl font-semibold rounded-lg text-white bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Yangi Mahsulot qo'shish
            </button>
            <div className="relative">
              <input
                type="file"
                accept=".xlsx, .xls"
                onChange={handleFileUpload}
                className="hidden"
                ref={fileInputRef}
              />
              <button
                onClick={openUploadModal}
                disabled={!isOmborBranch()}
                className="inline-flex items-center px-5 py-3 border border-gray-300 text-xl font-semibold rounded-lg text-gray-800 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Excel yuklash
              </button>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-600">Valyuta kursi:</div>
            <div className="text-lg font-semibold text-blue-600 flex items-center gap-2">
              1 USD = {exchangeRate.toLocaleString('uz-UZ')} so'm
            </div>                
            <button
              onClick={fetchExchangeRate}
              disabled={exchangeRateLoading}
              className={`mt-2 px-3 py-1 text-xs rounded-md transition-colors duration-200 flex items-center gap-1 ${
                exchangeRateLoading 
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                  : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
              }`}
              title="Kursni darhol yangilash"
            >
              {exchangeRateLoading ? (
                <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              ) : (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              {exchangeRateLoading ? 'Yuklanmoqda...' : 'Darhol yangilash'}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="relative max-w-2xl">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Nomi, shtrix kod yoki model bo'yicha qidiring..."
            className="block w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-800 placeholder-gray-400 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
          />
        </div>
      </div>

      {notification && <Notification {...notification} onClose={() => setNotification(null)} />}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2 mb-6">
        <div className="flex">
          <button
            onClick={() => setActiveTab('all')}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
              activeTab === 'all'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            Barchasi ({products.length})
          </button>
          <button
            onClick={() => setActiveTab('defective')}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
              activeTab === 'defective'
                ? 'bg-red-600 text-white shadow-md'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            Nuqsonli ({defectiveProducts.length})
          </button>
          <button
            onClick={() => setActiveTab('fixed')}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
              activeTab === 'fixed'
                ? 'bg-green-600 text-white shadow-md'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            Tuzatilgan ({fixedProducts.length})
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Ma'lumotlar yuklanmoqda...</p>
        </div>
      ) : (
        <>
          {activeTab === 'all' && (
            <div className="space-y-6">
              {selectedProducts.length > 0 && isOmborBranch() && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-900">
                      {selectedProducts.length} ta mahsulot tanlandi
                    </h3>
                    <div className="flex gap-3">
                      <button
                        onClick={handleSelect50}
                        disabled={submitting || selectedProducts.length >= 50 || !isOmborBranch()}
                        className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        50 ta tanlash
                      </button>
                      {selectedProducts.length === 50 && (
                        <button
                          onClick={handleBulkDelete}
                          disabled={submitting}
                          className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-lg text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Tanlanganlarni o'chirish
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {renderTable(products, selectedProducts, handleSelectProduct, handleSelectAll, 'all')}
            </div>
          )}
          {activeTab === 'defective' && (
            <div className="space-y-6">
              {selectedDefectiveProducts.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-900">
                      {selectedDefectiveProducts.length} ta nuqsonli mahsulot tanlandi
                    </h3>
                    <button
                      onClick={handleBulkRestore}
                      disabled={submitting}
                      className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-lg text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      ni tuzatish
                    </button>
                  </div>
                </div>
              )}
              {renderTable(defectiveProducts, selectedDefectiveProducts, handleSelectDefectiveProduct, handleSelectAll, 'defective')}
            </div>
          )}
          {activeTab === 'fixed' && (
            <div className="space-y-6">
              {renderTable(fixedProducts, [], () => {}, () => {}, 'fixed')}
            </div>
          )}
        </>
      )}
      {showEditModal && selectedProduct && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-gray-900">Mahsulotni tahrirlash</h3>
                <button
                  onClick={closeEditModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nomi</label>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                      errors.name ? 'border-red-500 ring-red-200' : 'border-gray-300'
                    }`}
                    placeholder="Mahsulot nomi"
                  />
                  {errors.name && <span className="text-red-500 text-xs mt-1">{errors.name}</span>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Shtrix kod</label>
                  <input
                    value={editBarcode}
                    onChange={(e) => setEditBarcode(e.target.value)}
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                      errors.barcode ? 'border-red-500 ring-red-200' : 'border-gray-300'
                    }`}
                    placeholder="Shtrix kod"
                  />
                  {errors.barcode && <span className="text-red-500 text-xs mt-1">{errors.barcode}</span>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Model</label>
                  <input
                    value={editModel}
                    onChange={(e) => setEditModel(e.target.value)}
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                      errors.model ? 'border-red-500 ring-red-200' : 'border-gray-300'
                    }`}
                    placeholder="Model"
                  />
                  {errors.model && <span className="text-red-500 text-xs mt-1">{errors.model}</span>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Narx (USD)</label>
                  <input
                    type="number"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                      errors.price ? 'border-red-500 ring-red-200' : 'border-gray-300'
                    }`}
                    placeholder="0"
                  />
                  {errors.price && <span className="text-red-500 text-xs mt-1">{errors.price}</span>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Miqdor</label>
                  <input
                    type="number"
                    value={editQuantity}
                    onChange={(e) => setEditQuantity(e.target.value)}
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                      errors.quantity ? 'border-red-500 ring-red-200' : 'border-gray-300'
                    }`}
                    placeholder="0"
                  />
                  {errors.quantity && <span className="text-red-500 text-xs mt-1">{errors.quantity}</span>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  >
                    {statusOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Filial</label>
                  <select
                    value={editBranch}
                    onChange={(e) => setEditBranch(e.target.value)}
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                      errors.branch ? 'border-red-500 ring-red-200' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Filialni tanlang</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                  {errors.branch && <span className="text-red-500 text-xs mt-1">{errors.branch}</span>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Kategoriya</label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                      errors.category ? 'border-red-500 ring-red-200' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Kategoriyani tanlang</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  {errors.category && <span className="text-red-500 text-xs mt-1">{errors.category}</span>}
                </div>
              </div>
              <div className="flex gap-4 mt-8">
                <button
                  onClick={handleEditSubmit}
                  disabled={submitting}
                  className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-transparent text-lg font-medium rounded-lg text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {submitting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Saqlanmoqda...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Saqlash
                    </>
                  )}
                </button>
                <button
                  onClick={closeEditModal}
                  disabled={submitting}
                  className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-lg font-medium rounded-lg text-gray-800 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  Bekor qilish
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-gray-900">Yangi Mahsulot qo'shish</h3>
                <button
                  onClick={closeCreateModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nomi</label>
                  <input
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                      errors.name ? 'border-red-500 ring-red-200' : 'border-gray-300'
                    }`}
                    placeholder="Mahsulot nomi"
                  />
                  {errors.name && <span className="text-red-500 text-xs mt-1">{errors.name}</span>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Shtrix kod</label>
                  <input
                    value={createBarcode}
                    onChange={(e) => setCreateBarcode(e.target.value)}
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                      errors.barcode ? 'border-red-500 ring-red-200' : 'border-gray-300'
                    }`}
                    placeholder="Shtrix kod"
                  />
                  {errors.barcode && <span className="text-red-500 text-xs mt-1">{errors.barcode}</span>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Model</label>
                  <input
                    value={createModel}
                    onChange={(e) => setCreateModel(e.target.value)}
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                      errors.model ? 'border-red-500 ring-red-200' : 'border-gray-300'
                    }`}
                    placeholder="Model"
                  />
                  {errors.model && <span className="text-red-500 text-xs mt-1">{errors.model}</span>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Narx (USD)</label>
                  <input
                    type="number"
                    value={createPrice}
                    onChange={(e) => setCreatePrice(e.target.value)}
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                      errors.price ? 'border-red-500 ring-red-200' : 'border-gray-300'
                    }`}
                    placeholder="0"
                  />
                  {errors.price && <span className="text-red-500 text-xs mt-1">{errors.price}</span>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Sotish narxi (USD)</label>
                  <input
                    type="number"
                    value={createMarketPrice}
                    onChange={(e) => setCreateMarketPrice(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Miqdor</label>
                  <input
                    type="number"
                    value={createQuantity}
                    onChange={(e) => setCreateQuantity(e.target.value)}
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                      errors.quantity ? 'border-red-500 ring-red-200' : 'border-gray-300'
                    }`}
                    placeholder="0"
                  />
                  {errors.quantity && <span className="text-red-500 text-xs mt-1">{errors.quantity}</span>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    value={createStatus}
                    onChange={(e) => setCreateStatus(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  >
                    {statusOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Filial</label>
                  <select
                    value={createBranch}
                    onChange={(e) => setCreateBranch(e.target.value)}
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                      errors.branch ? 'border-red-500 ring-red-200' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Filialni tanlang</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                  {errors.branch && <span className="text-red-500 text-xs mt-1">{errors.branch}</span>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Kategoriya</label>
                  <select
                    value={createCategory}
                    onChange={(e) => setCreateCategory(e.target.value)}
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                      errors.category ? 'border-red-500 ring-red-200' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Kategoriyani tanlang</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  {errors.category && <span className="text-red-500 text-xs mt-1">{errors.category}</span>}
                </div>
              </div>
              <div className="flex gap-4 mt-8">
                <button
                  onClick={handleCreateSubmit}
                  disabled={submitting}
                  className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-transparent text-lg font-medium rounded-lg text-white bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {submitting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Qo'shilmoqda...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Qo'shish
                    </>
                  )}
                </button>
                <button
                  onClick={closeCreateModal}
                  disabled={submitting}
                  className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-lg font-medium rounded-lg text-gray-800 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  Bekor qilish
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-gray-900">Excel fayl yuklash</h3>
                <button
                  onClick={closeUploadModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Fayl</label>
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={handleFileUpload}
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                      errors.file ? 'border-red-500 ring-red-200' : 'border-gray-300'
                    }`}
                  />
                  {errors.file && <span className="text-red-500 text-xs mt-1">{errors.file}</span>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Filial</label>
                  <select
                    value={uploadBranch}
                    onChange={(e) => setUploadBranch(e.target.value)}
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                      errors.branch ? 'border-red-500 ring-red-200' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Filialni tanlang</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                  {errors.branch && <span className="text-red-500 text-xs mt-1">{errors.branch}</span>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Kategoriya</label>
                  <select
                    value={uploadCategory}
                    onChange={(e) => setUploadCategory(e.target.value)}
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                      errors.category ? 'border-red-500 ring-red-200' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Kategoriyani tanlang</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  {errors.category && <span className="text-red-500 text-xs mt-1">{errors.category}</span>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    value={uploadStatus}
                    onChange={(e) => setUploadStatus(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  >
                    {statusOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-4 mt-8">
                <button
                  onClick={handleUploadSubmit}
                  disabled={submitting}
                  className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-transparent text-lg font-medium rounded-lg text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {submitting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Yuklanmoqda...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      Yuklash
                    </>
                  )}
                </button>
                <button
                  onClick={closeUploadModal}
                  disabled={submitting}
                  className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-lg font-medium rounded-lg text-gray-800 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  Bekor qilish
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showDefectiveModal && selectedProduct && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-gray-900">Mahsulotni nuqsonli deb belgilash</h3>
                <button
                  onClick={closeDefectiveModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Mahsulot</label>
                  <input
                    value={selectedProduct.name}
                    disabled
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-100 text-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nuqsonli miqdor</label>
                  <input
                    type="number"
                    value={defectiveCount}
                    onChange={(e) => setDefectiveCount(e.target.value)}
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                      errors.defectiveCount ? 'border-red-500 ring-red-200' : 'border-gray-300'
                    }`}
                    placeholder={`1-${selectedProduct.quantity}`}
                    min="1"
                    max={selectedProduct.quantity}
                  />
                  {errors.defectiveCount && <span className="text-red-500 text-xs mt-1">{errors.defectiveCount}</span>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nuqson sababi</label>
                  <textarea
                    value={defectiveDescription}
                    onChange={(e) => setDefectiveDescription(e.target.value)}
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                      errors.defectiveDescription ? 'border-red-500 ring-red-200' : 'border-gray-300'
                    }`}
                    placeholder="Nuqson sababini kiriting"
                    rows="4"
                  />
                  {errors.defectiveDescription && (
                    <span className="text-red-500 text-xs mt-1">{errors.defectiveDescription}</span>
                  )}
                </div>
              </div>
              <div className="flex gap-4 mt-8">
                <button
                  onClick={handleDefectiveSubmit}
                  disabled={submitting}
                  className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-transparent text-lg font-medium rounded-lg text-white bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {submitting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Belgilanmoqda...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Nuqsonli deb belgilash
                    </>
                  )}
                </button>
                <button
                  onClick={closeDefectiveModal}
                  disabled={submitting}
                  className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-lg font-medium rounded-lg text-gray-800 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  Bekor qilish
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showBulkDefectiveModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-gray-900">Tanlangan mahsulotlarni nuqsonli deb belgilash</h3>
                <button
                  onClick={closeBulkDefectiveModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nuqson sababi</label>
                  <textarea
                    value={bulkDefectiveDescription}
                    onChange={(e) => setBulkDefectiveDescription(e.target.value)}
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                      errors.bulkDefectiveDescription ? 'border-red-500 ring-red-200' : 'border-gray-300'
                    }`}
                    placeholder="Nuqson sababini kiriting"
                    rows="4"
                  />
                  {errors.bulkDefectiveDescription && (
                    <span className="text-red-500 text-xs mt-1">{errors.bulkDefectiveDescription}</span>
                  )}
                </div>
              </div>
              <div className="flex gap-4 mt-8">
                <button
                  onClick={handleBulkDefectiveSubmit}
                  disabled={submitting}
                  className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-transparent text-lg font-medium rounded-lg text-white bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {submitting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Belgilanmoqda...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Nuqsonli deb belgilash
                    </>
                  )}
                </button>
                <button
                  onClick={closeBulkDefectiveModal}
                  disabled={submitting}
                  className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-lg font-medium rounded-lg text-gray-800 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  Bekor qilish
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TovarlarRoyxati;