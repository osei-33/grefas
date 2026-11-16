import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage, handleFirestoreError, OperationType } from '@/firebase';
import { compressImage, blobToBase64 } from '@/lib/utils';
import { logAuditActivity } from '@/lib/auditLogger';
import {
  PhotographyPackage,
  PhotographySampleMedia,
  DEFAULT_PHOTOGRAPHY_PACKAGES,
  mergePhotographyPackagesWithDefaults,
  getPhotographyPackagePricing,
  getTierDisplayName,
  parseVideoEmbedUrl,
  estimateMediaPayloadKb,
  markPhotoPackageKeysLocallyDeleted,
  unmarkPhotoPackageKeysLocallyDeleted,
} from '@/lib/photographyPackages';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  Camera,
  Video,
  Image as ImageIcon,
  Plus,
  Edit,
  Trash2,
  Handshake,
  Percent,
  Tag,
  Upload,
  Link2,
  Play,
  Loader2,
  Eye,
  EyeOff,
  Save,
  X,
  CheckCircle2,
  RotateCcw,
  Film,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';

interface PackageFormState {
  id?: string;
  tier: string;
  customTierName: string;
  title: string;
  description: string;
  imageCount: number;
  videoCount: number;
  price: number;
  isNegotiable: boolean;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  discountLabel: string;
  deliverablesText: string;
  sampleMedia: PhotographySampleMedia[];
  isActive: boolean;
  order: number;
}

const createEmptyForm = (tier: string = 'basic'): PackageFormState => ({
  tier,
  customTierName: '',
  title: '',
  description: '',
  imageCount: tier === 'basic' ? 15 : tier === 'secondary' ? 40 : 80,
  videoCount: tier === 'basic' ? 1 : tier === 'secondary' ? 3 : 5,
  price: tier === 'basic' ? 600 : tier === 'secondary' ? 1400 : 2800,
  isNegotiable: true,
  discountType: 'percentage',
  discountValue: 0,
  discountLabel: '',
  deliverablesText: '',
  sampleMedia: [],
  isActive: true,
  order: tier === 'basic' ? 1 : tier === 'secondary' ? 2 : tier === 'tertiary' ? 3 : 4,
});

