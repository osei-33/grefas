import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LayoutDashboard, Image as ImageIcon, Briefcase, LogOut, Plus, Trash2, Loader2, FolderOpen, Settings as SettingsIcon, Save, Info, Phone, Mail, MapPin, Quote, Calendar as CalendarIcon, Users, Youtube, Facebook, Music2, AlertCircle, Bell, MessageCircle, CheckCircle, Menu, X, ListTodo, Clock, Search, ChevronLeft, ChevronRight, Grid, List, Download, FileSpreadsheet, FileText, Printer, Camera, Edit } from 'lucide-react';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isToday, addMonths, subMonths, parseISO } from 'date-fns';
import { auth, db, storage, handleFirestoreError, OperationType } from '@/firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
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
  updateDoc
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { GoogleGenAI } from "@google/genai";

const isAdminEmail = (email: string | null) => {
  if (!email) return false;
  const hardcodedAdmins = ["serwaahlinda1995@gmail.com", "asantegrice@gmail.com", "asantegrifice@gmail.com", "oseikwameemmanuel33@gmail.com"];
  const envAdmins = ((import.meta as any).env.VITE_ADMIN_EMAILS || "").split(",").map((e: string) => e.trim());
  return hardcodedAdmins.includes(email) || envAdmins.includes(email);
};

