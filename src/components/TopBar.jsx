import React from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import './TopBar.css';

const TopBar = ({ toggleSidebar }) => {
  const navigate = useNavigate();
  
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
        <button className="logout-button-top" onClick={handleLogout}>
          <span className="material-icons">logout</span>
          <span>Çıkış Yap</span>
        </button>
      </div>
    </div>
  );
};

export default TopBar;
