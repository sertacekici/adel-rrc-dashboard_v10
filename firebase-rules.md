# Firebase Kuralları ve İzinler

Bu belge, Firebase projesi için güvenlik kurallarını ve izinleri içermektedir. Bu kuralları Firebase konsolunda ayarlamanız gerekir.

## Firestore Güvenlik Kuralları

Firestore güvenlik kurallarını Firebase konsolunda veya CLI aracılığıyla ayarlayabilirsiniz. Aşağıdaki kuralları Firestore güvenlik kuralları bölümüne eklemeniz gerekir:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Kimlik doğrulaması yapılmış kullanıcıların tüm kullanıcı belgelerini okumasına izin ver
    match /users/{userId} {
      // Rol kontrol fonksiyonları
      function isAdmin() {
        return request.auth != null && 
          get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'sirket_yoneticisi';
      }
      
      function isSubeYoneticisi() {
        return request.auth != null && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'sube_yoneticisi';
      }
      
      function isSameSubeManager(userData) {
        let currentUserData = get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
        return currentUserData.role == 'sube_yoneticisi' && userData.subeId == currentUserData.subeId;
      }
      
      // Şirket yöneticileri tüm kullanıcıları görebilir
      // Şube yöneticileri yalnızca kendi şubelerindeki personel ve kurye kullanıcılarını görebilir
      // Diğer kullanıcılar sınırlı görünüm elde eder
      allow read: if request.auth != null && (
        isAdmin() ||  // Şirket yöneticisi tüm kullanıcıları görebilir
        (!isAdmin() && !isSubeYoneticisi()) ||  // Normal kullanıcılar sınırlı görünüm alır
        (isSubeYoneticisi() && 
          resource.data.subeId == get(/databases/$(database)/documents/users/$(request.auth.uid)).data.subeId && 
          (resource.data.role == 'personel' || resource.data.role == 'kurye')
        )  // Şube yöneticisi sadece kendi şubesindeki personel ve kuryeleri görebilir
      );
      
      // Şirket yöneticileri her türlü kullanıcı oluşturabilir
      // Şube yöneticileri sadece kendi şubelerinde personel/kurye ekleyebilir
      allow create: if request.auth != null && (
        isAdmin() || 
        (isSubeYoneticisi() && 
          (request.resource.data.role == 'personel' || 
           request.resource.data.role == 'kurye')
        )
      );
      
      // Şirket yöneticileri her türlü düzenleme yapabilir
      // Şube yöneticileri sadece kendi şubelerindeki personel ve kurye rolündeki kullanıcıları düzenleyebilir
      allow update: if request.auth != null && (
        isAdmin() || // Şirket yöneticisi için sınırlama yok - tüm güncellemelere izin ver
        (isSubeYoneticisi() && 
          isSameSubeManager(resource.data) &&
          (resource.data.role == 'personel' || resource.data.role == 'kurye') &&
          (request.resource.data.role == 'personel' || request.resource.data.role == 'kurye')
        )
      );
      
      // Sadece şirket yöneticileri kullanıcı silebilir
      allow delete: if isAdmin();
    }
    
    // Şube belgeleri için kurallar
    match /subeler/{subeId} {
      function isSubeYoneticisiOfThisBranch() {
        let currentUserData = get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
        return currentUserData.role == 'sube_yoneticisi' && currentUserData.subeId == subeId;
      }
      
      // Şube yöneticileri sadece kendi şubelerini, şirket yöneticileri tüm şubeleri görebilir
      allow read: if request.auth != null && (
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'sirket_yoneticisi' ||
        isSubeYoneticisiOfThisBranch() ||
        (!isAdmin() && !isSubeYoneticisi())  // Normal kullanıcılar için görüntüleme izni
      );
      
      // Sadece şirket yöneticileri şube oluşturabilir, düzenleyebilir ve silebilir
      allow create, update, delete: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'sirket_yoneticisi';
    }
    
    // Teslimat belgeleri için kurallar
    match /teslimatlar/{teslimatId} {
      allow read: if request.auth != null;
      // Herhangi bir kimlik doğrulaması yapılmış kullanıcının oluşturmasına izin ver
      allow create: if request.auth != null;
      // Sadece ilgili kullanıcının (kurye, depo, muhasebe veya oluşturan) veya yönetici rollerinin güncellemesine izin ver
      allow update: if request.auth != null && (
        request.resource.data.kuryeId == request.auth.uid ||
        request.resource.data.depoId == request.auth.uid ||
        request.resource.data.muhasebeId == request.auth.uid ||
        resource.data.olusturanId == request.auth.uid ||
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'sirket_yoneticisi' ||
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'sube_yoneticisi'
      );
      // Yalnızca yönetici rollerinin silmesine izin ver
      allow delete: if request.auth != null && (
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'sirket_yoneticisi' ||
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'sube_yoneticisi'
      );
    }
    
    // Ürünler koleksiyonu için kurallar
    match /urunler/{urunId} {
      // Herkes ürünleri okuyabilir
      allow read: if request.auth != null;
      // Sadece şirket yöneticisi ürün oluşturabilir, güncelleyebilir ve silebilir
      allow create, update, delete: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'sirket_yoneticisi';
    }
    
    // Şube siparişleri koleksiyonu için kurallar
    match /sube_siparisleri/{siparisId} {
      function isCompanyManager() {
        return request.auth != null && 
          get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'sirket_yoneticisi';
      }
      
      function isBranchManager() {
        return request.auth != null && 
          get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'sube_yoneticisi';
      }
      
      function isOwnBranchOrder() {
        let currentUserData = get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
        return resource.data.sube_id == currentUserData.subeId;
      }
      
      // Şirket yöneticisi tüm siparişleri, şube müdürü sadece kendi şube siparişlerini görebilir
      allow read: if request.auth != null && (
        isCompanyManager() || 
        (isBranchManager() && isOwnBranchOrder())
      );
      
      // Şube müdürleri sipariş oluşturabilir, şirket yöneticisi güncelleyebilir
      allow create: if request.auth != null && isBranchManager();
      allow update: if request.auth != null && isCompanyManager();
      allow delete: if request.auth != null && isCompanyManager();
    }
    
    // Kurye atama kayıtları koleksiyonu için kurallar
    match /kuryeatama/{atamaId} {
      function isCompanyManager() {
        return request.auth != null && 
          get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'sirket_yoneticisi';
      }
      
      function isBranchManager() {
        return request.auth != null && 
          get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'sube_yoneticisi';
      }
      
      function isCourier() {
        return request.auth != null && 
          get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'kurye';
      }
      
      function isOwnBranchAssignment() {
        let currentUserData = get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
        return resource.data.subeId == currentUserData.subeId;
      }
      
      // Tüm kimlik doğrulaması yapılmış kullanıcılar kurye atama kayıtlarını okuyabilir
      allow read: if request.auth != null;
      
      // Şirket yöneticisi, şube müdürü ve kurye atama kaydı oluşturabilir
      allow create: if request.auth != null && (
        isCompanyManager() || 
        isBranchManager() ||
        isCourier()
      );
      
      // Sadece şirket yöneticisi kurye atama kayıtlarını güncelleyebilir ve silebilir
      allow update, delete: if request.auth != null && isCompanyManager();
    }
    
    // Adisyonlar koleksiyonu için kurallar
    match /Adisyonlar/{adisyonId} {
      function isCompanyManager() {
        return request.auth != null && 
          get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'sirket_yoneticisi';
      }
      
      function isBranchManager() {
        return request.auth != null && 
          get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'sube_yoneticisi';
      }
      
      function isCourier() {
        return request.auth != null && 
          get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'kurye';
      }
      
      function isOwnBranchOrder() {
        let currentUserData = get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
        return resource.data.subeId == currentUserData.subeId;
      }
      
      // Tüm kimlik doğrulaması yapılmış kullanıcılar adisyonları okuyabilir
      allow read: if request.auth != null;
      
      // Şirket yöneticisi ve şube müdürü adisyon oluşturabilir
      allow create: if request.auth != null && (
        isCompanyManager() || 
        isBranchManager()
      );
      
      // Güncelleme izinleri:
      // - Şirket yöneticisi: Tüm alanları güncelleyebilir
      // - Şube müdürü: Kendi şube siparişlerini güncelleyebilir
      // - Kurye: Motorcu alanını güncelleyebilir
      allow update: if request.auth != null && (
        isCompanyManager() || 
        (isBranchManager() && isOwnBranchOrder()) ||
        isCourier()
      );
      
      // Sadece şirket yöneticisi adisyon silebilir
      allow delete: if request.auth != null && isCompanyManager();
    }
    
    // Şube bakiye hareketleri koleksiyonu için kurallar
    match /sube_bakiye_hareketleri/{hareketId} {
      function isCompanyManager() {
        return request.auth != null && 
          get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'sirket_yoneticisi';
      }
      
      function isBranchManager() {
        return request.auth != null && 
          get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'sube_yoneticisi';
      }
      
      function isOwnBranchMovement() {
        let currentUserData = get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
        return resource.data.sube_id == currentUserData.subeId;
      }
      
      // Şirket yöneticisi tüm hareketleri, şube müdürü sadece kendi şube hareketlerini görebilir
      allow read: if request.auth != null && (
        isCompanyManager() || 
        (isBranchManager() && isOwnBranchMovement())
      );
      
      // Sadece şirket yöneticisi bakiye hareketi oluşturabilir, güncelleyebilir ve silebilir
      allow create, update, delete: if request.auth != null && isCompanyManager();
    }
    
    // Genel kural - kimlik doğrulaması yapılmış tüm kullanıcılara sınırlı okuma izni ver
    // Sadece geliştirme aşamasında kullanılmalıdır
    match /{document=**} {
      // Kullanıcı oturum açmışsa temel okuma izni var
      // Ancak spesifik koleksiyonlar için yukarıdaki kurallar önceliklidir
      allow read: if request.auth != null;
      
      // Yazma izinleri:
      // - Şirket yöneticileri tüm belgelere yazabilir
      // - Şube yöneticileri sadece yukarıda belirtilen kurallardaki belgelere yazabilir
      // - Diğer roller özel izinleri olmadıkça yazamaz
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'sirket_yoneticisi';
    }
    
    // Debug kuralı - Tüm yazma işlemlerine geçici olarak izin ver (TEST AŞAMASINDA)
    // Bu kural sadece geliştirme süresince kullanılmalı, yayına çıkmadan önce kaldırılmalıdır!
    match /users/{userId} {
      allow write: if request.auth != null;
    }
  }
}
```

## Firebase Authentication Ayarları

Firebase Authentication için aşağıdaki ayarları yapmanız gerekir:

1. Firebase konsolunda Authentication bölümüne gidin
2. Sign-in method sekmesinden Email/Password yöntemini etkinleştirin
3. Gerekirse, diğer oturum açma yöntemlerini (Google, Facebook vb.) etkinleştirebilirsiniz

## Firebase Storage Kuralları (İleride Kullanılacaksa)

Eğer Firebase Storage kullanacaksanız, aşağıdaki kuralları kullanabilirsiniz:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Kimlik doğrulaması yapılmış tüm kullanıcıların dosya yüklemesine ve okumasına izin ver
    match /users/{userId}/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Kullanıcı profil resimleri
    match /profileImages/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Teslimat belgeleri
    match /teslimatDokumanlari/{teslimatId}/{allPaths=**} {
      allow read: if request.auth != null;
      // Herhangi bir kimlik doğrulaması yapılmış kullanıcının yüklemesine izin ver
      allow create: if request.auth != null;
      // Sadece ilgili kullanıcı veya yönetici rollerinin güncellemesine/silmesine izin ver
      allow update, delete: if request.auth != null && (
        resource.metadata.ownerId == request.auth.uid ||
        request.resource.metadata.ownerId == request.auth.uid ||
        request.auth.token.role == "sirket_yoneticisi" ||
        request.auth.token.role == "sube_yoneticisi" ||
        request.auth.token.role == "muhasebe" ||
        request.auth.token.role == "depo"
      );
    }
    
    // Genel kural - varsayılan olarak erişimi reddet
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

## Firebase Projesinde Yapmanız Gereken Diğer Ayarlar

1. **Custom Claims (Özel İddiaları) Ayarlama**
   
   Kullanıcı rolleri için Firebase Admin SDK kullanarak Cloud Functions üzerinden özel iddialar ayarlayabilirsiniz:

   ```javascript
   const functions = require('firebase-functions');
   const admin = require('firebase-admin');
   admin.initializeApp();

   exports.setUserRole = functions.firestore.document('users/{userId}')
       .onWrite(async (change, context) => {
           const userData = change.after.data();
           if (userData && userData.role) {
               try {
                   // Kullanıcıya role özel iddiası ekleniyor
                   // Desteklenen roller: sirket_yoneticisi, sube_yoneticisi, personel, kurye, muhasebe, depo
                   await admin.auth().setCustomUserClaims(userData.uid, { role: userData.role });
                   return null;
               } catch (error) {
                   console.error('Error setting custom claim', error);
                   return null;
               }
           }
           return null;
       });
   ```

2. **Firebase İndekslerini Ayarlama**

   Çok fazla sorgu kullanıyorsanız, performans için Firebase indekslerini ayarlamanız gerekebilir:

   ```json
   {
     "indexes": [
       {
         "collectionGroup": "users",
         "queryScope": "COLLECTION",
         "fields": [
           { "fieldPath": "role", "order": "ASCENDING" },
           { "fieldPath": "createdAt", "order": "DESCENDING" }
         ]
       },
       {
         "collectionGroup": "teslimatlar",
         "queryScope": "COLLECTION",
         "fields": [
           { "fieldPath": "durum", "order": "ASCENDING" },
           { "fieldPath": "tarih", "order": "DESCENDING" }
         ]
       }
     ]
   }
   ```

## Uygulama Ayarları

Uygulamanızda aşağıdaki Firebase yapılandırma ayarlarını kullandığınızdan emin olun (`.env` dosyasında):

```
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

Bu ayarları Firebase konsolundan proje ayarları > Web uygulaması yapılandırması bölümünden alabilirsiniz.
