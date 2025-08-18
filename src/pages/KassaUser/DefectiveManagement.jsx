import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  AlertTriangle, 
  RotateCcw, 
  Package, 
  Plus, 
  Minus,
  CheckCircle
} from 'lucide-react';

const DefectiveManagement = () => {
  const [products, setProducts] = useState([]);
  const [soldProducts, setSoldProducts] = useState([]);
  const [defectiveLogs, setDefectiveLogs] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [actionType, setActionType] = useState('DEFECTIVE');
  const [quantity, setQuantity] = useState(1);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  useEffect(() => {
    if (!notification) return;
    const t = setTimeout(() => setNotification(null), 1500);
    return () => clearTimeout(t);
  }, [notification]);
  const [activeMode, setActiveMode] = useState('dokondagi'); // 'dokondagi' or 'sotilgan'
  // Sotilgan rejim uchun qidiruv
  const [soldProductSearch, setSoldProductSearch] = useState('');
  const [selectedTransactionItem, setSelectedTransactionItem] = useState(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [modalData, setModalData] = useState({});
  const [productSearch, setProductSearch] = useState('');
  const [modalQuantity, setModalQuantity] = useState(1);
  const [modalDescription, setModalDescription] = useState('');
  
  const navigate = useNavigate();
  const token = localStorage.getItem("access_token");
  const userId = localStorage.getItem("userId");
  const branchId = localStorage.getItem("branchId");
  const API_URL = "https://suddocs.uz";

  const didInitRef = useRef(false);
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    if (!token) {
      navigate("/login");
      return;
    }
    fetchProducts();
    fetchSoldProducts();
    fetchDefectiveLogs();
  }, []);

  // No customer search in this flow

  const fetchProducts = async () => {
    try {
      const response = await fetch(`${API_URL}/products?branchId=${branchId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (response.ok) {
        const data = await response.json();
        setProducts(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  };

  const fetchSoldProducts = async () => {
    try {
      const response = await fetch(`${API_URL}/transactions?branchId=${branchId}&type=SALE`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (response.ok) {
        const data = await response.json();
        const transactions = data.transactions || data || [];
        // Extract sold products from transactions
        const sold = [];
        transactions.forEach(tx => {
          if (tx.items) {
            tx.items.forEach(item => {
              if (item.product) {
                sold.push({
                  ...item.product,
                  transactionId: tx.id,
                  customer: tx.customer,
                  soldDate: tx.createdAt,
                  soldPrice: item.price,
                  soldBy: tx.soldBy,
                  quantity: item.quantity,
                  productId: item.productId || item.product?.id
                });
              }
            });
          }
        });
        setSoldProducts(sold);
      }
    } catch (error) {
      console.error("Error fetching sold products:", error);
    }
  };

  const fetchDefectiveLogs = async () => {
    try {
      const response = await fetch(`${API_URL}/defective-logs?branchId=${branchId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (response.ok) {
        const data = await response.json();
        setDefectiveLogs(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error fetching defective logs:", error);
    }
  };

  // Sotilgan mahsulotlarni product bo'yicha guruhlash (dublikatlarni birlashtirish)
  const groupedSold = useMemo(() => {
    const map = new Map();
    const q = soldProductSearch.trim().toLowerCase();
    for (const sp of soldProducts) {
      const productId = sp.productId || sp.id;
      if (!productId) continue;
      const name = (sp.name || '').toLowerCase();
      const model = (sp.model || '').toLowerCase();
      const barcode = (sp.barcode || '').toLowerCase();
      if (
        q &&
        !(name.includes(q) || model.includes(q) || barcode.includes(q))
      ) {
        continue;
      }
      if (!map.has(productId)) {
        map.set(productId, {
          productId,
          name: sp.name,
          model: sp.model,
          barcode: sp.barcode,
          totalSold: 0,
          price: sp.soldPrice,
        });
      }
      const agg = map.get(productId);
      agg.totalSold += Number(sp.quantity) || 0;
    }
    // Subtract defective logs to get remaining
    const result = [];
    for (const item of map.values()) {
      const defectiveForProduct = defectiveLogs
        .filter((log) => log.productId === item.productId && log.actionType === 'DEFECTIVE')
        .reduce((sum, log) => sum + (Number(log.quantity) || 0), 0);
      const remaining = Math.max(0, (Number(item.totalSold) || 0) - defectiveForProduct);
      if (remaining > 0) {
        result.push({ ...item, remaining, defective: defectiveForProduct });
      }
    }
    return result;
  }, [soldProducts, soldProductSearch, defectiveLogs]);

  const openActionModal = (actionType, item, transaction) => {
    setModalData({
      actionType,
      item,
      transaction,
      customer: transaction.customer
    });
    setModalQuantity(item.quantity || 1);
    setModalDescription('');
    setShowActionModal(true);
  };

  const handleTransactionItemAction = async (actionType, item, transaction) => {
    if (!item.productId) {
      setNotification({ message: "Mahsulot topilmadi", type: "error" });
      return;
    }

    setLoading(true);
    try {
      let endpoint = '';
      let body = {};

      switch (actionType) {
        case 'DEFECTIVE':
          endpoint = `${API_URL}/defective-logs`;
          body = {
            productId: item.productId,
            quantity: parseInt(modalQuantity),
            description: modalDescription || `Mijoz: ${transaction.customer?.fullName || 'Noma\'lum'} - DEFECTIVE`,
            branchId: parseInt(branchId)
          };
          break;
      }

      if (actionType === 'DEFECTIVE') {
        if (!modalDescription.trim()) {
          setLoading(false);
          setNotification({ message: "Sabab (description) kiritish shart", type: "error" });
          return;
        }
        if (!modalQuantity || Number(modalQuantity) <= 0) {
          setLoading(false);
          setNotification({ message: "Miqdor 0 dan katta bo'lishi kerak", type: "error" });
          return;
        }
        if (Number(modalQuantity) > Number(item.quantity)) {
          setLoading(false);
          setNotification({ message: `Miqdor tranzaksiyadagi miqdordan ko'p bo'lmasin (max ${item.quantity})`, type: "error" });
          return;
        }
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        setNotification({ 
          message: `${actionType} muvaffaqiyatli amalga oshirildi`, 
          type: "success" 
        });
        setSelectedTransactionItem(null);
        setShowActionModal(false);
        setModalQuantity(1);
        setModalDescription('');
        fetchProducts();
        fetchSoldProducts();
        fetchDefectiveLogs();
      } else {
        const errorData = await response.json();
        setNotification({ 
          message: errorData.message || "Xatolik yuz berdi", 
          type: "error" 
        });
      }
    } catch (error) {
      setNotification({ 
        message: "Xatolik yuz berdi", 
        type: "error" 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async () => {
    if (!selectedProduct || !quantity || !description) {
      setNotification({ message: "Barcha maydonlarni to'ldiring", type: "error" });
      return;
    }

    if (actionType === 'DEFECTIVE' && quantity > selectedProduct.quantity) {
      setNotification({ 
        message: `Defective miqdori mavjud miqdordan ko'p bo'lishi mumkin emas. Mavjud: ${selectedProduct.quantity}`, 
        type: "error" 
      });
      return;
    }

    setLoading(true);
    try {
      let endpoint = '';
      let body = {};

      switch (actionType) {
        case 'DEFECTIVE':
          endpoint = `${API_URL}/defective-logs`;
          body = {
            productId: selectedProduct.id,
            quantity: parseInt(quantity),
            description,
            branchId: parseInt(branchId)
          };
          break;
        case 'FIXED':
          endpoint = `${API_URL}/defective-logs/mark-as-fixed/${selectedProduct.id}`;
          body = {
            quantity: parseInt(quantity),
            branchId: parseInt(branchId)
          };
          break;
        case 'RETURN':
          endpoint = `${API_URL}/defective-logs/return/${selectedProduct.id}`;
          body = {
            quantity: parseInt(quantity),
            description,
            branchId: parseInt(branchId)
          };
          break;
        case 'EXCHANGE':
          endpoint = `${API_URL}/defective-logs/exchange/${selectedProduct.id}`;
          body = {
            quantity: parseInt(quantity),
            description,
            branchId: parseInt(branchId)
          };
          break;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        setNotification({ 
          message: "Amaliyot muvaffaqiyatli amalga oshirildi", 
          type: "success" 
        });
        setSelectedProduct(null);
        setQuantity(1);
        setDescription('');
        fetchProducts();
        fetchSoldProducts();
        fetchDefectiveLogs();
      } else {
        const errorData = await response.json();
        setNotification({ 
          message: errorData.message || "Xatolik yuz berdi", 
          type: "error" 
        });
      }
    } catch (error) {
      setNotification({ 
        message: "Xatolik yuz berdi", 
        type: "error" 
      });
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (type) => {
    switch (type) {
      case 'DEFECTIVE': return <AlertTriangle className="text-red-500" size={20} />;
      case 'FIXED': return <CheckCircle className="text-green-500" size={20} />;
      case 'RETURN': return <RotateCcw className="text-orange-500" size={20} />;
      case 'EXCHANGE': return <Package className="text-blue-500" size={20} />;
      default: return <AlertTriangle className="text-gray-500" size={20} />;
    }
  };

  const getActionColor = (type) => {
    switch (type) {
      case 'DEFECTIVE': return 'bg-red-50 text-red-700 border-red-200';
      case 'FIXED': return 'bg-green-50 text-green-700 border-green-200';
      case 'RETURN': return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'EXCHANGE': return 'bg-blue-50 text-blue-700 border-blue-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getActionLabel = (type) => {
    switch (type) {
      case 'DEFECTIVE': return 'Brak qilish';
      case 'RETURN': return 'Qaytarish';
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("uz-UZ").format(amount) + " so'm";
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString("uz-Cyrl-UZ");
  };

  const getCashFlowSummary = () => {
    let totalDefective = 0;
    let totalFixed = 0;
    let totalReturned = 0;
    let totalExchanged = 0;

    defectiveLogs.forEach(log => {
      switch (log.actionType) {
        case 'DEFECTIVE':
          totalDefective += log.cashAmount || 0;
          break;
        case 'FIXED':
          totalFixed += log.cashAmount || 0;
          break;
        case 'RETURN':
          totalReturned += log.cashAmount || 0;
          break;
        case 'EXCHANGE':
          totalExchanged += log.cashAmount || 0;
          break;
      }
    });

    return {
      totalDefective: Math.abs(totalDefective),
      totalFixed: Math.abs(totalFixed),
      totalReturned: Math.abs(totalReturned),
      totalExchanged: Math.abs(totalExchanged)
    };
  };

  const cashFlowSummary = getCashFlowSummary();

  const getDefectiveQtyForProductSinceTx = (productId, txCreatedAt) => {
    if (!productId) return 0;
    const txTime = txCreatedAt ? new Date(txCreatedAt).getTime() : 0;
    return defectiveLogs
      .filter((log) => log.productId === productId && log.actionType === 'DEFECTIVE')
      .filter((log) => {
        if (!txTime) return true;
        const logTime = new Date(log.createdAt).getTime();
        return logTime >= txTime;
      })
      .reduce((sum, log) => sum + (Number(log.quantity) || 0), 0);
  };

  const getAvailableQuantityFromItem = (item, tx) => {
    const soldQty = Number(item?.quantity) || 0;
    if (item?.product?.status === 'DEFECTIVE') return 0;
    const defectiveQtySince = getDefectiveQtyForProductSinceTx(item?.productId || item?.product?.id, tx?.createdAt);
    const usedForThisItem = Math.min(defectiveQtySince, soldQty);
    return Math.max(0, soldQty - usedForThisItem);
  };

  const getLatestDefectReasonForProductSinceTx = (productId, txCreatedAt) => {
    if (!productId) return undefined;
    const txTime = txCreatedAt ? new Date(txCreatedAt).getTime() : 0;
    const logs = defectiveLogs
      .filter((log) => log.productId === productId && log.actionType === 'DEFECTIVE')
      .filter((log) => {
        if (!txTime) return true;
        const logTime = new Date(log.createdAt).getTime();
        return logTime >= txTime;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return logs[0]?.description;
  };

  const updateProductStatus = async (productId, newStatus, description) => {
    setLoading(true);
    try {
      const getRes = await fetch(`${API_URL}/products/${productId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!getRes.ok) {
        const err = await getRes.json().catch(() => ({}));
        setNotification({ message: err.message || 'Mahsulotni olishda xatolik', type: 'error' });
        return false;
      }
      const prod = await getRes.json();
      const putRes = await fetch(`${API_URL}/products/${productId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: prod.name,
          barcode: prod.barcode,
          categoryId: prod.categoryId,
          branchId: prod.branchId,
          price: prod.price,
          marketPrice: prod.marketPrice,
          model: prod.model,
          status: newStatus,
          quantity: prod.quantity,
          description: description || prod.description,
        }),
      });
      if (!putRes.ok) {
        const err = await putRes.json().catch(() => ({}));
        setNotification({ message: err.message || 'Statusni o\'zgartirishda xatolik', type: 'error' });
        return false;
      }
      setNotification({ message: 'Status yangilandi', type: 'success' });
      fetchProducts();
      fetchSoldProducts();
      fetchDefectiveLogs();
      return true;
    } catch (e) {
      setNotification({ message: 'Xatolik yuz berdi', type: 'error' });
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Filter products based on search
  const filteredProducts = products.filter(product => 
    product.name?.toLowerCase().includes(productSearch.toLowerCase()) ||
    product.barcode?.includes(productSearch) ||
    product.model?.toLowerCase().includes(productSearch.toLowerCase())
  );

  // Removed customer-based sold product filtering; using transaction ID search instead

  return (
    <div className="ml-[255px] space-y-6 p-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Defekt Mahsulotlar Boshqaruvi</h1>
          <p className="text-gray-600 mt-1">Mahsulotlarni defekt qilish, tuzatish va qaytarish</p>
        </div>
      </div>

      {notification && (
        <div className={`p-4 rounded-lg border ${notification.type === "error" ? "bg-red-50 text-red-700 border-red-200" : "bg-green-50 text-green-700 border-green-200"}`}>
          {notification.message}
          <button 
            className="ml-4 text-sm underline" 
            onClick={() => setNotification(null)}
          >
            Yopish
          </button>
        </div>
      )}

      {/* Mode Selection Buttons */}
      <div className="flex space-x-4">
        <button
          onClick={() => setActiveMode('dokondagi')}
          className={`px-6 py-3 rounded-lg font-medium transition-colors ${
            activeMode === 'dokondagi'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Dokondagi
        </button>
        <button
          onClick={() => setActiveMode('sotilgan')}
          className={`px-6 py-3 rounded-lg font-medium transition-colors ${
            activeMode === 'sotilgan'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Sotilgan
        </button>
      </div>

      <div className={`grid grid-cols-1 ${activeMode === 'sotilgan' ? 'lg:grid-cols-1' : 'lg:grid-cols-2'} gap-6`}>
        {/* Product Selection Panel */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {activeMode === 'dokondagi' ? 'Dokondagi mahsulotlar' : 'Sotilgan mahsulotlar'}
          </h3>
          
          {activeMode === 'dokondagi' ? (
            // Dokondagi mahsulotlar
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mahsulot qidirish (nomi, barcode, modeli)
                </label>
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Mahsulot nomi, barcode yoki modelini kiriting..."
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="max-h-96 overflow-y-auto space-y-2">
                {filteredProducts.length > 0 ? (
                  filteredProducts.map((product) => (
                    <div
                      key={product.id}
                      onClick={() => setSelectedProduct(product)}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedProduct?.id === product.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{product.name}</p>
                          <p className="text-sm text-gray-600">
                            Mavjud: {product.quantity} dona | Narxi: {formatCurrency(product.price)}
                          </p>
                          {product.barcode && (
                            <p className="text-xs text-gray-500">Barcode: {product.barcode}</p>
                          )}
                          {product.model && (
                            <p className="text-xs text-gray-500">Model: {product.model}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-900">
                            {formatCurrency(product.price * product.quantity)}
                          </p>
                          <p className="text-xs text-gray-500">Jami qiymati</p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    {productSearch ? 'Qidiruv natijasi topilmadi' : 'Mahsulotlar mavjud emas'}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sotilgan mahsulot qidirish (nomi, barcode, modeli)
                </label>
                <input
                  type="text"
                  value={soldProductSearch}
                  onChange={(e) => setSoldProductSearch(e.target.value)}
                  placeholder="Mahsulot nomi, barcode yoki modelini kiriting..."
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {groupedSold.length > 0 ? (
                  groupedSold.map((gp) => (
                    <div
                      key={gp.productId}
                      onClick={() => {
                        setSelectedProduct({
                          id: gp.productId,
                          name: gp.name,
                          model: gp.model,
                          barcode: gp.barcode,
                          price: gp.price,
                          quantity: gp.remaining,
                        });
                        setActionType('DEFECTIVE');
                      }}
                      className={`flex items-center justify-between p-3 bg-white border rounded cursor-pointer ${selectedProduct?.id === gp.productId ? 'border-blue-500 bg-blue-50' : ''}`}
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium">{gp.name}</p>
                        <p className="text-xs text-gray-600">
                          {gp.model ? `${gp.model} · ` : ''}{gp.barcode ? `Barcode: ${gp.barcode} · ` : ''}
                          Sotilgan: {gp.totalSold} dona · Brak qilingan: {gp.defective || 0} dona · Qolgan: {gp.remaining} dona
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">Mos sotilgan mahsulot topilmadi</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Action Form - both modes */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Amaliyot</h3>
          
          {selectedProduct ? (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">Tanlangan mahsulot:</h4>
                <p className="text-blue-800">{selectedProduct.name}</p>
                <p className="text-sm text-blue-700">
                  Mavjud: {selectedProduct.quantity} dona | Narxi: {formatCurrency(selectedProduct.price)}
                </p>
                {selectedProduct.barcode && (
                  <p className="text-xs text-blue-600">Barcode: {selectedProduct.barcode}</p>
                )}
                {selectedProduct.model && (
                  <p className="text-xs text-blue-600">Model: {selectedProduct.model}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Amaliyot turi
                </label>
                <select
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="DEFECTIVE">Brak qilish</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Miqdori
                </label>
                <input
                  type="number"
                  min="1"
                  max={selectedProduct.quantity}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Mavjud: {selectedProduct.quantity} dona
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sababi
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Amaliyot sababini yozing..."
                />
              </div>

              <button
                onClick={async () => {
                  // Har ikkala rejim uchun bir xil amaliyot: defective-logs ga yozish
                  handleAction();
                }}
                disabled={loading || !quantity || !description}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "Amalga oshirilmoqda..." : "Amalga oshirish"}
              </button>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              {activeMode === 'dokondagi' ? 'Dokondagi mahsulotlardan birini tanlang' : 'Sotilgan mahsulotlardan birini tanlang'}
            </div>
          )}
        </div>
      </div>

      {/* Action Confirmation Modal */}
      {showActionModal && modalData.item && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-xl font-semibold text-gray-900">
                Brak qilish
              </h3>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <p className="text-gray-600 mb-2">
                  <strong>Mahsulot:</strong> {modalData.item.product?.name}
                </p>
                <p className="text-gray-600 mb-2">
                  <strong>Mijoz:</strong> {modalData.customer?.fullName || 'Noma\'lum'}
                </p>
                <p className="text-gray-600 mb-2">
                  <strong>Mavjud tranzaksiya miqdori:</strong> {modalData.item.quantity} dona
                </p>
                <p className="text-gray-600 mb-2">
                  <strong>Narxi:</strong> {formatCurrency(modalData.item.price)}
                </p>
                <div className="grid grid-cols-1 gap-3 mt-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Miqdori</label>
                    <input
                      type="number"
                      min={1}
                      max={modalData.item.quantity}
                      value={modalQuantity}
                      onChange={(e) => setModalQuantity(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">Max: {modalData.item.quantity} dona</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sabab</label>
                    <textarea
                      rows={3}
                      value={modalDescription}
                      onChange={(e) => setModalDescription(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Brak sababi..."
                    />
                  </div>
                </div>
                
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-sm text-yellow-800">
                    <strong>Eslatma:</strong> Bu mahsulot tranzaksiyadan brakga o\'tadi.
                  </p>
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowActionModal(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Bekor qilish
                </button>
                <button
                  onClick={() => handleTransactionItemAction('DEFECTIVE', modalData.item, modalData.transaction)}
                  disabled={loading || !modalDescription || !modalQuantity}
                  className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {loading ? 'Jarayonda...' : 'Brak qilish'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DefectiveManagement;
