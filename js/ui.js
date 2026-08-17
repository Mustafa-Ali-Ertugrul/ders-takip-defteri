/* ============================================================
   4) RENDER & ANALİTİK
============================================================ */
function getVisibleList(){
  const f    = $('filterDers').value;
  const q    = $('searchInput').value.trim().toLocaleLowerCase('tr');
  const sort = $('sortSelect').value;

  let list = studies.filter(s =>
    (!f || s.ders === f) &&
    (!q || (s.not || '').toLocaleLowerCase('tr').includes(q) ||
           s.ders.toLocaleLowerCase('tr').includes(q))
  );
  list.sort((a,b) => {
    if (sort === 'sure') return b.sure - a.sure;
    if (sort === 'ders') return a.ders.localeCompare(b.ders, 'tr');
    return b.tarih.localeCompare(a.tarih) || (b.createdAt || 0) - (a.createdAt || 0);
  });
  return list;
}

function renderTable(){
  const list  = getVisibleList();
  const tbody = $('studyTbody');

  if (!list.length) {
    tbody.innerHTML = '';
    $('studyTable').style.display = 'none';
    $('emptyState').hidden = false;
    $('emptyText').textContent = studies.length
      ? 'Bu filtreyle eşleşen kayıt yok… ✎'
      : 'Henüz kayıt yok — ilk çalışmanı ekleyerek başla! ✍';
  } else {
    $('studyTable').style.display = '';
    $('emptyState').hidden = true;
    tbody.innerHTML = list.map((s,i) => `
      <tr style="--i:${i}">
        <td title="${esc(s.tarih)}">${fmtTarih(s.tarih)}</td>
        <td><span class="badge" style="--c:${renkMap[s.ders] || '#7a8499'}"><i></i>${esc(s.ders)}</span></td>
        <td class="dur">${fmtSure(s.sure)}</td>
        <td class="not hide-sm">${s.not ? esc(s.not) : '—'}</td>
        <td><div class="acts">
          <button class="icon-btn edit" data-action="edit" data-id="${esc(s.id)}" title="Düzenle">✎</button>
          <button class="icon-btn del"  data-action="del"  data-id="${esc(s.id)}" title="Sil">✕</button>
        </div></td>
      </tr>`).join('');
  }

  const toplam = studies.reduce((t,s) => t + Number(s.sure), 0);
  $('rowCount').textContent =
    `${list.length} kayıt gösteriliyor · toplam ${fmtSure(toplam)}`;
}

