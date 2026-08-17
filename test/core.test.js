// -*- coding: utf-8 -*-
/* js/core.js saf fonksiyonları için birim testleri.
   Çalıştırma: proje kökünden `node --test` */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../js/core.js');

const {
  pad, toISO, esc, fmtSure,
  sortStudies, getVisibleList, sanitizeStudy, sanitizeStudies,
  validateStudy, hesaplaIstatistik, mixWithWhite, uid
} = core;

/* ---------- temel yardımcılar ---------- */
test('pad: tek hane sıfır dolgulu', () => {
  assert.equal(pad(5), '05');
  assert.equal(pad(12), '12');
});

test('toISO: tarih ISO biçiminde', () => {
  assert.equal(toISO(new Date(2026, 0, 5)), '2026-01-05');
  assert.equal(toISO(new Date(2026, 7, 17)), '2026-08-17');
});

test('esc: HTML özel karakterleri kaçırılır', () => {
  assert.equal(esc('<b>"a"&\'b\'</b>'),
    '&lt;b&gt;&quot;a&quot;&amp;&#39;b&#39;&lt;/b&gt;');
  assert.equal(esc(null), '');
  assert.equal(esc(undefined), '');
});

test('uid: benzersiz üretilir', () => {
  const a = uid(), b = uid();
  assert.notEqual(a, b);
  assert.match(a, /^[a-z0-9]+$/);
});

/* ---------- fmtSure ---------- */
test('fmtSure uç değerleri', () => {
  assert.equal(fmtSure(0), '0 dk');
  assert.equal(fmtSure(45), '45 dk');
  assert.equal(fmtSure(60), '1 sa');
  assert.equal(fmtSure(90), '1 sa 30 dk');
  assert.equal(fmtSure(1440), '24 sa');
  assert.equal(fmtSure('75'), '1 sa 15 dk');   // dize girişi
  assert.equal(fmtSure(NaN), '0 dk');          // sayılamayan giriş
});

/* ---------- sortStudies ---------- */
const KAYITLAR = [
  { id:'a', ders:'Yazılım',   sure:60, tarih:'2026-08-10', createdAt:3 },
  { id:'b', ders:'Matematik', sure:25, tarih:'2026-08-15', createdAt:1 },
  { id:'c', ders:'Matematik', sure:25, tarih:'2026-08-15', createdAt:2 },
  { id:'d', ders:'Biyoloji',  sure:90, tarih:'2026-08-12', createdAt:4 },
];

test('sortStudies: tarih modu (yeni → eski), eşitse createdAt büyük önce', () => {
  const s = sortStudies(KAYITLAR, 'tarih');
  assert.deepEqual(s.map(x => x.id), ['c','b','d','a']);
});

test('sortStudies: süre modu (uzun → kısa)', () => {
  const s = sortStudies(KAYITLAR, 'sure');
  assert.deepEqual(s.map(x => x.id), ['d','a','b','c']);
});

test('sortStudies: ders modu (A → Z, tr)', () => {
  const s = sortStudies(KAYITLAR, 'ders');
  assert.equal(s[0].ders, 'Biyoloji');
  assert.equal(s[s.length - 1].ders, 'Yazılım');
});

test('sortStudies: orijinal dizi değişmez', () => {
  const kopya = [...KAYITLAR];
  sortStudies(KAYITLAR, 'sure');
  assert.deepEqual(KAYITLAR, kopya);
});

/* ---------- getVisibleList ---------- */
test('getVisibleList: ders filtresi', () => {
  const s = getVisibleList(KAYITLAR, { f:'Matematik' });
  assert.equal(s.length, 2);
  assert.ok(s.every(x => x.ders === 'Matematik'));
});

test('getVisibleList: arama (küçük i / büyük İ — Türkçe locale)', () => {
  assert.equal(getVisibleList(KAYITLAR, { q:'ingiliz' }).length, 0);
  const ing = [ ...KAYITLAR, { id:'e', ders:'İngilizce', sure:30, tarih:'2026-08-14' } ];
  assert.equal(getVisibleList(ing, { q:'ingilizce' }).length, 1);
  assert.equal(getVisibleList(ing, { q:'İNGİLİZCE' }).length, 1);
});

test('getVisibleList: filtre + arama + sırala birlikte', () => {
  const s = getVisibleList(KAYITLAR, { f:'Matematik', q:'mat', sort:'sure' });
  assert.equal(s.length, 2);
});

test('getVisibleList: boş opts ile varsayılan tarih sıralaması', () => {
  const s = getVisibleList(KAYITLAR);
  assert.deepEqual(s.map(x => x.id), ['c','b','d','a']);
});

/* ---------- sanitizeStudy ---------- */
const DERS_SETI = new Set(['Matematik','Yazılım','Diğer']);
const BUGUN = '2026-08-17';

test('sanitizeStudy: geçerli kayıt aynen temizlenir', () => {
  const s = sanitizeStudy({ id:'k1', ders:'Matematik', sure:45, tarih:'2026-08-10',
    not:'Türev', createdAt:111 }, DERS_SETI, BUGUN);
  assert.deepEqual(s, { id:'k1', ders:'Matematik', sure:45, tarih:'2026-08-10',
    not:'Türev', createdAt:111 });
});

