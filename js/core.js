/* ============================================================
   1) SABİTLER ve YARDIMCILAR
============================================================ */
const STORAGE_KEY  = 'dersTakipStudies';
const SUBJECTS_KEY = 'dersTakipSubjects'; // M6: özel ders listesi [{ad, renk}]
const GOAL_KEY     = 'dersTakipGoal';     // M6: haftalık hedef (dakika)
const WEEKLY_GOAL  = 300; // dk (5 saat) — varsayılan haftalık hedef
const RENK_DIGER   = '#7a8499';
/* Özel dersler için 8 renkli palet; renk tükenince başa döner (M6) */
const PALET = ['#2f6fd0','#2f9e63','#e2802e','#9a5fd0','#5aa02f','#0f9ba8','#c0563f','#d65a86'];
const DERSLER = [
  { ad:'Matematik', renk:'#2f6fd0' }, { ad:'Yazılım',    renk:'#2f9e63' },
  { ad:'Fizik',     renk:'#e2802e' }, { ad:'Kimya',      renk:'#9a5fd0' },
  { ad:'Biyoloji',  renk:'#5aa02f' }, { ad:'İngilizce',  renk:'#0f9ba8' },
  { ad:'Tarih',     renk:'#c0563f' }, { ad:'Edebiyat',   renk:'#d65a86' },
  { ad:'Diğer',     renk:RENK_DIGER }
];
const renkMap = Object.fromEntries(DERSLER.map(d => [d.ad, d.renk]));

const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2,'0');
const toISO = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function fmtSure(min){
  min = Number(min) || 0;
  const s = Math.floor(min/60), d = min % 60;
  if (s && d) return `${s} sa ${d} dk`;
  if (s)      return `${s} sa`;
  return `${d} dk`;
}
function fmtTarih(iso){
  const bugun = toISO(new Date());
  const dun   = toISO(new Date(Date.now() - 864e5));
  if (iso === bugun) return 'Bugün';
  if (iso === dun)   return 'Dün';
  return new Date(iso + 'T00:00').toLocaleDateString('tr-TR',
    { day:'numeric', month:'long', weekday:'long' });
}


/* ============================================================
   1b) SAF (TEST EDİLEBİLİR) YARDIMCILAR
   Parametreli fonksiyonlar — DOM/depo kullanmaz, birim testlenir.
============================================================ */
function sortStudies(list, mode){
  return list.slice().sort((a,b) => {
    if (mode === 'sure') return b.sure - a.sure;
    if (mode === 'ders') return a.ders.localeCompare(b.ders, 'tr');
    return b.tarih.localeCompare(a.tarih) || (b.createdAt || 0) - (a.createdAt || 0);
  });
}

function getVisibleStudies(list, opts){
  opts = opts || {};
  const f = opts.f || '';
  const q = (opts.q || '').trim().toLocaleLowerCase('tr');
  const sort = opts.sort || 'tarih';
  return sortStudies(list.filter(s =>
    (!f || s.ders === f) &&
    (!q || (s.not || '').toLocaleLowerCase('tr').includes(q) ||
           s.ders.toLocaleLowerCase('tr').includes(q))
  ), sort);
}

/* Tekil kayıt temizleyici: ders whitelist -> 'Diğer', süre/tarih/id/not/createdAt
   düzeltme; süre/tarih geçersizse null döndürür (kayıt dışarı atılır). */
function sanitizeStudy(raw, dersSet, bugun){
  if (!raw || typeof raw !== 'object') return null;
  const ders = dersSet.has(raw.ders) ? raw.ders : 'Diğer';
  const sure = Math.round(Number(raw.sure));
  const tarihD = typeof raw.tarih === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.tarih)
    ? new Date(raw.tarih + 'T00:00') : null;
  // Geçerlilik: gerçek bir tarih olmalı (yuvarlama yok: 2026-02-30 reddedilir) ve gelecekte olmamalı
  const tarih = tarihD && !isNaN(tarihD.getTime()) && toISO(tarihD) === raw.tarih
    && raw.tarih <= bugun ? raw.tarih : '';
  if (!sure || sure < 1 || sure > 1440 || !tarih) return null;
  return {
    id:        typeof raw.id === 'string' && raw.id ? raw.id : uid(),
    ders, sure, tarih,
    not:       typeof raw.not === 'string' ? raw.not.slice(0, 120) : '',
    createdAt: Number(raw.createdAt) || new Date(tarih + 'T00:00').getTime()
  };
}

