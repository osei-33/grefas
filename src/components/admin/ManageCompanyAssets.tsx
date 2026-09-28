import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { 
  Package, 
  Plus, 
  Search, 
  Filter, 
  SlidersHorizontal, 
  Camera, 
  Mic2, 
  Sun, 
  Laptop, 
  Truck, 
  Armchair, 
  Zap, 
  QrCode, 
  Printer, 
  Download, 
  FileSpreadsheet, 
  Trash2, 
  Edit3, 
  Eye, 
  CheckCircle2, 
  AlertTriangle, 
  Wrench, 
  Clock, 
  MapPin, 
  User, 
  DollarSign, 
  Tag, 
  Sparkles, 
  RefreshCw, 
  ChevronRight, 
  X,
  ExternalLink,
  ShieldCheck,
  Archive,
  Grid,
  List,
  Info
} from 'lucide-react';
import { toast } from 'sonner';

export interface CompanyAsset {
  id: string;
  assetTag: string; // e.g. GREFAS-AST-1049
  name: string;
  category: string;
  brand: string;
  modelNumber: string;
  serialNumber: string;
  purchasePrice: number;
  currentValue: number;
  purchaseDate: string;
  vendorOrSupplier: string;
  warrantyExpiry: string;
  location: string;
  assignedTo: string;
  condition: 'excellent' | 'good' | 'fair' | 'damaged';
  status: 'active' | 'in_use' | 'maintenance' | 'reserved' | 'disposed';
  imageUrl: string;
  notes: string;
  createdAt?: any;
  updatedAt?: any;
}

const ASSET_CATEGORIES = [
  { name: 'Cinematography & Cameras', icon: Camera, color: 'text-blue-500 bg-blue-500/10' },
  { name: 'Audio & Sound Gear', icon: Mic2, color: 'text-purple-500 bg-purple-500/10' },
  { name: 'Lighting & Rigging', icon: Sun, color: 'text-amber-500 bg-amber-500/10' },
  { name: 'Computers & IT', icon: Laptop, color: 'text-emerald-500 bg-emerald-500/10' },
  { name: 'Production Vehicles & Transport', icon: Truck, color: 'text-orange-500 bg-orange-500/10' },
  { name: 'Studio Sets & Props', icon: Package, color: 'text-rose-500 bg-rose-500/10' },
  { name: 'Office Furniture & Equipment', icon: Armchair, color: 'text-teal-500 bg-teal-500/10' },
  { name: 'Power, Batteries & Generators', icon: Zap, color: 'text-yellow-500 bg-yellow-500/10' }
];

