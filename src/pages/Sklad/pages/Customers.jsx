import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';


const Customers = ({ selectedBranchId }) => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const API_URL = 'https://suddocs.uz';

  const axiosWithAuth = async (config) => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      navigate('/login');
      throw new Error('No token found');
    }
    const headers = { ...config.headers, Authorization: `Bearer ${token}` };
    try {
      const response = await axios({ ...config, headers });
      return response;
    } catch (error) {
      if (error.response?.status === 401) {
        localStorage.clear();
        navigate('/login');
        throw new Error('Session expired');
      }
      throw error;
    }
  };

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const queryParams = searchTerm.trim() ? `?search=${searchTerm}` : '';
      const response = await axiosWithAuth({
        method: 'get',
        url: `${API_URL}/customers${queryParams}`,
      });
      setCustomers(response.data);
    } catch (err) {
      setNotification({ message: err.message || 'Mijozlarni yuklashda xatolik', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [navigate, searchTerm]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const openModal = (customer = null) => {
    setIsEdit(!!customer);
    setSelectedCustomer(customer);
    setFirstName(customer ? customer.firstName : '');
    setLastName(customer ? customer.lastName : '');
    setPhone(customer ? customer.phone : '');
    setEmail(customer ? customer.email : '');
    setErrors({});
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedCustomer(null);
    setFirstName('');
    setLastName('');
    setPhone('');
    setEmail('');
    setErrors({});
  };

  const validateFields = () => {
    const newErrors = {};
    if (!firstName.trim()) newErrors.firstName = 'Ism kiritilishi shart';
    if (!lastName.trim()) newErrors.lastName = 'Familiya kiritilishi shart';
    if (!phone.trim()) newErrors.phone = 'Telefon kiritilishi shart';
    if (email && !/\S+@\S+\.\S+/.test(email)) newErrors.email = 'Email noto\'g\'ri';
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
    try {
      const payload = { firstName, lastName, phone, email: email || null };
      if (isEdit && selectedCustomer) {
        await axiosWithAuth({
          method: 'put',
          url: `${API_URL}/customers/${selectedCustomer.id}`,
          data: payload,
        });
        setNotification({ message: 'Mijoz yangilandi', type: 'success' });
      } else {
        await axiosWithAuth({
          method: 'post',
          url: `${API_URL}/customers`,
          data: payload,
        });
        setNotification({ message: 'Mijoz qo\'shildi', type: 'success' });
      }
      closeModal();
      loadCustomers();
    } catch (err) {
      setNotification({ message: err.message || 'Xatolik yuz berdi', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (customer) => {
    if (!window.confirm(`"${customer.firstName} ${customer.lastName}" mijozini o\'chirishni xohlaysizmi?`)) return;
    setSubmitting(true);
    try {
      await axiosWithAuth({
        method: 'delete',
        url: `${API_URL}/customers/${customer.id}`,
      });
      setNotification({ message: 'Mijoz o\'chirildi', type: 'success' });
      loadCustomers();
    } catch (err) {
      setNotification({ message: err.message || 'Mijozni o\'chirishda xatolik', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Mijozlar</h1>
      <div className="flex gap-4 mb-4">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Mijoz qidirish..."
          className="w-full p-2 border rounded"
        />
        <button
          onClick={() => openModal()}
          className="bg-blue-500 text-white p-2 rounded"
        >
          Yangi Mijoz
        </button>
      </div>
      {loading ? (
        <div className="text-center">Yuklanmoqda...</div>
      ) : (
        <>
          <table className="w-full bg-white border rounded mb-4">
            <thead>
              <tr className="bg-gray-200">
                <th className="p-2 text-left">ID</th>
                <th className="p-2 text-left">Ism</th>
                <th className="p-2 text-left">Familiya</th>
                <th className="p-2 text-left">Telefon</th>
                <th className="p-2 text-left">Email</th>
                <th className="p-2 text-left">Amallar</th>
              </tr>
            </thead>
            <tbody>
              {customers.length > 0 ? (
                customers.map((customer) => (
                  <tr key={customer.id} className="border-b">
                    <td className="p-2">#{customer.id}</td>
                    <td className="p-2">{customer.firstName}</td>
                    <td className="p-2">{customer.lastName}</td>
                    <td className="p-2">{customer.phone}</td>
                    <td className="p-2">{customer.email || 'N/A'}</td>
                    <td className="p-2">
                      <button
                        onClick={() => openModal(customer)}
                        className="bg-blue-500 text-white p-1 rounded mr-2"
                        disabled={submitting}
                      >
                        Tahrirlash
                      </button>
                      <button
                        onClick={() => handleDelete(customer)}
                        className="bg-red-500 text-white p-1 rounded"
                        disabled={submitting}
                      >
                        O'chirish
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="p-2 text-center">Mijozlar topilmadi</td>
                </tr>
              )}
            </tbody>
          </table>
          {showModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded p-4 w-full max-w-md">
                <div className="flex justify-between mb-4">
                  <h3 className="text-lg font-bold">{isEdit ? 'Mijozni Tahrirlash' : 'Yangi Mijoz'}</h3>
                  <button onClick={closeModal} className="text-gray-600">X</button>
                </div>
                <table className="w-full text-sm">
                  <tbody>
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
                      <td className="py-1">Email</td>
                      <td>
                        <input
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className={`w-full p-1 border rounded ${errors.email ? 'border-red-500' : ''}`}
                        />
                        {errors.email && <span className="text-red-500 text-xs">{errors.email}</span>}
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
      {notification && <Notification {...notification} onClose={() => setNotification(null)} />}
    </div>
  );
};

export default Customers;