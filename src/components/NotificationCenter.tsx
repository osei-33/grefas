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

export default function NotificationCenter() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setNotifications(docs);
      setUnreadCount(docs.filter((n: any) => !n.read).length);
    });

    return () => unsubscribe();
  }, [user]);

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
                            {n.createdAt?.toDate ? format(n.createdAt.toDate(), 'MMM d, h:mm a') : 'Just now'}
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
