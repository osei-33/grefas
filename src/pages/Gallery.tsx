import * as React from 'react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import ReactPlayer from 'react-player';
import { db, auth, storage, handleFirestoreError, OperationType } from '@/firebase';
import { collection, onSnapshot, query, orderBy, updateDoc, doc, arrayUnion, arrayRemove, increment, deleteDoc, getDoc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { Loader2, Play, X, Heart, MessageSquare, Share2, Send, Trash2, Download } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { onAuthStateChanged } from 'firebase/auth';
import { AdSense } from '@/components/AdSense';
import { safeGetLocalStorage, safeSetLocalStorage } from '@/lib/utils';

const ImageWithLoading = ({ src, alt, className, onClick }: { src: string; alt: string; className?: string; onClick?: () => void }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  
  return (
    <div 
      className={`relative h-full w-full bg-muted/20 overflow-hidden ${!isLoaded ? 'animate-pulse' : ''}`}
      style={{ minHeight: '200px' }}
    >
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-linear-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_3s_infinite]">
          <Loader2 className="h-5 w-5 animate-spin text-orange-200/30" />
        </div>
      )}
      <img
        src={src}
        alt={alt}
        className={`${className} ${isLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-105'} transition-all duration-1000 ease-out`}
        referrerPolicy="no-referrer"
        loading="lazy"
        onLoad={() => setIsLoaded(true)}
        onClick={onClick}
      />
    </div>
  );
};

const MediaViewer = ({ item }: { item: any }) => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
  }, [item?.id]);

  if (!item) return null;

  if (item.type === 'image') {
    return (
      <div className="w-full h-full flex items-center justify-center p-4">
        <img
          src={item.url}
          alt={item.title}
          className="max-h-full max-w-full object-contain drop-shadow-2xl transition-transform duration-700 hover:scale-105"
          referrerPolicy="no-referrer"
          onLoad={() => setIsLoading(false)}
        />
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
          </div>
        )}
      </div>
    );
  }

  // Use ReactPlayer for all video types (Local, YouTube, Vimeo)
  const Player = ReactPlayer as any;

  return (
    <div className="w-full h-full relative bg-black flex items-center justify-center">
      {isLoading && item.thumbnail && (
        <div className="absolute inset-0 z-10 transition-opacity duration-500">
          <img src={item.thumbnail} className="w-full h-full object-cover blur-sm opacity-50" alt="" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center space-y-4">
              <Loader2 className="h-10 w-10 animate-spin text-orange-600" />
              <span className="text-white/50 text-xs font-bold uppercase tracking-widest">Warming up...</span>
            </div>
          </div>
        </div>
      )}
      <div className="w-full h-full max-w-full max-h-full aspect-video flex items-center justify-center">
        <Player
          url={item.url}
          controls
          playing={!isLoading}
          width="100%"
          height="100%"
          onReady={() => setIsLoading(false)}
          onStart={() => setIsLoading(false)}
          config={{
            youtube: {
              playerVars: { 
                modestbranding: 1, 
                rel: 0,
                color: 'white'
              }
            },
            vimeo: {
              playerOptions: { 
                badge: 0, 
                byline: 0, 
                portrait: 0, 
                title: 0 
              }
            }
          }}
          className="react-player"
          playsInline
        />
      </div>
    </div>
  );
};

