import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageCircle, X, Send, User as UserIcon, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { db, auth, storage } from '@/firebase';
import { collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp, where, getDoc, doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { onAuthStateChanged } from 'firebase/auth';
import { toast } from 'sonner';

const formatMessageTime = (timestamp: any) => {
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
  
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};

export default function Chat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [showPromoPopup, setShowPromoPopup] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [user, setUser] = useState<any>(null);
  const [isStaffTyping, setIsStaffTyping] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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

  const setUserTypingStatus = async (isTyping: boolean) => {
    let chatId = user?.uid;
    if (!chatId) {
      chatId = localStorage.getItem('grefas_chat_id') || '';
    }
    if (!chatId) return;

    try {
      await setDoc(doc(db, 'chat_status', chatId), {
        isUserTyping: isTyping,
        userLastUpdated: serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.error("Error setting typing status", e);
    }
  };

  const handleMessageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    
    // Set typing status
    setUserTypingStatus(true);
    
    // Clear status after 3 seconds of inactivity
    if (typingTimeout) clearTimeout(typingTimeout);
    const timeout = setTimeout(() => {
      setUserTypingStatus(false);
    }, 3000);
    setTypingTimeout(timeout);
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });

    // Determine chat ID: either user UID or a persistent guest ID
    let chatId = user?.uid;
    if (!chatId) {
      chatId = localStorage.getItem('grefas_chat_id') || '';
      if (!chatId) {
        chatId = 'guest_' + Math.random().toString(36).substring(2, 10);
        localStorage.setItem('grefas_chat_id', chatId);
      }
    }

    // Role check (simplified for the chat UI)
    const checkRole = async () => {
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists() && (userDoc.data().role === 'admin' || userDoc.data().role === 'editor')) {
          setMessages([]); // Admins should use the Admin Panel chat normally, but let's allow them here too for now
          // Actually, if it's the main chat component, let's keep it user-facing
        }
      }
    };
    checkRole();

    const q = query(
      collection(db, 'chat'), 
      where('chatId', '==', chatId),
      orderBy('timestamp', 'asc'), 
      limit(100)
    );
    
    const unsubscribeChat = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error("Error fetching chat messages:", error);
    });

    // Listen for typing status
    const unsubscribeTyping = onSnapshot(doc(db, 'chat_status', chatId), (docSnap) => {
      if (docSnap.exists()) {
        setIsStaffTyping(docSnap.data().isStaffTyping || false);
      }
    });

    return () => {
      unsubscribeAuth();
      unsubscribeChat();
      unsubscribeTyping();
    };
  }, [user]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  useEffect(() => {
    // Show promo popup after 3 seconds if not dismissed and chat is closed
    const dismissed = localStorage.getItem('grefas_chat_promo_dismissed');
    if (!dismissed && !isOpen) {
      const timer = setTimeout(() => {
        setShowPromoPopup(true);
      }, 3000);
      return () => clearTimeout(timer);
    } else {
      setShowPromoPopup(false);
    }
  }, [isOpen]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() && !selectedImage) return;

    let chatId = user?.uid;
    if (!chatId) {
      chatId = localStorage.getItem('grefas_chat_id') || '';
    }

    try {
      let imageUrl = '';
      if (selectedImage) {
        setIsUploading(true);
        const fileName = `${Date.now()}_${selectedImage.name}`;
        const storageRef = ref(storage, `chat/${chatId}/${fileName}`);
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
        text: newMessage.trim() || 'Sent an image',
        userId: user?.uid || 'anonymous',
        userName: user?.displayName || user?.email?.split('@')[0] || 'Guest',
        chatId: chatId,
        timestamp: serverTimestamp(),
        isFromStaff: false,
        ...(imageUrl ? { imageUrl } : {}),
        ...(imageUrl && imageCaption.trim() ? { caption: imageCaption.trim() } : {})
      });
      setNewMessage('');
      resetSelectedImage();
      setUserTypingStatus(false);
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error('Failed to send message');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      {/* Custom Welcome Pop-up message when visiting */}
      <AnimatePresence>
        {showPromoPopup && !isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 15 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            onClick={() => {
              setIsOpen(true);
              setShowPromoPopup(false);
            }}
            className="fixed bottom-24 right-6 z-50 w-80 rounded-2xl border border-orange-100 dark:border-orange-950 bg-background/95 backdrop-blur p-4 shadow-2xl flex gap-3 cursor-pointer select-none hover:border-orange-200 hover:shadow-orange-100/10 transition-all group animate-thumbnail"
          >
            <div className="relative flex-shrink-0 h-10 w-10 rounded-full bg-orange-100 dark:bg-orange-950 flex items-center justify-center text-orange-600 font-bold">
              GC
              <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-background animate-pulse" />
            </div>
            <div className="flex-1 text-left min-w-0 pr-4">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="font-semibold text-xs text-foreground group-hover:text-orange-600 transition-colors">Grefas Support</span>
                <span className="inline-flex items-center gap-1 bg-green-500/15 text-green-600 px-1.5 py-0.5 rounded-full text-[9px] font-bold">
                  <span className="h-1 w-1 rounded-full bg-green-500 animate-ping" /> Online
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed font-normal">
                👋 Hello! Need help or want to book an entertainment service? Let's chat!
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowPromoPopup(false);
                localStorage.setItem('grefas_chat_promo_dismissed', 'true');
              }}
              className="absolute top-2.5 right-2.5 text-muted-foreground hover:text-foreground hover:bg-muted p-1 rounded-full transition"
              title="Dismiss welcome message"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Toggle Button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (showPromoPopup) setShowPromoPopup(false);
        }}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-orange-600 text-white shadow-lg transition-transform hover:scale-110 active:scale-95"
      >
        {isOpen ? <X /> : <MessageCircle />}

        {/* Live Online Badge / Indicator */}
        {!isOpen && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 border-2 border-background shadow-md">
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
          </span>
        )}
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
            {/* Header with active online status */}
            <div className="flex items-center justify-between bg-orange-600 p-4 text-white">
              <div className="flex items-center space-x-2">
                <div className="relative h-2.5 w-2.5 flex items-center justify-center">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 animate-ping" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold text-sm leading-tight">Live Support</span>
                  <span className="text-[10px] text-green-100/90 font-medium">We're Online Status: Active</span>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-full transition-colors"
                title="Close chat"
              >
                <X className="h-4 w-4" />
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
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[10px] font-semibold text-muted-foreground/90">
                      {msg.userName}
                    </span>
                    <span className="text-[9px] text-muted-foreground/60 font-mono">
                      • {formatMessageTime(msg.timestamp)}
                    </span>
                  </div>
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                      msg.isFromStaff
                        ? 'bg-muted text-foreground rounded-tl-none ring-1 ring-orange-100'
                        : msg.userId === user?.uid || (msg.chatId === localStorage.getItem('grefas_chat_id'))
                          ? 'bg-orange-600 text-white rounded-tr-none'
                          : 'bg-muted text-foreground rounded-tl-none'
                    }`}
                  >
                    {msg.imageUrl && (
                      <div className="mb-2 overflow-hidden rounded-lg border border-border bg-black/5 animate-thumbnail max-w-full">
                        <img
                          src={msg.imageUrl}
                          alt="Attachment"
                          referrerPolicy="no-referrer"
                          className="max-h-52 w-auto object-contain cursor-zoom-in rounded hover:opacity-95 transition-opacity"
                          onClick={() => window.open(msg.imageUrl, '_blank')}
                        />
                        {msg.caption && (
                          <div className={`p-2 text-xs border-t border-border/10 italic break-words ${
                            msg.isFromStaff || !(msg.userId === user?.uid || (msg.chatId === localStorage.getItem('grefas_chat_id')))
                              ? 'bg-black/5 text-muted-foreground'
                              : 'bg-white/10 text-orange-50'
                          }`}>
                            {msg.caption}
                          </div>
                        )}
                      </div>
                    )}
                    {(msg.text !== 'Sent an image' || !msg.imageUrl) && (
                      <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                    )}
                  </div>
                </div>
              ))}
              {isStaffTyping && (
                <div className="flex flex-col items-start animate-in fade-in slide-in-from-left-1">
                  <div className="flex items-center space-x-1 mb-1">
                    <span className="text-[10px] font-medium text-orange-600">
                      Grefas Staff
                    </span>
                  </div>
                  <div className="bg-muted text-foreground rounded-2xl rounded-tl-none px-4 py-2 text-sm flex items-center gap-1">
                    <div className="h-1 w-1 rounded-full bg-orange-600 animate-bounce [animation-delay:-0.3s]" />
                    <div className="h-1 w-1 rounded-full bg-orange-600 animate-bounce [animation-delay:-0.15s]" />
                    <div className="h-1 w-1 rounded-full bg-orange-600 animate-bounce" />
                    <span className="ml-1 text-[10px] italic">is typing...</span>
                  </div>
                </div>
              )}
              {messages.length === 0 && !isStaffTyping && (
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
                    className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
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
                    className="h-8 text-xs bg-background border-border w-full"
                    disabled={isUploading}
                  />
                </div>
              </div>
            )}

            {/* Input */}
            <form onSubmit={handleSendMessage} className="border-t border-border p-4 bg-card">
              <div className="flex space-x-2 items-center">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                  id="chat-file-upload"
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
                  value={newMessage}
                  onChange={handleMessageChange}
                  placeholder={isUploading ? "Uploading attachment..." : "Type a message..."}
                  className="flex-1 bg-muted/50 border-border"
                  disabled={isUploading}
                />
                <Button 
                  type="submit" 
                  size="icon" 
                  className="bg-orange-600 hover:bg-orange-700 text-white shrink-0"
                  disabled={isUploading || (!newMessage.trim() && !selectedImage)}
                  title="Send message"
                >
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
