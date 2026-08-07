declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

export const initAnalytics = () => {
  const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;
  if (!import.meta.env.PROD || !measurementId) return;

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer ?? [];
  // gtag.js は配列ではなく arguments オブジェクトを積まれる前提で実装されている
  function gtag(..._args: unknown[]) {
    window.dataLayer?.push(arguments);
  }
  gtag("js", new Date());
  gtag("config", measurementId);
};
