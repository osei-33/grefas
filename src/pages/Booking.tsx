import * as React from 'react';
import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { format, isBefore, startOfToday, parseISO } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { db, auth, handleFirestoreError, OperationType } from '@/firebase';
import { collection, onSnapshot, setDoc, doc, serverTimestamp, getDoc, addDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { toast } from 'sonner';
import { Loader2, Calendar as CalendarIcon, CheckCircle2, AlertCircle } from 'lucide-react';

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
    time: '09:00'
  });
  const [services, setServices] = useState<any[]>([]);

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

    return () => {
      unsubscribeAuth();
      unsubscribeServices();
      unsubscribeBookings();
    };
  }, []);

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
      // Use addDoc to create a new booking with random ID
      await addDoc(collection(db, 'bookings'), {
        ...formData,
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
            message: `Your booking request for ${formData.serviceTitle || 'General Consultation'} on ${dateStr} at ${formData.time} has been received and is currently pending review.`,
            read: false,
            createdAt: serverTimestamp()
          });
        } catch (notifErr) {
          try {
            handleFirestoreError(notifErr, OperationType.CREATE, 'notifications');
          } catch (e) {}
        }
      }

      toast.success(`Booking request for ${formData.serviceTitle || 'General Consultation'} submitted successfully!`);
      setDate(undefined);
      setFormData({
        userName: user?.displayName || '',
        userEmail: user?.email || '',
        userPhone: '',
        notes: '',
        serviceId: '',
        serviceTitle: '',
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

  const disabledDays = [
    ...Object.keys(bookedDates).filter(d => bookedDates[d] >= 5).map(d => parseISO(d)),
    { before: startOfToday() }
  ];

  const timeSlots = [
    "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"
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

        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
          {/* Calendar Section */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <Card className="border border-border/50 shadow-md overflow-hidden bg-card">
              <CardHeader className="bg-orange-600 text-white">
                <CardTitle className="flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5" /> Select a Date
                </CardTitle>
                <CardDescription className="text-orange-100">
                  Choose an available date for your consultation or event. (Max 5 bookings per day)
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 flex flex-col items-center bg-card">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  disabled={disabledDays}
                  className="rounded-md border border-border shadow-sm bg-card text-foreground"
                />
                
                {date && (
                  <div className="mt-8 w-full animate-in fade-in slide-in-from-top-2">
                    <label className="mb-2 block text-sm font-medium text-foreground">Select Time Slot</label>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {timeSlots.map(t => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setFormData({ ...formData, time: t })}
                          className={`rounded-md border px-2 py-2 text-xs font-medium transition-colors ${
                            formData.time === t
                              ? 'bg-orange-600 border-orange-600 text-white'
                              : 'bg-muted/50 border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded bg-orange-600" />
                <span className="text-muted-foreground">Selected</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded bg-muted" />
                <span className="text-muted-foreground">Fully Booked (5/5)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded border border-border" />
                <span className="text-muted-foreground">Available</span>
              </div>
            </div>
          </motion.div>

          {/* Form Section */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <Card className="border border-border/50 shadow-md bg-card">
              <CardHeader>
                <CardTitle className="text-foreground">Booking Details</CardTitle>
                <CardDescription className="text-muted-foreground">
                  {date 
                    ? `Booking for ${format(date, 'PPPP')} at ${formData.time}`
                    : "Please select a date on the calendar first."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleBooking} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Full Name</label>
                      <Input
                        required
                        value={formData.userName}
                        onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
                        placeholder="John Doe"
                        className="bg-muted/50 border-border"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Email Address</label>
                      <Input
                        required
                        type="email"
                        value={formData.userEmail}
                        onChange={(e) => setFormData({ ...formData, userEmail: e.target.value })}
                        placeholder="john@example.com"
                        className="bg-muted/50 border-border"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Phone Number</label>
                      <Input
                        value={formData.userPhone}
                        onChange={(e) => setFormData({ ...formData, userPhone: e.target.value })}
                        placeholder="+233 ..."
                        className="bg-muted/50 border-border"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Service Interested In</label>
                      <select
                        className="w-full h-10 rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-orange-600"
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
                        <option value="" className="bg-card">Select a service</option>
                        {services.map(s => (
                          <option key={s.id} value={s.id} className="bg-card">{s.title}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Additional Notes</label>
                    <Textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Tell us more about your event..."
                      rows={4}
                      className="bg-muted/50 border-border"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={!date || submitting}
                    className="w-full bg-orange-600 hover:bg-orange-700 h-12 text-lg text-white"
                  >
                    {submitting ? (
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    ) : (
                      "Confirm Booking Request"
                    )}
                  </Button>

                  {!date && (
                    <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                      <AlertCircle className="h-3 w-3" /> Select a date to enable booking
                    </p>
                  )}
                </form>
              </CardContent>
            </Card>

            <div className="mt-8 rounded-2xl bg-orange-50 dark:bg-orange-900/10 p-6 border border-orange-100 dark:border-orange-900/20">
              <h4 className="flex items-center gap-2 font-bold text-orange-900 dark:text-orange-500">
                <CheckCircle2 className="h-5 w-5 text-orange-600" /> Why Book With Us?
              </h4>
              <ul className="mt-4 space-y-2 text-sm text-orange-800 dark:text-orange-400/80">
                <li>• Exclusive focus: Only one event per day.</li>
                <li>• Personalized consulting from start to finish.</li>
                <li>• Professional entertainment tailored to your needs.</li>
                <li>• Transparent pricing and seamless execution.</li>
              </ul>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
