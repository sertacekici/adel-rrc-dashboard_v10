/**
 * RRC Raporlama Veri Servisi
 * 
 * Koleksiyonlar:
 * - PaketAdisyonlar       → Paket ciro
 * - MasaOdemeleri          → Masa ciro
 * - PaketIptalAdisyonlar   → Paket iptalleri
 * - MasaOdemeIptalleri      → Masa iptalleri
 * - Masalar                → Masa durumları
 * - PaketAdisyonIcerik      → Paket ürün satışları
 * - SalonAdisyonIcerik      → Salon ürün satışları
 */

import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { toDate, normalizeDateStr } from './dateUtils';

// ─── Tarih Yardımcıları ───────────────────────────────

/**
 * Firestore'dan gelen tarih alanını güvenli şekilde Date objesine çevirir.
 */
const safeDate = (val) => {
  if (!val) return null;
  // Firestore Timestamp
  if (typeof val === 'object' && typeof val.toDate === 'function') {
    return val.toDate();
  }
  // String
  const s = String(val);
  const iso = s.includes('T') ? s : s.replace(' ', 'T');
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
};

/**
 * Tarih string'lerini veritabanı sorgusu için range oluşturur.
 * Firestore'da tarih string olarak saklanmışsa prefix matching kullanılır.
 */
const buildDateRange = (dateStr) => {
  return {
    start: dateStr,
    end: dateStr + '\uf8ff'
  };
};

const buildDateTimeRange = (startDateStr, startTime, endDateStr, endTime) => {
  return {
    start: `${startDateStr} ${startTime}:00`,
    end: endTime === '23:59' ? `${endDateStr}\uf8ff` : `${endDateStr} ${endTime}:59`
  };
};

/**
 * Tarih alanını client-side filtreler (Date aralığı kontrolü).
 */
const isInDateRange = (dateValue, startDate, endDate) => {
  const d = safeDate(dateValue);
  if (!d) return false;
  return d >= startDate && d <= endDate;
};

// ─── İptal Kontrolü ──────────────────────────────────

const isCanceled = (durum) => {
  if (!durum) return false;
  const s = String(durum).toUpperCase();
  return s.includes('İPTAL') || s.includes('IPTAL');
};

// ─── 1. Paket Adisyonlar (Ciro) ──────────────────────

/**
 * Paket ciro hesaplar.
 * Filtre: durum != "İPTAL" olan kayıtların atop toplamı.
 */
export const fetchPaketAdisyonlar = async (rrcId, startDate, endDate) => {
  const constraints = [where('rrc_restaurant_id', '==', String(rrcId))];
  
  const q = query(collection(db, 'PaketAdisyonlar'), ...constraints);
  const snapshot = await getDocs(q);
  
  const docs = snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(d => isInDateRange(d.acilis, startDate, endDate));
  
  const aktif = docs.filter(d => !isCanceled(d.durum));
  const iptalliDocs = docs.filter(d => isCanceled(d.durum));
  
  const toplamCiro = aktif.reduce((sum, d) => sum + (Number(d.atop) || 0), 0);
  const toplamIptal = iptalliDocs.reduce((sum, d) => sum + (Number(d.atop) || 0), 0);
  
  // Ödeme tipine göre gruplama
  const odemeTipleri = {};
  aktif.forEach(d => {
    const tip = d.odemetipi || 'Diğer';
    if (!odemeTipleri[tip]) odemeTipleri[tip] = 0;
    odemeTipleri[tip] += Number(d.atop) || 0;
  });
  
  // Sipariş kaynağına göre gruplama
  const KAYNAK_MAP = { 1: 'Yemek Sepeti', 2: 'Getir', 5: 'Trendyol', 8: 'Migros Yemek' };
  const kaynakGruplari = {};
  aktif.forEach(d => {
    const nerden = Number(d.siparisnerden) || 0;
    const kaynakAd = nerden === 0 ? 'Telefon Siparişi' : (KAYNAK_MAP[nerden] || `Online (${nerden})`);
    if (!kaynakGruplari[kaynakAd]) kaynakGruplari[kaynakAd] = { ciro: 0, adet: 0 };
    kaynakGruplari[kaynakAd].ciro += Number(d.atop) || 0;
    kaynakGruplari[kaynakAd].adet += 1;
  });
  
  return {
    docs: aktif,
    iptalDocs: iptalliDocs,
    toplamCiro,
    toplamIptal,
    odemeTipleri,
    kaynakGruplari,
    toplam: docs.length,
    aktifSayisi: aktif.length,
    iptalSayisi: iptalliDocs.length
  };
};

// ─── 2. Masa Ödemeleri (Ciro) ─────────────────────────

