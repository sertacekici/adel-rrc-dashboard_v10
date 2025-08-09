import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, orderBy, onSnapshot, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import './GiderKaydiPage.css';

const GiderKaydiPage = () => {
  const { currentUser } = useAuth();
  const [giderKayitlari, setGiderKayitlari] = useState([]);
  const [giderKalemleri, setGiderKalemleri] = useState([]);
  const [subeler, setSubeler] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);

  // Form state
  const [formData, setFormData] = useState({
    giderKalemiId: '',
    aciklama: '',
    tutar: '',
    odemeKaynagi: 'gunluk_kasa',
    tarih: new Date().toISOString().split('T')[0],
    saat: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  });

  // Form validation errors
  const [errors, setErrors] = useState({});

  // Notification state
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });

  // Filter state
  const [filter, setFilter] = useState({
    startDate: '',
    endDate: '',
    giderKalemiId: '',
    odemeKaynagi: ''
  });

  useEffect(() => {
    // Aktif gider kalemlerini getir
    const fetchGiderKalemleri = async () => {
      try {
        const q = query(
          collection(db, 'giderKalemleri'),
          where('aktif', '==', true)
        );
        
        const snapshot = await getDocs(q);
        const items = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // Client-side sorting
        items.sort((a, b) => (a.ad || '').localeCompare(b.ad || ''));
        setGiderKalemleri(items);
      } catch (error) {
        console.error('Gider kalemleri getirme hatası:', error);
        setGiderKalemleri([]);
      }
    };

    // Şubeleri getir (eğer şirket yöneticisi ise)
    const fetchSubeler = async () => {
      if (currentUser?.role === 'sirket_yoneticisi') {
        try {
          const q = query(collection(db, 'subeler'));
          const snapshot = await getDocs(q);
          const items = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          
          // Client-side sorting
          items.sort((a, b) => (a.ad || '').localeCompare(b.ad || ''));
          setSubeler(items);
        } catch (error) {
          console.error('Şubeler getirme hatası:', error);
          setSubeler([]);
        }
      }
    };

    fetchGiderKalemleri();
    fetchSubeler();
  }, [currentUser]);

  useEffect(() => {
    // Gider kayıtlarını dinle
    if (!currentUser) {
      setLoading(false);
      return;
    }

    try {
      let q;
      
      if (currentUser.role === 'sube_yoneticisi') {
        // Şube müdürü sadece kendi şubesinin kayıtlarını görebilir
        q = query(
          collection(db, 'giderKayitlari'),
          where('subeId', '==', currentUser.subeId)
        );
      } else {
        // Şirket yöneticisi tüm kayıtları görebilir
        q = query(collection(db, 'giderKayitlari'));
      }

      const unsubscribe = onSnapshot(q, 
        (snapshot) => {
          const items = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          
          // Client-side sorting
          items.sort((a, b) => {
            const dateA = a.tarih?.toDate() || new Date(0);
            const dateB = b.tarih?.toDate() || new Date(0);
            return dateB - dateA; // En yeni önce
          });
          
          setGiderKayitlari(items);
          setLoading(false);
        }, 
        (error) => {
          console.error('Gider kayıtları dinleme hatası:', error);
          setGiderKayitlari([]);
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (error) {
      console.error('Gider kayıtları sorgu hatası:', error);
      setGiderKayitlari([]);
      setLoading(false);
    }
  }, [currentUser]);

  // Scroll pozisyonu yönetimi
  useEffect(() => {
    if (showForm) {
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
  }, [showForm, scrollPosition]);

  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => {
      setNotification({ show: false, message: '', type: '' });
    }, 3000);
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.giderKalemiId) {
      newErrors.giderKalemiId = 'Gider kalemi seçimi zorunludur';
    }

    if (!formData.aciklama.trim()) {
      newErrors.aciklama = 'Açıklama zorunludur';
    }

    if (!formData.tutar || parseFloat(formData.tutar) <= 0) {
      newErrors.tutar = 'Geçerli bir tutar giriniz';
    }

    if (!formData.tarih) {
      newErrors.tarih = 'Tarih seçimi zorunludur';
    }

    if (!formData.saat) {
      newErrors.saat = 'Saat seçimi zorunludur';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      const selectedGiderKalemi = giderKalemleri.find(item => item.id === formData.giderKalemiId);
      const now = new Date();
      
      // Tarih ve saat birleştirme
      const giderTarihi = new Date(`${formData.tarih}T${formData.saat}:00`);

      const giderKaydi = {
        giderKalemiId: formData.giderKalemiId,
        giderKalemiAdi: selectedGiderKalemi.ad,
        aciklama: formData.aciklama.trim(),
        tutar: parseFloat(formData.tutar),
        odemeKaynagi: formData.odemeKaynagi,
        tarih: giderTarihi,
        saat: formData.saat,
        olusturanKullanici: currentUser.uid,
        kullaniciAdi: currentUser.displayName || 'Kullanıcı',
        olusturmaTarihi: now,
        guncellemeTarihi: now
      };

      // Şube bilgisi ekle
      if (currentUser.subeId) {
        giderKaydi.subeId = currentUser.subeId;
        giderKaydi.subeAdi = currentUser.subeAdi || 'Bilinmeyen Şube';
      }

      await addDoc(collection(db, 'giderKayitlari'), giderKaydi);
      
      showNotification('Gider kaydı başarıyla eklendi');

      // Form'u temizle
      setFormData({
        giderKalemiId: '',
        aciklama: '',
        tutar: '',
        odemeKaynagi: 'gunluk_kasa',
        tarih: new Date().toISOString().split('T')[0],
        saat: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
      });
      setShowForm(false);
      setErrors({});

    } catch (error) {
      console.error('Gider kaydı ekleme hatası:', error);
      showNotification('Bir hata oluştu. Lütfen tekrar deneyin.', 'error');
    }
  };

  const resetForm = () => {
    setFormData({
      giderKalemiId: '',
      aciklama: '',
      tutar: '',
      odemeKaynagi: 'gunluk_kasa',
      tarih: new Date().toISOString().split('T')[0],
      saat: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
    });
    setShowForm(false);
    setErrors({});
  };

  const filteredGiderKayitlari = giderKayitlari.filter(item => {
    let matches = true;

    if (filter.startDate) {
      const itemDate = item.tarih.toDate();
      const startDate = new Date(filter.startDate);
      matches = matches && itemDate >= startDate;
    }

    if (filter.endDate) {
      const itemDate = item.tarih.toDate();
      const endDate = new Date(filter.endDate + 'T23:59:59');
      matches = matches && itemDate <= endDate;
    }

    if (filter.giderKalemiId) {
      matches = matches && item.giderKalemiId === filter.giderKalemiId;
    }

    if (filter.odemeKaynagi) {
      matches = matches && item.odemeKaynagi === filter.odemeKaynagi;
    }

    return matches;
  });

  const getTotalAmount = () => {
    return filteredGiderKayitlari.reduce((total, item) => total + item.tutar, 0);
  };

  if (loading) {
    return (
      <div className="gider-kaydi-container">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="gider-kaydi-container gider-kaydi-page">
      {/* Notification */}
      {notification.show && (
        <div className={`notification ${notification.type}`}>
          <span className="material-icons">
            {notification.type === 'success' ? 'check_circle' : 'error'}
          </span>
          {notification.message}
        </div>
      )}

      <div className="page-header">
        <div className="header-content">
          <div className="title-section">
            <h1>
              <span className="material-icons">receipt</span>
              Gider Kaydı
            </h1>
            <p>Tüm şube giderlerinizi bu sayfadan takip edebilirsiniz</p>
          </div>
          
          <button 
            className="add-button"
            onClick={() => setShowForm(true)}
            disabled={giderKalemleri.length === 0}
          >
            <span className="material-icons">add</span>
            Yeni Gider Kaydı
          </button>
        </div>
      </div>

      {giderKalemleri.length === 0 && (
        <div className="error-message">
          <span className="material-icons">warning</span>
          Gider kaydı oluşturmak için önce gider kalemi tanımlamanız gerekiyor.
        </div>
      )}

      {/* Filtreler */}
      <div className="filters-section">
        <div className="filter-row">
          <div className="filter-group">
            <label>Başlangıç Tarihi</label>
            <input
              type="date"
              value={filter.startDate}
              onChange={(e) => setFilter({ ...filter, startDate: e.target.value })}
            />
          </div>
          <div className="filter-group">
            <label>Bitiş Tarihi</label>
            <input
              type="date"
              value={filter.endDate}
              onChange={(e) => setFilter({ ...filter, endDate: e.target.value })}
            />
          </div>
          <div className="filter-group">
            <label>Gider Kalemi</label>
            <select
              value={filter.giderKalemiId}
              onChange={(e) => setFilter({ ...filter, giderKalemiId: e.target.value })}
            >
              <option value="">Tümü</option>
              {giderKalemleri.map(item => (
                <option key={item.id} value={item.id}>{item.ad}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label>Ödeme Kaynağı</label>
            <select
              value={filter.odemeKaynagi}
              onChange={(e) => setFilter({ ...filter, odemeKaynagi: e.target.value })}
            >
              <option value="">Tümü</option>
              <option value="gunluk_kasa">Günlük Kasa</option>
              <option value="merkez_kasa">Merkez Kasa</option>
            </select>
          </div>
        </div>
      </div>

      {/* İstatistik Kartları */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon success">
            <span className="material-icons">receipt</span>
          </div>
          <div className="stat-info">
            <div className="stat-number">₺{getTotalAmount().toFixed(2)}</div>
            <div className="stat-label">Toplam Gider Tutarı</div>
            <div className="stat-sublabel">Filtrelenmiş kayıtlar: {filteredGiderKayitlari.length}</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon primary">
            <span className="material-icons">category</span>
          </div>
          <div className="stat-info">
            <div className="stat-number">{giderKalemleri.length}</div>
            <div className="stat-label">Aktif Gider Kalemi</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon info">
            <span className="material-icons">payments</span>
          </div>
          <div className="stat-info">
            <div className="stat-number">
              {filteredGiderKayitlari.filter(item => item.odemeKaynagi === 'gunluk_kasa').length}
            </div>
            <div className="stat-label">Günlük Kasa Ödemesi</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon warning">
            <span className="material-icons">account_balance</span>
          </div>
          <div className="stat-info">
            <div className="stat-number">
              {filteredGiderKayitlari.filter(item => item.odemeKaynagi === 'merkez_kasa').length}
            </div>
            <div className="stat-label">Merkez Kasa Ödemesi</div>
          </div>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>
                <span className="material-icons">receipt</span>
                Yeni Gider Kaydı
              </h2>
              <button className="close-button" onClick={resetForm}>
                <span className="material-icons">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="form">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="giderKalemiId">Gider Kalemi *</label>
                  <select
                    id="giderKalemiId"
                    value={formData.giderKalemiId}
                    onChange={(e) => setFormData({ ...formData, giderKalemiId: e.target.value })}
                    className={errors.giderKalemiId ? 'error' : ''}
                  >
                    <option value="">Gider kalemi seçin</option>
                    {giderKalemleri.map(item => (
                      <option key={item.id} value={item.id}>{item.ad}</option>
                    ))}
                  </select>
                  {errors.giderKalemiId && <span className="error-message">{errors.giderKalemiId}</span>}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="aciklama">Açıklama *</label>
                <textarea
                  id="aciklama"
                  value={formData.aciklama}
                  onChange={(e) => setFormData({ ...formData, aciklama: e.target.value })}
                  className={errors.aciklama ? 'error' : ''}
                  placeholder="Gider detayları..."
                  rows="3"
                />
                {errors.aciklama && <span className="error-message">{errors.aciklama}</span>}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="tutar">Tutar (₺) *</label>
                  <input
                    type="number"
                    id="tutar"
                    step="0.01"
                    min="0"
                    value={formData.tutar}
                    onChange={(e) => setFormData({ ...formData, tutar: e.target.value })}
                    className={errors.tutar ? 'error' : ''}
                    placeholder="0.00"
                  />
                  {errors.tutar && <span className="error-message">{errors.tutar}</span>}
                </div>
                
                <div className="form-group">
                  <label htmlFor="odemeKaynagi">Ödeme Kaynağı *</label>
                  <select
                    id="odemeKaynagi"
                    value={formData.odemeKaynagi}
                    onChange={(e) => setFormData({ ...formData, odemeKaynagi: e.target.value })}
                  >
                    <option value="gunluk_kasa">Günlük Kasa</option>
                    <option value="merkez_kasa">Merkez Kasa</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="tarih">Tarih *</label>
                  <input
                    type="date"
                    id="tarih"
                    value={formData.tarih}
                    onChange={(e) => setFormData({ ...formData, tarih: e.target.value })}
                    className={errors.tarih ? 'error' : ''}
                  />
                  {errors.tarih && <span className="error-message">{errors.tarih}</span>}
                </div>
                
                <div className="form-group">
                  <label htmlFor="saat">Saat *</label>
                  <input
                    type="time"
                    id="saat"
                    value={formData.saat}
                    onChange={(e) => setFormData({ ...formData, saat: e.target.value })}
                    className={errors.saat ? 'error' : ''}
                  />
                  {errors.saat && <span className="error-message">{errors.saat}</span>}
                </div>
              </div>

              <div className="form-actions">
                <button type="button" onClick={resetForm} className="cancel-button">
                  İptal
                </button>
                <button type="submit" className="save-button">
                  <span className="material-icons">save</span>
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Gider Kayıtları Listesi */}
      <div className="adisyonlar-grid">
        {filteredGiderKayitlari.length === 0 ? (
          <div className="empty-state">
            <span className="material-icons">receipt</span>
            <h3>Henüz gider kaydı bulunmuyor</h3>
            <p>Yeni gider kaydı eklemek için yukarıdaki butona tıklayın.</p>
          </div>
        ) : (
          filteredGiderKayitlari.map((record) => (
            <div key={record.id} className={`adisyon-card ${record.odemeKaynagi === 'gunluk_kasa' ? 'success' : 'info'}`}>
              <div className="adisyon-header">
                <div className="adisyon-code">
                  <span className="material-icons">receipt</span>
                  {record.giderKalemiAdi}
                </div>
                <div className="adisyon-badges">
                  <div className={`adisyon-status ${record.odemeKaynagi === 'gunluk_kasa' ? 'success' : 'info'}`}>
                    <span className="material-icons">
                      {record.odemeKaynagi === 'gunluk_kasa' ? 'payments' : 'account_balance'}
                    </span>
                    {record.odemeKaynagi === 'gunluk_kasa' ? 'Günlük Kasa' : 'Merkez Kasa'}
                  </div>
                </div>
              </div>
              
              <div className="adisyon-details">
                <div className="detail-row">
                  <span className="detail-label">Tarih</span>
                  <span className="detail-value">
                    {record.tarih.toDate().toLocaleDateString('tr-TR')} {record.saat}
                  </span>
                </div>
                
                <div className="detail-row">
                  <span className="detail-label">Açıklama</span>
                  <span className="detail-value">{record.aciklama}</span>
                </div>
                
                <div className="detail-row">
                  <span className="detail-label">Tutar</span>
                  <span className="detail-value amount">₺{record.tutar.toFixed(2)}</span>
                </div>
                
                {currentUser?.role === 'sirket_yoneticisi' && (
                  <div className="detail-row">
                    <span className="detail-label">Şube</span>
                    <span className="detail-value">{record.subeAdi || 'Merkez'}</span>
                  </div>
                )}
                
                <div className="detail-row">
                  <span className="detail-label">Kaydeden</span>
                  <span className="detail-value">{record.kullaniciAdi}</span>
                </div>
              </div>
              
              <div className="adisyon-actions">
                <button className="detail-btn">
                  <span className="material-icons">visibility</span>
                  Detayları Görüntüle
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default GiderKaydiPage;
