const { onRequest } = require("firebase-functions/v2/https");
const express = require("express");
const bodyParser = require("body-parser");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();
const app = express();

const jsonParser = bodyParser.json();

const VALID_API_KEYS = [
  "Qxv8VpkroPyGs3Oik8ztx2x253.",
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

  return next();
};

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(validateApiKey);

app.get("/", (req, res) => {
  res.send("Welcome To ADELSOFT RRC API");
});

app.post("/tblmasalar", async (req, res) => {
  const masalar = req.body.masalar;
  const masaRef = await db.collection("Masalar").add(masalar);

  res.status(201).json({
    status: "success",
    message: "Successful",
    data: { syncID: masaRef.id },
  });
});

app.post("/uptblmasalar", async (req, res) => {
  try {
    const syncID = req.header("sync-id");
    const masalar = req.body.masalar;
    const masaRef = db.collection("Masalar").doc(syncID);
    const doc = await masaRef.get();

    if (!doc.exists) {
      return res.status(404).json({
        status: "error",
        message: "Masa bulunamadi",
      });
    }

    await masaRef.update(masalar);

    return res.status(200).json({
      status: "success",
      message: "Masa basariyla guncellendi",
    });
  } catch (error) {
    console.error("Masa guncelleme hatasi:", error);
    return res.status(500).json({
      status: "error",
      message: "Masa guncellenirken hata olustu",
      error: error.message,
    });
  }
});

app.post("/tblmusteriler", async (req, res) => {
  const musteri = req.body.musteri;
  const customerRef = await db.collection("Customers").add(musteri);

  res.status(201).json({
    status: "success",
    message: "Successful",
    data: { syncID: customerRef.id },
  });
});

app.post("/upttblmusteriler", async (req, res) => {
  try {
    const syncID = req.header("sync-id");
    const musteriData = req.body.musteriData;
    const musteriRef = db.collection("Customers").doc(syncID);
    const doc = await musteriRef.get();

    if (!doc.exists) {
      return res.status(404).json({
        status: "error",
        message: "Musteri bulunamadi",
      });
    }

    await musteriRef.update(musteriData);

    return res.status(200).json({
      status: "success",
      message: "Musteri Datası basariyla guncellendi",
    });
  } catch (error) {
    console.error("Musteri Datası guncelleme hatasi:", error);
    return res.status(500).json({
      status: "error",
      message: "Musteri Datası guncellenirken hata olustu",
      error: error.message,
    });
  }
});

app.post("/tblmasaodemeler", async (req, res) => {
  const masaOdemeleri = req.body.masaOdemeleri;
  const odemeRef = await db.collection("MasaOdemeleri").add(masaOdemeleri);

  res.status(201).json({
    status: "success",
    message: "Successful",
    data: { syncID: odemeRef.id },
  });
});

app.post("/uptblmasaodemeler", async (req, res) => {
  try {
    const syncID = req.header("sync-id");
    const masaOdemeleri = req.body.masaodemeleri;
    const masaOdemeRef = db.collection("MasaOdemeleri").doc(syncID);
    const doc = await masaOdemeRef.get();

    if (!doc.exists) {
      return res.status(404).json({
        status: "error",
        message: "Masa bulunamadi",
      });
    }

    await masaOdemeRef.update(masaOdemeleri);

    return res.status(200).json({
      status: "success",
      message: "Masa Odemesi basariyla guncellendi",
    });
  } catch (error) {
    console.error("Masa Odemesi guncelleme hatasi:", error);
    return res.status(500).json({
      status: "error",
      message: "Masa Odemesi guncellenirken hata olustu",
      error: error.message,
    });
  }
});

app.post("/tbliptaller", async (req, res) => {
  const tbliptaller = req.body.iptaller;
  const iptalRef = await db.collection("Iptaller").add(tbliptaller);

  res.status(201).json({
    status: "success",
    message: "Successful",
    data: { syncID: iptalRef.id },
  });
});

