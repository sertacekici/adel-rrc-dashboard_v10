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

  // Tarih aralığı varsayılanları: başlangıç = önceki ayın son günü, bitiş = sonraki ayın ilk günü
  const today = new Date();
  const prevMonthLastDay = new Date(today.getFullYear(), today.getMonth(), 0) // önceki ayın son günü
    .toISOString()
    .split('T')[0];
  const nextMonthFirstDay = new Date(today.getFullYear(), today.getMonth() + 1, 1) // sonraki ayın ilk günü
    .toISOString()
    .split('T')[0];

  // Filter state
  const [filter, setFilter] = useState({
    mode: 'range', // 'daily' | 'range'
    date: new Date().toISOString().split('T')[0],
    startDate: prevMonthLastDay,
    endDate: nextMonthFirstDay,
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
  }, [filter, currentUser]);

  const fetchReportData = async () => {
    setLoading(true);
    setError(null);
    try {
      const startDate = filter.mode === 'daily'
        ? new Date(filter.date + 'T00:00:00')
        : new Date(filter.startDate + 'T00:00:00');
      const endDate = filter.mode === 'daily'
        ? new Date(filter.date + 'T23:59:59')
        : new Date(filter.endDate + 'T23:59:59');

      // Gider kayıtlarını getir
      let giderQuery;
      if (filter.subeId) {
        giderQuery = query(
          collection(db, 'giderKayitlari'),
          where('subeId', '==', filter.subeId)
        );
      } else if (currentUser?.role === 'sube_yoneticisi') {
        giderQuery = query(
          collection(db, 'giderKayitlari'),
          where('subeId', '==', currentUser.subeId)
        );
      } else {
        giderQuery = query(collection(db, 'giderKayitlari'));
      }

      const giderSnapshot = await getDocs(giderQuery);
      let giderler = giderSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Client-side tarih filtresi
      giderler = giderler.filter(item => {
        const itemDate = item.tarih?.toDate();
        return itemDate && itemDate >= startDate && itemDate <= endDate;
      }).sort((a, b) => {
        const dateA = a.tarih?.toDate() || new Date(0);
        const dateB = b.tarih?.toDate() || new Date(0);
        return dateB - dateA;
      });

      // Adisyonları getir (rrc_restaurant_id alanını da destekle)
      let adisyonlar = [];
      if (filter.subeId) {
        // Önce rrc_restaurant_id ile dene (AdisyonlarPage ile uyumlu)
        try {
          const qRrc = query(
            collection(db, 'Adisyonlar'),
            where('rrc_restaurant_id', '==', filter.subeId)
          );
          const snapRrc = await getDocs(qRrc);
          adisyonlar = snapRrc.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) {
          console.warn('rrc_restaurant_id sorgusu hata verdi, subeId ile denenecek:', e);
        }
        // Eğer sonuç yoksa veya hata olduysa subeId ile fallback
        if (adisyonlar.length === 0) {
          try {
            const qSube = query(
              collection(db, 'Adisyonlar'),
              where('subeId', '==', filter.subeId)
            );
            const snapSube = await getDocs(qSube);
            adisyonlar = snapSube.docs.map(d => ({ id: d.id, ...d.data() }));
          } catch (e2) {
            console.warn('subeId sorgusu da başarısız:', e2);
          }
        }
      } else if (currentUser?.role === 'sube_yoneticisi') {
        // Şube yöneticisinin gördüğü adisyonlar: kullanıcı kaydındaki subeId hem rrc_restaurant_id hem subeId için denenir
        try {
          const qRrcUser = query(
            collection(db, 'Adisyonlar'),
            where('rrc_restaurant_id', '==', currentUser.subeId)
          );
          const snapUserRrc = await getDocs(qRrcUser);
          adisyonlar = snapUserRrc.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) {
          console.warn('Kullanıcı rrc_restaurant_id sorgusu hata:', e);
        }
        if (adisyonlar.length === 0) {
          try {
            const qUserSube = query(
              collection(db, 'Adisyonlar'),
              where('subeId', '==', currentUser.subeId)
            );
            const snapUserSube = await getDocs(qUserSube);
            adisyonlar = snapUserSube.docs.map(d => ({ id: d.id, ...d.data() }));
          } catch (e2) {
            console.warn('Kullanıcı subeId sorgusu hata:', e2);
          }
        }
      } else {
        // Tüm şubeler
        const allSnap = await getDocs(collection(db, 'Adisyonlar'));
        adisyonlar = allSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      }

      // Client-side tarih filtresi (olusturmaTarihi Timestamp yoksa 'tarih' string alanını kullan)
      adisyonlar = adisyonlar.filter(item => {
        let itemDate = item.olusturmaTarihi?.toDate();
        if (!itemDate && item.tarih) {
          try {
            const t = String(item.tarih);
            let dateStr;
            if (t.includes('T')) {
              dateStr = t; // ISO
            } else if (t.includes(' ')) {
              dateStr = t.replace(' ', 'T');
            } else {
              dateStr = t + 'T00:00:00';
            }
            const parsed = new Date(dateStr);
            if (!isNaN(parsed.getTime())) itemDate = parsed;
          } catch (e) {
            // ignore parse errors
          }
        }
        return itemDate && itemDate >= startDate && itemDate <= endDate;
      }).sort((a, b) => {
        const dateA = a.olusturmaTarihi?.toDate() || (() => {
          if (a.tarih) {
            const t = String(a.tarih);
            return new Date(t.includes('T') ? t : t.includes(' ') ? t.replace(' ', 'T') : t + 'T00:00:00');
          }
          return new Date(0);
        })();
        const dateB = b.olusturmaTarihi?.toDate() || (() => {
          if (b.tarih) {
            const t = String(b.tarih);
            return new Date(t.includes('T') ? t : t.includes(' ') ? t.replace(' ', 'T') : t + 'T00:00:00');
          }
          return new Date(0);
        })();
        return dateB - dateA;
      });

      // Kurye atama kayıtlarını getir
      let kuryeQuery;
      if (filter.subeId) {
        kuryeQuery = query(
          collection(db, 'kuryeatama'),
          where('subeId', '==', filter.subeId)
        );
      } else if (currentUser?.role === 'sube_yoneticisi') {
        kuryeQuery = query(
          collection(db, 'kuryeatama'),
          where('subeId', '==', currentUser.subeId)
        );
      } else {
        kuryeQuery = query(collection(db, 'kuryeatama'));
      }

      const kuryeSnapshot = await getDocs(kuryeQuery);
      let kuryeRaporlari = kuryeSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Client-side tarih filtresi
      kuryeRaporlari = kuryeRaporlari.filter(item => {
        const itemDate = item.atamaTarihi?.toDate();
        return itemDate && itemDate >= startDate && itemDate <= endDate;
      }).sort((a, b) => {
        const dateA = a.atamaTarihi?.toDate() || new Date(0);
        const dateB = b.atamaTarihi?.toDate() || new Date(0);
        return dateB - dateA;
      });

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

  // Hesaplamalar
  const nonCanceledAdisyonlar = data.adisyonlar.filter(a => !isCanceled(a));
  const canceledAdisyonlar = data.adisyonlar.filter(a => isCanceled(a));

  const calculations = {
    // Toplam Gider
    toplamGider: data.giderler.reduce((total, item) => total + item.tutar, 0),
    
    // Ödeme Kaynağına Göre Giderler
    gunlukKasaGider: data.giderler
      .filter(item => item.odemeKaynagi === 'gunluk_kasa')
      .reduce((total, item) => total + item.tutar, 0),
    merkezKasaGider: data.giderler
      .filter(item => item.odemeKaynagi === 'merkez_kasa')
      .reduce((total, item) => total + item.tutar, 0),
    
  // Toplam Satış (iptaller hariç, atop alanı öncelikli; yoksa fallback toplamTutar)
  toplamSatis: nonCanceledAdisyonlar.reduce((total, item) => total + (Number(item.atop) || Number(item.toplamTutar) || 0), 0),
    
    // Ödeme Tipine Göre Satışlar
    nakit: nonCanceledAdisyonlar
      .filter(item => (item.odemeTipi === 'Nakit' || item.odemeTipi === 1))
      .reduce((total, item) => total + (Number(item.atop) || Number(item.toplamTutar) || 0), 0),
    kartKredi: nonCanceledAdisyonlar
      .filter(item => (item.odemeTipi === 'Kart/Kredi' || item.odemeTipi === 2))
      .reduce((total, item) => total + (Number(item.atop) || Number(item.toplamTutar) || 0), 0),
    
    // Kurye İstatistikleri
    toplamTeslimat: data.kuryeRaporlari.length,
    tamamlananTeslimat: data.kuryeRaporlari.filter(item => item.durum === 'tamamlandi').length,
    bekleyenTeslimat: data.kuryeRaporlari.filter(item => item.durum === 'beklemede').length,
    
    // Net Kar (Satış - Gider)
    get netKar() {
      return this.toplamSatis - calculations.toplamGider;
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

  const odemeTipiToplamlariObj = nonCanceledAdisyonlar.reduce((acc, item) => {
    const raw = item.odemetipi !== undefined ? item.odemetipi : item.odemeTipi; // tercih 'odemetipi'
    const key = normalizeOdemeTipi(raw);
    const tutar = Number(item.atop) || Number(item.toplamTutar) || 0;
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
            <div className="filter-group">
              <label htmlFor="date">Tarih:</label>
              <input
                id="date"
                type="date"
                value={filter.date}
                onChange={(e) => setFilter({ ...filter, date: e.target.value })}
              />
            </div>
          ) : (
            <>
              <div className="filter-group">
                <label htmlFor="start-date">Başlangıç Tarihi:</label>
                <input
                  id="start-date"
                  type="date"
                  value={filter.startDate}
                  onChange={(e) => setFilter({ ...filter, startDate: e.target.value })}
                />
              </div>
              <div className="filter-group">
                <label htmlFor="end-date">Bitiş Tarihi:</label>
                <input
                  id="end-date"
                  type="date"
                  value={filter.endDate}
                  onChange={(e) => setFilter({ ...filter, endDate: e.target.value })}
                />
              </div>
            </>
          )}

          {currentUser?.role === 'sirket_yoneticisi' && (
            <div className="filter-group">
              <label htmlFor="sube-select">Şube:</label>
              <select
                id="sube-select"
                value={filter.subeId}
                onChange={(e) => setFilter({ ...filter, subeId: e.target.value })}
              >
                <option value="">Tüm Şubeler</option>
                {subeler.map(sube => (
                  <option key={sube.id} value={sube.id}>{sube.ad || sube.subeAdi}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="error-message">
          <span className="material-icons">error</span>
          {error}
        </div>
      )}

      {/* Özet Kartları */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon success">
            <span className="material-icons">trending_up</span>
          </div>
          <div className="stat-info">
            <div className="stat-number">₺{calculations.toplamSatis.toFixed(2)}</div>
            <div className="stat-label">Toplam Satış</div>
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
                <span className="label">Toplam Adisyon:</span>
                <span className="value">{nonCanceledAdisyonlar.length}</span>
              </div>
            )}
            {nonCanceledAdisyonlar.length > 0 && (
              <div className="metric">
                <span className="label">Ortalama Adisyon:</span>
                <span className="value">₺{(calculations.toplamSatis / nonCanceledAdisyonlar.length).toFixed(2)}</span>
              </div>
            )}
            {/* İptal metrikleri */}
            <div className="metric">
              <span className="label">İptal Adedi:</span>
              <span className="value">{canceledAdisyonlar.length}</span>
            </div>
            <div className="metric">
              <span className="label">İptal Tutarı:</span>
              <span className="value">₺{canceledAdisyonlar.reduce((t, a) => t + (Number(a.atop) || Number(a.toplamTutar) || 0), 0).toFixed(2)}</span>
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

      {/* Gider Kalemleri Detayı */}
      {giderKalemleriArray.length > 0 ? (
        <div className="detail-section">
          <h3>
            <span className="material-icons">category</span>
            Gider Kalemleri Detayı
          </h3>
          <div className="detail-table">
            <div className="table-header">
              <div className="header-cell">Gider Kalemi</div>
              <div className="header-cell">Toplam Tutar</div>
              <div className="header-cell">İşlem Sayısı</div>
              <div className="header-cell">Ortalama</div>
            </div>
            {giderKalemleriArray.map((item, index) => (
              <div key={index} className="table-row">
                <div className="table-cell">
                  <strong>{item.ad}</strong>
                </div>
                <div className="table-cell amount">
                  ₺{item.tutar.toFixed(2)}
                </div>
                <div className="table-cell">
                  {item.adet}
                </div>
                <div className="table-cell amount">
                  ₺{(item.tutar / item.adet).toFixed(2)}
                </div>
              </div>
            ))}
          </div>

          {/* Ayrıntılı gider kayıtları tablosu */}
          <h3 style={{ marginTop: '32px' }}>
            <span className="material-icons">list</span>
            Gider Kayıtları
          </h3>
          <div className="detail-table">
            <div className="table-header">
              <div className="header-cell">Tarih</div>
              <div className="header-cell">Gider Kalemi</div>
              <div className="header-cell">Tutar</div>
              <div className="header-cell">Ödeme Kaynağı</div>
              <div className="header-cell">Açıklama</div>
            </div>
            {data.giderler.length === 0 && (
              <div className="table-row">
                <div className="table-cell" colSpan={5}>Kayıt yok</div>
              </div>
            )}
            {data.giderler.map((g) => {
              const tarih = g.tarih?.toDate ? g.tarih.toDate() : null;
              return (
                <div key={g.id} className="table-row">
                  <div className="table-cell">
                    {tarih ? tarih.toLocaleDateString('tr-TR') + ' ' + tarih.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '-'}
                  </div>
                  <div className="table-cell">{g.giderKalemiAdi || '-'}</div>
                  <div className="table-cell amount">₺{Number(g.tutar || 0).toFixed(2)}</div>
                  <div className="table-cell">{g.odemeKaynagi === 'gunluk_kasa' ? 'Günlük Kasa' : g.odemeKaynagi === 'merkez_kasa' ? 'Merkez Kasa' : (g.odemeKaynagi || '-')}</div>
                  <div className="table-cell">{g.aciklama || '-'}</div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="empty-state">
          <span className="material-icons">category</span>
          <h3>Gider Kaydı Bulunamadı</h3>
          <p>Seçilen tarih aralığında gider kaydı bulunmuyor.</p>
        </div>
      )}

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
