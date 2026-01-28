import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';

const AuthContext = createContext();

export { AuthContext };

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const db = getFirestore();

  useEffect(() => {
    let unsubscribeProfile = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      // Önceki profil dinleyicisini temizle
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (user) {
        console.log('Kullanıcı oturum açtı, profil dinleniyor:', user.uid);
        
        // Kullanıcı dökümanını gerçek zamanlı izle
        const q = query(collection(db, 'users'), where('uid', '==', user.uid));
        
        unsubscribeProfile = onSnapshot(q, async (snapshot) => {
          if (!snapshot.empty) {
            const userDoc = snapshot.docs[0];
            const userData = userDoc.data();
            
            let subeAdi = userData.subeAdi;
            
            // Şube yöneticisi ise ve adı yoksa çek
            if (userData.role === 'sube_yoneticisi' && userData.subeId && !subeAdi) {
              try {
                const subeDoc = await getDoc(doc(db, 'subeler', userData.subeId));
                if (subeDoc.exists()) {
                  subeAdi = subeDoc.data().sube_adi;
                }
              } catch (e) {
                console.error('Şube adı alınamadı:', e);
              }
            }

            const enhancedUser = {
              ...user,
              role: userData.role,
              subeId: userData.subeId,
              subeAdi: subeAdi,
              firestoreId: userDoc.id,
              ...userData
            };
            
            setCurrentUser(enhancedUser);
          } else {
            console.warn('Kullanıcı dökümanı bulunamadı.');
            
            // Özel Durum: Admin kullanıcısı ise döküman olmasa bile yetki ver
            if (user.email === 'sertacekici@gmail.com') {
              console.log('Admin kullanıcısı algılandı, yetkiler tanımlanıyor...');
              const adminUser = {
                ...user,
                role: 'sirket_yoneticisi',
                firstName: 'Sertaç',
                lastName: 'Ekici'
              };
              setCurrentUser(adminUser);
            } else {
              setCurrentUser(user);
            }
          }
          setLoading(false);
        }, (err) => {
          console.error('Profil dinleme hatası:', err);
          setLoading(false);
        });
      } else {
        console.log('Kullanıcı oturumu kapatıldı');
        setCurrentUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const value = {
    currentUser,
    loading,
    userRole: currentUser ? { role: currentUser.role, subeId: currentUser.subeId } : null
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
