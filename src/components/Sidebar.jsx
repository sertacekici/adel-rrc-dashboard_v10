import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import './Sidebar.css';

const Sidebar = ({ isOpen, toggleSidebar }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };
  
  // Rol kodunu kullanıcı dostu metne dönüştür
  const getRoleName = (roleCode) => {
    const roleMap = {
      'sirket_yoneticisi': 'Şirket Yöneticisi',
      'sube_yoneticisi': 'Şube Yöneticisi',
      'personel': 'Personel',
      'kurye': 'Kurye',
      'muhasebe': 'Muhasebe',
      'depo': 'Depo'
    };
    
    return roleMap[roleCode] || 'Kullanıcı';
  };
  
  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Çıkış yapılırken bir hata oluştu:', error);
    }
  };

  // Mobilde rota değişince yan menüyü otomatik kapat
  useEffect(() => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 1024;
    if (isOpen && isMobile) {
      toggleSidebar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const handleItemClick = () => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 1024;
    if (isOpen && isMobile) {
      toggleSidebar();
    }
  };
  
  const menuItems = [
    {
      title: 'Ana Sayfa',
      path: '/dashboard',
      icon: 'dashboard',
    },
    {
      title: 'Kullanıcılar',
      path: '/users',
      icon: 'people',
    },
    {
      title: 'Şubeler',
      path: '/subeler',
      icon: 'business',
    },
    {
      title: 'Masalar',
      path: '/masalar',
      icon: 'table_restaurant',
    },
    {
      title: 'Adisyonlar',
      path: '/adisyonlar',
      icon: 'receipt_long',
    },
    {
      title: 'Satış Adetleri',
      path: '/satis-adetleri',
      icon: 'trending_up',
    },
  ];

  const subeMenuItems = [
    {
      title: 'Ürün İşlemleri',
      path: '/urun-islemleri',
      icon: 'inventory_2',
    },
    {
      title: 'Şube Sipariş Oluşturma',
      path: '/sube-siparis-olusturma',
      icon: 'add_shopping_cart',
    },
    {
      title: 'Şube Sipariş Takip',
      path: '/sube-siparis-takip',
      icon: 'local_shipping',
    },
    {
      title: 'Şube Bakiye Takip',
      path: '/sube-bakiye-takip',
      icon: 'account_balance_wallet',
    },
  ];

  const kuryeMenuItems = [
    {
      title: 'Kurye Atama İşlemleri',
      path: '/kurye-atama',
      icon: 'assignment_ind',
    },
    {
      title: 'Kurye Raporu',
      path: '/kurye-raporu',
      icon: 'assessment',
    },
    {
      title: 'Detaylı Kurye Raporu',
      path: '/detayli-kurye-raporu',
      icon: 'insights',
    },
  ];

  const giderMenuItems = [
    {
      title: 'Gider Kalemi Kaydı',
      path: '/gider-kalemi-kaydi',
      icon: 'category',
    },
    {
      title: 'Gider Kaydı',
      path: '/gider-kaydi',
      icon: 'receipt',
    },
  ];

  const raporMenuItems = [
    {
      title: 'Genel Rapor',
      path: '/genel-rapor',
      icon: 'analytics',
    },
    {
      title: 'İptal Raporları',
      path: '/iptal-raporlari',
      icon: 'block',
    },
  ];

  return (
    <>
      <div className={`sidebar ${isOpen ? 'open' : ''} ${isCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <div className="logo">
            <span className="material-icons">restaurant</span>
            <h2>Adel RRC</h2>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="toggle-button" onClick={toggleCollapse}>
              <span className="material-icons">
                {isCollapsed ? 'keyboard_arrow_right' : 'keyboard_arrow_left'}
              </span>
            </button>
            <button className="close-sidebar" onClick={toggleSidebar}>
              <span className="material-icons">menu_open</span>
            </button>
          </div>
        </div>
        
        <div className="sidebar-menu">
          {currentUser?.role !== 'kurye' && (
            <div className="menu-section">
              <p className="menu-label">Menü</p>
              <ul className="menu-items">
                {menuItems.map((item) => (
                  <li 
                    key={item.path} 
                    className={location.pathname === item.path ? 'active' : ''}
                  >
                    <Link to={item.path} data-title={item.title} onClick={handleItemClick}>
                      <span className="material-icons">{item.icon}</span>
                      <span className="menu-title">{item.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {currentUser?.role !== 'kurye' && (
            <div className="menu-section">
              <p className="menu-label">Şube İşlemleri</p>
              <ul className="menu-items">
                {subeMenuItems.map((item) => {
                  // Rol kontrolleri
                  const userRole = currentUser?.role;
                  const isCompanyManager = userRole === 'sirket_yoneticisi';
                  const isBranchManager = userRole === 'sube_yoneticisi';
                  
                  // Ürün İşlemleri sadece şirket yöneticisi görebilir
                  if (item.path === '/urun-islemleri' && !isCompanyManager) {
                    return null;
                  }
                  
                  // Şube yöneticisi sadece belirli sayfaları görebilir
                  if (isBranchManager && !['/sube-siparis-olusturma', '/sube-bakiye-takip'].includes(item.path)) {
                    return null;
                  }

                  return (
                    <li 
                      key={item.path} 
                      className={location.pathname === item.path ? 'active' : ''}
                    >
                      <Link to={item.path} data-title={item.title} onClick={handleItemClick}>
                        <span className="material-icons">{item.icon}</span>
                        <span className="menu-title">{item.title}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="menu-section">
            <p className="menu-label">Kurye İşlemleri</p>
            <ul className="menu-items">
              {kuryeMenuItems.map((item) => {
                // Rol kontrolleri
                const userRole = currentUser?.role;
                const isCompanyManager = userRole === 'sirket_yoneticisi';
                const isBranchManager = userRole === 'sube_yoneticisi';
                const isCourier = userRole === 'kurye';
                
                // Kurye işlemlerini görebilecek roller
                if (!isCompanyManager && !isBranchManager && !isCourier) {
                  return null;
                }

                // Şirket yöneticisi "Kurye Atama İşlemleri" sayfasını göremesin
                if (isCompanyManager && item.path === '/kurye-atama') {
                  return null;
                }

                return (
                  <li 
                    key={item.path} 
                    className={location.pathname === item.path ? 'active' : ''}
                  >
                    <Link to={item.path} data-title={item.title} onClick={handleItemClick}>
                      <span className="material-icons">{item.icon}</span>
                      <span className="menu-title">{item.title}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Gider İşlemleri - Sadece şirket yöneticisi ve şube müdürü görebilir */}
          {(currentUser?.role === 'sirket_yoneticisi' || currentUser?.role === 'sube_yoneticisi') && (
            <div className="menu-section">
              <p className="menu-label">Gider İşlemleri</p>
              <ul className="menu-items">
                {giderMenuItems.map((item) => (
                  <li 
                    key={item.path} 
                    className={location.pathname === item.path ? 'active' : ''}
                  >
                    <Link to={item.path} data-title={item.title} onClick={handleItemClick}>
                      <span className="material-icons">{item.icon}</span>
                      <span className="menu-title">{item.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Genel Rapor - Sadece şirket yöneticisi ve şube müdürü görebilir */}
          {(currentUser?.role === 'sirket_yoneticisi' || currentUser?.role === 'sube_yoneticisi') && (
            <div className="menu-section">
              <p className="menu-label">Raporlar</p>
              <ul className="menu-items">
                {raporMenuItems.map((item) => (
                  <li 
                    key={item.path} 
                    className={location.pathname === item.path ? 'active' : ''}
                  >
                    <Link to={item.path} data-title={item.title}>
                      <span className="material-icons">{item.icon}</span>
                      <span className="menu-title">{item.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">
              <span className="material-icons">account_circle</span>
            </div>
            <div className="user-details">
              <p className="user-name">{currentUser?.displayName || 'Kullanıcı'}</p>
              <p className="user-role">{getRoleName(currentUser?.role)}</p>
              {currentUser?.subeId && currentUser.role !== 'sirket_yoneticisi' && (
                <p className="user-store">
                  {currentUser.subeAdi ? `${currentUser.subeAdi} (ID: ${currentUser.subeId})` : `Şube ID: ${currentUser.subeId}`}
                </p>
              )}
            </div>
          </div>
          <button onClick={handleLogout} className="logout-button">
            <span className="material-icons">logout</span>
            <span className="logout-text">Çıkış Yap</span>
          </button>
        </div>
      </div>
      
      {isOpen && <div className="sidebar-overlay" onClick={toggleSidebar}></div>}
    </>
  );
};

export default Sidebar;
