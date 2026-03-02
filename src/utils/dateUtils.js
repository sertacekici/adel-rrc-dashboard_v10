/**
 * Tarih yönetimi için yardımcı fonksiyonlar.
 * Firestore Timestamp, ISO String ve SQL formatlarını güvenli bir şekilde işler.
 * Tüm tarih hesaplamaları TR saat dilimine (Europe/Istanbul, UTC+3) göre yapılır.
 */

/**
 * Verilen Date objesini TR saat dilimine göre 'YYYY-MM-DD' stringine çevirir.
 * Parametre verilmezse şu anki tarihi döner.
 */
export const todayTR = (date) => {
  const d = date || new Date();
  return d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });
};

/**
 * TR saat diliminde "bugün"den belirtilen gün kadar öncesini 'YYYY-MM-DD' olarak döner.
 */
export const daysAgoTR = (n) => {
  const d = new Date(Date.now() - n * 86400000);
  return todayTR(d);
};

/**
 * Herhangi bir tarih formatını ISO 'YYYY-MM-DD' stringine dönüştürür.
 * TR saat dilimine göre çalışır.
 */
export const normalizeDateStr = (val) => {
  if (!val) return '';
  
  // Firestore Timestamp kontrolü
  if (val && typeof val === 'object' && typeof val.toDate === 'function') {
    const d = val.toDate();
    return isNaN(d?.getTime?.()) ? '' : todayTR(d);
  }
  
  const s = String(val);
  if (s.includes('T')) return s.split('T')[0];
  if (s.includes(' ')) return s.split(' ')[0];
  
  // Yalnız tarih geldiyse (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  
  // Diğer durumlar için parse denemesi
  const d = new Date(s.replace(' ', 'T'));
  return isNaN(d.getTime()) ? '' : todayTR(d);
};

/**
 * Karışık tarih değerini güvenli bir şekilde Date objesine çevirir.
 */
export const toDate = (val) => {
  if (!val) return null;
  
  if (val && typeof val === 'object' && typeof val.toDate === 'function') {
    const d = val.toDate();
    return isNaN(d?.getTime?.()) ? null : d;
  }
  
  const s = String(val);
  // Safari uyumluluğu için boşluğu T ile değiştir
  const iso = s.includes('T') ? s : s.includes(' ') ? s.replace(' ', 'T') : s;
  const d = new Date(iso);
  
  return isNaN(d.getTime()) ? null : d;
};

/**
 * Tarihi TR lokaline göre formatlar.
 */
export const formatDateTime = (val, options = {}) => {
  const d = toDate(val);
  if (!d) return '-';
  
  const defaultOptions = { 
    year: 'numeric', 
    month: '2-digit', 
    day: '2-digit', 
    hour: '2-digit', 
    minute: '2-digit' 
  };
  
  return d.toLocaleString('tr-TR', { ...defaultOptions, ...options });
};

/**
 * Para birimi formatlar.
 */
export const formatCurrency = (n) => {
  return (Number(n) || 0).toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + ' ₺';
};
