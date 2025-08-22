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
    localStorage.clear();
    onConfirm();
    navigate('/', { replace: true });
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <h2>Ростан хам чиқиб кетмоқчимисиз?</h2>
        <div className={styles.btnGroup}>
          <button
            className={`${styles.btn} ${styles.cancel}`}
            onClick={onCancel}
          >
            Йўқ, ортга
          </button>
          <button
            className={`${styles.btn} ${styles.confirm}`}
            onClick={handleLogoutClick}
          >
            Ха, албатта
          </button>
        </div>

        {showConfirm && (
          <div className={styles.confirmOverlay}>
            <div className={styles.confirmModal}>
              <p>Аниқ тарк этмоқчимисиз?</p>
              <div className={styles.modalButtons}>
                <button
                  className={`${styles.btn} ${styles.cancel}`}
                  onClick={() => setShowConfirm(false)}
                >
                  Йўқ
                </button>
                <button
                  className={`${styles.btn} ${styles.confirm}`}
                  onClick={handleConfirm}
                >
                  Ха
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