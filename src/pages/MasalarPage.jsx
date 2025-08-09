import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import AdisyonDetailModal from '../components/AdisyonDetailModal';
import './MasalarPage.css';

const MasalarPage = () => {
  const [masalar, setMasalar] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSube, setSelectedSube] = useState('');
  const [subeler, setSubeler] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAdisyon, setSelectedAdisyon] = useState(null);
  const [selectedMasa, setSelectedMasa] = useState(null);
  const { currentUser } = useAuth();

  // Şubeleri getir
  useEffect(() => {
    const getSubeler = async () => {
      try {
        console.log('currentUser:', currentUser);
        console.log('currentUser role:', currentUser?.role);
        console.log('currentUser subeId:', currentUser?.subeId);
        
        let subeQuery;
        
        if (currentUser?.role === 'sirket_yoneticisi') {
          // Şirket yöneticisi tüm şubeleri görebilir
          console.log('Şirket yöneticisi - tüm şubeleri getiriliyor');
          subeQuery = query(collection(db, 'subeler'));
        } else if (currentUser?.subeId) {
          // Diğer kullanıcılar sadece kendi şubelerini görebilir
          console.log('Şube kullanıcısı - sadece kendi şubesini getiriliyor:', currentUser.subeId);
          subeQuery = query(
            collection(db, 'subeler'), 
            where('__name__', '==', currentUser.subeId)
          );
        } else {
          console.log('Kullanıcı rolü bulunamadı veya şube ID yok');
          return;
        }

        if (subeQuery) {
          console.log('Şubeler sorgusu oluşturuldu, Firestore\'dan veri bekleniyor...');
          const unsubscribe = onSnapshot(subeQuery, (snapshot) => {
            console.log('Şubeler snapshot alındı, doküman sayısı:', snapshot.docs.length);
            const subeList = snapshot.docs.map(doc => {
              const data = { id: doc.id, ...doc.data() };
              console.log('Şube verisi:', data);
              return data;
            });
            setSubeler(subeList);
            console.log('Şubeler state\'e kaydedildi:', subeList);
            
            // Eğer kullanıcı şirket yöneticisi değilse, otomatik olarak kendi şubesini seç
            if (currentUser?.role !== 'sirket_yoneticisi' && subeList.length > 0) {
              console.log('Otomatik şube seçimi yapılıyor:', subeList[0].id);
              setSelectedSube(subeList[0].id);
            }
          }, (error) => {
            console.error('Şubeler alınırken hata:', error);
            setError('Şubeler yüklenirken bir hata oluştu: ' + error.message);
          });

          return () => unsubscribe();
        }
      } catch (err) {
        console.error('Şubeler alınırken hata:', err);
        setError('Şubeler yüklenirken bir hata oluştu: ' + err.message);
      }
    };

    if (currentUser) {
      console.log('currentUser mevcut, şubeler yükleniyor...');
      getSubeler();
    } else {
      console.log('currentUser henüz yüklenmedi');
    }
  }, [currentUser]);

  // Masaları getir
  useEffect(() => {
    if (!selectedSube) {
      setMasalar([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('Masalar sorgulanıyor, selectedSube:', selectedSube);
      
      // Önce orderBy ile deneyelim, hata alırsak sadece where kullanacağız
      const masalarQuery = query(
        collection(db, 'Masalar'),
        where('rrc_restaurant_id', '==', selectedSube),
        orderBy('masa_id', 'asc')
      );

      const unsubscribe = onSnapshot(masalarQuery, 
        (snapshot) => {
          console.log('Masalar snapshot alındı, doküman sayısı:', snapshot.docs.length);
          const masaList = snapshot.docs.map(doc => {
            const data = { id: doc.id, ...doc.data() };
            console.log('Masa verisi:', data);
            console.log('masa_durum değeri:', data.masa_durum, '(0: Kapalı, 1: Açık, 2: Ödeme Bekleniyor)');
            return data;
          });
          
          // Masa ID'ye göre sıralama (sayısal sıralama)
          const sortedMasaList = masaList.sort((a, b) => {
            const masaIdA = Number(a.masa_id) || 0;
            const masaIdB = Number(b.masa_id) || 0;
            return masaIdA - masaIdB;
          });
          
          console.log('Sıralanmış masa listesi:', sortedMasaList);
          setMasalar(sortedMasaList);
          setLoading(false);
        },
        (err) => {
          console.error('Masalar alınırken hata:', err);
          
          // Eğer index hatası varsa, orderBy olmadan tekrar deneyelim
          if (err.code === 'failed-precondition' || err.message.includes('index')) {
            console.log('Index hatası, orderBy olmadan tekrar deneniyor...');
            
            const fallbackQuery = query(
              collection(db, 'Masalar'),
              where('rrc_restaurant_id', '==', selectedSube)
            );
            
            const fallbackUnsubscribe = onSnapshot(fallbackQuery,
              (snapshot) => {
                console.log('Fallback sorgu - Masalar snapshot alındı, doküman sayısı:', snapshot.docs.length);
                const masaList = snapshot.docs.map(doc => {
                  const data = { id: doc.id, ...doc.data() };
                  return data;
                });
                
                // Client-side sıralama
                const sortedMasaList = masaList.sort((a, b) => {
                  const masaIdA = Number(a.masa_id) || 0;
                  const masaIdB = Number(b.masa_id) || 0;
                  return masaIdA - masaIdB;
                });
                
                setMasalar(sortedMasaList);
                setLoading(false);
              },
              (fallbackErr) => {
                console.error('Fallback sorgu hatası:', fallbackErr);
                setError('Masalar yüklenirken bir hata oluştu: ' + fallbackErr.message);
                setLoading(false);
              }
            );
            
            return () => fallbackUnsubscribe();
          } else {
            setError('Masalar yüklenirken bir hata oluştu: ' + err.message);
            setLoading(false);
          }
        }
      );

      return () => unsubscribe();
    } catch (err) {
      console.error('Masalar sorgulanırken hata:', err);
      setError('Masalar sorgulanırken bir hata oluştu: ' + err.message);
      setLoading(false);
    }
  }, [selectedSube]);

  // Masa durumu için renk belirleme
  const getMasaDurumColor = (durum) => {
    const durumNum = Number(durum);
    switch (durumNum) {
      case 0:
        return 'secondary'; // Masa kapalı - gri
      case 1:
        return 'success'; // Masa açık - yeşil
      case 2:
        return 'warning'; // Ödeme bekleniyor - sarı
      default:
        return 'secondary';
    }
  };

  // Masa durumu için ikon belirleme
  const getMasaDurumIcon = (durum) => {
    const durumNum = Number(durum);
    switch (durumNum) {
      case 0:
        return 'lock'; // Masa kapalı
      case 1:
        return 'check_circle'; // Masa açık
      case 2:
        return 'schedule'; // Ödeme bekleniyor
      default:
        return 'help_outline';
    }
  };

  // Masa durumu için Türkçe metin (tooltip için)
  const getMasaDurumText = (durum) => {
    const durumNum = Number(durum);
    switch (durumNum) {
      case 0:
        return 'Kapalı';
      case 1:
        return 'Açık';
      case 2:
        return 'Ödeme Bekleniyor';
      default:
        return durum !== null && durum !== undefined ? String(durum) : 'Bilinmiyor';
    }
  };

  // Masaya tıklandığında adisyonu getir ve modal aç
  const handleMasaClick = async (masa) => {
    console.log('Masa tıklandı:', masa);
    console.log('Selected Sube:', selectedSube);
    console.log('Masa adscode:', masa.masa_adscode);
    
    // masa_adscode yoksa işlem yapma
    if (!masa.masa_adscode) {
      console.log('Bu masanın adscode\'u yok');
      return;
    }
    
    try {
      // masa_adscode ile adisyoncode eşleşen adisyonu bul
      const adisyonQuery = query(
        collection(db, 'Adisyonlar'),
        where('rrc_restaurant_id', '==', selectedSube),
        where('adisyoncode', '==', masa.masa_adscode)
      );
      
      const querySnapshot = await getDocs(adisyonQuery);
      console.log('Adisyon sorgusu sonucu:', querySnapshot.docs.length, 'adisyon bulundu');
      
      if (!querySnapshot.empty) {
        const adisyon = { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() };
        console.log('Bulunan adisyon:', adisyon);
        setSelectedAdisyon(adisyon);
        setSelectedMasa(masa);
        setIsModalOpen(true);
      } else {
        console.log('Bu masa için adisyon bulunamadı. Aranan adisyoncode:', masa.masa_adscode);
        
        // Debug için tüm adisyonları listeleyelim
        const allAdisyonQuery = query(
          collection(db, 'Adisyonlar'),
          where('rrc_restaurant_id', '==', selectedSube)
        );
        const allQuerySnapshot = await getDocs(allAdisyonQuery);
        const allAdisyonlar = allQuerySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log('Şubedeki tüm adisyonlar:', allAdisyonlar);
        console.log('Adisyon kodları:', allAdisyonlar.map(a => a.adisyoncode));
      }
    } catch (err) {
      console.error('Masa adisyonu getirilirken hata:', err);
      setError('Masa bilgileri alınırken bir hata oluştu: ' + err.message);
    }
  };

  // Modal'ı kapat
  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedAdisyon(null);
    setSelectedMasa(null);
  };

  if (loading && !selectedSube) {
    return (
      <div className="masalar-container">
        <div className="page-header">
          <div className="header-content">
            <div className="title-section">
              <h1>
                <span className="material-icons">table_restaurant</span>
                Masalar
              </h1>
            </div>
          </div>
        </div>
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Şubeler yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="masalar-container">
      <div className="page-header">
        <div className="header-content">
          <div className="title-section">
            <h1>
              <span className="material-icons">table_restaurant</span>
              Masalar
            </h1>
            <p>Şube bazlı masa durumlarını gerçek zamanlı olarak görüntüleyin</p>
          </div>
        </div>
      </div>

      {/* Şube Seçici */}
      <div className="filters-section">
        <div className="filter-group">
          <label htmlFor="sube-select">Şube Seçin:</label>
          <select
            id="sube-select"
            value={selectedSube}
            onChange={(e) => setSelectedSube(e.target.value)}
            disabled={currentUser?.role !== 'sirket_yoneticisi'}
          >
            <option value="">Şube seçin...</option>
            {subeler.map((sube) => (
              <option key={sube.id} value={sube.id}>
                {sube.subeAdi} (ID: {sube.id})
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="error-message">
          <span className="material-icons">error_outline</span>
          {error}
        </div>
      )}

      {!selectedSube && !loading && (
        <div className="empty-state">
          <span className="material-icons">table_restaurant</span>
          <h3>Şube Seçin</h3>
          <p>Masaları görüntülemek için yukarıdan bir şube seçin.</p>
        </div>
      )}

      {selectedSube && loading && (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Masalar yükleniyor...</p>
        </div>
      )}

      {selectedSube && !loading && masalar.length === 0 && !error && (
        <div className="empty-state">
          <span className="material-icons">table_restaurant</span>
          <h3>Masa Bulunamadı</h3>
          <p>Seçilen şubede henüz masa bulunmuyor.</p>
        </div>
      )}

      {selectedSube && !loading && masalar.length > 0 && (
        <>
          {/* İstatistikler */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon secondary">
                <span className="material-icons">close</span>
              </div>
              <div className="stat-info">
                <div className="stat-number">
                  {masalar.filter(masa => Number(masa.masa_durum) === 0).length}
                </div>
                <div className="stat-label">Kapalı Masalar</div>
              </div>
            </div>
            
            <div className="stat-card">
              <div className="stat-icon success">
                <span className="material-icons">check_circle</span>
              </div>
              <div className="stat-info">
                <div className="stat-number">
                  {masalar.filter(masa => Number(masa.masa_durum) === 1).length}
                </div>
                <div className="stat-label">Açık Masalar</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon warning">
                <span className="material-icons">payment</span>
              </div>
              <div className="stat-info">
                <div className="stat-number">
                  {masalar.filter(masa => Number(masa.masa_durum) === 2).length}
                </div>
                <div className="stat-label">Ödeme Bekleyen</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon primary">
                <span className="material-icons">table_restaurant</span>
              </div>
              <div className="stat-info">
                <div className="stat-number">{masalar.length}</div>
                <div className="stat-label">Toplam Masa</div>
              </div>
            </div>
          </div>

          {/* Masa Listesi */}
          <div className="masalar-grid">
            {masalar.map((masa) => (
              <div 
                key={masa.id} 
                className={`masa-card ${getMasaDurumColor(masa.masa_durum)} ${masa.masa_adscode ? 'clickable' : ''}`}
                onClick={() => {
                  console.log('Masa kartına tıklandı!', masa);
                  if (masa.masa_adscode) {
                    handleMasaClick(masa);
                  }
                }}
                style={{ cursor: masa.masa_adscode ? 'pointer' : 'default' }}
              >
                <div className="masa-content">
                  <div className="masa-icon">
                    <span className="material-icons">table_restaurant</span>
                  </div>
                  <div className="masa-name">
                    {masa.masa_adi || `Masa ${masa.masa_id}`}
                  </div>
                  <div 
                    className={`masa-status-icon ${getMasaDurumColor(masa.masa_durum)}`}
                    title={getMasaDurumText(masa.masa_durum)}
                  >
                    <span className="material-icons">{getMasaDurumIcon(masa.masa_durum)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Adisyon Detay Modal */}
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
