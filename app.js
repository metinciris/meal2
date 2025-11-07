/* ===== Yükleniyor… temizliği (varsa) ===== */
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

/**************** app.js — tek data + YouTube embed + TTS stub ****************/

/* ===== Dinamik URL yardımcıları ===== */
function basePath(){
  // GitHub Pages "repo" alt yolunu hesaba kat
  // örn: https://metinciris.github.io/meal2/ → "/meal2/"
  const p = location.pathname;
  const parts = p.split('/').filter(Boolean);
  if (parts.length >= 1) return '/' + parts[0] + '/';
  return '/';
}
function urlJoin(...segs){ return new URL(segs.join('/').replace(/\/+/g,'/'), location.origin).toString(); }

const DATA_URL   = urlJoin(basePath(), 'data/normalized.json');
const EMBEDS_URL = urlJoin(basePath(), 'data/embeds.json');  // ← YouTube verisi

/* Sûre adları ve âyet sayıları (sabit) */
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

/* Besmele (Fâtiha hariç) — metnin sizdeki versiyonu kullanılabilir */
const BESMELE_TEXT =
  'Hepimizi ve her birimizi daima bağrına basan ve ilişkisini asla kesmeyen, '+
  'her zaman iyiliğimize meyilli doğanın, can veren o gücün! Adına';

