import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'motion/react';
import { ArrowRight, Star, Users, Briefcase, Play, Quote, Loader2, Zap, X, CheckCircle, Megaphone, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { db, handleFirestoreError, OperationType } from '@/firebase';
import { doc, onSnapshot, collection, query, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { useLanguage } from '@/lib/LanguageContext';
import SEO from '@/components/SEO';
import BlogSection from '@/components/BlogSection';
import InteractiveGuide from '@/components/InteractiveGuide';

import { AdSense } from '@/components/AdSense';

export default function Home() {
  const { t, language } = useLanguage();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [quote, setQuote] = useState<string>("");
  const [loadingQuote, setLoadingQuote] = useState(true);
  const [testimonials, setTestimonials] = useState<any[]>([]);
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [submitFeedback, setSubmitFeedback] = useState({ authorName: '', authorRole: '', rating: 5, text: '' });
  const [submitStatus, setSubmitStatus] = useState<{ loading: boolean; success: boolean; error: string | null }>({
    loading: false,
    success: false,
    error: null,
  });

  // Visitor pop-up alerts
  const [activeAlert, setActiveAlert] = useState<any | null>(null);
  const [showAlert, setShowAlert] = useState(false);

  // Vacancy alert states
  const [vacancyActive, setVacancyActive] = useState<boolean>(false);
  const [vacancyTitle, setVacancyTitle] = useState<string>('');
  const [vacancyMessage, setVacancyMessage] = useState<string>('');
  const [vacancyBtnText, setVacancyBtnText] = useState<string>('');

  const fallbackTestimonials = [
    {
      id: 'f1',
      authorName: 'Sarah Mensah',
      authorRole: 'Director, Ashanti Media',
      rating: 5,
      text: 'Grefas Consult transformed our media strategy. Their team\'s professionalism and deep connection in Nyinahin-Ashanti made our launch seamless and highly successful.',
      avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=150'
    },
    {
      id: 'f2',
      authorName: 'David Boateng',
      authorRole: 'HR Manager, Apex Ghana',
      rating: 5,
      text: 'The entertainment experience Grefas brought to our corporate retreat was outstanding. Highly energetic, perfectly organized, and absolute fun!',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=150'
    },
    {
      id: 'f3',
      authorName: 'Dr. Elizabeth Osei',
      authorRole: 'Founder, Ashanti Health Initiatives',
      rating: 5,
      text: 'Exceptional consulting! They helped us streamline our operations and local community engagement with absolute precision and genuine care.',
      avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=150'
    }
  ];

  const displayTestimonials = testimonials.length > 0 ? testimonials : fallbackTestimonials;

  useEffect(() => {
    const q = query(collection(db, 'testimonials'), where('approved', '==', true));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setTestimonials(items);
    }, (error) => {
      console.debug("Home testimonial feed issue (handled):", error);
      handleFirestoreError(error, OperationType.LIST, 'testimonials');
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Fetch active visitor alerts / announcements
    const q = query(
      collection(db, 'visitor_notifications'), 
      where('isActive', '==', true)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        // Sort manually by creation timestamp desc
        const alertsList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }) as any);
        
        alertsList.sort((a, b) => {
          const timeA = a.createdAt?.seconds || 0;
          const timeB = b.createdAt?.seconds || 0;
          return timeB - timeA;
        });

        const latestAlert = alertsList[0];
        const dismissed = sessionStorage.getItem(`dismissed_alert_${latestAlert.id}`);
        if (!dismissed) {
          setActiveAlert(latestAlert);
          const timer = setTimeout(() => {
            setShowAlert(true);
          }, 1500);
          return () => clearTimeout(timer);
        } else {
          setActiveAlert(null);
          setShowAlert(false);
        }
      } else {
        setActiveAlert(null);
        setShowAlert(false);
      }
    }, (error) => {
      console.warn("Visitor notifications load issue (handled):", error);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (displayTestimonials.length <= 1) return;
    const interval = setInterval(() => {
      setActiveTestimonial((prev) => (prev + 1) % displayTestimonials.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [displayTestimonials.length]);

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submitFeedback.authorName || !submitFeedback.text) {
      setSubmitStatus({ loading: false, success: false, error: 'Please fill in your name and feedback.' });
      return;
    }

    setSubmitStatus({ loading: true, success: false, error: null });
    try {
      await addDoc(collection(db, 'testimonials'), {
        authorName: submitFeedback.authorName,
        authorRole: submitFeedback.authorRole || 'Client',
        rating: Number(submitFeedback.rating),
        text: submitFeedback.text,
        approved: false, // Must be approved by admin
        createdAt: serverTimestamp()
      });
      setSubmitStatus({ loading: false, success: true, error: null });
      setSubmitFeedback({ authorName: '', authorRole: '', rating: 5, text: '' });
      setTimeout(() => {
        setShowReviewModal(false);
        setSubmitStatus({ loading: false, success: false, error: null });
      }, 2000);
    } catch (error: any) {
      console.error("Testimonial submission error:", error);
      setSubmitStatus({ loading: false, success: false, error: error.message || 'Failed to submit review.' });
    }
  };

  const heroRef = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"]
  });

  const y = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.1]);

  const [customCarouselImages, setCustomCarouselImages] = useState<string[]>([]);

  const defaultSlides = [
    "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&q=80&w=1920",
    "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&q=80&w=1920",
    "https://images.unsplash.com/photo-1515187029135-18ee286d815b?auto=format&fit=crop&q=80&w=1920",
    "https://images.unsplash.com/photo-1505236858219-8359eb29e329?auto=format&fit=crop&q=80&w=1920"
  ];

  const slides = customCarouselImages.length > 0 ? customCarouselImages : defaultSlides;

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [slides.length]);

  useEffect(() => {
    if (currentSlide >= slides.length) {
      setCurrentSlide(0);
    }
  }, [slides.length, currentSlide]);

  useEffect(() => {
    const errorPath = 'settings/global';
    const unsubscribe = onSnapshot(doc(db, 'settings', 'global'), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setQuote(data.dailyQuote || "Excellence is not an act, but a habit.");
        setVacancyActive(data.isVacancyActive === true);
        setVacancyTitle(data.vacancyAlertTitle || 'We are Hiring! Active Vacancy Available');
        setVacancyMessage(data.vacancyAlertMessage || 'We are currently looking for brilliant talent to join our team. Click below to view open roles and apply!');
        setVacancyBtnText(data.vacancyButtonText || 'Apply Now');
        if (data.homeCarouselImages && Array.isArray(data.homeCarouselImages) && data.homeCarouselImages.length > 0) {
          setCustomCarouselImages(data.homeCarouselImages);
        } else {
          setCustomCarouselImages([]);
        }
      } else {
        setQuote("Excellence is not an act, but a habit.");
        setVacancyActive(false);
        setCustomCarouselImages([]);
      }
      setLoadingQuote(false);
    }, (error) => {
      console.debug("Home quote feed issue (handled):", error);
      setQuote("Excellence is not an act, but a habit.");
      setVacancyActive(false);
      setCustomCarouselImages([]);
      setLoadingQuote(false);
      // Pass to internal handler which handles offline suppressions
      handleFirestoreError(error, OperationType.GET, errorPath);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="relative overflow-hidden">
      <SEO 
        title="Official Website"
        description="Grefas Consult & Entertainment in Nyinahin-Ashanti, Ashanti Region is your premier partner for professional consulting and world-class entertainment services."
        keywords="Home Grefas, Nyinahin, Ashanti Region, Ghana Consult, Entertainment Ghana, Grefas official website"
      />

      {/* Vacancy Alert Banner */}
      {vacancyActive && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-gradient-to-r from-orange-600 via-orange-500 to-amber-600 text-white border-b border-orange-500/20 relative z-30 shadow-md"
        >
          <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left">
              <div className="bg-white/10 p-2 rounded-lg shrink-0 animate-pulse">
                <Briefcase className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-extrabold text-sm sm:text-base tracking-tight leading-tight">
                  {vacancyTitle}
                </p>
                <p className="text-orange-50/90 text-xs sm:text-sm mt-0.5 leading-normal">
                  {vacancyMessage}
                </p>
              </div>
            </div>
            <div className="shrink-0">
              <Button 
                asChild
                size="sm" 
                className="bg-white text-orange-600 hover:bg-orange-50 font-extrabold tracking-wider text-xs uppercase shadow-md h-9 rounded-xl px-5 border border-white/20"
              >
                <Link to="/work-with-us">
                  {vacancyBtnText}
                </Link>
              </Button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Hero Section with Carousel */}
      <section ref={heroRef} className="relative h-[90vh] w-full overflow-hidden bg-zinc-900 group/hero">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            style={{ y, scale }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5 }}
            className="absolute inset-0"
          >
            <img
              src={slides[currentSlide]}
              alt="Hero Background"
              className="h-full w-full object-cover opacity-50"
              referrerPolicy="no-referrer"
            />
            {/* Tech Dot Matrix Grid Overlay */}
            <div className="absolute inset-0 bg-[radial-gradient(#ffffff08_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />
            
            {/* Watermark */}
            <div className="pointer-events-none absolute bottom-8 left-8 z-10 select-none opacity-10">
              <p className="text-sm font-bold tracking-[0.2em] text-white">
                GREFAS CONSULT AND ENTERTAINMENT
              </p>
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-zinc-900" />

        <div className="relative mx-auto flex h-full max-w-7xl flex-col justify-center px-4 sm:px-6 lg:px-8 z-10">
          <motion.div
            style={{ opacity }}
            className="max-w-4xl"
          >
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <span className="inline-block rounded-full bg-orange-600/20 px-4 py-1 text-sm font-semibold text-orange-500 backdrop-blur-sm border border-orange-500/20">
                {t('hero.badge')}
              </span>
            </motion.div>

            {/* Static Title */}
            <div className="relative mt-6 py-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.3 }}
              >
                <h1 className="text-5xl font-black tracking-tighter text-white sm:text-8xl uppercase shadow-orange-600/20 drop-shadow-2xl">
                  Grefas Consult <span className="text-orange-600">&</span> Entertainment
                </h1>
              </motion.div>
            </div>

            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="mt-6 text-3xl font-bold text-white sm:text-5xl leading-tight"
            >
              {language === 'en' ? (
                <>Elevate Your <span className="text-orange-600">Vision</span> with Grefas in Nyinahin-Ashanti, Ashanti Region</>
              ) : language === 'fr' ? (
                <>Élevez votre <span className="text-orange-600">vision</span> avec Grefas à Nyinahin-Ashanti, région d'Ashanti</>
              ) : language === 'es' ? (
                <>Eleve su <span className="text-orange-600">visión</span> con Grefas en Nyinahin-Ashanti, Región de Ashanti</>
              ) : (
                <>Ma wo <span className="text-orange-600">anisoadehunu</span> kɔ anim ne Grefas wɔ Nyinahin-Ashanti, Ashanti Mantam</>
              )}
            </motion.h2>

            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="mt-6 text-xl text-zinc-300 max-w-2xl leading-relaxed"
            >
              {t('hero.description')}
            </motion.p>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.8 }}
              className="mt-10 flex flex-wrap gap-4"
            >
              <Button size="lg" className="bg-orange-600 hover:bg-orange-700 font-bold uppercase text-xs tracking-wider h-12 rounded-xl px-6" asChild>
                <Link to="/contact">{t('hero.getStarted')} <ArrowRight className="ml-2 h-5 w-5" /></Link>
              </Button>
              <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white hover:text-zinc-900 font-bold uppercase text-xs tracking-wider h-12 rounded-xl px-6" asChild>
                <Link to="/gallery">{t('hero.viewGallery')}</Link>
              </Button>
            </motion.div>
          </motion.div>
        </div>

        {/* Manual Arrow Controls (Visible on hover of the section) */}
        <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 flex justify-between pointer-events-none z-20">
          <button
            onClick={() => setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length)}
            className="w-11 h-11 rounded-full bg-black/40 hover:bg-orange-600 text-white flex items-center justify-center backdrop-blur-md border border-white/10 opacity-0 group-hover/hero:opacity-100 transition-all duration-300 pointer-events-auto shadow-lg"
            title="Previous Slide"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            onClick={() => setCurrentSlide((prev) => (prev + 1) % slides.length)}
            className="w-11 h-11 rounded-full bg-black/40 hover:bg-orange-600 text-white flex items-center justify-center backdrop-blur-md border border-white/10 opacity-0 group-hover/hero:opacity-100 transition-all duration-300 pointer-events-auto shadow-lg"
            title="Next Slide"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </div>

        {/* Carousel Indicators */}
        <div className="absolute bottom-12 left-1/2 flex -translate-x-1/2 space-x-2.5 z-20">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentSlide(i)}
              className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                currentSlide === i ? 'w-8 bg-orange-600' : 'w-2 bg-white/40 hover:bg-white/70'
              }`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>

        {/* Scrolling indicator at the bottom center */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1 opacity-60 hover:opacity-100 transition-all duration-300">
          <span className="text-[10px] font-mono font-bold tracking-widest text-zinc-400 uppercase select-none">
            Scroll down
          </span>
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
            className="cursor-pointer"
            onClick={() => {
              window.scrollTo({
                top: window.innerHeight * 0.85,
                behavior: 'smooth'
              });
            }}
          >
            <ChevronDown className="h-5 w-5 text-orange-500" />
          </motion.div>
        </div>
      </section>

      {/* Daily Quote Section */}
      <section className="bg-zinc-900 py-16">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative rounded-3xl bg-zinc-800/50 p-12 backdrop-blur-sm border border-zinc-700/50"
          >
            <Quote className="absolute -top-6 left-1/2 -translate-x-1/2 h-12 w-12 text-orange-600 opacity-50" />
            <h2 className="text-sm font-semibold uppercase tracking-widest text-orange-500 mb-6">{t('hero.dailyInspiration')}</h2>
            {loadingQuote ? (
              <div className="flex justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
              </div>
            ) : (
              <p className="text-2xl md:text-3xl font-medium text-white italic leading-relaxed">
                "{quote}"
              </p>
            )}
            <p className="mt-6 text-zinc-500 font-medium">— Grefas Team</p>
          </motion.div>
        </div>
      </section>

      {/* AdSense Unit */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <AdSense 
          client="ca-pub-8193654467459416"
          slot="home_top" 
          className="rounded-xl overflow-hidden shadow-sm"
        />
      </div>

      {/* Stats Section */}
      <section className="bg-background py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {[
              { label: 'Projects Done', value: '150+' },
              { label: 'Happy Clients', value: '80+' },
              { label: 'Events Hosted', value: '200+' },
              { label: 'Years Experience', value: '10+' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-4xl font-bold text-orange-600">{stat.value}</p>
                <p className="mt-2 text-sm font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-muted/30 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Why Choose Grefas?</h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              We combine strategic consulting with creative entertainment to deliver 
              comprehensive solutions for our clients.
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-3">
            {[
              {
                title: 'Expert Consulting',
                description: 'Strategic advice to help your business or personal brand grow effectively.',
                icon: Users,
              },
              {
                title: 'Creative Entertainment',
                description: 'Unique event planning and entertainment services that leave a lasting impression.',
                icon: Star,
              },
              {
                title: 'Seamless Execution',
                description: 'From concept to completion, we handle every detail with precision.',
                icon: Zap,
              },
            ].map((feature) => (
              <div key={feature.title} className="rounded-2xl bg-card p-8 shadow-sm transition-all hover:shadow-md border border-border/50">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-100 dark:bg-orange-900/30 text-orange-600">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-6 text-xl font-bold text-foreground">{feature.title}</h3>
                <p className="mt-2 text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Interactive Guide Video Animation simulation */}
      <section className="bg-zinc-950 py-24 border-t border-zinc-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <InteractiveGuide />
        </div>
      </section>

      {/* Blog Section at the bottom of the page */}
      <BlogSection />

      {/* Testimonials Carousel Section */}
      <section className="bg-zinc-900 py-24 border-t border-zinc-800 text-white relative overflow-hidden">
        {/* Subtle decorative background blur */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-orange-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl">Client Testimonials</h2>
            <p className="mx-auto mt-4 max-w-2xl text-zinc-400 text-sm">
              Hear directly from Grefas clients about their business growth, events, and consultations.
            </p>
          </div>

          {/* Testimonial Active Slider Box */}
          <div className="relative min-h-[300px] flex flex-col justify-center items-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTestimonial}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.5 }}
                className="w-full text-center max-w-3xl flex flex-col items-center"
              >
                <Quote className="h-12 w-12 text-orange-500 opacity-60 mb-6" />
                <p className="text-xl sm:text-2xl font-medium italic text-zinc-100 leading-relaxed max-w-2xl px-4">
                  "{displayTestimonials[activeTestimonial]?.text}"
                </p>

                {/* Stars */}
                <div className="flex gap-1 mt-6 justify-center text-amber-400">
                  {Array.from({ length: displayTestimonials[activeTestimonial]?.rating || 5 }).map((_, idx) => (
                    <Star key={idx} className="h-5 w-5 fill-current" />
                  ))}
                </div>

                {/* Author Metadata */}
                <div className="mt-6 flex items-center gap-3">
                  {displayTestimonials[activeTestimonial]?.avatarUrl ? (
                    <img
                      src={displayTestimonials[activeTestimonial].avatarUrl}
                      alt={displayTestimonials[activeTestimonial].authorName}
                      className="h-10 w-10 rounded-full object-cover border border-orange-500/30"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-orange-600/20 text-orange-500 flex items-center justify-center font-bold border border-orange-600/30">
                      {displayTestimonials[activeTestimonial]?.authorName?.charAt(0)}
                    </div>
                  )}
                  <div className="text-left">
                    <p className="font-bold text-sm text-zinc-100">{displayTestimonials[activeTestimonial]?.authorName}</p>
                    <p className="text-xs text-zinc-400">{displayTestimonials[activeTestimonial]?.authorRole}</p>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Slider Controls */}
            <div className="mt-12 flex items-center justify-center gap-4">
              <button
                onClick={() => setActiveTestimonial((prev) => (prev - 1 + displayTestimonials.length) % displayTestimonials.length)}
                className="p-2 rounded-full border border-zinc-700 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all"
                aria-label="Previous testimonial"
              >
                <ArrowRight className="h-4 w-4 rotate-180" />
              </button>
              
              {/* Dots */}
              <div className="flex gap-1.5">
                {displayTestimonials.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveTestimonial(idx)}
                    className={`h-2 rounded-full transition-all ${
                      activeTestimonial === idx ? 'w-6 bg-orange-500' : 'w-2 bg-zinc-700 hover:bg-zinc-600'
                    }`}
                    aria-label={`Go to slide ${idx + 1}`}
                  />
                ))}
              </div>

              <button
                onClick={() => setActiveTestimonial((prev) => (prev + 1) % displayTestimonials.length)}
                className="p-2 rounded-full border border-zinc-700 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all"
                aria-label="Next testimonial"
              >
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mt-16 text-center">
            <Button
              onClick={() => setShowReviewModal(true)}
              variant="outline"
              className="border-orange-500/30 text-orange-500 hover:bg-orange-500 hover:text-white transition-all"
            >
              Share Your Experience
            </Button>
          </div>
        </div>
      </section>

      {/* Review Submission Modal */}
      <AnimatePresence>
        {showReviewModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl p-6 relative text-white"
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-lg font-black tracking-tight">Write a Testimonial</h3>
                  <p className="text-xs text-zinc-400 mt-1">Submit feedback about Grefas services</p>
                </div>
                <button
                  onClick={() => setShowReviewModal(false)}
                  className="p-1.5 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {submitStatus.success ? (
                <div className="py-12 text-center">
                  <div className="mx-auto h-12 w-12 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center mb-4">
                    <CheckCircle className="h-6 w-6" />
                  </div>
                  <h4 className="font-bold text-zinc-100">Review Submitted!</h4>
                  <p className="text-sm text-zinc-400 mt-2 max-w-xs mx-auto">
                    Thank you! Your testimonial has been submitted successfully and is waiting for administrator approval.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleReviewSubmit} className="space-y-4">
                  {submitStatus.error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-500 rounded-lg text-xs font-bold">
                      {submitStatus.error}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Your Name *</label>
                      <input
                        type="text"
                        required
                        value={submitFeedback.authorName}
                        onChange={(e) => setSubmitFeedback({ ...submitFeedback, authorName: e.target.value })}
                        placeholder="John Doe"
                        className="w-full bg-zinc-800 border border-zinc-700/60 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Your Role/Title</label>
                      <input
                        type="text"
                        value={submitFeedback.authorRole}
                        onChange={(e) => setSubmitFeedback({ ...submitFeedback, authorRole: e.target.value })}
                        placeholder="Client, Entrepreneur"
                        className="w-full bg-zinc-800 border border-zinc-700/60 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Rating (1-5 Stars)</label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setSubmitFeedback({ ...submitFeedback, rating: star })}
                          className={`p-1 rounded-md transition-all ${
                            submitFeedback.rating >= star ? 'text-amber-400' : 'text-zinc-600'
                          }`}
                        >
                          <Star className="h-6 w-6 fill-current" />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Feedback / Testimonial *</label>
                    <textarea
                      required
                      rows={4}
                      value={submitFeedback.text}
                      onChange={(e) => setSubmitFeedback({ ...submitFeedback, text: e.target.value })}
                      placeholder="Share details of your experience with us..."
                      className="w-full bg-zinc-800 border border-zinc-700/60 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500 resize-none"
                    />
                  </div>

                  <div className="pt-2">
                    <Button
                      type="submit"
                      disabled={submitStatus.loading}
                      className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold"
                    >
                      {submitStatus.loading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Submitting Feedback...
                        </>
                      ) : (
                        'Submit Testimonial'
                      )}
                    </Button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CTA Section */}
      <section className="bg-orange-600 py-20 text-white">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Ready to start your next project?</h2>
          <p className="mx-auto mt-4 max-w-2xl text-orange-100">
            Contact us today for a consultation and let's make something amazing together.
          </p>
          <div className="mt-10">
            <Button asChild size="lg" variant="secondary" className="bg-white text-orange-600 hover:bg-zinc-100">
              <Link to="/contact" className="flex items-center">
                Get in Touch <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Site-wide Visitor Alert Popup Modal */}
      <AnimatePresence>
        {showAlert && activeAlert && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                sessionStorage.setItem(`dismissed_alert_${activeAlert.id}`, 'true');
                setShowAlert(false);
              }}
              className="absolute inset-0 bg-black/75 backdrop-blur-xs"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className={`relative w-full max-w-md overflow-hidden rounded-2xl bg-zinc-950 border text-white shadow-2xl ${
                activeAlert.type === 'accent' ? 'border-orange-500/50 shadow-orange-500/10' :
                activeAlert.type === 'warning' ? 'border-amber-500/50 shadow-amber-500/10' :
                activeAlert.type === 'success' ? 'border-emerald-500/50 shadow-emerald-500/10' :
                'border-sky-500/50 shadow-sky-500/10'
              }`}
            >
              {/* Type Accent Top Bar */}
              <div className={`h-1.5 w-full ${
                activeAlert.type === 'accent' ? 'bg-orange-500' :
                activeAlert.type === 'warning' ? 'bg-amber-500' :
                activeAlert.type === 'success' ? 'bg-emerald-500' :
                'bg-sky-500'
              }`} />

              {/* Close Button */}
              <button
                onClick={() => {
                  sessionStorage.setItem(`dismissed_alert_${activeAlert.id}`, 'true');
                  setShowAlert(false);
                }}
                className="absolute top-4 right-4 text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 p-1.5 rounded-full transition-all cursor-pointer"
                aria-label="Close notification"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="p-6 sm:p-8">
                {/* Icon Header */}
                <div className="flex items-center gap-3 pb-4">
                  <div className={`p-2.5 rounded-xl ${
                    activeAlert.type === 'accent' ? 'bg-orange-500/10 text-orange-500' :
                    activeAlert.type === 'warning' ? 'bg-amber-500/10 text-amber-500' :
                    activeAlert.type === 'success' ? 'bg-emerald-500/10 text-emerald-500' :
                    'bg-sky-500/10 text-sky-500'
                  }`}>
                    <Megaphone className="h-5 w-5" />
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-widest ${
                    activeAlert.type === 'accent' ? 'text-orange-400' :
                    activeAlert.type === 'warning' ? 'text-amber-400' :
                    activeAlert.type === 'success' ? 'text-emerald-400' :
                    'text-sky-400'
                  }`}>
                    {activeAlert.type === 'accent' ? 'Exclusive Update' :
                     activeAlert.type === 'warning' ? 'Important Alert' :
                     activeAlert.type === 'success' ? 'Special Notice' :
                     'Official Announcement'}
                  </span>
                </div>

                {/* Content */}
                <div className="space-y-3">
                  <h3 className="text-xl sm:text-2xl font-black tracking-tight leading-tight text-white">
                    {activeAlert.title}
                  </h3>
                  <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">
                    {activeAlert.message}
                  </p>
                </div>

                {/* Actions */}
                <div className="mt-8 flex flex-col sm:flex-row gap-3">
                  {activeAlert.buttonText && activeAlert.buttonUrl && (
                    <Button
                      asChild
                      className={`font-extrabold w-full sm:w-auto px-6 ${
                        activeAlert.type === 'accent' ? 'bg-orange-600 hover:bg-orange-700 text-white' :
                        activeAlert.type === 'warning' ? 'bg-amber-600 hover:bg-amber-700 text-white' :
                        activeAlert.type === 'success' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' :
                        'bg-sky-600 hover:bg-sky-700 text-white'
                      }`}
                    >
                      {activeAlert.buttonUrl.startsWith('http') ? (
                        <a href={activeAlert.buttonUrl} target="_blank" rel="noopener noreferrer">
                          {activeAlert.buttonText}
                        </a>
                      ) : (
                        <Link to={activeAlert.buttonUrl}>
                          {activeAlert.buttonText}
                        </Link>
                      )}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => {
                      sessionStorage.setItem(`dismissed_alert_${activeAlert.id}`, 'true');
                      setShowAlert(false);
                    }}
                    className="border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-900 font-extrabold w-full sm:w-auto"
                  >
                    Close
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
