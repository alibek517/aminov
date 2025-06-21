import React, { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { X, Camera, AlertCircle } from 'lucide-react';

const BarcodeScanner = ({ onScan, onClose, isOpen }) => {
  const scannerRef = useRef(null);
  const [scanner, setScanner] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState('');
  const [hasPermission, setHasPermission] = useState(null);

  useEffect(() => {
    if (isOpen && !scanner && scannerRef.current) {
      initializeScanner();
    }

    return () => {
      if (scanner) {
        cleanupScanner();
      }
    };
  }, [isOpen, scannerRef.current]);

  const initializeScanner = async () => {
    try {
      setError('');
      setIsScanning(true);

      // Kamera ruxsatini tekshirish
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop()); // Test uchun stream ni yopish
      setHasPermission(true);

      // Wait a bit to ensure DOM element is ready
      await new Promise(resolve => setTimeout(resolve, 100));

      if (!scannerRef.current) {
        throw new Error('Scanner element not available');
      }

      const html5QrcodeScanner = new Html5QrcodeScanner(
        scannerRef.current,
        { 
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
          showTorchButtonIfSupported: true,
          showZoomSliderIfSupported: true,
          defaultZoomValueIfSupported: 2
        },
        false
      );

      html5QrcodeScanner.render(
        (decodedText, decodedResult) => {
          console.log('Barcode scanned:', decodedText);
          onScan(decodedText);
          cleanupScanner();
        },
        (error) => {
          // Scanner xatolari - bu normal holat, har bir frame uchun
          // console.log('Scanner error:', error);
        }
      );

      setScanner(html5QrcodeScanner);
      setIsScanning(true);

    } catch (err) {
      console.error('Scanner initialization error:', err);
      setHasPermission(false);
      setError('Kameraga ruxsat berilmagan yoki kamera mavjud emas');
      setIsScanning(false);
    }
  };

  const cleanupScanner = () => {
    if (scanner) {
      try {
        scanner.clear();
      } catch (err) {
        console.error('Scanner cleanup error:', err);
      }
      setScanner(null);
      setIsScanning(false);
    }
  };

  const handleClose = () => {
    cleanupScanner();
    onClose();
  };

  const handleRetry = () => {
    setError('');
    setHasPermission(null);
    initializeScanner();
  };

  if (!isOpen) return null;

  return (
    <div className="scanner-overlay">
      <div className="scanner-modal">
        <div className="scanner-header">
          <h3><Camera size={20} /> Barcode Scanner</h3>
          <button onClick={handleClose} className="close-btn">
            <X size={20} />
          </button>
        </div>
        
        <div className="scanner-content">
          {error ? (
            <div className="scanner-error">
              <AlertCircle size={48} color="#ef4444" />
              <p>{error}</p>
              <button onClick={handleRetry} className="retry-btn">
                Qayta urinish
              </button>
              <div className="scanner-help">
                <h4>Yordam:</h4>
                <ul>
                  <li>Brauzerda kameraga ruxsat bering</li>
                  <li>HTTPS protokolidan foydalaning</li>
                  <li>Kamera ulangan va ishlaydigan ekanligini tekshiring</li>
                </ul>
              </div>
            </div>
          ) : hasPermission === false ? (
            <div className="scanner-permission">
              <AlertCircle size={48} color="#f59e0b" />
              <p>Kameraga ruxsat kerak</p>
              <button onClick={handleRetry} className="retry-btn">
                Ruxsat berish
              </button>
            </div>
          ) : (
            <>
              <div ref={scannerRef}></div>
              <div className="scanner-instructions">
                <p className="scanner-instruction">
                  📱 Mahsulot barkodini kameraga yaqinlashtiring
                </p>
                <p className="scanner-tip">
                  💡 Yaxshi yorug'lik va barqaror qo'l kerak
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default BarcodeScanner;