# 🏢 Adel RRC - Restoran Uzaktan Takip Sistemi

Modern ve kullanıcı dostu restoran yönetim sistemi. React, Firebase ve Vite teknolojileri ile geliştirilmiştir.

## ✨ Özellikler

### 👤 Kullanıcı Rolleri
- **Şirket Yöneticisi**: Tüm sistem yönetimi
- **Şube Yöneticisi**: Şube operasyon yönetimi
- **Kurye**: Teslimat işlemleri
- **Personel**: Sınırlı erişim

### 🎯 Ana Fonksiyonlar
- 📊 **Dashboard**: Rol bazlı hızlı erişim kısayolları
- 👥 **Kullanıcı Yönetimi**: Personel ve rol yönetimi
- 🏢 **Şube Yönetimi**: Çoklu şube desteği
- 📋 **Sipariş Takibi**: Gerçek zamanlı sipariş yönetimi
- 🚚 **Kurye Atama**: Otomatik/manuel teslimat ataması
- 📈 **Raporlama**: Detaylı satış ve kurye raporları
- 💰 **Ödeme Takibi**: Çoklu ödeme yöntemi desteği

### 🎨 UI/UX Özellikleri
- 📱 **Responsive Tasarım**: Mobil uyumlu arayüz
- 🌈 **Modern UI**: Glassmorphism ve gradient efektler
- 🔔 **Bildirimler**: Gerçek zamanlı sistem bildirimleri
- 🗺️ **Harita Entegrasyonu**: Google Maps rotası
- 🎨 **Material Design**: Google Material Icons

## 🚀 Teknolojiler

- **Frontend**: React 18, React Router v6
- **Backend**: Firebase (Firestore, Authentication)
- **Build Tool**: Vite
- **Styling**: Modern CSS (Flexbox, Grid, CSS Variables)
- **Icons**: Material Design Icons

## ⚙️ Kurulum

### Ön Gereksinimler
- Node.js (v16 veya üzeri)
- npm veya yarn
- Firebase hesabı

### 1. Projeyi Klonlayın
```bash
git clone https://github.com/kullaniciadi/adel-rrc-dashboard.git
cd adel-rrc-dashboard
```

### 2. Bağımlılıkları Yükleyin
```bash
npm install
```

### 3. Environment Variables
`.env` dosyası oluşturun:
```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

### 4. Geliştirme Sunucusunu Başlatın
```bash
npm run dev
```

### 5. Production Build
```bash
npm run build
```

## 📁 Proje Yapısı

```
src/
├── components/          # Yeniden kullanılabilir bileşenler
│   ├── Layout.jsx      # Ana layout wrapper
│   ├── Sidebar.jsx     # Navigasyon sidebar'ı
│   ├── TopBar.jsx      # Üst navigasyon bar'ı
│   ├── Login.jsx       # Giriş sayfası
│   └── AdisyonDetailModal.jsx  # Sipariş detay modalı
├── contexts/           # React Context'leri
│   └── AuthContext.jsx # Authentication context
├── pages/             # Sayfa bileşenleri
│   ├── DashboardPage.jsx      # Ana dashboard
│   ├── UsersPage.jsx          # Kullanıcı yönetimi
│   ├── SubelerPage.jsx        # Şube yönetimi
│   ├── AdisyonlarPage.jsx     # Sipariş takibi
│   ├── KuryeAtamaPage.jsx     # Kurye atama
│   └── KuryeRaporuPage.jsx    # Kurye raporları
├── firebase.js        # Firebase konfigürasyonu
└── main.jsx          # Uygulama giriş noktası
```

## 🔒 Güvenlik

- Firebase Authentication ile güvenli giriş
- Rol tabanlı erişim kontrolü
- Environment variables ile hassas bilgi koruması
- HTTPS zorunluluğu production'da

## 📱 Responsive Tasarım

- **Desktop**: 1200px+
- **Tablet**: 768px - 1199px
- **Mobile**: < 768px

Tüm sayfalar mobil cihazlarda optimize edilmiş görünüm sunar.

## 🤝 Katkıda Bulunma

1. Fork edin
2. Feature branch oluşturun (`git checkout -b feature/yeni-ozellik`)
3. Değişikliklerinizi commit edin (`git commit -am 'Yeni özellik eklendi'`)
4. Branch'inizi push edin (`git push origin feature/yeni-ozellik`)
5. Pull Request oluşturun

## 📄 Lisans

Bu proje MIT lisansı altında lisanslanmıştır.

## 🛠️ Geliştirici

**Adel RRC Geliştirme Ekibi**

## 📞 İletişim

Sorularınız için GitHub Issues kullanabilirsiniz.

---

⭐ Bu projeyi beğendiyseniz yıldız vermeyi unutmayın!
