import React, { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { HelmetProvider } from 'react-helmet-async';
import Layout from './components/Layout';
import PageLoader from './components/PageLoader';
import { Toaster } from 'sonner';
import ErrorBoundary from './components/ErrorBoundary';
import { LanguageProvider } from './lib/LanguageContext';
import { PaystackProvider } from './providers/PaystackProvider';

// Code-split all page routes for fast initial bundle and optimal desktop & mobile performance
const Home = lazy(() => import('./pages/Home'));
const About = lazy(() => import('./pages/About'));
const Services = lazy(() => import('./pages/Services'));
const ServiceDetail = lazy(() => import('./pages/ServiceDetail'));
const Portfolio = lazy(() => import('./pages/Portfolio'));
const Gallery = lazy(() => import('./pages/Gallery'));
const Booking = lazy(() => import('./pages/Booking'));
const Contact = lazy(() => import('./pages/Contact'));
const Team = lazy(() => import('./pages/Team'));
const Admin = lazy(() => import('./pages/Admin'));
const MyApplications = lazy(() => import('./pages/MyApplications'));
const WorkWithUs = lazy(() => import('./pages/WorkWithUs'));
const Sponsorship = lazy(() => import('./pages/Sponsorship'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const NotFound = lazy(() => import('./pages/NotFound'));

// Optional route prefetcher to load chunks on demand or hover
export const preloadRoute = (routePath: string) => {
  const clean = routePath.split('?')[0].split('#')[0];
  switch (clean) {
    case '/':
      import('./pages/Home');
      break;
    case '/about':
    case '/about-us':
      import('./pages/About');
      break;
    case '/services':
    case '/our-services':
      import('./pages/Services');
      break;
    case '/portfolio':
    case '/projects':
    case '/our-work':
      import('./pages/Portfolio');
      break;
    case '/gallery':
    case '/media':
    case '/photos':
      import('./pages/Gallery');
      break;
    case '/team':
    case '/our-team':
      import('./pages/Team');
      break;
    case '/booking':
    case '/book':
      import('./pages/Booking');
      break;
    case '/contact':
    case '/contact-us':
      import('./pages/Contact');
      break;
    case '/sponsorship':
    case '/sponsor':
    case '/donate':
      import('./pages/Sponsorship');
      break;
    case '/work-with-us':
    case '/careers':
    case '/auditions':
      import('./pages/WorkWithUs');
      break;
    case '/my-applications':
      import('./pages/MyApplications');
      break;
    case '/privacy-policy':
    case '/terms-of-service':
    case '/refund-policy':
      import('./pages/PrivacyPolicy');
      break;
    default:
      break;
  }
};

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);

  return null;
}

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <>
      <ScrollToTop />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="w-full flex-grow flex flex-col"
        >
          <Suspense fallback={<PageLoader label="Loading page..." minHeight="min-h-[70vh]" />}>
            <Routes location={location}>
              <Route path="/" element={<Home />} />
              <Route path="/about" element={<About />} />
              <Route path="/about-us" element={<Navigate to="/about" replace />} />

              <Route path="/services" element={<Services />} />
              <Route path="/service" element={<Navigate to="/services" replace />} />
              <Route path="/our-services" element={<Navigate to="/services" replace />} />
              <Route path="/services/:id" element={<ServiceDetail />} />

              <Route path="/portfolio" element={<Portfolio />} />
              <Route path="/projects" element={<Navigate to="/portfolio" replace />} />
              <Route path="/our-work" element={<Navigate to="/portfolio" replace />} />

              <Route path="/gallery" element={<Gallery />} />
              <Route path="/media" element={<Navigate to="/gallery" replace />} />
              <Route path="/photos" element={<Navigate to="/gallery" replace />} />
              <Route path="/videos" element={<Navigate to="/gallery" replace />} />

              <Route path="/team" element={<Team />} />
              <Route path="/our-team" element={<Navigate to="/team" replace />} />
              <Route path="/staff" element={<Navigate to="/team" replace />} />

              <Route path="/booking" element={<Booking />} />
              <Route path="/book" element={<Navigate to="/booking" replace />} />
              <Route path="/book-now" element={<Navigate to="/booking" replace />} />
              <Route path="/appointments" element={<Navigate to="/booking" replace />} />
              <Route path="/schedule" element={<Navigate to="/booking" replace />} />

              <Route path="/contact" element={<Contact />} />
              <Route path="/contact-us" element={<Navigate to="/contact" replace />} />

              <Route path="/sponsorship" element={<Sponsorship />} />
              <Route path="/sponsor" element={<Navigate to="/sponsorship" replace />} />
              <Route path="/sponsor-us" element={<Navigate to="/sponsorship" replace />} />
              <Route path="/donate" element={<Navigate to="/sponsorship" replace />} />
              <Route path="/donations" element={<Navigate to="/sponsorship" replace />} />

              <Route path="/work-with-us" element={<WorkWithUs />} />
              <Route path="/workwithus" element={<Navigate to="/work-with-us" replace />} />
              <Route path="/careers" element={<Navigate to="/work-with-us" replace />} />
              <Route path="/jobs" element={<Navigate to="/work-with-us" replace />} />
              <Route path="/auditions" element={<Navigate to="/work-with-us" replace />} />
              <Route path="/casting" element={<Navigate to="/work-with-us" replace />} />

              <Route path="/my-applications" element={<MyApplications />} />
              <Route path="/applications" element={<Navigate to="/my-applications" replace />} />
              <Route path="/my-apps" element={<Navigate to="/my-applications" replace />} />

              <Route path="/privacy-policy" element={<PrivacyPolicy defaultTab="privacy" />} />
              <Route path="/privacy" element={<PrivacyPolicy defaultTab="privacy" />} />
              <Route path="/terms-of-service" element={<PrivacyPolicy defaultTab="terms" />} />
              <Route path="/terms" element={<PrivacyPolicy defaultTab="terms" />} />
              <Route path="/refund-policy" element={<PrivacyPolicy defaultTab="refund" />} />
              <Route path="/refund" element={<PrivacyPolicy defaultTab="refund" />} />
              <Route path="/legal" element={<PrivacyPolicy defaultTab="privacy" />} />

              <Route path="/admin/*" element={<Admin />} />
              <Route path="/assets" element={<Navigate to="/admin/assets" replace />} />
              <Route path="/company-assets" element={<Navigate to="/admin/assets" replace />} />
              <Route path="/inventory" element={<Navigate to="/admin/assets" replace />} />
              <Route path="/login" element={<Navigate to="/admin" replace />} />
              <Route path="/admin-login" element={<Navigate to="/admin" replace />} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </motion.div>
      </AnimatePresence>
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <HelmetProvider>
        <LanguageProvider>
          <PaystackProvider>
            <Router>
              <Layout>
                <AnimatedRoutes />
              </Layout>
              <Toaster position="top-center" />
            </Router>
          </PaystackProvider>
        </LanguageProvider>
      </HelmetProvider>
    </ErrorBoundary>
  );
}


