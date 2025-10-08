 **meal2** için “sadece GitHub” ile çalışan, kolay giriş + PWA web arayüzü mimarisini **uçtan uca** veriyorum. Aşağıdaki adımları *tane tane* izleyip dosyaları aynen kopyalarsan **[https://metinciris.github.io/meal2/](https://metinciris.github.io/meal2/)** tam çalışır.

> **Not:** Bu sürüm **Google Sheets/Form KULLANMAZ**. Girdiler **GitHub Issues formu** üzerinden alınır, **GitHub Actions** ile `data/normalized.json` üretilir. Web, bu JSON’dan okur (PWA, TTS, iç linkler vb. önceki özelliklerin tamamı mevcut).

# Kuran’ın Gölgesinde — README (Kısaca Kurulum ve Kullanım)

> Bu repo **yalnız GitHub ile** çalışır. Dışarıda Google Sheets/Form yok.
> Meâl girişi **Issues** üzerinden yapılır; site (PWA) otomatik güncellenir.

---

## 1) İşleyiş (Nasıl Çalışıyor?)

* Web uygulaması: `index.html + styles.css + app.js` (GitHub Pages/PWA).
* Veriler: `data/` klasörü.

  * **manifest.json** ve **surah/** altındaki `1.json … 114.json`: hızlı listeleme ve sûre bazlı okuma.
  * **normalized.json**: Issues’tan derlenen tek birleşik veri (yedek/fallback).
* **Issues → build-data** iş akışı:

  * Repo’daki `/.github/workflows/build-data.yml` çalışır.
  * Beyaz listedeki kullanıcıların açtığı/edite ettiği Issues’ları okur.
  * Her `(sûre, âyet)` için **son girilen** kaydı alır (“last write wins”).
  * `data/normalized.json` dosyasını günceller.
  * (İstersen) per-sûre dosyaları/manifest ek akışla üretilebilir; şimdilik `normalized.json` yeterlidir (app, manifest yoksa normalized’dan çalışır).
* **Moderasyon (opsiyonel)**: `/.github/workflows/moderate-issues.yml`

  * Beyaz liste dışında biri issue açarsa **kibar mesaj** atar ve **kapatır** (JSON’a girmediği için veriyi kirletmez).

---

## 2) Kendine Kopyalama (Fork/Eşleme ve Yayınlama)

1. **Fork**

   * Bu repoyu kendi GitHub hesabına **Fork** edin (sağ üst: *Fork*).
2. **GitHub Pages**

   * Repo → **Settings → Pages**
   * **Branch:** `main` • **Folder:** `/ (root)` → **Save**
   * Yayın adresi: `https://<kullanıcı>.github.io/<repo-adi>/`
3. **İlk veri (boş set) – önerilir**

   * `data/normalized.json` dosyasını oluşturun (boş içerik):

     ```json
     { "rows": [], "lastUpdated": null }
     ```
   * (İsterseniz `data/surah/1.json … 114.json` ve `data/manifest.json` için “init” workflow’unu da ekleyebilirsiniz; şart değil.)
4. **PWA**

   * Telefon/PC’de siteyi açınca “Uygulama olarak yükle” teklifi gelir.
   * Değişikliklerde önbellek için: tarayıcıyı sert yenileyin veya PWA’yı bir kez kapatıp açın.

---

## 3) Meâl Girme (Issues ile)

### A) Issue Template’leri (önerilir)

Aşağıdaki iki dosyayı repo’ya ekleyin ki, Issues ekranı formlu gelsin:

* **`.github/ISSUE_TEMPLATE/01-meal.yml`** — Tek âyet

  ```yaml
  name: "[Meal] Tekil âyet"
  description: Tek âyet meali ekleme/güncelleme
  title: "[Meal] Sûre {{ inputs.sure }} : Âyet {{ inputs.ayet }}"
  labels: ["meal"]
  body:
    - type: input
      id: sure
      attributes: { label: "Sûre (1-114)", placeholder: "3" }
      validations: { required: true }
    - type: input
      id: ayet
      attributes: { label: "Âyet No", placeholder: "4" }
      validations: { required: true }
    - type: textarea
      id: meal
      attributes: { label: "Meal Metni", placeholder: "Metni" }
      validations: { required: true }
    - type: textarea
      id: aciklama
      attributes: { label: "Açıklama (opsiyonel)", placeholder: "..." }
  ```

* **`.github/ISSUE_TEMPLATE/02-bulk-meal.yml`** — Toplu (aynı sûrede birden çok âyet)

  ```yaml
  name: "[BulkMeal] Toplu âyet"
  description: Bir sûrede birden çok âyeti numara:metin şeklinde ekleme
  title: "[BulkMeal] Sûre {{ inputs.sure }}"
  labels: ["bulk"]
  body:
    - type: input
      id: sure
      attributes: { label: "Sûre (1-114)", placeholder: "2" }
      validations: { required: true }
    - type: textarea
      id: blob
      attributes:
        label: "Toplu Metin"
        description: "Satır satır: 1- ..., 2- ..., 3- ... vb."
        placeholder: |
          1- ELİF LAM MİM / ...
          2- Empati sahiplerine rehber...
          3- ...
      validations: { required: true }
  ```

> **Toplu giriş formatı**:
> `1- Metin`, `2- Metin` … (nokta, iki nokta, tire, uzun tire kabul edilir: `1-`, `2.`, `3:`, `4 —`)

### B) Derleyici Workflow (Issues → normalized.json)

* **`.github/workflows/build-data.yml`** dosyasını ekleyin:

```yaml
name: Build Data (Issues → data/normalized.json)

on:
  issues: { types: [opened, edited, closed, reopened] }
  workflow_dispatch:

permissions:
  contents: write   # data/* içine commit atabilsin

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');

            // ---- Beyaz liste (sadece bu kullanıcıların issue'ları işlenir) ----
            const ALLOWED = new Set(['metinciris']); // burada kendi adınızı bırakın/ekleyin

            // yardımcılar
            const toInt = (x)=>{ const n = parseInt(String(x??'').trim(),10); return Number.isFinite(n)?n:NaN; }
            const pick = (body,labelPattern)=>{
              const re = new RegExp(`###\\s*(?:${labelPattern})\\s*\\n([\\s\\S]*?)(?=\\n###|$)`,'i');
              const m = (body||'').match(re); let v = m ? (m[1]||'').trim() : '';
              if (/^_?no response_?$/i.test(v)) v = ''; return v;
            };
            const parseSingleFromTitle = (title)=>{
              const m = /\[Meal\].*?S[ûu]re\s+(\d{1,3}).*?[ÂA]yet\s+(\d{1,3})/i.exec(title||'');
              return m ? { sure: toInt(m[1]), ayet: toInt(m[2]) } : null;
            };
            const parseSingleFromBody = (body)=>{
              const sure = toInt(pick(body,"S[ûu]re\\s*\\(1-114\\)|Sure\\s*\\(1-114\\)"));
              const ayet = toInt(pick(body,"[ÂA]yet\\s*No"));
              const meal = pick(body,"Meal(?:\\s*Metni)?|Meal");
              const aciklama = pick(body,"Aç(?:ı|i)klama(?:\\s*\\(opsiyonel\\))?");
              if (!Number.isFinite(sure)||!Number.isFinite(ayet)||!meal) return null;
              return { sure, ayet, meal, aciklama };
            };
            const parseBulkBlock = (blob)=>{
              const lines=(blob||'').replace(/\r/g,'').split('\n');
              const out=[]; let cur=null; const start=/^\s*(\d{1,3})\s*([\-–—.:])\s*(.*)$/;
              for (const raw of lines){
                const line=raw.trimEnd(); const m=start.exec(line);
                if (m){ const ayet=toInt(m[1]); const text=(m[3]||'').trim();
                  if (Number.isFinite(ayet)){ cur={ayet,meal:text}; out.push(cur);} else {cur=null;} }
                else if (cur){ const t=line.trim(); if (t) cur.meal=(cur.meal?cur.meal+'\n':'')+t; }
              }
              return out.filter(x=>x.meal && x.meal.trim());
            };
            const parseBulkFromBody = (body)=>{
              const sure = toInt(pick(body,"S[ûu]re\\s*\\(1-114\\)|Sure\\s*\\(1-114\\)"));
              const blob = pick(body,"Toplu\\s*Metin|Toplu\\s*Meal|Toplu|Metin");
              if (!Number.isFinite(sure)||!blob) return null;
              return parseBulkBlock(blob).map(x=>({sure, ayet:x.ayet, meal:x.meal, aciklama:''}));
            };

            // ---- last-write-wins: en son güncelleneni al ----
            const latest = new Map(); // "s:a" -> record
            for (const state of ['open','closed']){
              let page=1;
              while(true){
                const res = await github.rest.issues.listForRepo({
                  owner: context.repo.owner, repo: context.repo.repo,
                  state, per_page: 100, page
                });
                const items = res.data || []; if (!items.length) break;
                for (const it of items){
                  if (it.pull_request) continue;
                  const author = it.user?.login || '';
                  if (!ALLOWED.has(author)) continue;

                  const title = it.title || ''; const body = it.body || '';
                  if (/^\s*\[BulkMeal\]/i.test(title)){
                    const pack = parseBulkFromBody(body); if (!pack) continue;
                    for (const r of pack){
                      const key = `${r.sure}:${r.ayet}`;
                      const rec = { sure:r.sure, ayet:r.ayet, meal:r.meal.trim(), aciklama:'', last: it.updated_at };
                      const prev = latest.get(key);
                      if (!prev || rec.last > prev.last) latest.set(key, rec);
                    }
                  } else if (/^\s*\[Meal\]/i.test(title)){
                    let p = parseSingleFromBody(body);
                    if (!p){
                      const ft = parseSingleFromTitle(title);
                      if (ft){
                        p = { ...ft, meal: pick(body,"Meal(?:\\s*Metni)?|Meal"),
                                   aciklama: pick(body,"Aç(?:ı|i)klama(?:\\s*\\(opsiyonel\\))?") };
                      }
                    }
                    if (!p || !p.meal) continue;
                    const key = `${p.sure}:${p.ayet}`;
                    const rec = { sure:p.sure, ayet:p.ayet, meal:p.meal.trim(), aciklama:(p.aciklama||'').trim(), last: it.updated_at };
                    const prev = latest.get(key);
                    if (!prev || rec.last > prev.last) latest.set(key, rec);
                  }
                }
                page++;
              }
            }

            const rows = [...latest.values()].sort((a,b)=> a.sure - b.sure || a.ayet - b.ayet);
            const lastUpdated = rows.reduce((m,x)=> m && m>x.last ? m : x.last, null);

            require('fs').mkdirSync('data', { recursive:true });
            fs.writeFileSync('data/normalized.json', JSON.stringify({ rows, lastUpdated }, null, 2), 'utf8');

      - uses: stefanzweifel/git-auto-commit-action@v5
        with:
          commit_message: "build: update data/normalized.json (last-write-wins)"
          file_pattern: data/normalized.json
```

> **Not:** Repo → Settings → Actions → **Workflow permissions**: “**Read and write**” yapmayı unutmayın.

### C) (Opsiyonel) Moderasyon Workflow’u

Beyaz liste dışındakileri **otomatik kapatmak** için:

```yaml
# .github/workflows/moderate-issues.yml
name: Moderate Issues
on: { issues: { types: [opened] } }
permissions: { contents: read, issues: write }
jobs:
  close_unallowed:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/github-script@v7
        with:
          script: |
            const allowed = new Set(['metinciris']); // beyaz liste
            const issue = context.payload.issue;
            const author = issue.user.login;
            if (!allowed.has(author)) {
              await github.rest.issues.createComment({
                owner: context.repo.owner, repo: context.repo.repo,
                issue_number: issue.number,
                body: "Bu depo yalnız belirli kullanıcıların kayıtlarını işler. Teşekkürler; issue otomatik kapatıldı."
              });
              await github.rest.issues.update({
                owner: context.repo.owner, repo: context.repo.repo,
                issue_number: issue.number, state: "closed", state_reason: "not_planned"
              });
            }
```

---

## 4) Kendine Ait Güncelleme Yerleri

* **Beyaz liste (zorunlu)**

  * `/.github/workflows/build-data.yml` içindeki:

    ```js
    const ALLOWED = new Set(['metinciris']);
    ```
  * (Varsa) `/.github/workflows/moderate-issues.yml` içindeki:

    ```js
    const allowed = new Set(['metinciris']);
    ```
  * Kendi GitHub kullanıcı adınızı yazın, ekip arkadaşlarınızı ekleyin.

* **Site başlık/metinleri (opsiyonel)**

  * `index.html` başlık, alt yazılar.
  * `styles.css` renk/kontrast (açık/koyu tema değişkenleri).
  * `app.js` içinde **Besmele metni** ve **TTS hızı (varsayılan 0.8)** değiştirilebilir.

* **PWA/Önbellek**

  * Yeni sürüm için `index.html`’de `?v=…` numaralarını artırın (`app.js?v=8`, `styles.css?v=8`).
  * Gerekirse tarayıcıda **Unregister Service Worker** + sert yenile.

---

## 5) Sorun Giderme (Kısa)

* **Site açıldı ama içerik görünmüyor**

  * `data/normalized.json` repoda var mı? (build-data workflow log’u → yeşil mi?)
  * PWA önbelleği eski olabilir → DevTools → Application → Service Workers → **Unregister** → yenile.

* **Issue açıyorum ama JSON güncellenmiyor**

  * Issue başlığı “`[Meal] …`” / “`[BulkMeal] …`” mı?
  * Siz beyaz listede misiniz? (`ALLOWED`)
  * Actions → Build Data log’unda hata var mı?

* **Issue’lara dışarıdan mesajlar geliyor**

  * `moderate-issues.yml` ekleyin (otomatik kapatsın).
  * Ya da repo’yu **private** + “collaborator” modeli.

---



Hepsi bu. Şimdi `meal2` repo’na bu dosyaları ekleyip **Issues → Meal Ekle/Güncelle** ile ilk kaydı gir; **Actions** çalışınca `data/normalized.json` oluşacak ve **[https://metinciris.github.io/meal2/](https://metinciris.github.io/meal2/)** üzerinde PWA arayüzüyle görünecek.

İstersen “Son eklenenler”, açık/koyu tema veya “fixlenmiş telaffuzlar” gibi küçük eklemeleri de hazırlarım.
