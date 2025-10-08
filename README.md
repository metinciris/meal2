Harika! **meal2** için “sadece GitHub” ile çalışan, kolay giriş + PWA web arayüzü mimarisini **uçtan uca** veriyorum. Aşağıdaki adımları *tane tane* izleyip dosyaları aynen kopyalarsan **[https://metinciris.github.io/meal2/](https://metinciris.github.io/meal2/)** tam çalışır.

> **Not:** Bu sürüm **Google Sheets/Form KULLANMAZ**. Girdiler **GitHub Issues formu** üzerinden alınır, **GitHub Actions** ile `data/normalized.json` üretilir. Web, bu JSON’dan okur (PWA, TTS, iç linkler vb. önceki özelliklerin tamamı mevcut).

---

## 0) Klasör yapısı

Aynen şöyle oluştur:

```
meal2/
├─ index.html
├─ styles.css
├─ app.js
├─ manifest.webmanifest
├─ sw.js
├─ icons/
│  ├─ icon-192.png
│  ├─ icon-512.png
│  └─ maskable-512.png     # opsiyonel ama tavsiye
├─ data/
│  ├─ normalized.json      # Actions üretecek (ilk kez boş iskelet koy)
│  └─ tts-dict.json        # telaffuz sözlüğü (opsiyonel)
├─ scripts/
│  └─ build-from-issues.mjs
└─ .github/
   ├─ ISSUE_TEMPLATE/
   │  └─ meal.yml
   └─ workflows/
      └─ build-data.yml
```

> İlk commit’te `data/normalized.json` dosyasını boş iskeletle koy (aşağıda vereceğim), daha sonra **Issues** açıldıkça **Actions** bunu güncelleyecek.

---

## 1) Dosyalar (kopyala–yapıştır)

### 1.1 `index.html`

```html
<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Kuran Meal (GitHub Only)</title>

  <!-- PWA -->
  <link rel="manifest" href="manifest.webmanifest">
  <link rel="icon" href="icons/icon-192.png">
  <meta name="theme-color" content="#111827">
  <!-- iOS -->
  <link rel="apple-touch-icon" href="icons/icon-192.png">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black">

  <link rel="stylesheet" href="styles.css?v=1">
</head>
<body>
  <!-- Yükleniyor katmanı -->
  <div id="loading" class="loading" aria-live="polite">
    <div class="loading-box">
      <div class="loading-title">Kuran'ın gölgesinde</div>
      <div class="loading-author">Ayhan KIRMIZI</div>
      <div class="loading-quote">Aklını kullanmayanların üzerine pislik yağar</div>
      <div class="loading-spin">Yükleniyor…</div>
    </div>
  </div>

  <header class="topbar">
    <div class="brand">
      <h1>Kuran Meal</h1>
      <div id="crumbs" class="crumbs">Ana sayfa</div>
    </div>
  </header>

  <main class="container">
    <section id="surahList" class="surah-list"></section>

    <section id="surahView" class="surah-view" hidden>
      <button id="backBtn" class="back">← Tüm sûreler</button>
      <h2 id="surahTitle"></h2>

      <div class="tts-controls">
        <button id="ttsPlay" class="btn">▶︎ Başlat</button>
        <button id="ttsStop" class="btn" disabled>⏹ Durdur</button>
        <label class="opt">
          Hız
          <input id="ttsRate" type="range" min="0.5" max="1.2" step="0.05" value="0.8">
        </label>
      </div>

      <div id="ayahList" class="ayah-list"></div>
    </section>
  </main>

  <footer class="foot">
    <small>Son güncelleme: <span id="lastUpdated">—</span></small>
  </footer>

  <script src="app.js?v=1" defer></script>
  <script>
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js');
    }
  </script>
</body>
</html>
```

---

### 1.2 `styles.css`

```css
:root{
  --bg:#111827; --card:#1f2937; --ink:#e5e7eb; --muted:#9ca3af; --accent:#10b981; --accent-dim:#374151;
}

*{box-sizing:border-box}
html,body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}

/* container ortalı, kenarlarda nefes */
.container{
  max-width: 1120px;
  margin: 0 auto;
  padding: 16px;
}

.topbar{
  position:sticky; top:0; z-index:10;
  display:flex; gap:12px; justify-content:space-between; align-items:end;
  padding:12px 16px; border-bottom:1px solid #2d3748;
  background:linear-gradient(#111827,#0f172a);
}

.brand h1{margin:0;font-size:20px}
.crumbs{color:var(--muted);font-size:13px;margin-top:4px}

/* --- Sûre listesi: responsive grid, ortalı --- */
.surah-list{
  display: grid;
  grid-template-columns: 1fr;   /* mobil 1 sütun */
  gap: 12px;
  margin-top: 10px;
}
@media (min-width: 640px){
  .surah-list{ grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (min-width: 1024px){
  .surah-list{ grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (min-width: 1280px){
  .surah-list{ grid-template-columns: repeat(4, minmax(0, 1fr)); }
}

.surah-btn{
  width:100%; text-align:center; padding:16px; border-radius:16px; border:1px solid #334155;
  background:var(--accent-dim); color:var(--ink); font-weight:600; letter-spacing:.5px; cursor:pointer;
  transition:transform .06s ease, background .2s ease, border-color .2s ease, box-shadow .2s ease;
  box-shadow: 0 1px 0 rgba(0,0,0,.25);
}
.surah-btn:hover{ transform:translateY(-1px); border-color:#4b5563; box-shadow: 0 4px 14px rgba(0,0,0,.25); }
.surah-btn.done{ background: var(--accent); color:#053; }
.surah-btn .sub{ display:block; font-weight:500; font-size:12px; color:#053; opacity:.9 }

/* --- Sûre görünümü --- */
.surah-view{ margin-top:12px }
.back{ background:#0b1220; border:1px solid #374151; color:var(--ink); padding:8px 12px; border-radius:10px; cursor:pointer }
#surahTitle{ margin:10px 0 14px 0; font-weight: 800 }

/* TTS kontrolleri */
.tts-controls{
  display:flex; gap:8px; align-items:center;
  margin: 6px 0 12px 0;
}
.tts-controls .btn{
  background:#0b1220; border:1px solid #374151; color:var(--ink);
  padding:6px 10px; border-radius:10px; cursor:pointer;
}
.tts-controls .btn:disabled{ opacity:.5; cursor:default }
.tts-controls .opt{ color:var(--muted); font-size:13px; display:flex; gap:6px; align-items:center; margin-left:8px }

/* Ayet listesi: okuma konforu için merkezde daha dar bir kolon */
.ayah-list{
  display:flex; flex-direction:column; gap:12px;
  max-width: 860px;
  margin: 0 auto;
}
.ayah-card{
  position: relative;
  background:var(--card); border:1px solid #374151; border-radius:14px; padding:14px;
}
.ayah-card p{margin:0}
.ayah-card .note{margin-top:8px; color:var(--muted); font-size:14px}

/* Ayet numarası rozeti: gizli/soluk; hover veya tıklamada görünür */
.ayah-card .anum{
  position:absolute; top:8px; right:10px;
  background: rgba(255,255,255,.08);
  border: 1px solid #374151;
  color: #9ca3af;
  font-size: 12px; padding: 2px 6px; border-radius: 8px;
  opacity: 0; transition: opacity .15s ease;
}
.ayah-card:hover .anum,
.ayah-card.shownum .anum{ opacity: .95; }

/* Okunan ayeti vurgula */
.ayah-card.reading{
  outline: 2px solid #10b981;
  box-shadow: 0 0 0 3px rgba(16,185,129,.15);
}

/* Besmele kartı – yumuşak vurgu */
.ayah-card.basmala{
  border-color: #3b8261;
  background: linear-gradient(180deg, rgba(16,185,129,.08), rgba(16,185,129,.03));
}
.bsm-text{ margin: 0; font-style: italic; }

/* Alt bilgi */
.foot{ border-top:1px solid #2d3748; color:var(--muted); padding:10px 16px; text-align:center }

/* --- Yükleniyor katmanı --- */
.loading{
  position: fixed; inset: 0; display: none;
  align-items: center; justify-content: center;
  background: rgba(0,0,0,.45); backdrop-filter: blur(2px);
  color: #fff; font-weight: 600; z-index: 9999;
  text-align: center; padding: 24px;
}
.loading.show{ display: flex; }
.loading-box{
  max-width: 640px; width: 92%;
  background: #0b1220cc; border:1px solid #334155;
  border-radius: 16px; padding: 18px;
}
.loading-title{ font-size: 22px; margin-bottom: 6px }
.loading-author{ color:#9ca3af; margin-bottom: 8px }
.loading-quote{ font-weight: 500; margin-bottom: 12px; color:#e5e7eb }
.loading-spin{ opacity:.9; animation: pulse 1s infinite ease-in-out }
@keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:1} }
```

---

### 1.3 `app.js`

```javascript
/**************** app.js — GitHub Issues JSON + PWA + TTS ****************/

/* Veri kaynağı: repodaki JSON (Actions üretir) */
const API_URL = './data/normalized.json';

/* Sûre adları ve ayet sayıları */
const NAMES = [
  '', 'Fâtiha','Bakara','Âl-i İmrân','Nisâ','Mâide','En’âm','A’râf','Enfâl','Tevbe','Yûnus','Hûd',
  'Yûsuf','Ra’d','İbrâhîm','Hicr','Nahl','İsrâ','Kehf','Meryem','Tâhâ','Enbiyâ','Hac','Mü’minûn',
  'Nûr','Furkân','Şuarâ','Neml','Kasas','Ankebût','Rûm','Lokmân','Secde','Ahzâb','Sebe','Fâtır',
  'Yâsîn','Sâffât','Sâd','Zümer','Mü’min (Gâfir)','Fussilet','Şûrâ','Zuhruf','Duhân','Câsiye',
  'Ahkâf','Muhammed','Fetih','Hucurât','Kâf','Zâriyât','Tûr','Necm','Kamer','Rahmân','Vâkıa',
  'Hadîd','Mücâdele','Haşr','Mümtehine','Saf','Cuma','Münâfikûn','Tegâbün','Talâk','Tahrîm','Mülk',
  'Kalem','Hâkka','Meâric','Nûh','Cin','Müzzemmil','Müddessir','Kıyâme','İnsan','Mürselât','Nebe',
  'Nâziât','Abese','Tekvîr','İnfitar','Mutaffifîn','İnşikâk','Bürûc','Târık','A’lâ','Gâşiye','Fecr',
  'Beled','Şems','Leyl','Duha','İnşirah','Tîn','Alak','Kadr','Beyyine','Zilzâl','Âdiyât','Kâria',
  'Tekâsür','Asr','Hümeze','Fîl','Kureyş','Mâûn','Kevser','Kâfirûn','Nasr','Tebbet','İhlâs',
  'Felâk','Nâs'
];
const AYAHS = [0,7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,
 112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,
 60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,
 36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6];

/* Besmele (Fâtiha hariç) */
const BESMELE_TEXT = `Hepimizi ve her birimizi daima bağrına basan ve ilişkisini asla kesmeyen, her zaman iyiliğimize meyilli doğanın, can veren o gücün! Adına`;

/* Durum */
const $ = s => document.querySelector(s);
const byKey = new Map();   // "s:a" → {sure, ayet, meal, aciklama, last}
let lastUpdated = null;
let currentSurah = null;

/* ==== TTS durum & sözlük ==== */
const tts = {
  synth: window.speechSynthesis || null,
  voice: null,
  rate: 0.8,   // varsayılan hız
  queue: [],   // {id, text, el}
  idx: -1,
  playing: false,
  dict: { replacements: [] }
};

/* ===================== BOOT ===================== */

document.addEventListener('DOMContentLoaded', async () => {
  $('#backBtn')?.addEventListener('click', () => { ttsStop(); return goHome(); });

  // TTS UI
  $('#ttsPlay')?.addEventListener('click', onTtsPlay);
  $('#ttsStop')?.addEventListener('click', onTtsStop);
  $('#ttsRate')?.addEventListener('input', e => { tts.rate = parseFloat(e.target.value || '0.8'); });

  // Yükleniyor overlay
  showLoading(true);
  try {
    await Promise.all([ loadAll(), initTTS(), loadTTSDict() ]);
    renderHome();
  } catch (e) {
    console.error(e);
    alert('Veri yüklenemedi.');
  } finally {
    showLoading(false);
  }
});

/* ===================== DATA ===================== */

async function loadAll(){
  const res = await fetch(API_URL, { cache:'no-store' });
  if (!res.ok) throw new Error('Veri okunamadı: ' + res.status);
  const j = await res.json();
  byKey.clear();
  for (const x of j.rows) byKey.set(`${x.sure}:${x.ayet}`, x);
  lastUpdated = j.lastUpdated || null;
  $('#lastUpdated').textContent = lastUpdated || '—';
}

/* ===================== HOME (sûre listesi) ===================== */

function renderHome(){
  const list = $('#surahList');
  const view = $('#surahView');
  view.hidden = true; view.style.display = 'none';
  list.hidden = false; list.style.display = '';
  $('#crumbs').textContent = 'Ana sayfa';

  const fr = document.createDocumentFragment();
  for (let s=1; s<=114; s++){
    let done = 0;
    for (let a=1; a<=AYAHS[s]; a++) if (byKey.has(`${s}:${a}`)) done++;
    const btn = document.createElement('button');
    btn.className = 'surah-btn' + (done>0 ? ' done' : '');
    btn.innerHTML = `${s} - ${NAMES[s]}${done>0 ? `<span class="sub">${done}/${AYAHS[s]} tamamlandı</span>`:''}`;
    btn.onclick = () => { ttsStop(); openSurah(s); };
    fr.appendChild(btn);
  }
  list.replaceChildren(fr);
}

/* ===================== SÛRE GÖRÜNÜMÜ ===================== */

function openSurah(s){
  currentSurah = s;
  $('#surahList').hidden = true;  $('#surahList').style.display = 'none';
  $('#surahView').hidden = false; $('#surahView').style.display = '';
  $('#surahTitle').textContent = `${s} - ${NAMES[s]}`;
  $('#crumbs').innerHTML = `<a href="#" onclick="return goHome()">Ana sayfa</a> › ${s} - ${NAMES[s]}`;
  window.scrollTo({ top: 0, behavior: 'auto' });
  renderSurah(s);
}

function renderSurah(s){
  const wrap = $('#ayahList');
  const fr = document.createDocumentFragment();

  // — Besmele kartı: Fâtiha (1) HARİÇ
  if (s !== 1) {
    const b = document.createElement('div');
    b.className = 'ayah-card basmala';
    b.innerHTML = `<p dir="auto" class="bsm-text">${escapeHTML(BESMELE_TEXT)}</p>`;
    fr.appendChild(b);
  }

  // — Ayet kartları (sadece meali olanlar)
  for (let a = 1; a <= AYAHS[s]; a++) {
    const rec = byKey.get(`${s}:${a}`);
    if (!rec) continue;

    const text = rec.meal || '';
    const note = rec.aciklama || '';

    const card = document.createElement('div');
    card.className = 'ayah-card';
    card.id = `a-${s}-${a}`;

    // numara rozeti (gizli; hover/tıkla görünür)
    const num = document.createElement('span');
    num.className = 'anum';
    num.textContent = `${s}:${a}`;
    card.appendChild(num);

    // içerik
    card.insertAdjacentHTML('beforeend',
      `<p dir="auto">${escapeHTML(text)}</p>` +
      (note ? `<div class="note" dir="auto">${linkify(escapeHTML(note))}</div>` : '')
    );

    // karta tıklayınca: O AYETTEN itibaren TTS başlat
    card.addEventListener('click', (ev) => {
      const t = ev.target;
      if (t.tagName === 'A') return; // iç linke saygı
      ttsPlayFromElement(card);
      card.classList.add('shownum');
      setTimeout(()=>card.classList.remove('shownum'), 1600);
    });

    fr.appendChild(card);
  }

  wrap.replaceChildren(fr);
  ttsStop(false); // sûre değişince sessiz stop
}

/* ===================== TTS (Web Speech API) ===================== */

async function initTTS(){
  if (!tts.synth) return;
  const pickVoice = () => {
    const voices = tts.synth.getVoices();
    tts.voice = voices.find(v => /tr[-_]?TR/i.test(v.lang)) || voices[0] || null;
  };
  pickVoice();
  if (speechSynthesis && speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = pickVoice;
  }
}

async function loadTTSDict(){
  try{
    const res = await fetch('data/tts-dict.json', {cache:'no-store'});
    if (res.ok) {
      const j = await res.json();
      if (j && Array.isArray(j.replacements)) tts.dict.replacements = j.replacements;
    }
  } catch(_) { /* yoksa sorun değil */ }
}

function buildTTSQueueForSurah(s){
  const cards = [...document.querySelectorAll('#ayahList .ayah-card')]
    .filter(el => !el.classList.contains('basmala'));
  const queue = [];
  for (const el of cards){
    const p = el.querySelector('p');
    if (!p) continue;
    const text = normalizeForTTS(p.innerText || p.textContent || '');
    if (!text.trim()) continue;
    queue.push({ id: el.id, text, el });
  }
  return queue;
}

function normalizeForTTS(text){
  let out = (text || '').toString();
  for (const [from, to] of (tts.dict.replacements || [])) {
    if (!from) continue;
    const re = new RegExp(escapeReg(from), 'g');
    out = out.replace(re, to);
  }
  return out;
}
function escapeReg(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/* ---- UI: Play/Stop ---- */
function onTtsPlay(){
  if (!tts.synth) { alert('Tarayıcı TTS desteği bulunamadı.'); return; }
  if (tts.playing) return;
  tts.queue = buildTTSQueueForSurah(currentSurah);
  if (!tts.queue.length){ alert('Okunacak ayet bulunamadı.'); return; }
  tts.idx = -1;
  tts.playing = true;
  updateTTSButtons();
  nextUtterance();
}
function onTtsStop(){ ttsStop(true); }

function ttsStop(resetButtons){
  if (tts.synth) { try { tts.synth.cancel(); } catch(_) {} }
  unmarkReading();
  tts.playing = false;
  tts.idx = -1;
  tts.queue = [];
  if (resetButtons !== false) updateTTSButtons();
}

/* ---- Belirli bir ayetten başlat ---- */
function ttsPlayFromElement(el){
  if (!tts.synth) { alert('Tarayıcı TTS desteği bulunamadı.'); return; }
  const queue = buildTTSQueueForSurah(currentSurah);
  const idx = queue.findIndex(it => it.el === el);
  if (idx === -1) return;
  if (tts.synth.speaking || tts.synth.paused) { try { tts.synth.cancel(); } catch(_) {} }
  tts.queue = queue;
  tts.idx = idx - 1; // nextUtterance bir artırır
  tts.playing = true;
  updateTTSButtons();
  nextUtterance();
}

/* ---- Akış ---- */
function nextUtterance(){
  if (!tts.playing) return;
  tts.idx++;
  if (tts.idx >= tts.queue.length) { ttsStop(true); return; }

  const item = tts.queue[tts.idx];
  const u = new SpeechSynthesisUtterance(item.text);
  u.lang = (tts.voice && tts.voice.lang) || 'tr-TR';
  u.voice = tts.voice || null;
  u.rate = tts.rate || 0.8;
  u.pitch = 1.0;

  unmarkReading();
  item.el.classList.add('reading');
  item.el.scrollIntoView({behavior:'smooth',block:'center'});

  u.onend = () => nextUtterance();
  u.onerror = () => nextUtterance();

  tts.synth.speak(u);
  updateTTSButtons();
}

function unmarkReading(){
  document.querySelectorAll('.ayah-card.reading').forEach(el => el.classList.remove('reading'));
}

function updateTTSButtons(){
  $('#ttsPlay').disabled = !!tts.playing;
  $('#ttsStop').disabled = !tts.playing;
}

/* ===================== NAV & UTIL ===================== */

function goHome(){
  currentSurah = null;
  ttsStop(true);
  renderHome();
  return false;
}

function showLoading(v){
  const el = $('#loading'); if (!el) return;
  el.classList.toggle('show', !!v);
}

// [[3:4]] / [[3:4-6]] iç linkleri
function linkify(txt){
  return (txt||'').replace(/\[\[\s*(\d{1,3})\s*:\s*(\d{1,3})(?:\s*-\s*(\d{1,3}))?\s*\]\]/g,
    (m, s, a1, a2)=>{
      s = +s; a1 = +a1;
      const js = `
        ttsStop(true);
        openSurah(${s});
        setTimeout(()=>{
          const el = document.getElementById('a-${s}-${a1}');
          if (el){
            el.classList.add('shownum');
            el.scrollIntoView({behavior:'smooth',block:'start'});
            setTimeout(()=>el.classList.remove('shownum'), 1800);
          }
        }, 120);
        return false;`;
      return `<a href="#" onclick="${js}">${s}:${a2 ? `${a1}-${a2}` : a1}</a>`;
    });
}

function escapeHTML(s){
  return (s||'').toString().replace(/[&<>"']/g, m => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[m]));
}
```

---

### 1.4 `manifest.webmanifest`

```json
{
  "id": "./",
  "name": "Kuran Meal",
  "short_name": "Meal",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "background_color": "#111827",
  "theme_color": "#111827",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

---

### 1.5 `sw.js`

```js
/* sw.js — cache-first (assets), network-first (data) */
const CACHE = 'meal2-v1';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // data dosyaları: network-first (güncel kalsın)
  if (url.pathname.endsWith('/data/normalized.json') || url.pathname.endsWith('/data/tts-dict.json')) {
    e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));
    return;
  }
  // diğerleri: cache-first
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
```

---

### 1.6 `.github/ISSUE_TEMPLATE/meal.yml`

```yaml
name: Meal Ekle/Güncelle
description: Bir ayetin meâlini eklemek ya da güncellemek için bu formu kullanın.
title: "[Meal] Sûre {{ inputs.sure }} : Âyet {{ inputs.ayet }}"
labels: ["meal"]
body:
  - type: input
    id: sure
    attributes:
      label: Sûre (1-114)
      placeholder: "ör. 3"
    validations:
      required: true
  - type: input
    id: ayet
    attributes:
      label: Âyet No
      placeholder: "ör. 4"
    validations:
      required: true
  - type: textarea
    id: meal
    attributes:
      label: Meal Metni
      placeholder: "Meâl metnini yazınız..."
    validations:
      required: true
  - type: textarea
    id: aciklama
    attributes:
      label: Açıklama (opsiyonel)
      placeholder: "İç link: [[3:4]] gibi..."
    validations:
      required: false
