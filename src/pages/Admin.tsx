import * as React from 'react';
import { useState, useEffect } from 'react';
import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LayoutDashboard, Image as ImageIcon, Briefcase, LogOut, Plus, Trash2, Loader2, FolderOpen, Settings as SettingsIcon, Save, Info, Phone, Mail, MapPin, Quote, Calendar as CalendarIcon, Users, Youtube, Facebook, Music2, AlertCircle, Bell } from 'lucide-react';
import { toast } from 'sonner';
import { auth, db } from '@/firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  orderBy,
  serverTimestamp,
  getDocs,
  getDoc,
  setDoc
} from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '@/lib/firebaseUtils';

export default function Admin() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        // Fetch role from Firestore
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            setRole(userDoc.data().role);
          } else if (user.email === "serwaahlinda1995@gmail.com") {
            setRole('admin');
          } else {
            setRole('guest');
          }
        } catch (error) {
          console.error("Error fetching role:", error);
          if (user.email === "serwaahlinda1995@gmail.com") {
            setRole('admin');
          } else {
            setRole('guest');
          }
        }
      } else {
        setRole(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success('Logged out successfully');
      navigate('/');
    } catch (error) {
      toast.error('Logout failed');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  if (role === 'guest') {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-4 text-center px-4">
        <AlertCircle className="h-12 w-12 text-red-500" />
        <h2 className="text-2xl font-bold">Access Denied</h2>
        <p className="text-zinc-500 max-w-md">You do not have permission to access the admin panel. Please contact the administrator if you believe this is an error.</p>
        <div className="flex gap-4">
          <Button variant="outline" onClick={handleLogout}>Logout</Button>
          <Button className="bg-orange-600 hover:bg-orange-700" onClick={() => navigate('/')}>Return Home</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[80vh] bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card p-6 hidden md:block">
        <div className="flex flex-col h-full">
          <div className="space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Admin Panel</h2>
            <nav className="space-y-1">
              <Link
                to="/admin"
                className="flex items-center space-x-2 rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
              >
                <LayoutDashboard className="h-4 w-4" />
                <span>Dashboard</span>
              </Link>
              <Link
                to="/admin/services"
                className="flex items-center space-x-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Briefcase className="h-4 w-4" />
                <span>Manage Services</span>
              </Link>
              <Link
                to="/admin/gallery"
                className="flex items-center space-x-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <ImageIcon className="h-4 w-4" />
                <span>Manage Gallery</span>
              </Link>
              <Link
                to="/admin/portfolio"
                className="flex items-center space-x-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <FolderOpen className="h-4 w-4" />
                <span>Manage Portfolio</span>
              </Link>
              <Link
                to="/admin/bookings"
                className="flex items-center space-x-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <CalendarIcon className="h-4 w-4" />
                <span>Manage Bookings</span>
              </Link>
              {role === 'admin' && (
                <>
                  <Link
                    to="/admin/users"
                    className="flex items-center space-x-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Users className="h-4 w-4" />
                    <span>Manage Users</span>
                  </Link>
                  <Link
                    to="/admin/settings"
                    className="flex items-center space-x-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <SettingsIcon className="h-4 w-4" />
                    <span>Settings</span>
                  </Link>
                </>
              )}
            </nav>
          </div>
          
          <div className="mt-auto">
            <div className="mb-4 px-3 py-2">
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
            <Button
              variant="ghost"
              className="w-full justify-start text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 bg-background">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/services" element={<ManageServices />} />
          <Route path="/gallery" element={<ManageGallery />} />
          <Route path="/portfolio" element={<ManagePortfolio />} />
          <Route path="/bookings" element={<ManageBookings />} />
          {role === 'admin' && (
            <>
              <Route path="/users" element={<ManageUsers />} />
              <Route path="/settings" element={<ManageSettings />} />
            </>
          )}
          <Route path="*" element={<div className="flex h-full items-center justify-center text-muted-foreground">Access Denied or Page Not Found</div>} />
        </Routes>
      </main>
    </div>
  );
}

function Login() {
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleGoogleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      // Check if user exists in Firestore, if not create as guest
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) {
        await setDoc(doc(db, 'users', user.uid), {
          email: user.email,
          role: user.email === "serwaahlinda1995@gmail.com" ? "admin" : "guest",
          createdAt: serverTimestamp()
        });
      }
      
      toast.success('Logged in successfully');
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/popup-blocked') {
        toast.error('Login popup was blocked by your browser. Please allow popups for this site.');
      } else if (error.code === 'auth/cancelled-popup-request') {
        // Ignore this one as it's usually triggered by the user closing the popup or a double click
      } else {
        toast.error('Login failed. Make sure you are an authorized admin.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md bg-card border-border">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-foreground">Admin Login</CardTitle>
          <CardDescription className="text-muted-foreground">Sign in with your Google account to manage the website.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={handleGoogleLogin}
            disabled={isLoggingIn}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white"
          >
            {isLoggingIn ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign in with Google'
            )}
          </Button>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Authorized admins only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Dashboard() {
  const [counts, setCounts] = useState({ services: 0, gallery: 0, portfolio: 0, bookings: 0 });

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const servicesSnap = await getDocs(collection(db, 'services'));
        const gallerySnap = await getDocs(collection(db, 'gallery'));
        const portfolioSnap = await getDocs(collection(db, 'portfolio'));
        const bookingsSnap = await getDocs(collection(db, 'bookings'));
        setCounts({
          services: servicesSnap.size,
          gallery: gallerySnap.size,
          portfolio: portfolioSnap.size,
          bookings: bookingsSnap.size
        });
      } catch (error) {
        console.error(error);
      }
    };
    fetchCounts();
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Services</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{counts.services}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Gallery Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{counts.gallery}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Portfolio Projects</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{counts.portfolio}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Bookings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{counts.bookings}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ManageServices() {
  const [services, setServices] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newService, setNewService] = useState({ title: '', description: '', iconName: 'Briefcase', color: 'bg-blue-100 text-blue-600' });

  useEffect(() => {
    const q = query(collection(db, 'services'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setServices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'services');
    });
    return () => unsubscribe();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'services'), {
        ...newService,
        createdAt: serverTimestamp()
      });
      toast.success('Service added');
      setIsAdding(false);
      setNewService({ title: '', description: '', iconName: 'Briefcase', color: 'bg-blue-100 text-blue-600' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'services');
    }
  };

  const handleSendReminder = async (booking: any) => {
    try {
      const response = await fetch('/api/notify-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: booking.userEmail,
          phone: booking.userPhone,
          userName: booking.userName,
          serviceTitle: booking.serviceTitle || 'General Consultation',
          date: booking.date
        })
      });

      const result = await response.json();
      
      // Also add an in-app notification
      if (booking.userId && booking.userId !== 'anonymous') {
        await addDoc(collection(db, 'notifications'), {
          userId: booking.userId,
          title: 'Booking Reminder',
          message: `This is a reminder for your booking: ${booking.serviceTitle || 'General Consultation'} on ${booking.date}. We look forward to seeing you!`,
          read: false,
          createdAt: serverTimestamp()
        });
      }

      if (result.results?.sms === "failed (unverified number)") {
        toast.warning("Reminder sent via email, but SMS failed. (Twilio Trial Restriction: Recipient number must be verified in your Twilio Console).", {
          duration: 6000,
        });
      } else {
        toast.success("Reminder sent successfully!");
      }
    } catch (error) {
      console.error("Failed to send reminder:", error);
      toast.error("Failed to send reminder.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this service?')) return;
    try {
      await deleteDoc(doc(db, 'services', id));
      toast.success('Service deleted');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `services/${id}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Manage Services</h1>
        <Button onClick={() => setIsAdding(!isAdding)} className="bg-orange-600 hover:bg-orange-700 text-white">
          {isAdding ? 'Cancel' : <><Plus className="mr-2 h-4 w-4" /> Add Service</>}
        </Button>
      </div>

      {isAdding && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Add New Service</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdd} className="space-y-4">
              <Input 
                placeholder="Title" 
                value={newService.title} 
                onChange={e => setNewService({...newService, title: e.target.value})} 
                required 
                className="bg-muted/50 border-border"
              />
              <Textarea 
                placeholder="Description" 
                value={newService.description} 
                onChange={e => setNewService({...newService, description: e.target.value})} 
                required 
                className="bg-muted/50 border-border"
              />
              <div className="grid grid-cols-2 gap-4">
                <Input 
                  placeholder="Icon Name (Lucide)" 
                  value={newService.iconName} 
                  onChange={e => setNewService({...newService, iconName: e.target.value})} 
                  required 
                  className="bg-muted/50 border-border"
                />
                <Input 
                  placeholder="Color Classes" 
                  value={newService.color} 
                  onChange={e => setNewService({...newService, color: e.target.value})} 
                  required 
                  className="bg-muted/50 border-border"
                />
              </div>
              <Button type="submit" className="w-full bg-orange-600 text-white">Save Service</Button>
            </form>
          </CardContent>
        </Card>
      )}
      
      <Card className="bg-card border-border">
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {services.map((service) => (
              <div key={service.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium text-foreground">{service.title}</p>
                  <p className="text-sm text-muted-foreground truncate max-w-md">{service.description}</p>
                </div>
                <div className="flex space-x-2">
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(service.id)} className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 hover:text-red-700">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            {services.length === 0 && <p className="p-8 text-center text-muted-foreground">No services found.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ManageGallery() {
  const [items, setItems] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState({ type: 'image', url: '', title: '', category: 'events', thumbnail: '' });
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'gallery'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'gallery');
    });
    return () => unsubscribe();
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (Firestore limit is 1MB for the whole document)
    if (file.size > 800000) { // 800KB limit to be safe
      toast.error('File is too large. Please use a URL for files over 800KB.');
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onloadend = () => {
      setNewItem({ ...newItem, url: reader.result as string });
      setIsUploading(false);
      toast.success('File ready for saving');
    };
    reader.readAsDataURL(file);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'gallery'), {
        ...newItem,
        createdAt: serverTimestamp(),
        likes: [],
        comments: []
      });
      toast.success('Media added');
      setIsAdding(false);
      setNewItem({ type: 'image', url: '', title: '', category: 'events', thumbnail: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'gallery');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    try {
      await deleteDoc(doc(db, 'gallery', id));
      toast.success('Item deleted');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `gallery/${id}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Manage Gallery</h1>
        <Button onClick={() => setIsAdding(!isAdding)} className="bg-orange-600 hover:bg-orange-700 text-white">
          {isAdding ? 'Cancel' : <><Plus className="mr-2 h-4 w-4" /> Add Media</>}
        </Button>
      </div>

      {isAdding && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Add New Media</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <select 
                  className="flex h-10 w-full rounded-md border border-input bg-muted/50 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 text-foreground"
                  value={newItem.type}
                  onChange={e => setNewItem({...newItem, type: e.target.value})}
                >
                  <option value="image">Image</option>
                  <option value="video">Video</option>
                </select>
                <select 
                  className="flex h-10 w-full rounded-md border border-input bg-muted/50 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 text-foreground"
                  value={newItem.category}
                  onChange={e => setNewItem({...newItem, category: e.target.value})}
                >
                  <option value="events">Events</option>
                  <option value="entertainment">Entertainment</option>
                  <option value="consulting">Consulting</option>
                </select>
              </div>
              <Input 
                placeholder="Title" 
                value={newItem.title} 
                onChange={e => setNewItem({...newItem, title: e.target.value})} 
                required 
                className="bg-muted/50 border-border"
              />
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Upload from Local Disk (Max 800KB)</label>
                <div className="flex items-center gap-4">
                  <Input 
                    type="file" 
                    accept={newItem.type === 'image' ? "image/*" : "video/*"}
                    onChange={handleFileUpload}
                    className="cursor-pointer bg-muted/50 border-border"
                  />
                  {isUploading && <Loader2 className="h-4 w-4 animate-spin text-orange-600" />}
                </div>
                <p className="text-[10px] text-muted-foreground italic">Note: Large videos should be hosted on YouTube/Vimeo and linked via URL below.</p>
              </div>

              <Input 
                placeholder="URL (Image URL or Video Embed URL)" 
                value={newItem.url} 
                onChange={e => setNewItem({...newItem, url: e.target.value})} 
                required 
                className="bg-muted/50 border-border"
              />
              {newItem.type === 'video' && (
                <Input 
                  placeholder="Thumbnail URL" 
                  value={newItem.thumbnail} 
                  onChange={e => setNewItem({...newItem, thumbnail: e.target.value})} 
                  required 
                  className="bg-muted/50 border-border"
                />
              )}
              <Button type="submit" className="w-full bg-orange-600 text-white">Save Media</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {items.map((item) => (
          <div key={item.id} className="group relative aspect-square overflow-hidden rounded-xl bg-muted border border-border/50">
            <img
              src={item.type === 'image' ? item.url : item.thumbnail}
              alt={item.title}
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
              <Button variant="destructive" size="sm" onClick={() => handleDelete(item.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-2 text-[10px] text-white opacity-0 group-hover:opacity-100">
              {item.title}
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="col-span-full py-8 text-center text-muted-foreground">No media found.</p>}
      </div>
    </div>
  );
}

function ManagePortfolio() {
  const [items, setItems] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState({ title: '', description: '', imageUrl: '', category: 'Consulting' });

  useEffect(() => {
    const q = query(collection(db, 'portfolio'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'portfolio');
    });
    return () => unsubscribe();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'portfolio'), {
        ...newItem,
        createdAt: serverTimestamp()
      });
      toast.success('Project added');
      setIsAdding(false);
      setNewItem({ title: '', description: '', imageUrl: '', category: 'Consulting' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'portfolio');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this project?')) return;
    try {
      await deleteDoc(doc(db, 'portfolio', id));
      toast.success('Project deleted');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `portfolio/${id}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Manage Portfolio</h1>
        <Button onClick={() => setIsAdding(!isAdding)} className="bg-orange-600 hover:bg-orange-700 text-white">
          {isAdding ? 'Cancel' : <><Plus className="mr-2 h-4 w-4" /> Add Project</>}
        </Button>
      </div>

      {isAdding && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Add New Portfolio Project</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input 
                  placeholder="Title" 
                  value={newItem.title} 
                  onChange={e => setNewItem({...newItem, title: e.target.value})} 
                  required 
                  className="bg-muted/50 border-border"
                />
                <Input 
                  placeholder="Category" 
                  value={newItem.category} 
                  onChange={e => setNewItem({...newItem, category: e.target.value})} 
                  required 
                  className="bg-muted/50 border-border"
                />
              </div>
              <Input 
                placeholder="Image URL" 
                value={newItem.imageUrl} 
                onChange={e => setNewItem({...newItem, imageUrl: e.target.value})} 
                required 
                className="bg-muted/50 border-border"
              />
              <Textarea 
                placeholder="Description" 
                value={newItem.description} 
                onChange={e => setNewItem({...newItem, description: e.target.value})} 
                required 
                className="bg-muted/50 border-border"
              />
              <Button type="submit" className="w-full bg-orange-600 text-white">Save Project</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4">
        {items.map((item) => (
          <Card key={item.id} className="bg-card border-border">
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center space-x-4">
                <div className="h-12 w-12 overflow-hidden rounded-lg bg-muted">
                  <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.category}</p>
                </div>
              </div>
              <Button variant="destructive" size="icon" onClick={() => handleDelete(item.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
        {items.length === 0 && <p className="py-8 text-center text-muted-foreground">No projects found.</p>}
      </div>
    </div>
  );
}

function ManageSettings() {
  const [settings, setSettings] = useState<any>({
    address: '',
    phone: '',
    email: '',
    aboutContent: '',
    aboutImageUrl: '',
    dailyQuote: '',
    facebook: '',
    youtube: '',
    tiktok: '',
    logoUrl: ''
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'global'), (doc) => {
      if (doc.exists()) {
        setSettings(doc.data());
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await setDoc(doc(db, 'settings', 'global'), settings);
      toast.success('Settings updated');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/global');
    }
  };

  if (loading) return <Loader2 className="h-8 w-8 animate-spin text-orange-600 mx-auto" />;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-foreground">Website Settings</h1>
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Contact Information & About Content</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdate} className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2 text-foreground">
                  <Mail className="h-4 w-4 text-muted-foreground" /> Email Address
                </label>
                <Input
                  value={settings.email}
                  onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                  placeholder="info@grefas.com"
                  className="bg-muted/50 border-border"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2 text-foreground">
                  <Phone className="h-4 w-4 text-muted-foreground" /> Phone Number
                </label>
                <Input
                  value={settings.phone}
                  onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                  placeholder="+233 123 456 789"
                  className="bg-muted/50 border-border"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2 text-foreground">
                  <MapPin className="h-4 w-4 text-muted-foreground" /> Office Address
                </label>
                <Input
                  value={settings.address}
                  onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                  placeholder="Accra, Ghana"
                  className="bg-muted/50 border-border"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2 text-foreground">
                <ImageIcon className="h-4 w-4 text-muted-foreground" /> Website Logo URL
              </label>
              <Input
                value={settings.logoUrl}
                onChange={(e) => setSettings({ ...settings, logoUrl: e.target.value })}
                placeholder="https://..."
                className="bg-muted/50 border-border"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2 text-foreground">
                <ImageIcon className="h-4 w-4 text-muted-foreground" /> About Page Image URL
              </label>
              <Input
                value={settings.aboutImageUrl}
                onChange={(e) => setSettings({ ...settings, aboutImageUrl: e.target.value })}
                placeholder="https://images.unsplash.com/..."
                className="bg-muted/50 border-border"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2 text-foreground">
                <Info className="h-4 w-4 text-muted-foreground" /> About Us Content
              </label>
              <Textarea
                value={settings.aboutContent}
                onChange={(e) => setSettings({ ...settings, aboutContent: e.target.value })}
                placeholder="Tell your story..."
                rows={8}
                className="bg-muted/50 border-border"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2 text-foreground">
                <Quote className="h-4 w-4 text-muted-foreground" /> Daily Inspiration Quote
              </label>
              <Input
                value={settings.dailyQuote}
                onChange={(e) => setSettings({ ...settings, dailyQuote: e.target.value })}
                placeholder="Excellence is not an act, but a habit."
                className="bg-muted/50 border-border"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2 text-foreground">
                  <Facebook className="h-4 w-4 text-muted-foreground" /> Facebook Link
                </label>
                <Input
                  value={settings.facebook}
                  onChange={(e) => setSettings({ ...settings, facebook: e.target.value })}
                  placeholder="https://facebook.com/..."
                  className="bg-muted/50 border-border"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2 text-foreground">
                  <Youtube className="h-4 w-4 text-muted-foreground" /> YouTube Link
                </label>
                <Input
                  value={settings.youtube}
                  onChange={(e) => setSettings({ ...settings, youtube: e.target.value })}
                  placeholder="https://youtube.com/..."
                  className="bg-muted/50 border-border"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2 text-foreground">
                  <Music2 className="h-4 w-4 text-muted-foreground" /> TikTok Link
                </label>
                <Input
                  value={settings.tiktok}
                  onChange={(e) => setSettings({ ...settings, tiktok: e.target.value })}
                  placeholder="https://tiktok.com/@..."
                  className="bg-muted/50 border-border"
                />
              </div>
            </div>

            <Button type="submit" className="bg-orange-600 hover:bg-orange-700 text-white flex items-center gap-2">
              <Save className="h-4 w-4" /> Save All Settings
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="bg-card border-border border-orange-200 dark:border-orange-900/30">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-orange-600">
            <AlertCircle className="h-5 w-5" /> SMS Notification Help
          </CardTitle>
          <CardDescription>
            Important information about sending SMS notifications with a Twilio Trial account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            You are currently using a <strong>Twilio Trial Account</strong>. Twilio restricts trial accounts from sending SMS messages to numbers that have not been manually verified.
          </p>
          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            <p className="font-bold text-foreground">To fix "Unverified Number" errors:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Log in to your <a href="https://www.twilio.com/console" target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:underline">Twilio Console</a>.</li>
              <li>Go to <strong>Phone Numbers &gt; Verified Caller IDs</strong>.</li>
              <li>Add and verify the phone numbers you want to test with.</li>
              <li>Alternatively, upgrade your Twilio account to remove this restriction.</li>
            </ol>
          </div>
          <p className="text-xs italic">
            Note: Email notifications (via Resend) and in-app notifications are not affected by this restriction.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function ManageBookings() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'bookings'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setBookings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'bookings');
    });
    return () => unsubscribe();
  }, []);

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const bookingRef = doc(db, 'bookings', id);
      await setDoc(bookingRef, { status: newStatus }, { merge: true });
      
      // Notify the user if confirmed or cancelled
      if (newStatus === 'confirmed' || newStatus === 'cancelled') {
        const bookingSnap = await getDoc(bookingRef);
        if (bookingSnap.exists()) {
          const bookingData = bookingSnap.data();
          
          // 1. In-app notification
          if (bookingData.userId && bookingData.userId !== 'anonymous') {
            const title = newStatus === 'confirmed' ? 'Booking Confirmed!' : 'Booking Cancelled';
            const message = newStatus === 'confirmed' 
              ? `Your booking for ${bookingData.serviceTitle || 'General Consultation'} on ${bookingData.date} has been confirmed.`
              : `Your booking for ${bookingData.serviceTitle || 'General Consultation'} on ${bookingData.date} has been cancelled. Please contact us for more information.`;

            await addDoc(collection(db, 'notifications'), {
              userId: bookingData.userId,
              title,
              message,
              read: false,
              createdAt: serverTimestamp()
            });
          }

          // 2. Email and SMS notification via backend (only for confirmation in this example)
          if (newStatus === 'confirmed') {
            try {
              const response = await fetch('/api/notify-confirmation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  email: bookingData.userEmail,
                  phone: bookingData.userPhone,
                  userName: bookingData.userName,
                  serviceTitle: bookingData.serviceTitle || 'General Consultation',
                  date: bookingData.date
                })
              });
              
              const result = await response.json();
              if (result.results?.sms === "failed (unverified number)") {
                toast.warning("Booking confirmed, but SMS failed. (Twilio Trial Restriction: Recipient number must be verified in your Twilio Console).", {
                  duration: 6000,
                });
              }
            } catch (error) {
              console.error("Failed to send external notifications:", error);
            }
          }
        }
      }
      
      toast.success(`Booking ${newStatus}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `bookings/${id}`);
    }
  };

  const handleSendReminder = async (booking: any) => {
    try {
      const response = await fetch('/api/notify-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: booking.userEmail,
          phone: booking.userPhone,
          userName: booking.userName,
          serviceTitle: booking.serviceTitle || 'General Consultation',
          date: booking.date
        })
      });

      const result = await response.json();
      
      // Also add an in-app notification
      if (booking.userId && booking.userId !== 'anonymous') {
        await addDoc(collection(db, 'notifications'), {
          userId: booking.userId,
          title: 'Booking Reminder',
          message: `This is a reminder for your booking: ${booking.serviceTitle || 'General Consultation'} on ${booking.date}. We look forward to seeing you!`,
          read: false,
          createdAt: serverTimestamp()
        });
      }

      if (result.results?.sms === "failed (unverified number)") {
        toast.warning("Reminder sent via email, but SMS failed. (Twilio Trial Restriction: Recipient number must be verified in your Twilio Console).", {
          duration: 6000,
        });
      } else {
        toast.success("Reminder sent successfully!");
      }
    } catch (error) {
      console.error("Failed to send reminder:", error);
      toast.error("Failed to send reminder.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this booking?')) return;
    try {
      await deleteDoc(doc(db, 'bookings', id));
      toast.success('Booking deleted');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `bookings/${id}`);
    }
  };

  if (loading) return <Loader2 className="h-8 w-8 animate-spin text-orange-600 mx-auto" />;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-foreground">Manage Bookings</h1>
      <div className="grid grid-cols-1 gap-6">
        {bookings.map((booking) => (
          <Card key={booking.id} className="overflow-hidden bg-card border-border">
            <div className="flex flex-col md:flex-row">
              <div className="bg-muted/50 p-6 md:w-48 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-border">
                <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Date</span>
                <span className="text-2xl font-black text-foreground">{booking.date}</span>
                <div className={`mt-2 rounded-full px-3 py-1 text-xs font-bold uppercase ${
                  booking.status === 'confirmed' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                  booking.status === 'cancelled' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                  'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
                }`}>
                  {booking.status}
                </div>
              </div>
              <div className="flex-1 p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-foreground">{booking.userName}</h3>
                    <p className="text-sm text-muted-foreground">{booking.userEmail}</p>
                    <p className="text-sm text-muted-foreground">{booking.userPhone}</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">Service: {booking.serviceTitle || 'General Consultation'}</p>
                    <p className="mt-2 text-sm text-muted-foreground italic">"{booking.notes || 'No notes provided.'}"</p>
                  </div>
                </div>
                <div className="mt-6 flex flex-wrap gap-2">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="border-green-600 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/10"
                    onClick={() => handleStatusChange(booking.id, 'confirmed')}
                  >
                    Confirm
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="border-red-600 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10"
                    onClick={() => handleStatusChange(booking.id, 'cancelled')}
                  >
                    Cancel
                  </Button>
                  {booking.status === 'confirmed' && (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="border-orange-600 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/10 flex items-center gap-2"
                      onClick={() => handleSendReminder(booking)}
                    >
                      <Bell className="h-4 w-4" /> Send Reminder
                    </Button>
                  )}
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="text-muted-foreground hover:text-red-600 ml-auto"
                    onClick={() => handleDelete(booking.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        ))}
        {bookings.length === 0 && (
          <div className="py-20 text-center text-muted-foreground">
            No bookings found.
          </div>
        )}
      </div>
    </div>
  );
}

function ManageUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });
    return () => unsubscribe();
  }, []);

  const handleUpdateRole = async (uid: string, role: string) => {
    try {
      await setDoc(doc(db, 'users', uid), { role }, { merge: true });
      toast.success(`User role updated to ${role}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
    }
  };

  const handleDeleteUser = async (uid: string) => {
    if (!confirm('Are you sure? This will remove their admin/editor access.')) return;
    try {
      await deleteDoc(doc(db, 'users', uid));
      toast.success('User removed');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${uid}`);
    }
  };

  if (loading) return <Loader2 className="h-8 w-8 animate-spin text-orange-600 mx-auto" />;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-foreground">Manage Users</h1>
      
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Authorized Users</CardTitle>
          <CardDescription className="text-muted-foreground">Manage roles for users who have signed in to the admin panel.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {users.map((u) => (
              <div key={u.id} className="flex items-center justify-between p-4 border border-border rounded-lg bg-muted/50">
                <div>
                  <p className="font-bold text-foreground">{u.email}</p>
                  <p className="text-xs text-muted-foreground">UID: {u.id}</p>
                </div>
                <div className="flex items-center gap-4">
                  <select
                    className="rounded-md border border-border bg-background text-foreground px-3 py-1 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                    value={u.role}
                    onChange={(e) => handleUpdateRole(u.id, e.target.value)}
                  >
                    <option value="admin">Admin</option>
                    <option value="editor">Editor</option>
                    <option value="guest">Guest (No Access)</option>
                  </select>
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10" onClick={() => handleDeleteUser(u.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            {users.length === 0 && (
              <p className="text-center py-8 text-muted-foreground">No users found in the database yet.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="rounded-xl bg-blue-50 dark:bg-blue-900/10 p-6 border border-blue-100 dark:border-blue-900/20">
        <h4 className="font-bold text-blue-900 dark:text-blue-400 flex items-center gap-2">
          <Info className="h-5 w-5" /> How to add new users
        </h4>
        <p className="mt-2 text-sm text-blue-800 dark:text-blue-300">
          1. Ask the new person to visit the /admin page and sign in with Google.<br />
          2. They will see an "Access Denied" message initially.<br />
          3. Their account will then appear in this list.<br />
          4. You can then change their role from "Guest" to "Editor" or "Admin".
        </p>
      </div>
    </div>
  );
}
