export const GA_ID = 'G-GWK8BLPSFB';

const PII_KEYS = new Set([
  'name', 'phone', 'telephone', 'mobile', 'email', 'telegram', 'username',
  'password', 'token', 'secret', 'address', 'message', 'user_id'
]);

function sanitizeParams(params = {}) {
  const clean = {};
  for (const [key, val] of Object.entries(params)) {
    if (PII_KEYS.has(key.toLowerCase())) continue;
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
  const currentPath = path || (window.location.pathname + window.location.search);
  if (lastTrackedPath === currentPath) return;
  lastTrackedPath = currentPath;

  window.gtag('event', 'page_view', {
    page_path: currentPath,
    page_title: title || (typeof document !== 'undefined' ? document.title : ''),
    page_location: window.location.href,
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

export const trackClickToCall = (phoneNumber = '') => {
  trackEvent('click_to_call', {
    event_category: 'engagement',
    method: 'phone',
  });
};

export const trackClickTelegram = (target = '') => {
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
