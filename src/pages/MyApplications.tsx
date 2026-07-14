import * as React from 'react';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db, handleFirestoreError, OperationType } from '@/firebase';
import { collection, query, where, onSnapshot, getDocs, doc, setDoc, addDoc } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  FileText, Clock, CheckCircle2, AlertTriangle, Play, MessageCircle, MapPin, 
  Phone, Mail, Calendar, Sparkles, LogIn, ArrowRight, Loader2, LogOut, Printer, X,
  Bell, CreditCard, Receipt, ShieldCheck, Check, Download
} from 'lucide-react';
import { toast } from 'sonner';
import SEO from '@/components/SEO';
import AuthDialog from '@/components/AuthDialog';
import { jsPDF } from 'jspdf';

export default function MyApplications() {
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [applications, setApplications] = useState<any[]>([]);
  const [loadingApps, setLoadingApps] = useState(false);
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState(true);
  const [updatingNotifications, setUpdatingNotifications] = useState(false);
  const [globalSettings, setGlobalSettings] = useState<any>(null);

  // Subscribe to global settings for logo watermarks and administrative signatures
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'global'), (docSnap) => {
      if (docSnap.exists()) {
        setGlobalSettings(docSnap.data());
      }
    });
    return () => unsubscribe();
  }, []);
  
  const downloadReceiptPdf = (app: any, inst: any) => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const paidDate = inst.paidAt ? new Date(inst.paidAt).toLocaleString() : new Date().toLocaleString();

      // Brand colors
      const primaryColor = [234, 88, 12]; // Orange-600 #ea580c
      const darkColor = [30, 41, 59]; // Slate-800 #1e293b
      const lightGray = [248, 250, 252]; // Slate-50 #f8fafc

      // Header Banner background
      doc.setFillColor(darkColor[0], darkColor[1], darkColor[2]);
      doc.rect(0, 0, 210, 45, 'F');

      // White Header text
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.text('GREFAS ENTERTAINMENT', 20, 20);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text('Official Finance Division | Accra, Ghana', 20, 28);
      
      doc.setFont('courier', 'bold');
      doc.setFontSize(9);
      doc.text(`TRANSACTION REF: ${inst.transactionId || 'N/A'}`, 20, 36);

      // Main Title
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text('OFFICIAL PAYMENT RECEIPT', 20, 60);

      // Decorative divider
      doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setLineWidth(1.5);
      doc.line(20, 64, 190, 64);

      // Receipt Box background
      doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
      doc.rect(20, 72, 170, 85, 'F');
      
      // Draw frame border
      doc.setDrawColor(226, 232, 240); // border-slate-200
      doc.setLineWidth(0.5);
      doc.rect(20, 72, 170, 85, 'S');

      // Grid labels and values inside box
      const gridItems = [
        { label: 'CLIENT NAME:', value: app.fullName || 'N/A' },
        { label: 'CLIENT CONTACT:', value: app.contact || 'N/A' },
        { label: 'EMAIL ADDRESS:', value: app.emailAddress || 'N/A' },
        { label: 'MILESTONE PAID:', value: inst.name || 'N/A' },
        { label: 'AMOUNT RECEIVED:', value: `GH₵ ${Number(inst.amount).toFixed(2)}` },
        { label: 'PAYMENT DATE:', value: paidDate },
        { label: 'PAYMENT STATUS:', value: 'VERIFIED & PAID' }
      ];

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      
      let yOffset = 82;
      gridItems.forEach(item => {
        // Label
        doc.setTextColor(100, 116, 139); // Text-slate-500
        doc.setFont('helvetica', 'bold');
        doc.text(item.label, 26, yOffset);
        
        // Value
        if (item.label === 'PAYMENT STATUS:') {
          doc.setTextColor(22, 163, 74); // Green-600
        } else if (item.label === 'AMOUNT RECEIVED:') {
          doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        } else {
          doc.setTextColor(15, 23, 42); // Slate-900
        }
        doc.setFont('helvetica', 'normal');
        doc.text(item.value, 80, yOffset);
        
        yOffset += 10;
      });

      // Acknowledgement block
      doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
      // Robust Professional Watermark
      doc.setTextColor(242, 244, 247);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(34);
      doc.text('GREFAS CONSULT', 105, 120, { align: 'center', angle: 30 });
      doc.setFontSize(14);
      doc.text('OFFICIAL VALIDATED DOCUMENT', 105, 130, { align: 'center', angle: 30 });

      doc.rect(20, 165, 170, 30, 'F');
      doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setLineWidth(0.5);
      doc.rect(20, 165, 170, 30, 'S');

      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('ACKNOWLEDGEMENT & RECEIPT METRIC:', 25, 172);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      const ackText = 'This document confirms receipt of the stated amount for Grefas Consult Casting Division. All payments are securely logged, non-refundable, and subject to platform terms and regulations.';
      const lines = doc.splitTextToSize(ackText, 160);
      doc.text(lines, 25, 178);

      // Signatures lines
      doc.setDrawColor(203, 213, 225); // Slate-300
      doc.line(25, 225, 95, 225);
      doc.line(125, 225, 185, 225);

      // Signature image auto-injection if present
      if (globalSettings && globalSettings.adminSignature) {
        try {
          doc.addImage(globalSettings.adminSignature, 'PNG', 30, 203, 50, 20); // x, y, width, height
        } catch (sigErr) {
          console.warn('Failed to inject signature image into jsPDF:', sigErr);
        }
      }

      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      
      const sigName = (globalSettings && globalSettings.adminSignatureName) ? globalSettings.adminSignatureName : '';
      const sigTitle = (globalSettings && globalSettings.adminSignatureTitle) ? globalSettings.adminSignatureTitle : 'CEO / General Manager / Secretary / Admin Signature';

      if (sigName) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text(sigName, 25, 229);
        
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        doc.setFontSize(6.5);
        doc.text(sigTitle, 25, 233);
      } else {
        doc.text('CEO / General Manager / Secretary / Admin Signature', 23, 230);
      }

      doc.setFontSize(8);
      doc.text(`Date: ${paidDate.split(',')[0]}`, 140, 230);

      // Footer
      doc.setTextColor(148, 163, 184); // Slate-400
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('This is an official system-generated payment receipt.', 105, 255, { align: 'center' });
      doc.text('Grefas Consult & Entertainment | Ghana', 105, 260, { align: 'center' });

      // Save document
      doc.save(`Receipt-${app.fullName.replace(/\s+/g, '_')}-${inst.id || 'milestone'}.pdf`);
      toast.success('Official PDF receipt downloaded successfully!');
    } catch (err) {
      console.error('PDF generation error:', err);
      toast.error('Could not generate PDF download. Printing the receipt is available as fallback.');
    }
  };
  
  // Payment Simulator States
  const [activePaymentInstallment, setActivePaymentInstallment] = useState<any | null>(null);
  const [activePaymentApp, setActivePaymentApp] = useState<any | null>(null);
  const [paymentMode, setPaymentMode] = useState<'momo' | 'card'>('momo');
  const [momoOperator, setMomoOperator] = useState<'mtn' | 'telecel' | 'airteltigo'>('mtn');
  const [momoNumber, setMomoNumber] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentStep, setPaymentStep] = useState<'form' | 'processing' | 'success'>('form');
  const [transactionId, setTransactionId] = useState('');

  const getAmountPaid = (item: any) => {
    if (!item.price || !item.paymentPlan || !item.paymentPlan.installments) return 0;
    return item.paymentPlan.installments
      .filter((inst: any) => inst.status === 'Paid')
      .reduce((sum: number, inst: any) => sum + (inst.amount || 0), 0);
  };
  
  // Controls print preview modal
  const [previewApp, setPreviewApp] = useState<any | null>(null);
  const [appAuthOpen, setAppAuthOpen] = useState(false);
  const [appAuthDefaultMode, setAppAuthDefaultMode] = useState<'signin' | 'signup'>('signin');

  // Track Auth state & Fetch Notification Preferences
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (authUser) => {
      setUser(authUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Fetch email notification settings when user logs in
  useEffect(() => {
    if (!user) return;

    const userDocRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        // Default to true if not explicitly set
        setEmailNotificationsEnabled(data.emailNotificationsEnabled !== false);
      }
    }, (error) => {
      console.warn('Failed to load user email preferences:', error);
    });

    return () => unsubscribe();
  }, [user]);

  const handleToggleNotifications = async (enabled: boolean) => {
    if (!user) return;
    setUpdatingNotifications(true);
    try {
      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, {
        emailNotificationsEnabled: enabled,
        email: user.email || '',
        fullName: user.displayName || 'Authorized Talent',
        updatedAt: new Date().toISOString()
      }, { merge: true });
      setEmailNotificationsEnabled(enabled);
      toast.success(enabled ? 'Email updates successfully activated!' : 'Email updates successfully silenced.');
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
      toast.error('Could not save notification preferences.');
    } finally {
      setUpdatingNotifications(false);
    }
  };

  // Fetch applications when logged in
  useEffect(() => {
    if (!user) {
      setApplications([]);
      return;
    }

    setLoadingApps(true);
    // Query submissions under the applicant's UID OR their Google email address
    const q1 = query(
      collection(db, 'service_intakes'), 
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q1, async (snapshot) => {
      const uidsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Also fetch by email as an active fallback for sync
      try {
        const q2 = query(
          collection(db, 'service_intakes'), 
          where('emailAddress', '==', user.email)
        );
        const emailSnap = await getDocs(q2);
        const emailList = emailSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Merge list based on unique ID to avoid duplicates
        const mergedMap = new Map();
        [...uidsList, ...emailList].forEach(item => {
          mergedMap.set(item.id, item);
        });
        
        // Sort merged list descending by createdAt
        const sortedList = Array.from(mergedMap.values()).sort((a, b) => {
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        });

        setApplications(sortedList);
      } catch (err) {
        console.warn('Fallback email query warning:', err);
        setApplications(uidsList);
      } finally {
        setLoadingApps(false);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'service_intakes');
      setLoadingApps(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleSignOut = () => {
    signOut(auth);
    toast.success('Signed out. See you soon!');
  };

  const triggerPrintReceipt = (app: any, inst: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Popup blocker active. Please allow popups to print your receipt!');
      return;
    }

    const paidDate = inst.paidAt ? new Date(inst.paidAt).toLocaleString() : new Date().toLocaleString();

    printWindow.document.write(`
      <html>
        <head>
          <title>Official Payment Receipt - ${app.fullName}</title>
          <style>
            body { font-family: 'Courier New', monospace; padding: 40px; color: #111; max-width: 600px; margin: 0 auto; line-height: 1.5; }
            .header { text-align: center; border-bottom: 3px double #000; padding-bottom: 20px; margin-bottom: 30px; }
            .header h1 { margin: 0; font-size: 24px; letter-spacing: 2px; }
            .header p { margin: 5px 0 0 0; font-size: 11px; text-transform: uppercase; }
            .title { text-align: center; font-size: 16px; font-weight: bold; text-decoration: underline; margin-bottom: 30px; letter-spacing: 1px; }
            .grid { display: grid; grid-template-cols: 180px 1fr; row-gap: 12px; margin-bottom: 30px; font-size: 13px; }
            .label { font-weight: bold; text-transform: uppercase; }
            .value { border-bottom: 1px dashed #666; padding-bottom: 2px; }
            .receipt-border { border: 2px solid #000; padding: 20px; background-color: #fafafa; margin-bottom: 30px; }
            .footer { margin-top: 50px; text-align: center; border-top: 1px solid #ccc; padding-top: 20px; font-size: 10px; color: #555; }
            @media print {
              body { padding: 10px; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>GREFAS ENTERTAINMENT</h1>
            <p>Official Finance Division &bull; Ghana</p>
            <p style="font-size: 9px; margin-top: 5px; font-family: monospace;">Transaction Ref: ${inst.transactionId || 'N/A'}</p>
          </div>
          
          <div class="title">OFFICIAL PAYMENT RECEIPT</div>
          
          <div class="receipt-border">
            <div class="grid">
              <div class="label">Client Name:</div>
              <div class="value">${app.fullName || 'N/A'}</div>
              
              <div class="label">Client Contact:</div>
              <div class="value">${app.contact || 'N/A'}</div>

              <div class="label">Email Address:</div>
              <div class="value">${app.emailAddress || 'N/A'}</div>
              
              <div class="label">Milestone Paid:</div>
              <div class="value" style="font-weight: bold;">${inst.name || 'N/A'}</div>
              
              <div class="label">Amount Received:</div>
              <div class="value" style="font-weight: bold; font-family: monospace;">GH₵ ${Number(inst.amount).toFixed(2)}</div>
              
              <div class="label">Payment Date:</div>
              <div class="value">${paidDate}</div>
              
              <div class="label">Payment Status:</div>
              <div class="value" style="font-weight: bold; color: #16a34a;">VERIFIED & PAID</div>
            </div>
          </div>

          <div style="font-size: 11px; border: 1px solid #111; padding: 12px; background: #fafafa; margin-top: 20px;">
            <strong>ACKNOWLEDGEMENT & RECEIPT METRIC:</strong>
            <p style="margin: 6px 0 0 0; font-size: 10px; line-height: 1.5;">
              This confirms receipt of the stated amount for Grefas Consult Casting Division. All payments are non-refundable and subject to program regulations.
            </p>
            <div style="margin-top: 25px; display: flex; justify-content: space-between;">
              <div>
                <p style="margin: 0; border-top: 1px solid #000; width: 220px; margin-top: 20px;"></p>
                <p style="margin: 4px 0 0 0; font-size: 9px; text-align: center; font-weight: bold;">CEO / General Manager / Secretary / Admin Signature</p>
              </div>
              <div>
                <p style="margin: 0; border-top: 1px solid #000; width: 140px; margin-top: 20px;"></p>
                <p style="margin: 4px 0 0 0; font-size: 9px; text-align: center; font-weight: bold;">Date: ${paidDate.split(',')[0]}</p>
              </div>
            </div>
          </div>

          <div class="footer">
            <p>This is a system-generated official payment confirmation.</p>
            <p>Grefas Consult & Entertainment &bull; Ghana</p>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const triggerPrintPaymentSection = (app: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Popup blocker active. Please allow popups to print your receipt!');
      return;
    }

    const priceVal = app.price !== undefined ? Number(app.price) : 0;
    const installments = app.paymentPlan?.installments || [];
    
    const getAmountPaidClient = () => {
      if (!priceVal || !installments) return 0;
      return installments
        .filter((inst: any) => inst.status === 'Paid')
        .reduce((sum: number, inst: any) => sum + (inst.amount || 0), 0);
    };
    
    const paidAmount = getAmountPaidClient();
    const balanceDue = Math.max(0, priceVal - paidAmount);
    const statementDate = new Date().toLocaleString();

    const milestonesList = installments.map((inst: any) => `
      <tr style="border-bottom: 1px dashed #ddd; font-size: 11px;">
        <td style="padding: 10px 6px; font-weight: bold;">${inst.name}</td>
        <td style="padding: 10px 6px;">${inst.dueDate ? new Date(inst.dueDate).toLocaleDateString() : 'Immediate'}</td>
        <td style="padding: 10px 6px; font-family: monospace; font-weight: bold;">GH₵ ${Number(inst.amount).toLocaleString()}</td>
        <td style="padding: 10px 6px; font-weight: bold; color: ${inst.status === 'Paid' ? '#16a34a' : '#b45309'}">${inst.status.toUpperCase()}</td>
        <td style="padding: 10px 6px; font-family: monospace; font-size: 10px; color: #555;">${inst.transactionId || 'N/A'}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Payment Receipt & Statement - ${app.fullName}</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #1e293b; max-width: 800px; margin: 0 auto; line-height: 1.5; }
            .header { border-bottom: 3px double #cbd5e1; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; }
            .header-left h1 { margin: 0; font-size: 22px; color: #0f172a; font-weight: 800; letter-spacing: 0.5px; }
            .header-left p { margin: 4px 0 0 0; font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: bold; }
            .header-right { text-align: right; font-size: 11px; color: #64748b; }
            .title { text-align: center; font-size: 18px; font-weight: 800; color: #ea580c; text-transform: uppercase; margin-bottom: 25px; letter-spacing: 1px; }
            .info-block { display: grid; grid-template-cols: 1fr 1fr; gap: 20px; margin-bottom: 30px; background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; }
            .info-col p { margin: 4px 0; font-size: 12px; }
            .info-col strong { color: #0f172a; }
            .summary-box { border: 2px solid #ea580c; padding: 15px; background-color: #fffaf8; margin-bottom: 30px; border-radius: 8px; }
            .summary-grid { display: grid; grid-template-cols: repeat(3, 1fr); gap: 15px; text-align: center; }
            .summary-item { border-right: 1px solid #fed7aa; }
            .summary-item:last-child { border-right: none; }
            .summary-label { font-size: 10px; font-weight: 800; text-transform: uppercase; color: #7c2d12; margin-bottom: 4px; }
            .summary-value { font-size: 18px; font-weight: 800; font-family: monospace; }
            .table-container { margin-bottom: 30px; }
            table { width: 100%; border-collapse: collapse; text-align: left; }
            th { padding: 10px 6px; font-size: 10px; font-weight: 800; text-transform: uppercase; color: #475569; border-bottom: 2px solid #cbd5e1; background-color: #f1f5f9; }
            .footer { margin-top: 50px; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 20px; font-size: 11px; color: #64748b; }
            @media print {
              body { padding: 10px; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="header-left">
              <h1>GREFAS ENTERTAINMENT</h1>
              <p>Finance Division &bull; Casting & Skit Production Services</p>
            </div>
            <div class="header-right">
              <p><strong>Statement Date:</strong> ${statementDate}</p>
              <p><strong>Candidate ID:</strong> ${app.id.substring(0, 10)}</p>
            </div>
          </div>
          
          <div class="title">Official Payment Receipt & Statement</div>
          
          <div class="info-block">
            <div class="info-col">
              <p><strong>Candidate Name:</strong> ${app.fullName}</p>
              <p><strong>Contact:</strong> ${app.contact}</p>
              <p><strong>Email Address:</strong> ${app.emailAddress}</p>
            </div>
            <div class="info-col" style="text-align: right;">
              <p><strong>WhatsApp Number:</strong> ${app.whatsappNumber || 'N/A'}</p>
              <p><strong>Registration Date:</strong> ${app.createdAt ? new Date(app.createdAt).toLocaleDateString() : 'N/A'}</p>
              <p><strong>Role Categories:</strong> ${(app.roleTypes || []).join(', ') || app.roleType || 'N/A'}</p>
            </div>
          </div>

          <div class="summary-box">
            <div class="summary-grid">
              <div class="summary-item">
                <div class="summary-label">Total Enrollment Fee</div>
                <div class="summary-value" style="color: #0f172a;">GH₵ ${priceVal.toLocaleString()}</div>
              </div>
              <div class="summary-item">
                <div class="summary-label" style="color: #16a34a;">Amount Paid to Date</div>
                <div class="summary-value" style="color: #16a34a;">GH₵ ${paidAmount.toLocaleString()}</div>
              </div>
              <div class="summary-item">
                <div class="summary-label" style="color: #b91c1c;">Outstanding Balance</div>
                <div class="summary-value" style="color: #b91c1c;">GH₵ ${balanceDue.toLocaleString()}</div>
              </div>
            </div>
          </div>

          <div class="table-container">
            <h3 style="font-size: 12px; font-weight: 800; text-transform: uppercase; margin-bottom: 10px; color: #0f172a;">Milestone Invoices Ledger</h3>
            <table>
              <thead>
                <tr>
                  <th>Milestone Name</th>
                  <th>Due Date</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Transaction Ref ID</th>
                </tr>
              </thead>
              <tbody>
                ${milestonesList}
              </tbody>
            </table>
          </div>

          <div style="font-size: 11px; border: 1px solid #e2e8f0; padding: 15px; background: #f8fafc; border-radius: 8px; margin-top: 30px;">
            <strong style="color: #0f172a; text-transform: uppercase; font-size: 10px; display: block; margin-bottom: 5px;">Declaration & Official Validation:</strong>
            <p style="margin: 0; font-size: 10px; line-height: 1.5; color: #64748b;">
              This ledger document certifies the exact payments received and registered onto the Grefas Entertainment casting database as of today. Any payments shown here as "Paid" have been cleared, audited, and added toward your official audition profile ledger.
            </p>
            <div style="margin-top: 35px; display: flex; justify-content: space-between;">
              <div>
                <p style="margin: 0; border-top: 1px solid #cbd5e1; width: 220px; margin-top: 15px;"></p>
                <p style="margin: 4px 0 0 0; font-size: 9px; text-align: center; color: #64748b; font-weight: bold;">CEO / General Manager / Secretary / Admin Signature</p>
              </div>
              <div>
                <p style="margin: 0; border-top: 1px solid #cbd5e1; width: 150px; margin-top: 15px;"></p>
                <p style="margin: 4px 0 0 0; font-size: 9px; text-align: center; color: #64748b; font-weight: bold;">Date: ${new Date().toLocaleDateString()}</p>
              </div>
            </div>
          </div>

          <div class="footer">
            <p>This is an official system-generated payment confirmation and ledger statement.</p>
            <p>Grefas Consult & Entertainment &bull; Accra, Ghana</p>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleProcessPayment = async () => {
    if (!activePaymentApp || !activePaymentInstallment) return;
    setIsProcessingPayment(true);
    setPaymentStep('processing');
    
    // Simulate payment API roundtrip authorization delay
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    const txnId = paymentMode === 'momo' 
      ? `TXN-MOMO-${momoOperator.toUpperCase()}-${Math.floor(100000 + Math.random() * 900000)}`
      : `TXN-CARD-${Math.floor(100000 + Math.random() * 900000)}`;
      
    try {
      const appInsts = activePaymentApp.paymentPlan?.installments || [];
      const updatedInsts = appInsts.map((inst: any) => {
        if (inst.id === activePaymentInstallment.id) {
          return {
            ...inst,
            status: 'Paid',
            paidAt: new Date().toISOString(),
            transactionId: txnId,
            paymentMode,
            ...(paymentMode === 'momo' ? { momoOperator, momoNumber } : {})
          };
        }
        return inst;
      });
      
      const priceVal = Number(activePaymentApp.price) || 0;
      const paidAmount = updatedInsts
        .filter((inst: any) => inst.status === 'Paid')
        .reduce((sum: number, inst: any) => sum + (inst.amount || 0), 0);
        
      let calcStatus = 'Unpaid';
      if (priceVal > 0) {
        if (paidAmount >= priceVal) {
          calcStatus = 'Fully Paid';
        } else if (paidAmount > 0) {
          calcStatus = 'Partially Paid';
        }
      }
      
      const docRef = doc(db, 'service_intakes', activePaymentApp.id);
      await setDoc(docRef, {
        paymentStatus: calcStatus,
        paymentPlan: {
          ...activePaymentApp.paymentPlan,
          installments: updatedInsts
        }
      }, { merge: true });
      
      // Trigger notification immediately upon status updated to Paid in Firestore
      try {
        const balanceDue = Math.max(0, priceVal - paidAmount);
        await fetch('/api/notify-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fullName: activePaymentApp.fullName,
            emailAddress: activePaymentApp.emailAddress,
            contact: activePaymentApp.contact,
            amountPaid: activePaymentInstallment.amount,
            paymentPlan: activePaymentApp.paymentPlan?.type === 'full' ? 'One-time Full' : activePaymentApp.paymentPlan?.type === 'installments_2' ? '2-Installments (50/50)' : '3-Installments (40/30/30)',
            paymentMethod: paymentMode === 'momo' ? `Mobile Money (${momoOperator.toUpperCase()})` : 'Credit/Debit Card',
            totalPrice: priceVal,
            balanceDue: balanceDue,
            paymentStatus: calcStatus,
            refId: txnId
          })
        });
      } catch (notifyErr) {
        console.warn('Failed to dispatch payment notification:', notifyErr);
      }
      
      try {
        await addDoc(collection(db, 'activity_logs'), {
          userId: user.uid,
          userEmail: user.email,
          userName: activePaymentApp.fullName || user.displayName || 'Authorized Talent',
          type: 'payment_success',
          description: `Paid milestone "${activePaymentInstallment.name}" of GHS ${activePaymentInstallment.amount} via ${paymentMode.toUpperCase()}.`,
          createdAt: new Date().toISOString()
        });
      } catch (logErr) {
        console.warn('Failed to log client payment activity:', logErr);
      }
      
      setTransactionId(txnId);
      setPaymentStep('success');
      toast.success('Payment authorized and verified!');
    } catch (err: any) {
      console.error('Payment processing failed:', err);
      handleFirestoreError(err, OperationType.WRITE, `service_intakes/${activePaymentApp.id}`);
      toast.error('Could not process payment database record. Try again.');
      setPaymentStep('form');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const triggerPrintDraft = (app: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Popup blocker active. Please allow popups to print your receipt!');
      return;
    }

    const docBirth = app.dateOfBirth ? new Date(app.dateOfBirth).toLocaleDateString() : 'N/A';
    const regDate = app.createdAt ? new Date(app.createdAt).toLocaleString() : 'N/A';

    const priceVal = app.price !== undefined ? Number(app.price) : 0;
    const installments = app.paymentPlan?.installments || [];
    
    const getAmountPaidClient = () => {
      if (!priceVal || !installments) return 0;
      return installments
        .filter((inst: any) => inst.status === 'Paid')
        .reduce((sum: number, inst: any) => sum + (inst.amount || 0), 0);
    };
    
    const paidAmount = getAmountPaidClient();
    const balanceDue = Math.max(0, priceVal - paidAmount);

    let billingHtml = '';
    if (priceVal > 0) {
      const milestonesList = installments.map((inst: any) => `
        <tr style="border-bottom: 1px dashed #ddd; font-size: 11px;">
          <td style="padding: 6px 0;">${inst.name}</td>
          <td style="padding: 6px 0; font-family: monospace;">GH₵ ${inst.amount}</td>
          <td style="padding: 6px 0;">${inst.dueDate}</td>
          <td style="padding: 6px 0; font-weight: bold; color: ${inst.status === 'Paid' ? '#16a34a' : '#b45309'}">${inst.status.toUpperCase()}</td>
          <td style="padding: 6px 0; font-family: monospace; font-size: 10px; color: #555;">${inst.transactionId || 'N/A'}</td>
        </tr>
      `).join('');

      billingHtml = `
        <div style="margin-top: 30px; border: 2px solid #000; padding: 20px; background-color: #fafafa; border-radius: 4px;">
          <h3 style="margin: 0 0 15px 0; font-size: 14px; text-decoration: underline; text-transform: uppercase;">OFFICIAL BILLING & RECEIPT METRIC:</h3>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 12px;">
            <tr>
              <td style="padding: 4px 0; font-weight: bold; text-transform: uppercase;">Total Program Fee:</td>
              <td style="padding: 4px 0; font-family: monospace; font-weight: bold; text-align: right;">GH₵ ${priceVal.toFixed(2)}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; font-weight: bold; text-transform: uppercase;">Plan Layout Setup:</td>
              <td style="padding: 4px 0; font-weight: bold; text-align: right; text-transform: uppercase;">${
                app.paymentPlan?.type === 'full' ? 'Single Payment (Full)' : 
                app.paymentPlan?.type === 'installments_2' ? '2-Installments Setup' : 
                app.paymentPlan?.type === 'installments_3' ? '3-Installments Setup' : 
                'Custom Milestones Setup'
              }</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; font-weight: bold; text-transform: uppercase; color: #16a34a;">Total Amount Received:</td>
              <td style="padding: 4px 0; font-family: monospace; font-weight: bold; color: #16a34a; text-align: right;">GH₵ ${paidAmount.toFixed(2)}</td>
            </tr>
            <tr style="border-top: 1px double #000;">
              <td style="padding: 6px 0; font-weight: bold; text-transform: uppercase; color: #b91c1c;">Outstanding Balance:</td>
              <td style="padding: 6px 0; font-family: monospace; font-weight: bold; color: #b91c1c; text-align: right;">GH₵ ${balanceDue.toFixed(2)}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; font-weight: bold; text-transform: uppercase;">Account Billing Status:</td>
              <td style="padding: 4px 0; font-weight: bold; text-align: right; color: ${app.paymentStatus === 'Fully Paid' || balanceDue === 0 ? '#16a34a' : '#b45309'}">${(app.paymentStatus || (balanceDue === 0 ? 'Fully Paid' : 'Unpaid')).toUpperCase()}</td>
            </tr>
          </table>

          <h4 style="margin: 15px 0 8px 0; font-size: 12px; text-transform: uppercase; border-bottom: 1px solid #111; padding-bottom: 4px;">Milestones Breakdown & Transactions:</h4>
          <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 11px;">
            <thead>
              <tr style="border-bottom: 1px solid #111; font-weight: bold; text-transform: uppercase; font-size: 10px;">
                <th style="padding: 6px 0;">Milestone</th>
                <th style="padding: 6px 0;">Amount</th>
                <th style="padding: 6px 0;">Due Date</th>
                <th style="padding: 6px 0;">Status</th>
                <th style="padding: 6px 0;">Txn reference</th>
              </tr>
            </thead>
            <tbody>
              ${milestonesList}
            </tbody>
          </table>
        </div>
      `;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Grefas Casting Intake Receipt - ${app.fullName}</title>
          <style>
            body { font-family: 'Courier New', monospace; padding: 40px; color: #111; max-width: 800px; margin: 0 auto; line-height: 1.5; }
            .header { text-align: center; border-bottom: 3px double #000; padding-bottom: 20px; margin-bottom: 30px; }
            .header h1 { margin: 0; font-size: 28px; letter-spacing: 2px; }
            .header p { margin: 5px 0 0 0; font-size: 12px; text-transform: uppercase; }
            .title { text-align: center; font-size: 18px; font-weight: bold; text-decoration: underline; margin-bottom: 30px; }
            .grid { display: grid; grid-template-cols: 150px 1fr; row-gap: 15px; margin-bottom: 30px; font-size: 14px; }
            .label { font-weight: bold; text-transform: uppercase; }
            .value { border-bottom: 1px dashed #666; padding-bottom: 2px; }
            .footer { margin-top: 50px; text-align: center; border-top: 1px solid #ccc; padding-top: 20px; font-size: 11px; color: #555; }
            @media print {
              body { padding: 20px; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>GREFAS ENTERTAINMENT</h1>
            <p>Theatre, Film Casting & Skit Making Auditions</p>
            <p style="font-size: 10px; margin-top: 5px;">Reference ID: ${app.id || 'N/A'}</p>
          </div>
          
          <div class="title font-bold">FILM CASTING INTERACTIVE INTRACTABLE FORM</div>
          
          <div class="grid">
            <div class="label">Full Name:</div>
            <div class="value">${app.fullName || '__________________________________'}</div>
            
            <div class="label">Birth Date:</div>
            <div class="value">${docBirth}</div>
            
            <div class="label">Age:</div>
            <div class="value">${app.age || '___'} Years Old</div>
            
            <div class="label">Phone Contact:</div>
            <div class="value">${app.contact || '__________________________________'}</div>
            
            <div class="label">WhatsApp:</div>
            <div class="value">${app.whatsappNumber || '__________________________________'}</div>
            
            <div class="label">Email Address:</div>
            <div class="value">${app.emailAddress || '__________________________________'}</div>
            
            <div class="label">Address Info:</div>
            <div class="value">${app.address || '____________________________________________________'}</div>

            <div class="label">Status:</div>
            <div class="value" style="font-weight: bold;">${app.status || 'Pending'}</div>

            <div class="label">Logged At:</div>
            <div class="value">${regDate}</div>
          </div>

          ${billingHtml}

          <div style="margin-top: 40px; font-size: 12px; border: 1px solid #111; padding: 15px; background: #fafafa;">
            <strong>MEMBER SIGN OFF & VERIFICATION METRIC:</strong>
            <p style="margin: 8px 0 0 0; font-size: 11px; line-height: 1.6;">
              By presenting this copy of the Grefas Casting Form, the applicant acknowledges that all demo tapes,
              audition reels, and physical casting metrics furnished are proprietary to Grefas Consult Division.
            </p>
            <div style="margin-top: 30px; display: flex; justify-content: space-between; gap: 15px;">
              <div>
                <p style="margin: 0; border-top: 1px solid #000; width: 180px; margin-top: 30px;"></p>
                <p style="margin: 5px 0 0 0; font-size: 10px; text-align: center; font-weight: bold;">Applicant Signature</p>
              </div>
              <div>
                <p style="margin: 0; border-top: 1px solid #000; width: 220px; margin-top: 30px;"></p>
                <p style="margin: 5px 0 0 0; font-size: 10px; text-align: center; font-weight: bold;">CEO / General Manager / Secretary / Admin Signature</p>
              </div>
              <div>
                <p style="margin: 0; border-top: 1px solid #000; width: 140px; margin-top: 30px;"></p>
                <p style="margin: 5px 0 0 0; font-size: 10px; text-align: center; font-weight: bold;">Date: ${new Date().toLocaleDateString()}</p>
              </div>
            </div>
          </div>

          <div class="footer">
            <p>Official Transmission Copy. Printed on ${new Date().toLocaleString()}</p>
            <p>Grefas Consult & Entertainment &bull; Ghana</p>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="min-h-screen bg-muted/20 dark:bg-background/95 py-12 px-4 sm:px-6 lg:px-8">
      <SEO 
        title="My Casting Applications | Grefas Entertainment" 
        description="Check your real-time audition, casting, and skit making registration status in Ghana."
      />

      <div className="max-w-4xl mx-auto">
        {/* Banner Section */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-orange-500/10 text-orange-600 border border-orange-500/20 text-xs font-bold uppercase tracking-wider mb-3 spin-on-hover"
          >
            <Sparkles className="h-4 w-4 text-orange-600" />
            <span>Audition & Casting Tracking Suite</span>
          </motion.div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            My Applications
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-xl mx-auto">
            Log in to securely track your Movie and Skit registration forms, read coordinator memos, and view casting responses.
          </p>
        </div>

        {authLoading ? (
          <div className="flex justify-center items-center h-64 border rounded-2xl bg-card">
            <div className="text-center space-y-3">
              <Loader2 className="h-10 w-10 animate-spin text-orange-600 mx-auto" />
              <p className="text-sm text-semibold text-muted-foreground">Authenticating connection...</p>
            </div>
          </div>
        ) : !user ? (
          /* Locked State - Requires Google Login */
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border/80 p-8 rounded-2xl text-center shadow-xl max-w-lg mx-auto"
          >
            <div className="h-16 w-16 mx-auto rounded-2xl bg-orange-500/10 dark:bg-orange-500/5 flex items-center justify-center border border-orange-500/20 text-orange-600 mb-6 animate-pulse">
              <LogIn className="h-8 w-8 text-orange-600" />
            </div>
            
            <h2 className="text-xl font-bold tracking-tight text-foreground mb-2">Secure Area Account Authentication</h2>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-sm mx-auto mb-6">
              To protect your private data like contact numbers, birthdates, and residences, please sign in. You can register or login with any active email address. Any applications matching your email will appear automatically!
            </p>

            <div className="flex justify-center max-w-xs mx-auto">
              <Button 
                onClick={() => {
                  setAppAuthDefaultMode('signin');
                  setAppAuthOpen(true);
                }}
                className="bg-orange-600 hover:bg-orange-700 text-white font-extrabold rounded-xl px-6 h-12 flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer w-full text-xs uppercase tracking-wider"
              >
                <Mail className="h-4 w-4 shrink-0" />
                <span>Sign In / Register</span>
              </Button>
            </div>
          </motion.div>
        ) : (
          /* Logged In Content */
          <div className="space-y-6">
            {/* User Profile Info Card */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-orange-500/5 dark:bg-orange-950/10 border border-orange-500/20 p-4 sm:p-5 rounded-2xl">
              <div className="flex items-center gap-3">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName} className="h-10 w-10 rounded-full border border-orange-500/30 shrink-0" referrerPolicy="no-referrer" />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-orange-500/20 flex items-center justify-center font-bold text-orange-600 shrink-0">
                    {user.displayName?.charAt(0) || user.email?.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="text-left">
                  <p className="text-sm font-bold text-foreground">{user.displayName || 'Authorized Talent'}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
              </div>
              <Button 
                variant="outline"
                size="sm"
                onClick={handleSignOut}
                className="text-muted-foreground border-border hover:text-red-500 hover:bg-red-500/5 rounded-xl text-xs font-semibold gap-1.5 self-stretch sm:self-auto cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out</span>
              </Button>
            </div>

            {/* Email Notification Toggle (User Profile Settings) */}
            <div className="bg-card border border-border/80 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-orange-600" />
                  <h3 className="text-sm font-bold text-foreground">Status Updates Email Notifications</h3>
                </div>
                <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
                  Receive real-time automated email alerts as soon as the directors update your casting registration stage (e.g. Approved, In Review, Rejected).
                </p>
              </div>
              
              <div className="flex items-center gap-3 self-end md:self-auto shrink-0">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${
                  emailNotificationsEnabled ? 'text-orange-600 dark:text-orange-400' : 'text-muted-foreground'
                }`}>
                  {emailNotificationsEnabled ? 'Active' : 'Muted'}
                </span>
                
                <button
                  type="button"
                  disabled={updatingNotifications}
                  onClick={() => handleToggleNotifications(!emailNotificationsEnabled)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden disabled:opacity-50 ${
                    emailNotificationsEnabled ? 'bg-orange-600' : 'bg-muted-foreground/30'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      emailNotificationsEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {loadingApps ? (
              <div className="text-center py-20 bg-card border rounded-2xl">
                <Loader2 className="h-8 w-8 animate-spin text-orange-600 mx-auto" />
                <p className="text-xs text-muted-foreground mt-2">Retrieving applications history...</p>
              </div>
            ) : applications.length === 0 ? (
              /* No Submissions found */
              <div className="bg-card border border-dashed border-border p-12 rounded-2xl text-center">
                <div className="h-12 w-12 mx-auto rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-4">
                  <FileText className="h-6 w-6" />
                </div>
                <h3 className="text-base font-bold text-foreground mb-1">No Casting Forms Filed</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto mb-6">
                  You haven't submitted a Movie & Skit making Form yet! When you file a casting registration underneath the Services page, your records will populate here.
                </p>
                <Button asChild className="bg-orange-600 hover:bg-orange-700 text-white rounded-xl">
                  <Link to="/services">Go to Movie and Skit Form</Link>
                </Button>
              </div>
            ) : (
              /* Submissions Grid */
              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    My Submissions ({applications.length})
                  </p>
                  <p className="text-[10px] font-mono text-muted-foreground">
                    Matches: {user.email}
                  </p>
                </div>

                {applications.map((app) => (
                  <motion.div
                    key={app.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-card border border-border/80 hover:border-orange-500/30 rounded-2xl p-5 sm:p-6 shadow-sm hover:shadow-md transition-all duration-300"
                  >
                    <div className="flex flex-col md:flex-row justify-between gap-4">
                      {/* Left: Applicant & Status Info */}
                      <div className="space-y-3.5 flex-1">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-bold text-foreground">{app.fullName}</h3>
                            <span className="text-[10px] font-mono text-muted-foreground bg-muted py-0.5 px-2 rounded-full border border-border/50">
                              Ref: {app.id.substring(0, 8)}
                            </span>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground mt-1.5">
                            <span className="bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold px-1.5 py-0.5 rounded text-[10px]">
                              {app.age} Years Old
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-orange-600" />
                              Registered: {app.createdAt ? new Date(app.createdAt).toLocaleDateString() : 'N/A'}
                            </span>
                          </div>

                          {/* Applied Roles Badges */}
                          <div className="flex flex-wrap gap-1 mt-2">
                            {(app.roleTypes && Array.isArray(app.roleTypes)) ? (
                              app.roleTypes.map((role: string, index: number) => (
                                <span key={index} className="bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-orange-500/10">
                                  {role}
                                </span>
                              ))
                            ) : app.roleType ? (
                              app.roleType.split(', ').map((role: string, index: number) => (
                                <span key={index} className="bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-orange-500/10">
                                  {role}
                                </span>
                              ))
                            ) : (
                              <span className="bg-zinc-100 dark:bg-zinc-800 text-muted-foreground text-[10px] font-semibold px-2 py-0.5 rounded-full">
                                No Role Specified
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Contacts Summary */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-muted-foreground bg-muted/30 p-3 rounded-xl border border-border/40">
                          <div className="flex items-center gap-2">
                            <Phone className="h-3.5 w-3.5 text-orange-600/70" />
                            <span>Phone: {app.contact}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MessageCircle className="h-3.5 w-3.5 text-emerald-500" />
                            <span>WhatsApp: {app.whatsappNumber}</span>
                          </div>
                          <div className="flex items-center gap-2 sm:col-span-2">
                            <Mail className="h-3.5 w-3.5 text-orange-600/70" />
                            <span className="truncate">Email: {app.emailAddress}</span>
                          </div>
                          <div className="flex items-center gap-2 sm:col-span-2">
                            <MapPin className="h-3.5 w-3.5 text-orange-600/70" />
                            <span className="truncate">Residence: {app.address}</span>
                          </div>
                        </div>

                        {/* Account Billing & Payments Status */}
                        {app.price > 0 && (
                          <div className="mt-5 pt-5 border-t border-border/60 space-y-4">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-muted/25 p-4 rounded-xl border border-border/40">
                              <div className="space-y-1">
                                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                  <CreditCard className="h-3.5 w-3.5 text-orange-600 animate-pulse" /> Tuition & Casting Fee Breakdown
                                </h4>
                                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs font-bold text-foreground">
                                  <div>Total Cost: <span className="font-mono text-orange-600">GH₵ {Number(app.price).toLocaleString()}</span></div>
                                  <div className="text-muted-foreground font-normal">•</div>
                                  <div>Amount Paid: <span className="font-mono text-emerald-600">GH₵ {getAmountPaid(app).toLocaleString()}</span></div>
                                  <div className="text-muted-foreground font-normal">•</div>
                                  <div>Outstanding: <span className="font-mono text-red-500">GH₵ {(Number(app.price) - getAmountPaid(app)).toLocaleString()}</span></div>
                                </div>
                              </div>

                              <div className="w-full sm:w-48 space-y-1">
                                <div className="flex justify-between text-[10px] font-bold text-muted-foreground uppercase">
                                  <span>Payment Progress</span>
                                  <span className="font-mono text-emerald-600">{Math.round((getAmountPaid(app) / Number(app.price)) * 100)}%</span>
                                </div>
                                <div className="h-2 w-full bg-muted border border-border/50 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                                    style={{ width: `${(getAmountPaid(app) / Number(app.price)) * 100}%` }}
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Milestones Listing */}
                            <div className="space-y-2.5">
                              <h5 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">
                                Scheduled Payment Milestones / Invoices
                              </h5>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {(app.paymentPlan?.installments || []).map((inst: any, idx: number) => {
                                  const isPaid = inst.status === 'Paid';
                                  const isOverdue = !isPaid && new Date(inst.dueDate) < new Date();
                                  return (
                                    <div 
                                      key={inst.id || idx}
                                      className={`p-3.5 rounded-xl border flex flex-col justify-between gap-3 bg-card/40 transition-colors ${
                                        isPaid ? 'border-emerald-500/20 hover:bg-emerald-500/[0.01]' : 
                                        isOverdue ? 'border-red-500/20 hover:bg-red-500/[0.01]' : 'border-border/80 hover:bg-muted/[0.01]'
                                      }`}
                                    >
                                      {/* Info */}
                                      <div className="space-y-1">
                                        <div className="flex items-start justify-between gap-2">
                                          <span className="font-bold text-xs text-foreground line-clamp-1">{inst.name}</span>
                                          <span className={`shrink-0 inline-block px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wide ${
                                            isPaid ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-500/10' :
                                            isOverdue ? 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400 border border-red-500/10' :
                                            'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-500/10'
                                          }`}>
                                            {isPaid ? 'Paid' : isOverdue ? 'Overdue' : 'Unpaid'}
                                          </span>
                                        </div>
                                        <div className="text-[10px] text-muted-foreground font-semibold flex justify-between items-center">
                                          <span>Due: {inst.dueDate ? new Date(inst.dueDate).toLocaleDateString() : 'Immediate'}</span>
                                          <span className="font-bold text-xs text-foreground font-mono">GH₵ {inst.amount.toLocaleString()}</span>
                                        </div>
                                      </div>

                                      {/* Action Button */}
                                      {isPaid ? (
                                        <div className="grid grid-cols-2 gap-2 mt-1">
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => triggerPrintReceipt(app, inst)}
                                            className="h-8 text-[10px] font-bold w-full rounded-lg border-emerald-500/20 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/5 cursor-pointer flex items-center justify-center gap-1"
                                          >
                                            <Printer className="h-3.5 w-3.5 shrink-0" /> Print
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => downloadReceiptPdf(app, inst)}
                                            className="h-8 text-[10px] font-bold w-full rounded-lg border-orange-500/20 text-orange-600 hover:text-orange-700 hover:bg-orange-500/5 cursor-pointer flex items-center justify-center gap-1"
                                          >
                                            <Download className="h-3.5 w-3.5 shrink-0" /> Download
                                          </Button>
                                        </div>
                                      ) : (
                                        <Button
                                          size="sm"
                                          onClick={() => {
                                            setActivePaymentApp(app);
                                            setActivePaymentInstallment(inst);
                                            setPaymentMode('momo');
                                            setMomoOperator('mtn');
                                            setMomoNumber(app.whatsappNumber || app.contact || '');
                                            setPaymentStep('form');
                                            setTransactionId('');
                                          }}
                                          className="h-8 text-[11px] font-bold w-full rounded-lg bg-orange-600 hover:bg-orange-700 text-white cursor-pointer shadow-xs"
                                        >
                                          <CreditCard className="h-3.5 w-3.5 mr-1" /> Pay Milestone Fee
                                        </Button>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Right: Assessment Status Indicators */}
                      <div className="flex flex-row md:flex-col justify-between md:justify-start items-center md:items-end gap-3 md:w-56 shrink-0 md:border-l md:border-border/40 md:pl-5">
                        <div className="text-center md:text-right w-full">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest hidden md:block mb-1.5">
                            Director Stage
                          </p>
                          <div className={`inline-flex items-center gap-1.5 px-3 py-1 font-extrabold uppercase rounded-full text-[10px] ${
                            app.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' :
                            app.status === 'In Review' ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20' :
                            app.status === 'Rejected' ? 'bg-red-500/10 text-red-600 border border-red-500/20' :
                            'bg-violet-500/10 text-violet-600 border border-violet-500/20'
                          }`}>
                            {app.status === 'Approved' ? <CheckCircle2 className="h-3.5 w-3.5" /> : 
                             app.status === 'In Review' ? <Clock className="h-3.5 w-3.5 animate-pulse" /> :
                             app.status === 'Rejected' ? <X className="h-3.5 w-3.5" /> :
                             <Clock className="h-3.5 w-3.5" />}
                            <span>{app.status || 'Pending'}</span>
                          </div>
                        </div>

                        {/* Status Message Guidance */}
                        <div className="text-[11px] leading-relaxed text-muted-foreground font-medium md:text-right hidden sm:block">
                          {app.status === 'Approved' ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                              Approval Confirmed! Casting division will WhatsApp you directly to schedule auditions.
                            </span>
                          ) : app.status === 'In Review' ? (
                            <span className="text-amber-600 dark:text-amber-400">
                              Coordinator review active. Screenings are currently comparing local roles.
                            </span>
                          ) : app.status === 'Rejected' ? (
                            <span className="text-muted-foreground/80">
                              Casting limits reached. We will keep your portfolio in Grefas archives for sequels.
                            </span>
                          ) : (
                            <span className="opacity-90">
                              Initial queue reception confirmed. Logged for standard directory processing.
                            </span>
                          )}
                        </div>

                        <div className="flex flex-col sm:flex-row items-center gap-2 self-end md:self-auto w-full pt-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => triggerPrintDraft(app)}
                            className="text-xs h-9 w-full flex items-center justify-center gap-1.5 border-border rounded-xl hover:bg-muted font-semibold text-muted-foreground hover:text-foreground"
                          >
                            <Printer className="h-3.5 w-3.5 text-orange-600" />
                            <span>Print Profile Draft</span>
                          </Button>
                          
                          {app.price !== undefined && Number(app.price) > 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => triggerPrintPaymentSection(app)}
                              className="text-xs h-9 w-full flex items-center justify-center gap-1.5 border-emerald-500/20 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/5 rounded-xl font-semibold"
                            >
                              <Receipt className="h-3.5 w-3.5 text-emerald-600" />
                              <span>Print Payment Receipt</span>
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Payment Simulator Modal */}
      {activePaymentInstallment && activePaymentApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-5 py-4 border-b border-border/60 flex items-center justify-between bg-muted/20">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-orange-600" />
                <h3 className="text-sm font-bold text-foreground">Secure Checkout Simulator</h3>
              </div>
              {!isProcessingPayment && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setActivePaymentInstallment(null);
                    setActivePaymentApp(null);
                  }}
                  className="h-7 w-7 text-muted-foreground hover:text-foreground rounded-lg cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Body */}
            <div className="p-5 flex-1 min-h-[250px] flex flex-col justify-center">
              {paymentStep === 'form' && (
                <div className="space-y-4">
                  {/* Summary */}
                  <div className="p-3 bg-muted/30 rounded-xl border border-border/40 text-xs space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground font-semibold">Casting Milestone:</span>
                      <span className="text-foreground font-bold">{activePaymentInstallment.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground font-semibold">Amount Due:</span>
                      <span className="text-orange-600 font-extrabold font-mono">GH₵ {activePaymentInstallment.amount.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Payment Mode Selector */}
                  <div className="grid grid-cols-2 gap-2 p-1 bg-muted/40 rounded-lg">
                    <button
                      onClick={() => setPaymentMode('momo')}
                      className={`py-1.5 rounded text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        paymentMode === 'momo' ? 'bg-card text-orange-600 shadow-xs' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Phone className="h-3.5 w-3.5" /> Mobile Money
                    </button>
                    <button
                      onClick={() => setPaymentMode('card')}
                      className={`py-1.5 rounded text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        paymentMode === 'card' ? 'bg-card text-orange-600 shadow-xs' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <CreditCard className="h-3.5 w-3.5" /> Bank Card
                    </button>
                  </div>

                  {/* Form inputs */}
                  {paymentMode === 'momo' ? (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Network Provider</label>
                        <div className="grid grid-cols-3 gap-1.5">
                          {['mtn', 'telecel', 'airteltigo'].map((op) => (
                            <button
                              key={op}
                              onClick={() => setMomoOperator(op as any)}
                              className={`py-2 text-[10px] uppercase font-bold border rounded-lg transition-all cursor-pointer ${
                                momoOperator === op 
                                  ? 'border-orange-500 bg-orange-500/5 text-orange-600' 
                                  : 'border-border/60 hover:bg-muted text-muted-foreground'
                              }`}
                            >
                              {op === 'airteltigo' ? 'AirtelTigo' : op}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Wallet Phone Number</label>
                        <Input
                          type="tel"
                          value={momoNumber}
                          onChange={(e) => setMomoNumber(e.target.value)}
                          placeholder="e.g. 0541234567"
                          className="h-9 text-xs font-semibold"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Card Number</label>
                        <Input
                          type="text"
                          value={cardNumber}
                          onChange={(e) => setCardNumber(e.target.value)}
                          placeholder="4000 1234 5678 9010"
                          className="h-9 text-xs font-semibold"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Expiry (MM/YY)</label>
                          <Input
                            type="text"
                            value={cardExpiry}
                            onChange={(e) => setCardExpiry(e.target.value)}
                            placeholder="12/28"
                            className="h-9 text-xs font-semibold"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">CVV</label>
                          <Input
                            type="password"
                            value={cardCvv}
                            onChange={(e) => setCardCvv(e.target.value)}
                            placeholder="***"
                            maxLength={3}
                            className="h-9 text-xs font-semibold"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Proceed Button */}
                  <Button
                    onClick={handleProcessPayment}
                    disabled={paymentMode === 'momo' ? !momoNumber : (!cardNumber || !cardExpiry || !cardCvv)}
                    className="w-full h-10 text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white cursor-pointer shadow-md mt-2"
                  >
                    Authorize Payment of GH₵ {activePaymentInstallment.amount.toLocaleString()}
                  </Button>
                </div>
              )}

              {paymentStep === 'processing' && (
                <div className="py-6 text-center space-y-4">
                  <Loader2 className="h-10 w-10 text-orange-600 animate-spin mx-auto" />
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-foreground">Processing Secure Transaction...</p>
                    <p className="text-[11px] text-muted-foreground px-4">
                      {paymentMode === 'momo' 
                        ? `A push notification request has been dispatched to ${momoNumber}. Please authenticate via your device's mobile wallet PIN prompts.`
                        : "Authorizing charge request with your bank..."}
                    </p>
                  </div>
                </div>
              )}

              {paymentStep === 'success' && (
                <div className="py-6 text-center space-y-4">
                  <div className="h-12 w-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 flex items-center justify-center mx-auto">
                    <Check className="h-6 w-6 stroke-[3]" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-foreground">Payment Successful!</p>
                    <p className="text-[11px] text-muted-foreground px-4">
                      Your transaction GHS {activePaymentInstallment.amount.toLocaleString()} has been processed and recorded in Grefas archives.
                    </p>
                    <p className="text-[10px] text-emerald-600 font-semibold px-4 pt-1">
                      An automated receipt email and SMS notification has been sent immediately.
                    </p>
                  </div>
                  <div className="p-2.5 bg-muted/40 rounded-lg max-w-[280px] mx-auto text-[10px] font-mono text-muted-foreground border">
                    REF ID: {transactionId}
                  </div>
                  <Button
                    onClick={() => {
                      setActivePaymentInstallment(null);
                      setActivePaymentApp(null);
                    }}
                    className="w-full max-w-[180px] h-9 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                  >
                    Close & Return
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <AuthDialog 
        isOpen={appAuthOpen} 
        onClose={() => setAppAuthOpen(false)} 
        defaultMode={appAuthDefaultMode} 
      />
    </div>
  );
}