/* Kayıt listesi temizleyici (import'tan gelen ham veri; M3'te okuma yoluna da girer) */
function sanitizeStudies(data, opts){
  opts = opts || {};
  const bugun = opts.bugun || toISO(new Date());
  const dersler = opts.dersler || DERSLER;
  const dersSet = new Set(dersler.map(d => d.ad));
  const seen = new Set();
  const out = [];
  if (!Array.isArray(data)) return out;
  for (const raw of data) {
    const s = sanitizeStudy(raw, dersSet, bugun);
    if (!s) continue;
    if (seen.has(s.id)) continue; // aynı id yalnızca ilk geçer
    seen.add(s.id);
    out.push(s);
  }
  return out;
}

/* Ham depo/JSON metnini çözüp temizleyen okuma katmanı.
   Bozuk JSON → boş liste; geçerli veri sanitize edilir. */
function parseStudies(rawText, opts){
  if (!rawText) return [];
  let data;
  try { data = JSON.parse(rawText); }
  catch (e) { return []; }
  return sanitizeStudies(data, opts);
}

/* Form girişini doğrular; hatalıysa kullanıcı mesajını, temizse null döndürür */
function validateStudy(input, bugun){
  if (!input.ders)   return 'Bir ders seçmelisin. ✏';
  const sure = Number(input.sure);
  if (!sure || sure < 1 || sure > 1440) return 'Süre 1–1440 dakika aralığında olmalı.';
  if (!input.tarih)  return 'Tarih seçmeyi unuttun.';
  if (input.tarih > bugun) return 'Gelecek bir tarihe kayıt eklenemez.';
  return null;
}

/* Analitik: liste + referans "bugün" tarihinden tüm istatistikleri üretir */
function hesaplaIstatistik(list, now){
  now = now === undefined ? new Date() : now;
  const total = list.reduce((t,s) => t + Number(s.sure), 0);

  const pzt = new Date(now); pzt.setHours(0,0,0,0);
  pzt.setDate(pzt.getDate() - ((pzt.getDay() + 6) % 7));
  const hafta = list
    .filter(s => new Date(s.tarih + 'T00:00') >= pzt)
    .reduce((t,s) => t + Number(s.sure), 0);

  const dersMap = {};
  list.forEach(s => {
    if (!dersMap[s.ders]) dersMap[s.ders] = { adet:0, dk:0 };
    dersMap[s.ders].adet++; dersMap[s.ders].dk += Number(s.sure);
  });
  const top = Object.entries(dersMap).sort((a,b) => b[1].adet - a[1].adet)[0] || null;

  const gunler = new Set(list.map(s => s.tarih));
  let seri = 0, d = new Date(now);
  if (!gunler.has(toISO(d))) d.setDate(d.getDate() - 1);
  while (gunler.has(toISO(d))) { seri++; d.setDate(d.getDate() - 1); }

  const entries = Object.entries(dersMap).sort((a,b) => b[1].dk - a[1].dk);
  return { total, hafta, top, seri, entries };
}

