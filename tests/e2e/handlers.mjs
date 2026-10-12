import fs from "fs";
const T = JSON.parse(fs.readFileSync(process.env.E2E_TOKENS || "./tokens.json"));
process.env.VITE_SUPABASE_URL = "http://localhost:3200";
process.env.VITE_SUPABASE_KEY = T.anon;
const realFetch = globalThis.fetch;
let shellCalls = [];
globalThis.fetch = async (url, init) => {
  if (String(url).endsWith("/index.html")) { shellCalls.push({url:String(url), headers:init?.headers}); return { ok: true, status: 200, headers: { get: () => "text/html" }, text: async () => "<html><div id=\"root\"></div>SHELL</html>" }; }
  return realFetch(url, init);
};
const sitemap = (await import("../../api/sitemap.js")).default;
const spa = (await import("../../api/spa.js")).default;
const mk = () => { const r = { h: {}, status(c) { r.code = c; return r }, setHeader(k, v) { r.h[k] = v }, send(b) { r.body = b; return r } }; return r };
let fail = 0; const ok = (n, c, e = "") => { console.log((c ? "PASS " : "FAIL ") + n + (e ? "  " + e : "")); if (!c) fail++ };

const s = mk(); await sitemap({ headers: {} }, s);
const ru = [...s.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]).filter(l => l.startsWith("https://urbankey.uz/ru"));
console.log("sitemap /ru urls:", ru.map(u => u.replace("https://urbankey.uz", "")).join(" "));
ok("sitemap 200 xml", s.code === 200 && /xml/.test(s.h["Content-Type"]));
const has = p => ru.includes("https://urbankey.uz/ru" + p);
ok("sitemap: все объекты с detail-страницей, включая is_draft=true и новый из Telegram (1,2,3,4)", [1, 2, 3, 4].every(i => has("/property/" + i)));
ok("sitemap: коммерция с detail-страницей, включая новую из Telegram (1,2)", has("/commercial/1") && has("/commercial/2"));
ok("sitemap: карточка без страницы (5) и villa без карточки (99) не включены", !has("/property/5") && !has("/property/99"));
ok("sitemap: коммерция без commercial_pages (3) не включена", !has("/commercial/3"));
ok("sitemap: нет query/hash/фильтров", !s.body.match(/<loc>[^<]*[?#]/));
ok("sitemap: 5 статических страниц", ["", "/Properties", "/AboutUs", "/Services", "/ContactUs"].every(has));

const run = async (kind, id) => { const r = mk(); await spa({ query: { kind, id }, headers: { host: "urbankey.uz", "x-forwarded-proto": "https" } }, r); return r };
for (const [kind, id, want] of [["property", "1", 200], ["property", "2", 200], ["property", "3", 200], ["property", "4", 200], ["property", "5", 404], ["property", "999", 404], ["property", "abc", 404], ["property", "-1", 404], ["property", "1; drop table", 404], ["commercial", "1", 200], ["commercial", "2", 200], ["commercial", "3", 200], ["commercial", "999", 404], ["notfound", undefined, 404]]) {
  const r = await run(kind, id); ok(`spa ${kind}/${id ?? "-"} -> ${want}`, r.code === want, `got ${r.code}`);
}
const r404 = await run("property", "999");
ok("404: тело = SPA-оболочка, X-Robots-Tag: noindex", r404.body.includes("SHELL") && r404.h["X-Robots-Tag"] === "noindex");
console.log(fail ? `\n${fail} FAILED` : "\nOK"); process.exit(fail ? 1 : 0);