test('sanitizeStudy: bilinmeyen ders → Diğer', () => {
  const s = sanitizeStudy({ ders:'Uydurma', sure:30, tarih:'2026-08-10' }, DERS_SETI, BUGUN);
  assert.equal(s.ders, 'Diğer');
});

test('sanitizeStudy: süre sınırları ve yuvarlama', () => {
  assert.equal(sanitizeStudy({ ders:'Matematik', sure:0, tarih:'2026-08-10' }, DERS_SETI, BUGUN), null);
  assert.equal(sanitizeStudy({ ders:'Matematik', sure:44.6, tarih:'2026-08-10' }, DERS_SETI, BUGUN).sure, 45);
  assert.equal(sanitizeStudy({ ders:'Matematik', sure:1440, tarih:'2026-08-10' }, DERS_SETI, BUGUN).sure, 1440);
  assert.equal(sanitizeStudy({ ders:'Matematik', sure:1441, tarih:'2026-08-10' }, DERS_SETI, BUGUN), null);
  assert.equal(sanitizeStudy({ ders:'Matematik', sure:'20x', tarih:'2026-08-10' }, DERS_SETI, BUGUN), null);
});

test('sanitizeStudy: tarih bozuk/gelecek/eksikse kayıt atılır', () => {
  assert.equal(sanitizeStudy({ ders:'Matematik', sure:10, tarih:'2099-12-31' }, DERS_SETI, BUGUN), null);
  assert.equal(sanitizeStudy({ ders:'Matematik', sure:10, tarih:'15.08.2026' }, DERS_SETI, BUGUN), null);
  assert.equal(sanitizeStudy({ ders:'Matematik', sure:10, tarih:'2026-02-30' }, DERS_SETI, BUGUN), null);
  assert.equal(sanitizeStudy({ ders:'Matematik', sure:10 }, DERS_SETI, BUGUN), null);
});

test('sanitizeStudy: id / not / createdAt düzeltmeleri', () => {
  const s = sanitizeStudy({ ders:'Matematik', sure:10, tarih:'2026-08-10', not:'x'.repeat(200) }, DERS_SETI, BUGUN);
  assert.equal(typeof s.id, 'string');
  assert.ok(s.id.length > 0);
  assert.equal(s.not.length, 120);                    // not 120 ile kırpılır
  assert.equal(s.createdAt, new Date('2026-08-10T00:00').getTime()); // createdAt türetilir
});

test('sanitizeStudy: nesone olmayan girişler atılır', () => {
  assert.equal(sanitizeStudy(null, DERS_SETI, BUGUN), null);
  assert.equal(sanitizeStudy('bozuk', DERS_SETI, BUGUN), null);
  assert.equal(sanitizeStudy(42, DERS_SETI, BUGUN), null);
});

/* ---------- sanitizeStudies ---------- */
test('sanitizeStudies: liste olmayan giriş → boş dizi', () => {
  assert.deepEqual(sanitizeStudies(null), []);
  assert.deepEqual(sanitizeStudies({}), []);
  assert.deepEqual(sanitizeStudies('x'), []);
});

test('sanitizeStudies: geçersizler elenir, geçerliler temizlenir', () => {
  const ham = [
    { id:'g1', ders:'Yazılım', sure:60, tarih:'2026-08-13' },
    { id:'g2', ders:'Uydurma', sure:9999, tarih:'2099-12-31' }, // süre + tarih bozuk
    null,
    { id:'g3', ders:'Matematik', sure:10, tarih:'2026-08-13' },
  ];
  const temiz = sanitizeStudies(ham, { bugun: BUGUN });
  assert.deepEqual(temiz.map(x => x.id), ['g1','g3']);
});

test('sanitizeStudies: aynı id yalnızca ilk geçer (tekilleştirme)', () => {
  const ham = [
    { id:'k', ders:'Yazılım', sure:10, tarih:'2026-08-13' },
    { id:'k', ders:'Yazılım', sure:99, tarih:'2026-08-13' },
  ];
  const temiz = sanitizeStudies(ham, { bugun: BUGUN });
  assert.equal(temiz.length, 1);
  assert.equal(temiz[0].sure, 10);
});

test('sanitizeStudies: özel dersler listesi onur', () => {
  const ham = [{ id:'k', ders:'Müzik', sure:10, tarih:'2026-08-13' }];
  const temiz = sanitizeStudies(ham, { bugun: BUGUN,
    dersler: [{ ad:'Müzik', renk:'#000000' }, { ad:'Diğer', renk:'#7a8499' }] });
  assert.equal(temiz[0].ders, 'Müzik'); // özel listede var → korunur
});

