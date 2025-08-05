import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import PrivateRoute from './components/PrivateRoute';
import Layout from './components/Layout';
import DashboardPage from './pages/DashboardPage';
import UsersPage from './pages/UsersPage';
import DatabasePage from './pages/DatabasePage';
import AnalyticsPage from './pages/AnalyticsPage';
import SettingsPage from './pages/SettingsPage';
import SubelerPage from './pages/SubelerPage';
import SubePersonelPage from './pages/SubePersonelPage';
import MasalarPage from './pages/MasalarPage';
import AdisyonlarPage from './pages/AdisyonlarPage';
import SatisAdetleriPage from './pages/SatisAdetleriPage';
import UrunIslemleriPage from './pages/UrunIslemleriPage';
import SubeSiparisOlusturmaPage from './pages/SubeSiparisOlusturmaPage';
import SubeSiparisTakipPage from './pages/SubeSiparisTakipPage';
import SubeBakiyeTakipPage from './pages/SubeBakiyeTakipPage';
import KuryeAtamaPage from './pages/KuryeAtamaPage';
import KuryeRaporuPage from './pages/KuryeRaporuPage';
import './App.css'

// Kurye dışı roller için dashboard erişimi
const DashboardAccess = () => {
  const { currentUser } = useAuth();
  
  if (currentUser?.role === 'kurye') {
    return <Navigate to="/kurye-atama" replace />;
  }
  
  return <DashboardPage />;
};

// Root path handler - authentication kontrolü
const RootHandler = () => {
  const { currentUser, loading } = useAuth();
  
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        fontSize: '1.2rem'
      }}>
        Yükleniyor...
      </div>
    );
  }
  
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }
  
  return <Navigate to="/dashboard" replace />;
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="app">
          <Routes>
            {/* Public route - Login */}
            <Route path="/login" element={<Login />} />
            
            {/* Protected routes */}
            <Route element={<PrivateRoute />}>
              <Route element={<Layout />}>
                <Route path="/dashboard" element={<DashboardAccess />} />
                <Route path="/users" element={<UsersPage />} />
                <Route path="/database" element={<DatabasePage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/subeler" element={<SubelerPage />} />
                <Route path="/sube-personel/:subeId" element={<SubePersonelPage />} />
                <Route path="/masalar" element={<MasalarPage />} />
                <Route path="/adisyonlar" element={<AdisyonlarPage />} />
                <Route path="/satis-adetleri" element={<SatisAdetleriPage />} />
                <Route path="/urun-islemleri" element={<UrunIslemleriPage />} />
                <Route path="/sube-siparis-olusturma" element={<SubeSiparisOlusturmaPage />} />
                <Route path="/sube-siparis-takip" element={<SubeSiparisTakipPage />} />
                <Route path="/sube-bakiye-takip" element={<SubeBakiyeTakipPage />} />
                <Route path="/kurye-atama" element={<KuryeAtamaPage />} />
                <Route path="/kurye-raporu" element={<KuryeRaporuPage />} />
              </Route>
            </Route>
            
            {/* Root path handler */}
            <Route path="/" element={<RootHandler />} />
            
            {/* Catch all - redirect to home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </AuthProvider>
    </Router>
  )
}

export default App
