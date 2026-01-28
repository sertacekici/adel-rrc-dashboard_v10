import React, { useState, useEffect } from "react";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  updateDoc,
  doc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import "./GiderKalemiKaydiPage.css";

const GiderKalemiKaydiPage = () => {
  const { currentUser } = useAuth();
  const [giderKalemleri, setGiderKalemleri] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [scrollPosition, setScrollPosition] = useState(0);

  // Form state
  const [formData, setFormData] = useState({
    ad: "",
    aciklama: "",
  });

  // Form validation errors
  const [errors, setErrors] = useState({});

  // Notification state
  const [notification, setNotification] = useState({
    show: false,
    message: "",
    type: "",
  });

  useEffect(() => {
    // Gider kalemlerini dinle
    try {
      let q = query(collection(db, "giderKalemleri"));

      // Eğer kullanıcı şube yöneticisi ise, sadece kendi şubesine ait veya genel (subeId olmayan) kayıtları görsün
      // Not: Firestore'da 'OR' sorgusu karmaşık olduğu için client-side filtreleme yapmak daha güvenli olabilir
      // Ancak veri güvenliği için query ile filtreleme tercih edilir. 
      // Şimdilik tümünü çekip client side filtreleyeceğiz çünkü "subeId == null OR subeId == mySubeId" sorgusu için index gerekir.
      
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          let items = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

          // Şube yöneticisi için filtreleme:
          // 1. subeId alanı olmayanlar (Genel)
          // 2. subeId alanı kendi şubesi olanlar
          if (currentUser?.role === 'sube_yoneticisi' && currentUser.subeId) {
            items = items.filter(item => !item.subeId || item.subeId === currentUser.subeId);
          }

          // Client-side sorting
          items.sort((a, b) => {
            const dateA = a.olusturmaTarihi?.toDate() || new Date(0);
            const dateB = b.olusturmaTarihi?.toDate() || new Date(0);
            return dateB - dateA; // En yeni önce
          });

          setGiderKalemleri(items);
          setLoading(false);
        },
        (error) => {
          console.error("Gider kalemleri dinleme hatası:", error);
          setGiderKalemleri([]);
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (error) {
      console.error("Gider kalemleri sorgu hatası:", error);
      setGiderKalemleri([]);
      setLoading(false);
    }
  }, []);

  // Scroll yönetimi - Modal açılırken scroll pozisyonunu kaydet ve üste çık
  useEffect(() => {
    if (showForm) {
      // Mevcut scroll pozisyonunu kaydet
      setScrollPosition(window.pageYOffset);
      // Sayfayı üste kaydır
      window.scrollTo({ top: 0, behavior: 'smooth' });
      // Body'de scroll'u engelle
      document.body.style.overflow = 'hidden';
    } else {
      // Modal kapandığında eski pozisyona dön
      document.body.style.overflow = '';
      if (scrollPosition > 0) {
        window.scrollTo({ top: scrollPosition, behavior: 'smooth' });
      }
    }

    // Cleanup function
    return () => {
      document.body.style.overflow = '';
    };
  }, [showForm, scrollPosition]);

  const showNotification = (message, type = "success") => {
    setNotification({ show: true, message, type });
    setTimeout(() => {
      setNotification({ show: false, message: "", type: "" });
    }, 3000);
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.ad.trim()) {
      newErrors.ad = "Gider kalemi adı zorunludur";
    }

    if (!formData.aciklama.trim()) {
      newErrors.aciklama = "Açıklama zorunludur";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      const now = new Date();

      if (editingItem) {
        // Güncelleme
        await updateDoc(doc(db, "giderKalemleri", editingItem.id), {
          ad: formData.ad.trim(),
          aciklama: formData.aciklama.trim(),
          guncellemeTarihi: now,
        });
        showNotification("Gider kalemi başarıyla güncellendi");
      } else {
        // Yeni kayıt
        const newGiderKalemi = {
          ad: formData.ad.trim(),
          aciklama: formData.aciklama.trim(),
          aktif: true,
          olusturanKullanici: currentUser.uid,
          olusturmaTarihi: now,
          guncellemeTarihi: now,
        };

        // Eğer kullanıcı bir şube yöneticisiyse, şube ID'yi ekle
        // Şirket yöneticisi ise global (tüm şubelerde görünen) bir gider kalemi olarak kaydedilecek (subeId olmadan)
        if (currentUser.role === 'sube_yoneticisi' && currentUser.subeId) {
          newGiderKalemi.subeId = currentUser.subeId;
        }

        await addDoc(collection(db, "giderKalemleri"), newGiderKalemi);
        showNotification("Gider kalemi başarıyla eklendi");
      }

      // Form'u temizle
      setFormData({ ad: "", aciklama: "" });
      setShowForm(false);
      setEditingItem(null);
      setErrors({});
    } catch (error) {
      console.error("Gider kalemi kaydetme hatası:", error);
      showNotification("Bir hata oluştu. Lütfen tekrar deneyin.", "error");
    }
  };

  const handleEdit = (item) => {
    setFormData({
      ad: item.ad,
      aciklama: item.aciklama,
    });
    setEditingItem(item);
    setShowForm(true);
    setErrors({});
  };

  const handleDelete = async (id) => {
    if (
      window.confirm("Bu gider kalemini silmek istediğinizden emin misiniz?")
    ) {
      try {
        await deleteDoc(doc(db, "giderKalemleri", id));
        showNotification("Gider kalemi başarıyla silindi");
      } catch (error) {
        console.error("Gider kalemi silme hatası:", error);
        showNotification("Silme işlemi sırasında bir hata oluştu.", "error");
      }
    }
  };

  const toggleActive = async (id, currentStatus) => {
    try {
      await updateDoc(doc(db, "giderKalemleri", id), {
        aktif: !currentStatus,
        guncellemeTarihi: new Date(),
      });
      showNotification(
        `Gider kalemi ${!currentStatus ? "aktif" : "pasif"} hale getirildi`
      );
    } catch (error) {
      console.error("Durum güncelleme hatası:", error);
      showNotification("Durum güncelleme sırasında bir hata oluştu.", "error");
    }
  };

  const resetForm = () => {
    setFormData({ ad: "", aciklama: "" });
    setShowForm(false);
    setEditingItem(null);
    setErrors({});
  };

  if (loading) {
    return (
      <div className="gider-kalemi-page">
        <div className="loading">
          <div className="loading-spinner"></div>
          <p>Yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="gider-kalemi-page">
      {/* Notification */}
      {notification.show && (
        <div className={`notification ${notification.type}`}>
          <span className="material-icons">
            {notification.type === "success" ? "check_circle" : "error"}
          </span>
          {notification.message}
        </div>
      )}

      
      <div className="page-header">
        <div className="header-content">
          <div className="title-section">
            <h1>
              <span className="material-icons">category</span>
              Gider Kalemi Kaydı
            </h1>
            <p>Gider kategorilerini tanımlayın ve listeyi yönetin</p>
          </div>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>
                <span className="material-icons">
                  {editingItem ? "edit_note" : "add_circle"}
                </span>
                {editingItem
                  ? "Gider Kalemi Düzenle"
                  : "Yeni Gider Kalemi Ekle"}
              </h2>
              <button className="close-button" onClick={resetForm}>
                <span className="material-icons">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="form">
              <div className="form-group">
                <label htmlFor="ad">
                  Gider Kalemi Adı <span className="required">*</span>
                </label>
                <input
                  type="text"
                  id="ad"
                  value={formData.ad}
                  onChange={(e) =>
                    setFormData({ ...formData, ad: e.target.value })
                  }
                  className={errors.ad ? "error" : ""}
                  placeholder="Örn: Ofis Malzemeleri"
                />
                {errors.ad && (
                  <span className="error-message">{errors.ad}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="aciklama">
                  Açıklama <span className="required">*</span>
                </label>
                <textarea
                  id="aciklama"
                  value={formData.aciklama}
                  onChange={(e) =>
                    setFormData({ ...formData, aciklama: e.target.value })
                  }
                  className={errors.aciklama ? "error" : ""}
                  placeholder="Gider kalemi hakkında detaylı açıklama..."
                  rows="3"
                />
                {errors.aciklama && (
                  <span className="error-message">{errors.aciklama}</span>
                )}
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  onClick={resetForm}
                  className="cancel-button"
                >
                  <span className="material-icons">cancel</span>
                  İptal
                </button>
                <button type="submit" className="save-button">
                  <span className="material-icons">
                    {editingItem ? "update" : "save"}
                  </span>
                  {editingItem ? "Güncelle" : "Kaydet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Gider Kalemleri Listesi */}
      <div className="content">
        <div className="content-header">
          <h2 className="content-title">Gider Kalemleri</h2>
          <button className="add-button" onClick={() => setShowForm(true)}>
            <span className="material-icons">add_circle</span>
            Yeni Gider Kalemi Ekle
          </button>
        </div>

        {giderKalemleri.length === 0 ? (
          <div className="empty-state">
            <span className="material-icons">segment</span>
            <h3>Henüz gider kalemi bulunmuyor</h3>
            <p>
              Yeni gider kalemi eklemek için "Yeni Gider Kalemi Ekle" butonuna
              tıklayın.
            </p>
          </div>
        ) : (
          <div className="items-grid">
            {giderKalemleri.map((item) => (
              <div
                key={item.id}
                className={`item-card ${!item.aktif ? "inactive" : ""}`}
              >
                <div className="item-header">
                  <h3>{item.ad}</h3>
                  <div className="item-actions">
                    <button
                      className="action-button edit"
                      onClick={() => handleEdit(item)}
                      title="Düzenle"
                    >
                      <span className="material-icons">edit</span>
                    </button>
                    <button
                      className={`action-button toggle ${
                        item.aktif ? "active" : "inactive"
                      }`}
                      onClick={() => toggleActive(item.id, item.aktif)}
                      title={item.aktif ? "Pasif Yap" : "Aktif Yap"}
                    >
                      <span className="material-icons">
                        {item.aktif ? "visibility" : "visibility_off"}
                      </span>
                    </button>
                    <button
                      className="action-button delete"
                      onClick={() => handleDelete(item.id)}
                      title="Sil"
                    >
                      <span className="material-icons">delete</span>
                    </button>
                  </div>
                </div>

                <p className="item-description">{item.aciklama}</p>

                <div className="item-footer">
                  <span
                    className={`status ${item.aktif ? "active" : "inactive"}`}
                  >
                    {item.aktif ? "Aktif" : "Pasif"}
                  </span>
                  <span className="created-date">
                    {item.olusturmaTarihi?.toDate().toLocaleDateString("tr-TR")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default GiderKalemiKaydiPage;
