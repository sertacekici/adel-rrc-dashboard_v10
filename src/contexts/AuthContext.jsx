import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';

const AuthContext = createContext();

export { AuthContext }; // AuthContext'i de export ediyoruz

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const db = getFirestore();

  // Kullanıcının rol bilgisini Firebase'den getir
  const getUserRole = async (user) => {
    try {
      const q = query(collection(db, 'users'), where('uid', '==', user.uid));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0];
        const userData = userDoc.data();
        
        console.log('Kullanıcı rol bilgisi Firestore\'dan alındı:', userData);
        
        // Eğer kullanıcı şube yöneticisiyse ve subeId varsa, şube bilgilerini de getir
        let subeAdi = userData.subeAdi;
        
        if (userData.role === 'sube_yoneticisi' && userData.subeId && !subeAdi) {
          try {
            console.log('Şube yöneticisi için şube bilgileri getiriliyor:', userData.subeId);
            const subeDoc = await getDoc(doc(db, 'subeler', userData.subeId));
            
            if (subeDoc.exists()) {
              const subeData = subeDoc.data();
              subeAdi = subeData.sube_adi;
              console.log('Şube adı alındı:', subeAdi);
            }
          } catch (subeError) {
            console.error('Şube bilgileri alınırken hata:', subeError);
          }
        }
        
        return { 
          role: userData.role,
          subeId: userData.subeId,
          subeAdi: subeAdi,
          firestoreId: userDoc.id
        };
      }
      console.warn('Kullanıcı bilgisi bulunamadı! UID:', user.uid);
      return { role: null };
    } catch (error) {
      console.error('Kullanıcı rol bilgisi alınırken hata oluştu:', error);
      console.error('Hata detayı:', error.code, error.message);
      return { role: null };
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        console.log('Kullanıcı oturum açtı:', user.uid, user.email);
        const userRoleData = await getUserRole(user);
        setUserRole(userRoleData);
        
        // Kullanıcı bilgisini rolüyle birlikte güncelle
        const enhancedUser = {
          ...user,
          role: userRoleData.role,
          subeId: userRoleData.subeId,
          subeAdi: userRoleData.subeAdi,
          firestoreId: userRoleData.firestoreId // Firestore doküman ID'sini ekleyelim
        };
        console.log('Güncellenmiş kullanıcı bilgileri:', enhancedUser);
        setCurrentUser(enhancedUser);
        
        if (!userRoleData.role) {
          console.error('Kullanıcının rol bilgisi bulunamadı. Kullanıcı dokümanı olabilir ancak role alanı eksik.');
        }
      } else {
        console.log('Kullanıcı oturumu kapatıldı');
        setCurrentUser(null);
        setUserRole(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userRole,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
