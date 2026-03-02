import React, { useEffect, useState, useMemo } from 'react';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import PageHeader from '../components/PageHeader';
import { normalizeDateStr, toDate, formatDateTime, formatCurrency, todayTR, daysAgoTR } from '../utils/dateUtils';
import './TeslimRaporuPage.css';

const TeslimRaporuPage = () => {
  const { currentUser, subeler } = useAuth();

  // Bugünü ve 2 gün öncesini hesapla (TR saat dilimine göre)
  const today = todayTR();
  const twoDaysAgo = daysAgoTR(2);

  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [selectedSube, setSelectedSube] = useState('');
  const [rrcId, setRrcId] = useState(null);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Tarih değişikliklerinde max 2 gün kontrolü
  const handleStartDateChange = (val) => {
    setStartDate(val);
    // endDate, startDate'den 2 günden fazla ileride olamaz
    const maxEnd = daysAgoTR(-2);  // 2 gün sonrası (val'den değil, şimdilik global max)
    // val + 2 gün hesapla
    const maxEndFromVal = todayTR(new Date(new Date(val + 'T12:00:00').getTime() + 2 * 86400000));
    if (endDate > maxEndFromVal) setEndDate(maxEndFromVal);
    if (endDate < val) setEndDate(val);
  };

  const handleEndDateChange = (val) => {
    setEndDate(val);
    // startDate, endDate'den 2 günden fazla geride olamaz
    const minStart = todayTR(new Date(new Date(val + 'T12:00:00').getTime() - 2 * 86400000));
    if (startDate < minStart) setStartDate(minStart);
    if (startDate > val) setStartDate(val);
  };

  // rrc_restaurant_id'yi al
  useEffect(() => {
    if (!currentUser?.subeId) return;
    const fetchRrcId = async () => {
      try {
        const subeDoc = await getDoc(doc(db, 'subeler', currentUser.subeId));
        if (subeDoc.exists()) {
          setRrcId(subeDoc.data().rrc_restaurant_id || currentUser.subeId);
        }
      } catch (err) {
        console.error('Şube bilgisi getirilemedi:', err);
      }
    };
    fetchRrcId();
  }, [currentUser]);

  // Veri çekme
  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      let targetRrcId = rrcId;
      if (currentUser?.role === 'sirket_yoneticisi' && selectedSube) {
        const subeData = subeler.find(s => s.id === selectedSube);
        targetRrcId = subeData?.rrc_restaurant_id || selectedSube;
      }

      const constraints = [];
      if (targetRrcId) {
        constraints.push(where('rrc_restaurant_id', '==', String(targetRrcId)));
      }

      const q = query(collection(db, 'PaketAdisyonlar'), ...constraints);
      const snap = await getDocs(q);
      let items = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Tarih filtresi

      items = items.filter(x => {
        const dateVal = x.acilis || x.tarih;
        if (!dateVal) return false;
        const normalized = normalizeDateStr(dateVal);
        if (!normalized) return false;
        return normalized >= startDate && normalized <= endDate;
      });

      // kisikod 1000000 olanları çıkar
      items = items.filter(x => String(x.kisikod) !== '1000000');

      // Teslim edilmiş siparişleri filtrele (motorcu atanmış ve teslim edilmiş)
      items = items.filter(x => {
        const durum = (x.durum || '').toString().toLowerCase();
        return durum === 'teslim edildi' || durum === 'teslim' || durum === 'delivered' || durum === '3'
          || durum === 'gönderildi' || durum === 'gonderildi' || durum === 'sent'
          || durum === 'onaylandı' || durum === 'onaylandi' || durum === 'approved' || durum === 'confirmed';
      });

      // Kurye ise sadece kendi teslim ettiği siparişleri görsün
      if (currentUser?.role === 'kurye') {
        const kuryeAdi = currentUser.displayName || currentUser.email;
        items = items.filter(x => x.motorcu === kuryeAdi);
      }

      // Sıralama
      items.sort((a, b) => {
        const tA = toDate(a.acilis || a.tarih) || new Date(0);
        const tB = toDate(b.acilis || b.tarih) || new Date(0);
        return tB - tA; // En yeni önce
      });

      setData(items);
    } catch (err) {
      console.error('Veri çekilirken hata:', err);
      setError('Veriler yüklenirken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (rrcId || (currentUser?.role === 'sirket_yoneticisi' && selectedSube)) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rrcId, startDate, endDate, selectedSube]);

  // Ödeme tipi normalize fonksiyonu
  const normalizeOdemeTipi = (val) => {
    if (val === undefined || val === null) return 'Bilinmeyen';
    if (typeof val === 'number') {
      switch (val) {
        case 0: return 'Nakit';
        case 1: return 'Kredi Kartı';
        case 2: return 'Ticket Restaurant';
        case 3: return 'Sodexo';
        case 4: return 'Veresiye';
        case 5: return 'Online Ödeme';
        case 6: return 'Transfer';
        case 7: return 'Multinet';
        default: return `Diğer (${val})`;
      }
    }
    if (typeof val === 'string') {
      const t = val.trim();
      if (!t) return 'Bilinmeyen';
      const norm = t.toUpperCase().replace(/İ/g, 'I');
      if (/NAK/.test(norm) || norm === 'CASH') return 'Nakit';
      if (/KART|KREDI|POS|CREDIT/.test(norm)) return 'Kredi Kartı';
      if (/TICKET/.test(norm) || /YEMEK KART/.test(norm)) return 'Ticket Restaurant';
      if (/SODEXO/.test(norm)) return 'Sodexo';
      if (/MULTINET/.test(norm)) return 'Multinet';
      if (/ONLINE/.test(norm)) return 'Online Ödeme';
      if (/TRANSFER|HAVALE/.test(norm)) return 'Transfer';
      if (/VERESIYE|VADELI/.test(norm)) return 'Veresiye';
      return t;
    }
    return 'Bilinmeyen';
  };

  // İkon ve renk eşlemesi
  const odemeTipiMeta = {
    'Nakit': { icon: 'payments', color: '#28a745' },
    'Kredi Kartı': { icon: 'credit_card', color: '#2E5BFF' },
    'Ticket Restaurant': { icon: 'restaurant', color: '#fd7e14' },
    'Sodexo': { icon: 'card_membership', color: '#17a2b8' },
    'Multinet': { icon: 'card_membership', color: '#6f42c1' },
    'Online Ödeme': { icon: 'online_prediction', color: '#007bff' },
    'Transfer': { icon: 'account_balance', color: '#20c997' },
    'Veresiye': { icon: 'schedule', color: '#6c757d' },
    'Bilinmeyen': { icon: 'help_outline', color: '#adb5bd' },
  };

  const getMeta = (tip) => odemeTipiMeta[tip] || { icon: 'help_outline', color: '#adb5bd' };

  // Sipariş platformu
  const getSiparisNerden = (val) => {
    switch (val) {
      case 0: return { text: 'Telefon', icon: 'phone' };
      case 1: return { text: 'Yemek Sepeti', icon: 'delivery_dining' };
      case 2: return { text: 'Getir', icon: 'motorcycle' };
      case 5: return { text: 'Trendyol', icon: 'shopping_bag' };
      case 8: return { text: 'Migros', icon: 'store' };
      case 88: return { text: 'Masa', icon: 'table_restaurant' };
      default: return { text: 'Diğer', icon: 'receipt' };
    }
  };

  // Hesaplamalar
  const summary = useMemo(() => {
    const toplamTutar = data.reduce((s, x) => s + (Number(x.atop) || 0), 0);
    const siparisSayisi = data.length;

    // Ödeme tipine göre grupla
    const odemeGruplari = {};
    data.forEach(x => {
      const raw = x.odemetipi ?? x.odemeTipi ?? x.payment_type ?? x.odeme_tipi ?? x.paymentType ?? 0;
      const tip = normalizeOdemeTipi(raw);
      if (!odemeGruplari[tip]) {
        odemeGruplari[tip] = { count: 0, total: 0 };
      }
      odemeGruplari[tip].count += 1;
      odemeGruplari[tip].total += Number(x.atop) || 0;
    });

    // Sıralama: toplam tutara göre büyükten küçüğe
    const sortedOdeme = Object.entries(odemeGruplari)
      .sort(([, a], [, b]) => b.total - a.total);

    // Platform gruplama
    const platformGruplari = {};
    data.forEach(x => {
      const p = getSiparisNerden(x.siparisnerden);
      if (!platformGruplari[p.text]) {
        platformGruplari[p.text] = { count: 0, total: 0, icon: p.icon };
      }
      platformGruplari[p.text].count += 1;
      platformGruplari[p.text].total += Number(x.atop) || 0;
    });

    const sortedPlatform = Object.entries(platformGruplari)
      .sort(([, a], [, b]) => b.total - a.total);

    // Günlük dağılım
    const gunlukDagilim = {};
    data.forEach(x => {
      const d = normalizeDateStr(x.acilis || x.tarih);
      if (!d) return;
      if (!gunlukDagilim[d]) {
        gunlukDagilim[d] = { count: 0, total: 0 };
      }
      gunlukDagilim[d].count += 1;
      gunlukDagilim[d].total += Number(x.atop) || 0;
    });

    const sortedGunluk = Object.entries(gunlukDagilim).sort(([a], [b]) => b.localeCompare(a));

    return { toplamTutar, siparisSayisi, sortedOdeme, sortedPlatform, sortedGunluk };
  }, [data]);

  const isCompanyManager = currentUser?.role === 'sirket_yoneticisi';

  return (
    <div className="teslim-raporu-container">
      <PageHeader
        title="Teslim Edilen Siparişler"
        subtitle="Günlük veya son 2 gün içinde teslim edilen siparişler ve ödeme özeti"
        icon="local_shipping"
      />

      {/* FİLTRELER */}
      <div className="tr-filters">
        <div className="tr-filter-group">
          <label>Başlangıç</label>
          <input
            type="date"
            value={startDate}
            max={endDate}
            onChange={e => handleStartDateChange(e.target.value)}
            className="tr-date-input"
          />
        </div>
        <div className="tr-filter-group">
          <label>Bitiş</label>
          <input
            type="date"
            value={endDate}
            min={startDate}
            max={today}
            onChange={e => handleEndDateChange(e.target.value)}
            className="tr-date-input"
          />
        </div>
        <div className="tr-filter-group">
          <label>&nbsp;</label>
          <div className="tr-quick-btns">
            <button
              className={`tr-toggle-btn ${startDate === today && endDate === today ? 'active' : ''}`}
              onClick={() => { setStartDate(today); setEndDate(today); }}
            >
              Bugün
            </button>
            <button
              className={`tr-toggle-btn ${startDate === twoDaysAgo && endDate === today ? 'active' : ''}`}
              onClick={() => { setStartDate(twoDaysAgo); setEndDate(today); }}
            >
              Son 2 Gün
            </button>
          </div>
        </div>

        {isCompanyManager && subeler?.length > 0 && (
          <div className="tr-filter-group">
            <label>Şube Seçimi</label>
            <select
              value={selectedSube}
              onChange={e => setSelectedSube(e.target.value)}
              className="tr-select"
            >
              <option value="">Tümü</option>
              {subeler.map(s => (
                <option key={s.id} value={s.id}>{s.subeAdi || s.id}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* HATA */}
      {error && (
        <div className="tr-error">
          <span className="material-icons">error_outline</span>
          {error}
        </div>
      )}

      {/* YÜKLENİYOR */}
      {loading && (
        <div className="tr-loading">
          <div className="tr-spinner" />
          <p>Veriler yükleniyor...</p>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* ÖZET KARTLAR */}
          <div className="tr-summary-row">
            <div className="tr-summary-card">
              <div className="tr-summary-icon icon-blue">
                <span className="material-icons">receipt_long</span>
              </div>
              <div className="tr-summary-body">
                <span className="tr-summary-label">Toplam Sipariş</span>
                <span className="tr-summary-value">{summary.siparisSayisi}</span>
              </div>
            </div>
            <div className="tr-summary-card">
              <div className="tr-summary-icon icon-green">
                <span className="material-icons">payments</span>
              </div>
              <div className="tr-summary-body">
                <span className="tr-summary-label">Toplam Tutar</span>
                <span className="tr-summary-value">{formatCurrency(summary.toplamTutar)}</span>
              </div>
            </div>
          </div>

          {/* GÜNLÜK DAĞILIM (sadece last2 modunda) */}
          {startDate !== endDate && summary.sortedGunluk.length > 0 && (
            <div className="tr-section">
              <h3 className="tr-section-title">
                <span className="material-icons">calendar_today</span>
                Günlük Dağılım
              </h3>
              <div className="tr-day-grid">
                {summary.sortedGunluk.map(([gun, info]) => (
                  <div key={gun} className="tr-day-card">
                    <div className="tr-day-date">
                      {new Date(gun + 'T00:00:00').toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </div>
                    <div className="tr-day-stats">
                      <span>{info.count} sipariş</span>
                      <span className="tr-day-total">{formatCurrency(info.total)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ÖDEME TİPİ DAĞILIMI */}
          {summary.sortedOdeme.length > 0 && (
            <div className="tr-section">
              <h3 className="tr-section-title">
                <span className="material-icons">account_balance_wallet</span>
                Ödeme Şekillerine Göre Dağılım
              </h3>
              <div className="tr-payment-grid">
                {summary.sortedOdeme.map(([tip, info]) => {
                  const meta = getMeta(tip);
                  const yuzde = summary.toplamTutar > 0
                    ? ((info.total / summary.toplamTutar) * 100).toFixed(1)
                    : '0.0';
                  return (
                    <div key={tip} className="tr-payment-card">
                      <div className="tr-payment-header">
                        <div className="tr-payment-icon" style={{ background: meta.color }}>
                          <span className="material-icons">{meta.icon}</span>
                        </div>
                        <div className="tr-payment-info">
                          <span className="tr-payment-name">{tip}</span>
                          <span className="tr-payment-count">{info.count} sipariş</span>
                        </div>
                        <span className="tr-payment-pct">{yuzde}%</span>
                      </div>
                      <div className="tr-payment-bar-bg">
                        <div
                          className="tr-payment-bar-fill"
                          style={{ width: `${yuzde}%`, background: meta.color }}
                        />
                      </div>
                      <div className="tr-payment-total">{formatCurrency(info.total)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* PLATFORM DAĞILIMI */}
          {summary.sortedPlatform.length > 0 && (
            <div className="tr-section">
              <h3 className="tr-section-title">
                <span className="material-icons">storefront</span>
                Platforma Göre Dağılım
              </h3>
              <div className="tr-platform-grid">
                {summary.sortedPlatform.map(([name, info]) => (
                  <div key={name} className="tr-platform-card">
                    <span className="material-icons tr-platform-icon">{info.icon}</span>
                    <div className="tr-platform-body">
                      <span className="tr-platform-name">{name}</span>
                      <span className="tr-platform-count">{info.count} sipariş</span>
                    </div>
                    <span className="tr-platform-total">{formatCurrency(info.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SİPARİŞ LİSTESİ */}
          <div className="tr-section">
            <h3 className="tr-section-title">
              <span className="material-icons">list_alt</span>
              Sipariş Detayları ({data.length})
            </h3>

            {data.length === 0 ? (
              <div className="tr-empty">
                <span className="material-icons">inbox</span>
                <p>Teslim edilmiş sipariş bulunamadı.</p>
              </div>
            ) : (
              <>
                {/* MASAÜSTÜ TABLO */}
                <div className="tr-table-wrapper">
                  <table className="tr-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Adisyon No</th>
                        <th>Tarih</th>
                        <th>Platform</th>
                        <th>Kurye</th>
                        <th>Ödeme Şekli</th>
                        <th className="text-right">Tutar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.map((item, idx) => {
                        const raw = item.odemetipi ?? item.odemeTipi ?? item.payment_type ?? item.odeme_tipi ?? 0;
                        const tip = normalizeOdemeTipi(raw);
                        const meta = getMeta(tip);
                        const platform = getSiparisNerden(item.siparisnerden);
                        return (
                          <tr key={item.id}>
                            <td>{idx + 1}</td>
                            <td className="mono">{item.padsgnum || '-'}</td>
                            <td>{formatDateTime(item.acilis || item.tarih)}</td>
                            <td>
                              <span className="tr-badge">
                                <span className="material-icons">{platform.icon}</span>
                                {platform.text}
                              </span>
                            </td>
                            <td>{item.motorcu || '-'}</td>
                            <td>
                              <span className="tr-badge" style={{ background: meta.color }}>
                                <span className="material-icons">{meta.icon}</span>
                                {tip}
                              </span>
                            </td>
                            <td className="text-right bold">{formatCurrency(item.atop)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan="6" className="text-right"><strong>Genel Toplam</strong></td>
                        <td className="text-right bold">{formatCurrency(summary.toplamTutar)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* MOBİL KARTLAR */}
                <div className="tr-card-grid">
                  {data.map((item, idx) => {
                    const raw = item.odemetipi ?? item.odemeTipi ?? item.payment_type ?? item.odeme_tipi ?? 0;
                    const tip = normalizeOdemeTipi(raw);
                    const meta = getMeta(tip);
                    const platform = getSiparisNerden(item.siparisnerden);
                    return (
                      <div key={item.id} className="tr-card">
                        <div className="tr-card-top">
                          <span className="tr-card-no">
                            <span className="material-icons">receipt</span>
                            #{item.padsgnum || idx + 1}
                          </span>
                          <span className="tr-card-amount">{formatCurrency(item.atop)}</span>
                        </div>
                        <div className="tr-card-body">
                          <div className="tr-card-row">
                            <span className="material-icons">schedule</span>
                            {formatDateTime(item.acilis || item.tarih)}
                          </div>
                          <div className="tr-card-row">
                            <span className="material-icons">{platform.icon}</span>
                            {platform.text}
                          </div>
                          <div className="tr-card-row">
                            <span className="material-icons">person</span>
                            {item.motorcu || '-'}
                          </div>
                          <div className="tr-card-row">
                            <span className="material-icons" style={{ color: meta.color }}>{meta.icon}</span>
                            <span style={{ color: meta.color, fontWeight: 600 }}>{tip}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default TeslimRaporuPage;
