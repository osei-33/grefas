import * as React from 'react';
import { useState, useEffect } from 'react';
import { db, storage, handleFirestoreError, OperationType } from '@/firebase';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp, 
  query, 
  orderBy,
  writeBatch
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { 
  Plus, 
  Trash2, 
  Edit, 
  Save, 
  Loader2, 
  Image as ImageIcon, 
  BookOpen, 
  Calendar as CalendarIcon, 
  User, 
  Tag, 
  Clock, 
  X,
  FileText,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

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
  createdAt?: any;
}

const DEFAULT_POSTS = [
  {
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

export default function ManageBlog() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [category, setCategory] = useState('Consulting');
  const [date, setDate] = useState('');
  const [author, setAuthor] = useState('');
  const [readTime, setReadTime] = useState('');
  const [image, setImage] = useState('');
  const [contentRaw, setContentRaw] = useState('');

  // Image Upload State
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    // Sync blog posts list in real-time from firestore.rules
    const q = query(collection(db, 'blogs'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedBlogs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as BlogPost[];
      setPosts(fetchedBlogs);
      setLoading(false);
    }, (error) => {
      console.error("Firestore listening error:", error);
      handleFirestoreError(error, OperationType.LIST, 'blogs');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Autofills date and default empty values when adding
  const startAddFlow = () => {
    setIsAdding(true);
    setEditingPostId(null);
    setTitle('');
    setSummary('');
    setCategory('Consulting');
    setDate(new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }));
    setAuthor('Advisory Panel');
    setReadTime('5 min read');
    setImage('');
    setContentRaw('');
    setUploadProgress(null);
  };

  const startEditFlow = (post: BlogPost) => {
    setEditingPostId(post.id);
    setIsAdding(false);
    setTitle(post.title);
    setSummary(post.summary);
    setCategory(post.category);
    setDate(post.date);
    setAuthor(post.author);
    setReadTime(post.readTime);
    setImage(post.image);
    setContentRaw(post.content.join('\n\n'));
    setUploadProgress(null);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const storageRef = ref(storage, `blogs/${Date.now()}_${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed', 
      (snapshot) => {
        const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        setUploadProgress(progress);
      }, 
      (error) => {
        console.error("Upload error:", error);
        toast.error("Failed to upload image.");
        setIsUploading(false);
        setUploadProgress(null);
      }, 
      () => {
        getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
          setImage(downloadURL);
          toast.success("Image uploaded successfully!");
          setIsUploading(false);
          setUploadProgress(null);
        });
      }
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !summary.trim() || !contentRaw.trim() || !author.trim() || !category.trim()) {
      toast.error("Please fill in all required fields.");
      return;
    }

    // Process paragraphs
    const content = contentRaw
      .split('\n')
      .map(p => p.trim())
      .filter(p => p.length > 0);

    const postData = {
      title,
      summary,
      content,
      category,
      date,
      readTime,
      image: image.trim() || 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&q=80&w=800',
      author,
      createdAt: serverTimestamp()
    };

    try {
      if (editingPostId) {
        // Update existing document
        await updateDoc(doc(db, 'blogs', editingPostId), postData);
        toast.success("Blog post updated successfully!");
        setEditingPostId(null);
      } else {
        // Create new document
        await addDoc(collection(db, 'blogs'), postData);
        toast.success("Blog post published successfully!");
        setIsAdding(false);
      }
      
      // Clear form
      setTitle('');
      setSummary('');
      setImage('');
      setContentRaw('');
    } catch (error) {
      console.error("Error saving blog:", error);
      handleFirestoreError(error, editingPostId ? OperationType.UPDATE : OperationType.CREATE, editingPostId ? `blogs/${editingPostId}` : 'blogs');
    }
  };

  const handleDelete = (id: string) => {
    setDeleteConfirmId(id);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      await deleteDoc(doc(db, 'blogs', deleteConfirmId));
      toast.success("Blog post deleted successfully!");
      if (editingPostId === deleteConfirmId) {
        setEditingPostId(null);
      }
    } catch (error) {
      console.error("Error deleting blog post:", error);
      handleFirestoreError(error, OperationType.DELETE, `blogs/${deleteConfirmId}`);
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const seedSampleDocs = async () => {
    setIsSeeding(true);
    const toastId = toast.loading("Seeding original blog posts...");
    try {
      const batch = writeBatch(db);
      for (const item of DEFAULT_POSTS) {
        const docRef = doc(collection(db, 'blogs'));
        batch.set(docRef, {
          ...item,
          createdAt: serverTimestamp()
        });
      }
      await batch.commit();
      toast.success("Original template and community posts have been synced to the live database!", { id: toastId });
    } catch (error) {
      console.error("Error seeding posts:", error);
      toast.error("Failed to seed template collections.", { id: toastId });
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="space-y-8" id="manage-blogs-section">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
            <BookOpen className="h-8 w-8 text-orange-600" />
            Manage Grefas Blog
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Publish insights, community stories, and event reports under the Grefas blog section.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {posts.length === 0 && !loading && (
            <Button 
              variant="outline" 
              onClick={seedSampleDocs} 
              disabled={isSeeding}
              className="flex-1 sm:flex-none border-orange-500/30 text-orange-600 dark:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950/20"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Seed Templates
            </Button>
          )}
          <Button 
            onClick={startAddFlow} 
            className="flex-1 sm:flex-none bg-orange-600 hover:bg-orange-700 text-white font-bold cursor-pointer"
          >
            <Plus className="mr-2 h-4 w-4" /> Publish Post
          </Button>
        </div>
      </div>

      {/* Editor & Listing Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left Column/Form Area */}
        {(isAdding || editingPostId) ? (
          <Card className="bg-card border-border shadow-md h-fit">
            <CardHeader className="border-b border-border/60 pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-foreground text-lg font-bold flex items-center gap-2">
                  <FileText className="h-5 w-5 text-orange-600" />
                  {editingPostId ? 'Edit Blog Article' : 'Draft New Blog Article'}
                </CardTitle>
                <button 
                  onClick={() => { setIsAdding(false); setEditingPostId(null); }}
                  className="text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-muted"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <CardDescription>
                Compile correct details. Changes reflect instantly on the public website.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleSave} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">Article Title *</label>
                  <Input 
                    placeholder="Enter catching header..." 
                    value={title} 
                    onChange={e => setTitle(e.target.value)} 
                    required 
                    className="bg-muted/50 border-border text-foreground"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground">Category *</label>
                    <select
                      value={category}
                      onChange={e => setCategory(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="Consulting">Consulting</option>
                      <option value="Entertainment">Entertainment</option>
                      <option value="Community">Community</option>
                      <option value="Legal">Legal</option>
                      <option value="Creative">Creative Arts</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground">Author Pen-Name *</label>
                    <Input 
                      placeholder="e.g. Dr. Linda Serwaah" 
                      value={author} 
                      onChange={e => setAuthor(e.target.value)} 
                      required 
                      className="bg-muted/50 border-border text-foreground"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground">Published Date *</label>
                    <Input 
                      placeholder="e.g. June 15, 2026" 
                      value={date} 
                      onChange={e => setDate(e.target.value)} 
                      required 
                      className="bg-muted/50 border-border text-foreground"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground">Estimate Read Duration *</label>
                    <Input 
                      placeholder="e.g. 5 min read" 
                      value={readTime} 
                      onChange={e => setReadTime(e.target.value)} 
                      required 
                      className="bg-muted/50 border-border text-foreground"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">Hero Header Image URL *</label>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="https://images.unsplash.com/your-image" 
                      value={image} 
                      onChange={e => setImage(e.target.value)} 
                      className="bg-muted/50 border-border text-foreground flex-1"
                    />
                    <div className="relative">
                      <input 
                        type="file" 
                        accept="image/*" 
                        id="blog-image-picker" 
                        className="hidden" 
                        onChange={handleImageUpload}
                        disabled={isUploading}
                      />
                      <Button 
                        type="button" 
                        variant="outline"
                        onClick={() => document.getElementById('blog-image-picker')?.click()}
                        disabled={isUploading}
                        className="border-border text-muted-foreground hover:bg-muted font-bold"
                      >
                        {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  {uploadProgress !== null && (
                    <div className="w-full bg-muted rounded-full h-1.5 mt-1 overflow-hidden">
                      <div className="bg-orange-600 h-1.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                    </div>
                  )}
                  {image && (
                    <div className="relative mt-2 rounded-lg overflow-hidden border border-border h-24 bg-muted">
                      <img src={image} alt="Hero preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">Brief Summary Statement *</label>
                  <Textarea 
                    placeholder="Provide a clickworthy teaser summary statement..." 
                    value={summary} 
                    onChange={e => setSummary(e.target.value)} 
                    required 
                    rows={2}
                    className="bg-muted/50 border-border text-foreground leading-relaxed resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-semibold text-foreground">Rich Body Content *</label>
                    <span className="text-[10px] text-muted-foreground bg-muted/60 px-2 py-0.5 rounded">Separate paragraphs with blank lines</span>
                  </div>
                  <Textarea 
                    placeholder="Enter the full text of the blog post here. Hit Enter twice to start a new paragraph." 
                    value={contentRaw} 
                    onChange={e => setContentRaw(e.target.value)} 
                    required 
                    rows={10}
                    className="bg-muted/50 border-border text-foreground leading-relaxed font-sans"
                  />
                </div>

                <Button type="submit" className="w-full bg-orange-600 hover:bg-orange-700 text-white font-black cursor-pointer py-6 text-sm">
                  <Save className="mr-2 h-4 w-4" />
                  {editingPostId ? 'Apply Article Updates' : 'Publish Article Live'}
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-accent/15 border-dashed border-border flex flex-col items-center justify-center p-12 text-center h-fit min-h-[300px]">
            <BookOpen className="h-12 w-12 text-muted-foreground/50 mb-4 stroke-1" />
            <h3 className="font-bold text-foreground text-lg">No Active Session Selected</h3>
            <p className="text-muted-foreground text-sm max-w-sm mt-1 mb-6">
              Either draft a new story or pick an existing article from the registry on the right to edit details.
            </p>
            <Button onClick={startAddFlow} className="bg-orange-600 text-white font-bold cursor-pointer">
              <Plus className="mr-2 h-4 w-4" /> Start Drafting Now
            </Button>
          </Card>
        )}

        {/* Right Column/Listings Registry */}
        <div className="space-y-4">
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="pb-3 border-b border-border/60">
              <CardTitle className="text-foreground text-lg font-bold flex items-center justify-between">
                <span>Article Registry</span>
                <span className="text-xs bg-muted text-muted-foreground px-2.5 py-1 rounded-full font-semibold">
                  {posts.length} {posts.length === 1 ? 'Article' : 'Articles'}
                </span>
              </CardTitle>
              <CardDescription>
                Listed in reverse chronological publication order.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 px-3 sm:px-6">
              {loading ? (
                <div className="flex justify-center items-center py-20">
                  <Loader2 className="h-8 w-8 text-orange-600 animate-spin" />
                </div>
              ) : posts.length === 0 ? (
                <div className="text-center py-16">
                  <BookOpen className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm font-medium">No published articles in the feed.</p>
                  <p className="text-xs text-muted-foreground/80 mt-1 max-w-xs mx-auto">
                    Seed template posts or start manual typing to publish the very first piece of advice.
                  </p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                  {posts.map((post) => (
                    <div 
                      key={post.id} 
                      className={`flex flex-col sm:flex-row gap-4 p-4 rounded-xl border transition-all ${
                        editingPostId === post.id 
                          ? 'border-orange-500 bg-orange-500/5' 
                          : 'border-border/60 bg-muted/10 hover:border-border hover:bg-muted/30'
                      }`}
                    >
                      {/* Image Thumbnail */}
                      <div className="w-full sm:w-24 h-24 rounded-lg bg-muted overflow-hidden flex-shrink-0 border border-border/30">
                        <img 
                          src={post.image} 
                          alt={post.title} 
                          className="w-full h-full object-cover" 
                          referrerPolicy="no-referrer"
                        />
                      </div>

                      {/* Snippet Content */}
                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div>
                          <div className="flex flex-wrap gap-2 items-center text-xs text-muted-foreground mb-1">
                            <span className="font-semibold text-orange-600 dark:text-orange-500 uppercase tracking-widest text-[10px] bg-orange-50 dark:bg-orange-950/20 px-2 py-0.5 rounded">
                              {post.category}
                            </span>
                            <span className="flex items-center gap-1">
                              <CalendarIcon className="h-3 w-3" /> {post.date}
                            </span>
                          </div>
                          <h3 className="font-extrabold text-foreground text-sm line-clamp-1 leading-snug">
                            {post.title}
                          </h3>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                            {post.summary}
                          </p>
                        </div>

                        <div className="flex items-center justify-between border-t border-border/40 mt-3 pt-2">
                          <span className="text-[10px] text-muted-foreground font-medium">By {post.author}</span>
                          <div className="flex items-center gap-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => startEditFlow(post)}
                              className="h-7 px-2 border-border text-foreground hover:bg-muted"
                            >
                              <Edit className="h-3.5 w-3.5 mr-1" /> Edit
                            </Button>
                            <Button 
                              variant="destructive" 
                              size="sm" 
                              onClick={() => handleDelete(post.id)}
                              className="h-7 px-2"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>

      {/* Delete Confirmation Popup */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-card border border-border rounded-xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-base font-bold text-foreground mb-2 flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-500" /> Confirm Immediate Deletion
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed mb-6">
              Are you sure you want to delete this blog post? This action is completely permanent and cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setDeleteConfirmId(null)}
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
