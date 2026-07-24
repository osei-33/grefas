import * as React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, Home, Calendar, Briefcase, Phone, HelpCircle, Compass, Film, Users, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SEO from '@/components/SEO';

export default function NotFound() {
  return (
    <>
      <SEO 
        title="Page Not Found (404)" 
        description="The page you are looking for could not be found. Explore Grefas Consult & Entertainment services, bookings, and creative media."
      />

      <div className="min-h-[80vh] flex items-center justify-center py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl w-full text-center space-y-8">
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="space-y-4"
          >
            <div className="inline-flex items-center justify-center h-24 w-24 rounded-3xl bg-orange-500/10 dark:bg-orange-500/5 text-orange-600 border border-orange-500/20 shadow-xl mb-2">
              <span className="text-4xl font-black font-mono">404</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-foreground">
              Page Not Found
            </h1>
            <p className="text-muted-foreground text-base sm:text-lg max-w-xl mx-auto leading-relaxed">
              The link you followed may be broken, updated, or mistyped. Let’s get you back on track to explore Grefas Consult & Entertainment.
            </p>
          </motion.div>

          {/* Key Quick Navigation Links Grid for Traffic Recovery & SEO */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-4 text-left"
          >
            <Link 
              to="/" 
              className="p-4 rounded-2xl border border-border bg-card hover:border-orange-500/50 hover:bg-orange-500/5 transition-all group flex items-start space-x-3.5 shadow-xs"
            >
              <div className="p-2.5 rounded-xl bg-orange-600/10 text-orange-600 shrink-0 group-hover:scale-110 transition-transform">
                <Home className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground group-hover:text-orange-600 transition-colors">Home Page</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Return to our main hub</p>
              </div>
            </Link>

            <Link 
              to="/services" 
              className="p-4 rounded-2xl border border-border bg-card hover:border-orange-500/50 hover:bg-orange-500/5 transition-all group flex items-start space-x-3.5 shadow-xs"
            >
              <div className="p-2.5 rounded-xl bg-orange-600/10 text-orange-600 shrink-0 group-hover:scale-110 transition-transform">
                <Briefcase className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground group-hover:text-orange-600 transition-colors">Services & Talent</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Consulting & entertainment</p>
              </div>
            </Link>

            <Link 
              to="/booking" 
              className="p-4 rounded-2xl border border-border bg-card hover:border-orange-500/50 hover:bg-orange-500/5 transition-all group flex items-start space-x-3.5 shadow-xs"
            >
              <div className="p-2.5 rounded-xl bg-orange-600/10 text-orange-600 shrink-0 group-hover:scale-110 transition-transform">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground group-hover:text-orange-600 transition-colors">Book a Session</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Reserve your appointment</p>
              </div>
            </Link>

            <Link 
              to="/gallery" 
              className="p-4 rounded-2xl border border-border bg-card hover:border-orange-500/50 hover:bg-orange-500/5 transition-all group flex items-start space-x-3.5 shadow-xs"
            >
              <div className="p-2.5 rounded-xl bg-orange-600/10 text-orange-600 shrink-0 group-hover:scale-110 transition-transform">
                <Film className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground group-hover:text-orange-600 transition-colors">Media Gallery</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Photos & video highlights</p>
              </div>
            </Link>

            <Link 
              to="/team" 
              className="p-4 rounded-2xl border border-border bg-card hover:border-orange-500/50 hover:bg-orange-500/5 transition-all group flex items-start space-x-3.5 shadow-xs"
            >
              <div className="p-2.5 rounded-xl bg-orange-600/10 text-orange-600 shrink-0 group-hover:scale-110 transition-transform">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground group-hover:text-orange-600 transition-colors">Our Team</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Meet specialists & leadership</p>
              </div>
            </Link>

            <Link 
              to="/contact" 
              className="p-4 rounded-2xl border border-border bg-card hover:border-orange-500/50 hover:bg-orange-500/5 transition-all group flex items-start space-x-3.5 shadow-xs"
            >
              <div className="p-2.5 rounded-xl bg-orange-600/10 text-orange-600 shrink-0 group-hover:scale-110 transition-transform">
                <Phone className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground group-hover:text-orange-600 transition-colors">Contact Us</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Inquiries & GPS directions</p>
              </div>
            </Link>
          </motion.div>

          <div className="pt-6 border-t border-border/60 flex items-center justify-center gap-4">
            <Button asChild size="lg" className="bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl px-6">
              <Link to="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Safety
              </Link>
            </Button>
          </div>

        </div>
      </div>
    </>
  );
}
