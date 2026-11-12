import { detectDistrict } from "./districts.js";

const num = (v) => {
    if (v == null || v === "") return null;
    const n = Number(String(v).replace(/\s+/g, "").replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : null;
};

const textOf = (item) => [
    item?.title?.ru, item?.title?.en, item?.title?.uz,
    item?.description?.ru, item?.description?.en, item?.description?.uz,
];

export function roomsOf(item) {
    const raw = String(item?.bedrooms?.ru ?? item?.bedrooms ?? "");
    const m = raw.match(/\d+/);
    if (m) return Number(m[0]);
    const t = `${item?.title?.ru || ""} ${item?.description?.ru || ""}`.match(/(\d)\s*-?\s*(?:комн|ком\b|к\b)/i);
    return t ? Number(t[1]) : null;
}

export function areaOf(item) {
    const own = num(item?.area);
    if (own) return own;
    const m = `${item?.title?.ru || ""} ${item?.description?.ru || ""}`
        .match(/(\d+(?:[.,]\d+)?)\s*(?:м²|м2|кв\.?\s*м|m²|m2)/i);
    return m ? num(m[1]) : null;
}

export function districtOf(item, locations) {
    return detectDistrict([
        ...(locations?.[item?.id] || []),
        item?.location?.ru, item?.location?.en, item?.location?.uz,
        item?.district?.ru, item?.district?.en, item?.district?.uz,
        ...textOf(item),
    ]);
}

const within = (a, b, ratio) => a != null && b != null && Math.abs(a - b) / b <= ratio;

function scoreResidential(cur, cand) {
    let score = 0;
    const reasons = [];

    if (cur.district && cand.district === cur.district) { score += 6; reasons.push({ code: "district" }); }

    if (cur.rooms != null && cand.rooms != null) {
        if (cur.rooms === cand.rooms) { score += 5; reasons.push({ code: "rooms", value: cand.rooms }); }
        else if (Math.abs(cur.rooms - cand.rooms) === 1) { score += 2; reasons.push({ code: "roomsNear", value: cand.rooms }); }
    }

    if (within(cand.price, cur.price, 0.10)) { score += 4; reasons.push({ code: "price" }); }
    else if (within(cand.price, cur.price, 0.25)) { score += 2; reasons.push({ code: "priceNear" }); }
    else if (within(cand.price, cur.price, 0.40)) { score += 1; }

    if (within(cand.area, cur.area, 0.10)) { score += 2; reasons.push({ code: "area" }); }
    else if (within(cand.area, cur.area, 0.25)) { score += 1; }

    if (cur.floor != null && cand.floor != null) {
        const d = Math.abs(cur.floor - cand.floor);
        if (d <= 1) { score += 2; reasons.push({ code: "floor" }); }
        else if (d <= 3) { score += 1; }
    }

    return { score, reasons };
}

function scoreCommercial(cur, cand) {
    let score = 0;
    const reasons = [];

    if (cur.district && cand.district === cur.district) { score += 6; reasons.push({ code: "district" }); }
    if (cur.type && cand.type === cur.type) { score += 5; reasons.push({ code: "type" }); }
    if (cur.cls && cand.cls === cur.cls) { score += 3; reasons.push({ code: "class" }); }
    if (within(cand.area, cur.area, 0.20)) { score += 2; reasons.push({ code: "area" }); }
    if (within(cand.price, cur.price, 0.25)) { score += 2; reasons.push({ code: "price" }); }

    return { score, reasons };
}

export function rankSimilar({ current, candidates, currentId, kind = "residential", locations = {}, limit = 7 }) {
    if (!current || !Array.isArray(candidates)) return [];

    const commercial = kind === "commercial";
    const describe = (item) => ({
        district: districtOf(item, locations),
        rooms: roomsOf(item),
        price: num(item?.price),
        area: areaOf(item),
        floor: num(item?.floor),
        type: item?.type?.ru || "",
        cls: item?.class?.ru || "",
        rent: item?.is_rent,
    });

    const cur = describe({ ...current, id: currentId ?? current.id });

    return candidates
        .filter((item) => String(item.id) !== String(currentId ?? current.id))
        .filter((item) => cur.rent == null || item.is_rent == null || Boolean(cur.rent) === Boolean(item.is_rent))
        .map((item) => {
            const cand = describe(item);
            const { score, reasons } = commercial ? scoreCommercial(cur, cand) : scoreResidential(cur, cand);
            const priceGap = cur.price && cand.price ? Math.abs(cand.price - cur.price) / cur.price : 9;
            return { item, score, reasons, priceGap };
        })
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score || a.priceGap - b.priceGap)
        .slice(0, limit);
}
