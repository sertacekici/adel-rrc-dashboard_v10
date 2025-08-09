import React, { useState, useEffect, useContext } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { AuthContext } from '../contexts/AuthContext';
import './KuryeRaporuPage.css';

const KuryeRaporuPage = () => {
  const [subeler, setSubeler] = useState([]);
  const [kuryeler, setKuryeler] = useState([]);
  const [selectedSube, setSelectedSube] = useState('');
  const [selectedKurye, setSelectedKurye] = useState('');
  const [raporData, setRaporData] = useState([]);
  const [filteredRaporData, setFilteredRaporData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');
  const [reportMode, setReportMode] = useState('daily'); // 'daily', 'range'
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  
  // Bugünün tarihini varsayılan olarak ayarla (günlük rapor)
  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  
  const { currentUser } = useContext(AuthContext);

  // Hızlı tarih seçimi fonksiyonları
  const setDateRange = (type) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    
    let newStartDate, newEndDate;
    
    switch (type) {
      case 'today':
        newStartDate = today.toISOString().split('T')[0];
        newEndDate = today.toISOString().split('T')[0];
        setReportMode('daily');
        setSelectedDate(newStartDate);
        break;
      case 'yesterday':
        newStartDate = yesterday.toISOString().split('T')[0];
        newEndDate = yesterday.toISOString().split('T')[0];
        setReportMode('daily');
        setSelectedDate(newStartDate);
        break;
      case 'thisWeek':
        newStartDate = weekStart.toISOString().split('T')[0];
        newEndDate = today.toISOString().split('T')[0];
        setReportMode('range');
        setStartDate(newStartDate);
        setEndDate(newEndDate);
        break;
      case 'thisMonth':
        newStartDate = monthStart.toISOString().split('T')[0];
        newEndDate = today.toISOString().split('T')[0];
        setReportMode('range');
        setStartDate(newStartDate);
        setEndDate(newEndDate);
        break;
      default:
        return;
    }
    
    // Tarih değiştikten sonra otomatik rapor getir (kurye için)
    if (currentUser?.role === 'kurye') {
      setTimeout(() => {
        fetchKuryeRaporu();
      }, 100);
    }
  };

  // Şubeleri getir
  const fetchSubeler = async () => {
    try {
      const subeSnapshot = await getDocs(collection(db, 'subeler'));
      const subeList = subeSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSubeler(subeList);
    } catch (error) {
      console.error('Şubeler getirilirken hata:', error);
    }
  };

  // Kuryeleri getir
  const fetchKuryeler = async (subeId = null) => {
    try {
      let kuryeQuery;
      
      if (subeId) {
        kuryeQuery = query(
          collection(db, 'users'),
          where('role', '==', 'kurye'),
          where('subeId', '==', subeId)
        );
      } else {
        kuryeQuery = query(
          collection(db, 'users'),
          where('role', '==', 'kurye')
        );
      }
      
      const kuryeSnapshot = await getDocs(kuryeQuery);
      const kuryeList = kuryeSnapshot.docs.map(doc => ({
        id: doc.id,
        uid: doc.data().uid,
        ...doc.data()
      }));
      
      setKuryeler(kuryeList);
    } catch (error) {
      console.error('Kuryeler getirilirken hata:', error);
    }
  };

  // Kurye raporunu getir
  const fetchKuryeRaporu = async () => {
    if (!selectedKurye && currentUser?.role !== 'kurye') {
      setError('Lütfen kurye seçin');
      return;
    }

    // Tarih kontrolü
    if (reportMode === 'daily' && !selectedDate) {
      setError('Lütfen tarih seçin');
      return;
    }

    if (reportMode === 'range' && (!startDate || !endDate)) {
      setError('Lütfen başlangıç ve bitiş tarihlerini seçin');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      let kuryeAdi;
      
      if (currentUser?.role === 'kurye') {
        kuryeAdi = currentUser.displayName || currentUser.email;
      } else {
        const selectedKuryeData = kuryeler.find(k => k.id === selectedKurye);
        kuryeAdi = selectedKuryeData?.displayName || selectedKuryeData?.email;
      }

      console.log('Aranan kurye adı:', kuryeAdi);

      // Tüm adisyonları getir ve daha sonra filtrele (case-insensitive)
      let adisyonQuery = query(collection(db, 'Adisyonlar'));
      const adisyonSnapshot = await getDocs(adisyonQuery);
      
      let adisyonList = adisyonSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      console.log('Toplam adisyon sayısı:', adisyonList.length);
      
      // Kurye adı ile eşleşenleri filtrele (case-insensitive)
      adisyonList = adisyonList.filter(adisyon => {
        if (!adisyon.motorcu) return false;
        
        const motorcuLower = adisyon.motorcu.toLowerCase();
        const kuryeAdiLower = kuryeAdi.toLowerCase();
        
        console.log('Motorcu:', adisyon.motorcu, 'Aranan:', kuryeAdi, 'Eşleşme:', motorcuLower === kuryeAdiLower);
        
        return motorcuLower === kuryeAdiLower;
      });

      console.log('Kurye ile eşleşen adisyon sayısı:', adisyonList.length);

      // Masa siparişlerini filtrele (siparisnerden !== 88)
      adisyonList = adisyonList.filter(adisyon => adisyon.siparisnerden !== 88);

      console.log('Masa siparişleri filtrelendikten sonra:', adisyonList.length);

      // Tarih filtreleme
      adisyonList = adisyonList.filter(adisyon => {
        if (!adisyon.tarih) return false;
        
        try {
          // Tarih formatını kontrol et - ISO formatında: "2025-08-04T10:45:47"
          const adisyonTarihStr = String(adisyon.tarih);
          let adisyonTarih;
          
          if (adisyonTarihStr.includes('T')) {
            // ISO format: "2025-08-04T10:45:47" -> "2025-08-04"
            adisyonTarih = adisyonTarihStr.split('T')[0];
          } else if (adisyonTarihStr.includes(' ')) {
            // SQL format: "2025-08-04 10:45:47" -> "2025-08-04"
            adisyonTarih = adisyonTarihStr.split(' ')[0];
          } else {
            // Sadece tarih: "2025-08-04"
            adisyonTarih = adisyonTarihStr;
          }
          
          if (reportMode === 'daily') {
            console.log('Günlük filtre - Adisyon tarihi:', adisyonTarih, 'Hedef tarih:', selectedDate);
            return adisyonTarih === selectedDate;
          } else if (reportMode === 'range') {
            console.log('Aralık filtre - Adisyon tarihi:', adisyonTarih, 'Başlangıç:', startDate, 'Bitiş:', endDate);
            return adisyonTarih >= startDate && adisyonTarih <= endDate;
          }
          
          return false;
        } catch (err) {
          console.error('Tarih karşılaştırma hatası:', err, 'Adisyon tarihi:', adisyon.tarih);
          return false;
        }
      });

      console.log('Tarih filtrelendikten sonra:', adisyonList.length);

      // Tarihe göre sırala (eskiden yeniye)
      adisyonList.sort((a, b) => {
        try {
          let dateA, dateB;
          
          // ISO formatını Date objesine çevir
          if (a.tarih && a.tarih.includes('T')) {
            dateA = new Date(a.tarih);
          } else if (a.tarih && a.tarih.includes(' ')) {
            dateA = new Date(a.tarih.replace(' ', 'T'));
          } else {
            dateA = new Date(a.tarih || 0);
          }
          
          if (b.tarih && b.tarih.includes('T')) {
            dateB = new Date(b.tarih);
          } else if (b.tarih && b.tarih.includes(' ')) {
            dateB = new Date(b.tarih.replace(' ', 'T'));
          } else {
            dateB = new Date(b.tarih || 0);
          }
          
          // Tarih karşılaştırması - eskiden yeniye (A - B)
          if (dateA - dateB !== 0) return dateA - dateB;
        } catch (err) {
          console.error('Tarih sıralama hatası:', err);
        }
        
        // Sonra adisyon numarasına göre (küçükten büyüğe)
        const numA = parseInt(a.padsgnum) || 0;
        const numB = parseInt(b.padsgnum) || 0;
        return numA - numB;
      });

      setRaporData(adisyonList);
      setSuccess(`${adisyonList.length} teslimat raporu başarıyla yüklendi!`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Kurye raporu getirilirken hata:', error);
      setError('Rapor getirilirken bir hata oluştu: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser?.role === 'sirket_yoneticisi') {
      fetchSubeler();
      fetchKuryeler();
    } else if (currentUser?.role === 'sube_yoneticisi') {
      fetchKuryeler(currentUser.subeId);
    } else if (currentUser?.role === 'kurye') {
      // Kurye girişinde otomatik olarak günlük rapor getir
      fetchKuryeRaporu();
    }
  }, [currentUser]);

  useEffect(() => {
    if (selectedSube) {
      fetchKuryeler(selectedSube);
      setSelectedKurye('');
    }
  }, [selectedSube]);

  // Filtreleme işlemi
  useEffect(() => {
    setFilteredRaporData(raporData);
    setCurrentPage(1); // Filtre değiştiğinde ilk sayfaya dön
  }, [raporData]);

  // Tarih formatla
  const formatDate = (dateString) => {
    if (!dateString) return 'Bilinmiyor';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('tr-TR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (err) {
      return dateString;
    }
  };

  // Tutar formatla
  const formatAmount = (amount) => {
    if (!amount) return '0,00 ₺';
    return Number(amount).toLocaleString('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + ' ₺';
  };

  // Toplam hesapla
  const calculateTotals = () => {
    const totalOrders = filteredRaporData.length;
    const totalAmount = filteredRaporData.reduce((sum, adisyon) => {
      return sum + (Number(adisyon.atop) || 0);
    }, 0);
    
    return { totalOrders, totalAmount };
  };

  // Pagination hesaplamaları
  const totalPages = Math.ceil(filteredRaporData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedRaporData = filteredRaporData.slice(startIndex, endIndex);

  // Sayfa değişimi
  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Sayfa başına öğe sayısı değişimi
  const handleItemsPerPageChange = (newItemsPerPage) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1); // İlk sayfaya dön
  };

  // Ödeme tipini belirle
  const getOdemeTipi = (odemetipi) => {
    console.log('getOdemeTipi çağrıldı, değer:', odemetipi, 'tip:', typeof odemetipi);
    
    // Değer boş veya undefined ise
    if (!odemetipi && odemetipi !== 0) {
      return { text: 'Bilinmeyen', icon: 'help_outline', color: 'secondary' };
    }
    
    // String olarak gelen değerleri kontrol et
    const tipStr = String(odemetipi).toLowerCase().trim();
    
    // String değerler
    if (tipStr === 'nakit' || tipStr === 'cash') {
      return { text: 'Nakit', icon: 'payments', color: 'success' };
    }
    if (tipStr === 'kredi kartı' || tipStr === 'kredi karti' || tipStr === 'credit card' || tipStr === 'kart') {
      return { text: 'Kredi Kartı', icon: 'credit_card', color: 'primary' };
    }
    if (tipStr === 'ticket' || tipStr === 'ticket restaurant' || tipStr === 'yemek kartı' || tipStr === 'yemek karti') {
      return { text: 'Ticket Restaurant', icon: 'restaurant', color: 'warning' };
    }
    if (tipStr === 'sodexo') {
      return { text: 'Sodexo', icon: 'card_membership', color: 'info' };
    }
    if (tipStr === 'multinet') {
      return { text: 'Multinet', icon: 'card_membership', color: 'info' };
    }
    if (tipStr === 'veresiye' || tipStr === 'vadeli') {
      return { text: 'Veresiye', icon: 'schedule', color: 'secondary' };
    }
    if (tipStr === 'online' || tipStr === 'online ödeme' || tipStr === 'online odeme') {
      return { text: 'Online Ödeme', icon: 'online_prediction', color: 'primary' };
    }
    if (tipStr === 'transfer' || tipStr === 'havale') {
      return { text: 'Transfer', icon: 'account_balance', color: 'primary' };
    }
    
    // Sayısal değerler
    const tip = parseInt(odemetipi);
    
    switch (tip) {
      case 0:
        return { text: 'Nakit', icon: 'payments', color: 'success' };
      case 1:
        return { text: 'Kredi Kartı', icon: 'credit_card', color: 'primary' };
      case 2:
        return { text: 'Ticket Restaurant', icon: 'restaurant', color: 'warning' };
      case 3:
        return { text: 'Sodexo', icon: 'card_membership', color: 'info' };
      case 4:
        return { text: 'Veresiye', icon: 'schedule', color: 'secondary' };
      case 5:
        return { text: 'Online Ödeme', icon: 'online_prediction', color: 'primary' };
      case 6:
        return { text: 'Transfer', icon: 'account_balance', color: 'primary' };
      case 7:
        return { text: 'Multinet', icon: 'card_membership', color: 'info' };
      default:
        console.log('Bilinmeyen ödeme tipi:', odemetipi);
        return { text: `Diğer (${odemetipi})`, icon: 'help_outline', color: 'secondary' };
    }
  };

  // Ödeme tipi bazında toplamları hesapla
  const calculatePaymentTypeTotals = () => {
    const paymentSummary = {};
    
    filteredRaporData.forEach(adisyon => {
      // Farklı alan isimlerini kontrol et
      const odemetipi = adisyon.odemetipi || 
                       adisyon.odemeTipi || 
                       adisyon.payment_type || 
                       adisyon.odeme_tipi || 
                       adisyon.paymentType ||
                       adisyon.OdemeTipi ||
                       adisyon.ODEMETIPI ||
                       0;
      
      console.log('Adisyon ID:', adisyon.id, 'Ödeme Tipi:', odemetipi, 'Tüm alanlar:', {
        odemetipi: adisyon.odemetipi,
        odemeTipi: adisyon.odemeTipi,
        payment_type: adisyon.payment_type,
        odeme_tipi: adisyon.odeme_tipi,
        paymentType: adisyon.paymentType,
        OdemeTipi: adisyon.OdemeTipi,
        ODEMETIPI: adisyon.ODEMETIPI
      });
      
      const tipInfo = getOdemeTipi(odemetipi);
      const amount = Number(adisyon.atop) || 0;
      
      if (!paymentSummary[tipInfo.text]) {
        paymentSummary[tipInfo.text] = {
          count: 0,
          total: 0,
          icon: tipInfo.icon,
          color: tipInfo.color
        };
      }
      
      paymentSummary[tipInfo.text].count += 1;
      paymentSummary[tipInfo.text].total += amount;
    });
    
    return paymentSummary;
  };

  // Sipariş tipini belirle
  const getSiparisTipi = (siparisnerden) => {
    switch (siparisnerden) {
      case 0:
        return { text: 'Telefon', icon: 'phone', color: 'info' };
      case 1:
        return { text: 'Yemek Sepeti', icon: 'delivery_dining', color: 'warning' };
      case 2:
        return { text: 'Getir', icon: 'motorcycle', color: 'success' };
      case 5:
        return { text: 'Trendyol', icon: 'shopping_bag', color: 'danger' };
      case 8:
        return { text: 'Migros', icon: 'store', color: 'secondary' };
      case 88:
        return { text: 'Masa', icon: 'table_restaurant', color: 'primary' };
      default:
        return { text: 'Diğer', icon: 'receipt', color: 'secondary' };
    }
  };

  const isCourier = currentUser?.role === 'kurye';
  const isCompanyManager = currentUser?.role === 'sirket_yoneticisi';
  const totals = calculateTotals();
  const paymentTypeTotals = calculatePaymentTypeTotals();

  if (loading && (!selectedKurye && !isCourier)) {
    return (
      <div className="kurye-raporu-container">
        <div className="page-header">
          <h1>Kurye Raporu</h1>
        </div>
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Veriler yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="kurye-raporu-container">
      <div className="page-header">
        <div className="header-content">
          <div className="title-section">
            <h1>
              <span className="material-icons">delivery_dining</span>
              Kurye Raporu
            </h1>
            <p>
              {isCourier 
                ? 'Kendi teslimat raporunuzu görüntüleyebilirsiniz (masa siparişleri hariç)'
                : 'Kuryelerin teslimat raporlarını görüntüleyebilirsiniz (masa siparişleri hariç)'
              }
            </p>
          </div>
        </div>
      </div>

      {/* Filtre Bölümü */}
      <div className="filters-section">
        {!isCourier && (
          <>
            {isCompanyManager && (
              <div className="filter-group">
                <label htmlFor="sube-select">Şube Seçin:</label>
                <select
                  id="sube-select"
                  value={selectedSube}
                  onChange={(e) => setSelectedSube(e.target.value)}
                >
                  <option value="">Tüm Şubeler</option>
                  {subeler.map((sube) => (
                    <option key={sube.id} value={sube.id}>
                      {sube.subeAdi || sube.sube_adi} (ID: {sube.id})
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            <div className="filter-group">
              <label htmlFor="kurye-select">Kurye Seçin:</label>
              <select
                id="kurye-select"
                value={selectedKurye}
                onChange={(e) => setSelectedKurye(e.target.value)}
              >
                <option value="">Kurye seçin...</option>
                {kuryeler.map((kurye) => (
                  <option key={kurye.id} value={kurye.id}>
                    {kurye.displayName || kurye.email}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        <div className="filter-group">
          <label>Rapor Tipi:</label>
          <div className="report-mode-buttons">
            <button
              className={`filter-btn ${reportMode === 'daily' ? 'active' : ''}`}
              onClick={() => setReportMode('daily')}
            >
              <span className="material-icons">today</span>
              Günlük
            </button>
            <button
              className={`filter-btn ${reportMode === 'range' ? 'active' : ''}`}
              onClick={() => setReportMode('range')}
            >
              <span className="material-icons">date_range</span>
              Tarih Aralığı
            </button>
          </div>
        </div>

        {reportMode === 'daily' ? (
          <div className="filter-group">
            <label htmlFor="date-select">Tarih Seçin:</label>
            <input
              type="date"
              id="date-select"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
        ) : (
          <div className="filter-group date-range-group">
            <div className="date-range-inputs">
              <div className="date-input-wrapper">
                <label htmlFor="start-date">Başlangıç:</label>
                <input
                  type="date"
                  id="start-date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="date-input-wrapper">
                <label htmlFor="end-date">Bitiş:</label>
                <input
                  type="date"
                  id="end-date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {isCourier && (
          <div className="filter-group">
            <label>Hızlı Seçim:</label>
            <div className="quick-date-buttons">
              <button 
                className={`filter-btn ${reportMode === 'daily' && selectedDate === today ? 'active' : ''}`}
                onClick={() => setDateRange('today')}
              >
                <span className="material-icons">today</span>
                Bugün
              </button>
              <button 
                className="filter-btn"
                onClick={() => setDateRange('yesterday')}
              >
                <span className="material-icons">yesterday</span>
                Dün
              </button>
              <button 
                className="filter-btn"
                onClick={() => setDateRange('thisWeek')}
              >
                <span className="material-icons">date_range</span>
                Bu Hafta
              </button>
              <button 
                className="filter-btn"
                onClick={() => setDateRange('thisMonth')}
              >
                <span className="material-icons">calendar_month</span>
                Bu Ay
              </button>
            </div>
          </div>
        )}

        <div className="filter-group">
          <label>&nbsp;</label>
          <button 
            className="rapor-button"
            onClick={fetchKuryeRaporu}
            disabled={loading}
          >
            <span className="material-icons">search</span>
            {loading ? 'Yükleniyor...' : 'Rapor Getir'}
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          <span className="material-icons">error</span>
          {error}
        </div>
      )}

      {success && (
        <div className="success-message">
          <span className="material-icons">check_circle</span>
          {success}
        </div>
      )}

      {(!selectedKurye && !isCourier) && !loading && (
        <div className="empty-state">
          <span className="material-icons">delivery_dining</span>
          <h3>Kurye Seçin</h3>
          <p>Teslimat raporunu görüntülemek için yukarıdan kurye seçin.</p>
        </div>
      )}

      {((selectedKurye || isCourier) && ((reportMode === 'daily' && !selectedDate) || (reportMode === 'range' && (!startDate || !endDate)))) && !loading && (
        <div className="empty-state">
          <span className="material-icons">date_range</span>
          <h3>Tarih Seçin</h3>
          <p>Raporu görüntülemek için tarih seçin ve "Rapor Getir" butonuna tıklayın.</p>
        </div>
      )}

      {((selectedKurye || isCourier) && ((reportMode === 'daily' && selectedDate) || (reportMode === 'range' && startDate && endDate))) && loading && (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Kurye raporu yükleniyor...</p>
        </div>
      )}

      {((selectedKurye || isCourier) && ((reportMode === 'daily' && selectedDate) || (reportMode === 'range' && startDate && endDate))) && !loading && raporData.length === 0 && !error && (
        <div className="empty-state">
          <span className="material-icons">delivery_dining</span>
          <h3>Teslimat Bulunamadı</h3>
          <p>Seçilen {reportMode === 'daily' ? 'tarih' : 'tarih aralığı'} ve kurye için teslimat bulunmuyor.</p>
        </div>
      )}

      {((selectedKurye || isCourier) && ((reportMode === 'daily' && selectedDate) || (reportMode === 'range' && startDate && endDate))) && !loading && raporData.length > 0 && (
        <>
          {/* İstatistikler */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon primary">
                <span className="material-icons">delivery_dining</span>
              </div>
              <div className="stat-info">
                <div className="stat-number">{totals.totalOrders}</div>
                <div className="stat-label">Toplam Teslimat</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon success">
                <span className="material-icons">payments</span>
              </div>
              <div className="stat-info">
                <div className="stat-number">{formatAmount(totals.totalAmount)}</div>
                <div className="stat-label">Toplam Tutar</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon warning">
                <span className="material-icons">trending_up</span>
              </div>
              <div className="stat-info">
                <div className="stat-number">{formatAmount(totals.totalAmount / totals.totalOrders)}</div>
                <div className="stat-label">Ortalama Sipariş</div>
              </div>
            </div>

            {/* Platform Bazlı İstatistikler */}
            {filteredRaporData.some(adisyon => adisyon.siparisnerden === 0) && (
              <div className="stat-card">
                <div className="stat-icon info">
                  <span className="material-icons">phone</span>
                </div>
                <div className="stat-info">
                  <div className="stat-number">
                    {filteredRaporData.filter(adisyon => adisyon.siparisnerden === 0).length}
                  </div>
                  <div className="stat-label">Telefon</div>
                  <div className="stat-sublabel">
                    {formatAmount(filteredRaporData
                      .filter(adisyon => adisyon.siparisnerden === 0)
                      .reduce((total, adisyon) => total + (Number(adisyon.atop) || 0), 0))}
                  </div>
                </div>
              </div>
            )}

            {filteredRaporData.some(adisyon => adisyon.siparisnerden === 1) && (
              <div className="stat-card">
                <div className="stat-icon warning">
                  <span className="material-icons">delivery_dining</span>
                </div>
                <div className="stat-info">
                  <div className="stat-number">
                    {filteredRaporData.filter(adisyon => adisyon.siparisnerden === 1).length}
                  </div>
                  <div className="stat-label">Yemek Sepeti</div>
                  <div className="stat-sublabel">
                    {formatAmount(filteredRaporData
                      .filter(adisyon => adisyon.siparisnerden === 1)
                      .reduce((total, adisyon) => total + (Number(adisyon.atop) || 0), 0))}
                  </div>
                </div>
              </div>
            )}

            {filteredRaporData.some(adisyon => adisyon.siparisnerden === 2) && (
              <div className="stat-card">
                <div className="stat-icon success">
                  <span className="material-icons">motorcycle</span>
                </div>
                <div className="stat-info">
                  <div className="stat-number">
                    {filteredRaporData.filter(adisyon => adisyon.siparisnerden === 2).length}
                  </div>
                  <div className="stat-label">Getir</div>
                  <div className="stat-sublabel">
                    {formatAmount(filteredRaporData
                      .filter(adisyon => adisyon.siparisnerden === 2)
                      .reduce((total, adisyon) => total + (Number(adisyon.atop) || 0), 0))}
                  </div>
                </div>
              </div>
            )}

            {filteredRaporData.some(adisyon => adisyon.siparisnerden === 5) && (
              <div className="stat-card">
                <div className="stat-icon danger">
                  <span className="material-icons">shopping_bag</span>
                </div>
                <div className="stat-info">
                  <div className="stat-number">
                    {filteredRaporData.filter(adisyon => adisyon.siparisnerden === 5).length}
                  </div>
                  <div className="stat-label">Trendyol</div>
                  <div className="stat-sublabel">
                    {formatAmount(filteredRaporData
                      .filter(adisyon => adisyon.siparisnerden === 5)
                      .reduce((total, adisyon) => total + (Number(adisyon.atop) || 0), 0))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Ödeme Tipi Detayları */}
          {Object.keys(paymentTypeTotals).length > 0 && (
            <div className="payment-summary-section">
              <h3>
                <span className="material-icons">payment</span>
                Ödeme Tipi Detayları
              </h3>
              <div className="payment-summary-cards">
                {Object.entries(paymentTypeTotals).map(([paymentType, data]) => (
                  <div key={paymentType} className="payment-summary-card">
                    <div className="payment-card-header">
                      <div className="payment-card-icon">
                        <span className="material-icons">{data.icon}</span>
                      </div>
                      <h4>{paymentType}</h4>
                    </div>
                    <div className="payment-card-content">
                      <div className="payment-stat">
                        <span className="payment-label">Sipariş Sayısı:</span>
                        <span className="payment-value">{data.count}</span>
                      </div>
                      <div className="payment-stat">
                        <span className="payment-label">Toplam Tutar:</span>
                        <span className="payment-value amount">{formatAmount(data.total)}</span>
                      </div>
                      <div className="payment-stat">
                        <span className="payment-label">Ortalama:</span>
                        <span className="payment-value">{formatAmount(data.total / data.count)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Teslimat Listesi */}
          {/* Pagination Kontrolleri */}
          {filteredRaporData.length > 0 && (
            <div className="pagination-controls">
              <div className="pagination-info">
                <span>
                  {startIndex + 1}-{Math.min(endIndex, filteredRaporData.length)} arası, 
                  toplam {filteredRaporData.length} teslimat gösteriliyor
                </span>
              </div>
              
              <div className="pagination-settings">
                <div className="items-per-page">
                  <label>Sayfa başına:</label>
                  <select 
                    value={itemsPerPage} 
                    onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={30}>30</option>
                    <option value={40}>40</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>

                {totalPages > 1 && (
                  <div className="pagination-buttons">
                    <button 
                      onClick={() => handlePageChange(1)}
                      disabled={currentPage === 1}
                      className="pagination-btn"
                    >
                      <span className="material-icons">first_page</span>
                    </button>
                    
                    <button 
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="pagination-btn"
                    >
                      <span className="material-icons">chevron_left</span>
                    </button>

                    <div className="page-numbers">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        
                        return (
                          <button
                            key={pageNum}
                            onClick={() => handlePageChange(pageNum)}
                            className={`pagination-btn ${currentPage === pageNum ? 'active' : ''}`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>

                    <button 
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="pagination-btn"
                    >
                      <span className="material-icons">chevron_right</span>
                    </button>
                    
                    <button 
                      onClick={() => handlePageChange(totalPages)}
                      disabled={currentPage === totalPages}
                      className="pagination-btn"
                    >
                      <span className="material-icons">last_page</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="teslimat-grid">
            {paginatedRaporData.map((adisyon) => {
              const tip = getSiparisTipi(adisyon.siparisnerden);
              return (
                <div 
                  key={adisyon.id} 
                  className={`teslimat-card ${tip.color}`}
                >
                  <div className="teslimat-header">
                    <div className="teslimat-code">
                      <span className="material-icons">receipt</span>
                      Sipariş No: {adisyon.padsgnum || 'Numara Yok'}
                    </div>
                    <div className="teslimat-badges">
                      <div className={`teslimat-type ${tip.color}`}>
                        <span className="material-icons">{tip.icon}</span>
                        {tip.text}
                      </div>
                      <div className="teslimat-status success">
                        <span className="material-icons">check_circle</span>
                        Teslim Edildi
                      </div>
                    </div>
                  </div>
                  
                  <div className="teslimat-details">
                    <div className="detail-row">
                      <span className="detail-label">Tutar:</span>
                      <span className="detail-value amount">{formatAmount(adisyon.atop)}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Tarih:</span>
                      <span className="detail-value">{formatDate(adisyon.tarih)}</span>
                    </div>
                    {adisyon.motorcu && (
                      <div className="detail-row">
                        <span className="detail-label">Kurye:</span>
                        <span className="detail-value">{adisyon.motorcu}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default KuryeRaporuPage;
