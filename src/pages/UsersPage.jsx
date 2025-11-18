import React, { useState, useEffect } from 'react';
import { getAuth, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { getFirestore, collection, addDoc, getDocs, query, where, doc, deleteDoc, updateDoc, getDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import './UsersPage.css';
import PageHeader from '../components/PageHeader';

const UsersPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Yeni kullanıcı formu için state'ler
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState('personel');
  const [formVisible, setFormVisible] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editUserId, setEditUserId] = useState(null);
  const [subeler, setSubeler] = useState([]);
  const [selectedSube, setSelectedSube] = useState('');
  const [selectedSubeAdi, setSelectedSubeAdi] = useState('');
  const [filterSubeId, setFilterSubeId] = useState('');
  
  const auth = getAuth();
  const db = getFirestore();
  const { currentUser } = useAuth();
  
  // Tüm kullanıcı rolleri
  const allRoleOptions = [
    { value: 'sirket_yoneticisi', label: 'Şirket Yöneticisi' },
    { value: 'sube_yoneticisi', label: 'Şube Yöneticisi' },
    { value: 'personel', label: 'Personel' },
    { value: 'kurye', label: 'Kurye' },
    { value: 'muhasebe', label: 'Muhasebe' },
    { value: 'depo', label: 'Depo' }
  ];
  
  // Rol seçenekleri için state
  const [roleOptions, setRoleOptions] = useState(allRoleOptions);

  // Kullanıcıları Firebase'den getir
  const fetchUsers = async (subeFilterId = '') => {
    try {
      setLoading(true);
      let usersList = [];
      
      // Mevcut kullanıcının rolünü kontrol et
      if (!currentUser || !currentUser.uid) {
        console.error('Oturum açmış kullanıcı bilgisi bulunamadı');
        setError('Kullanıcı bilgileri yüklenirken bir hata oluştu: Oturum açmış kullanıcı bulunamadı');
        setLoading(false);
        return;
      }

      console.log('Kullanıcı UID:', currentUser.uid);
      console.log('CurrentUser role:', currentUser.role); // Doğrudan currentUser'dan rol bilgisini kontrol et
      
      // Eğer currentUser'da role varsa kullan, yoksa Firestore'dan getir
      if (currentUser.role) {
        console.log('Kullanıcı rolü (from AuthContext):', currentUser.role);
        
        if (currentUser.role === 'sube_yoneticisi' && currentUser.subeId) {
          // Şube yöneticisi ise SADECE kendi şubesine ait personel ve kurye kullanıcılarını getir
          console.log('Şube yöneticisi için kullanıcılar yükleniyor, şube ID:', currentUser.subeId);
          const q = query(
            collection(db, 'users'),
            where('subeId', '==', currentUser.subeId),
            where('role', 'in', ['personel', 'kurye'])
          );
          const userSnapshot = await getDocs(q);
          usersList = userSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          console.log('Şube personeli yüklendi:', usersList.length);
        } else if (currentUser.role === 'sirket_yoneticisi') {
          // Şirket yöneticisi seçilen şubeye göre filtreli veya tüm kullanıcıları görebilir
          if (subeFilterId) {
            console.log('Şirket yöneticisi için filtreli kullanıcılar yükleniyor, şube ID:', subeFilterId);
            const q = query(
              collection(db, 'users'),
              where('subeId', '==', subeFilterId)
            );
            const userSnapshot = await getDocs(q);
            usersList = userSnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            }));
            console.log('Filtreli kullanıcılar yüklendi:', usersList.length);
          } else {
            console.log('Şirket yöneticisi için tüm kullanıcılar yükleniyor');
            const usersCollection = collection(db, 'users');
            const userSnapshot = await getDocs(usersCollection);
            usersList = userSnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            }));
            console.log('Tüm kullanıcılar yüklendi:', usersList.length);
          }
        } else {
          // Diğer roller için sınırlı görünüm
          console.log('Diğer roller için sınırlı kullanıcı listesi yükleniyor');
          const usersCollection = collection(db, 'users');
          const userSnapshot = await getDocs(usersCollection);
          usersList = userSnapshot.docs
            .map(doc => ({
              id: doc.id,
              ...doc.data()
            }))
            .filter(user => user.role !== 'sirket_yoneticisi'); // Şirket yöneticisini gizle
          console.log('Sınırlı kullanıcı listesi yüklendi:', usersList.length);
        }
      } else {
        // Role bilgisi yoksa Firestore'dan query ile kontrol et
        console.log('Kullanıcı role bilgisi eksik, Firestore\'dan aranıyor, uid:', currentUser.uid);
        
        // uid alanı ile kullanıcıyı ara (doküman ID ile değil)
        const q = query(collection(db, 'users'), where('uid', '==', currentUser.uid));
        const userSnapshot = await getDocs(q);
        
        if (!userSnapshot.empty) {
          const userDoc = userSnapshot.docs[0];
          const userData = userDoc.data();
          console.log('Kullanıcı Firestore\'dan bulundu. Doküman ID:', userDoc.id, 'Data:', userData);
          console.log('Kullanıcı rolü (from Firestore):', userData.role);
          
          if (userData.role === 'sube_yoneticisi' && userData.subeId) {
            // Şube yöneticisi ise sadece kendi şubesine ait ve şirket yöneticisi olmayan kullanıcıları getir
            console.log('Şube yöneticisi için kullanıcılar yükleniyor, şube ID:', userData.subeId);
            const q = query(
              collection(db, 'users'),
              where('subeId', '==', userData.subeId),
              where('role', 'in', ['personel', 'kurye'])
            );
            const userSnapshot = await getDocs(q);
            usersList = userSnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            }));
            console.log('Şube personeli yüklendi:', usersList.length);
          } else if (userData.role === 'sirket_yoneticisi') {
            // Şirket yöneticisi seçilen şubeye göre filtreli veya tüm kullanıcıları görebilir
            if (subeFilterId) {
              console.log('Şirket yöneticisi için filtreli kullanıcılar yükleniyor, şube ID:', subeFilterId);
              const q2 = query(
                collection(db, 'users'),
                where('subeId', '==', subeFilterId)
              );
              const userSnapshot2 = await getDocs(q2);
              usersList = userSnapshot2.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
              }));
              console.log('Filtreli kullanıcılar yüklendi:', usersList.length);
            } else {
              console.log('Şirket yöneticisi için tüm kullanıcılar yükleniyor');
              const usersCollection = collection(db, 'users');
              const userSnapshot = await getDocs(usersCollection);
              usersList = userSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
              }));
              console.log('Tüm kullanıcılar yüklendi:', usersList.length);
            }
          } else {
            // Diğer roller için sınırlı görünüm
            console.log('Diğer roller için sınırlı kullanıcı listesi yükleniyor');
            const usersCollection = collection(db, 'users');
            const userSnapshot = await getDocs(usersCollection);
            usersList = userSnapshot.docs
              .map(doc => ({
                id: doc.id,
                ...doc.data()
              }))
              .filter(user => user.role !== 'sirket_yoneticisi'); // Şirket yöneticisini gizle
            console.log('Sınırlı kullanıcı listesi yüklendi:', usersList.length);
          }
        } else {
          console.error('Kullanıcı dökümanı bulunamadı. UID ile arama yapıldı:', currentUser.uid);
          setError('Kullanıcı bilgileri yüklenirken bir hata oluştu: Kullanıcı bulunamadı');
        }
      }
      
      // Boş liste kontrolü
      if (usersList.length === 0) {
        console.log('Kullanıcı listesi boş döndü, role göre yetki sorunları olabilir');
        // Şirket yöneticisiyse ve liste boş ise Firestore kurallarını kontrol et
        if (currentUser.role === 'sirket_yoneticisi') {
          console.warn('Şirket yöneticisi olmasına rağmen kullanıcı listesi boş. Firestore kurallarını kontrol edin.');
        }
      } else {
        console.log(`${usersList.length} kullanıcı başarıyla yüklendi`);
      }
      
      setUsers(usersList);
    } catch (err) {
      setError('Kullanıcılar yüklenirken bir hata oluştu: ' + err.message);
      console.error('Kullanıcılar yüklenirken hata:', err);
    } finally {
      setLoading(false);
    }
  };

  // Şubeleri Firebase'den getir
  const fetchSubeler = async () => {
    try {
      const subelerCollection = collection(db, 'subeler');
      const subeSnapshot = await getDocs(subelerCollection);
      const subelerList = subeSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSubeler(subelerList);
    } catch (err) {
      console.error('Şubeler yüklenirken bir hata oluştu:', err);
    }
  };

  // Kullanıcının rolüne göre erişim haklarını kontrol et
  const checkUserPermissions = async () => {
    try {
      console.log('Kullanıcı yetkileri kontrol ediliyor...');
      
      if (currentUser && currentUser.role) {
        console.log('Kullanıcı rolü (permissions from AuthContext):', currentUser.role);
        
        // Şube yöneticisi ise
        if (currentUser.role === 'sube_yoneticisi') {
          console.log('Şube yöneticisi için roller sınırlandırılıyor');
          // Sadece personel ve kurye rolleri seçilebilir
          setRoleOptions(allRoleOptions.filter(role => 
            role.value === 'personel' || role.value === 'kurye'
          ));
          
          // Otomatik olarak kendi şubesini seç
          if (currentUser.subeId) {
            setSelectedSube(currentUser.subeId);
            setSelectedSubeAdi(currentUser.subeAdi || '');
          }
        } else if (currentUser.role === 'sirket_yoneticisi') {
          console.log('Şirket yöneticisi için tüm roller etkinleştiriliyor');
          // Şirket yöneticisi tüm rolleri görebilir
          setRoleOptions(allRoleOptions);
        }
      } else {
        // Eğer currentUser.role yoksa Firestore'dan query ile kontrol et
        console.log('Yetki kontrolü: Kullanıcı role bilgisi eksik, Firestore\'dan aranıyor, uid:', currentUser.uid);
        
        // uid alanı ile kullanıcıyı ara (doküman ID ile değil)
        const q = query(collection(db, 'users'), where('uid', '==', currentUser.uid));
        const userSnapshot = await getDocs(q);
        
        if (!userSnapshot.empty) {
          const userDoc = userSnapshot.docs[0];
          const userData = userDoc.data();
          console.log('Yetki kontrolü: Kullanıcı Firestore\'dan bulundu. Doküman ID:', userDoc.id);
          console.log('Kullanıcı rolü (permissions from Firestore):', userData.role);
          
          // Şube yöneticisi ise
          if (userData.role === 'sube_yoneticisi') {
            console.log('Şube yöneticisi için roller sınırlandırılıyor');
            // Sadece personel ve kurye rolleri seçilebilir
            setRoleOptions(allRoleOptions.filter(role => 
              role.value === 'personel' || role.value === 'kurye'
            ));
            
            // Otomatik olarak kendi şubesini seç
            if (userData.subeId) {
              setSelectedSube(userData.subeId);
              setSelectedSubeAdi(userData.subeAdi || '');
            }
          } else if (userData.role === 'sirket_yoneticisi') {
            console.log('Şirket yöneticisi için tüm roller etkinleştiriliyor');
            // Şirket yöneticisi tüm rolleri görebilir
            setRoleOptions(allRoleOptions);
          }
        } else {
          console.error('Yetki kontrolü: Kullanıcı verileri bulunamadı. UID ile arama yapıldı:', currentUser.uid);
        }
      }
    } catch (err) {
      console.error('Kullanıcı yetkileri kontrol edilirken bir hata oluştu:', err);
    }
  };
  
  useEffect(() => {
    fetchUsers(filterSubeId);
    fetchSubeler();
    checkUserPermissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Şube filtresi değiştiğinde kullanıcıları yeniden yükle
  useEffect(() => {
    fetchUsers(filterSubeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterSubeId]);

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
        setSelectedSube(userData.subeId || '');
        setSelectedSubeAdi(userData.subeAdi || '');
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

    // Şube yöneticisi güvenlik kontrolü
    if (currentUser.role === 'sube_yoneticisi') {
      // Şube yöneticileri sadece personel ve kurye rollerini düzenleyebilir
      if (role !== 'personel' && role !== 'kurye') {
        setError('Şube yöneticileri yalnızca personel ve kurye rollerini düzenleyebilir.');
        setLoading(false);
        return;
      }
    }
    
    try {
      setLoading(true);
      console.log('Kullanıcı güncellenmeye başlanıyor, kullanıcı ID:', editUserId);
      
      // Önce mevcut kullanıcı bilgilerini kontrol et
      const userRef = doc(db, 'users', editUserId);
      const currentUserDoc = await getDoc(userRef);
      
      if (!currentUserDoc.exists()) {
        throw new Error('Güncellenecek kullanıcı bulunamadı');
      }
      
      const currentUserData = currentUserDoc.data();
      console.log('Mevcut kullanıcı verileri:', currentUserData);
      console.log('Yeni değerler - Rol:', role, 'Şube:', selectedSube);
      
      // Firestore'daki kullanıcı bilgilerini güncelle
      const updateData = {
        displayName: displayName,
        role: role,
        updatedAt: new Date(),
        updatedBy: currentUser.uid
      };
      
      // Eğer şube seçildiyse ekle, seçilmediyse ve önceden varsa kaldır
      if (selectedSube) {
        const sube = subeler.find(s => s.id === selectedSube);
        if (sube) {
          updateData.subeId = selectedSube;
          updateData.subeAdi = sube.subeAdi;
          console.log('Şube bilgisi ekleniyor:', sube.subeAdi);
        }
      } else if (currentUserData.subeId) {
        // Eğer şube seçilmediyse ve önceden bir şube varsa, açıkça null olarak ayarla
        updateData.subeId = null;
        updateData.subeAdi = null;
        console.log('Şube bilgisi kaldırılıyor');
      }
      
      console.log('Güncellenecek veriler:', updateData);
      
      // Güncelleme işlemi
      await updateDoc(userRef, updateData);
      console.log('Kullanıcı güncelleme başarılı');
      
      setSuccess('Kullanıcı başarıyla güncellendi!');
      
      // Formu temizle ve edit modundan çık
      resetForm();
      
      // Kullanıcı listesini yenile
      fetchUsers();
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
    setSelectedSube('');
    setSelectedSubeAdi('');
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

    // Şube yöneticisi güvenlik kontrolü
    if (currentUser.role === 'sube_yoneticisi') {
      // Şube yöneticileri sadece personel ve kurye rollerini ekleyebilir
      if (role !== 'personel' && role !== 'kurye') {
        setError('Şube yöneticileri yalnızca personel ve kurye rollerini ekleyebilir.');
        return;
      }
      
      // Şube yöneticileri kendi şubelerini kullanmak zorunda
      if (selectedSube !== currentUser.subeId) {
        setSelectedSube(currentUser.subeId);
        setSelectedSubeAdi(currentUser.subeAdi || '');
      }
    }
    
    try {
      setLoading(true);
      
      // Firebase Authentication ile kullanıcı oluştur
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Kullanıcı displayName'ini ayarla
      await updateProfile(userCredential.user, {
        displayName: displayName
      });
      
      // Firestore'a kullanıcı bilgilerini ekle
      const userData = {
        uid: userCredential.user.uid,
        email: email,
        displayName: displayName,
        role: role,
        createdAt: new Date(),
        createdBy: currentUser.uid
      };
      
      // Eğer şube seçildiyse ekle
      if (selectedSube) {
        const sube = subeler.find(s => s.id === selectedSube);
        if (sube) {
          userData.subeId = selectedSube;
          userData.subeAdi = sube.subeAdi;
        }
      }
      
      await addDoc(collection(db, 'users'), userData);
      
      setSuccess('Kullanıcı başarıyla oluşturuldu!');
      
      // Formu temizle
      resetForm();
      
      // Kullanıcı listesini yenile
      fetchUsers();
    } catch (err) {
      setError('Kullanıcı oluşturulurken bir hata oluştu: ' + err.message);
      console.error(err);
    } finally {
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
        fetchUsers();
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
    const role = roleOptions.find(r => r.value === roleValue);
    return role ? role.label : roleValue;
  };

  return (
    <div className="users-container">
      <PageHeader
        icon="people"
        title="Kullanıcı Yönetimi"
        description="Sistem kullanıcılarını yönetin ve yeni kullanıcılar ekleyin"
        actions={(
          <button 
            className="add-button modern"
            onClick={() => setFormVisible(!formVisible)}
          >
            <span className="material-icons">add</span>
            {formVisible ? 'Formu Kapat' : 'Yeni Kullanıcı Ekle'}
          </button>
        )}
      />
      
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}
      
      {formVisible && (
        <div className="user-form-container">
          <h3>{editMode ? 'Kullanıcı Düzenle' : 'Yeni Kullanıcı Ekle'}</h3>
          <form onSubmit={editMode ? handleUpdateUser : handleCreateUser} className="user-form">
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
                disabled={editMode} // Düzenleme modunda e-posta değiştirilemesin
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
                {roleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="form-group">
              <label htmlFor="sube">Şube</label>
              <select
                id="sube"
                value={selectedSube}
                onChange={(e) => {
                  const subeId = e.target.value;
                  setSelectedSube(subeId);
                  const sube = subeler.find(s => s.id === subeId);
                  setSelectedSubeAdi(sube ? sube.subeAdi : '');
                }}
                disabled={currentUser.role === 'sube_yoneticisi'} // Şube yöneticisi için şube değiştirilemez
              >
                <option value="">Şube Seçiniz</option>
                {subeler.map((sube) => (
                  <option key={sube.id} value={sube.id}>
                    {sube.subeAdi}
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
                {loading 
                  ? (editMode ? 'Güncelleniyor...' : 'Ekleniyor...') 
                  : (editMode ? 'Güncelle' : 'Kullanıcı Ekle')}
              </button>
            </div>
          </form>
        </div>
      )}
      
      {/* Şube filtreleme alanı - sadece şirket yöneticisi için */}
      {currentUser?.role === 'sirket_yoneticisi' && (
        <div className="filter-bar">
          <div className="form-group inline">
            <label htmlFor="filterSube">Şube Filtresi</label>
            <select
              id="filterSube"
              value={filterSubeId}
              onChange={(e) => setFilterSubeId(e.target.value)}
            >
              <option value="">Tüm Şubeler</option>
              {subeler.map((sube) => (
                <option key={sube.id} value={sube.id}>
                  {sube.subeAdi}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="users-table-container">
        {loading && !formVisible ? (
          <p className="loading-text">Kullanıcılar yükleniyor...</p>
        ) : users.length === 0 ? (
          <p className="no-data">Henüz kullanıcı bulunmamaktadır.</p>
        ) : (
          <>
            {/* Masaüstü için tablo görünümü */}
            <table className="users-table users-table-desktop">
              <thead>
                <tr>
                  <th>Ad Soyad</th>
                  <th>E-posta</th>
                  <th>Rol</th>
                  <th>Şube</th>
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
                    <td>{user.subeAdi || '-'}</td>
                    <td>
                      {user.createdAt
                        ? new Date(user.createdAt.seconds * 1000).toLocaleDateString('tr-TR')
                        : '-'}
                    </td>
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

            {/* Mobil için kart görünümü */}
            <div className="users-cards-mobile">
              {users.map((user) => (
                <div key={user.id} className="user-card">
                  <div className="user-card-header">
                    <div className="user-avatar-circle">
                      <span className="material-icons">person</span>
                    </div>
                    <div className="user-card-main">
                      <div className="user-name">{user.displayName}</div>
                      <div className="user-role">{getRoleName(user.role)}</div>
                    </div>
                  </div>
                  <div className="user-card-body">
                    <div className="user-row">
                      <span className="label">E-posta</span>
                      <span className="value email">{user.email}</span>
                    </div>
                    <div className="user-row">
                      <span className="label">Şube</span>
                      <span className="value">{user.subeAdi || '-'}</span>
                    </div>
                    <div className="user-row">
                      <span className="label">Oluşturulma</span>
                      <span className="value">
                        {user.createdAt
                          ? new Date(user.createdAt.seconds * 1000).toLocaleDateString('tr-TR')
                          : '-'}
                      </span>
                    </div>
                  </div>
                  <div className="user-card-footer">
                    <button
                      className="card-action-button edit"
                      onClick={() => handleEditUser(user.id)}
                    >
                      <span className="material-icons">edit</span>
                      Düzenle
                    </button>
                    <button
                      className="card-action-button delete"
                      onClick={() => handleDeleteUser(user.id)}
                    >
                      <span className="material-icons">delete</span>
                      Sil
                    </button>
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

export default UsersPage;
