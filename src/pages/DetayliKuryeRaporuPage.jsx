import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import PageHeader from '../components/PageHeader';
import { normalizeDateStr, toDate, formatDateTime, formatCurrency } from '../utils/dateUtils';
import './DetayliKuryeRaporuPage.css';

const DetayliKuryeRaporuPage = () => {
  const { currentUser } = useAuth();
  const [subeler, setSubeler] = useState([]);
  const [kuryeler, setKuryeler] = useState([]);
  const [selectedSube, setSelectedSube] = useState('');
  const [selectedKuryeId, setSelectedKuryeId] = useState('');
  const [reportMode, setReportMode] = useState('daily'); // 'daily' | 'range'
  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [rows, setRows] = useState([]);
  const [enrichedRows, setEnrichedRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Şubeler (şirket yöneticisi ise)
  useEffect(() => {
    const run = async () => {
      if (currentUser?.role === 'sirket_yoneticisi') {
        const snap = await getDocs(collection(db, 'subeler'));
        setSubeler(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    };
    run();
  }, [currentUser]);

  // Kuryeler (şube filtresine göre)
  useEffect(() => {
    const run = async () => {
      let qUsers;
      if (currentUser?.role === 'sirket_yoneticisi') {
        if (selectedSube) {
          qUsers = query(collection(db, 'users'), where('role', '==', 'kurye'), where('subeId', '==', selectedSube));
        } else {
          qUsers = query(collection(db, 'users'), where('role', '==', 'kurye'));
        }
      } else if (currentUser?.role === 'sube_yoneticisi') {
        qUsers = query(collection(db, 'users'), where('role', '==', 'kurye'), where('subeId', '==', currentUser.subeId));
      } else if (currentUser?.role === 'kurye') {
        // Sadece kendini göstermek yeterli
        qUsers = query(collection(db, 'users'), where('uid', '==', currentUser.uid));
      }
      if (!qUsers) return;
      const snap = await getDocs(qUsers);
      setKuryeler(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    run();
  }, [currentUser, selectedSube]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const activeSubeId = selectedSube || (currentUser?.role === 'sube_yoneticisi' ? currentUser.subeId : null);
      
      let startStr, endStr;
      if (reportMode === 'daily') {
        startStr = `${selectedDate} 00:00:00`;
        endStr = `${selectedDate} 23:59:59`;
      } else {
        startStr = `${startDate} 00:00:00`;
        endStr = `${endDate} 23:59:59`;
      }

      let q;
      const adisyonCollection = collection(db, 'Adisyonlar');
      
      if (activeSubeId) {
        q = query(
          adisyonCollection,
          where('rrc_restaurant_id', '==', activeSubeId),
          where('tarih', '>=', startStr),
          where('tarih', '<=', endStr)
        );
      } else {
        q = query(
          adisyonCollection,
          where('tarih', '>=', startStr),
          where('tarih', '<=', endStr)
        );
      }

      const adSnap = await getDocs(q);
      let items = adSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Kurye ismi belirle (adisyon.motorcu string alanı ile eşleşecek)
      let kuryeName = '';
      if (currentUser?.role === 'kurye') {
        kuryeName = currentUser.displayName || currentUser.email || '';
      } else if (selectedKuryeId) {
        const k = kuryeler.find(k => k.id === selectedKuryeId);
        kuryeName = k?.displayName || k?.email || '';
      }

      if (kuryeName) {
        const target = kuryeName.toLowerCase();
        items = items.filter(x => String(x.motorcu || '').toLowerCase() === target);
      }

      // Masa siparişleri (88) hariç filtrele (Client-side handles this since we already have the range)
      items = items.filter(x => x.siparisnerden !== 88);

      // Sıralama (tarih + adisyon numarası)
      items.sort((a, b) => {
        const tA = String(a.tarih || '');
        const tB = String(b.tarih || '');
        if (tA !== tB) return tA.localeCompare(tB);
        return (parseInt(a.padsgnum) || 0) - (parseInt(b.padsgnum) || 0);
      });

      setRows(items);

      // Enrichment: pickup/delivered timings and next pickup wait per courier
      // 1) Map base fields
      const base = items.map((x) => {
        const orderAt = toDate(x.tarih) || toDate(x.createdAt) || toDate(x.olusturmaTarihi);
        const pickupAt = toDate(x['pickup-time'] || x.pickup_time || x.pickupTime || x.alinmaTarihi || x.alimTarihi);
        const deliveredAt = toDate(x['delivered-date'] || x.delivered_date || x.deliveredDate || x.teslimTarihi || x.teslimatTarihi);
        let deliveryMinutes = null;
        if (pickupAt && deliveredAt) {
          deliveryMinutes = Math.max(0, Math.round((deliveredAt - pickupAt) / 60000));
        }
        let orderToDeliveryMinutes = null;
        if (orderAt && deliveredAt) {
          orderToDeliveryMinutes = Math.max(0, Math.round((deliveredAt - orderAt) / 60000));
        }
        return {
          ...x,
          __orderAt: orderAt,
          __pickupAt: pickupAt,
          __deliveredAt: deliveredAt,
          __deliveryMinutes: deliveryMinutes,
          __orderToDeliveryMinutes: orderToDeliveryMinutes,
          __nextPickupWaitMinutes: null,
        };
      });
      // 2) Group by courier name (motorcu) and compute next pickup wait
      const byCourier = base.reduce((acc, r) => {
        const key = (r.motorcu || '').toLowerCase();
        if (!acc[key]) acc[key] = [];
        acc[key].push(r);
        return acc;
      }, {});
      Object.values(byCourier).forEach((arr) => {
        // Sort by delivered time ascending to find next
        arr.sort((a, b) => {
          const da = a.__deliveredAt ? a.__deliveredAt.getTime() : 0;
          const db = b.__deliveredAt ? b.__deliveredAt.getTime() : 0;
          return da - db;
        });
        for (let i = 0; i < arr.length - 1; i++) {
          const cur = arr[i];
          const next = arr[i + 1];
          if (cur.__deliveredAt && next.__pickupAt) {
            cur.__nextPickupWaitMinutes = Math.max(0, Math.round((next.__pickupAt - cur.__deliveredAt) / 60000));
          }
        }
      });
      setEnrichedRows(base);
    } catch (e) {
      console.error(e);
      setError(e.message || 'Rapor verisi alınamadı');
    } finally {
      setLoading(false);
    }
  };

  const totals = useMemo(() => {
    const count = rows.length;
    const total = rows.reduce((s, x) => s + (Number(x.atop) || 0), 0);
    return { count, total, avg: count ? total / count : 0 };
  }, [rows]);

  return (
    <div className="detayli-kurye-raporu-container">
      <PageHeader
        icon="insights"
        title="Detaylı Kurye Raporu"
        description={
          currentUser?.role === 'kurye'
            ? 'Kendi teslimatlarınızın ayrıntılı listesi ve özetleri'
            : 'Kurye bazında detaylı teslimat raporunu görüntüleyin (masa siparişleri hariç)'
        }
      />

      <div className="filters-section white-card">
        {currentUser?.role === 'sirket_yoneticisi' && (
          <div className="filter-group">
            <label>Şube</label>
            <select value={selectedSube} onChange={(e) => setSelectedSube(e.target.value)}>
              <option value="">Tüm Şubeler</option>
              {subeler.map(s => (
                <option key={s.id} value={s.id}>{s.subeAdi || s.ad || s.name} (ID: {s.id})</option>
              ))}
            </select>
          </div>
        )}

        {currentUser?.role !== 'kurye' && (
          <div className="filter-group">
            <label>Kurye</label>
            <select value={selectedKuryeId} onChange={(e) => setSelectedKuryeId(e.target.value)}>
              <option value="">Tümü</option>
              {kuryeler.map(k => (
                <option key={k.id} value={k.id}>{k.displayName || k.email}</option>
              ))}
            </select>
          </div>
        )}

        <div className="filter-group">
          <label>Rapor Tipi</label>
          <div className="report-mode-buttons">
            <button className={`filter-btn ${reportMode === 'daily' ? 'active' : ''}`} onClick={() => setReportMode('daily')}>
              <span className="material-icons">today</span>
              Günlük
            </button>
            <button className={`filter-btn ${reportMode === 'range' ? 'active' : ''}`} onClick={() => setReportMode('range')}>
              <span className="material-icons">date_range</span>
              Tarih Aralığı
            </button>
          </div>
        </div>

        {reportMode === 'daily' ? (
          <div className="filter-group">
            <label>Tarih</label>
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
          </div>
        ) : (
          <div className="filter-group date-range-group">
            <div className="date-range-inputs">
              <div className="date-input-wrapper">
                <label>Başlangıç</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="date-input-wrapper">
                <label>Bitiş</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
          </div>
        )}

        <div className="filter-group">
          <label>&nbsp;</label>
          <button className="rapor-button" onClick={fetchData} disabled={loading}>
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

      {/* Özet kartları */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon primary"><span className="material-icons">delivery_dining</span></div>
          <div className="stat-info">
            <div className="stat-number">{totals.count}</div>
            <div className="stat-label">Toplam Teslimat</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon success"><span className="material-icons">payments</span></div>
          <div className="stat-info">
            <div className="stat-number">{formatCurrency(totals.total)}</div>
            <div className="stat-label">Toplam Tutar</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon warning"><span className="material-icons">trending_up</span></div>
          <div className="stat-info">
            <div className="stat-number">{formatCurrency(totals.avg)}</div>
            <div className="stat-label">Ortalama</div>
          </div>
        </div>
      </div>

      {/* Liste */}
      {rows.length === 0 ? (
        <div className="empty-state">
          <span className="material-icons">delivery_dining</span>
          <h3>Kayıt yok</h3>
          <p>Seçilen kriterlerde teslimat bulunamadı.</p>
        </div>
      ) : (
        <div className="list-container white-card">
          <div className="list-header">
            <h3>
              <span className="material-icons">list</span>
              Teslimat Listesi
            </h3>
          </div>
          <div className="mobile-cards">
            {enrichedRows.map((ad) => (
              <div key={ad.id} className="delivery-card">
                <div className="card-row between">
                  <div className="left">
                    <span className="material-icons">receipt</span>
                    <strong>{ad.padsgnum || ad.adisyoncode || ad.id}</strong>
                  </div>
                  <div className="right amount">{formatCurrency(ad.atop)}</div>
                </div>
                <div className="card-row">
                  <span className="label">Sipariş</span>
                  <span className="value">{formatDateTime(ad.__orderAt || ad.tarih)}</span>
                </div>
                <div className="card-row">
                  <span className="label">Alış (Pickup)</span>
                  <span className="value">{formatDateTime(ad.__pickupAt || ad['pickup-time'] || ad.pickup_time || ad.pickupTime)}</span>
                </div>
                <div className="card-row">
                  <span className="label">Teslim</span>
                  <span className="value">{formatDateTime(ad.__deliveredAt || ad['delivered-date'] || ad.delivered_date || ad.deliveredDate)}</span>
                </div>
                <div className="card-row">
                  <span className="label">Teslim Süresi</span>
                  <span className="value">{ad.__deliveryMinutes !== null ? `${ad.__deliveryMinutes} dk` : '-'}</span>
                </div>
                <div className="card-row">
                  <span className="label">Sipariş→Teslim</span>
                  <span className="value">{`${Number.isFinite(ad.__orderToDeliveryMinutes) ? ad.__orderToDeliveryMinutes : 0} dk`}</span>
                </div>
                <div className="card-row">
                  <span className="label">Sonraki Alışa Kadar</span>
                  <span className="value">{ad.__nextPickupWaitMinutes !== null ? `${ad.__nextPickupWaitMinutes} dk` : '—'}</span>
                </div>
                {ad.motorcu && (
                  <div className="card-row">
                    <span className="label">Kurye</span>
                    <span className="value">{ad.motorcu}</span>
                  </div>
                )}
                {ad.siparisnerden !== undefined && (
                  <div className="card-row">
                    <span className="label">Kaynak</span>
                    <span className="value">{ad.siparisnerden === 0 ? 'Telefon' : ad.siparisnerden === 1 ? 'Yemek Sepeti' : ad.siparisnerden === 2 ? 'Getir' : ad.siparisnerden === 5 ? 'Trendyol' : ad.siparisnerden === 8 ? 'Migros' : 'Diğer'}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DetayliKuryeRaporuPage;
