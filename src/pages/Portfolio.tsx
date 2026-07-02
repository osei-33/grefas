import * as React from 'react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '@/firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { Loader2, ExternalLink, Search, Filter, Sparkles, FolderOpen, ArrowUpRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import SEO from '@/components/SEO';
import Breadcrumbs from '@/components/Breadcrumbs';

export default function Portfolio() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    const errorPath = 'portfolio';
    const q = query(collection(db, 'portfolio'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      console.warn("Portfolio fetch error:", error);
      setLoading(false);
      handleFirestoreError(error, OperationType.LIST, errorPath);
    });
    return () => unsubscribe();
  }, []);

  // Compute unique categories dynamically from the loaded portfolio items
  const categories = ['All', ...Array.from(new Set(items.map(item => item.category || 'General')))];

  // Filter items by category and search query
  const filteredItems = items.filter(item => {
    const matchesCategory = activeCategory === 'All' || (item.category || 'General') === activeCategory;
    const matchesSearch = 
      (item.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.category || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-orange-600 mx-auto" />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest font-mono">Loading Showcase...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background min-h-screen py-16 relative overflow-hidden transition-colors duration-300">
      {/* Decorative background blurs */}
      <div className="absolute top-1/4 right-0 w-96 h-96 bg-orange-600/5 dark:bg-orange-600/10 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-1/4 left-0 w-80 h-80 bg-blue-600/5 rounded-full blur-3xl pointer-events-none -z-10" />

      <SEO 
        title="Portfolio"
        description="Browse the historical success work portfolio of Grefas Consult & Entertainment. Take a look at our completed client advisory cases, major regional entertainment events, star productions, and artist programs."
        keywords="Grefas portfolio, event showcase Ghana, commercial consulting projects, entertainment showcase Ashanti"
      />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Breadcrumbs />
        
        {/* Header Section */}
        <div className="text-center space-y-4 mb-16">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-500 text-xs font-bold uppercase tracking-wider border border-orange-500/20"
          >
            <Sparkles className="h-3 w-3 animate-pulse text-orange-600" /> Executive Showcase
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-4xl font-extrabold tracking-tight text-foreground sm:text-6xl uppercase"
          >
            Our Work <span className="text-orange-600 font-black">&</span> Milestones
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="mx-auto max-w-2xl text-base sm:text-lg text-muted-foreground leading-relaxed"
          >
            Explore our curated history of successful business advisories, elite public relations consulting, state-of-the-art stage entertainment events, and custom talent registries.
          </motion.p>
        </div>

        {/* Search and Filters Hub */}
        <div className="space-y-6 mb-12">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-card/40 border border-border/80 p-4 rounded-2xl backdrop-blur-md">
            
            {/* Search Input */}
            <div className="relative w-full md:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search projects, categories, descriptions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11 bg-background/50 border-border/60 text-sm focus-visible:ring-orange-500 rounded-xl w-full"
              />
            </div>

            {/* Total Results Count */}
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest font-mono shrink-0 bg-muted/60 px-3.5 py-1.5 rounded-lg border border-border/50">
              Found: <span className="text-orange-600 dark:text-orange-500 font-black">{filteredItems.length}</span> {filteredItems.length === 1 ? 'project' : 'projects'}
            </div>
          </div>

          {/* Dynamic Category Pill Tabs with custom slide active highlight */}
          <div className="flex flex-wrap gap-2 justify-center">
            {categories.map((category) => {
              const isSelected = activeCategory === category;
              return (
                <button
                  key={category}
                  onClick={() => setActiveCategory(category)}
                  className={`relative px-4 py-2 text-xs font-bold tracking-wide uppercase rounded-xl transition-all duration-300 focus:outline-none cursor-pointer ${
                    isSelected
                      ? 'text-white'
                      : 'text-muted-foreground hover:text-foreground bg-muted/30 hover:bg-muted/60 border border-border/40'
                  }`}
                >
                  {/* Slider background pill animation using layoutId */}
                  {isSelected && (
                    <motion.div
                      layoutId="activeCategoryPill"
                      className="absolute inset-0 bg-orange-600 rounded-xl"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      style={{ zIndex: -1 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1.5">
                    {category === 'All' ? <FolderOpen className="h-3.5 w-3.5" /> : null}
                    {category}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Portfolio Dynamic Bento Grid with Framer Motion AnimatePresence */}
        <motion.div 
          layout
          className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3"
        >
          <AnimatePresence mode="popLayout">
            {filteredItems.map((item, i) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.4 }}
              >
                <Card className="group overflow-hidden border border-border/70 bg-card/60 shadow-md hover:shadow-xl hover:border-orange-500/30 transition-all duration-500 rounded-2xl flex flex-col h-full relative backdrop-blur-xs">
                  
                  {/* Media Cover wrapper */}
                  <div className="relative aspect-video overflow-hidden bg-muted">
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                      referrerPolicy="no-referrer"
                      loading="lazy"
                    />
                    
                    {/* Dark gradient mask on hover */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                    {/* Branding Watermark */}
                    <div className="pointer-events-none absolute bottom-3 left-3 z-10 select-none opacity-25">
                      <p className="text-[7px] font-black tracking-widest text-white drop-shadow-md">
                        GREFAS OFFICIAL PORTFOLIO
                      </p>
                    </div>

                    {/* Floating pill badge */}
                    <div className="absolute top-3 right-3 rounded-xl bg-background/90 text-foreground dark:bg-zinc-950/90 text-xs font-extrabold px-3 py-1 backdrop-blur-md border border-border/40 uppercase tracking-wider">
                      {item.category || 'General'}
                    </div>

                    {/* Direct link visual feedback icon */}
                    <div className="absolute top-3 left-3 w-8 h-8 rounded-xl bg-orange-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all duration-300 shadow-md">
                      <ArrowUpRight className="h-4 w-4" />
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="flex-1 flex flex-col p-6">
                    <CardHeader className="p-0 mb-3">
                      <CardTitle className="text-xl font-bold tracking-tight text-foreground transition-colors group-hover:text-orange-600">
                        {item.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 flex-1">
                      <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                        {item.description}
                      </p>
                    </CardContent>
                  </div>

                  {/* Top-line indicator on hover */}
                  <div className="absolute top-0 left-0 right-0 h-1 bg-orange-600 scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Empty Search / Filter Fallback state */}
          {filteredItems.length === 0 && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="col-span-full py-24 text-center rounded-2xl bg-muted/15 border border-dashed border-border p-8"
            >
              <div className="w-16 h-16 rounded-2xl bg-orange-500/5 text-orange-600 border border-orange-500/15 flex items-center justify-center mx-auto mb-4">
                <Filter className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-bold text-foreground">No matching showcase items</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto mt-2">
                We couldn't find any portfolio projects matching "<span className="font-semibold text-foreground">{searchQuery}</span>" in the <span className="font-semibold text-foreground">{activeCategory}</span> category. Try clearing the search or exploring other tabs!
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setActiveCategory('All');
                }}
                className="mt-6 border-orange-500/30 text-orange-600 hover:bg-orange-600/5 rounded-xl text-xs font-bold"
              >
                Reset Filter & Search
              </Button>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

