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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Register PWA service worker for offline support and mobile installation
if ('serviceWorker' in navigator) {
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
}
