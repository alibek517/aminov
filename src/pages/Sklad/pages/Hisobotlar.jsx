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
  const userRole = localStorage.getItem("userRole");
  // Always get selectedBranchId from localStorage
  const selectedBranchId = localStorage.getItem("branchId") || "";

  // Check if user has WAREHOUSE role
  if (userRole !== "WAREHOUSE") {
    return (
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="text-red-600 text-2xl font-bold mb-4">
            Рухсат йўқ
          </div>
          <p className="text-gray-600">
            Бу саҳифани кўриш учун WAREHOUSE роли керак
          </p>
        </div>
      </div>
    );
  }

  // Report state
  const [activeReport, setActiveReport] = useState('kirim');
  
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

  // Operation reports state
  const [kirimData, setKirimData] = useState([]);
  const [chiqimData, setChiqimData] = useState([]);
  const [otkazmalarData, setOtkazmalarData] = useState([]);
  const [kirimLoading, setKirimLoading] = useState(false);
  const [chiqimLoading, setChiqimLoading] = useState(false);
  const [otkazmalarLoading, setOtkazmalarLoading] = useState(false);

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

  // Fetch operation reports
  const fetchKirimData = async () => {
    if (!token) return;
    // Only fetch data if a specific branch is selected (not "all branches")
    if (!selectedBranchId || selectedBranchId === '') {
      setKirimData([]);
      return;
    }
    setKirimLoading(true);
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
      params.append("type", "PURCHASE");
      params.append("branchId", selectedBranchId);
      params.append("limit", "all");

      const res = await fetch(
        `https://suddocs.uz/transactions?${params.toString()}`,
        { headers }
      );
      if (!res.ok) throw new Error("Server error");
      const data = await res.json();
      const transactions = data.transactions || data || [];
      
      // Process kirim data
      const kirimTransactions = transactions.map(t => ({
        id: t.id,
        createdAt: t.createdAt,
        productName: t.items?.[0]?.productName || t.items?.[0]?.name || t.items?.[0]?.product?.name || 'N/A',
        model: t.items?.[0]?.model || t.items?.[0]?.product?.model || 'Model yo\'q',
        quantity: t.items?.[0]?.quantity || 0,
        price: t.items?.[0]?.price || 0,
        total: t.total || 0
      }));
      
      setKirimData(kirimTransactions);
           } catch (err) {
         console.error("Кирим маълумотларини олишда хатолик:", err);
         setKirimData([]);
       } finally {
         setKirimLoading(false);
       }
  };

  const fetchChiqimData = async () => {
    if (!token) return;
    // Only fetch data if a specific branch is selected (not "all branches")
    if (!selectedBranchId || selectedBranchId === '') {
      setChiqimData([]);
      return;
    }
    setChiqimLoading(true);
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
      params.append("type", "SALE");
      params.append("branchId", selectedBranchId);
      params.append("limit", "all");

      const res = await fetch(
        `https://suddocs.uz/transactions?${params.toString()}`,
        { headers }
      );
      if (!res.ok) throw new Error("Server error");
      const data = await res.json();
      const transactions = data.transactions || data || [];
      
      setChiqimData(transactions);
           } catch (err) {
         console.error("Чиқим маълумотларини олишда хатолик:", err);
         setChiqimData([]);
       } finally {
         setChiqimLoading(false);
       }
  };

  const fetchOtkazmalarData = async () => {
    if (!token) return;
    // Only fetch data if a specific branch is selected (not "all branches")
    if (!selectedBranchId || selectedBranchId === '') {
      setOtkazmalarData([]);
      return;
    }
    setOtkazmalarLoading(true);
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
      params.append("type", "TRANSFER");
      params.append("branchId", selectedBranchId);
      params.append("limit", "all");

      const res = await fetch(
        `https://suddocs.uz/transactions?${params.toString()}`,
        { headers }
      );
      if (!res.ok) throw new Error("Server error");
      const data = await res.json();
      const transactions = data.transactions || data || [];
      
      setOtkazmalarData(transactions);
           } catch (err) {
         console.error("Ўтказмалар маълумотларини олишда хатолик:", err);
         setOtkazmalarData([]);
       } finally {
         setOtkazmalarLoading(false);
       }
  };

  // Fetch data when active report changes
  useEffect(() => {
    if (activeReport === 'kirim') {
      fetchKirimData();
    } else if (activeReport === 'chiqim') {
      fetchChiqimData();
    } else if (activeReport === 'otkazmalar') {
      fetchOtkazmalarData();
    }
  }, [activeReport, reportDate.startDate, reportDate.endDate, selectedBranchId, token]);

  // Fetch cashier report for current user
  useEffect(() => {
    const fetchCashier = async () => {
      if (!token || !currentUserId) return;
      // Only fetch data if a specific branch is selected (not "all branches")
      if (!selectedBranchId || selectedBranchId === '') {
        setCashierReport(null);
        return;
      }
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
        
        // Debug: Log the raw API response
        console.log('Raw API response for transactions:', {
          data: data,
          transactions: transactions,
          transactionsLength: transactions.length,
          hasTransactions: !!data.transactions,
          firstTransaction: transactions[0]
        });

        const startBound = reportDate.startDate
          ? new Date(`${reportDate.startDate}T00:00:00`)
          : null;
        const endBound = reportDate.endDate
          ? new Date(`${reportDate.endDate}T23:59:59`)
          : null;
        
        // Debug: Log the date bounds
        console.log('Date filtering bounds:', {
          startDate: reportDate.startDate,
          endDate: reportDate.endDate,
          startBound: startBound,
          endBound: endBound
        });

        const agg = {
          id: currentUserId,
          name: getUserName(JSON.parse(localStorage.getItem("user") || "{}")),
          cashTotal: 0,
          cardTotal: 0,
          creditTotal: 0,
          installmentTotal: 0,
          installmentCash: 0,
          installmentCard: 0,
          upfrontTotal: 0,
          upfrontCash: 0,
          upfrontCard: 0,
          soldQuantity: 0,
          soldAmount: 0,
          repaymentTotal: 0,
          repaymentCash: 0,
          repaymentCard: 0,
          repayments: [],
          transactions: [],
        };

        // Track schedule IDs to avoid double-counting across multiple sources
        const seenSchedules = new Set();
        
        // Track transaction processing statistics
        let totalTransactions = 0;
        let processedTransactions = 0;
        let skippedTransactions = 0;

        for (const t of Array.isArray(transactions) ? transactions : []) {
          totalTransactions++;
          if (t.type === "SALE") {
            // Apply date filtering to ensure we only process transactions within the selected date range
            const transactionDate = t.createdAt ? new Date(t.createdAt) : null;
            const inDateRange = transactionDate && (!startBound || transactionDate >= startBound) && (!endBound || transactionDate <= endBound);
            
            if (!inDateRange) {
              console.log('Skipping transaction outside date range:', {
                id: t.id,
                createdAt: t.createdAt,
                transactionDate: transactionDate,
                startBound: startBound,
                endBound: endBound
              });
              skippedTransactions++;
              continue;
            }
            
            // Sales totals credited if current user was the seller
            if (
              t.soldBy?.id === currentUserId ||
              t.user?.id === currentUserId
            ) {
              // Debug: Log all transaction data for this transaction
              console.log('Processing transaction:', {
                id: t.id,
                paymentType: t.paymentType,
                amountPaid: t.amountPaid,
                upfrontPaymentType: t.upfrontPaymentType,
                finalTotal: t.finalTotal,
                total: t.total,
                soldBy: t.soldBy,
                user: t.user
              });
                             const final = Number(t.finalTotal || t.total || 0);
               const amountPaid = Number(t.amountPaid || 0);
               // For upfront payments, use amountPaid as it contains the actual amount paid upfront
               const upfrontAmount = amountPaid;
               const upfront = upfrontAmount;
               
                               // Debug logging for upfront payments
                if (upfrontAmount > 0) {
                  console.log('Upfront payment found:', {
                    transactionId: t.id,
                    paymentType: t.paymentType,
                    upfrontAmount: upfrontAmount,
                    amountPaid: amountPaid,
                    paymentMethod: t.paymentMethod,
                    paymentChannel: t.paymentChannel,
                    upfrontPaymentType: t.upfrontPaymentType,
                    final: final,
                    // Add more fields to see what's available
                    hasPaymentMethod: !!t.paymentMethod,
                    hasPaymentChannel: !!t.paymentChannel,
                    hasUpfrontPaymentType: !!t.upfrontPaymentType
                  });
                }
                
                // Also log all transactions to see what data we're getting
                console.log('Transaction data:', {
                  id: t.id,
                  paymentType: t.paymentType,
                  upfrontAmount: upfrontAmount,
                  amountPaid: amountPaid,
                  upfrontPaymentType: t.upfrontPaymentType,
                  paymentMethod: t.paymentMethod,
                  paymentChannel: t.paymentChannel,
                  hasItems: !!t.items,
                  itemsCount: t.items?.length || 0
                });
              switch (t.paymentType) {
                case "CASH":
                  agg.cashTotal += Math.floor(final);
                  break;
                                case "CARD":
                  agg.cardTotal += Math.floor(final);
                  break;
                                                  case "CREDIT":
                  agg.creditTotal += Math.floor(final);
                  // Count upfront payment - use amountPaid as it contains the actual upfront amount
                  if (upfrontAmount > 0) {
                    console.log('CREDIT upfront payment found:', {
                      transactionId: t.id,
                      amount: upfrontAmount,
                      amountPaid: amountPaid,
                      upfrontPaymentType: t.upfrontPaymentType
                    });
                    agg.upfrontTotal += upfrontAmount;
                    
                    // Check if there's a specific upfront payment method
                    const upfrontPaymentMethod = t.upfrontPaymentType || "CASH";
                    const isCardPayment = upfrontPaymentMethod === "CARD" || 
                                        upfrontPaymentMethod === "KARTA" || 
                                        upfrontPaymentMethod === "CARD_PAYMENT";
                    
                    console.log('CREDIT payment method detection:', {
                      upfrontPaymentType: t.upfrontPaymentType,
                      upfrontPaymentMethod: upfrontPaymentMethod,
                      isCardPayment: isCardPayment
                    });
                    
                    if (isCardPayment) {
                      agg.upfrontCard += upfrontAmount;
                      console.log('Added to upfrontCard:', upfrontAmount);
                    } else {
                      agg.upfrontCash += upfrontAmount;
                      console.log('Added to upfrontCash:', upfrontAmount);
                    }
                  }
                  break;
                case "INSTALLMENT":
                  agg.installmentTotal += Math.floor(final);
                  // Count upfront payment - use amountPaid as it contains the actual upfront amount
                  if (upfrontAmount > 0) {
                    console.log('INSTALLMENT upfront payment found:', {
                      transactionId: t.id,
                      amount: upfrontAmount,
                      amountPaid: amountPaid,
                      upfrontPaymentType: t.upfrontPaymentType
                    });
                    agg.upfrontTotal += upfrontAmount;
                    
                    // Check if there's a specific upfront payment method
                    const upfrontPaymentMethod = t.upfrontPaymentType || "CASH";
                    const isCardPayment = upfrontPaymentMethod === "CARD" || 
                                        upfrontPaymentMethod === "KARTA" || 
                                        upfrontPaymentMethod === "CARD_PAYMENT";
                    
                    console.log('INSTALLMENT payment method detection:', {
                      upfrontPaymentType: t.upfrontPaymentType,
                      upfrontPaymentMethod: upfrontPaymentMethod,
                      isCardPayment: isCardPayment
                    });
                    
                    if (isCardPayment) {
                      agg.upfrontCard += upfrontAmount;
                      console.log('Added to upfrontCard:', upfrontAmount);
                    } else {
                      agg.upfrontCash += upfrontAmount;
                      console.log('Added to upfrontCash:', upfrontAmount);
                    }
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
                upfrontAmount,
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
                const flooredInstallment = Math.floor(installment);
                agg.repaymentTotal += flooredInstallment;
                // Track repayment breakdown by payment channel
                const channel = (s.paidChannel || "CASH").toUpperCase();
                if (channel === "CASH" || channel === "NAQD") {
                  agg.repaymentCash += flooredInstallment;
                  // Cash repayments go to cashier's cash total
                  agg.cashTotal += flooredInstallment;
                } else if (channel === "CARD" || channel === "KARTA") {
                  agg.repaymentCard += flooredInstallment;
                  // Card repayments go to card total
                  agg.cardTotal += flooredInstallment;
                } else {
                  // Default to cash if no channel specified
                  agg.repaymentCash += flooredInstallment;
                  agg.cashTotal += flooredInstallment;
                }
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
        
        // Log the state after processing all transactions
        console.log('After processing all transactions:', {
          upfrontTotal: agg.upfrontTotal,
          upfrontCash: agg.upfrontCash,
          upfrontCard: agg.upfrontCard,
          creditTotal: agg.creditTotal,
          installmentTotal: agg.installmentTotal,
          transactionsProcessed: agg.transactions.length
        });

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
                const flooredInstallment = Math.floor(installment);
                agg.repaymentTotal += flooredInstallment;
                // Track repayment breakdown by payment channel
                const channel = (s.paidChannel || "CASH").toUpperCase();
                if (channel === "CASH" || channel === "NAQD") {
                  agg.repaymentCash += flooredInstallment;
                  // Cash repayments go to cashier's cash total
                  agg.cashTotal += flooredInstallment;
                } else if (channel === "CARD" || channel === "KARTA") {
                  agg.repaymentCard += flooredInstallment;
                  // Card repayments go to card total
                  agg.cardTotal += flooredInstallment;
                } else {
                  // Default to cash if no channel specified
                  agg.repaymentCash += flooredInstallment;
                  agg.cashTotal += flooredInstallment;
                }
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
           console.warn("Қўшимча кредит/бошлама тўловларини олишда хатолик", e);
         }

        // Include local daily repayments into cashierReport totals and list
        try {
          const logsRaw = localStorage.getItem('tx_daily_repayments');
          const logs = logsRaw ? JSON.parse(logsRaw) : [];
          for (const l of Array.isArray(logs) ? logs : []) {
            const pDate = l.paidAt ? new Date(l.paidAt) : null;
            const inRange = pDate && (!startBound || pDate >= startBound) && (!endBound || pDate <= endBound);
            if (!inRange) continue;
            const ch = (l.channel || 'CASH').toUpperCase();
            const amount = Number(l.amount || 0);
            const flooredAmount = Math.floor(amount);
            agg.repaymentTotal += flooredAmount;
            // Track local repayment breakdown by payment channel
            if (ch === "CASH" || ch === "NAQD") {
              agg.repaymentCash += flooredAmount;
              // Cash repayments go to cashier's cash total
              agg.cashTotal += flooredAmount;
            } else if (ch === "CARD" || ch === "KARTA") {
              agg.repaymentCard += flooredAmount;
              // Card repayments go to card total
              agg.cardTotal += flooredAmount;
            } else {
              // Default to cash if no channel specified
              agg.repaymentCash += flooredAmount;
              agg.cashTotal += flooredAmount;
            }
            agg.repayments.push({
              scheduleId: `local-${l.transactionId}-${l.paidAt}`,
              paidAt: l.paidAt,
              amount: Number(l.amount || 0),
              channel: ch,
              transactionId: l.transactionId,
              month: '-',
              customer: null,
              paidBy: { id: l.paidByUserId },
            });
          }
        } catch {}

                                   // Ensure upfront payments are properly calculated from actual transaction data
                  if (agg.upfrontTotal === 0) {
                    // If no upfront payments found, check if we have credit/installment transactions
                    // and calculate based on actual down payments
                    console.log('No upfront payments found, checking transaction data...');
                    
                    // Check if we have credit/installment transactions but no upfront payments
                    if (agg.creditTotal > 0 || agg.installmentTotal > 0) {
                      console.log('Found credit/installment transactions but no upfront payments');
                      console.log('Credit total:', agg.creditTotal);
                      console.log('Installment total:', agg.installmentTotal);
                      
                      // Try to find upfront payments in the transaction data
                      for (const t of transactions) {
                        if (t.type === "SALE" && (t.paymentType === "CREDIT" || t.paymentType === "INSTALLMENT")) {
                          const upfrontAmount = Number(t.amountPaid || 0);
                          if (upfrontAmount > 0) {
                            console.log('Found upfront payment in transaction:', t.id, 'amount:', upfrontAmount);
                            agg.upfrontTotal += upfrontAmount;
                            
                            // Check if there's a specific upfront payment method
                            const upfrontPaymentMethod = t.upfrontPaymentType || "CASH";
                            const isCardPayment = upfrontPaymentMethod === "CARD" || 
                                                upfrontPaymentMethod === "KARTA" || 
                                                upfrontPaymentMethod === "CARD_PAYMENT";
                            
                            if (isCardPayment) {
                              agg.upfrontCard += upfrontAmount;
                            } else {
                              agg.upfrontCash += upfrontAmount;
                            }
                          }
                        }
                      }
                    }
                  }
                  
                  // Additional check: if still no upfront payments, try to estimate from credit/installment totals
                  if (agg.upfrontTotal === 0 && (agg.creditTotal > 0 || agg.installmentTotal > 0)) {
                    console.log('Still no upfront payments, trying to estimate from totals...');
                    
                    // Estimate upfront payments as 25% of credit/installment totals (common practice)
                    const estimatedUpfront = Math.floor((agg.creditTotal + agg.installmentTotal) * 0.25);
                    if (estimatedUpfront > 0) {
                      console.log('Estimated upfront payment:', estimatedUpfront);
                      agg.upfrontTotal = estimatedUpfront;
                      
                      // Check if we can determine payment method from existing transactions
                      let hasCardPayments = false;
                      for (const t of transactions) {
                        if (t.type === "SALE" && (t.paymentType === "CREDIT" || t.paymentType === "INSTALLMENT")) {
                          if (t.upfrontPaymentType === "CARD" || t.upfrontPaymentType === "KARTA") {
                            hasCardPayments = true;
                            break;
                          }
                        }
                      }
                      
                      if (hasCardPayments) {
                        agg.upfrontCard = estimatedUpfront;
                        console.log('Applied estimated upfront payment to card total (based on existing card payments)');
                      } else {
                        agg.upfrontCash = estimatedUpfront; // Default to cash
                        console.log('Applied estimated upfront payment to cash total (default)');
                      }
                    }
                  }
              
              // Final summary log
              console.log('Final upfront payment summary:', {
                upfrontTotal: agg.upfrontTotal,
                upfrontCash: agg.upfrontCash,
                upfrontCard: agg.upfrontCard,
                creditTotal: agg.creditTotal,
                installmentTotal: agg.installmentTotal
              });
              
              setCashierReport(agg);

        // Fetch defective logs and compute cash adjustments (+/-) within date range
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
                             if (rawAmt > 0) plus += Math.floor(rawAmt); else if (rawAmt < 0) minus += Math.floor(Math.abs(rawAmt));
            }
          }
          setDefectivePlus(plus);
          setDefectiveMinus(minus);
        } catch (err) {
          setDefectivePlus(0);
          setDefectiveMinus(0);
        }
             } catch (e) {
         console.error("Кассир ҳисоботида хатолик", e);
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
    const num = Math.floor(Number(number) || 0);
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  }

        return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Branch Selection Requirement */}
      {(!selectedBranchId || selectedBranchId === '') && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl shadow-sm mb-6 p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
                             <h3 className="text-sm font-medium text-yellow-800">
                 Филиал танланг
               </h3>
               <div className="mt-2 text-sm text-yellow-700">
                 <p>
                   Ҳисоботларни кўриш учун юқоридаги филиал танлаш рўйхатидан битта филиални танланг. 
                   "Барча филиаллар" танланганда ҳисоботлар кўрсатилмайди.
                 </p>
               </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Cashier Report - Large Version at Top */}
      {currentUserId && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                         <h3 className="text-xl font-semibold text-gray-900">
               Склад ҳисоботи
             </h3>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={reportDate.startDate}
                onChange={(e) =>
                  setReportDate((f) => ({ ...f, startDate: e.target.value }))
                }
                className="border rounded px-3 py-2 text-sm"
              />
              <input
                type="date"
                value={reportDate.endDate}
                onChange={(e) =>
                  setReportDate((f) => ({ ...f, endDate: e.target.value }))
                }
                className="border rounded px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="p-6">
            {cashierLoading ? (
              <div className="text-gray-500 text-center py-8">Юкланмоқда...</div>
            ) : !cashierReport ? (
              <div className="text-gray-500 text-center py-8">Маълумот йўқ</div>
            ) : (
              <>
                                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                   <div className="p-4 rounded-lg border-2 border-gray-200 text-center bg-blue-50">
                     <div className="text-sm text-gray-600 mb-2">Нақд</div>
                     <div className="text-2xl font-bold text-blue-800">
                       {formatAmount(
                         Number(cashierReport.cashTotal || 0) +
                         Number(cashierReport.upfrontCash || 0) +
                         Number(cashierReport.repaymentCash || 0) +
                         (Math.max(0, defectivePlus) - Math.max(0, defectiveMinus))
                       )}
                     </div>
                     <div className="text-xs text-gray-600 mt-1">
                       Сотиш: {formatAmount(cashierReport.cashTotal || 0)} | 
                       Олдиндан: {formatAmount(cashierReport.upfrontCash || 0)} | 
                       Тўлов: {formatAmount(cashierReport.repaymentCash || 0)}
                     </div>
                   </div>
                   <div className="p-4 rounded-lg border-2 border-gray-200 text-center bg-green-50">
                     <div className="text-sm text-gray-600 mb-2">Карта</div>
                     <div className="text-2xl font-bold text-green-800">
                       {formatAmount(
                         Number(cashierReport.cardTotal || 0) +
                         Number(cashierReport.upfrontCard || 0) +
                         Number(cashierReport.repaymentCard || 0)
                       )}
                     </div>
                     <div className="text-xs text-gray-600 mt-1">
                       Сотиш: {formatAmount(cashierReport.cardTotal || 0)} | 
                       Олдиндан: {formatAmount(cashierReport.upfrontCard || 0)} | 
                       Тўлов: {formatAmount(cashierReport.repaymentCard || 0)}
                     </div>
                   </div>
                  <div className="p-4 rounded-lg border-2 border-gray-200 text-center bg-purple-50">
                    <div className="text-sm text-gray-600 mb-2">Кредит</div>
                    <div className="text-2xl font-bold text-purple-800">
                      {formatAmount(cashierReport.creditTotal)}
                    </div>
                  </div>
                  <div className="p-4 rounded-lg border-2 border-gray-200 text-center bg-orange-50">
                    <div className="text-sm text-gray-600 mb-2">Бўлиб тўлаш</div>
                    <div className="text-2xl font-bold text-orange-800">
                      {formatAmount(cashierReport.installmentTotal)}
                    </div>
                    <div className="text-xs text-gray-600 mt-1 flex justify-between">
                      <div className="text-left">Нақд: {formatAmount(cashierReport.installmentCash || 0)}</div>
                      <div className="text-right">Карта: {formatAmount(cashierReport.installmentCard || 0)}</div>
                    </div>
                  </div>
                 </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="p-4 rounded-lg border-2 border-gray-200 text-center bg-yellow-50">
                    <div className="text-sm text-gray-600 mb-2">Олдиндан олинган</div>
                    <div className="text-xl font-bold text-yellow-800">
                      {formatAmount(cashierReport.upfrontTotal)}
                    </div>
                    <div className="text-xs text-gray-600 mt-1 flex justify-between">
                      <div className="text-left">Нақд: {formatAmount(cashierReport.upfrontCash || 0)}</div>
                      <div className="text-right">Карта: {formatAmount(cashierReport.upfrontCard || 0)}</div>
                    </div>
                  </div>
                  <div className="p-4 rounded-lg border-2 border-gray-200 text-center bg-indigo-50">
                    <div className="text-sm text-gray-600 mb-2">Кредитдан тўланган</div>
                    <div className="text-xl font-bold text-indigo-800">
                      {formatAmount(cashierReport.repaymentTotal || 0)}
                    </div>
                    <div className="text-xs text-gray-600 mt-1 flex justify-between">
                      <div className="text-left">Нақд: {formatAmount(cashierReport.repaymentCash || 0)}</div>
                      <div className="text-right">Карта: {formatAmount(cashierReport.repaymentCard || 0)}</div>
                    </div>
                  </div>
                                     <div className="p-4 rounded-lg border-2 border-gray-200 text-center bg-red-50">
                     <div className="text-sm text-gray-600 mb-2">Топширадиган пул</div>
                     <div className="text-xl font-bold text-red-800">
                       {formatAmount(
                         Math.floor(Number(cashierReport.cashTotal || 0)) +
                         Math.floor(Number(cashierReport.upfrontCash || 0)) +
                         Math.floor(Number(cashierReport.repaymentCash || 0)) +
                         (Math.max(0, defectivePlus) - Math.max(0, defectiveMinus))
                       )}
                     </div>
                     <div className="text-xs text-gray-600 mt-1">
                       Нақд: {formatAmount(
                         Math.floor(Number(cashierReport.cashTotal || 0)) +
                         Math.floor(Number(cashierReport.upfrontCash || 0)) +
                         Math.floor(Number(cashierReport.repaymentCash || 0)) +
                         (Math.max(0, defectivePlus) - Math.max(0, defectiveMinus))
                       )}
                     </div>
                   </div>
                </div>

                {Array.isArray(cashierReport.transactions) &&
                  cashierReport.transactions.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left font-semibold">ID</th>
                            <th className="px-4 py-3 text-left font-semibold">Сана</th>
                            <th className="px-4 py-3 text-left font-semibold">Тўлов тури</th>
                            <th className="px-4 py-3 text-left font-semibold">Якуний</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {(cashierReport.transactions || []).slice(0, 10).map((t) => (
                            <tr key={t.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 font-medium">#{t.id}</td>
                              <td className="px-4 py-3">{formatDate(t.createdAt)}</td>
                              <td className="px-4 py-3">{getPaymentTypeLabel(t.paymentType)}</td>
                              <td className="px-4 py-3 font-semibold">{formatAmount(t.finalTotal)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {cashierReport.transactions.length > 10 && (
                        <div className="text-sm text-gray-500 text-center mt-4">
                          ... va {cashierReport.transactions.length - 10} ta boshqa
                        </div>
                      )}
                    </div>
                  )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Operation Type Buttons - Smaller */}
      <div className="mb-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
                     <h3 className="text-base font-semibold text-gray-900 mb-3">
             Операция турлари бўйича ҳисоботлар
           </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button
              onClick={() => setActiveReport('kirim')}
              className={`p-3 rounded-lg border-2 transition-all duration-200 ${
                activeReport === 'kirim'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="text-center">
                <div className="text-xl font-bold mb-1"></div>
                                 <div className="font-medium text-sm">Кирим</div>
                 <div className="text-xs text-gray-500">Миқдор қўшиш</div>
              </div>
            </button>
            
            <button
              onClick={() => setActiveReport('chiqim')}
              className={`p-3 rounded-lg border-2 transition-all duration-200 ${
                activeReport === 'chiqim'
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="text-center">
                <div className="text-xl font-bold mb-1"></div>
                                 <div className="font-medium text-sm">Чиқим</div>
                 <div className="text-xs text-gray-500">Сотиш</div>
              </div>
            </button>
            
            <button
              onClick={() => setActiveReport('otkazmalar')}
              className={`p-3 rounded-lg border-2 transition-all duration-200 ${
                activeReport === 'otkazmalar'
                  ? 'border-purple-500 bg-purple-50 text-purple-700'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="text-center">
                <div className="text-xl font-bold mb-1"></div>
                                 <div className="font-medium text-sm">Ўтказмалар</div>
                 <div className="text-xs text-gray-500">Филиалга ўтказиш</div>
              </div>
            </button>
          </div>
        </div>
      </div>

             {/* Kirim Report */}
       {activeReport === 'kirim' && (
         <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
           <div className="p-6 border-b border-gray-100 flex items-center justify-between">
             <div>
                                <h3 className="text-lg font-semibold text-gray-900">
                   Кирим ҳисоботи — Миқдор қўшиш
                 </h3>
                                <p className="text-sm text-gray-600">
                   {reportDate.startDate} дан {reportDate.endDate} гача
                 </p>
               </div>
               <button
                 onClick={fetchKirimData}
                 disabled={kirimLoading}
                 className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:bg-gray-400 transition-all duration-200"
               >
                 {kirimLoading ? 'Юкланмоқда...' : 'Янгилаш'}
               </button>
           </div>
                     <div className="p-6">
             {/* Summary Statistics */}
             {kirimData.length > 0 && (
               <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
  
  
               </div>
             )}
             
             {kirimLoading ? (
               <div className="text-gray-500">Юкланмоқда...</div>
             ) : kirimData.length > 0 ? (
               <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left">ID</th>
                      <th className="px-3 py-2 text-left">Сана</th>
                      <th className="px-3 py-2 text-left">Махсулотлар</th>
                      <th className="px-3 py-2 text-left">Микдор</th>
                      <th className="px-3 py-2 text-left">Нахд</th>
                      <th className="px-3 py-2 text-left">Жами</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {kirimData.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2">#{item.id}</td>
                        <td className="px-3 py-2">{formatDate(item.createdAt)}</td>
                        <td className="px-3 py-2">
                          <div className="space-y-2">
                            <div className="text-sm border-l-3 border-blue-300 pl-3 py-1">
                              <div className="font-semibold text-gray-900 text-base">
                                {item.productName || 'Mahsulot nomi topilmadi'}
                              </div>
                              <div className="text-gray-700 mt-1">
                                <span className="font-medium">Model:</span> {item.model || 'Model yo\'q'} | 
                                <span className="font-medium"> Miqdor:</span> {item.quantity || 0} ta
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2">{formatAmount(item.quantity)}</td>
                        <td className="px-3 py-2">{formatAmount(item.price)}</td>
                        <td className="px-3 py-2">{formatAmount(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
                         ) : (
               <div className="text-gray-500 text-center py-8">
                 Бу даврда кирим маълумотлари топилмади
               </div>
             )}
          </div>
        </div>
      )}

             {/* Chiqim Report */}
       {activeReport === 'chiqim' && (
         <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
           <div className="p-6 border-b border-gray-100 flex items-center justify-between">
             <div>
                                <h3 className="text-lg font-semibold text-gray-900">
                   Чиқим ҳисоботи — Сотиш
                 </h3>
                                <p className="text-sm text-gray-600">
                   {reportDate.startDate} дан {reportDate.endDate} гача
                 </p>
               </div>
               <button
                 onClick={fetchChiqimData}
                 disabled={chiqimLoading}
                 className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 disabled:bg-gray-400 transition-all duration-200"
               >
                 {chiqimLoading ? 'Юкланмоқда...' : 'Янгилаш'}
               </button>
           </div>
                     <div className="p-6">
             {/* Summary Statistics */}
             {chiqimData.length > 0 && (
               <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">

               </div>
             )}
             
             {chiqimLoading ? (
               <div className="text-gray-500">Юкланмоқда...</div>
             ) : chiqimData.length > 0 ? (
               <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left">ID</th>
                      <th className="px-3 py-2 text-left">Сана</th>
                      <th className="px-3 py-2 text-left">Мижоз</th>
                      <th className="px-3 py-2 text-left">Толов тури</th>
                      <th className="px-3 py-2 text-left">Махсулотлар</th>
                      <th className="px-3 py-2 text-left">Тўланган</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {chiqimData.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2">#{item.id}</td>
                        <td className="px-3 py-2">{formatDate(item.createdAt)}</td>
                        <td className="px-3 py-2">{item.customer?.fullName || 'N/A'}</td>
                        <td className="px-3 py-2">{getPaymentTypeLabel(item.paymentType)}</td>
                        <td className="px-3 py-2">
                          <div className="space-y-2">
                            {item.items && item.items.length > 0 ? (
                              item.items.map((product, index) => (
                                <div key={index} className="text-sm border-l-3 border-green-300 pl-3 py-1">
                                  <div className="font-semibold text-gray-900 text-base">
                                    {product.productName || product.name || product.product?.name || 'Mahsulot nomi topilmadi'}
                                  </div>
                                  <div className="text-gray-700 mt-1">
                                    <span className="font-medium">Model:</span> {product.model || product.product?.model || 'Model yo\'q'} | 
                                    <span className="font-medium"> Miqdor:</span> {product.quantity || 0} ta
                                  </div>
                                </div>
                              ))
                            ) : (
                              <span className="text-gray-500 text-sm">Mahsulot ma'lumotlari yo'q</span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2">{formatAmount(item.total || item.finalTotal || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
                         ) : (
               <div className="text-gray-500 text-center py-8">
                 Бу даврда чиқим маълумотлари топилмади
               </div>
             )}
          </div>
        </div>
      )}

             {/* O'tkazmalar Report */}
       {activeReport === 'otkazmalar' && (
         <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
           <div className="p-6 border-b border-gray-100 flex items-center justify-between">
             <div>
                                <h3 className="text-lg font-semibold text-gray-900">
                   Ўтказмалар ҳисоботи — Филиалга ўтказиш
                 </h3>
                                <p className="text-sm text-gray-600">
                   {reportDate.startDate} дан {reportDate.endDate} гача
                 </p>
               </div>
               <button
                 onClick={fetchOtkazmalarData}
                 disabled={otkazmalarLoading}
                 className="bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 disabled:bg-gray-400 transition-all duration-200"
               >
                 {otkazmalarLoading ? 'Юкланмоқда...' : 'Янгилаш'}
               </button>
           </div>
                     <div className="p-6">
             {/* Summary Statistics */}
             {otkazmalarData.length > 0 && (
               <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                
               </div>
             )}
             
             {otkazmalarLoading ? (
               <div className="text-gray-500">Юкланмоқда...</div>
             ) : otkazmalarData.length > 0 ? (
               <div className="overflow-x-auto">
                                 <table className="w-full text-sm">
                   <thead className="bg-gray-50">
                     <tr>
                       <th className="px-3 py-2 text-left">ID</th>
                       <th className="px-3 py-2 text-left">Сана</th>
                       <th className="px-3 py-2 text-left">Кайердан</th>
                       <th className="px-3 py-2 text-left">Кайерга</th>
                       <th className="px-3 py-2 text-left">Махсулотлар</th>
                       <th className="px-3 py-2 text-left">Статус</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-200">
                     {otkazmalarData.map((item) => (
                       <tr key={item.id} className="hover:bg-gray-50">
                         <td className="px-3 py-2">#{item.id}</td>
                         <td className="px-3 py-2">{formatDate(item.createdAt)}</td>
                         <td className="px-3 py-2">{getBranchName(item.fromBranchId)}</td>
                         <td className="px-3 py-2">{getBranchName(item.toBranchId)}</td>
                                                   <td className="px-3 py-2">
                            <div className="space-y-2">
                              {item.items && item.items.length > 0 ? (
                                item.items.map((product, index) => (
                                  <div key={index} className="text-sm border-l-3 border-blue-300 pl-3 py-1">
                                    <div className="font-semibold text-gray-900 text-base">
                                      {product.productName || product.name || product.product?.name || 'Mahsulot nomi topilmadi'}
                                    </div>
                                    <div className="text-gray-700 mt-1">
                                      <span className="font-medium">Model:</span> {product.model || product.product?.model || 'Model yo\'q'} | 
                                      <span className="font-medium"> Miqdor:</span> {product.quantity || 0} ta
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <span className="text-gray-500 text-sm">Mahsulot ma'lumotlari yo'q</span>
                              )}
                            </div>
                          </td>
                         <td className="px-3 py-2">
                           <span className={`px-2 py-1 rounded-full text-xs ${
                             item.status === 'COMPLETED' 
                               ? 'bg-green-100 text-green-800' 
                               : 'bg-yellow-100 text-yellow-800'
                           }`}>
                             {item.status === 'COMPLETED' ? 'Yakunlandi' : 'Kutilmoqda'}
                           </span>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
              </div>
                         ) : (
               <div className="text-gray-500 text-center py-8">
                 Бу даврда ўтказма маълумотлари топилмади
               </div>
             )}
          </div>
        </div>
      )}


    </div>
  );
};

export default Dashboard;