function updateStatistics(){
  // Toplam süre
  const total = studies.reduce((t,s) => t + Number(s.sure), 0);
  animateSure($('statTotal'), total);
  $('statTotalNote').textContent = studies.length
    ? `${studies.length} oturumda tamamlandı` : 'henüz kayıt yok';

  // Bu hafta (Pazartesi'den itibaren)
  const pzt = new Date(); pzt.setHours(0,0,0,0);
  pzt.setDate(pzt.getDate() - ((pzt.getDay() + 6) % 7));
  const hafta = studies
    .filter(s => new Date(s.tarih + 'T00:00') >= pzt)
    .reduce((t,s) => t + Number(s.sure), 0);
  $('statWeek').textContent = fmtSure(hafta);
  $('weekFill').style.width = Math.min(100, hafta / WEEKLY_GOAL * 100) + '%';
  $('weekNote').textContent = hafta >= WEEKLY_GOAL
    ? 'hedef tamam, süpersin! 🏆'
    : `hedef ${fmtSure(WEEKLY_GOAL)} · %${Math.round(hafta / WEEKLY_GOAL * 100)}`;

  // En sık ders (oturum sayısı + dakika)
  const map = {};
  studies.forEach(s => {
    map[s.ders] ??= { adet:0, dk:0 };
    map[s.ders].adet++; map[s.ders].dk += Number(s.sure);
  });
  const top = Object.entries(map).sort((a,b) => b[1].adet - a[1].adet)[0];
  $('statTop').textContent     = top ? top[0] : '—';
  $('statTop').style.color     = top ? (renkMap[top[0]] || 'inherit') : 'inherit';
  $('statTopNote').textContent = top ? `${top[1].adet} oturum · ${fmtSure(top[1].dk)}` : 'veri bekleniyor';

  // Seri (üst üste çalışılan gün)
  const gunler = new Set(studies.map(s => s.tarih));
  let seri = 0, d = new Date();
  if (!gunler.has(toISO(d))) d.setDate(d.getDate() - 1);
  while (gunler.has(toISO(d))) { seri++; d.setDate(d.getDate() - 1); }
  $('statStreak').textContent     = `${seri} gün`;
  $('statStreakNote').textContent = seri >= 3 ? 'seriyi bozma! 🔥' : 'her gün az da olsa ✍';

  // Ders dağılım barı
  const entries = Object.entries(map).sort((a,b) => b[1].dk - a[1].dk);
  $('distBar').innerHTML = entries.map(([ad,v]) =>
    `<div class="dist-seg" data-w="${total ? v.dk/total*100 : 0}"
          style="background:${renkMap[ad] || '#7a8499'}" title="${esc(ad)}"></div>`).join('');
  requestAnimationFrame(() =>
    document.querySelectorAll('.dist-seg').forEach(el => el.style.width = el.dataset.w + '%'));
  $('distLegend').innerHTML = entries.map(([ad,v]) =>
    `<span style="--c:${renkMap[ad] || '#7a8499'}"><i></i>${esc(ad)}
      <em>${fmtSure(v.dk)} · %${total ? Math.round(v.dk/total*100) : 0}</em></span>`).join('')
    || '<em>Henüz veri yok.</em>';
}

function refreshFilterOptions(){
  const sel = $('filterDers'), aktif = sel.value;
  const dersler = [...new Set(studies.map(s => s.ders))].sort((a,b) => a.localeCompare(b,'tr'));
  sel.innerHTML = '<option value="">Tümü</option>' +
    dersler.map(d => `<option value="${esc(d)}">${esc(d)}</option>`).join('');
  sel.value = aktif;
}

function renderAll(){ renderTable(); updateStatistics(); refreshFilterOptions(); }

/* ============================================================
   MODAL, TOAST, DİĞER ETKİLEŞİMLER
============================================================ */
function openModal(){
  $('overlay').classList.add('open');
  $('overlay').setAttribute('aria-hidden','false');
  document.body.classList.add('modal-open');
  setTimeout(() => $('inputSure').focus(), 120);
}
function closeModal(){
  $('overlay').classList.remove('open');
  $('overlay').setAttribute('aria-hidden','true');
  document.body.classList.remove('modal-open');
  $('studyForm').reset();
  $('formError').textContent = '';
  editId = null;
  $('modalTitle').textContent = 'Çalışma Ekle ✎';
  $('btnSubmit').textContent  = 'Kaydet';
}
function formHatasi(msg){
  $('formError').textContent = msg;
  const m = document.querySelector('.modal');
  m.classList.remove('shake'); void m.offsetWidth; m.classList.add('shake');
}
function toast(msg, tip = 'success'){
  const t = document.createElement('div');
  t.className = `toast ${tip}`;
  t.textContent = msg;
  $('toasts').appendChild(t);
  setTimeout(() => t.remove(), 3000);
}
function animateSure(el, hedef){
  const bas = el._val || 0, t0 = performance.now(), sure = 600;
  function adim(t){
    const p = Math.min(1, (t - t0) / sure), e = 1 - Math.pow(1 - p, 3);
    el.textContent = fmtSure(Math.round(bas + (hedef - bas) * e));
    if (p < 1) requestAnimationFrame(adim); else el._val = hedef;
  }
  requestAnimationFrame(adim);
}

