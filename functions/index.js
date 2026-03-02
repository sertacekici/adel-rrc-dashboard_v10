const { onRequest } = require("firebase-functions/v2/https");
const express = require("express");
const bodyParser = require("body-parser");
const admin = require("firebase-admin");

// Initialize Firebase Admin
admin.initializeApp();

// Initialize Firestore
const db = admin.firestore();
const app = express();

const jsonParser = bodyParser.json();

const VALID_API_KEYS = [
  "Qxv8VpkroPyGs3Oik8ztx2x253.", // You should store these securely, e.g., in environment variables
];

const validateApiKey = (req, res, next) => {
  const apiKey = req.header("x-api-key");

  if (!apiKey) {
    return res.status(401).json({
      status: "error",
      message: "API key is missing",
    });
  }

  if (!VALID_API_KEYS.includes(apiKey)) {
    return res.status(403).json({
      status: "error",
      message: "Invalid API key",
    });
  }

  next();
};

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(validateApiKey);

app.get("/", (req, res) => {
  res.send(`Welcome To ADELSOFT RRC API`);
});

/// TBL MASALAR
app.post("/tblmasalar", async (req, res) => {
    console.log("[DEBUG] /tblmasalar - Headers:", JSON.stringify(req.headers));
    console.log("[DEBUG] /tblmasalar - Body:", JSON.stringify(req.body));
    console.log("[DEBUG] /tblmasalar - masalar:", JSON.stringify(req.body.masalar));
    //const storecode = req.headers.storecode;
    const masalar = req.body.masalar;

    const masaRef = await db.collection("Masalar").add(masalar);

    res.status(201).json({
        status: "success",
        message: "Successful",
        data: {
            syncID: masaRef.id,
        }
    })
})

app.post("/uptblmasalar", async (req, res) => {
   try {
    console.log("[DEBUG] /uptblmasalar - Headers:", JSON.stringify(req.headers));
    console.log("[DEBUG] /uptblmasalar - Body:", JSON.stringify(req.body));
    console.log("[DEBUG] /uptblmasalar - sync-id:", req.header("sync-id"));
    console.log("[DEBUG] /uptblmasalar - masalar:", JSON.stringify(req.body.masalar));
    const syncID = req.header("sync-id");
       const masalar = req.body.masalar;
       // Döküman referansını al
       const masaRef = db.collection("Masalar").doc(syncID);
       
       // Dökümanın var olup olmadığını kontrol et
       const doc = await masaRef.get();

       if (!doc.exists) {
           return res.status(404).json({
               status: "error",
               message: "Masa bulunamadı"
           });
       }

       // Güncelleme işlemi
       await masaRef.update(masalar);

       res.status(200).json({
           status: "success",
           message: "Masa başarıyla güncellendi",
       });

   } catch (error) {
       console.error("Masa güncelleme hatası:", error);
       res.status(500).json({
           status: "error",
           message: "Masa güncellenirken hata oluştu",
           error: error.message
       });
   }
});


/// TBL CUSTOMERS
app.post("/tblmusteriler", async (req, res) => {
    //const storecode = req.headers.storecode;
    const musteri = req.body.musteri;

    const custoemrRef = await db.collection("Customers").add(musteri);

    res.status(201).json({
        status: "success",
        message: "Successful",
        data: {
            syncID: custoemrRef.id,
        }
    })
})

