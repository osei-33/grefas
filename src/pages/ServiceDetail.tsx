import * as React from 'react';
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { auth, db, handleFirestoreError, OperationType } from '@/firebase';
import { 
  doc, 
  getDoc, 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import * as LucideIcons from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, ArrowLeft, Calendar, Star, Trash2, ShieldCheck, MessageSquare } from 'lucide-react';
import SEO from '@/components/SEO';
import AuthDialog from '@/components/AuthDialog';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function ServiceDetail() {
  const { id } = useParams<{ id: string }>();
  const [service, setService] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Review states
  const [reviews, setReviews] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function fetchService() {
      if (!id) return;
      try {
        const docRef = doc(db, 'services', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setService({ id: docSnap.id, ...docSnap.data() });
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `services/${id}`);
      } finally {
        setLoading(false);
      }
    }
    fetchService();
  }, [id]);

  // Auth listener
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  // Admin checking logic
  useEffect(() => {
    if (!currentUser) {
      setIsAdmin(false);
      return;
    }
    const checkAdminStatus = async () => {
      const emailLower = currentUser.email?.trim().toLowerCase();
      const isHardcodedAdmin = ["serwaahlinda1995@gmail.com", "asantegrice@gmail.com", "asantegrifice@gmail.com", "oseikwameemmanuel33@gmail.com"].includes(emailLower);
      if (isHardcodedAdmin) {
        setIsAdmin(true);
        return;
      }
      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists() && (userDoc.data().role === 'admin' || userDoc.data().role === 'editor')) {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      } catch (err) {
        console.warn("Could not retrieve user role:", err);
        setIsAdmin(false);
      }
    };
    checkAdminStatus();
  }, [currentUser]);

  // Real-time reviews fetching listener
  useEffect(() => {
    if (!id) return;
    const q = query(collection(db, 'reviews'), where('serviceId', '==', id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const revs = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
      // Sort in-memory to handle possible delay in server timestamp values
      revs.sort((a: any, b: any) => {
        const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt || 0).getTime();
        const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt || 0).getTime();
        return timeB - timeA;
      });
      setReviews(revs);
    }, (error) => {
      console.warn("Error fetching reviews:", error);
    });
    return () => unsubscribe();
  }, [id]);

  const handleAddReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      setAuthDialogOpen(true);
      return;
    }
    if (rating < 1 || rating > 5) {
      toast.error("Please pick a rating between 1 and 5.");
      return;
    }
    if (!comment.trim()) {
      toast.error("Please write a comment.");
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'reviews'), {
        serviceId: id,
        serviceTitle: service?.title || '',
        userId: currentUser.uid,
        userName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Grefas Client',
        rating: rating,
        comment: comment.trim(),
        createdAt: serverTimestamp()
      });
      toast.success("Thank you! Your feedback has been posted.");
      setComment('');
      setRating(5);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'reviews');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    try {
      await deleteDoc(doc(db, 'reviews', reviewId));
      toast.success("Review deleted successfully.");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `reviews/${reviewId}`);
    }
  };

  const getIcon = (name: string) => {
    const Icon = (LucideIcons as any)[name] || LucideIcons.Briefcase;
    return <Icon className="h-10 w-10 text-white" />;
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
      </div>
    );
  }

  if (!service) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-20 text-center">
        <h2 className="text-2xl font-bold">Service not found</h2>
        <Link to="/services" className="mt-4 inline-flex items-center text-orange-600 hover:underline">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to services
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-background min-h-screen pb-20">
      <SEO 
        title={service.title}
        description={service.description || `Read details regarding ${service.title} provided by Grefas Consult & Entertainment in Ashanti Region.`}
        keywords={`Grefas ${service.title}, ${service.title} Nyinahin, ${service.title} Ghana, ${service.title} services`}
      />
      {/* Hero Section */}
      <div className={`relative h-[40vh] min-h-[300px] w-full overflow-hidden ${service.color || 'bg-orange-600'}`}>
        <div className="absolute inset-0 bg-black/20" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-6 flex justify-center"
            >
              <div className="rounded-2xl bg-white/20 p-4 backdrop-blur-md">
                {getIcon(service.iconName)}
              </div>
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl font-extrabold text-white sm:text-5xl md:text-6xl"
            >
              {service.title}
            </motion.h1>
          </div>
        </div>
        <div className="absolute left-4 top-4 z-10 sm:left-8 sm:top-8">
          <Link to="/services">
            <Button variant="ghost" className="text-white hover:bg-white/20">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Services
            </Button>
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 pt-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <h2 className="text-3xl font-bold text-foreground">Overview</h2>
              <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
                {service.description}
              </p>
              
              <div className="mt-12">
                <h3 className="text-2xl font-semibold text-foreground">Why choose this service?</h3>
                <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
                  {[
                    "Personalized approach tailored to your unique needs",
                    "Expert consultation from industry professionals",
                    "Seamless project execution and management",
                    "Commitment to excellence and customer satisfaction"
                  ].map((benefit, i) => (
                    <Card key={i} className="border-border/50 bg-muted/30">
                      <CardContent className="p-4 pt-6">
                        <div className="flex gap-4">
                          <CheckCircle className="h-6 w-6 shrink-0 text-orange-600" />
                          <p className="text-sm font-medium text-foreground">{benefit}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Reviews and Ratings Section */}
              <div className="mt-16 border-t border-border pt-12 space-y-10">
                <div>
                  <h3 className="text-2xl font-bold text-foreground flex items-center gap-2">
                    <MessageSquare className="h-6 w-6 text-orange-600" /> Customer Reviews & Ratings
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    See what our clients say about Grefas's {service.title} services.
                  </p>
                </div>

                {/* Rating Overview and Breakdown */}
                {reviews.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-8 bg-muted/20 border border-border/40 rounded-2xl p-6">
                    <div className="md:col-span-4 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-border/60 pb-6 md:pb-0 md:pr-6 text-center">
                      <span className="text-5xl font-black text-foreground text-orange-600">
                        {(reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length).toFixed(1)}
                      </span>
                      <div className="flex items-center gap-0.5 mt-2">
                        {Array.from({ length: 5 }).map((_, i) => {
                          const avg = reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length;
                          return (
                            <Star
                              key={i}
                              className={`h-5 w-5 ${
                                i < Math.round(avg) ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground/30'
                              }`}
                            />
                          );
                        })}
                      </div>
                      <span className="text-xs text-muted-foreground mt-2 font-medium">
                        Based on {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}
                      </span>
                    </div>

                    <div className="md:col-span-8 space-y-2">
                      {Array.from({ length: 5 }).map((_, idx) => {
                        const starNum = 5 - idx;
                        const count = reviews.filter(r => r.rating === starNum).length;
                        const pct = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
                        return (
                          <div key={starNum} className="flex items-center gap-3 text-sm">
                            <span className="w-3 text-foreground font-semibold">{starNum}</span>
                            <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500 shrink-0" />
                            <div className="flex-1 h-2 rounded bg-muted/60 overflow-hidden">
                              <div
                                className="h-full bg-amber-500 rounded transition-all duration-500"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="w-8 text-right text-muted-foreground text-xs font-medium">
                              {count}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 bg-muted/10 border border-dashed border-border rounded-2xl">
                    <p className="text-muted-foreground font-medium">No reviews yet for this service.</p>
                    <p className="text-xs text-muted-foreground/80 mt-1">Be the first to share your experience!</p>
                  </div>
                )}

                {/* Left Feedback Comment Section */}
                {reviews.length > 0 && (
                  <div className="space-y-6">
                    <h4 className="text-lg font-bold text-foreground">Recent Feedback</h4>
                    <div className="space-y-4">
                      {reviews.map((rev) => {
                        const isOwner = currentUser?.uid === rev.userId;
                        const formattedDate = rev.createdAt?.seconds 
                          ? format(new Date(rev.createdAt.seconds * 1000), 'MMM d, yyyy')
                          : rev.createdAt
                            ? format(new Date(rev.createdAt), 'MMM d, yyyy')
                            : 'Recent';

                        return (
                          <Card key={rev.id} className="bg-card border-border/60 hover:shadow-sm transition-shadow">
                            <CardContent className="p-5 space-y-3">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex items-center gap-3">
                                  <div className="h-9 w-9 rounded-full bg-orange-600/10 text-orange-600 flex items-center justify-center font-bold text-sm">
                                    {rev.userName ? rev.userName.charAt(0).toUpperCase() : 'C'}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-bold text-foreground text-sm">{rev.userName}</span>
                                      <span title="Verified Grefas Client">
                                        <ShieldCheck className="h-3.5 w-3.5 text-orange-600" />
                                      </span>
                                    </div>
                                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                      {formattedDate}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  <div className="flex gap-0.5">
                                    {Array.from({ length: 5 }).map((_, i) => (
                                      <Star
                                        key={i}
                                        className={`h-3.5 w-3.5 ${
                                          i < rev.rating ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground/20'
                                        }`}
                                      />
                                    ))}
                                  </div>
                                  {(isOwner || isAdmin) && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleDeleteReview(rev.id)}
                                      className="h-7 w-7 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-full"
                                      title="Delete Review"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap pl-12">
                                {rev.comment}
                              </p>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Review Submission Form / Prompt */}
                <div className="bg-muted/10 border border-border/50 rounded-2xl p-6 md:p-8 space-y-6">
                  <div>
                    <h4 className="text-lg font-bold text-foreground">Write a Review</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Share your experience working with Grefas Consult & Entertainment on {service.title}.
                    </p>
                  </div>

                  {currentUser ? (
                    <form onSubmit={handleAddReview} className="space-y-4">
                      {/* Interactive Rating Selector */}
                      <div className="space-y-2">
                        <label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground block">
                          Your Rating
                        </label>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: 5 }).map((_, i) => {
                            const starValue = i + 1;
                            const isFilled = rating >= starValue;
                            return (
                              <button
                                type="button"
                                key={i}
                                onClick={() => setRating(starValue)}
                                className="p-1 hover:scale-110 transition-transform focus:outline-none"
                              >
                                <Star
                                  className={`h-7 w-7 transition-colors ${
                                    isFilled 
                                      ? 'fill-amber-500 text-amber-500' 
                                      : 'text-muted-foreground/30 hover:text-amber-400'
                                  }`}
                                />
                              </button>
                            );
                          })}
                          <span className="text-xs text-muted-foreground ml-2 font-bold uppercase">
                            {rating === 5 && 'Excellent'}
                            {rating === 4 && 'Very Good'}
                            {rating === 3 && 'Average'}
                            {rating === 2 && 'Poor'}
                            {rating === 1 && 'Terrible'}
                          </span>
                        </div>
                      </div>

                      {/* Comment Input */}
                      <div className="space-y-2">
                        <label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground block">
                          Review Comment
                        </label>
                        <textarea
                          rows={4}
                          value={comment}
                          onChange={(e) => setComment(e.target.value)}
                          placeholder="What did you like about this service? Please be specific to help others..."
                          required
                          maxLength={2000}
                          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500 placeholder:text-muted-foreground/50 resize-none"
                        />
                      </div>

                      <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="bg-orange-600 hover:bg-orange-700 text-white min-w-[120px] rounded-xl font-bold"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Posting...
                          </>
                        ) : (
                          'Submit Review'
                        )}
                      </Button>
                    </form>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center p-6 bg-orange-600/[0.03] border border-orange-600/15 rounded-2xl space-y-4">
                      <div className="h-12 w-12 rounded-full bg-orange-600/10 text-orange-600 flex items-center justify-center">
                        <Star className="h-6 w-6 fill-orange-600" />
                      </div>
                      <div className="max-w-md">
                        <h5 className="font-bold text-foreground">Sign In to Leave Feedback</h5>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                          We restrict reviews to authenticated clients to ensure our rating data is 100% verified, safe, and helpful for the Nyinahin community.
                        </p>
                      </div>
                      <Button
                        onClick={() => setAuthDialogOpen(true)}
                        className="bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl"
                      >
                        Sign In Now
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </motion.section>
          </div>

          <div className="lg:col-span-1">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="sticky top-24"
            >
              <Card className="border-2 border-orange-600/20 bg-orange-50/50 dark:bg-orange-900/10">
                <CardContent className="p-6">
                  <h3 className="text-xl font-bold text-foreground">Ready to start?</h3>
                  <div className="mt-3 flex items-baseline justify-between border-b border-orange-600/10 pb-3 mb-3">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Standard Price</span>
                    <span className="text-xl font-black text-orange-600">
                      GH₵ {(service.price !== undefined ? service.price : 150).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Book a consultation for {service.title} today and let's work together to make your vision a reality.
                  </p>
                  <Link to="/booking">
                    <Button className="mt-6 w-full bg-orange-600 text-white hover:bg-orange-700">
                      <Calendar className="mr-2 h-4 w-4" /> Book Now
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              <div className="mt-8 space-y-4">
                <h4 className="font-semibold text-foreground">Contact for more info</h4>
                <Link to="/contact">
                  <Button variant="outline" className="w-full">
                    Contact Us
                  </Button>
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
      <AuthDialog isOpen={authDialogOpen} onClose={() => setAuthDialogOpen(false)} />
    </div>
  );
}

function CheckCircle(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}
