import React, { useState, useEffect, useContext } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { AuthContext } from '../contexts/AuthContext';
import AdisyonDetailModal from '../components/AdisyonDetailModal';
import './KuryeAtamaPage.css';

const KuryeAtamaPage = () => {
  const [adisyonlar, setAdisyonlar] = useState([]);
  const [kuryeler, setKuryeler] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAdisyon, setSelectedAdisyon] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedKurye, setSelectedKurye] = useState('');
  const [atanacakAdisyon, setAtanacakAdisyon] = useState(null);
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });
  const { currentUser } = useContext(AuthContext);

  // Kuryeleri getir
  const fetchKuryeler = async () => {
    try {
      const kuryeQuery = query(
        collection(db, 'users'),
        where('role', '==', 'kurye')
      );
      
      const kuryeSnapshot = await getDocs(kuryeQuery);
      const kuryeList = kuryeSnapshot.docs.map(doc => ({
        id: doc.id,
        uid: doc.data().uid,
        ...doc.data()
      }));
      
      setKuryeler(kuryeList);
    } catch (error) {
      console.error('Kuryeler getirilirken hata:', error);
    }
  };

  // Motorcu kolonu boş olan adisyonları getir
  useEffect(() => {
    console.log('🔧 useEffect çalıştı - currentUser:', currentUser);
    console.log('🔧 currentUser role:', currentUser?.role);
    console.log('🔧 currentUser subeId:', currentUser?.subeId);
    console.log('🔧 currentUser tüm bilgileri:', currentUser);
    
    const fetchAdisyonlar = () => {
      try {
        let adisyonQuery;
        
        // Rol kontrolü
        if (currentUser?.role === 'kurye') {
          // Kurye sadece motorcu boş olan siparişleri görebilir (kendi üzerine almak için)
          adisyonQuery = query(
            collection(db, 'Adisyonlar'),
            where('motorcu', '==', '')
          );
        } else {
          // Şirket yöneticisi ve şube müdürü motorcu boş olanları görebilir
          adisyonQuery = query(
            collection(db, 'Adisyonlar'),
            where('motorcu', '==', '')
          );
        }

        const unsubscribe = onSnapshot(adisyonQuery, (snapshot) => {
          let adisyonList = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          
          // İlk adisyonun anahtarlarını konsola yazdır
          if (adisyonList.length > 0) {
            console.log('İlk adisyon verisi:', adisyonList[0]);
            console.log('İlk adisyon anahtarları:', Object.keys(adisyonList[0]));
            
            // Şube ile ilgili alanları özellikle kontrol et
            const subeAlanlari = Object.keys(adisyonList[0]).filter(key => 
              key.toLowerCase().includes('sube') || 
              key.toLowerCase().includes('branch') ||
              key.toLowerCase().includes('store')
            );
            console.log('Şube ile ilgili alanlar:', subeAlanlari);
            
            // Şube değerlerini göster
            subeAlanlari.forEach(alan => {
              console.log(`${alan}:`, adisyonList[0][alan]);
            });
          }
          
          // Masa siparişlerini filtrele (siparisnerden !== 88)
          adisyonList = adisyonList.filter(adisyon => adisyon.siparisnerden !== 88);
          
          // Sadece motorcu boş olan siparişleri göster (kurye bekleyen)
          adisyonList = adisyonList.filter(adisyon => 
            !adisyon.motorcu || adisyon.motorcu === ''
          );
          
          // Tarihe göre sırala (en yeni önce)
          adisyonList.sort((a, b) => {
            const dateA = a.tarih ? new Date(a.tarih) : new Date(0);
            const dateB = b.tarih ? new Date(b.tarih) : new Date(0);
            return dateB - dateA;
          });
          
          setAdisyonlar(adisyonList);
          setLoading(false);
          
          console.log('📋 Yüklenen adisyonlar:', adisyonList.length, 'adet');
          if (adisyonList.length > 0) {
            console.log('📋 İlk 3 adisyon:', adisyonList.slice(0, 3));
          }
        });

        return unsubscribe;
      } catch (error) {
        console.error('Adisyonlar getirilirken hata:', error);
        setLoading(false);
      }
    };

    if (currentUser) {
      const unsubscribe = fetchAdisyonlar();
      fetchKuryeler();
      
      return () => {
        if (unsubscribe) unsubscribe();
      };
    }
  }, [currentUser]);

  // Kurye atama
  const handleKuryeAtama = async (adisyonId, kuryeAdi) => {
    try {
      // Şirket yöneticisinin kurye ataması yapmasını engelle
      if (currentUser?.role === 'sirket_yoneticisi') {
        setNotification({
          show: true,
          message: 'Şirket yöneticileri kurye ataması yapamaz. Bu işlem sadece şube müdürleri tarafından yapılabilir.',
          type: 'error'
        });
        
        setTimeout(() => {
          setNotification({ show: false, message: '', type: '' });
        }, 3000);
        return;
      }
      
      // Sadece şube müdürü kurye ataması yapabilir
      if (currentUser?.role !== 'sube_yoneticisi') {
        setNotification({
          show: true,
          message: 'Bu işlemi yapma yetkiniz bulunmamaktadır.',
          type: 'error'
        });
        
        setTimeout(() => {
          setNotification({ show: false, message: '', type: '' });
        }, 3000);
        return;
      }
      
      // Sipariş bilgisini bul
      const siparis = adisyonlar.find(ad => ad.id === adisyonId);
      if (!siparis) {
        throw new Error('Sipariş bulunamadı');
      }
      
      
      // Şube alanlarını kontrol et
      const subeAlanlari = Object.keys(siparis).filter(key => 
        key.toLowerCase().includes('sube') || 
        key.toLowerCase().includes('branch') ||
        key.toLowerCase().includes('store')
      );
      console.log('Yönetici atama - Şube alanları:', subeAlanlari);
      subeAlanlari.forEach(alan => {
        console.log(`${alan}:`, siparis[alan]);
      });
      
      // Şube ID'sini belirle - şube müdürünün şube bilgisini kullan
      let subeId;
      let subeAdi;
      
      // Şube müdürü kendi şube bilgilerini kullanır
      subeId = currentUser.subeId || currentUser.sube_id || currentUser.branchId;
      subeAdi = currentUser.subeAdi || currentUser.sube_adi || currentUser.branchName || 'Bilinmiyor';
      console.log('Şube müdürü ataması - Şube ID:', subeId, 'Şube Adı:', subeAdi);
      
      // Eğer şube müdürünün şube bilgisi yoksa sipariş şube bilgilerini kullan
      if (!subeId) {
        subeId = siparis.subeId || siparis.sube_id || siparis.subeID || siparis.branchId || siparis.storeId;
        subeAdi = siparis.subeAdi || siparis.sube_adi || siparis.subeAd || siparis.sube || siparis.branchName || siparis.storeName || 'Bilinmiyor';
        console.log('Sipariş şube bilgisi kullanıldı - Şube ID:', subeId, 'Şube Adı:', subeAdi);
      }
      
      // Eğer hala şube bilgisi yoksa varsayılan değer
      if (!subeId) {
        subeId = 'SUBE_BILGISI_BULUNAMADI';
      }
      
      // Adisyon güncelle
      const adisyonRef = doc(db, 'Adisyonlar', adisyonId);
      await updateDoc(adisyonRef, {
        motorcu: kuryeAdi
      });
      
      // Kurye atama kaydı oluştur - doğru şube bilgileriyle
      const atamaKaydi = {
        adisyonCode: siparis.adisyoncode || siparis.adisyonCode || siparis.padsgnum || siparis.code || siparis.id || 'BILINMIYOR',
        kuryeAdi: kuryeAdi,
        kuryeId: null, // Yönetici tarafından atandığında kurye ID'si bilinmiyor
        atamaTarihi: serverTimestamp(),
        siparisTarihi: siparis.tarih || siparis.createdAt || new Date().toISOString(),
        subeId: subeId,
        subeAdi: subeAdi,
        toplam: siparis.atop || siparis.toplam || siparis.total || siparis.amount || 0,
        durum: 'Atandı',
        atayanId: currentUser.uid,
        atayanAdi: currentUser.displayName || currentUser.email,
        atayanRole: currentUser.role
      };
      
      console.log('Yönetici atama kaydı:', atamaKaydi);
      
      console.log('Yönetici atama kaydı oluşturuluyor...');
      
      // Kurye atama kaydını bir kez oluştur
      await addDoc(collection(db, 'kuryeatama'), atamaKaydi);
      
      setAtanacakAdisyon(null);
      setSelectedKurye('');
      console.log('Kurye atama başarılı ve kurye atama kaydı oluşturuldu');
      
      // Show success notification
      setNotification({
        show: true,
        message: 'Kurye ataması başarıyla tamamlandı!',
        type: 'success'
      });
      
      // Auto-hide notification after 3 seconds
      setTimeout(() => {
        setNotification({ show: false, message: '', type: '' });
      }, 3000);
    } catch (error) {
      console.error('Kurye atama hatası:', error);
      
      // Show error notification
      setNotification({
        show: true,
        message: 'Kurye atama sırasında bir hata oluştu: ' + error.message,
        type: 'error'
      });
      
      // Auto-hide notification after 3 seconds
      setTimeout(() => {
        setNotification({ show: false, message: '', type: '' });
      }, 3000);
    }
  };

  // Kurye kendi üzerine alma
  const handleKuryeKendiUzerineAl = async (adisyonId) => {
    console.log('🔥🔥🔥 BUTTON CLICKED! Function called with ID:', adisyonId);
    
    try {
      console.log('Debug - Current User:', currentUser);
      console.log('Debug - Adisyon ID:', adisyonId);
      console.log('Debug - User Role:', currentUser?.role);
      console.log('Debug - User UID:', currentUser?.uid);
      
      // Sipariş bilgisini bul
      const siparis = adisyonlar.find(ad => ad.id === adisyonId);
      if (!siparis) {
        throw new Error('Sipariş bulunamadı');
      }
      
      // Sipariş verisini console'a yazdır
      console.log('Sipariş verisi:', siparis);
      console.log('Sipariş anahtarları:', Object.keys(siparis));
      
      // adisyoncode değerlerini kontrol et
      console.log('ADİSYON CODE DEĞERLERİ:');
      console.log('- adisyoncode:', siparis.adisyoncode);
      console.log('- adisyonCode:', siparis.adisyonCode);
      console.log('- padsgnum:', siparis.padsgnum);
      console.log('- code:', siparis.code);
      console.log('- id:', siparis.id);
      
      // Şube alanlarını özellikle kontrol et
      const subeAlanlari = Object.keys(siparis).filter(key => 
        key.toLowerCase().includes('sube') || 
        key.toLowerCase().includes('branch') ||
        key.toLowerCase().includes('store')
      );
      console.log('Şube alanları:', subeAlanlari);
      subeAlanlari.forEach(alan => {
        console.log(`${alan}:`, siparis[alan]);
      });
      
      // Kurye kullanıcısının şube bilgilerini al
      console.log('Kurye kullanıcı verisi:', currentUser);
      const kuryeSubeId = currentUser?.subeId || currentUser?.sube_id || currentUser?.branchId;
      console.log('Kurye şube ID:', kuryeSubeId);
      
      const kuryeAdi = currentUser.displayName || currentUser.email;
      
      // Adisyon güncelle
      const adisyonRef = doc(db, 'Adisyonlar', adisyonId);
      await updateDoc(adisyonRef, {
        motorcu: kuryeAdi
      });
      
      // Kurye atama kaydı oluştur - kurye şube bilgisini kullan
      const atamaKaydi = {
        adisyonCode: siparis.adisyoncode || siparis.adisyonCode || siparis.padsgnum || siparis.code || siparis.id || 'BILINMIYOR',
        kuryeAdi: kuryeAdi,
        kuryeId: currentUser.uid,
        atamaTarihi: serverTimestamp(),
        siparisTarihi: siparis.tarih || siparis.createdAt || new Date().toISOString(),
        subeId: kuryeSubeId || siparis.subeId || siparis.sube_id || siparis.subeID || 'KURYE_SUBESI_BILINMIYOR',
        subeAdi: siparis.subeAdi || siparis.sube_adi || siparis.subeAd || siparis.sube || siparis.branchName || siparis.storeName || 'Bilinmiyor',
        toplam: siparis.atop || siparis.toplam || siparis.total || siparis.amount || 0,
        durum: 'Atandı',
        atayanRole: 'kurye' // Kurye kendi üzerine aldı
      };
      
      console.log('Atama kaydı:', atamaKaydi);
      
      await addDoc(collection(db, 'kuryeatama'), atamaKaydi);
      
      console.log('Sipariş üzerine alındı ve kurye atama kaydı oluşturuldu');
      
      // Show success notification
      setNotification({
        show: true,
        message: 'Sipariş başarıyla üzerinize alındı!',
        type: 'success'
      });
      
      // Auto-hide notification after 3 seconds
      setTimeout(() => {
        setNotification({ show: false, message: '', type: '' });
      }, 3000);
    } catch (error) {
      console.error('Sipariş üzerine alma hatası:', error);
      console.error('Error details:', error.code, error.message);
      
      // Show error notification
      setNotification({
        show: true,
        message: 'Sipariş üzerine alma sırasında bir hata oluştu: ' + error.message,
        type: 'error'
      });
      
      // Auto-hide notification after 3 seconds
      setTimeout(() => {
        setNotification({ show: false, message: '', type: '' });
      }, 3000);
    }
  };

  // Tarih formatla
  const formatDate = (dateString) => {
    if (!dateString) return 'Bilinmiyor';
    try {
      let date;
      
      if (dateString.includes('T')) {
        date = new Date(dateString);
      } else if (dateString.includes(' ')) {
        date = new Date(dateString.replace(' ', 'T'));
      } else {
        date = new Date(dateString);
      }
      
      return date.toLocaleString('tr-TR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (err) {
      console.error('Tarih formatla hatası:', err);
      return dateString;
    }
  };

  // Tutar formatla
  const formatAmount = (amount) => {
    if (!amount) return '0,00 ₺';
    return Number(amount).toLocaleString('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + ' ₺';
  };

  // Sipariş tipini belirle
  const getSiparisTipi = (siparisnerden) => {
    switch (siparisnerden) {
      case 0:
        return { text: 'Telefon', icon: 'phone', color: 'info' };
      case 1:
        return { text: 'Yemek Sepeti', icon: 'delivery_dining', color: 'warning' };
      case 2:
        return { text: 'Getir', icon: 'motorcycle', color: 'success' };
      case 5:
        return { text: 'Trendyol', icon: 'shopping_bag', color: 'danger' };
      case 8:
        return { text: 'Migros', icon: 'store', color: 'secondary' };
      case 88:
        return { text: 'Masa', icon: 'table_restaurant', color: 'primary' };
      default:
        return { text: 'Diğer', icon: 'receipt', color: 'secondary' };
    }
  };

  const isCourier = currentUser?.role === 'kurye';
  const canAssignCourier = currentUser?.role === 'sube_yoneticisi'; // Sadece şube müdürü kurye atayabilir

  console.log('🎯 isCourier:', isCourier);
  console.log('🎯 canAssignCourier:', canAssignCourier);
  console.log('🎯 currentUser?.role:', currentUser?.role);

  // Şirket yöneticisi için erişim engeli
  if (currentUser?.role === 'sirket_yoneticisi') {
    return (
      <div className="kurye-atama-container">
        <div className="page-header">
          <div className="header-content">
            <div className="title-section">
              <h1>
                <span className="material-icons">block</span>
                Erişim Engellendi
              </h1>
              <p>
                Şirket yöneticileri kurye atama işlemlerine erişemez. Bu işlemler sadece şube müdürleri ve kuryeler tarafından yapılabilir.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="kurye-atama-container">
      {/* Success Notification */}
      {notification.show && (
        <div className="notification-backdrop">
          <div className={`notification-popup ${notification.type}`}>
            <div className="notification-content">
              <span className="material-icons">
                {notification.type === 'success' ? 'check_circle' : 
                 notification.type === 'error' ? 'error' : 'info'}
              </span>
              <span>{notification.message}</span>
            </div>
          </div>
        </div>
      )}
      
      <div className="content-area">
        {loading ? (
          <div className="loading-text">Siparişler yükleniyor...</div>
        ) : adisyonlar.length === 0 ? (
          <div className="no-data">
            {isCourier 
              ? 'Kurye bekleyen teslimat siparişi bulunmamaktadır.'
              : 'Kurye bekleyen teslimat siparişi bulunmamaktadır.'
            }
          </div>
        ) : (
          <div className="adisyonlar-table-container">
            <div className="table-header">
              <h3>
                <span className="material-icons">list</span>
                Teslimat Bekleyen Siparişler
              </h3>
              <div className="table-info">
                Toplam {adisyonlar.length} teslimat siparişi
              </div>
            </div>
            
            {/* Mobile Cards */}
            <div className="mobile-cards">
              {adisyonlar.map((adisyon) => {
                const tip = getSiparisTipi(adisyon.siparisnerden);
                
                return (
                  <div 
                    key={adisyon.id} 
                    className="mobile-card clickable-card"
                    onClick={() => {
                      setSelectedAdisyon(adisyon);
                      setShowDetailModal(true);
                    }}
                  >
                    <div className="card-header">
                      <div className="siparis-info">
                        <span className="material-icons">receipt</span>
                        <span className="siparis-no">{adisyon.padsgnum || 'Numara Yok'}</span>
                      </div>
                      <span className={`tip-badge ${tip.color}`}>
                        <span className="material-icons">{tip.icon}</span>
                        {tip.text}
                      </span>
                    </div>
                    
                    <div className="card-body">
                      <div className="info-row">
                        <span className="label">Tarih & Tutar:</span>
                        <div className="value-combined">
                          <span className="date-value">{formatDate(adisyon.tarih)}</span>
                          <span className="amount-value">{formatAmount(adisyon.atop)}</span>
                        </div>
                      </div>
                    </div>
                    
                    {!isCourier && canAssignCourier && (
                      <div className="card-actions">
                        <button
                          className="action-button assign"
                          onClick={(e) => {
                            e.stopPropagation(); // Card click'ini engelle
                            setAtanacakAdisyon(adisyon);
                          }}
                        >
                          <span className="material-icons">assignment_ind</span>
                          Kurye Ata
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            
            {/* Desktop Table - Hidden on mobile */}
            <table className="adisyonlar-table desktop-only">
              <thead>
                <tr>
                  <th>Sipariş No</th>
                  <th>Tarih</th>
                  <th>Tip</th>
                  <th>Toplam</th>
                  <th>Durum</th>
                  <th>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {adisyonlar.map((adisyon) => {
                  const tip = getSiparisTipi(adisyon.siparisnerden);
                  
                  return (
                    <tr key={adisyon.id}>
                      <td>
                        <div className="siparis-info">
                          <span className="material-icons">receipt</span>
                          {adisyon.padsgnum || 'Numara Yok'}
                        </div>
                      </td>
                      <td>{formatDate(adisyon.tarih)}</td>
                      <td>
                        <span className={`tip-badge ${tip.color}`}>
                          <span className="material-icons">{tip.icon}</span>
                          {tip.text}
                        </span>
                      </td>
                      <td>
                        <span className="amount-text">
                          {formatAmount(adisyon.atop)}
                        </span>
                      </td>
                      <td>
                        <span className="durum-badge warning">
                          <span className="material-icons">pending</span>
                          Kurye Bekliyor
                        </span>
                      </td>
                      <td>
                        <div className="table-actions">
                          <button
                            className="action-button detail"
                            onClick={() => {
                              setSelectedAdisyon(adisyon);
                              setShowDetailModal(true);
                            }}
                            title="Detay Görüntüle"
                          >
                            <span className="material-icons">visibility</span>
                          </button>
                          
                          {isCourier ? (
                            // Kurye için - üzerine al
                            <button
                              className="action-button take"
                              onClick={() => {
                                console.log('🎯 DESKTOP BUTTON CLICKED - Executing function...');
                                handleKuryeKendiUzerineAl(adisyon.id);
                              }}
                              title="Üzerime Al"
                            >
                              <span className="material-icons">add_task</span>
                            </button>
                          ) : canAssignCourier ? (
                            // Yöneticiler için - kurye atama
                            <button
                              className="action-button assign"
                              onClick={() => setAtanacakAdisyon(adisyon)}
                              title="Kurye Ata"
                            >
                              <span className="material-icons">assignment_ind</span>
                            </button>
                          ) : (
                            // Yetki yok
                            <button
                              className="action-button info"
                              title="Yetki Yok"
                              disabled
                            >
                              <span className="material-icons">lock</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Kurye Atama Modal */}
      {atanacakAdisyon && (
        <div className="modal-overlay" onClick={() => setAtanacakAdisyon(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                <span className="material-icons">assignment_ind</span>
                Kurye Atama
              </h2>
              <button 
                className="close-button"
                onClick={() => setAtanacakAdisyon(null)}
              >
                <span className="material-icons">close</span>
              </button>
            </div>
            
            <div className="modal-body">
              <div className="siparis-bilgi">
                <h4>Sipariş Bilgileri</h4>
                <p><strong>Sipariş No:</strong> {atanacakAdisyon.padsgnum}</p>
                <p><strong>Tarih:</strong> {formatDate(atanacakAdisyon.tarih)}</p>
                <p><strong>Toplam:</strong> {formatAmount(atanacakAdisyon.atop)}</p>
              </div>
              
              <div className="kurye-secim">
                <label htmlFor="kurye-select">Kurye Seçin:</label>
                <select
                  id="kurye-select"
                  value={selectedKurye}
                  onChange={(e) => setSelectedKurye(e.target.value)}
                >
                  <option value="">Kurye seçin...</option>
                  {kuryeler.map((kurye) => (
                    <option key={kurye.id} value={kurye.displayName || kurye.email}>
                      {kurye.displayName || kurye.email}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="modal-footer">
              <button 
                className="btn-secondary"
                onClick={() => setAtanacakAdisyon(null)}
              >
                İptal
              </button>
              <button 
                className="btn-primary"
                onClick={() => handleKuryeAtama(atanacakAdisyon.id, selectedKurye)}
                disabled={!selectedKurye}
              >
                <span className="material-icons">assignment_ind</span>
                Kurye Ata
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Adisyon Detay Modal */}
      <AdisyonDetailModal
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedAdisyon(null);
        }}
        adisyon={selectedAdisyon}
        isCourier={isCourier}
        onKuryeUzerineAl={handleKuryeKendiUzerineAl}
      />
    </div>
  );
};

export default KuryeAtamaPage;
