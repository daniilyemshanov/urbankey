import { useState, useContext, useEffect, useRef, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { X, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";

import s from "./LeadPopup.module.css";
import { sendLead } from "../utils/sendLead";
import {
    trackLeadModalOpen,
    trackLeadFormStart,
    trackLeadFormSubmit,
    trackLeadFormSuccess,
    trackLeadFormError
} from "../analytics";
import TurnstileWidget from "./TurnstileWidget";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { MyContext } from "../Context";
import ConsentNote from "./ConsentNote";
import {
    formatUzPhone,
    isUzPhoneValid,
    toE164UzPhone
} from "../utils/phoneMask";
import {
    isLeadModalSuppressed,
    markLeadModalDismissed,
    markLeadModalConverted,
    markLeadModalSessionShown
} from "../utils/leadModal";
import {
    recordPageEngagement,
    getEngagementMetrics,
    detectIntentContext,
    isUserActivelyTyping
} from "../utils/leadIntent";

const EXCLUDED_PATHS = [
    "/ContactUs",
    "/login",
    "/register",
    "/reset-password",
    "/forgot-password",
    "/add-property",
];

const isExcludedPath = (pathname) => {
    if (!pathname) return false;
    if (pathname.startsWith("/admin")) return true;
    return EXCLUDED_PATHS.some((p) => pathname.toLowerCase().includes(p.toLowerCase()));
};

const REQUEST_TYPES = [
    { id: "buy", labelKey: "leadPopupTypeBuy" },
    { id: "rent", labelKey: "leadPopupTypeRent" },
    { id: "commercial", labelKey: "leadPopupTypeCommercial" },
    { id: "other", labelKey: "leadPopupTypeOther" },
];

const LeadPopup = () => {
    const { t } = useTranslation();
    const { isOnline } = useOnlineStatus();
    const { profile } = useContext(MyContext);
    const location = useLocation();

    const [open, setOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [sent, setSent] = useState(false);
    const [serverError, setServerError] = useState(null);
    const [isAdminTesting, setIsAdminTesting] = useState(false);

    // Form fields
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [requestType, setRequestType] = useState("buy");
    const [comment, setComment] = useState("");
    const [honeypot, setHoneypot] = useState("");
    const [captchaToken, setCaptchaToken] = useState(null);

    // Contextual titles
    const [customTitle, setCustomTitle] = useState(null);
    const [customSubtitle, setCustomSubtitle] = useState(null);

    // Errors
    const [errors, setErrors] = useState({});

    // Tracking refs
    const triggerSourceRef = useRef("auto_timer");
    const formStartTrackedRef = useRef(false);
    const autoShownRef = useRef(false);
    const timerRef = useRef(null);
    const autoCloseTimerRef = useRef(null);
    const nameInputRef = useRef(null);

    const isAdmin = profile?.role === "admin";
    const isExcluded = isExcludedPath(location.pathname);

    // Track user page engagements on route changes
    useEffect(() => {
        recordPageEngagement(location.pathname);
    }, [location.pathname]);

    // Scroll lock management
    useEffect(() => {
        if (open) {
            const originalOverflow = document.body.style.overflow;
            const originalPaddingRight = document.body.style.paddingRight;
            const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

            document.body.style.overflow = "hidden";
            if (scrollbarWidth > 0) {
                document.body.style.paddingRight = `${scrollbarWidth}px`;
            }

            return () => {
                document.body.style.overflow = originalOverflow;
                document.body.style.paddingRight = originalPaddingRight;
            };
        }
    }, [open]);

    // Handle open action (manual or automatic)
    const handleOpen = useCallback((options = {}) => {
        const isForce = Boolean(options.force) || options.source?.startsWith("admin");
        
        // Block auto-triggers for admins so they aren't interrupted while editing
        if (isAdmin && !isForce) {
            return;
        }

        const trigger = options.source || "cta_button";
        triggerSourceRef.current = trigger;
        formStartTrackedRef.current = false;
        setServerError(null);
        setIsAdminTesting(isAdmin && isForce);

        // Detect browsing context if not explicitly provided
        const context = detectIntentContext(location.pathname);
        const targetType = options.type || context.type || "buy";

        if (REQUEST_TYPES.some((rt) => rt.id === targetType)) {
            setRequestType(targetType);
        }

        if (options.title) {
            setCustomTitle(options.title);
        } else if (context.type === "commercial") {
            setCustomTitle(t(context.titleKey));
            setCustomSubtitle(t(context.subtitleKey));
        } else {
            setCustomTitle(null);
            setCustomSubtitle(null);
        }

        setOpen(true);
        if (!isForce) {
            markLeadModalSessionShown();
        }

        try {
            trackLeadModalOpen({ trigger, source: "LeadPopup" });
        } catch {
            // Safe
        }
    }, [isAdmin, location.pathname, t]);

    // Close action
    const handleClose = useCallback((dismissDays = 5) => {
        if (submitting) return; // Prevent closing while in-flight

        setOpen(false);
        if (autoCloseTimerRef.current) {
            clearTimeout(autoCloseTimerRef.current);
            autoCloseTimerRef.current = null;
        }

        if (!sent && !isAdminTesting) {
            markLeadModalDismissed(dismissDays);
        }
    }, [submitting, sent, isAdminTesting]);

    // Global listener for manual trigger via events and [data-open-lead-modal]
    useEffect(() => {
        const handleCustomOpen = (e) => {
            handleOpen(e.detail || {});
        };

        const handleDocumentClick = (e) => {
            const triggerEl = e.target.closest("[data-open-lead-modal], [data-lead-trigger]");
            if (triggerEl) {
                e.preventDefault();
                const type = triggerEl.getAttribute("data-lead-type") || "buy";
                const source = triggerEl.getAttribute("data-lead-source") || "cta_button";
                handleOpen({ type, source, force: true });
            }
        };

        window.addEventListener("urbankey_open_lead_modal", handleCustomOpen);
        document.addEventListener("click", handleDocumentClick);

        return () => {
            window.removeEventListener("urbankey_open_lead_modal", handleCustomOpen);
            document.removeEventListener("click", handleDocumentClick);
        };
    }, [handleOpen]);

    // Keyboard Escape listener
    useEffect(() => {
        if (!open) return;

        const handleKeyDown = (e) => {
            if (e.key === "Escape" && !submitting) {
                handleClose(5);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [open, submitting, handleClose]);

    // Focus first input on open
    useEffect(() => {
        if (open && !sent) {
            const timer = setTimeout(() => {
                nameInputRef.current?.focus();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [open, sent]);

    // --- INTELLIGENT TRIGGER ENGINE ---
    useEffect(() => {
        if (isAdmin || isExcluded || autoShownRef.current || isLeadModalSuppressed()) {
            return;
        }

        const metrics = getEngagementMetrics();

        // 1. Trigger A: User viewing their 2nd property detail page -> high purchase intent!
        if (metrics.detailsViewed >= 2) {
            timerRef.current = setTimeout(() => {
                if (!autoShownRef.current && !isLeadModalSuppressed() && !open && !isUserActivelyTyping()) {
                    autoShownRef.current = true;
                    handleOpen({ source: "deep_property_browsing" });
                }
            }, 18000); // 18 seconds after landing on the 2nd property
            return () => clearTimeout(timerRef.current);
        }

        // 2. Trigger B: Catalog exploration depth
        if (location.pathname.toLowerCase().includes("/properties")) {
            timerRef.current = setTimeout(() => {
                if (!autoShownRef.current && !isLeadModalSuppressed() && !open && !isUserActivelyTyping()) {
                    autoShownRef.current = true;
                    handleOpen({ source: "catalog_exploration" });
                }
            }, 42000);
            return () => clearTimeout(timerRef.current);
        }

        // 3. Trigger C: General engagement fallback (60 seconds)
        timerRef.current = setTimeout(() => {
            if (!autoShownRef.current && !isLeadModalSuppressed() && !open && !isUserActivelyTyping()) {
                autoShownRef.current = true;
                handleOpen({ source: "general_engagement" });
            }
        }, 60000);

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [isAdmin, isExcluded, location.pathname, open, handleOpen]);

    // Desktop Exit-intent (Only triggers if user spent >= 15 seconds on site)
    useEffect(() => {
        if (isAdmin || isExcluded || autoShownRef.current || isLeadModalSuppressed()) {
            return;
        }

        const isDesktop =
            typeof window !== "undefined" &&
            window.innerWidth >= 1024 &&
            window.matchMedia("(hover: hover) and (pointer: fine)").matches;

        if (!isDesktop) return;

        const handleMouseLeave = (e) => {
            const metrics = getEngagementMetrics();
            // Don't trigger exit-intent on instant accidental mouse leaves; user must have explored for >= 15s
            if (
                e.clientY <= 0 &&
                metrics.secondsOnSite >= 15 &&
                !autoShownRef.current &&
                !isLeadModalSuppressed() &&
                !open &&
                !isUserActivelyTyping()
            ) {
                autoShownRef.current = true;
                handleOpen({ source: "exit_intent" });
            }
        };

        document.addEventListener("mouseleave", handleMouseLeave);
        return () => document.removeEventListener("mouseleave", handleMouseLeave);
    }, [isAdmin, isExcluded, open, handleOpen]);

    // Phone input handler
    const handlePhoneChange = (e) => {
        const val = e.target.value;
        const formatted = formatUzPhone(val);
        setPhone(formatted);
        if (errors.phone) {
            setErrors((prev) => ({ ...prev, phone: null }));
        }
    };

    const handlePhoneFocus = () => {
        handleInteractionStart();
        if (!phone) {
            setPhone("+998 (");
        }
    };

    const handlePhoneBlur = () => {
        if (phone === "+998 (" || phone === "+998") {
            setPhone("");
        }
    };

    const handleInteractionStart = () => {
        if (!formStartTrackedRef.current) {
            formStartTrackedRef.current = true;
            try {
                trackLeadFormStart({ source: "LeadPopup" });
            } catch {
                // Safe
            }
        }
    };

    // Validation
    const validate = () => {
        const nextErrors = {};

        if (!name.trim()) {
            nextErrors.name = t("leadPopupNameRequired");
        } else if (name.trim().length < 2) {
            nextErrors.name = t("leadPopupNameTooShort");
        }

        if (!phone.trim()) {
            nextErrors.phone = t("leadPopupPhoneRequired");
        } else if (!isUzPhoneValid(phone)) {
            nextErrors.phone = t("leadPopupPhoneInvalid");
        }

        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    // Submit handler
    const handleSubmit = async (e) => {
        e.preventDefault();
        setServerError(null);

        if (!validate()) return;
        if (submitting) return;

        setSubmitting(true);

        const selectedTypeObj = REQUEST_TYPES.find((rt) => rt.id === requestType);
        const typeLabel = selectedTypeObj ? t(selectedTypeObj.labelKey) : requestType;

        try {
            trackLeadFormSubmit({ source: "LeadPopup", request_type: requestType });

            const payloadData = {
                name: name.trim(),
                phone: toE164UzPhone(phone) || phone.trim(),
                formatted_phone: phone.trim(),
                request_type: typeLabel,
                comment: comment.trim() || undefined,
                message: comment.trim()
                    ? `[${typeLabel}] ${comment.trim()}`
                    : `Запрос на подбор: ${typeLabel}`,
            };

            await sendLead({
                source: "LeadPopup",
                data: payloadData,
                captchaToken,
                honeypot,
                skipCrm: profile?.role === "admin",
            });

            trackLeadFormSuccess({ source: "LeadPopup", request_type: requestType });
            
            if (!isAdminTesting) {
                markLeadModalConverted();
            }

            setSent(true);

            // Auto-close after success
            autoCloseTimerRef.current = setTimeout(() => {
                setOpen(false);
            }, 4500);

        } catch (err) {
            console.error("Lead submission error:", err);
            const msg = err?.message || t("leadPopupErrorServer");
            setServerError(msg);
            trackLeadFormError({ source: "LeadPopup", error_code: msg });
        } finally {
            setSubmitting(false);
        }
    };

    const handleDismissForever = () => {
        handleClose(30);
    };

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    className={s.overlay}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    onClick={() => handleClose(5)}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="lead-modal-title"
                >
                    <motion.div
                        className={s.modal}
                        onClick={(e) => e.stopPropagation()}
                        initial={{ opacity: 0, y: 30, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.96 }}
                        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    >
                        {/* Admin preview badge */}
                        {isAdminTesting && (
                            <div className={s.adminBadge}>
                                <ShieldCheck size={14} />
                                <span>Режим тестирования (Admin)</span>
                            </div>
                        )}

                        {/* Close button */}
                        <button
                            type="button"
                            className={s.closeBtn}
                            onClick={() => handleClose(5)}
                            disabled={submitting}
                            aria-label={t("leadPopupClose")}
                        >
                            <X size={18} />
                        </button>

                        {sent ? (
                            /* Success State */
                            <div className={s.successBox}>
                                <div className={s.successIconWrap}>
                                    <CheckCircle2 size={48} className={s.successIcon} />
                                </div>
                                <h2 className={s.successTitle}>
                                    {t("leadPopupSuccessTitle")}
                                </h2>
                                <p className={s.successSubtitle}>
                                    {t("leadPopupSuccessSubtitle")}
                                </p>
                                <button
                                    type="button"
                                    className={s.btn}
                                    onClick={() => handleClose(30)}
                                >
                                    {t("leadPopupClose")}
                                </button>
                            </div>
                        ) : (
                            /* Form State */
                            <>
                                <div className={s.header}>
                                    <div className={s.logoBadge}>
                                        <img
                                            src="/Abstract Design.svg"
                                            alt="Urban Key"
                                            className={s.logo}
                                        />
                                    </div>
                                    <h2 id="lead-modal-title" className={s.title}>
                                        {customTitle || t("leadPopupTitle")}
                                    </h2>
                                    <p className={s.subtitle}>
                                        {customSubtitle || t("leadPopupSubtitle")}
                                    </p>
                                </div>

                                <form className={s.form} onSubmit={handleSubmit} noValidate>
                                    {/* 1. Name */}
                                    <div className={s.field}>
                                        <label htmlFor="lead-name" className={s.label}>
                                            {t("leadPopupName")} <span className={s.req}>*</span>
                                        </label>
                                        <input
                                            ref={nameInputRef}
                                            id="lead-name"
                                            type="text"
                                            className={`${s.input} ${errors.name ? s.inputError : ""}`}
                                            placeholder={t("leadPopupNamePlaceholder")}
                                            value={name}
                                            disabled={submitting}
                                            onChange={(e) => {
                                                setName(e.target.value);
                                                if (errors.name) {
                                                    setErrors((prev) => ({ ...prev, name: null }));
                                                }
                                            }}
                                            onFocus={handleInteractionStart}
                                            maxLength={60}
                                        />
                                        {errors.name && (
                                            <span className={s.errorText}>{errors.name}</span>
                                        )}
                                    </div>

                                    {/* 2. Phone with +998 Mask */}
                                    <div className={s.field}>
                                        <label htmlFor="lead-phone" className={s.label}>
                                            {t("leadPopupPhone")} <span className={s.req}>*</span>
                                        </label>
                                        <input
                                            id="lead-phone"
                                            type="tel"
                                            className={`${s.input} ${errors.phone ? s.inputError : ""}`}
                                            placeholder={t("leadPopupPhonePlaceholder")}
                                            value={phone}
                                            disabled={submitting}
                                            onChange={handlePhoneChange}
                                            onFocus={handlePhoneFocus}
                                            onBlur={handlePhoneBlur}
                                            maxLength={20}
                                            inputMode="tel"
                                        />
                                        {errors.phone && (
                                            <span className={s.errorText}>{errors.phone}</span>
                                        )}
                                    </div>

                                    {/* 3. Request Type */}
                                    <div className={s.field}>
                                        <label className={s.label}>
                                            {t("leadPopupRequestType")}
                                        </label>
                                        <div className={s.typeGrid} role="radiogroup">
                                            {REQUEST_TYPES.map((rt) => {
                                                const isSelected = requestType === rt.id;
                                                return (
                                                    <button
                                                        key={rt.id}
                                                        type="button"
                                                        role="radio"
                                                        aria-checked={isSelected}
                                                        disabled={submitting}
                                                        className={`${s.typePill} ${isSelected ? s.typePillActive : ""}`}
                                                        onClick={() => {
                                                            handleInteractionStart();
                                                            setRequestType(rt.id);
                                                        }}
                                                    >
                                                        {t(rt.labelKey)}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* 4. Comment (Optional) */}
                                    <div className={s.field}>
                                        <label htmlFor="lead-comment" className={s.label}>
                                            {t("leadPopupComment")}
                                        </label>
                                        <textarea
                                            id="lead-comment"
                                            className={s.textarea}
                                            rows={3}
                                            placeholder={t("leadPopupCommentPlaceholder")}
                                            value={comment}
                                            disabled={submitting}
                                            onChange={(e) => setComment(e.target.value)}
                                            onFocus={handleInteractionStart}
                                            maxLength={1000}
                                        />
                                    </div>

                                    {/* Honeypot anti-bot */}
                                    <input
                                        type="text"
                                        name="company"
                                        tabIndex={-1}
                                        autoComplete="off"
                                        className={s.honeypot}
                                        aria-hidden="true"
                                        value={honeypot}
                                        onChange={(e) => setHoneypot(e.target.value)}
                                    />

                                    {/* Server error alert */}
                                    {serverError && (
                                        <div className={s.serverErrorBox}>
                                            <span>{serverError}</span>
                                        </div>
                                    )}

                                    {/* Cloudflare Turnstile */}
                                    <TurnstileWidget
                                        className={s.captcha}
                                        onVerify={setCaptchaToken}
                                        onExpire={() => setCaptchaToken(null)}
                                    />

                                    {/* Privacy policy note */}
                                    <ConsentNote />

                                    {/* Submit CTA */}
                                    <button
                                        type="submit"
                                        className={s.btn}
                                        disabled={submitting || !isOnline}
                                    >
                                        {!isOnline ? (
                                            t("offlineWarning")
                                        ) : submitting ? (
                                            <span className={s.submittingWrap}>
                                                <Loader2 size={18} className={s.spinner} />
                                                {t("leadPopupSubmitting")}
                                            </span>
                                        ) : (
                                            t("leadPopupSubmit")
                                        )}
                                    </button>
                                </form>

                                {/* Dismiss button */}
                                <button
                                    type="button"
                                    className={s.dismissBtn}
                                    onClick={handleDismissForever}
                                    disabled={submitting}
                                >
                                    {t("leadPopupDontShowAgain")}
                                </button>
                            </>
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default LeadPopup;
