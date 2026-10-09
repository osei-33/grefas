import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  updateDoc,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '@/firebase';
import { getRecordNegotiationSummary } from '@/lib/servicePricing';
import {
  sendNegotiatedPriceApprovedSms,
  buildNegotiationSmsMessage,
} from '@/lib/arkeselSms';
import { logAuditActivity } from '@/lib/auditLogger';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  Handshake,
  CheckCircle,
  Clock,
  AlertCircle,
  Search,
  Send,
  Phone,
  Mail,
  DollarSign,
  Sparkles,
  FileText,
  Calendar as CalendarIcon,
  MessageSquare,
  RefreshCw,
  Check,
  X,
  ArrowUpRight,
  Sliders,
  ShieldCheck,
  History,
  User as UserIcon,
  Loader2,
  Percent,
} from 'lucide-react';

export interface UnifiedNegotiationItem {
  id: string;
  sourceCollection: 'bookings' | 'service_intakes';
  sourceLabel: 'Service Booking' | 'Client Intake';
  orderNumber: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  userId: string;
  serviceTitle: string;
  dateStr: string;
  originalPrice: number;
  proposedPrice: number | null;
  adminCounterPrice: number | null;
  agreedPrice: number | null;
  finalTotal: number;
  discountPercent: number;
  discountAmount: number;
  amountPaid: number;
  balanceDue: number;
  paymentStatus: string;
  orderStatus: string;
  negotiationStatus: 'none' | 'pending_admin' | 'countered_by_admin' | 'agreed' | 'rejected';
  clientNote: string;
  adminNote: string;
  history: any[];
  agreedSmsSentAt?: string | null;
  agreedSmsRecipient?: string | null;
  agreedSmsMessage?: string | null;
  hasNegotiationActivity: boolean;
  raw: any;
}

