import React, { useState, useEffect } from 'react';
import { X, Package, DollarSign, Hash, Barcode } from 'lucide-react';

const ProductModal = ({ isOpen, onClose, onSave, product = null }) => {
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    quantity: '',
    barcode: '',
    category: ''
  });

  useEffect(() => {
    if (product) {
      setFormData(product);
    } else {
      setFormData({
        name: '',
        price: '',
        quantity: '',
        barcode: '',
        category: ''
      });
    }
  }, [product, isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.name && formData.price && formData.quantity) {
      onSave({
        ...formData,
        price: parseFloat(formData.price),
        quantity: parseInt(formData.quantity),
        id: product?.id || Date.now().toString()
      });
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3><Package size={20} /> {product ? 'Mahsulotni Tahrirlash' : 'Yangi Mahsulot'}</h3>
          <button onClick={onClose} className="close-btn">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="product-form">
          <div className="form-group">
            <label><Package size={16} /> Mahsulot nomi</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              placeholder="Mahsulot nomini kiriting"
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label><DollarSign size={16} /> Narxi (so'm)</label>
              <input
                type="number"
                value={formData.price}
                onChange={(e) => setFormData({...formData, price: e.target.value})}
                placeholder="0"
                min="0"
                step="0.01"
                required
              />
            </div>

            <div className="form-group">
              <label><Hash size={16} /> Miqdori</label>
              <input
                type="number"
                value={formData.quantity}
                onChange={(e) => setFormData({...formData, quantity: e.target.value})}
                placeholder="0"
                min="0"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label><Barcode size={16} /> Barcode</label>
            <input
              type="text"
              value={formData.barcode}
              onChange={(e) => setFormData({...formData, barcode: e.target.value})}
              placeholder="Barcode (ixtiyoriy)"
            />
          </div>

          <div className="form-group">
            <label>Kategoriya</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({...formData, category: e.target.value})}
            >
              <option value="">Kategoriyani tanlang</option>
              <option value="oziq-ovqat">Oziq-ovqat</option>
              <option value="ichimlik">Ichimlik</option>
              <option value="kiyim">Kiyim</option>
              <option value="elektronika">Elektronika</option>
              <option value="boshqa">Boshqa</option>
            </select>
          </div>

          <div className="form-actions">
            <button type="button" onClick={onClose} className="btn-cancel">
              Bekor qilish
            </button>
            <button type="submit" className="btn-save">
              {product ? 'Yangilash' : 'Saqlash'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProductModal;