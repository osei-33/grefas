import * as React from 'react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { format, isBefore, startOfToday, parseISO } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { db, auth, handleFirestoreError, OperationType } from '@/firebase';
import { collection, onSnapshot, setDoc, doc, serverTimestamp, getDoc, addDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, Calendar as CalendarIcon, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, User, Mail, Phone, Briefcase, Clock, ArrowRight, ArrowLeft, Check, HelpCircle } from 'lucide-react';
import { useLocation } from 'react-router-dom';

export default function Booking() {
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [bookedDates, setBookedDates] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [formData, setFormData] = useState({
    userName: '',
    userEmail: '',
    userPhone: '',
    notes: '',
    serviceId: '',
    serviceTitle: '',
    teamMemberId: '',
    teamMemberName: '',
    time: '09:00'
  });
  const [services, setServices] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');
  const location = useLocation();

  const [step, setStep] = useState(1);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const generateOrderNumber = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (user) {
        setFormData(prev => ({
          ...prev,
          userName: user.displayName || '',
          userEmail: user.email || ''
        }));
      }
    });

    // Fetch services for the dropdown
    const unsubscribeServices = onSnapshot(collection(db, 'services'), (snapshot) => {
      setServices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'services');
      } catch (e) {
        console.error("Error fetching services:", error);
      }
    });

    // Fetch existing bookings to count per day
    const unsubscribeBookings = onSnapshot(collection(db, 'bookings'), (snapshot) => {
      const counts: Record<string, number> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.date) {
          counts[data.date] = (counts[data.date] || 0) + 1;
        }
      });
      setBookedDates(counts);
      setLoading(false);
    }, (error) => {
      setLoading(false);
      try {
        handleFirestoreError(error, OperationType.LIST, 'bookings');
      } catch (e) {
        console.error("Error fetching bookings:", error);
      }
    });

    // Fetch team members/specialists for selection
    const unsubscribeTeam = onSnapshot(collection(db, 'team_members'), (snapshot) => {
      setTeamMembers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'team_members');
      } catch (e) {
        console.error("Error fetching team members:", error);
      }
    });

    return () => {
      unsubscribeAuth();
      unsubscribeServices();
      unsubscribeBookings();
      unsubscribeTeam();
    };
  }, []);

  // Parse query string for preferred staff selected on the Team page
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const staffId = params.get('staffId');
    const staffName = params.get('staffName');
    if (staffId && staffName) {
      setFormData(prev => ({
        ...prev,
        teamMemberId: staffId,
        teamMemberName: decodeURIComponent(staffName)
      }));
    }
  }, [location.search]);

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) {
      toast.error("Please select a date");
      return;
    }

    const dateStr = format(date, 'yyyy-MM-dd');
    
    // Check if day is full (limit 5)
    if ((bookedDates[dateStr] || 0) >= 5) {
      toast.error("This date is fully booked (max 5 bookings per day). Please choose another.");
      return;
    }

    setSubmitting(true);
    try {
      const newOrderNumber = generateOrderNumber();
      setOrderNumber(newOrderNumber);

      // Use addDoc to create a new booking with random ID
      await addDoc(collection(db, 'bookings'), {
        ...formData,
        orderNumber: newOrderNumber,
        date: dateStr,
        userId: user?.uid || 'anonymous',
        status: 'pending',
        createdAt: serverTimestamp()
      });

      // Create a notification for the user as a receipt
      if (user) {
        try {
          await addDoc(collection(db, 'notifications'), {
            userId: user.uid,
            title: 'Booking Received',
            orderNumber: newOrderNumber,
            message: `Your booking request (${newOrderNumber}) for ${formData.serviceTitle || 'General Consultation'} on ${dateStr} at ${formData.time} has been received.`,
            read: false,
            createdAt: serverTimestamp()
          });
        } catch (notifErr) {
          try {
            handleFirestoreError(notifErr, OperationType.CREATE, 'notifications');
          } catch (e) {}
        }
      }

      // Create a notification for the admins
      try {
        await addDoc(collection(db, 'notifications'), {
          userId: 'admin',
          title: 'New Booking Request',
          orderNumber: newOrderNumber,
          message: `A new booking request (${newOrderNumber}) for ${formData.serviceTitle || 'General Consultation'} on ${dateStr} at ${formData.time} has been submitted by ${formData.userName}.`,
          read: false,
          createdAt: serverTimestamp()
        });
      } catch (adminNotifErr) {
        try {
          handleFirestoreError(adminNotifErr, OperationType.CREATE, 'notifications');
        } catch (e) {
          console.error("Failed to notify admin in Firestore:", adminNotifErr);
        }
      }

      setShowSuccessDialog(true);
      setDate(undefined);
      setStep(1);
      setFormData({
        userName: user?.displayName || '',
        userEmail: user?.email || '',
        userPhone: '',
        notes: '',
        serviceId: '',
        serviceTitle: '',
        teamMemberId: '',
        teamMemberName: '',
        time: '09:00'
      });
    } catch (error: any) {
      try {
        handleFirestoreError(error, OperationType.WRITE, 'bookings');
      } catch (e) {
        toast.error("Failed to submit booking. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const validateStep2 = () => {
    if (!formData.userName.trim()) {
      toast.error("Please enter your name");
      return false;
    }
    if (!formData.userEmail.trim() || !formData.userEmail.includes('@')) {
      toast.error("Please enter a valid email address");
      return false;
    }
    if (!formData.serviceId) {
      toast.error("Please select a service interested in");
      return false;
    }
    return true;
  };

  const disabledDays = [
    ...Object.keys(bookedDates).filter(d => bookedDates[d] >= 5).map(d => parseISO(d)),
    { before: startOfToday() }
  ];

  const timeSlots = [
    "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"
  ];

  const faqs = [
    {
      q: "What is the 5-booking daily limit rule?",
      a: "At Grefas Consult & Entertainment, we hold a rigorous standard for consulting and creative show design. To ensure our personnel can provide exhaustive reviews, deep tactical alignment, and zero rushing during briefings, we cap our reservation desk strictly to 5 sessions per day. Select your dates in advance to guarantee your block."
    },
    {
      q: "How do I secure my preferred specialist for a consult or workshop?",
      a: "If you found a specialist in our Professional Directory / Team page, you can either click 'Message' inside their profile to query them instantly, or specify their name during the Step 2 'Requested Specialist' dropdown in this scheduling flow. When available, they are automatically pre-assigned to your briefing docket."
    },
    {
      q: "How can I reschedule or cancel my booking ticket?",
      a: "Once submitted, you receive a confirmation status on screen and via notification with a unique 6-character Alpha-Numeric Order Number (e.g., AD3K9P). To change dates or retract requests, just chat with us live on WhatsApp or reply to our status mail mentioning your order number. No fees apply for alignments adjusted 24h prior."
    },
    {
      q: "What types of services do Grefas consult desks manage?",
      a: "Our practices cover Corporate Strategy Advisory, Strategic Brand Scaling, and Live Production/Entertainment Showmanship. Whether aligning dynamic campaigns, hosting national performance schedules, or crafting executive blueprints, our specialists fuse professional advisory with top-tier stage delivery."
    },
    {
      q: "Is there any cost for making booking requests?",
      a: "Evaluating requests on our booking calendar and scheduling primary strategy alignments is free of charge. Full tactical setups, workshops, and entertainment stages are discussed, scoped out during your consult meeting, and finalized via standard milestone contracts."
    }
  ];

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
      </div>
    );
  }

  return (
    <div className="bg-background py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl"
          >
            Book Your Event
          </motion.h1>
            <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground"
          >
            Secure your date with Grefas Consult & Entertainment. We allow up to 5 bookings per day to ensure dedicated attention to each client.
          </motion.p>
        </div>

        {/* Step progress bar */}
        <div className="mx-auto max-w-3xl mb-12" id="booking-stepper">
          <div className="relative flex items-center justify-between">
            {/* Background line */}
            <div className="absolute left-0 top-1/2 h-0.5 w-full -translate-y-1/2 bg-muted-foreground/20" />
            {/* Active progress line */}
            <div 
              className="absolute left-0 top-1/2 h-0.5 -translate-y-1/2 bg-orange-600 transition-all duration-300" 
              style={{ width: `${((step - 1) / 2) * 100}%` }}
            />

            {[
              { num: 1, label: "Schedule", icon: CalendarIcon },
              { num: 2, label: "Information", icon: User },
              { num: 3, label: "Review & Book", icon: CheckCircle2 }
            ].map((s) => {
              const Icon = s.icon;
              const isCompleted = step > s.num;
              const isActive = step === s.num;
              return (
                <div key={s.num} className="relative z-10 flex flex-col items-center">
                  <button
                    type="button"
                    onClick={() => {
                      if (s.num === 1) setStep(1);
                      else if (s.num === 2 && date) setStep(2);
                      else if (s.num === 3 && date && formData.userName && formData.userEmail && formData.serviceId) setStep(3);
                    }}
                    disabled={
                      (s.num === 2 && !date) ||
                      (s.num === 3 && (!date || !formData.userName || !formData.userEmail || !formData.serviceId))
                    }
                    className={`flex h-10 w-10 items-center justify-center rounded-full border-2 font-bold transition-all duration-300 ${
                      isCompleted
                        ? "bg-orange-600 border-orange-600 text-white"
                        : isActive
                        ? "bg-background border-orange-600 text-orange-600 ring-4 ring-orange-100 dark:ring-orange-950/40"
                        : "bg-muted border-border text-muted-foreground cursor-not-allowed"
                    }`}
                  >
                    {isCompleted ? <Check className="h-5 w-5" /> : <span>{s.num}</span>}
                  </button>
                  <span className={`mt-2 text-xs font-semibold ${isActive ? "text-orange-600 font-bold" : isCompleted ? "text-foreground" : "text-muted-foreground"}`}>
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Form Steps Card Container */}
        <div className="mx-auto max-w-3xl">
          <Card className="border border-border/50 shadow-lg overflow-hidden bg-card">
            <CardHeader className="bg-orange-600 text-white relative">
              <div className="absolute top-4 right-4 bg-orange-700/60 backdrop-blur text-white border border-white/10 px-3 py-1 rounded-full text-xs font-bold font-mono">
                Step {step} of 3
              </div>
              <CardTitle className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
                {step === 1 && <><CalendarIcon className="h-6 w-6" /> Select Consultation Date</>}
                {step === 2 && <><User className="h-6 w-6" /> Professional Service Details</>}
                {step === 3 && <><CheckCircle2 className="h-6 w-6" /> Verify Your Selections</>}
              </CardTitle>
              <CardDescription className="text-orange-100 mt-1 max-w-xl">
                {step === 1 && "Choose an available date on the calendar, then select your preferred hourly time slot."}
                {step === 2 && "Provide your basic contact information, select the primary consulting area and request specialists."}
                {step === 3 && "Take a brief moment to confirm that your booking schedule and particulars are fully accurate."}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 sm:p-8 bg-card text-foreground">
              <AnimatePresence mode="wait">
                {step === 1 && (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="space-y-6"
                  >
                    <div className="flex flex-col items-center">
                      <Calendar
                        mode="single"
                        selected={date}
                        onSelect={setDate}
                        disabled={disabledDays}
                        modifiers={{ 
                          booked: Object.keys(bookedDates).map(d => parseISO(d)) 
                        }}
                        modifiersClassNames={{ 
                          booked: "ring-2 ring-orange-500 ring-offset-2" 
                        }}
                        className="rounded-xl border border-border shadow-md bg-card text-foreground p-3 animate-in fade-in"
                      />
                    </div>
                    
                    {date ? (
                      <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                        <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                          <Clock className="h-4 w-4 text-orange-600" /> Select Availability Slot
                        </label>
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                          {timeSlots.map(t => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setFormData({ ...formData, time: t })}
                              className={`rounded-xl border px-3 py-2.5 text-xs font-bold tracking-wide transition-all ${
                                formData.time === t
                                  ? 'bg-orange-600 border-orange-600 text-white shadow-md'
                                  : 'bg-muted/30 border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                              }`}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-6 px-4 border border-dashed rounded-xl border-border bg-muted/10 text-muted-foreground text-sm italic">
                        Please select an available date on the calendar above to unlock reservation hours.
                      </div>
                    )}

                    <div className="flex flex-wrap gap-x-6 gap-y-2 justify-center text-xs py-2 border-t border-border mt-4">
                      <div className="flex items-center gap-1.5 font-semibold">
                        <div className="h-3 w-3 rounded bg-orange-600" />
                        <span className="text-muted-foreground">Chosen Date</span>
                      </div>
                      <div className="flex items-center gap-1.5 font-semibold">
                        <div className="h-3 w-3 rounded-full ring-2 ring-orange-500 ring-offset-2" />
                        <span className="text-muted-foreground">Bookings Active</span>
                      </div>
                      <div className="flex items-center gap-1.5 font-semibold">
                        <div className="h-3 w-3 rounded bg-muted" />
                        <span className="text-muted-foreground">Fully Booked (5/5 Limits)</span>
                      </div>
                    </div>

                    <div className="flex justify-end pt-4 border-t border-border">
                      <Button
                        type="button"
                        disabled={!date}
                        onClick={() => setStep(2)}
                        className="bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl h-11 px-6 flex items-center gap-1.5 shadow-md active:scale-95 transition-all text-sm"
                      >
                        Continue to Information <ArrowRight className="h-4.5 w-4.5" />
                      </Button>
                    </div>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="space-y-5"
                  >
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Full Name *</label>
                        <Input
                          required
                          value={formData.userName}
                          onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
                          placeholder="Your complete name"
                          className="bg-muted/50 border-border h-11 rounded-xl font-medium"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Email Address *</label>
                        <Input
                          required
                          type="email"
                          value={formData.userEmail}
                          onChange={(e) => setFormData({ ...formData, userEmail: e.target.value })}
                          placeholder="primary@contact.com"
                          className="bg-muted/50 border-border h-11 rounded-xl font-medium"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Phone Number</label>
                        <Input
                          value={formData.userPhone}
                          onChange={(e) => setFormData({ ...formData, userPhone: e.target.value })}
                          placeholder="+233 ..."
                          className="bg-muted/50 border-border h-11 rounded-xl font-medium"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Services *</label>
                        <select
                          className="w-full h-11 rounded-xl border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-orange-600 font-medium"
                          value={formData.serviceId}
                          required
                          onChange={(e) => {
                            const s = services.find(s => s.id === e.target.value);
                            setFormData({ 
                              ...formData, 
                              serviceId: e.target.value,
                              serviceTitle: s?.title || ''
                            });
                          }}
                        >
                          <option value="" className="bg-card">Select a service category</option>
                          {services.map(s => (
                            <option key={s.id} value={s.id} className="bg-card">{s.title}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Requested Specialist (Optional)</label>
                      <select
                        className="w-full h-11 rounded-xl border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-orange-600 font-medium"
                        value={formData.teamMemberId}
                        onChange={(e) => {
                          const m = teamMembers.find(m => m.id === e.target.value);
                          setFormData({ 
                            ...formData, 
                            teamMemberId: e.target.value,
                            teamMemberName: m?.name || ''
                          });
                        }}
                      >
                        <option value="" className="bg-card">Primary available specialist (No preference)</option>
                        {teamMembers.map(m => (
                          <option key={m.id} value={m.id} className="bg-card">{m.name} — {m.role}</option>
                        ))}
                      </select>
                      {formData.teamMemberName && (
                        <p className="text-xs text-orange-600 font-bold flex items-center gap-1.5 mt-1.5 animate-in fade-in">
                          ★ Pre-assigned Preferred Expert: {formData.teamMemberName}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Additional Event / Consultation Notes</label>
                      <Textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        placeholder="Provide setup instructions, advisory goals, or details of corporate alignments..."
                        rows={4}
                        className="bg-muted/50 border-border rounded-xl resize-none text-sm leading-relaxed"
                      />
                    </div>

                    <div className="flex justify-between gap-4 pt-4 border-t border-border">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setStep(1)}
                        className="rounded-xl font-bold h-11 px-5 border-border hover:bg-muted text-muted-foreground flex items-center gap-1.5 text-sm"
                      >
                        <ArrowLeft className="h-4 w-4" /> Change Schedule
                      </Button>
                      <Button
                        type="button"
                        disabled={!formData.userName.trim() || !formData.userEmail.trim() || !formData.serviceId}
                        onClick={() => {
                          if (validateStep2()) {
                            setStep(3);
                          }
                        }}
                        className="bg-orange-600 hover:bg-orange-700 text-white font-bold h-11 px-6 rounded-xl flex items-center gap-1.5 shadow-md active:scale-95 transition-all text-sm"
                      >
                        Review Selections <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </motion.div>
                )}

                {step === 3 && (
                  <motion.div
                    key="step3"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="space-y-6"
                  >
                    <div className="rounded-2xl border border-border bg-muted/10 overflow-hidden divide-y divide-border">
                      <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <span className="text-[10px] font-black tracking-widest text-muted-foreground uppercase">Schedule Slot</span>
                          <p className="text-foreground font-extrabold flex items-center gap-1.5 mt-1">
                            <CalendarIcon className="h-4.5 w-4.5 text-orange-600" /> {date ? format(date, 'PPPP') : ''}
                          </p>
                          <p className="text-muted-foreground font-bold flex items-center gap-1.5 mt-1 text-xs pl-6">
                            <Clock className="h-3.5 w-3.5 text-orange-600" /> {formData.time} (UTC Local Time)
                          </p>
                        </div>
                        <div>
                          <span className="text-[10px] font-black tracking-widest text-muted-foreground uppercase">Service Category</span>
                          <p className="text-foreground font-extrabold flex items-center gap-1.5 mt-1">
                            <Briefcase className="h-4.5 w-4.5 text-orange-600" /> {formData.serviceTitle || 'General Consultation'}
                          </p>
                          {formData.teamMemberName && (
                            <p className="text-orange-600 font-extrabold text-xs mt-1 pl-6 flex items-center gap-1">
                              ★ Specialist: {formData.teamMemberName}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <span className="text-[10px] font-black tracking-widest text-muted-foreground uppercase">Contact Name</span>
                          <p className="text-foreground font-extrabold flex items-center gap-1.5 mt-1">
                            <User className="h-4.5 w-4.5 text-orange-600" /> {formData.userName}
                          </p>
                        </div>
                        <div>
                          <span className="text-[10px] font-black tracking-widest text-muted-foreground uppercase">Email & Phone</span>
                          <p className="text-foreground font-semibold flex items-center gap-1.5 mt-1">
                            <Mail className="h-4.5 w-4.5 text-muted-foreground" /> {formData.userEmail}
                          </p>
                          {formData.userPhone && (
                            <p className="text-muted-foreground text-sm font-semibold flex items-center gap-1.5 mt-1 pl-6">
                              <Phone className="h-3.5 w-3.5 text-muted-foreground" /> {formData.userPhone}
                            </p>
                          )}
                        </div>
                      </div>

                      {formData.notes && (
                        <div className="p-5">
                          <span className="text-[10px] font-black tracking-widest text-muted-foreground uppercase">Additional Details</span>
                          <p className="text-foreground mt-1.5 text-sm bg-muted/40 p-4 rounded-xl border border-border/40 italic leading-relaxed">
                            "{formData.notes}"
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="rounded-xl border border-orange-200/50 dark:border-orange-950/40 bg-orange-500/5 p-4 flex gap-3 items-start text-xs font-semibold text-orange-850 dark:text-orange-400">
                      <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
                      <p className="leading-relaxed">
                        By submitting this request, you secure this block on our schedule. Due to our strictly kept 5-bookings limit per day rule, our consult desk will lock this slot and evaluate the alignment within normal review cycles.
                      </p>
                    </div>

                    <div className="flex justify-between gap-4 pt-4 border-t border-border">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setStep(2)}
                        className="rounded-xl font-bold h-11 px-5 border-border hover:bg-muted text-muted-foreground flex items-center gap-1.5 text-sm"
                      >
                        <ArrowLeft className="h-4 w-4" /> Edit Details
                      </Button>
                      <Button
                        type="button"
                        onClick={handleBooking}
                        disabled={submitting}
                        className="bg-orange-600 hover:bg-orange-700 text-white font-bold h-11 px-6 rounded-xl flex-1 justify-center flex items-center gap-1.5 shadow-md active:scale-95 transition-all text-sm"
                      >
                        {submitting ? (
                          <span className="flex items-center gap-1.5 justify-center"><Loader2 className="h-5 w-5 animate-spin" /> Transmitting Booking...</span>
                        ) : (
                          <>Confirm & Request Booking <Check className="h-4.5 w-4.5" /></>
                        )}
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>

          <div className="mt-8 rounded-2xl bg-orange-50 dark:bg-orange-950/10 p-6 border border-orange-100 dark:border-orange-950/20">
            <h4 className="flex items-center gap-2 font-bold text-orange-900 dark:text-orange-400">
              <CheckCircle2 className="h-5 w-5 text-orange-600 animate-pulse" /> Why Book With Grefas?
            </h4>
            <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-orange-800 dark:text-orange-300 font-medium">
              <li className="flex items-start gap-1.5">• <span><span className="font-semibold text-orange-950 dark:text-orange-200">Focused Attention:</span> Max 5 bookings daily guarantees elite custom review.</span></li>
              <li className="flex items-start gap-1.5">• <span><span className="font-semibold text-orange-950 dark:text-orange-200">Integrated Expertise:</span> Merges corporate advising and stagecraft.</span></li>
              <li className="flex items-start gap-1.5">• <span><span className="font-semibold text-orange-950 dark:text-orange-200">Direct Communication:</span> Transparent channels via email & Live WhatsApp.</span></li>
              <li className="flex items-start gap-1.5">• <span><span className="font-semibold text-orange-950 dark:text-orange-200">Professional Personnel:</span> Pick specialized partners for precise milestones.</span></li>
            </ul>
          </div>
        </div>

        {/* FAQ Accordion Section */}
        <div className="mx-auto max-w-3xl mt-20 border-t border-border pt-16">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center justify-center gap-2">
              <HelpCircle className="h-7 w-7 text-orange-600" /> Booking & Services FAQ
            </h2>
            <p className="text-muted-foreground text-sm mt-3 max-w-lg mx-auto">
              Got auxiliary questions about booking slots, specialist allocations, or campaign scopes? Review standard procedural details here.
            </p>
          </div>

          <div className="space-y-4 font-medium" id="faq-accordion-group">
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div 
                  key={idx} 
                  className="border border-border/60 rounded-xl bg-card overflow-hidden transition-all hover:border-orange-500/30"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full flex items-center justify-between p-5 text-left font-bold text-foreground text-sm sm:text-base hover:text-orange-600 transition-colors"
                  >
                    <span>{faq.q}</span>
                    <span className="ml-4 flex-shrink-0 text-orange-600">
                      {isOpen ? (
                        <ChevronUp className="h-5 w-5" />
                      ) : (
                        <ChevronDown className="h-5 w-5" />
                      )}
                    </span>
                  </button>
                  
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: "easeInOut" }}
                      >
                        <div className="p-5 pt-0 border-t border-border/40 text-sm text-muted-foreground leading-relaxed">
                          {faq.a}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader className="flex flex-col items-center">
            <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center mb-4">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <DialogTitle className="text-2xl font-bold text-foreground">Booking Confirmed!</DialogTitle>
            <DialogDescription className="text-center text-muted-foreground pt-2">
              We've received your request and will get back to you shortly.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center space-y-4 py-4">
            <div className="bg-orange-600/10 border border-orange-600/20 rounded-lg p-6 w-full text-center">
              <span className="text-xs uppercase tracking-widest text-muted-foreground font-black">Your Order Number</span>
              <div className="text-4xl font-black text-orange-600 tracking-widest mt-1">
                {orderNumber}
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground text-center uppercase tracking-widest font-bold">
              Please save this number for reference
            </p>
          </div>
          <div className="flex justify-center">
            <Button 
              onClick={() => setShowSuccessDialog(false)}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
