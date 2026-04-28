import { ReactNode, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { Menu, X, Instagram, Facebook, Twitter, Phone, Mail, MapPin, Youtube, Music2, Sun, Moon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import Chat from './Chat';
import NotificationCenter from './NotificationCenter';
import { auth, db } from '@/firebase';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
    }
    return 'light';
  });
  const location = useLocation();

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (authenticatedUser) => {
      setUser(authenticatedUser);
      if (authenticatedUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', authenticatedUser.uid));
          if (userDoc.exists()) {
            setUserRole(userDoc.data().role);
          } else if (authenticatedUser.email === "serwaahlinda1995@gmail.com") {
            setUserRole('admin');
          } else {
            setUserRole('guest');
          }
        } catch (error) {
          console.error("Error fetching role in layout:", error);
          if (authenticatedUser.email === "serwaahlinda1995@gmail.com") {
            setUserRole('admin');
          } else {
            setUserRole('guest');
          }
        }
      } else {
        setUserRole(null);
      }
    });

    const unsubscribeSettings = onSnapshot(doc(db, 'settings', 'global'), (doc) => {
      if (doc.exists()) {
        setSettings(doc.data());
      }
    }, (error) => {
      console.error("Error fetching settings:", error);
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

  const navLinks = [
    { name: 'Home', href: '/' },
    { name: 'About', href: '/about' },
    { name: 'Services', href: '/services' },
    { name: 'Portfolio', href: '/portfolio' },
    { name: 'Gallery', href: '/gallery' },
    { name: 'Booking', href: '/booking' },
    { name: 'Contact', href: '/contact' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-background font-sans text-foreground transition-colors duration-300">
      {/* Navigation */}
      <nav className="fixed top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
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
            <Button asChild size="sm" className="bg-orange-600 hover:bg-orange-700 text-white">
              <Link to="/booking">Book Now</Link>
            </Button>
            <NotificationCenter />
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="text-muted-foreground hover:text-foreground"
            >
              {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </Button>
            {isAdmin ? (
              <Link to="/admin" className="text-sm font-medium text-orange-600">
                Dashboard
              </Link>
            ) : user ? (
              <button 
                onClick={() => auth.signOut()}
                className="text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                Sign Out
              </button>
            ) : (
              <Link to="/admin" className="text-sm font-medium text-muted-foreground hover:text-foreground">
                Sign In
              </Link>
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
              {isAdmin ? (
                <Link
                  to="/admin"
                  onClick={() => setIsMenuOpen(false)}
                  className="block py-2 text-base font-medium text-orange-600"
                >
                  Dashboard
                </Link>
              ) : user ? (
                <button
                  onClick={() => {
                    auth.signOut();
                    setIsMenuOpen(false);
                  }}
                  className="block w-full text-left py-2 text-base font-medium text-muted-foreground"
                >
                  Sign Out
                </button>
              ) : (
                <Link
                  to="/admin"
                  onClick={() => setIsMenuOpen(false)}
                  className="block py-2 text-base font-medium text-muted-foreground"
                >
                  Admin Login
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </nav>

      <main className="pt-16">{children}</main>

      <Chat />

      {/* Footer */}
      <footer className="border-t border-border bg-card py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
            <div className="col-span-1 md:col-span-2">
              <Link to="/" className="flex items-center space-x-2">
                {settings?.logoUrl ? (
                  <img src={settings.logoUrl} alt="Logo" className="h-12 w-auto rounded" referrerPolicy="no-referrer" />
                ) : (
                  <span className="text-2xl font-bold tracking-tighter text-foreground">
                    GREFAS<span className="text-orange-600">.</span>
                  </span>
                )}
              </Link>
              <p className="mt-4 max-w-xs text-muted-foreground">
                Professional consulting and entertainment services tailored to your needs. 
                Excellence in every project we undertake.
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
              <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">Contact</h3>
              <ul className="mt-4 space-y-2">
                <li className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <span>{settings?.email || 'info@grefas.com'}</span>
                </li>
                <li className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  <span>{settings?.phone || '+233 123 456 789'}</span>
                </li>
                <li className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span>{settings?.address || 'Accra, Ghana'}</span>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">Quick Links</h3>
              <ul className="mt-4 space-y-2">
                {navLinks.map((link) => (
                  <li key={link.name}>
                    <Link to={link.href} className="text-sm text-muted-foreground hover:text-orange-600">
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-12 border-t border-border pt-8 text-center text-sm text-muted-foreground">
            <p>© {new Date().getFullYear()} Grefas Consult & Entertainment. All rights reserved.</p>
            <p className="mt-2 text-xs opacity-70">
              Grefas Consult & Entertainment was generated using <a href="https://ai.studio" target="_blank" rel="noopener noreferrer" className="hover:text-orange-600 underline decoration-orange-600/30">Google AI Studio</a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