```

---

### 1.7 `scripts/build-from-issues.mjs`

```js
// Node 20. Issues -> data/normalized.json üretir.
import { writeFileSync, mkdirSync } from "node:fs";
import { Octokit } from "octokit";

const { GITHUB_REPOSITORY, GITHUB_TOKEN } = process.env;
if (!GITHUB_REPOSITORY) { console.error("GITHUB_REPOSITORY env yok."); process.exit(1); }
const [owner, repo] = GITHUB_REPOSITORY.split("/");

const octokit = new Octokit({ auth: GITHUB_TOKEN });

// Issue Forms gövdesinden alanları çek
function parseIssueBody(body) {
  const pick = (label) => {
    const re = new RegExp(`###\\s*${label}[\\s\\S]*?\\n([^#]+)`, "i");
    const m = body.match(re);
    return m ? m[1].trim() : "";
  };
  const sure = pick("Sûre \\(1-114\\)") || pick("Sure \\(1-114\\)");
  const ayet = pick("Âyet No") || pick("Ayet No");
  const meal = pick("Meal Metni");
  const aciklama = pick("Açıklama");
  return { sure, ayet, meal, aciklama };
}
const toInt = x => {
  const n = parseInt(String(x).trim(), 10);
  return Number.isFinite(n) ? n : NaN;
};

