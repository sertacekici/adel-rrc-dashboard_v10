import React, { useState, useEffect, useContext } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { AuthContext } from '../contexts/AuthContext';
import './KuryeRaporuPage.css';

const KuryeRaporuPage = () => {
  const [subeler, setSubeler] = useState([]);
  const [kuryeler, setKuryeler] = useState([]);
  const [selectedSube, setSelectedSube] = useState('');
  const [selectedKurye, setSelectedKurye] = useState('');
  const [raporData, setRaporData] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Bugünün tarihini varsayılan olarak ayarla (günlük rapor)
  const today = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  
  const { currentUser } = useContext(AuthContext);

  // Hızlı tarih seçimi fonksiyonları
  const setDateRange = (type) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    
    let newStartDate, newEndDate;
    
    switch (type) {
      case 'today':
        newStartDate = today.toISOString().split('T')[0];
        newEndDate = today.toISOString().split('T')[0];
        break;
      case 'yesterday':
        newStartDate = yesterday.toISOString().split('T')[0];
        newEndDate = yesterday.toISOString().split('T')[0];
        break;
      case 'thisWeek':
        newStartDate = weekStart.toISOString().split('T')[0];
        newEndDate = today.toISOString().split('T')[0];
        break;
      case 'thisMonth':
        newStartDate = monthStart.toISOString().split('T')[0];
        newEndDate = today.toISOString().split('T')[0];
        break;
      default:
        return;
    }
    
    setStartDate(newStartDate);
    setEndDate(newEndDate);
    
    // Tarih değiştikten sonra otomatik rapor getir (kurye için)
    if (currentUser?.role === 'kurye') {
      setTimeout(() => {
        fetchKuryeRaporu();
      }, 100);
    }
  };

  // Şubeleri getir
  const fetchSubeler = async () => {
    try {
      const subeSnapshot = await getDocs(collection(db, 'subeler'));
      const subeList = subeSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSubeler(subeList);
    } catch (error) {
      console.error('Şubeler getirilirken hata:', error);
    }
  };

  // Kuryeleri getir
  const fetchKuryeler = async (subeId = null) => {
    try {
      let kuryeQuery;
      
      if (subeId) {
        kuryeQuery = query(
          collection(db, 'users'),
          where('role', '==', 'kurye'),
          where('subeId', '==', subeId)
        );
      } else {
        kuryeQuery = query(
          collection(db, 'users'),
          where('role', '==', 'kurye')
        );
      }
      
      const kuryeSnapshot = await getDocs(kuryeQuery);
      const kuryeList = kuryeSnapshot.docs.map(doc => ({
        id: doc.id,
        uid: doc.data().uid,
        ...doc.data()
      }));
      
      setKuryeler(kuryeList);
    } catch (error) {
      console.error('Kuryeler getirilirken hata:', error);
    }
  };

  // Kurye raporunu getir
  const fetchKuryeRaporu = async () => {
    if (!selectedKurye && currentUser?.role !== 'kurye') {
      alert('Lütfen kurye seçin');
      return;
    }

    setLoading(true);
    try {
      let kuryeAdi;
      
      if (currentUser?.role === 'kurye') {
        kuryeAdi = currentUser.displayName || currentUser.email;
      } else {
        const selectedKuryeData = kuryeler.find(k => k.id === selectedKurye);
        kuryeAdi = selectedKuryeData?.displayName || selectedKuryeData?.email;
      }

      console.log('Aranan kurye adı:', kuryeAdi);

      // Tüm adisyonları getir ve daha sonra filtrele (case-insensitive)
      let adisyonQuery = query(collection(db, 'Adisyonlar'));
      const adisyonSnapshot = await getDocs(adisyonQuery);
      
      let adisyonList = adisyonSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      console.log('Toplam adisyon sayısı:', adisyonList.length);
      
      // Kurye adı ile eşleşenleri filtrele (case-insensitive)
      adisyonList = adisyonList.filter(adisyon => {
        if (!adisyon.motorcu) return false;
        
        const motorcuLower = adisyon.motorcu.toLowerCase();
        const kuryeAdiLower = kuryeAdi.toLowerCase();
        
        console.log('Motorcu:', adisyon.motorcu, 'Aranan:', kuryeAdi, 'Eşleşme:', motorcuLower === kuryeAdiLower);
        
        return motorcuLower === kuryeAdiLower;
      });

      console.log('Kurye ile eşleşen adisyon sayısı:', adisyonList.length);

      // Masa siparişlerini filtrele (siparisnerden !== 88)
      adisyonList = adisyonList.filter(adisyon => adisyon.siparisnerden !== 88);

      console.log('Masa siparişleri filtrelendikten sonra:', adisyonList.length);

      // Tarih filtreleme
      if (startDate || endDate) {
        adisyonList = adisyonList.filter(adisyon => {
          if (!adisyon.tarih) return false;
          
          const adisyonDate = new Date(adisyon.tarih);
          const start = startDate ? new Date(startDate) : new Date('1900-01-01');
          const end = endDate ? new Date(endDate + 'T23:59:59') : new Date('2100-12-31');
          
          return adisyonDate >= start && adisyonDate <= end;
        });
      }

      console.log('Tarih filtrelendikten sonra:', adisyonList.length);

      // Tarihe göre sırala
      adisyonList.sort((a, b) => {
        const dateA = a.tarih ? new Date(a.tarih) : new Date(0);
        const dateB = b.tarih ? new Date(b.tarih) : new Date(0);
        return dateB - dateA;
      });

      setRaporData(adisyonList);
    } catch (error) {
      console.error('Kurye raporu getirilirken hata:', error);
      alert('Rapor getirilirken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser?.role === 'sirket_yoneticisi') {
      fetchSubeler();
      fetchKuryeler();
    } else if (currentUser?.role === 'sube_yoneticisi') {
      fetchKuryeler(currentUser.subeId);
    } else if (currentUser?.role === 'kurye') {
      // Kurye girişinde otomatik olarak günlük rapor getir
      fetchKuryeRaporu();
    }
  }, [currentUser]);

  useEffect(() => {
    if (selectedSube) {
      fetchKuryeler(selectedSube);
      setSelectedKurye('');
    }
  }, [selectedSube]);

  // Tarih formatla
  const formatDate = (dateString) => {
    if (!dateString) return 'Bilinmiyor';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('tr-TR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (err) {
      return dateString;
    }
  };

  // Tutar formatla
  const formatAmount = (amount) => {
    if (!amount) return '0,00 ₺';
    return Number(amount).toLocaleString('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + ' ₺';
  };

  // Toplam hesapla
  const calculateTotals = () => {
    const totalOrders = raporData.length;
    const totalAmount = raporData.reduce((sum, adisyon) => {
      return sum + (Number(adisyon.atop) || 0);
    }, 0);
    
    return { totalOrders, totalAmount };
  };

  // Ödeme tipini belirle
  const getOdemeTipi = (odemetipi) => {
    console.log('getOdemeTipi çağrıldı, değer:', odemetipi, 'tip:', typeof odemetipi);
    
    // Değer boş veya undefined ise
    if (!odemetipi && odemetipi !== 0) {
      return { text: 'Bilinmeyen', icon: 'help_outline', color: 'secondary' };
    }
    
    // String olarak gelen değerleri kontrol et
    const tipStr = String(odemetipi).toLowerCase().trim();
    
    // String değerler
    if (tipStr === 'nakit' || tipStr === 'cash') {
      return { text: 'Nakit', icon: 'payments', color: 'success' };
    }
    if (tipStr === 'kredi kartı' || tipStr === 'kredi karti' || tipStr === 'credit card' || tipStr === 'kart') {
      return { text: 'Kredi Kartı', icon: 'credit_card', color: 'primary' };
    }
    if (tipStr === 'ticket' || tipStr === 'ticket restaurant' || tipStr === 'yemek kartı' || tipStr === 'yemek karti') {
      return { text: 'Ticket Restaurant', icon: 'restaurant', color: 'warning' };
    }
    if (tipStr === 'sodexo') {
      return { text: 'Sodexo', icon: 'card_membership', color: 'info' };
    }
    if (tipStr === 'multinet') {
      return { text: 'Multinet', icon: 'card_membership', color: 'info' };
    }
    if (tipStr === 'veresiye' || tipStr === 'vadeli') {
      return { text: 'Veresiye', icon: 'schedule', color: 'secondary' };
    }
    if (tipStr === 'online' || tipStr === 'online ödeme' || tipStr === 'online odeme') {
      return { text: 'Online Ödeme', icon: 'online_prediction', color: 'primary' };
    }
    if (tipStr === 'transfer' || tipStr === 'havale') {
      return { text: 'Transfer', icon: 'account_balance', color: 'primary' };
    }
    
    // Sayısal değerler
    const tip = parseInt(odemetipi);
    
    switch (tip) {
      case 0:
        return { text: 'Nakit', icon: 'payments', color: 'success' };
      case 1:
        return { text: 'Kredi Kartı', icon: 'credit_card', color: 'primary' };
      case 2:
        return { text: 'Ticket Restaurant', icon: 'restaurant', color: 'warning' };
      case 3:
        return { text: 'Sodexo', icon: 'card_membership', color: 'info' };
      case 4:
        return { text: 'Veresiye', icon: 'schedule', color: 'secondary' };
      case 5:
        return { text: 'Online Ödeme', icon: 'online_prediction', color: 'primary' };
      case 6:
        return { text: 'Transfer', icon: 'account_balance', color: 'primary' };
      case 7:
        return { text: 'Multinet', icon: 'card_membership', color: 'info' };
      default:
        console.log('Bilinmeyen ödeme tipi:', odemetipi);
        return { text: `Diğer (${odemetipi})`, icon: 'help_outline', color: 'secondary' };
    }
  };

  // Ödeme tipi bazında toplamları hesapla
  const calculatePaymentTypeTotals = () => {
    const paymentSummary = {};
    
    raporData.forEach(adisyon => {
      // Farklı alan isimlerini kontrol et
      const odemetipi = adisyon.odemetipi || 
                       adisyon.odemeTipi || 
                       adisyon.payment_type || 
                       adisyon.odeme_tipi || 
                       adisyon.paymentType ||
                       adisyon.OdemeTipi ||
                       adisyon.ODEMETIPI ||
                       0;
      
      console.log('Adisyon ID:', adisyon.id, 'Ödeme Tipi:', odemetipi, 'Tüm alanlar:', {
        odemetipi: adisyon.odemetipi,
        odemeTipi: adisyon.odemeTipi,
        payment_type: adisyon.payment_type,
        odeme_tipi: adisyon.odeme_tipi,
        paymentType: adisyon.paymentType,
        OdemeTipi: adisyon.OdemeTipi,
        ODEMETIPI: adisyon.ODEMETIPI
      });
      
      const tipInfo = getOdemeTipi(odemetipi);
      const amount = Number(adisyon.atop) || 0;
      
      if (!paymentSummary[tipInfo.text]) {
        paymentSummary[tipInfo.text] = {
          count: 0,
          total: 0,
          icon: tipInfo.icon,
          color: tipInfo.color
        };
      }
      
      paymentSummary[tipInfo.text].count += 1;
      paymentSummary[tipInfo.text].total += amount;
    });
    
    return paymentSummary;
  };

  // Sipariş tipini belirle
  const getSiparisTipi = (siparisnerden) => {
    switch (siparisnerden) {
      case 0:
        return { text: 'Telefon', icon: 'phone', color: 'info' };
      case 1:
        return { text: 'Yemek Sepeti', icon: 'delivery_dining', color: 'warning' };
      case 2:
        return { text: 'Getir', icon: 'motorcycle', color: 'success' };
      case 5:
        return { text: 'Trendyol', icon: 'shopping_bag', color: 'danger' };
      case 8:
        return { text: 'Migros', icon: 'store', color: 'secondary' };
      case 88:
        return { text: 'Masa', icon: 'table_restaurant', color: 'primary' };
      default:
        return { text: 'Diğer', icon: 'receipt', color: 'secondary' };
    }
  };

  const isCourier = currentUser?.role === 'kurye';
  const isCompanyManager = currentUser?.role === 'sirket_yoneticisi';
  const totals = calculateTotals();
  const paymentTypeTotals = calculatePaymentTypeTotals();

  return (
    <div className="kurye-raporu-container">
      <div className="page-header">
        <div className="header-content">
          <div className="title-section">
            <h1>
              <span className="material-icons">assessment</span>
              Kurye Raporu
            </h1>
            <p>
              {isCourier 
                ? 'Kendi teslimat raporunuzu görüntüleyebilirsiniz (masa siparişleri hariç)'
                : 'Kuryelerin teslimat raporlarını görüntüleyebilirsiniz (masa siparişleri hariç)'
              }
            </p>
          </div>
        </div>
      </div>

      <div className="content-area">
        {!isCourier && (
          <div className="filter-section">
            <h3>
              <span className="material-icons">filter_list</span>
              Filtreler
            </h3>
            
            <div className="filter-row">
              {isCompanyManager && (
                <div className="filter-group">
                  <label htmlFor="sube-select">Şube Seçin:</label>
                  <select
                    id="sube-select"
                    value={selectedSube}
                    onChange={(e) => setSelectedSube(e.target.value)}
                  >
                    <option value="">Tüm Şubeler</option>
                    {subeler.map((sube) => (
                      <option key={sube.id} value={sube.id}>
                        {sube.sube_adi}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              <div className="filter-group">
                <label htmlFor="kurye-select">Kurye Seçin:</label>
                <select
                  id="kurye-select"
                  value={selectedKurye}
                  onChange={(e) => setSelectedKurye(e.target.value)}
                >
                  <option value="">Kurye seçin...</option>
                  {kuryeler.map((kurye) => (
                    <option key={kurye.id} value={kurye.id}>
                      {kurye.displayName || kurye.email}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="filter-row">
              <div className="filter-group">
                <label htmlFor="start-date">Başlangıç Tarihi:</label>
                <input
                  type="date"
                  id="start-date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              
              <div className="filter-group">
                <label htmlFor="end-date">Bitiş Tarihi:</label>
                <input
                  type="date"
                  id="end-date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              
              <div className="filter-group">
                <button 
                  className="rapor-button"
                  onClick={fetchKuryeRaporu}
                  disabled={loading}
                >
                  <span className="material-icons">search</span>
                  {loading ? 'Yükleniyor...' : 'Rapor Getir'}
                </button>
              </div>
            </div>
          </div>
        )}

        {isCourier && (
          <div className="courier-section">
            <div className="courier-header">
              <h3>Teslimat Raporunuz</h3>
              
              {/* Hızlı Tarih Seçimi */}
              <div className="quick-date-selection">
                <div className="quick-buttons">
                  <button 
                    className={`quick-btn ${startDate === today && endDate === today ? 'active' : ''}`}
                    onClick={() => setDateRange('today')}
                  >
                    <span className="material-icons">today</span>
                    Bugün
                  </button>
                  <button 
                    className="quick-btn"
                    onClick={() => setDateRange('yesterday')}
                  >
                    <span className="material-icons">yesterday</span>
                    Dün
                  </button>
                  <button 
                    className="quick-btn"
                    onClick={() => setDateRange('thisWeek')}
                  >
                    <span className="material-icons">date_range</span>
                    Bu Hafta
                  </button>
                  <button 
                    className="quick-btn"
                    onClick={() => setDateRange('thisMonth')}
                  >
                    <span className="material-icons">calendar_month</span>
                    Bu Ay
                  </button>
                </div>
              </div>
              
              <div className="date-filters">
                <div className="filter-group">
                  <label htmlFor="start-date">Başlangıç:</label>
                  <input
                    type="date"
                    id="start-date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="filter-group">
                  <label htmlFor="end-date">Bitiş:</label>
                  <input
                    type="date"
                    id="end-date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
                <button 
                  className="rapor-button"
                  onClick={fetchKuryeRaporu}
                  disabled={loading}
                >
                  <span className="material-icons">search</span>
                  {loading ? 'Yükleniyor...' : 'Rapor Getir'}
                </button>
              </div>
            </div>
          </div>
        )}

        {raporData.length > 0 && (
          <div className="summary-section">
            <h3>
              <span className="material-icons">summarize</span>
              Özet
            </h3>
            <div className="summary-cards">
              <div className="summary-card">
                <div className="card-icon">
                  <span className="material-icons">delivery_dining</span>
                </div>
                <div className="card-content">
                  <h4>Toplam Teslimat</h4>
                  <p>{totals.totalOrders}</p>
                </div>
              </div>
              <div className="summary-card">
                <div className="card-icon">
                  <span className="material-icons">payments</span>
                </div>
                <div className="card-content">
                  <h4>Toplam Tutar</h4>
                  <p>{formatAmount(totals.totalAmount)}</p>
                </div>
              </div>
              <div className="summary-card">
                <div className="card-icon">
                  <span className="material-icons">trending_up</span>
                </div>
                <div className="card-content">
                  <h4>Ortalama Sipariş</h4>
                  <p>{formatAmount(totals.totalAmount / totals.totalOrders)}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {raporData.length > 0 && Object.keys(paymentTypeTotals).length > 0 && (
          <div className="payment-summary-section">
            <h3>
              <span className="material-icons">payment</span>
              Ödeme Tipi Detayları
            </h3>
            <div className="payment-summary-cards">
              {Object.entries(paymentTypeTotals).map(([paymentType, data]) => (
                <div key={paymentType} className="payment-summary-card">
                  <div className="payment-card-header">
                    <div className="payment-card-icon">
                      <span className="material-icons">{data.icon}</span>
                    </div>
                    <h4>{paymentType}</h4>
                  </div>
                  <div className="payment-card-content">
                    <div className="payment-stat">
                      <span className="payment-label">Sipariş Sayısı:</span>
                      <span className="payment-value">{data.count}</span>
                    </div>
                    <div className="payment-stat">
                      <span className="payment-label">Toplam Tutar:</span>
                      <span className="payment-value amount">{formatAmount(data.total)}</span>
                    </div>
                    <div className="payment-stat">
                      <span className="payment-label">Ortalama:</span>
                      <span className="payment-value">{formatAmount(data.total / data.count)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div className="loading-text">Rapor yükleniyor...</div>
        ) : raporData.length === 0 ? (
          <div className="no-data">
            {(isCourier || selectedKurye) 
              ? 'Seçilen kriterlere uygun teslimat bulunamadı.'
              : 'Lütfen kurye seçin ve rapor getir butonuna tıklayın.'
            }
          </div>
        ) : (
          <div className="rapor-table-container">
            <div className="table-header">
              <h3>
                <span className="material-icons">list</span>
                Teslimat Detayları
              </h3>
              <div className="table-info">
                {totals.totalOrders} teslimat - {formatAmount(totals.totalAmount)}
              </div>
            </div>
            
            <table className="rapor-table">
              <thead>
                <tr>
                  <th>Sipariş No</th>
                  <th>Tarih</th>
                  <th>Tip</th>
                  <th>Tutar</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {raporData.map((adisyon) => {
                  const tip = getSiparisTipi(adisyon.siparisnerden);
                  
                  return (
                    <tr key={adisyon.id}>
                      <td>
                        <div className="siparis-info">
                          <span className="material-icons">receipt</span>
                          {adisyon.padsgnum || 'Numara Yok'}
                        </div>
                      </td>
                      <td>{formatDate(adisyon.tarih)}</td>
                      <td>
                        <span className={`tip-badge ${tip.color}`}>
                          <span className="material-icons">{tip.icon}</span>
                          {tip.text}
                        </span>
                      </td>
                      <td>
                        <span className="amount-text">
                          {formatAmount(adisyon.atop)}
                        </span>
                      </td>
                      <td>
                        <span className="durum-badge success">
                          <span className="material-icons">check_circle</span>
                          Teslim Edildi
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default KuryeRaporuPage;
