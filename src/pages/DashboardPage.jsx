import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import './DashboardPage.css';

const DashboardPage = () => {
  const { currentUser } = useContext(AuthContext);
  
  // Rol adını göster
  const getRoleName = (role) => {
    const roles = {
      'sirket_yoneticisi': 'Şirket Yöneticisi',
      'sube_yoneticisi': 'Şube Yöneticisi',
      'personel': 'Personel',
      'kurye': 'Kurye',
      'muhasebe': 'Muhasebe',
      'depo': 'Depo'
    };
    return roles[role] || 'Kullanıcı';
  };

  // Kısa yolları rol bazında belirle
  const getShortcuts = () => {
    const role = currentUser?.role;
    
    const allShortcuts = [
      // Şirket Yöneticisi - Tüm sayfalar
      {
        title: 'Kullanıcı Yönetimi',
        description: 'Kullanıcıları görüntüle, ekle ve düzenle',
        path: '/users',
        icon: 'people',
        color: 'blue',
        roles: ['sirket_yoneticisi']
      },
      {
        title: 'Şube Yönetimi',
        description: 'Şubeleri yönet ve takip et',
        path: '/subeler',
        icon: 'business',
        color: 'green',
        roles: ['sirket_yoneticisi']
      },
      {
        title: 'Adisyon Takibi',
        description: 'Tüm siparişleri görüntüle ve takip et',
        path: '/adisyonlar',
        icon: 'receipt_long',
        color: 'orange',
        roles: ['sirket_yoneticisi', 'sube_yoneticisi']
      },
      {
        title: 'Satış Raporları',
        description: 'Satış adetleri ve performans raporları',
        path: '/satis-adetleri',
        icon: 'trending_up',
        color: 'purple',
        roles: ['sirket_yoneticisi', 'sube_yoneticisi']
      },
      {
        title: 'Masa Yönetimi',
        description: 'Restoran masalarını yönet',
        path: '/masalar',
        icon: 'table_restaurant',
        color: 'teal',
        roles: ['sirket_yoneticisi', 'sube_yoneticisi']
      },
      
      // Şube Yöneticisi
      {
        title: 'Şube Personel',
        description: 'Şube personellerini yönet',
        path: '/sube-personel',
        icon: 'badge',
        color: 'indigo',
        roles: ['sube_yoneticisi']
      },
      {
        title: 'Ürün İşlemleri',
        description: 'Ürün bilgilerini yönet',
        path: '/urun-islemleri',
        icon: 'inventory_2',
        color: 'red',
        roles: ['sube_yoneticisi']
      },
      {
        title: 'Sipariş Oluştur',
        description: 'Yeni sipariş oluştur',
        path: '/sube-siparis-olusturma',
        icon: 'add_shopping_cart',
        color: 'amber',
        roles: ['sube_yoneticisi']
      },
      {
        title: 'Sipariş Takip',
        description: 'Şube siparişlerini takip et',
        path: '/sube-siparis-takip',
        icon: 'local_shipping',
        color: 'blue',
        roles: ['sube_yoneticisi']
      },
      {
        title: 'Bakiye Takip',
        description: 'Şube bakiyesini takip et',
        path: '/sube-bakiye-takip',
        icon: 'account_balance_wallet',
        color: 'green',
        roles: ['sube_yoneticisi']
      },
      
      // Kurye
      {
        title: 'Kurye Atama',
        description: 'Teslimat siparişlerini al',
        path: '/kurye-atama',
        icon: 'assignment_ind',
        color: 'blue',
        roles: ['kurye', 'sube_yoneticisi']
      },
      {
        title: 'Kurye Raporu',
        description: 'Teslimat raporlarını görüntüle',
        path: '/kurye-raporu',
        icon: 'analytics',
        color: 'green',
        roles: ['kurye', 'sube_yoneticisi', 'sirket_yoneticisi']
      }
    ];
    
    // Kullanıcının rolüne göre filtreleme
    return allShortcuts.filter(shortcut => 
      shortcut.roles.includes(role)
    );
  };

  const shortcuts = getShortcuts();

  return (
    <div className="dashboard-container">
      <div className="page-header">
        <div className="header-content">
          <div className="title-section">
            <h1>
              <span className="material-icons">dashboard</span>
              Dashboard
            </h1>
            <p>Hoş geldiniz, {currentUser?.displayName || 'Kullanıcı'}! Adel RRC sistemine hızlı erişim için aşağıdaki kısayolları kullanın.</p>
          </div>
          <div className="user-info">
            <div className="user-avatar">
              <span className="material-icons">person</span>
            </div>
            <div className="user-details">
              <h3>{currentUser?.displayName || 'Kullanıcı'}</h3>
              <p>{getRoleName(currentUser?.role)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="welcome-section">
        <div className="welcome-card">
          <div className="welcome-icon">
            <span className="material-icons">rocket_launch</span>
          </div>
          <div className="welcome-content">
            <h2>Hızlı İşlemler</h2>
            <p>En çok kullandığınız işlemlere hızlı erişim sağlayın</p>
          </div>
        </div>
      </div>

      <div className="shortcuts-grid">
        {shortcuts.map((shortcut, index) => (
          <Link 
            to={shortcut.path} 
            key={index} 
            className={`shortcut-card ${shortcut.color}`}
          >
            <div className="shortcut-icon">
              <span className="material-icons">{shortcut.icon}</span>
            </div>
            <div className="shortcut-content">
              <h3>{shortcut.title}</h3>
              <p>{shortcut.description}</p>
            </div>
            <div className="shortcut-arrow">
              <span className="material-icons">arrow_forward</span>
            </div>
          </Link>
        ))}
      </div>

      <div className="quick-stats">
        <div className="stat-item">
          <div className="stat-icon">
            <span className="material-icons">access_time</span>
          </div>
          <div className="stat-info">
            <h4>Son Giriş</h4>
            <p>Bugün, {new Date().toLocaleTimeString('tr-TR', { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}</p>
          </div>
        </div>
        
        <div className="stat-item">
          <div className="stat-icon">
            <span className="material-icons">verified_user</span>
          </div>
          <div className="stat-info">
            <h4>Yetki Seviyesi</h4>
            <p>{getRoleName(currentUser?.role)}</p>
          </div>
        </div>
        
        <div className="stat-item">
          <div className="stat-icon">
            <span className="material-icons">schedule</span>
          </div>
          <div className="stat-info">
            <h4>Sistem Durumu</h4>
            <p className="status-active">Aktif</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
