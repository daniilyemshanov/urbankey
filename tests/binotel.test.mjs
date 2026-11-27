import test from "node:test";
import assert from "node:assert/strict";

import { normalizePhone, classifyLead, CRM_DIRECTIONS } from "../api/_leadRouting.js";
import { assignManager } from "../api/_leadManagers.js";
import { syncLeadToBinotel, buildCustomerDescription } from "../api/_binotel.js";
import leadHandler from "../api/lead.js";

test("normalizePhone normalizes Uzbekistan and international phone numbers", () => {
    assert.deepEqual(normalizePhone("901234567"), {
        raw: "901234567",
        e164: "+998901234567",
        digits: "998901234567",
        isValid: true,
    });
    assert.equal(normalizePhone("8901234567").e164, "+998901234567");
    assert.equal(normalizePhone("+998 (90) 123-45-67").e164, "+998901234567");
    assert.equal(normalizePhone("+7 999 123 45 67").e164, "+79991234567");
    assert.equal(normalizePhone("").isValid, false);
    assert.equal(normalizePhone("123").isValid, false);
});

test("classifyLead routes all 7 CRM directions and falls back to manual_review", () => {
    // 1. Новостройки
    assert.equal(
        classifyLead({
            source: "LeadPopup",
            data: { name: "Азиз", phone: "901234567", request_type_key: "buy", property_category: "new_building" },
        }).direction.key,
        CRM_DIRECTIONS.NEW_BUILDINGS.key
    );

    // 2. Покупка вторички
    assert.equal(
        classifyLead({
            source: "Connect",
            data: { firstname: "Тимур", phone: "901234567", inquiry_key: "buy", property_category: "secondary" },
        }).direction.key,
        CRM_DIRECTIONS.SECONDARY_BUY.key
    );

    // 3. Дома / участки
    assert.equal(
        classifyLead({
            source: "Connect",
            data: { firstname: "Олег", phone: "901234567", inquiry_key: "buy", property_category: "house_land" },
        }).direction.key,
        CRM_DIRECTIONS.HOUSES_LAND.key
    );

    // 4. Покупка коммерции
    assert.equal(
        classifyLead({
            source: "Connect_one",
            data: { firstname: "Марат", phone: "901234567", inquiry_key: "commercial_buy", property_category: "commercial" },
        }).direction.key,
        CRM_DIRECTIONS.COMMERCIAL_BUY.key
    );

    // 5. Аренда коммерции
    assert.equal(
        classifyLead({
            source: "LeadPopup",
            data: { name: "Сардор", phone: "901234567", request_type_key: "commercial", commercial_operation: "rent" },
        }).direction.key,
        CRM_DIRECTIONS.COMMERCIAL_RENT.key
    );

    // 6. Собственники коммерции
    assert.equal(
        classifyLead({
            source: "Connect_one",
            data: { firstname: "Дилшод", phone: "901234567", inquiry_key: "commercial_sell" },
        }).direction.key,
        CRM_DIRECTIONS.COMMERCIAL_OWNERS.key
    );

    // 7. Собственники квартир
    assert.equal(
        classifyLead({
            source: "Connect",
            data: { firstname: "Нигора", phone: "901234567", inquiry_key: "sell", property_category: "apartment" },
        }).direction.key,
        CRM_DIRECTIONS.APARTMENT_OWNERS.key
    );

    // 8. Ambiguous / residential rent -> manual_review (never random funnel)
    assert.equal(
        classifyLead({
            source: "LeadPopup",
            data: { name: "Камила", phone: "901234567", request_type_key: "rent" },
        }).direction.key,
        CRM_DIRECTIONS.MANUAL_REVIEW.key
    );

    assert.equal(
        classifyLead({
            source: "Connect",
            data: { firstname: "Анвар", phone: "901234567", inquiry_key: "consult", direction: "new_buildings" },
        }).direction.key,
        CRM_DIRECTIONS.MANUAL_REVIEW.key
    );
});

test("syncLeadToBinotel uses confirmed customers/search and customers/create without leaking secrets", async () => {
    const prevKey = process.env.BINOTEL_API_KEY;
    const prevSecret = process.env.BINOTEL_API_SECRET;
    const prevAssign = process.env.BINOTEL_ENABLE_EMPLOYEE_ASSIGN;

    process.env.BINOTEL_API_KEY = "test_key_secret_123";
    process.env.BINOTEL_API_SECRET = "test_secret_456";
    delete process.env.BINOTEL_ENABLE_EMPLOYEE_ASSIGN;

    const calls = [];
    const mockFetch = async (url, init) => {
        const body = JSON.parse(init.body);
        calls.push({ url, body });

        if (url.endsWith("customers/search.json")) {
            return new Response(JSON.stringify({ status: "success", customerData: [] }), { status: 200 });
        }
        if (url.endsWith("customers/create.json")) {
            return new Response(JSON.stringify({ status: "success", customerID: "7788" }), { status: 200 });
        }
        return new Response("{}", { status: 404 });
    };

    try {
        const classified = classifyLead({
            source: "LeadPopup",
            data: { name: "Азиз", phone: "901234567", request_type_key: "buy", property_category: "new_building" },
        });
        const manager = { name: "Игорь Ким", employeeNumber: "102" };

        const result = await syncLeadToBinotel({ classified, manager, fetchImpl: mockFetch });

        assert.equal(result.ok, true);
        assert.equal(result.customerId, "7788");
        assert.equal(result.status, "customer_synced_deal_pending_api_spec");
        assert.equal(calls.length, 2);
        assert.ok(calls[0].url.endsWith("customers/search.json"));
        assert.ok(calls[1].url.endsWith("customers/create.json"));
        assert.equal(calls[1].body.assignedToEmployeeNumber, undefined);
        assert.deepEqual(calls[1].body.numbers, ["998901234567"]);

        const desc = buildCustomerDescription(classified, manager);
        assert.ok(desc.includes("Новостройки"));
        assert.ok(desc.includes("Игорь Ким"));
    } finally {
        if (prevKey === undefined) delete process.env.BINOTEL_API_KEY;
        else process.env.BINOTEL_API_KEY = prevKey;
        if (prevSecret === undefined) delete process.env.BINOTEL_API_SECRET;
        else process.env.BINOTEL_API_SECRET = prevSecret;
        if (prevAssign === undefined) delete process.env.BINOTEL_ENABLE_EMPLOYEE_ASSIGN;
        else process.env.BINOTEL_ENABLE_EMPLOYEE_ASSIGN = prevAssign;
    }
});

