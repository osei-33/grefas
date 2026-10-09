import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  collection,
  doc,
  onSnapshot,
  updateDoc,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from '@/firebase';
import { getRecordNegotiationSummary } from '@/lib/servicePricing';
import { sendNegotiatedPriceApprovedSms } from '@/lib/arkeselSms';
import { logAuditActivity } from '@/lib/auditLogger';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  Activity,
  Handshake,
  MessageSquare,
  Calendar as CalendarIcon,
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
  Search,
  Phone,
  Mail,
  User as UserIcon,
  ArrowUpRight,
  Send,
  Check,
  X,
  Loader2,
  Filter,
  RefreshCw,
} from 'lucide-react';

export type InteractionCategory =
  | 'all'
  | 'new_inquiry'
  | 'budget_proposal'
  | 'budget_update'
  | 'status_update';

export type InteractionSource = 'all' | 'bookings' | 'service_intakes' | 'messages';

export interface ClientInteractionItem {
  id: string;
  recordId: string;
  sourceCollection: 'bookings' | 'service_intakes' | 'messages';
  sourceLabel: 'Service Booking' | 'Client Intake' | 'Direct Inquiry';
  category: Exclude<InteractionCategory, 'all'>;
  categoryLabel: string;
  title: string;
  description: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  userId: string;
  serviceTitle: string;
  orderNumber: string;
  timestampIso: string;
  timestampMs: number;
  originalPrice: number;
  proposedPrice: number | null;
  adminCounterPrice: number | null;
  agreedPrice: number | null;
  finalTotal: number;
  amountPaid: number;
  negotiationStatus: 'none' | 'pending_admin' | 'countered_by_admin' | 'agreed' | 'rejected';
  orderStatus: string;
  agreedSmsSentAt?: string | null;
  agreedSmsRecipient?: string | null;
  history: any[];
  rawRecord: any;
}

function parseTimestampMs(val: any, fallbackDateStr?: string): { ms: number; iso: string } {
  if (val) {
    if (typeof val?.toDate === 'function') {
      const d = val.toDate();
      if (!isNaN(d.getTime())) return { ms: d.getTime(), iso: d.toISOString() };
    }
    if (typeof val?.seconds === 'number') {
      const d = new Date(val.seconds * 1000);
      if (!isNaN(d.getTime())) return { ms: d.getTime(), iso: d.toISOString() };
    }
    const parsed = new Date(val);
    if (!isNaN(parsed.getTime())) {
      return { ms: parsed.getTime(), iso: parsed.toISOString() };
    }
  }
  if (fallbackDateStr) {
    const parsed = new Date(fallbackDateStr);
    if (!isNaN(parsed.getTime())) {
      return { ms: parsed.getTime(), iso: parsed.toISOString() };
    }
  }
  const now = new Date();
  return { ms: now.getTime(), iso: now.toISOString() };
}

function formatRelativeTime(ms: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return new Date(ms).toLocaleDateString();
}

