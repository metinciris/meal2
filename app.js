/* ===== Strip any stray "Yükleniyor…" texts if injected by host or template ===== */
document.addEventListener('DOMContentLoaded', () => {
  const re = /Yükleniyor…|Yükleniyor\.{1,3}|YUKLENIYOR|Yukleniyor\.{0,3}/i;
  const scrub = () => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const toClean = [];
    let node; while ((node = walker.nextNode())) { if (re.test((node.textContent||'').trim())) toClean.push(node); }
    toClean.forEach(node => { node.textContent = node.textContent.replace(re, ''); });
  };
  scrub();
  new MutationObserver(() => scrub()).observe(document.body, {childList:true, subtree:true, characterData:true});
});

/**************** app.js — Tek JSON (normalized.json), PWA, TTS ****************/

/* ===== Dinamik URL yardımcıları ===== */
function basePath(){ const p = location.pathname; return p.endsWith('/') ? p : p.replace(/[^/]+$/, ''); }
function urlJoin(...segs){ return new URL(segs.join('/').replace(/\/+/g,'/'), location.origin).toString(); }

const DATA_URL = urlJoin(basePath(), 'data/normalized.json');

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
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('tr-TR', { day:'numeric', month:'long', year:'numeric', timeZone:'Europe/Istanbul' });
  }catch{ return '—' }
}

/* Global durum (tek JSON) */
let DATA = { rows: [], lastUpdated: null };
const byKey = new Map();   // "s:a" → rec (açık sûrede dolduruluyor)
let currentSurah = null;

/* ==== TTS durum & sözlük ==== */
const tts = {
  synth: typeof window !== 'undefined' ? window.speechSynthesis : null,
  voice: null,
  rate: 0.8,
  queue: [],
  idx: -1,
  playing: false,
  dict: { replacements: [] }
};

/* ===================== BOOT ===================== */

document.addEventListener('DOMContentLoaded', async () => {
  $('#backBtn')?.addEventListener('click', () => { ttsStop(); return goHome(); });
  $('#ttsPlay')?.addEventListener('click', onTtsPlay);
  $('#ttsStop')?.addEventListener('click', onTtsStop);
  $('#ttsRate')?.addEventListener('input', e => { tts.rate = parseFloat(e.target.value || '0.8'); });

  try {
    await Promise.all([ loadData(), initTTS(), loadTTSDict() ]);
    renderHome();
  } catch (e) {
    console.error(e);
    alert('Veri yüklenemedi.\n\nKontrol: data/normalized.json mevcut mu?\nPWA önbelleğini temizleyip tekrar deneyin.');
  }

  initTheme();
});

/* ===================== DATA ===================== */

async function loadData(){
  const res = await fetch(DATA_URL, { cache: 'no-store' });
  if (!res.ok) throw new Error(`normalized.json ${res.status}`);
  DATA = await res.json();
  $('#lastUpdated') && ($('#lastUpdated').textContent = formatDateTR(DATA.lastUpdated));
}

/* ===================== HOME (sûre listesi) ===================== */

