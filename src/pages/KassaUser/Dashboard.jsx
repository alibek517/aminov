import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { DollarSign, AlertTriangle } from "lucide-react";

const StatCard = ({ title, value }) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow duration-200 flex flex-col justify-between">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-600">{title}</p>
        <p className="text-2xl font-bold text-gray-900 mt-2">{value}</p>
      </div>
      <div className="p-3 bg-blue-50 rounded-lg">
        <DollarSign className="text-blue-600" size={24} />
      </div>
    </div>
  </div>
);

const Notification = ({ message, type, onClose }) => (
  <div
    className={`p-4 rounded ${type === "error" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
      } mb-4`}
  >
    {message}
    <button className="ml-4 text-sm underline" onClick={onClose}>
      Yopish
    </button>
  </div>
);

const Dashboard = () => {
  const [products, setProducts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [startDate, setStartDate] = useState("2025-08-12");
  const [endDate, setEndDate] = useState("2025-08-12");
  const navigate = useNavigate();
  const token = localStorage.getItem("access_token");
  const userId = localStorage.getItem("userId");
  const API_URL = "https://suddocs.uz";

  // Formatting functions
  const formatCurrency = (amount) =>
    amount >= 0 ? new Intl.NumberFormat("uz-UZ").format(amount) + " so'm" : "Noma'lum";
  const formatQuantity = (qty) =>
    qty >= 0 ? new Intl.NumberFormat("uz-UZ").format(qty) + " dona" : "Noma'lum";
  const formatDate = (date) => new Date(date).toLocaleDateString("uz-Cyrl-UZ");

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

  // Fetch branches and set initial branch from localStorage
  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const branchData = await fetchWithAuth(`${API_URL}/branches`);
        setBranches(branchData);
        const storedBranchId = localStorage.getItem("branchId");
        if (storedBranchId && branchData.some((b) => b.id === Number(storedBranchId))) {
          setSelectedBranchId(storedBranchId);
        }
      } catch (err) {
        setNotification({ message: err.message || "Filiallarni yuklashda xatolik", type: "error" });
      }
    };
    fetchBranches();
  }, [navigate]);

  // Fetch transactions and products based on selected branch
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
      const [transactionsData, productsData] = await Promise.all([
        fetchWithAuth(`${API_URL}/transactions${queryParams}`),
        fetchWithAuth(`${API_URL}/products${queryParams}`),
      ]);

      setTransactions(transactionsData);
      setProducts(productsData);
      setError(null);
    } catch (err) {
      const message = err.message || "Ma'lumotlarni yuklashda xatolik";
      console.error("Fetch error:", err);
      setNotification({ message, type: "error" });
    } finally {
      setLoading(false);
    }
  }, [selectedBranchId, navigate]);

  useEffect(() => {
    if (token && selectedBranchId) {
      fetchData();
    } else if (!token) {
      navigate("/login");
    }
  }, [token, selectedBranchId, fetchData, navigate]);

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

  // Calculate cash in register for the selected date range
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

    const userTransactions = transactions.filter((tx) => tx.userId === Number(userId));

    const cash = userTransactions
      .filter(
        (tx) =>
          tx.type === "SALE" &&
          new Date(tx.createdAt) >= start &&
          new Date(tx.createdAt) <= end
      )
      .reduce((sum, tx) => sum + (parseFloat(tx.finalTotal) || 0), 0);

    return formatCurrency(cash);
  };

  const cashInRegister = calculateCashInRegister();

  // Memoize filtered transactions for the "Сўнгги Сотиш" table
  const filteredTransactions = useMemo(() => {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    return transactions
      .filter((transaction) => {
        const txDate = new Date(transaction.createdAt);
        return (
          transaction.userId === Number(userId) &&
          txDate >= start &&
          txDate <= end
        );
      })
      .slice(0, 5);
  }, [transactions, userId, startDate, endDate]);

  const lowStockItems = products
    .filter((product) => product.quantity < 5)
    .slice(0, 5)
    .map((product) => ({
      name: product.name,
      quantity: product.quantity,
      branch: branches.find((b) => b.id === product.branchId)?.name || "Номаълум филиал",
    }));

  return (
    <div style={{ marginLeft: "250px" }} className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Бошқарув Панели</h1>
          <p className="text-gray-600 mt-1">Бугунги санага умумий маълумотлар</p>
        </div>
        <div className="text-sm text-gray-500">
          <button
            style={{
              border: '2px solid #4A90E2',
              padding: '12px 24px',
              backgroundColor: '#fff',
              borderRadius: '25px',
              fontSize: '16px',
              color: '#4A90E2',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
            }}
            onMouseOver={(e) => {
              e.target.style.backgroundColor = '#4A90E2';
              e.target.style.color = '#fff';
              e.target.style.boxShadow= '0px 0px 150px rgba(0, 0, 0)'
              ;
            }}
            onMouseOut={(e) => {
              e.target.style.backgroundColor = '#fff';
              e.target.style.color = '#4A90E2';
              e.target.style.boxShadow= '0 4px 6px rgba(0, 0, 0, 0.1)'
            }}
          >
            Сотувчилар маоши
          </button>


        </div>
      </div>

      <select
        style={{ display: "none" }}
        value={selectedBranchId}
        onChange={(e) => setSelectedBranchId(e.target.value)}
        className="w-full p-2 border rounded mb-4"
      >
        <option value="">Filial tanlang</option>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>

      {/* Date Range Inputs */}
      <div className="flex flex-col sm:flex-row sm:space-x-4 mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Бошланғич сана</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          />
        </div>
        <div className="flex-1 mt-4 sm:mt-0">
          <label className="block text-sm font-medium text-gray-700 mb-1">Тугаш сана</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          />
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
                        Тури
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
                          <td className="px-6 py-4 text-gray-700">{transaction.type}</td>
                          <td className="px-6 py-4 text-gray-700">
                            {transaction.customer
                              ? `${transaction.customer.firstName} ${transaction.customer.lastName}`
                              : "Номаълум"}
                          </td>
                          <td className="px-6 py-4 text-gray-700">
                            {formatCurrency(transaction.finalTotal)}
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
    </div>
  );
};

export default Dashboard;