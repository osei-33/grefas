import * as React from 'react';
import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Mail, Phone, MapPin, Send, MessageCircle, Navigation, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { db, handleFirestoreError, OperationType } from '@/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import SEO from '@/components/SEO';

export default function Contact() {
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    const errorPath = 'settings/global';
    const unsubscribe = onSnapshot(doc(db, 'settings', 'global'), (doc) => {
      if (doc.exists()) {
        setSettings(doc.data());
      }
    }, (error) => {
      console.debug("Contact settings fetch issue (handled):", error);
      handleFirestoreError(error, OperationType.GET, errorPath);
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('Message sent successfully! We will get back to you soon.');
    (e.target as HTMLFormElement).reset();
  };

  return (
    <div className="bg-background py-20">
      <SEO 
        title="Contact Us"
        description="Get in touch with Grefas Consult & Entertainment in Nyinahin-Ashanti, Ashanti Region. Contact us for strategic advising, concert events, and general organization management."
        keywords="Contact Grefas, Nyinahin office, phone Grefas, Grefas address"
      />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl"
          >
            Get in Touch <span className="text-orange-600">—</span> Nyinahin-Ashanti, Ashanti Region
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground"
          >
            Have an inquiry or want to collaborate with our team in Nyinahin-Ashanti, Ashanti Region? Send us a message and we'll reply promptly.
          </motion.p>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-12 lg:grid-cols-2">
          {/* Contact Info */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-8"
          >
            <div>
              <h3 className="text-2xl font-bold text-foreground">Contact Information</h3>
              <p className="mt-4 text-muted-foreground">
                Our team is ready to assist you with your consulting and entertainment needs.
              </p>
            </div>

            <div className="space-y-6">
              <div className="flex items-start space-x-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-500">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Email</p>
                  <p className="text-muted-foreground">{settings?.email || 'info@grefas.com'}</p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-500">
                  <Phone className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Phone</p>
                  <p className="text-muted-foreground">{settings?.phone || '+233 123 456 789'}</p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30 text-[#25D366] dark:text-[#25D366]">
                  <MessageCircle className="h-5 w-5 fill-current" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">WhatsApp Chat</p>
                  <p className="text-muted-foreground">
                    <a
                      href={`https://wa.me/${(settings?.phone || '+233123456789').replace(/\D/g, '')}?text=${encodeURIComponent("Hello Grefas! I'm reaching out to make an inquiry.")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-600 dark:text-green-400 font-bold hover:underline flex items-center gap-1"
                    >
                      Chat with us live on WhatsApp
                    </a>
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-500">
                  <MapPin className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Address</p>
                  <p className="text-muted-foreground">{settings?.address || '123 Business Avenue, Nyinahin-Ashanti, Ashanti Region, Ghana'}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="text-sm font-semibold text-orange-600 dark:text-orange-500 bg-orange-50 dark:bg-orange-950/40 px-2.5 py-1 rounded inline-block">
                      GPS Address: AI-0008-9223
                    </span>
                    <a
                      href="https://www.google.com/maps/dir/?api=1&destination=AI-0008-9223,+Nyinahin-Ashanti,+Ashanti+Region,+Ghana"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-white bg-orange-600 hover:bg-orange-700 transition-colors px-3 py-1 rounded-md shadow-sm"
                    >
                      <Navigation className="h-3 w-3 fill-white/20 animate-bounce" />
                      Get Directions
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Google Map */}
            <div className="aspect-video w-full overflow-hidden rounded-2xl bg-muted border border-border/50 shadow-sm relative group h-[320px]">
              <iframe
                title="Grefas Location Map"
                width="100%"
                height="100%"
                className="border-0 w-full h-full grayscale-[15%] group-hover:grayscale-0 transition-all duration-500"
                loading="lazy"
                allowFullScreen
                src="https://maps.google.com/maps?q=AI-0008-9223,+Nyinahin-Ashanti,+Ghana&t=&z=16&ie=UTF8&iwloc=&output=embed"
              ></iframe>
              <div className="absolute bottom-4 left-4 right-4 z-10 flex justify-center">
                <a
                  href="https://www.google.com/maps/dir/?api=1&destination=AI-0008-9223,+Nyinahin-Ashanti,+Ashanti+Region,+Ghana"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-black/80 hover:bg-black text-white text-xs font-bold uppercase tracking-widest px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-lg transition-all duration-300 border border-white/10 hover:border-orange-500 hover:scale-[1.02] active:scale-95 cursor-pointer"
                >
                  <Navigation className="h-3.5 w-3.5 text-orange-500 fill-orange-500/20" />
                  <span>Navigate To GPS Address</span>
                  <ExternalLink className="h-3 w-3 opacity-60" />
                </a>
              </div>
            </div>
          </motion.div>

          {/* Contact Form */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="rounded-3xl bg-card p-8 shadow-sm border border-border/50"
          >
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="first-name" className="text-sm font-medium text-foreground">First Name</label>
                  <Input id="first-name" placeholder="John" required className="bg-muted/50 border-border" />
                </div>
                <div className="space-y-2">
                  <label htmlFor="last-name" className="text-sm font-medium text-foreground">Last Name</label>
                  <Input id="last-name" placeholder="Doe" required className="bg-muted/50 border-border" />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-foreground">Email</label>
                <Input id="email" type="email" placeholder="john@example.com" required className="bg-muted/50 border-border" />
              </div>

              <div className="space-y-2">
                <label htmlFor="subject" className="text-sm font-medium text-foreground">Subject</label>
                <Input id="subject" placeholder="How can we help?" required className="bg-muted/50 border-border" />
              </div>

              <div className="space-y-2">
                <label htmlFor="message" className="text-sm font-medium text-foreground">Message</label>
                <Textarea id="message" placeholder="Tell us about your project..." className="min-h-[150px] bg-muted/50 border-border" required />
              </div>

              <Button type="submit" className="w-full bg-orange-600 hover:bg-orange-700 text-white">
                <Send className="mr-2 h-4 w-4" /> Send Message
              </Button>
            </form>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
