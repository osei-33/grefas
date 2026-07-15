import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth, storage, handleFirestoreError, OperationType } from '@/firebase';
import { collection, onSnapshot, query, orderBy, updateDoc, doc, arrayUnion, arrayRemove, increment, deleteDoc, getDoc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { Loader2, Play, X, Heart, MessageSquare, Share2, Send, Trash2, Download, ChevronLeft, ChevronRight, Maximize2, Minimize2, AlertCircle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { onAuthStateChanged } from 'firebase/auth';
import { AdSense } from '@/components/AdSense';
import { safeGetLocalStorage, safeSetLocalStorage } from '@/lib/utils';
import SEO from '@/components/SEO';

const ImageWithLoading = ({ src, alt, className, onClick }: { src: string; alt: string; className?: string; onClick?: () => void }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  
  return (
    <div 
      className={`relative w-full bg-muted/20 overflow-hidden ${!isLoaded ? 'animate-pulse' : ''}`}
      style={{ minHeight: !isLoaded ? '180px' : 'auto' }}
    >
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-linear-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_3s_infinite]">
          <Loader2 className="h-5 w-5 animate-spin text-orange-200/30" />
        </div>
      )}
      <img
        src={src}
        alt={alt}
        className={`${className || ''} ${isLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-105'} transition-all duration-1000 ease-out w-full h-auto block`}
        referrerPolicy="no-referrer"
        loading="lazy"
        onLoad={() => setIsLoaded(true)}
        onClick={onClick}
      />
    </div>
  );
};

