import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import {
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '@/firebase';
import {
  PhotographyPackage,
  PhotographySampleMedia,
  mergePhotographyPackagesWithDefaults,
  getPhotographyPackagePricing,
  getTierDisplayName,
  parseVideoEmbedUrl,
} from '@/lib/photographyPackages';
import { useTransactionFee } from '@/lib/transactionFees';
import { sendArkeselSms } from '@/lib/arkeselSms';
import { logAuditActivity } from '@/lib/auditLogger';
import PaystackPayment from '@/components/PaystackPayment';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Camera,
  Video,
  Image as ImageIcon,
  Check,
  Handshake,
  Tag,
  Play,
  X,
  ChevronLeft,
  ChevronRight,
  Calendar,
  MapPin,
  Lock,
  ShieldCheck,
  CheckCircle2,
  Loader2,
  ArrowRight,
  Film,
  Send,
  LayoutGrid,
  Table2,
  Minus,
  Receipt,
} from 'lucide-react';

interface ConfirmationReceipt {
  orderNumber: string;
  packageTitle: string;
  packageTier: string;
  includedImages: number;
  includedVideos: number;
  shootDate: string;
  shootTime: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  basePrice: number;
  discountAmount: number;
  discountLabel?: string;
  negotiatedDelta: number;
  processingFee: number;
  amountPaid: number;
  totalWithFee: number;
  paymentReference: string;
  paymentChannel: string;
  isNegotiationProposalOnly: boolean;
  proposedPrice?: number;
}

