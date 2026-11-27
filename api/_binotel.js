/**
 * Confirmed Binotel REST API v4.0 client for UrbanKey.
 *
 * Confirmed endpoints used:
 * - POST https://api.binotel.com/api/4.0/customers/search.json
 * - POST https://api.binotel.com/api/4.0/customers/create.json
 * - POST https://api.binotel.com/api/4.0/settings/list-of-employees.json
 *
 * Unconfirmed endpoints (Smart CRM deal/pipeline creation) are NOT invented or called
 * unless explicitly configured after Binotel support confirmation.
 */

const BINOTEL_API_BASE = "https://api.binotel.com/api/4.0";
const BINOTEL_TIMEOUT_MS = 8000;

export const isBinotelConfigured = () =>
    Boolean(process.env.BINOTEL_API_KEY && process.env.BINOTEL_API_SECRET);

const callBinotel = async (endpoint, payload = {}, fetchImpl = fetch) => {
    const key = process.env.BINOTEL_API_KEY;
    const secret = process.env.BINOTEL_API_SECRET;

    if (!key || !secret) {
        return { ok: false, skipped: true, error: "BINOTEL_API_KEY/SECRET not configured" };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), BINOTEL_TIMEOUT_MS);

    try {
        const res = await fetchImpl(`${BINOTEL_API_BASE}/${endpoint}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                key,
                secret,
                ...payload,
            }),
            signal: controller.signal,
        });

        const text = await res.text();
        let json = null;
        try {
            json = JSON.parse(text);
        } catch {
            json = { raw: text };
        }

        if (!res.ok || json?.status === "error") {
            const safeMsg = json?.message || `HTTP ${res.status}`;
            return { ok: false, status: res.status, error: String(safeMsg), data: json };
        }

        return { ok: true, status: res.status, data: json };
    } catch (err) {
        return {
            ok: false,
            error: err?.name === "AbortError" ? "Binotel API timeout" : String(err?.message || err),
        };
    } finally {
        clearTimeout(timer);
    }
};

export const findBinotelCustomerByPhone = async (phoneE164, fetchImpl = fetch) => {
    if (!phoneE164) return { ok: false, found: false, customerId: null };

    const cleanSubject = String(phoneE164).replace(/^\+/, "");
    const res = await callBinotel(
        "customers/search.json",
        { subject: cleanSubject },
        fetchImpl
    );

    if (!res.ok) {
        return { ok: false, found: false, customerId: null, error: res.error };
    }

    const customerData = res.data?.customerData || res.data?.customers || res.data;
    if (customerData && typeof customerData === "object") {
        const entries = Array.isArray(customerData)
            ? customerData
            : Object.values(customerData);
        const first = entries.find((c) => c && (c.id || c.customerID));
        if (first) {
            return {
                ok: true,
                found: true,
                customerId: String(first.id || first.customerID),
                customer: first,
            };
        }
    }

    return { ok: true, found: false, customerId: null };
};

export const buildCustomerDescription = (classified, manager) => {
    const lines = [
        `Источник: ${classified.source}`,
        `Направление CRM: ${classified.direction.label}`,
        `Операция: ${classified.operation}`,
        `Тип недвижимости: ${classified.propertyType}`,
    ];

    if (classified.budget) {
        lines.push(`Бюджет: ${classified.budget}`);
    }
    if (manager?.name) {
        lines.push(`Ответственный: ${manager.name}${manager.employeeNumber ? ` (#${manager.employeeNumber})` : ""}`);
    }
    if (classified.telegram) {
        lines.push(`Telegram: ${classified.telegram}`);
    }
    if (classified.message) {
        lines.push(`Комментарий: ${classified.message}`);
    }

    return lines.join("\n");
};

export const listBinotelEmployees = async (fetchImpl = fetch) => {
    return callBinotel("settings/list-of-employees.json", {}, fetchImpl);
};

export const syncLeadToBinotel = async ({ classified, manager, fetchImpl = fetch }) => {
    if (!isBinotelConfigured()) {
        return {
            ok: false,
            skipped: true,
            customerId: null,
            dealId: null,
            status: "not_configured",
            error: null,
        };
    }

    const phoneStr = classified.phone?.e164 || classified.phone?.raw || null;

    // 1. Check if customer already exists in Binotel
    let customerId = null;
    if (phoneStr) {
        const searchRes = await findBinotelCustomerByPhone(phoneStr, fetchImpl);
        if (searchRes.found && searchRes.customerId) {
            customerId = searchRes.customerId;
        }
    }

    // 2. Create customer via confirmed `customers/create.json` if not found
    if (!customerId) {
        const createPayload = {
            name: classified.name || phoneStr || classified.email || "Клиент с сайта",
            numbers: phoneStr ? [phoneStr.replace(/^\+/, "")] : [],
            description: buildCustomerDescription(classified, manager),
        };

        if (classified.email) {
            createPayload.email = classified.email;
        }

        // Only attach assignedToEmployeeNumber when explicitly enabled after Binotel confirmation
        if (
            process.env.BINOTEL_ENABLE_EMPLOYEE_ASSIGN === "1" &&
            manager?.employeeNumber
        ) {
            createPayload.assignedToEmployeeNumber = String(manager.employeeNumber);
        }

        const createRes = await callBinotel("customers/create.json", createPayload, fetchImpl);
        if (!createRes.ok) {
            return {
                ok: false,
                skipped: false,
                customerId: null,
                dealId: null,
                status: "error",
                error: createRes.error || "Failed to create Binotel customer",
            };
        }

        customerId = createRes.data?.customerID
            ? String(createRes.data.customerID)
            : createRes.data?.id
                ? String(createRes.data.id)
                : null;
    }

    return {
        ok: true,
        skipped: false,
        customerId,
        dealId: null,
        // Deals API in Binotel Smart CRM requires endpoint confirmation from Binotel support
        status: "customer_synced_deal_pending_api_spec",
        error: null,
    };
};
