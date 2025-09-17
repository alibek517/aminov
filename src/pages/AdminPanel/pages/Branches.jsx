import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Filter,
  Plus,
  MapPin,
  Eye,
  Edit3,
  Building2,
  Users,
  Package,
  X,
  Trash2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatAmount, formatCurrency } from '../../../utils/currencyFormat';

const Branches = ({ selectedBranchId: propSelectedBranchId }) => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [branches, setBranches] = useState([]);
  const [modalState, setModalState] = useState({ isOpen: false, type: null, branch: null });
  const [newBranch, setNewBranch] = useState({ 
    name: '', 
    location: '', 
    phoneNumber: '', 
    type: 'SAVDO_MARKAZ' 
  });
  
  const [editBranch, setEditBranch] = useState({ 
    name: '', 
    location: '', 
    phoneNumber: '', 
    type: 'SAVDO_MARKAZ' 
  });
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState(
    propSelectedBranchId || localStorage.getItem('selectedBranchId') || ''
  );

  const fetchWithAuth = async (url, options = {}) => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      navigate('/login');
      throw new Error('No token found. Please login again.');
    }

    const headers = {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    };
    if (options.method !== 'DELETE') {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, { ...options, headers });
    if (response.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('userRole');
      localStorage.removeItem('user');
      localStorage.removeItem('userId');
      navigate('/login');
      throw new Error('Unauthorized: Session expired. Please login again.');
    }

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Error response:', errorData);
      throw new Error(`Request failed: ${response.status} ${response.statusText}`);
    }

    return response;
  };

  const fetchBranches = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetchWithAuth('https://suddocs.uz/branches');
      const data = await response.json();
      console.log('Available branch IDs:', data.map(branch => branch.id));
      
      let filteredData = data;
      if (selectedBranchId) {
        filteredData = data.filter(branch => branch.id.toString() === selectedBranchId);
      }
      
      const enhancedBranches = filteredData.map((branch) => {
        console.log('Processing branch:', branch);
        
        let inventoryValue = 0;
        if (branch.products && Array.isArray(branch.products)) {
          console.log(`Branch ${branch.id} has ${branch.products.length} products`);
          inventoryValue = branch.products.reduce((sum, product) => {
            const price = parseFloat(product.price) || 0;
            const quantity = parseInt(product.quantity) || 0;
            const productValue = price * quantity;
            console.log(`Product ${product.id}: price=${price}, quantity=${quantity}, value=${productValue}`);
            return sum + productValue;
          }, 0);
        } else {
          console.log(`Branch ${branch.id} has no products or products is not an array:`, branch.products);
        }
        
        const employeeCount = branch.users && Array.isArray(branch.users) ? branch.users.length : 0;
        console.log(`Branch ${branch.id}: employees=${employeeCount}, inventoryValue=${inventoryValue}`);
        
        return {
          ...branch,
          id: branch.id,
          address: branch.location || branch.address || 'Манзил кўрсатилмаган',
          status: branch.status || 'active',
          employeeCount: employeeCount,
          inventoryValue: inventoryValue,
          workingHours: branch.workingHours || '09:00 - 18:00',
          area: branch.area || 0,
        };
      });
      console.log('Enhanced branches:', enhancedBranches);
      setBranches([...enhancedBranches]);
    } catch (err) {
      console.error('Fetch branches error:', err);
      setError(err.message || 'Failed to fetch branches');
    } finally {
      setIsLoading(false);
    }
  }, [selectedBranchId]);

  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'selectedBranchId') {
        setSelectedBranchId(e.newValue || '');
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  useEffect(() => {
    if (propSelectedBranchId !== undefined) {
      setSelectedBranchId(propSelectedBranchId);
    }
  }, [propSelectedBranchId]);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  const handleAddBranch = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      console.log('Adding branch:', newBranch);
      const response = await fetchWithAuth('https://suddocs.uz/branches', {
        method: 'POST',
        body: JSON.stringify({
          name: newBranch.name,
          location: newBranch.location,
          phoneNumber: newBranch.phoneNumber,
          type: newBranch.type,
        }),
      });
      console.log('Add response:', response.status, response.statusText);
      if (response.ok) {
        setModalState({ isOpen: false, type: null, branch: null });
        setNewBranch({ name: '', location: '', phoneNumber: '', type: 'SAVDO_MARKAZ' });
        await fetchBranches();
      }
    } catch (err) {
      console.error('Add branch error:', err);
      setError(err.message || 'Failed to add branch');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditBranch = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      if (!modalState.branch?.id) {
        throw new Error('No branch selected for editing');
      }
      console.log('Editing branch:', { id: modalState.branch.id, name: editBranch.name, location: editBranch.location, phoneNumber: editBranch.phoneNumber });
      const response = await fetchWithAuth(
        `https://suddocs.uz/branches/${modalState.branch.id}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            name: editBranch.name,
            location: editBranch.location,
            phoneNumber: editBranch.phoneNumber,
            type: editBranch.type,
          }),
        }
      );
      console.log('Edit response:', response.status, response.statusText);
      if (response.ok) {
        setModalState({ isOpen: false, type: null, branch: null });
        setEditBranch({ name: '', location: '', phoneNumber: '', type: 'SAVDO_MARKAZ' });
        await fetchBranches();
      }
    } catch (err) {
      console.error('Edit branch error:', err);
      setError(err.message || 'Failed to update branch');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteBranch = async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (!modalState.branch?.id) {
        throw new Error('No branch selected for deletion');
      }
      console.log('Deleting branch ID:', modalState.branch.id);
      const response = await fetchWithAuth(
        `https://suddocs.uz/branches/${modalState.branch.id}`,
        {
          method: 'DELETE',
        }
      );
      console.log('Delete response:', response.status, response.statusText);
      if (response.ok) {
        setModalState({ isOpen: false, type: null, branch: null });
        await fetchBranches();
      }
    } catch (err) {
      console.error('Delete branch error:', err);
      setError(
        err.message.includes('400')
          ? 'Филиални ўчириб бўлмади: Сервер хатоси. Илтимос, қайта уриниб кўринг.'
          : err.message || 'Failed to delete branch'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const openModal = (type, branch = null) => {
    console.log('Opening modal:', { type, branch });
    if ((type === 'edit' || type === 'delete' || type === 'view') && !branch) {
      setError('No branch selected');
      return;
    }
    setModalState({ isOpen: true, type, branch });
    if (type === 'edit' && branch) {
      setEditBranch({
        name: branch.name || '',
        location: branch.location || '',
        phoneNumber: branch.phoneNumber || '',
        type: branch.type || 'SAVDO_MARKAZ'
      });
    } else if (type === 'add') {
      // Reset to default values when opening add modal
      setNewBranch({
        name: '',
        location: '',
        phoneNumber: '',
        type: 'SAVDO_MARKAZ'
      });
    }
    setError(null);
  };

  const closeModal = () => {
    setModalState({ isOpen: false, type: null, branch: null });
    setError(null);
    setIsLoading(false);
  };

  const formatPhoneNumber = (value) => {
    if (!value) return '';
    // Remove all non-digit characters
    const cleaned = String(value).replace(/\D/g, '');
    
    // Format as +998 XX XXX XX XX
    const match = cleaned.match(/^(\d{0,3})(\d{0,2})(\d{0,3})(\d{0,2})(\d{0,2})$/);
    if (match) {
      return !match[1] ? '' : `+${match[1]}${match[2] ? ` ${match[2]}` : ''}${match[3] ? ` ${match[3]}` : ''}${match[4] ? ` ${match[4]}` : ''}${match[5] ? ` ${match[5]}` : ''}`.trim();
    }
    return value;
  };

  const handleNewBranchChange = (e) => {
    const { name, value } = e.target;
    if (name === 'phoneNumber') {
      const formattedValue = formatPhoneNumber(value);
      setNewBranch(prev => ({ ...prev, [name]: formattedValue }));
    } else {
      setNewBranch(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleEditBranchChange = (e) => {
    const { name, value } = e.target;
    if (name === 'phoneNumber') {
      const formattedValue = formatPhoneNumber(value);
      setEditBranch(prev => ({ ...prev, [name]: formattedValue }));
    } else {
      setEditBranch(prev => ({ ...prev, [name]: value }));
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'suspended':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'active':
        return 'Фаол';
      case 'inactive':
        return 'Фаол эмас';
      case 'pending':
        return 'Кутилмоқда';
      case 'suspended':
        return 'Тўхтатилган';
      default:
        return 'Номаълум';
    }
  };

  const getBranchTypeText = (type) => {
    switch (type) {
      case 'SKLAD':
        return 'Склад';
      case 'SAVDO_MARKAZ':
        return 'Савдо Марказ';
      default:
        return 'Савдо Марказ';
    }
  };

  const getBranchTypeBadge = (type) => {
    switch (type) {
      case 'SKLAD':
        return 'bg-orange-100 text-orange-800';
      case 'SAVDO_MARKAZ':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  const filteredBranches = branches.filter((branch) => {
    const matchesSearch =
      branch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      branch.address.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const totalBranches = branches.length;
  const totalEmployees = branches.reduce((sum, branch) => sum + branch.employeeCount, 0);
  const totalInventoryValue = branches.reduce((sum, branch) => sum + branch.inventoryValue, 0);

  return (
    <div className="space-y-6">
      {error && <div className="bg-red-100 text-red-800 p-4 rounded-lg">{error}</div>}
      {isLoading && <div className="text-center text-gray-600">Yuklanmoqda...</div>}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Филиаллар Бошқаруви</h1>
          <p className="text-gray-600 mt-1">Барча филиаллар маълумотлари ва статистикаси</p>
        </div>
        <button
          onClick={() => openModal('add')}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
          disabled={isLoading}
        >
          <Plus size={20} className="mr-2" />
          Янги Филиал
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center">
          <div className="flex items-center">
            <div className="p-3 bg-blue-50 rounded-lg mr-4">
              <Building2 className="text-blue-600" size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Жами Филиаллар</p>
              <p className="text-2xl font-bold text-gray-900">{totalBranches}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center">
            <div className="p-3 bg-purple-50 rounded-lg mr-4">
              <Users className="text-purple-600" size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Жами Ходимлар</p>
              <p className="text-2xl font-bold text-gray-900">{totalEmployees}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center">
            <div className="p-3 bg-indigo-50 rounded-lg mr-4">
              <Package className="text-indigo-600" size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Инвентар</p>
              <p className="text-xl font-bold text-gray-900">
                {formatAmount(totalInventoryValue)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
              size={20}
            />
            <input
              type="text"
              placeholder="Филиал номи, манзил..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Филиал
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Манзил
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Телефон
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Тури
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ходимлар
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Инвентар
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Амаллар
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredBranches.map((branch) => (
                <tr
                  key={branch.id}
                  className="hover:bg-gray-50 transition-colors duration-150"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold mr-4">
                        <Building2 size={20} />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">{branch.name}</div>
                        <div className="text-sm text-gray-500">ID: {branch.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-start">
                      <MapPin size={14} className="mr-2 mt-1 text-gray-400" />
                      <div>
                        <div className="text-sm text-gray-900">{branch.address}</div>
                        <div className="text-xs text-gray-500">{branch.workingHours}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {branch.phoneNumber ? (
                      <div className="flex items-center text-sm text-blue-600">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        {branch.phoneNumber}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-500">Киритилмаган</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getBranchTypeBadge(branch.type)}`}>
                      {getBranchTypeText(branch.type)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Users size={14} className="mr-2 text-gray-400" />
                      <span className="text-sm font-medium text-gray-900">
                        {branch.employeeCount}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-semibold text-gray-900">
                      {formatAmount(branch.inventoryValue)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => openModal('view', branch)}
                        className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50"
                        disabled={isLoading}
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        onClick={() => openModal('edit', branch)}
                        className="text-green-600 hover:text-green-900 p-1 rounded hover:bg-green-50"
                        disabled={isLoading}
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        onClick={() => openModal('delete', branch)}
                        className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50"
                        disabled={isLoading}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalState.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                {modalState.type === 'add'
                  ? 'Янги Филиал Қўшиш'
                  : modalState.type === 'view'
                  ? 'Филиал Маълумотлари'
                  : modalState.type === 'edit'
                  ? 'Филиални Таҳрирлаш'
                  : 'Филиални Ўчириш'}
              </h2>
              <button onClick={closeModal} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>

            {error && (
              <div className="bg-red-100 text-red-800 p-2 rounded mb-4">
                {error.includes('400')
                  ? 'Филиални ўчириб бўлмади: Сервер хатоси. Илтимос, қайта уриниб кўринг.'
                  : error}
              </div>
            )}
            {isLoading && <div className="text-center text-gray-600 mb-4">Yuklanmoqda...</div>}

            {modalState.type === 'view' && modalState.branch && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Филиал Номи</label>
                  <p className="mt-1 text-sm text-gray-900">{modalState.branch.name}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Манзил</label>
                  <p className="mt-1 text-sm text-gray-900">{modalState.branch.location}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Филиал Тури</label>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getBranchTypeBadge(modalState.branch.type)}`}>
                    {getBranchTypeText(modalState.branch.type)}
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Ходимлар</label>
                  <p className="mt-1 text-sm text-gray-900">{modalState.branch.employeeCount}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Умумий Инвентар Нархи
                  </label>
                  <p className="mt-1 text-sm font-semibold text-gray-900">
                    {formatAmount(modalState.branch.inventoryValue)}
                  </p>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={closeModal}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                    disabled={isLoading}
                  >
                    Ёпиш
                  </button>
                </div>
              </div>
            )}

            {modalState.type === 'add' && (
              <form onSubmit={handleAddBranch} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Филиал Номи</label>
                  <input
                    type="text"
                    name="name"
                    value={newBranch.name}
                    onChange={handleNewBranchChange}
                    className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Манзил</label>
                  <input
                    type="text"
                    name="location"
                    value={newBranch.location}
                    onChange={handleNewBranchChange}
                    className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Телефон Раками</label>
                  <input
                    type="tel"
                    name="phoneNumber"
                    value={newBranch.phoneNumber}
                    onChange={handleNewBranchChange}
                    className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    pattern="\+998[0-9]{9}"
                    title="+998XXXXXXXXX formatida kiriting"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Филиал Тури</label>
                  <select
                    value={newBranch.type}
                    onChange={handleNewBranchChange}
                    name="type"
                    className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="SAVDO_MARKAZ">Савдо Марказ</option>
                    <option value="SKLAD">Склад</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                    disabled={isLoading}
                  >
                    Бекор қилиш
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    disabled={isLoading}
                  >
                    Қўшиш
                  </button>
                </div>
              </form>
            )}

            {modalState.type === 'edit' && (
              <form onSubmit={handleEditBranch} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Филиал Номи</label>
                  <input
                    type="text"
                    name="name"
                    value={editBranch.name}
                    onChange={handleEditBranchChange}
                    className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Манзил</label>
                  <input
                    type="text"
                    name="location"
                    value={editBranch.location}
                    onChange={handleEditBranchChange}
                    className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Телефон Раками</label>
                  <input
                    type="tel"
                    id="phoneNumber"
                    name="phoneNumber"
                    value={editBranch?.phoneNumber || ''}
                    onChange={handleEditBranchChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="+998 XX XXX XX XX"
                    pattern="\+998\s\d{2}\s\d{3}\s\d{2}\s\d{2}"
                    title="Iltimos, telefon raqamini to'g'ri formatda kiriting: +998 XX XXX XX XX"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Филиал Тури</label>
                  <select
                    value={editBranch.type}
                    onChange={handleEditBranchChange}
                    name="type"
                    className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="SAVDO_MARKAZ">Савдо Марказ</option>
                    <option value="SKLAD">Склад</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                    disabled={isLoading}
                  >
                    Бекор қилиш
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    disabled={isLoading}
                  >
                    Сақлаш
                  </button>
                </div>
              </form>
            )}

            {modalState.type === 'delete' && modalState.branch && (
              <div className="space-y-4">
                <p className="text-sm text-gray-900">
                  Ҳақиқатан ҳам <span className="font-medium">{modalState.branch.name}</span> филиалини ўчиришни хоҳлайсизми?
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                    disabled={isLoading}
                  >
                    Йўқ
                  </button>
                  <button
                    onClick={handleDeleteBranch}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                    disabled={isLoading}
                  >
                    Ҳа
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Branches;