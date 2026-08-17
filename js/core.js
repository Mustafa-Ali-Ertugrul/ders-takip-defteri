/* ============================================================
   1) SABİTLER ve YARDIMCILAR
============================================================ */
const STORAGE_KEY  = 'dersTakipStudies';
const WEEKLY_GOAL  = 300; // dk (5 saat)
const DERSLER = [
  { ad:'Matematik', renk:'#2f6fd0' }, { ad:'Yazılım',    renk:'#2f9e63' },
  { ad:'Fizik',     renk:'#e2802e' }, { ad:'Kimya',      renk:'#9a5fd0' },
  { ad:'Biyoloji',  renk:'#5aa02f' }, { ad:'İngilizce',  renk:'#0f9ba8' },
  { ad:'Tarih',     renk:'#c0563f' }, { ad:'Edebiyat',   renk:'#d65a86' },
  { ad:'Diğer',     renk:'#7a8499' }
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

