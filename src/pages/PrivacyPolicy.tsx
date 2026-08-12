import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import SEO from '@/components/SEO';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase';
import { 
  ShieldCheck, 
  FileText, 
  CreditCard, 
  CheckCircle2, 
  Clock, 
  Mail, 
  Phone, 
  MapPin, 
  Lock, 
  ArrowRight,
  HelpCircle,
  Printer,
  Headphones
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PrivacyPolicy() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'privacy';
  const [activeTab, setActiveTab] = useState<'privacy' | 'terms' | 'refund'>(
    initialTab === 'terms' || initialTab === 'refund' ? initialTab : 'privacy'
  );

  const [settings, setSettings] = useState<any>({
    policyLastUpdatedDate: 'August 10, 2026',
    privacyDeskTitle: 'Grefas Data Privacy Desk',
    privacyDeskLocation: 'Nyinahin-Ashanti, Ashanti Region, Ghana (GPS: AI-0008-9223)',
    privacyDeskEmail: 'legal@grefas.com',
    privacyDeskPhone: '+233 24 000 0000',
    privacyPolicyContent: '',
    termsOfServiceContent: '',
    refundPolicyContent: ''
  });

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setSettings({
          policyLastUpdatedDate: data.policyLastUpdatedDate || 'August 10, 2026',
          privacyDeskTitle: data.privacyDeskTitle || 'Grefas Data Privacy Desk',
          privacyDeskLocation: data.privacyDeskLocation || 'Nyinahin-Ashanti, Ashanti Region, Ghana (GPS: AI-0008-9223)',
          privacyDeskEmail: data.privacyDeskEmail || 'legal@grefas.com',
          privacyDeskPhone: data.privacyDeskPhone || '+233 24 000 0000',
          privacyPolicyContent: data.privacyPolicyContent || '',
          termsOfServiceContent: data.termsOfServiceContent || '',
          refundPolicyContent: data.refundPolicyContent || ''
        });
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'terms' || tabParam === 'refund' || tabParam === 'privacy') {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  const handleTabChange = (tab: 'privacy' | 'terms' | 'refund') => {
    setActiveTab(tab);
    setSearchParams({ tab });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePrint = () => {
    try {
      window.print();
    } catch (err) {
      console.error('Print trigger failed:', err);
    }
  };

  const lastUpdatedDate = settings.policyLastUpdatedDate || "August 10, 2026";

  return (
    <div className="min-h-screen bg-background text-foreground pt-24 pb-20 print:pt-0 print:pb-0 print:bg-white print:text-black">
      <style>{`
        @media print {
          nav, header, footer, .no-print, #privacy-floating-contact-btn, .sidebar-selector, #privacy-hero-banner {
            display: none !important;
          }
          body, html, #root, main, .min-h-screen {
            background: #ffffff !important;
            color: #000000 !important;
            padding: 0 !important;
            margin: 0 !important;
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            position: static !important;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            box-shadow: none !important;
            text-shadow: none !important;
            opacity: 1 !important;
            transform: none !important;
            transition: none !important;
            animation: none !important;
            filter: none !important;
          }
          .printable-card {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            width: 100% !important;
            max-width: 100% !important;
            display: block !important;
          }
          .printable-card * {
            color: #000000 !important;
            background: transparent !important;
          }
          .print-header {
            display: block !important;
            border-bottom: 2px solid #ea580c !important;
            padding-bottom: 12px !important;
            margin-bottom: 20px !important;
          }
          h1, h2, h3, h4, strong, b {
            color: #000000 !important;
            page-break-after: avoid;
            break-after: avoid;
          }
          p, li, span, div {
            color: #1f2937 !important;
          }
          ul, ol {
            padding-left: 20px !important;
          }
        }
      `}</style>
      <SEO 
        title={
          activeTab === 'privacy' 
            ? 'Privacy Policy' 
            : activeTab === 'terms' 
            ? 'Terms of Service' 
            : 'Refund Policy'
        }
        description={`Read the official ${activeTab === 'privacy' ? 'Privacy Policy' : activeTab === 'terms' ? 'Terms of Service' : 'Refund Policy'} of Grefas Consult & Entertainment in Nyinahin-Ashanti, Ashanti Region, Ghana. Clear standards governing data protection, service terms, and refund guarantees.`}
        keywords={`Grefas ${activeTab}, legal policy Ghana, privacy policy Nyinahin, terms of service Ashanti Region, refund policy Grefas`}
      />

      {/* Hero Header */}
      <section id="privacy-hero-banner" className="relative overflow-hidden bg-gradient-to-b from-orange-500/10 via-background to-background py-12 border-b border-border/50 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 bg-orange-500/10 text-orange-600 dark:text-orange-400 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider mb-4 border border-orange-500/20"
          >
            <ShieldCheck className="h-4 w-4" />
            <span>Legal Framework & Service Guarantees</span>
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="text-3xl sm:text-5xl font-black text-foreground tracking-tight"
          >
            Privacy, Terms & Refund Policies
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="mt-4 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto"
          >
            Clear, transparent standards governing your data security, service engagements, bookings, and refund guarantees at Grefas Consult & Entertainment.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="mt-6 flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground"
          >
            <span className="flex items-center gap-1.5 bg-muted/60 px-3 py-1 rounded-md border border-border">
              <Clock className="h-3.5 w-3.5 text-orange-600" />
              Effective Date: <strong className="text-foreground">{lastUpdatedDate}</strong>
            </span>
            <button 
              onClick={handlePrint} 
              type="button"
              className="flex items-center gap-1.5 hover:text-orange-600 transition-colors bg-muted/60 px-3 py-1 rounded-md border border-border cursor-pointer no-print"
              title="Print Policy Document"
              id="print-policy-doc-btn"
            >
              <Printer className="h-3.5 w-3.5" />
              Print Document
            </button>
          </motion.div>
        </div>
      </section>

      {/* Main Content & Navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10 print:mt-0 print:px-0">
        <div className="flex flex-col lg:flex-row gap-8">

          {/* Sticky Tab Sidebar */}
          <div className="w-full lg:w-64 shrink-0 no-print sidebar-selector">
            <div className="lg:sticky lg:top-28 space-y-2 bg-card border border-border rounded-2xl p-3 shadow-sm">
              <span className="text-xs font-bold text-muted-foreground uppercase px-3 py-1.5 block tracking-wider">
                Select Policy
              </span>

              <button
                onClick={() => handleTabChange('privacy')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                  activeTab === 'privacy'
                    ? 'bg-orange-600 text-white shadow-md shadow-orange-600/20'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Lock className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">Privacy Policy</span>
              </button>

              <button
                onClick={() => handleTabChange('terms')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                  activeTab === 'terms'
                    ? 'bg-orange-600 text-white shadow-md shadow-orange-600/20'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <FileText className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">Terms of Service</span>
              </button>

              <button
                onClick={() => handleTabChange('refund')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                  activeTab === 'refund'
                    ? 'bg-orange-600 text-white shadow-md shadow-orange-600/20'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <CreditCard className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">Refund Policy</span>
              </button>

              <div className="pt-4 mt-4 border-t border-border px-3 text-xs text-muted-foreground space-y-2">
                <p className="font-medium text-foreground">Need Assistance?</p>
                <p>Have questions about our terms or privacy practices?</p>
                <Link 
                  to="/contact" 
                  className="inline-flex items-center gap-1.5 text-orange-600 font-semibold hover:underline"
                >
                  Contact Legal Desk <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </div>

          {/* Active Policy Content */}
          <div className="flex-1 min-w-0">
            {/* Print-Only Document Header */}
            <div className="hidden print:block print-header">
              <div className="flex items-center justify-between pb-3 border-b-2 border-orange-600">
                <div>
                  <h1 className="text-xl font-bold text-black uppercase tracking-wider">GREFAS CONSULT & ENTERTAINMENT</h1>
                  <p className="text-xs text-gray-700">Nyinahin-Ashanti, Ashanti Region, Ghana (GPS: AI-0008-9223)</p>
                  <p className="text-xs text-gray-500">Official Governance & Legal Policy Document</p>
                </div>
                <div className="text-right text-xs text-gray-700">
                  <p className="font-bold text-orange-600 uppercase">
                    {activeTab === 'privacy' ? 'PRIVACY POLICY' : activeTab === 'terms' ? 'TERMS OF SERVICE' : 'REFUND POLICY'}
                  </p>
                  <p>Effective Date: {lastUpdatedDate}</p>
                  <p>Contact: {settings.privacyDeskEmail || 'legal@grefas.com'}</p>
                </div>
              </div>
            </div>

            <AnimatePresence mode="wait">

              {/* PRIVACY POLICY TAB */}
              {activeTab === 'privacy' && (
                <motion.div
                  key="privacy"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.3 }}
                  className="printable-card bg-card border border-border rounded-2xl p-6 sm:p-10 shadow-sm space-y-8"
                >
                  <div className="border-b border-border pb-6">
                    <div className="flex items-center gap-3 text-orange-600">
                      <Lock className="h-6 w-6" />
                      <h2 className="text-2xl font-black text-foreground">Privacy Policy</h2>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      Grefas Consult & Entertainment ("Grefas", "we", "us", or "our") respects your privacy and is dedicated to safeguarding your personal data across our web platform and digital services.
                    </p>
                  </div>

                  {/* Custom Privacy Policy Override or Standard Sections */}
                  {settings.privacyPolicyContent ? (
                    <div className="space-y-4">
                      <div className="prose dark:prose-invert max-w-none text-sm text-foreground whitespace-pre-wrap leading-relaxed bg-muted/20 p-5 sm:p-6 rounded-2xl border border-border">
                        {settings.privacyPolicyContent}
                      </div>

                      {/* Grefas Data Privacy Desk Contact Box */}
                      <div className="bg-orange-500/5 border border-orange-500/20 p-5 rounded-2xl text-xs space-y-1.5 text-foreground mt-6">
                        <p className="font-bold text-orange-600 flex items-center gap-2 text-sm">
                          <ShieldCheck className="h-4 w-4" /> {settings.privacyDeskTitle || 'Grefas Data Privacy Desk'}
                        </p>
                        <p className="flex items-center gap-1.5 text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5 text-orange-600 shrink-0" />
                          <span>Location: {settings.privacyDeskLocation || 'Nyinahin-Ashanti, Ashanti Region, Ghana (GPS: AI-0008-9223)'}</span>
                        </p>
                        <p className="flex flex-wrap items-center gap-3 text-muted-foreground pt-1">
                          <span className="flex items-center gap-1.5">
                            <Mail className="h-3.5 w-3.5 text-orange-600 shrink-0" />
                            Email: <a href={`mailto:${settings.privacyDeskEmail || 'legal@grefas.com'}`} className="text-orange-600 font-semibold hover:underline">{settings.privacyDeskEmail || 'legal@grefas.com'}</a>
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Phone className="h-3.5 w-3.5 text-orange-600 shrink-0" />
                            Phone: <a href={`tel:${settings.privacyDeskPhone || '+233 24 000 0000'}`} className="text-orange-600 font-semibold hover:underline">{settings.privacyDeskPhone || '+233 24 000 0000'}</a>
                          </span>
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Section 1 */}
                      <div className="space-y-3">
                        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-500/10 text-orange-600 text-xs font-bold">1</span>
                          Information We Collect
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          We collect information required to provide professional consulting, appointment booking, talent auditions, and customer communication:
                        </p>
                        <ul className="list-disc pl-6 text-sm text-muted-foreground space-y-1.5">
                          <li><strong>Personal Identification:</strong> Full name, email address, phone number, physical address, date of birth, and WhatsApp contact details.</li>
                          <li><strong>Booking & Service Data:</strong> Selected consultation topics, appointment dates, requested production specs, notes, and payment confirmation metadata.</li>
                          <li><strong>Career & Audition Submissions:</strong> Resumes, video links, portfolio links, bio information, and role selections submitted through the "Work With Us" portal.</li>
                          <li><strong>Automated & Log Information:</strong> IP address, device specs, browser type, and interaction logs stored securely in encrypted Firestore collections.</li>
                        </ul>
                      </div>

                      {/* Section 2 */}
                      <div className="space-y-3">
                        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-500/10 text-orange-600 text-xs font-bold">2</span>
                          How We Use Your Data & Arkesel SMS Notifications
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          Your data is strictly used for legitimate business purposes:
                        </p>
                        <div className="grid sm:grid-cols-2 gap-4 pt-2">
                          <div className="bg-muted/40 p-4 rounded-xl border border-border">
                            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5">
                              <CheckCircle2 className="h-3.5 w-3.5 text-orange-600" /> Appointment Alerts
                            </h4>
                            <p className="text-xs text-muted-foreground">
                              We send instant SMS notifications via Arkesel SMS Gateway to confirm your booking dates, appointment reminders, and service intake updates.
                            </p>
                          </div>
                          <div className="bg-muted/40 p-4 rounded-xl border border-border">
                            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5">
                              <CheckCircle2 className="h-3.5 w-3.5 text-orange-600" /> Career Evaluation
                            </h4>
                            <p className="text-xs text-muted-foreground">
                              Talent submissions are processed solely by authorized Grefas talent casting directors for active auditions and project roles.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Section 3 */}
                      <div className="space-y-3">
                        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-500/10 text-orange-600 text-xs font-bold">3</span>
                          Data Protection & Security
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          We enforce rigorous Firebase Security Rules and server-side encryption to prevent unauthorized access, modification, or disclosure of user records. Access to client databases is restricted strictly to verified administrative personnel.
                        </p>
                      </div>

                      {/* Section 4 */}
                      <div className="space-y-3">
                        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-500/10 text-orange-600 text-xs font-bold">4</span>
                          Third-Party Integrations
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          Grefas does not sell, rent, or trade your personal data. We only share necessary data points with trusted technology service partners strictly for application performance:
                        </p>
                        <ul className="list-disc pl-6 text-sm text-muted-foreground space-y-1">
                          <li><strong>Arkesel Telecom:</strong> Direct SMS dispatch for appointment receipts and status alerts.</li>
                          <li><strong>Google Cloud & Firebase:</strong> Authentication and database cloud infrastructure.</li>
                        </ul>
                      </div>

                      {/* Section 5 */}
                      <div className="space-y-3">
                        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-500/10 text-orange-600 text-xs font-bold">5</span>
                          Your Rights & Contact
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          You have the right to request access to, correction of, or complete deletion of your personal records from our databases. To exercise your rights, please reach out to our privacy officer at:
                        </p>
                        <div className="bg-orange-500/5 border border-orange-500/20 p-5 rounded-2xl text-xs space-y-1.5 text-foreground">
                          <p className="font-bold text-orange-600 flex items-center gap-2 text-sm">
                            <ShieldCheck className="h-4 w-4" /> {settings.privacyDeskTitle || 'Grefas Data Privacy Desk'}
                          </p>
                          <p className="flex items-center gap-1.5 text-muted-foreground">
                            <MapPin className="h-3.5 w-3.5 text-orange-600 shrink-0" />
                            <span>Location: {settings.privacyDeskLocation || 'Nyinahin-Ashanti, Ashanti Region, Ghana (GPS: AI-0008-9223)'}</span>
                          </p>
                          <p className="flex flex-wrap items-center gap-3 text-muted-foreground pt-1">
                            <span className="flex items-center gap-1.5">
                              <Mail className="h-3.5 w-3.5 text-orange-600 shrink-0" />
                              Email: <a href={`mailto:${settings.privacyDeskEmail || 'legal@grefas.com'}`} className="text-orange-600 font-semibold hover:underline">{settings.privacyDeskEmail || 'legal@grefas.com'}</a>
                            </span>
                            <span className="flex items-center gap-1.5">
                              <Phone className="h-3.5 w-3.5 text-orange-600 shrink-0" />
                              Phone: <a href={`tel:${settings.privacyDeskPhone || '+233 24 000 0000'}`} className="text-orange-600 font-semibold hover:underline">{settings.privacyDeskPhone || '+233 24 000 0000'}</a>
                            </span>
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                </motion.div>
              )}

              {/* TERMS OF SERVICE TAB */}
              {activeTab === 'terms' && (
                <motion.div
                  key="terms"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.3 }}
                  className="printable-card bg-card border border-border rounded-2xl p-6 sm:p-10 shadow-sm space-y-8"
                >
                  <div className="border-b border-border pb-6">
                    <div className="flex items-center gap-3 text-orange-600">
                      <FileText className="h-6 w-6" />
                      <h2 className="text-2xl font-black text-foreground">Terms of Service</h2>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      By accessing our platform, booking appointments, or engaging Grefas Consult & Entertainment for business or production services, you agree to comply with the following binding terms.
                    </p>
                  </div>

                  {/* Custom Terms of Service Override or Standard Sections */}
                  {settings.termsOfServiceContent ? (
                    <div className="prose dark:prose-invert max-w-none text-sm text-foreground whitespace-pre-wrap leading-relaxed bg-muted/20 p-5 sm:p-6 rounded-2xl border border-border">
                      {settings.termsOfServiceContent}
                    </div>
                  ) : (
                    <>
                      {/* Section 1 */}
                      <div className="space-y-3">
                        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-500/10 text-orange-600 text-xs font-bold">1</span>
                          Service Scope & Engagement
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          Grefas provides professional business consulting, theatre and film casting, artiste management, event video production, and media creation. All service agreements, timelines, and deliverable specifications will be documented in confirmed appointment receipts and service passes.
                        </p>
                      </div>

                      {/* Section 2 */}
                      <div className="space-y-3">
                        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-500/10 text-orange-600 text-xs font-bold">2</span>
                          User Responsibilities & Conduct
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          When using our website or submitting talent applications:
                        </p>
                        <ul className="list-disc pl-6 text-sm text-muted-foreground space-y-1.5">
                          <li>You guarantee that all personal details, contact numbers, and portfolio files provided are truthful and authentic.</li>
                          <li>You agree not to upload fraudulent material, offensive content, or intellectual property belonging to third parties without authorization.</li>
                          <li>You must maintain punctuality for scheduled consultation appointments and production shoots in Nyinahin-Ashanti.</li>
                        </ul>
                      </div>

                      {/* Section 3 */}
                      <div className="space-y-3">
                        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-500/10 text-orange-600 text-xs font-bold">3</span>
                          Intellectual Property & Media Rights
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          All video productions, scripts, branding elements, and media created under Grefas Entertainment remain protected intellectual property. Specific media distribution rights granted to clients will be explicitly defined in signed production contracts.
                        </p>
                      </div>

                      {/* Section 4 */}
                      <div className="space-y-3">
                        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-500/10 text-orange-600 text-xs font-bold">4</span>
                          Limitation of Liability & Governing Law
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          Grefas Consult & Entertainment shall not be held liable for indirect or consequential damages arising from website downtime or third-party telecom delays. These terms are governed by and construed in accordance with the laws of the <strong>Republic of Ghana</strong>.
                        </p>
                      </div>
                    </>
                  )}
                </motion.div>
              )}

              {/* REFUND POLICY TAB */}
              {activeTab === 'refund' && (
                <motion.div
                  key="refund"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.3 }}
                  className="printable-card bg-card border border-border rounded-2xl p-6 sm:p-10 shadow-sm space-y-8"
                >
                  <div className="border-b border-border pb-6">
                    <div className="flex items-center gap-3 text-orange-600">
                      <CreditCard className="h-6 w-6" />
                      <h2 className="text-2xl font-black text-foreground">Refund & Cancellation Policy</h2>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      We strive to ensure complete satisfaction across all consulting sessions and creative media productions. Our transparent refund framework outlines your rights for cancellations and refunds.
                    </p>
                  </div>

                  {/* Custom Refund Policy Override or Standard Sections */}
                  {settings.refundPolicyContent ? (
                    <div className="prose dark:prose-invert max-w-none text-sm text-foreground whitespace-pre-wrap leading-relaxed bg-muted/20 p-5 sm:p-6 rounded-2xl border border-border">
                      {settings.refundPolicyContent}
                    </div>
                  ) : (
                    <>
                      {/* Guarantee Card */}
                      <div className="bg-gradient-to-r from-orange-500/10 via-orange-500/5 to-transparent border border-orange-500/30 p-5 rounded-2xl flex items-start gap-4">
                        <div className="h-10 w-10 rounded-xl bg-orange-600 text-white flex items-center justify-center shrink-0 shadow-md">
                          <CheckCircle2 className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-foreground">Client Satisfaction Assurance</h3>
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                            If a booked consulting session or service cannot be completed due to scheduling conflicts on our part, you are entitled to a 100% full refund or an instant fee-free rescheduling.
                          </p>
                        </div>
                      </div>

                      {/* Section 1 */}
                      <div className="space-y-3">
                        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-500/10 text-orange-600 text-xs font-bold">1</span>
                          Consultation Booking Cancellations & Refunds
                        </h3>
                        <div className="grid sm:grid-cols-2 gap-4">
                          <div className="bg-muted/40 p-4 rounded-xl border border-border">
                            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider mb-1 text-emerald-600 dark:text-emerald-400">
                              48+ Hours Notice
                            </h4>
                            <p className="text-xs text-muted-foreground">
                              Full 100% refund of advance deposits if cancellation request is received at least 48 hours prior to scheduled appointment time.
                            </p>
                          </div>
                          <div className="bg-muted/40 p-4 rounded-xl border border-border">
                            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider mb-1 text-amber-600 dark:text-amber-400">
                              Under 24 Hours Notice
                            </h4>
                            <p className="text-xs text-muted-foreground">
                              50% partial refund to cover allocated specialist prep time, or option to reschedule session at no extra charge.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Section 2 */}
                      <div className="space-y-3">
                        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-500/10 text-orange-600 text-xs font-bold">2</span>
                          Media & Production Projects
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          For large-scale video productions, equipment rentals, and stage event crew reservations:
                        </p>
                        <ul className="list-disc pl-6 text-sm text-muted-foreground space-y-1.5">
                          <li><strong>Pre-Production Stage:</strong> Deposits are refundable minus incurred direct preparation expenses.</li>
                          <li><strong>Active Shoot / Post-Production Stage:</strong> Once filming or studio editing has commenced, fees for completed milestone work are non-refundable.</li>
                        </ul>
                      </div>

                      {/* Section 3 */}
                      <div className="space-y-3">
                        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-500/10 text-orange-600 text-xs font-bold">3</span>
                          How to Request a Refund
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          To initiate a refund request:
                        </p>
                        <ol className="list-decimal pl-6 text-sm text-muted-foreground space-y-1.5">
                          <li>Send an email to <strong>refunds@grefas.com</strong> or visit our office in Nyinahin-Ashanti.</li>
                          <li>Include your <strong>Order Number</strong> or <strong>Appointment Receipt ID</strong> along with your registered phone number.</li>
                          <li>Our finance team will process verified refund requests within <strong>3 to 5 business days</strong> via mobile money or original payment method.</li>
                        </ol>
                      </div>
                    </>
                  )}
                </motion.div>
              )}

            </AnimatePresence>
          </div>

        </div>
      </div>

      {/* Footer Contact Banner */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-16 no-print">
        <div className="bg-muted/40 border border-border rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center sm:text-left">
            <h3 className="text-base font-bold text-foreground flex items-center justify-center sm:justify-start gap-2">
              <HelpCircle className="h-5 w-5 text-orange-600" /> Have questions about our policies?
            </h3>
            <p className="text-xs text-muted-foreground">
              Our support and legal compliance team in Nyinahin-Ashanti is available to assist you.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button 
              asChild
              className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl h-10 px-5"
            >
              <Link to="/contact">Get in Touch</Link>
            </Button>
            <Button 
              asChild
              variant="outline"
              className="text-xs font-bold rounded-xl h-10 px-5"
            >
              <Link to="/booking">Book Consultation</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Floating Contact Support Button */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5 }}
        className="fixed bottom-6 left-4 sm:left-6 z-40"
      >
        <Link
          to="/contact"
          className="group flex items-center gap-2.5 bg-card/95 hover:bg-orange-600 text-foreground hover:text-white border border-orange-500/30 hover:border-orange-600 px-4 py-3 rounded-full shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 backdrop-blur-md"
          id="privacy-floating-contact-btn"
        >
          <div className="h-7 w-7 rounded-full bg-orange-500/10 group-hover:bg-white/20 flex items-center justify-center shrink-0 text-orange-600 group-hover:text-white transition-colors">
            <Headphones className="h-4 w-4" />
          </div>
          <span className="text-xs font-bold tracking-wide pr-1">Contact Support</span>
        </Link>
      </motion.div>
    </div>
  );
}
