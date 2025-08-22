import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Receipt from '../../KassaUser/Receipt/Receipt';

const Chiqim = () => {
  const [products, setProducts] = useState([]);
  const [modalProducts, setModalProducts] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [tempQuantity, setTempQuantity] = useState('');
  const [tempPrice, setTempPrice] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [toBranch, setToBranch] = useState('');
  const [operationType, setOperationType] = useState('SALE');
  const [paymentType, setPaymentType] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [jshshir, setJshshir] = useState('');
  const [passportSeries, setPassportSeries] = useState('');
  const [downPayment, setDownPayment] = useState('');
  const [months, setMonths] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [notification, setNotification] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [showTransferHistory, setShowTransferHistory] = useState(false);
  const [transferHistory, setTransferHistory] = useState([]);
  const [pendingTransfers, setPendingTransfers] = useState([]);
  const [modalSearch, setModalSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [saleQuantity, setSaleQuantity] = useState('');
  const [transferQuantity, setTransferQuantity] = useState('');
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const printWindowRef = useRef(null);

  const navigate = useNavigate();
  const API_URL = 'https://suddocs.uz';

  const formatCurrency = (amount) =>
    amount != null && Number.isFinite(Number(amount))
      ? new Intl.NumberFormat('uz-UZ').format(Number(amount)) + ' сўм'
      : 'Номаълум';

  const formatQuantity = (qty) =>
    qty != null && Number.isFinite(Number(qty))
      ? new Intl.NumberFormat('uz-UZ').format(Number(qty)) + ' дона'
      : '0 дона';

  const formatDate = (date) =>
    date ? new Date(date).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' }) : 'Номаълум';

  const calculatePaymentSchedule = (items, months, interestRate, downPayment) => {
    const m = Number(months);
    const rate = Number(interestRate) / 100;
    const downPaymentAmount = Number(downPayment) || 0;

    if (!m || m <= 0 || items.length === 0 || rate < 0) {
      return { totalWithInterest: 0, monthlyPayment: 0, schedule: [], downPaymentAmount: 0, remainingAfterDownPayment: 0 };
    }

    const baseTotal = items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.price), 0);
    const totalWithInterest = baseTotal * (1 + rate);
    const remainingAfterDownPayment = totalWithInterest - downPaymentAmount;
    const monthlyPayment = remainingAfterDownPayment / m;
    const schedule = [];

    let remainingBalance = remainingAfterDownPayment;
    for (let i = 1; i <= m; i++) {
      schedule.push({
        month: i,
        payment: monthlyPayment,
        remainingBalance: Math.max(0, remainingBalance - monthlyPayment),
      });
      remainingBalance -= monthlyPayment;
    }

    return { totalWithInterest, monthlyPayment, schedule, downPaymentAmount, remainingAfterDownPayment };
  };

  const axiosWithAuth = async (config) => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      setNotification({ message: 'Sessiya topilmadi, iltimos tizimga kiring', type: 'error' });
      setTimeout(() => navigate('/login'), 2000);
      throw new Error('No access token');
    }
    const headers = { ...config.headers, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    try {
      return await axios({ ...config, headers });
    } catch (error) {
      if (error.response?.status === 401) {
        setNotification({ message: 'Sessiya tugadi, iltimos qayta kiring', type: 'error' });
        localStorage.clear();
        setTimeout(() => navigate('/login'), 2000);
        throw new Error('Sessiya tugadi');
      }
      throw error;
    }
  };

  const handleBranchChange = (branchId) => {
    setSelectedBranchId(branchId);
    localStorage.setItem('branchId', branchId);
    setProducts([]);
    setNotification(null);
    if (branchId) {
      setTimeout(() => {
        loadData();
        loadPendingTransfers();
      }, 100);
    }
  };

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const branchesRes = await axiosWithAuth({ method: 'get', url: `${API_URL}/branches` });
        const branchesData = Array.isArray(branchesRes.data) ? branchesRes.data : branchesRes.data.branches || [];
        setBranches(branchesData);
        const userBranchId = localStorage.getItem('branchId');
        if (userBranchId) {
          setSelectedBranchId(userBranchId);
        } else {
          const omborBranch = branchesData.find((b) => b.name?.toLowerCase() === 'ombor');
          if (omborBranch) {
            setSelectedBranchId(omborBranch.id.toString());
            localStorage.setItem('branchId', omborBranch.id.toString());
          } else {
            setNotification({ message: '"Ombor" filiali topilmadi', type: 'warning' });
          }
        }
      } catch (err) {
        setNotification({ message: err.message || 'Filiallarni yuklashda xatolik', type: 'error' });
        console.error('Fetch branches error:', err);
      }
    };
    fetchBranches();
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setNotification(null);
    const branchId = Number(selectedBranchId);
    if (!branchId || isNaN(branchId) || !Number.isInteger(branchId)) {
      setNotification({ message: 'Filialni tanlang', type: 'error' });
      setProducts([]);
      setLoading(false);
      return;
    }

    try {
      const queryParams = new URLSearchParams();
      queryParams.append('branchId', branchId.toString());
      if (searchTerm.trim()) queryParams.append('search', searchTerm);
      queryParams.append('includeZeroQuantity', 'true');

      let allProducts = [];
      let page = 1;
      while (true) {
        const productsRes = await axiosWithAuth({
          method: 'get',
          url: `${API_URL}/products?${queryParams.toString()}&page=${page}`,
        });
        const productsData = Array.isArray(productsRes.data) ? productsRes.data : productsRes.data.products || [];
        allProducts = [...allProducts, ...productsData];
        if (!productsRes.data.nextPage) break;
        page++;
      }

      setProducts(
        allProducts.map((product) => ({
          ...product,
          name:
            product.name ??
            product.productName ??
            product.title ??
            product.item_name ??
            product.product_title ??
            product.item_title ??
            `Product ${product.id}`,
          price: Number(product.price) || 0,
          quantity: Number(product.quantity) || 0,
        })),
      );
    } catch (err) {
      setNotification({ message: err.message || 'Ma\'lumotlarni yuklashda xatolik', type: 'error' });
      console.error('Load products error:', err);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, selectedBranchId]);

  useEffect(() => {
    if (selectedBranchId) loadData();
  }, [loadData, selectedBranchId]);

  useEffect(() => {
    if (selectedBranchId) {
      setProducts([]);
      loadData();
      loadPendingTransfers();
    }
  }, [selectedBranchId]);

  const loadModalData = useCallback(async () => {
    const branchId = Number(selectedBranch);
    if (!branchId || isNaN(branchId) || !Number.isInteger(branchId)) {
      return;
    }

    try {
      const queryParams = new URLSearchParams();
      queryParams.append('branchId', branchId.toString());
      queryParams.append('includeZeroQuantity', 'true');

      let allProducts = [];
      let page = 1;
      while (true) {
        const productsRes = await axiosWithAuth({
          method: 'get',
          url: `${API_URL}/products?${queryParams.toString()}&page=${page}`,
        });
        const productsData = Array.isArray(productsRes.data) ? productsRes.data : productsRes.data.products || [];
        allProducts = [...allProducts, ...productsData];
        if (!productsRes.data.nextPage) break;
        page++;
      }
      setModalProducts(
        allProducts.map((product) => ({
          ...product,
          name:
            product.name ??
            product.productName ??
            product.title ??
            product.item_name ??
            product.product_title ??
            product.item_title ??
            `Product ${product.id}`,
          price: Number(product.price) || 0,
          quantity: Number(product.quantity) || 0,
        })),
      );
    } catch (err) {
      console.error('Load modal products error:', err);
    }
  }, [selectedBranch]);

  useEffect(() => {
    if (showModal && selectedBranch) loadModalData();
  }, [showModal, selectedBranch, loadModalData]);

  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const token = localStorage.getItem('access_token');
        if (token) {
          const response = await axios.get(`${API_URL}/auth/profile`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setCurrentUser(response.data);
        }
      } catch (error) {
        console.error('Error loading current user:', error);
        setNotification({ message: 'Joriy foydalanuvchini yuklashda xatolik', type: 'error' });
      }
    };
    loadCurrentUser();
  }, []);

  const loadTransferHistory = async () => {
    if (!selectedBranchId) return;

    try {
      const response = await axiosWithAuth({
        method: 'get',
        url: `${API_URL}/transactions?type=SALE&branchId=${selectedBranchId}&limit=50`
      });

      const transfers = response.data.transactions || [];
      setTransferHistory(transfers);
    } catch (error) {
      console.error('Error loading transfer history:', error);
      setNotification({ message: 'Transfer tarixini yuklashda xatolik', type: 'error' });
    }
  };

  const loadPendingTransfers = async () => {
    if (!selectedBranchId) return;

    try {
      const response = await axiosWithAuth({
        method: 'get',
        url: `${API_URL}/transactions/pending-transfers?branchId=${selectedBranchId}`
      });

      const pending = response.data || [];
      setPendingTransfers(pending);

      if (pending.length > 0) {
        const incomingTransfers = pending.filter(t => t.toBranchId === Number(selectedBranchId));
        if (incomingTransfers.length > 0) {
          setNotification({ 
            message: `${incomingTransfers.length} ta kiruvchi o'tkazma kutilmoqda`, 
            type: 'info' 
          });
        }
      }
    } catch (error) {
      console.error('Error loading pending transfers:', error);
    }
  };

  const openSaleModal = (product) => {
    setSelectedProduct(product);
    setSaleQuantity('1');
    setPaymentType('');
    setFirstName('');
    setLastName('');
    setPhone('');
    setJshshir('');
    setPassportSeries('');
    setMonths('');
    setInterestRate('');
    setDownPayment('');
    setErrors({});
    setShowSaleModal(true);
  };

  const openTransferModal = (product) => {
    setSelectedProduct(product);
    setTransferQuantity('1');
    setToBranch('');
    setErrors({});
    setShowTransferModal(true);
  };

  const handleIndividualSale = async (e) => {
    e.preventDefault();
  
    const newErrors = {};
    if (!saleQuantity || isNaN(saleQuantity) || Number(saleQuantity) <= 0 || !Number.isInteger(Number(saleQuantity))) {
      newErrors.saleQuantity = "Miqdor 0 dan katta butun son bo'lishi kerak";
    } else if (Number(saleQuantity) > selectedProduct.quantity) {
      newErrors.saleQuantity = `Maksimal miqdor: ${selectedProduct.quantity} dona`;
    }
    if (!paymentType) newErrors.paymentType = "To'lov turi tanlanishi shart";
  
    const isCreditOrInstallment = ['CREDIT', 'INSTALLMENT'].includes(paymentType);
    if (isCreditOrInstallment) {
      if (!firstName.trim()) newErrors.firstName = "Ism kiritilishi shart";
      if (!lastName.trim()) newErrors.lastName = "Familiya kiritilishi shart";
      if (!phone.trim() || !/^\+?[1-9]\d{1,14}$/.test(phone)) newErrors.phone = "Telefon raqami to'g'ri kiritilishi shart";
      if (!jshshir.trim()) newErrors.jshshir = "JShShIR kiritilishi shart";
      if (!passportSeries.trim()) newErrors.passportSeries = "Passport seriyasi kiritilishi shart";
      if (!months || isNaN(months) || Number(months) <= 0 || !Number.isInteger(Number(months)) || Number(months) > 24) {
        newErrors.months = "Oylar soni 1 dan 24 gacha butun son bo'lishi kerak";
      }
      if (!interestRate || isNaN(interestRate) || Number(interestRate) < 0 || Number(interestRate) > 100) {
        newErrors.interestRate = "Foiz 0 dan 100 gacha bo'lishi kerak";
      }
      if (downPayment && (isNaN(downPayment) || Number(downPayment) < 0)) {
        newErrors.downPayment = "Boshlang'ich to'lov 0 dan katta bo'lishi kerak";
      }
    }
  
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      setNotification({ message: "Barcha maydonlarni to'g'ri to'ldiring", type: 'error' });
      return;
    }
  
    setSubmitting(true);
    setNotification(null);
  
    try {
      const baseTotal = Number(saleQuantity) * Number(selectedProduct.price);
      let finalTotal = baseTotal;
  
      const m = Number(months);
      const rate = Number(interestRate) / 100;
      if (isCreditOrInstallment) {
        finalTotal = baseTotal * (1 + rate);
      }
  
      const payload = {
        type: 'SALE',
        status: 'PENDING',
        total: baseTotal,
        finalTotal,
        downPayment: isCreditOrInstallment ? Number(downPayment) || 0 : undefined,
        paymentType,
        customer: isCreditOrInstallment ? {
          fullName: `${firstName} ${lastName}`.trim(),
          phone,
          jshshir,
          passportSeries,
        } : undefined,
        fromBranchId: Number(selectedBranchId),
        soldByUserId: parseInt(localStorage.getItem('userId')) || null,
        items: [{
          productId: selectedProduct.id,
          quantity: Number(saleQuantity),
          price: Number(selectedProduct.price),
          creditMonth: isCreditOrInstallment ? Number(months) : undefined,
          creditPercent: isCreditOrInstallment ? Number(interestRate) / 100 : undefined,
          monthlyPayment: isCreditOrInstallment ? 
            (Number(saleQuantity) * Number(selectedProduct.price) * (1 + Number(interestRate) / 100)) / Number(months) : undefined,
        }],
      };
  
      const response = await axiosWithAuth({
        method: 'post',
        url: `${API_URL}/transactions`,
        data: payload,
      });
  
      const receiptItems = [{
        name: selectedProduct.name,
        quantity: Number(saleQuantity),
        price: Number(selectedProduct.price),
      }];
      const branchName = branches.find((b) => b.id === Number(selectedBranchId))?.name || 'Noma\'lum';
      const paymentDetails = {
        paymentType,
        months: isCreditOrInstallment ? months : '',
        interestRate: isCreditOrInstallment ? interestRate : '',
        downPayment: isCreditOrInstallment ? downPayment : '',
      };
      const customerDetails = isCreditOrInstallment ? {
        fullName: `${firstName} ${lastName}`.trim(),
        phone,
        jshshir,
        passportSeries,
      } : { fullName: 'Noma\'lum', phone: 'Noma\'lum', jshshir: 'Noma\'lum', passportSeries: 'Noma\'lum' };
  
      setReceiptData({
        items: receiptItems,
        branchName,
        paymentDetails,
        customerDetails,
        date: new Date(),
        total: baseTotal,
        finalTotal,
      });
  
      setNotification({ message: 'Sotish muvaffaqiyatli amalga oshirildi', type: 'success' });
      setShowSaleModal(false);
      setShowReceiptModal(true);
      await loadData();
    } catch (err) {
      let message = 'Sotishda xatolik';
      if (err.response?.data?.message) {
        message = err.response.data.message;
      } else if (err.message) {
        message = err.message;
      }
      setNotification({ message, type: 'error' });
      console.error('Sale error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleIndividualTransfer = async (e) => {
    e.preventDefault();

    const newErrors = {};
    if (!toBranch) newErrors.toBranch = "Qabul qiluvchi filial tanlanishi shart";
    else if (toBranch === selectedBranchId) newErrors.toBranch = "Qabul qiluvchi filial boshqa bo'lishi kerak";
    if (!transferQuantity || isNaN(transferQuantity) || Number(transferQuantity) <= 0 || !Number.isInteger(Number(transferQuantity))) {
      newErrors.transferQuantity = "Miqdor 0 dan katta butun son bo'lishi kerak";
    } else if (Number(transferQuantity) > selectedProduct.quantity) {
      newErrors.transferQuantity = `Maksimal miqdor: ${selectedProduct.quantity} dona`;
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      setNotification({ message: "Barcha maydonlarni to'g'ri to'ldiring", type: 'error' });
      return;
    }

    const confirmMessage = `Haqiqatan ham ${selectedProduct.name} mahsulotidan ${formatQuantity(transferQuantity)} ni ${branches.find(b => b.id === Number(selectedBranchId))?.name} filialidan ${branches.find(b => b.id === Number(toBranch))?.name} filialiga ko'chirmoqchimisiz?`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setSubmitting(true);
    setNotification(null);

    try {
      const response = await axiosWithAuth({
        method: 'post',
        url: `${API_URL}/transactions/transfer`,
        data: {
          fromBranchId: Number(selectedBranchId),
          toBranchId: Number(toBranch),
          soldByUserId: parseInt(localStorage.getItem('userId')) || null,
          items: [{
            productId: selectedProduct.id,
            quantity: Number(transferQuantity),
            price: Number(selectedProduct.price),
          }],
        },
      });

      const destinationBranchName = branches.find(b => b.id === Number(toBranch))?.name;
      const sourceBranchName = branches.find(b => b.id === Number(selectedBranchId))?.name;

      setNotification({ 
        message: `✅ O'tkazma muvaffaqiyatli amalga oshirildi! ${sourceBranchName} filialidan ${destinationBranchName} filialiga ko'chirildi: ${selectedProduct.name} (${formatQuantity(transferQuantity)})`, 
        type: 'success' 
      });

      setShowTransferModal(false);
      await loadData();
    } catch (err) {
      let message = 'Transfer qilishda xatolik';
      if (err.response?.data?.message) {
        message = err.response.data.message;
      } else if (err.message) {
        message = err.message;
      }
      setNotification({ message, type: 'error' });
      console.error('Transfer error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const openModal = () => {
    setSelectedItems([]);
    setSelectedBranch(selectedBranchId || '');
    setToBranch('');
    setOperationType('SALE');
    setPaymentType('');
    setFirstName('');
    setLastName('');
    setPhone('');
    setJshshir('');
    setPassportSeries('');
    setMonths('');
    setInterestRate('');
    setDownPayment('');
    setErrors({});
    setSelectedProductId('');
    setTempQuantity('');
    setTempPrice('');
    setModalProducts(products);
    setModalSearch('');
    setShowSuggestions(false);
    setShowModal(true);
  };

  const addItem = () => {
    if (!selectedProductId || !tempQuantity) return;
    const product = modalProducts.find((p) => p.id === Number(selectedProductId));
    if (!product) return;
    if (selectedItems.find((item) => item.id === product.id)) {
      setNotification({ message: 'Bu mahsulot allaqachon tanlangan', type: 'warning' });
      return;
    }
    const price = tempPrice || product.price.toString();
    if (Number(price) <= 0) {
      setNotification({ message: "Narx 0 dan katta bo'lishi kerak", type: 'error' });
      return;
    }
    setSelectedItems([
      ...selectedItems,
      {
        id: product.id,
        name: product.name,
        quantity: tempQuantity,
        price,
        maxQuantity: product.quantity,
      },
    ]);
    setSelectedProductId('');
    setTempQuantity('');
    setTempPrice('');
    setModalSearch('');
    setShowSuggestions(false);
  };

  const updateItem = (index, field, value) => {
    setSelectedItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  };

  const removeItem = (index) => {
    setSelectedItems((prev) => prev.filter((_, i) => i !== index));
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedItems([]);
    setSelectedBranch('');
    setToBranch('');
    setOperationType('SALE');
    setPaymentType('');
    setFirstName('');
    setLastName('');
    setPhone('');
    setJshshir('');
    setPassportSeries('');
    setMonths('');
    setInterestRate('');
    setDownPayment('');
    setErrors({});
    setNotification(null);
    setSelectedProductId('');
    setTempQuantity('');
    setTempPrice('');
    setModalProducts([]);
    setModalSearch('');
    setShowSuggestions(false);
  };

  const validateFields = () => {
    const newErrors = {};
    if (selectedItems.length === 0) newErrors.items = "Kamida bitta mahsulot tanlanishi shart";
    selectedItems.forEach((item, index) => {
      if (!item.quantity || isNaN(item.quantity) || Number(item.quantity) <= 0 || !Number.isInteger(Number(item.quantity))) {
        newErrors[`quantity_${index}`] = "Miqdor 0 dan katta butun son bo'lishi kerak";
      } else if (Number(item.quantity) > item.maxQuantity) {
        newErrors[`quantity_${index}`] = `Maksimal miqdor: ${item.maxQuantity} dona`;
      }
      if (!item.price || isNaN(item.price) || Number(item.price) <= 0) {
        newErrors[`price_${index}`] = "Narx 0 dan katta bo'lishi kerak";
      }
    });
    if (!selectedBranch) {
      newErrors.branch = "Filial tanlanishi shart";
    }
    if (operationType === 'SALE') {
      if (!paymentType) newErrors.paymentType = "To'lov turi tanlanishi shart";
      const isCreditOrInstallment = ['CREDIT', 'INSTALLMENT'].includes(paymentType);
      if (isCreditOrInstallment) {
        if (!firstName.trim()) newErrors.firstName = "Ism kiritilishi shart";
        if (!lastName.trim()) newErrors.lastName = "Familiya kiritilishi shart";
        if (!phone.trim() || !/^\+?[1-9]\d{1,14}$/.test(phone)) newErrors.phone = "Telefon raqami to'g'ri kiritilishi shart";
        if (!jshshir.trim()) newErrors.jshshir = "JShShIR kiritilishi shart";
        if (!passportSeries.trim()) newErrors.passportSeries = "Passport seriyasi kiritilishi shart";
        if (!months || isNaN(months) || Number(months) <= 0 || !Number.isInteger(Number(months)) || Number(months) > 24) {
          newErrors.months = "Oylar soni 1 dan 24 gacha butun son bo'lishi kerak";
        }
        if (!interestRate || isNaN(interestRate) || Number(interestRate) < 0 || Number(interestRate) > 100) {
          newErrors.interestRate = "Foiz 0 dan 100 gacha bo'lishi kerak";
        }
        if (downPayment && (isNaN(downPayment) || Number(downPayment) < 0)) {
          newErrors.downPayment = "Boshlang'ich to'lov 0 dan katta bo'lishi kerak";
        }
      }
    } else if (operationType === 'TRANSFER') {
      if (!toBranch) newErrors.toBranch = "Qabul qiluvchi filial tanlanishi shart";
      else if (toBranch === selectedBranch) newErrors.toBranch = "Qabul qiluvchi filial boshqa bo'lishi kerak";
      selectedItems.forEach((item, index) => {
        if (item.quantity && item.maxQuantity && Number(item.quantity) > item.maxQuantity) {
          newErrors[`quantity_${index}`] = `Transfer uchun maksimal miqdor: ${item.maxQuantity} dona (mavjud qoldiq)`;
        }
      });
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateFields()) {
      setNotification({ message: "Barcha maydonlarni to'g'ri to'ldiring", type: 'error' });
      return;
    }
  
    if (operationType === 'TRANSFER') {
      const confirmMessage = `Haqiqatan ham ${branches.find(b => b.id === Number(selectedBranch))?.name} filialidan ${branches.find(b => b.id === Number(toBranch))?.name} filialiga ${selectedItems.map(item => `${item.name} (${formatQuantity(item.quantity)})`).join(', ')} ko'chirmoqchimisiz?`;
  
      if (!window.confirm(confirmMessage)) {
        return;
      }
    }
  
    setSubmitting(true);
    setNotification(null);
    try {
      const baseTotal = selectedItems.reduce((sum, item) => sum + Number(item.quantity) * Number(item.price), 0);
      let finalTotal = baseTotal;
      let customerData = undefined;
      let toBranchId = undefined;
  
      if (operationType === 'SALE') {
        const m = Number(months);
        const rate = Number(interestRate) / 100;
        const isCreditOrInstallment = ['CREDIT', 'INSTALLMENT'].includes(paymentType);
        if (isCreditOrInstallment) {
          finalTotal = baseTotal * (1 + rate);
          customerData = {
            fullName: `${firstName} ${lastName}`.trim(),
            phone,
            jshshir,
            passportSeries,
          };
        }
      } else if (operationType === 'TRANSFER') {
        toBranchId = Number(toBranch);
      }
  
      const payload = {
        type: operationType,
        status: 'PENDING',
        total: baseTotal,
        finalTotal,
        downPayment: ['CREDIT', 'INSTALLMENT'].includes(paymentType) ? Number(downPayment) || 0 : undefined,
        paymentType: operationType === 'SALE' ? paymentType : undefined,
        customer: customerData,
        fromBranchId: Number(selectedBranch),
        toBranchId,
        soldByUserId: parseInt(localStorage.getItem('userId')) || null,
        items: selectedItems.map((item) => ({
          productId: item.id,
          quantity: Number(item.quantity),
          price: Number(item.price),
          creditMonth: ['CREDIT', 'INSTALLMENT'].includes(paymentType) ? Number(months) : undefined,
          creditPercent: ['CREDIT', 'INSTALLMENT'].includes(paymentType) ? Number(interestRate) / 100 : undefined,
          monthlyPayment: ['CREDIT', 'INSTALLMENT'].includes(paymentType) ? 
            (Number(item.quantity) * Number(item.price) * (1 + Number(interestRate) / 100)) / Number(months) : undefined,
        })),
      };
  
      let response;
      if (operationType === 'TRANSFER') {
        response = await axiosWithAuth({
          method: 'post',
          url: `${API_URL}/transactions/transfer`,
          data: {
            fromBranchId: Number(selectedBranch),
            toBranchId: Number(toBranch),
            soldByUserId: parseInt(localStorage.getItem('userId')) || null,
            items: selectedItems.map((item) => ({
              productId: item.id,
              quantity: Number(item.quantity),
              price: Number(item.price),
            })),
          },
        });
  
        const destinationBranchName = branches.find(b => b.id === Number(toBranch))?.name;
        const sourceBranchName = branches.find(b => b.id === Number(selectedBranch))?.name;
  
        setNotification({ 
          message: `✅ O'tkazma muvaffaqiyatli amalga oshirildi! ${sourceBranchName} filialidan ${destinationBranchName} filialiga ko'chirildi: ${selectedItems.map(item => `${item.name} (${formatQuantity(item.quantity)})`).join(', ')}`, 
          type: 'success' 
        });
      } else {
        response = await axiosWithAuth({
          method: 'post',
          url: `${API_URL}/transactions`,
          data: payload,
        });
  
        const paymentDetails = {
          paymentType,
          months: ['CREDIT', 'INSTALLMENT'].includes(paymentType) ? months : '',
          interestRate: ['CREDIT', 'INSTALLMENT'].includes(paymentType) ? interestRate : '',
          downPayment: ['CREDIT', 'INSTALLMENT'].includes(paymentType) ? downPayment : '',
        };
        const customerDetails = ['CREDIT', 'INSTALLMENT'].includes(paymentType) ? {
          fullName: `${firstName} ${lastName}`.trim(),
          phone,
          jshshir,
          passportSeries,
        } : { fullName: 'Noma\'lum', phone: 'Noma\'lum', jshshir: 'Noma\'lum', passportSeries: 'Noma\'lum' };
        const branchName = branches.find((b) => b.id === Number(selectedBranch))?.name || 'Noma\'lum';
  
        setReceiptData({
          items: selectedItems,
          branchName,
          paymentDetails,
          customerDetails,
          date: new Date(),
          total: baseTotal,
          finalTotal,
        });
  
        setNotification({ message: 'Amal muvaffaqiyatli amalga oshirildi', type: 'success' });
        setShowReceiptModal(true);
      }
  
      closeModal();
      await loadData();
    } catch (err) {
      let message = 'Tranzaksiya yaratishda xatolik';
      if (err.response?.data?.message) {
        message = err.response.data.message;
      } else if (err.message) {
        message = err.message;
      }
      if (operationType === 'TRANSFER') {
        if (err.response?.status === 400) {
          message = "Transfer ma'lumotlari noto'g'ri. Iltimos tekshiring.";
        } else if (err.response?.status === 404) {
          message = "Filial yoki mahsulot topilmadi.";
        } else if (err.response?.status === 409) {
          message = "Mahsulot miqdori yetarli emas transfer uchun.";
        }
      }
      setNotification({ message, type: 'error' });
      console.error('Submit error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredModalProducts = modalProducts
    .filter((p) => p.quantity > 0)
    .filter((p) => {
      const q = (modalSearch || '').toLowerCase();
      if (!q) return true;
      return (
        (p.name || '').toLowerCase().includes(q) ||
        (p.barcode || '').toLowerCase().includes(q) ||
        (p.model || '').toLowerCase().includes(q)
      );
    })
    .slice(0, 20);

  // Simple, minimal receipt printer aligned with Receipt.jsx structure
  const buildTransactionFromReceiptData = () => {
    if (!receiptData) return null;
    return {
      id: receiptData.id || 'N/A',
      createdAt: receiptData.date || new Date(),
      customer: {
        fullName: receiptData.customerDetails?.fullName || "Noma'lum",
        firstName: receiptData.customerDetails?.fullName?.split(' ')[0] || '',
        lastName: receiptData.customerDetails?.fullName?.split(' ')[1] || '',
        phone: receiptData.customerDetails?.phone || "Noma'lum",
        jshshir: receiptData.customerDetails?.jshshir || "Noma'lum",
        passportSeries: receiptData.customerDetails?.passportSeries || "Noma'lum",
      },
      branch: { name: receiptData.branchName || "Noma'lum" },
      paymentType: receiptData.paymentDetails?.paymentType || "Noma'lum",
      total: receiptData.total || 0,
      finalTotal: receiptData.finalTotal || receiptData.total || 0,
      paid: receiptData.paymentDetails?.downPayment || 0,
      remaining:
        (receiptData.finalTotal || receiptData.total || 0) -
        (receiptData.paymentDetails?.downPayment || 0),
      interestRate: receiptData.paymentDetails?.interestRate || 0,
      months: receiptData.paymentDetails?.months || 0,
      monthlyPayment: receiptData.paymentDetails?.monthlyPayment || 0,
      items: receiptData.items.map((item) => ({
        name: item.name,
        quantity: Number(item.quantity),
        price: Number(item.price),
      })),
      seller: {
        firstName: currentUser?.firstName || "Noma'lum",
        lastName: currentUser?.lastName || '',
      },
    };
  };

  const simplePrintReceipt = (transaction) => {
    if (!transaction) return;

    const formatAmount = (amount) => {
      const num = Math.floor(Number(amount) || 0);
      return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    };

    const formatDateLocal = (dateString) => {
      try {
        const date = new Date(dateString);
        return date.toLocaleString('uz-UZ', {
          year: 'numeric',
          month: 'numeric',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      } catch {
        return "Noma'lum";
      }
    };

    const getPaymentTypeText = (paymentType) => {
      switch (paymentType) {
        case 'CASH': return 'Нақд';
        case 'CARD': return 'Карта';
        case 'CREDIT': return 'Кредит';
        case 'INSTALLMENT': return 'Бўлиб тўлаш';
        default: return "Noma'lum";
      }
    };

    const itemsRows = transaction.items.map((item, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${item.name}</td>
        <td style="text-align:right">${formatAmount(item.price)}</td>
        <td style="text-align:center">${item.quantity}</td>
        <td style="text-align:right">${formatAmount(Number(item.quantity) * Number(item.price))}</td>
      </tr>
    `).join('');

    const isCredit = transaction.paymentType === 'CREDIT' || transaction.paymentType === 'INSTALLMENT';

    const html = `
    <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Aminov Savdo Tizimi</title>
            <style>
                @page { 
                  margin: 0; 
                  size: 80mm auto; 
                }
                body { 
                  font-family: 'Courier New', monospace; 
                  margin: 0; 
                  padding: 2%; 
                  width: 96%; 
                  font-size: 12px; 
                  line-height: 1.2;
                  color: #000; /* Make all text black by default */
                }
                .header { 
                  text-align: center; 
                  margin-bottom: 5%; 
                  border-bottom: 1px dashed #000;
                  padding-bottom: 3%;
                }
                .header h2 { 
                  margin: 0; 
                  font-size: 16px; 
                  font-weight: bold;
                  color: #000; /* Ensure header text is black */
                }
                .header p { 
                  margin: 2% 0 0 0; 
                  font-size: 11px;
                  color: #000; /* Ensure header paragraph text is black */
                }
                .info { 
                  margin-bottom: 4%; 
                }
              
                .products { 
                  margin: 4% 0; 
                  border-top: 1px dashed #000;
                  padding-top: 3%;
                }
                .products h4 { 
                  margin: 0 0 3% 0; 
                  font-size: 12px; 
                  font-weight: bold;
                  text-align: center;
                  color: #000; /* Ensure products header is black */
                }
                .product-row { 
                  display: flex; 
                  justify-content: space-between; 
                  margin: 1% 0; 
                  font-size: 10px;
                  border-bottom: 1px dotted #ccc;
                  padding-bottom: 1%;
                  color: #000; /* Ensure product row text is black */
                }
                .total { 
                  border-top: 1px dashed #000; 
                  padding-top: 3%; 
                  margin-top: 4%; 
                }
                .total-row { 
                  display: flex; 
                  justify-content: space-between; 
                  margin: 2% 0; 
                  font-weight: bold; 
                  font-size: 12px;
                  color: #000; /* Ensure total row text is black */
                }
                .footer { 
                  text-align: center; 
                  margin-top: 5%; 
                  padding-top: 3%;
                  border-top: 1px dashed #000;
                  font-size: 10px;
                  color: #000; /* Ensure footer text is black */
                }
                @media print { 
                  body { margin: 0; padding: 1%; width: 98%; color: #000; } /* Ensure print mode text is black */
                }
                @media print and (max-width: 56mm) {
                  body { font-size: 10px; padding: 1%; width: 98%; color: #000; } /* Ensure small print mode text is black */
                  .header h2 { font-size: 14px; color: #000; }
                 
                  .total-row { font-size: 11px; color: #000; }
                }
              </style>
        </head>
        <body>
          <div class="header">
            <div>
                <h2>Aminov Savdo Tizimi</h2>
                <p class="total-row">${formatDate(new Date())}</p>
            </div>
          </div>
               
                <div class="total-row">
                  <span>Mijoz:</span>
                  <span>${transaction.customer.fullName || `${transaction.customer.firstName} ${transaction.customer.lastName}`}</span>
                </div>
          <div class="total-row">
                  <span>Tel:</span>
                  <span>${transaction.customer.phone}</span>
                </div>
                ${transaction.customer.passportSeries ? `
                <div class="total-row">
                  <span>Passport:</span>
                  <span>${transaction.customer.passportSeries}</span>
                </div>
                ` : ''}
                ${transaction.customer.jshshir ? `
                <div class="total-row">
                  <span>JSHSHIR:</span>
                  <span>${transaction.customer.jshshir}</span>
                </div>
                ` : ''}
                <div class="total-row">
                  <span>Filial:</span>
                  <span>${transaction.branch?.name}</span>
                </div>
                <div class="total-row">
                  <span>To'lov:</span>
                  <span>${transaction.paymentType === 'CASH' ? 'Naqd' :
                    transaction.paymentType === 'CARD' ? 'Karta' :
                    transaction.paymentType === 'CREDIT' ? 'Kredit' :
                transaction.paymentType === 'INSTALLMENT' ? "Bo'lib to'lash" : transaction.paymentType}</span>
                </div>
                <div class="total-row">
                  <span>Yetkazib berish:</span>
                  <span>${transaction.deliveryType === 'PICKUP' ? 'Olib ketish' :
                    transaction.deliveryType === 'DELIVERY' ? 'Yetkazib berish' :
                    transaction.deliveryType}</span>
                </div>
                ${transaction.deliveryType === 'DELIVERY' && transaction.deliveryAddress ? `
                <div class="total-row">
                  <span>Manzil:</span>
                  <span>${transaction.deliveryAddress}</span>
                </div>
                ` : ''}
              </div>
              <div class="products">
                <h4>MAHSULOTLAR</h4>
                ${transaction.items.map((item, index) => `
                  <div class="total-row">
                    <span>${item.name} x${item.quantity}</span>
                    <span>${formatAmount(Number(item.quantity) * Number(item.price))}</span>
                  </div>
                `).join('')}
              </div>

              <div class="total">
                <div class="total-row">
                  <span>JAMI:</span>
                  <span>${formatAmount(transaction.finalTotal)}</span>
                </div>
                ${['CREDIT', 'INSTALLMENT'].includes(transaction.paymentType) ? `
                  <div class="info-row">
                    <span>To'langan:</span>
                    <span>${formatAmount(transaction.paid)}</span>
                  </div>
                  <div class="info-row">
                    <span>Qolgan:</span>
                    <span>${formatAmount(transaction.remaining)}</span>
                  </div>
                  <div class="info-row">
                    <span>Oylik:</span>
                    <span>${formatAmount(transaction.monthlyPayment)}</span>
                  </div>
                ` : ''}
              </div>
              
              <div class="total-row">
                <p>Tashrifingiz uchun rahmat!</p>
              </div>
              <div class="total">
               </div>
            </body>
            </html>`;

    const win = window.open('', '_blank');
    printWindowRef.current = win;
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
    win.close();
    setShowReceiptModal(false);

    win.onafterprint = () => {
       win.close();
    };
  };

  const closeReceiptModal = () => {
    try {
      if (printWindowRef.current && !printWindowRef.current.closed) {
        printWindowRef.current.close();
        win.onafterprint = () => {
          win.close();
       };
      }
    } catch {}
    printWindowRef.current = null;
    setShowReceiptModal(false);
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Чиқим</h1>

      {notification && (
        <div
          className={`p-4 rounded-lg flex items-center gap-3 mb-4 ${
            notification.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' :
            notification.type === 'warning' ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' :
            'bg-green-50 text-green-700 border border-green-200'
          }`}
        >
          <span>{notification.message}</span>
          <button className="text-sm underline hover:no-underline transition-all" onClick={() => setNotification(null)}>
            Ёпиш
          </button>
        </div>
      )}
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Tovar qidirish..."
        className="w-full p-2 border rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
      />
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
          <span className="ml-2">Юкланмоқда...</span>
        </div>
      ) : (
        <>
          <h2 className="text-xl font-bold mb-2 text-gray-800">Маҳсулотлар қолдиғи</h2>

          <div className="flex gap-4 mb-4">
            <button
              onClick={openModal}
              className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 disabled:bg-gray-400 transition-all duration-200"
              disabled={submitting || !selectedBranchId}
            >
              Кўп маҳсулот чиқими
            </button>
            <button
              onClick={loadData}
              disabled={loading}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:bg-gray-400 transition-all duration-200"
            >
              {loading ? 'Юкланмоқда...' : 'Янгилаш'}
            </button>
            <button
              onClick={() => {
                setShowTransferHistory(true);
                loadTransferHistory();
              }}
              disabled={!selectedBranchId}
              className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 disabled:bg-gray-400 transition-all duration-200 relative"
            >
              Ўтказмалар тарихи
              {pendingTransfers.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center">
                  {pendingTransfers.length}
                </span>
              )}
            </button>
          </div>
          <div className="overflow-x-auto bg-white rounded-lg shadow">
            <table className="w-full border">
              <thead>
                <tr className="bg-gray-100 text-left">
                  <th className="p-3">ID</th>
                  <th className="p-3">Номи</th>
                  <th className="p-3">Филиал</th>
                  <th className="p-3">Нарх</th>
                  <th className="p-3">Миқдор</th>
                  <th className="p-3">Амаллар</th>
                </tr>
              </thead>
              <tbody>
                {products.length > 0 ? (
                  products.map((product) => (
                    <tr key={product.id} className="border-t hover:bg-gray-50">
                      <td className="p-3">#{product.id}</td>
                      <td className="p-3">{product.name}</td>
                      <td className="p-3">{product.branch?.name || 'Noma\'lum'}</td>
                      <td className="p-3">{formatCurrency(product.price)}</td>
                      <td className="p-3">{formatQuantity(product.quantity)}</td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => openSaleModal(product)}
                            disabled={product.quantity <= 0}
                            className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600 disabled:bg-gray-400 transition-all duration-200"
                          >
                            Мижозга сотиш
                          </button>
                          <button
                            onClick={() => openTransferModal(product)}
                            disabled={product.quantity <= 0}
                            className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600 disabled:bg-gray-400 transition-all duration-200"
                          >
                            Филиалга ўтказиш
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="p-3 text-center">Tovarlar topilmadi</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {showSaleModal && selectedProduct && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[80vh] overflow-y-auto shadow-xl">
                <div className="flex justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold">Мижозга сотиш</h3>
                    <p className="text-sm text-gray-600">{selectedProduct.name}</p>
                    <p className="text-sm text-gray-600">Мавжуд: {formatQuantity(selectedProduct.quantity)}</p>
                  </div>
                  <button onClick={() => setShowSaleModal(false)} className="text-gray-600 hover:text-gray-800 transition-all">X</button>
                </div>
                
                <form onSubmit={handleIndividualSale} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Миқдор</label>
                    <input
                      type="number"
                      value={saleQuantity}
                      onChange={(e) => setSaleQuantity(e.target.value)}
                      className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm ${errors.saleQuantity ? 'border-red-500' : ''}`}
                      min="1"
                      max={selectedProduct.quantity}
                      step="1"
                    />
                    {errors.saleQuantity && <span className="text-red-500 text-xs">{errors.saleQuantity}</span>}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Тўлов тури</label>
                    <select
                      value={paymentType}
                      onChange={(e) => setPaymentType(e.target.value)}
                      className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm ${errors.paymentType ? 'border-red-500' : ''}`}
                    >
                      <option value="">Танланг</option>
                      <option value="CASH">Нақд</option>
                      <option value="CARD">Карта</option>
                      <option value="CREDIT">Кредит</option>
                      <option value="INSTALLMENT">Бўлиб тўлаш</option>
                    </select>
                    {errors.paymentType && <span className="text-red-500 text-xs">{errors.paymentType}</span>}
                  </div>
                  
                  {['CREDIT', 'INSTALLMENT'].includes(paymentType) && (
                    <div className="space-y-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Мижоз исми</label>
                        <input
                          type="text"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm ${errors.firstName ? 'border-red-500' : ''}`}
                        />
                        {errors.firstName && <span className="text-red-500 text-xs">{errors.firstName}</span>}
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Мижоз фамилияси</label>
                        <input
                          type="text"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm ${errors.lastName ? 'border-red-500' : ''}`}
                        />
                        {errors.lastName && <span className="text-red-500 text-xs">{errors.lastName}</span>}
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Телефон</label>
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm ${errors.phone ? 'border-red-500' : ''}`}
                        />
                        {errors.phone && <span className="text-red-500 text-xs">{errors.phone}</span>}
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">ЖШШИР</label>
                        <input
                          type="text"
                          value={jshshir}
                          onChange={(e) => setJshshir(e.target.value)}
                          className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm ${errors.jshshir ? 'border-red-500' : ''}`}
                        />
                        {errors.jshshir && <span className="text-red-500 text-xs">{errors.jshshir}</span>}
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Паспорт серияси</label>
                        <input
                          type="text"
                          value={passportSeries}
                          onChange={(e) => setPassportSeries(e.target.value)}
                          className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm ${errors.passportSeries ? 'border-red-500' : ''}`}
                        />
                        {errors.passportSeries && <span className="text-red-500 text-xs">{errors.passportSeries}</span>}
                      </div>
                    </div>
                  )}
                  
                  {['CREDIT', 'INSTALLMENT'].includes(paymentType) && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Ойлар сони</label>
                        <input
                          type="number"
                          value={months}
                          onChange={(e) => setMonths(e.target.value)}
                          className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm ${errors.months ? 'border-red-500' : ''}`}
                          min="1"
                          max="24"
                          step="1"
                        />
                        {errors.months && <span className="text-red-500 text-xs">{errors.months}</span>}
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Фоиз (%)</label>
                        <input
                          type="number"
                          value={interestRate}
                          onChange={(e) => setInterestRate(e.target.value)}
                          className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm ${errors.interestRate ? 'border-red-500' : ''}`}
                          min="0"
                          max="100"
                          step="0.01"
                        />
                        {errors.interestRate && <span className="text-red-500 text-xs">{errors.interestRate}</span>}
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Бошланғич тўлов</label>
                        <input
                          type="number"
                          value={downPayment}
                          onChange={(e) => setDownPayment(e.target.value)}
                          className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm ${errors.downPayment ? 'border-red-500' : ''}`}
                          min="0"
                          step="0.01"
                        />
                        {errors.downPayment && <span className="text-red-500 text-xs">{errors.downPayment}</span>}
                      </div>
                    </>
                  )}
                  
                  <div className="flex gap-2 pt-4">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 bg-green-500 text-white p-2 rounded-lg disabled:bg-gray-400 hover:bg-green-600 transition-all duration-200 shadow-sm"
                    >
                      {submitting ? 'Юкланмоқда...' : 'Сотиш'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowSaleModal(false)}
                      className="flex-1 bg-gray-200 p-2 rounded-lg hover:bg-gray-300 transition-all duration-200 shadow-sm"
                    >
                      Бекор
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {showTransferModal && selectedProduct && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[80vh] overflow-y-auto shadow-xl">
                <div className="flex justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold">Филиалга ўтказиш</h3>
                    <p className="text-sm text-gray-600">{selectedProduct.name}</p>
                    <p className="text-sm text-gray-600">Мавжуд: {formatQuantity(selectedProduct.quantity)}</p>
                  </div>
                  <button onClick={() => setShowTransferModal(false)} className="text-gray-600 hover:text-gray-800 transition-all">X</button>
                </div>
                
                <form onSubmit={handleIndividualTransfer} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Миқдор</label>
                    <input
                      type="number"
                      value={transferQuantity}
                      onChange={(e) => setTransferQuantity(e.target.value)}
                      className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm ${errors.transferQuantity ? 'border-red-500' : ''}`}
                      min="1"
                      max={selectedProduct.quantity}
                      step="1"
                    />
                    {errors.transferQuantity && <span className="text-red-500 text-xs">{errors.transferQuantity}</span>}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Қабул қилувчи филиал</label>
                    <select
                      value={toBranch}
                      onChange={(e) => setToBranch(e.target.value)}
                      className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm ${errors.toBranch ? 'border-red-500' : ''}`}
                    >
                      <option value="">Танланг</option>
                      {branches.filter((b) => b.id !== Number(selectedBranchId)).map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                    {errors.toBranch && <span className="text-red-500 text-xs">{errors.toBranch}</span>}
                  </div>
                  
                  <div className="flex gap-2 pt-4">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 bg-blue-500 text-white p-2 rounded-lg disabled:bg-gray-400 hover:bg-blue-600 transition-all duration-200 shadow-sm"
                    >
                      {submitting ? 'Юкланмоқда...' : 'Ўтказиш'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowTransferModal(false)}
                      className="flex-1 bg-gray-200 p-2 rounded-lg hover:bg-gray-300 transition-all duration-200 shadow-sm"
                    >
                      Бекор
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

{showReceiptModal && receiptData && receiptData.items && receiptData.items.length > 0 && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto shadow-xl">
    
      <div className="space-y-4">
        <Receipt
          transaction={{
            id: receiptData.id || 'N/A',
            createdAt: receiptData.date || new Date(),
            customer: {
              fullName: receiptData.customerDetails?.fullName || 'Noma\'lum',
              firstName: receiptData.customerDetails?.fullName?.split(' ')[0] || '',
              lastName: receiptData.customerDetails?.fullName?.split(' ')[1] || '',
              phone: receiptData.customerDetails?.phone || 'Noma\'lum',
              jshshir: receiptData.customerDetails?.jshshir || 'Noma\'lum',
              passportSeries: receiptData.customerDetails?.passportSeries || 'Noma\'lum',
            },
            branch: {
              name: receiptData.branchName || 'Noma\'lum',
            },
            paymentType: receiptData.paymentDetails?.paymentType || 'Noma\'lum',
            total: receiptData.total || 0,
            finalTotal: receiptData.finalTotal || receiptData.total || 0,
            paid: receiptData.paymentDetails?.downPayment || 0,
            remaining: (receiptData.finalTotal || receiptData.total || 0) - (receiptData.paymentDetails?.downPayment || 0),
            interestRate: receiptData.paymentDetails?.interestRate || 0,
            months: receiptData.paymentDetails?.months || 0,
            monthlyPayment: receiptData.paymentDetails?.monthlyPayment || 0,
            items: receiptData.items.map(item => ({
              name: item.name,
              quantity: Number(item.quantity),
              price: Number(item.price),
            })),
            seller: {
              firstName: currentUser?.firstName || 'Noma\'lum',
              lastName: currentUser?.lastName || '',
            },
          }}
          onClose={closeReceiptModal}
          onPrint={() => simplePrintReceipt(buildTransactionFromReceiptData())}
        />

      </div>
    </div>
  </div>
)}

          {showModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-50mm max-w-lg max-h-[80vh] overflow-y-auto shadow-xl">
                <div className="flex justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold">Кўп маҳсулот чиқими</h3>
                    {currentUser && (
                      <p className="text-sm text-gray-600">
                        Sotuvchi: {currentUser.firstName || currentUser.lastName || 'Noma\'lum'} 
                        ({currentUser.role})
                      </p>
                    )}
                  </div>
                  <button onClick={closeModal} className="text-gray-600 hover:text-gray-800 transition-all">X</button>
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    <tr>
                      <td className="py-2">Чиқим тури</td>
                      <td>
                        <select
                          value={operationType}
                          onChange={(e) => setOperationType(e.target.value)}
                          className="w-full p-1 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                        >
                          <option value="SALE">Мижозга сотиш</option>
                          <option value="TRANSFER">Филиалга ўтказиш</option>
                        </select>
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2">Чиқим филиали</td>
                      <td>
                        <select
                          value={selectedBranch}
                          onChange={(e) => setSelectedBranch(e.target.value)}
                          className={`w-full p-1 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm ${errors.branch ? 'border-red-500' : ''}`}
                        >
                          <option value="">Танланг</option>
                          {branches.map((b) => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                          ))}
                        </select>
                        {errors.branch && <span className="text-red-500 text-xs">{errors.branch}</span>}
                      </td>
                    </tr>
                    {operationType === 'TRANSFER' && (
                      <tr>
                        <td className="py-2">Қабул филиали</td>
                        <td>
                          <select
                            value={toBranch}
                            onChange={(e) => setToBranch(e.target.value)}
                            className={`w-full p-1 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm ${errors.toBranch ? 'border-red-500' : ''}`}
                          >
                            <option value="">Танланг</option>
                            {branches.filter((b) => b.id !== Number(selectedBranch)).map((b) => (
                              <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                          </select>
                          {errors.toBranch && <span className="text-red-500 text-xs">{errors.toBranch}</span>}
                        </td>
                      </tr>
                    )}
                    {operationType === 'SALE' && (
                      <>
                        <tr>
                          <td className="py-2">Тўлов тури</td>
                          <td>
                            <select
                              value={paymentType}
                              onChange={(e) => setPaymentType(e.target.value)}
                              className={`w-full p-1 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm ${errors.paymentType ? 'border-red-500' : ''}`}
                            >
                              <option value="">Танланг</option>
                              <option value="CASH">Нақд</option>
                              <option value="CARD">Карта</option>
                              <option value="CREDIT">Кредит</option>
                              <option value="INSTALLMENT">Бўлиб тўлаш</option>

                              </select>
                              {errors.paymentType && <span className="text-red-500 text-xs">{errors.paymentType}</span>}
                            </td>
                          </tr>
                          {['CREDIT', 'INSTALLMENT'].includes(paymentType) && (
                            <>
                              <tr>
                                <td className="py-2">Мижоз исми</td>
                                <td>
                                  <input
                                    type="text"
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                    className={`w-full p-1 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm ${errors.firstName ? 'border-red-500' : ''}`}
                                  />
                                  {errors.firstName && <span className="text-red-500 text-xs">{errors.firstName}</span>}
                                </td>
                              </tr>
                              <tr>
                                <td className="py-2">Мижоз фамилияси</td>
                                <td>
                                  <input
                                    type="text"
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                    className={`w-full p-1 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm ${errors.lastName ? 'border-red-500' : ''}`}
                                  />
                                  {errors.lastName && <span className="text-red-500 text-xs">{errors.lastName}</span>}
                                </td>
                              </tr>
                              <tr>
                                <td className="py-2">Телефон</td>
                                <td>
                                  <input
                                    type="tel"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    className={`w-full p-1 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm ${errors.phone ? 'border-red-500' : ''}`}
                                  />
                                  {errors.phone && <span className="text-red-500 text-xs">{errors.phone}</span>}
                                </td>
                              </tr>
                              <tr>
                                <td className="py-2">ЖШШИР</td>
                                <td>
                                  <input
                                    type="text"
                                    value={jshshir}
                                    onChange={(e) => setJshshir(e.target.value)}
                                    className={`w-full p-1 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm ${errors.jshshir ? 'border-red-500' : ''}`}
                                  />
                                  {errors.jshshir && <span className="text-red-500 text-xs">{errors.jshshir}</span>}
                                </td>
                              </tr>
                              <tr>
                                <td className="py-2">Паспорт серияси</td>
                                <td>
                                  <input
                                    type="text"
                                    value={passportSeries}
                                    onChange={(e) => setPassportSeries(e.target.value)}
                                    className={`w-full p-1 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm ${errors.passportSeries ? 'border-red-500' : ''}`}
                                  />
                                  {errors.passportSeries && <span className="text-red-500 text-xs">{errors.passportSeries}</span>}
                                </td>
                              </tr>
                              <tr>
                                <td className="py-2">Ойлар сони</td>
                                <td>
                                  <input
                                    type="number"
                                    value={months}
                                    onChange={(e) => setMonths(e.target.value)}
                                    className={`w-full p-1 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm ${errors.months ? 'border-red-500' : ''}`}
                                    min="1"
                                    max="24"
                                    step="1"
                                  />
                                  {errors.months && <span className="text-red-500 text-xs">{errors.months}</span>}
                                </td>
                              </tr>
                              <tr>
                                <td className="py-2">Фоиз (%)</td>
                                <td>
                                  <input
                                    type="number"
                                    value={interestRate}
                                    onChange={(e) => setInterestRate(e.target.value)}
                                    className={`w-full p-1 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm ${errors.interestRate ? 'border-red-500' : ''}`}
                                    min="0"
                                    max="100"
                                    step="0.01"
                                  />
                                  {errors.interestRate && <span className="text-red-500 text-xs">{errors.interestRate}</span>}
                                </td>
                              </tr>
                              <tr>
                                <td className="py-2">Бошланғич тўлов</td>
                                <td>
                                  <input
                                    type="number"
                                    value={downPayment}
                                    onChange={(e) => setDownPayment(e.target.value)}
                                    className={`w-full p-1 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm ${errors.downPayment ? 'border-red-500' : ''}`}
                                    min="0"
                                    step="0.01"
                                  />
                                  {errors.downPayment && <span className="text-red-500 text-xs">{errors.downPayment}</span>}
                                </td>
                              </tr>
                            </>
                          )}
                        </>
                      )}
                    </tbody>
                  </table>
                  <div className="mt-4">
                    <h4 className="text-md font-bold mb-2">Маҳсулот танлаш</h4>
                    <div className="relative">
                      <input
                        type="text"
                        value={modalSearch}
                        onChange={(e) => {
                          setModalSearch(e.target.value);
                          setShowSuggestions(true);
                        }}
                        onFocus={() => setShowSuggestions(true)}
                        placeholder="Маҳсулот қидириш..."
                        className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                      />
                      {showSuggestions && filteredModalProducts.length > 0 && (
                        <ul className="absolute z-10 w-full bg-white border rounded-lg mt-1 max-h-60 overflow-y-auto shadow-lg">
                          {filteredModalProducts.map((product) => (
                            <li
                              key={product.id}
                              onClick={() => {
                                setSelectedProductId(product.id.toString());
                                setModalSearch(product.name);
                                setShowSuggestions(false);
                              }}
                              className="p-2 hover:bg-gray-100 cursor-pointer"
                            >
                              {product.name} (Мавжуд: {formatQuantity(product.quantity)})
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <input
                        type="number"
                        value={tempQuantity}
                        onChange={(e) => setTempQuantity(e.target.value)}
                        placeholder="Миқдор"
                        className="w-1/3 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                        min="1"
                        step="1"
                      />
                      <input
                        type="number"
                        value={tempPrice}
                        onChange={(e) => setTempPrice(e.target.value)}
                        placeholder="Нарх"
                        className="w-1/3 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                        min="0"
                        step="0.01"
                      />
                      <button
                        onClick={addItem}
                        className="w-1/3 bg-blue-500 text-white p-2 rounded-lg hover:bg-blue-600 transition-all duration-200 shadow-sm"
                      >
                        Қўшиш
                      </button>
                    </div>
                  </div>
                  {selectedItems.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-md font-bold mb-2">Танланган маҳсулотлар</h4>
                      <table className="w-full border text-sm">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="p-2">Номи</th>
                            <th className="p-2">Миқдор</th>
                            <th className="p-2">Нарх</th>
                            <th className="p-2">Амаллар</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedItems.map((item, index) => (
                            <tr key={index} className="border-t">
                              <td className="p-2">{item.name}</td>
                              <td className="p-2">
                                <input
                                  type="number"
                                  value={item.quantity}
                                  onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                                  className={`w-full p-1 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm ${errors[`quantity_${index}`] ? 'border-red-500' : ''}`}
                                  min="1"
                                  step="1"
                                />
                                {errors[`quantity_${index}`] && (
                                  <span className="text-red-500 text-xs">{errors[`quantity_${index}`]}</span>
                                )}
                              </td>
                              <td className="p-2">
                                <input
                                  type="number"
                                  value={item.price}
                                  onChange={(e) => updateItem(index, 'price', e.target.value)}
                                  className={`w-full p-1 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm ${errors[`price_${index}`] ? 'border-red-500' : ''}`}
                                  min="0"
                                  step="0.01"
                                />
                                {errors[`price_${index}`] && (
                                  <span className="text-red-500 text-xs">{errors[`price_${index}`]}</span>
                                )}
                              </td>
                              <td className="p-2">
                                <button
                                  onClick={() => removeItem(index)}
                                  className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 transition-all duration-200"
                                >
                                  Ўчириш
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={handleSubmit}
                      disabled={submitting}
                      className="flex-1 bg-green-500 text-white p-2 rounded-lg disabled:bg-gray-400 hover:bg-green-600 transition-all duration-200 shadow-sm"
                    >
                      {submitting ? 'Юкланмоқда...' : operationType === 'SALE' ? 'Сотиш' : 'Ўтказиш'}
                    </button>
                    <button
                      onClick={closeModal}
                      className="flex-1 bg-gray-200 p-2 rounded-lg hover:bg-gray-300 transition-all duration-200 shadow-sm"
                    >
                      Bekor
                    </button>
                  </div>
                </div>
              </div>
            )}
  
            {showTransferHistory && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[80vh] overflow-y-auto shadow-xl">
                  <div className="flex justify-between mb-4">
                    <h3 className="text-lg font-bold">Ўтказмалар тарихи</h3>
                    <button onClick={() => setShowTransferHistory(false)} className="text-gray-600 hover:text-gray-800 transition-all">X</button>
                  </div>
                  <div className="space-y-4">
                    {pendingTransfers.length > 0 && (
                      <div>
                        <h4 className="text-md font-bold mb-2">Kutilayotgan O'tkazmalar</h4>
                        <table className="w-full border text-sm">
                          <thead>
                            <tr className="bg-gray-100">
                              <th className="p-2">ID</th>
                              <th className="p-2">Mahsulot</th>
                              <th className="p-2">Miqdor</th>
                              <th className="p-2">Narx</th>
                              <th className="p-2">Jo'natuvchi Filial</th>
                              <th className="p-2">Qabul Qiluvchi Filial</th>
                              <th className="p-2">Sana</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pendingTransfers.map((transfer) => (
                              <tr key={transfer.id} className="border-t">
                                <td className="p-2">{transfer.id}</td>
                                <td className="p-2">{transfer.items?.[0]?.product?.name || 'Noma\'lum'}</td>
                                <td className="p-2">{formatQuantity(transfer.items?.[0]?.quantity)}</td>
                                <td className="p-2">{formatCurrency(transfer.items?.[0]?.price)}</td>
                                <td className="p-2">{branches.find(b => b.id === transfer.fromBranchId)?.name || 'Noma\'lum'}</td>
                                <td className="p-2">{branches.find(b => b.id === transfer.toBranchId)?.name || 'Noma\'lum'}</td>
                                <td className="p-2">{formatDate(transfer.createdAt)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <h4 className="text-md font-bold mb-2">Barcha O'tkazmalar</h4>
                    <table className="w-full border text-sm">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="p-2">ID</th>
                          <th className="p-2">Mahsulot</th>
                          <th className="p-2">Miqdor</th>
                          <th className="p-2">Narx</th>
                          <th className="p-2">Jo'natuvchi Filial</th>
                          <th className="p-2">Qabul Qiluvchi Filial</th>
                          <th className="p-2">Sana</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transferHistory.length > 0 ? (
                          transferHistory.map((transfer) => (
                            <tr key={transfer.id} className="border-t">
                              <td className="p-2">{transfer.id}</td>
                              <td className="p-2">{transfer.items?.[0]?.product?.name || 'Noma\'lum'}</td>
                              <td className="p-2">{formatQuantity(transfer.items?.[0]?.quantity)}</td>
                              <td className="p-2">{formatCurrency(transfer.items?.[0]?.price)}</td>
                              <td className="p-2">{branches.find(b => b.id === transfer.fromBranchId)?.name || 'Noma\'lum'}</td>
                              <td className="p-2">{branches.find(b => b.id === transfer.toBranchId)?.name || 'Noma\'lum'}</td>
                              <td className="p-2">{formatDate(transfer.createdAt)}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="7" className="p-2 text-center">O'tkazmalar topilmadi</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-4">
                    <button
                      onClick={() => setShowTransferHistory(false)}
                      className="w-full bg-gray-200 p-2 rounded-lg hover:bg-gray-300 transition-all duration-200 shadow-sm"
                    >
                      Yopish
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
  
  export default Chiqim;