/**
 * Masa ciro hesaplar.
 * tutar toplamı + odemesekli bazında gruplama.
 */
export const fetchMasaOdemeleri = async (rrcId, startDate, endDate) => {
  const constraints = [where('rrc_restaurant_id', '==', String(rrcId))];
  
  const q = query(collection(db, 'MasaOdemeleri'), ...constraints);
  const snapshot = await getDocs(q);
  
  const docs = snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(d => isInDateRange(d.tarih, startDate, endDate));
  
  const toplamCiro = docs.reduce((sum, d) => sum + (Number(d.tutar) || 0), 0);
  
  // Ödeme tipine göre gruplama
  const odemeTipleri = {};
  docs.forEach(d => {
    const tip = d.odemesekli || 'Diğer';
    if (!odemeTipleri[tip]) odemeTipleri[tip] = 0;
    odemeTipleri[tip] += Number(d.tutar) || 0;
  });
  
  return {
    docs,
    toplamCiro,
    odemeTipleri,
    toplam: docs.length
  };
};

// ─── 3. Paket İptal Adisyonlar ───────────────────────

export const fetchPaketIptalAdisyonlar = async (rrcId, startDate, endDate) => {
  const constraints = [where('rrc_restaurant_id', '==', String(rrcId))];
  
  const q = query(collection(db, 'PaketIptalAdisyonlar'), ...constraints);
  const snapshot = await getDocs(q);
  
  const docs = snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(d => isInDateRange(d.iptaltarihi, startDate, endDate));
  
  const toplamIptal = docs.reduce((sum, d) => sum + (Number(d.atop) || 0), 0);
  
  // İptal nedenine göre gruplama
  const iptalNedenleri = {};
  docs.forEach(d => {
    const neden = d.iptalneden || 'Belirtilmemiş';
    if (!iptalNedenleri[neden]) iptalNedenleri[neden] = { count: 0, tutar: 0 };
    iptalNedenleri[neden].count++;
    iptalNedenleri[neden].tutar += Number(d.atop) || 0;
  });
  
  return {
    docs,
    toplamIptal,
    iptalNedenleri,
    toplam: docs.length
  };
};

// ─── 4. Masa Ödeme İptalleri ──────────────────────────

export const fetchMasaOdemeIptalleri = async (rrcId, startDate, endDate) => {
  const constraints = [where('rrc_restaurant_id', '==', String(rrcId))];
  
  const q = query(collection(db, 'MasaOdemeIptalleri'), ...constraints);
  const snapshot = await getDocs(q);
  
  const docs = snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(d => isInDateRange(d.tarih, startDate, endDate));
  
  const toplamIptal = docs.reduce((sum, d) => sum + (Number(d.tutar) || 0), 0);
  
  // Ödeme tipine göre gruplama
  const odemeTipleri = {};
  docs.forEach(d => {
    const tip = d.odemesekli || 'Diğer';
    if (!odemeTipleri[tip]) odemeTipleri[tip] = { count: 0, tutar: 0 };
    odemeTipleri[tip].count++;
    odemeTipleri[tip].tutar += Number(d.tutar) || 0;
  });
  
  return {
    docs,
    toplamIptal,
    odemeTipleri,
    toplam: docs.length
  };
};

// ─── 5. Masalar (Durum) ──────────────────────────────

export const fetchMasalar = async (rrcId) => {
  const constraints = [where('rrc_restaurant_id', '==', String(rrcId))];
  
  const q = query(collection(db, 'Masalar'), ...constraints);
  const snapshot = await getDocs(q);
  
  const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  const durumMap = { 0: 'Boş', 1: 'Dolu', 2: 'Rezerve' };
  const durumSayilari = { Boş: 0, Dolu: 0, Rezerve: 0 };
  
  docs.forEach(d => {
    const durumAdi = durumMap[d.durumid] || 'Bilinmiyor';
    durumSayilari[durumAdi] = (durumSayilari[durumAdi] || 0) + 1;
  });
  
  return {
    docs,
    durumSayilari,
    toplam: docs.length
  };
};

// ─── 6. Paket Ürün Satış Adetleri ────────────────────

