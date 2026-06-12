import * as React from 'react';
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '@/firebase';
import { collection, onSnapshot, addDoc, serverTimestamp, doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2, Briefcase, Award, Star, Mail, ArrowRight, Filter, Sparkles, Check, CheckCircle, Flame, Calendar, MessageSquare, Send, ArrowLeft, MessageCircle } from 'lucide-react';

interface TeamMember {
  id: string;
  name: string;
  role: string;
  experience: string;
  bio: string;
  imageUrl: string;
  email?: string;
  skills: string[];
  rating?: number;
  category?: 'consulting' | 'entertainment' | 'both';
  available?: boolean;
  projectHighlights?: string[];
}

const DEFAULT_MEMBERS = [
  {
    name: "Dr. Linda Serwaah",
    role: "Principal Consultant & Executive Director",
    experience: "12+ Years in Corporate Consulting",
    bio: "Dr. Linda lead-directs Grefas Consult. Her background in development planning and executive corporate coaching ensures every client engagement reaches impeccable results. She combines traditional strategic management with forward-acting leadership programs.",
    imageUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=500&h=500",
    email: "serwaahlinda1995@gmail.com",
    skills: ["Corporate Strategy", "Brand Audits", "Executive Advising", "Venture Incubation"],
    rating: 4.9,
    category: "consulting",
    available: true,
    projectHighlights: [
      "Restructured operations for a regional logistics giant, boosting margin throughput by 24% in under 12 months.",
      "Orchestrated executive transition leadership coaching for 45+ African high-tech startup founders.",
      "Structured the seed stage venture design strategy for an agritech hub leading to a $2.5M Series A raising."
    ]
  },
  {
    name: "Kofi Mensah",
    role: "Head of Entertainment Production",
    experience: "9+ Years in Live Events",
    bio: "Kofi is the visionary orchestrator of our entertainment team. Having overseen premium live shows, custom corporate events, and bespoke performance layouts across West Africa, he knows how to transform general audio-visual ideas into unforgettable realities.",
    imageUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=500&h=500",
    email: "kofi.production@grefas.com",
    skills: ["Creative Directing", "Sound Design", "Artist Bookings", "Master of Ceremonies"],
    rating: 4.8,
    category: "entertainment",
    available: true,
    projectHighlights: [
      "Chief producer for West African Premium Music Alliance, handling audio layouts and live MC operations for a 15,000 attendee event.",
      "Directed the grand brand merger celebration for Unity Trust Bank, bringing a seamless multimedia performance setup.",
      "Created custom theatrical and sound installations for the Golden Jubilee Sovereign Gala."
    ]
  },
  {
    name: "Amara Diop",
    role: "Senior Business Specialist",
    experience: "7+ Years in Strategy & Markets",
    bio: "Amara coordinates market audits, startup scaling paths, and financial strategies. She helps small and medium-scale companies define operational benchmarks to execute flawless growth models with high-efficiency capital management.",
    imageUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=500&h=500",
    email: "amara.specialist@grefas.com",
    skills: ["Market Entry", "Operations Audit", "Financial Engineering", "SME Structure"],
    rating: 4.9,
    category: "consulting",
    available: true,
    projectHighlights: [
      "Conducted full-scope financial modeling & strategic health checks for 30+ regional SME clients.",
      "Co-authored national retail sector acceleration blueprints in partnership with the local Chamber of Commerce.",
      "Supervised market research and consumer behavior analysis supporting an international FMCG expansion."
    ]
  }
];