/* ---------- validateStudy ---------- */
test('validateStudy sınırları', () => {
  const BUGUN2 = '2026-08-17';
  assert.equal(validateStudy({ ders:'', sure:45, tarih:'2026-08-10' }, BUGUN2), 'Bir ders seçmelisin. ✏');
  assert.match(validateStudy({ ders:'Matematik', sure:0, tarih:'2026-08-10' }, BUGUN2), /1–1440/);
  assert.match(validateStudy({ ders:'Matematik', sure:1441, tarih:'2026-08-10' }, BUGUN2), /1–1440/);
  assert.equal(validateStudy({ ders:'Matematik', sure:1, tarih:'2026-08-10' }, BUGUN2), null);
  assert.equal(validateStudy({ ders:'Matematik', sure:1440, tarih:'2026-08-10' }, BUGUN2), null);
  assert.match(validateStudy({ ders:'Matematik', sure:45, tarih:'' }, BUGUN2), /Tarih/);
  assert.match(validateStudy({ ders:'Matematik', sure:45, tarih:'2099-01-01' }, BUGUN2), /Gelecek/);
  assert.equal(validateStudy({ ders:'Matematik', sure:45, tarih:BUGUN2 }, BUGUN2), null); // bugün serbest
});

/* ---------- hesaplaIstatistik ---------- */
// 2026-08-17 Pazartesidir; hafta o gün 00:00'da başlar.
const SIMDI = new Date(2026, 7, 17, 12, 0, 0);

const IST_LISTE = [
  { ders:'Matematik', sure:60, tarih:'2026-08-17' }, // bu hafta (Pzt)
  { ders:'Matematik', sure:30, tarih:'2026-08-16' }, // pazar → önceki hafta
  { ders:'Yazılım',   sure:45, tarih:'2026-08-15' },
  { ders:'Matematik', sure:25, tarih:'2026-08-14' },
];

test('hesaplaIstatistik: toplam süre', () => {
  assert.equal(hesaplaIstatistik(IST_LISTE, SIMDI).total, 160);
});

test('hesaplaIstatistik: hafta Pazartesi sınırından başlar', () => {
  // 08-17 Pazartesi tek başına bu hafta
  assert.equal(hesaplaIstatistik(IST_LISTE, SIMDI).hafta, 60);
  // Pazar gününden bakınca hafta 08-10 Pazartesi başlar → dört kayıt da düşer: 60+30+45+25
  const pazar = new Date(2026, 7, 16, 9, 0);
  assert.equal(hesaplaIstatistik(IST_LISTE, pazar).hafta, 160);
});

test('hesaplaIstatistik: en sık ders oturum sayısına göre', () => {
  const { top } = hesaplaIstatistik(IST_LISTE, SIMDI);
  assert.equal(top[0], 'Matematik');
  assert.deepEqual(top[1], { adet:3, dk:115 });
});

test('hesaplaIstatistik: seri — bugün çalışılmışsa bugünden sayar', () => {
  // 08-17, 08-16, 08-15 aralıksız → 3 gün
  const liste = [
    { ders:'Matematik', sure:10, tarih:'2026-08-17' },
    { ders:'Matematik', sure:10, tarih:'2026-08-16' },
    { ders:'Matematik', sure:10, tarih:'2026-08-15' },
  ];
  assert.equal(hesaplaIstatistik(liste, SIMDI).seri, 3);
});

test('hesaplaIstatistik: seri — bugün yoksa dünden saymaya başlar', () => {
  const liste = [
    { ders:'Matematik', sure:10, tarih:'2026-08-16' },
    { ders:'Matematik', sure:10, tarih:'2026-08-15' },
  ];
  assert.equal(hesaplaIstatistik(liste, SIMDI).seri, 2);
});

test('hesaplaIstatistik: boş liste güvenli değerler üretir', () => {
  const r = hesaplaIstatistik([], SIMDI);
  assert.equal(r.total, 0);
  assert.equal(r.hafta, 0);
  assert.equal(r.top, null);
  assert.equal(r.seri, 0);
  assert.deepEqual(r.entries, []);
});

test('hesaplaIstatistik: entries dakika miktarına göre sıralanır', () => {
  const r = hesaplaIstatistik(IST_LISTE, SIMDI);
  assert.deepEqual(r.entries.map(e => e[0]), ['Matematik','Yazılım']);
});

/* ---------- mixWithWhite ---------- */
test('mixWithWhite bilinen değerler', () => {
  assert.equal(mixWithWhite('#000000', 0.5), '#808080');
  assert.equal(mixWithWhite('#2f6fd0', 0.1), '#447dd5');
  assert.equal(mixWithWhite('#2f6fd0', 0),   '#2f6fd0');
  assert.equal(mixWithWhite('#ffffff', 0.3), '#ffffff');
  assert.equal(mixWithWhite('#2f6fd0', 1),   '#ffffff');
});

test('mixWithWhite: geçersiz giriş ve oran kelepçesi', () => {
  assert.equal(mixWithWhite('garbage', 0.5), '#ffffff');
  assert.equal(mixWithWhite('#zzz', 0.5), '#ffffff');
  assert.equal(mixWithWhite('#2f6fd0', 5), '#ffffff');   // oran 1'e kelepçelenir
  assert.equal(mixWithWhite('#2f6fd0', -3), '#2f6fd0');  // oran 0'a kelepçelenir
});
