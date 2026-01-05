import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import './SatisAdetleriPage.css';

const SatisAdetleriPage = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSube, setSelectedSube] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportMode, setReportMode] = useState('daily'); // 'daily', 'range'
  // Tarih aralığı varsayılanları: başlangıç = dün, bitiş = bugün
  const todayRef = new Date();
  const yesterdayRef = new Date(todayRef);
  yesterdayRef.setDate(yesterdayRef.getDate() - 1);
  const [startDate, setStartDate] = useState(yesterdayRef.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(todayRef.toISOString().split('T')[0]);
  // Saat seçimi için state - varsayılan 08:00 (24 saat çalışan işletmeler için)
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('08:00');
  // Günlük mod için saat seçimi
  const [dailyStartTime, setDailyStartTime] = useState('00:00');
  const [dailyEndTime, setDailyEndTime] = useState('23:59');
  const [useDailyTimeFilter, setUseDailyTimeFilter] = useState(false);
  // Rapor getir butonu için tetikleyici
  const [reportTrigger, setReportTrigger] = useState(0);
  const [subeler, setSubeler] = useState([]);
  const [adisyonIcerik, setAdisyonIcerik] = useState([]);
  const [satisAdetleri, setSatisAdetleri] = useState([]);
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

        const unsubscribe = onSnapshot(subeQuery, (snapshot) => {
          const subeList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          console.log('Şubeler:', subeList);
          setSubeler(subeList);
          
          // Şirket yöneticisi değilse otomatik olarak kullanıcının şubesini seç
          if (currentUser?.role !== 'sirket_yoneticisi' && subeList.length > 0) {
            console.log('Otomatik şube seçimi yapılıyor:', subeList[0].id);
            setSelectedSube(subeList[0].id);
          }
        }, (error) => {
          console.error('Şubeler alınırken hata:', error);
          setError('Şubeler yüklenirken bir hata oluştu: ' + error.message);
        });

        return () => unsubscribe();
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

  // AdisyonIcerik verilerini getir
  useEffect(() => {
    if (!selectedSube) {
      setAdisyonIcerik([]);
      setLoading(false);
      return;
    }

    // Günlük modda selectedDate, tarih aralığı modunda startDate ve endDate kontrol et
    if (reportMode === 'daily' && !selectedDate) {
      setAdisyonIcerik([]);
      setLoading(false);
      return;
    }

    if (reportMode === 'range' && (!startDate || !endDate)) {
      setAdisyonIcerik([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('AdisyonIcerik sorgulanıyor, selectedSube:', selectedSube, 'reportMode:', reportMode);
      
      // Şube bazlı sorgu
      const adisyonIcerikQuery = query(
        collection(db, 'AdisyonIcerik'),
        where('rrc_restaurant_id', '==', selectedSube)
      );

      const unsubscribe = onSnapshot(adisyonIcerikQuery, 
        (snapshot) => {
          console.log('AdisyonIcerik snapshot alındı, doküman sayısı:', snapshot.docs.length);
          const icerikList = snapshot.docs.map(doc => {
            const data = { id: doc.id, ...doc.data() };
            console.log('AdisyonIcerik verisi:', data);
            return data;
          });
          
          // Client-side tarih filtreleme
          const filteredIcerikList = icerikList.filter(icerik => {
            if (!icerik.tarih) return false;
            try {
              // Tarih formatını kontrol et
              const icerikTarihStr = String(icerik.tarih);
              let icerikDateTime;
              
              if (icerikTarihStr.includes('T')) {
                // ISO format: "2025-08-04T10:45:47"
                icerikDateTime = new Date(icerikTarihStr);
              } else if (icerikTarihStr.includes(' ')) {
                // SQL format: "2025-08-04 10:45:47"
                icerikDateTime = new Date(icerikTarihStr.replace(' ', 'T'));
              } else {
                // Sadece tarih: "2025-08-04"
                icerikDateTime = new Date(icerikTarihStr + 'T00:00:00');
              }
              
              if (reportMode === 'daily') {
                if (useDailyTimeFilter) {
                  // Saat filtresi aktifse, tarih ve saat aralığına göre filtrele
                  const dayStart = new Date(`${selectedDate}T${dailyStartTime}:00`);
                  const dayEnd = new Date(`${selectedDate}T${dailyEndTime}:59`);
                  console.log('Günlük saat filtresi - İçerik:', icerikDateTime, 'Başlangıç:', dayStart, 'Bitiş:', dayEnd);
                  return icerikDateTime >= dayStart && icerikDateTime <= dayEnd;
                } else {
                  // Saat filtresi kapalıysa, sadece tarihe göre filtrele
                  const icerikTarih = icerikTarihStr.includes('T') 
                    ? icerikTarihStr.split('T')[0] 
                    : icerikTarihStr.includes(' ') 
                      ? icerikTarihStr.split(' ')[0] 
                      : icerikTarihStr;
                  console.log('Günlük filtre - İçerik tarihi:', icerikTarih, 'Hedef tarih:', selectedDate);
                  return icerikTarih === selectedDate;
                }
              } else if (reportMode === 'range') {
                // Saat dahil tarih aralığı kontrolü
                const rangeStart = new Date(`${startDate}T${startTime}:00`);
                const rangeEnd = new Date(`${endDate}T${endTime}:00`);
                
                console.log('Aralık filtre - İçerik:', icerikDateTime, 'Başlangıç:', rangeStart, 'Bitiş:', rangeEnd);
                return icerikDateTime >= rangeStart && icerikDateTime <= rangeEnd;
              }
              
              return false;
            } catch (err) {
              console.error('Tarih karşılaştırma hatası:', err, 'İçerik tarihi:', icerik.tarih);
              return false;
            }
          });
          
          console.log('Filtrelenmiş içerik sayısı:', filteredIcerikList.length);
          setAdisyonIcerik(filteredIcerikList);
          setLoading(false);
        },
        (err) => {
          console.error('AdisyonIcerik alınırken hata:', err);
          setError('Satış verileri yüklenirken bir hata oluştu: ' + err.message);
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (err) {
      console.error('AdisyonIcerik sorgulanırken hata:', err);
      setError('Satış verileri sorgulanırken bir hata oluştu: ' + err.message);
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSube, reportTrigger]);

  // Satış adetlerini hesapla
  useEffect(() => {
    if (!adisyonIcerik.length) {
      setSatisAdetleri([]);
      return;
    }

    // Ürünleri grupla ve adetleri topla
    const urunGruplari = {};
    
    adisyonIcerik.forEach(icerik => {
      const urunAdi = icerik.urunadi || 'Bilinmeyen Ürün';
      const boyut = icerik.selectedsizename || 'Standart';
      const miktar = parseInt(icerik.miktar) || 1;
      const fiyat = parseFloat(icerik.fiyat) || 0;
      
      // Ürün adı + boyut kombinasyonu ile grupla
      const anahtar = `${urunAdi} - ${boyut}`;
      
      if (urunGruplari[anahtar]) {
        urunGruplari[anahtar].miktar += miktar;
        urunGruplari[anahtar].toplamTutar += (miktar * fiyat);
      } else {
        urunGruplari[anahtar] = {
          urunAdi,
          boyut,
          miktar,
          birimFiyat: fiyat,
          toplamTutar: miktar * fiyat
        };
      }
    });

    // Objeden array'e çevir ve miktar bazında sırala (çoktan aza)
    const satisListesi = Object.keys(urunGruplari).map(anahtar => ({
      anahtar,
      ...urunGruplari[anahtar]
    })).sort((a, b) => b.miktar - a.miktar);

    console.log('Hesaplanan satış adetleri:', satisListesi);
    setSatisAdetleri(satisListesi);
  }, [adisyonIcerik]);

  // Tutar formatlama
  const formatAmount = (amount) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  return (
    <div className="satis-adetleri-container">
      <div className="page-header">
        <div className="header-content">
          <div className="title-section">
            <h1>
              <span className="material-icons">trending_up</span>
              Satış Adetleri
            </h1>
            <p>Ürün satış adetleri ve performans analizi</p>
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
            {subeler.map((sube) => (
              <option key={sube.id} value={sube.id}>
                {sube.subeAdi} (ID: {sube.id})
              </option>
            ))}
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
          <div className="filter-group daily-filter-group">
            <label htmlFor="date-select">Tarih Seçin:</label>
            <input
              type="date"
              id="date-select"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
            
            <div className="time-filter-toggle">
              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={useDailyTimeFilter}
                  onChange={(e) => setUseDailyTimeFilter(e.target.checked)}
                />
                <span className="toggle-switch"></span>
                <span className="toggle-text">Saat Filtresi</span>
              </label>
            </div>
            
            {useDailyTimeFilter && (
              <div className="daily-time-inputs">
                <div className="time-input-wrapper">
                  <label>Başlangıç Saati:</label>
                  <input
                    type="time"
                    value={dailyStartTime}
                    onChange={(e) => setDailyStartTime(e.target.value)}
                  />
                </div>
                <div className="time-input-wrapper">
                  <label>Bitiş Saati:</label>
                  <input
                    type="time"
                    value={dailyEndTime}
                    onChange={(e) => setDailyEndTime(e.target.value)}
                  />
                </div>
                <div className="quick-daily-buttons">
                  <button
                    type="button"
                    className="quick-btn small"
                    onClick={() => {
                      setDailyStartTime('08:00');
                      setDailyEndTime('23:59');
                    }}
                  >
                    08:00 - 23:59
                  </button>
                  <button
                    type="button"
                    className="quick-btn small"
                    onClick={() => {
                      setDailyStartTime('00:00');
                      setDailyEndTime('08:00');
                    }}
                  >
                    00:00 - 08:00
                  </button>
                  <button
                    type="button"
                    className="quick-btn small"
                    onClick={() => {
                      setDailyStartTime('12:00');
                      setDailyEndTime('23:59');
                    }}
                  >
                    12:00 - 23:59
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="filter-group date-range-group">
            <div className="date-range-info">
              <span className="material-icons">info</span>
              <span>24 saat çalışan işletmeler için saat seçimi yapabilirsiniz. Örn: Dün 08:00 - Bugün 08:00</span>
            </div>
            <div className="date-range-inputs">
              <div className="date-time-input-wrapper">
                <label>Başlangıç Tarihi ve Saati:</label>
                <div className="date-time-inputs">
                  <input
                    type="date"
                    id="start-date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                  <input
                    type="time"
                    id="start-time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
              </div>
              <div className="date-time-input-wrapper">
                <label>Bitiş Tarihi ve Saati:</label>
                <div className="date-time-inputs">
                  <input
                    type="date"
                    id="end-date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                  <input
                    type="time"
                    id="end-time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <div className="quick-time-buttons">
              <span className="quick-label">Hızlı Seçim:</span>
              <button
                type="button"
                className="quick-btn"
                onClick={() => {
                  const today = new Date();
                  const yesterday = new Date(today);
                  yesterday.setDate(yesterday.getDate() - 1);
                  setStartDate(yesterday.toISOString().split('T')[0]);
                  setEndDate(today.toISOString().split('T')[0]);
                  setStartTime('08:00');
                  setEndTime('08:00');
                }}
              >
                <span className="material-icons">schedule</span>
                Dün 08:00 - Bugün 08:00
              </button>
              <button
                type="button"
                className="quick-btn"
                onClick={() => {
                  const today = new Date();
                  setStartDate(today.toISOString().split('T')[0]);
                  setEndDate(today.toISOString().split('T')[0]);
                  setStartTime('00:00');
                  setEndTime('23:59');
                }}
              >
                <span className="material-icons">today</span>
                Bugün Tüm Gün
              </button>
              <button
                type="button"
                className="quick-btn"
                onClick={() => {
                  const today = new Date();
                  const yesterday = new Date(today);
                  yesterday.setDate(yesterday.getDate() - 1);
                  setStartDate(yesterday.toISOString().split('T')[0]);
                  setEndDate(yesterday.toISOString().split('T')[0]);
                  setStartTime('00:00');
                  setEndTime('23:59');
                }}
              >
                <span className="material-icons">history</span>
                Dün Tüm Gün
              </button>
            </div>
          </div>
        )}

        {/* Rapor Getir Butonu */}
        <div className="filter-group report-action-group">
          <button
            className="report-fetch-btn"
            onClick={() => setReportTrigger(prev => prev + 1)}
            disabled={!selectedSube || (reportMode === 'daily' && !selectedDate) || (reportMode === 'range' && (!startDate || !endDate))}
          >
            <span className="material-icons">search</span>
            Rapor Getir
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          <span className="material-icons">error</span>
          {error}
        </div>
      )}

      {(!selectedSube || (reportMode === 'daily' && !selectedDate) || (reportMode === 'range' && (!startDate || !endDate))) && !loading && (
        <div className="empty-state">
          <span className="material-icons">trending_up</span>
          <h3>Filtre Seçin</h3>
          <p>Satış verilerini görüntülemek için yukarıdan şube ve tarih seçin.</p>
        </div>
      )}

      {selectedSube && ((reportMode === 'daily' && selectedDate) || (reportMode === 'range' && startDate && endDate)) && loading && (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Satış verileri yükleniyor...</p>
        </div>
      )}

      {selectedSube && ((reportMode === 'daily' && selectedDate) || (reportMode === 'range' && startDate && endDate)) && !loading && satisAdetleri.length === 0 && !error && (
        <div className="empty-state">
          <span className="material-icons">trending_up</span>
          <h3>Satış Verisi Bulunamadı</h3>
          <p>Seçilen {reportMode === 'daily' ? 'tarih' : 'tarih aralığı'} ve şubede satış verisi bulunmuyor.</p>
        </div>
      )}

      {selectedSube && ((reportMode === 'daily' && selectedDate) || (reportMode === 'range' && startDate && endDate)) && !loading && satisAdetleri.length > 0 && (
        <>
          {/* İstatistikler */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon primary">
                <span className="material-icons">inventory</span>
              </div>
              <div className="stat-info">
                <div className="stat-number">{satisAdetleri.length}</div>
                <div className="stat-label">Farklı Ürün</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon success">
                <span className="material-icons">shopping_cart</span>
              </div>
              <div className="stat-info">
                <div className="stat-number">
                  {satisAdetleri.reduce((total, item) => total + item.miktar, 0)}
                </div>
                <div className="stat-label">Toplam Adet</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon warning">
                <span className="material-icons">monetization_on</span>
              </div>
              <div className="stat-info">
                <div className="stat-number">
                  {formatAmount(satisAdetleri.reduce((total, item) => total + item.toplamTutar, 0))}
                </div>
                <div className="stat-label">Toplam Tutar</div>
              </div>
            </div>
          </div>

          {/* Ürün Satış Detayları - Kart Tasarım */}
          <div className="product-sales-card">
            <div className="product-sales-header">
              <div className="header-icon">
                <span className="material-icons">list_alt</span>
              </div>
              <div>
                <h3>Ürün Satış Detayları</h3>
                <p>En çok satan ürünler, adetler ve toplam tutarlar</p>
              </div>
            </div>

            <div className="product-sales-body">
              <div className="product-sales-grid">
                {satisAdetleri.map((item, index) => (
                  <div key={item.anahtar} className="sale-card">
                    <div className="sale-card-header">
                      <div className="rank">#{index + 1}</div>
                      <div className="urun">{item.urunAdi}</div>
                    </div>
                    <div className="sale-card-body">
                      <div className="row">
                        <span className="label">Boyut</span>
                        <span className="value size">{item.boyut}</span>
                      </div>
                      <div className="row quantity">
                        <span className="label">Adet</span>
                        <span className="value adet">{item.miktar}</span>
                      </div>
                      <div className="row">
                        <span className="label">Birim</span>
                        <span className="value">{formatAmount(item.birimFiyat)}</span>
                      </div>
                      <div className="row total">
                        <span className="label">Toplam</span>
                        <span className="value tutar">{formatAmount(item.toplamTutar)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SatisAdetleriPage;