app.post("/upttblmusteriler", async (req, res) => {
   try {
       const syncID = req.header("sync-id");
       const musteriData = req.body.musteriData.musteri;

       // Validasyonlar
       if (!syncID) {
           console.error("Hata: sync-id header eksik");
           return res.status(400).json({
               status: "error",
               message: "Header kısmında sync-id eksik veya boş"
           });
       }

       if (!musteriData) {
           console.error("Hata: musteriData body içinde bulunamadı. Gelen body:", req.body);
           return res.status(400).json({
               status: "error",
               message: "JSON içeriğinde 'musteriData' anahtarı bulunamadı. Verinizi { musteriData: ... } şeklinde sarmalamanız gerekebilir."
           });
       }

       // Döküman referansını al
       const musteriRef = db.collection("Customers").doc(syncID);
       
       // Dökümanın var olup olmadığını kontrol et
       const doc = await musteriRef.get();

       if (!doc.exists) {
           return res.status(404).json({
               status: "error",
               message: "Müşteri bulunamadı"
           });
       }

       // Güncelleme işlemi
       await musteriRef.update(musteriData);

       res.status(200).json({
           status: "success",
           message: "Müşteri Datası başarıyla güncellendi",
       });

   } catch (error) {
       console.error("Müşteri Datası güncelleme hatası:", error);
       res.status(500).json({
           status: "error",
           message: "Müşteri Datası güncellenirken hata oluştu",
           error: error.message
       });
   }
});


/// TBL MASA ÖDEMELERİ

app.post("/tblmasaodemeler", async (req, res) => {
    //const storecode = req.headers.storecode;
    const masaOdemeleri = req.body.masaOdemeleri;

    const odemeRef = await db.collection("MasaOdemeleri").add(masaOdemeleri);

    res.status(201).json({
        status: "success",
        message: "Successful",
        data: {
            syncID: odemeRef.id,
        }
    })
})

app.post("/uptblmasaodemeler", async (req, res) => {
   try {
       const syncID = req.header("sync-id");
       const masaOdemeleri = req.body.masaodemeleri;
       // Döküman referansını al
       const masaOdemeRef = db.collection("MasaOdemeleri").doc(syncID);
       
       // Dökümanın var olup olmadığını kontrol et
       const doc = await masaRef.get();

       if (!doc.exists) {
           return res.status(404).json({
               status: "error",
               message: "Masa bulunamadı"
           });
       }

       // Güncelleme işlemi
       await masaOdemeRef.update(masaOdemeleri);

       res.status(200).json({
           status: "success",
           message: "Masa Ödemesi başarıyla güncellendi",
       });

   } catch (error) {
       console.error("Masa Ödemesi güncelleme hatası:", error);
       res.status(500).json({
           status: "error",
           message: "Masa Ödemesi güncellenirken hata oluştu",
           error: error.message
       });
   }
});

/// TBL SALON IPTALLER
app.post("/tbliptaller", async (req, res) => {
    const tbliptaller = req.body.iptaller;

    const iptalRef = await db.collection("Iptaller").add(tbliptaller);

    res.status(201).json({
        status: "success",
        message: "Successful",
        data: {
            syncID: iptalRef.id,
        }
    })
})

app.post("/uptbliptaller", async (req, res) => {
   try {
       const syncID = req.header("sync-id");
       const tbliptaller = req.body.iptaller;
       // Döküman referansını al
       const iptalRef = db.collection("Iptaller").doc(syncID);
       
       // Dökümanın var olup olmadığını kontrol et
       const doc = await iptalRef.get();

       if (!doc.exists) {
           return res.status(404).json({
               status: "error",
               message: "Masa bulunamadı"
           });
       }

       // Güncelleme işlemi
       await iptalRef.update(tbliptaller);

       res.status(200).json({
           status: "success",
           message: "Iptal Kaydı başarıyla güncellendi",
       });

   } catch (error) {
       console.error("Iptal Kaydı güncelleme hatası:", error);
       res.status(500).json({
           status: "error",
           message: "Iptal Kaydı güncellenirken hata oluştu",
           error: error.message
       });
   }
});

// TBL ADISYONLAR