test("assignManager handles direction rule, round-robin RPC, and repeat inquiry continuity", async () => {
    const prevRR = process.env.BINOTEL_ROUND_ROBIN;
    const prevManagers = process.env.BINOTEL_MANAGERS_JSON;

    process.env.BINOTEL_ROUND_ROBIN = "1";
    process.env.BINOTEL_MANAGERS_JSON = JSON.stringify([
        { name: "Игорь Ким", employeeNumber: "101" },
        { name: "Кадыров Тимур", employeeNumber: "102" },
    ]);

    const mockSupabase = {
        from: () => ({
            select: () => ({
                eq: () => ({
                    not: () => ({
                        order: () => ({
                            limit: async () => ({ data: [] }),
                        }),
                    }),
                }),
            }),
        }),
        rpc: async () => ({ data: 1, error: null }),
    };

    try {
        const assigned = await assignManager({
            supabaseAdmin: mockSupabase,
            directionKey: "new_buildings",
            phoneE164: "+998901234567",
            email: null,
        });
        assert.equal(assigned.name, "Кадыров Тимур");
        assert.equal(assigned.employeeNumber, "102");
        assert.equal(assigned.reason, "round_robin");
    } finally {
        if (prevRR === undefined) delete process.env.BINOTEL_ROUND_ROBIN;
        else process.env.BINOTEL_ROUND_ROBIN = prevRR;
        if (prevManagers === undefined) delete process.env.BINOTEL_MANAGERS_JSON;
        else process.env.BINOTEL_MANAGERS_JSON = prevManagers;
    }
});

test("/api/lead handler validates, blocks honeypot, and routes valid request", async () => {
    const prevTgToken = process.env.TELEGRAM_BOT_TOKEN;
    const prevTgChat = process.env.TELEGRAM_CHAT_ID;
    const prevTurnstile = process.env.TURNSTILE_SECRET_KEY;
    const prevFetch = global.fetch;

    process.env.TELEGRAM_BOT_TOKEN = "fake_tg_token";
    process.env.TELEGRAM_CHAT_ID = "123456";
    delete process.env.TURNSTILE_SECRET_KEY;

    let tgCalled = 0;
    global.fetch = async (url) => {
        if (String(url).includes("api.telegram.org")) {
            tgCalled += 1;
            return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }
        return new Response("{}", { status: 200 });
    };

    const makeRes = () => {
        const out = { statusCode: 200, body: null, headers: {} };
        return {
            setHeader: (k, v) => { out.headers[k] = v; },
            status: (code) => {
                out.statusCode = code;
                return { json: (data) => { out.body = data; return out; } };
            },
            out,
        };
    };

    try {
        // Honeypot should return 200 silently without calling Telegram
        const honeyRes = makeRes();
        await leadHandler(
            { method: "POST", headers: {}, body: { source: "LeadPopup", company: "SpamBot", data: { name: "Bot" } } },
            honeyRes
        );
        assert.equal(honeyRes.out.statusCode, 200);
        assert.equal(tgCalled, 0);

        // Valid request
        const validRes = makeRes();
        await leadHandler(
            {
                method: "POST",
                headers: {},
                body: {
                    source: "LeadPopup",
                    data: {
                        name: "Азиз",
                        phone: "+998901234567",
                        request_type_key: "buy",
                        property_category: "new_building",
                    },
                },
            },
            validRes
        );
        assert.equal(validRes.out.statusCode, 200);
        assert.equal(validRes.out.body.ok, true);
        assert.equal(validRes.out.body.direction, "new_buildings");
        assert.equal(tgCalled, 1);
    } finally {
        global.fetch = prevFetch;
        if (prevTgToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
        else process.env.TELEGRAM_BOT_TOKEN = prevTgToken;
        if (prevTgChat === undefined) delete process.env.TELEGRAM_CHAT_ID;
        else process.env.TELEGRAM_CHAT_ID = prevTgChat;
        if (prevTurnstile === undefined) delete process.env.TURNSTILE_SECRET_KEY;
        else process.env.TURNSTILE_SECRET_KEY = prevTurnstile;
    }
});
