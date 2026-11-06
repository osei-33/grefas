import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Safeguard console: Route transient Firestore backend connection notices to console.debug
// so that normal offline fallback and reconnection events do not trigger artificial error alerts.
const originalConsoleError = console.error;
console.error = function (...args: any[]) {
  const message = args
    .map(arg => (typeof arg === 'string' ? arg : arg instanceof Error ? arg.message : ''))
    .join(' ');
  if (
    message.includes('Could not reach Cloud Firestore backend') ||
    message.includes('operate in offline mode') ||
    message.includes('Connection failed 1 times')
  ) {
    console.debug('[Firestore Connection Notice - Handled]:', ...args);
    return;
  }
  originalConsoleError.apply(console, args);
};

// Audit critical deployment environment variables at runtime
try {
  const paystackKey = (import.meta as any).env?.VITE_PAYSTACK_PUBLIC_KEY;
  const isKeyLoaded = Boolean(paystackKey && typeof paystackKey === 'string' && paystackKey.trim().length > 0);
  const isPlaceholder = isKeyLoaded && (paystackKey.includes('sample_key') || paystackKey.includes('placeholder'));

  console.log(
    `[Runtime Deployment Audit] VITE_PAYSTACK_PUBLIC_KEY: ${
      isKeyLoaded
        ? isPlaceholder
          ? 'Placeholder / Sample Key Detected'
          : `Loaded (${paystackKey.slice(0, 8)}...${paystackKey.slice(-4)})`
        : 'Not injected in bundle (PaystackProvider will load credentials from /api/paystack/config)'
    }`
  );
} catch (auditErr) {
  console.warn('[Runtime Deployment Audit] Environment inspection notice:', auditErr);
}

// Enforce app to return to homepage when a client refreshes the page
try {
  let isReload = false;
  const navEntries = performance.getEntriesByType('navigation');
  const navType = navEntries.length > 0 ? (navEntries[0] as PerformanceNavigationTiming).type : '';
  const isExplicitReload = navType === 'reload' || (window.performance as any)?.navigation?.type === 1;
  const isSessionRefresh = navType !== 'back_forward' && sessionStorage.getItem('grefas_page_refresh') === 'true';

  isReload = Boolean(isExplicitReload || isSessionRefresh);
  sessionStorage.removeItem('grefas_page_refresh');

  if (isReload && window.location.pathname !== '/' && window.location.pathname !== '') {
    window.history.replaceState(null, '', '/');
  }

  const markRefresh = () => {
    try {
      sessionStorage.setItem('grefas_page_refresh', 'true');
    } catch {}
  };
  window.addEventListener('beforeunload', markRefresh);
  window.addEventListener('pagehide', markRefresh);
} catch {}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Register PWA service worker in production only; unregister in dev to prevent module cache conflicts
if ('serviceWorker' in navigator) {
  if ((import.meta as any).env?.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('Grefas PWA Service Worker registered:', registration.scope);
        })
        .catch((error) => {
          console.warn('Grefas PWA Service Worker registration failed:', error);
        });
    });
  } else {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister();
      }
    });
  }
}
