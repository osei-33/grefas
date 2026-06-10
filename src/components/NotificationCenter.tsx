import * as React from 'react';
import { useState, useEffect } from 'react';
import { Bell, Check, Trash2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth } from '@/firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';

const isAdminEmail = (email: string | null) => {
  if (!email) return false;
  const hardcodedAdmins = ["serwaahlinda1995@gmail.com", "asantegrice@gmail.com", "asantegrifice@gmail.com", "oseikwameemmanuel33@gmail.com"];
  const envAdmins = ((import.meta as any).env.VITE_ADMIN_EMAILS || "").split(",").map((e: string) => e.trim());
  return hardcodedAdmins.includes(email) || envAdmins.includes(email);
};

export default function NotificationCenter() {
  const [userNotifications, setUserNotifications] = useState<any[]>([]);
  const [adminNotifications, setAdminNotifications] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [permission, setPermission] = useState<string>('default');

  const hasMountedRef = React.useRef(false);
  const existingDocIdsRef = React.useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestNotificationPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      alert("This browser does not support desktop notifications.");
      return;
    }
    try {
      const res = await Notification.requestPermission();
      setPermission(res);
      if (res === 'granted') {
        new Notification("Notifications Enabled!", {
          body: "You will now receive desktop push alerts for booking alterations & details.",
          icon: "/favicon.ico"
        });
      }
    } catch (err) {
      console.error("Error requesting permission:", err);
    }
  };

  useEffect(() => {
    let unsubscribeRole: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (authUser) => {
      setUser(authUser);
      if (unsubscribeRole) {
        unsubscribeRole();
        unsubscribeRole = null;
      }

      if (authUser) {
        // Fast synchronous fallback
        if (isAdminEmail(authUser.email)) {
          setRole('admin');
        } else {
          setRole('guest');
        }

        // Fetch/Listen to actual database role
        unsubscribeRole = onSnapshot(doc(db, 'users', authUser.uid), (docSnap) => {
          if (docSnap.exists()) {
            setRole(docSnap.data().role);
          }
        }, (error) => {
          console.error("Error fetching user role for notification center:", error);
        });
      } else {
        setRole(null);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeRole) unsubscribeRole();
    };
  }, []);

  useEffect(() => {
    hasMountedRef.current = false;
    existingDocIdsRef.current.clear();
  }, [user, role]);

  useEffect(() => {
    if (!user) {
      setUserNotifications([]);
      setAdminNotifications([]);
      setUnreadCount(0);
      return;
    }

    // Subscribe to personal notifications
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      if (hasMountedRef.current) {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const data = change.doc.data();
            const id = change.doc.id;
            if (!existingDocIdsRef.current.has(id)) {
              existingDocIdsRef.current.add(id);
              if (!data.read && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                try {
                  new Notification(data.title || "Booking Update", {
                    body: data.message || "You have a new booking update.",
                    icon: "/favicon.ico",
                    tag: id
                  });
                } catch (e) {
                  console.warn("Failed to trigger Notification API:", e);
                }
              }
            }
          }
        });
      } else {
        snapshot.docs.forEach(doc => {
          existingDocIdsRef.current.add(doc.id);
        });
        hasMountedRef.current = true;
      }

      setUserNotifications(docs);
    }, (error) => {
      console.error("Error fetching notifications:", error);
    });

    // Subscribe to admin notifications if user is admin/editor
    let unsubscribeAdmin: (() => void) | null = null;
    const isStaff = role === 'admin' || role === 'editor';
    if (isStaff) {
      const qAdmin = query(
        collection(db, 'notifications'),
        where('userId', '==', 'admin'),
        orderBy('createdAt', 'desc')
      );
      unsubscribeAdmin = onSnapshot(qAdmin, (snapshot) => {
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (hasMountedRef.current) {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              const data = change.doc.data();
              const id = change.doc.id;
              if (!existingDocIdsRef.current.has(id)) {
                existingDocIdsRef.current.add(id);
                if (!data.read && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                  try {
                    new Notification(data.title || "New Admin Notification", {
                      body: data.message || "A customer made a booking or request.",
                      icon: "/favicon.ico",
                      tag: id
                    });
                  } catch (e) {
                    console.warn("Failed to trigger Notification API:", e);
                  }
                }
              }
            }
          });
        } else {
          snapshot.docs.forEach(doc => {
            existingDocIdsRef.current.add(doc.id);
          });
        }

        setAdminNotifications(docs);
      }, (error) => {
        console.error("Error fetching admin notifications:", error);
      });
    } else {
      setAdminNotifications([]);
    }

    return () => {
      unsubscribe();
      if (unsubscribeAdmin) unsubscribeAdmin();
    };
  }, [user, role]);

  const notifications = React.useMemo(() => {
    const combined = [...userNotifications, ...adminNotifications];
    return combined.sort((a, b) => {
      const getTimestamp = (item: any) => {
        if (!item || !item.createdAt) return 0;
        if (typeof item.createdAt.toDate === 'function') {
          return item.createdAt.toDate().getTime();
        }
        if (item.createdAt.seconds) {
          return item.createdAt.seconds * 1000;
        }
        return new Date(item.createdAt).getTime() || 0;
      };
      return getTimestamp(b) - getTimestamp(a);
    });
  }, [userNotifications, adminNotifications]);

  useEffect(() => {
    setUnreadCount(notifications.filter((n: any) => !n.read).length);
  }, [notifications]);

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (error) {
      console.error(error);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'notifications', id));
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-muted-foreground hover:text-orange-600 transition-colors"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-orange-600 text-[10px] font-bold text-white">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-40 bg-black/5 dark:bg-black/20" 
              onClick={() => setIsOpen(false)} 
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 mt-2 z-50 w-80 sm:w-96"
            >
              <Card className="shadow-xl border-border bg-card">
                <CardHeader className="flex flex-row items-center justify-between py-4 border-b border-border">
                  <CardTitle className="text-sm font-bold text-foreground">Notifications</CardTitle>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => setIsOpen(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent className="p-0 max-h-[400px] overflow-y-auto">
                  {user && (
                    <>
                      {permission === 'default' && (
                        <div className="p-3 bg-orange-50 dark:bg-orange-950/20 border-b border-border flex items-center justify-between gap-3 text-xs text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                            </span>
                            <span>Enable browser push alerts to stay notified in real-time</span>
                          </div>
                          <button 
                            className="bg-orange-600 hover:bg-orange-700 text-white font-semibold text-[10px] uppercase px-2 py-1 rounded transition-colors whitespace-nowrap cursor-pointer"
                            onClick={requestNotificationPermission}
                          >
                            Enable
                          </button>
                        </div>
                      )}
                      {permission === 'denied' && (
                        <div className="p-3 bg-red-50/50 dark:bg-red-950/10 border-b border-[#fed7d7]/30 dark:border-red-950/30 flex items-center gap-2 text-[11px] text-red-600 dark:text-red-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                          <span>Browser notifications are blocked. Please allow them in your browser settings.</span>
                        </div>
                      )}
                      {permission === 'granted' && (
                        <div className="p-2.5 bg-green-50/50 dark:bg-green-950/10 border-b border-border flex items-center gap-2 text-[10px] text-green-600 dark:text-green-500 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                          <span>Browser notifications active – you're receiving real-time booking updates.</span>
                        </div>
                      )}
                    </>
                  )}
                  {!user ? (
                    <div className="py-12 px-6 text-center space-y-4">
                      <div className="mx-auto w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
                        <Bell className="h-6 w-6 text-orange-600" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-foreground">Sign in to see notifications</p>
                        <p className="text-xs text-muted-foreground">Stay updated with your bookings and event status.</p>
                      </div>
                      <Button 
                        size="sm" 
                        className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                        onClick={() => {
                          setIsOpen(false);
                          // Navigate to login or trigger login popup
                          import('firebase/auth').then(({ signInWithPopup, GoogleAuthProvider }) => {
                            signInWithPopup(auth, new GoogleAuthProvider());
                          });
                        }}
                      >
                        Sign In with Google
                      </Button>
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground text-sm">
                      No notifications yet.
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {notifications.map((n) => (
                        <div 
                          key={n.id} 
                          className={`p-4 transition-colors ${n.read ? 'bg-card' : 'bg-orange-50/50 dark:bg-orange-900/10'}`}
                        >
                          <div className="flex justify-between gap-2">
                            <h4 className="text-sm font-bold text-foreground">{n.title}</h4>
                            <div className="flex gap-1">
                              {!n.read && (
                                <button 
                                  onClick={() => markAsRead(n.id)}
                                  className="text-orange-600 hover:text-orange-700 dark:text-orange-500 dark:hover:text-orange-400"
                                  title="Mark as read"
                                >
                                  <Check className="h-4 w-4" />
                                </button>
                              )}
                              <button 
                                onClick={() => deleteNotification(n.id)}
                                className="text-muted-foreground hover:text-red-600"
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                            {n.message}
                          </p>
                          <p className="mt-2 text-[10px] text-muted-foreground/60">
                            {(() => {
                              if (!n.createdAt) return 'Just now';
                              try {
                                if (typeof n.createdAt.toDate === 'function') {
                                  return format(n.createdAt.toDate(), 'MMM d, h:mm a');
                                }
                                if (n.createdAt.seconds) {
                                  return format(new Date(n.createdAt.seconds * 1000), 'MMM d, h:mm a');
                                }
                                return format(new Date(n.createdAt), 'MMM d, h:mm a');
                              } catch (e) {
                                return 'Just now';
                              }
                            })()}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
