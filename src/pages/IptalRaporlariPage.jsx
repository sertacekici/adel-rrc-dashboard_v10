import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency, todayTR } from '../utils/dateUtils';
import './IptalRaporlariPage.css';

/**
 * Koleksiyon Yapısı (C# model → Firestore):
 * 
 * PAKET İPTALLERİ:
 *   padisyoniptaller     → PaketIptalAdisyonlar        (master - adisyoncode PK)
 *   psiparisiptaller     → PaketIptalAdisyonIcerikleri  (detay  - ordercode PK, adisyoncode FK)
 * 
 * SALON İPTALLERİ:
 *   tbl_saloniptaller    → MasaIptalAdsIcerik           (order_code PK, ads_code gruplaması)
 *   tbl_masaiptalads     → MasaIptalAdsIcerik           (ad_code PK - aynı koleksiyon)
 */

const chunkArray = (array, size) => {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

/** Firestore tarih alanını güvenli Date objesine çevirir */
const safeDate = (val) => {
  if (!val) return null;
  if (typeof val === 'object' && typeof val.toDate === 'function') return val.toDate();
  const s = String(val);
  const iso = s.includes('T') ? s : s.replace(' ', 'T');
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
};

/** Client-side tarih aralığı kontrolü */
const isInDateRange = (dateValue, startDate, endDate) => {
  const d = safeDate(dateValue);
  if (!d) return false;
  return d >= startDate && d <= endDate;
};

const IptalRaporlariPage = () => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [subeler, setSubeler] = useState([]);
  const [activeTab, setActiveTab] = useState('paket');

  // Data
  const [paketData, setPaketData] = useState(null);
  const [salonData, setSalonData] = useState(null);

  const today = new Date();
  const [filter, setFilter] = useState({
    mode: 'daily',
    date: todayTR(),
    startDate: todayTR(new Date(today.getTime() - 86400000)),
    endDate: todayTR(),
    subeId: currentUser?.role === 'sube_yoneticisi' ? (currentUser.rrc_restaurant_id || currentUser.subeId) : ''
  });

  // Şubeleri getir
  useEffect(() => {
    const fetchSubeler = async () => {
      if (currentUser?.role === 'sirket_yoneticisi') {
        const snapshot = await getDocs(query(collection(db, 'subeler')));
        const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        list.sort((a, b) => (a.ad || a.subeAdi || '').localeCompare(b.ad || b.subeAdi || ''));
        setSubeler(list);
      }
    };
    if (currentUser) fetchSubeler();
  }, [currentUser]);

  // Rapor getir
  const handleFetchReport = async () => {
    const rrcId = filter.subeId || currentUser?.rrc_restaurant_id || currentUser?.subeId;
    if (!rrcId) { setError('Lütfen bir şube seçin.'); return; }

    setLoading(true);
    setError(null);
    setPaketData(null);
    setSalonData(null);

    try {
      let startDate, endDate;
      if (filter.mode === 'daily') {
        startDate = new Date(filter.date + 'T00:00:00');
        endDate = new Date(filter.date + 'T23:59:59');
      } else {
        startDate = new Date(filter.startDate + 'T00:00:00');
        endDate = new Date(filter.endDate + 'T23:59:59');
      }

      const [paket, salon] = await Promise.all([
        fetchPaketIptalleri(rrcId, startDate, endDate),
        fetchSalonIptalleri(rrcId, startDate, endDate)
      ]);

      setPaketData(paket);
      setSalonData(salon);
    } catch (err) {
      setError('Veriler yüklenirken hata: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // İlk yüklemede otomatik rapor
  useEffect(() => {
    const rrcId = filter.subeId || currentUser?.rrc_restaurant_id || currentUser?.subeId;
    if (rrcId) handleFetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  // ─── PAKET İPTALLERİ ─────────────────────────
  // Koleksiyon: PaketIptalAdisyonlar (master) + PaketIptalAdisyonIcerikleri (detay)
  const fetchPaketIptalleri = async (rrcId, startDate, endDate) => {
    // 1. Master kayıtları çek (rrc_restaurant_id filtresi + client-side tarih)
    const masterQ = query(
      collection(db, 'PaketIptalAdisyonlar'),
      where('rrc_restaurant_id', '==', String(rrcId))
    );
    const masterSnap = await getDocs(masterQ);
    const allMasterDocs = masterSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(d => isInDateRange(d.iptaltarihi, startDate, endDate));

    if (allMasterDocs.length === 0) return { list: [], total: 0 };

    // Tekrar eden adisyon kodlarını filtrele
    const seenCodes = new Set();
    const masterDocs = allMasterDocs.filter(doc => {
      if (!doc.adisyoncode) return true;
      if (seenCodes.has(doc.adisyoncode)) return false;
      seenCodes.add(doc.adisyoncode);
      return true;
    });

    // 2. Detay kayıtlarını çek (PaketIptalAdisyonIcerikleri)
    const adisyonCodes = masterDocs.map(d => d.adisyoncode).filter(Boolean);
    let allItems = [];
    if (adisyonCodes.length > 0) {
      for (const chunk of chunkArray(adisyonCodes, 10)) {
        const itemsSnap = await getDocs(query(
          collection(db, 'PaketIptalAdisyonIcerikleri'),
          where('adisyoncode', 'in', chunk)
        ));
        allItems = [...allItems, ...itemsSnap.docs.map(d => d.data())];
      }
    }

    // 3. Birleştir
    const list = masterDocs.map(master => {
      const items = allItems.filter(item => item.adisyoncode === master.adisyoncode);
      const calculatedTotal = items.reduce((sum, item) => sum + (Number(item.fiyat || 0) * Number(item.miktar || 1)), 0);
      return {
        ...master,
        tarih: master.iptaltarihi || master.tarih,
        items,
        totalAmount: master.atop ? Number(master.atop) : calculatedTotal,
        padsgnum: master.padsgnum
      };
    });

    const total = list.reduce((sum, item) => sum + item.totalAmount, 0);
    return { list, total };
  };

  // ─── SALON İPTALLERİ ─────────────────────────
  // Koleksiyon: MasaIptalAdsIcerik (tbl_saloniptaller + tbl_masaiptalads aynı koleksiyon)
  // tbl_saloniptaller alanları: urun_adi, fiyati, miktar, tarih, masaadi, gadsno, iptalaciklama, ads_code, order_code
  const fetchSalonIptalleri = async (rrcId, startDate, endDate) => {
    const icerikQ = query(
      collection(db, 'MasaIptalAdsIcerik'),
      where('rrc_restaurant_id', '==', String(rrcId))
    );
    const icerikSnap = await getDocs(icerikQ);
    const allDocs = icerikSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(d => isInDateRange(d.tarih, startDate, endDate));

    if (allDocs.length === 0) return { list: [], total: 0 };

    // ads_code bazında grupla (aynı adisyondaki ürünleri bir araya topla)
    const groupedByAdsCode = {};
    allDocs.forEach(item => {
      const code = item.ads_code || 'unknown';
      if (!groupedByAdsCode[code]) groupedByAdsCode[code] = [];
      groupedByAdsCode[code].push(item);
    });

    // Her ads_code grubu bir iptal kartı
    const list = Object.entries(groupedByAdsCode)
      .filter(([code]) => code !== 'unknown')
      .map(([adsCode, items]) => {
        const firstItem = items[0] || {};
        const itemsTotal = items.reduce((sum, item) =>
          sum + (Number(item.fiyati || item.fiyat || 0) * Number(item.miktar || 1)), 0);

        return {
          ads_code: adsCode,
          tarih: firstItem.tarih,
          gadsno: firstItem.gadsno || '-',
          masaadi: firstItem.masaadi || 'Masa ?',
          iptalaciklama: firstItem.iptalaciklama || '-',
          rrc_restaurant_id: firstItem.rrc_restaurant_id,
          items,
          totalAmount: itemsTotal
        };
      });

    const total = list.reduce((sum, ad) => sum + ad.totalAmount, 0);
    return { list, total };
  };

  // ─── İSTATİSTİKLER ─────────────────────────
  const paketCount = paketData?.list?.length || 0;
  const paketTotal = paketData?.total || 0;
  const salonCount = salonData?.list?.length || 0;
  const salonTotal = salonData?.total || 0;
  const toplamCount = paketCount + salonCount;
  const toplamTutar = paketTotal + salonTotal;

  const activeList = activeTab === 'paket' ? (paketData?.list || []) : (salonData?.list || []);

  return (
    <div className="iptal-container">
      {/* HEADER */}
      <div className="iptal-header">
        <div className="iptal-header-content">
          <div className="iptal-header-left">
            <span className="material-icons iptal-header-icon">block</span>
            <div>
              <h1>İptal Raporları</h1>
              <p>Paket ve salon iptal işlemlerini detaylı görüntüleyin</p>
            </div>
          </div>
        </div>
      </div>

      {/* FİLTRELER */}
      <div className="iptal-filter-section">
        <div className="iptal-filter-row">
          {currentUser?.role === 'sirket_yoneticisi' && (
            <div className="iptal-filter-group">
              <label>Şube</label>
              <select
                value={filter.subeId}
                onChange={e => setFilter(f => ({ ...f, subeId: e.target.value }))}
              >
                <option value="">Şube Seçin</option>
                {subeler.map(s => (
                  <option key={s.id} value={s.rrc_restaurant_id || s.id}>
                    {s.ad || s.subeAdi || s.name || `Şube ${s.rrc_restaurant_id || s.id}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="iptal-filter-group">
            <label>Mod</label>
            <select
              value={filter.mode}
              onChange={e => setFilter(f => ({ ...f, mode: e.target.value }))}
            >
              <option value="daily">Günlük</option>
              <option value="range">Tarih Aralığı</option>
            </select>
          </div>

          {filter.mode === 'daily' ? (
            <div className="iptal-filter-group">
              <label>Tarih</label>
              <input
                type="date"
                value={filter.date}
                onChange={e => setFilter(f => ({ ...f, date: e.target.value }))}
              />
            </div>
          ) : (
            <>
              <div className="iptal-filter-group">
                <label>Başlangıç</label>
                <input
                  type="date"
                  value={filter.startDate}
                  onChange={e => setFilter(f => ({ ...f, startDate: e.target.value }))}
                />
              </div>
              <div className="iptal-filter-group">
                <label>Bitiş</label>
                <input
                  type="date"
                  value={filter.endDate}
                  onChange={e => setFilter(f => ({ ...f, endDate: e.target.value }))}
                />
              </div>
            </>
          )}

          <div className="iptal-filter-group iptal-filter-action">
            <button className="iptal-btn-fetch" onClick={handleFetchReport} disabled={loading}>
              <span className="material-icons">search</span>
              Rapor Getir
            </button>
          </div>
        </div>
      </div>

      {/* LOADING */}
      {loading && (
        <div className="iptal-loading">
          <div className="iptal-spinner"></div>
          <p>Veriler yükleniyor...</p>
        </div>
      )}

      {/* HATA */}
      {error && (
        <div className="iptal-error">
          <span className="material-icons">error_outline</span>
          <p>{error}</p>
        </div>
      )}

      {/* BOŞ DURUM */}
      {!loading && !paketData && !salonData && !error && (
        <div className="iptal-empty">
          <span className="material-icons">block</span>
          <p>İptal verilerini görüntülemek için şube ve tarih seçip "Rapor Getir" butonuna tıklayın.</p>
        </div>
      )}

      {/* VERİ VAR */}
      {!loading && (paketData || salonData) && (
        <>
          {/* İSTATİSTİK KARTLARI */}
          <div className="iptal-stats">
            <div className="iptal-stat-card">
              <div className="iptal-stat-icon isi-red">
                <span className="material-icons">cancel</span>
              </div>
              <div className="iptal-stat-body">
                <span className="iptal-stat-label">Toplam İptal</span>
                <span className="iptal-stat-value">{toplamCount}</span>
              </div>
            </div>
            <div className="iptal-stat-card">
              <div className="iptal-stat-icon isi-orange">
                <span className="material-icons">payments</span>
              </div>
              <div className="iptal-stat-body">
                <span className="iptal-stat-label">Toplam Tutar</span>
                <span className="iptal-stat-value">{formatCurrency(toplamTutar)}</span>
              </div>
            </div>
            <div className="iptal-stat-card">
              <div className="iptal-stat-icon isi-purple">
                <span className="material-icons">delivery_dining</span>
              </div>
              <div className="iptal-stat-body">
                <span className="iptal-stat-label">Paket İptal</span>
                <span className="iptal-stat-value">{paketCount} / {formatCurrency(paketTotal)}</span>
              </div>
            </div>
            <div className="iptal-stat-card">
              <div className="iptal-stat-icon isi-teal">
                <span className="material-icons">table_restaurant</span>
              </div>
              <div className="iptal-stat-body">
                <span className="iptal-stat-label">Salon İptal</span>
                <span className="iptal-stat-value">{salonCount} / {formatCurrency(salonTotal)}</span>
              </div>
            </div>
          </div>

          {/* TAB NAVİGASYON */}
          <div className="iptal-tab-nav">
            <button
              className={`iptal-tab-btn ${activeTab === 'paket' ? 'active' : ''}`}
              onClick={() => setActiveTab('paket')}
            >
              <span className="material-icons">delivery_dining</span>
              Paket İptalleri ({paketCount})
            </button>
            <button
              className={`iptal-tab-btn ${activeTab === 'salon' ? 'active' : ''}`}
              onClick={() => setActiveTab('salon')}
            >
              <span className="material-icons">table_restaurant</span>
              Salon İptalleri ({salonCount})
            </button>
          </div>

          {/* İPTAL LİSTESİ */}
          {activeList.length === 0 ? (
            <div className="iptal-empty">
              <span className="material-icons">check_circle</span>
              <p>Bu kategoride iptal kaydı bulunamadı.</p>
            </div>
          ) : (
            <div className="iptal-cards">
              {activeList.map((order, index) => (
                <div key={index} className="iptal-card">
                  <div className="iptal-card-header">
                    <div className="iptal-card-left">
                      <span className="iptal-time-badge">
                        {order.tarih ? new Date(order.tarih).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '-'}
                      </span>
                      <span className="iptal-card-code">
                        {activeTab === 'paket'
                          ? `Adisyon: ${order.padsgnum || '-'}`
                          : `Adisyon: ${order.gadsno || '-'} | ${order.masaadi || 'Masa ?'}`
                        }
                      </span>
                    </div>
                    <div className="iptal-card-right">
                      <span className="iptal-card-amount">{formatCurrency(order.totalAmount)}</span>
                    </div>
                  </div>

                  {/* ÜRÜNLER */}
                  {order.items && order.items.length > 0 && (
                    <div className="iptal-card-body">
                      <table className="iptal-items-table">
                        <thead>
                          <tr>
                            <th>Ürün</th>
                            <th>Adet</th>
                            <th>Birim Fiyat</th>
                            <th>Tutar</th>
                          </tr>
                        </thead>
                        <tbody>
                          {order.items.map((item, idx) => {
                            const adet = Number(item.miktar || item.adet || 0);
                            const fiyat = Number(item.fiyat || item.fiyati || 0);
                            return (
                              <tr key={idx}>
                                <td>{item.urunadi || item.urun_adi || '-'}</td>
                                <td>{adet}</td>
                                <td>{formatCurrency(fiyat)}</td>
                                <td>{formatCurrency(adet * fiyat)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* FOOTER */}
                  <div className="iptal-card-footer">
                    {activeTab === 'paket' && (
                      <>
                        <span><strong>İptal Nedeni:</strong> {order.iptalneden || '-'}</span>
                        <span><strong>Müşteri:</strong> {order.ads_siparisadres || order.kisikod || '-'}</span>
                      </>
                    )}
                    {activeTab === 'salon' && (
                      <span><strong>İptal Açıklama:</strong> {order.iptalaciklama || '-'}</span>
                    )}
                    <span><strong>Tarih:</strong> {order.tarih ? new Date(order.tarih).toLocaleString('tr-TR') : '-'}</span>
                  </div>
                </div>
              ))}

              {/* TOPLAM ÖZET */}
              <div className="iptal-summary">
                <div className="iptal-summary-row">
                  <h3>{activeTab === 'paket' ? 'Paket İptalleri Toplamı' : 'Salon İptalleri Toplamı'}</h3>
                  <span className="iptal-grand-total">
                    {formatCurrency(activeTab === 'paket' ? paketTotal : salonTotal)}
                  </span>
                </div>


              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default IptalRaporlariPage;
