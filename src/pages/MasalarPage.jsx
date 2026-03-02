import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import AdisyonDetailModal from '../components/AdisyonDetailModal';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend
} from 'recharts';
import './MasalarPage.css';

const DURUM_MAP = {
  0: { label: 'Boş', color: 'bos', icon: 'event_seat', gradient: '#64748B' },
  1: { label: 'Dolu', color: 'dolu', icon: 'restaurant', gradient: '#10B981' },
  2: { label: 'Ödeme Bekliyor', color: 'odeme', icon: 'payments', gradient: '#F59E0B' },
};

const getDurum = (durumid) => DURUM_MAP[Number(durumid)] || DURUM_MAP[0];

const MasalarPage = () => {
  const { currentUser } = useAuth();
  const [masalar, setMasalar] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSube, setSelectedSube] = useState('');
  const [subeler, setSubeler] = useState([]);
  const [filterDurum, setFilterDurum] = useState('all'); // all | 0 | 1 | 2
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAdisyon, setSelectedAdisyon] = useState(null);
  const [selectedMasa, setSelectedMasa] = useState(null);

  // Şubeleri getir
  useEffect(() => {
    if (!currentUser) return;
    const fetchSubeler = async () => {
      try {
        let q;
        if (currentUser.role === 'sirket_yoneticisi') {
          q = query(collection(db, 'subeler'));
        } else if (currentUser.subeId) {
          q = query(collection(db, 'subeler'), where('__name__', '==', currentUser.subeId));
        } else return;

        const snap = await getDocs(q);
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        list.sort((a, b) => (a.subeAdi || a.ad || '').localeCompare(b.subeAdi || b.ad || ''));
        setSubeler(list);
        if (list.length > 0 && !selectedSube) {
          setSelectedSube(list[0].id);
        }
      } catch (err) {
        setError('Şubeler yüklenirken hata: ' + err.message);
      }
    };
    fetchSubeler();
  }, [currentUser]);

  // Masaları getir (realtime)
  useEffect(() => {
    if (!selectedSube) {
      setMasalar([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    const q = query(
      collection(db, 'Masalar'),
      where('rrc_restaurant_id', '==', selectedSube)
    );

    const unsubscribe = onSnapshot(q,
      (snapshot) => {
        const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // masaadi'ye göre doğal sırala
        list.sort((a, b) => {
          const na = a.masaadi || a.masa_adi || '';
          const nb = b.masaadi || b.masa_adi || '';
          return na.localeCompare(nb, 'tr', { numeric: true });
        });
        setMasalar(list);
        setLoading(false);
      },
      (err) => {
        setError('Masalar yüklenirken hata: ' + err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [selectedSube]);

  // Masaya tıklayınca adisyonu bul
  const handleMasaClick = async (masa) => {
    const adsCode = masa.ads_code || masa.masa_adscode;
    if (!adsCode) return; // Adisyon kodu yoksa tıklama yok

    try {
      // SalonAdisyonlari'ndan adisyonu bul
      const q = query(
        collection(db, 'SalonAdisyonlari'),
        where('rrc_restaurant_id', '==', selectedSube),
        where('ad_code', '==', adsCode)
      );
      const snap = await getDocs(q);

      if (!snap.empty) {
        const doc = snap.docs[0];
        const data = doc.data();
        // AdisyonDetailModal'ın beklediği formata normalize et
        const adisyon = {
          id: doc.id,
          ...data,
          adisyoncode: data.ad_code,
          acilis: data.ad_open,
          atop: data.ad_total,
          _kaynak: 'masa',
          siparisnerden: 88,
        };
        setSelectedAdisyon(adisyon);
        setSelectedMasa(masa);
        setIsModalOpen(true);
      }
    } catch (err) {
      setError('Adisyon bilgisi alınırken hata: ' + err.message);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedAdisyon(null);
    setSelectedMasa(null);
  };

  // Filtrelenmiş masalar
  const filteredMasalar = filterDurum === 'all'
    ? masalar
    : masalar.filter(m => Number(m.durumid) === Number(filterDurum));

  // İstatistikler
  const stats = {
    toplam: masalar.length,
    bos: masalar.filter(m => Number(m.durumid) === 0).length,
    dolu: masalar.filter(m => Number(m.durumid) === 1).length,
    odeme: masalar.filter(m => Number(m.durumid) === 2).length,
  };

  // Pie chart data
  const pieData = [
    stats.bos > 0 && { name: 'Boş', value: stats.bos, color: '#64748B' },
    stats.dolu > 0 && { name: 'Dolu', value: stats.dolu, color: '#10B981' },
    stats.odeme > 0 && { name: 'Ödeme Bekliyor', value: stats.odeme, color: '#F59E0B' },
  ].filter(Boolean);

  return (
    <div className="masalar-container">
      {/* HEADER */}
      <div className="masalar-header">
        <div className="masalar-header-content">
          <div className="masalar-header-left">
            <span className="material-icons masalar-header-icon">table_restaurant</span>
            <div>
              <h1>Masalar</h1>
              <p>Şube bazlı masa durumlarını görüntüleyin</p>
            </div>
          </div>
        </div>
      </div>

      {/* FİLTRELER */}
      <div className="masalar-filter-section">
        <div className="masalar-filter-row">
          {currentUser?.role === 'sirket_yoneticisi' && (
            <div className="masalar-filter-group">
              <label>Şube</label>
              <select
                value={selectedSube}
                onChange={e => setSelectedSube(e.target.value)}
              >
                <option value="">Şube Seçin</option>
                {subeler.map(s => (
                  <option key={s.id} value={s.id}>{s.subeAdi || s.ad}</option>
                ))}
              </select>
            </div>
          )}
          <div className="masalar-filter-group">
            <label>Durum</label>
            <select value={filterDurum} onChange={e => setFilterDurum(e.target.value)}>
              <option value="all">Tümü</option>
              <option value="0">Boş</option>
              <option value="1">Dolu</option>
              <option value="2">Ödeme Bekliyor</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="masalar-error">
          <span className="material-icons">error_outline</span>
          <p>{error}</p>
        </div>
      )}

      {!selectedSube && !loading && (
        <div className="masalar-empty">
          <span className="material-icons">table_restaurant</span>
          <p>Masaları görüntülemek için bir şube seçin</p>
        </div>
      )}

      {selectedSube && loading && (
        <div className="masalar-loading">
          <div className="masalar-spinner"></div>
          <p>Masalar yükleniyor...</p>
        </div>
      )}

      {selectedSube && !loading && masalar.length > 0 && (
        <>
          {/* İSTATİSTİKLER */}
          <div className="masalar-stats">
            <div className="masalar-stat-card" onClick={() => setFilterDurum('all')}>
              <div className="masalar-stat-icon stat-total">
                <span className="material-icons">grid_view</span>
              </div>
              <div className="masalar-stat-body">
                <span className="masalar-stat-label">Toplam</span>
                <span className="masalar-stat-value">{stats.toplam}</span>
              </div>
            </div>
            <div className="masalar-stat-card" onClick={() => setFilterDurum('0')}>
              <div className="masalar-stat-icon stat-bos">
                <span className="material-icons">event_seat</span>
              </div>
              <div className="masalar-stat-body">
                <span className="masalar-stat-label">Boş</span>
                <span className="masalar-stat-value">{stats.bos}</span>
              </div>
            </div>
            <div className="masalar-stat-card" onClick={() => setFilterDurum('1')}>
              <div className="masalar-stat-icon stat-dolu">
                <span className="material-icons">restaurant</span>
              </div>
              <div className="masalar-stat-body">
                <span className="masalar-stat-label">Dolu</span>
                <span className="masalar-stat-value">{stats.dolu}</span>
              </div>
            </div>
            <div className="masalar-stat-card" onClick={() => setFilterDurum('2')}>
              <div className="masalar-stat-icon stat-odeme">
                <span className="material-icons">payments</span>
              </div>
              <div className="masalar-stat-body">
                <span className="masalar-stat-label">Ödeme Bekliyor</span>
                <span className="masalar-stat-value">{stats.odeme}</span>
              </div>
            </div>
          </div>

          {/* GRAFİK */}
          {pieData.length > 1 && (
            <div className="masalar-chart-card">
              <h3><span className="material-icons">donut_large</span> Masa Durumu Dağılımı</h3>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [`${value} masa`, name]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* MASA GRID */}
          <div className="masalar-grid">
            {filteredMasalar.map(masa => {
              const durum = getDurum(masa.durumid);
              const hasAdisyon = !!(masa.ads_code || masa.masa_adscode);
              return (
                <div
                  key={masa.id}
                  className={`masa-card masa-${durum.color} ${hasAdisyon ? 'clickable' : ''}`}
                  onClick={() => hasAdisyon && handleMasaClick(masa)}
                >
                  <div className="masa-top-bar"></div>
                  <div className="masa-body">
                    <span className={`material-icons masa-durum-icon`}>{durum.icon}</span>
                    <span className="masa-adi">{masa.masaadi || masa.masa_adi || 'Masa'}</span>
                    <span className="masa-durum-badge">{durum.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {selectedSube && !loading && masalar.length === 0 && !error && (
        <div className="masalar-empty">
          <span className="material-icons">table_restaurant</span>
          <p>Bu şubede henüz masa bulunmuyor</p>
        </div>
      )}

      {/* MODAL */}
      <AdisyonDetailModal
        isOpen={isModalOpen}
        onClose={closeModal}
        adisyon={selectedAdisyon}
        masa={selectedMasa}
      />
    </div>
  );
};

export default MasalarPage;
