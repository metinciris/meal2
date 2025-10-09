Aşağıdaki **çok basit README**’yi repo köküne `README.md` olarak koyabilirsin. Başkası kendi hesabına kopyalayıp hemen çalıştırabilir.

---

# Kuran’ın Gölgesinde (yalnız GitHub + PWA)

Canlı örnek: **[https://metinciris.github.io/meal2/](https://metinciris.github.io/meal2/)**
Bu proje **yalnız GitHub** üzerinde çalışır; meâller **Issues** ile girilir, site otomatik güncellenir.

---

## 1) Hızlı Başlangıç (Kendine Kopyala)

1. **Fork**
   Sağ üstten **Fork** → kendi hesabına kopyala.

2. **GitHub Pages**
   Repo → **Settings → Pages**

   * Source: **Deploy from a branch**
   * Branch: **main** (folder: **/** root) → **Save**
     Yayın adresin: `https://<kullanıcı>.github.io/<repo-adı>/`

3. **Actions izinleri**
   Repo → **Settings → Actions → General → Workflow permissions**
   → **Read and write permissions** seç → **Save**

4. (Opsiyonel) PWA
   Telefonda/PC’de sayfayı açınca “Uygulama olarak yükle” teklifi gelebilir.

> İlk açılışta veri olmayabilir. Aşağıdaki “Meâl Girme” adımını uygula.

---

## 2) Meâl Girme (Issues ile)

* “**Issues → New issue**” de, şablonlardan birini seç:

  * **[Meal] Tekil âyet**: bir sûre ve tek âyet
  * **[BulkMeal] Toplu âyet**: aynı sûrede birden çok âyet (satır satır `1- Metin`, `2- Metin` …)

* Issue’yu **Submit** edince Actions’daki **Build Data** akışı çalışır ve
  `data/normalized.json` güncellenir (her sûre/âyet için **son girilen geçerlidir**).

* Siteyi yenile. (PWA cache’i için bazen sert yenile gerekebilir.)

---

## 3) Kendi Kullanımına Göre Ayarla

* **Beyaz liste** (Issues’tan veri işlenecek kullanıcılar):
  `/.github/workflows/build-data.yml` içinde:

  ```js
  const ALLOWED = new Set(['<github-kullanıcı-adın>']);
  ```

  Gerekirse arkadaşlarını ekle: `['sen','arkadas1','arkadas2']`

* (İsteğe bağlı) **Moderasyon**:
  Dışarıdan biri issue açınca otomatik kapatmak için
  `/.github/workflows/moderate-issues.yml` ekle (ALLOWED listesi aynı olmalı).

* **Başlık/metinler/tema**:

  * `index.html` (başlıklar),
  * `styles.css` (renkler/tema),
  * `app.js` (TTS hızı varsayılan **0.8**, Besmele metni, vb.)

---

## 4) Sık Sorular / Sorun Giderme

* **Veri görünmüyor** → Actions → **Build Data** yeşil mi?
  `data/normalized.json` güncellendi mi?
  Tarayıcıda PWA **Service Worker → Unregister** + yenile.

* **Issue açtım ama veri yazılmıyor** →

  * Issue başlığı şablona uygun mu? (`[Meal] …`, `[BulkMeal] …`)
  * Sen ALLOWED listesindesin, değil mi?
  * Actions log’unda hata var mı?

* **Tema/kontrast** zayıf** → `styles.css`’te renk değişkenlerini editle.

---

## 5) Özellikler (kısa)

* **Tamamen GitHub tabanlı** (Google Sheets yok)
* **Issues → otomatik veri derleme** (son girilen kazanır)
* **PWA** (uygulama gibi yüklenebilir)
* **TTS**: Sûre içinde “Başlat/Durdur”, âyete tıklayarak o âyetten okuma
* **Basmae**: Fâtiha hariç sûre başında gösterilir

---

Hepsi bu kadar. Forkla → Pages’i aç → Issues’tan meâl gir → site otomatik güncellensin.
