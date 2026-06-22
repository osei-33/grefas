import * as React from 'react';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import * as LucideIcons from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from '@/firebase';
import { collection, onSnapshot, query, orderBy, addDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import SEO from '@/components/SEO';

const consultingImg = '/src/assets/images/service_consulting_1782127444377.jpg';
const entertainmentImg = '/src/assets/images/service_entertainment_1782127460075.jpg';
const artistImg = '/src/assets/images/service_artist_1782127476185.jpg';

export default function Services() {
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'All' | 'Consulting' | 'Entertainment'>('All');
  
  const [currentStep, setCurrentStep] = useState(1);
  const [draftInfo, setDraftInfo] = useState<{ savedAt: string; data: any } | null>(null);

  const [formData, setFormData] = useState({
    fullName: '',
    dateOfBirth: '',
    age: 0,
    contact: '',
    address: '',
    whatsappNumber: '',
    emailAddress: '',
    // Step 2: Project Requirements / Casting Specifications
    roleType: 'Actor / Actress',
    experienceLevel: 'Intermediate',
    preferredGenres: [] as string[],
    availability: 'Part-time',
    portfolioLink: '',
    bio: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [printableData, setPrintableData] = useState<any | null>(null);
  const [lastSubmittedSnapshot, setLastSubmittedSnapshot] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccessState, setShowSuccessState] = useState(false);
  const [submittedName, setSubmittedName] = useState('');
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Check for saved draft on mount
  useEffect(() => {
    const savedDraft = localStorage.getItem('grefas_casting_draft');
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        setDraftInfo(parsed);
      } catch (e) {
        console.error('Error parsing draft:', e);
      }
    }
  }, []);

  const saveDraft = () => {
    const draftPayload = {
      savedAt: new Date().toISOString(),
      data: formData
    };
    localStorage.setItem('grefas_casting_draft', JSON.stringify(draftPayload));
    setDraftInfo(draftPayload);
    toast.success('Progress saved as draft!', {
      description: `Your draft has been securely stored in your browser. You can return to complete it later.`
    });
  };

  const loadDraft = () => {
    if (draftInfo) {
      setFormData(draftInfo.data);
      // Recalculate age if DOB exists
      if (draftInfo.data.dateOfBirth) {
        const calculatedAge = calculateAge(draftInfo.data.dateOfBirth);
        setFormData(prev => ({
          ...prev,
          age: calculatedAge
        }));
      }
      setDraftInfo(null);
      toast.success('Draft loaded successfully!');
    }
  };

  const discardDraft = () => {
    localStorage.removeItem('grefas_casting_draft');
    setDraftInfo(null);
    toast.info('Draft discarded.');
  };

  const calculateAge = (dobString: string): number => {
    if (!dobString) return 0;
    const dob = new Date(dobString);
    const today = new Date();
    let calculatedAge = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      calculatedAge--;
    }
    return Math.max(0, calculatedAge);
  };

  const validateField = (name: string, value: any): string => {
    let err = '';
    const phoneRegex = /^\+?[0-9\s-]{9,15}$/;
    
    switch (name) {
      case 'fullName':
        if (!value || value.trim().length < 3) {
          err = 'Legal or screen name must be at least 3 characters.';
        }
        break;
      case 'dateOfBirth':
        if (!value) {
          err = 'Date of birth is required.';
        } else {
          const dobDate = new Date(value);
          const now = new Date();
          if (dobDate > now) {
            err = 'Date of birth cannot be in the future.';
          } else {
            const calculatedAge = calculateAge(value);
            if (calculatedAge < 1) {
              err = 'Age must be 1 year or older to register.';
            } else if (calculatedAge > 110) {
              err = 'Please check the selected birth year.';
            }
          }
        }
        break;
      case 'contact':
        if (!value) {
          err = 'Contact phone number is required.';
        } else if (!phoneRegex.test(value.replace(/[\s-]/g, ''))) {
          err = 'Requires a valid contact number (9-15 digits, e.g. +233 24 123 4567).';
        }
        break;
      case 'whatsappNumber':
        if (!value) {
          err = 'WhatsApp contact number is required.';
        } else if (!phoneRegex.test(value.replace(/[\s-]/g, ''))) {
          err = 'Requires a valid WhatsApp number (9-15 digits, starting entirely with digits).';
        }
        break;
      case 'emailAddress':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!value) {
          err = 'Email address coordinates are required.';
        } else if (!emailRegex.test(value)) {
          err = 'Please enter a valid email format (e.g. name@domain.com).';
        }
        break;
      case 'address':
        if (!value || value.trim().length < 6) {
          err = 'Please furnish a detailed residence location (minimum 6 characters).';
        }
        break;
      default:
        break;
    }
    setErrors(prev => ({ ...prev, [name]: err }));
    return err;
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    // Live validation check
    validateField(field, value);
  };

  const handleDobChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dob = e.target.value;
    const calculatedAge = calculateAge(dob);
    setFormData(prev => ({
      ...prev,
      dateOfBirth: dob,
      age: calculatedAge
    }));
    validateField('dateOfBirth', dob);
  };

  const copyWhatsAppFromContact = () => {
    setFormData(prev => ({
      ...prev,
      whatsappNumber: prev.contact
    }));
    validateField('whatsappNumber', formData.contact);
    toast.success("Copied Contact number to WhatsApp field!");
  };

  const handleNextStep = () => {
    const step1Keys = ['fullName', 'dateOfBirth', 'contact', 'whatsappNumber', 'emailAddress', 'address'];
    const newErrors: Record<string, string> = {};
    let hasErrors = false;

    step1Keys.forEach(key => {
      const err = validateField(key, (formData as any)[key]);
      if (err) {
        newErrors[key] = err;
        hasErrors = true;
      }
    });

    if (hasErrors) {
      setErrors(newErrors);
      toast.error('Details are incomplete or incorrect. Please fix the highlighted fields in step 1!');
      return;
    }

    setCurrentStep(2);
  };

  const handleBackStep = () => {
    setCurrentStep(1);
  };

  const runIframeSafePrint = (data: any | null) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('The print window was blocked by your browser. Please allow popups for Grefas Cinema!');
      return;
    }

    const docBirth = data?.dateOfBirth ? new Date(data.dateOfBirth).toLocaleDateString() : '__________________';
    const regDate = data?.createdAt ? new Date(data.createdAt).toLocaleString() : new Date().toLocaleString();

    printWindow.document.write(`
      <html>
        <head>
          <title>Grefas Entertainment - Casting Intake Registry</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              padding: 40px;
              color: black;
              background-color: white;
              max-width: 800px;
              margin: 0 auto;
              line-height: 1.5;
            }
            .border-box {
              border: 3px solid #000;
              padding: 30px;
              border-radius: 6px;
              min-height: 90vh;
              display: flex;
              justify-content: space-between;
              flex-direction: column;
            }
            .header {
              text-align: center;
              border-bottom: 4px solid #000;
              padding-bottom: 15px;
              margin-bottom: 25px;
              position: relative;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
              font-weight: 900;
              letter-spacing: 2px;
              text-transform: uppercase;
            }
            .header p {
              margin: 5px 0 0 0;
              font-size: 11px;
              text-transform: uppercase;
              font-weight: bold;
              letter-spacing: 1px;
              color: #333;
            }
            .meta-bar {
              margin-top: 15px;
              display: flex;
              justify-content: space-between;
              font-family: monospace;
              font-size: 10px;
              font-weight: bold;
              border-top: 1px solid #ddd;
              padding-top: 6px;
            }
            .registry-tag {
              text-align: center;
              background-color: #000;
              color: #fff;
              padding: 10px;
              margin: 20px 0;
              border-radius: 4px;
            }
            .registry-tag h2 {
              margin: 0;
              font-size: 14px;
              font-weight: 950;
              letter-spacing: 1px;
              text-transform: uppercase;
            }
            .section {
              margin-bottom: 25px;
            }
            .section-title {
              font-size: 12px;
              font-weight: 950;
              text-transform: uppercase;
              letter-spacing: 1px;
              border-bottom: 2px solid #000;
              padding-bottom: 3px;
              margin-bottom: 12px;
            }
            .field-grid {
              display: grid;
              grid-template-cols: 1fr 1fr;
              row-gap: 15px;
              column-gap: 20px;
              font-size: 13px;
            }
            .field-span-2 {
              grid-column: span 2;
            }
            .field {
              display: flex;
              align-items: flex-end;
              gap: 8px;
            }
            .field-label {
              font-weight: 800;
              text-transform: uppercase;
              font-size: 10px;
              color: #000;
              white-space: nowrap;
            }
            .field-value {
              flex-grow: 1;
              border-bottom: 1px solid #444;
              padding-bottom: 2px;
              font-family: monospace;
              padding-left: 5px;
              min-height: 18px;
            }
            .field-value.highlight {
              font-weight: bold;
              font-size: 14px;
            }
            .score-grid {
              display: grid;
              grid-template-cols: repeat(4, 1fr);
              gap: 10px;
              text-align: center;
              margin-top: 10px;
            }
            .score-card {
              border: 2px solid #000;
              padding: 8px;
              background-color: #fafafa;
              border-radius: 4px;
            }
            .score-label {
              font-size: 8px;
              font-weight: 900;
              text-transform: uppercase;
            }
            .score-val {
              font-family: monospace;
              font-weight: bold;
              font-size: 11px;
              margin-top: 4px;
            }
            .remarks-box {
              margin-top: 15px;
              border: 2px solid #000;
              padding: 12px;
              background-color: #fafafa;
              border-radius: 4px;
              font-size: 11px;
            }
            .sign-off {
              margin-top: auto;
              border-top: 1px solid #eee;
              padding-top: 15px;
            }
            .signatures-grid {
              display: flex;
              justify-content: space-between;
              margin-top: 40px;
              font-size: 11px;
              font-weight: bold;
              font-family: monospace;
            }
            .sig-line {
              border-top: 2px solid #000;
              width: 180px;
              text-align: center;
              padding-top: 5px;
              text-transform: uppercase;
              font-size: 9px;
            }
            .no-print-btn-bar {
              background-color: #f1f5f9;
              padding: 12px 20px;
              border-radius: 8px;
              margin-bottom: 20px;
              display: flex;
              justify-content: flex-end;
            }
            .print-btn {
              background-color: #ea580c;
              color: white;
              border: none;
              padding: 8px 16px;
              font-weight: bold;
              border-radius: 6px;
              cursor: pointer;
              font-size: 12px;
              text-transform: uppercase;
            }
            @media print {
              .no-print {
                display: none !important;
              }
              body {
                padding: 15px;
              }
            }
          </style>
        </head>
        <body>
          <div class="no-print no-print-btn-bar">
            <button class="print-btn" onclick="window.print()">Print Document</button>
          </div>
          <div class="border-box">
            <div>
              <div class="header">
                <h1>GREFAS ENTERTAINMENT</h1>
                <p>Theatre, Film Casting & Skit Making Auditions Register</p>
                <div class="meta-bar">
                  <span>REGION: ASHANTI, GHANA (KUMASI)</span>
                  <span>TIME: ${regDate}</span>
                </div>
              </div>

              <div class="registry-tag">
                <h2>ACTOR CASTING & CREW INTAKE REGISTRY CARD</h2>
              </div>

              <!-- Segment 1 -->
              <div class="section">
                <div class="section-title">1. Personal Biodata & Demographics</div>
                <div class="field-grid">
                  <div class="field field-span-2">
                    <span class="field-label">Legal/Screen Name:</span>
                    <span class="field-value highlight">${data?.fullName || '____________________________________________________'}</span>
                  </div>
                  <div class="field">
                    <span class="field-label">Birth Date:</span>
                    <span class="field-value">${docBirth}</span>
                  </div>
                  <div class="field">
                    <span class="field-label">Age Checked:</span>
                    <span class="field-value">${data ? `${data.age} years old` : '________ years old'}</span>
                  </div>
                  <div class="field field-span-2">
                    <span class="field-label">Residential Location:</span>
                    <span class="field-value">${data?.address || '____________________________________________________'}</span>
                  </div>
                </div>
              </div>

              <!-- Segment 2 -->
              <div class="section">
                <div class="section-title">2. Primary Communication Outlets</div>
                <div class="field-grid">
                  <div class="field">
                    <span class="field-label">Contact Dial:</span>
                    <span class="field-value">${data?.contact || '_______________________'}</span>
                  </div>
                  <div class="field">
                    <span class="field-label">WhatsApp Number:</span>
                    <span class="field-value">${data?.whatsappNumber || '_______________________'}</span>
                  </div>
                  <div class="field field-span-2">
                    <span class="field-label font-bold">Email Address:</span>
                    <span class="field-value">${data?.emailAddress || '____________________________________________________'}</span>
                  </div>
                </div>
              </div>

              <!-- New Requirements Segment -->
              <div class="section">
                <div class="section-title">3. Production Roles & Casting Details</div>
                <div class="field-grid">
                  <div class="field">
                    <span class="field-label">Prescribed Role:</span>
                    <span class="field-value font-bold">${data?.roleType || 'Actor / Actress'}</span>
                  </div>
                  <div class="field">
                    <span class="field-label">Experience Stage:</span>
                    <span class="field-value font-bold">${data?.experienceLevel || 'Intermediate'}</span>
                  </div>
                  <div class="field">
                    <span class="field-label">Availability Schedule:</span>
                    <span class="field-value">${data?.availability || 'Part-time'}</span>
                  </div>
                  <div class="field">
                    <span class="field-label">Portfolio URL link:</span>
                    <span class="field-value" style="font-size: 11px;">${data?.portfolioLink || 'N/A'}</span>
                  </div>
                  <div class="field field-span-2">
                    <span class="field-label">Selected Genres:</span>
                    <span class="field-value">${data?.preferredGenres && data.preferredGenres.length > 0 ? data.preferredGenres.join(', ') : 'Comedy, Drama'}</span>
                  </div>
                  <div class="field field-span-2">
                    <span class="field-label">Short Talent Pitch:</span>
                    <span class="field-value" style="font-size: 11px;">${data?.bio || 'Pending first audition review notes...'}</span>
                  </div>
                </div>
              </div>

              <!-- Segment 4 -->
              <div class="section">
                <div class="section-title">4. Audition Scoring Matrix (Official Director Use Only)</div>
                <div class="score-grid">
                  <div class="score-card">
                    <div class="score-label">Acting Range</div>
                    <div class="score-val">A / B / C / D</div>
                  </div>
                  <div class="score-card">
                    <div class="score-label">Voice / Clarity</div>
                    <div class="score-val">A / B / C / D</div>
                  </div>
                  <div class="score-card">
                    <div class="score-label">Camera GLAM</div>
                    <div class="score-val">A / B / C / D</div>
                  </div>
                  <div class="score-card">
                    <div class="score-label">Improvisation</div>
                    <div class="score-val">A / B / C / D</div>
                  </div>
                </div>
                <div class="remarks-box">
                  <strong>AUDITION REGISTER SCREENING NOTES & REELS EVALENT:</strong>
                  <div style="min-height: 40px; color: #555; margin-top: 6px; font-style: italic; font-size: 10px;">
                    [Screen compliance markers, dialect notes, stage styling notes for skit or full series casting suitability]
                  </div>
                </div>
              </div>
            </div>

            <div class="sign-off">
              <p style="text-align: center; font-size: 9px; margin-bottom: 25px; line-height: 1.4;">
                By signing, the talent verifies that self-submitted communication channels and credentials are fully correct and active.
              </p>
              <div class="signatures-grid">
                <div>
                  <div class="sig-line">Candidate Signature</div>
                  <div style="text-align: center; font-size: 8px; color: #555; margin-top: 4px;">Date: ____ / ____ / ________</div>
                </div>
                <div>
                  <div class="sig-line">Authorized Casting Representative</div>
                  <div style="text-align: center; font-size: 8px; color: #555; margin-top: 4px;">Registration Stamp Frame</div>
                </div>
              </div>
            </div>
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 300);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
    toast.success('Triggered safe printing in new tab!');
  };

  const printFilledForm = () => {
    // Open print view instantly loaded with current form details
    runIframeSafePrint({ ...formData });
  };

  const printEmptyForm = () => {
    runIframeSafePrint(null);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Comprehensive client-side validations
    const newErrors: Record<string, string> = {};
    const keys = ['fullName', 'dateOfBirth', 'contact', 'whatsappNumber', 'emailAddress', 'address'];
    let hasErrors = false;
    
    keys.forEach(key => {
      const err = validateField(key, (formData as any)[key]);
      if (err) {
        newErrors[key] = err;
        hasErrors = true;
      }
    });
    
    if (hasErrors) {
      setErrors(newErrors);
      toast.error('Form contains validation errors. Please fix highlighted fields.');
      return;
    }

    setSubmitting(true);
    try {
      const path = 'service_intakes';
      const intakeData = {
        ...formData,
        userId: auth.currentUser?.uid || null,
        userEmail: auth.currentUser?.email || null,
        status: 'Pending',
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, path), intakeData);

      // Trigger server-side notifications via email proxy
      try {
        await fetch('/api/notify-intake', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(intakeData)
        });
      } catch (err) {
        console.warn('Failed to send email notification:', err);
      }

      toast.success('Movie & Skit Registration Logged!', {
        description: 'Thank you for registering. Our director or casting team will reach out via WhatsApp shortly!'
      });
      setLastSubmittedSnapshot({ ...formData });
      setSubmittedName(formData.fullName);
      setShowSuccessState(true);
      setFormData({
        fullName: '',
        dateOfBirth: '',
        age: 0,
        contact: '',
        address: '',
        whatsappNumber: '',
        emailAddress: '',
        roleType: 'Actor / Actress',
        experienceLevel: 'Intermediate',
        preferredGenres: [] as string[],
        availability: 'Part-time',
        portfolioLink: '',
        bio: ''
      });
      setErrors({});
      setCurrentStep(1);
      localStorage.removeItem('grefas_casting_draft');
      setDraftInfo(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'service_intakes');
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    const q = query(collection(db, 'services'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setServices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'services');
    });
    return () => unsubscribe();
  }, []);

  const getServiceCategory = (service: any): 'Consulting' | 'Entertainment' => {
    if (service.category === 'Consulting' || service.category === 'Entertainment') {
      return service.category;
    }
    // High-fidelity fallback heuristic based on keywords
    const title = (service.title || '').toLowerCase();
    const desc = (service.description || '').toLowerCase();
    
    const isConsulting = 
      title.includes('consult') || title.includes('strategy') || title.includes('business') || title.includes('advisory') || title.includes('finance') || title.includes('tax') || title.includes('legal') || title.includes('management') || title.includes('corporate') ||
      desc.includes('consult') || desc.includes('strategy') || desc.includes('business') || desc.includes('advisory') || desc.includes('finance') || desc.includes('tax') || desc.includes('legal') || desc.includes('management') || desc.includes('corporate');
      
    const isEntertainment = 
      title.includes('event') || title.includes('music') || title.includes('entertain') || title.includes('artist') || title.includes('show') || title.includes('production') || title.includes('dj') || title.includes('audio') || title.includes('video') || title.includes('stage') || title.includes('sound') ||
      desc.includes('event') || desc.includes('music') || desc.includes('entertain') || desc.includes('artist') || desc.includes('show') || desc.includes('production') || desc.includes('dj') || desc.includes('audio') || desc.includes('video') || desc.includes('stage') || desc.includes('sound');
      
    if (isEntertainment && !isConsulting) return 'Entertainment';
    return 'Consulting'; // Default fallback
  };

  const getIcon = (name: string) => {
    const Icon = (LucideIcons as any)[name] || LucideIcons.Briefcase;
    return <Icon className="h-6 w-6" />;
  };

  const getServicePlaceholderImage = (service: any): string => {
    const category = getServiceCategory(service);
    const title = (service.title || '').toLowerCase();
    
    if (category === 'Entertainment') {
      if (title.includes('artist') || title.includes('talent') || title.includes('manage') || title.includes('agency')) {
        return artistImg;
      }
      return entertainmentImg;
    }
    return consultingImg;
  };

  const filteredServices = services.filter(service => {
    if (activeTab === 'All') return true;
    return getServiceCategory(service) === activeTab;
  });

  return (
    <>
      <div className="bg-background py-20 print:hidden">
        <SEO 
        title="Our Services"
        description="Explore the services of Grefas Consult & Entertainment, including strategic business consulting, live entertainment events, artist management, production, and audio-video solutions in Ashanti Region, Ghana."
        keywords="Grefas services, business consulting Ghana, talent agency Nyinahin, event organization, artist manager Ghana"
      />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl"
          >
            Our Services
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground"
          >
            Comprehensive solutions designed to help you succeed in business and celebrate in style.
          </motion.p>
        </div>

        {/* Tabbed Filter UI */}
        <div className="mt-10 flex justify-center">
          <div className="inline-flex rounded-xl bg-muted/60 p-1 backdrop-blur-sm border border-border/30">
            {(['All', 'Consulting', 'Entertainment'] as const).map((tab) => {
              const isActive = activeTab === tab;
              const TabIcon = tab === 'All' 
                ? (LucideIcons.Layers || LucideIcons.Grid)
                : tab === 'Consulting' 
                  ? LucideIcons.Briefcase 
                  : (LucideIcons.Music2 || LucideIcons.Music);
              
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`relative flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-300 cursor-pointer ${
                    isActive 
                      ? 'bg-orange-600 text-white shadow-sm' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                  id={`tab-filter-${tab.toLowerCase()}`}
                >
                  <TabIcon className="h-4 w-4" />
                  <span>{tab === 'All' ? 'All Services' : tab}</span>
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <LucideIcons.Loader2 className="h-8 w-8 animate-spin text-orange-600" />
          </div>
        ) : (
          <div className="mt-12 min-h-[30vh]">
            <AnimatePresence mode="popLayout">
              {filteredServices.length > 0 ? (
                <motion.div 
                  layout
                  className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3"
                >
                  {filteredServices.map((service, index) => (
                    <motion.div
                      key={service.id}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.2, delay: index * 0.05 }}
                    >
                      <Card className="flex h-full flex-col border border-border/50 bg-card shadow-sm transition-all hover:shadow-md overflow-hidden group">
                        {/* Interactive cohesive service placeholder image banner */}
                        <div className="relative h-48 w-full bg-muted overflow-hidden">
                          <img 
                            src={service.imageUrl || getServicePlaceholderImage(service)} 
                            alt={service.title} 
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" 
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end p-4">
                            <span className="text-[10px] uppercase font-mono font-black tracking-wider bg-orange-600 text-white px-2.5 py-1 rounded shadow-sm">
                              {getServiceCategory(service)}
                            </span>
                          </div>
                        </div>

                        <CardHeader className="pt-4 pb-2">
                          <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${service.color || 'bg-orange-100 text-orange-600'} dark:bg-orange-900/30 dark:text-orange-500 mb-3`}>
                            {getIcon(service.iconName)}
                          </div>
                          <CardTitle className="text-foreground tracking-tight line-clamp-1">{service.title}</CardTitle>
                          <CardDescription className="line-clamp-2 text-muted-foreground mt-1.5 min-h-[40px]">{service.description}</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1 pt-0">
                          <p className="text-xs text-muted-foreground/80 leading-relaxed">
                            Tailored strategies and solutions engineered specifically to address local dynamics and power your strategic goals.
                          </p>
                        </CardContent>
                        <CardFooter className="pt-0">
                          <Link to={`/services/${service.id}`} className="w-full">
                            <Button variant="outline" className="w-full border-orange-600/20 text-orange-600 hover:bg-orange-600 hover:text-white cursor-pointer">
                              Learn More
                            </Button>
                          </Link>
                        </CardFooter>
                      </Card>
                    </motion.div>
                  ))}
                </motion.div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="py-20 text-center text-muted-foreground"
                >
                  No services listed in this category yet. Check back soon!
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Dynamic Consultation Client Intake Form Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-20 max-w-3xl mx-auto border border-border/60 bg-card rounded-2xl p-6 md:p-10 shadow-lg relative overflow-hidden"
          id="service-consultation-intake-card"
        >
          {/* Subtle decoration vector spots */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-orange-600/5 rounded-full blur-3xl -z-10 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-orange-600/5 rounded-full blur-3xl -z-10 pointer-events-none" />

          {showSuccessState ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-10 px-4 space-y-6 flex flex-col items-center justify-center animate-fade-in"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 animate-bounce">
                <LucideIcons.Tv className="h-10 w-10 text-emerald-500 animate-pulse" />
              </div>
              <div className="space-y-2">
                <span className="text-[10px] font-mono font-black tracking-widest bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 px-2.5 py-1 rounded">
                  TRANSMISSION COMPLETED
                </span>
                <h3 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl mt-2">
                  Movie & Skit Form Logged!
                </h3>
                <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
                  Excellent work, <span className="font-extrabold text-foreground">{submittedName}</span>! 
                  Your casting interest, demographic data, and contact pointers have been successfully committed to Grefas production engines. 
                  Our creative director or casting team will ping you on WhatsApp or Email shortly.
                </p>
              </div>
              <div className="pt-4 flex flex-col sm:flex-row gap-3 w-full justify-center max-w-md print:hidden">
                <Button
                  onClick={() => setShowSuccessState(false)}
                  className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-bold h-11 rounded-lg shadow-md transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LucideIcons.Video className="h-5 w-5" />
                  <span>Submit Another Form</span>
                </Button>
                <Button
                  onClick={() => {
                    setPrintableData(lastSubmittedSnapshot);
                    setShowPrintModal(true);
                  }}
                  variant="outline"
                  className="flex-1 border-orange-600/30 text-orange-600 hover:bg-orange-600/10 font-bold h-11 rounded-lg shadow-sm flex items-center justify-center gap-2 cursor-pointer bg-card"
                >
                  <LucideIcons.Printer className="h-5 w-5" />
                  <span>Print My Submission</span>
                </Button>
              </div>
            </motion.div>
          ) : (
            <>
              {/* SAVED DRAFT NOTICE BANNER */}
              {draftInfo && (
                <div className="mb-6 bg-orange-500/10 border border-orange-500/20 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
                  <div className="flex items-center gap-3">
                    <div className="bg-orange-600 text-white p-2.5 rounded-xl">
                      <LucideIcons.FileEdit className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-xs sm:text-sm text-foreground">Saved Form Progress Detected</h4>
                      <p className="text-[11px] text-muted-foreground">
                        Draft saved on {new Date(draftInfo.savedAt).toLocaleString()}. You can load your progress or clear this draft.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
                    <Button 
                      onClick={loadDraft}
                      size="sm"
                      type="button"
                      className="bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-lg text-xs h-8"
                    >
                      Restore Draft
                    </Button>
                    <Button 
                      onClick={discardDraft}
                      size="sm"
                      variant="ghost"
                      type="button"
                      className="text-muted-foreground hover:text-rose-500 text-xs font-bold h-8"
                    >
                      Discard
                    </Button>
                  </div>
                </div>
              )}

              <div className="text-center mb-6">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-100 dark:bg-orange-950/20 text-orange-600 text-xs font-bold uppercase tracking-wider mb-2">
                  <LucideIcons.Sparkles className="h-3 w-3 animate-pulse" />
                  <span>Production registration hub</span>
                </div>
                <h2 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl flex items-center justify-center gap-2">
                  <LucideIcons.Clapperboard className="h-7 w-7 text-orange-600 animate-bounce" />
                  <span>Movie and Skit making Form</span>
                </h2>
                <p className="mt-2 text-xs text-muted-foreground max-w-lg mx-auto leading-relaxed">
                  Join our active creative cast and crew list. Enter your details to register for elite movie roles, comic skit casting, and professional entertainment events.
                </p>

                {/* Print Options Buttons Area */}
                <div className="flex flex-wrap items-center justify-center gap-3 mt-5 px-2 py-2 bg-muted/40 rounded-xl max-w-md mx-auto print:hidden border border-border/20">
                  <Button
                    type="button"
                    onClick={printFilledForm}
                    variant="outline"
                    className="flex-1 text-[11px] font-black uppercase tracking-wider border-orange-600/30 text-orange-600 hover:bg-orange-600 hover:text-white cursor-pointer py-2 px-3 rounded-lg flex items-center justify-center gap-2 shadow-xs transition-all h-9 bg-card"
                  >
                    <LucideIcons.Printer className="h-4 w-4" />
                    <span>Print Form</span>
                  </Button>
                  <Button
                    type="button"
                    onClick={printEmptyForm}
                    variant="outline"
                    className="flex-1 text-[11px] font-black uppercase tracking-wider border-border/60 text-muted-foreground hover:bg-muted cursor-pointer py-2 px-3 rounded-lg flex items-center justify-center gap-2 shadow-xs transition-all h-9 bg-card"
                  >
                    <LucideIcons.FileSpreadsheet className="h-4 w-4" />
                    <span>Print Empty Form</span>
                  </Button>
                </div>
              </div>

              {/* HIGH-FIDELITY COLLAPSIBLE STEPPER HEADER */}
              <div className="max-w-xl mx-auto mb-10">
                <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-muted-foreground mb-3 px-1">
                  <span className={`flex items-center gap-1.5 transition-all duration-300 ${currentStep === 1 ? 'text-orange-600 scale-105' : 'text-emerald-500'}`}>
                    {currentStep === 1 ? (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-600 text-white font-mono text-[9px]">1</span>
                    ) : (
                      <LucideIcons.CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                    )}
                    <span>1. Personal Details</span>
                  </span>
                  <span className={`flex items-center gap-1.5 transition-all duration-300 ${currentStep === 2 ? 'text-orange-600 scale-105' : ''}`}>
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full font-mono text-[9px] ${currentStep === 2 ? 'bg-orange-600 text-white' : 'bg-muted text-muted-foreground'}`}>2</span>
                    <span>2. Project Requirements</span>
                  </span>
                </div>
                <div className="relative h-2.5 bg-muted rounded-full overflow-hidden border border-border/40">
                  <div 
                    className="absolute top-0 left-0 h-full bg-orange-600 transition-all duration-500 ease-out rounded-full"
                    style={{ width: currentStep === 1 ? '50%' : '100%' }}
                  />
                </div>
              </div>

              <form onSubmit={handleFormSubmit} className="space-y-8">
                {currentStep === 1 ? (
                  /* STEP 1: PERSONAL DETAILS */
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-6"
                  >
                    {/* Section 1: Cast Details */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 pb-1.5 border-b border-border/60">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-600 text-white text-[10px] font-bold font-mono">
                          1
                        </span>
                        <h3 className="text-xs font-black uppercase tracking-widest text-foreground">
                          Artistic & Legal Demographics
                        </h3>
                      </div>

                      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                        {/* Full Name */}
                        <div className="space-y-1">
                          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5" htmlFor="fullName">
                            <LucideIcons.User className="h-3.5 w-3.5 text-orange-600" />
                            Full Name
                          </label>
                          <input
                            type="text"
                            id="fullName"
                            name="fullName"
                            required
                            placeholder="Enter your screen or legal name"
                            value={formData.fullName}
                            onChange={(e) => handleInputChange('fullName', e.target.value)}
                            className={`w-full rounded-lg border bg-background px-4 py-2.5 text-sm text-foreground shadow-sm placeholder-muted-foreground focus:border-orange-600 focus:ring-1 focus:ring-orange-600 outline-none transition-all duration-300 ${
                              errors.fullName 
                                ? 'border-rose-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 ring-rose-500 bg-rose-500/5' 
                                : 'border-border/80 focus:border-orange-600 focus:ring-1'
                            }`}
                          />
                          {errors.fullName && (
                            <p className="text-[11px] text-rose-500 font-bold mt-1.5 flex items-center gap-1 animate-pulse">
                              <LucideIcons.AlertCircle className="h-3.5 w-3.5 flex-none" />
                              <span>{errors.fullName}</span>
                            </p>
                          )}
                        </div>

                        {/* Date of Birth */}
                        <div className="space-y-1">
                          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5" htmlFor="dateOfBirth">
                            <LucideIcons.Calendar className="h-3.5 w-3.5 text-orange-600" />
                            Date of Birth
                          </label>
                          <input
                            type="date"
                            id="dateOfBirth"
                            name="dateOfBirth"
                            required
                            max={new Date().toISOString().split('T')[0]}
                            value={formData.dateOfBirth}
                            onChange={handleDobChange}
                            className={`w-full rounded-lg border bg-background px-4 py-2.5 text-sm text-foreground shadow-sm outline-none transition-all duration-300 [color-scheme:light] ${
                              errors.dateOfBirth 
                                ? 'border-rose-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 ring-rose-500 bg-rose-500/5' 
                                : 'border-border/80 focus:border-orange-600 focus:ring-1'
                            }`}
                          />
                          {errors.dateOfBirth && (
                            <p className="text-[11px] text-rose-500 font-bold mt-1.5 flex items-center gap-1 animate-pulse">
                              <LucideIcons.AlertCircle className="h-3.5 w-3.5 flex-none" />
                              <span>{errors.dateOfBirth}</span>
                            </p>
                          )}
                        </div>

                        {/* Age (Calculated) */}
                        <div className="space-y-1">
                          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5" htmlFor="age">
                            <LucideIcons.Calculator className="h-3.5 w-3.5 text-orange-600" />
                            Calculated Age
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              id="age"
                              name="age"
                              readOnly
                              placeholder="0"
                              value={formData.age || ''}
                              className="w-full rounded-lg border border-dashed border-border/80 bg-muted/50 px-4 py-2.5 text-sm text-muted-foreground font-mono shadow-sm outline-none cursor-not-allowed select-none"
                            />
                            <span className="absolute right-3 top-2.5 text-[9px] font-bold text-orange-600 uppercase bg-orange-100 dark:bg-orange-950/30 px-1.5 py-0.5 rounded font-mono">
                              Auto
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground/80 italic">Calculated dynamically for booking roles</p>
                        </div>
                      </div>
                    </div>

                    {/* Section 2: Channels */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 pb-1.5 border-b border-border/60">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-600 text-white text-[10px] font-bold font-mono">
                          2
                        </span>
                        <h3 className="text-xs font-black uppercase tracking-widest text-foreground">
                          Outreach & Contact Channels
                        </h3>
                      </div>

                      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                        {/* Contact Phone */}
                        <div className="space-y-1">
                          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5" htmlFor="contact">
                            <LucideIcons.Phone className="h-3.5 w-3.5 text-orange-600" />
                            Contact Number
                          </label>
                          <input
                            type="tel"
                            id="contact"
                            name="contact"
                            required
                            placeholder="e.g. +233 24 123 4567"
                            value={formData.contact}
                            onChange={(e) => handleInputChange('contact', e.target.value)}
                            className={`w-full rounded-lg border bg-background px-4 py-2.5 text-sm text-foreground shadow-sm placeholder-muted-foreground outline-none transition-all duration-300 ${
                              errors.contact 
                                ? 'border-rose-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 ring-rose-500 bg-rose-500/5' 
                                : 'border-border/80 focus:border-orange-600 focus:ring-1'
                            }`}
                          />
                          {errors.contact && (
                            <p className="text-[11px] text-rose-500 font-bold mt-1.5 flex items-center gap-1 animate-pulse">
                              <LucideIcons.AlertCircle className="h-3.5 w-3.5 flex-none" />
                              <span>{errors.contact}</span>
                            </p>
                          )}
                        </div>

                        {/* WhatsApp Number */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5" htmlFor="whatsappNumber">
                              <LucideIcons.MessageSquare className="h-3.5 w-3.5 text-emerald-500 animate-pulse" />
                              WhatsApp Number
                            </label>
                            {formData.contact && (
                              <button
                                type="button"
                                onClick={copyWhatsAppFromContact}
                                className="text-[10px] text-emerald-600 dark:text-emerald-500 hover:underline hover:text-emerald-400 font-bold cursor-pointer transition-all animate-pulse"
                              >
                                Copy from Contact
                              </button>
                            )}
                          </div>
                          <input
                            type="tel"
                            id="whatsappNumber"
                            name="whatsappNumber"
                            required
                            placeholder="e.g. +233 24 123 4567"
                            value={formData.whatsappNumber}
                            onChange={(e) => handleInputChange('whatsappNumber', e.target.value)}
                            className={`w-full rounded-lg border bg-background px-4 py-2.5 text-sm text-foreground shadow-sm placeholder-muted-foreground outline-none transition-all duration-300 ${
                              errors.whatsappNumber 
                                ? 'border-rose-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 ring-rose-500 bg-rose-500/5' 
                                : 'border-border/80 focus:border-orange-600 focus:ring-1'
                            }`}
                          />
                          {errors.whatsappNumber && (
                            <p className="text-[11px] text-rose-500 font-bold mt-1.5 flex items-center gap-1 animate-pulse">
                              <LucideIcons.AlertCircle className="h-3.5 w-3.5 flex-none" />
                              <span>{errors.whatsappNumber}</span>
                            </p>
                          )}
                        </div>

                        {/* Email Address */}
                        <div className="space-y-1">
                          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5" htmlFor="emailAddress">
                            <LucideIcons.Mail className="h-3.5 w-3.5 text-orange-600" />
                            Email Address
                          </label>
                          <input
                            type="email"
                            id="emailAddress"
                            name="emailAddress"
                            required
                            placeholder="e.g. name@example.com"
                            value={formData.emailAddress}
                            onChange={(e) => handleInputChange('emailAddress', e.target.value)}
                            className={`w-full rounded-lg border bg-background px-4 py-2.5 text-sm text-foreground shadow-sm placeholder-muted-foreground outline-none transition-all duration-300 ${
                              errors.emailAddress 
                                ? 'border-rose-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 ring-rose-500 bg-rose-500/5' 
                                : 'border-border/80 focus:border-orange-600 focus:ring-1'
                            }`}
                          />
                          {errors.emailAddress && (
                            <p className="text-[11px] text-rose-500 font-bold mt-1.5 flex items-center gap-1 animate-pulse">
                              <LucideIcons.AlertCircle className="h-3.5 w-3.5 flex-none" />
                              <span>{errors.emailAddress}</span>
                            </p>
                          )}
                        </div>

                        {/* Address */}
                        <div className="space-y-1 sm:col-span-2">
                          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5" htmlFor="address">
                            <LucideIcons.MapPin className="h-3.5 w-3.5 text-orange-600" />
                            Address / Residence Location
                          </label>
                          <input
                            type="text"
                            id="address"
                            name="address"
                            required
                            placeholder="e.g. Nyinahin Close, Kumasi, Ashanti Region"
                            value={formData.address}
                            onChange={(e) => handleInputChange('address', e.target.value)}
                            className={`w-full rounded-lg border bg-background px-4 py-2.5 text-sm text-foreground shadow-sm placeholder-muted-foreground outline-none transition-all duration-300 ${
                              errors.address 
                                ? 'border-rose-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 ring-rose-500 bg-rose-500/5' 
                                : 'border-border/80 focus:border-orange-600 focus:ring-1'
                            }`}
                          />
                          {errors.address && (
                            <p className="text-[11px] text-rose-500 font-bold mt-1.5 flex items-center gap-1 animate-pulse">
                              <LucideIcons.AlertCircle className="h-3.5 w-3.5 flex-none" />
                              <span>{errors.address}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Step 1 Actions */}
                    <div className="flex flex-wrap items-center gap-3 pt-6 border-t border-border/40">
                      <Button
                        type="button"
                        onClick={saveDraft}
                        variant="outline"
                        className="border-dashed border-orange-600/40 text-orange-600 hover:bg-orange-600/5 hover:border-orange-600 font-bold h-11 px-4 rounded-xl flex items-center gap-1.5 bg-card"
                      >
                        <LucideIcons.Save className="h-4 w-4" />
                        <span>Save as Draft</span>
                      </Button>
                      <Button
                        type="button"
                        onClick={handleNextStep}
                        className="ml-auto bg-orange-600 hover:bg-orange-700 text-white font-bold h-11 px-6 rounded-xl flex items-center gap-1"
                      >
                        <span>Next: Project Requirements</span>
                        <LucideIcons.ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </motion.div>
                ) : (
                  /* STEP 2: PROJECT REQUIREMENTS */
                  <motion.div 
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-6"
                  >
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 pb-1.5 border-b border-border/60">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-600 text-white text-[10px] font-bold font-mono">
                          3
                        </span>
                        <h3 className="text-xs font-black uppercase tracking-widest text-foreground">
                          Casting Specifications & Interests
                        </h3>
                      </div>

                      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                        {/* Role type Selection */}
                        <div className="space-y-2 sm:col-span-2">
                          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                            <LucideIcons.Clapperboard className="h-3.5 w-3.5 text-orange-600" />
                            Production Role Interest
                          </label>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {['Actor / Actress', 'Skit Performer', 'Creative Writer', 'Crew / Technical'].map((role) => (
                              <button
                                key={role}
                                type="button"
                                onClick={() => handleInputChange('roleType', role)}
                                className={`p-3.5 border rounded-xl text-center capitalize transition duration-300 font-bold cursor-pointer text-xs ${
                                  formData.roleType === role
                                    ? 'border-orange-600 bg-orange-600/5 text-orange-600 dark:text-orange-400 font-black shadow-xs'
                                    : 'border-border/80 hover:bg-muted text-foreground'
                                }`}
                              >
                                {role}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Experience Selector */}
                        <div className="space-y-2 sm:col-span-2">
                          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                            <LucideIcons.Award className="h-3.5 w-3.5 text-orange-600" />
                            Experience Milestone
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {[
                              { val: 'Beginner', title: 'Beginner / Fresh Talent', desc: 'Ready for initial screen training' },
                              { val: 'Intermediate', title: 'Intermediate Talent', desc: 'Done minor sketches or background roles' },
                              { val: 'Professional', title: 'Professional Screenplay', desc: 'Full screen credentials / portfolio' }
                            ].map((exp) => (
                              <button
                                key={exp.val}
                                type="button"
                                onClick={() => handleInputChange('experienceLevel', exp.val)}
                                className={`p-3.5 border rounded-xl text-left transition duration-300 cursor-pointer ${
                                  formData.experienceLevel === exp.val
                                    ? 'border-orange-600 bg-orange-600/5 text-orange-600 dark:text-orange-400 font-bold shadow-xs'
                                    : 'border-border/80 hover:bg-muted text-foreground'
                                }`}
                              >
                                <p className="font-bold text-xs">{exp.title}</p>
                                <p className="text-[10px] text-muted-foreground mt-1 leading-snug">{exp.desc}</p>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Availability Schedule */}
                        <div className="space-y-1">
                          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5" htmlFor="availability">
                            <LucideIcons.Clock className="h-3.5 w-3.5 text-orange-600" />
                            Casting Availability Schedule
                          </label>
                          <select
                            id="availability"
                            name="availability"
                            value={formData.availability}
                            onChange={(e) => handleInputChange('availability', e.target.value)}
                            className="w-full rounded-lg border border-border/80 bg-background px-4 py-2.5 text-sm text-foreground shadow-sm focus:border-orange-600 focus:ring-1 focus:ring-orange-600 outline-none transition-all duration-300 cursor-pointer"
                          >
                            <option value="Part-time">Part-time / On-call Productions</option>
                            <option value="Full-time">Full-time / Active Shooting</option>
                            <option value="Weekends">Weekends & Commercials Only</option>
                          </select>
                        </div>

                        {/* Portfolio link */}
                        <div className="space-y-1">
                          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5" htmlFor="portfolioLink">
                            <LucideIcons.Link className="h-3.5 w-3.5 text-orange-600" />
                            Portfolio Reel Link (YouTube/TikTok/Drive)
                          </label>
                          <input
                            type="url"
                            id="portfolioLink"
                            name="portfolioLink"
                            placeholder="e.g. https://youtube.com/my-reel-credentials"
                            value={formData.portfolioLink}
                            onChange={(e) => handleInputChange('portfolioLink', e.target.value)}
                            className="w-full rounded-lg border border-border/80 bg-background px-4 py-2.5 text-sm text-foreground shadow-sm placeholder-muted-foreground focus:border-orange-600 focus:ring-1 focus:ring-orange-600 outline-none transition-all duration-300"
                          />
                          <p className="text-[10px] text-muted-foreground/80 italic">Optional but highly recommended for talent screening</p>
                        </div>

                        {/* Genres Selector */}
                        <div className="space-y-2 sm:col-span-2">
                          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                            <LucideIcons.Film className="h-3.5 w-3.5 text-orange-600" />
                            Select Genres You Excel In
                          </label>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {['Comedy Skits', 'Feature Films', 'Action / Combat', 'Drama', 'Cultural / Folk', 'TV Serials', 'Modeling / Ads', 'Romantic Comedy'].map((genre) => {
                              const isChecked = formData.preferredGenres.includes(genre);
                              return (
                                <button
                                  key={genre}
                                  type="button"
                                  onClick={() => {
                                    const currentGenres = [...formData.preferredGenres];
                                    if (isChecked) {
                                      handleInputChange('preferredGenres', currentGenres.filter(g => g !== genre));
                                    } else {
                                      handleInputChange('preferredGenres', [...currentGenres, genre]);
                                    }
                                  }}
                                  className={`p-3 border rounded-xl text-center transition duration-300 font-semibold cursor-pointer text-[11px] ${
                                    isChecked
                                      ? 'border-orange-600 bg-orange-600/5 text-orange-600 dark:text-orange-400 font-bold'
                                      : 'border-border/80 hover:bg-muted text-foreground'
                                  }`}
                                >
                                  {genre}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Bio Pitch Textarea */}
                        <div className="space-y-1 sm:col-span-2">
                          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5" htmlFor="bio">
                            <LucideIcons.Sparkles className="h-4 w-4 text-orange-600 shrink-0" />
                            Special Skills & Supporting Bio Pitch
                          </label>
                          <textarea
                            id="bio"
                            name="bio"
                            rows={4}
                            placeholder="Describe special talents (e.g., accent fluencies, comedic punch timing, martial arts stunts, facial modeling flexes, etc.)..."
                            value={formData.bio}
                            onChange={(e) => handleInputChange('bio', e.target.value)}
                            className="w-full rounded-lg border border-border/80 bg-background px-4 py-3 text-sm text-foreground placeholder-muted-foreground focus:border-orange-600 focus:ring-1 focus:ring-orange-600 outline-none transition-all duration-300"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Step 2 Actions */}
                    <div className="flex flex-wrap items-center gap-3 pt-6 border-t border-border/40">
                      <Button
                        type="button"
                        onClick={handleBackStep}
                        variant="outline"
                        className="border-border text-muted-foreground hover:bg-muted hover:text-foreground font-bold h-11 px-5 rounded-xl flex items-center gap-1 bg-card"
                      >
                        <LucideIcons.ArrowLeft className="h-4 w-4" />
                        <span>Back</span>
                      </Button>
                      <Button
                        type="button"
                        onClick={saveDraft}
                        variant="outline"
                        className="border-dashed border-orange-600/40 text-orange-600 hover:bg-orange-600/5 hover:border-orange-600 font-bold h-11 px-4 rounded-xl flex items-center gap-1.5 bg-card"
                      >
                        <LucideIcons.Save className="h-4 w-4" />
                        <span>Save as Draft</span>
                      </Button>
                      <Button
                        type="submit"
                        disabled={submitting}
                        className="ml-auto bg-orange-600 hover:bg-orange-700 text-white font-bold h-11 px-6 rounded-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {submitting ? (
                          <>
                            <LucideIcons.Loader2 className="h-5 w-5 animate-spin" />
                            <span>Transmitting...</span>
                          </>
                        ) : (
                          <>
                            <LucideIcons.Film className="h-5 w-5 animate-pulse" />
                            <span>Submit Film Intake</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </motion.div>
                )}
              </form>
            </>
          )}
        </motion.div>
      </div>
    </div>

    {/* Elegant Printable Overlay (Pure-white High-contrast design visible ONLY in Print) */}
    <div className="hidden print:block absolute inset-0 bg-white text-black p-10 font-sans min-h-screen">
        <div className="max-w-4xl mx-auto border-4 border-black p-8 space-y-6 bg-white min-h-[95vh] flex flex-col justify-between">
          <div>
            {/* Header Letterhead */}
            <div className="text-center border-b-4 border-black pb-4 relative">
              <h1 className="text-2xl font-black uppercase tracking-widest text-center text-black">
                GREFAS ENTERTAINMENT & PRODUCTIONS
              </h1>
              <p className="text-xs uppercase tracking-widest font-black mt-1 text-black/80">
                Official Film Casting & Talent Management Division
              </p>
              <div className="mt-4 flex justify-between text-[10px] font-mono font-bold text-black border-t border-black/30 pt-2">
                <span>INTAKE UNIT: ASHANTI REGION / KUMASI</span>
                <span>REGISTRATION FORM ID: GEP-CAST-{Math.floor(100000 + Math.random() * 900000)}</span>
              </div>
            </div>

            {/* Official Title Bar */}
            <div className="text-center py-2.5 bg-black text-white px-4 my-6">
              <h2 className="text-sm font-black uppercase tracking-widest">
                OFFICIAL ACTOR CASTING & SKIT INTAKE REGISTRY
              </h2>
            </div>

            {/* Section 1: Candidate Profile */}
            <div className="space-y-4 my-6">
              <h3 className="text-xs font-black uppercase tracking-widest border-b-2 border-black pb-1">
                1. TALENT BIODATA COGNIZANCE
              </h3>
              <div className="grid grid-cols-2 gap-y-5 text-sm pt-2">
                <div className="col-span-2">
                  <span className="font-extrabold uppercase text-xs">Legal or Screen Name:</span>
                  <span className="ml-2 border-b-2 border-black border-dotted pb-0.5 inline-block w-[78%] min-h-[22px] pl-3 font-mono font-bold text-base text-gray-900">
                    {printableData ? printableData.fullName : '____________________________________________________'}
                  </span>
                </div>
                <div>
                  <span className="font-extrabold uppercase text-xs">Date of Birth:</span>
                  <span className="ml-2 border-b-2 border-black border-dotted pb-0.5 inline-block w-[65%] min-h-[20px] pl-3 font-mono">
                    {printableData ? printableData.dateOfBirth : '__________________________'}
                  </span>
                </div>
                <div>
                  <span className="font-extrabold uppercase text-xs">Verified Age:</span>
                  <span className="ml-2 border-b-2 border-black border-dotted pb-0.5 inline-block w-[65%] min-h-[20px] pl-3 font-mono font-bold">
                    {printableData ? `${printableData.age} years old` : '__________ years old'}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="font-extrabold uppercase text-xs text-nowrap">Residential Address:</span>
                  <span className="ml-2 border-b-2 border-black border-dotted pb-0.5 inline-block w-[78%] min-h-[20px] pl-3 font-mono">
                    {printableData ? printableData.address : '____________________________________________________'}
                  </span>
                </div>
              </div>
            </div>

            {/* Section 2: Contact Vectors */}
            <div className="space-y-4 my-8">
              <h3 className="text-xs font-black uppercase tracking-widest border-b-2 border-black pb-1">
                2. PRIMARY COMMUNICATION OUTREACH
              </h3>
              <div className="grid grid-cols-2 gap-y-5 text-sm pt-2">
                <div>
                  <span className="font-extrabold uppercase text-xs">Primary Dial:</span>
                  <span className="ml-2 border-b-2 border-black border-dotted pb-0.5 inline-block w-[68%] min-h-[20px] pl-3 font-mono">
                    {printableData ? printableData.contact : '__________________________'}
                  </span>
                </div>
                <div>
                  <span className="font-extrabold uppercase text-xs">WhatsApp Pointer:</span>
                  <span className="ml-2 border-b-2 border-black border-dotted pb-0.5 inline-block w-[60%] min-h-[20px] pl-3 font-mono">
                    {printableData ? printableData.whatsappNumber : '__________________________'}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="font-extrabold uppercase text-xs">Email Coordinate:</span>
                  <span className="ml-2 border-b-2 border-black border-dotted pb-0.5 inline-block w-[78%] min-h-[20px] pl-3 font-mono">
                    {printableData ? printableData.emailAddress : '____________________________________________________'}
                  </span>
                </div>
              </div>
            </div>

            {/* Section 3: Performance Assessment (For Casting Director Use Only) */}
            <div className="space-y-4 my-8">
              <h3 className="text-xs font-black uppercase tracking-widest border-b-2 border-black pb-1">
                3. GREFAS AUDITION SCORE & VERDICT (DIRECTOR USE ONLY)
              </h3>
              <div className="grid grid-cols-4 gap-4 text-[10px] text-center pt-2">
                <div className="border-2 border-black p-2.5 rounded bg-gray-50">
                  <div className="font-black uppercase tracking-wider text-[9px] mb-1">ACTING RANGE</div>
                  <div className="text-xs font-mono font-bold mt-2">A / B / C / D</div>
                </div>
                <div className="border-2 border-black p-2.5 rounded bg-gray-50">
                  <div className="font-black uppercase tracking-wider text-[9px] mb-1">VOICE & DIALECT</div>
                  <div className="text-xs font-mono font-bold mt-2">A / B / C / D</div>
                </div>
                <div className="border-2 border-black p-2.5 rounded bg-gray-50">
                  <div className="font-black uppercase tracking-wider text-[9px] mb-1">CAMERA LOOKS</div>
                  <div className="text-xs font-mono font-bold mt-2">A / B / C / D</div>
                </div>
                <div className="border-2 border-black p-2.5 rounded bg-gray-50">
                  <div className="font-black uppercase tracking-wider text-[9px] mb-1">IMPROVISATION</div>
                  <div className="text-xs font-mono font-bold mt-2">A / B / C / D</div>
                </div>
              </div>
              <div className="text-xs space-y-2 mt-4 leading-relaxed bg-gray-50 border-2 border-slate-300 p-3 rounded">
                <p className="font-black uppercase tracking-widest text-[10px]">CASTING DIRECTOR SPECIAL REMARKS / NOTES:</p>
                <div className="min-h-[50px] p-1 text-black/50 text-[10px] italic font-mono">
                  [Note physical casting suitability, comedic skit timing points, facial expressiveness, or role recommendations...]
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Sign-off Commitment */}
          <div className="space-y-5 pt-4 border-t-2 border-black/30 mt-auto">
            <p className="text-[10px] text-black/90 leading-relaxed text-center font-bold">
              By signing below, the talent attests that all self-reported credentials and contact pointers recorded in the Grefas Casting registration system are accurate. Complete recordings are safely stored behind database encryptions.
            </p>
            <div className="flex justify-between text-xs pt-4 font-mono font-bold">
              <div className="w-1/2">
                <div className="border-t-2 border-black w-[80%] pt-1 mt-6 text-center uppercase text-[10px]">
                  Candidate Signature
                </div>
                <div className="text-[9px] text-black/60 text-center w-[80%] mt-1">
                  Date: ____ / ____ / ________
                </div>
              </div>
              <div className="w-1/2 flex flex-col items-end">
                <div className="border-t-2 border-black w-[80%] pt-1 mt-6 text-center uppercase text-[10px]">
                  Authorized Director
                </div>
                <div className="text-[9px] text-black/60 text-center w-[85%] mt-1">
                  Grefas Verification Stamp
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Elegant Responsive Printable Preview Modal (Pure design visible on screen, hidden in print, handles all devices) */}
      <AnimatePresence>
        {showPrintModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto print:hidden">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-card border border-border/80 w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-border px-5 py-3.5 bg-muted/40 font-sans">
                <div className="flex items-center gap-2">
                  <div className="bg-orange-100 dark:bg-orange-950/40 p-1.5 rounded-lg text-orange-600">
                    <LucideIcons.Printer className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-xs sm:text-sm uppercase tracking-wider text-foreground">
                      Casting Card Print Preview
                    </h3>
                    <p className="text-[10px] text-muted-foreground font-mono">
                      {printableData ? 'Preserving submitted data' : 'Blank registration form'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="text-muted-foreground hover:text-foreground hover:bg-muted p-1.5 rounded-xl cursor-pointer transition-all"
                  aria-label="Close Preview"
                >
                  <LucideIcons.X className="h-5 w-5" />
                </button>
              </div>

              {/* Advisory Alert */}
              <div className="bg-orange-50 dark:bg-orange-950/20 border-b border-orange-200/20 px-5 py-2.5 text-[11px] leading-relaxed text-orange-700 dark:text-orange-400 flex items-start gap-2">
                <LucideIcons.AlertCircle className="h-4.5 w-4.5 text-orange-500 mt-0.5 flex-none animate-pulse" />
                <div>
                  <span className="font-extrabold uppercase">Notice:</span> Inside the preview sandbox, standard print triggers may be restricted by security contexts. If clicking <span className="font-bold underline text-foreground">Launch System Print</span> behaves unresponsively, please use the <span className="font-bold">New Tab Button</span> in the top-right to print/save smoothly.
                </div>
              </div>

              {/* Document Sheet Body */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-zinc-150 dark:bg-zinc-950/80 flex justify-center border-b border-border">
                {/* Visual rendering resembling an A4 document page */}
                <div 
                  className="w-full max-w-2xl bg-white text-black p-5 sm:p-10 font-sans border-2 border-black rounded-lg shadow-lg flex flex-col justify-between select-text selection:bg-orange-200 selection:text-black min-h-[750px] aspect-[1/1.4]"
                  id="print-preview-modal-document-sheet"
                >
                  <div>
                    {/* Brand Identifier */}
                    <div className="text-center border-b-4 border-black pb-3 relative">
                      <h1 className="text-lg sm:text-2xl font-black uppercase tracking-widest text-black">
                        GREFAS ENTERTAINMENT & PRODUCTIONS
                      </h1>
                      <p className="text-[9px] sm:text-[11px] uppercase tracking-widest font-black mt-1 text-black/80">
                        Official Film Casting & Talent Management Division
                      </p>
                      <div className="mt-3.5 flex justify-between text-[8px] sm:text-[10px] font-mono font-bold text-black border-t border-black/20 pt-1.5">
                        <span>INTAKE REGION: ASHANTI, GHANA</span>
                        <span>FORM CODE: GEP-CAST-{Math.floor(111111 + Math.random() * 888888)}</span>
                      </div>
                    </div>

                    {/* Registry Tag */}
                    <div className="text-center py-2 bg-black text-white px-3 my-4 sm:my-5 rounded-sm">
                      <h2 className="text-[10px] sm:text-xs font-black uppercase tracking-widest">
                        ACTOR CASTING & SKIT INTEGRATION FORM
                      </h2>
                    </div>

                    {/* Visual Segment 1 */}
                    <div className="space-y-2.5 my-4 sm:my-6">
                      <h3 className="text-[10px] sm:text-xs font-black uppercase tracking-widest border-b-2 border-black pb-0.5">
                        1. TALENT PROFILE REGISTRATION
                      </h3>
                      <div className="grid grid-cols-2 gap-y-3 text-xs pt-1">
                        <div className="col-span-2 flex flex-wrap items-end gap-1.5">
                          <span className="font-extrabold uppercase text-[10px] text-black">Candidate Name:</span>
                          <span className="flex-1 border-b border-black/40 pb-0.5 font-mono font-extrabold text-sm text-neutral-900 px-2 min-w-[200px]">
                            {printableData ? printableData.fullName : '____________________________________________________'}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-end gap-1.5">
                          <span className="font-extrabold uppercase text-[10px] text-black">Birth Date:</span>
                          <span className="flex-1 border-b border-black/40 pb-0.5 font-mono px-2 text-neutral-800">
                            {printableData ? printableData.dateOfBirth : '_______________________'}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-end gap-1.5">
                          <span className="font-extrabold uppercase text-[10px] text-black">Verified Age:</span>
                          <span className="flex-1 border-b border-black/40 pb-0.5 font-mono font-bold px-2 text-neutral-900">
                            {printableData ? `${printableData.age} years old` : '________ years old'}
                          </span>
                        </div>
                        <div className="col-span-2 flex flex-wrap items-end gap-1.5">
                          <span className="font-extrabold uppercase text-[10px] text-black">Location (Address):</span>
                          <span className="flex-1 border-b border-black/40 pb-0.5 font-mono px-2 text-neutral-800 min-w-[200px]">
                            {printableData ? printableData.address : '____________________________________________________'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Visual Segment 2 */}
                    <div className="space-y-2.5 my-5 sm:my-7">
                      <h3 className="text-[10px] sm:text-xs font-black uppercase tracking-widest border-b-2 border-black pb-0.5">
                        2. OFFICIAL COMMUNICATION HUBS
                      </h3>
                      <div className="grid grid-cols-2 gap-y-3 text-xs pt-1">
                        <div className="flex flex-wrap items-end gap-1.5">
                          <span className="font-extrabold uppercase text-[10px] text-black">Phone Connection:</span>
                          <span className="flex-1 border-b border-black/40 pb-0.5 font-mono px-2 text-neutral-800">
                            {printableData ? printableData.contact : '_______________________'}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-end gap-1.5">
                          <span className="font-extrabold uppercase text-[10px] text-black">WhatsApp Link:</span>
                          <span className="flex-1 border-b border-black/40 pb-0.5 font-mono px-2 text-neutral-800">
                            {printableData ? printableData.whatsappNumber : '_______________________'}
                          </span>
                        </div>
                        <div className="col-span-2 flex flex-wrap items-end gap-1.5">
                          <span className="font-extrabold uppercase text-[10px] text-black">Email Coordinates:</span>
                          <span className="flex-1 border-b border-black/40 pb-0.5 font-mono px-2 text-neutral-800">
                            {printableData ? printableData.emailAddress : '____________________________________________________'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Visual Segment 3 */}
                    <div className="space-y-2.5 my-5 sm:my-7">
                      <h3 className="text-[10px] sm:text-xs font-black uppercase tracking-widest border-b-2 border-black pb-0.5">
                        3. SCREEN TEST & AUDITION REPORT (OFFICIAL)
                      </h3>
                      <div className="grid grid-cols-4 gap-2 text-center text-[8px] sm:text-[10px] pt-1">
                        <div className="border border-black p-1.5 rounded-sm bg-neutral-50/50">
                          <div className="font-black uppercase tracking-wider text-[7px] sm:text-[8px] text-black/80">ACTING RANGE</div>
                          <div className="font-mono font-extrabold mt-1 text-black">A / B / C / D</div>
                        </div>
                        <div className="border border-black p-1.5 rounded-sm bg-neutral-50/50">
                          <div className="font-black uppercase tracking-wider text-[7px] sm:text-[8px] text-black/80">COMMUNICATION</div>
                          <div className="font-mono font-extrabold mt-1 text-black">A / B / C / D</div>
                        </div>
                        <div className="border border-black p-1.5 rounded-sm bg-neutral-50/50">
                          <div className="font-black uppercase tracking-wider text-[7px] sm:text-[8px] text-black/80">CAMERA GLAM</div>
                          <div className="font-mono font-extrabold mt-1 text-black">A / B / C / D</div>
                        </div>
                        <div className="border border-black p-1.5 rounded-sm bg-neutral-50/50">
                          <div className="font-black uppercase tracking-wider text-[7px] sm:text-[8px] text-black/80">PRESENCE</div>
                          <div className="font-mono font-extrabold mt-1 text-black">A / B / C / D</div>
                        </div>
                      </div>
                      <div className="text-[11px] space-y-1 mt-3 bg-neutral-50 border border-neutral-350 p-2 rounded-sm text-black">
                        <span className="font-extrabold text-[9px] uppercase tracking-wider text-black">AUDITION STAGE COMMENTS:</span>
                        <div className="min-h-[40px] text-[9px] italic font-mono text-neutral-400 mt-1">
                          [Assessment of cast suitability for comedies, skits, main features or modeling roles...]
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Signatures */}
                  <div className="space-y-3.5 pt-3 border-t border-black/20 mt-auto">
                    <p className="text-[8px] sm:text-[9px] text-black/90 leading-tight text-center font-bold">
                      By signing, the talent verifies that self-submitted communication channels and credentials are fully correct and active.
                    </p>
                    <div className="flex justify-between text-[9px] sm:text-[10px] pt-1 font-mono font-bold text-black pb-1">
                      <div className="w-1/2">
                        <div className="border-t border-black w-[80%] pt-0.5 mt-4 text-center uppercase text-[8px] sm:text-[9px]">
                          Candidate Signature
                        </div>
                        <div className="text-[7px] sm:text-[8px] text-neutral-500 text-center w-[80%] mt-0.5">
                          Date: ____ / ____ / ________
                        </div>
                      </div>
                      <div className="w-1/2 flex flex-col items-end">
                        <div className="border-t border-black w-[80%] pt-0.5 mt-4 text-center uppercase text-[8px] sm:text-[9px]">
                          Authorized Officer
                        </div>
                        <div className="text-[7px] sm:text-[8px] text-neutral-500 text-center w-[85%] mt-0.5">
                          Production Stamp Space
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="p-4 sm:p-5 bg-muted/30 flex flex-col sm:flex-row gap-3 font-sans">
                <Button
                  onClick={() => {
                    try {
                      window.print();
                    } catch (e) {
                      toast.error("Standard system printing trigger failed inside sandbox iframe.");
                    }
                  }}
                  className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-black h-12 uppercase tracking-wider rounded-xl shadow-lg cursor-pointer flex items-center justify-center gap-2 transition-all"
                >
                  <LucideIcons.Printer className="h-4.5 w-4.5" />
                  <span>Launch System Print</span>
                </Button>
                <Button
                  onClick={() => setShowPrintModal(false)}
                  variant="outline"
                  className="sm:w-32 border-border/80 text-muted-foreground hover:bg-muted font-bold h-12 rounded-xl cursor-pointer"
                >
                  Close Preview
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
