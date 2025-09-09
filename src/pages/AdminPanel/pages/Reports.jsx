import React, { useState, useEffect, useCallback } from "react";
import { Eye, RefreshCw, User as UserIcon, X as XIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { formatAmount, formatCurrency } from '../../../utils/currencyFormat';

const computeHandover = (summary) => {
  if (!summary) return 0;
  const cashTotal = Number(summary.cashTotal || 0);
  const upfrontTotal = Number(summary.upfrontTotal || 0);
  const defectivePlus = Number(summary.defectivePlus || 0);
  const defectiveMinus = Number(summary.defectiveMinus || 0);
  const repaymentsCash = Array.isArray(summary.repayments)
    ? summary.repayments
        .filter(r => (r.channel || 'CASH').toUpperCase() === 'CASH')
        .reduce((s, r) => s + Number(r.amount || 0), 0)
    : 0;
  return cashTotal + repaymentsCash + upfrontTotal + (defectivePlus - defectiveMinus);
};

const TransactionReport = ({ selectedBranchId: propSelectedBranchId }) => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [filters, setFilters] = useState(() => {
    const todayStr = new Date().toLocaleDateString("en-CA");
    return { startDate: todayStr, endDate: todayStr };
  });
  const [productSales, setProductSales] = useState([]);
  const [dailySales, setDailySales] = useState([]);
  const [salesTotals, setSalesTotals] = useState({
    totalQuantity: 0,
    totalAmount: 0,
  });
  const [cashierSummaries, setCashierSummaries] = useState([]);
  const [warehouseSummaries, setWarehouseSummaries] = useState([]);
  const [overallRepaymentTotal, setOverallRepaymentTotal] = useState(0);
  const [overallRepaymentCash, setOverallRepaymentCash] = useState(0);
  const [overallRepaymentCard, setOverallRepaymentCard] = useState(0);
  const [defectivePlus, setDefectivePlus] = useState(0);
  const [defectiveMinus, setDefectiveMinus] = useState(0);
  const [showCashierModal, setShowCashierModal] = useState(false);
  const [selectedCashier, setSelectedCashier] = useState(null);
  const [showWarehouseModal, setShowWarehouseModal] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);
  const [peopleView, setPeopleView] = useState("CASHIERS");
  const [selectedTransactionItems, setSelectedTransactionItems] =
    useState(null);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedBranchId, setSelectedBranchId] = useState(
    propSelectedBranchId || localStorage.getItem("selectedBranchId") || ""
  );
  const [allUsers, setAllUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userReport, setUserReport] = useState(null);
  const [userReportLoading, setUserReportLoading] = useState(false);
  const [handoverByUserId, setHandoverByUserId] = useState({});
  const navigate = useNavigate();

  const BASE_URL = "https://suddocs.uz";

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const token = localStorage.getItem("access_token");
      if (!token) {
        console.error("No access token found in localStorage");
        navigate("/login");
        throw new Error("Авторизация токени топилмади");
      }

      console.log("Fetching users from:", `${BASE_URL}/users`);

      const response = await fetch(`${BASE_URL}/users`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      console.log("Users API response status:", response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || `Server error: ${response.status}`;
        console.error("Fetch users error:", errorMessage, errorData);
        if (response.status === 401) {
          localStorage.removeItem("access_token");
          navigate("/login");
          toast.error("Сессия тугади. Илтимос, қайта киринг.");
        } else if (response.status === 404) {
          console.warn("Users endpoint not found, using empty array");
          setAllUsers([]);
          return;
        } else {
          toast.error(`API хатолик: ${errorMessage}`);
        }
        throw new Error(errorMessage);
      }

      const usersData = await response.json();
      console.log("Fetched users:", usersData);

      const usersArray = Array.isArray(usersData) ? usersData : [];
      console.log("Users by role:", {
        CASHIER: usersArray.filter(u => u.role === 'CASHIER'),
        WAREHOUSE: usersArray.filter(u => u.role === 'WAREHOUSE'),
        OTHER: usersArray.filter(u => u.role !== 'CASHIER' && u.role !== 'WAREHOUSE')
      });

      setAllUsers(usersArray);
    } catch (error) {
      console.error("Error fetching users:", error.message);
      
      if (error.message.includes('fetch') || error.message.includes('Network')) {
        console.warn("Network error fetching users, using empty array");
        setAllUsers([]);
      } else {
        toast.error(error.message || "Фойдаланувчиларни олишда хатолик юз берди");
        setAllUsers([]);
      }
    } finally {
      setUsersLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === "selectedBranchId") {
        setSelectedBranchId(e.newValue || "");
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (propSelectedBranchId !== undefined) {
      setSelectedBranchId(propSelectedBranchId);
    }
  }, [propSelectedBranchId]);

  useEffect(() => {
    if (selectedBranchId !== undefined) {
      fetchTransactions();
    }
  }, [selectedBranchId, filters.startDate, filters.endDate]);

  useEffect(() => {
    try {
      fetchUsers();
    } catch (error) {
      console.error("Error in fetchUsers useEffect:", error);
      setAllUsers([]);
    }
  }, [fetchUsers]);

  useEffect(() => {
    return () => {
      setProductSales([]);
      setCashierSummaries([]);
      setWarehouseSummaries([]);
      setDailySales([]);
      setSalesTotals({ totalQuantity: 0, totalAmount: 0 });
      setDefectivePlus(0);
      setDefectiveMinus(0);
      setTransactions([]);
      setSelectedTransaction(null);
      setSelectedCashier(null);
      setSelectedWarehouse(null);
      setSelectedTransactionItems(null);
      setSelectedCustomer(null);
      setShowDetails(false);
      setShowCashierModal(false);
      setShowWarehouseModal(false);
      setShowCustomerModal(false);
    };
  }, [selectedBranchId]); // selectedBranchId o'zgarganda ham cleanup

  useEffect(() => {
    if (selectedBranchId !== undefined) {
      console.log('Branch changed, clearing state...');
      setProductSales([]);
      setCashierSummaries([]);
      setWarehouseSummaries([]);
      setDailySales([]);
      setSalesTotals({ totalQuantity: 0, totalAmount: 0 });
      setDefectivePlus(0);
      setDefectiveMinus(0);
      setTransactions([]);
      setSelectedTransaction(null);
      setSelectedCashier(null);
      setSelectedWarehouse(null);
      setSelectedTransactionItems(null);
      setSelectedCustomer(null);
      setShowDetails(false);
      setShowCashierModal(false);
      setShowWarehouseModal(false);
      setShowCustomerModal(false);
    }
  }, [selectedBranchId]);

  const transactionTypes = {
    SALE: { label: "Sotuv", color: "bg-green-100 text-green-800" },
    RETURN: { label: "Qaytarish", color: "bg-yellow-100 text-yellow-800" },
    TRANSFER: { label: "Otkazma", color: "bg-blue-100 text-blue-800" },
    WRITE_OFF: { label: "Yozib tashlash", color: "bg-red-100 text-red-800" },
    STOCK_ADJUSTMENT: {
      label: "Zaxira tuzatish",
      color: "bg-purple-100 text-purple-800",
    },
    PURCHASE: { label: "Kirim", color: "bg-indigo-100 text-indigo-800" },
  };

  const formatDate = (dateString) => {
    return dateString
      ? new Date(dateString).toLocaleDateString("uz-UZ", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
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

  const getCustomerName = (customer) => {
    if (!customer) return "Йўқ";
    return customer.fullName || "Йўқ";
  };

  const getUserName = (user) => {
    if (!user) return "Йўқ";
    return `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Йўқ";
  };

  // Fetch user-specific report data
  const fetchUserReport = useCallback(async (userId, userRole) => {
    setUserReportLoading(true);
    try {
      const token = localStorage.getItem("access_token");
      if (!token) {
        console.error("No access token found in localStorage");
        navigate("/login");
        throw new Error("Авторизация токени топилмади");
      }

      console.log("Fetching user report for:", { userId, userRole });

      const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };

      const params = new URLSearchParams();
      if (filters.startDate)
        params.append(
          "startDate",
          new Date(`${filters.startDate}T00:00:00`).toISOString()
        );
      if (filters.endDate)
        params.append(
          "endDate",
          new Date(`${filters.endDate}T23:59:59`).toISOString()
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

      const startBound = filters.startDate
        ? new Date(`${filters.startDate}T00:00:00`)
        : null;
      const endBound = filters.endDate
        ? new Date(`${filters.endDate}T23:59:59`)
        : null;

      const agg = {
        id: userId,
        name: getUserName(selectedUser),
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
        defectivePlus: 0,
        defectiveMinus: 0,
      };

      // Track schedule IDs to avoid double-counting
      const seenSchedules = new Set();

      for (const t of Array.isArray(transactions) ? transactions : []) {
        if (t.type === "SALE") {
          // Check if this user was involved in the sale
          const isUserInvolved =
            (t.soldBy?.id === userId || t.user?.id === userId) ||
            (userRole === 'WAREHOUSE' && (t.user?.role === 'WAREHOUSE' || t.soldBy?.role === 'WAREHOUSE'));

          if (isUserInvolved) {
            const final = Number(t.finalTotal || t.total || 0);
            const amountPaid = Number(t.amountPaid || 0);
            const downPayment = Number(t.downPayment || 0);
            const upfront = ['CREDIT', 'INSTALLMENT'].includes(t.paymentType) ? amountPaid : 0;

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
                const upfrontType = t.upfrontPaymentType || 'CASH';
                if (upfrontType === 'CASH') {
                  agg.upfrontCash += upfront;
                } else if (upfrontType === 'CARD') {
                  agg.upfrontCard += upfront;
                }
                break;
              case "INSTALLMENT":
                agg.installmentTotal += final;
                agg.upfrontTotal += upfront;
                const upfrontType2 = t.upfrontPaymentType || 'CASH';
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
              customer: t.customer || null,
              items: t.items || [],  // Added items here to fix the issue
            });
          }
        }

        // Process repayments
        if (Array.isArray(t.paymentSchedules)) {
          for (const s of t.paymentSchedules) {
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

            // Check if this user received the payment
            if (s.paidBy?.id === userId) {
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
            if (s.paidBy?.id === userId) {
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

      // Include daily repayments from backend into userReport totals and list
      try {
        const dailyRepaymentsRes = await fetch(
          `https://suddocs.uz/daily-repayments/cashier/${userId}?branchId=${selectedBranchId}&startDate=${new Date(`${filters.startDate}T00:00:00`).toISOString()}&endDate=${new Date(`${filters.endDate}T23:59:59`).toISOString()}`,
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
              soldBy: l.transaction?.soldBy || null,
            });
            console.log('User Report: Added daily repayment from backend:', {
              amount: l.amount,
              channel: ch,
              transactionId: l.transactionId
            });
          }
        }
      } catch (error) {
        console.warn('Failed to fetch daily repayments from backend:', error);
      }

      // Include credit repayments from backend into userReport totals and list
      try {
        const creditRepaymentsRes = await fetch(
          `https://suddocs.uz/credit-repayments/cashier/${userId}?branchId=${selectedBranchId}&startDate=${new Date(`${filters.startDate}T00:00:00`).toISOString()}&endDate=${new Date(`${filters.endDate}T23:59:59`).toISOString()}`,
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
            console.log('User Report: Added credit repayment from backend:', {
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

      // Fetch defective logs for this user (returns and adjustments)
      try {
        const params2 = new URLSearchParams();
        if (selectedBranchId) params2.append("branchId", selectedBranchId);
        const resDef = await fetch(`https://suddocs.uz/defective-logs?${params2.toString()}`, { headers });
        let plus = 0;
        let minus = 0;
        if (resDef.ok) {
          const logs = await resDef.json().catch(() => []);
          const list = Array.isArray(logs) ? logs : (Array.isArray(logs.items) ? logs.items : []);
          const startBound2 = filters.startDate ? new Date(`${filters.startDate}T00:00:00`) : null;
          const endBound2 = filters.endDate ? new Date(`${filters.endDate}T23:59:59`) : null;
          // Build transaction map by id for paymentType and repayment info
          const txById = new Map();
          for (const t of Array.isArray(transactions) ? transactions : []) {
            txById.set(t.id, t);
          }
          for (const log of list) {
            const createdAt = log.createdAt ? new Date(log.createdAt) : null;
            const inRange = createdAt && (!startBound2 || createdAt >= startBound2) && (!endBound2 || createdAt <= endBound2);
            if (!inRange) continue;
            const rawAmt = Number(log.cashAmount ?? log.amount ?? log.value ?? 0) || 0;
            if (rawAmt === 0) continue;
            const actorIdRaw = (log.createdBy && log.createdBy.id) ?? log.createdById ?? (log.user && log.user.id) ?? log.userId ?? (log.performedBy && log.performedBy.id) ?? log.performedById ?? null;
            const actorId = actorIdRaw != null ? Number(actorIdRaw) : null;
            if (!actorId || actorId !== userId) continue;
            if (rawAmt > 0) {
              plus += rawAmt;
            } else if (rawAmt < 0) {
              // Only reduce Naqd for: CASH returns; CREDIT/INSTALLMENT returns if fully paid; and generic cash-out adjustments
              const isReturn = String(log.actionType || '').toUpperCase() === 'RETURN';
              if (isReturn) {
                const tx = txById.get(log.transactionId);
                const retAmount = Math.abs(rawAmt);
                if (tx) {
                  const paymentType = String(tx.paymentType || '').toUpperCase();
                  // Determine if fully paid
                  const finalTotal = Number(tx.finalTotal || tx.total || 0);
                  const upfrontPaid = Number(tx.downPayment || tx.amountPaid || 0);
                  let schedulesPaid = 0;
                  if (Array.isArray(tx.paymentSchedules)) {
                    for (const s of tx.paymentSchedules) {
                      schedulesPaid += Number((s?.paidAmount ?? s?.payment) || 0);
                    }
                  }
                  const fullyPaid = (upfrontPaid + schedulesPaid) >= finalTotal && finalTotal > 0;
                  if (paymentType === 'CASH') {
                    minus += retAmount;
                  } else if (paymentType === 'CARD') {
                    // Do not touch Naqd
                  } else if (paymentType === 'CREDIT' || paymentType === 'INSTALLMENT') {
                    if (fullyPaid) minus += retAmount;
                  }
                }
              } else {
                // Non-return negative logs are generic cash adjustments
                minus += Math.abs(rawAmt);
              }
            }
          }
        }
        agg.defectivePlus = plus;
        agg.defectiveMinus = minus;
      } catch (err) {
        agg.defectivePlus = 0;
        agg.defectiveMinus = 0;
      }

      console.log("User report aggregation:", agg);
      setUserReport(agg);

    } catch (e) {
      console.error("User report error", e);
      setUserReport(null);
    } finally {
      setUserReportLoading(false);
    }
  }, [filters.startDate, filters.endDate, selectedBranchId, selectedUser, navigate]);

  // Manual refresh function - state ni to'liq tozalaydi
  // Bu function ni fetchTransactions dan keyin e'lon qilamiz

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    // Reset summaries to avoid showing stale data when backend has no results
    setProductSales([]);
    setCashierSummaries([]);
    setWarehouseSummaries([]); // Add this line to reset warehouse summaries
    setDailySales([]);
    setSalesTotals({ totalQuantity: 0, totalAmount: 0 });
    setDefectivePlus(0);
    setDefectiveMinus(0);
    try {
      const token = localStorage.getItem("access_token");
      if (!token) {
        console.error("No access token found in localStorage");
        navigate("/login");
        throw new Error("Авторизация токени топилмади");
      }

      const params = new URLSearchParams();
      if (filters.startDate) {
        const startIso = new Date(
          `${filters.startDate}T00:00:00`
        ).toISOString();
        params.append("startDate", startIso);
      }
      if (filters.endDate) {
        const endIso = new Date(`${filters.endDate}T23:59:59`).toISOString();
        params.append("endDate", endIso);
      }
      if (selectedBranchId) params.append("branchId", selectedBranchId);
      params.append("limit", "all"); // Fetch all transactions

      const response = await fetch(
        `${BASE_URL}/transactions?${params.toString()}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || "Server error";
        console.error("Fetch error:", errorMessage);
        if (response.status === 401) {
          localStorage.removeItem("access_token");
          navigate("/login");
          toast.error("Сессия тугади. Илтимос, қайта киринг.");
        } else {
          toast.error(errorMessage);
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log("Raw transaction data:", data);

      const transactions = data.transactions || data || [];
      console.log("Extracted transactions:", transactions);

      setTransactions(transactions);

      const productMap = new Map();
      const dailyMap = new Map();
      let totalQuantity = 0;
      let totalAmount = 0;
      const cashierMap = new Map();
      const warehouseMap = new Map();
      const aggregateInMainLoop = false;

      const processedUserIds = new Set();
      const processedWarehouseUsers = new Set();
      const processedCashierUsers = new Set();
      console.log('Clearing previous data and starting fresh processing...');

      if (Array.isArray(transactions)) {
        console.log(`Processing ${transactions.length} transactions...`);

        transactions.forEach((transaction, index) => {
          console.log(`Processing transaction ${index}:`, transaction);

          // Warehouse user processing - faqat WAREHOUSE role ga ega bo'lganlar
          const warehouseUser =
            transaction.user?.role === "WAREHOUSE"
              ? transaction.user
              : transaction.soldBy?.role === "WAREHOUSE"
                ? transaction.soldBy
                : null;

          if (warehouseUser) {
            const wid = String(warehouseUser.id);

            // Agar bu user allaqachon cashier sifatida qayta ishlangan bo'lsa, uni o'tkazib yubor
            if (processedCashierUsers.has(wid)) {
              console.log(`Skipping warehouse user ${wid} - already processed as cashier`);
            } else if (processedWarehouseUsers.has(wid)) {
              console.log(`Skipping warehouse user ${wid} - already processed as warehouse`);
            } else {
              // User ni warehouse sifatida belgilash
              processedWarehouseUsers.add(wid);
              processedUserIds.add(`warehouse_${wid}`);

              if (!warehouseMap.has(wid)) {
                warehouseMap.set(wid, {
                  id: wid,
                  name:
                    `${warehouseUser.firstName || ""} ${warehouseUser.lastName || ""
                      }`.trim() ||
                    warehouseUser.username ||
                    `#${wid}`,
                  purchaseTotal: 0,
                  adjustmentTotal: 0,
                  transferTotal: 0,
                  transferCount: 0,
                  saleTotal: 0,
                  cashTotal: 0,
                  cardTotal: 0,
                  creditTotal: 0,
                  installmentTotal: 0,
                  upfrontTotal: 0,
                  upfrontCash: 0,
                  upfrontCard: 0,
                  repaymentTotal: 0,
                  repayments: [],
                  soldQuantity: 0,
                  soldAmount: 0,
                  otherTotal: 0,
                  total: 0,
                  transactions: [],
                });
              }
              const wagg = warehouseMap.get(wid);
              const finalW = Number(
                transaction.finalTotal || transaction.total || 0
              );
              const amountPaidW = Number(transaction.amountPaid || 0);
              const downPaymentW = Number(transaction.downPayment || 0);
              // For CREDIT/INSTALLMENT, upfront payment is stored in downPayment
              const upfrontW = ['CREDIT', 'INSTALLMENT'].includes(transaction.paymentType) ? downPaymentW : 0;
              if (wagg.defectivePlus === undefined) wagg.defectivePlus = 0;
              if (wagg.defectiveMinus === undefined) wagg.defectiveMinus = 0;

              switch (transaction.type) {
                case "PURCHASE":
                  wagg.purchaseTotal += finalW;
                  break;
                case "STOCK_ADJUSTMENT":
                  wagg.adjustmentTotal += finalW;
                  break;
                case "TRANSFER":
                  wagg.transferTotal += finalW;
                  wagg.transferCount += 1;
                  break;
                case "SALE":
                  wagg.saleTotal += finalW;
                  switch (transaction.paymentType) {
                    case "CASH":
                      wagg.cashTotal += finalW;
                      break;
                    case "CARD":
                      wagg.cardTotal += finalW;
                      break;
                    case "CREDIT":
                      wagg.creditTotal += finalW;
                      wagg.upfrontTotal += upfrontW;
                      const upfrontType1 = transaction.upfrontPaymentType || 'CASH';
                      if (upfrontType1 === 'CASH') {
                        wagg.upfrontCash += upfrontW;
                      } else if (upfrontType1 === 'CARD') {
                        wagg.upfrontCard += upfrontW;
                      }
                      break;
                    case "INSTALLMENT":
                      wagg.installmentTotal += finalW;
                      wagg.upfrontTotal += upfrontW;
                      const upfrontType2 = transaction.upfrontPaymentType || 'CASH';
                      if (upfrontType2 === 'CASH') {
                        wagg.upfrontCash += upfrontW;
                      } else if (upfrontType2 === 'CARD') {
                        wagg.upfrontCard += upfrontW;
                      }
                      break;
                    default:
                      break;
                  }
                  if (Array.isArray(transaction.items)) {
                    for (const it of transaction.items) {
                      const nameRaw = it.product?.name || it.name || "";
                      const qty = Number(it.quantity) || 0;
                      const amount =
                        it.total != null
                          ? Number(it.total) || 0
                          : (Number(it.price) || 0) * qty;
                      if (!nameRaw || qty <= 0 || amount <= 0) continue;
                      wagg.soldQuantity += qty;
                      wagg.soldAmount += amount;
                    }
                  }
                  break;
                case "RETURN": {
                  // Returns should reduce original category. If original was CREDIT/INSTALLMENT and not fully paid, reduce that bucket.
                  const retAmount = -Math.abs(finalW);
                  const totalDue = Number(transaction.finalTotal || transaction.total || 0);
                  const totalPaid = Number(transaction.amountPaid || 0) + Number(transaction.downPayment || 0);
                  const fullyPaid = totalPaid >= Math.max(0, totalDue);
                  switch (transaction.paymentType) {
                    case 'CREDIT':
                      if (fullyPaid) {
                        wagg.cashTotal += retAmount;
                      } else {
                        wagg.creditTotal += retAmount;
                      }
                      break;
                    case 'INSTALLMENT':
                      if (fullyPaid) {
                        wagg.cashTotal += retAmount;
                      } else {
                        wagg.installmentTotal += retAmount;
                      }
                      break;
                    case 'CASH':
                      wagg.cashTotal += retAmount;
                      break;
                    case 'CARD':
                      wagg.cardTotal += retAmount;
                      break;
                    default:
                      break;
                  }
                  break;
                }
                default:
                  wagg.otherTotal += finalW;
                  break;
              }
              wagg.total += finalW;
              wagg.transactions.push({
                id: transaction.id,
                createdAt: transaction.createdAt,
                type: transaction.type,
                finalTotal: finalW,
                soldByName:
                  getUserName(transaction.soldBy) ||
                  getUserName(transaction.user) ||
                  "-",
                fromBranchName:
                  transaction.fromBranch?.name ||
                  transaction.fromBranchName ||
                  transaction.fromBranchId ||
                  transaction.branchFromId,
                toBranchName:
                  transaction.toBranch?.name ||
                  transaction.toBranchName ||
                  transaction.toBranchId ||
                  transaction.branchToId,
              });
            }
          }

          // Aggregate repayments for WAREHOUSE collectors regardless of who sold/created the transaction
          if (aggregateInMainLoop && Array.isArray(transaction.paymentSchedules)) {
            const startBound = filters.startDate
              ? new Date(`${filters.startDate}T00:00:00`)
              : null;
            const endBound = filters.endDate
              ? new Date(`${filters.endDate}T23:59:59`)
              : null;
            for (const s of transaction.paymentSchedules) {
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
              const paidByObj = s.paidBy && typeof s.paidBy === "object" ? s.paidBy : null;
              const recipientRole = String(paidByObj && paidByObj.role ? paidByObj.role : (s.paidByRole || "WAREHOUSE")).toUpperCase();
              const recipientId = paidByObj && paidByObj.id != null
                ? paidByObj.id
                : (s.paidById != null
                  ? s.paidById
                  : (s.paidByUserId != null
                    ? s.paidByUserId
                    : (s.paidBy != null
                      ? s.paidBy
                      : s.collectorId)));
              if (!recipientId || recipientRole !== "WAREHOUSE") continue;
              if (!warehouseMap.has(recipientId)) {
                warehouseMap.set(recipientId, {
                  id: recipientId,
                  name:
                    `${paidByObj?.firstName || ""} ${paidByObj?.lastName || ""
                      }`.trim() ||
                    paidByObj?.username ||
                    `#${recipientId}`,
                  purchaseTotal: 0,
                  adjustmentTotal: 0,
                  transferTotal: 0,
                  transferCount: 0,
                  saleTotal: 0,
                  cashTotal: 0,
                  cardTotal: 0,
                  creditTotal: 0,
                  installmentTotal: 0,
                  upfrontTotal: 0,
                  repaymentTotal: 0,
                  repayments: [],
                  soldQuantity: 0,
                  soldAmount: 0,
                  otherTotal: 0,
                  total: 0,
                  transactions: [],
                });
              }
              const recipAgg = warehouseMap.get(recipientId);
              recipAgg.repaymentTotal += installment;
              recipAgg.repayments.push({
                scheduleId: s.id,
                paidAt: s.paidAt,
                amount: installment,
                channel: s.paidChannel || null,
                transactionId: transaction.id,
                month: s.month,
                customer: transaction.customer || null,
                paymentType: transaction.paymentType,
                paidBy: paidByObj || (recipientId ? { id: recipientId } : null),
                soldBy: transaction.soldBy || null,
              });
            }
          }

          // Aggregate repayments for CASHIER collectors regardless of who sold/created the transaction
          if (aggregateInMainLoop && Array.isArray(transaction.paymentSchedules)) {
            const startBound = filters.startDate
              ? new Date(`${filters.startDate}T00:00:00`)
              : null;
            const endBound = filters.endDate
              ? new Date(`${filters.endDate}T23:59:59`)
              : null;
            for (const s of transaction.paymentSchedules) {
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
              const ownerObj = s.paidBy && typeof s.paidBy === "object" ? s.paidBy : null;
              const ownerRole = String(ownerObj && ownerObj.role ? ownerObj.role : (s.paidByRole || "CASHIER")).toUpperCase();
              const ownerId = ownerObj && ownerObj.id != null
                ? ownerObj.id
                : (s.paidById != null
                  ? s.paidById
                  : (s.paidByUserId != null
                    ? s.paidByUserId
                    : (s.paidBy != null
                      ? s.paidBy
                      : s.collectorId)));
              if (!ownerId || ownerRole !== "CASHIER") continue;
              const ownerKey = String(ownerId);
              if (!cashierMap.has(ownerKey)) {
                cashierMap.set(ownerKey, {
                  id: ownerKey,
                  name:
                    `${ownerObj?.firstName || ""} ${ownerObj?.lastName || ""
                      }`.trim() ||
                    ownerObj?.username ||
                    `#${ownerKey}`,
                  cashTotal: 0,
                  cardTotal: 0,
                  creditTotal: 0,
                  installmentTotal: 0,
                  upfrontTotal: 0,
                  soldQuantity: 0,
                  soldAmount: 0,
                  creditMonths: [],
                  creditPercents: [],
                  repaymentTotal: 0,
                  repayments: [],
                  transactions: [],
                });
              }
              const ownerAgg = cashierMap.get(ownerKey);
              ownerAgg.repaymentTotal += installment;
              ownerAgg.repayments.push({
                scheduleId: s.id,
                paidAt: s.paidAt,
                amount: installment,
                channel: s.paidChannel || null,
                transactionId: transaction.id,
                month: s.month,
                customer: transaction.customer || null,
                paymentType: transaction.paymentType,
                paidBy: ownerObj || (ownerKey ? { id: ownerKey } : null),
                soldBy: transaction.soldBy || null,
              });
            }
          }

          // faqat sotuvlar (sales-only section for product and cashier summaries)
          if (transaction.type !== "SALE") {
            const date = transaction.createdAt
              ? new Date(transaction.createdAt).toDateString()
              : "Unknown";
            if (!dailyMap.has(date)) {
              dailyMap.set(date, { date, amount: 0, count: 0 });
            }
            // Continue to next transaction instead of returning
          } else {
            // Process SALE transactions

            if (transaction.items && Array.isArray(transaction.items)) {
              transaction.items.forEach((item, pIndex) => {
                console.log(`Processing item ${pIndex}:`, item);
                const productId = item.productId || item.id;
                const productNameRaw = item.product?.name || item.name || "";
                const itemQty = Number(item.quantity) || 0;
                const itemAmount =
                  item.total != null
                    ? Number(item.total) || 0
                    : (Number(item.price) || 0) * itemQty;
                // Skip invalid or unnamed items to avoid fake rows
                if (!productNameRaw || itemQty <= 0 || itemAmount <= 0) {
                  return;
                }
                const productName = productNameRaw;

                if (productMap.has(productId)) {
                  productMap.get(productId).quantity += itemQty;
                  productMap.get(productId).amount += itemAmount;
                } else {
                  productMap.set(productId, {
                    id: productId,
                    name: productName,
                    quantity: itemQty,
                    amount: itemAmount,
                  });
                }

                totalQuantity += itemQty;
                totalAmount += itemAmount;
              });
            } else {
              console.log(
                `Transaction ${index} has no items or items is not an array:`,
                transaction.items
              );
            }

            // Daily sales
            const date = transaction.createdAt
              ? new Date(transaction.createdAt).toDateString()
              : "Unknown";
            if (dailyMap.has(date)) {
              dailyMap.get(date).amount +=
                transaction.finalTotal || transaction.total || 0;
              dailyMap.get(date).count += 1;
            } else {
              dailyMap.set(date, {
                date,
                amount: transaction.finalTotal || transaction.total || 0,
                count: 1,
              });
            }

            // Cashier summaries (faqat SALE transaction lar uchun)
            if (transaction.type === "SALE") {
              const cashierUser =
                transaction.soldBy?.role === "CASHIER"
                  ? transaction.soldBy
                  : transaction.user?.role === "CASHIER"
                    ? transaction.user
                    : null;

              if (cashierUser) {
                const cashierId = String(cashierUser.id);

                // Agar bu user allaqachon warehouse sifatida qayta ishlangan bo'lsa, uni o'tkazib yubor
                if (processedWarehouseUsers.has(cashierId)) {
                  console.log(`Skipping cashier user ${cashierId} - already processed as warehouse`);
                } else if (processedCashierUsers.has(cashierId)) {
                  console.log(`Skipping cashier user ${cashierId} - already processed as cashier`);
                } else {

                  // User ni cashier sifatida belgilash
                  processedCashierUsers.add(cashierId);
                  processedUserIds.add(`cashier_${cashierId}`);

                  if (!cashierMap.has(cashierId)) {
                    cashierMap.set(cashierId, {
                      id: cashierId,
                      name:
                        `${cashierUser.firstName || ""} ${cashierUser.lastName || ""
                          }`.trim() ||
                        cashierUser.username ||
                        `#${cashierId}`,
                      cashTotal: 0,
                      cardTotal: 0,
                      creditTotal: 0,
                      installmentTotal: 0,
                      upfrontTotal: 0,
                      upfrontCash: 0,
                      upfrontCard: 0,
                      soldQuantity: 0,
                      soldAmount: 0,
                      creditMonths: [],
                      creditPercents: [],
                      repaymentTotal: 0,
                      repayments: [],
                      transactions: [],
                    });
                  }
                  const agg = cashierMap.get(cashierId);
                  const final = Number(
                    transaction.finalTotal || transaction.total || 0
                  );
                  const amountPaid = Number(transaction.amountPaid || 0);
                  const downPayment = Number(transaction.downPayment || 0);
                  // For CREDIT/INSTALLMENT, upfront payment is stored in downPayment
                  // For other payment types, upfront is 0
                  // NOTE: downPayment contains ONLY the upfront payment, not credit repayments
                  // Credit repayments are tracked separately in paymentSchedules
                  const upfront = ['CREDIT', 'INSTALLMENT'].includes(transaction.paymentType) ? downPayment : 0;
                  // Payment type distribution
                  switch (transaction.paymentType) {
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
                      const upfrontType = transaction.upfrontPaymentType || 'CASH';
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
                      const upfrontType2 = transaction.upfrontPaymentType || 'CASH';
                      if (upfrontType2 === 'CASH') {
                        agg.upfrontCash += upfront;
                      } else if (upfrontType2 === 'CARD') {
                        agg.upfrontCard += upfront;
                      }
                      break;
                    default:
                      break;
                  }
                  // Handle returns: subtract from the correct bucket and date
                  if (transaction.type === 'RETURN') {
                    const retAmount = -Math.abs(final);
                    const totalDue = Number(transaction.finalTotal || transaction.total || 0);
                    const totalPaid = Number(transaction.amountPaid || 0) + Number(transaction.downPayment || 0);
                    const fullyPaid = totalPaid >= Math.max(0, totalDue);
                    switch (transaction.paymentType) {
                      case 'CREDIT':
                        if (fullyPaid) agg.cashTotal += retAmount; else agg.creditTotal += retAmount;
                        break;
                      case 'INSTALLMENT':
                        if (fullyPaid) agg.cashTotal += retAmount; else agg.installmentTotal += retAmount;
                        break;
                      case 'CASH':
                        agg.cashTotal += retAmount;
                        break;
                      case 'CARD':
                        agg.cardTotal += retAmount;
                        break;
                      default:
                        break;
                    }
                  }
                  // Items
                  if (Array.isArray(transaction.items)) {
                    for (const it of transaction.items) {
                      const qty = Number(it.quantity) || 0;
                      const amount =
                        it.total != null
                          ? Number(it.total) || 0
                          : (Number(it.price) || 0) * qty;
                      agg.soldQuantity += qty;
                      agg.soldAmount += amount;
                      if (
                        transaction.paymentType === "CREDIT" ||
                        transaction.paymentType === "INSTALLMENT"
                      ) {
                        if (it.creditMonth)
                          agg.creditMonths.push(Number(it.creditMonth));
                        if (typeof it.creditPercent === "number")
                          agg.creditPercents.push(Number(it.creditPercent));
                      }
                    }
                  }

                  // Repayments for cashiers are handled globally above to avoid double counting

                  // Store transaction summary for modal details
                  agg.transactions.push({
                    id: transaction.id,
                    createdAt: transaction.createdAt,
                    paymentType: transaction.paymentType,
                    finalTotal: transaction.finalTotal || transaction.total || 0,
                    total: transaction.total || 0,
                    amountPaid: Number(transaction.amountPaid || 0),
                    downPayment: Number(transaction.downPayment || 0),
                    items: transaction.items || [],
                    customer: transaction.customer || null,
                    deliveryType: transaction.deliveryType,
                    deliveryAddress: transaction.deliveryAddress,
                    soldByName:
                      getUserName(transaction.soldBy) ||
                      getUserName(transaction.user) ||
                      "-",
                    repayments: Array.isArray(transaction.paymentSchedules)
                      ? transaction.paymentSchedules
                        .filter((s) => {
                          if (!s || !s.paidAt) return false;
                          const paidValue = Number((s.paidAmount ?? s.payment) || 0);
                          return s.isPaid || paidValue > 0;
                        })
                        .map((s) => ({
                          scheduleId: s.id,
                          paidAt: s.paidAt,
                          amount: Number((s.paidAmount ?? s.payment) || 0),
                          month: s.month,
                        }))
                      : [],
                  });
                }
              }
            }
          }
        });
      } else {
        console.log(
          "Transactions is not an array:",
          typeof transactions,
          transactions
        );
      }

      // Compute repayments by paid date within selected range (global totals and per-person)
      try {
        let repaymentSum = 0;
        let repaymentCash = 0;
        let repaymentCard = 0;
        const startBound = filters.startDate
          ? new Date(`${filters.startDate}T00:00:00`)
          : null;
        const endBound = filters.endDate
          ? new Date(`${filters.endDate}T23:59:59`)
          : null;

        const token = localStorage.getItem("access_token");
        const headers = {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        };
        const urlBase = new URL(`${BASE_URL}/transactions`);
        const paramsCommon = new URLSearchParams();
        if (selectedBranchId) paramsCommon.append("branchId", selectedBranchId);
        paramsCommon.append("limit", "all");

        const urls = [
          `${urlBase}?${new URLSearchParams({
            ...Object.fromEntries(paramsCommon),
            paymentType: "CREDIT",
          }).toString()}`,
          `${urlBase}?${new URLSearchParams({
            ...Object.fromEntries(paramsCommon),
            paymentType: "INSTALLMENT",
          }).toString()}`,
        ];

        const [creditRes, installmentRes] = await Promise.all([
          fetch(urls[0], { headers }),
          fetch(urls[1], { headers }),
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
          if (t.type !== "SALE") continue;
          if (
            selectedBranchId &&
            String(t.fromBranchId || t.branchId || "") !== String(selectedBranchId)
          )
            continue;
          const schedules = Array.isArray(t.paymentSchedules)
            ? t.paymentSchedules
            : [];
          for (const s of schedules) {
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

            // Global totals by paid date
            repaymentSum += installment;
            const ch = (s.paidChannel || "CASH").toUpperCase();
            if (ch === "CARD") repaymentCard += installment;
            else repaymentCash += installment;

            // Per-person aggregation by paid date
            const paidByObj = s.paidBy && typeof s.paidBy === "object" ? s.paidBy : null;
            const roleRaw = paidByObj && paidByObj.role ? paidByObj.role : (s.paidByRole || "CASHIER");
            const role = String(roleRaw).toUpperCase();
            const personIdRaw = paidByObj && paidByObj.id != null
              ? paidByObj.id
              : (s.paidById != null
                ? s.paidById
                : (s.paidByUserId != null
                  ? s.paidByUserId
                  : (s.paidBy != null
                    ? s.paidBy
                    : s.collectorId)));
            if (!personIdRaw) continue;
            const personId = String(personIdRaw);
            if (role === "WAREHOUSE") {
              // Don't skip if user already processed - allow multiple repayments from same user
              // processedUsers.add(personId); // Remove this line

              if (!warehouseMap.has(personId)) {
                warehouseMap.set(personId, {
                  id: personId,
                  name:
                    `${paidByObj?.firstName || ""} ${paidByObj?.lastName || ""}`.trim() ||
                    paidByObj?.username ||
                    `#${personId}`,
                  purchaseTotal: 0,
                  adjustmentTotal: 0,
                  transferTotal: 0,
                  transferCount: 0,
                  saleTotal: 0,
                  cashTotal: 0,
                  cardTotal: 0,
                  creditTotal: 0,
                  installmentTotal: 0,
                  upfrontTotal: 0,
                  repaymentTotal: 0,
                  repayments: [],
                  soldQuantity: 0,
                  soldAmount: 0,
                  otherTotal: 0,
                  total: 0,
                  transactions: [],
                });
              }
              const wag = warehouseMap.get(personId);
              wag.repaymentTotal += installment;
              // Initialize defective adjustments if not present
              if (wag.defectivePlus === undefined) wag.defectivePlus = 0;
              if (wag.defectiveMinus === undefined) wag.defectiveMinus = 0;
              wag.repayments.push({
                scheduleId: s.id,
                paidAt: s.paidAt,
                amount: installment,
                channel: s.paidChannel || null,
                transactionId: t.id,
                month: s.month,
                customer: t.customer || null,
                paymentType: t.paymentType,
                paidBy: paidByObj || { id: personId },
                soldBy: t.soldBy || null,
              });
            } else if (role === "CASHIER") {
              // Don't skip if user already processed - allow multiple repayments from same user
              // processedUsers.add(personId); // Remove this line

              if (!cashierMap.has(personId)) {
                cashierMap.set(personId, {
                  id: personId,
                  name:
                    `${paidByObj?.firstName || ""} ${paidByObj?.lastName || ""}`.trim() ||
                    paidByObj?.username ||
                    `#${personId}`,
                  cashTotal: 0,
                  cardTotal: 0,
                  creditTotal: 0,
                  installmentTotal: 0,
                  upfrontTotal: 0,
                  soldQuantity: 0,
                  soldAmount: 0,
                  creditMonths: [],
                  creditPercents: [],
                  repaymentTotal: 0,
                  repayments: [],
                  transactions: [],
                });
              }
              const cag = cashierMap.get(personId);
              cag.repaymentTotal += installment;
              // Initialize defective adjustments if not present
              if (cag.defectivePlus === undefined) cag.defectivePlus = 0;
              if (cag.defectiveMinus === undefined) cag.defectiveMinus = 0;
              cag.repayments.push({
                scheduleId: s.id,
                paidAt: s.paidAt,
                amount: installment,
                channel: s.paidChannel || null,
                transactionId: t.id,
                month: s.month,
                customer: t.customer || null,
                paymentType: t.paymentType,
                paidBy: paidByObj || { id: personId },
                soldBy: t.soldBy || null,
              });
            }
          }
        }

        // Include local daily repayments stored client-side
        try {
          const rawLocal = localStorage.getItem('tx_daily_repayments');
          const logs = rawLocal ? JSON.parse(rawLocal) : [];
          for (const l of Array.isArray(logs) ? logs : []) {
            const p = l?.paidAt ? new Date(l.paidAt) : null;
            const inRange = p && (!startBound || p >= startBound) && (!endBound || p <= endBound);
            if (!inRange) continue;
            repaymentSum += Number(l.amount || 0);
            const ch = (l.channel || 'CASH').toUpperCase();
            if (ch === 'CARD') repaymentCard += Number(l.amount || 0); else repaymentCash += Number(l.amount || 0);
          }
        } catch { }

        setOverallRepaymentTotal(repaymentSum);
        setOverallRepaymentCash(repaymentCash);
        setOverallRepaymentCard(repaymentCard);
      } catch (e) {
        console.warn("Failed to compute overall repayment total:", e);
        setOverallRepaymentTotal(0);
      }

      console.log("Processed data:", {
        products: Array.from(productMap.values()),
        daily: Array.from(dailyMap.values()),
        totals: { totalQuantity, totalAmount },
      });

      const productArray = Array.from(productMap.values()).filter(
        (p) => (p.quantity || 0) > 0 && (p.amount || 0) > 0
      );
      setProductSales(productArray);

      // Attach defective adjustments per person if available
      try {
        const params2 = new URLSearchParams();
        if (selectedBranchId) params2.append('branchId', selectedBranchId);
        const resDef2 = await fetch(`${BASE_URL}/defective-logs?${params2.toString()}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        if (resDef2.ok) {
          const logs2 = await resDef2.json().catch(() => []);
          const list2 = Array.isArray(logs2) ? logs2 : (Array.isArray(logs2.items) ? logs2.items : []);
          const start2 = filters.startDate ? new Date(`${filters.startDate}T00:00:00`) : null;
          const end2 = filters.endDate ? new Date(`${filters.endDate}T23:59:59`) : null;
          const perCashier = new Map();
          for (const lg of list2) {
            const createdAt = lg.createdAt ? new Date(lg.createdAt) : null;
            const inRange = createdAt && (!start2 || createdAt >= start2) && (!end2 || createdAt <= end2);
            if (!inRange) continue;
            const rawAmt = Number(lg.cashAmount ?? lg.amount ?? lg.value ?? 0) || 0;
            if (rawAmt === 0) continue;
            const actorIdRaw = (lg.createdBy && lg.createdBy.id) ?? lg.createdById ?? (lg.user && lg.user.id) ?? lg.userId ?? (lg.performedBy && lg.performedBy.id) ?? lg.performedById ?? null;
            if (actorIdRaw == null) continue;
            const key = String(actorIdRaw);
            if (!perCashier.has(key)) perCashier.set(key, { plus: 0, minus: 0 });
            const agg = perCashier.get(key);
            if (rawAmt > 0) agg.plus += rawAmt; else if (rawAmt < 0) agg.minus += Math.abs(rawAmt);
          }
          for (const c of cashierMap.values()) {
            const adj = perCashier.get(String(c.id)) || { plus: 0, minus: 0 };
            c.defectivePlus = adj.plus;
            c.defectiveMinus = adj.minus;
          }

          // Also add defective adjustments to warehouse users
          for (const w of warehouseMap.values()) {
            const adj = perCashier.get(String(w.id)) || { plus: 0, minus: 0 };
            w.defectivePlus = adj.plus;
            w.defectiveMinus = adj.minus;
          }
        }
      } catch { }

      // Build cashier summaries array
      const cashierArray = Array.from(cashierMap.values());
      const warehouseArray = Array.from(warehouseMap.values());

      // Final deduplication: ensure no user appears in both arrays
      const cashierIds = new Set(cashierArray.map(c => c.id));
      const finalWarehouseArray = warehouseArray.filter(w => !cashierIds.has(w.id));

      // Additional deduplication within each array by ID and ensure uniqueness
      const uniqueCashierArray = cashierArray.filter((c, index, self) =>
        index === self.findIndex(item => item.id === c.id)
      );

      const uniqueWarehouseArray = finalWarehouseArray.filter((w, index, self) =>
        index === self.findIndex(item => item.id === w.id)
      );

      // Extra safety check: ensure no duplicates between arrays
      const finalCashierArray = uniqueCashierArray.filter(c =>
        !uniqueWarehouseArray.some(w => w.id === c.id)
      );

      const finalWarehouseArray2 = uniqueWarehouseArray.filter(w =>
        !finalCashierArray.some(c => c.id === w.id)
      );

      // Log final results for debugging
      console.log('Final processing results:', {
        cashiers: finalCashierArray.map(c => ({ id: c.id, name: c.name })),
        warehouse: finalWarehouseArray2.map(w => ({ id: w.id, name: w.name })),
        totalCashiers: finalCashierArray.length,
        totalWarehouse: finalWarehouseArray2.length,
        processedUsers: processedUserIds ? Array.from(processedUserIds) : [],
        duplicatesRemoved: {
          cashiers: cashierArray.length - finalCashierArray.length,
          warehouse: warehouseArray.length - finalWarehouseArray2.length
        }
      });

      // Debug: show what was processed
      console.log('🔍 Debug - Processed Users:', {
        cashierUsers: Array.from(processedCashierUsers),
        warehouseUsers: Array.from(processedWarehouseUsers),
        allProcessed: Array.from(processedUserIds)
      });

      setCashierSummaries(finalCashierArray);
      setWarehouseSummaries(finalWarehouseArray2);
      setDailySales(Array.from(dailyMap.values()));
      setSalesTotals({ totalQuantity, totalAmount });

      // Fetch defective logs for the branch and time range; compute net cash +/- with return rules
      try {
        const params2 = new URLSearchParams();
        if (selectedBranchId) params2.append("branchId", selectedBranchId);
        const resDef = await fetch(`${BASE_URL}/defective-logs?${params2.toString()}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });
        let plus = 0;
        let minus = 0;
        if (resDef.ok) {
          const logs = await resDef.json().catch(() => []);
          const list = Array.isArray(logs) ? logs : (Array.isArray(logs.items) ? logs.items : []);
          const startBound2 = filters.startDate ? new Date(`${filters.startDate}T00:00:00`) : null;
          const endBound2 = filters.endDate ? new Date(`${filters.endDate}T23:59:59`) : null;
          // Build transaction map to check paymentType and repayment status
          const txById = new Map();
          for (const t of Array.isArray(transactions) ? transactions : []) {
            txById.set(t.id, t);
          }
          for (const log of list) {
            const createdAt = log.createdAt ? new Date(log.createdAt) : null;
            const inRange = createdAt && (!startBound2 || createdAt >= startBound2) && (!endBound2 || createdAt <= endBound2);
            if (!inRange) continue;
            const rawAmt = Number(log.cashAmount ?? log.amount ?? log.value ?? 0) || 0;
            if (rawAmt > 0) {
              plus += rawAmt;
            } else if (rawAmt < 0) {
              const isReturn = String(log.actionType || '').toUpperCase() === 'RETURN';
              if (isReturn) {
                const tx = txById.get(log.transactionId);
                const retAmount = Math.abs(rawAmt);
                if (tx) {
                  const paymentType = String(tx.paymentType || '').toUpperCase();
                  const finalTotal = Number(tx.finalTotal || tx.total || 0);
                  const upfrontPaid = Number(tx.downPayment || tx.amountPaid || 0);
                  let schedulesPaid = 0;
                  if (Array.isArray(tx.paymentSchedules)) {
                    for (const s of tx.paymentSchedules) {
                      schedulesPaid += Number((s?.paidAmount ?? s?.payment) || 0);
                    }
                  }
                  const fullyPaid = (upfrontPaid + schedulesPaid) >= finalTotal && finalTotal > 0;
                  if (paymentType === 'CASH') {
                    minus += retAmount;
                  } else if (paymentType === 'CARD') {
                    // ignore for Naqd
                  } else if (paymentType === 'CREDIT' || paymentType === 'INSTALLMENT') {
                    if (fullyPaid) minus += retAmount;
                  }
                }
              } else {
                // Generic cash out
                minus += Math.abs(rawAmt);
              }
            }
          }
        }
        setDefectivePlus(plus);
        setDefectiveMinus(minus);
      } catch (e) {
        setDefectivePlus(0);
        setDefectiveMinus(0);
      }
    } catch (error) {
      console.error("Error fetching transactions:", error.message);
      toast.error(error.message || "Маълумотларни олишда хатолик юз берди");
    } finally {
      setLoading(false);
    }
  }, [filters.startDate, filters.endDate, selectedBranchId, navigate]);

  // Manual refresh function - state ni to'liq tozalaydi
  const refreshData = useCallback(() => {
    console.log('Manual refresh - clearing all state...');
    setProductSales([]);
    setCashierSummaries([]);
    setWarehouseSummaries([]);
    setDailySales([]);
    setSalesTotals({ totalQuantity: 0, totalAmount: 0 });
    setDefectivePlus(0);
    setDefectiveMinus(0);
    setTransactions([]);
    setSelectedTransaction(null);
    setSelectedCashier(null);
    setSelectedWarehouse(null);
    setSelectedTransactionItems(null);
    setSelectedCustomer(null);
    setShowDetails(false);
    setShowCashierModal(false);
    setShowWarehouseModal(false);
    setShowCustomerModal(false);

    // Keyin yangi ma'lumotlarni olish
    setTimeout(() => {
      fetchTransactions();
      fetchUsers();
    }, 100);
  }, [fetchTransactions, fetchUsers]);

  const fetchTransactionDetails = async (id) => {
    try {
      const token = localStorage.getItem("access_token");
      if (!token) {
        console.error("No access token found in localStorage");
        navigate("/login");
        throw new Error("Авторизация токени топилмади");
      }

      // Fetch transaction details
      const transactionResponse = await fetch(
        `${BASE_URL}/transactions/${id}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!transactionResponse.ok) {
        const errorData = await transactionResponse.json().catch(() => ({}));
        const errorMessage = errorData.message || "Server error";
        console.error("Fetch error:", errorMessage);
        if (transactionResponse.status === 401) {
          localStorage.removeItem("access_token");
          navigate("/login");
          toast.error("Sessiya tugadi. Iltimos, qayta kiring.");
        }
        throw new Error(errorMessage);
      }

      const transactionData = await transactionResponse.json();
      setSelectedTransaction(transactionData);
      setShowDetails(true);
    } catch (error) {
      console.error("Error fetching transaction details:", error.message);
      toast.error(error.message || "Тафсилотларни олишда хатолик юз берди");
    }
  };

  {
    showDetails && selectedTransactionItems && (
      <div className="fixed inset-0 bg-black bg-opacity-60 z-[1000] flex items-center justify-center"> {/* z-60 dan z-[100] ga o'zgartirildi */}
        <div className="bg-white w-[90vw] max-w-[1200px] h-[90vh] max-h-[800px] rounded-lg shadow-xl flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="text-lg font-semibold">
              Транзакция #{selectedTransactionItems.id}
            </h3>
            <div className="flex items-center gap-2">
              <button
                className="text-gray-600 hover:text-gray-800 flex items-center gap-1"
                onClick={() => {
                  const c = selectedTransactionItems.customer || {};
                  const merged = {
                    ...c,
                    address: c.address || selectedTransactionItems.deliveryAddress || "-",
                    deliveryAddress: selectedTransactionItems.deliveryAddress || c.address || "-",
                  };
                  setSelectedCustomer(merged);
                  setShowCustomerModal(true);
                }}
              >
                <UserIcon size={16} /> Мижоз маълумоти
              </button>
              <button
                className="text-gray-500 hover:text-gray-700"
                onClick={() => {
                  setSelectedTransactionItems(null);
                  setShowDetails(false);
                }}
              >
                <XIcon size={20} />
              </button>
            </div>
          </div>
          <div className="p-4 overflow-auto flex-1">
            {/* Mijoz ma'lumotlari */}
            <div className="mb-4">
              <h4 className="text-md font-semibold text-gray-700 mb-2">Мижоз маълумотлари</h4>
              <div className="bg-gray-50 p-3 rounded border text-sm">
                <p><span className="text-gray-600">Ф.И.Ш:</span> <span className="font-medium">{selectedTransactionItems.customer?.fullName || "-"}</span></p>
                <p><span className="text-gray-600">Телефон:</span> <span className="font-medium">{selectedTransactionItems.customer?.phoneNumber || selectedTransactionItems.customer?.phone || "-"}</span></p>
                <p><span className="text-gray-600">Манзил:</span> <span className="font-medium">{selectedTransactionItems.customer?.address || selectedTransactionItems.deliveryAddress || "-"}</span></p>
                <p><span className="text-gray-600">Паспорт:</span> <span className="font-medium">{selectedTransactionItems.customer?.passportSeries || "-"}</span></p>
                <p><span className="text-gray-600">ЖШШИР:</span> <span className="font-medium">{selectedTransactionItems.customer?.jshshir || "-"}</span></p>
              </div>
            </div>

            {/* Sotilgan mahsulotlar */}
            <div className="mb-4">
              <h4 className="text-md font-semibold text-gray-700 mb-2">Сотилган маҳсулотлар</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left">Маҳсулот</th>
                      <th className="px-3 py-2 text-left">Модель</th>
                      <th className="px-3 py-2 text-left">Миқдор</th>
                      <th className="px-3 py-2 text-left">Нарxи</th>
                      <th className="px-3 py-2 text-left">Жами</th>
                      <th className="px-3 py-2 text-left">Кредит/Бўлиб</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {(selectedTransactionItems.items || []).map((it, i) => (
                      <tr key={`transaction-item-${it.productId || it.id || it.name || i}-${i}`} className="hover:bg-gray-50">
                        <td className="px-3 py-2">{it.product?.name || it.name || "-"}</td>
                        <td className="px-3 py-2">{it.product?.model || "-"}</td>
                        <td className="px-3 py-2">{it.quantity}</td>
                        <td className="px-3 py-2">{formatAmount(it.price)}</td>
                        <td className="px-3 py-2">{formatAmount((Number(it.price) || 0) * (Number(it.quantity) || 0))}</td>
                        <td className="px-3 py-2">
                          {(() => {
                            const isCreditOrInstallment = selectedTransactionItems.paymentType === 'CREDIT' || selectedTransactionItems.paymentType === 'INSTALLMENT';
                            if (!isCreditOrInstallment) return '-';
                            const pct = typeof selectedTransactionItems.interestRate === 'number'
                              ? `${Number(selectedTransactionItems.interestRate).toFixed(0)}%`
                              : (typeof it.creditPercent === 'number' ? `${(it.creditPercent * 100).toFixed(0)}%` : '0%');
                            if (selectedTransactionItems.termUnit === 'DAYS' && Number(selectedTransactionItems.days) > 0) {
                              const total = Number(selectedTransactionItems.finalTotal || 0);
                              const paid = Number(selectedTransactionItems.amountPaid || 0) + Number(selectedTransactionItems.downPayment || 0);
                              const remaining = Math.max(0, total - paid);
                              return (
                                <span>
                                  {Number(selectedTransactionItems.days)} кун {pct}
                                  {paid > 0 && remaining > 0 ? ' — Қисман тўланган' : ''}
                                </span>
                              );
                            }
                            if (it.creditMonth || it.creditPercent != null) {
                              return (
                                <span>
                                  {it.creditMonth || '-'} ой, {pct}
                                </span>
                              );
                            }
                            if (Array.isArray(selectedTransactionItems.paymentSchedules) && selectedTransactionItems.paymentSchedules.length > 0) {
                              return <span>{selectedTransactionItems.paymentSchedules.length} ой, {pct}</span>;
                            }
                            return pct;
                          })()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Transaction umumiy ma'lumotlari */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
              <div className="p-3 rounded border">
                <div className="text-sm text-gray-500">Тўлов тури</div>
                <div className="font-semibold">{getPaymentTypeLabel(selectedTransactionItems.paymentType)}</div>
              </div>
              <div className="p-3 rounded border">
                <div className="text-sm text-gray-500">Якуний</div>
                <div className="font-semibold">{formatAmount(selectedTransactionItems.finalTotal)}</div>
              </div>
              <div className="p-3 rounded border">
                <div className="text-sm text-gray-500">Олдиндан тўлов</div>
                <div className="font-semibold">
                  {formatAmount(
                    ['CREDIT', 'INSTALLMENT'].includes(selectedTransactionItems.paymentType)
                      ? Number(selectedTransactionItems.amountPaid || 0)
                      : Number(selectedTransactionItems.amountPaid || 0) + Number(selectedTransactionItems.downPayment || 0)
                  )}
                </div>
              </div>
              <div className="p-3 rounded border">
                <div className="text-sm text-gray-500">Олдиндан тўлов тури</div>
                <div className="font-semibold">
                  {['CREDIT', 'INSTALLMENT'].includes(selectedTransactionItems.paymentType)
                    ? (selectedTransactionItems.upfrontPaymentType === 'CASH' ? 'Нақд'
                      : selectedTransactionItems.upfrontPaymentType === 'CARD' ? 'Карта' : 'Номаълум')
                    : '-'}
                </div>
              </div>
            </div>

            {/* Kredit to'lovlari */}
            {Array.isArray(selectedTransactionItems.repayments) && selectedTransactionItems.repayments.length > 0 && (
              <div className="mb-4">
                <div className="text-sm font-semibold text-gray-700 mb-2">Кредитдан тўловлар</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left">Ой</th>
                        <th className="px-3 py-2 text-left">Тўланган куни</th>
                        <th className="px-3 py-2 text-left">Сумма</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {(selectedTransactionItems.repayments || [])
                        .filter((r) => {
                          const p = r?.paidAt ? new Date(r.paidAt) : null;
                          const sb = filters.startDate ? new Date(`${filters.startDate}T00:00:00`) : null;
                          const eb = filters.endDate ? new Date(`${filters.endDate}T23:59:59`) : null;
                          if (!p) return false;
                          const inRange = (!sb || p >= sb) && (!eb || p <= eb);
                          return inRange;
                        })
                        .map((r, idx) => (
                          <tr key={`transaction-repayment-${r.scheduleId || r.transactionId || r.paidAt || idx}-${idx}`} className="hover:bg-gray-50">
                            <td className="px-3 py-2">{r.month}</td>
                            <td className="px-3 py-2">{formatDate(r.paidAt)}</td>
                            <td className="px-3 py-2">{formatAmount(r.amount)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Mijoz tafsilotlari modalini qayta ishlatish
  const renderCustomerModal = () => {
    if (!showCustomerModal || !selectedCustomer) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-70">
        <div className="bg-white p-4 rounded-lg w-full max-w-md">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-bold">Mijoz Tafsilotlari</h2>
            <button onClick={() => setShowCustomerModal(false)} className="text-gray-500 hover:text-gray-700">
              <XIcon className="w-5 h-5" />
            </button>
          </div>
          <div className="text-sm">
            <p><strong>Ism:</strong> {selectedCustomer.fullName || "N/A"}</p>
            <p><strong>Telefon:</strong> {selectedCustomer.phoneNumber || "N/A"}</p>
            <p><strong>Manzil:</strong> {selectedCustomer.address || "N/A"}</p>
          </div>
        </div>
      </div>
    );
  };

  // Fetch per-user handover from backend cashier-reports endpoint
  const fetchHandoverForUsers = useCallback(async (users) => {
    try {
      const token = localStorage.getItem("access_token");
      if (!token) return;
      const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
      const params = new URLSearchParams();
      if (selectedBranchId) params.append('branchId', selectedBranchId);
      if (filters.startDate) params.append('startDate', new Date(`${filters.startDate}T00:00:00`).toISOString());
      if (filters.endDate) params.append('endDate', new Date(`${filters.endDate}T23:59:59`).toISOString());

      const pairs = users.map(u => ({ id: u.id, url: `${BASE_URL}/cashier-reports/cashier/${u.id}?${params.toString()}` }));
      const results = await Promise.all(pairs.map(async p => {
        try {
          if (!res.ok) return { id: p.id, value: 0 };
          const rep = await res.json();
          const value = Number(rep.cashTotal || 0)
            + Number(rep.upfrontTotal || 0)
            + Number(rep.repaymentTotal || 0)
            + (Number(rep.defectivePlus || 0) - Number(rep.defectiveMinus || 0));
          return { id: p.id, value };
        } catch {
          return { id: p.id, value: 0 };
        }
      }));
      const map = {};
      for (const r of results) map[String(r.id)] = r.value;
      setHandoverByUserId(map);
    } catch {}
  }, [selectedBranchId, filters.startDate, filters.endDate]);

  // Update per-user handovers when users/date/branch change
  useEffect(() => {
    const visibleUsers = allUsers.filter(u => (!selectedBranchId || u.branchId === selectedBranchId) && (u.role === 'CASHIER' || u.role === 'WAREHOUSE'));
    if (visibleUsers.length > 0) {
      fetchHandoverForUsers(visibleUsers);
    } else {
      setHandoverByUserId({});
    }
  }, [allUsers, selectedBranchId, filters.startDate, filters.endDate, fetchHandoverForUsers]);

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="p-6 bg-gray-50 min-h-screen">

        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 mb-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">
                Транзакциялар Ҳисоботи
              </h1>
              {selectedBranchId && (
                <p className="text-sm text-gray-600 mt-1">
                  Филиал ID: {selectedBranchId}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => navigate('/admin/sotuvchilar')}
                className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors text-sm sm:text-base"
                title="Сотувчилар саҳифасига ўтиш"
              >
                Сотувчилар саҳифасига ўтиш
              </button>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, startDate: e.target.value }))
                }
                className="border rounded px-2 py-1 text-sm"
              />
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, endDate: e.target.value }))
                }
                className="border rounded px-2 py-1 text-sm"
              />
              {/* Product ID search removed as requested */}
              <button
                onClick={() => {
                  refreshData(); // Manual refresh function ni ishlatish
                }}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors text-sm sm:text-base disabled:opacity-50"
                disabled={loading}
                title="Маълумотларни янгилаш (state ni tozalaydi)"
              >
                <RefreshCw
                  size={16}
                  className={loading ? "animate-spin" : ""}
                />
                Янгилаш
              </button>
            </div>
          </div>
        </div>

        {/* Product Sales Summary */}
        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 mb-4">
          <h2 className="text-lg font-semibold mb-3">
            Ҳисобот
          </h2>
          <div className="mb-6">

            {usersLoading ? (
              <div className="text-center py-4">
                <div className="text-gray-500">Фойдаланувчилар юкланмоқда...</div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-blue-50 rounded-lg p-4">
                  <h4 className="text-md font-semibold text-blue-800 mb-3 flex items-center gap-2">
                    <UserIcon size={18} />
                    Кассирлар ({allUsers.filter(user => user.role === 'CASHIER' && (!selectedBranchId || user.branchId === selectedBranchId)).length})
                  </h4>
                  <div className="space-y-2">
                    {allUsers.filter(user => user.role === 'CASHIER' && (!selectedBranchId || user.branchId === selectedBranchId)).length === 0 ? (
                      <p className="text-gray-500 text-sm">Кассирлар топилмади</p>
                    ) : (
                      allUsers
                        .filter(user => user.role === 'CASHIER' && (!selectedBranchId || user.branchId === selectedBranchId))
                        .map((user, index) => {
                          // Find corresponding cashier summary
                          const cashierSummary = cashierSummaries.find(c => c.id === user.id.toString());
                          return (
                            <div key={`cashier-list-${user.id}-${index}`} className="flex items-center justify-between bg-white rounded p-2 shadow-sm">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-700">
                                  {getUserName(user)}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                               
                                <button
                                  onClick={() => {
                                    setSelectedUser(user);
                                    setShowUserModal(true);
                                    fetchUserReport(user.id, 'CASHIER');
                                  }}
                                  className="text-blue-600 hover:text-blue-800 p-1"
                                  title="Тўлиқ ҳисоботни кўриш"
                                >
                                  <Eye size={16} />
                                </button>
                              </div>
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>

                {/* Warehouse Staff List */}
                <div className="bg-green-50 rounded-lg p-4">
                  <h4 className="text-md font-semibold text-green-800 mb-3 flex items-center gap-2">
                    <UserIcon size={18} />
                    Омбор ходимлари ({allUsers.filter(user => user.role === 'WAREHOUSE' && (!selectedBranchId || user.branchId === selectedBranchId)).length})
                  </h4>
                  <div className="space-y-2">
                    {allUsers.filter(user => user.role === 'WAREHOUSE' && (!selectedBranchId || user.branchId === selectedBranchId)).length === 0 ? (
                      <p className="text-gray-500 text-sm">Омбор ходимлари топилмади</p>
                    ) : (
                      allUsers
                        .filter(user => user.role === 'WAREHOUSE' && (!selectedBranchId || user.branchId === selectedBranchId))
                        .map((user, index) => {
                          // Find corresponding warehouse summary
                          const warehouseSummary = warehouseSummaries.find(w => w.id === user.id.toString());
                          return (
                            <div key={`warehouse-list-${user.id}-${index}`} className="flex items-center justify-between bg-white rounded p-2 shadow-sm">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-700">
                                  {getUserName(user)}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                               
                                <button
                                  onClick={() => {
                                    setSelectedUser(user);
                                    setShowUserModal(true);
                                    fetchUserReport(user.id, 'WAREHOUSE');
                                  }}
                                  className="text-green-600 hover:text-green-800 p-1"
                                  title="Тўлиқ ҳисоботни кўриш"
                                >
                                  <Eye size={16} />
                                </button>
                              </div>
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>

                {/* Admins List */}
                <div className="bg-purple-50 rounded-lg p-4 md:col-span-2">
                  <h4 className="text-md font-semibold text-purple-800 mb-3 flex items-center gap-2">
                    <UserIcon size={18} />
                    Админлар ({allUsers.filter(user => (user.role === 'ADMIN' || user.role === 'MANAGER') && (!selectedBranchId || user.branchId === selectedBranchId)).length})
                  </h4>
                  <div className="space-y-2">
                    {allUsers.filter(user => (user.role === 'ADMIN' || user.role === 'MANAGER') && (!selectedBranchId || user.branchId === selectedBranchId)).length === 0 ? (
                      <p className="text-gray-500 text-sm">Админлар топилмади</p>
                    ) : (
                      allUsers
                        .filter(user => (user.role === 'ADMIN' || user.role === 'MANAGER') && (!selectedBranchId || user.branchId === selectedBranchId))
                        .map((user, index) => (
                          <div key={`admin-list-${user.id}-${index}`} className="flex items-center justify-between bg-white rounded p-2 shadow-sm">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-700">
                                {getUserName(user)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  setSelectedUser(user);
                                  setShowUserModal(true);
                                  fetchUserReport(user.id, 'ADMIN');
                                }}
                                className="text-purple-600 hover:text-purple-800 p-1"
                                title="Тўлиқ ҳисоботни кўриш"
                              >
                                <Eye size={16} />
                              </button>
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-8">
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                    Маҳсулот
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                    Сотилган дона
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                    Сумма
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan="3" className="px-4 py-4 text-center">
                      Юкланмоқда...
                    </td>
                  </tr>
                ) : productSales.length === 0 ? (
                  <tr>
                    <td
                      colSpan="3"
                      className="px-4 py-4 text-center text-gray-500"
                    >
                      Маълумот йўқ
                    </td>
                  </tr>
                ) : (
                  productSales.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">{p.name || `#${p.id}`}</td>
                      <td className="px-4 py-3">{p.quantity}</td>
                      <td className="px-4 py-3">{formatAmount(p.amount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Cashier full-screen modal */}
        {showCashierModal && selectedCashier && (
          <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center">
            <div className="bg-white w-[95vw] h-[95vh] rounded-lg shadow-xl flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <h3 className="text-lg font-semibold">
                  {selectedCashier.name} — тўлиқ сотувлар
                </h3>
                <button
                  className="text-gray-500 hover:text-gray-700"
                  onClick={() => {
                    setShowCashierModal(false);
                    setSelectedCashier(null);
                  }}
                >
                  <XIcon size={20} />
                </button>
              </div>
              <div className="p-4 overflow-auto flex-1">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                  <div className="p-3 rounded border">
                    <div className="text-sm text-gray-500">Нақд</div>
                    <div className="font-semibold">
                      {formatAmount(selectedCashier.cashTotal)}
                    </div>
                  </div>
                  <div className="p-3 rounded border">
                    <div className="text-sm text-gray-500">Карта</div>
                    <div className="font-semibold">
                      {formatAmount(selectedCashier.cardTotal)}
                    </div>
                  </div>
                  <div className="p-3 rounded border">
                    <div className="text-sm text-gray-500">Кредит</div>
                    <div className="font-semibold">
                      {formatAmount(selectedCashier.creditTotal)}
                    </div>
                  </div>
                  <div className="p-3 rounded border">
                    <div className="text-sm text-gray-500">Бўлиб тўлаш</div>
                    <div className="font-semibold">
                      {formatAmount(selectedCashier.installmentTotal)}
                    </div>
                  </div>
                  <div className="p-3 rounded border">
                    <div className="text-sm text-gray-500">
                      Олдиндан олинган
                    </div>
                    <div className="font-semibold">
                      {formatAmount(selectedCashier.upfrontTotal)}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <div className="text-xs">Naqd</div>
                        <div className="font-semibold">
                          {formatAmount(selectedCashier.upfrontCash || 0)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs">Karta</div>
                        <div className="font-semibold">
                          {formatAmount(selectedCashier.upfrontCard || 0)}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="p-3 rounded border bg-purple-50">
                    <div className="text-sm">Кредитдан тўланган</div>
                    <div className="text-xl font-bold">
                      {formatAmount(selectedCashier.repaymentTotal || 0)}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <div className="text-xs">Naqd</div>
                        <div className="font-semibold">
                          {formatAmount(
                            (selectedCashier.repayments || [])
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
                            (selectedCashier.repayments || [])
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
                      {selectedCashier.soldQuantity}
                    </div>
                  </div>
                  <div className="p-3 rounded border">
                    <div className="text-sm text-gray-500">Касса тузатишлар</div>
                    <div className="font-semibold">
                      + {formatAmount(selectedCashier.defectivePlus || 0)}
                    </div>
                    <div className="font-semibold text-red-600">
                      - {formatAmount(selectedCashier.defectiveMinus || 0)}
                    </div>
                  </div>
                  <div className="p-3 rounded border">
                    <div className="text-sm text-gray-500">
                      Топширадиган пул
                    </div>
                    <div className="font-semibold">
                      {formatAmount(
                        selectedCashier.cashTotal +
                        (selectedCashier.repayments || [])
                          .filter(
                            (r) =>
                              (r.channel || "CASH").toUpperCase() === "CASH"
                          )
                          .reduce((s, r) => s + Number(r.amount || 0), 0) +
                        selectedCashier.upfrontTotal +
                        (Number(selectedCashier.defectivePlus || 0) - Number(selectedCashier.defectiveMinus || 0))
                      )}
                    </div>
                  </div>
                </div>

                {/* Repayments list for selected cashier */}
                {Array.isArray(selectedCashier.repayments) &&
                  selectedCashier.repayments.length > 0 && (
                    <div className="mb-4">
                      <div className="text-sm font-semibold text-gray-700 mb-2">
                        Кредитдан тўловлар (oy/kun bo'yicha)
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
                            {selectedCashier.repayments.map((r, idx) => (
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
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left">ID</th>
                        <th className="px-3 py-2 text-left">Сана</th>
                        <th className="px-3 py-2 text-left">Тўлов тури</th>
                        <th className="px-3 py-2 text-left">Сотган</th>
                        <th className="px-3 py-2 text-left">Олдиндан</th>
                        <th className="px-3 py-2 text-left">Якуний</th>
                        <th className="px-3 py-2 text-left">Кўриш</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {(selectedCashier.transactions || []).map((t) => (
                        <tr key={t.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2">#{t.id}</td>
                          <td className="px-3 py-2">
                            {formatDate(t.createdAt)}
                          </td>
                          <td className="px-3 py-2">
                            {getPaymentTypeLabel(t.paymentType)}
                          </td>
                          <td className="px-3 py-2">
                            {t.soldByName ||
                              (t.soldBy
                                ? `${t.soldBy.firstName || ""} ${t.soldBy.lastName || ""
                                  }`.trim()
                                : "-")}
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
                          <td className="px-3 py-2">
                            <button
                              className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                              onClick={() => {
                                setSelectedTransactionItems(t);
                              }}
                            >
                              <Eye size={14} /> Кўриш
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Warehouse full-screen modal */}
        {showWarehouseModal && selectedWarehouse && (
          <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center">
            <div className="bg-white w-[95vw] h-[95vh] rounded-lg shadow-xl flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <h3 className="text-lg font-semibold">
                  {selectedWarehouse.name} — омбор операциялари
                </h3>
                <button
                  className="text-gray-500 hover:text-gray-700"
                  onClick={() => {
                    setShowWarehouseModal(false);
                    setSelectedWarehouse(null);
                  }}
                >
                  <XIcon size={20} />
                </button>
              </div>
              <div className="p-4 overflow-auto flex-1">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                  <div className="p-3 rounded border">
                    <div className="text-sm text-gray-500">Нақд</div>
                    <div className="font-semibold">
                      {formatAmount(selectedWarehouse.cashTotal)}
                    </div>
                  </div>
                  <div className="p-3 rounded border">
                    <div className="text-sm text-gray-500">Карта</div>
                    <div className="font-semibold">
                      {formatAmount(selectedWarehouse.cardTotal)}
                    </div>
                  </div>
                  <div className="p-3 rounded border">
                    <div className="text-sm text-gray-500">Кредит</div>
                    <div className="font-semibold">
                      {formatAmount(selectedWarehouse.creditTotal)}
                    </div>
                  </div>
                  <div className="p-3 rounded border">
                    <div className="text-sm text-gray-500">Бўлиб тўлаш</div>
                    <div className="font-semibold">
                      {formatAmount(selectedWarehouse.installmentTotal)}
                    </div>
                  </div>
                  <div className="p-3 rounded border">
                    <div className="text-sm text-gray-500">
                      Олдиндан олинган
                    </div>
                    <div className="font-semibold">
                      {formatAmount(selectedWarehouse.upfrontTotal)}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <div className="text-xs">Naqd</div>
                        <div className="font-semibold">
                          {formatAmount(selectedWarehouse.upfrontCash || 0)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs">Karta</div>
                        <div className="font-semibold">
                          {formatAmount(selectedWarehouse.upfrontCard || 0)}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="p-3 rounded border bg-purple-50">
                    <div className="text-sm">Кредитдан тўланган</div>
                    <div className="text-xl font-bold">
                      {formatAmount(selectedWarehouse.repaymentTotal || 0)}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <div className="text-xs">Naqd</div>
                        <div className="font-semibold">
                          {formatAmount(
                            (selectedWarehouse.repayments || [])
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
                            (selectedWarehouse.repayments || [])
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
                      {selectedWarehouse.soldQuantity}
                    </div>
                  </div>
                  <div className="p-3 rounded border">
                    <div className="text-sm text-gray-500">Касса тузатишлар</div>
                    <div className="font-semibold">
                      + {formatAmount(selectedWarehouse.defectivePlus || 0)}
                    </div>
                    <div className="font-semibold text-red-600">
                      - {formatAmount(selectedWarehouse.defectiveMinus || 0)}
                    </div>
                  </div>
                  <div className="p-3 rounded border">
                    <div className="text-sm text-gray-500">
                      Топширадиган пул
                    </div>
                    <div className="font-semibold">
                      {formatAmount(
                        selectedWarehouse.cashTotal +
                        (selectedWarehouse.repayments || [])
                          .filter(
                            (r) =>
                              (r.channel || "CASH").toUpperCase() === "CASH"
                          )
                          .reduce((s, r) => s + Number(r.amount || 0), 0) +
                        selectedWarehouse.upfrontTotal +
                        (Number(selectedWarehouse.defectivePlus || 0) - Number(selectedWarehouse.defectiveMinus || 0))
                      )}
                    </div>
                  </div>
                </div>

                {Array.isArray(selectedWarehouse.repayments) &&
                  selectedWarehouse.repayments.length > 0 && (
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
                            {selectedWarehouse.repayments.map((r, idx) => (
                              <tr key={`warehouse-repayment-${r.scheduleId || r.transactionId || r.paidAt || idx}-${idx}`} className="hover:bg-gray-50">
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
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left">ID</th>
                        <th className="px-3 py-2 text-left">Сана</th>
                        <th className="px-3 py-2 text-left">Тури</th>
                        <th className="px-3 py-2 text-left">Сотган</th>
                        <th className="px-3 py-2 text-left">Якуний</th>
                        <th className="px-3 py-2 text-left">Кимдан</th>
                        <th className="px-3 py-2 text-left">Кимга</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {(selectedWarehouse.transactions || []).map((t) => (
                        <tr key={t.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2">#{t.id}</td>
                          <td className="px-3 py-2">
                            {formatDate(t.createdAt)}
                          </td>
                          <td className="px-3 py-2">
                            {transactionTypes[t.type]?.label || t.type}
                          </td>
                          <td className="px-3 py-2">
                            {t.soldByName ||
                              (t.soldBy
                                ? `${t.soldBy.firstName || ""} ${t.soldBy.lastName || ""
                                  }`.trim()
                                : "-")}
                          </td>
                          <td className="px-3 py-2">
                            {formatAmount(t.finalTotal)}
                          </td>
                          <td className="px-3 py-2">
                            {t.fromBranchName || "-"}
                          </td>
                          <td className="px-3 py-2">{t.toBranchName || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Transaction items modal inside cashier modal */}
        {selectedTransactionItems && (
          <div className="fixed inset-0 bg-black bg-opacity-60 z-[1000] flex items-center justify-center">
            <div className="bg-white w-[90vw] h-[90vh] rounded-lg shadow-xl flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <h3 className="text-lg font-semibold">
                  Транзакция #{selectedTransactionItems.id}
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    className="text-gray-600 hover:text-gray-800 flex items-center gap-1"
                    onClick={() => {
                      const c = selectedTransactionItems.customer || {};
                      const merged = {
                        ...c,
                        address:
                          c.address ||
                          selectedTransactionItems.deliveryAddress ||
                          c.address,
                        deliveryAddress:
                          selectedTransactionItems.deliveryAddress ||
                          c.deliveryAddress ||
                          c.address,
                      };
                      setSelectedCustomer(merged);
                      setShowCustomerModal(true);
                    }}
                  >
                    <UserIcon size={16} /> Мижоз маълумоти
                  </button>
                  <button
                    className="text-gray-500 hover:text-gray-700"
                    onClick={() => setSelectedTransactionItems(null)}
                  >
                    <XIcon size={20} />
                  </button>
                </div>
              </div>
              <div className="p-4 overflow-auto flex-1">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                  <div className="p-3 rounded border">
                    <div className="text-sm text-gray-500">Тўлов тури</div>
                    <div className="font-semibold">
                      {getPaymentTypeLabel(
                        selectedTransactionItems.paymentType
                      )}
                    </div>
                  </div>
                  <div className="p-3 rounded border">
                    <div className="text-sm text-gray-500">Якуний</div>
                    <div className="font-semibold">
                      {formatAmount(selectedTransactionItems.finalTotal)}
                    </div>
                  </div>
                </div>

                {Array.isArray(selectedTransactionItems.repayments) &&
                  selectedTransactionItems.repayments.length > 0 && (
                    <div className="mb-4">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-2 text-left">Ой</th>
                              <th className="px-3 py-2 text-left">
                                Тўланган куни
                              </th>
                              <th className="px-3 py-2 text-left">Сумма</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {(selectedTransactionItems.repayments || [])
                              .filter((r) => {
                                const p = r?.paidAt ? new Date(r.paidAt) : null;
                                const sb = filters.startDate
                                  ? new Date(`${filters.startDate}T00:00:00`)
                                  : null;
                                const eb = filters.endDate
                                  ? new Date(`${filters.endDate}T23:59:59`)
                                  : null;
                                if (!p) return false;
                                const inRange =
                                  (!sb || p >= sb) && (!eb || p <= eb);
                                return inRange;
                              })
                              .map((r, idx) => (
                                <tr key={`transaction-repayment-${r.scheduleId || r.transactionId || r.paidAt || idx}-${idx}`} className="hover:bg-gray-50">
                                  <td className="px-3 py-2">{r.month}</td>
                                  <td className="px-3 py-2">
                                    {formatDate(r.paidAt)}
                                  </td>
                                  <td className="px-3 py-2">
                                    {formatAmount(r.amount)}
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
                        <th className="px-3 py-2 text-left">Маҳсулот</th>
                        <th className="px-3 py-2 text-left">Миқдор</th>
                        <th className="px-3 py-2 text-left">Жами</th>
                        <th className="px-3 py-2 text-left">Кредит/Бўлиб</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {(selectedTransactionItems.items || []).map((it, i) => (
                        <tr key={`transaction-item-${it.productId || it.id || it.name || i}-${i}`} className="hover:bg-gray-50">
                          <td className="px-3 py-2">
                            {it.product?.name || it.name || "N/A"}
                          </td>
                          <td className="px-3 py-2">
                            {it.quantity != null ? it.quantity : "0"}
                          </td>
                          <td className="px-3 py-2">
                            {formatAmount(
                              (Number(it.price) || 0) * (Number(it.quantity) || 0)
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {(() => {
                              const isCreditOrInstallment =
                                selectedTransactionItems.paymentType === "CREDIT" ||
                                selectedTransactionItems.paymentType === "INSTALLMENT";
                              if (!isCreditOrInstallment) return "-";
                              const pct =
                                typeof selectedTransactionItems.interestRate === "number"
                                  ? `${Number(selectedTransactionItems.interestRate).toFixed(0)}%`
                                  : typeof it.creditPercent === "number"
                                    ? `${(it.creditPercent * 100).toFixed(0)}%`
                                    : "0%";
                              if (
                                selectedTransactionItems.termUnit === "DAYS" &&
                                Number(selectedTransactionItems.days) > 0
                              ) {
                                const total = Number(selectedTransactionItems.finalTotal || 0);
                                const paid =
                                  Number(selectedTransactionItems.amountPaid || 0) +
                                  Number(selectedTransactionItems.downPayment || 0);
                                const remaining = Math.max(0, total - paid);
                                return (
                                  <span>
                                    {Number(selectedTransactionItems.days)} кун {pct}
                                    {paid > 0 && remaining > 0 ? " — Қисман тўланган" : ""}
                                  </span>
                                );
                              }
                              if (it.creditMonth || it.creditPercent != null) {
                                return (
                                  <span>
                                    {it.creditMonth || "-"} ой, {pct}
                                  </span>
                                );
                              }
                              if (
                                Array.isArray(selectedTransactionItems.paymentSchedules) &&
                                selectedTransactionItems.paymentSchedules.length > 0
                              ) {
                                return (
                                  <span>
                                    {selectedTransactionItems.paymentSchedules.length} ой, {pct}
                                  </span>
                                );
                              }
                              return pct;
                            })()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Customer details modal */}
        {showCustomerModal && selectedCustomer && (
          <div className="fixed inset-0 bg-black bg-opacity-60 z-[10000] flex items-center justify-center">
            <div className="bg-white w-[600px] max-w-[95vw] rounded-lg shadow-xl">
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <h3 className="text-lg font-semibold">Мижоз маълумотлари</h3>
                <button
                  className="text-gray-500 hover:text-gray-700"
                  onClick={() => {
                    setShowCustomerModal(false);
                    setSelectedCustomer(null);
                  }}
                >
                  <XIcon size={20} />
                </button>
              </div>
              <div className="p-4 space-y-2 text-sm">
                <p>
                  <span className="text-gray-600">Ф.И.Ш:</span>{" "}
                  <span className="font-medium">
                    {selectedCustomer.fullName || "-"}
                  </span>
                </p>
                <p>
                  <span className="text-gray-600">Телефон:</span>{" "}
                  <span className="font-medium">
                    {selectedCustomer.phone || "-"}
                  </span>
                </p>
                <p>
                  <span className="text-gray-600">Паспорт:</span>{" "}
                  <span className="font-medium">
                    {selectedCustomer.passportSeries || "-"}
                  </span>
                </p>
                <p>
                  <span className="text-gray-600">ЖШШИР:</span>{" "}
                  <span className="font-medium">
                    {selectedCustomer.jshshir || "-"}
                  </span>
                </p>
                <p>
                  <span className="text-gray-600">Манзил:</span>{" "}
                  <span className="font-medium">
                    {selectedCustomer.address ||
                      selectedCustomer.deliveryAddress ||
                      "-"}
                  </span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* User Report Modal */}
        {showUserModal && selectedUser && (
          <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center">
            <div className="bg-white w-[95vw] h-[95vh] rounded-lg shadow-xl flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <h3 className="text-lg font-semibold">
                  {getUserName(selectedUser)} — тўлиқ ҳисобот
                </h3>
                <button
                  className="text-gray-500 hover:text-gray-700"
                  onClick={() => {
                    setShowUserModal(false);
                    setSelectedUser(null);
                    setUserReport(null);
                  }}
                >
                  <XIcon size={20} />
                </button>
              </div>
              <div className="p-4 overflow-auto flex-1">
                {userReportLoading ? (
                  <div className="text-center py-8">
                    <div className="text-gray-500">Ҳисобот юкланмоқда...</div>
                  </div>
                ) : !userReport ? (
                  <div className="text-center py-8">
                    <div className="text-gray-500">Ҳисобот маълумотлари топилмади</div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                      <div className="p-3 rounded border">
                        <div className="text-sm text-gray-500">Нақд</div>
                        <div className="font-semibold">
                          {formatAmount(
                            Number(userReport.cashTotal || 0) +
                            Number(userReport.upfrontCash || 0) +
                            (userReport.repayments || [])
                              .filter(r => (r.channel || "CASH").toUpperCase() === "CASH")
                              .reduce((s, r) => s + Number(r.amount || 0), 0) +
                            Math.max(0, userReport.defectivePlus) - Math.max(0, userReport.defectiveMinus)
                          )}
                        </div>
                        <div className="mt-2 text-xs text-gray-500">
                          <div>💵 Нақд сотувлар: {formatAmount(userReport.cashTotal || 0)}</div>
                          <div>💰 Олдиндан тўловлар: {formatAmount(userReport.upfrontCash || 0)}</div>
                          <div>💳 Кредит тўловлар: {formatAmount(
                            (userReport.repayments || [])
                              .filter(r => (r.channel || "CASH").toUpperCase() === "CASH")
                              .reduce((s, r) => s + Number(r.amount || 0), 0)
                          )}</div>
                          <div>📊 Қайтариш тўловлар: {formatAmount(Math.max(0, userReport.defectivePlus) - Math.max(0, userReport.defectiveMinus))}</div>
                        </div>
                      </div>
                      <div className="p-3 rounded border">
                        <div className="text-sm text-gray-500">Карта</div>
                        <div className="font-semibold">
                          {formatAmount(
                            Number(userReport.cardTotal || 0) +
                            Number(userReport.upfrontCard || 0) +
                            (userReport.repayments || [])
                              .filter(r => (r.channel || "CARD").toUpperCase() === "CARD")
                              .reduce((s, r) => s + Number(r.amount || 0), 0)
                          )}
                        </div>
                        <div className="mt-2 text-xs text-gray-500">
                          <div>💳 Карта сотувлар: {formatAmount(userReport.cardTotal || 0)}</div>
                          <div>💰 Олдиндан тўловлар: {formatAmount(userReport.upfrontCard || 0)}</div>
                          <div>💳 Кредит тўловлар: {formatAmount(
                            (userReport.repayments || [])
                              .filter(r => (r.channel || "CARD").toUpperCase() === "CARD")
                              .reduce((s, r) => s + Number(r.amount || 0), 0)
                          )}</div>
                        </div>
                      </div>
                      <div className="p-3 rounded border">
                        <div className="text-sm text-gray-500">Кредит</div>
                        <div className="font-semibold">
                          {formatAmount(userReport.creditTotal)}
                        </div>
                      </div>
                      <div className="p-3 rounded border">
                        <div className="text-sm text-gray-500">Бўлиб тўлаш</div>
                        <div className="font-semibold">
                          {formatAmount(userReport.installmentTotal)}
                        </div>
                      </div>
                      <div className="p-3 rounded border">
                        <div className="text-sm text-gray-500">
                          Олдиндан олинган
                        </div>
                        <div className="font-semibold">
                          {formatAmount(userReport.upfrontTotal)}
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <div className="text-xs">Нақд</div>
                            <div className="font-semibold">
                              {formatAmount(userReport.upfrontCash || 0)}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs">Карта</div>
                            <div className="font-semibold">
                              {formatAmount(userReport.upfrontCard || 0)}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="p-3 rounded border bg-purple-50">
                        <div className="text-sm">Кредитдан тўланган</div>
                        <div className="text-xl font-bold">
                          {formatAmount(userReport.repaymentTotal || 0)}
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <div className="text-xs">Нақд</div>
                            <div className="font-semibold">
                              {formatAmount(
                                (userReport.repayments || [])
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
                                (userReport.repayments || [])
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
                            Number(userReport.cashTotal || 0) +
                            (userReport.repayments || [])
                              .filter(
                                (r) =>
                                  (r.channel || "CASH").toUpperCase() === "CASH"
                              )
                              .reduce((s, r) => s + Number(r.amount || 0), 0) +
                            Number(userReport.upfrontCash || 0) +
                            Math.max(0, userReport.defectivePlus) - Math.max(0, userReport.defectiveMinus)
                          )}
                        </div>
                        <div className="mt-2 text-xs text-gray-500">
                          <div>💡 Нақд сотувлар + Кредит тўловлар (нақд) + Олдиндан тўловлар (нақд) + Қайтариш тўловлар</div>
                          <div className="mt-1 text-blue-600">⚠️ Карта тўловлар топширадиган пулга қўшилмайди</div>
                          <div className="mt-1 text-green-600">✅ Кунлик + Ойлик тўловлар (нақд) қўшилади</div>
                        </div>
                      </div>
                    </div>

                    {Array.isArray(userReport.repayments) &&
                      userReport.repayments.length > 0 && (
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
                                {userReport.repayments.map((r, idx) => (
                                  <tr key={`user-repayment-${r.scheduleId || r.transactionId || r.paidAt || idx}-${idx}`} className="hover:bg-gray-50">
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
                            <th className="px-3 py-2 text-left"></th>

                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {(userReport.transactions || []).map((t) => (
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
                                    ? Number(t.amountPaid || 0)
                                    : Number(t.amountPaid || 0) + Number(t.downPayment || 0)
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
                              <td className="py-1 px-2 border">
                                <button
                                  onClick={() => {
                                    setSelectedTransactionItems(t);  // Bu yerda transaction -> t ga o'zgartirildi
                                    setShowDetails(true);
                                  }}
                                  className="text-blue-500 hover:text-blue-700"
                                  title="Tafsilotlarni ko'rish"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
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
                                (userReport.transactions || [])
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
                                (userReport.transactions || [])
                                  .filter(t => ['CREDIT', 'INSTALLMENT'].includes(t.paymentType))
                                  .reduce((sum, t) => sum + Number(t.amountPaid || 0), 0) +
                                (userReport.repaymentTotal || 0)
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
            </div>
          </div>
        )}

      </div>
      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
};

export default TransactionReport;