export default function Gallery() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [guestName, setGuestName] = useState(() => safeGetLocalStorage('grefas_guest_name'));
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (authenticatedUser) => {
      setUser(authenticatedUser);
      if (authenticatedUser) {
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
          if (["serwaahlinda1995@gmail.com", "asantegrice@gmail.com", "asantegrifice@gmail.com", "oseikwameemmanuel33@gmail.com"].includes(authenticatedUser.email || "")) {
            setUserRole('admin');
          }
        }
      } else {
        setUserRole(null);
      }
    });

    const q = query(collection(db, 'gallery'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'gallery');
    });
    return () => {
      unsubscribeAuth();
      unsubscribe();
    };
  }, []);

  const getAnonymousId = () => {
    let id = safeGetLocalStorage('grefas_gallery_id');
    if (!id) {
      id = 'anon_' + Math.random().toString(36).substring(2, 11);
      safeSetLocalStorage('grefas_gallery_id', id);
    }
    return id;
  };

  const handleLike = async (item: any) => {
    const anonymousId = user?.uid || getAnonymousId();
    const itemRef = doc(db, 'gallery', item.id);
    const isLiked = item.likes?.includes(anonymousId);

    try {
      await updateDoc(itemRef, {
        likes: isLiked ? arrayRemove(anonymousId) : arrayUnion(anonymousId),
        likesCount: increment(isLiked ? -1 : 1)
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `gallery/${item.id}`);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    const anonymousId = user?.uid || getAnonymousId();
    const displayName = user?.displayName || user?.email?.split('@')[0] || guestName.trim() || 'Anonymous Viewer';

    if (!user && guestName.trim()) {
      safeSetLocalStorage('grefas_guest_name', guestName.trim());
    }

    const itemRef = doc(db, 'gallery', selectedItem.id);
    const comment = {
      userId: anonymousId,
      userName: displayName,
      text: newComment,
      timestamp: new Date().toISOString()
    };

    try {
      await updateDoc(itemRef, {
        comments: arrayUnion(comment)
      });
      setNewComment('');
      // The real-time listener will update the items list, but we need to update the selectedItem state to show it in the modal
      setSelectedItem((prev: any) => ({
        ...prev,
        comments: [...(prev.comments || []), comment]
      }));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `gallery/${selectedItem.id}`);
    }
  };

  const handleShare = (item: any) => {
    const shareUrl = window.location.href;
    if (navigator.share) {
      navigator.share({
        title: item.title,
        text: `Check out this ${item.type} from Grefas Consult & Entertainment`,
        url: shareUrl,
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(shareUrl);
      toast.success('Link copied to clipboard!');
    }
  };

  const handleDownload = async (item: any) => {
    if (!item || !item.url) return;
    
    // Check if it's a direct file or a hosted platform
    const isDirectFile = item.url.includes('firebasestorage.googleapis.com') ||
                         item.url.match(/\.(jpeg|jpg|gif|png|webp|mp4|webm|ogg|mp3|wav)/i);

    if (!isDirectFile) {
      toast.info("This is an externally hosted link (YouTube/Vimeo). Opening in a new tab to play or download...");
      window.open(item.url, '_blank');
      return;
    }

    const toastId = toast.loading(`Preparing optimized download for "${item.title || 'media'}"...`);
    
    try {
      const response = await fetch(item.url);
      if (!response.ok) throw new Error('CORS or connectivity blockage');
      
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      
      let extension = item.type === 'video' ? 'mp4' : 'jpg';
      const match = item.url.split('?')[0].match(/\.([a-zA-Z0-9]+)$/);
      if (match) {
        extension = match[1];
      }
      
      const fileName = `${(item.title || 'grefas_media').toLowerCase().replace(/[^a-z0-9]+/g, '_')}.${extension}`;
      
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      
      toast.success('Download started successfully!', { id: toastId });
    } catch (error) {
      console.warn('Direct fetch download failed, falling back to direct tab access:', error);
      
      try {
        const link = document.createElement('a');
        link.href = item.url;
        link.target = '_blank';
        link.download = item.title || 'grefas_download';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('A new browser tab was opened to initiate download.', { id: toastId });
      } catch (fallbackErr) {
        toast.error('Could not complete download automatically.', { id: toastId });
      }
    }
  };

  const handleDelete = async (item: any) => {
    if (!window.confirm('Are you sure you want to delete this gallery item? This action cannot be undone.')) {
      return;
    }

    try {
      // Delete Firestore doc
      await deleteDoc(doc(db, 'gallery', item.id));

      // Attempt storage cleanup if applicable
      if (item.url && item.url.includes('firebasestorage.googleapis.com')) {
        try {
          const storageRef = ref(storage, item.url);
          await deleteObject(storageRef);
        } catch (e) {
          console.warn("Could not delete main file from storage:", e);
        }
      }
      
      if (item.thumbnail && item.thumbnail.includes('firebasestorage.googleapis.com')) {
        try {
          const thumbRef = ref(storage, item.thumbnail);
          await deleteObject(thumbRef);
        } catch (e) {
          console.warn("Could not delete thumbnail from storage:", e);
        }
      }

      toast.success('Gallery item deleted successfully');
      if (selectedItem?.id === item.id) {
        setSelectedItem(null);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `gallery/${item.id}`);
      toast.error('Failed to delete item');
    }
  };

  const categories = ['all', 'events', 'entertainment', 'consulting'];
  const isAdmin = userRole === 'admin' || userRole === 'editor';
  const filteredItems = activeTab === 'all' ? items : items.filter(item => item.category === activeTab);

  if (loading) {
    return (
      <div className="bg-background py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="h-10 w-64 bg-muted animate-pulse mx-auto rounded-lg" />
            <div className="h-6 w-80 bg-muted animate-pulse mx-auto mt-4 rounded-lg" />
          </div>

          <div className="mt-12 flex justify-center">
            <div className="flex bg-muted p-1 rounded-md">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-9 w-24 bg-muted-foreground/10 animate-pulse mx-1 rounded" />
              ))}
            </div>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-[350px] rounded-3xl bg-muted animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background min-h-screen">
      {/* Hero Section with Pattern */}
      <div className="relative overflow-hidden pt-24 pb-16 bg-muted/10">
        <div className="absolute inset-0 z-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)', backgroundSize: '32px 32px' }}></div>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <span className="inline-block px-4 py-1.5 rounded-full bg-orange-600/10 text-orange-600 text-xs font-bold uppercase tracking-[0.2em] mb-4">
              Visual Journey
            </span>
            <h1 className="text-5xl font-black tracking-tighter text-foreground sm:text-6xl lg:text-7xl">
              Our <span className="text-orange-600">Gallery</span>
            </h1>
            <p className="mt-6 text-xl text-muted-foreground max-w-2xl mx-auto font-medium">
              Capturing moments of excellence and world-class entertainment across Africa and beyond.
            </p>
          </motion.div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-24">
        <Tabs defaultValue="all" className="w-full" onValueChange={setActiveTab}>
          <div className="flex justify-center sticky top-20 z-30 py-4 bg-background/80 backdrop-blur-md mb-8">
            <TabsList className="bg-muted/50 p-1 rounded-full border border-border/50">
              {categories.map((cat) => (
                <TabsTrigger 
                  key={cat} 
                  value={cat} 
                  className="capitalize px-8 py-2.5 rounded-full data-[state=active]:bg-orange-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300 font-bold text-sm"
                >
                  {cat}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 auto-rows-[300px]"
            >
              {filteredItems.map((item, i) => {
                // Occasional large items for bento feel
                const isLarge = i % 7 === 0;
                const isWide = i % 10 === 3;
                
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.05, duration: 0.5 }}
                    className={`group relative cursor-pointer overflow-hidden rounded-[2rem] bg-muted ring-1 ring-border/50 shadow-sm hover:shadow-2xl hover:shadow-orange-500/15 transition-all duration-700 ${
                      isLarge ? 'md:row-span-2' : ''
                    } ${isWide ? 'md:col-span-2' : ''}`}
                  >
                    <div 
                      className="h-full w-full relative cursor-pointer"
                      onClick={() => setSelectedItem(item)}
                    >
                      <ImageWithLoading
                        src={item.type === 'image' ? item.url : item.thumbnail}
                        alt={item.title}
                        className="h-full w-full object-cover transition-transform duration-1000 ease-out group-hover:scale-110"
                      />
                    </div>
                    
                    {/* Floating Info Badge */}
                    <div className="absolute top-4 left-4 z-20 flex flex-col space-y-2 pointer-events-none">
                      <span className="glass-overlay px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-white self-start">
                        {item.category}
                      </span>
                    </div>

                    {isAdmin && (
                      <div className="absolute top-12 left-4 z-30">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(item); }}
                          className="bg-red-600/20 hover:bg-red-600 text-white p-2 rounded-full backdrop-blur-md transition-all self-start pointer-events-auto"
                          title="Delete Item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}

                    {/* Watermark Branding */}
                    <div className="pointer-events-none absolute bottom-6 right-6 z-10 opacity-10 select-none group-hover:opacity-30 transition-opacity">
                      <p className="text-[10px] font-black tracking-widest text-white uppercase origin-right -rotate-90 translate-x-1/2">
                        GREFAS
                      </p>
                    </div>

                    {/* Refined Glass Overlay */}
                    <div 
                      className="absolute inset-0 bg-linear-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col justify-end p-8 cursor-pointer"
                      onClick={() => setSelectedItem(item)}
                    >
                      <motion.div 
                        initial={{ y: 20, opacity: 0 }}
                        whileInView={{ y: 0, opacity: 1 }}
                        className="space-y-3 pointer-events-none"
                      >
                        <div className="flex items-center justify-between">
                          <h3 className="text-2xl font-black text-white leading-none tracking-tight text-glow">
                            {item.title}
                          </h3>
                          {item.type === 'video' && (
                            <div className="rounded-full bg-orange-600 p-3 text-white shadow-xl shadow-orange-600/50 animate-pulse-soft">
                              <Play className="h-5 w-5 fill-current" />
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center space-x-4 pt-2 border-t border-white/10 pointer-events-auto">
                          <div className="flex items-center space-x-1.5 text-orange-400">
                            <Heart className={`h-4 w-4 ${item.likes?.includes(user?.uid || getAnonymousId()) ? 'fill-current' : ''}`} />
                            <span className="text-xs font-bold">{item.likes?.length || 0}</span>
                          </div>
                          <div className="flex items-center space-x-1.5 text-white/70">
                            <MessageSquare className="h-4 w-4" />
                            <span className="text-xs font-bold">{item.comments?.length || 0}</span>
                          </div>
                          <div className="ml-auto flex items-center space-x-2">
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleDownload(item); }}
                              className="glass-overlay p-2 rounded-full hover:bg-orange-600 transition-colors"
                              title="Download Media File"
                            >
                              <Download className="h-4 w-4 text-white" />
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleShare(item); }}
                              className="glass-overlay p-2 rounded-full hover:bg-orange-600 transition-colors"
                              title="Share Media File"
                            >
                              <Share2 className="h-4 w-4 text-white" />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    </div>
                    
                    {/* Interaction Buttons (Small screen support) */}
                    <div className="absolute top-4 right-4 z-20 md:hidden flex space-x-2 pointer-events-auto">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDownload(item); }}
                        className="glass-overlay p-2 rounded-full text-white hover:bg-orange-600"
                        title="Download Mobile"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </AnimatePresence>

          {filteredItems.length === 0 && (
            <div className="py-32 text-center">
              <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-muted mb-6">
                <Loader2 className="h-10 w-10 text-muted-foreground/30" />
              </div>
              <p className="text-xl font-medium text-muted-foreground">No masterpieces found in this category yet.</p>
              <Button variant="link" onClick={() => setActiveTab('all')} className="mt-2 text-orange-600">
                Show everything
              </Button>
            </div>
          )}
        </Tabs>

        {/* AdSense Unit */}
        <div className="mt-24 max-w-4xl mx-auto">
          <AdSense 
            client="ca-pub-8193654467459416"
            slot="gallery_bottom"
            className="rounded-3xl overflow-hidden shadow-2xl shadow-orange-500/5 ring-1 ring-border"
          />
        </div>

        {/* Cinematic Media Modal */}
        <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
          <DialogContent className="max-w-7xl overflow-hidden p-0 bg-black border-none gap-0 sm:rounded-[2rem] h-[90vh] md:h-[85vh]">
            <DialogTitle className="sr-only">
              {selectedItem?.title || "Gallery Media Details"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              View details, likes, comments and engage with this media.
            </DialogDescription>
            <div className="flex flex-col md:flex-row h-full">
              {/* Media Section (Dominant) */}
              <div className="h-[40vh] md:h-full w-full md:flex-1 bg-neutral-950 flex items-center justify-center relative overflow-hidden group">
                <MediaViewer item={selectedItem} />
                
                {/* Floating Close - Mobile */}
                <button 
                  onClick={() => setSelectedItem(null)}
                  className="absolute top-6 right-6 z-50 md:hidden glass-overlay p-2 rounded-full text-white"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* Sidebar Section (Interactions & Details) */}
              <div className="w-full md:w-[400px] h-[50vh] md:h-full flex flex-col bg-card border-l border-white/5">
                <div className="p-8 border-b border-border/50 bg-muted/20">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="px-3 py-1 bg-orange-600/10 text-orange-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                        {selectedItem?.category}
                      </span>
                      {isAdmin && (
                        <button
                          onClick={() => handleDelete(selectedItem)}
                          className="text-red-500 hover:text-red-600 transition-colors"
                          title="Delete Item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <button onClick={() => setSelectedItem(null)} className="text-muted-foreground hover:text-foreground hidden md:block">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <h2 className="text-2xl font-black text-foreground tracking-tight leading-none mb-4">
                    {selectedItem?.title}
                  </h2>
                  
                  <div className="flex items-center space-x-4">
                    <button 
                      onClick={() => handleLike(selectedItem)}
                      className={`flex items-center space-x-2 transition-all group/like ${
                        selectedItem?.likes?.includes(user?.uid || getAnonymousId()) ? 'text-orange-600' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <div className={`p-2 rounded-full transition-colors ${selectedItem?.likes?.includes(user?.uid || getAnonymousId()) ? 'bg-orange-600/10' : 'bg-muted group-hover/like:bg-muted-foreground/10'}`}>
                        <Heart className={`h-5 w-5 ${selectedItem?.likes?.includes(user?.uid || getAnonymousId()) ? 'fill-current animate-float' : ''}`} />
                      </div>
                      <span className="font-bold text-md">{selectedItem?.likes?.length || 0}</span>
                    </button>

                    <button 
                      onClick={() => handleDownload(selectedItem)}
                      className="flex items-center space-x-2 text-muted-foreground hover:text-foreground transition-all group/download"
                      title="Download Media File"
                    >
                      <div className="p-2 rounded-full bg-muted group-hover/download:bg-muted-foreground/10">
                        <Download className="h-5 w-5" />
                      </div>
                      <span className="font-bold text-md">Download</span>
                    </button>

                    <button 
                      onClick={() => handleShare(selectedItem)}
                      className="flex items-center space-x-2 text-muted-foreground hover:text-foreground transition-all group/share"
                      title="Share Media File"
                    >
                      <div className="p-2 rounded-full bg-muted group-hover/share:bg-muted-foreground/10">
                        <Share2 className="h-5 w-5" />
                      </div>
                      <span className="font-bold text-md">Share</span>
                    </button>
                  </div>
                </div>

                {/* Styled Comments */}
                <div className="flex-1 overflow-y-auto p-8 space-y-6 scrollbar-hide">
                  <h4 className="flex items-center text-xs font-black uppercase tracking-[0.2em] text-muted-foreground mb-6">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Community Comments ({selectedItem?.comments?.length || 0})
                  </h4>
                  
                  {selectedItem?.comments?.map((comment: any, i: number) => (
                    <motion.div 
                      key={i} 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="group/comment"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-black text-foreground">{comment.userName}</span>
                        <span className="text-[10px] font-medium text-muted-foreground/60">
                          {new Date(comment.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      <div className="p-4 rounded-2xl bg-muted/30 group-hover/comment:bg-muted/50 transition-colors">
                        <p className="text-sm text-foreground/80 leading-relaxed font-medium">{comment.text}</p>
                      </div>
                    </motion.div>
                  ))}
                  
                  {(!selectedItem?.comments || selectedItem.comments.length === 0) && (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="p-4 rounded-full bg-muted/50 mb-4">
                        <MessageSquare className="h-8 w-8 text-muted-foreground/20" />
                      </div>
                      <p className="text-sm font-bold text-muted-foreground tracking-tight">Silent so far.</p>
                      <p className="text-xs text-muted-foreground/60">Be the first player to comment!</p>
                    </div>
                  )}
                </div>

                {/* Refined Form */}
                <div className="p-6 border-t border-border/50 bg-muted/10">
                  <form onSubmit={handleAddComment} className="space-y-4">
                    {!user && (
                      <div className="relative group/input">
                        <Input
                          placeholder="Your identity..."
                          value={guestName}
                          onChange={(e) => setGuestName(e.target.value)}
                          className="bg-background border-border/50 focus:border-orange-600 rounded-xl h-10 text-xs font-bold transition-all"
                          required={!user}
                        />
                      </div>
                    )}
                    <div className="flex space-x-2">
                      <Input
                        placeholder="Speak your mind..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        className="flex-1 bg-background border-border/50 focus:border-orange-600 rounded-xl h-12 transition-all"
                      />
                      <Button 
                        type="submit" 
                        disabled={!newComment.trim() || (!user && !guestName.trim())} 
                        className="h-12 w-12 rounded-xl bg-orange-600 text-white shadow-lg shadow-orange-600/30 hover:scale-105 active:scale-95 transition-all"
                      >
                        <Send className="h-5 w-5" />
                      </Button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