export default function Admin() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

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
        }

        // Listen for user document changes
        unsubscribeSnapshot = onSnapshot(doc(db, 'users', user.uid), (doc) => {
          if (doc && doc.exists()) {
            setRole(doc.data().role);
          } else {
            // Document might not exist yet if they just signed in
            if (!isAdminEmail(user.email)) {
              setRole('guest');
            }
          }
          setLoading(false);
        }, (error) => {
          // Check if it's an offline error
          const errorMsg = error instanceof Error ? error.message : String(error);
          if (errorMsg.includes('the client is offline') || errorMsg.includes('Could not reach')) {
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
    if (!user || role === 'guest') return;

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

  if (role === 'guest') {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-4 text-center px-4">
        <AlertCircle className="h-12 w-12 text-red-500" />
        <h2 className="text-2xl font-bold">Access Denied</h2>
        <p className="text-zinc-500 max-w-md">You do not have permission to access the admin panel. Please contact the administrator if you believe this is an error.</p>
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
              {role === 'admin' && (
                <>
                  <div className="pt-4 pb-2">
                    <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-3">System Control</h2>
                  </div>
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
          <Route path="/gallery" element={<ManageGallery />} />
          <Route path="/portfolio" element={<ManagePortfolio />} />
          <Route path="/bookings" element={<ManageBookings />} />
          <Route path="/team" element={<ManageTeam />} />
          <Route path="/tasks" element={<ManageTasks />} />
          {role === 'admin' && (
            <>
              <Route path="/users" element={<ManageUsers />} />
              <Route path="/chat" element={<ManageChat />} />
              <Route path="/settings" element={<ManageSettings />} />
            </>
          )}
          <Route path="*" element={<div className="flex h-full items-center justify-center text-muted-foreground">Access Denied or Page Not Found</div>} />
        </Routes>
      </main>
    </div>
  );
}

function Login() {
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleGoogleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      // Check if user exists in Firestore by UID
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      
      if (!userDoc.exists()) {
        // Check if there is a pre-authorized user by email
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', user.email));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          // Found pre-authorized user by email. Link it to this UID.
          const existingData = querySnapshot.docs[0].data();
          const existingId = querySnapshot.docs[0].id;
          
          await setDoc(doc(db, 'users', user.uid), {
            ...existingData,
            uid: user.uid,
            updatedAt: serverTimestamp()
          });
          
          // Delete the temporary entry that only had email
          if (existingId !== user.uid) {
            await deleteDoc(doc(db, 'users', existingId));
          }
        } else {
          // New user, create as guest
          await setDoc(doc(db, 'users', user.uid), {
            email: user.email,
            role: isAdminEmail(user.email) ? "admin" : "guest",
            createdAt: serverTimestamp()
          });
        }
      }
      
      toast.success('Logged in successfully');
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/popup-blocked') {
        toast.error('Login popup was blocked by your browser. Please allow popups for this site.');
      } else if (error.code === 'auth/cancelled-popup-request') {
        // Ignore this one as it's usually triggered by the user closing the popup or a double click
      } else {
        toast.error('Login failed. Make sure you are an authorized admin.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md bg-card border-border">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-foreground">Admin Login</CardTitle>
          <CardDescription className="text-muted-foreground">Sign in with your Google account to manage the website.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={handleGoogleLogin}
            disabled={isLoggingIn}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white"
          >
            {isLoggingIn ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign in with Google'
            )}
          </Button>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Authorized admins only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Dashboard() {
  const [counts, setCounts] = useState({ services: 0, gallery: 0, portfolio: 0, bookings: 0, tasks: 0 });

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const servicesSnap = await getDocs(collection(db, 'services'));
        const gallerySnap = await getDocs(collection(db, 'gallery'));
        const portfolioSnap = await getDocs(collection(db, 'portfolio'));
        const bookingsSnap = await getDocs(collection(db, 'bookings'));
        const tasksSnap = await getDocs(collection(db, 'tasks'));
        setCounts({
          services: servicesSnap.size,
          gallery: gallerySnap.size,
          portfolio: portfolioSnap.size,
          bookings: bookingsSnap.size,
          tasks: tasksSnap.size
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        if (errorMsg.includes('the client is offline') || errorMsg.includes('Could not reach')) {
          console.debug("Firestore offline - dashboard counts not available");
        } else {
          console.error("Dashboard fetch error:", error);
        }
      }
    };
    fetchCounts();
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Services</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{counts.services}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Gallery Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{counts.gallery}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Portfolio Projects</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{counts.portfolio}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Bookings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{counts.bookings}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Internal Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{counts.tasks}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ManageServices() {
  const [services, setServices] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newService, setNewService] = useState({ title: '', description: '', iconName: 'Briefcase', color: 'bg-blue-100 text-blue-600' });

  useEffect(() => {
    const q = query(collection(db, 'services'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setServices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'services');
    });
    return () => unsubscribe();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'services'), {
        ...newService,
        createdAt: serverTimestamp()
      });
      toast.success('Service added');
      setIsAdding(false);
      setNewService({ title: '', description: '', iconName: 'Briefcase', color: 'bg-blue-100 text-blue-600' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'services');
    }
  };

  const handleSendReminder = async (booking: any) => {
    try {
      const response = await fetch('/api/notify-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: booking.userEmail,
          phone: booking.userPhone,
          userName: booking.userName,
          serviceTitle: booking.serviceTitle || 'General Consultation',
          date: booking.date
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
        let errorMsg = "Reminder sent via email, but SMS failed.";
        if (result.results.sms.includes("Unverified Number")) {
          errorMsg = "Reminder sent via email, but SMS failed because the recipient number is NOT verified in your Twilio Trial console.";
        } else {
          errorMsg = `Reminder sent via email, but SMS failed: ${result.results.sms}`;
        }
        toast.warning(errorMsg, { duration: 8000 });
      } else {
        toast.success("Reminder sent successfully!");
      }
    } catch (error) {
      console.error("Failed to send reminder:", error);
      toast.error("Failed to send reminder.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this service?')) return;
    try {
      await deleteDoc(doc(db, 'services', id));
      toast.success('Service deleted');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `services/${id}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Manage Services</h1>
        <Button onClick={() => setIsAdding(!isAdding)} className="bg-orange-600 hover:bg-orange-700 text-white">
          {isAdding ? 'Cancel' : <><Plus className="mr-2 h-4 w-4" /> Add Service</>}
        </Button>
      </div>

      {isAdding && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Add New Service</CardTitle>
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
              <div className="grid grid-cols-2 gap-4">
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
              </div>
              <Button type="submit" className="w-full bg-orange-600 text-white">Save Service</Button>
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
                  <p className="font-medium text-foreground">{service.title}</p>
                  <p className="text-sm text-muted-foreground truncate max-w-md">{service.description}</p>
                </div>
                <div className="flex space-x-2">
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
  const [newMember, setNewMember] = useState({
    name: '',
    role: '',
    experience: '',
    bio: '',
    imageUrl: '',
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

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          resolve('');
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
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
      rating: member.rating || 4.9,
      category: member.category || 'consulting',
      skillsInput: member.skills ? member.skills.join(', ') : '',
      available: member.available !== false,
      highlightsInput: member.projectHighlights ? member.projectHighlights.join('\n') : ''
    });
    setIsAdding(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this specialist profile?')) return;
    try {
      await deleteDoc(doc(db, 'team_members', id));
      toast.success('Specialist profile deleted');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `team_members/${id}`);
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
                        accept="image/jpeg,image/png,image/webp,image/gif"
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
                          <p className="text-xs text-muted-foreground">Supports JPG, PNG, WEBP, GIF (Max 5MB)</p>
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
        <CardHeader>
          <CardTitle>Specialists List</CardTitle>
          <CardDescription>View, manage and delete registered team specialists.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {members.map((member) => {
              const userAvailable = member.available !== false;
              return (
                <div key={member.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4">
                  <div className="flex items-center space-x-4">
                    <img
                      src={member.imageUrl}
                      alt={member.name}
                      referrerPolicy="no-referrer"
                      className="h-12 w-12 rounded-full object-cover border border-border"
                    />
                    <div>
                      <p className="font-bold text-foreground flex items-center gap-2">
                        {member.name}
                        <span className="text-[10px] px-2 py-0.5 rounded bg-orange-100 dark:bg-orange-950/40 text-orange-800 dark:text-orange-300 uppercase font-black tracking-wider">
                          {member.category}
                        </span>
                      </p>
                      <p className="text-xs text-orange-600 font-semibold">{member.role}</p>
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
    </div>
  );
}

function ManageGallery() {
  const [items, setItems] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState({ type: 'image', url: '', title: '', category: 'events', thumbnail: '' });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationPrompt, setGenerationPrompt] = useState('');
  const [uploadMode, setUploadMode] = useState<'upload' | 'ai'>('upload');

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
      const ai = new GoogleGenAI({ apiKey: (process.env as any).GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            {
              text: `Generate a high-quality, professional image for a consulting and entertainment business gallery. Topic: ${generationPrompt}. The image should be vibrant and modern.`,
            },
          ],
        },
        config: {
          imageConfig: {
            aspectRatio: "1:1"
          }
        }
      });

      let imageUrl = '';
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          imageUrl = `data:image/png;base64,${part.inlineData.data}`;
          break;
        }
      }

      if (imageUrl) {
        setNewItem({ ...newItem, url: imageUrl, title: generationPrompt });
        toast.success('Image generated successfully!');
      } else {
        toast.error('Failed to generate image. Please try a different prompt.');
      }
    } catch (error) {
      console.error(error);
      toast.error('Error generating image');
    } finally {
      setIsGenerating(false);
    }
  };

  const generateVideoThumbnail = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      video.src = URL.createObjectURL(file);
      
      video.onloadedmetadata = () => {
        video.currentTime = 1; // Seek to 1 second
      };

      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.7);
          URL.revokeObjectURL(video.src);
          resolve(thumbnailUrl);
        } else {
          reject('Could not get canvas context');
        }
      };

      video.onerror = (e) => reject(e);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (35MB limit as requested)
    const MAX_SIZE = 35 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      toast.error('File is too large. Maximum size allowed is 35MB.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // If it's a video, try to generate a thumbnail
      if (file.type.startsWith('video/')) {
        try {
          const thumbnailDataUrl = await generateVideoThumbnail(file);
          // Upload thumbnail first
          const thumbRef = ref(storage, `gallery/thumbnails/${Date.now()}_thumb.jpg`);
          // Convert dataURL to blob
          const response = await fetch(thumbnailDataUrl);
          const blob = await response.blob();
          await uploadBytesResumable(thumbRef, blob);
          const thumbUrl = await getDownloadURL(thumbRef);
          setNewItem(prev => ({ ...prev, thumbnail: thumbUrl }));
        } catch (error) {
          console.warn('Failed to generate thumbnail, you may need to provide one manually:', error);
        }
      }

      // Upload main file
      const storageRef = ref(storage, `gallery/${Date.now()}_${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(Math.round(progress));
        }, 
        (error) => {
          console.error('Upload failed:', error);
          toast.error('Upload failed');
          setIsUploading(false);
        }, 
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          setNewItem(prev => ({ ...prev, url: downloadURL }));
          setIsUploading(false);
          toast.success('File uploaded successfully');
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
      await addDoc(collection(db, 'gallery'), {
        ...newItem,
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

  const handleDelete = async (id: string, url?: string, thumbnailUrl?: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
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
                    <label className="text-sm font-medium text-foreground">Upload from Local Disk (Max 35MB)</label>
                    <div className="space-y-2">
                      <div className="flex items-center gap-4">
                        <Input 
                          type="file" 
                          accept={newItem.type === 'image' ? "image/*" : "video/*"}
                          onChange={handleFileUpload}
                          disabled={isUploading}
                          className="cursor-pointer bg-muted/50 border-border"
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
                    <p className="text-[10px] text-muted-foreground italic">Note: Large files are uploaded to secure cloud storage. Videos up to 35MB are supported.</p>
                  </div>

                  <Input 
                    placeholder="URL (Image URL or Video Embed URL)" 
                    value={newItem.url} 
                    onChange={e => setNewItem({...newItem, url: e.target.value})} 
                    required 
                    className="bg-muted/50 border-border"
                  />
                  {newItem.type === 'video' && (
                    <Input 
                      placeholder="Thumbnail URL" 
                      value={newItem.thumbnail} 
                      onChange={e => setNewItem({...newItem, thumbnail: e.target.value})} 
                      required 
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
            <img
              src={item.type === 'image' ? item.url : item.thumbnail}
              alt={item.title}
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
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
    </div>
  );
}

function ManagePortfolio() {
  const [items, setItems] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState({ title: '', description: '', imageUrl: '', category: 'Consulting' });

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

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this project?')) return;
    try {
      await deleteDoc(doc(db, 'portfolio', id));
      toast.success('Project deleted');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `portfolio/${id}`);
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
    logoUrl: ''
  });
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
                  placeholder="info@grefas.com"
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
            Important information about sending SMS notifications with a Twilio Trial account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            You are currently using a <strong>Twilio Trial Account</strong>. Twilio restricts trial accounts from sending SMS messages to numbers that have not been manually verified.
          </p>
          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            <p className="font-bold text-foreground">To fix "Unverified Number" errors:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Log in to your <a href="https://www.twilio.com/console" target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:underline">Twilio Console</a>.</li>
              <li>Go to <strong>Phone Numbers &gt; Verified Caller IDs</strong>.</li>
              <li>Add and verify the phone numbers you want to test with.</li>
              <li>Alternatively, upgrade your Twilio account to remove this restriction.</li>
            </ol>
          </div>
          <p className="text-xs italic">
            Note: Email notifications (via Resend) and in-app notifications are not affected by this restriction.
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
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

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
          date: booking.time ? `${booking.date} at ${booking.time}` : booking.date
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
        let errorMsg = "Booking confirmed, but SMS alert failed.";
        if (result.results.sms.includes("Unverified Number")) {
          errorMsg = "Booking confirmed, but SMS failed because the phone number is not verified in Twilio Console.";
        }
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
      
      // Notify the user if confirmed or cancelled
      if (newStatus === 'confirmed' || newStatus === 'cancelled') {
        const bookingSnap = await getDoc(bookingRef);
        if (bookingSnap.exists()) {
          const bookingData = bookingSnap.data();
          
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
                  date: bookingData.time ? `${bookingData.date} at ${bookingData.time}` : bookingData.date
                })
              });
              
              const result = await response.json();
              const emailSent = result.results?.email === 'sent';
              
              await setDoc(bookingRef, { 
                confirmationEmailStatus: emailSent ? 'sent' : 'failed' 
              }, { merge: true });

              if (result.results?.sms && result.results.sms.startsWith("failed")) {
                let errorMsg = "Booking confirmed, but SMS failed.";
                if (result.results.sms.includes("Unverified Number")) {
                  errorMsg = "Booking confirmed, but SMS failed because the recipient number is NOT verified in your Twilio Trial console.";
                } else if (result.results.sms.includes("Invalid Phone Number")) {
                  errorMsg = "Booking confirmed, but SMS failed due to an invalid phone number format.";
                } else {
                  errorMsg = `Booking confirmed, but SMS failed: ${result.results.sms}`;
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
      const response = await fetch('/api/notify-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: booking.userEmail,
          phone: booking.userPhone,
          userName: booking.userName,
          serviceTitle: booking.serviceTitle || 'General Consultation',
          date: booking.time ? `${booking.date} at ${booking.time}` : booking.date
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
        let errorMsg = "Reminder sent via email, but SMS failed.";
        if (result.results.sms.includes("Unverified Number")) {
          errorMsg = "Reminder sent via email, but SMS failed because the recipient number is NOT verified in your Twilio Trial console.";
        } else {
          errorMsg = `Reminder sent via email, but SMS failed: ${result.results.sms}`;
        }
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

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this booking?')) return;
    setDeletingId(id);
    try {
      await deleteDoc(doc(db, 'bookings', id));
      setSelectedIds(prev => prev.filter(item => item !== id));
      toast.success('Booking deleted');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `bookings/${id}`);
    } finally {
      setDeletingId(null);
    }
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

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete the ${selectedIds.length} selected booking(s)?`)) return;

    setIsBulkDeleting(true);
    let successCount = 0;
    try {
      await Promise.all(selectedIds.map(async (id) => {
        await deleteDoc(doc(db, 'bookings', id));
        successCount++;
      }));
      toast.success(`Successfully deleted ${successCount} booking(s).`);
      setSelectedIds([]);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `bookings (bulk)`);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleDeleteAll = async () => {
    if (bookings.length === 0) {
      toast.error('No bookings to delete.');
      return;
    }
    if (!confirm(`Are you sure you want to delete ALL ${bookings.length} booking request(s)? This action is completely irreversible!`)) return;

    setIsBulkDeleting(true);
    let successCount = 0;
    try {
      await Promise.all(bookings.map(async (b) => {
        await deleteDoc(doc(db, 'bookings', b.id));
        successCount++;
      }));
      toast.success(`Successfully deleted all ${successCount} booking(s).`);
      setSelectedIds([]);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `bookings (all)`);
    } finally {
      setIsBulkDeleting(false);
    }
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
          </div>
        </div>
      </div>

      {viewMode === 'list' ? (
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
      ) : (
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
    </div>
  );
}

function ManageUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', role: 'editor' });

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
    if (!newUser.email.trim()) return;

    try {
      // Find if user already exists
      const existingUser = users.find(u => u.email === newUser.email);
      if (existingUser) {
        toast.error('User with this email already exists');
        return;
      }

      // We use addDoc because we don't have a UID yet. 
      // The sign-in logic will look up by email or we can use email as ID (but email might have dots)
      // Actually, my rule says match /users/{userId} where userId is UID.
      // If we add by email, we should probably use a different approach or just wait for them to sign in.
      // But user wants to ADD them. I'll use email as ID for pre-authorization or just a random ID.
      // Let's use a random ID and update the sign-in logic to link it, OR just allow isAdmin to create.
      
      await addDoc(collection(db, 'users'), {
        email: newUser.email,
        role: newUser.role,
        createdAt: serverTimestamp()
      });

      toast.success('User pre-authorized successfully');
      setNewUser({ email: '', role: 'editor' });
      setIsAdding(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'users');
    }
  };

  const handleUpdateRole = async (uid: string, role: string) => {
    try {
      await setDoc(doc(db, 'users', uid), { role }, { merge: true });
      toast.success(`User role updated to ${role}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
    }
  };

  const handleDeleteUser = async (uid: string) => {
    if (!confirm('Are you sure? This will remove their admin/editor access.')) return;
    try {
      await deleteDoc(doc(db, 'users', uid));
      toast.success('User removed');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${uid}`);
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

  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [imageCaption, setImageCaption] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Only image uploads are welcomed.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB.');
      return;
    }

    setSelectedImage(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
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
            (error) => {
              console.error('Upload failed:', error);
              reject(error);
            },
            async () => {
              imageUrl = await getDownloadURL(uploadTask.snapshot.ref);
              resolve();
            }
          );
        });
      }

      await addDoc(collection(db, 'chat'), {
        text: reply.trim() || 'Sent an image',
        userId: auth.currentUser?.uid || 'admin',
        userName: 'Grefas Staff',
        chatId: activeChatId,
        timestamp: serverTimestamp(),
        isFromStaff: true,
        ...(imageUrl ? { imageUrl } : {}),
        ...(imageUrl && imageCaption.trim() ? { caption: imageCaption.trim() } : {})
      });
      setReply('');
      resetSelectedImage();
      setStaffTypingStatus(false);
    } catch (error) {
      toast.error('Failed to send reply');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-[70vh] gap-6">
      <div className="w-full md:w-1/3 flex flex-col border border-border rounded-xl bg-card overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/50">
          <h2 className="font-bold flex items-center gap-2">
            <MessageCircle className="h-4 w-4" /> Active Threads
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {threads.map((t, index) => (
            <button
              key={t.id || `thread-${index}`}
              onClick={() => setActiveChatId(t.id)}
              className={`w-full text-left p-4 hover:bg-muted transition-colors border-b border-border ${activeChatId === t.id ? 'bg-orange-50 dark:bg-orange-900/10' : ''}`}
            >
              <div className="flex justify-between items-baseline gap-2 mb-0.5">
                <p className="font-bold text-foreground text-sm truncate">{t.userName}</p>
                {t.timestamp && (
                  <span className="text-[10px] text-muted-foreground/70 shrink-0 font-mono">
                    {formatAdminMessageTime(t.timestamp)}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">{t.lastMessage}</p>
            </button>
          ))}
          {threads.length === 0 && <p className="p-8 text-center text-muted-foreground">No chats yet.</p>}
        </div>
      </div>

      <div className="flex-1 flex flex-col border border-border rounded-xl bg-card overflow-hidden">
        {activeChatId ? (
          <>
            <div className="p-4 border-b border-border bg-muted/50 flex justify-between items-center">
              <h2 className="font-bold text-sm">Conversation with {threads.find(t => t.id === activeChatId)?.userName}</h2>
              <span className="text-[10px] text-muted-foreground">ID: {activeChatId}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((m, index) => (
                <div key={m.id || `msg-${index}`} className={`flex flex-col ${m.isFromStaff ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                    m.isFromStaff 
                      ? 'bg-orange-600 text-white rounded-tr-none' 
                      : 'bg-muted text-foreground rounded-tl-none'
                  }`}>
                    {m.imageUrl && (
                      <div className="mb-2 overflow-hidden rounded-lg border border-border bg-black/5 animate-thumbnail max-w-full">
                        <img
                          src={m.imageUrl}
                          alt="Attachment"
                          referrerPolicy="no-referrer"
                          className="max-h-52 w-auto object-contain cursor-zoom-in rounded hover:opacity-95 transition-opacity"
                          onClick={() => window.open(m.imageUrl, '_blank')}
                        />
                        {m.caption && (
                          <div className={`p-2 text-xs border-t border-border/10 italic break-words ${
                            !m.isFromStaff
                              ? 'bg-black/5 text-muted-foreground'
                              : 'bg-white/10 text-orange-50'
                          }`}>
                            {m.caption}
                          </div>
                        )}
                      </div>
                    )}
                    {(m.text !== 'Sent an image' || !m.imageUrl) && (
                      <p className="whitespace-pre-wrap break-words">{m.text}</p>
                    )}
                  </div>
                  <span className="text-[10px] mt-1 text-muted-foreground flex items-center gap-1.5 font-sans">
                    <strong>{m.userName}</strong>
                    <span className="text-[9px] text-muted-foreground/70 font-mono">
                      • {formatAdminMessageTime(m.timestamp)}
                    </span>
                  </span>
                </div>
              ))}
              {isUserTyping && (
                <div className="flex flex-col items-start animate-in fade-in slide-in-from-left-1">
                  <div className="bg-muted text-foreground rounded-2xl rounded-tl-none px-4 py-2 text-sm flex items-center gap-1">
                    <div className="h-1 w-1 rounded-full bg-orange-600 animate-bounce [animation-delay:-0.3s]" />
                    <div className="h-1 w-1 rounded-full bg-orange-600 animate-bounce [animation-delay:-0.15s]" />
                    <div className="h-1 w-1 rounded-full bg-orange-600 animate-bounce" />
                    <span className="ml-1 text-[10px] italic">User is typing...</span>
                  </div>
                </div>
              )}
            </div>
            {/* Image Upload Thumbnail Preview Panel */}
            {imagePreviewUrl && (
              <div className="bg-muted/40 border-t border-border flex flex-col animate-thumbnail">
                <div className="px-4 py-2 flex items-center justify-between gap-3">
                  <div className="relative h-14 w-14 rounded-md overflow-hidden border border-border bg-background flex-shrink-0">
                    <img src={imagePreviewUrl} alt="Preview" className="h-full w-full object-cover" />
                    {isUploading && (
                      <div className="absolute inset-0 bg-black/55 flex items-center justify-center text-[10px] text-white font-bold">
                        {uploadProgress}%
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{selectedImage?.name || 'capture.jpg'}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {isUploading ? 'Uploading to secure storage...' : 'Ready to send'}
                    </p>
                  </div>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted animate-in fade-in"
                    onClick={resetSelectedImage}
                    disabled={isUploading}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="px-4 pb-2 pt-0.5">
                  <Input
                    placeholder="Add an optional text caption..."
                    value={imageCaption}
                    onChange={(e) => setImageCaption(e.target.value)}
                    className="h-8 text-xs bg-background border-border w-full animate-in fade-in"
                    disabled={isUploading}
                  />
                </div>
              </div>
            )}

            <form onSubmit={handleSendReply} className="p-4 border-t border-border bg-muted/50">
              <div className="flex gap-2 items-center">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                  id="admin-chat-file-upload"
                  disabled={isUploading}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9 text-muted-foreground hover:text-orange-600 hover:bg-muted shrink-0"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  title="Upload or capture image"
                >
                  <Camera className="h-5 w-5" />
                </Button>

                <Input 
                  placeholder={isUploading ? "Uploading attachment..." : "Type your reply..."} 
                  value={reply} 
                  onChange={handleReplyChange} 
                  className="bg-background border-border flex-1"
                  disabled={isUploading}
                />
                <Button 
                  type="submit" 
                  className="bg-orange-600 text-white shrink-0"
                  disabled={isUploading || (!reply.trim() && !selectedImage)}
                >
                  Send
                </Button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground italic">
            Select a thread to start chatting.
          </div>
        )}
      </div>
    </div>
  );
}

function ManageTasks() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newTask, setNewTask] = useState({ 
    title: '', 
    description: '', 
    priority: 'medium', 
    status: 'todo',
    dueDate: ''
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'tasks');
    });
    return () => unsubscribe();
  }, []);

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title.trim()) return;

    try {
      await addDoc(collection(db, 'tasks'), {
        ...newTask,
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser?.email || 'admin@grefas.com'
      });
      toast.success('Task added successfully');
      setNewTask({ title: '', description: '', priority: 'medium', status: 'todo', dueDate: '' });
      setIsAdding(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'tasks');
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      await setDoc(doc(db, 'tasks', id), { status: newStatus }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `tasks/${id}`);
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
      await deleteDoc(doc(db, 'tasks', id));
      toast.success('Task deleted');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `tasks/${id}`);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/20';
      case 'medium': return 'text-orange-600 bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-900/20';
      case 'low': return 'text-blue-600 bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-900/20';
      default: return 'text-muted-foreground bg-muted border-border';
    }
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-orange-600" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Internal Tasks</h1>
          <p className="text-sm text-muted-foreground">Track and manage staff to-dos for Grefas operations.</p>
        </div>
        <Button onClick={() => setIsAdding(!isAdding)} className="bg-orange-600 hover:bg-orange-700 text-white">
          {isAdding ? 'Cancel' : <><Plus className="mr-2 h-4 w-4" /> New Task</>}
        </Button>
      </div>

      {isAdding && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Create New Task</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddTask} className="space-y-4">
              <Input 
                placeholder="Task Title" 
                value={newTask.title} 
                onChange={e => setNewTask({...newTask, title: e.target.value})} 
                required 
                className="bg-muted/50 border-border"
              />
              <Textarea 
                placeholder="Description / Details" 
                value={newTask.description} 
                onChange={e => setNewTask({...newTask, description: e.target.value})} 
                className="bg-muted/50 border-border"
              />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Priority</label>
                  <select 
                    className="flex h-10 w-full rounded-md border border-input bg-muted/50 px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 text-foreground"
                    value={newTask.priority}
                    onChange={e => setNewTask({...newTask, priority: e.target.value})}
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Initial Status</label>
                  <select 
                    className="flex h-10 w-full rounded-md border border-input bg-muted/50 px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 text-foreground"
                    value={newTask.status}
                    onChange={e => setNewTask({...newTask, status: e.target.value})}
                  >
                    <option value="todo">To Do</option>
                    <option value="in-progress">In Progress</option>
                    <option value="done">Done</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Due Date</label>
                  <Input 
                    type="date"
                    value={newTask.dueDate}
                    onChange={e => setNewTask({...newTask, dueDate: e.target.value})}
                    className="bg-muted/50 border-border"
                  />
                </div>
              </div>
              <Button type="submit" className="w-full bg-orange-600 text-white hover:bg-orange-700">Save Task</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Todo Column */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-2">
            <div className="h-2 w-2 rounded-full bg-red-500" />
            <h3 className="text-sm font-black uppercase tracking-widest text-foreground">To Do</h3>
            <span className="ml-auto text-[10px] font-bold bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
              {tasks.filter(t => t.status === 'todo').length}
            </span>
          </div>
          <div className="space-y-3">
            {tasks.filter(t => t.status === 'todo').map(task => (
              <TaskCard key={task.id} task={task} onUpdateStatus={handleUpdateStatus} onDelete={handleDeleteTask} priorityColor={getPriorityColor} />
            ))}
          </div>
        </div>

        {/* In Progress Column */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-2">
            <div className="h-2 w-2 rounded-full bg-blue-500" />
            <h3 className="text-sm font-black uppercase tracking-widest text-foreground">In Progress</h3>
            <span className="ml-auto text-[10px] font-bold bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
              {tasks.filter(t => t.status === 'in-progress').length}
            </span>
          </div>
          <div className="space-y-3">
            {tasks.filter(t => t.status === 'in-progress').map(task => (
              <TaskCard key={task.id} task={task} onUpdateStatus={handleUpdateStatus} onDelete={handleDeleteTask} priorityColor={getPriorityColor} />
            ))}
          </div>
        </div>

        {/* Done Column */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-2">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Done</h3>
            <span className="ml-auto text-[10px] font-bold bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
              {tasks.filter(t => t.status === 'done').length}
            </span>
          </div>
          <div className="space-y-3">
            {tasks.filter(t => t.status === 'done').map(task => (
              <TaskCard key={task.id} task={task} onUpdateStatus={handleUpdateStatus} onDelete={handleDeleteTask} priorityColor={getPriorityColor} />
            ))}
          </div>
        </div>
      </div>
      
      {tasks.length === 0 && !isAdding && (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 border rounded-xl border-dashed border-border bg-muted/20">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
            <CheckCircle className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-lg font-bold">All clear!</h3>
            <p className="text-sm text-muted-foreground">No tasks at the moment. Add one to get started.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function TaskCard({ task, onUpdateStatus, onDelete, priorityColor }: { task: any, onUpdateStatus: any, onDelete: any, priorityColor: any }) {
  const isOverdue = task.dueDate && task.status !== 'done' && new Date(task.dueDate) < new Date(new Date().setHours(0,0,0,0));
  const isDueToday = task.dueDate && new Date(task.dueDate).toDateString() === new Date().toDateString();

  return (
    <Card className="bg-card border-border shadow-sm hover:shadow-md transition-shadow group">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <div className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border ${priorityColor(task.priority)}`}>
              {task.priority}
            </div>
            {task.dueDate && (
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border ${
                isOverdue ? 'text-red-600 bg-red-50 border-red-200 animate-pulse' : 
                isDueToday ? 'text-orange-600 bg-orange-50 border-orange-200' : 
                'text-muted-foreground bg-muted border-border'
              }`}>
                <CalendarIcon className="h-3 w-3" />
                Due: {new Date(task.dueDate).toLocaleDateString()}
              </div>
            )}
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => onDelete(task.id)}
            className="h-6 w-6 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-red-600 transition-opacity"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
        
        <div>
          <h4 className="font-bold text-foreground leading-tight">{task.title}</h4>
          {task.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{task.description}</p>
          )}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border mt-2">
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            {task.createdAt?.toDate().toLocaleDateString() || 'Today'}
          </div>
          <select 
            className="text-[10px] font-bold bg-muted border-none rounded px-2 py-1 outline-none cursor-pointer focus:ring-1 focus:ring-orange-600"
            value={task.status}
            onChange={(e) => onUpdateStatus(task.id, e.target.value)}
          >
            <option value="todo">TO DO</option>
            <option value="in-progress">IN PROGRESS</option>
            <option value="done">DONE</option>
          </select>
        </div>
      </CardContent>
    </Card>
  );
}
