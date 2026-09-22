import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Heart, 
  HeartHandshake, 
  Building2, 
  User, 
  ShieldCheck, 
  CheckCircle2, 
  Sparkles, 
  Printer, 
  CreditCard, 
  Smartphone, 
  Landmark, 
  Lock, 
  Gift, 
  Loader2, 
  ExternalLink,
  ChevronRight,
  Info,
  Award,
  Users,
  Film,
  Compass,
  ArrowRight,
  MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { db } from '@/firebase';
import { collection, addDoc, serverTimestamp, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { toast } from 'sonner';
import { Helmet } from 'react-helmet-async';
import { openPaystackModal, generatePaystackReference } from '@/lib/paystack';
import { Link } from 'react-router-dom';

interface SponsorRecord {
  id?: string;
  sponsorName: string;
  sponsorType: 'individual' | 'organization';
  amount: number;
  currency: string;
  tier?: string;
  message?: string;
  isAnonymous?: boolean;
  createdAt?: any;
}

const PRESET_AMOUNTS = [
  { amount: 50, label: 'GH₵ 50', impact: 'Rehearsal studio kit & refreshment for young actors', tier: 'Supporter' },
  { amount: 100, label: 'GH₵ 100', impact: 'Script printing & lighting gear upkeep for upcoming skits', tier: 'Bronze' },
  { amount: 250, label: 'GH₵ 250', impact: 'Professional audio & lapel microphone hire for location shoots', tier: 'Silver', popular: true },
  { amount: 500, label: 'GH₵ 500', impact: 'Full casting workshop sponsorship for 2 underprivileged talents', tier: 'Gold' },
  { amount: 1000, label: 'GH₵ 1,000', impact: 'Co-sponsor an entire educational community short film', tier: 'Platinum' },
  { amount: 2500, label: 'GH₵ 2,500', impact: 'Major production patron with featured logo in video credits', tier: 'Executive Partner' },
];

export default function Sponsorship() {
  const [sponsorType, setSponsorType] = useState<'individual' | 'organization'>('individual');
  const [selectedAmount, setSelectedAmount] = useState<number>(250);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [isCustom, setIsCustom] = useState<boolean>(false);

  // Form Fields
  const [sponsorName, setSponsorName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [paymentOption, setPaymentOption] = useState<'paystack' | 'bank_transfer'>('paystack');

  // Loading & confirmation
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successReceipt, setSuccessReceipt] = useState<any | null>(null);
  const [showDirectBankInfo, setShowDirectBankInfo] = useState(false);

  // Public Community Supporters Wall State
  const [publicSponsors, setPublicSponsors] = useState<SponsorRecord[]>([]);
  const [totalRaised, setTotalRaised] = useState<number>(0);
  const [sponsorCount, setSponsorCount] = useState<number>(0);

  // Listen to recent completed public sponsorships
  useEffect(() => {
    try {
      const q = query(
        collection(db, 'sponsorships'),
        orderBy('createdAt', 'desc'),
        limit(50)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const records: SponsorRecord[] = [];
        let total = 0;
        let count = 0;

        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.paymentStatus === 'completed') {
            count++;
            total += Number(data.amount || 0);

            if (!data.isAnonymous) {
              records.push({
                id: doc.id,
                sponsorName: data.sponsorName || 'Kind Supporter',
                sponsorType: data.sponsorType || 'individual',
                amount: Number(data.amount || 0),
                currency: data.currency || 'GHS',
                tier: data.tier || 'Supporter',
                message: data.message,
                isAnonymous: false,
                createdAt: data.createdAt,
              });
            }
          }
        });

        setPublicSponsors(records);
        setTotalRaised(total);
        setSponsorCount(count);
      }, (err) => {
        console.warn('Could not load public sponsors feed (handled):', err);
      });

      return () => unsubscribe();
    } catch (e) {
      console.warn('Error setting up sponsorships listener:', e);
    }
  }, []);

  const activeAmount = isCustom ? Number(customAmount || 0) : selectedAmount;

  const determineTier = (amt: number): string => {
    if (amt >= 2500) return 'Executive Partner';
    if (amt >= 1000) return 'Platinum';
    if (amt >= 500) return 'Gold';
    if (amt >= 250) return 'Silver';
    if (amt >= 100) return 'Bronze';
    return 'Supporter';
  };

  const handleSelectPreset = (amount: number) => {
    setIsCustom(false);
    setSelectedAmount(amount);
  };

  const handleCustomInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9.]/g, '');
    setCustomAmount(val);
    setIsCustom(true);
  };

  const handleDonationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!sponsorName.trim()) {
      toast.error('Please provide your name or organization name.');
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      toast.error('Please provide a valid email address for your official receipt.');
      return;
    }

    if (!activeAmount || activeAmount <= 0) {
      toast.error('Please select or specify a valid sponsorship amount.');
      return;
    }

    if (paymentOption === 'bank_transfer') {
      // Record offline / pending bank wire sponsorship
      setIsSubmitting(true);
      try {
        const reference = generatePaystackReference('GREFAS-WIRE');
        const tier = determineTier(activeAmount);

        const newDoc = await addDoc(collection(db, 'sponsorships'), {
          sponsorType,
          sponsorName: sponsorName.trim(),
          contactPerson: contactPerson.trim() || null,
          email: email.trim().toLowerCase(),
          phone: phone.trim() || null,
          amount: activeAmount,
          currency: 'GHS',
          tier,
          message: message.trim() || null,
          isAnonymous,
          paymentMethod: 'Bank Wire / Direct Transfer',
          paymentStatus: 'pending',
          paymentReference: reference,
          thankYouSent: false,
          thankYouSentAt: null,
          createdAt: new Date().toISOString(),
          serverTimestamp: serverTimestamp(),
        });

        // Trigger notification
        fetch('/api/sponsorship/notify-new', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sponsorName: sponsorName.trim(),
            email: email.trim(),
            phone: phone.trim(),
            amount: activeAmount,
            currency: 'GHS',
            sponsorType,
            message: message.trim(),
            reference
          })
        }).catch(err => console.warn('Notification trigger non-blocking error:', err));

        setSuccessReceipt({
          id: newDoc.id,
          sponsorName,
          email,
          phone,
          amount: activeAmount,
          currency: 'GHS',
          tier,
          reference,
          paymentMethod: 'Direct Bank Deposit / Wire (Pending Verification)',
          isPendingBank: true
        });

        toast.success('Pledge Recorded!', {
          description: 'Thank you! Please complete the bank transfer using the instructions provided.',
          duration: 6000
        });
      } catch (err: any) {
        console.error('Failed to record bank pledge:', err);
        toast.error('Failed to submit sponsorship record. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Paystack Online Payment Flow (Mobile Money & Cards)
    setIsSubmitting(true);
    const reference = generatePaystackReference('GREFAS-SPONSOR');
    const tier = determineTier(activeAmount);

    try {
      await openPaystackModal({
        email: email.trim(),
        amount: activeAmount,
        currency: 'GHS',
        reference,
        channels: ['mobile_money', 'card', 'bank_transfer'],
        metadata: {
          sponsorName: sponsorName.trim(),
          sponsorType,
          contactPerson: contactPerson.trim() || undefined,
          phone: phone.trim() || undefined,
          tier,
          message: message.trim() || undefined,
          isAnonymous,
          purpose: 'Grefas Youth Talent & Production Sponsorship'
        },
        onSuccess: async (receipt: any) => {
          setIsSubmitting(true);
          try {
            const finalRef = receipt.reference || reference;
            const newDoc = await addDoc(collection(db, 'sponsorships'), {
              sponsorType,
              sponsorName: sponsorName.trim(),
              contactPerson: contactPerson.trim() || null,
              email: email.trim().toLowerCase(),
              phone: phone.trim() || null,
              amount: activeAmount,
              currency: 'GHS',
              tier,
              message: message.trim() || null,
              isAnonymous,
              paymentMethod: `Paystack (${receipt.channel || 'MoMo/Card'})`,
              paymentStatus: 'completed',
              paymentReference: finalRef,
              thankYouSent: false,
              thankYouSentAt: null,
              createdAt: new Date().toISOString(),
              serverTimestamp: serverTimestamp(),
            });

            // Also record in financial ledger if active
            try {
              await addDoc(collection(db, 'transactions'), {
                description: `Sponsorship donation from ${isAnonymous ? 'Anonymous' : sponsorName} (${tier})`,
                amount: activeAmount,
                type: 'credit',
                category: 'Sponsorship & Donations',
                ref: finalRef,
                recordedBy: 'system_paystack_gateway',
                createdAt: new Date().toISOString(),
              });
            } catch (ledgerErr) {
              console.warn('Optional ledger entry non-blocking error:', ledgerErr);
            }

            // Trigger email/SMS notification to donor and admin
            fetch('/api/sponsorship/notify-new', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sponsorName: sponsorName.trim(),
                email: email.trim(),
                phone: phone.trim(),
                amount: activeAmount,
                currency: 'GHS',
                sponsorType,
                message: message.trim(),
                reference: finalRef
              })
            }).catch(err => console.warn('Notification trigger non-blocking error:', err));

            setSuccessReceipt({
              id: newDoc.id,
              sponsorName,
              email,
              phone,
              amount: activeAmount,
              currency: 'GHS',
              tier,
              reference: finalRef,
              paymentMethod: `Paystack (${receipt.channel || 'Mobile Money / Card'})`,
              date: new Date().toLocaleDateString('en-GB')
            });

            toast.success('Sponsorship Contribution Received!', {
              description: `Thank you immensely, ${sponsorName}! Your support is creating immediate impact.`,
              duration: 8000
            });
          } catch (saveErr) {
            console.error('Error saving sponsorship record:', saveErr);
            toast.error('Payment succeeded, but recording failed. Please screenshot your reference: ' + reference);
          } finally {
            setIsSubmitting(false);
          }
        },
        onCancel: () => {
          setIsSubmitting(false);
          toast.info('Payment Window Closed', {
            description: 'You can complete your sponsorship anytime. We appreciate your consideration!'
          });
        }
      });
    } catch (err: any) {
      setIsSubmitting(false);
      console.error('Paystack initialization error:', err);
      toast.error('Could not initialize payment gateway. Please check your network or choose Bank Transfer.');
    }
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  const resetForm = () => {
    setSuccessReceipt(null);
    setSponsorName('');
    setContactPerson('');
    setEmail('');
    setPhone('');
    setMessage('');
    setCustomAmount('');
    setIsCustom(false);
    setSelectedAmount(250);
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <Helmet>
        <title>Sponsor Us & Donate | Grefas Consult & Entertainment</title>
        <meta 
          name="description" 
          content="Support budding young African actors, filmmakers, and creative innovators in Ghana. Sponsor Grefas Consult & Entertainment with any contribution amount." 
        />
        <meta property="og:title" content="Sponsor Us & Donate | Grefas Consult & Entertainment" />
        <meta property="og:description" content="Empowering the next generation of creative talents, film productions, and youth empowerment in Ghana." />
      </Helmet>

      {/* Hero Header */}
      <section className="relative overflow-hidden bg-gradient-to-b from-card to-background border-b border-border/40 py-16 lg:py-24">
        <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:32px_32px] pointer-events-none" />
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-orange-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-3xl mx-auto text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-400 text-xs font-bold tracking-wide uppercase">
              <HeartHandshake className="h-4 w-4" />
              <span>Community & Corporate Sponsorship</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-foreground leading-tight">
              Partner With Us to Fuel <span className="text-orange-600 dark:text-orange-500">Creative Youth Dreams</span>
            </h1>

            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
              Every donation and sponsorship directly empowers aspiring Ghanaian actors, filmmakers, skit creators, and community youth artists. Contribute any amount to help build vibrant African cinema and entertainment.
            </p>

            {/* Quick Metrics */}
            <div className="grid grid-cols-3 gap-3 pt-6 max-w-xl mx-auto">
              <div className="p-3.5 rounded-xl bg-card border border-border/60 text-center shadow-xs">
                <div className="text-2xl font-black text-orange-600">50+</div>
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mt-0.5">Talents Mentored</div>
              </div>
              <div className="p-3.5 rounded-xl bg-card border border-border/60 text-center shadow-xs">
                <div className="text-2xl font-black text-orange-600">20+</div>
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mt-0.5">Productions Shot</div>
              </div>
              <div className="p-3.5 rounded-xl bg-card border border-border/60 text-center shadow-xs">
                <div className="text-2xl font-black text-orange-600">100%</div>
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mt-0.5">Direct Impact</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Donation Form Column (7 Cols) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-sm">
              <div className="flex items-center justify-between border-b border-border/60 pb-5 mb-6">
                <div>
                  <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                    <Gift className="h-5 w-5 text-orange-600" />
                    <span>Make a Sponsorship Contribution</span>
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    Choose a sponsorship package or enter any custom donation amount.
                  </p>
                </div>

                <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border/40">
                  <button
                    type="button"
                    onClick={() => setSponsorType('individual')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      sponsorType === 'individual'
                        ? 'bg-card text-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <User className="h-3.5 w-3.5" />
                    <span>Individual</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSponsorType('organization')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      sponsorType === 'organization'
                        ? 'bg-card text-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Building2 className="h-3.5 w-3.5" />
                    <span>Organization</span>
                  </button>
                </div>
              </div>

              <form onSubmit={handleDonationSubmit} className="space-y-6">
                {/* 1. Select Amount */}
                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                    1. Select or Enter Amount (Ghanaian Cedis)
                  </label>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {PRESET_AMOUNTS.map((preset) => {
                      const isSelected = !isCustom && selectedAmount === preset.amount;
                      return (
                        <button
                          key={preset.amount}
                          type="button"
                          onClick={() => handleSelectPreset(preset.amount)}
                          className={`relative flex flex-col p-3 rounded-xl border text-left transition-all ${
                            isSelected
                              ? 'border-orange-600 bg-orange-500/10 text-orange-600 ring-2 ring-orange-500/20'
                              : 'border-border bg-muted/20 hover:bg-muted/50 text-foreground'
                          }`}
                        >
                          {preset.popular && (
                            <span className="absolute top-2 right-2 text-[9px] font-black uppercase tracking-wider bg-orange-600 text-white px-1.5 py-0.5 rounded-full">
                              Popular
                            </span>
                          )}
                          <span className="text-base font-black tracking-tight">{preset.label}</span>
                          <span className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{preset.tier}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom Amount Field */}
                  <div className="pt-2">
                    <label className="text-[11px] font-semibold text-muted-foreground mb-1.5 block">
                      Or donate any custom amount:
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground font-bold text-sm">
                        GH₵
                      </div>
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder="Enter any amount (e.g. 150, 750, 10000)"
                        value={customAmount}
                        onChange={handleCustomInput}
                        className={`pl-14 text-sm font-semibold h-11 ${isCustom ? 'border-orange-600 ring-1 ring-orange-500/30' : ''}`}
                      />
                    </div>
                  </div>

                  {/* Impact preview pill */}
                  <div className="p-3 rounded-xl bg-orange-500/5 border border-orange-500/15 flex items-start gap-2 text-xs text-orange-950 dark:text-orange-200">
                    <Sparkles className="h-4 w-4 shrink-0 text-orange-600 mt-0.5" />
                    <div>
                      <span className="font-bold">Your Impact: </span>
                      <span>
                        {isCustom && Number(customAmount) > 0
                          ? `Contributing GH₵ ${Number(customAmount).toLocaleString()} unlocks ${determineTier(Number(customAmount))} sponsorship honors & directly funds production kits for youth actors.`
                          : PRESET_AMOUNTS.find(p => p.amount === selectedAmount)?.impact}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. Sponsor Details */}
                <div className="space-y-4 pt-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                    2. Contributor Information
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-foreground mb-1 block">
                        {sponsorType === 'organization' ? 'Organization / Corporate Name *' : 'Full Name *'}
                      </label>
                      <Input
                        required
                        placeholder={sponsorType === 'organization' ? 'e.g. Nyinahin Youth Foundation' : 'e.g. Kwame Mensah'}
                        value={sponsorName}
                        onChange={(e) => setSponsorName(e.target.value)}
                        className="h-10 text-sm"
                      />
                    </div>

                    {sponsorType === 'organization' && (
                      <div>
                        <label className="text-xs font-semibold text-foreground mb-1 block">
                          Contact Representative
                        </label>
                        <Input
                          placeholder="e.g. Nana Yaw (Director)"
                          value={contactPerson}
                          onChange={(e) => setContactPerson(e.target.value)}
                          className="h-10 text-sm"
                        />
                      </div>
                    )}

                    <div>
                      <label className="text-xs font-semibold text-foreground mb-1 block">
                        Email Address (for Receipt) *
                      </label>
                      <Input
                        required
                        type="email"
                        placeholder="e.g. sponsor@domain.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-10 text-sm"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-foreground mb-1 block">
                        Phone / WhatsApp (for SMS confirmation)
                      </label>
                      <Input
                        type="tel"
                        placeholder="e.g. 054 123 4567"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="h-10 text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-foreground mb-1 block flex items-center justify-between">
                      <span>Message / Dedication (Optional)</span>
                      <span className="text-[11px] text-muted-foreground font-normal">Will appear on community wall</span>
                    </label>
                    <Textarea
                      placeholder="Write a message of encouragement to our young artists, skit makers, or youth community..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={2}
                      className="text-sm resize-none"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="anonCheck"
                      checked={isAnonymous}
                      onChange={(e) => setIsAnonymous(e.target.checked)}
                      className="h-4 w-4 rounded border-border text-orange-600 focus:ring-orange-500"
                    />
                    <label htmlFor="anonCheck" className="text-xs text-muted-foreground cursor-pointer select-none">
                      Keep my sponsorship anonymous on the public supporters roll
                    </label>
                  </div>
                </div>

                {/* 3. Payment Method Choice */}
                <div className="space-y-3 pt-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                    3. Payment Channel
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setPaymentOption('paystack')}
                      className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all ${
                        paymentOption === 'paystack'
                          ? 'border-orange-600 bg-orange-500/10 text-foreground ring-2 ring-orange-500/20'
                          : 'border-border bg-muted/20 hover:bg-muted/40 text-muted-foreground'
                      }`}
                    >
                      <Smartphone className="h-5 w-5 text-orange-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-sm font-bold text-foreground">Mobile Money & Cards</div>
                        <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                          Instant via Paystack (MTN MoMo, Telecel Cash, AT Money, Visa, Mastercard)
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentOption('bank_transfer')}
                      className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all ${
                        paymentOption === 'bank_transfer'
                          ? 'border-orange-600 bg-orange-500/10 text-foreground ring-2 ring-orange-500/20'
                          : 'border-border bg-muted/20 hover:bg-muted/40 text-muted-foreground'
                      }`}
                    >
                      <Landmark className="h-5 w-5 text-orange-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-sm font-bold text-foreground">Direct Bank Wire / Check</div>
                        <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                          For corporate entities, wire transfers, or physical check drop-offs
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Submit Action */}
                <div className="pt-4 border-t border-border">
                  <Button
                    type="submit"
                    disabled={isSubmitting || activeAmount <= 0}
                    className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold h-12 rounded-xl text-base shadow-md flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Securing Connection...</span>
                      </>
                    ) : (
                      <>
                        <Heart className="h-5 w-5 fill-white" />
                        <span>
                          Sponsor GH₵ {activeAmount ? activeAmount.toLocaleString() : '0'} Now
                        </span>
                      </>
                    )}
                  </Button>

                  <div className="flex items-center justify-center gap-4 text-[11px] text-muted-foreground mt-3">
                    <span className="flex items-center gap-1">
                      <Lock className="h-3 w-3 text-emerald-600" /> 256-Bit SSL Encrypted
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Instant Official Digital Receipt
                    </span>
                  </div>
                </div>
              </form>
            </div>
          </div>

          {/* Right Column: Why Sponsor, Bank Details & Community Wall (5 Cols) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Why Sponsor Us Card */}
            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Award className="h-4 w-4 text-orange-600" />
                <span>Why Sponsor Grefas Entertainment?</span>
              </h3>

              <ul className="space-y-3 text-xs text-muted-foreground leading-relaxed">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-orange-600 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-foreground">Grassroots Talent Empowerment:</strong> We discover and nurture raw creative talents in the Ashanti region and Ghana who lack institutional funding.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-orange-600 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-foreground">Impactful Storytelling:</strong> Our movie, skit, and comedy productions address social youth issues, cultural pride, and community development.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-orange-600 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-foreground">Corporate Visibility & CSR:</strong> Corporate partners receive prominent placement across YouTube, TikTok, premiere screens, and official media releases.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-orange-600 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-foreground">Transparent Stewardship:</strong> Every cedi is audited and accounted for with formal recognition certificates issued to all benefactors.
                  </span>
                </li>
              </ul>
            </div>

            {/* Direct Bank Deposit Info Accordion */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
              <button
                type="button"
                onClick={() => setShowDirectBankInfo(!showDirectBankInfo)}
                className="w-full flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-2">
                  <Landmark className="h-4 w-4 text-orange-600" />
                  <span className="text-xs font-bold text-foreground">Official Bank & Physical Office Details</span>
                </div>
                <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${showDirectBankInfo ? 'rotate-90' : ''}`} />
              </button>

              {showDirectBankInfo && (
                <div className="pt-4 mt-3 border-t border-border space-y-3 text-xs text-muted-foreground">
                  <div className="p-3 rounded-xl bg-muted/40 space-y-1.5">
                    <p className="font-semibold text-foreground">Bank Wire Transfer:</p>
                    <p><strong>Bank:</strong> GCB Bank / Stanbic Bank Ghana</p>
                    <p><strong>Account Name:</strong> Grefas Consult & Entertainment Ltd</p>
                    <p><strong>Account Number:</strong> 2041009876543</p>
                    <p><strong>Branch:</strong> Nkawie / Nyinahin Branch</p>
                  </div>

                  <div className="p-3 rounded-xl bg-muted/40 space-y-1.5">
                    <p className="font-semibold text-foreground">Physical Office (Walk-in & Check Drop-off):</p>
                    <p>Nyinahin-Ashanti, Ashanti Region, Ghana</p>
                    <p><strong>GPS Digital Address:</strong> AI-0008-9223</p>
                    <p><strong>Phone:</strong> +233 123 456 789 / +233 54 123 4567</p>
                  </div>
                </div>
              )}
            </div>

            {/* Community Supporters Wall */}
            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-orange-600" />
                  <h3 className="text-sm font-bold text-foreground">Recent Sponsors & Benefactors</h3>
                </div>
                <span className="text-[11px] font-semibold text-orange-600 bg-orange-500/10 px-2 py-0.5 rounded-full">
                  {publicSponsors.length} Recognized
                </span>
              </div>

              {publicSponsors.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground">
                  <Heart className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p>Be the very first to sponsor our creative division!</p>
                  <p className="mt-1 text-[11px]">Your kind contribution will appear right here.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                  {publicSponsors.map((record, idx) => (
                    <div
                      key={record.id || idx}
                      className="p-3 rounded-xl bg-muted/30 border border-border/50 space-y-1.5 text-xs transition-all hover:bg-muted/50"
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-bold text-foreground flex items-center gap-1.5">
                          {record.sponsorType === 'organization' ? (
                            <Building2 className="h-3.5 w-3.5 text-orange-600" />
                          ) : (
                            <User className="h-3.5 w-3.5 text-orange-600" />
                          )}
                          <span>{record.sponsorName}</span>
                        </div>
                        <span className="text-[10px] font-extrabold text-orange-600 bg-orange-500/10 px-2 py-0.5 rounded-md">
                          GH₵ {record.amount.toLocaleString()}
                        </span>
                      </div>

                      {record.message && (
                        <p className="text-[11px] text-muted-foreground italic flex items-start gap-1">
                          <MessageSquare className="h-3 w-3 shrink-0 mt-0.5 text-orange-600/70" />
                          <span>"{record.message}"</span>
                        </p>
                      )}

                      <div className="flex items-center justify-between text-[10px] text-muted-foreground/70 pt-0.5">
                        <span>Tier: {record.tier || 'Supporter'}</span>
                        <span>{record.createdAt ? new Date(record.createdAt).toLocaleDateString('en-GB') : 'Recent'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      </section>

      {/* Confirmation & Printable Receipt Modal */}
      <AnimatePresence>
        {successReceipt && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border border-border rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-5"
            >
              <div className="text-center space-y-2">
                <div className="h-14 w-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-black text-foreground">
                  {successReceipt.isPendingBank ? 'Sponsorship Pledge Recorded' : 'Heartfelt Gratitude!'}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Official Sponsorship Receipt & Certificate of Appreciation
                </p>
              </div>

              {/* Receipt Details Box */}
              <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-2.5 text-xs font-mono">
                <div className="flex justify-between border-b border-border/60 pb-2">
                  <span className="text-muted-foreground">Reference:</span>
                  <span className="font-bold text-foreground">{successReceipt.reference}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sponsor:</span>
                  <span className="font-bold text-foreground">{successReceipt.sponsorName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="font-bold text-orange-600 text-sm">
                    {successReceipt.currency} {Number(successReceipt.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sponsorship Tier:</span>
                  <span className="font-semibold text-foreground">{successReceipt.tier}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Payment Method:</span>
                  <span className="text-foreground">{successReceipt.paymentMethod}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Receipt Email:</span>
                  <span className="text-foreground">{successReceipt.email}</span>
                </div>
              </div>

              {successReceipt.isPendingBank && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-800 dark:text-amber-300">
                  <p className="font-bold">Next Steps for Bank Transfer:</p>
                  <p className="mt-1">
                    Please reference <strong>{successReceipt.reference}</strong> in your bank wire memo. Once credited, our admin will send an official thank you letter and tax acknowledgement.
                  </p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={handlePrintReceipt}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold h-10"
                >
                  <Printer className="h-4 w-4" />
                  <span>Print Receipt</span>
                </Button>
                <Button
                  onClick={resetForm}
                  className="flex-1 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold h-10"
                >
                  Done
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
