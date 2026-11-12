const GA_ID = 'G-GWK8BLPSFB';

if (typeof window !== 'undefined' && !window.gtag) {
  window.dataLayer = window.dataLayer || [];

  window.gtag = function () {
    window.dataLayer.push(arguments);
  };

  window.gtag('js', new Date());
  window.gtag('config', GA_ID);

  const loadGtag = () => {
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
