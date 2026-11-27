/**
 * Unified lead normalization and 7-direction CRM routing for UrbanKey.
 * Strictly server-side: never trusts direction, manager, or admin flags from frontend.
 */

export const CRM_DIRECTIONS = {
    NEW_BUILDINGS: {
        key: "new_buildings",
        label: "Новостройки",
        defaultStage: "Получено новое обращение",
    },
    COMMERCIAL_RENT: {
        key: "commercial_rent",
        label: "Аренда коммерции",
        defaultStage: "Получено новое обращение",
    },
    COMMERCIAL_BUY: {
        key: "commercial_buy",
        label: "Покупка коммерции",
        defaultStage: "Получено новое обращение",
    },
    HOUSES_LAND: {
        key: "houses_land",
        label: "Дома / участки",
        defaultStage: "Получено новое обращение",
    },
    COMMERCIAL_OWNERS: {
        key: "commercial_owners",
        label: "Собственники коммерции",
        defaultStage: "Контакт установлен",
    },
    APARTMENT_OWNERS: {
        key: "apartment_owners",
        label: "Собственники квартир",
        defaultStage: "Контакт установлен",
    },
    SECONDARY_BUY: {
        key: "secondary_buy",
        label: "Покупка вторички",
        defaultStage: "Получено новое обращение",
    },
    MANUAL_REVIEW: {
        key: "manual_review",
        label: "Ручная обработка",
        defaultStage: null,
    },
};

export const normalizePhone = (rawPhone) => {
    const raw = String(rawPhone ?? "").trim();
    if (!raw) {
        return { raw: "", e164: null, digits: "", isValid: false };
    }

    const digits = raw.replace(/\D/g, "");
    if (!digits) {
        return { raw, e164: null, digits: "", isValid: false };
    }

    // Uzbekistan 9-digit local mobile: 901234567 -> +998901234567
    if (digits.length === 9) {
        const fullDigits = `998${digits}`;
        return { raw, e164: `+${fullDigits}`, digits: fullDigits, isValid: true };
    }

    // Uzbekistan 10-digit with leading 8: 8901234567 -> +998901234567
    if (digits.length === 10 && digits.startsWith("8")) {
        const fullDigits = `998${digits.slice(1)}`;
        return { raw, e164: `+${fullDigits}`, digits: fullDigits, isValid: true };
    }

    // Uzbekistan 12-digit: 998901234567 -> +998901234567
    if (digits.length === 12 && digits.startsWith("998")) {
        return { raw, e164: `+${digits}`, digits, isValid: true };
    }

    // International E.164 range (7 to 15 digits)
    if (digits.length >= 7 && digits.length <= 15) {
        return { raw, e164: `+${digits}`, digits, isValid: true };
    }

    return { raw, e164: null, digits, isValid: false };
};

const normalizeToken = (val) =>
    String(val ?? "")
        .trim()
        .toLowerCase();

const extractOperation = (source, data) => {
    const explicit = normalizeToken(
        data.operation || data.commercial_operation || data.inquiry_key || data.request_type_key
    );

    if (["buy", "purchase", "commercial_buy"].includes(explicit)) return "buy";
    if (["rent", "lease", "commercial_rent"].includes(explicit)) return "rent";
    if (["sell", "owner", "commercial_sell"].includes(explicit)) return "sell";
    if (["invest", "investment"].includes(explicit)) return "invest";
    if (["consult", "consultation"].includes(explicit)) return "consult";
    if (["other"].includes(explicit)) return "other";

    // Legacy / localized fallback for unupdated clients (only structured dropdown values)
    const legacy = normalizeToken(data.inquiry || data.request_type);
    if (
        [
            "покупка",
            "приобретение недвижимости",
            "buying property",
            "purchase",
            "mulk sotib olish",
            "sotib olish",
        ].includes(legacy)
    ) {
        return "buy";
    }
    if (["аренда", "rent", "ijara"].includes(legacy)) {
        return "rent";
    }
    if (
        [
            "продажа",
            "реализация недвижимости",
            "selling property",
            "mulk sotish",
            "sotish",
        ].includes(legacy)
    ) {
        return "sell";
    }
    if (source === "user_listing") {
        return "sell";
    }

    return "unknown";
};

