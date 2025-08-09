# Test Verileri Oluşturma Scripti

Firebase Console'a giriş yapıp aşağıdaki test verilerini manuel olarak ekleyebilirsiniz:

## giderKalemleri koleksiyonu için test verisi:

```javascript
// Document ID: test-gider-kalemi-1
{
  ad: "Ofis Malzemeleri",
  aciklama: "Kırtasiye, temizlik malzemeleri ve ofis gereçleri",
  aktif: true,
  olusturanKullanici: "test-user-id",
  olusturmaTarihi: new Date(),
  guncellemeTarihi: new Date()
}
```

```javascript
// Document ID: test-gider-kalemi-2
{
  ad: "Ulaşım Giderleri",
  aciklama: "Personel ulaşım ödemeleri ve araç yakıt giderleri",
  aktif: true,
  olusturanKullanici: "test-user-id", 
  olusturmaTarihi: new Date(),
  guncellemeTarihi: new Date()
}
```

## Alternatif: Console Commands

Eğer Firebase CLI kuruluysa aşağıdaki komutları kullanabilirsiniz:

```bash
# Firebase emulator başlatma (opsiyonel)
firebase emulators:start --only firestore

# Production Firebase'a bağlanma
firebase use your-project-id
```

## Manuel Test Adımları:

1. Firebase Console'a gidin: https://console.firebase.google.com
2. Projenizi seçin
3. Firestore Database > Data sekmesine gidin
4. "Start collection" butonuna tıklayın
5. Collection ID: `giderKalemleri`
6. Document ID: `test-gider-kalemi-1` 
7. Yukarıdaki field'ları ekleyin
8. "Save" butonuna tıklayın

Bu işlemi hem `giderKalemleri` hem de istersen `giderKayitlari` için tekrarlayabilirsiniz.

## Uygulama Testi:

Test verileri eklendikten sonra:
1. http://localhost:5174/ adresinde login olun
2. Sidebar'dan "Gider İşlemleri" > "Gider Kalemi Kaydı" sayfasına gidin
3. Test verilerinin görüntülendiğini kontrol edin
4. Yeni gider kalemi eklemeyi test edin
5. "Gider Kaydı" sayfasına geçin ve gider kaydı oluşturmayı test edin
