import * as React from 'react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  FileText, 
  Plus, 
  Trash2, 
  Printer, 
  Sparkles, 
  Loader2, 
  Search, 
  Building2, 
  User, 
  School, 
  Eye, 
  Download, 
  Settings as SettingsIcon,
  Check,
  Building,
  RefreshCw,
  Pencil
} from 'lucide-react';
import { toast } from 'sonner';
import { db, handleFirestoreError, OperationType } from '@/firebase';
import { 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp,
  updateDoc
} from 'firebase/firestore';

interface Letter {
  id: string;
  recipientType: 'organisation' | 'individual' | 'institution';
  recipientName: string;
  recipientAddress: string;
  date: string;
  subject: string;
  salutation: string;
  body: string;
  signatoryName: string;
  signatoryTitle: string;
  letterheadType: 'entertainment' | 'consult' | 'joint';
  watermarkEnabled: boolean;
  watermarkOpacity: number;
  createdAt?: any;
}

interface Settings {
  logoUrl?: string;
  address?: string;
  phone?: string;
  email?: string;
  letterheadJointTitle?: string;
  letterheadJointSubtitle?: string;
  letterheadEntTitle?: string;
  letterheadEntSubtitle?: string;
  letterheadConsultTitle?: string;
  letterheadConsultSubtitle?: string;
}

interface CastCrewMember {
  id: string;
  fullName: string;
  roleType: string;
  emailAddress?: string;
  address?: string;
  contact?: string;
  status?: string;
}

