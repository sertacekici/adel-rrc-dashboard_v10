import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import './TopBar.css';

let deferredPrompt = null;

const TopBar = ({ toggleSidebar }) => {
  const navigate = useNavigate();
  const [installable, setInstallable] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      deferredPrompt = e;
      setInstallable(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // Zaten yüklüyse gösterme
    window.addEventListener('appinstalled', () => {
      deferredPrompt = null;
      setInstallable(false);
    });

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallable(false);
    }
    deferredPrompt = null;
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };
  
  return (
    <div className="topbar">
      <div className="topbar-left">
        <button className="menu-toggle" onClick={toggleSidebar}>
          <span className="material-icons">menu</span>
        </button>
        <h1>Yönetim Paneli</h1>
      </div>
      
      <div className="topbar-right">
        {installable && (
          <button className="install-btn" onClick={handleInstall}>
            <span className="material-icons">install_mobile</span>
            <span>Yükle</span>
          </button>
        )}
        <button className="logout-button-top" onClick={handleLogout}>
          <span className="material-icons">logout</span>
          <span>Çıkış Yap</span>
        </button>
      </div>
    </div>
  );
};

export default TopBar;
