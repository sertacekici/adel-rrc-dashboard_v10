import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { toDate } from '../utils/dateUtils';
import AdisyonDetailModal from '../components/AdisyonDetailModal';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import './AdisyonlarPage.css';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

const KAYNAK_MAP = {
  0: { text: 'Telefon Siparişi', icon: 'phone_in_talk' },
  1: { text: 'Yemek Sepeti', icon: 'restaurant' },
  2: { text: 'Getir', icon: 'pedal_bike' },
  5: { text: 'Trendyol', icon: 'shopping_bag' },
  8: { text: 'Migros Yemek', icon: 'local_grocery_store' },
  88: { text: 'Masa Siparişi', icon: 'table_restaurant' }
};

const AdisyonlarPage = () => {
  const [adisyonlar, setAdisyonlar] = useState([]);
  const [filteredAdisyonlar, setFilteredAdisyonlar] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSube, setSelectedSube] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [orderTypeFilter, setOrderTypeFilter] = useState('all');
  const [reportMode, setReportMode] = useState('daily');
  const todayRef = new Date();
  const yesterdayRef = new Date(todayRef);
  yesterdayRef.setDate(yesterdayRef.getDate() - 1);
  const [startDate, setStartDate] = useState(yesterdayRef.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(todayRef.toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('08:00');
  const [dailyStartTime, setDailyStartTime] = useState('00:00');
  const [dailyEndTime, setDailyEndTime] = useState('23:59');
  const [useDailyTimeFilter, setUseDailyTimeFilter] = useState(false);
  const [reportTrigger, setReportTrigger] = useState(0);
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
        let subeQuery;
        if (currentUser?.role === 'sirket_yoneticisi') {
          subeQuery = query(collection(db, 'subeler'));
        } else if (currentUser?.subeId) {
          subeQuery = query(collection(db, 'subeler'), where('__name__', '==', currentUser.subeId));
        } else {
          return;
        }

        if (subeQuery) {
          const unsubscribe = onSnapshot(subeQuery, (snapshot) => {
            const subeList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setSubeler(subeList);
            if (currentUser?.role !== 'sirket_yoneticisi' && subeList.length > 0) {
              setSelectedSube(subeList[0].rrc_restaurant_id || subeList[0].id);
            }
          }, (error) => {
            setError('Şubeler yüklenirken bir hata oluştu: ' + error.message);
          });
          return () => unsubscribe();
        }
      } catch (err) {
        setError('Şubeler yüklenirken bir hata oluştu: ' + err.message);
      }
    };
    if (currentUser) getSubeler();
  }, [currentUser]);

  // Tarih aralığı oluştur
  const buildDateFilters = () => {
    let start, end;
    if (reportMode === 'daily') {
      if (useDailyTimeFilter) {
        start = new Date(selectedDate + 'T' + dailyStartTime + ':00');
        end = new Date(selectedDate + 'T' + dailyEndTime + ':59');
      } else {
        start = new Date(selectedDate + 'T00:00:00');
        end = new Date(selectedDate + 'T23:59:59');
      }
    } else {
      start = new Date(startDate + 'T' + startTime + ':00');
      end = new Date(endDate + 'T' + endTime + ':59');
    }
    return { start, end };
  };

  // Client-side tarih filtresi (reportService mantığı)
  const isInDateRange = (dateValue, rangeStart, rangeEnd) => {
    const d = toDate(dateValue);
    if (!d) return false;
    return d >= rangeStart && d <= rangeEnd;
  };

  // Adisyonları getir (PaketAdisyonlar + MasaOdemeleri)
  useEffect(() => {
    if (!selectedSube) { setAdisyonlar([]); setLoading(false); return; }
    if (reportMode === 'daily' && !selectedDate) { setAdisyonlar([]); setLoading(false); return; }
    if (reportMode === 'range' && (!startDate || !endDate)) { setAdisyonlar([]); setLoading(false); return; }

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const { start, end } = buildDateFilters();
        const rrcId = String(selectedSube);

        // İki koleksiyonu paralel çek (PaketAdisyonlar + SalonAdisyonlari)
        const [paketSnap, salonSnap] = await Promise.all([
          getDocs(query(collection(db, 'PaketAdisyonlar'), where('rrc_restaurant_id', '==', rrcId))),
          getDocs(query(collection(db, 'SalonAdisyonlari'), where('rrc_restaurant_id', '==', rrcId)))
        ]);

        // PaketAdisyonlar → client-side tarih filtresi (acilis alanı)
        const paketDocs = paketSnap.docs
          .map(doc => ({ id: doc.id, ...doc.data(), _kaynak: 'paket' }))
          .filter(d => isInDateRange(d.acilis, start, end));

        // SalonAdisyonlari → client-side tarih filtresi (ad_open alanı)
        const masaDocs = salonSnap.docs
          .map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              _kaynak: 'masa',
              siparisnerden: 88,
              adisyoncode: data.ad_code,
              acilis: data.ad_open,
              atop: Number(data.ad_total) || 0,
              ads_durum: data.ads_durum,
              ads_no: data.ads_no,
              tableid: data.tableid,
              ad_pmedhod: data.ad_pmedhod,
            };
          })
          .filter(d => isInDateRange(d.acilis, start, end));

        // Birleştir
        const allDocs = [...paketDocs, ...masaDocs];

        // Deduplication (adisyoncode bazında)
        const seen = new Map();
        for (const adisyon of allDocs) {
          const key = adisyon.adisyoncode;
          if (key != null && key !== '') { seen.set(key, adisyon); }
          else { seen.set(adisyon.id, adisyon); }
        }

        // Tarihe göre sırala
        const result = Array.from(seen.values()).sort((a, b) => {
          const da = toDate(a.acilis || a.tarih);
          const db2 = toDate(b.acilis || b.tarih);
          if (!da) return 1;
          if (!db2) return -1;
          return da - db2;
        });

        setAdisyonlar(result);
      } catch (err) {
        console.error('Adisyon fetch hatası:', err);
        setError('Adisyonlar yüklenirken bir hata oluştu: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSube, reportTrigger]);

  // Sipariş tipi filtreleme
  useEffect(() => {
    let filtered = adisyonlar;
    if (orderTypeFilter === 'masa') {
      filtered = adisyonlar.filter(a => Number(a.siparisnerden) === 88);
    } else if (orderTypeFilter === 'online') {
      filtered = adisyonlar.filter(a => Number(a.siparisnerden) !== 88);
    }
    setFilteredAdisyonlar(filtered);
    setCurrentPage(1);
  }, [adisyonlar, orderTypeFilter]);

  const isCanceled = (adisyon) => {
    if (!adisyon || !adisyon.durum) return false;
    try {
      const s = String(adisyon.durum).toUpperCase();
      return s.includes('\u0130PTAL') || s.includes('IPTAL');
    } catch (e) { return false; }
  };

  const getAdisyonTipi = (siparisnerden) => {
    const k = KAYNAK_MAP[siparisnerden];
    if (k) return k.text;
    return siparisnerden > 0 ? 'Online (' + siparisnerden + ')' : 'Diğer';
  };

  const getAdisyonDurum = (adisyon_durum, durum) => {
    if (durum) {
      const d = String(durum).toUpperCase();
      if (d === 'YEN\u0130' || d === 'YENI') return { text: 'Yeni', badge: 'badge-blue' };
      if (d === 'ONAYLANDI') return { text: 'Onaylandı', badge: 'badge-green' };
      if (d === 'G\u00D6NDER\u0130LD\u0130' || d === 'GONDERILDI') return { text: 'Gönderildi', badge: 'badge-blue' };
      if (d.includes('\u0130PTAL') || d.includes('IPTAL')) return { text: '\u0130ptal', badge: 'badge-red' };
      return { text: durum, badge: 'badge-gray' };
    }
    const durumNum = Number(adisyon_durum);
    if (durumNum === 1) return { text: 'Açık', badge: 'badge-orange' };
    if (durumNum === 4) return { text: 'Ödendi', badge: 'badge-green' };
    return { text: 'Bilinmiyor', badge: 'badge-gray' };
  };

  const getAdisyonTutar = (a) => Number(a.atop) || Number(a.tutar) || Number(a.toplamTutar) || 0;
  const formatAmount = (amount) => {
    if (!amount) return '0,00 ₺';
    return Number(amount).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
  };

  const formatDate = (dateValue) => {
    if (!dateValue) return '-';
    const d = toDate(dateValue);
    if (!d) return String(dateValue);
    return d.toLocaleString('tr-TR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const showAdisyonDetail = (adisyon) => { setSelectedAdisyon(adisyon); setIsModalOpen(true); };
  const closeModal = () => { setIsModalOpen(false); setSelectedAdisyon(null); };

  const totalPages = Math.ceil(filteredAdisyonlar.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedAdisyonlar = filteredAdisyonlar.slice(startIndex, endIndex);
  const handlePageChange = (page) => { setCurrentPage(page); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const getStats = () => {
    const canceled = adisyonlar.filter(isCanceled);
    const active = adisyonlar.filter(a => !isCanceled(a));
    const toplamCiro = active.reduce((t, a) => t + getAdisyonTutar(a), 0);
    const toplamIptal = canceled.reduce((t, a) => t + getAdisyonTutar(a), 0);
    const masaList = active.filter(a => Number(a.siparisnerden) === 88);
    const paketList = active.filter(a => Number(a.siparisnerden) !== 88);
    const masaCiro = masaList.reduce((t, a) => t + getAdisyonTutar(a), 0);
    const paketCiro = paketList.reduce((t, a) => t + getAdisyonTutar(a), 0);
    const kaynakGruplari = {};
    active.forEach(a => {
      const nerden = Number(a.siparisnerden) || 0;
      const k = KAYNAK_MAP[nerden];
      const label = k ? k.text : 'Diğer (' + nerden + ')';
      if (!kaynakGruplari[label]) kaynakGruplari[label] = { ciro: 0, adet: 0 };
      kaynakGruplari[label].ciro += getAdisyonTutar(a);
      kaynakGruplari[label].adet += 1;
    });
    return { active, canceled, toplamCiro, toplamIptal, masaList, paketList, masaCiro, paketCiro, kaynakGruplari };
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="adisyon-tooltip">
          <p className="tooltip-label">{label || payload[0]?.name}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}: {typeof entry.value === 'number' && entry.value > 100 ? formatAmount(entry.value) : entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const hasData = selectedSube && ((reportMode === 'daily' && selectedDate) || (reportMode === 'range' && startDate && endDate));

  return (
    <div className="adisyonlar-container">
      <div className="page-header-adisyon">
        <div className="header-content-adisyon">
          <div className="header-left">
            <span className="material-icons header-icon">receipt_long</span>
            <div>
              <h1>Adisyonlar</h1>
              <p>Şube bazlı adisyon listesi ve analiz</p>
            </div>
          </div>
        </div>
      </div>

      <div className="filter-section-adisyon">
        <div className="filter-row-adisyon">
          {currentUser?.role === 'sirket_yoneticisi' && (
            <div className="filter-group-adisyon">
              <label>Şube</label>
              <select value={selectedSube} onChange={e => setSelectedSube(e.target.value)}>
                <option value="">Şube Seçin</option>
                {subeler.map(s => (
                  <option key={s.id} value={s.rrc_restaurant_id || s.id}>
                    {s.ad || s.subeAdi || s.name || 'Şube ' + (s.rrc_restaurant_id || s.id)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="filter-group-adisyon">
            <label>Mod</label>
            <select value={reportMode} onChange={e => setReportMode(e.target.value)}>
              <option value="daily">Günlük</option>
              <option value="range">Tarih Aralığı</option>
            </select>
          </div>

          {reportMode === 'daily' ? (
            <>
              <div className="filter-group-adisyon">
                <label>Tarih</label>
                <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
              </div>
              <div className="filter-group-adisyon filter-toggle-group">
                <label className="toggle-label-adisyon">
                  <input type="checkbox" checked={useDailyTimeFilter} onChange={e => setUseDailyTimeFilter(e.target.checked)} />
                  <span className="toggle-switch-adisyon"></span>
                  <span>Saat Filtresi</span>
                </label>
              </div>
              {useDailyTimeFilter && (
                <>
                  <div className="filter-group-adisyon">
                    <label>Başlangıç Saati</label>
                    <input type="time" value={dailyStartTime} onChange={e => setDailyStartTime(e.target.value)} />
                  </div>
                  <div className="filter-group-adisyon">
                    <label>Bitiş Saati</label>
                    <input type="time" value={dailyEndTime} onChange={e => setDailyEndTime(e.target.value)} />
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <div className="filter-group-adisyon">
                <label>Başlangıç</label>
                <div className="date-time-pair">
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                  <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
                </div>
              </div>
              <div className="filter-group-adisyon">
                <label>Bitiş</label>
                <div className="date-time-pair">
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                  <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
                </div>
              </div>
            </>
          )}

          <div className="filter-group-adisyon filter-action-adisyon">
            <button className="btn-fetch-adisyon" onClick={() => setReportTrigger(prev => prev + 1)} disabled={loading || !selectedSube}>
              <span className="material-icons">search</span>
              Rapor Getir
            </button>
          </div>
        </div>

        {reportMode === 'range' && (
          <div className="quick-buttons-adisyon">
            <span className="quick-label-adisyon">Hızlı:</span>
            <button className="quick-btn-adisyon" onClick={() => {
              const t = new Date(); const y = new Date(t); y.setDate(y.getDate() - 1);
              setStartDate(y.toISOString().split('T')[0]); setEndDate(t.toISOString().split('T')[0]);
              setStartTime('08:00'); setEndTime('08:00');
            }}>Dün 08:00 - Bugün 08:00</button>
            <button className="quick-btn-adisyon" onClick={() => {
              const t = new Date().toISOString().split('T')[0];
              setStartDate(t); setEndDate(t); setStartTime('00:00'); setEndTime('23:59');
            }}>Bugün Tüm Gün</button>
            <button className="quick-btn-adisyon" onClick={() => {
              const y = new Date(); y.setDate(y.getDate() - 1); const ys = y.toISOString().split('T')[0];
              setStartDate(ys); setEndDate(ys); setStartTime('00:00'); setEndTime('23:59');
            }}>Dün Tüm Gün</button>
          </div>
        )}

        <div className="order-filter-adisyon">
          <span className="order-filter-label">Sipariş Tipi:</span>
          <div className="order-filter-buttons">
            {[
              { key: 'all', label: 'Tümü', icon: 'select_all' },
              { key: 'masa', label: 'Masa', icon: 'table_restaurant' },
              { key: 'online', label: 'Paket', icon: 'takeout_dining' },
            ].map(opt => (
              <button
                key={opt.key}
                className={'order-btn' + (orderTypeFilter === opt.key ? ' active' : '')}
                onClick={() => setOrderTypeFilter(opt.key)}
              >
                <span className="material-icons">{opt.icon}</span>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="msg-error"><span className="material-icons">error_outline</span><p>{error}</p></div>
      )}
      {success && (
        <div className="msg-success"><span className="material-icons">check_circle</span><p>{success}</p></div>
      )}

      {loading ? (
        <div className="loading-container-adisyon"><div className="loading-spinner-adisyon"></div><p>Yükleniyor...</p></div>
      ) : !hasData ? (
        <div className="empty-container-adisyon"><span className="material-icons">info</span><p>Lütfen şube ve tarih seçerek raporu getirin.</p></div>
      ) : adisyonlar.length === 0 ? (
        <div className="empty-container-adisyon"><span className="material-icons">receipt_long</span><p>Seçilen filtreler için adisyon bulunamadı.</p></div>
      ) : (
        <>
          {(() => {
            const stats = getStats();
            return (
              <>
                <div className="summary-cards-adisyon">
                  <div className="summary-card-adisyon">
                    <div className="card-icon-adisyon icon-blue"><span className="material-icons">receipt</span></div>
                    <div className="card-body-adisyon">
                      <span className="card-label-adisyon">Toplam Adisyon</span>
                      <span className="card-value-adisyon">{stats.active.length}</span>
                    </div>
                  </div>
                  <div className="summary-card-adisyon">
                    <div className="card-icon-adisyon icon-green"><span className="material-icons">payments</span></div>
                    <div className="card-body-adisyon">
                      <span className="card-label-adisyon">Toplam Ciro</span>
                      <span className="card-value-adisyon">{formatAmount(stats.toplamCiro)}</span>
                    </div>
                  </div>
                  <div className="summary-card-adisyon">
                    <div className="card-icon-adisyon icon-red"><span className="material-icons">cancel</span></div>
                    <div className="card-body-adisyon">
                      <span className="card-label-adisyon">İptal</span>
                      <span className="card-value-adisyon">{stats.canceled.length}</span>
                      <span className="card-sub-adisyon">{formatAmount(stats.toplamIptal)}</span>
                    </div>
                  </div>
                  <div className="summary-card-adisyon">
                    <div className="card-icon-adisyon icon-purple"><span className="material-icons">table_restaurant</span></div>
                    <div className="card-body-adisyon">
                      <span className="card-label-adisyon">Masa</span>
                      <span className="card-value-adisyon">{stats.masaList.length}</span>
                      <span className="card-sub-adisyon">{formatAmount(stats.masaCiro)}</span>
                    </div>
                  </div>
                  <div className="summary-card-adisyon">
                    <div className="card-icon-adisyon icon-orange"><span className="material-icons">takeout_dining</span></div>
                    <div className="card-body-adisyon">
                      <span className="card-label-adisyon">Paket</span>
                      <span className="card-value-adisyon">{stats.paketList.length}</span>
                      <span className="card-sub-adisyon">{formatAmount(stats.paketCiro)}</span>
                    </div>
                  </div>
                </div>

                {Object.keys(stats.kaynakGruplari).length > 0 && (
                  <div className="charts-grid-adisyon">
                    <div className="chart-card-adisyon">
                      <h3><span className="material-icons">donut_large</span> Sipariş Kaynağı — Ciro</h3>
                      {(() => {
                        const data = Object.entries(stats.kaynakGruplari)
                          .map(([name, d]) => ({ name, value: Number(d.ciro.toFixed(2)) }))
                          .sort((a, b) => b.value - a.value);
                        return (
                          <>
                            <ResponsiveContainer width="100%" height={280}>
                              <PieChart>
                                <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={3} dataKey="value"
                                  label={({ name, percent, value }) => name + ' ' + formatAmount(value) + ' (' + (percent * 100).toFixed(0) + '%)'}>
                                  {data.map((_, i) => <Cell key={'c-' + i} fill={COLORS[i % COLORS.length]} />)}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                              </PieChart>
                            </ResponsiveContainer>
                            <div className="pie-legend-adisyon">
                              {data.map((entry, i) => (
                                <div key={entry.name} className="legend-item-adisyon">
                                  <span className="legend-dot" style={{ background: COLORS[i % COLORS.length] }}></span>
                                  <span className="legend-name">{entry.name}</span>
                                  <span className="legend-value">{formatAmount(entry.value)}</span>
                                </div>
                              ))}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                    <div className="chart-card-adisyon">
                      <h3><span className="material-icons">bar_chart</span> Sipariş Kaynağı — Adet</h3>
                      {(() => {
                        const data = Object.entries(stats.kaynakGruplari)
                          .map(([name, d]) => ({ name, adet: d.adet }))
                          .sort((a, b) => b.adet - a.adet);
                        return (
                          <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={data}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                              <XAxis dataKey="name" tick={{ fill: '#475569', fontSize: 11 }} />
                              <YAxis tick={{ fill: '#475569', fontSize: 12 }} allowDecimals={false} />
                              <Tooltip />
                              <Bar dataKey="adet" name="Sipariş" radius={[6, 6, 0, 0]}>
                                {data.map((_, i) => <Cell key={'b-' + i} fill={COLORS[i % COLORS.length]} />)}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </>
            );
          })()}

          {filteredAdisyonlar.length > 0 && (
            <div className="pagination-adisyon">
              <span className="pagination-info-adisyon">
                {startIndex + 1}-{Math.min(endIndex, filteredAdisyonlar.length)} / {filteredAdisyonlar.length} adisyon
              </span>
              <div className="pagination-right-adisyon">
                <select value={itemsPerPage} onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}>
                  <option value={10}>10</option><option value={20}>20</option><option value={50}>50</option><option value={100}>100</option>
                </select>
                {totalPages > 1 && (
                  <div className="page-btns-adisyon">
                    <button disabled={currentPage === 1} onClick={() => handlePageChange(1)}><span className="material-icons">first_page</span></button>
                    <button disabled={currentPage === 1} onClick={() => handlePageChange(currentPage - 1)}><span className="material-icons">chevron_left</span></button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let p;
                      if (totalPages <= 5) p = i + 1;
                      else if (currentPage <= 3) p = i + 1;
                      else if (currentPage >= totalPages - 2) p = totalPages - 4 + i;
                      else p = currentPage - 2 + i;
                      return <button key={p} className={currentPage === p ? 'active' : ''} onClick={() => handlePageChange(p)}>{p}</button>;
                    })}
                    <button disabled={currentPage === totalPages} onClick={() => handlePageChange(currentPage + 1)}><span className="material-icons">chevron_right</span></button>
                    <button disabled={currentPage === totalPages} onClick={() => handlePageChange(totalPages)}><span className="material-icons">last_page</span></button>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="table-card-adisyon">
            <h3><span className="material-icons">list_alt</span> Adisyon Listesi ({filteredAdisyonlar.length})</h3>
            <div className="table-wrapper-adisyon">
              <table>
                <thead>
                  <tr>
                    <th>Adisyon No</th>
                    <th>Tarih</th>
                    <th>Kaynak</th>
                    <th>Durum</th>
                    <th className="text-right">Tutar</th>
                    <th className="text-center">Detay</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedAdisyonlar.length === 0 ? (
                    <tr><td colSpan={6} className="text-center">Kayıt bulunamadı</td></tr>
                  ) : paginatedAdisyonlar.map((a, i) => {
                    const durum = a._kaynak === 'masa'
                      ? getAdisyonDurum(a.ads_durum, a.durum)
                      : getAdisyonDurum(a.adisyon_durum, a.durum);
                    const tipText = getAdisyonTipi(a.siparisnerden);
                    const nerden = Number(a.siparisnerden) || 0;
                    const isMasa = nerden === 88;
                    return (
                      <tr key={a.id || i} className={isCanceled(a) ? 'row-canceled' : ''} onClick={() => showAdisyonDetail(a)} style={{ cursor: 'pointer' }}>
                        <td className="mono">{a.padsgnum || a.ads_no || a.adisyoncode || a.masaadi || a.id.slice(0, 8)}</td>
                        <td>{formatDate(a.acilis || a.tarih)}</td>
                        <td><span className={'badge ' + (isMasa ? 'badge-purple' : 'badge-blue')}>{tipText}</span></td>
                        <td><span className={'badge ' + durum.badge}>{durum.text}</span></td>
                        <td className="text-right bold">{formatAmount(getAdisyonTutar(a))}</td>
                        <td className="text-center">
                          <button className="detail-btn-adisyon" onClick={(e) => { e.stopPropagation(); showAdisyonDetail(a); }}>
                            <span className="material-icons">visibility</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <AdisyonDetailModal isOpen={isModalOpen} onClose={closeModal} adisyon={selectedAdisyon} masa={null} />
    </div>
  );
};

export default AdisyonlarPage;
