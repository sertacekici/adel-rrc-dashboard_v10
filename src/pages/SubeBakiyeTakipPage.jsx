import React, { useState, useEffect, useContext } from 'react';
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, getDoc, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { AuthContext } from '../contexts/AuthContext';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import './SubeBakiyeTakipPage.css';

const SubeBakiyeTakipPage = () => {
  const [bakiyeHareketleri, setBakiyeHareketleri] = useState([]);
  const [subeBakiyeleri, setSubeBakiyeleri] = useState([]);
  const [subeler, setSubeler] = useState([]);
  const [selectedSubeId, setSelectedSubeId] = useState('');
  const [selectedSubeInfo, setSelectedSubeInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingSubeler, setLoadingSubeler] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedHareket, setSelectedHareket] = useState(null);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [formData, setFormData] = useState({
    sube_id: '',
    hareket_tipi: 'borc', // borc, alacak
    tutar: 0,
    aciklama: ''
  });
  const [selectedSube, setSelectedSube] = useState('all'); // Şube filtresi
  const [siparisFilter, setSiparisFilter] = useState('');
  const [startDate, setStartDate] = useState(''); // Başlangıç tarihi
  const [endDate, setEndDate] = useState(''); // Bitiş tarihi
  const [dateFilterMode, setDateFilterMode] = useState('range'); // 'single' veya 'range'
  const { currentUser } = useContext(AuthContext);

  const db = getFirestore();

  useEffect(() => {
    if (currentUser) {
      console.log('useEffect - currentUser mevcut:', currentUser);
      fetchInitialData();
      
      // URL'den sipariş ID parametresini kontrol et
      const urlParams = new URLSearchParams(window.location.search);
      const siparisId = urlParams.get('siparisId');
      if (siparisId) {
        console.log('Sipariş ID parametresi bulundu:', siparisId);
        setSiparisFilter(siparisId);
      }
      
      // Component mount edildiğinde şubeleri yükle
      fetchSubeler();
    } else {
      console.log('useEffect - currentUser henüz yok');
    }
  }, [currentUser]);

  // siparisFilter, selectedSube ve tarih filtreleri değiştiğinde bakiye hareketlerini yeniden yükle
  useEffect(() => {
    if (currentUser) {
      fetchBakiyeHareketleri();
    }
  }, [siparisFilter, selectedSube, startDate, endDate, dateFilterMode, currentUser]);

  // Scroll pozisyonu yönetimi - Modal açıldığında scroll kontrolü
  useEffect(() => {
    if (showModal || showDetailModal) {
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
  }, [showModal, showDetailModal, scrollPosition]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchBakiyeHareketleri(),
        hesaplaSubeBakiyeleri()
      ]);
      // fetchSubeler'i ayrı olarak çağırıyoruz
    } catch (error) {
      console.error('Veriler alınırken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubeler = async () => {
    try {
      setLoadingSubeler(true);
      console.log('Şubeler yükleniyor...');
      console.log('Current user:', currentUser);
      console.log('User role:', currentUser?.role);
      console.log('User subeId:', currentUser?.subeId);
      
      let subeQuery;
      
      if (currentUser?.role === 'sirket_yoneticisi') {
        // Şirket yöneticisi tüm şubeleri görebilir
        console.log('Şirket yöneticisi - tüm şubeler getiriliyor');
        subeQuery = collection(db, 'subeler');
      } else if (currentUser?.subeId) {
        // Diğer kullanıcılar sadece kendi şubelerini görebilir
        console.log('Şube kullanıcısı - sadece kendi şubesi getiriliyor:', currentUser.subeId);
        subeQuery = query(
          collection(db, 'subeler'), 
          where('__name__', '==', currentUser.subeId)
        );
      } else {
        console.log('Kullanıcı rolü bulunamadı veya şube ID yok');
        setSubeler([]);
        return [];
      }

      const querySnapshot = await getDocs(subeQuery);
      console.log('Query snapshot size:', querySnapshot.size);
      console.log('Query snapshot empty:', querySnapshot.empty);
      
      const subelerData = [];
      querySnapshot.forEach((doc) => {
        console.log('Şube doc:', doc.id, doc.data());
        const subeData = { id: doc.id, ...doc.data() };
        subelerData.push(subeData);
      });
      
      console.log('Toplam yüklenen şube sayısı:', subelerData.length);
      console.log('Şube verileri yüklendi:', subelerData);
      
      setSubeler(subelerData);
      
      // Şirket yöneticisi değilse otomatik olarak kullanıcının şubesini seç
      if (currentUser?.role !== 'sirket_yoneticisi' && subelerData.length > 0) {
        console.log('Otomatik şube seçimi yapılıyor:', subelerData[0].id);
        setSelectedSubeId(subelerData[0].id);
        setSelectedSubeInfo(subelerData[0]);
        setFormData(prev => ({ ...prev, sube_id: subelerData[0].id }));
      }
      
      return subelerData;
    } catch (error) {
      console.error('Şubeler alınırken hata:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      console.error('Full error:', error);
      setSubeler([]);
      return [];
    } finally {
      setLoadingSubeler(false);
    }
  };

  const handleSubeSelect = async (subeId) => {
    console.log('Şube seçildi:', subeId);
    setSelectedSubeId(subeId);
    setFormData(prev => ({ ...prev, sube_id: subeId }));
    
    if (subeId) {
      try {
        const subeDoc = await getDoc(doc(db, 'subeler', subeId));
        if (subeDoc.exists()) {
          const subeData = { id: subeDoc.id, ...subeDoc.data() };
          console.log('Seçilen şube bilgileri:', subeData);
          setSelectedSubeInfo(subeData);
        } else {
          console.error('Bu ID ile bir şube bulunamadı:', subeId);
          setSelectedSubeInfo(null);
        }
      } catch (error) {
        console.error('Şube bilgileri alınırken hata:', error);
        setSelectedSubeInfo(null);
      }
    } else {
      setSelectedSubeInfo(null);
    }
  };

  const fetchBakiyeHareketleri = () => {
    try {
      const isCompanyManager = currentUser?.role === 'sirket_yoneticisi';
      let q;

      // Eğer sipariş ID'sine göre filtreleme yapılıyorsa
      if (siparisFilter) {
        q = query(
          collection(db, 'sube_bakiye_hareketleri'),
          where('siparis_id', '==', siparisFilter),
          orderBy('tarih', 'desc')
        );
      } else if (isCompanyManager) {
        // Şirket yöneticisi için şube filtresi kontrolü
        if (selectedSube === 'all') {
          q = query(
            collection(db, 'sube_bakiye_hareketleri'),
            orderBy('tarih', 'desc')
          );
        } else {
          q = query(
            collection(db, 'sube_bakiye_hareketleri'),
            where('sube_id', '==', selectedSube),
            orderBy('tarih', 'desc')
          );
        }
      } else {
        // Şube müdürü sadece kendi şubesinin hareketlerini görebilir
        q = query(
          collection(db, 'sube_bakiye_hareketleri'),
          where('sube_id', '==', currentUser.subeId),
          orderBy('tarih', 'desc')
        );
      }

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const hareketlerData = [];
        querySnapshot.forEach((doc) => {
          hareketlerData.push({ id: doc.id, ...doc.data() });
        });
        setBakiyeHareketleri(hareketlerData);
        
        // Sipariş filtreleme yoksa bakiyeleri hesapla
        if (!siparisFilter) {
          hesaplaSubeBakiyeleri();
        }
      });

      return unsubscribe;
    } catch (error) {
      console.error('Bakiye hareketleri alınırken hata:', error);
    }
  };

  const hesaplaSubeBakiyeleri = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'sube_bakiye_hareketleri'));
      const bakiyeMap = new Map();

      querySnapshot.forEach((doc) => {
        const hareket = doc.data();
        const subeId = hareket.sube_id;
        
        // Şube filtresi uygulandıysa sadece o şubeyi hesapla
        if (selectedSube !== 'all' && subeId !== selectedSube) {
          return;
        }
        
        if (!bakiyeMap.has(subeId)) {
          bakiyeMap.set(subeId, {
            sube_id: subeId,
            sube_adi: hareket.sube_adi || 'Bilinmiyor',
            toplam_borc: 0,
            toplam_alacak: 0,
            kalan_bakiye: 0
          });
        }

        const bakiye = bakiyeMap.get(subeId);
        if (hareket.hareket_tipi === 'borc') {
          bakiye.toplam_borc += hareket.tutar;
        } else if (hareket.hareket_tipi === 'alacak') {
          bakiye.toplam_alacak += hareket.tutar;
        }
        
        bakiye.kalan_bakiye = bakiye.toplam_alacak - bakiye.toplam_borc;
      });

      const bakiyelerArray = Array.from(bakiyeMap.values());
      
      // Şube müdürü sadece kendi şubesini görebilir
      if (currentUser?.role === 'sube_yoneticisi' && currentUser.subeId) {
        setSubeBakiyeleri(bakiyelerArray.filter(bakiye => bakiye.sube_id === currentUser.subeId));
      } else {
        setSubeBakiyeleri(bakiyelerArray);
      }
    } catch (error) {
      console.error('Bakiyeler hesaplanırken hata:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'tutar' ? parseFloat(value) || 0 : value
    }));
    
    // Eğer şube seçimi manuel olarak değiştiyse, şube bilgilerini güncelle
    if (name === 'sube_id') {
      handleSubeSelect(value);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const selectedSube = selectedSubeInfo || subeler.find(s => s.id === formData.sube_id);
      
      const hareketData = {
        ...formData,
        sube_adi: selectedSube?.sube_adi || selectedSube?.subeAdi || 'Bilinmiyor',
        tarih: new Date(),
        olusturan: currentUser?.displayName || currentUser?.email,
        olusturan_id: currentUser?.uid
      };

      await addDoc(collection(db, 'sube_bakiye_hareketleri'), hareketData);
      
      setShowModal(false);
      setFormData({
        sube_id: '',
        hareket_tipi: 'borc',
        tutar: 0,
        aciklama: ''
      });
      setSelectedSubeId('');
      setSelectedSubeInfo(null);
      
      console.log('Bakiye hareketi eklendi');
    } catch (error) {
      console.error('Bakiye hareketi eklenirken hata:', error);
    }
  };

  // PDF Export fonksiyonu - Landscape format
  const exportToPDF = () => {
    try {
      const filteredHareketler = getFilteredHareketler();
      
      if (filteredHareketler.length === 0) {
        alert('Dışa aktarılacak bakiye hareketi bulunamadı.');
        return;
      }

      // Yeni pencere aç - Landscape için özel CSS
      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <html>
          <head>
            <title>Bakiye Hareketleri Raporu</title>
            <style>
              @page { 
                size: A4 landscape; 
                margin: 10mm; 
              }
              @media print {
                body { 
                  transform: rotate(0deg); 
                  transform-origin: center center;
                }
              }
              body { 
                font-family: Arial, sans-serif; 
                margin: 0; 
                padding: 20px; 
                line-height: 1.4; 
                font-size: 11px;
              }
              h1 { 
                color: #333; 
                border-bottom: 2px solid #667eea; 
                padding-bottom: 10px; 
                margin-bottom: 20px; 
                font-size: 18px;
                text-align: center;
              }
              .info { 
                margin: 5px 0; 
                color: #666; 
                font-weight: bold; 
                text-align: center;
              }
              table { 
                width: 100%; 
                border-collapse: collapse; 
                margin-top: 20px; 
                font-size: 10px;
              }
              th, td { 
                border: 1px solid #ddd; 
                padding: 6px; 
                text-align: left; 
              }
              th { 
                background-color: #667eea; 
                color: white; 
                font-weight: bold; 
                text-align: center;
              }
              tr:nth-child(even) { 
                background-color: #f9f9f9; 
              }
              .text-right { 
                text-align: right; 
              }
              .text-center { 
                text-align: center; 
              }
              .borc { 
                color: #dc3545; 
                font-weight: bold; 
              }
              .alacak { 
                color: #28a745; 
                font-weight: bold; 
              }
              .summary { 
                margin-top: 20px; 
                padding: 15px; 
                background-color: #f8f9fa; 
                border: 1px solid #dee2e6; 
                border-radius: 5px;
              }
              .summary-title {
                font-weight: bold;
                margin-bottom: 10px;
                text-align: center;
                font-size: 14px;
              }
              .summary-row {
                display: flex;
                justify-content: space-between;
                margin: 5px 0;
                padding: 5px 0;
                border-bottom: 1px solid #eee;
              }
            </style>
          </head>
          <body>
            <h1>Bakiye Hareketleri Raporu</h1>
            <div class="info">Rapor Tarihi: ${new Date().toLocaleDateString('tr-TR')} ${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</div>
            <div class="info">Toplam Hareket Sayısı: ${filteredHareketler.length}</div>
            ${selectedSube !== 'all' ? `<div class="info">Seçili Şube: ${selectedSubeInfo?.adi || 'Bilinmiyor'}</div>` : '<div class="info">Tüm Şubeler</div>'}
            ${getDateRangeInfo()}
            
            <table>
              <thead>
                <tr>
                  <th style="width: 15%;">Tarih</th>
                  <th style="width: 20%;">Şube</th>
                  <th style="width: 12%;">Tip</th>
                  <th style="width: 15%;">Tutar</th>
                  <th style="width: 38%;">Açıklama</th>
                </tr>
              </thead>
              <tbody>
      `);

      let toplamBorc = 0;
      let toplamAlacak = 0;

      filteredHareketler.forEach(hareket => {
        console.log('PDF - Hareket verisi:', hareket);
        console.log('PDF - Tarih field kontrolleri:', {
          olusturma_tarihi: hareket.olusturma_tarihi,
          siparis_tarihi: hareket.siparis_tarihi,
          tarih: hareket.tarih,
          createdAt: hareket.createdAt,
          timestamp: hareket.timestamp
        });
        
        const tarihField = hareket.olusturma_tarihi || hareket.siparis_tarihi || hareket.tarih || hareket.createdAt || hareket.timestamp;
        const tarih = formatDateWithTime(tarihField);
        console.log('PDF - Formatlanmış tarih:', tarih);
        
        const subeAdi = hareket.sube_adi || 'Bilinmiyor';
        const tip = hareket.hareket_tipi === 'borc' ? 'Borç' : 'Alacak';
        const tutar = hareket.tutar || 0;
        const aciklama = hareket.aciklama || '-';

        if (hareket.hareket_tipi === 'borc') {
          toplamBorc += tutar;
        } else {
          toplamAlacak += tutar;
        }

        printWindow.document.write(`
          <tr>
            <td class="text-center">${tarih}</td>
            <td>${subeAdi}</td>
            <td class="text-center ${hareket.hareket_tipi}">${tip}</td>
            <td class="text-right ${hareket.hareket_tipi}">₺${tutar.toFixed(2)}</td>
            <td>${aciklama}</td>
          </tr>
        `);
      });

      printWindow.document.write(`
              </tbody>
            </table>
            
            <div class="summary">
              <div class="summary-title">ÖZET BİLGİLER</div>
              <div class="summary-row">
                <span>Toplam Borç:</span>
                <span class="borc">₺${toplamBorc.toFixed(2)}</span>
              </div>
              <div class="summary-row">
                <span>Toplam Alacak:</span>
                <span class="alacak">₺${toplamAlacak.toFixed(2)}</span>
              </div>
              <div class="summary-row" style="border-bottom: 2px solid #333; font-weight: bold;">
                <span>Net Durum:</span>
                <span class="${(toplamAlacak - toplamBorc) >= 0 ? 'alacak' : 'borc'}">₺${(toplamAlacak - toplamBorc).toFixed(2)}</span>
              </div>
            </div>
          </body>
        </html>
      `);
      
      printWindow.document.close();
      
      // Kısa bir bekleme sonrası print dialog'u aç
      setTimeout(() => {
        printWindow.print();
      }, 500);
      
    } catch (error) {
      console.error('PDF export hatası:', error);
      alert('PDF oluşturulurken hata oluştu: ' + error.message);
    }
  };

  // Excel Export fonksiyonu
  const exportToExcel = () => {
    try {
      const filteredHareketler = getFilteredHareketler();
      
      if (filteredHareketler.length === 0) {
        alert('Dışa aktarılacak bakiye hareketi bulunamadı.');
        return;
      }

      const worksheetData = [];
      
      // Başlık satırları
      worksheetData.push(['Bakiye Hareketleri Raporu']);
      worksheetData.push(['Rapor Tarihi: ' + new Date().toLocaleDateString('tr-TR') + ' ' + new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })]);
      worksheetData.push(['Toplam Hareket Sayısı: ' + filteredHareketler.length]);
      if (selectedSube !== 'all') {
        worksheetData.push(['Seçili Şube: ' + (selectedSubeInfo?.adi || 'Bilinmiyor')]);
      } else {
        worksheetData.push(['Kapsam: Tüm Şubeler']);
      }
      
      // Tarih aralığı bilgisi
      if (startDate || endDate) {
        let dateRangeText = '';
        if (dateFilterMode === 'single' && startDate) {
          const selectedDate = new Date(startDate);
          dateRangeText = 'Seçili Tarih: ' + selectedDate.toLocaleDateString('tr-TR');
        } else if (dateFilterMode === 'range') {
          if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            dateRangeText = `Tarih Aralığı: ${start.toLocaleDateString('tr-TR')} - ${end.toLocaleDateString('tr-TR')}`;
          } else if (startDate) {
            const start = new Date(startDate);
            dateRangeText = `Tarih Aralığı: ${start.toLocaleDateString('tr-TR')} ve sonrası`;
          } else if (endDate) {
            const end = new Date(endDate);
            dateRangeText = `Tarih Aralığı: ${end.toLocaleDateString('tr-TR')} ve öncesi`;
          }
        }
        if (dateRangeText) {
          worksheetData.push([dateRangeText]);
        }
      } else {
        worksheetData.push(['Tarih Filtresi: Tüm Tarihler']);
      }
      
      worksheetData.push(['']);
      
      // Tablo başlıkları
      worksheetData.push([
        'Tarih',
        'Şube Adı',
        'Hareket Tipi',
        'Tutar (₺)',
        'Açıklama'
      ]);

      let toplamBorc = 0;
      let toplamAlacak = 0;

      // Veri satırları
      filteredHareketler.forEach(hareket => {
        console.log('Excel - Hareket verisi:', hareket);
        console.log('Excel - Tarih field kontrolleri:', {
          olusturma_tarihi: hareket.olusturma_tarihi,
          siparis_tarihi: hareket.siparis_tarihi,
          tarih: hareket.tarih,
          createdAt: hareket.createdAt,
          timestamp: hareket.timestamp
        });
        
        const tarihField = hareket.olusturma_tarihi || hareket.siparis_tarihi || hareket.tarih || hareket.createdAt || hareket.timestamp;
        const tarih = formatDateWithTime(tarihField);
        console.log('Excel - Formatlanmış tarih:', tarih);
        
        const subeAdi = hareket.sube_adi || 'Bilinmiyor';
        const tip = hareket.hareket_tipi === 'borc' ? 'Borç' : 'Alacak';
        const tutar = hareket.tutar || 0;
        const aciklama = hareket.aciklama || '-';

        if (hareket.hareket_tipi === 'borc') {
          toplamBorc += tutar;
        } else {
          toplamAlacak += tutar;
        }

        worksheetData.push([
          tarih,
          subeAdi,
          tip,
          tutar.toFixed(2),
          aciklama
        ]);
      });

      // Özet bilgileri
      worksheetData.push(['']);
      worksheetData.push(['ÖZET BİLGİLER']);
      worksheetData.push(['Toplam Borç:', toplamBorc.toFixed(2)]);
      worksheetData.push(['Toplam Alacak:', toplamAlacak.toFixed(2)]);
      worksheetData.push(['Net Durum:', (toplamAlacak - toplamBorc).toFixed(2)]);

      // Excel workbook oluştur
      const ws = XLSX.utils.aoa_to_sheet(worksheetData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Bakiye Hareketleri');
      
      // Excel dosyası oluştur ve kaydet
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(data, `bakiye-hareketleri-${new Date().toISOString().split('T')[0]}.xlsx`);
      
    } catch (error) {
      console.error('Excel export hatası:', error);
      alert('Excel oluşturulurken hata oluştu: ' + error.message);
    }
  };

  // Filtrelenmiş hareketleri getir
  const getFilteredHareketler = () => {
    let filtered = bakiyeHareketleri;
    
    // Şube filtresi
    if (selectedSube !== 'all') {
      filtered = filtered.filter(hareket => hareket.sube_id === selectedSube);
    }
    
    // Sipariş ID filtresi
    if (siparisFilter) {
      filtered = filtered.filter(hareket => 
        hareket.aciklama && hareket.aciklama.toLowerCase().includes(siparisFilter.toLowerCase())
      );
    }
    
    // Tarih filtresi
    if (startDate || endDate) {
      filtered = filtered.filter(hareket => {
        const hareketTarihi = getHareketDate(hareket);
        if (!hareketTarihi) return false;
        
        const hareketDate = new Date(hareketTarihi.getFullYear(), hareketTarihi.getMonth(), hareketTarihi.getDate());
        
        if (dateFilterMode === 'single') {
          // Tek tarih seçimi - başlangıç tarihi kullanılır
          if (startDate) {
            const selectedDate = new Date(startDate);
            const compareDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
            return hareketDate.getTime() === compareDate.getTime();
          }
        } else {
          // Tarih aralığı seçimi
          let isInRange = true;
          
          if (startDate) {
            const startDateTime = new Date(startDate);
            const startCompareDate = new Date(startDateTime.getFullYear(), startDateTime.getMonth(), startDateTime.getDate());
            isInRange = isInRange && hareketDate.getTime() >= startCompareDate.getTime();
          }
          
          if (endDate) {
            const endDateTime = new Date(endDate);
            const endCompareDate = new Date(endDateTime.getFullYear(), endDateTime.getMonth(), endDateTime.getDate());
            isInRange = isInRange && hareketDate.getTime() <= endCompareDate.getTime();
          }
          
          return isInRange;
        }
        
        return true;
      });
    }
    
    return filtered;
  };

  // Hareket tarihini güvenli bir şekilde al
  const getHareketDate = (hareket) => {
    const tarihField = hareket.olusturma_tarihi || hareket.siparis_tarihi || hareket.tarih || hareket.createdAt || hareket.timestamp;
    if (!tarihField) return null;
    
    try {
      if (tarihField.toDate) {
        return tarihField.toDate();
      } else if (tarihField.seconds) {
        return new Date(tarihField.seconds * 1000);
      } else {
        return new Date(tarihField);
      }
    } catch (error) {
      console.log('Tarih dönüştürme hatası:', error);
      return null;
    }
  };

  // Tarih aralığı bilgisini formatla
  const getDateRangeInfo = () => {
    if (!startDate && !endDate) {
      return '<div class="info">Tarih Filtresi: Tüm Tarihler</div>';
    }
    
    if (dateFilterMode === 'single' && startDate) {
      const selectedDate = new Date(startDate);
      return `<div class="info">Seçili Tarih: ${selectedDate.toLocaleDateString('tr-TR')}</div>`;
    }
    
    if (dateFilterMode === 'range') {
      let rangeText = 'Tarih Aralığı: ';
      
      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        rangeText += `${start.toLocaleDateString('tr-TR')} - ${end.toLocaleDateString('tr-TR')}`;
      } else if (startDate) {
        const start = new Date(startDate);
        rangeText += `${start.toLocaleDateString('tr-TR')} ve sonrası`;
      } else if (endDate) {
        const end = new Date(endDate);
        rangeText += `${end.toLocaleDateString('tr-TR')} ve öncesi`;
      }
      
      return `<div class="info">${rangeText}</div>`;
    }
    
    return '';
  };

  // Tarih-saat formatı
  const formatDateWithTime = (date) => {
    if (!date) {
      console.log('Tarih verisi boş:', date);
      return 'Bilinmiyor';
    }
    try {
      let dateObj;
      if (date.toDate) {
        // Firestore Timestamp
        dateObj = date.toDate();
      } else if (date.seconds) {
        // Firestore Timestamp object format
        dateObj = new Date(date.seconds * 1000);
      } else {
        // Regular Date or string
        dateObj = new Date(date);
      }
      
      console.log('Tarih objesi:', dateObj);
      
      if (isNaN(dateObj.getTime())) {
        console.log('Geçersiz tarih objesi:', date);
        return 'Geçersiz tarih';
      }
      
      const tarih = dateObj.toLocaleDateString('tr-TR');
      const saat = dateObj.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
      return `${tarih} ${saat}`;
    } catch (error) {
      console.log('Tarih formatı hatası:', error, 'Original date:', date);
      return 'Geçersiz tarih';
    }
  };

  const formatDate = (date) => {
    if (!date) return 'Bilinmiyor';
    return date.toDate ? date.toDate().toLocaleDateString('tr-TR') : new Date(date).toLocaleDateString('tr-TR');
  };

  const formatCurrency = (amount) => {
    return `₺${amount.toFixed(2)}`;
  };

  const getHareketTipiIcon = (tip) => {
    return tip === 'borc' ? 'trending_down' : 'trending_up';
  };

  const getHareketTipiClass = (tip) => {
    return tip === 'borc' ? 'borc' : 'alacak';
  };

  const handleDetayGoster = (hareket) => {
    setSelectedHareket(hareket);
    setShowDetailModal(true);
  };
  
  const handleHareketClick = (hareket) => {
    handleDetayGoster(hareket);
  };

  // Günlük borç/alacak hesaplama fonksiyonları
  const calculateDailyAmount = (type) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return bakiyeHareketleri
      .filter(hareket => {
        const hareketTarih = hareket.tarih?.toDate ? hareket.tarih.toDate() : new Date(hareket.tarih);
        const matchesType = hareket.hareket_tipi === type;
        const matchesDate = hareketTarih >= today && hareketTarih < tomorrow;
        
        // Şube filtresi kontrolü
        let matchesSube = true;
        if (isCompanyManager && selectedSube !== 'all') {
          matchesSube = hareket.sube_id === selectedSube;
        }
        
        return matchesType && matchesDate && matchesSube;
      })
      .reduce((total, hareket) => total + (hareket.tutar || 0), 0);
  };

  const calculateDailyNet = () => {
    return calculateDailyAmount('alacak') - calculateDailyAmount('borc');
  };

  // Seçili dönem borç/alacak hesaplama fonksiyonları
  const calculatePeriodAmount = (type) => {
    return bakiyeHareketleri
      .filter(hareket => {
        const hareketTarih = hareket.tarih?.toDate ? hareket.tarih.toDate() : new Date(hareket.tarih);
        const matchesType = hareket.hareket_tipi === type;
        
        // Tarih filtresi kontrolü
        let matchesDate = true;
        if (startDate && endDate) {
          const start = new Date(startDate);
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999); // Bitiş tarihinin sonuna kadar
          matchesDate = hareketTarih >= start && hareketTarih <= end;
        } else if (startDate) {
          const start = new Date(startDate);
          const end = new Date(startDate);
          end.setHours(23, 59, 59, 999);
          matchesDate = hareketTarih >= start && hareketTarih <= end;
        }
        
        // Şube filtresi kontrolü
        let matchesSube = true;
        if (isCompanyManager && selectedSube !== 'all') {
          matchesSube = hareket.sube_id === selectedSube;
        }
        
        return matchesType && matchesDate && matchesSube;
      })
      .reduce((total, hareket) => total + (hareket.tutar || 0), 0);
  };

  const calculatePeriodNet = () => {
    return calculatePeriodAmount('alacak') - calculatePeriodAmount('borc');
  };

  const isCompanyManager = currentUser?.role === 'sirket_yoneticisi';

  // Eğer kullanıcı yoksa veya yetki yoksa erken çık
  if (!currentUser) {
    return (
      <div className="sube-bakiye-takip-container">
        <div className="loading-text">Kullanıcı bilgileri yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="sube-bakiye-takip-container sube-bakiye-takip-page">
      <div className="page-header">
        <div className="header-content">
          <div className="title-section">
            <h1>
              <span className="material-icons">account_balance_wallet</span>
              Şube Bakiye Takip
            </h1>
            <p>
              {isCompanyManager 
                ? 'Şube bakiyelerini ve borç-alacak durumlarını yönetin' 
                : 'Şubenizin bakiye durumunu görüntüleyin'
              }
            </p>
          </div>
        </div>
      </div>

      <div className="content-area">
        {/* Filtreleme Bölümü */}
        {isCompanyManager && (
          <div className="filter-section">
            <div className="filter-row">
              <div className="filter-group">
                <label htmlFor="sube-filter">Şube Seçin:</label>
                <select 
                  id="sube-filter"
                  value={selectedSube} 
                  onChange={(e) => setSelectedSube(e.target.value)}
                  className="filter-select"
                >
                  <option value="all">Tüm Şubeler</option>
                  {subeler.map((sube) => (
                    <option key={sube.id} value={sube.id}>
                      {sube.sube_adi || sube.subeAdi || `Şube ${sube.id}`}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="filter-group">
                <label htmlFor="date-filter-mode">Tarih Filtresi:</label>
                <select 
                  id="date-filter-mode"
                  value={dateFilterMode} 
                  onChange={(e) => {
                    setDateFilterMode(e.target.value);
                    setStartDate('');
                    setEndDate('');
                  }}
                  className="filter-select"
                >
                  <option value="range">Tarih Aralığı</option>
                  <option value="single">Tek Tarih</option>
                </select>
              </div>
              
              {dateFilterMode === 'single' ? (
                <div className="filter-group">
                  <label htmlFor="single-date">Tarih:</label>
                  <input
                    type="date"
                    id="single-date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="filter-date"
                  />
                </div>
              ) : (
                <>
                  <div className="filter-group">
                    <label htmlFor="start-date">Başlangıç:</label>
                    <input
                      type="date"
                      id="start-date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="filter-date"
                    />
                  </div>
                  <div className="filter-group">
                    <label htmlFor="end-date">Bitiş:</label>
                    <input
                      type="date"
                      id="end-date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="filter-date"
                    />
                  </div>
                </>
              )}
              
              {(startDate || endDate) && (
                <div className="filter-group">
                  <button 
                    className="clear-date-filter-btn"
                    onClick={() => {
                      setStartDate('');
                      setEndDate('');
                    }}
                  >
                    <span className="material-icons">clear</span>
                    Temizle
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bakiye Hareketleri Tablosu */}
        <div className="hareketler-section">
          <div className="section-header-with-button">
            <h3>
              <span className="material-icons">history</span>
              Bakiye Hareketleri
            </h3>
            
            <div className="header-actions">
              {siparisFilter && (
                <div className="filter-badge">
                  <span>Sipariş ID: #{siparisFilter.slice(-8)}</span>
                  <button 
                    className="filter-clear-button"
                    onClick={() => {
                      setSiparisFilter('');
                      window.history.replaceState({}, '', '/sube-bakiye-takip');
                    }}
                  >
                    <span className="material-icons">close</span>
                  </button>
                </div>
              )}
              
              {isCompanyManager && (
                <div className="button-group">
                  <button 
                    className="export-button"
                    onClick={exportToExcel}
                  >
                    <span className="material-icons">file_download</span>
                    Excel
                  </button>
                  <button 
                    className="export-button"
                    onClick={exportToPDF}
                  >
                    <span className="material-icons">picture_as_pdf</span>
                    PDF
                  </button>
                  <button 
                    className="add-button compact"
                    onClick={() => {
                      setShowModal(true);
                      setFormData({
                        sube_id: '',
                        hareket_tipi: 'borc',
                        tutar: 0,
                        aciklama: ''
                      });
                      fetchSubeler();
                    }}
                  >
                    <span className="material-icons">add</span>
                    Yeni Hareket
                  </button>
                </div>
              )}
            </div>
          </div>

          {loading ? (
            <div className="loading-text">Veriler yükleniyor...</div>
          ) : getFilteredHareketler().length === 0 ? (
            <div className="empty-table-message">
              <span className="material-icons">search_off</span>
              <p>Seçilen kriterlere uygun hareket bulunamadı.</p>
            </div>
          ) : (
            <div className="hareketler-table-container">
              <table className="hareketler-table">
                <thead>
                  <tr>
                    <th>Tarih</th>
                    <th>Şube</th>
                    <th>Hareket Tipi</th>
                    <th>Tutar</th>
                    <th>Açıklama</th>
                    <th>Oluşturan</th>
                    <th>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {getFilteredHareketler().map((hareket) => (
                    <tr key={hareket.id} onClick={() => handleHareketClick(hareket)}>
                      <td>{formatDate(hareket.tarih)}</td>
                      <td>
                        <div className="sube-info">
                          <span className="material-icons">business</span>
                          {hareket.sube_adi}
                        </div>
                      </td>
                      <td>
                        <div className={`hareket-tipi ${getHareketTipiClass(hareket.hareket_tipi)}`}>
                          <span className="material-icons">{getHareketTipiIcon(hareket.hareket_tipi)}</span>
                          {hareket.hareket_tipi === 'borc' ? 'Borç' : 'Alacak'}
                        </div>
                      </td>
                      <td>
                        <span className={`tutar ${getHareketTipiClass(hareket.hareket_tipi)}`}>
                          {formatCurrency(hareket.tutar)}
                        </span>
                      </td>
                      <td>
                        <span className="aciklama">{hareket.aciklama}</span>
                      </td>
                      <td>{hareket.olusturan || '-'}</td>
                      <td>
                        <button
                          className="info-icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDetayGoster(hareket);
                          }}
                          title="Detay"
                        >
                          <span className="material-icons">info</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Genel Özet */}
        <div className="tarih-arasi-ozet-section">
          <h3>
            <span className="material-icons">assessment</span>
            {startDate && endDate ? `${formatDate(startDate)} - ${formatDate(endDate)} Arası Özet` : 
             startDate ? `${formatDate(startDate)} Tarihi Özeti` : 
             'Genel Özet'}
          </h3>
          <div className="ozet-widgets">
            <div className="ozet-widget borc">
              <div className="widget-icon">
                <span className="material-icons">trending_down</span>
              </div>
              <div className="widget-content">
                <h4>Toplam Borç</h4>
                <p className="widget-amount">₺{calculatePeriodAmount('borc').toFixed(2)}</p>
                <span className="widget-subtitle">Seçili dönem</span>
              </div>
            </div>
            
            <div className="ozet-widget alacak">
              <div className="widget-icon">
                <span className="material-icons">trending_up</span>
              </div>
              <div className="widget-content">
                <h4>Toplam Alacak</h4>
                <p className="widget-amount">₺{calculatePeriodAmount('alacak').toFixed(2)}</p>
                <span className="widget-subtitle">Seçili dönem</span>
              </div>
            </div>
            
            <div className="ozet-widget net">
              <div className="widget-icon">
                <span className="material-icons">account_balance</span>
              </div>
              <div className="widget-content">
                <h4>Kalan Tutar</h4>
                <p className={`widget-amount ${calculatePeriodNet() >= 0 ? 'positive' : 'negative'}`}>
                  ₺{calculatePeriodNet().toFixed(2)}
                </p>
                <span className="widget-subtitle">Net bakiye</span>
              </div>
            </div>
          </div>
        </div>

        {/* Şube Bakiye Özetleri */}
        <div className="sube-bakiye-ozeti-section">
          <h3>
            <span className="material-icons">business</span>
            Şube Bakiye Özetleri
          </h3>
          
          {loading ? (
            <div className="loading-text">Bakiyeler hesaplanıyor...</div>
          ) : subeBakiyeleri.length === 0 ? (
            <div className="no-data">Henüz bakiye hareketi bulunmamaktadır.</div>
          ) : (
            <div className="bakiye-cards">
              {subeBakiyeleri.map((bakiye) => (
                <div key={bakiye.sube_id} className="bakiye-card">
                  <div className="bakiye-header">
                    <h4>{bakiye.sube_adi}</h4>
                    <span className="sube-id">#{bakiye.sube_id.slice(-6)}</span>
                  </div>
                  
                  <div className="bakiye-detaylar">
                    <div className="bakiye-item borc">
                      <span className="material-icons">trending_down</span>
                      <div className="bakiye-item-content">
                        <p>Toplam Borç</p>
                        <h5>{formatCurrency(bakiye.toplam_borc)}</h5>
                      </div>
                    </div>
                    
                    <div className="bakiye-item alacak">
                      <span className="material-icons">trending_up</span>
                      <div className="bakiye-item-content">
                        <p>Toplam Alacak</p>
                        <h5>{formatCurrency(bakiye.toplam_alacak)}</h5>
                      </div>
                    </div>
                    
                    <div className={`bakiye-item kalan ${bakiye.kalan_bakiye >= 0 ? 'pozitif' : 'negatif'}`}>
                      <span className="material-icons">
                        {bakiye.kalan_bakiye >= 0 ? 'account_balance' : 'warning'}
                      </span>
                      <div className="bakiye-item-content">
                        <p>Kalan Bakiye</p>
                        <h5>{formatCurrency(bakiye.kalan_bakiye)}</h5>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Yeni Hareket Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => {
          setShowModal(false);
          setSelectedSubeId('');
          setSelectedSubeInfo(null);
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                <span className="material-icons">add</span>
                Yeni Bakiye Hareketi
              </h2>
              <button onClick={() => {
                setShowModal(false);
                setSelectedSubeId('');
                setSelectedSubeInfo(null);
              }} className="close-button">
                <span className="material-icons">close</span>
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label htmlFor="sube_id">Şube</label>
                {loadingSubeler ? (
                  <div className="select-loading">Şubeler yükleniyor...</div>
                ) : (
                  <div className="sube-selection-group">
                    <select
                      id="sube_id"
                      name="sube_id"
                      value={formData.sube_id}
                      onChange={(e) => handleSubeSelect(e.target.value)}
                      required
                      className="form-select sube-select"
                      disabled={currentUser?.role !== 'sirket_yoneticisi'}
                    >
                      <option value="">Şube seçin...</option>
                      {subeler.map((sube) => (
                        <option key={sube.id} value={sube.id}>
                          {sube.sube_adi || sube.subeAdi || `Şube ${sube.id}`} {sube.sehir ? `(${sube.sehir})` : ''}
                        </option>
                      ))}
                    </select>
                    
                    {selectedSubeInfo && (
                      <div className="selected-sube-info">
                        <span className="material-icons">location_on</span>
                        <span>
                          <strong>Seçili Şube:</strong> {selectedSubeInfo.sube_adi || selectedSubeInfo.subeAdi || `Şube ${selectedSubeInfo.id}`} 
                          {selectedSubeInfo.sehir ? ` (${selectedSubeInfo.sehir})` : ''}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="hareket_tipi">Hareket Tipi</label>
                <select
                  id="hareket_tipi"
                  name="hareket_tipi"
                  value={formData.hareket_tipi}
                  onChange={handleInputChange}
                  required
                >
                  <option value="borc">Borç</option>
                  <option value="alacak">Alacak</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="tutar">Tutar (₺)</label>
                <input
                  type="number"
                  id="tutar"
                  name="tutar"
                  value={formData.tutar}
                  onChange={handleInputChange}
                  min="0"
                  step="0.01"
                  required
                  placeholder="0.00"
                />
              </div>

              <div className="form-group">
                <label htmlFor="aciklama">Açıklama</label>
                <textarea
                  id="aciklama"
                  name="aciklama"
                  value={formData.aciklama}
                  onChange={handleInputChange}
                  rows="3"
                  placeholder="Hareket açıklaması..."
                  required
                />
              </div>

              <div className="form-actions">
                <button 
                  type="button" 
                  className="cancel-button"
                  onClick={() => {
                    setShowModal(false);
                    setSelectedSubeId('');
                    setSelectedSubeInfo(null);
                  }}
                >
                  İptal
                </button>
                <button type="submit" className="submit-button">
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detay Modal */}
      {showDetailModal && selectedHareket && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                <span className="material-icons">receipt</span>
                Hareket Detayı
              </h2>
              <button onClick={() => setShowDetailModal(false)} className="close-button">
                <span className="material-icons">close</span>
              </button>
            </div>
            
            <div className="modal-body">
              <div className="detay-bilgiler">
                <div className="detay-grup">
                  <h4>
                    <span className="material-icons">receipt</span>
                    Hareket Bilgileri
                  </h4>
                  <div className="detay-liste">
                    <div className="detay-item">
                      <span>Şube:</span>
                      <span>{selectedHareket.sube_adi}</span>
                    </div>
                    <div className="detay-item">
                      <span>Hareket Tipi:</span>
                      <span className={getHareketTipiClass(selectedHareket.hareket_tipi)}>
                        {selectedHareket.hareket_tipi === 'borc' ? 'Borç' : 'Alacak'}
                      </span>
                    </div>
                    <div className="detay-item">
                      <span>Tutar:</span>
                      <span className={`tutar-detay ${getHareketTipiClass(selectedHareket.hareket_tipi)}`}>
                        {formatCurrency(selectedHareket.tutar)}
                      </span>
                    </div>
                    <div className="detay-item">
                      <span>Tarih:</span>
                      <span>{formatDate(selectedHareket.tarih)}</span>
                    </div>
                    <div className="detay-item">
                      <span>Oluşturan:</span>
                      <span>{selectedHareket.olusturan}</span>
                    </div>
                    
                    {selectedHareket.siparis_id && (
                      <div className="detay-item siparis-link">
                        <span>Sipariş ID:</span>
                        <div>
                          <span className="siparis-id">#{selectedHareket.siparis_id.slice(-8)}</span>
                          <button 
                            className="siparis-detay-button"
                            onClick={() => {
                              window.location.href = `/sube-siparis-takip?siparisId=${selectedHareket.siparis_id}`;
                            }}
                          >
                            <span className="material-icons">launch</span>
                            Sipariş Detayı
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="detay-grup">
                  <h4>
                    <span className="material-icons">description</span>
                    Açıklama
                  </h4>
                  <div className="aciklama-detay">
                    {selectedHareket.aciklama}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubeBakiyeTakipPage;