export default function ManagePhotographyPackages() {
  const [rawPackages, setRawPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PackageFormState>(createEmptyForm('basic'));
  const [isSaving, setIsSaving] = useState(false);

  // Sample media composer state inside form
  const [mediaTab, setMediaTab] = useState<'image' | 'video'>('image');
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [imageTitleInput, setImageTitleInput] = useState('');
  const [videoUrlInput, setVideoUrlInput] = useState('');
  const [videoThumbInput, setVideoThumbInput] = useState('');
  const [videoTitleInput, setVideoTitleInput] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [videoUploadProgress, setVideoUploadProgress] = useState(0);

  // Delete confirmation modal state
  const [deleteTarget, setDeleteTarget] = useState<PhotographyPackage | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Quick preview lightbox
  const [previewMedia, setPreviewMedia] = useState<PhotographySampleMedia | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'photography_packages'),
      (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setRawPackages(docs);
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        console.error('Error listening to photography_packages:', err);
      }
    );
    return () => unsub();
  }, []);

  const packages = useMemo(
    () => mergePhotographyPackagesWithDefaults(rawPackages, { includeInactive: true }),
    [rawPackages]
  );

  const formPricingPreview = useMemo(() => {
    const dPercent = form.discountType === 'percentage' ? Number(form.discountValue || 0) : 0;
    const dAmount = form.discountType === 'fixed' ? Number(form.discountValue || 0) : 0;
    return getPhotographyPackagePricing({
      id: editingId || 'preview',
      tier: form.tier,
      title: form.title || 'Package',
      description: form.description,
      imageCount: Number(form.imageCount) || 0,
      videoCount: Number(form.videoCount) || 0,
      price: Number(form.price) || 0,
      isNegotiable: form.isNegotiable,
      discountType: form.discountType,
      discountValue: Number(form.discountValue) || 0,
      discountPercent: dPercent,
      discountAmount: dAmount,
      discountLabel: form.discountLabel,
      deliverables: [],
      sampleMedia: [],
      isActive: true,
      order: 1,
    });
  }, [form, editingId]);

  const estimatedKb = useMemo(() => estimateMediaPayloadKb(form.sampleMedia), [form.sampleMedia]);

  const openCreateForm = (presetTier: 'basic' | 'secondary' | 'tertiary' | 'custom' = 'basic') => {
    setEditingId(null);
    setForm(createEmptyForm(presetTier));
    setIsFormOpen(true);
  };

  const openEditForm = (pkg: PhotographyPackage) => {
    const isStandardTier = ['basic', 'secondary', 'tertiary'].includes(
      String(pkg.tier || '').toLowerCase()
    );
    setEditingId(pkg.id);
    setForm({
      id: pkg.id,
      tier: isStandardTier ? String(pkg.tier).toLowerCase() : 'custom',
      customTierName: isStandardTier ? '' : pkg.tierLabel || pkg.tier,
      title: pkg.title || '',
      description: pkg.description || '',
      imageCount: Number(pkg.imageCount) || 0,
      videoCount: Number(pkg.videoCount) || 0,
      price: Number(pkg.price) || 0,
      isNegotiable: Boolean(pkg.isNegotiable),
      discountType: pkg.discountType === 'fixed' ? 'fixed' : 'percentage',
      discountValue:
        pkg.discountType === 'fixed'
          ? Number(pkg.discountAmount || pkg.discountValue || 0)
          : Number(pkg.discountPercent || pkg.discountValue || 0),
      discountLabel: pkg.discountLabel || '',
      deliverablesText: (pkg.deliverables || []).join('\n'),
      sampleMedia: Array.isArray(pkg.sampleMedia) ? [...pkg.sampleMedia] : [],
      isActive: pkg.isActive !== false,
      order: Number(pkg.order) || 1,
    });
    setIsFormOpen(true);
  };

  const handleUploadSampleImages = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploadingImage(true);
    try {
      const added: PhotographySampleMedia[] = [];
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) {
          toast.error(`Skipped "${file.name}" (not an image file).`);
          continue;
        }
        try {
          const compressed = await compressImage(file, 850, 850, 0.72);
          const dataUrl = await blobToBase64(compressed);
          added.push({
            id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            type: 'image',
            url: dataUrl,
            title: file.name.replace(/\.[^/.]+$/, ''),
            addedAt: new Date().toISOString(),
          });
        } catch (err) {
          console.warn('Compression failed for image:', file.name, err);
        }
      }

      if (added.length > 0) {
        const nextMedia = [...form.sampleMedia, ...added];
        if (estimateMediaPayloadKb(nextMedia) > 850) {
          toast.warning(
            'Embedded gallery size is approaching Firestore 1MB limit. Consider removing older photos or pasting hosted image URLs.'
          );
        }
        setForm((prev) => ({ ...prev, sampleMedia: nextMedia }));
        toast.success(`Added ${added.length} previous image${added.length > 1 ? 's' : ''} to package showcase.`);
      }
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleAddImageUrl = () => {
    const cleanUrl = imageUrlInput.trim();
    if (!cleanUrl) {
      toast.error('Please enter an image URL first.');
      return;
    }
    const newItem: PhotographySampleMedia = {
      id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: 'image',
      url: cleanUrl,
      title: imageTitleInput.trim() || 'Sample Photography',
      addedAt: new Date().toISOString(),
    };
    setForm((prev) => ({ ...prev, sampleMedia: [...prev.sampleMedia, newItem] }));
    setImageUrlInput('');
    setImageTitleInput('');
    toast.success('Added previous image URL.');
  };

  const handleAddVideoUrl = () => {
    const cleanUrl = videoUrlInput.trim();
    if (!cleanUrl) {
      toast.error('Please paste a YouTube, Vimeo, or direct MP4 video link.');
      return;
    }
    const parsed = parseVideoEmbedUrl(cleanUrl);
    const newItem: PhotographySampleMedia = {
      id: `vid-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: 'video',
      url: cleanUrl,
      thumbnailUrl: videoThumbInput.trim() || parsed.thumbnailUrl || '',
      title: videoTitleInput.trim() || 'Sample Videography Reel',
      addedAt: new Date().toISOString(),
    };
    setForm((prev) => ({ ...prev, sampleMedia: [...prev.sampleMedia, newItem] }));
    setVideoUrlInput('');
    setVideoThumbInput('');
    setVideoTitleInput('');
    toast.success('Added previous video to package showcase.');
  };

  const handleUploadVideoFile = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      toast.error('Please choose a valid video file (MP4, WebM, MOV).');
      return;
    }
    if (file.size > 45 * 1024 * 1024) {
      toast.error('Direct upload supports videos up to 45MB. For larger clips, paste a YouTube/Vimeo/CDN URL.');
      return;
    }
    setIsUploadingVideo(true);
    setVideoUploadProgress(0);
    try {
      const storageRef = ref(storage, `photography_samples/${Date.now()}_${file.name.replace(/\s+/g, '_')}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      await new Promise<void>((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
            setVideoUploadProgress(pct);
          },
          (error) => reject(error),
          async () => {
            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
            const newItem: PhotographySampleMedia = {
              id: `vid-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              type: 'video',
              url: downloadUrl,
              title: videoTitleInput.trim() || file.name.replace(/\.[^/.]+$/, ''),
              addedAt: new Date().toISOString(),
            };
            setForm((prev) => ({ ...prev, sampleMedia: [...prev.sampleMedia, newItem] }));
            setVideoTitleInput('');
            toast.success('Video uploaded and attached to package.');
            resolve();
          }
        );
      });
    } catch (err: any) {
      console.error('Video storage upload failed:', err);
      toast.error(
        'Cloud video upload unavailable in current storage permissions. Please paste a YouTube, Vimeo, or direct MP4 URL instead.'
      );
    } finally {
      setIsUploadingVideo(false);
      setVideoUploadProgress(0);
    }
  };

  const handleRemoveSampleMedia = (mediaId: string) => {
    setForm((prev) => ({
      ...prev,
      sampleMedia: prev.sampleMedia.filter((m) => m.id !== mediaId),
    }));
  };

  const handleMoveSampleMedia = (index: number, direction: -1 | 1) => {
    setForm((prev) => {
      const arr = [...prev.sampleMedia];
      const nextIdx = index + direction;
      if (nextIdx < 0 || nextIdx >= arr.length) return prev;
      const [item] = arr.splice(index, 1);
      arr.splice(nextIdx, 0, item);
      return { ...prev, sampleMedia: arr };
    });
  };

  const handleSavePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    const resolvedTier =
      form.tier === 'custom'
        ? (form.customTierName.trim() || 'custom').toLowerCase().replace(/\s+/g, '_')
        : form.tier;
    const resolvedTierLabel =
      form.tier === 'custom'
        ? form.customTierName.trim() || 'Custom Package'
        : getTierDisplayName(form.tier);

    if (!form.title.trim()) {
      toast.error('Please enter a package title.');
      return;
    }

    if (estimatedKb > 950) {
      toast.error(
        'Total sample media size exceeds safe document limits (~950KB). Remove some uploaded photos or use image URLs.'
      );
      return;
    }

    setIsSaving(true);
    try {
      const cleanImageCount = Math.max(0, Math.floor(Number(form.imageCount) || 0));
      const cleanVideoCount = Math.max(0, Math.floor(Number(form.videoCount) || 0));
      const cleanPrice = Math.max(0, Number(form.price) || 0);
      const rawDiscountVal = Math.max(0, Number(form.discountValue) || 0);
      const discountPercent =
        form.discountType === 'percentage' ? Math.min(100, rawDiscountVal) : 0;
      const discountAmount = form.discountType === 'fixed' ? rawDiscountVal : 0;
      const deliverables = form.deliverablesText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

      const targetDocId =
        editingId ||
        (resolvedTier === 'basic' || resolvedTier === 'secondary' || resolvedTier === 'tertiary'
          ? `photo-pkg-${resolvedTier}-${Date.now()}`
          : `photo-pkg-${Date.now()}`);

      const payload = {
        tier: resolvedTier,
        tierLabel: resolvedTierLabel,
        title: form.title.trim(),
        description: form.description.trim(),
        imageCount: cleanImageCount,
        videoCount: cleanVideoCount,
        price: cleanPrice,
        isNegotiable: Boolean(form.isNegotiable),
        discountType: form.discountType,
        discountValue: form.discountType === 'percentage' ? discountPercent : discountAmount,
        discountPercent,
        discountAmount,
        discountLabel: form.discountLabel.trim(),
        deliverables,
        sampleMedia: form.sampleMedia,
        isActive: Boolean(form.isActive),
        isDeleted: false,
        order: Number(form.order) || 1,
        updatedAt: new Date().toISOString(),
        ...(!editingId ? { createdAt: serverTimestamp() } : {}),
      };

      await setDoc(doc(db, 'photography_packages', targetDocId), payload, { merge: true });
      unmarkPhotoPackageKeysLocallyDeleted([targetDocId, resolvedTier]);

      await logAuditActivity({
        action: editingId ? 'UPDATED_PHOTOGRAPHY_PACKAGE' : 'CREATED_PHOTOGRAPHY_PACKAGE',
        category: 'SERVICES',
        description: `${editingId ? 'Updated' : 'Created'} Photography & Videography package "${payload.title}" (${resolvedTierLabel}): ${cleanImageCount} images, ${cleanVideoCount} videos, GH₵ ${cleanPrice}.`,
        metadata: {
          packageId: targetDocId,
          tier: resolvedTier,
          imageCount: cleanImageCount,
          videoCount: cleanVideoCount,
          price: cleanPrice,
        },
      });

      toast.success(
        `${editingId ? 'Updated' : 'Created'} "${payload.title}" (${cleanImageCount} Photos, ${cleanVideoCount} Videos)!`
      );
      setIsFormOpen(false);
      setEditingId(null);
    } catch (error) {
      handleFirestoreError(
        error,
        editingId ? OperationType.UPDATE : OperationType.CREATE,
        'photography_packages'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickPatchPackage = async (
    pkg: PhotographyPackage,
    patch: Partial<PhotographyPackage>,
    successMsg?: string
  ) => {
    try {
      await setDoc(
        doc(db, 'photography_packages', pkg.id),
        {
          tier: pkg.tier,
          tierLabel: pkg.tierLabel || getTierDisplayName(pkg.tier),
          title: pkg.title,
          description: pkg.description,
          imageCount: pkg.imageCount,
          videoCount: pkg.videoCount,
          price: pkg.price,
          isNegotiable: pkg.isNegotiable,
          discountType: pkg.discountType || 'percentage',
          discountValue: pkg.discountValue || 0,
          discountPercent: pkg.discountPercent || 0,
          discountAmount: pkg.discountAmount || 0,
          discountLabel: pkg.discountLabel || '',
          deliverables: pkg.deliverables || [],
          sampleMedia: pkg.sampleMedia || [],
          isActive: pkg.isActive,
          isDeleted: false,
          order: pkg.order || 1,
          ...patch,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      toast.success(successMsg || `Updated "${pkg.title}"`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `photography_packages/${pkg.id}`);
    }
  };

  const handleDeletePackage = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const isDefault = DEFAULT_PHOTOGRAPHY_PACKAGES.some((d) => d.id === deleteTarget.id);
      markPhotoPackageKeysLocallyDeleted([deleteTarget.id]);

      if (isDefault) {
        await setDoc(
          doc(db, 'photography_packages', deleteTarget.id),
          {
            ...deleteTarget,
            isDeleted: true,
            isActive: false,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } else {
        await deleteDoc(doc(db, 'photography_packages', deleteTarget.id));
      }

      toast.success(`Removed "${deleteTarget.title}".`);
      setDeleteTarget(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `photography_packages/${deleteTarget.id}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRestoreDefaults = async () => {
    try {
      unmarkPhotoPackageKeysLocallyDeleted(DEFAULT_PHOTOGRAPHY_PACKAGES.map((d) => d.id));
      await Promise.all(
        DEFAULT_PHOTOGRAPHY_PACKAGES.map((def) =>
          setDoc(
            doc(db, 'photography_packages', def.id),
            {
              ...def,
              isDeleted: false,
              isActive: true,
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          )
        )
      );
      toast.success('Restored Basic, Secondary, and Tertiary starter packages!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'photography_packages');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div className="flex items-start gap-3">
          <div className="h-11 w-11 rounded-xl bg-orange-600/10 border border-orange-500/20 text-orange-600 flex items-center justify-center shrink-0">
            <Camera className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
              Photography &amp; Videography Packages
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">
              Create &amp; customize Basic, Secondary, and Tertiary production tiers. Set exact image &amp; video deliverables, upload previous photo/video samples, manage discounts, enable client negotiations, and process paid orders via Paystack.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {packages.length < 3 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRestoreDefaults}
              className="h-9 text-xs font-bold border-border"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Restore Default Tiers
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            onClick={() => {
              if (isFormOpen) {
                setIsFormOpen(false);
                setEditingId(null);
              } else {
                openCreateForm('custom');
              }
            }}
            className="h-9 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold cursor-pointer"
          >
            {isFormOpen ? (
              <>
                <X className="h-3.5 w-3.5 mr-1.5" /> Close Editor
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Create New Package
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Create / Edit Form */}
      {isFormOpen && (
        <Card className="border-2 border-orange-500/30 bg-card shadow-lg">
          <CardHeader className="pb-4 border-b border-border/50">
            <CardTitle className="text-base font-extrabold flex items-center gap-2">
              <Camera className="h-4 w-4 text-orange-600" />
              {editingId ? `Edit Package: ${form.title}` : 'Create Photography & Videography Package'}
            </CardTitle>
            <CardDescription className="text-xs">
              Define the tier, exact picture &amp; video counts, Paystack pricing, discounts, price negotiation toggle, and attach previous work photos or videos.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-5">
            <form onSubmit={handleSavePackage} className="space-y-6">
              {/* Row 1: Tier, Title, Order, Visibility */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-[11px] font-bold uppercase text-muted-foreground mb-1 block">
                    Package Type / Tier *
                  </label>
                  <select
                    value={form.tier}
                    onChange={(e) => {
                      const val = e.target.value;
                      setForm((prev) => ({
                        ...prev,
                        tier: val,
                        order:
                          val === 'basic'
                            ? 1
                            : val === 'secondary'
                            ? 2
                            : val === 'tertiary'
                            ? 3
                            : prev.order,
                      }));
                    }}
                    className="flex h-10 w-full rounded-md border border-border bg-muted/40 px-3 text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="basic">Basic Tier</option>
                    <option value="secondary">Secondary Tier</option>
                    <option value="tertiary">Tertiary Tier</option>
                    <option value="custom">Custom Tier...</option>
                  </select>
                  {form.tier === 'custom' && (
                    <Input
                      placeholder="e.g. Executive / VIP"
                      value={form.customTierName}
                      onChange={(e) => setForm({ ...form, customTierName: e.target.value })}
                      className="mt-2 h-9 text-xs bg-background"
                      required
                    />
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="text-[11px] font-bold uppercase text-muted-foreground mb-1 block">
                    Package Title *
                  </label>
                  <Input
                    placeholder="e.g. Secondary Event & Brand Suite"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    required
                    className="h-10 text-xs font-semibold bg-background"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-bold uppercase text-muted-foreground mb-1 block">
                      Display Order
                    </label>
                    <Input
                      type="number"
                      min={1}
                      value={form.order}
                      onChange={(e) => setForm({ ...form, order: Number(e.target.value) || 1 })}
                      className="h-10 text-xs font-mono bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold uppercase text-muted-foreground mb-1 block">
                      Status
                    </label>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, isActive: !form.isActive })}
                      className={`h-10 w-full rounded-md border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                        form.isActive
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600'
                          : 'border-border bg-muted text-muted-foreground'
                      }`}
                    >
                      {form.isActive ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      {form.isActive ? 'Visible' : 'Hidden'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Row 2: Media Deliverable Counts + Description */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 rounded-xl bg-muted/30 border border-border">
                <div className="md:col-span-3">
                  <label className="text-[11px] font-black uppercase tracking-wider text-orange-600 mb-1 flex items-center gap-1.5">
                    <ImageIcon className="h-3.5 w-3.5" /> Included Pictures *
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={form.imageCount}
                    onChange={(e) =>
                      setForm({ ...form, imageCount: Math.max(0, Number(e.target.value) || 0) })
                    }
                    required
                    className="h-10 text-sm font-mono font-black bg-background"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Edited photos client receives
                  </p>
                </div>

                <div className="md:col-span-3">
                  <label className="text-[11px] font-black uppercase tracking-wider text-orange-600 mb-1 flex items-center gap-1.5">
                    <Video className="h-3.5 w-3.5" /> Included Videos *
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={form.videoCount}
                    onChange={(e) =>
                      setForm({ ...form, videoCount: Math.max(0, Number(e.target.value) || 0) })
                    }
                    required
                    className="h-10 text-sm font-mono font-black bg-background"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Edited videos/reels included
                  </p>
                </div>

                <div className="md:col-span-6">
                  <label className="text-[11px] font-bold uppercase text-muted-foreground mb-1 block">
                    Package Description
                  </label>
                  <Textarea
                    rows={2}
                    placeholder="Describe shoot coverage, camera setup, editing turnaround..."
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="text-xs bg-background resize-none"
                  />
                </div>
              </div>

              {/* Row 3: Pricing, Discounts, Paystack & Negotiation */}
              <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-1.5">
                    <Tag className="h-3.5 w-3.5 text-orange-600" /> Paid Service Pricing, Discount &amp; Negotiation (Paystack)
                  </span>
                  <div className="text-xs font-mono font-bold text-foreground">
                    Effective Paystack Price:{' '}
                    <span className="text-emerald-600 font-black">
                      GH₵ {formPricingPreview.effectivePrice.toLocaleString()}
                    </span>
                    {formPricingPreview.hasDiscount && (
                      <span className="ml-2 text-[11px] text-muted-foreground line-through">
                        GH₵ {formPricingPreview.originalPrice.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  <div>
                    <label className="text-[10px] font-black uppercase text-muted-foreground mb-1 block">
                      Base Price (GH₵) *
                    </label>
                    <Input
                      type="number"
                      min={0}
                      step="any"
                      value={form.price}
                      onChange={(e) =>
                        setForm({ ...form, price: Math.max(0, Number(e.target.value) || 0) })
                      }
                      required
                      className="h-9 text-xs font-mono font-bold bg-background"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-muted-foreground mb-1 block">
                      Discount Type
                    </label>
                    <select
                      value={form.discountType}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          discountType: e.target.value === 'fixed' ? 'fixed' : 'percentage',
                          discountValue: 0,
                        })
                      }
                      className="flex h-9 w-full rounded-md border border-border bg-background px-2.5 text-xs font-bold text-foreground"
                    >
                      <option value="percentage">Percentage (%)</option>
                      <option value="fixed">Flat Discount (GH₵)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-muted-foreground mb-1 block">
                      {form.discountType === 'percentage' ? 'Discount (%)' : 'Discount Amount (GH₵)'}
                    </label>
                    <Input
                      type="number"
                      min={0}
                      max={form.discountType === 'percentage' ? 100 : undefined}
                      step="any"
                      value={form.discountValue}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          discountValue: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                      className="h-9 text-xs font-mono font-bold bg-background"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-muted-foreground mb-1 block">
                      Discount Label (Optional)
                    </label>
                    <Input
                      placeholder="e.g. Early Bird -15%"
                      value={form.discountLabel}
                      onChange={(e) => setForm({ ...form, discountLabel: e.target.value })}
                      className="h-9 text-xs bg-background"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-muted-foreground mb-1 block">
                      Client Price Negotiation
                    </label>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, isNegotiable: !form.isNegotiable })}
                      className={`h-9 w-full px-3 rounded-md font-bold text-xs flex items-center justify-between border transition-all cursor-pointer ${
                        form.isNegotiable
                          ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-600'
                          : 'bg-muted border-border text-muted-foreground'
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <Handshake className="h-3.5 w-3.5" />
                        {form.isNegotiable ? 'Negotiable ON' : 'Fixed Price'}
                      </span>
                      <span className="text-[10px] uppercase font-mono">
                        {form.isNegotiable ? 'ON' : 'OFF'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Row 4: Deliverables List */}
              <div>
                <label className="text-[11px] font-bold uppercase text-muted-foreground mb-1 block">
                  Package Deliverables / Highlights (One per line)
                </label>
                <Textarea
                  rows={3}
                  placeholder={`Up to 4 hours studio & outdoor session\nFull color-grading & skin retouching\nFast digital gallery delivery`}
                  value={form.deliverablesText}
                  onChange={(e) => setForm({ ...form, deliverablesText: e.target.value })}
                  className="text-xs bg-background"
                />
              </div>

              {/* Row 5: Previous Images & Videos Manager */}
              <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-1.5">
                      <Film className="h-4 w-4 text-orange-600" />
                      Previous Images &amp; Videos Showcase ({form.sampleMedia.length} attached)
                    </h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Optional: upload or link sample photos and videos from previous shoots for clients to preview before booking.
                    </p>
                  </div>
                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-1 rounded border ${
                      estimatedKb > 750
                        ? 'border-amber-500/40 bg-amber-500/10 text-amber-600'
                        : 'border-border bg-background text-muted-foreground'
                    }`}
                  >
                    Payload: {estimatedKb} KB / 950 KB
                  </span>
                </div>

                {/* Add Media Sub-tabs */}
                <div className="flex items-center gap-2 border-b border-border/60 pb-2">
                  <button
                    type="button"
                    onClick={() => setMediaTab('image')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                      mediaTab === 'image'
                        ? 'bg-orange-600 text-white'
                        : 'bg-background border border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <ImageIcon className="h-3.5 w-3.5" /> Add Previous Images
                  </button>
                  <button
                    type="button"
                    onClick={() => setMediaTab('video')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                      mediaTab === 'video'
                        ? 'bg-orange-600 text-white'
                        : 'bg-background border border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Video className="h-3.5 w-3.5" /> Add Previous Videos
                  </button>
                </div>

                {mediaTab === 'image' ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* File upload */}
                    <div className="p-3 rounded-lg border border-dashed border-border bg-background space-y-2">
                      <label className="text-[11px] font-bold text-foreground block">
                        Upload Photo File(s) from Device
                      </label>
                      <input
                        id="pkg-sample-image-upload"
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          handleUploadSampleImages(e.target.files);
                          e.target.value = '';
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        disabled={isUploadingImage}
                        onClick={() => document.getElementById('pkg-sample-image-upload')?.click()}
                        className="w-full h-9 text-xs font-bold border-orange-500/40 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/20 cursor-pointer"
                      >
                        {isUploadingImage ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                        ) : (
                          <Upload className="h-3.5 w-3.5 mr-1.5" />
                        )}
                        {isUploadingImage ? 'Compressing Photos...' : 'Select Previous Photos'}
                      </Button>
                      <p className="text-[10px] text-muted-foreground">
                        Automatically optimized &amp; compressed for fast gallery loading.
                      </p>
                    </div>

                    {/* Image URL */}
                    <div className="p-3 rounded-lg border border-border bg-background space-y-2">
                      <label className="text-[11px] font-bold text-foreground block">
                        Or Paste Hosted Image URL
                      </label>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Input
                          placeholder="https://.../photo.jpg"
                          value={imageUrlInput}
                          onChange={(e) => setImageUrlInput(e.target.value)}
                          className="h-9 text-xs flex-1"
                        />
                        <Input
                          placeholder="Caption (optional)"
                          value={imageTitleInput}
                          onChange={(e) => setImageTitleInput(e.target.value)}
                          className="h-9 text-xs sm:w-36"
                        />
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleAddImageUrl}
                          className="h-9 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-bold shrink-0 cursor-pointer"
                        >
                          <Link2 className="h-3.5 w-3.5 mr-1" /> Add
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Video URL */}
                    <div className="p-3 rounded-lg border border-border bg-background space-y-2">
                      <label className="text-[11px] font-bold text-foreground block">
                        Paste Video Link (YouTube, Vimeo, or Direct MP4/WebM)
                      </label>
                      <Input
                        placeholder="https://www.youtube.com/watch?v=... or https://.../reel.mp4"
                        value={videoUrlInput}
                        onChange={(e) => setVideoUrlInput(e.target.value)}
                        className="h-9 text-xs"
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <Input
                          placeholder="Video Title (e.g. Accra Wedding Highlights)"
                          value={videoTitleInput}
                          onChange={(e) => setVideoTitleInput(e.target.value)}
                          className="h-8 text-xs"
                        />
                        <Input
                          placeholder="Custom Thumbnail URL (optional)"
                          value={videoThumbInput}
                          onChange={(e) => setVideoThumbInput(e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleAddVideoUrl}
                        className="w-full h-9 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-bold cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5 mr-1.5" /> Attach Video Link
                      </Button>
                    </div>

                    {/* Direct video file upload */}
                    <div className="p-3 rounded-lg border border-dashed border-border bg-background space-y-2">
                      <label className="text-[11px] font-bold text-foreground block">
                        Or Upload Video File (MP4 / WebM up to 45MB)
                      </label>
                      <input
                        id="pkg-sample-video-upload"
                        type="file"
                        accept="video/mp4,video/webm,video/quicktime"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          handleUploadVideoFile(file);
                          e.target.value = '';
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        disabled={isUploadingVideo}
                        onClick={() => document.getElementById('pkg-sample-video-upload')?.click()}
                        className="w-full h-9 text-xs font-bold border-orange-500/40 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/20 cursor-pointer"
                      >
                        {isUploadingVideo ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                            Uploading Video ({videoUploadProgress}%)
                          </>
                        ) : (
                          <>
                            <Upload className="h-3.5 w-3.5 mr-1.5" /> Upload Previous Video Clip
                          </>
                        )}
                      </Button>
                      <p className="text-[10px] text-muted-foreground">
                        Stored in Firebase Cloud Storage and streamed directly inside the client lightbox.
                      </p>
                    </div>
                  </div>
                )}

                {/* Attached Sample Media Grid */}
                {form.sampleMedia.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 pt-2">
                    {form.sampleMedia.map((media, idx) => {
                      const videoMeta = media.type === 'video' ? parseVideoEmbedUrl(media.url) : null;
                      const thumbSrc =
                        media.type === 'image'
                          ? media.url
                          : media.thumbnailUrl || videoMeta?.thumbnailUrl || '';
                      return (
                        <div
                          key={media.id}
                          className="group relative rounded-lg border border-border bg-background overflow-hidden flex flex-col"
                        >
                          <div
                            onClick={() => setPreviewMedia(media)}
                            className="relative aspect-[4/3] bg-zinc-900 cursor-pointer overflow-hidden flex items-center justify-center"
                          >
                            {thumbSrc ? (
                              <img
                                src={thumbSrc}
                                alt={media.title || 'Sample media'}
                                className="h-full w-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="flex flex-col items-center justify-center text-zinc-400 gap-1">
                                <Video className="h-6 w-6" />
                                <span className="text-[9px] font-mono uppercase">Video Clip</span>
                              </div>
                            )}
                            {media.type === 'video' && (
                              <div className="absolute inset-0 bg-black/35 flex items-center justify-center">
                                <div className="h-8 w-8 rounded-full bg-orange-600 text-white flex items-center justify-center shadow-md">
                                  <Play className="h-4 w-4 ml-0.5" />
                                </div>
                              </div>
                            )}
                            <span className="absolute top-1.5 left-1.5 bg-black/75 text-white text-[9px] font-mono uppercase px-1.5 py-0.5 rounded">
                              {media.type}
                            </span>
                          </div>
                          <div className="p-2 flex items-center justify-between gap-1">
                            <span className="text-[10px] font-medium text-foreground truncate flex-1">
                              {media.title || `Sample #${idx + 1}`}
                            </span>
                            <div className="flex items-center gap-0.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleMoveSampleMedia(idx, -1)}
                                disabled={idx === 0}
                                className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer"
                                title="Move left"
                              >
                                <ArrowLeft className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveSampleMedia(idx, 1)}
                                disabled={idx === form.sampleMedia.length - 1}
                                className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer"
                                title="Move right"
                              >
                                <ArrowRight className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveSampleMedia(media.id)}
                                className="p-1 text-red-500 hover:text-red-700 cursor-pointer"
                                title="Remove sample"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground italic text-center py-3 border border-dashed border-border/70 rounded-lg bg-background/50">
                    No previous images or videos added for this package yet. Upload or link samples above if available.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-border/60">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsFormOpen(false);
                    setEditingId(null);
                  }}
                  className="text-xs font-bold h-10"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSaving}
                  className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold h-10 px-6 cursor-pointer"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> Saving Package...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-1.5" />{' '}
                      {editingId ? 'Save Package Changes' : 'Create Package'}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Package Cards Grid */}
      {loading ? (
        <div className="py-12 flex items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-orange-600" />
        </div>
      ) : packages.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-10 text-center space-y-3">
            <Camera className="h-10 w-10 text-orange-600 mx-auto" />
            <h3 className="text-base font-bold text-foreground">
              No Photography &amp; Videography Packages Configured
            </h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Create your Basic, Secondary, and Tertiary packages or restore starter tiers to customize picture counts, video counts, sample media, and pricing.
            </p>
            <div className="flex justify-center gap-2 pt-2">
              <Button size="sm" onClick={handleRestoreDefaults} variant="outline" className="text-xs font-bold">
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Load Starter Tiers
              </Button>
              <Button size="sm" onClick={() => openCreateForm('basic')} className="bg-orange-600 text-white text-xs font-bold">
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Create Package
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {packages.map((pkg) => {
            const pricing = getPhotographyPackagePricing(pkg);
            const photoSamples = pkg.sampleMedia.filter((m) => m.type === 'image');
            const videoSamples = pkg.sampleMedia.filter((m) => m.type === 'video');

            return (
              <Card
                key={pkg.id}
                className={`flex flex-col border bg-card transition-all ${
                  !pkg.isActive
                    ? 'opacity-70 border-dashed border-border'
                    : String(pkg.tier).toLowerCase() === 'secondary'
                    ? 'border-orange-500/50 shadow-sm'
                    : 'border-border'
                }`}
              >
                <CardHeader className="pb-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-black uppercase tracking-widest text-orange-600">
                      {pkg.tierLabel || getTierDisplayName(pkg.tier)} Tier
                    </span>
                    <div className="flex items-center gap-1.5 text-[10px] font-mono">
                      <span
                        className={`px-2 py-0.5 rounded font-bold uppercase ${
                          pkg.isActive
                            ? 'bg-emerald-500/10 text-emerald-600'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {pkg.isActive ? 'Active' : 'Hidden'}
                      </span>
                    </div>
                  </div>

                  <CardTitle className="text-base font-extrabold text-foreground leading-snug">
                    {pkg.title}
                  </CardTitle>
                  <CardDescription className="text-xs line-clamp-2 min-h-[32px]">
                    {pkg.description || 'Customizable photography and videography production package.'}
                  </CardDescription>
                </CardHeader>

                <CardContent className="flex-1 space-y-4">
                  {/* Counts: Pictures & Videos */}
                  <div className="grid grid-cols-2 gap-2.5 p-3 rounded-xl bg-muted/40 border border-border">
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                        <ImageIcon className="h-3 w-3 text-orange-600" /> Pictures
                      </span>
                      <p className="text-xl font-black font-mono tabular-nums text-foreground">
                        {pkg.imageCount}
                      </p>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                        <Video className="h-3 w-3 text-orange-600" /> Videos
                      </span>
                      <p className="text-xl font-black font-mono tabular-nums text-foreground">
                        {pkg.videoCount}
                      </p>
                    </div>
                  </div>

                  {/* Pricing & Discount Readout */}
                  <div className="flex items-baseline justify-between gap-2 pt-1">
                    <div>
                      {pricing.hasDiscount && (
                        <span className="text-xs line-through text-muted-foreground font-mono mr-2">
                          GH₵ {pricing.originalPrice.toLocaleString()}
                        </span>
                      )}
                      <span className="text-2xl font-black font-mono tabular-nums text-foreground">
                        GH₵ {pricing.effectivePrice.toLocaleString()}
                      </span>
                    </div>
                    {pricing.hasDiscount && (
                      <span className="text-[11px] font-bold text-emerald-600">
                        {pricing.discountBadgeText}
                      </span>
                    )}
                  </div>

                  {/* Attached Previous Media Count */}
                  <div className="flex items-center justify-between text-xs border-t border-border/60 pt-3">
                    <span className="text-muted-foreground font-medium">Previous Samples:</span>
                    <span className="font-mono font-bold text-foreground">
                      {photoSamples.length} Photo{photoSamples.length === 1 ? '' : 's'} ·{' '}
                      {videoSamples.length} Video{videoSamples.length === 1 ? '' : 's'}
                    </span>
                  </div>

                  {/* Inline Quick Controls for Negotiable & Discount */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        handleQuickPatchPackage(
                          pkg,
                          { isNegotiable: !pkg.isNegotiable },
                          `${pkg.title}: Price Negotiation ${!pkg.isNegotiable ? 'Enabled' : 'Disabled'}`
                        )
                      }
                      className={`h-8 text-[11px] font-bold cursor-pointer ${
                        pkg.isNegotiable
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600'
                          : 'border-border text-muted-foreground'
                      }`}
                    >
                      <Handshake className="h-3.5 w-3.5 mr-1" />
                      {pkg.isNegotiable ? 'Negotiable: ON' : 'Fixed Price'}
                    </Button>

                    <div className="flex items-center gap-1 bg-muted/40 border border-border rounded-md px-2 h-8">
                      <Percent className="h-3 w-3 text-orange-600 shrink-0" />
                      <select
                        value={pkg.discountType === 'percentage' ? pkg.discountPercent || 0 : 0}
                        onChange={(e) => {
                          const pct = Number(e.target.value) || 0;
                          handleQuickPatchPackage(
                            pkg,
                            {
                              discountType: 'percentage',
                              discountValue: pct,
                              discountPercent: pct,
                              discountAmount: 0,
                              discountLabel: pct > 0 ? `${pct}% OFF` : '',
                            },
                            pct > 0 ? `Applied ${pct}% discount to ${pkg.title}` : `Cleared discount on ${pkg.title}`
                          );
                        }}
                        className="bg-transparent text-[11px] font-bold text-foreground w-full focus:outline-none cursor-pointer"
                      >
                        <option value={0}>0% Discount</option>
                        <option value={5}>5% OFF</option>
                        <option value={10}>10% OFF</option>
                        <option value={15}>15% OFF</option>
                        <option value={20}>20% OFF</option>
                        <option value={25}>25% OFF</option>
                        <option value={30}>30% OFF</option>
                        <option value={40}>40% OFF</option>
                        <option value={50}>50% OFF</option>
                      </select>
                    </div>
                  </div>
                </CardContent>

                <div className="p-4 pt-0 flex items-center gap-2 border-t border-border/40 mt-2 pt-3">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => openEditForm(pkg)}
                    className="flex-1 h-8 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold cursor-pointer"
                  >
                    <Edit className="h-3.5 w-3.5 mr-1.5" /> Edit / Media ({pkg.sampleMedia.length})
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      handleQuickPatchPackage(
                        pkg,
                        { isActive: !pkg.isActive },
                        `${pkg.title} is now ${!pkg.isActive ? 'visible' : 'hidden'} on Services.`
                      )
                    }
                    className="h-8 px-2.5 text-xs cursor-pointer"
                    title={pkg.isActive ? 'Hide package from public Services page' : 'Show package'}
                  >
                    {pkg.isActive ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => setDeleteTarget(pkg)}
                    className="h-8 px-2.5 bg-red-600 hover:bg-red-700 text-white cursor-pointer"
                    title="Delete package"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Sample Preview Modal */}
      {previewMedia && (
        <div
          className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewMedia(null)}
        >
          <div
            className="bg-card border border-border rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-xs font-bold text-foreground truncate">
                {previewMedia.title || 'Sample Media Preview'}
              </span>
              <button
                type="button"
                onClick={() => setPreviewMedia(null)}
                className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="bg-black flex items-center justify-center max-h-[75vh]">
              {previewMedia.type === 'image' ? (
                <img
                  src={previewMedia.url}
                  alt={previewMedia.title || 'Preview'}
                  className="max-h-[72vh] w-auto object-contain"
                  referrerPolicy="no-referrer"
                />
              ) : (() => {
                const parsed = parseVideoEmbedUrl(previewMedia.url);
                if (parsed.kind === 'youtube' || parsed.kind === 'vimeo') {
                  return (
                    <iframe
                      src={parsed.embedUrl}
                      title={previewMedia.title || 'Video Sample'}
                      className="w-full aspect-video"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  );
                }
                return (
                  <video
                    src={parsed.embedUrl}
                    controls
                    autoPlay
                    className="max-h-[72vh] w-full"
                  />
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[9999]">
          <div className="bg-card border border-border rounded-xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-500" /> Remove Package?
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to remove <strong>{deleteTarget.title}</strong>? Clients will no longer see this package on the Services page.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="text-xs font-semibold"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleDeletePackage}
                disabled={isDeleting}
                className="text-xs font-bold bg-red-600 hover:bg-red-700 text-white"
              >
                {isDeleting ? 'Removing...' : 'Confirm Remove'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
