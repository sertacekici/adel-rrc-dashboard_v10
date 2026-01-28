import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import PageHeader from '../components/PageHeader';
import './SettingsPage.css';

const SettingsPage = () => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({
    showBranchOperations: true,
    showCourierOperations: true,
    showReportOperations: true
  });
  const [saveStatus, setSaveStatus] = useState(null);

  useEffect(() => {
    // Ayarları Firestore'dan dinle
    const settingsRef = doc(db, 'system', 'settings');
    
    // Auth kontrolünü layout/route seviyesinde yapıyoruz ama burada da ekstra kontrol olabilir
    if (currentUser?.role !== 'sirket_yoneticisi') {
       setLoading(false);
       return;
    }

    const unsubscribe = onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSettings({
          showBranchOperations: data.showBranchOperations !== undefined ? data.showBranchOperations : true,
          showCourierOperations: data.showCourierOperations !== undefined ? data.showCourierOperations : true,
          showReportOperations: data.showReportOperations !== undefined ? data.showReportOperations : true
        });
      } else {
        // Doküman yoksa varsayılanları oluştur
        console.log("Ayarlar dokümanı yok, oluşturuluyor...");
        setDoc(settingsRef, {
          showBranchOperations: true,
          showCourierOperations: true,
          showReportOperations: true,
          updatedAt: new Date(),
          updatedBy: currentUser.uid
        });
      }
      setLoading(false);
    }, (error) => {
      console.error("Ayarlar yüklenirken hata:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const handleToggle = async (key) => {
    const newValue = !settings[key];
    const settingsRef = doc(db, 'system', 'settings');
    
    // Optimistik güncelleme
    setSettings(prev => ({ ...prev, [key]: newValue }));
    
    try {
      setSaveStatus('saving');
      await setDoc(settingsRef, {
        ...settings,
        [key]: newValue,
        updatedAt: new Date(),
        updatedBy: currentUser.uid
      }, { merge: true });
      
      setSaveStatus('success');
      setTimeout(() => setSaveStatus(null), 2000);
    } catch (error) {
      console.error("Ayar güncellenirken hata:", error);
      setSaveStatus('error');
      // Hata durumunda state'i geri al
      setSettings(prev => ({ ...prev, [key]: !newValue }));
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Ayarlar yükleniyor...</p>
      </div>
    );
  }

  // Yetki kontrolü UI için (Route guard var ama emin olmak için)
  if (currentUser?.role !== 'sirket_yoneticisi') {
    return (
      <div className="settings-container">
        <div className="error-message">
          <span className="material-icons">lock</span>
          Bu sayfaya erişim yetkiniz yok.
        </div>
      </div>
    );
  }

  return (
    <div className="settings-container">
      <PageHeader
        icon="settings"
        title="Sistem Ayarları"
        description="Uygulama genelindeki modüllerin görünürlüğünü yönetin"
      />

      <div className="settings-content-wrapper">
        <div className="settings-section">
          <div className="section-title">
            <span className="material-icons">visibility</span>
            Menü Görünürlüğü
          </div>
          
          <div className="settings-list">
            <div className="setting-item">
              <div className="setting-info">
                <h3>Şube İşlemleri</h3>
                <p>Yan menüde "Şube İşlemleri" bölümünü göster/gizle</p>
              </div>
              <label className="switch">
                <input 
                  type="checkbox" 
                  checked={settings.showBranchOperations}
                  onChange={() => handleToggle('showBranchOperations')}
                />
                <span className="slider"></span>
              </label>
            </div>

            <div className="setting-item">
              <div className="setting-info">
                <h3>Kurye İşlemleri</h3>
                <p>Yan menüde "Kurye İşlemleri" bölümünü göster/gizle</p>
              </div>
              <label className="switch">
                <input 
                  type="checkbox" 
                  checked={settings.showCourierOperations}
                  onChange={() => handleToggle('showCourierOperations')}
                />
                <span className="slider"></span>
              </label>
            </div>
          </div>
          
          {saveStatus === 'success' && (
            <div className="save-status success">
              <span className="material-icons">check_circle</span>
              Ayarlar kaydedildi
            </div>
          )}
          {saveStatus === 'error' && (
            <div className="save-status error">
              <span className="material-icons">error</span>
              Ayarlar kaydedilemedi
            </div>
          )}
        </div>

        <div className="settings-section">
          <div className="section-title">
            <span className="material-icons">storage</span>
            Firestore Index Gereksinimleri
          </div>

          <div className="settings-note">
            Aşağıdaki composite index’ler Firestore Console üzerinden oluşturulmalıdır.
            Query scope: <b>Collection</b>.
          </div>

          <div className="indexes-table-wrapper">
            <table className="indexes-table">
              <thead>
                <tr>
                  <th>Collection ID</th>
                  <th>Alan 1 (Sıralama)</th>
                  <th>Alan 2 (Sıralama)</th>
                  <th>Kullanıldığı Sayfa</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Adisyonlar</td>
                  <td>rrc_restaurant_id (Asc)</td>
                  <td>tarih (Asc)</td>
                  <td>Adisyonlar, Genel Rapor</td>
                </tr>
                <tr>
                  <td>AdisyonIcerik</td>
                  <td>rrc_restaurant_id (Asc)</td>
                  <td>tarih (Asc)</td>
                  <td>Satış Adetleri</td>
                </tr>
                <tr>
                  <td>padisyoniptaller</td>
                  <td>rrc_restaurant_id (Asc)</td>
                  <td>iptaltarihi (Asc)</td>
                  <td>İptal Raporları</td>
                </tr>
                <tr>
                  <td>tblmasaiptalads</td>
                  <td>rrc_restaurant_id (Asc)</td>
                  <td>tarih (Asc)</td>
                  <td>İptal Raporları</td>
                </tr>
                <tr>
                  <td>giderKayitlari</td>
                  <td>subeId (Asc)</td>
                  <td>tarih (Desc)</td>
                  <td>Genel Rapor</td>
                </tr>
                <tr>
                  <td>kuryeatama</td>
                  <td>subeId (Asc)</td>
                  <td>atamaTarihi (Desc)</td>
                  <td>Genel Rapor</td>
                </tr>
                <tr>
                  <td>Masalar</td>
                  <td>rrc_restaurant_id (Asc)</td>
                  <td>masa_id (Asc)</td>
                  <td>Masalar</td>
                </tr>
                <tr>
                  <td>sube_bakiye_hareketleri</td>
                  <td>sube_id (Asc)</td>
                  <td>tarih (Desc)</td>
                  <td>Şube Bakiye Takip</td>
                </tr>
                <tr>
                  <td>sube_bakiye_hareketleri</td>
                  <td>siparis_id (Asc)</td>
                  <td>tarih (Desc)</td>
                  <td>Şube Bakiye Takip</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
