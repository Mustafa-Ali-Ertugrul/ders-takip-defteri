/* ============================================================
   3) CRUD — Add or Update akışı
============================================================ */
function saveStudy(e){
  e.preventDefault();
  const dersEl = document.querySelector('input[name="ders"]:checked');
  const ders   = dersEl ? dersEl.value : '';
  const sure   = Number($('inputSure').value);
  const tarih  = $('inputDate').value;
  const not    = $('inputNote').value.trim();

  // Ön validasyon — saf çekirdek (validateStudy) ile tek noktadan
  const hata = validateStudy({ ders, sure, tarih }, toISO(new Date()));
  if (hata) return formHatasi(hata);

  if (editId) {
    // GÜNCELLEME
    const idx = studies.findIndex(s => s.id === editId);
    if (idx > -1) studies[idx] = { ...studies[idx], ders, sure, tarih, not };
    toast('Kayıt güncellendi ✔', 'success');
  } else {
    // EKLEME
    studies.push({ id: uid(), ders, sure, tarih, not, createdAt: Date.now() });
    toast('Çalışma eklendi 🎉', 'success');
  }

  saveStudies(studies);
  closeModal();
  renderAll();
}

function editStudy(id){
  const s = studies.find(x => x.id === id);
  if (!s) return;
  openModal();
  // Güvenli seçici: attribute selector yerine value karşılaştırması (özel ders adı tırnak/özel
  // karakter içeremez ama querySelector'da CSS escape riskini sıfırlar)
  const radio = Array.from(document.querySelectorAll('input[name="ders"]'))
    .find(r => r.value === s.ders);
  if (radio) radio.checked = true;
  $('inputSure').value = s.sure;
  $('inputDate').value = s.tarih;
  $('inputNote').value = s.not || '';
  editId = id;
  $('modalTitle').textContent = 'Çalışmayı Düzenle ✏';
  $('btnSubmit').textContent  = 'Güncelle';
}

function deleteStudy(id){
  const idx = studies.findIndex(x => x.id === id);
  if (idx === -1) return;
  // Onay yok: anında silinir, 7 sn boyunca "Geri Al" ile kurtarılabilir.
  const [kayit] = studies.splice(idx, 1);
  if (editId === id) closeModal();
  saveStudies(studies);
  renderAll();
  toast(`"${kayit.ders} · ${fmtSure(kayit.sure)}" silindi.`, 'danger', {
    duration: 7000,
    actionLabel: 'Geri Al',
    action: () => {
      studies.splice(Math.min(idx, studies.length), 0, kayit);
      saveStudies(studies);
      renderAll();
      toast('Kayıt geri alındı ↩', 'success');
    }
  });
}

/* Yedekten geri yükleme — her alanı tekrar doğrulayarak temizle,
   sonra Değiştir / Birleştir tercihini uygulama içi modalda sor. */
let importBekleyen = null; // modal onayına kadar bekleyen temizlenmiş kayıt listesi

function importStudies(event){
  const file = event.target.files[0];
  event.target.value = '';
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    let data;
    try { data = JSON.parse(reader.result); }
    catch (e) { return toast('Geçersiz dosya — bu JSON yedeği değil.', 'danger'); }

    if (!Array.isArray(data))
      return toast('Dosya biçimi hatalı — kayıt listesi (dizi) bekleniyordu.', 'danger');

    // Kayıt temizliği saf çekirdeğe emanet: ders beyaz listesi, süre/tarih sınırı, tekil id
    const temiz = sanitizeStudies(data);
    if (!temiz.length) return toast('Yedek dosyasında geçerli kayıt bulunamadı.', 'danger');

    importBekleyen = temiz;
    $('importInfo').textContent = `Dosyada ${temiz.length} geçerli kayıt bulundu. ` +
      `"Değiştir" mevcut ${studies.length} kaydın yerine yazar, ` +
      `"Birleştir" ekler (aynı kimlikli kayıtlar atlanır).`;
    openImportModal();
  };
  reader.readAsText(file);
}

