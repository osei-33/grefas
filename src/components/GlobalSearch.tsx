import { useState, useEffect, useRef } from 'react';
import { useSafeNavigate } from '@/lib/safeRouter';
import { 
  Search, 
  Loader2, 
  FileText, 
  Briefcase, 
  FolderKanban, 
  BookOpen, 
  X, 
  Sparkles, 
  CornerDownLeft, 
  Users, 
  ShieldCheck, 
  ExternalLink,
  Tag,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { db } from '@/firebase';
import { collection, getDocs } from 'firebase/firestore';

export interface SearchResult {
  id: string;
  title: string;
  description: string;
  category: string;
  type: 'service' | 'team' | 'portfolio' | 'letter' | 'page';
  url: string;
  imageUrl?: string;
  badge?: string;
  meta?: string;
}

interface GlobalSearchProps {
  compact?: boolean;
}

export default function GlobalSearch({ compact = false }: GlobalSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [queryStr, setQueryStr] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'service' | 'team' | 'portfolio' | 'letter' | 'page'>('all');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [allData, setAllData] = useState<SearchResult[]>([]);
  const [fetched, setFetched] = useState(false);
  
  const navigate = useSafeNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);

  // Predefined core pages
  const staticPages: SearchResult[] = [
    { id: 'p-home', title: 'Home / Welcome Page', description: 'Grefas Consult & Entertainment hub. Business advisory, elite booking, and media gallery homepage.', category: 'Navigation', type: 'page', url: '/' },
    { id: 'p-verify', title: 'Verify Official Letter & Document', description: 'Public verification portal for authentic letters, contracts, visa recommendations, and permits by reference number.', category: 'Verification', type: 'letter', url: '/verify-letter', badge: 'AUTHENTICITY DESK' },
    { id: 'p-about', title: 'About Us / Corporate Bio', description: 'Learn about Grefas mission, leadership values, expertise, and history in Ghana and internationally.', category: 'Navigation', type: 'page', url: '/about' },
    { id: 'p-services', title: 'Our Services Hub', description: 'Explore business advisory, movie and skit production, talent casting, and corporate strategy services.', category: 'Navigation', type: 'page', url: '/services' },
    { id: 'p-team', title: 'Meet Our Experts & Team', description: 'Connect with Dr. Linda Serwaah, Kofi Mensah, Amara Diop, and specialized production directors.', category: 'Navigation', type: 'page', url: '/team' },
    { id: 'p-portfolio', title: 'Portfolio Projects & Milestones', description: 'Browse historical client cases, film productions, theatrical shows, and strategic consult successes.', category: 'Navigation', type: 'page', url: '/portfolio' },
    { id: 'p-gallery', title: 'Media & Production Gallery', description: 'Watch music videos, comedy skits, film clips, client projects, and promotional showcase files.', category: 'Navigation', type: 'page', url: '/gallery' },
    { id: 'p-booking', title: 'Book a Legal or Business Session', description: 'Schedule strategic sessions, remote or in-person advisory appointments, and order confirmation.', category: 'Navigation', type: 'page', url: '/booking' },
    { id: 'p-contact', title: 'Contact Us & GPS Location', description: 'Reach our helpline, get GPS AI-0008-9223 directions, drop direct feedback, or visit Nyinahin office.', category: 'Navigation', type: 'page', url: '/contact' },
    { id: 'p-careers', title: 'Work With Us / Auditions & Careers', description: 'Apply for open corporate roles, film auditions, technical crew, and creative casting calls.', category: 'Navigation', type: 'page', url: '/work-with-us' },
    { id: 'p-sponsorship', title: 'Sponsorship & Partnerships', description: 'Partner with Grefas on landmark cultural productions and youth empowerment initiatives.', category: 'Navigation', type: 'page', url: '/sponsorship' },
    { id: 'p-applications', title: 'My Applications Portal', description: 'Track your submitted casting forms, service intakes, and official receipt vouchers.', category: 'Navigation', type: 'page', url: '/my-applications' }
  ];

  // Default team fallback
  const defaultTeam: SearchResult[] = [
    {
      id: 'team-linda',
      title: 'Dr. Linda Serwaah',
      description: 'Principal Consultant & Executive Director. 12+ Years in Corporate Strategy, Brand Audits, and Venture Incubation.',
      category: 'Leadership',
      type: 'team',
      url: '/team',
      imageUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=500&h=500',
      badge: 'DIRECTOR'
    },
    {
      id: 'team-kofi',
      title: 'Kofi Mensah',
      description: 'Head of Entertainment Production. 9+ Years in Live Events, Creative Directing, Sound Design, and Film Staging.',
      category: 'Entertainment',
      type: 'team',
      url: '/team',
      imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=500&h=500',
      badge: 'PRODUCTION HEAD'
    },
    {
      id: 'team-amara',
      title: 'Amara Diop',
      description: 'Senior Business Specialist. 7+ Years in Strategy & Markets, Financial Engineering, and SME Restructuring.',
      category: 'Consulting',
      type: 'team',
      url: '/team',
      imageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=500&h=500',
      badge: 'STRATEGY LEAD'
    }
  ];

  // Fetch searchable assets from Firestore (Services, Team Members, Portfolio, Letters)
  const fetchSearchData = async () => {
    if (fetched && allData.length > 0) return;
    setLoading(true);
    try {
      const compiled: SearchResult[] = [...staticPages];

      // 1. SERVICES
      try {
        const servicesSnap = await getDocs(collection(db, 'services'));
        if (!servicesSnap.empty) {
          servicesSnap.docs.forEach(doc => {
            const data = doc.data();
            compiled.push({
              id: `service-${doc.id}`,
              title: data.title || 'Official Service',
              description: data.description || 'Professional corporate consulting and entertainment service.',
              category: data.category || 'Consulting',
              type: 'service',
              url: `/services/${doc.id}`,
              imageUrl: data.imageUrl || data.image || '',
              badge: 'SERVICE'
            });
          });
        }
      } catch (e) {
        console.warn("Could not fetch services for search:", e);
      }

      // 2. TEAM MEMBERS
      try {
        const teamSnap = await getDocs(collection(db, 'team_members'));
        if (!teamSnap.empty) {
          teamSnap.docs.forEach(doc => {
            const data = doc.data();
            compiled.push({
              id: `team-${doc.id}`,
              title: data.name || 'Team Specialist',
              description: `${data.role || 'Specialist'}. ${data.bio || (data.skills ? data.skills.join(', ') : '')}`,
              category: data.category || 'Staff',
              type: 'team',
              url: '/team',
              imageUrl: data.imageUrl || data.image || '',
              badge: data.role || 'EXPERT'
            });
          });
        } else {
          compiled.push(...defaultTeam);
        }
      } catch (e) {
        console.warn("Using default team members in search:", e);
        compiled.push(...defaultTeam);
      }

      // 3. PORTFOLIO
      try {
        const portfolioSnap = await getDocs(collection(db, 'portfolio'));
        portfolioSnap.docs.forEach(doc => {
          const data = doc.data();
          compiled.push({
            id: `portfolio-${doc.id}`,
            title: data.title || 'Creative Showcase',
            description: data.description || 'Grefas production milestone and creative project portfolio.',
            category: data.category || 'Portfolio',
            type: 'portfolio',
            url: '/portfolio',
            imageUrl: data.imageUrl || data.image || '',
            badge: 'PORTFOLIO'
          });
        });
      } catch (e) {
        console.warn("Could not fetch portfolio for search:", e);
      }

      // 4. OFFICIAL LETTERS FOR VERIFICATION
      try {
        const lettersSnap = await getDocs(collection(db, 'letters'));
        lettersSnap.docs.forEach(doc => {
          const data = doc.data();
          const refCode = data.referenceNumber || `GREFAS/GEN/${doc.id.substring(0, 6).toUpperCase()}`;
          compiled.push({
            id: `letter-${doc.id}`,
            title: `Official Letter: ${refCode}`,
            description: `Subject: ${data.subject || 'Official Business Correspondence'} • Recipient: ${data.recipientName || 'Addressee'} • Date: ${data.date || 'Active'}`,
            category: data.classification || 'Official Document',
            type: 'letter',
            url: `/verify-letter?ref=${encodeURIComponent(refCode)}`,
            badge: 'OFFICIAL LETTER',
            meta: refCode
          });
        });
      } catch (e) {
        console.warn("Could not fetch letters for verification index:", e);
      }

      setAllData(compiled);
      setFetched(true);
    } catch (err) {
      console.error("Error building search index:", err);
    } finally {
      setLoading(false);
    }
  };

  // Keyboard shortcut listener (⌘K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Open modal handler & body overflow lock
  useEffect(() => {
    if (isOpen) {
      fetchSearchData();
      document.body.style.overflow = 'hidden';
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      document.body.style.overflow = '';
      setQueryStr('');
      setResults([]);
      setSelectedIndex(0);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Filter and search matching logic
  useEffect(() => {
    if (!queryStr.trim()) {
      setResults([]);
      setSelectedIndex(0);
      return;
    }

    const term = queryStr.toLowerCase().trim();
    const isRefPattern = term.includes('grefas') || term.includes('/') || term.includes('ref') || term.length > 5;

    let filtered = allData.filter(item => {
      const matchesCategory = selectedFilter === 'all' || item.type === selectedFilter;
      const matchesQuery = 
        item.title.toLowerCase().includes(term) ||
        item.description.toLowerCase().includes(term) ||
        item.category.toLowerCase().includes(term) ||
        (item.meta && item.meta.toLowerCase().includes(term));
      return matchesCategory && matchesQuery;
    });

    // If query looks like a reference number or document query, inject quick verification card at top
    if (isRefPattern && (selectedFilter === 'all' || selectedFilter === 'letter')) {
      const cleanRefInput = queryStr.trim().toUpperCase();
      const existingExactMatch = filtered.some(f => f.meta?.toUpperCase() === cleanRefInput);
      
      if (!existingExactMatch) {
        const quickVerifyItem: SearchResult = {
          id: `quick-verify-${cleanRefInput}`,
          title: `Verify Official Reference: ${cleanRefInput}`,
          description: `Click to cross-reference this letter code against the official Grefas corporate registry.`,
          category: 'Document Verification',
          type: 'letter',
          url: `/verify-letter?ref=${encodeURIComponent(cleanRefInput)}`,
          badge: 'VERIFY NOW'
        };
        filtered = [quickVerifyItem, ...filtered];
      }
    }

    setResults(filtered);
    setSelectedIndex(0);
  }, [queryStr, selectedFilter, allData]);

  // Handle arrow key navigation in results
  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        handleResultClick(results[selectedIndex].url);
      }
    }
  };

  const handleResultClick = (url: string) => {
    setIsOpen(false);
    navigate(url);
  };

  return (
    <>
      {/* Header Search Trigger Button */}
      {compact ? (
        <button
          onClick={() => setIsOpen(true)}
          className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted border border-border/40 focus:outline-none transition-colors cursor-pointer flex items-center justify-center shrink-0"
          id="global-search-trigger-compact"
          title="Search Grefas Services, Team & Letters"
          aria-label="Open search dialog"
        >
          <Search className="h-4 w-4 text-orange-600" />
        </button>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center space-x-2 text-sm text-muted-foreground bg-muted/40 hover:bg-muted/70 hover:text-foreground border border-border/50 focus:outline-none focus:ring-2 focus:ring-orange-500/20 rounded-xl px-3 py-1.5 w-44 sm:w-56 lg:w-64 transition-all group cursor-pointer shadow-2xs"
          id="global-search-trigger"
          title="Search services, team members, portfolio or verify official letters"
        >
          <Search className="h-4 w-4 shrink-0 text-orange-600 group-hover:scale-110 transition-transform" />
          <span className="flex-1 text-left text-xs truncate">Search services, team, portfolio...</span>
          <kbd className="pointer-events-none hidden sm:inline-flex h-4 select-none items-center gap-0.5 rounded border border-border/80 bg-background px-1.5 font-mono text-[9px] font-semibold text-muted-foreground opacity-80">
            <span>⌘</span>K
          </kbd>
        </button>
      )}

      {/* Floating Command Search Portal */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-[8vh] sm:pt-[10vh] px-4">
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
              initial={{ opacity: 0, scale: 0.95, y: -15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -15 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="relative w-full max-w-2xl bg-card border border-border/90 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[82vh]"
              id="global-search-container"
            >
              {/* Header Input */}
              <div className="flex items-center justify-between border-b border-border/70 p-4">
                <div className="flex items-center space-x-3 flex-1">
                  <Search className="h-5 w-5 text-orange-600 shrink-0" />
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="Search services, team, portfolio, or verify letter reference..."
                    value={queryStr}
                    onChange={(e) => setQueryStr(e.target.value)}
                    onKeyDown={handleInputKeyDown}
                    className="w-full bg-transparent border-0 outline-none text-sm sm:text-base text-foreground placeholder:text-muted-foreground/60 focus:ring-0"
                    id="global-search-input"
                  />
                  {loading && <Loader2 className="h-4 w-4 animate-spin text-orange-600 shrink-0" />}
                </div>
                {queryStr && (
                  <button
                    onClick={() => setQueryStr('')}
                    className="p-1 rounded text-muted-foreground hover:text-foreground text-xs mr-2 cursor-pointer font-medium"
                    title="Clear query"
                  >
                    Clear
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                  title="Close Search (Esc)"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1.5 px-4 py-2 border-b border-border/50 bg-muted/20 overflow-x-auto text-[11px] font-semibold">
                <span className="text-muted-foreground mr-1 text-[10px] uppercase font-bold tracking-wider shrink-0">Filter:</span>
                {[
                  { id: 'all', label: 'All Results' },
                  { id: 'service', label: 'Services', icon: Briefcase },
                  { id: 'team', label: 'Team Members', icon: Users },
                  { id: 'portfolio', label: 'Portfolio', icon: FolderKanban },
                  { id: 'letter', label: 'Letters / Verify', icon: ShieldCheck },
                  { id: 'page', label: 'Pages', icon: FileText }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setSelectedFilter(tab.id as any)}
                    className={`px-2.5 py-1 rounded-lg transition-colors shrink-0 flex items-center gap-1 cursor-pointer ${
                      selectedFilter === tab.id
                        ? 'bg-orange-600 text-white shadow-2xs'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    {tab.icon && <tab.icon className="h-3 w-3" />}
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>

              {/* Search Results Display Area */}
              <div ref={resultsContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
                {queryStr.trim() === '' ? (
                  <div className="space-y-4">
                    {/* Quick Document Verification Callout */}
                    <div 
                      onClick={() => handleResultClick('/verify-letter')}
                      className="bg-linear-to-r from-orange-500/10 via-amber-500/10 to-transparent border border-orange-500/20 p-3.5 rounded-xl flex items-center justify-between cursor-pointer hover:border-orange-500/40 transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-orange-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                          <ShieldCheck className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-foreground group-hover:text-orange-600 transition-colors flex items-center gap-1.5">
                            Verify Official Letter or Appointment Contract <ArrowRight className="h-3 w-3 text-orange-600" />
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            Type any reference number (e.g. GREFAS/CON/2025/104) to instantly authenticate letters.
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-orange-700 dark:text-orange-300 bg-orange-100 dark:bg-orange-950/60 px-2 py-0.5 rounded-full shrink-0 hidden sm:inline-block">
                        INSTANT VERIFY
                      </span>
                    </div>

                    <div>
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2.5">
                        Suggested Platform Navigation
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {staticPages.slice(0, 8).map(page => (
                          <button
                            key={page.id}
                            onClick={() => handleResultClick(page.url)}
                            className="flex items-start space-x-3 p-2.5 rounded-xl border border-border/40 hover:bg-muted/40 hover:border-border transition-all text-left group cursor-pointer"
                          >
                            <div className="p-1.5 rounded-lg bg-orange-500/10 text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-colors shrink-0">
                              {page.type === 'letter' ? <ShieldCheck className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-xs font-semibold text-foreground group-hover:text-orange-600 transition-colors truncate">{page.title}</h4>
                              <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{page.description}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : results.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      <span>Matches Found ({results.length})</span>
                      <span className="text-[10px] font-normal text-muted-foreground">Use ↑ ↓ arrows to navigate, Enter to select</span>
                    </div>
                    
                    <div className="space-y-2">
                      {results.map((item, index) => {
                        const isSelected = index === selectedIndex;
                        return (
                          <button
                            key={item.id}
                            onClick={() => handleResultClick(item.url)}
                            onMouseEnter={() => setSelectedIndex(index)}
                            className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left group cursor-pointer ${
                              isSelected
                                ? 'border-orange-500/80 bg-orange-50/20 dark:bg-orange-950/20 translate-x-1 shadow-xs'
                                : 'border-border/40 bg-card hover:bg-muted/40 hover:border-border'
                            }`}
                          >
                            <div className="flex items-center space-x-3.5 min-w-0 flex-1">
                              {/* Avatar / Thumbnail / Type Icon */}
                              <div className="h-10 w-10 rounded-lg overflow-hidden bg-muted flex items-center justify-center shrink-0 border border-border/30">
                                {item.imageUrl ? (
                                  <img 
                                    src={item.imageUrl} 
                                    alt={item.title} 
                                    className="h-full w-full object-cover" 
                                    referrerPolicy="no-referrer" 
                                  />
                                ) : item.type === 'service' ? (
                                  <Briefcase className="h-5 w-5 text-orange-600" />
                                ) : item.type === 'team' ? (
                                  <Users className="h-5 w-5 text-purple-600" />
                                ) : item.type === 'portfolio' ? (
                                  <FolderKanban className="h-5 w-5 text-teal-600" />
                                ) : item.type === 'letter' ? (
                                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                                ) : (
                                  <FileText className="h-5 w-5 text-blue-600" />
                                )}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center space-x-2">
                                  <span className={`text-xs font-bold line-clamp-1 transition-colors ${
                                    isSelected ? 'text-orange-600' : 'text-foreground group-hover:text-orange-600'
                                  }`}>
                                    {item.title}
                                  </span>
                                  {item.badge && (
                                    <span className="text-[9px] font-black tracking-wider uppercase px-1.5 py-0.5 rounded bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300 border border-orange-200/50 shrink-0">
                                      {item.badge}
                                    </span>
                                  )}
                                  <span className="text-[9px] font-semibold text-muted-foreground/75 tracking-wider uppercase px-1.5 py-0.5 rounded bg-muted hidden sm:inline-block shrink-0">
                                    {item.category}
                                  </span>
                                </div>
                                <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                                  {item.description}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center shrink-0 pl-3">
                              <CornerDownLeft className={`h-4 w-4 transition-all duration-150 ${
                                isSelected ? 'opacity-100 text-orange-600 translate-x-0' : 'opacity-0 translate-x-2 text-muted-foreground'
                              }`} />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="py-12 text-center space-y-3">
                    <Search className="h-8 w-8 text-muted-foreground/35 mx-auto" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">No direct matches for "{queryStr}"</p>
                      <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1 leading-relaxed">
                        Verify spelling, try terms like "Consulting", "Artiste", "Production", or verify this code directly on our letterhead verification desk.
                      </p>
                    </div>

                    <Button
                      size="sm"
                      onClick={() => handleResultClick(`/verify-letter?ref=${encodeURIComponent(queryStr.trim())}`)}
                      className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs"
                    >
                      <ShieldCheck className="h-3.5 w-3.5 mr-1.5" /> Check "{queryStr.trim()}" in Official Letter Registry
                    </Button>
                  </div>
                )}
              </div>

              {/* Status bar */}
              <div className="bg-muted/40 px-4 py-2 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-orange-600" />
                  Quick find across Services, Team Members, Portfolio &amp; Letter Registry
                </span>
                <span className="hidden sm:inline">Press Esc to exit</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
