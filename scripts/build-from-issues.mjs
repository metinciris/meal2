// Node 20+. Issues -> data/* JSON. Beyaz liste + manifest + per-sûre.

import { writeFileSync, mkdirSync } from "node:fs";
import { Octokit } from "octokit";
import { dirname } from "node:path";

const { GITHUB_REPOSITORY, GITHUB_TOKEN } = process.env;
if (!GITHUB_REPOSITORY) { console.error("[build] GITHUB_REPOSITORY env yok."); process.exit(1); }
if (!GITHUB_TOKEN) { console.error("[build] GITHUB_TOKEN env yok."); process.exit(1); }

const [owner, repo] = GITHUB_REPOSITORY.split("/");
const octokit = new Octokit({ auth: GITHUB_TOKEN });

/* ===== Beyaz liste ===== */
const ALLOWED_AUTHORS = new Set([
  "metinciris",
  // "baska-kullanici",
]);

/* ===== Yardımcılar ===== */
function pickFromBody(body, labelPattern) {
  const re = new RegExp(`###\\s*(?:${labelPattern})\\s*\\n([\\s\\S]*?)(?=\\n###|$)`, "i");
  const m = (body || "").match(re);
  let val = m ? (m[1] || "").trim() : "";
  if (/^_?no response_?$/i.test(val)) val = "";
  return val;
}
const toInt = (x) => {
  const n = parseInt(String(x ?? "").trim(), 10);
  return Number.isFinite(n) ? n : NaN;
};
function parseSingleFromTitle(title) {
  const m = /\[Meal\].*?S[ûu]re\s+(\d{1,3}).*?[ÂA]yet\s+(\d{1,3})/i.exec(title || "");
  return m ? { sure: toInt(m[1]), ayet: toInt(m[2]) } : null;
}
function parseSingleFromBody(body) {
  const sure = toInt(pickFromBody(body, "S[ûu]re\\s*\\(1-114\\)|Sure\\s*\\(1-114\\)"));
  const ayet = toInt(pickFromBody(body, "[ÂA]yet\\s*No"));
  const meal = pickFromBody(body, "Meal(?:\\s*Metni)?|Meal");
  const aciklama = pickFromBody(body, "Aç(?:ı|i)klama(?:\\s*\\(opsiyonel\\))?");
  if (!Number.isFinite(sure) || !Number.isFinite(ayet) || !meal) return null;
  return { sure, ayet, meal, aciklama };
}
function parseBulkBlock(block) {
  const lines = (block || "").replace(/\r/g, "").split("\n");
  const out = []; let cur = null;
  const startRe = /^\s*(\d{1,3})\s*([\-–—.:])\s*(.*)$/;
  for (let raw of lines) {
    const line = raw.trimEnd();
    const m = startRe.exec(line);
    if (m) {
      const ayet = toInt(m[1]); const text = (m[3] || "").trim();
      if (Number.isFinite(ayet)) { cur = { ayet, meal: text }; out.push(cur); } else { cur = null; }
    } else if (cur) {
      const t = line.trim(); if (t) cur.meal = (cur.meal ? cur.meal + "\n" : "") + t;
    }
  }
  return out.filter(x => x.meal && x.meal.trim());
}
function parseBulkFromBody(body) {
  const sure = toInt(pickFromBody(body, "S[ûu]re\\s*\\(1-114\\)|Sure\\s*\\(1-114\\)"));
  const blob = pickFromBody(body, "Toplu\\s*Metin|Toplu\\s*Meal|Toplu|Metin");
  if (!Number.isFinite(sure) || !blob) return null;
  const items = parseBulkBlock(blob).map(x => ({ sure, ayet: x.ayet, meal: x.meal, aciklama: "" }));
  return items.length ? items : null;
}

