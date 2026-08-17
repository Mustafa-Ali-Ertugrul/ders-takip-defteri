/* ============================================================
   2) STATE & STORAGE  (studies / dersler / haftalık hedef)
   localStorage anahtarları:
     dersTakipStudies  — çalışma kayıtları
     dersTakipSubjects — ders listesi [{ad, renk}]
     dersTakipGoal     — haftalık hedef (dakika)
   İlk açılışta ders listesi ve hedef bir kez tohumlanır; mevcut
   kayıtlardaki ders adları da listeye eklenir (idempotent).
   Önemli: bootstrap(), app.js init() içinden çağrılır — böylece
   toast() (ui.js) tanımlı olduğunda çalışır.
============================================================ */
let dersler    = [];   // [{ad, renk}] — bootstrap doldurur
let weeklyGoal = WEEKLY_GOAL;
let studies    = [];
let editId     = null;

/* ---------- ders listesi & hedef: okuma ---------- */
function loadDersler(){
  try {
    const ham = localStorage.getItem(SUBJECTS_KEY);
    if (ham === null) return null;            // anahtar yok → tohumlanacak
    return sanitizeSubjects(JSON.parse(ham));
  } catch (e) {
    return sanitizeSubjects(null);            // bozuk JSON → varsayılanlar
  }
}
function loadHedef(){
  try {
    const ham = localStorage.getItem(GOAL_KEY);
    if (ham === null) return null;
    return sanitizeGoal(JSON.parse(ham));
  } catch (e) {
    return null;
  }
}

/* ---------- ders listesi & hedef: yazma ---------- */
function saveDersler(liste){
  try { localStorage.setItem(SUBJECTS_KEY, JSON.stringify(liste)); }
  catch (e) { toast('Ders listesi kaydedilemedi! Depo dolu olabilir.', 'danger'); }
}
function saveGoalValue(dk){
  try { localStorage.setItem(GOAL_KEY, JSON.stringify(dk)); }
  catch (e) { toast('Hedef kaydedilemedi! Depo dolu olabilir.', 'danger'); }
}

/* ---------- idempotent tohumlama ----------
   Ders anahtarı yoksa varsayılanlarla başlar; kayıtlarda geçen ders
   adlarını listeye ekler (önceden eklenen özel dersler kaybolmaz).
   Hedef anahtarı yoksa 300 dk yazar. Kayıtlar, ders listesi hazır
   olduktan sonra okunur — böylece eski kayıtlardaki özel ders adları
   yanlışlıkla 'Diğer'e düşmez. */
function bootstrap(){
  let yaz = false;
  let liste = loadDersler();
  if (liste === null) { liste = DERSLER.map(d => ({ ad: d.ad, renk: d.renk })); yaz = true; }

  // Kayıtlardaki ders adlarını topla (ham okuma: henüz filtre uygulamıyoruz)
  let adlar = [];
  try {
    const ham = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (Array.isArray(ham)) adlar = ham.map(k => (k && typeof k === 'object') ? k.ders : null);
  } catch (e) { adlar = []; }

  const genisleyen = extendSubjects(liste, adlar);
  dersler = genisleyen.liste;
  if (yaz || genisleyen.eklenen > 0) saveDersler(dersler);

  const hedef = loadHedef();
  if (hedef === null) { saveGoalValue(weeklyGoal); } else weeklyGoal = hedef;

  studies = getStudies();
}

/* ---------- kayıtlar ---------- */
function getStudies(){
  try {
    // Okuma katmanı: bozuk JSON → [], geçersiz kayıtlar temizlenir (parseStudies).
    // Beyaz liste olarak GÜNCEL ders listesi kullanılır (özel dersler korunur).
    return parseStudies(localStorage.getItem(STORAGE_KEY), { dersler });
  } catch (e) {
    console.warn('Depo okunamadı:', e);
    return [];
  }
}
function saveStudies(list){
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    toast('Kaydedilemedi! Depo dolu olabilir.', 'danger');
  }
}

/* ---------- dinamik renk bakışı ---------- */
function renkOf(ad){
  const d = dersler.find(x => x.ad === ad);
  return d ? d.renk : RENK_DIGER;
}