const extractPropertyType = (source, data) => {
    const explicit = normalizeToken(data.property_category || data.property_type);

    if (["new_building", "new_buildings", "novostroyka"].includes(explicit)) {
        return "new_building";
    }
    if (["secondary", "resale", "vtorichka"].includes(explicit)) {
        return "secondary";
    }
    if (["house_land", "house", "villa", "land", "houses_land"].includes(explicit)) {
        return "house_land";
    }
    if (["commercial", "commerce"].includes(explicit)) {
        return "commercial";
    }
    if (["apartment", "flat"].includes(explicit)) {
        return "apartment";
    }

    // Source-level context: Connect_one is strictly on CommercialPage
    if (source === "Connect_one") {
        return "commercial";
    }

    // LeadPopup legacy request_type_key === "commercial"
    const reqKey = normalizeToken(data.request_type_key || data.request_type);
    if (["commercial", "коммерческая", "tijorat"].includes(reqKey)) {
        return "commercial";
    }

    // Commercial owner from user_listing
    if (data.listing_kind === "commercial") {
        return "commercial";
    }
    if (data.listing_kind === "residential") {
        return "apartment";
    }

    return "unknown";
};

export const routeLeadDirection = ({ source, operation, propertyType }) => {
    if (operation === "sell") {
        if (propertyType === "commercial") return CRM_DIRECTIONS.COMMERCIAL_OWNERS;
        if (propertyType === "house_land") return CRM_DIRECTIONS.HOUSES_LAND;
        if (["apartment", "secondary", "new_building"].includes(propertyType)) {
            return CRM_DIRECTIONS.APARTMENT_OWNERS;
        }
        return CRM_DIRECTIONS.MANUAL_REVIEW;
    }

    if (operation === "rent") {
        if (propertyType === "commercial") return CRM_DIRECTIONS.COMMERCIAL_RENT;
        // Residential rent has no separate funnel in the 7 Binotel pipelines — route to manual review
        return CRM_DIRECTIONS.MANUAL_REVIEW;
    }

    if (operation === "buy") {
        if (propertyType === "new_building") return CRM_DIRECTIONS.NEW_BUILDINGS;
        if (propertyType === "secondary") return CRM_DIRECTIONS.SECONDARY_BUY;
        if (propertyType === "commercial") return CRM_DIRECTIONS.COMMERCIAL_BUY;
        if (propertyType === "house_land") return CRM_DIRECTIONS.HOUSES_LAND;
        return CRM_DIRECTIONS.MANUAL_REVIEW;
    }

    // Commercial page default when user selected commercial without explicit rent/sell
    if (source === "Connect_one" && propertyType === "commercial") {
        return CRM_DIRECTIONS.MANUAL_REVIEW;
    }

    return CRM_DIRECTIONS.MANUAL_REVIEW;
};

const parseBudget = (rawBudget) => {
    if (rawBudget == null || rawBudget === "") return null;
    const cleaned = String(rawBudget).replace(/[^\d.]/g, "");
    if (!cleaned) return null;
    const num = Number(cleaned);
    return Number.isFinite(num) && num > 0 ? num : null;
};

export const classifyLead = ({ source, data = {} }) => {
    const firstName = String(data.firstname || data.firstName || "").trim();
    const lastName = String(data.secondname || data.lastName || "").trim();
    const name = String(data.name || data.Name || [firstName, lastName].filter(Boolean).join(" ")).trim() || null;

    const phone = normalizePhone(data.phone || data.Phone || data.tel);
    const email = String(data.email || data.Email || "").trim() || null;
    const telegram = String(data.telegram || data.Telegram || "").trim() || null;
    const message = String(data.message || data.Message || data.description || data.comment || "").trim() || null;
    const budget = parseBudget(data.budget);

    const operation = extractOperation(source, data);
    const propertyType = extractPropertyType(source, data);
    const direction = routeLeadDirection({ source, operation, propertyType });

    const contactLabel = name || phone.e164 || email || "Клиент с сайта";
    const dealTitle =
        direction.key === "manual_review"
            ? `[Требует квалификации] ${contactLabel}`
            : `${direction.label} — ${contactLabel}`;

    return {
        source,
        name,
        phone,
        email,
        telegram,
        message,
        budget,
        operation,
        propertyType,
        direction,
        dealTitle,
        requiresManualReview: direction.key === "manual_review",
    };
};
