import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency, todayTR } from '../utils/dateUtils';
import {
  fetchKonsolideRapor,
  fetchMasalar
} from '../utils/reportService';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import './CiroRaporPage.css';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

const CiroRaporPage = () => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [subeler, setSubeler] = useState([]);
  const [rapor, setRapor] = useState(null);
  const [masaDurum, setMasaDurum] = useState(null);
  const [activeTab, setActiveTab] = useState('ozet'); // ozet | paket | masa | iptal | urun | masalar
  const [paketKaynak, setPaketKaynak] = useState('all'); // all | manuel | online | 1 | 2 | 5 | 8

  const KAYNAK_OPTIONS = [
    { key: 'all', label: 'Tümü', icon: 'select_all' },
    { key: 'manuel', label: 'Telefon Siparişi', icon: 'phone_in_talk' },
    { key: 'online', label: 'Online', icon: 'language' },
    { key: '1', label: 'Yemek Sepeti', icon: 'restaurant' },
    { key: '2', label: 'Getir', icon: 'pedal_bike' },
    { key: '5', label: 'Trendyol', icon: 'shopping_bag' },
    { key: '8', label: 'Migros Yemek', icon: 'local_grocery_store' },
  ];

  const today = new Date();
  const [filter, setFilter] = useState({
    mode: 'daily',
    date: todayTR(),
    startDate: todayTR(new Date(today.getTime() - 86400000)),
    endDate: todayTR(),
    startTime: '00:00',
    endTime: '23:59',
    subeId: currentUser?.role === 'sube_yoneticisi' ? (currentUser.rrc_restaurant_id || currentUser.subeId) : ''
  });

  // Şubeleri getir
  useEffect(() => {
    const fetchSubeler = async () => {
      if (currentUser?.role === 'sirket_yoneticisi') {
        try {
          const snapshot = await getDocs(query(collection(db, 'subeler')));
          const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          items.sort((a, b) => (a.ad || '').localeCompare(b.ad || ''));
          setSubeler(items);
        } catch (err) {
          console.error('Şubeler hatası:', err);
        }
      }
    };
    fetchSubeler();
  }, [currentUser]);

  const handleFetchReport = async () => {
    const rrcId = filter.subeId || currentUser?.rrc_restaurant_id || currentUser?.subeId;
    if (!rrcId) {
      setError('Lütfen bir şube seçin.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let startDate, endDate;
      if (filter.mode === 'daily') {
        startDate = new Date(filter.date + 'T' + filter.startTime + ':00');
        endDate = new Date(filter.date + 'T' + filter.endTime + ':59');
      } else {
        startDate = new Date(filter.startDate + 'T' + filter.startTime + ':00');
        endDate = new Date(filter.endDate + 'T' + filter.endTime + ':59');
      }

      const [konsolide, masalar] = await Promise.all([
        fetchKonsolideRapor(rrcId, startDate, endDate),
        fetchMasalar(rrcId)
      ]);

      setRapor(konsolide);
      setMasaDurum(masalar);
    } catch (err) {
      console.error('Rapor hatası:', err);
      setError('Rapor verileri alınırken hata oluştu: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const rrcId = filter.subeId || currentUser?.rrc_restaurant_id || currentUser?.subeId;
    if (rrcId) {
      handleFetchReport();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  // Masa ödeme tipleri pasta grafik verisi
  const getOdemeTipleriChartData = () => {
    if (!rapor?.masaCiro?.odemeTipleri) return [];
    return Object.entries(rapor.masaCiro.odemeTipleri)
      .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
      .sort((a, b) => b.value - a.value);
  };

  // Paket ödeme tipleri pasta grafik verisi
  const getPaketOdemeTipleriChartData = () => {
    if (!rapor?.paketCiro?.odemeTipleri) return [];
    return Object.entries(rapor.paketCiro.odemeTipleri)
      .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
      .sort((a, b) => b.value - a.value);
  };

  // Paket verisini kaynak filtresine göre filtrele
  const getFilteredPaketData = () => {
    if (!rapor?.paketCiro) return null;
    const allDocs = rapor.paketCiro.docs;
    const allIptal = rapor.paketCiro.iptalDocs;

    const filterByKaynak = (docs) => {
      if (paketKaynak === 'all') return docs;
      if (paketKaynak === 'manuel') return docs.filter(d => !d.siparisnerden || Number(d.siparisnerden) === 0);
      if (paketKaynak === 'online') return docs.filter(d => Number(d.siparisnerden) > 0);
      return docs.filter(d => Number(d.siparisnerden) === Number(paketKaynak));
    };

    const filteredDocs = filterByKaynak(allDocs);
    const filteredIptal = filterByKaynak(allIptal);
    const toplamCiro = filteredDocs.reduce((sum, d) => sum + (Number(d.atop) || 0), 0);
    const toplamIptal = filteredIptal.reduce((sum, d) => sum + (Number(d.atop) || 0), 0);

    const odemeTipleri = {};
    filteredDocs.forEach(d => {
      const tip = d.odemetipi || 'Diğer';
      if (!odemeTipleri[tip]) odemeTipleri[tip] = 0;
      odemeTipleri[tip] += Number(d.atop) || 0;
    });

    return {
      docs: filteredDocs,
      iptalDocs: filteredIptal,
      toplamCiro,
      toplamIptal,
      odemeTipleri,
      aktifSayisi: filteredDocs.length,
      iptalSayisi: filteredIptal.length
    };
  };

  const getFilteredPaketOdemeTipleriChartData = () => {
    const data = getFilteredPaketData();
    if (!data?.odemeTipleri) return [];
    return Object.entries(data.odemeTipleri)
      .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
      .sort((a, b) => b.value - a.value);
  };

  // Ciro karşılaştırma bar chart
  const getCiroChartData = () => {
    if (!rapor) return [];
    return [
      { name: 'Paket Ciro', tutar: rapor.paketCiro.toplamCiro },
      { name: 'Masa Ciro', tutar: rapor.masaCiro.toplamCiro },
      { name: 'Paket İptal', tutar: rapor.paketIptal.toplamIptal },
      { name: 'Masa İptal', tutar: rapor.masaIptal.toplamIptal }
    ];
  };

  // Top 10 ürün bar chart
  const getTopUrunlerChartData = () => {
    if (!rapor?.urunSatis?.birlesikListe) return [];
    return rapor.urunSatis.birlesikListe.slice(0, 10);
  };

  // Masa durumları pasta grafik
  const getMasaDurumChartData = () => {
    if (!masaDurum?.durumSayilari) return [];
    return Object.entries(masaDurum.durumSayilari)
      .filter(([_, val]) => val > 0)
      .map(([name, value]) => ({ name, value }));
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip">
          <p className="tooltip-label">{label || payload[0]?.name}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}: {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const MiktarTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip">
          <p className="tooltip-label">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}: {Number(entry.value).toFixed(1)} adet
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="ciro-rapor-container">
      {/* HEADER */}
      <div className="page-header">
        <div className="header-content">
          <div className="header-left">
            <span className="material-icons header-icon">analytics</span>
            <div>
              <h1>Ciro & Raporlama Paneli</h1>
              <p>Paket / Masa ciro, iptaller, ürün satış analizi</p>
            </div>
          </div>
        </div>
      </div>

      {/* FİLTRELER */}
      <div className="filter-section">
        <div className="filter-row">
          {currentUser?.role === 'sirket_yoneticisi' && (
            <div className="filter-group">
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

          <div className="filter-group">
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
            <div className="filter-group">
              <label>Tarih</label>
              <input
                type="date"
                value={filter.date}
                onChange={e => setFilter(f => ({ ...f, date: e.target.value }))}
              />
            </div>
          ) : (
            <>
              <div className="filter-group">
                <label>Başlangıç</label>
                <input
                  type="date"
                  value={filter.startDate}
                  onChange={e => setFilter(f => ({ ...f, startDate: e.target.value }))}
                />
              </div>
              <div className="filter-group">
                <label>Bitiş</label>
                <input
                  type="date"
                  value={filter.endDate}
                  onChange={e => setFilter(f => ({ ...f, endDate: e.target.value }))}
                />
              </div>
            </>
          )}

          <div className="filter-group">
            <label>Saat Başlangıç</label>
            <input
              type="time"
              value={filter.startTime}
              onChange={e => setFilter(f => ({ ...f, startTime: e.target.value }))}
            />
          </div>
          <div className="filter-group">
            <label>Saat Bitiş</label>
            <input
              type="time"
              value={filter.endTime}
              onChange={e => setFilter(f => ({ ...f, endTime: e.target.value }))}
            />
          </div>

          <div className="filter-group filter-action">
            <button className="btn-fetch" onClick={handleFetchReport} disabled={loading}>
              <span className="material-icons">search</span>
              Rapor Getir
            </button>
          </div>
        </div>
      </div>

      {/* TAB NAVİGASYON */}
      <div className="tab-nav">
        {[
          { key: 'ozet', label: 'Genel Özet', icon: 'dashboard' },
          { key: 'paket', label: 'Paket Ciro', icon: 'delivery_dining' },
          { key: 'masa', label: 'Masa Ciro', icon: 'table_restaurant' },
          { key: 'iptal', label: 'İptaller', icon: 'cancel' },
          { key: 'urun', label: 'Ürün Satış', icon: 'inventory' },
          { key: 'masalar', label: 'Masalar', icon: 'grid_view' },
        ].map(tab => (
          <button
            key={tab.key}
            className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            <span className="material-icons">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* İÇERİK */}
      {loading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Rapor verileri yükleniyor...</p>
        </div>
      ) : error ? (
        <div className="error-container">
          <span className="material-icons">error_outline</span>
          <p>{error}</p>
        </div>
      ) : !rapor ? (
        <div className="empty-container">
          <span className="material-icons">info</span>
          <p>Lütfen bir şube seçin ve raporu getirin.</p>
        </div>
      ) : (
        <>
          {/* ══════ GENEL ÖZET TAB ══════ */}
          {activeTab === 'ozet' && (
            <div className="tab-content">
              {/* Özet Kartları */}
              <div className="summary-cards">
                <div className="summary-card card-green">
                  <div className="card-icon"><span className="material-icons">attach_money</span></div>
                  <div className="card-body">
                    <span className="card-label">Toplam Ciro</span>
                    <span className="card-value">{formatCurrency(rapor.toplamCiro)}</span>
                  </div>
                </div>
                <div className="summary-card card-blue">
                  <div className="card-icon"><span className="material-icons">delivery_dining</span></div>
                  <div className="card-body">
                    <span className="card-label">Paket Ciro</span>
                    <span className="card-value">{formatCurrency(rapor.paketCiro.toplamCiro)}</span>
                    <span className="card-sub">{rapor.paketCiro.aktifSayisi} sipariş</span>
                  </div>
                </div>
                <div className="summary-card card-purple">
                  <div className="card-icon"><span className="material-icons">table_restaurant</span></div>
                  <div className="card-body">
                    <span className="card-label">Masa Ciro</span>
                    <span className="card-value">{formatCurrency(rapor.masaCiro.toplamCiro)}</span>
                    <span className="card-sub">{rapor.masaCiro.toplam} ödeme</span>
                  </div>
                </div>
                <div className="summary-card card-red">
                  <div className="card-icon"><span className="material-icons">cancel</span></div>
                  <div className="card-body">
                    <span className="card-label">Toplam İptal</span>
                    <span className="card-value">{formatCurrency(rapor.toplamIptal)}</span>
                    <span className="card-sub">
                      P: {rapor.paketIptal.toplam} + M: {rapor.masaIptal.toplam}
                    </span>
                  </div>
                </div>

                <div className="summary-card card-orange">
                  <div className="card-icon"><span className="material-icons">inventory</span></div>
                  <div className="card-body">
                    <span className="card-label">Satılan Ürün</span>
                    <span className="card-value">{rapor.urunSatis.toplamMiktar.toFixed(0)} Adet</span>
                    <span className="card-sub">{rapor.urunSatis.birlesikListe.length} çeşit</span>
                  </div>
                </div>
              </div>

              {/* Grafikler */}
              <div className="charts-grid">
                <div className="chart-card">
                  <h3><span className="material-icons">bar_chart</span> Ciro & İptal Karşılaştırması</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={getCiroChartData()}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis dataKey="name" tick={{ fill: '#475569', fontSize: 12 }} />
                      <YAxis tick={{ fill: '#475569', fontSize: 12 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="tutar" name="Tutar" radius={[6, 6, 0, 0]}>
                        {getCiroChartData().map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="chart-card">
                  <h3><span className="material-icons">pie_chart</span> Paket Ödeme Tipleri</h3>
                  {getPaketOdemeTipleriChartData().length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={getPaketOdemeTipleriChartData()}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={3}
                            dataKey="value"
                            label={({ name, percent, value }) => `${name} ${formatCurrency(value)} (${(percent * 100).toFixed(0)}%)`}
                          >
                            {getPaketOdemeTipleriChartData().map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip content={<CustomTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="pie-legend-list">
                        {getPaketOdemeTipleriChartData().map((entry, index) => (
                          <div key={entry.name} className="pie-legend-item">
                            <span className="pie-legend-dot" style={{ background: COLORS[index % COLORS.length] }}></span>
                            <span className="pie-legend-name">{entry.name}</span>
                            <span className="pie-legend-value">{formatCurrency(entry.value)}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="no-data">Paket ödeme verisi bulunamadı</div>
                  )}
                </div>

                <div className="chart-card">
                  <h3><span className="material-icons">pie_chart</span> Masa Ödeme Tipleri</h3>
                  {getOdemeTipleriChartData().length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={getOdemeTipleriChartData()}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={3}
                            dataKey="value"
                            label={({ name, percent, value }) => `${name} ${formatCurrency(value)} (${(percent * 100).toFixed(0)}%)`}
                          >
                            {getOdemeTipleriChartData().map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip content={<CustomTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="pie-legend-list">
                        {getOdemeTipleriChartData().map((entry, index) => (
                          <div key={entry.name} className="pie-legend-item">
                            <span className="pie-legend-dot" style={{ background: COLORS[index % COLORS.length] }}></span>
                            <span className="pie-legend-name">{entry.name}</span>
                            <span className="pie-legend-value">{formatCurrency(entry.value)}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="no-data">Masa ödeme verisi bulunamadı</div>
                  )}
                </div>

                <div className="chart-card full-width">
                  <h3><span className="material-icons">leaderboard</span> En Çok Satan 10 Ürün</h3>
                  {getTopUrunlerChartData().length > 0 ? (
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart data={getTopUrunlerChartData()} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                        <XAxis type="number" tick={{ fill: '#475569', fontSize: 12 }} />
                        <YAxis dataKey="urunadi" type="category" width={150} tick={{ fill: '#475569', fontSize: 11 }} />
                        <Tooltip content={<MiktarTooltip />} />
                        <Legend />
                        <Bar dataKey="paketMiktar" name="Paket" stackId="a" fill="#3B82F6" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="salonMiktar" name="Salon" stackId="a" fill="#10B981" radius={[0, 6, 6, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="no-data">Ürün satış verisi bulunamadı</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ══════ PAKET CİRO TAB ══════ */}
          {activeTab === 'paket' && (
            <div className="tab-content">
              {/* Kaynak Filtre Butonları */}
              <div className="kaynak-filter">
                <span className="kaynak-filter-label">Sipariş Kaynağı:</span>
                <div className="kaynak-filter-buttons">
                  {KAYNAK_OPTIONS.map(opt => (
                    <button
                      key={opt.key}
                      className={`kaynak-btn ${paketKaynak === opt.key ? 'active' : ''}`}
                      onClick={() => setPaketKaynak(opt.key)}
                    >
                      <span className="material-icons">{opt.icon}</span>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Kaynak Kırılım Kartları */}
              {rapor.paketCiro.kaynakGruplari && Object.keys(rapor.paketCiro.kaynakGruplari).length > 1 && paketKaynak === 'all' && (
                <div className="kaynak-breakdown">
                  {Object.entries(rapor.paketCiro.kaynakGruplari).map(([kaynak, data], i) => (
                    <div key={kaynak} className="kaynak-card" style={{ borderLeftColor: COLORS[i % COLORS.length] }}>
                      <span className="kaynak-name">{kaynak}</span>
                      <span className="kaynak-ciro">{formatCurrency(data.ciro)}</span>
                      <span className="kaynak-adet">{data.adet} sipariş</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Sipariş Kaynağı Dağılımı Grafiği */}
              {rapor.paketCiro.kaynakGruplari && Object.keys(rapor.paketCiro.kaynakGruplari).length > 0 && (
                <div className="charts-grid">
                  <div className="chart-card">
                    <h3><span className="material-icons">donut_large</span> Sipariş Kaynağı — Ciro Dağılımı</h3>
                    {(() => {
                      const kaynakCiroData = Object.entries(rapor.paketCiro.kaynakGruplari)
                        .map(([name, d]) => ({ name, value: Number(d.ciro.toFixed(2)) }))
                        .sort((a, b) => b.value - a.value);
                      return (
                        <>
                          <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                              <Pie
                                data={kaynakCiroData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={100}
                                paddingAngle={3}
                                dataKey="value"
                                label={({ name, percent, value }) => `${name} ${formatCurrency(value)} (${(percent * 100).toFixed(0)}%)`}
                              >
                                {kaynakCiroData.map((_, index) => (
                                  <Cell key={`kc-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip content={<CustomTooltip />} />
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="pie-legend-list">
                            {kaynakCiroData.map((entry, index) => (
                              <div key={entry.name} className="pie-legend-item">
                                <span className="pie-legend-dot" style={{ background: COLORS[index % COLORS.length] }}></span>
                                <span className="pie-legend-name">{entry.name}</span>
                                <span className="pie-legend-value">{formatCurrency(entry.value)}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                  <div className="chart-card">
                    <h3><span className="material-icons">bar_chart</span> Sipariş Kaynağı — Sipariş Adedi</h3>
                    {(() => {
                      const kaynakAdetData = Object.entries(rapor.paketCiro.kaynakGruplari)
                        .map(([name, d]) => ({ name, adet: d.adet }))
                        .sort((a, b) => b.adet - a.adet);
                      return (
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={kaynakAdetData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                            <XAxis dataKey="name" tick={{ fill: '#475569', fontSize: 11 }} />
                            <YAxis tick={{ fill: '#475569', fontSize: 12 }} allowDecimals={false} />
                            <Tooltip content={<MiktarTooltip />} />
                            <Bar dataKey="adet" name="Sipariş" radius={[6, 6, 0, 0]}>
                              {kaynakAdetData.map((_, index) => (
                                <Cell key={`ka-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      );
                    })()}
                  </div>
                </div>
              )}

              {(() => {
                const fp = getFilteredPaketData();
                if (!fp) return null;
                return (
                  <>
                    <div className="summary-cards">
                      <div className="summary-card card-blue">
                        <div className="card-icon"><span className="material-icons">local_shipping</span></div>
                        <div className="card-body">
                          <span className="card-label">Paket Toplam Ciro</span>
                          <span className="card-value">{formatCurrency(fp.toplamCiro)}</span>
                        </div>
                      </div>
                      <div className="summary-card card-green">
                        <div className="card-icon"><span className="material-icons">receipt</span></div>
                        <div className="card-body">
                          <span className="card-label">Aktif Sipariş</span>
                          <span className="card-value">{fp.aktifSayisi}</span>
                        </div>
                      </div>
                      <div className="summary-card card-red">
                        <div className="card-icon"><span className="material-icons">block</span></div>
                        <div className="card-body">
                          <span className="card-label">İptal Edilen</span>
                          <span className="card-value">{fp.iptalSayisi}</span>
                          <span className="card-sub">{formatCurrency(fp.toplamIptal)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Paket Ödeme Tipleri Kartları */}
                    {fp.odemeTipleri && Object.keys(fp.odemeTipleri).length > 0 && (
                      <div className="payment-types-grid">
                        {Object.entries(fp.odemeTipleri).map(([tip, tutar], i) => (
                          <div key={tip} className="payment-type-card" style={{ borderColor: COLORS[i % COLORS.length] }}>
                            <span className="payment-label">{tip}</span>
                            <span className="payment-value">{formatCurrency(tutar)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Paket Ödeme Tipi Grafiği */}
                    {getFilteredPaketOdemeTipleriChartData().length > 0 && (
                      <div className="chart-card">
                        <h3><span className="material-icons">pie_chart</span> Paket Ödeme Tipi Dağılımı</h3>
                        <ResponsiveContainer width="100%" height={350}>
                          <PieChart>
                            <Pie
                              data={getFilteredPaketOdemeTipleriChartData()}
                              cx="50%"
                              cy="50%"
                              innerRadius={70}
                              outerRadius={120}
                              paddingAngle={3}
                              dataKey="value"
                              label={({ name, percent, value }) => `${name} ${formatCurrency(value)} (${(percent * 100).toFixed(0)}%)`}
                            >
                              {getFilteredPaketOdemeTipleriChartData().map((_, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="pie-legend-list">
                          {getFilteredPaketOdemeTipleriChartData().map((entry, index) => (
                            <div key={entry.name} className="pie-legend-item">
                              <span className="pie-legend-dot" style={{ background: COLORS[index % COLORS.length] }}></span>
                              <span className="pie-legend-name">{entry.name}</span>
                              <span className="pie-legend-value">{formatCurrency(entry.value)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Paket Sipariş Tablosu */}
                    <div className="table-card">
                      <h3><span className="material-icons">list_alt</span> Paket Siparişleri ({fp.docs.length})</h3>
                      <div className="table-wrapper">
                        <table>
                          <thead>
                            <tr>
                              <th>Adisyon Kodu</th>
                              <th>Tarih</th>
                              <th>Kaynak</th>
                              <th>Müşteri</th>
                              <th>Motorcu</th>
                              <th>Durum</th>
                              <th>Ödeme Tipi</th>
                              <th className="text-right">Tutar</th>
                            </tr>
                          </thead>
                          <tbody>
                            {fp.docs.length === 0 ? (
                              <tr><td colSpan={8} className="text-center">Kayıt bulunamadı</td></tr>
                            ) : fp.docs.map((d, i) => {
                              const nerden = Number(d.siparisnerden) || 0;
                              const kaynakLabel = nerden === 0 ? 'Telefon Siparişi' : ({ 1: 'Yemek Sepeti', 2: 'Getir', 5: 'Trendyol', 8: 'Migros Yemek' }[nerden] || `Online (${nerden})`);
                              return (
                                <tr key={d.id || i}>
                                  <td className="mono">{d.padsgnum || '-'}</td>
                                  <td>{d.acilis ? new Date(typeof d.acilis === 'object' && d.acilis.toDate ? d.acilis.toDate() : d.acilis).toLocaleString('tr-TR') : '-'}</td>
                                  <td><span className={`badge ${nerden > 0 ? 'badge-blue' : 'badge-gray'}`}>{kaynakLabel}</span></td>
                                  <td>{d.kisikod || '-'}</td>
                                  <td>{d.motorcu || '-'}</td>
                                  <td><span className="badge badge-green">{d.durum || '-'}</span></td>
                                  <td>{d.odemetipi || '-'}</td>
                                  <td className="text-right bold">{formatCurrency(d.atop)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* ══════ MASA CİRO TAB ══════ */}
          {activeTab === 'masa' && (
            <div className="tab-content">
              <div className="summary-cards">
                <div className="summary-card card-purple">
                  <div className="card-icon"><span className="material-icons">table_restaurant</span></div>
                  <div className="card-body">
                    <span className="card-label">Masa Toplam Ciro</span>
                    <span className="card-value">{formatCurrency(rapor.masaCiro.toplamCiro)}</span>
                  </div>
                </div>
                <div className="summary-card card-green">
                  <div className="card-icon"><span className="material-icons">payments</span></div>
                  <div className="card-body">
                    <span className="card-label">Toplam Ödeme</span>
                    <span className="card-value">{rapor.masaCiro.toplam}</span>
                  </div>
                </div>
              </div>

              {/* Ödeme Tipleri Kartları */}
              {Object.keys(rapor.masaCiro.odemeTipleri).length > 0 && (
                <div className="payment-types-grid">
                  {Object.entries(rapor.masaCiro.odemeTipleri).map(([tip, tutar], i) => (
                    <div key={tip} className="payment-type-card" style={{ borderColor: COLORS[i % COLORS.length] }}>
                      <span className="payment-label">{tip}</span>
                      <span className="payment-value">{formatCurrency(tutar)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Ödeme Grafik */}
              {getOdemeTipleriChartData().length > 0 && (
                <div className="chart-card">
                  <h3><span className="material-icons">pie_chart</span> Ödeme Tipi Dağılımı</h3>
                  <ResponsiveContainer width="100%" height={350}>
                    <PieChart>
                      <Pie
                        data={getOdemeTipleriChartData()}
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={120}
                        paddingAngle={3}
                        dataKey="value"
                        label={({ name, percent, value }) => `${name} ${formatCurrency(value)} (${(percent * 100).toFixed(0)}%)`}
                      >
                        {getOdemeTipleriChartData().map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pie-legend-list">
                    {getOdemeTipleriChartData().map((entry, index) => (
                      <div key={entry.name} className="pie-legend-item">
                        <span className="pie-legend-dot" style={{ background: COLORS[index % COLORS.length] }}></span>
                        <span className="pie-legend-name">{entry.name}</span>
                        <span className="pie-legend-value">{formatCurrency(entry.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Masa Ödeme Tablosu */}
              <div className="table-card">
                <h3><span className="material-icons">list_alt</span> Masa Ödemeleri ({rapor.masaCiro.docs.length})</h3>
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Adisyon Kodu</th>
                        <th>Tarih</th>
                        <th>Masa No</th>
                        <th>Ödeme Şekli</th>
                        <th className="text-right">Tutar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rapor.masaCiro.docs.length === 0 ? (
                        <tr><td colSpan={5} className="text-center">Kayıt bulunamadı</td></tr>
                      ) : rapor.masaCiro.docs.map((d, i) => (
                        <tr key={d.id || i}>
                          <td className="mono">{d.ads_code || '-'}</td>
                          <td>{d.tarih ? new Date(typeof d.tarih === 'object' && d.tarih.toDate ? d.tarih.toDate() : d.tarih).toLocaleString('tr-TR') : '-'}</td>
                          <td>{d.masa_no || '-'}</td>
                          <td><span className="badge badge-blue">{d.odemesekli || '-'}</span></td>
                          <td className="text-right bold">{formatCurrency(d.tutar)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ══════ İPTALLER TAB ══════ */}
          {activeTab === 'iptal' && (
            <div className="tab-content">
              <div className="summary-cards">
                <div className="summary-card card-red">
                  <div className="card-icon"><span className="material-icons">cancel</span></div>
                  <div className="card-body">
                    <span className="card-label">Toplam İptal Tutar</span>
                    <span className="card-value">{formatCurrency(rapor.toplamIptal)}</span>
                  </div>
                </div>
                <div className="summary-card card-orange">
                  <div className="card-icon"><span className="material-icons">delivery_dining</span></div>
                  <div className="card-body">
                    <span className="card-label">Paket İptal</span>
                    <span className="card-value">{formatCurrency(rapor.paketIptal.toplamIptal)}</span>
                    <span className="card-sub">{rapor.paketIptal.toplam} adet</span>
                  </div>
                </div>
                <div className="summary-card card-red">
                  <div className="card-icon"><span className="material-icons">table_restaurant</span></div>
                  <div className="card-body">
                    <span className="card-label">Masa İptal</span>
                    <span className="card-value">{formatCurrency(rapor.masaIptal.toplamIptal)}</span>
                    <span className="card-sub">{rapor.masaIptal.toplam} adet</span>
                  </div>
                </div>
              </div>

              {/* İptal Nedenleri */}
              {Object.keys(rapor.paketIptal.iptalNedenleri).length > 0 && (
                <div className="table-card">
                  <h3><span className="material-icons">report_problem</span> Paket İptal Nedenleri</h3>
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>İptal Nedeni</th>
                          <th className="text-center">Adet</th>
                          <th className="text-right">Tutar</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(rapor.paketIptal.iptalNedenleri).map(([neden, val]) => (
                          <tr key={neden}>
                            <td>{neden}</td>
                            <td className="text-center">{val.count}</td>
                            <td className="text-right bold">{formatCurrency(val.tutar)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Paket İptal Detay Tablosu */}
              <div className="table-card">
                <h3><span className="material-icons">list_alt</span> Paket İptal Detayları ({rapor.paketIptal.docs.length})</h3>
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Adisyon Kodu</th>
                        <th>İptal Tarihi</th>
                        <th>Müşteri</th>
                        <th>Motorcu</th>
                        <th>İptal Nedeni</th>
                        <th className="text-right">Tutar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rapor.paketIptal.docs.length === 0 ? (
                        <tr><td colSpan={6} className="text-center">Kayıt bulunamadı</td></tr>
                      ) : rapor.paketIptal.docs.map((d, i) => (
                        <tr key={d.id || i}>
                          <td className="mono">{d.padsgnum || '-'}</td>
                          <td>{d.iptaltarihi ? new Date(typeof d.iptaltarihi === 'object' && d.iptaltarihi.toDate ? d.iptaltarihi.toDate() : d.iptaltarihi).toLocaleString('tr-TR') : '-'}</td>
                          <td>{d.kisikod || '-'}</td>
                          <td>{d.motorcu || '-'}</td>
                          <td>{d.iptalneden || '-'}</td>
                          <td className="text-right bold">{formatCurrency(d.atop)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Masa Ödeme İptalleri */}
              {Object.keys(rapor.masaIptal.odemeTipleri).length > 0 && (
                <div className="table-card">
                  <h3><span className="material-icons">credit_card_off</span> Masa İptal - Ödeme Tiplerine Göre</h3>
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Ödeme Şekli</th>
                          <th className="text-center">Adet</th>
                          <th className="text-right">Tutar</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(rapor.masaIptal.odemeTipleri).map(([tip, val]) => (
                          <tr key={tip}>
                            <td>{tip}</td>
                            <td className="text-center">{val.count}</td>
                            <td className="text-right bold">{formatCurrency(val.tutar)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Masa İptal Detay */}
              <div className="table-card">
                <h3><span className="material-icons">list_alt</span> Masa İptal Detayları ({rapor.masaIptal.docs.length})</h3>
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Adisyon Kodu</th>
                        <th>Tarih</th>
                        <th>Masa No</th>
                        <th>Ödeme Şekli</th>
                        <th className="text-right">Tutar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rapor.masaIptal.docs.length === 0 ? (
                        <tr><td colSpan={5} className="text-center">Kayıt bulunamadı</td></tr>
                      ) : rapor.masaIptal.docs.map((d, i) => (
                        <tr key={d.id || i}>
                          <td className="mono">{d.ads_code || '-'}</td>
                          <td>{d.tarih ? new Date(typeof d.tarih === 'object' && d.tarih.toDate ? d.tarih.toDate() : d.tarih).toLocaleString('tr-TR') : '-'}</td>
                          <td>{d.masa_no || '-'}</td>
                          <td><span className="badge badge-orange">{d.odemesekli || '-'}</span></td>
                          <td className="text-right bold">{formatCurrency(d.tutar)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ══════ ÜRÜN SATIŞ TAB ══════ */}
          {activeTab === 'urun' && (
            <div className="tab-content">
              <div className="summary-cards">
                <div className="summary-card card-teal">
                  <div className="card-icon"><span className="material-icons">shopping_cart</span></div>
                  <div className="card-body">
                    <span className="card-label">Toplam Satış</span>
                    <span className="card-value">{rapor.urunSatis.toplamMiktar.toFixed(0)} Adet</span>
                    <span className="card-sub">{rapor.urunSatis.birlesikListe.length} çeşit ürün</span>
                  </div>
                </div>
                <div className="summary-card card-blue">
                  <div className="card-icon"><span className="material-icons">delivery_dining</span></div>
                  <div className="card-body">
                    <span className="card-label">Paket Ürün Satış</span>
                    <span className="card-value">{rapor.urunSatis.paket.toplamMiktar.toFixed(0)} Adet</span>
                    <span className="card-sub">{rapor.urunSatis.paket.urunListesi.length} çeşit</span>
                  </div>
                </div>
                <div className="summary-card card-green">
                  <div className="card-icon"><span className="material-icons">table_restaurant</span></div>
                  <div className="card-body">
                    <span className="card-label">Salon Ürün Satış</span>
                    <span className="card-value">{rapor.urunSatis.salon.toplamMiktar.toFixed(0)} Adet</span>
                    <span className="card-sub">{rapor.urunSatis.salon.urunListesi.length} çeşit</span>
                  </div>
                </div>
              </div>

              {/* Top 10 Ürün Grafiği */}
              {getTopUrunlerChartData().length > 0 && (
                <div className="chart-card full-width">
                  <h3><span className="material-icons">leaderboard</span> En Çok Satan 10 Ürün (Paket + Salon)</h3>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={getTopUrunlerChartData()} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis type="number" tick={{ fill: '#475569', fontSize: 12 }} />
                      <YAxis dataKey="urunadi" type="category" width={160} tick={{ fill: '#475569', fontSize: 11 }} />
                      <Tooltip content={<MiktarTooltip />} />
                      <Legend />
                      <Bar dataKey="paketMiktar" name="Paket" stackId="a" fill="#3B82F6" />
                      <Bar dataKey="salonMiktar" name="Salon" stackId="a" fill="#10B981" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Birleşik Ürün Tablosu */}
              <div className="table-card">
                <h3><span className="material-icons">inventory</span> Tüm Ürün Satış Adetleri</h3>
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Ürün Adı</th>
                        <th className="text-center">Paket</th>
                        <th className="text-center">Salon</th>
                        <th className="text-center">Toplam</th>
                        <th className="text-right">Tahmini Ciro</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rapor.urunSatis.birlesikListe.length === 0 ? (
                        <tr><td colSpan={6} className="text-center">Kayıt bulunamadı</td></tr>
                      ) : rapor.urunSatis.birlesikListe.map((u, i) => (
                        <tr key={u.urunadi}>
                          <td>{i + 1}</td>
                          <td className="bold">{u.urunadi}</td>
                          <td className="text-center">{u.paketMiktar.toFixed(0)}</td>
                          <td className="text-center">{u.salonMiktar.toFixed(0)}</td>
                          <td className="text-center bold">{u.miktar.toFixed(0)}</td>
                          <td className="text-right">{formatCurrency(u.ciro)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ══════ MASALAR TAB ══════ */}
          {activeTab === 'masalar' && (
            <div className="tab-content">
              {masaDurum && (
                <>
                  <div className="summary-cards">
                    <div className="summary-card card-blue">
                      <div className="card-icon"><span className="material-icons">grid_view</span></div>
                      <div className="card-body">
                        <span className="card-label">Toplam Masa</span>
                        <span className="card-value">{masaDurum.toplam}</span>
                      </div>
                    </div>
                    <div className="summary-card card-green">
                      <div className="card-icon"><span className="material-icons">check_circle</span></div>
                      <div className="card-body">
                        <span className="card-label">Boş</span>
                        <span className="card-value">{masaDurum.durumSayilari['Boş'] || 0}</span>
                      </div>
                    </div>
                    <div className="summary-card card-red">
                      <div className="card-icon"><span className="material-icons">people</span></div>
                      <div className="card-body">
                        <span className="card-label">Dolu</span>
                        <span className="card-value">{masaDurum.durumSayilari['Dolu'] || 0}</span>
                      </div>
                    </div>
                    <div className="summary-card card-orange">
                      <div className="card-icon"><span className="material-icons">event</span></div>
                      <div className="card-body">
                        <span className="card-label">Rezerve</span>
                        <span className="card-value">{masaDurum.durumSayilari['Rezerve'] || 0}</span>
                      </div>
                    </div>
                  </div>

                  {/* Masa Durumu Grafiği */}
                  {getMasaDurumChartData().length > 0 && (
                    <div className="chart-card">
                      <h3><span className="material-icons">donut_large</span> Masa Durumu Dağılımı</h3>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={getMasaDurumChartData()}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={5}
                            dataKey="value"
                            label={({ name, value }) => `${name}: ${value}`}
                          >
                            <Cell fill="#10B981" />
                            <Cell fill="#EF4444" />
                            <Cell fill="#F59E0B" />
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Masa Grid */}
                  <div className="table-card">
                    <h3><span className="material-icons">table_restaurant</span> Masa Listesi</h3>
                    <div className="masa-grid">
                      {masaDurum.docs.map((m) => {
                        const durumMap = { 0: 'bos', 1: 'dolu', 2: 'rezerve' };
                        const durumText = { 0: 'Boş', 1: 'Dolu', 2: 'Rezerve' };
                        return (
                          <div key={m.id} className={`masa-card masa-${durumMap[m.durumid] || 'bos'}`}>
                            <span className="masa-name">{m.masaadi || `Masa ${m.idtbl_masalar}`}</span>
                            <span className="masa-status">{durumText[m.durumid] || 'Bilinmiyor'}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CiroRaporPage;