/* Kısa yardımcılar */
const $ = (s) => document.querySelector(s);
function escapeHTML(s){
  return String(s||'')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

/* ====== YouTube yardımcıları ====== */
// "1:23:45", "12:34", "t=1m15s" veya "230" → saniye
function hmsToSec(hms){
  if (typeof hms === 'number') return hms|0;
  if (!hms) return 0;
  if (/^\d+$/.test(hms)) return parseInt(hms,10);
  const m = String(hms).match(/(?:(\d+):)?(\d+):(\d+)/); // hh:mm:ss | mm:ss
  if (m){ const hh=+(m[1]||0), mm=+m[2], ss=+m[3]; return hh*3600+mm*60+ss; }
  const t = String(hms).replace(/^t=/i,'');
  const mh = t.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/i);
  if (mh) return (+(mh[1]||0)*3600)+(+(mh[2]||0)*60)+(+(mh[3]||0));
  return 0;
}
// YouTube URL → { id, startFromUrl }
function parseYouTube(url){
  try{
    const u = new URL(url);
    let id = '';
    if (u.hostname.includes('youtu.be'))        id = u.pathname.slice(1);
    else if (u.searchParams.get('v'))           id = u.searchParams.get('v');
    else { const m = u.pathname.match(/\/embed\/([^/?#]+)/); if (m) id = m[1]; }
    let start = 0;
    if (u.searchParams.get('start')) start = parseInt(u.searchParams.get('start'),10)||0;
    if (u.searchParams.get('t'))     start = hmsToSec(u.searchParams.get('t')) || start;
    return { id, startFromUrl:start };
  }catch(e){ return { id:'', startFromUrl:0 }; }
}
// iframe oluşturucu
function buildYT(srcId, startSec){
  const s = Math.max(0, startSec|0);
  const src = `https://www.youtube-nocookie.com/embed/${srcId}?start=${s}&autoplay=0&rel=0&modestbranding=1`;
  const wrap = document.createElement('div');
  wrap.className = 'ytwrap';
  wrap.innerHTML = `<iframe loading="lazy" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen src="${src}"></iframe>`;
  return wrap;
}

/* ====== Global durum ====== */
let DATA   = { rows: [], lastUpdated: null };
let EMBEDS = null; // { bySurah: { "1":[{after,url,start,title}] }, lastUpdated }
let currentSurah = 1;
const byKey = new Map();

/* ===================== BOOT ===================== */

document.addEventListener('DOMContentLoaded', async () => {
  $('#backBtn')?.addEventListener('click', () => { ttsStop(); return goHome(); });
  $('#ttsPlay')?.addEventListener('click', onTtsPlay);
  $('#ttsStop')?.addEventListener('click', onTtsStop);
  $('#ttsRate')?.addEventListener('input', e => { tts.rate = parseFloat(e.target.value || '0.8'); });

  try {
    // normalized + embeds beraber yüklenir
    await Promise.all([ loadData(), loadEmbeds(), initTTS(), loadTTSDict() ]);
    renderHome();
  } catch (e) {
    console.error(e);
    alert('Veri yüklenemedi.\n\nKontrol: data/normalized.json ve data/embeds.json mevcut mu?\nPWA önbelleğini temizleyip tekrar deneyin.');
  }

  initTheme();
});

/* ===================== DATA ===================== */

async function loadData(){
  const res = await fetch(DATA_URL, { cache: 'no-store' });
  if (!res.ok) throw new Error(`normalized.json ${res.status}`);
  DATA = await res.json();
}
async function loadEmbeds(){
  try{
    const res = await fetch(EMBEDS_URL, { cache: 'no-store' });
    if (res.ok) EMBEDS = await res.json();
  }catch(e){ EMBEDS = null; }
}

/* ===================== HOME ===================== */

function renderHome(){
  const list = $('#surahList');
  const view = $('#surahView');
  if (!list || !view) return;

  list.hidden = false; list.style.display = '';
  view.hidden = true;  view.style.display = 'none';

  const ul = $('#surahItems');
  if (!ul) return;
  const fr = document.createDocumentFragment();
  for (let s=1; s<=114; s++){
    const li = document.createElement('li');
    li.innerHTML = `<button class="surah-item" data-s="${s}"><b>${s} - ${escapeHTML(NAMES[s])}</b><span>${AYAHS[s]} âyet</span></button>`;
    li.querySelector('button').addEventListener('click', () => renderSurahView(s));
    fr.appendChild(li);
  }
  ul.replaceChildren(fr);
}

function goHome(){ renderHome(); return false; }

async function renderSurahView(s){
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

/* ===================== SÛRE RENDER ===================== */

function renderSurah(s){
  const wrap = $('#ayahList');
  if (!wrap) return;
  const fr = document.createDocumentFragment();

  // Sûre başında besmele (Fâtiha hariç)
  if (s !== 1) {
    const b = document.createElement('div');
    b.className = 'ayah-card basmala';
    b.innerHTML = `<p dir="auto" class="bsm-text">${escapeHTML(BESMELE_TEXT)}</p>`;
    fr.appendChild(b);

    // after:0 videoları en başa koymak istersen:
    const headList = EMBEDS?.bySurah?.[String(s)] || [];
    for (const e of headList){
      if ((e.after|0) === 0){
        const { id } = parseYouTube(e.url || '');
        const start = (e.start|0) || 0;
        if (id){
          const node = buildYT(id, start);
          if (e.title){
            const cap = document.createElement('div');
            cap.className = 'ytcaption';
            cap.textContent = e.title;
            node.appendChild(cap);
          }
          fr.appendChild(node);
        }
      }
    }
  }

  // âyet satırları
  for (let a = 1; a <= AYAHS[s]; a++) {
    const key = `${s}:${a}`;
    const rec = byKey.get(key);

    const card = document.createElement('div');
    card.className = 'ayah-card';
    card.setAttribute('data-ayah', a);

    const num = document.createElement('div');
    num.className = 'ayah-num';
    num.textContent = a;
    card.appendChild(num);

    const body = document.createElement('div');
    body.className = 'ayah-body';
    const mealText = rec?.meal || '';
    const aciklama = rec?.aciklama || '';
    body.innerHTML = `
      <p dir="auto" class="meal-text">${escapeHTML(mealText || '(henüz girilmedi)')}</p>
      ${aciklama ? `<p class="meal-note">${escapeHTML(aciklama)}</p>` : ''}`;
    card.appendChild(body);

    // kartı ekle
    fr.appendChild(card);

    // ====> Bu âyetten SONRA gelen YouTube embed'leri ekle
    const list = EMBEDS?.bySurah?.[String(s)] || [];
    for (const e of list){
      if ((e.after|0) === a){
        const { id } = parseYouTube(e.url || '');
        const start = (e.start|0) || 0; // Issues "Başlangıç" öncelikli; yoksa URL'deki t=/start=
        if (id){
          const node = buildYT(id, start);
          if (e.title){
            const cap = document.createElement('div');
            cap.className = 'ytcaption';
            cap.textContent = e.title;
            node.appendChild(cap);
          }
          fr.appendChild(node);
        }
      }
    }
  }

  wrap.replaceChildren(fr);
  ttsStop(false);
}

/* ===================== TTS (basit stub; varsa butonlar bozulmasın) ===================== */
const tts = { synth: null, voice: null, rate: 0.9, queue: [], idx: -1, playing: false, dict: {replacements: []} };

async function initTTS(){
  try{ tts.synth = window.speechSynthesis; }catch(_){}
}
async function loadTTSDict(){ /* opsiyonel sözlük dosyası kullanıyorsan burada yükle */ }

function updateTTSButtons(){
  const play = $('#ttsPlay'), stop = $('#ttsStop');
  if (play) play.disabled = !!tts.playing;
  if (stop) stop.disabled = !tts.playing;
}
function buildTTSQueueForSurah(){
  const cards = Array.from(document.querySelectorAll('#ayahList .ayah-card'));
  return cards.map(el => (el.querySelector('.meal-text')?.textContent || '').trim()).filter(Boolean);
}
function nextUtterance(){
  if (!tts.synth) return ttsStop();
  tts.idx++;
  if (tts.idx >= tts.queue.length) return ttsStop();
  const text = tts.queue[tts.idx];
  const u = new SpeechSynthesisUtterance(text);
  u.rate = tts.rate;
  u.onend = () => nextUtterance();
  try{ tts.synth.cancel(); }catch(_){}
  tts.synth.speak(u);
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
  tts.playing=false; tts.idx=-1; tts.queue=[];
  if (reset !== false) updateTTSButtons();
}

/* ===================== Tema (varsa) ===================== */
function initTheme(){
  // basit: system pref veya localStorage anahtarı olabilir; burada boş bırakıyoruz
}
