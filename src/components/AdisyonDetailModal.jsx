import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import './AdisyonDetailModal.css';

const AdisyonDetailModal = ({ isOpen, onClose, adisyon, masa, isCourier, onKuryeUzerineAl }) => {
  const [adisyonIcerik, setAdisyonIcerik] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Modal açıldığında adisyon içeriğini getir
  useEffect(() => {
    if (isOpen && adisyon?.adisyoncode) {
      fetchAdisyonIcerik();
    }
  }, [isOpen, adisyon]);

  // Modal açıldığında sayfayı en üste kaydır ve arka plan kaydırmayı kilitle
  useEffect(() => {
    if (isOpen) {
      try {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';
      } catch (_) {
        // ignore
      }
    } else {
      // modal kapandığında geri aç
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    }

    // güvenli temizlik (component unmount)
    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const fetchAdisyonIcerik = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('Adisyon içeriği getiriliyor, adisyoncode:', adisyon.adisyoncode);
      
      const icerikQuery = query(
        collection(db, 'AdisyonIcerik'),
        where('adisyoncode', '==', adisyon.adisyoncode)
      );
      
      const querySnapshot = await getDocs(icerikQuery);
      const icerikList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      console.log('Getirilen adisyon içeriği:', icerikList);
      setAdisyonIcerik(icerikList);
    } catch (err) {
      console.error('Adisyon içeriği getirilirken hata:', err);
      setError('Adisyon içeriği yüklenirken bir hata oluştu: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Modal kapatıldığında state'i temizle
  useEffect(() => {
    if (!isOpen) {
      setAdisyonIcerik([]);
      setError(null);
    }
  }, [isOpen]);

  // Modal dışına tıklandığında kapat
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Tarih formatla
  const formatDate = (dateString) => {
    if (!dateString) return '-';
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
        minute: '2-digit',
        second: '2-digit'
      });
    } catch (err) {
      console.error('Tarih formatla hatası:', err, 'Tarih:', dateString);
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

  // Adisyonun tipini belirle
  const getAdisyonTipi = (siparisnerden) => {
    switch (siparisnerden) {
      case 0:
        return { text: 'Telefon Siparişi', icon: 'phone', color: 'info' };
      case 1:
        return { text: 'Yemek Sepeti', icon: 'delivery_dining', color: 'warning' };
      case 2:
        return { text: 'Getir', icon: 'motorcycle', color: 'success' };
      case 5:
        return { text: 'Trendyol', icon: 'shopping_bag', color: 'danger' };
      case 8:
        return { text: 'Migros', icon: 'store', color: 'secondary' };
      case 88:
        return { text: 'Masa Siparişi', icon: 'table_restaurant', color: 'primary' };
      default:
        return { text: 'Diğer', icon: 'receipt', color: 'secondary' };
    }
  };

  // Adisyon durumunu belirle
  const getAdisyonDurum = (adisyon_durum, durum) => {
    // Önce string durum kontrolü (paket siparişler için)
    if (durum) {
      const durumUpper = durum.toUpperCase();
      switch (durumUpper) {
        case 'YENİ':
        case 'YENI':
          return { text: 'Yeni Sipariş', icon: 'fiber_new', color: 'info' };
        case 'ONAYLANDI':
          return { text: 'Onaylandı', icon: 'check_circle', color: 'success' };
        case 'GÖNDERİLDİ':
        case 'GONDERILDI':
          return { text: 'Gönderildi', icon: 'local_shipping', color: 'primary' };
        case 'İPTAL':
        case 'IPTAL':
          return { text: 'İptal Edildi', icon: 'cancel', color: 'danger' };
        default:
          return { text: durum, icon: 'info', color: 'secondary' };
      }
    }
    
    // Sayısal durum kontrolü (masa siparişleri için)
    switch (adisyon_durum) {
      case 1:
        return { text: 'Açık', icon: 'restaurant', color: 'warning' };
      case 4:
        return { text: 'Tamamlandı', icon: 'check_circle', color: 'success' };
      default:
        return { text: 'Bilinmiyor', icon: 'help', color: 'secondary' };
    }
  };

  // Ödeme tipini belirle
  const getOdemeTipi = (odemetipi) => {
    console.log('Ödeme tipi verisi:', odemetipi, typeof odemetipi);
    
    // String olarak gelebilir, sayıya çevir
    const tip = parseInt(odemetipi);
    
    switch (tip) {
      case 0:
        return { text: 'Nakit', icon: 'payments', color: 'success' };
      case 1:
        return { text: 'Kredi Kartı', icon: 'credit_card', color: 'primary' };
      case 2:
        return { text: 'Ticket Restaurant', icon: 'card_giftcard', color: 'warning' };
      case 3:
        return { text: 'Sodexo', icon: 'card_giftcard', color: 'info' };
      case 4:
        return { text: 'Veresiye', icon: 'schedule', color: 'secondary' };
      case 5:
        return { text: 'Online Ödeme', icon: 'online_prediction', color: 'primary' };
      default:
        console.log('Bilinmeyen ödeme tipi:', odemetipi);
        return { text: (odemetipi ?? '').toString() || 'Diğer', icon: 'payment', color: 'secondary' };
    }
  };

  // Koordinat bilgilerinin geçerliliğini kontrol et
  const hasValidCoordinates = (adisyon) => {
    if (!adisyon) return false;
    
    const lat = adisyon.lat || adisyon.latitude;
    const lng = adisyon.lng || adisyon.longitude;
    
    // Koordinatların hem var hem de geçerli değer olması gerekiyor
    const isValidLat = lat !== null && lat !== undefined && lat !== '' && lat !== 0 && !isNaN(parseFloat(lat));
    const isValidLng = lng !== null && lng !== undefined && lng !== '' && lng !== 0 && !isNaN(parseFloat(lng));
    
    return isValidLat && isValidLng;
  };

  if (!isOpen) return null;

  const tip = adisyon ? getAdisyonTipi(adisyon.siparisnerden) : null;
  const durum = adisyon ? getAdisyonDurum(adisyon.adisyon_durum, adisyon.durum) : null;

  // Debug için adisyon verilerini kontrol et
  if (adisyon) {
    console.log('Adisyon verileri:', adisyon);
    console.log('Ödeme ile ilgili alanlar:', {
      odemetipi: adisyon.odemetipi,
      odemeTipi: adisyon.odemeTipi,
      payment_type: adisyon.payment_type,
      odeme_tipi: adisyon.odeme_tipi
    });
  }

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal-content">
        <div className="modal-header">
          <div className="modal-title">
            <span className="material-icons">receipt_long</span>
            <div>
              <h2>Sipariş #{adisyon?.padsgnum || 'Numara Yok'}</h2>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <span className="material-icons">close</span>
          </button>
        </div>

        {/* Teslimat Bilgileri - Başlığın Hemen Altında */}
        {(adisyon?.siparisadres || adisyon?.adres || adisyon?.address || adisyon?.teslimat_adresi || 
          (adisyon && adisyon.siparisnerden !== 88)) && (
          <div className="delivery-info-section">
            <div className="delivery-content">
              {(adisyon?.siparisadres || adisyon?.adres || adisyon?.address || adisyon?.teslimat_adresi) ? (
                <div className="address-info enlarged-address">
                  <div className="address-icon">
                    <span className="material-icons">location_on</span>
                  </div>
                  <div className="address-details">
                    <span className="address-text">{adisyon.siparisadres || adisyon.adres || adisyon.address || adisyon.teslimat_adresi}</span>
                  </div>
                  {hasValidCoordinates(adisyon) && (
                    <button 
                      className="btn-map-small" 
                      onClick={() => {
                        const lat = adisyon.lat || adisyon.latitude;
                        const lng = adisyon.lng || adisyon.longitude;
                        const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                        const mapUrl = isMobile 
                          ? `https://maps.google.com/maps?q=${lat},${lng}&navigate=yes`
                          : `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
                        window.open(mapUrl, '_blank');
                      }}
                      title="Haritada Göster"
                    >
                      <span className="material-icons">map</span>
                    </button>
                  )}
                </div>
              ) : adisyon && adisyon.siparisnerden !== 88 && (
                <div className="address-info enlarged-address">
                  <span className="material-icons">location_on</span>
                  <span className="address-text">Teslimat adresi bilgisi bekleniyor...</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sipariş Bilgileri */}
        <div className="order-info-section">
          <div className="order-info-grid">
            <div className="info-item date-amount-row">
              <div className="date-info-container">
                <span className="material-icons">schedule</span>
                <div>
                  <span className="info-label">Tarih</span>
                  <span className="info-value">{formatDate(adisyon?.tarih)}</span>
                </div>
              </div>
              <div className="amount-info-container">
                <span className="material-icons">payments</span>
                <div>
                  <span className="info-label">Toplam Tutar</span>
                  <span className="info-value amount">{formatAmount(adisyon?.atop)}</span>
                </div>
              </div>
            </div>
            {(adisyon?.odemetipi !== undefined && adisyon?.odemetipi !== null && adisyon?.odemetipi !== '') || 
             (adisyon?.odemeTipi !== undefined && adisyon?.odemeTipi !== null && adisyon?.odemeTipi !== '') || 
             (adisyon?.payment_type !== undefined && adisyon?.payment_type !== null && adisyon?.payment_type !== '') ||
             (adisyon?.odeme_tipi !== undefined && adisyon?.odeme_tipi !== null && adisyon?.odeme_tipi !== '') ? (
              <div className="info-item">
                <span className="material-icons">{getOdemeTipi(adisyon.odemetipi || adisyon.odemeTipi || adisyon.payment_type || adisyon.odeme_tipi).icon}</span>
                <div>
                  <span className="info-label">Ödeme Tipi</span>
                  <span className={`info-value payment-${getOdemeTipi(adisyon.odemetipi || adisyon.odemeTipi || adisyon.payment_type || adisyon.odeme_tipi).color}`}>
                    {getOdemeTipi(adisyon.odemetipi || adisyon.odemeTipi || adisyon.payment_type || adisyon.odeme_tipi).text}
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="modal-body">
          {/* Adisyon İçeriği */}
          <div className="adisyon-content-section">
            <h3>
              <span className="material-icons">restaurant_menu</span>
              Sipariş İçeriği
            </h3>
            
            {loading && (
              <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Sipariş içeriği yükleniyor...</p>
              </div>
            )}

            {error && (
              <div className="error-message">
                <span className="material-icons">error</span>
                {error}
              </div>
            )}

            {!loading && !error && adisyonIcerik.length === 0 && (
              <div className="empty-content">
                <span className="material-icons">inbox</span>
                <p>Bu adisyon için sipariş içeriği bulunamadı.</p>
              </div>
            )}

            {!loading && !error && adisyonIcerik.length > 0 && (
              <div className="content-list">
                {adisyonIcerik.map((item, index) => {
                  const miktar = Number(item.miktar) || Number(item.adet) || 0;
                  const birimFiyat = Number(item.birimfiyat) || Number(item.fiyat) || 0;
                  const hesaplananToplam = miktar * birimFiyat;
                  const mevcutToplam = Number(item.toplam) || Number(item.tutar) || hesaplananToplam;

                  return (
                    <div key={item.id || index} className="content-item">
                      <div className="item-header">
                        <div className="item-name">
                          <span className="material-icons">restaurant</span>
                          {item.urunadi || 'Ürün adı bulunamadı'}
                        </div>
                        <div className="item-right">
                          <span className="item-qty">x {miktar}</span>
                          <span className="item-total">{formatAmount(mevcutToplam)}</span>
                        </div>
                      </div>

                      {item.aciklama && (
                        <div className="item-details">
                          <div className="detail-grid">
                            <div className="detail-item full-width">
                              <span className="detail-label">Açıklama:</span>
                              <span className="detail-value">{item.aciklama}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Genel toplam bölümü kaldırıldı */}
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <div className="buttons-container">
            <button className="btn-secondary" onClick={onClose}>
              <span className="material-icons">close</span>
              Kapat
            </button>
            {isCourier && adisyon && onKuryeUzerineAl && (
              <button 
                className="btn-primary kurye-action" 
                onClick={() => {
                  onKuryeUzerineAl(adisyon.id);
                  onClose();
                }}
              >
                <span className="material-icons">add_task</span>
                Üzerime Al
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdisyonDetailModal;
