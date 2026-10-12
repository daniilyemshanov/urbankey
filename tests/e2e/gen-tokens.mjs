// Генерирует тестовые JWT (anon / user / admin) для локального PostgREST.
// Секрет должен совпадать с jwt-secret в конфиге PostgREST (см. README.md).
import crypto from "crypto";
import fs from "fs";
const secret = process.env.E2E_JWT_SECRET || "super-secret-jwt-token-with-at-least-32-characters-long";
const b = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (p) => { const h = b({ alg: "HS256", typ: "JWT" }), d = b(p); return `${h}.${d}.${crypto.createHmac("sha256", secret).update(`${h}.${d}`).digest("base64url")}`; };
const exp = Math.floor(Date.now() / 1000) + 86400;
fs.writeFileSync(process.env.E2E_TOKENS || "./tokens.json", JSON.stringify({
  anon: jwt({ role: "anon", exp }),
  service: jwt({ role: "service_role", exp }),
  user: jwt({ role: "authenticated", sub: "bbbbbbbb-0000-0000-0000-000000000002", exp }),
  admin: jwt({ role: "authenticated", sub: "aaaaaaaa-0000-0000-0000-000000000001", exp }),
}));
console.log("tokens.json создан");
