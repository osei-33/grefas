import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Search, Loader2, FileText, Briefcase, FolderKanban, BookOpen, X, Sparkles, CornerDownLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '@/firebase';
import { collection, getDocs } from 'firebase/firestore';

interface SearchResult {
  id: string;
  title: string;
  description: string;
  category: string;
  type: 'service' | 'portfolio' | 'blog' | 'page';
  url: string;
  imageUrl?: string;
}

export default function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [queryStr, setQueryStr] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [allData, setAllData] = useState<SearchResult[]>([]);
  const [fetched, setFetched] = useState(false);
  
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Predefined core page routes for search routing
  const staticPages: SearchResult[] = [
    { id: 'p-home', title: 'Home / Welcome Page', description: 'Grefas Consult & Entertainment hub. Business advisory, elite booking, and media gallery homepage.', category: 'Navigation', type: 'page', url: '/' },
    { id: 'p-about', title: 'About Us / Consultancy Bio', description: 'Learn about Grefas mission, expertise, goals, and leadership values in Ghana and globally.', category: 'Navigation', type: 'page', url: '/about' },
    { id: 'p-services', title: 'Our Services', description: 'Explore our business advisory, public relations, creative media production, and artist management offers.', category: 'Navigation', type: 'page', url: '/services' },
    { id: 'p-portfolio', title: 'Portfolio Projects', description: 'Browse our historical success work portfolio, client cases, artistic programs, and entertainment milestones.', category: 'Navigation', type: 'page', url: '/portfolio' },
    { id: 'p-gallery', title: 'Media & Production Gallery', description: 'Watch music videos, comedy skits, film clips, client projects, and promotional media files.', category: 'Navigation', type: 'page', url: '/gallery' },
    { id: 'p-team', title: 'Meet Our Experts Team', description: 'Connect with our specialized advisory, business leaders, legal experts, event producers, and creators.', category: 'Navigation', type: 'page', url: '/team' },
    { id: 'p-booking', title: 'Book a Legal/Business Session', description: 'Schedule strategic sessions, physical and remote bookings, and legal contract setups with the Grefas board.', category: 'Navigation', type: 'page', url: '/booking' },
    { id: 'p-contact', title: 'Contact Grefas Consultants', description: 'Reach our helpline, get GPS directions, drop direct feedback messages, or visit Nyinahin office.', category: 'Navigation', type: 'page', url: '/contact' }
  ];

  // Fetch searchable assets once from Firestore
  const fetchSearchData = async () => {
    if (fetched && allData.length > 0) return;
    setLoading(true);
    try {
      const compiled: SearchResult[] = [...staticPages];

      // 1. SERVICES
      try {
        const servicesSnap = await getDocs(collection(db, 'services'));
        servicesSnap.docs.forEach(doc => {
          const data = doc.data();
          compiled.push({
            id: `service-${doc.id}`,
            title: data.title || '',
            description: data.description || '',
            category: data.category || 'Consulting',
            type: 'service',
            url: `/services/${doc.id}`,
            imageUrl: data.imageUrl || ''
          });
        });
      } catch (e) {
        console.warn("Could not fetch services for search:", e);
      }

      // 2. PORTFOLIO
      try {
        const portfolioSnap = await getDocs(collection(db, 'portfolio'));
        portfolioSnap.docs.forEach(doc => {
          const data = doc.data();
          compiled.push({
            id: `portfolio-${doc.id}`,
            title: data.title || '',
            description: data.description || '',
            category: data.category || 'Portfolio',
            type: 'portfolio',
            url: '/portfolio',
            imageUrl: data.imageUrl || ''
          });
        });
      } catch (e) {
        console.warn("Could not fetch portfolio for search:", e);
      }

      // 3. BLOGS
      try {
        const blogsSnap = await getDocs(collection(db, 'blogs'));
        blogsSnap.docs.forEach(doc => {
          const data = doc.data();
          compiled.push({
            id: `blog-${doc.id}`,
            title: data.title || '',
            description: data.summary || data.content || '',
            category: data.category || 'Advisory News',
            type: 'blog',
            url: '/services', // Blogs are typically shown inside or linked to services-blogs modules
            imageUrl: data.image || ''
          });
        });
      } catch (e) {
        console.warn("Could not fetch blogs for search:", e);
      }

      setAllData(compiled);
      setFetched(true);
    } catch (err) {
      console.error("Error building search index:", err);
    } finally {
      setLoading(false);
    }
  };

  // Pre-load on hover or mount
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchSearchData();
      document.body.style.overflow = 'hidden';
      // Refocus input
      setTimeout(() => inputRef.current?.focus(), 150);
    } else {
      document.body.style.overflow = '';
      setQueryStr('');
      setResults([]);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    if (!queryStr.trim()) {
      setResults([]);
      return;
    }

    const term = queryStr.toLowerCase();
    const matches = allData.filter(item => {
      return (
        item.title.toLowerCase().includes(term) ||
        item.description.toLowerCase().includes(term) ||
        item.category.toLowerCase().includes(term)
      );
    });
    setResults(matches);
  }, [queryStr, allData]);

  const handleResultClick = (url: string) => {
    setIsOpen(false);
    navigate(url);
  };

  return (
    <>
      {/* Header Search Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center space-x-2 text-sm text-muted-foreground bg-muted/40 hover:bg-muted/70 hover:text-foreground border border-border/40 focus:outline-none focus:ring-2 focus:ring-orange-500/20 rounded-xl px-3 py-1.5 w-40 sm:w-48 lg:w-56 transition-all group cursor-pointer"
        id="global-search-trigger"
        title="Search the Grefas Platform"
      >
        <Search className="h-4 w-4 shrink-0 text-orange-600 group-hover:scale-110 transition-transform" />
        <span className="flex-1 text-left text-xs truncate">Search services, blogs, projects...</span>
        <kbd className="pointer-events-none hidden sm:inline-flex h-4 select-none items-center gap-1 rounded border border-border/70 bg-background px-1.5 font-mono text-[9px] font-medium text-muted-foreground opacity-80">
          <span>⌘</span>K
        </kbd>
      </button>

      {/* Floating command search portal */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-[10vh] px-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="absolute inset-0 bg-background/80 backdrop-blur-md"
            />

            {/* Modal Box */}
            <motion.div
              ref={modalRef}
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[75vh]"
              id="global-search-container"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border/60 p-4">
                <div className="flex items-center space-x-3 flex-1">
                  <Search className="h-5 w-5 text-orange-600 shrink-0" />
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="Type to search service listings, creative portfolios, advisory pieces..."
                    value={queryStr}
                    onChange={(e) => setQueryStr(e.target.value)}
                    className="w-full bg-transparent border-0 outline-none text-sm text-foreground placeholder:text-muted-foreground/60 focus:ring-0"
                    id="global-search-input"
                  />
                  {loading && <Loader2 className="h-4 w-4 animate-spin text-orange-600 shrink-0" />}
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                  title="Close Search"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              {/* Status bar / Quick Tips */}
              <div className="bg-muted/30 px-4 py-2 border-b border-border/40 flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                <span className="flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-orange-600" />
                  PRO TIP: Search "consulting" or "events" to filter by agency track
                </span>
                <span className="hidden sm:inline">Press Esc to exit</span>
              </div>

              {/* Search Results Display Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {queryStr.trim() === '' ? (
                  <div className="space-y-4">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Quick Navigation Links</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {staticPages.map(page => (
                        <button
                          key={page.id}
                          onClick={() => handleResultClick(page.url)}
                          className="flex items-start space-x-3 p-2.5 rounded-xl border border-border/40 hover:bg-muted/40 hover:border-border transition-all text-left group cursor-pointer"
                        >
                          <div className="p-1.5 rounded-lg bg-orange-500/10 text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-colors">
                            <FileText className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-xs font-semibold text-foreground group-hover:text-orange-600 transition-colors truncate">{page.title}</h4>
                            <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{page.description}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : results.length > 0 ? (
                  <div className="space-y-4">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                      <span>Matches Found ({results.length})</span>
                      <span className="text-[10px] font-normal text-orange-600 bg-orange-500/10 px-2 py-0.5 rounded-full">INDEX READY</span>
                    </p>
                    
                    <div className="space-y-2">
                      {results.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => handleResultClick(item.url)}
                          className="w-full flex items-center justify-between p-3 rounded-xl border border-border/40 bg-card hover:bg-muted/40 hover:border-border hover:translate-x-1.5 transition-all text-left group cursor-pointer"
                        >
                          <div className="flex items-center space-x-3.5 min-w-0 flex-1">
                            {/* Type Icon indicator */}
                            <div className="h-10 w-10 rounded-lg overflow-hidden bg-muted flex items-center justify-center shrink-0 border border-border/30">
                              {item.imageUrl ? (
                                <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                              ) : item.type === 'service' ? (
                                <Briefcase className="h-5 w-5 text-orange-600" />
                              ) : item.type === 'portfolio' ? (
                                <FolderKanban className="h-5 w-5 text-teal-600" />
                              ) : item.type === 'blog' ? (
                                <BookOpen className="h-5 w-5 text-amber-600" />
                              ) : (
                                <FileText className="h-5 w-5 text-blue-600" />
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center space-x-2">
                                <span className="text-xs font-bold text-foreground line-clamp-1 group-hover:text-orange-600 transition-colors">
                                  {item.title}
                                </span>
                                <span className="text-[9px] font-bold text-muted-foreground/80 tracking-widest uppercase px-1.5 py-0.5 rounded bg-muted">
                                  {item.category}
                                </span>
                              </div>
                              <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                                {item.description}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center shrink-0 pl-3">
                            <CornerDownLeft className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:text-orange-600 translate-x-2 group-hover:translate-x-0 transition-all duration-200" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <Search className="h-8 w-8 text-muted-foreground/35 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-foreground">No matches matching "{queryStr}"</p>
                    <p className="text-xs text-muted-foreground max-w-xs mx-auto mt-1 leading-relaxed">
                      Verify spelling, try generic terms, or select one of Grefas static pages to redirect instantly.
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
