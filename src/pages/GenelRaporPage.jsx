import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency, toDate } from '../utils/dateUtils';
import './GenelRaporPage.css';

const GenelRaporPage = () => {
  const { currentUser } = useAuth();
  
  // State
  const [subeler, setSubeler] = useState([]);
  const [selectedSube, setSelectedSube] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Data State
  const [adisyonlar, setAdisyonlar] = useState([]);
  const [masaOdemeleri, setMasaOdemeleri] = useState([]);
  const [giderler, setGiderler] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);
  
  // Filtreler
  const [reportMode, setReportMode] = useState('daily'); // 'daily', 'range'
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Range modu için
  const todayRef = new Date();
  const yesterdayRef = new Date(todayRef);
  yesterdayRef.setDate(yesterdayRef.getDate() - 1);
  const [startDate, setStartDate] = useState(yesterdayRef.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(todayRef.toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('08:00');
  
  // Günlük mod için saat seçimi
  const [dailyStartTime, setDailyStartTime] = useState('00:00');
  const [dailyEndTime, setDailyEndTime] = useState('23:59');
  const [useDailyTimeFilter, setUseDailyTimeFilter] = useState(false);
  
  // Tetikleyici
  const [reportTrigger, setReportTrigger] = useState(0);
  
  // UI State
  const [showGiderDetay, setShowGiderDetay] = useState(false);
  const [showCiroDetay, setShowCiroDetay] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [showMasaDebug, setShowMasaDebug] = useState(false);

  const pad = (n) => String(n).padStart(2, '0');
  const toLocalDateString = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const buildDateRange = () => {
    let startDatePart = reportMode === 'daily' ? selectedDate : startDate;
    let endDatePart = reportMode === 'daily' ? selectedDate : endDate;
    let startDateTime;
    let endDateTime;

    if (reportMode === 'daily') {
      if (useDailyTimeFilter) {
        startDateTime = new Date(`${selectedDate}T${dailyStartTime}:00`);
        endDateTime = new Date(`${selectedDate}T${dailyEndTime}:59`);

        if (endDateTime <= startDateTime) {
          endDateTime.setDate(endDateTime.getDate() + 1);
          endDatePart = toLocalDateString(endDateTime);
        }
      } else {
        startDateTime = new Date(`${selectedDate}T00:00:00`);
        endDateTime = new Date(`${selectedDate}T23:59:59`);
      }
    } else {
      startDateTime = new Date(`${startDate}T${startTime}:00`);
      endDateTime = endTime === '23:59'
        ? new Date(`${endDate}T23:59:59`)
        : new Date(`${endDate}T${endTime}:59`);
    }

    const startQueryStr = startDatePart;
    const endQueryStr = `${endDatePart}\uf8ff`;

    return { startDateTime, endDateTime, startQueryStr, endQueryStr };
  };

  const isInRange = (val, start, end) => {
    const d = toDate(val);
    if (!d) return false;
    return d >= start && d <= end;
  };

  // Şubeleri Getir
  useEffect(() => {
    const getSubeler = async () => {
      try {
        let subeQuery;
        
        if (currentUser?.role === 'sirket_yoneticisi') {
          subeQuery = query(collection(db, 'subeler'));
        } else if (currentUser?.subeId) {
          subeQuery = query(
            collection(db, 'subeler'), 
            where('__name__', '==', currentUser.subeId)
          );
        } else {
          return;
        }

        if (subeQuery) {
          const unsubscribe = onSnapshot(subeQuery, (snapshot) => {
            const subeList = snapshot.docs.map(doc => {
              const data = { id: doc.id, ...doc.data() };
              return data;
            });
            setSubeler(subeList);
            
            if (currentUser?.role !== 'sirket_yoneticisi' && subeList.length > 0) {
              const autoId = subeList[0].rrc_restaurant_id || subeList[0].id;
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
      getSubeler();
    }
    setLoading(false);
  }, [currentUser]);

  // Veri Çekme
  useEffect(() => {
    if (!selectedSube) return;
    
    if (reportMode === 'daily' && !selectedDate) return;
    if (reportMode === 'range' && (!startDate || !endDate)) return;
    if (reportTrigger === 0) return; // İlk render'da çalışmasın

    setDataLoading(true);
    setError(null);

    try {
      const { startDateTime, endDateTime, startQueryStr, endQueryStr } = buildDateRange();

      // 1. Adisyonlar
      const adisyonQuery = query(
        collection(db, 'Adisyonlar'),
        where('rrc_restaurant_id', '==', selectedSube),
        where('tarih', '>=', startQueryStr),
        where('tarih', '<=', endQueryStr)
      );

      const unsubAdisyon = onSnapshot(adisyonQuery, (snap) => {
        const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const filtered = data.filter(item => isInRange(item.tarih, startDateTime, endDateTime));
        setAdisyonlar(filtered);
      }, (err) => {
        console.error('Adisyon hatası:', err);
        setError('Adisyonlar yüklenirken hata: ' + err.message);
      });

      // 2. Masa Ödemeleri
      const masaQuery = query(
        collection(db, 'MasaOdemeleri'),
        where('rrc_restaurant_id', '==', selectedSube)
      );

      const unsubMasa = onSnapshot(masaQuery, (snap) => {
        const allData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Client-side tarih filtresi (string karşılaştırma)
        const filtered = allData.filter(item => {
          const dateField = item.tarih || item.createdAt || item.odemeTarihi;
          return isInRange(dateField, startDateTime, endDateTime);
        });
        setMasaOdemeleri(filtered);
      }, (err) => {
        console.warn('Masa ödemeleri hatası:', err);
      });

      // 3. Giderler
      const giderQuery = query(
        collection(db, 'giderKayitlari'),
        where('subeId', '==', selectedSube)
      );

      const unsubGider = onSnapshot(giderQuery, (snap) => {
        const allData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Client-side tarih filtresi
        const filtered = allData.filter(item => {
          const dateField = item.tarih || item.createdAt;
          return isInRange(dateField, startDateTime, endDateTime);
        });
        setGiderler(filtered);
      }, (err) => {
        console.warn('Giderler hatası:', err);
      });

      setDataLoading(false);
      return () => {
        unsubAdisyon();
        unsubMasa();
        unsubGider();
      };
    } catch (err) {
      console.error('Veri çekme hatası:', err);
      setError('Veriler yüklenirken hata oluştu: ' + err.message);
      setDataLoading(false);
    }
  }, [selectedSube, reportTrigger, reportMode, selectedDate, startDate, endDate, startTime, endTime, dailyStartTime, dailyEndTime, useDailyTimeFilter]);

  // İstatistikleri Hesapla
  const stats = useMemo(() => {
    // Adisyonları filtrele (MASA olanları hariç tut)
    const paketAdisyonlar = adisyonlar.filter(a => a.kisikod !== 'MASA');
    
    // İptal kontrolü
    const isCanceled = (item) => {
      const durumStr = (item.durum || '').toString().toUpperCase();
      return durumStr.includes('İPTAL') || durumStr.includes('IPTAL');
    };

    // Paket siparişler
    const paketValid = paketAdisyonlar.filter(a => !isCanceled(a));
    const paketIptal = paketAdisyonlar.filter(a => isCanceled(a));
    const paketCiro = paketValid.reduce((sum, a) => sum + (parseFloat(a.atop) || 0), 0);
    const paketIptalTutar = paketIptal.reduce((sum, a) => sum + (parseFloat(a.atop) || 0), 0);

    // Masa ödemeleri
    const masaCiro = masaOdemeleri.reduce((sum, m) => sum + (parseFloat(m.tutar || m.toplamTutar) || 0), 0);

    // Toplam ciro
    const toplamCiro = paketCiro + masaCiro;

    // Giderler
    const toplamGider = giderler.reduce((sum, g) => sum + (parseFloat(g.tutar) || 0), 0);

    // Net kâr/zarar
    const netKar = toplamCiro - toplamGider;

    // Ödeme tipi dağılımı
    const paketOdemeTipleri = {};
    paketValid.forEach(a => {
      const tip = (a.odemetipi || a.odemeYontemi || 'Bilinmiyor').toString();
      paketOdemeTipleri[tip] = (paketOdemeTipleri[tip] || 0) + (parseFloat(a.atop) || 0);
    });

    const masaOdemeTipleri = {};
    masaOdemeleri.forEach(m => {
      const tip = (m.odemesekli || m.odemeYontemi || 'Bilinmiyor').toString();
      masaOdemeTipleri[tip] = (masaOdemeTipleri[tip] || 0) + (parseFloat(m.tutar || m.toplamTutar) || 0);
    });

    // Platform dağılımı (sadece paket için)
    const platformlar = {};
    paketValid.forEach(a => {
      const platform = getPlatformName(a.siparisnerden);
      platformlar[platform] = (platformlar[platform] || 0) + (parseFloat(a.atop) || 0);
    });

    // Gider kategorileri
    const giderKategorileri = {};
    giderler.forEach(g => {
      const kategori = g.giderKalemiAdi || g.giderKalemi || 'Diğer';
      giderKategorileri[kategori] = (giderKategorileri[kategori] || 0) + (parseFloat(g.tutar) || 0);
    });

    return {
      toplamCiro,
      toplamGider,
      netKar,
      paketCiro,
      masaCiro,
      paketAdet: paketValid.length,
      masaAdet: masaOdemeleri.length,
      iptalAdet: paketIptal.length,
      iptalTutar: paketIptalTutar,
      platformlar,
      paketOdemeTipleri,
      masaOdemeTipleri,
      giderKategorileri,
      giderAdet: giderler.length
    };
  }, [adisyonlar, masaOdemeleri, giderler]);

  // Platform adı
  function getPlatformName(kod) {
    switch (kod) {
      case 0: return 'Telefon';
      case 1: return 'Yemek Sepeti';
      case 2: return 'Getir';
      case 5: return 'Trendyol';
      case 8: return 'Migros';
      default: return 'Diğer';
    }
  }

  // Rapor Getir
  const handleFetchReport = () => {
    setReportTrigger(prev => prev + 1);
  };

  return (
    <div className="genel-rapor-container">
      <div className="page-header">
        <div className="header-content">
          <div className="title-section">
            <h1>
              <span className="material-icons">bar_chart</span>
              Genel Finans Raporu
            </h1>
            <p>Detaylı ciro, gider ve kâr/zarar analizleri</p>
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
              const rrcId = sube.rrc_restaurant_id || sube.id;
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
            onClick={handleFetchReport}
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

      {/* Loading State */}
      {dataLoading && (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Rapor hazırlanıyor...</p>
        </div>
      )}

      {/* Empty State */}
      {!dataLoading && reportTrigger === 0 && (
        <div className="empty-state">
          <span className="material-icons">assessment</span>
          <h3>Rapor Hazır Değil</h3>
          <p>Yukarıdan şube ve tarih seçerek "Rapor Getir" butonuna tıklayın.</p>
        </div>
      )}

      {/* Rapor İçeriği */}
      {!dataLoading && reportTrigger > 0 && (
        <>
          {/* Ana İstatistikler */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon success">
                <span className="material-icons">payments</span>
              </div>
              <div className="stat-info">
                <div className="stat-number">{formatCurrency(stats.toplamCiro)}</div>
                <div className="stat-label">Toplam Ciro</div>
                <div className="stat-sublabel">{stats.paketAdet + stats.masaAdet} İşlem</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon danger">
                <span className="material-icons">trending_down</span>
              </div>
              <div className="stat-info">
                <div className="stat-number">{formatCurrency(stats.toplamGider)}</div>
                <div className="stat-label">Toplam Gider</div>
                <div className="stat-sublabel">{stats.giderAdet} Kayıt</div>
              </div>
            </div>

            <div className="stat-card">
              <div className={`stat-icon ${stats.netKar >= 0 ? 'primary' : 'warning'}`}>
                <span className="material-icons">
                  {stats.netKar >= 0 ? 'trending_up' : 'trending_down'}
                </span>
              </div>
              <div className="stat-info">
                <div className="stat-number" style={{color: stats.netKar >= 0 ? '#38a169' : '#dd6b20'}}>
                  {formatCurrency(stats.netKar)}
                </div>
                <div className="stat-label">Net {stats.netKar >= 0 ? 'Kâr' : 'Zarar'}</div>
                <div className="stat-sublabel">
                  {stats.netKar >= 0 ? '✓ Pozitif' : '⚠ Negatif'}
                </div>
              </div>
            </div>

            {stats.iptalAdet > 0 && (
              <div className="stat-card">
                <div className="stat-icon secondary">
                  <span className="material-icons">cancel</span>
                </div>
                <div className="stat-info">
                  <div className="stat-number">{stats.iptalAdet}</div>
                  <div className="stat-label">İptal Edilen</div>
                  <div className="stat-sublabel">{formatCurrency(stats.iptalTutar)}</div>
                </div>
              </div>
            )}
          </div>

          {/* Ciro Detayı */}
          <div className="detail-section">
            <h3>
              <span className="material-icons">monetization_on</span>
              Ciro Detayı
              <button 
                className="toggle-button"
                onClick={() => setShowCiroDetay(!showCiroDetay)}
              >
                <span className="material-icons">
                  {showCiroDetay ? 'expand_less' : 'expand_more'}
                </span>
                {showCiroDetay ? 'Gizle' : 'Göster'}
              </button>
            </h3>

            {showCiroDetay && (
              <div className="analysis-grid">
                <div className="analysis-card">
                  <div className="analysis-header">
                    <span className="material-icons">table_restaurant</span>
                    <h3>Masa Siparişleri</h3>
                  </div>
                  <div className="analysis-content">
                    <div className="metric">
                      <span className="label">Sipariş Adedi</span>
                      <span className="value">{stats.masaAdet}</span>
                    </div>
                    <div className="metric">
                      <span className="label">Toplam Tutar</span>
                      <span className="value success">{formatCurrency(stats.masaCiro)}</span>
                    </div>
                    <div className="metric">
                      <span className="label">Ortalama</span>
                      <span className="value">
                        {stats.masaAdet > 0 ? formatCurrency(stats.masaCiro / stats.masaAdet) : '0 ₺'}
                      </span>
                    </div>
                    {Object.keys(stats.masaOdemeTipleri).length > 0 && (
                      <div className="metric" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: '0.5rem' }}>
                        <span className="label">Ödeme Tipi Dağılımı</span>
                        <div style={{ display: 'grid', gap: '0.35rem', width: '100%' }}>
                          {Object.entries(stats.masaOdemeTipleri).map(([tip, tutar]) => (
                            <div key={tip} className="metric" style={{ marginBottom: 0 }}>
                              <span className="label">{tip}</span>
                              <span className="value">{formatCurrency(tutar)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="analysis-card">
                  <div className="analysis-header">
                    <span className="material-icons">takeout_dining</span>
                    <h3>Paket Siparişler</h3>
                  </div>
                  <div className="analysis-content">
                    <div className="metric">
                      <span className="label">Sipariş Adedi</span>
                      <span className="value">{stats.paketAdet}</span>
                    </div>
                    <div className="metric">
                      <span className="label">Toplam Tutar</span>
                      <span className="value success">{formatCurrency(stats.paketCiro)}</span>
                    </div>
                    <div className="metric">
                      <span className="label">Ortalama</span>
                      <span className="value">
                        {stats.paketAdet > 0 ? formatCurrency(stats.paketCiro / stats.paketAdet) : '0 ₺'}
                      </span>
                    </div>
                    {Object.keys(stats.paketOdemeTipleri).length > 0 && (
                      <div className="metric" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: '0.5rem' }}>
                        <span className="label">Ödeme Tipi Dağılımı</span>
                        <div style={{ display: 'grid', gap: '0.35rem', width: '100%' }}>
                          {Object.entries(stats.paketOdemeTipleri).map(([tip, tutar]) => (
                            <div key={tip} className="metric" style={{ marginBottom: 0 }}>
                              <span className="label">{tip}</span>
                              <span className="value">{formatCurrency(tutar)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="analysis-card">
                  <div className="analysis-header">
                    <span className="material-icons">summarize</span>
                    <h3>Masa vs Paket Toplamı</h3>
                  </div>
                  <div className="analysis-content">
                    <div className="metric">
                      <span className="label">Masa Siparişleri Toplamı</span>
                      <span className="value success">{formatCurrency(stats.masaCiro)}</span>
                    </div>
                    <div className="metric">
                      <span className="label">Paket Siparişler Toplamı</span>
                      <span className="value success">{formatCurrency(stats.paketCiro)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Gider Detayı */}
          <div className="detail-section">
            <h3>
              <span className="material-icons">receipt_long</span>
              Gider Detayı
              <button 
                className="toggle-button"
                onClick={() => setShowGiderDetay(!showGiderDetay)}
              >
                <span className="material-icons">
                  {showGiderDetay ? 'expand_less' : 'expand_more'}
                </span>
                {showGiderDetay ? 'Gizle' : 'Göster'}
              </button>
            </h3>

            {showGiderDetay && Object.keys(stats.giderKategorileri).length > 0 && (
              <div className="detail-table">
                <div className="table-header">
                  <div className="header-cell">Gider Kalemi</div>
                  <div className="header-cell">Tutar</div>
                  <div className="header-cell">Oran</div>
                </div>
                {Object.entries(stats.giderKategorileri)
                  .sort((a, b) => b[1] - a[1])
                  .map(([kategori, tutar]) => (
                    <div className="table-row" key={kategori}>
                      <div className="table-cell">{kategori}</div>
                      <div className="table-cell amount">{formatCurrency(tutar)}</div>
                      <div className="table-cell">
                        %{stats.toplamGider > 0 ? ((tutar / stats.toplamGider) * 100).toFixed(1) : 0}
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {showGiderDetay && Object.keys(stats.giderKategorileri).length === 0 && (
              <div className="empty-state">
                <span className="material-icons">info</span>
                <p>Bu dönem için gider kaydı bulunmuyor.</p>
              </div>
            )}
          </div>

          {/* Rapor Bilgi Footer */}
          <div className="report-footer">
            <p>
              <span className="material-icons">info</span>
              Bu rapor {reportMode === 'daily' ? selectedDate : `${startDate} - ${endDate}`} tarihleri 
              için oluşturulmuştur. {' '}
              Toplam {stats.paketAdet + stats.masaAdet} işlem ve {stats.giderAdet} gider kaydı analiz edildi.
            </p>
          </div>
        </>
      )}

      {/* Debug Alanı */}
      {reportTrigger > 0 && (
        <div className="detail-section" style={{marginTop: '2rem'}}>
          <h3>
            <span className="material-icons" style={{color: '#e53e3e'}}>bug_report</span>
            Debug - Adisyonlar Verisi
            <button 
              className="toggle-button"
              onClick={() => setShowDebug(!showDebug)}
            >
              <span className="material-icons">
                {showDebug ? 'expand_less' : 'expand_more'}
              </span>
              {showDebug ? 'Gizle' : 'Göster'}
            </button>
          </h3>

          {showDebug && (
            <div style={{
              background: '#1a1a1a',
              color: '#00ff00',
              padding: '1.5rem',
              borderRadius: '8px',
              fontFamily: 'monospace',
              fontSize: '0.85rem',
              maxHeight: '500px',
              overflow: 'auto'
            }}>
              <div style={{marginBottom: '1rem', color: '#ffff00'}}>
                <strong>📊 Toplam Adisyon: {adisyonlar.length}</strong>
              </div>
              
              {adisyonlar.length === 0 ? (
                <div style={{color: '#ff6b6b'}}>⚠️ Adisyon verisi bulunamadı</div>
              ) : (
                <>
                  <div style={{marginBottom: '1rem', color: '#60a5fa'}}>
                    <strong>İlk 5 Adisyon:</strong>
                  </div>
                  {adisyonlar.slice(0, 5).map((adisyon, index) => (
                    <div key={adisyon.id} style={{
                      marginBottom: '1.5rem',
                      padding: '1rem',
                      background: '#2a2a2a',
                      borderRadius: '6px',
                      borderLeft: '4px solid #10b981'
                    }}>
                      <div style={{color: '#fbbf24', marginBottom: '0.5rem'}}>
                        <strong>#{index + 1} - ID: {adisyon.id}</strong>
                      </div>
                      <pre style={{margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word'}}>
                        {JSON.stringify(adisyon, null, 2)}
                      </pre>
                    </div>
                  ))}
                  
                  {adisyonlar.length > 5 && (
                    <div style={{color: '#a78bfa', textAlign: 'center', marginTop: '1rem'}}>
                      ... ve {adisyonlar.length - 5} adisyon daha
                    </div>
                  )}

                  <div style={{marginTop: '2rem', padding: '1rem', background: '#2a2a2a', borderRadius: '6px'}}>
                    <div style={{color: '#60a5fa', marginBottom: '1rem'}}>
                      <strong>📈 İstatistikler:</strong>
                    </div>
                    <div style={{display: 'grid', gap: '0.5rem'}}>
                      <div>• Toplam: {adisyonlar.length} adisyon</div>
                      <div>• Masa (kisikod=MASA): {adisyonlar.filter(a => a.kisikod === 'MASA').length}</div>
                      <div>• Paket (kisikod≠MASA): {adisyonlar.filter(a => a.kisikod !== 'MASA').length}</div>
                      <div>• İptal: {adisyonlar.filter(a => {
                        const durum = (a.durum || '').toString().toUpperCase();
                        return durum.includes('İPTAL') || durum.includes('IPTAL');
                      }).length}</div>
                      <div style={{color: '#fbbf24', marginTop: '0.5rem'}}>• Toplam Tutar: {formatCurrency(
                        adisyonlar.reduce((sum, a) => sum + (parseFloat(a.atop) || 0), 0)
                      )}</div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {reportTrigger > 0 && (
        <div className="detail-section" style={{marginTop: '1.5rem'}}>
          <h3>
            <span className="material-icons" style={{color: '#e53e3e'}}>bug_report</span>
            Debug - Masa Ödemeleri Verisi
            <button 
              className="toggle-button"
              onClick={() => setShowMasaDebug(!showMasaDebug)}
            >
              <span className="material-icons">
                {showMasaDebug ? 'expand_less' : 'expand_more'}
              </span>
              {showMasaDebug ? 'Gizle' : 'Göster'}
            </button>
          </h3>

          {showMasaDebug && (
            <div style={{
              background: '#1a1a1a',
              color: '#00ff00',
              padding: '1.5rem',
              borderRadius: '8px',
              fontFamily: 'monospace',
              fontSize: '0.85rem',
              maxHeight: '500px',
              overflow: 'auto'
            }}>
              <div style={{marginBottom: '1rem', color: '#ffff00'}}>
                <strong>📊 Toplam Masa Ödemesi: {masaOdemeleri.length}</strong>
              </div>
              
              {masaOdemeleri.length === 0 ? (
                <div style={{color: '#ff6b6b'}}>⚠️ Masa ödeme verisi bulunamadı</div>
              ) : (
                <>
                  <div style={{marginBottom: '1rem', color: '#60a5fa'}}>
                    <strong>İlk 5 Masa Ödemesi:</strong>
                  </div>
                  {masaOdemeleri.slice(0, 5).map((odeme, index) => (
                    <div key={odeme.id} style={{
                      marginBottom: '1.5rem',
                      padding: '1rem',
                      background: '#2a2a2a',
                      borderRadius: '6px',
                      borderLeft: '4px solid #3b82f6'
                    }}>
                      <div style={{color: '#fbbf24', marginBottom: '0.5rem'}}>
                        <strong>#{index + 1} - ID: {odeme.id}</strong>
                      </div>
                      <pre style={{margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word'}}>
                        {JSON.stringify(odeme, null, 2)}
                      </pre>
                    </div>
                  ))}
                  
                  {masaOdemeleri.length > 5 && (
                    <div style={{color: '#a78bfa', textAlign: 'center', marginTop: '1rem'}}>
                      ... ve {masaOdemeleri.length - 5} masa ödemesi daha
                    </div>
                  )}

                  <div style={{marginTop: '2rem', padding: '1rem', background: '#2a2a2a', borderRadius: '6px'}}>
                    <div style={{color: '#60a5fa', marginBottom: '1rem'}}>
                      <strong>📈 İstatistikler:</strong>
                    </div>
                    <div style={{display: 'grid', gap: '0.5rem'}}>
                      <div>• Toplam: {masaOdemeleri.length} ödeme</div>
                      <div style={{color: '#fbbf24', marginTop: '0.5rem'}}>• Toplam Tutar: {formatCurrency(
                        masaOdemeleri.reduce((sum, o) => sum + (parseFloat(o.tutar || o.toplamTutar) || 0), 0)
                      )}</div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GenelRaporPage;
