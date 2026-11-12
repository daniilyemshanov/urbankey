export const aiSearchCatalog = async (query, lang) => {

    try {

        const response = await fetch("/api/ai-search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query, lang })
        });

        if (!response.ok) return { ok: false };

        return await response.json();

    } catch {
        return { ok: false };
    }

};