export default function ManageLetters() {
  const [letters, setLetters] = useState<Letter[]>([]);
  const [settings, setSettings] = useState<Settings>({
    logoUrl: '',
    address: 'Accra, Ghana',
    phone: '+233 24 412 3456',
    email: 'info@grefas.com',
    letterheadJointTitle: 'GREFAS ENTERTAINMENT & CONSULT',
    letterheadJointSubtitle: 'Theatre, Film Casting, Artiste Management, Production & Business Consulting',
    letterheadEntTitle: 'GREFAS ENTERTAINMENT & PRODUCTIONS',
    letterheadEntSubtitle: 'Skit & Movie Production, Casting Services, Creative Arts and Artiste Management',
    letterheadConsultTitle: 'GREFAS BUSINESS & STRATEGY CONSULT',
    letterheadConsultSubtitle: 'Corporate Advisory, Visa Interview Preparation, Strategic Management Consulting'
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'list' | 'compose'>('list');

  // Form states
  const [recipientType, setRecipientType] = useState<'organisation' | 'individual' | 'institution'>('organisation');
  const [castCrewList, setCastCrewList] = useState<CastCrewMember[]>([]);
  const [selectedCastCrewId, setSelectedCastCrewId] = useState<string>('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [subject, setSubject] = useState('');
  const [salutation, setSalutation] = useState('Dear Sir/Madam,');
  const [body, setBody] = useState('');
  const [signatoryName, setSignatoryName] = useState('Grice Asante');
  const [signatoryTitle, setSignatoryTitle] = useState('CEO & Founder');
  const [letterheadType, setLetterheadType] = useState<'entertainment' | 'consult' | 'joint'>('joint');
  const [watermarkEnabled, setWatermarkEnabled] = useState(true);
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.05);

  // AI Assistant states
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiTone, setAiTone] = useState('Professional, formal, and authoritative');
  const [isGenerating, setIsGenerating] = useState(false);

  // Deletion Modal state
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingLetterId, setEditingLetterId] = useState<string | null>(null);

  const handleStartEdit = (letter: Letter) => {
    setEditingLetterId(letter.id);
    setRecipientType(letter.recipientType);
    setRecipientName(letter.recipientName);
    setRecipientAddress(letter.recipientAddress || '');
    setDate(letter.date);
    setSubject(letter.subject);
    setSalutation(letter.salutation || 'Dear Sir/Madam,');
    setBody(letter.body);
    setSignatoryName(letter.signatoryName || 'Grice Asante');
    setSignatoryTitle(letter.signatoryTitle || 'CEO & Founder');
    setLetterheadType(letter.letterheadType || 'joint');
    setWatermarkEnabled(letter.watermarkEnabled !== undefined ? letter.watermarkEnabled : true);
    setWatermarkOpacity(letter.watermarkOpacity !== undefined ? letter.watermarkOpacity : 0.05);
    setActiveTab('compose');
  };

  const handleComposeTabClick = () => {
    setEditingLetterId(null);
    setRecipientType('organisation');
    setRecipientName('');
    setRecipientAddress('');
    setDate(new Date().toISOString().split('T')[0]);
    setSubject('');
    setSalutation('Dear Sir/Madam,');
    setBody('');
    setSignatoryName('Grice Asante');
    setSignatoryTitle('CEO & Founder');
    setLetterheadType('joint');
    setWatermarkEnabled(true);
    setWatermarkOpacity(0.05);
    setAiPrompt('');
    setSelectedCastCrewId('');
    setActiveTab('compose');
  };

  // Load letters from Firestore
  useEffect(() => {
    const lettersRef = collection(db, 'letters');
    const q = query(lettersRef, orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lettersData: Letter[] = [];
      snapshot.forEach((doc) => {
        lettersData.push({ id: doc.id, ...doc.data() } as Letter);
      });
      setLetters(lettersData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'letters');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Load settings from Firestore
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setSettings({
          logoUrl: data.logoUrl || '',
          address: data.address || 'Accra, Ghana',
          phone: data.phone || '+233 24 412 3456',
          email: data.email || 'info@grefas.com',
          letterheadJointTitle: data.letterheadJointTitle || 'GREFAS ENTERTAINMENT & CONSULT',
          letterheadJointSubtitle: data.letterheadJointSubtitle || 'Theatre, Film Casting, Artiste Management, Production & Business Consulting',
          letterheadEntTitle: data.letterheadEntTitle || 'GREFAS ENTERTAINMENT & PRODUCTIONS',
          letterheadEntSubtitle: data.letterheadEntSubtitle || 'Skit & Movie Production, Casting Services, Creative Arts and Artiste Management',
          letterheadConsultTitle: data.letterheadConsultTitle || 'GREFAS BUSINESS & STRATEGY CONSULT',
          letterheadConsultSubtitle: data.letterheadConsultSubtitle || 'Corporate Advisory, Visa Interview Preparation, Strategic Management Consulting'
        });
      }
    }, (error) => {
      // Non-blocking fallback
      console.warn("Failed to load global settings for letterhead:", error);
    });

    return () => unsubscribe();
  }, []);

  // Load cast and crew members (service intakes)
  useEffect(() => {
    const q = query(collection(db, 'service_intakes'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const members: CastCrewMember[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        members.push({
          id: doc.id,
          fullName: data.fullName || '',
          roleType: data.roleType || '',
          emailAddress: data.emailAddress || '',
          address: data.address || '',
          contact: data.contact || '',
          status: data.status || ''
        });
      });
      setCastCrewList(members);
    }, (error) => {
      console.error("Failed to load cast & crew for letters selection:", error);
    });
    return () => unsubscribe();
  }, []);

  const handleSelectCastCrew = (memberId: string) => {
    setSelectedCastCrewId(memberId);
    if (!memberId) return;

    const member = castCrewList.find(m => m.id === memberId);
    if (member) {
      setRecipientType('individual');
      setRecipientName(member.fullName);
      setRecipientAddress(
        `${member.address || ''}\nContact: ${member.contact || ''}\nEmail: ${member.emailAddress || ''}`.trim()
      );
      setLetterheadType('entertainment');
    }
  };

  const handleCreateLetter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientName.trim() || !subject.trim() || !body.trim()) {
      toast.error('Please fill in all required fields (Recipient Name, Subject, and Letter Body)');
      return;
    }

    try {
      const letterData = {
        recipientType,
        recipientName,
        recipientAddress,
        date,
        subject,
        salutation,
        body,
        signatoryName,
        signatoryTitle,
        letterheadType,
        watermarkEnabled,
        watermarkOpacity,
        ...(editingLetterId ? {} : { createdAt: serverTimestamp() }),
        updatedAt: serverTimestamp()
      };

      if (editingLetterId) {
        await updateDoc(doc(db, 'letters', editingLetterId), letterData);
        toast.success('Official letter updated successfully!');
      } else {
        await addDoc(collection(db, 'letters'), letterData);
        toast.success('Official letter saved successfully!');
      }
      
      // Reset composer form partially
      setRecipientName('');
      setRecipientAddress('');
      setSubject('');
      setBody('');
      setAiPrompt('');
      setEditingLetterId(null);
      
      // Navigate to list
      setActiveTab('list');
    } catch (err) {
      toast.error(editingLetterId ? 'Failed to update the letter.' : 'Failed to save the letter to database.');
      console.error(err);
    }
  };

  const handleDeleteLetter = async () => {
    if (!deleteId) return;
    try {
      await deleteDoc(doc(db, 'letters', deleteId));
      toast.success('Letter deleted successfully');
      setDeleteId(null);
    } catch (err) {
      toast.error('Failed to delete letter');
      console.error(err);
    }
  };

  const generateWithAI = async () => {
    if (!recipientName.trim()) {
      toast.error('Please enter the Recipient Name first so AI can customize the letter.');
      return;
    }
    if (!subject.trim()) {
      toast.error('Please enter a Subject first to guide the AI on the letter purpose.');
      return;
    }
    if (!aiPrompt.trim()) {
      toast.error('Please enter a short prompt or brief summary of what the letter is about.');
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch('/api/letters/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientName,
          recipientType,
          recipientAddress,
          subject,
          additionalContext: aiPrompt,
          tone: aiTone
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Server returned an error');
      }

      const data = await response.json();
      if (data.text) {
        setBody(data.text);
        toast.success('Letter draft generated successfully by Grefas AI!');
      } else {
        throw new Error('No text was returned');
      }
    } catch (error: any) {
      toast.error(`AI Drafting failed: ${error.message}`);
      console.error('AI Error:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const triggerSafePrint = (letter: Letter) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Print window blocked! Please allow pop-ups for this domain.');
      return;
    }

    // Set up Letterhead metadata and logo fallback
    let headerTitle = settings.letterheadJointTitle || "GREFAS ENTERTAINMENT & CONSULT";
    let headerSubtitle = settings.letterheadJointSubtitle || "Theatre, Film Casting, Artiste Management, Production & Business Consulting";
    
    if (letter.letterheadType === 'entertainment') {
      headerTitle = settings.letterheadEntTitle || "GREFAS ENTERTAINMENT & PRODUCTIONS";
      headerSubtitle = settings.letterheadEntSubtitle || "Skit & Movie Production, Casting Services, Creative Arts and Artiste Management";
    } else if (letter.letterheadType === 'consult') {
      headerTitle = settings.letterheadConsultTitle || "GREFAS BUSINESS & STRATEGY CONSULT";
      headerSubtitle = settings.letterheadConsultSubtitle || "Corporate Advisory, Visa Interview Preparation, Strategic Management Consulting";
    }

    const logoHtml = settings.logoUrl 
      ? `<img src="${settings.logoUrl}" class="letterhead-logo" alt="Grefas Logo" referrerPolicy="no-referrer" />`
      : `<div class="letterhead-logo-placeholder">GREFAS</div>`;

    const watermarkHtml = (letter.watermarkEnabled && settings.logoUrl)
      ? `<img src="${settings.logoUrl}" class="watermark" style="opacity: ${letter.watermarkOpacity || 0.05};" alt="Watermark Logo" referrerPolicy="no-referrer" />`
      : '';

    // Convert newlines in letter body to paragraph elements
    const formattedBody = letter.body
      .split('\n\n')
      .map(p => p.trim())
      .filter(p => p.length > 0)
      .map(p => `<p class="body-p">${p.replace(/\n/g, '<br/>')}</p>`)
      .join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Grefas Official Letter - ${letter.subject}</title>
          <style>
            @page {
              size: A4;
              margin: 20mm 15mm 20mm 15mm;
            }
            body {
              font-family: "Times New Roman", Times, Georgia, serif;
              color: #1a1a1a;
              background-color: white;
              line-height: 1.6;
              font-size: 11pt;
              margin: 0;
              padding: 0;
            }
            .letter-container {
              position: relative;
              min-height: 100%;
              box-sizing: border-box;
            }
            
            /* Letterhead style */
            .letterhead {
              display: flex;
              align-items: center;
              justify-content: space-between;
              border-bottom: 2px solid #ea580c;
              padding-bottom: 12px;
              margin-bottom: 30px;
            }
            .letterhead-logo {
              max-height: 80px;
              max-width: 140px;
              object-fit: contain;
            }
            .letterhead-logo-placeholder {
              font-size: 24px;
              font-weight: 900;
              color: #ea580c;
              border: 3px double #ea580c;
              padding: 4px 12px;
              letter-spacing: 2px;
            }
            .letterhead-info {
              text-align: right;
              max-width: 60%;
            }
            .company-name {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              font-size: 14pt;
              font-weight: 800;
              color: #111;
              margin: 0 0 2px 0;
              letter-spacing: -0.5px;
            }
            .company-subtitle {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              font-size: 8pt;
              color: #ea580c;
              margin: 0 0 6px 0;
              font-weight: bold;
              text-transform: uppercase;
            }
            .company-contact {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              font-size: 8pt;
              color: #555;
              margin: 0;
              line-height: 1.3;
            }

            /* Watermark style */
            .watermark-container {
              position: fixed;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              z-index: -100;
              display: flex;
              align-items: center;
              justify-content: center;
              pointer-events: none;
            }
            .watermark {
              width: 420px;
              height: auto;
              max-height: 420px;
              object-fit: contain;
              transform: rotate(-15deg);
              filter: grayscale(100%);
            }

            /* Recipient & Meta Section */
            .letter-meta {
              display: flex;
              justify-content: space-between;
              margin-bottom: 30px;
              font-size: 10.5pt;
            }
            .recipient-block {
              max-width: 50%;
            }
            .recipient-type {
              font-size: 8.5pt;
              font-weight: bold;
              text-transform: uppercase;
              color: #ea580c;
              margin: 0 0 4px 0;
              font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            }
            .recipient-name {
              font-size: 11pt;
              font-weight: bold;
              margin: 0 0 4px 0;
            }
            .recipient-address {
              white-space: pre-line;
              margin: 0;
              color: #333;
            }
            .date-block {
              text-align: right;
            }

            /* Subject style */
            .subject-line {
              font-size: 11.5pt;
              font-weight: bold;
              text-transform: uppercase;
              text-align: center;
              margin-bottom: 25px;
              padding: 6px 0;
              border-top: 1px solid #ccc;
              border-bottom: 1px solid #ccc;
              letter-spacing: 0.5px;
            }

            /* Salutation */
            .salutation {
              font-size: 11pt;
              font-weight: bold;
              margin-bottom: 15px;
            }

            /* Body paragraphs */
            .letter-body {
              text-align: justify;
              margin-bottom: 40px;
              font-size: 11pt;
            }
            .body-p {
              text-indent: 30px;
              margin: 0 0 15px 0;
              line-height: 1.6;
            }

            /* Sign-off section */
            .sign-off-block {
              margin-top: 40px;
              page-break-inside: avoid;
              font-size: 11pt;
            }
            .sign-off-valediction {
              margin-bottom: 45px;
            }
            .signature-space {
              height: 50px;
            }
            .signatory-name {
              font-weight: bold;
              margin: 0;
            }
            .signatory-title {
              color: #555;
              margin: 2px 0 0 0;
              font-size: 10pt;
            }

            /* Footer */
            .letter-footer {
              position: fixed;
              bottom: 10mm;
              left: 15mm;
              right: 15mm;
              text-align: center;
              font-size: 7.5pt;
              color: #888;
              border-top: 1px solid #eee;
              padding-top: 6px;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            }
          </style>
        </head>
        <body>
          <div class="letter-container">
            <!-- Watermark Background -->
            <div class="watermark-container">
              ${watermarkHtml}
            </div>

            <!-- Letterhead -->
            <div class="letterhead">
              ${logoHtml}
              <div class="letterhead-info">
                <h1 class="company-name">${headerTitle}</h1>
                <p class="company-subtitle">${headerSubtitle}</p>
                <p class="company-contact">
                  ${settings.address}<br/>
                  Phone: ${settings.phone} | Email: ${settings.email}<br/>
                  Website: www.grefas.com
                </p>
              </div>
            </div>

            <!-- Recipient and Date metadata -->
            <div class="letter-meta">
              <div class="recipient-block">
                <p class="recipient-type">To ${letter.recipientType}</p>
                <h2 class="recipient-name">${letter.recipientName}</h2>
                <p class="recipient-address">${letter.recipientAddress || 'Address N/A'}</p>
              </div>
              <div class="date-block">
                <strong>Date:</strong> ${new Date(letter.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
            </div>

            <!-- Subject -->
            <div class="subject-line">
              RE: ${letter.subject}
            </div>

            <!-- Salutation -->
            <div class="salutation">
              ${letter.salutation}
            </div>

            <!-- Body -->
            <div class="letter-body">
              ${formattedBody}
            </div>

            <!-- Sign-off -->
            <div class="sign-off-block">
              <div class="sign-off-valediction">Yours sincerely,</div>
              <div class="signature-space"></div>
              <p class="signatory-name">${letter.signatoryName}</p>
              <p class="signatory-title">${letter.signatoryTitle}</p>
            </div>

            <!-- Footer -->
            <div class="letter-footer">
              This is an official document of ${headerTitle}. All rights reserved. Registered in Ghana.
            </div>
          </div>

          <script>
            window.addEventListener('load', function() {
              var images = document.getElementsByTagName('img');
              var loadedCount = 0;
              var totalImages = images.length;
              
              if (totalImages === 0) {
                setTimeout(function() { window.print(); }, 400);
                return;
              }
              
              function onImageLoad() {
                loadedCount++;
                if (loadedCount === totalImages) {
                  setTimeout(function() {
                    window.print();
                  }, 800);
                }
              }
              
              for (var i = 0; i < totalImages; i++) {
                if (images[i].complete) {
                  onImageLoad();
                } else {
                  images[i].addEventListener('load', onImageLoad);
                  images[i].addEventListener('error', onImageLoad);
                }
              }
            });
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
    toast.success('Official letter layout rendered! Printing window triggered.');
  };

  const filteredLetters = letters.filter(letter => {
    const matchesSearch = 
      letter.recipientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      letter.subject.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterType === 'all' || letter.recipientType === filterType;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6">
      {/* Header section with tab selectors */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card p-5 rounded-xl border border-border">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <FileText className="h-6 w-6 text-orange-600" /> Official Business Letters
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Compose and print official Grefas letters with customizable letterheads and logo watermarks.
          </p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Button
            id="btn-tab-list"
            variant={activeTab === 'list' ? 'default' : 'outline'}
            onClick={() => setActiveTab('list')}
            className={`flex-1 md:flex-none text-xs font-bold uppercase tracking-wider px-4 ${
              activeTab === 'list' ? 'bg-orange-600 hover:bg-orange-700 text-white' : ''
            }`}
          >
            Letters Directory
          </Button>
          <Button
            id="btn-tab-compose"
            variant={activeTab === 'compose' ? 'default' : 'outline'}
            onClick={handleComposeTabClick}
            className={`flex-1 md:flex-none text-xs font-bold uppercase tracking-wider px-4 ${
              activeTab === 'compose' ? 'bg-orange-600 hover:bg-orange-700 text-white' : ''
            }`}
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> {editingLetterId ? 'Edit Letter' : 'Compose New'}
          </Button>
        </div>
      </div>

      {activeTab === 'list' ? (
        <div className="space-y-4">
          {/* Filtering and search bar */}
          <div className="bg-card p-4 rounded-xl border border-border flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="search-letters-input"
                type="text"
                placeholder="Search letters by recipient or subject..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-muted/35 text-xs h-9"
              />
            </div>
            <div className="flex gap-2">
              <select
                id="filter-recipient-type"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="bg-card border border-border rounded-lg px-3 text-xs h-9 text-muted-foreground"
              >
                <option value="all">All Recipient Types</option>
                <option value="organisation">Organisations</option>
                <option value="individual">Individuals</option>
                <option value="institution">Institutions</option>
              </select>
            </div>
          </div>

          {/* Directory list of saved letters */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {loading ? (
              <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-orange-600 mb-2" />
                <p className="text-xs">Loading letters archive...</p>
              </div>
            ) : filteredLetters.length === 0 ? (
              <div className="text-center p-12">
                <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <h3 className="font-bold text-sm text-foreground mb-1">No Letters Found</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto mb-4">
                  {searchTerm || filterType !== 'all' 
                    ? "Try adjusting your search query or filter settings." 
                    : "You haven't composed any official letters yet. Click the 'Compose New' button to get started!"}
                </p>
                {(!searchTerm && filterType === 'all') && (
                  <Button
                    id="btn-empty-compose"
                    onClick={() => setActiveTab('compose')}
                    className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold"
                  >
                    Compose First Letter
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-muted/30 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      <th className="p-4 w-48">Date / Reference</th>
                      <th className="p-4">Recipient Info</th>
                      <th className="p-4">Subject</th>
                      <th className="p-4 w-32">Type</th>
                      <th className="p-4 w-40 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredLetters.map((letter) => (
                      <tr key={letter.id} className="hover:bg-muted/15 transition-all">
                        <td className="p-4">
                          <p className="text-xs font-bold text-foreground">
                            {new Date(letter.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                          </p>
                          <p className="text-[10px] text-muted-foreground font-mono mt-0.5">Ref: {letter.id.substring(0, 8).toUpperCase()}</p>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            {letter.recipientType === 'organisation' && <Building2 className="h-3.5 w-3.5 text-blue-500 shrink-0" />}
                            {letter.recipientType === 'individual' && <User className="h-3.5 w-3.5 text-green-500 shrink-0" />}
                            {letter.recipientType === 'institution' && <School className="h-3.5 w-3.5 text-purple-500 shrink-0" />}
                            <span className="text-xs font-black text-foreground">{letter.recipientName}</span>
                          </div>
                          {letter.recipientAddress && (
                            <p className="text-[10px] text-muted-foreground mt-1 truncate max-w-xs">{letter.recipientAddress}</p>
                          )}
                        </td>
                        <td className="p-4">
                          <p className="text-xs font-semibold text-foreground line-clamp-1">{letter.subject}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">Signatory: {letter.signatoryName}</p>
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                            letter.recipientType === 'organisation' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/10' :
                            letter.recipientType === 'individual' ? 'bg-green-50 text-green-600 dark:bg-green-900/10' :
                            'bg-purple-50 text-purple-600 dark:bg-purple-900/10'
                          }`}>
                            {letter.recipientType}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              id={`btn-edit-${letter.id}`}
                              size="icon"
                              variant="outline"
                              title="Edit Letter"
                              onClick={() => handleStartEdit(letter)}
                              className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              id={`btn-print-${letter.id}`}
                              size="icon"
                              variant="outline"
                              title="Print / Save PDF"
                              onClick={() => triggerSafePrint(letter)}
                              className="h-8 w-8 text-orange-600 hover:text-orange-700 hover:bg-orange-50 border-orange-200"
                            >
                              <Printer className="h-4 w-4" />
                            </Button>
                            <Button
                              id={`btn-delete-${letter.id}`}
                              size="icon"
                              variant="outline"
                              title="Delete Archive"
                              onClick={() => setDeleteId(letter.id)}
                              className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 border-red-100"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Composer form tab */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Form inputs section */}
          <div className="lg:col-span-7 space-y-6">
            <Card className="border border-border">
              <CardHeader className="pb-4 border-b border-border bg-muted/10">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                  <FileText className="h-4.5 w-4.5 text-orange-600" /> Letter Metadata & Recipient
                </CardTitle>
                <CardDescription className="text-xs">
                  Fill in standard corporate correspondence details.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                {/* Cast & Crew Fast-Track Integration */}
                <div className="bg-orange-50/5 dark:bg-orange-950/5 border border-orange-200/50 p-4 rounded-xl space-y-3.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-black uppercase tracking-wider text-orange-600 flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 animate-pulse text-orange-600" /> Cast & Crew Quick-Issue Desk
                    </p>
                    {castCrewList.length > 0 && (
                      <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold">
                        {castCrewList.length} Active Candidates
                      </span>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Select Cast or Crew Member</label>
                      <select
                        id="select-cast-crew-member"
                        value={selectedCastCrewId}
                        onChange={(e) => handleSelectCastCrew(e.target.value)}
                        className="w-full bg-background border border-border rounded-lg text-xs h-9 px-3 text-foreground font-semibold focus:border-orange-500"
                      >
                        <option value="">-- Choose from registered talent --</option>
                        {castCrewList.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.fullName} ({member.roleType || 'General'})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Apply Official Template</label>
                      <div className="flex gap-2">
                        <Button
                          id="btn-apply-cast-template"
                          type="button"
                          variant="outline"
                          disabled={!recipientName}
                          onClick={() => {
                            const role = selectedCastCrewId 
                              ? (castCrewList.find(m => m.id === selectedCastCrewId)?.roleType || 'Cast Member')
                              : 'Cast Member';
                            setSubject(`OFFER OF ENGAGEMENT: ${role.toUpperCase()}`);
                            setSalutation(`Dear ${recipientName.split(' ')[0] || 'Sir/Madam'},`);
                            setBody(`This letter serves as an official offer of engagement by Grefas Entertainment & Productions for your professional performance services.\n\nWe have been thoroughly impressed by your audition, screen presence, and creative credentials. Accordingly, you are being engaged in the capacity of ${role}, effective from the date of scheduling.\n\nYour primary engagements will include:\n1. Attending all scheduled rehearsals, read-throughs, table reads, and blocking sessions.\n2. Cooperating fully with the director, technical crew, and fellow cast members to maintain artistic integrity.\n3. Arriving on set promptly with full preparation of lines, blocking, and characterization.\n\nIn consideration for your artistic services, Grefas Entertainment shall provide a competitive performance stipend as discussed, payable upon successful completion of production milestones. Logistics, styling, and basic on-set hospitality during shoot days will be provided by our production coordinators.\n\nPlease review this agreement, sign the copy below, and return it to our admin office to confirm your acceptance. We are incredibly thrilled to have you onboard and look forward to capturing magic on screen together!`);
                            toast.success("Cast Engagement Letter template applied!");
                          }}
                          className="flex-1 text-[10px] font-bold h-9 border-orange-200 hover:bg-orange-50 hover:text-orange-700 text-foreground"
                        >
                          Cast Offer
                        </Button>
                        <Button
                          id="btn-apply-crew-template"
                          type="button"
                          variant="outline"
                          disabled={!recipientName}
                          onClick={() => {
                            const role = selectedCastCrewId 
                              ? (castCrewList.find(m => m.id === selectedCastCrewId)?.roleType || 'Production Crew')
                              : 'Production Crew';
                            setSubject(`OFFER OF ENGAGEMENT: ${role.toUpperCase()} (PRODUCTION STAFF)`);
                            setSalutation(`Dear ${recipientName.split(' ')[0] || 'Sir/Madam'},`);
                            setBody(`This letter serves as an official offer of engagement by Grefas Entertainment & Productions for your professional technical and production services.\n\nBased on your stellar technical expertise and professional portfolio, we are pleased to engage you as a vital member of our Production Crew in the role of ${role}, effective from the scheduled production start.\n\nYour key deliverables will include:\n1. Overseeing technical setups, gear inventory, and operational management of your assigned department (e.g., Camera, Sound, Lighting, Set Design, or Production Management).\n2. Coordinating closely with the Director, Producer, and fellow crew members to ensure high-fidelity audio-visual output.\n3. Ensuring proper maintenance, safety, and breakdown of all technical equipment on set.\n\nIn consideration for your technical services, Grefas Entertainment shall provide a professional day-rate or project stipend as negotiated, payable upon milestone clearances. All on-set meals, safety gear, and local transport during shoot timelines will be fully covered.\n\nPlease sign and return a duplicate of this engagement letter to our administration desk to confirm your availability and agreement to these terms. We are excited to collaborate with you to deliver world-class production values.`);
                            toast.success("Crew Engagement Letter template applied!");
                          }}
                          className="flex-1 text-[10px] font-bold h-9 border-orange-200 hover:bg-orange-50 hover:text-orange-700 text-foreground"
                        >
                          Crew Offer
                        </Button>
                      </div>
                    </div>
                  </div>
                  {!recipientName && (
                    <p className="text-[10px] text-muted-foreground italic">
                      💡 Select a registered member above or enter a Recipient Name to activate the template quick-apply buttons.
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-foreground block">Recipient Classification</label>
                    <div className="flex gap-2">
                      <Button
                        id="btn-rec-org"
                        type="button"
                        variant={recipientType === 'organisation' ? 'default' : 'outline'}
                        onClick={() => setRecipientType('organisation')}
                        className={`flex-1 text-[10px] uppercase font-black tracking-wider h-9 ${
                          recipientType === 'organisation' ? 'bg-orange-600 text-white hover:bg-orange-700' : ''
                        }`}
                      >
                        <Building2 className="h-3.5 w-3.5 mr-1 shrink-0" /> Organisation
                      </Button>
                      <Button
                        id="btn-rec-ind"
                        type="button"
                        variant={recipientType === 'individual' ? 'default' : 'outline'}
                        onClick={() => setRecipientType('individual')}
                        className={`flex-1 text-[10px] uppercase font-black tracking-wider h-9 ${
                          recipientType === 'individual' ? 'bg-orange-600 text-white hover:bg-orange-700' : ''
                        }`}
                      >
                        <User className="h-3.5 w-3.5 mr-1 shrink-0" /> Individual
                      </Button>
                      <Button
                        id="btn-rec-inst"
                        type="button"
                        variant={recipientType === 'institution' ? 'default' : 'outline'}
                        onClick={() => setRecipientType('institution')}
                        className={`flex-1 text-[10px] uppercase font-black tracking-wider h-9 ${
                          recipientType === 'institution' ? 'bg-orange-600 text-white hover:bg-orange-700' : ''
                        }`}
                      >
                        <School className="h-3.5 w-3.5 mr-1 shrink-0" /> Institution
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-foreground block">Letterhead Blueprint</label>
                    <select
                      id="input-letterhead-type"
                      value={letterheadType}
                      onChange={(e: any) => setLetterheadType(e.target.value)}
                      className="w-full bg-muted/30 border border-border rounded-lg text-xs h-9 px-3 text-foreground font-medium focus:border-orange-500"
                    >
                      <option value="joint">Joint: Grefas Entertainment & Consult</option>
                      <option value="entertainment">Grefas Entertainment & Productions</option>
                      <option value="consult">Grefas Consult / Business Consulting</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-foreground block">Recipient Name *</label>
                    <Input
                      id="input-recipient-name"
                      type="text"
                      placeholder="e.g. Ministry of Tourism / John Mahama"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      className="bg-muted/30 text-xs h-9"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-foreground block">Reference Date</label>
                    <Input
                      id="input-letter-date"
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="bg-muted/30 text-xs h-9"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-foreground block">Recipient Address</label>
                  <Textarea
                    id="input-recipient-address"
                    placeholder="e.g. P.O. Box GP 1234, Accra High Street, Ghana"
                    value={recipientAddress}
                    onChange={(e) => setRecipientAddress(e.target.value)}
                    className="bg-muted/30 text-xs min-h-[70px]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-foreground block">Letter Subject *</label>
                    <Input
                      id="input-letter-subject"
                      type="text"
                      placeholder="e.g. Request for Audition Venue Sponsorship"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="bg-muted/30 text-xs h-9"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-foreground block">Salutation Line</label>
                    <Input
                      id="input-letter-salutation"
                      type="text"
                      placeholder="e.g. Dear Sir/Madam,"
                      value={salutation}
                      onChange={(e) => setSalutation(e.target.value)}
                      className="bg-muted/30 text-xs h-9"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* AI Assistant card */}
            <Card className="border border-orange-200 bg-orange-50/15 dark:bg-orange-950/5">
              <CardHeader className="pb-2 border-b border-orange-100 dark:border-orange-900/30">
                <CardTitle className="text-sm font-black flex items-center gap-2 text-orange-600">
                  <Sparkles className="h-4.5 w-4.5" /> Grefas AI Letter Drafting Co-Pilot
                </CardTitle>
                <CardDescription className="text-xs">
                  Generate professional content for your letter using Grefas' integrated Gemini AI models.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-foreground block">Briefly state what the letter should cover</label>
                  <Textarea
                    id="input-ai-prompt"
                    placeholder="e.g., Requesting permissions to shoot a television serial pilot at their beach resort next month. Assure clean setup and zero interference with guests."
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    className="bg-background text-xs min-h-[60px]"
                  />
                </div>
                <div className="flex flex-col sm:flex-row gap-3 items-end justify-between">
                  <div className="w-full sm:w-1/2 space-y-1.5">
                    <label className="text-[11px] font-semibold text-muted-foreground">Tone</label>
                    <select
                      id="input-ai-tone"
                      value={aiTone}
                      onChange={(e) => setAiTone(e.target.value)}
                      className="w-full bg-background border border-border rounded-lg text-xs h-8 px-2 text-foreground font-medium"
                    >
                      <option value="Professional, formal, and authoritative">Formal & Authoritative</option>
                      <option value="Warm, inviting, and collaborative">Warm & Collaborative</option>
                      <option value="Persuasive, sales-oriented, and convincing">Persuasive / Pitching</option>
                      <option value="Strict, final, and warning">Strict / Warning</option>
                    </select>
                  </div>
                  <Button
                    id="btn-ai-generate"
                    type="button"
                    disabled={isGenerating}
                    onClick={generateWithAI}
                    className="w-full sm:w-auto bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold h-8 flex items-center gap-1.5"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Drafting Letter...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5" /> Generate Body with AI
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Letter Body textarea */}
            <Card className="border border-border">
              <CardHeader className="pb-3 border-b border-border bg-muted/10">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                  <FileText className="h-4.5 w-4.5 text-orange-600" /> Letter Body Paragraphs *
                </CardTitle>
                <CardDescription className="text-xs">
                  Review or draft the main body of your letter. Use double line breaks to start a new paragraph.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <Textarea
                  id="input-letter-body"
                  placeholder="Type your official letter contents here. Press Enter twice to create logical paragraph indentations in the printed outputs..."
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="bg-muted/30 text-xs min-h-[220px] font-sans leading-relaxed text-foreground"
                  required
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-foreground block">Signatory Name</label>
                    <Input
                      id="input-sig-name"
                      type="text"
                      value={signatoryName}
                      onChange={(e) => setSignatoryName(e.target.value)}
                      className="bg-muted/30 text-xs h-9"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-foreground block">Signatory Title</label>
                    <Input
                      id="input-sig-title"
                      type="text"
                      value={signatoryTitle}
                      onChange={(e) => setSignatoryTitle(e.target.value)}
                      className="bg-muted/30 text-xs h-9"
                    />
                  </div>
                </div>

                {/* Logo & Watermark Settings */}
                <div className="bg-muted/30 p-4 rounded-xl space-y-3">
                  <p className="text-[10px] uppercase font-black tracking-wider text-muted-foreground flex items-center gap-1">
                    <SettingsIcon className="h-3.5 w-3.5" /> Stamp & Watermark Alignment
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-center justify-between bg-card p-3 rounded-lg border border-border">
                      <div>
                        <p className="text-xs font-bold text-foreground">Enable Logo Watermark</p>
                        <p className="text-[10px] text-muted-foreground">Fade website logo behind text</p>
                      </div>
                      <input
                        id="chk-watermark-enabled"
                        type="checkbox"
                        checked={watermarkEnabled}
                        onChange={(e) => setWatermarkEnabled(e.target.checked)}
                        className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-border rounded"
                      />
                    </div>
                    {watermarkEnabled && (
                      <div className="bg-card p-3 rounded-lg border border-border space-y-1.5">
                        <div className="flex justify-between text-xs font-bold text-foreground">
                          <span>Watermark Opacity</span>
                          <span>{(watermarkOpacity * 100).toFixed(0)}%</span>
                        </div>
                        <input
                          id="range-watermark-opacity"
                          type="range"
                          min="0.02"
                          max="0.15"
                          step="0.01"
                          value={watermarkOpacity}
                          onChange={(e) => setWatermarkOpacity(parseFloat(e.target.value))}
                          className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-orange-600"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-3">
                  <Button
                    id="btn-composer-cancel"
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditingLetterId(null);
                      setActiveTab('list');
                    }}
                    className="text-xs font-bold"
                  >
                    Cancel
                  </Button>
                  <Button
                    id="btn-composer-save"
                    type="submit"
                    onClick={handleCreateLetter}
                    className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold px-5"
                  >
                    {editingLetterId ? 'Update & Archive Letter' : 'Save & Archive Letter'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Letter Real-time Preview Pane */}
          <div className="lg:col-span-5 space-y-4">
            <div className="sticky top-6">
              <div className="bg-card p-4 rounded-xl border border-border mb-3 flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Eye className="h-4 w-4 text-orange-600" /> Interactive Letter Sheet Preview
                </h3>
                <Button
                  id="btn-quick-preview-print"
                  size="sm"
                  onClick={() => {
                    triggerSafePrint({
                      id: 'draft',
                      recipientType,
                      recipientName: recipientName || '[Recipient Name]',
                      recipientAddress: recipientAddress || '[Recipient Address]',
                      date,
                      subject: subject || '[Subject Line]',
                      salutation,
                      body: body || 'Dear Sir, [Your compiled body paragraphs will be formatted here. Complete your draft to view exact line dimensions and column scales.]',
                      signatoryName,
                      signatoryTitle,
                      letterheadType,
                      watermarkEnabled,
                      watermarkOpacity
                    });
                  }}
                  className="bg-orange-600 hover:bg-orange-700 text-white text-[10px] h-8 font-bold flex items-center gap-1"
                >
                  <Printer className="h-3 w-3" /> Print Preview
                </Button>
              </div>

              {/* Simulation of Printable Letter */}
              <div className="bg-white text-black border border-border shadow-xl rounded-xl p-8 max-h-[80vh] overflow-y-auto font-serif text-left relative leading-relaxed text-sm select-none">
                
                {/* Watermark simulator */}
                {watermarkEnabled && settings.logoUrl && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                    <img 
                      src={settings.logoUrl} 
                      className="w-48 opacity-[0.06] rotate-12 grayscale select-none" 
                      alt="Watermark Mockup" 
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}

                <div className="relative z-10 space-y-6">
                  {/* Fake Letterhead */}
                  <div className="flex justify-between items-center border-b border-orange-500 pb-3">
                    {settings.logoUrl ? (
                      <img src={settings.logoUrl} className="h-10 w-auto rounded object-contain" alt="Logo" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="border-2 border-orange-600 px-2 py-0.5 text-orange-600 font-black text-xs font-sans tracking-widest">GREFAS</div>
                    )}
                    <div className="text-right font-sans text-[8px] leading-tight text-neutral-600">
                      <h4 className="font-bold text-neutral-900 text-[10px]">
                        {letterheadType === 'joint' && (settings.letterheadJointTitle || 'GREFAS ENTERTAINMENT & CONSULT')}
                        {letterheadType === 'entertainment' && (settings.letterheadEntTitle || 'GREFAS ENTERTAINMENT & PRODUCTIONS')}
                        {letterheadType === 'consult' && (settings.letterheadConsultTitle || 'GREFAS BUSINESS & STRATEGY CONSULT')}
                      </h4>
                      <p className="text-[7px] text-orange-600 font-semibold uppercase mt-0.5">
                        {letterheadType === 'joint' && (settings.letterheadJointSubtitle || 'Theatre • Casting • Artiste • Consulting')}
                        {letterheadType === 'entertainment' && (settings.letterheadEntSubtitle || 'Movie & Skit Production • Casting')}
                        {letterheadType === 'consult' && (settings.letterheadConsultSubtitle || 'Corporate Strategy • Advisory • Visa Prep')}
                      </p>
                      <p className="mt-1">{settings.address}</p>
                      <p>{settings.phone} | {settings.email}</p>
                    </div>
                  </div>

                  {/* Letter Metadata */}
                  <div className="flex justify-between text-xs">
                    <div>
                      <p className="text-[8px] uppercase tracking-wider font-sans font-bold text-orange-500">To {recipientType}</p>
                      <h5 className="font-bold">{recipientName || '[Recipient Name]'}</h5>
                      <p className="text-neutral-600 whitespace-pre-line text-[10px] leading-snug mt-1">{recipientAddress || '[Recipient Address]'}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-sans text-[10px]"><strong>Date:</strong> {date ? new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Today'}</p>
                    </div>
                  </div>

                  {/* Subject */}
                  <div className="border-y border-neutral-300 py-1.5 text-center font-bold text-xs uppercase text-neutral-900 bg-neutral-50/50">
                    RE: {subject || '[Subject Line]'}
                  </div>

                  {/* Salutation */}
                  <div className="font-bold text-xs">
                    {salutation}
                  </div>

                  {/* Body Paragraphs */}
                  <div className="text-xs text-neutral-800 space-y-3 leading-relaxed text-justify">
                    {body ? (
                      body.split('\n\n').map((p, i) => (
                        <p key={i} className="text-indent pl-4">
                          {p}
                        </p>
                      ))
                    ) : (
                      <p className="text-neutral-400 italic">
                        Start composing your letter or use the AI generator in the editor pane to automatically format professional paragraphs here.
                      </p>
                    )}
                  </div>

                  {/* Sign off */}
                  <div className="pt-4 text-xs">
                    <p className="mb-8">Yours sincerely,</p>
                    <p className="font-bold">{signatoryName}</p>
                    <p className="text-neutral-500 text-[10px]">{signatoryTitle}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Standard Delete Modal */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] animate-in fade-in">
          <div className="bg-card border border-border rounded-xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200 text-left">
            <h3 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-500" /> Confirm Deletion
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed mb-6">
              Are you sure you want to delete this sent letter from your archives? This action is irreversible.
            </p>
            <div className="flex justify-end gap-3">
              <Button 
                id="btn-delete-cancel"
                variant="outline" 
                size="sm" 
                onClick={() => setDeleteId(null)}
                className="text-xs font-semibold"
              >
                Cancel
              </Button>
              <Button 
                id="btn-delete-confirm"
                variant="destructive" 
                size="sm" 
                onClick={handleDeleteLetter}
                className="text-xs font-semibold"
              >
                Delete Archive
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
