export const GA_ID = 'G-GWK8BLPSFB';

const PII_KEYS = new Set([
  'name', 'first_name', 'firstname', 'last_name', 'lastname', 'fullname',
  'phone', 'telephone', 'mobile', 'email', 'telegram', 'username',
  'password', 'token', 'secret', 'address', 'message', 'user_id',
  'comment', 'text', 'company', 'honeypot', 'raw_input', 'query'
]);

function looksLikePII(val) {
  if (typeof val !== 'string') return false;
  const trimmed = val.trim();
  // Email pattern check
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return true;
  // Phone pattern check (contains +, dashes, parentheses and at least 7 digits)
  const digitsOnly = trimmed.replace(/\D/g, '');
  if (digitsOnly.length >= 7 && (trimmed.includes('+') || trimmed.includes('-') || trimmed.includes('('))) {
    return true;
  }
  return false;
}

function sanitizeParams(params = {}) {
  const clean = {};
  for (const [key, val] of Object.entries(params)) {
    if (PII_KEYS.has(key.toLowerCase())) continue;
    if (looksLikePII(val)) continue;
    if (val === null || val === undefined) continue;
    if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
      clean[key] = val;
    }
  }
  return clean;
}

if (typeof window !== 'undefined' && !window.gtag) {
  window.dataLayer = window.dataLayer || [];

  window.gtag = function () {
    window.dataLayer.push(arguments);
  };

  window.gtag('js', new Date());
  // Disable automatic page_view to prevent duplicate pageviews in SPA
  window.gtag('config', GA_ID, { send_page_view: false });

  const loadGtag = () => {
    if (document.querySelector(`script[src*="${GA_ID}"]`)) return;
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
    document.head.appendChild(script);
  };

  const schedule = () => {
    if ('requestIdleCallback' in window) window.requestIdleCallback(loadGtag, { timeout: 4000 });
    else setTimeout(loadGtag, 2000);
  };

  if (document.readyState === 'complete') schedule();
  else window.addEventListener('load', schedule, { once: true });
}

let lastTrackedPath = null;

export const trackPageView = (path, title) => {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  const requestedPath = typeof path === 'string' ? path : path?.path;
  const currentPath = requestedPath || window.location.pathname;
  // Never forward query strings or fragments: form values and other PII can
  // accidentally appear in URLs. GA4 only needs the clean SPA route here.
  const origin = window.location.origin || 'https://urbankey.uz';
  const pagePath = new URL(currentPath, origin).pathname;
  const pageLocation = `${origin}${pagePath}`;
  const currentTitle = typeof title === 'string' ? title : path?.title;
  if (lastTrackedPath === pagePath) return;
  lastTrackedPath = pagePath;

  window.gtag('event', 'page_view', {
    page_path: pagePath,
    page_title: currentTitle || (typeof document !== 'undefined' ? document.title : ''),
    page_location: pageLocation,
  });
};

export const trackEvent = (eventName, params = {}) => {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  const sanitized = sanitizeParams(params);
  window.gtag('event', eventName, sanitized);
};

export const trackViewItem = ({ id, name, category, price }) => {
  trackEvent('view_item', {
    items: [
      {
        item_id: String(id || ''),
        item_name: String(name || ''),
        item_category: String(category || ''),
        price: typeof price === 'number' ? price : undefined,
      }
    ],
  });
};

export const trackGenerateLead = ({ source }) => {
  trackEvent('generate_lead', {
    lead_source: String(source || 'website'),
    value: 1,
    currency: 'UZS',
  });
};

export const trackClickToCall = () => {
  trackEvent('click_to_call', {
    event_category: 'engagement',
    method: 'phone',
  });
};

export const trackClickTelegram = () => {
  trackEvent('click_telegram', {
    event_category: 'engagement',
    method: 'telegram',
  });
};

const startedForms = new Set();

export const trackFormStart = (formName) => {
  const key = String(formName || 'lead_form');
  if (startedForms.has(key)) return;
  startedForms.add(key);

  trackEvent('form_start', {
    form_name: key,
  });
};

export const getAnalyticsContext = () => {
  if (typeof window === 'undefined') {
    return {
      page_location: '',
      page_language: 'ru',
    };
  }
  const href = window.location?.href || '';
  let lang = 'ru';
  if (typeof document !== 'undefined' && document.documentElement?.lang) {
    lang = document.documentElement.lang;
  }
  return {
    page_location: href,
    page_language: lang,
  };
};

export const buildFormEventParams = (params = {}) => {
  const context = getAnalyticsContext();

  const form_id = params.form_id || (params.source === 'LeadPopup' ? 'lead_popup' : params.source);
  const lead_type = params.lead_type || params.request_type || params.type;
  const lead_source = params.lead_source || params.source;

  const result = {
    form_id: form_id ? String(form_id) : undefined,
    form_type: params.form_type ? String(params.form_type) : undefined,
    form_location: params.form_location ? String(params.form_location) : undefined,
    property_id: params.property_id != null && params.property_id !== '' ? String(params.property_id) : undefined,
    property_type: params.property_type ? String(params.property_type) : undefined,
    lead_type: lead_type ? String(lead_type) : undefined,
    page_location: params.page_location || context.page_location,
    page_language: params.page_language || context.page_language,
  };

  if (lead_source) result.lead_source = String(lead_source);
  if (lead_type) result.request_type = String(lead_type);
  if (params.trigger || params.trigger_method) {
    result.trigger_method = String(params.trigger || params.trigger_method);
  }
  if (params.close_method || params.method) {
    result.close_method = String(params.close_method || params.method);
  }
  if (params.error_code) {
    result.error_code = String(params.error_code);
  }

  // Copy any extra safe fields that aren't PII
  for (const [key, val] of Object.entries(params)) {
    if (result[key] === undefined && val !== undefined && val !== null) {
      result[key] = val;
    }
  }

  return sanitizeParams(result);
};

export const trackLeadFormView = (params = {}) => {
  const eventParams = buildFormEventParams(params);
  trackEvent('lead_form_view', eventParams);
};

export const trackLeadFormStart = (params = {}) => {
  const eventParams = buildFormEventParams(params);
  trackEvent('lead_form_start', eventParams);
};

export const trackLeadFormSubmit = (params = {}) => {
  const eventParams = buildFormEventParams(params);
  trackEvent('lead_form_submit', eventParams);
};

export const trackLeadFormSuccess = (params = {}) => {
  const eventParams = buildFormEventParams(params);
  trackEvent('lead_form_success', eventParams);
};

export const trackLeadFormError = (params = {}) => {
  const eventParams = buildFormEventParams(params);
  trackEvent('lead_form_error', eventParams);
};

export const trackLeadModalOpen = (params = {}) => {
  const eventParams = buildFormEventParams({
    form_id: 'lead_popup',
    form_type: 'modal',
    form_location: 'popup_modal',
    trigger_method: params.trigger || params.trigger_method || 'auto_timer',
    lead_source: params.source || params.lead_source || 'LeadPopup',
    ...params,
  });
  trackEvent('lead_modal_open', eventParams);
};

export const trackLeadModalClose = (params = {}) => {
  const eventParams = buildFormEventParams({
    form_id: 'lead_popup',
    form_type: 'modal',
    form_location: 'popup_modal',
    close_method: params.close_method || params.method || 'close_button',
    ...params,
  });
  trackEvent('lead_modal_close', eventParams);
};
