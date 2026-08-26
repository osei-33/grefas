import * as React from 'react';
import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/firebase';
import { logAuditActivity } from '@/lib/auditLogger';
import { 
  ShieldCheck, 
  FileText, 
  RotateCcw, 
  Save, 
  Eye, 
  Edit3, 
  Copy, 
  ExternalLink, 
  Trash2, 
  CheckCircle2, 
  Loader2, 
  Sparkles,
  MapPin,
  Mail,
  Phone,
  Calendar,
  Building,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

const DEFAULT_PRIVACY_POLICY = `GREFAS CONSULT & ENTERTAINMENT - PRIVACY POLICY

1. INFORMATION WE COLLECT
We collect information required to provide professional consulting, appointment booking, talent auditions, and customer communication:
• Personal Identification: Full name, email address, phone number, physical address, date of birth, and WhatsApp contact details.
• Booking & Service Data: Selected consultation topics, appointment dates, requested production specs, notes, and payment confirmation metadata.
• Career & Audition Submissions: Resumes, video links, portfolio links, bio information, and role selections submitted through the "Work With Us" portal.
• Automated & Log Information: IP address, device specs, browser type, and interaction logs stored securely in encrypted Firestore collections.

2. HOW WE USE YOUR DATA & SMS NOTIFICATIONS
Your data is strictly used for legitimate business purposes:
• Appointment Alerts: We send instant SMS notifications via Arkesel SMS Gateway to confirm your booking dates, appointment reminders, and service intake updates.
• Career Evaluation: Talent submissions are processed solely by authorized Grefas talent casting directors for active auditions and project roles.

3. DATA PROTECTION & SECURITY
We enforce rigorous Firebase Security Rules and server-side encryption to prevent unauthorized access, modification, or disclosure of user records. Access to client databases is restricted strictly to verified administrative personnel.

4. THIRD-PARTY INTEGRATIONS
Grefas does not sell, rent, or trade your personal data. We only share necessary data points with trusted technology service partners strictly for application performance:
• Arkesel Telecom: Direct SMS dispatch for appointment receipts and status alerts.
• Google Cloud & Firebase: Authentication and database cloud infrastructure.

5. YOUR RIGHTS & CONTACT
You have the right to request access to, correction of, or complete deletion of your personal records from our databases. To exercise your rights, please reach out to our privacy officer at legal@grefas.com.`;

const DEFAULT_TERMS_OF_SERVICE = `GREFAS CONSULT & ENTERTAINMENT - TERMS OF SERVICE

1. SERVICE SCOPE & ENGAGEMENT
Grefas Consult & Entertainment provides professional business consulting, theatre and film casting, talent and artiste management, event video production, and multimedia creation. All service agreements, project scopes, delivery milestones, and appointment specifications are formalized through official booking passes, invoices, and confirmed digital transaction receipts.

2. RECEIPT OF FUNDS & ACCEPTED PAYMENT METHODS
• Currency & Pricing: All standard fees, consultation rates, audition registration charges, and production deposits are quoted and billed in Ghana Cedis (GH₵ / GHS) unless expressly stated otherwise in a formal international agreement.
• Accepted Payment Channels: Payments are received digitally through our verified Paystack payment gateway supporting Ghanaian Mobile Money (MTN MoMo, Telecel Cash, AT Money), Visa and Mastercard debit/credit cards, and direct bank transfers.
• Booking Deposits & Advance Payments: Scheduled consultation sessions, studio bookings, talent registration fees, and production retainers require full or agreed advance deposit payment authorization prior to confirmation and seat reservation.
• Official Proof of Payment: Only payments with an authenticated Paystack reference code and matching system receipt ID are recognized as valid settlement. Grefas will never solicit cash transfers to personal or unverified accounts.

3. PAYMENT PROCESSING, VERIFICATION & SECURITY
• Secure Processing Infrastructure: All online transactions are processed through Paystack's PCI-DSS Level 1 certified payment infrastructure with 256-bit TLS/SSL encryption. Grefas does not store card numbers, CVVs, or Mobile Money PINs on its servers.
• Automated Real-Time Verification: Electronic receipts are programmatically verified with the payment gateway upon checkout. Successful transactions automatically generate a verifiable digital receipt, SMS confirmation, and downloadable PDF service pass.
• Milestone & Installment Plans: Long-term consultancy and multi-phase media productions may be billed via scheduled installment agreements. Each milestone installment is recorded in the client's financial ledger and must be cleared before the release of subsequent deliverables.

4. DISBURSEMENT OF FUNDS, PAYOUTS & REFUNDS
• Client Refunds: Approved refund requests (subject to our Refund Policy) are disbursed directly to the client's original payment method or registered Mobile Money wallet within 3 to 5 business days following administrative authorization.
• Talent & Contractor Disbursements: Actor honorariums, production crew compensation, artiste performance fees, and freelance vendor stipends are disbursed via verified Mobile Money or direct bank transfer upon satisfactory milestone completion and sign-off by the production director.
• Staff & Payroll Disbursements: Regular employee salaries, statutory contributions, and operational allowances are disbursed on designated monthly payroll dates through our integrated financial payroll system.
• Dispute Resolution & Chargebacks: Any payment disputes, duplicate charges, or billing inquiries must be submitted in writing to billing@grefas.com or our Nyinahin-Ashanti office within 14 days of the transaction date. Fraudulent chargebacks will be pursued in accordance with Ghanaian commercial law.

5. USER RESPONSIBILITIES & CONDUCT
When using our website, booking appointments, or submitting talent applications:
• You guarantee that all personal information, contact numbers, and portfolio materials submitted are accurate, current, and authentic.
• You agree not to upload fraudulent material, offensive content, or unauthorized third-party intellectual property.
• You agree to honor scheduled appointment times for consultations, studio sessions, and on-location shoots in Nyinahin-Ashanti and across the Ashanti Region.

6. INTELLECTUAL PROPERTY & MEDIA RIGHTS
All bespoke video productions, stage scripts, sound recordings, branding assets, and promotional materials created by Grefas Consult & Entertainment remain protected intellectual property until all contractually agreed fees have been received in full. Client usage licenses and master distribution rights are governed by specific written production agreements.

7. LIMITATION OF LIABILITY & GOVERNING LAW
Grefas Consult & Entertainment shall not be liable for indirect, incidental, or consequential damages resulting from platform downtime, telecom network delays, or third-party payment gateway maintenance. These terms are governed by and construed in accordance with the laws of the Republic of Ghana, and any disputes shall be subject to the jurisdiction of Ghanaian courts.`;

const DEFAULT_REFUND_POLICY = `GREFAS CONSULT & ENTERTAINMENT - REFUND POLICY

1. CLIENT SATISFACTION ASSURANCE
If a booked consulting session or service cannot be completed due to scheduling conflicts on our part, you are entitled to a 100% full refund or an instant fee-free rescheduling.

2. CONSULTATION BOOKING CANCELLATIONS
• 48+ Hours Notice: Full 100% refund of advance deposits if cancellation request is received at least 48 hours prior to scheduled appointment time.
• Under 24 Hours Notice: 50% partial refund to cover allocated specialist prep time, or option to reschedule session at no extra charge.

3. MEDIA & PRODUCTION PROJECTS
For large-scale video productions, equipment rentals, and stage event crew reservations:
• Pre-Production Stage: Deposits are refundable minus incurred direct preparation expenses.
• Active Shoot / Post-Production Stage: Once filming or studio editing has commenced, fees for completed milestone work are non-refundable.

4. HOW TO REQUEST A REFUND
To initiate a refund request:
1. Send an email to refunds@grefas.com or visit our office in Nyinahin-Ashanti.
2. Include your Order Number or Appointment Receipt ID along with your registered phone number.
3. Our finance team will process verified refund requests within 3 to 5 business days via mobile money or original payment method.`;

export default function ManageLegalPolicies() {
  const [activeTab, setActiveTab] = useState<'privacy' | 'terms' | 'refund' | 'desk'>('privacy');
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [policyData, setPolicyData] = useState({
    privacyPolicyContent: '',
    termsOfServiceContent: '',
    refundPolicyContent: '',
    policyLastUpdatedDate: 'August 12, 2026',
    privacyDeskTitle: 'Grefas Data Privacy Desk',
    privacyDeskLocation: 'Nyinahin-Ashanti, Ashanti Region, Ghana (GPS: AI-0008-9223)',
    privacyDeskEmail: 'legal@grefas.com',
    privacyDeskPhone: '+233 24 000 0000'
  });

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setPolicyData({
          privacyPolicyContent: data.privacyPolicyContent || '',
          termsOfServiceContent: data.termsOfServiceContent || '',
          refundPolicyContent: data.refundPolicyContent || '',
          policyLastUpdatedDate: data.policyLastUpdatedDate || 'August 12, 2026',
          privacyDeskTitle: data.privacyDeskTitle || 'Grefas Data Privacy Desk',
          privacyDeskLocation: data.privacyDeskLocation || 'Nyinahin-Ashanti, Ashanti Region, Ghana (GPS: AI-0008-9223)',
          privacyDeskEmail: data.privacyDeskEmail || 'legal@grefas.com',
          privacyDeskPhone: data.privacyDeskPhone || '+233 24 000 0000'
        });
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'global'), policyData, { merge: true });
      await logAuditActivity({
        type: 'policy_update',
        module: 'Legal & Policies',
        action: 'UPDATED_LEGAL_POLICIES',
        description: `Updated legal governance policies and privacy desk configuration (Tab: ${activeTab.toUpperCase()}).`,
        metadata: { tab: activeTab, updatedDate: policyData.policyLastUpdatedDate }
      });
      toast.success('Legal Policies & Privacy Desk settings updated successfully! Public pages reflect changes live.');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/global');
      toast.error('Failed to save policy updates.');
    } finally {
      setSaving(false);
    }
  };

  const loadDefaultTemplate = (type: 'privacy' | 'terms' | 'refund') => {
    if (type === 'privacy') {
      setPolicyData(prev => ({ ...prev, privacyPolicyContent: DEFAULT_PRIVACY_POLICY }));
      toast.success('Loaded Standard Privacy Policy Template!');
    } else if (type === 'terms') {
      setPolicyData(prev => ({ ...prev, termsOfServiceContent: DEFAULT_TERMS_OF_SERVICE }));
      toast.success('Loaded Standard Terms of Service Template!');
    } else if (type === 'refund') {
      setPolicyData(prev => ({ ...prev, refundPolicyContent: DEFAULT_REFUND_POLICY }));
      toast.success('Loaded Standard Refund Policy Template!');
    }
  };

  const handleClearPolicy = (type: 'privacy' | 'terms' | 'refund') => {
    if (!window.confirm(`Are you sure you want to clear custom content for ${type.toUpperCase()}? (Standard default fallback will be displayed on the public website)`)) {
      return;
    }
    if (type === 'privacy') {
      setPolicyData(prev => ({ ...prev, privacyPolicyContent: '' }));
    } else if (type === 'terms') {
      setPolicyData(prev => ({ ...prev, termsOfServiceContent: '' }));
    } else if (type === 'refund') {
      setPolicyData(prev => ({ ...prev, refundPolicyContent: '' }));
    }
    toast.info(`Cleared custom content for ${type.toUpperCase()}. Remember to click "Save All Policy Changes".`);
  };

  const copyToClipboard = (text: string) => {
    if (!text.trim()) {
      toast.error('No content available to copy.');
      return;
    }
    navigator.clipboard.writeText(text);
    toast.success('Policy document copied to clipboard!');
  };

  const getWordCount = (text: string) => {
    if (!text.trim()) return 0;
    return text.trim().split(/\s+/).length;
  };

  const getCharCount = (text: string) => text.length;

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
      </div>
    );
  }

  const currentContent = 
    activeTab === 'privacy' ? policyData.privacyPolicyContent :
    activeTab === 'terms' ? policyData.termsOfServiceContent :
    activeTab === 'refund' ? policyData.refundPolicyContent : '';

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-orange-500/10 via-orange-500/5 to-transparent p-6 rounded-2xl border border-orange-500/20">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-600/10 text-orange-600 text-xs font-bold uppercase tracking-wider mb-2">
            <ShieldCheck className="h-3.5 w-3.5" /> Policy Management Engine
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
            Legal Policies & Desk Management
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Create, edit, update, or clear the Privacy Policy, Terms of Service, and Refund Policy. Updates reflect instantly on public pages.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`/privacy-policy?tab=${activeTab === 'desk' ? 'privacy' : activeTab}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-muted/60 text-foreground hover:bg-muted border border-border transition-all"
          >
            <ExternalLink className="h-3.5 w-3.5 text-orange-600" />
            View Live Page
          </a>

          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-orange-600 hover:bg-orange-700 text-white font-bold shadow-md gap-2"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save All Policy Changes
          </Button>
        </div>
      </div>

      {/* Primary Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('privacy')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            activeTab === 'privacy'
              ? 'bg-orange-600 text-white shadow-md'
              : 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <ShieldCheck className="h-4 w-4" />
          <span>Privacy Policy</span>
          {policyData.privacyPolicyContent && (
            <span className="h-2 w-2 rounded-full bg-emerald-400" title="Custom content active" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('terms')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            activeTab === 'terms'
              ? 'bg-orange-600 text-white shadow-md'
              : 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>Terms of Service</span>
          {policyData.termsOfServiceContent && (
            <span className="h-2 w-2 rounded-full bg-emerald-400" title="Custom content active" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('refund')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            activeTab === 'refund'
              ? 'bg-orange-600 text-white shadow-md'
              : 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <RotateCcw className="h-4 w-4" />
          <span>Refund Policy</span>
          {policyData.refundPolicyContent && (
            <span className="h-2 w-2 rounded-full bg-emerald-400" title="Custom content active" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('desk')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ml-auto ${
            activeTab === 'desk'
              ? 'bg-orange-600 text-white shadow-md'
              : 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <Building className="h-4 w-4" />
          <span>Privacy Desk Info</span>
        </button>
      </div>

      {/* Legal Privacy Desk Info Settings Tab */}
      {activeTab === 'desk' && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Building className="h-5 w-5 text-orange-600" />
              Privacy Desk & Legal Officer Settings
            </CardTitle>
            <CardDescription>
              Configure the contact information displayed in the legal policy boxes on public pages.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-orange-600" /> Policy Last Updated Date
                </label>
                <Input
                  value={policyData.policyLastUpdatedDate}
                  onChange={(e) => setPolicyData(prev => ({ ...prev, policyLastUpdatedDate: e.target.value }))}
                  placeholder="August 12, 2026"
                  className="bg-muted/50 border-border"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                  <Building className="h-3.5 w-3.5 text-orange-600" /> Privacy Desk Title
                </label>
                <Input
                  value={policyData.privacyDeskTitle}
                  onChange={(e) => setPolicyData(prev => ({ ...prev, privacyDeskTitle: e.target.value }))}
                  placeholder="Grefas Data Privacy Desk"
                  className="bg-muted/50 border-border"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-orange-600" /> Location / GPS Address
                </label>
                <Input
                  value={policyData.privacyDeskLocation}
                  onChange={(e) => setPolicyData(prev => ({ ...prev, privacyDeskLocation: e.target.value }))}
                  placeholder="Nyinahin-Ashanti, Ashanti Region, Ghana (GPS: AI-0008-9223)"
                  className="bg-muted/50 border-border"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-orange-600" /> Privacy Email Address
                </label>
                <Input
                  value={policyData.privacyDeskEmail}
                  onChange={(e) => setPolicyData(prev => ({ ...prev, privacyDeskEmail: e.target.value }))}
                  placeholder="legal@grefas.com"
                  className="bg-muted/50 border-border"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-orange-600" /> Privacy Contact Phone
                </label>
                <Input
                  value={policyData.privacyDeskPhone}
                  onChange={(e) => setPolicyData(prev => ({ ...prev, privacyDeskPhone: e.target.value }))}
                  placeholder="+233 24 000 0000"
                  className="bg-muted/50 border-border"
                />
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-orange-600 hover:bg-orange-700 text-white font-bold gap-2"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Desk Info
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Policy Document Editor / Preview Tab */}
      {activeTab !== 'desk' && (
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
            <div>
              <CardTitle className="text-foreground flex items-center gap-2">
                {activeTab === 'privacy' && <ShieldCheck className="h-5 w-5 text-orange-600" />}
                {activeTab === 'terms' && <FileText className="h-5 w-5 text-orange-600" />}
                {activeTab === 'refund' && <RotateCcw className="h-5 w-5 text-orange-600" />}
                <span>
                  {activeTab === 'privacy' ? 'Privacy Policy Document' :
                   activeTab === 'terms' ? 'Terms of Service Document' : 'Refund Policy Document'}
                </span>
              </CardTitle>
              <CardDescription className="mt-1">
                Edit the text below. Blank content falls back gracefully to standard structured default text.
              </CardDescription>
            </div>

            {/* Editor Action Buttons Toolbar */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPreviewMode(!isPreviewMode)}
                className="gap-1.5 text-xs font-semibold"
              >
                {isPreviewMode ? <Edit3 className="h-3.5 w-3.5 text-orange-600" /> : <Eye className="h-3.5 w-3.5 text-orange-600" />}
                {isPreviewMode ? 'Edit Mode' : 'Live Preview'}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => loadDefaultTemplate(activeTab)}
                className="gap-1.5 text-xs font-semibold text-orange-600 hover:text-orange-700"
                title="Load standard pre-formatted policy template"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Load Template
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(currentContent)}
                className="gap-1.5 text-xs font-semibold"
                title="Copy current text to clipboard"
              >
                <Copy className="h-3.5 w-3.5" />
                Copy
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleClearPolicy(activeTab)}
                className="gap-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                title="Clear custom policy text"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear
              </Button>
            </div>
          </CardHeader>

          <CardContent className="pt-6 space-y-4">
            {/* Status Statistics Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-muted/30 p-3 rounded-xl border border-border text-xs text-muted-foreground">
              <div className="flex items-center gap-4">
                <span>Status: <strong className={currentContent ? "text-emerald-600 font-bold" : "text-amber-600 font-bold"}>
                  {currentContent ? "Custom Policy Active" : "Using Standard Default Fallback"}
                </strong></span>
                <span>Words: <strong className="text-foreground">{getWordCount(currentContent)}</strong></span>
                <span>Characters: <strong className="text-foreground">{getCharCount(currentContent)}</strong></span>
              </div>
              <div>
                Effective Date: <strong className="text-foreground">{policyData.policyLastUpdatedDate}</strong>
              </div>
            </div>

            {/* Editor or Preview Area */}
            {isPreviewMode ? (
              <div className="min-h-[400px] bg-muted/20 p-6 rounded-2xl border border-border space-y-4">
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <span className="text-xs font-bold uppercase tracking-widest text-orange-600 flex items-center gap-1.5">
                    <Eye className="h-4 w-4" /> Live Public Preview Output
                  </span>
                  <span className="text-xs text-muted-foreground">Formatted View</span>
                </div>
                
                {currentContent ? (
                  <div className="prose dark:prose-invert max-w-none text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                    {currentContent}
                  </div>
                ) : (
                  <div className="text-center py-12 space-y-3">
                    <Info className="h-8 w-8 text-amber-500 mx-auto" />
                    <p className="text-sm font-semibold text-foreground">No Custom Policy Content Set</p>
                    <p className="text-xs text-muted-foreground max-w-md mx-auto">
                      When custom text is empty, the public website automatically displays the standard Grefas Consult & Entertainment default policy structure. Click <strong>"Load Template"</strong> to modify the standard draft!
                    </p>
                    <Button
                      size="sm"
                      onClick={() => loadDefaultTemplate(activeTab)}
                      className="bg-orange-600 hover:bg-orange-700 text-white font-bold gap-2 mt-2"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Load Default Template Now
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Textarea
                  value={
                    activeTab === 'privacy' ? policyData.privacyPolicyContent :
                    activeTab === 'terms' ? policyData.termsOfServiceContent :
                    policyData.refundPolicyContent
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    if (activeTab === 'privacy') {
                      setPolicyData(prev => ({ ...prev, privacyPolicyContent: val }));
                    } else if (activeTab === 'terms') {
                      setPolicyData(prev => ({ ...prev, termsOfServiceContent: val }));
                    } else if (activeTab === 'refund') {
                      setPolicyData(prev => ({ ...prev, refundPolicyContent: val }));
                    }
                  }}
                  placeholder={`Write or paste custom ${activeTab === 'privacy' ? 'Privacy Policy' : activeTab === 'terms' ? 'Terms of Service' : 'Refund Policy'} document text here...`}
                  className="min-h-[420px] font-mono text-sm leading-relaxed bg-muted/20 border-border focus:border-orange-500 p-4 rounded-xl"
                />
              </div>
            )}

            {/* Bottom Save Action Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-border">
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                Changes are saved to Firestore and update all public browser sessions immediately.
              </div>

              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-orange-600 hover:bg-orange-700 text-white font-bold shadow-md gap-2"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save All Policy Changes
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