export default function ManageNegotiatedPrices() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [intakes, setIntakes] = useState<any[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [loadingIntakes, setLoadingIntakes] = useState(true);

  const [statusFilter, setStatusFilter] = useState<
    'all_negotiations' | 'pending_admin' | 'agreed' | 'countered_by_admin' | 'rejected' | 'all_orders'
  >('all_negotiations');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'bookings' | 'service_intakes'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal state for reviewing / approving agreed budget & dispatching SMS
  const [selectedItem, setSelectedItem] = useState<UnifiedNegotiationItem | null>(null);
  const [modalAction, setModalAction] = useState<'approve' | 'counter' | 'reject'>('approve');
  const [budgetInput, setBudgetInput] = useState<string>('');
  const [discountPctInput, setDiscountPctInput] = useState<string>('0');
  const [adminNoteInput, setAdminNoteInput] = useState<string>('');
  const [smsPhoneInput, setSmsPhoneInput] = useState<string>('');
  const [sendSmsChecked, setSendSmsChecked] = useState<boolean>(true);
  const [customSmsText, setCustomSmsText] = useState<string>('');
  const [smsEditedManually, setSmsEditedManually] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [quickApprovingId, setQuickApprovingId] = useState<string | null>(null);

  useEffect(() => {
    const unsubBookings = onSnapshot(
      collection(db, 'bookings'),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setBookings(list);
        setLoadingBookings(false);
      },
      (err) => {
        console.error('Error listening to bookings for negotiations:', err);
        setLoadingBookings(false);
      }
    );

    const unsubIntakes = onSnapshot(
      collection(db, 'service_intakes'),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setIntakes(list);
        setLoadingIntakes(false);
      },
      (err) => {
        console.error('Error listening to service_intakes for negotiations:', err);
        setLoadingIntakes(false);
      }
    );

    return () => {
      unsubBookings();
      unsubIntakes();
    };
  }, []);

  const unifiedItems = useMemo<UnifiedNegotiationItem[]>(() => {
    const normalizedBookings: UnifiedNegotiationItem[] = bookings.map((b) => {
      const fallbackBase = Number(b.originalPrice ?? b.servicePrice ?? b.totalPrice ?? 150);
      const summary = getRecordNegotiationSummary(b, fallbackBase);
      const rawStatus = String(b.negotiationStatus || '').toLowerCase();
      let normStatus: UnifiedNegotiationItem['negotiationStatus'] = summary.negotiationStatus;
      if (rawStatus === 'countered') normStatus = 'countered_by_admin';
      if (
        normStatus === 'none' &&
        (String(b.status || '').toLowerCase() === 'negotiation' || summary.proposedPrice !== null)
      ) {
        normStatus = 'pending_admin';
      }

      const hasNegotiationActivity =
        normStatus !== 'none' ||
        summary.proposedPrice !== null ||
        summary.agreedPrice !== null ||
        summary.adminCounterPrice !== null ||
        (b.negotiatedPrice !== undefined &&
          b.negotiatedPrice !== null &&
          Number(b.negotiatedPrice) !== summary.originalPrice) ||
        String(b.status || '').toLowerCase() === 'negotiation' ||
        (Array.isArray(b.negotiationHistory) && b.negotiationHistory.length > 0);

      let dateStr = b.date || '';
      if (!dateStr && b.createdAt) {
        dateStr = b.createdAt?.toDate
          ? b.createdAt.toDate().toISOString().split('T')[0]
          : String(b.createdAt).substring(0, 10);
      }

      return {
        id: b.id,
        sourceCollection: 'bookings',
        sourceLabel: 'Service Booking',
        orderNumber: b.orderNumber || `BK-${b.id.slice(0, 6).toUpperCase()}`,
        clientName: b.userName || b.fullName || 'Client',
        clientEmail: b.userEmail || b.email || '',
        clientPhone: b.userPhone || b.phone || b.contact || b.whatsappNumber || '',
        userId: b.userId || 'anonymous',
        serviceTitle: b.serviceTitle || b.selectedProgramName || 'Consultation & Service',
        dateStr,
        originalPrice: summary.originalPrice,
        proposedPrice: summary.proposedPrice,
        adminCounterPrice: summary.adminCounterPrice,
        agreedPrice: summary.agreedPrice,
        finalTotal: summary.finalTotal,
        discountPercent: summary.discountPercent,
        discountAmount: summary.discountAmount,
        amountPaid: summary.amountPaid,
        balanceDue: summary.balanceDue,
        paymentStatus: b.paymentStatus || (summary.balanceDue === 0 && summary.finalTotal > 0 ? 'paid' : 'unpaid'),
        orderStatus: b.status || 'pending',
        negotiationStatus: normStatus,
        clientNote: b.clientNegotiationNote || b.negotiationNote || b.notes || '',
        adminNote: b.negotiationNotes || '',
        history: Array.isArray(b.negotiationHistory) ? b.negotiationHistory : [],
        agreedSmsSentAt: b.agreedSmsSentAt || null,
        agreedSmsRecipient: b.agreedSmsRecipient || null,
        agreedSmsMessage: b.agreedSmsMessage || null,
        hasNegotiationActivity,
        raw: b,
      };
    });

    const normalizedIntakes: UnifiedNegotiationItem[] = intakes.map((item) => {
      const fallbackBase = Number(item.originalPrice ?? item.totalPrice ?? item.price ?? 500);
      const summary = getRecordNegotiationSummary(item, fallbackBase);
      const rawStatus = String(item.negotiationStatus || '').toLowerCase();
      let normStatus: UnifiedNegotiationItem['negotiationStatus'] = summary.negotiationStatus;
      if (rawStatus === 'countered') normStatus = 'countered_by_admin';
      if (
        normStatus === 'none' &&
        (String(item.status || '').toLowerCase() === 'negotiation' || summary.proposedPrice !== null)
      ) {
        normStatus = 'pending_admin';
      }

      const hasNegotiationActivity =
        normStatus !== 'none' ||
        summary.proposedPrice !== null ||
        summary.agreedPrice !== null ||
        summary.adminCounterPrice !== null ||
        (item.negotiatedPrice !== undefined &&
          item.negotiatedPrice !== null &&
          Number(item.negotiatedPrice) !== summary.originalPrice) ||
        String(item.status || '').toLowerCase() === 'negotiation' ||
        (Array.isArray(item.negotiationHistory) && item.negotiationHistory.length > 0);

      let dateStr = '';
      if (item.createdAt) {
        dateStr = item.createdAt?.toDate
          ? item.createdAt.toDate().toISOString().split('T')[0]
          : String(item.createdAt).substring(0, 10);
      }

      return {
        id: item.id,
        sourceCollection: 'service_intakes',
        sourceLabel: 'Client Intake',
        orderNumber: item.orderNumber || `INT-${item.id.slice(0, 6).toUpperCase()}`,
        clientName: item.fullName || item.userName || 'Client',
        clientEmail: item.emailAddress || item.userEmail || '',
        clientPhone: item.contact || item.whatsappNumber || item.userPhone || '',
        userId: item.userId || 'anonymous',
        serviceTitle: item.selectedProgramName || item.roleType || 'Service Intake Request',
        dateStr,
        originalPrice: summary.originalPrice,
        proposedPrice: summary.proposedPrice,
        adminCounterPrice: summary.adminCounterPrice,
        agreedPrice: summary.agreedPrice,
        finalTotal: summary.finalTotal,
        discountPercent: summary.discountPercent,
        discountAmount: summary.discountAmount,
        amountPaid: summary.amountPaid,
        balanceDue: summary.balanceDue,
        paymentStatus: item.paymentStatus || (summary.balanceDue === 0 && summary.finalTotal > 0 ? 'Fully Paid' : 'Unpaid'),
        orderStatus: item.status || 'Pending',
        negotiationStatus: normStatus,
        clientNote: item.clientNegotiationNote || item.negotiationNote || '',
        adminNote: item.negotiationNotes || '',
        history: Array.isArray(item.negotiationHistory) ? item.negotiationHistory : [],
        agreedSmsSentAt: item.agreedSmsSentAt || null,
        agreedSmsRecipient: item.agreedSmsRecipient || null,
        agreedSmsMessage: item.agreedSmsMessage || null,
        hasNegotiationActivity,
        raw: item,
      };
    });

    const combined = [...normalizedBookings, ...normalizedIntakes];
    return combined.sort((a, b) => {
      // Prioritize pending_admin first, then newest date
      if (a.negotiationStatus === 'pending_admin' && b.negotiationStatus !== 'pending_admin') return -1;
      if (b.negotiationStatus === 'pending_admin' && a.negotiationStatus !== 'pending_admin') return 1;
      return String(b.dateStr || '').localeCompare(String(a.dateStr || ''));
    });
  }, [bookings, intakes]);

  const metrics = useMemo(() => {
    const negotiatedOnly = unifiedItems.filter((i) => i.hasNegotiationActivity);
    const pendingCount = negotiatedOnly.filter((i) => i.negotiationStatus === 'pending_admin').length;
    const agreedItems = negotiatedOnly.filter((i) => i.negotiationStatus === 'agreed');
    const counteredCount = negotiatedOnly.filter((i) => i.negotiationStatus === 'countered_by_admin').length;
    const totalAgreedBudgetVolume = agreedItems.reduce((sum, i) => sum + (i.agreedPrice ?? i.finalTotal), 0);
    const totalClientSavings = agreedItems.reduce(
      (sum, i) => sum + Math.max(0, i.originalPrice - (i.agreedPrice ?? i.finalTotal)),
      0
    );
    const smsSentCount = unifiedItems.filter((i) => Boolean(i.agreedSmsSentAt)).length;

    return {
      totalNegotiations: negotiatedOnly.length,
      pendingCount,
      agreedCount: agreedItems.length,
      counteredCount,
      totalAgreedBudgetVolume,
      totalClientSavings,
      smsSentCount,
    };
  }, [unifiedItems]);

  const filteredItems = useMemo(() => {
    return unifiedItems.filter((item) => {
      if (statusFilter === 'all_negotiations' && !item.hasNegotiationActivity) return false;
      if (statusFilter === 'pending_admin' && item.negotiationStatus !== 'pending_admin') return false;
      if (statusFilter === 'agreed' && item.negotiationStatus !== 'agreed') return false;
      if (statusFilter === 'countered_by_admin' && item.negotiationStatus !== 'countered_by_admin') return false;
      if (statusFilter === 'rejected' && item.negotiationStatus !== 'rejected') return false;

      if (sourceFilter !== 'all' && item.sourceCollection !== sourceFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const match =
          item.clientName.toLowerCase().includes(q) ||
          item.clientEmail.toLowerCase().includes(q) ||
          item.clientPhone.toLowerCase().includes(q) ||
          item.serviceTitle.toLowerCase().includes(q) ||
          item.orderNumber.toLowerCase().includes(q) ||
          item.clientNote.toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [unifiedItems, statusFilter, sourceFilter, searchQuery]);

  // Open modal for an item
  const openReviewModal = (
    item: UnifiedNegotiationItem,
    defaultAction: 'approve' | 'counter' | 'reject' = 'approve'
  ) => {
    const initialBudget =
      defaultAction === 'approve'
        ? item.proposedPrice ?? item.agreedPrice ?? item.adminCounterPrice ?? item.finalTotal
        : defaultAction === 'counter'
        ? item.adminCounterPrice ?? item.proposedPrice ?? item.finalTotal
        : item.originalPrice;

    setSelectedItem(item);
    setModalAction(defaultAction);
    setBudgetInput(String(initialBudget));
    setDiscountPctInput(String(item.discountPercent || 0));
    setAdminNoteInput(item.adminNote || '');
    setSmsPhoneInput(item.clientPhone || '');
    setSendSmsChecked(true);
    setSmsEditedManually(false);

    const previewMsg = buildNegotiationSmsMessage({
      phone: item.clientPhone || '',
      email: item.clientEmail,
      name: item.clientName,
      serviceTitle: item.serviceTitle,
      agreedPrice: Number(initialBudget) || 0,
      originalPrice: item.originalPrice,
      proposedPrice: item.proposedPrice ?? undefined,
      orderNumber: item.orderNumber,
      adminNote: item.adminNote || '',
      actionType:
        defaultAction === 'approve'
          ? 'approved'
          : defaultAction === 'counter'
          ? 'counter_offer'
          : 'declined',
    });
    setCustomSmsText(previewMsg);
  };

  // Keep SMS preview updated when budget / action / note changes (unless manually edited)
  useEffect(() => {
    if (!selectedItem || smsEditedManually) return;
    const numericBudget = Math.max(0, Number(budgetInput) || 0);
    const previewMsg = buildNegotiationSmsMessage({
      phone: smsPhoneInput || selectedItem.clientPhone || '',
      email: selectedItem.clientEmail,
      name: selectedItem.clientName,
      serviceTitle: selectedItem.serviceTitle,
      agreedPrice: numericBudget,
      originalPrice: selectedItem.originalPrice,
      proposedPrice: selectedItem.proposedPrice ?? undefined,
      orderNumber: selectedItem.orderNumber,
      adminNote: adminNoteInput.trim(),
      actionType:
        modalAction === 'approve'
          ? 'approved'
          : modalAction === 'counter'
          ? 'counter_offer'
          : 'declined',
    });
    setCustomSmsText(previewMsg);
  }, [selectedItem, modalAction, budgetInput, adminNoteInput, smsPhoneInput, smsEditedManually]);

  // Quick 1-click Approve Agreed Budget + SMS
  const handleQuickApproveAndSms = async (item: UnifiedNegotiationItem) => {
    const targetAgreed =
      item.proposedPrice ?? item.agreedPrice ?? item.adminCounterPrice ?? item.finalTotal;
    setQuickApprovingId(`${item.sourceCollection}:${item.id}`);

    try {
      const agreedVal = Math.max(0, Number(targetAgreed) || 0);
      const discountAmt = Math.max(0, item.originalPrice - agreedVal);
      const discountPct =
        item.originalPrice > 0 ? Math.round((discountAmt / item.originalPrice) * 100) : 0;
      const balanceDue = Math.max(0, agreedVal - item.amountPaid);

      const historyEntry = {
        actor: 'admin',
        actorName: auth.currentUser?.displayName || auth.currentUser?.email || 'Admin',
        action: 'approve_agreed_budget',
        amount: agreedVal,
        note: `Admin approved agreed budget of GH₵ ${agreedVal.toLocaleString()}`,
        timestamp: new Date().toISOString(),
      };

      let smsSentTimestamp: string | null = null;
      let smsDispatchedMsg = '';

      if (item.clientPhone && item.clientPhone.trim()) {
        const smsRes = await sendNegotiatedPriceApprovedSms({
          phone: item.clientPhone.trim(),
          email: item.clientEmail,
          name: item.clientName,
          serviceTitle: item.serviceTitle,
          agreedPrice: agreedVal,
          originalPrice: item.originalPrice,
          proposedPrice: item.proposedPrice ?? undefined,
          orderNumber: item.orderNumber,
          actionType: 'approved',
        });
        if (smsRes.success) {
          smsSentTimestamp = new Date().toISOString();
          smsDispatchedMsg = smsRes.message;
          try {
            await addDoc(collection(db, 'sms_logs'), {
              recipient: item.clientPhone.trim(),
              message: smsRes.message,
              status: smsRes.simulated ? 'sent (simulated)' : 'sent',
              type: 'Agreed Budget Approved',
              orderNumber: item.orderNumber,
              clientName: item.clientName,
              createdAt: serverTimestamp(),
            });
          } catch (_) {}
        }
      }

      if (item.sourceCollection === 'bookings') {
        const paymentStatus =
          item.amountPaid >= agreedVal && agreedVal > 0
            ? 'paid'
            : item.amountPaid > 0
            ? 'partial'
            : 'unpaid';
        const nextOrderStatus =
          item.orderStatus === 'Negotiation' || item.orderStatus === 'negotiation'
            ? 'confirmed'
            : item.orderStatus || 'confirmed';

        await updateDoc(doc(db, 'bookings', item.id), {
          status: nextOrderStatus,
          servicePrice: item.originalPrice,
          originalPrice: item.originalPrice,
          negotiatedPrice: agreedVal,
          agreedPrice: agreedVal,
          totalPrice: agreedVal,
          discountPercent: discountPct,
          discountAmount: discountAmt,
          balanceDue,
          paymentStatus,
          negotiationStatus: 'agreed',
          negotiationHistory: [...item.history.slice(-14), historyEntry],
          ...(smsSentTimestamp
            ? {
                agreedSmsSentAt: smsSentTimestamp,
                agreedSmsRecipient: item.clientPhone.trim(),
                agreedSmsMessage: smsDispatchedMsg,
              }
            : {}),
          updatedAt: serverTimestamp(),
        });
      } else {
        const paymentStatus =
          agreedVal > 0 && item.amountPaid >= agreedVal
            ? 'Fully Paid'
            : item.amountPaid > 0
            ? 'Partially Paid'
            : 'Unpaid';
        const nextOrderStatus =
          item.orderStatus === 'Negotiation' ? 'Approved' : item.orderStatus || 'Approved';

        await updateDoc(doc(db, 'service_intakes', item.id), {
          originalPrice: item.originalPrice,
          price: agreedVal,
          totalPrice: agreedVal,
          negotiatedPrice: agreedVal,
          agreedPrice: agreedVal,
          discountPercent: discountPct,
          discountAmount: discountAmt,
          status: nextOrderStatus,
          negotiationStatus: 'agreed',
          negotiationHistory: [...item.history.slice(-14), historyEntry],
          balanceDue,
          paymentStatus,
          ...(smsSentTimestamp
            ? {
                agreedSmsSentAt: smsSentTimestamp,
                agreedSmsRecipient: item.clientPhone.trim(),
                agreedSmsMessage: smsDispatchedMsg,
              }
            : {}),
          updatedAt: new Date().toISOString(),
        });
      }

      if (item.userId && item.userId !== 'anonymous') {
        await addDoc(collection(db, 'notifications'), {
          userId: item.userId,
          title: 'Agreed Budget Approved!',
          message: `Your agreed budget of GH₵ ${agreedVal.toLocaleString()} for "${item.serviceTitle}" (${item.orderNumber}) has been approved by Administration. Balance due: GH₵ ${balanceDue.toLocaleString()}.`,
          orderNumber: item.orderNumber,
          read: false,
          createdAt: serverTimestamp(),
        });
      }

      await logAuditActivity({
        action: 'APPROVED_AGREED_BUDGET',
        category: 'FINANCE',
        description: `Approved agreed budget of GH₵ ${agreedVal.toLocaleString()} for ${item.clientName} (${item.serviceTitle}) ${smsSentTimestamp ? 'and dispatched SMS notification' : ''}`,
        metadata: {
          recordId: item.id,
          collection: item.sourceCollection,
          agreedPrice: agreedVal,
          clientPhone: item.clientPhone,
          smsSent: Boolean(smsSentTimestamp),
        },
      });

      if (smsSentTimestamp) {
        toast.success(
          `Approved agreed budget of GH₵ ${agreedVal.toLocaleString()} & sent SMS to ${item.clientPhone}!`
        );
      } else if (!item.clientPhone) {
        toast.success(
          `Approved agreed budget of GH₵ ${agreedVal.toLocaleString()}! (No phone number on file for SMS)`
        );
      } else {
        toast.success(`Approved agreed budget of GH₵ ${agreedVal.toLocaleString()}!`);
      }
    } catch (error) {
      console.error('Error approving agreed budget:', error);
      toast.error('Failed to approve agreed budget.');
    } finally {
      setQuickApprovingId(null);
    }
  };

  // Full Modal Submit (Approve Agreed Budget / Counter-Offer / Reject + Custom SMS)
  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    setSubmitting(true);

    try {
      const numericBudget = Math.max(0, Number(budgetInput) || 0);
      const discountAmt = Math.max(0, selectedItem.originalPrice - numericBudget);
      const discountPct =
        selectedItem.originalPrice > 0
          ? Math.round((discountAmt / selectedItem.originalPrice) * 100)
          : 0;
      const balanceDue = Math.max(0, numericBudget - selectedItem.amountPaid);

      const historyEntry = {
        actor: 'admin',
        actorName: auth.currentUser?.displayName || auth.currentUser?.email || 'Admin',
        action:
          modalAction === 'approve'
            ? 'approve_agreed_budget'
            : modalAction === 'counter'
            ? 'counter_offer'
            : 'reject_proposal',
        amount: numericBudget,
        note:
          adminNoteInput.trim() ||
          (modalAction === 'approve'
            ? `Approved agreed budget of GH₵ ${numericBudget.toLocaleString()}`
            : modalAction === 'counter'
            ? `Admin counter-offered GH₵ ${numericBudget.toLocaleString()}`
            : `Admin declined budget proposal`),
        timestamp: new Date().toISOString(),
      };

      let smsSentTimestamp: string | null = selectedItem.agreedSmsSentAt || null;
      let smsDispatchedMsg = selectedItem.agreedSmsMessage || '';
      const targetPhone = smsPhoneInput.trim();

      if (sendSmsChecked && targetPhone) {
        const smsRes = await sendNegotiatedPriceApprovedSms({
          phone: targetPhone,
          email: selectedItem.clientEmail,
          name: selectedItem.clientName,
          serviceTitle: selectedItem.serviceTitle,
          agreedPrice: numericBudget,
          originalPrice: selectedItem.originalPrice,
          proposedPrice: selectedItem.proposedPrice ?? undefined,
          orderNumber: selectedItem.orderNumber,
          adminNote: adminNoteInput.trim(),
          actionType:
            modalAction === 'approve'
              ? 'approved'
              : modalAction === 'counter'
              ? 'counter_offer'
              : 'declined',
          customSmsMessage: customSmsText.trim(),
        });

        if (smsRes.success) {
          smsSentTimestamp = new Date().toISOString();
          smsDispatchedMsg = smsRes.message;
          try {
            await addDoc(collection(db, 'sms_logs'), {
              recipient: targetPhone,
              message: smsRes.message,
              status: smsRes.simulated ? 'sent (simulated)' : 'sent',
              type:
                modalAction === 'approve'
                  ? 'Agreed Budget Approved'
                  : modalAction === 'counter'
                  ? 'Budget Counter-Offer'
                  : 'Budget Proposal Declined',
              orderNumber: selectedItem.orderNumber,
              clientName: selectedItem.clientName,
              createdAt: serverTimestamp(),
            });
          } catch (_) {}
        } else {
          toast.warning(
            `Budget saved, but SMS dispatch reported: ${smsRes.error || 'Check SMS gateway configuration'}`
          );
        }
      }

      if (selectedItem.sourceCollection === 'bookings') {
        const nextNegStatus =
          modalAction === 'approve'
            ? 'agreed'
            : modalAction === 'counter'
            ? 'countered_by_admin'
            : 'rejected';
        const paymentStatus =
          selectedItem.amountPaid >= numericBudget && numericBudget > 0
            ? 'paid'
            : selectedItem.amountPaid > 0
            ? 'partial'
            : 'unpaid';
        const nextOrderStatus =
          modalAction === 'counter'
            ? 'Negotiation'
            : modalAction === 'approve' &&
              (selectedItem.orderStatus === 'Negotiation' ||
                selectedItem.orderStatus === 'negotiation')
            ? 'confirmed'
            : selectedItem.orderStatus || 'pending';

        await updateDoc(doc(db, 'bookings', selectedItem.id), {
          status: nextOrderStatus,
          userPhone: targetPhone || selectedItem.clientPhone,
          servicePrice: selectedItem.originalPrice,
          originalPrice: selectedItem.originalPrice,
          negotiatedPrice: numericBudget,
          agreedPrice: modalAction === 'approve' ? numericBudget : null,
          adminCounterPrice: modalAction === 'counter' ? numericBudget : selectedItem.adminCounterPrice,
          totalPrice: numericBudget,
          discountPercent: discountPct,
          discountAmount: discountAmt,
          balanceDue,
          paymentStatus,
          negotiationStatus: nextNegStatus,
          negotiationNotes: adminNoteInput.trim(),
          negotiationHistory: [...selectedItem.history.slice(-14), historyEntry],
          ...(smsSentTimestamp
            ? {
                agreedSmsSentAt: smsSentTimestamp,
                agreedSmsRecipient: targetPhone,
                agreedSmsMessage: smsDispatchedMsg,
              }
            : {}),
          updatedAt: serverTimestamp(),
        });
      } else {
        const nextNegStatus =
          modalAction === 'approve'
            ? 'agreed'
            : modalAction === 'counter'
            ? 'countered'
            : 'rejected';
        const paymentStatus =
          numericBudget > 0 && selectedItem.amountPaid >= numericBudget
            ? 'Fully Paid'
            : selectedItem.amountPaid > 0
            ? 'Partially Paid'
            : 'Unpaid';
        const nextOrderStatus =
          modalAction === 'counter'
            ? 'Negotiation'
            : modalAction === 'approve' && selectedItem.orderStatus === 'Negotiation'
            ? 'Approved'
            : selectedItem.orderStatus || 'Pending';

        await updateDoc(doc(db, 'service_intakes', selectedItem.id), {
          contact: targetPhone || selectedItem.clientPhone,
          originalPrice: selectedItem.originalPrice,
          price: numericBudget,
          totalPrice: numericBudget,
          negotiatedPrice: numericBudget,
          agreedPrice: modalAction === 'approve' ? numericBudget : null,
          adminCounterPrice: modalAction === 'counter' ? numericBudget : selectedItem.adminCounterPrice,
          discountPercent: discountPct,
          discountAmount: discountAmt,
          status: nextOrderStatus,
          negotiationStatus: nextNegStatus,
          negotiationNotes: adminNoteInput.trim(),
          negotiationHistory: [...selectedItem.history.slice(-14), historyEntry],
          balanceDue,
          paymentStatus,
          ...(smsSentTimestamp
            ? {
                agreedSmsSentAt: smsSentTimestamp,
                agreedSmsRecipient: targetPhone,
                agreedSmsMessage: smsDispatchedMsg,
              }
            : {}),
          updatedAt: new Date().toISOString(),
        });
      }

      if (selectedItem.userId && selectedItem.userId !== 'anonymous') {
        await addDoc(collection(db, 'notifications'), {
          userId: selectedItem.userId,
          title:
            modalAction === 'approve'
              ? 'Agreed Budget Approved!'
              : modalAction === 'counter'
              ? 'Admin Counter-Offer on Your Budget'
              : 'Budget Proposal Update',
          message:
            modalAction === 'approve'
              ? `Your agreed budget of GH₵ ${numericBudget.toLocaleString()} for "${selectedItem.serviceTitle}" (${selectedItem.orderNumber}) has been approved! Balance due: GH₵ ${balanceDue.toLocaleString()}.`
              : modalAction === 'counter'
              ? `Admin proposed a counter-offer of GH₵ ${numericBudget.toLocaleString()} for "${selectedItem.serviceTitle}" (${selectedItem.orderNumber}).`
              : `Admin reviewed your budget proposal for "${selectedItem.serviceTitle}". Standard rate applies: GH₵ ${numericBudget.toLocaleString()}.`,
          orderNumber: selectedItem.orderNumber,
          read: false,
          createdAt: serverTimestamp(),
        });
      }

      await logAuditActivity({
        action:
          modalAction === 'approve'
            ? 'APPROVED_AGREED_BUDGET'
            : modalAction === 'counter'
            ? 'COUNTERED_CLIENT_BUDGET'
            : 'DECLINED_CLIENT_BUDGET',
        category: 'FINANCE',
        description: `${
          modalAction === 'approve'
            ? 'Approved agreed budget'
            : modalAction === 'counter'
            ? 'Sent counter-offer'
            : 'Declined budget'
        } of GH₵ ${numericBudget.toLocaleString()} for ${selectedItem.clientName} (${selectedItem.serviceTitle})`,
        metadata: {
          recordId: selectedItem.id,
          collection: selectedItem.sourceCollection,
          amount: numericBudget,
          smsSent: Boolean(sendSmsChecked && targetPhone && smsSentTimestamp),
          recipientPhone: targetPhone,
        },
      });

      toast.success(
        modalAction === 'approve'
          ? sendSmsChecked && targetPhone
            ? `Agreed budget of GH₵ ${numericBudget.toLocaleString()} approved & SMS sent to ${targetPhone}!`
            : `Agreed budget of GH₵ ${numericBudget.toLocaleString()} approved!`
          : modalAction === 'counter'
          ? `Counter-offer of GH₵ ${numericBudget.toLocaleString()} saved${
              sendSmsChecked && targetPhone ? ' & SMS sent!' : '!'
            }`
          : 'Budget proposal status updated.'
      );

      setSelectedItem(null);
    } catch (error) {
      console.error('Error saving negotiation decision:', error);
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `${selectedItem.sourceCollection}/${selectedItem.id}`
      );
    } finally {
      setSubmitting(false);
    }
  };

  const isLoading = loadingBookings || loadingIntakes;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl bg-orange-600/10 border border-orange-500/20 text-orange-600 flex items-center justify-center">
              <Handshake className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                Negotiated Prices & Agreed Budgets
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Centralized command center to review client price proposals, approve agreed budgets, and automatically dispatch SMS confirmations.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setStatusFilter(statusFilter === 'all_orders' ? 'all_negotiations' : 'all_orders')
            }
            className="text-xs font-bold h-9 border-border"
          >
            <Sliders className="h-3.5 w-3.5 mr-1.5 text-orange-600" />
            {statusFilter === 'all_orders'
              ? 'Showing All Orders (Click for Negotiations Only)'
              : 'Include Non-Negotiated Orders'}
          </Button>
        </div>
      </div>

      {/* KPI Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border/80 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Pending Admin Review
              </p>
              <p className="text-2xl font-black text-foreground">{metrics.pendingCount}</p>
              <p className="text-[11px] text-muted-foreground">
                Client proposals awaiting approval
              </p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/80 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Approved Agreed Budgets
              </p>
              <p className="text-2xl font-black text-foreground">
                GH₵ {metrics.totalAgreedBudgetVolume.toLocaleString()}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Across {metrics.agreedCount} approved order{metrics.agreedCount === 1 ? '' : 's'}
              </p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 flex items-center justify-center">
              <CheckCircle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/80 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">
                Active Counter-Offers
              </p>
              <p className="text-2xl font-black text-foreground">{metrics.counteredCount}</p>
              <p className="text-[11px] text-muted-foreground">
                Saved savings: GH₵ {metrics.totalClientSavings.toLocaleString()}
              </p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 flex items-center justify-center">
              <Handshake className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/80 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-wider text-orange-600 dark:text-orange-400">
                Client SMS Alerts Sent
              </p>
              <p className="text-2xl font-black text-foreground">{metrics.smsSentCount}</p>
              <p className="text-[11px] text-muted-foreground">
                Instant SMS on budget approval
              </p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-600 flex items-center justify-center">
              <MessageSquare className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Search Bar */}
      <Card className="bg-card border-border/80 shadow-xs">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Segmented Status Filter */}
            <div className="flex flex-wrap items-center gap-1.5 bg-muted/50 p-1.5 rounded-xl border border-border/60">
              {[
                { id: 'all_negotiations', label: `All Negotiated (${metrics.totalNegotiations})` },
                { id: 'pending_admin', label: `Pending Approval (${metrics.pendingCount})` },
                { id: 'agreed', label: `Approved Budgets (${metrics.agreedCount})` },
                { id: 'countered_by_admin', label: `Counter-Offers (${metrics.counteredCount})` },
                { id: 'rejected', label: 'Declined' },
                { id: 'all_orders', label: `All Orders (${unifiedItems.length})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    statusFilter === tab.id
                      ? 'bg-orange-600 text-white shadow-xs'
                      : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Source Type Filter */}
            <div className="flex items-center gap-1.5 bg-muted/50 p-1.5 rounded-xl border border-border/60 self-start lg:self-auto">
              {[
                { id: 'all', label: 'All Sources' },
                { id: 'bookings', label: 'Service Bookings' },
                { id: 'service_intakes', label: 'Client Intakes' },
              ].map((src) => (
                <button
                  key={src.id}
                  type="button"
                  onClick={() => setSourceFilter(src.id as any)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    sourceFilter === src.id
                      ? 'bg-background text-foreground shadow-xs font-bold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {src.label}
                </button>
              ))}
            </div>
          </div>

          {/* Search input */}
          <div className="relative">
            <Search className="h-4 w-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by client name, phone number, email, service title, or order reference..."
              className="pl-10 h-10 bg-background border-border text-xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Main List of Negotiated Prices */}
      {isLoading ? (
        <Card className="bg-card border-border">
          <CardContent className="p-12 flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Loading negotiated prices & client budgets...
            </p>
          </CardContent>
        </Card>
      ) : filteredItems.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-12 text-center space-y-3">
            <div className="h-12 w-12 rounded-2xl bg-orange-500/10 text-orange-600 flex items-center justify-center mx-auto">
              <Handshake className="h-6 w-6" />
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <h3 className="text-base font-bold text-foreground">
                No matching negotiated price records found
              </h3>
              <p className="text-xs text-muted-foreground">
                When clients use the &ldquo;Negotiate Price&rdquo; button on a service or booking, their proposed budget will appear here for one-click approval and automatic SMS dispatch.
              </p>
            </div>
            {statusFilter !== 'all_orders' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStatusFilter('all_orders')}
                className="text-xs font-bold mt-2"
              >
                View All Service Orders ({unifiedItems.length}) to Set an Agreed Budget
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredItems.map((item) => {
            const compositeKey = `${item.sourceCollection}:${item.id}`;
            const isQuickApproving = quickApprovingId === compositeKey;
            const savings = Math.max(0, item.originalPrice - item.finalTotal);

            return (
              <Card
                key={compositeKey}
                className={`bg-card transition-all shadow-xs overflow-hidden ${
                  item.negotiationStatus === 'pending_admin'
                    ? 'border-amber-500/50 ring-1 ring-amber-500/20'
                    : item.negotiationStatus === 'agreed'
                    ? 'border-emerald-500/40'
                    : 'border-border/80'
                }`}
              >
                <CardContent className="p-5">
                  <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-5">
                    {/* Left: Client & Service Info */}
                    <div className="space-y-2.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-mono font-bold text-foreground bg-muted px-2 py-0.5 rounded">
                          {item.orderNumber}
                        </span>
                        <span className="text-muted-foreground">·</span>
                        <span className="font-semibold text-orange-600 dark:text-orange-400">
                          {item.sourceLabel}
                        </span>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-muted-foreground">{item.dateStr || 'Recent'}</span>
                        <span className="text-muted-foreground">·</span>
                        <span
                          className={`font-bold uppercase tracking-wider text-[11px] ${
                            item.negotiationStatus === 'pending_admin'
                              ? 'text-amber-600 dark:text-amber-400'
                              : item.negotiationStatus === 'agreed'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : item.negotiationStatus === 'countered_by_admin'
                              ? 'text-blue-600 dark:text-blue-400'
                              : item.negotiationStatus === 'rejected'
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {item.negotiationStatus === 'pending_admin'
                            ? '● Pending Admin Approval'
                            : item.negotiationStatus === 'agreed'
                            ? '✓ Agreed Budget Approved'
                            : item.negotiationStatus === 'countered_by_admin'
                            ? '↔ Counter-Offer Sent'
                            : item.negotiationStatus === 'rejected'
                            ? '✕ Proposal Declined'
                            : 'Standard Pricing'}
                        </span>
                      </div>

                      <div>
                        <h3 className="text-base font-black text-foreground truncate">
                          {item.serviceTitle}
                        </h3>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
                          <span className="flex items-center gap-1.5 font-semibold text-foreground">
                            <UserIcon className="h-3.5 w-3.5 text-orange-600" />
                            {item.clientName}
                          </span>
                          {item.clientPhone ? (
                            <span className="flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
                              <Phone className="h-3.5 w-3.5" />
                              {item.clientPhone}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-amber-600">
                              <AlertCircle className="h-3.5 w-3.5" />
                              No phone on file
                            </span>
                          )}
                          {item.clientEmail && (
                            <span className="flex items-center gap-1.5">
                              <Mail className="h-3.5 w-3.5" />
                              {item.clientEmail}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Client / Admin Notes & SMS Delivery Status */}
                      {(item.clientNote || item.adminNote || item.agreedSmsSentAt) && (
                        <div className="space-y-1.5 pt-1">
                          {item.clientNote && (
                            <p className="text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-lg border border-border/50">
                              <strong className="text-foreground">Client Proposal Note:</strong>{' '}
                              &ldquo;{item.clientNote}&rdquo;
                            </p>
                          )}
                          {item.adminNote && (
                            <p className="text-xs text-muted-foreground bg-orange-500/5 px-3 py-1.5 rounded-lg border border-orange-500/20">
                              <strong className="text-orange-600 dark:text-orange-400">
                                Admin Note:
                              </strong>{' '}
                              &ldquo;{item.adminNote}&rdquo;
                            </p>
                          )}
                          {item.agreedSmsSentAt && (
                            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                              <CheckCircle className="h-3.5 w-3.5" />
                              SMS Notification sent to {item.agreedSmsRecipient || item.clientPhone}{' '}
                              on {new Date(item.agreedSmsSentAt).toLocaleString()}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Center: Price Comparison Breakdown */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/30 p-3.5 rounded-xl border border-border/60 shrink-0">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Standard Rate
                        </p>
                        <p className="text-sm font-bold text-foreground mt-0.5">
                          GH₵ {item.originalPrice.toLocaleString()}
                        </p>
                      </div>

                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                          Client Proposed
                        </p>
                        <p className="text-sm font-black text-amber-600 dark:text-amber-400 mt-0.5">
                          {item.proposedPrice !== null
                            ? `GH₵ ${item.proposedPrice.toLocaleString()}`
                            : '—'}
                        </p>
                      </div>

                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                          Counter-Offer
                        </p>
                        <p className="text-sm font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                          {item.adminCounterPrice !== null
                            ? `GH₵ ${item.adminCounterPrice.toLocaleString()}`
                            : '—'}
                        </p>
                      </div>

                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                          Agreed Budget
                        </p>
                        <p className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                          {item.agreedPrice !== null
                            ? `GH₵ ${item.agreedPrice.toLocaleString()}`
                            : `GH₵ ${item.finalTotal.toLocaleString()}`}
                        </p>
                        {savings > 0 && (
                          <p className="text-[10px] text-emerald-600 font-semibold">
                            Saves GH₵ {savings.toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex flex-wrap sm:flex-nowrap xl:flex-col items-stretch justify-end gap-2 shrink-0 min-w-[210px]">
                      {item.negotiationStatus !== 'agreed' ? (
                        <Button
                          size="sm"
                          disabled={isQuickApproving}
                          onClick={() => handleQuickApproveAndSms(item)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold h-9 px-3.5 cursor-pointer"
                        >
                          {isQuickApproving ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                              Approving & Sending SMS...
                            </>
                          ) : (
                            <>
                              <Check className="h-3.5 w-3.5 mr-1.5" />
                              Approve GH₵{' '}
                              {(
                                item.proposedPrice ??
                                item.agreedPrice ??
                                item.adminCounterPrice ??
                                item.finalTotal
                              ).toLocaleString()}{' '}
                              & SMS
                            </>
                          )}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          disabled={isQuickApproving}
                          onClick={() => handleQuickApproveAndSms(item)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold h-9 px-3.5 cursor-pointer"
                        >
                          {isQuickApproving ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                              Dispatching SMS...
                            </>
                          ) : (
                            <>
                              <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                              {item.agreedSmsSentAt
                                ? 'Re-send Approval SMS'
                                : 'Send Approval SMS'}
                            </>
                          )}
                        </Button>
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openReviewModal(item, 'approve')}
                        className="border-orange-500/40 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/30 text-xs font-bold h-9 px-3.5 cursor-pointer"
                      >
                        <Send className="h-3.5 w-3.5 mr-1.5" />
                        {item.negotiationStatus === 'agreed'
                          ? 'Adjust Budget / Custom SMS'
                          : 'Custom Budget / Counter & SMS'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Review / Approve Agreed Budget & Dispatch SMS Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] animate-in fade-in">
          <div className="bg-card border border-border rounded-2xl max-w-xl w-full max-h-[92vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-orange-600/10 text-orange-600 flex items-center justify-center">
                  <Handshake className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground">
                    Approve Agreed Budget & Notify Client via SMS
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {selectedItem.clientName} · {selectedItem.serviceTitle} ({selectedItem.orderNumber})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleModalSubmit} className="p-5 space-y-5">
              {/* Price Reference Strip */}
              <div className="grid grid-cols-3 gap-3 bg-muted/40 p-3.5 rounded-xl border border-border/60 text-center">
                <div>
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">
                    Standard Price
                  </p>
                  <p className="text-sm font-bold text-foreground mt-0.5">
                    GH₵ {selectedItem.originalPrice.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-amber-600">
                    Client Proposed
                  </p>
                  <p className="text-sm font-black text-amber-600 mt-0.5">
                    {selectedItem.proposedPrice !== null
                      ? `GH₵ ${selectedItem.proposedPrice.toLocaleString()}`
                      : 'None'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-emerald-600">
                    Current Agreed
                  </p>
                  <p className="text-sm font-black text-emerald-600 mt-0.5">
                    {selectedItem.agreedPrice !== null
                      ? `GH₵ ${selectedItem.agreedPrice.toLocaleString()}`
                      : `GH₵ ${selectedItem.finalTotal.toLocaleString()}`}
                  </p>
                </div>
              </div>

              {/* Action Selector */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                  Decision Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setModalAction('approve');
                      if (selectedItem.proposedPrice !== null) {
                        setBudgetInput(String(selectedItem.proposedPrice));
                      }
                      setSmsEditedManually(false);
                    }}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      modalAction === 'approve'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-background text-foreground border-border hover:bg-muted'
                    }`}
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                    Approve Budget
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setModalAction('counter');
                      setSmsEditedManually(false);
                    }}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      modalAction === 'counter'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-background text-foreground border-border hover:bg-muted'
                    }`}
                  >
                    <Handshake className="h-3.5 w-3.5" />
                    Counter-Offer
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setModalAction('reject');
                      setBudgetInput(String(selectedItem.originalPrice));
                      setSmsEditedManually(false);
                    }}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      modalAction === 'reject'
                        ? 'bg-red-600 text-white border-red-600 shadow-xs'
                        : 'bg-background text-foreground border-border hover:bg-muted'
                    }`}
                  >
                    <X className="h-3.5 w-3.5" />
                    Decline Proposal
                  </button>
                </div>
              </div>

              {/* Agreed / Counter Budget Input + Quick Discount Helper */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase tracking-wider text-foreground">
                    {modalAction === 'approve'
                      ? 'Approved Agreed Budget (GH₵)'
                      : modalAction === 'counter'
                      ? 'Admin Counter-Offer (GH₵)'
                      : 'Enforced Standard Rate (GH₵)'}
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={budgetInput}
                    onChange={(e) => setBudgetInput(e.target.value)}
                    className="h-10 font-bold text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                    Or Apply Quick Discount (%)
                  </label>
                  <div className="flex items-center gap-1.5">
                    {[5, 10, 15, 20, 25].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => {
                          setDiscountPctInput(String(pct));
                          const discounted = Math.max(
                            0,
                            Math.round(selectedItem.originalPrice * (1 - pct / 100))
                          );
                          setBudgetInput(String(discounted));
                        }}
                        className="flex-1 py-2 rounded-lg border border-border bg-muted/40 hover:bg-orange-600 hover:text-white text-xs font-bold transition-colors cursor-pointer"
                      >
                        -{pct}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Admin Note */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                  Admin Approval / Negotiation Note (Optional)
                </label>
                <Input
                  value={adminNoteInput}
                  onChange={(e) => setAdminNoteInput(e.target.value)}
                  placeholder="e.g., Special loyalty discount approved for your upcoming project"
                  className="h-10 text-xs"
                />
              </div>

              {/* SMS Notification Section */}
              <div className="bg-orange-500/5 border border-orange-500/20 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs font-black text-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sendSmsChecked}
                      onChange={(e) => setSendSmsChecked(e.target.checked)}
                      className="h-4 w-4 rounded border-border text-orange-600 focus:ring-orange-500"
                    />
                    <MessageSquare className="h-4 w-4 text-orange-600" />
                    Send Instant SMS Notification to Client
                  </label>
                  <span className="text-[10px] font-bold text-orange-600 uppercase tracking-wider">
                    Arkesel SMS Gateway
                  </span>
                </div>

                {sendSmsChecked && (
                  <div className="space-y-3 pt-1">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Client Recipient Phone Number
                      </label>
                      <div className="relative">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                        <Input
                          value={smsPhoneInput}
                          onChange={(e) => setSmsPhoneInput(e.target.value)}
                          placeholder="e.g., 024XXXXXXX or +23324XXXXXXX"
                          className="pl-9 h-9 text-xs bg-background"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          SMS Message Preview (Editable)
                        </label>
                        {smsEditedManually && (
                          <button
                            type="button"
                            onClick={() => setSmsEditedManually(false)}
                            className="text-[10px] text-orange-600 hover:underline font-semibold"
                          >
                            Reset to Auto-Template
                          </button>
                        )}
                      </div>
                      <Textarea
                        rows={3}
                        value={customSmsText}
                        onChange={(e) => {
                          setCustomSmsText(e.target.value);
                          setSmsEditedManually(true);
                        }}
                        className="text-xs bg-background resize-none"
                      />
                      <p className="text-[10px] text-muted-foreground">
                        {customSmsText.length} characters · Client will receive this SMS immediately upon clicking approve.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Negotiation History Timeline */}
              {selectedItem.history && selectedItem.history.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-border/60">
                  <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <History className="h-3.5 w-3.5" /> Negotiation History ({selectedItem.history.length})
                  </p>
                  <div className="max-h-32 overflow-y-auto space-y-1.5 pr-1">
                    {selectedItem.history.map((h: any, idx: number) => (
                      <div
                        key={idx}
                        className="text-[11px] bg-muted/40 px-3 py-1.5 rounded-lg flex items-center justify-between gap-2"
                      >
                        <span className="text-foreground font-medium truncate">
                          <strong className="uppercase text-[10px] text-orange-600 mr-1.5">
                            {h.actor || 'Update'}:
                          </strong>
                          {h.note || `GH₵ ${Number(h.amount || 0).toLocaleString()}`}
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {h.timestamp ? new Date(h.timestamp).toLocaleDateString() : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedItem(null)}
                  className="text-xs font-bold h-10"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className={`text-white text-xs font-bold h-10 px-5 cursor-pointer ${
                    modalAction === 'approve'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : modalAction === 'counter'
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                      Processing...
                    </>
                  ) : modalAction === 'approve' ? (
                    <>
                      <CheckCircle className="h-4 w-4 mr-1.5" />
                      Approve GH₵ {(Number(budgetInput) || 0).toLocaleString()}{' '}
                      {sendSmsChecked && smsPhoneInput.trim() ? '& Send SMS' : ''}
                    </>
                  ) : modalAction === 'counter' ? (
                    <>
                      <Send className="h-4 w-4 mr-1.5" />
                      Send Counter-Offer{' '}
                      {sendSmsChecked && smsPhoneInput.trim() ? '& SMS' : ''}
                    </>
                  ) : (
                    'Save Decision'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
