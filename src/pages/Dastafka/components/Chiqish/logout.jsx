import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Logout.module.css';

function Logout({ onConfirm, onCancel }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const navigate = useNavigate();

  const handleLogoutClick = () => {
    setShowConfirm(true);
  };

  const handleConfirm = () => {
    localStorage.removeItem('userRole');
    localStorage.removeItem('user');
    localStorage.removeItem('userId');
    onConfirm();
    navigate('/', { replace: true });
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <h2>Rostan ham chiqib ketmoqchimisiz?</h2>
        <div className={styles.btnGroup}>
          <button
            className={`${styles.btn} ${styles.cancel}`}
            onClick={onCancel}
          >
            Yo‘q, ortga
          </button>
          <button
            className={`${styles.btn} ${styles.confirm}`}
            onClick={handleLogoutClick}
          >
            Ha, albatta
          </button>
        </div>

        {showConfirm && (
          <div className={styles.confirmOverlay}>
            <div className={styles.confirmModal}>
              <p>Aniq tark etmoqchimisiz?</p>
              <div className={styles.modalButtons}>
                <button
                  className={`${styles.btn} ${styles.cancel}`}
                  onClick={() => setShowConfirm(false)}
                >
                  Yo‘q
                </button>
                <button
                  className={`${styles.btn} ${styles.confirm}`}
                  onClick={handleConfirm}
                >
                  Ha
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Logout;