export default function PhotographyPackagesSection() {
  const [rawPackages, setRawPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [packageViewMode, setPackageViewMode] = useState<'all' | 'cards' | 'table'>('all');

  // Sample gallery filter & lightbox
  const [mediaFilter, setMediaFilter] = useState<'all' | 'image' | 'video'>('all');
  const [lightboxState, setLightboxState] = useState<{
    items: (PhotographySampleMedia & { packageTitle?: string })[];
    index: number;
  } | null>(null);

  // Selected package checkout modal state
  const [selectedPkg, setSelectedPkg] = useState<PhotographyPackage | null>(null);
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [shootDate, setShootDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split('T')[0];
  });
  const [shootTime, setShootTime] = useState('10:00 AM');
  const [shootLocation, setShootLocation] = useState('');
  const [shootNotes, setShootNotes] = useState('');

  // Negotiation state inside checkout modal
  const [pricingMode, setPricingMode] = useState<'standard' | 'negotiate'>('standard');
  const [proposedPriceInput, setProposedPriceInput] = useState('');
  const [negotiationNoteInput, setNegotiationNoteInput] = useState('');
  const [negotiationAction, setNegotiationAction] = useState<'pay_now' | 'submit_offer'>('pay_now');

  // Paystack modal & submission state
  const [showPaystackModal, setShowPaystackModal] = useState(false);
  const [isSubmittingOffer, setIsSubmittingOffer] = useState(false);
  const [receipt, setReceipt] = useState<ConfirmationReceipt | null>(null);

  const { calculateCharge } = useTransactionFee();

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'photography_packages'),
      (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setRawPackages(docs);
        setLoading(false);
      },
      (err) => {
        console.warn('Error fetching photography_packages:', err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      if (!clientName && user.displayName) setClientName(user.displayName);
      if (!clientEmail && user.email) setClientEmail(user.email);
    }
  }, [selectedPkg]);

  const packages = useMemo(
    () => mergePhotographyPackagesWithDefaults(rawPackages, { includeInactive: false }),
    [rawPackages]
  );

  // Gather all previous images & videos across active packages (if available)
  const allSampleMedia = useMemo(() => {
    const list: (PhotographySampleMedia & { packageTitle: string; packageTier: string })[] = [];
    for (const pkg of packages) {
      if (Array.isArray(pkg.sampleMedia)) {
        for (const item of pkg.sampleMedia) {
          list.push({
            ...item,
            packageTitle: pkg.title,
            packageTier: pkg.tierLabel || getTierDisplayName(pkg.tier),
          });
        }
      }
    }
    return list;
  }, [packages]);

  const filteredSamples = useMemo(() => {
    if (mediaFilter === 'all') return allSampleMedia;
    return allSampleMedia.filter((m) => m.type === mediaFilter);
  }, [allSampleMedia, mediaFilter]);

  const selectedPricing = useMemo(
    () => (selectedPkg ? getPhotographyPackagePricing(selectedPkg) : null),
    [selectedPkg]
  );

  const isNegotiating = Boolean(
    selectedPkg &&
      selectedPricing?.isNegotiable &&
      pricingMode === 'negotiate'
  );

  const activeBaseAmount = useMemo(() => {
    if (!selectedPricing) return 0;
    if (isNegotiating) {
      const parsed = Number(proposedPriceInput);
      return parsed > 0 ? parsed : selectedPricing.effectivePrice;
    }
    return selectedPricing.effectivePrice;
  }, [selectedPricing, isNegotiating, proposedPriceInput]);

  const feeBreakdown = useMemo(
    () => calculateCharge(activeBaseAmount, false),
    [calculateCharge, activeBaseAmount]
  );

  const openPackageModal = (pkg: PhotographyPackage) => {
    const pricing = getPhotographyPackagePricing(pkg);
    setSelectedPkg(pkg);
    setPricingMode('standard');
    setProposedPriceInput(String(Math.max(50, Math.round(pricing.effectivePrice * 0.85))));
    setNegotiationNoteInput('');
    setNegotiationAction('pay_now');
    setReceipt(null);
    if (auth.currentUser) {
      if (auth.currentUser.displayName) setClientName((prev) => prev || auth.currentUser!.displayName || '');
      if (auth.currentUser.email) setClientEmail((prev) => prev || auth.currentUser!.email || '');
    }
  };

  const validateCheckoutForm = (): boolean => {
    if (!clientName.trim()) {
      toast.error('Please enter your full name.');
      return false;
    }
    if (!clientEmail.trim() || !clientEmail.includes('@')) {
      toast.error('Please enter a valid email address.');
      return false;
    }
    if (!clientPhone.trim() || clientPhone.trim().length < 9) {
      toast.error('Please enter a valid phone / WhatsApp number.');
      return false;
    }
    if (!shootDate || !/^\d{4}-\d{2}-\d{2}$/.test(shootDate)) {
      toast.error('Please select your preferred shoot or event date.');
      return false;
    }
    if (isNegotiating) {
      const proposed = Number(proposedPriceInput);
      if (!proposed || proposed <= 0) {
        toast.error('Please enter a valid proposed budget greater than GH₵ 0.');
        return false;
      }
    }
    return true;
  };

  const persistBookingOrder = async (params: {
    paymentRef?: string;
    channel?: string;
    paidTotal?: number;
    paidAt?: string;
    gatewayResponse?: string;
    isProposalOnly: boolean;
  }) => {
    if (!selectedPkg || !selectedPricing) return;

    const orderNumber = `GPV-${Date.now().toString().slice(-6)}${Math.random()
      .toString(36)
      .substring(2, 4)
      .toUpperCase()}`;

    const proposedVal = isNegotiating ? Math.max(1, Number(proposedPriceInput) || 0) : null;
    const finalOrderPrice =
      proposedVal !== null ? proposedVal : selectedPricing.effectivePrice;
    const tierDisplay = selectedPkg.tierLabel || getTierDisplayName(selectedPkg.tier);
    const serviceTitle = `Photography & Videography — ${selectedPkg.title} (${selectedPkg.imageCount} Pictures, ${selectedPkg.videoCount} Videos)`;

    const bookingPayload: Record<string, any> = {
      bookingType: 'photography_videography',
      packageId: selectedPkg.id,
      packageTier: selectedPkg.tier,
      packageTitle: selectedPkg.title,
      includedImages: selectedPkg.imageCount,
      includedVideos: selectedPkg.videoCount,
      serviceId: selectedPkg.id,
      serviceCategory: 'Photography & Videography',
      serviceTitle,
      orderNumber,
      userId: auth.currentUser?.uid || 'anonymous',
      userName: clientName.trim(),
      userEmail: clientEmail.trim(),
      userPhone: clientPhone.trim(),
      date: shootDate,
      time: shootTime,
      location: shootLocation.trim(),
      notes: [
        `Package: ${tierDisplay} (${selectedPkg.imageCount} Photos, ${selectedPkg.videoCount} Videos)`,
        shootLocation.trim() ? `Venue/Location: ${shootLocation.trim()}` : '',
        shootNotes.trim(),
      ]
        .filter(Boolean)
        .join(' | '),
      status: isNegotiating ? 'Negotiation' : 'confirmed',
      originalPrice: selectedPricing.originalPrice,
      servicePrice: selectedPricing.effectivePrice,
      discountType: selectedPricing.discountType,
      discountValue: selectedPricing.discountValue,
      discountPercent: selectedPricing.discountPercent,
      discountAmount: selectedPricing.savingsAmount,
      negotiationStatus: isNegotiating ? 'pending_admin' : 'none',
      proposedPrice: proposedVal,
      negotiatedPrice: proposedVal,
      agreedPrice: isNegotiating ? null : selectedPricing.effectivePrice,
      adminCounterPrice: null,
      clientNegotiationNote: isNegotiating ? negotiationNoteInput.trim() : '',
      negotiationHistory: isNegotiating
        ? [
            {
              actor: 'client',
              action: params.isProposalOnly
                ? 'proposed_price'
                : 'proposed_and_paid_via_paystack',
              amount: proposedVal,
              note:
                negotiationNoteInput.trim() ||
                `Proposed GH₵ ${proposedVal?.toLocaleString()} for ${selectedPkg.title} (${selectedPkg.imageCount} Photos, ${selectedPkg.videoCount} Videos)`,
              timestamp: new Date().toISOString(),
            },
          ]
        : [],
      price: finalOrderPrice,
      totalPrice: finalOrderPrice,
      subtotal: activeBaseAmount,
      amountPaid: params.isProposalOnly ? 0 : activeBaseAmount,
      balanceDue: params.isProposalOnly ? finalOrderPrice : 0,
      paymentStatus: params.isProposalOnly ? 'Negotiating' : 'Paid',
      paymentGateway: params.isProposalOnly ? 'Pending Agreement' : 'Paystack',
      paymentRef: params.paymentRef || '',
      paystackReference: params.paymentRef || '',
      paymentChannel: params.channel || (params.isProposalOnly ? 'pending' : 'paystack'),
      paidAmount: params.isProposalOnly ? 0 : Number(params.paidTotal || feeBreakdown.totalAmount),
      paidAt: params.isProposalOnly ? null : params.paidAt || new Date().toISOString(),
      transactionFee: params.isProposalOnly ? 0 : feeBreakdown.feeAmount,
      feePercentage: feeBreakdown.feePercentageDisplay,
      createdAt: serverTimestamp(),
    };

    const bookingDocRef = await addDoc(collection(db, 'bookings'), bookingPayload);

    // Record credit transaction when Paystack payment completed
    if (!params.isProposalOnly && params.paymentRef) {
      await addDoc(collection(db, 'transactions'), {
        description: `Photography & Videography (${tierDisplay}): ${selectedPkg.title} [${selectedPkg.imageCount} Photos, ${selectedPkg.videoCount} Videos] — Ref: ${orderNumber}`,
        amount: Number(params.paidTotal || feeBreakdown.totalAmount),
        subtotal: Number(activeBaseAmount),
        processingFee: Number(feeBreakdown.feeAmount),
        feePercentage: feeBreakdown.feePercentageDisplay,
        type: 'credit',
        category: 'Photography & Videography',
        ref: params.paymentRef,
        gateway: 'Paystack',
        channel: params.channel || 'paystack',
        bookingId: bookingDocRef.id,
        bookingOrderNumber: orderNumber,
        customerName: clientName.trim(),
        customerEmail: clientEmail.trim(),
        customerPhone: clientPhone.trim(),
        serviceTitle,
        status: 'successful',
        recordedBy: auth.currentUser?.email || clientEmail.trim(),
        createdAt: serverTimestamp(),
        transactionDate: new Date().toISOString(),
      });
    }

    // Notifications for Admin & signed-in Client
    try {
      await addDoc(collection(db, 'notifications'), {
        userId: 'admin',
        title: params.isProposalOnly
          ? 'New Photography Price Negotiation'
          : 'New Photography & Videography Booking',
        orderNumber,
        message: `${clientName.trim()} selected ${selectedPkg.title} (${selectedPkg.imageCount} Photos, ${selectedPkg.videoCount} Videos) for ${shootDate}. ${
          params.isProposalOnly
            ? `Proposed budget: GH₵ ${proposedVal?.toLocaleString()}.`
            : `Paid via Paystack (Ref: ${params.paymentRef}).`
        }`,
        read: false,
        createdAt: serverTimestamp(),
      });

      if (auth.currentUser) {
        await addDoc(collection(db, 'notifications'), {
          userId: auth.currentUser.uid,
          title: 'Photography Package Order Logged',
          orderNumber,
          message: `Your order (${orderNumber}) for ${selectedPkg.title} (${selectedPkg.imageCount} Photos, ${selectedPkg.videoCount} Videos) on ${shootDate} has been recorded.`,
          read: false,
          createdAt: serverTimestamp(),
        });
      }
    } catch {
      // non-blocking
    }

    await logAuditActivity({
      type: 'create',
      module: 'Bookings',
      action: params.isProposalOnly ? 'PHOTOGRAPHY_NEGOTIATION_SUBMITTED' : 'PHOTOGRAPHY_PACKAGE_PAID',
      description: `${clientName.trim()} booked Photography & Videography "${selectedPkg.title}" (${selectedPkg.imageCount} images, ${selectedPkg.videoCount} videos) — ${
        params.isProposalOnly
          ? `Negotiation Offer GH₵ ${proposedVal?.toLocaleString()}`
          : `Paid GH₵ ${Number(params.paidTotal || feeBreakdown.totalAmount).toFixed(2)} via Paystack`
      }`,
      targetId: bookingDocRef.id,
      targetName: orderNumber,
      actorEmail: clientEmail.trim(),
      actorName: clientName.trim(),
    });

    // Dispatch SMS & Booking notification (non-blocking)
    try {
      const smsBody = params.isProposalOnly
        ? `Hello ${clientName.trim()}, your budget offer of GH₵ ${proposedVal?.toLocaleString()} for "${selectedPkg.title}" (${selectedPkg.imageCount} Photos, ${selectedPkg.videoCount} Videos) on ${shootDate} [Ref: ${orderNumber}] has been received for review. - Grefas Consult`
        : `Hello ${clientName.trim()}, payment confirmed for "${selectedPkg.title}" (${selectedPkg.imageCount} Photos, ${selectedPkg.videoCount} Videos) scheduled for ${shootDate}. Ref: ${orderNumber}, Paystack: ${params.paymentRef}. - Grefas Consult`;
      await sendArkeselSms(clientPhone.trim(), smsBody);
    } catch {
      // non-blocking
    }

    try {
      await fetch('/api/notify-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...bookingPayload,
          orderNumber,
        }),
      });
    } catch {
      // non-blocking
    }

    const negotiatedDeltaValue =
      isNegotiating && proposedVal != null
        ? proposedVal - selectedPricing.effectivePrice
        : 0;

    setReceipt({
      orderNumber,
      packageTitle: selectedPkg.title,
      packageTier: tierDisplay,
      includedImages: selectedPkg.imageCount,
      includedVideos: selectedPkg.videoCount,
      shootDate,
      shootTime,
      clientName: clientName.trim(),
      clientEmail: clientEmail.trim(),
      clientPhone: clientPhone.trim(),
      basePrice: selectedPricing.originalPrice,
      discountAmount: selectedPricing.hasDiscount ? selectedPricing.savingsAmount : 0,
      discountLabel: selectedPricing.discountBadgeText || undefined,
      negotiatedDelta: negotiatedDeltaValue,
      processingFee: params.isProposalOnly ? 0 : feeBreakdown.feeAmount,
      amountPaid: params.isProposalOnly ? 0 : activeBaseAmount,
      totalWithFee: params.isProposalOnly ? 0 : Number(params.paidTotal || feeBreakdown.totalAmount),
      paymentReference: params.paymentRef || 'PENDING-APPROVAL',
      paymentChannel: params.channel || 'Pending Admin Approval',
      isNegotiationProposalOnly: params.isProposalOnly,
      proposedPrice: proposedVal ?? undefined,
    });
  };

  const handleCheckoutAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateCheckoutForm()) return;

    if (isNegotiating && negotiationAction === 'submit_offer') {
      setIsSubmittingOffer(true);
      try {
        await persistBookingOrder({ isProposalOnly: true });
        toast.success('Negotiated budget offer submitted! Our team will review and respond via SMS/Email.');
      } catch (err: any) {
        console.error('Failed submitting negotiation offer:', err);
        toast.error('Could not submit negotiation offer. Please try again.');
      } finally {
        setIsSubmittingOffer(false);
      }
      return;
    }

    // Paid service through Paystack
    setShowPaystackModal(true);
  };

  if (loading && packages.length === 0) {
    return null;
  }

  return (
    <section
      id="photography-videography-section"
      className="mt-16 pt-12 border-t border-border/60 scroll-mt-24"
    >
      {/* Section Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 mb-10">
        <div className="space-y-2 max-w-2xl">
          <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-widest text-orange-600">
            <Camera className="h-4 w-4" />
            <span>Photography &amp; Videography · Production Packages</span>
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Photography &amp; Videography Packages
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            Compare coverage tiers side by side—each package specifies the exact number of edited pictures and videos included, with secure Paystack checkout and flexible negotiation options where enabled.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>Secured by Paystack</span>
          </div>

          {packages.length > 0 && (
            <div
              role="group"
              aria-label="Package layout view"
              className="inline-flex items-center gap-1 rounded-lg bg-muted/60 p-1 border border-border/60"
            >
              <button
                type="button"
                onClick={() => setPackageViewMode('all')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  packageViewMode === 'all'
                    ? 'bg-background text-foreground shadow-xs border border-border/50'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span>Cards &amp; Compare</span>
              </button>
              <button
                type="button"
                onClick={() => setPackageViewMode('cards')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  packageViewMode === 'cards'
                    ? 'bg-background text-foreground shadow-xs border border-border/50'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Camera className="h-3.5 w-3.5" />
                <span>Cards</span>
              </button>
              <button
                type="button"
                onClick={() => setPackageViewMode('table')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  packageViewMode === 'table'
                    ? 'bg-orange-600 text-white shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Table2 className="h-3.5 w-3.5" />
                <span>Comparison Table</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Packages Cards & Comparison Table */}
      {packages.length > 0 ? (
        <div className="space-y-12">
          {(packageViewMode === 'all' || packageViewMode === 'cards') && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
              {packages.map((pkg) => {
            const pricing = getPhotographyPackagePricing(pkg);
            const tierDisplay = pkg.tierLabel || getTierDisplayName(pkg.tier);
            const isHighlighted = String(pkg.tier).toLowerCase() === 'secondary';
            const samples = Array.isArray(pkg.sampleMedia) ? pkg.sampleMedia : [];

            return (
              <Card
                key={pkg.id}
                className={`flex flex-col border transition-all overflow-hidden bg-card ${
                  isHighlighted
                    ? 'border-orange-500/70 shadow-lg ring-1 ring-orange-500/20'
                    : 'border-border/70 shadow-sm hover:shadow-md'
                }`}
              >
                <CardHeader className="pb-4 space-y-2">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-mono font-black uppercase tracking-widest text-orange-600">
                      {tierDisplay} Package
                    </span>
                    {pricing.hasDiscount && (
                      <span className="font-mono font-bold text-emerald-600 flex items-center gap-1">
                        <Tag className="h-3 w-3" /> {pricing.discountBadgeText}
                      </span>
                    )}
                  </div>
                  <CardTitle className="text-xl font-extrabold text-foreground tracking-tight">
                    {pkg.title}
                  </CardTitle>
                  <CardDescription className="text-xs leading-relaxed text-muted-foreground min-h-[38px]">
                    {pkg.description}
                  </CardDescription>
                </CardHeader>

                <CardContent className="flex-1 flex flex-col justify-between space-y-5 pt-0">
                  <div className="space-y-5">
                    {/* Prominent Picture & Video Counts */}
                    <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-muted/40 border border-border/70">
                      <div className="space-y-0.5">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          <ImageIcon className="h-3.5 w-3.5 text-orange-600" /> Pictures
                        </span>
                        <div className="text-2xl font-black font-mono tabular-nums text-foreground">
                          {pkg.imageCount}
                          <span className="text-xs font-sans font-medium text-muted-foreground ml-1">
                            {pkg.imageCount === 1 ? 'Photo' : 'Photos'}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-0.5 border-l border-border/60 pl-3">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          <Video className="h-3.5 w-3.5 text-orange-600" /> Videos
                        </span>
                        <div className="text-2xl font-black font-mono tabular-nums text-foreground">
                          {pkg.videoCount}
                          <span className="text-xs font-sans font-medium text-muted-foreground ml-1">
                            {pkg.videoCount === 1 ? 'Video' : 'Videos'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Deliverables List */}
                    {pkg.deliverables && pkg.deliverables.length > 0 && (
                      <ul className="space-y-2 text-xs text-muted-foreground">
                        {pkg.deliverables.map((feat, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                            <span className="text-foreground/90 leading-snug">{feat}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {/* Previous Images & Videos Preview Strip (Only when available) */}
                    {samples.length > 0 && (
                      <div className="pt-3 border-t border-border/50 space-y-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                            <Film className="h-3.5 w-3.5 text-orange-600" /> Previous Samples
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setLightboxState({
                                items: samples.map((s) => ({ ...s, packageTitle: pkg.title })),
                                index: 0,
                              })
                            }
                            className="font-semibold text-orange-600 hover:underline cursor-pointer"
                          >
                            View all ({samples.length})
                          </button>
                        </div>
                        <div className="grid grid-cols-4 gap-1.5">
                          {samples.slice(0, 4).map((sample, sIdx) => {
                            const vMeta =
                              sample.type === 'video' ? parseVideoEmbedUrl(sample.url) : null;
                            const thumb =
                              sample.type === 'image'
                                ? sample.url
                                : sample.thumbnailUrl || vMeta?.thumbnailUrl || '';
                            return (
                              <button
                                key={sample.id}
                                type="button"
                                onClick={() =>
                                  setLightboxState({
                                    items: samples.map((s) => ({ ...s, packageTitle: pkg.title })),
                                    index: sIdx,
                                  })
                                }
                                className="relative aspect-square rounded-lg overflow-hidden bg-zinc-900 border border-border/60 group cursor-pointer"
                                title={sample.title || 'Preview sample'}
                              >
                                {thumb ? (
                                  <img
                                    src={thumb}
                                    alt={sample.title || 'Sample work'}
                                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <div className="h-full w-full flex items-center justify-center text-zinc-400">
                                    <Video className="h-4 w-4" />
                                  </div>
                                )}
                                {sample.type === 'video' && (
                                  <div className="absolute inset-0 bg-black/35 flex items-center justify-center">
                                    <Play className="h-3.5 w-3.5 text-white fill-white" />
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Pricing Footer inside CardContent */}
                  <div className="pt-4 border-t border-border/50 space-y-1.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        {pricing.hasDiscount ? 'Discounted Rate' : 'Package Rate'}
                      </span>
                      <div className="flex items-baseline gap-2">
                        {pricing.hasDiscount && (
                          <span className="text-xs line-through text-muted-foreground font-mono tabular-nums">
                            GH₵ {pricing.originalPrice.toLocaleString()}
                          </span>
                        )}
                        <span className="text-xl font-black font-mono tabular-nums text-foreground">
                          GH₵ {pricing.effectivePrice.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {pricing.hasDiscount && (
                      <div className="flex items-center justify-between text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                        <span>Savings Applied</span>
                        <span className="font-mono tabular-nums">
                          Save GH₵ {pricing.savingsAmount.toLocaleString()}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
                      <span>{pkg.imageCount} Photos · {pkg.videoCount} Videos</span>
                      {pricing.isNegotiable && (
                        <span className="inline-flex items-center gap-1 font-semibold text-indigo-600 dark:text-indigo-400">
                          <Handshake className="h-3 w-3" /> Negotiable
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="pt-0">
                  <Button
                    type="button"
                    onClick={() => openPackageModal(pkg)}
                    className={`w-full h-11 font-bold text-xs cursor-pointer flex items-center justify-center gap-2 ${
                      isHighlighted
                        ? 'bg-orange-600 hover:bg-orange-700 text-white shadow-sm'
                        : 'bg-zinc-900 hover:bg-zinc-800 dark:bg-orange-600 dark:hover:bg-orange-700 text-white'
                    }`}
                  >
                    <span>
                      {pricing.isNegotiable
                        ? `Select ${tierDisplay} · Pay or Negotiate`
                        : `Select ${tierDisplay} · Pay via Paystack`}
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
            </div>
          )}

          {(packageViewMode === 'all' || packageViewMode === 'table') && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
                <div>
                  <div className="text-[11px] font-mono font-bold uppercase tracking-widest text-orange-600 flex items-center gap-1.5">
                    <Table2 className="h-3.5 w-3.5" /> Side-by-Side Tier Comparison
                  </div>
                  <h3 className="text-xl font-bold tracking-tight text-foreground mt-0.5">
                    Compare Basic, Secondary &amp; Tertiary Packages
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  All amounts in Ghana Cedis (GH₵). Processing fees apply transparently at checkout.
                </p>
              </div>

              <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[680px] border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="sticky left-0 z-10 bg-muted/95 backdrop-blur-xs py-4 px-4 font-bold uppercase tracking-wider text-[11px] text-muted-foreground w-[220px] border-r border-border/60">
                          Package Feature
                        </th>
                        {packages.map((pkg) => {
                          const pricing = getPhotographyPackagePricing(pkg);
                          const tierDisplay = pkg.tierLabel || getTierDisplayName(pkg.tier);
                          const isHighlighted = String(pkg.tier).toLowerCase() === 'secondary';
                          return (
                            <th
                              key={`cmp-head-${pkg.id}`}
                              className={`py-4 px-4 align-top border-r last:border-r-0 border-border/50 ${
                                isHighlighted ? 'bg-orange-500/[0.05]' : ''
                              }`}
                            >
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-mono text-[11px] font-black uppercase tracking-widest text-orange-600">
                                    {tierDisplay}
                                  </span>
                                  {isHighlighted && (
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-orange-600">
                                      Most Popular
                                    </span>
                                  )}
                                </div>
                                <div className="text-sm font-extrabold text-foreground leading-snug">
                                  {pkg.title}
                                </div>
                                <div className="flex items-baseline gap-1.5 pt-1">
                                  <span className="text-base font-black font-mono tabular-nums text-foreground">
                                    GH₵ {pricing.effectivePrice.toLocaleString()}
                                  </span>
                                  {pricing.hasDiscount && (
                                    <span className="text-[11px] line-through font-mono tabular-nums text-muted-foreground">
                                      GH₵ {pricing.originalPrice.toLocaleString()}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-border/60">
                      {/* Base Package Price */}
                      <tr className="hover:bg-muted/20 transition-colors">
                        <td className="sticky left-0 z-10 bg-card py-3.5 px-4 font-semibold text-foreground border-r border-border/60">
                          Base Package Price
                        </td>
                        {packages.map((pkg) => {
                          const pricing = getPhotographyPackagePricing(pkg);
                          const isHighlighted = String(pkg.tier).toLowerCase() === 'secondary';
                          return (
                            <td
                              key={`cmp-base-${pkg.id}`}
                              className={`py-3.5 px-4 font-mono tabular-nums text-foreground border-r last:border-r-0 border-border/40 ${
                                isHighlighted ? 'bg-orange-500/[0.03]' : ''
                              }`}
                            >
                              GH₵ {pricing.originalPrice.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          );
                        })}
                      </tr>

                      {/* Active Discount */}
                      <tr className="hover:bg-muted/20 transition-colors">
                        <td className="sticky left-0 z-10 bg-card py-3.5 px-4 font-semibold text-foreground border-r border-border/60">
                          Applied Discount
                        </td>
                        {packages.map((pkg) => {
                          const pricing = getPhotographyPackagePricing(pkg);
                          const isHighlighted = String(pkg.tier).toLowerCase() === 'secondary';
                          return (
                            <td
                              key={`cmp-disc-${pkg.id}`}
                              className={`py-3.5 px-4 border-r last:border-r-0 border-border/40 ${
                                isHighlighted ? 'bg-orange-500/[0.03]' : ''
                              }`}
                            >
                              {pricing.hasDiscount ? (
                                <span className="font-mono tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                                  - GH₵ {pricing.savingsAmount.toFixed(2)} ({pricing.discountBadgeText})
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-muted-foreground">
                                  <Minus className="h-3 w-3" /> Standard Rate
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>

                      {/* Final Package Rate */}
                      <tr className="hover:bg-muted/20 transition-colors bg-muted/15">
                        <td className="sticky left-0 z-10 bg-card py-3.5 px-4 font-bold text-foreground border-r border-border/60">
                          Package Subtotal Rate
                        </td>
                        {packages.map((pkg) => {
                          const pricing = getPhotographyPackagePricing(pkg);
                          const isHighlighted = String(pkg.tier).toLowerCase() === 'secondary';
                          return (
                            <td
                              key={`cmp-eff-${pkg.id}`}
                              className={`py-3.5 px-4 font-mono tabular-nums font-black text-sm text-foreground border-r last:border-r-0 border-border/40 ${
                                isHighlighted ? 'bg-orange-500/[0.04]' : ''
                              }`}
                            >
                              GH₵ {pricing.effectivePrice.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          );
                        })}
                      </tr>

                      {/* Edited Pictures Included */}
                      <tr className="hover:bg-muted/20 transition-colors">
                        <td className="sticky left-0 z-10 bg-card py-3.5 px-4 font-semibold text-foreground border-r border-border/60">
                          <span className="inline-flex items-center gap-1.5">
                            <ImageIcon className="h-3.5 w-3.5 text-orange-600" /> Edited Pictures Included
                          </span>
                        </td>
                        {packages.map((pkg) => {
                          const isHighlighted = String(pkg.tier).toLowerCase() === 'secondary';
                          return (
                            <td
                              key={`cmp-img-${pkg.id}`}
                              className={`py-3.5 px-4 font-mono tabular-nums font-bold text-foreground border-r last:border-r-0 border-border/40 ${
                                isHighlighted ? 'bg-orange-500/[0.03]' : ''
                              }`}
                            >
                              {pkg.imageCount} {pkg.imageCount === 1 ? 'Photo' : 'Photos'}
                            </td>
                          );
                        })}
                      </tr>

                      {/* Edited Videos Included */}
                      <tr className="hover:bg-muted/20 transition-colors">
                        <td className="sticky left-0 z-10 bg-card py-3.5 px-4 font-semibold text-foreground border-r border-border/60">
                          <span className="inline-flex items-center gap-1.5">
                            <Video className="h-3.5 w-3.5 text-orange-600" /> Edited Videos Included
                          </span>
                        </td>
                        {packages.map((pkg) => {
                          const isHighlighted = String(pkg.tier).toLowerCase() === 'secondary';
                          return (
                            <td
                              key={`cmp-vid-${pkg.id}`}
                              className={`py-3.5 px-4 font-mono tabular-nums font-bold text-foreground border-r last:border-r-0 border-border/40 ${
                                isHighlighted ? 'bg-orange-500/[0.03]' : ''
                              }`}
                            >
                              {pkg.videoCount} {pkg.videoCount === 1 ? 'Video' : 'Videos'}
                            </td>
                          );
                        })}
                      </tr>

                      {/* Price Negotiation */}
                      <tr className="hover:bg-muted/20 transition-colors">
                        <td className="sticky left-0 z-10 bg-card py-3.5 px-4 font-semibold text-foreground border-r border-border/60">
                          Price Negotiation
                        </td>
                        {packages.map((pkg) => {
                          const pricing = getPhotographyPackagePricing(pkg);
                          const isHighlighted = String(pkg.tier).toLowerCase() === 'secondary';
                          return (
                            <td
                              key={`cmp-neg-${pkg.id}`}
                              className={`py-3.5 px-4 border-r last:border-r-0 border-border/40 ${
                                isHighlighted ? 'bg-orange-500/[0.03]' : ''
                              }`}
                            >
                              {pricing.isNegotiable ? (
                                <span className="inline-flex items-center gap-1.5 font-semibold text-indigo-600 dark:text-indigo-400">
                                  <Handshake className="h-3.5 w-3.5" /> Enabled (Propose Offer)
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                                  <Minus className="h-3.5 w-3.5" /> Fixed Package Rate
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>

                      {/* Previous Samples */}
                      <tr className="hover:bg-muted/20 transition-colors">
                        <td className="sticky left-0 z-10 bg-card py-3.5 px-4 font-semibold text-foreground border-r border-border/60">
                          Previous Samples
                        </td>
                        {packages.map((pkg) => {
                          const samples = Array.isArray(pkg.sampleMedia) ? pkg.sampleMedia : [];
                          const imgSamples = samples.filter((s) => s.type === 'image').length;
                          const vidSamples = samples.filter((s) => s.type === 'video').length;
                          const isHighlighted = String(pkg.tier).toLowerCase() === 'secondary';
                          return (
                            <td
                              key={`cmp-samp-${pkg.id}`}
                              className={`py-3.5 px-4 border-r last:border-r-0 border-border/40 ${
                                isHighlighted ? 'bg-orange-500/[0.03]' : ''
                              }`}
                            >
                              {samples.length > 0 ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setLightboxState({
                                      items: samples.map((s) => ({ ...s, packageTitle: pkg.title })),
                                      index: 0,
                                    })
                                  }
                                  className="inline-flex items-center gap-1.5 font-semibold text-orange-600 hover:underline cursor-pointer font-mono tabular-nums"
                                >
                                  <Film className="h-3.5 w-3.5" />
                                  {imgSamples}P · {vidSamples}V (Preview)
                                </button>
                              ) : (
                                <span className="text-muted-foreground">Portfolio on request</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>

                      {/* Key Deliverables Side-by-Side */}
                      <tr className="hover:bg-muted/20 transition-colors align-top">
                        <td className="sticky left-0 z-10 bg-card py-4 px-4 font-semibold text-foreground border-r border-border/60">
                          Key Deliverables &amp; Coverage
                        </td>
                        {packages.map((pkg) => {
                          const isHighlighted = String(pkg.tier).toLowerCase() === 'secondary';
                          const deliverables = Array.isArray(pkg.deliverables) ? pkg.deliverables : [];
                          return (
                            <td
                              key={`cmp-del-${pkg.id}`}
                              className={`py-4 px-4 border-r last:border-r-0 border-border/40 ${
                                isHighlighted ? 'bg-orange-500/[0.03]' : ''
                              }`}
                            >
                              {deliverables.length > 0 ? (
                                <ul className="space-y-1.5">
                                  {deliverables.map((feat, fIdx) => (
                                    <li key={fIdx} className="flex items-start gap-1.5 text-foreground/90 leading-snug">
                                      <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                                      <span>{feat}</span>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>

                    <tfoot>
                      <tr className="border-t border-border bg-muted/30">
                        <td className="sticky left-0 z-10 bg-muted/95 backdrop-blur-xs py-4 px-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-r border-border/60">
                          Choose Package
                        </td>
                        {packages.map((pkg) => {
                          const tierDisplay = pkg.tierLabel || getTierDisplayName(pkg.tier);
                          const isHighlighted = String(pkg.tier).toLowerCase() === 'secondary';
                          return (
                            <td
                              key={`cmp-cta-${pkg.id}`}
                              className={`py-4 px-4 border-r last:border-r-0 border-border/40 ${
                                isHighlighted ? 'bg-orange-500/[0.05]' : ''
                              }`}
                            >
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => openPackageModal(pkg)}
                                className={`w-full h-9 text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5 ${
                                  isHighlighted
                                    ? 'bg-orange-600 hover:bg-orange-700 text-white'
                                    : 'bg-zinc-900 hover:bg-zinc-800 dark:bg-orange-600 dark:hover:bg-orange-700 text-white'
                                }`}
                              >
                                <span>Select {tierDisplay}</span>
                                <ArrowRight className="h-3.5 w-3.5" />
                              </Button>
                            </td>
                          );
                        })}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="py-12 text-center border border-dashed border-border rounded-xl text-sm text-muted-foreground">
          No active Photography &amp; Videography packages available at the moment.
        </div>
      )}

      {/* Previous Photography & Videography Samples Gallery (if admin uploaded any) */}
      {allSampleMedia.length > 0 && (
        <div className="mt-12 pt-8 border-t border-border/50 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-extrabold text-foreground flex items-center gap-2">
                <Film className="h-5 w-5 text-orange-600" /> Previous Photography &amp; Videography Work
              </h3>
              <p className="text-xs text-muted-foreground">
                Browse real frames and highlight reels produced by our creative team.
              </p>
            </div>
            <div className="inline-flex items-center gap-1 rounded-lg bg-muted/60 p-1 border border-border/50 self-start">
              {(
                [
                  { id: 'all', label: `All (${allSampleMedia.length})` },
                  {
                    id: 'image',
                    label: `Photos (${allSampleMedia.filter((m) => m.type === 'image').length})`,
                  },
                  {
                    id: 'video',
                    label: `Videos (${allSampleMedia.filter((m) => m.type === 'video').length})`,
                  },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setMediaFilter(tab.id)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    mediaFilter === tab.id
                      ? 'bg-orange-600 text-white'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredSamples.map((item, idx) => {
              const vMeta = item.type === 'video' ? parseVideoEmbedUrl(item.url) : null;
              const thumb =
                item.type === 'image' ? item.url : item.thumbnailUrl || vMeta?.thumbnailUrl || '';
              return (
                <button
                  key={`${item.id}-${idx}`}
                  type="button"
                  onClick={() => setLightboxState({ items: filteredSamples, index: idx })}
                  className="group relative aspect-[4/3] rounded-xl overflow-hidden bg-zinc-900 border border-border/70 text-left cursor-pointer"
                >
                  {thumb ? (
                    <img
                      src={thumb}
                      alt={item.title || 'Previous work sample'}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="h-full w-full flex flex-col items-center justify-center text-zinc-400 gap-1.5">
                      <Video className="h-8 w-8" />
                      <span className="text-[11px] font-mono">Play Video Reel</span>
                    </div>
                  )}
                  {item.type === 'video' && (
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                      <div className="h-11 w-11 rounded-full bg-orange-600/95 text-white flex items-center justify-center shadow-lg transition-transform group-hover:scale-110">
                        <Play className="h-5 w-5 ml-0.5 fill-white" />
                      </div>
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent p-3">
                    <p className="text-xs font-bold text-white truncate">
                      {item.title || (item.type === 'video' ? 'Video Production' : 'Photo Session')}
                    </p>
                    <p className="text-[10px] text-zinc-300 truncate">{item.packageTier} Tier</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Package Checkout, Negotiation & Paystack Modal */}
      <Dialog
        open={Boolean(selectedPkg)}
        onOpenChange={(open) => {
          if (!open && !showPaystackModal) {
            setSelectedPkg(null);
            setReceipt(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl w-full max-h-[92vh] overflow-y-auto bg-card border-border p-0">
          {selectedPkg && selectedPricing && (
            <>
              <div className="bg-zinc-900 text-white px-6 py-5 border-b border-orange-500/40">
                <DialogHeader className="text-left space-y-1">
                  <div className="flex items-center justify-between gap-2 text-[11px] font-mono uppercase tracking-widest text-orange-400">
                    <span>{selectedPkg.tierLabel || getTierDisplayName(selectedPkg.tier)} Package</span>
                    <span>
                      {selectedPkg.imageCount} Photos · {selectedPkg.videoCount} Videos
                    </span>
                  </div>
                  <DialogTitle className="text-xl font-extrabold text-white">
                    {receipt ? 'Order Logged & Confirmed' : selectedPkg.title}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-zinc-300">
                    {receipt
                      ? 'Your photography & videography package order has been recorded.'
                      : 'Complete your shoot details and confirm payment through Paystack.'}
                  </DialogDescription>
                </DialogHeader>
              </div>

              {receipt ? (
                <div className="p-6 space-y-5">
                  <div className="text-center space-y-2 py-2">
                    <div className="h-14 w-14 rounded-full bg-emerald-500/15 text-emerald-600 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="h-8 w-8" />
                    </div>
                    <h4 className="text-lg font-extrabold text-foreground">
                      {receipt.isNegotiationProposalOnly
                        ? 'Budget Proposal Submitted!'
                        : 'Paystack Payment Confirmed!'}
                    </h4>
                    <p className="text-xs text-muted-foreground max-w-md mx-auto">
                      Thank you, <strong>{receipt.clientName}</strong>. A confirmation has been dispatched to{' '}
                      <strong>{receipt.clientEmail}</strong> and <strong>{receipt.clientPhone}</strong>.
                    </p>
                  </div>

                  <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Booking Reference</span>
                      <span className="font-mono font-black text-orange-600">{receipt.orderNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Selected Package</span>
                      <span className="font-bold text-foreground">
                        {receipt.packageTier} — {receipt.packageTitle}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Included Media Deliverables</span>
                      <span className="font-mono font-bold text-foreground">
                        {receipt.includedImages} Pictures · {receipt.includedVideos} Videos
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Shoot Date &amp; Time</span>
                      <span className="font-semibold text-foreground">
                        {receipt.shootDate} at {receipt.shootTime}
                      </span>
                    </div>
                    <div className="h-px bg-border/60 my-1" />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Base Package Price</span>
                      <span className="font-mono tabular-nums font-semibold text-foreground">
                        GH₵ {receipt.basePrice.toFixed(2)}
                      </span>
                    </div>
                    {receipt.discountAmount > 0 && (
                      <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                        <span>
                          Applied Discount{receipt.discountLabel ? ` (${receipt.discountLabel})` : ''}
                        </span>
                        <span className="font-mono tabular-nums">
                          - GH₵ {receipt.discountAmount.toFixed(2)}
                        </span>
                      </div>
                    )}
                    {receipt.negotiatedDelta !== 0 && (
                      <div className="flex justify-between text-indigo-600 dark:text-indigo-400 font-semibold">
                        <span>Negotiated Offer Adjustment</span>
                        <span className="font-mono tabular-nums">
                          {receipt.negotiatedDelta < 0
                            ? `- GH₵ ${Math.abs(receipt.negotiatedDelta).toFixed(2)}`
                            : `+ GH₵ ${receipt.negotiatedDelta.toFixed(2)}`}
                        </span>
                      </div>
                    )}
                    {receipt.isNegotiationProposalOnly ? (
                      <div className="flex justify-between font-bold pt-1 border-t border-border/50">
                        <span className="text-muted-foreground">Proposed Budget (Pending Review)</span>
                        <span className="font-mono tabular-nums text-indigo-600">
                          GH₵ {(receipt.proposedPrice || 0).toFixed(2)}
                        </span>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Paystack Processing Fee</span>
                          <span className="font-mono tabular-nums font-semibold text-foreground">
                            {receipt.processingFee === 0
                              ? 'GH₵ 0.00 (Waived)'
                              : `+ GH₵ ${receipt.processingFee.toFixed(2)}`}
                          </span>
                        </div>
                        <div className="flex justify-between font-bold pt-1 border-t border-border/50">
                          <span className="text-foreground">Final Total Paid via Paystack</span>
                          <span className="font-mono tabular-nums text-emerald-600 text-sm font-black">
                            GH₵ {receipt.totalWithFee.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Paystack Reference</span>
                          <span className="font-mono font-bold text-foreground">
                            {receipt.paymentReference}
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      onClick={() => {
                        setSelectedPkg(null);
                        setReceipt(null);
                      }}
                      className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold h-10 px-6 cursor-pointer"
                    >
                      Done
                    </Button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleCheckoutAction} className="p-6 space-y-5">
                  {/* Deliverables Strip */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-muted/40 border border-border text-xs">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-muted-foreground block">
                        Edited Pictures
                      </span>
                      <span className="font-mono font-black text-base text-foreground tabular-nums">
                        {selectedPkg.imageCount} Photos
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-muted-foreground block">
                        Edited Videos
                      </span>
                      <span className="font-mono font-black text-base text-foreground tabular-nums">
                        {selectedPkg.videoCount} Videos
                      </span>
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <span className="text-[10px] font-bold uppercase text-muted-foreground block">
                        Listed Rate
                      </span>
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-mono font-black text-base text-orange-600 tabular-nums">
                          GH₵ {selectedPricing.effectivePrice.toLocaleString()}
                        </span>
                        {selectedPricing.hasDiscount && (
                          <span className="text-[11px] line-through text-muted-foreground font-mono">
                            {selectedPricing.originalPrice.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Client Contact & Event Info */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-foreground mb-1 block">
                        Full Name *
                      </label>
                      <Input
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        placeholder="Your full name"
                        required
                        className="h-9 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-foreground mb-1 block">
                        Email Address *
                      </label>
                      <Input
                        type="email"
                        value={clientEmail}
                        onChange={(e) => setClientEmail(e.target.value)}
                        placeholder="you@example.com"
                        required
                        className="h-9 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-foreground mb-1 block">
                        Phone / WhatsApp Number *
                      </label>
                      <Input
                        type="tel"
                        value={clientPhone}
                        onChange={(e) => setClientPhone(e.target.value)}
                        placeholder="024XXXXXXX"
                        required
                        className="h-9 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-foreground mb-1 block">
                        Shoot / Event Location
                      </label>
                      <div className="relative">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <Input
                          value={shootLocation}
                          onChange={(e) => setShootLocation(e.target.value)}
                          placeholder="e.g. Kumasi / Accra / Studio"
                          className="h-9 pl-8 text-xs"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-foreground mb-1 block">
                        Preferred Date *
                      </label>
                      <div className="relative">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <Input
                          type="date"
                          value={shootDate}
                          min={new Date().toISOString().split('T')[0]}
                          onChange={(e) => setShootDate(e.target.value)}
                          required
                          className="h-9 pl-8 text-xs font-mono"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-foreground mb-1 block">
                        Preferred Time
                      </label>
                      <select
                        value={shootTime}
                        onChange={(e) => setShootTime(e.target.value)}
                        className="flex h-9 w-full rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground"
                      >
                        <option value="08:00 AM">08:00 AM</option>
                        <option value="10:00 AM">10:00 AM</option>
                        <option value="12:00 PM">12:00 PM</option>
                        <option value="02:00 PM">02:00 PM</option>
                        <option value="04:00 PM">04:00 PM</option>
                        <option value="06:00 PM">06:00 PM</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-foreground mb-1 block">
                      Creative Brief / Notes (Optional)
                    </label>
                    <Textarea
                      rows={2}
                      value={shootNotes}
                      onChange={(e) => setShootNotes(e.target.value)}
                      placeholder="Describe event theme, shot list, or wardrobe preferences..."
                      className="text-xs resize-none"
                    />
                  </div>

                  {/* Negotiation Toggle (When Enabled by Admin) */}
                  {selectedPricing.isNegotiable && (
                    <div className="space-y-3 pt-2 border-t border-border/60">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                        Pricing Option
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <button
                          type="button"
                          onClick={() => setPricingMode('standard')}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                            pricingMode === 'standard'
                              ? 'border-orange-600 bg-orange-600/10'
                              : 'border-border bg-background hover:bg-muted/40'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs font-extrabold">
                            <span>Pay Listed Package Rate</span>
                            <span className="font-mono text-orange-600">
                              GH₵ {selectedPricing.effectivePrice.toLocaleString()}
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Instant confirmation via Paystack
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => setPricingMode('negotiate')}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                            pricingMode === 'negotiate'
                              ? 'border-indigo-600 bg-indigo-600/10'
                              : 'border-border bg-background hover:bg-muted/40'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs font-extrabold text-indigo-600 dark:text-indigo-400">
                            <span className="flex items-center gap-1">
                              <Handshake className="h-3.5 w-3.5" /> Negotiate Price
                            </span>
                            <span className="text-[10px] uppercase font-mono">Propose Offer</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Submit custom budget or pay offer via Paystack
                          </p>
                        </button>
                      </div>

                      {pricingMode === 'negotiate' && (
                        <div className="p-3.5 rounded-xl bg-indigo-500/5 border border-indigo-500/30 space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 mb-1 block">
                                Your Proposed Budget (GH₵) *
                              </label>
                              <Input
                                type="number"
                                min={1}
                                step="any"
                                value={proposedPriceInput}
                                onChange={(e) => setProposedPriceInput(e.target.value)}
                                className="h-9 text-xs font-mono font-bold bg-background"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-black uppercase text-muted-foreground mb-1 block">
                                Note for Admin (Optional)
                              </label>
                              <Input
                                value={negotiationNoteInput}
                                onChange={(e) => setNegotiationNoteInput(e.target.value)}
                                placeholder="e.g. Shorter 1.5 hr session"
                                className="h-9 text-xs bg-background"
                              />
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => setNegotiationAction('pay_now')}
                              className={`flex-1 py-2 px-3 rounded-lg border text-[11px] font-bold cursor-pointer ${
                                negotiationAction === 'pay_now'
                                  ? 'border-emerald-600 bg-emerald-600/10 text-emerald-700 dark:text-emerald-300'
                                  : 'border-border bg-background text-muted-foreground'
                              }`}
                            >
                              Pay Proposed Amount Now via Paystack
                            </button>
                            <button
                              type="button"
                              onClick={() => setNegotiationAction('submit_offer')}
                              className={`flex-1 py-2 px-3 rounded-lg border text-[11px] font-bold cursor-pointer ${
                                negotiationAction === 'submit_offer'
                                  ? 'border-indigo-600 bg-indigo-600/10 text-indigo-700 dark:text-indigo-300'
                                  : 'border-border bg-background text-muted-foreground'
                              }`}
                            >
                              Submit Offer for Admin Approval First
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Always-Visible Itemized Checkout Summary */}
                  <div className="rounded-xl bg-muted/40 border border-border p-4 text-xs space-y-2">
                    <div className="flex items-center justify-between pb-1.5 border-b border-border/60">
                      <span className="font-bold uppercase tracking-wider text-[11px] text-foreground flex items-center gap-1.5">
                        <Receipt className="h-3.5 w-3.5 text-orange-600" />
                        Itemized Checkout Summary
                      </span>
                      <span className="text-[11px] font-mono text-muted-foreground">
                        {(selectedPkg.tierLabel || getTierDisplayName(selectedPkg.tier))} · {selectedPkg.imageCount}P / {selectedPkg.videoCount}V
                      </span>
                    </div>

                    <div className="flex justify-between text-muted-foreground">
                      <span>Base Package Price ({selectedPkg.title}):</span>
                      <span className="font-mono tabular-nums font-bold text-foreground">
                        GH₵ {selectedPricing.originalPrice.toFixed(2)}
                      </span>
                    </div>

                    {selectedPricing.hasDiscount && (
                      <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                        <span>Applied Discount ({selectedPricing.discountBadgeText}):</span>
                        <span className="font-mono tabular-nums">
                          - GH₵ {selectedPricing.savingsAmount.toFixed(2)}
                        </span>
                      </div>
                    )}

                    {isNegotiating && (() => {
                      const negDelta = activeBaseAmount - selectedPricing.effectivePrice;
                      return (
                        <div className="flex justify-between text-indigo-600 dark:text-indigo-400 font-semibold">
                          <span>Negotiated Client Offer Adjustment:</span>
                          <span className="font-mono tabular-nums">
                            {negDelta < 0
                              ? `- GH₵ ${Math.abs(negDelta).toFixed(2)}`
                              : negDelta > 0
                              ? `+ GH₵ ${negDelta.toFixed(2)}`
                              : 'GH₵ 0.00'}
                          </span>
                        </div>
                      );
                    })()}

                    <div className="flex justify-between text-muted-foreground pt-1 border-t border-border/40">
                      <span>{isNegotiating ? 'Negotiated Package Subtotal:' : 'Package Subtotal After Discount:'}</span>
                      <span className="font-mono tabular-nums font-bold text-foreground">
                        GH₵ {activeBaseAmount.toFixed(2)}
                      </span>
                    </div>

                    {!(isNegotiating && negotiationAction === 'submit_offer') ? (
                      <>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Paystack Processing Charge ({feeBreakdown.feePercentageDisplay}):</span>
                          <span className="font-mono tabular-nums font-bold text-foreground">
                            {feeBreakdown.feeAmount === 0
                              ? 'GH₵ 0.00 (Waived)'
                              : `+ GH₵ ${feeBreakdown.feeAmount.toFixed(2)}`}
                          </span>
                        </div>
                        <div className="h-px bg-border/60 my-1" />
                        <div className="flex justify-between font-extrabold text-sm">
                          <span className="text-foreground">Final Total Payable via Paystack:</span>
                          <span className="font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                            GH₵ {feeBreakdown.totalAmount.toFixed(2)}
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Paystack Processing Charge:</span>
                          <span className="font-mono tabular-nums text-muted-foreground">
                            Calculated upon offer approval
                          </span>
                        </div>
                        <div className="h-px bg-border/60 my-1" />
                        <div className="flex justify-between font-extrabold text-sm">
                          <span className="text-foreground">Proposed Package Total:</span>
                          <span className="font-mono tabular-nums text-indigo-600 dark:text-indigo-400">
                            GH₵ {activeBaseAmount.toFixed(2)}
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setSelectedPkg(null)}
                      className="text-xs font-bold h-10"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={isSubmittingOffer}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold h-10 px-5 cursor-pointer flex items-center gap-1.5"
                    >
                      {isSubmittingOffer ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> Submitting Offer...
                        </>
                      ) : isNegotiating && negotiationAction === 'submit_offer' ? (
                        <>
                          <Send className="h-4 w-4" /> Submit Offer for Review
                        </>
                      ) : (
                        <>
                          <Lock className="h-4 w-4" /> Pay GH₵ {feeBreakdown.totalAmount.toFixed(2)} with Paystack
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Official Paystack Payment Gateway Component */}
      {selectedPkg && selectedPricing && (
        <PaystackPayment
          isOpen={showPaystackModal}
          onClose={() => setShowPaystackModal(false)}
          amount={activeBaseAmount}
          email={clientEmail}
          fullName={clientName}
          phone={clientPhone}
          title={`${selectedPkg.title} (${selectedPkg.imageCount} Photos, ${selectedPkg.videoCount} Videos)`}
          pricingSummary={{
            packageLabel: `${selectedPkg.tierLabel || getTierDisplayName(selectedPkg.tier)} Tier · ${selectedPkg.imageCount}P / ${selectedPkg.videoCount}V`,
            basePackagePrice: selectedPricing.originalPrice,
            discountAmount: selectedPricing.hasDiscount ? selectedPricing.savingsAmount : 0,
            discountLabel: selectedPricing.discountBadgeText || 'Package Discount',
            isNegotiated: isNegotiating,
            negotiatedAmount: isNegotiating ? activeBaseAmount : null,
          }}
          metadata={{
            bookingType: 'photography_videography',
            packageId: selectedPkg.id,
            packageTier: selectedPkg.tier,
            includedImages: selectedPkg.imageCount,
            includedVideos: selectedPkg.videoCount,
            shootDate,
            shootTime,
          }}
          onSuccess={async (paymentData) => {
            try {
              await persistBookingOrder({
                paymentRef: paymentData.reference,
                channel: paymentData.channel,
                paidTotal: paymentData.amount,
                paidAt: paymentData.paidAt,
                gatewayResponse: paymentData.gatewayResponse,
                isProposalOnly: false,
              });
            } catch (err) {
              console.error('Error recording photography booking after payment:', err);
              toast.error('Payment confirmed, but saving booking record encountered an issue. Contact support with Ref: ' + paymentData.reference);
            }
          }}
        />
      )}

      {/* Media Sample Lightbox Modal */}
      {lightboxState && lightboxState.items.length > 0 && (
        <div
          className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLightboxState(null)}
        >
          <div
            className="bg-zinc-950 border border-zinc-800 rounded-2xl max-w-4xl w-full overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const activeItem = lightboxState.items[lightboxState.index];
              return (
                <>
                  <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 text-white">
                    <div className="min-w-0 pr-3">
                      <p className="text-xs font-bold truncate">
                        {activeItem.title || 'Previous Work Sample'}
                      </p>
                      <p className="text-[10px] text-zinc-400">
                        {activeItem.packageTitle ? `${activeItem.packageTitle} · ` : ''}
                        {lightboxState.index + 1} of {lightboxState.items.length}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setLightboxState(null)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="relative bg-black flex items-center justify-center min-h-[320px] max-h-[72vh]">
                    {activeItem.type === 'image' ? (
                      <img
                        src={activeItem.url}
                        alt={activeItem.title || 'Sample photography'}
                        className="max-h-[70vh] w-auto object-contain"
                        referrerPolicy="no-referrer"
                      />
                    ) : (() => {
                      const parsed = parseVideoEmbedUrl(activeItem.url);
                      if (parsed.kind === 'youtube' || parsed.kind === 'vimeo') {
                        return (
                          <iframe
                            src={parsed.embedUrl}
                            title={activeItem.title || 'Sample video'}
                            className="w-full aspect-video max-h-[70vh]"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        );
                      }
                      return (
                        <video
                          src={parsed.embedUrl}
                          controls
                          autoPlay
                          className="max-h-[70vh] w-full"
                        />
                      );
                    })()}

                    {lightboxState.items.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setLightboxState((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    index:
                                      (prev.index - 1 + prev.items.length) % prev.items.length,
                                  }
                                : null
                            )
                          }
                          className="absolute left-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-orange-600 transition-colors cursor-pointer"
                        >
                          <ChevronLeft className="h-5 w-5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setLightboxState((prev) =>
                              prev
                                ? { ...prev, index: (prev.index + 1) % prev.items.length }
                                : null
                            )
                          }
                          className="absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-orange-600 transition-colors cursor-pointer"
                        >
                          <ChevronRight className="h-5 w-5" />
                        </button>
                      </>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </section>
  );
}
