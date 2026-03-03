import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, getDocs, addDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import AdisyonDetailModal from '../components/AdisyonDetailModal';
import './KuryeAtamaPage.css';

const KAYNAK_MAP = {
  0: { text: 'Telefon', icon: 'phone_in_talk', color: 'info' },
  1: { text: 'Yemek Sepeti', icon: 'delivery_dining', color: 'warning' },
  2: { text: 'Getir', icon: 'motorcycle', color: 'success' },
  5: { text: 'Trendyol', icon: 'shopping_bag', color: 'danger' },
  8: { text: 'Migros', icon: 'store', color: 'secondary' },
};

const KuryeAtamaPage = () => {
  const [adisyonlar, setAdisyonlar] = useState([]);
  const [kuryeler, setKuryeler] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAdisyon, setSelectedAdisyon] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedKurye, setSelectedKurye] = useState('');
  const [atanacakAdisyon, setAtanacakAdisyon] = useState(null);
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });
  const [rrcId, setRrcId] = useState(null);
  const { currentUser } = useAuth();

  const isCourier = currentUser?.role === 'kurye';
  const canAssignCourier = currentUser?.role === 'sube_yoneticisi';

  // Bildirim göster
  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: '' }), 3000);
  };

  // Şube rrc_restaurant_id'sini al
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

  // Kuryeleri getir (sadece aynı şubeye bağlı kuryeler)
  useEffect(() => {
    if (!currentUser || isCourier) return;
    const fetchKuryeler = async () => {
      try {
        const constraints = [where('role', '==', 'kurye')];
        if (currentUser.subeId) {
          constraints.push(where('subeId', '==', currentUser.subeId));
        }
        const snap = await getDocs(query(collection(db, 'users'), ...constraints));
        setKuryeler(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error('Kuryeler getirilirken hata:', err);
      }
    };
    fetchKuryeler();
  }, [currentUser, isCourier]);

  // PaketAdisyonlar koleksiyonundan realtime dinle (AdisyonlarPage mantığıyla aynı)
  useEffect(() => {
    if (!currentUser || !rrcId) return;

    const q = query(
      collection(db, 'PaketAdisyonlar'),
      where('rrc_restaurant_id', '==', String(rrcId))
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        // Motorcu boş olanlar
        .filter(a => !a.motorcu || a.motorcu === '')
        // kisikod 1000000 olanları çıkar
        .filter(a => String(a.kisikod) !== '1000000')
        // Onaylandı ve İptal durumundakileri hariç tut
        .filter(a => {
          if (!a.durum) return true;
          const d = String(a.durum).toUpperCase();
          return d !== 'ONAYLANDI' && d !== 'İPTAL' && d !== 'IPTAL';
        })
        // En yeni önce
        .sort((a, b) => {
          const da = a.acilis || a.tarih;
          const db2 = b.acilis || b.tarih;
          const dateA = da ? new Date(da) : new Date(0);
          const dateB = db2 ? new Date(db2) : new Date(0);
          return dateB - dateA;
        });

      setAdisyonlar(list);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser, rrcId]);

  // Kurye atama (şube müdürü)
  const handleKuryeAtama = async (adisyonId, kuryeAdi) => {
    if (!canAssignCourier) {
      showNotification('Bu işlemi yapma yetkiniz bulunmamaktadır.', 'error');
      return;
    }

    try {
      const siparis = adisyonlar.find(a => a.id === adisyonId);
      if (!siparis) throw new Error('Sipariş bulunamadı');

      await updateDoc(doc(db, 'PaketAdisyonlar', adisyonId), { motorcu: kuryeAdi });

      await addDoc(collection(db, 'kuryeatama'), {
        adisyonCode: siparis.padsgnum || siparis.adisyoncode || siparis.id,
        kuryeAdi,
        kuryeId: null,
        atamaTarihi: serverTimestamp(),
        siparisTarihi: siparis.acilis || siparis.tarih || new Date().toISOString(),
        subeId: currentUser.subeId || siparis.subeId || '',
        subeAdi: currentUser.subeAdi || siparis.subeAdi || '',
        toplam: siparis.atop || 0,
        durum: 'Atandı',
        atayanId: currentUser.uid,
        atayanAdi: currentUser.displayName || currentUser.email,
        atayanRole: currentUser.role,
      });

      setAtanacakAdisyon(null);
      setSelectedKurye('');
      showNotification('Kurye ataması başarıyla tamamlandı!');
    } catch (err) {
      console.error('Kurye atama hatası:', err);
      showNotification('Kurye atama sırasında bir hata oluştu: ' + err.message, 'error');
    }
  };

  // Kurye kendi üzerine alma
  const handleKuryeUzerineAl = async (adisyonId) => {
    try {
      const siparis = adisyonlar.find(a => a.id === adisyonId);
      if (!siparis) throw new Error('Sipariş bulunamadı');

      const kuryeAdi = currentUser.displayName || currentUser.email;

      await updateDoc(doc(db, 'PaketAdisyonlar', adisyonId), { motorcu: kuryeAdi });

      await addDoc(collection(db, 'kuryeatama'), {
        adisyonCode: siparis.padsgnum || siparis.adisyoncode || siparis.id,
        kuryeAdi,
        kuryeId: currentUser.uid,
        atamaTarihi: serverTimestamp(),
        siparisTarihi: siparis.acilis || siparis.tarih || new Date().toISOString(),
        subeId: currentUser.subeId || siparis.subeId || '',
        subeAdi: siparis.subeAdi || '',
        toplam: siparis.atop || 0,
        durum: 'Atandı',
        atayanRole: 'kurye',
      });

      showNotification('Sipariş başarıyla üzerinize alındı!');
    } catch (err) {
      console.error('Sipariş üzerine alma hatası:', err);
      showNotification('Sipariş üzerine alma sırasında bir hata oluştu: ' + err.message, 'error');
    }
  };

  // Yardımcılar
  const formatDate = (dateValue) => {
    if (!dateValue) return '-';
    try {
      let date;
      if (dateValue?.toDate) date = dateValue.toDate();
      else if (dateValue?.seconds) date = new Date(dateValue.seconds * 1000);
      else {
        const s = String(dateValue);
        date = new Date(s.includes(' ') ? s.replace(' ', 'T') : s);
      }
      return date.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return String(dateValue); }
  };

  const formatAmount = (amount) => {
    if (!amount) return '0,00 ₺';
    return Number(amount).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
  };

  const getSiparisTipi = (nerden) => KAYNAK_MAP[nerden] || { text: 'Diğer', icon: 'receipt', color: 'secondary' };

  const showDetail = (adisyon) => { setSelectedAdisyon(adisyon); setIsModalOpen(true); };
  const closeModal = () => { setIsModalOpen(false); setSelectedAdisyon(null); };

  // Şirket yöneticisi erişim engeli
  if (currentUser?.role === 'sirket_yoneticisi') {
    return (
      <div className="kurye-atama-container">
        <div className="ka-header">
          <div className="ka-header-content">
            <span className="material-icons ka-header-icon">block</span>
            <div>
              <h1>Erişim Engellendi</h1>
              <p>Bu sayfa sadece şube müdürleri ve kuryeler tarafından kullanılabilir.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="kurye-atama-container">
      {/* Bildirim */}
      {notification.show && (
        <div className="ka-notification-backdrop">
          <div className={`ka-notification ${notification.type}`}>
            <span className="material-icons">
              {notification.type === 'success' ? 'check_circle' : 'error'}
            </span>
            <span>{notification.message}</span>
          </div>
        </div>
      )}

      {/* Başlık */}
      <div className="ka-header">
        <div className="ka-header-content">
          <span className="material-icons ka-header-icon">delivery_dining</span>
          <div>
            <h1>{isCourier ? 'Teslimat Siparişleri' : 'Kurye Atama'}</h1>
            <p>{isCourier ? 'Üzerinize alabilceğiniz siparişler' : 'Teslimat bekleyen siparişlere kurye atayın'}</p>
          </div>
        </div>
      </div>

      {/* Özet */}
      {!loading && adisyonlar.length > 0 && (
        <div className="ka-summary">
          <div className="ka-summary-card">
            <div className="ka-summary-icon icon-blue"><span className="material-icons">pending_actions</span></div>
            <div className="ka-summary-body">
              <span className="ka-summary-label">Bekleyen Sipariş</span>
              <span className="ka-summary-value">{adisyonlar.length}</span>
            </div>
          </div>
        </div>
      )}

      {/* İçerik */}
      <div className="ka-content">
        {loading ? (
          <div className="ka-empty">
            <div className="loading-spinner-adisyon"></div>
            <p>Siparişler yükleniyor...</p>
          </div>
        ) : adisyonlar.length === 0 ? (
          <div className="ka-empty">
            <span className="material-icons">check_circle_outline</span>
            <p>Kurye bekleyen teslimat siparişi bulunmamaktadır.</p>
          </div>
        ) : (
          <>
            <div className="ka-table-header">
              <h3><span className="material-icons">list_alt</span> Teslimat Bekleyen Siparişler ({adisyonlar.length})</h3>
            </div>

            {/* Kart Listesi */}
            <div className="ka-card-grid">
              {adisyonlar.map((adisyon) => {
                const tip = getSiparisTipi(adisyon.siparisnerden);
                return (
                  <div key={adisyon.id} className="ka-card" onClick={() => showDetail(adisyon)}>
                    <div className="ka-card-top">
                      <div className="ka-card-no">
                        <span className="material-icons">receipt</span>
                        <span>#{adisyon.padsgnum || adisyon.adisyoncode?.slice(-6) || '-'}</span>
                      </div>
                      <span className={`ka-badge ${tip.color}`}>
                        <span className="material-icons">{tip.icon}</span>
                        {tip.text}
                      </span>
                    </div>

                    <div className="ka-card-body">
                      <div className="ka-card-row">
                        <span className="material-icons">schedule</span>
                        <span>{formatDate(adisyon.acilis || adisyon.tarih)}</span>
                      </div>
                      <div className="ka-card-row">
                        <span className="material-icons">payments</span>
                        <span className="ka-amount">{formatAmount(adisyon.atop)}</span>
                      </div>
                      {(adisyon.ads_siparisadres || adisyon.siparisadres) && (
                        <div className="ka-card-row">
                          <span className="material-icons">location_on</span>
                          <span className="ka-address">{adisyon.ads_siparisadres || adisyon.siparisadres}</span>
                        </div>
                      )}
                    </div>

                    <div className="ka-card-actions">
                      {isCourier ? (
                        <button
                          className="ka-btn ka-btn-take"
                          onClick={(e) => { e.stopPropagation(); handleKuryeUzerineAl(adisyon.id); }}
                        >
                          <span className="material-icons">add_task</span>
                          Üzerime Al
                        </button>
                      ) : canAssignCourier ? (
                        <button
                          className="ka-btn ka-btn-assign"
                          onClick={(e) => { e.stopPropagation(); setAtanacakAdisyon(adisyon); }}
                        >
                          <span className="material-icons">assignment_ind</span>
                          Kurye Ata
                        </button>
                      ) : (
                        <button className="ka-btn ka-btn-detail" onClick={(e) => { e.stopPropagation(); showDetail(adisyon); }}>
                          <span className="material-icons">visibility</span>
                          Detay
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Masaüstü Tablo */}
            <div className="ka-table-wrapper">
              <table className="ka-table">
                <thead>
                  <tr>
                    <th>Sipariş No</th>
                    <th>Tarih</th>
                    <th>Kaynak</th>
                    <th className="text-right">Tutar</th>
                    <th>Durum</th>
                    <th className="text-center">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {adisyonlar.map((adisyon) => {
                    const tip = getSiparisTipi(adisyon.siparisnerden);
                    return (
                      <tr key={adisyon.id} onClick={() => showDetail(adisyon)} style={{ cursor: 'pointer' }}>
                        <td className="mono">{adisyon.padsgnum || adisyon.adisyoncode?.slice(-6) || '-'}</td>
                        <td>{formatDate(adisyon.acilis || adisyon.tarih)}</td>
                        <td><span className={`ka-badge ${tip.color}`}><span className="material-icons">{tip.icon}</span>{tip.text}</span></td>
                        <td className="text-right bold">{formatAmount(adisyon.atop)}</td>
                        <td><span className="ka-badge warning"><span className="material-icons">pending</span>Kurye Bekliyor</span></td>
                        <td className="text-center">
                          <div className="ka-table-actions">
                            <button className="ka-action-btn" onClick={(e) => { e.stopPropagation(); showDetail(adisyon); }} title="Detay">
                              <span className="material-icons">visibility</span>
                            </button>
                            {isCourier ? (
                              <button className="ka-action-btn take" onClick={(e) => { e.stopPropagation(); handleKuryeUzerineAl(adisyon.id); }} title="Üzerime Al">
                                <span className="material-icons">add_task</span>
                              </button>
                            ) : canAssignCourier ? (
                              <button className="ka-action-btn assign" onClick={(e) => { e.stopPropagation(); setAtanacakAdisyon(adisyon); }} title="Kurye Ata">
                                <span className="material-icons">assignment_ind</span>
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Kurye Atama Modal */}
      {atanacakAdisyon && (
        <div className="ka-modal-overlay" onClick={() => setAtanacakAdisyon(null)}>
          <div className="ka-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ka-modal-header">
              <h2><span className="material-icons">assignment_ind</span> Kurye Atama</h2>
              <button className="ka-modal-close" onClick={() => setAtanacakAdisyon(null)}>
                <span className="material-icons">close</span>
              </button>
            </div>
            <div className="ka-modal-body">
              <div className="ka-modal-info">
                <p><strong>Sipariş No:</strong> {atanacakAdisyon.padsgnum || '-'}</p>
                <p><strong>Tarih:</strong> {formatDate(atanacakAdisyon.acilis || atanacakAdisyon.tarih)}</p>
                <p><strong>Tutar:</strong> {formatAmount(atanacakAdisyon.atop)}</p>
              </div>
              <div className="ka-modal-select">
                <label htmlFor="ka-kurye-select">Kurye Seçin</label>
                <select id="ka-kurye-select" value={selectedKurye} onChange={(e) => setSelectedKurye(e.target.value)}>
                  <option value="">Kurye seçin...</option>
                  {kuryeler.map((k) => (
                    <option key={k.id} value={k.displayName || k.email}>{k.displayName || k.email}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="ka-modal-footer">
              <button className="ka-btn ka-btn-secondary" onClick={() => setAtanacakAdisyon(null)}>İptal</button>
              <button className="ka-btn ka-btn-assign" onClick={() => handleKuryeAtama(atanacakAdisyon.id, selectedKurye)} disabled={!selectedKurye}>
                <span className="material-icons">assignment_ind</span> Kurye Ata
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Adisyon Detay Modal */}
      <AdisyonDetailModal
        isOpen={isModalOpen}
        onClose={closeModal}
        adisyon={selectedAdisyon}
        isCourier={isCourier}
        onKuryeUzerineAl={handleKuryeUzerineAl}
      />
    </div>
  );
};

export default KuryeAtamaPage;