const PRESET_GEAR_IMAGES = [
  { name: 'Cinema Camera (Sony FX3)', url: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=600&q=80' },
  { name: 'Wireless Audio Mic Kit', url: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&w=600&q=80' },
  { name: 'Studio COB Light Rig', url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=600&q=80' },
  { name: 'MacBook Pro Editing Suite', url: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=600&q=80' },
  { name: 'Production Bus / Van', url: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=600&q=80' },
  { name: 'Silent Inverter Generator', url: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=600&q=80' },
  { name: 'Office Desk & Workstation', url: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=600&q=80' }
];

const SAMPLE_ASSETS: Omit<CompanyAsset, 'id'>[] = [
  {
    assetTag: 'GREFAS-CAM-001',
    name: 'Sony FX3 Cinema Line Full-Frame Camera',
    category: 'Cinematography & Cameras',
    brand: 'Sony',
    modelNumber: 'ILME-FX3',
    serialNumber: 'SN-FX3-849201',
    purchasePrice: 42000,
    currentValue: 39500,
    purchaseDate: '2025-04-10',
    vendorOrSupplier: 'Compu-Ghana Direct Import',
    warrantyExpiry: '2027-04-10',
    location: 'Nyinahin Main Studio - Gear Vault A1',
    assignedTo: 'Lead Cinematographer (Kofi Mensah)',
    condition: 'excellent',
    status: 'active',
    imageUrl: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=600&q=80',
    notes: 'Includes top audio handle, XLR adapter, 3x NP-FZ100 batteries, SmallRig cage, and 2x 160GB Type A CFexpress cards.'
  },
  {
    assetTag: 'GREFAS-LENS-002',
    name: 'Sony GM 24-70mm f/2.8 II Zoom Lens',
    category: 'Cinematography & Cameras',
    brand: 'Sony G Master',
    modelNumber: 'SEL2470GM2',
    serialNumber: 'SN-SEL-483920',
    purchasePrice: 26500,
    currentValue: 25000,
    purchaseDate: '2025-05-18',
    vendorOrSupplier: 'Adorama NYC Direct',
    warrantyExpiry: '2027-05-18',
    location: 'Nyinahin Main Studio - Lens Cabinet 2',
    assignedTo: 'Lead Cinematographer (Kofi Mensah)',
    condition: 'excellent',
    status: 'active',
    imageUrl: 'https://images.unsplash.com/photo-1617005082133-548c4dd27f35?auto=format&fit=crop&w=600&q=80',
    notes: 'Pristine optics. Fitted with B+W 82mm Nano Pro UV filter and lens hood.'
  },
  {
    assetTag: 'GREFAS-AUD-003',
    name: 'Rode Wireless PRO Dual Microphone Kit',
    category: 'Audio & Sound Gear',
    brand: 'RØDE',
    modelNumber: 'WIPRO',
    serialNumber: 'SN-RODE-902812',
    purchasePrice: 6200,
    currentValue: 5800,
    purchaseDate: '2025-06-01',
    vendorOrSupplier: 'Melcom Digital Tech',
    warrantyExpiry: '2027-06-01',
    location: 'Nyinahin Main Studio - Audio Shelf',
    assignedTo: 'Sound Engineer (David Appiah)',
    condition: 'good',
    status: 'in_use',
    imageUrl: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&w=600&q=80',
    notes: 'Includes smart charging case, 2x Lavalier II mics, magnetic clips, furry windshields, and 32-bit float internal backup recording.'
  },
  {
    assetTag: 'GREFAS-LGT-004',
    name: 'Aputure LS 600d Pro Daylight LED Rig',
    category: 'Lighting & Rigging',
    brand: 'Aputure',
    modelNumber: 'LS 600d Pro',
    serialNumber: 'SN-APUT-600984',
    purchasePrice: 28500,
    currentValue: 27000,
    purchaseDate: '2025-03-22',
    vendorOrSupplier: 'FilmGear Ghana Ltd',
    warrantyExpiry: '2027-03-22',
    location: 'Nyinahin Studio - Grip & Lighting Bay',
    assignedTo: 'Gaffer & Chief Electrician',
    condition: 'good',
    status: 'active',
    imageUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=600&q=80',
    notes: 'Comes with rolling flight case, Light Dome 150 softbox, hyper reflector, and heavy-duty C-stand with sandbag.'
  },
  {
    assetTag: 'GREFAS-IT-005',
    name: 'Apple MacBook Pro 16" M3 Max 64GB Editing Station',
    category: 'Computers & IT',
    brand: 'Apple',
    modelNumber: 'MBP 16 M3 Max',
    serialNumber: 'SN-C02GF9284910',
    purchasePrice: 48000,
    currentValue: 46000,
    purchaseDate: '2025-02-14',
    vendorOrSupplier: 'iStore Ghana - Accra Mall',
    warrantyExpiry: '2028-02-14',
    location: 'Post-Production Room 1 - Edit Suite',
    assignedTo: 'Lead Video Editor (Akua Serwaa)',
    condition: 'excellent',
    status: 'in_use',
    imageUrl: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=600&q=80',
    notes: 'Main 4K/8K DaVinci Resolve color grading and Premiere editing workstation. 2TB high-speed SSD, paired with 10Gbps Thunderbolt RAID.'
  },
  {
    assetTag: 'GREFAS-VEH-006',
    name: 'Toyota HiAce 16-Seater Production & Crew Bus',
    category: 'Production Vehicles & Transport',
    brand: 'Toyota',
    modelNumber: 'HiAce Commuter Van',
    serialNumber: 'VIN-JTF1154092841',
    purchasePrice: 185000,
    currentValue: 175000,
    purchaseDate: '2024-11-10',
    vendorOrSupplier: 'Toyota Ghana Motors',
    warrantyExpiry: '2027-11-10',
    location: 'Nyinahin Headquarters - Secure Compound Bay 1',
    assignedTo: 'Production Fleet Manager & Chief Driver',
    condition: 'good',
    status: 'active',
    imageUrl: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=600&q=80',
    notes: 'Official production shuttle for transporting cast, crew, and camera equipment to on-location movie shoots across Ghana. Fully insured with GPS tracking.'
  },
  {
    assetTag: 'GREFAS-PWR-007',
    name: 'Honda EU70is 7.0kVA Silent Inverter Generator',
    category: 'Power, Batteries & Generators',
    brand: 'Honda',
    modelNumber: 'EU70is',
    serialNumber: 'SN-HND-700192',
    purchasePrice: 32000,
    currentValue: 29500,
    purchaseDate: '2025-01-18',
    vendorOrSupplier: 'PowerPro Ghana Industrial',
    warrantyExpiry: '2026-01-18',
    location: 'Nyinahin Studio - Generator Shed',
    assignedTo: 'Studio Operations Supervisor',
    condition: 'good',
    status: 'active',
    imageUrl: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=600&q=80',
    notes: 'Silent pure sine wave generator for location filming in remote areas where grid electricity is unavailable. Electric key start.'
  }
];

export default function ManageCompanyAssets() {
  const [assets, setAssets] = useState<CompanyAsset[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedCondition, setSelectedCondition] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Modal states
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isTagPrintModalOpen, setIsTagPrintModalOpen] = useState(false);
  const [isAuditReportModalOpen, setIsAuditReportModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<CompanyAsset | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<CompanyAsset | null>(null);

  // Form State
  const [formData, setFormData] = useState<Omit<CompanyAsset, 'id'>>({
    assetTag: '',
    name: '',
    category: 'Cinematography & Cameras',
    brand: '',
    modelNumber: '',
    serialNumber: '',
    purchasePrice: 0,
    currentValue: 0,
    purchaseDate: new Date().toISOString().split('T')[0],
    vendorOrSupplier: '',
    warrantyExpiry: '',
    location: 'Nyinahin Studio - Main Gear Vault',
    assignedTo: 'Unassigned / In Vault',
    condition: 'excellent',
    status: 'active',
    imageUrl: '',
    notes: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);

  // Real-time Firestore Subscription
  useEffect(() => {
    const assetsQuery = query(collection(db, 'assets'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(assetsQuery, (snapshot) => {
      const items = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      })) as CompanyAsset[];
      setAssets(items);
      setLoading(false);
    }, (error) => {
      console.warn('Assets listener fallback (handled):', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Helper to generate unique tag
  const generateNewAssetTag = (categoryName?: string) => {
    let prefix = 'AST';
    const cat = categoryName || formData.category;
    if (cat.includes('Camera') || cat.includes('Cinematography')) prefix = 'CAM';
    else if (cat.includes('Audio') || cat.includes('Sound')) prefix = 'AUD';
    else if (cat.includes('Lighting')) prefix = 'LGT';
    else if (cat.includes('Computer') || cat.includes('IT')) prefix = 'IT';
    else if (cat.includes('Vehicle')) prefix = 'VEH';
    else if (cat.includes('Power') || cat.includes('Generator')) prefix = 'PWR';
    else if (cat.includes('Office') || cat.includes('Furniture')) prefix = 'OFC';
    
    const randomDigits = Math.floor(100 + Math.random() * 900);
    return `GREFAS-${prefix}-${randomDigits}`;
  };

  const handleOpenRegister = (assetToEdit?: CompanyAsset) => {
    if (assetToEdit) {
      setEditingAsset(assetToEdit);
      setFormData({
        assetTag: assetToEdit.assetTag || '',
        name: assetToEdit.name || '',
        category: assetToEdit.category || 'Cinematography & Cameras',
        brand: assetToEdit.brand || '',
        modelNumber: assetToEdit.modelNumber || '',
        serialNumber: assetToEdit.serialNumber || '',
        purchasePrice: assetToEdit.purchasePrice || 0,
        currentValue: assetToEdit.currentValue || 0,
        purchaseDate: assetToEdit.purchaseDate || '',
        vendorOrSupplier: assetToEdit.vendorOrSupplier || '',
        warrantyExpiry: assetToEdit.warrantyExpiry || '',
        location: assetToEdit.location || 'Nyinahin Studio - Main Gear Vault',
        assignedTo: assetToEdit.assignedTo || 'Unassigned / In Vault',
        condition: assetToEdit.condition || 'good',
        status: assetToEdit.status || 'active',
        imageUrl: assetToEdit.imageUrl || '',
        notes: assetToEdit.notes || ''
      });
    } else {
      setEditingAsset(null);
      setFormData({
        assetTag: generateNewAssetTag('Cinematography & Cameras'),
        name: '',
        category: 'Cinematography & Cameras',
        brand: '',
        modelNumber: '',
        serialNumber: '',
        purchasePrice: 0,
        currentValue: 0,
        purchaseDate: new Date().toISOString().split('T')[0],
        vendorOrSupplier: '',
        warrantyExpiry: '',
        location: 'Nyinahin Studio - Main Gear Vault',
        assignedTo: 'Unassigned / In Vault',
        condition: 'excellent',
        status: 'active',
        imageUrl: '',
        notes: ''
      });
    }
    setIsRegisterModalOpen(true);
  };

  // Submit new or updated asset
  const handleSubmitAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Please enter the asset name');
      return;
    }
    if (!formData.assetTag.trim()) {
      toast.error('Please provide or generate a unique Asset Tag');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        purchasePrice: Number(formData.purchasePrice) || 0,
        currentValue: Number(formData.currentValue) || Number(formData.purchasePrice) || 0,
        updatedAt: serverTimestamp()
      };

      if (editingAsset) {
        await updateDoc(doc(db, 'assets', editingAsset.id), payload);
        toast.success(`Asset "${formData.name}" updated successfully!`);
      } else {
        await addDoc(collection(db, 'assets'), {
          ...payload,
          createdAt: serverTimestamp()
        });
        toast.success(`New asset "${formData.name}" registered to Grefas inventory!`);
      }

      setIsRegisterModalOpen(false);
      setEditingAsset(null);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, 'assets');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete asset
  const handleDeleteAsset = async (asset: CompanyAsset) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to permanently remove "${asset.name}" (${asset.assetTag}) from company records? This action cannot be undone.`
    );
    if (!confirmDelete) return;

    try {
      await deleteDoc(doc(db, 'assets', asset.id));
      toast.success(`Asset "${asset.name}" deleted from registry.`);
      if (selectedAsset?.id === asset.id) {
        setIsDetailModalOpen(false);
      }
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, `assets/${asset.id}`);
    }
  };

  // Quick Status change
  const handleQuickStatusChange = async (assetId: string, newStatus: CompanyAsset['status']) => {
    try {
      await updateDoc(doc(db, 'assets', assetId), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      toast.success(`Asset status updated to: ${newStatus.replace('_', ' ').toUpperCase()}`);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, `assets/${assetId}`);
    }
  };

  // Seed sample studio gear
  const handleSeedSampleAssets = async () => {
    const confirmSeed = window.confirm(
      'This will populate the inventory registry with realistic Grefas entertainment assets (Cinema cameras, lenses, microphones, lighting, production bus, generator, and MacBook editing suites). Proceed?'
    );
    if (!confirmSeed) return;

    setIsSeeding(true);
    try {
      for (const item of SAMPLE_ASSETS) {
        await addDoc(collection(db, 'assets'), {
          ...item,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      toast.success('7 sample production assets loaded into Grefas Inventory!');
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, 'assets');
    } finally {
      setIsSeeding(false);
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (assets.length === 0) {
      toast.error('No assets available to export.');
      return;
    }

    const headers = [
      'Asset Tag',
      'Asset Name',
      'Category',
      'Brand',
      'Model Number',
      'Serial Number',
      'Purchase Price (GHS)',
      'Current Value (GHS)',
      'Purchase Date',
      'Vendor / Supplier',
      'Location',
      'Assigned Custodian',
      'Condition',
      'Status',
      'Notes'
    ];

    const rows = filteredAssets.map((a) => [
      `"${a.assetTag || ''}"`,
      `"${(a.name || '').replace(/"/g, '""')}"`,
      `"${a.category || ''}"`,
      `"${(a.brand || '').replace(/"/g, '""')}"`,
      `"${(a.modelNumber || '').replace(/"/g, '""')}"`,
      `"${(a.serialNumber || '').replace(/"/g, '""')}"`,
      a.purchasePrice || 0,
      a.currentValue || 0,
      `"${a.purchaseDate || ''}"`,
      `"${(a.vendorOrSupplier || '').replace(/"/g, '""')}"`,
      `"${(a.location || '').replace(/"/g, '""')}"`,
      `"${(a.assignedTo || '').replace(/"/g, '""')}"`,
      `"${a.condition || ''}"`,
      `"${a.status || ''}"`,
      `"${(a.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Grefas_Company_Assets_Register_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Asset Register CSV downloaded successfully!');
  };

  // Filtered Assets Memo
  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      // Search
      const searchMatch = !searchQuery.trim() || 
        (asset.name && asset.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (asset.assetTag && asset.assetTag.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (asset.serialNumber && asset.serialNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (asset.brand && asset.brand.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (asset.modelNumber && asset.modelNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (asset.assignedTo && asset.assignedTo.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (asset.location && asset.location.toLowerCase().includes(searchQuery.toLowerCase()));

      // Category
      const categoryMatch = selectedCategory === 'all' || asset.category === selectedCategory;

      // Status
      const statusMatch = selectedStatus === 'all' || asset.status === selectedStatus;

      // Condition
      const conditionMatch = selectedCondition === 'all' || asset.condition === selectedCondition;

      return searchMatch && categoryMatch && statusMatch && conditionMatch;
    });
  }, [assets, searchQuery, selectedCategory, selectedStatus, selectedCondition]);

  // Financial Metrics
  const totalValuation = useMemo(() => {
    return assets.reduce((sum, item) => sum + (Number(item.currentValue) || Number(item.purchasePrice) || 0), 0);
  }, [assets]);

  const totalCost = useMemo(() => {
    return assets.reduce((sum, item) => sum + (Number(item.purchasePrice) || 0), 0);
  }, [assets]);

  const inUseCount = useMemo(() => {
    return assets.filter((a) => a.status === 'in_use').length;
  }, [assets]);

  const maintenanceCount = useMemo(() => {
    return assets.filter((a) => a.status === 'maintenance' || a.condition === 'damaged').length;
  }, [assets]);

  const getStatusBadge = (status: CompanyAsset['status']) => {
    switch (status) {
      case 'active':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>Available</span>;
      case 'in_use':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20"><span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse"></span>In Use / On Shoot</span>;
      case 'maintenance':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20"><Wrench className="h-3 w-3" />Maintenance</span>;
      case 'reserved':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/10 text-purple-600 border border-purple-500/20"><Clock className="h-3 w-3" />Reserved</span>;
      case 'disposed':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-zinc-500/10 text-zinc-500 border border-zinc-500/20"><Archive className="h-3 w-3" />Retired</span>;
      default:
        return null;
    }
  };

  const getConditionBadge = (condition: CompanyAsset['condition']) => {
    switch (condition) {
      case 'excellent':
        return <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-md">Excellent</span>;
      case 'good':
        return <span className="text-[10px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/30 px-2 py-0.5 rounded-md">Good</span>;
      case 'fair':
        return <span className="text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-md">Fair</span>;
      case 'damaged':
        return <span className="text-[10px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/30 px-2 py-0.5 rounded-md">Needs Repair</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Action Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-5 rounded-2xl border border-border shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-xl bg-orange-600 text-white flex items-center justify-center shadow-md">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-foreground tracking-tight">Company Asset Registry</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Master inventory of cameras, sound equipment, lighting, production vehicles, IT gear, and company property.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {assets.length === 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSeedSampleAssets}
              disabled={isSeeding}
              className="text-xs font-bold border-orange-500/40 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/20"
            >
              <Sparkles className="h-3.5 w-3.5 mr-1 text-orange-600" />
              {isSeeding ? 'Seeding...' : 'Seed Sample Gear'}
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="text-xs font-bold border-border hover:bg-muted"
          >
            <Download className="h-3.5 w-3.5 mr-1" />
            Export CSV
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsAuditReportModalOpen(true)}
            className="text-xs font-bold border-border hover:bg-muted"
          >
            <Printer className="h-3.5 w-3.5 mr-1" />
            Audit Report
          </Button>

          <Button
            type="button"
            onClick={() => handleOpenRegister()}
            className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Register New Asset
          </Button>
        </div>
      </div>

      {/* KPI Overview Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4 space-y-1">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
              Total Assets
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-foreground font-mono">{assets.length}</span>
              <Package className="h-5 w-5 text-orange-600/70" />
            </div>
            <p className="text-[10px] text-muted-foreground">Registered physical equipment</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4 space-y-1">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
              Total Valuation
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-emerald-600 font-mono">
                GH₵ {totalValuation.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
              <DollarSign className="h-5 w-5 text-emerald-600/70" />
            </div>
            <p className="text-[10px] text-muted-foreground">Original cost: GH₵ {totalCost.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4 space-y-1">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
              In Production
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-blue-600 font-mono">{inUseCount}</span>
              <Camera className="h-5 w-5 text-blue-600/70" />
            </div>
            <p className="text-[10px] text-muted-foreground">Currently on-shoot or deployed</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4 space-y-1">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
              Maintenance / Alerts
            </span>
            <div className="flex items-baseline justify-between">
              <span className={`text-2xl font-black font-mono ${maintenanceCount > 0 ? 'text-amber-600' : 'text-foreground'}`}>
                {maintenanceCount}
              </span>
              <Wrench className={`h-5 w-5 ${maintenanceCount > 0 ? 'text-amber-600' : 'text-muted-foreground'}`} />
            </div>
            <p className="text-[10px] text-muted-foreground">Items needing service or repair</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-card p-4 rounded-2xl border border-border shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by asset name, tag (e.g. GREFAS-CAM), serial number, brand, or custodian..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 text-xs bg-background border-border"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="h-10 px-3 text-xs rounded-xl bg-background border border-border text-foreground font-medium focus:outline-hidden"
            >
              <option value="all">All Categories ({assets.length})</option>
              {ASSET_CATEGORIES.map((cat) => (
                <option key={cat.name} value={cat.name}>{cat.name}</option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="h-10 px-3 text-xs rounded-xl bg-background border border-border text-foreground font-medium focus:outline-hidden"
            >
              <option value="all">All Statuses</option>
              <option value="active">Available / In Vault</option>
              <option value="in_use">In Use / On Shoot</option>
              <option value="maintenance">Under Maintenance</option>
              <option value="reserved">Reserved for Shoot</option>
              <option value="disposed">Retired / Disposed</option>
            </select>

            {/* Condition Filter */}
            <select
              value={selectedCondition}
              onChange={(e) => setSelectedCondition(e.target.value)}
              className="h-10 px-3 text-xs rounded-xl bg-background border border-border text-foreground font-medium focus:outline-hidden"
            >
              <option value="all">All Conditions</option>
              <option value="excellent">Excellent</option>
              <option value="good">Good</option>
              <option value="fair">Fair</option>
              <option value="damaged">Damaged / Needs Repair</option>
            </select>

            {/* View Mode Toggle */}
            <div className="flex items-center border border-border rounded-xl p-0.5 bg-muted/40">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-card text-orange-600 shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
                title="Grid View"
              >
                <Grid className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg transition-all ${viewMode === 'table' ? 'bg-card text-orange-600 shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
                title="Table View"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Active Filter Pills Indicator */}
        {(selectedCategory !== 'all' || selectedStatus !== 'all' || selectedCondition !== 'all' || searchQuery) && (
          <div className="flex items-center gap-2 pt-2 border-t border-border/50 text-xs text-muted-foreground flex-wrap">
            <span>Showing {filteredAssets.length} of {assets.length} items</span>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
                setSelectedStatus('all');
                setSelectedCondition('all');
              }}
              className="text-orange-600 font-bold hover:underline ml-auto"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Main Asset Listing Display */}
      {loading ? (
        <div className="py-16 text-center space-y-3">
          <RefreshCw className="h-8 w-8 animate-spin text-orange-600 mx-auto" />
          <p className="text-xs text-muted-foreground">Loading company asset records...</p>
        </div>
      ) : filteredAssets.length === 0 ? (
        <Card className="bg-card border-border p-12 text-center space-y-4">
          <div className="h-16 w-16 rounded-2xl bg-orange-500/10 text-orange-600 mx-auto flex items-center justify-center">
            <Package className="h-8 w-8" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">No assets found</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
              {assets.length === 0 
                ? 'Your company equipment and asset inventory is currently empty. Register your first cinema camera, lighting gear, vehicle, or studio equipment.'
                : 'No items match your active filters or search terms. Try adjusting your search query.'}
            </p>
          </div>
          <div className="flex items-center justify-center gap-3">
            {assets.length === 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={handleSeedSampleAssets}
                disabled={isSeeding}
                className="text-xs font-bold border-orange-500/40 text-orange-600"
              >
                <Sparkles className="h-3.5 w-3.5 mr-1" /> Load Sample Studio Gear
              </Button>
            )}
            <Button
              type="button"
              onClick={() => handleOpenRegister()}
              className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs"
            >
              <Plus className="h-4 w-4 mr-1" /> Register First Asset
            </Button>
          </div>
        </Card>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredAssets.map((asset) => (
            <Card key={asset.id} className="bg-card border-border overflow-hidden hover:shadow-md transition-shadow group flex flex-col">
              {/* Asset Photo & Badges */}
              <div className="relative h-44 bg-muted/40 overflow-hidden border-b border-border">
                {asset.imageUrl ? (
                  <img
                    src={asset.imageUrl}
                    alt={asset.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/50">
                    <Package className="h-10 w-10 mb-1" />
                    <span className="text-[10px]">No photo uploaded</span>
                  </div>
                )}

                {/* Status & Condition Top Badges */}
                <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-1">
                  <span className="bg-black/80 backdrop-blur-md text-white font-mono font-black text-[11px] px-2.5 py-1 rounded-lg border border-white/10 shadow-sm">
                    {asset.assetTag}
                  </span>
                  <div>{getStatusBadge(asset.status)}</div>
                </div>

                {/* Category Pill Bottom */}
                <div className="absolute bottom-2 left-3">
                  <span className="bg-background/90 backdrop-blur-md text-foreground text-[10px] font-bold px-2 py-0.5 rounded-md border border-border shadow-xs">
                    {asset.category}
                  </span>
                </div>
              </div>

              {/* Card Body */}
              <CardContent className="p-4 space-y-3 flex-1 flex flex-col">
                <div>
                  <h3 className="font-extrabold text-sm text-foreground line-clamp-1 group-hover:text-orange-600 transition-colors">
                    {asset.name}
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                    {asset.brand} {asset.modelNumber ? `• ${asset.modelNumber}` : ''}
                    {asset.serialNumber ? ` (SN: ${asset.serialNumber})` : ''}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs py-2 border-y border-border/60">
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block">Assessed Value</span>
                    <span className="font-mono font-black text-emerald-600 text-sm">
                      GH₵ {(asset.currentValue || asset.purchasePrice || 0).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block">Condition</span>
                    <div className="mt-0.5">{getConditionBadge(asset.condition)}</div>
                  </div>
                </div>

                <div className="space-y-1 text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-1.5 truncate">
                    <User className="h-3 w-3 text-orange-600 shrink-0" />
                    <span className="truncate">Custodian: <strong className="text-foreground">{asset.assignedTo || 'Unassigned'}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5 truncate">
                    <MapPin className="h-3 w-3 text-orange-600 shrink-0" />
                    <span className="truncate">Storage: {asset.location || 'Nyinahin Studio'}</span>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="pt-3 mt-auto border-t border-border flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedAsset(asset);
                        setIsDetailModalOpen(true);
                      }}
                      className="h-8 px-2 text-xs font-bold text-muted-foreground hover:text-foreground"
                    >
                      <Eye className="h-3.5 w-3.5 mr-1" /> View
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedAsset(asset);
                        setIsTagPrintModalOpen(true);
                      }}
                      className="h-8 px-2 text-xs font-bold text-muted-foreground hover:text-purple-600"
                      title="Print Equipment QR Case Tag"
                    >
                      <QrCode className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenRegister(asset)}
                      className="h-8 px-2 text-xs font-bold text-muted-foreground hover:text-orange-600"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteAsset(asset)}
                      className="h-8 px-2 text-xs font-bold text-muted-foreground hover:text-rose-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        /* TABLE VIEW */
        <Card className="bg-card border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/40 border-b border-border text-muted-foreground font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-3.5">Asset Tag</th>
                  <th className="p-3.5">Name & Specs</th>
                  <th className="p-3.5">Category</th>
                  <th className="p-3.5">Current Value</th>
                  <th className="p-3.5">Condition</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Custodian</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredAssets.map((asset) => (
                  <tr key={asset.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3.5 font-mono font-black text-foreground whitespace-nowrap">
                      {asset.assetTag}
                    </td>
                    <td className="p-3.5">
                      <div className="font-extrabold text-foreground">{asset.name}</div>
                      <div className="text-[11px] text-muted-foreground truncate max-w-xs">
                        {asset.brand} {asset.modelNumber ? `• ${asset.modelNumber}` : ''}
                        {asset.serialNumber ? ` (SN: ${asset.serialNumber})` : ''}
                      </div>
                    </td>
                    <td className="p-3.5 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-md bg-muted text-[10px] font-semibold">
                        {asset.category}
                      </span>
                    </td>
                    <td className="p-3.5 font-mono font-bold text-emerald-600 whitespace-nowrap">
                      GH₵ {(asset.currentValue || asset.purchasePrice || 0).toLocaleString()}
                    </td>
                    <td className="p-3.5 whitespace-nowrap">
                      {getConditionBadge(asset.condition)}
                    </td>
                    <td className="p-3.5 whitespace-nowrap">
                      {getStatusBadge(asset.status)}
                    </td>
                    <td className="p-3.5 text-muted-foreground whitespace-nowrap">
                      {asset.assignedTo || 'Unassigned'}
                    </td>
                    <td className="p-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            setSelectedAsset(asset);
                            setIsDetailModalOpen(true);
                          }}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-purple-600"
                          onClick={() => {
                            setSelectedAsset(asset);
                            setIsTagPrintModalOpen(true);
                          }}
                        >
                          <QrCode className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-orange-600"
                          onClick={() => handleOpenRegister(asset)}
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-rose-600"
                          onClick={() => handleDeleteAsset(asset)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* REGISTER / EDIT ASSET MODAL */}
      <Dialog open={isRegisterModalOpen} onOpenChange={setIsRegisterModalOpen}>
        <DialogContent className="max-w-2xl w-full p-0 overflow-hidden bg-card border-border rounded-2xl shadow-2xl">
          <div className="bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 p-5 text-white border-b-2 border-orange-500">
            <h3 className="font-black text-lg">
              {editingAsset ? `Edit Asset: ${editingAsset.name}` : 'Register New Company Asset'}
            </h3>
            <p className="text-xs text-zinc-300 mt-1">
              Add equipment, cinema gear, production vehicles, IT stations, or office property to Grefas inventory ledger.
            </p>
          </div>

          <form onSubmit={handleSubmitAsset} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            {/* Tag & Name */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-4 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-foreground">
                    Asset Tag <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, assetTag: generateNewAssetTag() })}
                    className="text-[10px] text-orange-600 font-bold hover:underline"
                  >
                    Auto Generate
                  </button>
                </div>
                <Input
                  value={formData.assetTag}
                  onChange={(e) => setFormData({ ...formData, assetTag: e.target.value.toUpperCase() })}
                  placeholder="e.g. GREFAS-CAM-001"
                  className="font-mono font-bold text-xs h-9 uppercase bg-background border-border"
                  required
                />
              </div>

              <div className="sm:col-span-8 space-y-1.5">
                <label className="text-xs font-bold text-foreground">
                  Asset / Equipment Name <span className="text-red-500">*</span>
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Sony FX3 Cinema Line Full-Frame Camera"
                  className="text-xs h-9 bg-background border-border"
                  required
                />
              </div>
            </div>

            {/* Category & Brand/Model */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => {
                    const cat = e.target.value;
                    setFormData({
                      ...formData,
                      category: cat,
                      assetTag: formData.assetTag ? formData.assetTag : generateNewAssetTag(cat)
                    });
                  }}
                  className="w-full h-9 px-2 text-xs rounded-lg bg-background border border-border text-foreground"
                >
                  {ASSET_CATEGORIES.map((c) => (
                    <option key={c.name} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Brand / Manufacturer</label>
                <Input
                  value={formData.brand}
                  onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                  placeholder="e.g. Sony, Rode, Aputure, Apple"
                  className="text-xs h-9 bg-background border-border"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Model Number</label>
                <Input
                  value={formData.modelNumber}
                  onChange={(e) => setFormData({ ...formData, modelNumber: e.target.value })}
                  placeholder="e.g. ILME-FX3, A2485"
                  className="text-xs h-9 bg-background border-border"
                />
              </div>
            </div>

            {/* Serial Number & Financials */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Serial Number (SN)</label>
                <Input
                  value={formData.serialNumber}
                  onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                  placeholder="e.g. SN-84920419"
                  className="text-xs font-mono h-9 bg-background border-border"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Purchase Cost (GH₵)</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.purchasePrice || ''}
                  onChange={(e) => {
                    const cost = parseFloat(e.target.value) || 0;
                    setFormData({
                      ...formData,
                      purchasePrice: cost,
                      currentValue: formData.currentValue ? formData.currentValue : cost
                    });
                  }}
                  placeholder="0.00"
                  className="text-xs font-mono font-bold h-9 bg-background border-border"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Current Valuation (GH₵)</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.currentValue || ''}
                  onChange={(e) => setFormData({ ...formData, currentValue: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                  className="text-xs font-mono font-bold text-emerald-600 h-9 bg-background border-border"
                />
              </div>
            </div>

            {/* Dates & Supplier */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Acquisition Date</label>
                <Input
                  type="date"
                  value={formData.purchaseDate}
                  onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                  className="text-xs h-9 bg-background border-border"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Warranty Expiration</label>
                <Input
                  type="date"
                  value={formData.warrantyExpiry}
                  onChange={(e) => setFormData({ ...formData, warrantyExpiry: e.target.value })}
                  className="text-xs h-9 bg-background border-border"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Vendor / Supplier</label>
                <Input
                  value={formData.vendorOrSupplier}
                  onChange={(e) => setFormData({ ...formData, vendorOrSupplier: e.target.value })}
                  placeholder="e.g. Compu-Ghana, Adorama, Melcom"
                  className="text-xs h-9 bg-background border-border"
                />
              </div>
            </div>

            {/* Location & Custodian */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Storage Location / Studio Room</label>
                <Input
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="e.g. Nyinahin Studio - Gear Vault A1"
                  className="text-xs h-9 bg-background border-border"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Assigned Custodian / Staff Member</label>
                <Input
                  value={formData.assignedTo}
                  onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                  placeholder="e.g. Kofi Mensah (Cinematographer) or Unassigned"
                  className="text-xs h-9 bg-background border-border"
                />
              </div>
            </div>

            {/* Status & Condition */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Deployment Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full h-9 px-2 text-xs rounded-lg bg-background border border-border text-foreground"
                >
                  <option value="active">Available / In Vault</option>
                  <option value="in_use">In Use / On Shoot</option>
                  <option value="maintenance">Under Maintenance / Repair</option>
                  <option value="reserved">Reserved for Upcoming Shoot</option>
                  <option value="disposed">Retired / Disposed</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Physical & Operational Condition</label>
                <select
                  value={formData.condition}
                  onChange={(e) => setFormData({ ...formData, condition: e.target.value as any })}
                  className="w-full h-9 px-2 text-xs rounded-lg bg-background border border-border text-foreground"
                >
                  <option value="excellent">Excellent (Like new, pristine optics/body)</option>
                  <option value="good">Good (Fully functional, normal minor wear)</option>
                  <option value="fair">Fair (Noticeable cosmetic marks, fully works)</option>
                  <option value="damaged">Needs Repair / Damaged</option>
                </select>
              </div>
            </div>

            {/* Photo URL & Quick Presets */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-foreground">Asset Photo URL</label>
              <Input
                value={formData.imageUrl}
                onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                placeholder="https://... photo link of the equipment"
                className="text-xs h-9 bg-background border-border"
              />
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-muted-foreground">Quick Presets:</span>
                {PRESET_GEAR_IMAGES.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => setFormData({ ...formData, imageUrl: preset.url })}
                    className="text-[10px] px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-foreground border border-border"
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes & Included Accessories */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Accessories Included & Technical Notes</label>
              <Textarea
                rows={3}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="List cables, cages, chargers, flight cases, license keys, or special operating notes..."
                className="text-xs bg-background border-border"
              />
            </div>

            <DialogFooter className="pt-4 border-t border-border flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsRegisterModalOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs"
              >
                {isSubmitting ? 'Saving...' : editingAsset ? 'Update Asset Record' : 'Complete Registration'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ASSET DETAIL DOSSIER MODAL */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="max-w-xl w-full p-0 overflow-hidden bg-card border-border rounded-2xl shadow-2xl">
          {selectedAsset && (
            <div>
              <div className="bg-gradient-to-r from-zinc-900 to-zinc-800 p-5 text-white flex items-center justify-between border-b-2 border-orange-500">
                <div>
                  <span className="text-[10px] font-mono font-bold tracking-widest text-orange-400 uppercase">
                    Asset Dossier
                  </span>
                  <h3 className="font-black text-lg">{selectedAsset.name}</h3>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold bg-white/10 px-2.5 py-1 rounded-md text-xs">
                    {selectedAsset.assetTag}
                  </span>
                </div>
              </div>

              <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
                {/* Photo & Key Metric Banner */}
                {selectedAsset.imageUrl && (
                  <div className="h-48 w-full rounded-xl overflow-hidden bg-muted/40 border border-border">
                    <img src={selectedAsset.imageUrl} alt={selectedAsset.name} className="w-full h-full object-cover" />
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/30 p-3.5 rounded-xl border border-border text-center">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">Current Value</span>
                    <span className="font-mono font-black text-emerald-600 text-base">
                      GH₵ {(selectedAsset.currentValue || selectedAsset.purchasePrice || 0).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">Purchase Cost</span>
                    <span className="font-mono font-bold text-foreground text-sm">
                      GH₵ {(selectedAsset.purchasePrice || 0).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">Condition</span>
                    <div className="mt-1">{getConditionBadge(selectedAsset.condition)}</div>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">Status</span>
                    <div className="mt-1">{getStatusBadge(selectedAsset.status)}</div>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1 p-3 rounded-lg border border-border bg-background">
                    <span className="text-muted-foreground font-semibold">Category:</span>
                    <p className="font-bold text-foreground">{selectedAsset.category}</p>
                  </div>
                  <div className="space-y-1 p-3 rounded-lg border border-border bg-background">
                    <span className="text-muted-foreground font-semibold">Brand & Model:</span>
                    <p className="font-bold text-foreground">{selectedAsset.brand || 'N/A'} {selectedAsset.modelNumber ? `(${selectedAsset.modelNumber})` : ''}</p>
                  </div>
                  <div className="space-y-1 p-3 rounded-lg border border-border bg-background">
                    <span className="text-muted-foreground font-semibold">Hardware Serial Number:</span>
                    <p className="font-mono font-bold text-foreground">{selectedAsset.serialNumber || 'N/A'}</p>
                  </div>
                  <div className="space-y-1 p-3 rounded-lg border border-border bg-background">
                    <span className="text-muted-foreground font-semibold">Assigned Custodian:</span>
                    <p className="font-bold text-foreground">{selectedAsset.assignedTo || 'Unassigned / In Vault'}</p>
                  </div>
                  <div className="space-y-1 p-3 rounded-lg border border-border bg-background">
                    <span className="text-muted-foreground font-semibold">Physical Storage Location:</span>
                    <p className="font-bold text-foreground">{selectedAsset.location || 'Nyinahin Studio'}</p>
                  </div>
                  <div className="space-y-1 p-3 rounded-lg border border-border bg-background">
                    <span className="text-muted-foreground font-semibold">Acquisition Date:</span>
                    <p className="font-bold text-foreground">{selectedAsset.purchaseDate || 'N/A'}</p>
                  </div>
                  <div className="space-y-1 p-3 rounded-lg border border-border bg-background">
                    <span className="text-muted-foreground font-semibold">Vendor / Supplier:</span>
                    <p className="font-bold text-foreground">{selectedAsset.vendorOrSupplier || 'N/A'}</p>
                  </div>
                  <div className="space-y-1 p-3 rounded-lg border border-border bg-background">
                    <span className="text-muted-foreground font-semibold">Warranty Expiration:</span>
                    <p className="font-bold text-foreground">{selectedAsset.warrantyExpiry || 'N/A'}</p>
                  </div>
                </div>

                {/* Notes */}
                {selectedAsset.notes && (
                  <div className="p-3.5 rounded-xl bg-orange-50/50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/40 text-xs space-y-1">
                    <span className="font-bold text-orange-950 dark:text-orange-200">Accessories & Technical Notes:</span>
                    <p className="text-muted-foreground leading-relaxed">{selectedAsset.notes}</p>
                  </div>
                )}

                {/* Quick Status Bar */}
                <div className="pt-2 border-t border-border flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-bold text-foreground">Change Status:</span>
                  <div className="flex items-center gap-1.5">
                    {(['active', 'in_use', 'maintenance', 'reserved', 'disposed'] as const).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => {
                          handleQuickStatusChange(selectedAsset.id, st);
                          setSelectedAsset({ ...selectedAsset, status: st });
                        }}
                        className={`text-[10px] px-2 py-1 rounded font-bold capitalize transition-all ${
                          selectedAsset.status === st
                            ? 'bg-orange-600 text-white shadow-xs'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                        }`}
                      >
                        {st.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-4 bg-muted/30 border-t border-border flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsDetailModalOpen(false)}
                  className="text-xs"
                >
                  Close
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsDetailModalOpen(false);
                      setIsTagPrintModalOpen(true);
                    }}
                    className="text-xs font-bold"
                  >
                    <QrCode className="h-3.5 w-3.5 mr-1" /> Print Case Tag
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setIsDetailModalOpen(false);
                      handleOpenRegister(selectedAsset);
                    }}
                    className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold"
                  >
                    <Edit3 className="h-3.5 w-3.5 mr-1" /> Edit Asset
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* PRINTABLE ASSET CASE STICKER / QR TAG MODAL */}
      <Dialog open={isTagPrintModalOpen} onOpenChange={setIsTagPrintModalOpen}>
        <DialogContent className="max-w-md w-full p-6 bg-card border-border rounded-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <QrCode className="h-4 w-4 text-orange-600" /> Printable Equipment Asset Sticker
            </DialogTitle>
            <DialogDescription className="text-xs">
              Attach this barcode/tag label to flight cases, camera bags, and gear bodies for scanning and audit verification.
            </DialogDescription>
          </DialogHeader>

          {selectedAsset && (
            <div className="my-4 space-y-4">
              {/* The Physical Sticker Box */}
              <div 
                id="asset-sticker-print"
                className="p-5 rounded-2xl border-2 border-dashed border-zinc-900 dark:border-white bg-white text-black shadow-lg space-y-3"
              >
                <div className="flex items-center justify-between border-b-2 border-black pb-2">
                  <div>
                    <h4 className="font-black text-sm uppercase tracking-tight text-black">
                      GREFAS ENTERTAINMENT & CONSULT
                    </h4>
                    <span className="text-[10px] font-bold text-zinc-600 block">
                      OFFICIAL COMPANY PROPERTY • NYINAHIN-ASHANTI
                    </span>
                  </div>
                  <div className="h-7 w-7 rounded-md bg-black text-white flex items-center justify-center font-black text-xs">
                    G
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-500 block">
                      ASSET IDENTIFIER TAG
                    </span>
                    <div className="text-2xl font-black font-mono tracking-tight text-black">
                      {selectedAsset.assetTag}
                    </div>
                    <p className="font-extrabold text-xs text-black truncate max-w-[200px]">
                      {selectedAsset.name}
                    </p>
                    <p className="text-[10px] font-mono text-zinc-700">
                      SN: {selectedAsset.serialNumber || 'N/A'}
                    </p>
                  </div>

                  {/* QR Code representation */}
                  <div className="p-2 rounded-xl bg-zinc-100 border border-zinc-300 flex flex-col items-center justify-center shrink-0">
                    <QrCode className="h-16 w-16 text-black" />
                    <span className="text-[8px] font-mono font-bold mt-0.5">SCAN TAG</span>
                  </div>
                </div>

                <div className="border-t border-zinc-200 pt-2 flex items-center justify-between text-[9px] text-zinc-600 font-bold uppercase">
                  <span>Location: {selectedAsset.location || 'Studio Vault'}</span>
                  <span>Category: {selectedAsset.category}</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsTagPrintModalOpen(false)}
                  className="text-xs"
                >
                  Close
                </Button>
                <Button
                  size="sm"
                  onClick={() => window.print()}
                  className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs flex items-center gap-1.5"
                >
                  <Printer className="h-3.5 w-3.5" /> Print Tag Label
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* AUDIT REPORT MODAL */}
      <Dialog open={isAuditReportModalOpen} onOpenChange={setIsAuditReportModalOpen}>
        <DialogContent className="max-w-3xl w-full p-6 bg-card border-border rounded-2xl shadow-2xl max-h-[85vh] overflow-y-auto">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <h3 className="font-black text-xl text-foreground">Grefas Corporate Asset Audit Statement</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Official inventory and valuation certificate as of {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => window.print()}
              className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs"
            >
              <Printer className="h-3.5 w-3.5 mr-1" /> Print Report
            </Button>
          </div>

          <div className="space-y-4 py-3">
            <div className="grid grid-cols-3 gap-3 p-3.5 rounded-xl bg-muted/40 border border-border text-center text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Total Assets Audited</span>
                <span className="font-mono font-black text-lg text-foreground">{assets.length} items</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Total Valuation</span>
                <span className="font-mono font-black text-lg text-emerald-600">GH₵ {totalValuation.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Historical Purchase Cost</span>
                <span className="font-mono font-black text-lg text-foreground">GH₵ {totalCost.toLocaleString()}</span>
              </div>
            </div>

            <table className="w-full text-xs text-left">
              <thead className="bg-muted border-b border-border font-bold">
                <tr>
                  <th className="p-2">Tag</th>
                  <th className="p-2">Asset Name</th>
                  <th className="p-2">Category</th>
                  <th className="p-2">Current Value</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Custodian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {assets.map((a) => (
                  <tr key={a.id}>
                    <td className="p-2 font-mono font-bold">{a.assetTag}</td>
                    <td className="p-2 font-semibold">{a.name}</td>
                    <td className="p-2 text-muted-foreground">{a.category}</td>
                    <td className="p-2 font-mono font-bold text-emerald-600">GH₵ {(a.currentValue || a.purchasePrice || 0).toLocaleString()}</td>
                    <td className="p-2 capitalize">{a.status.replace('_', ' ')}</td>
                    <td className="p-2">{a.assignedTo || 'Vault'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