app.post("/uptbliptaller", async (req, res) => {
  try {
    const syncID = req.header("sync-id");
    const tbliptaller = req.body.iptaller;
    const iptalRef = db.collection("Iptaller").doc(syncID);
    const doc = await iptalRef.get();

    if (!doc.exists) {
      return res.status(404).json({
        status: "error",
        message: "Masa bulunamadi",
      });
    }

    await iptalRef.update(tbliptaller);

    return res.status(200).json({
      status: "success",
      message: "Iptal Kaydi basariyla guncellendi",
    });
  } catch (error) {
    console.error("Iptal Kaydi guncelleme hatasi:", error);
    return res.status(500).json({
      status: "error",
      message: "Iptal Kaydi guncellenirken hata olustu",
      error: error.message,
    });
  }
});

app.post("/tbladisyonlar", jsonParser, async (req, res) => {
  try {
    const tbladisyonlar = req.body.adisyonlar;
    const tbladisyonicerik = req.body.adisyonicerik;

    const adisyonRef = await db.collection("Adisyonlar").add(tbladisyonlar);

    if (Array.isArray(tbladisyonicerik) && tbladisyonicerik.length > 0) {
      const addPromises = tbladisyonicerik.map((item) => {
        const itemWithFbId = {
          ...item,
          adisyonfbid: adisyonRef.id,
        };
        return db.collection("AdisyonIcerik").add(itemWithFbId);
      });

      await Promise.all(addPromises);
    }

    return res.status(201).json({
      status: "success",
      message: "Successful",
      data: { syncID: adisyonRef.id },
    });
  } catch (error) {
    console.error("Adisyon kayit hatasi:", error);
    return res.status(500).json({
      status: "error",
      message: "Adisyon kaydedilirken hata olustu",
      error: error.message,
    });
  }
});

app.get("/kuryeatama", async (req, res) => {
  try {
    const subeId = req.headers.subeid;

    if (!subeId) {
      return res.status(400).json({
        status: "error",
        message: "subeId header is required",
      });
    }

    const snapshot = await db.collection("kuryeatama").where("subeId", "==", subeId).get();
    const kuryeAtamaList = [];
    snapshot.forEach((doc) => {
      kuryeAtamaList.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    return res.status(200).json({
      status: "success",
      message: "Successful",
      data: kuryeAtamaList,
    });
  } catch (error) {
    console.error("Error getting kurye atama:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
});

app.delete("/kuryeatamasil", async (req, res) => {
  try {
    const docID = req.headers.docid;

    if (!docID) {
      return res.status(400).json({
        status: "error",
        message: "docID header is required",
      });
    }

    const docRef = db.collection("kuryeatama").doc(docID);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({
        status: "error",
        message: "Document not found",
      });
    }

    await docRef.delete();

    return res.status(200).json({
      status: "success",
      message: "Document deleted successfully",
      data: { deletedDocID: docID },
    });
  } catch (error) {
    console.error("Error deleting kurye atama:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
});

app.post("/uptbladisyonlar", async (req, res) => {
  try {
    const syncID = req.header("sync-id");
    const tbladisyonlar = req.body.adisyonlar;
    const tbladisyonicerik = req.body.adisyonicerik;

    const adisyonRef = db.collection("Adisyonlar").doc(syncID);
    const doc = await adisyonRef.get();

    if (!doc.exists) {
      return res.status(404).json({
        status: "error",
        message: "Adisyon bulunamadi",
      });
    }

    await adisyonRef.update(tbladisyonlar);

    if (Array.isArray(tbladisyonicerik) && tbladisyonicerik.length > 0) {
      const existingRecords = await db
        .collection("AdisyonIcerik")
        .where("adisyonfbid", "==", syncID)
        .get();

      if (!existingRecords.empty) {
        const batch = db.batch();
        existingRecords.forEach((docItem) => {
          batch.delete(docItem.ref);
        });
        await batch.commit();
      }

      const addPromises = tbladisyonicerik.map((item) => {
        const itemWithFbId = {
          ...item,
          adisyonfbid: syncID,
        };
        return db.collection("AdisyonIcerik").add(itemWithFbId);
      });

      await Promise.all(addPromises);
    }

    return res.status(200).json({
      status: "success",
      message: "Adisyon Kaydi basariyla guncellendi",
    });
  } catch (error) {
    console.error("Adisyon Kaydi guncelleme hatasi:", error);
    return res.status(500).json({
      status: "error",
      message: "Adisyon Kaydi guncellenirken hata olustu",
      error: error.message,
    });
  }
});

exports.rrcapi = onRequest(app);