(async function run() {
  const latestByKey = new Map();

  const states = ["open", "closed"]; // günceli yakalamak için her ikisi
  for (const state of states) {
    let page = 1;
    while (true) {
      const res = await octokit.rest.issues.listForRepo({
        owner, repo, labels: "meal", state, per_page: 100, page
      });
      const items = res.data;
      if (!items.length) break;

      for (const it of items) {
        if (!it.body) continue;
        const parsed = parseIssueBody(it.body);
        const s = toInt(parsed.sure);
        const a = toInt(parsed.ayet);
        const meal = (parsed.meal || "").trim();
        const aciklama = (parsed.aciklama || "").trim();
        if (!Number.isFinite(s) || !Number.isFinite(a) || !meal) continue;

        const key = `${s}:${a}`;
        const rec = { sure:s, ayet:a, meal, aciklama, last: it.updated_at };
        const prev = latestByKey.get(key);
        if (!prev || (rec.last > prev.last)) latestByKey.set(key, rec);
      }
      page++;
    }
  }

  const rows = [...latestByKey.values()].sort((x,y)=> x.sure - y.sure || x.ayet - y.ayet);
  const lastUpdated = rows.reduce((m,x)=> m && m>x.last ? m : x.last, null);

  mkdirSync("data", { recursive: true });
  writeFileSync("data/normalized.json", JSON.stringify({ rows, lastUpdated }, null, 2), "utf8");
  console.log(`OK: ${rows.length} kayıt yazıldı. Son güncelleme: ${lastUpdated || "-"}`);
})();
```

---

### 1.8 `.github/workflows/build-data.yml`

```yaml
name: Build JSON from Issues

