import * as React from 'react';
import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { format, isBefore, startOfToday, parseISO } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { db, auth } from '@/firebase';
import { collection, onSnapshot, setDoc, doc, serverTimestamp, getDoc, addDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { toast } from 'sonner';
import { Loader2, Calendar as CalendarIcon, CheckCircle2, AlertCircle } from 'lucide-react';

export default function Booking() {
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [bookedDates, setBookedDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [formData, setFormData] = useState({
    userName: '',
    userEmail: '',
    userPhone: '',
    notes: '',
    serviceId: '',
    serviceTitle: ''
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
      console.error("Error fetching services:", error);
    });

    // Fetch existing bookings to disable dates
    const unsubscribeBookings = onSnapshot(collection(db, 'bookings'), (snapshot) => {
      const dates = snapshot.docs.map(doc => doc.id); // Doc IDs are YYYY-MM-DD
      setBookedDates(dates);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching bookings:", error);
      setLoading(false);
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
    
    // Double check if date is already booked (real-time check)
    if (bookedDates.includes(dateStr)) {
      toast.error("This date has just been booked. Please choose another.");
      return;
    }

    setSubmitting(true);
    try {
      const bookingRef = doc(db, 'bookings', dateStr);
      
      // Use setDoc to create the booking. 
      // Our security rules prevent overwriting if it exists.
      await setDoc(bookingRef, {
        ...formData,
        date: dateStr,
        userId: user?.uid || 'anonymous',
        status: 'pending',
        createdAt: serverTimestamp()
      });

      // Create a notification for the user as a receipt
      if (user) {
        await addDoc(collection(db, 'notifications'), {
          userId: user.uid,
          title: 'Booking Received',
          message: `Your booking request for ${formData.serviceTitle || 'General Consultation'} on ${dateStr} has been received and is currently pending review.`,
          read: false,
          createdAt: serverTimestamp()
        });
      }

      toast.success(`Booking request for ${formData.serviceTitle || 'General Consultation'} submitted successfully! Notes: ${formData.notes || 'None'}`);
      setDate(undefined);
      setFormData({
        userName: user?.displayName || '',
        userEmail: user?.email || '',
        userPhone: '',
        notes: '',
        serviceId: '',
        serviceTitle: ''
      });
    } catch (error: any) {
      console.error("Booking error:", error);
      if (error.message?.includes('permission-denied')) {
        toast.error("This date is no longer available.");
      } else {
        toast.error("Failed to submit booking. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const disabledDays = [
    ...bookedDates.map(d => parseISO(d)),
    { before: startOfToday() }
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
            Secure your date with Grefas Consult & Entertainment. We only take one booking per day to ensure maximum focus on your event.
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
                  Choose an available date for your consultation or event.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 flex justify-center bg-card">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  disabled={disabledDays}
                  className="rounded-md border border-border shadow-sm bg-card text-foreground"
                />
              </CardContent>
            </Card>

            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded bg-orange-600" />
                <span className="text-muted-foreground">Selected</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded bg-muted" />
                <span className="text-muted-foreground">Booked</span>
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
                    ? `Booking for ${format(date, 'PPPP')}`
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
                      className="w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-orange-600"
                      value={formData.serviceId}
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
