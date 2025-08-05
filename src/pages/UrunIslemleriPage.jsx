import React, { useState, useEffect, useContext } from 'react';
import { getFirestore, collection, addDoc, getDocs, doc, deleteDoc, updateDoc, getDoc, query, where } from 'firebase/firestore';
import { AuthContext } from '../contexts/AuthContext';
import './UrunIslemleriPage.css';

const UrunIslemleriPage = () => {
  const [urunler, setUrunler] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUrun, setEditingUrun] = useState(null);
  const [formData, setFormData] = useState({
    urun_adi: '',
    birim_olcusu: 'KG',
    fiyat: 0
  });

  const db = getFirestore();
  const { currentUser } = useContext(AuthContext);

  // Ürünleri Firebase'den getir
  const fetchUrunler = async () => {
    try {
      setLoading(true);
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

  useEffect(() => {
    fetchUrunler();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'fiyat' ? parseFloat(value) || 0 : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Debug için kullanıcı bilgilerini kontrol et
      console.log('Mevcut kullanıcı:', currentUser);
      console.log('Kullanıcı rolü:', currentUser?.role);
      console.log('Kullanıcı UID:', currentUser?.uid);
      
      // Users koleksiyonundan kullanıcı bilgisini kontrol et
      if (currentUser?.uid) {
        try {
          const userQuery = query(collection(db, 'users'), where('uid', '==', currentUser.uid));
          const userSnapshot = await getDocs(userQuery);
          console.log('Users koleksiyonu sorgu sonucu:', userSnapshot.size);
          if (!userSnapshot.empty) {
            const userData = userSnapshot.docs[0].data();
            console.log('Users koleksiyonundaki kullanıcı verisi:', userData);
          } else {
            console.error('Users koleksiyonunda kullanıcı bulunamadı!');
          }
        } catch (queryError) {
          console.error('Users koleksiyonu sorgu hatası:', queryError);
        }
      }
      
      if (editingUrun) {
        // Güncelleme
        await updateDoc(doc(db, 'urunler', editingUrun.id), formData);
        console.log('Ürün güncellendi');
      } else {
        // Yeni ürün ekleme
        console.log('Ürün ekleme işlemi başlatılıyor...');
        await addDoc(collection(db, 'urunler'), {
          ...formData,
          olusturulma_tarihi: new Date(),
        });
        console.log('Yeni ürün eklendi');
      }
      
      setShowModal(false);
      setEditingUrun(null);
      setFormData({ urun_adi: '', birim_olcusu: 'KG', fiyat: 0 });
      fetchUrunler();
    } catch (error) {
      console.error('Ürün kaydedilirken hata:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      console.error('Kullanıcı auth durumu:', currentUser?.uid ? 'Authenticated' : 'Not authenticated');
      alert('Ürün kaydedilirken bir hata oluştu. Konsolu kontrol edin.');
    }
  };

  const handleEdit = (urun) => {
    setEditingUrun(urun);
    setFormData({
      urun_adi: urun.urun_adi,
      birim_olcusu: urun.birim_olcusu,
      fiyat: urun.fiyat
    });
    setShowModal(true);
  };

  const handleDelete = async (urunId) => {
    if (window.confirm('Bu ürünü silmek istediğinizden emin misiniz?')) {
      try {
        await deleteDoc(doc(db, 'urunler', urunId));
        console.log('Ürün silindi');
        fetchUrunler();
      } catch (error) {
        console.error('Ürün silinirken hata:', error);
      }
    }
  };

  const birimOlcusuOptions = ['KG', 'Litre', 'Adet', 'Paket', 'Kutu'];

  return (
    <div className="urun-islemleri-container">
      <div className="page-header">
        <div className="header-content">
          <div className="title-section">
            <h1>
              <span className="material-icons">inventory_2</span>
              Ürün İşlemleri
            </h1>
            <p>Şube siparişlerinde kullanılacak ürünleri yönetin</p>
          </div>
        </div>
      </div>

      <div className="content-area">
        <div className="content-header">
          <h2>
            <span className="material-icons">list</span>
            Ürün Listesi
          </h2>
          <button 
            className="add-button modern"
            onClick={() => setShowModal(true)}
          >
            <span className="material-icons">add</span>
            Yeni Ürün Ekle
          </button>
        </div>
        {loading ? (
          <div className="loading-text">Ürünler yükleniyor...</div>
        ) : urunler.length === 0 ? (
          <div className="no-data">Henüz ürün bulunmamaktadır.</div>
        ) : (
          <div className="urunler-table-container">
            <table className="urunler-table">
              <thead>
                <tr>
                  <th>Ürün Adı</th>
                  <th>Birim Ölçüsü</th>
                  <th>Fiyat (₺)</th>
                  <th>Oluşturulma Tarihi</th>
                  <th>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {urunler.map((urun) => (
                  <tr key={urun.id}>
                    <td>
                      <div className="urun-info">
                        <span className="material-icons">inventory_2</span>
                        {urun.urun_adi}
                      </div>
                    </td>
                    <td>
                      <span className="birim-badge">{urun.birim_olcusu}</span>
                    </td>
                    <td>
                      <span className="fiyat-text">
                        {urun.fiyat === 0 ? 'Ücretsiz' : `₺${urun.fiyat.toFixed(2)}`}
                      </span>
                    </td>
                    <td>
                      {urun.olusturulma_tarihi?.toDate?.()?.toLocaleDateString('tr-TR') || 'Bilinmiyor'}
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          className="action-button edit"
                          onClick={() => handleEdit(urun)}
                          title="Düzenle"
                        >
                          <span className="material-icons">edit</span>
                        </button>
                        <button
                          className="action-button delete"
                          onClick={() => handleDelete(urun.id)}
                          title="Sil"
                        >
                          <span className="material-icons">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                <span className="material-icons">inventory_2</span>
                {editingUrun ? 'Ürün Düzenle' : 'Yeni Ürün Ekle'}
              </h2>
              <button 
                className="close-button"
                onClick={() => setShowModal(false)}
              >
                <span className="material-icons">close</span>
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label htmlFor="urun_adi">Ürün Adı</label>
                <input
                  type="text"
                  id="urun_adi"
                  name="urun_adi"
                  value={formData.urun_adi}
                  onChange={handleInputChange}
                  required
                  placeholder="Örn: Tavuk, Sos, Kağıt"
                />
              </div>

              <div className="form-group">
                <label htmlFor="birim_olcusu">Birim Ölçüsü</label>
                <select
                  id="birim_olcusu"
                  name="birim_olcusu"
                  value={formData.birim_olcusu}
                  onChange={handleInputChange}
                  required
                >
                  {birimOlcusuOptions.map(birim => (
                    <option key={birim} value={birim}>{birim}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="fiyat">Fiyat (₺)</label>
                <input
                  type="number"
                  id="fiyat"
                  name="fiyat"
                  value={formData.fiyat}
                  onChange={handleInputChange}
                  min="0"
                  step="0.01"
                  placeholder="0.00 (Ücretsiz)"
                />
                <small>Not: Fiyat 0 olarak bırakılabilir</small>
              </div>

              <div className="form-actions">
                <button 
                  type="button" 
                  className="cancel-button"
                  onClick={() => setShowModal(false)}
                >
                  İptal
                </button>
                <button type="submit" className="submit-button">
                  {editingUrun ? 'Güncelle' : 'Ekle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UrunIslemleriPage;
