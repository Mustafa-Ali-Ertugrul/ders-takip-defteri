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

  // Ön validasyon
  if (!ders)                     return formHatasi('Bir ders seçmelisin. ✏');
  if (!sure || sure < 1 || sure > 1440)
                                 return formHatasi('Süre 1–1440 dakika aralığında olmalı.');
  if (!tarih)                    return formHatasi('Tarih seçmeyi unuttun.');
  if (tarih > toISO(new Date())) return formHatasi('Gelecek bir tarihe kayıt eklenemez.');

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
  const radio = document.querySelector(`input[name="ders"][value="${s.ders}"]`);
  if (radio) radio.checked = true;
  $('inputSure').value = s.sure;
  $('inputDate').value = s.tarih;
  $('inputNote').value = s.not || '';
  editId = id;
  $('modalTitle').textContent = 'Çalışmayı Düzenle ✏';
  $('btnSubmit').textContent  = 'Güncelle';
}

function deleteStudy(id){
  const s = studies.find(x => x.id === id);
  if (!s) return;
  const onay = confirm(`"${s.ders} · ${fmtSure(s.sure)}" kaydını siliyorum. Emin misin?`);
  if (!onay) return;
  studies = studies.filter(x => x.id !== id);
  if (editId === id) closeModal();
  saveStudies(studies);
  renderAll();
  toast('Kayıt silindi 🗑', 'danger');
}

/* Yedekten geri yükleme — her alanı tekrar doğrulayarak temizle */
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

    const dersAdlari = new Set(DERSLER.map(d => d.ad));
    const bugun = toISO(new Date());
    const temiz = [];

    for (const raw of data) {
      if (!raw || typeof raw !== 'object') continue;
      const ders = dersAdlari.has(raw.ders) ? raw.ders : 'Diğer';
      const sure = Math.round(Number(raw.sure));
      const tarih = typeof raw.tarih === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.tarih)
        && new Date(raw.tarih + 'T00:00').toString() !== 'Invalid Date'
        && raw.tarih <= bugun ? raw.tarih : '';
      if (!sure || sure < 1 || sure > 1440 || !tarih) continue;

      temiz.push({
        id:        typeof raw.id === 'string' && raw.id ? raw.id : uid(),
        ders, sure, tarih,
        not:       typeof raw.not === 'string' ? raw.not.slice(0, 120) : '',
        createdAt: Number(raw.createdAt) || new Date(tarih + 'T00:00').getTime()
      });
    }

    if (!temiz.length) return toast('Yedek dosyasında geçerli kayıt bulunamadı.', 'danger');

    const degisecek = (studies.length ? 'mevcut ' : '') + 'kayıtların';
    if (!confirm(`Yedekten ${temiz.length} kayıt yüklenecek ve ${degisecek} yerini alacak. Devam edilsin mi?`))
      return;

    studies = temiz;
    saveStudies(studies);
    renderAll();
    toast(`${temiz.length} kayıt geri yüklendi ✔`, 'success');
  };
  reader.readAsText(file);
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
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && $('overlay').classList.contains('open')) closeModal();
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
}

/* DOMContentLoaded: sayfa açılır açılmaz tabloyu ve istatistikleri çiz */
document.addEventListener('DOMContentLoaded', () => { init(); renderAll(); });
