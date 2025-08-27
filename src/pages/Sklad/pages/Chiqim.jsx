import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Receipt from '../../KassaUser/Receipt/Receipt';

const Chiqim = () => {
  const [products, setProducts] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [selectedItems, setSelectedItems] = useState([]);
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
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [exchangeRate, setExchangeRate] = useState(12500);
  const [showCartModal, setShowCartModal] = useState(false);
  const [isOmbor, setIsOmbor] = useState(false);
  const printWindowRef = useRef(null);

  const navigate = useNavigate();
  const API_URL = 'https://suddocs.uz';

  const formatCurrency = (amount) =>
    amount != null && Number.isFinite(Number(amount))
      ? new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 2,
        }).format(Number(amount))
      : '$0.00';

  const formatCurrencySom = (amount) => {
    if (amount != null && Number.isFinite(Number(amount))) {
      const amountInSom = Number(amount) * exchangeRate;
      return new Intl.NumberFormat('uz-UZ').format(amountInSom) + " so'm";
    }
    return "0 so'm";
  };

  const fetchExchangeRate = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (token) {
        const response = await axios.get(`${API_URL}/currency-exchange-rates`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.data && Array.isArray(response.data) && response.data.length > 0) {
          const firstExchangeRate = response.data[0];
          if (firstExchangeRate && firstExchangeRate.rate) {
            setExchangeRate(firstExchangeRate.rate);
          }
        } else {
          console.warn('No exchange rates found in response');
        }
      }
    } catch (error) {
      console.error('Failed to fetch exchange rate:', error);
    }
  };

  const formatQuantity = (qty) =>
    qty != null && Number.isFinite(Number(qty))
      ? new Intl.NumberFormat('uz-UZ').format(Number(qty)) + ' дона'
      : '0 дона';

  const formatDate = (date) =>
    date ? new Date(date).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' }) : 'Номаълум';

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
    setSelectedItems([]); // Clear cart on branch change
    setNotification(null);
    const selectedBranch = branches.find((b) => b.id === Number(branchId));
    const isOmborBranch = selectedBranch?.name.toLowerCase() === 'ombor';
    setIsOmbor(isOmborBranch);
    setOperationType(isOmborBranch ? 'SALE' : 'TRANSFER'); // Default to SALE for Ombor, TRANSFER for others
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
        const [branchesRes] = await Promise.all([
          axiosWithAuth({ method: 'get', url: `${API_URL}/branches` }),
        ]);
        const branchesData = Array.isArray(branchesRes.data) ? branchesRes.data : branchesRes.data.branches || [];
        setBranches(branchesData);
        
        // Automatically select "Ombor" branch if it exists
        const omborBranch = branchesData.find((b) => b.name?.toLowerCase() === 'ombor');
        if (omborBranch) {
          setSelectedBranchId(omborBranch.id.toString());
          localStorage.setItem('branchId', omborBranch.id.toString());
          setIsOmbor(true);
          setOperationType('SALE');
        } else {
          setNotification({ message: '"Ombor" filiali topilmadi', type: 'warning' });
          if (branchesData.length > 0) {
            setSelectedBranchId(branchesData[0].id.toString());
            localStorage.setItem('branchId', branchesData[0].id.toString());
            setIsOmbor(false);
            setOperationType('TRANSFER');
          }
        }
      } catch (err) {
        setNotification({ message: err.message || 'Filiallarni yuklashda xatolik', type: 'error' });
        console.error('Fetch branches error:', err);
      }
    };
    fetchBranches();
    fetchExchangeRate();
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
      setNotification({ message: err.message || "Ma'lumotlarni yuklashda xatolik", type: 'error' });
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

  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const token = localStorage.getItem('access_token');
        if (token) {
          const response = await axios.get(`${API_URL}/auth/profile`, {
            headers: { Authorization: `Bearer ${token}` },
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
        url: `${API_URL}/transactions?type=SALE&branchId=${selectedBranchId}&limit=50`,
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
        url: `${API_URL}/transactions/pending-transfers?branchId=${selectedBranchId}`,
      });

      const pending = response.data || [];
      setPendingTransfers(pending);

      if (pending.length > 0) {
        const incomingTransfers = pending.filter((t) => t.toBranchId === Number(selectedBranchId));
        if (incomingTransfers.length > 0) {
          setNotification({
            message: `${incomingTransfers.length} ta kiruvchi o'tkazma kutilmoqda`,
            type: 'info',
          });
        }
      }
    } catch (error) {
      console.error('Error loading pending transfers:', error);
    }
  };

  const addToCart = (product) => {
    if (!isOmbor) {
      setNotification({ message: "Faqat Ombor filialidan mahsulot qo'shish mumkin", type: 'error' });
      return;
    }
    if (selectedItems.find((item) => item.id === product.id)) {
      setNotification({ message: "Bu mahsulot allaqachon savatga qo'shilgan", type: 'warning' });
      return;
    }
    setSelectedItems([
      ...selectedItems,
      {
        id: product.id,
        name: product.name,
        model: product.model || 'N/A',
        quantity: '1',
        price: product.price.toString(),
        marketPrice: product.marketPrice ? product.marketPrice.toString() : product.price.toString(),
        maxQuantity: product.quantity,
      },
    ]);
    setNotification({ message: "Mahsulot savatga qo'shildi", type: 'success' });
  };

  const updateItem = (index, field, value) => {
    setSelectedItems((prev) => {
      const newItems = prev.map((item, i) =>
        i === index ? { ...item, [field]: value } : item,
      );
      return newItems;
    });
  };

  const removeItem = (index) => {
    setSelectedItems((prev) => prev.filter((_, i) => i !== index));
  };

  const clearCart = () => {
    setSelectedItems([]);
    setOperationType(isOmbor ? 'SALE' : 'TRANSFER');
    setPaymentType('');
    setFirstName('');
    setLastName('');
    setPhone('');
    setJshshir('');
    setPassportSeries('');
    setDownPayment('');
    setMonths('');
    setInterestRate('');
    setToBranch('');
    setErrors({});
  };

  const validateFields = () => {
    const newErrors = {};
    if (!isOmbor) {
      newErrors.branch = "Faqat Ombor filialidan operatsiyalar amalga oshirilishi mumkin";
      setErrors(newErrors);
      return false;
    }
    if (selectedItems.length === 0) newErrors.items = 'Kamida bitta mahsulot tanlanishi shart';
    selectedItems.forEach((item, index) => {
      if (
        !item.quantity ||
        isNaN(item.quantity) ||
        Number(item.quantity) <= 0 ||
        !Number.isInteger(Number(item.quantity))
      ) {
        newErrors[`quantity_${index}`] = "Miqdor 0 dan katta butun son bo'lishi kerak";
      } else if (Number(item.quantity) > item.maxQuantity) {
        newErrors[`quantity_${index}`] = `Maksimal miqdor: ${item.maxQuantity} dona`;
      }
      if (!item.marketPrice || isNaN(item.marketPrice) || Number(item.marketPrice) <= 0) {
        newErrors[`price_${index}`] = "Narx 0 dan katta bo'lishi kerak";
      }
    });

    if (operationType === 'SALE' && (paymentType === 'CREDIT' || paymentType === 'INSTALLMENT')) {
      if (!firstName.trim()) newErrors.firstName = 'Ism kiritilishi shart';
      if (!lastName.trim()) newErrors.lastName = 'Familiya kiritilishi shart';
      if (!phone.trim() || !/^\+998\s?\d{2}\s?\d{3}\s?\d{2}\s?\d{2}$/.test(phone))
        newErrors.phone = 'Telefon raqami: +998 XX XXX XX XX';
    }

    if (operationType === 'SALE' && !paymentType) newErrors.paymentType = "To'lov turi tanlanishi shart";
    if (
      operationType === 'SALE' &&
      (paymentType === 'CREDIT' || paymentType === 'INSTALLMENT' || paymentType === 'DELIVERY') &&
      !downPayment.trim()
    ) {
      newErrors.downPayment = 'Manzil kiritilishi shart';
    }
    if (operationType === 'SALE' && (paymentType === 'CREDIT' || paymentType === 'INSTALLMENT')) {
      if (
        !months ||
        isNaN(months) ||
        Number(months) <= 0 ||
        !Number.isInteger(Number(months)) ||
        Number(months) > 24
      ) {
        newErrors.months = 'Oylar soni 1 dan 24 gacha butun son bo\'lishi kerak';
      }
      if (!interestRate || isNaN(interestRate) || Number(interestRate) < 0) {
        newErrors.interestRate = "Foiz 0 dan katta yoki teng bo'lishi kerak";
      }
      if (!passportSeries.trim()) newErrors.passportSeries = 'Passport seriyasi kiritilishi shart';
      if (!jshshir.trim() || !/^\d{14,16}$/.test(jshshir))
        newErrors.jshshir = 'JSHSHIR 14-16 raqamdan iborat bo\'lishi kerak';
    }
    if (operationType === 'TRANSFER') {
      if (!toBranch) newErrors.toBranch = "Qabul qiluvchi filial tanlanishi shart";
      else if (toBranch === selectedBranchId) newErrors.toBranch = "Qabul qiluvchi filial boshqa bo'lishi kerak";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCartSubmit = async (e) => {
    e.preventDefault();
    if (!validateFields()) {
      setNotification({ message: "Barcha maydonlarni to'g'ri to'ldiring", type: 'error' });
      return;
    }

    const confirmMessage =
      operationType === 'TRANSFER'
        ? `Haqiqatan ham ${branches.find((b) => b.id === Number(selectedBranchId))?.name} filialidan ${
            branches.find((b) => b.id === Number(toBranch))?.name
          } filialiga ${selectedItems
            .map((item) => `${item.name} (${formatQuantity(item.quantity)})`)
            .join(', ')} ko'chirmoqchimisiz?`
        : `Haqiqatan ham ushbu mahsulotlarni mijozga sotmoqchimisiz?`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setSubmitting(true);
    setNotification(null);

    try {
      const userId = Number(localStorage.getItem('userId'));
      const baseTotal = selectedItems.reduce(
        (sum, item) => sum + Number(item.quantity) * Number(item.marketPrice),
        0,
      );
      const m = Number(months);
      const interestRateValue = Number(interestRate) / 100 || 0;
      const finalTotal = baseTotal * (1 + interestRateValue);
      const paid = Number(downPayment) || 0;
      const remaining = paid < finalTotal ? finalTotal - paid : 0;
      const monthlyPayment = m > 0 && remaining > 0 ? remaining / m : 0;

      let response;
      if (operationType === 'TRANSFER') {
        response = await axiosWithAuth({
          method: 'post',
          url: `${API_URL}/transactions/transfer`,
          data: {
            fromBranchId: Number(selectedBranchId),
            toBranchId: Number(toBranch),
            soldByUserId: userId,
            items: selectedItems.map((item) => ({
              productId: item.id,
              quantity: Number(item.quantity),
              price: Number(item.marketPrice),
            })),
          },
        });

        const destinationBranchName = branches.find((b) => b.id === Number(toBranch))?.name;
        const sourceBranchName = branches.find((b) => b.id === Number(selectedBranchId))?.name;

        setNotification({
          message: `✅ O'tkazma muvaffaqiyatli amalga oshirildi! ${sourceBranchName} filialidan ${destinationBranchName} filialiga ko'chirildi: ${selectedItems
            .map((item) => `${item.name} (${formatQuantity(item.quantity)})`)
            .join(', ')}`,
          type: 'success',
        });
      } else {
        const payload = {
          type: 'SALE',
          status: 'PENDING',
          total: baseTotal,
          finalTotal,
          amountPaid: paid,
          userId,
          remainingBalance: remaining,
          paymentType: paymentType === 'INSTALLMENT' ? 'CREDIT' : paymentType,
          deliveryMethod: paymentType === 'DELIVERY' ? 'DELIVERY' : 'PICKUP',
          deliveryAddress:
            (paymentType === 'CREDIT' || paymentType === 'INSTALLMENT' || paymentType === 'DELIVERY')
              ? downPayment || undefined
              : undefined,
          customer: {
            fullName: `${firstName} ${lastName}`.trim(),
            phone: phone.replace(/\s+/g, ''),
            passportSeries: passportSeries || undefined,
            jshshir: jshshir || undefined,
            address: downPayment || undefined,
          },
          fromBranchId: Number(selectedBranchId),
          soldByUserId: Number(userId),
          items: selectedItems.map((item) => ({
            productId: item.id,
            productName: item.name,
            quantity: Number(item.quantity),
            price: Number(item.marketPrice),
            total: Number(item.quantity) * Number(item.marketPrice),
            ...(paymentType === 'CREDIT' || paymentType === 'INSTALLMENT'
              ? {
                  creditMonth: m,
                  creditPercent: interestRateValue,
                  monthlyPayment,
                }
              : {}),
          })),
        };

        response = await axiosWithAuth({
          method: 'post',
          url: `${API_URL}/transactions`,
          data: payload,
        });

        setReceiptData({
          ...response.data,
          customer: {
            fullName: `${firstName} ${lastName}`.trim(),
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            phone: phone.replace(/\s+/g, ''),
            passportSeries: passportSeries || undefined,
            jshshir: jshshir || undefined,
            address: downPayment || undefined,
          },
          seller: currentUser,
          branch: branches.find((b) => b.id === Number(selectedBranchId)),
          items: selectedItems,
          paymentType,
          deliveryType: paymentType === 'DELIVERY' ? 'DELIVERY' : 'PICKUP',
          deliveryAddress: downPayment,
          months: m,
          interestRate: Number(interestRate),
          paid: paid,
          remaining: remaining,
          monthlyPayment: monthlyPayment,
          totalInSom: baseTotal * exchangeRate,
          finalTotalInSom: finalTotal * exchangeRate,
          exchangeRate,
        });

        setNotification({ message: 'Sotish muvaffaqiyatli amalga oshirildi', type: 'success' });
        setShowReceiptModal(true);
      }

      clearCart();
      await loadData();
    } catch (err) {
      let message = operationType === 'SALE' ? 'Sotishda xatolik' : 'Transfer qilishda xatolik';
      if (err.response?.data?.message) {
        message = err.response.data.message;
      } else if (err.message) {
        message = err.message;
      }
      setNotification({ message, type: 'error' });
      console.error('Submit error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const buildTransactionFromReceiptData = () => {
    if (!receiptData) return null;
    return {
      id: receiptData.id || 'N/A',
      createdAt: receiptData.date || new Date(),
      customer: {
        fullName: receiptData.customer?.fullName || "Noma'lum",
        firstName: receiptData.customer?.firstName || '',
        lastName: receiptData.customer?.lastName || '',
        phone: receiptData.customer?.phone || "Noma'lum",
        jshshir: receiptData.customer?.jshshir || "Noma'lum",
        passportSeries: receiptData.customer?.passportSeries || "Noma'lum",
      },
      branch: { name: receiptData.branch?.name || "Noma'lum" },
      paymentType: receiptData.paymentType || "Noma'lum",
      total: receiptData.total || 0,
      finalTotal: receiptData.finalTotal || receiptData.total || 0,
      totalInSom: receiptData.totalInSom || 0,
      finalTotalInSom: receiptData.finalTotalInSom || 0,
      exchangeRate: receiptData.exchangeRate || 12500,
      paid: receiptData.paid || 0,
      remaining: (receiptData.finalTotal || receiptData.total || 0) - (receiptData.paid || 0),
      interestRate: receiptData.interestRate || 0,
      months: receiptData.months || 0,
      monthlyPayment: receiptData.monthlyPayment || 0,
      items: receiptData.items.map((item) => ({
        name: item.name,
        quantity: Number(item.quantity),
        price: Number(item.price),
        priceInSom: Number(item.price) * (receiptData.exchangeRate || 12500),
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
      const num = Number(amount) || 0;
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
      }).format(num);
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
        case 'CASH':
          return 'Нақд';
        case 'CARD':
          return 'Карта';
        case 'CREDIT':
          return 'Кредит';
        case 'INSTALLMENT':
          return 'Бўлиб тўлаш';
        default:
          return "Noma'lum";
      }
    };

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
              font-family: 'Arial', sans-serif; 
              margin: 0; 
              padding: 2%; 
              width: 96%; 
              font-size: 12px; 
              line-height: 1.2;
              color: #000;
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
              color: #000;
            }
            .header p { 
              margin: 2% 0 0 0; 
              font-size: 11px;
              color: #000;
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
              color: #000;
            }
            .product-row { 
              display: flex; 
              justify-content: space-between; 
              margin: 1% 0; 
              font-size: 10px;
              border-bottom: 1px dotted #ccc;
              padding-bottom: 1%;
              color: #000;
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
              color: #000;
            }
            .footer { 
              text-align: center; 
              margin-top: 5%; 
              padding-top: 3%;
              border-top: 1px dashed #000;
              font-size: 10px;
              color: #000;
            }
            @media print { 
              body { margin: 0; padding: 1%; width: 98%; color: #000; }
            }
            @media print and (max-width: 56mm) {
              body { font-size: 10px; padding: 1%; width: 98%; color: #000; }
              .header h2 { font-size: 14px; color: #000; }
              .total-row { font-size: 11px; color: #000; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h2>Aminov Savdo Tizimi</h2>
              <p class="total-row">${formatDateLocal(new Date())}</p>
            </div>
          </div>
          <div class="info">
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
              <span>${getPaymentTypeText(transaction.paymentType)}</span>
            </div>
          </div>
          <div class="products">
            <h4>MAHSULOTLAR</h4>
            ${transaction.items
              .map(
                (item, index) => `
              <div class="product-row">
                <span>${item.name} x${item.quantity}</span>
                <span>${formatAmount(Number(item.quantity) * Number(item.price))}</span>
              </div>
            `,
              )
              .join('')}
          </div>
          <div class="total">
            <div class="total-row">
              <span>JAMI:</span>
              <span>${formatAmount(transaction.finalTotal)}</span>
            </div>
            ${['CREDIT', 'INSTALLMENT'].includes(transaction.paymentType)
              ? `
              <div class="total-row">
                <span>To'langan:</span>
                <span>${formatAmount(transaction.paid)}</span>
              </div>
              <div class="total-row">
                <span>Qolgan:</span>
                <span>${formatAmount(transaction.remaining)}</span>
              </div>
              <div class="total-row">
                <span>Oylik:</span>
                <span>${formatAmount(transaction.monthlyPayment)}</span>
              </div>
            `
              : ''}
          </div>
          <div class="footer">
            <p>Tashrifingiz uchun rahmat!</p>
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
      }
    } catch {}
    printWindowRef.current = null;
    setShowReceiptModal(false);
  };

  const calculatePaymentSchedule = () => {
    const m = Number(months);
    const rate = Number(interestRate) / 100 || 0;
    if (!m || m <= 0 || selectedItems.length === 0)
      return { totalWithInterest: 0, monthlyPayment: 0, schedule: [], change: 0, remaining: 0 };

    const baseTotal = selectedItems.reduce(
      (sum, item) => sum + Number(item.quantity) * Number(item.marketPrice),
      0,
    );
    const paid = Number(downPayment) || 0;
    const remainingPrincipal = Math.max(0, baseTotal - paid);
    const remaining = remainingPrincipal * (1 + rate);
    const totalWithInterest = paid + remaining;
    const change = paid > totalWithInterest ? paid - totalWithInterest : 0;
    const monthlyPayment = m > 0 && remaining > 0 ? remaining / m : 0;
    const schedule = [];

    let remainingBalance = remaining;
    for (let i = 1; i <= m; i++) {
      schedule.push({
        month: i,
        payment: monthlyPayment,
        remainingBalance: Math.max(0, remainingBalance - monthlyPayment),
      });
      remainingBalance -= monthlyPayment;
    }

    return { totalWithInterest, monthlyPayment, schedule, change, remaining };
  };

  useEffect(() => {
    if (!isOmbor) {
      setOperationType('TRANSFER');
      setSelectedItems([]); // Clear cart if not Ombor
    }
  }, [isOmbor]);

  const { totalWithInterest, monthlyPayment, schedule, change, remaining } = calculatePaymentSchedule();

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Чиқим</h1>

      {notification && (
        <div
          className={`p-4 rounded-lg flex items-center gap-3 mb-4 ${
            notification.type === 'error'
              ? 'bg-red-50 text-red-700 border border-red-200'
              : notification.type === 'warning'
              ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
              : 'bg-green-50 text-green-700 border border-green-200'
          }`}
        >
          <span>{notification.message}</span>
          <button
            className="text-sm underline hover:no-underline transition-all"
            onClick={() => setNotification(null)}
          >
            Ёпиш
          </button>
        </div>
      )}

      <div className="flex items-center gap-4 mb-4">
        <select
          value={selectedBranchId}
          onChange={(e) => handleBranchChange(e.target.value)}
          className="w-full max-w-xs p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
        >
          <option value="">Филиал танланг</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>

        <button
          onClick={() => setShowCartModal(true)}
          className="relative bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600 transition-all duration-200"
          disabled={!isOmbor}
        >
          Сават
          {selectedItems.length > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center">
              {selectedItems.length}
            </span>
          )}
        </button>
      </div>

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
                  <th className="p-3">Модел</th>
                  <th className="p-3">Филиал</th>
                  <th className="p-3">Нарх (USD)</th>
                  <th className="p-3">Нарх (сом)</th>
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
                      <td className="p-3">{product.model || 'N/A'}</td>
                      <td className="p-3">{product.branch?.name || "Noma'lum"}</td>
                      <td className="p-3">{formatCurrency(product.marketPrice)}</td>
                      <td className="p-3">{formatCurrencySom(product.marketPrice)}</td>
                      <td className="p-3">{formatQuantity(product.quantity)}</td>
                      <td className="p-3">
                        <button
                          onClick={() => addToCart(product)}
                          disabled={product.quantity <= 0 || selectedItems.find((item) => item.id === product.id) || !isOmbor}
                          className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600 disabled:bg-gray-400 transition-all duration-200"
                        >
                          Қўшиш
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="8" className="p-3 text-center">
                      Tovarlar topilmadi
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {showCartModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto shadow-xl">
                <div className="flex justify-between mb-4">
                  <h3 className="text-lg font-bold">Сават ({selectedItems.length} та маҳсулот)</h3>
                  <button
                    onClick={() => setShowCartModal(false)}
                    className="text-gray-600 hover:text-gray-800 transition-all"
                  >
                    X
                  </button>
                </div>

                {selectedItems.length > 0 ? (
                  <>
                    <div className="overflow-x-auto mb-6">
                      <table className="w-full border border-gray-200">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="p-3 text-left font-medium">Модел</th>
                            <th className="p-3 text-left font-medium">Маҳсулот</th>
                            <th className="p-3 text-left font-medium">Нарх (UZS)</th>
                            <th className="p-3 text-left font-medium">Миқдор</th>
                            <th className="p-3 text-left font-medium">Жами</th>
                            <th className="p-3 text-left font-medium">Амаллар</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedItems.map((item, index) => (
                            <tr key={index} className="border-t border-gray-200">
                              <td className="p-3">{item.model}</td>
                              <td className="p-3">{item.name}</td>
                              <td className="p-3">
                                <input
                                  type="number"
                                  value={item.marketPrice}
                                  onChange={(e) => updateItem(index, 'marketPrice', e.target.value)}
                                  className={`w-24 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                    errors[`price_${index}`] ? 'border-red-500' : 'border-gray-300'
                                  }`}
                                  min="0"
                                  step="0.01"
                                />
                                {errors[`price_${index}`] && (
                                  <span className="text-red-500 text-xs">{errors[`price_${index}`]}</span>
                                )}
                              </td>
                              <td className="p-3">
                                <input
                                  type="number"
                                  value={item.quantity}
                                  onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                                  className={`w-20 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                    errors[`quantity_${index}`] ? 'border-red-500' : 'border-gray-300'
                                  }`}
                                  min="1"
                                  max={item.maxQuantity}
                                  step="1"
                                />
                                {errors[`quantity_${index}`] && (
                                  <span className="text-red-500 text-xs">{errors[`quantity_${index}`]}</span>
                                )}
                              </td>
                              <td className="p-3 font-medium">
                                {formatCurrencySom(Number(item.quantity) * Number(item.marketPrice))}
                              </td>
                              <td className="p-3">
                                <button
                                  onClick={() => removeItem(index)}
                                  className="bg-red-500 text-white px-3 py-1 rounded-lg hover:bg-red-600 transition-colors text-sm"
                                >
                                  Ўчириш
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Амал тури</label>
                      <select
                        value={operationType}
                        onChange={(e) => setOperationType(e.target.value)}
                        className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 border-gray-300"
                        disabled={!isOmbor}
                      >
                        <option value="SALE">Мижозга сотиш</option>
                        <option value="TRANSFER">Филиалга ўтказиш</option>
                      </select>
                    </div>

                    {operationType === 'TRANSFER' && (
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Қабул қилувчи филиал</label>
                        <select
                          value={toBranch}
                          onChange={(e) => setToBranch(e.target.value)}
                          className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            errors.toBranch ? 'border-red-500' : 'border-gray-300'
                          }`}
                        >
                          <option value="">Танланг</option>
                          {branches
                            .filter((b) => b.id !== Number(selectedBranchId))
                            .map((branch) => (
                              <option key={branch.id} value={branch.id}>
                                {branch.name}
                              </option>
                            ))}
                        </select>
                        {errors.toBranch && <span className="text-red-500 text-xs">{errors.toBranch}</span>}
                      </div>
                    )}

                    {operationType === 'SALE' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h4 className="text-md font-semibold mb-3">Мижоз маълумотлари</h4>
                          <div className="space-y-3">
                            {['CREDIT', 'INSTALLMENT', 'DELIVERY'].includes(paymentType) && (
                              <>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">Исм</label>
                                  <input
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                    className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                      errors.firstName ? 'border-red-500' : 'border-gray-300'
                                    }`}
                                  />
                                  {errors.firstName && (
                                    <span className="text-red-500 text-xs">{errors.firstName}</span>
                                  )}
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">Фамилия</label>
                                  <input
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                    className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                      errors.lastName ? 'border-red-500' : 'border-gray-300'
                                    }`}
                                  />
                                  {errors.lastName && (
                                    <span className="text-red-500 text-xs">{errors.lastName}</span>
                                  )}
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">Телефон</label>
                                  <input
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                      errors.phone ? 'border-red-500' : 'border-gray-300'
                                    }`}
                                  />
                                  {errors.phone && <span className="text-red-500 text-xs">{errors.phone}</span>}
                                </div>
                              </>
                            )}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Етказиб бериш тури
                              </label>
                              <select
                                value={paymentType}
                                onChange={(e) => setPaymentType(e.target.value)}
                                className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 border-gray-300"
                              >
                                <option value="PICKUP">Олиб кетиш</option>
                                <option value="DELIVERY">Етказиб бериш</option>
                              </select>
                            </div>
                            {(paymentType === 'DELIVERY' || ['CREDIT', 'INSTALLMENT'].includes(paymentType)) && (
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Манзил</label>
                                <textarea
                                  value={downPayment}
                                  onChange={(e) => setDownPayment(e.target.value)}
                                  placeholder="Тўлиқ манзилни киритинг..."
                                  className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                    errors.downPayment ? 'border-red-500' : 'border-gray-300'
                                  }`}
                                  rows="3"
                                />
                                {errors.downPayment && (
                                  <span className="text-red-500 text-xs">{errors.downPayment}</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <div>
                          <h4 className="text-md font-semibold mb-3">Тўлов маълумотлари</h4>
                          <div className="space-y-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Тўлов тури</label>
                              <select
                                value={paymentType}
                                onChange={(e) => setPaymentType(e.target.value)}
                                className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                  errors.paymentType ? 'border-red-500' : 'border-gray-300'
                                }`}
                              >
                                <option value="">Танланг</option>
                                <option value="CASH">Нақд</option>
                                <option value="CARD">Карта</option>
                                <option value="CREDIT">Кредит</option>
                                <option value="INSTALLMENT">Бўлиб Тўлаш</option>
                              </select>
                              {errors.paymentType && (
                                <span className="text-red-500 text-xs">{errors.paymentType}</span>
                              )}
                            </div>
                            {['CREDIT', 'INSTALLMENT'].includes(paymentType) && (
                              <>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Паспорт серияси
                                  </label>
                                  <input
                                    type="text"
                                    value={passportSeries}
                                    onChange={(e) => setPassportSeries(e.target.value)}
                                    placeholder="AA 1234567"
                                    className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                      errors.passportSeries ? 'border-red-500' : 'border-gray-300'
                                    }`}
                                  />
                                  {errors.passportSeries && (
                                    <span className="text-red-500 text-xs">{errors.passportSeries}</span>
                                  )}
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">JSHSHIR</label>
                                  <input
                                    type="text"
                                    value={jshshir}
                                    onChange={(e) => setJshshir(e.target.value)}
                                    placeholder="1234567890123456"
                                    className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                      errors.jshshir ? 'border-red-500' : 'border-gray-300'
                                    }`}
                                    maxLength={16}
                                  />
                                  {errors.jshshir && (
                                    <span className="text-red-500 text-xs">{errors.jshshir}</span>
                                  )}
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Ойлар сони
                                  </label>
                                  <input
                                    type="number"
                                    value={months}
                                    onChange={(e) => setMonths(e.target.value)}
                                    className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                      errors.months ? 'border-red-500' : 'border-gray-300'
                                    }`}
                                    min="1"
                                    max="24"
                                    step="1"
                                  />
                                  {errors.months && (
                                    <span className="text-red-500 text-xs">{errors.months}</span>
                                  )}
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">Фоиз (%)</label>
                                  <input
                                    type="number"
                                    value={interestRate}
                                    onChange={(e) => setInterestRate(e.target.value)}
                                    className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                      errors.interestRate ? 'border-red-500' : 'border-gray-300'
                                    }`}
                                    step="0.01"
                                    min="0"
                                  />
                                  {errors.interestRate && (
                                    <span className="text-red-500 text-xs">{errors.interestRate}</span>
                                  )}
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Мижоз тўлаган
                                  </label>
                                  <input
                                    type="number"
                                    value={downPayment}
                                    onChange={(e) => setDownPayment(e.target.value)}
                                    className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 border-gray-300"
                                    step="0.01"
                                    min="0"
                                  />
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {operationType === 'SALE' && (
                      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                        <h4 className="text-md font-semibold mb-3">Жами</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Асосий сумма:</span>
                            <span className="font-medium ml-2">
                              {formatCurrency(
                                selectedItems.reduce(
                                  (sum, item) => sum + Number(item.quantity) * Number(item.marketPrice),
                                  0,
                                ),
                              )}
                            </span>
                            <br />
                            <span className="text-gray-600 text-sm">Сомда:</span>
                            <span className="font-medium ml-2 text-sm">
                              {formatCurrencySom(
                                selectedItems.reduce(
                                  (sum, item) => sum + Number(item.quantity) * Number(item.marketPrice),
                                  0,
                                ),
                              )}
                            </span>
                          </div>
                          {['CREDIT', 'INSTALLMENT'].includes(paymentType) && (
                            <>
                              <div>
                                <span className="text-gray-600">Фоиз билан:</span>
                                <span className="font-medium ml-2">{formatCurrency(totalWithInterest)}</span>
                                <br />
                                <span className="text-gray-600 text-sm">Сомда:</span>
                                <span className="font-medium ml-2 text-sm">
                                  {formatCurrencySom(totalWithInterest)}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-600">Тўланган:</span>
                                <span className="font-medium ml-2">
                                  {formatCurrency(Number(downPayment) || 0)}
                                </span>
                                <br />
                                <span className="text-gray-600 text-sm">Сомда:</span>
                                <span className="font-medium ml-2 text-sm">
                                  {formatCurrencySom(Number(downPayment) || 0)}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-600">Қолган:</span>
                                <span className="font-medium ml-2">{formatCurrency(remaining)}</span>
                                <br />
                                <span className="text-gray-600 text-sm">Сомда:</span>
                                <span className="font-medium ml-2 text-sm">{formatCurrencySom(remaining)}</span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="mt-6 flex gap-3">
                      <button
                        onClick={handleCartSubmit}
                        disabled={submitting || !isOmbor}
                        className="flex-1 bg-blue-500 text-white p-3 rounded-lg hover:bg-blue-600 disabled:bg-gray-400 transition-colors font-medium"
                      >
                        {submitting ? 'Юкланмоқда...' : 'Амални амалга ошириш'}
                      </button>
                      <button
                        onClick={clearCart}
                        className="flex-1 bg-gray-200 text-gray-700 p-3 rounded-lg hover:bg-gray-300 transition-colors"
                      >
                        Саватни тозалаш
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="text-center text-gray-600">Сават бўш</p>
                )}
              </div>
            </div>
          )}

          {showTransferHistory && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto shadow-xl">
                <div className="flex justify-between mb-4">
                  <h3 className="text-lg font-bold">Ўтказмалар тарихи</h3>
                  <button
                    onClick={() => setShowTransferHistory(false)}
                    className="text-gray-600 hover:text-gray-800 transition-all"
                  >
                    X
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border">
                    <thead>
                      <tr className="bg-gray-100 text-left">
                        <th className="p-3">ID</th>
                        <th className="p-3">Сана</th>
                        <th className="p-3">Жами</th>
                        <th className="p-3">Тўлов тури</th>
                        <th className="p-3">Филиал</th>
                        <th className="p-3">Маҳсулотлар</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transferHistory.length > 0 ? (
                        transferHistory.map((transfer) => (
                          <tr key={transfer.id} className="border-t">
                            <td className="p-3">#{transfer.id}</td>
                            <td className="p-3">{formatDate(transfer.createdAt)}</td>
                            <td className="p-3">{formatCurrency(transfer.finalTotal)}</td>
                            <td className="p-3">{transfer.paymentType || "Noma'lum"}</td>
                            <td className="p-3">{transfer.branch?.name || "Noma'lum"}</td>
                            <td className="p-3">
                              {transfer.items?.map((item) => (
                                <div key={item.id}>
                                  {item.name} x{item.quantity} ({formatCurrency(item.price)})
                                </div>
                              ))}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="6" className="p-3 text-center">
                            Ўтказмалар топилмади
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {showReceiptModal && receiptData && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg shadow-xl w-[90%] max-w-md mx-auto">
                <Receipt
                  transaction={receiptData}
                  onClose={closeReceiptModal}
                  onPrint={() => {
                    const printWindow = window.open('', '_blank');
                    const receiptContent = `
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
                          color: #000;
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
                          color: #000;
                        }
                        .header p { 
                          margin: 2% 0 0 0; 
                          font-size: 11px;
                          color: #000;
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
                          color: #000;
                        }
                        .product-row { 
                          display: flex; 
                          justify-content: space-between; 
                          margin: 1% 0; 
                          font-size: 10px;
                          border-bottom: 1px dotted #ccc;
                          padding-bottom: 1%;
                          color: #000;
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
                          color: #000;
                        }
                        .footer { 
                          text-align: center; 
                          margin-top: 5%; 
                          padding-top: 3%;
                          border-top: 1px dashed #000;
                          font-size: 10px;
                          color: #000;
                        }
                        @media print { 
                          body { margin: 0; padding: 1%; width: 98%; color: #000; }
                        }
                        @media print and (max-width: 56mm) {
                          body { font-size: 10px; padding: 1%; width: 98%; color: #000; }
                          .header h2 { font-size: 14px; color: #000; }
                          .total-row { font-size: 11px; color: #000; }
                        }
                      </style>
                      </head>
                      <body>
                        <div class="header">
                          <h2>Aminov Savdo Tizimi</h2>
                          <p class="total-row">${formatDate(new Date())}</p>
                        </div>
                        <div class="info">
                          <div class="total-row">
                            <span>ID:</span>
                            <span>#${receiptData.id}</span>
                          </div>
                          <div class="total-row">
                            <span>Mijoz:</span>
                            <span>${
                              receiptData.customer.fullName ||
                              `${receiptData.customer.firstName} ${receiptData.customer.lastName}`
                            }</span>
                          </div>
                          <div class="total-row">
                            <span>Tel:</span>
                            <span>${receiptData.customer.phone}</span>
                          </div>
                          ${receiptData.customer.passportSeries ? `
                          <div class="total-row">
                            <span>Passport:</span>
                            <span>${receiptData.customer.passportSeries}</span>
                          </div>
                          ` : ''}
                          ${receiptData.customer.jshshir ? `
                          <div class="total-row">
                            <span>JSHSHIR:</span>
                            <span>${receiptData.customer.jshshir}</span>
                          </div>
                          ` : ''}
                          <div class="total-row">
                            <span>Filial:</span>
                            <span>${receiptData.branch?.name}</span>
                          </div>
                          <div class="total-row">
                            <span>To'lov:</span>
                            <span>${
                              receiptData.paymentType === 'CASH'
                                ? 'Naqd'
                                : receiptData.paymentType === 'CARD'
                                ? 'Karta'
                                : receiptData.paymentType === 'CREDIT'
                                ? 'Kredit'
                                : receiptData.paymentType === 'INSTALLMENT'
                                ? "Bo'lib to'lash"
                                : receiptData.paymentType
                            }</span>
                          </div>
                          <div class="total-row">
                            <span>Yetkazib berish:</span>
                            <span>${
                              receiptData.deliveryType === 'PICKUP'
                                ? 'Olib ketish'
                                : receiptData.deliveryType === 'DELIVERY'
                                ? 'Yetkazib berish'
                                : receiptData.deliveryType
                            }</span>
                          </div>
                          ${receiptData.deliveryType === 'DELIVERY' && receiptData.deliveryAddress ? `
                          <div class="total-row">
                            <span>Manzil:</span>
                            <span>${receiptData.deliveryAddress}</span>
                          </div>
                          ` : ''}
                        </div>
                        <div class="products">
                          <h4>MAHSULOTLAR</h4>
                          ${receiptData.items
                            .map(
                              (item, index) => `
                            <div class="total-row">
                              <span>${item.name} x${item.quantity}</span>
                              <span>${formatCurrencySom(Number(item.quantity) * Number(item.marketPrice))}</span>
                            </div>
                          `,
                            )
                            .join('')}
                        </div>
                        <div class="total">
                          <div class="total-row">
                            <span>JAMI:</span>
                            <span>${formatCurrencySom(receiptData.finalTotal)}</span>
                          </div>
                          ${['CREDIT', 'INSTALLMENT'].includes(receiptData.paymentType)
                            ? `
                            <div class="total-row">
                              <span>To'langan:</span>
                              <span>${formatCurrency(receiptData.paid)} (${formatCurrencySom(receiptData.paid)})</span>
                            </div>
                            <div class="total-row">
                              <span>Qolgan:</span>
                              <span>${formatCurrency(receiptData.remaining)} (${formatCurrencySom(
                                receiptData.remaining,
                              )})</span>
                            </div>
                            <div class="total-row">
                              <span>Oylik:</span>
                              <span>${formatCurrency(receiptData.monthlyPayment)} (${formatCurrencySom(
                                receiptData.monthlyPayment,
                              )})</span>
                            </div>
                          `
                            : ''}
                        </div>
                        <div class="total-row">
                          <p>Tashrifingiz uchun rahmat!</p>
                        </div>
                        <div class="total"></div>
                      </body>
                      </html>
                    `;
                    printWindow.document.write(receiptContent);
                    printWindow.document.close();
                    printWindow.focus();
                    setTimeout(() => {
                      printWindow.print();
                      printWindow.close();
                      closeReceiptModal();
                    }, 1000);
                  }}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Chiqim;