export default function Team() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'consulting' | 'entertainment'>('all');
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [activeModalMember, setActiveModalMember] = useState<TeamMember | null>(null);
  const navigate = useNavigate();

  const [settings, setSettings] = useState<any>(null);
  const [isMessaging, setIsMessaging] = useState(false);
  const [messageForm, setMessageForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    subject: '',
    message: ''
  });

  useEffect(() => {
    const errorPath = 'settings/global';
    const unsubscribe = onSnapshot(doc(db, 'settings', 'global'), (doc) => {
      if (doc.exists()) {
        setSettings(doc.data());
      }
    }, (error) => {
      console.debug("Team page settings fetch issue:", error);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (activeModalMember) {
      setMessageForm({
        firstName: '',
        lastName: '',
        email: '',
        subject: `Inquiry for ${activeModalMember.name}`,
        message: `Dear ${activeModalMember.name},\n\nI am reaching out regarding your consulting and entertainment service packages. Let's align on a professional collaboration schedule.\n\nBest regards,`
      });
      setIsMessaging(false);
    }
  }, [activeModalMember]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'messages'), {
        senderName: `${messageForm.firstName} ${messageForm.lastName}`,
        senderEmail: messageForm.email,
        subject: messageForm.subject,
        message: messageForm.message,
        recipientId: activeModalMember?.id || '',
        recipientName: activeModalMember?.name || '',
        recipientEmail: activeModalMember?.email || '',
        createdAt: serverTimestamp()
      });

      if (activeModalMember?.email) {
        try {
          const response = await fetch('/api/send-direct-message', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              recipientEmail: activeModalMember.email,
              recipientName: activeModalMember.name,
              senderName: `${messageForm.firstName} ${messageForm.lastName}`,
              senderEmail: messageForm.email,
              subject: messageForm.subject,
              message: messageForm.message
            }),
          });
          const resJson = await response.json();
          if (resJson.results?.email === 'sent') {
            toast.success(`Inquiry sent directly to ${activeModalMember.name}'s professional inbox!`);
          } else {
            toast.success(`Message recorded and queued for ${activeModalMember.name}.`);
          }
        } catch (fetchErr) {
          console.warn("Direct mail routing failed:", fetchErr);
          toast.success(`Message recorded for ${activeModalMember.name}.`);
        }
      } else {
        toast.success(`Message sent successfully to ${activeModalMember?.name || 'the specialist'}!`);
      }

      setIsMessaging(false);
    } catch (err) {
      console.error("Error sending message:", err);
      toast.error("Failed to send message. Please try again.");
    }
  };

  useEffect(() => {
    const path = 'team_members';
    const unsubscribe = onSnapshot(collection(db, 'team_members'), async (snapshot) => {
      if (snapshot.empty) {
        // Automatically seed team members
        try {
          for (const m of DEFAULT_MEMBERS) {
            await addDoc(collection(db, 'team_members'), {
              ...m,
              createdAt: serverTimestamp()
            });
          }
        } catch (error) {
          try {
            handleFirestoreError(error, OperationType.CREATE, 'team_members/seed');
          } catch (e) {
            console.error("Auto seeding failed:", error);
          }
        }
      } else {
        const teamList: TeamMember[] = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name || '',
            role: data.role || '',
            experience: data.experience || '',
            bio: data.bio || '',
            imageUrl: data.imageUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200&h=200',
            email: data.email || '',
            skills: Array.isArray(data.skills) ? data.skills : [],
            rating: typeof data.rating === 'number' ? data.rating : 5.0,
            category: data.category || 'both',
            available: data.available !== false,
            projectHighlights: Array.isArray(data.projectHighlights) ? data.projectHighlights : []
          };
        });
        setMembers(teamList);
        setLoading(false);
      }
    }, (error) => {
      setLoading(false);
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (e) {
        console.error("Error loading team members:", error);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleSelectSpecialist = (member: TeamMember) => {
    navigate(`/booking?staffId=${member.id}&staffName=${encodeURIComponent(member.name)}`);
  };

  const filteredMembers = members.filter(m => {
    if (filter === 'all') return true;
    return m.category === filter || m.category === 'both';
  });

  // Collect all unique skills for quick filtering
  const allSkillsSet = new Set<string>();
  members.forEach(m => m.skills.forEach(s => allSkillsSet.add(s)));
  const listSkills = Array.from(allSkillsSet).slice(0, 10);

  const toggleSkillFilter = (skill: string) => {
    setSelectedSkills(prev =>
      prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]
    );
  };

  const finalMembers = filteredMembers.filter(m => {
    if (selectedSkills.length === 0) return true;
    return selectedSkills.every(s => m.skills.includes(s));
  });

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
      </div>
    );
  }

  return (
    <div className="bg-background py-20 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        
        {/* Header Block */}
        <div className="text-center mb-16 max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300 mb-4"
          >
            <Sparkles className="h-3 w-3" /> Dedicated Professional Team
          </motion.div>
          
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl"
          >
            Choose Your <span className="text-orange-600">Specialist</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-4 text-lg text-muted-foreground"
          >
            Select any of our expert consultants or production directors to guide your business strategy or execute your entertainment goals.
          </motion.p>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between border border-border/40 p-5 rounded-2xl bg-card/60 backdrop-blur-sm shadow-sm mb-12">
          
          {/* Main Category Tabs */}
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'all', label: 'All Specialists' },
              { id: 'consulting', label: 'Business Consulting' },
              { id: 'entertainment', label: 'Entertainment Producers' }
            ].map((tab) => (
              <Button
                key={tab.id}
                variant={filter === tab.id ? 'default' : 'outline'}
                onClick={() => setFilter(tab.id as any)}
                className={`text-xs h-9 px-4 rounded-xl transition-all ${
                  filter === tab.id 
                    ? 'bg-orange-600 hover:bg-orange-700 text-white shadow-md' 
                    : 'border-border text-muted-foreground hover:bg-muted'
                }`}
              >
                {tab.id === 'consulting' && <Briefcase className="h-3.5 w-3.5 mr-1" />}
                {tab.id === 'entertainment' && <Award className="h-3.5 w-3.5 mr-1" />}
                {tab.label}
              </Button>
            ))}
          </div>

          {/* Inline Skill Badges */}
          {listSkills.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 max-w-xl">
              <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                <Filter className="h-3 w-3 text-orange-500" /> Filter skill:
              </span>
              {listSkills.map((skill) => {
                const isSelected = selectedSkills.includes(skill);
                return (
                  <button
                    key={skill}
                    onClick={() => toggleSkillFilter(skill)}
                    className={`text-[10px] px-2.5 py-1 rounded-full font-bold transition-all flex items-center gap-1 ${
                      isSelected 
                        ? 'bg-orange-600 text-white shadow-sm' 
                        : 'bg-muted border border-border/80 text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {isSelected && <Check className="h-2.5 w-2.5" />}
                    {skill}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Team Grid */}
        {finalMembers.length > 0 ? (
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {finalMembers.map((member, index) => (
              <motion.div
                key={member.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
              >
                <Card 
                  onClick={() => setActiveModalMember(member)}
                  className="flex flex-col h-full overflow-hidden border border-border bg-card shadow-lg hover:shadow-xl hover:border-orange-600/30 transition-all duration-300 group cursor-pointer relative"
                >
                  
                  {/* Image and Header */}
                  <div className="relative aspect-square w-full bg-muted overflow-hidden">
                    <img
                      src={member.imageUrl}
                      alt={member.name}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    
                    {/* Availability Status Badge */}
                    <div className={`absolute top-4 left-4 backdrop-blur-md px-2.5 py-1 rounded-full flex items-center gap-1.5 text-[10px] font-bold border shadow-sm ${
                      member.available !== false
                        ? 'bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/20'
                        : 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20'
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${member.available !== false ? 'bg-green-500 animate-pulse' : 'bg-zinc-400'}`} />
                      {member.available !== false ? 'Accepting Bookings' : 'Fully Booked'}
                    </div>

                    <div className="absolute top-4 right-4 bg-background/90 backdrop-blur-md px-2.5 py-1 rounded-full flex items-center gap-1 text-xs font-bold text-foreground border border-border shadow-sm">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      {member.rating?.toFixed(1) || "5.0"}
                    </div>
                    {/* Category Overlay */}
                    <div className="absolute bottom-4 left-4 bg-orange-600/90 text-white backdrop-blur-md px-3 py-1 rounded-lg text-[10px] font-black tracking-widest uppercase shadow">
                      {member.category === 'consulting' ? 'Consultancy' : member.category === 'entertainment' ? 'Entertainment' : 'Consult & Event'}
                    </div>
                  </div>

                  {/* Body Content */}
                  <CardHeader className="pt-6 pb-2">
                    <CardTitle className="text-xl font-bold group-hover:text-orange-600 transition-colors text-foreground flex items-center justify-between">
                      <span>{member.name}</span>
                    </CardTitle>
                    <CardDescription className="text-sm text-orange-600 font-semibold flex items-center gap-1.5 mt-1">
                      <Briefcase className="h-3.5 w-3.5" /> {member.role}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="flex-1 flex flex-col pt-2 bg-card">
                    
                    {/* Experience Info */}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3 font-semibold">
                      <Award className="h-3.5 w-3.5 text-orange-500" />
                      {member.experience}
                    </div>

                    {/* Biography */}
                    <p className="text-sm text-muted-foreground/90 line-clamp-3 leading-relaxed italic mb-4">
                      "{member.bio}"
                    </p>

                    <p className="text-[11px] text-orange-500 font-bold mb-4 hover:underline mt-auto flex items-center gap-0.5">
                      Click card for portfolio project highlights & detailed bio
                    </p>

                    {/* Skill Badges */}
                    <div className="pt-4 border-t border-border/40">
                      <div className="flex flex-wrap gap-1.5 mb-5">
                        {member.skills.slice(0, 3).map((skill, si) => (
                          <span
                            key={si}
                            className="text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground font-semibold"
                          >
                            {skill}
                          </span>
                        ))}
                        {member.skills.length > 3 && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground font-semibold">
                            +{member.skills.length - 3} more
                          </span>
                        )}
                      </div>

                      {/* Select CTA Button */}
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectSpecialist(member);
                        }}
                        className="w-full h-10 bg-orange-600 hover:bg-orange-700 text-white group-hover:shadow-md transition-all flex items-center justify-center gap-1.5 rounded-xl font-semibold text-xs"
                      >
                        Choose Specialist
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </Button>
                    </div>

                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 border border-dashed border-border rounded-3xl bg-card">
            <p className="text-lg text-muted-foreground">No specialists found matching current filters.</p>
            <Button
              className="mt-4 bg-orange-600 hover:bg-orange-700 text-white"
              onClick={() => {
                setFilter('all');
                setSelectedSkills([]);
              }}
            >
              Reset Filters
            </Button>
          </div>
        )}
      </div>

      {/* Detailed Modal Dialog */}
      <Dialog open={!!activeModalMember} onOpenChange={(open) => !open && setActiveModalMember(null)}>
        <DialogContent className="max-w-2xl bg-card border border-border p-0 overflow-hidden rounded-2xl shadow-2xl">
          {activeModalMember && (
            <div className="flex flex-col max-h-[90vh]">
              <DialogTitle className="sr-only">Specialist Profile - {activeModalMember.name}</DialogTitle>
              <DialogDescription className="sr-only">
                Detailed profile, professional bio, key skills, and rating of {activeModalMember.name}
              </DialogDescription>
              {/* Header Image Area */}
              {!isMessaging && (
                <div className="relative h-48 sm:h-56 bg-muted overflow-hidden flex-shrink-0">
                  <img
                    src={activeModalMember.imageUrl}
                    alt={activeModalMember.name}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent flex flex-col justify-end p-6">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-black tracking-widest uppercase text-orange-400 bg-orange-950/60 backdrop-blur px-2.5 py-0.5 rounded">
                          {activeModalMember.category === 'consulting' ? 'Consultancy Specialist' : activeModalMember.category === 'entertainment' ? 'Show Producer' : 'Consult & Production'}
                        </span>
                        <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-1.5">{activeModalMember.name}</h2>
                        <p className="text-sm font-bold text-zinc-200 mt-1 flex items-center gap-1.5">
                          <Briefcase className="h-4 w-4 text-orange-400" /> {activeModalMember.role}
                        </p>
                      </div>

                      <div className="bg-orange-600 text-white px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 shadow-md">
                        <Star className="h-3.5 w-3.5 fill-current" />
                        {activeModalMember.rating?.toFixed(1) || "5.0"} Rating
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {isMessaging ? (
                <motion.form 
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  onSubmit={handleSendMessage}
                  className="p-6 space-y-4 overflow-y-auto flex-1 text-foreground"
                >
                  <div className="flex items-center gap-3 pb-3 border-b border-border/60">
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="icon" 
                      onClick={() => setIsMessaging(false)} 
                      className="h-9 w-9 rounded-xl border-border hover:bg-muted"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                      <h3 className="font-extrabold text-lg flex items-center gap-2">
                        Message <span className="text-orange-600 font-black">{activeModalMember.name}</span>
                      </h3>
                      <p className="text-xs text-muted-foreground font-medium">Send a direct advisory query or performance booking inquiry.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">First Name *</label>
                      <Input 
                        required 
                        value={messageForm.firstName} 
                        onChange={(e) => setMessageForm({...messageForm, firstName: e.target.value})}
                        placeholder="Your first name" 
                        className="bg-muted/50 border-input h-10"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Last Name *</label>
                      <Input 
                        required 
                        value={messageForm.lastName} 
                        onChange={(e) => setMessageForm({...messageForm, lastName: e.target.value})}
                        placeholder="Your last name" 
                        className="bg-muted/50 border-input h-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Your Email Address *</label>
                    <Input 
                      type="email" 
                      required 
                      value={messageForm.email} 
                      onChange={(e) => setMessageForm({...messageForm, email: e.target.value})}
                      placeholder="you@company.com" 
                      className="bg-muted/50 border-input h-10"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Subject</label>
                    <Input 
                      required 
                      value={messageForm.subject} 
                      onChange={(e) => setMessageForm({...messageForm, subject: e.target.value})}
                      placeholder="Subject of inquiry" 
                      className="bg-muted/50 border-input h-10"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Message Details *</label>
                    <Textarea 
                      required 
                      value={messageForm.message} 
                      onChange={(e) => setMessageForm({...messageForm, message: e.target.value})}
                      placeholder="Provide particulars for your campaign or strategic consulting requests..." 
                      className="min-h-[120px] bg-muted/50 border-input leading-relaxed text-sm py-2.5"
                    />
                  </div>

                  <div className="pt-2 flex justify-end gap-2.5">
                    <Button type="button" variant="ghost" onClick={() => setIsMessaging(false)} className="rounded-xl font-bold h-10 px-4">
                      Back to Profile
                    </Button>
                    <Button type="submit" className="bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl h-10 px-5 flex items-center gap-1.5 shadow-md">
                      <Send className="h-4 w-4" /> Send Message
                    </Button>
                  </div>
                </motion.form>
              ) : (
                <>
                  {/* Scrollable Content */}
                  <div className="p-6 space-y-6 overflow-y-auto flex-1">
                    {/* Availability and Experience indicators */}
                    <div className="flex flex-wrap gap-3 items-center">
                      <div className={`px-3 py-1.5 rounded-xl flex items-center gap-2 text-xs font-bold border shadow-xs ${
                        activeModalMember.available !== false
                          ? 'bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/20'
                          : 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20'
                      }`}>
                        <span className={`h-2 w-2 rounded-full ${activeModalMember.available !== false ? 'bg-green-500 animate-pulse' : 'bg-zinc-400'}`} />
                        {activeModalMember.available !== false ? 'Currently Accepting Bookings' : 'Full / Temporarily Booked'}
                      </div>

                      <div className="px-3 py-1.5 rounded-xl bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300 border border-orange-200/50 dark:border-orange-850/40 font-bold text-xs flex items-center gap-1.5">
                        <Award className="h-4 w-4 text-orange-500" />
                        {activeModalMember.experience}
                      </div>
                    </div>

                    {/* Extended Biography */}
                    <div className="space-y-2">
                      <h3 className="text-sm font-extrabold tracking-wider text-muted-foreground uppercase">Detailed Professional Biography</h3>
                      <p className="text-base text-foreground leading-relaxed italic bg-muted/30 p-4 rounded-xl border border-border/40">
                        "{activeModalMember.bio}"
                      </p>
                    </div>

                    {/* Past Project Highlights */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Flame className="h-5 w-5 text-orange-500" />
                        <h3 className="text-sm font-extrabold tracking-wider text-muted-foreground uppercase">Past Project & Strategic Highlights</h3>
                      </div>
                      
                      {activeModalMember.projectHighlights && activeModalMember.projectHighlights.length > 0 ? (
                        <div className="grid grid-cols-1 gap-3">
                          {activeModalMember.projectHighlights.map((highlight, hi) => (
                            <div key={hi} className="flex gap-3 bg-card border border-border hover:border-orange-500/20 p-3.5 rounded-xl items-start transition-colors duration-200">
                              <CheckCircle className="h-5 w-5 text-green-500 dark:text-green-400 mt-0.5 flex-shrink-0" />
                              <p className="text-sm text-muted-foreground leading-relaxed font-medium">
                                {highlight}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="bg-muted/40 p-4 text-center rounded-xl text-xs text-muted-foreground italic border border-dashed border-border">
                          Custom milestones on corporate alignments, tailored brand growth, and special performance execution schedules are formulated on individual project scopes.
                        </div>
                      )}
                    </div>

                    {/* Expertise tags */}
                    <div className="space-y-2">
                      <h3 className="text-xs font-bold tracking-wider text-muted-foreground uppercase">Core Areas of Practice</h3>
                      <div className="flex flex-wrap gap-2">
                        {activeModalMember.skills.map((skill, si) => (
                          <span key={si} className="text-xs font-bold px-3 py-1 rounded-full bg-muted border border-border text-foreground">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Action Footer */}
                  <div className="p-4 border-t border-border bg-muted/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 flex-shrink-0">
                    <span className="text-xs text-muted-foreground">
                      Ready to secure this specialist for your goals?
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => setActiveModalMember(null)} className="rounded-xl font-bold h-9">
                        Close Profile
                      </Button>

                      {/* Message Option Button */}
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setIsMessaging(true)} 
                        className="rounded-xl font-bold h-9 flex items-center gap-1.5 border-orange-200 dark:border-orange-950 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/20"
                      >
                        <MessageSquare className="h-3.5 w-3.5" /> Message
                      </Button>

                      {/* WhatsApp Direct Chat Button */}
                      <a
                        href={`https://wa.me/${(settings?.phone || '+233123456789').replace(/\D/g, '')}?text=${encodeURIComponent(`Hello! I'm interested in booking ${activeModalMember.name} (${activeModalMember.role}) through Grefas Consult & Entertainment.`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-[#25D366] hover:bg-[#1ebd55] text-white px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm h-9 transition-colors border border-[#128C7E]/20"
                      >
                        <MessageCircle className="h-3.5 w-3.5 fill-current text-white" /> WhatsApp
                      </a>

                      <Button
                        onClick={() => {
                          setActiveModalMember(null);
                          handleSelectSpecialist(activeModalMember);
                        }}
                        className="bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl h-9 text-xs flex items-center gap-1.5"
                      >
                        Book Specialist Now
                        <Calendar className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
