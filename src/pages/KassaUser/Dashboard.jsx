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
        Жами сумма:{" "}
        {Number(totalAmount || 0)
          .toString()
          .replace(/\B(?=(\d{3})+(?!\d))/g, " ")}
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
  // Always get selectedBranchId from localStorage
  const selectedBranchId = localStorage.getItem("selectedBranchId") || "";

  // Cashier report state (current user from localStorage)
  const currentUserId = Number(localStorage.getItem("userId")) || null;
  const [cashierLoading, setCashierLoading] = useState(false);
  const [cashierReport, setCashierReport] = useState(null);
  const [reportDate, setReportDate] = useState(() => {
    const todayStr = new Date().toLocaleDateString("en-CA");
    return { startDate: todayStr, endDate: todayStr };
  });

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

      const productsUrl = selectedBranchId
        ? `https://suddocs.uz/products?branchId=${selectedBranchId}`
        : "https://suddocs.uz/products";

      const [productRes, categoryRes, branchRes] = await Promise.all([
        fetch(productsUrl, { headers }),
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
  }, [token, navigate, selectedBranchId]);

  // Helpers for cashier block
  const formatDate = (dateString) => {
    return dateString
      ? new Date(dateString).toLocaleDateString("uz-UZ", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "N/A";
  };
  const formatAmount = (value) => {
    const num = Math.floor(Number(value) || 0);
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  };
  const getPaymentTypeLabel = (pt) => {
    switch (pt) {
      case "CASH":
        return "Нақд";
      case "CARD":
        return "Карта";
      case "CREDIT":
        return "Кредит";
      case "INSTALLMENT":
        return "Бўлиб тўлаш";
      default:
        return pt || "N/A";
    }
  };
  const getUserName = (user) => {
    if (!user) return "Йўқ";
    return `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Йўқ";
  };

  // Fetch cashier report for current user
  useEffect(() => {
    const fetchCashier = async () => {
      if (!token || !currentUserId) return;
      setCashierLoading(true);
      try {
        const headers = {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        };
        const params = new URLSearchParams();
        if (reportDate.startDate)
          params.append(
            "startDate",
            new Date(`${reportDate.startDate}T00:00:00`).toISOString()
          );
        if (reportDate.endDate)
          params.append(
            "endDate",
            new Date(`${reportDate.endDate}T23:59:59`).toISOString()
          );
        if (selectedBranchId) params.append("branchId", selectedBranchId);
        params.append("limit", "all");

        const res = await fetch(
          `https://suddocs.uz/transactions?${params.toString()}`,
          { headers }
        );
        if (!res.ok) throw new Error("Server error");
        const data = await res.json();
        const transactions = data.transactions || data || [];

        const startBound = reportDate.startDate
          ? new Date(`${reportDate.startDate}T00:00:00`)
          : null;
        const endBound = reportDate.endDate
          ? new Date(`${reportDate.endDate}T23:59:59`)
          : null;

        const agg = {
          id: currentUserId,
          name: getUserName(JSON.parse(localStorage.getItem("user") || "{}")),
          cashTotal: 0,
          cardTotal: 0,
          creditTotal: 0,
          installmentTotal: 0,
          upfrontTotal: 0,
          soldQuantity: 0,
          soldAmount: 0,
          repaymentTotal: 0,
          repayments: [],
          transactions: [],
        };

        // Track schedule IDs to avoid double-counting across multiple sources
        const seenSchedules = new Set();

        for (const t of Array.isArray(transactions) ? transactions : []) {
          if (t.type === "SALE") {
            // Sales totals credited if current user was the seller
            if (
              t.soldBy?.id === currentUserId ||
              t.user?.id === currentUserId
            ) {
              const final = Number(t.finalTotal || t.total || 0);
              const amountPaid = Number(t.amountPaid || 0);
              const downPayment = Number(t.downPayment || 0);
              const upfront = amountPaid + downPayment;
              switch (t.paymentType) {
                case "CASH":
                  agg.cashTotal += final;
                  break;
                case "CARD":
                  agg.cardTotal += final;
                  break;
                case "CREDIT":
                  agg.creditTotal += final;
                  agg.upfrontTotal += upfront;
                  break;
                case "INSTALLMENT":
                  agg.installmentTotal += final;
                  agg.upfrontTotal += upfront;
                  break;
                default:
                  break;
              }
              if (Array.isArray(t.items)) {
                for (const it of t.items) {
                  const qty = Number(it.quantity) || 0;
                  const amount =
                    it.total != null
                      ? Number(it.total) || 0
                      : (Number(it.price) || 0) * qty;
                  agg.soldQuantity += qty;
                  agg.soldAmount += amount;
                }
              }
              agg.transactions.push({
                id: t.id,
                createdAt: t.createdAt,
                paymentType: t.paymentType,
                finalTotal: t.finalTotal || t.total || 0,
                amountPaid,
                downPayment,
                soldByName: getUserName(t.soldBy) || getUserName(t.user) || "-",
              });
            }
          }
          if (Array.isArray(t.paymentSchedules)) {
            for (const s of t.paymentSchedules) {
              // Only include repayments with a valid paidAt date
              if (!s || !s.paidAt) continue;
              const paidValue = Number((s.paidAmount ?? s.payment) || 0);
              if (!(s.isPaid || paidValue > 0)) continue;
              const pDate = new Date(s.paidAt);
              const inRange =
                (!startBound || pDate >= startBound) &&
                (!endBound || pDate <= endBound);
              if (!inRange) continue;
              const installment = paidValue;
              if (Number.isNaN(installment) || installment <= 0) continue;
              if (s.paidBy?.id === currentUserId) {
                if (s.id && seenSchedules.has(s.id)) continue;
                if (s.id) seenSchedules.add(s.id);
                agg.repaymentTotal += installment;
                agg.repayments.push({
                  scheduleId: s.id,
                  paidAt: s.paidAt,
                  amount: installment,
                  channel: s.paidChannel || null,
                  transactionId: t.id,
                  month: s.month,
                  customer: t.customer || null,
                  paidBy: s.paidBy || null,
                  soldBy: t.soldBy || null,
                });
              }
            }
          }
        }

        // Include repayments paid within range even if the sale happened earlier
        try {
          const headers2 = {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          };
          const urlBase = new URL(`https://suddocs.uz/transactions`);
          const baseParams = new URLSearchParams();
          if (selectedBranchId) baseParams.append("branchId", selectedBranchId);
          baseParams.append("limit", "all");

          const urls = [
            `${urlBase}?${new URLSearchParams({
              ...Object.fromEntries(baseParams),
              paymentType: "CREDIT",
            }).toString()}`,
            `${urlBase}?${new URLSearchParams({
              ...Object.fromEntries(baseParams),
              paymentType: "INSTALLMENT",
            }).toString()}`,
          ];

          const [creditRes, installmentRes] = await Promise.all([
            fetch(urls[0], { headers: headers2 }),
            fetch(urls[1], { headers: headers2 }),
          ]);

          const creditData = creditRes.ok
            ? await creditRes.json().catch(() => ({}))
            : {};
          const installmentData = installmentRes.ok
            ? await installmentRes.json().catch(() => ({}))
            : {};

          const creditTx = Array.isArray(creditData?.transactions)
            ? creditData.transactions
            : Array.isArray(creditData)
            ? creditData
            : [];
          const installmentTx = Array.isArray(installmentData?.transactions)
            ? installmentData.transactions
            : Array.isArray(installmentData)
            ? installmentData
            : [];
          const allCreditTx = [...creditTx, ...installmentTx];

          for (const t of allCreditTx) {
            if (!Array.isArray(t?.paymentSchedules)) continue;
            // Ensure branch filter matches if backend didn't filter
            if (
              selectedBranchId &&
              String(t.fromBranchId || t.branchId || "") !== String(selectedBranchId)
            ) {
              continue;
            }
            for (const s of t.paymentSchedules) {
              if (!s || !s.paidAt) continue;
              const paidValue = Number((s.paidAmount ?? s.payment) || 0);
              if (!(s.isPaid || paidValue > 0)) continue;
              const pDate = new Date(s.paidAt);
              const inRange =
                (!startBound || pDate >= startBound) &&
                (!endBound || pDate <= endBound);
              if (!inRange) continue;
              const installment = Number((s.paidAmount ?? s.payment) || 0);
              if (Number.isNaN(installment) || installment <= 0) continue;
              if (s.paidBy?.id === currentUserId) {
                if (s.id && seenSchedules.has(s.id)) continue;
                if (s.id) seenSchedules.add(s.id);
                agg.repaymentTotal += installment;
                agg.repayments.push({
                  scheduleId: s.id,
                  paidAt: s.paidAt,
                  amount: installment,
                  channel: s.paidChannel || null,
                  transactionId: t.id,
                  month: s.month,
                  customer: t.customer || null,
                  paidBy: s.paidBy || null,
                  soldBy: t.soldBy || null,
                });
              }
            }
          }
        } catch (e) {
          // If supplemental fetch fails, proceed with what we have
          console.warn("Supplemental credit/installment fetch failed", e);
        }

        setCashierReport(agg);
      } catch (e) {
        console.error("Cashier report error", e);
        setCashierReport(null);
      } finally {
        setCashierLoading(false);
      }
    };
    fetchCashier();
  }, [
    token,
    currentUserId,
    reportDate.startDate,
    reportDate.endDate,
    selectedBranchId,
  ]);

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
    <div className="ml-[255px] space-y-6 p-4">
      {/* Cashier personal report (from Reports.jsx modal) */}
      {currentUserId && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 mt-4">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              Кассир — тўлиқ сотувлар
            </h3>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={reportDate.startDate}
                onChange={(e) =>
                  setReportDate((f) => ({ ...f, startDate: e.target.value }))
                }
                className="border rounded px-2 py-1 text-sm"
              />
              <input
                type="date"
                value={reportDate.endDate}
                onChange={(e) =>
                  setReportDate((f) => ({ ...f, endDate: e.target.value }))
                }
                className="border rounded px-2 py-1 text-sm"
              />
            </div>
          </div>
          <div className="p-6">
            {cashierLoading ? (
              <div className="text-gray-500">Юкланмоқда...</div>
            ) : !cashierReport ? (
              <div className="text-gray-500">Маълумот йўқ</div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                  <div className="p-3 rounded border">
                    <div className="text-sm text-gray-500">Нақд</div>
                    <div className="font-semibold">
                      {formatAmount(cashierReport.cashTotal)}
                    </div>
                  </div>
                  <div className="p-3 rounded border">
                    <div className="text-sm text-gray-500">Карта</div>
                    <div className="font-semibold">
                      {formatAmount(cashierReport.cardTotal)}
                    </div>
                  </div>
                  <div className="p-3 rounded border">
                    <div className="text-sm text-gray-500">Кредит</div>
                    <div className="font-semibold">
                      {formatAmount(cashierReport.creditTotal)}
                    </div>
                  </div>
                  <div className="p-3 rounded border">
                    <div className="text-sm text-gray-500">Бўлиб тўлаш</div>
                    <div className="font-semibold">
                      {formatAmount(cashierReport.installmentTotal)}
                    </div>
                  </div>
                  <div className="p-3 rounded border">
                    <div className="text-sm text-gray-500">
                      Олдиндан олинган
                    </div>
                    <div className="font-semibold">
                      {formatAmount(cashierReport.upfrontTotal)}
                    </div>
                  </div>
                  <div className="p-3 rounded border bg-purple-50">
                    <div className="text-sm">Кредитдан тўланган</div>
                    <div className="text-xl font-bold">
                      {formatAmount(cashierReport.repaymentTotal || 0)}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <div className="text-xs">Naqd</div>
                        <div className="font-semibold">
                          {formatAmount(
                            (cashierReport.repayments || [])
                              .filter(
                                (r) =>
                                  (r.channel || "CASH").toUpperCase() === "CASH"
                              )
                              .reduce((s, r) => s + Number(r.amount || 0), 0)
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs">Karta</div>
                        <div className="font-semibold">
                          {formatAmount(
                            (cashierReport.repayments || [])
                              .filter(
                                (r) =>
                                  (r.channel || "CASH").toUpperCase() === "CARD"
                              )
                              .reduce((s, r) => s + Number(r.amount || 0), 0)
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="p-3 rounded border">
                    <div className="text-sm text-gray-500">Сотилган дона</div>
                    <div className="font-semibold">
                      {cashierReport.soldQuantity}
                    </div>
                  </div>
                  <div className="p-3 rounded border">
                    <div className="text-sm text-gray-500">
                      Топширадиган пул
                    </div>
                    <div className="font-semibold">
                      {formatAmount(
                        cashierReport.cashTotal +
                          (cashierReport.repayments || [])
                            .filter(
                              (r) =>
                                (r.channel || "CASH").toUpperCase() === "CASH"
                            )
                            .reduce((s, r) => s + Number(r.amount || 0), 0) +
                          cashierReport.upfrontTotal
                      )}
                    </div>
                  </div>
                </div>

                {Array.isArray(cashierReport.repayments) &&
                  cashierReport.repayments.length > 0 && (
                    <div className="mb-4">
                      <div className="text-sm font-semibold text-gray-700 mb-2">
                        Кредитдан тўловлар (oylar bo'yicha)
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-2 text-left">Ой</th>
                              <th className="px-3 py-2 text-left">
                                Тўланган куни
                              </th>
                              <th className="px-3 py-2 text-left">Сумма</th>
                              <th className="px-3 py-2 text-left">
                                Транзакция
                              </th>
                              <th className="px-3 py-2 text-left">Мижоз</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {cashierReport.repayments.map((r, idx) => (
                              <tr key={idx} className="hover:bg-gray-50">
                                <td className="px-3 py-2">{r.month}</td>
                                <td className="px-3 py-2">
                                  {formatDate(r.paidAt)}
                                </td>
                                <td className="px-3 py-2">
                                  {formatAmount(r.amount)}
                                </td>
                                <td className="px-3 py-2">
                                  #{r.transactionId}
                                </td>
                                <td className="px-3 py-2">
                                  {r.customer?.fullName || "-"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left">ID</th>
                        <th className="px-3 py-2 text-left">Сана</th>
                        <th className="px-3 py-2 text-left">Тўлов тури</th>
                        <th className="px-3 py-2 text-left">Олдиндан</th>
                        <th className="px-3 py-2 text-left">Якуний</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {(cashierReport.transactions || []).map((t) => (
                        <tr key={t.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2">#{t.id}</td>
                          <td className="px-3 py-2">
                            {formatDate(t.createdAt)}
                          </td>
                          <td className="px-3 py-2">
                            {getPaymentTypeLabel(t.paymentType)}
                          </td>
                          <td className="px-3 py-2">
                            {formatAmount(
                              Number(t.amountPaid || 0) +
                                Number(t.downPayment || 0)
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {formatAmount(t.finalTotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
