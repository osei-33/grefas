import * as React from 'react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth, handleFirestoreError, OperationType } from '@/firebase';
import { collection, onSnapshot, query, orderBy, updateDoc, doc, arrayUnion, arrayRemove, increment } from 'firebase/firestore';
import { Loader2, Play, X, Heart, MessageSquare, Share2, Send } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { onAuthStateChanged } from 'firebase/auth';

export default function Gallery() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [newComment, setNewComment] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setUser(user);
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

  const handleLike = async (item: any) => {
    if (!user) {
      toast.error('Please sign in to like items');
      return;
    }

    const itemRef = doc(db, 'gallery', item.id);
    const isLiked = item.likes?.includes(user.uid);

    try {
      await updateDoc(itemRef, {
        likes: isLiked ? arrayRemove(user.uid) : arrayUnion(user.uid),
        likesCount: increment(isLiked ? -1 : 1)
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `gallery/${item.id}`);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error('Please sign in to comment');
      return;
    }
    if (!newComment.trim()) return;

    const itemRef = doc(db, 'gallery', selectedItem.id);
    const comment = {
      userId: user.uid,
      userName: user.displayName || user.email.split('@')[0],
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

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
      </div>
    );
  }

  const categories = ['all', 'events', 'entertainment', 'consulting'];
  const filteredItems = activeTab === 'all' ? items : items.filter(item => item.category === activeTab);

  return (
    <div className="bg-background py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">Our Gallery</h1>
          <p className="mt-4 text-lg text-muted-foreground">Moments of excellence and entertainment.</p>
        </div>

        <Tabs defaultValue="all" className="mt-12" onValueChange={setActiveTab}>
          <div className="flex justify-center">
            <TabsList className="bg-muted p-1">
              {categories.map((cat) => (
                <TabsTrigger key={cat} value={cat} className="capitalize px-6">
                  {cat}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {categories.map((cat) => (
            <TabsContent key={cat} value={cat} className="mt-12">
              <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
                {filteredItems.map((item, i) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1, duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                    className="group relative h-[350px] cursor-pointer overflow-hidden rounded-3xl bg-muted ring-1 ring-border/50 shadow-sm transition-all duration-500 hover:shadow-2xl hover:shadow-orange-500/10 hover:-translate-y-2"
                  >
                    <img
                      src={item.type === 'image' ? item.url : item.thumbnail}
                      alt={item.title}
                      className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                      referrerPolicy="no-referrer"
                      onClick={() => setSelectedItem(item)}
                    />
                    
                    {/* Watermark */}
                    <div className="pointer-events-none absolute bottom-4 left-4 z-10 select-none opacity-20">
                      <p className="text-[8px] font-black tracking-widest text-white drop-shadow-md uppercase">
                        GREFAS • CONSULT • ENTERTAINMENT
                      </p>
                    </div>

                    {/* Gradient Overlay (Always visible but subtle at bottom) */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-100 transition-opacity duration-300" />
                    
                    {/* Interaction Buttons (Slide in from top) */}
                    <div className="absolute top-4 right-4 z-20 flex space-x-2 translate-y-[-10px] opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleLike(item); }}
                        className={`rounded-full p-2.5 backdrop-blur-xl transition-all hover:scale-110 ${
                          item.likes?.includes(user?.uid) ? 'bg-orange-600 text-white' : 'bg-white/20 text-white hover:bg-white/40'
                        }`}
                      >
                        <Heart className={`h-4 w-4 ${item.likes?.includes(user?.uid) ? 'fill-current' : ''}`} />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleShare(item); }}
                        className="rounded-full bg-white/20 p-2.5 text-white backdrop-blur-xl transition-all hover:bg-white/40 hover:scale-110"
                      >
                        <Share2 className="h-4 w-4" />
                      </button>
                    </div>
                    
                    {/* Content (Bottom) */}
                    <div className="absolute bottom-0 left-0 right-0 p-6 z-20 transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300" onClick={() => setSelectedItem(item)}>
                      <div className="flex items-end justify-between">
                        <div className="space-y-1">
                          <span className="inline-block px-2 py-0.5 rounded-full bg-orange-600/20 text-orange-400 text-[10px] font-black uppercase tracking-wider backdrop-blur-md">
                            {item.category}
                          </span>
                          <h3 className="text-xl font-bold text-white leading-tight">{item.title}</h3>
                        </div>
                        {item.type === 'video' && (
                          <div className="rounded-full bg-orange-600 p-3 text-white shadow-lg shadow-orange-600/40 transform group-hover:scale-110 transition-transform">
                            <Play className="h-4 w-4 fill-current" />
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
              {filteredItems.length === 0 && (
                <div className="py-20 text-center text-muted-foreground">
                  No items found in this category.
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>

        {/* Media Modal */}
        <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
          <DialogContent className="max-w-5xl overflow-hidden p-0 bg-card border-border">
            <div className="grid grid-cols-1 lg:grid-cols-3 h-full max-h-[90vh]">
              {/* Media Section */}
              <div className="lg:col-span-2 bg-black flex items-center justify-center relative min-h-[300px]">
                {selectedItem?.type === 'image' ? (
                  <img
                    src={selectedItem.url}
                    alt={selectedItem.title}
                    className="max-h-full max-w-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    {selectedItem?.url?.includes('youtube.com') || selectedItem?.url?.includes('youtu.be') || selectedItem?.url?.includes('vimeo.com') ? (
                      <iframe
                        src={(() => {
                          const url = selectedItem.url;
                          if (url.includes('youtube.com') || url.includes('youtu.be')) {
                            const id = url.includes('v=') ? url.split('v=')[1].split('&')[0] : (url.includes('youtu.be/') ? url.split('youtu.be/')[1].split('?')[0] : url.split('/').pop()?.split('?')[0]);
                            return `https://www.youtube.com/embed/${id}`;
                          }
                          if (url.includes('vimeo.com')) {
                            const id = url.split('/').pop()?.split('?')[0];
                            return `https://player.vimeo.com/video/${id}`;
                          }
                          return url;
                        })()}
                        className="aspect-video w-full h-full"
                        allow="autoplay; fullscreen; picture-in-picture"
                        allowFullScreen
                        title={selectedItem.title}
                      />
                    ) : (
                      <video
                        src={selectedItem?.url}
                        controls
                        className="max-h-full max-w-full"
                        poster={selectedItem?.thumbnail}
                      >
                        Your browser does not support the video tag.
                      </video>
                    )}
                  </div>
                )}
              </div>

              {/* Interactions Section */}
              <div className="flex flex-col border-l border-border bg-card">
                <div className="p-6 border-b border-border">
                  <DialogTitle className="text-xl font-bold text-foreground">{selectedItem?.title}</DialogTitle>
                  <p className="mt-1 text-sm text-muted-foreground capitalize">{selectedItem?.category}</p>
                  
                  <div className="mt-4 flex items-center space-x-6">
                    <button 
                      onClick={() => handleLike(selectedItem)}
                      className={`flex items-center space-x-2 text-sm font-medium transition-colors ${
                        selectedItem?.likes?.includes(user?.uid) ? 'text-orange-600' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Heart className={`h-5 w-5 ${selectedItem?.likes?.includes(user?.uid) ? 'fill-current' : ''}`} />
                      <span>{selectedItem?.likes?.length || 0}</span>
                    </button>
                    <div className="flex items-center space-x-2 text-sm font-medium text-muted-foreground">
                      <MessageSquare className="h-5 w-5" />
                      <span>{selectedItem?.comments?.length || 0}</span>
                    </div>
                    <button 
                      onClick={() => handleShare(selectedItem)}
                      className="flex items-center space-x-2 text-sm font-medium text-muted-foreground hover:text-foreground"
                    >
                      <Share2 className="h-5 w-5" />
                      <span>Share</span>
                    </button>
                  </div>
                </div>

                {/* Comments List */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {selectedItem?.comments?.map((comment: any, i: number) => (
                    <div key={i} className="flex flex-col space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-foreground">{comment.userName}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(comment.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{comment.text}</p>
                    </div>
                  ))}
                  {(!selectedItem?.comments || selectedItem.comments.length === 0) && (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No comments yet. Be the first to comment!
                    </div>
                  )}
                </div>

                {/* Comment Input */}
                <form onSubmit={handleAddComment} className="p-4 border-t border-border">
                  <div className="flex space-x-2">
                    <Input
                      placeholder={user ? "Add a comment..." : "Sign in to comment"}
                      disabled={!user}
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      className="flex-1 bg-muted/50 border-border"
                    />
                    <Button type="submit" size="icon" disabled={!user || !newComment.trim()} className="bg-orange-600 text-white">
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
