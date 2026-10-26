import { fetchCbuUsdRate } from "./_exchangeRate.js";

export default async function handler(req, res) {
    if (req.method !== "GET") {
        res.setHeader("Allow", "GET");
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        const { rate, rateDate } = await fetchCbuUsdRate({ attempts: 2, timeoutMs: 6000 });
        res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
        return res.status(200).json({ rate, date: rateDate });
    } catch {
        res.setHeader("Cache-Control", "no-store");
        return res.status(502).json({ error: "rate_unavailable" });
    }
}
