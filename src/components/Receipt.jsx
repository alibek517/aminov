import React from 'react';
import { X, Printer, Download } from 'lucide-react';

const Receipt = ({ isOpen, onClose, saleData }) => {
  if (!isOpen || !saleData) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    const receiptContent = document.getElementById('receipt-content').innerHTML;
    const blob = new Blob([receiptContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chek-${saleData.id}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="modal-overlay">
      <div className="receipt-modal">
        <div className="receipt-header">
          <h3>Sotuv Cheki</h3>
          <div className="receipt-actions">
            <button onClick={handlePrint} className="btn-print">
              <Printer size={16} /> Chop etish
            </button>
            <button onClick={handleDownload} className="btn-download">
              <Download size={16} /> Yuklab olish
            </button>
            <button onClick={onClose} className="close-btn">
              <X size={20} />
            </button>
          </div>
        </div>

        <div id="receipt-content" className="receipt-content">
          <div className="receipt-paper">
            <div className="receipt-shop-info">
              <h2>DOKON NOMI</h2>
              <p>Manzil: Toshkent shahar</p>
              <p>Tel: +998 90 123 45 67</p>
              <div className="receipt-divider"></div>
            </div>

            <div className="receipt-info">
              <p><strong>Chek №:</strong> {saleData.id}</p>
              <p><strong>Sana:</strong> {new Date(saleData.date).toLocaleString('uz-UZ')}</p>
              <p><strong>Kasir:</strong> {saleData.cashier}</p>
              <div className="receipt-divider"></div>
            </div>

            <div className="receipt-items">
              <div className="receipt-table-header">
                <span>Mahsulot</span>
                <span>Miqdor</span>
                <span>Narx</span>
                <span>Jami</span>
              </div>
              {saleData.items.map((item, index) => (
                <div key={index} className="receipt-table-row">
                  <span>{item.name}</span>
                  <span>{item.soldQuantity}</span>
                  <span>{item.price.toLocaleString()} so'm</span>
                  <span>{(item.price * item.soldQuantity).toLocaleString()} so'm</span>
                </div>
              ))}
              <div className="receipt-divider"></div>
            </div>

            <div className="receipt-total">
              <div className="total-row">
                <span>Jami:</span>
                <span><strong>{saleData.total.toLocaleString()} so'm</strong></span>
              </div>
              <div className="total-row">
                <span>To'langan:</span>
                <span>{saleData.paid.toLocaleString()} so'm</span>
              </div>
              <div className="total-row">
                <span>Qaytim:</span>
                <span>{saleData.change.toLocaleString()} so'm</span>
              </div>
            </div>

            <div className="receipt-footer">
              <div className="receipt-divider"></div>
              <p>Xaridingiz uchun rahmat!</p>
              <p>Yana tashrif buyuring!</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Receipt;