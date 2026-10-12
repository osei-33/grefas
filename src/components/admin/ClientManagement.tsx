import React, { useState, useEffect, useMemo } from 'react';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Users,
  Search,
  Calendar,
  CreditCard,
  MessageSquare,
  Handshake,
  FileText,
  Phone,
  Mail,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowUpRight,
  Star,
  Bell,
  Plus,
  Filter,
  UserCheck,
  Wallet,
  Activity,
  ChevronRight,
  Send,
  ShieldCheck,
  Sparkles,
  Receipt,
  Building2,
  RefreshCw,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

interface ClientProfile {
  id: string;
  uid: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  createdAt: any;
  isRegistered: boolean;
  photoURL?: string;
}

interface UnifiedInteraction {
  id: string;
  type: 'inquiry' | 'negotiation' | 'booking' | 'payment' | 'chat' | 'review' | 'notification' | 'note';
  title: string;
  subtitle: string;
  description: string;
  amount?: number;
  status?: string;
  reference?: string;
  timestamp: Date;
  raw?: any;
}

function parseFirestoreDate(val: any): Date {
  if (!val) return new Date(0);
  if (val instanceof Date) return val;
  if (typeof val?.toDate === 'function') return val.toDate();
  if (typeof val?.seconds === 'number') return new Date(val.seconds * 1000);
  const parsed = new Date(val);
  return isNaN(parsed.getTime()) ? new Date(0) : parsed;
}

function normalizeStr(val?: string | null): string {
  return (val || '').trim().toLowerCase();
}

function normalizePhone(val?: string | null): string {
  const digits = (val || '').replace(/\D/g, '');
  if (digits.length >= 9) {
    return digits.slice(-9);
  }
  return digits;
}

