import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Receipt from '../../KassaUser/Receipt/Receipt';

const Chiqim = ({ selectedBranchId: propSelectedBranchId, exchangeRate: propExchangeRate }) => {
  const [products, setProducts] = useState([]);
  const [allProducts, setAllProducts] = useState([]); // Store all products for client-side filtering
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState(propSelectedBranchId || '');
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
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [months, setMonths] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [upfrontPaymentMethod, setUpfrontPaymentMethod] = useState('CASH');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [searchTerm, setSearchTerm] = useState('');

  // Customer sales modal state
  const [showCustomerSalesModal, setShowCustomerSalesModal] = useState(false);
  const [customerPaid, setCustomerPaid] = useState('0');
  const [termUnit, setTermUnit] = useState('MONTHS');
  const [daysCount, setDaysCount] = useState('');
  const [priceInputValues, setPriceInputValues] = useState({});
  const [deliveryType, setDeliveryType] = useState('PICKUP');

  const [currentUser, setCurrentUser] = useState(null);
  const [showTransferHistory, setShowTransferHistory] = useState(false);
  const [transferHistory, setTransferHistory] = useState([]);
  const [pendingTransfers, setPendingTransfers] = useState([]);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [exchangeRate, setExchangeRate] = useState(Number(propExchangeRate) || 12500);
  const [showCartModal, setShowCartModal] = useState(false);
  const [isOmbor, setIsOmbor] = useState(false);
  const [receiptPrinted, setReceiptPrinted] = useState(false);
  const [pendingTransaction, setPendingTransaction] = useState(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const printWindowRef = useRef(null);

  const navigate = useNavigate();
  const API_URL = 'https://suddocs.uz';

  const formatCurrency = (amount) =>
    amount != null && Number.isFinite(Number(amount))
      ? new Intl.NumberFormat('uz-UZ').format(Math.round(Number(amount))) + "$"
      : "0$";

  const formatCurrencySom = (amount) => {
    if (amount != null && Number.isFinite(Number(amount))) {
      return new Intl.NumberFormat('uz-UZ').format(Math.round(Number(amount))) + " so'm";
    }
    return "0 so'm";
  };

  // Helpers for formatted so'm inputs (1 so'm precision)
  const formatSomInt = (value) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return '';
    return new Intl.NumberFormat('uz-UZ').format(Math.max(0, Math.round(num)));
  };
  const parseSomInt = (raw) => {
    const cleaned = String(raw || '').replace(/[^0-9]/g, '');
    const num = Number(cleaned);
    return Number.isFinite(num) ? Math.max(0, Math.round(num)) : 0;
  };

  const onPriceSomChange = (index, e) => {
    const somInt = parseSomInt(e.target.value);
    const usd = somInt / Math.max(1, Number(exchangeRate));
    updateItem(index, 'marketPrice', usd.toString());
  };

  const onPriceSomChangeDirect = (index, e) => {
    const value = e.target.value;
    if (value === '') {
      updateItem(index, 'marketPrice', '0');
      return;
    }
    // Allow typing any number starting from 0
    const somInt = Number(value.replace(/[^0-9]/g, ''));
    if (isNaN(somInt)) {
      updateItem(index, 'marketPrice', '0');
      return;
    }
    // Convert so'm to USD and update the item
    const usd = somInt / Math.max(0, Number(exchangeRate));
    updateItem(index, 'marketPrice', usd.toString());
  };

  const onPriceUSDChange = (index, e) => {
    const usdPrice = Number(e.target.value) || 0;
    updateItem(index, 'marketPrice', usdPrice.toString());
  };

  const fetchExchangeRate = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (token) {
        const response = await axios.get(`${API_URL}/currency-exchange-rates`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.data?.length > 0 && response.data[0]?.rate) {
          setExchangeRate(Number(response.data[0].rate));
        } else {
        }
      }
    } catch (error) {
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
      setTimeout(() => navigate('/login'), 2000);
      throw new Error('No access token');
    }
    const headers = { ...config.headers, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    try {
      return await axios({ ...config, headers });
    } catch (error) {
      if (error.response?.status === 401) {
        localStorage.clear();
        setTimeout(() => navigate('/login'), 2000);
        throw new Error('Sessiya tugadi');
      }
      throw error;
    }
  };

  const handleBranchChange = (branchId) => {
    const storedBranchId = localStorage.getItem('branchId');
    const isOwnBranch = branchId === storedBranchId;

    setSelectedBranchId(branchId);
    setProducts([]);
    setSelectedItems([]);
    setIsOmbor(isOwnBranch);
    setOperationType(isOwnBranch ? 'SALE' : 'TRANSFER');

    if (branchId) {
      setTimeout(() => {
        loadData();
        if (isOwnBranch) {
          loadPendingTransfers();
        }
      }, 100);
    }
  };

  useEffect(() => {
    const fetchBranchesAndSetBranch = async () => {
      try {
        const branchesRes = await axiosWithAuth({ method: 'get', url: `${API_URL}/branches` });
        const branchesData = Array.isArray(branchesRes.data) ? branchesRes.data : branchesRes.data.branches || [];
        setBranches(branchesData);
        const storedBranchId = localStorage.getItem('branchId');
        if (storedBranchId && branchesData.some((b) => b.id.toString() === storedBranchId)) {
          setSelectedBranchId(storedBranchId);
          setIsOmbor(true);
          setOperationType('SALE');
        } else {
          // Branch not found notification removed
        }
      } catch (err) {
      }
    };
    fetchBranchesAndSetBranch();
    fetchExchangeRate();
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    const branchId = Number(selectedBranchId);
    if (!branchId || isNaN(branchId) || !Number.isInteger(branchId)) {
      setProducts([]);
      setLoading(false);
      return;
    }

    try {
      const queryParams = new URLSearchParams();
      queryParams.append('branchId', branchId.toString());
      queryParams.append('includeZeroQuantity', 'true');

      let fetchedProducts = [];
      let page = 1;
      while (true) {
        const productsRes = await axiosWithAuth({
          method: 'get',
          url: `${API_URL}/products?${queryParams.toString()}&page=${page}`,
        });
        const productsData = Array.isArray(productsRes.data) ? productsRes.data : productsRes.data.products || [];
        fetchedProducts = [...fetchedProducts, ...productsData];
        if (!productsRes.data.nextPage) break;
        page++;
      }

      const processedProducts = fetchedProducts.map((product) => ({
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
        marketPrice: Number(product.marketPrice || product.price) || 0,
      }));

      // Store all products for filtering
      setAllProducts(processedProducts);
      
      // Apply client-side filtering
      let filteredProducts = [...processedProducts];
      if (searchTerm.trim()) {
        const words = searchTerm.toLowerCase().trim().split(/\s+/);
        filteredProducts = filteredProducts.filter(p => {
          const name = (p.name || '').toLowerCase();
          const model = (p.model || '').toLowerCase();
          const barcode = (p.barcode || '').toLowerCase();
          return words.every(word => name.includes(word) || model.includes(word) || barcode.includes(word));
        });
      }

      setProducts(filteredProducts);
    } catch (err) {
    } finally {
      setLoading(false);
    }
  }, [selectedBranchId]);

  // Separate effect for search filtering
  useEffect(() => {
    if (!allProducts.length) return;
    
    let filteredProducts = [...allProducts];
    if (searchTerm.trim()) {
      const words = searchTerm.toLowerCase().trim().split(/\s+/);
      filteredProducts = filteredProducts.filter(p => {
        const name = (p.name || '').toLowerCase();
        const model = (p.model || '').toLowerCase();
        const barcode = (p.barcode || '').toLowerCase();
        return words.every(word => name.includes(word) || model.includes(word) || barcode.includes(word));
      });
    }
    setProducts(filteredProducts);
  }, [searchTerm, allProducts]);

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
      }
    };
    loadCurrentUser();
  }, []);

  const loadTransferHistory = async () => {
    if (!selectedBranchId) return;

    try {
      const [salesResponse, transfersResponse] = await Promise.all([
        axiosWithAuth({
          method: 'get',
          url: `${API_URL}/transactions?type=SALE&branchId=${selectedBranchId}&limit=50`,
        }),
        axiosWithAuth({
          method: 'get',
          url: `${API_URL}/transactions?type=TRANSFER&branchId=${selectedBranchId}&limit=50`,
        }).catch(() => ({ data: { transactions: [] } })),
      ]);

      const sales = salesResponse.data.transactions || [];
      const transfers = transfersResponse.data.transactions || [];
      const combined = [...sales, ...transfers].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setTransferHistory(combined);
    } catch (error) {
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
          // Incoming transfers notification removed
        }
      }
    } catch (error) {
    }
  };

  const addToCart = (product) => {
    if (!isOmbor) {
      return;
    }
    if (selectedItems.find((item) => item.id === product.id)) {
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

  };

  const updateItem = (index, field, value) => {
    setSelectedItems((prev) => {
      const newItems = prev.map((item, i) =>
        i === index
          ? {
            ...item,
            [field]: value,
          }
          : item,
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
    setDeliveryAddress('');
    setDeliveryType('PICKUP');
    setMonths('');
    setInterestRate('');
    setUpfrontPaymentMethod('CASH');
    setToBranch('');
    setCustomerPaid('0');
    setTermUnit('MONTHS');
    setDaysCount('');
    setPriceInputValues({});
    setErrors({});
    setReceiptPrinted(false);
    setPendingTransaction(null);
    setShowCartModal(false);
  };

  // Customer sales modal functions
  const openCustomerSalesModal = () => {
    setShowCustomerSalesModal(true);
  };

  const closeCustomerSalesModal = () => {
    setShowCustomerSalesModal(false);
    setFirstName('');
    setLastName('');
    setPhone('');
    setPassportSeries('');
    setJshshir('');
    setPaymentType('');
    setDeliveryAddress('');
    setDeliveryType('PICKUP');
    setMonths('');
    setInterestRate('');
    setCustomerPaid('0');
    setTermUnit('MONTHS');
    setDaysCount('');
    setPriceInputValues({});
    setErrors({});
  };

  const processCustomerSale = async () => {
    if (!validateFields()) {
      return;
    }

    setSubmitting(true);
    try {
      // Calculate totals using custom prices
      const baseTotal = selectedItems.reduce((sum, item, index) => {
        const customPrice = priceInputValues[`${item.id}_${index}`];
        const displayPrice = customPrice ? Number(customPrice) : Number(item.marketPrice) * Number(exchangeRate);
        return sum + Number(item.quantity) * displayPrice;
      }, 0);

      const isDays = paymentType === 'INSTALLMENT' && termUnit === 'DAYS';
      const termCount = isDays ? Number(daysCount) : Number(months);
      const interestRateValue = Number(interestRate) / 100 || 0;

      // Correct calculation logic: subtract upfront payment first, then calculate interest on remaining amount
      const upfrontPayment = Number(customerPaid) || 0;
      const remainingPrincipal = Math.max(0, baseTotal - upfrontPayment);
      const interestAmount = remainingPrincipal * interestRateValue;
      const remainingWithInterest = remainingPrincipal + interestAmount;
      const finalTotal = upfrontPayment + remainingWithInterest;
      const monthlyPayment = termCount > 0 && remainingWithInterest > 0 ? remainingWithInterest / termCount : 0;

      // Create receipt data
      const receiptDataForPrint = {
        id: Date.now(),
        createdAt: new Date().toISOString(),
        customer: {
          fullName: `${firstName} ${lastName}`.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.replace(/\s+/g, ''),
          passportSeries: passportSeries || undefined,
          jshshir: jshshir || undefined,
          address: deliveryAddress || undefined,
        },
        seller: currentUser,
        branch: branches.find((b) => b.id === Number(selectedBranchId)),
        items: selectedItems.map((item, index) => {
          const customPrice = priceInputValues[`${item.id}_${index}`];
          const displayPrice = customPrice ? Number(customPrice) : Number(item.marketPrice) * Number(exchangeRate);
          return {
            ...item,
            priceInSom: displayPrice,
          };
        }),
        paymentType,
        deliveryType,
        deliveryAddress,
        months: !isDays ? termCount : 0,
        days: isDays ? termCount : 0,
        termUnit: isDays ? 'DAYS' : 'MONTHS',
        interestRate: Number(interestRate),
        paid: upfrontPayment,
        remaining: remainingWithInterest,
        monthlyPayment: monthlyPayment,
        totalInSom: baseTotal,
        finalTotalInSom: finalTotal,
        exchangeRate,
        upfrontPaymentType: upfrontPaymentMethod,
      };

      setReceiptData(receiptDataForPrint);
      setReceiptPrinted(false);
      setShowReceiptModal(true);
      setShowCustomerSalesModal(false);
    } catch (error) {
    } finally {
      setSubmitting(false);
    }
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

      // Check custom price if available, otherwise check default price
      const customPrice = priceInputValues[`${item.id}_${index}`];
      if (customPrice) {
        if (isNaN(customPrice) || Number(customPrice) < 0) {
          newErrors[`price_${index}`] = "Нарх 0 дан катта ёки тенг бўлиши керак";
        }
      } else if (!item.marketPrice || isNaN(item.marketPrice) || Number(item.marketPrice) <= 0) {
        newErrors[`price_${index}`] = "Нарх 0 дан катта бўлиши керак";
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
      !deliveryAddress.trim()
    ) {
      newErrors.deliveryAddress = 'Manzil kiritilishi shart';
    }
    if (operationType === 'SALE' && (paymentType === 'CREDIT' || paymentType === 'INSTALLMENT')) {
      const isDays = paymentType === 'INSTALLMENT' && termUnit === 'DAYS';
      const termCount = isDays ? Number(daysCount) : Number(months);

      if (paymentType === 'INSTALLMENT' && termUnit === 'DAYS') {
        // For daily installments, validate days count
        if (
          !daysCount ||
          isNaN(daysCount) ||
          Number(daysCount) <= 0 ||
          !Number.isInteger(Number(daysCount)) ||
          Number(daysCount) > 365
        ) {
          newErrors.daysCount = 'Kunlar soni 1 dan 365 gacha butun son bo\'lishi kerak';
        }
      } else {
        // For monthly installments, validate months
        if (
          !months ||
          isNaN(months) ||
          Number(months) <= 0 ||
          !Number.isInteger(Number(months)) ||
          Number(months) > 24
        ) {
          newErrors.months = 'Oylar soni 1 dan 24 gacha butun son bo\'lishi kerak';
        }
      }

      if (!interestRate || isNaN(interestRate) || Number(interestRate) < 0) {
        newErrors.interestRate = "Foiz 0 dan katta yoki teng bo'lishi kerak";
      }

      // Only require passport and JSHSHIR for monthly installments, not daily ones
      if (!isDays) {
        if (!passportSeries.trim()) newErrors.passportSeries = 'Passport seriyasi kiritilishi shart';
        if (!jshshir.trim() || !/^\d{14,16}$/.test(jshshir))
          newErrors.jshshir = 'JSHSHIR 14-16 raqamdan iborat bo\'lishi kerak';
      }
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
      return;
    }

    const confirmMessage =
      operationType === 'TRANSFER'
        ? `Haqiqatan ham ${branches.find((b) => b.id === Number(selectedBranchId))?.name} filialidan ${branches.find((b) => b.id === Number(toBranch))?.name
        } filialiga ${selectedItems
          .map((item) => `${item.name} (${formatQuantity(item.quantity)})`)
          .join(', ')} ko'chirmoqchimisiz?`
        : `Haqiqatan ham ushbu mahsulotlarni mijozga sotmoqchimisiz?`;

    // if (!window.confirm(confirmMessage)) {
    //   return;
    // }

    setSubmitting(true);

    try {
      const userId = Number(localStorage.getItem('userId'));
      const baseTotal = selectedItems.reduce(
        (sum, item) => sum + Number(item.quantity) * Number(item.marketPrice) * Number(exchangeRate),
        0,
      );
      const isDays = paymentType === 'INSTALLMENT' && termUnit === 'DAYS';
      const termCount = isDays ? Number(daysCount) : Number(months);
      const interestRateValue = Number(interestRate) / 100 || 0;

      // Correct calculation logic: subtract upfront payment first, then calculate interest on remaining amount
      const upfrontPayment = Number(downPayment) || 0;
      const remainingPrincipal = Math.max(0, baseTotal - upfrontPayment);
      const interestAmount = remainingPrincipal * interestRateValue;
      const remainingWithInterest = remainingPrincipal + interestAmount;
      const finalTotal = upfrontPayment + remainingWithInterest;
      const monthlyPayment = termCount > 0 && remainingWithInterest > 0 ? remainingWithInterest / termCount : 0;

      if (operationType === 'TRANSFER') {
        const response = await axiosWithAuth({
          method: 'post',
          url: `${API_URL}/transactions/transfer`,
          data: {
            fromBranchId: Number(selectedBranchId),
            toBranchId: Number(toBranch),
            soldByUserId: userId,
            items: selectedItems.map((item) => ({
              productId: item.id,
              quantity: Number(item.quantity),
              price: Number(item.marketPrice) * Number(exchangeRate),
            })),
          },
        });

        const destinationBranchName = branches.find((b) => b.id === Number(toBranch))?.name;
        const sourceBranchName = branches.find((b) => b.id === Number(selectedBranchId))?.name;



        clearCart();
        setShowCartModal(false);
        await loadData();
        await loadTransferHistory();
      } else {
        const receiptDataForPrint = {
          id: Date.now(),
          createdAt: new Date().toISOString(),
          customer: {
            fullName: `${firstName} ${lastName}`.trim(),
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            phone: phone.replace(/\s+/g, ''),
            passportSeries: passportSeries || undefined,
            jshshir: jshshir || undefined,
            address: deliveryAddress || undefined,
          },
          seller: currentUser,
          branch: branches.find((b) => b.id === Number(selectedBranchId)),
          items: selectedItems.map(item => ({
            ...item,
            priceInSom: Number(item.marketPrice) * Number(exchangeRate), // Add priceInSom for receipt
          })),
          paymentType,
          deliveryType: paymentType === 'DELIVERY' ? 'DELIVERY' : 'PICKUP',
          deliveryAddress: deliveryAddress,
          months: !isDays ? termCount : 0,
          days: isDays ? termCount : 0,
          termUnit: isDays ? 'DAYS' : 'MONTHS',
          interestRate: Number(interestRate),
          paid: upfrontPayment,
          remaining: remainingWithInterest,
          monthlyPayment: monthlyPayment,
          totalInSom: baseTotal,
          finalTotalInSom: finalTotal,
          exchangeRate,
          upfrontPaymentType: upfrontPaymentMethod,
        };

        setPendingTransaction(null);
        setReceiptData(receiptDataForPrint);
        setReceiptPrinted(false);
        setShowReceiptModal(true);
        setShowCartModal(false);
      }
    } catch (err) {
    } finally {
      setSubmitting(false);
    }
  };

  const buildTransactionFromReceiptData = () => {
    if (!receiptData) return null;
    return {
      id: receiptData.id || 'N/A',
      createdAt: receiptData.createdAt || new Date(),
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
      total: receiptData.totalInSom,
      finalTotal: receiptData.finalTotalInSom,
      totalInSom: receiptData.totalInSom,
      finalTotalInSom: receiptData.finalTotalInSom,
      exchangeRate: receiptData.exchangeRate || 12500,
      paid: receiptData.paid || 0,
      remaining: receiptData.remaining || 0,
      interestRate: receiptData.interestRate || 0,
      months: receiptData.months || 0,
      monthlyPayment: receiptData.monthlyPayment || 0,
      items: receiptData.items.map((item) => ({
        name: item.name,
        quantity: Number(item.quantity),
        price: Number(item.marketPrice), // USD price for reference
        priceInSom: Number(item.priceInSom), // Price in so'm
      })),
      seller: {
        firstName: currentUser?.firstName || "Noma'lum",
        lastName: currentUser?.lastName || '',
      },
    };
  };

  const handleReceiptPrint = async () => {
    if (isPrinting) return; // Prevent multiple submissions

    const transaction = buildTransactionFromReceiptData();
    if (!transaction) return;

    setIsPrinting(true); // Start loading

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

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Aminov Savdo Tizimi</title>
          <style>
            @page { margin: 0; size: 80mm auto; }
            body { font-family: 'Arial', sans-serif; margin: 0; padding: 2%; width: 96%; font-size: 12px; line-height: 1.2; color: #000; }
            .header { text-align: center; margin-bottom: 5%; border-bottom: 1px dashed #000; padding-bottom: 3%; }
            .header h2 { margin: 0; font-size: 16px; font-weight: bold; color: #000; }
            .header p { margin: 2% 0 0 0; font-size: 11px; color: #000; }
            .info { margin-bottom: 4%; }
            .products { margin: 4% 0; border-top: 1px dashed #000; padding-top: 3%; }
            .products h4 { margin: 0 0 3% 0; font-size: 12px; font-weight: bold; text-align: center; color: #000; }
            .product-row { display: flex; justify-content: space-between; margin: 1% 0; font-size: 10px; border-bottom: 1px dotted #ccc; padding-bottom: 1%; color: #000; }
            .total { border-top: 1px dashed #000; padding-top: 3%; margin-top: 4%; }
            .total-row { display: flex; justify-content: space-between; margin: 2% 0; font-weight: bold; font-size: 12px; color: #000; }
            .footer { text-align: center; margin-top: 5%; padding-top: 3%; border-top: 1px dashed #000; font-size: 10px; color: #000; }
            @media print { body { margin: 0; padding: 1%; width: 98%; color: #000; } }
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
            <p class="total-row">${formatDateLocal(new Date())}</p>
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
            </div>` : ''}
            ${transaction.customer.jshshir ? `
            <div class="total-row">
              <span>JSHSHIR:</span>
              <span>${transaction.customer.jshshir}</span>
            </div>` : ''}
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
        .map((item) => `
              <div class="product-row">
                <span>${item.name} x${item.quantity}</span>
                <span>${formatCurrencySom(Number(item.quantity) * Number(item.priceInSom))}</span>
              </div>`)
        .join('')}
          </div>
          <div class="total">
            <div class="total-row">
              <span>JAMI:</span>
              <span>${formatCurrencySom(transaction.finalTotalInSom)}</span>
            </div>
            ${['CREDIT', 'INSTALLMENT'].includes(transaction.paymentType) ? `
              <div class="total-row">
                <span>To'langan:</span>
                <span>${formatCurrencySom(transaction.paid)}</span>
              </div>
              <div class="total-row">
                <span>Qolgan:</span>
                <span>${formatCurrencySom(transaction.remaining)}</span>
              </div>` : ''}
          </div>
           <div class="total-row">
                    <span>Telefon:</span>
                    <small>+998 98 800 66 66</small>
                  </div>
                </div>
                <div>
                  <p>Tashrifingiz uchun rahmat!</p>
                </div>
                <div class="footer">
                  <p>.</p>
                </div>
                
        </body>
      </html>`;

    const win = window.open('', '_blank');
    printWindowRef.current = win;
    win.document.write(html);
    win.document.close();
    win.focus();

    setTimeout(async () => {
      try {
        if (operationType === 'SALE') {
          // Get data from receiptData if available (customer sales modal), otherwise use form data (main cart modal)
          const baseTotal = receiptData ? receiptData.totalInSom : selectedItems.reduce((sum, item, index) => {
            const customPrice = priceInputValues[`${item.id}_${index}`];
            const displayPrice = customPrice ? Number(customPrice) : Number(item.marketPrice) * Number(exchangeRate);
            return sum + Number(item.quantity) * Number(displayPrice);
          }, 0);

          const isDays = receiptData ? receiptData.termUnit === 'DAYS' : (paymentType === 'INSTALLMENT' && termUnit === 'DAYS');
          const termCount = receiptData ? (receiptData.days || receiptData.months) : (isDays ? Number(daysCount) : Number(months));
          const interestRateValue = receiptData ? Number(receiptData.interestRate) / 100 : Number(interestRate) / 100;

          // Correct calculation logic: subtract upfront payment first, then calculate interest on remaining amount
          const upfrontPayment = receiptData ? Number(receiptData.paid) : Number(downPayment) || 0;
          const remainingPrincipal = Math.max(0, baseTotal - upfrontPayment);
          const interestAmount = remainingPrincipal * interestRateValue;
          const remainingWithInterest = remainingPrincipal + interestAmount;
          const finalTotal = upfrontPayment + remainingWithInterest;
          const monthlyPayment = termCount > 0 && remainingWithInterest > 0 ? remainingWithInterest / termCount : 0;

          const somTotal = baseTotal;
          const somFinalTotal = finalTotal;
          const somPaid = upfrontPayment;
          const somRemaining = remainingWithInterest;

          const payload = {
            type: 'SALE',
            status: 'PENDING',
            total: somTotal,
            finalTotal: somFinalTotal,
            downPayment: somPaid, // Upfront payment
            amountPaid: somPaid, // Amount already paid
            userId: Number(localStorage.getItem('userId')),
            remainingBalance: somRemaining,
            paymentType: receiptData ? receiptData.paymentType : (paymentType === 'INSTALLMENT' ? 'CREDIT' : paymentType),
            deliveryType: receiptData ? receiptData.deliveryType : (paymentType === 'DELIVERY' ? 'DELIVERY' : 'PICKUP'),
            deliveryAddress:
              receiptData ? receiptData.deliveryAddress : (
                (paymentType === 'CREDIT' || paymentType === 'INSTALLMENT' || paymentType === 'DELIVERY')
                  ? deliveryAddress || undefined
                  : undefined
              ),
            upfrontPaymentType: receiptData ? receiptData.upfrontPaymentType : upfrontPaymentMethod,
            termUnit: isDays ? 'DAYS' : 'MONTHS', // Add term unit
            customer: {
              fullName: receiptData ? receiptData.customer.fullName : `${firstName} ${lastName}`.trim(),
              phone: receiptData ? receiptData.customer.phone : phone.replace(/\s+/g, ''),
              passportSeries: receiptData ? receiptData.customer.passportSeries : passportSeries || undefined,
              jshshir: receiptData ? receiptData.customer.jshshir : jshshir || undefined,
              address: receiptData ? receiptData.customer.address : deliveryAddress || undefined,
            },
            fromBranchId: Number(selectedBranchId),
            soldByUserId: Number(localStorage.getItem('userId')),
            items: receiptData ? receiptData.items.map(item => ({
              productId: item.id,
              productName: item.name,
              quantity: Number(item.quantity),
              price: Number(item.priceInSom),
              total: Number(item.quantity) * Number(item.priceInSom),
              ...(receiptData.paymentType === 'CREDIT' || receiptData.paymentType === 'INSTALLMENT'
                ? {
                  creditMonth: termCount,
                  creditPercent: interestRateValue,
                  monthlyPayment: monthlyPayment,
                  termUnit: isDays ? 'DAYS' : 'MONTHS'
                }
                : {}),
            })) : selectedItems.map((item, index) => {
              const customPrice = priceInputValues[`${item.id}_${index}`];
              const displayPrice = customPrice ? Number(customPrice) : Number(item.marketPrice) * Number(exchangeRate);
              return {
                productId: item.id,
                productName: item.name,
                quantity: Number(item.quantity),
                price: displayPrice,
                total: Number(item.quantity) * displayPrice,
                ...(paymentType === 'CREDIT' || paymentType === 'INSTALLMENT'
                  ? {
                    creditMonth: termCount,
                    creditPercent: interestRateValue,
                    monthlyPayment: monthlyPayment,
                    termUnit: isDays ? 'DAYS' : 'MONTHS'
                  }
                  : {}),
              };
            }),
          };

          // Debug log the payload being sent to backend
          console.log('Sending to backend:', payload);

          const response = await axiosWithAuth({
            method: 'post',
            url: `${API_URL}/transactions`,
            data: payload,
          });

          setPendingTransaction(response.data);
        }

        win.print();
        setReceiptPrinted(true);
        setTimeout(() => {
          win.close();
          resetToInitialState();
          completeSale();
          setIsPrinting(false); // Reset loading state
        }, 1000);
      } catch (err) {
        win.close();
        resetToInitialState();
        setIsPrinting(false); // Reset loading state on error
      }
    }, 500);

    win.onafterprint = () => {
      win.close();
      resetToInitialState();
      completeSale();
      setIsPrinting(false); // Reset loading state
    };
  };

  const resetToInitialState = async () => {
    setShowReceiptModal(false);
    setShowCartModal(false);
    setShowTransferHistory(false);
    setReceiptData(null);
    setReceiptPrinted(false);
    setPendingTransaction(null);
    setIsPrinting(false);
    clearCart();
    await loadData();
    await loadTransferHistory();
  };

  const completeSale = async () => {
    if (!receiptPrinted || !pendingTransaction) {
      return;
    }

    try {
      await axiosWithAuth({
        method: 'patch',
        url: `${API_URL}/transactions/${pendingTransaction.id}`,
        data: { status: 'COMPLETED' },
      });
    } catch (error) {
    }
  };

  const closeReceiptModal = async () => {
    if (!receiptPrinted && operationType === 'SALE') {
      // if (!window.confirm('Chek chop etilmadi! Cheksiz yopsangiz sotish bekor bo\'ladi. Davom etasizmi?')) {
      //   return;
      // }
      if (pendingTransaction) {
        try {
          await axiosWithAuth({
            method: 'delete',
            url: `${API_URL}/transactions/${pendingTransaction.id}`,
          });
        } catch (error) {
        }
      }
    }

    if (printWindowRef.current && !printWindowRef.current.closed) {
      printWindowRef.current.close();
    }
    printWindowRef.current = null;
    setIsPrinting(false); // Reset loading state
    await resetToInitialState();
  };

  const calculatePaymentSchedule = () => {
    const isDays = paymentType === 'INSTALLMENT' && termUnit === 'DAYS';
    const termCount = isDays ? Number(daysCount) : Number(months);
    const rate = Number(interestRate) / 100 || 0;
    if (!termCount || termCount <= 0 || selectedItems.length === 0) return { totalWithInterest: 0, monthlyPayment: 0, schedule: [], change: 0, remaining: 0, baseTotal: 0, upfrontPayment: 0, remainingPrincipal: 0, interestAmount: 0, remainingWithInterest: 0, isDays: false, termCount: 0 };

    // Calculate base total using custom prices from modal if available, otherwise use default prices
    const baseTotal = selectedItems.reduce((sum, item, index) => {
      const customPrice = priceInputValues[`${item.id}_${index}`];
      const displayPrice = customPrice ? Number(customPrice) : Number(item.marketPrice) * Number(exchangeRate);
      return sum + Number(item.quantity) * Number(displayPrice);
    }, 0);

    // Use the correct upfront payment field based on which modal is active
    // For customer sales modal, use customerPaid; for main cart modal, use downPayment
    const upfrontPayment = Number(customerPaid) || Number(downPayment) || 0;  // Mijoz oldindan to'lagan pul
    const remainingPrincipal = Math.max(0, baseTotal - upfrontPayment);  // Asosiy puldan oldindan to'lagan pulni ayirish
    const interestAmount = remainingPrincipal * rate;                    // Qolgan pulga foiz qo'yish
    const remainingWithInterest = remainingPrincipal + interestAmount;   // Qolgan + foiz
    const totalWithInterest = upfrontPayment + remainingWithInterest;    // Oldindan to'lov + qolgan (foiz bilan)
    const change = upfrontPayment > baseTotal ? upfrontPayment - baseTotal : 0; // Qaytim (agar oldindan to'lov asosiy summani oshirsa)

    let periodicPayment, schedule;

    if (isDays) {
      // Kunlik bo'lib to'lash uchun: mijoz kunlar ichida qolgan summani to'lab ketishi kerak
      // Faqat 1 ta to'lov yaratiladi, lekin mijoz bu kunlar ichida to'lab ketishi kerak
      periodicPayment = remainingWithInterest; // To'liq qolgan summa
      schedule = [{
        month: 1,
        payment: remainingWithInterest,
        remainingBalance: 0,
        isDailyInstallment: true,
        daysCount: termCount,
        dueDate: new Date(Date.now() + termCount * 24 * 60 * 60 * 1000) // Kunlar soni keyin to'lov muddati
      }];
    } else {
      // Oylik bo'lib to'lash uchun: har oy uchun alohida to'lov
      periodicPayment = termCount > 0 && remainingWithInterest > 0 ? remainingWithInterest / termCount : 0;
      schedule = [];
      let remainingBalance = remainingWithInterest;
      for (let i = 1; i <= termCount; i++) {
        schedule.push({
          month: i,
          payment: periodicPayment,
          remainingBalance: Math.max(0, remainingBalance - periodicPayment),
        });
        remainingBalance -= periodicPayment;
      }
    }

    return {
      totalWithInterest,
      monthlyPayment: periodicPayment, // Oylik yoki kunlik to'lov
      schedule,
      change,
      remaining: remainingWithInterest,
      baseTotal,
      upfrontPayment,
      remainingPrincipal,
      interestAmount,
      isDays,
      termCount
    };
  };

  useEffect(() => {
    if (!isOmbor) {
      setOperationType('TRANSFER');
      setSelectedItems([]);
    }
  }, [isOmbor]);

  const paymentSchedule = calculatePaymentSchedule();
  const { totalWithInterest, monthlyPayment, schedule, change, remaining } = paymentSchedule;

  // Debug logging for payment calculations
  useEffect(() => {
    if (['CREDIT', 'INSTALLMENT'].includes(paymentType) && paymentSchedule.baseTotal > 0) {
    }
  }, [paymentType, paymentSchedule]);

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Чиқим</h1>



      <div className="flex items-center gap-4 mb-4">
        <div className="w-full max-w-xs">
          <select
            value={selectedBranchId}
            onChange={(e) => handleBranchChange(e.target.value)}
            className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 border-gray-300"
          >
            <option value="">Filialni tanlang</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </div>
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
          </div>

          <div className="overflow-x-auto bg-white rounded-lg shadow">
            <table className="w-full border">
              <thead>
                <tr className="bg-gray-100 text-left">
                  <th className="p-3">ID</th>
                  <th className="p-3">Номи</th>
                  <th className="p-3">Модел</th>
                  <th className="p-3">Баркод</th>
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
                      <td className="p-3">{product.barcode || 'N/A'}</td>
                      <td className="p-3">{product.branch?.name || "Noma'lum"}</td>
                      <td className="p-3">{formatCurrency(product.marketPrice)}</td>
                      <td className="p-3">{formatCurrencySom(product.marketPrice * exchangeRate)}</td>
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
                            <th className="p-3 text-left font-medium">№</th>
                            <th className="p-3 text-left font-medium">Маҳсулот</th>
                            <th className="p-3 text-left font-medium">Нарх (сўм)</th>
                            <th className="p-3 text-left font-medium">Миқдор</th>
                            <th className="p-3 text-left font-medium">Жами</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedItems.map((item, index) => (
                            <tr key={index} className="border-t border-gray-200">
                              <td className="p-3">{index + 1}</td>
                              <td className="p-3">{item.name}</td>
                              <td className="p-3">
                                <div className="space-y-2">
                                  <input
                                    type="text"
                                    value={Math.round(Number(item.marketPrice) * Number(exchangeRate)) || ''}
                                    onChange={(e) => onPriceSomChangeDirect(index, e)}
                                    className={`w-24 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors[`price_${index}`] ? 'border-red-500' : 'border-gray-300'
                                      }`}
                                    placeholder="0"
                                  />
                                  <div className="text-xs text-gray-500">
                                    {Math.round(Number(item.marketPrice))} USD
                                  </div>
                                  {errors[`price_${index}`] && (
                                    <span className="text-red-500 text-xs">{errors[`price_${index}`]}</span>
                                  )}
                                </div>
                              </td>
                              <td className="p-3">
                                <input
                                  type="number"
                                  value={item.quantity}
                                  onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                                  className={`w-20 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors[`quantity_${index}`] ? 'border-red-500' : 'border-gray-300'
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
                                {formatCurrencySom(Number(item.quantity) * Number(item.marketPrice) * Number(exchangeRate))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                      <div className="flex justify-between text-lg font-semibold">
                        <span>Жами:</span>
                        <span>
                          {formatCurrencySom(
                            selectedItems.reduce(
                              (sum, item) => sum + Number(item.quantity) * Number(item.marketPrice) * Number(exchangeRate),
                              0,
                            ),
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Амал тури</label>
                      <div className="flex gap-2">
                        <select
                          value={operationType}
                          onChange={(e) => setOperationType(e.target.value)}
                          className="flex-1 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 border-gray-300"
                          disabled={!isOmbor}
                        >
                          <option value="SALE">Мижозга сотиш</option>
                          <option value="TRANSFER">Филиалга ўтказиш</option>
                        </select>

                      </div>
                    </div>

                    {operationType === 'TRANSFER' && (
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Қабул қилувчи филиал</label>
                        <select
                          value={toBranch}
                          onChange={(e) => setToBranch(e.target.value)}
                          className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.toBranch ? 'border-red-500' : 'border-gray-300'
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
                                    className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.firstName ? 'border-red-500' : 'border-gray-300'
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
                                    className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.lastName ? 'border-red-500' : 'border-gray-300'
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
                                    className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.phone ? 'border-red-500' : 'border-gray-300'
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
                                  value={deliveryAddress}
                                  onChange={(e) => setDeliveryAddress(e.target.value)}
                                  placeholder="Тўлиқ манзилни киритинг..."
                                  className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.deliveryAddress ? 'border-red-500' : 'border-gray-300'
                                    }`}
                                  rows="3"
                                />
                                {errors.deliveryAddress && (
                                  <span className="text-red-500 text-xs">{errors.deliveryAddress}</span>
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
                                className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.paymentType ? 'border-red-500' : 'border-gray-300'
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
                                {paymentType === 'INSTALLMENT' && (
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Муддат бирлиги</label>
                                    <select
                                      value={termUnit}
                                      onChange={(e) => setTermUnit(e.target.value)}
                                      className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 border-gray-300"
                                    >
                                      <option value="MONTHS">Ой</option>
                                      <option value="DAYS">Кун</option>
                                    </select>
                                  </div>
                                )}
                                {paymentType === 'INSTALLMENT' && termUnit === 'DAYS' ? (
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Кунлар сони</label>
                                    <input
                                      type="number"
                                      value={daysCount}
                                      onChange={(e) => setDaysCount(e.target.value)}
                                      className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.daysCount ? 'border-red-500' : 'border-gray-300'}`}
                                      min="1"
                                      max="365"
                                      step="1"
                                      placeholder="0"
                                    />
                                    {errors.daysCount && <span className="text-red-500 text-xs">{errors.daysCount}</span>}
                                  </div>
                                ) : (
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
                                        className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.passportSeries ? 'border-red-500' : 'border-gray-300'
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
                                        className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.jshshir ? 'border-red-500' : 'border-gray-300'
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
                                        className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.months ? 'border-red-500' : 'border-gray-300'
                                          }`}
                                        min="1"
                                        max="24"
                                        step="1"
                                      />
                                      {errors.months && (
                                        <span className="text-red-500 text-xs">{errors.months}</span>
                                      )}
                                    </div>
                                  </>
                                )}
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">Фоиз (%)</label>
                                  <input
                                    type="number"
                                    value={interestRate}
                                    onChange={(e) => setInterestRate(e.target.value)}
                                    className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.interestRate ? 'border-red-500' : 'border-gray-300'
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
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Олдиндан тўлов тури
                                  </label>
                                  <div className="flex gap-4">
                                    <label className="flex items-center">
                                      <input
                                        type="radio"
                                        name="downPaymentMethod"
                                        value="CASH"
                                        checked={upfrontPaymentMethod === 'CASH'}
                                        onChange={(e) => setUpfrontPaymentMethod(e.target.value)}
                                        className="mr-2 text-blue-600 focus:ring-blue-500"
                                      />
                                      <span className="text-sm text-gray-700">Нақд</span>
                                    </label>
                                    <label className="flex items-center">
                                      <input
                                        type="radio"
                                        name="downPaymentMethod"
                                        value="CARD"
                                        checked={upfrontPaymentMethod === 'CARD'}
                                        onChange={(e) => setUpfrontPaymentMethod(e.target.value)}
                                        className="mr-2 text-blue-600 focus:ring-blue-500"
                                      />
                                      <span className="text-sm text-gray-700">Карта</span>
                                    </label>
                                  </div>
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                          <div className="bg-white p-3 rounded border">
                            <div className="text-gray-600 text-xs mb-1">Асосий сумма:</div>
                            <div className="font-medium text-blue-600 break-words text-sm">
                              {formatCurrencySom(
                                selectedItems.reduce(
                                  (sum, item) => sum + Number(item.quantity) * Number(item.marketPrice) * Number(exchangeRate),
                                  0,
                                ),
                              )}
                            </div>
                          </div>
                          {['CREDIT', 'INSTALLMENT'].includes(paymentType) && (
                            <>
                              <div className="bg-white p-3 rounded border">
                                <div className="text-gray-600 text-xs mb-1">Олдиндан тўлов:</div>
                                <div className="font-medium text-purple-600 break-words text-sm">
                                  {formatCurrencySom(Number(downPayment) || 0)}
                                </div>
                              </div>
                              <div className="bg-white p-3 rounded border">
                                <div className="text-gray-600 text-xs mb-1">Қолган (фоиз билан):</div>
                                <div className="font-medium text-red-600 break-words text-sm">
                                  {formatCurrencySom(remaining)}
                                </div>
                              </div>
                              <div className="bg-white p-3 rounded border">
                                <div className="text-gray-600 text-xs mb-1">Умумий (фоиз билан):</div>
                                <div className="font-medium text-green-600 break-words text-sm">
                                  {formatCurrencySom(totalWithInterest)}
                                </div>
                              </div>
                              <div className="bg-white p-3 rounded border">
                                <div className="text-gray-600 text-xs mb-1">
                                  {calculatePaymentSchedule().isDays ? 'Кунлик тўлов (1 та тўлов):' : 'Ойлик тўлов:'}
                                </div>
                                <div className="font-medium text-blue-600 break-words text-sm">
                                  {formatCurrencySom(calculatePaymentSchedule().monthlyPayment)}
                                </div>
                                {calculatePaymentSchedule().isDays && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    {calculatePaymentSchedule().termCount} кун ичида тўлаш керак (1 та тўлов)
                                  </div>
                                )}
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
                        {submitting ? 'Юкланмоқда...' : 'Сотишни амалга ошириш'}
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

          {showReceiptModal && receiptData && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg shadow-xl w-[90%] max-w-md mx-auto">
                <div className="p-4 border-b">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold text-red-600">⚠️ Чекни чоп етиш мажбурий!</h3>
                    <button
                      onClick={closeReceiptModal}
                      className="text-gray-600 hover:text-gray-800 transition-all"
                    >
                      X
                    </button>
                  </div>
                  <p className="text-sm text-red-600 mt-1">Чекни чоп етмасангиз сотиш беқор бўлади</p>
                </div>

                <Receipt
                  transaction={{
                    ...buildTransactionFromReceiptData(),
                    items: receiptData.items.map((item) => ({
                      ...item,
                      price: Number(item.priceInSom), // Use price in so'm for display
                      priceInSom: Number(item.priceInSom),
                    })),
                    total: receiptData.totalInSom,
                    finalTotal: receiptData.finalTotalInSom,
                    totalInSom: receiptData.totalInSom,
                    finalTotalInSom: receiptData.finalTotalInSom,
                    paid: receiptData.paid,
                    remaining: receiptData.remaining,
                    monthlyPayment: receiptData.monthlyPayment,
                  }}
                  onClose={closeReceiptModal}
                  onPrint={handleReceiptPrint}
                  showPrintWarning={true}
                />

                <div className="p-4 border-t bg-yellow-50">
                  <button
                    onClick={handleReceiptPrint}
                    disabled={isPrinting}
                    className={`w-full py-3 px-4 rounded-lg transition-colors font-medium ${isPrinting
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                      }`}
                  >
                    {isPrinting ? (
                      <>
                        <div className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                        Юкланмоқда...
                      </>
                    ) : (
                      '🖨️ Чекни чоп етиш ва сотишни якунлаш'
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Customer Sales Modal */}
          {showCustomerSalesModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-xl">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-gray-800">Мижозга сотиш</h3>
                  <button
                    onClick={closeCustomerSalesModal}
                    className="text-gray-600 hover:text-gray-800 font-bold text-xl"
                  >
                    &times;
                  </button>
                </div>

                <div className="overflow-x-auto mb-6">
                  <table className="w-full border border-gray-200">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="p-3 text-left font-medium">Маҳсулот</th>
                        <th className="p-3 text-left font-medium">Нарх (сом)</th>
                        <th className="p-3 text-left font-medium">Миқдор</th>
                        <th className="p-3 text-left font-medium">Жами</th>
                        <th className="p-3 text-left font-medium">Амаллар</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedItems.map((item, index) => (
                        <tr key={index} className="border-t border-gray-200">
                          <td className="p-3">{item.name}</td>
                          <td className="p-3">
                            <input
                              type="number"
                              value={priceInputValues[`${item.id}_${index}`] || Math.round(Number(item.marketPrice) * Number(exchangeRate))}
                              onChange={(e) => {
                                const inputValue = e.target.value;
                                const itemKey = `${item.id}_${index}`;
                                setPriceInputValues(prev => ({
                                  ...prev,
                                  [itemKey]: inputValue
                                }));
                              }}
                              className={`w-40 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors[`price_${index}`] ? 'border-red-500' : 'border-gray-300'}`}
                              min="0"
                              step="1"
                              placeholder="Нарх (сом)"
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
                              className={`w-24 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors[`quantity_${index}`] ? 'border-red-500' : 'border-gray-300'}`}
                              min="1"
                              max={item.maxQuantity}
                              step="0"
                              placeholder="0"
                            />
                            {errors[`quantity_${index}`] && (
                              <span className="text-red-500 text-xs">{errors[`quantity_${index}`]}</span>
                            )}
                          </td>
                          <td className="p-3 font-medium">
                            {(() => {
                              const displayPrice = priceInputValues[`${item.id}_${index}`] || Number(item.priceInSom);
                              const quantity = Number(item.quantity);
                              const total = quantity * Number(displayPrice);
                              return new Intl.NumberFormat('uz-UZ').format(total) + ' сом';
                            })()}
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-md font-semibold mb-3">Мижоз маълумотлари</h4>
                    <div className="space-y-3">
                      {(paymentType === 'DELIVERY' || ['CREDIT', 'INSTALLMENT'].includes(paymentType)) && (
                        <>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Исм</label>
                            <input
                              value={firstName}
                              onChange={(e) => setFirstName(e.target.value)}
                              className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.firstName ? 'border-red-500' : 'border-gray-300'}`}
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
                              className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.lastName ? 'border-red-500' : 'border-gray-300'}`}
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
                              className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.phone ? 'border-red-500' : 'border-gray-300'}`}
                            />
                            {errors.phone && (
                              <span className="text-red-500 text-xs">{errors.phone}</span>
                            )}
                          </div>
                        </>
                      )}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Етказиб бериш тури</label>
                        <select
                          value={deliveryType}
                          onChange={(e) => setDeliveryType(e.target.value)}
                          className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 border-gray-300"
                        >
                          <option value="PICKUP">Олиб кетиш</option>
                          <option value="DELIVERY">Етказиб бериш</option>
                        </select>
                      </div>
                      {(deliveryType === 'DELIVERY' || ['CREDIT', 'INSTALLMENT'].includes(paymentType)) && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Манзил</label>
                          <textarea
                            value={deliveryAddress}
                            onChange={(e) => setDeliveryAddress(e.target.value)}
                            placeholder="Тўлиқ манзилни киритинг..."
                            className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.deliveryAddress ? 'border-red-500' : 'border-gray-300'}`}
                            rows="3"
                          />
                          {errors.deliveryAddress && (
                            <span className="text-red-500 text-xs">{errors.deliveryAddress}</span>
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
                          className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.paymentType ? 'border-red-500' : 'border-gray-300'}`}
                        >
                          <option value="">Танланг</option>
                          <option value="CASH">Нақд</option>
                          <option value="CARD">Карта</option>
                          <option value="CREDIT">Кредит</option>
                          <option value="INSTALLMENT">Бўлиб Тўлаш</option>
                        </select>
                        {errors.paymentType && <span className="text-red-500 text-xs">{errors.paymentType}</span>}
                      </div>
                      {['CREDIT', 'INSTALLMENT'].includes(paymentType) && (
                        <>
                          {paymentType === 'INSTALLMENT' && (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Муддат бирлиги</label>
                              <select
                                value={termUnit}
                                onChange={(e) => setTermUnit(e.target.value)}
                                className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 border-gray-300"
                              >
                                <option value="MONTHS">Ой</option>
                                <option value="DAYS">Кун</option>
                              </select>
                            </div>
                          )}
                          {paymentType === 'INSTALLMENT' && termUnit === 'DAYS' ? (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Кунлар сони</label>
                              <input
                                type="number"
                                value={daysCount}
                                onChange={(e) => setDaysCount(e.target.value)}
                                className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.daysCount ? 'border-red-500' : 'border-gray-300'}`}
                                min="1"
                                max="365"
                                step="1"
                                placeholder="0"
                              />
                              {errors.daysCount && <span className="text-red-500 text-xs">{errors.daysCount}</span>}
                            </div>
                          ) : (
                            <>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Паспорт серияси</label>
                                <input
                                  type="text"
                                  value={passportSeries}
                                  onChange={(e) => setPassportSeries(e.target.value)}
                                  placeholder="AA 1234567"
                                  className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.passportSeries ? 'border-red-500' : 'border-gray-300'}`}
                                />
                                {errors.passportSeries && <span className="text-red-500 text-xs">{errors.passportSeries}</span>}
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">JSHSHIR</label>
                                <input
                                  type="text"
                                  value={passportSeries}
                                  onChange={(e) => setJshshir(e.target.value)}
                                  placeholder="1234567890123456"
                                  className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.jshshir ? 'border-red-500' : 'border-gray-300'}`}
                                  maxLength={16}
                                />
                                {errors.jshshir && <span className="text-red-500 text-xs">{errors.jshshir}</span>}
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Ойлар сони</label>
                                <input
                                  type="number"
                                  value={months}
                                  onChange={(e) => setMonths(e.target.value)}
                                  className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.months ? 'border-red-500' : 'border-gray-300'}`}
                                  min="1"
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
                                  className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.interestRate ? 'border-red-500' : 'border-gray-300'}`}
                                  step="0.01"
                                  min="0"
                                />
                                {errors.interestRate && <span className="text-red-500 text-xs">{errors.interestRate}</span>}
                              </div>
                            </>
                          )}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Мижоз тўлаган (сом)</label>
                            <input
                              type="number"
                              value={customerPaid}
                              onChange={(e) => setCustomerPaid(e.target.value)}
                              className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.customerPaid ? 'border-red-500' : 'border-gray-300'}`}
                              step="1"
                              min="0"
                              placeholder="0"
                            />
                            {errors.customerPaid && <span className="text-red-500 text-xs">{errors.customerPaid}</span>}
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Олдиндан тўлов тури</label>
                            <div className="flex gap-4">
                              <label className="flex items-center">
                                <input
                                  type="radio"
                                  name="upfrontPaymentType"
                                  value="CASH"
                                  checked={upfrontPaymentMethod === 'CASH'}
                                  onChange={(e) => setUpfrontPaymentMethod(e.target.value)}
                                  className="mr-2 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm font-medium text-gray-700">Нақд</span>
                              </label>
                              <label className="flex items-center">
                                <input
                                  type="radio"
                                  name="upfrontPaymentType"
                                  value="CARD"
                                  checked={upfrontPaymentMethod === 'CARD'}
                                  onChange={(e) => setUpfrontPaymentMethod(e.target.value)}
                                  className="mr-2 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm font-medium text-gray-700">Карта</span>
                              </label>
                            </div>
                            {errors.upfrontPaymentType && (
                              <span className="text-red-500 text-xs">{errors.upfrontPaymentType}</span>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <h4 className="text-md font-semibold mb-3">Жами</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                    <div className="bg-white p-3 rounded border">
                      <div className="text-gray-600 text-xs mb-1">Асосий сумма:</div>
                      <div className="font-medium text-blue-600 break-words text-sm">{(() => {
                        let total = 0;
                        selectedItems.forEach((item, index) => {
                          const displayPrice = priceInputValues[`${item.id}_${index}`] || Math.round(Number(item.marketPrice) * Number(exchangeRate));
                          const quantity = Number(item.quantity);
                          total += quantity * Number(displayPrice);
                        });
                        return new Intl.NumberFormat('uz-UZ').format(total) + ' сом';
                      })()}</div>
                    </div>
                    {['CREDIT', 'INSTALLMENT'].includes(paymentType) && (
                      <>
                        <div className="bg-white p-3 rounded border">
                          <div className="text-gray-600 text-xs mb-1">Олдиндан тўлов:</div>
                          <div className="font-medium text-purple-600 break-words text-sm">{new Intl.NumberFormat('uz-UZ').format((Number(customerPaid) || 0))} сом</div>
                        </div>
                        <div className="bg-white p-3 rounded border">
                          <div className="text-gray-600 text-xs mb-1">Қолган (фоиз билан):</div>
                          <div className="font-medium text-red-600 break-words text-sm">{new Intl.NumberFormat('uz-UZ').format(calculatePaymentSchedule().remaining)} сом</div>
                        </div>
                        <div className="bg-white p-3 rounded border">
                          <div className="text-gray-600 text-xs mb-1">Умумий (фоиз билан):</div>
                          <div className="font-medium text-green-600 break-words text-sm">{new Intl.NumberFormat('uz-UZ').format(calculatePaymentSchedule().totalWithInterest)} сом</div>
                        </div>
                        <div className="bg-white p-3 rounded border">
                          <div className="text-gray-600 text-xs mb-1">
                            {calculatePaymentSchedule().isDays ? 'Кунлик тўлов (1 та тўлов):' : 'Ойлик тўлов:'}
                          </div>
                          <div className="font-medium text-blue-600 break-words text-sm">
                            {new Intl.NumberFormat('uz-UZ').format(calculatePaymentSchedule().monthlyPayment)} сом
                          </div>
                          {calculatePaymentSchedule().isDays && (
                            <div className="text-xs text-gray-500 mt-1">
                              {calculatePaymentSchedule().daysCount} кун ичида тўлаш керак (1 та тўлов)
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="mt-6 flex gap-3">
                  <button
                    onClick={processCustomerSale}
                    disabled={submitting}
                    className="flex-1 bg-blue-500 text-white p-3 rounded-lg hover:bg-blue-600 disabled:bg-gray-400 transition-colors font-medium"
                  >
                    {submitting ? 'Юкланмоқда...' : 'Сотишни амалга ошириш'}
                  </button>
                  <button
                    onClick={closeCustomerSalesModal}
                    className="flex-1 bg-gray-200 text-gray-700 p-3 rounded-lg hover:bg-gray-300 transition-colors"
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

export default Chiqim;