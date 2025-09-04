import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatAmount, formatCurrency } from '../../../utils/currencyFormat';
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
  const [defectivePlus, setDefectivePlus] = useState(0);
  const [defectiveMinus, setDefectiveMinus] = useState(0);
  const [reportDate, setReportDate] = useState(() => {
    const todayStr = new Date().toLocaleDateString("en-CA");
    return { startDate: todayStr, endDate: todayStr };
  });

  // Report modal state
  const [statsLoading, setStatsLoading] = useState(false);
  const [openReport, setOpenReport] = useState(null);
  const [reportLoadingModal, setReportLoadingModal] = useState(false);
  const [reportRows, setReportRows] = useState([]);

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

        // Debug: Log the raw transactions data
        console.log('Raw transactions from API:', transactions.slice(0, 3)); // Show first 3 transactions

        // Filter transactions for current user to see what we're working with
        const userTransactions = transactions.filter(t =>
          t.type === 'SALE' &&
          (t.soldBy?.id === currentUserId || t.user?.id === currentUserId)
        );
        console.log('User transactions:', userTransactions.slice(0, 3));

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
          upfrontCash: 0,
          upfrontCard: 0,
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
              // Debug: Log each transaction being processed
              console.log('Processing transaction:', {
                id: t.id,
                type: t.type,
                paymentType: t.paymentType,
                amountPaid: t.amountPaid,
                downPayment: t.downPayment,
                upfrontPaymentType: t.upfrontPaymentType,
                finalTotal: t.finalTotal,
                total: t.total
              });
              const final = Number(t.finalTotal || t.total || 0);
              const amountPaid = Number(t.amountPaid || 0);
              const downPayment = Number(t.downPayment || 0);
              // For CREDIT/INSTALLMENT, upfront payment is stored in amountPaid
              // For other payment types, upfront is 0
              // NOTE: amountPaid contains ONLY the upfront payment, not credit repayments
              // Credit repayments are tracked separately in creditRepaymentAmount field
              const upfront = ['CREDIT', 'INSTALLMENT'].includes(t.paymentType) ? amountPaid : 0;

              // Debug logging for upfront payments
              if (['CREDIT', 'INSTALLMENT'].includes(t.paymentType) && upfront > 0) {
                console.log('Upfront payment found:', {
                  transactionId: t.id,
                  paymentType: t.paymentType,
                  amountPaid,
                  downPayment,
                  upfront,
                  upfrontPaymentType: t.upfrontPaymentType
                });
              }

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
                  // Track upfront payment by type
                  const upfrontType = t.upfrontPaymentType || 'CASH';
                  console.log('Processing upfront payment:', {
                    transactionId: t.id,
                    upfrontType,
                    upfront,
                    upfrontPaymentType: t.upfrontPaymentType
                  });
                  if (upfrontType === 'CASH') {
                    agg.upfrontCash += upfront;
                  } else if (upfrontType === 'CARD') {
                    agg.upfrontCard += upfront;
                  }
                  break;
                case "INSTALLMENT":
                  agg.installmentTotal += final;
                  agg.upfrontTotal += upfront;
                  // Track upfront payment by type
                  const upfrontType2 = t.upfrontPaymentType || 'CASH';
                  console.log('Processing installment upfront payment:', {
                    transactionId: t.id,
                    upfrontType: upfrontType2,
                    upfront,
                    upfrontPaymentType: t.upfrontPaymentType
                  });
                  if (upfrontType2 === 'CASH') {
                    agg.upfrontCash += upfront;
                  } else if (upfrontType2 === 'CARD') {
                    agg.upfrontCard += upfront;
                  }
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
                upfrontPaymentType: t.upfrontPaymentType,
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
                console.log('Dashboard: Processing payment schedule:', {
                  scheduleId: s.id,
                  paidChannel: s.paidChannel,
                  amount: installment,
                  transactionId: t.id
                });
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

        // Include daily repayments from backend into cashierReport totals and list
        try {
          const dailyRepaymentsRes = await fetch(
            `https://suddocs.uz/daily-repayments/cashier/${currentUserId}?branchId=${selectedBranchId}&startDate=${new Date(`${reportDate.startDate}T00:00:00`).toISOString()}&endDate=${new Date(`${reportDate.endDate}T23:59:59`).toISOString()}`,
            { headers }
          );

          if (dailyRepaymentsRes.ok) {
            const dailyRepayments = await dailyRepaymentsRes.json();
            for (const l of Array.isArray(dailyRepayments) ? dailyRepayments : []) {
              const ch = (l.channel || 'CASH').toUpperCase();
              agg.repaymentTotal += Number(l.amount || 0);
              agg.repayments.push({
                scheduleId: `daily-${l.id}`,
                paidAt: l.paidAt,
                amount: Number(l.amount || 0),
                channel: ch,
                transactionId: l.transactionId,
                month: 'Кунлик',
                customer: l.transaction?.customer || null,
                paidBy: l.paidBy || { id: l.paidByUserId },
              });
              console.log('Dashboard: Added daily repayment from backend:', {
                amount: l.amount,
                channel: ch,
                transactionId: l.transactionId
              });
            }
          }
        } catch (error) {
          console.warn('Failed to fetch daily repayments from backend:', error);
        }

        // Include credit repayments from backend into cashierReport totals and list
        try {
          const creditRepaymentsRes = await fetch(
            `https://suddocs.uz/credit-repayments/cashier/${currentUserId}?branchId=${selectedBranchId}&startDate=${new Date(`${reportDate.startDate}T00:00:00`).toISOString()}&endDate=${new Date(`${reportDate.endDate}T23:59:59`).toISOString()}`,
            { headers }
          );

          if (creditRepaymentsRes.ok) {
            const creditRepayments = await creditRepaymentsRes.json();
            for (const l of Array.isArray(creditRepayments) ? creditRepayments : []) {
              const ch = (l.channel || 'CASH').toUpperCase();
              agg.repaymentTotal += Number(l.amount || 0);
              agg.repayments.push({
                scheduleId: l.scheduleId || `credit-${l.id}`,
                paidAt: l.paidAt,
                amount: Number(l.amount || 0),
                channel: ch,
                transactionId: l.transactionId,
                month: l.month || '-',
                customer: l.transaction?.customer || null,
                paidBy: l.paidBy || { id: l.paidByUserId },
                soldBy: l.transaction?.soldBy || null,
              });
              console.log('Dashboard: Added credit repayment from backend:', {
                amount: l.amount,
                channel: ch,
                transactionId: l.transactionId,
                month: l.month
              });
            }
          }
        } catch (error) {
          console.warn('Failed to fetch credit repayments from backend:', error);
        }

        // Include defective logs (returns) for cash adjustments
        try {
          const params2 = new URLSearchParams();
          if (selectedBranchId) params2.append("branchId", selectedBranchId);
          // backend might not support date filters; fetch and filter client-side
          const resDef = await fetch(`https://suddocs.uz/defective-logs?${params2.toString()}`, { headers });
          let plus = 0;
          let minus = 0;
          if (resDef.ok) {
            const logs = await resDef.json().catch(() => []);
            const list = Array.isArray(logs) ? logs : (Array.isArray(logs.items) ? logs.items : []);
            const startBound2 = reportDate.startDate ? new Date(`${reportDate.startDate}T00:00:00`) : null;
            const endBound2 = reportDate.endDate ? new Date(`${reportDate.endDate}T23:59:59`) : null;
            for (const log of list) {
              const createdAt = log.createdAt ? new Date(log.createdAt) : null;
              const inRange = createdAt && (!startBound2 || createdAt >= startBound2) && (!endBound2 || createdAt <= endBound2);
              if (!inRange) continue;
              const rawAmt = Number(log.cashAmount ?? log.amount ?? log.value ?? 0) || 0;
              if (rawAmt === 0) continue;
              // only count adjustments for this cashier
              const actorIdRaw = (log.createdBy && log.createdBy.id) ?? log.createdById ?? (log.user && log.user.id) ?? log.userId ?? (log.performedBy && log.performedBy.id) ?? log.performedById ?? null;
              const actorId = actorIdRaw != null ? Number(actorIdRaw) : null;
              if (!actorId || actorId !== currentUserId) continue;
              if (rawAmt > 0) plus += rawAmt; else if (rawAmt < 0) minus += Math.abs(rawAmt);
            }
          }
          setDefectivePlus(plus);
          setDefectiveMinus(minus);
        } catch (err) {
          setDefectivePlus(0);
          setDefectiveMinus(0);
        }

        // Debug logging for final aggregation
        console.log('Final cashier report aggregation:', {
          cashTotal: agg.cashTotal,
          cardTotal: agg.cardTotal,
          creditTotal: agg.creditTotal,
          installmentTotal: agg.installmentTotal,
          upfrontTotal: agg.upfrontTotal,
          upfrontCash: agg.upfrontCash,
          upfrontCard: agg.upfrontCard,
          repaymentTotal: agg.repaymentTotal
        });

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

  // Function to open report modal and fetch data
  const openReportModal = async (reportType) => {
    setOpenReport(reportType);
    setReportLoadingModal(true);
    setReportRows([]);
    
    try {
      const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };
      
      const params = new URLSearchParams();
      if (selectedBranchId) params.append("branchId", selectedBranchId);
      if (reportDate.startDate) {
        params.append("startDate", new Date(`${reportDate.startDate}T00:00:00`).toISOString());
      }
      if (reportDate.endDate) {
        params.append("endDate", new Date(`${reportDate.endDate}T23:59:59`).toISOString());
      }
      params.append("limit", "all");
      
      let endpoint = "";
      switch (reportType) {
        case "sale":
          endpoint = "transactions";
          params.append("type", "SALE");
          break;
        case "purchase":
          endpoint = "transactions";
          params.append("type", "PURCHASE");
          break;
        case "transfer":
          endpoint = "transactions";
          params.append("type", "TRANSFER");
          break;
        default:
          return;
      }
      
      const response = await fetch(`https://suddocs.uz/${endpoint}?${params.toString()}`, { headers });
      if (response.ok) {
        const data = await response.json();
        const transactions = data.transactions || data || [];
        setReportRows(Array.isArray(transactions) ? transactions : []);
      } else {
        setReportRows([]);
      }
    } catch (error) {
      console.error("Error fetching report data:", error);
      setReportRows([]);
    } finally {
      setReportLoadingModal(false);
    }
  };

  // Refresh dashboard when report date changes
  useEffect(() => {
    // This will trigger a re-fetch when report date changes
  }, [reportDate.startDate, reportDate.endDate]);

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



  return (
    <div className="p-6 bg-gray-50 min-h-screen">
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
                      {formatAmount(
                        Number(cashierReport.cashTotal || 0) +                    // Cash sales
                        Number(cashierReport.upfrontCash || 0) +                  // Upfront payments in cash
                        (cashierReport.repayments || [])                          // Credit repayments in cash
                          .filter(r => (r.channel || "CASH").toUpperCase() === "CASH")
                          .reduce((s, r) => s + Number(r.amount || 0), 0) +
                        Math.max(0, defectivePlus) - Math.max(0, defectiveMinus)   // Defective log adjustments (returns subtract from cash)
                      )}
                    </div>
                    <div className="mt-2 text-xs text-gray-500">
                      <div>💵 Нақд сотувлар: {formatAmount(cashierReport.cashTotal || 0)}</div>
                      <div>💰 Олдиндан тўловлар: {formatAmount(cashierReport.upfrontCash || 0)}</div>
                      <div>💳 Кредит тўловлар: {formatAmount(
                        (cashierReport.repayments || [])
                          .filter(r => (r.channel || "CASH").toUpperCase() === "CASH")
                          .reduce((s, r) => s + Number(r.amount || 0), 0)
                      )}</div>
                      <div>📊 Қайтариш тўловлар: {formatAmount(Math.max(0, defectivePlus) - Math.max(0, defectiveMinus))}</div>
                    </div>
                  </div>
                  <div className="p-3 rounded border">
                    <div className="text-sm text-gray-500">Карта</div>
                    <div className="font-semibold">
                      {formatAmount(
                        Number(cashierReport.cardTotal || 0) +                    // Card sales
                        Number(cashierReport.upfrontCard || 0) +                  // Upfront payments in card
                        (cashierReport.repayments || [])                          // Credit repayments in card
                          .filter(r => (r.channel || "CARD").toUpperCase() === "CARD")
                          .reduce((s, r) => s + Number(r.amount || 0), 0)
                      )}
                    </div>
                    <div className="mt-2 text-xs text-gray-500">
                      <div>💳 Карта сотувлар: {formatAmount(cashierReport.cardTotal || 0)}</div>
                      <div>💰 Олдиндан тўловлар: {formatAmount(cashierReport.upfrontCard || 0)}</div>
                      <div>💳 Кредит тўловлар: {formatAmount(
                        (cashierReport.repayments || [])
                          .filter(r => (r.channel || "CARD").toUpperCase() === "CARD")
                          .reduce((s, r) => s + Number(r.amount || 0), 0)
                      )}</div>
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
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <div className="text-xs">Нақд</div>
                        <div className="font-semibold">
                          {formatAmount(cashierReport.upfrontCash || 0)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs">Карта</div>
                        <div className="font-semibold">
                          {formatAmount(cashierReport.upfrontCard || 0)}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="p-3 rounded border bg-purple-50">
                    <div className="text-sm">Кредитдан тўланган</div>
                    <div className="text-xl font-bold">
                      {formatAmount(cashierReport.repaymentTotal || 0)}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <div className="text-xs">Нақд</div>
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
                        <div className="text-xs">Карта</div>
                        <div className="font-semibold">
                          {formatAmount(
                            (cashierReport.repayments || [])
                              .filter(
                                (r) =>
                                  (r.channel || "CARD").toUpperCase() === "CARD"
                              )
                              .reduce((s, r) => s + Number(r.amount || 0), 0)
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-gray-600">
                      💡 Нақд тўловлар "Топширадиган пул" га қўшилади
                    </div>
                    <div className="mt-1 text-xs text-blue-600">
                      📊 Кунлик + Ойлик тўловлар
                    </div>
                  </div>

                  <div className="p-3 rounded border">
                    <div className="text-sm text-gray-500">
                      Топширадиган пул
                    </div>
                    <div className="font-semibold">
                      {formatAmount(
                        Number(cashierReport.cashTotal || 0) +                    // Cash sales
                        (cashierReport.repayments || [])                       // Credit repayments in cash (both monthly and daily)
                          .filter(
                            (r) =>
                              (r.channel || "CASH").toUpperCase() === "CASH"
                          )
                          .reduce((s, r) => s + Number(r.amount || 0), 0) +
                        Number(cashierReport.upfrontCash || 0) +               // Upfront payments in CASH only
                        Math.max(0, defectivePlus) - Math.max(0, defectiveMinus) // Defective log adjustments (returns reduce cash to hand over)
                      )}
                    </div>
                    <div className="mt-2 text-xs text-gray-500">
                      <div>💡 Нақд сотувлар + Кредит тўловлар (нақд) + Олдиндан тўловлар (нақд) + Қайтариш тўловлар</div>
                      <div className="mt-1 text-blue-600">⚠️ Карта тўловлар топширадиган пулга қўшилмайди</div>
                      <div className="mt-1 text-green-600">✅ Кунлик + Ойлик тўловлар (нақд) қўшилади</div>
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
                              <th className="px-3 py-2 text-left">
                                Қабул қилган
                              </th>
                              <th className="px-3 py-2 text-left">Сотган</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {cashierReport.repayments.map((r, idx) => (
                              <tr key={`cashier-repayment-${r.scheduleId || r.transactionId || r.paidAt || idx}-${idx}`} className="hover:bg-gray-50">
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
                                <td className="px-3 py-2">
                                  {r.paidBy
                                    ? `${r.paidBy.firstName || ""} ${r.paidBy.lastName || ""
                                      }`.trim()
                                    : "-"}
                                </td>
                                <td className="px-3 py-2">
                                  {r.soldBy
                                    ? `${r.soldBy.firstName || ""} ${r.soldBy.lastName || ""
                                      }`.trim()
                                    : "-"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                <div className="overflow-x-auto">
                  <div className="text-xs text-gray-600 mb-2 p-2 bg-gray-50 rounded">
                    📊 Транзакциялар рўйхати: "Олдиндан тўлов" майдонида Кредит/Бўлиб тўлаш учун олдиндан тўланган сумма кўрсатилади
                  </div>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left">ID</th>
                        <th className="px-3 py-2 text-left">Сана</th>
                        <th className="px-3 py-2 text-left">Тўлов тури</th>
                        <th className="px-3 py-2 text-left">Сотган</th>
                        <th className="px-3 py-2 text-left">
                          <div className="flex items-center gap-1">
                            <span>Олдиндан тўлов</span>
                            <div className="text-xs text-gray-400" title="Кредит/Бўлиб тўлаш учун олдиндан тўланган сумма">
                              ℹ️
                            </div>
                          </div>
                        </th>
                        <th className="px-3 py-2 text-left">Якуний</th>
                        <th className="px-3 py-2 text-left">Олдиндан тури</th>
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
                            {t.soldByName || "-"}
                          </td>
                          <td className="px-3 py-2">
                            {formatAmount(
                              ['CREDIT', 'INSTALLMENT'].includes(t.paymentType)
                                ? Number(t.amountPaid || 0)  // For CREDIT/INSTALLMENT: show only amountPaid (avoid double-counting)
                                : Number(t.amountPaid || 0) + Number(t.downPayment || 0)  // For other types: show sum
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {formatAmount(t.finalTotal)}
                          </td>
                          <td className="px-3 py-2">
                            {['CREDIT', 'INSTALLMENT'].includes(t.paymentType) ?
                              (t.upfrontPaymentType === 'CASH' ? 'Нақд' :
                                t.upfrontPaymentType === 'CARD' ? 'Карта' : 'Номаълум') :
                              '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50">
                      <tr>
                        <td colSpan={4} className="px-3 py-2 font-semibold text-right">
                          Жами олдиндан тўловлар:
                        </td>
                        <td className="px-3 py-2 font-semibold">
                          {formatAmount(
                            (cashierReport.transactions || [])
                              .filter(t => ['CREDIT', 'INSTALLMENT'].includes(t.paymentType))
                              .reduce((sum, t) => sum + Number(t.amountPaid || 0), 0)
                          )}
                        </td>
                        <td colSpan={2}></td>
                      </tr>
                      <tr>
                        <td colSpan={4} className="px-3 py-2 font-semibold text-right">
                          Жами тўланган (олдиндан + кредит):
                        </td>
                        <td className="px-3 py-2 font-semibold">
                          {formatAmount(
                            (cashierReport.transactions || [])
                              .filter(t => ['CREDIT', 'INSTALLMENT'].includes(t.paymentType))
                              .reduce((sum, t) => sum + Number(t.amountPaid || 0), 0) +
                            (cashierReport.repaymentTotal || 0)
                          )}
                        </td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            )}
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 mt-6">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">
                Филиаллар бўйича кирим-чиқим
              </h3>
              <div className="text-sm text-gray-600 mt-1">
                Транзакциялар орқали кирим-чиқим маълумотлари
              </div>
            </div>

            <div className="p-6">

              {statsLoading ? (
                <div className="text-center py-8">
                  <div className="text-gray-500">Статистика юкланмоқда...</div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Income Section */}
                  <div className="bg-green-50 rounded-lg p-4 border border-green-200 cursor-pointer hover:bg-green-100" onClick={() => openReportModal('sale')}>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-lg font-semibold text-green-800">Кирим</h4>
                      <div className="p-2 bg-green-100 rounded-lg">
                        <ShoppingCart className="text-green-600" size={20} />
                      </div>
                    </div>

                  </div>

                  {/* Expenses Section */}
                  <div className="bg-red-50 rounded-lg p-4 border border-red-200 cursor-pointer hover:bg-red-100" onClick={() => openReportModal('purchase')}>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-lg font-semibold text-red-800">Чиқим</h4>
                      <div className="p-2 bg-red-100 rounded-lg">
                        <Package className="text-red-600" size={20} />
                      </div>
                    </div>

                  </div>

                  {/* Transfers Section */}
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200 cursor-pointer hover:bg-blue-100" onClick={() => openReportModal('transfer')}>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-lg font-semibold text-blue-800">Ўтказмалар</h4>
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Building2 className="text-blue-600" size={20} />
                      </div>
                    </div>

                  </div>
                </div>
              )}

              {openReport && (
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-semibold text-gray-700">
                      {openReport === 'purchase' ? 'Кирим (PURCHASE) ҳисоботи' : openReport === 'sale' ? 'Чиқим (Сотувлар) ҳисоботи' : 'Ўтказмалар ҳисоботи'}
                    </div>
                    <div />
                  </div>
                  <div className="overflow-x-auto">
                    {reportLoadingModal ? (
                      <div className="text-gray-500">Юкланмоқда...</div>
                    ) : reportRows.length === 0 ? (
                      <div className="text-gray-500">Маълумот йўқ</div>
                    ) : (
                      <table className="w-full text-sm border border-gray-200 rounded-lg">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left">ID</th>
                            <th className="px-3 py-2 text-left">Сана</th>
                            {openReport === 'sale' ? (
                              <th className="px-3 py-2 text-left">Мижоз</th>
                            ) : null}
                            {openReport === 'purchase' ? (
                              <th className="px-3 py-2 text-left">Филиал</th>
                            ) : null}
                            {openReport === 'transfer' ? (
                              <>
                                <th className="px-3 py-2 text-left">Чиқарувчи филиал</th>
                                <th className="px-3 py-2 text-left">Қабул қилувчи филиал</th>
                              </>
                            ) : null}
                            <th className="px-3 py-2 text-left">Маҳсулотлар</th>
                            <th className="px-3 py-2 text-left">Миқдор</th>
                            <th className="px-3 py-2 text-left">Жами</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {reportRows.map((t) => (
                            <tr key={t.id} className="hover:bg-gray-50">
                              <td className="px-3 py-2">#{t.id}</td>
                              <td className="px-3 py-2">{formatDate(t.createdAt)}</td>
                              {openReport === 'sale' && (
                                <td className="px-3 py-2">{t.customer?.fullName || '-'}</td>
                              )}
                              {openReport === 'purchase' && (
                                <td className="px-3 py-2">{t.fromBranch?.name || '-'}</td>
                              )}
                              {openReport === 'transfer' && (
                                <>
                                  <td className="px-3 py-2">{t.fromBranch?.name || '-'}</td>
                                  <td className="px-3 py-2">{t.toBranch?.name || '-'}</td>
                                </>
                              )}
                              <td className="px-3 py-2">
                                {(t.items || []).map((it, idx) => (
                                  <div key={idx} className="text-xs text-gray-700">
                                    {(it.product?.name || it.name || '-')}
                                    {it.quantity != null ? ` × ${it.quantity}` : ''}
                                  </div>
                                ))}
                              </td>
                              {(() => {
                                const qty = (Array.isArray(t?.items) ? t.items : []).reduce((s, it) => s + (Number(it?.quantity) || 0), 0);
                                const sign = openReport === 'sale' ? '-' : '+';
                                const color = openReport === 'sale' ? 'text-red-600' : (openReport === 'purchase' ? 'text-green-700' : 'text-blue-700');
                                return (
                                  <td className={`px-3 py-2 font-semibold ${color}`}>
                                    {sign}{qty}
                                  </td>
                                );
                              })()}
                              <td className="px-3 py-2">{formatAmount(t.finalTotal || t.total || 0)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

      )}
    </div>
  );
};

export default Dashboard;
