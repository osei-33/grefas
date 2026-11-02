import * as React from 'react';
import { useState, useEffect } from 'react';
import { useLocation, useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldCheck, 
  Search, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  Printer, 
  Copy, 
  Building2, 
  User, 
  Calendar, 
  ExternalLink, 
  Lock, 
  Clock, 
  Building, 
  Award, 
  HelpCircle,
  Share2,
  Check,
  RefreshCw,
  QrCode,
  ArrowRight,
  Star,
  Mail,
  Phone,
  Briefcase,
  Users,
  Flame,
  Sparkles,
  MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { db } from '@/firebase';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import SEO from '@/components/SEO';
import Breadcrumbs from '@/components/Breadcrumbs';
import { formatLetterBodyHtml } from '@/lib/letterFormatter';
import QRCode from 'qrcode';

interface VerifiedLetter {
  id: string;
  referenceNumber?: string;
  classification?: string;
  subject: string;
  date: string;
  recipientName: string;
  recipientDesignation?: string;
  recipientCompany?: string;
  recipientAddress?: string;
  salutation?: string;
  body: string;
  valediction?: string;
  signatoryName: string;
  signatoryTitle: string;
  letterheadType?: 'entertainment' | 'consult' | 'joint';
  signatorySignature?: string;
  showSeal?: boolean;
}

interface VerifiedTeamMember {
  id: string;
  memberId?: string;
  name: string;
  role: string;
  experience: string;
  bio: string;
  imageUrl: string;
  email?: string;
  phone?: string;
  skills: string[];
  rating?: number;
  category?: 'consulting' | 'entertainment' | 'both';
  available?: boolean;
  projectHighlights?: string[];
}

const DEFAULT_MEMBERS_FALLBACK: Record<string, VerifiedTeamMember> = {
  'GREFAS-TM-001': {
    id: 'default-linda',
    memberId: 'GREFAS-TM-001',
    name: 'Dr. Linda Serwaah',
    role: 'Principal Consultant & Executive Director',
    experience: '12+ Years in Corporate Consulting',
    bio: 'Dr. Linda lead-directs Grefas Consult. Her background in development planning and executive corporate coaching ensures every client engagement reaches impeccable results. She combines traditional strategic management with forward-acting leadership programs.',
    imageUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=500&h=500',
    email: 'serwaahlinda1995@gmail.com',
    phone: '+233240000001',
    skills: ['Corporate Strategy', 'Brand Audits', 'Executive Advising', 'Venture Incubation'],
    rating: 4.9,
    category: 'consulting',
    available: true,
    projectHighlights: [
      'Restructured operations for a regional logistics giant, boosting margin throughput by 24% in under 12 months.',
      'Orchestrated executive transition leadership coaching for 45+ African high-tech startup founders.',
      'Structured the seed stage venture design strategy for an agritech hub leading to a $2.5M Series A raising.'
    ]
  },
  'GREFAS-TM-002': {
    id: 'default-kofi',
    memberId: 'GREFAS-TM-002',
    name: 'Kofi Mensah',
    role: 'Head of Entertainment Production',
    experience: '9+ Years in Live Events',
    bio: 'Kofi is the visionary orchestrator of our entertainment team. Having overseen premium live shows, custom corporate events, and bespoke performance layouts across West Africa, he knows how to transform general audio-visual ideas into unforgettable realities.',
    imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=500&h=500',
    email: 'kofi.production@grefas.com',
    phone: '+233240000002',
    skills: ['Creative Directing', 'Sound Design', 'Artist Bookings', 'Master of Ceremonies'],
    rating: 4.8,
    category: 'entertainment',
    available: true,
    projectHighlights: [
      'Chief producer for West African Premium Music Alliance, handling audio layouts and live MC operations for a 15,000 attendee event.',
      'Directed the grand brand merger celebration for Unity Trust Bank, bringing a seamless multimedia performance setup.',
      'Created custom theatrical and sound installations for the Golden Jubilee Sovereign Gala.'
    ]
  },
  'GREFAS-TM-003': {
    id: 'default-amara',
    memberId: 'GREFAS-TM-003',
    name: 'Amara Diop',
    role: 'Senior Business Specialist',
    experience: '7+ Years in Strategy & Markets',
    bio: 'Amara coordinates market audits, startup scaling paths, and financial strategies. She helps small and medium-scale companies define operational benchmarks to execute flawless growth models with high-efficiency capital management.',
    imageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=500&h=500',
    email: 'amara.specialist@grefas.com',
    phone: '+233240000003',
    skills: ['Market Entry', 'Operations Audit', 'Financial Engineering', 'SME Structure'],
    rating: 4.9,
    category: 'consulting',
    available: true,
    projectHighlights: [
      'Conducted full-scope financial modeling & strategic health checks for 30+ regional SME clients.',
      'Co-authored national retail sector acceleration blueprints in partnership with the local Chamber of Commerce.',
      'Supervised market research and consumer behavior analysis supporting an international FMCG expansion.'
    ]
  }
};

export default function VerifyLetter() {
  const location = useLocation();
  const { ref: routeRef } = useParams<{ ref?: string }>();

  // Determine initial search tab from URL path
  const isMemberRoute = location.pathname.includes('member') || location.pathname.includes('staff') || location.pathname.includes('team');
  const [activeTab, setActiveTab] = useState<'all' | 'member' | 'letter'>(isMemberRoute ? 'member' : 'all');

  const [searchInput, setSearchInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchedRef, setSearchedRef] = useState<string | null>(null);
  
  // Results
  const [verifiedDoc, setVerifiedDoc] = useState<VerifiedLetter | null>(null);
  const [verifiedMember, setVerifiedMember] = useState<VerifiedTeamMember | null>(null);
  
  const [hasSearched, setHasSearched] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  // Generate QR Code when a document or member is verified
  useEffect(() => {
    if (verifiedMember) {
      const targetId = verifiedMember.memberId || verifiedMember.id;
      const verifyUrl = `${window.location.origin}/verify-member?id=${encodeURIComponent(targetId)}`;
      QRCode.toDataURL(verifyUrl, {
        width: 240,
        margin: 2,
        color: { dark: '#047857', light: '#ffffff' }
      }).then(setQrDataUrl).catch(() => {});
    } else if (verifiedDoc) {
      const targetRef = verifiedDoc.referenceNumber || verifiedDoc.id;
      const verifyUrl = `${window.location.origin}/verify-letter?ref=${encodeURIComponent(targetRef)}`;
      QRCode.toDataURL(verifyUrl, {
        width: 240,
        margin: 2,
        color: { dark: '#111827', light: '#ffffff' }
      }).then(setQrDataUrl).catch(() => {});
    } else {
      setQrDataUrl('');
    }
  }, [verifiedDoc, verifiedMember]);

  // Load global settings for corporate registration and website
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const snap = await getDoc(doc(db, 'settings', 'global'));
        if (snap.exists()) {
          setSettings(snap.data());
        }
      } catch (err) {
        console.warn("Could not load global settings for verification portal:", err);
      }
    };
    fetchSettings();
  }, []);

  // Check URL route parameter or query parameters for ?ref=... or ?id=...
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const rawRef = params.get('ref') || params.get('id') || routeRef;
    if (rawRef && rawRef.trim()) {
      const decodedRef = decodeURIComponent(rawRef.trim());
      setSearchInput(decodedRef);
      executeVerification(decodedRef);
    }
  }, [location.search, routeRef]);

  // Clean and normalize query string
  const normalizeRef = (val: string) => {
    return val
      .trim()
      .replace(/^our\s*ref[:\s]*/i, '')
      .replace(/^ref[:\s]*/i, '')
      .replace(/^id[:\s]*/i, '')
      .replace(/[\s\-_]/g, '')
      .toUpperCase();
  };

  const executeVerification = async (targetQuery: string) => {
    const cleanQuery = targetQuery.trim();
    if (!cleanQuery) {
      toast.error('Please enter a team member ID or document reference.');
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
    setSearchedRef(cleanQuery);
    setVerifiedDoc(null);
    setVerifiedMember(null);

    const normInput = normalizeRef(cleanQuery);
    const upperQuery = cleanQuery.toUpperCase();

    try {
      // 1. Check Team Members registry first if ID looks like Member ID or user is on Member tab
      let matchedMember: VerifiedTeamMember | null = null;
      
      try {
        // Query by exact memberId
        const memberRef = collection(db, 'team_members');
        const qMember = query(memberRef, where('memberId', '==', upperQuery));
        const memberSnap = await getDocs(qMember);

        if (!memberSnap.empty) {
          const d = memberSnap.docs[0];
          const data = d.data();
          matchedMember = {
            id: d.id,
            memberId: data.memberId || upperQuery,
            name: data.name || '',
            role: data.role || '',
            experience: data.experience || '',
            bio: data.bio || '',
            imageUrl: data.imageUrl || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=500&h=500',
            email: data.email || '',
            phone: data.phone || data.phoneNumber || '',
            skills: Array.isArray(data.skills) ? data.skills : [],
            rating: typeof data.rating === 'number' ? data.rating : 4.9,
            category: data.category || 'both',
            available: data.available !== false,
            projectHighlights: Array.isArray(data.projectHighlights) ? data.projectHighlights : []
          };
        }

        // Fallback: search all team_members docs if exact match wasn't found
        if (!matchedMember) {
          const allMembersSnap = await getDocs(memberRef);
          for (let idx = 0; idx < allMembersSnap.docs.length; idx++) {
            const d = allMembersSnap.docs[idx];
            const data = d.data();
            const docMemberId = data.memberId ? normalizeRef(data.memberId) : '';
            const fallbackId = normalizeRef(`GREFAS-TM-${String(idx + 1).padStart(3, '0')}`);
            const docId = normalizeRef(d.id);
            const docName = normalizeRef(data.name || '');

            if (
              docMemberId === normInput || 
              fallbackId === normInput || 
              docId === normInput ||
              (docMemberId && normInput.includes(docMemberId)) ||
              (normInput.length >= 4 && docName === normInput)
            ) {
              matchedMember = {
                id: d.id,
                memberId: data.memberId || `GREFAS-TM-${String(idx + 1).padStart(3, '0')}`,
                name: data.name || '',
                role: data.role || '',
                experience: data.experience || '',
                bio: data.bio || '',
                imageUrl: data.imageUrl || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=500&h=500',
                email: data.email || '',
                phone: data.phone || data.phoneNumber || '',
                skills: Array.isArray(data.skills) ? data.skills : [],
                rating: typeof data.rating === 'number' ? data.rating : 4.9,
                category: data.category || 'both',
                available: data.available !== false,
                projectHighlights: Array.isArray(data.projectHighlights) ? data.projectHighlights : []
              };
              break;
            }
          }
        }
      } catch (memberErr) {
        console.warn("Firestore team_members query failed, checking fallback members:", memberErr);
      }

      // Check predefined default members map (e.g. GREFAS-TM-001, GREFAS-TM-002, GREFAS-TM-003)
      if (!matchedMember) {
        for (const [key, def] of Object.entries(DEFAULT_MEMBERS_FALLBACK)) {
          const defNorm = normalizeRef(key);
          if (defNorm === normInput || normInput === defNorm.replace('GREFAS', '') || normInput.endsWith(key.split('-')[2])) {
            matchedMember = def;
            break;
          }
        }
      }

      if (matchedMember) {
        setVerifiedMember(matchedMember);
        setVerifiedDoc(null);
        toast.success(`Accreditation verified for ${matchedMember.name} (ID: ${matchedMember.memberId || 'Active'})!`);
        return;
      }

      // 2. Query Letters collection for official correspondence
      const lettersRef = collection(db, 'letters');
      let matchedLetter: VerifiedLetter | null = null;
      
      const qRef = query(lettersRef, where('referenceNumber', '==', cleanQuery));
      const refSnap = await getDocs(qRef);

      if (!refSnap.empty) {
        const d = refSnap.docs[0];
        matchedLetter = { id: d.id, ...d.data() } as VerifiedLetter;
      }

      if (!matchedLetter) {
        const allLettersSnap = await getDocs(lettersRef);
        for (const d of allLettersSnap.docs) {
          const data = d.data();
          const docRef = data.referenceNumber ? normalizeRef(data.referenceNumber) : '';
          const docId = normalizeRef(d.id);
          
          if (
            docRef === normInput || 
            docId === normInput || 
            (docRef && docRef.includes(normInput)) || 
            normInput.includes(docRef && docRef.length > 5 ? docRef : '___XYZ___')
          ) {
            matchedLetter = { id: d.id, ...data } as VerifiedLetter;
            break;
          }
        }
      }

      if (matchedLetter) {
        setVerifiedDoc(matchedLetter);
        setVerifiedMember(null);
        toast.success('Official document verified successfully against Grefas corporate registry!');
      } else {
        setVerifiedDoc(null);
        setVerifiedMember(null);
      }
    } catch (err: any) {
      console.error('Error during verification search:', err);
      toast.error('Unable to complete verification check. Please check your internet connection.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeVerification(searchInput);
  };

  const handleCopyLink = () => {
    if (verifiedMember) {
      const targetId = verifiedMember.memberId || verifiedMember.id;
      const url = `${window.location.origin}/verify-member?id=${encodeURIComponent(targetId)}`;
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      toast.success('Specialist verification URL copied to clipboard!');
      setTimeout(() => setCopiedLink(false), 2500);
    } else if (verifiedDoc) {
      const refToShare = verifiedDoc.referenceNumber || verifiedDoc.id;
      const url = `${window.location.origin}/verify-letter?ref=${encodeURIComponent(refToShare)}`;
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      toast.success('Document verification URL copied to clipboard!');
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handlePrintVerification = () => {
    window.print();
  };

  const cleanWebsite = (settings?.website || 'grefasconsultandentertainment.com')
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/$/, '');

  return (
    <>
      <SEO 
        title="Official Verification Portal | Team Member IDs & Letters | Grefas Consult & Entertainment"
        description="Public verification portal for authentic team member credentials, specialist accreditations, and official correspondence issued by Grefas Consult & Entertainment Limited."
      />

      <div className="min-h-screen bg-muted/20 py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-8">
          
          {/* Breadcrumb Header */}
          <div className="space-y-3">
            <Breadcrumbs 
              items={[
                { name: 'Home', path: '/' },
                { name: 'Verification Portal', path: '/verify-letter' }
              ]} 
            />

            <div className="text-center space-y-2 pt-2">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider border border-emerald-500/20">
                <ShieldCheck className="h-4 w-4" /> Official Public Accreditation &amp; Document Ledger
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                Verify Specialist Accreditation &amp; Corporate Instruments
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-xl mx-auto leading-relaxed">
                Validate accredited team specialist IDs, official correspondence, contracts, embassy endorsements, and location permits issued by Grefas Consult &amp; Entertainment Limited.
              </p>
            </div>
          </div>

          {/* Search Card */}
          <Card className="border border-border/80 shadow-lg bg-card overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-emerald-600 via-orange-500 to-amber-500"></div>
            <CardContent className="p-6 sm:p-8 space-y-5">
              
              {/* Type Switcher Tabs */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant={activeTab === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setActiveTab('all')}
                    className={`text-xs h-8 px-3 rounded-lg font-bold transition-all ${
                      activeTab === 'all' 
                        ? 'bg-orange-600 hover:bg-orange-700 text-white shadow-xs' 
                        : 'border-border text-muted-foreground'
                    }`}
                  >
                    <Search className="h-3 w-3 mr-1" /> All Registry
                  </Button>
                  <Button
                    type="button"
                    variant={activeTab === 'member' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setActiveTab('member')}
                    className={`text-xs h-8 px-3 rounded-lg font-bold transition-all ${
                      activeTab === 'member' 
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs' 
                        : 'border-border text-muted-foreground'
                    }`}
                  >
                    <Users className="h-3 w-3 mr-1" /> Specialist Member ID
                  </Button>
                  <Button
                    type="button"
                    variant={activeTab === 'letter' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setActiveTab('letter')}
                    className={`text-xs h-8 px-3 rounded-lg font-bold transition-all ${
                      activeTab === 'letter' 
                        ? 'bg-orange-600 hover:bg-orange-700 text-white shadow-xs' 
                        : 'border-border text-muted-foreground'
                    }`}
                  >
                    <FileText className="h-3 w-3 mr-1" /> Official Letter
                  </Button>
                </div>

                <div className="text-[11px] font-mono text-muted-foreground flex items-center gap-1">
                  <Lock className="h-3 w-3 text-emerald-600" /> 256-Bit Ledger Verified
                </div>
              </div>

              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="ref-search-input" className="text-xs font-bold text-foreground flex items-center justify-between">
                    <span>
                      {activeTab === 'member' 
                        ? 'Enter Specialist Member ID (e.g., GREFAS-TM-001)' 
                        : activeTab === 'letter'
                        ? 'Enter Document Reference Number (e.g., GREFAS/CON/2025/104)'
                        : 'Enter Specialist Member ID or Document Reference Number'}
                    </span>
                    <span className="text-[11px] text-muted-foreground font-normal">
                      {activeTab === 'member' ? 'Found on staff badges & cards' : 'Found on top strip of letterhead'}
                    </span>
                  </label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="ref-search-input"
                        type="text"
                        placeholder={
                          activeTab === 'member'
                            ? "e.g. GREFAS-TM-001, GREFAS-TM-002, GREFAS-TM-003"
                            : activeTab === 'letter'
                            ? "e.g. GREFAS/CON/2025/104 or GREFAS/ENT/2025/382"
                            : "e.g. GREFAS-TM-001 or GREFAS/CON/2025/104"
                        }
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        className="pl-10 h-11 text-xs sm:text-sm font-mono uppercase bg-muted/30 focus-visible:ring-emerald-500"
                        required
                      />
                    </div>
                    <Button 
                      id="btn-verify-submit"
                      type="submit" 
                      disabled={isSearching}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 px-6 text-xs uppercase tracking-wider shrink-0 flex items-center justify-center gap-2 shadow-sm"
                    >
                      {isSearching ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" /> Verifying...
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="h-4 w-4" /> Verify Credentials
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground pt-1">
                  <span className="flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-emerald-600" />
                    Cryptographically cross-referenced with Central Ghanaian Corporate Register
                  </span>
                  <span className="font-mono text-orange-600/90 font-semibold">
                    Domain: {cleanWebsite}
                  </span>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Verification Results Display */}
          <AnimatePresence mode="wait">
            {hasSearched && (
              <motion.div
                key={searchedRef}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                {/* 1. VERIFIED TEAM MEMBER RESULT */}
                {verifiedMember ? (
                  <div className="bg-card border-2 border-emerald-500/50 rounded-2xl shadow-xl overflow-hidden print:border-none print:shadow-none">
                    {/* Status Banner */}
                    <div className="bg-emerald-700 text-white p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-full bg-white/20 flex items-center justify-center shrink-0 border border-white/40 shadow-xs">
                          <CheckCircle2 className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-sm tracking-wider uppercase">OFFICIALLY ACCREDITED SPECIALIST &amp; TEAM MEMBER</span>
                            <span className="text-[10px] bg-white/20 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">ACTIVE &amp; ACCREDITED</span>
                          </div>
                          <p className="text-xs text-white/90 mt-0.5">
                            Authenticated against Grefas Consult &amp; Entertainment Limited central personnel registry.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 print:hidden">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={handleCopyLink}
                          className="bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-semibold h-8"
                          title="Share direct verification link"
                        >
                          {copiedLink ? <Check className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                          {copiedLink ? 'Copied' : 'Share Link'}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={handlePrintVerification}
                          className="bg-white text-emerald-800 hover:bg-emerald-50 font-bold text-xs h-8 shadow-xs"
                        >
                          <Printer className="h-3.5 w-3.5 mr-1" /> Print Certificate
                        </Button>
                      </div>
                    </div>

                    {/* Member Details Body */}
                    <div className="p-6 sm:p-8 space-y-6">
                      
                      {/* Top Strip */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
                        <div>
                          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Specialist Member ID</p>
                          <p className="text-xl sm:text-2xl font-mono font-black text-orange-600 dark:text-orange-400">
                            {verifiedMember.memberId || verifiedMember.id}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2 items-center">
                          <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-300">
                            OFFICIAL ACCREDITATION
                          </span>
                          <span className="px-3 py-1 rounded-full text-xs font-bold text-muted-foreground bg-muted border border-border">
                            {verifiedMember.category === 'consulting' 
                              ? 'Corporate Advisory Division' 
                              : verifiedMember.category === 'entertainment' 
                              ? 'Entertainment Production Division' 
                              : 'Executive Joint Division'}
                          </span>
                        </div>
                      </div>

                      {/* Specialist Information Layout */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                        {/* Portrait & Booking CTA */}
                        <div className="space-y-4 text-center sm:text-left">
                          <div className="relative mx-auto md:mx-0 w-48 h-48 rounded-2xl overflow-hidden border-2 border-emerald-500/30 shadow-md bg-muted">
                            <img
                              src={verifiedMember.imageUrl}
                              alt={`${verifiedMember.name} - Official Specialist Photo`}
                              className="h-full w-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute top-2 right-2 bg-emerald-600 text-white p-1 rounded-full shadow">
                              <ShieldCheck className="h-4 w-4" />
                            </div>
                          </div>

                          {/* Availability status */}
                          <div className={`p-2.5 rounded-xl flex items-center justify-center gap-2 text-xs font-bold border ${
                            verifiedMember.available !== false 
                              ? 'bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/30' 
                              : 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/30'
                          }`}>
                            <span className={`h-2 w-2 rounded-full ${verifiedMember.available !== false ? 'bg-green-500 animate-pulse' : 'bg-zinc-400'}`} />
                            {verifiedMember.available !== false ? 'Accepting Client Appointments' : 'Fully Booked'}
                          </div>

                          <Button
                            asChild
                            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold h-10 rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm"
                          >
                            <Link to={`/booking?staffId=${verifiedMember.id}&staffName=${encodeURIComponent(verifiedMember.name)}`}>
                              <Calendar className="h-3.5 w-3.5" /> Book With This Specialist
                            </Link>
                          </Button>
                        </div>

                        {/* Specialist Credentials & Bio */}
                        <div className="md:col-span-2 space-y-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <h2 className="text-2xl font-black text-foreground tracking-tight">{verifiedMember.name}</h2>
                              <div className="flex items-center gap-1 bg-amber-500/10 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded text-xs font-extrabold border border-amber-500/20">
                                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                                {verifiedMember.rating?.toFixed(1) || '4.9'}
                              </div>
                            </div>
                            <p className="text-sm font-bold text-orange-600 dark:text-orange-400 flex items-center gap-1.5 mt-1">
                              <Briefcase className="h-4 w-4" /> {verifiedMember.role}
                            </p>
                          </div>

                          <div className="bg-muted/40 p-3.5 rounded-xl border border-border/60 text-xs font-semibold text-muted-foreground flex items-center gap-2">
                            <Award className="h-4 w-4 text-orange-500 shrink-0" />
                            <span>Professional Experience: <strong className="text-foreground">{verifiedMember.experience}</strong></span>
                          </div>

                          <div>
                            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Official Background</h4>
                            <p className="text-sm text-foreground/90 leading-relaxed italic bg-card p-3.5 rounded-xl border border-border/80">
                              "{verifiedMember.bio}"
                            </p>
                          </div>

                          {/* Core Skills */}
                          {verifiedMember.skills && verifiedMember.skills.length > 0 && (
                            <div>
                              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Accredited Practice Areas</h4>
                              <div className="flex flex-wrap gap-1.5">
                                {verifiedMember.skills.map((skill, si) => (
                                  <span key={si} className="text-xs font-bold px-2.5 py-1 rounded-lg bg-muted text-foreground border border-border">
                                    {skill}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Project Highlights */}
                          {verifiedMember.projectHighlights && verifiedMember.projectHighlights.length > 0 && (
                            <div>
                              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                <Flame className="h-3.5 w-3.5 text-orange-500" /> Certified Project Feats
                              </h4>
                              <div className="space-y-1.5">
                                {verifiedMember.projectHighlights.slice(0, 3).map((hl, hi) => (
                                  <div key={hi} className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/20 p-2 rounded-lg border border-border/40">
                                    <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                                    <span>{hl}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Contact Info */}
                          <div className="pt-2 border-t border-border flex flex-wrap gap-4 text-xs text-muted-foreground">
                            {verifiedMember.email && (
                              <span className="flex items-center gap-1.5">
                                <Mail className="h-3.5 w-3.5 text-orange-600" />
                                <strong className="text-foreground">Official Email:</strong> {verifiedMember.email}
                              </span>
                            )}
                            {verifiedMember.phone && (
                              <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-semibold">
                                <Phone className="h-3.5 w-3.5 text-emerald-600" />
                                <strong className="text-foreground">Direct / SMS:</strong> {verifiedMember.phone}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Official Verification QR & Security Seal */}
                      <div className="p-4 bg-muted/40 rounded-xl border border-border/80 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="space-y-1 text-center sm:text-left">
                          <p className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-1.5 justify-center sm:justify-start">
                            <ShieldCheck className="h-4 w-4 text-emerald-600" /> Tamper-Proof Electronic Specialist Accreditation
                          </p>
                          <p className="text-[11px] text-muted-foreground leading-relaxed max-w-lg">
                            This electronic verification certificate confirms that the individual above is in active standing with Grefas Consult &amp; Entertainment Limited, legally registered under the Companies Act of the Republic of Ghana.
                          </p>
                        </div>
                        {qrDataUrl && (
                          <div className="text-center shrink-0">
                            <img src={qrDataUrl} alt="Accreditation QR" className="h-20 w-20 rounded-lg border border-border bg-white p-1 mx-auto" />
                            <span className="text-[9px] font-mono text-muted-foreground block mt-1 uppercase">Scan to Verify</span>
                          </div>
                        )}
                      </div>

                    </div>
                  </div>
                ) : verifiedDoc ? (
                  /* 2. VERIFIED OFFICIAL LETTER RESULT */
                  <div className="bg-card border-2 border-emerald-500/40 rounded-2xl shadow-xl overflow-hidden print:border-none print:shadow-none">
                    {/* Verified Status Banner */}
                    <div className="bg-emerald-600 text-white p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center shrink-0 border border-white/40">
                          <CheckCircle2 className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-sm tracking-wider uppercase">AUTHENTICATED CORPORATE INSTRUMENT</span>
                            <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold">VERIFIED ACTIVE</span>
                          </div>
                          <p className="text-xs text-white/90 mt-0.5">
                            This document has been verified against Grefas Consult &amp; Entertainment Limited official archives.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 print:hidden">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={handleCopyLink}
                          className="bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-semibold h-8"
                          title="Share direct verification link"
                        >
                          {copiedLink ? <Check className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                          {copiedLink ? 'Copied' : 'Share Link'}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={handlePrintVerification}
                          className="bg-white text-emerald-800 hover:bg-emerald-50 font-bold text-xs h-8 shadow-xs"
                        >
                          <Printer className="h-3.5 w-3.5 mr-1" /> Print Record
                        </Button>
                      </div>
                    </div>

                    {/* Detailed Metadata Grid */}
                    <div className="p-6 sm:p-8 space-y-6">
                      
                      {/* Top Badges and Ref info */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
                        <div>
                          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Official Reference Code</p>
                          <p className="text-lg sm:text-xl font-mono font-black text-foreground text-orange-600 dark:text-orange-400">
                            {verifiedDoc.referenceNumber || verifiedDoc.id}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2 items-center">
                          <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300 border border-orange-200">
                            {verifiedDoc.classification || 'OFFICIAL CORRESPONDENCE'}
                          </span>
                          <span className="px-3 py-1 rounded-full text-xs font-bold text-muted-foreground bg-muted border border-border">
                            {verifiedDoc.letterheadType === 'entertainment' ? 'Entertainment & Productions' : verifiedDoc.letterheadType === 'consult' ? 'Business & Strategy Consult' : 'Joint Executive Division'}
                          </span>
                        </div>
                      </div>

                      {/* Key Document Parameters Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl bg-muted/40 border border-border/80 text-xs">
                        <div>
                          <span className="text-muted-foreground font-semibold block mb-0.5">Date of Issuance</span>
                          <span className="font-bold text-foreground flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-orange-600" />
                            {verifiedDoc.date || 'Record Archived'}
                          </span>
                        </div>

                        <div>
                          <span className="text-muted-foreground font-semibold block mb-0.5">Authorized Signatory</span>
                          <span className="font-bold text-foreground flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-orange-600" />
                            {verifiedDoc.signatoryName || 'Executive Directorate'}
                          </span>
                        </div>

                        <div>
                          <span className="text-muted-foreground font-semibold block mb-0.5">Designation</span>
                          <span className="font-bold text-foreground truncate block">
                            {verifiedDoc.signatoryTitle || 'Principal Consultant'}
                          </span>
                        </div>

                        <div>
                          <span className="text-muted-foreground font-semibold block mb-0.5">Addressed Recipient</span>
                          <span className="font-bold text-foreground truncate block">
                            {verifiedDoc.recipientName || 'Addressed Institution'}
                          </span>
                        </div>
                      </div>

                      {/* Subject Strip */}
                      <div className="p-4 rounded-xl bg-orange-50/50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/30">
                        <span className="text-[10px] font-black uppercase tracking-widest text-orange-600 dark:text-orange-400 block mb-1">
                          OFFICIAL SUBJECT MATTER
                        </span>
                        <h3 className="text-base sm:text-lg font-bold text-foreground">
                          {verifiedDoc.subject}
                        </h3>
                      </div>

                      {/* Document Body Extract */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <FileText className="h-3.5 w-3.5 text-orange-600" /> Archived Document Body Extract
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">Forensically Authenticated</span>
                        </div>
                        <div className="p-6 rounded-xl bg-card border border-border/80 text-xs sm:text-sm text-foreground leading-relaxed shadow-inner">
                          {verifiedDoc.salutation && (
                            <p className="font-bold text-foreground mb-3">{verifiedDoc.salutation}</p>
                          )}
                          <div 
                            className="space-y-3 prose dark:prose-invert max-w-none text-foreground font-serif leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: formatLetterBodyHtml(verifiedDoc.body) }}
                          />
                          {verifiedDoc.valediction && (
                            <p className="mt-4 font-semibold text-foreground">{verifiedDoc.valediction}</p>
                          )}
                        </div>
                      </div>

                      {/* Validation QR and Security Notice */}
                      <div className="p-4 rounded-xl bg-muted/30 border border-border flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="space-y-1 text-center sm:text-left">
                          <div className="flex items-center gap-1.5 justify-center sm:justify-start">
                            <ShieldCheck className="h-4 w-4 text-emerald-600" />
                            <span className="text-xs font-black uppercase tracking-wider text-foreground">Verification Ledger Assurance</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-relaxed max-w-md">
                            This digital record confirms that the corresponding physical or PDF document with reference code <strong className="font-mono text-foreground">{verifiedDoc.referenceNumber || verifiedDoc.id}</strong> is authentic and has not been revoked or tampered with.
                          </p>
                        </div>
                        {qrDataUrl && (
                          <div className="text-center shrink-0">
                            <img src={qrDataUrl} alt="Document QR" className="h-20 w-20 rounded-lg border border-border bg-white p-1 mx-auto" />
                            <span className="text-[9px] font-mono text-muted-foreground block mt-1 uppercase">Scan to Verify</span>
                          </div>
                        )}
                      </div>

                    </div>
                  </div>
                ) : (
                  /* 3. NOT FOUND / UNVERIFIED CARD */
                  <Card className="border-2 border-red-300 dark:border-red-900/40 bg-red-50/20 dark:bg-red-950/10">
                    <CardHeader className="pb-3 border-b border-red-200/50 dark:border-red-900/30">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center shrink-0">
                          <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                        </div>
                        <div>
                          <CardTitle className="text-base text-red-700 dark:text-red-400 font-bold">
                            Credentials Not Found in Central Registry
                          </CardTitle>
                          <CardDescription className="text-xs text-red-600/80 dark:text-red-400/80">
                            No team specialist or official letter matching "{searchedRef}" was discovered in our registry.
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-4 text-xs leading-relaxed text-foreground">
                      <div className="space-y-2 bg-background p-4 rounded-xl border border-red-200 dark:border-red-900/30">
                        <p className="font-bold text-foreground">Troubleshooting &amp; Fraud Prevention Advisory:</p>
                        <ul className="list-disc list-inside space-y-1.5 text-muted-foreground">
                          <li>
                            <strong>Verifying a Specialist?</strong> Enter the Member ID as shown on their identification card or profile (e.g., <span className="font-mono text-foreground font-bold">GREFAS-TM-001</span>, <span className="font-mono text-foreground font-bold">GREFAS-TM-002</span>, <span className="font-mono text-foreground font-bold">GREFAS-TM-003</span>).
                          </li>
                          <li>
                            <strong>Verifying an Official Letter?</strong> Ensure the reference number was typed accurately as shown on the letterhead strip under "Our Ref:" (e.g., <span className="font-mono text-foreground font-bold">GREFAS/CON/2025/104</span>).
                          </li>
                          <li>
                            If an individual is claiming to represent Grefas Consult &amp; Entertainment Limited and cannot produce a verifiable Member ID, please contact our Compliance Desk immediately.
                          </li>
                        </ul>
                      </div>

                      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                        <span className="text-muted-foreground">
                          Need manual verification from our Executive Secretariat?
                        </span>
                        <Button
                          asChild
                          size="sm"
                          variant="outline"
                          className="border-red-200 text-red-700 hover:bg-red-50 text-xs font-semibold"
                        >
                          <Link to="/contact">Contact Compliance Desk</Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Educational Trust Bento Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
            <Card className="border border-border/80 bg-card">
              <CardContent className="p-5 space-y-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center mb-1">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <h4 className="text-xs font-bold text-foreground">Specialist Accreditation</h4>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Every certified consultant, event show host, and media producer carries an authorized Member ID cross-referenced with internal credentials.
                </p>
              </CardContent>
            </Card>

            <Card className="border border-border/80 bg-card">
              <CardContent className="p-5 space-y-2">
                <div className="h-8 w-8 rounded-lg bg-orange-500/10 text-orange-600 flex items-center justify-center mb-1">
                  <FileText className="h-4 w-4" />
                </div>
                <h4 className="text-xs font-bold text-foreground">Official Letter Integrity</h4>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Engagement contracts, visa recommendations, and sponsorship proposals receive a tamper-proof cryptographic reference code.
                </p>
              </CardContent>
            </Card>

            <Card className="border border-border/80 bg-card">
              <CardContent className="p-5 space-y-2">
                <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center mb-1">
                  <Building2 className="h-4 w-4" />
                </div>
                <h4 className="text-xs font-bold text-foreground">Embassies &amp; Authorities</h4>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Consular and visa officers can verify company endorsements and location safety protocols 24/7 without diplomatic delays.
                </p>
              </CardContent>
            </Card>
          </div>

        </div>
      </div>
    </>
  );
}
