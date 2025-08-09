import React, { useState, useEffect, useContext } from 'react';
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, query, where } from 'firebase/firestore';
import { AuthContext } from '../contexts/AuthContext';
import './SubeSiparisOlusturmaPage.css';

const SubeSiparisOlusturmaPage = () => {
  const [urunler, setUrunler] = useState([]);
  const [siparisListesi, setSiparisListesi] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showMiktarModal, setShowMiktarModal] = useState(false);
  const [showSepetModal, setShowSepetModal] = useState(false);
  const [selectedUrun, setSelectedUrun] = useState(null);
  const [miktar, setMiktar] = useState(1);
  const [subeInfo, setSubeInfo] = useState(null);
  const [subeler, setSubeler] = useState([]);
  const [selectedSubeId, setSelectedSubeId] = useState('');
  const [selectedSubeInfo, setSelectedSubeInfo] = useState(null);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);
  const { currentUser } = useContext(AuthContext);

  const db = getFirestore();

  // localStorage key for basket persistence
  const SEPET_KEY = `siparis_sepeti_${currentUser?.uid || 'guest'}`;

  // Ürünleri ve şube bilgilerini getir
  useEffect(() => {
    console.log('useEffect çalıştı, currentUser:', currentUser);
    
    // Önce kullanıcı bilgisini kontrol et
    if (currentUser) {
      console.log('Kullanıcı bilgileri:', {
        uid: currentUser.uid,
        email: currentUser.email,
        role: currentUser.role,
        subeId: currentUser.subeId,
        subeAdi: currentUser.subeAdi
      });
      
      // Şubeleri getir (rol ne olursa olsun)
      fetchSubeler();
      
      // Şube bilgilerini getir
      fetchSubeInfo();
    }
    
    // Ürünleri her durumda getir
    fetchUrunler();
    
    // Sepeti localStorage'dan yükle
    loadSepetiFromStorage();
  }, [currentUser]);

  // Save basket to localStorage whenever siparisListesi changes
  useEffect(() => {
    if (siparisListesi.length > 0) {
      localStorage.setItem(SEPET_KEY, JSON.stringify(siparisListesi));
    } else {
      localStorage.removeItem(SEPET_KEY);
    }
  }, [siparisListesi]);

  // Scroll pozisyonu yönetimi - Modal açıldığında scroll kontrolü
  useEffect(() => {
    if (showMiktarModal || showSepetModal) {
      // Mevcut scroll pozisyonunu kaydet
      setScrollPosition(window.pageYOffset);
      // Sayfayı üste kaydır
      window.scrollTo({ top: 0, behavior: 'smooth' });
      // Body scroll'unu engelle
      document.body.style.overflow = 'hidden';
    } else {
      // Body scroll'unu geri aç
      document.body.style.overflow = '';
      // Eski pozisyona geri dön
      if (scrollPosition > 0) {
        window.scrollTo({ top: scrollPosition, behavior: 'smooth' });
      }
    }

    // Cleanup function
    return () => {
      document.body.style.overflow = '';
    };
  }, [showMiktarModal, showSepetModal, scrollPosition]);

  const loadSepetiFromStorage = () => {
    try {
      const savedSepet = localStorage.getItem(SEPET_KEY);
      if (savedSepet) {
        setSiparisListesi(JSON.parse(savedSepet));
      }
    } catch (error) {
      console.error('Sepet yüklenirken hata:', error);
    }
  };

  const fetchSubeler = async () => {
    try {
      console.log('fetchSubeler çalıştırılıyor, currentUser role:', currentUser?.role);
      
      let subeQuery;
      
      if (currentUser?.role === 'sirket_yoneticisi') {
        // Şirket yöneticisi tüm şubeleri görebilir
        console.log('Şirket yöneticisi - tüm şubeler getiriliyor');
        subeQuery = collection(db, 'subeler');
      } else if (currentUser?.subeId) {
        // Diğer kullanıcılar sadece kendi şubelerini görebilir
        console.log('Şube kullanıcısı - sadece kendi şubesi getiriliyor:', currentUser.subeId);
        subeQuery = query(
          collection(db, 'subeler'), 
          where('__name__', '==', currentUser.subeId)
        );
      } else {
        console.log('Kullanıcı rolü bulunamadı veya şube ID yok');
        return;
      }

      const querySnapshot = await getDocs(subeQuery);
      const subelerData = [];
      
      querySnapshot.forEach((doc) => {
        subelerData.push({ id: doc.id, ...doc.data() });
      });
      
      console.log('Şubeler:', subelerData);
      setSubeler(subelerData);
      
      // Şirket yöneticisi değilse otomatik olarak kullanıcının şubesini seç
      if (currentUser?.role !== 'sirket_yoneticisi' && subelerData.length > 0) {
        console.log('Otomatik şube seçimi yapılıyor:', subelerData[0].id);
        setSelectedSubeId(subelerData[0].id);
        setSelectedSubeInfo(subelerData[0]);
      }
    } catch (error) {
      console.error('Şubeler alınırken hata:', error);
    }
  };

  const fetchUrunler = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'urunler'));
      const urunlerData = [];
      querySnapshot.forEach((doc) => {
        urunlerData.push({ id: doc.id, ...doc.data() });
      });
      setUrunler(urunlerData);
    } catch (error) {
      console.error('Ürünler alınırken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubeInfo = async () => {
    console.log('fetchSubeInfo çağrıldı, currentUser:', currentUser);
    
    // Kullanıcıya ait bir şube ID'si var mı kontrol et (role bakmaksızın)
    if (currentUser?.subeId) {
      try {
        console.log('SubeId bulundu, şube bilgileri alınıyor:', currentUser.subeId);
        const subeDoc = await getDoc(doc(db, 'subeler', currentUser.subeId));
        
        if (subeDoc.exists()) {
          const subeData = { id: subeDoc.id, ...subeDoc.data() };
          console.log('Şube bilgileri alındı:', subeData);
          
          setSubeInfo(subeData);
          setSelectedSubeId(currentUser.subeId);
          setSelectedSubeInfo(subeData);
        } else {
          console.error('Bu ID ile bir şube bulunamadı:', currentUser.subeId);
        }
      } catch (error) {
        console.error('Şube bilgileri alınırken hata:', error);
      }
    } else {
      console.warn('Kullanıcıya ait bir subeId bulunamadı');
    }
  };

  const handleSubeSelect = async (subeId) => {
    console.log('Şube seçildi:', subeId);
    setSelectedSubeId(subeId);
    
    if (subeId) {
      try {
        const subeDoc = await getDoc(doc(db, 'subeler', subeId));
        if (subeDoc.exists()) {
          const subeData = { id: subeDoc.id, ...subeDoc.data() };
          console.log('Seçilen şube bilgileri:', subeData);
          setSelectedSubeInfo(subeData);
        } else {
          console.error('Bu ID ile bir şube bulunamadı:', subeId);
          setSelectedSubeInfo(null);
        }
      } catch (error) {
        console.error('Şube bilgileri alınırken hata:', error);
        setSelectedSubeInfo(null);
      }
    } else {
      setSelectedSubeInfo(null);
    }
  };

  const handleUrunClick = (urun) => {
    setSelectedUrun(urun);
    
    // Check if item is already in cart
    const existingItem = siparisListesi.find(item => item.urun.id === urun.id);
    
    // Set initial quantity based on existing cart item or default to 1
    if (existingItem) {
      setMiktar(existingItem.miktar);
    } else {
      setMiktar(1);
    }
    
    setShowMiktarModal(true);
  };

  const handleUrunEkle = () => {
    if (selectedUrun && miktar > 0) {
      const mevcutItem = siparisListesi.find(item => item.urun.id === selectedUrun.id);
      
      if (mevcutItem) {
        // Mevcut ürünün miktarını artır
        setSiparisListesi(prev => 
          prev.map(item => 
            item.urun.id === selectedUrun.id 
              ? { ...item, miktar: item.miktar + miktar, toplam_fiyat: (item.miktar + miktar) * item.urun.fiyat }
              : item
          )
        );
      } else {
        // Yeni ürün ekle
        setSiparisListesi(prev => [
          ...prev,
          {
            urun: selectedUrun,
            miktar: miktar,
            toplam_fiyat: selectedUrun.fiyat * miktar
          }
        ]);
      }
      
      setShowMiktarModal(false);
      setSelectedUrun(null);
      setMiktar(1);
    }
  };

  const handleUrunCikar = (urunId) => {
    setSiparisListesi(prev => prev.filter(item => item.urun.id !== urunId));
  };

  const handleMiktarGuncelle = (urunId, yeniMiktar) => {
    if (yeniMiktar > 0) {
      setSiparisListesi(prev =>
        prev.map(item =>
          item.urun.id === urunId
            ? { ...item, miktar: yeniMiktar, toplam_fiyat: item.urun.fiyat * yeniMiktar }
            : item
        )
      );
    }
  };

  const getTotalAmount = () => {
    return siparisListesi.reduce((total, item) => total + item.toplam_fiyat, 0);
  };

  const sepetiTemizle = () => {
    if (window.confirm('Sepeti temizlemek istediğinizden emin misiniz?')) {
      setSiparisListesi([]);
      localStorage.removeItem(SEPET_KEY);
    }
  };

  const handleSiparisOnayla = async () => {
    if (siparisListesi.length === 0) {
      alert('Sipariş listesi boş!');
      return;
    }

    // Şube seçim kontrolü
    let targetSubeId, targetSubeAdi;
    
    if (currentUser?.role === 'sirket_yoneticisi') {
      if (!selectedSubeId) {
        alert('Lütfen bir şube seçin!');
        return;
      }
      
      targetSubeId = selectedSubeId;
      
      // selectedSubeInfo'dan hem sube_adi hem de subeAdi alanlarını kontrol et
      targetSubeAdi = selectedSubeInfo?.sube_adi || selectedSubeInfo?.subeAdi || 'Bilinmiyor';
      console.log('Şirket yöneticisi için hedef şube:', targetSubeId, targetSubeAdi);
    } else if (currentUser?.role === 'sube_yoneticisi' || currentUser?.role === 'sube_muduru') {
      if (!currentUser?.subeId) {
        console.error('Şube yöneticisi için şube ID bulunamadı:', currentUser);
        alert('Şube bilginiz bulunamadı!');
        return;
      }
      
      targetSubeId = currentUser.subeId;
      
      // Farklı olası alanlar için kontrol - öncelik sırası:
      // 1. selectedSubeInfo.sube_adi
      // 2. selectedSubeInfo.subeAdi
      // 3. subeInfo.sube_adi
      // 4. subeInfo.subeAdi
      // 5. currentUser.subeAdi
      targetSubeAdi = (selectedSubeInfo?.sube_adi) || 
                      (selectedSubeInfo?.subeAdi) || 
                      (subeInfo?.sube_adi) || 
                      (subeInfo?.subeAdi) || 
                      currentUser?.subeAdi || 
                      'Bilinmiyor';
                      
      console.log('Şube yöneticisi için hedef şube:', targetSubeId, targetSubeAdi);
    } else {
      console.error('Geçersiz rol:', currentUser?.role);
      alert('Bu işlem için yetkiniz bulunmamaktadır!');
      return;
    }

    try {
      const siparisData = {
        sube_id: targetSubeId,
        sube_adi: targetSubeAdi,
        siparis_veren: currentUser.displayName || currentUser.email,
        siparis_veren_role: currentUser.role,
        siparis_tarihi: new Date(),
        durum: 'beklemede', // beklemede, onaylandi, teslim_edildi, iptal
        toplam_tutar: getTotalAmount(),
        urunler: siparisListesi.map(item => ({
          urun_id: item.urun.id,
          urun_adi: item.urun.urun_adi,
          birim_olcusu: item.urun.birim_olcusu,
          birim_fiyat: item.urun.fiyat,
          miktar: item.miktar,
          toplam_fiyat: item.toplam_fiyat
        }))
      };

      await addDoc(collection(db, 'sube_siparisleri'), siparisData);
      
      // Sepeti temizle
      setSiparisListesi([]);
      localStorage.removeItem(SEPET_KEY);
      
      // Sepet modalını kapat
      setShowSepetModal(false);
      
      // Başarı animasyonunu göster
      setShowSuccessAnimation(true);
      
      // Animasyonu 3 saniye sonra kapat
      setTimeout(() => {
        setShowSuccessAnimation(false);
      }, 3000);
      
    } catch (error) {
      console.error('Sipariş oluşturulurken hata:', error);
      alert('Sipariş oluşturulurken bir hata oluştu!');
    }
  };

  return (
    <div className="sube-siparis-container">
      <div className="page-header">
        <div className="header-content">
          <div className="title-section">
            <h1>
              <span className="material-icons">add_shopping_cart</span>
              Şube Sipariş Oluşturma
            </h1>
            <p>
              {currentUser?.role === 'sirket_yoneticisi' 
                ? 'Şube seçerek sipariş oluşturun' 
                : selectedSubeInfo 
                  ? `${selectedSubeInfo.sube_adi || selectedSubeInfo.subeAdi} şubesi için sipariş oluşturun`
                  : subeInfo
                    ? `${subeInfo.sube_adi || subeInfo.subeAdi} şubesi için sipariş oluşturun`
                    : 'Şube siparişi oluşturun'
              }
            </p>
          </div>
          <div className="header-actions">
            <button 
              className="sepet-button"
              onClick={() => setShowSepetModal(true)}
            >
              <span className="material-icons">shopping_cart</span>
              Sepet ({siparisListesi.length})
              {siparisListesi.length > 0 && (
                <span className="sepet-badge">{siparisListesi.length}</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Şube Seçimi - Adisyonlar sayfasındaki gibi tasarım */}
      <div className="filters-section">
        <div className="filter-group">
          <label htmlFor="sube-select">Şube Seçin:</label>
          <select
            id="sube-select"
            value={selectedSubeId}
            onChange={(e) => handleSubeSelect(e.target.value)}
            className="sube-select"
            disabled={currentUser?.role !== 'sirket_yoneticisi'}
          >
            <option value="">Şube seçin...</option>
            {subeler.map((sube) => (
              <option key={sube.id} value={sube.id}>
                {sube.sube_adi || sube.subeAdi || `Şube ${sube.id}`} {sube.sehir ? `(${sube.sehir})` : ''}
              </option>
            ))}
          </select>
        </div>
        
        {selectedSubeInfo && (
          <div className="selected-sube-info">
            <p>
              <span className="material-icons">location_on</span>
              <strong>Seçili Şube:</strong> {selectedSubeInfo.sube_adi || selectedSubeInfo.subeAdi || `Şube ${selectedSubeInfo.id}`} 
              {selectedSubeInfo.sehir ? ` (${selectedSubeInfo.sehir})` : ''}
            </p>
          </div>
        )}
      </div>

      {/* İstatistik Kartları */}
      {siparisListesi.length > 0 && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon primary">
              <span className="material-icons">shopping_cart</span>
            </div>
            <div className="stat-info">
              <div className="stat-number">{siparisListesi.length}</div>
              <div className="stat-label">Sepetteki Ürün</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon success">
              <span className="material-icons">inventory_2</span>
            </div>
            <div className="stat-info">
              <div className="stat-number">
                {siparisListesi.reduce((total, item) => total + item.miktar, 0)}
              </div>
              <div className="stat-label">Toplam Miktar</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon danger">
              <span className="material-icons">payments</span>
            </div>
            <div className="stat-info">
              <div className="stat-number">₺{getTotalAmount().toFixed(2)}</div>
              <div className="stat-label">Toplam Tutar</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon warning">
              <span className="material-icons">calculate</span>
            </div>
            <div className="stat-info">
              <div className="stat-number">₺{siparisListesi.length > 0 ? (getTotalAmount() / siparisListesi.reduce((total, item) => total + item.miktar, 0)).toFixed(2) : '0.00'}</div>
              <div className="stat-label">Ortalama Birim Fiyat</div>
            </div>
          </div>
        </div>
      )}

      <div className="content-area">
        <div className="urunler-section">
          <h3>
            <span className="material-icons">inventory_2</span>
            Ürünler
          </h3>
          
          {loading ? (
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <p>Ürünler yükleniyor...</p>
            </div>
          ) : urunler.length === 0 ? (
            <div className="empty-state">
              <span className="material-icons">inventory_2</span>
              <h3>Ürün Bulunamadı</h3>
              <p>Henüz sisteme ürün eklenmemiş.</p>
            </div>
          ) : (
            <div className="urunler-grid">
              {urunler.map((urun) => {
                // Check if this product is already in cart
                const inCart = siparisListesi.find(item => item.urun.id === urun.id);
                
                return (
                  <div 
                    key={urun.id} 
                    className={`urun-card ${inCart ? 'in-cart' : ''}`}
                    onClick={() => handleUrunClick(urun)}
                  >
                    {inCart && (
                      <div className="cart-badge">
                        <span>{inCart.miktar}</span>
                      </div>
                    )}
                    <div className="urun-icon">
                      <span className="material-icons">inventory_2</span>
                    </div>
                    <div className="urun-info">
                      <h4>{urun.urun_adi}</h4>
                      <p className="urun-birim">{urun.birim_olcusu}</p>
                      <p className="urun-fiyat">₺{urun.fiyat.toFixed(2)}</p>
                    </div>
                    <div className="add-to-cart-container">
                      <button className="add-to-cart-button" onClick={(e) => {
                        e.stopPropagation();
                        handleUrunClick(urun);
                      }}>
                        <span className="material-icons">add_shopping_cart</span>
                        <span>{inCart ? 'Güncelle' : 'Sepete Ekle'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Başarılı Sipariş Animasyonu */}
      {showSuccessAnimation && (
        <div className="success-animation-overlay">
          <div className="success-animation-content">
            <div className="success-icon">
              <span className="material-icons">check_circle</span>
            </div>
            <h2>Sipariş Başarıyla Oluşturuldu!</h2>
            <p>{currentUser?.role === 'sirket_yoneticisi' ? 'Şube siparişiniz başarıyla kaydedildi.' : 'Siparişiniz başarıyla kaydedildi.'}</p>
          </div>
        </div>
      )}

      {/* Miktar Seçim Modal */}
      {showMiktarModal && selectedUrun && (
        <div className="modal-overlay" onClick={() => setShowMiktarModal(false)}>
          <div className="modal-content miktar-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                <span className="material-icons">inventory_2</span>
                {selectedUrun.urun_adi}
              </h2>
              <button onClick={() => setShowMiktarModal(false)} className="close-button">
                <span className="material-icons">close</span>
              </button>
            </div>
            
            <div className="modal-body">
              <div className="urun-detay">
                <p><strong>Birim:</strong> {selectedUrun.birim_olcusu}</p>
                <p><strong>Fiyat:</strong> ₺{selectedUrun.fiyat.toFixed(2)}</p>
              </div>
              
              <div className="miktar-secimi">
                <label htmlFor="miktar">Miktar Seçiniz:</label>
                <div className="miktar-input-group">
                  <button 
                    type="button"
                    onClick={() => setMiktar(Math.max(1, miktar - 1))}
                    disabled={miktar <= 1}
                  >
                    <span className="material-icons">remove</span>
                  </button>
                  <input
                    type="number"
                    id="miktar"
                    value={miktar}
                    onChange={(e) => setMiktar(Math.max(1, parseInt(e.target.value) || 1))}
                    min="1"
                  />
                  <button 
                    type="button"
                    onClick={() => setMiktar(miktar + 1)}
                  >
                    <span className="material-icons">add</span>
                  </button>
                </div>
                <span className="birim-label">{selectedUrun.birim_olcusu}</span>
              </div>
              
              <div className="toplam-fiyat">
                <strong>Toplam: ₺{(selectedUrun.fiyat * miktar).toFixed(2)}</strong>
              </div>
            </div>
            
            <div className="modal-footer">
              <button onClick={() => setShowMiktarModal(false)} className="cancel-button">
                <span className="material-icons">close</span>
                İptal
              </button>
              <button onClick={handleUrunEkle} className="add-button">
                <span className="material-icons">add_shopping_cart</span>
                Sepete Ekle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sepet Modal */}
      {showSepetModal && (
        <div className="modal-overlay" onClick={() => setShowSepetModal(false)}>
          <div className="modal-content sepet-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="cart-header-content">
                <span className="material-icons">shopping_cart</span>
                <h2>Alışveriş Sepeti</h2>
                {siparisListesi.length > 0 && (
                  <div className="cart-item-count">{siparisListesi.length}</div>
                )}
              </div>
              <button onClick={() => setShowSepetModal(false)} className="close-button">
                <span className="material-icons">close</span>
              </button>
            </div>
            
            <div className="modal-body sepet-modal-body">
              {siparisListesi.length === 0 ? (
                <div className="empty-sepet">
                  <span className="material-icons">shopping_cart_checkout</span>
                  <p>Sepetiniz boş</p>
                  <small>Ürünlere tıklayarak sepete ekleyin</small>
                </div>
              ) : (
                <>
                  <div className="sepet-items">
                    {siparisListesi.map((item) => (
                      <div key={item.urun.id} className="sepet-item">
                        <div className="item-info">
                          <div className="item-icon">
                            <span className="material-icons">inventory_2</span>
                          </div>
                          <div>
                            <h5>{item.urun.urun_adi}</h5>
                            <p className="item-details">
                              <span className="price-tag">₺{item.urun.fiyat.toFixed(2)} / {item.urun.birim_olcusu}</span>
                            </p>
                          </div>
                        </div>
                        <div className="item-controls">
                          <div className="miktar-controls">
                            <button 
                              onClick={() => handleMiktarGuncelle(item.urun.id, item.miktar - 1)}
                              disabled={item.miktar <= 1}
                              title="Azalt"
                            >
                              <span className="material-icons">remove</span>
                            </button>
                            <span className="miktar">{item.miktar}</span>
                            <button 
                              onClick={() => handleMiktarGuncelle(item.urun.id, item.miktar + 1)}
                              title="Artır"
                            >
                              <span className="material-icons">add</span>
                            </button>
                          </div>
                          <div className="item-total">₺{item.toplam_fiyat.toFixed(2)}</div>
                          <button 
                            className="remove-item"
                            onClick={() => handleUrunCikar(item.urun.id)}
                            title="Sepetten Çıkar"
                          >
                            <span className="material-icons">delete</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="sepet-ozet">
                    <div className="summary-rows">
                      <div className="summary-row">
                        <span>Ürün sayısı:</span>
                        <span>{siparisListesi.length} ürün</span>
                      </div>
                      <div className="summary-row">
                        <span>Toplam miktar:</span>
                        <span>{siparisListesi.reduce((total, item) => total + item.miktar, 0)} birim</span>
                      </div>
                      <div className="summary-divider"></div>
                      <div className="total-row">
                        <span>Toplam Tutar:</span>
                        <span className="total-amount">₺{getTotalAmount().toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
            
            <div className="modal-footer sepet-modal-footer">
              <button 
                onClick={sepetiTemizle} 
                className="temizle-button"
                disabled={siparisListesi.length === 0}
              >
                <span className="material-icons">clear</span>
                Sepeti Temizle
              </button>
              <button 
                onClick={handleSiparisOnayla} 
                className="onayla-button"
                disabled={
                  (currentUser?.role === 'sirket_yoneticisi' && !selectedSubeId) ||
                  siparisListesi.length === 0
                }
              >
                <span className="material-icons">check_circle</span>
                Siparişi Onayla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubeSiparisOlusturmaPage;
