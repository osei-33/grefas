import * as React from 'react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, Clock, BookOpen, X, ArrowRight, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BlogPost {
  id: string;
  title: string;
  summary: string;
  content: string[];
  category: string;
  date: string;
  readTime: string;
  image: string;
  author: string;
}

const BLOG_POSTS: BlogPost[] = [
  {
    id: 'empowering-youth',
    category: 'Community',
    title: 'Empowering Nyinahin-Ashanti\'s Youth Through Creative Arts & Media',
    summary: 'How Grefas is fostering the next generation of creative production and digital talents in the Ashanti Region.',
    author: 'Dr. Linda Serwaah',
    date: 'June 12, 2026',
    readTime: '5 min read',
    image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&q=80&w=800',
    content: [
      'Grefas Consult & Entertainment has always believed that potential is evenly distributed, but opportunity is not. Woven deeply into our foundations in the historic district of Nyinahin-Ashanti is a commitment to nurturing young creative talents and transforming artistic passion into sustainable live careers.',
      'Our ongoing workshop projects bring together seasoned entertainment directors, audio engineers, and strategic business mentors. Participants receive direct hands-on instruction in sound reinforcement, digital photography, event flow scheduling, and basic business finances.',
      'By offering real-world staging experience at our live events and local consult tasks, we help participants build robust portfolios. Many of our program alumni are now managing creative media channels or freelancing as independent production specialists across the Ashanti Region.',
      'Our vision remains clear: to build a creative oasis in Nyinahin that serves as a launchpad for world-shaping West African stories, entertainment, and corporate excellence.'
    ]
  },
  {
    id: 'event-planning-checklist',
    category: 'Entertainment',
    title: 'The Ultimate Event Planning Checklist: Corporate Galas to Cultural Festivals',
    summary: 'Discover the essential planning pillars Grefas uses to coordinate seamless live music events, booking projects, and high-stakes corporate gatherings.',
    author: 'Grefas Production Team',
    date: 'May 28, 2026',
    readTime: '6 min read',
    image: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&q=80&w=800',
    content: [
      'Hosting an event in Ghana requires balancing meticulous logistics, local administrative relations, and audience safety. Whether you are assembling premium corporate banquets or hosting energetic local festivals, flawless execution starts months of work beforehand.',
      'First, prioritize local stakeholder alignment. In Nyinahin and adjacent communities, keeping municipal planners, safety personnel, and traditional authorities fully briefed ensures cultural respect and clean administrative compliance.',
      'Second, never overlook power redundancy. Electrical load planning is crucial for sound, lighting, and ventilation systems. Grefas maintains state-of-the-art power backup generators to avoid unexpected grid interruptions during peak performance moments.',
      'Finally, customer and artist hospitality sets top events apart. Providing dedicated transport corridors, comfortable greenrooms, and rapid-response safety marshals turns standard entertainment programs into memorable, world-class experiences.'
    ]
  },
  {
    id: 'brand-positioning',
    category: 'Consulting',
    title: 'Strategic Brand Positioning: Navigating Business Growth in Modern Ghana',
    summary: 'Expert advice from our senior consultants on establishing strong operational frameworks and market relevance in West Africa.',
    author: 'Advisory Panel',
    date: 'May 15, 2026',
    readTime: '4 min read',
    image: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&q=80&w=800',
    content: [
      'Small and medium enterprises (SMEs) face dynamic changes in today’s West African market. High competition highlights the absolute necessity of clear strategic focus and distinct brand positioning.',
      'Many brands fail not because their products are poor, but because their core systems and market stories are fragmented. A powerful operational framework must align real-world services with digital customer discovery pipelines.',
      'Our consulting team recommends beginning with high-resolution consumer feedback. Deeply analyze how your niche perceives value, and build operational checklists that enable your team to deliver that exact value consistently.',
      'Investing in structural compliance, strategic alliances, and targeted marketing campaigns creates a durable moat, transforming localized businesses into regional category leaders.'
    ]
  }
];

export default function BlogSection() {
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);

  return (
    <section className="bg-muted/10 py-24 border-t border-border/40 relative">
      <div className="absolute inset-0 z-0 opacity-[0.015] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
      
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-16">
          <div>
            <span className="text-sm font-semibold uppercase tracking-widest text-orange-600 dark:text-orange-500 bg-orange-50 dark:bg-orange-950/30 px-3 py-1 rounded">
              Insights & Stories
            </span>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Latest from the Grefas Blog
            </h2>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Stay updated with professional consulting frameworks, cultural entertainment reports, and community stories right from Nyinahin-Ashanti.
            </p>
          </div>
          <div className="mt-6 md:mt-0">
            <span className="text-sm text-muted-foreground font-medium flex items-center gap-1.5">
              <BookOpen className="h-4 w-4 text-orange-600" />
              Empowering local businesses & creators
            </span>
          </div>
        </div>

        {/* Blog Grid */}
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {BLOG_POSTS.map((post, idx) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className="flex flex-col overflow-hidden rounded-2xl bg-card border border-border/60 shadow-sm hover:shadow-md transition-all duration-300 group"
            >
              <div className="relative h-48 overflow-hidden bg-muted">
                <img
                  src={post.image}
                  alt={post.title}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  referrerPolicy="no-referrer"
                  loading="lazy"
                />
                <div className="absolute top-4 left-4">
                  <span className="inline-block rounded-full bg-black/70 backdrop-blur-sm px-3 py-1 text-xs font-semibold text-orange-500 uppercase tracking-widest">
                    {post.category}
                  </span>
                </div>
              </div>
              <div className="flex flex-1 flex-col p-6">
                <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {post.date}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {post.readTime}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-foreground leading-snug group-hover:text-orange-600 transition-colors duration-200">
                  {post.title}
                </h3>
                <p className="mt-3 text-muted-foreground text-sm line-clamp-3 leading-relaxed">
                  {post.summary}
                </p>
                <div className="mt-auto pt-6 flex items-center justify-between border-t border-border/50">
                  <span className="text-xs font-semibold text-foreground/80">By {post.author}</span>
                  <button
                    onClick={() => setSelectedPost(post)}
                    className="inline-flex items-center text-sm font-bold text-orange-600 dark:text-orange-500 group-hover:translate-x-1 transition-transform cursor-pointer"
                  >
                    Read Story
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Modal Article Reader */}
      <AnimatePresence>
        {selectedPost && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="relative w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-3xl bg-background border border-border shadow-2xl"
            >
              {/* Header Image */}
              <div className="relative h-64 sm:h-80 w-full overflow-hidden bg-muted">
                <img
                  src={selectedPost.image}
                  alt={selectedPost.title}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />
                <button
                  onClick={() => setSelectedPost(null)}
                  className="absolute top-4 right-4 rounded-full bg-black/60 hover:bg-black text-white p-2.5 transition-all outline-none"
                  aria-label="Close article"
                >
                  <X className="h-5 w-5" />
                </button>
                <div className="absolute bottom-6 left-6 right-6 text-white">
                  <span className="inline-block rounded-full bg-orange-600 px-3 py-1 text-xs font-bold uppercase tracking-widest text-white mb-3">
                    {selectedPost.category}
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">
                    {selectedPost.title}
                  </h2>
                </div>
              </div>

              {/* Author & Info bar */}
              <div className="px-6 sm:px-8 py-5 border-b border-border/60 bg-muted/30 flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-orange-600/10 text-orange-600 flex items-center justify-center font-bold text-sm">
                    {selectedPost.author.charAt(0)}
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">{selectedPost.author}</span>
                    <span className="mx-2">•</span>
                    <span>{selectedPost.date}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 font-medium bg-background px-3 py-1 rounded-md border border-border/40">
                  <Clock className="h-4 w-4 text-orange-500" />
                  <span>{selectedPost.readTime}</span>
                </div>
              </div>

              {/* Core Content */}
              <div className="px-6 sm:px-8 py-8 space-y-6 text-base sm:text-lg leading-relaxed text-muted-foreground max-w-none">
                {selectedPost.content.map((paragraph, pi) => (
                  <p key={pi} className="first-of-type:text-foreground first-of-type:font-medium">
                    {paragraph}
                  </p>
                ))}
              </div>

              {/* Footer Panel */}
              <div className="px-6 sm:px-8 py-6 border-t border-border/60 bg-muted/10 flex justify-between items-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedPost(null)}
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Blog
                </Button>
                <span className="text-xs font-bold text-zinc-400 tracking-wider uppercase">Grefas Consult &copy; 2026</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
