# Firebase Gider İşlemleri ve Genel Rapor Koleksiyonları

## Yeni Koleksiyonlar

### 1. giderKalemleri (Expense Categories)
```javascript
{
  id: "auto-generated-id",
  ad: "string",           // Gider Kalemi Adı
  aciklama: "string",     // Gider Kalemi Açıklaması
  aktif: true,            // Aktif/Pasif durumu
  olusturanKullanici: "string", // Kullanıcı ID
  olusturmaTarihi: timestamp,   // Oluşturma tarihi
  guncellemeTarihi: timestamp   // Son güncelleme tarihi
}
```

### 2. giderKayitlari (Expense Records)
```javascript
{
  id: "auto-generated-id",
  giderKalemiId: "string",      // giderKalemleri koleksiyonundan referans
  giderKalemiAdi: "string",     // Denormalize edilmiş gider kalemi adı
  aciklama: "string",           // Gider açıklaması
  tutar: number,                // Gider tutarı
  odemeKaynagi: "string",       // "gunluk_kasa" veya "merkez_kasa"
  tarih: timestamp,             // Gider tarihi
  saat: "string",               // Gider saati (HH:MM formatında)
  olusturanKullanici: "string", // Kullanıcı ID
  kullaniciAdi: "string",       // Denormalize edilmiş kullanıcı adı
  subeId: "string",             // Şube ID (eğer şube müdürü ise)
  subeAdi: "string",            // Denormalize edilmiş şube adı
  olusturmaTarihi: timestamp,   // Kayıt oluşturma tarihi
  guncellemeTarihi: timestamp   // Son güncelleme tarihi
}
```

## Firestore Security Rules Güncellemeleri

### firestore.rules dosyasına eklenecek kurallar:

```javascript
// Gider Kalemleri - Sadece şirket yöneticisi ve şube müdürü erişebilir
match /giderKalemleri/{docId} {
  allow read, write: if request.auth != null && 
    (getUserRole() == "sirket_yoneticisi" || getUserRole() == "sube_yoneticisi");
}

// Gider Kayıtları - Sadece şirket yöneticisi ve şube müdürü erişebilir
match /giderKayitlari/{docId} {
  allow read, write: if request.auth != null && 
    (getUserRole() == "sirket_yoneticisi" || getUserRole() == "sube_yoneticisi");
}
```

## Index Gereksinimleri

Firestore Console'da aşağıdaki composite index'leri oluşturun:

### giderKayitlari koleksiyonu için:
1. **Tarih bazlı sorgular için:**
   - Collection: `giderKayitlari`
   - Fields: `tarih` (Descending), `olusturmaTarihi` (Descending)

2. **Şube bazlı sorgular için:**
   - Collection: `giderKayitlari`
   - Fields: `subeId` (Ascending), `tarih` (Descending)

3. **Ödeme kaynağı bazlı sorgular için:**
   - Collection: `giderKayitlari`
   - Fields: `odemeKaynagi` (Ascending), `tarih` (Descending)

4. **Gider kalemi bazlı sorgular için:**
   - Collection: `giderKayitlari`
   - Fields: `giderKalemiId` (Ascending), `tarih` (Descending)

### giderKalemleri koleksiyonu için:
1. **Aktif durum sorgular için:**
   - Collection: `giderKalemleri`
   - Fields: `aktif` (Ascending), `olusturmaTarihi` (Descending)

## Veri Yapısı Notları

1. **Denormalizasyon:** Sık erişilen veriler (giderKalemiAdi, kullaniciAdi, subeAdi) denormalize edilmiştir
2. **Referans İlişkiler:** giderKayitlari koleksiyonu giderKalemleri koleksiyonuna referans verir
3. **Zaman Yönetimi:** Hem timestamp (tarih) hem de string (saat) formatları kullanılır
4. **Yetkilendirme:** Sadece şirket yöneticisi ve şube müdürü bu verilere erişebilir
5. **Audit Trail:** Oluşturan kullanıcı ve tarih bilgileri saklanır

## Örnek Veri

### Gider Kalemi Örneği:
```javascript
{
  id: "gk_001",
  ad: "Ofis Malzemeleri",
  aciklama: "Kırtasiye, temizlik malzemeleri ve ofis gereçleri",
  aktif: true,
  olusturanKullanici: "user_123",
  olusturmaTarihi: "2025-08-06T10:00:00Z",
  guncellemeTarihi: "2025-08-06T10:00:00Z"
}
```

### Gider Kaydı Örneği:
```javascript
{
  id: "gr_001",
  giderKalemiId: "gk_001",
  giderKalemiAdi: "Ofis Malzemeleri",
  aciklama: "A4 kağıt ve toner alımı",
  tutar: 450.00,
  odemeKaynagi: "gunluk_kasa",
  tarih: "2025-08-06T00:00:00Z",
  saat: "14:30",
  olusturanKullanici: "user_123",
  kullaniciAdi: "Ahmet Yılmaz",
  subeId: "sube_001",
  subeAdi: "Merkez Şube",
  olusturmaTarihi: "2025-08-06T14:30:00Z",
  guncellemeTarihi: "2025-08-06T14:30:00Z"
}
```