on:
  issues:
    types: [opened, edited, reopened, labeled, unlabeled, closed]
  workflow_dispatch: {}
  push:
    paths:
      - ".github/workflows/build-data.yml"
      - "scripts/build-from-issues.mjs"
      - ".github/ISSUE_TEMPLATE/meal.yml"

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      issues: read
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install deps
        run: npm i octokit@3

      - name: Build normalized.json from issues
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GITHUB_REPOSITORY: ${{ github.repository }}
        run: node scripts/build-from-issues.mjs

      - name: Commit & push data
        uses: stefanzweifel/git-auto-commit-action@v5
        with:
          commit_message: "chore(data): rebuild normalized.json from issues"
          file_pattern: "data/normalized.json"
```

---

### 1.9 `data/normalized.json` (ilk iskelet)

```json
{
  "rows": [],
  "lastUpdated": null
}
```

### 1.10 `data/tts-dict.json` (opsiyonel sözlük)

```json
{
  "replacements": [
    ["Âl-i", "Ali"],
    ["Yûnus", "Yunus"],
    ["Mü’min", "Mümin"],
    ["Rahmân", "Rahman"]
  ]
}
```

---

## 2) Çalıştırma — tek tek adımlar

1. **Repo dosyalarını** yukarıdaki gibi oluştur/taşı (özellikle `.github` ve `scripts`).
2. **Issues** özelliği açık olsun (Repo → Settings → Features → Issues).
3. **GitHub Pages**’i aç (Repo → Settings → Pages → Branch: `main` / root).
4. **Icons** klasörüne `icon-192.png`, `icon-512.png` (kare PNG) koy.
5. **İlk veri için** “Issues → New issue → **Meal Ekle/Güncelle**” formunu kullan:

   * Sûre (1–114), Âyet, Meal, (opsiyonel) Açıklama → **Submit**
6. Issue açılınca **Actions** otomatik çalışır; `data/normalized.json` güncellenir.
7. Site: **[https://metinciris.github.io/meal2/](https://metinciris.github.io/meal2/)** — *sert yenile* (Ctrl+F5 / Cmd+Shift+R).
8. PWA yüklemek için adres çubuğundaki **Yükle**/“Add to Home screen” simgesi.

---

## 3) Kullanım

* **Yeni meal ekleme/güncelleme:** Issues formu → Submit. (Aynı Sûre:Âyet için en güncel kayıt geçerlidir.)
* **İç link:** Açıklama alanında `[[3:4]]` veya `[[2:255-257]]`.
* **Sesli okuma:** Sûre ekranında **Başlat/Durdur**, hız 0.5–1.2 (varsayılan 0.8). Ayete tıklarsan **o ayetten** itibaren okur.
* **Besmele:** Fâtiha hariç tüm sûrelerin başında bir kart olarak görünür (metin: “Hepimizi ve…”).
* **Offline:** PWA önbelleği ile çevrimdışıyken en son veriler görülebilir.

---

## 4) Hata & çözüm

* **Issue formu görünmüyor:** `.github/ISSUE_TEMPLATE/meal.yml` doğru mu? Issues aktif mi?
* **Actions çalışmadı:** Repo’da Actions aktif mi? Workflow “Permissions: contents: write” var mı? Log’a bak.
* **JSON güncellenmedi:** Workflow log’da `OK: X kayıt` çıktı mı? Son adımda commit izni var mı?
* **Site veri görmüyor:** `data/normalized.json` gerçekten repoda güncellenmiş mi? `app.js` → `API_URL` = `./data/normalized.json` mi?
* **PWA yüklenmiyor:** `manifest.webmanifest` linkli mi, `sw.js` kayıt oluyor mu, ikonlar doğru yerde mi? (Hard refresh + gerekirse SW Unregister)
* **TTS bozuk telaffuz:** `data/tts-dict.json` ile yazım→okunuş dönüşümleri ekleyebilirsin.
* **Takıldın mı?** Hata mesajını/ekran görüntüsünü kopyalayıp **ChatGPT gibi YZ** ile yardım iste — özellikle Actions/Apps Script/PWA gibi alanlarda çok hızlı çözüm sunar.

---

## 5) README (kısa tanıtım + adım adım)

Aşağıyı **README.md** olarak repo köküne koy:

```md
# Kuran’ın Gölgesinde — Meal Paylaşım Sistemi (GitHub Only)
**Ayhan KIRMIZI’nın _Kuran’ın Gölgesinde_ eserinden faydalanılmıştır.**

