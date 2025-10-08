/**************** app.js — Manifest + Per-Sûre JSON, PWA, TTS, Tema ****************/

/* Veri kaynakları */
const MANIFEST_URL = './data/manifest.json';
const SUREH_URL = (s) => `./data/surah/${s}.json`;

/* Sûre adları ve âyet sayıları */
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
const BESMELE_TEXT =
  'Hepimizi ve her birimizi daima bağrına basan ve ilişkisini asla kesmeyen, her zaman iyiliğimize meyilli doğanın, can veren o gücün! Adına';

/* Kısa yardımcılar */
const $ = (s) => document.querySelector(s);
function escapeHTML(s){
  return (s||'').toString().replace(/[&<>"']/g, m => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[m]));
}
function formatDateTR(iso){
  try{
    const d = new Date(iso);
    return d.toLocaleDateString('tr-TR', { day:'numeric', month:'long', year:'numeric', timeZone:'Europe/Istanbul' });
  }catch{ return iso }
}

/* Global durum (manifest + seçilen sûrenin verisi) */
let manifest = null;                   // { lastUpdated, progress: [{s,done,total}] }
let lastUpdated = null;
const surahCache = new Map();          // s → { sure, rows, lastUpdated }
const byKey = new Map();               // yalnız açık sûrenin kayıtları "s:a" → rec
let currentSurah = null;

/* ==== TTS durum & sözlük ==== */
const tts = {
  synth: typeof window !== 'undefined' ? window.speechSynthesis : null,
  voice: null,
  rate: 0.8,
  queue: [],   // {id, text, el}
  idx: -1,
  playing: false,
  dict: { replacements: [] }
};

/* ===================== BOOT ===================== */

document.addEventListener('DOMContentLoaded', async () => {
  // NAV & TTS kontrolleri
  $('#backBtn')?.addEventListener('click', () => { ttsStop(); return goHome(); });
  $('#ttsPlay')?.addEventListener('click', onTtsPlay);
  $('#ttsStop')?.addEventListener('click', onTtsStop);
  $('#ttsRate')?.addEventListener('input', e => { tts.rate = parseFloat(e.target.value || '0.8'); });

  try {
    await Promise.all([ loadManifest(), initTTS(), loadTTSDict() ]);
    renderHome();
  } catch (e) {
    console.error(e);
    alert('Veri yüklenemedi.');
  }

  // Tema başlat
  initTheme();
});

/* ===================== DATA ===================== */

async function loadManifest(){
  const res = await fetch(MANIFEST_URL, { cache: 'no-store' });
  if (!res.ok) throw new Error('Manifest okunamadı');
  manifest = await res.json();
  lastUpdated = manifest.lastUpdated || null;
  const el = $('#lastUpdated');
  if (el) el.textContent = lastUpdated ? formatDateTR(lastUpdated) : '—';
}

async function loadSurahData(s){
  if (surahCache.has(s)) return surahCache.get(s);
  const res = await fetch(SUREH_URL(s), { cache: 'no-store' });
  if (!res.ok) throw new Error(`Sûre verisi okunamadı: ${s}`);
  const j = await res.json(); // { sure, rows, lastUpdated }
  surahCache.set(s, j);
  return j;
}

/* ===================== HOME (sûre listesi) ===================== */

function renderHome(){
  const list = $('#surahList');
  const view = $('#surahView');
  if (!list || !view) return;

  view.hidden = true; view.style.display = 'none';
  list.hidden = false; list.style.display = '';
  $('#crumbs').textContent = 'Ana sayfa';

  const withData = [];
  const withoutData = [];
  for (const p of manifest.progress || []) {
    (p.done > 0 ? withData : withoutData).push(p);
  }

  const home = document.createElement('div');
  home.className = 'home';

  // --- Hero grid: büyük kartlar (yalnız meali olanlar) ---
  const hero = document.createElement('div');
  hero.className = 'hero';

  if (withData.length === 0){
    const empty = document.createElement('div');
    empty.className = 'card';
    empty.innerHTML = `<div class="title">Henüz meâl girilmemiş</div><div class="sub">Issues → Meal Ekle formuyla başlayın</div>`;
    hero.appendChild(empty);
  } else {
    for (const { s, done, total } of withData) {
      const card = document.createElement('button');
      card.className = 'card done';
      const pct = Math.min(100, Math.round((done/total)*100));
      card.innerHTML = `
        <div class="head">
          <div class="badge">${s}</div>
          <div class="head-text">
            <div class="title">${NAMES[s]}</div>
            <div class="sub">${done}/${total} tamamlandı</div>
          </div>
        </div>
        <div class="progress"><span style="width:${pct}%"></span></div>
      `;
      card.onclick = () => { ttsStop(); openSurah(s); };
      hero.appendChild(card);
    }
  }
  home.appendChild(hero);

  // --- Diğer sûreler: sessiz çipler ---
  if (withoutData.length){
    const title = document.createElement('div');
    title.className = 'section-title';
    const btn = document.createElement('button');
    btn.textContent = `Diğer sûreler (${withoutData.length})`;
    const line = document.createElement('div'); line.className = 'line';
    title.appendChild(btn); title.appendChild(line);
    home.appendChild(title);

    const chips = document.createElement('div');
    chips.className = 'chips';
    chips.hidden = false; // istersen true yapıp butonla aç/kapa
    btn.onclick = () => { chips.hidden = !chips.hidden; };

    for (const { s } of withoutData) {
      const chip = document.createElement('button');
      chip.className = 'chip';
      chip.textContent = `${s} - ${NAMES[s]}`;
      chip.onclick = () => { ttsStop(); openSurah(s); };
      chips.appendChild(chip);
    }
    home.appendChild(chips);
  }

  list.replaceChildren(home);
}

/* ===================== SÛRE GÖRÜNÜMÜ ===================== */

async function openSurah(s){
  currentSurah = s;
  const list = $('#surahList');
  const view = $('#surahView');
  if (!list || !view) return;

  // Veriyi getir & indexi hazırla
  const data = await loadSurahData(s); // { sure, rows, lastUpdated }
  byKey.clear();
  for (const r of data.rows) byKey.set(`${r.sure}:${r.ayet}`, r);

  list.hidden = true;  list.style.display = 'none';
  view.hidden = false; view.style.display = '';
  $('#surahTitle').textContent = `${s} - ${NAMES[s]}`;
  $('#crumbs').innerHTML = `<a href="#" onclick="return goHome()">Ana sayfa</a> › ${s} - ${NAMES[s]}`;
  window.scrollTo({ top: 0, behavior: 'auto' });

  renderSurah(s);
}

function renderSurah(s){
  const wrap = $('#ayahList');
  if (!wrap) return;
  const fr = document.createDocumentFragment();

  // — Besmele kartı: Fâtiha (1) HARİÇ
  if (s !== 1) {
    const b = document.createElement('div');
    b.className = 'ayah-card basmala';
    b.innerHTML = `<p dir="auto" class="bsm-text">${escapeHTML(BESMELE_TEXT)}</p>`;
    fr.appendChild(b);
  }

  // — Âyet kartları (sadece girişi olanlar)
  for (let a = 1; a <= AYAHS[s]; a++) {
    const rec = byKey.get(`${s}:${a}`);
    if (!rec) continue;

    const text = rec.meal || '';
    const note = rec.aciklama || '';

    const card = document.createElement('div');
    card.className = 'ayah-card';
    card.id = `a-${s}-${a}`;

    const num = document.createElement('span');
    num.className = 'anum';
    num.textContent = `${s}:${a}`;
    card.appendChild(num);

    card.insertAdjacentHTML('beforeend',
      `<p dir="auto">${escapeHTML(text)}</p>` +
      (note ? `<div class="note" dir="auto">${linkify(escapeHTML(note))}</div>` : '')
    );

    // karta tıklayınca: O AYETTEN itibaren TTS başlat
    card.addEventListener('click', (ev) => {
      const t = ev.target;
      if (t.tagName === 'A') return;
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
  if (typeof speechSynthesis !== 'undefined' && speechSynthesis.onvoiceschanged !== undefined) {
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
  } catch(_) { /* opsiyonel */ }
}

function buildTTSQueueForSurah(){
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
  for (const pair of (tts.dict.replacements || [])) {
    const from = pair[0], to = pair[1];
    if (!from) continue;
    const re = new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    out = out.replace(re, to);
  }
  return out;
}

/* ---- UI: Play/Stop ---- */
function onTtsPlay(){
  if (!tts.synth) { alert('Tarayıcı TTS desteği bulunamadı.'); return; }
  if (tts.playing) return;
  tts.queue = buildTTSQueueForSurah();
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
  const queue = buildTTSQueueForSurah();
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
  const play = $('#ttsPlay'), stop = $('#ttsStop');
  if (play) play.disabled = !!tts.playing;
  if (stop) stop.disabled = !tts.playing;
}

/* ===================== NAV & UTIL ===================== */

function goHome(){
  currentSurah = null;
  ttsStop(true);
  renderHome();
  return false;
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

/* ===================== Tema toggle ===================== */
function initTheme(){
  const key = 'theme';
  const root = document.documentElement;
  const btn = document.getElementById('themeToggle');
  const metaTheme = document.querySelector('meta[name="theme-color"]');

  let saved = localStorage.getItem(key);
  if (!saved) {
    const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
    saved = prefersLight ? 'light' : 'dark';
  }
  apply(saved);

  btn?.addEventListener('click', () => {
    const next = (root.getAttribute('data-theme') === 'light') ? 'dark' : 'light';
    apply(next);
  });

  function apply(mode){
    if (mode === 'light') {
      root.setAttribute('data-theme','light');
      metaTheme && metaTheme.setAttribute('content', '#f6f7fb');
    } else {
      root.removeAttribute('data-theme');
      metaTheme && metaTheme.setAttribute('content', '#0b1220');
    }
    localStorage.setItem(key, mode);
    if (btn) btn.textContent = (mode === 'light') ? '☀️' : '🌙';
  }
}
