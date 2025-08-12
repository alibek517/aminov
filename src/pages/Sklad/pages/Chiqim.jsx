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
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [notification, setNotification] = useState(null);
  const navigate = useNavigate();
  const API_URL = 'https://suddocs.uz';

  const formatCurrency = (amount) => (amount >= 0 ? new Intl.NumberFormat('uz-UZ').format(amount) + ' so\'m' : 'Noma\'lum');
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
      console.log('Fetching products:', `${API_URL}/products?${queryParams.toString()}`);
      const productsRes = await axiosWithAuth({ method: 'get', url: `${API_URL}/products?${queryParams.toString()}` });
      setProducts(productsRes.data);
    } catch (err) {
      setNotification({ message: err.message || 'Ma\'lumotlarni yuklashda xatolik', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [navigate, searchTerm, selectedBranchId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openModal = (product, type) => {
    setSelectedProduct(product);
    setTransactionType(type);
    setQuantity('');
    setPrice(product.price ? product.price.toString() : '0');
    setSelectedBranch(product.branchId ? product.branchId.toString() : selectedBranchId || '');
    setToBranch('');
    setFirstName('');
    setLastName('');
    setPhone('');
    setPaymentType('');
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
    setErrors({});
    setNotification(null);
  };

  const validateFields = () => {
    const newErrors = {};
    if (!transactionType) newErrors.transactionType = 'Tranzaksiya turi tanlanishi shart';
    if (!quantity || isNaN(quantity) || Number(quantity) <= 0) {
      newErrors.quantity = 'Miqdor 0 dan katta bo\'lishi kerak';
    } else if (Number(quantity) > selectedProduct.quantity) {
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
      if (!phone.trim()) newErrors.phone = 'Telefon kiritilishi shart';
      if (!paymentType) newErrors.paymentType = 'To\'lov turi tanlanishi shart';
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
        const total = qty * prc;
        const payload = {
          userId,
          type: 'SALE',
          status: 'PENDING',
          total,
          finalTotal: total,
          paymentType,
          customer: {
            firstName,
            lastName,
            phone,
          },
          branchId: Number(selectedBranch),
          items: [{
            productId: selectedProduct.id,
            quantity: qty,
            price: prc,
            total,
          }],
        };
        console.log('Submitting SALE transaction:', payload);
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
        console.log('Submitting TRANSFER transaction:', payload);
        await axiosWithAuth({
          method: 'post',
          url: `${API_URL}/product-transfers`,
          data: payload,
        });
        setNotification({ message: 'Tovar o\'tkazmasi muvaffaqiyatli amalga oshirildi', type: 'success' });
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
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Chiqim</h1>
      <select
        value={selectedBranchId}
        onChange={(e) => setSelectedBranchId(e.target.value)}
        className="w-full p-2 border rounded mb-4"
      >
        <option value="">Filial tanlang</option>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>{b.name}</option>
        ))}
      </select>
      {notification && (
        <div className={`p-4 rounded ${notification.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'} mb-4`}>
          {notification.message}
          <button className="ml-4 text-sm underline" onClick={() => setNotification(null)}>Yopish</button>
        </div>
      )}
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Tovar qidirish..."
        className="w-full p-2 border rounded mb-4"
      />
      {loading ? (
        <div className="text-center">Yuklanmoqda...</div>
      ) : (
        <>
          <h2 className="text-xl font-bold mb-2">Mahsulotlar Qoldig'i</h2>
          <table className="w-full bg-white border rounded mb-4">
            <thead>
              <tr className="bg-gray-200">
                <th className="p-2 text-left">ID</th>
                <th className="p-2 text-left">Nomi</th>
                <th className="p-2 text-left">Filial</th>
                <th className="p-2 text-left">Narx</th>
                <th className="p-2 text-left">Miqdor</th>
                <th className="p-2 text-left">Amallar</th>
              </tr>
            </thead>
            <tbody>
              {products.length > 0 ? (
                products.map((product) => (
                  <tr key={product.id} className="border-b">
                    <td className="p-2">#{product.id}</td>
                    <td className="p-2">{product.name}</td>
                    <td className="p-2">{product.branch?.name || 'Noma\'lum'}</td>
                    <td className="p-2">{formatCurrency(product.price)}</td>
                    <td className="p-2">{formatQuantity(product.quantity)}</td>
                    <td className="p-2">
                      <button
                        onClick={() => openModal(product, 'SALE')}
                        className="bg-red-500 text-white p-1 rounded mr-2"
                        disabled={submitting || product.quantity === 0}
                      >
                        Mijozga Sotish
                      </button>
                      <button
                        onClick={() => openModal(product, 'TRANSFER')}
                        className="bg-blue-500 text-white p-1 rounded"
                        disabled={submitting || product.quantity === 0}
                      >
                        Filialga O\'tkazish
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="p-2 text-center">Tovarlar topilmadi</td>
                </tr>
              )}
            </tbody>
          </table>
          {showModal && selectedProduct && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded p-4 w-full max-w-md">
                <div className="flex justify-between mb-4">
                  <h3 className="text-lg font-bold">{transactionType === 'SALE' ? 'Mijozga Sotish' : 'Filialga O\'tkazish'}</h3>
                  <button onClick={closeModal} className="text-gray-600">X</button>
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    <tr>
                      <td className="py-1">Mahsulot</td>
                      <td className="py-1">{selectedProduct.name}</td>
                    </tr>
                    <tr>
                      <td className="py-1">Filial (dan)</td>
                      <td>
                        <select
                          value={selectedBranch}
                          onChange={(e) => setSelectedBranch(e.target.value)}
                          className={`w-full p-1 border rounded ${errors.branch ? 'border-red-500' : ''}`}
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
                        <td className="py-1">Filial (ga)</td>
                        <td>
                          <select
                            value={toBranch}
                            onChange={(e) => setToBranch(e.target.value)}
                            className={`w-full p-1 border rounded ${errors.toBranch ? 'border-red-500' : ''}`}
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
                          <td className="py-1">Ism</td>
                          <td>
                            <input
                              value={firstName}
                              onChange={(e) => setFirstName(e.target.value)}
                              className={`w-full p-1 border rounded ${errors.firstName ? 'border-red-500' : ''}`}
                            />
                            {errors.firstName && <span className="text-red-500 text-xs">{errors.firstName}</span>}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-1">Familiya</td>
                          <td>
                            <input
                              value={lastName}
                              onChange={(e) => setLastName(e.target.value)}
                              className={`w-full p-1 border rounded ${errors.lastName ? 'border-red-500' : ''}`}
                            />
                            {errors.lastName && <span className="text-red-500 text-xs">{errors.lastName}</span>}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-1">Telefon</td>
                          <td>
                            <input
                              value={phone}
                              onChange={(e) => setPhone(e.target.value)}
                              className={`w-full p-1 border rounded ${errors.phone ? 'border-red-500' : ''}`}
                            />
                            {errors.phone && <span className="text-red-500 text-xs">{errors.phone}</span>}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-1">To\'lov Turi</td>
                          <td>
                            <select
                              value={paymentType}
                              onChange={(e) => setPaymentType(e.target.value)}
                              className={`w-full p-1 border rounded ${errors.paymentType ? 'border-red-500' : ''}`}
                            >
                              <option value="">Tanlang</option>
                              <option value="CASH">Naqd</option>
                              <option value="CARD">Karta</option>
                              <option value="CREDIT">Kredit</option>
                            </select>
                            {errors.paymentType && <span className="text-red-500 text-xs">{errors.paymentType}</span>}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-1">Narx</td>
                          <td>
                            <input
                              type="number"
                              value={price}
                              onChange={(e) => setPrice(e.target.value)}
                              className={`w-full p-1 border rounded ${errors.price ? 'border-red-500' : ''}`}
                              step="0.01"
                            />
                            {errors.price && <span className="text-red-500 text-xs">{errors.price}</span>}
                          </td>
                        </tr>
                      </>
                    )}
                    <tr>
                      <td className="py-1">Miqdor</td>
                      <td>
                        <input
                          type="number"
                          value={quantity}
                          onChange={(e) => setQuantity(e.target.value)}
                          className={`w-full p-1 border rounded ${errors.quantity ? 'border-red-500' : ''}`}
                          min="1"
                        />
                        {errors.quantity && <span className="text-red-500 text-xs">{errors.quantity}</span>}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="flex-1 bg-blue-500 text-white p-2 rounded disabled:bg-gray-400"
                  >
                    {submitting ? 'Yuklanmoqda...' : 'Saqlash'}
                  </button>
                  <button
                    onClick={closeModal}
                    className="flex-1 bg-gray-200 p-2 rounded"
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