Bu repo, **yalnızca GitHub** kullanarak mealleri toplamayı ve bir **PWA web uygulamasında** göstermeyi sağlar:
- Girdi: **GitHub Issues** (form)
- Dönüşüm: **GitHub Actions** → `data/normalized.json`
- Arayüz: **GitHub Pages (PWA)** → `index.html + app.js`

Canlı örnek: `https://<kullanici>.github.io/meal2/`

## Özellikler
- Kitap (mushaf) sırası görünümü, boş ayetler gizli
- Besmele kartı (Fâtiha hariç)
- İç link: `[[2:255]]`, `[[2:255-257]]`
- **TTS**: Başlat/Durdur, hız 0.5–1.2 (varsayılan 0.8), ayete tıklayınca o yerden okur
- **PWA**: offline, “Uygulama olarak yükle”

## Kurulum
1. Bu repoyu **Fork**layın veya template olarak kopyalayın.
2. **Issues** açık olsun (Settings → Features → Issues).
3. **GitHub Pages** (Settings → Pages → Branch `main`).
4. `icons/` klasörüne 192/512 PNG ikonlar koyun.
5. İlk veri için **Issues → New issue → Meal Ekle/Güncelle** formunu kullanın.
6. Actions çalışır, `data/normalized.json` güncellenir; site otomatik veriyi okur.

