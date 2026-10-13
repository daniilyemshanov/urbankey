// Повторный разбор старых постов канала через тот же парсер (Haiku → цепочка → regex),
// что и новые посты. Источник текста — экспорт Telegram Desktop (result.json).
//
// Запуск (из корня проекта, Node 20.6+):
//
//   # 1. Пробный прогон: ничего не пишет в БД, показывает "было → стало", кэширует ответы ИИ
//   node --env-file=.env scripts/reparse-telegram.mjs --file result.json
//
//   # 2. Запись (использует кэш из шага 1 — ИИ второй раз не вызывается, деньги не тратятся)
//   node --env-file=.env scripts/reparse-telegram.mjs --file result.json --apply
//
//   # Откат из резервной копии
//   node --env-file=.env scripts/reparse-telegram.mjs --rollback backups/reparse-XXXX.json
//
// Флаги:
//   --only 847,852     только эти id постов (tg_message_id)
//   --limit 5          только первые N постов (удобно для проверки на малом числе)
//   --offline          без БД и без Supabase: только разбор и вывод (для проверки парсера)
//   --fresh            игнорировать кэш, разобрать заново
//   --allow-regex      разрешить запись результатов запасного regex-парсера (по умолчанию такие посты пропускаются,
//                      чтобы сбой ИИ не испортил карточки)
//   --concurrency 2    параллельных запросов к ИИ (по умолчанию 2)
//   --chat-id -100...  tg_chat_id карточек (по умолчанию -100<id канала из экспорта>)
//
// Нужны переменные: ANTHROPIC_API_KEY (или другой ключ ИИ), VITE_SUPABASE_URL, SUPABASE_SERVICE_KEY.
// Фото, видео, ссылки (link), slug страниц, tg_* поля и избранное НЕ меняются.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { getParsedListing, fillMissingTranslations } from "../api/listingParser.js";
import { buildCardRow, buildPagePayload, checkCardDisplay, omitEmpty } from "../api/_listingDb.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CACHE_FILE = path.join(ROOT, "scripts", ".reparse-cache.json");
const BACKUP_DIR = path.join(ROOT, "backups");

// ---------- аргументы ----------
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt = (name, def = null) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : def;
};

const APPLY = flag("apply");
const OFFLINE = flag("offline");
const FRESH = flag("fresh");
const ALLOW_REGEX = flag("allow-regex");
const CONCURRENCY = Math.max(1, Number(opt("concurrency", 2)) || 2);
const LIMIT = Number(opt("limit", 0)) || 0;
const ONLY = opt("only") ? new Set(opt("only").split(",").map((s) => Number(s.trim()))) : null;

// ---------- вспомогательное ----------
const BOT_REPLY = /^(✅|⚠️|❌|✏️|ℹ️)/;

function flattenText(t) {
    if (Array.isArray(t)) return t.map((p) => (typeof p === "string" ? p : p?.text || "")).join("");
    return t || "";
}

function loadPosts(file) {
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    const channelId = String(data.id);
    const posts = [];

    for (const m of data.messages || []) {
        if (m.type !== "message") continue;
        const text = flattenText(m.text).trim();
        if (!text || BOT_REPLY.test(text)) continue; // ответы самого бота и пустые сообщения
        if (text.length < 40) continue;
        posts.push({ id: m.id, date: m.date, text });
    }
    return { channelId, posts };
}

const readJson = (file, fallback) => {
    try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; }
};

async function pool(items, size, worker) {
    let next = 0;
    const run = async () => {
        while (next < items.length) {
            const i = next++;
            await worker(items[i], i);
        }
    };
    await Promise.all(Array.from({ length: Math.min(size, items.length) }, run));
}

const short = (v) => {
    const s = v == null ? "∅" : String(typeof v === "object" ? JSON.stringify(v) : v).replace(/\s+/g, " ");
    return s.length > 90 ? `${s.slice(0, 90)}…` : s;
};

function diffRows(oldRow, newRow) {
    const lines = [];
    for (const [k, v] of Object.entries(newRow)) {
        const before = oldRow ? oldRow[k] : undefined;
        if (JSON.stringify(before ?? null) === JSON.stringify(v ?? null)) continue;
        lines.push(`      ${k}: ${short(before)}  →  ${short(v)}`);
    }
    return lines;
}

