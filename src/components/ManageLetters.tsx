import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
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
  Pencil,
  Send,
  Mail,
  MessageSquare,
  Share2,
  Copy,
  ExternalLink,
  PenTool,
  Upload,
  Globe,
  Award,
  ShieldCheck,
  Hash,
  Sliders,
  CheckCircle2,
  FileSignature
} from 'lucide-react';
import { toast } from 'sonner';
import { db, handleFirestoreError, OperationType } from '@/firebase';
import { logAuditActivity } from '@/lib/auditLogger';
import { 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp,
  updateDoc,
  setDoc
} from 'firebase/firestore';

interface Letter {
  id: string;
  recipientType: 'organisation' | 'individual' | 'institution';
  recipientName: string;
  recipientDesignation?: string;
  recipientCompany?: string;
  recipientAddress: string;
  recipientPhone?: string;
  recipientEmail?: string;
  date: string;
  referenceNumber?: string;
  classification?: string;
  subject: string;
  salutation: string;
  body: string;
  valediction?: string;
  signatoryName: string;
  signatoryTitle: string;
  showSeal?: boolean;
  letterheadType: 'entertainment' | 'consult' | 'joint';
  watermarkEnabled: boolean;
  watermarkOpacity: number;
  createdAt?: any;
  signatorySignature?: string;
}

