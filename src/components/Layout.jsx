import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import './Layout.css';

const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };
  
  return (
    <div className="layout">
      <Sidebar isOpen={sidebarOpen} toggleSidebar={toggleSidebar} />
      
      <div className={`content ${sidebarOpen ? 'sidebar-open' : ''}`}>
        {/* Floating menu button for mobile */}
        {!sidebarOpen && (
          <button className="floating-menu-btn" onClick={toggleSidebar}>
            <span className="material-icons">menu</span>
          </button>
        )}
        
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
