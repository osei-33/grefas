import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageCircle, X, Send, User as UserIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { db, auth } from '@/firebase';
import { collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

export default function Chat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [user, setUser] = useState<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });

    const q = query(collection(db, 'chat'), orderBy('timestamp', 'asc'), limit(50));
    const unsubscribeChat = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error("Error fetching chat messages:", error);
    });

    return () => {
      unsubscribeAuth();
      unsubscribeChat();
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      await addDoc(collection(db, 'chat'), {
        text: newMessage,
        userId: user?.uid || 'anonymous',
        userName: user?.displayName || user?.email?.split('@')[0] || 'Guest',
        timestamp: serverTimestamp(),
      });
      setNewMessage('');
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  return (
    <>
      {/* Chat Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-orange-600 text-white shadow-lg transition-transform hover:scale-110 active:scale-95"
      >
        {isOpen ? <X /> : <MessageCircle />}
      </button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed right-6 bottom-24 z-50 flex h-[500px] w-[350px] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between bg-orange-600 p-4 text-white">
              <div className="flex items-center space-x-2">
                <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                <span className="font-semibold">Live Support</span>
              </div>
              <button onClick={() => setIsOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Messages */}
            <div
              ref={scrollRef}
              className="flex-1 space-y-4 overflow-y-auto p-4 scroll-smooth"
            >
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    msg.userId === user?.uid ? 'items-end' : 'items-start'
                  }`}
                >
                  <div className="flex items-center space-x-1 mb-1">
                    <span className="text-[10px] font-medium text-muted-foreground">
                      {msg.userName}
                    </span>
                  </div>
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                      msg.userId === user?.uid
                        ? 'bg-orange-600 text-white rounded-tr-none'
                        : 'bg-muted text-foreground rounded-tl-none'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
              {messages.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <div className="rounded-full bg-orange-50 dark:bg-orange-900/10 p-4 text-orange-600 dark:text-orange-500">
                    <MessageCircle className="h-8 w-8" />
                  </div>
                  <p className="mt-4 text-sm font-medium text-foreground">
                    How can we help you today?
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Our team is online and ready to chat.
                  </p>
                </div>
              )}
            </div>

            {/* Input */}
            <form onSubmit={handleSendMessage} className="border-t border-border p-4">
              <div className="flex space-x-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 bg-muted/50 border-border"
                />
                <Button type="submit" size="icon" className="bg-orange-600 hover:bg-orange-700 text-white">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              {!user && (
                <p className="mt-2 text-center text-[10px] text-muted-foreground">
                  Chatting as Guest
                </p>
              )}
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
