import React, { useState, useEffect } from 'react';
import { 
  Package, 
  ShoppingCart, 
  Plus, 
  Minus, 
  Search, 
  Scan, 
  Trash2, 
  Calculator,
  Receipt,
  Edit,
  BarChart3,
  LogOut,
  X,
  AlertTriangle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ProductModal from '../../components/ProductModal';
import BarcodeScanner from '../../components/BarcodeScanner';
import ReceiptComponent from '../../components/Receipt';
import './Menyu.css';

const Menyu = () => {
  const navigate = useNavigate();
  const user = localStorage.getItem('user');
  
  // State management
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showProductModal, setShowProductModal] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [receiptData, setReceiptData] = useState(null);
  const [paidAmount, setPaidAmount] = useState('');
  const [showPayment, setShowPayment] = useState(false);

  // Load data from localStorage
  useEffect(() => {
    const savedProducts = localStorage.getItem('products');
    if (savedProducts) {
      setProducts(JSON.parse(savedProducts));
    } else {
      // Demo mahsulotlar
      const demoProducts = [
        { id: '1', name: 'Coca Cola 0.5L', price: 8000, quantity: 50, barcode: '123456789012', category: 'ichimlik' },
        { id: '2', name: 'Non', price: 2000, quantity: 30, barcode: '987654321098', category: 'oziq-ovqat' },
        { id: '3', name: 'Sut 1L', price: 12000, quantity: 25, barcode: '456789123456', category: 'ichimlik' },
        { id: '4', name: 'Olma 1kg', price: 15000, quantity: 40, barcode: '789123456789', category: 'oziq-ovqat' },
        { id: '5', name: 'Shampun', price: 25000, quantity: 15, barcode: '321654987321', category: 'boshqa' }
      ];
      setProducts(demoProducts);
      localStorage.setItem('products', JSON.stringify(demoProducts));
    }
  }, []);

  // Save products to localStorage
  useEffect(() => {
    localStorage.setItem('products', JSON.stringify(products));
  }, [products]);

  // Filter products
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.barcode.includes(searchTerm);
    const matchesCategory = !selectedCategory || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Product management
  const handleSaveProduct = (productData) => {
    if (editingProduct) {
      setProducts(products.map(p => p.id === editingProduct.id ? productData : p));
    } else {
      setProducts([...products, productData]);
    }
    setEditingProduct(null);
  };

  const handleEditProduct = (product) => {
    setEditingProduct(product);
    setShowProductModal(true);
  };

  const handleDeleteProduct = (productId) => {
    if (confirm('Bu mahsulotni o\'chirmoqchimisiz?')) {
      setProducts(products.filter(p => p.id !== productId));
    }
  };

  // Cart management
  const addToCart = (product) => {
    if (product.quantity <= 0) {
      alert('Bu mahsulot tugagan!');
      return;
    }

    const existingItem = cart.find(item => item.id === product.id);
    if (existingItem) {
      if (existingItem.soldQuantity < product.quantity) {
        setCart(cart.map(item => 
          item.id === product.id 
            ? { ...item, soldQuantity: item.soldQuantity + 1 }
            : item
        ));
      } else {
        alert('Yetarli miqdor yo\'q!');
      }
    } else {
      setCart([...cart, { ...product, soldQuantity: 1 }]);
    }
  };

  const removeFromCart = (productId) => {
    const existingItem = cart.find(item => item.id === productId);
    if (existingItem && existingItem.soldQuantity > 1) {
      setCart(cart.map(item => 
        item.id === productId 
          ? { ...item, soldQuantity: item.soldQuantity - 1 }
          : item
      ));
    } else {
      setCart(cart.filter(item => item.id !== productId));
    }
  };

  const clearCart = () => {
    if (confirm('Savatni tozalamoqchimisiz?')) {
      setCart([]);
    }
  };

  // Barcode scanner
  const handleBarcodeScan = (barcode) => {
    console.log('Scanned barcode:', barcode);
    const product = products.find(p => p.barcode === barcode.trim());
    if (product) {
      addToCart(product);
      setShowScanner(false);
      // Success notification
      const notification = document.createElement('div');
      notification.innerHTML = `✅ ${product.name} savatga qo'shildi!`;
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        z-index: 10000;
        font-weight: 500;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      `;
      document.body.appendChild(notification);
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 3000);
    } else {
      alert(`Barcode "${barcode}" bilan mahsulot topilmadi!\n\nMavjud barkodlar:\n${products.map(p => `${p.name}: ${p.barcode}`).join('\n')}`);
    }
  };

  // Payment and receipt
  const cartTotal = cart.reduce((total, item) => total + (item.price * item.soldQuantity), 0);

  const handlePayment = () => {
    if (cart.length === 0) {
      alert('Savat bo\'sh!');
      return;
    }
    setShowPayment(true);
  };

  const processSale = () => {
    const paid = parseFloat(paidAmount);
    if (paid < cartTotal) {
      alert('To\'lov miqdori yetarli emas!');
      return;
    }

    // Update product quantities
    const updatedProducts = products.map(product => {
      const cartItem = cart.find(item => item.id === product.id);
      if (cartItem) {
        return { ...product, quantity: product.quantity - cartItem.soldQuantity };
      }
      return product;
    });
    setProducts(updatedProducts);

    // Create receipt data
    const saleData = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      cashier: user,
      items: cart,
      total: cartTotal,
      paid: paid,
      change: paid - cartTotal
    };

    // Save sale to history
    const salesHistory = JSON.parse(localStorage.getItem('salesHistory') || '[]');
    salesHistory.push(saleData);
    localStorage.setItem('salesHistory', JSON.stringify(salesHistory));

    setReceiptData(saleData);
    setShowReceipt(true);
    setCart([]);
    setPaidAmount('');
    setShowPayment(false);
  };

  const categories = [
    { value: '', label: 'Barcha kategoriyalar' },
    { value: 'oziq-ovqat', label: 'Oziq-ovqat' },
    { value: 'ichimlik', label: 'Ichimlik' },
    { value: 'kiyim', label: 'Kiyim' },
    { value: 'elektronika', label: 'Elektronika' },
    { value: 'boshqa', label: 'Boshqa' }
  ];

  return (
    <div className="kasir-container">
      {/* Header */}
      <header className="kasir-header">
        <div className="header-left">
          <h1><Calculator size={24} /> Kasir CRM</h1>
          <span className="user-info">Salom, {user}!</span>
        </div>
        <div className="header-right">
          <button onClick={() => navigate('/logout')} className="logout-btn">
            <LogOut size={16} /> Chiqish
          </button>
        </div>
      </header>

      <div className="kasir-content">
        {/* Products Section */}
        <div className="products-section">
          <div className="products-header">
            <h2><Package size={20} /> Mahsulotlar ({filteredProducts.length})</h2>
            <div className="products-actions">
              <button 
                onClick={() => setShowScanner(true)} 
                className="btn-scanner"
                title="Barcode scanner ochish"
              >
                <Scan size={16} /> Scanner
              </button>
              <button 
                onClick={() => setShowProductModal(true)} 
                className="btn-add-product"
                title="Yangi mahsulot qo'shish"
              >
                <Plus size={16} /> Yangi mahsulot
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="filters">
            <div className="search-box">
              <Search size={16} />
              <input
                type="text"
                placeholder="Mahsulot nomi yoki barcode bilan qidirish..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="category-filter"
            >
              {categories.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </div>

          {/* Products Grid */}
          <div className="products-grid">
            {filteredProducts.length === 0 ? (
              <div style={{ 
                gridColumn: '1 / -1', 
                textAlign: 'center', 
                padding: '2rem',
                color: '#64748b',
                fontStyle: 'italic'
              }}>
                <Package size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                <p>Mahsulot topilmadi</p>
              </div>
            ) : (
              filteredProducts.map(product => (
                <div key={product.id} className="product-card">
                  <div className="product-info">
                    <h3>{product.name}</h3>
                    <p className="product-price">{product.price.toLocaleString()} so'm</p>
                    <p className="product-quantity">
                      Qolgan: <span className={product.quantity <= 5 ? 'low-stock' : ''}>{product.quantity}</span>
                      {product.quantity <= 5 && <AlertTriangle size={14} style={{ marginLeft: '4px', color: '#ef4444' }} />}
                    </p>
                    {product.barcode && (
                      <p className="product-barcode">📊 {product.barcode}</p>
                    )}
                    {product.category && (
                      <p className="product-category" style={{ 
                        fontSize: '0.75rem', 
                        color: '#64748b',
                        textTransform: 'capitalize'
                      }}>
                        🏷️ {product.category}
                      </p>
                    )}
                  </div>
                  <div className="product-actions">
                    <button 
                      onClick={() => addToCart(product)}
                      className="btn-add-cart"
                      disabled={product.quantity <= 0}
                      title={product.quantity <= 0 ? 'Mahsulot tugagan' : 'Savatga qo\'shish'}
                    >
                      <ShoppingCart size={16} />
                    </button>
                    <button 
                      onClick={() => handleEditProduct(product)}
                      className="btn-edit"
                      title="Tahrirlash"
                    >
                      <Edit size={16} />
                    </button>
                    <button 
                      onClick={() => handleDeleteProduct(product.id)}
                      className="btn-delete"
                      title="O'chirish"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Cart Section */}
        <div className="cart-section">
          <div className="cart-header">
            <h2><ShoppingCart size={20} /> Savat ({cart.length})</h2>
            {cart.length > 0 && (
              <button onClick={clearCart} className="btn-clear-cart" title="Savatni tozalash">
                <Trash2 size={16} /> Tozalash
              </button>
            )}
          </div>

          <div className="cart-items">
            {cart.length === 0 ? (
              <div className="empty-cart">
                <ShoppingCart size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                <p>Savat bo'sh</p>
                <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                  Mahsulot qo'shish uchun "Scanner" tugmasini bosing yoki mahsulot kartasidagi savat tugmasini bosing
                </p>
              </div>
            ) : (
              cart.map(item => (
                <div key={item.id} className="cart-item">
                  <div className="cart-item-info">
                    <h4>{item.name}</h4>
                    <p>{item.price.toLocaleString()} so'm</p>
                  </div>
                  <div className="cart-item-controls">
                    <button 
                      onClick={() => removeFromCart(item.id)}
                      title="Kamaytirish"
                    >
                      <Minus size={16} />
                    </button>
                    <span>{item.soldQuantity}</span>
                    <button 
                      onClick={() => addToCart(item)}
                      title="Ko'paytirish"
                      disabled={item.soldQuantity >= item.quantity}
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                  <div className="cart-item-total">
                    {(item.price * item.soldQuantity).toLocaleString()} so'm
                  </div>
                </div>
              ))
            )}
          </div>

          {cart.length > 0 && (
            <div className="cart-footer">
              <div className="cart-total">
                <h3>Jami: {cartTotal.toLocaleString()} so'm</h3>
              </div>
              <button onClick={handlePayment} className="btn-checkout">
                <Receipt size={16} /> To'lash
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Payment Modal */}
      {showPayment && (
        <div className="modal-overlay">
          <div className="payment-modal">
            <div className="modal-header">
              <h3>💳 To'lov</h3>
              <button onClick={() => setShowPayment(false)} className="close-btn">
                <X size={20} />
              </button>
            </div>
            <div className="payment-content">
              <div className="payment-summary">
                <h4>Jami to'lov: {cartTotal.toLocaleString()} so'm</h4>
              </div>
              <div className="payment-input">
                <label>To'langan miqdor (so'm):</label>
                <input
                  type="number"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  placeholder="0"
                  min={cartTotal}
                  autoFocus
                />
              </div>
              {paidAmount && parseFloat(paidAmount) >= cartTotal && (
                <div className="change-amount">
                  <h4>💰 Qaytim: {(parseFloat(paidAmount) - cartTotal).toLocaleString()} so'm</h4>
                </div>
              )}
              <div className="payment-actions">
                <button onClick={() => setShowPayment(false)} className="btn-cancel">
                  Bekor qilish
                </button>
                <button 
                  onClick={processSale} 
                  className="btn-confirm"
                  disabled={!paidAmount || parseFloat(paidAmount) < cartTotal}
                >
                  ✅ Tasdiqlash
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <ProductModal
        isOpen={showProductModal}
        onClose={() => {
          setShowProductModal(false);
          setEditingProduct(null);
        }}
        onSave={handleSaveProduct}
        product={editingProduct}
      />

      <BarcodeScanner
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        onScan={handleBarcodeScan}
      />

      <ReceiptComponent
        isOpen={showReceipt}
        onClose={() => setShowReceipt(false)}
        saleData={receiptData}
      />
    </div>
  );
};

export default Menyu;