/* color-mix yerine: hex rengi beyaza doğru "oran" kadar kaydırır */
function mixWithWhite(hex, oran){
  const m = /^#([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return '#ffffff';
  const or = Math.min(1, Math.max(0, Number(oran) || 0));
  const n = parseInt(m[1], 16);
  const mix = ch => Math.round(ch + (255 - ch) * or);
  const r = mix((n >> 16) & 255), g = mix((n >> 8) & 255), b = mix(n & 255);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

/* ============================================================
   1c) M6 — DERS LİSTESİ ve HEDEF YARDIMCILARI (saf, test edilebilir)
============================================================ */

/* #rrggbb biçiminde geçerli bir renk mi? */
function renkGecerliMi(v){
  return typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
}

/* Ders listesine yeni adlar ekler; mevcutları (büyük/küçük harf duyarsız)
   atlar, yenilere paletten sırayla renk verir. { liste, eklenen } döner.
   Kaynak liste kopyalanır — girdi değiştirilmez. */
function extendSubjects(dersler, adlar){
  const liste = (dersler || []).map(d => ({ ad: d.ad, renk: d.renk }));
  const varMi = new Set(liste.map(d => d.ad.toLocaleLowerCase('tr')));
  let eklenen = 0;
  for (const ham of (adlar || [])) {
    if (typeof ham !== 'string') continue;
    const ad = ham.trim();
    if (!ad || ad.length > 50) continue;
    const anahtar = ad.toLocaleLowerCase('tr');
    if (varMi.has(anahtar)) continue;
    varMi.add(anahtar);
    liste.push({ ad, renk: PALET[liste.length % PALET.length] });
    eklenen++;
  }
  return { liste, eklenen };
}

/* Depodan gelen ders listesini temizler: geçersiz adlar/renkler elenir,
   yinelenenler atlanır, renk paletten tamamlanır ve 'Diğer' her zaman
   bulunur (sanitizeStudy'nin bilinmeyen ders yedeği). Liste boş/geçersizse
   varsayılan DERSLER döner. */
function sanitizeSubjects(raw){
  let liste = DERSLER.map(d => ({ ad: d.ad, renk: d.renk }));
  if (Array.isArray(raw)) {
    const temiz = [];
    const varMi = new Set();
    for (const it of raw) {
      if (!it || typeof it !== 'object') continue;
      const ad = typeof it.ad === 'string' ? it.ad.trim() : '';
      if (!ad || ad.length > 50) continue;
      const anahtar = ad.toLocaleLowerCase('tr');
      if (varMi.has(anahtar)) continue;
      varMi.add(anahtar);
      const renk = renkGecerliMi(it.renk) ? it.renk : PALET[temiz.length % PALET.length];
      temiz.push({ ad, renk });
    }
    if (temiz.length) liste = temiz;
  }
  if (!liste.some(d => d.ad === 'Diğer'))
    liste = liste.concat([{ ad: 'Diğer', renk: RENK_DIGER }]);
  return liste;
}

/* Yeni ders adını doğrular: boş değil, en çok 50 karakter, benzersiz
   (Türkçe büyük/küçük harf duyarsız). { hata, ad } döner. */
function validateSubjectName(ad, mevcut){
  const temiz = String(ad ?? '').trim();
  if (!temiz) return { hata: 'Ders adı boş olamaz.', ad: '' };
  if (temiz.length > 50)
    return { hata: 'Ders adı en fazla 50 karakter olabilir.', ad: temiz };
  const anahtar = temiz.toLocaleLowerCase('tr');
  if ((mevcut || []).some(m => m.ad.toLocaleLowerCase('tr') === anahtar))
    return { hata: `"${temiz}" adında bir ders zaten var.`, ad: temiz };
  return { hata: null, ad: temiz };
}

/* Haftalık hedefi doğrular: 30–3000 dakika arası tamsayı; değilse null. */
function sanitizeGoal(raw){
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n) || n < 30 || n > 3000) return null;
  return n;
}

/* Node birim testleri için dışa aktarım (tarayıcıda çalışırken etkisizdir) */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { STORAGE_KEY, SUBJECTS_KEY, GOAL_KEY, WEEKLY_GOAL, RENK_DIGER, PALET,
    DERSLER, renkMap, $, pad, toISO, uid, esc,
    fmtSure, fmtTarih, sortStudies, getVisibleStudies, sanitizeStudy, sanitizeStudies,
    parseStudies, validateStudy, hesaplaIstatistik, mixWithWhite,
    renkGecerliMi, extendSubjects, sanitizeSubjects, validateSubjectName, sanitizeGoal };
}