/* ===== Ana akış ===== */
(async function run() {
  const latestByKey = new Map();
  let scanned = 0, accepted = 0, skipped = 0;

  try {
    const states = ["open", "closed"];
    for (const state of states) {
      let page = 1;
      while (true) {
        const res = await octokit.rest.issues.listForRepo({ owner, repo, state, per_page: 100, page });
        const items = res.data || [];
        if (!items.length) break;

        for (const it of items) {
          if (it.pull_request) continue;
          scanned++;

          // BEYAZ LİSTE
          const author = it.user?.login || "";
          if (!ALLOWED_AUTHORS.has(author)) {
            skipped++; console.warn(`[skip] yetkisiz: @${author} #${it.number}`); continue;
          }

          const title = it.title || ""; const body = it.body || "";
          try {
            if (/^\s*\[BulkMeal\]/i.test(title)) {
              const pack = parseBulkFromBody(body);
              if (!pack) { console.warn(`[skip] bulk parse edilemedi #${it.number}`); continue; }
              for (const rec of pack) {
                const key = `${rec.sure}:${rec.ayet}`;
                const normalized = { sure: rec.sure, ayet: rec.ayet, meal: rec.meal.trim(), aciklama: "", last: it.updated_at };
                const prev = latestByKey.get(key);
                if (!prev || (normalized.last > prev.last)) latestByKey.set(key, normalized);
                accepted++;
              }
            } else if (/^\s*\[Meal\]/i.test(title)) {
              let parsed = parseSingleFromBody(body);
              if (!parsed) {
                const fromTitle = parseSingleFromTitle(title);
                if (fromTitle) {
                  parsed = {
                    ...fromTitle,
                    meal: pickFromBody(body, "Meal(?:\\s*Metni)?|Meal"),
                    aciklama: pickFromBody(body, "Aç(?:ı|i)klama(?:\\s*\\(opsiyonel\\))?")
                  };
                }
              }
              if (!parsed || !parsed.meal) { console.warn(`[skip] tekil parse edilemedi #${it.number}`); continue; }
              const key = `${parsed.sure}:${parsed.ayet}`;
              const normalized = { sure: parsed.sure, ayet: parsed.ayet, meal: parsed.meal.trim(), aciklama: (parsed.aciklama||"").trim(), last: it.updated_at };
              const prev = latestByKey.get(key);
              if (!prev || (normalized.last > prev.last)) latestByKey.set(key, normalized);
              accepted++;
            } else {
              // diğer issue tipleri: yok say
            }
          } catch (perIssueErr) {
            console.error(`[error] issue #${it.number}:`, perIssueErr?.message || perIssueErr);
          }
        }
        page++;
      }
    }

    const all = [...latestByKey.values()].sort((a,b)=> a.sure - b.sure || a.ayet - b.ayet);
    const lastUpdated = all.reduce((m,x)=> m && m>x.last ? m : x.last, null);

    // ÇIKTILAR
    mkdirSync("data/surah", { recursive: true });

    // 1) normalized.json (tamamı — geriye uyum için)
    writeFileSync("data/normalized.json", JSON.stringify({ rows: all, lastUpdated }, null, 2), "utf8");

    // 2) per-sûre dosyaları
    const bySurah = new Map();
    for (const r of all) {
      if (!bySurah.has(r.sure)) bySurah.set(r.sure, []);
      bySurah.get(r.sure).push(r);
    }
    for (let s = 1; s <= 114; s++) {
      const rows = (bySurah.get(s) || []).sort((a,b)=> a.ayet - b.ayet);
      const payload = { sure: s, rows, lastUpdated };
      writeFileSync(`data/surah/${s}.json`, JSON.stringify(payload), "utf8");
    }

    // 3) manifest.json (ana sayfayı hızlı çizmek için)
    const AYAHS = [0,7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6];
    const progress = [];
    for (let s=1; s<=114; s++){
      const arr = bySurah.get(s) || [];
      progress.push({ s, done: arr.length, total: AYAHS[s] });
    }
    writeFileSync("data/manifest.json", JSON.stringify({ lastUpdated, progress }, null, 2), "utf8");

    console.log(`[build] taranan: ${scanned}, kabul: ${accepted}, skip(yetkisiz): ${skipped}`);
    console.log(`[build] toplam ayet: ${all.length}, lastUpdated: ${lastUpdated || '-'}`);
  } catch (e) {
    console.error("[build] genel hata:", e?.message || e);
    process.exit(1);
  }
})();