app.get("/kuryeatama", async (req, res) => {
    try {
        const subeId = req.headers.subeid;
        
        console.log("Gelen subeId:", subeId);
        console.log("Headers:", req.headers);
        
        if (!subeId) {
            return res.status(400).json({
                status: "error",
                message: "subeId header is required"
            });
        }

        const kuryeAtamaRef = db.collection("kuryeatama");
        
        // Önce tüm dokümanları çek ve kontrol et
        const allDocs = await kuryeAtamaRef.get();
        console.log("Toplam doküman sayısı:", allDocs.size);
        
        if (!allDocs.empty) {
            allDocs.forEach(doc => {
                const data = doc.data();
                console.log("Doküman ID:", doc.id);
                console.log("Doküman data:", data);
                console.log("subeId field değeri:", data.subeId);
                console.log("Tip kontrolü - aranan:", typeof subeId, "bulunan:", typeof data.subeId);
            });
        }
        
        // Şimdi filtreleme yap
        const snapshot = await kuryeAtamaRef.where("subeId", "==", subeId).get();
        console.log("Filtrelenmiş doküman sayısı:", snapshot.size);
        
        const kuryeAtamaList = [];
        snapshot.forEach(doc => {
            kuryeAtamaList.push({
                id: doc.id,
                ...doc.data()
            });
        });

        res.status(200).json({
            status: "success",
            message: "Successful",
            data: kuryeAtamaList,
        });

    } catch (error) {
        console.error("Error getting kurye atama:", error);
        res.status(500).json({
            status: "error",
            message: "Internal server error"
        });
    }
});

// DELETE endpoint - Kurye atama silme
app.delete("/kuryeatamasil", async (req, res) => {
    try {
        const docID = req.headers.docid;
        
        if (!docID) {
            return res.status(400).json({
                status: "error",
                message: "docID header is required"
            });
        }

        const docRef = db.collection("kuryeatama").doc(docID);
        const doc = await docRef.get();
        
        if (!doc.exists) {
            return res.status(404).json({
                status: "error",
                message: "Document not found"
            });
        }

        await docRef.delete();

        res.status(200).json({
            status: "success",
            message: "Document deleted successfully",
            data: {
                deletedDocID: docID
            }
        });

    } catch (error) {
        console.error("Error deleting kurye atama:", error);
        res.status(500).json({
            status: "error",
            message: "Internal server error"
        });
    }
});
app.post("/tbladisyonlar", async (req, res) => {
    try {
        const tbladisyonlar = req.body.adisyonlar;
        const tbladisyonicerik = req.body.adisyonicerik;

        const adisyonRef = await db.collection("Adisyonlar").add(tbladisyonlar);

        // tbladisyonicerik array kontrolü
        if (tbladisyonicerik && Array.isArray(tbladisyonicerik) && tbladisyonicerik.length > 0) {
            // Her bir item'a adisyonfbid ekle ve kaydet
            const addPromises = tbladisyonicerik.map(item => {
                const itemWithFbId = {
                    ...item,
                    adisyonfbid: adisyonRef.id
                };
                return db.collection("AdisyonIcerik").add(itemWithFbId);
            });

            await Promise.all(addPromises);
        }

        res.status(201).json({
            status: "success",
            message: "Successful",
            data: {
                syncID: adisyonRef.id,
            }
        });

    } catch (error) {
        console.error("Adisyon kayıt hatası:", error);
        res.status(500).json({
            status: "error",
            message: "Adisyon kaydedilirken hata oluştu",
            error: error.message
        });
    }
});


app.post("/uptbladisyonlar", async (req, res) => {
   try {
       const syncID = req.header("sync-id");
       const tbladisyonlar = req.body.adisyonlar;
       const tbladisyonicerik = req.body.adisyonicerik;
       
       // Döküman referansını al
       const adisyonRef = db.collection("Adisyonlar").doc(syncID);
       
       // Dökümanın var olup olmadığını kontrol et
       const doc = await adisyonRef.get();

       if (!doc.exists) {
           return res.status(404).json({
               status: "error",
               message: "Adisyon bulunamadı"
           });
       }

       // Güncelleme işlemi
       await adisyonRef.update(tbladisyonlar);

       // tbladisyonicerik kontrolü ve işlemleri
       if (tbladisyonicerik && Array.isArray(tbladisyonicerik) && tbladisyonicerik.length > 0) {
           // Önce mevcut kayıtları sil
           const existingRecords = await db.collection("AdisyonIcerik")
               .where("adisyonfbid", "==", syncID)
               .get();

           // Batch delete işlemi - sadece kayıt varsa
           if (!existingRecords.empty) {
               const batch = db.batch();
               existingRecords.forEach(doc => {
                   batch.delete(doc.ref);
               });
               await batch.commit();
           }

           // Yeni kayıtları ekle
           const addPromises = tbladisyonicerik.map(item => {
               // Her item'a adisyonfbid ekle
               const itemWithFbId = {
                   ...item,
                   adisyonfbid: syncID
               };
               return db.collection("AdisyonIcerik").add(itemWithFbId);
           });

           await Promise.all(addPromises);
       }

       res.status(200).json({
           status: "success",
           message: "Adisyon Kaydı başarıyla güncellendi",
       });

   } catch (error) {
       console.error("Adisyon Kaydı güncelleme hatası:", error);
       res.status(500).json({
           status: "error",
           message: "Adisyon Kaydı güncellenirken hata oluştu",
           error: error.message
       });
   }
});

