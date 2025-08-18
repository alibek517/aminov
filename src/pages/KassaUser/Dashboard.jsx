import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { DollarSign, AlertTriangle, CreditCard, Eye } from "lucide-react";

const StatCard = ({ title, value, icon, className = "" }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow duration-200 flex flex-col justify-between ${className}`}>
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-600">{title}</p>
        <p className="text-2xl font-bold text-gray-900 mt-2">{value}</p>
      </div>
      <div className="p-3 bg-blue-50 rounded-lg">
        {icon}
      </div>
    </div>
  </div>
);

const Notification = ({ message, type, onClose }) => (
  <div
    className={`p-4 rounded ${type === "error" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"} mb-4`}
  >
    {message}
    <button className="ml-4 text-sm underline" onClick={onClose}>
      Yopish
    </button>
  </div>
);

const TransactionModal = ({ transaction, onClose }) => {
  const cashier =
    (transaction.user?.role === 'CASHIER' && (transaction.user.fullName || transaction.user.name)) ||
    (transaction.soldBy?.role === 'CASHIER' && (transaction.soldBy.fullName || transaction.soldBy.name)) ||
    transaction.cashierName || '';

  const marketing =
    (transaction.user?.role === 'MARKETING' && (transaction.user.fullName || transaction.user.name)) ||
    (transaction.soldBy?.role === 'MARKETING' && (transaction.soldBy.fullName || transaction.soldBy.name)) ||
    transaction.marketingName || '';

  const formatCurrencyLocal = (amount) =>
    amount >= 0 ? new Intl.NumberFormat('uz-UZ').format(amount) + " so'm" : "Noma'lum";

  const formatDateLocal = (date) => new Date(date).toLocaleDateString('uz-Cyrl-UZ');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Транзакция маълумотлари</h3>
        <div className="space-y-4">
          <p><strong>ID:</strong> #{transaction.id}</p>
          <p><strong>Мижоз:</strong> {transaction.customer?.fullName || transaction.customer?.name || 'Номаълум'}</p>
          <p><strong>Умумий:</strong> {formatCurrencyLocal(transaction.finalTotal || transaction.total || 0)}</p>
          <p><strong>Вақт:</strong> {formatDateLocal(transaction.createdAt)}      {new Date(transaction.createdAt).toLocaleTimeString("uz-Cyrl-UZ", {
            hour: "2-digit",
            minute: "2-digit",
          })}</p>
          <p><strong>Маҳсулотлар:</strong></p>
          <ul className="list-disc pl-5">
            {transaction.items?.map((item, index) => (
              <li key={index}>
                {item.product?.name || item.productName || 'Номаълум маҳсулот'} - {(() => (item.quantity >= 0 ? new Intl.NumberFormat('uz-UZ').format(item.quantity) + ' dona' : "Noma'lum"))()} - {formatCurrencyLocal(item.price)}
              </li>
            )) || <li>Маҳсулотлар йўқ</li>}
          </ul>
        </div>
        <button
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          onClick={onClose}
        >
          Yopish
        </button>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const [products, setProducts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  useEffect(() => {
    if (!notification) return;
    const t = setTimeout(() => setNotification(null), 1500);
    return () => clearTimeout(t);
  }, [notification]);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [defectiveStats, setDefectiveStats] = useState(null);
  const [creditStats, setCreditStats] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  
  const navigate = useNavigate();
  const token = localStorage.getItem("access_token");
  const userId = localStorage.getItem("userId");
  const API_URL = "https://suddocs.uz";

  // Formatting functions
  const formatCurrency = (amount) =>
    amount >= 0 ? new Intl.NumberFormat("uz-UZ").format(amount) + " so'm" : "Noma'lum";

  const formatQuantity = (qty) =>
    qty >= 0 ? new Intl.NumberFormat("uz-UZ").format(qty) + " dona" : "Noma'lum";

  const formatDate = (date) =>
    new Date(date).toLocaleDateString("uz-Cyrl-UZ");

  // Authentication-enabled fetch function
  const fetchWithAuth = async (url) => {
    if (!token) {
      navigate("/login");
      throw new Error("No token found");
    }
    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
    const response = await fetch(url, { headers });
    if (!response.ok) {
      if (response.status === 401) {
        localStorage.clear();
        navigate("/login");
        throw new Error("Session expired");
      }
      throw new Error("Request failed");
    }
    return response.json();
  };

  // Fetch branches and set initial branch (guard against double-invoke in StrictMode)
  const didInitBranchesRef = useRef(false);
  useEffect(() => {
    if (didInitBranchesRef.current) return;
    didInitBranchesRef.current = true;
    const fetchBranches = async () => {
      try {
        const branchData = await fetchWithAuth(`${API_URL}/branches`);
        setBranches(Array.isArray(branchData) ? branchData : []);
        const storedBranchId = localStorage.getItem("branchId");
        if (storedBranchId && branchData.some((b) => b.id === Number(storedBranchId))) {
          setSelectedBranchId(storedBranchId);
        }
      } catch (err) {
        setNotification({ message: err.message || "Filiallarni yuklashda xatolik", type: "error" });
      }
    };
    fetchBranches();
  }, []);

  // Fetch defective statistics
  const fetchDefectiveStats = useCallback(async () => {
    if (!selectedBranchId) return;
    try {
      const stats = await fetchWithAuth(
        `${API_URL}/defective-logs/statistics?branchId=${selectedBranchId}&startDate=${startDate}&endDate=${endDate}`
      );
      setDefectiveStats(stats);
    } catch (err) {
      console.error("Error fetching defective stats:", err);
      setNotification({ message: "Nosoz mahsulotlar statistikasini yuklashda xatolik", type: "error" });
    }
  }, [selectedBranchId, startDate, endDate, navigate]);

  // Fetch credit statistics
  const fetchCreditStats = useCallback(async () => {
    if (!selectedBranchId) return;
    try {
      const stats = await fetchWithAuth(
        `${API_URL}/transactions/statistics?branchId=${selectedBranchId}&startDate=${startDate}&endDate=${endDate}`
      );
      // Extract credit-related data from the general statistics
      const creditStats = {
        creditSales: stats.creditSales || 0,
        creditTransactions: stats.creditTransactions || 0,
        totalCreditSales: stats.creditSales || 0,
        totalCreditTransactions: stats.creditTransactions || 0
      };
      setCreditStats(creditStats);
    } catch (err) {
      console.error("Error fetching credit stats:", err);
      setNotification({ message: "Kredit statistikasini yuklashda xatolik", type: "error" });
      setCreditStats(null);
    }
  }, [selectedBranchId, startDate, endDate, navigate]);

  // Fetch transactions and products
  const fetchData = useCallback(async () => {
    setLoading(true);
    setNotification(null);

    const branchId = Number(selectedBranchId);
    const isValidBranchId = !isNaN(branchId) && Number.isInteger(branchId) && branchId > 0;

    if (!isValidBranchId) {
      setNotification({ message: "Filialni tanlang", type: "error" });
      setTransactions([]);
      setProducts([]);
      setLoading(false);
      return;
    }

    try {
      const queryParams = `?branchId=${branchId}`;
      const [transactionsResponse, productsData] = await Promise.all([
        fetchWithAuth(`${API_URL}/transactions${queryParams}`),
        fetchWithAuth(`${API_URL}/products${queryParams}`),
      ]);

      console.log('Transactions response:', transactionsResponse);
      console.log('Products data:', productsData);

      const transactionsData = transactionsResponse.transactions || transactionsResponse || [];
      setTransactions(Array.isArray(transactionsData) ? transactionsData : []);
      setProducts(Array.isArray(productsData) ? productsData : []);
      setError(null);
    } catch (err) {
      const message = err.message || "Ma'lumotlarni yuklashda xatolik";
      console.error("Fetch error:", err);
      setNotification({ message, type: "error" });
      setTransactions([]);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [selectedBranchId, navigate]);

  useEffect(() => {
    if (token && selectedBranchId) {
      fetchData();
      fetchDefectiveStats();
      fetchCreditStats();
    } else if (!token) {
      navigate("/login");
    }
  }, [token, selectedBranchId, fetchData, fetchDefectiveStats, fetchCreditStats, navigate]);

  // Update localStorage when branch selection changes
  useEffect(() => {
    if (selectedBranchId) {
      localStorage.setItem("branchId", selectedBranchId);
    }
  }, [selectedBranchId]);

  // Validate date range
  useEffect(() => {
    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      setNotification({
        message: "Тугаш сана бошланғич санадан кейин бўлиши керак",
        type: "error",
      });
      setEndDate(startDate);
    }
  }, [startDate, endDate]);

  const calculateCashInRegister = () => {
    let start, end;
  
    if (startDate && endDate) {
      start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
    } else {
      const now = new Date();
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    }
  
    if (!Array.isArray(transactions)) {
      return formatCurrency(0);
    }
  
    const branchIdNum = Number(selectedBranchId || localStorage.getItem('branchId'));
    const hasBranch = Number.isInteger(branchIdNum) && branchIdNum > 0;
    const userIdNum = Number(userId); // Convert userId from localStorage to number
    const hasUserId = Number.isInteger(userIdNum) && userIdNum > 0;
  
    const cash = transactions
      .filter((tx) => {
        const inDate = new Date(tx.createdAt) >= start && new Date(tx.createdAt) <= end;
        const isSaleCash = tx.type === 'SALE' && tx.paymentType === 'CASH';
        const inBranch = hasBranch && (
          tx.fromBranchId === branchIdNum ||
          tx.fromBranch?.id === branchIdNum ||
          tx.branchId === branchIdNum
        );
        // Check if transaction's userId matches the logged-in userId
        const matchesUserId = hasUserId && (
          tx.userId === userIdNum || // Direct userId match
          tx.user?.id === userIdNum || // Nested user object
          tx.soldBy?.id === userIdNum // Nested soldBy object
        );
        return inDate && isSaleCash && inBranch && (!hasUserId || matchesUserId);
      })
      .reduce((sum, tx) => sum + (parseFloat(tx.finalTotal) || 0), 0);
  
    return formatCurrency(cash);
  };
  
  const cashInRegister = calculateCashInRegister();

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set();
    products.forEach(product => {
      if (product.category) {
        const categoryKey = typeof product.category === 'object' 
          ? product.category.name || product.category.id
          : product.category;
        if (categoryKey) {
          cats.add(categoryKey);
        }
      }
    });
    return Array.from(cats).filter(Boolean);
  }, [products]);

  // Inside the Dashboard component

// Filter transactions
const filteredTransactions = useMemo(() => {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  if (!Array.isArray(transactions)) {
    console.warn("Transactions is not an array:", transactions);
    return [];
  }

  const userIdNum = Number(userId); // Convert userId from localStorage to number
  const hasUserId = Number.isInteger(userIdNum) && userIdNum > 0;

  const filtered = transactions.filter((transaction) => {
    const txDate = new Date(transaction.createdAt);
    const inDate = txDate >= start && txDate <= end;
    // Check if transaction's userId matches the logged-in userId
    const matchesUserId = hasUserId && (
      transaction.userId === userIdNum || // Direct userId match
      transaction.user?.id === userIdNum || // Nested user object
      transaction.soldBy?.id === userIdNum // Nested soldBy object
    );
    return inDate && (!hasUserId || matchesUserId); // Include userId filter if valid
  });

  if (filtered.length === 0) {
    console.log("No transactions after filtering", { startDate, endDate, userId });
  }

  return filtered;
}, [transactions, startDate, endDate, userId]);

const lowStockItems = (Array.isArray(products) ? products : [])
  .filter((product) => {
    const branchIdNum = Number(selectedBranchId || localStorage.getItem('branchId'));
    return product.quantity < 5 && product.branchId === branchIdNum;
  })
  .slice(0, 5)
  .map((product) => ({
    name: product.name,
    quantity: product.quantity,
    branch: branches.find((b) => b.id === product.branchId)?.name || "Номаълум филиал",
  }));

  return (
    <div className="ml-[255px] space-y-6 p-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Бошқарув Панели</h1>
          <p className="text-gray-600 mt-1">Бугунги санага умумий маълумотлар</p>
        </div>
        <div className="text-sm text-gray-500">
          <button
            style={{
              border: "2px solid #4A90E2",
              padding: "12px 24px",
              backgroundColor: "#fff",
              borderRadius: "25px",
              fontSize: "16px",
              color: "#4A90E2",
              fontWeight: "bold",
              cursor: "pointer",
              transition: "all 0.3s ease",
              boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
            }}
            onMouseOver={(e) => {
              e.target.style.backgroundColor = "#4A90E2";
              e.target.style.color = "#fff";
              e.target.style.boxShadow = "0px 0px 15px rgba(0, 0, 0, 0.2)";
            }}
            onMouseOut={(e) => {
              e.target.style.backgroundColor = "#fff";
              e.target.style.color = "#4A90E2";
              e.target.style.boxShadow = "0 4px 6px rgba(0, 0, 0, 0.1)";
            }}
            onClick={() => navigate("/kasir/sotuvchilar")}
          >
            Сотувчилар маоши
          </button>
        </div>
      </div>



      <div className="flex flex-col sm:flex-row sm:space-x-4 mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
      <div className="flex-1">
  <label className="block text-sm font-medium text-gray-700 mb-1">Бошланғич сана</label>
  <input
    type="date"
    value={startDate}
    onChange={(e) => setStartDate(e.target.value)}
    onFocus={(e) => e.target.showPicker()} // Trigger date picker on focus
    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
  />
</div>
<div className="flex-1 mt-4 sm:mt-0">
  <label className="block text-sm font-medium text-gray-700 mb-1">Тугаш сана</label>
  <input
    type="date"
    value={endDate}
    onChange={(e) => setEndDate(e.target.value)}
    onFocus={(e) => e.target.showPicker()} // Trigger date picker on focus
    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
  />
</div>
        <div className="flex-1 mt-4 sm:mt-0">
          <label className="block text-sm font-medium text-gray-700 mb-1">Категория</label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          >
            <option value="">Барча категориялар</option>
            {categories.map((category, index) => (
              <option key={category || `category-${index}`} value={category}>
                {category || 'Номаълум'}
              </option>
            ))}
          </select>
        </div>
      </div>

      {notification && <Notification {...notification} onClose={() => setNotification(null)} />}

      {loading ? (
        <div className="text-center text-gray-600">Yuklanmoqda...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6">
            <StatCard
              title={startDate && endDate ? `Кассадаги пул (${startDate} - ${endDate})` : "Кассадаги пул (Бу Кун)"}
              value={cashInRegister}
              icon={<DollarSign className="text-blue-600" size={24} />}
            />
          </div>


          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900">Сўнгги Сотиш</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Мижоз
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Умумий
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Сана / Вақт
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Кўриш
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredTransactions.length > 0 ? (
                      filteredTransactions.map((transaction) => (
                        <tr
                          key={transaction.id}
                          className="hover:bg-gray-50 transition-colors duration-150"
                        >
                          <td className="px-6 py-4 text-gray-900">#{transaction.id}</td>
                          <td className="px-6 py-4 text-gray-700">
                            {transaction.customer?.fullName || transaction.customer?.name || 'Номаълум'}
                          </td>
                          <td className="px-6 py-4 text-gray-700">
                            {formatCurrency(transaction.finalTotal || transaction.total || 0)}
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-gray-900">{formatDate(transaction.createdAt)}</div>
                            <div className="text-xs text-gray-500">
                              {new Date(transaction.createdAt).toLocaleTimeString("uz-Cyrl-UZ", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <button
                              type="button"
                              onClick={() => setSelectedTransaction(transaction)}
                              className="text-blue-500 hover:text-blue-700"
                            >
                              <Eye size={20} />
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                          Транзакциялар йўқ
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-6 border-b border-gray-100 flex items-center">
          <AlertTriangle className="text-orange-500 mr-2" size={20} />
          <h3 className="text-lg font-semibold text-gray-900">Кам қолган маҳсулотлар</h3>
        </div>
        <div className="p-6 space-y-4">
          {lowStockItems.length > 0 ? (
            lowStockItems.map((item, index) => (
              <div key={index} className="border-l-4 border-orange-400 pl-4 py-2">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{item.name}</p>
                    <p className="text-xs text-gray-500">{item.branch}</p>
                  </div>
                  <div className="text-sm font-semibold text-orange-600">
                    {formatQuantity(item.quantity)}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-gray-500 text-center">Кам қолган маҳсулотлар йўқ</p>
          )}
        </div>
      </div>
          </div>
        </>
      )}

      {selectedTransaction && (
        <TransactionModal
          transaction={selectedTransaction}
          onClose={() => setSelectedTransaction(null)}
        />
      )}
    </div>
  );
};

export default Dashboard;