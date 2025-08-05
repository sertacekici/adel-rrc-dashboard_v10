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
    return <Navigate to="/kurye-atama" />;
  }
  
  return <DashboardPage />;
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="app">
          <Routes>
            <Route path="/login" element={<Login />} />
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
            <Route path="/" element={<DashboardAccess />} />
            <Route path="/login" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </AuthProvider>
    </Router>
  )
}

export default App
