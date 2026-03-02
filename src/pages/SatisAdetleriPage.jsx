import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency } from '../utils/dateUtils';
import { fetchBirlesikUrunSatislari } from '../utils/reportService';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer
} from 'recharts';
import './SatisAdetleriPage.css';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

const SatisAdetleriPage = () => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [subeler, setSubeler] = useState([]);
  const [data, setData] = useState(null); // fetchBirlesikUrunSatislari sonucu
  const [filterKaynak, setFilterKaynak] = useState('all'); // all | paket | salon

  const today = new Date();
  const [filter, setFilter] = useState({
    mode: 'daily',
    date: today.toISOString().split('T')[0],
    startDate: new Date(today.getTime() - 86400000).toISOString().split('T')[0],
    endDate: today.toISOString().split('T')[0],
    subeId: currentUser?.role === 'sube_yoneticisi' ? (currentUser.rrc_restaurant_id || currentUser.subeId) : ''
  });

  // Şubeleri getir
  useEffect(() => {
    const fetchSubeler = async () => {
      if (currentUser?.role === 'sirket_yoneticisi') {
        const snapshot = await getDocs(query(collection(db, 'subeler')));
        const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        list.sort((a, b) => (a.subeAdi || '').localeCompare(b.subeAdi || ''));
        setSubeler(list);
      } else if (currentUser?.subeId) {
        const snapshot = await getDocs(query(collection(db, 'subeler'), where('__name__', '==', currentUser.subeId)));
        const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setSubeler(list);
        if (list.length > 0 && !filter.subeId) {
          setFilter(f => ({ ...f, subeId: list[0].rrc_restaurant_id || list[0].id }));
        }
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

    try {
      let startDate, endDate;
      if (filter.mode === 'daily') {
        startDate = new Date(filter.date + 'T00:00:00');
        endDate = new Date(filter.date + 'T23:59:59');
      } else {
        startDate = new Date(filter.startDate + 'T00:00:00');
        endDate = new Date(filter.endDate + 'T23:59:59');
      }

      const result = await fetchBirlesikUrunSatislari(rrcId, startDate, endDate);
      setData(result);
    } catch (err) {
      setError('Satış verileri alınırken hata: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // İlk yüklemede otomatik rapor getir
  useEffect(() => {
    const rrcId = filter.subeId || currentUser?.rrc_restaurant_id || currentUser?.subeId;
    if (rrcId) handleFetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  // Filtrelenmiş liste
  const getFilteredList = () => {
    if (!data) return [];
    if (filterKaynak === 'paket') {
      return data.paket.urunListesi.map(u => ({ ...u, paketMiktar: u.miktar, salonMiktar: 0 }));
    }
    if (filterKaynak === 'salon') {
      return data.salon.urunListesi.map(u => ({ ...u, paketMiktar: 0, salonMiktar: u.miktar }));
    }
    return data.birlesikListe;
  };

  const filteredList = getFilteredList();

  // İstatistikler
  const stats = data ? {
    cesit: filteredList.length,
    toplamMiktar: filteredList.reduce((s, u) => s + u.miktar, 0),
    toplamCiro: filteredList.reduce((s, u) => s + u.ciro, 0),
    paketMiktar: data.paket.toplamMiktar,
    salonMiktar: data.salon.toplamMiktar,
  } : null;

  // Top 10 bar chart
  const barData = filteredList.slice(0, 10).map(u => ({
    name: u.urunadi.length > 18 ? u.urunadi.substring(0, 18) + '...' : u.urunadi,
    Adet: u.miktar,
    Ciro: Number(u.ciro.toFixed(2)),
  }));

  // Kaynak dağılım pie
  const kaynakPie = data ? [
    { name: 'Paket', value: data.paket.toplamMiktar, color: '#3B82F6' },
    { name: 'Salon', value: data.salon.toplamMiktar, color: '#10B981' },
  ].filter(d => d.value > 0) : [];

  return (
    <div className="satis-adetleri-container">
      {/* HEADER */}
      <div className="sa-header">
        <div className="sa-header-content">
          <div className="sa-header-left">
            <span className="material-icons sa-header-icon">trending_up</span>
            <div>
              <h1>Satış Adetleri</h1>
              <p>Ürün bazlı satış adetleri ve performans analizi</p>
            </div>
          </div>
        </div>
      </div>

      {/* FİLTRELER */}
      <div className="sa-filter-section">
        <div className="sa-filter-row">
          {currentUser?.role === 'sirket_yoneticisi' && (
            <div className="sa-filter-group">
              <label>Şube</label>
              <select
                value={filter.subeId}
                onChange={e => setFilter(f => ({ ...f, subeId: e.target.value }))}
              >
                <option value="">Şube Seçin</option>
                {subeler.map(s => (
                  <option key={s.id} value={s.rrc_restaurant_id || s.id}>
                    {s.subeAdi || s.ad}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="sa-filter-group">
            <label>Rapor Tipi</label>
            <div className="sa-mode-btns">
              <button
                className={`sa-mode-btn ${filter.mode === 'daily' ? 'active' : ''}`}
                onClick={() => setFilter(f => ({ ...f, mode: 'daily' }))}
              >
                <span className="material-icons">today</span> Günlük
              </button>
              <button
                className={`sa-mode-btn ${filter.mode === 'range' ? 'active' : ''}`}
                onClick={() => setFilter(f => ({ ...f, mode: 'range' }))}
              >
                <span className="material-icons">date_range</span> Tarih Aralığı
              </button>
            </div>
          </div>

          {filter.mode === 'daily' ? (
            <div className="sa-filter-group">
              <label>Tarih</label>
              <input
                type="date"
                value={filter.date}
                onChange={e => setFilter(f => ({ ...f, date: e.target.value }))}
              />
            </div>
          ) : (
            <>
              <div className="sa-filter-group">
                <label>Başlangıç</label>
                <input
                  type="date"
                  value={filter.startDate}
                  onChange={e => setFilter(f => ({ ...f, startDate: e.target.value }))}
                />
              </div>
              <div className="sa-filter-group">
                <label>Bitiş</label>
                <input
                  type="date"
                  value={filter.endDate}
                  onChange={e => setFilter(f => ({ ...f, endDate: e.target.value }))}
                />
              </div>
            </>
          )}

          <div className="sa-filter-group sa-filter-action">
            <button
              className="sa-fetch-btn"
              onClick={handleFetchReport}
              disabled={loading || !filter.subeId}
            >
              <span className="material-icons">{loading ? 'hourglass_empty' : 'search'}</span>
              {loading ? 'Yükleniyor...' : 'Rapor Getir'}
            </button>
          </div>
        </div>
      </div>

      {/* HATA */}
      {error && (
        <div className="sa-error">
          <span className="material-icons">error_outline</span>
          <p>{error}</p>
        </div>
      )}

      {/* LOADING */}
      {loading && (
        <div className="sa-loading">
          <div className="sa-spinner"></div>
          <p>Satış verileri yükleniyor...</p>
        </div>
      )}

      {/* BOŞ */}
      {!loading && !data && !error && (
        <div className="sa-empty">
          <span className="material-icons">trending_up</span>
          <p>Satış verilerini görüntülemek için şube ve tarih seçip &quot;Rapor Getir&quot; butonuna tıklayın.</p>
        </div>
      )}

      {/* VERİ VAR */}
      {!loading && data && (
        <>
          {/* İSTATİSTİK KARTLARI */}
          <div className="sa-stats">
            <div className="sa-stat-card">
              <div className="sa-stat-icon si-blue">
                <span className="material-icons">inventory</span>
              </div>
              <div className="sa-stat-body">
                <span className="sa-stat-label">Ürün Çeşidi</span>
                <span className="sa-stat-value">{stats.cesit}</span>
              </div>
            </div>
            <div className="sa-stat-card">
              <div className="sa-stat-icon si-green">
                <span className="material-icons">shopping_cart</span>
              </div>
              <div className="sa-stat-body">
                <span className="sa-stat-label">Toplam Adet</span>
                <span className="sa-stat-value">{stats.toplamMiktar}</span>
              </div>
            </div>
            <div className="sa-stat-card">
              <div className="sa-stat-icon si-purple">
                <span className="material-icons">delivery_dining</span>
              </div>
              <div className="sa-stat-body">
                <span className="sa-stat-label">Paket Satış</span>
                <span className="sa-stat-value">{stats.paketMiktar} adet</span>
              </div>
            </div>
            <div className="sa-stat-card">
              <div className="sa-stat-icon si-teal">
                <span className="material-icons">table_restaurant</span>
              </div>
              <div className="sa-stat-body">
                <span className="sa-stat-label">Salon Satış</span>
                <span className="sa-stat-value">{stats.salonMiktar} adet</span>
              </div>
            </div>
          </div>

          {/* KAYNAK FİLTRE */}
          <div className="sa-kaynak-filter">
            {[
              { key: 'all', label: 'Tümü', icon: 'select_all' },
              { key: 'paket', label: 'Paket', icon: 'delivery_dining' },
              { key: 'salon', label: 'Salon', icon: 'table_restaurant' },
            ].map(k => (
              <button
                key={k.key}
                className={`sa-kaynak-btn ${filterKaynak === k.key ? 'active' : ''}`}
                onClick={() => setFilterKaynak(k.key)}
              >
                <span className="material-icons">{k.icon}</span>
                {k.label}
              </button>
            ))}
          </div>

          {/* GRAFİKLER */}
          <div className="sa-charts-grid">
            {/* Top 10 Bar Chart */}
            {barData.length > 0 && (
              <div className="sa-chart-card">
                <h3><span className="material-icons">bar_chart</span> En Çok Satan 10 Ürün</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={barData} layout="vertical" margin={{ left: 10, right: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis type="number" tick={{ fill: '#64748B', fontSize: 12 }} />
                    <YAxis dataKey="name" type="category" width={130} tick={{ fill: '#334155', fontSize: 11 }} />
                    <Tooltip
                      formatter={(v, n) => [n === 'Ciro' ? formatCurrency(v) : v, n]}
                      contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0' }}
                    />
                    <Legend />
                    <Bar dataKey="Adet" fill="#3B82F6" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="Ciro" fill="#10B981" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Kaynak Dağılım Pie */}
            {kaynakPie.length > 1 && filterKaynak === 'all' && (
              <div className="sa-chart-card">
                <h3><span className="material-icons">donut_large</span> Paket / Salon Dağılımı</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={kaynakPie}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {kaynakPie.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v, n) => [`${v} adet`, n]} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* ÜRÜN LİSTESİ */}
          {filteredList.length === 0 ? (
            <div className="sa-empty">
              <span className="material-icons">trending_up</span>
              <p>Seçilen filtre için satış verisi bulunamadı.</p>
            </div>
          ) : (
            <div className="sa-table-card">
              <div className="sa-table-header">
                <span className="material-icons">list_alt</span>
                <h3>Ürün Satış Detayları</h3>
                <span className="sa-table-count">{filteredList.length} ürün</span>
              </div>
              <div className="sa-table-wrapper">
                <table className="sa-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Ürün Adı</th>
                      <th className="text-right">Adet</th>
                      {filterKaynak === 'all' && <th className="text-right">Paket</th>}
                      {filterKaynak === 'all' && <th className="text-right">Salon</th>}
                      <th className="text-right">Tahmini Ciro</th>
                      <th className="text-right">Birim Fiyat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredList.map((item, index) => (
                      <tr key={item.urunadi + index}>
                        <td className="rank-cell">{index + 1}</td>
                        <td className="urun-cell">{item.urunadi}</td>
                        <td className="text-right adet-cell">{item.miktar}</td>
                        {filterKaynak === 'all' && <td className="text-right paket-cell">{item.paketMiktar || 0}</td>}
                        {filterKaynak === 'all' && <td className="text-right salon-cell">{item.salonMiktar || 0}</td>}
                        <td className="text-right ciro-cell">{formatCurrency(item.ciro)}</td>
                        <td className="text-right birim-cell">{formatCurrency(item.miktar > 0 ? item.ciro / item.miktar : 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td></td>
                      <td><strong>TOPLAM</strong></td>
                      <td className="text-right"><strong>{stats.toplamMiktar}</strong></td>
                      {filterKaynak === 'all' && <td className="text-right"><strong>{stats.paketMiktar}</strong></td>}
                      {filterKaynak === 'all' && <td className="text-right"><strong>{stats.salonMiktar}</strong></td>}
                      <td className="text-right"><strong>{formatCurrency(stats.toplamCiro)}</strong></td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SatisAdetleriPage;
