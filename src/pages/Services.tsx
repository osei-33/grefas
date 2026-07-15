import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import * as LucideIcons from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from '@/firebase';
import { collection, onSnapshot, query, orderBy, addDoc, where, getDocs, doc } from 'firebase/firestore';
import { toast } from 'sonner';
import SEO from '@/components/SEO';
import Breadcrumbs from '@/components/Breadcrumbs';
import { compressImage, blobToBase64 } from '@/lib/utils';

const consultingImg = '/src/assets/images/service_consulting_1782127444377.jpg';
const entertainmentImg = '/src/assets/images/service_entertainment_1782127460075.jpg';
const artistImg = '/src/assets/images/service_artist_1782127476185.jpg';

export default function Services() {
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('All');
  const [globalSettings, setGlobalSettings] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  
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
    passportPhoto: '', // Custom Base64 encoded passport size photo
    // Step 2: Project Requirements / Casting Specifications
    roleType: 'Actor / Actress',
    roleTypes: ['Actor / Actress'] as string[],
    experienceLevel: 'Intermediate',
    preferredGenres: [] as string[],
    availability: 'Part-time',
    portfolioLink: '',
    bio: '',
    signature: ''
  });
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [intakePrice, setIntakePrice] = useState<number>(50);
  const [priceConfirmed, setPriceConfirmed] = useState<boolean>(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [printableData, setPrintableData] = useState<any | null>(null);
  const [lastSubmittedSnapshot, setLastSubmittedSnapshot] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccessState, setShowSuccessState] = useState(false);
  const [submittedName, setSubmittedName] = useState('');
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Digital Signature Canvas references & drawing states
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signatureMode, setSignatureMode] = useState<'draw' | 'upload'>('draw');

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
  }, [currentStep, formData.signature, signatureMode]);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    // Scale the coordinate drawing based on the actual layout dimensions
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
    setFormData(prev => ({
      ...prev,
      signature: dataUrl
    }));
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    setFormData(prev => ({
      ...prev,
      signature: ''
    }));
  };

  const handleSignatureFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Invalid file type. Please upload an image file for your signature.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target && typeof event.target.result === 'string') {
        setFormData(prev => ({
          ...prev,
          signature: event.target!.result as string
        }));
        toast.success('Signature image uploaded and captured successfully!');
      }
    };
    reader.onerror = () => {
      toast.error('Failed to read the signature file.');
    };
    reader.readAsDataURL(file);
  };

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
    const bookingUrl = window.location.origin + '/services';
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(bookingUrl)}`;

    printWindow.document.write(`
      <html>
        <head>
          <title>Grefas Entertainment - Casting Intake Registry</title>
          <style>
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              box-sizing: border-box;
            }
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
              border: 3px solid #000 !important;
              padding: 30px;
              border-radius: 6px;
              min-height: 90vh;
              display: flex;
              justify-content: space-between;
              flex-direction: column;
              box-sizing: border-box;
            }
            .header {
              text-align: center;
              border-bottom: 4px solid #000 !important;
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
              border-top: 1px solid #ddd !important;
              padding-top: 6px;
            }
            .registry-tag {
              text-align: center;
              background-color: #000 !important;
              color: #fff !important;
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
              border-bottom: 2px solid #000 !important;
              padding-bottom: 3px;
              margin-bottom: 12px;
            }
            .profile-layout {
              display: flex;
              gap: 20px;
              align-items: start;
            }
            .field-grid {
              display: grid;
              grid-template-cols: 1fr 1fr;
              row-gap: 15px;
              column-gap: 20px;
              font-size: 13px;
              flex: 1;
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
              border-bottom: 1px solid #444 !important;
              padding-bottom: 2px;
              font-family: monospace;
              padding-left: 5px;
              min-height: 18px;
            }
            .field-value.highlight {
              font-weight: bold;
              font-size: 14px;
            }
            .passport-box {
              width: 105px;
              height: 125px;
              border: 2px dashed #000 !important;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              text-align: center;
              padding: 2px;
              background-color: #fafafa !important;
              flex-shrink: 0;
              box-sizing: border-box;
            }
            .score-grid {
              display: grid;
              grid-template-cols: repeat(4, 1fr);
              gap: 10px;
              text-align: center;
              margin-top: 10px;
            }
            .score-card {
              border: 2px solid #000 !important;
              padding: 8px;
              background-color: #fafafa !important;
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
              border: 2px solid #000 !important;
              padding: 12px;
              background-color: #fafafa !important;
              border-radius: 4px;
              font-size: 11px;
            }
            .sign-off {
              margin-top: auto;
              border-top: 1px solid #eee !important;
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
              border-top: 2px solid #000 !important;
              width: 180px;
              text-align: center;
              padding-top: 5px;
              text-transform: uppercase;
              font-size: 9px;
            }
            .no-print-btn-bar {
              background-color: #f1f5f9 !important;
              padding: 12px 20px;
              border-radius: 8px;
              margin-bottom: 20px;
              display: flex;
              justify-content: flex-end;
            }
            .print-btn {
              background-color: #ea580c !important;
              color: white !important;
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
            /* High fidelity watermark background styling */
            .watermark-container {
              position: fixed;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              display: flex;
              align-items: center;
              justify-content: center;
              pointer-events: none;
              z-index: 1;
            }
            .watermark {
              width: 360px;
              height: auto;
              max-height: 360px;
              object-fit: contain;
              transform: rotate(-15deg);
              opacity: 0.04;
            }
            .printable-wrapper {
              position: relative;
              z-index: 10;
              height: 100%;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
            }
          </style>
        </head>
        <body>
          <div class="no-print no-print-btn-bar">
            <button class="print-btn" onclick="window.print()">Print Document</button>
          </div>

          <!-- Watermark Background -->
          <div class="watermark-container">
            ${(globalSettings && globalSettings.logoUrl)
              ? `<img src="${globalSettings.logoUrl}" class="watermark" alt="Watermark Logo" referrerPolicy="no-referrer" />`
              : `<div class="watermark" style="font-family: sans-serif; font-size: 40px; font-weight: 900; color: #000; opacity: 0.03; text-align: center;">GREFAS CONSULT</div>`
            }
          </div>

          <div class="printable-wrapper">
            <div class="border-box">
            <div>
              <div class="header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 4px solid #000 !important; padding-bottom: 15px; margin-bottom: 25px; text-align: left;">
                <div style="flex: 1; text-align: left;">
                  <h1 style="margin: 0; font-size: 22px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase;">GREFAS ENTERTAINMENT & PRODUCTIONS</h1>
                  <p style="margin: 5px 0 0 0; font-size: 11px; text-transform: uppercase; font-weight: bold; letter-spacing: 1px; color: #333;">Official Film Casting & Talent Management Division</p>
                  <div class="meta-bar" style="margin-top: 10px; display: flex; justify-content: space-between; font-family: monospace; font-size: 9px; font-weight: bold; border-top: 1px solid #ddd !important; padding-top: 6px;">
                    <span>INTAKE REGION: ASHANTI, GHANA</span>
                    <span>TIME: ${regDate}</span>
                  </div>
                </div>
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; margin-left: 20px; border: 2px solid #000 !important; padding: 4px; background-color: #fff !important; border-radius: 4px; width: 70px; height: 70px; flex-shrink: 0;">
                  <img src="${qrCodeUrl}" style="height: 60px; width: 60px; display: block;" alt="Verify" />
                </div>
              </div>

              <div class="registry-tag">
                <h2>ACTOR CASTING & SKIT INTEGRATION FORM</h2>
              </div>

              <!-- Segment 1 -->
              <div class="section">
                <div class="section-title">1. Personal Biodata & Demographics</div>
                <div class="profile-layout">
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
                  <div class="passport-box">
                    ${data?.passportPhoto ? `<img src="${data.passportPhoto}" style="width: 100%; height: 100%; object-fit: cover;" />` : `<div style="font-size: 7.5px; font-weight: bold; text-transform: uppercase; color: #555; line-height: 1.2;">Affix<br>Passport<br>Size Photo<br>Here</div>`}
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

              <!-- Segment 3 -->
              <div class="section">
                <div class="section-title">3. Production Roles & Casting Details</div>
                <div class="field-grid">
                  <div class="field">
                    <span class="field-label">Prescribed Role:</span>
                    <span class="field-value font-bold">${data?.roleType || '_______________________ (Actor / Actress, Crew, etc.)'}</span>
                  </div>
                  <div class="field">
                    <span class="field-label">Experience Stage:</span>
                    <span class="field-value font-bold">${data?.experienceLevel || '_______________________ (Beginner, Intermediate, Pro)'}</span>
                  </div>
                  <div class="field">
                    <span class="field-label">Availability Schedule:</span>
                    <span class="field-value">${data?.availability || '_______________________ (Full-time, Part-time, Project-basis)'}</span>
                  </div>
                  <div class="field">
                    <span class="field-label">Portfolio URL link:</span>
                    <span class="field-value" style="font-size: 11px;">${data?.portfolioLink || '_______________________'}</span>
                  </div>
                  <div class="field field-span-2">
                    <span class="field-label">Selected Genres:</span>
                    <span class="field-value">${data?.preferredGenres && data.preferredGenres.length > 0 ? data.preferredGenres.join(', ') : '____________________________________________________'}</span>
                  </div>
                  <div class="field field-span-2">
                    <span class="field-label">Short Talent Pitch:</span>
                    <span class="field-value" style="font-size: 11px;">${data?.bio || '____________________________________________________________________________________________________________________________________________________'}</span>
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
                  <strong>AUDITION REGISTER SCREENING NOTES & REELS EVALUATE:</strong>
                  <div style="min-height: 40px; color: #555; margin-top: 6px; font-style: italic; font-size: 10px;">
                    [Screen compliance markers, dialect notes, stage styling notes for skit or full series casting suitability]
                  </div>
                </div>
              </div>
            </div>

            <div class="sign-off">
              <p style="text-align: center; font-size: 9px; margin-bottom: 25px; line-height: 1.4; font-weight: bold;">
                By signing, the talent verifies that self-submitted communication channels and credentials are fully correct and active.
              </p>
              <div class="signatures-grid">
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: flex-end; min-height: 80px;">
                  ${data?.signature ? `<img src="${data.signature}" style="max-height: 50px; max-width: 150px; object-fit: contain; margin-bottom: 5px;" alt="Signature" />` : `<div style="height: 50px;"></div>`}
                  <div class="sig-line">Candidate Signature</div>
                  <div style="text-align: center; font-size: 8px; color: #555; margin-top: 4px;">Date: ${new Date(regDate).toLocaleDateString()}</div>
                </div>
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: flex-end; min-height: 80px;">
                  ${(globalSettings && globalSettings.adminSignature) ? `
                    <img src="${globalSettings.adminSignature}" style="max-height: 48px; max-width: 140px; object-fit: contain; margin-bottom: 2px;" alt="Stamp" referrerPolicy="no-referrer" />
                  ` : `<div style="height: 40px;"></div>`}
                  <div class="sig-line" style="font-weight: bold; text-align: center;">
                    ${(globalSettings && globalSettings.adminSignatureName) ? globalSettings.adminSignatureName : 'CEO / General Manager / Secretary / Admin Signature'}
                  </div>
                  <div style="text-align: center; font-size: 7px; color: #555; text-transform: uppercase; font-weight: bold; margin-top: 2px;">
                    ${(globalSettings && globalSettings.adminSignatureTitle) ? globalSettings.adminSignatureTitle : 'Authorized Signature'}
                  </div>
                  <div style="text-align: center; font-size: 8px; color: #555; margin-top: 4px;">Date: ${new Date().toLocaleDateString()}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

          <script>
            window.addEventListener('load', function() {
              var images = document.getElementsByTagName('img');
              var loadedCount = 0;
              var totalImages = images.length;
              var printTriggered = false;

              function triggerPrint() {
                if (printTriggered) return;
                printTriggered = true;
                window.print();
              }

              // Safety timeout: If images fail or load extremely slow, trigger print anyway after 1.5 seconds!
              setTimeout(triggerPrint, 1500);
              
              if (totalImages === 0) {
                triggerPrint();
                return;
              }
              
              function onImageLoad() {
                loadedCount++;
                if (loadedCount === totalImages) {
                  setTimeout(triggerPrint, 500);
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
    toast.success('Triggered safe printing in new tab!');
  };

  const downloadAsPDF = async () => {
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const data = printableData || {
        fullName: '',
        dateOfBirth: '',
        age: 0,
        address: '',
        contact: '',
        whatsappNumber: '',
        emailAddress: '',
        passportPhoto: '',
        signature: ''
      };

      // Elegant Outer Border
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.8);
      doc.rect(15, 15, 180, 267);

      // Robust Professional Watermark
      doc.saveGraphicsState();
      doc.setTextColor(242, 244, 247);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(36);
      doc.text('GREFAS CONSULT', 105, 150, { align: 'center', angle: 30 });
      doc.restoreGraphicsState();

      // Header separation line
      doc.setLineWidth(1.2);
      doc.line(15, 48, 195, 48);

      // Brand Title text
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(15);
      doc.setTextColor(0, 0, 0);
      doc.text('GREFAS ENTERTAINMENT & PRODUCTIONS', 18, 25);

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(50, 50, 50);
      doc.text('Official Film Casting & Talent Management Division', 18, 30);

      // Subheader thin lines and region
      doc.setLineWidth(0.2);
      doc.setDrawColor(180, 180, 180);
      doc.line(18, 35, 150, 35);

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 100, 100);
      doc.text('INTAKE REGION: ASHANTI, GHANA', 18, 41);
      doc.text('FORM CODE: GEP-CAST-648123', 85, 41);
      
      // QR Code Generator (Embedded dynamic QR or placeholder)
      try {
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(window.location.origin + '/services')}`;
        const img = new Image();
        img.src = qrUrl;
        img.crossOrigin = "Anonymous";
        await new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve; // Continue on error if network is down or CORS block
        });
        if (img.complete && img.naturalWidth > 0) {
          doc.addImage(img, 'PNG', 162, 17, 26, 26);
          doc.setFont('Helvetica', 'bold');
          doc.setFontSize(5);
          doc.setTextColor(80, 80, 80);
          doc.text('VERIFY INTAKE', 175, 45, { align: 'center' });
        } else {
          doc.rect(162, 17, 26, 26);
          doc.setFont('Helvetica', 'bold');
          doc.setFontSize(6);
          doc.setTextColor(100, 100, 100);
          doc.text('[QR CODE]', 175, 30, { align: 'center' });
        }
      } catch (e) {
        console.warn("Could not insert dynamic QR to PDF", e);
      }

      // Registry Banner Black Block
      doc.setFillColor(0, 0, 0);
      doc.rect(18, 52, 174, 8, 'F');
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.text('ACTOR CASTING & SKIT INTEGRATION FORM', 105, 57.5, { align: 'center' });

      // Reset text color to black
      doc.setTextColor(0, 0, 0);

      // Section 1 Header
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.text('1. TALENT PROFILE REGISTRATION', 18, 70);
      doc.setLineWidth(0.5);
      doc.setDrawColor(0, 0, 0);
      doc.line(18, 72, 192, 72);

      // Registration fields
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('Candidate Name:', 18, 81);
      doc.text('Birth Date:', 18, 89);
      doc.text('Verified Age:', 18, 97);
      doc.text('Location (Address):', 18, 105);

      // User values
      doc.setFont('Courier', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(40, 40, 40);
      doc.text(data.fullName || '____________________________________________________', 50, 81);
      doc.text(data.dateOfBirth || '_______________________', 50, 89);
      doc.text(data.age ? `${data.age} years old` : '________ years old', 50, 97);
      doc.text(data.address || '____________________________________________________', 50, 105);

      // Passport Photo Frame & Box
      if (data.passportPhoto && data.passportPhoto.startsWith('data:')) {
        try {
          doc.addImage(data.passportPhoto, 'JPEG', 157, 76, 25, 30);
        } catch (err) {
          console.warn("Failed rendering passport photo in jsPDF:", err);
          doc.setLineWidth(0.2);
          doc.setDrawColor(100, 100, 100);
          doc.rect(157, 76, 25, 30);
          doc.setFont('Helvetica', 'bold');
          doc.setFontSize(6);
          doc.text('PASSPORT', 169.5, 88, { align: 'center' });
          doc.text('PHOTO HERE', 169.5, 92, { align: 'center' });
        }
      } else {
        // Draw dashed passport photo box
        doc.setLineWidth(0.3);
        doc.setDrawColor(50, 50, 50);
        doc.rect(157, 76, 25, 30);
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(6);
        doc.text('AFFIX', 169.5, 87, { align: 'center' });
        doc.text('PASSPORT', 169.5, 91, { align: 'center' });
        doc.text('PHOTO HERE', 169.5, 95, { align: 'center' });
      }

      // Section 2 Header
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(0, 0, 0);
      doc.text('2. OFFICIAL COMMUNICATION HUBS', 18, 118);
      doc.setLineWidth(0.5);
      doc.line(18, 120, 192, 120);

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('Phone Connection:', 18, 129);
      doc.text('WhatsApp Link:', 18, 137);
      doc.text('Email Coordinates:', 18, 145);

      doc.setFont('Courier', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(40, 40, 40);
      doc.text(data.contact || '_______________________', 50, 129);
      doc.text(data.whatsappNumber || '_______________________', 50, 137);
      doc.text(data.emailAddress || '____________________________________________________', 50, 145);

      // Section 3 Header
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(0, 0, 0);
      doc.text('3. SCREEN TEST & AUDITION REPORT (OFFICIAL)', 18, 158);
      doc.setLineWidth(0.5);
      doc.line(18, 160, 192, 160);

      // Assessment indicators
      const boxWidth = 38;
      const boxHeight = 14;
      const boxY = 166;
      const labels = ['ACTING RANGE', 'COMMUNICATION', 'CAMERA GLAM', 'PRESENCE'];
      
      labels.forEach((label, i) => {
        const boxX = 18 + (i * 44);
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.3);
        doc.rect(boxX, boxY, boxWidth, boxHeight);
        
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(50, 50, 50);
        doc.text(label, boxX + (boxWidth / 2), boxY + 5.5, { align: 'center' });
        
        doc.setFont('Courier', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text('A / B / C / D', boxX + (boxWidth / 2), boxY + 11, { align: 'center' });
      });

      // Evaluation Comments box
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.3);
      doc.rect(18, 186, 174, 25);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(0, 0, 0);
      doc.text('AUDITION STAGE COMMENTS:', 21, 192);

      doc.setFont('Courier', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 100, 100);
      doc.text('[Assessment of cast suitability for comedies, skits, main features or modeling roles...]', 21, 200);

      // Section 4 Policy / Signature Information
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(60, 60, 60);
      doc.text('By signing, the talent verifies that self-submitted communication channels and credentials are fully correct and active.', 105, 226, { align: 'center' });

      // Sign-off signature lines
      doc.setLineWidth(0.4);
      doc.setDrawColor(0, 0, 0);
      doc.line(25, 252, 90, 252);
      doc.line(120, 252, 185, 252);

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(0, 0, 0);
      doc.text('CANDIDATE SIGNATURE', 57.5, 257, { align: 'center' });
      
      const adminNameStr = (globalSettings && globalSettings.adminSignatureName) 
        ? globalSettings.adminSignatureName.toUpperCase() 
        : 'CEO / GENERAL MANAGER / SECRETARY / ADMIN';
      const adminTitleStr = (globalSettings && globalSettings.adminSignatureTitle)
        ? globalSettings.adminSignatureTitle.toUpperCase()
        : 'AUTHORIZED SIGNATORY STAMP';
      doc.text(adminNameStr, 152.5, 257, { align: 'center' });
      doc.text(adminTitleStr, 152.5, 261, { align: 'center' });

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 100, 100);
      const docDateVal = data?.createdAt ? new Date(data.createdAt).toLocaleDateString() : new Date().toLocaleDateString();
      doc.text(`Date: ${docDateVal}`, 57.5, 265, { align: 'center' });
      doc.text(`Date: ${new Date().toLocaleDateString()}`, 152.5, 265, { align: 'center' });

      // Embed candidate signature image if it exists
      if (data.signature && data.signature.startsWith('data:')) {
        try {
          doc.addImage(data.signature, 'PNG', 35, 232, 45, 18);
        } catch (err) {
          console.warn("Failed rendering candidate signature inside jsPDF:", err);
        }
      }

      // Embed dynamic administrator signature if it exists
      if (globalSettings && globalSettings.adminSignature && globalSettings.adminSignature.startsWith('data:')) {
        try {
          doc.addImage(globalSettings.adminSignature, 'PNG', 130, 232, 45, 18);
        } catch (err) {
          console.warn("Failed rendering admin signature inside jsPDF:", err);
        }
      }

      // Footer notice
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(120, 120, 120);
      doc.text('This is an official document of GREFAS ENTERTAINMENT & PRODUCTIONS. All rights reserved. Registered in Ghana.', 105, 276, { align: 'center' });

      const fileName = data.fullName 
        ? `Grefas-Casting-Form-${data.fullName.trim().replace(/\s+/g, '-')}.pdf`
        : 'Grefas-Casting-Form-Empty.pdf';

      doc.save(fileName);
      toast.success('Official PDF casting form downloaded successfully!');
    } catch (err: any) {
      console.error("PDF generation failed:", err);
      toast.error(`Could not generate PDF: ${err.message || 'Unknown error'}`);
    }
  };

  const printFilledForm = () => {
    setPrintableData({ ...formData });
    setShowPrintModal(true);
  };

  const printEmptyForm = () => {
    setPrintableData(null);
    setShowPrintModal(true);
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

    if (!priceConfirmed) {
      toast.error('Please confirm and agree to the registration fee of GH₵ ' + intakePrice + ' before submitting.');
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
        price: intakePrice,
        priceConfirmed: true,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, path), intakeData);

      // Try to load casting_received template from Firestore for custom SMS alert
      let customSmsMessage = undefined;
      try {
        const templatesSnapshot = await getDocs(query(collection(db, 'sms_templates'), where('name', '==', 'casting_received')));
        if (!templatesSnapshot.empty) {
          const tplData = templatesSnapshot.docs[0].data();
          if (tplData && tplData.content) {
            customSmsMessage = tplData.content.replace(/{name}/g, formData.fullName);
          }
        }
      } catch (err) {
        console.warn("Failed to fetch casting_received template, falling back to default SMS.", err);
      }

      // Trigger server-side notifications via email proxy
      try {
        await fetch('/api/notify-intake', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...intakeData,
            customMessage: customSmsMessage
          })
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
        passportPhoto: '',
        roleType: 'Actor / Actress',
        roleTypes: ['Actor / Actress'] as string[],
        experienceLevel: 'Intermediate',
        preferredGenres: [] as string[],
        availability: 'Part-time',
        portfolioLink: '',
        bio: '',
        signature: ''
      });
      setPriceConfirmed(false);
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

  // Fetch reviews for service cards
  useEffect(() => {
    const q = query(collection(db, 'reviews'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setReviews(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.warn("Could not fetch reviews for service listings:", error);
    });
    return () => unsubscribe();
  }, []);

  const getServiceRating = (serviceId: string) => {
    const serviceReviews = reviews.filter(r => r.serviceId === serviceId);
    if (serviceReviews.length === 0) return null;
    const avg = serviceReviews.reduce((sum, r) => sum + (r.rating || 0), 0) / serviceReviews.length;
    return {
      average: parseFloat(avg.toFixed(1)),
      count: serviceReviews.length
    };
  };

  // Fetch dynamic roles and fee from settings/global
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'global'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setGlobalSettings(data);
        if (data.intakeRoles && data.intakeRoles.length > 0) {
          setAvailableRoles(data.intakeRoles);
        } else {
          setAvailableRoles([
            "Actor / Actress",
            "Skit Performer",
            "Creative Writer",
            "Crew / Technical",
            "Video Editor",
            "Cameraman",
            "Sound Engineer",
            "Director",
            "Finance Officer",
            "Admin Support"
          ]);
        }
        if (data.intakePrice !== undefined) {
          setIntakePrice(Number(data.intakePrice));
        }
      } else {
        setAvailableRoles([
          "Actor / Actress",
          "Skit Performer",
          "Creative Writer",
          "Crew / Technical",
          "Video Editor",
          "Cameraman",
          "Sound Engineer",
          "Director",
          "Finance Officer",
          "Admin Support"
        ]);
        setIntakePrice(50);
      }
    });
    return () => unsubscribe();
  }, []);

  const getServiceCategory = (service: any): string => {
    if (service.category) {
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
        <Breadcrumbs />
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
        <div className="mt-10 flex flex-wrap gap-2 justify-center">
          <div className="inline-flex flex-wrap items-center gap-1 rounded-xl bg-muted/60 p-1 backdrop-blur-sm border border-border/30">
            {['All', ...Array.from(new Set(services.map(s => getServiceCategory(s))))].map((tab) => {
              const isActive = activeTab === tab;
              const TabIcon = tab === 'All' 
                ? (LucideIcons.Layers || LucideIcons.Grid)
                : tab === 'Consulting' 
                  ? LucideIcons.Briefcase 
                  : tab === 'Entertainment'
                    ? (LucideIcons.Music2 || LucideIcons.Music)
                    : LucideIcons.Sparkles;
              
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
                          {(() => {
                            const ratingData = getServiceRating(service.id);
                            if (!ratingData) return null;
                            const StarIcon = LucideIcons.Star;
                            return (
                              <div className="flex items-center gap-1.5 mt-1.5 text-xs text-amber-500">
                                <div className="flex items-center">
                                  {Array.from({ length: 5 }).map((_, i) => (
                                    <StarIcon
                                      key={i}
                                      className={`h-3 w-3 ${
                                        i < Math.round(ratingData.average)
                                          ? 'fill-amber-500 text-amber-500'
                                          : 'text-muted-foreground/30'
                                      }`}
                                    />
                                  ))}
                                </div>
                                <span className="font-bold text-foreground">{ratingData.average}</span>
                                <span className="text-muted-foreground">({ratingData.count})</span>
                              </div>
                            );
                          })()}
                          <CardDescription className="line-clamp-2 text-muted-foreground mt-1.5 min-h-[40px]">{service.description}</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1 pt-0 flex flex-col justify-between">
                          <p className="text-xs text-muted-foreground/80 leading-relaxed">
                            Tailored strategies and solutions engineered specifically to address local dynamics and power your strategic goals.
                          </p>
                          <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/40">
                            <span className="text-xs text-muted-foreground font-medium">Standard Price</span>
                            <span className="text-sm font-black text-orange-600 bg-orange-600/5 px-2.5 py-1 rounded-md">
                              GH₵ {(service.price !== undefined ? service.price : 150).toLocaleString()}
                            </span>
                          </div>
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

                        {/* Passport Size Photo Field */}
                        <div className="space-y-1 sm:col-span-2">
                          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                            <LucideIcons.Camera className="h-3.5 w-3.5 text-orange-600" />
                            Passport Size Photo
                          </label>
                          <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-xl border border-dashed border-border/80 bg-muted/20">
                            {formData.passportPhoto ? (
                              <div className="relative h-28 w-24 rounded-lg overflow-hidden border-2 border-orange-600 shadow-md bg-muted flex-none">
                                <img src={formData.passportPhoto} className="h-full w-full object-cover" alt="Passport size preview" />
                                <button
                                  type="button"
                                  onClick={() => handleInputChange('passportPhoto', '')}
                                  className="absolute top-1 right-1 bg-black/75 hover:bg-black text-white p-1 rounded-full transition-all cursor-pointer shadow"
                                  title="Remove Photo"
                                >
                                  <LucideIcons.X className="h-3 w-3" />
                                </button>
                              </div>
                            ) : (
                              <div className="h-28 w-24 rounded-lg border border-dashed border-border flex flex-col items-center justify-center bg-muted/40 text-muted-foreground flex-none">
                                <LucideIcons.User className="h-8 w-8 opacity-40 mb-1" />
                                <span className="text-[9px] font-bold text-center leading-tight">No Photo<br/>Uploaded</span>
                              </div>
                            )}
                            <div className="flex-1 space-y-2 text-center sm:text-left">
                              <p className="text-xs font-bold text-foreground">
                                Upload a clear, front-facing square portrait photo.
                              </p>
                              <p className="text-[11px] text-muted-foreground leading-relaxed">
                                This photo will be embedded into your official printable audition card. Supports JPEG, PNG (max 5MB).
                              </p>
                              <div className="flex flex-wrap gap-2 justify-center sm:justify-start pt-1">
                                <input
                                  type="file"
                                  id="passport-photo-picker"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    try {
                                      toast.loading('Optimizing passport photo...', { id: 'passport-compress' });
                                      const compressed = await compressImage(file, 400, 400, 0.8);
                                      const base64 = await blobToBase64(compressed);
                                      handleInputChange('passportPhoto', base64);
                                      toast.success('Passport photo attached successfully!', { id: 'passport-compress' });
                                    } catch (err) {
                                      console.error(err);
                                      toast.error('Failed to process image. Please try again.', { id: 'passport-compress' });
                                    }
                                  }}
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => document.getElementById('passport-photo-picker')?.click()}
                                  className="border-border hover:bg-muted font-bold text-xs"
                                >
                                  <LucideIcons.Upload className="h-3.5 w-3.5 mr-1" /> Choose File
                                </Button>
                              </div>
                            </div>
                          </div>
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
                            Production Role Interest (Select all that apply)
                          </label>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {availableRoles.map((role) => {
                              const isChecked = (formData.roleTypes || []).includes(role) || formData.roleType === role;
                              return (
                                <button
                                  key={role}
                                  type="button"
                                  onClick={() => {
                                    const currentRoles = formData.roleTypes || (formData.roleType ? [formData.roleType] : []);
                                    let newRoles: string[];
                                    if (currentRoles.includes(role)) {
                                      newRoles = currentRoles.filter(r => r !== role);
                                    } else {
                                      newRoles = [...currentRoles, role];
                                    }
                                    setFormData(prev => ({
                                      ...prev,
                                      roleTypes: newRoles,
                                      roleType: newRoles.join(', ')
                                    }));
                                  }}
                                  className={`p-3.5 border rounded-xl text-center capitalize transition duration-300 font-bold cursor-pointer text-xs ${
                                    isChecked
                                      ? 'border-orange-600 bg-orange-600/5 text-orange-600 dark:text-orange-400 font-black shadow-xs'
                                      : 'border-border/80 hover:bg-muted text-foreground'
                                  }`}
                                >
                                  {role}
                                </button>
                              );
                            })}
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

                        {/* Digital Signature Canvas Section */}
                        <div className="space-y-2 sm:col-span-2 border-t border-border/40 pt-6">
                          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                            <LucideIcons.PenTool className="h-4 w-4 text-orange-600 shrink-0" />
                            Talent Signature Consent (Sign or Upload Image)
                          </label>
                          <p className="text-[11px] text-muted-foreground leading-relaxed mb-3">
                            Please draw your signature inside the canvas box below, or switch to the upload option to upload a clear image of your signature.
                          </p>

                          {/* Signature Mode Selector */}
                          <div className="flex gap-2 mb-4">
                            <button
                              type="button"
                              onClick={() => {
                                setSignatureMode('draw');
                              }}
                              className={`px-4 py-2 text-xs font-bold rounded-lg transition duration-300 border flex items-center gap-1.5 cursor-pointer ${
                                signatureMode === 'draw'
                                  ? 'bg-orange-600 border-orange-600 text-white shadow-sm'
                                  : 'bg-background border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                              }`}
                            >
                              <LucideIcons.PenTool className="h-3.5 w-3.5" />
                              Draw Signature
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSignatureMode('upload');
                              }}
                              className={`px-4 py-2 text-xs font-bold rounded-lg transition duration-300 border flex items-center gap-1.5 cursor-pointer ${
                                signatureMode === 'upload'
                                  ? 'bg-orange-600 border-orange-600 text-white shadow-sm'
                                  : 'bg-background border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                              }`}
                            >
                              <LucideIcons.Upload className="h-3.5 w-3.5" />
                              Upload Signature Image
                            </button>
                          </div>
                          
                          {signatureMode === 'draw' ? (
                            <div className="relative border border-border/80 bg-white rounded-xl overflow-hidden p-1.5 shadow-xs">
                              <canvas
                                ref={canvasRef}
                                width={600}
                                height={180}
                                className="w-full h-[180px] bg-slate-50 rounded-lg cursor-crosshair touch-none"
                                onMouseDown={startDrawing}
                                onMouseMove={draw}
                                onMouseUp={stopDrawing}
                                onMouseLeave={stopDrawing}
                                onTouchStart={startDrawing}
                                onTouchMove={draw}
                                onTouchEnd={stopDrawing}
                              />
                              
                              {/* Floating controls in canvas */}
                              <div className="absolute bottom-3 right-3 flex items-center gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={clearSignature}
                                  variant="outline"
                                  className="h-8 text-[11px] font-bold uppercase tracking-wider text-red-600 border-red-200 hover:bg-red-50 hover:border-red-400 bg-white/95 backdrop-blur-xs flex items-center gap-1 shadow-xs"
                                >
                                  <LucideIcons.Trash2 className="h-3 w-3" />
                                  <span>Clear Signature</span>
                                </Button>
                              </div>

                              {/* Blank state indicator or signature preview status */}
                              {!formData.signature && (
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none opacity-40">
                                  <div className="text-center">
                                    <LucideIcons.Signature className="h-8 w-8 mx-auto text-muted-foreground/80 mb-1" />
                                    <span className="text-[10px] font-medium text-muted-foreground">Sign Here</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {formData.signature ? (
                                <div className="relative border border-border bg-slate-50 rounded-xl p-4 flex flex-col items-center justify-center min-h-[180px] group">
                                  <div className="bg-white border border-border/85 p-4 rounded-lg shadow-xs max-w-[300px]">
                                    <img 
                                      src={formData.signature} 
                                      alt="Uploaded Signature" 
                                      className="max-h-[110px] max-w-full object-contain mx-auto"
                                    />
                                  </div>
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => {
                                      setFormData(prev => ({ ...prev, signature: '' }));
                                    }}
                                    variant="outline"
                                    className="mt-3 text-[11px] font-bold uppercase tracking-wider text-red-600 border-red-200 hover:bg-red-50 hover:border-red-400 bg-white flex items-center gap-1 shadow-xs"
                                  >
                                    <LucideIcons.Trash2 className="h-3 w-3" />
                                    <span>Remove Signature</span>
                                  </Button>
                                </div>
                              ) : (
                                <div 
                                  className="border-2 border-dashed border-border hover:border-orange-500/60 transition-colors duration-300 rounded-xl p-6 bg-muted/20 text-center cursor-pointer min-h-[180px] flex flex-col items-center justify-center"
                                  onClick={() => document.getElementById('signature-file-upload')?.click()}
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
                                  <LucideIcons.UploadCloud className="h-10 w-10 text-orange-500 mb-2 stroke-[1.5]" />
                                  <p className="text-xs font-bold text-foreground">Drag & Drop Signature Image</p>
                                  <p className="text-[10px] text-muted-foreground mt-1 max-w-xs">Supports PNG, JPEG, or SVG formats (transparent background is recommended)</p>
                                  <span className="mt-3 inline-block bg-orange-600 text-white font-bold text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-lg shadow-xs hover:bg-orange-700 transition">
                                    Browse Files
                                  </span>
                                  <input 
                                    type="file"
                                    id="signature-file-upload"
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
                          
                          {formData.signature && (
                            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] uppercase tracking-wider animate-pulse px-1">
                              <LucideIcons.CheckCircle2 className="h-3.5 w-3.5" />
                              <span>Signature Captured & Locked</span>
                            </div>
                          )}
                        </div>

                        {/* Dynamic Casting Intake Price Confirmation Section */}
                        <div className="sm:col-span-2 border-t border-border/40 pt-6 space-y-4">
                          <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-5 md:p-6 space-y-4">
                            <div className="flex items-start gap-3.5">
                              <div className="bg-orange-600 text-white p-3 rounded-xl shrink-0 shadow-md">
                                <LucideIcons.CreditCard className="h-6 w-6 animate-pulse" />
                              </div>
                              <div className="space-y-1">
                                <h4 className="font-extrabold text-sm text-foreground flex items-center gap-1.5 flex-wrap">
                                  <span>Official Registration & Processing Fee</span>
                                  <span className="text-xs font-black bg-orange-600 text-white px-2.5 py-0.5 rounded-full">GH₵ {intakePrice.toLocaleString()}</span>
                                </h4>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                  An official casting and demographic intake processing fee of <strong className="text-foreground">GH₵ {intakePrice}</strong> is required to submit your audition profile to Grefas Entertainment casting directory. This covers administrative roster logging, database storage, and immediate contact setup with our movie directors.
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 p-3.5 bg-card border border-border/80 rounded-xl hover:bg-muted/30 transition-all duration-300">
                              <input
                                type="checkbox"
                                id="priceConfirmation"
                                checked={priceConfirmed}
                                onChange={(e) => setPriceConfirmed(e.target.checked)}
                                className="h-5 w-5 rounded border-border text-orange-600 focus:ring-orange-600 accent-orange-600 cursor-pointer"
                              />
                              <label htmlFor="priceConfirmation" className="text-xs font-bold text-foreground cursor-pointer select-none">
                                I confirm and agree to pay the GH₵ {intakePrice} registration fee to finalize my casting enrollment
                              </label>
                            </div>
                          </div>
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



      {/* Elegant Responsive Printable Preview Modal (Pure design visible on screen, hidden in print, handles all devices) */}
      <AnimatePresence>
        {showPrintModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto print:bg-transparent print:p-0 print:block print:static">
            <style>{`
              @media print {
                html, body {
                  background: white !important;
                  color: black !important;
                  margin: 0 !important;
                  padding: 0 !important;
                  width: 100% !important;
                  height: auto !important;
                  min-height: 0 !important;
                }
                body * {
                  visibility: hidden !important;
                }
                #print-preview-modal-document-sheet,
                #print-preview-modal-document-sheet * {
                  visibility: visible !important;
                }
                #print-preview-modal-document-sheet {
                  position: absolute !important;
                  left: 0 !important;
                  top: 0 !important;
                  width: 100% !important;
                  max-width: 100% !important;
                  height: auto !important;
                  min-height: 0 !important;
                  border: none !important;
                  box-shadow: none !important;
                  padding: 0 !important;
                  margin: 0 !important;
                  display: flex !important;
                  flex-direction: column !important;
                  justify-content: space-between !important;
                }
              }
            `}</style>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-card border border-border/80 w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden print:border-none print:shadow-none print:max-h-none print:overflow-visible print:bg-transparent"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-border px-5 py-3.5 bg-muted/40 font-sans print:hidden">
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
              <div className="bg-orange-50 dark:bg-orange-950/20 border-b border-orange-200/20 px-5 py-2.5 text-[11px] leading-relaxed text-orange-700 dark:text-orange-400 flex items-start gap-2 print:hidden">
                <LucideIcons.AlertCircle className="h-4.5 w-4.5 text-orange-500 mt-0.5 flex-none animate-pulse" />
                <div>
                  <span className="font-extrabold uppercase">Notice:</span> Inside the preview sandbox, standard print triggers may be restricted by security contexts. If clicking <span className="font-bold underline text-foreground">Launch System Print</span> behaves unresponsively, please use the <span className="font-bold">New Tab Button</span> in the top-right to print/save smoothly.
                </div>
              </div>

              {/* Document Sheet Body */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-zinc-150 dark:bg-zinc-950/80 flex justify-center border-b border-border print:p-0 print:bg-transparent print:border-none">
                {/* Visual rendering resembling an A4 document page */}
                <div 
                  className="w-full max-w-2xl bg-white text-black p-5 sm:p-10 font-sans border-2 border-black rounded-lg shadow-lg flex flex-col justify-between select-text selection:bg-orange-200 selection:text-black min-h-[750px] aspect-[1/1.4] print:shadow-none print:border-none print:p-0 print:rounded-none"
                  id="print-preview-modal-document-sheet"
                >
                  <div>
                    {/* Brand Identifier */}
                    <div className="flex items-center gap-4 border-b-4 border-black pb-3 relative text-left">
                      <div className="flex-1">
                        <h1 className="text-lg sm:text-2xl font-black uppercase tracking-widest text-black">
                          GREFAS ENTERTAINMENT & PRODUCTIONS
                        </h1>
                        <p className="text-[9px] sm:text-[11px] uppercase tracking-widest font-black mt-1 text-black/80">
                          Official Film Casting & Talent Management Division
                        </p>
                        <div className="mt-3.5 flex justify-between text-[8px] sm:text-[10px] font-mono font-bold text-black border-t border-black/20 pt-1.5">
                          <span>INTAKE REGION: ASHANTI, GHANA</span>
                          <span>FORM CODE: GEP-CAST-648123</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-center gap-1 p-1 border border-black/30 rounded bg-white select-none">
                        <img 
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(window.location.origin + '/services')}`} 
                          className="h-14 w-14 object-contain" 
                          alt="Verification QR" 
                          referrerPolicy="no-referrer"
                        />
                        <span className="text-[7px] font-black tracking-tighter uppercase text-center text-black/70">
                          Verify Intake
                        </span>
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
                      <div className="flex gap-4 items-start pt-1">
                        <div className="flex-1 grid grid-cols-2 gap-y-3 text-xs">
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

                        {/* Passport size photo space */}
                        <div className="w-[105px] h-[125px] border-2 border-dashed border-black flex flex-col items-center justify-center text-center p-0.5 bg-neutral-50 shrink-0 shadow-xs relative">
                          {printableData && printableData.passportPhoto ? (
                            <img src={printableData.passportPhoto} className="w-full h-full object-cover" alt="Passport size photo" />
                          ) : (
                            <div className="text-[7.5px] font-black uppercase leading-tight text-neutral-500">
                              Affix<br/>Passport<br/>Size Photo<br/>Here
                            </div>
                          )}
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
                      <div className="w-1/2 flex flex-col items-center">
                        {printableData && printableData.signature ? (
                          <img 
                            src={printableData.signature} 
                            className="max-h-12 max-w-[150px] object-contain mb-[-4px]" 
                            alt="Signature" 
                          />
                        ) : (
                          <div className="h-11"></div>
                        )}
                        <div className="border-t border-black w-[80%] pt-0.5 mt-1 text-center uppercase text-[8px] sm:text-[9px]">
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
              <div className="p-4 sm:p-5 bg-muted/30 flex flex-col sm:flex-row gap-3 font-sans print:hidden">
                <Button
                  onClick={() => runIframeSafePrint(printableData)}
                  className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-black h-12 uppercase tracking-wider rounded-xl shadow-lg cursor-pointer flex items-center justify-center gap-2 transition-all"
                >
                  <LucideIcons.Printer className="h-4.5 w-4.5" />
                  <span>Launch System Print</span>
                </Button>
                <Button
                  onClick={downloadAsPDF}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-950 text-white font-black h-12 uppercase tracking-wider rounded-xl shadow-lg cursor-pointer flex items-center justify-center gap-2 transition-all border border-zinc-700"
                >
                  <LucideIcons.Download className="h-4.5 w-4.5" />
                  <span>Download PDF</span>
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