## Dosya Yapısı
```

index.html, styles.css, app.js, manifest.webmanifest, sw.js
icons/icon-192.png, icons/icon-512.png, icons/maskable-512.png
data/normalized.json, data/tts-dict.json (opsiyonel)
scripts/build-from-issues.mjs
.github/ISSUE_TEMPLATE/meal.yml
.github/workflows/build-data.yml

```

## Hata & Çözüm
- Workflow/Actions çalışmıyorsa: izinler (`contents: write`) ve loglara bakın.
- PWA yüklenmiyorsa: manifest ve SW kayıtlarını doğrulayın, sert yenileyin.
- Telaffuz sorunları için `data/tts-dict.json` ekleyebilirsiniz.
- Yardım için hata mesajını olduğu gibi paylaşarak **ChatGPT** gibi YZ’lerden destek alabilirsiniz.

```

---

Hepsi bu. Şimdi `meal2` repo’na bu dosyaları ekleyip **Issues → Meal Ekle/Güncelle** ile ilk kaydı gir; **Actions** çalışınca `data/normalized.json` oluşacak ve **[https://metinciris.github.io/meal2/](https://metinciris.github.io/meal2/)** üzerinde PWA arayüzüyle görünecek.

İstersen “Son eklenenler”, açık/koyu tema veya “fixlenmiş telaffuzlar” gibi küçük eklemeleri de hazırlarım.
