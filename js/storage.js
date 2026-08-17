/* ============================================================
   2) STATE & STORAGE  (getStudies / saveStudies)
============================================================ */
let studies = getStudies();
let editId  = null;

function getStudies(){
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
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

