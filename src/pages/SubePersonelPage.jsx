import React, { useState, useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, updateProfile, signOut } from 'firebase/auth';
import { getFirestore, collection, addDoc, getDocs, query, where, doc, deleteDoc, updateDoc, getDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import './SubePersonelPage.css';
import PageHeader from '../components/PageHeader';

const SubePersonelPage = () => {
  const { subeId } = useParams();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const subeAdi = queryParams.get('subeAdi') || '';
  
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Kullanıcı formu için state'ler
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState('personel');
  const [formVisible, setFormVisible] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editUserId, setEditUserId] = useState(null);
  
  const auth = getAuth();
  const db = getFirestore();
  const { currentUser } = useAuth();
  
  // Tüm kullanıcı rolleri
  const allRoleOptions = [
    { value: 'sube_yoneticisi', label: 'Şube Yöneticisi' },
    { value: 'personel', label: 'Personel' },
    { value: 'kurye', label: 'Kurye' },
    { value: 'muhasebe', label: 'Muhasebe' },
    { value: 'depo', label: 'Depo' }
  ];

  // Mevcut kullanıcının rolünü kontrol et ve sadece izin verilenleri göster
  const getUserRoleOptions = async () => {
    try {
      // currentUser.role kontrolü
      if (currentUser && currentUser.role) {
        console.log('Kullanıcı rolü (from AuthContext):', currentUser.role);
        
        if (currentUser.role === 'sirket_yoneticisi') {
          // Şirket yöneticisi tüm rolleri görebilir
          return allRoleOptions;
        } else if (currentUser.role === 'sube_yoneticisi') {
          // Şube yöneticisi SADECE personel ve kurye ekleyebilir
          return allRoleOptions.filter(option => 
            option.value === 'personel' || 
            option.value === 'kurye'
          );
        } else {
          // Diğer roller hiçbir rol ekleyemez
          return [];
        }
      } else {
        // Firestore'dan kontrol et
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          console.log('Kullanıcı rolü (from Firestore):', userData.role);
          
          if (userData.role === 'sirket_yoneticisi') {
            // Şirket yöneticisi tüm rolleri görebilir
            return allRoleOptions;
          } else if (userData.role === 'sube_yoneticisi') {
            // Şube yöneticisi SADECE personel ve kurye ekleyebilir
            return allRoleOptions.filter(option => 
              option.value === 'personel' || 
              option.value === 'kurye'
            );
          } else {
            // Diğer roller hiçbir rol ekleyemez
            return [];
          }
        }
      }
    } catch (err) {
      console.error('Rol bilgisi alınırken hata oluştu:', err);
    }
    
    // Default olarak boş dizi döndür
    return [];
  };
  
  const [availableRoles, setAvailableRoles] = useState([]);
  
  useEffect(() => {
    const fetchRoles = async () => {
      const roles = await getUserRoleOptions();
      setAvailableRoles(roles);
    };
    
    fetchRoles();
    fetchSubePersonel();
  }, [currentUser]);

  // Şubeye ait kullanıcıları getir
  const fetchSubePersonel = async () => {
    try {
      setLoading(true);
      
      // Mevcut kullanıcının rolünü kontrol et
      if (currentUser && currentUser.role) {
        console.log('Kullanıcı rolü (from AuthContext):', currentUser.role);
        
        let q;
        
        // Şube yöneticisi ise yetkileri sınırlandır
        if (currentUser.role === 'sube_yoneticisi') {
          // Şube yöneticisi sadece kendi şubesindeki personel ve kuryeleri görebilir
          // Şube kontrolü yapılması gerekiyor
          if (currentUser.subeId && currentUser.subeId === subeId) {
            // Bu, şube yöneticisinin kendi şubesi
            q = query(
              collection(db, 'users'), 
              where('subeId', '==', subeId),
              where('role', 'in', ['personel', 'kurye'])
            );
          } else {
            // Bu başka bir şube, erişim yok
            setError('Bu şubeye erişim yetkiniz bulunmamaktadır');
            setLoading(false);
            return;
          }
        } else if (currentUser.role === 'sirket_yoneticisi') {
          // Şirket yöneticisi tüm şube personelini görebilir
          q = query(collection(db, 'users'), where('subeId', '==', subeId));
        } else {
          // Diğer roller sınırlı görünüm
          q = query(collection(db, 'users'), 
            where('subeId', '==', subeId),
            where('role', 'not-in', ['sirket_yoneticisi', 'sube_yoneticisi'])
          );
        }
        
        const userSnapshot = await getDocs(q);
        const usersList = userSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        console.log(`${usersList.length} personel yüklendi`);
        setUsers(usersList);
      } else {
        // Firestore'dan kontrol et
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          console.log('Kullanıcı rolü (from Firestore):', userData.role);
          
          let q;
          
          if (userData.role === 'sube_yoneticisi') {
            // Şube kontrolü yapılması gerekiyor
            if (userData.subeId && userData.subeId === subeId) {
              // Şube yöneticisi sadece kendi şubesindeki personel ve kuryeleri görebilir
              q = query(
                collection(db, 'users'), 
                where('subeId', '==', subeId),
                where('role', 'in', ['personel', 'kurye'])
              );
            } else {
              // Bu başka bir şube, erişim yok
              setError('Bu şubeye erişim yetkiniz bulunmamaktadır');
              setLoading(false);
              return;
            }
          } else if (userData.role === 'sirket_yoneticisi') {
            // Şirket yöneticisi tüm şube personelini görebilir
            q = query(collection(db, 'users'), where('subeId', '==', subeId));
          } else {
            // Diğer roller sınırlı görünüm
            q = query(collection(db, 'users'), 
              where('subeId', '==', subeId),
              where('role', 'not-in', ['sirket_yoneticisi', 'sube_yoneticisi'])
            );
          }
          
          const userSnapshot = await getDocs(q);
          const usersList = userSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          console.log(`${usersList.length} personel yüklendi`);
          setUsers(usersList);
        }
      }
    } catch (err) {
      setError('Şube personeli yüklenirken bir hata oluştu: ' + err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Kullanıcı düzenleme formunu aç
  const handleEditUser = async (userId) => {
    setEditMode(true);
    setEditUserId(userId);
    setFormVisible(true);
    
    try {
      setLoading(true);
      
      // Kullanıcı bilgilerini getir
      const userDoc = await getDoc(doc(db, 'users', userId));
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setEmail(userData.email);
        setDisplayName(userData.displayName);
        setRole(userData.role);
        setPassword(''); // Şifre alanını boş bırak
      } else {
        setError('Kullanıcı bulunamadı');
      }
    } catch (err) {
      setError('Kullanıcı bilgileri yüklenirken bir hata oluştu: ' + err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Kullanıcı kaydını güncelle
  const handleUpdateUser = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!displayName || !role) {
      setError('Lütfen gerekli alanları doldurun');
      return;
    }
    
    try {
      setLoading(true);
      
      // Firestore'daki kullanıcı bilgilerini güncelle
      const userDocRef = doc(db, 'users', editUserId);
      
      await updateDoc(userDocRef, {
        displayName: displayName,
        role: role,
        updatedAt: new Date(),
        updatedBy: currentUser.uid
      });
      
      setSuccess('Kullanıcı başarıyla güncellendi!');
      
      // Formu temizle ve edit modundan çık
      resetForm();
      
      // Kullanıcı listesini yenile
      fetchSubePersonel();
    } catch (err) {
      setError('Kullanıcı güncellenirken bir hata oluştu: ' + err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Formu sıfırla
  const resetForm = () => {
    setEmail('');
    setPassword('');
    setDisplayName('');
    setRole('personel');
    setFormVisible(false);
    setEditMode(false);
    setEditUserId(null);
  };

  // Yeni kullanıcı oluştur
  const handleCreateUser = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!email || !password || !displayName || !role) {
      setError('Lütfen tüm alanları doldurun');
      return;
    }
    
    let secondaryApp = null;
    
    try {
      setLoading(true);
      
      const firebaseConfig = {
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: import.meta.env.VITE_FIREBASE_APP_ID,
        measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
      };

      // Geçici bir Firebase uygulaması oluştur
      secondaryApp = initializeApp(firebaseConfig, "SecondaryAppSube");
      const secondaryAuth = getAuth(secondaryApp);
      
      // Secondary auth ile kullanıcı oluştur (Mevcut oturumu etkilemez)
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      
      // Kullanıcı displayName'ini ayarla
      await updateProfile(userCredential.user, {
        displayName: displayName
      });
      
      // Firestore'a kullanıcı bilgilerini ekle (Ana db instance ve admin yetkisiyle)
      await addDoc(collection(db, 'users'), {
        uid: userCredential.user.uid,
        email: email,
        displayName: displayName,
        role: role,
        subeId: subeId,  // Kullanıcı ile şube arasında ilişki kur
        subeAdi: subeAdi,
        createdAt: new Date(),
        createdBy: currentUser.uid
      });
      
      await signOut(secondaryAuth);
      
      setSuccess('Kullanıcı başarıyla oluşturuldu!');
      
      // Formu temizle
      resetForm();
      
      // Kullanıcı listesini yenile
      fetchSubePersonel();
    } catch (err) {
      setError('Kullanıcı oluşturulurken bir hata oluştu: ' + err.message);
      console.error(err);
    } finally {
      if (secondaryApp) {
        await deleteApp(secondaryApp);
      }
      setLoading(false);
    }
  };
  
  // Kullanıcı sil
  const handleDeleteUser = async (userId) => {
    if (window.confirm('Bu kullanıcıyı silmek istediğinizden emin misiniz?')) {
      try {
        setLoading(true);
        await deleteDoc(doc(db, 'users', userId));
        setSuccess('Kullanıcı başarıyla silindi');
        fetchSubePersonel();
      } catch (err) {
        setError('Kullanıcı silinirken bir hata oluştu: ' + err.message);
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
  };

  // Rol adını göster
  const getRoleName = (roleValue) => {
    const role = allRoleOptions.find(r => r.value === roleValue);
    return role ? role.label : roleValue;
  };
  
  // Geri butonu işlevi
  const handleBack = () => {
    window.history.back();
  };

  return (
    <div className="sube-personel-container">
      <PageHeader
        icon="badge"
        title={`${subeAdi || 'Şube'} Personel Yönetimi`}
        description={`Bu sayfadan ${subeAdi || 'şube'} personelini görüntüleyebilir, yeni personel ekleyebilir ve düzenleyebilirsiniz.`}
        actions={availableRoles.length > 0 && (
          <>
            <button 
              className="back-outline-button"
              onClick={handleBack}
              title="Geri"
            >
              <span className="material-icons">arrow_back</span>
              <span>Geri</span>
            </button>
            <button 
              className="add-button modern"
              onClick={() => setFormVisible(!formVisible)}
            >
              <span className="material-icons">person_add</span>
              {formVisible ? 'Formu Kapat' : 'Yeni Personel Ekle'}
            </button>
          </>
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
        <div className="personel-form-container glass-panel">
          <h3>{editMode ? 'Personel Düzenle' : 'Yeni Personel Ekle'}</h3>
          <form onSubmit={editMode ? handleUpdateUser : handleCreateUser} className="personel-form">
            <div className="form-group">
              <label htmlFor="displayName">Ad Soyad</label>
              <input
                type="text"
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="email">E-posta</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={editMode}
              />
            </div>
            {!editMode && (
              <div className="form-group">
                <label htmlFor="password">Şifre</label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required={!editMode}
                  minLength="6"
                />
              </div>
            )}
            <div className="form-group">
              <label htmlFor="role">Rol</label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                required
              >
                {availableRoles.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
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
                {loading ? (editMode ? 'Güncelleniyor...' : 'Ekleniyor...') : (editMode ? 'Güncelle' : 'Personel Ekle')}
              </button>
            </div>
          </form>
        </div>
      )}
      
      <div className="personel-table-container glass-panel">
        {loading && !formVisible ? (
          <p className="loading-text">Personel yükleniyor...</p>
        ) : users.length === 0 ? (
          <p className="no-data">Bu şubeye henüz personel eklenmemiştir.</p>
        ) : (
          <table className="personel-table">
            <thead>
              <tr>
                <th>Ad Soyad</th>
                <th>E-posta</th>
                <th>Rol</th>
                <th>Oluşturulma Tarihi</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.displayName}</td>
                  <td>{user.email}</td>
                  <td>{getRoleName(user.role)}</td>
                  <td>{user.createdAt ? new Date(user.createdAt.seconds * 1000).toLocaleDateString('tr-TR') : '-'}</td>
                  <td>
                    <div className="table-actions">
                      <button 
                        className="action-button edit"
                        title="Düzenle"
                        onClick={() => handleEditUser(user.id)}
                      >
                        <span className="material-icons">edit</span>
                      </button>
                      <button 
                        className="action-button delete"
                        title="Sil"
                        onClick={() => handleDeleteUser(user.id)}
                      >
                        <span className="material-icons">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default SubePersonelPage;
