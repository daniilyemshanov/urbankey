import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { trackEvent, trackPageView } from "../analytics";

export default function AnalyticsPageTracker() {
    const location = useLocation();

    useEffect(() => {
        trackPageView({
            path: `${location.pathname}${location.search || ""}`,
            title: document.title,
        });
    }, [location.pathname, location.search]);

    useEffect(() => {
        const handleContactClick = (event) => {
            const anchor = event.target?.closest?.("a[href]");
            if (!anchor) return;
            const href = anchor.getAttribute("href") || "";
            if (/^tel:/i.test(href)) {
                trackEvent("click_to_call", { contact_method: "phone" });
            } else if (/t\.me\//i.test(href)) {
                trackEvent("click_telegram", { contact_method: "telegram" });
            }
        };

        document.addEventListener("click", handleContactClick, true);
        return () => document.removeEventListener("click", handleContactClick, true);
    }, []);

    return null;
}
