import React, { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { X, Camera } from 'lucide-react';

const BarcodeScanner = ({ onScan, onClose, isOpen }) => {
  const scannerRef = useRef(null);
  const [scanner, setScanner] = useState(null);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    if (isOpen && !scanner) {
      const html5QrcodeScanner = new Html5QrcodeScanner(
        "qr-reader",
        { 
          fps: 10, 
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0
        },
        false
      );

      html5QrcodeScanner.render(
        (decodedText) => {
          onScan(decodedText);
          html5QrcodeScanner.clear();
          setScanner(null);
          setIsScanning(false);
        },
        (error) => {
          // Scanner xatolari
        }
      );

      setScanner(html5QrcodeScanner);
      setIsScanning(true);
    }

    return () => {
      if (scanner) {
        scanner.clear();
        setScanner(null);
        setIsScanning(false);
      }
    };
  }, [isOpen, onScan, scanner]);

  if (!isOpen) return null;

  return (
    <div className="scanner-overlay">
      <div className="scanner-modal">
        <div className="scanner-header">
          <h3><Camera size={20} /> Barcode Scanner</h3>
          <button onClick={onClose} className="close-btn">
            <X size={20} />
          </button>
        </div>
        <div className="scanner-content">
          <div id="qr-reader" ref={scannerRef}></div>
          <p className="scanner-instruction">
            Mahsulot barkodini kameraga yaqinlashtiring
          </p>
        </div>
      </div>
    </div>
  );
};

export default BarcodeScanner;