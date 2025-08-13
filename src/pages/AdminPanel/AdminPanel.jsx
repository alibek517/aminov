import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  UserCog,
  TrendingUp,
  Search,
  Bell,
  Settings as SettingsIcon,
  Menu,
  X,
  CreditCard,
  Building2,
  LogOut,
  Loader,
  MapPin,
} from "lucide-react";
import LocationApp from "./pages/LocationApp";
import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import Sales from "./pages/Sales";
import Customers from "./pages/Customers";
import Employees from "./pages/Employees";
import Reports from "./pages/Reports";
import Debts from "./pages/Debts";
import Branches from "./pages/Branches";
import Settings from "./pages/Settings";
import Logout from "../Chiqish/logout";

export default function AdminPanel() {
  const location = useLocation();
  const navigate = useNavigate();

  // Initialize activeTab based on the current URL path
  const initialTab = location.pathname.split("/").pop() || "dashboard";
  const [activeTab, setActiveTab] = useState(initialTab);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState(() => {
    return localStorage.getItem("selectedBranchId") || "";
  });
  const [branches, setBranches] = useState([
    { id: "", name: "Барча филиаллар" },
  ]);
  const [error, setError] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(
    !!localStorage.getItem("access_token")
  );
  const [userName, setUserName] = useState("");

  useEffect(() => {
    // Redirect only if the URL is exactly /admin or /admin/
    if (location.pathname === "/admin" || location.pathname === "/admin/") {
      navigate("/admin/dashboard", { replace: true });
      setActiveTab("dashboard");
    } else {
      // Ensure activeTab matches the current URL path on refresh
      const currentTab = location.pathname.split("/").pop() || "dashboard";
      setActiveTab(currentTab);
    }
  }, [location.pathname, navigate]);

  useEffect(() => {
    const user = localStorage.getItem("user");
    if (user) {
      try {
        const parsedUser = JSON.parse(user);
        setUserName(parsedUser.name || "User");
      } catch (e) {
        setUserName(user || "User");
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
        localStorage.removeItem("access_token");
        localStorage.removeItem("userRole");
        localStorage.removeItem("user");
        localStorage.removeItem("userId");
        localStorage.removeItem("selectedBranchId");
        setIsAuthenticated(false);
        navigate("/login");
        return false;
      }

      if (!response.ok) {
        throw new Error("Failed to validate token");
      }

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
        throw new Error("Unauthorized: Session expired. Please login again.");
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
        if (
          selectedBranchId &&
          !data.some((branch) => branch.id.toString() === selectedBranchId)
        ) {
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

    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [selectedBranchId]);

  const navigation = [
    { id: "dashboard", name: "Бошқарув панели", icon: LayoutDashboard, path: "/admin/dashboard" },
    { id: "inventory", name: "Инвентар", icon: Package, path: "/admin/inventory" },
    { id: "employees", name: "Ходимлар", icon: UserCog, path: "/admin/employees" },
    { id: "debts", name: "Қарздорлик", icon: CreditCard, path: "/admin/debts" },
    { id: "branches", name: "Филиаллар", icon: Building2, path: "/admin/branches" },
    { id: "reports", name: "Ҳисобот", icon: TrendingUp, path: "/admin/reports" },
    { id: "geolocation", name: "Доставщиклар", icon: MapPin, path: "/admin/geolocation" },
    { id: "settings", name: "Созламалар", icon: SettingsIcon, path: "/admin/settings" },
  ];

  const handleLogoutConfirm = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("userRole");
    localStorage.removeItem("user");
    localStorage.removeItem("userId");
    localStorage.removeItem("selectedBranchId");
    setIsAuthenticated(false);
    navigate("/login");
  };

  const handleLogoutCancel = () => {
    setShowLogoutModal(false);
  };

  const handleBranchChange = (e) => {
    setSelectedBranchId(e.target.value);
  };

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return <Dashboard selectedBranchId={selectedBranchId} />;
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
      case "geolocation":
        return (
          <LocationApp
            token={localStorage.getItem("access_token")}
            selectedBranchId={selectedBranchId}
          />
        );
      case "settings":
        return <Settings selectedBranchId={selectedBranchId} />;
      default:
        return <Dashboard selectedBranchId={selectedBranchId} />;
    }
  };

  if (!isAuthenticated) {
    return (
      <Loader className="w-16 h-16 mx-auto mt-20 text-blue-500 animate-spin" />
    );
  }

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const userNamee = user.name || "Dr. Rodriguez";
  const userRole = localStorage.getItem("userRole") || "Kassir";
  const initials = userName
    .split(" ")
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex h-screen bg-gray-50">
      <div
        className={`${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-xl transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0`}
      >
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200 mt-3">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-[#1178f8] rounded-lg flex items-center justify-center">
              <Package className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Aminov</h1>
              <p className="text-sm text-gray-600">Boshqarma Tizimi</p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-600"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="mt-8 px-4">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setSidebarOpen(false);
                  navigate(item.path);
                }}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors ${
                  activeTab === item.id
                    ? "bg-[#1178f8] bg-opacity-10 text-[#1178f8] border border-[#1178f8] border-opacity-20"
                    : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <Icon size={20} className="mr-3" />
                {item.name}
              </button>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowLogoutModal(true)}
              className="flex items-center justify-between p-1 text-gray-400 hover:text-red-600 rounded-md ml-2"
            >
              <LogOut size={20} />
              <span className="ml-2">Чиқиш</span>
            </button>
          </div>
        </div>
      </div>

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-sm border-b">
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