function renderHome(){
  const list = $('#surahList');
  const view = $('#surahView');
  if (!list || !view) return;

  view.hidden = true; view.style.display = 'none';
  list.hidden = false; list.style.display = '';
  $('#crumbs').textContent = 'Ana sayfa';

  // her sûre için done say
  const done = Array.from({length:115}, _=>0);
  for (const r of DATA.rows || []) {
    if (r.sure >=1 && r.sure <=114) done[r.sure] = Math.max(done[r.sure], r.ayet||0);
  }

  const withData = [];
  const withoutData = [];
  for (let s=1; s<=114; s++){
    (done[s] > 0 ? withData : withoutData).push({ s, done: done[s], total: AYAHS[s] });
  }

  const home = document.createElement('div');
  home.className = 'home';

  // büyük kartlar
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
      card.className = 'card';
      const pct = Math.min(100, Math.round((done/total)*100));
      card.innerHTML = `
        <div class="head">
          <div class="badge">${s}</div>
          <div class="head-text">
            <div class="title">${NAMES[s]}</div>
            <div class="sub">Son ayet: ${done}/${total}</div>
          </div>
        </div>
        <div class="progress"><span style="width:${pct}%"></span></div>
      `;
      card.onclick = () => { ttsStop(); openSurah(s); };
      hero.appendChild(card);
    }
  }
  home.appendChild(hero);

  // diğer sûreler: çipler
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
    chips.hidden = false; // istersen true ile kapalı başlat
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

  // bu sûrenin kayıtlarını çek
  const rows = (DATA.rows || []).filter(r => r.sure === s).sort((a,b)=> a.ayet - b.ayet);
  byKey.clear();
  for (const r of rows) byKey.set(`${r.sure}:${r.ayet}`, r);

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

  if (s !== 1) {
    const b = document.createElement('div');
    b.className = 'ayah-card basmala';
    b.innerHTML = `<p dir="auto" class="bsm-text">${escapeHTML(BESMELE_TEXT)}</p>`;
    fr.appendChild(b);
  }

  // Birleşik mealler için atlanan ayetleri işaretle
  const skipped = new Set();

  for (let a = 1; a <= AYAHS[s]; a++) {
    if (skipped.has(a)) continue;

    const rec = byKey.get(`${s}:${a}`);
    if (!rec) continue;

    const text = rec.meal || '';
    const note = rec.aciklama || '';

    // Eğer bu ayetin meali dolu, takip eden(ler) tamamen boşsa bir aralık oluştur (169-170 gibi)
    let end = a;
    if (text.trim()) {
      while (end + 1 <= AYAHS[s]) {
        const next = byKey.get(`${s}:${end + 1}`);
        if (!next) break;
        const nextMeal = (next.meal || '').trim();
        const nextNote = (next.aciklama || '').trim();
        if (nextMeal === '' && nextNote === '') {
          end++;
          skipped.add(end);
        } else {
          break;
        }
      }
    }

    const card = document.createElement('div');
    card.className = 'ayah-card';
    card.id = `a-${s}-${a}`;

    const num = document.createElement('span');
    num.className = 'anum';
    num.textContent = (end > a) ? `${s}:${a}-${end}` : `${s}:${a}`;
    card.appendChild(num);

    card.insertAdjacentHTML('beforeend',
      `<p dir="auto">${escapeHTML(text)}</p>` +
      (note ? `<div class="note" dir="auto">${linkify(escapeHTML(note))}</div>` : '')
    );

    card.addEventListener('click', (ev) => {
      if (ev.target.tagName === 'A') return;
      ttsPlayFromElement(card);
      card.classList.add('shownum');
      setTimeout(()=>card.classList.remove('shownum'), 1600);
    });

    fr.appendChild(card);
  }

  wrap.replaceChildren(fr);
  ttsStop(false);
}


/* ===================== TTS ===================== */

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
    const res = await fetch(urlJoin(basePath(), 'data/tts-dict.json'), {cache:'no-store'});
    if (res.ok) {
      const j = await res.json();
      if (j && Array.isArray(j.replacements)) tts.dict.replacements = j.replacements;
    }
  } catch(_) {}
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
function onTtsPlay(){
  if (!tts.synth) { alert('Tarayıcı TTS desteği bulunamadı.'); return; }
  if (tts.playing) return;
  tts.queue = buildTTSQueueForSurah();
  if (!tts.queue.length){ alert('Okunacak ayet bulunamadı.'); return; }
  tts.idx = -1; tts.playing = true; updateTTSButtons(); nextUtterance();
}
function onTtsStop(){ ttsStop(true); }
function ttsStop(reset){
  if (tts.synth) { try { tts.synth.cancel(); } catch(_) {} }
  unmarkReading(); tts.playing=false; tts.idx=-1; tts.queue=[];
  if (reset !== false) updateTTSButtons();
}
function ttsPlayFromElement(el){
  if (!tts.synth) { alert('Tarayıcı TTS desteği bulunamadı.'); return; }
  const queue = buildTTSQueueForSurah();
  const idx = queue.findIndex(it => it.el === el);
  if (idx === -1) return;
  if (tts.synth.speaking || tts.synth.paused) { try { tts.synth.cancel(); } catch(_) {} }
  tts.queue = queue; tts.idx = idx - 1; tts.playing = true; updateTTSButtons(); nextUtterance();
}
function nextUtterance(){
  if (!tts.playing) return;
  tts.idx++; if (tts.idx >= tts.queue.length) { ttsStop(true); return; }
  const item = tts.queue[tts.idx];
  const u = new SpeechSynthesisUtterance(item.text);
  u.lang = (tts.voice && tts.voice.lang) || 'tr-TR'; u.voice = tts.voice || null;
  u.rate = tts.rate || 0.8; u.pitch = 1.0;
  unmarkReading(); item.el.classList.add('reading');
  item.el.scrollIntoView({behavior:'smooth',block:'center'});
  u.onend = () => nextUtterance(); u.onerror = () => nextUtterance();
  tts.synth.speak(u); updateTTSButtons();
}
function unmarkReading(){ document.querySelectorAll('.ayah-card.reading').forEach(el => el.classList.remove('reading')); }
function updateTTSButtons(){ const play=$('#ttsPlay'), stop=$('#ttsStop'); if (play) play.disabled=!!tts.playing; if (stop) stop.disabled=!tts.playing; }

/* ===================== NAV & UTIL ===================== */

function goHome(){ currentSurah = null; ttsStop(true); renderHome(); return false; }
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
      btn.textContent = '☀️';
    } else {
      root.removeAttribute('data-theme'); // dark
      metaTheme && metaTheme.setAttribute('content', '#0b1220');
      btn.textContent = '🌙';
    }
    localStorage.setItem(key, mode);
  }
}
