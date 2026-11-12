import fs from "fs";
const T = JSON.parse(fs.readFileSync(process.env.E2E_TOKENS || "./tokens.json"));
const B = "http://localhost:3100";
const call = async (who, method, path, body) => {
  const r = await fetch(B + path, { method, headers: { apikey: T[who], Authorization: `Bearer ${T[who]}`, "Content-Type": "application/json", Prefer: "return=representation" }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); let j; try { j = JSON.parse(t) } catch { j = t } return { status: r.status, body: j };
};
let fail = 0; const ok = (n, c, e = "") => { console.log((c ? "PASS " : "FAIL ") + n + (e ? "  " + e : "")); if (!c) fail++; };
const ids = (r, k = "id") => Array.isArray(r.body) ? r.body.map(x => x[k]).sort((a, b) => a - b).join(",") : `ERR${r.status}`;

for (const who of ["anon", "user", "admin"]) {
  ok(`${who}: каталог жилья = 1,2,3,4 (включая объекты с is_draft=true)`, ids(await call(who, "GET", "/cardss_public?select=id")) === "1,2,3,4");
  ok(`${who}: каталог коммерции = 1,2`, ids(await call(who, "GET", "/commercials_public?select=id")) === "1,2");
  const v = await call(who, "GET", "/villas?select=card_id,is_draft&card_id=eq.1");
  ok(`${who}: страница объекта с is_draft=true читается`, ids(v, "card_id") === "1" && v.body[0].is_draft === true);
  ok(`${who}: commercial_pages с is_draft=true читается`, ids(await call(who, "GET", "/commercial_pages?select=commercial_id&commercial_id=eq.2"), "commercial_id") === "2");
}
const w = await call("anon", "PATCH", "/villas?card_id=eq.1", { title_ru: "HACK" });
ok("anon: запись в villas запрещена", w.status >= 400 || (Array.isArray(w.body) && w.body.length === 0));
const uw = await call("user", "PATCH", "/villas?card_id=eq.1", { title_ru: "HACK" });
ok("user: чужую страницу править нельзя", uw.status >= 400 || (Array.isArray(uw.body) && uw.body.length === 0));
const own = await call("user", "PATCH", "/villas?card_id=eq.3", { title_ru: "User villa D edited" });
ok("user: свою страницу править можно", own.status === 200 && own.body.length === 1);
const ed = await call("admin", "PATCH", "/villas?card_id=eq.1", { title_ru: "TG villa A" });
ok("admin: правит любую страницу, is_draft при этом не меняется", ed.status === 200 && ed.body.length === 1 && ed.body[0].is_draft === true);
const leak = await call("anon", "GET", "/cardss?select=owner_phone");
ok("owner_phone закрыт", leak.status >= 400);
const cols = await call("anon", "GET", "/cardss_public?limit=1");
ok("view не отдаёт owner_phone", cols.body[0] && !("owner_phone" in cols.body[0]));
console.log(fail ? `\n${fail} FAILED` : "\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ"); process.exit(fail ? 1 : 0);
