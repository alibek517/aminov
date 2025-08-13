import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const Chiqim = () => {
  const [products, setProducts] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [transactionType, setTransactionType] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [toBranch, setToBranch] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [paymentType, setPaymentType] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [months, setMonths] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [notification, setNotification] = useState(null);
  const navigate = useNavigate();
  const API_URL = 'https://suddocs.uz';

  const formatCurrency = (amount) => 
    amount != null && Number.isFinite(Number(amount)) 
      ? new Intl.NumberFormat('uz-UZ').format(Number(amount)) + " so'm" 
      : "Noma'lum";
  const formatQuantity = (qty) => 
    qty != null && Number.isFinite(Number(qty)) 
      ? new Intl.NumberFormat('uz-UZ').format(Number(qty)) + ' dona' 
      : '0 dona';
  const formatDate = (date) => 
    date ? new Date(date).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' }) : "Noma'lum";

  const getInterestRate = (months) => {
    const m = Number(months);
    if (!m || m <= 0) return 0;
    if (m <= 3) return 0.05; // 5% for 3 months
    if (m <= 6) return 0.10; // 10% for 6 months
    if (m <= 12) return 0.15; // 15% for 12 months
    return 0.20; // 20% for 24+ months
  };

  const calculatePaymentSchedule = () => {
    const qty = Number(quantity);
    const prc = Number(price);
    const m = Number(months);
    if (!qty || !prc || !m || m <= 0) return { totalWithInterest: 0, monthlyPayment: 0, schedule: [] };

    const baseTotal = qty * prc;
    const interestRate = getInterestRate(m);
    const totalWithInterest = baseTotal * (1 + interestRate);
    const monthlyPayment = totalWithInterest / m;
    const schedule = [];

    let remainingBalance = totalWithInterest;
    for (let i = 1; i <= m; i++) {
      schedule.push({
        month: i,
        payment: monthlyPayment,
        remainingBalance: Math.max(0, remainingBalance - monthlyPayment)
      });
      remainingBalance -= monthlyPayment;
    }

    return { totalWithInterest, monthlyPayment, schedule };
  };

  const generatePDF = () => {
    if (!selectedProduct) return;
    const qty = Number(quantity);
    const prc = Number(price);
    const m = Number(months);
    const { totalWithInterest, monthlyPayment, schedule } = calculatePaymentSchedule();
    const branchName = branches.find(b => b.id === Number(selectedBranch))?.name || 'Noma\'lum';
    const date = formatDate(new Date());

    const escapeLatex = (str) => {
      if (!str) return 'Noma\'lum';
      return str.replace(/[&%$#_{}~^\\]/g, '\\$&')
               .replace(/ā/g, '\\=a')
               .replace(/ū/g, '\\=u');
    };

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
  Mahsulot: ${escapeLatex(selectedProduct.name)}\\\\
  Filial: ${escapeLatex(branchName)}\\\\
  Sana: ${escapeLatex(date)}\\\\
  Miqdor: ${formatQuantity(qty)}\\\\
  Narx: ${formatCurrency(prc)}\\\\
  To'lov Turi: ${paymentType === 'CREDIT' ? 'Kredit' : 'Bolib Tolash'}\\\\
  Muddat: ${m} oy\\\\
  Foiz: ${(getInterestRate(m) * 100).toFixed(2)}\\%\\\\
  Umumiy Summa (foiz bilan): ${formatCurrency(totalWithInterest)}\\\\
  Oylik To'lov: ${formatCurrency(monthlyPayment)}\\\\
  Mijoz: ${escapeLatex(firstName)} ${escapeLatex(lastName)}, Telefon: ${escapeLatex(phone)}
\\end{center}

\\vspace{0.5cm}

\\begin{table}[h]
\\centering
\\begin{tabular}{ccc}
\\toprule
Oylik & To'lov Summasi & Qoldiq Summa \\\\
\\midrule
${schedule.map(row => `${row.month} & ${formatCurrency(row.payment)} & ${formatCurrency(row.remainingBalance)}\\\\`).join('\n')}
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
    link.download = `payment_schedule_${selectedProduct.id}_${Date.now()}.tex`;
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

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const branchesRes = await axiosWithAuth({ method: 'get', url: `${API_URL}/branches` });
        const branchesData = Array.isArray(branchesRes.data) ? branchesRes.data : branchesRes.data.branches || [];
        setBranches(branchesData);
        const omborBranch = branchesData.find((b) => b.name?.toLowerCase() === 'ombor');
        if (omborBranch) {
          setSelectedBranchId(omborBranch.id.toString());
        } else {
          setNotification({ message: '"Ombor" filiali topilmadi', type: 'warning' });
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
          url: `${API_URL}/products?${queryParams.toString()}&page=${page}` 
        });
        const productsData = Array.isArray(productsRes.data) ? productsRes.data : productsRes.data.products || [];
        allProducts = [...allProducts, ...productsData];
        if (!productsRes.data.nextPage) break;
        page++;
      }
      setProducts(allProducts.map(product => ({
        ...product,
        name: product.name ?? product.productName ?? product.title ?? product.item_name ?? 
              product.product_title ?? product.item_title ?? `Product ${product.id}`,
        price: Number(product.price) || 0,
        quantity: Number(product.quantity) || 0,
      })));
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

  const openModal = (product, type) => {
    setSelectedProduct({
      ...product,
      name: product.name ?? product.productName ?? product.title ?? product.item_name ?? 
            product.product_title ?? product.item_title ?? `Product ${product.id}`,
    });
    setTransactionType(type);
    setQuantity('');
    setPrice(product.price && Number.isFinite(Number(product.price)) ? product.price.toString() : '0');
    setSelectedBranch(product.branchId ? product.branchId.toString() : selectedBranchId || '');
    setToBranch('');
    setFirstName('');
    setLastName('');
    setPhone('');
    setPaymentType('');
    setMonths('');
    setErrors({});
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedProduct(null);
    setTransactionType('');
    setQuantity('');
    setPrice('');
    setSelectedBranch('');
    setToBranch('');
    setFirstName('');
    setLastName('');
    setPhone('');
    setPaymentType('');
    setMonths('');
    setErrors({});
    setNotification(null);
  };

  const validateFields = () => {
    const newErrors = {};
    if (!transactionType) newErrors.transactionType = 'Tranzaksiya turi tanlanishi shart';
    if (!quantity || isNaN(quantity) || Number(quantity) <= 0 || !Number.isInteger(Number(quantity))) {
      newErrors.quantity = 'Miqdor 0 dan katta butun son bo\'lishi kerak';
    } else if (selectedProduct && Number(quantity) > selectedProduct.quantity) {
      newErrors.quantity = `Maksimal miqdor: ${selectedProduct.quantity} dona`;
    }
    if (transactionType === 'SALE' && (!price || isNaN(price) || Number(price) < 0)) {
      newErrors.price = 'Narx 0 dan katta yoki teng bo\'lishi kerak';
    }
    if (!selectedBranch) {
      newErrors.branch = 'Filial tanlanishi shart';
    }
    if (transactionType === 'TRANSFER' && !toBranch) {
      newErrors.toBranch = 'O\'tkaziladigan filial tanlanishi shart';
    }
    if (transactionType === 'TRANSFER' && Number(toBranch) === Number(selectedBranch)) {
      newErrors.toBranch = 'O\'tkaziladigan filial boshqa bo\'lishi kerak';
    }
    if (transactionType === 'SALE') {
      if (!firstName.trim()) newErrors.firstName = 'Ism kiritilishi shart';
      if (!lastName.trim()) newErrors.lastName = 'Familiya kiritilishi shart';
      if (!phone.trim() || !/^\+?[1-9]\d{1,14}$/.test(phone)) newErrors.phone = 'Telefon raqami to\'g\'ri kiritilishi shart';
      if (!paymentType) newErrors.paymentType = 'To\'lov turi tanlanishi shart';
      if ((paymentType === 'CREDIT' || paymentType === 'INSTALLMENT') && 
          (!months || isNaN(months) || Number(months) <= 0 || !Number.isInteger(Number(months)) || Number(months) > 24)) {
        newErrors.months = 'Oylar soni 1 dan 24 gacha butun son bo\'lishi kerak';
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateFields()) {
      setNotification({ message: 'Barcha maydonlarni to\'g\'ri to\'ldiring', type: 'error' });
      return;
    }
    setSubmitting(true);
    setNotification(null);
    try {
      const userId = Number(localStorage.getItem('userId')) || 1;
      if (transactionType === 'SALE') {
        const qty = Number(quantity);
        const prc = Number(price);
        const m = Number(months);
        const baseTotal = qty * prc;
        const interestRate = (paymentType === 'CREDIT' || paymentType === 'INSTALLMENT') ? getInterestRate(m) : 0;
        const finalTotal = baseTotal * (1 + interestRate);
        const payload = {
          userId,
          type: 'SALE',
          status: 'PENDING',
          total: baseTotal,
          finalTotal,
          paymentType: paymentType === 'INSTALLMENT' ? 'CREDIT' : paymentType,
          customer: {
            firstName,
            lastName,
            phone,
          },
          branchId: Number(selectedBranch),
          items: [{
            productId: selectedProduct.id,
            productName: selectedProduct.name,
            quantity: qty,
            price: prc,
            total: baseTotal,
          }],
          ...(paymentType === 'CREDIT' || paymentType === 'INSTALLMENT' ? { months: m, interestRate } : {}),
        };
        console.log('Submitting SALE transaction:', payload);
        const response = await axiosWithAuth({
          method: 'post',
          url: `${API_URL}/transactions`,
          data: payload,
        });
        console.log('SALE transaction response:', response.data);
        if (paymentType === 'CREDIT' || paymentType === 'INSTALLMENT') {
          generatePDF();
        }
        setNotification({ message: 'Sotuv muvaffaqiyatli amalga oshirildi', type: 'success' });
      } else if (transactionType === 'TRANSFER') {
        const qty = Number(quantity);
        const toBranchName = branches.find(b => b.id === Number(toBranch))?.name || 'Noma\'lum';
        const transferPayload = {
          productId: selectedProduct.id,
          productName: selectedProduct.name,
          fromBranchId: Number(selectedBranch),
          toBranchId: Number(toBranch),
          quantity: qty,
          initiatedById: userId,
          transferDate: new Date().toISOString(),
        };
        const transactionPayload = {
          userId,
          type: 'TRANSFER',
          status: 'PENDING',
          total: 0,
          finalTotal: 0,
          branchId: Number(selectedBranch),
          toBranchId: Number(toBranch),
          toBranchName,
          items: [{
            productId: selectedProduct.id,
            productName: selectedProduct.name,
            quantity: qty,
            price: 0,
            total: 0,
          }],
        };
        console.log('Submitting TRANSFER to /product-transfers:', transferPayload);
        console.log('Submitting TRANSFER to /transactions:', transactionPayload);
        const [transferResponse, transactionResponse] = await Promise.all([
          axiosWithAuth({
            method: 'post',
            url: `${API_URL}/product-transfers`,
            data: transferPayload,
          }).catch(err => {
            throw new Error(`Product transfer failed: ${err.response?.data?.message || err.message}`);
          }),
          axiosWithAuth({
            method: 'post',
            url: `${API_URL}/transactions`,
            data: transactionPayload,
          }).catch(err => {
            throw new Error(`Transaction recording failed: ${err.response?.data?.message || err.message}`);
          }),
        ]);
        console.log('TRANSFER /product-transfers response:', transferResponse.data);
        console.log('TRANSFER /transactions response:', transactionResponse.data);
        setNotification({ message: 'Tovar o\'tkazmasi muvaffaqiyatli amalga oshirildi', type: 'success' });
      }
      closeModal();
      loadData();
    } catch (err) {
      const message = err.message || 'Tranzaksiya yaratishda xatolik';
      setNotification({ message, type: 'error' });
      console.error('Submit error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const { totalWithInterest, monthlyPayment, schedule } = calculatePaymentSchedule();

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Chiqim</h1>
      <select
        value={selectedBranchId}
        onChange={(e) => setSelectedBranchId(e.target.value)}
        className="w-full p-2 border rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
      >
        <option value="">Filial tanlang</option>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>{b.name}</option>
        ))}
      </select>
      {notification && (
        <div className={`p-4 rounded-lg flex items-center gap-3 mb-4 ${
          notification.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 
          'bg-green-50 text-green-700 border border-green-200'
        }`}>
          <span>{notification.message}</span>
          <button className="text-sm underline hover:no-underline transition-all" onClick={() => setNotification(null)}>Yopish</button>
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
          <span className="ml-2">Yuklanmoqda...</span>
        </div>
      ) : (
        <>
          <h2 className="text-xl font-bold mb-2 text-gray-800">Mahsulotlar Qoldig'i</h2>
          <div className="overflow-x-auto bg-white rounded-lg shadow">
            <table className="w-full border">
              <thead>
                <tr className="bg-gray-100 text-left">
                  <th className="p-3">ID</th>
                  <th className="p-3">Nomi</th>
                  <th className="p-3">Filial</th>
                  <th className="p-3">Narx</th>
                  <th className="p-3">Miqdor</th>
                  <th className="p-3">Amallar</th>
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
                      <td className="p-3 flex gap-2">
                        <button
                          onClick={() => openModal(product, 'SALE')}
                          className="bg-red-500 text-white px-3 py-1 rounded-lg hover:bg-red-600 disabled:bg-gray-400 transition-all duration-200"
                          disabled={submitting || product.quantity === 0}
                        >
                          Mijozga Sotish
                        </button>
                        <button
                          onClick={() => openModal(product, 'TRANSFER')}
                          className="bg-blue-500 text-white px-3 py-1 rounded-lg hover:bg-blue-600 disabled:bg-gray-400 transition-all duration-200"
                          disabled={submitting || product.quantity === 0}
                        >
                          Filialga O'tkazish
                        </button>
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
          {showModal && selectedProduct && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-full max-w-lg">
                <div className="flex justify-between mb-4">
                  <h3 className="text-lg font-bold">{transactionType === 'SALE' ? 'Mijozga Sotish' : 'Filialga O\'tkazish'}</h3>
                  <button onClick={closeModal} className="text-gray-600 hover:text-gray-800 transition-all">X</button>
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    <tr>
                      <td className="py-2">Mahsulot</td>
                      <td className="py-2">{selectedProduct.name}</td>
                    </tr>
                    <tr>
                      <td className="py-2">Filial (dan)</td>
                      <td>
                        <select
                          value={selectedBranch}
                          onChange={(e) => setSelectedBranch(e.target.value)}
                          className={`w-full p-1 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.branch ? 'border-red-500' : ''}`}
                        >
                          <option value="">Tanlang</option>
                          {branches.map((b) => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                          ))}
                        </select>
                        {errors.branch && <span className="text-red-500 text-xs">{errors.branch}</span>}
                      </td>
                    </tr>
                    {transactionType === 'TRANSFER' && (
                      <tr>
                        <td className="py-2">Filial (ga)</td>
                        <td>
                          <select
                            value={toBranch}
                            onChange={(e) => setToBranch(e.target.value)}
                            className={`w-full p-1 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.toBranch ? 'border-red-500' : ''}`}
                          >
                            <option value="">Tanlang</option>
                            {branches.filter(b => b.id !== Number(selectedBranch)).map((b) => (
                              <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                          </select>
                          {errors.toBranch && <span className="text-red-500 text-xs">{errors.toBranch}</span>}
                        </td>
                      </tr>
                    )}
                    {transactionType === 'SALE' && (
                      <>
                        <tr>
                          <td className="py-2">Ism</td>
                          <td>
                            <input
                              value={firstName}
                              onChange={(e) => setFirstName(e.target.value)}
                              className={`w-full p-1 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.firstName ? 'border-red-500' : ''}`}
                            />
                            {errors.firstName && <span className="text-red-500 text-xs">{errors.firstName}</span>}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2">Familiya</td>
                          <td>
                            <input
                              value={lastName}
                              onChange={(e) => setLastName(e.target.value)}
                              className={`w-full p-1 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.lastName ? 'border-red-500' : ''}`}
                            />
                            {errors.lastName && <span className="text-red-500 text-xs">{errors.lastName}</span>}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2">Telefon</td>
                          <td>
                            <input
                              value={phone}
                              onChange={(e) => setPhone(e.target.value)}
                              className={`w-full p-1 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.phone ? 'border-red-500' : ''}`}
                            />
                            {errors.phone && <span className="text-red-500 text-xs">{errors.phone}</span>}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2">To'lov Turi</td>
                          <td>
                            <select
                              value={paymentType}
                              onChange={(e) => setPaymentType(e.target.value)}
                              className={`w-full p-1 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.paymentType ? 'border-red-500' : ''}`}
                            >
                              <option value="">Tanlang</option>
                              <option value="CASH">Naqd</option>
                              <option value="CARD">Karta</option>
                              <option value="CREDIT">Kredit</option>
                              <option value="INSTALLMENT">Bo'lib To'lash</option>
                            </select>
                            {errors.paymentType && <span className="text-red-500 text-xs">{errors.paymentType}</span>}
                          </td>
                        </tr>
                        {['CREDIT', 'INSTALLMENT'].includes(paymentType) && (
                          <>
                            <tr>
                              <td className="py-2">Oylar Soni</td>
                              <td>
                                <input
                                  type="number"
                                  value={months}
                                  onChange={(e) => setMonths(e.target.value)}
                                  className={`w-full p-1 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.months ? 'border-red-500' : ''}`}
                                  min="1"
                                  max="24"
                                  step="1"
                                />
                                {errors.months && <span className="text-red-500 text-xs">{errors.months}</span>}
                              </td>
                            </tr>
                            <tr>
                              <td className="py-2">Foiz</td>
                              <td>{Number(months) > 0 ? (getInterestRate(months) * 100).toFixed(2) + '%' : 'Noma\'lum'}</td>
                            </tr>
                            <tr>
                              <td className="py-2">Umumiy Summa</td>
                              <td>{formatCurrency(totalWithInterest)}</td>
                            </tr>
                            <tr>
                              <td className="py-2">Oylik To'lov</td>
                              <td>{formatCurrency(monthlyPayment)}</td>
                            </tr>
                          </>
                        )}
                        <tr>
                          <td className="py-2">Narx</td>
                          <td>
                            <input
                              type="number"
                              value={price}
                              onChange={(e) => setPrice(e.target.value)}
                              className={`w-full p-1 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.price ? 'border-red-500' : ''}`}
                              step="0.01"
                              min="0"
                            />
                            {errors.price && <span className="text-red-500 text-xs">{errors.price}</span>}
                          </td>
                        </tr>
                      </>
                    )}
                    <tr>
                      <td className="py-2">Miqdor</td>
                      <td>
                        <input
                          type="number"
                          value={quantity}
                          onChange={(e) => setQuantity(e.target.value)}
                          className={`w-full p-1 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.quantity ? 'border-red-500' : ''}`}
                          min="1"
                          step="1"
                        />
                        {errors.quantity && <span className="text-red-500 text-xs">{errors.quantity}</span>}
                      </td>
                    </tr>
                  </tbody>
                </table>
                {['CREDIT', 'INSTALLMENT'].includes(paymentType) && months && Number(months) > 0 && (
                  <div className="mt-4">
                    <h4 className="text-md font-bold mb-2">To'lov Jadvali</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="p-2">Oylik</th>
                            <th className="p-2">To'lov Summasi</th>
                            <th className="p-2">Qoldiq Summa</th>
                          </tr>
                        </thead>
                        <tbody>
                          {schedule.map((row) => (
                            <tr key={row.month} className="border-t">
                              <td className="p-2">{row.month}</td>
                              <td className="p-2">{formatCurrency(row.payment)}</td>
                              <td className="p-2">{formatCurrency(row.remainingBalance)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="flex-1 bg-blue-500 text-white p-2 rounded-lg disabled:bg-gray-400 hover:bg-blue-600 transition-all duration-200"
                  >
                    {submitting ? 'Yuklanmoqda...' : 'Saqlash'}
                  </button>
                  <button
                    onClick={closeModal}
                    className="flex-1 bg-gray-200 p-2 rounded-lg hover:bg-gray-300 transition-all duration-200"
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

export default Chiqim;