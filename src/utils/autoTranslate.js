export const SUPPORTED_LISTING_LANGS = ["ru", "en", "uz"];

export const translateFields = async (source, fields) => {

    const targets = SUPPORTED_LISTING_LANGS.filter((l) => l !== source);

    const entries = Object.entries(fields).filter(
        ([, text]) => text != null && String(text).trim() !== ""
    );

    const buildFallback = () => {
        const out = {};
        for (const [id, text] of entries) {
            out[id] = { [source]: String(text) };
            targets.forEach((t) => { out[id][t] = String(text); });
        }
        return out;
    };

    if (!entries.length) return {};

    try {

        const res = await fetch("/api/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                source,
                targets,
                texts: entries.map(([id, text]) => ({ id, text: String(text) }))
            })
        });

        if (!res.ok) throw new Error(`translate request failed: ${res.status}`);

        const { results } = await res.json();

        return results && Object.keys(results).length ? results : buildFallback();

    } catch (err) {

        console.error("translateFields error:", err);
        return buildFallback();

    }

};

export const pickLangValue = (results, id, rawText) => {

    const r = results[id];
    const fallback = rawText || "";

    if (!r) {
        return { ru: fallback, en: fallback, uz: fallback };
    }

    return {
        ru: r.ru ?? fallback,
        en: r.en ?? fallback,
        uz: r.uz ?? fallback
    };

};
