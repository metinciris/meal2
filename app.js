/* =========================================================
   meal2 — app.js (sıfırdan)
   - Issues'tan üretilen data/normalized.json & data/embeds.json yükler
   - Ana sayfada "meali olan" sûreleri listeler
   - Sûre görünümünde âyetleri ve YouTube embed'leri basar
   - TTS: Oynat / Duraklat / Devam / Durdur (iptal)
   - Tema: OS varsayılanı + toggle (kalıcı)
   - PWA: SW güncelleme bildirimi
   ========================================================= */

(function(){
  "use strict";

  /* --------- sabitler --------- */
  const DATA_URL   = 'data/normalized.json';
  const EMBEDS_URL = 'data/embeds.json';
  const APP_VERSION = '20251108';

  /* --------- yardımcılar --------- */
  const $ = (s)=>document.querySelector(s);
  const escapeHTML = (s)=>
    String(s ?? '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

  // Sûre adları ve âyet sayıları
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

  const BESMELE =
    'Hepimizi ve her birimizi daima bağrına basan ve ilişkisini asla kesmeyen, '+
    'her zaman iyiliğimize meyilli doğanın, can veren o gücün! Adına';

  // YouTube yardımcıları
  function hmsToSec(hms){
    if (!hms) return 0;
    if (/^\d+$/.test(hms)) return parseInt(hms,10);
    const m = String(hms).match(/(?:(\d+):)?(\d+):(\d+)/); // hh:mm:ss | mm:ss
    if (m) return (+(m[1]||0))*3600 + (+m[2])*60 + (+m[3]);
    const t = String(hms).replace(/^t=/i,'');
    const mh = t.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/i);
    if (mh) return (+(mh[1]||0))*3600 + (+(mh[2]||0))*60 + (+(mh[3]||0));
    return 0;
  }
  function parseYouTube(url){
    try{
      const u = new URL(url);
      let id=''; if (u.hostname.includes('youtu.be')) id=u.pathname.slice(1);
      else if (u.searchParams.get('v')) id=u.searchParams.get('v');
      else { const mm=u.pathname.match(/\/embed\/([^/?#]+)/); if (mm) id=mm[1]; }
      let start=0;
      if (u.searchParams.get('start')) start = parseInt(u.searchParams.get('start'),10)||0;
      if (u.searchParams.get('t'))     start = hmsToSec(u.searchParams.get('t')) || start;
      return { id, startFromUrl:start };
    }catch(e){ return { id:'', startFromUrl:0 }; }
  }
  function buildYT(id, start){
    const s=Math.max(0,start|0);
    const src=`https://www.youtube-nocookie.com/embed/${id}?start=${s}&autoplay=0&rel=0&modestbranding=1`;
    const wrap=document.createElement('div'); wrap.className='ytwrap';
    wrap.innerHTML=`<iframe loading="lazy" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen src="${src}"></iframe>`;
    return wrap;
  }

  /* --------- global durum --------- */
  let DATA = { rows:[], lastUpdated:null };
  let EMBEDS = null;
  let currentSurah = 1;

  /* --------- PWA: SW kaydı ve güncelleme barı --------- */
async function registerSW(){
  if (!('serviceWorker' in navigator)) return;
  try{
    const reg = await navigator.serviceWorker.register('service-worker.js?v='+APP_VERSION, { scope: './' });

    // 1) yeni SW bulunduğunda (updatefound) ve 'installed' olduğunda, eğer sayfada halihazırda bir controller varsa → güncelleme var
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      if (!nw) return;
      nw.addEventListener('statechange', () => {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) {
          const bar = document.getElementById('updateBar');
          if (bar) bar.hidden = false;
        }
      });
    });

    // 2) "Yenile" butonu: waiting varsa hemen SKIP_WAITING iste
    const btn = document.getElementById('updateReload');
    if (btn) btn.onclick = () => {
      if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      // controller değişince otomatik reload
    };

    // 3) controller değiştiyse (yeni SW devreye girdi) sayfayı bir kez tazele
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloaded) return;
      reloaded = true;
      location.reload();
    });
  }catch(e){
    console.warn('SW kayıt hatası', e);
  }
}


  /* --------- tema --------- */
  function applyTheme(mode){
    if (mode === 'auto'){
      document.documentElement.removeAttribute('data-theme');
      return;
    }
    document.documentElement.setAttribute('data-theme', mode);
  }
  function initTheme(){
    const saved = localStorage.getItem('theme') || 'auto';
    applyTheme(saved);
    const btn = $('#themeToggle');
    if (btn){
      btn.onclick = ()=>{
        const cur = localStorage.getItem('theme') || 'auto';
        const next = cur === 'auto' ? 'dark' : (cur === 'dark' ? 'light' : 'auto');
        localStorage.setItem('theme', next);
        applyTheme(next);
      };
    }
  }

  /* --------- veri yükleme --------- */
  async function loadAll(){
    // normalized.json (mealler)
    const r = await fetch(DATA_URL, { cache:'no-store' });
    if (!r.ok) throw new Error('normalized.json '+r.status);
    const j = await r.json();
    DATA = {
      rows:(j.rows||[]).map(x=>({
        ...x,
        sure:Number(x.sure),
        ayet:Number(x.ayet),
        meal:x.meal ?? '',
        aciklama:x.aciklama ?? ''
      })),
      lastUpdated:j.lastUpdated||null
    };

    // embeds.json (YouTube) — opsiyonel
    try{
      const re = await fetch(EMBEDS_URL, { cache:'no-store' });
      EMBEDS = re.ok ? await re.json() : null;
    }catch(_){ EMBEDS = null; }
  }

  /* --------- UI: ana sayfa --------- */
  function renderHome(){
    const list = $('#surahList'), view = $('#surahView'), ul = $('#surahItems'), info = $('#listInfo');
    if (!list || !view || !ul) return;

    // Yalnızca meali olan sûreler
    const suresWithData = new Set(DATA.rows.map(r => r.sure));
    const items = Array.from(suresWithData).sort((a,b)=>a-b);

    list.hidden=false; view.hidden=true;
    const fr = document.createDocumentFragment();
    for (const s of items){
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.className='surah-item'; btn.setAttribute('data-s', String(s));
      btn.innerHTML = `<b>${s} - ${escapeHTML(NAMES[s])}</b><span>${AYAHS[s]} âyet</span>`;
      btn.onclick = ()=> renderSurahView(s);
      li.appendChild(btn); fr.appendChild(li);
    }
    ul.replaceChildren(fr);
    info.textContent = items.length ? `${items.length} sûre` : 'Henüz meal eklenmemiş.';
    window.scrollTo(0,0);
  }

  function renderSurahView(s){
    currentSurah = Number(s)||1;
    $('#surahList').hidden = true;
    $('#surahView').hidden = false;
    const name = NAMES[currentSurah] || ('Sûre '+currentSurah);
    const title = $('#surahTitle'); if (title) title.textContent = `${currentSurah} - ${name}`;
    const crumbs = $('#crumbs');
    if (crumbs){
      crumbs.innerHTML = `<a href="#" id="homeLink">Ana sayfa</a> › ${currentSurah} - ${escapeHTML(name)}`;
      const hl = $('#homeLink'); if (hl) hl.onclick = ()=>{ renderHome(); return false; };
    }
    renderSurah(currentSurah);
    window.scrollTo(0,0);
  }

  /* --------- sûre render --------- */
  function renderSurah(s){
    const wrap = $('#ayahList'); if (!wrap) return;
    const fr = document.createDocumentFragment();

    const rows = (DATA.rows||[]).filter(r => Number(r.sure) === Number(s))
                                 .sort((a,b)=> Number(a.ayet) - Number(b.ayet));
    if (!rows.length){
      const empty = document.createElement('div');
      empty.className = 'ayah-card';
      empty.innerHTML = `<p>Bu sûre için henüz meal verisi yok.</p>`;
      fr.appendChild(empty);
      wrap.replaceChildren(fr);
      return;
    }

    // Besmele (Fâtiha hariç)
    if (s !== 1){
      const b = document.createElement('div');
      b.className = 'ayah-card basmala';
      b.innerHTML = `<p dir="auto" class="bsm-text">${escapeHTML(BESMELE)}</p>`;
      fr.appendChild(b);

      // after:0 YouTube
      const head = EMBEDS?.bySurah?.[String(s)] || [];
      for (const e of head){
        if ((e.after|0) === 0){
          const { id } = parseYouTube(e.url||'');
          const start = (e.start|0) || 0;
          if (id){
            const node = buildYT(id, start);
            if (e.title){
              const cap = document.createElement('div');
              cap.className='ytcaption'; cap.textContent=e.title; node.appendChild(cap);
            }
            fr.appendChild(node);
          }
        }
      }
    }

    // Ayet lookup
    const byAyah = {}; for (const r of rows) byAyah[Number(r.ayet)] = r;

    for (let a=1; a<=AYAHS[s]; a++){
      const rec = byAyah[a] || null;

      const card = document.createElement('div');
      card.className = 'ayah-card'; card.setAttribute('data-ayah', String(a));

      const num = document.createElement('div');
      num.className = 'ayah-num'; num.textContent = String(a);
      card.appendChild(num);

      const body = document.createElement('div'); body.className='ayah-body';
      const meal = rec?.meal || ''; const acik = rec?.aciklama || '';
      body.innerHTML = `<p dir="auto" class="meal-text">${escapeHTML(meal || '(henüz girilmedi)')}</p>` +
                       (acik ? `<p class="meal-note">${escapeHTML(acik)}</p>` : '');
      card.appendChild(body);

      fr.appendChild(card);

      // Bu âyetten SONRA gelen YouTube
      const yts = EMBEDS?.bySurah?.[String(s)] || [];
      for (const e of yts){
        if ((e.after|0) === a){
          const { id } = parseYouTube(e.url||'');
          const start = (e.start|0) || 0;
          if (id){
            const node = buildYT(id, start);
            if (e.title){
              const cap = document.createElement('div');
              cap.className='ytcaption'; cap.textContent=e.title; node.appendChild(cap);
            }
            fr.appendChild(node);
          }
        }
      }
    }

    wrap.replaceChildren(fr);
    ttsStop(false);
  }

  /* --------- TTS --------- */
  const tts = { synth:null, playing:false, paused:false, queue:[], idx:-1, rate:0.95 };
  function initTTS(){
    try{ tts.synth = window.speechSynthesis; }catch(_){}
    const rate = $('#ttsRate'); if (rate) rate.oninput = (e)=> tts.rate = parseFloat(e.target.value || '0.95');
    const play = $('#ttsPlay'); if (play) play.onclick = onTtsPlay;
    const pause= $('#ttsPause'); if (pause) pause.onclick = onTtsPause;
    const resume=$('#ttsResume'); if (resume) resume.onclick = onTtsResume;
    const stop = $('#ttsStop'); if (stop) stop.onclick = ()=> ttsStop(true);
    // ESC ile iptal
    window.addEventListener('keydown', (ev)=>{ if (ev.key === 'Escape') ttsStop(true); });
    updateTTSButtons();
  }
  function buildTTSQueue(){
    const nodes = Array.from(document.querySelectorAll('#ayahList .ayah-card .meal-text'));
    return nodes.map(n => (n.textContent||'').trim()).filter(Boolean);
  }
  function nextUtterance(){
    if (!tts.synth) return ttsStop();
    tts.idx++;
    if (tts.idx >= tts.queue.length) return ttsStop();
    const text = tts.queue[tts.idx];
    const u = new SpeechSynthesisUtterance(text);
    u.rate = tts.rate;
    u.onend = ()=> nextUtterance();
    try{ tts.synth.cancel(); }catch(_){}
    tts.synth.speak(u);
  }
  function onTtsPlay(){
    if (!tts.synth){ alert('Tarayıcı TTS desteği yok.'); return; }
    if (tts.playing) return;
    tts.queue = buildTTSQueue();
    if (!tts.queue.length){ alert('Okunacak metin yok.'); return; }
    tts.idx = -1; tts.playing=true; tts.paused=false; updateTTSButtons(); nextUtterance();
  }
  function onTtsPause(){
    if (!tts.synth || !tts.playing) return;
    tts.synth.pause(); tts.paused = true; updateTTSButtons();
  }
  function onTtsResume(){
    if (!tts.synth || !tts.playing) return;
    tts.synth.resume(); tts.paused = false; updateTTSButtons();
  }
  function ttsStop(reset){
    if (tts.synth){ try{ tts.synth.cancel(); }catch(_){ } }
    tts.playing=false; tts.paused=false; tts.idx=-1; tts.queue=[];
    if (reset !== false) updateTTSButtons();
  }
  function updateTTSButtons(){
    const play=$('#ttsPlay'), pause=$('#ttsPause'), resume=$('#ttsResume'), stop=$('#ttsStop');
    if (play)   play.disabled   = !!tts.playing;
    if (pause)  pause.disabled  = !tts.playing || tts.paused;
    if (resume) resume.disabled = !tts.playing || !tts.paused;
    if (stop)   stop.disabled   = !tts.playing;
  }

  /* --------- boot --------- */
  document.addEventListener('DOMContentLoaded', async ()=>{
    initTheme();
    registerSW();
    $('#backBtn') && ($('#backBtn').onclick = ()=>{ $('#surahView').hidden=true; $('#surahList').hidden=false; window.scrollTo(0,0); return false; });
    try{
      await loadAll();
      renderHome();
    }catch(e){
      console.error('Veri yüklenemedi:', e);
      renderHome(); // kabuk yine açılsın
    }
    initTTS();
  });

})();
