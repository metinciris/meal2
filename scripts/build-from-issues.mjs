// Node 20. Issues -> data/normalized.json üretir (etikete BAĞLI DEĞİL).
import { writeFileSync, mkdirSync } from "node:fs";
import { Octokit } from "octokit";

const { GITHUB_REPOSITORY, GITHUB_TOKEN } = process.env;
if (!GITHUB_REPOSITORY) { console.error("GITHUB_REPOSITORY env yok."); process.exit(1); }
const [owner, repo] = GITHUB_REPOSITORY.split("/");

const octokit = new Octokit({ auth: GITHUB_TOKEN });

// Issue Forms gövdesinden alanları çek (başlıklar TR/variations destekli)
function parseIssueBody(body) {
  const pick = (label) => {
    const re = new RegExp(`###\\s*${label}[\\s\\S]*?\\n([^#]+)`, "i");
    const m = body.match(re);
    return m ? m[1].trim() : "";
  };
  const sure = pick("S[ûu]re \\(1-114\\)"); // Sûre/Sure ikisi de
  const ayet = pick("Âyet No|Ayet No");
  const meal = pick("Meal Metni|Meal");
  const aciklama = pick("Aç[ıi]klama"); // Açıklama/Acklama vs.
  return { sure, ayet, meal, aciklama };
}

const toInt = x => {
  const n = parseInt(String(x||"").trim(), 10);
  return Number.isFinite(n) ? n : NaN;
};

(async function run() {
  const latestByKey = new Map();
  const states = ["open", "closed"]; // günceli yakalamak için her ikisi

  for (const state of states) {
    let page = 1;
    while (true) {
      // ETIKETLE SINIRLAMA YOK — TÜM ISSUE'LAR
      const res = await octokit.rest.issues.listForRepo({
        owner, repo, state, per_page: 100, page
      });
      const items = res.data;
      if (!items.length) break;

      for (const it of items) {
        // Pull request'leri atla
        if (it.pull_request) continue;

        // 1) Öncelik: [Meal] başlıklı olanlar
        const titleLooksMeal = /^\s*\[Meal]/i.test(it.title || "");

        // 2) Form gövdesini parse et
        let s, a, meal = "", aciklama = "";
        if (it.body) {
          const p = parseIssueBody(it.body);
          s = toInt(p.sure);
          a = toInt(p.ayet);
          meal = (p.meal || "").trim();
          aciklama = (p.aciklama || "").trim();
        }

        // [Meal] başlık + "Sûre/Ayet/Meal" parse edilebildiyse al
        // (Başlık tetik, parse zorunlu; parse yoksa dışarıda kalsın)
        if (titleLooksMeal && Number.isFinite(s) && Number.isFinite(a) && meal) {
          const key = `${s}:${a}`;
          const rec = { sure:s, ayet:a, meal, aciklama, last: it.updated_at };
          const prev = latestByKey.get(key);
          if (!prev || (rec.last > prev.last)) latestByKey.set(key, rec);
        }
      }
      page++;
    }
  }

  const rows = [...latestByKey.values()].sort((x,y)=> x.sure - y.sure || x.ayet - y.ayet);
  const lastUpdated = rows.reduce((m,x)=> m && m>x.last ? m : x.last, null);

  mkdirSync("data", { recursive: true });
  writeFileSync("data/normalized.json", JSON.stringify({ rows, lastUpdated }, null, 2), "utf8");
  console.log(`OK: ${rows.length} kayıt yazıldı. Son güncelleme: ${lastUpdated || "-"}`);
})();
