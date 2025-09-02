import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Receipt from './Receipt/Receipt';
import { formatAmount, formatCurrency } from '../../utils/currencyFormat';

const SalesManagement = () => {
  const [products, setProducts] = useState([]);
  const [branches, setBranches] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);

  const [selectedBranch, setSelectedBranch] = useState('');
  const [paymentType, setPaymentType] = useState('CASH');
  const [deliveryType, setDeliveryType] = useState('PICKUP');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [jshshir, setJshshir] = useState('');
  const [passportSeries, setPassportSeries] = useState('');
  const [downPayment, setDownPayment] = useState('');
  const [customerPaid, setCustomerPaid] = useState('0');
  const [upfrontPaymentType, setUpfrontPaymentType] = useState('CASH'); // CASH | CARD
  const [months, setMonths] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [termUnit, setTermUnit] = useState('DAYS'); // MONTHS | DAYS
  const [daysCount, setDaysCount] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [notification, setNotification] = useState(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [showSelectedItemsModal, setShowSelectedItemsModal] = useState(false);
  const [originalQuantities, setOriginalQuantities] = useState({});
  const [deliveryAddress, setDeliveryAddress] = useState(''); // Yangi state qo'shish
  const [priceInputValues, setPriceInputValues] = useState({}); // Store display values for price inputs
  const [exchangeRate, setExchangeRate] = useState(12500); // Default exchange rate USD to UZS

  // Multiple customers feature
  const [showMultipleCustomersModal, setShowMultipleCustomersModal] = useState(false);
  const [customerCount, setCustomerCount] = useState(1);
  const [customers, setCustomers] = useState([]);
  const [currentCustomerIndex, setCurrentCustomerIndex] = useState(0);
  const navigate = useNavigate();





  const API_URL = 'https://suddocs.uz';





  const formatQuantity = (qty) => (qty >= 0 ? new Intl.NumberFormat('uz-UZ').format(qty) + ' дона' : '0 дона');

  const formatDate = (date) =>
    date ? new Date(date).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' }) : 'Номаълум';

  const calculatePaymentSchedule = () => {
    const isDays = paymentType === 'INSTALLMENT' && termUnit === 'DAYS';
    const termCount = isDays ? Number(daysCount) : Number(months);
    const rate = Number(interestRate) / 100 || 0;
    if (!termCount || termCount <= 0 || selectedItems.length === 0) return { totalWithInterest: 0, monthlyPayment: 0, schedule: [], change: 0, remaining: 0 };

    // Calculate base total in som using display prices
    const baseTotal = selectedItems.reduce((sum, item, index) => {
      const displayPrice = priceInputValues[`${item.id}_${index}`] || item.price;
      return sum + Number(item.quantity) * Number(displayPrice);
    }, 0);

    const upfrontPayment = Number(customerPaid) || 0;                    // Mijoz oldindan to'lagan pul
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
        // For the last month, use the exact remaining balance to avoid floating point errors
        const currentPayment = i === termCount ? remainingBalance : periodicPayment;
        schedule.push({
          month: i,
          payment: currentPayment,
          remainingBalance: Math.max(0, remainingBalance - currentPayment),
        });
        remainingBalance -= currentPayment;
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

  const generatePDF = () => {
    if (selectedItems.length === 0) return;
    const m = Number(months);
    const { totalWithInterest, monthlyPayment, schedule, change, remaining } = calculatePaymentSchedule();
    const branchName = branches.find((b) => b.id === Number(selectedBranch))?.name || 'Нома\'лум';
    const seller = users.find((u) => u.id === Number(selectedUserId));
    const sellerName = seller ? `${seller.firstName} ${seller.lastName}` : 'Нома\'лум';
    const date = formatDate(new Date());

    const escapeLatex = (str) => {
      if (!str) return 'Нома\'лум';
      return str
        .replace(/[&%$#_{}~^\\]/g, '\\$&')
        .replace(/ā/g, '\\=a')
        .replace(/ū/g, '\\=u');
    };

    const productList = selectedItems
      .map((item) => `${escapeLatex(item.name)} (${formatQuantity(item.quantity)}, ${formatAmount(item.price)})`)
      .join(', ');

    const latexContent = `
\\documentclass[a4paper,12pt]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[russian,uzbek]{babel}
\\usepackage{geometry}
\\usepackage{booktabs}
\\usepackage{noto}
\\geometry{a4paper,margin=2cm}
\\begin{document}

\\begin{center}
  \\textbf{To'lov Jadvali (Kredit yoki Bo'lib To'lash)}\\\\
  \\vspace{0.5cm}
  Mahsulotlar: ${productList}\\\\
  Filial: ${escapeLatex(branchName)}\\\\
  Sotuvchi: ${escapeLatex(sellerName)}\\\\
  Sana: ${escapeLatex(date)}\\\\
  To'lov Turi: ${paymentType === 'CREDIT' ? 'Kredit' : paymentType === 'INSTALLMENT' ? "Bo'lib To'lash" : paymentType}\\\\
  Yetkazib berish: ${paymentType === 'DELIVERY' ? 'Yetkazib berish' : 'Olib ketish'}\\\\
  Muddat: ${m} oy\\\\
  Foiz: ${Number(interestRate).toFixed(2)}\\%\\\\
  Umumiy Summa (foiz bilan): ${formatAmount(totalWithInterest)}\\\\
  Mijoz to'lagan: ${formatAmount(Number(downPayment))}\\\\
  Qaytim: ${formatAmount(change)}\\\\
  Qolgan summa: ${formatAmount(remaining)}\\\\
  ${isDays ? 'Kunlik to\'lov (1 ta to\'lov):' : 'Oylik To\'lov:'} ${formatAmount(monthlyPayment)}\\\\
  Mijoz: ${escapeLatex(firstName)} ${escapeLatex(lastName)}, Telefon: ${escapeLatex(phone)}\\\\
  ${passportSeries ? `Passport: ${escapeLatex(passportSeries)}\\\\` : ''}\\\\
  ${jshshir ? `JSHSHIR: ${escapeLatex(jshshir)}\\\\` : ''}\\\\
\\end{center}

\\vspace{0.5cm}

\\begin{table}[h]
\\centering
\\begin{tabular}{ccc}
\\toprule
Oylik & To'lov Summasi & Qoldiq Summa \\\\
\\midrule
${schedule.map((row) => `${row.month} & ${formatAmount(row.payment)} & ${formatAmount(row.remainingBalance)}\\\\`).join('\n')}
\\bottomrule
\\end{tabular}
\\caption{To'lov Jadvali}
\\end{table}

\\end{document}
    `;

    const blob = new Blob([latexContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `payment_schedule_${Date.now()}.tex`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setNotification({ message: 'To\'lov jadvali yuklandi (PDF sifatida kompilyatsiya qilinishi kerak)', type: 'success' });
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

  const didInitRef = useRef(false);
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    const fetchBranchesAndUsers = async () => {
      try {
        const [branchesRes, usersRes] = await Promise.all([
          axiosWithAuth({ method: 'get', url: `${API_URL}/branches` }),
          axiosWithAuth({ method: 'get', url: `${API_URL}/users?role=MARKETING` }),
        ]);
        setBranches(branchesRes.data);
        setUsers(usersRes.data);
        const userBranchId = localStorage.getItem('branchId');
        if (userBranchId) {
          setSelectedBranchId(userBranchId);
        }
      } catch (err) {
        setNotification({ message: err.message || 'Filial va foydalanuvchilarni yuklashda xatolik', type: 'error' });
        console.error('Fetch branches and users error:', err);
      }
    };
    fetchBranchesAndUsers();
    fetchExchangeRate(); // Fetch exchange rate on component mount
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setNotification(null);
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

      const sortedProducts = allProducts.sort((a, b) => {
        if (a.quantity === 0 && b.quantity !== 0) return 1;
        if (a.quantity !== 0 && b.quantity === 0) return -1;
        return a.id - b.id;
      });
      setProducts(sortedProducts);

      // Store original quantities
      const quantities = {};
      sortedProducts.forEach(product => {
        quantities[product.id] = product.quantity;
      });
      setOriginalQuantities(quantities);
    } catch (err) {
      setNotification({ message: err.message || "Ma'lumotlarni yuklashda xatolik", type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [searchTerm, selectedBranchId]);

  useEffect(() => {
    if (selectedBranchId) {
      loadData();
    }
  }, [loadData, selectedBranchId]);





  const updateItem = (index, field, value) => {
    setSelectedItems((prev) => {
      const newItems = prev.map((item, i) =>
        i === index ? { ...item, [field]: value } : item,
      );

      // If quantity is being updated, adjust product quantities accordingly
      if (field === 'quantity') {
        const item = newItems[index];
        const oldQuantity = prev[index].quantity;
        const quantityDiff = Number(value) - Number(oldQuantity);

        if (quantityDiff !== 0) {
          setProducts(prevProducts =>
            prevProducts.map(product =>
              product.id === item.id
                ? { ...product, quantity: Math.max(0, product.quantity - quantityDiff) }
                : product
            )
          );
        }
      }

      return newItems;
    });
  };

  const removeItem = (index) => {
    setSelectedItems((prev) => {
      const removedItem = prev[index];

      // Restore product quantity when item is removed
      if (removedItem) {
        setProducts(prevProducts =>
          prevProducts.map(product =>
            product.id === removedItem.id
              ? { ...product, quantity: Math.min(originalQuantities[product.id] || product.quantity, product.quantity + Number(removedItem.quantity)) }
              : product
          )
        );
      }

      return prev.filter((_, i) => i !== index);
    });
  };

  // Function to clear cart
  const clearCart = () => {
    setSelectedItems([]);
    setFirstName('');
    setLastName('');
    setPhone('');
    setPassportSeries(''); // Reset passport series
    setJshshir(''); // Reset JSHSHIR
    setPaymentType('');
    setDownPayment('');
    setCustomerPaid('0');
    setMonths('');
    setInterestRate('');
    setUpfrontPaymentType('CASH');
    setErrors({});
    setPriceInputValues({}); // Clear price input values

    // Restore original quantities
    setProducts(prev =>
      prev.map(product => ({
        ...product,
        quantity: originalQuantities[product.id] || product.quantity
      }))
    );

    setNotification({ message: 'Savat tozalandi', type: 'success' });
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedItems([]);
    setSelectedBranch('');
    setSelectedUserId('');
    setPaymentType('');
    setDeliveryType('PICKUP');
    setFirstName('');
    setLastName('');
    setPhone('');
    setJshshir('');
    setPassportSeries('');
    setMonths('');
    setInterestRate('');
    setDownPayment('');
    setCustomerPaid('0');
    setUpfrontPaymentType('CASH');
    setErrors({});
    setNotification(null);
  };

  const closeReceiptModal = () => {
    setShowReceiptModal(false);
    setReceiptData(null);
  };

  const openSelectedItemsModal = () => {
    setShowSelectedItemsModal(true);
  };

  const closeSelectedItemsModal = () => {
    setShowSelectedItemsModal(false);
  };

  useEffect(() => {
    const savedBranchId = localStorage.getItem("branchId");
    if (savedBranchId) {
      setSelectedBranchId(savedBranchId);
    }
  }, []);

  useEffect(() => {
    if (selectedBranchId) {
      localStorage.setItem("branchId", selectedBranchId);
    }
  }, [selectedBranchId]);

  // Clear customer-related validation errors when payment type doesn't require them
  useEffect(() => {
    if (!['CREDIT', 'INSTALLMENT'].includes(paymentType) && deliveryType !== 'DELIVERY') {
      setErrors((prev) => {
        const {
          firstName: _fn,
          lastName: _ln,
          phone: _ph,
          passportSeries: _ps,
          jshshir: _js,
          months: _mo,
          interestRate: _ir,
          ...rest
        } = prev || {};
        return rest;
      });
    }
  }, [paymentType, deliveryType]);

  const validateFields = () => {
    const newErrors = {};

    // Always required fields
    if (selectedItems.length === 0) newErrors.items = "Kamida bitta mahsulot tanlanishi shart";

    // Validate each selected item
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

    // Always required: seller and payment type
    if (!selectedUserId) newErrors.seller = "Sotuvchi tanlanishi shart";
    if (!paymentType) newErrors.paymentType = "To'lov turi tanlanishi shart";

    // Customer fields validation - only required for delivery OR credit/installment
    const requiresCustomerInfo = deliveryType === 'DELIVERY' || ['CREDIT', 'INSTALLMENT'].includes(paymentType);

    if (requiresCustomerInfo) {
      if (!firstName.trim()) newErrors.firstName = "Ism kiritilishi shart";
      if (!lastName.trim()) newErrors.lastName = "Familiya kiritilishi shart";
      if (!phone.trim() || !/^\+998\s?\d{2}\s?\d{3}\s?\d{2}\s?\d{2}$/.test(phone))
        newErrors.phone = "Telefon raqami: +998 XX XXX XX XX";
    }

    // Delivery address - only required for delivery
    if (deliveryType === 'DELIVERY') {
      if (!deliveryAddress.trim()) newErrors.deliveryAddress = "Manzil kiritilishi shart";
    }

    // Credit/Installment specific validation
    if (['CREDIT', 'INSTALLMENT'].includes(paymentType)) {
      if (!['CASH', 'CARD'].includes(upfrontPaymentType)) {
        newErrors.upfrontPaymentType = "Олдиндан тўлов тури танланмаган (Нақд ёки Карта)";
      }
      const isDays = paymentType === 'INSTALLMENT' && termUnit === 'DAYS';
      if (!isDays) {
        if (!passportSeries.trim()) newErrors.passportSeries = "Passport seriyasi kiritilishi shart";
        if (!jshshir.trim() || !/^\d{14,16}$/.test(jshshir))
          newErrors.jshshir = "JSHSHIR 14-16 raqamdan iborat bo'lishi kerak";
        if (!months || isNaN(months) || Number(months) <= 0 || !Number.isInteger(Number(months))) {
          newErrors.months = "Oylar soni 1 dan katta butun son bo'lishi kerak";
        }
        if (!interestRate || isNaN(interestRate) || Number(interestRate) < 0) {
          newErrors.interestRate = "Foiz 0 dan katta yoki teng bo'lishi kerak";
        }
      } else {
        if (!daysCount || isNaN(daysCount) || Number(daysCount) <= 0 || !Number.isInteger(Number(daysCount)) || Number(daysCount) > 365) {
          newErrors.daysCount = "Kunlar soni 1..365 oraliqda bo'lishi kerak";
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateFields()) {
      const errorMessages = Object.values(errors).filter((msg) => msg);
      const errorText = errorMessages.length > 0 ? errorMessages.join(', ') : "Barcha maydonlarni to'g'ri to'ldiring";
      setNotification({ message: errorText, type: 'error' });
      return;
    }

    setSubmitting(true);
    setNotification(null);
    try {
      const userId = Number(localStorage.getItem('userId'));
      const baseTotal = selectedItems.reduce((sum, item, index) => {
        const displayPrice = priceInputValues[`${item.id}_${index}`] || item.price;
        return sum + Number(item.quantity) * Number(displayPrice);
      }, 0);

      const isDays = paymentType === 'INSTALLMENT' && termUnit === 'DAYS';
      const m = isDays ? Number(daysCount) : Number(months);
      const rate = Number(interestRate) / 100 || 0;
      
      // To'g'ri hisoblash: oldindan to'lovni ayirib, keyin foiz qo'shish
      const upfrontPayment = Number(customerPaid) || 0;
      const remainingPrincipal = Math.max(0, baseTotal - upfrontPayment);
      const interestAmount = remainingPrincipal * rate;
      const remainingWithInterest = remainingPrincipal + interestAmount;
      const finalTotal = upfrontPayment + remainingWithInterest;
      const monthlyPayment = m > 0 && remainingWithInterest > 0 ? remainingWithInterest / m : 0;

      console.log('Setting receiptData with upfrontPaymentType:', upfrontPaymentType);

      setReceiptData({
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
        seller: users.find((u) => u.id === Number(selectedUserId)),
        branch: branches.find((b) => b.id === Number(localStorage.getItem('branchId'))),
        items: selectedItems.map((item, index) => ({
          ...item,
          price: Number(priceInputValues[`${item.id}_${index}`] || item.price),
          sellingPrice: Number(priceInputValues[`${item.id}_${index}`] || item.price),
          originalPrice: Number(item.price),
          quantity: Number(item.quantity),
          total: Number(item.quantity) * Number(priceInputValues[`${item.id}_${index}`] || item.price),
          ...(paymentType === 'CREDIT' || paymentType === 'INSTALLMENT'
            ? {
              creditMonth: m,
              creditPercent: rate, // This is already a decimal (0.20 for 20%)
              monthlyPayment: Number(monthlyPayment),
            }
            : {}),
        })),
        paymentType,
        deliveryType: deliveryType === 'DELIVERY' ? 'DELIVERY' : 'PICKUP',
        deliveryAddress: deliveryAddress,
        months: !isDays ? m : 0,
        days: isDays ? m : 0,
        termUnit: isDays ? 'DAYS' : 'MONTHS',
        interestRate: Number(interestRate),
        paid: Number(upfrontPayment),
        remaining: Number(remainingWithInterest),
        monthlyPayment: Number(monthlyPayment),
        totalInSom: Number(baseTotal),
        finalTotalInSom: Number(finalTotal),
        upfrontPaymentType: ['CREDIT', 'INSTALLMENT'].includes(paymentType) ? upfrontPaymentType : paymentType, // Use paymentType for CASH/CARD, upfrontPaymentType for CREDIT/INSTALLMENT
      });

      console.log('Receipt data set:', {
        paymentType,
        upfrontPaymentType,
        termUnit,
        daysCount,
        months,
      });

      setShowSelectedItemsModal(false);
      setSelectedUserId('');
      setPaymentType('CASH');
      setDeliveryType('PICKUP');
      setFirstName('');
      setLastName('');
      setPhone('');
      setPassportSeries('');
      setJshshir('');
      setCustomerPaid('0');
      setMonths('');
      setInterestRate('');
      setDeliveryAddress('');
      setUpfrontPaymentType('CASH');
      setErrors({});
      setPriceInputValues({});
      setShowReceiptModal(true);
    } catch (err) {
      console.error('handleSubmit error:', err);
      setNotification({ message: err.message || "Sotishda xatolik yuz berdi", type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const { totalWithInterest, remaining } = calculatePaymentSchedule();

  // Function to fetch current exchange rate from /currency-exchange-rates endpoint
  const fetchExchangeRate = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (token) {
        const response = await axios.get(`${API_URL}/currency-exchange-rates`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        // Get the first exchange rate (index 0) from the array
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
      // Keep default rate if fetch fails
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Сотиш</h1>

      {notification && (
        <div
          className={`p-4 rounded-lg mb-6 flex justify-between items-center ${notification.type === 'error' ? 'bg-red-100 text-red-700' :
            notification.type === 'warning' ? 'bg-yellow-100 text-yellow-700' :
              'bg-green-100 text-green-700'
            }`}
        >
          <span>{notification.message}</span>
          <button
            className="text-sm font-medium underline hover:text-gray-900"
            onClick={() => setNotification(null)}
          >
            Ёпиш
          </button>
        </div>
      )}

      <select
        value={selectedBranchId}
        onChange={(e) => setSelectedBranchId(e.target.value)}
        className="hidden"
      >
        <option value="">Филиал танланг</option>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>

      <input
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Товар қидириш..."
        className="w-full p-3 border border-gray-300 rounded-lg mb-6 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {loading ? (
        <div className="text-center text-gray-600">Юкланмоқда...</div>
      ) : (
        <>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-700">Маҳсулотлар қолдиғи</h2>
            <div className="flex gap-2">
              {selectedItems.length > 0 && (
                <button
                  onClick={clearCart}
                  className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors"
                >
                  Саватни тозалаш
                </button>
              )}
              <button
                onClick={openSelectedItemsModal}
                className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
                disabled={selectedItems.length === 0}
              >
                <span>Сават</span>
                {selectedItems.length > 0 && (
                  <span className="bg-white text-blue-500 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                    {selectedItems.length}
                  </span>
                )}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto shadow-md rounded-lg">
            <table className="w-full bg-white border border-gray-200">
              <thead>
                <tr className="bg-gray-100 text-gray-600">
                  <th className="p-3 text-left font-medium">ID</th>
                  <th className="p-3 text-left font-medium">Номи</th>
                  <th className="p-3 text-left font-medium">Модель</th>
                  <th className="p-3 text-left font-medium">Штрих-код</th>
                  <th className="p-3 text-left font-medium">Нарх (UZS)</th>
                  <th className="p-3 text-left font-medium">Миқдор</th>
                  <th className="p-3 text-left font-medium">Амаллар</th>
                </tr>
              </thead>
              <tbody>
                {products.length > 0 ? (
                  products.map((product) => (
                    <tr key={product.id} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="p-3 text-gray-700">#{product.id}</td>
                      <td className="p-3 text-gray-700">{product.name}</td>
                      <td className="p-3 text-gray-700">{product.model}</td>
                      <td className="p-3 text-gray-700">{product.barcode}</td>
                      <td className="p-3 text-gray-700">{formatAmount((product.marketPrice != null ? product.marketPrice : product.price) * exchangeRate)}</td>
                      <td className="p-3 text-gray-700">{formatQuantity(product.quantity)}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            max={product.quantity}
                            defaultValue="1"
                            className="w-16 p-1 border border-gray-300 rounded text-sm"
                            id={`quantity-${product.id}`}
                          />
                          <button
                            onClick={() => {
                              if (product.quantity > 0) {
                                const quantityInput = document.getElementById(`quantity-${product.id}`);
                                const quantity = parseInt(quantityInput.value) || 1;

                                if (quantity > product.quantity) {
                                  setNotification({ message: `Максимал миқдор: ${product.quantity}`, type: 'warning' });
                                  return;
                                }

                                const existingItemIndex = selectedItems.findIndex((item) => item.id === product.id);

                                if (existingItemIndex !== -1) {
                                  setSelectedItems((prev) =>
                                    prev.map((item, index) =>
                                      index === existingItemIndex
                                        ? { ...item, quantity: Number(item.quantity) + quantity }
                                        : item
                                    )
                                  );
                                  setNotification({ message: `${product.name} миқдори янгиланди`, type: 'success' });
                                } else {
                                  // Add new item - convert USD to som
                                  const priceInSom = Math.round(Number(product.marketPrice || product.price) * exchangeRate);
                                  setSelectedItems([
                                    ...selectedItems,
                                    {
                                      id: product.id,
                                      name: product.name,
                                      quantity: quantity,
                                      price: priceInSom.toString(),
                                      marketPrice: priceInSom.toString(),
                                      maxQuantity: product.quantity,
                                    },
                                  ]);
                                  setNotification({ message: `${product.name} (${quantity} дона) саватга қўшилди`, type: 'success' });
                                }

                                quantityInput.value = "1";
                              } else {
                                setNotification({ message: 'Бу маҳсулотдан қолдиқ йўқ', type: 'warning' });
                              }
                            }}
                            disabled={product.quantity <= 0}
                            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${product.quantity > 0
                              ? 'bg-green-500 text-white hover:bg-green-600'
                              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                              }`}
                          >
                            Қўшиш
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="p-3 text-center text-gray-600">
                      Товарлар топилмади
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {showModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-xl">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-gray-800">Мижозга сотиш</h3>
                  <button
                    onClick={closeModal}
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
                              value={priceInputValues[`${item.id}_${index}`] || item.price}
                              onChange={(e) => {
                                const inputValue = e.target.value;
                                const itemKey = `${item.id}_${index}`;
                                setPriceInputValues(prev => ({
                                  ...prev,
                                  [itemKey]: inputValue
                                }));
                                if (inputValue === '' || (!isNaN(inputValue) && Number(inputValue) >= 0)) {
                                  const newPriceInSom = inputValue === '' ? 0 : inputValue;
                                  updateItem(index, 'price', newPriceInSom);
                                }
                              }}
                              className={`w-40 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors[`price_${index}`] ? 'border-red-500' : 'border-gray-300'}`}
                              min="0"
                              step="0"
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
                              const displayPrice = priceInputValues[`${item.id}_${index}`] || Number(item.price);
                              const quantity = Number(item.quantity);

                              if (displayPrice.toString().length > 15) {
                                if (quantity === 1) {
                                  return `${displayPrice} сом`;
                                } else {
                                  return `${displayPrice} сом (${quantity} дона)`;
                                }
                              } else {
                                const total = quantity * Number(displayPrice);
                                return new Intl.NumberFormat('uz-UZ').format(total) + ' сом';
                              }
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
                      {(deliveryType === 'DELIVERY' || ['CREDIT', 'INSTALLMENT'].includes(paymentType)) && (
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
                            value={deliveryAddress} // downPayment o'rniga deliveryAddress
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
                          className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.paymentType ? 'border-red-500' : 'border-gray-300'
                            }`}
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
                                className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.daysCount ? 'border-red-500' : 'border-gray-300'
                                  }`}
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
                                  className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.passportSeries ? 'border-red-500' : 'border-gray-300'
                                    }`}
                                />
                                {errors.passportSeries && <span className="text-red-500 text-xs">{errors.passportSeries}</span>}
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
                                {errors.jshshir && <span className="text-red-500 text-xs">{errors.jshshir}</span>}
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Ойлар сони</label>
                                <input
                                  type="number"
                                  value={months}
                                  onChange={(e) => setMonths(e.target.value)}
                                  className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.months ? 'border-red-500' : 'border-gray-300'
                                    }`}
                                  min="1"
                                  step="1"
                                />
                                {errors.months && <span className="text-red-емы text-xs">{errors.months}</span>}
                              </div>
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
                              className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.customerPaid ? 'border-red-500' : 'border-gray-300'
                                }`}
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
                                  checked={upfrontPaymentType === 'CASH'}
                                  onChange={(e) => setUpfrontPaymentType(e.target.value)}
                                  className="mr-2 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm font-medium text-gray-700">Нақд</span>
                              </label>
                              <label className="flex items-center">
                                <input
                                  type="radio"
                                  name="upfrontPaymentType"
                                  value="CARD"
                                  checked={upfrontPaymentType === 'CARD'}
                                  onChange={(e) => setUpfrontPaymentType(e.target.value)}
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
                          const displayPrice = priceInputValues[`${item.id}_${index}`] || Math.round(Number(item.price));
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
                          <div className="font-medium text-red-600 break-words text-sm">{new Intl.NumberFormat('uz-UZ').format(remaining)} сом</div>
                        </div>
                        <div className="bg-white p-3 rounded border">
                          <div className="text-gray-600 text-xs mb-1">Умумий (фоиз билан):</div>
                          <div className="font-medium text-green-600 break-words text-sm">{new Intl.NumberFormat('uz-UZ').format(totalWithInterest)} сом</div>
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
                    onClick={() => {
                      // Only open receipt; actual sell will happen on print
                      handleSubmit(new Event('submit'));
                    }}
                    disabled={submitting}
                    className="flex-1 bg-blue-500 text-white p-3 rounded-lg hover:bg-blue-600 disabled:bg-gray-400 transition-colors font-medium"
                  >
                    {submitting ? 'Юкланмоқда...' : 'Чекни кўриш'}
                  </button>
                  <button
                    onClick={closeModal}
                    className="flex-1 bg-gray-200 text-gray-700 p-3 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Бекор
                  </button>
                </div>
              </div>
            </div>

          )}

          {showSelectedItemsModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-gray-800">Танланган маҳсулотлар</h3>
                  <button
                    onClick={closeSelectedItemsModal}
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
                              value={priceInputValues[`${item.id}_${index}`] || item.price}
                              onChange={(e) => {
                                const inputValue = e.target.value;
                                const itemKey = `${item.id}_${index}`;

                                // Update display value immediately
                                setPriceInputValues(prev => ({
                                  ...prev,
                                  [itemKey]: inputValue
                                }));

                                // Update actual price in som directly
                                if (inputValue === '' || (!isNaN(inputValue) && Number(inputValue) >= 0)) {
                                  const newPriceInSom = inputValue === '' ? 0 : inputValue;
                                  updateItem(index, 'price', newPriceInSom);
                                }
                              }}
                              className={`w-40 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors[`price_${index}`] ? 'border-red-500' : 'border-gray-300'}`}
                              min="0"
                              step="0"
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
                              <span className="text-red-500 text-xs block">{errors[`quantity_${index}`]}</span>
                            )}
                          </td>
                          <td className="p-3 font-medium">
                            {(() => {
                              const displayPrice = priceInputValues[`${item.id}_${index}`] || Number(item.price);
                              const quantity = Number(item.quantity);

                              // For very large numbers, show clean format without multiplication
                              if (displayPrice.toString().length > 15) {
                                // For quantity = 1, just show the price
                                if (quantity === 1) {
                                  return `${displayPrice} сом`;
                                } else {
                                  // For quantity > 1, show price per item
                                  return `${displayPrice} сом (${quantity} дона)`;
                                }
                              } else {
                                const total = quantity * Number(displayPrice);
                                return new Intl.NumberFormat('uz-UZ').format(total) + ' сом';
                              }
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
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Сотувчи</label>
                        <select
                          value={selectedUserId}
                          onChange={(e) => setSelectedUserId(e.target.value)}
                          className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.seller ? 'border-red-500' : 'border-gray-300'}`}
                        >
                          <option value="">Сотувчи танланг</option>
                          {users && users.filter(user => user.role === 'MARKETING').map((user) => (
                            <option key={user.id} value={user.id}>
                              {user.firstName} {user.lastName}
                            </option>
                          ))}
                        </select>
                        {errors.seller && (
                          <span className="text-red-500 text-xs">{errors.seller}</span>
                        )}
                      </div>
                      {(deliveryType === 'DELIVERY' || ['CREDIT', 'INSTALLMENT'].includes(paymentType)) && (
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
                            value={deliveryAddress} // downPayment o'rniga deliveryAddress
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
                          className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.paymentType ? 'border-red-500' : 'border-gray-300'
                            }`}
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
                                className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.daysCount ? 'border-red-500' : 'border-gray-300'
                                  }`}
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
                                  className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.passportSeries ? 'border-red-500' : 'border-gray-300'
                                    }`}
                                />
                                {errors.passportSeries && <span className="text-red-500 text-xs">{errors.passportSeries}</span>}
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
                                {errors.jshshir && <span className="text-red-500 text-xs">{errors.jshshir}</span>}
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Ойлар сони</label>
                                <input
                                  type="number"
                                  value={months}
                                  onChange={(e) => setMonths(e.target.value)}
                                  className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.months ? 'border-red-500' : 'border-gray-300'
                                    }`}
                                  min="1"
                                  step="1"
                                />
                                {errors.months && <span className="text-red-емы text-xs">{errors.months}</span>}
                              </div>
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
                              className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.customerPaid ? 'border-red-500' : 'border-gray-300'
                                }`}
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
                                  checked={upfrontPaymentType === 'CASH'}
                                  onChange={(e) => setUpfrontPaymentType(e.target.value)}
                                  className="mr-2 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm font-medium text-gray-700">Нақд</span>
                              </label>
                              <label className="flex items-center">
                                <input
                                  type="radio"
                                  name="upfrontPaymentType"
                                  value="CARD"
                                  checked={upfrontPaymentType === 'CARD'}
                                  onChange={(e) => setUpfrontPaymentType(e.target.value)}
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
                          const displayPrice = priceInputValues[`${item.id}_${index}`] || Math.round(Number(item.price));
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
                          <div className="font-medium text-red-600 break-words text-sm">{new Intl.NumberFormat('uz-UZ').format(remaining)} сом</div>
                        </div>
                        <div className="bg-white p-3 rounded border">
                          <div className="text-gray-600 text-xs mb-1">Умумий (фоиз билан):</div>
                          <div className="font-medium text-green-600 break-words text-sm">{new Intl.NumberFormat('uz-UZ').format(totalWithInterest)} сом</div>
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
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="flex-1 bg-blue-500 text-white p-3 rounded-lg hover:bg-blue-600 disabled:bg-gray-400 transition-colors font-medium"
                  >
                    {submitting ? 'Юкланмоқда...' : 'Сотишни амалга ошириш'}
                  </button>
                  <button
                    onClick={closeSelectedItemsModal}
                    className="flex-1 bg-gray-200 text-gray-700 p-3 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Бекор
                  </button>
                </div>
              </div>
            </div>
          )}
          {showReceiptModal && receiptData && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl lg:max-w-3xl max-h-[95vh] overflow-hidden mx-auto">
                <Receipt
                  transaction={receiptData}
                  onClose={closeReceiptModal}
                  onPrint={async () => {
                    try {
                      const rd = receiptData;
                      const computedBaseTotal = rd.items.reduce(
                        (sum, it) => sum + Number(it.quantity) * Number(it.sellingPrice ?? it.price),
                        0
                      );

                      if (!rd.paymentType) throw new Error("Тўлов тури танланмаган");
                      if (!rd.items || rd.items.length === 0) throw new Error("Маҳсулотлар танланмаган");
                      const userId = Number(localStorage.getItem('userId'));
                      if (!userId || isNaN(userId)) throw new Error("Фойдаланувчи ID топилмади");
                      const fromBranchId = rd.branch?.id
                        ? Number(rd.branch.id)
                        : selectedBranch
                          ? Number(selectedBranch)
                          : Number(selectedBranchId);
                      if (!fromBranchId || isNaN(fromBranchId)) throw new Error("Филиал ID топилмади");
                      const soldByUserId = rd.seller?.id ? Number(rd.seller.id) : Number(selectedUserId);
                      if (!soldByUserId || isNaN(soldByUserId)) throw new Error("Сотувчи ID топилмади");

                            const payload = {
        type: 'SALE',
        status: 'PENDING',
        total: Number(rd.totalInSom ?? computedBaseTotal) || 0,
        finalTotal: Number(rd.finalTotalInSom ?? rd.totalInSom ?? computedBaseTotal) || 0,
        amountPaid: ['CREDIT', 'INSTALLMENT'].includes(rd.paymentType)
          ? Number(rd.paid || 0)  // Oldindan to'lov miqdori
          : Number(rd.paid || 0),
        downPayment: ['CREDIT', 'INSTALLMENT'].includes(rd.paymentType)
          ? Number(rd.paid || 0)  // Oldindan to'lov miqdori
          : 0,
        userId: userId,
        remainingBalance: Number(rd.remaining || 0) || 0,  // Qolgan summa (foiz bilan)
        paymentType: rd.paymentType,
        upfrontPaymentType: ['CREDIT', 'INSTALLMENT'].includes(rd.paymentType)
          ? rd.upfrontPaymentType
          : rd.paymentType,
        termUnit: rd.termUnit || 'MONTHS',
        // Kunlik bo'lib to'lash uchun kunlar sonini yuborish
        days: rd.termUnit === 'DAYS' ? Number(rd.days || 0) : 0,
        months: rd.termUnit === 'MONTHS' ? Number(rd.months || 0) : 0,
        deliveryMethod: rd.deliveryType === 'DELIVERY' ? 'DELIVERY' : 'PICKUP',
        deliveryAddress:
          rd.deliveryType === 'DELIVERY' || rd.paymentType === 'CREDIT' || rd.paymentType === 'INSTALLMENT'
            ? rd.deliveryAddress || rd.customer?.address || ''
            : '',
        customer: {
          fullName: (rd.customer?.fullName || `${rd.customer?.firstName || ''} ${rd.customer?.lastName || ''}`).trim() || 'Номаълум',
          phone: (rd.customer?.phone || '').replace(/\s+/g, '') || '',
          passportSeries: rd.customer?.passportSeries || '',
          jshshir: rd.customer?.jshshir || '',
          address: rd.customer?.address || rd.deliveryAddress || '',
        },
        fromBranchId: fromBranchId,
        soldByUserId: soldByUserId,
        items: rd.items.map((item) => ({
          productId: item.id || 0,
          productName: item.name || 'Номаълум маҳсулот',
          quantity: Number(item.quantity) || 0,
          price: Number(item.sellingPrice ?? item.price) || 0,
          sellingPrice: Number(item.sellingPrice ?? item.price) || 0,
          originalPrice: Number(item.originalPrice ?? item.price) || 0,
          total: Number(item.quantity || 0) * Number(item.sellingPrice ?? item.price) || 0,
          ...(rd.paymentType === 'CREDIT' || rd.paymentType === 'INSTALLMENT'
            ? {
              creditMonth: rd.termUnit === 'DAYS' ? Number(rd.days || 0) : Number(rd.months || 0),
              creditPercent: Number(rd.interestRate || 0) / 100 || 0,
              monthlyPayment: Number(rd.monthlyPayment || 0) || 0,
            }
            : {}),
        })),
      };

                      console.log('Sending payload to API:', JSON.stringify(payload, null, 2));
                      console.log('Payload upfrontPaymentType:', payload.upfrontPaymentType);

                      if (!['CASH', 'CARD'].includes(payload.upfrontPaymentType) && ['CREDIT', 'INSTALLMENT'].includes(payload.paymentType)) {
                        throw new Error("Нотўғри олдиндан тўлов тури");
                      }

                      const response = await axiosWithAuth({
                        method: 'post',
                        url: `${API_URL}/transactions`,
                        data: payload,
                      });

                      console.log('API response:', response.data);

                      setReceiptData((prev) => ({
                        ...prev,
                        id: response.data.id,
                        createdAt: response.data.createdAt,
                        ...(rd.termUnit === 'DAYS' ? { termUnit: 'DAYS', days: rd.days } : {}),
                      }));

                      try {
                        const metaRaw = localStorage.getItem('tx_term_units');
                        const metaMap = metaRaw ? JSON.parse(metaRaw) : {};
                        const newMeta = { ...metaMap };
                        if (response?.data?.id && rd.termUnit === 'DAYS') {
                          newMeta[String(response.data.id)] = { termUnit: 'DAYS', days: rd.days, interestRate: rd.interestRate };
                          localStorage.setItem('tx_term_units', JSON.stringify(newMeta));
                        }
                      } catch { }

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
                    <span>${receiptData.customer.fullName || `${receiptData.customer.firstName} ${receiptData.customer.lastName}`}</span>
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
                    <span>${receiptData.paymentType === 'CASH' ? 'Naqd' :
                          receiptData.paymentType === 'CARD' ? 'Karta' :
                            receiptData.paymentType === 'CREDIT' ? 'Kredit' :
                              receiptData.paymentType === 'INSTALLMENT' ? "Bo'lib to'lash" : receiptData.paymentType}</span>
                  </div>
                  ${['CREDIT', 'INSTALLMENT'].includes(receiptData.paymentType) ? `
                    <div class="total-row">
                      <span>Oldindan to'lov:</span>
                      <span>${receiptData.upfrontPaymentType === 'CASH' ? 'Naqd' : 'Karta'}</span>
                    </div>
                  ` : ''}
                  <div class="total-row">
                    <span>Yetkazib berish:</span>
                    <span>${receiptData.deliveryType === 'PICKUP' ? 'Olib ketish' :
                          receiptData.deliveryType === 'DELIVERY' ? 'Yetkazib berish' :
                            receiptData.deliveryType}</span>
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
                  ${receiptData.items.map((item) => `
                    <div class="total-row">
                      <span>${item.name} x${item.quantity}</span>
                      <span>${new Intl.NumberFormat('uz-UZ').format(Number(item.quantity) * Number(item.price))} so'm</span>
                    </div>
                  `).join('')}
                </div>
                <div class="total">
                  <div class="total-row">
                    <span>JAMI:</span>
                    <span>${new Intl.NumberFormat('uz-UZ').format(receiptData.totalInSom || (receiptData.items.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.price)), 0)))} so'm</span>
                  </div>
                  ${['CREDIT', 'INSTALLMENT'].includes(receiptData.paymentType) ? `
                    <div class="total-row">
                      <span>Foiz bilan:</span>
                      <span>${new Intl.NumberFormat('uz-UZ').format(receiptData.finalTotalInSom)} so'm</span>
                    </div>
                    <div class="total-row">
                      <span>To'langan:</span>
                      <span>${new Intl.NumberFormat('uz-UZ').format(receiptData.paid)} so'm</span>
                    </div>
                    <div class="total-row">
                      <span>Qolgan:</span>
                      <span>${new Intl.NumberFormat('uz-UZ').format(receiptData.remaining)} so'm</span>
                    </div>
                    <div class="total-row">
                      <span>Oylik:</span>
                      <span>${new Intl.NumberFormat('uz-UZ').format(receiptData.monthlyPayment)} so'm</span>
                    </div>
                  ` : ''}
                </div>
                <div class="footer">
                  <p>Tashrifingiz uchun rahmat!</p>
                </div>
              </body>
              </html>
            `;
                      printWindow.document.write(receiptContent);
                      printWindow.document.close();
                      printWindow.focus();
                      try {
                        printWindow.print();
                      } finally {
                        setTimeout(() => {
                          printWindow.close();
                          closeReceiptModal();
                          setSelectedItems([]);
                          loadData();
                          setNotification({ message: 'Sotuv yakunlandi va chop etildi', type: 'success' });
                        }, 1000);
                      }
                    } catch (err) {
                      console.error('onPrint error:', err);
                      console.error('Error response:', err.response?.data);
                      let message = err.message || "Tranzaksiya yaratishda xatolik";
                      if (err.response?.status === 500) {
                        message = "Серверда ички хатолик юз берди. Илтимос, қайта уриниб кўринг.";
                      } else if (err.response?.data?.message) {
                        message = err.response.data.message;
                      }
                      setNotification({ message, type: 'error' });
                    }
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

export default SalesManagement;