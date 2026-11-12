import fs from "fs";
import { JSDOM } from "jsdom";
const T = JSON.parse(fs.readFileSync(process.env.E2E_TOKENS || "./tokens.json"));
process.env.VITE_SUPABASE_URL = "http://localhost:3200";
process.env.VITE_SUPABASE_KEY = T.anon;

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/ru/property/1", pretendToBeVisual: true });
for (const k of ["window", "document", "localStorage", "sessionStorage", "HTMLElement", "Node", "MutationObserver", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame", "Element", "Event", "CustomEvent", "IntersectionObserver"]) { try { globalThis[k] = dom.window[k] ?? globalThis[k]; } catch {} }
Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
dom.window.matchMedia = dom.window.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
globalThis.matchMedia = dom.window.matchMedia;
globalThis.ResizeObserver = globalThis.ResizeObserver || class { observe() {} unobserve() {} disconnect() {} };
globalThis.IntersectionObserver = globalThis.IntersectionObserver || class { observe() {} unobserve() {} disconnect() {} };
dom.window.scrollTo = () => {}; globalThis.scrollTo = () => {};

const realFetch = globalThis.fetch; const hits = [];
globalThis.fetch = (u, i) => { hits.push(String(u)); return realFetch(u, i); };

const { createServer } = await import("vite");
const react = (await import("@vitejs/plugin-react")).default;
const root = process.cwd();
const stub = n => `${root}/tests/e2e/test-stubs/${n}.jsx`;
const server = await createServer({
  root, configFile: false, logLevel: "error", appType: "custom", server: { middlewareMode: true, hmr: false, ws: false },
  plugins: [react()], optimizeDeps: { noDiscovery: true },
  resolve: { alias: [
    { find: /^\.\.\/components\/(Villa|Property|Amenities|Feautured_one|Footer|Seo|CommercialHero|CommercialProperty|CommercialAmenities|Connect_one)$/, replacement: `${root}/tests/e2e/test-stubs/$1.jsx` },
    { find: /^\.\/Seo$/, replacement: stub("Seo") },
  ] },
});
await server.ssrLoadModule("/src/i18n.js");
const { MyProvider } = await server.ssrLoadModule("/src/Context.jsx");
const PropertyPage = (await server.ssrLoadModule("/src/pages/PropertyPage.jsx")).default;
const CommercialPage = (await server.ssrLoadModule("/src/pages/CommercialPage.jsx")).default;

const React = (await import("react")).default;
const { render, screen, waitFor, act, cleanup } = await import("@testing-library/react");
const { MemoryRouter, Routes, Route, useNavigate } = await import("react-router-dom");
const h = React.createElement;

let nav; const Nav = () => { nav = useNavigate(); return null; };
const mount = (path) => render(h(MyProvider, null, h(MemoryRouter, { initialEntries: [path] },
  h(Nav), h(Routes, null, h(Route, { path: "/:lang/property/:id", element: h(PropertyPage) }), h(Route, { path: "/:lang/commercial/:id", element: h(CommercialPage) })))));
const is404 = () => !!screen.queryByText("404");
const detail = () => screen.queryByTestId("detail")?.textContent ?? null;
const loadingShown = () => !!document.querySelector('[role="status"]');
const settle = async (cond, ms = 4000) => waitFor(() => { if (!cond()) throw new Error("wait"); }, { timeout: ms });

let fail = 0; const ok = (n, c, e = "") => { console.log((c ? "PASS " : "FAIL ") + n + (e ? "  " + e : "")); if (!c) fail++; cleanupNeeded = true; };
let cleanupNeeded = false;

mount("/ru/property/1");
ok("property/1: сразу после монтирования — состояние загрузки, не пустая страница", loadingShown() && !detail() && !is404());
await settle(() => detail() === "TG villa A");
ok("property/1 (is_draft=true в БД): показана, не скрыта", detail() === "TG villa A");

await act(async () => { nav("/ru/property/2"); });
ok("смена id 1→2: данные ПРЕДЫДУЩЕГО объекта не показываются (сразу загрузка)", detail() === null && loadingShown(), `detail=${detail()}`);
await settle(() => detail() === "TG villa B");
ok("property/2: показан новый объект", detail() === "TG villa B");

await act(async () => { nav("/ru/property/4"); }); await settle(() => detail() === "TG new villa");
ok("property/4 (только что создан ботом, is_draft=true): публичная страница работает", detail() === "TG new villa");

await act(async () => { nav("/ru/property/999"); });
ok("смена id 4→999: старые данные не видны во время загрузки", detail() === null);
await settle(() => is404());
ok("property/999 (нет в БД): страница 404, не пустая", is404() && detail() === null);

await act(async () => { nav("/ru/property/5"); }); await settle(() => is404());
ok("property/5 (карточка без страницы): 404", is404());

const before = hits.filter(u => u.includes("/villas")).length;
await act(async () => { nav("/ru/property/abc"); });
await settle(() => is404());
ok("property/abc: 404 без запроса к БД", is404() && hits.filter(u => u.includes("/villas")).length === before);
await act(async () => { nav("/ru/property/-1"); }); await settle(() => is404());
ok("property/-1: 404", is404());

await act(async () => { nav("/ru/property/1"); nav("/ru/property/2"); nav("/ru/property/1"); });
await settle(() => detail() === "TG villa A");
await new Promise(r => setTimeout(r, 600));
ok("гонка 1→2→1: итоговое состояние = последний объект, устаревший ответ не затёр", detail() === "TG villa A", `detail=${detail()}`);
cleanup();

mount("/ru/commercial/1");
ok("commercial/1: сначала загрузка", loadingShown() && !detail());
await settle(() => detail() === "TG office C");
ok("commercial/1 (is_draft=true в БД): показана", detail() === "TG office C");
await act(async () => { nav("/ru/commercial/2"); });
ok("смена 1→2: прошлый объект не виден", detail() !== "TG office C");
await settle(() => detail() === "TG new office");
ok("commercial/2 (только что создана ботом): публичная страница работает", detail() === "TG new office", `detail=${detail()}`);
await act(async () => { nav("/ru/commercial/3"); }); await settle(() => detail() === "c-nopage");
ok("commercial/3 (нет commercial_pages): упрощённая страница из commercials_public", detail() === "c-nopage");
await act(async () => { nav("/ru/commercial/999"); }); await settle(() => is404());
ok("commercial/999: 404", is404());
await act(async () => { nav("/ru/commercial/abc"); }); await settle(() => is404());
ok("commercial/abc: 404", is404());
cleanup();

console.log(fail ? `\n${fail} FAILED` : "\nВСЕ КЛИЕНТСКИЕ ПРОВЕРКИ ПРОЙДЕНЫ");
await server.close(); process.exit(fail ? 1 : 0);
