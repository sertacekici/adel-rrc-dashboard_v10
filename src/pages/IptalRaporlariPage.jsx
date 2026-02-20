import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, onSnapshot, documentId, limit, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import './IptalRaporlariPage.css';

// Yardımcı fonksiyon: Array'i chunk'lara bölme (Firestore 'in' sorgusu limiti 10 olduğu için)
const chunkArray = (array, size) => {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

const IptalRaporlariPage = () => {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('paket'); // 'paket' | 'salon'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Debug
  const [showDebug, setShowDebug] = useState(false);
  const [debugInfo, setDebugInfo] = useState({});

  // Data states
  const [paketData, setPaketData] = useState([]);
  const [salonData, setSalonData] = useState([]);

  // Totals
  const [paketTotal, setPaketTotal] = useState(0);
  const [salonTotal, setSalonTotal] = useState(0);
  const [salonPaymentSummary, setSalonPaymentSummary] = useState({});

  // Filters
  const [subeler, setSubeler] = useState([]);
  const [selectedSube, setSelectedSube] = useState('');
  const [mode, setMode] = useState('daily');
  const todayStr = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(todayStr);
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);

  // Şubeleri Getir
  useEffect(() => {
    if (!currentUser) return;
    
    // Eğer şube yöneticisiyse direkt kendi şubesini seç
    if (currentUser.role === 'sube_yoneticisi' && currentUser.subeId) {
      setSelectedSube(currentUser.subeId);
    }

    if (currentUser.role === 'sirket_yoneticisi') {
      const unsub = onSnapshot(collection(db, 'subeler'), snap => {
        setSubeler(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
      return () => unsub();
    }
  }, [currentUser]);

  // Verileri Getir
  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, date, startDate, endDate, mode, selectedSube]);

  const fetchData = async () => {
    if (!currentUser) return;
    setLoading(true);
    setError(null);
    setPaketData([]);
    setSalonData([]);
    setPaketTotal(0);
    setSalonTotal(0);
    setSalonPaymentSummary({});

    try {
      let startStr, endStr;
      let startStrIso, endStrIso;

      if (mode === 'daily') {
        startStr = `${date} 00:00:00`;
        endStr = `${date} 23:59:59`;
        startStrIso = `${date}T00:00:00`;
        endStrIso = `${date}T23:59:59`;
      } else {
        startStr = `${startDate} 00:00:00`;
        endStr = `${endDate} 23:59:59`;
        startStrIso = `${startDate}T00:00:00`;
        endStrIso = `${endDate}T23:59:59`;
      }

      const activeSubeId = selectedSube || (currentUser.role === 'sube_yoneticisi' ? currentUser.subeId : null);

      setDebugInfo(prev => ({
        ...prev,
        queryParams: { activeTab, mode, startStrIso, endStrIso, activeSubeId, userRole: currentUser.role, userSubeId: currentUser.subeId }
      }));

      // --- TANI SORGUSU: Tarih filtresi OLMADAN son 5 kayıt çek ---
      try {
        const diagCollection = activeTab === 'paket' ? 'padisyoniptaller' : 'tblmasaiptalads';
        const diagDateField = activeTab === 'paket' ? 'iptaltarihi' : 'tarih';
        
        // Filtre olmadan son 5 kayıt
        const diagQ = query(collection(db, diagCollection), orderBy(diagDateField, 'desc'), limit(5));
        const diagSnap = await getDocs(diagQ);
        const diagDocs = diagSnap.docs.map(d => ({ _id: d.id, ...d.data() }));
        
        // Şube filtreli ama tarihsiz 5 kayıt
        let diagFilteredDocs = [];
        if (activeSubeId && activeSubeId !== 'all') {
          const diagQ2 = query(collection(db, diagCollection), where('rrc_restaurant_id', '==', activeSubeId), limit(5));
          const diagSnap2 = await getDocs(diagQ2);
          diagFilteredDocs = diagSnap2.docs.map(d => ({ _id: d.id, ...d.data() }));
        }

        setDebugInfo(prev => ({
          ...prev,
          diag_collection: diagCollection,
          diag_dateField: diagDateField,
          diag_noFilterCount: diagDocs.length,
          diag_noFilterSample: diagDocs.map(d => ({
            _id: d._id,
            [diagDateField]: d[diagDateField],
            tarih: d.tarih,
            iptaltarihi: d.iptaltarihi,
            rrc_restaurant_id: d.rrc_restaurant_id,
            typeOfDate: typeof d[diagDateField],
            allKeys: Object.keys(d).sort().join(', ')
          })),
          diag_withSubeCount: diagFilteredDocs.length,
          diag_withSubeSample: diagFilteredDocs.map(d => ({
            _id: d._id,
            [diagDateField]: d[diagDateField],
            rrc_restaurant_id: d.rrc_restaurant_id
          }))
        }));
      } catch (diagErr) {
        setDebugInfo(prev => ({ ...prev, diag_error: diagErr.message }));
      }

      // --- TÜM MasaIptalAdsIcerik kayıtlarını filtresiz çek ---
      try {
        const allIcerikSnap = await getDocs(collection(db, 'MasaIptalAdsIcerik'));
        const allIcerikDocs = allIcerikSnap.docs.map(d => ({ _id: d.id, ...d.data() }));
        setDebugInfo(prev => ({
          ...prev,
          icerik_totalCount: allIcerikDocs.length,
          icerik_allDocs: allIcerikDocs
        }));
      } catch (icerikErr) {
        setDebugInfo(prev => ({ ...prev, icerik_error: icerikErr.message }));
      }

      if (activeTab === 'paket') {
        await fetchPaketIptalleri(startStrIso, endStrIso, activeSubeId);
      } else {
        await fetchSalonIptalleri(startStrIso, endStrIso, activeSubeId);
      }

    } catch (err) {
      console.error("Veri çekme hatası:", err);
      setError("Veriler yüklenirken bir hata oluştu: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchPaketIptalleri = async (startStrRaw, endStrRaw, subeId) => {
    // Tarih formatını (varsa) düzelt: 2026-01-22 00:00:00 -> 2026-01-22T00:00:00
    const startStr = startStrRaw.replace(' ', 'T');
    const endStr = endStrRaw.replace(' ', 'T');

      // 1. Master Tabloyu Çek (padisyoniptaller)
      // Bu sorgu ("iptaltarihi" aralığı ve "rrc_restaurant_id" eşitliği) composite index gerektirir.
    
    let q = query(
      collection(db, 'padisyoniptaller'),
      where('iptaltarihi', '>=', startStr),
      where('iptaltarihi', '<=', endStr)
    );

    if (subeId && subeId !== 'all') {
      q = query(q, where('rrc_restaurant_id', '==', subeId));
    }

    const masterSnap = await getDocs(q);
    const masterDocsRaw = masterSnap.docs.map(d => ({ _docId: d.id, ...d.data() }));

    setDebugInfo(prev => ({
      ...prev,
      paket_masterRawCount: masterDocsRaw.length,
      paket_masterRawSample: masterDocsRaw.slice(0, 5),
      paket_masterRawTarihler: masterDocsRaw.slice(0, 10).map(d => ({ docId: d._docId, iptaltarihi: d.iptaltarihi, tarih: d.tarih, rrc_restaurant_id: d.rrc_restaurant_id, adisyoncode: d.adisyoncode }))
    }));
    
    if (masterDocsRaw.length === 0) {
      setPaketData([]);
      return;
    }

    const seenAdisyonCodes = new Set();
    const masterDocs = masterDocsRaw.filter(doc => {
      if (!doc.adisyoncode) return true;
      if (seenAdisyonCodes.has(doc.adisyoncode)) return false;
      seenAdisyonCodes.add(doc.adisyoncode);
      return true;
    });

    setDebugInfo(prev => ({
      ...prev,
      paket_afterDedup: masterDocs.length,
      paket_removedByDedup: masterDocsRaw.length - masterDocs.length
    }));

    const adisyonCodes = masterDocs.map(d => d.adisyoncode).filter(c => c);
    
    // 2. Detayları Çek (psiparisiptaller)
    // Firestore 'in' sorgusu max 10 eleman alır. Chunk'lara bölüyoruz.
    const codeChunks = chunkArray(adisyonCodes, 10);
    let allItems = [];

    for (const chunk of codeChunks) {
      const itemsQ = query(
        collection(db, 'psiparisiptaller'),
        where('adisyoncode', 'in', chunk)
      );
      const itemsSnap = await getDocs(itemsQ);
      allItems = [...allItems, ...itemsSnap.docs.map(d => d.data())];
    }
    
    setDebugInfo(prev => ({
      ...prev,
      paket_detayCount: allItems.length,
      paket_detaySample: allItems.slice(0, 5)
    }));

    // 3. Veriyi Birleştir
    const combinedData = masterDocs.map(master => {
      // items filtresi
      const items = allItems.filter(item => item.adisyoncode === master.adisyoncode);
      
      // Toplam tutarı itemlar üzerinden hesaplayalım (Fallback)
      // psiparisiptaller: fiyat, miktar
      const calculatedTotal = items.reduce((sum, item) => sum + (Number(item.fiyat || 0) * Number(item.miktar || 1)), 0);
      
      // UI için 'tarih' alanını iptaltarihi ile doldur
      // Master kayıtta 'atop' varsa onu kullan, yoksa hesaplananı kullan
      return {
        ...master,
        tarih: master.iptaltarihi || master.tarih, // iptaltarihi yoksa tarih'e bak
        items: items,
        totalAmount: master.atop ? Number(master.atop) : calculatedTotal,
        padsgnum: master.padsgnum // Adisyon numarasını açıkça maple
      };
    });

    // Toplam hesapla
    const grandTotal = combinedData.reduce((sum, item) => sum + item.totalAmount, 0);
    
    setPaketTotal(grandTotal);
    setPaketData(combinedData);
  };

  const fetchSalonIptalleri = async (startStr, endStr, subeId) => {
    // 1. Doğrudan MasaIptalAdsIcerik'ten tarih aralığına göre çek
    let icerikQ = query(
      collection(db, 'MasaIptalAdsIcerik'),
      where('tarih', '>=', startStr),
      where('tarih', '<=', endStr)
    );

    if (subeId) {
      icerikQ = query(icerikQ, where('rrc_restaurant_id', '==', subeId));
    }

    const icerikSnap = await getDocs(icerikQ);
    const allItems = icerikSnap.docs.map(d => d.data());

    setDebugInfo(prev => ({
      ...prev,
      salon_icerikDirectCount: allItems.length,
      salon_icerikDirectSample: allItems.slice(0, 5)
    }));

    if (allItems.length === 0) {
      // Fallback: master tablodan dene (eski yöntem)
      let q = query(
        collection(db, 'tblmasaiptalads'),
        where('tarih', '>=', startStr),
        where('tarih', '<=', endStr)
      );
      if (subeId) {
        q = query(q, where('rrc_restaurant_id', '==', subeId));
      }
      const masterSnap = await getDocs(q);

      setDebugInfo(prev => ({
        ...prev,
        salon_masterRawCount: masterSnap.docs.length,
        salon_fallbackUsed: true
      }));

      if (masterSnap.docs.length === 0) {
        setSalonData([]);
        return;
      }
    }

    // 2. ads_code bazında grupla
    const groupedByAdsCode = {};
    allItems.forEach(item => {
      const code = item.ads_code || 'unknown';
      if (!groupedByAdsCode[code]) {
        groupedByAdsCode[code] = [];
      }
      groupedByAdsCode[code].push(item);
    });

    const adsCodes = Object.keys(groupedByAdsCode).filter(c => c !== 'unknown');

    // 3. Master bilgileri çek (tblmasaiptalads) — ads_code'lar üzerinden ad_code eşleştir
    let masterMap = {};
    if (adsCodes.length > 0) {
      const codeChunks = chunkArray(adsCodes, 10);
      for (const chunk of codeChunks) {
        const masterQ = query(
          collection(db, 'tblmasaiptalads'),
          where('ad_code', 'in', chunk)
        );
        const masterSnap = await getDocs(masterQ);
        masterSnap.docs.forEach(d => {
          const data = d.data();
          masterMap[data.ad_code] = data;
        });
      }
    }

    setDebugInfo(prev => ({
      ...prev,
      salon_masterRawCount: Object.keys(masterMap).length,
      salon_masterMatchedCodes: Object.keys(masterMap),
      salon_orphanCodes: adsCodes.filter(c => !masterMap[c])
    }));

    // 4. Ödemeleri çek (MasaOdemeIptalleri)
    let allPayments = [];
    if (adsCodes.length > 0) {
      const codeChunks = chunkArray(adsCodes, 10);
      for (const chunk of codeChunks) {
        const paymentsQ = query(
          collection(db, 'MasaOdemeIptalleri'),
          where('ads_code', 'in', chunk)
        );
        const paymentsSnap = await getDocs(paymentsQ);
        allPayments = [...allPayments, ...paymentsSnap.docs.map(d => d.data())];
      }
    }

    setDebugInfo(prev => ({
      ...prev,
      salon_detayCount: allItems.length,
      salon_odemeCount: allPayments.length
    }));

    // 5. Veriyi birleştir — her ads_code bir adisyon kartı
    const combinedData = Object.entries(groupedByAdsCode).map(([adsCode, items]) => {
      const master = masterMap[adsCode] || {};
      const payments = allPayments.filter(pay => pay.ads_code === adsCode);
      const firstItem = items[0] || {};

      const itemsTotal = items.reduce((sum, item) => sum + (Number(item.fiyati || item.fiyat || 0) * Number(item.miktar || item.adet || 1)), 0);
      const finalTotal = itemsTotal > 0 ? itemsTotal : (Number(master.ad_total) || 0);

      return {
        ...master,
        ad_code: adsCode,
        tarih: master.tarih || firstItem.tarih,
        gadsno: master.gadsno || firstItem.gadsno || '-',
        masa_adi: master.masa_adi || master.masaadi || firstItem.masaadi || 'Masa ?',
        iptalaciklama: master.iptalaciklama || firstItem.iptalaciklama || '-',
        rrc_restaurant_id: master.rrc_restaurant_id || firstItem.rrc_restaurant_id,
        items: items,
        payments: payments,
        totalAmount: finalTotal
      };
    });

    // 6. Genel toplamlar ve ödeme özetleri
    const grandTotal = combinedData.reduce((sum, ad) => sum + ad.totalAmount, 0);

    const paymentSummary = {};
    allPayments.forEach(pay => {
      const type = pay.odemesekli || pay.odeme_sekli || 'Diğer';
      const amount = Number(pay.tutar || pay.odenentutar || 0);
      if (!paymentSummary[type]) paymentSummary[type] = 0;
      paymentSummary[type] += amount;
    });

    setSalonTotal(grandTotal);
    setSalonPaymentSummary(paymentSummary);
    setSalonData(combinedData);
  };

  return (
    <div className="iptal-raporlari-container">
      <div className="page-header">
        <div className="header-content">
          <div className="title-section">
            <h1>
              <span className="material-icons">block</span>
              İptal Raporları
            </h1>
            <p>Paket ve Salon iptal işlemlerini detaylı görüntüleyin</p>
          </div>
        </div>
      </div>

      {/* Tab ve Filtre Alanı */}
      <div className="controls-section">
        <div className="tabs-container">
          <button 
            className={`tab-button ${activeTab === 'paket' ? 'active' : ''}`}
            onClick={() => setActiveTab('paket')}
          >
            <span className="material-icons">two_wheeler</span>
            Paket İptalleri
          </button>
          <button 
            className={`tab-button ${activeTab === 'salon' ? 'active' : ''}`}
            onClick={() => setActiveTab('salon')}
          >
            <span className="material-icons">restaurant</span>
            Salon İptalleri
          </button>
        </div>

        <div className="filters-row">
          <div className="filter-group">
            <div className="report-mode-buttons">
              <button className={`filter-btn ${mode === 'daily' ? 'active' : ''}`} onClick={() => setMode('daily')}>Benim Günüm</button>
              <button className={`filter-btn ${mode === 'range' ? 'active' : ''}`} onClick={() => setMode('range')}>Tarih Aralığı</button>
            </div>
          </div>

          {mode === 'daily' ? (
            <div className="filter-group">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="date-input" />
            </div>
          ) : (
            <div className="filter-group date-range">
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="date-input" />
              <span>-</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="date-input" />
            </div>
          )}

          {currentUser?.role === 'sirket_yoneticisi' && (
             <div className="filter-group">
               <select value={selectedSube} onChange={(e) => setSelectedSube(e.target.value)} className="sube-select">
                 <option value="">Tüm Şubeler</option>
                 {subeler.map(s => (
                   <option key={s.id} value={s.id}>{s.subeAdi}</option>
                 ))}
               </select>
             </div>
          )}
        </div>
      </div>
      
      {/* Debug Paneli */}
      <div className="debug-toggle-row">
        <button className="debug-toggle-btn" onClick={() => setShowDebug(prev => !prev)}>
          <span className="material-icons">{showDebug ? 'bug_report' : 'bug_report'}</span>
          {showDebug ? 'Debug Kapat' : 'Debug Aç'}
        </button>
      </div>
      {showDebug && (
        <div className="debug-panel">
          <div className="debug-header-row">
            <h3>🔍 Debug Bilgileri</h3>
            <button className="debug-copy-btn" onClick={() => {
              const text = JSON.stringify(debugInfo, null, 2);
              navigator.clipboard.writeText(text).then(() => {
                const btn = document.querySelector('.debug-copy-btn');
                const orig = btn.textContent;
                btn.textContent = '✓ Kopyalandı!';
                setTimeout(() => { btn.innerHTML = '<span class="material-icons">content_copy</span>Kopyala'; }, 1500);
              });
            }}>
              <span className="material-icons">content_copy</span>Kopyala
            </button>
          </div>
          <div className="debug-section">
            <h4>Sorgu Parametreleri</h4>
            <pre>{JSON.stringify(debugInfo.queryParams, null, 2)}</pre>
          </div>
          <div className="debug-section debug-highlight">
            <h4>⚡ TANILAMA: Tarih filtresi OLMADAN son kayıtlar ({debugInfo.diag_collection} → {debugInfo.diag_noFilterCount ?? '?'} kayıt bulundu)</h4>
            {debugInfo.diag_error && <pre style={{color:'#f87171'}}>HATA: {debugInfo.diag_error}</pre>}
            <pre>{JSON.stringify(debugInfo.diag_noFilterSample, null, 2)}</pre>
            {debugInfo.diag_withSubeCount !== undefined && (
              <>
                <h4 style={{marginTop: 12}}>Şube filtreli (tarihsiz): {debugInfo.diag_withSubeCount} kayıt</h4>
                <pre>{JSON.stringify(debugInfo.diag_withSubeSample, null, 2)}</pre>
              </>
            )}
          </div>
          {activeTab === 'paket' ? (
            <>
              <div className="debug-section">
                <h4>padisyoniptaller — Ham Sonuç: {debugInfo.paket_masterRawCount ?? '?'} kayıt (dedup sonrası: {debugInfo.paket_afterDedup ?? '?'}, çıkarılan: {debugInfo.paket_removedByDedup ?? 0})</h4>
                <pre>{JSON.stringify(debugInfo.paket_masterRawTarihler, null, 2)}</pre>
              </div>
              <div className="debug-section">
                <h4>psiparisiptaller — Detay: {debugInfo.paket_detayCount ?? '?'} kayıt</h4>
                <pre>{JSON.stringify(debugInfo.paket_detaySample, null, 2)}</pre>
              </div>
              <div className="debug-section">
                <h4>Ham Veri Örneği (ilk 3 master doküman)</h4>
                <pre>{JSON.stringify(debugInfo.paket_masterRawSample?.slice(0, 3), null, 2)}</pre>
              </div>
            </>
          ) : (
            <>
              <div className="debug-section">
                <h4>tblmasaiptalads — Ham Sonuç: {debugInfo.salon_masterRawCount ?? '?'} kayıt (dedup sonrası: {debugInfo.salon_afterDedup ?? '?'}, çıkarılan: {debugInfo.salon_removedByDedup ?? 0})</h4>
                <pre>{JSON.stringify(debugInfo.salon_masterRawTarihler, null, 2)}</pre>
              </div>
              <div className="debug-section">
                <h4>MasaIptalAdsIcerik — Detay: {debugInfo.salon_detayCount ?? '?'} | MasaOdemeIptalleri: {debugInfo.salon_odemeCount ?? '?'}</h4>
                <pre>{JSON.stringify(debugInfo.salon_detaySample, null, 2)}</pre>
              </div>
              <div className="debug-section">
                <h4>Ham Veri Örneği (ilk 3 master doküman)</h4>
                <pre>{JSON.stringify(debugInfo.salon_masterRawSample?.slice(0, 3), null, 2)}</pre>
              </div>
            </>
          )}
          <div className="debug-section debug-highlight">
            <h4>📦 MasaIptalAdsIcerik — TÜM KAYITLAR (filtresiz): {debugInfo.icerik_totalCount ?? '?'} kayıt</h4>
            {debugInfo.icerik_error && <pre style={{color:'#f87171'}}>HATA: {debugInfo.icerik_error}</pre>}
            <pre>{JSON.stringify(debugInfo.icerik_allDocs, null, 2)}</pre>
          </div>
        </div>
      )}

      {/* Hata Mesajı */}
      {error && (
        <div className="error-message">
          <span className="material-icons">error_outline</span>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Veriler Yükleniyor...</p>
        </div>
      )}

      {/* İçerik */}
      {!loading && !error && (
        <div className="report-content">
          
          {/* PAKET İPTALLERİ */}
          {activeTab === 'paket' && (
            <>
              {paketData.length === 0 ? (
                <div className="empty-state">Kayıt Bulunamadı</div>
              ) : (
                <div className="report-list">
                  {paketData.map((order, index) => (
                    <div key={index} className="report-card">
                      <div className="card-header">
                        <div className="header-left">
                          <span className="date-badge">{order.tarih ? new Date(order.tarih).toLocaleTimeString('tr-TR', {hour:'2-digit', minute:'2-digit'}) : '-'}</span>
                          <span className="order-code">Adisyon Numarası: {order.padsgnum || '-'}</span>
                        </div>
                        <div className="header-right">
                          <span className="total-amount">₺{Number(order.totalAmount).toFixed(2)}</span>
                        </div>
                      </div>
                      <div className="card-body">
                        <table className="items-table">
                          <thead>
                            <tr>
                              <th>Ürün</th>
                              <th>Adet</th>
                              <th>Birim Fiyat</th>
                              <th>Tutar</th>
                            </tr>
                          </thead>
                          <tbody>
                            {order.items.map((item, idx) => (
                              <tr key={idx}>
                                <td>{item.urunadi}</td>
                                <td>{item.miktar || item.adet}</td>
                                <td>₺{Number(item.fiyat || item.fiyati || 0).toFixed(2)}</td>
                                <td>₺{(Number(item.miktar || item.adet || 0) * Number(item.fiyat || item.fiyati || 0)).toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="card-footer">
                        <p><strong>İptal Nedeni:</strong> {order.iptalneden || '-'}</p>
                        <p><strong>Müşteri:</strong> {order.ads_siparisadres || order.kisikod || '-'}</p>
                        {order.rrc_restaurant_id && <p><strong>Şube:</strong> {order.rrc_restaurant_id}</p>}
                        <p><strong>İptal Tarihi:</strong> {order.tarih ? new Date(order.tarih).toLocaleString('tr-TR') : '-'}</p>
                      </div>
                    </div>
                  ))}
                  
                  <div className="summary-footer">
                    <h3>Genel Toplam</h3>
                    <div className="grand-total">₺{paketTotal.toFixed(2)}</div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* SALON İPTALLERİ */}
          {activeTab === 'salon' && (
            <>
               {salonData.length === 0 ? (
                <div className="empty-state">Kayıt Bulunamadı</div>
              ) : (
                <div className="report-list">
                  {salonData.map((ad, index) => (
                    <div key={index} className="report-card">
                      <div className="card-header">
                        <div className="header-left">
                           <span className="date-badge">{ad.tarih ? new Date(ad.tarih).toLocaleTimeString('tr-TR', {hour:'2-digit', minute:'2-digit'}) : '-'}</span>
                           <span className="order-code">Adisyon Numarası: {ad.gadsno || '-'} | {ad.masa_adi || 'Masa ?'}</span>
                        </div>
                        <div className="header-right">
                           <span className="total-amount">₺{ad.totalAmount.toFixed(2)}</span>
                        </div>
                      </div>
                      
                      <div className="card-body">
                         {/* Ürünler */}
                         <div className="section-label">İptal Edilen Ürünler</div>
                         <table className="items-table">
                          <thead>
                            <tr>
                              <th>Ürün</th>
                              <th>Adet</th>
                              <th>Fiyat</th>
                              <th>Tutar</th>
                            </tr>
                          </thead>
                          <tbody>
                             {ad.items.map((item, idx) => (
                               <tr key={idx}>
                                 <td>{item.urun_adi || item.urunadi || '-'}</td>
                                 <td>{item.adet || item.miktar || 0}</td>
                                 <td>₺{Number(item.fiyat || item.fiyati || 0).toFixed(2)}</td>
                                 <td>₺{(Number(item.adet || item.miktar || 0) * Number(item.fiyat || item.fiyati || 0)).toFixed(2)}</td>
                               </tr>
                             ))}
                          </tbody>
                        </table>

                        {/* Ödemeler (varsa) */}
                        {ad.payments && ad.payments.length > 0 && (
                          <div className="payments-section">
                             <div className="section-label">İptal Edilen Ödemeler</div>
                             <div className="payment-tags">
                                {ad.payments.map((p, idx) => (
                                  <span key={idx} className="payment-tag">
                                    {(p.odemesekli || p.odeme_sekli || 'Diğer')}: ₺{Number(p.tutar || p.odenentutar || 0).toFixed(2)}
                                  </span>
                                ))}
                             </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  <div className="summary-footer">
                    <div className="summary-row">
                      <h3>Genel Toplam</h3>
                      <div className="grand-total">₺{salonTotal.toFixed(2)}</div>
                    </div>
                    {Object.keys(salonPaymentSummary).length > 0 && (
                      <div className="payment-breakdown">
                        <h4>Ödeme Detayları</h4>
                        <div className="breakdown-grid">
                          {Object.entries(salonPaymentSummary).map(([type, amount]) => (
                            <div key={type} className="breakdown-item">
                              <span className="label">{type}</span>
                              <span className="value">₺{amount.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

        </div>
      )}
    </div>
  );
};

export default IptalRaporlariPage;
