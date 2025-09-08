import React, { useState, useEffect } from 'react';
import { Trash2, Search, BarChart, Eye, Calendar, User, Package, Building } from 'lucide-react'; // Added Building
import * as XLSX from 'xlsx';
import './Tranzaksiyalar.css';

const translatePaymentType = (type) => {
    const map = {
        CASH: 'Нақд тўлов',
        CARD: 'Карта орқали',
        CREDIT: 'Кредит орқали',
        INSTALLMENT: 'Бўлиб тўлов'
    };
    return map[type] || type;
};

const translateStatus = (status) => {
    const map = {
        RETURNED: 'Қайтарилган',
        DELIVERED: 'Етказилган',
        PENDING: 'Кутилмоқда',
        CANCELLED: 'Бекор қилинган'
    };
    return map[status] || status;
};

function Tranzaksiyalar({ selectedBranchId }) {
    const [transactions, setTransactions] = useState([]);
    const [defectiveLogs, setDefectiveLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filterPaymentType, setFilterPaymentType] = useState('');
    const [filterDate, setFilterDate] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTransaction, setSelectedTransaction] = useState(null);
    const [selectedLog, setSelectedLog] = useState(null);
    const [viewMode, setViewMode] = useState('non-returned'); // 'non-returned' or 'logs'

    const token = localStorage.getItem('access_token');

    const authHeaders = () => ({
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
    });

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                // Fetch transactions
                const transactionsResponse = await fetch('https://suddocs.uz/transactions/', {
                    headers: authHeaders(),
                });
                if (!transactionsResponse.ok) throw new Error('Маълумот олишда хатолик');
                const transactionsData = await transactionsResponse.json();
                setTransactions(transactionsData.transactions || []);

                // Fetch defective logs
                const logsResponse = await fetch(
                    `https://suddocs.uz/defective-logs${selectedBranchId ? `?branchId=${selectedBranchId}` : ''}`,
                    { headers: authHeaders() }
                );
                if (!logsResponse.ok) throw new Error('Қайтариш логларини олишда хатолик');
                const logsData = await logsResponse.json();
                const allLogs = Array.isArray(logsData) ? logsData : (Array.isArray(logsData.items) ? logsData.items : []);

                // Filter logs for selected date
                const selectedDateObj = new Date(filterDate || new Date());
                const startOfDay = new Date(selectedDateObj.getFullYear(), selectedDateObj.getMonth(), selectedDateObj.getDate());
                const endOfDay = new Date(selectedDateObj.getFullYear(), selectedDateObj.getMonth(), selectedDateObj.getDate(), 23, 59, 59);

                const returnLogs = allLogs.filter(log => {
                    const logDate = new Date(log.createdAt);
                    return log.actionType === 'RETURN' && 
                           (!filterDate || (logDate >= startOfDay && logDate <= endOfDay));
                });

                setDefectiveLogs(returnLogs);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        if (token) {
            fetchData();
        } else {
            setError('Кириш ҳуқуқингиз йўқ. Илтимос, тизимга киришни текширинг.');
            setLoading(false);
        }
    }, [token, selectedBranchId, filterDate]);

    const handleDelete = async (id) => {
        if (!window.confirm('Ҳақиқатан ҳам ушбу транзакцияни ўчирмоқчимисиз?')) return;

        try {
            const res = await fetch(`https://suddocs.uz/transactions/${id}`, {
                method: 'DELETE',
                headers: authHeaders(),
            });

            if (res.ok) {
                setTransactions(transactions.filter((t) => t.id !== id));
            } else {
                const errorData = await res.json();
                alert(`Ўчиришда хатолик: ${errorData.message || 'Номаълум хатолик'}`);
            }
        } catch (err) {
            alert('Уланишда хатолик: ' + err.message);
        }
    };

    const openTransactionModal = (t) => setSelectedTransaction(t);
    const openLogModal = (log) => setSelectedLog(log);
    const closeModal = () => {
        setSelectedTransaction(null);
        setSelectedLog(null);
    };

    const filteredTransactions = transactions.filter((t) => {
        const matchesBranch = !selectedBranchId || t.fromBranch?.id?.toString() === selectedBranchId;
        const matchesPayment = !filterPaymentType || t.paymentType === filterPaymentType;
        const matchesDate = !filterDate || t.createdAt.startsWith(filterDate);
        const lowerSearch = searchTerm.toLowerCase();
        const matchesSearch =
            !searchTerm ||
            (t.customer?.fullName?.toLowerCase().includes(lowerSearch) ||
                t.items.some((item) => item.product?.name?.toLowerCase()?.includes(lowerSearch) ?? false));
        const hasReturnedItems = !t.items.some((item) => item.status === 'RETURNED');

        return matchesBranch && matchesPayment && matchesDate && matchesSearch && hasReturnedItems;
    });

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('uz-Cyrl-UZ', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const today = new Date().toISOString().split('T')[0];
    const daily = filteredTransactions
        .filter((t) => t.createdAt.startsWith(today))
        .reduce((sum, t) => sum + t.finalTotal, 0);

    const currentMonth = today.slice(0, 7);
    const monthly = filteredTransactions
        .filter((t) => t.createdAt.startsWith(currentMonth))
        .reduce((sum, t) => sum + t.finalTotal, 0);

    const exportToExcel = () => {
        const data = filteredTransactions.map((t) => ({
            ID: t.id,
            Мижоз: t.customer?.fullName || 'Номаълум',
            Маҳсулотлар: t.items
                .map((i) => `${i.product?.name || 'Unknown'} (${i.product?.model || '-'}) x ${i.quantity}`)
                .join(', '),
            'Умумий нарх': t.finalTotal,
            'Тўлов усули': translatePaymentType(t.paymentType),
            Сана: new Date(t.createdAt).toLocaleString('uz-Cyrl-UZ'),
            Филиал: t.fromBranch?.name || 'Номаълум',
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Транзакциялар');
        XLSX.writeFile(wb, 'tranzaksiyalar.xlsx');
    };

    const TransactionDetailsModal = ({ transaction, onClose }) => (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden">
                <div className="p-4 border-b flex items-center justify-between bg-gradient-to-r from-blue-50 to-red-50">
                    <div className="font-semibold text-lg text-gray-800">
                        Транзакция #{transaction.id}
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700 p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        ✕
                    </button>
                </div>
                <div className="p-6 overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                            <div className="text-sm font-medium text-blue-800 mb-3 flex items-center gap-2">
                                <User size={16} />
                                Мижоз маълумотлари
                            </div>
                            <div className="space-y-2 text-sm">
                                <div><strong>Тўлиқ исм:</strong> {transaction.customer?.fullName || '-'}</div>
                                <div><strong>Телефон:</strong> {transaction.customer?.phone || '-'}</div>
                                <div><strong>Манзил:</strong> {transaction.deliveryAddress || '-'}</div>
                            </div>
                        </div>
                        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                            <div className="text-sm font-medium text-green-800 mb-3 flex items-center gap-2">
                                <Calendar size={16} />
                                Транзакция маълумотлари
                            </div>
                            <div className="space-y-2 text-sm">
                                <div><strong>Сана:</strong> {formatDate(transaction.createdAt)}</div>
                                <div><strong>Тўлов усули:</strong> {translatePaymentType(transaction.paymentType)}</div>
                                <div><strong>Умумий сумма:</strong> {transaction.finalTotal.toLocaleString('uz-Cyrl-UZ')} сўм</div>
                                <div><strong>Филиал:</strong> {transaction.fromBranch?.name || '-'}</div>
                            </div>
                        </div>
                    </div>
                    <div className="mb-6">
                        <div className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                            <Package size={16} />
                            Маҳсулотлар
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm border border-gray-200 rounded-lg">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-b border-gray-200">
                                            Маҳсулот номи
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-b border-gray-200">
                                            Модел
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-b border-gray-200">
                                            Миқдор
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-b border-gray-200">
                                            Ҳолат
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {transaction.items.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50">
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-gray-900">{item.product?.name || 'Unknown'}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="text-gray-900">{item.product?.model || '-'}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                    {item.quantity} дона
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span
                                                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                                        item.status === 'RETURNED'
                                                            ? 'bg-red-100 text-red-800'
                                                            : 'bg-green-100 text-green-800'
                                                    }`}
                                                >
                                                    {translateStatus(item.status)}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                <div className="p-4 border-t bg-gray-50 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                        Ёпиш
                    </button>
                </div>
            </div>
        </div>
    );

    const LogDetailsModal = ({ log, onClose }) => (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
                <div className="p-4 border-b flex items-center justify-between bg-gradient-to-r from-red-50 to-orange-50">
                    <div className="font-semibold text-lg text-gray-800">
                        Қайтариш лог #{log.id}
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700 p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        ✕
                    </button>
                </div>
                <div className="p-6 overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                            <div className="text-sm font-medium text-red-800 mb-3 flex items-center gap-2">
                                <Package size={16} />
                                Маҳсулот маълумотлари
                            </div>
                            <div className="space-y-2 text-sm">
                                <div><strong>Номи:</strong> {log.product?.name || '-'}</div>
                                <div><strong>Код:</strong> {log.product?.barcode || '-'}</div>
                                <div><strong>Миқдор:</strong> {log.quantity} дона</div>
                                <div><strong>Сабаб:</strong> {log.description || '-'}</div>
                            </div>
                        </div>
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                            <div className="text-sm font-medium text-blue-800 mb-3 flex items-center gap-2">
                                <Calendar size={16} />
                                Қайтариш маълумотлари
                            </div>
                            <div className="space-y-2 text-sm">
                                <div><strong>Вақт:</strong> {formatDate(log.createdAt)}</div>
                                <div><strong>Транзакция:</strong> #{log.transactionId}</div>
                                <div><strong>Пул миқдори:</strong> {Math.abs(log.cashAmount || 0).toLocaleString('uz-Cyrl-UZ')} сўм</div>
                                <div><strong>Ходим:</strong> {log.user ? `${log.user.firstName || ''} ${log.user.lastName || ''}`.trim() : '-'}</div>
                            </div>
                        </div>
                    </div>
                    {log.product && (
                        <div className="mb-6">
                            <div className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                                <Package size={16} />
                                Маҳсулот тавсифи
                            </div>
                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                    <div><strong>Категория:</strong> {log.product.category?.id || '-'}</div>
                                    <div><strong>Модел:</strong> {log.product.model || '-'}</div>
                                </div>
                            </div>
                        </div>
                    )}
                    {log.branch && (
                        <div className="mb-6">
                            <div className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                                <Building size={16} />
                                Филиал маълумотлари
                            </div>
                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                <div className="text-sm">
                                    <div><strong>Номи:</strong> {log.branch.name || '-'}</div>
                                    <div><strong>Манзил:</strong> {log.branch.address || '-'}</div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                <div className="p-4 border-t bg-gray-50 flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                        <strong>Қайтарилган сумма:</strong> {Math.abs(log.cashAmount || 0).toLocaleString('uz-Cyrl-UZ')} сўм
                    </div>
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                        Ёпиш
                    </button>
                </div>
            </div>
        </div>
    );

    if (loading) return <div className="text-center py-8 text-gray-500">Юкланмоқда...</div>;
    if (error) return <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">{error}</div>;

    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Транзакциялар</h2>
                    <p className="text-gray-600 mt-1">Қайтарилмаган транзакциялар ва Кайтарилганлар</p>
                </div>
                <div className="flex items-center gap-3">
                    <input
                        type="date"
                        value={filterDate}
                        onChange={(e) => setFilterDate(e.target.value)}
                        className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex bg-gray-100 rounded-lg p-1">
                        <button
                            onClick={() => setViewMode('non-returned')}
                            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                                viewMode === 'non-returned'
                                    ? 'bg-white text-blue-600 shadow-sm'
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            Қайтарилмаганлар
                        </button>
                        <button
                            onClick={() => setViewMode('logs')}
                            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                                viewMode === 'logs'
                                    ? 'bg-white text-blue-600 shadow-sm'
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            Кайтарилганлар
                        </button>
                    </div>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
                    {error}
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                {viewMode === 'non-returned' ? (
                    <div className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="search-box flex items-center gap-2 px-3 py-2 border rounded-lg">
                                    <Search size={16} />
                                    <input
                                        type="text"
                                        placeholder="Мижоз ёки маҳсулот номи бўйича қидириш..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="border-none outline-none"
                                    />
                                </div>
                                <select
                                    value={filterPaymentType}
                                    onChange={(e) => setFilterPaymentType(e.target.value)}
                                    className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">Тўлов усули: Барчаси</option>
                                    <option value="CASH">Нақд тўлов</option>
                                    <option value="CARD">Карта орқали</option>
                                    <option value="CREDIT">Кредит орқали</option>
                                    <option value="INSTALLMENT">Бўлиб тўлов</option>
                                </select>
                            </div>
                            <div className="flex items-center gap-4">
                            
                                <button onClick={exportToExcel} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                                    Excel экспорт
                                </button>
                            </div>
                        </div>
                        {filteredTransactions.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                                Ҳеч қандай транзакция топилмади.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                ID
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Мижоз
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Маҳсулот (модел)
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Нарх
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Умумий
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Тўлов усули
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Филиал
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Сана ва вақт
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Ҳаракатлар
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {filteredTransactions.map((t) => (
                                            <tr key={t.id} className="hover:bg-gray-50">
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    <div className="text-sm font-medium text-gray-900">#{t.id}</div>
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-gray-900">{t.customer?.fullName || 'Номаълум'}</div>
                                                </td>
                                                <td className="px-4 py-4">
                                                    {t.items.map((item) => (
                                                        <div key={item.id} className="text-sm text-gray-900">
                                                            <strong>{item.product?.name || 'Unknown'}</strong> — {item.product?.model || '-'}
                                                        </div>
                                                    ))}
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    <div className="text-sm font-medium text-gray-900">{t.total?.toLocaleString('uz-Cyrl-UZ')} сўм</div>
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    <div className="text-sm font-medium text-gray-900">{t.finalTotal?.toLocaleString('uz-Cyrl-UZ')} сўм</div>
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                                                        {translatePaymentType(t.paymentType)}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-gray-900">{t.fromBranch?.name || 'Номаълум'}</div>
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-gray-900">{formatDate(t.createdAt)}</div>
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                    <button
                                                        onClick={() => openTransactionModal(t)}
                                                        className="inline-flex items-center justify-center w-8 h-8 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded-full transition-colors"
                                                        title="Батафсил маълумот"
                                                    >
                                                        <Eye size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(t.id)}
                                                        className="inline-flex items-center justify-center w-8 h-8 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-full transition-colors ml-2"
                                                        title="Ўчириш"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold"> Кайтарилганлар </h2>
                            <div className="text-sm text-gray-600">
                                Жами: {defectiveLogs.length} та ёзув
                            </div>
                        </div>
                        {defectiveLogs.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                                Танланган санада Кайтарилганлар топилмади
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Вақт
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Транзакция
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Маҳсулот
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Миқдор
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Сабаб
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Пул миқдори
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Ходим
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Батафсил
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {defectiveLogs.map((log, idx) => (
                                            <tr key={idx} className="hover:bg-gray-50">
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-gray-900">
                                                        {formatDate(log.createdAt)}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    <div className="text-sm font-medium text-gray-900">
                                                        #{log.transactionId}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-gray-900">
                                                        {log.product?.name || '-'}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-gray-900">
                                                        {log.quantity} дона
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-gray-900">
                                                        {log.description || '-'}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    <div className="text-sm font-medium text-red-600">
                                                        {Math.abs(log.cashAmount || 0).toLocaleString('uz-Cyrl-UZ')} сўм
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-gray-900">
                                                        {log.user ? `${log.user.firstName || ''} ${log.user.lastName || ''}`.trim() : '-'}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap text-center">
                                                    <button
                                                        onClick={() => openLogModal(log)}
                                                        className="inline-flex items-center justify-center w-8 h-8 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded-full transition-colors"
                                                        title="Батафсил маълумот"
                                                    >
                                                        <Eye size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {selectedTransaction && (
                <TransactionDetailsModal
                    transaction={selectedTransaction}
                    onClose={closeModal}
                />
            )}

            {selectedLog && (
                <LogDetailsModal
                    log={selectedLog}
                    onClose={closeModal}
                />
            )}
        </div>
    );
}

export default Tranzaksiyalar;