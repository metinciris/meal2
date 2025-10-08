// scripts/build-from-issues.mjs
// Node 20+. Issues -> data/normalized.json (tekil + toplu). Hatalara dayanıklı.

import { writeFileSync, mkdirSync } from "node:fs";
import { Octokit } from "octokit";

const { GITHUB_REPOSITORY, GITHUB_TOKEN } = process.env;
if (!GITHUB_REPOSITORY) {
  console.error("[build] GITHUB_REPOSITORY env yok.");
  process.exit(1);
}
if (!GITHUB_TOKEN) {
  console.error("[build] GITHUB_TOKEN env yok. Actions permissions'a bakın.");
  process.exit(1);
}

const [owner, repo] = GITHUB_REPOSITORY.split("/");
const octokit = new Octokit({ auth: GITHUB_TOKEN });

/* ---------- Yardımcılar ---------- */

// Issue Forms body’sinden alan çek (TR başlık varyasyonları toleranslı)
function pickFromBody(body, labelPattern) {
  const re = new RegExp(`###\\s*(${labelPattern})[\\s\\S]*?\\n([^#]+)`, "i");
  const m = body.match(re);
  return m ? (m[2] || "").trim() : "";
}
function toInt(x) {
  const n = parseInt(String(x ?? "").trim(), 10);
  return Number.isFinite(n) ? n : NaN;
}

// Başlıktan tekil sûre/ayet yakalama: "[Meal] Sûre 3 : Âyet 4"
function parseSingleFromTitle(title) {
  const m = /\[Meal\].*?S[ûu]re\s+(\d{1,3}).*?[ÂA]yet\s+(\d{1,3})/i.exec(title || "");
  if (!m) return null;
  return { sure: toInt(m[1]), ayet: toInt(m[2]) };
}

// Formlu tekil giriş parse
function parseSingleFromBody(body) {
  const sure = toInt(
    pickFromBody(body, "S[ûu]re\\s*\\(1-114\\)|Sure\\s*\\(1-114\\)")
  );
  const ayet = toInt(
    pickFromBody(body, "[ÂA]yet\\s*No")
  );
  const meal = pickFromBody(body, "Meal(\\s*Metni)?");
  const aciklama = pickFromBody(body, "Aç[ıi]klama|Aciklama");
  if (!Number.isFinite(sure) || !Number.isFinite(ayet) || !meal) return null;
  return { sure, ayet, meal, aciklama };
}

// Toplu metin: "1- ...", "2 - ...", "3. ...", "4 — ..." vb.
// Numara+ayraç ile başlayan satır yeni ayet; diğer satırlar bir öncekiye eklenir.
function parseBulkBlock(block) {
  const lines = (block || "").replace(/\r/g, "").split("\n");
  const out = [];
  let cur = null;

  const startRe = /^\s*(\d{1,3})\s*([\-–—.:])\s*(.*)$/; // 1- , 2 - , 3. , 4 — , 5:
  for (let raw of lines) {
    const line = raw.trimEnd();
    const m = startRe.exec(line);
    if (m) {
      const ayet = toInt(m[1]);
      const text = (m[3] || "").trim();
      if (Number.isFinite(ayet)) {
        cur = { ayet, meal: text };
        out.push(cur);
      } else {
        // numara değilse ek yer yok — atla
        cur = null;
      }
    } else if (cur) {
      // devam satırı: paragraf birleşsin
      cur.meal = (cur.meal ? cur.meal + "\n" : "") + line.trim();
    } // değilse boş/başsız satır; geç
  }
  // boş meal’leri ele
  return out.filter(x => x.meal && x.meal.trim());
}

// Toplu formu body’den parse
function parseBulkFromBody(body) {
  const sure = toInt(
    pickFromBody(body, "S[ûu]re\\s*\\(1-114\\)|Sure\\s*\\(1-114\\)")
  );
  const blob =
    pickFromBody(body, "Toplu\\s*Metin|Toplu\\s*Meal|Toplu")
    || pickFromBody(body, "Metin");
  if (!Number.isFinite(sure) || !blob) return null;
  const items = parseBulkBlock(blob).map(x => ({
    sure, ayet: x.ayet, meal: x.meal, aciklama: ""
  }));
  return items.length ? items : null;
}

/* ---------- Ana akış ---------- */

(async function run() {
  const latestByKey = new Map();
  let scanned = 0, accepted = 0;

  try {
    const states = ["open", "closed"]; // günceli yakala
    for (const state of states) {
      let page = 1;
      while (true) {
        const res = await octokit.rest.issues.listForRepo({
          owner, repo, state, per_page: 100, page
        });
        const items = res.data || [];
        if (!items.length) break;

        for (const it of items) {
          if (it.pull_request) continue; // PR değil
          scanned++;

          const title = it.title || "";
          const body = it.body || "";

          try {
            if (/^\s*\[BulkMeal\]/i.test(title)) {
              // TOPLU MOD
              const pack = parseBulkFromBody(body);
              if (!pack) { console.warn(`[skip] bulk parse edilemedi #${it.number}`); continue; }
              for (const rec of pack) {
                const key = `${rec.sure}:${rec.ayet}`;
                const normalized = {
                  sure: rec.sure,
                  ayet: rec.ayet,
                  meal: (rec.meal || "").trim(),
                  aciklama: (rec.aciklama || "").trim(),
                  last: it.updated_at
                };
                const prev = latestByKey.get(key);
                if (!prev || (normalized.last > prev.last)) latestByKey.set(key, normalized);
                accepted++;
              }
            } else if (/^\s*\[Meal\]/i.test(title)) {
              // TEKIL MOD
              let parsed = parseSingleFromBody(body);
              if (!parsed) {
                // Başlıktan dene
                const fromTitle = parseSingleFromTitle(title);
                if (fromTitle) {
                  parsed = {
                    ...fromTitle,
                    meal: pickFromBody(body, "Meal(\\s*Metni)?"),
                    aciklama: pickFromBody(body, "Aç[ıi]klama|Aciklama")
                  };
                }
              }
              if (!parsed || !parsed.meal) { console.warn(`[skip] tekil parse edilemedi #${it.number}`); continue; }
              const key = `${parsed.sure}:${parsed.ayet}`;
              const normalized = {
                sure: parsed.sure,
                ayet: parsed.ayet,
                meal: parsed.meal.trim(),
                aciklama: (parsed.aciklama || "").trim(),
                last: it.updated_at
              };
              const prev = latestByKey.get(key);
              if (!prev || (normalized.last > prev.last)) latestByKey.set(key, normalized);
              accepted++;
            } else {
              // Farklı issue → yok say
            }
          } catch (perIssueErr) {
            console.error(`[error] issue #${it.number}:`, perIssueErr?.message || perIssueErr);
          }
        }
        page++;
      }
    }

    const rows = [...latestByKey.values()].sort((x,y)=> x.sure - y.sure || x.ayet - y.ayet);
    const lastUpdated = rows.reduce((m,x)=> m && m>x.last ? m : x.last, null);

    mkdirSync("data", { recursive: true });
    writeFileSync("data/normalized.json", JSON.stringify({ rows, lastUpdated }, null, 2), "utf8");

    console.log(`[build] taranan issue: ${scanned}, kayda geçen kayıt: ${accepted}, toplam ayet: ${rows.length}`);
    console.log(`[build] lastUpdated: ${lastUpdated || '-'}`);
  } catch (e) {
    console.error("[build] genel hata:", e?.message || e);
    process.exit(1);
  }
})();
