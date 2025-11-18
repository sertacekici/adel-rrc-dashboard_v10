import React, { useState, useEffect, useContext } from 'react';
import { getFirestore, collection, query, where, onSnapshot, orderBy, doc, updateDoc, addDoc, getDocs } from 'firebase/firestore';
import { AuthContext } from '../contexts/AuthContext';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import './SubeSiparisTakipPage.css';

const SubeSiparisTakipPage = () => {
  const [siparisler, setSiparisler] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSiparis, setSelectedSiparis] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [filterDurum, setFilterDurum] = useState('beklemede'); // Varsayılan olarak beklemede olanları göster
  const [selectedSube, setSelectedSube] = useState('all'); // Şube filtresi
  const [subeler, setSubeler] = useState([]); // Şube listesi
  const [scrollPosition, setScrollPosition] = useState(0);
  const { currentUser, loading: authLoading } = useContext(AuthContext);

  const db = getFirestore();

  useEffect(() => {
    console.log('useEffect tetiklendi, currentUser:', currentUser);
    console.log('filterDurum:', filterDurum);
    console.log('selectedSube:', selectedSube);
    
    fetchSubeler();
    const unsubscribe = fetchSiparisler();
    
    return () => {
      if (unsubscribe) {
        console.log('unsubscribe çalıştırılıyor');
        unsubscribe();
      }
    };
  }, [currentUser, filterDurum, selectedSube]);
  
  // Modal açıkken ESC tuşuyla kapatma ve scroll yönetimi
  useEffect(() => {
    if (showDetailModal) {
      // Mevcut scroll pozisyonunu kaydet
      setScrollPosition(window.pageYOffset);
      
      const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
          setShowDetailModal(false);
        }
      };
      
      document.addEventListener('keydown', handleKeyDown);
      
      // Sayfayı üste kaydır ve scroll'u engelle
      window.scrollTo({ top: 0, behavior: 'smooth' });
      document.body.style.overflow = 'hidden';
      
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        // Sayfa scroll'u geri aç
        document.body.style.overflow = 'auto';
        // Eski pozisyona geri dön
        if (scrollPosition > 0) {
          window.scrollTo({ top: scrollPosition, behavior: 'smooth' });
        }
      };
    } else {
      // Modal kapalıyken body overflow'u serbest bırak
      document.body.style.overflow = 'auto';
      // Eski pozisyona geri dön
      if (scrollPosition > 0) {
        window.scrollTo({ top: scrollPosition, behavior: 'smooth' });
      }
    }
  }, [showDetailModal, scrollPosition]);

  const fetchSubeler = async () => {
    try {
      const q = query(collection(db, 'subeler'));
      const querySnapshot = await getDocs(q);
      const subelerData = [];
      querySnapshot.forEach((doc) => {
        subelerData.push({ id: doc.id, ...doc.data() });
      });
      setSubeler(subelerData);
    } catch (error) {
      console.error('Şubeler alınırken hata:', error);
    }
  };

  const fetchSiparisler = () => {
    if (!currentUser) {
      console.log('fetchSiparisler: currentUser yok');
      return;
    }

    console.log('fetchSiparisler başlatılıyor...', {
      currentUser: currentUser,
      filterDurum: filterDurum,
      selectedSube: selectedSube
    });

    try {
      setLoading(true);
      let q;
      
      const isCompanyManager = currentUser.role === 'sirket_yoneticisi';
      console.log('isCompanyManager:', isCompanyManager);
      
      // Sıralama için özel fonksiyon - beklemede olanlar üstte, teslim edilenler altta
      const createQuery = (baseConditions) => {
        if (filterDurum === 'beklemede') {
          return query(
            collection(db, 'sube_siparisleri'),
            ...baseConditions,
            where('durum', '==', 'beklemede')
          );
        } else {
          return query(
            collection(db, 'sube_siparisleri'),
            ...baseConditions,
            where('durum', '==', filterDurum)
          );
        }
      };
      
      // Test için basit query
      console.log('Basit test query başlatılıyor...');
      const testQuery = query(collection(db, 'sube_siparisleri'));
      
      const unsubscribe = onSnapshot(testQuery, (querySnapshot) => {
        console.log('Test query - onSnapshot tetiklendi, doc sayısı:', querySnapshot.size);
        const allDocs = [];
        querySnapshot.forEach((doc) => {
          const data = { id: doc.id, ...doc.data() };
          console.log('Test - Belge verisi:', data);
          allDocs.push(data);
        });
        
        // Filtreleme işlemini client-side yapalım
        let filteredSiparisler = allDocs;
        
        // Durum filtresi
        if (filterDurum) {
          filteredSiparisler = filteredSiparisler.filter(siparis => siparis.durum === filterDurum);
        }
        
        // Şube filtresi
        if (isCompanyManager) {
          if (selectedSube !== 'all') {
            filteredSiparisler = filteredSiparisler.filter(siparis => siparis.sube_id === selectedSube);
          }
        } else {
          // Şube müdürü sadece kendi şubesini görsün
          filteredSiparisler = filteredSiparisler.filter(siparis => siparis.sube_id === currentUser.subeId);
        }
        
        // Sıralama
        const sortedSiparisler = filteredSiparisler.sort((a, b) => {
          if (a.durum === 'beklemede' && b.durum !== 'beklemede') return -1;
          if (a.durum !== 'beklemede' && b.durum === 'beklemede') return 1;
          
          const dateA = a.olusturma_tarihi?.toDate ? a.olusturma_tarihi.toDate() : new Date(a.olusturma_tarihi);
          const dateB = b.olusturma_tarihi?.toDate ? b.olusturma_tarihi.toDate() : new Date(b.olusturma_tarihi);
          return dateB - dateA;
        });
        
        console.log('Filtered & sorted siparişler:', sortedSiparisler);
        setSiparisler(sortedSiparisler);
        setLoading(false);
      }, (error) => {
        console.error('Test query - onSnapshot hata:', error);
        setLoading(false);
      });

      return unsubscribe;
    } catch (error) {
      console.error('Siparişler alınırken hata:', error);
      setLoading(false);
    }
  };

  const getDurumBadge = (durum) => {
    const durumMap = {
      'beklemede': { text: 'Beklemede', class: 'warning', icon: 'schedule' },
      'onaylandi': { text: 'Onaylandı', class: 'info', icon: 'check_circle' },
      'teslim_edildi': { text: 'Teslim Edildi', class: 'success', icon: 'local_shipping' },
      'iptal': { text: 'İptal', class: 'danger', icon: 'cancel' }
    };
    
    return durumMap[durum] || { text: 'Bilinmiyor', class: 'secondary', icon: 'help' };
  };

  const handleDurumGuncelle = async (siparisId, yeniDurum, siparis) => {
    try {
      await updateDoc(doc(db, 'sube_siparisleri', siparisId), {
        durum: yeniDurum,
        guncelleme_tarihi: new Date()
      });
      console.log('Sipariş durumu güncellendi');
      
      // Eğer durum "teslim_edildi" olarak değiştiyse bakiye hareketini oluştur
      if (yeniDurum === 'teslim_edildi') {
        await bakiyeHareketiOlustur(siparis);
      }
    } catch (error) {
      console.error('Durum güncellenirken hata:', error);
    }
  };
  
  // Sipariş tutarını şube bakiyesine alacak olarak ekle
  const bakiyeHareketiOlustur = async (siparis) => {
    try {
      const bakiyeData = {
        sube_id: siparis.sube_id,
        sube_adi: siparis.sube_adi,
        hareket_tipi: 'borc', // Şubeye borç olarak işle (şirketin alacağı)
        tutar: siparis.toplam_tutar,
        aciklama: `Sipariş tutarı (Sipariş No: ${siparis.id.slice(-8)})`,
        tarih: new Date(),
        olusturan: currentUser?.displayName || currentUser?.email,
        olusturan_id: currentUser?.uid,
        siparis_id: siparis.id, // Hangi siparişle ilgili olduğunu belirt
      };
      
      const docRef = await addDoc(collection(db, 'sube_bakiye_hareketleri'), bakiyeData);
      console.log('Bakiye hareketi oluşturuldu. Belge ID:', docRef.id);
      
      // Siparişe bakiye hareketi ID'sini ekle
      await updateDoc(doc(db, 'sube_siparisleri', siparis.id), {
        bakiye_hareket_id: docRef.id
      });
      
    } catch (error) {
      console.error('Bakiye hareketi oluşturulurken hata:', error);
    }
  };

  // PDF Export fonksiyonu
  const exportToPDF = () => {
    try {
      console.log('PDF export başlatılıyor...');
      const beklemedekiSiparisler = siparisler.filter(siparis => siparis.durum === 'beklemede');
      
      console.log('Beklemedeki siparişler:', beklemedekiSiparisler);
      
      if (beklemedekiSiparisler.length === 0) {
        alert('Beklemede olan sipariş bulunamadı.');
        return;
      }

      const doc = new jsPDF();
      
      // Başlık
      doc.setFontSize(16);
      doc.text('Beklemede Olan Siparişler', 14, 22);
      
      // Tarih
      doc.setFontSize(10);
      doc.text(`Rapor Tarihi: ${new Date().toLocaleDateString('tr-TR')}`, 14, 30);
      
      // Tablo verileri
      const tableData = [];
      
      beklemedekiSiparisler.forEach(siparis => {
        const subeAdi = siparis.sube_adi || 'Bilinmiyor';
        const siparisTarihi = formatDate(siparis.olusturma_tarihi);
        
        if (siparis.sepet_items && siparis.sepet_items.length > 0) {
          siparis.sepet_items.forEach(item => {
            const urunToplam = (item.urun_fiyati * item.adet).toFixed(2);
            tableData.push([
              subeAdi,
              siparisTarihi,
              item.urun_adi || 'Bilinmiyor',
              item.adet.toString(),
              `₺${item.urun_fiyati.toFixed(2)}`,
              `₺${urunToplam}`
            ]);
          });
        } else {
          tableData.push([
            subeAdi,
            siparisTarihi,
            'Ürün bilgisi yok',
            '0',
            '₺0.00',
            '₺0.00'
          ]);
        }
      });
      
      console.log('Table data hazırlandı:', tableData);
      
      // Tablo oluştur
      autoTable(doc, {
        head: [['Şube Adı', 'Sipariş Tarihi', 'Ürün Adı', 'Adet', 'Birim Fiyat', 'Toplam']],
        body: tableData,
        startY: 40,
        styles: {
          fontSize: 8,
          cellPadding: 3,
        },
        headStyles: {
          fillColor: [102, 126, 234],
          textColor: 255,
          fontStyle: 'bold'
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245]
        }
      });
      
      console.log('PDF oluşturuldu, kaydediliyor...');
      
      // PDF'i kaydet
      doc.save(`beklemede-siparisler-${new Date().toISOString().split('T')[0]}.pdf`);
      
      console.log('PDF başarıyla kaydedildi');
      
    } catch (error) {
      console.error('PDF export hatası:', error);
      alert('PDF oluşturulurken hata oluştu: ' + error.message);
    }
  };

  // Basit Print to PDF fonksiyonu (alternatif)
  const printToPDF = () => {
    const beklemedekiSiparisler = siparisler.filter(siparis => siparis.durum === 'beklemede');
    
    console.log('PDF için beklemedeki siparişler:', beklemedekiSiparisler);
    
    if (beklemedekiSiparisler.length === 0) {
      alert('Beklemede olan sipariş bulunamadı.');
      return;
    }

    // Yeni pencere aç
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Beklemede Olan Siparişler</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.4; }
            h1 { color: #333; border-bottom: 2px solid #667eea; padding-bottom: 10px; margin-bottom: 20px; }
            .info { margin: 10px 0; color: #666; font-weight: bold; }
            .sube-group { margin-bottom: 30px; page-break-inside: avoid; }
            .sube-header { background-color: #667eea; color: white; padding: 10px; font-weight: bold; font-size: 16px; }
            .siparis-group { margin-bottom: 20px; border: 1px solid #ddd; }
            .siparis-header { background-color: #f0f0f0; padding: 8px; font-weight: bold; border-bottom: 1px solid #ddd; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f8f9fa; font-weight: bold; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .toplam-row { background-color: #e9ecef; font-weight: bold; }
            .text-right { text-align: right; }
            .page-break { page-break-before: always; }
          </style>
        </head>
        <body>
          <h1>Beklemede Olan Siparişler</h1>
          <div class="info">Rapor Tarihi: ${new Date().toLocaleDateString('tr-TR')}</div>
          <div class="info">Toplam Sipariş Sayısı: ${beklemedekiSiparisler.length}</div>
    `);

    // Şube bazında gruplama
    const subeGroups = {};
    beklemedekiSiparisler.forEach(siparis => {
      console.log('Sipariş objesinin tüm field\'ları:', Object.keys(siparis));
      console.log('Sipariş tam verisi:', siparis);
      
      const subeAdi = siparis.sube_adi || siparis.sube_adi || 'Bilinmiyor';
      if (!subeGroups[subeAdi]) {
        subeGroups[subeAdi] = [];
      }
      subeGroups[subeAdi].push(siparis);
    });

    // Her şube için ayrı bölüm oluştur
    Object.keys(subeGroups).forEach((subeAdi, subeIndex) => {
      if (subeIndex > 0) {
        printWindow.document.write('<div class="page-break"></div>');
      }
      
      printWindow.document.write(`
        <div class="sube-group">
          <div class="sube-header">${subeAdi}</div>
      `);

      const subeSiparisler = subeGroups[subeAdi];
      let subeGenelToplam = 0;

      subeSiparisler.forEach(siparis => {
        console.log('Sipariş verisi:', siparis);
        console.log('Tarih field kontrolleri:', {
          olusturma_tarihi: siparis.olusturma_tarihi,
          siparis_tarihi: siparis.siparis_tarihi,
          tarih: siparis.tarih,
          createdAt: siparis.createdAt,
          timestamp: siparis.timestamp
        });
        
        const tarihField = siparis.olusturma_tarihi || siparis.siparis_tarihi || siparis.tarih || siparis.createdAt || siparis.timestamp;
        const siparisTarihi = formatDate(tarihField);
        const siparisNo = siparis.id ? siparis.id.slice(-8) : 'N/A';
        
        console.log('Formatlanmış tarih:', siparisTarihi);
        
        // Farklı field isimlerini kontrol et
        let sepetItems = siparis.sepet_items || siparis.sepetItems || siparis.items || siparis.cart_items || siparis.urunler || [];
        
        printWindow.document.write(`
          <div class="siparis-group">
            <div class="siparis-header">
              Sipariş No: #${siparisNo} | Tarih: ${siparisTarihi}
            </div>
            <table>
              <thead>
                <tr>
                  <th>Ürün Adı</th>
                  <th style="width: 80px;">Adet</th>
                  <th style="width: 100px;">Birim Fiyat</th>
                  <th style="width: 100px;">Toplam</th>
                </tr>
              </thead>
              <tbody>
        `);

        let siparisToplam = 0;

        if (sepetItems && sepetItems.length > 0) {
          sepetItems.forEach(item => {
            console.log('Item verisi:', item);
            console.log('Field kontrolleri:', {
              urun_adi: item.urun_adi,
              urunAdi: item.urunAdi,
              name: item.name,
              productName: item.productName,
              adet: item.adet,
              quantity: item.quantity,
              miktar: item.miktar,
              urun_fiyati: item.urun_fiyati,
              fiyat: item.fiyat,
              price: item.price,
              unitPrice: item.unitPrice
            });
            
            const urunAdi = item.urun_adi || item.urunAdi || item.name || item.productName || item.adi || 'Bilinmiyor';
            const adet = parseFloat(item.adet || item.quantity || item.miktar || item.count || 0);
            const fiyat = parseFloat(item.urun_fiyati || item.fiyat || item.price || item.unitPrice || item.birim_fiyat || 0);
            const urunToplam = (fiyat * adet);
            
            console.log('Hesaplanan değerler:', {
              urunAdi,
              adet,
              fiyat,
              urunToplam
            });
            
            siparisToplam += urunToplam;
            
            printWindow.document.write(`
              <tr>
                <td>${urunAdi}</td>
                <td class="text-right">${adet}</td>
                <td class="text-right">₺${fiyat.toFixed(2)}</td>
                <td class="text-right">₺${urunToplam.toFixed(2)}</td>
              </tr>
            `);
          });
        } else {
          console.log('Sepet items boş veya undefined');
          printWindow.document.write(`
            <tr>
              <td colspan="4" style="text-align: center; color: #666;">Ürün bilgisi bulunamadı</td>
            </tr>
          `);
        }

        subeGenelToplam += siparisToplam;
        
        console.log('Sipariş toplamı hesaplandı:', siparisToplam);
        console.log('Şube genel toplam güncel:', subeGenelToplam);

        printWindow.document.write(`
              <tr class="toplam-row">
                <td colspan="3" class="text-right"><strong>Sipariş Toplamı:</strong></td>
                <td class="text-right"><strong>₺${siparisToplam.toFixed(2)}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
        `);
      });

      // Şube genel toplamı
      printWindow.document.write(`
        <div style="margin-top: 15px; padding: 10px; background-color: #d4edda; border: 1px solid #c3e6cb; border-radius: 5px;">
          <div style="text-align: right; font-size: 18px; font-weight: bold; color: #155724;">
            ${subeAdi} Genel Toplamı: ₺${subeGenelToplam.toFixed(2)}
          </div>
        </div>
      </div>
      `);
    });

    // Genel toplam hesapla - İki yöntemle hesaplayalım
    console.log('Genel toplam hesaplanıyor...');
    console.log('Tüm şube grupları:', Object.keys(subeGroups));
    
    // Yöntem 1: Şube toplamlarından hesapla
    let genelToplam1 = 0;
    Object.keys(subeGroups).forEach(subeAdi => {
      const subeSiparisler = subeGroups[subeAdi];
      let subeToplamTest = 0;
      
      subeSiparisler.forEach(siparis => {
        const sepetItems = siparis.sepet_items || siparis.sepetItems || siparis.items || siparis.cart_items || siparis.urunler || [];
        let siparisToplam = 0;
        
        if (sepetItems && sepetItems.length > 0) {
          sepetItems.forEach(item => {
            const adet = parseFloat(item.adet || item.quantity || item.miktar || item.count || 0);
            const fiyat = parseFloat(item.urun_fiyati || item.fiyat || item.price || item.unitPrice || item.birim_fiyat || 0);
            const itemToplam = fiyat * adet;
            siparisToplam += itemToplam;
            console.log(`Ürün: ${item.urun_adi || 'Bilinmiyor'}, Adet: ${adet}, Fiyat: ${fiyat}, Item Toplam: ${itemToplam}`);
          });
        }
        
        subeToplamTest += siparisToplam;
        console.log(`Sipariş toplamı: ${siparisToplam}`);
      });
      
      console.log(`${subeAdi} şube toplamı: ${subeToplamTest}`);
      genelToplam1 += subeToplamTest;
    });
    
    console.log('Hesaplanan genel toplam:', genelToplam1);

    printWindow.document.write(`
      <div style="margin-top: 30px; padding: 15px; background-color: #fff3cd; border: 2px solid #ffeaa7; border-radius: 8px;">
        <div style="text-align: center; font-size: 20px; font-weight: bold; color: #856404;">
          GENEL TOPLAM: ₺${genelToplam1.toFixed(2)}
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
  };

  // Excel Export fonksiyonu
  const exportToExcel = () => {
    try {
      console.log('Excel export başlatılıyor...');
      const beklemedekiSiparisler = siparisler.filter(siparis => siparis.durum === 'beklemede');
      
      if (beklemedekiSiparisler.length === 0) {
        alert('Beklemede olan sipariş bulunamadı.');
        return;
      }

      // Şube bazında gruplama
      const subeGroups = {};
      beklemedekiSiparisler.forEach(siparis => {
        const subeAdi = siparis.sube_adi || siparis.sube_adi || 'Bilinmiyor';
        if (!subeGroups[subeAdi]) {
          subeGroups[subeAdi] = [];
        }
        subeGroups[subeAdi].push(siparis);
      });

      const worksheetData = [];
      
      // Başlık satırları
      worksheetData.push(['Beklemede Olan Siparişler - Şube Bazlı Rapor']);
      worksheetData.push(['Rapor Tarihi: ' + new Date().toLocaleDateString('tr-TR')]);
      worksheetData.push(['Toplam Sipariş Sayısı: ' + beklemedekiSiparisler.length]);
      worksheetData.push(['']);

      let genelToplam = 0;

      // Her şube için ayrı bölüm
      Object.keys(subeGroups).forEach(subeAdi => {
        // Şube başlığı
        worksheetData.push([`${subeAdi.toUpperCase()} ŞUBESİ`]);
        worksheetData.push(['']);
        
        const subeSiparisler = subeGroups[subeAdi];
        let subeToplamTutar = 0;

        subeSiparisler.forEach(siparis => {
          const tarihField = siparis.olusturma_tarihi || siparis.siparis_tarihi || siparis.tarih || siparis.createdAt || siparis.timestamp;
          const siparisTarihi = formatDate(tarihField);
          const siparisNo = siparis.id ? siparis.id.slice(-8) : 'N/A';
          
          // Sipariş başlığı
          worksheetData.push([`Sipariş No: #${siparisNo}`, `Tarih: ${siparisTarihi}`, '', '']);
          
          // Ürün tablosu başlığı
          worksheetData.push(['Ürün Adı', 'Adet', 'Birim Fiyat (₺)', 'Toplam (₺)']);
          
          const sepetItems = siparis.sepet_items || siparis.sepetItems || siparis.items || siparis.cart_items || siparis.urunler || [];
          let siparisToplam = 0;

          if (sepetItems && sepetItems.length > 0) {
            sepetItems.forEach(item => {
              const urunAdi = item.urun_adi || item.urunAdi || item.name || item.productName || item.adi || 'Bilinmiyor';
              const adet = parseFloat(item.adet || item.quantity || item.miktar || item.count || 0);
              const fiyat = parseFloat(item.urun_fiyati || item.fiyat || item.price || item.unitPrice || item.birim_fiyat || 0);
              const urunToplam = fiyat * adet;
              siparisToplam += urunToplam;
              
              worksheetData.push([
                urunAdi,
                adet,
                fiyat.toFixed(2),
                urunToplam.toFixed(2)
              ]);
            });
          } else {
            worksheetData.push(['Ürün bilgisi bulunamadı', '0', '0.00', '0.00']);
          }

          // Sipariş toplamı
          worksheetData.push(['', '', 'Sipariş Toplamı:', siparisToplam.toFixed(2)]);
          worksheetData.push(['']);

          subeToplamTutar += siparisToplam;
        });

        // Şube toplamı
        worksheetData.push(['', '', `${subeAdi} Şube Toplamı:`, subeToplamTutar.toFixed(2)]);
        worksheetData.push(['']);
        worksheetData.push(['==========================================']);
        worksheetData.push(['']);

        genelToplam += subeToplamTutar;
      });

      // Genel toplam hesapla
      let excelGenelToplam = 0;
      Object.keys(subeGroups).forEach(subeAdi => {
        const subeSiparisler = subeGroups[subeAdi];
        let subeToplamTutar = 0;

        subeSiparisler.forEach(siparis => {
          const sepetItems = siparis.sepet_items || siparis.sepetItems || siparis.items || siparis.cart_items || siparis.urunler || [];
          let siparisToplam = 0;

          if (sepetItems && sepetItems.length > 0) {
            sepetItems.forEach(item => {
              const adet = parseFloat(item.adet || item.quantity || item.miktar || item.count || 0);
              const fiyat = parseFloat(item.urun_fiyati || item.fiyat || item.price || item.unitPrice || item.birim_fiyat || 0);
              const urunToplam = fiyat * adet;
              siparisToplam += urunToplam;
            });
          }
          subeToplamTutar += siparisToplam;
        });

        excelGenelToplam += subeToplamTutar;
      });

      worksheetData.push(['', '', 'GENEL TOPLAM:', excelGenelToplam.toFixed(2)]);

      console.log('Worksheet data hazırlandı:', worksheetData);

      // Excel workbook oluştur
      const ws = XLSX.utils.aoa_to_sheet(worksheetData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Beklemede Siparişler');
      
      // Excel dosyası oluştur ve kaydet
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(data, `beklemede-siparisler-${new Date().toISOString().split('T')[0]}.xlsx`);
      
      console.log('Excel başarıyla kaydedildi');
      
    } catch (error) {
      console.error('Excel export hatası:', error);
      alert('Excel oluşturulurken hata oluştu: ' + error.message);
    }
  };

  const handleSiparisDetay = (siparis) => {
    setSelectedSiparis(siparis);
    setShowDetailModal(true);
    // Modal açıldığında sayfayı en üste scroll et
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const formatDate = (date) => {
    if (!date) return 'Bilinmiyor';
    try {
      const dateObj = date.toDate ? date.toDate() : new Date(date);
      const tarih = dateObj.toLocaleDateString('tr-TR');
      const saat = dateObj.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
      return `${tarih} ${saat}`;
    } catch (error) {
      console.log('Tarih formatı hatası:', error);
      return 'Geçersiz tarih';
    }
  };

  const isCompanyManager = currentUser?.role === 'sirket_yoneticisi';

  // Auth loading durumunu kontrol et
  if (authLoading) {
    return (
      <div className="sube-siparis-takip-container">
        <div className="loading-text">Kullanıcı bilgileri yükleniyor...</div>
      </div>
    );
  }

  // Kullanıcı giriş yapmamışsa
  if (!currentUser) {
    return (
      <div className="sube-siparis-takip-container">
        <div className="loading-text">Lütfen giriş yapınız...</div>
      </div>
    );
  }

  return (
    <div className="sube-siparis-takip-container sube-siparis-takip-page">
      <div className="page-header">
        <div className="header-content">
          <div className="title-section">
            <h1>
              <span className="material-icons">local_shipping</span>
              Şube Sipariş Takip
            </h1>
            <p>
              {isCompanyManager 
                ? 'Tüm şube siparişlerini görüntüleyin ve yönetin' 
                : 'Şubenizin siparişlerini takip edin'
              }
            </p>
          </div>
          
          <div className="export-actions">
            <button 
              className="export-button pdf"
              onClick={printToPDF}
              title="Beklemedeki siparişleri PDF olarak dışa aktar"
            >
              <span className="material-icons">picture_as_pdf</span>
              PDF İndir
            </button>
            <button 
              className="export-button excel"
              onClick={exportToExcel}
              title="Beklemedeki siparişleri Excel olarak dışa aktar"
            >
              <span className="material-icons">table_chart</span>
              Excel İndir
            </button>
          </div>
        </div>
      </div>
      
      <div className="filter-section">
        <div className="filter-group">
          <div className="durum-buttons" role="tablist" aria-label="Durum Filtresi">
            <button
              type="button"
              className={`durum-button warning ${filterDurum === 'beklemede' ? 'active' : ''}`}
              onClick={() => setFilterDurum('beklemede')}
            >
              Beklemede
            </button>
            <button
              type="button"
              className={`durum-button info ${filterDurum === 'onaylandi' ? 'active' : ''}`}
              onClick={() => setFilterDurum('onaylandi')}
            >
              Onaylandı
            </button>
            <button
              type="button"
              className={`durum-button success ${filterDurum === 'teslim_edildi' ? 'active' : ''}`}
              onClick={() => setFilterDurum('teslim_edildi')}
            >
              Teslim Edildi
            </button>
            <button
              type="button"
              className={`durum-button danger ${filterDurum === 'iptal' ? 'active' : ''}`}
              onClick={() => setFilterDurum('iptal')}
            >
              İptal
            </button>
          </div>
        </div>
        
        {isCompanyManager && (
          <div className="filter-group">
            <label htmlFor="sube-filter">Şube:</label>
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
        )}
        
        {/* filter-info kaldırıldı */}
      </div>

      <div className="content-area">
        {loading ? (
          <div className="loading-text">Siparişler yükleniyor...</div>
        ) : siparisler.length === 0 ? (
          <div className="no-data">
            <span className="material-icons">local_shipping</span>
            <p>
              {filterDurum === 'beklemede' ? 'Beklemede sipariş bulunmamaktadır.' :
               filterDurum === 'onaylandi' ? 'Onaylanmış sipariş bulunmamaktadır.' :
               filterDurum === 'teslim_edildi' ? 'Teslim edilmiş sipariş bulunmamaktadır.' :
               'İptal edilmiş sipariş bulunmamaktadır.'}
            </p>
          </div>
        ) : (
          <>
            <div className="siparis-count-info">
              <span className="material-icons">receipt_long</span>
              <span>
                <strong>{siparisler.length}</strong> sipariş gösteriliyor
                {selectedSube !== 'all' && subeler.find(s => s.id === selectedSube) && 
                  ` - ${subeler.find(s => s.id === selectedSube).sube_adi}`
                }
              </span>
            </div>
            
            <div className="siparisler-grid">
            {siparisler.map((siparis) => {
              const durumInfo = getDurumBadge(siparis.durum);
              return (
                <div key={siparis.id} className="siparis-card" data-durum={siparis.durum}>
                  <div className="card-header">
                    <div className="siparis-info">
                      <h3>{siparis.sube_adi}</h3>
                    
                    </div>
                    <div className={`durum-badge ${durumInfo.class}`}>
                      <span className="material-icons">{durumInfo.icon}</span>
                      {durumInfo.text}
                    </div>
                  </div>
                  
                  <div className="card-content">
                    <div className="siparis-detay">
                      <div className="detay-item">
                        <span className="material-icons">person</span>
                        <span>{siparis.siparis_veren}</span>
                      </div>
                      <div className="detay-item">
                        <span className="material-icons">calendar_today</span>
                        <span>{formatDate(siparis.siparis_tarihi)}</span>
                      </div>
                      <div className="detay-item">
                        <span className="material-icons">inventory_2</span>
                        <span>{siparis.urunler?.length || 0} ürün</span>
                      </div>
                      <div className="detay-item toplam">
                        <span className="material-icons">payments</span>
                        <span>₺{siparis.toplam_tutar?.toFixed(2) || '0.00'}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="card-actions">
                    <button 
                      className="detail-button"
                      onClick={() => handleSiparisDetay(siparis)}
                    >
                      <span className="material-icons">visibility</span>
                      Detay
                    </button>
                    
                    {isCompanyManager && (
                      <div className="durum-actions">
                        {siparis.durum === 'beklemede' && (
                          <>
                            <button 
                              className="action-button approve"
                              onClick={() => handleDurumGuncelle(siparis.id, 'onaylandi', siparis)}
                              title="Onayla"
                            >
                              <span className="material-icons">check_circle</span>
                            </button>
                            <button 
                              className="action-button cancel"
                              onClick={() => handleDurumGuncelle(siparis.id, 'iptal', siparis)}
                              title="İptal Et"
                            >
                              <span className="material-icons">cancel</span>
                            </button>
                          </>
                        )}
                        {siparis.durum === 'onaylandi' && (
                          <button 
                            className="action-button deliver"
                            onClick={() => handleDurumGuncelle(siparis.id, 'teslim_edildi', siparis)}
                            title="Teslim Et"
                          >
                            <span className="material-icons">local_shipping</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            </div>
          </>
        )}
      </div>

      {/* Sipariş Detay Modal */}
      {showDetailModal && selectedSiparis && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="modal-content detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                <span className="material-icons">receipt_long</span>
                Sipariş Detayı - #{selectedSiparis.id.slice(-8)}
              </h2>
              <button onClick={() => setShowDetailModal(false)} className="close-button">
                <span className="material-icons">close</span>
              </button>
            </div>
            
            <div className="modal-body">
              <div className="siparis-bilgi">
                <div className="bilgi-grup">
                  <h4>Sipariş Bilgileri</h4>
                  <div className="bilgi-liste">
                    <div className="bilgi-item">
                      <span>Şube:</span>
                      <span>{selectedSiparis.sube_adi}</span>
                    </div>
                    <div className="bilgi-item">
                      <span>Sipariş Veren:</span>
                      <span>{selectedSiparis.siparis_veren}</span>
                    </div>
                    <div className="bilgi-item">
                      <span>Tarih:</span>
                      <span>{formatDate(selectedSiparis.siparis_tarihi)}</span>
                    </div>
                    <div className="bilgi-item">
                      <span>Durum:</span>
                      <span className={`durum-text ${getDurumBadge(selectedSiparis.durum).class}`}>
                        {getDurumBadge(selectedSiparis.durum).text}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="urunler-grup">
                  <h4>Sipariş Edilen Ürünler</h4>
                  <div className="urunler-liste">
                    {selectedSiparis.urunler?.map((urun, index) => (
                      <div key={index} className="urun-satir">
                        <div className="urun-bilgi">
                          <span className="material-icons">inventory_2</span>
                          <div>
                            <h5>{urun.urun_adi}</h5>
                            <p>{urun.birim_olcusu} - ₺{urun.birim_fiyat?.toFixed(2)}</p>
                          </div>
                        </div>
                        <div className="urun-miktar">
                          <span>×{urun.miktar}</span>
                        </div>
                        <div className="urun-toplam">
                          ₺{urun.toplam_fiyat?.toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="toplam-alan">
                    <div className="toplam-satir">
                      <span>Toplam Tutar:</span>
                      <span className="toplam-rakam">₺{selectedSiparis.toplam_tutar?.toFixed(2)}</span>
                    </div>
                    
                    {/* Teslim edilmiş sipariş için bakiye hareketi butonu */}
                    {selectedSiparis.durum === 'teslim_edildi' && selectedSiparis.bakiye_hareket_id && (
                      <div className="bakiye-bilgi">
                        <p>Bu sipariş için şube bakiye hareketi oluşturulmuştur.</p>
                        <button 
                          className="bakiye-button"
                          onClick={() => window.location.href = `/sube-bakiye-takip?siparisId=${selectedSiparis.id}`} 
                        >
                          <span className="material-icons">account_balance_wallet</span>
                          Bakiye Hareketlerini Görüntüle
                        </button>
                      </div>
                    )}
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

export default SubeSiparisTakipPage;
