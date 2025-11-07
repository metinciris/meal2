/* =========================================================
   meal2 — tek dosya app.js
   - normalized.json + embeds.json yükler
   - sûre listesi + sûre render + YouTube embed
   - tip normalizasyonu (sure/ayet string -> number)
   - opsiyonel TTS stub (butonlar yoksa devre dışı)
   ========================================================= */

(function () {
  "use strict";

  /* --------------------- yardımcılar --------------------- */
  const $ = (sel) => document.querySelector(sel);
  function escapeHTML(s){
    return String(s ?? "")
      .replace(/&/g,"&amp;").replace(/</g,"&lt;")
      .replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  }

  // GitHub Pages alt yolunu güvenli birleştirmek yerine düz göreli URL kullanıyoruz.
  // (Projeyi /meal2/ altında yayınlıyorsun; "data/..." doğru yere gider.)
  const DATA_URL   = "data/normalized.json";
  const EMBEDS_URL = "data/embeds.json";

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
    'Hepimizi ve her birimizi daima bağrına basan ve ilişkisini asla kesmeyen, ' +
    'her zaman iyiliğimize meyilli doğanın, can veren o gücün! Adına';

  /* ---------------- YouTube yardımcıları ---------------- */
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
      let id = '';
      if (u.hostname.includes('youtu.be')) id = u.pathname.slice(1);
      else if (u.searchParams.get('v'))   id = u.searchParams.get('v');
      else {
        const mm = u.pathname.match(/\/embed\/([^/?#]+)/);
        if (mm) id = mm[1];
      }
      let start = 0;
      if (u.searchParams.get('start')) start = parseInt(u.searchParams.get('start'),10)||0;
      if (u.searchParams.get('t'))     start = hmsToSec(u.searchParams.get('t')) || start;
      return { id, startFromUrl:start };
    }catch(e){ return { id:'', startFromUrl:0 }; }
  }
  function buildYT(id, start){
    const s = Math.max(0, start|0);
    const src = `https://www.youtube-nocookie.com/embed/${id}?start=${s}&autoplay=0&rel=0&modestbranding=1`;
    const wrap = document.createElement('div');
    wrap.className = 'ytwrap';
    wrap.innerHTML = `<iframe loading="lazy" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen src="${src}"></iframe>`;
    return wrap;
  }

  /* ---------------- global durum ---------------- */
  let DATA = { rows: [], lastUpdated: null };
  let EMBEDS = null; // { bySurah: { "2":[{after,url,start,title}] }, lastUpdated }
  let currentSurah = 1;

  /* ---------------- boot ---------------- */
  document.addEventListener('DOMContentLoaded', () => {
    $('#backBtn') && ($('#backBtn').onclick = () => { renderHome(); return false; });

    // verileri sırayla yükle
    loadAll()
      .then(() => renderHome())
      .catch(err => {
        console.error(err);
        renderHome(); // en azından kabuğu göster
      });
  });

  async function loadAll(){
    // normalized.json
    const r = await fetch(DATA_URL, { cache: 'no-store' });
    if (!r.ok) throw new Error(`normalized.json ${r.status}`);
    const j = await r.json();
    // tip normalizasyonu (en kritik kısım)
    DATA = {
      rows: (j.rows || []).map(x => ({
        ...x,
        sure: Number(x.sure),
        ayet: Number(x.ayet),
        meal: x.meal ?? '',
        aciklama: x.aciklama ?? ''
      })),
      lastUpdated: j.lastUpdated || null
    };

    // embeds.json (opsiyonel)
    try{
      const r2 = await fetch(EMBEDS_URL, { cache: 'no-store' });
      EMBEDS = r2.ok ? await r2.json() : null;
    }catch(_){ EMBEDS = null; }
  }

  /* ---------------- home: sûre listesi ---------------- */
  function renderHome(){
    const list = $('#surahList'), view = $('#surahView'), ul = $('#surahItems');
    if (!list || !view || !ul) return;

    list.hidden = false; list.style.display = '';
    view.hidden = true;  view.style.display = 'none';

    const fr = document.createDocumentFragment();
    for (let s=1; s<=114; s++){
      const li  = document.createElement('li');
      const btn = document.createElement('button');
      btn.className = 'surah-item';
      btn.setAttribute('data-s', String(s));
      btn.innerHTML = `<b>${s} - ${escapeHTML(NAMES[s])}</b><span>${AYAHS[s]} âyet</span>`;
      btn.addEventListener('click', () => renderSurahView(s));
      li.appendChild(btn);
      fr.appendChild(li);
    }
    ul.replaceChildren(fr);
    window.scrollTo(0,0);
  }

  function renderSurahView(s){
    currentSurah = Number(s) || 1;
    const list = $('#surahList'), view = $('#surahView');
    if (!list || !view) return;

    list.hidden = true;  list.style.display = 'none';
    view.hidden = false; view.style.display = '';

    $('#surahTitle') && ($('#surahTitle').textContent = `${currentSurah} - ${NAMES[currentSurah]}`);
    $('#crumbs') && ($('#crumbs').innerHTML = `<a href="#" id="homeLink">Ana sayfa</a> › ${currentSurah} - ${NAMES[currentSurah]}`);
    const hl = $('#homeLink'); if (hl) hl.onclick = () => { renderHome(); return false; };

    renderSurah(currentSurah);
    window.scrollTo(0,0);
  }

  /* ---------------- sûre render ---------------- */
  function renderSurah(s){
    const wrap = $('#ayahList'); if (!wrap) return;
    const fr = document.createDocumentFragment();

    // sûrenin kayıtları
    const rows = (DATA.rows || [])
      .filter(r => Number(r.sure) === Number(s))
      .sort((a,b) => Number(a.ayet) - Number(b.ayet));

    // hiç kayıt yoksa bilgilendir
    if (!rows.length){
      const empty = document.createElement('div');
      empty.className = 'ayah-card';
      empty.innerHTML = `<p>Bu sûre için henüz meal verisi yok.</p>`;
      fr.appendChild(empty);
      wrap.replaceChildren(fr);
      return;
    }

    // sûrenin başında besmele (Fâtiha hariç)
    if (s !== 1){
      const b = document.createElement('div');
      b.className = 'ayah-card basmala';
      b.innerHTML = `<p dir="auto" class="bsm-text">${escapeHTML(BESMELE)}</p>`;
      fr.appendChild(b);

      // after:0 videolar (sûre başı)
      const list0 = EMBEDS?.bySurah?.[String(s)] || [];
      for (const e of list0){
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

    // ayetler
    const byAyah = {};
    for (const r of rows) byAyah[Number(r.ayet)] = r;

    for (let a = 1; a <= AYAHS[s]; a++){
      const rec = byAyah[a] || null;

      // kart
      const card = document.createElement('div');
      card.className = 'ayah-card';
      card.setAttribute('data-ayah', String(a));

      const num = document.createElement('div');
      num.className = 'ayah-num';
      num.textContent = String(a);
      card.appendChild(num);

      const body = document.createElement('div');
      body.className = 'ayah-body';
      const meal = rec?.meal || '';
      const acik = rec?.aciklama || '';
      body.innerHTML =
        `<p dir="auto" class="meal-text">${escapeHTML(meal || '(henüz girilmedi)')}</p>` +
        (acik ? `<p class="meal-note">${escapeHTML(acik)}</p>` : '');
      card.appendChild(body);

      fr.appendChild(card);

      // bu âyetten SONRA gelen videolar
      const list = EMBEDS?.bySurah?.[String(s)] || [];
      for (const e of list){
        if ((e.after|0) === a){
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

    wrap.replaceChildren(fr);
    stopTTS(false); // render sonrası TTS durumu sıfırla
  }

  /* ---------------- TTS (opsiyonel stub) ---------------- */
  const tts = {
    synth: null, rate: 0.9,
    queue: [], idx: -1, playing: false
  };

  function initTTS(){
    try{ tts.synth = window.speechSynthesis; }catch(_){}
    const rate = $('#ttsRate'); if (rate) rate.oninput = (e)=> tts.rate = parseFloat(e.target.value||'0.9');
    const play = $('#ttsPlay'); if (play) play.onclick = onPlay;
    const stop = $('#ttsStop'); if (stop) stop.onclick = onStop;
    updateTTSBtns();
  }

  function buildQueue(){
    const cards = Array.from(document.querySelectorAll('#ayahList .ayah-card .meal-text'));
    return cards.map(n => (n.textContent||'').trim()).filter(Boolean);
  }

  function nextUtt(){
    if (!tts.synth) return stopTTS();
    tts.idx++;
    if (tts.idx >= tts.queue.length) return stopTTS();
    const text = tts.queue[tts.idx];
    const u = new SpeechSynthesisUtterance(text);
    u.rate = tts.rate;
    u.onend = () => nextUtt();
    try{ tts.synth.cancel(); }catch(_){}
    tts.synth.speak(u);
  }

  function onPlay(){
    if (!tts.synth) { alert('Tarayıcı TTS desteği yok.'); return; }
    if (tts.playing) return;
    tts.queue = buildQueue();
    if (!tts.queue.length){ alert('Okunacak metin yok.'); return; }
    tts.idx = -1; tts.playing = true; updateTTSBtns(); nextUtt();
  }
  function onStop(){ stopTTS(true); }
  function stopTTS(reset){
    if (tts.synth) { try{ tts.synth.cancel(); }catch(_){ } }
    tts.playing = false; tts.idx = -1; tts.queue = [];
    if (reset !== false) updateTTSBtns();
  }
  function updateTTSBtns(){
    const play = $('#ttsPlay'), stop = $('#ttsStop');
    if (play) play.disabled = !!tts.playing;
    if (stop) stop.disabled = !tts.playing;
  }

  // TTS butonları varsa bağla
  document.addEventListener('DOMContentLoaded', initTTS);

  /* ---------------- küçük UX: “yükleniyor” temizliği ---------------- */
  document.addEventListener('DOMContentLoaded', () => {
    const re = /Yükleniyor…|Yükleniyor\.{1,3}|YUKLENIYOR|Yukleniyor\.{0,3}/i;
    const scrub = () => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const toClean = [];
      let node; while ((node = walker.nextNode())) {
        if (re.test((node.textContent||'').trim())) toClean.push(node);
      }
      toClean.forEach(node => { node.textContent = node.textContent.replace(re, ''); });
    };
    scrub();
    new MutationObserver(() => scrub()).observe(document.body, {childList:true, subtree:true, characterData:true});
  });

})();
