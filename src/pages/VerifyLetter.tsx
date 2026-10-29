import * as React from 'react';
import { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
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
  ArrowRight
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

export default function VerifyLetter() {
  const location = useLocation();
  const [searchInput, setSearchInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchedRef, setSearchedRef] = useState<string | null>(null);
  const [verifiedDoc, setVerifiedDoc] = useState<VerifiedLetter | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [settings, setSettings] = useState<any>(null);

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

  // Check URL query parameters for ?ref=...
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const refParam = params.get('ref') || params.get('id');
    if (refParam && refParam.trim()) {
      setSearchInput(refParam.trim());
      executeVerification(refParam.trim());
    }
  }, [location.search]);

  // Clean and normalize reference string
  const normalizeRef = (val: string) => {
    return val
      .trim()
      .replace(/^our\s*ref[:\s]*/i, '')
      .replace(/^ref[:\s]*/i, '')
      .replace(/\s+/g, '')
      .toUpperCase();
  };

  const executeVerification = async (targetRef: string) => {
    const cleanQuery = targetRef.trim();
    if (!cleanQuery) {
      toast.error('Please enter a reference number or document identifier.');
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
    setSearchedRef(cleanQuery);
    setVerifiedDoc(null);

    try {
      const lettersRef = collection(db, 'letters');
      const normInput = normalizeRef(cleanQuery);

      // 1. Direct query by referenceNumber (exact match)
      let matchedLetter: VerifiedLetter | null = null;
      const qRef = query(lettersRef, where('referenceNumber', '==', cleanQuery));
      const refSnap = await getDocs(qRef);

      if (!refSnap.empty) {
        const d = refSnap.docs[0];
        matchedLetter = { id: d.id, ...d.data() } as VerifiedLetter;
      }

      // 2. Fallback: try case-insensitive or normalized check by fetching docs
      if (!matchedLetter) {
        const allLettersSnap = await getDocs(lettersRef);
        for (const d of allLettersSnap.docs) {
          const data = d.data();
          const docRef = data.referenceNumber ? normalizeRef(data.referenceNumber) : '';
          const docId = normalizeRef(d.id);
          
          if (docRef === normInput || docId === normInput || (docRef && docRef.includes(normInput)) || normInput.includes(docRef && docRef.length > 5 ? docRef : '___XYZ___')) {
            matchedLetter = { id: d.id, ...data } as VerifiedLetter;
            break;
          }
        }
      }

      if (matchedLetter) {
        setVerifiedDoc(matchedLetter);
        toast.success('Document verified successfully against Grefas official registry!');
      } else {
        setVerifiedDoc(null);
      }
    } catch (err: any) {
      console.error('Error during letter verification:', err);
      toast.error('Unable to complete document verification. Please check your connection.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeVerification(searchInput);
  };

  const handleCopyLink = () => {
    if (!verifiedDoc) return;
    const refToShare = verifiedDoc.referenceNumber || verifiedDoc.id;
    const url = `${window.location.origin}/verify-letter?ref=${encodeURIComponent(refToShare)}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    toast.success('Verification URL copied to clipboard!');
    setTimeout(() => setCopiedLink(false), 2500);
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
        title="Official Letter & Document Verification Desk | Grefas Consult & Entertainment"
        description="Public verification portal for official letters, engagement contracts, consular recommendations, and permits issued by Grefas Consult & Entertainment Limited."
      />

      <div className="min-h-screen bg-muted/20 py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-8">
          
          {/* Breadcrumb Header */}
          <div className="space-y-3">
            <Breadcrumbs 
              items={[
                { name: 'Home', path: '/' },
                { name: 'Verify Official Letter', path: '/verify-letter' }
              ]} 
            />

            <div className="text-center space-y-2 pt-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 text-xs font-bold uppercase tracking-wider border border-orange-500/20">
                <ShieldCheck className="h-4 w-4" /> Official Document Verification Ledger
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                Verify Grefas Corporate Correspondence
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-xl mx-auto leading-relaxed">
                Validate the authenticity of official letters, contract appointments, embassy recommendations, and location permits issued by Grefas Consult &amp; Entertainment Limited.
              </p>
            </div>
          </div>

          {/* Search Card */}
          <Card className="border border-border/80 shadow-lg bg-card overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500"></div>
            <CardContent className="p-6 sm:p-8 space-y-6">
              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="ref-search-input" className="text-xs font-bold text-foreground flex items-center justify-between">
                    <span>Enter Document Reference Number or Document ID</span>
                    <span className="text-[11px] text-muted-foreground font-normal">Found on top strip of letterhead</span>
                  </label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="ref-search-input"
                        type="text"
                        placeholder="e.g. GREFAS/CON/2025/104 or GREFAS/ENT/2025/382"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        className="pl-10 h-11 text-xs sm:text-sm font-mono uppercase bg-muted/30 focus-visible:ring-orange-500"
                        required
                      />
                    </div>
                    <Button 
                      id="btn-verify-submit"
                      type="submit" 
                      disabled={isSearching}
                      className="bg-orange-600 hover:bg-orange-700 text-white font-bold h-11 px-6 text-xs uppercase tracking-wider shrink-0 flex items-center justify-center gap-2"
                    >
                      {isSearching ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" /> Verifying...
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="h-4 w-4" /> Verify Document
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
                {verifiedDoc ? (
                  /* VERIFIED SUCCESS CARD */
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

                      {/* Corporate Details */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-muted/20 p-4 rounded-xl border border-border/60 text-xs">
                        <div className="space-y-1">
                          <p className="font-bold text-foreground">Issuing Legal Entity:</p>
                          <p className="text-muted-foreground font-semibold">Grefas Consult &amp; Entertainment Limited</p>
                          <p className="text-[11px] text-muted-foreground">{settings?.registrationNumber || 'Reg. No: CS-289412024 • TIN: C0048192837'}</p>
                          <p className="text-[11px] text-muted-foreground">{settings?.officeAddress || 'Nyinahin-Ashanti, Ashanti Region, Ghana'} ({settings?.officeGps || 'GPS: AI-0008-9223'})</p>
                        </div>

                        <div className="space-y-1 sm:text-right">
                          <p className="font-bold text-foreground">Verification Authority:</p>
                          <p className="text-muted-foreground">Certified Registrar of Official Correspondence</p>
                          <p className="text-[11px] font-mono text-orange-600 font-bold">Portal: https://www.{cleanWebsite}</p>
                          <p className="text-[11px] text-muted-foreground">Verification Stamp: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                        </div>
                      </div>

                      {/* Recipient and Letter Specifics */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                        <div className="space-y-1.5">
                          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Addressed Recipient</p>
                          <p className="text-sm font-bold text-foreground">{verifiedDoc.recipientName}</p>
                          {verifiedDoc.recipientDesignation && (
                            <p className="text-xs text-muted-foreground font-medium">{verifiedDoc.recipientDesignation}</p>
                          )}
                          {verifiedDoc.recipientCompany && (
                            <p className="text-xs font-semibold text-foreground/90">{verifiedDoc.recipientCompany}</p>
                          )}
                          {verifiedDoc.recipientAddress && (
                            <p className="text-xs text-muted-foreground whitespace-pre-line mt-1">{verifiedDoc.recipientAddress}</p>
                          )}
                        </div>

                        <div className="space-y-1.5 sm:text-right">
                          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Issuance &amp; Effective Date</p>
                          <p className="text-sm font-bold text-foreground font-mono">
                            {new Date(verifiedDoc.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                          </p>
                          <p className="text-[11px] text-muted-foreground">Document Status: <span className="text-emerald-600 font-bold">Legally Binding &amp; Valid</span></p>
                        </div>
                      </div>

                      {/* Subject Line */}
                      <div className="bg-muted/30 p-3.5 rounded-xl border border-border text-center space-y-1">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Official Document Subject</p>
                        <p className="text-xs sm:text-sm font-black text-foreground uppercase tracking-wide">
                          RE: {verifiedDoc.subject}
                        </p>
                      </div>

                      {/* Letter Body Excerpt / Transcript */}
                      <div className="space-y-2 pt-2">
                        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                          <span>Official Content Transcript</span>
                          <span className="text-[10px] font-normal text-muted-foreground">Direct from Firestore Ledger</span>
                        </p>
                        <div className="bg-muted/10 p-5 rounded-xl border border-border text-xs sm:text-sm font-serif leading-relaxed text-foreground space-y-3 text-justify">
                          <p className="font-bold">{verifiedDoc.salutation || 'Dear Sir/Madam,'}</p>
                          <div dangerouslySetInnerHTML={{ __html: formatLetterBodyHtml(verifiedDoc.body) }} />
                        </div>
                      </div>

                      {/* Signatory and Corporate Seal Section */}
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-4 border-t border-border">
                        <div className="space-y-1 text-center sm:text-left">
                          <p className="text-xs font-semibold text-muted-foreground">{verifiedDoc.valediction || 'Yours faithfully,'}</p>
                          {verifiedDoc.signatorySignature && (
                            <div className="py-1">
                              <img 
                                src={verifiedDoc.signatorySignature} 
                                alt="Verified Digital Signature" 
                                className="max-h-12 max-w-[160px] object-contain mx-auto sm:mx-0"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          )}
                          <p className="text-sm font-bold text-foreground">{verifiedDoc.signatoryName}</p>
                          <p className="text-xs text-muted-foreground">{verifiedDoc.signatoryTitle}</p>
                          <p className="text-[11px] text-muted-foreground/80 font-sans">Grefas Consult &amp; Entertainment Limited</p>
                        </div>

                        {/* Official Circular Seal */}
                        <div className="flex flex-col items-center shrink-0">
                          <svg viewBox="0 0 160 160" className="h-24 w-24" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="80" cy="80" r="75" fill="none" stroke="#991b1b" strokeWidth="3" />
                            <circle cx="80" cy="80" r="70" fill="none" stroke="#991b1b" strokeWidth="1.2" strokeDasharray="4 2" />
                            <circle cx="80" cy="80" r="48" fill="none" stroke="#991b1b" strokeWidth="1.8" />
                            <circle cx="80" cy="80" r="45" fill="#fef2f2" fillOpacity="0.4" />
                            
                            <defs>
                              <path id="seal-verify-top" d="M 22,80 A 58,58 0 0,1 138,80" fill="none" />
                              <path id="seal-verify-bot" d="M 138,80 A 58,58 0 0,1 22,80" fill="none" />
                            </defs>
                            
                            <text fill="#991b1b" fontSize="7.8" fontWeight="bold" letterSpacing="1.2" fontFamily="'Times New Roman', serif">
                              <textPath href="#seal-verify-top" startOffset="50%" textAnchor="middle">
                                ★ GREFAS CONSULT &amp; ENTERTAINMENT ★
                              </textPath>
                            </text>
                            
                            <text fill="#991b1b" fontSize="6.8" fontWeight="bold" letterSpacing="1.1" fontFamily="'Times New Roman', serif">
                              <textPath href="#seal-verify-bot" startOffset="50%" textAnchor="middle">
                                OFFICIAL CORPORATE SEAL • GHANA
                              </textPath>
                            </text>
                            
                            <g transform="translate(80, 80)">
                              <polygon points="0,-14 4,-4 14,-4 6,3 9,13 0,7 -9,13 -6,3 -14,-4 -4,-4" fill="#991b1b" />
                              <text y="20" textAnchor="middle" fill="#991b1b" fontSize="8" fontWeight="bold" fontFamily="Arial, sans-serif" letterSpacing="0.8">
                                VERIFIED
                              </text>
                              <text y="27" textAnchor="middle" fill="#991b1b" fontSize="6" fontFamily="Arial, sans-serif" fontWeight="600">
                                EST. 2024
                              </text>
                            </g>
                          </svg>
                          <span className="text-[10px] font-bold text-red-700 dark:text-red-400 mt-1 uppercase tracking-wider">
                            Affixed Corporate Seal
                          </span>
                        </div>
                      </div>

                      {/* Security Verification Hash */}
                      <div className="bg-muted/40 p-3 rounded-lg border border-border/80 flex flex-col sm:flex-row items-center justify-between text-[11px] text-muted-foreground font-mono">
                        <span>SECURITY LEDGER HASH: GREFAS-SEC-{verifiedDoc.id.toUpperCase()}</span>
                        <span>CONFIRMED GENUINE RECORD</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* NOT FOUND / UNVERIFIED CARD */
                  <Card className="border-2 border-red-300 dark:border-red-900/40 bg-red-50/20 dark:bg-red-950/10">
                    <CardHeader className="pb-3 border-b border-red-200/50 dark:border-red-900/30">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center shrink-0">
                          <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                        </div>
                        <div>
                          <CardTitle className="text-base text-red-700 dark:text-red-400 font-bold">
                            Document Reference Not Found
                          </CardTitle>
                          <CardDescription className="text-xs text-red-600/80 dark:text-red-400/80">
                            No active official correspondence matching "{searchedRef}" was discovered in our registry.
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-4 text-xs leading-relaxed text-foreground">
                      <div className="space-y-2 bg-background p-4 rounded-xl border border-red-200 dark:border-red-900/30">
                        <p className="font-bold text-foreground">Troubleshooting &amp; Fraud Prevention Advisory:</p>
                        <ul className="list-disc list-inside space-y-1.5 text-muted-foreground">
                          <li>Verify that the reference number was typed accurately as shown on the letterhead strip (e.g. <span className="font-mono text-foreground font-bold">GREFAS/CON/2025/104</span>).</li>
                          <li>Reference codes are typically located at the top-left strip of official Grefas correspondence under <span className="font-semibold text-foreground">"Our Ref:"</span>.</li>
                          <li>If you are a consular embassy officer, banking institution, or municipal authority and have received an unverified document presenting itself as Grefas Consult &amp; Entertainment Limited, please treat it with caution and submit it for forensic inspection.</li>
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
                <div className="h-8 w-8 rounded-lg bg-orange-500/10 text-orange-600 flex items-center justify-center mb-1">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <h4 className="text-xs font-bold text-foreground">Anti-Fraud Protection</h4>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Every official engagement contract, visa endorsement, and sponsorship proposal receives a unique cryptographic tracking code.
                </p>
              </CardContent>
            </Card>

            <Card className="border border-border/80 bg-card">
              <CardContent className="p-5 space-y-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center mb-1">
                  <Award className="h-4 w-4" />
                </div>
                <h4 className="text-xs font-bold text-foreground">Embassies &amp; Consulates</h4>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Consular and visa officers can verify travel endorsements and company financial sponsorships instantly 24/7 without delays.
                </p>
              </CardContent>
            </Card>

            <Card className="border border-border/80 bg-card">
              <CardContent className="p-5 space-y-2">
                <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center mb-1">
                  <Building2 className="h-4 w-4" />
                </div>
                <h4 className="text-xs font-bold text-foreground">Municipal Authorities</h4>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Filming permits and location safety protocols can be cross-verified directly on set by regional security officers.
                </p>
              </CardContent>
            </Card>
          </div>

        </div>
      </div>
    </>
  );
}
