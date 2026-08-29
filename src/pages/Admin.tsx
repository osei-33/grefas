import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { Routes, Route, Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LayoutDashboard, RefreshCw, Zap, Radio, Check, Image as ImageIcon, Briefcase, LogOut, Plus, Trash2, Loader2, FolderOpen, Settings as SettingsIcon, Save, Info, Phone, Mail, MapPin, Quote, Calendar as CalendarIcon, Users, Youtube, Facebook, Music2, AlertCircle, Bell, MessageCircle, CheckCircle, Menu, X, ListTodo, Clock, Search, ChevronLeft, ChevronRight, Grid, List, Download, FileSpreadsheet, FileText, Printer, Camera, Edit, BookOpen, Wrench, User as UserIcon, Star, Megaphone, CreditCard, ShieldCheck, Upload, Ticket, DollarSign, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownLeft, Wallet, Play, UserCheck, Paperclip, ExternalLink, Eye, Lock, Globe, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isToday, addMonths, subMonths, parseISO } from 'date-fns';
import { auth, db, storage, handleFirestoreError, OperationType } from '@/firebase';
import { logAuditActivity } from '@/lib/auditLogger';
import { compressImage, blobToBase64 } from '@/lib/utils';
import { 
  signInWithEmailAndPassword, 
  onAuthStateChanged, 
  signOut,
  User
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  orderBy,
  serverTimestamp,
  getDocs,
  getDoc,
  setDoc,
  where,
  updateDoc,
  deleteField
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import ManageBlog from './ManageBlog';
import SmsDashboard from '@/components/SmsDashboard';
import ManageLetters from '@/components/ManageLetters';
import ManageEmployeesPayroll from '@/components/ManageEmployeesPayroll';
import ManageLegalPolicies from '@/components/ManageLegalPolicies';
import ManageSitemap from './ManageSitemap';
import SEO from '@/components/SEO';
import { getPaystackWebhookEvents, simulateTestWebhook } from '@/lib/paystack';

const isAdminEmail = (email: string | null | undefined) => {
  if (!email) return false;
  const cleanEmail = email.toLowerCase().trim();
  const hardcodedAdmins = ["serwaahlinda1995@gmail.com", "asantegrice@gmail.com", "asantegrifice@gmail.com", "oseikwameemmanuel33@gmail.com"];
  
  let envAdmins: string[] = [];
  try {
    const envEmails = (import.meta as any).env?.VITE_ADMIN_EMAILS || "";
    if (envEmails) {
      envAdmins = String(envEmails).split(",").map((e: string) => e.trim().toLowerCase());
    }
  } catch (e) {
    console.warn("Could not read VITE_ADMIN_EMAILS from env:", e);
  }
  
  return hardcodedAdmins.includes(cleanEmail) || envAdmins.includes(cleanEmail);
};

function AdminDeleteModal({ 
  title = "Confirm Deletion", 
  message, 
  onConfirm, 
  onCancel 
}: { 
  title?: string; 
  message: string; 
  onConfirm: () => void | Promise<void>; 
  onCancel: () => void; 
}) {
  const [isDeleting, setIsDeleting] = useState(false);
  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      await onConfirm();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] animate-in fade-in">
      <div className="bg-card border border-border rounded-xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
        <h3 className="text-base font-bold text-foreground mb-2 flex items-center gap-2">
          <Trash2 className="h-5 w-5 text-red-500 animate-bounce" /> {title}
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed mb-6">
          {message}
        </p>
        <div className="flex justify-end gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onCancel}
            disabled={isDeleting}
            className="text-xs font-semibold"
          >
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            size="sm" 
            onClick={handleConfirm}
            disabled={isDeleting}
            className="text-xs font-semibold flex items-center gap-1"
          >
            {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            Yes, Delete It
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function Admin() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const hasAdminAccess = role === 'admin' || role === 'editor' || isAdminEmail(user?.email);

  // Session inactivity/expiration management
  const lastActivityRef = useRef<number>(Date.now());
  const [secondsRemaining, setSecondsRemaining] = useState<number>(900); // 15 mins
  const [showSessionWarning, setShowSessionWarning] = useState<boolean>(false);

  useEffect(() => {
    if (!user || !hasAdminAccess) return;

    const resetTimer = () => {
      lastActivityRef.current = Date.now();
      // Keep state values accurate but don't force state changes if not needed
      setSecondsRemaining(900);
      setShowSessionWarning(false);
    };

    // User interactions to reset inactivity timer
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => {
      window.addEventListener(event, resetTimer);
    });

    const timer = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.floor((now - lastActivityRef.current) / 1000);
      const remaining = Math.max(0, 900 - elapsed);
      setSecondsRemaining(remaining);

      if (remaining <= 120 && remaining > 0) {
        setShowSessionWarning(true);
      } else if (remaining === 0) {
        clearInterval(timer);
        setShowSessionWarning(false);
        // Secure automatic logout when the countdown reaches zero
        (async () => {
          try {
            await signOut(auth);
            toast.error('Session Expired', {
              description: 'Your administrator session has expired due to inactivity to safeguard company data.',
              duration: 10000,
              icon: <AlertCircle className="h-5 w-5 text-red-500 animate-bounce" />,
            });
            navigate('/admin');
          } catch (err) {
            console.error("Session auto-logout failed:", err);
          }
        })();
      } else {
        setShowSessionWarning(false);
      }
    }, 1000);

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
      clearInterval(timer);
    };
  }, [user, role, navigate]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isActive = (path: string) => {
    if (path === '/admin') {
      return location.pathname === '/admin' || location.pathname === '/admin/';
    }
    return location.pathname.startsWith(path);
  };

  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
      }

      setUser(user);
      if (user) {
        // First, set a default role based on email if it's the owner
        if (isAdminEmail(user.email)) {
          setRole('admin');
          // Automatically register or ensure admin user exists in DB
          setDoc(doc(db, 'users', user.uid), {
            email: user.email,
            role: 'admin'
          }, { merge: true }).catch((err) => {
            console.warn("Failed to automatically register admin in firestore:", err);
          });
        }

        // Listen for user document changes
        unsubscribeSnapshot = onSnapshot(doc(db, 'users', user.uid), async (docSnap) => {
          if (isAdminEmail(user.email)) {
            setRole('admin');
          } else if (docSnap && docSnap.exists() && docSnap.data()?.role) {
            setRole(docSnap.data().role);
          } else {
            // Check if there is a pre-authorized role for this user's email
            try {
              const cleanEmail = user.email ? user.email.toLowerCase().trim() : '';
              if (cleanEmail) {
                const usersRef = collection(db, 'users');
                const q = query(usersRef, where('email', '==', cleanEmail));
                const querySnapshot = await getDocs(q);
                if (!querySnapshot.empty) {
                  const preAuthDoc = querySnapshot.docs[0];
                  const assignedRole = preAuthDoc.data().role || 'guest';
                  setRole(assignedRole);
                  // Sync role to real user UID document
                  await setDoc(doc(db, 'users', user.uid), {
                    email: cleanEmail,
                    fullName: user.displayName || preAuthDoc.data().fullName || '',
                    role: assignedRole,
                    updatedAt: serverTimestamp()
                  }, { merge: true });
                  // Cleanup orphaned pre-auth document if different ID
                  if (preAuthDoc.id !== user.uid) {
                    await deleteDoc(doc(db, 'users', preAuthDoc.id));
                  }
                } else {
                  setRole('guest');
                }
              } else {
                setRole('guest');
              }
            } catch (err) {
              console.warn("Could not check pre-authorized user role:", err);
              setRole('guest');
            }
          }
          setLoading(false);
        }, (error) => {
          // Check if it's an offline error
          const errorMsg = error instanceof Error ? error.message : String(error);
          const lowercaseError = errorMsg.toLowerCase();
          if (
            lowercaseError.includes('offline') || 
            lowercaseError.includes('could not reach') || 
            lowercaseError.includes('unavailable') ||
            lowercaseError.includes('connection failed') || 
            lowercaseError.includes('network')
          ) {
            console.debug("Firestore offline - sticking with default role for email");
            // We already set role to admin above if isAdminEmail(user.email)
          } else {
            console.error("Error listening to user role:", error);
            if (!isAdminEmail(user.email)) {
              setRole('guest');
            }
          }
          setLoading(false);
        });
      } else {
        setRole(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, []);

  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
  const [showMobileNotifications, setShowMobileNotifications] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const mobileDropdownRef = useRef<HTMLDivElement>(null);

  const formatNotificationTime = (timestamp: any) => {
    if (!timestamp) return 'Just now';
    try {
      let date: Date;
      if (typeof timestamp.toDate === 'function') {
        date = timestamp.toDate();
      } else if (timestamp instanceof Date) {
        date = timestamp;
      } else if (timestamp.seconds) {
        date = new Date(timestamp.seconds * 1000);
      } else {
        date = new Date(timestamp);
      }
      if (isNaN(date.getTime())) return 'Just now';
      return format(date, 'MMM d, h:mm a');
    } catch (e) {
      return 'Just now';
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowNotificationsDropdown(false);
      }
      if (mobileDropdownRef.current && !mobileDropdownRef.current.contains(event.target as Node)) {
        setShowMobileNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (!user || !hasAdminAccess) return;

    const notifQuery = query(
      collection(db, 'notifications'),
      where('userId', '==', 'admin'),
      orderBy('createdAt', 'desc')
    );

    let isInitialLoad = true;

    const unsubscribe = onSnapshot(notifQuery, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];

      setNotifications(docs);

      if (!isInitialLoad) {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const data = change.doc.data();
            toast.success(data.title || 'New Notification', {
              description: data.message || 'A new appointment booking was submitted.',
              duration: 8000,
              icon: <Bell className="h-5 w-5 text-orange-600 animate-bounce" />,
            });
            try {
              const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
              const osc = audioCtx.createOscillator();
              const gain = audioCtx.createGain();
              osc.connect(gain);
              gain.connect(audioCtx.destination);
              osc.type = 'sine';
              osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); 
              osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); 
              gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
              osc.start(audioCtx.currentTime);
              osc.stop(audioCtx.currentTime + 0.35);
            } catch (soundErr) {
              console.debug("Sound blocked or API not supported", soundErr);
            }
          }
        });
      }
      isInitialLoad = false;
    }, (error) => {
      console.warn("Error listening to admin notifications:", error);
    });

    return () => {
      unsubscribe();
    };
  }, [user, role]);

  const handleMarkAllNotificationsAsRead = async () => {
    try {
      const unreadNotifs = notifications.filter(n => !n.read);
      const promises = unreadNotifs.map(n => 
        setDoc(doc(db, 'notifications', n.id), { read: true }, { merge: true })
      );
      await Promise.all(promises);
      toast.success('All notifications marked as read.');
    } catch (err) {
      console.error("Error marking notifications as read:", err);
      toast.error('Failed to mark notifications as read.');
    }
  };

  const handleDeleteNotification = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteDoc(doc(db, 'notifications', id));
      toast.success('Notification cleared.');
    } catch (err) {
      console.error("Error deleting notification:", err);
      toast.error('Failed to clear notification.');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success('Logged out successfully');
      navigate('/');
    } catch (error) {
      toast.error('Logout failed');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  if (!hasAdminAccess) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-4 text-center px-4">
        <AlertCircle className="h-12 w-12 text-red-500" />
        <h2 className="text-2xl font-bold">Access Denied</h2>
        <p className="text-zinc-500 max-w-md">You do not have administrator permission to access the admin panel. Please contact the administrator if you believe this is an error.</p>
        <div className="flex gap-4">
          <Button variant="outline" onClick={handleLogout}>Logout</Button>
          <Button className="bg-orange-600 hover:bg-orange-700" onClick={() => navigate('/')}>Return Home</Button>
        </div>
      </div>
    );
  }

  const renderNotificationsPanel = (isOpen: boolean, onClose: () => void, isMobile: boolean) => {
    if (!isOpen) return null;

    return (
      <div className={`absolute ${isMobile ? 'right-0 top-12' : 'right-0 top-10'} w-80 md:w-96 rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl z-50 p-4 animate-in fade-in slide-in-from-top-2 text-left`}>
        <div className="flex items-center justify-between border-b border-border pb-2 mb-3">
          <h3 className="font-bold text-sm text-foreground flex items-center gap-1.5">
            <Bell className="h-4 w-4 text-orange-600 animate-pulse" /> Recent Bookings
          </h3>
          {notifications.some(n => !n.read) && (
            <button
              onClick={handleMarkAllNotificationsAsRead}
              className="text-[11px] font-semibold text-orange-600 hover:text-orange-700 hover:underline transition"
            >
              Mark all read
            </button>
          )}
        </div>

        <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
          {notifications.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground italic">
              No recent bookings matching.
            </div>
          ) : (
            notifications.map(n => (
              <div
                key={n.id}
                onClick={async () => {
                  if (!n.read) {
                    try {
                      await setDoc(doc(db, 'notifications', n.id), { read: true }, { merge: true });
                    } catch (err) {
                      console.error("Failed to mark as read:", err);
                    }
                  }
                }}
                className={`p-3 rounded-lg border text-xs relative cursor-pointer hover:bg-muted transition-all ${
                  n.read 
                    ? 'bg-card/40 border-border text-muted-foreground' 
                    : 'bg-orange-50/50 dark:bg-orange-950/20 border-orange-100 dark:border-orange-900/30 text-foreground font-medium shadow-sm'
                }`}
              >
                <div className="flex justify-between items-start gap-2 mb-1">
                  <span className="font-bold text-foreground">
                    {n.title || 'Notification'}
                  </span>
                  <span className="text-[9px] text-muted-foreground font-mono whitespace-nowrap">
                    {formatNotificationTime(n.createdAt)}
                  </span>
                </div>
                <p className="line-clamp-3 leading-relaxed mb-1.5 text-xs text-foreground/80">{n.message}</p>
                {n.orderNumber && (
                  <div className="inline-flex items-center gap-1 bg-muted px-2 py-0.5 rounded text-[9px] font-mono select-all">
                    Order: {n.orderNumber}
                  </div>
                )}
                <button
                  onClick={(e) => handleDeleteNotification(n.id, e)}
                  className="absolute right-2 bottom-2 text-muted-foreground hover:text-red-600 transition p-1"
                  title="Clear notification"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col md:flex-row min-h-[80vh] bg-background relative overflow-hidden">
      <SEO 
        title="Admin Portal" 
        description="Secure management portal for Grefas Consult & Entertainment in Nyinahin-Ashanti, Ghana." 
      />
      {/* Mobile Sidebar Toggle */}
      <div className="md:hidden flex items-center p-4 border-b border-border bg-card justify-between sticky top-0 z-30">
        <h2 className="text-sm font-bold text-orange-600">Admin Panel</h2>
        
        <div className="flex items-center gap-2">
          {/* Mobile Notifications Bell */}
          <div className="relative" ref={mobileDropdownRef}>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowMobileNotifications(!showMobileNotifications)}
              className="relative h-9 w-9 text-muted-foreground hover:text-orange-600 hover:bg-muted"
            >
              <Bell className={`h-5 w-5 ${notifications.some(n => !n.read) ? 'text-orange-600 animate-bounce' : ''}`} />
              {notifications.some(n => !n.read) && (
                <span className="absolute top-1.5 right-1.5 flex h-2 w-2 rounded-full bg-red-600 animate-pulse" />
              )}
            </Button>
            {renderNotificationsPanel(showMobileNotifications, () => setShowMobileNotifications(false), true)}
          </div>

          <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
            {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Sidebar Backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-64 border-r border-border bg-card p-6 transition-transform duration-300 md:relative md:translate-x-0 md:block
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Main Navigation</h2>
              
              {/* Desktop Notifications Bell */}
              <div className="relative" ref={dropdownRef}>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowNotificationsDropdown(!showNotificationsDropdown)}
                  className="relative h-8 w-8 text-muted-foreground hover:text-orange-600 hover:bg-muted"
                >
                  <Bell className={`h-[18px] w-[18px] ${notifications.some(n => !n.read) ? 'text-orange-600 animate-bounce' : ''}`} />
                  {notifications.some(n => !n.read) && (
                    <span className="absolute top-1 right-1 flex h-2 w-2 rounded-full bg-red-600 animate-pulse" />
                  )}
                </Button>
                {renderNotificationsPanel(showNotificationsDropdown, () => setShowNotificationsDropdown(false), false)}
              </div>
            </div>
            <nav className="space-y-1">
              <Link
                to="/admin"
                onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center space-x-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                  isActive('/admin') 
                    ? 'bg-orange-50 text-orange-600 dark:bg-orange-900/10' 
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <LayoutDashboard className={`h-4 w-4 ${isActive('/admin') ? 'text-orange-600' : ''}`} />
                <span>Dashboard</span>
                {isActive('/admin') && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-orange-600" />}
              </Link>
              <Link
                to="/admin/services"
                onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center space-x-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                  isActive('/admin/services') 
                    ? 'bg-orange-50 text-orange-600 dark:bg-orange-900/10' 
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Briefcase className={`h-4 w-4 ${isActive('/admin/services') ? 'text-orange-600' : ''}`} />
                <span>Manage Services</span>
                {isActive('/admin/services') && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-orange-600" />}
              </Link>
              <Link
                to="/admin/intakes"
                onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center space-x-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                  isActive('/admin/intakes') 
                    ? 'bg-orange-50 text-orange-600 dark:bg-orange-900/10' 
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <FileText className={`h-4 w-4 ${isActive('/admin/intakes') ? 'text-orange-600' : ''}`} />
                <span>Client Intakes</span>
                {isActive('/admin/intakes') && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-orange-600" />}
              </Link>
              <Link
                to="/admin/careers"
                onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center space-x-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                  isActive('/admin/careers') || isActive('/admin/career-applications')
                    ? 'bg-orange-50 text-orange-600 dark:bg-orange-900/10' 
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <UserCheck className={`h-4 w-4 ${isActive('/admin/careers') || isActive('/admin/career-applications') ? 'text-orange-600' : ''}`} />
                <span>Career Applications</span>
                {(isActive('/admin/careers') || isActive('/admin/career-applications')) && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-orange-600" />}
              </Link>
              <Link
                to="/admin/gallery"
                onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center space-x-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                  isActive('/admin/gallery') 
                    ? 'bg-orange-50 text-orange-600 dark:bg-orange-900/10' 
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <ImageIcon className={`h-4 w-4 ${isActive('/admin/gallery') ? 'text-orange-600' : ''}`} />
                <span>Manage Gallery</span>
                {isActive('/admin/gallery') && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-orange-600" />}
              </Link>
              <Link
                to="/admin/portfolio"
                onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center space-x-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                  isActive('/admin/portfolio') 
                    ? 'bg-orange-50 text-orange-600 dark:bg-orange-900/10' 
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <FolderOpen className={`h-4 w-4 ${isActive('/admin/portfolio') ? 'text-orange-600' : ''}`} />
                <span>Manage Portfolio</span>
                {isActive('/admin/portfolio') && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-orange-600" />}
              </Link>
              <Link
                to="/admin/blog"
                onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center space-x-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                  isActive('/admin/blog') 
                    ? 'bg-orange-50 text-orange-600 dark:bg-orange-900/10' 
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <BookOpen className={`h-4 w-4 ${isActive('/admin/blog') ? 'text-orange-600' : ''}`} />
                <span>Manage Blog</span>
                {isActive('/admin/blog') && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-orange-600" />}
              </Link>
              <Link
                to="/admin/bookings"
                onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center space-x-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                  isActive('/admin/bookings') 
                    ? 'bg-orange-50 text-orange-600 dark:bg-orange-900/10' 
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <CalendarIcon className={`h-4 w-4 ${isActive('/admin/bookings') ? 'text-orange-600' : ''}`} />
                <span>Manage Bookings</span>
                {isActive('/admin/bookings') && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-orange-600" />}
              </Link>
              <Link
                to="/admin/team"
                onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center space-x-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                  isActive('/admin/team') 
                    ? 'bg-orange-50 text-orange-600 dark:bg-orange-900/10' 
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Users className={`h-4 w-4 ${isActive('/admin/team') ? 'text-orange-600' : ''}`} />
                <span>Manage Team</span>
                {isActive('/admin/team') && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-orange-600" />}
              </Link>
              <Link
                to="/admin/tasks"
                onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center space-x-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                  isActive('/admin/tasks') 
                    ? 'bg-orange-50 text-orange-600 dark:bg-orange-900/10' 
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <ListTodo className={`h-4 w-4 ${isActive('/admin/tasks') ? 'text-orange-600' : ''}`} />
                <span>Internal Tasks</span>
                {isActive('/admin/tasks') && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-orange-600" />}
              </Link>
              <Link
                to="/admin/newsletter"
                onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center space-x-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                  isActive('/admin/newsletter') 
                    ? 'bg-orange-50 text-orange-600 dark:bg-orange-900/10' 
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
                id="admin-nav-newsletter"
              >
                <Mail className={`h-4 w-4 ${isActive('/admin/newsletter') ? 'text-orange-600' : ''}`} />
                <span>Mailing List</span>
                {isActive('/admin/newsletter') && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-orange-600" />}
              </Link>
              <Link
                to="/admin/letters"
                onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center space-x-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                  isActive('/admin/letters') 
                    ? 'bg-orange-50 text-orange-600 dark:bg-orange-900/10' 
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
                id="admin-nav-letters"
              >
                <FileText className={`h-4 w-4 ${isActive('/admin/letters') ? 'text-orange-600' : ''}`} />
                <span>Official Letters</span>
                {isActive('/admin/letters') && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-orange-600" />}
              </Link>
              <Link
                to="/admin/payroll"
                onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center space-x-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                  isActive('/admin/payroll') 
                    ? 'bg-orange-50 text-orange-600 dark:bg-orange-900/10' 
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
                id="admin-nav-payroll"
              >
                <CreditCard className={`h-4 w-4 ${isActive('/admin/payroll') ? 'text-orange-600' : ''}`} />
                <span>Staff & Payroll</span>
                {isActive('/admin/payroll') && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-orange-600" />}
              </Link>
              <Link
                to="/admin/transactions"
                onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center space-x-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                  isActive('/admin/transactions') 
                    ? 'bg-orange-50 text-orange-600 dark:bg-orange-900/10' 
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
                id="admin-nav-transactions"
              >
                <Wallet className={`h-4 w-4 ${isActive('/admin/transactions') ? 'text-orange-600' : ''}`} />
                <span>Financial Ledger</span>
                {isActive('/admin/transactions') && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-orange-600" />}
              </Link>
              <Link
                to="/admin/testimonials"
                onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center space-x-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                  isActive('/admin/testimonials') 
                    ? 'bg-orange-50 text-orange-600 dark:bg-orange-900/10' 
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
                id="admin-nav-testimonials"
              >
                <Quote className={`h-4 w-4 ${isActive('/admin/testimonials') ? 'text-orange-600' : ''}`} />
                <span>Testimonials</span>
                {isActive('/admin/testimonials') && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-orange-600" />}
              </Link>
              <Link
                to="/admin/announcements"
                onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center space-x-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                  isActive('/admin/announcements') 
                    ? 'bg-orange-50 text-orange-600 dark:bg-orange-900/10' 
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
                id="admin-nav-announcements"
              >
                <Megaphone className={`h-4 w-4 ${isActive('/admin/announcements') ? 'text-orange-600' : ''}`} />
                <span>Visitor Alerts</span>
                {isActive('/admin/announcements') && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-orange-600" />}
              </Link>
              <Link
                to="/admin/profile"
                onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center space-x-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                  isActive('/admin/profile') 
                    ? 'bg-orange-50 text-orange-600 dark:bg-orange-900/10' 
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
                id="admin-nav-profile"
              >
                <UserIcon className={`h-4 w-4 ${isActive('/admin/profile') ? 'text-orange-600' : ''}`} />
                <span>My Profile & Signature</span>
                {isActive('/admin/profile') && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-orange-600" />}
              </Link>
              {hasAdminAccess && (
                <>
                  <div className="pt-4 pb-2">
                    <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-3">System Control</h2>
                  </div>
                  <Link
                    to="/admin/activity"
                    onClick={() => setIsSidebarOpen(false)}
                    className={`flex items-center space-x-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                      (isActive('/admin/activity') || isActive('/admin/audit') || isActive('/admin/audit-trail') || isActive('/admin/logs'))
                        ? 'bg-orange-50 text-orange-600 dark:bg-orange-900/10' 
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    <Clock className={`h-4 w-4 ${(isActive('/admin/activity') || isActive('/admin/audit') || isActive('/admin/audit-trail') || isActive('/admin/logs')) ? 'text-orange-600' : ''}`} />
                    <span>System Audit Trail</span>
                    {(isActive('/admin/activity') || isActive('/admin/audit') || isActive('/admin/audit-trail') || isActive('/admin/logs')) && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-orange-600" />}
                  </Link>
                  <Link
                    to="/admin/users"
                    onClick={() => setIsSidebarOpen(false)}
                    className={`flex items-center space-x-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                      isActive('/admin/users') 
                        ? 'bg-orange-50 text-orange-600 dark:bg-orange-900/10' 
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    <Users className={`h-4 w-4 ${isActive('/admin/users') ? 'text-orange-600' : ''}`} />
                    <span>Manage Users</span>
                    {isActive('/admin/users') && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-orange-600" />}
                  </Link>
                  <Link
                    to="/admin/chat"
                    onClick={() => setIsSidebarOpen(false)}
                    className={`flex items-center space-x-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                      isActive('/admin/chat') 
                        ? 'bg-orange-50 text-orange-600 dark:bg-orange-900/10' 
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    <MessageCircle className={`h-4 w-4 ${isActive('/admin/chat') ? 'text-orange-600' : ''}`} />
                    <span>Manage Chat</span>
                    {isActive('/admin/chat') && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-orange-600" />}
                  </Link>
                  <Link
                    to="/admin/sms"
                    onClick={() => setIsSidebarOpen(false)}
                    className={`flex items-center space-x-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                      isActive('/admin/sms') 
                        ? 'bg-orange-50 text-orange-600 dark:bg-orange-900/10' 
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    <MessageCircle className={`h-4 w-4 ${isActive('/admin/sms') ? 'text-orange-600' : ''}`} />
                    <span>SMS Statistics</span>
                    {isActive('/admin/sms') && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-orange-600" />}
                  </Link>
                  <Link
                    to="/admin/policies"
                    onClick={() => setIsSidebarOpen(false)}
                    className={`flex items-center space-x-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                      isActive('/admin/policies') 
                        ? 'bg-orange-50 text-orange-600 dark:bg-orange-900/10' 
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    <ShieldCheck className={`h-4 w-4 ${isActive('/admin/policies') ? 'text-orange-600' : ''}`} />
                    <span>Legal Policies</span>
                    {isActive('/admin/policies') && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-orange-600" />}
                  </Link>
                  <Link
                    to="/admin/sitemap"
                    onClick={() => setIsSidebarOpen(false)}
                    className={`flex items-center space-x-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                      (isActive('/admin/sitemap') || isActive('/admin/seo'))
                        ? 'bg-orange-50 text-orange-600 dark:bg-orange-900/10' 
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    <Globe className={`h-4 w-4 ${(isActive('/admin/sitemap') || isActive('/admin/seo')) ? 'text-orange-600' : ''}`} />
                    <span>SEO & Sitemap</span>
                    {(isActive('/admin/sitemap') || isActive('/admin/seo')) && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-orange-600" />}
                  </Link>
                  <Link
                    to="/admin/settings"
                    onClick={() => setIsSidebarOpen(false)}
                    className={`flex items-center space-x-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                      isActive('/admin/settings') 
                        ? 'bg-orange-50 text-orange-600 dark:bg-orange-900/10' 
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    <SettingsIcon className={`h-4 w-4 ${isActive('/admin/settings') ? 'text-orange-600' : ''}`} />
                    <span>Settings</span>
                    {isActive('/admin/settings') && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-orange-600" />}
                  </Link>
                </>
              )}
            </nav>
          </div>
          
          <div className="mt-auto">
            <div className="mb-4 px-3 py-3 rounded-xl bg-muted/30">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Logged in as</p>
              <p className="text-xs font-medium text-foreground truncate">{user.email}</p>
            </div>
            <Button
              variant="ghost"
              className="w-full justify-start text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 h-10"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sign Out</span>
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 bg-background">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/services" element={<ManageServices />} />
          <Route path="/intakes" element={<AdminServiceRequests />} />
          <Route path="/careers" element={<ManageCareerApplications />} />
          <Route path="/career-applications" element={<ManageCareerApplications />} />
          <Route path="/gallery" element={<ManageGallery />} />
          <Route path="/portfolio" element={<ManagePortfolio />} />
          <Route path="/bookings" element={<ManageBookings />} />
          <Route path="/transactions" element={<ManageTransactions />} />
          <Route path="/team" element={<ManageTeam />} />
          <Route path="/tasks" element={<ManageTasks />} />
          <Route path="/blog" element={<ManageBlog />} />
          <Route path="/newsletter" element={<ManageNewsletter />} />
          <Route path="/letters" element={<ManageLetters />} />
          <Route path="/payroll" element={<ManageEmployeesPayroll />} />
          <Route path="/staff" element={<ManageEmployeesPayroll />} />
          <Route path="/employees" element={<ManageEmployeesPayroll />} />
          <Route path="/testimonials" element={<ManageTestimonials />} />
          <Route path="/announcements" element={<ManageVisitorAlerts />} />
          <Route path="/policies" element={<ManageLegalPolicies />} />
          <Route path="/sitemap" element={<ManageSitemap />} />
          <Route path="/seo" element={<ManageSitemap />} />
          <Route path="/profile" element={<AdminProfile />} />
          <Route path="/activity" element={<ManageActivityLog />} />
          <Route path="/audit" element={<ManageActivityLog />} />
          <Route path="/audit-trail" element={<ManageActivityLog />} />
          <Route path="/logs" element={<ManageActivityLog />} />
          {hasAdminAccess && (
            <>
              <Route path="/users" element={<ManageUsers />} />
              <Route path="/chat" element={<ManageChat />} />
              <Route path="/sms" element={<SmsDashboard />} />
              <Route path="/settings" element={<ManageSettings />} />
            </>
          )}
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </main>

      {/* Security Session Expiry Warning Modal */}
      {showSessionWarning && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 z-[99999] animate-in fade-in duration-200">
          <div className="bg-card border border-amber-500/30 rounded-2xl p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200 text-center">
            <div className="flex flex-col items-center space-y-4">
              <div className="h-14 w-14 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 animate-pulse border border-amber-500/20">
                <AlertCircle className="h-8 w-8 text-amber-500" />
              </div>
              
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-foreground">
                  Security Session Warning
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Your administrator session is about to expire due to inactivity. For security reasons, you will be logged out automatically.
                </p>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden border border-border/40 my-1">
                <div 
                  className={`h-full transition-all duration-1000 ease-linear rounded-full ${
                    secondsRemaining < 45 ? 'bg-red-500 animate-pulse' : 'bg-amber-500'
                  }`} 
                  style={{ width: `${(secondsRemaining / 120) * 100}%` }}
                />
              </div>

              {/* Monospace countdown */}
              <div className={`text-3xl font-black font-mono tracking-wider ${
                secondsRemaining < 45 ? 'text-red-500 animate-pulse' : 'text-amber-500'
              }`}>
                {formatTime(secondsRemaining)}
              </div>

              <div className="flex w-full gap-3 pt-2">
                <Button 
                  variant="outline" 
                  size="default" 
                  onClick={handleLogout}
                  className="flex-1 text-xs font-semibold h-10 border-border hover:bg-muted"
                >
                  Sign Out
                </Button>
                <Button 
                  onClick={() => {
                    lastActivityRef.current = Date.now();
                    setSecondsRemaining(900);
                    setShowSessionWarning(false);
                    toast.success("Session Extended", {
                      description: "Your session has been securely extended.",
                      duration: 3000
                    });
                  }}
                  className="flex-1 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold h-10"
                >
                  Extend Session
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error('Please enter your email and password.');
      return;
    }
    setIsLoggingIn(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;
      
      const isHardcoded = isAdminEmail(user.email);
      let userRole = null;
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc && userDoc.exists()) {
          userRole = userDoc.data().role;
        }
      } catch (err) {
        console.warn("Could not check user role from firestore:", err);
      }

      const hasAccess = isHardcoded || userRole === 'admin' || userRole === 'editor';
      
      if (!hasAccess) {
        toast.error('Access Denied: This account is not authorized as an Admin.');
        // Sign out if not admin
        await signOut(auth);
      } else {
        toast.success('Admin logged in successfully!');
      }
    } catch (error: any) {
      console.error(error);
      let msg = 'Incorrect email address or password.';
      const errorCode = error?.code || '';
      const errorMessage = error?.message || '';
      if (errorCode === 'auth/operation-not-allowed') {
        msg = 'Email/Password sign-in is currently disabled. Please enable the "Email/Password" provider in your Firebase Console under Authentication > Sign-in method.';
      } else if (
        errorCode === 'auth/user-not-found' || 
        errorCode === 'auth/wrong-password' || 
        errorCode === 'auth/invalid-credential' ||
        errorMessage.includes('user-not-found') ||
        errorMessage.includes('wrong-password') ||
        errorMessage.includes('invalid-credential')
      ) {
        msg = 'Incorrect email address or password.';
      } else if (errorMessage) {
        msg = errorMessage;
      }
      toast.error(msg);
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md bg-card border-border">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-foreground">Admin Portal</CardTitle>
          <CardDescription className="text-muted-foreground">Sign in with your secure administrator credentials.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Admin Email</label>
              <Input
                type="email"
                placeholder="admin@grefas.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoggingIn}
                required
                className="h-11 rounded-xl bg-muted/40 border-border/80 focus:ring-orange-500/20"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Password</label>
              <Input
                type="password"
                placeholder="‚Ä¢‚Ä¢‚Ä¢‚Ä¢‚Ä¢‚Ä¢‚Ä¢‚Ä¢"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoggingIn}
                required
                className="h-11 rounded-xl bg-muted/40 border-border/80 focus:ring-orange-500/20"
              />
            </div>
            <Button 
              type="submit"
              disabled={isLoggingIn}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white font-extrabold h-11 rounded-xl uppercase tracking-wider text-xs"
            >
              {isLoggingIn ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Authenticating...
                </>
              ) : (
                'Sign In as Admin'
              )}
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Authorized admin credentials only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Dashboard() {
  const [counts, setCounts] = useState({ services: 0, gallery: 0, portfolio: 0, bookings: 0, tasks: 0, totalVisits: 0 });
  const [bookingTrends, setBookingTrends] = useState<any[]>([]);
  const [visitorTrends, setVisitorTrends] = useState<any[]>([]);
  const [appointmentTrends, setAppointmentTrends] = useState<any[]>([]);
  const [applicationStatuses, setApplicationStatuses] = useState<any[]>([]);
  const [userGrowth, setUserGrowth] = useState<any[]>([]);
  const [monthlyRevenueTrends, setMonthlyRevenueTrends] = useState<any[]>([]);
  const [expenseCategoryBreakdown, setExpenseCategoryBreakdown] = useState<any[]>([]);
  const [loadingCharts, setLoadingCharts] = useState(true);

  const [systemStatuses, setSystemStatuses] = useState({
    firestore: { status: 'loading', label: 'Checking...' },
    email: { status: 'loading', label: 'Checking...' },
    sms: { status: 'loading', label: 'Checking...' },
    server: { status: 'loading', label: 'Checking...' }
  });

  const checkSystemHealth = async () => {
    // 1. Check Server Health
    let serverStatus = { status: 'offline', label: 'Offline' };
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        serverStatus = { status: 'online', label: 'Online' };
      }
    } catch (err) {}

    // 2. Check Firestore
    let firestoreStatus = { status: 'offline', label: 'Offline / Unauthorized' };
    try {
      const servicesSnap = await getDocs(collection(db, 'services'));
      if (servicesSnap) {
        firestoreStatus = { status: 'online', label: 'Connected' };
      }
    } catch (err) {
      console.error("Firestore health check error:", err);
    }

    // 3. Check Email Status
    let emailStatus = { status: 'offline', label: 'Not Configured' };
    try {
      const res = await fetch('/api/email-status');
      if (res.ok) {
        const data = await res.json();
        if (data.emailApi?.configured) {
          emailStatus = { status: 'online', label: 'Active' };
        } else {
          emailStatus = { status: 'warning', label: 'Demo Mode' };
        }
      }
    } catch (err) {}

    // 4. Check SMS Status
    let smsStatus = { status: 'offline', label: 'Not Configured' };
    try {
      const res = await fetch('/api/sms-status');
      if (res.ok) {
        const data = await res.json();
        const status = data.arkesel?.status;
        if (status === 'Active') {
          smsStatus = { status: 'online', label: 'Active' };
        } else if (status === 'Demo Mode') {
          smsStatus = { status: 'warning', label: 'Demo' };
        } else {
          smsStatus = { status: 'offline', label: 'Unauthorized' };
        }
      }
    } catch (err) {}

    setSystemStatuses({
      firestore: firestoreStatus,
      server: serverStatus,
      email: emailStatus,
      sms: smsStatus
    });
  };

  useEffect(() => {
    const fetchDashboardDetails = async () => {
      try {
        setLoadingCharts(true);
        checkSystemHealth();
        const servicesSnap = await getDocs(collection(db, 'services'));
        const gallerySnap = await getDocs(collection(db, 'gallery'));
        const portfolioSnap = await getDocs(collection(db, 'portfolio'));
        const bookingsSnap = await getDocs(collection(db, 'bookings'));
        const tasksSnap = await getDocs(collection(db, 'tasks'));
        const usersSnap = await getDocs(collection(db, 'users'));
        const intakesSnap = await getDocs(collection(db, 'service_intakes'));

        // Generate last 7 days key list in YYYY-MM-DD format
        const last7Days: string[] = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          last7Days.push(d.toISOString().split('T')[0]);
        }

        const bookingsList = bookingsSnap.docs.map(doc => doc.data());
        const bookingsCountMap: { [key: string]: number } = {};
        bookingsList.forEach((booking: any) => {
          if (booking.date) {
            const dateOnlyStr = booking.date.substring(0, 10);
            bookingsCountMap[dateOnlyStr] = (bookingsCountMap[dateOnlyStr] || 0) + 1;
          }
        });

        // Retrieve visitor statistics
        const visitsSnap = await getDocs(collection(db, 'site_visits'));
        const visitsList = visitsSnap.docs.map(doc => doc.data());
        const visitsCountMap: { [key: string]: number } = {};
        let totalVisitsCount = 0;

        visitsList.forEach((visit: any) => {
          if (visit.date && visit.count) {
            const dateStr = visit.date.substring(0, 10);
            visitsCountMap[dateStr] = (visitsCountMap[dateStr] || 0) + visit.count;
            totalVisitsCount += visit.count;
          }
        });

        // Formulate trends arrays
        const bTrends = last7Days.map(dateStr => {
          let label = dateStr;
          try {
            const parsed = parseISO(dateStr);
            label = format(parsed, 'MMM d');
          } catch (_) {}
          return {
            date: label,
            dateRaw: dateStr,
            Bookings: bookingsCountMap[dateStr] || 0
          };
        });

        const hasRealVisits = totalVisitsCount > 0;
        // Simulated starter traffic curve in case database was newly installed:
        const baseVisitsCurve = [12, 19, 15, 26, 31, 38, 45];
        const vTrends = last7Days.map((dateStr, idx) => {
          let label = dateStr;
          try {
            const parsed = parseISO(dateStr);
            label = format(parsed, 'MMM d');
          } catch (_) {}
          const realVisitsCount = visitsCountMap[dateStr] || 0;
          return {
            date: label,
            dateRaw: dateStr,
            Visits: hasRealVisits ? realVisitsCount : baseVisitsCurve[idx]
          };
        });

        const visitsSum = hasRealVisits ? totalVisitsCount : baseVisitsCurve.reduce((a, b) => a + b, 0);

        // Prepare monthly/lifecycle appointment trends
        const aptTrendsMap: { [key: string]: { pending: number; confirmed: number; cancelled: number } } = {};
        
        // Generate baseline continuous last 6 months keys
        for (let i = 5; i >= 0; i--) {
          const d = new Date();
          d.setMonth(d.getMonth() - i);
          const monthKey = d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
          aptTrendsMap[monthKey] = { pending: 0, confirmed: 0, cancelled: 0 };
        }

        bookingsList.forEach((booking: any) => {
          let dateObj: Date | null = null;
          if (booking.date) {
            dateObj = new Date(booking.date);
          } else if (booking.createdAt) {
            dateObj = booking.createdAt.toDate ? booking.createdAt.toDate() : new Date(booking.createdAt);
          }
          
          if (dateObj && !isNaN(dateObj.getTime())) {
            const monthKey = dateObj.toLocaleString('en-US', { month: 'short', year: 'numeric' });
            if (!aptTrendsMap[monthKey]) {
              aptTrendsMap[monthKey] = { pending: 0, confirmed: 0, cancelled: 0 };
            }
            const status = (booking.status || 'pending').toLowerCase();
            if (status === 'confirmed') {
              aptTrendsMap[monthKey].confirmed++;
            } else if (status === 'cancelled') {
              aptTrendsMap[monthKey].cancelled++;
            } else {
              aptTrendsMap[monthKey].pending++;
            }
          }
        });

        const sortedAptTrends = Object.entries(aptTrendsMap)
          .map(([month, stats]) => ({
            month,
            ...stats,
            sortKey: new Date(month).getTime()
          }))
          .sort((a, b) => a.sortKey - b.sortKey);

        const totalApts = sortedAptTrends.reduce((sum, item) => sum + item.pending + item.confirmed + item.cancelled, 0);
        const finalAptTrends = sortedAptTrends.map((item, idx) => {
          if (totalApts === 0) {
            const baseline = [
              { pending: 2, confirmed: 5, cancelled: 1 },
              { pending: 3, confirmed: 8, cancelled: 0 },
              { pending: 1, confirmed: 10, cancelled: 2 },
              { pending: 4, confirmed: 13, cancelled: 1 },
              { pending: 5, confirmed: 16, cancelled: 3 },
              { pending: 3, confirmed: 21, cancelled: 2 }
            ];
            return {
              month: item.month,
              ...baseline[idx % baseline.length]
            };
          }
          return {
            month: item.month,
            pending: item.pending,
            confirmed: item.confirmed,
            cancelled: item.cancelled
          };
        });

        // Prepare application status distributions
        const intakesList = intakesSnap.docs.map(doc => doc.data());
        const statusCounts = { Pending: 0, 'In Review': 0, Approved: 0, Rejected: 0 };
        intakesList.forEach((intake: any) => {
          const status = intake.status || 'Pending';
          if (statusCounts[status] !== undefined) {
            statusCounts[status]++;
          } else {
            statusCounts['Pending']++;
          }
        });

        const totalIntakesCount = intakesList.length;
        const finalStatusDist = [
          { name: 'Pending', value: totalIntakesCount > 0 ? statusCounts.Pending : 6, color: '#f59e0b' },
          { name: 'In Review', value: totalIntakesCount > 0 ? statusCounts['In Review'] : 4, color: '#3b82f6' },
          { name: 'Approved', value: totalIntakesCount > 0 ? statusCounts.Approved : 12, color: '#10b981' },
          { name: 'Rejected', value: totalIntakesCount > 0 ? statusCounts.Rejected : 2, color: '#ef4444' }
        ];

        // Prepare active user growth over time
        const usersList = usersSnap.docs.map(doc => doc.data());
        const userGrowthMap: { [key: string]: number } = {};
        usersList.forEach((user: any) => {
          let dateObj: Date | null = null;
          if (user.createdAt) {
            dateObj = user.createdAt.toDate ? user.createdAt.toDate() : new Date(user.createdAt);
          }
          if (!dateObj || isNaN(dateObj.getTime())) {
            dateObj = new Date();
          }
          const dateKey = dateObj.toISOString().substring(0, 10);
          userGrowthMap[dateKey] = (userGrowthMap[dateKey] || 0) + 1;
        });

        const sortedUserDates = Object.keys(userGrowthMap).sort();
        let runningUsersSum = 0;
        const actualUserGrowth = sortedUserDates.map(dateStr => {
          runningUsersSum += userGrowthMap[dateStr];
          let label = dateStr;
          try {
            label = format(parseISO(dateStr), 'MMM d');
          } catch (_) {}
          return {
            date: label,
            dateRaw: dateStr,
            Users: runningUsersSum
          };
        });

        let finalUserGrowth = actualUserGrowth;
        if (finalUserGrowth.length < 5) {
          const starterCurve = [];
          const baseCount = usersList.length > 0 ? usersList.length : 5;
          for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const label = d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
            starterCurve.push({
              date: label,
              dateRaw: d.toISOString().substring(0, 10),
              Users: Math.floor(baseCount + (5 - i) * 3 + Math.random() * 2)
            });
          }
          finalUserGrowth = starterCurve;
        }

        // Fetch Transactions for Financial Dashboards
        let transactionsList: any[] = [];
        try {
          const transactionsSnap = await getDocs(collection(db, 'transactions'));
          transactionsList = transactionsSnap.docs.map(doc => doc.data());
        } catch (txErr) {
          console.warn("Failed to fetch transactions for dashboard:", txErr);
        }

        // 1. Calculate Expenses by Category
        const debits = transactionsList.filter((t: any) => t.type === 'debit');
        const totalDebitsSum = debits.reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
        
        const expenseCategoryMap: { [key: string]: number } = {};
        debits.forEach((t: any) => {
          const cat = t.category || 'Other Expense';
          expenseCategoryMap[cat] = (expenseCategoryMap[cat] || 0) + (t.amount || 0);
        });

        const defaultDebitCategories = [
          "Specialist/Staff Payroll",
          "Equipment Purchase",
          "Office Utilities",
          "Entertainment Event Production",
          "Marketing & Ads",
          "Other Expense"
        ];
        
        defaultDebitCategories.forEach(cat => {
          if (expenseCategoryMap[cat] === undefined) {
            expenseCategoryMap[cat] = 0;
          }
        });

        const expenseCategoryList = Object.entries(expenseCategoryMap)
          .map(([category, amount]) => ({
            category,
            amount,
            percentage: totalDebitsSum > 0 ? (amount / totalDebitsSum) * 100 : 0
          }))
          .sort((a, b) => b.amount - a.amount);

        // 2. Calculate Monthly Revenue Trends (Income vs Expenses)
        const monthlyMap: { [key: string]: { Income: number; Expenses: number } } = {};
        const last6MonthsKeys: string[] = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date();
          d.setMonth(d.getMonth() - i);
          const monthKey = d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
          last6MonthsKeys.push(monthKey);
          monthlyMap[monthKey] = { Income: 0, Expenses: 0 };
        }

        transactionsList.forEach((t: any) => {
          let dateObj: Date | null = null;
          if (t.transactionDate) {
            dateObj = new Date(t.transactionDate);
          } else if (t.createdAt) {
            dateObj = t.createdAt.toDate ? t.createdAt.toDate() : new Date(t.createdAt);
          }
          if (dateObj && !isNaN(dateObj.getTime())) {
            const monthKey = dateObj.toLocaleString('en-US', { month: 'short', year: 'numeric' });
            if (!monthlyMap[monthKey]) {
              monthlyMap[monthKey] = { Income: 0, Expenses: 0 };
            }
            if (t.type === 'credit') {
              monthlyMap[monthKey].Income += (t.amount || 0);
            } else if (t.type === 'debit') {
              monthlyMap[monthKey].Expenses += (t.amount || 0);
            }
          }
        });

        const revTrends = last6MonthsKeys.map(month => ({
          month,
          Income: monthlyMap[month]?.Income || 0,
          Expenses: monthlyMap[month]?.Expenses || 0
        }));

        const totalTxCount = transactionsList.length;
        const finalRevTrends = revTrends.map((item, idx) => {
          if (totalTxCount === 0) {
            const baseline = [
              { Income: 2500, Expenses: 1200 },
              { Income: 3800, Expenses: 1800 },
              { Income: 4200, Expenses: 2400 },
              { Income: 5600, Expenses: 2900 },
              { Income: 6800, Expenses: 3100 },
              { Income: 7500, Expenses: 3500 }
            ];
            return {
              month: item.month,
              ...baseline[idx % baseline.length]
            };
          }
          return item;
        });

        const finalExpenseCategoryList = totalTxCount === 0 ? [
          { category: "Specialist/Staff Payroll", amount: 1500, percentage: 46.8 },
          { category: "Entertainment Event Production", amount: 850, percentage: 26.5 },
          { category: "Equipment Purchase", amount: 450, percentage: 14.1 },
          { category: "Office Utilities", amount: 250, percentage: 7.8 },
          { category: "Marketing & Ads", amount: 150, percentage: 4.8 }
        ] : expenseCategoryList;

        setCounts({
          services: servicesSnap.size,
          gallery: gallerySnap.size,
          portfolio: portfolioSnap.size,
          bookings: bookingsSnap.size,
          tasks: tasksSnap.size,
          totalVisits: visitsSum
        });

        setBookingTrends(bTrends);
        setVisitorTrends(vTrends);
        setAppointmentTrends(finalAptTrends);
        setApplicationStatuses(finalStatusDist);
        setUserGrowth(finalUserGrowth);
        setMonthlyRevenueTrends(finalRevTrends);
        setExpenseCategoryBreakdown(finalExpenseCategoryList);
        setLoadingCharts(false);
      } catch (error) {
        console.error("Dashboard fetch error:", error);
        setLoadingCharts(false);
      }
    };

    fetchDashboardDetails();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-border/40">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">Dashboard</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Real-time stats, trend vectors, and system health status.</p>
        </div>
        
        {/* System Status Indicators */}
        <div className="flex flex-wrap gap-2 items-center p-1.5 bg-muted/40 border border-border/60 rounded-xl">
          <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest px-1.5">System Health:</span>
          
          {/* Firestore */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-background border border-border/40 text-[10px] font-bold shadow-xs">
            <span className={`h-2 w-2 rounded-full ${
              systemStatuses.firestore.status === 'online' ? 'bg-emerald-500' :
              systemStatuses.firestore.status === 'loading' ? 'bg-amber-400' : 'bg-red-500'
            }`} />
            <span className="text-muted-foreground">Firestore:</span>
            <span className="text-foreground">{systemStatuses.firestore.label}</span>
          </div>

          {/* Email API */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-background border border-border/40 text-[10px] font-bold shadow-xs">
            <span className={`h-2 w-2 rounded-full ${
              systemStatuses.email.status === 'online' ? 'bg-emerald-500' :
              systemStatuses.email.status === 'warning' ? 'bg-amber-400' :
              systemStatuses.email.status === 'loading' ? 'bg-amber-400' : 'bg-red-500'
            }`} />
            <span className="text-muted-foreground">Email:</span>
            <span className="text-foreground">{systemStatuses.email.label}</span>
          </div>

          {/* SMS API */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-background border border-border/40 text-[10px] font-bold shadow-xs">
            <span className={`h-2 w-2 rounded-full ${
              systemStatuses.sms.status === 'online' ? 'bg-emerald-500' :
              systemStatuses.sms.status === 'warning' ? 'bg-amber-400' :
              systemStatuses.sms.status === 'loading' ? 'bg-amber-400' : 'bg-red-500'
            }`} />
            <span className="text-muted-foreground">SMS:</span>
            <span className="text-foreground">{systemStatuses.sms.label}</span>
          </div>

          <Button 
            variant="ghost" 
            size="sm" 
            onClick={checkSystemHealth}
            className="h-6 px-2 hover:bg-muted text-[9px] font-bold uppercase tracking-wider"
            title="Re-check connections"
          >
            Check status
          </Button>
        </div>
      </div>
      
      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <Card className="bg-card border-border shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Services</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-foreground">{counts.services}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Gallery Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-foreground">{counts.gallery}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Portfolio Projects</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-foreground">{counts.portfolio}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Bookings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-foreground">{counts.bookings}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 justify-between">
              Total Visits
              <span className="text-[10px] font-black uppercase text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded">Live</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-foreground">{counts.totalVisits}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Internal Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-foreground">{counts.tasks}</div>
          </CardContent>
        </Card>
      </div>

      {/* Recharts Analytics Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Daily Bookings Trend Chart */}
        <Card className="bg-card border-border shadow-xs">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-foreground">Booking Velocity (Last 7 Days)</CardTitle>
            <CardDescription className="text-xs text-muted-foreground font-semibold">
              Schedules and appointments requested by customers per day
            </CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            {loadingCharts ? (
              <div className="flex h-full items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-orange-600" />
                <span className="text-xs text-muted-foreground font-bold">RECONSTRUCTING TRENDS...</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={bookingTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorBookings" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ea580c" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#ea580c" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,120,0.1)" />
                  <XAxis dataKey="date" stroke="currentColor" className="text-[10px] text-muted-foreground" />
                  <YAxis stroke="currentColor" className="text-[10px] text-muted-foreground" allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ 
                      backgroundColor: 'var(--card)', 
                      borderColor: 'rgba(120,120,120,0.2)', 
                      borderRadius: '8px',
                      color: 'var(--foreground)'
                    }}
                  />
                  <Area type="monotone" dataKey="Bookings" stroke="#ea580c" strokeWidth={2.5} fillOpacity={1} fill="url(#colorBookings)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Daily Visitors Trend Chart */}
        <Card className="bg-card border-border shadow-xs">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-foreground">Traffic Analytics & Unique Visits</CardTitle>
            <CardDescription className="text-xs text-muted-foreground font-semibold">
              Daily metrics demonstrating user session growth across all site pages
            </CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            {loadingCharts ? (
              <div className="flex h-full items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-orange-600" />
                <span className="text-xs text-muted-foreground font-bold">RETRIEVING VISIT LOGS...</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={visitorTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,120,0.1)" />
                  <XAxis dataKey="date" stroke="currentColor" className="text-[10px] text-muted-foreground" />
                  <YAxis stroke="currentColor" className="text-[10px] text-muted-foreground" allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ 
                      backgroundColor: 'var(--card)', 
                      borderColor: 'rgba(120,120,120,0.2)', 
                      borderRadius: '8px',
                      color: 'var(--foreground)'
                    }}
                  />
                  <Bar dataKey="Visits" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Advanced Enterprise Analytics Hub */}
      <div className="space-y-4 pt-4 border-t border-border/60">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-orange-600 animate-pulse"></span>
            <span>Enterprise Performance & Trends Hub</span>
          </h2>
          <p className="text-xs text-muted-foreground font-medium mt-0.5">
            Comprehensive business analytics, application funnels, and cumulative community scale over time.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Appointment Status Trends (col-span-2) */}
          <Card className="bg-card border-border shadow-xs lg:col-span-2">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-foreground">Appointment Lifecycle & Monthly Volume</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Chronological distribution of scheduled client consultations by status
                  </CardDescription>
                </div>
                <span className="text-[10px] font-bold text-orange-600 uppercase bg-orange-600/10 px-2 py-0.5 rounded">
                  Lifecycle Tracking
                </span>
              </div>
            </CardHeader>
            <CardContent className="h-80 pt-4">
              {loadingCharts ? (
                <div className="flex h-full items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-orange-600" />
                  <span className="text-xs text-muted-foreground font-bold">CALCULATING LIFECYCLES...</span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={appointmentTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,120,0.1)" />
                    <XAxis dataKey="month" stroke="currentColor" className="text-[10px] text-muted-foreground font-mono" />
                    <YAxis stroke="currentColor" className="text-[10px] text-muted-foreground font-mono" allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ 
                        backgroundColor: 'var(--card)', 
                        borderColor: 'rgba(120,120,120,0.2)', 
                        borderRadius: '8px',
                        color: 'var(--foreground)'
                      }}
                    />
                    <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 600 }} />
                    <Bar dataKey="confirmed" name="Confirmed" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="pending" name="Pending" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="cancelled" name="Cancelled" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Application Status Distributions (col-span-1) */}
          <Card className="bg-card border-border shadow-xs lg:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold text-foreground">Application Status Funnel</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Distribution of client consultation intake assessments
              </CardDescription>
            </CardHeader>
            <CardContent className="h-80 flex flex-col justify-between pt-0 pb-4">
              {loadingCharts ? (
                <div className="flex h-60 items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-orange-600" />
                  <span className="text-xs text-muted-foreground font-bold font-mono">AGGREGATING FUNNELS...</span>
                </div>
              ) : (
                <>
                  <div className="h-52 relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={applicationStatuses}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={80}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {applicationStatuses.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value) => [`${value} Forms`, 'Volume']}
                          contentStyle={{ 
                            backgroundColor: 'var(--card)', 
                            borderColor: 'rgba(120,120,120,0.2)', 
                            borderRadius: '8px',
                            color: 'var(--foreground)'
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-2xl font-black text-foreground">
                        {applicationStatuses.reduce((acc, curr) => acc + curr.value, 0)}
                      </span>
                      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Total Intakes</span>
                    </div>
                  </div>
                  
                  {/* Status Legends Table */}
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-bold px-2 pt-2 border-t border-border/40">
                    {applicationStatuses.map((item) => (
                      <div key={item.name} className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="text-muted-foreground truncate max-w-[80px]">{item.name}:</span>
                        <span className="text-foreground ml-auto font-mono">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Active User Growth Over Time (col-span-3) */}
          <Card className="bg-card border-border shadow-xs lg:col-span-3">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-foreground">Platform User Trajectory & Growth</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Cumulative visual track showing growth of authorized user registrations and admin accounts
                  </CardDescription>
                </div>
                <div className="flex items-center gap-1.5 bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded text-[10px] font-bold font-mono">
                  <span>Cumulative Active Scale</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="h-80 pt-4">
              {loadingCharts ? (
                <div className="flex h-full items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-orange-600" />
                  <span className="text-xs text-muted-foreground font-bold">PROJECTING USER DENSITY...</span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={userGrowth} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorUserGrowth" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,120,0.1)" />
                    <XAxis dataKey="date" stroke="currentColor" className="text-[10px] text-muted-foreground font-mono" />
                    <YAxis stroke="currentColor" className="text-[10px] text-muted-foreground font-mono" allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ 
                        backgroundColor: 'var(--card)', 
                        borderColor: 'rgba(120,120,120,0.2)', 
                        borderRadius: '8px',
                        color: 'var(--foreground)'
                      }}
                    />
                    <Area type="monotone" dataKey="Users" name="Registered Users" stroke="#3b82f6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorUserGrowth)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Monthly Revenue Trends (col-span-2) */}
          <Card className="bg-card border-border shadow-xs lg:col-span-2">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-foreground">Monthly Revenue Trends</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Bar chart comparison of Monthly Income (Credits) vs Expenses (Debits)
                  </CardDescription>
                </div>
                <div className="flex items-center gap-1.5 bg-orange-600/10 text-orange-600 px-2 py-0.5 rounded text-[10px] font-bold font-mono">
                  <span>Ledger Comparison</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="h-80 pt-4">
              {loadingCharts ? (
                <div className="flex h-full items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-orange-600" />
                  <span className="text-xs text-muted-foreground font-bold">PROJECTING REVENUE...</span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyRevenueTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,120,0.1)" />
                    <XAxis dataKey="month" stroke="currentColor" className="text-[10px] text-muted-foreground font-mono" />
                    <YAxis stroke="currentColor" className="text-[10px] text-muted-foreground font-mono" />
                    <Tooltip
                      contentStyle={{ 
                        backgroundColor: 'var(--card)', 
                        borderColor: 'rgba(120,120,120,0.2)', 
                        borderRadius: '8px',
                        color: 'var(--foreground)'
                      }}
                    />
                    <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 600 }} />
                    <Bar dataKey="Income" name="Total Income (Credits)" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Expenses" name="Total Expenses (Debits)" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Expense Category Breakdown (col-span-1) */}
          <Card className="bg-card border-border shadow-xs lg:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold text-foreground">Expense Category Breakdown</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Where company and operations funds are directed
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              {loadingCharts ? (
                <div className="flex h-60 items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-orange-600" />
                  <span className="text-xs text-muted-foreground font-bold font-mono">PARSING CATEGORIES...</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {expenseCategoryBreakdown.map((item, index) => (
                    <div key={item.category} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-muted-foreground truncate max-w-[150px]">{item.category}</span>
                        <span className="text-foreground font-mono">GH‚Çµ {item.amount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                      </div>
                      <div className="w-full bg-muted/40 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${
                            index === 0 ? 'bg-rose-600' :
                            index === 1 ? 'bg-orange-500' :
                            index === 2 ? 'bg-amber-500' :
                            index === 3 ? 'bg-blue-500' : 'bg-slate-400'
                          }`}
                          style={{ width: `${Math.max(item.percentage, 2)}%` }}
                        />
                      </div>
                      <div className="flex justify-end">
                        <span className="text-[10px] font-black text-muted-foreground">{item.percentage.toFixed(1)}%</span>
                      </div>
                    </div>
                  ))}
                  {expenseCategoryBreakdown.length === 0 && (
                    <div className="text-center text-xs text-muted-foreground py-8">No recorded expenses yet</div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function AdminServiceRequests() {
  const [intakes, setIntakes] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Billing and Payment Plan States
  const [editingBillingIntake, setEditingBillingIntake] = useState<any | null>(null);
  const [billingPrice, setBillingPrice] = useState<number>(0);
  const [billingPlanType, setBillingPlanType] = useState<string>('full');
  const [installments, setInstallments] = useState<any[]>([]);
  const [momoRefCode, setMomoRefCode] = useState<Record<string, string>>({});

  // Confirmation modal state for manual payment
  const [confirmPaymentModal, setConfirmPaymentModal] = useState<{
    index: number;
    inst: any;
  } | null>(null);
  const [typedVerifyRef, setTypedVerifyRef] = useState('');
  const [verifyRefError, setVerifyRefError] = useState('');

  useEffect(() => {
    if (!editingBillingIntake) {
      setBillingPrice(0);
      setBillingPlanType('full');
      setInstallments([]);
      return;
    }
    
    if (editingBillingIntake.price) {
      setBillingPrice(editingBillingIntake.price);
      setBillingPlanType(editingBillingIntake.paymentPlan?.type || 'full');
      setInstallments(editingBillingIntake.paymentPlan?.installments || []);
    } else {
      setBillingPrice(500);
      setBillingPlanType('full');
      setInstallments([
        {
          id: 'inst_1',
          name: 'Full Registration & Consultation',
          amount: 500,
          status: 'Unpaid',
          dueDate: new Date().toISOString().split('T')[0]
        }
      ]);
    }
  }, [editingBillingIntake]);

  const handleAutoGeneratePlan = (price: number, type: string) => {
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysLater = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const sixtyDaysLater = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    if (type === 'full') {
      setInstallments([
        {
          id: 'inst_1',
          name: 'Full Program Payment',
          amount: price,
          status: 'Unpaid',
          dueDate: today
        }
      ]);
    } else if (type === 'installments_2') {
      const firstAmount = Math.floor(price / 2);
      const secondAmount = price - firstAmount;
      setInstallments([
        {
          id: 'inst_1',
          name: 'Deposit / Commitment Fee (50%)',
          amount: firstAmount,
          status: 'Unpaid',
          dueDate: today
        },
        {
          id: 'inst_2',
          name: 'Final Balance Payment (50%)',
          amount: secondAmount,
          status: 'Unpaid',
          dueDate: thirtyDaysLater
        }
      ]);
    } else if (type === 'installments_3') {
      const firstAmount = Math.floor(price * 0.4);
      const secondAmount = Math.floor(price * 0.3);
      const thirdAmount = price - firstAmount - secondAmount;
      setInstallments([
        {
          id: 'inst_1',
          name: 'Initial Deposit (40%)',
          amount: firstAmount,
          status: 'Unpaid',
          dueDate: today
        },
        {
          id: 'inst_2',
          name: 'Second Installment (30%)',
          amount: secondAmount,
          status: 'Unpaid',
          dueDate: thirtyDaysLater
        },
        {
          id: 'inst_3',
          name: 'Final Balance (30%)',
          amount: thirdAmount,
          status: 'Unpaid',
          dueDate: sixtyDaysLater
        }
      ]);
    }
  };

  const getAmountPaid = (item: any) => {
    if (!item.price || !item.paymentPlan || !item.paymentPlan.installments) return 0;
    return item.paymentPlan.installments
      .filter((inst: any) => inst.status === 'Paid')
      .reduce((sum: number, inst: any) => sum + (inst.amount || 0), 0);
  };

  const handleSaveBillingPlan = async () => {
    if (!editingBillingIntake) return;
    try {
      const priceVal = Number(billingPrice) || 0;
      
      const paidAmount = installments
        .filter((inst: any) => inst.status === 'Paid')
        .reduce((sum: number, inst: any) => sum + (inst.amount || 0), 0);

      let calcStatus = 'Unpaid';
      if (priceVal > 0) {
        if (paidAmount >= priceVal) {
          calcStatus = 'Fully Paid';
        } else if (paidAmount > 0) {
          calcStatus = 'Partially Paid';
        }
      }

      await updateDoc(doc(db, 'service_intakes', editingBillingIntake.id), {
        price: priceVal,
        paymentStatus: calcStatus,
        paymentPlan: {
          type: billingPlanType,
          installments: installments
        }
      });

      // Record activity
      try {
        await addDoc(collection(db, 'activity_logs'), {
          userId: editingBillingIntake.userId || null,
          userEmail: editingBillingIntake.emailAddress || null,
          userName: editingBillingIntake.fullName || 'Unknown Client',
          type: 'billing_update',
          description: `Assigned pricing GHS ${priceVal} with plan type ${billingPlanType} by Admin.`,
          createdAt: new Date().toISOString()
        });
      } catch (logErr) {
        console.warn('Failed to log billing update activity:', logErr);
      }

      // If an installment is newly paid and it wasn't before, trigger an official invoice receipt!
      const previousPaidAmount = getAmountPaid(editingBillingIntake);
      if (paidAmount > previousPaidAmount) {
        try {
          const balanceDue = Math.max(0, priceVal - paidAmount);
          await fetch('/api/notify-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fullName: editingBillingIntake.fullName,
              emailAddress: editingBillingIntake.emailAddress,
              contact: editingBillingIntake.contact,
              amountPaid: paidAmount - previousPaidAmount, // new payment
              paymentPlan: billingPlanType === 'full' ? 'One-time Full' : billingPlanType === 'installments_2' ? '2-Installments (50/50)' : '3-Installments (40/30/30)',
              paymentMethod: 'Offline/Logged by Director',
              totalPrice: priceVal,
              balanceDue: balanceDue,
              paymentStatus: calcStatus,
              refId: editingBillingIntake.id
            })
          });
        } catch (apiErr) {
          console.warn('Failed to dispatch invoice notification email:', apiErr);
        }
      }

      toast.success('Billing pricing and installments updated successfully!');
      setEditingBillingIntake(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `service_intakes/${editingBillingIntake.id}`);
    }
  };

  // Dynamic role states
  const [intakeRoles, setIntakeRoles] = useState<string[]>([]);
  const [newRole, setNewRole] = useState('');
  const [isManagingRoles, setIsManagingRoles] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'service_intakes'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setIntakes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'service_intakes');
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Fetch dynamic roles
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'global'), (docSnap) => {
      if (docSnap.exists() && docSnap.data().intakeRoles && docSnap.data().intakeRoles.length > 0) {
        setIntakeRoles(docSnap.data().intakeRoles);
      } else {
        setIntakeRoles([
          "Actor / Actress",
          "Skit Performer",
          "Creative Writer",
          "Crew / Technical",
          "Video Editor",
          "Cameraman",
          "Sound Engineer",
          "Director",
          "Finance Officer",
          "Admin Support"
        ]);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleAddRole = async () => {
    const trimmed = newRole.trim();
    if (!trimmed) {
      toast.error('Role name cannot be empty');
      return;
    }
    if (intakeRoles.some(r => r.toLowerCase() === trimmed.toLowerCase())) {
      toast.error('This role already exists');
      return;
    }
    const updatedRoles = [...intakeRoles, trimmed];
    try {
      await setDoc(doc(db, 'settings', 'global'), { intakeRoles: updatedRoles }, { merge: true });
      toast.success('Intake role added successfully!');
      setNewRole('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/global');
    }
  };

  const handleDeleteRole = async (roleToDelete: string) => {
    const updatedRoles = intakeRoles.filter(r => r !== roleToDelete);
    try {
      await setDoc(doc(db, 'settings', 'global'), { intakeRoles: updatedRoles }, { merge: true });
      toast.success('Intake role deleted successfully!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/global');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'service_intakes', id));
      toast.success('Service intake record deleted successfully.');
      setDeleteId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'service_intakes');
    }
  };

  const exportIntakesToCSV = () => {
    if (intakes.length === 0) {
      toast.error('No intake records to export.');
      return;
    }

    const headers = ['Full Name', 'Date of Birth', 'Age', 'Contact phone', 'WhatsApp number', 'Email address', 'Address/Residence', 'Roles Applied', 'Registered At'];
    const rows = intakes.map(item => [
      item.fullName || '',
      item.dateOfBirth || '',
      item.age || 0,
      item.contact || '',
      item.whatsappNumber || '',
      item.emailAddress || '',
      item.address || '',
      item.roleType || '',
      item.createdAt || ''
    ]);

    const csvContent = 
      'data:text/csv;charset=utf-8,' + 
      [headers.join(','), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'service_intake_registrations.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Spreadsheet exported successfully!');
  };

  const filteredIntakes = intakes.filter(item => {
    const query = searchQuery.toLowerCase();
    return (
      (item.fullName || '').toLowerCase().includes(query) ||
      (item.emailAddress || '').toLowerCase().includes(query) ||
      (item.contact || '').toLowerCase().includes(query) ||
      (item.whatsappNumber || '').toLowerCase().includes(query) ||
      (item.address || '').toLowerCase().includes(query) ||
      (item.roleType || '').toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FileText className="h-6 w-6 text-orange-600" />
            <span>Service Requests & Client Intakes</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Review and manage structured service form submissions and demographic intake details.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <Button
            onClick={() => setIsManagingRoles(!isManagingRoles)}
            size="sm"
            variant={isManagingRoles ? "default" : "outline"}
            className={`text-xs font-semibold flex items-center gap-1.5 h-9 ${
              isManagingRoles ? 'bg-orange-600 hover:bg-orange-700 text-white border-orange-600' : ''
            }`}
          >
            <SettingsIcon className="h-3.5 w-3.5" />
            <span>{isManagingRoles ? "View Intakes Desk" : "Configure Intake Roles"}</span>
          </Button>

          <Button
            onClick={exportIntakesToCSV}
            size="sm"
            variant="outline"
            className="text-xs font-semibold flex items-center gap-1.5 h-9"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </Button>
        </div>
      </div>

      {isManagingRoles ? (
        <Card className="border border-border bg-card p-6 rounded-xl space-y-6">
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-orange-600" />
              <span>Configure Client Intake Roles</span>
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Add or remove roles that clients can choose from on the casting and career desk registration pages.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Add Role Form */}
            <div className="border border-border rounded-xl p-4 bg-muted/20 space-y-4 h-fit">
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Add New Role</h3>
              <div className="space-y-2">
                <Input
                  placeholder="e.g. Script Supervisor"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="bg-background text-xs h-9"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddRole();
                    }
                  }}
                />
                <Button
                  onClick={handleAddRole}
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold h-9"
                >
                  <Plus className="h-4 w-4 mr-1" /> Add Role
                </Button>
              </div>
            </div>

            {/* Roles List */}
            <div className="md:col-span-2 space-y-3">
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Active Intake Roles ({intakeRoles.length})</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[450px] overflow-y-auto pr-2">
                {intakeRoles.map((role, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:border-orange-500/30 transition-colors">
                    <span className="text-xs font-semibold text-foreground">{role}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteRole(role)}
                      className="h-7 w-7 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                      title={`Delete ${role}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      ) : (
        <>
          <div className="flex items-center space-x-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by client name, email, phone, address or role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>
            {searchQuery && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setSearchQuery('')}
                className="text-xs h-9 px-3"
              >
                Clear
              </Button>
            )}
          </div>

          {loading ? (
            <div className="flex min-h-[250px] items-center justify-center border border-dashed rounded-lg bg-card/50">
              <div className="text-center space-y-2">
                <Loader2 className="h-8 w-8 animate-spin text-orange-600 mx-auto" />
                <p className="text-xs text-muted-foreground">Loading service intakes...</p>
              </div>
            </div>
          ) : filteredIntakes.length === 0 ? (
            <div className="flex min-h-[250px] flex-col items-center justify-center text-center rounded-xl border border-dashed border-border p-8 bg-card bg-opacity-40">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-950/20 text-orange-600">
                <FileText className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-foreground">No Intakes Found</h3>
              <p className="mt-2 text-xs text-muted-foreground max-w-sm mx-auto">
                {searchQuery ? "No client registrations match your keyword query. Try searching for a different name, residency, or contact number." : "Clients who register via the service consultation intake form will appear here dynamically."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredIntakes.map((item) => (
                <Card key={item.id} className="border border-border/60 bg-card hover:shadow-md transition-shadow duration-300 flex flex-col justify-between">
                  <CardHeader className="pb-3 border-b border-border/40">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        {item.passportPhoto ? (
                          <div className="h-12 w-12 rounded-lg overflow-hidden border border-border shrink-0 bg-muted">
                            <img src={item.passportPhoto} className="h-full w-full object-cover" alt="Passport" />
                          </div>
                        ) : (
                          <div className="h-12 w-12 rounded-lg border border-border/80 shrink-0 bg-muted flex items-center justify-center text-muted-foreground">
                            <UserIcon className="h-5 w-5 opacity-55" />
                          </div>
                        )}
                        <div className="min-w-0 space-y-1">
                          <CardTitle className="text-sm font-bold truncate max-w-[140px]" title={item.fullName}>
                            {item.fullName}
                          </CardTitle>
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground flex-wrap">
                            <span className="bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400 font-bold px-1.5 py-0.5 rounded font-mono shrink-0">
                              {item.age} Yrs
                            </span>
                            <span className="font-mono text-[10px]">{item.dateOfBirth}</span>
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteId(item.id)}
                        className="h-8 w-8 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-3.5 text-xs">
                    {/* Applied Roles */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Roles Applied:</span>
                      <div className="flex flex-wrap gap-1">
                        {(item.roleTypes && Array.isArray(item.roleTypes)) ? (
                          item.roleTypes.map((role: string, index: number) => (
                            <span key={index} className="bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400 text-[10px] font-bold px-2 py-0.5 rounded">
                              {role}
                            </span>
                          ))
                        ) : item.roleType ? (
                          item.roleType.split(', ').map((role: string, index: number) => (
                            <span key={index} className="bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400 text-[10px] font-bold px-2 py-0.5 rounded">
                              {role}
                            </span>
                          ))
                        ) : (
                          <span className="bg-zinc-100 dark:bg-zinc-800 text-muted-foreground text-[10px] font-semibold px-2 py-0.5 rounded">
                            No Role Specified
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Contact phone */}
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-3.5 w-3.5 shrink-0 text-orange-600/70" />
                      <a href={`tel:${item.contact}`} className="hover:text-foreground hover:underline transition-all">
                        {item.contact}
                      </a>
                    </div>

                    {/* WhatsApp */}
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MessageCircle className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                      <a 
                        href={`https://wa.me/${item.whatsappNumber.replace(/[^0-9]/g, '')}`} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="hover:text-emerald-500 hover:underline inline-flex items-center gap-1 transition-all"
                      >
                        <span>{item.whatsappNumber}</span>
                        <span className="text-[9px] font-bold text-emerald-500 uppercase bg-emerald-100 dark:bg-emerald-950/40 px-1 rounded">Text</span>
                      </a>
                    </div>

                    {/* Email address */}
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-3.5 w-3.5 shrink-0 text-orange-600/70" />
                      <a href={`mailto:${item.emailAddress}`} className="hover:text-foreground hover:underline transition-all truncate" title={item.emailAddress}>
                        {item.emailAddress}
                      </a>
                    </div>

                    {/* Address */}
                    <div className="flex items-start gap-2 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-orange-600/70 mt-0.5" />
                      <span className="line-clamp-2" title={item.address}>{item.address}</span>
                    </div>

                    {/* Creation date */}
                    <div className="pt-3 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                      <span>Registered:</span>
                      <span>{item.createdAt ? new Date(item.createdAt).toLocaleString() : 'N/A'}</span>
                    </div>

                    {/* Billing & Fees Section */}
                    <div className="pt-3 border-t border-border/40 space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
                          <CreditCard className="h-3.5 w-3.5 text-orange-600" /> Billing & Fees
                        </span>
                        {item.price ? (
                          <span className={`px-2 py-0.5 font-bold text-[9px] uppercase rounded-full ${
                            (item.paymentPlan?.status === 'Fully Paid' || getAmountPaid(item) >= item.price) ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400' :
                            getAmountPaid(item) > 0 ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400' :
                            'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400'
                          }`}>
                            {item.paymentPlan?.status || (getAmountPaid(item) >= item.price ? 'Fully Paid' : 'Unpaid')}
                          </span>
                        ) : (
                          <span className="bg-zinc-100 dark:bg-zinc-800/60 text-muted-foreground text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">
                            No Price Set
                          </span>
                        )}
                      </div>

                      {item.price ? (
                        <div className="space-y-1.5 bg-muted/40 p-2 rounded-lg border border-border/30">
                          <div className="flex justify-between text-[11px] font-medium text-foreground">
                            <span>Total Price:</span>
                            <span className="font-bold">GH‚Çµ {item.price.toLocaleString()}</span>
                          </div>
                          
                          {/* Progress bar */}
                          {(() => {
                            const paid = getAmountPaid(item);
                            const percent = Math.min(100, Math.round((paid / item.price) * 100));
                            return (
                              <div className="space-y-1">
                                <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
                                  <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${percent}%` }} />
                                </div>
                                <div className="flex justify-between text-[9px] text-muted-foreground font-mono">
                                  <span>Paid: GH‚Çµ {paid} ({percent}%)</span>
                                  <span>Bal: GH‚Çµ {item.price - paid}</span>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      ) : (
                        <p className="text-[11px] text-muted-foreground italic pl-1">
                          No program fee or invoice setup has been configured for this client.
                        </p>
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingBillingIntake(item)}
                        className="w-full h-8 text-[11px] font-bold border-orange-600/30 hover:border-orange-600 hover:bg-orange-600/5 text-orange-600 cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <CreditCard className="h-3.5 w-3.5" />
                        {item.price ? 'Manage Billing & Payments' : 'Configure Billing & Fee Plan'}
                      </Button>
                    </div>

                    {/* Application Assessment Status */}
                    <div className="pt-3 border-t border-border/40 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-orange-600" /> Assessment Status
                        </span>
                        <span className={`px-2 py-0.5 font-bold uppercase rounded-full text-[9px] ${
                          item.status === 'Approved' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400' :
                          item.status === 'In Review' ? 'text-amber-800 bg-amber-100 dark:bg-amber-950/40 dark:text-amber-400' :
                          item.status === 'Rejected' ? 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400' :
                          'bg-slate-100 text-slate-800 dark:bg-slate-950/40 dark:text-slate-400'
                        }`}>
                          {item.status || 'Pending'}
                        </span>
                      </div>
                      
                      {/* Status Selection Row */}
                      <div className="flex flex-wrap items-center gap-1 pt-1">
                        {['Pending', 'In Review', 'Approved', 'Rejected'].map((statusOption) => (
                          <button
                            key={statusOption}
                            disabled={item.status === statusOption || (statusOption === 'Pending' && !item.status)}
                            onClick={async () => {
                              if (statusOption === 'Approved' && getAmountPaid(item) <= 0) {
                                toast.error('Cannot approve client intake. No payment has been made yet.');
                                return;
                              }
                              try {
                                await updateDoc(doc(db, 'service_intakes', item.id), {
                                  status: statusOption
                                });

                                // Record status change activity log
                                try {
                                  await addDoc(collection(db, 'activity_logs'), {
                                    userId: item.userId || null,
                                    userEmail: item.emailAddress || null,
                                    userName: item.fullName || 'Unknown Client',
                                    type: 'status_change',
                                    description: `Application status changed to "${statusOption}" by Admin.`,
                                    createdAt: new Date().toISOString()
                                  });
                                } catch (logErr) {
                                  console.warn('Failed to log status change activity:', logErr);
                                }

                                // Send SMS and Email notifications via the backend
                                try {
                                  let emailNotificationsEnabled = true;
                                  if (item.userId) {
                                    try {
                                      const userDoc = await getDoc(doc(db, 'users', item.userId));
                                      if (userDoc.exists()) {
                                        emailNotificationsEnabled = userDoc.data().emailNotificationsEnabled !== false;
                                      }
                                    } catch (fetchProfileErr) {
                                      console.warn('Failed to fetch applicant preference:', fetchProfileErr);
                                    }
                                  }

                                  await fetch('/api/notify-intake-status', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      fullName: item.fullName,
                                      contact: item.contact,
                                      status: statusOption,
                                      emailAddress: item.emailAddress,
                                      emailNotificationsEnabled
                                    })
                                  });
                                } catch (notifyErr) {
                                  console.warn('Failed to dispatch status update notifications:', notifyErr);
                                }

                                toast.success(`Applicant status updated to "${statusOption}"`);
                              } catch (err) {
                                handleFirestoreError(err, OperationType.UPDATE, `service_intakes/${item.id}`);
                              }
                            }}
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded transition duration-200 cursor-pointer border ${
                              item.status === statusOption || (statusOption === 'Pending' && !item.status)
                                ? 'bg-orange-600 border-orange-600 text-white shadow-xs'
                                : 'bg-muted/40 border-border hover:bg-muted text-muted-foreground'
                            }`}
                          >
                            {statusOption}
                          </button>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {deleteId && (
        <AdminDeleteModal
          title="Delete Intake Registration"
          message="Are you sure you want to delete this consultation client intake record? This action is permanent and cannot be undone."
          onConfirm={() => handleDelete(deleteId)}
          onCancel={() => setDeleteId(null)}
        />
      )}

      {editingBillingIntake && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-card w-full max-w-2xl rounded-xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between bg-muted/20">
              <div className="space-y-0.5">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-orange-600" /> Billing & Payment Plan Coordinator
                </h3>
                <p className="text-xs text-muted-foreground font-medium">
                  Client: <span className="text-foreground font-semibold">{editingBillingIntake.fullName}</span> ({editingBillingIntake.emailAddress})
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setEditingBillingIntake(null)}
                className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer rounded-lg"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Scrollable Content */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {/* Total Price Configuration */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    Total Charge Price (GHS)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-muted-foreground">GH‚Çµ</span>
                    <Input
                      type="number"
                      value={billingPrice}
                      onChange={(e) => {
                        const val = Math.max(0, Number(e.target.value));
                        setBillingPrice(val);
                        handleAutoGeneratePlan(val, billingPlanType);
                      }}
                      className="pl-9 font-bold text-xs"
                      placeholder="e.g. 1000"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Set the total tuition, audition, casting, or consultation package fee.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    Structured Payment Plan
                  </label>
                  <select
                    value={billingPlanType}
                    onChange={(e) => {
                      const val = e.target.value;
                      setBillingPlanType(val);
                      handleAutoGeneratePlan(billingPrice, val);
                    }}
                    className="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="full">Single Payment (Paid in Full)</option>
                    <option value="installments_2">2 Installments (50% / 50% split)</option>
                    <option value="installments_3">3 Installments (40% / 30% / 30% split)</option>
                    <option value="custom">Custom Installments Plan</option>
                  </select>
                  <p className="text-[10px] text-muted-foreground">
                    Select a preset split structure or define a custom billing timeline.
                  </p>
                </div>
              </div>

              {/* Installments Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Scheduled Installment Milestones
                  </h4>
                  {billingPlanType === 'custom' && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const newInst = {
                          id: `inst_${Date.now()}`,
                          name: `Installment ${installments.length + 1}`,
                          amount: 0,
                          status: 'Unpaid',
                          dueDate: new Date().toISOString().split('T')[0]
                        };
                        setInstallments([...installments, newInst]);
                      }}
                      className="h-7 text-[10px] px-2 font-bold text-orange-600 border-orange-600/20 hover:bg-orange-600/5 cursor-pointer"
                    >
                      <Plus className="h-3 w-3 mr-1" /> Add Milestone
                    </Button>
                  )}
                </div>

                <div className="border border-border/80 rounded-lg overflow-hidden bg-muted/10">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-muted/40 border-b border-border/60 text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                          <th className="p-3">Milestone Title</th>
                          <th className="p-3 w-28">Amount (GH‚Çµ)</th>
                          <th className="p-3 w-36">Due Date</th>
                          <th className="p-3 w-24 text-center">Status</th>
                          <th className="p-3 w-32 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40 font-medium">
                        {installments.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-4 text-center text-muted-foreground italic text-xs">
                              No payment milestones scheduled. Configure a total price and plan style to begin.
                            </td>
                          </tr>
                        ) : (
                          installments.map((inst, index) => (
                            <tr key={inst.id} className="hover:bg-muted/20 transition-colors">
                              <td className="p-3">
                                <Input
                                  value={inst.name}
                                  disabled={billingPlanType !== 'custom' && inst.status === 'Paid'}
                                  onChange={(e) => {
                                    const updated = [...installments];
                                    updated[index].name = e.target.value;
                                    setInstallments(updated);
                                  }}
                                  className="h-8 text-xs font-semibold bg-background border-border/60"
                                />
                              </td>
                              <td className="p-3">
                                <Input
                                  type="number"
                                  value={inst.amount}
                                  disabled={billingPlanType !== 'custom' && inst.status === 'Paid'}
                                  onChange={(e) => {
                                    const updated = [...installments];
                                    updated[index].amount = Math.max(0, Number(e.target.value));
                                    setInstallments(updated);
                                  }}
                                  className="h-8 text-xs font-bold font-mono bg-background border-border/60"
                                />
                              </td>
                              <td className="p-3">
                                <Input
                                  type="date"
                                  value={inst.dueDate}
                                  disabled={inst.status === 'Paid'}
                                  onChange={(e) => {
                                    const updated = [...installments];
                                    updated[index].dueDate = e.target.value;
                                    setInstallments(updated);
                                  }}
                                  className="h-8 text-xs font-semibold bg-background border-border/60"
                                />
                              </td>
                              <td className="p-3 text-center">
                                <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                                  inst.status === 'Paid' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400'
                                }`}>
                                  {inst.status}
                                </span>
                              </td>
                              <td className="p-3 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {inst.status === 'Unpaid' ? (
                                    <div className="flex items-center gap-1">
                                      <Input
                                        placeholder="Momo TXN ID..."
                                        value={momoRefCode[inst.id] || ''}
                                        onChange={(e) => setMomoRefCode({ ...momoRefCode, [inst.id]: e.target.value })}
                                        className="h-7 text-[10px] w-24 bg-background border-border/60 inline-block py-0 px-1.5"
                                      />
                                      <Button
                                        size="sm"
                                        onClick={async () => {
                                          const ref = momoRefCode[inst.id]?.trim() || `TXN-CASH-${Math.floor(100000 + Math.random() * 900000)}`;
                                          setConfirmPaymentModal({ index, inst: { ...inst, transactionId: ref } });
                                          setTypedVerifyRef('');
                                          setVerifyRefError('');
                                        }}
                                        className="h-7 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2 py-0 cursor-pointer"
                                      >
                                        Record Pay
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className="text-[10px] text-muted-foreground font-mono truncate max-w-[120px]" title={`Ref: ${inst.transactionId}`}>
                                      Ref: {inst.transactionId}
                                    </div>
                                  )}
                                  
                                  {billingPlanType === 'custom' && inst.status !== 'Paid' && (
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => {
                                        setInstallments(installments.filter((_, i) => i !== index));
                                      }}
                                      className="h-7 w-7 text-muted-foreground hover:text-red-500 rounded-lg"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Validation Note */}
                {(() => {
                  const sum = installments.reduce((acc, inst) => acc + Number(inst.amount), 0);
                  const isMatching = sum === billingPrice;
                  return (
                    <div className="flex items-center justify-between text-[11px] px-2 py-1.5 rounded-lg border bg-muted/30">
                      <span className="text-muted-foreground font-medium">
                        Sum of Milestones: <span className="font-bold font-mono text-foreground">GH‚Çµ {sum.toLocaleString()}</span>
                      </span>
                      {isMatching ? (
                        <span className="text-emerald-600 font-bold flex items-center gap-1">
                          <CheckCircle className="h-3.5 w-3.5" /> Plan Balance Matches perfectly!
                        </span>
                      ) : (
                        <span className="text-red-500 font-bold flex items-center gap-1">
                          <AlertCircle className="h-3.5 w-3.5 animate-pulse" /> Balance mismatch of GH‚Çµ {Math.abs(billingPrice - sum).toLocaleString()}!
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="px-6 py-4 border-t border-border/60 bg-muted/20 flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingBillingIntake(null)}
                className="h-9 text-xs font-semibold border-border hover:bg-muted cursor-pointer"
              >
                Cancel Setup
              </Button>
              <Button
                size="sm"
                disabled={installments.reduce((acc, inst) => acc + Number(inst.amount), 0) !== billingPrice}
                onClick={handleSaveBillingPlan}
                className="h-9 text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white px-4 cursor-pointer"
              >
                <Save className="h-3.5 w-3.5 mr-1.5" /> Save Plan & Generate Invoices
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Payment Verification Confirmation Modal */}
      {confirmPaymentModal && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-card w-full max-w-md rounded-xl border border-border shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-border/60 flex items-center justify-between bg-muted/25">
              <h4 className="text-xs font-bold uppercase tracking-wider text-orange-600 flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4" /> Verify Payment Reference Code
              </h4>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setConfirmPaymentModal(null)}
                className="h-7 w-7 text-muted-foreground hover:text-foreground cursor-pointer rounded-lg"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4">
              <div className="bg-muted/15 border border-border/40 p-3 rounded-lg text-xs space-y-1">
                <p className="text-muted-foreground font-semibold">Payment Details:</p>
                <p className="text-foreground"><span className="font-bold">Milestone:</span> {confirmPaymentModal.inst.name}</p>
                <p className="text-foreground"><span className="font-bold">Amount:</span> GH‚Çµ {confirmPaymentModal.inst.amount.toLocaleString()}</p>
                <p className="text-foreground"><span className="font-bold">Proposed Ref Code:</span> <span className="font-mono font-bold text-orange-600 bg-orange-500/10 px-1.5 py-0.5 rounded">{confirmPaymentModal.inst.transactionId}</span></p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Verify Reference Code
                </label>
                <p className="text-[11px] text-muted-foreground">
                  Please type or paste the reference code <strong className="font-mono select-all">{confirmPaymentModal.inst.transactionId}</strong> below to verify and record this manual payment.
                </p>
                <Input
                  placeholder="Type reference code..."
                  value={typedVerifyRef}
                  onChange={(e) => {
                    setTypedVerifyRef(e.target.value);
                    setVerifyRefError('');
                  }}
                  className="h-9 text-xs font-mono tracking-wider font-bold bg-background border-border"
                />
                {verifyRefError && (
                  <p className="text-[10px] text-red-500 font-bold flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> {verifyRefError}
                  </p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3.5 border-t border-border/60 bg-muted/25 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmPaymentModal(null)}
                className="h-8 text-xs font-semibold"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  if (typedVerifyRef.trim() !== confirmPaymentModal.inst.transactionId.trim()) {
                    setVerifyRefError('Reference code mismatch. Please verify the code.');
                    return;
                  }
                  
                  // Verification succeeded! Update installments state
                  const updated = [...installments];
                  updated[confirmPaymentModal.index].status = 'Paid';
                  updated[confirmPaymentModal.index].paidAt = new Date().toISOString();
                  updated[confirmPaymentModal.index].transactionId = confirmPaymentModal.inst.transactionId;
                  setInstallments(updated);
                  toast.success(`Milestone "${confirmPaymentModal.inst.name}" verified and recorded as paid!`);
                  setConfirmPaymentModal(null);
                }}
                className="h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-4"
              >
                Verify & Record Payment
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ManageCareerApplications() {
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [roleFilter, setRoleFilter] = useState('All');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Editable Work With Us Subtitle
  const [subtitleText, setSubtitleText] = useState('Grefas is always looking for brilliant actors, passionate crew members, video editors, scriptwriters, and consulting staff. Fill in your professional details below to join our talent database.');
  const [savingSubtitle, setSavingSubtitle] = useState(false);

  // Document Modal Preview State
  const [docModal, setDocModal] = useState<{
    isOpen: boolean;
    title: string;
    applicantName: string;
    url?: string;
    fileName?: string;
    text?: string;
  }>({
    isOpen: false,
    title: '',
    applicantName: ''
  });

  // Admin Notes State
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});
  const [savingNotesId, setSavingNotesId] = useState<string | null>(null);

  const navigate = useNavigate();

  // Load Subtitle Text from settings/global
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'global'), (docSnap) => {
      if (docSnap.exists() && docSnap.data().workWithUsSubtitle) {
        setSubtitleText(docSnap.data().workWithUsSubtitle);
      }
    });
    return () => unsub();
  }, []);

  // Fetch Career Applications (exclusively from 'career_applications' collection)
  useEffect(() => {
    setLoading(true);

    const unsubCareers = onSnapshot(
      query(collection(db, 'career_applications'), orderBy('createdAt', 'desc')),
      (careerSnap) => {
        const careerList = careerSnap.docs.map(d => ({ id: d.id, sourceCollection: 'career_applications', ...d.data() }));
        setApplications(careerList);
        setLoading(false);
      },
      (error) => {
        console.warn("ManageCareerApplications fetch error:", error);
        handleFirestoreError(error, OperationType.LIST, 'career_applications');
        setLoading(false);
      }
    );

    return () => unsubCareers();
  }, []);

  const handleSaveSubtitle = async () => {
    if (!subtitleText.trim()) {
      return toast.error('Subtitle text cannot be empty.');
    }
    setSavingSubtitle(true);
    try {
      await setDoc(doc(db, 'settings', 'global'), { workWithUsSubtitle: subtitleText.trim() }, { merge: true });
      toast.success('Work With Us page header text updated live!');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'settings/global');
    } finally {
      setSavingSubtitle(false);
    }
  };

  const handleStatusChange = async (appId: string, sourceCol: string, newStatus: string) => {
    try {
      const targetCol = sourceCol || 'career_applications';
      await updateDoc(doc(db, targetCol, appId), { status: newStatus });
      toast.success(`Candidate status updated to "${newStatus}"`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${sourceCol || 'career_applications'}/${appId}`);
    }
  };

  const handleSaveNote = async (appId: string, sourceCol: string) => {
    const note = editingNotes[appId];
    setSavingNotesId(appId);
    try {
      const targetCol = sourceCol || 'career_applications';
      await updateDoc(doc(db, targetCol, appId), { adminNotes: note || '' });
      toast.success('Admin note saved successfully!');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${sourceCol || 'career_applications'}/${appId}`);
    } finally {
      setSavingNotesId(null);
    }
  };

  const handleDeleteApp = async (appId: string) => {
    const app = applications.find(a => a.id === appId);
    const targetCol = app?.sourceCollection || 'career_applications';
    try {
      await deleteDoc(doc(db, targetCol, appId));
      toast.success('Career application removed from database');
      setDeleteId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${targetCol}/${appId}`);
    }
  };

  const filteredApps = applications.filter((item) => {
    const matchesSearch =
      !searchQuery ||
      item.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.emailAddress?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.contact?.includes(searchQuery) ||
      item.address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.roleTypes && item.roleTypes.some((r: string) => r.toLowerCase().includes(searchQuery.toLowerCase()))) ||
      (item.roleType && item.roleType.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus =
      statusFilter === 'All' ||
      item.status === statusFilter ||
      (statusFilter === 'Pending' && !item.status);

    const matchesRole =
      roleFilter === 'All' ||
      (item.roleTypes && item.roleTypes.includes(roleFilter)) ||
      (item.roleType && item.roleType.includes(roleFilter));

    return matchesSearch && matchesStatus && matchesRole;
  });

  const totalApps = applications.length;
  const pendingApps = applications.filter(a => !a.status || a.status === 'Pending').length;
  const shortlistedApps = applications.filter(a => a.status === 'Shortlisted').length;
  const hiredApps = applications.filter(a => a.status === 'Hired').length;

  return (
    <div className="space-y-6">
      {/* Top Header & Metrics */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <UserCheck className="h-6 w-6 text-orange-600" /> Career Applications & Talent Desk
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Review job submissions, CVs, cover letters, and applicant credentials submitted via the "Work With Us" page.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-400 text-xs font-bold px-3 py-1.5 rounded-lg border border-orange-200 dark:border-orange-800 flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" /> Total: {totalApps}
          </span>
          <span className="bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 text-xs font-bold px-3 py-1.5 rounded-lg border border-amber-200 dark:border-amber-800 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" /> Pending: {pendingApps}
          </span>
          <span className="bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400 text-xs font-bold px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800 flex items-center gap-1.5">
            <Star className="h-3.5 w-3.5" /> Shortlisted: {shortlistedApps}
          </span>
          <span className="bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-400 text-xs font-bold px-3 py-1.5 rounded-lg border border-green-200 dark:border-green-800 flex items-center gap-1.5">
            <CheckCircle className="h-3.5 w-3.5" /> Hired: {hiredApps}
          </span>
        </div>
      </div>

      {/* Editable Work With Us Page Header Subtitle Banner */}
      <Card className="border border-orange-500/30 bg-orange-500/5 shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-xs font-bold uppercase tracking-wider text-orange-600 flex items-center gap-2">
            <Edit className="h-4 w-4" /> Work With Us Page Subtitle Editor
          </CardTitle>
          <CardDescription className="text-xs">
            Edit the description text that appears under "Apply to Work With Us" on the client-facing website.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea 
            value={subtitleText}
            onChange={(e) => setSubtitleText(e.target.value)}
            rows={2}
            className="text-xs bg-background border-border resize-none"
            placeholder="Type header subtitle text..."
          />
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-muted-foreground italic">
              üí° Updates live across the Work With Us page immediately upon saving.
            </p>
            <Button
              size="sm"
              onClick={handleSaveSubtitle}
              disabled={savingSubtitle}
              className="h-8 text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white cursor-pointer px-4"
            >
              {savingSubtitle ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
              Save Subtitle Text
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm w-full">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, phone, role, address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <div className="flex items-center space-x-1 bg-muted p-1 rounded-lg shrink-0">
            {['All', 'Pending', 'Shortlisted', 'Interview Scheduled', 'Hired', 'Rejected'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
                  statusFilter === status 
                    ? 'bg-background text-foreground shadow-xs' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Applications List */}
      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center border border-dashed rounded-xl bg-card">
          <div className="text-center space-y-2">
            <Loader2 className="h-8 w-8 animate-spin text-orange-600 mx-auto" />
            <p className="text-xs text-muted-foreground">Loading candidate submissions...</p>
          </div>
        </div>
      ) : filteredApps.length === 0 ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center text-center rounded-xl border border-dashed border-border p-8 bg-card">
          <UserCheck className="h-10 w-10 text-muted-foreground opacity-40 mb-3" />
          <h3 className="text-sm font-bold text-foreground">No Applications Found</h3>
          <p className="text-xs text-muted-foreground max-w-md mt-1">
            {searchQuery || statusFilter !== 'All' || roleFilter !== 'All' 
              ? 'No candidate submissions match your current search and filter selections.' 
              : 'Candidates who submit the Work With Us application form will appear here with complete details.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredApps.map((item) => {
            const hasCv = item.cvUrl || item.cvFileName || item.cvLink;
            const hasCoverLetter = item.coverLetterUrl || item.coverLetterFileName || item.coverLetterText;

            return (
              <Card key={item.id} className="border border-border bg-card hover:shadow-md transition-shadow flex flex-col justify-between">
                <CardHeader className="pb-3 border-b border-border/50 bg-muted/10">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-11 w-11 rounded-lg border border-border shrink-0 bg-muted flex items-center justify-center text-muted-foreground font-black text-sm text-orange-600">
                        {item.fullName ? item.fullName.charAt(0).toUpperCase() : 'C'}
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-sm font-bold truncate" title={item.fullName}>
                          {item.fullName}
                        </CardTitle>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                          {item.age && (
                            <span className="bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400 font-bold px-1.5 py-0.5 rounded text-[10px]">
                              {item.age} Yrs
                            </span>
                          )}
                          {item.createdAt && (
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(item.createdAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        item.status === 'Hired' ? 'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400' :
                        item.status === 'Shortlisted' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400' :
                        item.status === 'Interview Scheduled' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400' :
                        item.status === 'Rejected' ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400' :
                        'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                      }`}>
                        {item.status || 'Pending'}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteId(item.id)}
                        className="h-7 w-7 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 shrink-0"
                        title="Delete Application"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-3 pb-3 space-y-3 text-xs">
                  {/* Applied Roles */}
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                      Roles Applied For:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {Array.isArray(item.roleTypes) && item.roleTypes.length > 0 ? (
                        item.roleTypes.map((r: string, idx: number) => (
                          <span key={idx} className="bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800/60 font-semibold text-[10px] px-2 py-0.5 rounded">
                            {r}
                          </span>
                        ))
                      ) : item.roleType ? (
                        item.roleType.split(', ').map((r: string, idx: number) => (
                          <span key={idx} className="bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800/60 font-semibold text-[10px] px-2 py-0.5 rounded">
                            {r}
                          </span>
                        ))
                      ) : (
                        <span className="text-muted-foreground text-[10px]">General Talent</span>
                      )}
                    </div>
                  </div>

                  {/* Contact Information */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-muted-foreground">
                    <div className="flex items-center gap-1.5 truncate">
                      <Phone className="h-3.5 w-3.5 text-orange-600 shrink-0" />
                      <a href={`tel:${item.contact}`} className="hover:text-foreground hover:underline font-mono">
                        {item.contact}
                      </a>
                    </div>
                    <div className="flex items-center gap-1.5 truncate">
                      <MessageCircle className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <a 
                        href={`https://wa.me/${item.whatsappNumber?.replace(/[^0-9]/g, '')}`} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="hover:text-emerald-600 hover:underline font-mono"
                      >
                        {item.whatsappNumber} (WhatsApp)
                      </a>
                    </div>
                    <div className="flex items-center gap-1.5 truncate col-span-1 sm:col-span-2">
                      <Mail className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                      <a href={`mailto:${item.emailAddress}`} className="hover:text-foreground hover:underline truncate">
                        {item.emailAddress}
                      </a>
                    </div>
                    {item.address && (
                      <div className="flex items-center gap-1.5 truncate col-span-1 sm:col-span-2">
                        <MapPin className="h-3.5 w-3.5 text-red-500 shrink-0" />
                        <span className="truncate">{item.address}</span>
                      </div>
                    )}
                  </div>

                  {/* Experience & Availability */}
                  <div className="flex items-center gap-3 text-[11px] pt-1 border-t border-border/40">
                    <span className="font-semibold text-foreground">Exp: <span className="text-muted-foreground font-normal">{item.experienceLevel || 'Intermediate'}</span></span>
                    <span className="font-semibold text-foreground">Avail: <span className="text-muted-foreground font-normal">{item.availability || 'Full-time'}</span></span>
                  </div>

                  {/* Attached Documents (CV & Cover Letter) */}
                  <div className="p-2.5 rounded-lg bg-muted/30 border border-border/60 space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                      Attached Candidate Documents:
                    </span>

                    <div className="flex flex-wrap gap-2">
                      {/* CV Button */}
                      {hasCv ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (item.cvUrl) {
                              setDocModal({
                                isOpen: true,
                                title: 'Curriculum Vitae (CV) / Resume',
                                applicantName: item.fullName,
                                url: item.cvUrl,
                                fileName: item.cvFileName || 'CV Document'
                              });
                            } else if (item.cvLink) {
                              window.open(item.cvLink, '_blank');
                            }
                          }}
                          className="h-8 text-xs font-semibold bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 border-orange-200 hover:bg-orange-100"
                        >
                          <FileText className="h-3.5 w-3.5 mr-1 text-orange-600" />
                          View CV / Resume
                        </Button>
                      ) : (
                        <span className="text-[10px] text-muted-foreground italic">No CV uploaded</span>
                      )}

                      {/* Cover Letter Button */}
                      {hasCoverLetter ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setDocModal({
                              isOpen: true,
                              title: 'Cover Letter',
                              applicantName: item.fullName,
                              url: item.coverLetterUrl,
                              fileName: item.coverLetterFileName,
                              text: item.coverLetterText
                            });
                          }}
                          className="h-8 text-xs font-semibold bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-blue-200 hover:bg-blue-100"
                        >
                          <Paperclip className="h-3.5 w-3.5 mr-1 text-blue-600" />
                          View Cover Letter
                        </Button>
                      ) : (
                        <span className="text-[10px] text-muted-foreground italic">No Cover Letter</span>
                      )}

                      {/* Portfolio Button */}
                      {item.portfolioLink && (
                        <a
                          href={item.portfolioLink.startsWith('http') ? item.portfolioLink : `https://${item.portfolioLink}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center h-8 px-2.5 rounded-md border border-border bg-background text-xs font-semibold text-foreground hover:bg-muted"
                        >
                          <ExternalLink className="h-3.5 w-3.5 mr-1 text-purple-600" /> Reel / Portfolio
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Short Bio */}
                  {item.bio && (
                    <div className="p-2 bg-muted/20 rounded border border-border/40 text-[11px]">
                      <span className="font-bold text-foreground">Bio / Highlights: </span>
                      <span className="text-muted-foreground">{item.bio}</span>
                    </div>
                  )}

                  {/* Signature Verification */}
                  {item.signature && (
                    <div className="text-[10px] text-muted-foreground flex items-center justify-between">
                      <span>Digital Signature: <span className="font-serif italic font-bold text-foreground">{item.signature}</span></span>
                      <span className="text-emerald-600 font-bold flex items-center gap-0.5">
                        <ShieldCheck className="h-3 w-3" /> Certified
                      </span>
                    </div>
                  )}

                  {/* Admin Notes */}
                  <div className="pt-2 border-t border-border/40 space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                      Admin Desk Notes:
                    </span>
                    <div className="flex gap-2">
                      <Input
                        value={editingNotes[item.id] !== undefined ? editingNotes[item.id] : (item.adminNotes || '')}
                        onChange={(e) => setEditingNotes({ ...editingNotes, [item.id]: e.target.value })}
                        placeholder="Add hiring note, interview feedback, rating..."
                        className="h-8 text-xs flex-1 bg-background"
                      />
                      <Button
                        size="sm"
                        onClick={() => handleSaveNote(item.id, item.sourceCollection)}
                        disabled={savingNotesId === item.id}
                        className="h-8 text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white px-2.5 cursor-pointer"
                      >
                        {savingNotesId === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>

                  {/* Status Selection Buttons */}
                  <div className="pt-2 border-t border-border/40 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                      Update Candidate Status:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {['Pending', 'Shortlisted', 'Interview Scheduled', 'Hired', 'Rejected'].map((statusOpt) => (
                        <button
                          key={statusOpt}
                          onClick={() => handleStatusChange(item.id, item.sourceCollection, statusOpt)}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded transition duration-200 cursor-pointer border ${
                            item.status === statusOpt || (statusOpt === 'Pending' && !item.status)
                              ? 'bg-orange-600 border-orange-600 text-white shadow-xs'
                              : 'bg-muted/40 border-border hover:bg-muted text-muted-foreground'
                          }`}
                        >
                          {statusOpt}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Quick Action: Generate Contract Letter */}
                  <div className="pt-2 border-t border-border/40 flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate('/admin/letters')}
                      className="h-7 text-[11px] font-semibold text-orange-600 border-orange-200 hover:bg-orange-50"
                    >
                      <FileText className="h-3 w-3 mr-1" /> Issue Official Letter / Contract
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Delete Modal */}
      {deleteId && (
        <AdminDeleteModal
          title="Delete Career Application"
          message="Are you sure you want to remove this candidate's application from the database? This action is permanent."
          onConfirm={() => handleDeleteApp(deleteId)}
          onCancel={() => setDeleteId(null)}
        />
      )}

      {/* Document Viewer Modal */}
      {docModal.isOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card w-full max-w-3xl rounded-xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-5 py-4 border-b border-border/60 flex items-center justify-between bg-muted/20">
              <div>
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4 text-orange-600" /> {docModal.title}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Applicant: <span className="font-semibold text-foreground">{docModal.applicantName}</span>
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDocModal({ isOpen: false, title: '', applicantName: '' })}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {docModal.text && (
                <div className="p-4 bg-muted/30 border border-border rounded-xl text-xs leading-relaxed whitespace-pre-wrap font-sans text-foreground">
                  {docModal.text}
                </div>
              )}

              {docModal.url && (
                docModal.url.startsWith('data:image/') ? (
                  <div className="flex justify-center p-2 bg-muted/20 rounded-xl border border-border">
                    <img src={docModal.url} alt="Uploaded Document" className="max-h-[500px] object-contain rounded-lg" />
                  </div>
                ) : docModal.url.startsWith('data:application/pdf') || docModal.url.includes('.pdf') ? (
                  <div className="h-[450px] w-full rounded-xl overflow-hidden border border-border bg-muted/10">
                    <iframe src={docModal.url} className="w-full h-full border-none" title="PDF Document Viewer" />
                  </div>
                ) : (
                  <div className="p-6 text-center space-y-3 bg-muted/20 rounded-xl border border-border">
                    <FileText className="h-10 w-10 text-orange-600 mx-auto" />
                    <p className="text-xs font-semibold text-foreground">{docModal.fileName || 'Attached Document'}</p>
                    <a
                      href={docModal.url}
                      download={docModal.fileName || 'candidate-document'}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs"
                    >
                      <Download className="h-3.5 w-3.5 mr-1.5" /> Download / View Document
                    </a>
                  </div>
                )
              )}
            </div>

            <div className="px-5 py-3 border-t border-border/60 bg-muted/20 flex justify-end">
              <Button
                size="sm"
                onClick={() => setDocModal({ isOpen: false, title: '', applicantName: '' })}
                className="h-8 text-xs font-semibold"
              >
                Close Window
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ManageServices() {
  const [services, setServices] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newService, setNewService] = useState({ 
    title: '', 
    description: '', 
    iconName: 'Briefcase', 
    color: 'bg-blue-100 text-blue-600', 
    category: 'Consulting',
    price: 150 
  });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [categoryType, setCategoryType] = useState('Consulting');
  const [customCategory, setCustomCategory] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'services'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setServices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'services');
    });
    return () => unsubscribe();
  }, []);

  const handleEditClick = (service: any) => {
    setEditingId(service.id);
    setNewService({
      title: service.title || '',
      description: service.description || '',
      iconName: service.iconName || 'Briefcase',
      color: service.color || 'bg-blue-100 text-blue-600',
      category: service.category || 'Consulting',
      price: service.price !== undefined ? service.price : 150
    });
    const standardCategories = ['Consulting', 'Entertainment', 'Production', 'Creative'];
    if (standardCategories.includes(service.category)) {
      setCategoryType(service.category);
      setCustomCategory('');
    } else {
      setCategoryType('Custom');
      setCustomCategory(service.category || '');
    }
    setIsAdding(true);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const finalCategory = categoryType === 'Custom' ? customCategory.trim() : categoryType;
      if (!finalCategory) {
        toast.error('Please specify a category');
        return;
      }
      const serviceData = {
        title: newService.title,
        description: newService.description,
        iconName: newService.iconName,
        color: newService.color,
        category: finalCategory,
        price: Number(newService.price) || 0,
      };

      if (editingId) {
        await setDoc(doc(db, 'services', editingId), serviceData, { merge: true });
        toast.success('Service updated successfully');
      } else {
        await addDoc(collection(db, 'services'), {
          ...serviceData,
          createdAt: serverTimestamp()
        });
        toast.success('Service added successfully');
      }

      setIsAdding(false);
      setEditingId(null);
      setNewService({ title: '', description: '', iconName: 'Briefcase', color: 'bg-blue-100 text-blue-600', category: 'Consulting', price: 150 });
      setCategoryType('Consulting');
      setCustomCategory('');
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'services');
    }
  };

  const handleSendReminder = async (booking: any) => {
    try {
      // Try to load booking_reminder template from Firestore for custom SMS alert
      let customSmsMessage = undefined;
      try {
        const templatesSnapshot = await getDocs(query(collection(db, 'sms_templates'), where('name', '==', 'booking_reminder')));
        if (!templatesSnapshot.empty) {
          const tplData = templatesSnapshot.docs[0].data();
          if (tplData && tplData.content) {
            customSmsMessage = tplData.content
              .replace(/{name}/g, booking.userName)
              .replace(/{service}/g, booking.serviceTitle || 'General Consultation')
              .replace(/{date}/g, booking.date)
              .replace(/{time}/g, booking.time || 'scheduled time')
              .replace(/{orderNumber}/g, booking.orderNumber || 'N/A');
          }
        }
      } catch (err) {
        console.warn("Failed to fetch booking_reminder template, falling back to default SMS.", err);
      }

      const response = await fetch('/api/notify-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: booking.userEmail,
          phone: booking.userPhone,
          userName: booking.userName,
          serviceTitle: booking.serviceTitle || 'General Consultation',
          date: booking.date,
          customMessage: customSmsMessage
        })
      });

      const result = await response.json();
      
      // Also add an in-app notification
      if (booking.userId && booking.userId !== 'anonymous') {
        await addDoc(collection(db, 'notifications'), {
          userId: booking.userId,
          title: 'Booking Reminder',
          message: `This is a reminder for your booking: ${booking.serviceTitle || 'General Consultation'} on ${booking.date}. We look forward to seeing you!`,
          read: false,
          createdAt: serverTimestamp()
        });
      }

      if (result.results?.sms && result.results.sms.startsWith("failed")) {
        const errorMsg = `Reminder sent via email, but SMS failed: ${result.results.sms}`;
        toast.warning(errorMsg, { duration: 8000 });
      } else {
        toast.success("Reminder sent successfully!");
      }
    } catch (error) {
      console.error("Failed to send reminder:", error);
      toast.error("Failed to send reminder.");
    }
  };

  const handleDelete = (id: string) => {
    setDeleteId(id);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteDoc(doc(db, 'services', deleteId));
      toast.success('Service deleted');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `services/${deleteId}`);
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Manage Services</h1>
        <Button 
          onClick={() => {
            if (isAdding) {
              setIsAdding(false);
              setEditingId(null);
              setNewService({ title: '', description: '', iconName: 'Briefcase', color: 'bg-blue-100 text-blue-600', category: 'Consulting', price: 150 });
            } else {
              setIsAdding(true);
            }
          }} 
          className="bg-orange-600 hover:bg-orange-700 text-white"
        >
          {isAdding ? 'Cancel' : <><Plus className="mr-2 h-4 w-4" /> Add Service</>}
        </Button>
      </div>

      {isAdding && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">{editingId ? 'Edit Service' : 'Add New Service'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdd} className="space-y-4">
              <Input 
                placeholder="Title" 
                value={newService.title} 
                onChange={e => setNewService({...newService, title: e.target.value})} 
                required 
                className="bg-muted/50 border-border"
              />
              <Textarea 
                placeholder="Description" 
                value={newService.description} 
                onChange={e => setNewService({...newService, description: e.target.value})} 
                required 
                className="bg-muted/50 border-border"
              />
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Input 
                  placeholder="Price (GH‚Çµ)" 
                  type="number"
                  value={newService.price} 
                  onChange={e => setNewService({...newService, price: Number(e.target.value) || 0})} 
                  required 
                  className="bg-muted/50 border-border"
                />
                <Input 
                  placeholder="Icon Name (Lucide)" 
                  value={newService.iconName} 
                  onChange={e => setNewService({...newService, iconName: e.target.value})} 
                  required 
                  className="bg-muted/50 border-border"
                />
                <Input 
                  placeholder="Color Classes" 
                  value={newService.color} 
                  onChange={e => setNewService({...newService, color: e.target.value})} 
                  required 
                  className="bg-muted/50 border-border"
                />
                <div className="flex flex-col gap-2">
                  <select
                    value={categoryType}
                    onChange={e => setCategoryType(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="Consulting">Consulting Services</option>
                    <option value="Entertainment">Entertainment Services</option>
                    <option value="Production">Production Services</option>
                    <option value="Creative">Creative Services</option>
                    <option value="Custom">Custom Category...</option>
                  </select>
                  {categoryType === 'Custom' && (
                    <Input 
                      placeholder="Enter Custom Category" 
                      value={customCategory} 
                      onChange={e => setCustomCategory(e.target.value)} 
                      required 
                      className="bg-muted/50 border-border h-10 text-sm"
                    />
                  )}
                </div>
              </div>
              <Button type="submit" className="w-full bg-orange-600 text-white">
                {editingId ? 'Save Changes' : 'Save Service'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
      
      <Card className="bg-card border-border">
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {services.map((service) => (
              <div key={service.id} className="flex items-center justify-between p-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-foreground text-sm">{service.title}</p>
                    <span className="text-[10px] uppercase font-bold bg-muted text-muted-foreground px-2 py-0.5 rounded tracking-wider">
                      {service.category || 'Consulting'}
                    </span>
                    <span className="text-xs font-extrabold text-orange-600 bg-orange-600/10 px-2 py-0.5 rounded-full">
                      GH‚Çµ {(service.price !== undefined ? service.price : 150).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate max-w-md mt-1">{service.description}</p>
                </div>
                <div className="flex space-x-2">
                  <Button variant="ghost" size="sm" onClick={() => handleEditClick(service)} className="text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/10 hover:text-orange-700">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(service.id)} className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 hover:text-red-700">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            {services.length === 0 && <p className="p-8 text-center text-muted-foreground">No services found.</p>}
          </div>
        </CardContent>
      </Card>

      {deleteId && (
        <AdminDeleteModal
          title="Delete Service"
          message="Are you sure you want to delete this service? This action is completely permanent and cannot be undone."
          onConfirm={confirmDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}

function ManageTransactions() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newTransaction, setNewTransaction] = useState({
    description: '',
    amount: '',
    type: 'credit',
    category: 'Consultation Booking',
    ref: '',
    bookingId: '',
    bookingOrderNumber: '',
    status: 'successful',
    customDate: format(new Date(), 'yyyy-MM-dd')
  });

  const [statusTab, setStatusTab] = useState<'all' | 'successful' | 'pending' | 'failed' | 'bookings'>('all');
  const [filterType, setFilterType] = useState<'all' | 'credit' | 'debit'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedReceiptData, setSelectedReceiptData] = useState<any | null>(null);

  // Paystack Gateway State
  const [paystackConfig, setPaystackConfig] = useState<any>(null);
  const [lookupRef, setLookupRef] = useState('');
  const [isVerifyingPaystack, setIsVerifyingPaystack] = useState(false);
  const [paystackVerifyResult, setPaystackVerifyResult] = useState<any>(null);
  const [showPaystackPanel, setShowPaystackPanel] = useState(false);
  const [paystackPanelTab, setPaystackPanelTab] = useState<'verifier' | 'webhooks' | 'test'>('verifier');
  const [webhookEvents, setWebhookEvents] = useState<any[]>([]);
  const [isLoadingWebhooks, setIsLoadingWebhooks] = useState(false);
  const [isSimulatingWebhook, setIsSimulatingWebhook] = useState(false);
  const [simEvent, setSimEvent] = useState<'charge.success' | 'charge.failed'>('charge.success');
  const [simAmount, setSimAmount] = useState('50.00');
  const [simEmail, setSimEmail] = useState('client.test@grefas.com');
  const [simPhone, setSimPhone] = useState('+233244123456');
  const [simChannel, setSimChannel] = useState('mobile_money');

  const fetchWebhookLogs = async () => {
    setIsLoadingWebhooks(true);
    try {
      const data = await getPaystackWebhookEvents();
      if (data.status && data.data) {
        setWebhookEvents(data.data);
      }
    } catch (err: any) {
      console.warn('Failed to fetch webhook events:', err);
    } finally {
      setIsLoadingWebhooks(false);
    }
  };

  useEffect(() => {
    if (showPaystackPanel && paystackPanelTab === 'webhooks') {
      fetchWebhookLogs();
    }
  }, [showPaystackPanel, paystackPanelTab]);

  const handleTriggerSimulatedWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSimulatingWebhook(true);
    try {
      const numAmount = parseFloat(simAmount) || 50;
      const testRef = `GREFAS-TEST-${Date.now()}`;
      const res = await simulateTestWebhook({
        event: simEvent,
        amount: Math.round(numAmount * 100),
        email: simEmail,
        phone: simPhone,
        channel: simChannel,
        reference: testRef
      });
      if (res.status) {
        toast.success(`Simulated '${simEvent}' event dispatched! Reference: ${res.data?.reference || testRef}`);
        await fetchWebhookLogs();
        setPaystackPanelTab('webhooks');
      } else {
        toast.error(res.message || 'Failed to trigger simulated webhook');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error triggering test webhook');
    } finally {
      setIsSimulatingWebhook(false);
    }
  };

  // Categories list
  const creditCategories = [
    "Consultation Booking",
    "Audition / Casting Fee",
    "Media Sponsorship",
    "Event Ticket Sale",
    "Other Income"
  ];

  const debitCategories = [
    "Specialist/Staff Payroll",
    "Equipment Purchase",
    "Office Utilities",
    "Entertainment Event Production",
    "Marketing & Ads",
    "Other Expense"
  ];

  useEffect(() => {
    fetch('/api/paystack/config')
      .then(res => res.json())
      .then(data => setPaystackConfig(data))
      .catch(err => console.warn("Failed to fetch Paystack configuration:", err));
  }, []);

  const handleLookupPaystack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupRef.trim()) {
      toast.error("Please enter a valid Paystack transaction reference");
      return;
    }
    setIsVerifyingPaystack(true);
    setPaystackVerifyResult(null);
    try {
      const res = await fetch(`/api/paystack/verify/${encodeURIComponent(lookupRef.trim())}`);
      const data = await res.json();
      setPaystackVerifyResult(data);
      if (data.status && data.data?.status === 'success') {
        toast.success(`Paystack Transaction verified: GHS ${(data.data.amount / 100).toFixed(2)} (${data.data.channel || 'momo'})`);
      } else if (data.status) {
        toast.info(`Transaction status: ${data.data?.status || 'unknown'}`);
      } else {
        toast.error(data.message || "Failed to verify transaction with Paystack");
      }
    } catch (err: any) {
      toast.error(err.message || "Network error verifying Paystack reference");
    } finally {
      setIsVerifyingPaystack(false);
    }
  };

  useEffect(() => {
    const q = query(collection(db, 'transactions'), orderBy('createdAt', 'desc'));
    const unsubscribeTrans = onSnapshot(q, (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      console.error("Error fetching transactions:", error);
      setLoading(false);
    });

    const unsubscribeBookings = onSnapshot(collection(db, 'bookings'), (snapshot) => {
      setBookings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.warn("Bookings listener warning:", error);
    });

    return () => {
      unsubscribeTrans();
      unsubscribeBookings();
    };
  }, []);

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTransaction.description.trim()) {
      toast.error("Please enter a description");
      return;
    }
    if (!newTransaction.amount || Number(newTransaction.amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    try {
      const selectedDate = newTransaction.customDate 
        ? new Date(newTransaction.customDate + 'T12:00:00') 
        : new Date();

      const txData: Record<string, any> = {
        description: newTransaction.description.trim(),
        amount: Number(newTransaction.amount),
        type: newTransaction.type,
        category: newTransaction.category,
        ref: newTransaction.ref.trim(),
        status: newTransaction.status || 'successful',
        gateway: 'Paystack',
        recordedBy: auth.currentUser?.email || 'admin',
        createdAt: serverTimestamp(),
        transactionDate: selectedDate.toISOString()
      };

      if (newTransaction.bookingId.trim()) {
        txData.bookingId = newTransaction.bookingId.trim();
      }
      if (newTransaction.bookingOrderNumber.trim()) {
        txData.bookingOrderNumber = newTransaction.bookingOrderNumber.trim();
      }

      await addDoc(collection(db, 'transactions'), txData);

      toast.success("Transaction recorded successfully!");
      setIsAdding(false);
      setNewTransaction({
        description: '',
        amount: '',
        type: 'credit',
        category: 'Consultation Booking',
        ref: '',
        bookingId: '',
        bookingOrderNumber: '',
        status: 'successful',
        customDate: format(new Date(), 'yyyy-MM-dd')
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'transactions');
    }
  };

  const handleDeleteTransaction = async () => {
    if (!deleteId) return;
    try {
      await deleteDoc(doc(db, 'transactions', deleteId));
      toast.success("Transaction deleted successfully");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `transactions/${deleteId}`);
    } finally {
      setDeleteId(null);
    }
  };

  const handleDownloadCSV = () => {
    try {
      if (filteredTransactions.length === 0) {
        toast.error("No transactions available to export.");
        return;
      }

      // Define columns
      const headers = ["Date", "Description", "Type", "Category", "Payment Status", "Payment Ref", "Associated Booking ID", "Amount (GHS)", "Recorded By"];
      
      // Map rows
      const rows = filteredTransactions.map(t => {
        const displayDate = t.transactionDate 
          ? format(new Date(t.transactionDate), 'yyyy-MM-dd')
          : t.createdAt?.seconds 
            ? format(new Date(t.createdAt.seconds * 1000), 'yyyy-MM-dd')
            : 'Recent';
            
        return [
          displayDate,
          `"${(t.description || '').replace(/"/g, '""')}"`,
          t.type === 'credit' ? 'CREDIT (Income)' : 'DEBIT (Expense)',
          t.category || 'N/A',
          t.status || 'successful',
          t.ref || 'N/A',
          t.bookingOrderNumber || t.bookingId || 'N/A',
          t.amount || 0,
          t.recordedBy || 'N/A'
        ];
      });

      // Construct CSV Content
      const csvContent = [
        headers.join(","),
        ...rows.map(e => e.join(","))
      ].join("\n");

      // Create Downloadable blob
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `Grefas_Transactions_Report_${format(new Date(), 'yyyy-MM-dd')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success("CSV Report downloaded successfully!");
    } catch (err) {
      console.error("Failed to export ledger to CSV:", err);
      toast.error("Failed to generate CSV export.");
    }
  };

  // Calculations
  const totalCredits = transactions
    .filter(t => t.type === 'credit')
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const totalDebits = transactions
    .filter(t => t.type === 'debit')
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const balanceRemaining = totalCredits - totalDebits;

  // Filter and Search
  const filteredTransactions = transactions.filter(t => {
    // Status Tab filter
    if (statusTab === 'successful') {
      const isSuccess = t.status === 'successful' || t.status === 'success' || (!t.status && t.type === 'credit');
      if (!isSuccess) return false;
    } else if (statusTab === 'pending') {
      const isPending = t.status === 'pending' || t.status === 'processing';
      if (!isPending) return false;
    } else if (statusTab === 'failed') {
      const isFailed = t.status === 'failed' || t.status === 'abandoned';
      if (!isFailed) return false;
    } else if (statusTab === 'bookings') {
      const isBooking = t.category === 'Consultation Booking' || Boolean(t.bookingId || t.bookingOrderNumber);
      if (!isBooking) return false;
    }

    const matchesType = filterType === 'all' || t.type === filterType;
    const matchesCategory = filterCategory === 'all' || t.category === filterCategory;
    const matchesSearch = !searchQuery || 
      (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (t.category && t.category.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (t.ref && t.ref.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (t.bookingId && t.bookingId.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (t.bookingOrderNumber && t.bookingOrderNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (t.customerName && t.customerName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (t.customerEmail && t.customerEmail.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesType && matchesCategory && matchesSearch;
  });

  const successfulCount = transactions.filter(t => t.status === 'successful' || t.status === 'success' || (!t.status && t.type === 'credit')).length;
  const pendingCount = transactions.filter(t => t.status === 'pending' || t.status === 'processing').length;
  const bookingCount = transactions.filter(t => t.category === 'Consultation Booking' || Boolean(t.bookingId || t.bookingOrderNumber)).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Financial Ledger & Payment Transactions</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time tracking of all Paystack transactions, consultation bookings, payroll disbursements, and associated booking records.
          </p>
        </div>
        <Button onClick={() => setIsAdding(!isAdding)} className="bg-orange-600 hover:bg-orange-700 text-white font-bold">
          {isAdding ? 'Cancel' : <><Plus className="mr-2 h-4 w-4" /> Record Transaction</>}
        </Button>
      </div>

      {/* Aggregate Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Credits (Income)</p>
              <h3 className="text-2xl font-black text-emerald-600 mt-1">
                GH‚Çµ {totalCredits.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
            </div>
            <div className="h-12 w-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <TrendingUp className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Debits</p>
              <h3 className="text-2xl font-black text-rose-600 mt-1">
                GH‚Çµ {totalDebits.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
            </div>
            <div className="h-12 w-12 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
              <TrendingDown className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Expenses</p>
              <h3 className="text-2xl font-black text-orange-600 mt-1">
                GH‚Çµ {totalDebits.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
            </div>
            <div className="h-12 w-12 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center">
              <DollarSign className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Balance Remaining</p>
              <h3 className={`text-2xl font-black mt-1 ${balanceRemaining >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                GH‚Çµ {balanceRemaining.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
            </div>
            <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${balanceRemaining >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
              <Wallet className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Paystack Payment Gateway Card */}
      <Card className="bg-card border border-emerald-500/30 shadow-sm overflow-hidden">
        <div className="bg-emerald-500/10 px-6 py-4 border-b border-emerald-500/20 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-black text-sm shadow">
              P
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-foreground text-base">Paystack Payment Gateway</h3>
                <span className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full font-mono uppercase tracking-wider">
                  {paystackConfig?.configured ? 'Active & Configured' : 'Live Gateway'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Official payment provider for MTN MoMo, Telecel Cash, AT Money, and Visa/Mastercard transactions.
              </p>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowPaystackPanel(!showPaystackPanel)}
            className="border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 text-xs font-semibold"
          >
            {showPaystackPanel ? 'Hide Verification Tool' : 'Verify Paystack Reference'}
          </Button>
        </div>

        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-muted/40 p-3 rounded-xl border border-border/50">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Default Currency</span>
              <span className="text-sm font-bold text-foreground font-mono mt-0.5 block">{paystackConfig?.currency || 'GHS'} (Ghanaian Cedis)</span>
            </div>
            <div className="bg-muted/40 p-3 rounded-xl border border-border/50">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Supported Channels</span>
              <span className="text-xs font-medium text-foreground mt-0.5 block">Mobile Money (MTN, Telecel, AT), Cards</span>
            </div>
            <div className="bg-muted/40 p-3 rounded-xl border border-border/50">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Public Key Status</span>
              <span className="text-xs font-mono font-bold text-emerald-600 mt-0.5 block">
                {paystackConfig?.publicKey ? `${paystackConfig.publicKey.slice(0, 12)}...` : 'Environment Ready'}
              </span>
            </div>
            <div className="bg-muted/40 p-3 rounded-xl border border-border/50">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Webhook Endpoint</span>
              <span className="text-xs font-mono text-muted-foreground mt-0.5 block">/api/paystack/webhook</span>
            </div>
          </div>

          {showPaystackPanel && (
            <div className="pt-4 border-t border-border space-y-5">
              {/* Tab Navigation */}
              <div className="flex flex-wrap gap-2 border-b border-border pb-3">
                <button
                  type="button"
                  onClick={() => setPaystackPanelTab('verifier')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    paystackPanelTab === 'verifier'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  üîç Transaction Verifier
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPaystackPanelTab('webhooks');
                    fetchWebhookLogs();
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    paystackPanelTab === 'webhooks'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Radio className="h-3.5 w-3.5 animate-pulse text-emerald-400" />
                  Webhook Events Monitor
                  {webhookEvents.length > 0 && (
                    <span className="ml-1 px-1.5 py-0.2 bg-black/20 text-white rounded-full text-[10px]">
                      {webhookEvents.length}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setPaystackPanelTab('test')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    paystackPanelTab === 'test'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Zap className="h-3.5 w-3.5" />
                  Test Webhook Generator
                </button>
              </div>

              {/* Tab 1: Live Verifier */}
              {paystackPanelTab === 'verifier' && (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-bold text-foreground">Query Paystack Transaction by Reference</h4>
                    <p className="text-xs text-muted-foreground">
                      Directly verify any transaction reference with the Paystack REST API.
                    </p>
                  </div>

                  <form onSubmit={handleLookupPaystack} className="flex gap-2 max-w-xl">
                    <Input
                      placeholder="Enter Paystack Ref (e.g., GREFAS-BOOK-123456)"
                      value={lookupRef}
                      onChange={(e) => setLookupRef(e.target.value)}
                      className="font-mono text-xs"
                    />
                    <Button 
                      type="submit" 
                      disabled={isVerifyingPaystack}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 text-xs font-bold"
                    >
                      {isVerifyingPaystack ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Query Gateway'}
                    </Button>
                  </form>

                  {paystackVerifyResult && (
                    <div className={`p-4 rounded-xl border text-xs space-y-2 font-mono ${
                      paystackVerifyResult.status && paystackVerifyResult.data?.status === 'success'
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-200'
                        : 'bg-muted border-border text-foreground'
                    }`}>
                      <div className="flex items-center justify-between font-bold">
                        <span>STATUS: {paystackVerifyResult.status ? (paystackVerifyResult.data?.status?.toUpperCase() || 'OK') : 'FAILED'}</span>
                        <span>AMOUNT: GHS {((paystackVerifyResult.data?.amount || 0) / 100).toFixed(2)}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                        <div>Channel: {paystackVerifyResult.data?.channel || 'N/A'}</div>
                        <div>Gateway Response: {paystackVerifyResult.data?.gateway_response || 'N/A'}</div>
                        <div>Customer: {paystackVerifyResult.data?.customer?.email || 'N/A'}</div>
                        <div>Paid At: {paystackVerifyResult.data?.paid_at ? new Date(paystackVerifyResult.data.paid_at).toLocaleString() : 'N/A'}</div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Webhook Events Monitor */}
              {paystackPanelTab === 'webhooks' && (
                <div className="space-y-4">
                  <div className="bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider block">
                          Live Gateway Webhook URL
                        </span>
                        <code className="text-xs font-mono font-bold text-foreground">
                          {typeof window !== 'undefined' ? `${window.location.origin}/api/paystack/webhook` : '/api/paystack/webhook'}
                        </code>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const url = `${window.location.origin}/api/paystack/webhook`;
                            navigator.clipboard.writeText(url);
                            toast.success('Webhook URL copied to clipboard!');
                          }}
                          className="h-8 text-xs font-bold gap-1 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                        >
                          <Copy className="h-3.5 w-3.5" /> Copy URL
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={fetchWebhookLogs}
                          disabled={isLoadingWebhooks}
                          className="h-8 text-xs font-bold gap-1"
                        >
                          <RefreshCw className={`h-3.5 w-3.5 ${isLoadingWebhooks ? 'animate-spin' : ''}`} /> Refresh
                        </Button>
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Paystack securely notifies this endpoint whenever a client completes or fails a payment. Signatures are cryptographically validated using HMAC-SHA512.
                    </p>
                  </div>

                  {isLoadingWebhooks ? (
                    <div className="flex items-center justify-center p-8 text-muted-foreground text-xs">
                      <Loader2 className="h-5 w-5 animate-spin mr-2 text-emerald-600" /> Loading webhook events...
                    </div>
                  ) : webhookEvents.length === 0 ? (
                    <div className="p-8 text-center bg-muted/30 rounded-xl border border-border/50 space-y-3">
                      <Radio className="h-8 w-8 mx-auto text-muted-foreground opacity-50" />
                      <p className="text-xs text-muted-foreground font-medium">
                        No webhook events recorded yet. You can trigger a live payment or use the Test Generator below.
                      </p>
                      <Button
                        size="sm"
                        onClick={() => setPaystackPanelTab('test')}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                      >
                        ‚ö° Generate Test Webhook Event
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                      {webhookEvents.map((evt) => (
                        <div
                          key={evt.id}
                          className={`p-3.5 rounded-xl border text-xs space-y-1.5 transition-all ${
                            evt.status === 'success' || evt.event === 'charge.success'
                              ? 'bg-emerald-500/5 border-emerald-500/20'
                              : 'bg-rose-500/5 border-rose-500/20'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase font-mono ${
                                  evt.status === 'success' || evt.event === 'charge.success'
                                    ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                                    : 'bg-rose-500/20 text-rose-700 dark:text-rose-300'
                                }`}
                              >
                                {evt.event}
                              </span>
                              <span className="font-mono font-bold text-foreground text-xs">
                                {evt.reference}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-foreground text-xs">
                                GH‚Çµ {Number(evt.amountInGhs || 0).toFixed(2)}
                              </span>
                              <span className="text-[10px] text-muted-foreground font-mono">
                                {new Date(evt.receivedAt).toLocaleTimeString()}
                              </span>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-muted-foreground pt-1 border-t border-border/40 font-mono">
                            <div><strong className="text-foreground">Channel:</strong> {evt.channel}</div>
                            <div><strong className="text-foreground">Customer:</strong> {evt.customerEmail}</div>
                            <div><strong className="text-foreground">Gateway:</strong> {evt.gatewayResponse}</div>
                            <div>
                              <strong className="text-foreground">HMAC Sig:</strong>{' '}
                              <span className={evt.signatureVerified ? 'text-emerald-600 font-bold' : 'text-amber-600'}>
                                {evt.signatureVerified ? '‚úì Verified' : 'Dev Mode'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Webhook Simulator */}
              {paystackPanelTab === 'test' && (
                <form onSubmit={handleTriggerSimulatedWebhook} className="space-y-4 bg-muted/20 p-4 rounded-xl border border-border/50">
                  <div>
                    <h4 className="text-sm font-bold text-foreground">Simulate Gateway Webhook Payload</h4>
                    <p className="text-xs text-muted-foreground">
                      Test the server webhook handling, receipt generation, and SMS dispatcher without making a real charge.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase">Event Type</label>
                      <select
                        value={simEvent}
                        onChange={(e) => setSimEvent(e.target.value as any)}
                        className="w-full h-9 rounded-md border border-border bg-background px-3 text-xs text-foreground"
                      >
                        <option value="charge.success">charge.success (Payment Succeeded)</option>
                        <option value="charge.failed">charge.failed (Payment Failed)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase">Amount (GHS)</label>
                      <Input
                        type="number"
                        step="0.01"
                        value={simAmount}
                        onChange={(e) => setSimAmount(e.target.value)}
                        className="h-9 text-xs font-mono"
                        placeholder="50.00"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase">Channel</label>
                      <select
                        value={simChannel}
                        onChange={(e) => setSimChannel(e.target.value)}
                        className="w-full h-9 rounded-md border border-border bg-background px-3 text-xs text-foreground"
                      >
                        <option value="mobile_money">Mobile Money (MTN / Telecel / AT)</option>
                        <option value="card">Visa / Mastercard</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase">Customer Email</label>
                      <Input
                        type="email"
                        value={simEmail}
                        onChange={(e) => setSimEmail(e.target.value)}
                        className="h-9 text-xs"
                        placeholder="client@example.com"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase">Customer Phone (for SMS)</label>
                      <Input
                        type="tel"
                        value={simPhone}
                        onChange={(e) => setSimPhone(e.target.value)}
                        className="h-9 text-xs font-mono"
                        placeholder="+233244123456"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      type="submit"
                      disabled={isSimulatingWebhook}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold gap-2"
                    >
                      {isSimulatingWebhook ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                      Dispatch Simulated Webhook Event
                    </Button>
                  </div>
                </form>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {isAdding && (
        <Card className="bg-card border-border shadow-md">
          <CardHeader>
            <CardTitle className="text-foreground">Record New Ledger Entry</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">Add a new credit or debit transaction to the financial ledger.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddTransaction} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Entry Type</label>
                  <select
                    value={newTransaction.type}
                    onChange={e => {
                      const type = e.target.value as 'credit' | 'debit';
                      setNewTransaction({
                        ...newTransaction,
                        type,
                        category: type === 'credit' ? creditCategories[0] : debitCategories[0]
                      });
                    }}
                    className="flex h-10 w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="credit">Credit (+) Income</option>
                    <option value="debit">Debit (-) Expense</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Category</label>
                  <select
                    value={newTransaction.category}
                    onChange={e => setNewTransaction({ ...newTransaction, category: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    {newTransaction.type === 'credit' ? (
                      creditCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)
                    ) : (
                      debitCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)
                    )}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Transaction Date</label>
                  <Input
                    type="date"
                    value={newTransaction.customDate}
                    onChange={e => setNewTransaction({ ...newTransaction, customDate: e.target.value })}
                    required
                    className="bg-muted/50 border-border"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Description / Purpose</label>
                  <Input
                    placeholder="Enter what this payment covers (e.g., Audition fee, sound rentals)"
                    value={newTransaction.description}
                    onChange={e => setNewTransaction({ ...newTransaction, description: e.target.value })}
                    required
                    className="bg-muted/50 border-border"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Amount (GH‚Çµ)</label>
                  <Input
                    type="number"
                    step="any"
                    placeholder="0.00"
                    value={newTransaction.amount}
                    onChange={e => setNewTransaction({ ...newTransaction, amount: e.target.value })}
                    required
                    className="bg-muted/50 border-border"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Payment Status</label>
                  <select
                    value={newTransaction.status}
                    onChange={e => setNewTransaction({ ...newTransaction, status: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:outline-none"
                  >
                    <option value="successful">Successful (Paid)</option>
                    <option value="pending">Pending</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Payment Reference (Paystack, MOMO, etc.)</label>
                  <Input
                    placeholder="Optional transaction reference"
                    value={newTransaction.ref}
                    onChange={e => setNewTransaction({ ...newTransaction, ref: e.target.value })}
                    className="bg-muted/50 border-border"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Associated Booking Order # / ID</label>
                  <Input
                    placeholder="e.g., GREF-20260819-1234"
                    value={newTransaction.bookingOrderNumber}
                    onChange={e => setNewTransaction({ ...newTransaction, bookingOrderNumber: e.target.value })}
                    className="bg-muted/50 border-border font-mono text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button type="submit" className="bg-orange-600 hover:bg-orange-700 text-white font-bold h-10 px-8">
                  Record Entry
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Filter and Table Section with Status Tabs */}
      <Card className="bg-card border-border shadow-sm">
        <CardHeader className="pb-3 border-b border-border/40">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-3">
                <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Clock className="h-5 w-5 text-orange-600" /> Transaction Ledger
                </CardTitle>
                <span className="text-xs font-bold bg-muted px-2.5 py-1 rounded-full text-muted-foreground">
                  {filteredTransactions.length} {filteredTransactions.length === 1 ? 'record' : 'records'}
                </span>
              </div>
              
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search ledger or booking ID..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-9 h-9 text-xs bg-muted/30 border-border"
                  />
                </div>

                <select
                  value={filterType}
                  onChange={e => setFilterType(e.target.value as any)}
                  className="h-9 rounded-md border border-border bg-muted/40 px-2.5 text-xs text-foreground focus:outline-none"
                >
                  <option value="all">All Types</option>
                  <option value="credit">Credits only</option>
                  <option value="debit">Debits only</option>
                </select>

                <select
                  value={filterCategory}
                  onChange={e => setFilterCategory(e.target.value)}
                  className="h-9 rounded-md border border-border bg-muted/40 px-2.5 text-xs text-foreground focus:outline-none"
                >
                  <option value="all">All Categories</option>
                  {creditCategories.concat(debitCategories).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadCSV}
                  className="h-9 border-border hover:bg-muted text-foreground flex items-center gap-1.5 text-xs font-bold transition-all active:scale-95 shrink-0"
                >
                  <Download className="h-3.5 w-3.5 text-orange-600" /> Export CSV
                </Button>
              </div>
            </div>

            {/* Status Tabs Navigation */}
            <div className="flex items-center gap-1.5 overflow-x-auto border-t border-border/50 pt-3">
              <button
                onClick={() => setStatusTab('all')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  statusTab === 'all'
                    ? 'bg-foreground text-background shadow-xs'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <span>All Transactions</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${statusTab === 'all' ? 'bg-background/20 text-background' : 'bg-muted-foreground/15 text-muted-foreground'}`}>
                  {transactions.length}
                </span>
              </button>

              <button
                onClick={() => setStatusTab('successful')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  statusTab === 'successful'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <CheckCircle className="h-3.5 w-3.5" />
                <span>Successful Transactions</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${statusTab === 'successful' ? 'bg-white/20 text-white' : 'bg-emerald-500/10 text-emerald-600'}`}>
                  {successfulCount}
                </span>
              </button>

              <button
                onClick={() => setStatusTab('pending')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  statusTab === 'pending'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Clock className="h-3.5 w-3.5" />
                <span>Pending Transactions</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${statusTab === 'pending' ? 'bg-white/20 text-white' : 'bg-amber-500/10 text-amber-600'}`}>
                  {pendingCount}
                </span>
              </button>

              <button
                onClick={() => setStatusTab('bookings')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  statusTab === 'bookings'
                    ? 'bg-orange-600 text-white shadow-xs'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <CalendarIcon className="h-3.5 w-3.5" />
                <span>Booking Payments</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${statusTab === 'bookings' ? 'bg-white/20 text-white' : 'bg-orange-500/10 text-orange-600'}`}>
                  {bookingCount}
                </span>
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex py-12 justify-center items-center">
              <Loader2 className="h-6 w-6 animate-spin text-orange-600" />
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-xs">
              No transactions match your search/filter criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-muted/30 border-b border-border/60 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    <th className="p-4">Date</th>
                    <th className="p-4">Description & Customer</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Associated Booking</th>
                    <th className="p-4">Gateway / Channel</th>
                    <th className="p-4">Reference</th>
                    <th className="p-4 text-right">Amount</th>
                    <th className="p-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 text-xs text-foreground">
                  {filteredTransactions.map((t) => {
                    const displayDate = t.transactionDate 
                      ? format(new Date(t.transactionDate), 'MMM d, yyyy')
                      : t.createdAt?.seconds 
                        ? format(new Date(t.createdAt.seconds * 1000), 'MMM d, yyyy')
                        : 'Recent';

                    const isSuccess = t.status === 'successful' || t.status === 'success' || (!t.status && t.type === 'credit');
                    const isPending = t.status === 'pending' || t.status === 'processing';
                    const isFailed = t.status === 'failed' || t.status === 'abandoned';

                    const bookingRef = t.bookingOrderNumber || (t.bookingId ? `#${t.bookingId.slice(0, 8)}` : null);

                    return (
                      <tr key={t.id} className="hover:bg-muted/15 transition-colors">
                        <td className="p-4 whitespace-nowrap text-muted-foreground font-medium">{displayDate}</td>
                        <td className="p-4 min-w-[220px]">
                          <div className="font-semibold">{t.description}</div>
                          {t.customerName && (
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              Customer: <span className="font-medium text-foreground">{t.customerName}</span> {t.customerEmail && `(${t.customerEmail})`}
                            </div>
                          )}
                          {!t.customerName && t.recordedBy && (
                            <div className="text-[10px] text-muted-foreground mt-0.5">Recorded by: {t.recordedBy}</div>
                          )}
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          {isSuccess ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                              <CheckCircle className="h-3 w-3" /> Successful
                            </span>
                          ) : isPending ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                              <Clock className="h-3 w-3" /> Pending
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20">
                              <AlertCircle className="h-3 w-3" /> {t.status || 'Failed'}
                            </span>
                          )}
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          {bookingRef ? (
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-orange-500/10 text-orange-600 border border-orange-500/20">
                                {bookingRef}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-orange-600"
                                onClick={() => {
                                  navigator.clipboard.writeText(t.bookingOrderNumber || t.bookingId);
                                  toast.success(`Booking ID ${t.bookingOrderNumber || t.bookingId} copied!`);
                                }}
                                title="Copy Booking ID"
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-muted-foreground font-mono">None</span>
                          )}
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-[11px] uppercase tracking-wider">{t.gateway || 'Paystack'}</span>
                            {t.channel && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-muted text-muted-foreground font-mono">
                                {t.channel}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-4 whitespace-nowrap font-mono text-[10px] text-muted-foreground">
                          {t.ref ? (
                            <span className="truncate max-w-[120px] inline-block" title={t.ref}>
                              {t.ref}
                            </span>
                          ) : 'N/A'}
                        </td>
                        <td className={`p-4 text-right font-bold text-sm whitespace-nowrap ${
                          t.type === 'credit' ? 'text-emerald-600' : 'text-rose-600'
                        }`}>
                          {t.type === 'credit' ? '+' : '-'} GH‚Çµ {t.amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            {t.receiptData && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => setSelectedReceiptData(t)}
                                className="h-7 w-7 text-muted-foreground hover:text-emerald-600 rounded-full hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                                title="View Gateway Receipt"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => setDeleteId(t.id)}
                              className="h-7 w-7 text-muted-foreground hover:text-red-600 rounded-full hover:bg-red-50 dark:hover:bg-red-950/20"
                              title="Delete Entry"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Paystack Receipt Details Modal */}
      {selectedReceiptData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] animate-in fade-in">
          <div className="bg-card border border-border rounded-xl p-6 max-w-lg w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-600 text-white font-black flex items-center justify-center text-xs">P</div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Paystack Transaction Receipt</h3>
                  <p className="text-xs text-muted-foreground font-mono">{selectedReceiptData.ref}</p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setSelectedReceiptData(null)}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="bg-muted/40 p-4 rounded-xl space-y-2 text-xs font-mono">
              <div className="flex justify-between py-1 border-b border-border/40">
                <span className="text-muted-foreground">Amount Paid:</span>
                <span className="font-bold text-emerald-600 text-sm">GH‚Çµ {selectedReceiptData.amount?.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/40">
                <span className="text-muted-foreground">Status:</span>
                <span className="font-bold uppercase text-emerald-600">{selectedReceiptData.status || 'SUCCESSFUL'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/40">
                <span className="text-muted-foreground">Associated Booking:</span>
                <span className="font-bold text-orange-600">{selectedReceiptData.bookingOrderNumber || selectedReceiptData.bookingId || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/40">
                <span className="text-muted-foreground">Channel:</span>
                <span>{selectedReceiptData.channel || 'Mobile Money'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/40">
                <span className="text-muted-foreground">Customer:</span>
                <span>{selectedReceiptData.customerName || selectedReceiptData.recordedBy}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">Date:</span>
                <span>{selectedReceiptData.transactionDate || selectedReceiptData.createdAt ? new Date(selectedReceiptData.transactionDate || selectedReceiptData.createdAt).toLocaleString() : 'N/A'}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(selectedReceiptData, null, 2));
                  toast.success("Receipt JSON copied to clipboard!");
                }}
                className="text-xs font-semibold"
              >
                <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy Receipt JSON
              </Button>
              <Button 
                size="sm" 
                onClick={() => setSelectedReceiptData(null)}
                className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold px-5"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <AdminDeleteModal
          title="Delete Transaction"
          message="Are you sure you want to delete this transaction ledger entry? This action is completely permanent and cannot be undone."
          onConfirm={handleDeleteTransaction}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}

function ManageTeam() {
  const [members, setMembers] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageUploadProgress, setImageUploadProgress] = useState(0);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Bulk signature management states
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [isBulkSignatureModalOpen, setIsBulkSignatureModalOpen] = useState(false);
  const [bulkSignatureMode, setBulkSignatureMode] = useState<'upload' | 'text'>('text');
  const [bulkSignatureText, setBulkSignatureText] = useState('');
  const [bulkSignatureImage, setBulkSignatureImage] = useState('');
  const [isUploadingBulkSig, setIsUploadingBulkSig] = useState(false);

  const [newMember, setNewMember] = useState({
    name: '',
    role: '',
    experience: '',
    bio: '',
    imageUrl: '',
    email: '',
    rating: 4.9,
    category: 'consulting',
    skillsInput: '',
    available: true,
    highlightsInput: ''
  });

  const compressImage = (file: File, maxWidth = 800, maxHeight = 800, quality = 0.8): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Resize while protecting original aspect ratio
          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(file); // Fallback to raw file if context fails
            return;
          }

          // Draw the image onto the canvas
          ctx.drawImage(img, 0, 0, width, height);

          // Convert to blob with optimal compressed quality
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                resolve(file); // Fallback to original
              }
            },
            'image/jpeg',
            quality
          );
        };
        img.onerror = (err) => reject(err);
        img.src = event.target?.result as string;
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = async (file: File) => {
    if (!file) return;

    // Check file type
    if (!file.type.startsWith('image/')) {
      toast.error('Only image files (JPEG, PNG, WEBP, GIF) are allowed.');
      return;
    }

    // Larger original limit (25MB) now that we compress on-the-fly
    const MAX_ORIGINAL_SIZE = 25 * 1024 * 1024;
    if (file.size > MAX_ORIGINAL_SIZE) {
      toast.error('Image is too large. Maximum size allowed is 25MB.');
      return;
    }

    setIsUploadingImage(true);
    setImageUploadProgress(0);

    try {
      // Compress first on the client side
      toast.loading('Optimizing profile image format...', { id: 'img-compress' });
      const compressedBlob = await compressImage(file);
      toast.dismiss('img-compress');

      // Create storage reference
      const cleanFileName = file.name.replace(/\.[^/.]+$/, "") + ".jpg";
      const storageRef = ref(storage, `team_members/${Date.now()}_${cleanFileName}`);
      
      const uploadTask = uploadBytesResumable(storageRef, compressedBlob, {
        contentType: 'image/jpeg'
      });

      uploadTask.on('state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setImageUploadProgress(Math.round(progress));
        },
        async (error) => {
          console.warn('Team image upload to Firebase Storage failed, falling back to local base64 optimization:', error);
          try {
            toast.loading('Saving optimized photo inside profile...', { id: 'img-fallback' });
            // Rescale slightly smaller (max 400x400, quality 0.7) to guarantee highly optimized Base64
            const extraCompressedBlob = await compressImage(file, 400, 400, 0.7);
            const base64String = await blobToBase64(extraCompressedBlob);
            if (base64String) {
              setNewMember(prev => ({ ...prev, imageUrl: base64String }));
              toast.dismiss('img-fallback');
              toast.success('Optimized locally! Profile photo applied successfully.');
            } else {
              throw new Error('Failed to convert optimized image to base64');
            }
          } catch (fallbackError) {
            console.error('Local photo fallback failed:', fallbackError);
            toast.dismiss('img-fallback');
            toast.error('Team image upload failed & fallback failed.');
          } finally {
            setIsUploadingImage(false);
          }
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          setNewMember(prev => ({ ...prev, imageUrl: downloadURL }));
          setIsUploadingImage(false);
          toast.success('Optimized profile photo uploaded instantly!');
        }
      );
    } catch (error) {
      console.error('Team image upload setup/compression failed:', error);
      toast.dismiss('img-compress');
      toast.error('Could not optimize or upload profile photo.');
      setIsUploadingImage(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingImage(true);
  };

  const handleDragLeave = () => {
    setIsDraggingImage(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingImage(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
  };

  useEffect(() => {
    const q = query(collection(db, 'team_members'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMembers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'team_members');
    });
    return () => unsubscribe();
  }, []);

  const handleBulkGrantSignatureAccess = async () => {
    if (selectedMemberIds.length === 0) {
      toast.error('No team members selected.');
      return;
    }
    try {
      const selectedNames: string[] = [];
      await Promise.all(selectedMemberIds.map(async (id) => {
        const mDoc = doc(db, 'team_members', id);
        const mSnap = await getDoc(mDoc);
        if (mSnap.exists()) {
          selectedNames.push(mSnap.data().name || 'Specialist');
        }
        await updateDoc(mDoc, {
          hasSignatureAccess: true
        });
      }));

      // Log bulk grant in audit logs
      const currentUser = auth.currentUser;
      if (currentUser) {
        const uSnap = await getDoc(doc(db, 'users', currentUser.uid));
        const uData = uSnap.exists() ? uSnap.data() : {};
        const uName = uData.fullName || currentUser.displayName || currentUser.email || 'Administrator';
        const uRole = uData.role || 'admin';

        await addDoc(collection(db, 'activity_logs'), {
          userId: currentUser.uid,
          userEmail: currentUser.email,
          userName: uName,
          type: 'signature_change',
          description: `GRANTED official signature access in bulk to ${selectedNames.length} specialist(s) (${selectedNames.join(', ')}) by ${uName} (${uRole}).`,
          createdAt: new Date().toISOString()
        });
      }

      toast.success(`Successfully granted signature access to ${selectedMemberIds.length} specialist(s).`);
      setSelectedMemberIds([]);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `team_members (bulk grant)`);
    }
  };

  const handleBulkRevokeSignatureAccess = async () => {
    if (selectedMemberIds.length === 0) {
      toast.error('No team members selected.');
      return;
    }
    try {
      const selectedNames: string[] = [];
      await Promise.all(selectedMemberIds.map(async (id) => {
        const mDoc = doc(db, 'team_members', id);
        const mSnap = await getDoc(mDoc);
        if (mSnap.exists()) {
          selectedNames.push(mSnap.data().name || 'Specialist');
        }
        await updateDoc(mDoc, {
          hasSignatureAccess: false,
          signatureImageUrl: deleteField(),
          signatureImage: deleteField()
        });
      }));

      // Log bulk revoke in audit logs
      const currentUser = auth.currentUser;
      if (currentUser) {
        const uSnap = await getDoc(doc(db, 'users', currentUser.uid));
        const uData = uSnap.exists() ? uSnap.data() : {};
        const uName = uData.fullName || currentUser.displayName || currentUser.email || 'Administrator';
        const uRole = uData.role || 'admin';

        await addDoc(collection(db, 'activity_logs'), {
          userId: currentUser.uid,
          userEmail: currentUser.email,
          userName: uName,
          type: 'signature_change',
          description: `REVOKED signature access in bulk for ${selectedNames.length} specialist(s) (${selectedNames.join(', ')}) and cleared their signature files by ${uName} (${uRole}).`,
          createdAt: new Date().toISOString()
        });
      }

      toast.success(`Successfully revoked signature access for ${selectedMemberIds.length} specialist(s).`);
      setSelectedMemberIds([]);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `team_members (bulk revoke)`);
    }
  };

  const handleBulkReplaceSignatureSubmit = async () => {
    if (selectedMemberIds.length === 0) {
      toast.error('No team members selected.');
      return;
    }

    const valueToSet = bulkSignatureMode === 'text' ? bulkSignatureText : bulkSignatureImage;
    if (!valueToSet) {
      toast.error('Please provide a signature value (type name or upload image).');
      return;
    }

    try {
      const selectedNames: string[] = [];
      await Promise.all(selectedMemberIds.map(async (id) => {
        const mDoc = doc(db, 'team_members', id);
        const mSnap = await getDoc(mDoc);
        if (mSnap.exists()) {
          selectedNames.push(mSnap.data().name || 'Specialist');
        }
        await updateDoc(mDoc, {
          hasSignatureAccess: true,
          signatureImageUrl: valueToSet
        });
      }));

      // Log bulk replace in audit logs
      const currentUser = auth.currentUser;
      if (currentUser) {
        const uSnap = await getDoc(doc(db, 'users', currentUser.uid));
        const uData = uSnap.exists() ? uSnap.data() : {};
        const uName = uData.fullName || currentUser.displayName || currentUser.email || 'Administrator';
        const uRole = uData.role || 'admin';

        await addDoc(collection(db, 'activity_logs'), {
          userId: currentUser.uid,
          userEmail: currentUser.email,
          userName: uName,
          type: 'signature_change',
          description: `REPLACED/UPDATED signature image credentials in bulk for ${selectedNames.length} specialist(s) (${selectedNames.join(', ')}) using a unified ${bulkSignatureMode} signature template by ${uName} (${uRole}).`,
          createdAt: new Date().toISOString()
        });
      }

      toast.success(`Successfully replaced signature for ${selectedMemberIds.length} specialist(s).`);
      setIsBulkSignatureModalOpen(false);
      setBulkSignatureText('');
      setBulkSignatureImage('');
      setSelectedMemberIds([]);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `team_members (bulk replace)`);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Split skills by commas and trim them
      const skills = newMember.skillsInput
        ? newMember.skillsInput.split(',').map(s => s.trim()).filter(Boolean)
        : [];

      // Split project highlights by newline
      const projectHighlights = newMember.highlightsInput
        ? newMember.highlightsInput.split('\n').map(h => h.trim()).filter(Boolean)
        : [];

      // Default high quality standard stock images as fallback representation
      const defaultImages = [
        "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=400&h=400",
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=400&h=400",
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400&h=400"
      ];
      const imageUrl = newMember.imageUrl.trim() || defaultImages[Math.floor(Math.random() * defaultImages.length)];

      await addDoc(collection(db, 'team_members'), {
        name: newMember.name,
        role: newMember.role,
        experience: newMember.experience,
        bio: newMember.bio,
        imageUrl,
        email: newMember.email.trim(),
        rating: Number(newMember.rating) || 4.9,
        category: newMember.category,
        skills,
        available: newMember.available,
        projectHighlights,
        createdAt: serverTimestamp()
      });

      toast.success('Specialist profile added successfully!');
      setIsAdding(false);
      setNewMember({
        name: '',
        role: '',
        experience: '',
        bio: '',
        imageUrl: '',
        email: '',
        rating: 4.9,
        category: 'consulting',
        skillsInput: '',
        available: true,
        highlightsInput: ''
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'team_members');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    try {
      const skills = newMember.skillsInput
        ? newMember.skillsInput.split(',').map(s => s.trim()).filter(Boolean)
        : [];

      const projectHighlights = newMember.highlightsInput
        ? newMember.highlightsInput.split('\n').map(h => h.trim()).filter(Boolean)
        : [];

      const defaultImages = [
        "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=400&h=400",
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=400&h=400",
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400&h=400"
      ];
      const imageUrl = newMember.imageUrl.trim() || defaultImages[Math.floor(Math.random() * defaultImages.length)];

      await updateDoc(doc(db, 'team_members', editingId), {
        name: newMember.name,
        role: newMember.role,
        experience: newMember.experience,
        bio: newMember.bio,
        imageUrl,
        email: newMember.email.trim(),
        rating: Number(newMember.rating) || 4.9,
        category: newMember.category,
        skills,
        available: newMember.available,
        projectHighlights,
        updatedAt: serverTimestamp()
      });

      toast.success('Specialist profile updated successfully!');
      setEditingId(null);
      setIsAdding(false);
      setNewMember({
        name: '',
        role: '',
        experience: '',
        bio: '',
        imageUrl: '',
        email: '',
        rating: 4.9,
        category: 'consulting',
        skillsInput: '',
        available: true,
        highlightsInput: ''
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `team_members/${editingId}`);
    }
  };

  const startEdit = (member: any) => {
    setEditingId(member.id);
    setNewMember({
      name: member.name || '',
      role: member.role || '',
      experience: member.experience || '',
      bio: member.bio || '',
      imageUrl: member.imageUrl || '',
      email: member.email || '',
      rating: member.rating || 4.9,
      category: member.category || 'consulting',
      skillsInput: member.skills ? member.skills.join(', ') : '',
      available: member.available !== false,
      highlightsInput: member.projectHighlights ? member.projectHighlights.join('\n') : ''
    });
    setIsAdding(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (id: string) => {
    setDeleteId(id);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteDoc(doc(db, 'team_members', deleteId));
      toast.success('Specialist profile deleted');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `team_members/${deleteId}`);
    } finally {
      setDeleteId(null);
    }
  };

  const toggleAvailability = async (id: string, currentStatus: boolean) => {
    try {
      const nextStatus = currentStatus === false ? false : true;
      await updateDoc(doc(db, 'team_members', id), {
        available: !nextStatus
      });
      toast.success('Specialist availability status updated!');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `team_members/${id}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Manage Team</h1>
          <p className="text-sm text-muted-foreground mt-1">Add or update team specialists, consultants, and event show hosts.</p>
        </div>
        <Button onClick={() => {
          if (editingId) {
            setEditingId(null);
            setNewMember({
              name: '',
              role: '',
              experience: '',
              bio: '',
              imageUrl: '',
              email: '',
              rating: 4.9,
              category: 'consulting',
              skillsInput: '',
              available: true,
              highlightsInput: ''
            });
            setIsAdding(false);
          } else {
            setIsAdding(!isAdding);
          }
        }} className="bg-orange-600 hover:bg-orange-700 text-white">
          {editingId ? 'Cancel Edit' : (isAdding ? 'Cancel' : <><Plus className="mr-2 h-4 w-4" /> Add Specialist</>)}
        </Button>
      </div>

      {(isAdding || editingId) && (
        <Card className="border border-border">
          <CardHeader>
            <CardTitle>{editingId ? 'Edit Specialist Profile' : 'Add New Specialist'}</CardTitle>
            <CardDescription>{editingId ? 'Modify the profile details of this consultant or host.' : 'Fill out the profile details of the new consultant or host.'}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={editingId ? handleUpdate : handleAdd} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Full Name *</label>
                  <Input
                    required
                    value={newMember.name}
                    onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                    placeholder="E.g., Dr. Linda Serwaah"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Role / Title *</label>
                  <Input
                    required
                    value={newMember.role}
                    onChange={(e) => setNewMember({ ...newMember, role: e.target.value })}
                    placeholder="E.g., Head of Business consulting"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Experience Description *</label>
                  <Input
                    required
                    value={newMember.experience}
                    onChange={(e) => setNewMember({ ...newMember, experience: e.target.value })}
                    placeholder="E.g., 12+ Years in Corporate Consulting"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Expertise Category *</label>
                  <select
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-orange-600"
                    value={newMember.category}
                    onChange={(e) => setNewMember({ ...newMember, category: e.target.value })}
                  >
                    <option value="consulting">Business Consulting</option>
                    <option value="entertainment">Entertainment Production</option>
                    <option value="both">Both (Consult & Event)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Direct Email Address *</label>
                  <Input
                    required
                    type="email"
                    value={newMember.email}
                    onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                    placeholder="E.g., specialist@grefas.com"
                  />
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">Direct message notifications from the chosen specialist's modal will be routed right to this address.</p>
                </div>
              </div>

              <div className="space-y-4 border border-zinc-250 dark:border-zinc-800 p-4 rounded-lg bg-zinc-50/50 dark:bg-zinc-900/10">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                    <Camera className="h-4 w-4 text-orange-600" /> Professional Profile Photo
                  </label>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                    {/* Drag and Drop with manual click */}
                    <div 
                      className={`md:col-span-2 border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all duration-200 ${
                        isDraggingImage 
                          ? 'border-orange-500 bg-orange-500/5' 
                          : 'border-border hover:border-orange-500/50 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/10'
                      } flex flex-col items-center justify-center min-h-[140px]`}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => {
                        const fileInput = document.getElementById('team-image-device-upload') as HTMLInputElement;
                        if (fileInput) fileInput.click();
                      }}
                    >
                      <input 
                        type="file" 
                        id="team-image-device-upload" 
                        className="hidden" 
                        accept="image/*,.heic,.heif,.avif,.tiff,.bmp"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleImageUpload(file);
                        }}
                      />
                      
                      {isUploadingImage ? (
                        <div className="space-y-3 w-full max-w-[240px] text-center">
                          <Loader2 className="h-8 w-8 animate-spin text-orange-600 mx-auto" />
                          <p className="text-xs text-muted-foreground font-medium">Uploading to secure cloud storage... {imageUploadProgress}%</p>
                          <div className="w-full bg-border rounded-full h-2 overflow-hidden">
                            <div 
                              className="bg-orange-600 h-2 rounded-full transition-all duration-300" 
                              style={{ width: `${imageUploadProgress}%` }}
                            ></div>
                          </div>
                        </div>
                      ) : newMember.imageUrl ? (
                        <div className="flex items-center space-x-4 text-left w-full h-full">
                          <div className="relative h-20 w-20 flex-shrink-0 rounded-lg overflow-hidden border border-border bg-muted">
                            <img 
                              src={newMember.imageUrl} 
                              alt="Team Specialist Preview" 
                              className="h-full w-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground">Selected Specialist Image</p>
                            <p className="text-xs text-muted-foreground truncate max-w-[200px] mb-2">{newMember.imageUrl}</p>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setNewMember(prev => ({ ...prev, imageUrl: '' }));
                              }}
                              className="text-xs text-red-600 hover:text-red-700 font-semibold flex items-center gap-1 hover:underline"
                            >
                              <Trash2 className="h-3 w-3" /> Remove & Clear
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2 py-2">
                          <Camera className="h-8 w-8 text-zinc-400 mx-auto" />
                          <p className="text-sm font-medium text-foreground">Drag & drop profile picture, or click to browse</p>
                          <p className="text-xs text-muted-foreground font-medium">Supports HEIC, AVIF, JPEG, PNG, WEBP, BMP (Max 25MB)</p>
                        </div>
                      )}
                    </div>

                    {/* Manual Image URL field */}
                    <div className="space-y-2 h-full flex flex-col justify-center">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Or Manual Image URL</label>
                      <Input
                        value={newMember.imageUrl}
                        onChange={(e) => setNewMember({ ...newMember, imageUrl: e.target.value })}
                        placeholder="Paste premium image web URL"
                        className="text-xs bg-background"
                      />
                      <p className="text-[11px] text-muted-foreground italic leading-tight mt-1">Paste direct link or upload image from device.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Skills / Expertise (Comma Separated)</label>
                <Input
                  value={newMember.skillsInput}
                  onChange={(e) => setNewMember({ ...newMember, skillsInput: e.target.value })}
                  placeholder="E.g., Brand Audits, Sound Design, MC, Sales Strategy"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Initial Booking Availability *</label>
                  <select
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-orange-600"
                    value={newMember.available ? 'yes' : 'no'}
                    onChange={(e) => setNewMember({ ...newMember, available: e.target.value === 'yes' })}
                  >
                    <option value="yes">Yes (Accepting Bookings)</option>
                    <option value="no">No (Fully Booked)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Rating (Optional, Default: 4.9)</label>
                  <Input
                    type="number"
                    step="0.1"
                    min="1"
                    max="5"
                    value={newMember.rating}
                    onChange={(e) => setNewMember({ ...newMember, rating: parseFloat(e.target.value) || 4.9 })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground text-orange-600 font-semibold mb-0">Project Highlights (one highlight per line) *</label>
                <Textarea
                  value={newMember.highlightsInput}
                  onChange={(e) => setNewMember({ ...newMember, highlightsInput: e.target.value })}
                  placeholder="Enter historical client successes or operational feats, one line at a time..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Detailed Bio *</label>
                <Textarea
                  required
                  value={newMember.bio}
                  onChange={(e) => setNewMember({ ...newMember, bio: e.target.value })}
                  placeholder="Tell us about their background, achievements and passion..."
                  rows={4}
                />
              </div>

              <Button type="submit" className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold">
                {editingId ? 'Update Specialist Profile' : 'Save Specialist Profile'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="border border-border">
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <CardTitle>Specialists List</CardTitle>
            <CardDescription>View, manage and delete registered team specialists.</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {members.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (selectedMemberIds.length === members.length) {
                    setSelectedMemberIds([]);
                  } else {
                    setSelectedMemberIds(members.map(m => m.id));
                  }
                }}
                className="text-xs font-semibold h-8 border-border text-foreground hover:bg-muted"
              >
                {selectedMemberIds.length === members.length ? 'Deselect All' : 'Select All'}
              </Button>
            )}
          </div>
        </CardHeader>

        {selectedMemberIds.length > 0 && (
          <div className="bg-orange-600/10 border-y border-orange-600/20 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-orange-600 text-white text-xs font-black">
                {selectedMemberIds.length}
              </span>
              <p className="text-sm font-semibold text-orange-800 dark:text-orange-300">
                Specialist(s) selected for bulk signature actions
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                onClick={handleBulkGrantSignatureAccess}
                className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold flex items-center gap-1 h-8"
              >
                <ShieldCheck className="h-3.5 w-3.5" /> Grant Access
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setBulkSignatureMode('text');
                  setBulkSignatureText('');
                  setBulkSignatureImage('');
                  setIsBulkSignatureModalOpen(true);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1 h-8"
              >
                <Edit className="h-3.5 w-3.5" /> Replace Signature
              </Button>
              <Button
                size="sm"
                onClick={handleBulkRevokeSignatureAccess}
                className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1 h-8"
              >
                <AlertCircle className="h-3.5 w-3.5" /> Revoke Access
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedMemberIds([])}
                className="text-muted-foreground hover:text-foreground text-xs font-semibold h-8"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {members.map((member) => {
              const userAvailable = member.available !== false;
              const isChecked = selectedMemberIds.includes(member.id);
              return (
                <div key={member.id} className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4 transition-colors ${isChecked ? 'bg-orange-600/5' : ''}`}>
                  <div className="flex items-center space-x-4">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedMemberIds(prev => [...prev, member.id]);
                        } else {
                          setSelectedMemberIds(prev => prev.filter(id => id !== member.id));
                        }
                      }}
                      className="rounded border-border text-orange-600 focus:ring-orange-600 h-4 w-4 cursor-pointer"
                    />
                    <img
                      src={member.imageUrl}
                      alt={member.name}
                      referrerPolicy="no-referrer"
                      className="h-12 w-12 rounded-full object-cover border border-border"
                    />
                    <div>
                      <p className="font-bold text-foreground flex flex-wrap items-center gap-2">
                        {member.name}
                        <span className="text-[10px] px-2 py-0.5 rounded bg-orange-100 dark:bg-orange-950/40 text-orange-800 dark:text-orange-300 uppercase font-black tracking-wider">
                          {member.category}
                        </span>
                        {member.hasSignatureAccess && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-100 dark:bg-green-950/50 text-green-700 dark:text-green-300 font-bold border border-green-200 dark:border-green-900/35 flex items-center gap-1">
                            <ShieldCheck className="h-3 w-3" /> Signatory
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-orange-600 font-semibold">{member.role}</p>
                      {member.email && (
                        <p className="text-[11px] text-muted-foreground font-medium flex items-center gap-1 mt-0.5">
                          <span className="font-semibold text-foreground/85">Email:</span> {member.email}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground truncate max-w-sm mt-0.5">{member.bio}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 self-end sm:self-center">
                    {/* Quick Availability Switch Badge */}
                    <Button 
                      onClick={() => toggleAvailability(member.id, userAvailable)}
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      className={`text-xs h-8 px-3 rounded-lg font-bold flex items-center gap-1.5 border ${
                        userAvailable 
                          ? 'border-green-200 bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-300 dark:border-green-900/40' 
                          : 'border-zinc-200 bg-zinc-50 text-zinc-650 dark:bg-zinc-900/20 dark:text-zinc-400 dark:border-zinc-800/45'
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${userAvailable ? 'bg-green-500 animate-pulse' : 'bg-zinc-400'}`} />
                      {userAvailable ? 'Accepting bookings' : 'Fully booked'}
                    </Button>

                    <Button variant="ghost" size="sm" onClick={() => startEdit(member)} className="text-zinc-650 hover:bg-zinc-50 dark:hover:bg-zinc-900/10 hover:text-zinc-800 dark:text-zinc-400">
                      <Edit className="h-4 w-4" />
                    </Button>

                    <Button variant="ghost" size="sm" onClick={() => handleDelete(member.id)} className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 hover:text-red-700">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
            {members.length === 0 && <p className="p-8 text-center text-muted-foreground">No specialists found.</p>}
          </div>
        </CardContent>
      </Card>

      {deleteId && (
        <AdminDeleteModal
          title="Delete Specialist"
          message="Are you sure you want to delete this specialist profile? This action is completely permanent and cannot be undone."
          onConfirm={confirmDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}

      {isBulkSignatureModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-2xl p-6 relative">
            <button 
              onClick={() => setIsBulkSignatureModalOpen(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground cursor-pointer bg-transparent border-0"
            >
              <X className="h-5 w-5" />
            </button>
            
            <h2 className="text-xl font-bold text-foreground mb-1">Replace Signature Access</h2>
            <p className="text-xs text-muted-foreground mb-4">
              Apply a unified signature format or image to all {selectedMemberIds.length} selected specialist(s).
            </p>

            <div className="flex gap-2 p-1 bg-muted rounded-lg border border-border mb-4">
              <Button
                variant={bulkSignatureMode === 'text' ? 'default' : 'outline'}
                onClick={() => setBulkSignatureMode('text')}
                className={`flex-1 text-xs font-bold cursor-pointer h-8 ${bulkSignatureMode === 'text' ? 'bg-orange-600 text-white' : 'text-muted-foreground'}`}
              >
                Type Signature
              </Button>
              <Button
                variant={bulkSignatureMode === 'upload' ? 'default' : 'outline'}
                onClick={() => setBulkSignatureMode('upload')}
                className={`flex-1 text-xs font-bold cursor-pointer h-8 ${bulkSignatureMode === 'upload' ? 'bg-orange-600 text-white' : 'text-muted-foreground'}`}
              >
                Upload Signature Image
              </Button>
            </div>

            {bulkSignatureMode === 'text' ? (
              <div className="space-y-3">
                <label className="text-xs font-bold text-foreground">Typed Signature Name</label>
                <Input
                  placeholder="e.g. Grice Asante, CEO"
                  value={bulkSignatureText}
                  onChange={(e) => setBulkSignatureText(e.target.value)}
                  className="bg-muted/40 border-border text-foreground text-sm focus-visible:ring-orange-600 focus-visible:border-orange-600"
                />
                <p className="text-[10px] text-muted-foreground">
                  This text name will act as their official digital authorization signature on receipts and documents.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <label className="text-xs font-bold text-foreground">Signature Image File</label>
                {bulkSignatureImage ? (
                  <div className="relative border border-dashed rounded-lg p-4 bg-muted/20 flex flex-col items-center">
                    <img 
                      src={bulkSignatureImage} 
                      alt="Bulk Signature" 
                      className="max-h-20 object-contain mb-2" 
                      referrerPolicy="no-referrer"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setBulkSignatureImage('')}
                      className="text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 font-bold"
                    >
                      Remove File
                    </Button>
                  </div>
                ) : (
                  <div 
                    className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:bg-muted/10 transition-colors"
                    onClick={() => {
                      const fileInput = document.createElement('input');
                      fileInput.type = 'file';
                      fileInput.accept = 'image/*';
                      fileInput.onchange = async (e: any) => {
                        const file = e.target?.files?.[0];
                        if (file) {
                          if (!file.type.startsWith('image/')) {
                            toast.error('Please select an image file.');
                            return;
                          }
                          try {
                            const compressed = await compressImage(file, 600, 300, 0.7);
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setBulkSignatureImage(reader.result as string);
                            };
                            reader.readAsDataURL(compressed);
                          } catch (err) {
                            console.error(err);
                            toast.error('Failed to compress signature.');
                          }
                        }
                      };
                      fileInput.click();
                    }}
                  >
                    <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-xs font-bold text-foreground">Click to upload signature image</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Accepts PNG, JPG (Transparent recommended)</p>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => setIsBulkSignatureModalOpen(false)}
                className="text-xs font-semibold h-9 border-border text-foreground hover:bg-muted"
              >
                Cancel
              </Button>
              <Button
                onClick={handleBulkReplaceSignatureSubmit}
                className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold h-9 px-4"
              >
                Apply to {selectedMemberIds.length} Specialist(s)
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ManageGallery() {
  const getYoutubeId = (urlStr: string) => {
    if (!urlStr) return null;
    const cleanUrl = urlStr.trim();
    const shortsMatch = cleanUrl.match(/(?:youtube\.com|youtu\.be)\/shorts\/([a-zA-Z0-9_-]{11})/);
    if (shortsMatch && shortsMatch[1]) return shortsMatch[1];
    const liveMatch = cleanUrl.match(/(?:youtube\.com|youtu\.be)\/live\/([a-zA-Z0-9_-]{11})/);
    if (liveMatch && liveMatch[1]) return liveMatch[1];
    const regExp = /^.*(?:youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = cleanUrl.match(regExp);
    if (match && match[1] && match[1].length === 11) return match[1];
    try {
      const urlObj = new URL(cleanUrl.startsWith('http') ? cleanUrl : `https://${cleanUrl}`);
      const vParam = urlObj.searchParams.get('v');
      if (vParam && vParam.length === 11) return vParam;
    } catch (e) {}
    return null;
  };

  const [items, setItems] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState({ type: 'image', url: '', title: '', category: 'events', thumbnail: '' });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationPrompt, setGenerationPrompt] = useState('');
  const [uploadMode, setUploadMode] = useState<'upload' | 'ai'>('upload');
  const [deleteData, setDeleteData] = useState<{ id: string; url?: string; thumbnailUrl?: string } | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'gallery'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'gallery');
    });
    return () => unsubscribe();
  }, []);

  const handleGenerateImage = async () => {
    if (!generationPrompt.trim()) {
      toast.error('Please enter a prompt');
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch('/api/gallery/generate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompt: generationPrompt })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Server returned ${response.status}`);
      }

      const data = await response.json();
      if (data.success && data.url) {
        setNewItem({ ...newItem, url: data.url, title: generationPrompt });
        toast.success('Image generated successfully!');
      } else {
        toast.error(data.error || 'Failed to generate image. Please try a different prompt.');
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Error generating image');
    } finally {
      setIsGenerating(false);
    }
  };

  const generateVideoThumbnail = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      video.src = URL.createObjectURL(file);
      
      const timeoutId = setTimeout(() => {
        console.warn('Video thumbnail generation timed out (5s limit reached). Using background cover placeholder.');
        try {
          URL.revokeObjectURL(video.src);
        } catch (e) {}
        resolve('');
      }, 5000);

      video.onloadedmetadata = () => {
        video.currentTime = Math.min(1, video.duration > 0 ? video.duration / 2 : 1);
      };

      video.onseeked = () => {
        clearTimeout(timeoutId);
        try {
          const canvas = document.createElement('canvas');
          
          // Downscale the extracted frame to a lightweight thumbnail sizing block (e.g. 400px width max)
          const MAX_THUMB_WIDTH = 400;
          let width = video.videoWidth || 640;
          let height = video.videoHeight || 360;
          if (width > MAX_THUMB_WIDTH) {
            height = Math.round((height * MAX_THUMB_WIDTH) / width);
            width = MAX_THUMB_WIDTH;
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            // Compress heavily for safety, which is perfectly fine for thumbnails but saves massively on bytes
            const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.5);
            URL.revokeObjectURL(video.src);
            resolve(thumbnailUrl);
          } else {
            URL.revokeObjectURL(video.src);
            resolve('');
          }
        } catch (err) {
          console.warn('Canvas frame extraction failed:', err);
          try {
            URL.revokeObjectURL(video.src);
          } catch (e) {}
          resolve('');
        }
      };

      video.onerror = () => {
        clearTimeout(timeoutId);
        console.warn('Video element errored during thumbnail extraction.');
        try {
          URL.revokeObjectURL(video.src);
        } catch (e) {}
        resolve('');
      };
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (Increase from 35MB to 100MB as requested for all formats)
    const MAX_SIZE = 100 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      toast.error('File is too large. Maximum size allowed is 100MB.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      let finalFile: Blob | File = file;

      // Clean special characters from file name
      const cleanFileName = file.name.replace(/\s+/g, "_");

      // Verify if it's an image format (including custom formats)
      const isImage = file.type.startsWith('image/') || /\.(heic|heif|avif|webp|png|jpe?g|gif|bmp|tiff)$/i.test(file.name);
      
      if (isImage) {
        toast.loading('Optimizing image format & dimensions for fast load...', { id: 'gallery-compress' });
        try {
          finalFile = await compressImage(file, 1200, 1200, 0.75);
          toast.success('Image optimized successfully for instant viewing!', { id: 'gallery-compress' });
        } catch (compressionErr) {
          console.warn('Image optimization skipped, uploading raw file:', compressionErr);
          toast.dismiss('gallery-compress');
        }
      }

      // If it's a video, try to generate a thumbnail
      const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|avi|mkv|webm|flv|3gp|wmv|m4v)$/i.test(file.name);
      if (isVideo) {
        try {
          const thumbnailDataUrl = await generateVideoThumbnail(file);
          if (thumbnailDataUrl) {
            // Upload thumbnail first
            const thumbRef = ref(storage, `gallery/thumbnails/${Date.now()}_thumb.jpg`);
            // Convert dataURL to blob
            const response = await fetch(thumbnailDataUrl);
            const blob = await response.blob();
            
            try {
              await uploadBytesResumable(thumbRef, blob, { contentType: 'image/jpeg' });
              const thumbUrl = await getDownloadURL(thumbRef);
              setNewItem(prev => ({ ...prev, type: 'video', thumbnail: thumbUrl }));
            } catch (storageErr) {
              console.warn('Thumbnail storage upload failed, falling back to local base64 thumbnail:', storageErr);
              setNewItem(prev => ({ ...prev, type: 'video', thumbnail: thumbnailDataUrl }));
            }
          } else {
            console.warn('No custom video thumbnail could be extracted. Setting video type without thumbnail.');
            setNewItem(prev => ({ ...prev, type: 'video' }));
          }
        } catch (error) {
          console.warn('Failed to generate thumbnail, you may need to provide one manually:', error);
          setNewItem(prev => ({ ...prev, type: 'video' }));
        }
      } else {
        setNewItem(prev => ({ ...prev, type: 'image' }));
      }

      // If it's a video, attempt our cloud H.264/MP4 transcoding pipeline first!
      if (isVideo) {
        toast.loading('Running video transcoding pipeline...', { id: 'transcode-upload' });
        try {
          const formData = new FormData();
          formData.append("video", file);

          const response = await fetch("/api/upload-gallery-video", {
            method: "POST",
            body: formData,
          });

          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              setNewItem(prev => ({
                ...prev,
                type: 'video',
                url: data.url,
                thumbnail: data.thumbnail || prev.thumbnail,
              }));
              toast.dismiss('transcode-upload');
              toast.success('H.264 MP4 Transcoded video deployed successfully!');
              setIsUploading(false);
              return; // Complete upload pipeline successfully!
            }
          } else {
            const errData = await response.json().catch(() => ({}));
            if (errData.error === "transcoding_missing_credentials") {
              toast.dismiss('transcode-upload');
              toast.info('Cloudinary transcoding not active. Uploading raw file instead.');
            } else {
              throw new Error(errData.message || 'Transcoding server error');
            }
          }
        } catch (transcodeErr) {
          console.warn('Cloud transcoding pipeline skipped or failed:', transcodeErr);
          toast.dismiss('transcode-upload');
        }
      }

      // Upload main file to Firebase Storage with correct contentType (Dynamic/Fallback path)
      const storageRef = ref(storage, `gallery/${Date.now()}_${cleanFileName}`);
      let fileMime = finalFile.type || file.type || (isVideo ? 'video/mp4' : 'image/jpeg');
      if (isVideo) {
        fileMime = 'video/mp4';
      }
      const uploadTask = uploadBytesResumable(storageRef, finalFile, { contentType: fileMime });

      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(Math.round(progress));
        }, 
        async (error) => {
          console.warn('Upload to Firebase Storage failed, trying local Base64 optimized fallback:', error);
          const isImg = file.type.startsWith('image/') || /\.(heic|heif|avif|webp|png|jpe?g|gif|bmp|tiff)$/i.test(file.name);
          if (isImg) {
            try {
              toast.loading('Applying robust local layout fallback...', { id: 'gallery-fallback' });
              // Compress to 800x800, quality 0.65 so that it is super small (< 50KB) and saves perfectly in Firestore
              const extraCompressed = await compressImage(file, 800, 800, 0.65);
              const base64Url = await blobToBase64(extraCompressed);
              if (base64Url) {
                setNewItem(prev => ({ ...prev, type: 'image', url: base64Url }));
                toast.dismiss('gallery-fallback');
                toast.success('Media optimized & attached locally successfully!');
              } else {
                throw new Error('Base64 conversion resulted in empty string');
              }
            } catch (fallbackError) {
              console.error('Local fallback failed:', fallbackError);
              toast.dismiss('gallery-fallback');
              toast.error('Upload failed. Please try again.');
            }
          } else {
            toast.error('Upload failed: ' + error.message);
          }
          setIsUploading(false);
        }, 
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          setNewItem(prev => ({ ...prev, url: downloadURL }));
          setIsUploading(false);
          toast.success('Media file uploaded successfully');
        }
      );
    } catch (error) {
      console.error('Upload setup failed:', error);
      toast.error('Could not start upload');
      setIsUploading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let urlToSave = newItem.url;
      let thumbnailToSave = newItem.thumbnail || '';

      // Helper function to compress base64 image on demand to prevent storage errors
      const compressBase64OnDemand = (base64Str: string, maxWidth = 800, maxHeight = 800, quality = 0.6): Promise<string> => {
        return new Promise((resolve) => {
          if (!base64Str.startsWith('data:image/')) {
            resolve(base64Str);
            return;
          }
          const img = new Image();
          img.onload = () => {
            try {
              const canvas = document.createElement("canvas");
              let width = img.width;
              let height = img.height;
              if (width > height) {
                if (width > maxWidth) {
                  height = Math.round((height * maxWidth) / width);
                  width = maxWidth;
                }
              } else {
                if (height > maxHeight) {
                  width = Math.round((width * maxHeight) / height);
                  height = maxHeight;
                }
              }
              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext("2d");
              if (!ctx) {
                resolve(base64Str);
                return;
              }
              ctx.fillStyle = "#FFFFFF";
              ctx.fillRect(0, 0, width, height);
              ctx.drawImage(img, 0, 0, width, height);
              resolve(canvas.toDataURL("image/jpeg", quality));
            } catch (err) {
              resolve(base64Str);
            }
          };
          img.onerror = () => resolve(base64Str);
          img.src = base64Str;
        });
      };

      // 1. If URL is a large base64 image, compress it down
      if (urlToSave.startsWith('data:image/') && urlToSave.length > 500000) {
        toast.info("Scaling down large attachment to fit within secure database limits...");
        urlToSave = await compressBase64OnDemand(urlToSave, 720, 720, 0.55);
      }

      // 2. If thumbnail is a large base64 image, compress it down
      if (thumbnailToSave.startsWith('data:image/') && thumbnailToSave.length > 250000) {
        thumbnailToSave = await compressBase64OnDemand(thumbnailToSave, 320, 240, 0.4);
      }

      // 3. String length size check (max doc size in Firestore is 1,048,576 bytes)
      const totalEstimatedBytes = urlToSave.length + thumbnailToSave.length;
      if (totalEstimatedBytes > 950000) {
        toast.error("The selected file is too large to fit in the database's offline fallback. Please try uploading with a smaller file size (< 700KB) or double check your internet connection.");
        return;
      }

      await addDoc(collection(db, 'gallery'), {
        ...newItem,
        url: urlToSave,
        thumbnail: thumbnailToSave,
        createdAt: serverTimestamp(),
        likes: [],
        comments: []
      });
      toast.success('Media added');
      setIsAdding(false);
      setNewItem({ type: 'image', url: '', title: '', category: 'events', thumbnail: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'gallery');
    }
  };

  const handleDelete = (id: string, url?: string, thumbnailUrl?: string) => {
    setDeleteData({ id, url, thumbnailUrl });
  };

  const confirmDelete = async () => {
    if (!deleteData) return;
    const { id, url, thumbnailUrl } = deleteData;
    try {
      await deleteDoc(doc(db, 'gallery', id));
      
      // Also delete from storage if it's a storage URL
      if (url && url.includes('firebasestorage.googleapis.com')) {
        try {
          const storageRef = ref(storage, url);
          await deleteObject(storageRef);
        } catch (e) {
          console.warn("Could not delete main file from storage:", e);
        }
      }
      
      if (thumbnailUrl && thumbnailUrl.includes('firebasestorage.googleapis.com')) {
        try {
          const thumbRef = ref(storage, thumbnailUrl);
          await deleteObject(thumbRef);
        } catch (e) {
          console.warn("Could not delete thumbnail from storage:", e);
        }
      }
      
      toast.success('Item deleted');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `gallery/${id}`);
    } finally {
      setDeleteData(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Manage Gallery</h1>
        <Button onClick={() => setIsAdding(!isAdding)} className="bg-orange-600 hover:bg-orange-700 text-white">
          {isAdding ? 'Cancel' : <><Plus className="mr-2 h-4 w-4" /> Add Media</>}
        </Button>
      </div>

      {isAdding && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Add New Media</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-6 flex gap-2 border-b border-border pb-4">
              <Button 
                type="button"
                variant={uploadMode === 'upload' ? 'default' : 'ghost'}
                onClick={() => setUploadMode('upload')}
                className={uploadMode === 'upload' ? "bg-orange-600" : ""}
              >
                Upload / URL
              </Button>
              <Button 
                type="button"
                variant={uploadMode === 'ai' ? 'default' : 'ghost'}
                onClick={() => setUploadMode('ai')}
                className={uploadMode === 'ai' ? "bg-orange-600" : ""}
              >
                AI Generation
              </Button>
            </div>

            <form onSubmit={handleAdd} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <select 
                  className="flex h-10 w-full rounded-md border border-input bg-muted/50 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 text-foreground"
                  value={newItem.type}
                  onChange={e => setNewItem({...newItem, type: e.target.value})}
                  disabled={uploadMode === 'ai'}
                >
                  <option value="image">Image</option>
                  <option value="video">Video</option>
                </select>
                <select 
                  className="flex h-10 w-full rounded-md border border-input bg-muted/50 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 text-foreground"
                  value={newItem.category}
                  onChange={e => setNewItem({...newItem, category: e.target.value})}
                >
                  <option value="events">Events</option>
                  <option value="entertainment">Entertainment</option>
                  <option value="consulting">Consulting</option>
                </select>
              </div>

              {uploadMode === 'ai' ? (
                <div className="space-y-4 rounded-xl border border-dashed border-border p-6 bg-muted/20">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold">Describe the image you want</label>
                    <Textarea 
                      placeholder="e.g., A professional corporate event with people networking, golden hour lighting, cinematic style" 
                      value={generationPrompt} 
                      onChange={e => setGenerationPrompt(e.target.value)}
                      className="bg-muted/50 border-border min-h-[100px]"
                    />
                  </div>
                  <Button 
                    type="button" 
                    onClick={handleGenerateImage} 
                    disabled={isGenerating}
                    className="w-full bg-orange-600 hover:bg-orange-700"
                  >
                    {isGenerating ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating Image...</>
                    ) : (
                      'Generate Image'
                    )}
                  </Button>
                  
                  {newItem.url && newItem.type === 'image' && newItem.url.startsWith('data:') && (
                    <div className="mt-4 space-y-2">
                      <p className="text-sm font-medium text-green-600 flex items-center gap-1">
                        <CheckCircle className="h-4 w-4" /> Preview generated image:
                      </p>
                      <div className="relative aspect-video overflow-hidden rounded-lg border border-border shadow-sm">
                        <img src={newItem.url} className="h-full w-full object-cover" />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Upload from Local Disk (Max 100MB)</label>
                    <div className="space-y-2">
                      <div className="flex items-center gap-4">
                        <Input 
                          type="file" 
                          accept={newItem.type === 'image' ? "image/*,.heic,.heif,.avif,.tiff,.bmp" : "video/*,.mov,.avi,.mkv,.webm,.flv,.3gp,.wmv,.m4v,.mp4"}
                          onChange={handleFileUpload}
                          disabled={isUploading}
                          className="cursor-pointer bg-muted/50 border-border z-10"
                        />
                        {isUploading && (
                          <div className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin text-orange-600" />
                            <span className="text-xs font-bold text-orange-600">{uploadProgress}%</span>
                          </div>
                        )}
                      </div>
                      {isUploading && (
                        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-orange-600 transition-all duration-300" 
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground italic">Note: Files are optimized on-the-fly inside the browser before upload. Photos and video formats up to 100MB are supported natively.</p>
                  </div>

                  <Input 
                    placeholder="URL (Image URL or Video Embed URL)" 
                    value={newItem.url} 
                    onChange={e => {
                      const val = e.target.value;
                      const ytId = getYoutubeId(val);
                      if (ytId) {
                        setNewItem(prev => ({
                          ...prev,
                          url: val,
                          type: 'video',
                          thumbnail: prev.thumbnail || `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`
                        }));
                      } else {
                        setNewItem(prev => ({ ...prev, url: val }));
                      }
                    }} 
                    required 
                    className="bg-muted/50 border-border"
                  />
                  {newItem.type === 'video' && (
                    <Input 
                      placeholder="Thumbnail URL (Optional)" 
                      value={newItem.thumbnail} 
                      onChange={e => setNewItem({...newItem, thumbnail: e.target.value})} 
                      className="bg-muted/50 border-border"
                    />
                  )}
                </>
              )}

              <Input 
                placeholder="Item Title" 
                value={newItem.title} 
                onChange={e => setNewItem({...newItem, title: e.target.value})} 
                required 
                className="bg-muted/50 border-border"
              />
              
              <Button 
                type="submit" 
                className="w-full bg-orange-600 text-white"
                disabled={!newItem.url || isGenerating || isUploading}
              >
                Save to Gallery
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {items.map((item) => (
          <div key={item.id} className="group relative aspect-square overflow-hidden rounded-xl bg-muted border border-border/50">
            {(() => {
              const ytId = getYoutubeId(item.url);
              if (ytId) {
                return (
                  <div className="relative h-full w-full bg-black flex items-center justify-center">
                    <img
                      src={item.thumbnail || `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`}
                      alt={item.title}
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        const target = e.currentTarget;
                        if (!target.src.includes('hqdefault.jpg')) {
                          target.src = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
                        } else if (!target.src.includes('0.jpg')) {
                          target.src = `https://img.youtube.com/vi/${ytId}/0.jpg`;
                        }
                      }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <Play className="h-6 w-6 text-white fill-white" />
                    </div>
                  </div>
                );
              }
              if (item.type === 'image') {
                return (
                  <img
                    src={item.url}
                    alt={item.title}
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                );
              }
              const isDirect = item.url?.includes('firebasestorage.googleapis.com') || item.url?.match(/\.(mp4|webm|ogg)/i);
              if (isDirect) {
                return (
                  <video
                    src={item.url}
                    poster={item.thumbnail}
                    preload="metadata"
                    muted
                    className="h-full w-full object-cover"
                  />
                );
              }
              return (
                <img
                  src={item.thumbnail || "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&q=80"}
                  alt={item.title}
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                />
              );
            })()}
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
              <Button variant="destructive" size="sm" onClick={() => handleDelete(item.id, item.url, item.thumbnail)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-2 text-[10px] text-white opacity-0 group-hover:opacity-100">
              {item.title}
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="col-span-full py-8 text-center text-muted-foreground">No media found.</p>}
      </div>

      {deleteData && (
        <AdminDeleteModal
          title="Delete Gallery Item"
          message="Are you sure you want to delete this media item? This action is completely permanent and cannot be undone."
          onConfirm={confirmDelete}
          onCancel={() => setDeleteData(null)}
        />
      )}
    </div>
  );
}

function ManagePortfolio() {
  const [items, setItems] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState({ title: '', description: '', imageUrl: '', category: 'Consulting' });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'portfolio'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'portfolio');
    });
    return () => unsubscribe();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'portfolio'), {
        ...newItem,
        createdAt: serverTimestamp()
      });
      toast.success('Project added');
      setIsAdding(false);
      setNewItem({ title: '', description: '', imageUrl: '', category: 'Consulting' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'portfolio');
    }
  };

  const handleDelete = (id: string) => {
    setDeleteId(id);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteDoc(doc(db, 'portfolio', deleteId));
      toast.success('Project deleted');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `portfolio/${deleteId}`);
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Manage Portfolio</h1>
        <Button onClick={() => setIsAdding(!isAdding)} className="bg-orange-600 hover:bg-orange-700 text-white">
          {isAdding ? 'Cancel' : <><Plus className="mr-2 h-4 w-4" /> Add Project</>}
        </Button>
      </div>

      {isAdding && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Add New Portfolio Project</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input 
                  placeholder="Title" 
                  value={newItem.title} 
                  onChange={e => setNewItem({...newItem, title: e.target.value})} 
                  required 
                  className="bg-muted/50 border-border"
                />
                <Input 
                  placeholder="Category" 
                  value={newItem.category} 
                  onChange={e => setNewItem({...newItem, category: e.target.value})} 
                  required 
                  className="bg-muted/50 border-border"
                />
              </div>
              <Input 
                placeholder="Image URL" 
                value={newItem.imageUrl} 
                onChange={e => setNewItem({...newItem, imageUrl: e.target.value})} 
                required 
                className="bg-muted/50 border-border"
              />
              <Textarea 
                placeholder="Description" 
                value={newItem.description} 
                onChange={e => setNewItem({...newItem, description: e.target.value})} 
                required 
                className="bg-muted/50 border-border"
              />
              <Button type="submit" className="w-full bg-orange-600 text-white">Save Project</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4">
        {items.map((item) => (
          <Card key={item.id} className="bg-card border-border">
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center space-x-4">
                <div className="h-12 w-12 overflow-hidden rounded-lg bg-muted">
                  <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.category}</p>
                </div>
              </div>
              <Button variant="destructive" size="icon" onClick={() => handleDelete(item.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
        {items.length === 0 && <p className="py-8 text-center text-muted-foreground">No projects found.</p>}
      </div>

      {deleteId && (
        <AdminDeleteModal
          title="Delete Portfolio Project"
          message="Are you sure you want to delete this project? This action is completely permanent and cannot be undone."
          onConfirm={confirmDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}

function ManageSettings() {
  const [settings, setSettings] = useState<any>({
    address: '',
    phone: '',
    email: '',
    aboutContent: '',
    aboutImageUrl: '',
    dailyQuote: '',
    facebook: '',
    youtube: '',
    tiktok: '',
    logoUrl: '',
    isAgentOnline: true,
    autoReplyMessage: 'Thank you for contacting Grefas Consult & Entertainment. We are currently offline, but your message has been received! Our team will get back to you as soon as possible.',
    isMaintenanceMode: false,
    maintenanceMessage: 'Our website/portal is currently undergoing scheduled platform updates and alignments. We will be back online shortly!',
    isVacancyActive: false,
    vacancyAlertTitle: 'We are Hiring! Active Vacancy Available',
    vacancyAlertMessage: 'We are currently looking for brilliant actors, skit creators, creative writers, video editors, and production crew to join our team in Nyinahin-Ashanti. Click below to view open roles and apply!',
    vacancyButtonText: 'Apply Now',
    letterheadJointTitle: 'GREFAS ENTERTAINMENT & CONSULT',
    letterheadJointSubtitle: 'Theatre, Film Casting, Artiste Management, Production & Business Consulting',
    letterheadEntTitle: 'GREFAS ENTERTAINMENT & PRODUCTIONS',
    letterheadEntSubtitle: 'Skit & Movie Production, Casting Services, Creative Arts and Artiste Management',
    letterheadConsultTitle: 'GREFAS BUSINESS & STRATEGY CONSULT',
    letterheadConsultSubtitle: 'Corporate Advisory, Visa Interview Preparation, Strategic Management Consulting',
    homeCarouselImages: [],
    intakePrice: 50,
    advertActive: true,
    advertTitle: 'Grefas Showcase Commercial',
    advertDescription: 'Explore our latest premium entertainment and casting showcases from Nyinahin-Ashanti.',
    advertImageUrl: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM2Zic3VzbjRraHBhYTRqYWZ1cnpsbHVpZXB0czdrY3I2dnpqdjU1NSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3o7TKUM3Y5MgX9sLYs/giphy.gif',
    advertVideoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4',
    advertLink: '/services',
    privacyPolicyContent: '',
    termsOfServiceContent: '',
    refundPolicyContent: '',
    privacyDeskTitle: 'Grefas Data Privacy Desk',
    privacyDeskLocation: 'Nyinahin-Ashanti, Ashanti Region, Ghana (GPS: AI-0008-9223)',
    privacyDeskEmail: 'legal@grefas.com',
    privacyDeskPhone: '+233 24 000 0000',
    policyLastUpdatedDate: 'August 10, 2026'
  });
  const [loading, setLoading] = useState(true);

  const [isUploadingCarousel, setIsUploadingCarousel] = useState(false);
  const [carouselUploadProgress, setCarouselUploadProgress] = useState(0);
  const [newCarouselUrl, setNewCarouselUrl] = useState('');

  const handleCarouselUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Only image uploads are supported.');
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      toast.error('Image is too large. Maximum size allowed is 25MB.');
      return;
    }

    setIsUploadingCarousel(true);
    setCarouselUploadProgress(0);

    try {
      toast.loading('Optimizing carousel image format...', { id: 'carousel-img-compress' });
      const compressedBlob = await compressImage(file, 1920, 1080, 0.8);
      toast.dismiss('carousel-img-compress');

      const cleanFileName = file.name.replace(/\.[^/.]+$/, "") + ".jpg";
      const storageRef = ref(storage, `home_carousel/${Date.now()}_${cleanFileName}`);
      
      const uploadTask = uploadBytesResumable(storageRef, compressedBlob, {
        contentType: 'image/jpeg'
      });

      uploadTask.on('state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setCarouselUploadProgress(Math.round(progress));
        },
        async (error) => {
          console.warn('Carousel image upload failed, falling back to local base64:', error);
          try {
            toast.loading('Saving optimized photo locally...', { id: 'carousel-img-fallback' });
            const extraCompressedBlob = await compressImage(file, 1024, 576, 0.7);
            const base64String = await blobToBase64(extraCompressedBlob);
            if (base64String) {
              setSettings((prev: any) => ({
                ...prev,
                homeCarouselImages: [...(prev.homeCarouselImages || []), base64String]
              }));
              toast.dismiss('carousel-img-fallback');
              toast.success('Optimized locally! Carousel photo applied.');
            } else {
              throw new Error('Failed to convert optimized image to base64');
            }
          } catch (fallbackError) {
            console.error('Local photo fallback failed:', fallbackError);
            toast.dismiss('carousel-img-fallback');
            toast.error('Image upload failed & fallback failed.');
          } finally {
            setIsUploadingCarousel(false);
          }
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          setSettings((prev: any) => ({
            ...prev,
            homeCarouselImages: [...(prev.homeCarouselImages || []), downloadURL]
          }));
          setIsUploadingCarousel(false);
          toast.success('Optimized carousel photo uploaded instantly!');
        }
      );
    } catch (error) {
      console.error('Carousel image upload compression failed:', error);
      toast.dismiss('carousel-img-compress');
      toast.error('Could not optimize or upload carousel photo.');
      setIsUploadingCarousel(false);
    }
  };

  const handleAddCarouselUrl = () => {
    if (!newCarouselUrl.trim()) return;
    setSettings((prev: any) => ({
      ...prev,
      homeCarouselImages: [...(prev.homeCarouselImages || []), newCarouselUrl.trim()]
    }));
    setNewCarouselUrl('');
    toast.success('New carousel image link added!');
  };

  const handleRemoveCarouselImage = (indexToRemove: number) => {
    setSettings((prev: any) => ({
      ...prev,
      homeCarouselImages: (prev.homeCarouselImages || []).filter((_: any, idx: number) => idx !== indexToRemove)
    }));
    toast.success('Carousel image removed. Remember to click "Save All Settings"!');
  };

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'global'), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setSettings({
          address: data.address || '',
          phone: data.phone || '',
          email: data.email || '',
          aboutContent: data.aboutContent || '',
          aboutImageUrl: data.aboutImageUrl || '',
          dailyQuote: data.dailyQuote || '',
          facebook: data.facebook || '',
          youtube: data.youtube || '',
          tiktok: data.tiktok || '',
          logoUrl: data.logoUrl || '',
          isAgentOnline: data.isAgentOnline !== false,
          autoReplyMessage: data.autoReplyMessage || 'Thank you for contacting Grefas Consult & Entertainment. We are currently offline, but your message has been received! Our team will get back to you as soon as possible.',
          isMaintenanceMode: data.isMaintenanceMode === true,
          maintenanceMessage: data.maintenanceMessage || 'Our website/portal is currently undergoing scheduled platform updates and alignments. We will be back online shortly!',
          isVacancyActive: data.isVacancyActive === true,
          vacancyAlertTitle: data.vacancyAlertTitle || 'We are Hiring! Active Vacancy Available',
          vacancyAlertMessage: data.vacancyAlertMessage || 'We are currently looking for brilliant actors, skit creators, creative writers, video editors, and production crew to join our team in Nyinahin-Ashanti. Click below to view open roles and apply!',
          vacancyButtonText: data.vacancyButtonText || 'Apply Now',
          workWithUsSubtitle: data.workWithUsSubtitle || 'Grefas is always looking for brilliant actors, passionate crew members, video editors, scriptwriters, and consulting staff. Fill in your professional details below to join our talent database.',
          letterheadJointTitle: data.letterheadJointTitle || 'GREFAS ENTERTAINMENT & CONSULT',
          letterheadJointSubtitle: data.letterheadJointSubtitle || 'Theatre, Film Casting, Artiste Management, Production & Business Consulting',
          letterheadEntTitle: data.letterheadEntTitle || 'GREFAS ENTERTAINMENT & PRODUCTIONS',
          letterheadEntSubtitle: data.letterheadEntSubtitle || 'Skit & Movie Production, Casting Services, Creative Arts and Artiste Management',
          letterheadConsultTitle: data.letterheadConsultTitle || 'GREFAS BUSINESS & STRATEGY CONSULT',
          letterheadConsultSubtitle: data.letterheadConsultSubtitle || 'Corporate Advisory, Visa Interview Preparation, Strategic Management Consulting',
          homeCarouselImages: data.homeCarouselImages || [],
          intakePrice: data.intakePrice !== undefined ? Number(data.intakePrice) : 50,
          advertActive: data.advertActive !== false,
          advertTitle: data.advertTitle || 'Grefas Showcase Commercial',
          advertDescription: data.advertDescription || 'Explore our latest premium entertainment and casting showcases from Nyinahin-Ashanti.',
          advertImageUrl: data.advertImageUrl || 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM2Zic3VzbjRraHBhYTRqYWZ1cnpsbHVpZXB0czdrY3I2dnpqdjU1NSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3o7TKUM3Y5MgX9sLYs/giphy.gif',
          advertVideoUrl: data.advertVideoUrl || 'https://www.w3schools.com/html/mov_bbb.mp4',
          advertLink: data.advertLink || '/services',
          privacyPolicyContent: data.privacyPolicyContent || '',
          termsOfServiceContent: data.termsOfServiceContent || '',
          refundPolicyContent: data.refundPolicyContent || '',
          privacyDeskTitle: data.privacyDeskTitle || 'Grefas Data Privacy Desk',
          privacyDeskLocation: data.privacyDeskLocation || 'Nyinahin-Ashanti, Ashanti Region, Ghana (GPS: AI-0008-9223)',
          privacyDeskEmail: data.privacyDeskEmail || 'legal@grefas.com',
          privacyDeskPhone: data.privacyDeskPhone || '+233 24 000 0000',
          policyLastUpdatedDate: data.policyLastUpdatedDate || 'August 10, 2026'
        });
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await setDoc(doc(db, 'settings', 'global'), settings);
      toast.success('Settings updated');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/global');
    }
  };

  if (loading) return <Loader2 className="h-8 w-8 animate-spin text-orange-600 mx-auto" />;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-foreground">Website Settings</h1>
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Contact Information & About Content</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdate} className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2 text-foreground">
                  <Mail className="h-4 w-4 text-muted-foreground" /> Email Address
                </label>
                <Input
                  value={settings.email}
                  onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                  placeholder="info@grefasconsultandentertainment.com"
                  className="bg-muted/50 border-border"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2 text-foreground">
                  <Phone className="h-4 w-4 text-muted-foreground" /> Phone Number
                </label>
                <Input
                  value={settings.phone}
                  onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                  placeholder="+233 123 456 789"
                  className="bg-muted/50 border-border"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2 text-foreground">
                  <MapPin className="h-4 w-4 text-muted-foreground" /> Office Address
                </label>
                <Input
                  value={settings.address}
                  onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                  placeholder="Accra, Ghana"
                  className="bg-muted/50 border-border"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2 text-foreground">
                <ImageIcon className="h-4 w-4 text-muted-foreground" /> Website Logo URL
              </label>
              <Input
                value={settings.logoUrl}
                onChange={(e) => setSettings({ ...settings, logoUrl: e.target.value })}
                placeholder="https://..."
                className="bg-muted/50 border-border"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2 text-foreground">
                <ImageIcon className="h-4 w-4 text-muted-foreground" /> About Page Image URL
              </label>
              <Input
                value={settings.aboutImageUrl}
                onChange={(e) => setSettings({ ...settings, aboutImageUrl: e.target.value })}
                placeholder="https://images.unsplash.com/..."
                className="bg-muted/50 border-border"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2 text-foreground">
                <CreditCard className="h-4 w-4 text-muted-foreground" /> Casting Intake Registration Fee (GH‚Çµ)
              </label>
              <Input
                type="number"
                value={settings.intakePrice !== undefined ? settings.intakePrice : ''}
                onChange={(e) => setSettings({ ...settings, intakePrice: Number(e.target.value) })}
                placeholder="50"
                className="bg-muted/50 border-border"
                min="0"
              />
              <p className="text-xs text-muted-foreground">
                The standard registration fee shown to clients on the Movie & Skit registration form, which they must confirm before submitting.
              </p>
            </div>

            {/* Homepage Animated Pictures (Hero Carousel) Section */}
            <div className="border-t border-border pt-6 mt-6 space-y-4">
              <div>
                <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                  <ImageIcon className="h-5 w-5 text-orange-600" /> Homepage Animated Pictures (Carousel)
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Configure, upload, or arrange the background slides rendered in the animated carousel on the main homepage.
                </p>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-semibold text-foreground block">Current Slides ({settings.homeCarouselImages?.length || 0})</label>
                
                {(!settings.homeCarouselImages || settings.homeCarouselImages.length === 0) ? (
                  <div className="bg-muted/30 border border-dashed border-border p-6 rounded-xl text-center space-y-2">
                    <p className="text-xs text-muted-foreground">No custom pictures uploaded. The homepage is currently showing the 4 default fallback pictures.</p>
                    <div className="flex flex-wrap justify-center gap-2 text-[10px] text-muted-foreground/75">
                      <span>‚Ä¢ Wedding/Corporate Setup</span>
                      <span>‚Ä¢ Live Concert</span>
                      <span>‚Ä¢ Corporate Event Panel</span>
                      <span>‚Ä¢ Production Backdrop</span>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {settings.homeCarouselImages.map((imgUrl: string, idx: number) => (
                      <div key={idx} className="relative group/carousel border border-border rounded-xl overflow-hidden bg-zinc-950 aspect-[16/9] shadow-sm">
                        <img 
                          src={imgUrl} 
                          alt={`Carousel Slide ${idx + 1}`} 
                          className="w-full h-full object-cover group-hover/carousel:scale-105 transition-transform duration-300"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/carousel:opacity-100 transition-opacity flex items-center justify-center">
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            title="Delete picture"
                            onClick={() => handleRemoveCarouselImage(idx)}
                            className="h-8 w-8 rounded-full shadow-lg"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="absolute bottom-1.5 left-1.5 bg-black/60 backdrop-blur-xs px-2 py-0.5 rounded text-[9px] font-bold text-white">
                          Slide {idx + 1}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/20 p-4 rounded-xl border border-border">
                {/* Method A: Direct Image Link */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-foreground block">Option A: Add via Web Image Link</label>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      placeholder="e.g. https://images.unsplash.com/..."
                      value={newCarouselUrl}
                      onChange={(e) => setNewCarouselUrl(e.target.value)}
                      className="bg-background border-border text-xs h-9"
                    />
                    <Button 
                      type="button" 
                      onClick={handleAddCarouselUrl}
                      disabled={!newCarouselUrl.trim()}
                      className="bg-orange-600 hover:bg-orange-700 text-white font-semibold text-xs h-9 shrink-0 px-4"
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add URL
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Paste a direct, high-quality image link to append it instantly to your slides collection.</p>
                </div>

                {/* Method B: Upload from Device */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-foreground block">Option B: Upload from Device</label>
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={handleCarouselUpload}
                        disabled={isUploadingCarousel}
                        className="bg-background border-border text-xs h-9 cursor-pointer file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[11px] file:font-semibold file:bg-orange-500/10 file:text-orange-600 hover:file:bg-orange-500/20"
                      />
                    </div>
                    {isUploadingCarousel && (
                      <div className="flex items-center gap-1 text-xs text-orange-600 font-bold shrink-0">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> {carouselUploadProgress}%
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground">Upload an image file directly. It will be compressed automatically on-the-fly for rapid page loading.</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2 text-foreground">
                <Info className="h-4 w-4 text-muted-foreground" /> About Us Content
              </label>
              <Textarea
                value={settings.aboutContent}
                onChange={(e) => setSettings({ ...settings, aboutContent: e.target.value })}
                placeholder="Tell your story..."
                rows={8}
                className="bg-muted/50 border-border"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2 text-foreground">
                <Quote className="h-4 w-4 text-muted-foreground" /> Daily Inspiration Quote
              </label>
              <Input
                value={settings.dailyQuote}
                onChange={(e) => setSettings({ ...settings, dailyQuote: e.target.value })}
                placeholder="Excellence is not an act, but a habit."
                className="bg-muted/50 border-border"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2 text-foreground">
                  <Facebook className="h-4 w-4 text-muted-foreground" /> Facebook Link
                </label>
                <Input
                  value={settings.facebook}
                  onChange={(e) => setSettings({ ...settings, facebook: e.target.value })}
                  placeholder="https://facebook.com/..."
                  className="bg-muted/50 border-border"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2 text-foreground">
                  <Youtube className="h-4 w-4 text-muted-foreground" /> YouTube Link
                </label>
                <Input
                  value={settings.youtube}
                  onChange={(e) => setSettings({ ...settings, youtube: e.target.value })}
                  placeholder="https://youtube.com/..."
                  className="bg-muted/50 border-border"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2 text-foreground">
                  <Music2 className="h-4 w-4 text-muted-foreground" /> TikTok Link
                </label>
                <Input
                  value={settings.tiktok}
                  onChange={(e) => setSettings({ ...settings, tiktok: e.target.value })}
                  placeholder="https://tiktok.com/@..."
                  className="bg-muted/50 border-border"
                />
              </div>
            </div>

            {/* Live Chat & Auto-Reply Settings Section */}
            <div className="border-t border-border pt-6 mt-6 space-y-4">
              <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-orange-600" /> Live Chat Support Settings
              </h3>
              <div className="bg-muted/30 p-4 rounded-xl border border-border space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-sm text-foreground">Support Representative Status</p>
                    <p className="text-xs text-muted-foreground">Toggle whether agents are currently available to respond live.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${settings.isAgentOnline !== false ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'}`}>
                      {settings.isAgentOnline !== false ? '‚óè Online' : '‚óã Away / Offline'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSettings({ ...settings, isAgentOnline: settings.isAgentOnline === false ? true : false })}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${settings.isAgentOnline !== false ? 'bg-orange-600' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${settings.isAgentOnline !== false ? 'translate-x-5' : 'translate-x-0'}`}
                      />
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2 text-foreground">
                    Away Automatic Reply Message
                  </label>
                  <Textarea
                    value={settings.autoReplyMessage}
                    onChange={(e) => setSettings({ ...settings, autoReplyMessage: e.target.value })}
                    placeholder="Enter the automated message that users will receive when agents are away..."
                    rows={3}
                    className="bg-background border-border"
                  />
                  <p className="text-[11px] text-muted-foreground italic">
                    This message will automatically trigger in a client's chat screen after they send a message while representatives are away or offline.
                  </p>
                </div>
              </div>
            </div>

            {/* Maintenance Mode Settings Section */}
            <div className="border-t border-border pt-6 mt-6 space-y-4">
              <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                <Wrench className="h-5 w-5 text-orange-600 animate-spin-slow" /> Maintenance Mode Config
              </h3>
              <div className="bg-muted/30 p-4 rounded-xl border border-border space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-sm text-foreground">Activate Maintenance Mode</p>
                    <p className="text-xs text-muted-foreground">When active, public visitors will be redirected to a custom under-construction screen.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${settings.isMaintenanceMode === true ? 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400' : 'bg-green-100 text-green-700 dark:bg-green-950/20 dark:text-green-400'}`}>
                      {settings.isMaintenanceMode === true ? '‚óè Maintenance Active' : '‚óã Website Online'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSettings({ ...settings, isMaintenanceMode: settings.isMaintenanceMode === true ? false : true })}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${settings.isMaintenanceMode === true ? 'bg-orange-600' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${settings.isMaintenanceMode === true ? 'translate-x-5' : 'translate-x-0'}`}
                      />
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2 text-foreground">
                    Custom Maintenance Message
                  </label>
                  <Textarea
                    value={settings.maintenanceMessage}
                    onChange={(e) => setSettings({ ...settings, maintenanceMessage: e.target.value })}
                    placeholder="Enter the message that visitors will see when the site is in maintenance mode..."
                    rows={3}
                    className="bg-background border-border"
                  />
                  <p className="text-[11px] text-muted-foreground italic">
                    This custom message will display in real time on the website's overlay screen, informing clients about maintenance activities.
                  </p>
                </div>
              </div>
            </div>

            {/* Careers & Vacancy Alert Section */}
            <div className="border-t border-border pt-6 mt-6 space-y-4">
              <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-orange-600" /> Careers & Vacancy Alert Config
              </h3>
              <div className="bg-muted/30 p-4 rounded-xl border border-border space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-sm text-foreground">Activate Vacancy Alert Banner</p>
                    <p className="text-xs text-muted-foreground">Toggle whether an eye-catching vacancy alert banner is visible on the home page.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${settings.isVacancyActive === true ? 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400' : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'}`}>
                      {settings.isVacancyActive === true ? '‚óè Vacancy Active' : '‚óã No Active Vacancies'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSettings({ ...settings, isVacancyActive: settings.isVacancyActive === true ? false : true })}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${settings.isVacancyActive === true ? 'bg-orange-600' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${settings.isVacancyActive === true ? 'translate-x-5' : 'translate-x-0'}`}
                      />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Vacancy Alert Title
                    </label>
                    <Input
                      value={settings.vacancyAlertTitle || ''}
                      onChange={(e) => setSettings({ ...settings, vacancyAlertTitle: e.target.value })}
                      placeholder="e.g. We are Hiring! Active Vacancy Available"
                      className="bg-background border-border"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Apply Button Text
                    </label>
                    <Input
                      value={settings.vacancyButtonText || ''}
                      onChange={(e) => setSettings({ ...settings, vacancyButtonText: e.target.value })}
                      placeholder="e.g. Apply Now"
                      className="bg-background border-border"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Vacancy Alert Message / Description
                  </label>
                  <Textarea
                    value={settings.vacancyAlertMessage || ''}
                    onChange={(e) => setSettings({ ...settings, vacancyAlertMessage: e.target.value })}
                    placeholder="Enter the description/message for the vacancy alert banner on the home page..."
                    rows={3}
                    className="bg-background border-border"
                  />
                  <p className="text-[11px] text-muted-foreground italic">
                    This message will be shown to public visitors on the homepage to invite them to apply through the careers desk.
                  </p>
                </div>

                <div className="space-y-2 pt-2 border-t border-border/40">
                  <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                    <FileText className="h-4 w-4 text-orange-600" /> Work With Us Page Header Subtitle Text
                  </label>
                  <Textarea
                    value={settings.workWithUsSubtitle || ''}
                    onChange={(e) => setSettings({ ...settings, workWithUsSubtitle: e.target.value })}
                    placeholder="Enter the description text displayed under the heading on the Work With Us page..."
                    rows={3}
                    className="bg-background border-border"
                  />
                  <p className="text-[11px] text-muted-foreground italic">
                    This text replaces the header description on the "Work With Us" page for candidates in real time.
                  </p>
                </div>
              </div>
            </div>

            {/* Dynamic Advertisement Settings Section */}
            <div className="border-t border-border pt-6 mt-6 space-y-4">
              <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-orange-600" /> Homepage Commercial & Advertisement Space
              </h3>
              <p className="text-xs text-muted-foreground">
                Manage the promotional animated image and video spotlight shown on the home page.
              </p>
              <div className="bg-muted/30 p-4 rounded-xl border border-border space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-sm text-foreground">Activate Advertisement Showcase</p>
                    <p className="text-xs text-muted-foreground">Toggle whether the partner advertisement section is displayed on the homepage.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${settings.advertActive !== false ? 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400' : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'}`}>
                      {settings.advertActive !== false ? '‚óè Active' : '‚óã Hidden'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSettings({ ...settings, advertActive: settings.advertActive !== false ? false : true })}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${settings.advertActive !== false ? 'bg-orange-600' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${settings.advertActive !== false ? 'translate-x-5' : 'translate-x-0'}`}
                      />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Advertisement Title
                    </label>
                    <Input
                      value={settings.advertTitle || ''}
                      onChange={(e) => setSettings({ ...settings, advertTitle: e.target.value })}
                      placeholder="e.g. Grefas Showcase Commercial"
                      className="bg-background border-border"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Sponsor Campaign Target Link (URL)
                    </label>
                    <Input
                      value={settings.advertLink || ''}
                      onChange={(e) => setSettings({ ...settings, advertLink: e.target.value })}
                      placeholder="e.g. /services or custom URL"
                      className="bg-background border-border"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Advertisement Description / Subtitle
                  </label>
                  <Textarea
                    value={settings.advertDescription || ''}
                    onChange={(e) => setSettings({ ...settings, advertDescription: e.target.value })}
                    placeholder="Enter description explaining this partner offer or advertisement campaign..."
                    rows={2}
                    className="bg-background border-border"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                      Animated Image / GIF URL
                    </label>
                    <Input
                      value={settings.advertImageUrl || ''}
                      onChange={(e) => setSettings({ ...settings, advertImageUrl: e.target.value })}
                      placeholder="Paste image / GIF web address link"
                      className="bg-background border-border font-mono text-xs"
                    />
                    <p className="text-[10px] text-muted-foreground italic">
                      Provide a high-quality GIF or animated visual link.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                      Video Commercial URL (MP4 or YouTube Link)
                    </label>
                    <Input
                      value={settings.advertVideoUrl || ''}
                      onChange={(e) => setSettings({ ...settings, advertVideoUrl: e.target.value })}
                      placeholder="e.g. https://www.w3schools.com/html/mov_bbb.mp4"
                      className="bg-background border-border font-mono text-xs"
                    />
                    <p className="text-[10px] text-muted-foreground italic">
                      Provide an MP4 video or standard YouTube video stream link.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Custom Letterhead Settings Section */}
            <div className="border-t border-border pt-6 mt-6 space-y-4">
              <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                <FileText className="h-5 w-5 text-orange-600" /> Official Letterhead Customization
              </h3>
              <p className="text-xs text-muted-foreground">
                Customize the titles and subtitles printed on official Grefas document letterheads based on division types.
              </p>
              
              <div className="bg-muted/30 p-4 rounded-xl border border-border space-y-6">
                {/* Joint/Default Letterhead */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-foreground border-b border-border pb-1">1. Joint & General Letterhead (Default)</h4>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Title</label>
                      <Input
                        value={settings.letterheadJointTitle || ''}
                        onChange={(e) => setSettings({ ...settings, letterheadJointTitle: e.target.value })}
                        placeholder="GREFAS ENTERTAINMENT & CONSULT"
                        className="bg-background border-border"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Subtitle / Tagline</label>
                      <Input
                        value={settings.letterheadJointSubtitle || ''}
                        onChange={(e) => setSettings({ ...settings, letterheadJointSubtitle: e.target.value })}
                        placeholder="Theatre, Film Casting, Artiste Management, Production & Business Consulting"
                        className="bg-background border-border"
                      />
                    </div>
                  </div>
                </div>

                {/* Entertainment Letterhead */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-foreground border-b border-border pb-1">2. Entertainment & Productions Division</h4>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Title</label>
                      <Input
                        value={settings.letterheadEntTitle || ''}
                        onChange={(e) => setSettings({ ...settings, letterheadEntTitle: e.target.value })}
                        placeholder="GREFAS ENTERTAINMENT & PRODUCTIONS"
                        className="bg-background border-border"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Subtitle / Tagline</label>
                      <Input
                        value={settings.letterheadEntSubtitle || ''}
                        onChange={(e) => setSettings({ ...settings, letterheadEntSubtitle: e.target.value })}
                        placeholder="Skit & Movie Production, Casting Services, Creative Arts and Artiste Management"
                        className="bg-background border-border"
                      />
                    </div>
                  </div>
                </div>

                {/* Business Consult Letterhead */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-foreground border-b border-border pb-1">3. Business & Strategy Consult Division</h4>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Title</label>
                      <Input
                        value={settings.letterheadConsultTitle || ''}
                        onChange={(e) => setSettings({ ...settings, letterheadConsultTitle: e.target.value })}
                        placeholder="GREFAS BUSINESS & STRATEGY CONSULT"
                        className="bg-background border-border"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Subtitle / Tagline</label>
                      <Input
                        value={settings.letterheadConsultSubtitle || ''}
                        onChange={(e) => setSettings({ ...settings, letterheadConsultSubtitle: e.target.value })}
                        placeholder="Corporate Advisory, Visa Interview Preparation, Strategic Management Consulting"
                        className="bg-background border-border"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Legal Policies & Privacy Desk Settings Section */}
            <div className="border-t border-border pt-6 mt-6 space-y-4">
              <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-orange-600" /> Legal Policies & Grefas Data Privacy Desk Config
              </h3>
              <p className="text-xs text-muted-foreground">
                Edit the official Privacy Policy, Terms of Service, Refund Policy, and Data Privacy Desk contact details displayed to clients.
              </p>

              <div className="bg-muted/30 p-4 rounded-xl border border-border space-y-6">
                {/* Effective Date & Privacy Desk Info */}
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-foreground border-b border-border pb-1">1. Grefas Data Privacy Desk Information</h4>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground">Desk / Department Title</label>
                      <Input
                        value={settings.privacyDeskTitle || ''}
                        onChange={(e) => setSettings({ ...settings, privacyDeskTitle: e.target.value })}
                        placeholder="e.g. Grefas Data Privacy Desk"
                        className="bg-background border-border"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground">Last Updated / Effective Date</label>
                      <Input
                        value={settings.policyLastUpdatedDate || ''}
                        onChange={(e) => setSettings({ ...settings, policyLastUpdatedDate: e.target.value })}
                        placeholder="e.g. August 10, 2026"
                        className="bg-background border-border"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground">Physical Office Location / Address</label>
                      <Input
                        value={settings.privacyDeskLocation || ''}
                        onChange={(e) => setSettings({ ...settings, privacyDeskLocation: e.target.value })}
                        placeholder="e.g. Nyinahin-Ashanti, Ashanti Region, Ghana"
                        className="bg-background border-border"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground">Legal / Privacy Email</label>
                      <Input
                        value={settings.privacyDeskEmail || ''}
                        onChange={(e) => setSettings({ ...settings, privacyDeskEmail: e.target.value })}
                        placeholder="e.g. legal@grefas.com"
                        className="bg-background border-border"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground">Legal Desk Phone Number</label>
                      <Input
                        value={settings.privacyDeskPhone || ''}
                        onChange={(e) => setSettings({ ...settings, privacyDeskPhone: e.target.value })}
                        placeholder="e.g. +233 24 000 0000"
                        className="bg-background border-border"
                      />
                    </div>
                  </div>
                </div>

                {/* Custom Policy Content Overrides */}
                <div className="space-y-4 pt-2 border-t border-border/40">
                  <h4 className="text-sm font-semibold text-foreground border-b border-border pb-1">2. Custom Policy Documents Overrides (Optional)</h4>
                  <p className="text-xs text-muted-foreground">
                    Leave any field empty to use the standard default structured policy document. Input custom content below to override a policy with your own text.
                  </p>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5 text-orange-600" /> Custom Privacy Policy Text
                    </label>
                    <Textarea
                      value={settings.privacyPolicyContent || ''}
                      onChange={(e) => setSettings({ ...settings, privacyPolicyContent: e.target.value })}
                      placeholder="Optional custom Privacy Policy text... (Leave empty to use standard defaults)"
                      rows={4}
                      className="bg-background border-border font-mono text-xs"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-orange-600" /> Custom Terms of Service Text
                    </label>
                    <Textarea
                      value={settings.termsOfServiceContent || ''}
                      onChange={(e) => setSettings({ ...settings, termsOfServiceContent: e.target.value })}
                      placeholder="Optional custom Terms of Service text... (Leave empty to use standard defaults)"
                      rows={4}
                      className="bg-background border-border font-mono text-xs"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <CreditCard className="h-3.5 w-3.5 text-orange-600" /> Custom Refund Policy Text
                    </label>
                    <Textarea
                      value={settings.refundPolicyContent || ''}
                      onChange={(e) => setSettings({ ...settings, refundPolicyContent: e.target.value })}
                      placeholder="Optional custom Refund Policy text... (Leave empty to use standard defaults)"
                      rows={4}
                      className="bg-background border-border font-mono text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>

            <Button type="submit" className="bg-orange-600 hover:bg-orange-700 text-white flex items-center gap-2">
              <Save className="h-4 w-4" /> Save All Settings
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="bg-card border-border border-orange-200 dark:border-orange-900/30">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-orange-600">
            <AlertCircle className="h-5 w-5" /> SMS Notification Help
          </CardTitle>
          <CardDescription>
            Information about sending SMS notifications via Arkesel.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            This application uses the <strong>Arkesel SMS Gateway</strong> (preferred local provider in Ghana) to dispatch transactional SMS notifications.
          </p>
          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            <p className="font-bold text-foreground">To configure SMS delivery:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Log in to your <a href="https://arkesel.com" target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:underline">Arkesel Dashboard</a>.</li>
              <li>Go to <strong>API Settings</strong> to obtain your API Key.</li>
              <li>Register a customized <strong>Sender ID</strong> (such as Grefas) on Arkesel.</li>
              <li>Add the credentials to your platform settings or environment variables.</li>
            </ol>
          </div>
          <p className="text-xs italic">
            Note: Email notifications (via Resend) and in-app notifications are also fully active to keep customers informed.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function ManageBookings() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'calendar' | 'passes_report'>('list');
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [deleteConfig, setDeleteConfig] = useState<{ message: string; action: () => Promise<void> } | null>(null);

  // Booking Passes state and listener
  const [passes, setPasses] = useState<any[]>([]);
  const [passesLoading, setPassesLoading] = useState(true);
  const [passesSearch, setPassesSearch] = useState('');

  useEffect(() => {
    if (viewMode !== 'passes_report') return;
    setPassesLoading(true);
    const passesQuery = query(collection(db, 'booking_passes'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(passesQuery, (snapshot) => {
      const loadedPasses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPasses(loadedPasses);
      setPassesLoading(false);
    }, (error) => {
      console.error('Error fetching passes:', error);
      setPassesLoading(false);
    });
    return () => unsubscribe();
  }, [viewMode]);

  const handleExportCSV = () => {
    if (filteredBookings.length === 0) {
      toast.error('No bookings found matching current filters to export.');
      return;
    }

    const headers = [
      'Order Number',
      'Customer Name',
      'Customer Email',
      'Customer Phone',
      'Service Requested',
      'Appointment Date',
      'Appointment Time',
      'Status',
      'Notes',
      'Confirmation Status'
    ];

    const escapeCSV = (val: any) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      return `"${str.replace(/"/g, '""')}"`;
    };

    const csvRows = [
      headers.join(','),
      ...filteredBookings.map(b => [
        escapeCSV(b.orderNumber || 'N/A'),
        escapeCSV(b.userName || 'N/A'),
        escapeCSV(b.userEmail || 'N/A'),
        escapeCSV(b.userPhone || 'N/A'),
        escapeCSV(b.serviceTitle || 'General Consultation'),
        escapeCSV(b.date || 'N/A'),
        escapeCSV(b.time || 'N/A'),
        escapeCSV(b.status || 'N/A'),
        escapeCSV(b.notes || 'No notes'),
        escapeCSV(b.confirmationEmailStatus || 'unsent')
      ].join(','))
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `grefas_bookings_export_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filteredBookings.length} bookings to CSV!`);
  };

  const handleExportPDF = () => {
    if (filteredBookings.length === 0) {
      toast.error('No bookings found matching current filters to export.');
      return;
    }

    const reportDate = format(new Date(), 'eeee, MMMM d, yyyy h:mm a');
    const confirmedCount = filteredBookings.filter(b => b.status === 'confirmed').length;
    const pendingCount = filteredBookings.filter(b => b.status !== 'confirmed' && b.status !== 'cancelled').length;
    const cancelledCount = filteredBookings.filter(b => b.status === 'cancelled').length;

    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    document.body.appendChild(printFrame);

    const doc = printFrame.contentWindow?.document || printFrame.contentDocument;
    if (!doc) {
      toast.error('Could not initiate PDF generation.');
      return;
    }

    const bookingsHTML = filteredBookings.map(b => `
      <tr>
        <td style="font-weight: 700; font-family: sans-serif;">${b.orderNumber || 'N/A'}</td>
        <td style="font-family: sans-serif;">
          <div style="font-weight: 700; color: #111827;">${b.date}</div>
          <div style="font-weight: 600; color: #ea580c; font-size: 11px; margin-top: 2px;">${b.time || ''}</div>
        </td>
        <td style="font-family: sans-serif;">
          <div style="font-weight: 700;">${b.userName || 'N/A'}</div>
          <div style="font-size: 11px; color: #4b5563; margin-top: 1px;">
            ${b.userEmail || ''} <br/> ${b.userPhone || ''}
          </div>
        </td>
        <td style="font-family: sans-serif;">
          <div style="font-weight: 600; color: #111827;">${b.serviceTitle || 'General Consultation'}</div>
          ${b.notes ? `<div style="font-size: 11px; color: #6b7280; font-style: italic; margin-top: 4px;">"${b.notes}"</div>` : ''}
        </td>
        <td style="font-family: sans-serif;">
          <span class="status-badge status-${b.status || 'pending'}">
            ${b.status || 'pending'}
          </span>
        </td>
      </tr>
    `).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Grefas Consult - Booking Records</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
          body {
            font-family: 'Inter', system-ui, sans-serif;
            color: #111827;
            margin: 0;
            padding: 40px;
            background: #ffffff;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #ea580c;
            padding-bottom: 20px;
            margin-bottom: 24px;
          }
          .logo-text {
            font-size: 20px;
            font-weight: 800;
            color: #ea580c;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }
          .title {
            font-size: 24px;
            font-weight: 800;
            color: #111827;
            margin: 4px 0 0 0;
          }
          .subtitle {
            font-size: 12px;
            color: #4b5563;
            margin: 4px 0 0 0;
          }
          .meta-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 16px;
            margin-bottom: 24px;
            background: #f9fafb;
            padding: 16px;
            border-radius: 8px;
            border: 1px solid #e5e7eb;
          }
          .meta-item {
            display: flex;
            flex-direction: column;
          }
          .meta-label {
            font-size: 9px;
            font-weight: 700;
            text-transform: uppercase;
            color: #6b7280;
            letter-spacing: 0.05em;
          }
          .meta-value {
            font-size: 14px;
            font-weight: 800;
            color: #111827;
            margin-top: 2px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
          }
          th {
            background-color: #f3f4f6;
            border-bottom: 2px solid #e5e7eb;
            text-align: left;
            padding: 10px 12px;
            font-size: 10px;
            font-weight: 800;
            text-transform: uppercase;
            color: #374151;
            letter-spacing: 0.05em;
          }
          td {
            padding: 12px 12px;
            border-bottom: 1px solid #e5e7eb;
            font-size: 11.5px;
            vertical-align: top;
            line-height: 1.4;
          }
          tr:nth-child(even) {
            background-color: #f9fafb;
          }
          .status-badge {
            display: inline-block;
            padding: 2px 8px;
            font-size: 9px;
            font-weight: 800;
            text-transform: uppercase;
            border-radius: 9999px;
            text-align: center;
          }
          .status-confirmed {
            background-color: #d1fae5;
            color: #065f46;
          }
          .status-cancelled {
            background-color: #fee2e2;
            color: #991b1b;
          }
          .status-pending {
            background-color: #ffedd5;
            color: #9a3412;
          }
          @page {
            size: auto;
            margin: 15mm;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="logo-text">Grefas Consult & Entertainment</div>
            <div class="title">Booking Summary Report</div>
            <div class="subtitle">Export of clients, dates, schedules, and active bookings matching search criteria.</div>
          </div>
          <div style="text-align: right; font-size: 11px; color: #6b7280; font-family: sans-serif;">
            <div><strong>Report Generated:</strong></div>
            <div>${reportDate}</div>
          </div>
        </div>

        <div class="meta-grid">
          <div class="meta-item">
            <span class="meta-label">Total Bookings</span>
            <span class="meta-value">${filteredBookings.length}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Confirmed</span>
            <span class="meta-value" style="color: #059669;">${confirmedCount}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Pending</span>
            <span class="meta-value" style="color: #ea580c;">${pendingCount}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Cancelled</span>
            <span class="meta-value" style="color: #dc2626;">${cancelledCount}</span>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 12%;">Order ID</th>
              <th style="width: 18%;">Schedule</th>
              <th style="width: 25%;">Client</th>
              <th style="width: 33%;">Service Details</th>
              <th style="width: 12%;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${bookingsHTML}
          </tbody>
        </table>

        <div style="margin-top: 60px; display: flex; justify-content: space-between; page-break-inside: avoid; font-family: sans-serif;">
          <div>
            <div style="border-top: 2px solid #374151; width: 320px; text-align: center; padding-top: 6px; font-weight: 700; font-size: 10px; text-transform: uppercase;">CEO / General Manager / Secretary / Admin Signature</div>
            <div style="font-size: 10px; color: #6b7280; text-align: center; margin-top: 4px;">Grefas Executive Office</div>
          </div>
          <div style="text-align: right;">
            <div style="border-top: 2px solid #374151; width: 160px; text-align: center; padding-top: 6px; font-weight: 700; font-size: 11px; text-transform: uppercase;">Date</div>
            <div style="font-size: 10px; color: #6b7280; text-align: center; margin-top: 4px;">${new Date().toLocaleDateString()}</div>
          </div>
        </div>
      </body>
      </html>
    `;

    doc.open();
    doc.write(htmlContent);
    doc.close();

    setTimeout(() => {
      try {
        printFrame.contentWindow?.focus();
        printFrame.contentWindow?.print();
      } catch (e) {
        console.error("Failed to print directly:", e);
        toast.error("Failed to open print PDF preview. Check pop-up blockers.");
      } finally {
        setTimeout(() => {
          document.body.removeChild(printFrame);
        }, 1000);
      }
    }, 1000);

    toast.success("Preparing PDF document report for printing...");
  };

  const handlePrintBookingPass = async (booking: any) => {
    try {
      const currentUser = auth.currentUser;
      const genEmail = currentUser?.email || 'unknown';
      let genName = 'System';
      if (currentUser) {
        const uSnap = await getDoc(doc(db, 'users', currentUser.uid));
        if (uSnap.exists()) {
          genName = uSnap.data().fullName || currentUser.displayName || genEmail;
        } else {
          genName = currentUser.displayName || genEmail;
        }
      }

      // Add record to Firestore booking_passes collection
      await addDoc(collection(db, 'booking_passes'), {
        bookingId: booking.id || 'N/A',
        orderNumber: booking.orderNumber || 'N/A',
        userName: booking.userName || 'N/A',
        userEmail: booking.userEmail || 'N/A',
        serviceTitle: booking.serviceTitle || 'General Consultation',
        generatedByEmail: genEmail,
        generatedByName: genName,
        timestamp: new Date().toISOString()
      });

      // Also create an audit log entry
      await addDoc(collection(db, 'activity_logs'), {
        userId: currentUser?.uid || null,
        userEmail: genEmail,
        userName: genName,
        type: 'booking_pass_generation',
        description: `Booking pass generated/printed for order ${booking.orderNumber || booking.id} by ${genName}`,
        createdAt: new Date().toISOString()
      });

      toast.success('Logging booking pass generation...');

      // Trigger standard print view in an iframe for the booking pass!
      const printFrame = document.createElement('iframe');
      printFrame.style.position = 'fixed';
      printFrame.style.right = '0';
      printFrame.style.bottom = '0';
      printFrame.style.width = '0';
      printFrame.style.height = '0';
      printFrame.style.border = '0';
      document.body.appendChild(printFrame);

      const docRef = printFrame.contentWindow?.document || printFrame.contentDocument;
      if (!docRef) {
        toast.error('Could not initiate Booking Pass printing.');
        return;
      }

      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(booking.orderNumber || booking.id)}`;

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Reservation Pass - ${booking.orderNumber || 'N/A'}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
            body {
              font-family: 'Inter', sans-serif;
              color: #111827;
              padding: 40px;
              background: #ffffff;
            }
            .pass-card {
              max-width: 600px;
              margin: 0 auto;
              border: 2px dashed #ea580c;
              border-radius: 16px;
              padding: 24px;
              background-color: #fff;
            }
            .header {
              display: flex;
              justify-content: space-between;
              border-bottom: 2px solid #f3f4f6;
              padding-bottom: 16px;
              margin-bottom: 20px;
            }
            .logo-text {
              font-size: 16px;
              font-weight: 800;
              color: #ea580c;
              text-transform: uppercase;
            }
            .pass-title {
              font-size: 10px;
              font-weight: 700;
              text-transform: uppercase;
              color: #9ca3af;
              letter-spacing: 0.05em;
              text-align: right;
            }
            .order-section {
              display: flex;
              justify-content: space-between;
              background-color: #fff7ed;
              border: 1px solid #ffedd5;
              padding: 16px;
              border-radius: 12px;
              margin-bottom: 20px;
            }
            .order-label {
              font-size: 9px;
              text-transform: uppercase;
              font-weight: 700;
              color: #ea580c;
            }
            .order-val {
              font-size: 28px;
              font-weight: 900;
              color: #ea580c;
              letter-spacing: 0.1em;
            }
            .grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 20px;
              margin-bottom: 20px;
            }
            .grid-box {
              border: 1px solid #e5e7eb;
              border-radius: 12px;
              padding: 16px;
            }
            .box-title {
              font-size: 11px;
              text-transform: uppercase;
              color: #9ca3af;
              font-weight: 800;
              margin: 0 0 10px 0;
            }
            .box-text {
              font-size: 13px;
              margin: 4px 0;
            }
            .notes-box {
              border: 1px solid #e5e7eb;
              border-radius: 12px;
              padding: 16px;
              margin-bottom: 20px;
              background-color: #fafafa;
            }
            .footer {
              font-size: 10px;
              color: #9ca3af;
              text-align: center;
              border-top: 1px solid #e5e7eb;
              padding-top: 12px;
              margin-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="pass-card">
            <div class="header">
              <div>
                <div class="logo-text">Grefas Consult</div>
                <div style="font-size: 11px; color: #4b5563;">Official Validation Ticket</div>
              </div>
              <div class="pass-title">
                Reservation Pass <br/>
                <strong style="color: #111827; font-size: 12px;">${booking.date || 'N/A'}</strong>
              </div>
            </div>

            <div class="order-section">
              <div>
                <span class="order-label">Unique Reference Code</span>
                <div class="order-val">${booking.orderNumber || 'N/A'}</div>
                <p style="font-size: 11px; color: #6b7280; margin: 4px 0 0 0;">Please keep this reference for verification.</p>
              </div>
              <div>
                <img src="${qrUrl}" style="width: 80px; height: 80px; display: block;" alt="QR" />
              </div>
            </div>

            <div class="grid">
              <div class="grid-box">
                <h4 class="box-title">Client Details</h4>
                <p class="box-text"><strong>Name:</strong> ${booking.userName || 'N/A'}</p>
                <p class="box-text"><strong>Email:</strong> ${booking.userEmail || 'N/A'}</p>
                <p class="box-text"><strong>Phone:</strong> ${booking.userPhone || 'N/A'}</p>
              </div>
              <div class="grid-box">
                <h4 class="box-title">Service Details</h4>
                <p class="box-text"><strong>Service:</strong> ${booking.serviceTitle || 'General Consultation'}</p>
                <p class="box-text"><strong>Time Slot:</strong> ${booking.time || 'N/A'}</p>
                <p class="box-text"><strong>Specialist:</strong> ${booking.teamMemberName || 'General Staff'}</p>
              </div>
            </div>

            ${booking.notes ? `
              <div class="notes-box">
                <h4 class="box-title">Client Notes</h4>
                <p class="box-text" style="font-style: italic;">"${booking.notes}"</p>
              </div>
            ` : ''}

            <div class="footer">
              Thank you for choosing Grefas Consult & Entertainment. Generated on ${new Date().toLocaleString()}
            </div>
          </div>
        </body>
        </html>
      `;

      docRef.open();
      docRef.write(htmlContent);
      docRef.close();

      setTimeout(() => {
        try {
          printFrame.contentWindow?.focus();
          printFrame.contentWindow?.print();
        } catch (e) {
          console.error("Print fail", e);
        } finally {
          setTimeout(() => {
            document.body.removeChild(printFrame);
          }, 1000);
        }
      }, 500);

    } catch (err) {
      console.error(err);
      toast.error('Failed to generate or log booking pass.');
    }
  };

  const handleExportPassesCSV = (passesToExport: any[]) => {
    if (passesToExport.length === 0) {
      toast.error('No passes found to export.');
      return;
    }
    const headers = ['Timestamp', 'Reference Code', 'Client Name', 'Client Email', 'Service', 'Generated By (Name)', 'Generated By (Email)'];
    const rows = passesToExport.map(p => [
      p.timestamp ? new Date(p.timestamp).toLocaleString() : 'N/A',
      p.orderNumber || 'N/A',
      p.userName || 'N/A',
      p.userEmail || 'N/A',
      p.serviceTitle || 'General Consultation',
      p.generatedByName || 'N/A',
      p.generatedByEmail || 'N/A'
    ]);
    
    const csvContent = [
      headers.join(','), 
      ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `booking_passes_report_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Successfully exported passes report to CSV!');
  };

  const handleExportPassesPDF = (passesToExport: any[]) => {
    if (passesToExport.length === 0) {
      toast.error('No passes found to export.');
      return;
    }
    const reportDate = format(new Date(), 'MMMM d, yyyy HH:mm');
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    document.body.appendChild(printFrame);

    const docRef = printFrame.contentWindow?.document || printFrame.contentDocument;
    if (!docRef) {
      toast.error('Failed to initialize print process.');
      return;
    }

    const rowsHtml = passesToExport.map((p, idx) => `
      <tr style="border-bottom: 1px solid #e5e7eb; font-size: 11px;">
        <td style="padding: 10px; color: #6b7280;">${idx + 1}</td>
        <td style="padding: 10px; font-weight: 600;">${p.orderNumber || 'N/A'}</td>
        <td style="padding: 10px;">${p.userName || 'N/A'}<br/><span style="color:#9ca3af; font-size:10px;">${p.userEmail || 'N/A'}</span></td>
        <td style="padding: 10px;">${p.serviceTitle || 'General Consultation'}</td>
        <td style="padding: 10px;">${p.generatedByName || 'N/A'}<br/><span style="color:#9ca3af; font-size:10px;">${p.generatedByEmail || 'N/A'}</span></td>
        <td style="padding: 10px; color: #4b5563;">${p.timestamp ? new Date(p.timestamp).toLocaleString() : 'N/A'}</td>
      </tr>
    `).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Generated Booking Passes Report</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
          body {
            font-family: 'Inter', sans-serif;
            padding: 40px;
            color: #111827;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            border-bottom: 3px solid #ea580c;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .title {
            font-size: 24px;
            font-weight: 800;
            color: #ea580c;
            text-transform: uppercase;
            margin: 0;
          }
          .subtitle {
            font-size: 12px;
            color: #4b5563;
            margin-top: 4px;
          }
          .meta-info {
            text-align: right;
            font-size: 11px;
            color: #6b7280;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
          }
          th {
            background-color: #f9fafb;
            color: #374151;
            font-weight: 700;
            text-align: left;
            padding: 12px 10px;
            font-size: 11px;
            text-transform: uppercase;
            border-bottom: 2px solid #e5e7eb;
          }
          .footer {
            margin-top: 40px;
            border-top: 1px solid #e5e7eb;
            padding-top: 15px;
            text-align: center;
            font-size: 10px;
            color: #9ca3af;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="title">Booking Passes Report</h1>
            <p class="subtitle">Official audit log of all generated/printed guest reservation tickets</p>
          </div>
          <div class="meta-info">
            <strong>Run Date:</strong> ${reportDate}<br/>
            <strong>Total Passes:</strong> ${passesToExport.length}
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 40px;">#</th>
              <th>Ref Code</th>
              <th>Client Details</th>
              <th>Requested Service</th>
              <th>Authorized Generator</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div class="footer">
          Grefas Consult & Entertainment Administration Dashboard. Confidential.
        </div>
      </body>
      </html>
    `;

    docRef.open();
    docRef.write(htmlContent);
    docRef.close();

    setTimeout(() => {
      try {
        printFrame.contentWindow?.focus();
        printFrame.contentWindow?.print();
      } catch (e) {
        console.error("Print fail", e);
        toast.error("Failed to print passes report.");
      } finally {
        setTimeout(() => {
          document.body.removeChild(printFrame);
        }, 1000);
      }
    }, 1000);

    toast.success("Preparing PDF document report for printing...");
  };

  const renderBookingPassesReportView = () => {
    const filteredPasses = passes.filter(p => {
      const s = passesSearch.trim().toLowerCase();
      if (!s) return true;
      return (p.orderNumber || '').toLowerCase().includes(s) ||
             (p.userName || '').toLowerCase().includes(s) ||
             (p.userEmail || '').toLowerCase().includes(s) ||
             (p.serviceTitle || '').toLowerCase().includes(s) ||
             (p.generatedByName || '').toLowerCase().includes(s) ||
             (p.generatedByEmail || '').toLowerCase().includes(s);
    });

    return (
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6">
          <div>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Ticket className="h-5 w-5 text-orange-600 animate-pulse" />
              Booking Pass Generation Logs
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Audit log of all printed reservation tickets and passes generated by admins, managers, or CEOs.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExportPassesCSV(filteredPasses)}
              disabled={filteredPasses.length === 0}
              className="text-xs font-bold gap-1.5 border-border hover:bg-muted text-foreground h-9"
            >
              <FileSpreadsheet className="h-4 w-4 text-green-600" />
              Export CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExportPassesPDF(filteredPasses)}
              disabled={filteredPasses.length === 0}
              className="text-xs font-bold gap-1.5 border-border hover:bg-muted text-foreground h-9"
            >
              <FileText className="h-4 w-4 text-red-500" />
              Export PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Filter passes by reference code, client name/email, service, or issuer..."
              value={passesSearch}
              onChange={(e) => setPassesSearch(e.target.value)}
              className="pl-9 bg-muted/40 border-border text-sm text-foreground focus-visible:ring-orange-600 focus-visible:border-orange-600"
            />
          </div>

          {passesLoading ? (
            <div className="py-20 text-center text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-orange-600 mx-auto mb-2" />
              Loading pass generation records...
            </div>
          ) : filteredPasses.length === 0 ? (
            <div className="py-20 text-center text-muted-foreground border border-dashed rounded-xl border-border bg-muted/5">
              <Ticket className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-semibold text-foreground">No records found</p>
              <p className="text-xs text-muted-foreground mt-1">There are no booking pass generation logs matching your criteria.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    <th className="p-4 font-bold text-foreground">Reference Code</th>
                    <th className="p-4 font-bold text-foreground">Client Details</th>
                    <th className="p-4 font-bold text-foreground">Service</th>
                    <th className="p-4 font-bold text-foreground">Generated By</th>
                    <th className="p-4 font-bold text-foreground">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredPasses.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/10 transition-colors">
                      <td className="p-4 font-bold text-foreground">
                        <span className="text-orange-600 bg-orange-600/10 px-2 py-0.5 rounded-md border border-orange-600/20 text-xs">
                          {p.orderNumber || 'N/A'}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="font-semibold text-foreground">{p.userName || 'N/A'}</div>
                        <div className="text-xs text-muted-foreground">{p.userEmail || 'N/A'}</div>
                      </td>
                      <td className="p-4 text-foreground">{p.serviceTitle || 'General Consultation'}</td>
                      <td className="p-4">
                        <div className="font-semibold text-foreground">{p.generatedByName || 'N/A'}</div>
                        <div className="text-xs text-muted-foreground">{p.generatedByEmail || 'N/A'}</div>
                      </td>
                      <td className="p-4 text-muted-foreground text-xs font-mono">
                        {p.timestamp ? new Date(p.timestamp).toLocaleString() : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const handleGenerateInvoicePDF = (booking: any) => {
    const reportDate = format(new Date(), 'MMMM d, yyyy');
    const invoiceNumber = booking.orderNumber || `INV-${Math.floor(100000 + Math.random() * 900000)}`;
    
    // Compute pricing based on service name
    const serviceName = booking.serviceTitle || 'General Consultation';
    const basePrice = serviceName.toLowerCase().includes('entertainment') ? 1200 : 450;
    const vat = parseFloat((basePrice * 0.15).toFixed(2));
    const total = basePrice + vat;

    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    document.body.appendChild(printFrame);

    const doc = printFrame.contentWindow?.document || printFrame.contentDocument;
    if (!doc) {
      toast.error('Could not initiate Invoice PDF generation.');
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice - ${invoiceNumber}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
          body {
            font-family: 'Inter', system-ui, sans-serif;
            color: #1f2937;
            margin: 0;
            padding: 50px;
            background: #ffffff;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .invoice-container {
            max-width: 800px;
            margin: 0 auto;
            border: 1px solid #e5e7eb;
            padding: 40px;
            border-radius: 12px;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #ea580c;
            padding-bottom: 25px;
            margin-bottom: 30px;
          }
          .logo-area h1 {
            margin: 0;
            font-size: 26px;
            font-weight: 800;
            color: #ea580c;
            letter-spacing: -0.05em;
          }
          .logo-area p {
            margin: 4px 0 0 0;
            font-size: 11px;
            color: #6b7280;
            text-transform: uppercase;
            font-weight: 700;
            letter-spacing: 0.1em;
          }
          .invoice-title-area {
            text-align: right;
          }
          .invoice-title-area h2 {
            margin: 0;
            font-size: 20px;
            font-weight: 800;
            color: #111827;
            letter-spacing: -0.02em;
          }
          .invoice-title-area p {
            margin: 5px 0 0 0;
            font-size: 13px;
            color: #4b5563;
          }
          .details-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 40px;
            margin-bottom: 40px;
          }
          .details-block h3 {
            margin: 0 0 10px 0;
            font-size: 11px;
            text-transform: uppercase;
            color: #ea580c;
            font-weight: 800;
            letter-spacing: 0.05em;
          }
          .details-block p {
            margin: 4px 0;
            font-size: 13px;
            line-height: 1.5;
            color: #374151;
          }
          .details-block .name {
            font-weight: 700;
            font-size: 15px;
            color: #111827;
          }
          .invoice-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
          }
          .invoice-table th {
            background-color: #f9fafb;
            border-bottom: 1px solid #e5e7eb;
            text-align: left;
            padding: 12px 16px;
            font-size: 11px;
            text-transform: uppercase;
            font-weight: 700;
            color: #4b5563;
          }
          .invoice-table td {
            padding: 16px;
            border-bottom: 1px solid #f3f4f6;
            font-size: 13px;
            color: #111827;
          }
          .totals-section {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 40px;
          }
          .totals-table {
            width: 280px;
          }
          .totals-table tr td {
            padding: 8px 12px;
            font-size: 13px;
          }
          .totals-table tr.total-row td {
            font-weight: 800;
            font-size: 16px;
            color: #ea580c;
            border-top: 1px solid #e5e7eb;
            padding-top: 12px;
          }
          .footer {
            text-align: center;
            border-top: 1px solid #f3f4f6;
            padding-top: 20px;
            margin-top: 40px;
            font-size: 11px;
            color: #9ca3af;
            line-height: 1.6;
          }
          .status-stamp {
            display: inline-block;
            border: 3px double #059669;
            color: #059669;
            font-size: 14px;
            font-weight: 900;
            text-transform: uppercase;
            padding: 6px 15px;
            border-radius: 4px;
            transform: rotate(-5deg);
            margin-top: 10px;
          }
        </style>
      </head>
      <body>
        <div class="invoice-container">
          <div class="header">
            <div class="logo-area">
              <h1>GREFAS CONSULT</h1>
              <p>Consult & Entertainment Group</p>
            </div>
            <div class="invoice-title-area">
              <h2>DIGITAL INVOICE</h2>
              <p><strong>Invoice No:</strong> ${invoiceNumber}</p>
              <p><strong>Date Issued:</strong> ${reportDate}</p>
              <div class="status-stamp">APPROVED & SECURED</div>
            </div>
          </div>

          <div class="details-grid">
            <div class="details-block">
              <h3>Billed To (Client):</h3>
              <p class="name">${booking.userName || 'Valued Client'}</p>
              <p><strong>Email:</strong> ${booking.userEmail || 'N/A'}</p>
              <p><strong>Phone:</strong> ${booking.userPhone || 'N/A'}</p>
            </div>
            <div class="details-block">
              <h3>Service Details:</h3>
              <p><strong>Requested:</strong> ${serviceName}</p>
              <p><strong>Schedule Date:</strong> ${booking.date}</p>
              <p><strong>Schedule Time:</strong> ${booking.time || 'General Business Hours'}</p>
              ${booking.teamMemberName ? `<p><strong>Assigned Consultant:</strong> ${booking.teamMemberName}</p>` : ''}
            </div>
          </div>

          <table class="invoice-table">
            <thead>
              <tr>
                <th style="width: 60%;">Service Description</th>
                <th style="width: 20%; text-align: right;">Unit Rate</th>
                <th style="width: 20%; text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <strong>${serviceName}</strong><br/>
                  <span style="font-size: 11px; color: #6b7280;">Secure professional booking fee and consultation arrangement</span>
                </td>
                <td style="text-align: right;">GHS ${basePrice.toFixed(2)}</td>
                <td style="text-align: right;">GHS ${basePrice.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>

          <div class="totals-section">
            <table class="totals-table">
              <tr>
                <td style="color: #6b7280;">Subtotal:</td>
                <td style="text-align: right; font-weight: 600;">GHS ${basePrice.toFixed(2)}</td>
              </tr>
              <tr>
                <td style="color: #6b7280;">VAT (15%):</td>
                <td style="text-align: right; font-weight: 600;">GHS ${vat.toFixed(2)}</td>
              </tr>
              <tr class="total-row">
                <td>Total Due:</td>
                <td style="text-align: right;">GHS ${total.toFixed(2)}</td>
              </tr>
            </table>
          </div>

          <div style="margin-top: 50px; margin-bottom: 30px; display: flex; justify-content: space-between; page-break-inside: avoid; font-family: sans-serif;">
            <div>
              <div style="border-top: 2px solid #ea580c; width: 320px; text-align: center; padding-top: 6px; font-weight: 700; font-size: 10px; text-transform: uppercase; color: #111827;">CEO / General Manager / Secretary / Admin Signature</div>
              <div style="font-size: 10px; color: #6b7280; text-align: center; margin-top: 4px;">Grefas Authorized Representative</div>
            </div>
            <div style="text-align: right;">
              <div style="border-top: 2px solid #ea580c; width: 160px; text-align: center; padding-top: 6px; font-weight: 700; font-size: 11px; text-transform: uppercase; color: #111827;">Date</div>
              <div style="font-size: 10px; color: #6b7280; text-align: center; margin-top: 4px;">${reportDate}</div>
            </div>
          </div>

          <div class="footer">
            <p>Thank you for choosing Grefas Consult & Entertainment!</p>
            <p>For inquiries or adjustments, please email us at <strong>support@grefas.com</strong> or call Grefas Support desk.</p>
            <p style="font-size: 9px; color: #d1d5db; margin-top: 15px;">This is a digitally generated invoice issued upon approval of the booking request. No physical signature is required.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    doc.open();
    doc.write(htmlContent);
    doc.close();

    setTimeout(() => {
      try {
        printFrame.contentWindow?.focus();
        printFrame.contentWindow?.print();
      } catch (e) {
        console.error("Failed to print directly:", e);
        toast.error("Failed to open print PDF preview. Check pop-up blockers.");
      } finally {
        setTimeout(() => {
          document.body.removeChild(printFrame);
        }, 1000);
      }
    }, 1000);

    toast.success("Preparing digital invoice PDF...");
  };

  useEffect(() => {
    const q = query(collection(db, 'bookings'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setBookings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'bookings');
    });
    return () => unsubscribe();
  }, []);

  const handleSendConfirmationEmail = async (booking: any) => {
    try {
      const bookingRef = doc(db, 'bookings', booking.id);
      
      const response = await fetch('/api/notify-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: booking.userEmail,
          phone: booking.userPhone,
          userName: booking.userName,
          serviceTitle: booking.serviceTitle || 'General Consultation',
          date: booking.date,
          time: booking.time,
          orderNumber: booking.orderNumber,
          teamMemberName: booking.teamMemberName,
          notes: booking.notes,
          serviceDescription: booking.serviceDescription || booking.description || ''
        })
      });
      
      const result = await response.json();
      const emailSent = result.results?.email === 'sent';
      
      await setDoc(bookingRef, { 
        confirmationEmailStatus: emailSent ? 'sent' : 'failed' 
      }, { merge: true });

      if (emailSent) {
        toast.success(`Confirmation email sent successfully to ${booking.userEmail}!`);
      } else {
        toast.error("Failed to send confirmation email. Please check if your RESEND_API_KEY is configured correctly.");
      }

      if (result.results?.sms && result.results.sms.startsWith("failed")) {
        const errorMsg = `Booking confirmed, but SMS alert failed: ${result.results.sms}`;
        toast.warning(errorMsg);
      }
    } catch (error) {
      console.error("Failed to send confirmation email manual:", error);
      toast.error("Failed to send confirmation email.");
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const bookingRef = doc(db, 'bookings', id);
      await setDoc(bookingRef, { status: newStatus }, { merge: true });
      
      const bookingSnap = await getDoc(bookingRef);
      const bookingData = bookingSnap.exists() ? bookingSnap.data() : {};

      // Audit Log write
      const currentUser = auth.currentUser;
      if (currentUser) {
        const uSnap = await getDoc(doc(db, 'users', currentUser.uid));
        const uData = uSnap.exists() ? uSnap.data() : {};
        const uName = uData.fullName || currentUser.displayName || currentUser.email || 'Administrator';
        const uRole = uData.role || 'admin';

        await addDoc(collection(db, 'activity_logs'), {
          userId: currentUser.uid,
          userEmail: currentUser.email,
          userName: uName,
          type: 'booking_change',
          description: `Booking status for order ${bookingData.orderNumber || id} (Client: ${bookingData.userName || 'N/A'}) updated to '${newStatus}' by ${uName} (${uRole})`,
          createdAt: new Date().toISOString()
        });
      }

      // Notify the user if confirmed or cancelled
      if (newStatus === 'confirmed' || newStatus === 'cancelled') {
        if (bookingSnap.exists()) {
          // 1. In-app notification
          if (bookingData.userId && bookingData.userId !== 'anonymous') {
            const title = newStatus === 'confirmed' ? 'Booking Confirmed!' : 'Booking Cancelled';
            const orderRef = bookingData.orderNumber ? ` (${bookingData.orderNumber})` : '';
            const message = newStatus === 'confirmed' 
              ? `Your booking${orderRef} for ${bookingData.serviceTitle || 'General Consultation'} on ${bookingData.date} has been confirmed.`
              : `Your booking${orderRef} for ${bookingData.serviceTitle || 'General Consultation'} on ${bookingData.date} has been cancelled. Please contact us for more information.`;

            await addDoc(collection(db, 'notifications'), {
              userId: bookingData.userId,
              title,
              message,
              orderNumber: bookingData.orderNumber || null,
              read: false,
              createdAt: serverTimestamp()
            });
          }

          // 2. Email and SMS notification via backend (only for confirmation in this example)
          if (newStatus === 'confirmed') {
            try {
              const response = await fetch('/api/notify-confirmation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  email: bookingData.userEmail,
                  phone: bookingData.userPhone,
                  userName: bookingData.userName,
                  serviceTitle: bookingData.serviceTitle || 'General Consultation',
                  date: bookingData.date,
                  time: bookingData.time,
                  orderNumber: bookingData.orderNumber,
                  teamMemberName: bookingData.teamMemberName,
                  notes: bookingData.notes,
                  serviceDescription: bookingData.serviceDescription || bookingData.description || ''
                })
              });
              
              const result = await response.json();
              const emailSent = result.results?.email === 'sent';
              
              await setDoc(bookingRef, { 
                confirmationEmailStatus: emailSent ? 'sent' : 'failed' 
              }, { merge: true });

              if (result.results?.sms && result.results.sms.startsWith("failed")) {
                let errorMsg = `Booking confirmed, but SMS failed: ${result.results.sms}`;
                if (result.results.sms.includes("Invalid Phone Number")) {
                   errorMsg = "Booking confirmed, but SMS failed due to an invalid phone number format.";
                }
                
                toast.warning(errorMsg, { duration: 8000 });
              }
            } catch (error) {
              console.error("Failed to send external notifications:", error);
            }
          }
        }
      }
      
      toast.success(`Booking ${newStatus}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `bookings/${id}`);
    }
  };

  const handleSendReminder = async (booking: any) => {
    try {
      // Try to load booking_reminder template from Firestore for custom SMS alert
      let customSmsMessage = undefined;
      try {
        const templatesSnapshot = await getDocs(query(collection(db, 'sms_templates'), where('name', '==', 'booking_reminder')));
        if (!templatesSnapshot.empty) {
          const tplData = templatesSnapshot.docs[0].data();
          if (tplData && tplData.content) {
            customSmsMessage = tplData.content
              .replace(/{name}/g, booking.userName)
              .replace(/{service}/g, booking.serviceTitle || 'General Consultation')
              .replace(/{date}/g, booking.date)
              .replace(/{time}/g, booking.time || 'scheduled time')
              .replace(/{orderNumber}/g, booking.orderNumber || 'N/A');
          }
        }
      } catch (err) {
        console.warn("Failed to fetch booking_reminder template, falling back to default SMS.", err);
      }

      const response = await fetch('/api/notify-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: booking.userEmail,
          phone: booking.userPhone,
          userName: booking.userName,
          serviceTitle: booking.serviceTitle || 'General Consultation',
          date: booking.time ? `${booking.date} at ${booking.time}` : booking.date,
          customMessage: customSmsMessage
        })
      });

      const result = await response.json();
      
      // Also add an in-app notification
      if (booking.userId && booking.userId !== 'anonymous') {
        await addDoc(collection(db, 'notifications'), {
          userId: booking.userId,
          title: 'Booking Reminder',
          message: `This is a reminder for your booking: ${booking.serviceTitle || 'General Consultation'} on ${booking.date}. We look forward to seeing you!`,
          read: false,
          createdAt: serverTimestamp()
        });
      }

      if (result.results?.sms && result.results.sms.startsWith("failed")) {
        const errorMsg = `Reminder sent via email, but SMS failed: ${result.results.sms}`;
        toast.warning(errorMsg, { duration: 8000 });
      } else {
        toast.success("Reminder sent successfully!");
      }
    } catch (error) {
      console.error("Failed to send reminder:", error);
      toast.error("Failed to send reminder.");
    }
  };

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = (id: string) => {
    setDeleteConfig({
      message: 'Are you sure you want to delete this booking request? This action is completely permanent and cannot be undone.',
      action: async () => {
        setDeletingId(id);
        try {
          const bookingSnap = await getDoc(doc(db, 'bookings', id));
          const bookingData = bookingSnap.exists() ? bookingSnap.data() : {};

          await deleteDoc(doc(db, 'bookings', id));
          setSelectedIds(prev => prev.filter(item => item !== id));
          toast.success('Booking deleted');

          // Log deletion in audit logs
          const currentUser = auth.currentUser;
          if (currentUser) {
            const uSnap = await getDoc(doc(db, 'users', currentUser.uid));
            const uData = uSnap.exists() ? uSnap.data() : {};
            const uName = uData.fullName || currentUser.displayName || currentUser.email || 'Administrator';
            const uRole = uData.role || 'admin';

            await addDoc(collection(db, 'activity_logs'), {
              userId: currentUser.uid,
              userEmail: currentUser.email,
              userName: uName,
              type: 'booking_change',
              description: `Booking request for order ${bookingData.orderNumber || id} (Client: ${bookingData.userName || 'N/A'}) was DELETED by ${uName} (${uRole})`,
              createdAt: new Date().toISOString()
            });
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `bookings/${id}`);
        } finally {
          setDeletingId(null);
        }
      }
    });
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const filteredBookings = bookings.filter((booking) => {
    const searchLower = searchTerm.trim().toLowerCase();
    if (!searchLower) return true;
    
    const orderNumber = String(booking.orderNumber || '').toLowerCase();
    const userName = String(booking.userName || '').toLowerCase();
    const userEmail = String(booking.userEmail || '').toLowerCase();
    const serviceTitle = String(booking.serviceTitle || '').toLowerCase();

    return orderNumber.includes(searchLower) || 
           userName.includes(searchLower) || 
           userEmail.includes(searchLower) || 
           serviceTitle.includes(searchLower);
  });

  const handleSelectAllFiltered = () => {
    const allFilteredIds = filteredBookings.map(b => b.id);
    if (allFilteredIds.length === 0) return;
    
    const areAllSelected = allFilteredIds.every(id => selectedIds.includes(id));

    if (areAllSelected) {
      setSelectedIds(prev => prev.filter(id => !allFilteredIds.includes(id)));
    } else {
      setSelectedIds(prev => {
        const unique = new Set([...prev, ...allFilteredIds]);
        return Array.from(unique);
      });
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    setDeleteConfig({
      message: `Are you sure you want to delete the ${selectedIds.length} selected booking(s)? This action is permanent and cannot be undone.`,
      action: async () => {
        setIsBulkDeleting(true);
        let successCount = 0;
        try {
          await Promise.all(selectedIds.map(async (id) => {
            await deleteDoc(doc(db, 'bookings', id));
            successCount++;
          }));
          toast.success(`Successfully deleted ${successCount} booking(s).`);
          setSelectedIds([]);

          // Log bulk deletion in audit logs
          const currentUser = auth.currentUser;
          if (currentUser) {
            const uSnap = await getDoc(doc(db, 'users', currentUser.uid));
            const uData = uSnap.exists() ? uSnap.data() : {};
            const uName = uData.fullName || currentUser.displayName || currentUser.email || 'Administrator';
            const uRole = uData.role || 'admin';

            await addDoc(collection(db, 'activity_logs'), {
              userId: currentUser.uid,
              userEmail: currentUser.email,
              userName: uName,
              type: 'booking_change',
              description: `Bulk deleted ${successCount} booking request(s) by ${uName} (${uRole})`,
              createdAt: new Date().toISOString()
            });
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `bookings (bulk)`);
        } finally {
          setIsBulkDeleting(false);
        }
      }
    });
  };

  const handleDeleteAll = () => {
    if (bookings.length === 0) {
      toast.error('No bookings to delete.');
      return;
    }
    setDeleteConfig({
      message: `Are you sure you want to delete ALL ${bookings.length} booking request(s)? This action is completely irreversible!`,
      action: async () => {
        setIsBulkDeleting(true);
        let successCount = 0;
        try {
          await Promise.all(bookings.map(async (b) => {
            await deleteDoc(doc(db, 'bookings', b.id));
            successCount++;
          }));
          toast.success(`Successfully deleted all ${successCount} booking(s).`);
          setSelectedIds([]);

          // Log delete all in audit logs
          const currentUser = auth.currentUser;
          if (currentUser) {
            const uSnap = await getDoc(doc(db, 'users', currentUser.uid));
            const uData = uSnap.exists() ? uSnap.data() : {};
            const uName = uData.fullName || currentUser.displayName || currentUser.email || 'Administrator';
            const uRole = uData.role || 'admin';

            await addDoc(collection(db, 'activity_logs'), {
              userId: currentUser.uid,
              userEmail: currentUser.email,
              userName: uName,
              type: 'booking_change',
              description: `Deleted ALL ${successCount} booking request(s) in a single wipeout action by ${uName} (${uRole})`,
              createdAt: new Date().toISOString()
            });
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `bookings (all)`);
        } finally {
          setIsBulkDeleting(false);
        }
      }
    });
  };

  if (loading) return <Loader2 className="h-8 w-8 animate-spin text-orange-600 mx-auto" />;

  const isAllFilteredSelected = filteredBookings.length > 0 && 
    filteredBookings.map(b => b.id).every(id => selectedIds.includes(id));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Manage Bookings</h1>
          <p className="text-sm text-muted-foreground">Search, schedule, and oversee client appointments and orders.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Export actions */}
          <div className="flex items-center gap-1.5 bg-card px-2 py-1 rounded-lg border border-border shrink-0">
            <span className="text-xs font-bold text-muted-foreground px-1.5 uppercase tracking-wider">Export:</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={filteredBookings.length === 0}
              className="text-xs gap-1.5 h-8 font-bold border-border hover:bg-muted text-foreground"
            >
              <FileSpreadsheet className="h-4 w-4 text-green-600" />
              CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPDF}
              disabled={filteredBookings.length === 0}
              className="text-xs gap-1.5 h-8 font-bold border-border hover:bg-muted text-foreground"
            >
              <FileText className="h-4 w-4 text-red-500" />
              PDF Report
            </Button>
          </div>

          {/* Toggle View Mode */}
          <div className="flex items-center gap-1 bg-muted p-1 rounded-lg border border-border shrink-0">
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className={`text-xs gap-1.5 h-8 font-semibold ${viewMode === 'list' ? 'bg-orange-600 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <List className="h-4 w-4" />
              List View
            </Button>
            <Button
              variant={viewMode === 'calendar' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('calendar')}
              className={`text-xs gap-1.5 h-8 font-semibold ${viewMode === 'calendar' ? 'bg-orange-600 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Grid className="h-4 w-4" />
              Calendar View
            </Button>
            <Button
              variant={viewMode === 'passes_report' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('passes_report')}
              className={`text-xs gap-1.5 h-8 font-semibold ${viewMode === 'passes_report' ? 'bg-orange-600 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Ticket className="h-4 w-4" />
              Passes Report
            </Button>
          </div>
        </div>
      </div>

      {viewMode === 'list' && (
        <>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-card p-4 rounded-xl border border-border">
            <div className="relative flex-grow max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by ID / Order number, Name, Email, or Service..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-muted/40 border-border text-sm text-foreground focus-visible:ring-orange-600 focus-visible:border-orange-600"
              />
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAllFiltered}
                disabled={filteredBookings.length === 0}
                className="text-xs font-semibold h-9"
              >
                {isAllFilteredSelected ? "Deselect All Filtered" : "Select All Filtered"}
              </Button>

              {selectedIds.length > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                  disabled={isBulkDeleting}
                  className="text-xs font-semibold h-9 flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white"
                >
                  {isBulkDeleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Delete Selected ({selectedIds.length})
                </Button>
              )}

              {bookings.length > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteAll}
                  disabled={isBulkDeleting}
                  className="text-xs font-semibold h-9 flex items-center gap-1.5 bg-red-500/10 hover:bg-red-600 border border-red-200/50 text-red-600 hover:text-white transition-all duration-200"
                >
                  {isBulkDeleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Delete All Bookings
                </Button>
              )}

              <div className="text-sm font-medium text-muted-foreground">
                {filteredBookings.length === bookings.length 
                  ? `Total: ${bookings.length}` 
                  : `Found: ${filteredBookings.length} of ${bookings.length}`}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {filteredBookings.map((booking) => (
              <Card key={booking.id} className="overflow-hidden bg-card border-border relative">
                <div className="flex flex-col md:flex-row">
                  <div 
                    className="bg-muted/50 p-6 md:w-52 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-border relative cursor-pointer select-none hover:bg-muted/70 transition-colors"
                    onClick={() => handleToggleSelect(booking.id)}
                  >
                    <div className="absolute top-4 left-4" onClick={(e) => e.stopPropagation()}>
                      <input
                        id={`booking-select-${booking.id}`}
                        type="checkbox"
                        checked={selectedIds.includes(booking.id)}
                        onChange={() => handleToggleSelect(booking.id)}
                        className="h-5 w-5 rounded border-border text-orange-600 bg-background cursor-pointer focus:ring-offset-0 focus:ring-transparent accent-orange-600"
                      />
                    </div>
                    
                    <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider mt-2">Date/Time</span>
                    <span className="text-xl font-black text-foreground mt-1">{booking.date}</span>
                    <span className="text-lg font-bold text-orange-600">{booking.time}</span>
                    <div className={`mt-2 rounded-full px-3 py-1 text-xs font-bold uppercase ${
                      booking.status === 'confirmed' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                      booking.status === 'cancelled' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                      'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
                    }`}>
                      {booking.status}
                    </div>
                  </div>
                  <div className="flex-1 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="bg-orange-600/10 border border-orange-600/20 px-3 py-1 rounded-md">
                        <span className="text-[10px] font-black uppercase tracking-widest text-orange-600">ID: {booking.orderNumber || 'NO-REF'}</span>
                      </div>
                      {booking.status === 'confirmed' && (
                        <div className="flex items-center gap-2">
                          {booking.confirmationEmailStatus === 'sent' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 dark:bg-green-950/20 px-2 py-0.5 rounded-full border border-green-200">
                              <CheckCircle className="h-3 w-3" /> Email Sent
                            </span>
                          ) : booking.confirmationEmailStatus === 'failed' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 dark:bg-red-950/20 px-2 py-0.5 rounded-full border border-red-200">
                              <AlertCircle className="h-3 w-3" /> Email Failed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full border border-border">
                              <Mail className="h-3 w-3" /> Email Unsent
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h3 className="text-lg font-bold text-foreground">{booking.userName}</h3>
                        <p className="text-sm text-muted-foreground">{booking.userEmail}</p>
                        <p className="text-sm text-muted-foreground">{booking.userPhone}</p>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground">Service: {booking.serviceTitle || 'General Consultation'}</p>
                        <p className="mt-2 text-sm text-muted-foreground italic">"{booking.notes || 'No notes provided.'}"</p>
                      </div>
                    </div>
                    <div className="mt-6 flex flex-wrap gap-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="border-green-600 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/10"
                        onClick={() => handleStatusChange(booking.id, 'confirmed')}
                      >
                        Confirm
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="border-red-600 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10"
                        onClick={() => handleStatusChange(booking.id, 'cancelled')}
                      >
                        Cancel
                      </Button>
                      {booking.status === 'confirmed' && (
                        <>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/10 flex items-center gap-2"
                            onClick={() => handleSendConfirmationEmail(booking)}
                          >
                            <Mail className="h-4 w-4" /> Send Confirmation
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="border-orange-600 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/10 flex items-center gap-2"
                            onClick={() => handleSendReminder(booking)}
                          >
                            <Bell className="h-4 w-4" /> Send Reminder
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="border-green-600 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/10 flex items-center gap-2"
                            onClick={() => handleGenerateInvoicePDF(booking)}
                          >
                            <FileText className="h-4 w-4 text-green-600" /> Issue Invoice (PDF)
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="border-amber-600 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/10 flex items-center gap-2"
                            onClick={() => handlePrintBookingPass(booking)}
                          >
                            <Ticket className="h-4 w-4 text-amber-600" /> Print Pass
                          </Button>
                        </>
                      )}
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 ml-auto h-9 w-9 md:h-8 md:w-8"
                        onClick={() => handleDelete(booking.id)}
                        disabled={deletingId === booking.id}
                      >
                        {deletingId === booking.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
            {filteredBookings.length === 0 && (
              <div className="py-20 text-center text-muted-foreground border border-dashed rounded-xl border-border bg-muted/10">
                No bookings matching your criteria were found.
              </div>
            )}
          </div>
        </>
      )}

      {viewMode === 'calendar' && (
        <div className="space-y-6">
          {/* Calendar Header with navigation */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-card p-4 rounded-xl border border-border">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                className="h-10 w-10 border-border hover:bg-muted text-foreground"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentMonth(new Date())}
                className="h-10 px-4 border-border hover:bg-muted text-sm font-semibold text-foreground"
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                className="h-10 w-10 border-border hover:bg-muted text-foreground"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
            
            <h2 className="text-2xl font-black text-foreground uppercase tracking-tight">
              {format(currentMonth, 'MMMM yyyy')}
            </h2>

            <div className="flex gap-2 text-xs font-semibold text-muted-foreground bg-muted p-1.5 rounded-lg border border-border">
              <div className="flex items-center gap-1.5 px-2">
                <span className="h-2 w-2 rounded-full bg-green-500 inline-block" /> Confirmed
              </div>
              <div className="flex items-center gap-1.5 px-2">
                <span className="h-2 w-2 rounded-full bg-orange-500 inline-block" /> Pending
              </div>
              <div className="flex items-center gap-1.5 px-2">
                <span className="h-2 w-2 rounded-full bg-red-500 inline-block" /> Cancelled
              </div>
            </div>
          </div>

          {/* Calendar Weekday Names Header */}
          <div className="grid grid-cols-7 gap-2 text-center font-bold text-xs uppercase tracking-wider text-muted-foreground bg-muted/30 p-3 rounded-lg border border-border">
            <div>Sun</div>
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
          </div>

          {/* Monthly Day Grid */}
          <div className="grid grid-cols-7 gap-2">
            {(() => {
              const monthStart = startOfMonth(currentMonth);
              const monthEnd = endOfMonth(monthStart);
              const startDate = startOfWeek(monthStart);
              const endDate = endOfWeek(monthEnd);
              const days = eachDayOfInterval({ start: startDate, end: endDate });

              return days.map((day) => {
                const dateStr = format(day, 'yyyy-MM-dd');
                // Support filtering calendar bookings using search term too!
                const dayBookings = filteredBookings.filter(b => b.date === dateStr);
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isDayToday = isToday(day);

                // Sort day bookings by time ascending so scheduling order is natural
                const sortedDayBookings = [...dayBookings].sort((a, b) => {
                  return (a.time || '').localeCompare(b.time || '');
                });

                return (
                  <div
                    key={dateStr}
                    onClick={() => setSelectedDate(day)}
                    className={`min-h-[140px] bg-card border border-border rounded-xl p-3 flex flex-col justify-between hover:bg-muted/30 transition-shadow transition-colors group cursor-pointer relative ${
                      !isCurrentMonth ? 'bg-muted/10 opacity-40 select-none' : 'shadow-sm'
                    } ${isDayToday ? 'border-orange-500/40 bg-orange-500/5' : ''}`}
                  >
                    <div>
                      {/* Day Number and count */}
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-sm font-black h-7 w-7 flex items-center justify-center rounded-full transition-colors ${
                          isDayToday 
                            ? 'bg-orange-600 text-white' 
                            : 'text-foreground group-hover:text-orange-600'
                        }`}>
                          {format(day, 'd')}
                        </span>
                        {dayBookings.length > 0 && (
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-orange-600/10 text-orange-600 border border-orange-600/20">
                            {dayBookings.length}
                          </span>
                        )}
                      </div>

                      {/* Micro Pill Bookings */}
                      <div className="space-y-1 overflow-hidden">
                        {sortedDayBookings.slice(0, 3).map((b) => (
                          <div
                            key={b.id}
                            className={`text-[10px] px-1.5 py-1 rounded-md border truncate font-bold flex items-center justify-between ${
                              b.status === 'confirmed' ? 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20' :
                              b.status === 'cancelled' ? 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20' :
                              'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20'
                            }`}
                          >
                            <span className="truncate flex items-center gap-1">
                              <span className={`h-1.5 w-1.5 rounded-full inline-block shrink-0 ${
                                b.status === 'confirmed' ? 'bg-green-500' :
                                b.status === 'cancelled' ? 'bg-red-500' : 'bg-orange-500'
                              }`} />
                              <span className="text-[9px] text-muted-foreground font-semibold shrink-0">{b.time}</span>
                              <span className="truncate">{b.userName}</span>
                            </span>
                          </div>
                        ))}
                        {dayBookings.length > 3 && (
                          <div className="text-[9px] text-muted-foreground font-black tracking-wider uppercase pl-1.5 pt-0.5">
                            + {dayBookings.length - 3} More
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* Selected Date Detail Modal */}
      {selectedDate && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-xl max-w-2xl w-full flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div>
                <h3 className="text-xl font-black text-foreground flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5 text-orange-600" />
                  {format(selectedDate, 'eeee, MMMM d, yyyy')}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Manage scheduling and details for appointments on this date.
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedDate(null)}
                className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {(() => {
                const targetDateStr = format(selectedDate, 'yyyy-MM-dd');
                const dayBookings = bookings.filter(b => b.date === targetDateStr);

                if (dayBookings.length === 0) {
                  return (
                    <div className="py-12 text-center text-muted-foreground border border-dashed rounded-xl border-border bg-muted/5">
                      <CalendarIcon className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="text-sm font-semibold text-foreground">No bookings scheduled</p>
                      <p className="text-xs text-muted-foreground mt-1">There are no appointments requested or confirmed for this date.</p>
                    </div>
                  );
                }

                // Sort by time
                const sortedBookings = [...dayBookings].sort((a, b) => (a.time || '').localeCompare(b.time || ''));

                return (
                  <div className="space-y-4">
                    {sortedBookings.map((booking) => (
                      <div 
                        key={booking.id} 
                        className={`p-4 rounded-xl border border-border bg-muted/20 relative flex flex-col gap-4 ${
                          booking.status === 'confirmed' ? 'border-l-4 border-l-green-500' :
                          booking.status === 'cancelled' ? 'border-l-4 border-l-red-500' :
                          'border-l-4 border-l-orange-500'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                              <span className="text-[10px] font-black uppercase tracking-wider text-orange-600 bg-orange-600/10 px-2 py-0.5 rounded-md border border-orange-600/20">
                                {booking.orderNumber || 'NO-REF'}
                              </span>
                              <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                                {booking.time}
                              </span>
                              <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                                booking.status === 'confirmed' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                                booking.status === 'cancelled' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                                'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
                              }`}>
                                {booking.status}
                              </span>
                            </div>

                            <h4 className="text-base font-bold text-foreground">{booking.userName}</h4>
                            <p className="text-xs text-muted-foreground">{booking.userEmail} | {booking.userPhone}</p>
                            <p className="mt-2 text-sm font-semibold text-foreground">Service: {booking.serviceTitle || 'General Consultation'}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 italic">"{booking.notes || 'No notes provided.'}"</p>
                          </div>
                          
                          {/* Right header: Select Checkbox */}
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(booking.id)}
                            onChange={() => handleToggleSelect(booking.id)}
                            className="h-5 w-5 rounded border-border text-orange-600 bg-background cursor-pointer accent-orange-600 mt-1"
                          />
                        </div>

                        {/* Confirmation email indicator */}
                        {booking.status === 'confirmed' && (
                          <div className="text-xs font-semibold">
                            {booking.confirmationEmailStatus === 'sent' ? (
                              <span className="inline-flex items-center gap-1 text-green-600 bg-green-50 dark:bg-green-950/20 px-2.5 py-0.5 rounded-full border border-green-200">
                                <CheckCircle className="h-3 w-3" /> Confirmation Email Sent
                              </span>
                            ) : booking.confirmationEmailStatus === 'failed' ? (
                              <span className="inline-flex items-center gap-1 text-red-600 bg-red-50 dark:bg-red-950/20 px-2.5 py-0.5 rounded-full border border-red-200">
                                <AlertCircle className="h-3 w-3" /> Confirmation Email Failed
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-muted-foreground bg-muted px-2.5 py-0.5 rounded-full border border-border">
                                <Mail className="h-3 w-3" /> Confirmation Email Unsent
                              </span>
                            )}
                          </div>
                        )}

                        {/* Card controls */}
                        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="border-green-600 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/10 text-xs py-1 h-8"
                            onClick={() => handleStatusChange(booking.id, 'confirmed')}
                          >
                            Confirm
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="border-red-600 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 text-xs py-1 h-8"
                            onClick={() => handleStatusChange(booking.id, 'cancelled')}
                          >
                            Cancel
                          </Button>
                          
                          {booking.status === 'confirmed' && (
                            <>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/10 flex items-center gap-1.5 text-xs py-1 h-8"
                                onClick={() => handleSendConfirmationEmail(booking)}
                              >
                                <Mail className="h-3.5 w-3.5" /> Confirm Email
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="border-orange-600 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/10 flex items-center gap-1.5 text-xs py-1 h-8"
                                onClick={() => handleSendReminder(booking)}
                              >
                                <Bell className="h-3.5 w-3.5" /> Reminder
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="border-amber-600 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/10 flex items-center gap-1.5 text-xs py-1 h-8"
                                onClick={() => handlePrintBookingPass(booking)}
                              >
                                <Ticket className="h-3.5 w-3.5 text-amber-600" /> Print Pass
                              </Button>
                            </>
                          )}

                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 ml-auto h-8 w-8 p-0"
                            onClick={() => handleDelete(booking.id)}
                            disabled={deletingId === booking.id}
                          >
                            {deletingId === booking.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            <div className="p-6 border-t border-border bg-muted/10 flex justify-end gap-3 rounded-b-xl">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedDate(null)}
                className="font-semibold text-xs h-9 text-foreground border-border hover:bg-muted"
              >
                Close Window
              </Button>
            </div>
          </div>
        </div>
      )}

      {viewMode === 'passes_report' && (
        renderBookingPassesReportView()
      )}

      {deleteConfig && (
        <AdminDeleteModal
          title="Confirm Deletion"
          message={deleteConfig.message}
          onConfirm={async () => {
            await deleteConfig.action();
            setDeleteConfig(null);
          }}
          onCancel={() => setDeleteConfig(null)}
        />
      )}
    </div>
  );
}

function ManageActivityLog() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterModule, setFilterModule] = useState('all');
  const [selectedUser, setSelectedUser] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [viewMode, setViewMode] = useState<'timeline' | 'table'>('timeline');

  const parseLogTime = (log: any): number => {
    if (!log) return 0;
    if (log.createdAt) {
      if (typeof log.createdAt === 'string') {
        const parsed = new Date(log.createdAt).getTime();
        if (!isNaN(parsed)) return parsed;
      }
      if (typeof log.createdAt === 'number') return log.createdAt;
      if (log.createdAt && typeof log.createdAt.seconds === 'number') return log.createdAt.seconds * 1000;
      if (typeof log.createdAt.toDate === 'function') return log.createdAt.toDate().getTime();
    }
    if (log.timestamp) {
      if (typeof log.timestamp === 'string') {
        const parsed = new Date(log.timestamp).getTime();
        if (!isNaN(parsed)) return parsed;
      }
      if (typeof log.timestamp === 'number') return log.timestamp;
      if (log.timestamp && typeof log.timestamp.seconds === 'number') return log.timestamp.seconds * 1000;
      if (typeof log.timestamp.toDate === 'function') return log.timestamp.toDate().getTime();
    }
    return 0;
  };

  useEffect(() => {
    let unsubAudit: (() => void) | null = null;
    let unsubActivity: (() => void) | null = null;
    let auditData: any[] = [];
    let activityData: any[] = [];

    const mergeAndSetLogs = () => {
      const map = new Map<string, any>();
      [...auditData, ...activityData].forEach(item => {
        if (item.id) {
          map.set(item.id, item);
        }
      });
      const combined = Array.from(map.values());
      combined.sort((a, b) => parseLogTime(b) - parseLogTime(a));
      setLogs(combined);
      setLoading(false);
    };

    try {
      const refAudit = collection(db, 'audit_logs');
      unsubAudit = onSnapshot(refAudit, (snapshot) => {
        auditData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        mergeAndSetLogs();
      }, (err) => {
        console.warn("Audit logs listener warning:", err);
        setLoading(false);
      });

      const refActivity = collection(db, 'activity_logs');
      unsubActivity = onSnapshot(refActivity, (snapshot) => {
        activityData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        mergeAndSetLogs();
      }, (err) => {
        console.warn("Activity logs listener warning:", err);
        setLoading(false);
      });
    } catch (e) {
      console.error("Audit logs snapshot exception:", e);
      setLoading(false);
    }

    return () => {
      if (unsubAudit) unsubAudit();
      if (unsubActivity) unsubActivity();
    };
  }, []);

  // Compute unique user emails for user-specific filtering
  const availableUsers = Array.from(
    new Set(logs.map(l => (l.userEmail || '').trim()).filter(Boolean))
  ).sort();

  // Compute unique modules present in logs
  const availableModules = Array.from(
    new Set(logs.map(l => (l.module || '').trim()).filter(Boolean))
  ).sort();

  const filteredLogs = logs.filter(log => {
    const queryLower = searchQuery.toLowerCase().trim();
    const detailsText = (log.description || log.details || '').toLowerCase();
    const actionText = (log.action || log.actionType || log.type || '').toLowerCase();
    
    const matchesSearch = 
      !queryLower ||
      (log.userEmail || '').toLowerCase().includes(queryLower) ||
      (log.userName || '').toLowerCase().includes(queryLower) ||
      detailsText.includes(queryLower) ||
      (log.module || '').toLowerCase().includes(queryLower) ||
      actionText.includes(queryLower) ||
      (log.targetName || '').toLowerCase().includes(queryLower);
    
    const matchesType = filterType === 'all' || log.type === filterType;
    const matchesModule = filterModule === 'all' || log.module === filterModule;
    const matchesUser = selectedUser === 'all' || (log.userEmail || '').toLowerCase() === selectedUser.toLowerCase();

    // Date range filtering
    let matchesDateRange = true;
    const logTime = parseLogTime(log);
    if (logTime > 0) {
      if (startDate) {
        const startMs = new Date(`${startDate}T00:00:00`).getTime();
        if (!isNaN(startMs) && logTime < startMs) {
          matchesDateRange = false;
        }
      }
      if (endDate && matchesDateRange) {
        const endMs = new Date(`${endDate}T23:59:59.999`).getTime();
        if (!isNaN(endMs) && logTime > endMs) {
          matchesDateRange = false;
        }
      }
    }

    return matchesSearch && matchesType && matchesModule && matchesUser && matchesDateRange;
  });

  const isFilterActive = searchQuery !== '' || filterType !== 'all' || filterModule !== 'all' || selectedUser !== 'all' || startDate !== '' || endDate !== '';

  const clearAllFilters = () => {
    setSearchQuery('');
    setFilterType('all');
    setFilterModule('all');
    setSelectedUser('all');
    setStartDate('');
    setEndDate('');
  };

  // Calculate statistics
  const totalLogs = logs.length;
  const totalCreates = logs.filter(l => l.type === 'create').length;
  const totalUpdates = logs.filter(l => l.type === 'update').length;
  const totalDeletes = logs.filter(l => l.type === 'delete').length;
  const totalSecurity = logs.filter(l => l.type === 'login' || l.type === 'role_change' || l.type === 'policy_update').length;

  const getActivityBadge = (type: string, action?: string) => {
    switch (type) {
      case 'create':
        return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30';
      case 'update':
        return 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30';
      case 'delete':
        return 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30';
      case 'status_change':
        return 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30';
      case 'role_change':
        return 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30';
      case 'policy_update':
        return 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/30';
      case 'login':
        return 'bg-teal-500/15 text-teal-700 dark:text-teal-400 border-teal-500/30';
      case 'sms_sent':
        return 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30';
      default:
        return 'bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/30';
    }
  };

  const formatActivityType = (type: string, action?: string) => {
    if (action) return action.replace(/_/g, ' ').toUpperCase();
    return (type || '').replace(/_/g, ' ').toUpperCase();
  };

  const handleExportCSV = () => {
    if (filteredLogs.length === 0) {
      toast.error("No logs available to export.");
      return;
    }
    try {
      const headers = ['Timestamp', 'Type', 'Action Type', 'Module', 'User Name', 'User Email', 'Role', 'Target Name', 'Target ID', 'Details / Description'];
      const rows = filteredLogs.map(log => [
        log.createdAt ? format(parseISO(log.createdAt), 'yyyy-MM-dd HH:mm:ss') : 'N/A',
        log.type || '',
        log.action || log.actionType || '',
        log.module || 'General',
        `"${(log.userName || '').replace(/"/g, '""')}"`,
        `"${(log.userEmail || '').replace(/"/g, '""')}"`,
        log.userRole || 'user',
        `"${(log.targetName || '').replace(/"/g, '""')}"`,
        log.targetId || '',
        `"${(log.description || log.details || '').replace(/"/g, '""')}"`
      ]);

      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `grefas_audit_trail_${format(new Date(), 'yyyy-MM-dd_HHmm')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Audit Log CSV exported successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to export CSV report.");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black uppercase tracking-tight text-foreground">Firestore Audit Trail</h1>
            <span className="px-2 py-0.5 text-[10px] font-black uppercase bg-orange-500/10 text-orange-600 rounded-full border border-orange-500/20 flex items-center gap-1">
              {loading ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin text-orange-600" />
                  <span>Fetching Firestore...</span>
                </>
              ) : (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Firestore audit_logs Active</span>
                </>
              )}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time change logs fetched from Firestore <code className="text-orange-600 font-mono font-bold bg-muted px-1 py-0.5 rounded">audit_logs</code> collection with email, timestamp, action type, and modification details.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleExportCSV}
            variant="outline"
            className="h-9 text-xs font-bold rounded-xl gap-2 border-border"
          >
            <Download className="h-3.5 w-3.5 text-orange-600" />
            Export CSV Audit Trail
          </Button>
        </div>
      </div>

      {/* Grid Statistics / Skeleton */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i} className="rounded-xl border border-border shadow-xs animate-pulse bg-muted/40">
              <CardContent className="p-3.5 flex items-center gap-3">
                <div className="p-2 bg-muted rounded-lg w-8 h-8" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-2.5 bg-muted rounded w-3/4" />
                  <div className="h-4 bg-muted rounded w-1/2" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="rounded-xl border border-border shadow-xs">
            <CardContent className="p-3.5 flex items-center gap-3">
              <div className="p-2 bg-slate-100 dark:bg-slate-800 text-foreground rounded-lg">
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Audit Logs</p>
                <h4 className="text-lg font-black">{totalLogs}</h4>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-border shadow-xs">
            <CardContent className="p-3.5 flex items-center gap-3">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 rounded-lg">
                <Plus className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Creations / Adds</p>
                <h4 className="text-lg font-black text-emerald-600 dark:text-emerald-400">{totalCreates}</h4>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-border shadow-xs">
            <CardContent className="p-3.5 flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-950/40 text-blue-600 rounded-lg">
                <Edit className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Edits / Updates</p>
                <h4 className="text-lg font-black text-blue-600 dark:text-blue-400">{totalUpdates}</h4>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-border shadow-xs">
            <CardContent className="p-3.5 flex items-center gap-3">
              <div className="p-2 bg-rose-100 dark:bg-rose-950/40 text-rose-600 rounded-lg">
                <Trash2 className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Deletions</p>
                <h4 className="text-lg font-black text-rose-600 dark:text-rose-400">{totalDeletes}</h4>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-border shadow-xs col-span-2 md:col-span-1">
            <CardContent className="p-3.5 flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-950/40 text-amber-600 rounded-lg">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Security & Governance</p>
                <h4 className="text-lg font-black text-amber-600 dark:text-amber-400">{totalSecurity}</h4>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Comprehensive Filtering Section */}
      <Card className="rounded-2xl border border-border shadow-sm p-4 bg-card space-y-3">
        <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-foreground">
            <Search className="h-3.5 w-3.5 text-orange-600" />
            Audit Search & History Filters
          </span>
          {isFilterActive && (
            <button
              onClick={clearAllFilters}
              className="text-[11px] font-extrabold text-orange-600 hover:text-orange-700 flex items-center gap-1 underline cursor-pointer"
            >
              <X className="h-3 w-3" /> Reset All Filters
            </button>
          )}
        </div>

        {/* Search Input Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search details of modification, user email, module, action type, target..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-xs rounded-xl h-10 bg-background"
          />
        </div>

        {/* Advanced Filters Grid: User, Date Range, Module, Action Type, View Mode */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5 pt-1">
          {/* User-Specific Filter Dropdown */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block">
              Filter by User Email
            </label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full h-9 text-xs rounded-xl border border-border bg-background px-2.5 font-semibold text-foreground focus:outline-hidden cursor-pointer"
            >
              <option value="all">All Users ({availableUsers.length})</option>
              {availableUsers.map(uEmail => (
                <option key={uEmail} value={uEmail}>{uEmail}</option>
              ))}
            </select>
          </div>

          {/* Date Range Start Filter */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block">
              From Date
            </label>

            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-9 text-xs rounded-xl border border-border bg-background px-2.5 font-semibold text-foreground"
            />
          </div>

          {/* Date Range End Filter */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block">
              To Date
            </label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-9 text-xs rounded-xl border border-border bg-background px-2.5 font-semibold text-foreground"
            />
          </div>

          {/* Action Type Filter */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block">
              Action Type
            </label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full h-9 text-xs rounded-xl border border-border bg-background px-2.5 font-semibold text-foreground focus:outline-hidden cursor-pointer"
            >
              <option value="all">All Action Types</option>
              <option value="create">Creations & Additions</option>
              <option value="update">Edits & Modifications</option>
              <option value="delete">Deletions & Removals</option>
              <option value="status_change">Status Changes</option>
              <option value="role_change">User & Role Updates</option>
              <option value="policy_update">Legal Policies</option>
              <option value="login">Logins & Security</option>
              <option value="sms_sent">SMS Dispatches</option>
            </select>
          </div>

          {/* Module Filter */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block">
              Module Scope
            </label>
            <select
              value={filterModule}
              onChange={(e) => setFilterModule(e.target.value)}
              className="w-full h-9 text-xs rounded-xl border border-border bg-background px-2.5 font-semibold text-foreground focus:outline-hidden cursor-pointer"
            >
              <option value="all">All Modules</option>
              {availableModules.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        {/* View Mode Switcher bar */}
        <div className="flex items-center justify-between border-t border-border pt-2.5 mt-1">
          <div className="text-[11px] font-medium text-muted-foreground">
            Showing <strong className="text-foreground">{filteredLogs.length}</strong> of <strong className="text-foreground">{logs.length}</strong> total audit records
          </div>
          <div className="flex bg-muted p-0.5 rounded-xl border border-border">
            <button
              type="button"
              onClick={() => setViewMode('timeline')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                viewMode === 'timeline' 
                  ? 'bg-background text-foreground shadow-xs' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Timeline View
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                viewMode === 'table' 
                  ? 'bg-background text-foreground shadow-xs' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Data Table View
            </button>
          </div>
        </div>
      </Card>

      {/* Main Audit Display Card */}
      <Card className="rounded-2xl border border-border shadow-md">
        <CardHeader className="border-b px-6 py-4 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-black uppercase tracking-wider text-foreground flex items-center gap-2">
              <span>Firestore audit_logs Records</span>
              <span className="text-xs font-semibold normal-case text-muted-foreground">
                ({filteredLogs.length} entries matching)
              </span>
            </CardTitle>
            <CardDescription className="text-xs">
              Immutable change log records containing user email, timestamp, action type, and modification details.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          {loading ? (
            /* Skeleton Loading Screen for Audit Logs */
            <div className="space-y-6">
              {[1, 2, 3, 4, 5].map((idx) => (
                <div key={idx} className="flex gap-4 items-start animate-pulse">
                  <div className="w-8 h-8 rounded-full bg-muted shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="flex gap-2 items-center">
                      <div className="h-3 bg-muted rounded w-32" />
                      <div className="h-3 bg-muted rounded w-24" />
                      <div className="h-4 bg-muted rounded w-16" />
                    </div>
                    <div className="h-12 bg-muted/60 rounded-xl w-full" />
                    <div className="h-3 bg-muted/40 rounded w-40" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Info className="h-8 w-8 mx-auto text-muted-foreground/60 mb-2 animate-bounce" />
              <p className="text-xs font-bold">No audit log entries match your filter criteria.</p>
              <p className="text-[11px] text-muted-foreground mt-1">Try clearing filters or adjusting your date range.</p>
              {isFilterActive && (
                <Button
                  onClick={clearAllFilters}
                  variant="outline"
                  className="mt-3 h-8 text-xs font-bold rounded-xl"
                >
                  Clear All Filters
                </Button>
              )}
            </div>
          ) : viewMode === 'timeline' ? (
            <div className="relative border-l-2 border-border ml-3 pl-6 space-y-6">
              {filteredLogs.map((log) => (
                <div key={log.id} className="relative animate-in fade-in slide-in-from-left-4 duration-200">
                  {/* Timeline bullet dot */}
                  <div className={`absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-2 border-background ${
                    log.type === 'create' ? 'bg-emerald-500' :
                    log.type === 'update' ? 'bg-blue-500' :
                    log.type === 'delete' ? 'bg-rose-500' :
                    log.type === 'status_change' ? 'bg-purple-500' :
                    log.type === 'role_change' ? 'bg-amber-500' :
                    log.type === 'policy_update' ? 'bg-indigo-500' :
                    log.type === 'sms_sent' ? 'bg-orange-500' : 'bg-slate-400'
                  }`} />
                  
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-black text-foreground">
                        {log.userName || log.userEmail || 'System / Guest'}
                      </span>

                      {/* Explicit User Email Field */}
                      <span className="text-[10px] text-orange-600 font-mono font-bold bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/20">
                        {log.userEmail || 'no-email@system'}
                      </span>

                      {log.userRole && (
                        <span className="text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.2 rounded-full bg-muted text-muted-foreground border border-border">
                          {log.userRole}
                        </span>
                      )}

                      {/* Action Type Field */}
                      <span className={`text-[9px] font-black tracking-widest px-2 py-0.5 rounded-md border uppercase ${getActivityBadge(log.type, log.action || log.actionType)}`}>
                        {formatActivityType(log.type, log.action || log.actionType)}
                      </span>

                      {log.module && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-muted/80 text-foreground border border-border">
                          Module: {log.module}
                        </span>
                      )}
                    </div>

                    {/* Details of Modification Field */}
                    <div className="text-xs text-foreground font-medium bg-muted/30 p-3 rounded-xl border border-border/50 space-y-1">
                      <div className="font-semibold text-foreground">
                        {log.description || log.details || 'No modification details recorded.'}
                      </div>
                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <div className="text-[10px] font-mono text-muted-foreground pt-1 border-t border-border/40">
                          Metadata: {JSON.stringify(log.metadata)}
                        </div>
                      )}
                    </div>

                    {(log.targetName || log.targetId) && (
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
                        <span>Target: <strong className="text-foreground">{log.targetName || log.targetId}</strong></span>
                        {log.targetId && log.targetName && <span className="opacity-60">(ID: {log.targetId})</span>}
                      </div>
                    )}

                    {/* Timestamp Field */}
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono">
                      <Clock className="h-3 w-3 text-orange-600" />
                      <span>Timestamp: </span>
                      <strong className="text-foreground">
                        {log.createdAt ? format(parseISO(log.createdAt), 'PPP p') : 'Just now'}
                      </strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Structured Data Table View */
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/40 font-black uppercase text-[10px] tracking-wider text-muted-foreground">
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">User Email & Name</th>
                    <th className="p-3">Role</th>
                    <th className="p-3">Module</th>
                    <th className="p-3">Action Type</th>
                    <th className="p-3">Details of Modification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                      <td className="p-3 font-mono text-[10px] whitespace-nowrap text-muted-foreground">
                        {log.createdAt ? format(parseISO(log.createdAt), 'yyyy-MM-dd HH:mm:ss') : 'N/A'}
                      </td>
                      <td className="p-3 font-bold text-foreground">
                        <div>{log.userName || 'System User'}</div>
                        <div className="text-[10px] text-orange-600 font-mono">{log.userEmail || '-'}</div>
                      </td>
                      <td className="p-3">
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-sm bg-muted border border-border">
                          {log.userRole || 'user'}
                        </span>
                      </td>
                      <td className="p-3 font-semibold text-foreground">
                        {log.module || 'General'}
                      </td>
                      <td className="p-3">
                        <span className={`text-[9px] font-black tracking-widest px-2 py-0.5 rounded-md border uppercase ${getActivityBadge(log.type, log.action || log.actionType)}`}>
                          {log.action || log.actionType || log.type}
                        </span>
                      </td>
                      <td className="p-3 max-w-sm text-foreground/90 leading-relaxed" title={log.description || log.details}>
                        {log.description || log.details || 'No details provided'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ManageUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', role: 'editor' });
  const [deleteUid, setDeleteUid] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });
    return () => unsubscribe();
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailLower = newUser.email.trim().toLowerCase();
    if (!emailLower) return;

    try {
      // Find if user already exists (case-insensitive check)
      const matchingUsers = users.filter(u => u.email && u.email.trim().toLowerCase() === emailLower);
      if (matchingUsers.length > 0) {
        for (const mu of matchingUsers) {
          await setDoc(doc(db, 'users', mu.id), { role: newUser.role, email: emailLower, updatedAt: serverTimestamp() }, { merge: true });
        }
        toast.success(`Role for ${emailLower} updated to ${newUser.role}`);
      } else {
        await addDoc(collection(db, 'users'), {
          email: emailLower,
          role: newUser.role,
          createdAt: serverTimestamp()
        });
        toast.success(`User ${emailLower} pre-authorized as ${newUser.role}`);
      }

      setNewUser({ email: '', role: 'editor' });
      setIsAdding(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'users');
    }
  };

  const handleUpdateRole = async (uid: string, role: string) => {
    try {
      const targetUser = users.find(u => u.id === uid);
      await setDoc(doc(db, 'users', uid), { role, updatedAt: serverTimestamp() }, { merge: true });
      
      // Update any other docs matching the same email address
      if (targetUser && targetUser.email) {
        const cleanEmail = targetUser.email.trim().toLowerCase();
        const otherMatches = users.filter(u => u.id !== uid && u.email && u.email.trim().toLowerCase() === cleanEmail);
        for (const om of otherMatches) {
          await setDoc(doc(db, 'users', om.id), { role, updatedAt: serverTimestamp() }, { merge: true });
        }
      }

      toast.success(`User role successfully updated to ${role}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
    }
  };

  const handleDeleteUser = (uid: string) => {
    setDeleteUid(uid);
  };

  const confirmDeleteUser = async () => {
    if (!deleteUid) return;
    try {
      await deleteDoc(doc(db, 'users', deleteUid));
      toast.success('User removed');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${deleteUid}`);
    } finally {
      setDeleteUid(null);
    }
  };

  if (loading) return <Loader2 className="h-8 w-8 animate-spin text-orange-600 mx-auto" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Manage Users</h1>
        <Button onClick={() => setIsAdding(!isAdding)} className="bg-orange-600 hover:bg-orange-700 text-white">
          {isAdding ? 'Cancel' : <><Plus className="mr-2 h-4 w-4" /> Add User</>}
        </Button>
      </div>

      {isAdding && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Pre-authorize New User</CardTitle>
            <CardDescription className="text-muted-foreground">Add a user's email to give them access before they sign in.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddUser} className="flex flex-col md:flex-row gap-4">
              <Input 
                type="email"
                placeholder="user@example.com"
                value={newUser.email}
                onChange={e => setNewUser({...newUser, email: e.target.value})}
                required
                className="flex-1 bg-muted/50 border-border"
              />
              <select
                className="h-10 rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-orange-600"
                value={newUser.role}
                onChange={e => setNewUser({...newUser, role: e.target.value})}
              >
                <option value="admin">Admin</option>
                <option value="editor">Editor</option>
                <option value="guest">Guest</option>
              </select>
              <Button type="submit" className="bg-orange-600 text-white">Authorize User</Button>
            </form>
          </CardContent>
        </Card>
      )}
      
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Authorized Users</CardTitle>
          <CardDescription className="text-muted-foreground">Manage roles for users who have signed in to the admin panel.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {users.map((u) => (
              <div key={u.id} className="flex items-center justify-between p-4 border border-border rounded-lg bg-muted/50">
                <div className="overflow-hidden">
                  <p className="font-bold text-foreground truncate">{u.email}</p>
                  <p className="text-[10px] text-muted-foreground truncate">ID: {u.id}</p>
                </div>
                <div className="flex items-center gap-4 shrink-0 px-2">
                  <select
                    className="rounded-md border border-border bg-background text-foreground px-3 py-1 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                    value={u.role}
                    onChange={(e) => handleUpdateRole(u.id, e.target.value)}
                  >
                    <option value="admin">Admin</option>
                    <option value="editor">Editor</option>
                    <option value="guest">Guest (No Access)</option>
                  </select>
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10" onClick={() => handleDeleteUser(u.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            {users.length === 0 && (
              <p className="text-center py-8 text-muted-foreground">No users found in the database yet.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="rounded-xl bg-blue-50 dark:bg-blue-900/10 p-6 border border-blue-100 dark:border-blue-900/20">
        <h4 className="font-bold text-blue-900 dark:text-blue-400 flex items-center gap-2">
          <Info className="h-5 w-5" /> How to add new users
        </h4>
        <p className="mt-2 text-sm text-blue-800 dark:text-blue-300">
          1. Ask the new person to visit the /admin page and sign in with Google.<br />
          2. They will see an "Access Denied" message initially.<br />
          3. Their account will then appear in this list.<br />
          4. You can then change their role from "Guest" to "Editor" or "Admin".
        </p>
      </div>

      {deleteUid && (
        <AdminDeleteModal
          title="Delete Authorized User"
          message="Are you sure you want to remove this user? This will instantly revoke their admin or editor access levels."
          onConfirm={confirmDeleteUser}
          onCancel={() => setDeleteUid(null)}
        />
      )}
    </div>
  );
}

const formatAdminMessageTime = (timestamp: any) => {
  if (!timestamp) return 'Just now';
  let date: Date;
  if (typeof timestamp.toDate === 'function') {
    date = timestamp.toDate();
  } else if (timestamp instanceof Date) {
    date = timestamp;
  } else if (timestamp.seconds) {
    date = new Date(timestamp.seconds * 1000);
  } else {
    date = new Date(timestamp);
  }
  if (isNaN(date.getTime())) return 'Just now';
  return format(date, 'MMM d, h:mm a');
};

function ManageChat() {
  const [threads, setThreads] = useState<any[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [reply, setReply] = useState('');
  const [isUserTyping, setIsUserTyping] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);
  const [isAgentOnline, setIsAgentOnline] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribeSettings = onSnapshot(doc(db, 'settings', 'global'), (docSnap) => {
      if (docSnap.exists()) {
        setIsAgentOnline(docSnap.data().isAgentOnline !== false);
      }
    });
    return () => unsubscribeSettings();
  }, []);

  const toggleAgentOnline = async () => {
    try {
      await setDoc(doc(db, 'settings', 'global'), {
        isAgentOnline: !isAgentOnline
      }, { merge: true });
      toast.success(!isAgentOnline ? 'Status updated to Online' : 'Status updated to Offline / Away');
    } catch (error) {
      console.error(error);
      toast.error('Failed to update online status');
    }
  };

  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [imageCaption, setImageCaption] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImg = file.type.startsWith('image/') || /\.(heic|heif|avif|webp|png|jpe?g|gif|bmp|tiff)$/i.test(file.name);
    if (!isImg) {
      toast.error('Only image uploads are welcomed.');
      return;
    }

    try {
      toast.loading('Optimizing image...', { id: 'admin-chat-compress' });
      const compressed = await compressImage(file, 1000, 1000, 0.75);
      toast.success('Ready to send!', { id: 'admin-chat-compress' });

      const readyFile = compressed instanceof File 
        ? compressed 
        : new File([compressed], file.name.replace(/\.[^/.]+$/, "") + ".jpg", { type: 'image/jpeg' });

      setSelectedImage(readyFile);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(readyFile);
    } catch (err) {
      console.warn('Image select/compression failed, using raw file:', err);
      toast.dismiss('admin-chat-compress');
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const resetSelectedImage = () => {
    setSelectedImage(null);
    setImagePreviewUrl(null);
    setUploadProgress(0);
    setImageCaption('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    resetSelectedImage();
  }, [activeChatId]);

  const setStaffTypingStatus = async (isTyping: boolean) => {
    if (!activeChatId) return;
    try {
      await setDoc(doc(db, 'chat_status', activeChatId), {
        isStaffTyping: isTyping,
        lastUpdated: serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.error("Error setting typing status", e);
    }
  };

  const handleReplyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setReply(e.target.value);
    
    // Set typing status
    setStaffTypingStatus(true);
    
    // Clear status after 3 seconds of inactivity
    if (typingTimeout) clearTimeout(typingTimeout);
    const timeout = setTimeout(() => {
      setStaffTypingStatus(false);
    }, 3000);
    setTypingTimeout(timeout);
  };

  useEffect(() => {
    // Fetch all unique chat threads
    const q = query(collection(db, 'chat'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allMsgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      
      // Group by chatId
      const grouped: Record<string, any> = {};
      allMsgs.forEach(m => {
        if (!m.chatId) return; // Skip messages without a valid chatId
        if (!grouped[m.chatId]) {
          grouped[m.chatId] = {
            id: m.chatId,
            userName: m.userName === 'Grefas Staff' ? 'Client' : m.userName,
            lastMessage: m.text,
            timestamp: m.timestamp,
          };
        } else {
          // If we found a message that is NOT from staff, use that for the name if we don't have a good one yet
          if (!m.isFromStaff && (grouped[m.chatId].userName === 'Client' || grouped[m.chatId].userName === 'Grefas Staff')) {
            grouped[m.chatId].userName = m.userName;
          }
        }
      });
      setThreads(Object.values(grouped));
    }, (error) => {
      console.warn("ManageChat threads issue:", error);
      handleFirestoreError(error, OperationType.LIST, 'chat');
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!activeChatId) return;

    const q = query(
      collection(db, 'chat'),
      where('chatId', '==', activeChatId),
      orderBy('timestamp', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.warn("ManageChat messages issue:", error);
      handleFirestoreError(error, OperationType.LIST, `chat/${activeChatId}`);
    });

    // Listen for client typing status
    const unsubscribeTyping = onSnapshot(doc(db, 'chat_status', activeChatId), (docSnap) => {
      if (docSnap.exists()) {
        setIsUserTyping(docSnap.data().isUserTyping || false);
      } else {
        setIsUserTyping(false);
      }
    }, (error) => {
      console.debug("Typing status fetch error (handled):", error);
    });

    return () => {
      unsubscribe();
      unsubscribeTyping();
    };
  }, [activeChatId]);

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim() && !selectedImage) return;
    if (!activeChatId) return;

    try {
      let imageUrl = '';
      if (selectedImage) {
        setIsUploading(true);
        const fileName = `${Date.now()}_${selectedImage.name}`;
        const storageRef = ref(storage, `chat/${activeChatId}/${fileName}`);
        const uploadTask = uploadBytesResumable(storageRef, selectedImage);

        await new Promise<void>((resolve, reject) => {
          uploadTask.on(
            'state_changed',
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setUploadProgress(Math.round(progress));
            },
            async (error) => {
              console.warn('Admin chat upload failed, trying local Base64 optimized fallback:', error);
              try {
                const base64Url = await blobToBase64(selectedImage);
                if (base6xúÏΩÎv€F≤(¸?O—÷dáTF§.∂úDëÂë%Ÿ—˘|€íúÏYéœ$!cê` –≤F[kùg9èvû‰´Kw£Ë@IŒev8ã˙Z]]U]]óo“xU\}!*ühåCx+âAêÖ¿˜ÔÂ“0K‚èawµ˙ÚZÑq:[O√Ü√º¶ií∫jñû\ãaê'¢{ƒÒ ~8¢äé¶á…∆ˆ©ÂÓ ˛hÕƒp‰"NÜA,T%ä√—Œ ö∞€¨¶v¨ˆHØ◊¨üAv9äÓ™x¥W™ﬂ‡"àr1Û√‰b'¡ËÕ…ÛÓbéﬂŒÇÏC?õÛlí‰˝4<Ø¿s\∆´k˝˝˙˘Ö{F£√dÿ&qìçíYw4XÑ\guÕ}~ w†◊y|Ÿœ”h
≥˚Ôˇù”pçÃxZùã,LèG;"X‰ì˛pë¶PÓ<{‹_D#™‡ïjº¶·éË<É	ô8ÕÉÛs£ä⁄ÑÅ~ËWÒ6è¶añ”˘éÄñ>ÜÈôz–]-JEŸ”4ôRÀ;"OaÒ™ﬂÔwıÍ<W≈R]ãquΩÍ)˙’W\Ú ò# t∞Ö!?⁄qê≠™u—+îÖ˘	Çπ€ÈËg∞⁄a~‚Ö£cl¨kñß˘ú]Œ£ŸæÊã7L "zÖˆÓ…ì ÀÂéÈ<•}œ†ΩŸà∫£8èf∞[.uUËÛ8{C®
}⁄Ω¡ø◊ﬂ#ñ•aæHg¢KèwG—G1åÉ,√E~¥íÕÉaÿªÏ=XŸìm^≠-˛s¡=]ÃÁIöûãxÃfa*æ^W»]nÎ<?	¸ßx,≤È}OìÂ·4Î˘†Å.≤<:øÏ¬¸"gbﬁ{ „ﬁt0]∞!I:Çb¸ß'•…b6
GΩO±sc∏ûaX=bç˚Fçjù4åƒfæòÙÓ˜∑≈˝Î:ˇ¥Z¿EŸ˛^ºö≈—,D|Ïñà≈.@{fvÄz¿ºEDuz≤˜ÛEC˜ÙGMú~ ò∆)¿¨˜`cC$∞tQ~Ÿ˚fv>`vˆÛVƒ∫=ÆUõHñqı^OﬁÖ’Ô§∑E ¡ø,ÕÛ±ËËamolt`;·ÉE≥!≥s˝˛⁄—Ó: øºˆêw'¨Mf9 B<"Ú◊À¶¸˜<I√1çseÔ9éˇ#Ïû`≈ ñùÚz¿8’ à}"]4‘˝ã‡R¨ãWÁÁÙÓE2
;◊ªÎì•ÕÕQ˜ü2!Æ5ò“≤WrG;Ç0É=äÀd!z˚=íÍ§á˚>
3§°ò@ìG}ÌŸ$—ò¸ÅÖætAµÅN”L ÿ†C4$ZA$JÁ,òr±ì0õ´˚ùr¨œkñ™¸Û…"œìôQ>ô¡ÃÜ]Â…xá∆¨Õn>iÃÚG∏¨$ãøÆ¿TWF¿|qæb÷4∞∂R◊¶%ìX—é"3Ç0*fuèì4òç√ﬁCÿW∫®|ˆ<£Ê.&@å™Ê»≤Ë_HMß+˙ô	«*úÜöÆ≠«5°ıµsqcâv◊‰™mπ ≠ËÒtT–„IÔÌ7'Ôà2>‘[n@í ®y—€\ø/ÏõË4@p§#Å‡<èìãﬁ$ç¬YÂ&N õ+µ´ƒˆÜM»'[nJ·Ê[•Õπ˚"Ã2î	¢táfKÀ†]í\à≥I£Ã⁄ì-ˇˆp,Go≥ «e7™5†´úªËOÉy∑õØEÖüHÄµy…Ó†ºıÛ!ºÑ≠◊g…Ó=∑’zçç .ï÷õï%dê%ˆâÆãÌ¨ñÎòlCbmç8<œâëóˆY[(ãP‹BîI“Ã∑æ_^ô‚§xÙËë†â0wë;q{CåÇÙÉ±7ø€ÿXﬂdû”)œ∞LÜù€£,å0∆‡ëãv*·åòz˝Ì
]/sÖõ2®èf[ÈbB`∏≤À§$ÌÎ—U®–◊¢¥Kñ†ÓÀÚıÛvsc˛Èùõ7≠≥<#çfzL…¶…,qÃåÜ ıÄè–!NÓÊª∆»*B√Z«qU€¨ÆHUò÷rZûP)ó√¨Çtw}`QNè5 Ω˜‚p6fâ(∏Åê∑4Ô}ÀÉëT≈#ºLËúîâÀ0Ô„hÆ›d¢ôÇ…∏k∫kÔµ«nÌñ‡v#-jˆñSvÆ!‰rÔ¨Ï$3òQ 5ayF/úãÄ`!#¢ÅKgNqı±πŸLí-˚^z≠ÏÓÿpºv°Ω√€±"¶’√ô^¡)#∫‰S?ß–]sò*Ê0Õ∆g∞Ë∫çm_bù‚¥éô◊éßDw˘PÉ4GÏ"%•)_ΩüüzΩ∑ﬂn¸«;çπ[Ä∫ÛO0Î˘%ê\E1øt©ØÑ∞«‰,"lﬁÒ–ñ‚TØy⁄õ% c˘⁄‡√ådf%™Æ€àπGÄ‡ˆMÕÖã∫; ∑úh´º±ı8‚±õ6¿q0¸∞^Û…b:ò¡iIR '˜pF4{_ÇõrÒı	‚¸— ~û√…¡JM—4<”4L_' ¶\>Zô·±à’U3°sõÙ∂∑@ê£=ïPïh=À‘K.“,I{ˇJíi/“`î"å:]∑m
1Úi]ˇ%±ÍˆXr—OÊ·¨[ÄhMt˛k2˚–qrP˛¨˚†-ïZuÿÉü ﬁõ´›ıIcπç0 Q≠`b ÙıCÔgæ≠®>˜¨=Y[TmMÖïNÎ⁄NÊáw&Ìf0µ°Âƒ∫ ﬁ=©>pÎ0Ÿ)ºÔ∫÷‘Û‘πƒ¡Èâ{¿◊J™^$Ê˜
ºZ≠%&ñ Cêc3O√ﬁEÃÕÂëä{uãßﬁ·zßWÀdß9∞@∑åÁ>»mˆ∑çì∏{|ªYû&≥1Nƒ`ˇÚ°ßÜsåﬂ’ ”Mb¥ˇÔˇ¸_Ø0=m¶˝‚¥ˇçsV+Õ_Eﬁ∞¬⁄ç8ı*ÉıkŒÑÙ<—ﬂ,éËKÔ®{õNï{i‰∏(+î∏ØCv`é[JÉò F^¿e¨!O®9†»0o˘7ÚâQó;pjºüΩ´(d?oèõ€ü≥KÀÂ≠3ç’ññ{úY  ‚úà‡HGx◊Ô˜Î‹IL‹¯]÷dV ‡Õ]⁄æ2gZ
zùÜ£Bºfal\q»äD^eèƒÊ√·‚F£ÃfK«∫ähÊ“7îOcÁ´∏^>}U/A|≠Í˚ ¿TÇ¡?
?¶ïc•_‰ﬁnêûR;¯∂àò,HñÄ}Õ2£|∞bcØyS¢•;†MëÊ©˚≤eo„¶&ÛﬁÜ!To◊ ﬂTòÁICïåá‹—˚äo¢_ß…8∂q˝w$V¯˘¥˚|
lŒ	ﬁ’s*mòAá”»≠+î7ôy•˙∏?ÉVËr≈∞Eˆˇ9w¸rà£Û˙≥ªÑnÄÑZ¸†ÎX8.Ñ"ÀÅ4éC†Zt¯=	É—•∫≠Ì¯¯∑s‹˛`ø˚D
DâïXqQ◊++„IíÂûB|_Ω≠X€ÏÿcﬂÿL¬-¨ÒŸ©·Ú•**∏œS˙$UΩvwCze¡ GèÃïtı‡—y. ú´˜§¢OTo‹<ÀI∫Ò8?œ=⁄e®t<õ/rÁ`Á@|¬	Ï´0Öı°*:¥º8 ÍP’ﬁèAº%π=®;Ô¿:LPÄ#m®Æ
éçZ›∞"‡8Ã˚‘§Gåµ@˚mqµ8ÖÕE$aoã/≠óﬂ±¢nUtı·™6‹ëEP¨ù.”(tÄ≈!ú—Fd<rÌ—ùñEﬂıu·í¡˘b¢V£ä<’É>LEŒ£8tA2œ]·K¬æì‹√`8Á@d}÷ø^ÎO¬hHˇûØıÉè¯/p@¯w0ùª:)êäAF≈{‹’ùâ=¨ŒväF¿®ÒÄ’C›{ß–cˆÈ*›]\»Rπ¯Vã<;ﬁd◊Ò∂Dπ¿–˚6»wÕÑÿuµÕÑXãdÓı1’X&:(C≤«˝!È:7|ÎÕòGy”ë"yí
…ÙY¡QöìN H“¿¨l;…wAº´Øhí.ñh‹í§∞R¸¥jÈ.¿Ò:dÀ∂⁄É«◊Æˆ%9Nôl¥ÿ1D`¯ë≥º}ÒYñÔ>ÀqçäwHF‰“)zÿ√vkÔÎ◊9jî&ª˜,≥I˛ÔYrßç]∏Ü¥Ω£ œ´˜?Î»2l+õ‚◊*†åuWs#ÿx‚®Pu∑ƒDWÇo”Hö%ï—èË÷X≠	iòœ]_WøˇÁ9¸§≥~ÃPˇd≤.B¢·p.ﬁÊ¯hz˘N<BÉT¥à	wÉŸÂ€w{›∑Ô»¬QVà2ê}`åkl…?ÃjÜQ§¨2/∞q™Òíø[Æ+â.°]¡ˇÖŸ0ç§!©~:O£$%s≥Œ4Eã©zëë<ŒìQ"≠gGãz¿Í_(SS9(âß4®Á¸›⁄»öÂG∞h9AxDïçÿ2¿w‹ b≤‘^ˇ]%ªP(qt~é∂’¶â4∑ˇ¥À"L/+&…¥BhìL‘„…e∑3¨<€œaÍÑRgU⁄†r[ãÏvÑ› ÑVATíˆ‘›_÷DWW[F⁄j˘ı€˛(ÚU'|°;Œ+`ˆ;~ı#ò?U¸:
Ú -zWWM´‹Á.Îÿ5mÜkÙÀtıiÁ8ÊÖdëŒ≈÷ƒ´90“Û˛Û„”≥≤M˘WŸ€R”∆‰ŸTz&÷K…ù‚‚î—ù≠÷K‡p9Ã˚OÅZ}Ñ]m5Ïœ”ü≤ëú≤BéŒÅ I¸ÓKj∑*Gı=sº<-làk–ıjw? kµÉÙ3çµFﬂ≤‘ìKó=z8E=ú∂Hˇ€òåœ˚√d™Ór
”l∂òŒ ÇfY∑CÄÉ	†D√œÿpŸ1ë@nt¿c_W∂¥k7ó6≤πâmkqE}Z}∑GµÉì£˝≥£
≤}°ÃªM,z3á-JBçJ∏Sò
¨	X∫S9!~d`U+êÆ Våø÷`Ô!Jh–ËFªØàb„êÕ˙5ÑnáüNéÔiÎ_^E£Î˜µ¿(("Ä¬ Ç1„›ÑBºGç∂‡ﬂÛ(ùZçUKh„ô4πÿpn»rY'p≠fjqûKé:w„√£ÁGêÕ±‡v˘!XpîL∆µ6„0-wŸZ‚⁄€Æ∫BMI)f5≤Pt&—x“ŸQ4∑CbO
B
å >‚W√j≤…†ÇÒ…÷Ü*Q<√R[ùÔ≠Œ$M(ugà®Õ¶ä™_˘∞‹µQ∂“{ú\îª¿ëAuLﬂçnÈ∑›)=*w©ÀJ€ÎRoqR$≠Eßº∏9§|£∂Ö[©1È=|PÔp±ãÃ<L∑ ⁄§¯O©â≤y4•ï¡c £Ì]b¸v—çó-%g€`y≥¢≠æˇ)^„—ïΩcÏ’z$ÌÆO6≠´⁄oÂ Q’|ü•Ë|áNS¡ëÑüüqÈç‘◊ßB:}%ä.d}KÌvpÿknxOâË´◊˛≥]ΩÕΩm#≠⁄#Gä`6cT≈ÔÓÌæéÅô7êioKòv‹ ·¿’÷¶æËÕ∫,⁄=@K{:dtiÌ€R´¸"˙ñÑ¯‚•í BöKw@“ì1]Õ>K∫ª°N « _K›;5òRΩvmå™9¢Okb)©âe—ÄÁ~©˝∞dWáV£–ÅÑœ¥`g»•J∆≥ı“◊´é”ó0∆QıçÎ.w{£¥¿•ZU»Ó,c +◊ õ√BÎ‚0ÃAŒö¡d∞7ñ%∑ Ÿ› ¶DR«i4¯ﬁÖgxﬂ8⁄)~ﬁØ8˝˘⁄Q8ZvÙê•„`∆ﬁ´J"øã9ê>‚∏9Kÿ˙Ωã`î˚h™gv◊©u∑ÌÎXØÑÉ«.yˇMG•{v“Ï[&◊ÛO &À˛E©^r~é÷Êm|2\dΩèQ`ìHó+∂°±_Q˝-◊C“(8ûÀŒ∂¥nG⁄XŒíºcr;MøS&ñ€ûÁT	˘ïHÿtiUã¸ÖËY¡|G≥û{Cæwì„[AëteÔ¯wwùﬂ¥™∆¬Â ﬁ˙ªTUÄÎ ﬁÛ‰¢Æ“Ó:„‡ç/,Éùu<ãÚ‰>\˛πø~›˝≈ß˚[Ì.• ∏≥ΩÖ:êbqò,µC¢Yo.-h≠Ñ2ßY™ë,· ﬁ!¸˚Ô∂—°@•V›Û^å©;T=µB,©Aªfi-\‘∫ôÃÇü[X
á#˚ ´Í_ÎΩÊrúäVˆNtE•ÄÎŒ…uΩ‰î˝˘±˙]ÿ54Jf$äâxl g¶sŸ˙◊‚∂©8H‚≈tfS6GüpïÚ∏Ú"EÆ¯ÛVÏ[—˘c´bﬂ z°ç ÌÓ‰æÎ4Õ[Õ˝öˆñuÿf25π_Í√a)KÓ)¶ÂZ±ôµíßãh£ø›¬´Í2F:Ω˛yï≥\&U≈ËX@˙ÌUÈ˛X6¶-[Ë:É8∏ñ∂lr⁄vxŸìì∫µÍ—∂ãËO'pˆxF¢çÆ~·ü◊@GLe∏:÷öœ∞k-’€Báy≠CRR>∫*´-Ø+Q6, „ú`ÌÉ˝Æ∑ä‘+~ÊΩbÒ‰? é1§äﬂ¡∆±GÛoøP˚]oÁÛÓñGˇ([eËﬂ¡^ë√¯w‹$éJóÕP)«7∏ÁQq∑p˝r€·!y√
í†˜†:eõ·
XŸ§|ìTúø∑6jw/ÈqnV7°˜”`.Uﬁ·ìp¯¡Ê!ÙÚ–≥nÂ™J‚±È≤„I/“{éæÃΩœÀÑ6PêI(¶	ô(
4G:
ÑcJë›W8Í/™88Xó≈%\"∑G∆¸…(àç∆•˝'ø§Éçyìq≠Ïß&+[»/¡,«qsØ0+t)É⁄è≈~ÿ“æìÈãƒóàÍ4ò±Ì£oÕí\B0(XvÚpÂõˇGWÄkª›AW_’´¢¬∫7ñ%9E|–`Öº6©Y”deÕ&"‚zGpïò„eπû~»ïÂO´z&ÆM≥º({Q8rãG‘¥:¡„"ÁÖ™à˝ìâ¥‚8´ìR°kVYª≈˝eµ`˚!Y§Ywcç˛∑jªEŸ·"Ñ#epÈËﬂ›K?Oi“®6√ÖÅëΩŸoW¬≠Æ˜D6	F…n;>©ÀﬂS+Ó?∏Á≈ç≤q$/ª∏òZç∏¬∂ö.oø≠fâáË9π~;£cUbT•á@— ¡ËàO⁄Ò˙i3áì˛ïU¢Ÿ€≥å)õ2I’_ÿ%›b÷ÖR±ª{XJ÷*:ﬁ„"Œ(å°£QΩg7ÿ©T,Rú.gR™Óπ { DëQê√6∑ŸÏ}æÈ4›áYÅÛn˙Áe847wãòSuBï«ñΩ÷«ŒÎ[W≤íPT∏+eÀ“X€
:Ëôû¿dSõWX∏U‘§DŒRêŒ∂ö◊®™í,Å”"h∂YL]ƒOc≤ °¨⁄À£Ò$«∏_Öπ@9jß§ ∆’zÖ
,låbT–]Tôµ¨ÙPvR]Ω.C¢I˜ ≈õèÆπw∑e›ew‚]ãÌ ¿—¶¡è%◊Ì∫˜)ô˛¡Í‘oG◊Uü«˝◊qæïP£€8EÀ}ﬂ÷eùºZõ'ÅãÆ„¯n”¸aôïH]zÚ—uôÿ^ï∂§¶à¬ö®ÒÆ,-çÛÆÏï8|ÂæØ™Ω#{)^üºzvrtz⁄™≤º{ıÚ»Uºz'V:¨Vn(ä€	ßÎ»À"“âß{ÀD€ßÏErZ¸nˆ%¡ 1ŸÛ(À©Íı´Ö ,>ÑE’„‚wsÂ!–í œx¿ÍWM≈/nÏ5"ÀX]>/=¨mÅ#ﬁXœÇ¡Z3îXcÓk—ËÃÁ∞≈ïˇF≥]4EæÏÏu≠bjzÎÎ¬X91O0û8∂öK«‚·‰?—IÖó∫¯mÕ@Üo/úé–”@yˇ–èöÚ7/‚i1~ÀA«|‹ŒM`°ñF0”
0“pÕ1¶Ù3î ÷8xΩ˘»^öôﬁ>¥Ñ¯ÙΩ7¢a¯â—Ù,àc\'£é9[‡(ÛE˚qv‹2ÿΩé√Yò1#Cê°kŸ?0F5= “3M7í8B6@≈Ä&SÏ^U6˚‘¡êjß„˜ö•úß·ÑÏ"©¸kı´¶∆ 1n=Å/5Â‚dúúÊóq(˜ì¸eœ˛ü»GhRÏ⁄B_ë[·Ï¯•◊I8˜á»´¨≈oª]Ê?‘ZàN∞Òàæc¸u˙í‚ûÉ.d9≥èh ù)˚¬˝§~’ÄaÕ»æÑÈï˛Yø)†öB™:¯›Ë—ß9úCÒär,–Ú'Ã:•&(r∑ _Ì÷%Ó⁄ï2ÿ6∫3í®_v’g)‘˚HÙPÓ‡Ëï¯J<%·Äp]$8´‡Õ¢È"Ê §Â]e≤ê§ÚW=d0rà∫˙íÑ¨x`U›(WL+™‡E©2¨yF≈Ã1◊œÍª=`ø≠c™kõ+’Ç»h“[c@j·$ﬂ˘¬ÁíU7˚‚iàé ∑†w“]vø◊c—$\7s[‰÷MœEx‚s^î:+î¥Iïˆ°ÒˆùvS.ç a√IÄJ)j®ræ»&~é:õåïÖ§ QóZ˙‹ŒêœéŒJ`nÍpU˙!¬ n©ïUx §l`./2¿Î˚çK÷JŒÊmñYˆbÆ3>˙›.¥ñÿºÀ\îh^o;uìëàÜ‚2h»Ó Ì\Lç›´}_≠6ú.aôC¥º'È(Æ§ﬂB ∞√–X®s¨áÚ«∏—‚ç·ËhÕ«Ùπ”ãç]·Í⁄iüÜY©X$*‹Ôt(‘ªñ[çÎóŒ TßÕ*Ωôê.5††h†™’| Ç]ufëfFGÂπE7õõqBÍFrv√'∆’“:—Éóû3°¨*tZPhj‰€¢˘ßï∫
»ñ∑ÑÕäÃO%¢^\ó‹Ω˝_S$+°dÊL x0ŸÄf∞≈´G≤_)¯ÓŒñ,È	∫éP?ÅçÒN6£≠=¶ÁÿX.–=FïÓ441k2ùŸKÀ«;ËWÖ ]Ã9Œ:ﬁ∆‹ŒyO—1¡É<–·/rÒh6Q∂‹Ç[ÌÎfQàﬁÔ„8WWÖızÌÁŸœ≥ü–¬q.ØÓÿˇπg|ΩÂÔ	(Ç)p¬O√(ói±&¯ K¶°HŒÜUôˇL‡_¿‡3Äµ7Mf0Ú`‚o&û3:ô¯Rº6§Y‡∞Ct1< Ü∞4ﬁ_˛ÚÒ&`À»È*»•o‹œ3êFæ˛üù~à‡ßJì¶ò≤ÁŒy∞¢ŸŒ◊_ãW0ºµ‹åï¿S3ÀE]‡’Ài‡\lÀâ¿19]äöŒhåp–Õ(™◊ºXWq1â`Å≥‰›f√` b’G Ãå 3ä∆„xÃfaú¡¨∂p‰|ˆOº“¡5¡…¸SÿÅ˙ºÜ#j◊ZÇ&2e∆TøÛ¥2Å±]	AˆaefyÛCckËA8√^F	¶˝Äï√ãêTDÏÃ(ïìû1+‡}`Å¿‚,ÑiæôèS@Ã¨!z ¥¶QÜ√GE^öúáÙö)=èzCªn1gp¢{FÔ∆ÇY¢ ¬@Ã—e√!…4ZX≈èxqH”Œ†ªp.KGÙ8ÉÈ~ TE∑…Aàsù„UúDÀ¬?≥≤èﬁóN4îv(e‘Ñ¿Ù¿≠GM„-5_Fºv3å‡vÜ`é¥5ÓaüOpÎÑuÀ÷p°Ú◊<Éı/π;3M„ÄÌ¢oNûΩ<˚ßg«/ü¡ﬂÁœw0—MÇö3ÃÇ#• ßC\øülƒ@ƒ“1J<Öç‰$ N“ÑóÒ˜PçœÿÕIÊY
Ù=C HTZ„}[!%˚9B
±Ì#Œ$"bc˚Ÿ<¬û)˙Ç$9?èÜ˘´+úL˚ŸÂ·Ωò&ë◊Öúëà7©y$xÇI?Ñ4`-›SÙ„ô8¡yÏ¸<Î*?«yæÄ!‚ëæ0êEw≥›¸∂w{˚r[xà6
¥›È Ã˚çCV3eÄ0‰QPÜ/Aá˙>˜uZÄ∑8ÙxÙ)OÏ
‡Ñ›QG∞&ìE·BënG£—‰5ë™`ñREIƒD	0:◊} ≈”X§èn>.R œ)ÌœS†œƒ6 çÊìÀ≥êâ…bä«Üa«xwÌßt´Å<D=Ms˜Â‚(7H…dHT;—ô)°h"÷+¥áÜ´ù∞É'‚çÔ≈/ciÇ*Ø£ë8>‰¥ihÅXæÆßÏFHN…"·ÒP_L‡5ü«óÿ<]1√åÄ<¬òådnQé¶vŸDzX—◊8@k»Ò9ëò	˝1Ø{‡v§∆2ÎV—`MÖ√v˘¨&§U∂4+à;—hIﬂ9·G⁄≈Á‘àh+≤Xë¢Å\á∆wòÃ:π@,g6Akf‘ò@	›–ﬁÛ-Ç3!√@Û Ò8√VïpV‡=T£±)]îLié^õ‘üPßz*µBˇ∂âíìz=%¶∆åõÂâ~qd¨<Ï%ÁD∫ë⁄√Ê	AAá—üûÛÔ!V¥£B¿√ µE°√àS|@nûO<cµe;$l»¨A∆nŸ¿ë.¶»,FH√Y„ÅÚ¨ŒLÈŒàö4Å44I
tô!¿Ï±¶v∞‡
æró¿¢eJÄa√ÓáˇH9ê!˙SÏc§Ø∏7ÁSmè•÷å—Qásí“Ë…4ƒîg1(CÂ~dn oâÃ–”ø”M@ÊLXï\b'r÷@≤?îΩx4Ùì6ËbÜyßƒe_¬IZtB2˚˙1»‡Ã±M1»(D∂Hr»/ãÄƒ@¬Ÿ"qR‰6AŒ%ˆäÒ`€œ·AN-	@!^c)Öª°mÉæDÿ]¸j®qVq/Ç2ÌﬁÄD¶iÒ) ‡¢l€$˘@ÊaR∆—ùk¸1eoö—?ìK¿–Øøﬁ‹˛„cËÅV8¢¢&´L}º˘ñÔûd‚1ˆ
cº@jô„fã„`Äãè‘Be∂‘ëË§G6êÆ¬ÒNrò”ËS
‰ïËéWÔkëy#· >+ß$ú
¡~•µ·-CÇ⁄OQ6	•ÑÏ⁄Œ˜V\¥g_¿◊4?c4’T2&fØAZ?˛±(0E˘Âö<ıJ§Béã’„Wï‰Ïg(œAŒ–6¢ïªHpÚ@O‰©cÀ(KÀ”úºUËlÜsú„WP?,ê%Ÿh∂µl∑Ü°†≤\Ì[Ωx@â≈Ât.†00Üã∆{âÉT#} ∞ƒòTÎzicp2õ®Ès`_ºƒk|®/ß∂@C ®'Bt©%ÃIºç +Rÿd¯ô"ır±fJ®Hj„Ëü“∏_†Xè-3®§PA…Xgí5üÉDbg0 úB ¬f ©(r¥¶ŒÅk6Èãf$¬pÙ;êøíjG~ë‡âA4„E ÒT¢ç)“∞ÀaNΩ8Yå¯…Ñ—µéëjÛDÃß•åÄÁ›§» !*ﬁ·q¡⁄äEŸ'∫Àsqp'n∆‡∑?!µìHGç+saÿB)∆h◊˙–ÙÖ
V§Ó)≠äa	5◊* %>u◊âA¨–Às}·‡;˛Q ;‰òyCJ’§¬®∏≈ÏÍöoÒ˝ªæÑUQP__VäjÖÒ˙≤R¡jÑƒáÏa]ÕÆö1æäÀæ‚Z∞xÖwz›¡vﬁEßÙ˙MW.ÈP›¸4,çÄÔÇóÓZ	Çß•>Zç¿›W9£z9€˚/Øpÿ}å,ª∫€˘^3à⁄8ΩA[Pêi√ÓÍuÅLxG˜ﬁÅÊX1ÿ£„ÅåºUî¬2ENÈΩ£–s?»ùÉ÷úO©˙RßXB+bÈ‚e‘r ó.k†◊uEäv@ßEZ(ÒQ:¢„]C≤)£ﬁsc√ûÅ¥∆∏„*QKQ«ˆÇî·®°Çoª*Ï·+QTÄπÔ¶ò(~Å¯ïıoqΩß¡]€∏ÇQ‘≤†¯o·*R⁄>•ãK¸(•Ô˜∞H_––íûqœ(,5Ô≤¥iHÃ”gÍ#jáæÀ‡üdow°pÒ{£ŒéJÆZÕ	I4ÀÁB´ÑÚyÈ)ñªœÊ¿u∫ùøuVﬂnº´îT@Ô∆\‚5Ù[ ≈xmç∏∞~”ë%ÎJŸ∂¥Y#m ¶açOl`€†¶FÏR‹¯µ0˜@ºﬁ.h3¨i P√º|)3ß4√_Cˇ§∏â√'˙&Ï‰[¬ΩjI‘fK:Ω¸¨v∏Ø√˛hDRÍoµr,x&ø¡j≈™ëP7±‰Z»[´˝4.˚xÏË™âêïf÷]≠Ü7e≥Î6µBlªöpˇ@≤€%°¶i®KXêäµõ§—√É
e≤I'‹’≤¯4v
wı¯»†y•Ä«6æî ∫ê√® $¸µ÷ˇ˜€ˇ˝sˆ∑w˝õ¸˚s_~˘r›HQßè7fΩ
¸bB^cœX…#$Ír™¿~!øò±dç}gî>^+òåDŒ∂XÌ Œäª7TJc§µv⁄Vß~4≠J€∆8≈û„˝TÏÔV•ôYr§·“é®Ã5∞≠*∫_éMË°¨¸‰„œﬂπj@cùJŒíÒ∑“„Æq∑ÂT´ò<õÎ∫cCKZ†<@;¬`Ê	ÕÕèí·IxÕÈ(∆∆,(NÙ˜VÕ¢{5ëÆ™UºgıÔ]…˜∆J~yU™Ù
6á»C	∫FaÒ˚⁄^Û˜w∂Ño^“æ/&ÔPΩé—…a’ û-ifŸÇ∏9¨µim‹‹⁄Eè›!ÆÕfoË⁄BGã-∂∞å|›ˇ°Ø≠5¨éÆMlÏŒXÿtöÀ´]∂ÖlDÇ!Tÿèc"MôÛ¸√;I®9ñ8pPlÑ2?—/—^πãG]ÛútœÏﬂ√o^&öÇ´ÚàIµ;ø¨Á4≥‡c4F≈<&ö–Ñ°OZo“X#ËõuKVa6J·≈®èå bK›˛Ω"√Cü–ÃŸf≈0	Ábµ”∑3EhL8˙Ñ˙Eqp˙c3ÑTˆ,¡¬è*˚”Ã0˛≈0jH/4_øí$ë" —Ïmá‡çÿ¿TòæqªÏ#Ñ~^ùw¶`ï&%5ÒÌmqfÓ[ÇÅaëÊ3W#Çˇ¶0∆≠œ∏t«l†‚ë-XœMGµ„”W⁄Cè™Î˚Ï€˙n’í,áŸGÂÕ˝H	Ì4Ó"ßÀux˝˝p§@!-ÚÛﬁ∑kÒWUÓ≠•⁄T(ı˚}Öé>!}aº_˘Ú
æ^Øº_-*≠æìﬂûuÏ¡Ö≥aœõ4Ç¡Òè7'«›bÃñÃK˜÷ƒ–#Ç¡r”Z∑(‹¿rx@⁄œ>É⁄—O“ÌÓt˛¢Í>ºcö„S}È¡†V©è&S≥—¡$äG]l⁄ÏEf$sUK√iÚ1¨T+3ô9ä¿Ÿ$’f+…äíË›{Z¯ÃÉN|tS@6A)LêÏß2v(Òs4õ¢ÀxyÆT“ÈÉçs+ø&£3∂g√[©DoF„zOuÊ›‡∫SÇXõâˆ≤Qìa¬ÑßÊm‘Pzí6û@’ÿäímh™˚UöØ¢6«C{$… jû7å‘tÍ0’–UäÍ Ì¢¶∑Ñt∞–ÔîÔá~nnŒd¨3∑Xf∫R⁄Wß$Q
w¡˛∂xà*Ç^Ë¶±Q6·}ˇˆÀ+›∆ı;¡xÈöµÿ§Ì D’ê}ﬂ–à–‚g‰w[%T÷öwç
ê◊Í∆sµπCï3Vê˜¿Ìœ≥hÁÜÊÉÇ#¶@'Ü≥’5P_ü/»â_kˇÆk›ß·t”}‘«†yBAB1 π’s¯E_Xë!ÉNéˇG∑èd¢Dıq√vÿ	ˆ∆˜gWT‡ èˇ˙◊’“yJAï¢Ï€®Gp`^\hScºT¢√††çA>Èìát∑+ÀâıÍ(V≈◊bsccµ‘ã∆al≠∞\¿`ƒ°v¡≤ ‘∆“bIÉ»:= C[”⁄K‚è**,‚r≤»’”5Åq1˛*á‰5¡0∂Ìç’“°S¨‹vãîÒKVÏÇòÎuöæØï%]Ÿ≥ô^Ø„/iÓú§º(Âµ¬wñy@ÿÏÎ3j¬› \`|3Ñ„HOiâ¢†hTº=ïÍK~  ÃÎwÕÉØp´iô≤o∂ 3(¯´zqOJLÉi9ÈKAÍ ÷⁄∏s7@Ïå‚ ≤ﬂñ "D,‰n?ßËœlgßBì&s_(ﬂX˝ºÚ¿∏l◊_Ik˛21H¶ﬁ)ÍëWl—ùÈˇ´üñ¸ë´œâKÓTÈIQ¥p™-˙2|bıC√!’|Fﬁ¶ÊÙ-ÄA.aÂ¢,·U>wU¨À‚E-oè ŒïuºÎ^ìÚ©‰ÓBäë¡Ÿ◊0;&ªRÈ@RuÀÚúJ3¥$-„†4}7‘)›F!˙îo≈µ,|∆l;1ßßzâfxE¬Q›}QP‚`ÙJjˇv8—™J‰âdÎ¥‘=∂*¢ÆØÂUèﬁã≈∂.i#∏QñnØu1DÌr	ÀZCó4—ûjHOı¢ûÌ_‘,]Ça›™Ê◊t#/™Í-AµüqQÚ7∆Y<§J¶xŸÿ·ﬁ=]≠ÿTVI“±òÖµ[„æmö_òu·7U≠Xdî¢Jtu‰œâM	yﬂÿ∆Ç—N÷M+«68i¢ÂÏ`
Ê4@€ÊIœ)‘K é4s6Ö˛¢êçË7"çC˚"-/TŒ¥üÙ…('πè}’∞æ≤S‘§$‡	fåñπ”`|/à,({'¥˘ø∫"!Åi≤ÏQÈ‰î ˙œW?SµüØæ^Ø	ˆoÔ¨:Œ⁄$%è.9∆ífíNw•∞°RY!Õ˙…–∏,´âl&„KaÔ`^‰ıA™é£0Î°BÏ"8ËU£{÷oÚtK‚TUi™dr›R4Û∑%O≠=≥ªÇÇ¢ÑXEIÙ("‰…ápvÄAè†Èï"~ësd'z_ˇ∂íƒ»nöÃ#rR)
R4£ IﬁhRET±!Æ≤âÿâ˘éûLÊã˚˛ÇË2n|JˇävU/UrRÇ˜«‘<âuTÍö[∆VK¶˛√H”t$/YÒ¨|Å‰±à<]/w:⁄°ÔirÅﬂ-–¡oW¯∆7Õ"¢◊OSA)ZZ<AØÀø^‡Q≈ëp—ëc—™h»J_IãÂtjN•9ü°3[%ãy≈∑OÒËë%—'⁄XT*®‘	!SÇõ·õ.≈5¥vEwt;z5-¢˛ÕI0Ë¬V-)ö6ek*Ñ[Â‚â°6x9≠Púvò
pèKã\)9üßj¶Fõ◊Z·òÏàe•†á÷;éyòMÌßftÕjöïQi”à5>≠PúJƒL3ï¥52#M=ÃZP‰cíXK»OóNÏ≤ÉW^øØ	∏F.˙•Xx0ô˙wö‚Ã*ª¬dmà¢{Ue◊´¶UΩ‹diµıYV0Ï◊\“£Qî/π¢rK∫Üœ∞v*`⁄eÌ‘x’µsÖ¶lZº‰	∏{•ı)Ìˆ†+‹æ!4¸x|Ùìÿ‹ßoûúú?9:9Ø_Ωz.ûüû4ˇ™Åú’∆‰Ø +ÆRıπ58sk∂ãÄΩæΩQIa‰πµ"[ªÚ∆ “fˆS_b3K=·ïÅÎΩê¶jHQ9v§—®ß[wŒ›-ùåô":WÚm∏®µ'/cÜ7ÔØïÄÎèvéå:G"‡û¥/3ò‹›ØÜ’·ïqà˙üΩÜ$æ˜‰^ ÎL ›/ÅŸ◊Ua6ˇÁv»9_F˘≥càœ∞EGW¶Ÿ¸›ÆA˘`”òG†6Çµì”,üó¿î?-—WÍy3”ÈKRê+g})n˘ß¨öT2=Z	0Joêœzlü€F£^¡W ï®“îÎæR„hñ&p∂•®E∫£
b∏2J∂Å∂eõË ØñSeÑmGjss¨å∞
Î*üê±0e?‹ﬁ(ØPEæmZúFè[¨AY/“∏dÚ)Õ3qØﬁ¯´¿6¿o{©[∞ıà∑Ü/è”¿Ù6`~≈°iïÂÅxU6pn∂µ4€†µZàj(˙
mºrß“¢¬VVAÚ˚f¬+ù‰#öâs ’¯˜_I2ÖøΩÔ∂ÎﬁRú%ØÏiÇ@‰Å#hêCO©ÚÕΩ#i∆∂0Ì(Á¥-e
Ñ7R|5ÛL∆A6.B–,´ﬂ»*˝ÃŒ¨„0	E…ÏîBË®îlñ3“uÖq&¿i 	√+N≥◊SÅœxPò∫”6S˙d«ï=ô¿‰NüL˜)ÿ^aJiÑÂ@ˇ~
–§oRöÚ.”ö6%\ñyLòö‹≈'ÂK#ÁÀ™Ê´®iœ«Õió[2xc_¯(≥p§[Êß^,¨äXE5zCë◊#™Z•t!N9¯≥ﬁ`X„Ùë"3˜ù:—ì∑wÂ<È#H•)§aÃq5d™mËEÔ°k\Pó3ò’ÉAñƒxEáÁyÔ>P1†˝mõÂ4$‘Õ˚)Äµ¡Â(“9§ﬂÔ◊nn„n≥˝˛6r%¥€‚Ê*Ó} ¯Œó™Ò¡F”/Ë}èG«ô◊kŒ7ﬁ¥k’‰ïLñ!W2áy∂J)¶µCPß˙–çvn$LKŸï¯ÜMâ Ÿm™Æ€º Bœ«≈∫ù¥Õ,Õîû4°ñYa	ú¢¢R∏‰{2%s≤ã‡ÇìÙI-E#˙c,Otö¬xÄπù*“z—<Kyœ„‰¢˜â2Ê∫-6ª0“‰"µP€É‚Õ≥–Ÿ6ÑvIÓw¯6-±ﬁcE÷∂2a∑DÚ,úF≈a¥’2ÈQï≤ÆÏ±X(ΩÎw◊Û…r’+A7hÇºãñ≠«ìO9]ÿ>«%™kﬁ9$h˘∆øXª9è}SΩ∞w)‰«≠˘πrmQt˙A[óUWÜb≥Ûî≥£)&)6iâm
≤µ·0“√€ï! ™∞p-¶n˝∏4ÄyQ€”tC€ö∆êƒ8ΩªjÎà:Á/∂8ñ÷∆ùp÷{s⁄AèeŒ“uâf∂<Œ…0ôf∫#¨$◊GzîπyÆÑ—“0lÄ“Ó†z˚X˝îÙhn7Ú.£€ö€ë¥nV¯1o"ÎÕä@‚B'¸„ÀL^!yeUÖ∆yW
ŒÚ«5ü∆JBﬁu*ƒ¶:\®ﬂ¬ÉQê~ÿ1
}∑Ω?∂
?ÿÿ(g—t}v®KLÍ®ª√fW¯ª“>l—Ö}›Í˙ÄXwıæ¢œ¸RQ¢Ü˙ı®**iÏØﬁO.¨jBÓ“ÂjÄ{õ≥õvtf’ç—-∞õo€ÜÁÈ°j†~Æ<«I≥ÃÕhßdtı˝;™ü:€ÇÍ«Hz∫iq«6ê§e	"bõ•UL∆)P5gîIviwXq€‹/´ïõÊW⁄B†ıé('D˜ﬂ
ÿü∆ù‰ ·ÍWU[UΩ⁄≥L∫˙e* =kuP¢rJﬂÎ$~∑=˛îSE{t3eÕå/ÕΩ2Óÿ⁄Ø^º~uz$ˆ_ä”#¯ÁÂ—OßœèŒŒéNÍM<¥i”Ã;p  Ö…ÃFÜàó‚bÇÅTôVô∂Ö§ûVYÃn¢üﬁ&˝4›@Æ∑m*ŒÊΩá‚_∏ÖE˛Î4ÊTötº√4t⁄u∫ÏeS„∫ÙL≠ÚﬂVo©ÆÛHé\g€$ﬂˆ…´Ll•l•+e^øuã∂,„ÿ˛“á¢ﬂﬂ]«¶[Ó«@™w€•L9∑VŒp§ä∞÷ÖH¶≠R}'€Ì¯-?4¶Ø—Ä7G[H√{Ù˙?™¥{ Œ	7`ï<±√º0W"âLìﬁñ-Th]¿$ç¸xÊòµWﬂ<ëRkqCõ„—Çc—ÙÓóÛÛ]óA¸π¬,*˘dGºˇ≤©˜‚∫JG+ËXΩ≤rAFÅ‰ªççíë±ÜîaÜ<Ô›GÖË∑∞.Iqb`U%…4µsêHQâMådúƒÒ H{Ë.„ÄÙïJy»ß‚8Øa®˙ì˜pº;ÁSqƒXgàëPπpÈòﬁ{ùUÎ*¢8xvù¬5ﬁ®alΩëH6Ï\ªŸƒ≈˛Jiƒ˘SÂî^ÂgÕ˝Bìq`<6å7∑àL>îî3ÀÉ¥,\";zé
/å∏ÉÒıœ£±ƒfÒ:òÖqâU« ]Bo=‹ÿΩo
∆·æ„ºë9êﬂ h‡907\ônˆ≈¡$A´_ÌÁ«÷‹_	Â0X{Q·∏;e?6`ﬂ	•7ˆ-√ÈqD(o«ú√≈óúô(:Tcxq÷Z˘=4_§÷_•˙ıÂ˛%RQÇ
G‡@å(„Ç#ÍMV∑º∑KÆ∂4âÈW%]'aÏeç~%j”ñ—.ä@&ªÎ‘ãw$Ø-/|lˇQˇa¬º˜)úi´é©≠Ó„QvW4/⁄ZƒÂü¢˝Œî•˘ñêV)ΩYB±jÜãln∞Ë∆„ﬁ√3¿ö”áù™æ∏K–Ê™ÜßíÈû—µåKu‹WÜ˚⁄…@reœà¥k€gBG õ˜Väº[ÿ!Í<Fdêù:Ãoﬁ-P§ïΩ7≥Ë√ßIo/ˆo9{£≈Œ¸®YEK˚r–Ÿ•{)ê6ãOQÔír‰ªﬂ	u†$@öAê«¯4ög‹â0ù”ó%éÏ%!ÇåJˇ˚S
À~eOﬁQ÷ ¶âƒcÈ›b&YXŸ{%S‘ÈXx&X◊;vÈÊ)É¬ ^CJ¨◊ú”kÈ÷e>úïΩ¯ãN~É	·T∂JŒè¯˜d±<l»xåÓ˚“ú”ÁúSìÒ$∆VÇŸ«‡é®DÎ5F=Öÿ]zå¢_ú*) -.Ÿˆ˛Md€≠æ‡ÿ«Îx9|©tXV®=†µå˛ Ù2 …∑˙}#XRàÚ,√íŸßà‰…ù˝V"ÌÚ\„s E<"XÀ)jlçJ÷Fa‹/(Ò¨ëuUë°óIÑ¬GGïí Á)Â¥?íë\Z û.à63q“≠èÛäøèe~ÕQB÷uÅaVÓh¡Ù8LwÅëyT÷Ïh6H>Öô◊‹L/∑•≥ÃÇ!yn∑‰^Ø
¸,πÿHõ™√˙
¶2-©
;‹J‰ªQcÀñ>ñ1]ßP6]ô‚,£ÉöuµQuiíMü°Ò4å:À>∆ŸéOãm,_k⁄éCd9 Ç£i˝‚í5◊∑Mç¶Gı)]m·N∫ ß„r?RCEYƒxÒ⁄l‚Ã£Ú_ Eééí1◊:•,πÅòÏä{Än÷µWâW+
+æ5]åﬂrÿ
˛˜µ5vˇµKP “n$n∏u€ôT gå6\à¬¶qvaIqLOôΩØÅ·Ì2<àB
µd?|˚—’ÊÉÏâ•ê ∏Ê4GãFÁüBÌhRü;c\:Û‡)«¥≈;xf<Kƒ˛ù+Z≈<G" 3/ëŒáÆâ´´&v	5&Óñ«=°ÑÌDªÎìﬁûo†Ú≤eìV;†KîÁ∂ÁÑ˙($5∞ﬁf-êﬁ!E‹‚ö≤^=qÄ∞µä∏NıcäqM˙uØ–˜ˆUkçb+(R‚ ﬁˇ¬?¢+u85ï∂PwVµC‘Œ û3ÍÒ∞ç÷¶“&keÔ ÛÓp¯È…˛‚I0õÖiMJ≠∆£^3˙õÓ¢Úu@,†y∏d?øAá˙\uﬂ™òk¢#ÔwÒ+ﬁG„ﬂçrﬁ°Üì÷≠ÚU3YI7ò`”®Zô÷“ï45Ÿh	÷J∏‡O’Ò›äJ3X∆"w“{ÚƒC€BÓTˇAF˛ºïÒ≠≤ç•hÏd«…‰¬@£Ì≥{õõ ∆(õ≤yßdUÿÔ<¿ªÜ€∫*å∆Ò±é(æ¸Nì:~xéd&Ò'¸ó0ÿ˛vcàSZÆÖŸ‘»∆ˆw~∑|#¥'®ÖÌ-¯ﬂÄ ˚ópssÙ‡€Fp∂3r‰mPä˙_[≥—P◊ç=s7◊ßr®ı⁄/#√∑F”…äıa•œ¶¿>IÆÔ»ó•ˆçÍ	Àa≠o¿¿á≈i‘√7˛†öπAT£˝¬“·$~$üÍH)ï	GèÆ.TÔme'Evı∞±I6⁄VpRÇê√≥À“™8Æºt¯	oO^Ñ≠;⁄›‡>Uü‚ yéÇ5^*wß5˚
÷?<«I›É≥˝’∫C≈ÁAÃ"4˜≤òiÑ˙˛C¢¶Á≠ëz:ÔGU√,9ã#äµ—√{«9|∆ô[æ√n—CÉ-˝]À
±©F‚HΩ÷]®Oı^L˙⁄£t/>Ú–)£¬7	 •ÛKú7Ò„π+ò(_ﬂ}Å˙‘ÚZK~’5?ÒféïÁHÖ>ÁÚÎ¿¸ÌW˛MÍâ2R|<èŸÓ|›‰œáµØm€[´öÔ¨˝πO⁄ßa˛4-“gÌ&Ï)ÖØ†Êqxhãb~Ï’≤Õ≤<MO„ÜJ™•	∆-‰'ÔèéóÉ	πÛ€ÈsAD‡—‘
+HÖíÈM…™•"WmÆâ^õxy=z˝Úü„r…à∂“ É?lzõy<o
…œ‹':»∫Ã¶`¯ØÏ˘MÂÂ•sÖÒ´≤Âp@4∏cj≈é#i§…GQFÚ–£¬„´›E˚Ìñ\ö E ò}{…áŒ=mÈÓÆ„[n√ØÕ∆D}vk©º”Á´m˘}a‹πÜ≥øê^´~ø_√Cºƒ≤§›åWÑf4Ï63 „c(M¿\·Õ[O√Á„È˜,Ωçû£Îy(PJvZA{ŒﬁSï7‚±\:PÚ‘	
“,g)oñÌ:oñªrú‹øc≥ds¶2âeí¬)˜~[w¬J.ôr\FctñgæãÚñnäå–
N˛qåFL2áYº”":p®∆á∞ÙQÖõ}ÅÇ‘È$åùÊõU:√z≥ƒà•≤˙Sl˙Àñ\·{N„O Ìtyëx<;Oú¬Çcà:ö–ºê ÖäS≤íç⁄H6^»4±Ê
Œ^†3I≥⁄≤ﬁr®ç◊m9pçN'˜2 ⁄Ú0<èf”¡ﬂõ_¿ÛÇ≈3KπÖ6a-8D⁄‚n9 Ey “êÖ≈›5 *5π!GH»ú%ÀÅ§t6ç®*Ü/ÙÉmK4˝f√¥‚r	EJ∑YçfìπCá‚g?éïo⁄l6§MF∑ø]rù|√ÆùLÒö€ÜÙ†G©∫C—eó„Ì√C¯[îÙ”¸¢Ã8ÈΩ›ﬁ N£c<ñ8öZ,€ËçqbZÉØC*∏œ^≈Å_ÔXûπé(â¶iyo£˘.5˙RIÔÌF„˛;ÈI….0R ÔÖ1¯›yíkY/Mrd õ57˛ ujàjÜÆm;>}±I$¸Ωg'GO˜OùûŒ5=Y—
JÒ˜9-ÿ´ßOèé˜üã''ØˆˆOœj˙∏…©›≠‘iº£¯ ¶UlTär∆9ò∏‰’(904[£ŸtëÕ->I@.ü6]`ó/[óΩºÆ‘_ˆ‚∫“¿Úó÷◊◊|vŒó˘V©mN∏z≥;ÜçZ‰∑*®ûM≠úé\~:JCA$ô¶Ímß∂ô8zyvtr∂¸Ú|y~´v4’}W´dÙÓrSÒx<lÅı#¨÷"ŸªGZO∂Xı°A€Í~Q^…±å<æ‘R.Ø rµR≤´∂“•ëk\ŒÇí˘≥ÊÎäœáhºíß˘b%ıv7´à√h±Ü7ÜÜ/É¶O4°S©ÑÇˆË‰Ñó7Ÿpﬂy˜€ ﬁ>!gy$–•<ô≠âg3¯gô#>¡‡AÌ)Ü¢•öáL≥bö≈072íÊÄ˙~Õ¿"¥‘ªÉ‘x Æ˝Shˆ.ÒÚgqŸì¢ªJøA¢\©y•˚åÃ=i|@◊‡,¬ ˝ÇèK>∑"?”xP1)ßM«Ø·÷√Œ‡S≈…˚5Îqe§≥Ü…Êqîw;?œ~ûu§·„<HÉ51?}2≤Û∫>ÎÎ@’”K128=2dd"mm‡è˚i]ÅÉgMÃ€Ó¶’∆AÙ)ÚLˆ¿Ω€˘À_˛":´´5√—i~Q?Fˆñ8áÎ&¬WP∫Ì*•·Úáq4*«5eÛ≈_ìéÏ{Ôê¸˜QŒ9nˆaäx‚ÆºÈµù{É≠*‚ú4Û§…6˜ë¸aêhÏQ∏Gk"Vò”¬¯N∆jäùuÙ∂∆G≈¢!laÕ˛ﬂˇ˘ø  ‚qœx⁄tı,‹öÏOù›7—¿ùVoÇN
ÛÁ∆Í2⁄^„ò}M˙hâ4ïÂg˚lU{eŸ⁄bß¢5∏TóÄÕGT‚[ÌÆÄeÏaæ(7íûñE-˜ÌE¶Ëo+ùÓtdú¿˘¢L)ol{cæ°N£}å—VÜ»À!ﬂˆ$ÁiÂfÜ»wp™„Oçr≠õ@£SùPQª±ùª¨ﬁ‡iíp
ı73∂•5 *D∂Ñ”&@I¨R˝f<¸N]˛ #G£õÛºIÀÓ„©®s◊Ü^ÇzGá—‘<ãVOù _ÀÉg©·|g6|PeT€0˚≤0«•ÄéL9”πŸyâ⁄ﬂìÖ‡‘Ã±·PÏ§‡pâ:hì4—0Ú5b⁄˘a∞»»…“LhoûπN¶"»XTGQ`8bf}ﬂN≠úêj¶$éN„ﬁ¶€b†l& 7õÓ0&ı˛ÑøJ™¿väÉ	?ÍÖyÁä’k∂˙≤æ9:¢ﬂﬂ˚/^Ô?{y*~8>={uÚwÒ¸’≥”˙ ¡:∂ ¯FAbnù™uŒ&ä·™ÌTnmoÃòJ¥òæwFßÕ)h«°@>9«∂ÿæfAßiB]√_XgÓ OLåóÒ-ê8Ã‚«¯"«¥O§íËURÓ,w–fr >ZûîS¢{s›]¶ º`ƒı.÷t|DrŒå@òDà˛ëP€l2Hp'`>†vìköCs†; TóË∑… ‰ æ£Pöm:◊ÂÌxm&G+2(&ïõ¢˚Àe)¨Öf\∂æ-µ_¯rµUÏu†-˚KvΩ\."_‘¸ö<D∑ÃBtUlxv|ÖüµÁwùxKﬁ ÛP≠MâÍ¬ù®ŒíÉF£‚R5§&X.N’`¢MÊﬁSïJìÒJØ∂ÇI“øıò%∏Õöí(Ïl˚≤¸(¯mCæ¢∫ìëhJ·K6ÂàM_]q=j¢
8Íç;^˝;πj°û¿O5∏ã”€¢˛éº⁄ˆÁÛz1„"‹ç&¡ﬂ‹-|õùÌ}F7Á¶º*eZ2ÊdıØ∞öb≠ ªØ*Û¡m*°]cí•ªoÚkYr£.'b‡G“iz€tmèÖQÂWL’÷ò®Ìf–jN÷‘&USs~wÛ√âö2O hı)Öì¿cÕkºï»íA=ˆ◊›÷≥∫ä¢†íäfk£‚ÖPI‡d∞¬%s8ï28•!NøáSÓ}©%ùÜÄ2‰◊	’Â|ÁúÙß∂Ûzäq¢JG≈~™›€M)õÍ÷üÆ…}•·M’‰I‘‰:êôÌzl¸mÎ~[◊"≥eQˆât ˛ë/íQãÓ+ÿeF$>_ÃÜú;! /WM˝À®î}Ï∏t/±ªè»¿}P´∆`Ìt]ßŒt]”0ÀÇ1î⁄OY#ó-‰óãÄ<>“)øã≥Ix)."`˜  ≈	 t™≤C`¨&©1Tv®ëZ+ÄlhÜ›†/Âîk◊vÈ ég±N¶\¸x‘ùÅb,‹∫±4÷2Ø~ˇ,V¯â/…Â*à§·9CáVÔ¢ Œ∫|ØI°wƒ€‹x≥FmåÔƒ#{S¬Üª à∑Ôˆ∫oﬂ—Öô¨.51k äæõï∫y∫ÕÚú~ïä?•ØVù é;¯Îú˝zË{0üß@mFùΩ.Ω7õ„=≠∞;YMfƒ¨†„Û{ƒÈıuÒØè2,FäY NäÖa@udLRÙe˚#=Îc˘√ö6ÁÊ4
∏c ñ*æ¥Y’Yp9∞M§Ìò€fÕxvíƒ∆≥îFΩ#∂˘'“u£ÇÑﬁZõ#1ª6áåFœç‹◊?ù≥ÅzÏË¸£
wcnÌ®Ûe;GEg"ÈékhCT‡TguM∞Ò„e∑£¬‚•(ÃÜùUyÀM.ıÙ#ÿ/ß≥`≤Dﬁ˝eMt3˘√≤ö‡ztZÄ™Hî˘¥_Ë®]»Ê¿ûbäU˝¨ﬂ«}ÿ‡AW…,◊´˙¶∏¥M∫‘ù˘VB—¿®C”T∆∏2«´Ÿß7›ï#¸√Y∑gt˚êò∏òÌ¨¨	nCuñ'Ëı&k?2Ö!NZc÷\iû¸´Ïhî¸ªÙ&A@£˚KûQB“}∆5Ä{ê]ŒÜ¢ã†Â∏&§oÁæ∆«Aí`6yz©·\Q.iÏa2ƒus‡“¨‡S±ò∫ﬂ+u®W—ÜúÃJ’-ïx≈Xb!3ìÅàj=V›âØ`Õ>Ü˜îØAÇ¶H˙¥02‡_Ìí”Li≈ãÊ[Ø6É…¢Z•Ò÷„¡•´¨Ls>zÂåUAÀô{ä–ÆJ¸¯ﬁ≥`\Æn¡tKûÖ∞‡ÀÖG¬Ãfa≤¢˘ä∞ﬂ¯‘ÕMÅØÑä¢j=‘Å»:A˝ì€ˆë-°≥Å±aç∏‡ôLí—ï]–‚ÿÃ•_<´ñﬂ"{(¿aÕÈ5ÏGê|œQäf∞“ø,"º‹9è¬xÇéÜÑâ,ÖXÃ£‡˙.ûÉ¯—ƒ#ä=ƒ∏ƒ>ı+Õ?ÄŒÑ)IŒ‡–	®?ùdªû¡òJXvœB3õWÃ√≈£ãÁ6ü&»ŸºöÜeÒkõàIûmœ√:l
æ4ﬁ‘»ç∞™:QêÖ”¶]£50√oi{∞löªy∏â}.C◊¶P¸ÇïMJzTƒJ‹√Ú}÷Ôùï¥ò©k9*…7∏,ﬂKYJ).éWÚ≤$h⁄ÉÁÎΩä\Êò_NÈ‡uÁ´VU9Ωöö˜™U5¨-ª≈fw¸wtˆ ¶;Ù=M.<1/»®íÃ 
\S	\∂ ﬂùlV4[∂˜ìÀf‹ê—*ÌÓ.í<¥ï¿Ï9–tõKj≈=>]©D\&‚V5ÉªÎìMÎ∑”Ì mmÉ∆}∑∑¯ÓΩóQ ‰ñÁa8BÕ≤ √`>Ω–Ü&)úÉ\’lú—Ò-Ö'	0ç9L©o|n™l√å'ïXÒ’©öZ›S''K·é·Åaß"1°r•z@]ÛèhÊ`.
iù·Ω˘–P7ñı9∂≈ã°=éÿ^Ë5É}stoÿ≈C3cP;sÌŒûU≠NúF[x©ïP⁄e´„˜l°]¨Í©œê,äßA∆DéÔó6~iß≥?‚ëﬂ>ë›™ïõÀ‰®‚-{ﬂ†.T´%$ÉìVªß\!USßz∏ˇah≤_ú´0V∆ÕÒƒåàa!ä‚èwÑ+EÄççıÕªÔm«uÓÜÑ<à“aÏ¬•?±Ê&XÛZFzë@°ÄS˙›qÇÈ ¿SA){›÷p'&ŒË'UåŸè√4ˇ‹Sby7]÷>≤Ó3ìº°˘„Kõ©∑∂{t‡¡πïPd™QFp Ê >°"§Ï2úøµ}ci§‰«êÃ8ùäAfÎ	Æ]bzs∏£ä0bâ!˛œÀ•iì9kŸÕ,ejRc|]>ë'∫/¥µ√˘VFEÙjO‹WèE|ƒPä∑eÂÄCaaÈ	Jâ^}>A’P°˚” ”ä^Å”≈a·3À˛Ω¨.[9¢ö‰Ü+\∑ÜÿÏ›Ø!ÎtnºÜtbDä˙Œ≈3º
{yÕÇI4cœàye·≠ñ◊ÌÁÚÔCNXOﬁ›∆á…k≥∫4zKGÃ∫zªπ&∂÷ƒ˝5Ò`MløcM‘b‘õh6$%!ÛMlÂ∂IŒ™ßÎ6®´‘é8Ç/n;9…∞¬Ù‘≥˝Íjsåîˆ#w/ˆÒ sT)Ï<ÿÿ†sy·∆Û∞ÍŸÉÖº˝˘≠Dj,3u\ä‘~˜‰mPMÏ∆˙î>é•¬?˝ˆ[ÌıbGŸ◊ÓîÓìñ›iUä”^∑»OË+Q¸}≈(‡©<‹ıöb˛Îxˇe¢Náûz7d ZÁ[ŒP≥'ê∫Û®¿Ω ÖÊ§-≤l˚r∑{p^"ÿ$ü∆Oì‘d)√ƒ≤Ö’¢Rl¢áÄñÆVE4%«π<$K«jPsyÁ¥ÓY∑?œ„\≈Êï≈À∆:Q§kü‘…≈úî—ôì—-lÂﬁõÌæk%^Y¬ïtjS±C∆IòÈó’i˙\≥ñ›r"√¿ΩH“Ó˚<J∫qı±xΩ´@≈⁄‘U®F”Œ˜lU®π∂°9∂áœ∫±qb|·s4ª∞=r-ÓRóïxMŒTÂÆπ£ ±ƒÌÎ«‰’ÙıCπ EñStösﬂ%4A—ÈãzÄ•U6∂ó›])g,≈’ ê‹Ì∑˛†¨©˙u.ãæËÈ◊$»æ°–%©ãq<C„ä:7Z›rìJImidyΩ#Ω•î"cƒˇ9ªdÓ©‘WUíQ<@.rkª"óc/ÔU»Æ…›∑düπV\¿Ø◊Íï|è…<˜©ÍéStîÇ ﬁ£}â&≤ù)uÁÆbùy>!=ßdú
z©Ä˜π
ﬁêˆ6J`ıÑÎË‹ÔrÅI=I:˛ZÍƒTπ+∂=·ù'&œâÿkˇ	®z˙iÁÚW~·-\ßÁ≤√Ùü∂…T£· µÈ‰|ä\“3\xb¿’Áˇ∞˝ı@J<:;9>˙Ò¯Â3q¸¯ËÂôxztt¯dˇ‡ˇ)®6ªµzÄZ.SúeΩ”+ Æâ8ÌÙM}i€æ¬LyÊ)Û{7ÙíÛy·ñ~k7Ù◊Û
Ÿnä“b¶G˜Í4\^‹§Ù\÷{[Û’√0¢∏∆˝⁄]üu|À÷R:ä+gqÁV$äD™ùﬂ8Y≤’˚çoﬁ≠ﬂ∏€Å∏Fcÿ"¡[M§ï=û£qy”:nŸàG ÀÏ	/»!îÖæNSØwÌ ¡ç2è˜jS`Àã4ò◊. 
œïN¯~ïÙÕº2ıM∑Å0E"π&TqÍÙõ¬?√n⁄O”‡≤èÅM∫WÇ⁄zJ5,Ê∂∏ñ"Í?÷D‘*≤"kìyØŸªÃ»‘R≥Ãü˙∞ÜwåGKc∏z_çaôXdo·=q4§1∑Ïsõ\”Y»6R€ÿ6:ftı¨ﬁAΩ†ãÜ˛v®?Fr›ˇ4˚‚'ïûäõëön@ào¿vB 4¶¢Ài*ÛÎôhÎç›§uk%ù[-∂Ô^÷√ª≠èwÂHÍòÍJΩf„Ùπ9Øﬁ/yöoÿ[¯Yj·Áq˘ØtQaL€¥®π¶_)K’v…Q›∂ƒkå-—‡`^èWÆ-ˆÄóÌå˘aÌ´”≤Z•ñC‡Ò$Òe˜+>7D_”ÈJ¢Ì29dôÑ¥>fƒB|d©wπL)⁄ >Dbπ≈yD1™nµÑªgiêM\:ﬂF&›fÒn¡™ˇ≠"T‹‹˝ﬂ8
-Áˇ?«DB3òL|i≈0‘ ﬁ±˜¸0òÕí\BbL2}Œ˛ VŒ˛w‰‚ˇcg∑$%+—íè@œÿ√õæﬁΩ_ˇ]9‚a8ŸaJtÌe/’ªŸáPH‚àæ∂Bõ FA9<Å˙ÂÃ't,|ˆ$‚¢ås"≤ütÀøúcâhvût÷p“¸#\ÈLE;ê>à˘Ä1c]ÎôÂ+»œﬁ§1>˙¢‰⁄œwp¶wˇ©˘‰n¸?2Ú˝6Ktiﬂˇªx˙ÀıY}¸%¸Ô‘Âº¸Ì∫ç~˛B
†O£4ƒ¿±!áGΩ&^Õ•Â¸†kˇŸ—ôqÔ.l «µØç ∑”c∏gP	Pl€{Vø-‹ûƒvaå@(C<‰#"=≤p|  ¿oG°~QhÒóç@ïJëñAè7Ø˜œé÷ƒ{'|◊øº¬ N-"0@>GÏﬂ¬7!PkÙÎÜXn•Cïn≤|áGœèjóOA©a°’r[X¡.œÄÁ¨WQsc~ç'ÜÔ’Õf5ùñÃïã““∞jˇxÕmπÑ¸ió)v≤ÏQ˛˜=DUIfÀ≤3¯NÌ0ìñ%LŒÀÂä'vØ?6¬.gLS®)ƒ©*tOB	%ØT/Ï¿r¡¶NJ‚âcÊŒYVß$◊Ÿÿ÷<FTù(ã'wCr˙œ$H⁄≈¿@KÁ%„`Xbñ/éìÖU3ÀHÖú…LÑü¢¨ 	∫¿“Nˆar9ç%%0≠%4⁄T¿fñ*0©(¶ûôÂ∑åÓ‡∑˘ﬁƒ≥¢TÒ¥Zñ∞Ø\ÍÇØÆêˆMyI¬“˚„ZÑÄ±ˆê(ã6ÓŒ’Òƒ7Òä»ˇ3V∆,Ÿ"jÀ+([ÛÆ†≈55Ìﬁò[gÂ±ƒÓ÷<;Cã¡%86Ô_ê)]íìˆ„Éì#»t-/kÁ◊ÔQQY/ﬂª∫ÿ$Œ”Âœ8#∆g˜Eè'ò:∫9÷à6ö/bÙsFQ{ÄOß‚+Ò:ô˜Û_#Óà§ãtåY®![ÃÜ·î2¿àÊi2M8®òÛ†D>	r4yÉT\L`—$ŒeBö›$ˆ»’=≠#*ô#9î]÷“ñ¸e´Toï§¨xñPCÔÂ}ãk∏‘»eì%ÁÑÍÔ´ÙtKÑœ;ÀsxB"ëHW?•ÏQÓZ≤ﬂÿ•‹™É‘Ù≥CÁkØ—›é±òˆK∫∑ÛM/çÍ©IqØ∞$*aÑÿ1§9Â˚LÊãπ<Ç8∆Ûô˝÷˘◊ˇ8u÷0∂}Vıípÿ÷√Ÿ8,¢“”PvK°Û∆.ÕßÛêr£Ω:?G+ÛTúRêqò\Ã0<oç?ºÀ∫\`‘¨cƒËi≠œz¢Ùﬂr°Õ;XFíÂ[ÆbY“öÙ67Ñ4h5|~m?vœ¥˝ï¡º4ıÕ¶Ç}œœa∞fA8Qá à~C˛°
mÁ™O˘ôjÖ~òŒÉﬁÌ¯l¢ÅˆP≤@]…ï≥É˝í∆∏ÂzH7DéÁrB[⁄ÅiG∆∫©˝°ìÿ∂˙]ÿÂóΩmÁ›¥«∂4aV¿Ë±ÇöòïΩc¯Wtü¿ì’›ıƒÈ ‚¨-ØîVˆ~‚/¢ªè&EÀ5"OT+{ß¸Etèÿ∏bπf¯Zët‚5
à11ª∂)fi˝°}7ônºêj u±oÃø°gE–Œá”O¥fbyÁM"™(π(eÆæ¥◊ÁJ7å–â(K ∑<TÑó\‡Nù<ˇ∏"»j+Q<gª yf ÎæöÛë¨6XFs†óËˆ¨ÀT3›Xyí$ƒKêáAyM4<IoJÂw∏®î˘˚s≠Êõ4æ´≈$=‡ç◊rıÇ—êsêNÚ|ûÌ¨ØáüÇÈ<˚√d˙+»Ò≈Ø9{{cW¥à[A1+H9€£S[m‹
≥¢™⁄Ω-	/‘∆-T¸∫¡)\\J·Ñb˝él„¶≤/ÔÍe:TbÈFD
—˝	OÁ πˆÈ®ÕzçºåN„’ƒWûù{€@’‰“Q˚°ÀÔÎ◊QP´Ö¬èÍøQdÀtÍ∑N`d˘¯›Bè%Ø+,~‡ÿ€ˇÛ‚¥è¿}s»Äõh˘dDqÄ1o<¨'
“∂´‚ë† «‰È"Œ#`àÚ-Â≠g˙∑f+‘•Bê\e‘N¬)pÇ_0Åà.w^Kæòı,ìÊK!Ï‡ﬁ›*ˇt‚Æs‚~˛jˇ=∏<>=>{u"ˆüùúù.Î¿-Ê7pŸ∂ÕŸiª/ààïÚ%»
J∂ò™öÆÔ¬—Ωv≥˚”õ˚¶ﬁ‹Üí˙+“e.Îc-ıÀ'7é§˙uc‡!ﬁ°zrª=π˘n£Ÿâ{YÁTåÊçJkJn˚®*7Í∑ﬂﬁëÉ™t°#≥BŒ1√˝vƒó€%anπ1hgÉ«w‰°∫Ï ¥á√ùª‰6ªÀ>\]·≥¸]È6x‚∂≈UÆÇ∂çiìo‡Øù]˙3«`‘Ëõo6Ï}&ªU1®‘~Iò08tÉõ±C ÙíPÕ¬µªº∂ÎŒ9ﬂ‘uu¶M^ôÕËE•™ÊB.3°M¥&ûQ∫c$zªπU5”¡ ™õ©{=zªÖ¡RNëº2 ?÷ZøÑ£O3åjú_Ô6CCÑi¸‘yö”iÆ‰h^5ãoùmºâ—"{ƒf.ªyª8•»”víÒñL∏:’∆˝t«¸©Í¢æ’"éÑä$A>ızÙk€ =–#≤‚f˝“ì≠¨¨Ê˝≤‚ÿÑP·Ç˛µê‡À+œ∫î‡æ]6àÏòA∆nr‘ÆÎãüQ´áRÿ£.Ú7ó¯30∆çc(o">-Y†} å⁄pÛ˜}±±’ßâk‚X€üq˛å˚‡}˜g‹˙ÿq,S€ªâ¸`i+eÏ÷ìÁ…Ë©¿PaÍ^è¸±2H≥vºÊC}˘E8@M}õÿ4ÚœBáÉ pæN¥†≥„@ ﬂEDÁ¯Úá†”1C∞Ûeª«o5%”$ã–	'ÍWMç,œÇñÈxäæK‰Ub=jSΩŸUÒâÛ°3JÉä¶∞ò„ÕBgØÀèÃ£Ï±&‰Ø˙XQvJû@≤ˇh™Ú,NAÃ√M“KY∑Ù¥æºßa1gç±Ûûómõîx„j–|U€‹0ò}≤ìú¡ó›Œ^<?†«G1æïÄÑËÉ%˝Ë±:ES‰–/ÍCR»*o∞∆# –‘7>°∆”¬èú^C˜œ¬)D∆>+<Oﬁ˘8[≠|˘åÆÒ’a2‰yjGL™–Y3÷_háÁJ¨9p#ﬁE—¨|aÖí¿π‡√>9àf›U”}î[«P2 ÜkQ8“˚æãÔ˙ä$∞É≤]í6=3‹∞Ì2z´sπ4q≥∑6óµ)@©ì8ô_õΩ.—òÁOfx◊)AìÑ∞A†”VÏ!∑`ë©=eÄüãTóZA«\ΩóÈ¯ñç7¨Ωpf≥7\:ŸD˝V»E∑®÷€ØﬁD#R∫∫±±f+àá\	[ã—T‡°}*K!?pıhÛãVòníé¢jã≤a„£8GCÄ"#î‰{Á∞$∞üÓ≠j‚2Û]ø~‚/§x)‰ûù%ã·§Ï;nR)h@ì+E9L™AÔtF¯+ÒiGl¨âK¯óg©Z√,ë∫≠>Ú	ûua^ˆ©óÖL8Ìøä*p(…'bù‚ï“/JOBrFî≈˘ó◊cÔ‰8˜0Î†œê·ÌNûÁ}˘“∫ Æù¶	UÑÅË&ﬁnº≥›·¨Üf∫T¨œ©5ˇKÙxƒx°∫*æñP(|É/K˛Æ*Ä4¶Àˇ]!ØÚPµ\¥ùÉó@∏LÁ_ÿ°Ë[ä‰t0Cæ:J›
õH5Ã?Y(Kˇßº€Ÿ)¬«-‰üJ,S÷«}à›€{≤´|Å°^éAÚI◊x8Öc›Y“Â˙˝Ok≤•˛•2B—È»g/M[ÖNÿ˝˛Aèöö:(cô,Oì*FìÖ∆…‹¿‚ñ†±÷ÕÙ
GØ˜íPÌ≤R¶‘Ûù ˘)∆c—¿œ‰õoNûw;v∫>üç;:®^¸0ÉTóΩÒ¿’∏Õ¯≠êEVGl1d
X`q†Áì€¨Ÿ‹§,x@ Ö¥k≈ŸO)A€,DπdË<ÆL.ﬁ‹¯˙NdN’x¯
GM‚¸o$˛A0á˙RQwæØº˛_	pQœ{ﬁDß˘eå+ﬂ˘À}ç¸D<˛ëÿÍoWaçÚíu∞uƒK”KÒ4äçÄi‰+á˛¡ay£‚∫rÓc ~äÄKDÔ¨∫C‡téÜqƒ{d6€2*°E0‘ó‡Ñ°–ÉÔ Ø»1É‡pØ“ﬁØ€AßÜiÙ/§9∫-’QÇJ•~ø≤˘≈ÒÎ@ë^4˜Ü…tûí=A1DI~éûÄxä‡¢¯,Í1£3NaM<ÿÄΩ±πç{§ˇÌv©4ˇ|¯@◊@cg…zÿµ˚0CÉï∂7‚	7÷9-Õó-#«%óràì6†0£õxVªàMòº¸¨≈‰µÇª;:ÊHì™É[∆v∫≥ø°ØÒ≈g¬∂ŸW¡òH°‘—l/»@ïªÏ†i˝Õuf]<TjÑjÜÖä6ÀxŒÕQ.äG∫∫>fä«≈3>N>Ês˙≈A-â˜‰ı!õ“Z=<úõΩ¿œnîë¢Òh
¯”5g‚Ïµ`∫Xc˙≥é:f™HIYybf0$≠¨‘OJ±êRJƒ]∏xS“-ÍÁ2÷S]‹°kƒÛiòéex¥‚lL8±’«Á è©R 1UúZÍFƒä“œ{Ó_B#Q¢≠}0Øƒi4ÅŸÒBß\Åø„XÜrπ3PâTUUEÏî1_óvÇ]ærD‡:ñZ†ã0]Zü¡µ5rô÷X:Se¥FHº9>ºìu0Î∫6ÆŸ™Qq£®Tl◊Øæ2⁄í;∂≠^«^¯v¯·^©éi$P≥<EÄ≠kcü‹Ôã3ºn•zå°'„Ã⁄¸û0i‰uÂóˇ¿
vx4§«U$Z≥
=≤ÀA≤KŸ∏mê7™ Ø{\Ø®-“UıÉ%KfÉJq E….˛1$Á;„˝®púÿÔçV–0A1 |¨Y0çFbp)æºÚô∆u›W°7$k¢´ØŒóW!ód˘∫”_å …ÜqÌQ£ª
á£„”Wßä◊é¨	bIày]3x[rq∆^+ê∑}”üNé1ﬁs÷ıé¯´á∑:£òi¿¿¨ß÷<‡Uc’ﬁÖxBP5ƒê€HÂXën6ksÉy9˙„πñˆˆ~úÈ¬ä0ÆK‚j™Á∫úïÿ‚Õ©ÌçhÌg¶¥e@∑g≈.`õëMí˙<ó$s¨%œ?…jAVÀÁ©’8‹Ò·:I-ÈÈm)§W}B-ZJ£ÆuxÙ\„ñ"π{OëÆ¿’øŸ≠!¶ï3·ûî*\*ÌÎ“∆˚ˆOJ¸{°ƒMg¢ñÖœjó€-vﬂÑ#(°ÒO~p;1[Zú©’[∏ 2˛FåCj,C[eÿœ¸<∆i/`3ëVl»4˛©gB-A˝ª‰OÕG&ù…$<é¶Û¸äﬁ”Ë îÏ[À‡7õ¶;–πOÃt˝rı/Ó8¨ÚtTÑUÜÔñ˘8¸.GZ¶»WæÄ
€b>X:ÿÚ}lŸÂ#’2∏2.ŒÒ–éØ†ÃÑn˚¢Ñ¢r)Ãëﬁ.dÚfiÄfLá‰¸<¢(xÅ=E|ÚÛ¶kÃÇ˜‹2Ñ⁄;p§Gßvtà@NΩ†8rtcC†mÙ‰∆xG÷$Æ [ˆ¢´¯Yµq¢»ëœêjÑû¡∏7N˛i∫‡ìä?~†ÛF*¨ÂÁ[∫ÛÈwÄŒ’XµÂ)Nz[Äc[ˆËıPV˜†1∂∑P»($òøbìÍÒOó¢„Ö™N®Í§Ü~q%"ık/ò√aÈ€≤√“wná%{•î◊íµP™Ωõ/íÓÕ—∂3≤áZÜ‰∫x3´≤?µ^î_wnÌ‹]Z
~^^Ÿ»-7Më‹úπi8”µ@A*ŸT∂K#[JtçÀtÌ&ôvdÆ∆®ëÒÿàyü·äü¸Bq(Ÿ√¡ p™åúÍ¥äë‰äk‰äé^Ú»åıJ±¨Ä*G¬ÑT—˚®EÙ£j¨Crøòë(Üô°ëë7∆ ‰ Å#Ùπ–,tàÊ&î±"Ã÷ƒ<∏L·îﬂ(›[éˆk£˘„âö∞Á¬¯º∏ÈvF?ËäCsG¡GóçTÈçUâ°óç®Àdÿ·K.Ë X}≤>˛§é@ià◊èçS_Á⁄WOEiÛΩ∑w{ÿ€wqõU∏Êo∂›.eNw0ØÉ◊Ø¥Ú™ØæÎ◊°&π^ÁëßJQ≤*ß•¬¿é˘Èu¨F^¢‰ﬁÿ„ÍóärÉ«çJËÒ ˘Å‚J™H‡3LøbÑö‹rƒù,¢Q ~≠Á∞Y8ç‹¸„ıË+EƒF¯¬^¬?ı°¥+Ußtñ "œáät…Í√0YŸ;8zµd5$ò@ßGÙw… d¸±≤˜ˇ4˜∆˚ˆn7wºÃ? a’ÍÅäÅ5oO^ïVaô≠¨ıN-wr5zÔ≥4¬	&Äy˙|tUÚˆd∑ºMúacù€◊N?øK éBDòeúBâÂ≥u"aHÑÒ”nã5ôC‹H¡Z«cPêüÖ3åÈ ı!Èøj¯®∫F∑roXØ√¡ª3√3⁄h»Éa˜ùvUÚ°≥¸™ÎöıgW´À¶V÷Œ{˜çcËß∏ÅeomH‚tPò¢]n7<‹-¿ 8¸Ó‹Dè›£≠vßf≠Ù¢—Ãàn4ÈΩ›nåµM«"KáèJÎeù0j¥ˆ‡6´B(q4ãdO`ä∞T≥<àf“‰îƒôƒ˘£ïS≤±—à∂[Ë<¡:}ùƒ—Ú— ,È©Gµ¡öÇ4ÑcrÎIÕdz≠ºe˝i•è⁄d'–GΩVN*xD	d¬ ÙÌMm∞*«‘e,èöXFZkò*ùàcÏÃzÖ∂0á|*Õƒ9^/<W∫‡ŸXÎá·P,ƒ|:ñgeë≈—<Îﬂt÷µÿRˇ“ßõ?ç—«˘”*˘ˇ  ˇˇº]mS7˛+nßì@ª`(3P& ¥CI&ÑO|)ÿGÌ	ˆ›úM^ÍÈØvW“I∫]IG\¸!¡ˆ›˘tZ≠ˆıyËïÜ=iûàe_†˚ä¢“$∞Æ\ú≠öÙ[D?	`R$9%¿Õ¢	Æ•Ë?RÆ0§àp(*ª˘ˇŒjµöaΩi˚E©â!´à2’Äëxá«í|˙P&Â·_Gî‰ˆ∫OÜPóì≤∆ÜéFˇ‡ÜYm¨~ŸıãÚ'póÄV¨Â‰™§dí∆,©(ødzz.◊ªÀs›ı!ﬁOdq≥=éEïB9ÚîAR4õ,tQÊ(ÅÄ´?®Bõ¥ŒàÄ}1¡Ω∂A…Q´ø\M0ÈÔ;ëz»h-—¢cÒ©öÜÖ ¸RÜvì8Ùs>i±>«ºjLóˇafıïüynùÒ<œÏjóµœzU≤‰π^K[®Û‹¿ü≈Ù®‰p–ìr<ãØÈ ¡‡π$ºﬂ•~RÒÈ)õ˙he[UeQ¡v€£ïöH˘j¬=ZÌºéƒEMov–ÅaœãG•»¿0p¸-x£∫\®!Ok¬p ˇ!≤@∞•8<’ sPbk
O˘S=Î£LhÚ–Î
Æm[Õì«_∑pÌÃS∞€ˇ
n=xNﬁL`>Œ∫—Á
E˚ˆnQ>®Õ\…¥Zt3•<R˝üW„];âòßÅª!@Ê‡ZıÎü≈õ⁄◊∂>8™c„g˚-0THç[u·gQ≈[â9l'ÿiñ–…m3b\â∞ÑåñJ£¡ÕS+´æÕÊE/åüa¯ÕâÚÑØ\BÇﬁ¯ë
ı c”’–Uœ£	∂ÀµK†±AŸû›& fc•4≥ÅI`\g –!ø~˝}ºaJN˚–º‹<¿ò—«—X(ÁJ=¸˝V=Sm79«N.+{‚Jî+©oöùy,C‘¯V\Ä9∫/Í|∫88¿>Ìrﬂ#‡ ÉL@ﬂH'ˇÀT\⁄Dëj˚Zëïd±àΩr$Z≈í^¿$ˆ^(?™¨¬¢º)°ñ@˘L7 ›∫÷Œ.ù2ﬁ™*ÅT'÷∂zº;;ÔmÄ€|UQC?.¥Õÿà§ÖÙ¢Ìf3XÚ¬pM»⁄(0*µë≈èÚÅÓ|£Õ‹¯	yç¥$_'4rd˛õ§^î{—6à;ÑcŸ¸É‘¢NàzwÂó¨DÑ´Õ!ÜÔhn«0°ºër∂9W!Üøƒ˛L¬—‰cüz*˙⁄‰E∆h∂:ÛS‰ßM>¨]T2f¶â◊sﬂlâ44Y§ò¡Ü¨gÅ'üæ“KRƒ=§◊dq' ÓÍ\°£Ïí]M†9Ü– Ö†#WÛ}Ω(bxàbc›NMÿ\Xò±ÙkW•.å≥Åôÿ"§bª◊laÖúé„ªôbø^N◊àOGX9ùC
ImÍπ„$bÈÌßxv∑‘•‘WHäV£bZ-u™†ò©˝˜kQ¯9•«¡ùƒX"î÷X†∑Ñ∫8>ù ÏBﬂX’ë c
âKJCVÀÜ2dKUZN-Kæ dı]¢¥⁄ﬁm‘ˇ ÒΩr˝ÆXÍ¬k›â&.⁄ÓÄìy` ‹üñÜË@â]}Èø¶∫0âç9–'y˘Q∑D·M
√ÉüZÄbÊJ\µPéuTJ›7Ê0·ÁX†˜à@y¸∂Ï¡≠ÅÆNnQùÿmªMÏﬁ⁄'ñüV;ÿÒ”a$Ü“ÖrWˇ5#.)≥z(ò|1:£ÿ=B2[íZ¸Œ»Ïãåúpk<ÒÄHƒÃØáD¡"◊@»6–ﬁ¿¥Ω Áﬁl÷jê≈ßiÒYq\`Yºk◊¶[Â®<‚ ö,W‹gÄZ√zóiû»)–∑’Ø]å©C4†N¶ıËÅìæméZíÆ 0À<Ï÷ØØ¿'„z_(õs9ùÅy¢L^0ã{Â}ËÜSà€#`+ ÷”	‡3˜ÏuKÈ‘phÇıé“§ö ÆjãÅ#ûŒ’NﬂÁîh„Zçˆ1<¥†JhSÙ~≥=ÿﬁÂ
òxÍ¥°Ìÿ§õ.°Íªø3¸˛óÛ˜gøΩπÍùºΩº∫æ¯êMWIÔ¸;Ñ4´ñ3ÃZ´Á˙ÒL€SÊ∫≤PÊÊP ¨©gÌ 'Mó~©Û∞ö#Ò–≥*ˆD”J∆ÕVí•M:]`∂øÌò˝ú,0.Lugv·°Réï£±ß∞õP"∆
™m3vâÊ¯ìó¨Ït¢(_ñé¶QNà“8N»/°õúlﬁ8≈™å¶„Nm.õ±´>!.îz^fYmé7Cÿ€x˜–wa¨ª%¬“á>ï°‘èkh()kÈñÓIT…IE–ºç>{Q≥©~…Áåó“ÿÙë`ΩBÙ–Í?Èñ¬(}˛),}ÓnÚ®VD˝§oƒ~õC8Gäié•W+Ã·ÑApÁﬁá`‰µ>Ïj„yoÙ;ád™—:q∫)â(Á©ÙSÅ‰5Â∂ŒOb¢"#ÜpÚ¸åÇÀHE(ñÜí
œÒ¿5Ä∞ }8dÄÊ‚∫∆mU= ©ï∫-k0ëb[‰∞Y±y[Ü—*Åf≈S\µÁ˝å‚L∆ó…ù|7˛±¶©◊ó\œƒﬂÚÄ)#ßŸ÷OÒd¢A©!Ò1&¨S
éõç◊‡≤†X  6ÊÅÈxÕI&ó„Ï?   ˇˇ «hçK