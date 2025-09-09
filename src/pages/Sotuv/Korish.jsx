import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Eye, X, Sun, Moon } from 'lucide-react';
import Logout from '../Chiqish/logout';

function Korish() {
    const navigate = useNavigate();
    const [allProducts, setAllProducts] = useState([]);
    const [filteredProducts, setFilteredProducts] = useState([]);
    const [exchangeRates, setExchangeRates] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showLogoutModal, setShowLogoutModal] = useState(false);
    const [showQuantityModal, setShowQuantityModal] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [productQuantities, setProductQuantities] = useState([]);
    const [quantityLoading, setQuantityLoading] = useState(false);
    const [branches, setBranches] = useState([]);
    const [selectedBranch, setSelectedBranch] = useState(() => {
        const savedBranchId = localStorage.getItem('branchId') || localStorage.getItem('branch_id');
        return savedBranchId || '';
    });

    const [theme, setTheme] = useState(() => {
        const savedTheme = localStorage.getItem('theme');
        return savedTheme === 'dark' ? 'dark' : 'light';
    });

    useEffect(() => {
        document.body.style.backgroundColor = theme === 'dark' ? '#00020F' : '#f7f9fc';
        document.body.style.color = theme === 'dark' ? '#e0e0e0' : '#333';
        document.body.style.transition = 'background-color 0.3s ease, color 0.3s ease';
    }, [theme]);

    useEffect(() => {
        if (selectedBranch) {
            localStorage.setItem('branchId', selectedBranch);
        } else {
            localStorage.removeItem('branchId');
        }
    }, [selectedBranch]);

    // Auth bilan fetch
    const fetchWithAuth = async (url, options = {}) => {
        const token = localStorage.getItem('access_token');
        if (!token) {
            navigate('/login');
            throw new Error('Kirish talab qilinadi.');
        }
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...options.headers,
        };
        const response = await fetch(url, { ...options, headers });
        if (response.status === 401) {
            localStorage.clear();
            navigate('/login');
            throw new Error('Avtorizatsiya tugagan.');
        }
        if (!response.ok) throw new Error(`Xato: ${response.status}`);
        return response;
    };

    // Filiallarni olish
    useEffect(() => {
        const fetchBranches = async () => {
            setLoading(true);
            try {
                const res = await fetchWithAuth('https://suddocs.uz/branches');
                const data = await res.json();
                const list = Array.isArray(data) ? data : data.data || [];
                setBranches(list);

                const savedBranchId = localStorage.getItem('branchId') || localStorage.getItem('branch_id');
                if (savedBranchId && list.some(b => b.id === savedBranchId)) {
                    setSelectedBranch(savedBranchId);
                } else if (!selectedBranch && list.length > 0) {
                }
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchBranches();
    }, [navigate]);

    // Mahsulotlarni olish
    useEffect(() => {
        const fetchProducts = async () => {
            setLoading(true);
            try {
                const res = await fetchWithAuth('https://suddocs.uz/products');
                const data = await res.json();
                setAllProducts(Array.isArray(data) ? data : data.data || []);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchProducts();
    }, []);

    // Valyuta kurslarini olish
    useEffect(() => {
        const fetchRates = async () => {
            try {
                const res = await fetchWithAuth('https://suddocs.uz/currency-exchange-rates');
                const data = await res.json();
                setExchangeRates(Array.isArray(data) ? data : data.data || []);
            } catch (err) {
            }
        };
        fetchRates();
    }, []);

    // Filtrlash
    useEffect(() => {
        let result = [...allProducts];
        if (selectedBranch) {
            result = result.filter(p =>
                p.branch?.id === selectedBranch ||
                p.branchId === selectedBranch ||
                String(p.branch?.id) === String(selectedBranch)
            );
        }
        if (searchTerm.trim()) {
            const words = searchTerm.toLowerCase().trim().split(/\s+/);
            result = result.filter(p => {
                const name = (p.name || '').toLowerCase();
                const model = (p.model || '').toLowerCase();
                const barcode = (p.barcode || '').toLowerCase();
                return words.every(word => name.includes(word) || model.includes(word) || barcode.includes(word));
            });
        }
        setFilteredProducts(result);
    }, [selectedBranch, allProducts, searchTerm]);

    // Narxni so'mda hisoblash
    const calculatePriceWithRate = (price) => {
        if (!price || !exchangeRates.length) return 'N/A';
        const rate = exchangeRates.find(r =>
            r.fromCurrency === 'USD' && r.toCurrency === 'UZS' && r.isActive
        );
        return rate ? `${Math.round(price * rate.rate).toLocaleString()} so'm` : 'N/A';
    };

    // Mahsulotni batafsil ko'rish
    const handleProductClick = (product) => {
        setSelectedProduct(product);
        setQuantityLoading(true);
        const quantities = allProducts
            .filter(p =>
                p.name === product.name &&
                p.model === product.model &&
                p.barcode === product.barcode
            )
            .reduce((acc, p) => {
                const branchName = p.branch?.name || 'Noma\'lum filial';
                acc[branchName] = (acc[branchName] || 0) + (p.quantity || 0);
                return acc;
            }, {});
        setProductQuantities(
            Object.entries(quantities).map(([branchName, qty]) => ({ branchName, quantity: qty }))
        );
        setQuantityLoading(false);
        setShowQuantityModal(true);
    };

    // Chiqish
    const handleLogout = () => {
        localStorage.clear();
        navigate('/login');
    };

    // Temani o'zgartirish
    const toggleTheme = () => {
        const newTheme = theme === 'light' ? 'dark' : 'light';
        setTheme(newTheme);
        localStorage.setItem('theme', newTheme);
    };

    return (
        <div style={{ ...styles.container, backgroundColor: theme === 'dark' ? '#00020F' : '#f7f9fc', color: theme === 'dark' ? '#e0e0e0' : '#333' }}>
            {/* Header */}
            <div style={styles.header}>
                <img
                    src="/Baner_Zippy.png"
                    alt="Zippy логотипи"
                    style={styles.logo}
                />
                <div style={styles.headerActions}>
                    <button onClick={toggleTheme} style={styles.themeToggle}>
                        {theme === 'light' ? <Moon size={16} color="#000" /> : <Sun size={16} color="#fff" />}
                    </button>
                    <button onClick={() => setShowLogoutModal(true)} style={styles.logoutBtn}>
                        <LogOut size={16} /> Chiqish
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div style={styles.filters}>
                <select
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                    style={{
                        ...styles.select,
                        backgroundColor: theme === 'dark' ? '#000411' : '#fff',
                        color: theme === 'dark' ? '#e0e0e0' : '#333',
                        border: '1px solid #444',
                    }}
                >
                    <option value="">Barcha filiallar</option>
                    {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                            {b.name}
                        </option>
                    ))}
                </select>
                <input
                    type="text"
                    placeholder="Mahsulot nomi yoki model..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{
                        ...styles.searchInput,
                        backgroundColor: theme === 'dark' ? '#000411' : '#fff',
                        color: theme === 'dark' ? '#e0e0e0' : '#333',
                        border: '1px solid #444',
                    }}
                />
            </div>

            {/* Loading / Error / No Data */}
            {loading && <p style={styles.loading}>Yuklanmoqda...</p>}
            {error && <p style={styles.error}>Xato: {error}</p>}
            {!loading && !error && filteredProducts.length === 0 && (
                <p style={styles.noData}>
                    {allProducts.length > 0 ? 'Topilmadi' : 'Hech qanday mahsulot mavjud emas'}
                </p>
            )}

            {/* Jadval */}
            {!loading && !error && filteredProducts.length > 0 && (
                <>
                    <p style={styles.total}>Jami: {filteredProducts.length} ta mahsulot</p>
                    <div style={styles.tableWrapper}>
                        <table style={{ ...styles.table, backgroundColor: theme === 'dark' ? '#000411' : '#fff' }}>
                            <thead>
                                <tr>
                                    <Th theme={theme}>Nomi</Th>
                                    <Th theme={theme}>Model</Th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredProducts.map((p) => (
                                    <tr key={p.id}>
                                        <Td theme={theme}>
                                            {p.name}
                                            <br />
                                            <small>{calculatePriceWithRate(p.marketPrice)}</small>
                                        </Td>
                                        <Td theme={theme}>
                                            <div style={styles.flexRow}>
                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                                    {p.model || '—'}
                                                </span>
                                                <button
                                                    onClick={() => handleProductClick(p)}
                                                    style={styles.eyeBtnMini}
                                                    title="Batafsil ko'rish"
                                                >
                                                    <Eye size={12} color={theme === 'dark' ? '#00bfff' : '#007bff'} />
                                                </button>
                                            </div>
                                        </Td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* Modal */}
            {showQuantityModal && (
                <div style={styles.modalOverlay} onClick={() => setShowQuantityModal(false)}>
                    <div
                        style={{
                            ...styles.modalContent,
                            backgroundColor: theme === 'dark' ? '#00020F' : '#fff',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={styles.modalHeader}>
                            <h3 style={{ ...styles.modalTitle, color: theme === 'dark' ? '#fff' : '#2c3e50' }}>
                                {selectedProduct?.name}
                            </h3>
                            <button onClick={() => setShowQuantityModal(false)} style={styles.closeBtn}>
                                <X size={18} color={theme === 'dark' ? '#fff' : '#000'} />
                            </button>
                        </div>
                        <div style={styles.modalBody(theme)}>
                            <p><strong>Model:</strong> {selectedProduct?.model || '—'}</p>
                            <p><strong>Barcode:</strong> {selectedProduct?.barcode || '—'}</p>
                            <p><strong>Narxi:</strong> {calculatePriceWithRate(selectedProduct?.marketPrice)}</p>
                            <h4 style={styles.subTitle(theme)}>Filiallar bo'yicha miqdor:</h4>
                            {quantityLoading ? (
                                <p style={{ color: theme === 'dark' ? '#e0e0e0' : '#666' }}>Yuklanmoqda...</p>
                            ) : productQuantities.length === 0 ? (
                                <p style={{ color: theme === 'dark' ? '#e0e0e0' : '#888' }}>Hech qaysi filialda mavjud emas</p>
                            ) : (
                                <ul style={styles.list}>
                                    {productQuantities.map((item, i) => (
                                        <li key={i} style={styles.listItem(theme)}>
                                            <span>{item.branchName}</span>
                                            <span>{item.quantity} dona</span>
                                        </li>
                                    ))}
                                    <li style={styles.totalItem(theme)}>
                                        <span>Jami:</span>
                                        <span>
                                            {productQuantities.reduce((sum, i) => sum + i.quantity, 0)} dona
                                        </span>
                                    </li>
                                </ul>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Logout Modal */}
            {showLogoutModal && (
                <Logout
                    onConfirm={handleLogout}
                    onCancel={() => setShowLogoutModal(false)}
                />
            )}
        </div>
    );
}

// Stil
const styles = {
    container: {
        padding: '12px',
        fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
        minHeight: '100vh',
        margin: 0,
        boxSizing: 'border-box',
        transition: 'background-color 0.3s ease, color 0.3s ease',
    },
    header: {
        textAlign: 'right',
        marginBottom: '16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerActions: {
        display: 'flex',
        gap: '10px',
        alignItems: 'center',
    },
    flexRow: {
        display: 'flex',
        justifyContent: 'space-between', // Chap va o'ng chekkaga surib beradi
        alignItems: 'center',
        width: '100%',
    },
    themeToggle: {
        padding: '6px 10px',
        borderRadius: '6px',
        border: '1px solid #444',
        backgroundColor: 'transparent',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
    },
    logoutBtn: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 10px',
        backgroundColor: '#dc3545',
        color: 'white',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '12px',
    },
    logo: {
        height: '40px',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        filter: 'brightness(110%) contrast(110%)',
        transition: 'transform 0.3s ease',
        cursor: 'pointer',
    },
    filters: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        marginBottom: '16px',
    },
    select: {
        padding: '8px',
        borderRadius: '6px',
        border: '1px solid #ddd',
        fontSize: '13px',
        backgroundColor: 'white',
    },
    searchInput: {
        padding: '8px',
        borderRadius: '6px',
        border: '1px solid #ddd',
        fontSize: '13px',
        width: '100%',
        backgroundColor: 'white',
    },
    loading: {
        textAlign: 'center',
        color: '#666',
        fontStyle: 'italic',
        padding: '12px',
        fontSize: '14px',
    },
    error: {
        color: '#d9534f',
        textAlign: 'center',
        padding: '12px',
        fontSize: '14px',
    },
    noData: {
        textAlign: 'center',
        color: '#888',
        padding: '20px',
        fontStyle: 'italic',
        fontSize: '14px',
    },
    total: {
        color: '#555',
        fontSize: '13px',
        marginBottom: '8px',
    },
    tableWrapper: {
        width: '100%',
        overflowX: 'hidden', // Skrol o'chirildi
        marginBottom: '40px',
    },
    table: {
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: '12px',
        tableLayout: 'fixed', // Muhim
        borderRadius: '8px',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    },
    modalOverlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
    },
    modalContent: {
        borderRadius: '12px',
        width: '95%',
        maxWidth: '400px',
        maxHeight: '80vh',
        overflowY: 'auto',
        padding: '20px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
    },
    modalHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
        borderBottom: '1px solid #444',
        paddingBottom: '10px',
    },
    modalTitle: {
        margin: 0,
        fontSize: '16px',
        fontWeight: '600',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
    closeBtn: {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
    },
    modalBody: (theme) => ({
        lineHeight: '1.6',
        color: theme === 'dark' ? '#e0e0e0' : '#333',
        fontSize: '14px',
    }),
    subTitle: (theme) => ({
        margin: '16px 0 10px',
        color: theme === 'dark' ? '#ffffff' : '#2c3e50',
        fontSize: '15px',
        fontWeight: '600',
    }),
    list: {
        listStyle: 'none',
        padding: 0,
        margin: 0,
    },
    listItem: (theme) => ({
        display: 'flex',
        justifyContent: 'space-between',
        padding: '6px 0',
        borderBottom: `1px solid ${theme === 'dark' ? '#333' : '#f0f0f0'}`,
        color: theme === 'dark' ? '#e0e0e0' : '#333',
        fontSize: '14px',
    }),
    totalItem: (theme) => ({
        display: 'flex',
        justifyContent: 'space-between',
        fontWeight: 'bold',
        paddingTop: '10px',
        borderTop: `2px solid ${theme === 'dark' ? '#555' : '#ddd'}`,
        marginTop: '10px',
        color: theme === 'dark' ? '#fff' : '#2c3e50',
    }),
    eyeBtn: {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '4px',
    },
    center: { textAlign: 'center' },
    right: { textAlign: 'right' },
};

// Dinamik Th va Td
const Th = ({ children, theme }) => (
    <th style={{
        padding: '8px 6px',
        textAlign: 'left',
        backgroundColor: theme === 'dark' ? '#000411' : '#f3f5f9',
        fontWeight: '600',
        fontSize: '12px',
        color: theme === 'dark' ? '#ffffff' : '#333',
        whiteSpace: 'normal',
        wordBreak: 'break-word',
        border: '1px solid #444',
    }}>
        {children}
    </th>
);

const Td = ({ children, theme }) => (
    <td style={{
        padding: '6px',
        whiteSpace: 'normal',
        wordBreak: 'break-word',
        fontSize: '12px',
        color: theme === 'dark' ? '#e0e0e0' : '#555',
        border: '1px solid #444',
    }}>
        {children}
    </td>
);

export default Korish;