app.delete("/tbladisyonlarsil", async (req, res) => {
    try {
        const syncID = req.header("sync-id");

        if (!syncID) {
            return res.status(400).json({
                status: "error",
                message: "sync-id header is required"
            });
        }

        // 1. AdisyonIcerik kayıtlarını bul ve sil (Cascade Delete)
        const contentRef = db.collection("AdisyonIcerik");
        const contentSnapshot = await contentRef.where("adisyonfbid", "==", syncID).get();

        if (!contentSnapshot.empty) {
            const batch = db.batch();
            contentSnapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
        }

        // 2. Adisyon kaydını sil
        const adisyonRef = db.collection("Adisyonlar").doc(syncID);
        const doc = await adisyonRef.get();

        if (!doc.exists) {
            return res.status(404).json({
                status: "error",
                message: "Adisyon bulunamadı"
            });
        }

        await adisyonRef.delete();

        res.status(200).json({
            status: "success",
            message: "Adisyon ve içeriği başarıyla silindi",
            data: {
                deletedID: syncID
            }
        });

    } catch (error) {
        console.error("Adisyon silme hatası:", error);
        res.status(500).json({
            status: "error",
            message: "Adisyon silinirken hata oluştu",
            error: error.message
        });
    }
});


/// TBL MASA IPTAL ADISYONLARI
app.post("/tblmasaiptalads", async (req, res) => {
    try {
        const masaiptalads = req.body.data;

        const masaiptalRef = await db.collection("MasaIptalAdisyonlari").add(masaiptalads);

        res.status(201).json({
            status: "success",
            message: "Successful",
            data: {
                syncID: masaiptalRef.id,
            }
        });
    } catch (error) {
        console.error("Masa iptal adisyon kayıt hatası:", error);
        res.status(500).json({
            status: "error",
            message: "Masa iptal adisyonu kaydedilirken hata oluştu",
            error: error.message
        });
    }
});

app.post("/uptblmasaiptalads", async (req, res) => {
   try {
       const syncID = req.header("sync-id");
       const masaiptalads = req.body.data;
       
       // Döküman referansını al
       const masaiptalRef = db.collection("MasaIptalAdisyonlari").doc(syncID);
       
       // Dökümanın var olup olmadığını kontrol et
       const doc = await masaiptalRef.get();

       if (!doc.exists) {
           return res.status(404).json({
               status: "error",
               message: "Masa iptal adisyonu bulunamadı"
           });
       }

       // Güncelleme işlemi
       await masaiptalRef.update(masaiptalads);

       res.status(200).json({
           status: "success",
           message: "Masa iptal adisyonu başarıyla güncellendi",
       });

   } catch (error) {
       console.error("Masa iptal adisyonu güncelleme hatası:", error);
       res.status(500).json({
           status: "error",
           message: "Masa iptal adisyonu güncellenirken hata oluştu",
           error: error.message
       });
   }
});


