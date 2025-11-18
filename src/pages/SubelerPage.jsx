import React, { useState, useEffect } from 'react';
import { getFirestore, collection, addDoc, getDocs, doc, deleteDoc, updateDoc, getDoc, query, where } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import './SubelerPage.css';
import PageHeader from '../components/PageHeader';

const SubelerPage = () => {
  const [subeler, setSubeler] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [canManageBranches, setCanManageBranches] = useState(false);
  
  // Şube formu için state'ler
  const [subeAdi, setSubeAdi] = useState('');
  const [subeAdresi, setSubeAdresi] = useState('');
  const [formVisible, setFormVisible] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editSubeId, setEditSubeId] = useState(null);
  
  const { currentUser } = useAuth();
  const db = getFirestore();
  
  // Kullanıcının rolünü kontrol et
  const checkUserRole = async () => {
    try {
      if (currentUser && currentUser.role) {
        // Şirket yöneticisi ise şube ekleme/düzenleme izni ver
        const isCompanyManager = currentUser.role === 'sirket_yoneticisi';
        setCanManageBranches(isCompanyManager);
        console.log('Kullanıcı rolü:', currentUser.role, 'Şube yönetimi izni:', isCompanyManager);
      }
    } catch (err) {
      console.error('Kullanıcı rolü kontrol edilirken bir hata oluştu:', err);
    }
  };

  // Şubeleri Firebase'den getir
  const fetchSubeler = async () => {
    try {
      setLoading(true);
      
      // Kullanıcı rolüne göre şubeleri getir
      if (currentUser && currentUser.role) {
        if (currentUser.role === 'sirket_yoneticisi') {
          // Şirket yöneticisi ise tüm şubeleri getir
          const subelerCollection = collection(db, 'subeler');
          const subeSnapshot = await getDocs(subelerCollection);
          const subelerList = subeSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setSubeler(subelerList);
        } else if (currentUser.role === 'sube_yoneticisi' && currentUser.subeId) {
          // Şube yöneticisi ise sadece kendi şubesini getir
          const q = query(
            collection(db, 'subeler'),
            where('__name__', '==', currentUser.subeId)
          );
          const subeSnapshot = await getDocs(q);
          const subelerList = subeSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setSubeler(subelerList);
        } else {
          // Diğer kullanıcılar için tüm şubeleri getir (görüntüleme amaçlı)
          const subelerCollection = collection(db, 'subeler');
          const subeSnapshot = await getDocs(subelerCollection);
          const subelerList = subeSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setSubeler(subelerList);
        }
      }
    } catch (err) {
      setError('Şubeler yüklenirken bir hata oluştu: ' + err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkUserRole();
    fetchSubeler();
  }, []);

  // Şube düzenleme formunu aç
  const handleEditSube = async (subeId) => {
    setEditMode(true);
    setEditSubeId(subeId);
    setFormVisible(true);
    
    try {
      setLoading(true);
      
      // Şube bilgilerini getir
      const subeDoc = await getDoc(doc(db, 'subeler', subeId));
      
      if (subeDoc.exists()) {
        const subeData = subeDoc.data();
        setSubeAdi(subeData.subeAdi);
        setSubeAdresi(subeData.subeAdresi);
      } else {
        setError('Şube bulunamadı');
      }
    } catch (err) {
      setError('Şube bilgileri yüklenirken bir hata oluştu: ' + err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Şube kaydını güncelle
  const handleUpdateSube = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!subeAdi || !subeAdresi) {
      setError('Lütfen tüm alanları doldurun');
      return;
    }
    
    try {
      setLoading(true);
      
      // Firestore'daki şube bilgilerini güncelle
      const subeDocRef = doc(db, 'subeler', editSubeId);
      
      await updateDoc(subeDocRef, {
        subeAdi: subeAdi,
        subeAdresi: subeAdresi,
        updatedAt: new Date(),
        updatedBy: currentUser.uid
      });
      
      setSuccess('Şube başarıyla güncellendi!');
      
      // Formu temizle ve edit modundan çık
      resetForm();
      
      // Şube listesini yenile
      fetchSubeler();
    } catch (err) {
      setError('Şube güncellenirken bir hata oluştu: ' + err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Formu sıfırla
  const resetForm = () => {
    setSubeAdi('');
    setSubeAdresi('');
    setFormVisible(false);
    setEditMode(false);
    setEditSubeId(null);
  };

  // Yeni şube oluştur
  const handleCreateSube = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!subeAdi || !subeAdresi) {
      setError('Lütfen tüm alanları doldurun');
      return;
    }
    
    try {
      setLoading(true);
      
      // Firestore'a şube bilgilerini ekle
      await addDoc(collection(db, 'subeler'), {
        subeAdi: subeAdi,
        subeAdresi: subeAdresi,
        createdAt: new Date(),
        createdBy: currentUser.uid
      });
      
      setSuccess('Şube başarıyla oluşturuldu!');
      
      // Formu temizle
      resetForm();
      
      // Şube listesini yenile
      fetchSubeler();
    } catch (err) {
      setError('Şube oluşturulurken bir hata oluştu: ' + err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  
  // Şube sil
  const handleDeleteSube = async (subeId) => {
    if (window.confirm('Bu şubeyi silmek istediğinizden emin misiniz?')) {
      try {
        setLoading(true);
        await deleteDoc(doc(db, 'subeler', subeId));
        setSuccess('Şube başarıyla silindi');
        fetchSubeler();
      } catch (err) {
        setError('Şube silinirken bir hata oluştu: ' + err.message);
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
  };

  // Şube personellerini görüntüle
  const handleViewSubePersonel = (subeId, subeAdi) => {
    window.location.href = `/sube-personel/${subeId}?subeAdi=${encodeURIComponent(subeAdi)}`;
  };

  return (
    <div className="subeler-container">
      <PageHeader
        icon="business"
        title="Şube Yönetimi"
        description="Şubelerinizi yönetin ve yeni şubeler ekleyin"
        actions={canManageBranches && (
          <button 
            className="add-button modern"
            onClick={() => setFormVisible(!formVisible)}
          >
            <span className="material-icons">add</span>
            {formVisible ? 'Formu Kapat' : 'Yeni Şube Ekle'}
          </button>
        )}
      />
      
      {error && (
        <div className="error-message">
          <span className="material-icons">error_outline</span>
          {error}
        </div>
      )}
      {success && (
        <div className="success-message">
          <span className="material-icons">check_circle_outline</span>
          {success}
        </div>
      )}
      
      {formVisible && (
        <div className="sube-form-container">
          <h3>{editMode ? 'Şube Düzenle' : 'Yeni Şube Ekle'}</h3>
          <form onSubmit={editMode ? handleUpdateSube : handleCreateSube} className="sube-form">
            <div className="form-group">
              <label htmlFor="subeAdi">Şube Adı</label>
              <input
                type="text"
                id="subeAdi"
                value={subeAdi}
                onChange={(e) => setSubeAdi(e.target.value)}
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="subeAdresi">Şube Adresi</label>
              <textarea
                id="subeAdresi"
                value={subeAdresi}
                onChange={(e) => setSubeAdresi(e.target.value)}
                required
                rows="3"
              />
            </div>
            
            <div className="form-actions">
              <button 
                type="button" 
                className="cancel-button"
                onClick={resetForm}
              >
                İptal
              </button>
              <button 
                type="submit" 
                className="submit-button"
                disabled={loading}
              >
                {loading 
                  ? (editMode ? 'Güncelleniyor...' : 'Ekleniyor...') 
                  : (editMode ? 'Güncelle' : 'Şube Ekle')}
              </button>
            </div>
          </form>
        </div>
      )}
      
      <div className="subeler-table-container">
        {loading && !formVisible ? (
          <p className="loading-text">Şubeler yükleniyor...</p>
        ) : subeler.length === 0 ? (
          <p className="no-data">Henüz şube bulunmamaktadır.</p>
        ) : (
          <>
            {/* Masaüstü için tablo görünümü */}
            <table className="subeler-table subeler-table-desktop">
              <thead>
                <tr>
                  <th>Şube Adı ve ID</th>
                  <th>Şube Adresi</th>
                  <th>Oluşturulma Tarihi</th>
                  <th>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {subeler.map((sube) => (
                  <tr key={sube.id}>
                    <td>
                      {sube.subeAdi}
                      <div className="sube-id">
                        <span className="id-label">ID: {sube.id}</span>
                        <button 
                          className="action-button copy"
                          title="ID'yi Kopyala"
                          onClick={() => {
                            navigator.clipboard.writeText(sube.id);
                            setSuccess('Şube ID başarıyla kopyalandı!');
                            setTimeout(() => setSuccess(''), 2000);
                          }}
                        >
                          <span className="material-icons">content_copy</span>
                        </button>
                      </div>
                    </td>
                    <td>{sube.subeAdresi}</td>
                    <td>
                      {sube.createdAt ? new Date(sube.createdAt.seconds * 1000).toLocaleDateString('tr-TR') : '-'}
                    </td>
                    <td>
                      <div className="table-actions">
                        <button 
                          className="action-button view"
                          title="Şube Personeli"
                          onClick={() => handleViewSubePersonel(sube.id, sube.subeAdi)}
                        >
                          <span className="material-icons">people</span>
                        </button>
                        {canManageBranches && (
                          <>
                            <button 
                              className="action-button edit"
                              title="Düzenle"
                              onClick={() => handleEditSube(sube.id)}
                            >
                              <span className="material-icons">edit</span>
                            </button>
                            <button 
                              className="action-button delete"
                              title="Sil"
                              onClick={() => handleDeleteSube(sube.id)}
                            >
                              <span className="material-icons">delete</span>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobil için kart görünümü */}
            <div className="subeler-cards-mobile">
              {subeler.map((sube) => (
                <div key={sube.id} className="sube-card">
                  <div className="sube-card-header">
                    <div className="sube-icon-circle">
                      <span className="material-icons">business</span>
                    </div>
                    <div className="sube-card-main">
                      <div className="sube-name">{sube.subeAdi}</div>
                      <div className="sube-id-inline">ID: {sube.id}</div>
                    </div>
                    <button 
                      className="action-button copy"
                      title="ID'yi Kopyala"
                      onClick={() => {
                        navigator.clipboard.writeText(sube.id);
                        setSuccess('Şube ID başarıyla kopyalandı!');
                        setTimeout(() => setSuccess(''), 2000);
                      }}
                    >
                      <span className="material-icons">content_copy</span>
                    </button>
                  </div>
                  <div className="sube-card-body">
                    <div className="sube-row">
                      <span className="label">Adres</span>
                      <span className="value address">{sube.subeAdresi}</span>
                    </div>
                    <div className="sube-row">
                      <span className="label">Oluşturulma</span>
                      <span className="value">
                        {sube.createdAt ? new Date(sube.createdAt.seconds * 1000).toLocaleDateString('tr-TR') : '-'}
                      </span>
                    </div>
                  </div>
                  <div className="sube-card-footer">
                    <button 
                      className="card-action-button view"
                      onClick={() => handleViewSubePersonel(sube.id, sube.subeAdi)}
                    >
                      <span className="material-icons">people</span>
                      Personel
                    </button>
                    {canManageBranches && (
                      <>
                        <button 
                          className="card-action-button edit"
                          onClick={() => handleEditSube(sube.id)}
                        >
                          <span className="material-icons">edit</span>
                          Düzenle
                        </button>
                        <button 
                          className="card-action-button delete"
                          onClick={() => handleDeleteSube(sube.id)}
                        >
                          <span className="material-icons">delete</span>
                          Sil
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SubelerPage;
