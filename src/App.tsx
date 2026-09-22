import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { HelmetProvider } from 'react-helmet-async';
import Layout from './components/Layout';
import Home from './pages/Home';
import About from './pages/About';
import Services from './pages/Services';
import ServiceDetail from './pages/ServiceDetail';
import Portfolio from './pages/Portfolio';
import Gallery from './pages/Gallery';
import Booking from './pages/Booking';
import Contact from './pages/Contact';
import Team from './pages/Team';
import Admin from './pages/Admin';
import MyApplications from './pages/MyApplications';
import WorkWithUs from './pages/WorkWithUs';
import Sponsorship from './pages/Sponsorship';
import PrivacyPolicy from './pages/PrivacyPolicy';
import NotFound from './pages/NotFound';
import { Toaster } from 'sonner';
import ErrorBoundary from './components/ErrorBoundary';
import { LanguageProvider } from './lib/LanguageContext';
import { PaystackProvider } from './providers/PaystackProvider';

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

            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/privacy" element={<Navigate to="/privacy-policy?tab=privacy" replace />} />
            <Route path="/terms-of-service" element={<Navigate to="/privacy-policy?tab=terms" replace />} />
            <Route path="/terms" element={<Navigate to="/privacy-policy?tab=terms" replace />} />
            <Route path="/refund-policy" element={<Navigate to="/privacy-policy?tab=refund" replace />} />
            <Route path="/refund" element={<Navigate to="/privacy-policy?tab=refund" replace />} />
            <Route path="/legal" element={<Navigate to="/privacy-policy" replace />} />

            <Route path="/admin/*" element={<Admin />} />
            <Route path="/login" element={<Navigate to="/admin" replace />} />
            <Route path="/admin-login" element={<Navigate to="/admin" replace />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
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


