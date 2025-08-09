import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import './IptalRaporlariPage.css';

// İptal Raporları Sayfası
const IptalRaporlariPage = () => {
  const { currentUser } = useAuth();
  const [iptaller, setIptaller] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [subeler, setSubeler] = useState([]);
  const [selectedSube, setSelectedSube] = useState('');
  const [mode, setMode] = useState('daily'); // daily | range
  const todayStr = new Date().toISOString().split('T')[0];
  // Varsayılanlar: önceki ayın son günü -> sonraki ayın ilk günü
  const refToday = new Date();
  const defaultStart = new Date(refToday.getFullYear(), refToday.getMonth(), 0).toISOString().split('T')[0];
  const defaultEnd = new Date(refToday.getFullYear(), refToday.getMonth() + 1, 1).toISOString().split('T')[0];
  const [date, setDate] = useState(todayStr);
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);

  // Şubeler (şirket yöneticisi tümünü, diğerleri kendi şubesini)
  useEffect(() => {
    if (!currentUser) return;
    import('firebase/firestore').then(async () => {
      try {
        if (currentUser.role === 'sirket_yoneticisi') {
          const subeSnapUnsub = onSnapshot(collection(db, 'subeler'), snap => {
            const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setSubeler(arr);
          });
          return () => subeSnapUnsub();
        } else if (currentUser.subeId) {
          setSelectedSube(currentUser.subeId);
        }
      } catch (e) {
        console.error(e);
      }
    });
  }, [currentUser]);

  // İptal verilerini getir
  useEffect(() => {
    if (!currentUser) return;
    setLoading(true);
    setError(null);

    let qRef = collection(db, 'Iptaller');
    // Şube filtresi (rrc_restaurant_id veya subeId desteği olabilir; burada ikisini de serialize edeceğiz client-side)
    const unsub = onSnapshot(qRef, snap => {
      const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setIptaller(arr);
      setLoading(false);
    }, err => {
      setError('İptal kayıtları alınamadı: ' + err.message);
      setLoading(false);
    });

    return () => unsub();
  }, [currentUser]);

  // Filtreleme
  useEffect(() => {
    let list = iptaller;

    // Şube filtreleme - koleksiyonda hangi alan var bilinmiyorsa olası alanları dene
    if (selectedSube) {
      list = list.filter(i => i.rrc_restaurant_id === selectedSube || i.subeId === selectedSube || i.sube_id === selectedSube);
    } else if (currentUser?.role === 'sube_yoneticisi') {
      list = list.filter(i => i.rrc_restaurant_id === currentUser.subeId || i.subeId === currentUser.subeId || i.sube_id === currentUser.subeId);
    }

    // Tarih parse & filtre
    const toDateOnly = (raw) => {
      if (!raw) return null;
      try {
        let s = String(raw);
        if (s.includes('T')) s = s.split('T')[0];
        else if (s.includes(' ')) s = s.split(' ')[0];
        return s; // YYYY-MM-DD
      } catch {
        return null;
      }
    };

    if (mode === 'daily') {
      list = list.filter(i => toDateOnly(i.tarih) === date);
    } else {
      list = list.filter(i => {
        const d = toDateOnly(i.tarih);
        if (!d) return false;
        return d >= startDate && d <= endDate;
      });
    }

    // Sıralama (tarih eski -> yeni)
    list.sort((a, b) => {
      const aD = toDateOnly(a.tarih) || '';
      const bD = toDateOnly(b.tarih) || '';
      if (aD < bD) return -1;
      if (aD > bD) return 1;
      return 0;
    });

    setFiltered(list);
  }, [iptaller, selectedSube, mode, date, startDate, endDate, currentUser]);

  const toplamTutar = filtered.reduce((sum, r) => sum + (Number(r.fiyati) || 0) * (Number(r.miktar) || 1), 0);
  const toplamAdet = filtered.reduce((sum, r) => sum + (Number(r.miktar) || 0), 0);

  return (
    <div className="iptal-raporlari-container">
      <div className="page-header">
        <div className="header-content">
          <div className="title-section">
            <h1>
              <span className="material-icons">block</span>
              İptal Raporları
            </h1>
            <p>İptal edilen ürün kayıtlarını tarih veya aralık bazında inceleyin</p>
          </div>
        </div>
      </div>

      {/* Filtreler */}
      <div className="filters-section">
        <div className="filter-group">
          <label>Rapor Tipi:</label>
          <div className="report-mode-buttons">
            <button className={`filter-btn ${mode === 'daily' ? 'active' : ''}`} onClick={() => setMode('daily')}>
              <span className="material-icons">today</span>
              Günlük
            </button>
            <button className={`filter-btn ${mode === 'range' ? 'active' : ''}`} onClick={() => setMode('range')}>
              <span className="material-icons">date_range</span>
              Tarih Aralığı
            </button>
          </div>
        </div>

        {mode === 'daily' ? (
          <div className="filter-group">
            <label>Tarih:</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        ) : (
          <div className="filter-group date-range-group">
            <div className="date-range-inputs">
              <div className="date-input-wrapper">
                <label>Başlangıç:</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="date-input-wrapper">
                <label>Bitiş:</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {currentUser?.role === 'sirket_yoneticisi' && (
          <div className="filter-group">
            <label>Şube:</label>
            <select value={selectedSube} onChange={(e) => setSelectedSube(e.target.value)}>
              <option value="">Tümü</option>
              {subeler.map(s => (
                <option key={s.id} value={s.rrc_restaurant_id || s.id}>{s.subeAdi || s.ad || s.id}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {error && (
        <div className="error-message">
          <span className="material-icons">error</span>
          {error}
        </div>
      )}

      {loading && (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>İptaller yükleniyor...</p>
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="empty-state">
          <span className="material-icons">block</span>
          <h3>Kayıt Bulunamadı</h3>
          <p>Seçilen kriterlere göre iptal kaydı yok.</p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon danger">
                <span className="material-icons">block</span>
              </div>
              <div className="stat-info">
                <div className="stat-number">{toplamAdet}</div>
                <div className="stat-label">İptal Adedi</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon warning">
                <span className="material-icons">payments</span>
              </div>
              <div className="stat-info">
                <div className="stat-number">₺{toplamTutar.toFixed(2)}</div>
                <div className="stat-label">Toplam Tutar</div>
              </div>
            </div>
          </div>

          <div className="detail-table" style={{ marginTop: '24px' }}>
            <div className="table-header">
              <div className="header-cell">Tarih</div>
              <div className="header-cell">Masa / Tip</div>
              <div className="header-cell">Ürün</div>
              <div className="header-cell">Miktar</div>
              <div className="header-cell">Birim Fiyat</div>
              <div className="header-cell">Tutar</div>
              <div className="header-cell">Açıklama</div>
            </div>
            {filtered.map(rec => {
              const dateStr = (() => {
                if (!rec.tarih) return '-';
                try {
                  let s = String(rec.tarih);
                  if (s.includes('T')) return new Date(s).toLocaleString('tr-TR');
                  if (s.includes(' ')) return new Date(s.replace(' ', 'T')).toLocaleString('tr-TR');
                  return new Date(s + 'T00:00:00').toLocaleDateString('tr-TR');
                } catch { return rec.tarih; }
              })();
              const miktar = Number(rec.miktar) || 0;
              const birim = Number(rec.fiyati) || 0;
              const tutar = miktar * birim;
              return (
                <div key={rec.id} className="table-row">
                  <div className="table-cell">{dateStr}</div>
                  <div className="table-cell">{rec.istakeaway === 1 ? 'Paket' : 'Masa'} {rec.masaadi ? `(${rec.masaadi})` : ''}</div>
                  <div className="table-cell">{rec.urun_adi}</div>
                  <div className="table-cell">{miktar}</div>
                  <div className="table-cell amount">₺{birim.toFixed(2)}</div>
                  <div className="table-cell amount">₺{tutar.toFixed(2)}</div>
                  <div className="table-cell">{rec.iptalaciklama || '-'}</div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default IptalRaporlariPage;
