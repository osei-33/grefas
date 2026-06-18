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
import { collection, onSnapshot, setDoc, doc, serverTimestamp, getDoc, addDoc, query, where, getDocs } from 'firebase/firestore';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, Calendar as CalendarIcon, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, User, Mail, Phone, Briefcase, Clock, ArrowRight, ArrowLeft, Check, HelpCircle, Search, Copy, Printer } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import SEO from '@/components/SEO';
import { showBrowserNotification } from '@/lib/utils';
import AppointmentCountdown from '@/components/AppointmentCountdown';

const convertAccraTimeToUserTimezone = (accraTimeStr: string, targetTimezone: string) => {
  try {
    const [hours, minutes] = accraTimeStr.split(':').map(Number);
    const now = new Date();
    const accraUtcDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes));
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: targetTimezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    return formatter.format(accraUtcDate);
  } catch (e) {
    return accraTimeStr;
  }
};

export default function Booking() {
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [bookedDates, setBookedDates] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [timezone, setTimezone] = useState<string>(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Accra';
    } catch (e) {
      return 'Africa/Accra';
    }
  });
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
  const [copied, setCopied] = useState(false);
  const location = useLocation();

  const handleCopyOrderNumber = () => {
    if (!orderNumber) return;
    navigator.clipboard.writeText(orderNumber);
    setCopied(true);
    toast.success("Order number copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const [activeTab, setActiveTab] = useState<'book' | 'status'>('book');
  const [statusSearchQuery, setStatusSearchQuery] = useState('');
  const [statusSearchResult, setStatusSearchResult] = useState<any>(null);
  const [isSearchingStatus, setIsSearchingStatus] = useState(false);
  const [hasSearchedStatus, setHasSearchedStatus] = useState(false);
  const [clientBookings, setClientBookings] = useState<any[]>([]);
  const [loadingClientBookings, setLoadingClientBookings] = useState(false);

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

  // Parse query string for preferred staff selected on the Team page or status checking
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const staffId = params.get('staffId');
    const staffName = params.get('staffName');
    const urlOrderNumber = params.get('orderNumber');
    
    if (staffId && staffName) {
      setFormData(prev => ({
        ...prev,
        teamMemberId: staffId,
        teamMemberName: decodeURIComponent(staffName)
      }));
    }
    
    if (urlOrderNumber) {
      setActiveTab('status');
      setStatusSearchQuery(urlOrderNumber.toUpperCase());
      
      const performAutoSearch = async () => {
        setIsSearchingStatus(true);
        setHasSearchedStatus(true);
        try {
          const q = query(collection(db, 'bookings'), where('orderNumber', '==', urlOrderNumber.toUpperCase()));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const docSnap = querySnapshot.docs[0];
            setStatusSearchResult({ id: docSnap.id, ...docSnap.data() });
          }
        } catch (err) {
          console.error("Auto search error:", err);
        } finally {
          setIsSearchingStatus(false);
        }
      };
      performAutoSearch();
    }
  }, [location.search]);

  // Real-time listener for automated client-side bookings list tracking
  useEffect(() => {
    if (!user) {
      setClientBookings([]);
      return;
    }

    setLoadingClientBookings(true);
    
    // Multi-criteria real-time syncing (query UID matching, fallback to email query merge)
    const qUid = query(collection(db, 'bookings'), where('userId', '==', user.uid));
    
    const unsubscribeUid = onSnapshot(qUid, (snapshot) => {
      const uidBookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      if (user.email) {
        const qEmail = query(collection(db, 'bookings'), where('userEmail', '==', user.email));
        getDocs(qEmail).then((emailSnap) => {
          const emailBookings = emailSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          
          // Deduplicate on unique Firestore document ids
          const merged = [...uidBookings];
          emailBookings.forEach(eb => {
            if (!merged.some(mb => mb.id === eb.id)) {
              merged.push(eb);
            }
          });
          
          // Sort by schedule date descending, then time descending
          merged.sort((a: any, b: any) => {
            const dateA = a.date || '';
            const dateB = b.date || '';
            if (dateA !== dateB) return dateB.localeCompare(dateA);
            return (b.time || '').localeCompare(a.time || '');
          });
          
          setClientBookings(merged);
          setLoadingClientBookings(false);
        }).catch(err => {
          console.error("Dynamic email-based merge queries failed:", err);
          setClientBookings(uidBookings);
          setLoadingClientBookings(false);
        });
      } else {
        setClientBookings(uidBookings);
        setLoadingClientBookings(false);
      }
    }, (error) => {
      console.error("Realtime database link failed:", error);
      setLoadingClientBookings(false);
    });

    return () => {
      unsubscribeUid();
    };
  }, [user]);

  const handleGoogleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      toast.success("Successfully signed in! Your previous bookings have loaded automatically below.");
    } catch (error) {
      console.error("Status check authentication failure:", error);
      toast.error("Failed to sign in securely. Please try again.");
    }
  };

  const handleCheckStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    const queryStr = statusSearchQuery.trim().toUpperCase();
    if (!queryStr) {
      toast.error("Please enter a valid order number");
      return;
    }

    setIsSearchingStatus(true);
    setHasSearchedStatus(true);
    setStatusSearchResult(null);

    try {
      const q = query(collection(db, 'bookings'), where('orderNumber', '==', queryStr));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const docSnap = querySnapshot.docs[0];
        setStatusSearchResult({ id: docSnap.id, ...docSnap.data() });
        toast.success("Appointment found successfully!");
      } else {
        toast.error("No appointment matches this order number");
      }
    } catch (error) {
      console.error("Error looking up booking status:", error);
      try {
        handleFirestoreError(error, OperationType.GET, `bookings/query?orderNumber=${queryStr}`);
      } catch (e) {
        toast.error("Could not complete lookup. Please try again.");
      }
    } finally {
      setIsSearchingStatus(false);
    }
  };

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
        clientTimezone: timezone,
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

      // Trigger browser-based toast notification
      toast.success("Booking Submitted Successfully!", {
        description: `Reference: ${newOrderNumber} for ${formData.serviceTitle || 'General Consultation'} on ${dateStr} at ${formData.time}.`,
        duration: 8000,
      });

      // Trigger browser native system notification
      showBrowserNotification(
        'Booking Confirmed - Grefas',
        `Ref: ${newOrderNumber}. Your booking for ${formData.serviceTitle || 'General Consultation'} on ${dateStr} at ${formData.time} has been received!`,
        '/favicon.ico'
      );

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
      <SEO 
        title="Book Appointment"
        description="Book local Grefas advisory sessions or world-class entertainment packages. Schedule consulting times and check real-time availability in Nyinahin-Ashanti, Ghana."
        keywords="book Grefas, event booking Ghana, schedule consultation Ashanti Region, real-time appointments"
      />
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

        {/* Tabs for switching between Appointment Booking and Appointment Status Lookup */}
        <div className="flex justify-center mb-12 animate-in fade-in duration-300">
          <div className="inline-flex rounded-xl p-1 bg-muted border border-border">
            <button
              onClick={() => setActiveTab('book')}
              className={`rounded-lg px-6 py-2.5 text-sm font-bold tracking-wide transition-all duration-200 flex items-center gap-2 ${
                activeTab === 'book'
                  ? 'bg-orange-600 text-white shadow-md'
                  : 'text-muted-foreground hover:text-foreground hover:bg-card/40'
              }`}
            >
              <CalendarIcon className="h-4 w-4" />
              Schedule Appointment
            </button>
            <button
              onClick={() => {
                setActiveTab('status');
                setStatusSearchResult(null);
                setHasSearchedStatus(false);
              }}
              className={`rounded-lg px-6 py-2.5 text-sm font-bold tracking-wide transition-all duration-200 flex items-center gap-2 ${
                activeTab === 'status'
                  ? 'bg-orange-600 text-white shadow-md'
                  : 'text-muted-foreground hover:text-foreground hover:bg-card/40'
              }`}
            >
              <Search className="h-4 w-4" />
              Check Appointment Status
            </button>
          </div>
        </div>

        {activeTab === 'book' ? (
          <>
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
                        <div className="flex flex-col items-center w-full overflow-x-auto pb-1">
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
                            className="rounded-xl border border-border shadow-md bg-card text-foreground p-3 animate-in fade-in max-w-full"
                          />
                        </div>
                        
                        {date ? (
                          <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3.5 rounded-xl border border-border bg-muted/20">
                              <div className="space-y-0.5">
                                <span className="text-xs font-bold text-foreground">Timezone Customizer</span>
                                <p className="text-[10px] text-muted-foreground">Display consultation hours in your precise regional zone.</p>
                              </div>
                              <select
                                className="h-9 text-xs rounded-lg border border-border bg-card px-2.5 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-orange-600 font-semibold max-w-full sm:max-w-[200px]"
                                value={timezone}
                                onChange={(e) => setTimezone(e.target.value)}
                              >
                                <option value="Africa/Accra">Accra (GMT / UTC+0)</option>
                                <option value="America/New_York">New York (Eastern / ET)</option>
                                <option value="America/Chicago">Chicago (Central / CT)</option>
                                <option value="America/Denver">Denver (Mountain / MT)</option>
                                <option value="America/Los_Angeles">Los Angeles (Pacific / PT)</option>
                                <option value="Europe/London">London (GMT/BST / UTC+1)</option>
                                <option value="Europe/Paris">Paris (CET / UTC+1)</option>
                                <option value="Asia/Dubai">Dubai (GST / UTC+4)</option>
                                <option value="Asia/Tokyo">Tokyo (JST / UTC+9)</option>
                                <option value="Australia/Sydney">Sydney (AEST / UTC+10)</option>
                                <option value="UTC">Universal Time (UTC)</option>
                              </select>
                            </div>

                            <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                              <Clock className="h-4 w-4 text-orange-600" /> Select Availability Slot
                            </label>
                            
                            <div className="grid grid-cols-2 min-[420px]:grid-cols-3 sm:grid-cols-4 gap-2">
                              {timeSlots.map(t => {
                                const hasTzone = timezone !== 'Africa/Accra';
                                return (
                                  <button
                                    key={t}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, time: t })}
                                    className={`rounded-xl border p-2.5 text-xs font-bold tracking-wide transition-all ${
                                      formData.time === t
                                        ? 'bg-orange-600 border-orange-600 text-white shadow-md'
                                        : 'bg-muted/30 border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                                    }`}
                                  >
                                    <div className="font-mono text-sm">{t}</div>
                                    {hasTzone && (
                                      <div className={`text-[9px] mt-0.5 font-normal ${formData.time === t ? 'text-orange-200' : 'text-muted-foreground/80'}`}>
                                        {convertAccraTimeToUserTimezone(t, timezone)}
                                      </div>
                                    )}
                                  </button>
                                );
                              })}
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
                              <p className="text-muted-foreground font-bold flex flex-col gap-0.5 mt-1 text-xs pl-6">
                                <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-orange-600" /> {formData.time} (UTC / Accra)</span>
                                {timezone !== 'Africa/Accra' && (
                                  <span className="text-orange-600 font-extrabold pl-5">
                                    → {convertAccraTimeToUserTimezone(formData.time, timezone)} ({timezone})
                                  </span>
                                )}
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
          </>
        ) : (
          <div className="mx-auto max-w-3xl">
            <Card className="border border-border/50 shadow-lg overflow-hidden bg-card">
              <CardHeader className="bg-zinc-900 text-white dark:bg-zinc-950 p-6 sm:p-8">
                <CardTitle className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
                  <Search className="h-6 w-6 text-orange-500" />
                  Appointment Status Lookup
                </CardTitle>
                <CardDescription className="text-zinc-300 mt-1 max-w-xl">
                  Retrieve real-time booking updates, specialist assignments, and approved scheduling blocks.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 sm:p-8 space-y-6 bg-card text-foreground">
                {user ? (
                  <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="border border-border/55 rounded-2xl p-5 bg-muted/20">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-4 mb-4">
                        <div>
                          <h3 className="font-extrabold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                            <Briefcase className="h-4.5 w-4.5 text-orange-600" />
                            My Registered Bookings ({clientBookings.length})
                          </h3>
                          <p className="text-xs text-muted-foreground font-semibold mt-1">
                            Logged in as <span className="text-orange-600 font-extrabold">{user.email || 'Anonymous User'}</span>
                          </p>
                        </div>
                        <Button 
                          variant="outline" 
                          size="xs" 
                          onClick={() => auth.signOut()}
                          className="font-bold border-border/80 text-foreground transition-all active:scale-95"
                        >
                          Sign Out
                        </Button>
                      </div>

                      {loadingClientBookings ? (
                        <div className="flex items-center justify-center py-8 gap-2">
                          <Loader2 className="h-5 w-5 animate-spin text-orange-600" />
                          <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Syncing historical receipts...</span>
                        </div>
                      ) : clientBookings.length === 0 ? (
                        <div className="py-8 text-center space-y-3">
                          <AlertCircle className="h-6 w-6 text-muted-foreground mx-auto" />
                          <p className="text-xs font-bold uppercase text-muted-foreground tracking-wide">No registered bookings found</p>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => setActiveTab('book')}
                            className="bg-orange-600/10 text-orange-600 border-orange-600/30 font-bold hover:bg-orange-600/20"
                          >
                            Schedule Consultation Slot
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2.5 max-h-76 overflow-y-auto pr-1">
                          {clientBookings.map((b) => {
                            const isSelected = statusSearchResult?.id === b.id;
                            return (
                              <div 
                                key={b.id}
                                onClick={() => {
                                  setStatusSearchResult(b);
                                  setHasSearchedStatus(true);
                                  setStatusSearchQuery(b.orderNumber || '');
                                }}
                                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                                  isSelected 
                                    ? 'bg-orange-600/[0.08] border-orange-600/50 shadow-xs' 
                                    : 'bg-card hover:bg-muted/45 border-border/60'
                                }`}
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-mono text-xs font-black text-orange-600 dark:text-orange-400 bg-orange-600/10 px-2 py-0.5 rounded">
                                      #{b.orderNumber}
                                    </span>
                                    <span className="text-xs font-extrabold text-foreground">
                                      {b.serviceTitle || 'General Consultation'}
                                    </span>
                                  </div>
                                  <p className="text-xs text-muted-foreground font-semibold flex items-center gap-1.5 pt-0.5">
                                    <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" /> {b.date} @ {b.time} (UTC)
                                  </p>
                                </div>
                                <div className="flex items-center gap-3 justify-between sm:justify-end">
                                  {b.status === 'confirmed' || b.status === 'approved' ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide bg-green-500/15 text-green-600 border border-green-500/20">
                                      Approved
                                    </span>
                                  ) : b.status === 'cancelled' ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide bg-red-500/15 text-red-600 border border-red-500/20">
                                      Cancelled
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide bg-amber-500/15 text-amber-600 border border-amber-500/20">
                                      Pending
                                    </span>
                                  )}
                                  <Button 
                                    size="xs" 
                                    variant="ghost" 
                                    className="text-xs text-orange-600 font-bold hover:text-orange-700 bg-transparent hover:bg-transparent p-0 flex items-center gap-1"
                                  >
                                    Track <ArrowRight className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="relative flex py-2 items-center">
                      <div className="flex-grow border-t border-border/40"></div>
                      <span className="flex-shrink mx-4 text-[10px] text-muted-foreground font-black uppercase tracking-widest bg-card px-2">Or Look Up By Code Manually</span>
                      <div className="flex-grow border-t border-border/40"></div>
                    </div>
                  </div>
                ) : (
                  <div className="p-5 border border-orange-500/15 bg-orange-650/[0.03] rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-5 animate-in fade-in duration-350">
                    <div className="space-y-1.5 text-center sm:text-left">
                      <h4 className="font-extrabold text-sm text-foreground flex items-center justify-center sm:justify-start gap-1.5">
                        <User className="h-4 w-4 text-orange-600" />
                        Automated Booking Status Control!
                      </h4>
                      <p className="text-xs text-muted-foreground font-semibold max-w-md leading-relaxed">
                        Sign in with Google to sync all consultation schedules and track confirmations in real-time on your private client status dashboard.
                      </p>
                    </div>
                    <Button 
                      onClick={handleGoogleSignIn}
                      className="bg-zinc-950 dark:bg-zinc-900 border border-zinc-900 dark:border-zinc-800 text-white hover:bg-zinc-800 font-bold px-4 h-10 rounded-xl flex items-center gap-2 flex-shrink-0 text-xs w-full sm:w-auto justify-center transition-all active:scale-95"
                    >
                      <img src="https://www.google.com/images/branding/googleg/1x/googleg_standard_color_128dp.png" alt="Google Logo" className="h-4.5 w-4.5 bg-white p-0.5 rounded-full" />
                      Sign in with Google
                    </Button>
                  </div>
                )}

                <form onSubmit={handleCheckStatus} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider block">
                      Enter Unique 6-Digit Order Number
                    </label>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Input
                        value={statusSearchQuery}
                        onChange={(e) => setStatusSearchQuery(e.target.value.toUpperCase())}
                        placeholder="E.g., KX3R7V"
                        maxLength={6}
                        required
                        className="text-lg font-mono font-bold tracking-widest uppercase bg-muted/50 border-border h-12 rounded-xl text-center flex-1"
                      />
                      <Button
                        type="submit"
                        disabled={isSearchingStatus}
                        className="bg-orange-600 hover:bg-orange-700 text-white font-bold px-6 h-12 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all w-full sm:w-auto"
                      >
                        {isSearchingStatus ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <>Search Status</>
                        )}
                      </Button>
                    </div>
                  </div>
                </form>

                <AnimatePresence mode="wait">
                  {isSearchingStatus && (
                    <motion.div
                      key="searching"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col items-center justify-center py-12"
                    >
                      <Loader2 className="h-8 w-8 animate-spin text-orange-600 animate-duration-1000" />
                      <p className="text-sm mt-3 text-muted-foreground font-semibold">Scanning strategic planning desk registers...</p>
                    </motion.div>
                  )}

                  {!isSearchingStatus && hasSearchedStatus && statusSearchResult && (
                    <motion.div
                      key="result"
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="border border-border/80 rounded-2xl overflow-hidden shadow bg-muted/5 animate-in fade-in"
                    >
                      {/* Booking Header Status Block */}
                      <div className="p-5 border-b border-border bg-muted/30 dark:bg-muted/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">TICKET ID / ORDER NUMBER</p>
                          <p className="text-2xl font-mono font-black text-foreground tracking-wider mt-0.5">{statusSearchResult.orderNumber}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status:</span>
                          {statusSearchResult.status === 'confirmed' || statusSearchResult.status === 'approved' ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold leading-none bg-green-500/10 text-green-600 border border-green-500/20">
                              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" /> Approved & Confirmed
                            </span>
                          ) : statusSearchResult.status === 'cancelled' ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold leading-none bg-red-500/10 text-red-600 border border-red-500/20">
                              <span className="h-2 w-2 rounded-full bg-red-500" /> Cancelled
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold leading-none bg-amber-500/10 text-amber-600 border border-amber-500/20">
                              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" /> Pending Review
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Dynamic Appointment Countdown */}
                      {statusSearchResult.status !== 'cancelled' && statusSearchResult.date && statusSearchResult.time && (
                        <div className="px-6 pt-6 bg-card">
                          <AppointmentCountdown 
                            dateStr={statusSearchResult.date} 
                            timeStr={statusSearchResult.time} 
                            title="Time remaining until scheduled appointment"
                            theme="orange"
                          />
                        </div>
                      )}

                      {/* Details Grid */}
                      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 bg-card text-foreground">
                        <div className="space-y-4">
                          <div>
                            <span className="text-[10px] font-black tracking-widest text-muted-foreground uppercase block">Client Name</span>
                            <p className="text-foreground font-extrabold flex items-center gap-2 mt-1">
                              <User className="h-4.5 w-4.5 text-orange-600" /> {statusSearchResult.userName}
                            </p>
                          </div>
                          <div>
                            <span className="text-[10px] font-black tracking-widest text-muted-foreground uppercase block">Appointment Slot</span>
                            <p className="text-foreground font-extrabold flex items-center gap-2 mt-1">
                              <CalendarIcon className="h-4.5 w-4.5 text-orange-500" /> {statusSearchResult.date}
                            </p>
                            <p className="text-muted-foreground font-bold flex items-center gap-2 mt-1 text-xs">
                              <Clock className="h-3.5 w-3.5 text-orange-500" /> {statusSearchResult.time} (UTC Local)
                            </p>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div>
                            <span className="text-[10px] font-black tracking-widest text-muted-foreground uppercase block">Service Selected</span>
                            <p className="text-foreground font-extrabold flex items-center gap-2 mt-1 border-b border-border/10 pb-1">
                              <Briefcase className="h-4.5 w-4.5 text-orange-600" /> {statusSearchResult.serviceTitle || 'General Consultation'}
                            </p>
                          </div>
                          <div>
                            <span className="text-[10px] font-black tracking-widest text-muted-foreground uppercase block">Assigned Specialist</span>
                            <p className="text-foreground font-extrabold flex items-center gap-1.5 mt-1">
                              ★ {statusSearchResult.teamMemberName || 'Primary Available Specialist'}
                            </p>
                          </div>
                        </div>

                        {statusSearchResult.notes && (
                          <div className="md:col-span-2 pt-3 border-t border-border">
                            <span className="text-[10px] font-black tracking-widest text-muted-foreground uppercase block">Additional Notes</span>
                            <p className="text-foreground mt-1.5 text-sm bg-muted/40 p-4 rounded-xl border border-border/40 italic leading-relaxed">
                              "{statusSearchResult.notes}"
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Success / Instructions Message */}
                      <div className="p-5 border-t border-border bg-orange-650/[0.02] flex gap-3 text-xs text-muted-foreground leading-relaxed">
                        <AlertCircle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                        <div className="font-semibold">
                          {statusSearchResult.status === 'confirmed' || statusSearchResult.status === 'approved' ? (
                            <p className="text-green-700 dark:text-green-400">
                              Your appointment is secured perfectly on our desk! Please make sure to be ready on {statusSearchResult.date} at {statusSearchResult.time}. Need to adjust dates? Chat with us live or email support referencing ticket #{statusSearchResult.orderNumber}.
                            </p>
                          ) : statusSearchResult.status === 'cancelled' ? (
                            <p className="text-red-700 dark:text-red-400">
                              This booking has been cancelled. Please initiate a new scheduling session if you would like to reserve a new date or slot.
                            </p>
                          ) : (
                            <p className="text-amber-700 dark:text-amber-400">
                              Our consultants are evaluating your briefcase alignment. You will be notified automatically with the resolution. No action is required from you at this time.
                            </p>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {!isSearchingStatus && hasSearchedStatus && !statusSearchResult && (
                    <motion.div
                      key="no-result"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="border border-red-200/50 dark:border-red-950/40 bg-red-500/5 p-6 rounded-2xl text-center space-y-2"
                    >
                      <AlertCircle className="h-8 w-8 text-red-500 mx-auto" />
                      <h4 className="text-sm font-bold text-foreground">Ticket Profile Not Found</h4>
                      <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed font-semibold">
                        Could not find any appointment associated with order number <strong className="font-mono text-orange-600 dark:text-orange-400 font-extrabold">"{statusSearchQuery}"</strong>. Please verify that the code was typed correctly and matches the 6-character receipt format.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </div>
        )}

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
            <div className="bg-orange-600/10 border border-orange-600/20 rounded-lg p-6 w-full text-center relative">
              <span className="text-xs uppercase tracking-widest text-muted-foreground font-black">Your Order Number</span>
              <div className="text-4xl font-black text-orange-600 tracking-widest mt-1">
                {orderNumber}
              </div>
              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  onClick={handleCopyOrderNumber}
                  className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-orange-600 dark:text-orange-500 border border-orange-600/30 bg-orange-600/5 hover:bg-orange-600/10 transition-all px-3 py-1.5 rounded-lg shadow-sm cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-500" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy to Clipboard</span>
                    </>
                  )}
                </button>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground text-center uppercase tracking-widest font-bold">
              Please save this number for reference
            </p>

            {date && formData.time && (
              <AppointmentCountdown 
                dateStr={format(date, 'yyyy-MM-dd')}
                timeStr={formData.time}
                title="Time remaining until appointment"
                theme="light"
              />
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button 
              onClick={() => window.print()}
              className="flex-1 bg-orange-600 hover:bg-orange-700 text-white flex items-center justify-center gap-2 font-bold cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              Print Booking
            </Button>
            <Button 
              variant="outline"
              onClick={() => setShowSuccessDialog(false)}
              className="flex-1 border-border hover:bg-muted text-foreground font-bold cursor-pointer"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hidden high-fidelity layout optimized specifically for desktop/mobile physical printing */}
      <div id="booking-print-area" className="hidden">
        <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', maxWidth: '650px', margin: '0 auto', color: '#111827', lineHeight: '1.5' }}>
          
          {/* Print Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #ea580c', paddingBottom: '20px', marginBottom: '25px' }}>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#ea580c', margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Grefas Consult & Entertainment
              </h1>
              <p style={{ fontSize: '12px', color: '#4b5563', margin: '0' }}>
                Tailored Legal Consulting, Dynamic Media & Creative Agency
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', color: '#9ca3af', letterSpacing: '0.05em' }}>
                Reservation Pass
              </div>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#111827', marginTop: '2px' }}>
                {date ? format(date, 'MMM d, yyyy') : ''}
              </div>
            </div>
          </div>

          {/* Large Ticket Badge for Reference */}
          <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '12px', padding: '18px', textAlign: 'center', marginBottom: '25px' }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#6b7280', fontWeight: 'bold', letterSpacing: '0.1em' }}>
              Unique Reference Code
            </span>
            <div style={{ fontSize: '32px', fontWeight: '900', color: '#ea580c', letterSpacing: '0.15em', marginTop: '4px' }}>
              {orderNumber}
            </div>
            <p style={{ fontSize: '11px', color: '#6b7280', margin: '8px 0 0 0' }}>
              *Always supply this code to representative lines when demanding schedule adjustments.
            </p>
          </div>

          {/* Grid Layout of Details */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '25px' }}>
            
            {/* Section 1: Customer Details */}
            <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px' }}>
              <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: '#9ca3af', fontWeight: 'bold', margin: '0 0 12px 0', letterSpacing: '0.05em', borderBottom: '1px solid #f3f4f6', paddingBottom: '6px' }}>
                Client Details
              </h3>
              <div>
                <p style={{ margin: '0 0 6px 0', fontSize: '13px' }}>
                  <span style={{ color: '#6b7280' }}>Full Name:</span> <strong style={{ color: '#111827' }}>{formData.userName}</strong>
                </p>
                <p style={{ margin: '0 0 6px 0', fontSize: '13px' }}>
                  <span style={{ color: '#6b7280' }}>Email Address:</span> <strong style={{ color: '#111827' }}>{formData.userEmail}</strong>
                </p>
                <p style={{ margin: '0', fontSize: '13px' }}>
                  <span style={{ color: '#6b7280' }}>Phone Number:</span> <strong style={{ color: '#111827' }}>{formData.userPhone || 'Not provided'}</strong>
                </p>
              </div>
            </div>

            {/* Section 2: Session Details */}
            <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px' }}>
              <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: '#9ca3af', fontWeight: 'bold', margin: '0 0 12px 0', letterSpacing: '0.05em', borderBottom: '1px solid #f3f4f6', paddingBottom: '6px' }}>
                Session Schedule
              </h3>
              <div>
                <p style={{ margin: '0 0 6px 0', fontSize: '13px' }}>
                  <span style={{ color: '#6b7280' }}>Type of Service:</span> <strong style={{ color: '#111827' }}>{formData.serviceTitle || 'General Consultation'}</strong>
                </p>
                <p style={{ margin: '0 0 6px 0', fontSize: '13px' }}>
                  <span style={{ color: '#6b7280' }}>Date Assigned:</span> <strong style={{ color: '#ea580c' }}>{date ? format(date, 'EEEE, MMMM d, yyyy') : 'N/A'}</strong>
                </p>
                <p style={{ margin: '0 0 6px 0', fontSize: '13px' }}>
                  <span style={{ color: '#6b7280' }}>Assigned Hour slot:</span> <strong style={{ color: '#111827' }}>{formData.time}</strong>
                </p>
                <p style={{ margin: '0', fontSize: '13px' }}>
                  <span style={{ color: '#6b7280' }}>Assigned Specialist:</span> <strong style={{ color: '#111827' }}>{formData.teamMemberName || 'First Available Specialist'}</strong>
                </p>
              </div>
            </div>

          </div>

          {/* Notes Section */}
          {formData.notes && (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px', marginBottom: '25px' }}>
              <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: '#9ca3af', fontWeight: 'bold', margin: '0 0 8px 0', letterSpacing: '0.05em' }}>
                Special Client Notes & Requirements
              </h3>
              <p style={{ fontSize: '13px', color: '#374151', margin: '0', fontStyle: 'italic', background: '#f9fafb', padding: '10px', borderRadius: '8px', borderLeft: '3px solid #ea580c' }}>
                "{formData.notes}"
              </p>
            </div>
          )}

          {/* Quick Notice Card */}
          <div style={{ border: '1px dashed #e5e7eb', borderRadius: '12px', padding: '16px', background: '#fafafa', marginBottom: '30px' }}>
            <h4 style={{ fontSize: '12px', fontWeight: 'bold', color: '#111827', margin: '0 0 6px 0', textTransform: 'uppercase' }}>
              Terms & Alignment Policies
            </h4>
            <p style={{ fontSize: '11px', color: '#6b7280', margin: '0', lineHeight: '1.6' }}>
              Cancellations or timeslot adjustments are completely free if communicated at least twenty-four hours in advance. To make changes, please live chat our representatives or copy this reservation to email and direct it to: <strong>info@grefasconsultandentertainment.com</strong>.
            </p>
          </div>

          {/* Print Footer */}
          <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '11px', color: '#9ca3af' }}>
              Printed on {new Date().toLocaleString('en-US', { timeZoneName: 'short' })}
            </div>
            <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#ea580c' }}>
              www.grefasconsultandentertainment.com
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