export const fetchPaketUrunSatislari = async (rrcId, startDate, endDate) => {
  const constraints = [where('rrc_restaurant_id', '==', String(rrcId))];
  
  const q = query(collection(db, 'PaketAdisyonIcerik'), ...constraints);
  const snapshot = await getDocs(q);
  
  const docs = snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(d => isInDateRange(d.siparistarihi, startDate, endDate));
  
  // Ürün adına göre gruplama
  const urunGruplari = {};
  docs.forEach(d => {
    const urunAdi = d.urunadi || 'Bilinmiyor';
    if (!urunGruplari[urunAdi]) urunGruplari[urunAdi] = { miktar: 0, ciro: 0 };
    urunGruplari[urunAdi].miktar += Number(d.miktar) || 0;
    urunGruplari[urunAdi].ciro += (Number(d.miktar) || 0) * (Number(d.fiyat) || 0);
  });
  
  const urunListesi = Object.entries(urunGruplari)
    .map(([urunadi, val]) => ({ urunadi, ...val }))
    .sort((a, b) => b.miktar - a.miktar);
  
  return {
    docs,
    urunListesi,
    toplam: docs.length,
    toplamMiktar: urunListesi.reduce((s, u) => s + u.miktar, 0)
  };
};

// ─── 7. Salon Ürün Satış Adetleri ─────────────────────

export const fetchSalonUrunSatislari = async (rrcId, startDate, endDate) => {
  const constraints = [where('rrc_restaurant_id', '==', String(rrcId))];
  
  const q = query(collection(db, 'SalonAdisyonIcerik'), ...constraints);
  const snapshot = await getDocs(q);
  
  const docs = snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(d => isInDateRange(d.satistar, startDate, endDate));
  
  // Ürün adına göre gruplama
  const urunGruplari = {};
  docs.forEach(d => {
    const urunAdi = d.urunadi || 'Bilinmiyor';
    if (!urunGruplari[urunAdi]) urunGruplari[urunAdi] = { miktar: 0, ciro: 0 };
    urunGruplari[urunAdi].miktar += Number(d.miktar) || 0;
    urunGruplari[urunAdi].ciro += (Number(d.miktar) || 0) * (Number(d.fiyati) || 0);
  });
  
  const urunListesi = Object.entries(urunGruplari)
    .map(([urunadi, val]) => ({ urunadi, ...val }))
    .sort((a, b) => b.miktar - a.miktar);
  
  return {
    docs,
    urunListesi,
    toplam: docs.length,
    toplamMiktar: urunListesi.reduce((s, u) => s + u.miktar, 0)
  };
};

// ─── 8. Birleşik Ürün Satış (Merge) ──────────────────

export const fetchBirlesikUrunSatislari = async (rrcId, startDate, endDate) => {
  const [paket, salon] = await Promise.all([
    fetchPaketUrunSatislari(rrcId, startDate, endDate),
    fetchSalonUrunSatislari(rrcId, startDate, endDate)
  ]);
  
  const merged = {};
  
  // Paket ürünleri ekle
  paket.urunListesi.forEach(u => {
    if (!merged[u.urunadi]) merged[u.urunadi] = { miktar: 0, ciro: 0, paketMiktar: 0, salonMiktar: 0 };
    merged[u.urunadi].miktar += u.miktar;
    merged[u.urunadi].ciro += u.ciro;
    merged[u.urunadi].paketMiktar += u.miktar;
  });
  
  // Salon ürünleri ekle
  salon.urunListesi.forEach(u => {
    if (!merged[u.urunadi]) merged[u.urunadi] = { miktar: 0, ciro: 0, paketMiktar: 0, salonMiktar: 0 };
    merged[u.urunadi].miktar += u.miktar;
    merged[u.urunadi].ciro += u.ciro;
    merged[u.urunadi].salonMiktar += u.miktar;
  });
  
  const birlesikListe = Object.entries(merged)
    .map(([urunadi, val]) => ({ urunadi, ...val }))
    .sort((a, b) => b.miktar - a.miktar);
  
  return {
    paket,
    salon,
    birlesikListe,
    toplamMiktar: birlesikListe.reduce((s, u) => s + u.miktar, 0)
  };
};

// ─── 9. Konsolide Rapor (Tüm Veriler) ────────────────

export const fetchKonsolideRapor = async (rrcId, startDate, endDate) => {
  const [paketCiro, masaCiro, paketIptal, masaIptal, urunSatis] = await Promise.all([
    fetchPaketAdisyonlar(rrcId, startDate, endDate),
    fetchMasaOdemeleri(rrcId, startDate, endDate),
    fetchPaketIptalAdisyonlar(rrcId, startDate, endDate),
    fetchMasaOdemeIptalleri(rrcId, startDate, endDate),
    fetchBirlesikUrunSatislari(rrcId, startDate, endDate)
  ]);
  
  const toplamCiro = paketCiro.toplamCiro + masaCiro.toplamCiro;
  const toplamIptal = paketIptal.toplamIptal + masaIptal.toplamIptal;
  const netCiro = toplamCiro - toplamIptal;
  
  return {
    paketCiro,
    masaCiro,
    paketIptal,
    masaIptal,
    urunSatis,
    toplamCiro,
    toplamIptal,
    netCiro
  };
};
