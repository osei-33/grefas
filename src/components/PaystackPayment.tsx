import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CreditCard, Smartphone, ShieldCheck, Lock, CheckCircle2, 
  AlertCircle, Loader2, ArrowRight, X, ExternalLink, RefreshCw, Check 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import PaystackPop from '@paystack/inline-js';
import { 
  generatePaystackReference, 
  initializePaystackPayment, 
  verifyPaystackPayment, 
  loadPaystackInlineScript,
  openPaystackModal
} from '@/lib/paystack';
import { usePaystack } from '@/providers/PaystackProvider';
import { toast } from 'sonner';

export interface PaystackPaymentProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number; // in GHS
  email: string;
  fullName: string;
  phone?: string;
  title: string;
  description?: string;
  metadata?: Record<string, any>;
  onSuccess: (paymentData: {
    reference: string;
    amount: number;
    channel: string;
    paidAt: string;
    gatewayResponse?: string;
  }) => void;
}

export default function PaystackPayment({
  isOpen,
  onClose,
  amount,
  email,
  fullName,
  phone = '',
  title,
  description,
  metadata = {},
  onSuccess,
}: PaystackPaymentProps) {
  const paystackContext = usePaystack();
  const [paymentChannel, setPaymentChannel] = useState<'mobile_money' | 'card'>('mobile_money');
  const [momoProvider, setMomoProvider] = useState<'MTN' | 'Telecel' | 'AT'>('MTN');
  const [momoNumber, setMomoNumber] = useState(phone || '');
  const [userEmail, setUserEmail] = useState(email || '');
  const [userName, setUserName] = useState(fullName || '');
  
  // Card states
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardName, setCardName] = useState(fullName || '');

  // Processing & verification states
  const [isProcessing, setIsProcessing] = useState(false);
  const [isVerifyingManual, setIsVerifyingManual] = useState(false);
  const [step, setStep] = useState<'details' | 'authorizing' | 'success' | 'failed'>('details');
  const [stepMessage, setStepMessage] = useState('Initializing Paystack Gateway...');
  const [activeReference, setActiveReference] = useState('');
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);

  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isOpen) {
      setUserEmail(email || '');
      setUserName(fullName || '');
      setMomoNumber(phone || '');
      setCardName(fullName || '');
      setStep('details');
      setIsProcessing(false);
      setIsVerifyingManual(false);
      setActiveReference('');
      setAuthUrl(null);
      setIsDemoMode(false);
      loadPaystackInlineScript();
    }
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [isOpen, email, fullName, phone]);

  // Handle successful verification
  const handlePaymentApproved = (ref: string, verifyData?: any) => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    setStep('success');
    setStepMessage('Payment verified and confirmed!');
    toast.success(`Paystack payment of GH₵ ${Number(amount).toFixed(2)} successful!`);

    setTimeout(() => {
      onSuccess({
        reference: ref,
        amount: Number(amount),
        channel: paymentChannel === 'mobile_money' ? `momo_${momoProvider.toLowerCase()}` : 'card',
        paidAt: verifyData?.paid_at || new Date().toISOString(),
        gatewayResponse: verifyData?.gateway_response || 'Approved',
      });
      onClose();
    }, 1200);
  };

  const handlePay = async () => {
    if (!userEmail || !userEmail.includes('@')) {
      toast.error('Please provide a valid email address for your payment receipt.');
      return;
    }

    if (paymentChannel === 'mobile_money') {
      if (!momoNumber.trim()) {
        toast.error('Please enter your Mobile Money phone number.');
        return;
      }
      if (!/^0[235][0-9]{8}$/.test(momoNumber.trim().replace(/\s+/g, ''))) {
        toast.error('Please enter a valid 10-digit Ghanaian mobile number starting with 0 (e.g. 0244123456).');
        return;
      }
    } else {
      if (!cardName.trim()) {
        toast.error('Please enter the name on the card.');
        return;
      }
    }

    setIsProcessing(true);
    setStep('authorizing');
    setStepMessage('Initializing transaction on Paystack gateway...');

    const ref = generatePaystackReference('GREFAS');
    setActiveReference(ref);

    try {
      const activePublicKey = paystackContext?.publicKey || 
                              ((import.meta as any).env?.VITE_PAYSTACK_PUBLIC_KEY as string) || 
                              '';

      // 1. Initialize with server proxy
      const initResult = await initializePaystackPayment({
        email: userEmail.trim(),
        amount: Number(amount),
        currency: 'GHS',
        reference: ref,
        metadata: {
          ...metadata,
          fullName: userName.trim() || fullName,
          phone: momoNumber.trim() || phone,
          channel: paymentChannel,
          momoProvider: paymentChannel === 'mobile_money' ? momoProvider : undefined,
          serviceTitle: title,
        },
        channels: paymentChannel === 'mobile_money' ? ['mobile_money'] : ['card'],
      });

      if (initResult.isDemo) {
        setIsDemoMode(true);
      }

      const returnedAuthUrl = initResult.data?.authorization_url;
      const returnedAccessCode = initResult.data?.access_code;

      if (returnedAuthUrl) {
        setAuthUrl(returnedAuthUrl);
      }

      // 2. Open inline popup modal with verified parameters
      const modalLaunch = await openPaystackModal({
        publicKey: activePublicKey,
        email: userEmail.trim(),
        amount: Number(amount),
        currency: 'GHS',
        reference: ref,
        access_code: returnedAccessCode,
        authorization_url: returnedAuthUrl,
        channels: paymentChannel === 'mobile_money' ? ['mobile_money'] : ['card'],
        metadata: {
          ...metadata,
          fullName: userName.trim() || fullName,
          phone: momoNumber.trim() || phone,
        },
        onSuccess: (resp) => {
          handlePaymentApproved(resp.reference || ref, resp);
        },
        onCancel: () => {
          setIsProcessing(false);
          setStep('details');
        }
      });

      setStepMessage(
        paymentChannel === 'mobile_money'
          ? `Authorization ready for ${momoProvider} (${momoNumber}). Complete prompt on your device.`
          : 'Card checkout ready. Complete payment authorization.'
      );

      // 3. Start polling for transaction status in the background
      let pollCount = 0;
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      pollTimerRef.current = setInterval(async () => {
        pollCount++;
        if (pollCount > 60) {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          return;
        }
        try {
          const checkRes = await verifyPaystackPayment(ref);
          if (checkRes.status && checkRes.data?.status === 'success') {
            handlePaymentApproved(ref, checkRes.data);
          }
        } catch (e) {
          // ignore transient poll errors
        }
      }, 3500);

    } catch (err: any) {
      console.error('Paystack transaction error:', err);
      setStep('failed');
      setStepMessage(err.message || 'Payment initialization failed. Please check connection and try again.');
      toast.error(err.message || 'Payment initialization failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManualCheckStatus = async () => {
    if (!activeReference) return;
    setIsVerifyingManual(true);
    try {
      const verifyResult = await verifyPaystackPayment(activeReference);
      if (verifyResult.status && verifyResult.data?.status === 'success') {
        handlePaymentApproved(activeReference, verifyResult.data);
      } else if (verifyResult.isDemo) {
        handlePaymentApproved(activeReference, verifyResult.data);
      } else {
        toast.info(verifyResult.message || 'Payment is still pending on Paystack. Please complete authorization.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Could not verify payment yet. Please ensure payment is authorized.');
    } finally {
      setIsVerifyingManual(false);
    }
  };

  const handleOpenPaystackDirect = () => {
    if (authUrl) {
      window.open(authUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isProcessing && !open && onClose()}>
      <DialogContent className="max-w-md w-full p-0 overflow-hidden bg-card border-border shadow-2xl rounded-2xl">
        {/* Header with Paystack official branding */}
        <div className="bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 p-5 text-white border-b-2 border-emerald-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center font-black text-emerald-400 text-sm">
                P
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-400">
                  Secured by Paystack
                </span>
                <h3 className="font-extrabold text-base leading-tight">Paystack Payment Gateway</h3>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">Total Amount</span>
              <span className="text-lg font-black text-white font-mono">
                GH₵ {Number(amount).toFixed(2)}
              </span>
            </div>
          </div>
          <p className="text-xs text-zinc-300 mt-2 truncate font-medium">
            {title}
          </p>
        </div>

        <div className="p-5 space-y-4">
          <AnimatePresence mode="wait">
            {step === 'details' && (
              <motion.div
                key="details"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-4"
              >
                {/* Channel Selection */}
                <div>
                  <label className="text-xs font-bold text-foreground mb-2 block">
                    Choose Payment Method
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentChannel('mobile_money')}
                      className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                        paymentChannel === 'mobile_money'
                          ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 font-bold shadow-sm'
                          : 'border-border bg-muted/20 hover:bg-muted/40 text-foreground font-medium'
                      }`}
                    >
                      <Smartphone className="h-4 w-4 text-emerald-600 shrink-0" />
                      <div>
                        <div className="text-xs font-bold">Mobile Money</div>
                        <div className="text-[10px] text-muted-foreground">MTN, Telecel, AT</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentChannel('card')}
                      className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                        paymentChannel === 'card'
                          ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 font-bold shadow-sm'
                          : 'border-border bg-muted/20 hover:bg-muted/40 text-foreground font-medium'
                      }`}
                    >
                      <CreditCard className="h-4 w-4 text-emerald-600 shrink-0" />
                      <div>
                        <div className="text-xs font-bold">Bank Card</div>
                        <div className="text-[10px] text-muted-foreground">Visa, Mastercard</div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Email address for receipts */}
                <div>
                  <label className="text-xs font-bold text-foreground mb-1 block">
                    Receipt Email Address <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="email"
                    placeholder="e.g. client@gmail.com"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    className="h-9 text-xs bg-muted/20 border-border"
                  />
                </div>

                {/* Mobile Money Details */}
                {paymentChannel === 'mobile_money' ? (
                  <div className="space-y-3 p-3.5 rounded-xl bg-muted/30 border border-border">
                    <div>
                      <label className="text-xs font-bold text-foreground mb-1.5 block">
                        Select MoMo Network
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['MTN', 'Telecel', 'AT'] as const).map((net) => (
                          <button
                            key={net}
                            type="button"
                            onClick={() => setMomoProvider(net)}
                            className={`py-2 px-2 text-xs font-bold rounded-lg border transition-all ${
                              momoProvider === net
                                ? 'bg-orange-600 text-white border-orange-600 shadow-sm'
                                : 'bg-card text-foreground border-border hover:bg-muted'
                            }`}
                          >
                            {net} {net === 'Telecel' ? 'Cash' : net === 'AT' ? 'Money' : 'MoMo'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-foreground mb-1 block">
                        {momoProvider} Phone Number <span className="text-red-500">*</span>
                      </label>
                      <Input
                        type="tel"
                        placeholder="024XXXXXXX / 050XXXXXXX"
                        value={momoNumber}
                        onChange={(e) => setMomoNumber(e.target.value)}
                        className="h-9 text-xs font-mono bg-card border-border"
                      />
                      <p className="text-[10px] text-muted-foreground mt-1">
                        You will authorize payment through Paystack's official secure gateway for {momoProvider}.
                      </p>
                    </div>
                  </div>
                ) : (
                  /* Bank Card Details */
                  <div className="space-y-3 p-3.5 rounded-xl bg-muted/30 border border-border">
                    <div>
                      <label className="text-xs font-bold text-foreground mb-1 block">
                        Cardholder Name <span className="text-red-500">*</span>
                      </label>
                      <Input
                        type="text"
                        placeholder="Full Name on Card"
                        value={cardName}
                        onChange={(e) => setCardName(e.target.value)}
                        className="h-9 text-xs bg-card border-border"
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Card credentials and 3D-Secure authentication are encrypted and handled directly by Paystack PCI-DSS certified gateway.
                    </p>
                  </div>
                )}

                {/* Security Trust Badges */}
                <div className="flex items-center justify-between px-2 text-[10px] text-muted-foreground border-t border-border/50 pt-2">
                  <span className="flex items-center gap-1">
                    <Lock className="h-3 w-3 text-emerald-600" /> 256-Bit SSL Encrypted
                  </span>
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3 text-emerald-600" /> PCI-DSS Certified
                  </span>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    className="w-1/3 text-xs h-10 border-border"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handlePay}
                    disabled={isProcessing}
                    className="w-2/3 text-xs font-bold h-10 bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    {isProcessing ? (
                      <span className="flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Connecting...</span>
                    ) : (
                      <>
                        <Lock className="h-3.5 w-3.5" /> Proceed to Paystack (GH₵ {Number(amount).toFixed(2)})
                      </>
                    )}
                  </Button>
                </div>
              </motion.div>
            )}

            {step === 'authorizing' && (
              <motion.div
                key="authorizing"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="py-6 text-center space-y-4"
              >
                <div className="relative mx-auto w-16 h-16 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20 animate-ping" />
                  <div className="w-16 h-16 rounded-full border-4 border-emerald-600 border-t-transparent animate-spin flex items-center justify-center">
                    <Smartphone className="h-6 w-6 text-emerald-600" />
                  </div>
                </div>

                <div>
                  <h4 className="font-extrabold text-foreground text-sm">
                    Paystack Payment Gateway Active
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                    {stepMessage}
                  </p>
                </div>

                {activeReference && (
                  <div className="bg-muted/40 p-2 rounded-lg text-[10px] font-mono text-muted-foreground max-w-xs mx-auto">
                    Reference: <span className="font-bold text-foreground">{activeReference}</span>
                  </div>
                )}

                <div className="space-y-2 pt-2 max-w-xs mx-auto">
                  {authUrl && (
                    <Button
                      type="button"
                      onClick={handleOpenPaystackDirect}
                      className="w-full text-xs font-bold h-10 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-sm"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Proceed to Paystack Checkout ↗
                    </Button>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleManualCheckStatus}
                    disabled={isVerifyingManual}
                    className="w-full text-xs h-9 gap-1.5 border-border"
                  >
                    {isVerifyingManual ? (
                      <span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Checking Gateway...</span>
                    ) : (
                      <>
                        <RefreshCw className="h-3 w-3" /> I Have Completed Payment (Verify)
                      </>
                    )}
                  </Button>

                  {isDemoMode && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => handlePaymentApproved(activeReference)}
                      className="w-full text-[11px] h-8 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                    >
                      Instant Sandbox Approve (Demo Mode)
                    </Button>
                  )}
                </div>

                <div className="text-[10px] text-muted-foreground flex items-center justify-center gap-1 pt-1">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  Auto-listening for Paystack confirmation...
                </div>
              </motion.div>
            )}

            {step === 'success' && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-8 text-center space-y-3"
              >
                <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <h4 className="text-base font-extrabold text-foreground">
                  Payment Completed & Verified!
                </h4>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                  Your transaction has been confirmed. An official payment receipt was sent to {userEmail}.
                </p>
                <div className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 p-2 rounded-lg inline-block">
                  Ref: {activeReference}
                </div>
              </motion.div>
            )}

            {step === 'failed' && (
              <motion.div
                key="failed"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-6 text-center space-y-4"
              >
                <div className="w-12 h-12 bg-red-100 dark:bg-red-950/40 text-red-600 rounded-full flex items-center justify-center mx-auto">
                  <AlertCircle className="h-7 w-7" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-foreground">
                    Payment Initialization Notice
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                    {stepMessage}
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep('details')}
                    className="text-xs h-9"
                  >
                    Change Payment Details
                  </Button>
                  <Button
                    type="button"
                    onClick={handlePay}
                    className="text-xs h-9 bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1"
                  >
                    <RefreshCw className="h-3 w-3" /> Retry Payment
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}

