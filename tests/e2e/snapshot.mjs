import fs from "fs";
const T = JSON.parse(fs.readFileSync(process.env.E2E_TOKENS || "./tokens.json"));
const FILE = process.env.E2E_SNAPSHOT || "./snapshot.json";
const get = async (path) => {
  const r = await fetch("http://localhost:3200/rest/v1" + path, { headers: { apikey: T.anon, Authorization: `Bearer ${T.anon}` } });
  const j = await r.json(); if (!Array.isArray(j)) throw new Error(path + " -> " + JSON.stringify(j));
  return j;
};
const now = {
  catalog: (await get("/cardss_public?select=id&order=id")).map(x => x.id),
  commercials: (await get("/commercials_public?select=id&order=id")).map(x => x.id),
  property_pages: (await get("/villas?select=card_id&order=card_id")).map(x => x.card_id),
  commercial_pages: (await get("/commercial_pages?select=commercial_id&order=commercial_id")).map(x => x.commercial_id),
};
if (process.argv[2] === "save") { fs.writeFileSync(FILE, JSON.stringify(now)); console.log("snapshot saved:", JSON.stringify(now)); process.exit(0); }
const before = JSON.parse(fs.readFileSync(FILE));
let fail = 0; const ok = (n, c, e = "") => { console.log((c ? "PASS " : "FAIL ") + n + (e ? "  " + e : "")); if (!c) fail++; };
for (const k of Object.keys(before)) {
  const lost = before[k].filter(id => !now[k].includes(id)); const added = now[k].filter(id => !before[k].includes(id));
  ok(`${k}: ничего не исчезло`, lost.length === 0, lost.length ? "ПРОПАЛИ " + lost : `(было ${before[k].length}, стало ${now[k].length})`);
  ok(`${k}: новый объект из Telegram появился`, added.length >= 1, "новые id: " + added);
}
console.log(fail ? `\n${fail} FAILED` : "\nOK"); process.exit(fail ? 1 : 0);
