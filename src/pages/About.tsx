import * as React from 'react';
import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { db } from '@/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

export default function About() {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'global'), (doc) => {
      if (doc.exists()) {
        setSettings(doc.data());
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

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
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              About Grefas Consult & Entertainment
            </h1>
            <div className="prose prose-zinc dark:prose-invert max-w-none text-lg text-muted-foreground">
              {settings?.aboutContent || (
                <p>
                  Grefas Consult & Entertainment is a premier service provider dedicated to delivering 
                  excellence in both professional consulting and high-end entertainment. With a 
                  passion for innovation and a commitment to quality, we help our clients achieve 
                  their goals and create unforgettable experiences.
                </p>
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="relative"
          >
            <div className="aspect-[4/5] overflow-hidden rounded-3xl bg-muted shadow-xl relative">
              <img
                src={settings?.aboutImageUrl || "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&q=80&w=800"}
                alt="About Grefas"
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
              {/* Watermark */}
              <div className="pointer-events-none absolute bottom-4 left-4 z-10 select-none opacity-20">
                <p className="text-xs font-bold tracking-widest text-white drop-shadow-lg">
                  GREFAS CONSULT AND ENTERTAINMENT
                </p>
              </div>
            </div>
            <div className="absolute -bottom-6 -left-6 h-32 w-32 rounded-full bg-orange-600/10 blur-3xl" />
          </motion.div>
        </div>

        <div className="mt-24 grid grid-cols-1 gap-8 md:grid-cols-3">
          {[
            { title: 'Our Mission', text: 'To empower businesses and individuals through strategic consulting and creative entertainment solutions.' },
            { title: 'Our Vision', text: 'To be the most trusted partner for excellence in service delivery across Africa and beyond.' },
            { title: 'Our Values', text: 'Integrity, Creativity, Professionalism, and Excellence in everything we do.' },
          ].map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="rounded-2xl bg-muted/50 p-8 border border-border/50"
            >
              <h3 className="text-xl font-bold text-foreground">{item.title}</h3>
              <p className="mt-4 text-muted-foreground">{item.text}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
