import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
// XLSX kutubxonasini build vaqtida muammo bermasligi uchun dinamik import qilamiz
import { AlertCircle, Loader2, Calendar, TrendingUp, Download, BarChart3, DollarSign, Package, ArrowRightLeft } from 'lucide-react';

const Notification = ({ message, type, onClose }) => (
  <div className={`p-4 rounded-lg flex items-center gap-3 mb-4 ${
    type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' :
    type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' :
    'bg-blue-50 text-blue-700 border border-blue-200'
  }`}>
    <AlertCircle size={20} />
    <span className="flex-1">{message}</span>
    <button className="text-sm underline hover:no-underline transition-all" onClick={onClose}>Yopish</button>
  </div>
);

const Hisobotlar = () => {
  const [reportData, setReportData] = useState({
    purchases: [],
    sales: [],
    transfers: [],
    outflows: [],
    statistics: {}
  });
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [selectedReportType, setSelectedReportType] = useState('all');
  const API_URL = 'https://suddocs.uz';

  const formatCurrency = (amount) =>
    (amount !== null && amount !== undefined && !Number.isNaN(Number(amount)))
      ? new Intl.NumberFormat('uz-UZ').format(Number(amount)) + " so'm"
      : "0 so'm";

  const formatQuantity = (qty) => {
    if (qty === null || qty === undefined || qty === '') return "0 dona";
    const n = Number(qty);
    return !Number.isNaN(n) ? new Intl.NumberFormat('uz-UZ').format(n) + ' dona' : '0 dona';
  };

  const formatDate = (date) => {
    if (!date) return "Noma'lum";
    try {
      return new Date(date).toLocaleDateString('uz-UZ');
    } catch {
      return "Noma'lum";
    }
  };

  const axiosWithAuth = async (config) => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      setNotification({ message: 'Sessiya topilmadi, iltimos tizimga kiring', type: 'error' });
      setTimeout(() => window.location.href = '/login', 2000);
      throw new Error('No token found');
    }
    const headers = {
      ...config.headers,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    try {
      return await axios({ ...config, headers });
    } catch (error) {
      if (error.response?.status === 401) {
        setNotification({ message: 'Sessiya tugadi, iltimos qayta kiring', type: 'error' });
        localStorage.clear();
        setTimeout(() => window.location.href = '/login', 2000);
        throw new Error('Session expired');
      }
      throw error;
    }
  };

  useEffect(() => {
    // BranchId ni localStorage dan olish
    const branchId = localStorage.getItem('branchId');
    if (branchId) {
      setSelectedBranchId(branchId);
    }
    
    const fetchBranches = async () => {
      try {
        const res = await axiosWithAuth({ method: 'get', url: `${API_URL}/branches` });
        const branchesData = Array.isArray(res.data) ? res.data : res.data.branches || [];
        setBranches(branchesData);
        
        // Agar localStorage da branchId yo'q bo'lsa, birinchi filialni tanlash
        if (!branchId && branchesData.length > 0) {
          setSelectedBranchId(branchesData[0].id.toString());
        }
      } catch (err) {
        setNotification({ message: err.message || 'Filiallar yuklashda xatolik', type: 'error' });
      }
    };
    fetchBranches();
  }, []);

  // selectedBranchId o'zgarganda transactionlarni yuklash
  useEffect(() => {
    if (selectedBranchId && branches.length > 0) {
      loadTransactions();
    }
  }, [selectedBranchId, branches]);

  const getDateRange = () => {
    const today = new Date();
    const endDate = new Date(today);
    let startDate;
    switch (selectedPeriod) {
      case 'week': startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000); break;
      case 'month': startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000); break;
      case 'quarter': startDate = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000); break;
      case 'year': startDate = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000); break;
      default: startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    };
  };

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    setNotification(null);

    if (!selectedBranchId) {
      setNotification({ message: 'Iltimos, filialni tanlang', type: 'error' });
      setLoading(false);
      return;
    }

    try {
      const { startDate, endDate } = getDateRange();

      // Oddiy branchId orqali transactionlarni yuklash
      const transactionsRes = await axiosWithAuth({
        method: 'get',
        url: `${API_URL}/transactions?branchId=${selectedBranchId}&startDate=${startDate}&endDate=${endDate}&limit=all`,
        timeout: 30000
      });
      const statsRes = await axiosWithAuth({
        method: 'get',
        url: `${API_URL}/transactions/statistics?branchId=${selectedBranchId}&startDate=${startDate}&endDate=${endDate}`,
        timeout: 30000
      });

            // Backend dan kelgan ma'lumotlarni to'g'ri parse qilish
      let transactions = [];
      if (transactionsRes.data && transactionsRes.data.transactions) {
        transactions = transactionsRes.data.transactions;
      } else if (Array.isArray(transactionsRes.data)) {
        transactions = transactionsRes.data;
      }
      

      
      const statistics = statsRes.data || {};

      // Transactionlarni turiga qarab ajratish
      const purchases = [];
      const sales = [];
      const transfers = [];

      for (const transaction of transactions) {
        const items = transaction.items || [];
        
        for (const item of items) {
          const product = item.product || {};
          const baseData = {
            id: transaction.id,
            transactionDate: transaction.createdAt,
            productName: product.name || `Mahsulot ${item.productId}`,
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
            total: item.total,
            status: transaction.status,
            paymentType: transaction.paymentType,
            customerName: transaction.customer ? transaction.customer.fullName : null,
            description: transaction.description
          };

          // Transaction turiga qarab ajratish
          if (transaction.type === 'PURCHASE') {
            // Kirim - faqat fromBranchId = selectedBranchId bo'lganda
            if (transaction.fromBranchId?.toString() === selectedBranchId) {
              purchases.push({
                ...baseData,
                type: 'Kirim',
                branchName: branches.find(b => b.id === transaction.fromBranchId)?.name || 'Noma\'lum'
              });
            }
          } else if (transaction.type === 'SALE') {
            // Chiqim - faqat fromBranchId = selectedBranchId bo'lganda
            if (transaction.fromBranchId?.toString() === selectedBranchId) {
              sales.push({
                ...baseData,
                type: 'Chiqim',
                branchName: branches.find(b => b.id === transaction.fromBranchId)?.name || 'Noma\'lum'
              });
            }
          } else if (transaction.type === 'TRANSFER') {
            // O'tkazma - fromBranchId = selectedBranchId bo'lsa CHIQIM, toBranchId = selectedBranchId bo'lsa KIRIM
            if (transaction.fromBranchId?.toString() === selectedBranchId) {
              // Sizning filialdan chiqayotgan o'tkazma - CHIQIM
              transfers.push({
                ...baseData,
                type: 'O\'tkazma (Chiqim)',
                direction: 'out',
                fromBranch: branches.find(b => b.id === transaction.fromBranchId)?.name || 'Noma\'lum',
                toBranch: branches.find(b => b.id === transaction.toBranchId)?.name || 'Noma\'lum'
              });
            } else if (transaction.toBranchId?.toString() === selectedBranchId) {
              // Sizning filialga kirgan o'tkazma - KIRIM
              transfers.push({
                ...baseData,
                type: 'O\'tkazma (Kirim)',
                direction: 'in',
                fromBranch: branches.find(b => b.id === transaction.fromBranchId)?.name || 'Noma\'lum',
                toBranch: branches.find(b => b.id === transaction.toBranchId)?.name || 'Noma\'lum'
              });
            }
          }
        }
      }

      // Barcha chiqimlar (mijozga sotuv + filialdan chiqayotgan o'tkazmalar)
      const outflows = [
        ...sales,
        ...transfers.filter(t => t.direction === 'out')
      ];

      setReportData({
        purchases,
        sales,
        transfers,
        outflows,
        statistics
      });

    } catch (err) {
      let message = "Ma'lumotlarni yuklashda xatolik";
      if (err.message?.toLowerCase().includes('token')) message = err.message;
      else if (err.code === 'ECONNABORTED') message = "So'rov vaqti tugadi - Internetni tekshiring";
      else if (err.response?.data?.message) message = err.response.data.message;
      else if (err.response?.status) message = `Server xatosi: ${err.response.status}`;

      setNotification({ message, type: 'error' });
      console.error('API Error:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod, selectedBranchId, branches]);

  useEffect(() => {
    if (selectedBranchId && branches.length > 0) {
      loadTransactions();
    }
  }, [selectedBranchId, branches, loadTransactions]);


  const getCurrentData = () => {
    switch (selectedReportType) {
      case 'purchases': return reportData.purchases;
      case 'sales': return reportData.sales;
      case 'outflows': return reportData.outflows;
      case 'transfers': return reportData.transfers;
      default: return [...reportData.purchases, ...reportData.sales, ...reportData.transfers];
    }
  };

  const currentData = getCurrentData();

  const exportToExcel = async () => {
    if (!currentData || currentData.length === 0) return;
    let XLSX;
    try {
      XLSX = await import('xlsx');
    } catch (e) {
      setNotification({ message: "Excel eksport uchun 'xlsx' paketi kerak: npm i xlsx", type: 'error' });
      return;
    }
    // Faqat so'ralgan ustunlar: Nomer, Tovar Nomi, Miqdor, Narx, Jami, Sana
    const headers = ['Nomer', 'Tovar Nomi', 'Miqdor', 'Narx', 'Jami', 'Sana'];
    const rows = currentData.map((row, index) => {
      const dateVal = row.transactionDate ? new Date(row.transactionDate) : '';
      return [
        index + 1,
        row.productName || "Noma'lum",
        Number(row.quantity) || 0,
        Number(row.price) || 0,
        Number(row.total) || 0,
        dateVal,
      ];
    });
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    // Column widths
    worksheet['!cols'] = [
      { wch: 8 },   // Nomer
      { wch: 30 },  // Tovar Nomi
      { wch: 12 },  // Miqdor
      { wch: 14 },  // Narx
      { wch: 16 },  // Jami
      { wch: 14 },  // Sana
    ];
    // Number and date formats
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    for (let R = 1; R <= range.e.r; R++) {
      const qtyCell = XLSX.utils.encode_cell({ r: R, c: 2 });
      const priceCell = XLSX.utils.encode_cell({ r: R, c: 3 });
      const totalCell = XLSX.utils.encode_cell({ r: R, c: 4 });
      const dateCell = XLSX.utils.encode_cell({ r: R, c: 5 });
      if (worksheet[qtyCell]) worksheet[qtyCell].z = '#,##0';
      if (worksheet[priceCell]) worksheet[priceCell].z = "#,##0 \"so'm\"";
      if (worksheet[totalCell]) worksheet[totalCell].z = "#,##0 \"so'm\"";
      if (worksheet[dateCell] && worksheet[dateCell].v instanceof Date) worksheet[dateCell].z = 'yyyy-mm-dd';
    }
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Hisobot');
    const periodLabels = { week: 'Oxirgi 7 kun', month: 'Oxirgi 30 kun', quarter: 'Oxirgi 90 kun', year: 'Oxirgi 1 yil' };
    const branchName = branches.find(b => b.id.toString() === selectedBranchId)?.name || 'Filial';
    XLSX.writeFile(workbook, `Hisobot_${branchName}_${periodLabels[selectedPeriod]}_${Date.now()}.xlsx`);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
          <BarChart3 size={28} />
          Hisobotlar
        </h1>
        <div className="flex gap-4">
          <select
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            className="border rounded-lg px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Filial tanlang</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="border rounded-lg px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="week">Oxirgi 7 kun</option>
            <option value="month">Oxirgi 30 kun</option>
            <option value="quarter">Oxirgi 90 kun</option>
            <option value="year">Oxirgi 1 yil</option>
          </select>
          <select
            value={selectedReportType}
            onChange={(e) => setSelectedReportType(e.target.value)}
            className="border rounded-lg px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Barcha</option>
            <option value="purchases">Kirimlar</option>
            <option value="sales">Sotuv (mijozga)</option>
            <option value="outflows">Chiqimlar (barchasi)</option>
            <option value="transfers">O'tkazmalar</option>
          </select>
        </div>
      </div>

      {notification && <Notification {...notification} onClose={() => setNotification(null)} />}

      {/* Statistika kartlari */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-600 font-medium">Umumiy Sotish</p>
              <p className="text-2xl font-bold text-green-700">{formatCurrency(reportData.statistics.totalSales || 0)}</p>
            </div>
            <DollarSign className="text-green-600" size={24} />
          </div>
        </div>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-600 font-medium">Naqd To'lov</p>
              <p className="text-2xl font-bold text-blue-700">{formatCurrency(reportData.statistics.cashSales || 0)}</p>
            </div>
            <Package className="text-blue-600" size={24} />
          </div>
        </div>
        
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-purple-600 font-medium">Karta To'lov</p>
              <p className="text-2xl font-bold text-purple-700">{formatCurrency(reportData.statistics.cardSales || 0)}</p>
            </div>
            <TrendingUp className="text-purple-600" size={24} />
          </div>
        </div>
        
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-orange-600 font-medium">Kredit</p>
              <p className="text-2xl font-bold text-orange-700">{formatCurrency(reportData.statistics.creditSales || 0)}</p>
            </div>
            <ArrowRightLeft className="text-orange-600" size={24} />
          </div>
        </div>
      </div>

      {/* Qisqacha ma'lumotlar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-2">Kirimlar</h3>
          <p className="text-2xl font-bold text-green-600">{reportData.purchases.length} ta</p>
          <p className="text-sm text-gray-600">
            Jami: {formatCurrency(reportData.purchases.reduce((sum, item) => sum + (item.total || 0), 0))}
          </p>
        </div>
        
        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-2">Chiqimlar</h3>
          <p className="text-2xl font-bold text-red-600">{reportData.outflows.length} ta</p>
          <p className="text-sm text-gray-600">
            Jami: {formatCurrency(reportData.outflows.reduce((sum, item) => sum + (item.total || 0), 0))}
          </p>
          <div className="mt-3 text-xs text-gray-700 space-y-1">
            <div className="flex justify-between">
              <span>Sotuv (mijozga):</span>
              <span className="font-semibold">{reportData.sales.length} ta</span>
            </div>
            <div className="flex justify-between">
              <span>O'tkazma (chiqim):</span>
              <span className="font-semibold">{reportData.transfers.filter(t => t.direction === 'out').length} ta</span>
            </div>
          </div>
        </div>
        
        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-2">O'tkazmalar</h3>
          <p className="text-2xl font-bold text-blue-600">{reportData.transfers.length} ta</p>
          <p className="text-sm text-gray-600">
            Jami: {formatCurrency(reportData.transfers.reduce((sum, item) => sum + (item.total || 0), 0))}
          </p>
        </div>
      </div>

      <div className="flex justify-end mb-4">
        <button
          onClick={exportToExcel}
          disabled={loading || currentData.length === 0}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-all duration-200 flex items-center gap-2"
        >
          <Download size={20} />
          Excelga Yuklash
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="animate-spin" size={32} />
        </div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-lg shadow">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="p-3">Nomer</th>
                <th className="p-3">Turi</th>
                <th className="p-3">Tovar Nomi</th>
                <th className="p-3">Miqdor</th>
                <th className="p-3">Narx</th>
                <th className="p-3">Jami</th>
                <th className="p-3">To'lov Turi</th>
                <th className="p-3">Mijoz</th>
                <th className="p-3">Filial</th>
                <th className="p-3">Sana</th>
              </tr>
            </thead>
            <tbody>
              {currentData.map((row, index) => (
                <tr key={index} className="border-t hover:bg-gray-50">
                  <td className="p-3">{index + 1}</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      row.type?.includes('Kirim') ? 'bg-green-100 text-green-800' :
                      row.type?.includes('Chiqim') ? 'bg-red-100 text-red-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {row.type}
                    </span>
                  </td>
                  <td className="p-3">{row.productName || "Noma'lum"}</td>
                  <td className="p-3">{formatQuantity(row.quantity)}</td>
                  <td className="p-3">{formatCurrency(row.price)}</td>
                  <td className="p-3">{formatCurrency(row.total)}</td>
                  <td className="p-3">
                    {row.paymentType === 'CASH' ? 'Naqd' :
                     row.paymentType === 'CARD' ? 'Karta' :
                     row.paymentType === 'CREDIT' ? 'Kredit' : '-'}
                  </td>
                  <td className="p-3">{row.customerName || '-'}</td>
                  <td className="p-3">
                    {row.type?.includes('O\'tkazma') ? 
                      `${row.fromBranch} → ${row.toBranch}` : 
                      row.branchName || "Noma'lum"}
                  </td>
                  <td className="p-3">{formatDate(row.transactionDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {currentData.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              Tanlangan muddatda ma'lumot topilmadi
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Hisobotlar;