import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import './GenelRaporPage.css';

const GenelRaporPage = () => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState({
    giderler: [],
    adisyonlar: [],
    kuryeRaporlari: []
  });
  const [isMobile, setIsMobile] = useState(false);
  const [showFilters, setShowFilters] = useState(true);

  // Tarih aralığı varsayılanları: başlangıç = dün, bitiş = bugün
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const defaultStartDate = yesterday.toISOString().split('T')[0];
  const defaultEndDate = today.toISOString().split('T')[0];

  // Saat seçimi için state - varsayılan 08:00 (24 saat çalışan işletmeler için)
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('08:00');
  // Günlük mod için saat seçimi
  const [dailyStartTime, setDailyStartTime] = useState('00:00');
  const [dailyEndTime, setDailyEndTime] = useState('23:59');
  const [useDailyTimeFilter, setUseDailyTimeFilter] = useState(false);
  // Rapor getir butonu için tetikleyici
  const [reportTrigger, setReportTrigger] = useState(0);

  // Filter state
  const [filter, setFilter] = useState({
    mode: 'daily', // 'daily' | 'range'
    date: new Date().toISOString().split('T')[0],
    startDate: defaultStartDate,
    endDate: defaultEndDate,
    subeId: currentUser?.role === 'sube_yoneticisi' ? currentUser.subeId : ''
  });

  const [subeler, setSubeler] = useState([]);

  useEffect(() => {
    // Şubeleri getir (şirket yöneticisi için)
    const fetchSubeler = async () => {
      if (currentUser?.role === 'sirket_yoneticisi') {
        try {
          const q = query(collection(db, 'subeler'));
          const snapshot = await getDocs(q);
          const items = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          
          // Client-side sorting
          items.sort((a, b) => (a.ad || '').localeCompare(b.ad || ''));
          setSubeler(items);
        } catch (error) {
          console.error('Şubeler getirme hatası:', error);
          setSubeler([]);
        }
      }
    };

    fetchSubeler();
  }, [currentUser]);

  useEffect(() => {
    fetchReportData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportTrigger, currentUser]);

  // Detect mobile and set default filters visibility (hidden on mobile by default)
  useEffect(() => {
    const onResize = () => {
      const m = window.innerWidth <= 768;
      setIsMobile(m);
      setShowFilters(!m); // show on desktop, hide on mobile by default
    };
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const fetchReportData = async () => {
    setLoading(true);
    setError(null);
    try {
      let startDate, endDate, startStr, endStr;
      
      if (filter.mode === 'daily') {
        const datePart = filter.date;
        if (useDailyTimeFilter) {
          startDate = new Date(`${datePart}T${dailyStartTime}:00`);
          endDate = new Date(`${datePart}T${dailyEndTime}:59`);
          startStr = `${datePart} ${dailyStartTime}:00`;
          endStr = `${datePart} ${dailyEndTime}:59`;
        } else {
          startDate = new Date(datePart + 'T00:00:00');
          endDate = new Date(datePart + 'T23:59:59');
          // Start with space, end with high unicode to catch both " " and "T" formats
          startStr = `${datePart}`; 
          endStr = `${datePart}\uf8ff`;
        }
      } else {
        startDate = new Date(`${filter.startDate}T${startTime}:00`);
        endDate = new Date(`${filter.endDate}T${endTime}:59`);
        startStr = `${filter.startDate} ${startTime}:00`;
        // If it's a range, we still want to be careful with the end string
        endStr = `${filter.endDate} ${endTime}:59`;
        // To handle T vs space in ranges, if endTime is 23:59, use the high unicode trick
        if (endTime === '23:59') {
          endStr = `${filter.endDate}\uf8ff`;
        } else if (endStr.includes(' ')) {
           // Range queries with time are tricky with mixed T/space. 
           // Best to just use the string comparison and hope for consistency in that branch
        }
      }

      // String dönüşümü ile güvenli karşılaştırma
      const selectedSubeObj = subeler.find(s => 
        String(s.rrc_restaurant_id) === String(filter.subeId) || 
        String(s.id) === String(filter.subeId)
      );
      
      // Dropdown'dan gelen filter.subeId string'dir. 
      // Eğer sube objesini bulduysak, onun içindeki orijinal rrc_restaurant_id tipini (number olabilir) kullanalım.
      let activeRrcId = filter.subeId;
      if (filter.subeId && selectedSubeObj) {
           // Eşleşme sube.id üzerinden de olmuş olabilir, ama sorgu için rrcId tercih ediyoruz
           activeRrcId = selectedSubeObj.rrc_restaurant_id || selectedSubeObj.id;
      }
      
      if (!activeRrcId && currentUser?.role === 'sube_yoneticisi') {
         activeRrcId = currentUser.rrc_restaurant_id || currentUser.subeId;
      }

      const activeDocId = selectedSubeObj?.id || (currentUser?.role === 'sube_yoneticisi' ? currentUser.subeId : null);

      // 1. GIDERLER
      let giderQuery;
      // Giderlerde usually we use the doc ID
      if (activeDocId) {
        giderQuery = query(
          collection(db, 'giderKayitlari'),
          where('subeId', '==', activeDocId),
          where('tarih', '>=', startDate),
          where('tarih', '<=', endDate),
          orderBy('tarih', 'desc')
        );
      } else {
        giderQuery = query(
          collection(db, 'giderKayitlari'),
          where('tarih', '>=', startDate),
          where('tarih', '<=', endDate),
          orderBy('tarih', 'desc')
        );
      }
      const giderSnapshot = await getDocs(giderQuery);
      const giderler = giderSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // 2. ADISYONLAR (Server-side string range filter)
      let adisyonlar = [];
      const adisyonCollection = collection(db, 'Adisyonlar');
      
      // Adisyonlar sorgusu
      let adisyonQuery;
      
      // Önce tarih aralığı ile tüm adisyonları çek (şube filtresi olmadan)
      const allAdisyonQuery = query(
        adisyonCollection,
        where('tarih', '>=', startStr),
        where('tarih', '<=', endStr),
        orderBy('tarih', 'asc')
      );
      
      try {
        const adSnap = await getDocs(allAdisyonQuery);
        adisyonlar = adSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Şube seçiliyse client-side filtrele
        if (activeRrcId && adisyonlar.length > 0) {
          const rrcStr = String(activeRrcId);
          const filtered = adisyonlar.filter(a => 
            String(a.rrc_restaurant_id) === rrcStr || 
            String(a.subeId) === String(activeDocId)
          );
          adisyonlar = filtered;
        }

        // adisyoncode bazında tekilleştirme (AdisyonlarPage ile tutarlı)
        const seen = new Map();
        for (const adisyon of adisyonlar) {
          const key = adisyon.adisyoncode;
          if (key != null && key !== '') {
            seen.set(key, adisyon);
          } else {
            seen.set(adisyon.id, adisyon);
          }
        }
        adisyonlar = Array.from(seen.values());
      } catch (e) {
        console.warn('Adisyon sorgusu hata:', e);
        if (e.code === 'failed-precondition') {
          setError('Sorgu için Firestore Index gerekli. Lütfen tarayıcı konsolundaki linke tıklayarak index oluşturun.');
        }
      }

      // 3. KURYE ATAMA
      let kuryeQuery;
      if (activeDocId) {
        kuryeQuery = query(
          collection(db, 'kuryeatama'),
          where('subeId', '==', activeDocId),
          where('atamaTarihi', '>=', startDate),
          where('atamaTarihi', '<=', endDate),
          orderBy('atamaTarihi', 'desc')
        );
      } else {
        kuryeQuery = query(
          collection(db, 'kuryeatama'),
          where('atamaTarihi', '>=', startDate),
          where('atamaTarihi', '<=', endDate),
          orderBy('atamaTarihi', 'desc')
        );
      }

      const kuryeSnapshot = await getDocs(kuryeQuery);
      const kuryeRaporlari = kuryeSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      setData({
        giderler,
        adisyonlar,
        kuryeRaporlari
      });

    } catch (error) {
      console.error('Rapor verisi getirme hatası:', error);
      setData({
        giderler: [],
        adisyonlar: [],
        kuryeRaporlari: []
      });
    } finally {
      setLoading(false);
    }
  };

  // İptal kontrolü (AdisyonlarPage ile aynı mantık)
  const isCanceled = (adisyon) => {
    if (!adisyon || !adisyon.durum) return false;
    try {
      const s = String(adisyon.durum).toUpperCase();
      return s.includes('İPTAL') || s.includes('IPTAL');
    } catch {
      return false;
    }
  };

  // Ödeme tiplerine göre atop toplamları (Firestore alanı: 'odemetipi'); eski kodla uyum için 'odemeTipi' fallback
  const normalizeOdemeTipi = (value) => {
    if (value === undefined || value === null) return 'Diğer';
    if (typeof value === 'number') {
      if (value === 1) return 'Nakit';
      if (value === 2) return 'Kart/Kredi';
      return `Kod ${value}`;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return 'Diğer';
      const norm = trimmed.toUpperCase().replace(/İ/g, 'I');
      if (/NAK/.test(norm) || norm === 'CASH') return 'Nakit';
      if (/KART|KREDI|POS/.test(norm)) return 'Kart/Kredi';
      return trimmed; // orijinal etiketi koru
    }
    return 'Diğer';
  };

  // Adisyon tutar helper
  const getAdisyonTutar = (a) => Number(a.atop) || Number(a.toplamTutar) || 0;

  // Hesaplamalar
  const nonCanceledAdisyonlar = data.adisyonlar.filter(a => !isCanceled(a));
  const canceledAdisyonlar = data.adisyonlar.filter(a => isCanceled(a));

  // siparisnerden'e göre Masa / Paket ayrımı (AdisyonlarPage ile tutarlı)
  const isMasaAdisyon = (a) => Number(a.siparisnerden) === 88;

  const masaAdisyonlar = nonCanceledAdisyonlar.filter(a => isMasaAdisyon(a));
  const paketAdisyonlar = nonCanceledAdisyonlar.filter(a => !isMasaAdisyon(a));

  const toplamGider = data.giderler.reduce((total, item) => total + item.tutar, 0);
  
  const gunlukKasaGider = data.giderler
    .filter(item => item.odemeKaynagi === 'gunluk_kasa')
    .reduce((total, item) => total + item.tutar, 0);
    
  const merkezKasaGider = data.giderler
    .filter(item => item.odemeKaynagi === 'merkez_kasa')
    .reduce((total, item) => total + item.tutar, 0);

  // Masa satış toplamı
  const masaSatis = masaAdisyonlar.reduce((total, item) => total + getAdisyonTutar(item), 0);
  // Paket satış toplamı
  const paketSatis = paketAdisyonlar.reduce((total, item) => total + getAdisyonTutar(item), 0);
  // Genel toplam
  const toplamSatis = masaSatis + paketSatis;

  const calculations = {
    toplamGider,
    gunlukKasaGider,
    merkezKasaGider,
    toplamSatis,
    masaSatis,
    paketSatis,
    
    // Kurye İstatistikleri
    toplamTeslimat: data.kuryeRaporlari.length,
    tamamlananTeslimat: data.kuryeRaporlari.filter(item => item.durum === 'tamamlandi').length,
    bekleyenTeslimat: data.kuryeRaporlari.filter(item => item.durum === 'beklemede').length,
    
    // Net Kar (Satış - Gider)
    netKar: toplamSatis - toplamGider
  };

  // Ödeme tipi dağılımı — sadece paket adisyonlar üzerinden
  const odemeTipiToplamlariObj = paketAdisyonlar.reduce((acc, item) => {
    const raw = item.odemetipi !== undefined ? item.odemetipi : item.odemeTipi;
    const key = normalizeOdemeTipi(raw);
    const tutar = getAdisyonTutar(item);
    acc[key] = (acc[key] || 0) + tutar;
    return acc;
  }, {});
  const toplamSatisForPercent = Object.values(odemeTipiToplamlariObj).reduce((a, b) => a + b, 0) || 1;
  const odemeTipiToplamlari = Object.entries(odemeTipiToplamlariObj)
    .map(([tip, tutar]) => ({ tip, tutar, yuzde: (tutar / toplamSatisForPercent) * 100 }))
    .sort((a, b) => b.tutar - a.tutar);

  // Gider kalemi bazında gruplandırma
  const giderKalemleriGrouped = data.giderler.reduce((acc, item) => {
    const key = item.giderKalemiAdi;
    if (!acc[key]) {
      acc[key] = {
        ad: key,
        tutar: 0,
        adet: 0
      };
    }
    acc[key].tutar += item.tutar;
    acc[key].adet += 1;
    return acc;
  }, {});

  const giderKalemleriArray = Object.values(giderKalemleriGrouped).sort((a, b) => b.tutar - a.tutar);

  if (loading) {
    return (
      <div className="genel-rapor-container">
        <div className="page-header">
          <div className="header-content">
            <div className="title-section">
              <h1>
                <span className="material-icons">analytics</span>
                Genel Rapor
              </h1>
              <p>Şube performans ve finansal analiz özeti</p>
            </div>
          </div>
        </div>
        
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Rapor hazırlanıyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="genel-rapor-container">
      <div className="page-header">
        <div className="header-content">
          <div className="title-section">
            <h1>
              <span className="material-icons">analytics</span>
              Genel Rapor
            </h1>
            <p>Şube performans ve finansal analiz özeti</p>
          </div>
        </div>
      </div>

      {/* Filtreler */}
      <div className="filters-section">
        <div className="filters-toggle-row">
          <h4 className="filters-title">
            <span className="material-icons">filter_list</span>
            Filtreler
          </h4>
          <button
            type="button"
            className="filters-toggle-button"
            onClick={() => setShowFilters(v => !v)}
            aria-expanded={showFilters}
          >
            <span className="material-icons" aria-hidden="true">{showFilters ? 'expand_less' : 'expand_more'}</span>
            {showFilters ? 'Gizle' : 'Göster'}
          </button>
        </div>

        {(showFilters || !isMobile) && (
        <div className="filter-row" style={{ gap: '16px', flexWrap: 'wrap' }}>
          <div className="filter-group">
            <label>Rapor Tipi:</label>
            <div className="report-mode-buttons">
              <button
                className={`filter-btn ${filter.mode === 'daily' ? 'active' : ''}`}
                onClick={() => setFilter({ ...filter, mode: 'daily' })}
              >
                <span className="material-icons">today</span>
                Günlük
              </button>
              <button
                className={`filter-btn ${filter.mode === 'range' ? 'active' : ''}`}
                onClick={() => setFilter({ ...filter, mode: 'range' })}
              >
                <span className="material-icons">date_range</span>
                Tarih Aralığı
              </button>
            </div>
          </div>

          {filter.mode === 'daily' ? (
            <div className="filter-group daily-filter-group">
              <label htmlFor="date">Tarih:</label>
              <input
                id="date"
                type="date"
                value={filter.date}
                onChange={(e) => setFilter({ ...filter, date: e.target.value })}
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
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="filter-group date-range-group">
              <div className="date-range-info">
                <span className="material-icons">info</span>
                <span>24 saat çalışan işletmeler için saat seçimi yapabilirsiniz</span>
              </div>
              <div className="date-range-inputs">
                <div className="date-time-input-wrapper">
                  <label>Başlangıç Tarihi ve Saati:</label>
                  <div className="date-time-inputs">
                    <input
                      id="start-date"
                      type="date"
                      value={filter.startDate}
                      onChange={(e) => setFilter({ ...filter, startDate: e.target.value })}
                    />
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                    />
                  </div>
                </div>
                <div className="date-time-input-wrapper">
                  <label>Bitiş Tarihi ve Saati:</label>
                  <div className="date-time-inputs">
                    <input
                      id="end-date"
                      type="date"
                      value={filter.endDate}
                      onChange={(e) => setFilter({ ...filter, endDate: e.target.value })}
                    />
                    <input
                      type="time"
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
                    const t = new Date();
                    const y = new Date(t);
                    y.setDate(y.getDate() - 1);
                    setFilter({ ...filter, startDate: y.toISOString().split('T')[0], endDate: t.toISOString().split('T')[0] });
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
                    const t = new Date();
                    setFilter({ ...filter, startDate: t.toISOString().split('T')[0], endDate: t.toISOString().split('T')[0] });
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
                    const t = new Date();
                    const y = new Date(t);
                    y.setDate(y.getDate() - 1);
                    setFilter({ ...filter, startDate: y.toISOString().split('T')[0], endDate: y.toISOString().split('T')[0] });
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

          <div className="filter-group">
            <label htmlFor="sube-select">Şube:</label>
            <select
              id="sube-select"
              value={filter.subeId}
              onChange={(e) => setFilter({ ...filter, subeId: e.target.value })}
              disabled={currentUser?.role !== 'sirket_yoneticisi'}
            >
              {currentUser?.role === 'sirket_yoneticisi' ? (
                <>
                  <option value="">Tüm Şubeler</option>
                  {subeler.map(sube => (
                    <option key={sube.id} value={sube.rrc_restaurant_id || sube.id}>{sube.ad || sube.subeAdi}</option>
                  ))}
                </>
              ) : (
                <option value={currentUser?.subeId}>{currentUser?.subeAdi || 'Şubem'}</option>
              )}
            </select>
          </div>

          {/* Rapor Getir Butonu */}
          <div className="filter-group report-action-group">
            <button
              className="report-fetch-btn"
              onClick={() => setReportTrigger(prev => prev + 1)}
            >
              <span className="material-icons">search</span>
              Rapor Getir
            </button>
          </div>
        </div>
        )}
      </div>

      {error && (
        <div className="error-message">
          <span className="material-icons">error</span>
          {error}
        </div>
      )}

      {/* Özet Kartları — Masa / Paket / Genel Toplam */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon primary">
            <span className="material-icons">table_restaurant</span>
          </div>
          <div className="stat-info">
            <div className="stat-number">₺{calculations.masaSatis.toFixed(2)}</div>
            <div className="stat-label">Masa Toplam ({masaAdisyonlar.length} adisyon)</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon warning">
            <span className="material-icons">takeout_dining</span>
          </div>
          <div className="stat-info">
            <div className="stat-number">₺{calculations.paketSatis.toFixed(2)}</div>
            <div className="stat-label">Paket Toplam ({paketAdisyonlar.length} adisyon)</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon success">
            <span className="material-icons">trending_up</span>
          </div>
          <div className="stat-info">
            <div className="stat-number">₺{calculations.toplamSatis.toFixed(2)}</div>
            <div className="stat-label">Genel Toplam ({nonCanceledAdisyonlar.length} adisyon)</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon danger">
            <span className="material-icons">trending_down</span>
          </div>
          <div className="stat-info">
            <div className="stat-number">₺{calculations.toplamGider.toFixed(2)}</div>
            <div className="stat-label">Toplam Gider</div>
          </div>
        </div>

        <div className="stat-card">
          <div className={`stat-icon ${calculations.netKar >= 0 ? 'success' : 'danger'}`}>
            <span className="material-icons">
              {calculations.netKar >= 0 ? 'account_balance' : 'warning'}
            </span>
          </div>
          <div className="stat-info">
            <div className="stat-number">₺{calculations.netKar.toFixed(2)}</div>
            <div className="stat-label">Net Kar/Zarar</div>
          </div>
        </div>
      </div>

      {/* Detaylı Analizler */}
      <div className="analysis-grid">
        {/* Ödeme Tipi Satış Toplamları (odemetipi alanı) */}
        <div className="analysis-card">
          <div className="analysis-header">
            <span className="material-icons">payments</span>
            <h3>Ödeme Tipi Dağılımı</h3>
          </div>
          <div className="analysis-content">
            {odemeTipiToplamlari.length === 0 && (
              <div className="metric">
                <span className="label">Kayıt Yok</span>
                <span className="value">-</span>
              </div>
            )}
            {odemeTipiToplamlari.map(item => (
              <div className="metric" key={item.tip}>
                <span className="label">{item.tip}:</span>
                <span className="value">₺{item.tutar.toFixed(2)} ({item.yuzde.toFixed(1)}%)</span>
              </div>
            ))}
            {nonCanceledAdisyonlar.length > 0 && (
              <div className="metric">
                <span className="label">Paket Adisyon:</span>
                <span className="value">{paketAdisyonlar.length}</span>
              </div>
            )}
            {paketAdisyonlar.length > 0 && (
              <div className="metric">
                <span className="label">Ort. Paket Adisyon:</span>
                <span className="value">₺{(calculations.paketSatis / paketAdisyonlar.length).toFixed(2)}</span>
              </div>
            )}
            {/* İptal metrikleri */}
            <div className="metric">
              <span className="label">İptal Adedi:</span>
              <span className="value">{canceledAdisyonlar.length}</span>
            </div>
            <div className="metric">
              <span className="label">İptal Tutarı:</span>
              <span className="value">₺{canceledAdisyonlar.reduce((t, a) => t + getAdisyonTutar(a), 0).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Gider Analizi */}
        <div className="analysis-card">
          <div className="analysis-header">
            <span className="material-icons">receipt</span>
            <h3>Gider Analizi</h3>
          </div>
          <div className="analysis-content">
            <div className="metric">
              <span className="label">Günlük Kasadan:</span>
              <span className="value">₺{calculations.gunlukKasaGider.toFixed(2)}</span>
            </div>
            <div className="metric">
              <span className="label">Merkez Kasadan:</span>
              <span className="value">₺{calculations.merkezKasaGider.toFixed(2)}</span>
            </div>
            <div className="metric">
              <span className="label">Toplam Gider Kalemi:</span>
              <span className="value">{giderKalemleriArray.length}</span>
            </div>
            <div className="metric">
              <span className="label">Toplam Gider Sayısı:</span>
              <span className="value">{data.giderler.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Expense lists removed intentionally per request */}

      {/* Rapor Tarihi */}
      <div className="report-footer">
        <p>
          <span className="material-icons">schedule</span>
          Rapor Tarihi: {new Date().toLocaleString('tr-TR')}
        </p>
      </div>
    </div>
  );
};

export default GenelRaporPage;
