import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  DollarSign,
  Package,
  ShoppingCart,
  AlertTriangle,
  Building2,
  LayoutGrid,
} from "lucide-react";

const StatCard = ({
  title,
  value,
  change,
  isPositive,
  icon: Icon,
  totalAmount,
}) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow duration-200 flex flex-col justify-between">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-600">{title}</p>
        <p className="text-2xl font-bold text-gray-900 mt-2">{value}</p>
      </div>
      <div className="p-3 bg-blue-50 rounded-lg">
        <Icon className="text-blue-600" size={24} />
      </div>
    </div>
    {totalAmount !== undefined && (
      <p className="mt-4 text-sm text-gray-700 font-semibold border-t border-gray-200 pt-3">
        Жами сумма: {(totalAmount || 0).toLocaleString()} сўм
      </p>
    )}
  </div>
);

const Dashboard = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [branches, setBranches] = useState([]);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const token = localStorage.getItem("access_token");

  const soldProducts = products
    .filter((product) => product.status === "SOLD")
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, 5);

  const totalSoldAmount = soldProducts.reduce((acc, item) => {
    const price = parseFloat(item.price) || 0;
    const quantity = parseFloat(item.quantity) || 0;
    return acc + price * quantity;
  }, 0);

  const fetchData = async () => {
    if (!token) return;
    try {
      const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };

      const [productRes, categoryRes, branchRes] = await Promise.all([
        fetch("https://suddocs.uz/products", { headers }),
        fetch("https://suddocs.uz/categories", { headers }),
        fetch("https://suddocs.uz/branches", { headers }),
      ]);

      if (!productRes.ok || !categoryRes.ok || !branchRes.ok) {
        throw new Error("Маълумотларни олишда хатолик юз берди");
      }

      const [productData, categoryData, branchData] = await Promise.all([
        productRes.json(),
        categoryRes.json(),
        branchRes.json(),
      ]);

      setProducts(productData);
      setCategories(categoryData);
      setBranches(branchData);
      setError(null);
    } catch (err) {
      console.error("Fetch error:", err);
      setError(err.message || "Маълумотларни олишда хатолик юз берди");
    }
  };

  useEffect(() => {
    if (!token) {
      navigate("/login");
    } else {
      fetchData();
    }
  }, [token, navigate]);

  if (error) {
    return <div className="text-red-600 text-center">{error}</div>;
  }

  const getBranchName = (id) => {
    const branch = branches.find((b) => b.id === id);
    return branch?.name || "Номаълум филиал";
  };

  const lowStockItems = products
    .filter((product) => product.quantity < 5)
    .slice(0, 5)
    .map((product) => ({
      name: product.name,
      quantity: product.quantity,
      branch: getBranchName(product.branchId),
    }));

  const stats = [
    {
      title: "Филиаллар сони",
      value: branches.length.toString(),
      isPositive: true,
      icon: Building2,
    },
    {
      title: "Маҳсулотлар сони",
      value: products.length.toString(),
      change: "+0%",
      isPositive: true,
      icon: Package,
    },
    {
      title: "Категориялар",
      value: categories.length.toString(),
      change: "+0%",
      isPositive: true,
      icon: LayoutGrid,
    },
    {
      title: "Сотилган маҳсулотлар",
      value: soldProducts.length.toString(),
      change: "-0%",
      isPositive: false,
      icon: ShoppingCart,
      totalAmount: totalSoldAmount,
    },
  ];

  function formatPrice(number) {
    return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Бошқарув Панели</h1>
          <p className="text-gray-600 mt-1">
            Бугунги санага умумий маълумотлар
          </p>
        </div>
        <div className="text-sm text-gray-500">
          Охирги янгиланиш: {new Date().toLocaleString("uz-Cyrl-UZ")}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <StatCard key={index} {...stat} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900">
              Сўнгги Сотувлар
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Маҳсулот
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Миқдор
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Нархи
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Филиал
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Сана / Вақт
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {soldProducts.length > 0 ? (
                  soldProducts.map((item) => {
                    const branch = branches.find((b) => b.id === item.branchId);
                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-gray-50 transition-colors duration-150"
                      >
                        <td className="px-6 py-4 text-gray-900">{item.name}</td>
                        <td className="px-6 py-4 text-gray-700">
                          {item.quantity} шт
                        </td>
                        <td className="px-6 py-4 text-gray-700">
                          {item.price?.toLocaleString()} сўм
                        </td>
                        <td className="px-6 py-4 text-gray-700">
                          {branch ? branch.name : "Филиал топилмади"}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-gray-900">
                            {new Date(item.updatedAt).toLocaleDateString(
                              "uz-Cyrl-UZ"
                            )}
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(item.updatedAt).toLocaleTimeString(
                              "uz-Cyrl-UZ",
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-4 text-center text-gray-500"
                    >
                      Сотилган маҳсулотлар йўқ
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Low Stock */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-6 border-b border-gray-100 flex items-center">
            <AlertTriangle className="text-orange-500 mr-2" size={20} />
            <h3 className="text-lg font-semibold text-gray-900">
              Кам қолган маҳсулотлар
            </h3>
          </div>
          <div className="p-6 space-y-4">
            {lowStockItems.length > 0 ? (
              lowStockItems.map((item, index) => (
                <div
                  key={index}
                  className="border-l-4 border-orange-400 pl-4 py-2"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">
                        {item.name}
                      </p>
                      <p className="text-xs text-gray-500">{item.branch}</p>
                    </div>
                    <div className="text-sm font-semibold text-orange-600">
                      {item.quantity} дона
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center">
                Кам қолган маҳсулотлар йўқ
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
