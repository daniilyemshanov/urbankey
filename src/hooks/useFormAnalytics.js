import { useEffect, useRef, useCallback } from "react";
import {
  trackLeadFormView,
  trackLeadFormStart,
  trackLeadFormSubmit,
  trackLeadFormSuccess,
  trackLeadFormError
} from "../analytics";

/**
 * Unified GA4 form tracking hook for UrbanKey forms.
 * 
 * Handles:
 * - lead_form_view (once per appearance in viewport via IntersectionObserver)
 * - lead_form_start (once on first input focus or typing)
 * - lead_form_submit (on valid submit action)
 * - lead_form_success (on server confirmation)
 * - lead_form_error (on network or API failure)
 */
export const useFormAnalytics = ({
  formId,
  formType,
  formLocation,
  propertyId,
  propertyType,
  leadType,
  leadSource,
}) => {
  const formRef = useRef(null);
  const viewTrackedRef = useRef(false);
  const startTrackedRef = useRef(false);

  // Stable base parameters
  const getBaseParams = useCallback(
    (override = {}) => ({
      form_id: override.form_id || formId,
      form_type: override.form_type || formType,
      form_location: override.form_location || formLocation,
      property_id: override.property_id != null ? override.property_id : propertyId,
      property_type: override.property_type || propertyType,
      lead_type: override.lead_type || leadType,
      lead_source: override.lead_source || leadSource || formId,
      ...override,
    }),
    [formId, formType, formLocation, propertyId, propertyType, leadType, leadSource]
  );

  // IntersectionObserver for lead_form_view
  useEffect(() => {
    if (viewTrackedRef.current) return;
    const node = formRef.current;
    if (!node) return;

    if (typeof window === "undefined" || !("IntersectionObserver" in window)) {
      viewTrackedRef.current = true;
      trackLeadFormView(getBaseParams());
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !viewTrackedRef.current) {
            viewTrackedRef.current = true;
            trackLeadFormView(getBaseParams());
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.15 }
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [getBaseParams]);

  const trackView = useCallback(
    (extra = {}) => {
      if (viewTrackedRef.current) return;
      viewTrackedRef.current = true;
      trackLeadFormView(getBaseParams(extra));
    },
    [getBaseParams]
  );

  const trackStart = useCallback(
    (extra = {}) => {
      if (startTrackedRef.current) return;
      startTrackedRef.current = true;
      trackLeadFormStart(getBaseParams(extra));
    },
    [getBaseParams]
  );

  const trackSubmit = useCallback(
    (extra = {}) => {
      trackLeadFormSubmit(getBaseParams(extra));
    },
    [getBaseParams]
  );

  const trackSuccess = useCallback(
    (extra = {}) => {
      trackLeadFormSuccess(getBaseParams(extra));
    },
    [getBaseParams]
  );

  const trackError = useCallback(
    (errorCode, extra = {}) => {
      trackLeadFormError(getBaseParams({ error_code: errorCode, ...extra }));
    },
    [getBaseParams]
  );

  return {
    formRef,
    trackView,
    trackStart,
    trackSubmit,
    trackSuccess,
    trackError,
    handleInteraction: trackStart,
  };
};

export default useFormAnalytics;
