import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const SalesManagement = () => {
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
  const [deliveryType, setDeliveryType] = useState('');
  const [address, setAddress] = useState('');
  const [passportSeries, setPassportSeries] = useState('');
  const [passportNumber, setPassportNumber] = useState('');
  const [jshshir, setJshshir] = useState('');
  const [creditMonths, setCreditMonths] = useState('');
  const [creditInterest, setCreditInterest] = useState('');
  const [initialPayment, setInitialPayment] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [notification, setNotification] = useState(null);
  const navigate = useNavigate();
  const API_URL = 'https://suddocs.uz';

  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined || isNaN(amount)) {
      return "0 so'm";
    }
    if (amount < 0) {
      return `-${new Intl.NumberFormat('uz-UZ').format(Math.abs(amount))} so'm`;
    }
    return new Intl.NumberFormat('uz-UZ').format(amount) + " so'm";
  };

  const formatQuantity = (qty) => (qty >= 0 ? new Intl.NumberFormat('uz-UZ').format(qty) + ' dona' : '0 dona');

  const axiosWithAuth = async (config) => {
    const token = localStorage.getItem('access_token') || 'mock-token';
    const headers = { ...config.headers, Authorization: `Bearer ${token}` };
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

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const branchesRes = await axiosWithAuth({ method: 'get', url: `${API_URL}/branches` });
        setBranches(branchesRes.data);
      } catch (err) {
        setNotification({ message: err.message || 'Filiallarni yuklashda xatolik', type: 'error' });
      }
    };
    fetchBranches();

    const branchId = localStorage.getItem('branchId');
    if (branchId && !isNaN(branchId) && Number.isInteger(Number(branchId)) && Number(branchId) > 0) {
      setSelectedBranchId(branchId);
    } else {
      setNotification({ message: 'Filial ID topilmadi yoki noto‘g‘ri', type: 'error' });
    }
  }, [navigate]);

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
      const productsRes = await axiosWithAuth({
        method: 'get',
        url: `${API_URL}/products?${queryParams.toString()}`,
      });
      const sortedProducts = productsRes.data.sort((a, b) => b.quantity - a.quantity);
      setProducts(sortedProducts);
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

  const openModal = (product, type) => {
    setSelectedProduct(product);
    setTransactionType(type);
    setQuantity('');
    setPrice(product.price ? product.price.toString() : '0');
    if (type === 'SALE') {
      setSelectedBranch(localStorage.getItem('branchId') || '');
    } else {
      setSelectedBranch(product.branchId ? product.branchId.toString() : selectedBranchId || '');
    }
    setToBranch('');
    setFirstName('');
    setLastName('');
    setPhone('');
    setPaymentType('');
    setDeliveryType('');
    setAddress('');
    setPassportSeries('');
    setPassportNumber('');
    setJshshir('');
    setCreditMonths('');
    setCreditInterest('');
    setInitialPayment('');
    setPaidAmount('');
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
    setDeliveryType('');
    setAddress('');
    setPassportSeries('');
    setPassportNumber('');
    setJshshir('');
    setCreditMonths('');
    setCreditInterest('');
    setInitialPayment('');
    setPaidAmount('');
    setErrors({});
    setNotification(null);
  };

  const validateFields = () => {
    const newErrors = {};
    const total = Number(quantity) * Number(price);

    if (!transactionType) newErrors.transactionType = 'Tranzaksiya turi tanlanishi shart';
    if (!quantity || isNaN(quantity) || Number(quantity) <= 0) {
      newErrors.quantity = "Miqdor 0 dan katta bo'lishi kerak";
    } else if (Number(quantity) > selectedProduct.quantity) {
      newErrors.quantity = `Maksimal miqdor: ${selectedProduct.quantity} dona`;
    }
    if (transactionType === 'SALE' && (!price || isNaN(price) || Number(price) < 0)) {
      newErrors.price = "Narx 0 dan katta yoki teng bo'lishi kerak";
    }
    if (!selectedBranch) {
      newErrors.branch = 'Filial tanlanishi shart';
    }
    if (transactionType === 'TRANSFER' && !toBranch) {
      newErrors.toBranch = "O'tkaziladigan filial tanlanishi shart";
    }
    if (transactionType === 'TRANSFER' && Number(toBranch) === Number(selectedBranch)) {
      newErrors.toBranch = "O'tkaziladigan filial boshqa bo'lishi kerak";
    }
    if (transactionType === 'SALE') {
      if (!firstName.trim()) newErrors.firstName = 'Ism kiritilishi shart';
      if (!lastName.trim()) newErrors.lastName = 'Familiya kiritilishi shart';
      if (!phone.trim()) newErrors.phone = 'Telefon kiritilishi shart';
      if (!paymentType) newErrors.paymentType = "To'lov turi tanlanishi shart";
      if (!deliveryType) newErrors.deliveryType = "Yetkazib berish turi tanlanishi shart";
      if (deliveryType === 'DELIVERY' && !address.trim()) newErrors.address = "Manzil kiritilishi shart";
      if (paymentType === 'CREDIT') {
        if (!passportSeries.trim()) newErrors.passportSeries = "Pasport seriyasi kiritilishi shart";
        if (!passportNumber.trim()) newErrors.passportNumber = "Pasport raqami kiritilishi shart";
        if (!jshshir.trim()) newErrors.jshshir = "JSHSHIR kiritilishi shart";
        if (!creditMonths || isNaN(creditMonths) || Number(creditMonths) <= 0) {
          newErrors.creditMonths = "Oylar soni 0 dan katta bo'lishi kerak";
        }
        if (!creditInterest || isNaN(creditInterest) || Number(creditInterest) < 0) {
          newErrors.creditInterest = "Foiz 0 dan katta yoki teng bo'lishi kerak";
        }
        if (!initialPayment || isNaN(initialPayment) || Number(initialPayment) < 0 || Number(initialPayment) > total) {
          newErrors.initialPayment = `Birinchi to'lov 0 va ${formatCurrency(total)} dan kichik bo'lishi kerak`;
        }
      }
      if (paymentType === 'CASH') {
        if (!paidAmount || isNaN(paidAmount) || Number(paidAmount) < 0) {
          newErrors.paidAmount = "Bergan summa 0 dan katta yoki teng bo'lishi kerak";
        } else if (Number(paidAmount) < total) {
          newErrors.paidAmount = `Yana ${formatCurrency(total - Number(paidAmount))} to'lash kerak`;
        }
      }
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
      const userId = Number(localStorage.getItem('userId')) || 1;
      if (transactionType === 'SALE') {
        const qty = Number(quantity);
        const prc = Number(price);
        let total = qty * prc;
        let finalTotal = total;
        if (paymentType === 'CREDIT') {
          const loan = total - Number(initialPayment);
          finalTotal = loan * (1 + Number(creditInterest) / 100);
        }
        const payload = {
          userId,
          type: 'SALE',
          status: 'PENDING',
          total,
          finalTotal,
          paymentType,
          deliveryType,
          deliveryAddress: deliveryType === 'DELIVERY' ? address : null,
          customer: {
            firstName,
            lastName,
            phone,
            ...(paymentType === 'CREDIT' ? { passportSeries, passportNumber, jshshir } : {}),
          },
          branchId: Number(selectedBranch),
          items: [
            {
              productId: selectedProduct.id,
              quantity: qty,
              price: prc,
              total,
            },
          ],
        };
        if (paymentType === 'CREDIT') {
          payload.creditMonths = Number(creditMonths);
          payload.creditInterest = Number(creditInterest);
          payload.initialPayment = Number(initialPayment);
        }
        await axiosWithAuth({
          method: 'post',
          url: `${API_URL}/transactions`,
          data: payload,
        });
        setNotification({ message: 'Sotuv muvaffaqiyatli amalga oshirildi', type: 'success' });
      } else if (transactionType === 'TRANSFER') {
        const payload = {
          productId: selectedProduct.id,
          fromBranchId: Number(selectedBranch),
          toBranchId: Number(toBranch),
          quantity: Number(quantity),
          initiatedById: userId,
          transferDate: new Date().toISOString(),
        };
        await axiosWithAuth({
          method: 'post',
          url: `${API_URL}/product-transfers`,
          data: payload,
        });
        setNotification({ message: "Tovar o'tkazmasi muvaffaqiyatli amalga oshirildi", type: 'success' });
      }
      closeModal();
      loadData();
    } catch (err) {
      const message = err.response?.data?.message || 'Tranzaksiya yaratishda xatolik';
      setNotification({ message, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="ml-[255px] space-y-6 p-4">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Sotish</h1>
      
      {notification && (
        <div
          className={`p-4 rounded-lg mb-6 flex justify-between items-center ${
            notification.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
          }`}
        >
          <span>{notification.message}</span>
          <button
            className="text-sm font-medium underline hover:text-gray-900"
            onClick={() => setNotification(null)}
          >
            Yopish
          </button>
        </div>
      )}
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Tovar qidirish..."
        className="w-full p-3 border border-gray-300 rounded-lg mb-6 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {loading ? (
        <div className="text-center text-gray-600">Yuklanmoqda...</div>
      ) : (
        <>
          <h2 className="text-xl font-semibold text-gray-700 mb-4">Mahsulotlar Qoldig'i</h2>
          <div className="overflow-x-auto shadow-md rounded-lg">
            <table className="w-full bg-white border border-gray-200">
              <thead>
                <tr className="bg-gray-100 text-gray-600">
                  <th className="p-3 text-left font-medium">ID</th>
                  <th className="p-3 text-left font-medium">Nomi</th>
                  <th className="p-3 text-left font-medium">Barcode</th>
                  <th className="p-3 text-left font-medium">Narx</th>
                  <th className="p-3 text-left font-medium">Miqdor</th>
                  <th className="p-3 text-left font-medium">Amallar</th>
                </tr>
              </thead>
              <tbody>
                {products.length > 0 ? (
                  products.map((product) => (
                    <tr key={product.id} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="p-3 text-gray-700">#{product.id}</td>
                      <td className="p-3 text-gray-700">{product.name}</td>
                      <td className="p-3 text-gray-700">{product.barcode}</td>
                      <td className="p-3 text-gray-700">{formatCurrency(product.price)}</td>
                      <td className="p-3 text-gray-700">{formatQuantity(product.quantity)}</td>
                      <td className="p-3">
                        <button
                          onClick={() => openModal(product, 'SALE')}
                          className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 disabled:bg-gray-400 transition-colors"
                          disabled={submitting || product.quantity === 0}
                        >
                          Mijozga Sotish
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="p-3 text-center text-gray-600">
                      Tovarlar topilmadi
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {showModal && selectedProduct && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-8 w-full max-w-3xl overflow-y-auto max-h-[90vh]">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-bold text-gray-800">
                    {transactionType === 'SALE' ? 'Mijozga Sotish' : "Filialga O'tkazish"}
                  </h3>
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
                      <td className="p-3 font-medium bg-gray-50">Mahsulot</td>
                      <td className="p-3">{selectedProduct.name}</td>
                    </tr>
                    {transactionType === 'TRANSFER' && (
                      <>
                        <tr className="border-b">
                          <td className="p-3 font-medium bg-gray-50">Filial (dan)</td>
                          <td className="p-3">
                            <select
                              value={selectedBranch}
                              onChange={(e) => setSelectedBranch(e.target.value)}
                              className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
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
                            {errors.branch && (
                              <span className="text-red-500 text-xs">{errors.branch}</span>
                            )}
                          </td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-3 font-medium bg-gray-50">Filial (ga)</td>
                          <td className="p-3">
                            <select
                              value={toBranch}
                              onChange={(e) => setToBranch(e.target.value)}
                              className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                errors.toBranch ? 'border-red-500' : 'border-gray-300'
                              }`}
                            >
                              <option value="">Tanlang</option>
                              {branches
                                .filter((b) => b.id !== Number(selectedBranch))
                                .map((b) => (
                                  <option key={b.id} value={b.id}>
                                    {b.name}
                                  </option>
                                ))}
                            </select>
                            {errors.toBranch && (
                              <span className="text-red-500 text-xs">{errors.toBranch}</span>
                            )}
                          </td>
                        </tr>
                      </>
                    )}
                    {transactionType === 'SALE' && (
                      <>
                        <tr className="border-b">
                          <td className="p-3 font-medium bg-gray-50">Ism</td>
                          <td className="p-3">
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
                          </td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-3 font-medium bg-gray-50">Familiya</td>
                          <td className="p-3">
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
                          </td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-3 font-medium bg-gray-50">Telefon</td>
                          <td className="p-3">
                            <input
                              value={phone}
                              onChange={(e) => setPhone(e.target.value)}
                              className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                errors.phone ? 'border-red-500' : 'border-gray-300'
                              }`}
                            />
                            {errors.phone && (
                              <span className="text-red-500 text-xs">{errors.phone}</span>
                            )}
                          </td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-3 font-medium bg-gray-50">To'lov Turi</td>
                          <td className="p-3">
                            <select
                              value={paymentType}
                              onChange={(e) => setPaymentType(e.target.value)}
                              className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                errors.paymentType ? 'border-red-500' : 'border-gray-300'
                              }`}
                            >
                              <option value="">Tanlang</option>
                              <option value="CASH">Naqd</option>
                              <option value="CARD">Karta</option>
                              <option value="CREDIT">Kredit</option>
                            </select>
                            {errors.paymentType && (
                              <span className="text-red-500 text-xs">{errors.paymentType}</span>
                            )}
                          </td>
                        </tr>
                        {paymentType === 'CREDIT' && (
                          <>
                            <tr className="border-b">
                              <td className="p-3 font-medium bg-gray-50">Pasport Seriyasi</td>
                              <td className="p-3">
                                <input
                                  value={passportSeries}
                                  onChange={(e) => setPassportSeries(e.target.value)}
                                  className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                    errors.passportSeries ? 'border-red-500' : 'border-gray-300'
                                  }`}
                                />
                                {errors.passportSeries && (
                                  <span className="text-red-500 text-xs">{errors.passportSeries}</span>
                                )}
                              </td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-3 font-medium bg-gray-50">Pasport Raqami</td>
                              <td className="p-3">
                                <input
                                  value={passportNumber}
                                  onChange={(e) => setPassportNumber(e.target.value)}
                                  className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                    errors.passportNumber ? 'border-red-500' : 'border-gray-300'
                                  }`}
                                />
                                {errors.passportNumber && (
                                  <span className="text-red-500 text-xs">{errors.passportNumber}</span>
                                )}
                              </td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-3 font-medium bg-gray-50">JSHSHIR</td>
                              <td className="p-3">
                                <input
                                  value={jshshir}
                                  onChange={(e) => setJshshir(e.target.value)}
                                  className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                    errors.jshshir ? 'border-red-500' : 'border-gray-300'
                                  }`}
                                />
                                {errors.jshshir && (
                                  <span className="text-red-500 text-xs">{errors.jshshir}</span>
                                )}
                              </td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-3 font-medium bg-gray-50">Oylar soni</td>
                              <td className="p-3">
                                <input
                                  type="number"
                                  value={creditMonths}
                                  onChange={(e) => setCreditMonths(e.target.value)}
                                  className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                    errors.creditMonths ? 'border-red-500' : 'border-gray-300'
                                  }`}
                                  min="1"
                                />
                                {errors.creditMonths && (
                                  <span className="text-red-500 text-xs">{errors.creditMonths}</span>
                                )}
                              </td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-3 font-medium bg-gray-50">Foiz (%)</td>
                              <td className="p-3">
                                <input
                                  type="number"
                                  value={creditInterest}
                                  onChange={(e) => setCreditInterest(e.target.value)}
                                  className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                    errors.creditInterest ? 'border-red-500' : 'border-gray-300'
                                  }`}
                                  min="0"
                                  step="0.01"
                                />
                                {errors.creditInterest && (
                                  <span className="text-red-500 text-xs">{errors.creditInterest}</span>
                                )}
                              </td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-3 font-medium bg-gray-50">Birinchi to'lov</td>
                              <td className="p-3">
                                <input
                                  type="number"
                                  value={initialPayment}
                                  onChange={(e) => setInitialPayment(e.target.value)}
                                  className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                    errors.initialPayment ? 'border-red-500' : 'border-gray-300'
                                  }`}
                                  min="0"
                                  step="0.01"
                                />
                                {errors.initialPayment && (
                                  <span className="text-red-500 text-xs">{errors.initialPayment}</span>
                                )}
                              </td>
                            </tr>
                          </>
                        )}
                        <tr className="border-b">
                          <td className="p-3 font-medium bg-gray-50">Yetkazib Berish Turi</td>
                          <td className="p-3">
                            <select
                              value={deliveryType}
                              onChange={(e) => setDeliveryType(e.target.value)}
                              className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                errors.deliveryType ? 'border-red-500' : 'border-gray-300'
                              }`}
                            >
                              <option value="">Tanlang</option>
                              <option value="SELF_PICKUP">O'zi Olib Ketish</option>
                              <option value="DELIVERY">Yetkazib Berish</option>
                            </select>
                            {errors.deliveryType && (
                              <span className="text-red-500 text-xs">{errors.deliveryType}</span>
                            )}
                          </td>
                        </tr>
                        {deliveryType === 'DELIVERY' && (
                          <tr className="border-b">
                            <td className="p-3 font-medium bg-gray-50">Manzil</td>
                            <td className="p-3">
                              <input
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                                className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                  errors.address ? 'border-red-500' : 'border-gray-300'
                                }`}
                              />
                              {errors.address && (
                                <span className="text-red-500 text-xs">{errors.address}</span>
                              )}
                            </td>
                          </tr>
                        )}
                        <tr className="border-b">
                          <td className="p-3 font-medium bg-gray-50">Narx</td>
                          <td className="p-3">
                            <input
                              type="number"
                              value={price}
                              onChange={(e) => setPrice(e.target.value)}
                              className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                errors.price ? 'border-red-500' : 'border-gray-300'
                              }`}
                              step="0.01"
                            />
                            {errors.price && (
                              <span className="text-red-500 text-xs">{errors.price}</span>
                            )}
                          </td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-3 font-medium bg-gray-50">Miqdor</td>
                          <td className="p-3">
                            <input
                              type="number"
                              value={quantity}
                              onChange={(e) => setQuantity(e.target.value)}
                              className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                errors.quantity ? 'border-red-500' : 'border-gray-300'
                              }`}
                              min="1"
                            />
                            {errors.quantity && (
                              <span className="text-red-500 text-xs">{errors.quantity}</span>
                            )}
                          </td>
                        </tr>
                        {quantity && price && (
                          <>
                            <tr className="border-b">
                              <td className="p-3 font-medium bg-gray-50">Jami to'lov</td>
                              <td className="p-3 font-bold">{formatCurrency(Number(quantity) * Number(price))}</td>
                            </tr>
                            {paymentType === 'CREDIT' && initialPayment && creditInterest && creditMonths && (
                              <>
                                <tr className="border-b">
                                  <td className="p-3 font-medium bg-gray-50">Birinchi to'lov</td>
                                  <td className="p-3">{formatCurrency(Number(initialPayment))}</td>
                                </tr>
                                <tr className="border-b">
                                  <td className="p-3 font-medium bg-gray-50">Kredit summasi</td>
                                  <td className="p-3">{formatCurrency((Number(quantity) * Number(price)) - Number(initialPayment))}</td>
                                </tr>
                                <tr className="border-b">
                                  <td className="p-3 font-medium bg-gray-50">Jami kredit to'lovi</td>
                                  <td className="p-3 font-bold">{formatCurrency(((Number(quantity) * Number(price)) - Number(initialPayment)) * (1 + Number(creditInterest) / 100))}</td>
                                </tr>
                                <tr className="border-b">
                                  <td className="p-3 font-medium bg-gray-50">Oylik to'lov</td>
                                  <td className="p-3">{formatCurrency((((Number(quantity) * Number(price)) - Number(initialPayment)) * (1 + Number(creditInterest) / 100)) / Number(creditMonths))}</td>
                                </tr>
                              </>
                            )}
                            {paymentType === 'CASH' && (
                              <>
                                <tr className="border-b">
                                  <td className="p-3 font-medium bg-gray-50">Bergan summa</td>
                                  <td className="p-3">
                                    <input
                                      type="number"
                                      value={paidAmount}
                                      onChange={(e) => setPaidAmount(e.target.value)}
                                      className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                        errors.paidAmount ? 'border-red-500' : 'border-gray-300'
                                      }`}
                                      min="0"
                                      step="0.01"
                                    />
                                    {errors.paidAmount && (
                                      <span className="text-red-500 text-xs">{errors.paidAmount}</span>
                                    )}
                                  </td>
                                </tr>
                                {paidAmount && (
                                  <tr className="border-b">
                                    <td className="p-3 font-medium bg-gray-50">Qaytim</td>
                                    <td className="p-3 font-bold">
                                      {Number(paidAmount) >= Number(quantity) * Number(price)
                                        ? formatCurrency(Number(paidAmount) - (Number(quantity) * Number(price)))
                                        : `Yana ${formatCurrency((Number(quantity) * Number(price)) - Number(paidAmount))} to'lash kerak`}
                                    </td>
                                  </tr>
                                )}
                              </>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </tbody>
                </table>
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="flex-1 bg-blue-500 text-white p-3 rounded-lg hover:bg-blue-600 disabled:bg-gray-400 transition-colors"
                  >
                    {submitting ? 'Yuklanmoqda...' : 'Saqlash'}
                  </button>
                  <button
                    onClick={closeModal}
                    className="flex-1 bg-gray-200 text-gray-700 p-3 rounded-lg hover:bg-gray-300 transition-colors"
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

export default SalesManagement;