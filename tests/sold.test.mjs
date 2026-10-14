import test from "node:test";
import assert from "node:assert/strict";
import { propertyExists, commercialExists } from "../api/_publicDb.js";
import {
    isSoldKeyword,
    findListingForReply,
    markListingSold,
    soldReplyText,
} from "../api/_listingDb.js";

test("isSoldKeyword: короткие отметки о сделке", () => {
    for (const t of ["ПРОДАНО", "Продано!", "✅ ПРОДАНО", "продан", "Продано, спасибо",
        "продано за 50000", "SOLD", "sold out", "Sotildi", "СДАНО", "Ёё продано"]) {
        assert.equal(isSoldKeyword(t), true, t);
    }
});

test("isSoldKeyword: не срабатывает на обычный текст, отрицания и длинные посты", () => {
    for (const t of ["", "   ", null, undefined, "не продано", "Not sold yet", "Продаётся квартира",
        "Продам 2-комн квартиру в Юнусабаде, 65 м2, 5/9, $60 000",
        "это продано вчера кому-то другому",
        "Спасибо", "ijaraga beriladi"]) {
        assert.equal(isSoldKeyword(t), false, String(t));
    }
});

// Минимальный фейк supabase-клиента: таблицы -> строки, цепочки select/eq/maybeSingle/update.
function fakeSupabase(tables, { missingSoldColumn = false } = {}) {
    const updates = [];
    const from = (name) => {
        const state = { filters: [], columns: "*", patch: null };
        const exec = () => {
            if (missingSoldColumn && (String(state.columns).includes("is_sold") || (state.patch && "is_sold" in state.patch))) {
                return { data: null, error: { code: "42703", message: "column is_sold does not exist" } };
            }
            const rows = (tables[name] || []).filter((r) => state.filters.every(([k, v]) => String(r[k]) === String(v)));
            if (state.patch) {
                rows.forEach((r) => Object.assign(r, state.patch));
                updates.push({ name, patch: state.patch, n: rows.length });
                return { data: null, error: null };
            }
            return { data: rows[0] || null, error: null };
        };
        const api = {
            select(c) { state.columns = c; return api; },
            limit() { return api; },
            retry() { return api; },
            update(p) { state.patch = p; return api; },
            eq(k, v) { state.filters.push([k, v]); return api; },
            maybeSingle() { return Promise.resolve(exec()); },
            then(res, rej) { return Promise.resolve(exec()).then(res, rej); },
        };
        return api;
    };
    return { from, updates };
}

test("findListingForReply: прямой ответ на пост", async () => {
    const sb = fakeSupabase({
        cardss: [{ id: 7, title_ru: "Квартира", is_rent: false, is_sold: false, tg_chat_id: -100, tg_message_id: 55 }],
        commercials: [],
    });
    const found = await findListingForReply(sb, -100, { message_id: 55 });
    assert.deepEqual(found, { table: "cardss", id: 7, title: "Квартира", isRent: false, isSold: false });
});

test("findListingForReply: коммерция и ответ на другое фото альбома", async () => {
    const sb = fakeSupabase({
        cardss: [],
        commercials: [{ id: 3, title_ru: "Офис", is_rent: true, is_sold: false, tg_chat_id: -100, tg_message_id: 90 }],
        bot_pending_albums: [{ media_group_id: "G1", chat_id: -100, message_id: 90 }],
    });
    const direct = await findListingForReply(sb, -100, { message_id: 90 });
    assert.equal(direct.table, "commercials");
    const viaAlbum = await findListingForReply(sb, -100, { message_id: 92, media_group_id: "G1" });
    assert.equal(viaAlbum.id, 3);
    assert.equal(viaAlbum.isRent, true);
    assert.equal(await findListingForReply(sb, -100, { message_id: 1 }), null);
    assert.equal(await findListingForReply(sb, -100, null), null);
});

test("findListingForReply: без колонки is_sold читает без неё", async () => {
    const sb = fakeSupabase(
        { cardss: [{ id: 1, title_ru: "A", is_rent: false, tg_chat_id: 1, tg_message_id: 2 }], commercials: [] },
        { missingSoldColumn: true }
    );
    const found = await findListingForReply(sb, 1, { message_id: 2 });
    assert.equal(found.id, 1);
    assert.equal(found.isSold, false);
});

test("markListingSold: ставит флаг; без колонки даёт понятную подсказку", async () => {
    const rows = [{ id: 7, is_sold: false }];
    const sb = fakeSupabase({ cardss: rows });
    const ok = await markListingSold(sb, "cardss", 7);
    assert.equal(ok.ok, true);
    assert.equal(rows[0].is_sold, true);
    assert.ok(rows[0].sold_at);

    const broken = await markListingSold(fakeSupabase({ cardss: [{ id: 1 }] }, { missingSoldColumn: true }), "cardss", 1);
    assert.equal(broken.ok, false);
    assert.equal(broken.missingColumn, true);
    assert.match(soldReplyText({ title: "X", isRent: false }, broken), /add_sold_flag\.sql/);
    assert.match(soldReplyText({ title: "X", isRent: false }, ok), /продан/);
    assert.match(soldReplyText({ title: "X", isRent: true }, ok), /сдан/);
});

test("страница проданного объекта не существует (404), живого — существует", async () => {
    // проданная карточка отфильтрована во view cardss_public, а villas осталась
    const sb = fakeSupabase({
        villas: [{ card_id: 1 }, { card_id: 2 }],
        cardss_public: [{ id: 1 }],
        commercial_pages: [{ commercial_id: 10 }, { commercial_id: 11 }],
        commercials_public: [{ id: 10 }],
    });
    assert.equal(await propertyExists(sb, 1), true);
    assert.equal(await propertyExists(sb, 2), false);   // продан
    assert.equal(await propertyExists(sb, 3), false);   // нет страницы вообще
    assert.equal(await commercialExists(sb, 10), true);
    assert.equal(await commercialExists(sb, 11), false); // продан
    assert.equal(await commercialExists(sb, 12), false);
});
