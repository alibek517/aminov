import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Filter,
  Plus,
  Phone,
  MapPin,
  Eye,
  Edit3,
  Building2,
  Users,
  Package,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Branches = ({ selectedBranchId: propSelectedBranchId }) => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [branches, setBranches] = useState([]);
  const [modalState, setModalState] = useState({ isOpen: false, type: null, branch: null });
  const [newBranch, setNewBranch] = useState({ name: '', location: '', phone: '' });
  const [editBranch, setEditBranch] = useState({ name: '', location: '', phone: '' });
  const [error, setError] = useState(null);
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
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

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
      throw new Error('Request failed');
    }

    return response;
  };

  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'selectedBranchId') {
        setSelectedBranchId(e.newValue || '');
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  useEffect(() => {
    if (propSelectedBranchId !== undefined) {
      setSelectedBranchId(propSelectedBranchId);
    }
  }, [propSelectedBranchId]);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  const fetchBranches = useCallback(async () => {
    try {
      const response = await fetchWithAuth('https://suddocs.uz/branches');
      const data = await response.json();
      
      // Filter branches by selectedBranchId if provided
      let filteredData = data;
      if (selectedBranchId) {
        filteredData = data.filter(branch => branch.id.toString() === selectedBranchId);
      }
      
      const enhancedBranches = filteredData.map((branch) => {
        console.log('Processing branch:', branch);
        
        // Safely calculate inventory value
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
        
        // Safely get employee count
        const employeeCount = branch.users && Array.isArray(branch.users) ? branch.users.length : 0;
        console.log(`Branch ${branch.id}: employees=${employeeCount}, inventoryValue=${inventoryValue}`);
        
        return {
          ...branch,
          id: branch.id,
          address: branch.location || branch.address || 'Манзил кўрсатилмаган',
          status: branch.status || 'active', // Use actual status from API
          employeeCount: employeeCount,
          inventoryValue: inventoryValue,
          workingHours: branch.workingHours || '09:00 - 18:00',
          area: branch.area || 0,
        };
      });
      console.log('Enhanced branches:', enhancedBranches);
      setBranches(enhancedBranches);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to fetch branches');
    }
  }, [selectedBranchId, fetchWithAuth]);

  const handleAddBranch = async (e) => {
    e.preventDefault();
    try {
      const response = await fetchWithAuth('https://suddocs.uz/branches', {
        method: 'POST',
        body: JSON.stringify(newBranch),
      });
      if (response.ok) {
        setModalState({ isOpen: false, type: null, branch: null });
        setNewBranch({ name: '', location: '', phone: '' });
        await fetchBranches();
      }
    } catch (err) {
      setError(err.message || 'Failed to add branch');
      console.error(err);
    }
  };

  const handleEditBranch = async (e) => {
    e.preventDefault();
    try {
      const response = await fetchWithAuth(
        `https://suddocs.uz/branches/${modalState.branch.id}`,
        {
          method: 'PUT',
          body: JSON.stringify(editBranch),
        }
      );
      if (response.ok) {
        setModalState({ isOpen: false, type: null, branch: null });
        setEditBranch({ name: '', location: '', phone: '' });
        await fetchBranches();
      }
    } catch (err) {
      setError(err.message || 'Failed to update branch');
      console.error(err);
    }
  };

  const openModal = (type, branch = null) => {
    setModalState({ isOpen: true, type, branch });
    if (type === 'edit' && branch) {
      setEditBranch({ name: branch.name, location: branch.location, phone: branch.phone });
    }
  };

  const closeModal = () => {
    setModalState({ isOpen: false, type: null, branch: null });
    setError(null);
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
        return status || 'Номаълум';
    }
  };

  const filteredBranches = branches.filter((branch) => {
    const matchesSearch =
      branch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      branch.address.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = selectedStatus === 'all' || branch.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  const totalBranches = branches.length;
  const activeBranches = branches.filter((b) => b.status === 'active').length;
  const totalEmployees = branches.reduce((sum, branch) => sum + branch.employeeCount, 0);
  const totalInventoryValue = branches.reduce((sum, branch) => sum + branch.inventoryValue, 0);

  const formatCurrencyUzbek = (value) => {
    if (value >= 1_000_000_000_000) {
      return `${(value / 1_000_000_000_000).toFixed(1)} триллион сўм`;
    } else if (value >= 1_000_000_000) {
      return `${(value / 1_000_000_000).toFixed(1)} миллиард сўм`;
    } else if (value >= 1_000_000) {
      return `${(value / 1_000_000).toFixed(1)} миллион сўм`;
    } else if (value >= 1_000) {
      return `${(value / 1_000).toFixed(1)} минг сўм`;
    }
    return `${value.toFixed(0)} сўм`;
  };

  return (
    <div className="space-y-0">
      {error && <div className="bg-red-100 text-red-800 p-4 rounded-lg">{error}</div>}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Филиаллар Бошқаруви</h1>
          <p className="text-gray-600 mt-1">Барча филиаллар маълумотлари ва статистикаси</p>
        </div>
        <button
          onClick={() => openModal('add')}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
        >
          <Plus size={20} className="mr-2" />
          Янги Филиал
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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
            <div className="p-3 bg-green-50 rounded-lg mr-4">
              <Building2 className="text-green-600" size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Фаол Филиаллар</p>
              <p className="text-2xl font-bold text-gray-900">{activeBranches}</p>
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
                {formatCurrencyUzbek(totalInventoryValue)}
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
          <div className="flex items-center">
            <Filter className="text-gray-400 mr-2" size={20} />
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Барча ҳолатлар</option>
              {Array.from(new Set(branches.map(b => b.status))).map(status => (
                <option key={status} value={status}>
                  {getStatusText(status)}
                </option>
              ))}
            </select>
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
                  Ходимлар
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Инвентар
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ҳолат
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
                    <div className="flex items-center text-sm text-gray-600">
                      <Phone size={12} className="mr-1" />
                      {branch.phone}
                    </div>
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
                      {formatCurrencyUzbek(branch.inventoryValue)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(
                        branch.status
                      )}`}
                    >
                      {getStatusText(branch.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => openModal('view', branch)}
                        className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        onClick={() => openModal('edit', branch)}
                        className="text-green-600 hover:text-green-900 p-1 rounded hover:bg-green-50"
                      >
                        <Edit3 size={16} />
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
          <div className="bg-white rounded-xl p-6 w-full max-w-md ">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                {modalState.type === 'add'
                  ? 'Янги Филиал Қўшиш'
                  : modalState.type === 'view'
                  ? 'Филиал Маълумотлари'
                  : 'Филиални Таҳрирлаш'}
              </h2>
              <button onClick={closeModal} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>

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
                  <label className="block text-sm font-medium text-gray-700">Телефон</label>
                  <p className="mt-1 text-sm text-gray-900">{modalState.branch.phone}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Ҳолат</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {getStatusText(modalState.branch.status)}
                  </p>
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
                    {formatCurrencyUzbek(modalState.branch.inventoryValue)}
                  </p>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={closeModal}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
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
                    value={newBranch.name}
                    onChange={(e) => setNewBranch({ ...newBranch, name: e.target.value })}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Манзил</label>
                  <input
                    type="text"
                    value={newBranch.location}
                    onChange={(e) => setNewBranch({ ...newBranch, location: e.target.value })}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Телефон</label>
                  <input
                    type="tel"
                    value={newBranch.phone}
                    onChange={(e) => setNewBranch({ ...newBranch, phone: e.target.value })}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    Бекор қилиш
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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
                    value={editBranch.name}
                    onChange={(e) => setEditBranch({ ...editBranch, name: e.target.value })}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Манзил</label>
                  <input
                    type="text"
                    value={editBranch.location}
                    onChange={(e) => setEditBranch({ ...editBranch, location: e.target.value })}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Телефон</label>
                  <input
                    type="tel"
                    value={editBranch.phone}
                    onChange={(e) => setEditBranch({ ...editBranch, phone: e.target.value })}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    Бекор қилиш
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Сақлаш
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Branches;