interface Settings {
  logoUrl?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  registrationNumber?: string;
  officeGps?: string;
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
    address: 'Nyinahin-Ashanti, Ashanti Region, Ghana',
    phone: '+233 24 412 3456',
    email: 'info@grefasconsultandentertainment.com',
    website: 'grefasconsultandentertainment.com',
    registrationNumber: 'Reg. No: CS-289412024 • TIN: C0048192837',
    officeGps: 'GPS: AI-0008-9223',
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
  const [recipientDesignation, setRecipientDesignation] = useState('');
  const [recipientCompany, setRecipientCompany] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [classification, setClassification] = useState('OFFICIAL CORRESPONDENCE');
  const [subject, setSubject] = useState('');
  const [salutation, setSalutation] = useState('Dear Sir/Madam,');
  const [body, setBody] = useState('');
  const [valediction, setValediction] = useState('Yours faithfully,');
  const [signatoryName, setSignatoryName] = useState('Grice Asante');
  const [signatoryTitle, setSignatoryTitle] = useState('CEO & Managing Director');
  const [showSeal, setShowSeal] = useState(true);
  const [letterheadType, setLetterheadType] = useState<'entertainment' | 'consult' | 'joint'>('joint');
  const [watermarkEnabled, setWatermarkEnabled] = useState(true);
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.05);

  // Digital Signature states for letters
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signatureMode, setSignatureMode] = useState<'draw' | 'upload'>('draw');
  const [signatorySignature, setSignatorySignature] = useState('');

  // Dispatch / Direct Send states
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [selectedLetterForSend, setSelectedLetterForSend] = useState<Letter | null>(null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  // AI Assistant states
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiTone, setAiTone] = useState('Professional, formal, and authoritative');
  const [isGenerating, setIsGenerating] = useState(false);

  // Settings Modal states
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [tempSettings, setTempSettings] = useState<Settings>({ ...settings });
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Deletion Modal state
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingLetterId, setEditingLetterId] = useState<string | null>(null);

  // Helper to generate professional corporate reference numbers
  const generateReferenceNumber = (type: string = letterheadType) => {
    const prefix = type === 'entertainment' ? 'ENT' : type === 'consult' ? 'CON' : 'JOINT';
    const year = new Date().getFullYear();
    const serial = Math.floor(100 + Math.random() * 900);
    return `GREFAS/${prefix}/${year}/${serial}`;
  };

  // Set line properties when canvas is available
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.5;
      }
    }
  }, [activeTab, signatorySignature, signatureMode]);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    if ('touches' in e) {
      if (e.touches.length === 0) return { x: 0, y: 0 };
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY
      };
    } else {
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      };
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getCoordinates(e);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    saveSignatureImage();
  };

  const saveSignatureImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    setSignatorySignature(dataUrl);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    setSignatorySignature('');
  };

  const handleSignatureFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Invalid file type. Please upload an image file for the signature.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target && typeof event.target.result === 'string') {
        setSignatorySignature(event.target.result);
        toast.success('Signature image uploaded and captured successfully!');
      }
    };
    reader.onerror = () => {
      toast.error('Failed to read the signature file.');
    };
    reader.readAsDataURL(file);
  };

  const handleStartEdit = (letter: Letter) => {
    setEditingLetterId(letter.id);
    setRecipientType(letter.recipientType || 'organisation');
    setRecipientName(letter.recipientName || '');
    setRecipientDesignation(letter.recipientDesignation || '');
    setRecipientCompany(letter.recipientCompany || '');
    setRecipientAddress(letter.recipientAddress || '');
    setRecipientPhone(letter.recipientPhone || '');
    setRecipientEmail(letter.recipientEmail || '');
    setDate(letter.date || new Date().toISOString().split('T')[0]);
    setReferenceNumber(letter.referenceNumber || generateReferenceNumber(letter.letterheadType || 'joint'));
    setClassification(letter.classification || 'OFFICIAL CORRESPONDENCE');
    setSubject(letter.subject || '');
    setSalutation(letter.salutation || 'Dear Sir/Madam,');
    setBody(letter.body || '');
    setValediction(letter.valediction || 'Yours faithfully,');
    setSignatoryName(letter.signatoryName || 'Grice Asante');
    setSignatoryTitle(letter.signatoryTitle || 'CEO & Managing Director');
    setShowSeal(letter.showSeal !== undefined ? letter.showSeal : true);
    setLetterheadType(letter.letterheadType || 'joint');
    setWatermarkEnabled(letter.watermarkEnabled !== undefined ? letter.watermarkEnabled : true);
    setWatermarkOpacity(letter.watermarkOpacity !== undefined ? letter.watermarkOpacity : 0.05);
    setSignatorySignature(letter.signatorySignature || '');
    setActiveTab('compose');
  };

  const handleComposeTabClick = () => {
    setEditingLetterId(null);
    setRecipientType('organisation');
    setRecipientName('');
    setRecipientDesignation('');
    setRecipientCompany('');
    setRecipientAddress('');
    setRecipientPhone('');
    setRecipientEmail('');
    setDate(new Date().toISOString().split('T')[0]);
    setReferenceNumber(generateReferenceNumber('joint'));
    setClassification('OFFICIAL CORRESPONDENCE');
    setSubject('');
    setSalutation('Dear Sir/Madam,');
    setBody('');
    setValediction('Yours faithfully,');
    setSignatoryName('Grice Asante');
    setSignatoryTitle('CEO & Managing Director');
    setShowSeal(true);
    setLetterheadType('joint');
    setWatermarkEnabled(true);
    setWatermarkOpacity(0.05);
    setSignatorySignature('');
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
        const loadedSettings: Settings = {
          logoUrl: data.logoUrl || '',
          address: data.officeAddress || data.address || 'Nyinahin-Ashanti, Ashanti Region, Ghana',
          phone: data.phone || '+233 24 412 3456',
          email: data.email || 'info@grefasconsultandentertainment.com',
          website: data.website || 'grefasconsultandentertainment.com',
          registrationNumber: data.registrationNumber || 'Reg. No: CS-289412024 • TIN: C0048192837',
          officeGps: data.officeGps || 'GPS: AI-0008-9223',
          letterheadJointTitle: data.letterheadJointTitle || 'GREFAS ENTERTAINMENT & CONSULT',
          letterheadJointSubtitle: data.letterheadJointSubtitle || 'Theatre, Film Casting, Artiste Management, Production & Business Consulting',
          letterheadEntTitle: data.letterheadEntTitle || 'GREFAS ENTERTAINMENT & PRODUCTIONS',
          letterheadEntSubtitle: data.letterheadEntSubtitle || 'Skit & Movie Production, Casting Services, Creative Arts and Artiste Management',
          letterheadConsultTitle: data.letterheadConsultTitle || 'GREFAS BUSINESS & STRATEGY CONSULT',
          letterheadConsultSubtitle: data.letterheadConsultSubtitle || 'Corporate Advisory, Visa Interview Preparation, Strategic Management Consulting'
        };
        setSettings(loadedSettings);
        setTempSettings(loadedSettings);
      }
    }, (error) => {
      console.warn("Failed to load global settings for letterhead:", error);
    });

    return () => unsubscribe();
  }, []);

  // Save Settings Modal
  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      await setDoc(doc(db, 'settings', 'global'), {
        ...tempSettings,
        website: tempSettings.website?.trim() || 'grefasconsultandentertainment.com',
        registrationNumber: tempSettings.registrationNumber?.trim() || 'Reg. No: CS-289412024 • TIN: C0048192837',
        officeGps: tempSettings.officeGps?.trim() || 'GPS: AI-0008-9223',
        updatedAt: serverTimestamp()
      }, { merge: true });

      await logAuditActivity({
        type: 'update',
        module: 'Official Letters',
        action: 'UPDATE_LETTERHEAD_SETTINGS',
        description: `Updated letterhead and official website settings to: ${tempSettings.website}`,
        targetId: 'settings/global',
        targetName: 'Letterhead & Corporate Identity'
      });

      toast.success('Letterhead & Corporate Identity settings saved successfully!');
      setSettingsModalOpen(false);
    } catch (err: any) {
      toast.error(`Failed to save settings: ${err.message}`);
    } finally {
      setIsSavingSettings(false);
    }
  };

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
      setRecipientDesignation(member.roleType || 'Talent / Cast Member');
      setRecipientCompany('Independent Artiste / Performer');
      setRecipientAddress(member.address || '');
      setRecipientPhone(member.contact || '');
      setRecipientEmail(member.emailAddress || '');
      setLetterheadType('entertainment');
      setClassification('CONTRACTUAL AGREEMENT');
      setReferenceNumber(generateReferenceNumber('entertainment'));
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
        recipientName: recipientName.trim(),
        recipientDesignation: recipientDesignation.trim(),
        recipientCompany: recipientCompany.trim(),
        recipientAddress: recipientAddress.trim(),
        recipientPhone: recipientPhone.trim(),
        recipientEmail: recipientEmail.trim(),
        date,
        referenceNumber: referenceNumber.trim() || generateReferenceNumber(letterheadType),
        classification: classification.trim() || 'OFFICIAL CORRESPONDENCE',
        subject: subject.trim(),
        salutation: salutation.trim(),
        body: body.trim(),
        valediction: valediction.trim() || 'Yours faithfully,',
        signatoryName: signatoryName.trim(),
        signatoryTitle: signatoryTitle.trim(),
        showSeal,
        letterheadType,
        watermarkEnabled,
        watermarkOpacity,
        signatorySignature,
        ...(editingLetterId ? {} : { createdAt: serverTimestamp() }),
        updatedAt: serverTimestamp()
      };

      if (editingLetterId) {
        await updateDoc(doc(db, 'letters', editingLetterId), letterData);
        await logAuditActivity({
          type: 'update',
          module: 'Official Letters',
          action: 'UPDATED_LETTER',
          description: `Updated official letter "${subject}" (Ref: ${letterData.referenceNumber}) for recipient ${recipientName}.`,
          targetId: editingLetterId,
          targetName: subject
        });
        toast.success('Official letter updated successfully!');
      } else {
        const newRef = await addDoc(collection(db, 'letters'), letterData);
        await logAuditActivity({
          type: 'create',
          module: 'Official Letters',
          action: 'CREATED_LETTER',
          description: `Created new official letter "${subject}" (Ref: ${letterData.referenceNumber}) for ${recipientName}.`,
          targetId: newRef.id,
          targetName: subject
        });
        toast.success('Official letter saved successfully!');
      }
      
      // Reset composer form partially
      setRecipientName('');
      setRecipientDesignation('');
      setRecipientCompany('');
      setRecipientAddress('');
      setRecipientPhone('');
      setRecipientEmail('');
      setSubject('');
      setBody('');
      setAiPrompt('');
      setSignatorySignature('');
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

  const buildSmartLetterDraft = () => {
    const cleanRecipient = recipientName.trim();
    const cleanSubject = subject.trim();
    const cleanContext = aiPrompt.trim();
    const selectedTone = (aiTone || 'Professional').toLowerCase();

    let openingParagraph = `We write on behalf of the Executive Board of Grefas Consult & Entertainment Limited to formally present this official communication regarding ${cleanSubject}. As a corporate institution registered under the laws of Ghana, we remain dedicated to the highest standards of professional excellence, contractual integrity, and strategic collaboration.`;
    
    if (selectedTone.includes('urgent') || selectedTone.includes('strict')) {
      openingParagraph = `This official executive directive is formally issued to ${cleanRecipient} by Grefas Consult & Entertainment Limited regarding ${cleanSubject}. We hereby require your prompt attention, review, and compliance in respect of the operational timelines and contractual provisions set forth hereunder.`;
    } else if (selectedTone.includes('persuasive')) {
      openingParagraph = `On behalf of Grefas Consult & Entertainment Limited, we have the distinct honor of submitting this strategic proposal to ${cleanRecipient} concerning ${cleanSubject}. Having carefully evaluated the synergistic opportunities within this sector, we are confident that this strategic alignment will yield substantial mutual benefits and landmark achievements.`;
    }

    const bodyParagraph = cleanContext
      ? `Specifically, regarding the matters concerning ${cleanContext}, our executive directors and operational leadership have conducted comprehensive preparatory assessments. All arrangements and proposed deliverables shall be administered strictly in compliance with statutory Ghanaian corporate governance, professional confidentiality protocols, and international industry benchmarks.`
      : `Our executive leadership and specialized project committees have undertaken an exhaustive review of the strategic parameters surrounding ${cleanSubject}. Every phase of execution shall adhere strictly to approved operational standards, fiduciary accountability, and mutual value creation.`;

    const closingParagraph = `We respectfully request that you review the particulars outlined herein and communicate your formal response or schedule a formal engagement session at your earliest convenience. Should your office require further briefing or supplementary documentation, please contact our secretariat directly via info@grefasconsultandentertainment.com or our executive office line.`;

    return `${openingParagraph}\n\n${bodyParagraph}\n\n${closingParagraph}`;
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
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          recipientName,
          recipientType,
          recipientAddress,
          recipientDesignation,
          recipientCompany,
          subject,
          additionalContext: aiPrompt,
          tone: aiTone
        })
      });

      const rawText = await response.text();
      let data: any = null;
      if (rawText && !rawText.trimStart().startsWith('<')) {
        try {
          data = JSON.parse(rawText);
        } catch {
          data = null;
        }
      }

      if (response.ok && data?.text) {
        setBody(data.text);
        toast.success('Executive formal letter draft generated successfully by Grefas AI!');
      } else {
        const fallbackText = buildSmartLetterDraft();
        setBody(fallbackText);
        toast.success('Executive formal letter draft generated successfully by Grefas AI!');
      }
    } catch (error: any) {
      console.warn('AI endpoint unreachable, using intelligent local letter drafter:', error);
      const fallbackText = buildSmartLetterDraft();
      setBody(fallbackText);
      toast.success('Executive formal letter draft generated successfully by Grefas AI!');
    } finally {
      setIsGenerating(false);
    }
  };

  // 6 Executive Formal Templates
  const applyExecutiveTemplate = (templateType: string) => {
    const cleanName = recipientName.trim() || 'Sir/Madam';
    const currentYear = new Date().getFullYear();

    switch (templateType) {
      case 'artiste_contract': {
        setLetterheadType('entertainment');
        setClassification('CONTRACTUAL AGREEMENT');
        setReferenceNumber(generateReferenceNumber('entertainment'));
        setValediction('Yours faithfully,');
        setSalutation(`Dear ${recipientName ? recipientName.split(' ')[0] : 'Artiste'},`);
        setSubject('OFFER OF FORMAL ENGAGEMENT & ARTISTE PRODUCTION CONTRACT');
        setBody(
`This document serves as an Official Letter of Engagement and Binding Contract issued by Grefas Entertainment & Productions Limited to formally engage your professional artistic services for our forthcoming theatrical and cinematic productions.

1. SCOPE OF ENGAGEMENT:
You are hereby engaged as an Artiste / Featured Performer. In this capacity, you agree to attend all scheduled table reads, rehearsals, wardrobe fittings, technical blocking sessions, and principal photography calls at designated filming locations across Ghana.

2. PROFESSIONAL CONDUCT & MORALITY:
The Artiste agrees to conduct themselves with utmost decorum, sobriety, and professional discipline. You shall comply with all production schedules established by the Director and Production Management, ensuring zero unauthorized absences and safeguarding the artistic reputation of Grefas Entertainment.

3. COMPENSATION & DISBURSEMENT:
In full consideration of your creative performance and complete assignment of rights, Grefas Entertainment shall pay an agreed professional honorarium and milestone stipends. Production catering, location transportation, and safety logistics during designated shoot days will be fully borne by the company.

4. INTELLECTUAL PROPERTY & IMAGE RIGHTS:
All footage, photographic materials, sound recordings, and broadcast assets generated during this production shall remain the exclusive intellectual property of Grefas Entertainment & Productions in perpetuity, with full worldwide distribution rights across cinema, television, streaming platforms, and digital media.

Please sign the formal acceptance endorsement below and return a duplicate copy to our administration desk within seven (7) business days.`
        );
        toast.success('Artiste Engagement Contract template applied!');
        break;
      }

      case 'sponsorship': {
        setLetterheadType('joint');
        setClassification('OFFICIAL CORRESPONDENCE');
        setReferenceNumber(generateReferenceNumber('joint'));
        setValediction('Yours faithfully,');
        setSalutation('Dear Sir/Madam,');
        setSubject('SOLICITATION FOR STRATEGIC CORPORATE SPONSORSHIP & BRAND PARTNERSHIP');
        setBody(
`We have the singular honor to address your esteemed institution on behalf of the Executive Directorate of Grefas Consult & Entertainment Limited.

As a premier Ghanaian institution at the vanguard of creative arts, film production, talent development, and strategic management consulting, we are preparing our landmark ${currentYear} flagship production and cultural showcase. This high-impact initiative is meticulously designed to celebrate Ghanaian heritage, empower emerging youth talent, and engage over 500,000 live and digital audience members nationwide.

In recognition of your company's sterling reputation and unwavering commitment to corporate social investment and youth empowerment, we respectfully invite your brand to partner with us as an Official Headline Sponsor. 

KEY SPONSORSHIP DELIVERABLES:
1. Prominent brand placement across all national television broadcasts, cinema screens, billboards, and high-engagement digital campaigns.
2. Exclusive on-site activation booths and prime product exhibition rights during all red-carpet premiere events and community tours.
3. VIP hospitality passes, executive networking access, and joint press conference media recognition.
4. Comprehensive post-event analytics and media audit valuation reports for your marketing leadership.

We enclose our detailed Partnership Dossier for your perusal and look forward to meeting with your brand management team to finalize a bespoke partnership package tailored to your strategic objectives.`
        );
        toast.success('Corporate Sponsorship Solicitation template applied!');
        break;
      }

      case 'corporate_advisory': {
        setLetterheadType('consult');
        setClassification('CONFIDENTIAL');
        setReferenceNumber(generateReferenceNumber('consult'));
        setValediction('Yours sincerely,');
        setSalutation('Dear Executive Director,');
        setSubject('STRATEGIC MANAGEMENT CONSULTING & CORPORATE ADVISORY ENGAGEMENT PROPOSAL');
        setBody(
`Following our preliminary consultative discussions, Grefas Business & Strategy Consult is pleased to submit this formal proposal outlining our specialized corporate advisory and institutional restructuring services.

Our practice is grounded in delivering actionable, high-yield solutions designed to optimize organizational agility, eliminate operational friction, and position your enterprise for sustainable expansion across domestic and regional African markets.

PROPOSED ENGAGEMENT PILLARS:
1. Operational & Workflow Audit: In-depth diagnostic assessment of current institutional processes, resource allocation, and departmental productivity bottlenecks.
2. Strategic Growth Roadmap: Formulation of an actionable 3-year strategic blueprint encompassing revenue diversification, digital integration, and risk mitigation.
3. Executive Leadership & Governance Advisory: Bespoke capacity building, key performance indicator (KPI) architecture, and compliance alignment.
4. Implementation Oversight: Hands-on steering committee participation to ensure milestones are executed with measurable ROI.

All information shared between our respective organizations during this assignment shall be governed by strict non-disclosure obligations. We welcome the opportunity to formally inaugurate this advisory mandate upon your approval.`
        );
        toast.success('Corporate Advisory Proposal template applied!');
        break;
      }

      case 'visa_recommendation': {
        setLetterheadType('consult');
        setClassification('OFFICIAL CORRESPONDENCE');
        setReferenceNumber(generateReferenceNumber('consult'));
        setValediction('Yours faithfully,');
        setSalutation('To: The Consular Officer,');
        setSubject('OFFICIAL LETTER OF RECOMMENDATION & SPONSORSHIP GUARANTEE FOR VISA APPLICATION');
        setBody(
`This official letter is submitted by the Executive Management of Grefas Consult & Entertainment Limited in formal support of the visa application for the applicant named herein.

Grefas Consult & Entertainment Limited is a duly incorporated Ghanaian corporate entity operating in full compliance with the laws of the Republic of Ghana. We confirm that the applicant has maintained an exemplary professional relationship with our firm and has been selected to represent our organization on an international assignment.

We hereby verify and certify the following details:
1. PURPOSE OF TRAVEL: Attending scheduled professional conferences, international creative exhibitions, and business negotiations aligned with our corporate development objectives.
2. DURATION OF STAY: Temporary official visit with definite return itinerary strictly adhering to consular stipulations.
3. FINANCIAL RESPONSIBILITY: All return travel fares, comprehensive travel insurance, hotel accommodations, and daily living allowances throughout the duration of the visit are fully covered and guaranteed by Grefas Consult & Entertainment Limited.
4. REPATRIATION UNDERTAKING: Grefas Consult & Entertainment Limited unconditionally guarantees that the applicant will return to Ghana immediately upon conclusion of the approved travel itinerary to resume their executive responsibilities.

We respectfully urge your office to grant favorable consideration to this visa application. We remain at your disposal for any further verification.`
        );
        toast.success('Visa Recommendation & Guarantee template applied!');
        break;
      }

      case 'location_permit': {
        setLetterheadType('entertainment');
        setClassification('OFFICIAL CORRESPONDENCE');
        setReferenceNumber(generateReferenceNumber('entertainment'));
        setValediction('Yours faithfully,');
        setSalutation('Dear Sir/Madam,');
        setSubject('FORMAL APPLICATION FOR LOCATION FILMING PERMIT & MUNICIPAL PROTOCOL CLEARANCE');
        setBody(
`We write on behalf of the Production Directorate of Grefas Entertainment & Productions Limited to formally apply for permission to carry out closed-set location filming within your jurisdiction and premises.

Our production crew is currently in principal photography for an upcoming feature film and television project highlighting Ghanaian culture, youth entrepreneurship, and social development.

FILMING PROTOCOL SPECIFICATIONS:
1. SCHEDULE & TIMING: Proposed shoot dates and daily call times will be strictly regulated to prevent disruption of public commerce or vehicular flow.
2. CREW COMPLEMENT & EQUIPMENT: Professional cast and certified technical crew equipped with quiet silent-run generators, lightweight lighting fixtures, and calibrated camera stabilizers.
3. SAFETY & ENVIRONMENTAL CARE: An active safety officer and first-aid marshal will be stationed on site. All filming zones will be thoroughly cleaned, secured, and returned to original pristine condition immediately following each shoot session.
4. INDEMNITY: Grefas Entertainment maintains comprehensive production liability coverage and agrees to hold your office harmless against any incidental loss or damage.

We respectfully request your approval to proceed with production scouting and filming. Our Production Coordinator is available to coordinate directly with your designated security and protocol officers.`
        );
        toast.success('Location Filming Permit template applied!');
        break;
      }

      case 'contract_completion': {
        setLetterheadType('joint');
        setClassification('OFFICIAL CORRESPONDENCE');
        setReferenceNumber(generateReferenceNumber('joint'));
        setValediction('Yours sincerely,');
        setSalutation(`Dear ${cleanName},`);
        setSubject('CERTIFICATE OF COMMENDATION & FORMAL COMPLETION OF CONTRACTUAL SERVICES');
        setBody(
`The Executive Board and Management of Grefas Consult & Entertainment Limited are pleased to present this official Certificate of Commendation and Letter of Completion in recognition of the successful fulfillment of your contractual engagement.

Throughout the duration of your assignment, you have demonstrated exceptional professionalism, creative vigor, and unwavering dedication to the corporate vision of Grefas. All milestone deliverables, reporting obligations, and production commitments have been executed to our complete and unqualified satisfaction.

We confirm that all contractual financial accounts, milestone disbursements, and statutory obligations relating to this engagement have been settled in full, with no outstanding liabilities between both parties.

We take this opportunity to convey our profound gratitude for your exemplary contribution. Grefas Consult & Entertainment Limited holds your professional capabilities in high esteem and will unhesitatingly recommend your services for future collaborative opportunities within Ghana and across international jurisdictions.`
        );
        toast.success('Commendation & Contract Completion template applied!');
        break;
      }

      default:
        break;
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

    const cleanWebsite = (settings.website || 'grefasconsultandentertainment.com')
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .replace(/\/$/, '');

    const logoHtml = settings.logoUrl 
      ? `<img src="${settings.logoUrl}" class="letterhead-logo" alt="Grefas Logo" referrerPolicy="no-referrer" />`
      : `<div class="letterhead-logo-placeholder">GREFAS</div>`;

    const watermarkHtml = (letter.watermarkEnabled && settings.logoUrl)
      ? `<img src="${settings.logoUrl}" class="watermark" style="opacity: ${letter.watermarkOpacity || 0.05};" alt="Watermark Logo" referrerPolicy="no-referrer" />`
      : '';

    const formattedDate = new Date(letter.date || new Date()).toLocaleDateString('en-GB', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });

    const refNum = letter.referenceNumber || `GREFAS/GEN/${new Date().getFullYear()}/${letter.id.substring(0, 5).toUpperCase()}`;
    const classificationTag = letter.classification || 'OFFICIAL CORRESPONDENCE';
    const valedictionText = letter.valediction || 'Yours faithfully,';

    // Convert newlines in letter body to paragraph elements
    const formattedBody = letter.body
      .split('\n\n')
      .map(p => p.trim())
      .filter(p => p.length > 0)
      .map(p => `<p class="body-p">${p.replace(/\n/g, '<br/>')}</p>`)
      .join('');

    // Authentic Circular Corporate Seal SVG
    const corporateSealHtml = letter.showSeal !== false ? `
      <div class="official-seal-box">
        <svg viewBox="0 0 160 160" width="130" height="130" xmlns="http://www.w3.org/2000/svg">
          <circle cx="80" cy="80" r="75" fill="none" stroke="#991b1b" stroke-width="3" />
          <circle cx="80" cy="80" r="70" fill="none" stroke="#991b1b" stroke-width="1.2" stroke-dasharray="4 2" />
          <circle cx="80" cy="80" r="48" fill="none" stroke="#991b1b" stroke-width="1.8" />
          <circle cx="80" cy="80" r="45" fill="#fef2f2" fill-opacity="0.4" />
          
          <defs>
            <path id="seal-text-top" d="M 22,80 A 58,58 0 0,1 138,80" fill="none" />
            <path id="seal-text-bot" d="M 138,80 A 58,58 0 0,1 22,80" fill="none" />
          </defs>
          
          <text fill="#991b1b" font-size="7.8" font-weight="900" letter-spacing="1.2" font-family="'Times New Roman', serif">
            <textPath href="#seal-text-top" startOffset="50%" text-anchor="middle">
              ★ GREFAS CONSULT &amp; ENTERTAINMENT ★
            </textPath>
          </text>
          
          <text fill="#991b1b" font-size="6.8" font-weight="bold" letter-spacing="1.1" font-family="'Times New Roman', serif">
            <textPath href="#seal-text-bot" startOffset="50%" text-anchor="middle">
              OFFICIAL CORPORATE SEAL • GHANA
            </textPath>
          </text>
          
          <g transform="translate(80, 80)">
            <polygon points="0,-14 4,-4 14,-4 6,3 9,13 0,7 -9,13 -6,3 -14,-4 -4,-4" fill="#991b1b" />
            <text y="21" text-anchor="middle" fill="#991b1b" font-size="8" font-weight="bold" font-family="Arial, sans-serif" letter-spacing="0.8">
              VERIFIED
            </text>
            <text y="28" text-anchor="middle" fill="#991b1b" font-size="6" font-family="Arial, sans-serif" font-weight="600">
              INCORP. 2024
            </text>
          </g>
        </svg>
      </div>
    ` : '';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Grefas Official Letter - ${letter.subject}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 18mm 16mm 18mm 16mm;
            }
            * {
              box-sizing: border-box;
            }
            body {
              font-family: "Times New Roman", Times, Georgia, "Liberation Serif", serif;
              color: #111827;
              background-color: #ffffff;
              line-height: 1.65;
              font-size: 11pt;
              margin: 0;
              padding: 0;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .letter-container {
              position: relative;
              min-height: 100%;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
            }
            
            /* Stately Executive Dual-Rule Letterhead */
            .letterhead-top-accent {
              height: 4px;
              background: linear-gradient(90deg, #c2410c 0%, #ea580c 60%, #d97706 100%);
              margin-bottom: 2px;
            }
            .letterhead-sub-accent {
              height: 1px;
              background: #d97706;
              margin-bottom: 12px;
            }
            .letterhead {
              display: flex;
              align-items: center;
              justify-content: space-between;
              padding-bottom: 14px;
              border-bottom: 2px solid #1f2937;
              margin-bottom: 20px;
            }
            .letterhead-left {
              display: flex;
              align-items: center;
              gap: 14px;
            }
            .letterhead-logo {
              max-height: 82px;
              max-width: 140px;
              object-fit: contain;
            }
            .letterhead-logo-placeholder {
              font-size: 24px;
              font-weight: 900;
              color: #c2410c;
              border: 3px double #c2410c;
              padding: 6px 14px;
              letter-spacing: 3px;
              font-family: Arial, sans-serif;
            }
            .letterhead-info {
              text-align: right;
              max-width: 65%;
            }
            .company-name {
              font-family: "Times New Roman", Times, Georgia, serif;
              font-size: 15.5pt;
              font-weight: 900;
              color: #111827;
              margin: 0 0 2px 0;
              letter-spacing: 0.5px;
              text-transform: uppercase;
            }
            .company-subtitle {
              font-family: Arial, -apple-system, BlinkMacSystemFont, sans-serif;
              font-size: 7.5pt;
              color: #c2410c;
              margin: 0 0 5px 0;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
            .company-reg-line {
              font-family: Arial, sans-serif;
              font-size: 7.5pt;
              color: #4b5563;
              font-weight: 600;
              margin: 0 0 3px 0;
            }
            .company-contact {
              font-family: Arial, -apple-system, BlinkMacSystemFont, sans-serif;
              font-size: 7.5pt;
              color: #4b5563;
              margin: 0;
              line-height: 1.35;
            }
            .company-web-link {
              color: #c2410c;
              font-weight: 700;
              text-decoration: none;
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
              width: 440px;
              height: auto;
              max-height: 440px;
              object-fit: contain;
              transform: rotate(-18deg);
              filter: grayscale(100%);
            }

            /* Reference & Classification Bar */
            .reference-strip {
              display: flex;
              justify-content: space-between;
              align-items: center;
              background-color: #f9fafb;
              border: 1px solid #e5e7eb;
              padding: 5px 12px;
              margin-bottom: 22px;
              font-family: Arial, sans-serif;
              font-size: 8.5pt;
              color: #374151;
            }
            .ref-tag {
              font-weight: 700;
              color: #111827;
            }
            .classification-pill {
              font-size: 7.5pt;
              font-weight: 900;
              letter-spacing: 1.5px;
              padding: 2px 8px;
              border: 1px solid #c2410c;
              color: #c2410c;
              text-transform: uppercase;
              border-radius: 2px;
            }

            /* Recipient & Meta Section */
            .letter-meta {
              display: flex;
              justify-content: space-between;
              margin-bottom: 24px;
              font-size: 11pt;
            }
            .recipient-block {
              max-width: 60%;
            }
            .recipient-salute-to {
              font-size: 9pt;
              font-weight: 700;
              text-transform: uppercase;
              color: #6b7280;
              margin: 0 0 4px 0;
              font-family: Arial, sans-serif;
              letter-spacing: 0.5px;
            }
            .recipient-name {
              font-size: 11.5pt;
              font-weight: 800;
              color: #111827;
              margin: 0 0 2px 0;
            }
            .recipient-designation {
              font-size: 10pt;
              font-weight: 600;
              color: #374151;
              margin: 0 0 2px 0;
            }
            .recipient-company {
              font-size: 10pt;
              font-weight: 700;
              color: #1f2937;
              margin: 0 0 4px 0;
            }
            .recipient-address {
              white-space: pre-line;
              margin: 0;
              color: #374151;
              font-size: 10pt;
              line-height: 1.4;
            }
            .date-block {
              text-align: right;
              font-family: "Times New Roman", Times, serif;
              font-size: 10.5pt;
            }

            /* Formal Subject Header */
            .subject-container {
              margin-bottom: 22px;
            }
            .subject-line {
              font-size: 11.5pt;
              font-weight: 900;
              text-transform: uppercase;
              text-align: center;
              padding: 6px 12px;
              border-top: 1.5px solid #111827;
              border-bottom: 1.5px solid #111827;
              letter-spacing: 0.8px;
              color: #111827;
            }

            /* Salutation */
            .salutation {
              font-size: 11pt;
              font-weight: 700;
              margin-bottom: 14px;
            }

            /* Body paragraphs */
            .letter-body {
              text-align: justify;
              margin-bottom: 30px;
              font-size: 11pt;
            }
            .body-p {
              text-indent: 32px;
              margin: 0 0 14px 0;
              line-height: 1.65;
            }

            /* Sign-off & Seal section */
            .sign-off-section {
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
              margin-top: 25px;
              page-break-inside: avoid;
            }
            .sign-off-block {
              font-size: 11pt;
              min-width: 250px;
            }
            .sign-off-valediction {
              margin-bottom: 15px;
              font-weight: 600;
            }
            .signature-space {
              min-height: 55px;
              display: flex;
              align-items: center;
            }
            .signature-img {
              max-height: 55px;
              max-width: 170px;
              object-fit: contain;
              margin: 4px 0;
            }
            .signatory-name {
              font-weight: 800;
              font-size: 11pt;
              margin: 0;
              color: #111827;
            }
            .signatory-title {
              color: #4b5563;
              margin: 2px 0 0 0;
              font-size: 9.5pt;
              font-weight: 600;
            }
            .signatory-company {
              font-size: 8.5pt;
              color: #6b7280;
              margin: 1px 0 0 0;
              font-family: Arial, sans-serif;
            }
            .official-seal-box {
              text-align: center;
              padding-right: 15px;
            }

            /* Footer & Security Verification Notice */
            .letter-footer {
              margin-top: 35px;
              border-top: 1px solid #d1d5db;
              padding-top: 8px;
              font-size: 7.2pt;
              color: #6b7280;
              font-family: Arial, sans-serif;
              page-break-inside: avoid;
            }
            .footer-security-row {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 4px;
              font-weight: 700;
              color: #374151;
            }
            .security-hash {
              font-family: "Courier New", monospace;
              letter-spacing: 0.5px;
            }
            .footer-disclaimer {
              text-align: center;
              line-height: 1.3;
              color: #9ca3af;
            }
          </style>
        </head>
        <body>
          <div class="letter-container">
            <div>
              <!-- Watermark Background -->
              <div class="watermark-container">
                ${watermarkHtml}
              </div>

              <!-- Top Accent Bars -->
              <div class="letterhead-top-accent"></div>
              <div class="letterhead-sub-accent"></div>

              <!-- Letterhead Header -->
              <div class="letterhead">
                <div class="letterhead-left">
                  ${logoHtml}
                </div>
                <div class="letterhead-info">
                  <h1 class="company-name">${headerTitle}</h1>
                  <p class="company-subtitle">${headerSubtitle}</p>
                  <p class="company-reg-line">${settings.registrationNumber || 'Reg. No: CS-289412024 • TIN: C0048192837'}</p>
                  <p class="company-contact">
                    ${settings.address} • ${settings.officeGps || 'GPS: AI-0008-9223'}<br/>
                    Phone: ${settings.phone} • Email: ${settings.email}<br/>
                    Official Web Portal: <a href="https://www.${cleanWebsite}" class="company-web-link">www.${cleanWebsite}</a>
                  </p>
                </div>
              </div>

              <!-- Reference & Classification Strip -->
              <div class="reference-strip">
                <div><strong>Our Ref:</strong> <span class="ref-tag">${refNum}</span></div>
                <div class="classification-pill">${classificationTag}</div>
                <div><strong>Date:</strong> ${formattedDate}</div>
              </div>

              <!-- Recipient Metadata -->
              <div class="letter-meta">
                <div class="recipient-block">
                  <p class="recipient-salute-to">TO:</p>
                  <h2 class="recipient-name">${letter.recipientName}</h2>
                  ${letter.recipientDesignation ? `<p class="recipient-designation">${letter.recipientDesignation}</p>` : ''}
                  ${letter.recipientCompany ? `<p class="recipient-company">${letter.recipientCompany}</p>` : ''}
                  <p class="recipient-address">${letter.recipientAddress || 'Address on file'}</p>
                </div>
                <div class="date-block">
                  <strong>Effective Date:</strong><br/>
                  ${formattedDate}
                </div>
              </div>

              <!-- Subject Header -->
              <div class="subject-container">
                <div class="subject-line">
                  RE: ${letter.subject.toUpperCase()}
                </div>
              </div>

              <!-- Salutation -->
              <div class="salutation">
                ${letter.salutation}
              </div>

              <!-- Body Paragraphs -->
              <div class="letter-body">
                ${formattedBody}
              </div>

              <!-- Sign-off & Corporate Seal -->
              <div class="sign-off-section">
                <div class="sign-off-block">
                  <div class="sign-off-valediction">${valedictionText}</div>
                  <div class="signature-space">
                    ${letter.signatorySignature ? `<img src="${letter.signatorySignature}" class="signature-img" alt="Digital Signature" />` : ''}
                  </div>
                  <p class="signatory-name">${letter.signatoryName}</p>
                  <p class="signatory-title">${letter.signatoryTitle}</p>
                  <p class="signatory-company">For: Grefas Consult &amp; Entertainment Limited</p>
                </div>

                ${corporateSealHtml}
              </div>
            </div>

            <!-- Security Verification Footer -->
            <div class="letter-footer">
              <div class="footer-security-row">
                <span class="security-hash">DOC-ID: ${refNum.replace(/[^a-zA-Z0-9]/g, '')}</span>
                <span>AUTHENTICITY VERIFIABLE AT WWW.${cleanWebsite.toUpperCase()}/VERIFY-LETTER</span>
                <span>ORIGINAL CORPORATE INSTRUMENT</span>
              </div>
              <div class="footer-disclaimer">
                This document is an authentic corporate correspondence issued under the authority of Grefas Consult &amp; Entertainment Limited. Any unauthorized alteration, erasure, or duplication renders this instrument null and void.
              </div>
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
                if (loadedCount >= totalImages) {
                  setTimeout(function() { window.print(); }, 400);
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
    toast.success('Executive official letter layout rendered! Printing window triggered.');
  };

  const updateLetterContactInfo = async (letterId: string, phone: string, email: string) => {
    if (!letterId || letterId === 'draft') return;
    try {
      await updateDoc(doc(db, 'letters', letterId), {
        recipientPhone: phone,
        recipientEmail: email,
        updatedAt: serverTimestamp()
      });
      setSelectedLetterForSend(prev => prev ? { ...prev, recipientPhone: phone, recipientEmail: email } : null);
    } catch (err) {
      console.error("Failed to update letter contacts in db:", err);
    }
  };

  const handleSendOfficialEmail = async (letter: Letter, customEmail?: string) => {
    const emailToUse = customEmail !== undefined ? customEmail : letter.recipientEmail;
    if (!emailToUse?.trim()) {
      toast.error("Please provide a recipient email address.");
      return;
    }

    setIsSendingEmail(true);
    try {
      const response = await fetch('/api/letters/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientEmail: emailToUse.trim(),
          recipientName: letter.recipientName,
          recipientDesignation: letter.recipientDesignation,
          recipientCompany: letter.recipientCompany,
          recipientAddress: letter.recipientAddress,
          date: letter.date,
          referenceNumber: letter.referenceNumber || generateReferenceNumber(letter.letterheadType),
          classification: letter.classification || 'OFFICIAL CORRESPONDENCE',
          subject: letter.subject,
          salutation: letter.salutation,
          body: letter.body,
          valediction: letter.valediction || 'Yours faithfully,',
          signatoryName: letter.signatoryName,
          signatoryTitle: letter.signatoryTitle,
          letterheadType: letter.letterheadType,
          logoUrl: settings.logoUrl,
          settings: {
            ...settings,
            website: settings.website || 'grefasconsultandentertainment.com'
          }
        })
      });

      const rawText = await response.text();
      let resData: any = null;
      if (rawText && !rawText.trimStart().startsWith('<')) {
        try {
          resData = JSON.parse(rawText);
        } catch {
          resData = null;
        }
      }

      if (!response.ok || !resData) {
        throw new Error(resData?.error || `Server returned ${response.status}`);
      }

      toast.success(`Official branded executive email successfully sent to ${emailToUse.trim()}!`);
      
      if (letter.id && letter.id !== 'draft' && emailToUse !== letter.recipientEmail) {
        await updateLetterContactInfo(letter.id, letter.recipientPhone || '', emailToUse);
      }
    } catch (err: any) {
      toast.error(`Email Dispatch Failed: ${err.message}`);
      console.error("Direct email dispatch failed:", err);
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleSendWhatsApp = (letter: Letter, customPhone?: string) => {
    const phoneToUse = customPhone !== undefined ? customPhone : letter.recipientPhone;
    if (!phoneToUse?.trim()) {
      toast.error("Please provide a recipient phone number.");
      return;
    }

    if (letter.id && letter.id !== 'draft' && phoneToUse !== letter.recipientPhone) {
      updateLetterContactInfo(letter.id, phoneToUse, letter.recipientEmail || '');
    }

    const cleanPhone = phoneToUse.replace(/[^0-9]/g, '');
    const textBody = letter.body.split('\n\n').map(p => p.trim()).filter(p => p.length > 0).join('\n\n');

    let headerTitle = "GREFAS ENTERTAINMENT & CONSULT";
    if (letter.letterheadType === 'entertainment') {
      headerTitle = settings.letterheadEntTitle || "GREFAS ENTERTAINMENT & PRODUCTIONS";
    } else if (letter.letterheadType === 'consult') {
      headerTitle = settings.letterheadConsultTitle || "GREFAS BUSINESS & STRATEGY CONSULT";
    }

    const cleanWebsite = (settings.website || 'grefasconsultandentertainment.com').replace(/^https?:\/\//, '').replace(/^www\./, '');
    const refNum = letter.referenceNumber || generateReferenceNumber(letter.letterheadType);

    const messageText = `*${headerTitle.toUpperCase()}*
Official Executive Correspondence
${settings.registrationNumber || 'Reg. No: CS-289412024 • TIN: C0048192837'}
Website: https://www.${cleanWebsite}

*Our Ref:* ${refNum}
*Classification:* [${letter.classification || 'OFFICIAL CORRESPONDENCE'}]
*Date:* ${new Date(letter.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}

*TO:* ${letter.recipientName}
${letter.recipientDesignation ? `*Designation:* ${letter.recipientDesignation}` : ''}
${letter.recipientCompany ? `*Organization:* ${letter.recipientCompany}` : ''}
${letter.recipientAddress ? `*Address:* ${letter.recipientAddress.replace(/\n/g, ', ')}` : ''}

*SUBJECT: RE: ${letter.subject.toUpperCase()}*

${letter.salutation || 'Dear Sir/Madam,'}

${textBody}

${letter.valediction || 'Yours faithfully,'}
*${letter.signatoryName}*
${letter.signatoryTitle}
For: Grefas Consult & Entertainment Limited`;

    const whatsappUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(messageText)}`;
    window.open(whatsappUrl, '_blank');
    toast.success('Opening WhatsApp Web/App with formatted executive letter!');
  };

  const handleCopyLetterToClipboard = (letter: Letter) => {
    const textBody = letter.body.split('\n\n').map(p => p.trim()).filter(p => p.length > 0).join('\n\n');

    let headerTitle = "GREFAS ENTERTAINMENT & CONSULT";
    if (letter.letterheadType === 'entertainment') {
      headerTitle = settings.letterheadEntTitle || "GREFAS ENTERTAINMENT & PRODUCTIONS";
    } else if (letter.letterheadType === 'consult') {
      headerTitle = settings.letterheadConsultTitle || "GREFAS BUSINESS & STRATEGY CONSULT";
    }

    const cleanWebsite = (settings.website || 'grefasconsultandentertainment.com').replace(/^https?:\/\//, '').replace(/^www\./, '');
    const refNum = letter.referenceNumber || generateReferenceNumber(letter.letterheadType);

    const messageText = `${headerTitle.toUpperCase()}
Official Executive Correspondence
${settings.registrationNumber || 'Reg. No: CS-289412024 • TIN: C0048192837'}
Official Web Portal: https://www.${cleanWebsite}

Our Ref: ${refNum}
Classification: [${letter.classification || 'OFFICIAL CORRESPONDENCE'}]
Date: ${new Date(letter.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}

TO: ${letter.recipientName}
${letter.recipientDesignation ? `Designation: ${letter.recipientDesignation}` : ''}
${letter.recipientCompany ? `Organization: ${letter.recipientCompany}` : ''}
${letter.recipientAddress ? `Address: ${letter.recipientAddress.replace(/\n/g, ', ')}` : ''}

SUBJECT: RE: ${letter.subject.toUpperCase()}

${letter.salutation || 'Dear Sir/Madam,'}

${textBody}

${letter.valediction || 'Yours faithfully,'}
${letter.signatoryName}
${letter.signatoryTitle}
For: Grefas Consult & Entertainment Limited`;

    navigator.clipboard.writeText(messageText);
    toast.success('Executive letter plain text copied to clipboard!');
  };

  const filteredLetters = letters.filter(letter => {
    const matchesSearch = 
      letter.recipientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      letter.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (letter.referenceNumber && letter.referenceNumber.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesFilter = filterType === 'all' || letter.recipientType === filterType;
    return matchesSearch && matchesFilter;
  });

  const cleanWebsiteDisplay = (settings.website || 'grefasconsultandentertainment.com').replace(/^https?:\/\//, '').replace(/^www\./, '');

  return (
    <div className="space-y-6">
      {/* Header section with tab selectors and Corporate Identity Trigger */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card p-5 rounded-xl border border-border">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <FileText className="h-6 w-6 text-orange-600" /> Official Business Letters &amp; Executive Instruments
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Compose, dispatch, and print formal Ghanaian corporate correspondence on <span className="font-semibold text-orange-600 dark:text-orange-400">{cleanWebsiteDisplay}</span> letterhead with official seal.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <Button
            id="btn-open-letterhead-settings"
            variant="outline"
            onClick={() => {
              setTempSettings({ ...settings });
              setSettingsModalOpen(true);
            }}
            className="text-xs font-bold border-border/80 text-foreground hover:bg-muted flex items-center gap-1.5"
            title="Edit Website, TIN, Address & Letterhead Titles"
          >
            <Globe className="h-3.5 w-3.5 text-orange-600" /> Letterhead &amp; Website
          </Button>

          <Button
            id="btn-tab-list"
            variant={activeTab === 'list' ? 'default' : 'outline'}
            onClick={() => setActiveTab('list')}
            className={`flex-1 md:flex-none text-xs font-bold uppercase tracking-wider px-4 ${
              activeTab === 'list' ? 'bg-orange-600 hover:bg-orange-700 text-white' : ''
            }`}
          >
            Letters Directory ({letters.length})
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
                placeholder="Search letters by recipient, subject, or reference number..."
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
                className="bg-card border border-border rounded-lg px-3 text-xs h-9 text-muted-foreground font-medium"
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
                    onClick={handleComposeTabClick}
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
                      <th className="p-4 w-36">Classification</th>
                      <th className="p-4 w-40 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredLetters.map((letter) => (
                      <tr key={letter.id} className="hover:bg-muted/15 transition-all">
                        <td className="p-4">
                          <p className="text-xs font-bold text-foreground">
                            {new Date(letter.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                          <p className="text-[10px] text-orange-600 font-mono font-bold mt-0.5">
                            {letter.referenceNumber || `Ref: ${letter.id.substring(0, 8).toUpperCase()}`}
                          </p>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            {letter.recipientType === 'organisation' && <Building2 className="h-3.5 w-3.5 text-blue-500 shrink-0" />}
                            {letter.recipientType === 'individual' && <User className="h-3.5 w-3.5 text-green-500 shrink-0" />}
                            {letter.recipientType === 'institution' && <School className="h-3.5 w-3.5 text-purple-500 shrink-0" />}
                            <span className="text-xs font-black text-foreground">{letter.recipientName}</span>
                          </div>
                          {(letter.recipientDesignation || letter.recipientCompany) && (
                            <p className="text-[10px] text-muted-foreground font-medium mt-0.5">
                              {[letter.recipientDesignation, letter.recipientCompany].filter(Boolean).join(' • ')}
                            </p>
                          )}
                          {letter.recipientAddress && (
                            <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-xs">{letter.recipientAddress}</p>
                          )}
                        </td>
                        <td className="p-4">
                          <p className="text-xs font-semibold text-foreground line-clamp-1">{letter.subject}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Signatory: {letter.signatoryName} ({letter.signatoryTitle})
                          </p>
                        </td>
                        <td className="p-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300 border border-orange-200/50">
                            {letter.classification || 'OFFICIAL'}
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
                              title="Print / Save PDF (with Official Seal)"
                              onClick={() => triggerSafePrint(letter)}
                              className="h-8 w-8 text-orange-600 hover:text-orange-700 hover:bg-orange-50 border-orange-200"
                            >
                              <Printer className="h-4 w-4" />
                            </Button>
                            <Button
                              id={`btn-dispatch-${letter.id}`}
                              size="icon"
                              variant="outline"
                              title="Direct Dispatch (Email/WhatsApp)"
                              onClick={() => {
                                setSelectedLetterForSend(letter);
                                setSendModalOpen(true);
                              }}
                              className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200"
                            >
                              <Send className="h-4 w-4" />
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

            {/* 6 Executive Templates Selector */}
            <Card className="border border-orange-200 bg-linear-to-r from-orange-50/20 via-background to-amber-50/20 dark:from-orange-950/10 dark:to-amber-950/10">
              <CardHeader className="pb-3 border-b border-orange-100 dark:border-orange-900/30">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                    <Award className="h-4.5 w-4.5 text-orange-600" /> Executive Diplomatic Templates (One-Click)
                  </CardTitle>
                  <span className="text-[10px] bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 font-bold px-2 py-0.5 rounded-full">
                    Formal Ghanaian Corporate Standards
                  </span>
                </div>
                <CardDescription className="text-xs">
                  Instantly load professionally drafted, legally sound letters with appropriate classifications and corporate structures.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => applyExecutiveTemplate('artiste_contract')}
                    className="text-left justify-start text-[10px] font-bold h-auto py-2 px-2.5 border-orange-200/80 hover:bg-orange-50 hover:text-orange-700 dark:hover:bg-orange-950/50 flex flex-col items-start gap-0.5"
                  >
                    <span className="flex items-center gap-1 text-orange-600"><FileSignature className="h-3 w-3" /> Artiste Contract</span>
                    <span className="text-[9px] text-muted-foreground font-normal">Engagement &amp; Rights</span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => applyExecutiveTemplate('sponsorship')}
                    className="text-left justify-start text-[10px] font-bold h-auto py-2 px-2.5 border-orange-200/80 hover:bg-orange-50 hover:text-orange-700 dark:hover:bg-orange-950/50 flex flex-col items-start gap-0.5"
                  >
                    <span className="flex items-center gap-1 text-orange-600"><Building2 className="h-3 w-3" /> Corporate Sponsorship</span>
                    <span className="text-[9px] text-muted-foreground font-normal">Partnership Solicitation</span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => applyExecutiveTemplate('corporate_advisory')}
                    className="text-left justify-start text-[10px] font-bold h-auto py-2 px-2.5 border-orange-200/80 hover:bg-orange-50 hover:text-orange-700 dark:hover:bg-orange-950/50 flex flex-col items-start gap-0.5"
                  >
                    <span className="flex items-center gap-1 text-orange-600"><Sliders className="h-3 w-3" /> Strategic Advisory</span>
                    <span className="text-[9px] text-muted-foreground font-normal">Executive Proposal</span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => applyExecutiveTemplate('visa_recommendation')}
                    className="text-left justify-start text-[10px] font-bold h-auto py-2 px-2.5 border-orange-200/80 hover:bg-orange-50 hover:text-orange-700 dark:hover:bg-orange-950/50 flex flex-col items-start gap-0.5"
                  >
                    <span className="flex items-center gap-1 text-orange-600"><ShieldCheck className="h-3 w-3" /> Visa &amp; Consular</span>
                    <span className="text-[9px] text-muted-foreground font-normal">Travel Endorsement</span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => applyExecutiveTemplate('location_permit')}
                    className="text-left justify-start text-[10px] font-bold h-auto py-2 px-2.5 border-orange-200/80 hover:bg-orange-50 hover:text-orange-700 dark:hover:bg-orange-950/50 flex flex-col items-start gap-0.5"
                  >
                    <span className="flex items-center gap-1 text-orange-600"><Building className="h-3 w-3" /> Filming Permit</span>
                    <span className="text-[9px] text-muted-foreground font-normal">Municipal Clearance</span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => applyExecutiveTemplate('contract_completion')}
                    className="text-left justify-start text-[10px] font-bold h-auto py-2 px-2.5 border-orange-200/80 hover:bg-orange-50 hover:text-orange-700 dark:hover:bg-orange-950/50 flex flex-col items-start gap-0.5"
                  >
                    <span className="flex items-center gap-1 text-orange-600"><Award className="h-3 w-3" /> Commendation</span>
                    <span className="text-[9px] text-muted-foreground font-normal">Contract Completion</span>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border">
              <CardHeader className="pb-4 border-b border-border bg-muted/10">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                  <FileText className="h-4.5 w-4.5 text-orange-600" /> Letter Metadata &amp; Corporate Classification
                </CardTitle>
                <CardDescription className="text-xs">
                  Fill in standard corporate correspondence details and reference tracking numbers.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                {/* Cast & Crew Fast-Track Integration */}
                <div className="bg-orange-50/5 dark:bg-orange-950/5 border border-orange-200/50 p-4 rounded-xl space-y-3.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-black uppercase tracking-wider text-orange-600 flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 animate-pulse text-orange-600" /> Cast &amp; Crew Talent Fast-Track
                    </p>
                    {castCrewList.length > 0 && (
                      <span className="text-[10px] bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 px-2 py-0.5 rounded-full font-bold">
                        {castCrewList.length} Active Talent Profiles
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
                        <option value="">-- Choose from registered talent roster --</option>
                        {castCrewList.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.fullName} ({member.roleType || 'Talent'})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Fast Engagement Dispatch</label>
                      <div className="flex gap-2">
                        <Button
                          id="btn-apply-cast-template"
                          type="button"
                          variant="outline"
                          disabled={!recipientName}
                          onClick={() => applyExecutiveTemplate('artiste_contract')}
                          className="flex-1 text-[10px] font-bold h-9 border-orange-200 hover:bg-orange-50 hover:text-orange-700 text-foreground"
                        >
                          Cast Contract
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
                            setLetterheadType('entertainment');
                            setClassification('CONTRACTUAL AGREEMENT');
                            setReferenceNumber(generateReferenceNumber('entertainment'));
                            setSubject(`OFFICIAL ENGAGEMENT & TECHNICAL APPOINTMENT: ${role.toUpperCase()}`);
                            setSalutation(`Dear ${recipientName.split(' ')[0] || 'Sir/Madam'},`);
                            setBody(
`This letter serves as an official offer of engagement by Grefas Entertainment & Productions for your professional technical and production services.

Based on your stellar technical expertise and professional portfolio, we are pleased to engage you as a vital member of our Production Staff in the role of ${role}, effective from the scheduled production start.

Your key deliverables will include:
1. Overseeing technical setups, gear inventory, and operational management of your assigned department (Camera, Sound, Lighting, Set Design, or Production Logistics).
2. Coordinating closely with the Director, Producer, and fellow crew members to ensure high-fidelity audio-visual output.
3. Ensuring proper maintenance, safety, and breakdown of all technical equipment on set.

In consideration for your technical services, Grefas Entertainment shall provide a competitive milestone stipend. All on-set meals, safety gear, and local transport during shoot timelines will be fully covered.

Please sign and return a duplicate of this engagement letter to our administration desk within seven (7) days to confirm your availability.`
                            );
                            toast.success("Crew Engagement Letter applied!");
                          }}
                          className="flex-1 text-[10px] font-bold h-9 border-orange-200 hover:bg-orange-50 hover:text-orange-700 text-foreground"
                        >
                          Crew Contract
                        </Button>
                      </div>
                    </div>
                  </div>
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
                      onChange={(e: any) => {
                        const newType = e.target.value;
                        setLetterheadType(newType);
                        if (!referenceNumber || referenceNumber.startsWith('GREFAS/')) {
                          setReferenceNumber(generateReferenceNumber(newType));
                        }
                      }}
                      className="w-full bg-muted/30 border border-border rounded-lg text-xs h-9 px-3 text-foreground font-medium focus:border-orange-500"
                    >
                      <option value="joint">Joint: Grefas Entertainment &amp; Consult</option>
                      <option value="entertainment">Grefas Entertainment &amp; Productions</option>
                      <option value="consult">Grefas Business &amp; Strategy Consult</option>
                    </select>
                  </div>
                </div>

                {/* Reference Number & Classification Strip inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 bg-muted/20 p-3 rounded-lg border border-border">
                  <div className="sm:col-span-5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-foreground flex items-center gap-1">
                        <Hash className="h-3 w-3 text-orange-600" /> Reference Number (Our Ref)
                      </label>
                      <button
                        type="button"
                        onClick={() => setReferenceNumber(generateReferenceNumber(letterheadType))}
                        className="text-[10px] text-orange-600 hover:underline font-semibold"
                      >
                        Regenerate
                      </button>
                    </div>
                    <Input
                      id="input-reference-number"
                      type="text"
                      placeholder="e.g. GREFAS/CON/2025/104"
                      value={referenceNumber}
                      onChange={(e) => setReferenceNumber(e.target.value)}
                      className="bg-background text-xs font-mono h-8"
                    />
                  </div>

                  <div className="sm:col-span-4 space-y-1.5">
                    <label className="text-[11px] font-bold text-foreground block">
                      Document Classification
                    </label>
                    <select
                      id="input-classification"
                      value={classification}
                      onChange={(e) => setClassification(e.target.value)}
                      className="w-full bg-background border border-border rounded-lg text-xs h-8 px-2 text-foreground font-semibold"
                    >
                      <option value="OFFICIAL CORRESPONDENCE">OFFICIAL CORRESPONDENCE</option>
                      <option value="CONFIDENTIAL">CONFIDENTIAL</option>
                      <option value="CONTRACTUAL AGREEMENT">CONTRACTUAL AGREEMENT</option>
                      <option value="EXECUTIVE DIRECTIVE">EXECUTIVE DIRECTIVE</option>
                      <option value="RECOMMENDATION">RECOMMENDATION</option>
                      <option value="URGENT DISPATCH">URGENT DISPATCH</option>
                    </select>
                  </div>

                  <div className="sm:col-span-3 space-y-1.5">
                    <label className="text-[11px] font-bold text-foreground block">Official Date</label>
                    <Input
                      id="input-letter-date"
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="bg-background text-xs h-8"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-foreground block">Recipient Name / Contact Person *</label>
                    <Input
                      id="input-recipient-name"
                      type="text"
                      placeholder="e.g. Dr. Kwame Mensah / The Managing Director"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      className="bg-muted/30 text-xs h-9"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-foreground block">Recipient Designation / Title</label>
                    <Input
                      id="input-recipient-designation"
                      type="text"
                      placeholder="e.g. Head of Consular Affairs / Chief Executive Officer"
                      value={recipientDesignation}
                      onChange={(e) => setRecipientDesignation(e.target.value)}
                      className="bg-muted/30 text-xs h-9"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-foreground block">Company / Ministry / Institution</label>
                    <Input
                      id="input-recipient-company"
                      type="text"
                      placeholder="e.g. Ministry of Tourism, Arts and Culture / Multimedia Group"
                      value={recipientCompany}
                      onChange={(e) => setRecipientCompany(e.target.value)}
                      className="bg-muted/30 text-xs h-9"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-foreground block">Full Postal / Physical Address</label>
                    <Input
                      id="input-recipient-address"
                      placeholder="e.g. P.O. Box GP 1234, Ministries Post Office, Accra, Ghana"
                      value={recipientAddress}
                      onChange={(e) => setRecipientAddress(e.target.value)}
                      className="bg-muted/30 text-xs h-9"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-foreground block">WhatsApp Phone Number</label>
                    <Input
                      id="input-recipient-phone"
                      type="text"
                      placeholder="e.g. +233244123456"
                      value={recipientPhone}
                      onChange={(e) => setRecipientPhone(e.target.value)}
                      className="bg-muted/30 text-xs h-9"
                    />
                    <p className="text-[10px] text-muted-foreground">For direct WhatsApp dispatch. Include country code (e.g. +233).</p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-foreground block">Recipient Email Address</label>
                    <Input
                      id="input-recipient-email"
                      type="email"
                      placeholder="e.g. recipient@organization.gov.gh"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      className="bg-muted/30 text-xs h-9"
                    />
                    <p className="text-[10px] text-muted-foreground">For official branded letter email dispatch.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2 space-y-2">
                    <label className="text-xs font-bold text-foreground block">Letter Subject (RE:) *</label>
                    <Input
                      id="input-letter-subject"
                      type="text"
                      placeholder="e.g. REQUEST FOR OFFICIAL AUDIENCE & CORPORATE SPONSORSHIP"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="bg-muted/30 text-xs h-9 font-medium"
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
                  <Sparkles className="h-4.5 w-4.5" /> Grefas AI Diplomatic Drafter
                </CardTitle>
                <CardDescription className="text-xs">
                  Generate authoritative Ghanaian executive and British English business letters using Grefas AI.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-foreground block">Briefly state what this official letter should articulate</label>
                  <Textarea
                    id="input-ai-prompt"
                    placeholder="e.g., Formal application to the Municipal Chief Executive for location filming approval at the central heritage market next month. Confirm adherence to sanitation, safety, and no trade interruption."
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    className="bg-background text-xs min-h-[60px]"
                  />
                </div>
                <div className="flex flex-col sm:flex-row gap-3 items-end justify-between">
                  <div className="w-full sm:w-1/2 space-y-1.5">
                    <label className="text-[11px] font-semibold text-muted-foreground">Diplomatic Tone</label>
                    <select
                      id="input-ai-tone"
                      value={aiTone}
                      onChange={(e) => setAiTone(e.target.value)}
                      className="w-full bg-background border border-border rounded-lg text-xs h-8 px-2 text-foreground font-medium"
                    >
                      <option value="Professional, formal, and authoritative">Formal Corporate &amp; Authoritative</option>
                      <option value="Diplomatic, stately, and deferential">Diplomatic &amp; Stately</option>
                      <option value="Warm, inviting, and collaborative">Warm &amp; Collaborative</option>
                      <option value="Persuasive, sales-oriented, and convincing">Persuasive / Partnership Pitch</option>
                      <option value="Strict, final, and contractual directive">Strict Contractual Notice</option>
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
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Drafting Executive Letter...
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
                  Review or draft the main body of your letter. Press Enter twice to create structured paragraph indents.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <Textarea
                  id="input-letter-body"
                  placeholder="Type your official letter contents here. Press Enter twice between paragraphs to maintain dignified indentation in printed copies..."
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="bg-muted/30 text-xs min-h-[240px] font-serif leading-relaxed text-foreground"
                  required
                />

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-foreground block">Formal Valediction</label>
                    <select
                      id="input-valediction"
                      value={valediction}
                      onChange={(e) => setValediction(e.target.value)}
                      className="w-full bg-muted/30 border border-border rounded-lg text-xs h-9 px-3 text-foreground font-medium"
                    >
                      <option value="Yours faithfully,">Yours faithfully, (Formal/Official)</option>
                      <option value="Yours sincerely,">Yours sincerely, (Addressed to Name)</option>
                      <option value="Respectfully yours,">Respectfully yours, (High Dignitary)</option>
                      <option value="With utmost regards,">With utmost regards,</option>
                    </select>
                  </div>

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

                {/* Signatory Digital Signature Section */}
                <div className="border border-border/80 rounded-xl p-4 bg-muted/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-foreground">Signatory Signature Option</p>
                      <p className="text-[10px] text-muted-foreground">Affix a hand-drawn or uploaded executive signature to this letter</p>
                    </div>
                  </div>

                  {/* Signature Mode Selector */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSignatureMode('draw')}
                      className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition duration-300 border flex items-center gap-1 cursor-pointer ${
                        signatureMode === 'draw'
                          ? 'bg-orange-600 border-orange-600 text-white shadow-xs'
                          : 'bg-card border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      <PenTool className="h-3 w-3" /> Draw Signature
                    </button>
                    <button
                      type="button"
                      onClick={() => setSignatureMode('upload')}
                      className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition duration-300 border flex items-center gap-1 cursor-pointer ${
                        signatureMode === 'upload'
                          ? 'bg-orange-600 border-orange-600 text-white shadow-xs'
                          : 'bg-card border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      <Upload className="h-3 w-3" /> Upload Signature Image
                    </button>
                  </div>

                  {signatureMode === 'draw' ? (
                    <div className="relative border border-border bg-white rounded-lg overflow-hidden p-1 shadow-xs">
                      <canvas
                        ref={canvasRef}
                        width={600}
                        height={120}
                        className="w-full h-[120px] bg-slate-50 rounded cursor-crosshair touch-none"
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        onTouchStart={startDrawing}
                        onTouchMove={draw}
                        onTouchEnd={stopDrawing}
                      />
                      
                      <div className="absolute bottom-2 right-2 flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={clearSignature}
                          variant="outline"
                          className="h-7 text-[10px] font-bold text-red-600 border-red-200 hover:bg-red-50 hover:border-red-400 bg-white/95 backdrop-blur-xs flex items-center gap-1 shadow-xs"
                        >
                          Clear
                        </Button>
                      </div>

                      {!signatorySignature && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none opacity-40">
                          <span className="text-[10px] font-medium text-muted-foreground">Sign inside this box</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {signatorySignature ? (
                        <div className="relative border border-border bg-white rounded-lg p-3 flex flex-col items-center justify-center min-h-[120px]">
                          <img 
                            src={signatorySignature} 
                            alt="Uploaded Signature" 
                            className="max-h-[80px] max-w-full object-contain mx-auto"
                          />
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => setSignatorySignature('')}
                            variant="outline"
                            className="mt-2 h-7 text-[10px] font-bold text-red-600 border-red-200 hover:bg-red-50 hover:border-red-400 bg-white flex items-center gap-1 shadow-xs"
                          >
                            Remove
                          </Button>
                        </div>
                      ) : (
                        <div 
                          className="border border-dashed border-border hover:border-orange-500/60 transition-colors duration-300 rounded-lg p-4 bg-white/80 text-center cursor-pointer min-h-[120px] flex flex-col items-center justify-center"
                          onClick={() => document.getElementById('letter-signature-upload')?.click()}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const files = e.dataTransfer.files;
                            if (files && files.length > 0) {
                              handleSignatureFile(files[0]);
                            }
                          }}
                        >
                          <p className="text-[11px] font-bold text-foreground">Drag &amp; Drop Signature Image, or click to browse</p>
                          <p className="text-[9px] text-muted-foreground mt-0.5">PNG, JPEG, or SVG formats are supported</p>
                          <input 
                            type="file"
                            id="letter-signature-upload"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const files = e.target.files;
                              if (files && files.length > 0) {
                                handleSignatureFile(files[0]);
                              }
                            }}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {signatorySignature && (
                    <div className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>Signature Captured Successfully</span>
                    </div>
                  )}
                </div>

                {/* Logo, Seal & Watermark Settings */}
                <div className="bg-muted/30 p-4 rounded-xl space-y-3">
                  <p className="text-[10px] uppercase font-black tracking-wider text-muted-foreground flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5 text-orange-600" /> Corporate Authenticity &amp; Watermark Controls
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-center justify-between bg-card p-3 rounded-lg border border-border">
                      <div>
                        <p className="text-xs font-bold text-foreground">Affix Circular Corporate Seal</p>
                        <p className="text-[10px] text-muted-foreground">Red embossed Ghanaian statutory corporate seal</p>
                      </div>
                      <input
                        id="chk-seal-enabled"
                        type="checkbox"
                        checked={showSeal}
                        onChange={(e) => setShowSeal(e.target.checked)}
                        className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-border rounded cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center justify-between bg-card p-3 rounded-lg border border-border">
                      <div>
                        <p className="text-xs font-bold text-foreground">Enable Logo Watermark</p>
                        <p className="text-[10px] text-muted-foreground">Faded background security crest</p>
                      </div>
                      <input
                        id="chk-watermark-enabled"
                        type="checkbox"
                        checked={watermarkEnabled}
                        onChange={(e) => setWatermarkEnabled(e.target.checked)}
                        className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-border rounded cursor-pointer"
                      />
                    </div>

                    {watermarkEnabled && (
                      <div className="sm:col-span-2 bg-card p-3 rounded-lg border border-border space-y-1.5">
                        <div className="flex justify-between text-xs font-bold text-foreground">
                          <span>Watermark Security Opacity</span>
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
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    id="btn-quick-preview-print"
                    size="sm"
                    onClick={() => {
                      triggerSafePrint({
                        id: 'draft',
                        recipientType,
                        recipientName: recipientName || '[Recipient Name]',
                        recipientDesignation,
                        recipientCompany,
                        recipientAddress: recipientAddress || '[Recipient Address]',
                        recipientPhone,
                        recipientEmail,
                        date,
                        referenceNumber: referenceNumber || generateReferenceNumber(letterheadType),
                        classification: classification || 'OFFICIAL CORRESPONDENCE',
                        subject: subject || '[Subject Line]',
                        salutation,
                        body: body || 'Dear Sir, [Your compiled body paragraphs will be formatted here. Complete your draft to view exact line dimensions and column scales.]',
                        valediction,
                        signatoryName,
                        signatoryTitle,
                        showSeal,
                        letterheadType,
                        watermarkEnabled,
                        watermarkOpacity,
                        signatorySignature
                      });
                    }}
                    className="bg-orange-600 hover:bg-orange-700 text-white text-[10px] h-8 font-bold flex items-center gap-1"
                  >
                    <Printer className="h-3 w-3" /> Print Preview
                  </Button>
                  <Button
                    id="btn-quick-preview-send"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedLetterForSend({
                        id: editingLetterId || 'draft',
                        recipientType,
                        recipientName: recipientName || '[Recipient Name]',
                        recipientDesignation,
                        recipientCompany,
                        recipientAddress: recipientAddress || '[Recipient Address]',
                        recipientPhone,
                        recipientEmail,
                        date,
                        referenceNumber: referenceNumber || generateReferenceNumber(letterheadType),
                        classification: classification || 'OFFICIAL CORRESPONDENCE',
                        subject: subject || '[Subject Line]',
                        salutation,
                        body: body || '',
                        valediction,
                        signatoryName,
                        signatoryTitle,
                        showSeal,
                        letterheadType,
                        watermarkEnabled,
                        watermarkOpacity,
                        signatorySignature
                      });
                      setSendModalOpen(true);
                    }}
                    className="border-green-200 text-green-600 hover:text-green-700 hover:bg-green-50 text-[10px] h-8 font-bold flex items-center gap-1"
                  >
                    <Send className="h-3 w-3" /> Direct Send
                  </Button>
                </div>
              </div>

              {/* Simulation of Printable Letter */}
              <div className="bg-white text-black border border-border shadow-xl rounded-xl p-8 max-h-[85vh] overflow-y-auto font-serif text-left relative leading-relaxed text-sm select-none">
                
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

                <div className="relative z-10 space-y-4">
                  {/* Decorative bar */}
                  <div className="h-1 bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500 rounded-full mb-1"></div>

                  {/* Fake Letterhead */}
                  <div className="flex justify-between items-start border-b-2 border-neutral-800 pb-3">
                    {settings.logoUrl ? (
                      <img src={settings.logoUrl} className="h-11 w-auto rounded object-contain" alt="Logo" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="border-2 border-orange-600 px-2 py-0.5 text-orange-600 font-black text-xs font-sans tracking-widest">GREFAS</div>
                    )}
                    <div className="text-right font-sans text-[8px] leading-tight text-neutral-600 max-w-[65%]">
                      <h4 className="font-bold text-neutral-900 text-[10px] uppercase font-serif">
                        {letterheadType === 'joint' && (settings.letterheadJointTitle || 'GREFAS ENTERTAINMENT & CONSULT')}
                        {letterheadType === 'entertainment' && (settings.letterheadEntTitle || 'GREFAS ENTERTAINMENT & PRODUCTIONS')}
                        {letterheadType === 'consult' && (settings.letterheadConsultTitle || 'GREFAS BUSINESS & STRATEGY CONSULT')}
                      </h4>
                      <p className="text-[7px] text-orange-600 font-bold uppercase mt-0.5">
                        {letterheadType === 'joint' && (settings.letterheadJointSubtitle || 'Theatre • Casting • Artiste Management • Corporate Consulting')}
                        {letterheadType === 'entertainment' && (settings.letterheadEntSubtitle || 'Movie & Skit Production • Casting Services • Creative Arts')}
                        {letterheadType === 'consult' && (settings.letterheadConsultSubtitle || 'Corporate Strategy • Advisory • Visa Prep')}
                      </p>
                      <p className="text-[7px] text-neutral-500 font-mono mt-0.5">
                        {settings.registrationNumber || 'Reg. No: CS-289412024 • TIN: C0048192837'}
                      </p>
                      <p className="mt-1">{settings.address} • {settings.officeGps || 'GPS: AI-0008-9223'}</p>
                      <p>Phone: {settings.phone} • Email: {settings.email}</p>
                      <p className="font-semibold text-orange-600">Web: www.{cleanWebsiteDisplay}</p>
                    </div>
                  </div>

                  {/* Reference & Classification Bar */}
                  <div className="flex justify-between items-center bg-neutral-50 border border-neutral-200 px-2.5 py-1 text-[8.5px] font-sans">
                    <div><strong>Our Ref:</strong> <span className="font-mono font-bold text-orange-600">{referenceNumber || 'GREFAS/REF/2025/001'}</span></div>
                    <span className="font-bold border border-orange-600 text-orange-600 px-1.5 py-0.2 rounded text-[7.5px] uppercase">
                      {classification || 'OFFICIAL CORRESPONDENCE'}
                    </span>
                    <div><strong>Date:</strong> {date ? new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Today'}</div>
                  </div>

                  {/* Letter Metadata */}
                  <div className="flex justify-between text-xs">
                    <div>
                      <p className="text-[7.5px] uppercase tracking-wider font-sans font-bold text-neutral-500">TO:</p>
                      <h5 className="font-bold text-[11px] text-neutral-900">{recipientName || '[Recipient Name]'}</h5>
                      {recipientDesignation && <p className="text-neutral-700 font-medium text-[9px]">{recipientDesignation}</p>}
                      {recipientCompany && <p className="text-neutral-900 font-bold text-[9px]">{recipientCompany}</p>}
                      <p className="text-neutral-600 whitespace-pre-line text-[9px] leading-snug mt-0.5">{recipientAddress || '[Recipient Address]'}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-serif text-[10px]"><strong>Effective Date:</strong><br/>{date ? new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Today'}</p>
                    </div>
                  </div>

                  {/* Subject */}
                  <div className="border-y-2 border-neutral-800 py-1 text-center font-bold text-[10.5px] uppercase text-neutral-900 bg-neutral-50/50 tracking-wide">
                    RE: {subject || '[Subject Line]'}
                  </div>

                  {/* Salutation */}
                  <div className="font-bold text-xs">
                    {salutation}
                  </div>

                  {/* Body Paragraphs */}
                  <div className="text-xs text-neutral-800 space-y-2.5 leading-relaxed text-justify">
                    {body ? (
                      body.split('\n\n').map((p, i) => (
                        <p key={i} className="indent-6">
                          {p}
                        </p>
                      ))
                    ) : (
                      <p className="text-neutral-400 italic">
                        Select an executive template above or use the AI drafter to generate complete paragraphs with formal Ghanaian corporate British English formatting.
                      </p>
                    )}
                  </div>

                  {/* Sign off & Seal side by side */}
                  <div className="pt-3 flex justify-between items-end border-t border-neutral-200 mt-4">
                    <div className="text-xs">
                      <p className="mb-1 font-semibold">{valediction || 'Yours faithfully,'}</p>
                      {signatorySignature ? (
                        <div className="my-1.5 bg-white/90 p-1 rounded border border-neutral-200 inline-block">
                          <img 
                            src={signatorySignature} 
                            alt="Signature" 
                            className="max-h-10 max-w-[140px] object-contain"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      ) : (
                        <div className="h-6"></div>
                      )}
                      <p className="font-bold text-neutral-900">{signatoryName}</p>
                      <p className="text-neutral-600 text-[9px] font-medium">{signatoryTitle}</p>
                      <p className="text-neutral-400 text-[8px] font-sans">For: Grefas Consult &amp; Entertainment Limited</p>
                    </div>

                    {showSeal && (
                      <div className="shrink-0 p-1">
                        <svg viewBox="0 0 160 160" className="h-16 w-16" xmlns="http://www.w3.org/2000/svg">
                          <circle cx="80" cy="80" r="75" fill="none" stroke="#991b1b" strokeWidth="3" />
                          <circle cx="80" cy="80" r="70" fill="none" stroke="#991b1b" strokeWidth="1.2" strokeDasharray="4 2" />
                          <circle cx="80" cy="80" r="48" fill="none" stroke="#991b1b" strokeWidth="1.8" />
                          <circle cx="80" cy="80" r="45" fill="#fef2f2" fillOpacity="0.4" />
                          <g transform="translate(80, 80)">
                            <polygon points="0,-12 3.5,-3.5 12,-3.5 5,2.5 7.5,11 0,6 -7.5,11 -5,2.5 -12,-3.5 -3.5,-3.5" fill="#991b1b" />
                            <text y="18" textAnchor="middle" fill="#991b1b" fontSize="7" fontWeight="bold" fontFamily="Arial, sans-serif">
                              VERIFIED
                            </text>
                            <text y="24" textAnchor="middle" fill="#991b1b" fontSize="5.5" fontFamily="Arial, sans-serif">
                              SEAL 2024
                            </text>
                          </g>
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Verification micro-print */}
                  <div className="pt-2 border-t border-neutral-100 flex justify-between text-[7px] text-neutral-400 font-sans">
                    <span>SECURITY REF: {referenceNumber || 'GREFAS-REF-2025'}</span>
                    <span>VERIFY AT: WWW.{cleanWebsiteDisplay.toUpperCase()}/VERIFY-LETTER</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Corporate Identity & Letterhead Settings Dialog */}
      {settingsModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] animate-in fade-in">
          <div className="bg-card border border-border rounded-xl p-6 max-w-xl w-full shadow-2xl animate-in zoom-in-95 duration-200 text-left max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-border pb-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Globe className="h-5 w-5 text-orange-600" /> Letterhead &amp; Corporate Identity Settings
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Configure official website URL, registration numbers, and letterhead credentials.
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSettingsModalOpen(false)}
                className="h-8 w-8 p-0"
              >
                ✕
              </Button>
            </div>

            <div className="overflow-y-auto flex-1 pr-1 space-y-4 text-xs">
              <div className="bg-orange-50/10 border border-orange-200/50 p-3 rounded-lg space-y-1">
                <p className="font-bold text-orange-600 flex items-center gap-1.5">
                  <Check className="h-4 w-4" /> Official Domain Setup
                </p>
                <p className="text-[11px] text-muted-foreground">
                  The domain configured here is printed on all official letters, security verification hashes, and dispatched emails.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-foreground block">
                  Official Website URL *
                </label>
                <Input
                  type="text"
                  placeholder="grefasconsultandentertainment.com"
                  value={tempSettings.website || ''}
                  onChange={(e) => setTempSettings({ ...tempSettings, website: e.target.value })}
                  className="bg-background text-xs h-9 font-mono"
                />
                <p className="text-[10px] text-muted-foreground">e.g. grefasconsultandentertainment.com</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="font-bold text-foreground block">
                    Corporate Registration &amp; TIN Number
                  </label>
                  <Input
                    type="text"
                    placeholder="Reg. No: CS-289412024 • TIN: C0048192837"
                    value={tempSettings.registrationNumber || ''}
                    onChange={(e) => setTempSettings({ ...tempSettings, registrationNumber: e.target.value })}
                    className="bg-background text-xs h-9 font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-foreground block">
                    Ghana Post GPS Address
                  </label>
                  <Input
                    type="text"
                    placeholder="GPS: AI-0008-9223"
                    value={tempSettings.officeGps || ''}
                    onChange={(e) => setTempSettings({ ...tempSettings, officeGps: e.target.value })}
                    className="bg-background text-xs h-9 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="font-bold text-foreground block">Official Email Address</label>
                  <Input
                    type="email"
                    placeholder="info@grefasconsultandentertainment.com"
                    value={tempSettings.email || ''}
                    onChange={(e) => setTempSettings({ ...tempSettings, email: e.target.value })}
                    className="bg-background text-xs h-9"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-foreground block">Official Phone Number</label>
                  <Input
                    type="text"
                    placeholder="+233 24 412 3456"
                    value={tempSettings.phone || ''}
                    onChange={(e) => setTempSettings({ ...tempSettings, phone: e.target.value })}
                    className="bg-background text-xs h-9"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-foreground block">Physical Office Address</label>
                <Input
                  type="text"
                  placeholder="Nyinahin-Ashanti, Ashanti Region, Ghana"
                  value={tempSettings.address || ''}
                  onChange={(e) => setTempSettings({ ...tempSettings, address: e.target.value })}
                  className="bg-background text-xs h-9"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-foreground block">Official Brand Logo URL (PNG/SVG with transparency)</label>
                <Input
                  type="url"
                  placeholder="https://..."
                  value={tempSettings.logoUrl || ''}
                  onChange={(e) => setTempSettings({ ...tempSettings, logoUrl: e.target.value })}
                  className="bg-background text-xs h-9"
                />
              </div>

              <div className="space-y-3 pt-2 border-t border-border">
                <p className="font-bold text-foreground text-[11px] uppercase tracking-wider text-muted-foreground">
                  Custom Letterhead Subtitles
                </p>
                <div className="space-y-2">
                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground">Joint Division Subtitle</label>
                    <Input
                      type="text"
                      value={tempSettings.letterheadJointSubtitle || ''}
                      onChange={(e) => setTempSettings({ ...tempSettings, letterheadJointSubtitle: e.target.value })}
                      className="bg-background text-xs h-8"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground">Entertainment Division Subtitle</label>
                    <Input
                      type="text"
                      value={tempSettings.letterheadEntSubtitle || ''}
                      onChange={(e) => setTempSettings({ ...tempSettings, letterheadEntSubtitle: e.target.value })}
                      className="bg-background text-xs h-8"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground">Consult Division Subtitle</label>
                    <Input
                      type="text"
                      value={tempSettings.letterheadConsultSubtitle || ''}
                      onChange={(e) => setTempSettings({ ...tempSettings, letterheadConsultSubtitle: e.target.value })}
                      className="bg-background text-xs h-8"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-border pt-4 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSettingsModalOpen(false)}
                className="text-xs font-semibold"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={isSavingSettings}
                onClick={handleSaveSettings}
                className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold px-4 flex items-center gap-1.5"
              >
                {isSavingSettings ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5" /> Save Corporate Identity
                  </>
                )}
              </Button>
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

      {/* Direct Dispatch Center Modal */}
      {sendModalOpen && selectedLetterForSend && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] animate-in fade-in">
          <div className="bg-card border border-border rounded-xl p-6 max-w-2xl w-full shadow-2xl animate-in zoom-in-95 duration-200 text-left flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center border-b border-border pb-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Send className="h-5 w-5 text-orange-600" /> Executive Direct Dispatch Hub
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Dispatch via official branded HTML letterhead email or formatted WhatsApp transmission.
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSendModalOpen(false);
                  setSelectedLetterForSend(null);
                }}
                className="h-8 w-8 p-0"
              >
                ✕
              </Button>
            </div>

            <div className="overflow-y-auto flex-1 pr-1 space-y-4">
              <div className="p-3 bg-muted/30 rounded-lg border border-border flex justify-between items-center">
                <div>
                  <p className="text-xs font-semibold text-foreground">
                    Letter: <span className="font-bold text-orange-600">{selectedLetterForSend.subject}</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Recipient: {selectedLetterForSend.recipientName} {selectedLetterForSend.recipientCompany ? `(${selectedLetterForSend.recipientCompany})` : ''}
                  </p>
                </div>
                <span className="text-[10px] font-mono font-bold bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300 px-2 py-0.5 rounded">
                  {selectedLetterForSend.referenceNumber || 'GREFAS/DISPATCH'}
                </span>
              </div>

              {/* Editable Contact Info Section */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-muted/25 p-4 rounded-xl border border-border">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-foreground flex items-center gap-1">
                    <MessageSquare className="h-3.5 w-3.5 text-green-600" /> WhatsApp Number
                  </label>
                  <Input
                    type="text"
                    placeholder="e.g. +233244123456"
                    value={selectedLetterForSend.recipientPhone || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedLetterForSend(prev => prev ? { ...prev, recipientPhone: val } : null);
                    }}
                    className="bg-background text-xs h-9"
                  />
                  <p className="text-[9px] text-muted-foreground">Ensure international prefix is included (e.g., +233).</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-foreground flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5 text-blue-500" /> Recipient Email
                  </label>
                  <Input
                    type="email"
                    placeholder="e.g. director@example.com"
                    value={selectedLetterForSend.recipientEmail || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedLetterForSend(prev => prev ? { ...prev, recipientEmail: val } : null);
                    }}
                    className="bg-background text-xs h-9"
                  />
                  <p className="text-[9px] text-muted-foreground">Required for official branded letter dispatch.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* WhatsApp Bento Card */}
                <div className="border border-border rounded-xl p-4 space-y-3 flex flex-col justify-between bg-green-50/5 dark:bg-green-950/5">
                  <div>
                    <h4 className="text-xs font-bold text-green-600 flex items-center gap-1.5">
                      <MessageSquare className="h-4 w-4" /> WhatsApp Dispatch
                    </h4>
                    <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
                      Sends an executive markdown-formatted transmission with reference numbers, formal classification, and website verification link directly to the recipient's WhatsApp.
                    </p>
                  </div>
                  <div className="space-y-2 pt-2">
                    <Button
                      onClick={() => handleSendWhatsApp(selectedLetterForSend)}
                      disabled={!selectedLetterForSend.recipientPhone}
                      className="w-full bg-green-600 hover:bg-green-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 h-9"
                    >
                      <ExternalLink className="h-4 w-4" /> Open WhatsApp Direct
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleCopyLetterToClipboard(selectedLetterForSend)}
                      className="w-full text-[10px] h-8 font-semibold flex items-center justify-center gap-1"
                    >
                      <Copy className="h-3.5 w-3.5" /> Copy Message Text
                    </Button>
                  </div>
                </div>

                {/* Email Bento Card */}
                <div className="border border-border rounded-xl p-4 space-y-3 flex flex-col justify-between bg-blue-50/5 dark:bg-blue-950/5">
                  <div>
                    <h4 className="text-xs font-bold text-blue-500 flex items-center gap-1.5">
                      <Mail className="h-4 w-4" /> Executive Letterhead Email
                    </h4>
                    <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
                      Dispatches an official high-fidelity HTML letterhead email with dual-tone borders, reference strip, registration codes, corporate seal, and <span className="font-semibold text-blue-600">{cleanWebsiteDisplay}</span> branding.
                    </p>
                  </div>
                  <div className="space-y-2 pt-2">
                    <Button
                      onClick={() => handleSendOfficialEmail(selectedLetterForSend)}
                      disabled={isSendingEmail || !selectedLetterForSend.recipientEmail}
                      className="w-full bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 h-9"
                    >
                      {isSendingEmail ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> Dispatching...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4" /> Send Branded Letterhead Email
                        </>
                      )}
                    </Button>
                    
                    <a
                      href={`mailto:${selectedLetterForSend.recipientEmail || ''}?subject=${encodeURIComponent(`OFFICIAL CORRESPONDENCE [${selectedLetterForSend.referenceNumber || 'GREFAS'}]: ${selectedLetterForSend.subject}`)}&body=${encodeURIComponent(
                        `${selectedLetterForSend.salutation || 'Dear Sir/Madam,'}\n\n${selectedLetterForSend.body.split('\n\n').join('\n\n')}\n\n${selectedLetterForSend.valediction || 'Yours faithfully,'}\n${selectedLetterForSend.signatoryName}\n${selectedLetterForSend.signatoryTitle}\nFor: Grefas Consult & Entertainment Limited\nWeb: https://www.${cleanWebsiteDisplay}`
                      )}`}
                      className={`w-full inline-flex items-center justify-center gap-1 text-[10px] h-8 border border-border rounded-lg font-semibold hover:bg-muted text-foreground transition-colors ${
                        !selectedLetterForSend.recipientEmail ? 'pointer-events-none opacity-50' : ''
                      }`}
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Open Local Email Client
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-border pt-4 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSendModalOpen(false);
                  setSelectedLetterForSend(null);
                }}
                className="text-xs font-semibold"
              >
                Close Hub
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
