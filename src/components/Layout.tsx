import { ReactNode, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { Menu, X, Instagram, Facebook, Twitter, Phone, Mail, MapPin, Youtube, Music2, Sun, Moon, MessageCircle, Globe, ChevronDown, ExternalLink, Navigation, Wrench, Clock, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { safeGetLocalStorage, safeSetLocalStorage, safeGetSessionStorage, safeSetSessionStorage } from '@/lib/utils';
import Chat from './Chat';
import NotificationCenter from './NotificationCenter';
import { auth, db, handleFirestoreError, OperationType } from '@/firebase';
import { doc, onSnapshot, getDoc, setDoc, increment, serverTimestamp, collection, addDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { useLanguage, LANGUAGES } from '@/lib/LanguageContext';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Send } from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (safeGetLocalStorage('theme', 'light') as 'light' | 'dark');
  });
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== 'undefined' ? !navigator.onLine : false);
  const location = useLocation();

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      toast.success("Connection Connected!", {
        description: "Back online! Syncing live consultations with Grefas Consult hub.",
        duration: 4000
      });
    };
    const handleOffline = () => {
      setIsOffline(true);
      toast.info("Connectivity Notice", {
        description: "Operating in seamless offline mode. Cached records are secured locally.",
        duration: 5000
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    safeSetLocalStorage('theme', theme);
  }, [theme]);

  useEffect(() => {
    // Only track unique browser session visits
    if (!safeGetSessionStorage('has_registered_visit')) {
      try {
        safeSetSessionStorage('has_registered_visit', 'true');
        const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const visitDocRef = doc(db, 'site_visits', todayStr);
        setDoc(visitDocRef, {
          date: todayStr,
          count: increment(1),
          updatedAt: serverTimestamp()
        }, { merge: true }).catch(err => {
          console.warn("Could not register page visit:", err);
        });
      } catch (err) {
        console.warn("Tracking failed:", err);
      }
    }
  }, []);

  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [submittingNewsletter, setSubmittingNewsletter] = useState(false);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail || !newsletterEmail.trim()) {
      toast.error('Please enter a valid email address.');
      return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newsletterEmail.trim())) {
      toast.error('Please enter a valid email address.');
      return;
    }

    setSubmittingNewsletter(true);
    try {
      const email = newsletterEmail.trim().toLowerCase();
      await addDoc(collection(db, 'newsletter'), {
        email,
        createdAt: serverTimestamp(),
        active: true,
      });
      toast.success('Thank you for subscribing to our newsletter!');
      setNewsletterEmail('');
    } catch (error) {
      console.error('Subscription error:', error);
      toast.error('An error occurred. Please try again later.');
    } finally {
      setSubmittingNewsletter(false);
    }
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (authenticatedUser) => {
      setUser(authenticatedUser);
      if (authenticatedUser) {
        const userPath = `users/${authenticatedUser.uid}`;
        try {
          const userDoc = await getDoc(doc(db, 'users', authenticatedUser.uid));
          if (userDoc && userDoc.exists()) {
            setUserRole(userDoc.data().role);
          } else if (["serwaahlinda1995@gmail.com", "asantegrice@gmail.com", "asantegrifice@gmail.com", "oseikwameemmanuel33@gmail.com"].includes(authenticatedUser.email || "")) {
            setUserRole('admin');
          } else {
            setUserRole('guest');
          }
        } catch (error) {
          // Fallback to admin if it's the owner, even if offline
          if (["serwaahlinda1995@gmail.com", "asantegrice@gmail.com", "asantegrifice@gmail.com", "oseikwameemmanuel33@gmail.com"].includes(authenticatedUser.email || "")) {
            setUserRole('admin');
          } else {
            setUserRole('guest');
          }
          
          handleFirestoreError(error, OperationType.GET, userPath);
        }
      } else {
        setUserRole(null);
      }
    });

    const settingsPath = 'settings/global';
    const unsubscribeSettings = onSnapshot(doc(db, 'settings', 'global'), (doc) => {
      if (doc.exists()) {
        setSettings(doc.data());
      }
    }, (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, settingsPath);
      } catch (e) {
        console.error("Error fetching settings:", error);
      }
    });

    return () => {
      unsubscribeAuth();
      unsubscribeSettings();
    };
  }, []);

  const isAdmin = userRole === 'admin' || userRole === 'editor';

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const { t, language, setLanguage, currentLanguage } = useLanguage();
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);

  const navLinks = [
    { name: t('nav.home'), href: '/' },
    { name: t('nav.about'), href: '/about' },
    { name: t('nav.services'), href: '/services' },
    { name: t('nav.portfolio'), href: '/portfolio' },
    { name: t('nav.gallery'), href: '/gallery' },
    { name: t('nav.team'), href: '/team' },
    { name: t('nav.booking'), href: '/booking' },
    { name: t('nav.contact'), href: '/contact' },
    { name: t('nav.applications') || 'My Applications', href: '/my-applications' },
    { name: t('nav.admin'), href: '/admin' },
  ];


  const isActive = (path: string) => location.pathname === path;

  const isAdminRoute = location.pathname.startsWith('/admin');
  const isMaintenanceActive = settings?.isMaintenanceMode === true;
  const showMaintenancePage = isMaintenanceActive && !isAdmin && !isAdminRoute;

  if (showMaintenancePage) {
    return (
      <div className="min-h-screen bg-background font-sans text-foreground transition-colors duration-300 flex flex-col justify-between">
        {/* Simple Header */}
        <header className="p-6 border-b border-border/40 backdrop-blur-md sticky top-0 bg-background/55 z-50">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {settings?.logoUrl ? (
                <img src={settings.logoUrl} alt="Logo" className="h-9 w-auto rounded animate-pulse" referrerPolicy="no-referrer" />
              ) : (
                <span className="text-xl font-bold tracking-tighter text-foreground">
                  GREFAS<span className="text-orange-600">.</span>
                </span>
              )}
            </div>
            
            {/* Theme & support quick links */}
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                className="text-muted-foreground hover:text-foreground h-9 w-9 rounded-xl"
              >
                {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              </Button>
              {user ? (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => auth.signOut()}
                  className="text-xs font-semibold rounded-xl border-border/80 text-muted-foreground hover:text-foreground"
                >
                  {t('nav.signOut')}
                </Button>
              ) : (
                <Button 
                  variant="outline" 
                  size="sm"
                  asChild
                  className="text-xs font-semibold rounded-xl border-orange-500/30 text-orange-600 hover:text-orange-700 hover:bg-orange-600/10"
                >
                  <Link to="/admin">{t('nav.admin')}</Link>
                </Button>
              )}
            </div>
          </div>
        </header>

        {/* Center content */}
        <main className="flex-1 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="max-w-md w-full bg-card/40 border border-border/85 rounded-2xl p-6 sm:p-8 text-center shadow-2xl backdrop-blur-xs space-y-6"
          >
            <div className="mx-auto h-16 w-16 rounded-2xl bg-orange-500/10 dark:bg-orange-500/5 flex items-center justify-center border border-orange-500/20 text-orange-600 animate-bounce">
              <Wrench className="h-8 w-8 text-orange-600" />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
                Temporary Maintenance
              </h1>
              <p className="text-xs font-bold text-orange-600/90 dark:text-orange-500/95 tracking-wide uppercase font-mono bg-orange-500/5 py-1 px-3.5 rounded-full w-max mx-auto border border-orange-500/10">
                Enhancing Your Experience
              </p>
            </div>

            <div className="text-sm text-muted-foreground leading-relaxed bg-muted/20 p-4 rounded-xl border border-border/40 text-left">
              <p className="font-semibold text-xs mb-1.5 flex items-center gap-1.5 text-foreground uppercase tracking-wider">
                <Clock className="h-4 w-4 text-orange-600" /> Host message:
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground/90">
                {settings?.maintenanceMessage || "Our website is currently undergoing scheduled platform updates and database alignments. We will be back online shortly with improved speed and services!"}
              </p>
            </div>

            <div className="border-t border-border/40 my-2 pt-6">
              <p className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-widest mb-4">
                Need urgent assistance?
              </p>
              <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
                <Button 
                  asChild
                  variant="outline"
                  size="sm"
                  className="rounded-xl border-border/80 text-xs font-semibold hover:bg-muted"
                >
                  <a href={`mailto:${settings?.email || 'info@grefasconsultandentertainment.com'}?subject=Urgent%20Inquiry`}>
                    <Mail className="h-3.5 w-3.5 mr-1.5 text-orange-600" /> Email Us
                  </a>
                </Button>
                {settings?.phone && (
                  <Button 
                    asChild
                    variant="outline"
                    size="sm"
                    className="rounded-xl border-border/80 text-xs font-semibold hover:bg-muted"
                  >
                    <a href={`https://wa.me/${settings.phone.replace(/\D/g, '')}?text=${encodeURIComponent("Hello Grefas! The site is on maintenance, but I had an urgent inquiry.")}`} target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="h-3.5 w-3.5 mr-1.5 text-[#25D366] fill-[#25D366]/15" /> WhatsApp Support
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        </main>

        {/* Footer */}
        <footer className="py-6 border-t border-border/40 text-center text-xs text-muted-foreground">
          <div className="max-w-7xl mx-auto px-4">
            <p>© {new Date().getFullYear()} Grefas Consult & Entertainment. All rights reserved.</p>
            <p className="mt-1 opacity-75">Thank you for your patience and understanding.</p>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-sans text-foreground transition-colors duration-300">
      {/* Maintenance Mode active preview banner for Admins */}
      {isMaintenanceActive && isAdmin && !isAdminRoute && (
        <div className="fixed top-0 left-0 right-0 h-9 bg-orange-600 dark:bg-orange-700 text-white text-center text-[10px] sm:text-xs font-extrabold flex items-center justify-center gap-2 tracking-wide font-mono z-[9999] shadow-md px-3">
          <Wrench className="h-3.5 w-3.5 animate-spin shrink-0" />
          <span className="truncate">MAINTENANCE ACTIVE FOR VISITORS. ADMIN PREVIEW ACTIVE.</span>
          <Link 
            to="/admin/settings" 
            className="underline hover:text-orange-100 ml-2 font-bold shrink-0 flex items-center gap-1 bg-white/10 px-2 py-0.5 rounded text-[10px]"
          >
            Manage <ExternalLink className="h-2.5 w-2.5" />
          </Link>
        </div>
      )}

      {/* Navigation */}
      <nav 
        className="fixed z-50 w-full border-b border-border bg-background/80 backdrop-blur-md transition-all duration-300"
        style={{ top: isMaintenanceActive && isAdmin && !isAdminRoute ? '36px' : '0px' }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center space-x-2">
            {settings?.logoUrl ? (
              <img src={settings.logoUrl} alt="Logo" className="h-10 w-auto rounded" referrerPolicy="no-referrer" />
            ) : (
              <span className="text-2xl font-bold tracking-tighter text-foreground">
                GREFAS<span className="text-orange-600">.</span>
              </span>
            )}
          </Link>

          {/* Desktop Nav */}
          <div className="hidden items-center space-x-8 md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                to={link.href}
                className={`text-sm font-medium transition-colors hover:text-orange-600 ${
                  isActive(link.href) ? 'text-orange-600' : 'text-muted-foreground'
                }`}
              >
                {link.name}
              </Link>
            ))}
            <Button asChild size="sm" className="bg-orange-600 hover:bg-orange-700 text-white font-sans">
              <Link to="/booking">{t('nav.bookNow')}</Link>
            </Button>

            {/* Desktop Language Switcher */}
            <div className="relative">
              <button
                onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen)}
                onBlur={() => setTimeout(() => setIsLangDropdownOpen(false), 200)}
                className="flex items-center space-x-1.5 text-sm font-medium text-muted-foreground hover:text-orange-600 transition-colors focus:outline-none py-1.5"
                title={t('nav.chooseLanguage')}
              >
                <Globe className="h-4 w-4 text-orange-600" />
                <span>{currentLanguage.flag}</span>
                <span className="hidden lg:inline">{currentLanguage.name}</span>
                <ChevronDown className="h-3 w-3 opacity-60" />
              </button>
              {isLangDropdownOpen && (
                <div className="absolute right-0 mt-2 w-36 rounded-xl border border-border bg-card shadow-lg p-1 z-50 animate-in fade-in slide-in-from-top-1">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => {
                        setLanguage(lang.code);
                        setIsLangDropdownOpen(false);
                      }}
                      className={`flex w-full items-center space-x-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold transition-colors hover:bg-muted ${
                        language === lang.code ? 'text-orange-600 bg-orange-500/10' : 'text-foreground'
                      }`}
                    >
                      <span className="text-sm">{lang.flag}</span>
                      <span>{lang.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <NotificationCenter />
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="text-muted-foreground hover:text-foreground"
            >
              {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </Button>
            {user && (
              <button 
                onClick={() => auth.signOut()}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors hover:text-orange-600"
              >
                {t('nav.signOut')}
              </button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex items-center space-x-4 md:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="text-muted-foreground hover:text-foreground"
            >
              {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </Button>
            <NotificationCenter />
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-foreground"
            >
              {isMenuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="border-b border-border bg-background md:hidden"
          >
            <div className="space-y-1 px-4 pt-2 pb-6">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  to={link.href}
                  onClick={() => setIsMenuOpen(false)}
                  className={`block py-2 text-base font-medium ${
                    isActive(link.href) ? 'text-orange-600' : 'text-muted-foreground'
                  }`}
                >
                  {link.name}
                </Link>
              ))}
              {user && (
                <button
                  onClick={() => {
                    auth.signOut();
                    setIsMenuOpen(false);
                  }}
                  className="block w-full text-left py-2 text-base font-medium text-muted-foreground hover:text-orange-600"
                >
                  {t('nav.signOut')}
                </button>
              )}
              <div className="pt-4 mt-2 border-t border-border">
                <Button asChild className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold h-11 text-sm rounded-xl py-3 flex items-center justify-center">
                  <Link to="/booking" onClick={() => setIsMenuOpen(false)}>{t('nav.bookSessionNow')}</Link>
                </Button>
              </div>

              {/* Language Switcher in Mobile Nav */}
              <div className="pt-4 mt-2 border-t border-border">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5 p-1">
                  <Globe className="h-3.5 w-3.5 text-orange-600" /> {t('nav.chooseLanguage')}
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => setLanguage(lang.code)}
                      className={`flex flex-col items-center justify-center rounded-xl p-2.5 border transition-all ${
                        language === lang.code
                          ? 'border-orange-500 bg-orange-500/10 text-orange-600 font-bold'
                          : 'border-border bg-muted/30 text-muted-foreground'
                      }`}
                    >
                      <span className="text-lg">{lang.flag}</span>
                      <span className="text-[10px] mt-1 font-semibold">{lang.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </nav>

      <main 
        className="transition-all duration-300"
        style={{ paddingTop: isMaintenanceActive && isAdmin && !isAdminRoute ? '100px' : '64px' }}
      >
        {isOffline && (
          <div className="bg-amber-600/10 border-b border-amber-600/10 dark:border-amber-400/10 px-4 py-2 text-center text-[11px] text-amber-700 dark:text-amber-400 font-extrabold tracking-wide uppercase flex items-center justify-center gap-1.5 animate-pulse">
            <ShieldAlert className="h-4 w-4 shrink-0 text-amber-500 animate-spin" />
            <span>Operational Mode: Offline cache loaded. Some resources may load when internet connects. Your local edits are safe!</span>
          </div>
        )}
        {children}
      </main>

      <Chat />

      {/* Footer */}
      <footer className="border-t border-border bg-card py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
            <div className="col-span-1">
              <Link to="/" className="flex items-center space-x-2">
                {settings?.logoUrl ? (
                  <img src={settings.logoUrl} alt="Logo" className="h-12 w-auto rounded" referrerPolicy="no-referrer" />
                ) : (
                  <span className="text-2xl font-bold tracking-tighter text-foreground">
                    GREFAS<span className="text-orange-600">.</span>
                  </span>
                )}
              </Link>
              <p className="mt-4 max-w-xs text-muted-foreground text-sm">
                {t('footer.description')}
              </p>
              <div className="mt-6 flex space-x-4">
                {settings?.facebook && (
                  <a href={settings.facebook} target="_blank" rel="noopener noreferrer">
                    <Facebook className="h-5 w-5 cursor-pointer text-muted-foreground hover:text-orange-600" />
                  </a>
                )}
                {settings?.youtube && (
                  <a href={settings.youtube} target="_blank" rel="noopener noreferrer">
                    <Youtube className="h-5 w-5 cursor-pointer text-muted-foreground hover:text-orange-600" />
                  </a>
                )}
                {settings?.tiktok && (
                  <a href={settings.tiktok} target="_blank" rel="noopener noreferrer">
                    <Music2 className="h-5 w-5 cursor-pointer text-muted-foreground hover:text-orange-600" />
                  </a>
                )}
                <Instagram className="h-5 w-5 cursor-pointer text-muted-foreground hover:text-orange-600" />
                <Twitter className="h-5 w-5 cursor-pointer text-muted-foreground hover:text-orange-600" />
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">{t('footer.contactUs')}</h3>
              <ul className="mt-4 space-y-2">
                <li className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <span>{settings?.email || 'info@grefasconsultandentertainment.com'}</span>
                </li>
                <li className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  <span>{settings?.phone || '+233 123 456 789'}</span>
                </li>
                <li className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <MessageCircle className="h-4 w-4 text-[#25D366] fill-[#25D366]/20" />
                  <a
                    href={`https://wa.me/${(settings?.phone || '+233123456789').replace(/\D/g, '')}?text=${encodeURIComponent("Hello! I would like to inquire about Grefas Consult & Entertainment.")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-orange-600 transition-colors animate-pulse"
                  >
                    Chat on WhatsApp
                  </a>
                </li>
                <li className="flex flex-col gap-1 text-sm text-muted-foreground mt-1">
                  <div className="flex items-center space-x-2">
                    <MapPin className="h-4 w-4 shrink-0 text-orange-600" />
                    <span>{settings?.address || 'Nyinahin-Ashanti, Ashanti Region, Ghana'}</span>
                  </div>
                  <div className="flex items-center gap-2 ml-6">
                    <span className="text-[11px] font-medium text-orange-600 dark:text-orange-500 bg-orange-50 dark:bg-orange-950/40 px-2 py-0.5 rounded w-max">
                      GPS Address: AI-0008-9223
                    </span>
                    <a
                      href="https://www.google.com/maps/dir/?api=1&destination=AI-0008-9223,+Nyinahin-Ashanti,+Ashanti+Region,+Ghana"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-semibold text-orange-600 dark:text-orange-500 hover:underline flex items-center gap-0.5"
                    >
                      <span>Directions</span>
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </div>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">{t('footer.quickLinks')}</h3>
              <ul className="mt-4 space-y-2">
                {navLinks.map((link) => (
                  <li key={link.name}>
                    <Link to={link.href} className="text-sm text-muted-foreground hover:text-orange-600" id={`footer-link-${link.name.toLowerCase().replace(/\s+/g, '-')}`}>
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">Newsletter</h3>
              <p className="mt-4 text-sm text-muted-foreground">
                Subscribe to receive our latest updates, articles, and exclusive business & event offers direct to your inbox.
              </p>
              <form onSubmit={handleSubscribe} className="mt-4 flex flex-col space-y-2" id="newsletter-signup-form">
                <div className="relative">
                  <Input
                    type="email"
                    placeholder="Enter your email"
                    value={newsletterEmail}
                    onChange={(e) => setNewsletterEmail(e.target.value)}
                    required
                    className="w-full bg-muted/40 border-border/80 text-sm focus-visible:ring-orange-500 pr-10"
                    id="newsletter-email-input"
                  />
                  <button
                    type="submit"
                    disabled={submittingNewsletter}
                    className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded bg-orange-600 text-white hover:bg-orange-700 transition disabled:opacity-50 cursor-pointer"
                    id="newsletter-subscribe-button"
                    title="Subscribe"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
                <span className="text-[10px] text-muted-foreground/80 font-mono">
                  No spam. Unsubscribe at any time.
                </span>
              </form>
            </div>
          </div>
          <div className="mt-12 border-t border-border pt-8 text-center text-sm text-muted-foreground">
            <p>© {new Date().getFullYear()} Grefas Consult & Entertainment. {t('footer.copyright')}</p>
            <p className="mt-2 text-xs opacity-70">
              Grefas Consult & Entertainment was generated using <a href="https://ai.studio" target="_blank" rel="noopener noreferrer" className="hover:text-orange-600 underline decoration-orange-600/30">Google AI Studio</a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