const VideoCover = ({ url, thumbnail, title }: { url: string; thumbnail?: string; title: string }) => {
  const secureUrl = (url || "").replace(/^http:/, "https:");
  const secureThumbnail = (thumbnail || "").replace(/^http:/, "https:");

  const [isHovered, setIsHovered] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [localThumb, setLocalThumb] = useState<string | null>(secureThumbnail || null);

  // Helper to extract YouTube video ID
  const getYoutubeId = (urlStr: string) => {
    if (!urlStr) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = urlStr.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const youtubeId = getYoutubeId(secureUrl);

  // Helper to extract Vimeo ID
  const getVimeoId = (urlStr: string) => {
    if (!urlStr) return null;
    const regExp = /vimeo\.com\/(?:video\/)?([0-9]+)/;
    const match = urlStr.match(regExp);
    return match ? match[1] : null;
  };

  const vimeoId = getVimeoId(secureUrl);

  useEffect(() => {
    if (localThumb || youtubeId || vimeoId) return;

    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';
    video.src = secureUrl;

    const timeoutId = setTimeout(() => {
      try {
        video.src = '';
      } catch (e) {}
    }, 6000);

    video.onloadedmetadata = () => {
      video.currentTime = 0.1;
    };

    video.onseeked = () => {
      clearTimeout(timeoutId);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 480;
        canvas.height = video.videoHeight || 270;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
          setLocalThumb(dataUrl);
        }
      } catch (e) {
        console.warn('Dynamic thumbnail extraction failure:', e);
      } finally {
        try {
          video.src = '';
        } catch (e) {}
      }
    };

    video.onerror = () => {
      clearTimeout(timeoutId);
      try {
        video.src = '';
      } catch (e) {}
    };

    return () => {
      clearTimeout(timeoutId);
      try {
        video.src = '';
      } catch (e) {}
    };
  }, [secureUrl, localThumb, youtubeId, vimeoId]);

  useEffect(() => {
    if (videoRef.current) {
      if (isHovered) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      }
    }
  }, [isHovered]);

  if (youtubeId) {
    const ytThumb = `https://img.youtube.com/vi/${youtubeId}/0.jpg`;
    return (
      <div className="relative w-full aspect-video bg-black overflow-hidden flex items-center justify-center">
        <img
          src={ytThumb}
          alt={title}
          className="w-full h-full object-cover transition-transform duration-1000 ease-out group-hover:scale-110"
          referrerPolicy="no-referrer"
          loading="lazy"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
          <div className="rounded-full bg-white/20 p-2 text-white backdrop-blur-md">
            <Play className="h-6 w-6 fill-white text-white" />
          </div>
        </div>
      </div>
    );
  }

  if (vimeoId) {
    return (
      <div className="relative w-full aspect-video bg-black overflow-hidden flex items-center justify-center">
        <img
          src={localThumb || "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&q=80"}
          alt={title}
          className="w-full h-full object-cover transition-transform duration-1000 ease-out group-hover:scale-110"
          referrerPolicy="no-referrer"
          loading="lazy"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
          <div className="rounded-full bg-white/20 p-2 text-white backdrop-blur-md">
            <Play className="h-6 w-6 fill-white text-white" />
          </div>
        </div>
      </div>
    );
  }

  // Direct MP4 video preview with hover support
  return (
    <div 
      className="relative w-full aspect-video bg-black overflow-hidden cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Absolute image overlay as the video cover */}
      {localThumb ? (
        <img
          src={localThumb}
          alt={title}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 z-10 ${
            isHovered ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
          referrerPolicy="no-referrer"
          loading="lazy"
        />
      ) : (
        /* Fallback dark cover placeholder if no thumbnail exists */
        <div 
          className={`absolute inset-0 w-full h-full bg-zinc-900 flex items-center justify-center transition-opacity duration-300 z-10 ${
            isHovered ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
        >
          <div className="text-zinc-600 text-xs font-semibold uppercase tracking-wider">Video Clip</div>
        </div>
      )}

      <video
        ref={videoRef}
        src={secureUrl}
        preload="metadata"
        muted
        loop
        playsInline
        className="w-full h-full object-cover"
      />
      
      {!isHovered && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors z-20">
          <div className="rounded-full bg-orange-600/90 p-3 text-white shadow-xl shadow-orange-600/20 backdrop-blur-sm transform transition-transform duration-300 group-hover:scale-115">
            <Play className="h-6 w-6 fill-white text-white" />
          </div>
        </div>
      )}
    </div>
  );
};

const MediaViewer = ({ item }: { item: any }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setIsLoading(true);
    setHasError(false);
    // If the video is already loaded or playing in DOM, reset state
    if (videoRef.current) {
      videoRef.current.load();
    }
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

  // Identify video type
  const getYoutubeId = (urlStr: string) => {
    if (!urlStr) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = urlStr.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const getVimeoId = (urlStr: string) => {
    if (!urlStr) return null;
    const regExp = /vimeo\.com\/(?:video\/)?([0-9]+)/;
    const match = urlStr.match(regExp);
    return match ? match[1] : null;
  };

  const youtubeId = getYoutubeId(item.url);
  const vimeoId = getVimeoId(item.url);

  if (youtubeId) {
    return (
      <div className="w-full h-full relative bg-neutral-950 flex items-center justify-center">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/40">
            <Loader2 className="h-10 w-10 animate-spin text-orange-600" />
            <span className="text-white/50 text-xs font-bold uppercase tracking-widest mt-2">Loading YouTube Video...</span>
          </div>
        )}
        <iframe
          src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0&modestbranding=1`}
          title={item.title}
          onLoad={() => setIsLoading(false)}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="w-full h-full border-none aspect-video max-h-full"
        />
      </div>
    );
  }

  if (vimeoId) {
    return (
      <div className="w-full h-full relative bg-neutral-950 flex items-center justify-center">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/40">
            <Loader2 className="h-10 w-10 animate-spin text-orange-600" />
            <span className="text-white/50 text-xs font-bold uppercase tracking-widest mt-2">Loading Vimeo Video...</span>
          </div>
        )}
        <iframe
          src={`https://player.vimeo.com/video/${vimeoId}?autoplay=1&title=0&byline=0&portrait=0`}
          title={item.title}
          onLoad={() => setIsLoading(false)}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          className="w-full h-full border-none aspect-video max-h-full"
        />
      </div>
    );
  }

  // Strictly upgrade URL schemes to HTTPS to prevent Mixed Content blocking by modern web browsers
  const videoUrl = (item.url || "").replace(/^http:/, "https:");
  const posterUrl = (item.thumbnail || "").replace(/^http:/, "https:");

  // Direct storage / MP4 video with native HTML5 controller and robust fallback
  return (
    <div className="w-full h-full relative bg-black flex flex-col items-center justify-center p-4">
      {isLoading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/40 animate-fade-in">
          <Loader2 className="h-10 w-10 animate-spin text-orange-600" />
          <span className="text-white/50 text-xs font-bold uppercase tracking-widest mt-2">Preparing Video Clip...</span>
        </div>
      )}

      <div className="relative w-full max-h-[75vh] flex items-center justify-center">
        <video
          ref={videoRef}
          src={videoUrl}
          poster={posterUrl}
          controls
          autoPlay
          playsInline
          preload="auto"
          crossOrigin="anonymous"
          onLoadedMetadata={() => {
            setIsLoading(false);
            setHasError(false);
          }}
          onLoadedData={() => {
            setIsLoading(false);
            setHasError(false);
          }}
          onCanPlay={() => {
            setIsLoading(false);
            setHasError(false);
          }}
          onPlay={() => {
            setIsLoading(false);
            setHasError(false);
          }}
          onLoadStart={() => {
            setIsLoading(true);
            setHasError(false);
          }}
          onError={(e) => {
            const videoEl = videoRef.current;
            // Native browsers can fire early non-fatal checks. If some metadata/bytes are loaded, it is fully playable.
            if (videoEl && videoEl.readyState > 0) {
              setIsLoading(false);
              setHasError(false);
              return;
            }
            console.warn('HTML5 video loading notice: dynamic stream error or non-fatal codec query.', e);
            setIsLoading(false);
            setHasError(true);
          }}
          className="max-h-[70vh] max-w-full aspect-video object-contain rounded-xl shadow-2xl border border-white/5 bg-zinc-950"
        >
          Your browser does not support the video tag.
        </video>
      </div>

      {hasError && (
        <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4 p-4 text-left w-full max-w-2xl bg-neutral-900/90 rounded-xl border border-white/10 shadow-lg z-20 animate-fade-in backdrop-blur-sm">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-white tracking-tight">Format or Codec Compatibility</h4>
              <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
                If the video player stays blank or lacks audio, your device may not natively stream this specific codec.
              </p>
            </div>
          </div>
          <a
            href={videoUrl}
            download
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-700 hover:to-amber-600 text-white text-xs font-black rounded-lg shadow-md transition-all duration-300 whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" />
            Download Video
          </a>
        </div>
      )}
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
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<any>(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (authenticatedUser) => {
      setUser(authenticatedUser);
      if (authenticatedUser) {
        const isHardcodedAdmin = authenticatedUser.email && ["serwaahlinda1995@gmail.com", "asantegrice@gmail.com", "asantegrifice@gmail.com", "oseikwameemmanuel33@gmail.com"].includes(authenticatedUser.email.toLowerCase().trim());
        try {
          const userDoc = await getDoc(doc(db, 'users', authenticatedUser.uid));
          if (isHardcodedAdmin) {
            setUserRole('admin');
          } else if (userDoc && userDoc.exists()) {
            setUserRole(userDoc.data().role);
          } else {
            setUserRole('guest');
          }
        } catch (error) {
          if (isHardcodedAdmin) {
            setUserRole('admin');
          } else {
            setUserRole('guest');
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
    
    // Check if it's a data URL
    const isDataUrl = item.url.startsWith('data:');
    
    // Check if it's a direct file or a hosted platform
    const isDirectFile = isDataUrl ||
                         item.url.includes('firebasestorage.googleapis.com') ||
                         item.url.match(/\.(jpeg|jpg|gif|png|webp|mp4|webm|ogg|mp3|wav)/i);

    if (!isDirectFile) {
      toast.info("This is an externally hosted link (YouTube/Vimeo). Opening in a new tab to play or download...");
      window.open(item.url, '_blank');
      return;
    }

    const toastId = toast.loading(`Preparing optimized download for "${item.title || 'media'}"...`);
    
    try {
      if (isDataUrl) {
        // Base64 download
        const link = document.createElement('a');
        link.href = item.url;
        
        let extension = 'jpg';
        const typeMatch = item.url.match(/data:image\/([a-zA-Z0-9+]+);base64/);
        if (typeMatch) {
          extension = typeMatch[1];
          if (extension === 'jpeg') extension = 'jpg';
        }
        
        const fileName = `${(item.title || 'grefas_media').toLowerCase().replace(/[^a-z0-9]+/g, '_')}.${extension}`;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Download started successfully!', { id: toastId });
        return;
      }

      // Use the robust server side proxy to download the file directly, completely avoiding any CORS obstacles!
      const proxyUrl = `/api/proxy-download?url=${encodeURIComponent(item.url)}`;
      
      const link = document.createElement('a');
      link.href = proxyUrl;
      
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
      
      toast.success('Download started successfully!', { id: toastId });
    } catch (error) {
      console.warn('Proxy download request failed, falling back to direct tab access:', error);
      
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

  const handleDelete = (item: any) => {
    setDeleteConfirmItem(item);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmItem) return;
    const item = deleteConfirmItem;
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
    } finally {
      setDeleteConfirmItem(null);
    }
  };

  const categories = ['all', 'events', 'entertainment', 'consulting'];
  const isAdmin = userRole === 'admin' || userRole === 'editor';
  const filteredItems = activeTab === 'all' ? items : items.filter(item => item.category === activeTab);

  const [isLightboxExpanded, setIsLightboxExpanded] = useState(false);

  const handlePrevItem = () => {
    if (!selectedItem || filteredItems.length <= 1) return;
    const currentIndex = filteredItems.findIndex(item => item.id === selectedItem.id);
    if (currentIndex === -1) return;
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : filteredItems.length - 1;
    setSelectedItem(filteredItems[prevIndex]);
  };

  const handleNextItem = () => {
    if (!selectedItem || filteredItems.length <= 1) return;
    const currentIndex = filteredItems.findIndex(item => item.id === selectedItem.id);
    if (currentIndex === -1) return;
    const nextIndex = currentIndex < filteredItems.length - 1 ? currentIndex + 1 : 0;
    setSelectedItem(filteredItems[nextIndex]);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedItem) return;
      if (e.key === 'ArrowLeft') {
        handlePrevItem();
      } else if (e.key === 'ArrowRight') {
        handleNextItem();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedItem, filteredItems]);

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
      <SEO 
        title="Gallery"
        description="Experience the visual journey of Grefas Consult & Entertainment. Discover highlights of our major consult missions, concerts, corporate galas, and live events in Nyinahin-Ashanti, Ashanti Region."
        keywords="Grefas photo gallery, entertainment videos Ghana, Nyinahin event video, corporate gala Africa"
      />
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
              className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-6 [column-fill:_balance]"
            >
              {filteredItems.map((item, i) => {
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 15, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: i * 0.03, duration: 0.4, ease: "easeOut" }}
                    className="break-inside-avoid mb-6 group relative cursor-pointer overflow-hidden rounded-[2rem] bg-muted ring-1 ring-border/50 shadow-sm hover:shadow-2xl hover:shadow-orange-500/15 transition-all duration-500"
                  >
                    <div 
                      className="w-full relative cursor-pointer"
                      onClick={() => setSelectedItem(item)}
                    >
                      {item.type === 'image' ? (
                        <ImageWithLoading
                          src={item.url}
                          alt={item.title}
                          className="w-full h-auto object-cover transition-transform duration-1000 ease-out group-hover:scale-110"
                        />
                      ) : (
                        <VideoCover
                          url={item.url}
                          thumbnail={item.thumbnail}
                          title={item.title}
                        />
                      )}
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
        <Dialog open={!!selectedItem} onOpenChange={() => { setSelectedItem(null); setIsLightboxExpanded(false); }}>
          <DialogContent className={`overflow-hidden p-0 bg-black border-none gap-0 sm:rounded-[2rem] h-[90vh] md:h-[85vh] transition-all duration-300 ${
            isLightboxExpanded ? 'max-w-[95vw]' : 'max-w-7xl'
          }`}>
            <DialogTitle className="sr-only">
              {selectedItem?.title || "Gallery Media Details"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              View details, likes, comments and engage with this media.
            </DialogDescription>
            <div className="flex flex-col md:flex-row h-full">
              {/* Media Section (Dominant) */}
              <div className="h-[45vh] md:h-full w-full md:flex-1 bg-neutral-950 flex items-center justify-center relative overflow-hidden group">
                <MediaViewer item={selectedItem} />
                
                {/* Floating Navigation Controls */}
                {filteredItems.length > 1 && (
                  <>
                    {/* Left Button */}
                    <button 
                      onClick={(e) => { e.stopPropagation(); handlePrevItem(); }}
                      className="absolute left-6 top-1/2 -translate-y-1/2 z-40 p-3 rounded-full bg-black/40 hover:bg-orange-600 border border-white/10 hover:border-orange-500 text-white backdrop-blur-md transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 hidden md:block"
                      title="Previous (Left Arrow)"
                    >
                      <ChevronLeft className="h-6 w-6" />
                    </button>
                    
                    {/* Right Button */}
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleNextItem(); }}
                      className="absolute right-6 top-1/2 -translate-y-1/2 z-40 p-3 rounded-full bg-black/40 hover:bg-orange-600 border border-white/10 hover:border-orange-500 text-white backdrop-blur-md transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 hidden md:block"
                      title="Next (Right Arrow)"
                    >
                      <ChevronRight className="h-6 w-6" />
                    </button>
                  </>
                )}

                {/* Top Control Bar overlay */}
                <div className="absolute top-4 left-4 right-4 z-40 flex items-center justify-between pointer-events-none">
                  {/* Item counter */}
                  <div className="glass-overlay px-4 py-1.5 rounded-full text-xs font-bold text-white/90 shadow-lg pointer-events-auto flex items-center space-x-2">
                    <span className="text-orange-500 font-black">
                      {filteredItems.findIndex(item => item.id === selectedItem?.id) + 1}
                    </span>
                    <span className="text-white/40">/</span>
                    <span>{filteredItems.length}</span>
                  </div>

                  {/* Top Right Controls */}
                  <div className="flex items-center space-x-2 pointer-events-auto">
                    {/* Expand/Collapse Toggle */}
                    <button 
                      onClick={(e) => { e.stopPropagation(); setIsLightboxExpanded(!isLightboxExpanded); }}
                      className="glass-overlay p-2.5 rounded-full text-white hover:bg-orange-600 transition-all shadow-lg hidden md:block"
                      title={isLightboxExpanded ? "Show Details Sidebar" : "Full Screen Lightbox"}
                    >
                      {isLightboxExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                    </button>

                    {/* Floating Close - Desktop (always shown when sidebar is hidden) */}
                    {isLightboxExpanded && (
                      <button 
                        onClick={() => setSelectedItem(null)}
                        className="glass-overlay p-2.5 rounded-full text-white hover:bg-red-600 transition-all shadow-lg"
                        title="Close Overlay"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Floating Close - Mobile */}
                <button 
                  onClick={() => setSelectedItem(null)}
                  className="absolute bottom-6 right-6 z-50 md:hidden glass-overlay p-3 rounded-full text-white shadow-xl shadow-black/50"
                  title="Close Media View"
                >
                  <X className="h-5 w-5" />
                </button>
                
                {/* Mobile Next/Prev floating arrows (always visible, smaller size) */}
                {filteredItems.length > 1 && (
                  <div className="absolute bottom-6 left-6 z-50 md:hidden flex space-x-2">
                    <button 
                      onClick={(e) => { e.stopPropagation(); handlePrevItem(); }}
                      className="glass-overlay p-3 rounded-full text-white shadow-xl"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleNextItem(); }}
                      className="glass-overlay p-3 rounded-full text-white shadow-xl"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Sidebar Section (Interactions & Details) */}
              <div className={`w-full md:w-[400px] h-[45vh] md:h-full flex flex-col bg-card border-l border-white/5 transition-all duration-300 ${
                isLightboxExpanded ? 'hidden' : 'flex'
              }`}>
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

      {/* Custom Delete Confirmation Modal */}
      {deleteConfirmItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] animate-in fade-in">
          <div className="bg-card border border-border rounded-xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-base font-bold text-foreground mb-2 flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-500" /> Confirm Immediate Deletion
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed mb-6">
              Are you sure you want to delete this gallery item? This action is completely permanent and cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setDeleteConfirmItem(null)}
                className="text-xs font-semibold"
              >
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={confirmDelete}
                className="text-xs font-semibold"
              >
                Yes, Delete It
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
