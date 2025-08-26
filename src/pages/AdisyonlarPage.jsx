import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import AdisyonDetailModal from '../components/AdisyonDetailModal';
import './AdisyonlarPage.css';

const AdisyonlarPage = () => {
  const [adisyonlar, setAdisyonlar] = useState([]);
  const [filteredAdisyonlar, setFilteredAdisyonlar] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Seçilen şube (rrc_restaurant_id ile aynı olacak şekilde tutulur)
  const [selectedSube, setSelectedSube] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [orderTypeFilter, setOrderTypeFilter] = useState('all'); // 'all', 'masa', 'online', 'canceled'
  const [reportMode, setReportMode] = useState('daily'); // 'daily', 'range'
  // Tarih aralığı varsayılanları: başlangıç = önceki ayın son günü, bitiş = sonraki ayın ilk günü
  const todayRef = new Date();
  const defaultRangeStart = new Date(todayRef.getFullYear(), todayRef.getMonth(), 0)
    .toISOString()
    .split('T')[0];
  const defaultRangeEnd = new Date(todayRef.getFullYear(), todayRef.getMonth() + 1, 1)
    .toISOString()
    .split('T')[0];
  const [startDate, setStartDate] = useState(defaultRangeStart);
  const [endDate, setEndDate] = useState(defaultRangeEnd);
  const [subeler, setSubeler] = useState([]);
  const [success, setSuccess] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAdisyon, setSelectedAdisyon] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const { currentUser } = useAuth();

  // Şubeleri getir
  useEffect(() => {
    const getSubeler = async () => {
      try {
        console.log('currentUser:', currentUser);
        
        let subeQuery;
        
        if (currentUser?.role === 'sirket_yoneticisi') {
          // Şirket yöneticisi tüm şubeleri görebilir
          console.log('Şirket yöneticisi - tüm şubeleri getiriliyor');
          subeQuery = query(collection(db, 'subeler'));
        } else if (currentUser?.subeId) {
          // Diğer kullanıcılar sadece kendi şubelerini görebilir
          console.log('Şube kullanıcısı - sadece kendi şubesini getiriliyor:', currentUser.subeId);
          subeQuery = query(
            collection(db, 'subeler'), 
            where('__name__', '==', currentUser.subeId)
          );
        } else {
          console.log('Kullanıcı rolü bulunamadı veya şube ID yok');
          return;
        }

        if (subeQuery) {
          console.log('Şubeler sorgusu oluşturuldu, Firestore\'dan veri bekleniyor...');
          const unsubscribe = onSnapshot(subeQuery, (snapshot) => {
            console.log('Şubeler snapshot alındı, doküman sayısı:', snapshot.docs.length);
            const subeList = snapshot.docs.map(doc => {
              const data = { id: doc.id, ...doc.data() };
              console.log('Şube verisi:', data);
              return data;
            });
            setSubeler(subeList);
            console.log('Şubeler state\'e kaydedildi:', subeList);
            
            // Eğer kullanıcı şirket yöneticisi değilse, otomatik olarak kendi şubesini seç
            if (currentUser?.role !== 'sirket_yoneticisi' && subeList.length > 0) {
              const autoId = subeList[0].rrc_restaurant_id || subeList[0].id;
              console.log('Otomatik şube (rrc_restaurant_id) seçimi yapılıyor:', autoId);
              setSelectedSube(autoId);
            }
          }, (error) => {
            console.error('Şubeler alınırken hata:', error);
            setError('Şubeler yüklenirken bir hata oluştu: ' + error.message);
          });

          return () => unsubscribe();
        }
      } catch (err) {
        console.error('Şubeler alınırken hata:', err);
        setError('Şubeler yüklenirken bir hata oluştu: ' + err.message);
      }
    };

    if (currentUser) {
      console.log('currentUser mevcut, şubeler yükleniyor...');
      getSubeler();
    } else {
      console.log('currentUser henüz yüklenmedi');
    }
  }, [currentUser]);

  // Adisyonları getir
  useEffect(() => {
    if (!selectedSube) {
      setAdisyonlar([]);
      setLoading(false);
      return;
    }

    // Günlük modda selectedDate, tarih aralığı modunda startDate ve endDate kontrol et
    if (reportMode === 'daily' && !selectedDate) {
      setAdisyonlar([]);
      setLoading(false);
      return;
    }

    if (reportMode === 'range' && (!startDate || !endDate)) {
      setAdisyonlar([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('Adisyonlar sorgulanıyor, selectedSube:', selectedSube, 'reportMode:', reportMode);
      
      // Index gerektirmemek için sadece şube ile sorgulayalım ve client-side filtreleme yapalım
      const adisyonlarQuery = query(
        collection(db, 'Adisyonlar'),
        where('rrc_restaurant_id', '==', selectedSube)
      );

      const unsubscribe = onSnapshot(adisyonlarQuery, 
        (snapshot) => {
          console.log('Adisyonlar snapshot alındı, doküman sayısı:', snapshot.docs.length);
          const adisyonList = snapshot.docs.map(doc => {
            const data = { id: doc.id, ...doc.data() };
            console.log('Adisyon verisi:', data);
            return data;
          });
          
          // Client-side tarih filtreleme
          const filteredAdisyonList = adisyonList.filter(adisyon => {
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
          
          console.log('Filtrelenmiş adisyon sayısı:', filteredAdisyonList.length);
          
          // Tarihe ve adisyon numarasına göre sıralama
          const sortedAdisyonList = filteredAdisyonList.sort((a, b) => {
            // Önce tarihe göre (eskiden yeniye)
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
          
          console.log('Sıralanmış adisyon listesi:', sortedAdisyonList);
          setAdisyonlar(sortedAdisyonList);
          setLoading(false);
        },
        (err) => {
          console.error('Adisyonlar alınırken hata:', err);
          setError('Adisyonlar yüklenirken bir hata oluştu: ' + err.message);
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (err) {
      console.error('Adisyonlar sorgulanırken hata:', err);
      setError('Adisyonlar sorgulanırken bir hata oluştu: ' + err.message);
      setLoading(false);
    }
  }, [selectedSube, selectedDate, reportMode, startDate, endDate]);

  // Sipariş tipi filtreleme
  useEffect(() => {
    let filtered = adisyonlar;
    
    if (orderTypeFilter === 'masa') {
      filtered = adisyonlar.filter(adisyon => adisyon.siparisnerden === 88);
    } else if (orderTypeFilter === 'online') {
      filtered = adisyonlar.filter(adisyon => adisyon.siparisnerden !== 88);
    } else if (orderTypeFilter === 'canceled') {
      filtered = adisyonlar.filter(adisyon => isCanceled(adisyon));
    }
    // 'all' durumunda tüm adisyonları göster
    
    setFilteredAdisyonlar(filtered);
    setCurrentPage(1); // Filtre değiştiğinde ilk sayfaya dön
    console.log('Filtrelenen adisyonlar:', filtered, 'Filtre tipi:', orderTypeFilter);
  }, [adisyonlar, orderTypeFilter]);

  // Adisyonun tipini belirle
  const getAdisyonTipi = (siparisnerden) => {
    switch (siparisnerden) {
      case 0:
        return { text: 'Telefon Siparişi', icon: 'phone', color: 'info' };
      case 1:
        return { text: 'Yemek Sepeti', icon: 'delivery_dining', color: 'warning' };
      case 2:
        return { text: 'Getir', icon: 'motorcycle', color: 'success' };
      case 5:
        return { text: 'Trendyol', icon: 'shopping_bag', color: 'danger' };
      case 8:
        return { text: 'Migros', icon: 'store', color: 'secondary' };
      case 88:
        return { text: 'Masa Siparişi', icon: 'table_restaurant', color: 'primary' };
      default:
        return { text: 'Diğer', icon: 'receipt', color: 'secondary' };
    }
  };

  // Adisyon durumunu belirle
  const getAdisyonDurum = (adisyon_durum, durum) => {
    // Önce string durum kontrolü (paket siparişler için)
    if (durum) {
      const durumUpper = durum.toUpperCase();
      switch (durumUpper) {
        case 'YENİ':
        case 'YENI':
          return { text: 'Yeni Sipariş', icon: 'fiber_new', color: 'info', bgColor: 'info' };
        case 'ONAYLANDI':
          return { text: 'Onaylandı', icon: 'check_circle', color: 'success', bgColor: 'success' };
        case 'GÖNDERİLDİ':
        case 'GONDERILDI':
          return { text: 'Gönderildi', icon: 'local_shipping', color: 'primary', bgColor: 'primary' };
        case 'İPTAL':
        case 'IPTAL':
          return { text: 'İptal Edildi', icon: 'cancel', color: 'danger', bgColor: 'danger' };
        default:
          return { text: durum, icon: 'info', color: 'secondary', bgColor: 'secondary' };
      }
    }
    
    // Sayısal durum kontrolü (masa siparişleri için)
    switch (adisyon_durum) {
      case 1:
        return { text: 'Aktif Adisyon', icon: 'pending', color: 'warning', bgColor: 'warning' };
      case 4:
        return { text: 'Ödemesi Alınmış', icon: 'paid', color: 'success', bgColor: 'success' };
      default:
        return { text: 'Bilinmiyor', icon: 'help', color: 'secondary', bgColor: 'secondary' };
    }
  };

  // İptal kontrolü (paket siparişler için string durum üzerinden)
  const isCanceled = (adisyon) => {
    if (!adisyon || !adisyon.durum) return false;
    try {
      const s = String(adisyon.durum).toUpperCase();
      // Türkçe büyük İ harfi ve ASCII I ile olası yazımlar
      return s.includes('İPTAL') || s.includes('IPTAL');
    } catch (e) {
      return false;
    }
  };

  // JSON kopyalama fonksiyonu
  const copyJsonToClipboard = (adisyon) => {
    const jsonString = JSON.stringify(adisyon, null, 2);
    navigator.clipboard.writeText(jsonString).then(() => {
      setSuccess('Adisyon JSON verisi başarıyla kopyalandı!');
      setTimeout(() => setSuccess(''), 3000);
    }).catch(err => {
      console.error('Kopyalama hatası:', err);
      setError('Kopyalama işlemi başarısız oldu');
      setTimeout(() => setError(''), 3000);
    });
  };

  // Adisyon detayını göster
  const showAdisyonDetail = (adisyon) => {
    setSelectedAdisyon(adisyon);
    setIsModalOpen(true);
  };

  // Modal'ı kapat
  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedAdisyon(null);
  };

  // Tarih formatla
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      // ISO formatını Date objesine çevir: "2025-08-04T10:45:47" -> Date
      let date;
      
      if (dateString.includes('T')) {
        // ISO format: "2025-08-04T10:45:47"
        date = new Date(dateString);
      } else if (dateString.includes(' ')) {
        // SQL format: "2025-08-04 10:45:47"
        date = new Date(dateString.replace(' ', 'T'));
      } else {
        // Sadece tarih: "2025-08-04"
        date = new Date(dateString);
      }
      
      // Türkçe format
      return date.toLocaleString('tr-TR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch (err) {
      console.error('Tarih formatla hatası:', err, 'Tarih:', dateString);
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

  // Pagination hesaplamaları
  const totalPages = Math.ceil(filteredAdisyonlar.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedAdisyonlar = filteredAdisyonlar.slice(startIndex, endIndex);

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

  if (loading && !selectedSube) {
    return (
      <div className="adisyonlar-page">
        <div className="page-header">
          <h1>Adisyonlar</h1>
        </div>
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Şubeler yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="adisyonlar-container">
      <div className="page-header">
        <div className="header-content">
          <div className="title-section">
            <h1>
              <span className="material-icons">receipt_long</span>
              Adisyonlar
            </h1>
            <p>Şube bazlı günlük adisyon listesini görüntüleyin</p>
          </div>
        </div>
      </div>

      {/* Filtre Bölümü */}
      <div className="filters-section">
        <div className="filter-group">
          <label htmlFor="sube-select">Şube Seçin:</label>
          <select
            id="sube-select"
            value={selectedSube}
            onChange={(e) => setSelectedSube(e.target.value)}
            disabled={currentUser?.role !== 'sirket_yoneticisi'}
          >
            <option value="">Şube seçin...</option>
            {subeler.map((sube) => {
              const rrcId = sube.rrc_restaurant_id || sube.id; // rrc_restaurant_id yoksa doc id fallback
              return (
                <option key={sube.id} value={rrcId}>
                  {sube.subeAdi} (RRC ID: {rrcId})
                </option>
              );
            })}
          </select>
        </div>

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

        <div className="filter-group">
          <label>Sipariş Tipi:</label>
          <div className="order-type-buttons">
            <button
              className={`filter-btn ${orderTypeFilter === 'all' ? 'active' : ''}`}
              onClick={() => setOrderTypeFilter('all')}
            >
              <span className="material-icons">list</span>
              Tümü
            </button>
            <button
              className={`filter-btn ${orderTypeFilter === 'masa' ? 'active' : ''}`}
              onClick={() => setOrderTypeFilter('masa')}
            >
              <span className="material-icons">table_restaurant</span>
              Masa
            </button>
            <button
              className={`filter-btn ${orderTypeFilter === 'online' ? 'active' : ''}`}
              onClick={() => setOrderTypeFilter('online')}
            >
              <span className="material-icons">takeout_dining</span>
              Paket
            </button>
            <button
              className={`filter-btn ${orderTypeFilter === 'canceled' ? 'active' : ''}`}
              onClick={() => setOrderTypeFilter('canceled')}
              title="İptal edilen adisyonları göster"
            >
              <span className="material-icons">cancel</span>
              İptal Edilenler
            </button>
          </div>
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

      {(!selectedSube || (reportMode === 'daily' && !selectedDate) || (reportMode === 'range' && (!startDate || !endDate))) && !loading && (
        <div className="empty-state">
          <span className="material-icons">receipt_long</span>
          <h3>Filtre Seçin</h3>
          <p>Adisyonları görüntülemek için yukarıdan şube ve tarih seçin.</p>
        </div>
      )}

      {selectedSube && ((reportMode === 'daily' && selectedDate) || (reportMode === 'range' && startDate && endDate)) && loading && (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Adisyonlar yükleniyor...</p>
        </div>
      )}

      {selectedSube && ((reportMode === 'daily' && selectedDate) || (reportMode === 'range' && startDate && endDate)) && !loading && adisyonlar.length === 0 && !error && (
        <div className="empty-state">
          <span className="material-icons">receipt_long</span>
          <h3>Adisyon Bulunamadı</h3>
          <p>Seçilen {reportMode === 'daily' ? 'tarih' : 'tarih aralığı'} ve şubede adisyon bulunmuyor.</p>
        </div>
      )}

      {selectedSube && ((reportMode === 'daily' && selectedDate) || (reportMode === 'range' && startDate && endDate)) && !loading && adisyonlar.length > 0 && (
        <>
          {/* İstatistikler */}
          <div className="stats-grid">
            {(() => {
              const canceledAdisyonlar = filteredAdisyonlar.filter(isCanceled);
              const nonCanceledAdisyonlar = filteredAdisyonlar.filter(a => !isCanceled(a));
              const toplamNonCanceledTutar = nonCanceledAdisyonlar.reduce((t, a) => t + (Number(a.atop) || 0), 0);
              const toplamCanceledTutar = canceledAdisyonlar.reduce((t, a) => t + (Number(a.atop) || 0), 0);
              const masaNonCanceled = nonCanceledAdisyonlar.filter(a => a.siparisnerden === 88);
              const paketNonCanceled = nonCanceledAdisyonlar.filter(a => a.siparisnerden !== 88);

              return (
                <>
                  {/* Genel İstatistikler - İptaller hariç */}
                  <div className="stat-card">
                    <div className="stat-icon primary">
                      <span className="material-icons">receipt</span>
                    </div>
                    <div className="stat-info">
                      <div className="stat-number">{nonCanceledAdisyonlar.length}</div>
                      <div className="stat-label">Toplam Adisyon</div>
                    </div>
                  </div>

                  <div className="stat-card">
                    <div className="stat-icon danger">
                      <span className="material-icons">payments</span>
                    </div>
                    <div className="stat-info">
                      <div className="stat-number">{formatAmount(toplamNonCanceledTutar)}</div>
                      <div className="stat-label">Genel Toplam</div>
                    </div>
                  </div>

                  {/* İptal İstatistiği (ayrı göster) */}
                  <div className="stat-card">
                    <div className="stat-icon secondary">
                      <span className="material-icons">cancel</span>
                    </div>
                    <div className="stat-info">
                      <div className="stat-number">{canceledAdisyonlar.length}</div>
                      <div className="stat-label">İptal Adedi</div>
                      <div className="stat-sublabel">{formatAmount(toplamCanceledTutar)}</div>
                    </div>
                  </div>

                  {/* Masa Siparişleri İstatistikleri - İptalsiz */}
                  <div className="stat-card">
                    <div className="stat-icon success">
                      <span className="material-icons">table_restaurant</span>
                    </div>
                    <div className="stat-info">
                      <div className="stat-number">{masaNonCanceled.length}</div>
                      <div className="stat-label">Masa Siparişi</div>
                      <div className="stat-sublabel">{formatAmount(masaNonCanceled.reduce((t, a) => t + (Number(a.atop) || 0), 0))}</div>
                    </div>
                  </div>

                  {/* Paket Siparişleri İstatistikleri - İptalsiz */}
                  <div className="stat-card">
                    <div className="stat-icon warning">
                      <span className="material-icons">takeout_dining</span>
                    </div>
                    <div className="stat-info">
                      <div className="stat-number">{paketNonCanceled.length}</div>
                      <div className="stat-label">Paket Sipariş</div>
                      <div className="stat-sublabel">{formatAmount(paketNonCanceled.reduce((t, a) => t + (Number(a.atop) || 0), 0))}</div>
                    </div>
                  </div>

                  {/* Platform Bazlı İstatistikler - Yalnızca iptalsiz paket varsa göster */}
                  {paketNonCanceled.length > 0 && (
                    <>
                      {/* Telefon Siparişleri */}
                      {paketNonCanceled.some(a => a.siparisnerden === 0) && (
                        <div className="stat-card">
                          <div className="stat-icon info">
                            <span className="material-icons">phone</span>
                          </div>
                          <div className="stat-info">
                            <div className="stat-number">{paketNonCanceled.filter(a => a.siparisnerden === 0).length}</div>
                            <div className="stat-label">Telefon</div>
                            <div className="stat-sublabel">{formatAmount(paketNonCanceled.filter(a => a.siparisnerden === 0).reduce((t, a) => t + (Number(a.atop) || 0), 0))}</div>
                          </div>
                        </div>
                      )}

                      {/* Yemek Sepeti */}
                      {paketNonCanceled.some(a => a.siparisnerden === 1) && (
                        <div className="stat-card">
                          <div className="stat-icon warning">
                            <span className="material-icons">delivery_dining</span>
                          </div>
                          <div className="stat-info">
                            <div className="stat-number">{paketNonCanceled.filter(a => a.siparisnerden === 1).length}</div>
                            <div className="stat-label">Yemek Sepeti</div>
                            <div className="stat-sublabel">{formatAmount(paketNonCanceled.filter(a => a.siparisnerden === 1).reduce((t, a) => t + (Number(a.atop) || 0), 0))}</div>
                          </div>
                        </div>
                      )}

                      {/* Getir */}
                      {paketNonCanceled.some(a => a.siparisnerden === 2) && (
                        <div className="stat-card">
                          <div className="stat-icon success">
                            <span className="material-icons">motorcycle</span>
                          </div>
                          <div className="stat-info">
                            <div className="stat-number">{paketNonCanceled.filter(a => a.siparisnerden === 2).length}</div>
                            <div className="stat-label">Getir</div>
                            <div className="stat-sublabel">{formatAmount(paketNonCanceled.filter(a => a.siparisnerden === 2).reduce((t, a) => t + (Number(a.atop) || 0), 0))}</div>
                          </div>
                        </div>
                      )}

                      {/* Trendyol */}
                      {paketNonCanceled.some(a => a.siparisnerden === 5) && (
                        <div className="stat-card">
                          <div className="stat-icon danger">
                            <span className="material-icons">shopping_bag</span>
                          </div>
                          <div className="stat-info">
                            <div className="stat-number">{paketNonCanceled.filter(a => a.siparisnerden === 5).length}</div>
                            <div className="stat-label">Trendyol</div>
                            <div className="stat-sublabel">{formatAmount(paketNonCanceled.filter(a => a.siparisnerden === 5).reduce((t, a) => t + (Number(a.atop) || 0), 0))}</div>
                          </div>
                        </div>
                      )}

                      {/* Migros */}
                      {paketNonCanceled.some(a => a.siparisnerden === 8) && (
                        <div className="stat-card">
                          <div className="stat-icon secondary">
                            <span className="material-icons">store</span>
                          </div>
                          <div className="stat-info">
                            <div className="stat-number">{paketNonCanceled.filter(a => a.siparisnerden === 8).length}</div>
                            <div className="stat-label">Migros</div>
                            <div className="stat-sublabel">{formatAmount(paketNonCanceled.filter(a => a.siparisnerden === 8).reduce((t, a) => t + (Number(a.atop) || 0), 0))}</div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              );
            })()}
          </div>

          {/* Adisyon Listesi */}
          {/* Pagination Kontrolleri */}
          {filteredAdisyonlar.length > 0 && (
            <div className="pagination-controls">
              <div className="pagination-info">
                <span>
                  {startIndex + 1}-{Math.min(endIndex, filteredAdisyonlar.length)} arası, 
                  toplam {filteredAdisyonlar.length} adisyon gösteriliyor
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

          <div className="adisyonlar-grid">
            {paginatedAdisyonlar.map((adisyon) => {
              const tip = getAdisyonTipi(adisyon.siparisnerden);
              const durum = getAdisyonDurum(adisyon.adisyon_durum, adisyon.durum);
              return (
                <div 
                  key={adisyon.id} 
                  className={`adisyon-card ${durum.bgColor} clickable`}
                  onClick={() => showAdisyonDetail(adisyon)}
                >
                  <div className="adisyon-header">
                    <div className="adisyon-code">
                      <span className="material-icons">receipt</span>
                      Adisyon Numarası: {adisyon.padsgnum || 'Numara Yok'}
                    </div>
                    <div className="adisyon-badges">
                      <div className={`adisyon-type ${tip.color}`}>
                        <span className="material-icons">{tip.icon}</span>
                        {tip.text}
                      </div>
                      <div className={`adisyon-status ${durum.color}`}>
                        <span className="material-icons">{durum.icon}</span>
                        {durum.text}
                      </div>
                    </div>
                  </div>
                  
                  <div className="adisyon-details">
                    <div className="detail-row">
                      <span className="detail-label">Toplam:</span>
                      <span className="detail-value amount">{formatAmount(adisyon.atop)}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Tarih:</span>
                      <span className="detail-value">{formatDate(adisyon.tarih)}</span>
                    </div>
                  </div>

                  <div className="adisyon-actions">
                    <button 
                      className="detail-btn"
                      onClick={(e) => {
                        e.stopPropagation(); // Kartın onClick'ini tetiklemeyi engelle
                        showAdisyonDetail(adisyon);
                      }}
                      title="Detayları Gör"
                    >
                      <span className="material-icons">visibility</span>
                      Detay
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Adisyon Detay Modal */}
      <AdisyonDetailModal 
        isOpen={isModalOpen} 
        onClose={closeModal} 
        adisyon={selectedAdisyon}
        masa={null}
      />
    </div>
  );
};

export default AdisyonlarPage;
