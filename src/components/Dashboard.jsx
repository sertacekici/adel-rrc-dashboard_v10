import React from 'react';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';

const Dashboard = () => {
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
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>Firebase Dashboard</h1>
        <button className="logout-button" onClick={handleLogout}>
          Logout
        </button>
      </div>
      <div className="dashboard-content">
        <div className="welcome-section">
          <h2>Welcome to your Dashboard</h2>
          <p>You have successfully logged in to the Firebase Dashboard.</p>
        </div>
        <div className="dashboard-grid">
          <div className="dashboard-card">
            <h3>User Management</h3>
            <p>Manage user accounts and permissions</p>
          </div>
          <div className="dashboard-card">
            <h3>Database</h3>
            <p>View and manage your Firebase database</p>
          </div>
          <div className="dashboard-card">
            <h3>Analytics</h3>
            <p>View usage statistics and analytics</p>
          </div>
          <div className="dashboard-card">
            <h3>Settings</h3>
            <p>Configure your application settings</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
