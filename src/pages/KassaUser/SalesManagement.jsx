import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Receipt from './Receipt/Receipt';

const SalesManagement = () => {
  const [products, setProducts] = useState([]);
  const [originalQuantities, setOriginalQuantities] = useState({}); // Track original quantities
  const [branches, setBranches] = useState([]);
  const [users, setUsers] = useState([]); // New state for marketing users
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showSelectedItemsModal, setShowSelectedItemsModal] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);
  const [lastTransaction, setLastTransaction] = useState(null);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [tempQuantity, setTempQuantity] = useState('');
  const [tempPrice, setTempPrice] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedSellerId, setSelectedSellerId] = useState(''); // New state for selected seller
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const formatUzPhone = (value) => {
    const digits = (value || '').replace(/\D/g, '').replace(/^998/, '');
    const p = digits.substring(0, 9);
    const part1 = p.substring(0, 2);
    const part2 = p.substring(2, 5);
    const part3 = p.substring(5, 7);
    const part4 = p.substring(7, 9);
    return `+998${part1 ? ' ' + part1 : ''}${part2 ? ' ' + part2 : ''}${part3 ? ' ' + part3 : ''}${part4 ? ' ' + part4 : ''}`.trim();
  };

  const phoneInputRef = useRef(null);
  const onPhoneChange = (e) => {
    // Limit to +998 XX XXX XX XX (9 local digits) and keep formatting
    setPhone(formatUzPhone(e.target.value));
  };
  const onPhoneKeyDown = (e) => {
    if (e.key !== 'Backspace' && e.key !== 'Delete') return;
    const value = phone || '';
    const caret = e.currentTarget.selectionStart || 0;
    // Map visual index to local digit index (exclude +998 prefix)
    const mapToLocalIndex = (idx) => {
      let count = -1; // local digit count starts at 0
      for (let i = 0; i < value.length; i++) {
        if (i <= 4) continue; // skip "+998 " prefix
        const ch = value[i];
        if (/\d/.test(ch)) count++;
        if (i === idx) return (/\d/.test(ch) ? count : count); // if space, previous digit index
      }
      return -1;
    };
    if (e.key === 'Backspace') {
      // If backspacing on a space, delete the digit before it
      const targetIdx = caret - 1;
      if (targetIdx < 0) return;
      const localDigits = value.replace(/\D/g, '').replace(/^998/, '');
      let delLocalIndex = mapToLocalIndex(targetIdx);
      if (delLocalIndex < 0) return;
      const newLocal = localDigits.slice(0, delLocalIndex) + localDigits.slice(delLocalIndex + 1);
      e.preventDefault();
      setPhone(formatUzPhone('+998 ' + newLocal));
    }
  };
  const [passportSeries, setPassportSeries] = useState(''); // New state for passport series
  const [jshshir, setJshshir] = useState(''); // New state for JSHSHIR
  const onJshshirChange = (e) => {
    // Keep only digits, limit to 16
    const digits = (e.target.value || '').replace(/\D/g, '').slice(0, 16);
    setJshshir(digits);
  };
  const [paymentType, setPaymentType] = useState('CASH');
  const [deliveryType, setDeliveryType] = useState('PICKUP'); // New state for delivery type
  const [deliveryAddress, setDeliveryAddress] = useState(''); // New state for delivery address
  const [months, setMonths] = useState(1);
  const [customInterestRate, setCustomInterestRate] = useState('0'); // New state for custom interest rate
  const [customerPaid, setCustomerPaid] = useState('0'); // New state for customer paid amount
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [notification, setNotification] = useState(null);
  useEffect(() => {
    if (!notification) return;
    const t = setTimeout(() => setNotification(null), 1500);
    return () => clearTimeout(t);
  }, [notification]);
  const navigate = useNavigate();

  const API_URL = 'https://suddocs.uz';

  const formatAmount = (amount) => {
    const num = Math.floor(Number(amount) || 0);
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  };

  const formatQuantity = (qty) => (qty >= 0 ? new Intl.NumberFormat('uz-UZ').format(qty) + ' дона' : '0 дона');

  const formatDate = (date) =>
    date ? new Date(date).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' }) : 'Номаълум';

  const calculatePaymentSchedule = () => {
    const m = Number(months);
    const interestRate = Number(customInterestRate) / 100 || 0;
    if (!m || m <= 0 || selectedItems.length === 0) return { totalWithInterest: 0, monthlyPayment: 0, schedule: [], change: 0, remaining: 0 };

    const baseTotal = selectedItems.reduce((sum, item) => sum + Number(item.quantity) * Number(item.price), 0);
    const paid = Number(customerPaid) || 0;
    const remainingPrincipal = Math.max(0, baseTotal - paid);
    const remaining = remainingPrincipal * (1 + interestRate);
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

  const generatePDF = () => {
    if (selectedItems.length === 0) return;
    const m = Number(months);
    const { totalWithInterest, monthlyPayment, schedule, change, remaining } = calculatePaymentSchedule();
    const branchName = branches.find((b) => b.id === Number(selectedBranch))?.name || 'Нома\'лум';
    const seller = users.find((u) => u.id === Number(selectedSellerId));
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
  Yetkazib berish: ${deliveryType === 'PICKUP' ? 'Olib ketish' : 'Yetkazib berish'}\\\\
  Muddat: ${m} oy\\\\
  Foiz: ${Number(customInterestRate).toFixed(2)}\\%\\\\
  Umumiy Summa (foiz bilan): ${formatAmount(totalWithInterest)}\\\\
  Mijoz to'lagan: ${formatAmount(Number(customerPaid))}\\\\
  Qaytim: ${formatAmount(change)}\\\\
  Qolgan summa: ${formatAmount(remaining)}\\\\
  Oylik To'lov: ${formatAmount(monthlyPayment)}\\\\
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
        setLoading(true);
        const [branchesRes, usersRes] = await Promise.all([
          axiosWithAuth({ method: 'get', url: `${API_URL}/branches` }),
          axiosWithAuth({ method: 'get', url: `${API_URL}/users` }),
        ]);
        setBranches(branchesRes.data);
        setUsers(usersRes.data.filter((user) => user.role === 'MARKETING')); // Filter for MARKETING role
      } catch (err) {
        setNotification({ message: err.message || 'Ma\'lumotlarni yuklashda xatolik', type: 'error' });
      } finally {
        setLoading(false);
      }
    };
    fetchBranchesAndUsers();

    const branchId = localStorage.getItem('branchId');
    if (branchId && !isNaN(branchId) && Number.isInteger(Number(branchId)) && Number(branchId) > 0) {
      setSelectedBranchId(branchId);
      setSelectedBranch(branchId);
    } else {
      setNotification({
        message: "Iltimos, filialni tanlang!",
        type: "error"
      });
    }
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

  const openModal = () => {
    setSelectedItems([]);
    setSelectedBranch(selectedBranchId || '');
    setSelectedSellerId('');
    setFirstName('');
    setLastName('');
    setPhone('');
    setPassportSeries(''); // Reset passport series
    setJshshir(''); // Reset JSHSHIR
    setPaymentType('CASH');
    setDeliveryType('PICKUP'); // Reset delivery type
    setDeliveryAddress(''); // Reset delivery address
    setMonths(1);
    setCustomInterestRate('0');
    setCustomerPaid('');
    setErrors({});
    setSelectedProductId('');
    setTempQuantity('');
    setTempPrice('');

    // Restore original quantities when opening modal
    setProducts(prev =>
      prev.map(product => ({
        ...product,
        quantity: originalQuantities[product.id] || product.quantity
      }))
    );

    setShowModal(true);
  };

  // Function to add item to cart with duplicate handling - NO API CALLS
  const addItem = () => {
    if (!selectedProductId || !tempQuantity) return;
    const product = products.find((p) => p.id === Number(selectedProductId));
    if (!product) return;

    const price = tempPrice || (product.marketPrice != null ? product.marketPrice.toString() : product.price.toString());
    if (Number(price) <= 0) {
      setNotification({ message: 'Narx 0 dan katta bo\'lishi kerak', type: 'error' });
      return;
    }

    // Check if item already exists in cart
    const existingItemIndex = selectedItems.findIndex((item) => item.id === product.id);

    if (existingItemIndex !== -1) {
      // Update existing item quantity
      setSelectedItems((prev) =>
        prev.map((item, index) =>
          index === existingItemIndex
            ? { ...item, quantity: Number(item.quantity) + Number(tempQuantity) }
            : item
        )
      );
      setNotification({ message: `${product.name} miqdori yangilandi`, type: 'success' });
    } else {
      // Add new item
      setSelectedItems([
        ...selectedItems,
        {
          id: product.id,
          name: product.name,
          quantity: tempQuantity,
          price: price,
          maxQuantity: product.quantity,
        },
      ]);
      setNotification({ message: `${product.name} (${tempQuantity} dona) savatga qo'shildi`, type: 'success' });
    }

    // Reduce product quantity in the products list
    setProducts(prev =>
      prev.map(p =>
        p.id === product.id
          ? { ...p, quantity: Math.max(0, p.quantity - Number(tempQuantity)) }
          : p
      )
    );

    setSelectedProductId('');
    setTempQuantity('');
    setTempPrice('');
    // Clear product selection inputs
    const productSelect = document.getElementById('product-select');
    const quantityInput = document.getElementById('temp-quantity');
    const priceInput = document.getElementById('temp-price');

    if (productSelect) productSelect.value = '';
    if (quantityInput) quantityInput.value = '';
    if (priceInput) priceInput.value = '';
  };

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
    setPaymentType('CASH');
    setDeliveryType('PICKUP'); // Reset delivery type
    setDeliveryAddress(''); // Reset delivery address
    setCustomInterestRate('0');
    setMonths(1);
    setCustomerPaid('0');

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
    setSelectedSellerId('');
    setFirstName('');
    setLastName('');
    setPhone('');
    setPassportSeries(''); // Reset passport series
    setJshshir(''); // Reset JSHSHIR
    setPaymentType('CASH');
    setDeliveryType('PICKUP'); // Reset delivery type
    setDeliveryAddress(''); // Reset delivery address
    setMonths(1);
    setCustomInterestRate('0');
    setCustomerPaid('');
    setErrors({});
    setNotification(null);
    setSelectedProductId('');
    setTempQuantity('');
    setTempPrice('');

    // Restore original quantities when modal is closed
    setProducts(prev =>
      prev.map(product => ({
        ...product,
        quantity: originalQuantities[product.id] || product.quantity
      }))
    );
  };

  const closeReceiptModal = () => {
    setShowReceiptModal(false);
    setLastTransaction(null);
  };

  const openSelectedItemsModal = () => {
    if (selectedItems.length === 0) {
      setNotification({ message: 'Savatda mahsulot yo\'q', type: 'warning' });
      return;
    }
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
    if (!['CREDIT', 'INSTALLMENT'].includes(paymentType)) {
      setErrors((prev) => {
        const {
          firstName: _fn,
          lastName: _ln,
          phone: _ph,
          passportSeries: _ps,
          jshshir: _js,
          months: _mo,
          customInterestRate: _ci,
          ...rest
        } = prev || {};
        return rest;
      });
    }
  }, [paymentType]);

  const validateFields = () => {
    const newErrors = {};
    if (selectedItems.length === 0) newErrors.items = 'Kamida bitta mahsulot tanlanishi shart';
    selectedItems.forEach((item, index) => {
      if (!item.quantity || isNaN(item.quantity) || Number(item.quantity) <= 0 || !Number.isInteger(Number(item.quantity))) {
        newErrors[`quantity_${index}`] = 'Miqdor 0 dan katta butun son bo\'lishi kerak';
      } else if (Number(item.quantity) > item.maxQuantity) {
        newErrors[`quantity_${index}`] = `Maksimal miqdor: ${item.maxQuantity} dona`;
      }
      if (!item.price || isNaN(item.price) || Number(item.price) <= 0) {
        newErrors[`price_${index}`] = 'Narx 0 dan katta bo\'lishi kerak';
      }
    });
    if (!selectedBranch) newErrors.branch = 'Filial tanlanishi shart';
    if (!selectedSellerId) newErrors.seller = 'Sotuvchi tanlanishi shart';
    
    // Customer fields validation based on payment type
    if (paymentType === 'CREDIT' || paymentType === 'INSTALLMENT') {
      if (!firstName.trim()) newErrors.firstName = 'Ism kiritilishi shart';
      if (!lastName.trim()) newErrors.lastName = 'Familiya kiritilishi shart';
      if (!phone.trim() || !/^\+998\s?\d{2}\s?\d{3}\s?\d{2}\s?\d{2}$/.test(phone)) newErrors.phone = 'Telefon raqami: +998 XX XXX XX XX';
    }
    
    if (!paymentType) newErrors.paymentType = 'To\'lov turi tanlanishi shart';
    if (((paymentType === 'CREDIT' || paymentType === 'INSTALLMENT') || deliveryType === 'DELIVERY') && !deliveryAddress.trim()) {
      newErrors.deliveryAddress = 'Manzil kiritilishi shart';
    }
    if ((paymentType === 'CREDIT' || paymentType === 'INSTALLMENT')) {
      if (!months || isNaN(months) || Number(months) <= 0 || !Number.isInteger(Number(months)) || Number(months) > 24) {
        newErrors.months = 'Oylar soni 1 dan 24 gacha butun son bo\'lishi kerak';
      }
      if (!customInterestRate || isNaN(customInterestRate) || Number(customInterestRate) < 0) {
        newErrors.customInterestRate = 'Foiz 0 dan katta yoki teng bo\'lishi kerak';
      }
      if (!passportSeries.trim()) newErrors.passportSeries = 'Passport seriyasi kiritilishi shart';
      if (!jshshir.trim() || !/^\d{14,16}$/.test(jshshir)) newErrors.jshshir = 'JSHSHIR 14-16 raqamdan iborat bo\'lishi kerak';
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
    setSubmitting(true);
    setNotification(null);
    try {
      const userId = Number(localStorage.getItem('userId'));
      const baseTotal = selectedItems.reduce((sum, item) => sum + Number(item.quantity) * Number(item.price), 0);
      const m = Number(months);
      const interestRate = Number(customInterestRate) / 100 || 0;
      const finalTotal = baseTotal * (1 + interestRate);
      const paid = Number(customerPaid) || 0;
      const remaining = paid < finalTotal ? finalTotal - paid : 0;
      const monthlyPayment = m > 0 && remaining > 0 ? remaining / m : 0;

      const payload = {
        type: 'SALE',
        status: 'PENDING',
        total: baseTotal,
        finalTotal,
        amountPaid: paid,
        userId,
        remainingBalance: remaining,
        paymentType: paymentType === 'INSTALLMENT' ? 'CREDIT' : paymentType,
        deliveryMethod: deliveryType,
         deliveryAddress: ((paymentType === 'CREDIT' || paymentType === 'INSTALLMENT') || deliveryType === 'DELIVERY') ? (deliveryAddress || undefined) : undefined, // Add delivery address
        customer: {
          fullName: `${firstName} ${lastName}`.trim(),
          phone: phone.replace(/\s+/g, ''),
          passportSeries: passportSeries || undefined, // Add passport series
          jshshir: jshshir || undefined, // Add JSHSHIR
          address: deliveryAddress || undefined,
        },
        fromBranchId: Number(selectedBranch),
        soldByUserId: Number(selectedSellerId), // MARKETING selected in UI
        items: selectedItems.map((item) => ({
          productId: item.id,
          productName: item.name,
          quantity: Number(item.quantity),
          price: Number(item.price),
          total: Number(item.quantity) * Number(item.price),
          ...(paymentType === 'CREDIT' || paymentType === 'INSTALLMENT' ? {
            creditMonth: m,
            creditPercent: interestRate,
            monthlyPayment,
          } : {}),
        })),
      };

      console.log('Submitting transaction:', JSON.stringify(payload, null, 2));

      const response = await axiosWithAuth({
        method: 'post',
        url: `${API_URL}/transactions`,
        data: payload,
      });

      setLastTransaction({
        ...response.data,
        customer: {
          firstName,
          lastName,
          phone,
          passportSeries, // Add passport series
          jshshir, // Add JSHSHIR
          ...(response.data.customer?.fullName && {
            firstName: response.data.customer.fullName.split(' ')[0] || firstName,
            lastName: response.data.customer.fullName.split(' ').slice(1).join(' ') || lastName
          })
        },
        seller: users.find(u => u.id === Number(selectedSellerId)),
        branch: branches.find(b => b.id === Number(selectedBranch)),
        items: selectedItems,
        paymentType,
        deliveryType, // Add delivery type
        deliveryAddress, // Add delivery address
        months: m,
        interestRate: Number(customInterestRate),
        paid: paid,
        remaining: remaining,
        monthlyPayment,
        total: baseTotal,
        finalTotal
      });

      if (paymentType === 'CREDIT' || paymentType === 'INSTALLMENT') {
        generatePDF();
      }
      setNotification({ message: 'Sotuv muvaffaqiyatli amalga oshirildi', type: 'success' });
      closeSelectedItemsModal();
      setShowReceiptModal(true);
      setSelectedItems([]); // Clear cart after successful sale
      loadData();
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Tranzaksiya yaratishda xatolik';
      setNotification({ message, type: 'error' });
      console.error('Submit error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const { totalWithInterest, monthlyPayment, schedule, change, remaining } = calculatePaymentSchedule();

  const selectedBranchName = branches.find((b) => b.id === Number(selectedBranchId))?.name || 'Filial topilmadi';

  return (
    <div className="ml-[255px] space-y-6 p-4">
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
                  <th className="p-3 text-left font-medium">Штрих-код</th>
                  <th className="p-3 text-left font-medium">Нарх</th>
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
                      <td className="p-3 text-gray-700">{product.barcode}</td>
                      <td className="p-3 text-gray-700">{formatAmount(product.marketPrice != null ? product.marketPrice : product.price)}</td>
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

                                // Check if item already exists in cart
                                const existingItemIndex = selectedItems.findIndex((item) => item.id === product.id);

                                if (existingItemIndex !== -1) {
                                  // Update existing item quantity
                                  setSelectedItems((prev) =>
                                    prev.map((item, index) =>
                                      index === existingItemIndex
                                        ? { ...item, quantity: Number(item.quantity) + quantity }
                                        : item
                                    )
                                  );
                                  setNotification({ message: `${product.name} миқдори янгиланди`, type: 'success' });
                                } else {
                                  // Add new item
                                  setSelectedItems([
                                    ...selectedItems,
                                    {
                                      id: product.id,
                                      name: product.name,
                                      quantity: quantity,
                                      price: (product.marketPrice != null ? product.marketPrice : product.price).toString(),
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
            <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50">
              <div className="bg-white rounded-lg p-8 w-full max-w-3xl overflow-y-auto max-h-[95vh]">
                <div className="flex justify-between items-center mb-6 sticky top-0 bg-white z-10">
                  <h3 className="text-2xl font-bold text-gray-800">Мижозга сотиш</h3>
                  <button
                    onClick={closeModal}
                    className="text-gray-600 hover:text-gray-800 font-bold text-xl"
                  >
                    &times;
                  </button>
                </div>
                <table className="w-full text-sm text-gray-700 border border-gray-200 shadow-md rounded-lg">
                  <tbody>
                    <tr className="border-b">
                      <td className="p-3 font-medium bg-gray-50">Филиал</td>
                      <td className="p-3">
                        <div className="w-full p-2 border border-gray-300 rounded-lg bg-gray-50">
                          {selectedBranchName}
                        </div>
                        {errors.branch && (
                          <span className="text-red-500 text-xs">{errors.branch}</span>
                        )}
                      </td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-3 font-medium bg-gray-50">Сотувчи</td>
                      <td className="p-3">
                        <select
                          value={selectedSellerId}
                          onChange={(e) => setSelectedSellerId(e.target.value)}
                          className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.seller ? 'border-red-500' : 'border-gray-300'}`}
                        >
                          <option value="">Сотувчи танланг</option>
                          {users.map((user) => (
                            <option key={user.id} value={user.id}>
                              {user.firstName} {user.lastName}
                            </option>
                          ))}
                        </select>
                        {errors.seller && (
                          <span className="text-red-500 text-xs">{errors.seller}</span>
                        )}
                      </td>
                    </tr>
                    {['CREDIT', 'INSTALLMENT'].includes(paymentType) && (
                      <>
                        <tr className="border-b">
                          <td className="p-3 font-medium bg-gray-50">Исм</td>
                          <td className="p-3">
                            <input
                              value={firstName}
                              onChange={(e) => setFirstName(e.target.value)}
                              className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.firstName ? 'border-red-500' : 'border-gray-300'}`}
                            />
                            {errors.firstName && (
                              <span className="text-red-500 text-xs">{errors.firstName}</span>
                            )}
                          </td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-3 font-medium bg-gray-50">Фамилия</td>
                          <td className="p-3">
                            <input
                              value={lastName}
                              onChange={(e) => setLastName(e.target.value)}
                              className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.lastName ? 'border-red-500' : 'border-gray-300'}`}
                            />
                            {errors.lastName && (
                              <span className="text-red-500 text-xs">{errors.lastName}</span>
                            )}
                          </td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-3 font-medium bg-gray-50">Телефон</td>
                          <td className="p-3">
                            <input
                              value={phone}
                              onChange={onPhoneChange}
                              onKeyDown={onPhoneKeyDown}
                              ref={phoneInputRef}
                              className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.phone ? 'border-red-500' : 'border-gray-300'}`}
                              placeholder="+998 XX XXX XX XX"
                              maxLength={18}
                            />
                            {errors.phone && (
                              <span className="text-red-500 text-xs">{errors.phone}</span>
                            )}
                          </td>
                        </tr>
                      </>
                    )}
                    <tr className="border-b">
                      <td className="p-3 font-medium bg-gray-50">Етказиб бериш тури</td>
                      <td className="p-3">
                        <select
                          value={deliveryType}
                          onChange={(e) => setDeliveryType(e.target.value)}
                          className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 border-gray-300"
                        >
                          <option value="PICKUP">Олиб кетиш</option>
                          <option value="DELIVERY">Етказиб бериш</option>
                        </select>
                      </td>
                    </tr>
                    {(deliveryType === 'DELIVERY' || ['CREDIT','INSTALLMENT'].includes(paymentType)) && (
                      <tr className="border-b">
                        <td className="p-3 font-medium bg-gray-50">Манзил</td>
                        <td className="p-3">
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
                        </td>
                      </tr>
                    )}
                    <tr className="border-b">
                      <td className="p-3 font-medium bg-gray-50">Тўлов тури</td>
                      <td className="p-3">
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
                        {errors.paymentType && (
                          <span className="text-red-500 text-xs">{errors.paymentType}</span>
                        )}
                      </td>
                    </tr>
                    {['CREDIT', 'INSTALLMENT'].includes(paymentType) && (
                      <>
                        <tr className="border-b">
                          <td className="p-3 font-medium bg-gray-50">Паспорт серияси</td>
                          <td className="p-3">
                            <input
                              type="text"
                              value={passportSeries}
                              onChange={(e) => setPassportSeries(e.target.value)}
                              placeholder="AA 1234567"
                              className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.passportSeries ? 'border-red-500' : 'border-gray-300'}`}
                            />
                            {errors.passportSeries && (
                              <span className="text-red-500 text-xs">{errors.passportSeries}</span>
                            )}
                          </td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-3 font-medium bg-gray-50">JSHSHIR</td>
                          <td className="p-3">
                            <input
                              type="text"
                              value={jshshir}
                              onChange={onJshshirChange}
                              placeholder="1234567890123456"
                              className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.jshshir ? 'border-red-500' : 'border-gray-300'}`}
                              maxLength={16}
                            />
                            {errors.jshshir && (
                              <span className="text-red-500 text-xs">{errors.jshshir}</span>
                            )}
                          </td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-3 font-medium bg-gray-50">Ойлар сони</td>
                          <td className="p-3">
                            <input
                              type="number"
                              value={months}
                              onChange={(e) => setMonths(e.target.value)}
                              className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.months ? 'border-red-500' : 'border-gray-300'}`}
                              min="1"
                              max="24"
                              step="1"
                            />
                            {errors.months && (
                              <span className="text-red-500 text-xs">{errors.months}</span>
                            )}
                          </td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-3 font-medium bg-gray-50">Фоиз (%)</td>
                          <td className="p-3">
                            <input
                              type="number"
                              value={customInterestRate}
                              onChange={(e) => setCustomInterestRate(e.target.value)}
                              className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.customInterestRate ? 'border-red-500' : 'border-gray-300'}`}
                              step="0.01"
                              min="0"
                            />
                            {errors.customInterestRate && (
                              <span className="text-red-500 text-xs">{errors.customInterestRate}</span>
                            )}
                          </td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-3 font-medium bg-gray-50">Мижоз тўлаган</td>
                          <td className="p-3">
                            <input
                              type="number"
                              value={customerPaid}
                              onChange={(e) => setCustomerPaid(e.target.value)}
                              className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 border-gray-300"
                              step="0.01"
                              min="0"
                            />
                          </td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-3 font-medium bg-gray-50">Умумий сумма</td>
                          <td className="p-3">{formatAmount(totalWithInterest)}</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-3 font-medium bg-gray-50">Қайтим</td>
                          <td className="p-3">{formatAmount(change)}</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-3 font-medium bg-gray-50">Қолган сумма</td>
                          <td className="p-3">{formatAmount(remaining)}</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-3 font-medium bg-gray-50">Ойлик тўлов</td>
                          <td className="p-3">{formatAmount(monthlyPayment)}</td>
                        </tr>
                      </>
                    )}
                    <tr className="border-b">
                      <td colSpan="2" className="p-3">
                        <h4 className="text-md font-bold mb-2">Маҳсулот танлаш</h4>
                        <div className="flex gap-2 mb-2">
                          <select
                            value={selectedProductId}
                            onChange={(e) => {
                              setSelectedProductId(e.target.value);
                              const product = products.find((p) => p.id === Number(e.target.value));
                              setTempPrice(product ? (product.marketPrice != null ? product.marketPrice.toString() : product.price.toString()) : '');
                            }}
                            className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            id="product-select"
                          >
                            <option value="">Маҳсулот танланг</option>
                            {products
                              .filter((p) => p.quantity > 0)
                              .map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} ({formatQuantity(p.quantity)} қолдиқ)
                                </option>
                              ))}
                          </select>
                          <input
                            type="number"
                            value={tempQuantity}
                            onChange={(e) => setTempQuantity(e.target.value)}
                            placeholder="Миқдор"
                            className="w-24 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            min="1"
                            step="1"
                            id="temp-quantity"
                          />
                          <input
                            type="number"
                            value={tempPrice}
                            onChange={(e) => setTempPrice(e.target.value)}
                            placeholder="Нарх"
                            className="w-24 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            step="0.01"
                            min="0"
                            id="temp-price"
                          />
                          <button
                            onClick={addItem}
                            className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors"
                            disabled={!selectedProductId || !tempQuantity}
                          >
                            Қўшиш
                          </button>
                        </div>
                        {errors.items && (
                          <span className="text-red-500 text-xs">{errors.items}</span>
                        )}
                      </td>
                    </tr>
                    {['CREDIT', 'INSTALLMENT'].includes(paymentType) && months && Number(months) > 0 && (
                      <tr className="border-b">
                        <td colSpan="2" className="p-3">
                          <h4 className="text-md font-bold mb-2">Тўлов жадвали</h4>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm border">
                              <thead>
                                <tr className="bg-gray-100">
                                  <th className="p-2">Ойлик</th>
                                  <th className="p-2">Тўлов суммаси</th>
                                  <th className="p-2">Қолдиқ сумма</th>
                                </tr>
                              </thead>
                              <tbody>
                                {schedule.map((row) => (
                                  <tr key={row.month} className="border-t">
                                    <td className="p-2">{row.month}</td>
                                    <td className="p-2">{formatAmount(row.payment)}</td>
                                    <td className="p-2">{formatAmount(row.remainingBalance)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="flex-1 bg-blue-500 text-white p-3 rounded-lg hover:bg-blue-600 disabled:bg-gray-400 transition-colors"
                  >
                    {submitting ? 'Юкланмоқда...' : 'Сақлаш'}
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
                        <th className="p-3 text-left font-medium">Нарх</th>
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
                              value={item.price}
                              onChange={(e) => updateItem(index, 'price', e.target.value)}
                              className={`w-24 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors[`price_${index}`] ? 'border-red-500' : 'border-gray-300'}`}
                              step="0.01"
                              min="0"
                            />
                            {errors[`price_${index}`] && (
                              <span className="text-red-500 text-xs block">{errors[`price_${index}`]}</span>
                            )}
                          </td>
                          <td className="p-3">
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                              className={`w-20 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors[`quantity_${index}`] ? 'border-red-500' : 'border-gray-300'}`}
                              min="1"
                              max={item.maxQuantity}
                              step="1"
                            />
                            {errors[`quantity_${index}`] && (
                              <span className="text-red-500 text-xs block">{errors[`quantity_${index}`]}</span>
                            )}
                          </td>
                          <td className="p-3 font-medium">
                            {formatAmount(Number(item.quantity) * Number(item.price))}
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
                          value={selectedSellerId}
                          onChange={(e) => setSelectedSellerId(e.target.value)}
                          className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.seller ? 'border-red-500' : 'border-gray-300'}`}
                        >
                          <option value="">Сотувчи танланг</option>
                          {users.map((user) => (
                            <option key={user.id} value={user.id}>
                              {user.firstName} {user.lastName}
                            </option>
                          ))}
                        </select>
                        {errors.seller && (
                          <span className="text-red-500 text-xs">{errors.seller}</span>
                        )}
                      </div>
                      {['CREDIT', 'INSTALLMENT'].includes(paymentType) && (
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
                      {(deliveryType === 'DELIVERY' || ['CREDIT','INSTALLMENT'].includes(paymentType)) && (
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
                        {errors.paymentType && (
                          <span className="text-red-500 text-xs">{errors.paymentType}</span>
                        )}
                      </div>
                      {['CREDIT', 'INSTALLMENT'].includes(paymentType) && (
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
                            {errors.passportSeries && (
                              <span className="text-red-500 text-xs">{errors.passportSeries}</span>
                            )}
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">JSHSHIR</label>
                            <input
                              type="text"
                              value={jshshir}
                              onChange={onJshshirChange}
                              placeholder="1234567890123456"
                              className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.jshshir ? 'border-red-500' : 'border-gray-300'}`}
                              maxLength={16}
                            />
                            {errors.jshshir && (
                              <span className="text-red-500 text-xs">{errors.jshshir}</span>
                            )}
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Ойлар сони</label>
                            <input
                              type="number"
                              value={months}
                              onChange={(e) => setMonths(e.target.value)}
                              className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.months ? 'border-red-500' : 'border-gray-300'}`}
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
                              value={customInterestRate}
                              onChange={(e) => setCustomInterestRate(e.target.value)}
                              className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.customInterestRate ? 'border-red-500' : 'border-gray-300'}`}
                              step="0.01"
                              min="0"
                            />
                            {errors.customInterestRate && (
                              <span className="text-red-500 text-xs">{errors.customInterestRate}</span>
                            )}
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Мижоз тўлаган</label>
                            <input
                              type="number"
                              value={customerPaid}
                              onChange={(e) => setCustomerPaid(e.target.value)}
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

                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <h4 className="text-md font-semibold mb-3">Жами</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Асосий сумма:</span>
                      <span className="font-medium ml-2">{formatAmount(selectedItems.reduce((sum, item) => sum + Number(item.quantity) * Number(item.price), 0))}</span>
                    </div>
                    {['CREDIT', 'INSTALLMENT'].includes(paymentType) && (
                      <>
                        <div>
                          <span className="text-gray-600">Фоиз билан:</span>
                          <span className="font-medium ml-2">{formatAmount(totalWithInterest)}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Тўланган:</span>
                          <span className="font-medium ml-2">{formatAmount(Number(customerPaid) || 0)}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Қолган:</span>
                          <span className="font-medium ml-2">{formatAmount(remaining)}</span>
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
{showReceiptModal && lastTransaction && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg shadow-xl w-[90%] max-w-md mx-auto">
      <Receipt
        transaction={lastTransaction}
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
              <meta charset="utf-8">
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
                <h2>Aminov Savdo Tizimi</h2>
                <p class="total-row">${formatDate(new Date())}</p>
              </div>
              
              <div class="info">
                <div class="total-row">
                  <span>ID:</span>
                  <span>#${lastTransaction.id}</span>
                </div>
                <div class="total-row">
                  <span>Mijoz:</span>
                  <span>${lastTransaction.customer.fullName || `${lastTransaction.customer.firstName} ${lastTransaction.customer.lastName}`}</span>
                </div>
                <div class="total-row">
                  <span>Tel:</span>
                  <span>${lastTransaction.customer.phone}</span>
                </div>
                ${lastTransaction.customer.passportSeries ? `
                <div class="total-row">
                  <span>Passport:</span>
                  <span>${lastTransaction.customer.passportSeries}</span>
                </div>
                ` : ''}
                ${lastTransaction.customer.jshshir ? `
                <div class="total-row">
                  <span>JSHSHIR:</span>
                  <span>${lastTransaction.customer.jshshir}</span>
                </div>
                ` : ''}
                <div class="total-row">
                  <span>Filial:</span>
                  <span>${lastTransaction.branch?.name}</span>
                </div>
                <div class="total-row">
                  <span>To'lov:</span>
                  <span>${lastTransaction.paymentType === 'CASH' ? 'Naqd' :
              lastTransaction.paymentType === 'CARD' ? 'Karta' :
                lastTransaction.paymentType === 'CREDIT' ? 'Kredit' :
                  lastTransaction.paymentType === 'INSTALLMENT' ? "Bo'lib to'lash" : lastTransaction.paymentType}</span>
                </div>
                <div class="total-row">
                  <span>Yetkazib berish:</span>
                  <span>${lastTransaction.deliveryType === 'PICKUP' ? 'Olib ketish' :
              lastTransaction.deliveryType === 'DELIVERY' ? 'Yetkazib berish' :
                lastTransaction.deliveryType}</span>
                </div>
                ${lastTransaction.deliveryType === 'DELIVERY' && lastTransaction.deliveryAddress ? `
                <div class="total-row">
                  <span>Manzil:</span>
                  <span>${lastTransaction.deliveryAddress}</span>
                </div>
                ` : ''}
              </div>
              <div class="products">
                <h4>MAHSULOTLAR</h4>
                ${lastTransaction.items.map((item, index) => `
                  <div class="total-row">
                    <span>${item.name} x${item.quantity}</span>
                    <span>${formatAmount(Number(item.quantity) * Number(item.price))}</span>
                  </div>
                `).join('')}
              </div>

              <div class="total">
                <div class="total-row">
                  <span>JAMI:</span>
                  <span>${formatAmount(lastTransaction.finalTotal)}</span>
                </div>
                ${['CREDIT', 'INSTALLMENT'].includes(lastTransaction.paymentType) ? `
                  <div class="total-row">
                    <span>To'langan:</span>
                    <span>${formatAmount(lastTransaction.paid)}</span>
                  </div>
                  <div class="total-row">
                    <span>Qolgan:</span>
                    <span>${formatAmount(lastTransaction.remaining)}</span>
                  </div>
                  <div class="total-row">
                    <span>Oylik:</span>
                    <span>${formatAmount(lastTransaction.monthlyPayment)}</span>
                  </div>
                ` : ''}
              </div>
              
              <div class="total-row">
                <p>Tashrifingiz uchun rahmat!</p>
              </div>
               <div class="total">
               </div>
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

export default SalesManagement;