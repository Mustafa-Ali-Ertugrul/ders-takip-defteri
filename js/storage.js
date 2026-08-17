/* ============================================================
   2) STATE & STORAGE  (getStudies / saveStudies)
============================================================ */
let studies = getStudies();
let editId  = null;

function getStudies(){
  try {
    // Okuma katmanı: bozuk JSON → [], geçersiz kayıtlar temizlenir (parseStudies)
    return parseStudies(localStorage.getItem(STORAGE_KEY));
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