function importUygula(mod){
  const temiz = importBekleyen;
  importBekleyen = null;
  closeImportModal();
  if (!temiz) return;

  if (mod === 'birlestir'){
    const mevcut = new Set(studies.map(s => s.id));
    const yeniler = temiz.filter(r => !mevcut.has(r.id));
    if (!yeniler.length)
      return toast('Tüm kayıtlar zaten mevcut — eklenecek yeni kayıt yok.', 'danger');
    studies.push(...yeniler);
    saveStudies(studies);
    renderAll();
    toast(`${yeniler.length} kayıt birleştirildi ✔`, 'success');
  } else { // degistir
    studies = temiz;
    saveStudies(studies);
    renderAll();
    toast(`${temiz.length} kayıt geri yüklendi ✔`, 'success');
  }
}

function importIptal(){
  importBekleyen = null;
  closeImportModal();
}

/* ---------- başlangıç kurulumu ---------- */
function init(){
  // Ders çipleri
  $('dersChips').innerHTML = DERSLER.map((d,i) => `
    <input type="radio" name="ders" id="ders-${i}" value="${d.ad}">
    <label for="ders-${i}" style="--c:${d.renk}">${d.ad}</label>`).join('');

  // Bugünün tarihi
  const bugun = toISO(new Date());
  $('inputDate').value = bugun;
  $('inputDate').max   = bugun;
  $('dateStamp').textContent = new Date().toLocaleDateString('tr-TR',
    { weekday:'long', day:'numeric', month:'long' });

  // Havada süzülen karalamalar
  const semboller = ['∑','π','√','∞','ƒ(x)','÷','Δ','%','✎','?','∫','x²'];
  for (let i = 0; i < 12; i++) {
    const s = document.createElement('span');
    s.className = 'doodle';
    s.textContent = semboller[i % semboller.length];
    s.style.left = Math.random() * 96 + '%';
    s.style.top  = Math.random() * 92 + '%';
    s.style.fontSize = (18 + Math.random() * 30) + 'px';
    s.style.setProperty('--dur',   (9 + Math.random() * 8) + 's');
    s.style.setProperty('--delay', (-Math.random() * 8) + 's');
    $('doodles').appendChild(s);
  }

  // Olay bağlantıları
  $('btnAdd').addEventListener('click', openModal);
  $('btnClose').addEventListener('click', closeModal);
  $('btnCancel').addEventListener('click', closeModal);
  $('overlay').addEventListener('click', e => { if (e.target === $('overlay')) closeModal(); });
  $('importOverlay').addEventListener('click', e => { if (e.target === $('importOverlay')) importIptal(); });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if ($('overlay').classList.contains('open')) closeModal();
    if ($('importOverlay').classList.contains('open')) importIptal();
  });
  $('studyForm').addEventListener('submit', saveStudy);

  document.querySelectorAll('.mini-chip').forEach(c =>
    c.addEventListener('click', () => {
      $('inputSure').value = Math.min(1440, Math.max(1, (Number($('inputSure').value) || 0) + Number(c.dataset.min)));
    }));

  $('studyTbody').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    btn.dataset.action === 'edit' ? editStudy(btn.dataset.id) : deleteStudy(btn.dataset.id);
  });

  ['filterDers','sortSelect'].forEach(id => $(id).addEventListener('change', renderTable));
  $('searchInput').addEventListener('input', renderTable);

  $('btnExport').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(studies, null, 2)], { type:'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ders-takip-yedek.json';
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Yedek dosyası indirildi ⤓');
  });

  $('btnImport').addEventListener('click', () => $('fileImport').click());
  $('fileImport').addEventListener('change', importStudies);
  $('btnImportReplace').addEventListener('click', () => importUygula('degistir'));
  $('btnImportMerge').addEventListener('click', () => importUygula('birlestir'));
  $('btnImportCancel').addEventListener('click', importIptal);
  $('btnImportClose').addEventListener('click', importIptal);
}

/* DOMContentLoaded: sayfa açılır açılmaz tabloyu ve istatistikleri çiz */
document.addEventListener('DOMContentLoaded', () => { init(); renderAll(); });
