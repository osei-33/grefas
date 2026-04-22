import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'motion/react';
import { ArrowRight, Star, Users, Briefcase, Play, Quote, Loader2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { db } from '@/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

export default function Home() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [quote, setQuote] = useState<string>("");
  const [loadingQuote, setLoadingQuote] = useState(true);
  const heroRef = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"]
  });

  const y = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.1]);

  const slides = [
    "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&q=80&w=1920",
    "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&q=80&w=1920",
    "https://images.unsplash.com/photo-1515187029135-18ee286d815b?auto=format&fit=crop&q=80&w=1920",
    "https://images.unsplash.com/photo-1505236858219-8359eb29e329?auto=format&fit=crop&q=80&w=1920"
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'global'), (doc) => {
      if (doc.exists()) {
        setQuote(doc.data().dailyQuote || "Excellence is not an act, but a habit.");
      } else {
        setQuote("Excellence is not an act, but a habit.");
      }
      setLoadingQuote(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="relative overflow-hidden">
      {/* Hero Section with Carousel */}
      <section ref={heroRef} className="relative h-[90vh] w-full overflow-hidden bg-zinc-900">
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
              className="h-full w-full object-cover opacity-60"
              referrerPolicy="no-referrer"
            />
            {/* Watermark */}
            <div className="pointer-events-none absolute bottom-8 left-8 z-10 select-none opacity-10">
              <p className="text-sm font-bold tracking-[0.2em] text-white">
                GREFAS CONSULT AND ENTERTAINMENT
              </p>
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-zinc-900/80" />

        <div className="relative mx-auto flex h-full max-w-7xl flex-col justify-center px-4 sm:px-6 lg:px-8">
          <motion.div
            style={{ opacity }}
            className="max-w-4xl"
          >
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <span className="inline-block rounded-full bg-orange-600/20 px-4 py-1 text-sm font-semibold text-orange-500 backdrop-blur-sm">
                Excellence in Every Detail
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
              className="mt-6 text-3xl font-bold text-white sm:text-5xl"
            >
              Elevate Your <span className="text-orange-600">Vision</span> with Grefas
            </motion.h2>

            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="mt-6 text-xl text-zinc-300 max-w-2xl"
            >
              Your premier partner for professional consulting and world-class entertainment services. 
              We turn your ideas into unforgettable experiences.
            </motion.p>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.8 }}
              className="mt-10 flex flex-wrap gap-4"
            >
              <Button size="lg" className="bg-orange-600 hover:bg-orange-700" asChild>
                <Link to="/contact">Get Started <ArrowRight className="ml-2 h-5 w-5" /></Link>
              </Button>
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white hover:text-zinc-900" asChild>
                <Link to="/gallery">View Gallery</Link>
              </Button>
            </motion.div>
          </motion.div>
        </div>

        {/* Carousel Indicators */}
        <div className="absolute bottom-10 left-1/2 flex -translate-x-1/2 space-x-2">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentSlide(i)}
              className={`h-1.5 rounded-full transition-all ${
                currentSlide === i ? 'w-8 bg-orange-600' : 'w-2 bg-white/40 hover:bg-white/60'
              }`}
            />
          ))}
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
            <h2 className="text-sm font-semibold uppercase tracking-widest text-orange-500 mb-6">Daily Inspiration</h2>
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
    </div>
  );
}