export default function ClientManagement({ initialSelectedUserId }: { initialSelectedUserId?: string | null }) {
  const [users, setUsers] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [intakes, setIntakes] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Selection & Filters
  const [selectedClientId, setSelectedClientId] = useState<string | null>(initialSelectedUserId || null);
  const [clientSearch, setClientSearch] = useState('');
  const [clientFilter, setClientFilter] = useState<'all' | 'registered' | 'with_bookings' | 'with_payments' | 'negotiating'>('all');
  const [activeTab, setActiveTab] = useState<'timeline' | 'bookings' | 'payments' | 'communications'>('timeline');
  const [timelineFilter, setTimelineFilter] = useState<'all' | 'inquiry' | 'negotiation' | 'booking' | 'payment' | 'chat' | 'note'>('all');

  // Log Interaction / Note Modal or Inline State
  const [isLoggingNote, setIsLoggingNote] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteChannel, setNoteChannel] = useState<'Phone Call' | 'WhatsApp' | 'In-Person Meeting' | 'Email Follow-up' | 'Admin Note'>('Phone Call');
  const [noteContent, setNoteContent] = useState('');
  const [SendToClientPortal, setSendToClientPortal] = useState(true);
  const [submittingNote, setSubmittingNote] = useState(false);

  useEffect(() => {
    if (initialSelectedUserId) {
      setSelectedClientId(initialSelectedUserId);
    }
  }, [initialSelectedUserId]);

  useEffect(() => {
    const unsubs: (() => void)[] = [];

    unsubs.push(
      onSnapshot(
        collection(db, 'users'),
        (snap) => {
          setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
          setLoading(false);
        },
        (err) => {
          handleFirestoreError(err, OperationType.LIST, 'users');
          setLoading(false);
        }
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'bookings'), orderBy('createdAt', 'desc')),
        (snap) => setBookings(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        () => {}
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'service_intakes'), orderBy('createdAt', 'desc')),
        (snap) => setIntakes(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        () => {}
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'transactions'),
        (snap) => setTransactions(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        () => {}
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'messages'), orderBy('createdAt', 'desc')),
        (snap) => setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        () => {}
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'reviews'),
        (snap) => setReviews(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        () => {}
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'notifications'),
        (snap) => setNotifications(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        () => {}
      )
    );

    return () => unsubs.forEach((u) => u());
  }, []);

  // Build unified list of registered clients + discovered guest profiles
  const clientProfiles = useMemo<ClientProfile[]>(() => {
    const map = new Map<string, ClientProfile>();
    const emailToKey = new Map<string, string>();
    const phoneToKey = new Map<string, string>();

    // 1. Add all registered users from `users` collection first
    users.forEach((u) => {
      const uid = u.uid || u.id;
      const email = normalizeStr(u.email);
      const phone = u.phone || u.phoneNumber || u.contact || '';
      const normPhone = normalizePhone(phone);
      const profile: ClientProfile = {
        id: uid,
        uid,
        name: u.displayName || u.fullName || u.name || (u.email ? u.email.split('@')[0] : 'Registered Client'),
        email: u.email || '',
        phone,
        role: u.role || 'client',
        createdAt: u.createdAt,
        isRegistered: true,
        photoURL: u.photoURL,
      };
      map.set(uid, profile);
      if (email) emailToKey.set(email, uid);
      if (normPhone) phoneToKey.set(normPhone, uid);
    });

    // 2. Enrich registered users with phone numbers from bookings/intakes or add unlinked guest clients
    bookings.forEach((b) => {
      const bUid = b.userId && b.userId !== 'anonymous' ? b.userId : '';
      const bEmail = normalizeStr(b.userEmail);
      const bPhone = b.userPhone || '';
      const normPhone = normalizePhone(bPhone);

      let matchedKey = (bUid && map.has(bUid) ? bUid : '') || (bEmail && emailToKey.get(bEmail)) || (normPhone && phoneToKey.get(normPhone)) || '';

      if (matchedKey && map.has(matchedKey)) {
        const existing = map.get(matchedKey)!;
        if (!existing.phone && bPhone) existing.phone = bPhone;
        if ((!existing.name || existing.name === 'Registered Client') && b.userName) existing.name = b.userName;
      } else if (bEmail || normPhone || b.userName) {
        const guestKey = bUid || (bEmail ? `guest:${bEmail}` : normPhone ? `guest:${normPhone}` : `guest:${b.id}`);
        if (!map.has(guestKey)) {
          map.set(guestKey, {
            id: guestKey,
            uid: bUid || guestKey,
            name: b.userName || (bEmail ? bEmail.split('@')[0] : 'Client'),
            email: b.userEmail || '',
            phone: bPhone,
            role: 'client',
            createdAt: b.createdAt,
            isRegistered: Boolean(bUid),
          });
          if (bEmail) emailToKey.set(bEmail, guestKey);
          if (normPhone) phoneToKey.set(normPhone, guestKey);
        }
      }
    });

    intakes.forEach((intake) => {
      const iUid = intake.userId && intake.userId !== 'anonymous' ? intake.userId : '';
      const iEmail = normalizeStr(intake.emailAddress || intake.email);
      const iPhone = intake.contact || intake.whatsappNumber || intake.phone || intake.userPhone || '';
      const normPhone = normalizePhone(iPhone);

      let matchedKey = (iUid && map.has(iUid) ? iUid : '') || (iEmail && emailToKey.get(iEmail)) || (normPhone && phoneToKey.get(normPhone)) || '';

      if (matchedKey && map.has(matchedKey)) {
        const existing = map.get(matchedKey)!;
        if (!existing.phone && iPhone) existing.phone = iPhone;
        if ((!existing.name || existing.name === 'Registered Client') && (intake.fullName || intake.name)) {
          existing.name = intake.fullName || intake.name;
        }
      } else if (iEmail || normPhone || intake.fullName) {
        const guestKey = iUid || (iEmail ? `guest:${iEmail}` : normPhone ? `guest:${normPhone}` : `guest:${intake.id}`);
        if (!map.has(guestKey)) {
          map.set(guestKey, {
            id: guestKey,
            uid: iUid || guestKey,
            name: intake.fullName || intake.name || (iEmail ? iEmail.split('@')[0] : 'Client'),
            email: intake.emailAddress || intake.email || '',
            phone: iPhone,
            role: 'client',
            createdAt: intake.createdAt,
            isRegistered: Boolean(iUid),
          });
          if (iEmail) emailToKey.set(iEmail, guestKey);
          if (normPhone) phoneToKey.set(normPhone, guestKey);
        }
      }
    });

    return Array.from(map.values());
  }, [users, bookings, intakes]);

  // Helper to check if a record belongs to a specific ClientProfile
  const matchesClient = (client: ClientProfile, record: {
    userId?: string;
    email?: string;
    phone?: string;
    name?: string;
  }) => {
    if (record.userId && record.userId !== 'anonymous' && (record.userId === client.uid || record.userId === client.id)) {
      return true;
    }
    const cEmail = normalizeStr(client.email);
    const rEmail = normalizeStr(record.email);
    if (cEmail && rEmail && cEmail === rEmail) {
      return true;
    }
    const cPhone = normalizePhone(client.phone);
    const rPhone = normalizePhone(record.phone);
    if (cPhone && rPhone && cPhone.length >= 9 && cPhone === rPhone) {
      return true;
    }
    const cName = normalizeStr(client.name);
    const rName = normalizeStr(record.name);
    if (cName && rName && cName.length > 3 && cName === rName && !cEmail && !rEmail) {
      return true;
    }
    return false;
  };

  // Precompute stats per client so the directory list is informative and sortable
  const clientsWithStats = useMemo(() => {
    return clientProfiles.map((client) => {
      const cBookings = bookings.filter((b) =>
        matchesClient(client, {
          userId: b.userId,
          email: b.userEmail,
          phone: b.userPhone,
          name: b.userName,
        })
      );

      const cIntakes = intakes.filter((i) =>
        matchesClient(client, {
          userId: i.userId,
          email: i.emailAddress || i.email,
          phone: i.contact || i.whatsappNumber || i.phone || i.userPhone,
          name: i.fullName || i.name,
        })
      );

      const cBookingIds = new Set(cBookings.map((b) => b.id));
      const cBookingOrders = new Set(cBookings.map((b) => b.orderNumber).filter(Boolean));
      const cEmail = normalizeStr(client.email);
      const cName = normalizeStr(client.name);

      const cTransactions = transactions.filter((t) => {
        if (t.type && t.type !== 'credit') return false;
        if (t.bookingId && cBookingIds.has(t.bookingId)) return true;
        if (t.bookingOrderNumber && cBookingOrders.has(t.bookingOrderNumber)) return true;
        if (cEmail && normalizeStr(t.recordedBy) === cEmail) return true;
        if (cEmail && normalizeStr(t.customerEmail || t.email) === cEmail) return true;
        if (cName && cName.length > 3 && normalizeStr(t.description).includes(cName)) return true;
        return false;
      });

      const cMessages = messages.filter((m) =>
        matchesClient(client, {
          userId: m.uid || m.userId || m.recipientId,
          email: m.email || m.userEmail,
          name: m.name || m.userName,
        })
      );

      const cReviews = reviews.filter((r) =>
        matchesClient(client, {
          userId: r.userId,
          name: r.userName,
        })
      );

      const cNotifications = notifications.filter(
        (n) => n.userId === client.uid || n.userId === client.id || (cEmail && normalizeStr(n.email) === cEmail)
      );

      // Compute total paid avoiding double-counting
      const countedRefs = new Set<string>();
      let totalPaid = 0;
      let paymentCount = 0;

      cTransactions.forEach((t) => {
        const amt = Number(t.amount || 0);
        if (amt > 0) {
          totalPaid += amt;
          paymentCount += 1;
          if (t.ref) countedRefs.add(String(t.ref));
          if (t.bookingId) countedRefs.add(`booking:${t.bookingId}`);
        }
      });

      cBookings.forEach((b) => {
        const isPaid = b.paymentStatus === 'paid' || Boolean(b.paymentReference);
        const refKey = b.paymentReference ? String(b.paymentReference) : '';
        if (isPaid && !countedRefs.has(`booking:${b.id}`) && (!refKey || !countedRefs.has(refKey))) {
          const amt = Number(b.totalPayable || b.agreedPrice || b.negotiatedPrice || b.price || 0);
          if (amt > 0) {
            totalPaid += amt;
            paymentCount += 1;
            if (refKey) countedRefs.add(refKey);
          }
        }
      });

      cIntakes.forEach((i) => {
        const refKey = i.paymentRef ? String(i.paymentRef) : '';
        const paidAmt = Number(i.amountPaid || 0);
        if (paidAmt > 0 && (!refKey || !countedRefs.has(refKey))) {
          totalPaid += paidAmt;
          paymentCount += 1;
          if (refKey) countedRefs.add(refKey);
        }
      });

      let outstandingBalance = 0;
      cIntakes.forEach((i) => {
        const bal = Number(i.balanceDue || 0);
        if (bal > 0) outstandingBalance += bal;
      });
      cBookings.forEach((b) => {
        if (b.paymentStatus !== 'paid' && b.status !== 'cancelled') {
          const price = Number(b.agreedPrice || b.negotiatedPrice || b.price || 0);
          if (price > 0) outstandingBalance += price;
        }
      });

      const hasNegotiation =
        cBookings.some((b) => b.isNegotiated || b.proposedPrice || b.negotiationStatus) ||
        cIntakes.some((i) => i.isNegotiated || i.proposedPrice || i.negotiationStatus);

      const totalInteractions =
        cBookings.length +
        cIntakes.length +
        cTransactions.length +
        cMessages.length +
        cReviews.length +
        cNotifications.length;

      return {
        client,
        bookings: cBookings,
        intakes: cIntakes,
        transactions: cTransactions,
        messages: cMessages,
        reviews: cReviews,
        notifications: cNotifications,
        totalPaid,
        paymentCount,
        outstandingBalance,
        hasNegotiation,
        totalInteractions,
      };
    }).sort((a, b) => {
      // Prioritize clients with interactions, then registered status, then name
      if (b.totalInteractions !== a.totalInteractions) {
        return b.totalInteractions - a.totalInteractions;
      }
      if (a.client.isRegistered !== b.client.isRegistered) {
        return a.client.isRegistered ? -1 : 1;
      }
      return a.client.name.localeCompare(b.client.name);
    });
  }, [clientProfiles, bookings, intakes, transactions, messages, reviews, notifications]);

  const filteredClients = useMemo(() => {
    return clientsWithStats.filter((item) => {
      if (clientFilter === 'registered' && !item.client.isRegistered) return false;
      if (clientFilter === 'with_bookings' && item.bookings.length === 0 && item.intakes.length === 0) return false;
      if (clientFilter === 'with_payments' && item.totalPaid <= 0) return false;
      if (clientFilter === 'negotiating' && !item.hasNegotiation) return false;

      if (!clientSearch.trim()) return true;
      const q = clientSearch.toLowerCase();
      return (
        item.client.name.toLowerCase().includes(q) ||
        item.client.email.toLowerCase().includes(q) ||
        item.client.phone.toLowerCase().includes(q) ||
        item.client.role.toLowerCase().includes(q)
      );
    });
  }, [clientsWithStats, clientFilter, clientSearch]);

  // Automatically select first client if none selected
  useEffect(() => {
    if (!selectedClientId && filteredClients.length > 0) {
      setSelectedClientId(filteredClients[0].client.id);
    }
  }, [filteredClients, selectedClientId]);

  const selectedClientBundle = useMemo(() => {
    return (
      clientsWithStats.find((c) => c.client.id === selectedClientId || c.client.uid === selectedClientId) ||
      filteredClients[0] ||
      null
    );
  }, [clientsWithStats, filteredClients, selectedClientId]);

  // Build unified chronological interaction history & payment ledger for selected client
  const { unifiedInteractions, unifiedPayments } = useMemo(() => {
    if (!selectedClientBundle) {
      return { unifiedInteractions: [] as UnifiedInteraction[], unifiedPayments: [] as any[] };
    }

    const interactions: UnifiedInteraction[] = [];
    const payments: any[] = [];
    const seenPaymentRefs = new Set<string>();

    // 1. Bookings
    selectedClientBundle.bookings.forEach((b) => {
      const createdDate = parseFirestoreDate(b.createdAt || b.date);
      const price = Number(b.agreedPrice ?? b.negotiatedPrice ?? b.price ?? 0);
      interactions.push({
        id: `booking-${b.id}`,
        type: 'booking',
        title: `Service Booking: ${b.serviceTitle || 'Consultation'}`,
        subtitle: `Order #${b.orderNumber || b.id.slice(0, 8)} • Scheduled ${b.date || 'TBD'} ${b.time || ''}`,
        description: b.notes || `Booked with ${b.teamMemberName || 'Grefas Specialist'}. Status: ${b.status || 'pending'}.`,
        amount: price,
        status: b.status || 'pending',
        reference: b.orderNumber,
        timestamp: createdDate,
        raw: b,
      });

      // If this booking had price negotiation
      if (b.isNegotiated || b.proposedPrice || b.negotiationStatus) {
        interactions.push({
          id: `booking-neg-${b.id}`,
          type: 'negotiation',
          title: `Budget Proposal on ${b.serviceTitle || 'Booking'}`,
          subtitle: `Proposed GH₵ ${Number(b.proposedPrice || price).toLocaleString()} • Status: ${(b.negotiationStatus || 'pending').toUpperCase()}`,
          description: b.negotiationNote || `Original: GH₵ ${Number(b.originalPrice || b.price || 0).toLocaleString()} → Agreed: GH₵ ${Number(b.agreedPrice || b.negotiatedPrice || b.proposedPrice || 0).toLocaleString()}`,
          amount: Number(b.agreedPrice || b.negotiatedPrice || b.proposedPrice || 0),
          status: b.negotiationStatus || 'pending',
          reference: b.orderNumber,
          timestamp: parseFirestoreDate(b.agreedAt || b.updatedAt || b.createdAt),
          raw: b,
        });
      }

      // If paid on booking
      if (b.paymentStatus === 'paid' || b.paymentReference) {
        const ref = b.paymentReference || `BK-${b.orderNumber || b.id.slice(0, 6)}`;
        seenPaymentRefs.add(ref);
        payments.push({
          id: `pay-booking-${b.id}`,
          reference: ref,
          description: `Booking Payment: ${b.serviceTitle || 'Consultation'} (#${b.orderNumber || b.id.slice(0, 6)})`,
          amount: Number(b.totalPayable || b.agreedPrice || b.negotiatedPrice || b.price || 0),
          gateway: b.paymentChannel || 'Paystack / Online',
          status: 'Paid',
          date: parseFirestoreDate(b.paidAt || b.createdAt),
          source: 'Booking',
        });
      }
    });

    // 2. Service Intakes & Inquiries
    selectedClientBundle.intakes.forEach((i) => {
      const createdDate = parseFirestoreDate(i.createdAt || i.submittedAt);
      const progName = i.selectedProgramName || i.serviceTitle || i.roleType || 'Service Inquiry';
      const effPrice = Number(i.agreedPrice ?? i.totalPrice ?? i.price ?? i.originalPrice ?? 0);

      interactions.push({
        id: `intake-${i.id}`,
        type: 'inquiry',
        title: `Service Inquiry / Intake: ${progName}`,
        subtitle: `Category: ${i.category || i.formType || 'Consultation'} • Status: ${i.status || 'Pending'}`,
        description: i.projectVision || i.specificGoals || i.bio || `Submitted service intake form for ${progName}.`,
        amount: effPrice,
        status: i.status || 'Pending',
        reference: i.orderNumber || i.paymentRef,
        timestamp: createdDate,
        raw: i,
      });

      if (i.isNegotiated || i.proposedPrice || i.negotiationStatus || Array.isArray(i.negotiationHistory)) {
        interactions.push({
          id: `intake-neg-${i.id}`,
          type: 'negotiation',
          title: `Budget Negotiation: ${progName}`,
          subtitle: `Status: ${(i.negotiationStatus || 'pending_admin').toUpperCase()} • Agreed: GH₵ ${effPrice.toLocaleString()}`,
          description:
            i.negotiationNotes ||
            `Client proposed GH₵ ${Number(i.proposedPrice || effPrice).toLocaleString()} (Standard GH₵ ${Number(i.originalPrice || effPrice).toLocaleString()}).`,
          amount: effPrice,
          status: i.negotiationStatus || 'pending',
          reference: i.orderNumber,
          timestamp: parseFirestoreDate(i.updatedAt || i.createdAt),
          raw: i,
        });
      }

      if (Number(i.amountPaid || 0) > 0 || i.paymentRef) {
        const ref = i.paymentRef || `INT-${i.id.slice(0, 8).toUpperCase()}`;
        if (!seenPaymentRefs.has(ref)) {
          seenPaymentRefs.add(ref);
          payments.push({
            id: `pay-intake-${i.id}`,
            reference: ref,
            description: `Service Intake Payment: ${progName}`,
            amount: Number(i.amountPaid || i.totalPayable || effPrice || 0),
            gateway: i.paymentChannel || i.paymentMethod || 'Paystack',
            status: i.paymentStatus || 'Paid',
            date: parseFirestoreDate(i.updatedAt || i.createdAt),
            source: 'Service Intake',
          });
        }
      }

      // Also check individual paid installments
      if (Array.isArray(i.paymentPlan?.installments)) {
        i.paymentPlan.installments.forEach((inst: any, idx: number) => {
          if (inst.status === 'Paid') {
            const instRef = inst.momoRef || inst.reference || `INST-${i.id.slice(0, 5)}-${idx + 1}`;
            if (!seenPaymentRefs.has(instRef)) {
              seenPaymentRefs.add(instRef);
              payments.push({
                id: `pay-inst-${i.id}-${idx}`,
                reference: instRef,
                description: `${inst.name || `Installment #${idx + 1}`} — ${progName}`,
                amount: Number(inst.amount || 0),
                gateway: inst.paymentMethod || 'Paystack / MoMo',
                status: 'Paid',
                date: parseFirestoreDate(inst.paidAt || i.updatedAt || i.createdAt),
                source: 'Installment Plan',
              });
            }
          }
        });
      }
    });

    // 3. Transactions
    selectedClientBundle.transactions.forEach((t) => {
      const txDate = parseFirestoreDate(t.createdAt || t.transactionDate);
      const ref = t.ref || `TX-${t.id.slice(0, 8).toUpperCase()}`;
      const amt = Number(t.amount || 0);

      interactions.push({
        id: `tx-${t.id}`,
        type: 'payment',
        title: `Payment Recorded: GH₵ ${amt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        subtitle: `Ref: ${ref} • ${t.gateway || t.category || 'Paystack'}`,
        description: t.description || 'Verified client payment transaction.',
        amount: amt,
        status: t.status || 'successful',
        reference: ref,
        timestamp: txDate,
        raw: t,
      });

      if (!seenPaymentRefs.has(ref)) {
        seenPaymentRefs.add(ref);
        payments.push({
          id: `pay-tx-${t.id}`,
          reference: ref,
          description: t.description || t.category || 'Client Payment',
          amount: amt,
          gateway: t.gateway || t.channel || 'Paystack',
          status: t.status === 'failed' ? 'Failed' : 'Paid',
          date: txDate,
          source: 'Transactions Ledger',
        });
      }
    });

    // 4. Live Chat Messages
    selectedClientBundle.messages.forEach((m) => {
      interactions.push({
        id: `msg-${m.id}`,
        type: 'chat',
        title: m.isAdmin ? `Admin Reply to ${selectedClientBundle.client.name}` : `Chat Message from ${selectedClientBundle.client.name}`,
        subtitle: m.isAdmin ? 'Outbound Support Message' : 'Inbound Client Inquiry',
        description: m.text || '',
        status: m.isAdmin ? 'replied' : 'received',
        timestamp: parseFirestoreDate(m.createdAt),
        raw: m,
      });
    });

    // 5. Service Reviews
    selectedClientBundle.reviews.forEach((r) => {
      interactions.push({
        id: `rev-${r.id}`,
        type: 'review',
        title: `Left a ${r.rating || 5}★ Review on ${r.serviceTitle || 'Service'}`,
        subtitle: `Rating: ${r.rating || 5}/5 Stars`,
        description: r.comment || '',
        status: 'published',
        timestamp: parseFirestoreDate(r.createdAt),
        raw: r,
      });
    });

    // 6. Notifications & Logged Admin Interactions
    selectedClientBundle.notifications.forEach((n) => {
      const isNote = Boolean(n.isInteractionNote || n.channel);
      interactions.push({
        id: `notif-${n.id}`,
        type: isNote ? 'note' : 'notification',
        title: n.title || 'Client Notification',
        subtitle: n.channel ? `Logged via ${n.channel} by ${n.loggedBy || 'Admin'}` : n.read ? 'Read by Client' : 'Sent to Client Portal',
        description: n.message || '',
        status: n.read ? 'read' : 'sent',
        timestamp: parseFirestoreDate(n.createdAt),
        raw: n,
      });
    });

    interactions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    payments.sort((a, b) => b.date.getTime() - a.date.getTime());

    return { unifiedInteractions: interactions, unifiedPayments: payments };
  }, [selectedClientBundle]);

  const filteredTimeline = useMemo(() => {
    if (timelineFilter === 'all') return unifiedInteractions;
    if (timelineFilter === 'chat') {
      return unifiedInteractions.filter((i) => i.type === 'chat' || i.type === 'review' || i.type === 'notification');
    }
    return unifiedInteractions.filter((i) => i.type === timelineFilter);
  }, [unifiedInteractions, timelineFilter]);

  const handleLogClientInteraction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientBundle || !noteContent.trim()) {
      toast.error('Please enter interaction details.');
      return;
    }
    setSubmittingNote(true);
    try {
      const client = selectedClientBundle.client;
      await addDoc(collection(db, 'notifications'), {
        userId: client.uid || client.id,
        email: client.email || '',
        clientName: client.name,
        title: noteTitle.trim() || `${noteChannel} Follow-up`,
        message: noteContent.trim(),
        channel: noteChannel,
        isInteractionNote: true,
        loggedBy: auth.currentUser?.displayName || auth.currentUser?.email || 'Administrator',
        read: !SendToClientPortal,
        createdAt: serverTimestamp(),
      });

      toast.success(`Interaction logged for ${client.name}`);
      setNoteTitle('');
      setNoteContent('');
      setIsLoggingNote(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'notifications');
    } finally {
      setSubmittingNote(false);
    }
  };

  const handleQuickUpdateBookingStatus = async (bookingId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'bookings', bookingId), {
        status: newStatus,
        updatedAt: new Date().toISOString(),
      });
      toast.success(`Booking status updated to ${newStatus}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `bookings/${bookingId}`);
    }
  };

  const getInteractionBadge = (type: UnifiedInteraction['type']) => {
    switch (type) {
      case 'booking':
        return { label: 'Booking', cls: 'bg-blue-500/10 text-blue-600 border-blue-500/20', icon: Calendar };
      case 'inquiry':
        return { label: 'Service Inquiry', cls: 'bg-purple-500/10 text-purple-600 border-purple-500/20', icon: FileText };
      case 'negotiation':
        return { label: 'Budget Proposal', cls: 'bg-amber-500/10 text-amber-600 border-amber-500/20', icon: Handshake };
      case 'payment':
        return { label: 'Payment', cls: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20', icon: CreditCard };
      case 'chat':
        return { label: 'Live Chat', cls: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20', icon: MessageSquare };
      case 'review':
        return { label: 'Review', cls: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20', icon: Star };
      case 'note':
        return { label: 'Admin Log', cls: 'bg-orange-500/10 text-orange-600 border-orange-500/20', icon: ShieldCheck };
      default:
        return { label: 'Notification', cls: 'bg-muted text-muted-foreground border-border', icon: Bell };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest bg-orange-500/10 text-orange-600 border border-orange-500/20">
              <UserCheck className="h-3 w-3" /> Client Relationship CRM
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mt-1">
            Client Management & 360° Activity History
          </h1>
          <p className="text-sm text-muted-foreground">
            Inspect every interaction, service booking, budget negotiation, and Paystack/MoMo payment for any registered client.
          </p>
        </div>

        {selectedClientBundle && (
          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              onClick={() => setIsLoggingNote((prev) => !prev)}
              className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold cursor-pointer"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Log Interaction / Follow-up
            </Button>
          </div>
        )}
      </div>

      {/* Main Split View: Client Directory (Left) + Selected Client 360 View (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Registered Clients Directory */}
        <Card className="lg:col-span-4 bg-card border-border overflow-hidden">
          <CardHeader className="p-4 border-b border-border space-y-3 bg-muted/20">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                <Users className="h-4 w-4 text-orange-600" />
                Client Directory ({filteredClients.length})
              </CardTitle>
              <span className="text-[10px] font-mono text-muted-foreground">
                {users.length} Registered
              </span>
            </div>

            <div className="relative">
              <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Search name, email, phone..."
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                className="pl-9 h-9 text-xs bg-background border-border"
              />
            </div>

            <div className="flex flex-wrap gap-1">
              {[
                { id: 'all', label: 'All Clients' },
                { id: 'registered', label: 'Registered' },
                { id: 'with_bookings', label: 'Booked' },
                { id: 'with_payments', label: 'Paid' },
                { id: 'negotiating', label: 'Negotiating' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setClientFilter(tab.id as any)}
                  className={`px-2 py-1 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                    clientFilter === tab.id
                      ? 'bg-orange-600 text-white'
                      : 'bg-muted/60 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </CardHeader>

          <CardContent className="p-0 max-h-[700px] overflow-y-auto divide-y divide-border">
            {loading ? (
              <div className="p-8 text-center text-xs text-muted-foreground">Loading client profiles...</div>
            ) : filteredClients.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <Users className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                <p className="text-xs font-semibold text-foreground">No matching clients found</p>
                <p className="text-[11px] text-muted-foreground">Try clearing your search or switching the filter tab above.</p>
              </div>
            ) : (
              filteredClients.map((item) => {
                const isSelected = selectedClientBundle?.client.id === item.client.id;
                const totalBookingsAndIntakes = item.bookings.length + item.intakes.length;
                return (
                  <button
                    key={item.client.id}
                    type="button"
                    onClick={() => setSelectedClientId(item.client.id)}
                    className={`w-full text-left p-3.5 transition-all flex items-start justify-between gap-3 cursor-pointer ${
                      isSelected
                        ? 'bg-orange-500/10 border-l-4 border-l-orange-600'
                        : 'hover:bg-muted/40'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-full bg-orange-600/15 text-orange-600 font-bold text-xs flex items-center justify-center shrink-0 uppercase border border-orange-500/20">
                        {item.client.name.slice(0, 2)}
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-xs font-bold text-foreground truncate">{item.client.name}</p>
                          {item.client.isRegistered ? (
                            <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                              Registered
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-muted text-muted-foreground">
                              Guest Record
                            </span>
                          )}
                        </div>
                        {item.client.email && (
                          <p className="text-[11px] text-muted-foreground truncate">{item.client.email}</p>
                        )}
                        {item.client.phone && (
                          <p className="text-[10px] font-mono text-muted-foreground">{item.client.phone}</p>
                        )}
                        <div className="flex items-center gap-2 pt-1 flex-wrap">
                          <span className="text-[10px] font-semibold text-muted-foreground">
                            {totalBookingsAndIntakes} {totalBookingsAndIntakes === 1 ? 'booking' : 'bookings'}
                          </span>
                          <span className="text-muted-foreground/40">•</span>
                          <span className="text-[10px] font-bold text-emerald-600">
                            GH₵ {item.totalPaid.toLocaleString()}
                          </span>
                          {item.hasNegotiation && (
                            <>
                              <span className="text-muted-foreground/40">•</span>
                              <span className="text-[9px] font-bold text-amber-600">Negotiated</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className={`h-4 w-4 shrink-0 mt-1 transition-transform ${isSelected ? 'text-orange-600 translate-x-0.5' : 'text-muted-foreground/40'}`} />
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Right Column: Selected Client 360° Details */}
        <div className="lg:col-span-8 space-y-6">
          {!selectedClientBundle ? (
            <Card className="bg-card border-border p-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <h3 className="text-base font-bold text-foreground">Select a Client Profile</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Choose any registered client from the directory on the left to inspect their complete history of interactions, bookings, and payments.
              </p>
            </Card>
          ) : (
            <>
              {/* Client Profile Header Card */}
              <Card className="bg-card border-border overflow-hidden">
                <CardContent className="p-5 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border">
                    <div className="flex items-start gap-4">
                      <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-orange-600 to-amber-500 text-white font-black text-lg flex items-center justify-center shrink-0 uppercase shadow-md">
                        {selectedClientBundle.client.name.slice(0, 2)}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-xl font-bold text-foreground">
                            {selectedClientBundle.client.name}
                          </h2>
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                            {selectedClientBundle.client.isRegistered ? `Registered (${selectedClientBundle.client.role})` : 'Client Record'}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          {selectedClientBundle.client.email && (
                            <span className="flex items-center gap-1.5">
                              <Mail className="h-3.5 w-3.5 text-orange-600" />
                              {selectedClientBundle.client.email}
                            </span>
                          )}
                          {selectedClientBundle.client.phone && (
                            <span className="flex items-center gap-1.5 font-mono">
                              <Phone className="h-3.5 w-3.5 text-orange-600" />
                              {selectedClientBundle.client.phone}
                            </span>
                          )}
                          {selectedClientBundle.client.createdAt && (
                            <span className="flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                              Joined {format(parseFirestoreDate(selectedClientBundle.client.createdAt), 'MMM d, yyyy')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {selectedClientBundle.client.phone && (
                        <a
                          href={`tel:${selectedClientBundle.client.phone}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-muted/40 hover:bg-muted text-xs font-bold text-foreground"
                        >
                          <Phone className="h-3.5 w-3.5 text-emerald-600" /> Call
                        </a>
                      )}
                      {selectedClientBundle.client.email && (
                        <a
                          href={`mailto:${selectedClientBundle.client.email}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-muted/40 hover:bg-muted text-xs font-bold text-foreground"
                        >
                          <Mail className="h-3.5 w-3.5 text-blue-600" /> Email
                        </a>
                      )}
                    </div>
                  </div>

                  {/* 4 Financial & Engagement KPIs */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-5">
                    <div className="p-3.5 rounded-xl bg-muted/30 border border-border">
                      <div className="flex items-center justify-between text-muted-foreground mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider">Interactions</span>
                        <Activity className="h-4 w-4 text-orange-600" />
                      </div>
                      <p className="text-xl font-black text-foreground">{unifiedInteractions.length}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {selectedClientBundle.messages.length} chats • {selectedClientBundle.reviews.length} reviews
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-muted/30 border border-border">
                      <div className="flex items-center justify-between text-muted-foreground mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider">Bookings & Intakes</span>
                        <Calendar className="h-4 w-4 text-blue-600" />
                      </div>
                      <p className="text-xl font-black text-foreground">
                        {selectedClientBundle.bookings.length + selectedClientBundle.intakes.length}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {selectedClientBundle.bookings.length} appts • {selectedClientBundle.intakes.length} service intakes
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                      <div className="flex items-center justify-between text-emerald-600 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider">Total Paid</span>
                        <Wallet className="h-4 w-4" />
                      </div>
                      <p className="text-xl font-black text-emerald-600">
                        GH₵ {selectedClientBundle.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Across {unifiedPayments.length} verified payment(s)
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20">
                      <div className="flex items-center justify-between text-amber-600 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider">Balance Due</span>
                        <Receipt className="h-4 w-4" />
                      </div>
                      <p className="text-xl font-black text-amber-600">
                        GH₵ {selectedClientBundle.outstandingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {selectedClientBundle.hasNegotiation ? 'Has negotiated budget' : 'Standard pricing'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Inline Form to Log New Client Interaction */}
              {isLoggingNote && (
                <Card className="bg-orange-500/5 border-orange-500/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-orange-600" />
                      Log Interaction with {selectedClientBundle.client.name}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Record a call, WhatsApp chat, meeting summary, or send a direct notification to this client's portal.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleLogClientInteraction} className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Input
                          placeholder="Subject / Interaction Title (e.g. Budget Follow-up Call)"
                          value={noteTitle}
                          onChange={(e) => setNoteTitle(e.target.value)}
                          className="bg-background border-border text-xs h-9"
                        />
                        <select
                          value={noteChannel}
                          onChange={(e) => setNoteChannel(e.target.value as any)}
                          className="h-9 rounded-md border border-border bg-background px-3 text-xs font-semibold text-foreground"
                        >
                          <option value="Phone Call">Phone Call</option>
                          <option value="WhatsApp">WhatsApp</option>
                          <option value="In-Person Meeting">In-Person Meeting</option>
                          <option value="Email Follow-up">Email Follow-up</option>
                          <option value="Admin Note">Internal Admin Note</option>
                        </select>
                      </div>
                      <Textarea
                        placeholder="Write summary of the conversation, agreed terms, or message for the client..."
                        value={noteContent}
                        onChange={(e) => setNoteContent(e.target.value)}
                        rows={3}
                        required
                        className="bg-background border-border text-xs"
                      />
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                          <input
                            type="checkbox"
                            checked={SendToClientPortal}
                            onChange={(e) => setSendToClientPortal(e.target.checked)}
                            className="rounded border-border text-orange-600"
                          />
                          Also deliver as an in-app notification to the client's portal
                        </label>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsLoggingNote(false)}
                            className="text-xs cursor-pointer"
                          >
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            size="sm"
                            disabled={submittingNote}
                            className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold cursor-pointer"
                          >
                            <Send className="h-3.5 w-3.5 mr-1.5" />
                            {submittingNote ? 'Saving...' : 'Save Interaction'}
                          </Button>
                        </div>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}

              {/* Navigation Tabs for Client History */}
              <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
                {[
                  { id: 'timeline', label: `All Interactions (${unifiedInteractions.length})`, icon: Activity },
                  {
                    id: 'bookings',
                    label: `Bookings & Inquiries (${selectedClientBundle.bookings.length + selectedClientBundle.intakes.length})`,
                    icon: Calendar,
                  },
                  { id: 'payments', label: `Payments Made (${unifiedPayments.length})`, icon: CreditCard },
                  {
                    id: 'communications',
                    label: `Chats & Reviews (${selectedClientBundle.messages.length + selectedClientBundle.reviews.length})`,
                    icon: MessageSquare,
                  },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        active
                          ? 'bg-orange-600 text-white shadow-xs'
                          : 'bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* TAB 1: UNIFIED INTERACTIONS TIMELINE */}
              {activeTab === 'timeline' && (
                <Card className="bg-card border-border">
                  <CardHeader className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-sm font-bold text-foreground">
                        Chronological Interaction History
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Every service inquiry, budget proposal, booking, payment, and message for {selectedClientBundle.client.name}.
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {[
                        { id: 'all', label: 'All' },
                        { id: 'booking', label: 'Bookings' },
                        { id: 'inquiry', label: 'Inquiries' },
                        { id: 'negotiation', label: 'Negotiations' },
                        { id: 'payment', label: 'Payments' },
                        { id: 'chat', label: 'Chats/Reviews' },
                        { id: 'note', label: 'Admin Logs' },
                      ].map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setTimelineFilter(f.id as any)}
                          className={`px-2.5 py-1 rounded text-[10px] font-bold cursor-pointer ${
                            timelineFilter === f.id
                              ? 'bg-orange-600 text-white'
                              : 'bg-muted text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 divide-y divide-border">
                    {filteredTimeline.length === 0 ? (
                      <div className="p-10 text-center text-xs text-muted-foreground">
                        No interactions recorded under this filter for {selectedClientBundle.client.name}.
                      </div>
                    ) : (
                      filteredTimeline.map((item) => {
                        const badge = getInteractionBadge(item.type);
                        const BadgeIcon = badge.icon;
                        return (
                          <div key={item.id} className="p-4 hover:bg-muted/20 transition-colors flex items-start gap-3.5">
                            <div className={`p-2 rounded-lg border shrink-0 mt-0.5 ${badge.cls}`}>
                              <BadgeIcon className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${badge.cls}`}>
                                    {badge.label}
                                  </span>
                                  <p className="text-xs font-bold text-foreground">{item.title}</p>
                                </div>
                                <span className="text-[11px] font-mono text-muted-foreground">
                                  {item.timestamp.getTime() > 0
                                    ? format(item.timestamp, 'MMM d, yyyy • h:mm a')
                                    : 'Recorded'}
                                </span>
                              </div>
                              <p className="text-[11px] font-semibold text-muted-foreground">{item.subtitle}</p>
                              {item.description && (
                                <p className="text-xs text-foreground/90 leading-relaxed bg-muted/30 p-2.5 rounded-lg border border-border/60">
                                  {item.description}
                                </p>
                              )}
                              <div className="flex flex-wrap items-center gap-3 pt-1">
                                {item.amount !== undefined && item.amount > 0 && (
                                  <span className="text-[11px] font-extrabold text-emerald-600">
                                    Amount: GH₵ {item.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </span>
                                )}
                                {item.reference && (
                                  <span className="text-[10px] font-mono bg-muted px-2 py-0.5 rounded text-muted-foreground">
                                    Ref: {item.reference}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </CardContent>
                </Card>
              )}

              {/* TAB 2: BOOKINGS & SERVICE INTAKES */}
              {activeTab === 'bookings' && (
                <div className="space-y-6">
                  {/* Appointments / Bookings */}
                  <Card className="bg-card border-border">
                    <CardHeader className="p-4 border-b border-border flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="text-sm font-bold text-foreground">
                          Direct Service Bookings ({selectedClientBundle.bookings.length})
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Scheduled appointments and consultations booked by {selectedClientBundle.client.name}.
                        </CardDescription>
                      </div>
                      <Link to="/admin/bookings">
                        <Button variant="outline" size="sm" className="h-8 text-xs font-bold cursor-pointer">
                          Open All Bookings <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
                        </Button>
                      </Link>
                    </CardHeader>
                    <CardContent className="p-0 divide-y divide-border">
                      {selectedClientBundle.bookings.length === 0 ? (
                        <div className="p-8 text-center text-xs text-muted-foreground">
                          No direct appointment bookings found for this client.
                        </div>
                      ) : (
                        selectedClientBundle.bookings.map((b) => {
                          const price = Number(b.agreedPrice ?? b.negotiatedPrice ?? b.price ?? 0);
                          return (
                            <div key={b.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/20">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono text-[11px] font-bold text-orange-600 bg-orange-500/10 px-2 py-0.5 rounded">
                                    #{b.orderNumber || b.id.slice(0, 8)}
                                  </span>
                                  <p className="text-sm font-bold text-foreground">{b.serviceTitle || 'Consultation'}</p>
                                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                                    b.status === 'confirmed' || b.status === 'completed'
                                      ? 'bg-emerald-500/10 text-emerald-600'
                                      : b.status === 'cancelled'
                                      ? 'bg-red-500/10 text-red-600'
                                      : 'bg-amber-500/10 text-amber-600'
                                  }`}>
                                    {b.status || 'pending'}
                                  </span>
                                  {b.paymentStatus === 'paid' && (
                                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-600">
                                      PAID
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  Date: <span className="font-semibold text-foreground">{b.date || 'TBD'}</span> at{' '}
                                  <span className="font-semibold text-foreground">{b.time || 'TBD'}</span> • Specialist:{' '}
                                  {b.teamMemberName || 'Any Available'}
                                </p>
                                {b.notes && <p className="text-xs text-muted-foreground italic">"{b.notes}"</p>}
                              </div>

                              <div className="flex flex-wrap items-center gap-2 shrink-0">
                                <div className="text-right mr-2">
                                  <p className="text-xs font-black text-foreground">GH₵ {price.toLocaleString()}</p>
                                  {b.isNegotiated && (
                                    <p className="text-[10px] text-amber-600 font-bold">
                                      Negotiated ({b.negotiationStatus || 'pending'})
                                    </p>
                                  )}
                                </div>
                                <select
                                  value={b.status || 'pending'}
                                  onChange={(e) => handleQuickUpdateBookingStatus(b.id, e.target.value)}
                                  className="h-8 rounded-md border border-border bg-background px-2.5 text-xs font-bold text-foreground cursor-pointer"
                                >
                                  <option value="pending">Pending</option>
                                  <option value="confirmed">Confirmed</option>
                                  <option value="completed">Completed</option>
                                  <option value="cancelled">Cancelled</option>
                                </select>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </CardContent>
                  </Card>

                  {/* Service Intakes / Skit & Production Forms */}
                  <Card className="bg-card border-border">
                    <CardHeader className="p-4 border-b border-border flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="text-sm font-bold text-foreground">
                          Service Intakes & Project Requests ({selectedClientBundle.intakes.length})
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Consultation forms, Movie/Skit registrations, and custom project proposals.
                        </CardDescription>
                      </div>
                      <Link to="/admin/service-requests">
                        <Button variant="outline" size="sm" className="h-8 text-xs font-bold cursor-pointer">
                          Manage Service Requests <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
                        </Button>
                      </Link>
                    </CardHeader>
                    <CardContent className="p-0 divide-y divide-border">
                      {selectedClientBundle.intakes.length === 0 ? (
                        <div className="p-8 text-center text-xs text-muted-foreground">
                          No service intake submissions found for this client.
                        </div>
                      ) : (
                        selectedClientBundle.intakes.map((i) => {
                          const effPrice = Number(i.agreedPrice ?? i.totalPrice ?? i.price ?? i.originalPrice ?? 0);
                          const paid = Number(i.amountPaid || 0);
                          const bal = Math.max(0, effPrice - paid);
                          return (
                            <div key={i.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/20">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm font-bold text-foreground">
                                    {i.selectedProgramName || i.serviceTitle || i.roleType || 'Service Request'}
                                  </p>
                                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-muted text-muted-foreground">
                                    {i.category || i.formType || 'Intake'}
                                  </span>
                                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-blue-500/10 text-blue-600">
                                    {i.status || 'Pending'}
                                  </span>
                                  {i.paymentStatus && (
                                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                                      i.paymentStatus === 'Fully Paid' || i.paymentStatus === 'Paid'
                                        ? 'bg-emerald-500/10 text-emerald-600'
                                        : 'bg-amber-500/10 text-amber-600'
                                    }`}>
                                      {i.paymentStatus}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  Submitted {format(parseFirestoreDate(i.createdAt || i.submittedAt), 'MMM d, yyyy')}
                                  {i.paymentRef ? ` • Paystack Ref: ${i.paymentRef}` : ''}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs font-black text-foreground">Fee: GH₵ {effPrice.toLocaleString()}</p>
                                <p className="text-[11px] text-emerald-600 font-bold">Paid: GH₵ {paid.toLocaleString()}</p>
                                {bal > 0 && (
                                  <p className="text-[10px] text-amber-600 font-bold">Balance: GH₵ {bal.toLocaleString()}</p>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* TAB 3: PAYMENTS & FINANCIAL LEDGER */}
              {activeTab === 'payments' && (
                <Card className="bg-card border-border">
                  <CardHeader className="p-4 border-b border-border flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-bold text-foreground">
                        Verified Client Payments ({unifiedPayments.length})
                      </CardTitle>
                      <CardDescription className="text-xs">
                        All Paystack checkouts, Mobile Money transfers, booking fees, and installment payments made by {selectedClientBundle.client.name}.
                      </CardDescription>
                    </div>
                    <Link to="/admin/transactions">
                      <Button variant="outline" size="sm" className="h-8 text-xs font-bold cursor-pointer">
                        Full Ledger <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
                      </Button>
                    </Link>
                  </CardHeader>
                  <CardContent className="p-0 divide-y divide-border">
                    {unifiedPayments.length === 0 ? (
                      <div className="p-10 text-center text-xs text-muted-foreground">
                        No payments recorded yet for {selectedClientBundle.client.name}.
                      </div>
                    ) : (
                      unifiedPayments.map((p) => (
                        <div key={p.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/20">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-[11px] font-bold bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded border border-emerald-500/20">
                                {p.reference}
                              </span>
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-muted text-muted-foreground">
                                {p.gateway}
                              </span>
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-blue-500/10 text-blue-600">
                                {p.source}
                              </span>
                            </div>
                            <p className="text-xs font-bold text-foreground">{p.description}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {p.date.getTime() > 0 ? format(p.date, 'MMM d, yyyy • h:mm a') : 'Verified Payment'}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-black text-emerald-600">
                              + GH₵ {Number(p.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                            <span className="text-[10px] font-black uppercase text-emerald-600">
                              {p.status}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              )}

              {/* TAB 4: COMMUNICATIONS, LIVE CHAT & REVIEWS */}
              {activeTab === 'communications' && (
                <div className="space-y-6">
                  <Card className="bg-card border-border">
                    <CardHeader className="p-4 border-b border-border flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="text-sm font-bold text-foreground">
                          Live Chat & Support Messages ({selectedClientBundle.messages.length})
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Direct chat history with {selectedClientBundle.client.name}.
                        </CardDescription>
                      </div>
                      <Link to="/admin/messages">
                        <Button variant="outline" size="sm" className="h-8 text-xs font-bold cursor-pointer">
                          Open Live Chat <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
                        </Button>
                      </Link>
                    </CardHeader>
                    <CardContent className="p-0 divide-y divide-border">
                      {selectedClientBundle.messages.length === 0 ? (
                        <div className="p-8 text-center text-xs text-muted-foreground">
                          No live chat messages with this client yet.
                        </div>
                      ) : (
                        selectedClientBundle.messages.map((m) => (
                          <div key={m.id} className="p-4 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                                m.isAdmin ? 'bg-orange-500/10 text-orange-600' : 'bg-blue-500/10 text-blue-600'
                              }`}>
                                {m.isAdmin ? 'Admin Response' : selectedClientBundle.client.name}
                              </span>
                              <span className="text-[10px] font-mono text-muted-foreground">
                                {format(parseFirestoreDate(m.createdAt), 'MMM d, yyyy h:mm a')}
                              </span>
                            </div>
                            <p className="text-xs text-foreground pt-1">{m.text}</p>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border">
                    <CardHeader className="p-4 border-b border-border">
                      <CardTitle className="text-sm font-bold text-foreground">
                        Service Reviews Left by Client ({selectedClientBundle.reviews.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 divide-y divide-border">
                      {selectedClientBundle.reviews.length === 0 ? (
                        <div className="p-8 text-center text-xs text-muted-foreground">
                          No service reviews submitted by this client yet.
                        </div>
                      ) : (
                        selectedClientBundle.reviews.map((r) => (
                          <div key={r.id} className="p-4 space-y-1">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-bold text-foreground">{r.serviceTitle || 'Service Review'}</p>
                              <span className="text-xs font-black text-amber-500">{'★'.repeat(Number(r.rating || 5))}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">"{r.comment}"</p>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
