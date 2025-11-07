(function () {
  // ---- Basit yardımcılar ----
  function $(sel){ return document.querySelector(sel); }
  function escapeHTML(s){
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  // Göreli yollar: GitHub Pages altında /meal2/ + data/… olur (doğru)
  const DATA_URL   = 'data/normalized.json';
  const EMBEDS_URL = 'data/embeds.json';

  // Sûre adları / ayet sayıları (kısa tablo)
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

  const BESMELE = 'Hepimizi ve her birimizi daima bağrına basan ve ilişkisini asla kesmeyen, her zaman iyiliğimize meyilli doğanın, can veren o gücün! Adına';

  // ---- YouTube yardımcıları ----
  function hmsToSec(hms){
    if (!hms) return 0;
    if (/^\d+$/.test(hms)) return parseInt(hms,10);
    var m = String(hms).match(/(?:(\d+):)?(\d+):(\d+)/); // hh:mm:ss | mm:ss
    if (m){ return (+(m[1]||0))*3600 + (+m[2])*60 + (+m[3]); }
    var t = String(hms).replace(/^t=/i,'');
    var mh = t.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/i);
    if (mh) return (+(mh[1]||0))*3600 + (+(mh[2]||0))*60 + (+(mh[3]||0));
    return 0;
  }
  function parseYouTube(url){
    try{
      var u = new URL(url), id = '', start = 0;
      if (u.hostname.indexOf('youtu.be')>=0) id = u.pathname.slice(1);
      else if (u.searchParams.get('v')) id = u.searchParams.get('v');
      else {
        var mm = u.pathname.match(/\/embed\/([^/?#]+)/); if (mm) id = mm[1];
      }
      if (u.searchParams.get('start')) start = parseInt(u.searchParams.get('start'),10)||0;
      if (u.searchParams.get('t'))     start = hmsToSec(u.searchParams.get('t')) || start;
      return { id:id, startFromUrl:start };
    }catch(e){ return { id:'', startFromUrl:0 }; }
  }
  function buildYT(id, start){
    var s = Math.max(0, start|0);
    var src = 'https://www.youtube-nocookie.com/embed/'+id+'?start='+s+'&autoplay=0&rel=0&modestbranding=1';
    var wrap = document.createElement('div');
    wrap.className = 'ytwrap';
    wrap.innerHTML = '<iframe loading="lazy" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen src="'+src+'"></iframe>';
    return wrap;
  }

  // ---- Global durum ----
  var DATA = { rows:[], lastUpdated:null };
  var EMBEDS = null; // { bySurah: { "1":[{after,url,start,title}] }, lastUpdated }

  // ---- Boot ----
  document.addEventListener('DOMContentLoaded', function(){
    // Butonlar
    var back = $('#backBtn'); if (back) back.onclick = function(){ renderHome(); return false; };

    // Verileri sırayla yükle (hata yakalayıcılarla)
    fetch(DATA_URL, {cache:'no-store'})
      .then(function(r){ if(!r.ok) throw new Error('normalized.json '+r.status); return r.json(); })
      .then(function(j){ DATA = j||{rows:[]}; return fetch(EMBEDS_URL, {cache:'no-store'}); })
      .then(function(r2){
        if (r2 && r2.ok) return r2.json();
        return null; // embeds zorunlu değil
      })
      .then(function(j2){
        EMBEDS = j2;
        renderHome();
      })
      .catch(function(err){
        console.error('Veri yüklenemedi:', err);
        // Yine de ana sayfayı gösterelim; en azından kabuk açılsın
        renderHome();
      });
  });

  // ---- Home (sûre listesi) ----
  function renderHome(){
    var list = $('#surahList'), view = $('#surahView'), ul = $('#surahItems');
    if (!list || !view || !ul) return;

    list.hidden = false; list.style.display = '';
    view.hidden = true;  view.style.display = 'none';

    var fr = document.createDocumentFragment();
    for (var s=1; s<=114; s++){
      var li = document.createElement('li');
      var btn = document.createElement('button');
      btn.className = 'surah-item';
      btn.setAttribute('data-s', s);
      btn.innerHTML = '<b>'+s+' - '+escapeHTML(NAMES[s])+'</b><span>'+AYAHS[s]+' âyet</span>';
      btn.addEventListener('click', (function(ss){ return function(){ renderSurahView(ss); }; })(s));
      li.appendChild(btn); fr.appendChild(li);
    }
    ul.replaceChildren(fr);
    window.scrollTo(0,0);
  }

  function renderSurahView(s){
    var list = $('#surahList'), view = $('#surahView');
    if (!list || !view) return;
    list.hidden = true;  list.style.display = 'none';
    view.hidden = false; view.style.display = '';

    $('#surahTitle').textContent = s+' - '+NAMES[s];
    $('#crumbs').innerHTML = '<a href="#" onclick="return false" id="homeLink">Ana sayfa</a> › '+s+' - '+NAMES[s];
    var hl = $('#homeLink'); if (hl) hl.onclick = function(){ renderHome(); return false; };

    renderSurah(s);
    window.scrollTo(0,0);
  }

  // ---- Sûre render ----
  function renderSurah(s){
    var wrap = $('#ayahList'); if (!wrap) return;
    var fr = document.createDocumentFragment();

    // Besmele (Fâtiha hariç)
    if (s !== 1){
      var b = document.createElement('div');
      b.className = 'ayah-card basmala';
      b.innerHTML = '<p dir="auto" class="bsm-text">'+escapeHTML(BESMELE)+'</p>';
      fr.appendChild(b);
      // after:0 videolar
      if (EMBEDS && EMBEDS.bySurah && EMBEDS.bySurah[String(s)]){
        var head = EMBEDS.bySurah[String(s)];
        for (var i=0;i<head.length;i++){
          var e = head[i];
          if ((e.after|0) === 0){
            var id0 = parseYouTube(e.url||'').id;
            var st0 = (e.start|0)||0;
            if (id0){
              var n0 = buildYT(id0, st0);
              if (e.title){ var cap0 = document.createElement('div'); cap0.className='ytcaption'; cap0.textContent = e.title; n0.appendChild(cap0); }
              fr.appendChild(n0);
            }
          }
        }
      }
    }

    // Ayetler
    var rows = (DATA.rows||[]).filter(function(r){ return r.sure===s; });
    var by = {}; for (var k=0;k<rows.length;k++){ by[rows[k].ayet] = rows[k]; }

    for (var a=1; a<=AYAHS[s]; a++){
      var rec = by[a] || null;

      var card = document.createElement('div');
      card.className = 'ayah-card'; card.setAttribute('data-ayah', a);

      var num = document.createElement('div');
      num.className = 'ayah-num'; num.textContent = a; card.appendChild(num);

      var body = document.createElement('div');
      body.className = 'ayah-body';
      var meal = (rec && rec.meal) ? rec.meal : '';
      var acik = (rec && rec.aciklama) ? rec.aciklama : '';
      body.innerHTML = '<p dir="auto" class="meal-text">'+escapeHTML(meal || '(henüz girilmedi)')+'</p>'+(acik ? '<p class="meal-note">'+escapeHTML(acik)+'</p>' : '');
      card.appendChild(body);

      fr.appendChild(card);

      // Bu âyetten SONRA gelen videolar
      if (EMBEDS && EMBEDS.bySurah && EMBEDS.bySurah[String(s)]){
        var list = EMBEDS.bySurah[String(s)];
        for (var j=0;j<list.length;j++){
          var e2 = list[j];
          if ((e2.after|0) === a){
            var pr = parseYouTube(e2.url||'');
            if (pr.id){
              var node = buildYT(pr.id, (e2.start|0)||0);
              if (e2.title){ var cap = document.createElement('div'); cap.className='ytcaption'; cap.textContent = e2.title; node.appendChild(cap); }
              fr.appendChild(node);
            }
          }
        }
      }
    }

    wrap.replaceChildren(fr);
  }
})();