export default function ClientInteractionsFeed() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [intakes, setIntakes] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [categoryFilter, setCategoryFilter] = useState<InteractionCategory>('all');
  const [sourceFilter, setSourceFilter] = useState<InteractionSource>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleLimit, setVisibleLimit] = useState(8);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  useEffect(() => {
    let loadedCount = 0;
    const markLoaded = () => {
      loadedCount += 1;
      if (loadedCount >= 2) setLoading(false);
    };

    const unsubBookings = onSnapshot(
      collection(db, 'bookings'),
      (snap) => {
        setBookings(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        markLoaded();
      },
      () => markLoaded()
    );

    const unsubIntakes = onSnapshot(
      collection(db, 'service_intakes'),
      (snap) => {
        setIntakes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        markLoaded();
      },
      () => markLoaded()
    );

    const unsubMessages = onSnapshot(
      collection(db, 'messages'),
      (snap) => {
        setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      () => {}
    );

    return () => {
      unsubBookings();
      unsubIntakes();
      unsubMessages();
    };
  }, []);

  const interactions = useMemo<ClientInteractionItem[]>(() => {
    const items: ClientInteractionItem[] = [];

    // 1. Process Service Bookings
    bookings.forEach((b) => {
      const fallbackBase = Number(b.originalPrice ?? b.servicePrice ?? b.totalPrice ?? 150);
      const summary = getRecordNegotiationSummary(b, fallbackBase);
      const rawStatus = String(b.negotiationStatus || '').toLowerCase();
      let normStatus: ClientInteractionItem['negotiationStatus'] = summary.negotiationStatus;
      if (rawStatus === 'countered') normStatus = 'countered_by_admin';
      if (
        normStatus === 'none' &&
        (String(b.status || '').toLowerCase() === 'negotiation' || summary.proposedPrice !== null)
      ) {
        normStatus = 'pending_admin';
      }

      const orderNumber = b.orderNumber || `BK-${String(b.id).slice(0, 6).toUpperCase()}`;
      const clientName = b.userName || b.fullName || b.name || 'Client';
      const clientEmail = b.userEmail || b.email || '';
      const clientPhone = b.userPhone || b.phone || b.contact || b.whatsappNumber || '';
      const serviceTitle = b.serviceTitle || b.selectedProgramName || 'Service Consultation';
      const history = Array.isArray(b.negotiationHistory) ? b.negotiationHistory : [];
      const createdMeta = parseTimestampMs(b.createdAt, b.date);
      const updatedMeta = parseTimestampMs(b.updatedAt || b.agreedSmsSentAt || b.createdAt, b.date);

      const hasNegotiation =
        normStatus !== 'none' ||
        summary.proposedPrice !== null ||
        summary.agreedPrice !== null ||
        summary.adminCounterPrice !== null ||
        String(b.status || '').toLowerCase() === 'negotiation' ||
        history.length > 0;

      if (hasNegotiation) {
        if (normStatus === 'pending_admin') {
          const proposedAmt = summary.proposedPrice ?? summary.finalTotal;
          items.push({
            id: `bk-prop-${b.id}`,
            recordId: b.id,
            sourceCollection: 'bookings',
            sourceLabel: 'Service Booking',
            category: 'budget_proposal',
            categoryLabel: 'New Budget Proposal',
            title: `${clientName} proposed GH₵ ${proposedAmt.toLocaleString()} for ${serviceTitle}`,
            description:
              b.clientNegotiationNote ||
              b.negotiationNote ||
              b.notes ||
              `Client requested a negotiated budget of GH₵ ${proposedAmt.toLocaleString()} (Standard rate: GH₵ ${summary.originalPrice.toLocaleString()}).`,
            clientName,
            clientEmail,
            clientPhone,
            userId: b.userId || 'anonymous',
            serviceTitle,
            orderNumber,
            timestampIso: updatedMeta.iso,
            timestampMs: updatedMeta.ms,
            originalPrice: summary.originalPrice,
            proposedPrice: summary.proposedPrice,
            adminCounterPrice: summary.adminCounterPrice,
            agreedPrice: summary.agreedPrice,
            finalTotal: summary.finalTotal,
            amountPaid: summary.amountPaid,
            negotiationStatus: normStatus,
            orderStatus: b.status || 'Negotiation',
            agreedSmsSentAt: b.agreedSmsSentAt || null,
            agreedSmsRecipient: b.agreedSmsRecipient || null,
            history,
            rawRecord: b,
          });
        } else if (normStatus === 'agreed') {
          const agreedAmt = summary.agreedPrice ?? summary.finalTotal;
          items.push({
            id: `bk-agreed-${b.id}`,
            recordId: b.id,
            sourceCollection: 'bookings',
            sourceLabel: 'Service Booking',
            category: 'budget_update',
            categoryLabel: 'Agreed Budget Approved',
            title: `Agreed budget of GH₵ ${agreedAmt.toLocaleString()} approved for ${clientName}`,
            description: b.agreedSmsSentAt
              ? `Approved for "${serviceTitle}" (${orderNumber}). Client notified via SMS at ${b.agreedSmsRecipient || clientPhone}.`
              : `Approved for "${serviceTitle}" (${orderNumber}). Standard rate was GH₵ ${summary.originalPrice.toLocaleString()}.`,
            clientName,
            clientEmail,
            clientPhone,
            userId: b.userId || 'anonymous',
            serviceTitle,
            orderNumber,
            timestampIso: updatedMeta.iso,
            timestampMs: updatedMeta.ms,
            originalPrice: summary.originalPrice,
            proposedPrice: summary.proposedPrice,
            adminCounterPrice: summary.adminCounterPrice,
            agreedPrice: agreedAmt,
            finalTotal: summary.finalTotal,
            amountPaid: summary.amountPaid,
            negotiationStatus: 'agreed',
            orderStatus: b.status || 'confirmed',
            agreedSmsSentAt: b.agreedSmsSentAt || null,
            agreedSmsRecipient: b.agreedSmsRecipient || null,
            history,
            rawRecord: b,
          });
        } else if (normStatus === 'countered_by_admin') {
          const counterAmt = summary.adminCounterPrice ?? summary.finalTotal;
          items.push({
            id: `bk-counter-${b.id}`,
            recordId: b.id,
            sourceCollection: 'bookings',
            sourceLabel: 'Service Booking',
            category: 'budget_update',
            categoryLabel: 'Counter-Offer Sent',
            title: `Counter-offer of GH₵ ${counterAmt.toLocaleString()} sent to ${clientName}`,
            description:
              b.negotiationNotes ||
              `Admin proposed GH₵ ${counterAmt.toLocaleString()} for "${serviceTitle}" (Client proposed GH₵ ${(summary.proposedPrice ?? 0).toLocaleString()}).`,
            clientName,
            clientEmail,
            clientPhone,
            userId: b.userId || 'anonymous',
            serviceTitle,
            orderNumber,
            timestampIso: updatedMeta.iso,
            timestampMs: updatedMeta.ms,
            originalPrice: summary.originalPrice,
            proposedPrice: summary.proposedPrice,
            adminCounterPrice: counterAmt,
            agreedPrice: summary.agreedPrice,
            finalTotal: summary.finalTotal,
            amountPaid: summary.amountPaid,
            negotiationStatus: 'countered_by_admin',
            orderStatus: b.status || 'Negotiation',
            agreedSmsSentAt: b.agreedSmsSentAt || null,
            agreedSmsRecipient: b.agreedSmsRecipient || null,
            history,
            rawRecord: b,
          });
        } else if (normStatus === 'rejected') {
          items.push({
            id: `bk-reject-${b.id}`,
            recordId: b.id,
            sourceCollection: 'bookings',
            sourceLabel: 'Service Booking',
            category: 'budget_update',
            categoryLabel: 'Budget Proposal Declined',
            title: `Budget proposal for ${serviceTitle} (${clientName}) declined`,
            description:
              b.negotiationNotes ||
              `Standard service rate of GH₵ ${summary.originalPrice.toLocaleString()} maintained.`,
            clientName,
            clientEmail,
            clientPhone,
            userId: b.userId || 'anonymous',
            serviceTitle,
            orderNumber,
            timestampIso: updatedMeta.iso,
            timestampMs: updatedMeta.ms,
            originalPrice: summary.originalPrice,
            proposedPrice: summary.proposedPrice,
            adminCounterPrice: summary.adminCounterPrice,
            agreedPrice: null,
            finalTotal: summary.finalTotal,
            amountPaid: summary.amountPaid,
            negotiationStatus: 'rejected',
            orderStatus: b.status || 'pending',
            agreedSmsSentAt: b.agreedSmsSentAt || null,
            agreedSmsRecipient: b.agreedSmsRecipient || null,
            history,
            rawRecord: b,
          });
        }
      }

      // Also include the booking inquiry / status item
      const isConfirmedOrCancelled =
        String(b.status || '').toLowerCase() === 'confirmed' ||
        String(b.status || '').toLowerCase() === 'cancelled';

      items.push({
        id: `bk-inq-${b.id}`,
        recordId: b.id,
        sourceCollection: 'bookings',
        sourceLabel: 'Service Booking',
        category: isConfirmedOrCancelled ? 'status_update' : 'new_inquiry',
        categoryLabel: isConfirmedOrCancelled
          ? `Booking ${String(b.status).toUpperCase()}`
          : 'New Service Booking Inquiry',
        title: `${clientName} booked "${serviceTitle}"`,
        description: b.notes
          ? `"${b.notes}" · Scheduled for ${b.date || 'upcoming session'}`
          : `Service booking reference ${orderNumber} · Scheduled date: ${b.date || 'TBD'}.`,
        clientName,
        clientEmail,
        clientPhone,
        userId: b.userId || 'anonymous',
        serviceTitle,
        orderNumber,
        timestampIso: createdMeta.iso,
        timestampMs: createdMeta.ms,
        originalPrice: summary.originalPrice,
        proposedPrice: summary.proposedPrice,
        adminCounterPrice: summary.adminCounterPrice,
        agreedPrice: summary.agreedPrice,
        finalTotal: summary.finalTotal,
        amountPaid: summary.amountPaid,
        negotiationStatus: normStatus,
        orderStatus: b.status || 'pending',
        agreedSmsSentAt: b.agreedSmsSentAt || null,
        agreedSmsRecipient: b.agreedSmsRecipient || null,
        history,
        rawRecord: b,
      });
    });

    // 2. Process Client Service Intakes
    intakes.forEach((item) => {
      const fallbackBase = Number(item.originalPrice ?? item.totalPrice ?? item.price ?? 500);
      const summary = getRecordNegotiationSummary(item, fallbackBase);
      const rawStatus = String(item.negotiationStatus || '').toLowerCase();
      let normStatus: ClientInteractionItem['negotiationStatus'] = summary.negotiationStatus;
      if (rawStatus === 'countered') normStatus = 'countered_by_admin';
      if (
        normStatus === 'none' &&
        (String(item.status || '').toLowerCase() === 'negotiation' || summary.proposedPrice !== null)
      ) {
        normStatus = 'pending_admin';
      }

      const orderNumber = item.orderNumber || `INT-${String(item.id).slice(0, 6).toUpperCase()}`;
      const clientName = item.fullName || item.userName || 'Client';
      const clientEmail = item.emailAddress || item.userEmail || '';
      const clientPhone = item.contact || item.whatsappNumber || item.userPhone || '';
      const serviceTitle =
        item.selectedProgramName ||
        (Array.isArray(item.roles) && item.roles.length > 0 ? item.roles.join(', ') : null) ||
        item.roleType ||
        'Client Service Intake';
      const history = Array.isArray(item.negotiationHistory) ? item.negotiationHistory : [];
      const createdMeta = parseTimestampMs(item.createdAt);
      const updatedMeta = parseTimestampMs(item.updatedAt || item.agreedSmsSentAt || item.createdAt);

      const hasNegotiation =
        normStatus !== 'none' ||
        summary.proposedPrice !== null ||
        summary.agreedPrice !== null ||
        summary.adminCounterPrice !== null ||
        String(item.status || '').toLowerCase() === 'negotiation' ||
        history.length > 0;

      if (hasNegotiation) {
        if (normStatus === 'pending_admin') {
          const proposedAmt = summary.proposedPrice ?? summary.finalTotal;
          items.push({
            id: `int-prop-${item.id}`,
            recordId: item.id,
            sourceCollection: 'service_intakes',
            sourceLabel: 'Client Intake',
            category: 'budget_proposal',
            categoryLabel: 'New Budget Proposal',
            title: `${clientName} proposed GH₵ ${proposedAmt.toLocaleString()} for ${serviceTitle}`,
            description:
              item.clientNegotiationNote ||
              item.negotiationNote ||
              `Client submitted a budget proposal of GH₵ ${proposedAmt.toLocaleString()} (Standard fee: GH₵ ${summary.originalPrice.toLocaleString()}).`,
            clientName,
            clientEmail,
            clientPhone,
            userId: item.userId || 'anonymous',
            serviceTitle,
            orderNumber,
            timestampIso: updatedMeta.iso,
            timestampMs: updatedMeta.ms,
            originalPrice: summary.originalPrice,
            proposedPrice: summary.proposedPrice,
            adminCounterPrice: summary.adminCounterPrice,
            agreedPrice: summary.agreedPrice,
            finalTotal: summary.finalTotal,
            amountPaid: summary.amountPaid,
            negotiationStatus: normStatus,
            orderStatus: item.status || 'Negotiation',
            agreedSmsSentAt: item.agreedSmsSentAt || null,
            agreedSmsRecipient: item.agreedSmsRecipient || null,
            history,
            rawRecord: item,
          });
        } else if (normStatus === 'agreed') {
          const agreedAmt = summary.agreedPrice ?? summary.finalTotal;
          items.push({
            id: `int-agreed-${item.id}`,
            recordId: item.id,
            sourceCollection: 'service_intakes',
            sourceLabel: 'Client Intake',
            category: 'budget_update',
            categoryLabel: 'Agreed Budget Approved',
            title: `Agreed budget of GH₵ ${agreedAmt.toLocaleString()} approved for ${clientName}`,
            description: item.agreedSmsSentAt
              ? `Approved for "${serviceTitle}" (${orderNumber}). SMS dispatched to ${item.agreedSmsRecipient || clientPhone}.`
              : `Approved for "${serviceTitle}" (${orderNumber}). Balance due: GH₵ ${summary.balanceDue.toLocaleString()}.`,
            clientName,
            clientEmail,
            clientPhone,
            userId: item.userId || 'anonymous',
            serviceTitle,
            orderNumber,
            timestampIso: updatedMeta.iso,
            timestampMs: updatedMeta.ms,
            originalPrice: summary.originalPrice,
            proposedPrice: summary.proposedPrice,
            adminCounterPrice: summary.adminCounterPrice,
            agreedPrice: agreedAmt,
            finalTotal: summary.finalTotal,
            amountPaid: summary.amountPaid,
            negotiationStatus: 'agreed',
            orderStatus: item.status || 'Approved',
            agreedSmsSentAt: item.agreedSmsSentAt || null,
            agreedSmsRecipient: item.agreedSmsRecipient || null,
            history,
            rawRecord: item,
          });
        } else if (normStatus === 'countered_by_admin') {
          const counterAmt = summary.adminCounterPrice ?? summary.finalTotal;
          items.push({
            id: `int-counter-${item.id}`,
            recordId: item.id,
            sourceCollection: 'service_intakes',
            sourceLabel: 'Client Intake',
            category: 'budget_update',
            categoryLabel: 'Counter-Offer Sent',
            title: `Counter-offer of GH₵ ${counterAmt.toLocaleString()} sent to ${clientName}`,
            description:
              item.negotiationNotes ||
              `Admin counter-offered GH₵ ${counterAmt.toLocaleString()} on "${serviceTitle}".`,
            clientName,
            clientEmail,
            clientPhone,
            userId: item.userId || 'anonymous',
            serviceTitle,
            orderNumber,
            timestampIso: updatedMeta.iso,
            timestampMs: updatedMeta.ms,
            originalPrice: summary.originalPrice,
            proposedPrice: summary.proposedPrice,
            adminCounterPrice: counterAmt,
            agreedPrice: summary.agreedPrice,
            finalTotal: summary.finalTotal,
            amountPaid: summary.amountPaid,
            negotiationStatus: 'countered_by_admin',
            orderStatus: item.status || 'Negotiation',
            agreedSmsSentAt: item.agreedSmsSentAt || null,
            agreedSmsRecipient: item.agreedSmsRecipient || null,
            history,
            rawRecord: item,
          });
        }
      }

      const statusLower = String(item.status || 'pending').toLowerCase();
      const isReviewedStatus =
        statusLower === 'approved' || statusLower === 'in review' || statusLower === 'rejected';

      items.push({
        id: `int-inq-${item.id}`,
        recordId: item.id,
        sourceCollection: 'service_intakes',
        sourceLabel: 'Client Intake',
        category: isReviewedStatus ? 'status_update' : 'new_inquiry',
        categoryLabel: isReviewedStatus
          ? `Intake ${item.status || 'Updated'}`
          : 'New Service Intake Inquiry',
        title: `${clientName} submitted intake for "${serviceTitle}"`,
        description: `Contact: ${clientPhone || clientEmail || 'N/A'} · Payment Status: ${
          item.paymentStatus || 'Unpaid'
        } · Fee: GH₵ ${summary.finalTotal.toLocaleString()}`,
        clientName,
        clientEmail,
        clientPhone,
        userId: item.userId || 'anonymous',
        serviceTitle,
        orderNumber,
        timestampIso: createdMeta.iso,
        timestampMs: createdMeta.ms,
        originalPrice: summary.originalPrice,
        proposedPrice: summary.proposedPrice,
        adminCounterPrice: summary.adminCounterPrice,
        agreedPrice: summary.agreedPrice,
        finalTotal: summary.finalTotal,
        amountPaid: summary.amountPaid,
        negotiationStatus: normStatus,
        orderStatus: item.status || 'Pending',
        agreedSmsSentAt: item.agreedSmsSentAt || null,
        agreedSmsRecipient: item.agreedSmsRecipient || null,
        history,
        rawRecord: item,
      });
    });

    // 3. Process Direct Client Messages / Inquiries
    messages.forEach((msg) => {
      const createdMeta = parseTimestampMs(msg.createdAt);
      const clientName = msg.senderName || 'Website Visitor';
      const clientEmail = msg.senderEmail || '';
      const clientPhone = msg.senderPhone || msg.phone || '';
      const subject = msg.subject || (msg.recipientName ? `Inquiry for ${msg.recipientName}` : 'Direct Service Inquiry');

      items.push({
        id: `msg-${msg.id}`,
        recordId: msg.id,
        sourceCollection: 'messages',
        sourceLabel: 'Direct Inquiry',
        category: 'new_inquiry',
        categoryLabel: 'Direct Client Inquiry',
        title: `${clientName}: ${subject}`,
        description: String(msg.message || '').slice(0, 180),
        clientName,
        clientEmail,
        clientPhone,
        userId: msg.userId || 'anonymous',
        serviceTitle: subject,
        orderNumber: `MSG-${String(msg.id).slice(0, 5).toUpperCase()}`,
        timestampIso: createdMeta.iso,
        timestampMs: createdMeta.ms,
        originalPrice: 0,
        proposedPrice: null,
        adminCounterPrice: null,
        agreedPrice: null,
        finalTotal: 0,
        amountPaid: 0,
        negotiationStatus: 'none',
        orderStatus: 'New',
        history: [],
        rawRecord: msg,
      });
    });

    // Sort: Pending budget proposals at very top if recent, otherwise chronological descending
    return items.sort((a, b) => b.timestampMs - a.timestampMs);
  }, [bookings, intakes, messages]);

  const counts = useMemo(() => {
    return {
      all: interactions.length,
      new_inquiry: interactions.filter((i) => i.category === 'new_inquiry').length,
      budget_proposal: interactions.filter((i) => i.category === 'budget_proposal').length,
      budget_update: interactions.filter((i) => i.category === 'budget_update').length,
      status_update: interactions.filter((i) => i.category === 'status_update').length,
    };
  }, [interactions]);

  const filteredInteractions = useMemo(() => {
    return interactions.filter((item) => {
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
      if (sourceFilter !== 'all' && item.sourceCollection !== sourceFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matches =
          item.clientName.toLowerCase().includes(q) ||
          item.clientPhone.toLowerCase().includes(q) ||
          item.clientEmail.toLowerCase().includes(q) ||
          item.serviceTitle.toLowerCase().includes(q) ||
          item.orderNumber.toLowerCase().includes(q) ||
          item.title.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [interactions, categoryFilter, sourceFilter, searchQuery]);

  const handleQuickApproveAndSms = async (item: ClientInteractionItem) => {
    if (item.sourceCollection === 'messages') return;
    const agreedVal = Math.max(
      0,
      Number(item.proposedPrice ?? item.agreedPrice ?? item.adminCounterPrice ?? item.finalTotal) || 0
    );
    setActionLoadingId(item.id);

    try {
      const discountAmt = Math.max(0, item.originalPrice - agreedVal);
      const discountPct =
        item.originalPrice > 0 ? Math.round((discountAmt / item.originalPrice) * 100) : 0;
      const balanceDue = Math.max(0, agreedVal - item.amountPaid);

      const historyEntry = {
        actor: 'admin',
        actorName: auth.currentUser?.displayName || auth.currentUser?.email || 'Admin',
        action: 'approve_agreed_budget',
        amount: agreedVal,
        note: `Admin approved agreed budget of GH₵ ${agreedVal.toLocaleString()} from Dashboard Feed`,
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
        await updateDoc(doc(db, 'bookings', item.recordId), {
          status:
            item.orderStatus === 'Negotiation' || item.orderStatus === 'negotiation'
              ? 'confirmed'
              : item.orderStatus || 'confirmed',
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
        await updateDoc(doc(db, 'service_intakes', item.recordId), {
          originalPrice: item.originalPrice,
          price: agreedVal,
          totalPrice: agreedVal,
          negotiatedPrice: agreedVal,
          agreedPrice: agreedVal,
          discountPercent: discountPct,
          discountAmount: discountAmt,
          status: item.orderStatus === 'Negotiation' ? 'Approved' : item.orderStatus || 'Approved',
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
          message: `Your agreed budget of GH₵ ${agreedVal.toLocaleString()} for "${item.serviceTitle}" (${item.orderNumber}) has been approved by Administration!`,
          orderNumber: item.orderNumber,
          read: false,
          createdAt: serverTimestamp(),
        });
      }

      await logAuditActivity({
        action: 'APPROVED_AGREED_BUDGET',
        category: 'FINANCE',
        description: `Approved agreed budget of GH₵ ${agreedVal.toLocaleString()} for ${item.clientName} (${item.serviceTitle}) from Dashboard Interaction Feed`,
        metadata: {
          recordId: item.recordId,
          collection: item.sourceCollection,
          agreedPrice: agreedVal,
          smsSent: Boolean(smsSentTimestamp),
        },
      });

      toast.success(
        smsSentTimestamp
          ? `Approved GH₵ ${agreedVal.toLocaleString()} & SMS dispatched to ${item.clientPhone}!`
          : `Approved agreed budget of GH₵ ${agreedVal.toLocaleString()}!`
      );
    } catch (err) {
      console.error('Error approving budget from feed:', err);
      toast.error('Failed to approve budget proposal.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const displayedItems = filteredInteractions.slice(0, visibleLimit);

  return (
    <Card className="bg-card border-border/80 shadow-xs overflow-hidden">
      <CardHeader className="pb-3 border-b border-border/50">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-orange-600/10 border border-orange-500/20 text-orange-600 flex items-center justify-center shrink-0">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-base sm:text-lg font-black text-foreground">
                  Recent Client Interactions & Budget Proposal Feed
                </CardTitle>
                <span className="text-[11px] font-bold text-orange-600 dark:text-orange-400">
                  · Live Stream
                </span>
              </div>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Real-time filtered feed tracking new service inquiries, client price negotiations, agreed budget approvals, and SMS alerts.
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start lg:self-auto">
            <Link
              to="/admin/negotiations"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-xs"
            >
              <Handshake className="h-3.5 w-3.5" />
              <span>Open Negotiated Prices Page</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* Interactive Filter Controls */}
        <div className="pt-3 space-y-3">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2.5">
            {/* Category Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1 bg-muted/50 p-1 rounded-xl border border-border/60">
              {[
                { id: 'all', label: `All Activity (${counts.all})` },
                { id: 'new_inquiry', label: `New Service Inquiries (${counts.new_inquiry})` },
                {
                  id: 'budget_proposal',
                  label: `Pending Budget Proposals (${counts.budget_proposal})`,
                },
                {
                  id: 'budget_update',
                  label: `Budget Status Updates (${counts.budget_update})`,
                },
                { id: 'status_update', label: `Order Updates (${counts.status_update})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setCategoryFilter(tab.id as InteractionCategory);
                    setVisibleLimit(8);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    categoryFilter === tab.id
                      ? 'bg-orange-600 text-white shadow-xs'
                      : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Source Filter + Search */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-xl border border-border/60">
                {[
                  { id: 'all', label: 'All Sources' },
                  { id: 'bookings', label: 'Bookings' },
                  { id: 'service_intakes', label: 'Intakes' },
                  { id: 'messages', label: 'Inquiries' },
                ].map((src) => (
                  <button
                    key={src.id}
                    type="button"
                    onClick={() => setSourceFilter(src.id as InteractionSource)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                      sourceFilter === src.id
                        ? 'bg-background text-foreground shadow-xs font-bold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {src.label}
                  </button>
                ))}
              </div>

              <div className="relative min-w-[220px]">
                <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter by client, service, ref..."
                  className="pl-8 pr-7 h-8 text-xs bg-background"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {loading ? (
          <div className="p-10 flex items-center justify-center gap-2.5">
            <Loader2 className="h-5 w-5 animate-spin text-orange-600" />
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Loading client interactions...
            </span>
          </div>
        ) : displayedItems.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <p className="text-sm font-bold text-foreground">
              No client interactions match the selected filter
            </p>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Try switching the filter tab above or clearing your search query to view all service inquiries and budget proposal updates.
            </p>
            {categoryFilter !== 'all' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCategoryFilter('all')}
                className="text-xs font-bold mt-2"
              >
                Show All Interactions ({counts.all})
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {displayedItems.map((item) => {
              const isApproving = actionLoadingId === item.id;
              const isBudgetProposal = item.category === 'budget_proposal';
              const isBudgetUpdate = item.category === 'budget_update';

              return (
                <div
                  key={item.id}
                  className={`p-4 sm:px-5 hover:bg-muted/25 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                    isBudgetProposal ? 'bg-amber-500/[0.03]' : ''
                  }`}
                >
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    {/* Icon indicator */}
                    <div
                      className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 border ${
                        isBudgetProposal
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-600'
                          : isBudgetUpdate && item.negotiationStatus === 'agreed'
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600'
                          : isBudgetUpdate
                          ? 'bg-blue-500/10 border-blue-500/30 text-blue-600'
                          : item.sourceCollection === 'bookings'
                          ? 'bg-orange-500/10 border-orange-500/20 text-orange-600'
                          : 'bg-muted border-border text-foreground'
                      }`}
                    >
                      {isBudgetProposal || isBudgetUpdate ? (
                        <Handshake className="h-4 w-4" />
                      ) : item.sourceCollection === 'bookings' ? (
                        <CalendarIcon className="h-4 w-4" />
                      ) : item.sourceCollection === 'service_intakes' ? (
                        <FileText className="h-4 w-4" />
                      ) : (
                        <MessageSquare className="h-4 w-4" />
                      )}
                    </div>

                    {/* Text Details */}
                    <div className="space-y-1 min-w-0 flex-1">
                      {/* Clean unboxed metadata row */}
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                        <span
                          className={`font-bold uppercase tracking-wider ${
                            isBudgetProposal
                              ? 'text-amber-600 dark:text-amber-400'
                              : isBudgetUpdate && item.negotiationStatus === 'agreed'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : isBudgetUpdate
                              ? 'text-blue-600 dark:text-blue-400'
                              : 'text-orange-600 dark:text-orange-400'
                          }`}
                        >
                          {item.categoryLabel}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono font-semibold text-foreground">
                          {item.orderNumber}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{item.sourceLabel}</span>
                        <span aria-hidden="true">·</span>
                        <span>{formatRelativeTime(item.timestampMs)}</span>
                      </div>

                      <h4 className="text-sm font-bold text-foreground truncate">{item.title}</h4>

                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {item.description}
                      </p>

                      {/* Client contact & pricing line */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5 text-[11px] text-muted-foreground">
                        <span className="font-semibold text-foreground">{item.clientName}</span>
                        {item.clientPhone && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                              {item.clientPhone}
                            </span>
                          </>
                        )}
                        {item.originalPrice > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>
                              Standard: <strong>GH₵ {item.originalPrice.toLocaleString()}</strong>
                            </span>
                          </>
                        )}
                        {item.proposedPrice !== null && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-amber-600 dark:text-amber-400 font-bold">
                              Proposed: GH₵ {item.proposedPrice.toLocaleString()}
                            </span>
                          </>
                        )}
                        {item.agreedPrice !== null && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                              Agreed: GH₵ {item.agreedPrice.toLocaleString()}
                            </span>
                          </>
                        )}
                        {item.agreedSmsSentAt && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                              ✓ SMS Sent
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Controls */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0 self-end lg:self-center">
                    {item.sourceCollection !== 'messages' &&
                      item.negotiationStatus === 'pending_admin' && (
                        <Button
                          size="sm"
                          disabled={isApproving}
                          onClick={() => handleQuickApproveAndSms(item)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold h-8 px-3 cursor-pointer"
                        >
                          {isApproving ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                              Approving...
                            </>
                          ) : (
                            <>
                              <Check className="h-3.5 w-3.5 mr-1" />
                              Approve GH₵{' '}
                              {(item.proposedPrice ?? item.finalTotal).toLocaleString()} & SMS
                            </>
                          )}
                        </Button>
                      )}

                    {item.sourceCollection !== 'messages' && (
                      <Link
                        to={
                          isBudgetProposal || isBudgetUpdate || item.negotiationStatus !== 'none'
                            ? '/admin/negotiations'
                            : item.sourceCollection === 'bookings'
                            ? '/admin/bookings'
                            : '/admin/intakes'
                        }
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-xs font-bold text-foreground transition-colors"
                      >
                        <span>
                          {isBudgetProposal || isBudgetUpdate || item.negotiationStatus !== 'none'
                            ? 'Review Budget'
                            : 'View Record'}
                        </span>
                        <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {filteredInteractions.length > visibleLimit && (
          <div className="p-3 border-t border-border/60 bg-muted/20 text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setVisibleLimit((prev) => prev + 10)}
              className="text-xs font-bold text-orange-600 hover:text-orange-700"
            >
              Show More Client Interactions ({filteredInteractions.length - visibleLimit} remaining)
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
