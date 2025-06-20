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
  X
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
        { id: '1', name: 'Coca Cola 0.5L', price: 8000, quantity: 50, barcode: '123456789', category: 'ichimlik' },
        { id: '2', name: 'Non', price: 2000, quantity: 30, barcode: '987654321', category: 'oziq-ovqat' },
        { id: '3', name: 'Sut 1L', price: 12000, quantity: 25, barcode: '456789123', category: 'ichimlik' }
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
    setCart([]);
  };

  // Barcode scanner
  const handleBarcodeScan = (barcode) => {
    const product = products.find(p => p.barcode === barcode);
    if (product) {
      addToCart(product);
      setShowScanner(false);
    } else {
      alert('Mahsulot topilmadi!');
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
            <h2><Package size={20} /> Mahsulotlar</h2>
            <div className="products-actions">
              <button 
                onClick={() => setShowScanner(true)} 
                className="btn-scanner"
              >
                <Scan size={16} /> Scanner
              </button>
              <button 
                onClick={() => setShowProductModal(true)} 
                className="btn-add-product"
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
                placeholder="Mahsulot qidirish..."
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
            {filteredProducts.map(product => (
              <div key={product.id} className="product-card">
                <div className="product-info">
                  <h3>{product.name}</h3>
                  <p className="product-price">{product.price.toLocaleString()} so'm</p>
                  <p className="product-quantity">
                    Qolgan: <span className={product.quantity <= 5 ? 'low-stock' : ''}>{product.quantity}</span>
                  </p>
                  {product.barcode && (
                    <p className="product-barcode">Barcode: {product.barcode}</p>
                  )}
                </div>
                <div className="product-actions">
                  <button 
                    onClick={() => addToCart(product)}
                    className="btn-add-cart"
                    disabled={product.quantity <= 0}
                  >
                    <ShoppingCart size={16} />
                  </button>
                  <button 
                    onClick={() => handleEditProduct(product)}
                    className="btn-edit"
                  >
                    <Edit size={16} />
                  </button>
                  <button 
                    onClick={() => handleDeleteProduct(product.id)}
                    className="btn-delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cart Section */}
        <div className="cart-section">
          <div className="cart-header">
            <h2><ShoppingCart size={20} /> Savat</h2>
            {cart.length > 0 && (
              <button onClick={clearCart} className="btn-clear-cart">
                <Trash2 size={16} /> Tozalash
              </button>
            )}
          </div>

          <div className="cart-items">
            {cart.length === 0 ? (
              <p className="empty-cart">Savat bo'sh</p>
            ) : (
              cart.map(item => (
                <div key={item.id} className="cart-item">
                  <div className="cart-item-info">
                    <h4>{item.name}</h4>
                    <p>{item.price.toLocaleString()} so'm</p>
                  </div>
                  <div className="cart-item-controls">
                    <button onClick={() => removeFromCart(item.id)}>
                      <Minus size={16} />
                    </button>
                    <span>{item.soldQuantity}</span>
                    <button onClick={() => addToCart(item)}>
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
              <h3>To'lov</h3>
              <button onClick={() => setShowPayment(false)} className="close-btn">
                <X size={20} />
              </button>
            </div>
            <div className="payment-content">
              <div className="payment-summary">
                <h4>Jami to'lov: {cartTotal.toLocaleString()} so'm</h4>
              </div>
              <div className="payment-input">
                <label>To'langan miqdor:</label>
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
                  <h4>Qaytim: {(parseFloat(paidAmount) - cartTotal).toLocaleString()} so'm</h4>
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
                  Tasdiqlash
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