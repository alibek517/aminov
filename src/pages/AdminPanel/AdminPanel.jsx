import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Package,
  UserCog,
  TrendingUp,
  CreditCard,
  Building2,
  MapPin,
  LogOut,
  Loader,
  Menu,
  X,
} from "lucide-react";

import LocationApp from "./pages/LocationApp";
import Inventory from "./pages/Inventory";
import Sales from "./pages/Sales";
import Customers from "./pages/Customers";
import Employees from "./pages/Employees";
import Reports from "./pages/Reports";
import Debts from "./pages/Debts";
import Branches from "./pages/Branches";
import Logout from "../Chiqish/logout";

export default function AdminPanel() {
  const location = useLocation();
  const navigate = useNavigate();

  const initialTab = location.pathname.split("/").pop().toLowerCase() || "inventory";
  const [activeTab, setActiveTab] = useState(initialTab);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState(() => {
    return localStorage.getItem("selectedBranchId") || "";
  });
  const [branches, setBranches] = useState([{ id: "", name: "Барча филиаллар" }]);
  const [error, setError] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem("access_token"));
  const [userName, setUserName] = useState("");

  useEffect(() => {
    // Default redirect to /admin/inventory
    if (location.pathname === "/admin" || location.pathname === "/admin/") {
      navigate("/admin/inventory", { replace: true });
      setActiveTab("inventory");
    } else {
      const currentTab = location.pathname.split("/").pop().toLowerCase() || "inventory";
      setActiveTab(currentTab);
    }
  }, [location.pathname, navigate]);

  useEffect(() => {
    const user = localStorage.getItem("user");
    if (user) {
      try {
        const parsedUser = JSON.parse(user);
        const fullName = parsedUser.fullName || [parsedUser.firstName, parsedUser.lastName].filter(Boolean).join(" ").trim();
        setUserName(fullName || parsedUser.name || parsedUser.username || "User");
      } catch (e) {
        setUserName("User");
      }
    } else {
      setUserName("User");
    }
  }, []);

  const validateToken = async () => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      setIsAuthenticated(false);
      navigate("/login");
      return false;
    }

    try {
      const response = await fetch("https://suddocs.uz/auth/profile", {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        localStorage.clear();
        setIsAuthenticated(false);
        navigate("/login");
        return false;
      }

      if (!response.ok) throw new Error("Failed to validate token");

      setIsAuthenticated(true);
      return true;
    } catch (err) {
      console.error("Token validation error:", err);
      setIsAuthenticated(false);
      navigate("/login");
      return false;
    }
  };

  const fetchWithAuth = async (url, options = {}) => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      setIsAuthenticated(false);
      navigate("/login");
      throw new Error("No token found. Please login again.");
    }

    const headers = {
      ...options.headers,
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };

    const response = await fetch(url, { ...options, headers });
    if (response.status === 401) {
      const isValid = await validateToken();
      if (!isValid) {
        throw new Error("Unauthorized: Session expired.");
      }
    }

    if (!response.ok) {
      throw new Error("Network response was not ok");
    }

    return response;
  };

  useEffect(() => {
    validateToken();
  }, []);

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const response = await fetchWithAuth("https://suddocs.uz/branches");
        const data = await response.json();
        setBranches([{ id: "", name: "Барча филиаллар" }, ...data]);
        if (selectedBranchId && !data.some(branch => branch.id.toString() === selectedBranchId)) {
          setSelectedBranchId("");
          localStorage.setItem("selectedBranchId", "");
        }
      } catch (err) {
        setError("Failed to fetch branches");
      }
    };

    if (isAuthenticated) {
      fetchBranches();
    }
  }, [isAuthenticated, selectedBranchId]);

  useEffect(() => {
    localStorage.setItem("selectedBranchId", selectedBranchId);

    const handleStorageChange = (e) => {
      if (e.key === "selectedBranchId") {
        setSelectedBranchId(e.newValue || "");
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [selectedBranchId]);

  const navigation = [
    { id: "inventory", name: "Инвентар", icon: Package, path: "/admin/inventory" },
    { id: "employees", name: "Ходимлар", icon: UserCog, path: "/admin/employees" },
    { id: "debts", name: "Қарздорлик", icon: CreditCard, path: "/admin/debts" },
    { id: "branches", name: "Филиаллар", icon: Building2, path: "/admin/branches" },
    { id: "reports", name: "Ҳисобот", icon: TrendingUp, path: "/admin/reports" },
    { id: "geolocation", name: "Доставщиклар", icon: MapPin, path: "/admin/geolocation" },
  ];

  const handleLogoutConfirm = () => {
    localStorage.clear();
    setIsAuthenticated(false);
    navigate("/login");
  };

  const handleLogoutCancel = () => setShowLogoutModal(false);

  const handleBranchChange = (e) => {
    setSelectedBranchId(e.target.value);
  };

  const renderContent = () => {
    switch (activeTab.toLowerCase()) {
      case "inventory":
        return <Inventory selectedBranchId={selectedBranchId} />;
      case "employees":
        return <Employees selectedBranchId={selectedBranchId} />;
      case "debts":
        return <Debts selectedBranchId={selectedBranchId} />;
      case "branches":
        return <Branches selectedBranchId={selectedBranchId} />;
      case "reports":
        return <Reports selectedBranchId={selectedBranchId} />;
      case "sales":
        return <Sales selectedBranchId={selectedBranchId} />;
      case "customers":
        return <Customers selectedBranchId={selectedBranchId} />;
      case "geolocation":
        return (
          <LocationApp
            token={localStorage.getItem("access_token")}
            selectedBranchId={selectedBranchId}
          />
        );
      default:
        return <Inventory selectedBranchId={selectedBranchId} />;
    }
  };

  if (!isAuthenticated) {
    return <Loader className="w-16 h-16 mx-auto mt-20 text-blue-500 animate-spin" />;
  }

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const userNamee = user.fullName || user.name || user.username || "User";
  const userRole = localStorage.getItem("userRole") || "Kassir";
  const initials = userName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="flex h-screen bg-gray-50">
      <div
        className={`${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } fixed inset-y-0 left-0 z-50 w-64 transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 text-white flex flex-col`}
        style={{ backgroundColor: '#00020F' }}
      >
        <div className="p-6">
          <img 
            src="/Baner_Zippy.png" 
            alt="Zippy логотипи" 
            className="object-contain filter brightness-110 contrast-110 transition-all duration-300 hover:scale-105 hover:brightness-125" 
          />
          <hr className="my-2" />
          <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
            <img style={{borderRadius:"50%",width:'60px'}} src="/AminovHolding.jpg" alt="" />
            <div>
            <h1 className="text-xl font-bold text-white">Аминов</h1>
            <p className="text-sm text-gray-400">Бошқарма Тизими</p>
            </div>
          </div>
          {error && <span className="mt-2 text-red-500 text-sm">{error}</span>}
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden mt-3 p-2 rounded-md text-gray-300 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => {
                      setActiveTab(item.id);
                      setSidebarOpen(false);
                      navigate(item.path);
                    }}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-all duration-200 ${
                      isActive
                        ? 'bg-gradient-to-r from-[#1178f8]/20 to-[#1178f8]/10 text-[#1178f8] border border-[#1178f8]/30 shadow-lg shadow-[#1178f8]/20'
                        : 'text-gray-300 hover:bg-white/5 hover:text-white hover:shadow-md'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{item.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-4 absolute bottom-0 left-0 right-0">
          <button
            onClick={() => setShowLogoutModal(true)}
            className="w-full flex items-center space-x-3 px-4 py-2 text-gray-300 hover:bg-red-500/10 hover:text-red-400 rounded-lg transition-all duration-200 hover:border-red-500/20 border border-transparent"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-sm">Чиқиш</span>
          </button>
        </div>
      </div>

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-sm">
          <div className="flex flex-wrap justify-between items-center px-6 py-3 gap-y-2">
            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-600 mr-2"
              >
                <Menu size={20} />
              </button>
              <select
                value={selectedBranchId}
                onChange={handleBranchChange}
                className="border border-gray-300 rounded-lg py-2 px-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={error}
              >
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
              {error && (
                <span className="ml-2 text-red-500 text-sm">{error}</span>
              )}
            </div>

            <div className="flex items-center space-x-4 w-full justify-end lg:w-auto">
              <div className="flex items-center">
                <div
                  style={{ marginBottom: "5px" }}
                  className="flex items-center space-x-3"
                >
                  <div className="w-10 h-10 bg-[#1178f8] rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-white">
                      {initials}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {userNamee}
                    </p>
                    <p className="text-xxs text-gray-600">
                      {userRole === "CASHIER" ? "Kassir" : userRole || "Kassir"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden overflow-y-auto p-6">
          {renderContent()}
        </main>
      </div>

      {showLogoutModal && (
        <Logout onConfirm={handleLogoutConfirm} onCancel={handleLogoutCancel} />
      )}
    </div>
  );
}