// GLOBAL SYNC ENDPOINT
app.post("/globalsync", async (req, res) => {
    try {
        const collectionName = req.body.collection; // Collection name from body
        const data = req.body.data; // Data object from body
        const syncID = req.header("sync-id"); // Sync ID from header (for updates)

        if (!collectionName) {
            return res.status(400).json({
                status: "error",
                message: "Collection parameter is missing in body"
            });
        }

        const colRef = db.collection(collectionName);

        if (syncID) {
            // Update Operation
            const docRef = colRef.doc(syncID);
            const doc = await docRef.get();

            if (!doc.exists) {
                return res.status(404).json({
                    status: "error",
                    message: "Document not found"
                });
            }

            await docRef.update(data);

            res.status(200).json({
                status: "success",
                message: "Record updated successfully"
            });
        } else {
            // Insert Operation
            const docRef = await colRef.add(data);

            res.status(201).json({
                status: "success",
                message: "Record added successfully",
                data: {
                    syncID: docRef.id,
                }
            });
        }
    } catch (error) {
        console.error("Global sync error:", error);
        res.status(500).json({
            status: "error",
            message: "Error processing sync request",
            error: error.message
        });
    }
});

app.delete("/globaldelete", async (req, res) => {
    try {
        // Headers veya Body'den parametreleri almayı dene
        // Header'da gönderilirse: 'collection' ve 'doc-id'
        // Body'de gönderilirse: 'collection' ve 'docId'
        const collectionName = req.header("collection") || req.body.collection;
        const docId = req.header("doc-id") || req.body.docId;

        if (!collectionName || !docId) {
            return res.status(400).json({
                status: "error",
                message: "Collection and docId are required (check headers or body)"
            });
        }

        const docRef = db.collection(collectionName).doc(docId);
        const doc = await docRef.get();

        if (!doc.exists) {
            return res.status(404).json({
                status: "error",
                message: "Document not found"
            });
        }

        // Adisyonlar siliniyorsa, bağlı AdisyonIcerik verilerini de sil
        if (collectionName === "Adisyonlar") {
            const contentSnapshot = await db.collection("AdisyonIcerik")
                .where("adisyonfbid", "==", docId)
                .get();

            if (!contentSnapshot.empty) {
                const batch = db.batch();
                contentSnapshot.forEach(subDoc => {
                    batch.delete(subDoc.ref);
                });
                await batch.commit();
            }
        }

        await docRef.delete();

        res.status(200).json({
            status: "success",
            message: "Document deleted successfully",
            data: {
                collection: collectionName,
                deletedDocID: docId
            }
        });

    } catch (error) {
        console.error("Global delete error:", error);
        res.status(500).json({
            status: "error",
            message: "Error deleting document",
            error: error.message
        });
    }
});

app.post("/cleancollections", async (req, res) => {
    try {
        const collections = req.body.collections;

        if (!collections || !Array.isArray(collections)) {
            return res.status(400).json({
                status: "error",
                message: "Lütfen 'collections' parametresinde silinecek koleksiyon isimlerini array olarak gönderin."
            });
        }

        const results = [];

        for (const collectionName of collections) {
            const collectionRef = db.collection(collectionName);
            const snapshot = await collectionRef.get();

            if (snapshot.size === 0) {
                results.push({ collection: collectionName, status: "already_empty", count: 0 });
                continue;
            }

            // Batch delete işlemleri (Firestore batch limiti 500'dür)
            const batches = [];
            let batch = db.batch();
            let operationCounter = 0;
            let totalDeleted = 0;

            for (const doc of snapshot.docs) {
                batch.delete(doc.ref);
                operationCounter++;
                totalDeleted++;

                if (operationCounter === 499) {
                    batches.push(batch.commit());
                    batch = db.batch();
                    operationCounter = 0;
                }
            }

            if (operationCounter > 0) {
                batches.push(batch.commit());
            }

            await Promise.all(batches);
            results.push({ collection: collectionName, status: "cleared", count: totalDeleted });
        }

        res.status(200).json({
            status: "success",
            message: "Koleksiyon temizleme işlemi tamamlandı",
            details: results
        });

    } catch (error) {
        console.error("Collection temizleme hatası:", error);
        res.status(500).json({
            status: "error",
            message: "Koleksiyonlar temizlenirken hata oluştu",
            error: error.message
        });
    }
});






exports.rrcapi = onRequest(app);