// ---------- разбор одного поста (то же, что processPost в webhook) ----------
async function parsePost(post) {
    const parsed = await getParsedListing(post.text);

    if (!parsed.isSold) {
        await fillMissingTranslations(parsed, ["title", "description", "about"]);
        if (parsed.isCommercial) {
            await fillMissingTranslations(parsed.commercialFields, ["district", "address", "landmark"]);
        }
    }
    return parsed;
}

// ---------- откат ----------
async function rollback(file, supabase) {
    const backup = readJson(file, null);
    if (!backup?.items) throw new Error(`Не удалось прочитать ${file}`);

    let ok = 0;
    for (const it of backup.items) {
        for (const part of [it.card, it.page]) {
            if (!part?.old) continue;
            const { id, ...rest } = part.old;
            const { error } = await supabase.from(part.table).update(rest).eq("id", id);
            if (error) console.log(`  ❌ ${part.table}#${id}: ${error.message}`);
            else ok++;
        }
    }
    console.log(`Откат выполнен: восстановлено строк — ${ok}`);
}

// ---------- main ----------
async function main() {
    let supabase = null;

    if (!OFFLINE) {
        if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
            throw new Error("Нужны VITE_SUPABASE_URL и SUPABASE_SERVICE_KEY (или запустите с --offline)");
        }
        const { createClient } = await import("@supabase/supabase-js");
        supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    }

    const rollbackFile = opt("rollback");
    if (rollbackFile) {
        if (!supabase) throw new Error("Для отката нужна БД (без --offline)");
        return rollback(rollbackFile, supabase);
    }

    const file = opt("file");
    if (!file) throw new Error("Укажите --file result.json");

    const { channelId, posts: allPosts } = loadPosts(file);
    const chatId = Number(opt("chat-id", `-100${channelId}`));

    let posts = allPosts;
    if (ONLY) posts = posts.filter((p) => ONLY.has(p.id));
    if (LIMIT) posts = posts.slice(0, LIMIT);

    console.log(`Канал ${channelId} (chat_id ${chatId}). Постов с текстом: ${allPosts.length}, в работе: ${posts.length}`);
    console.log(APPLY ? "РЕЖИМ: ЗАПИСЬ В БД\n" : "РЕЖИМ: пробный прогон (в БД ничего не пишется)\n");

    // 1. разбор (с кэшем)
    const cache = FRESH ? {} : readJson(CACHE_FILE, {});
    let aiCalls = 0;

    await pool(posts, CONCURRENCY, async (post) => {
        const key = `${post.id}:${post.text.length}`;
        if (cache[key]) { post.parsed = cache[key]; return; }
        post.parsed = await parsePost(post);
        aiCalls++;
        // результат запасного regex-парсера (ИИ не ответил) в кэш не кладём — при следующем запуске попробуем снова
        if (OFFLINE || post.parsed.diagnostics?.source === "regex") return;
        cache[key] = post.parsed;
        process.stdout.write(".");
    });
    if (aiCalls) console.log(`\nРазобрано заново: ${aiCalls}`);
    if (!OFFLINE) fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));

    // 2. сопоставление с БД и план изменений
    const plan = [];
    const stats = { updated: 0, same: 0, notFound: 0, sold: 0, typeChanged: 0, fallback: 0, errors: 0 };

    for (const post of posts) {
        const parsed = post.parsed;
        const label = `#${post.id} «${short(parsed.title_ru)}»`;

        if (parsed.isSold) { stats.sold++; console.log(`⏭  ${label}: помечено как проданное — пропуск`); continue; }

        if (!OFFLINE && !ALLOW_REGEX && parsed.diagnostics?.source === "regex") {
            stats.fallback++;
            console.log(`⏭  ${label}: ИИ не ответил (сработал запасной regex) — пропуск. Повторите запуск позже или добавьте --allow-regex`);
            continue;
        }

        const wantTable = parsed.isCommercial ? "commercials" : "cardss";
        const { row: cardRow } = buildCardRow(parsed, { image: "", videoUrl: "", tgChatId: chatId, tgMessageId: post.id });

        // поля, которые не трогаем
        for (const k of ["image", "video", "tg_chat_id", "tg_message_id"]) delete cardRow[k];
        const cardUpdate = omitEmpty(cardRow);

        const pageTable = parsed.isCommercial ? "commercial_pages" : "villas";
        const linkField = parsed.isCommercial ? "commercial_id" : "card_id";

        if (OFFLINE) {
            console.log(`\n${label}  [${wantTable}]  цена: ${short(parsed.price)}  источник: ${parsed.diagnostics?.provider || parsed.diagnostics?.source}`);
            for (const l of diffRows(null, cardUpdate)) console.log(l);
            plan.push({ post, parsed });
            continue;
        }

        // поиск карточки: сначала в ожидаемой таблице, потом в другой
        const find = async (table) => {
            const { data } = await supabase.from(table).select("*").eq("tg_chat_id", chatId).eq("tg_message_id", post.id).maybeSingle();
            return data ? { table, row: data } : null;
        };
        const other = wantTable === "cardss" ? "commercials" : "cardss";
        const hit = (await find(wantTable)) || null;
        const otherHit = hit ? null : await find(other);

        if (!hit && !otherHit) { stats.notFound++; console.log(`❓ ${label}: карточка в БД не найдена (нет tg_message_id=${post.id})`); continue; }
        if (otherHit) {
            stats.typeChanged++;
            console.log(`⚠️  ${label}: раньше «${other}», сейчас парсер говорит «${wantTable}» — пропуск (проверьте вручную)`);
            continue;
        }

        const card = hit;

        // страница объекта
        const { data: pageOld } = await supabase.from(pageTable).select("*").eq(linkField, card.row.id).maybeSingle();
        let pageUpdate = null;

        if (pageOld) {
            const payload = buildPagePayload(parsed, { table: pageTable, linkIdField: linkField, cardId: card.row.id, images: [], videoUrl: "" });
            await fillMissingTranslations(payload, ["location"]);
            for (const k of [linkField, "slug", "images", "video", "is_draft"]) delete payload[k];
            pageUpdate = omitEmpty(payload);
        }

        const cardDiff = diffRows(card.row, cardUpdate);
        const pageDiff = pageUpdate ? diffRows(pageOld, pageUpdate) : [];

        checkCardDisplay(parsed);

        if (!cardDiff.length && !pageDiff.length) { stats.same++; continue; }

        console.log(`\n✏️  ${label}  (${card.table}#${card.row.id}${pageOld ? ` + ${pageTable}#${pageOld.id}` : ", страницы нет"})`);
        if (cardDiff.length) { console.log("    карточка:"); cardDiff.forEach((l) => console.log(l)); }
        if (pageDiff.length) { console.log("    страница:"); pageDiff.forEach((l) => console.log(l)); }

        plan.push({
            post,
            card: { table: card.table, id: card.row.id, old: card.row, update: cardUpdate },
            page: pageOld ? { table: pageTable, id: pageOld.id, old: pageOld, update: pageUpdate } : null,
        });
    }

    if (OFFLINE) return;

    // 3. запись
    if (APPLY && plan.length) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
        const backupFile = path.join(BACKUP_DIR, `reparse-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);

        // резервная копия ДО записи
        fs.writeFileSync(backupFile, JSON.stringify({
            createdAt: new Date().toISOString(),
            items: plan.map((p) => ({
                postId: p.post.id,
                card: { table: p.card.table, old: p.card.old },
                page: p.page ? { table: p.page.table, old: p.page.old } : null,
            })),
        }, null, 2));
        console.log(`\nРезервная копия: ${backupFile}`);

        for (const p of plan) {
            const { error: e1 } = await supabase.from(p.card.table).update(p.card.update).eq("id", p.card.id);
            if (e1) { stats.errors++; console.log(`  ❌ ${p.card.table}#${p.card.id}: ${e1.message}`); continue; }

            if (p.page) {
                const { error: e2 } = await supabase.from(p.page.table).update(p.page.update).eq("id", p.page.id);
                if (e2) { stats.errors++; console.log(`  ❌ ${p.page.table}#${p.page.id}: ${e2.message}`); continue; }
            }
            stats.updated++;
        }
    } else {
        stats.updated = plan.length;
    }

    console.log(`\n— Итог —`);
    console.log(`${APPLY ? "Обновлено" : "Будет обновлено"}: ${stats.updated}`);
    console.log(`Без изменений: ${stats.same} | Не найдено в БД: ${stats.notFound} | Проданные: ${stats.sold} | Сменили тип: ${stats.typeChanged} | ИИ не ответил: ${stats.fallback} | Ошибок: ${stats.errors}`);
    if (!APPLY) console.log("\nЕсли всё выглядит нормально — запустите то же самое с --apply (ИИ второй раз не вызывается, берётся кэш).");
}

main().catch((e) => {
    console.error("ОШИБКА:", e.message);
    process.exit(1);
});
