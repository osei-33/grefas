import { getServicePricing, ServicePricingBreakdown } from './servicePricing';

export type PhotographyPackageTier = 'basic' | 'secondary' | 'tertiary' | string;

export interface PhotographySampleMedia {
  id: string;
  type: 'image' | 'video';
  url: string;
  thumbnailUrl?: string;
  title?: string;
  caption?: string;
  addedAt?: string;
}

export interface PhotographyPackage {
  id: string;
  tier: PhotographyPackageTier;
  tierLabel?: string;
  title: string;
  description: string;
  imageCount: number;
  videoCount: number;
  price: number;
  isNegotiable: boolean;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  discountPercent: number;
  discountAmount: number;
  discountLabel: string;
  deliverables: string[];
  sampleMedia: PhotographySampleMedia[];
  isActive: boolean;
  isDeleted?: boolean;
  order: number;
  createdAt?: any;
  updatedAt?: string;
}

export const DEFAULT_PHOTOGRAPHY_PACKAGES: PhotographyPackage[] = [
  {
    id: 'photo-pkg-basic',
    tier: 'basic',
    tierLabel: 'Basic',
    title: 'Basic Studio & Session Coverage',
    description:
      'Essential single-camera photography and highlight video coverage tailored for portraits, birthdays, intimate gatherings, and digital promos.',
    imageCount: 15,
    videoCount: 1,
    price: 600,
    isNegotiable: true,
    discountType: 'percentage',
    discountValue: 0,
    discountPercent: 0,
    discountAmount: 0,
    discountLabel: '',
    deliverables: [
      'Up to 2 hours on-location or studio shoot',
      'Color-graded high-resolution digital photo gallery',
      '1 edited short-form highlight reel (HD/4K)',
      'Fast digital cloud delivery link',
    ],
    sampleMedia: [],
    isActive: true,
    order: 1,
  },
  {
    id: 'photo-pkg-secondary',
    tier: 'secondary',
    tierLabel: 'Secondary',
    title: 'Secondary Event & Brand Suite',
    description:
      'Expanded multi-setup photography and cinematic videography package built for corporate events, weddings, artist launches, and commercial campaigns.',
    imageCount: 40,
    videoCount: 3,
    price: 1400,
    isNegotiable: true,
    discountType: 'percentage',
    discountValue: 0,
    discountPercent: 0,
    discountAmount: 0,
    discountLabel: '',
    deliverables: [
      'Up to 5 hours multi-scene photography & cinema coverage',
      'Pro gimbal stabilization & directional audio capture',
      '3 edited videos (full recap + 2 social reels)',
      'Priority retouching & commercial usage rights',
    ],
    sampleMedia: [],
    isActive: true,
    order: 2,
  },
  {
    id: 'photo-pkg-tertiary',
    tier: 'tertiary',
    tierLabel: 'Tertiary',
    title: 'Tertiary Full Production & Cinema',
    description:
      'Flagship full-day dual-crew photography and 4K cinema videography package with lighting rig, multi-angle storytelling, and full post-production.',
    imageCount: 100,
    videoCount: 6,
    price: 2800,
    isNegotiable: true,
    discountType: 'percentage',
    discountValue: 0,
    discountPercent: 0,
    discountAmount: 0,
    discountLabel: '',
    deliverables: [
      'Full-day coverage with lead photographer & cinema director',
      '100 professionally retouched editorial & event frames',
      '6 edited video deliverables (feature cut, teasers & reels)',
      'Dedicated studio lighting & RAW archival master files',
    ],
    sampleMedia: [],
    isActive: true,
    order: 3,
  },
];

const LOCAL_DELETED_PHOTO_PKGS_KEY = 'grefas_deleted_photo_packages_v1';

export function getLocallyDeletedPhotoPackageKeys(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_DELETED_PHOTO_PKGS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((k) => String(k).trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function markPhotoPackageKeysLocallyDeleted(keys: (string | undefined | null)[]): string[] {
  const cleanKeys = keys.map((k) => (k ? String(k).trim() : '')).filter(Boolean);
  if (typeof window === 'undefined') return cleanKeys;
  try {
    const existing = new Set(getLocallyDeletedPhotoPackageKeys());
    cleanKeys.forEach((k) => {
      existing.add(k);
      existing.add(k.toLowerCase());
    });
    const next = Array.from(existing);
    window.localStorage.setItem(LOCAL_DELETED_PHOTO_PKGS_KEY, JSON.stringify(next));
    return next;
  } catch {
    return cleanKeys;
  }
}

export function unmarkPhotoPackageKeysLocallyDeleted(keys: (string | undefined | null)[]) {
  if (typeof window === 'undefined') return;
  try {
    const removeSet = new Set(
      keys
        .map((k) => (k ? String(k).trim() : ''))
        .filter(Boolean)
        .flatMap((k) => [k, k.toLowerCase()])
    );
    const remaining = getLocallyDeletedPhotoPackageKeys().filter(
      (k) => !removeSet.has(k) && !removeSet.has(k.toLowerCase())
    );
    window.localStorage.setItem(LOCAL_DELETED_PHOTO_PKGS_KEY, JSON.stringify(remaining));
  } catch {
    // ignore storage errors
  }
}

export function normalizePhotographyPackage(raw: any, fallback?: PhotographyPackage): PhotographyPackage {
  const dPercent =
    raw?.discountPercent !== undefined
      ? Number(raw.discountPercent) || 0
      : raw?.discountType === 'percentage'
      ? Number(raw.discountValue || 0)
      : fallback?.discountPercent || 0;
  const dAmount =
    raw?.discountAmount !== undefined
      ? Number(raw.discountAmount) || 0
      : raw?.discountType === 'fixed'
      ? Number(raw.discountValue || 0)
      : fallback?.discountAmount || 0;
  const dType: 'percentage' | 'fixed' =
    raw?.discountType === 'fixed' || (dAmount > 0 && dPercent === 0) ? 'fixed' : 'percentage';
  const dValue =
    raw?.discountValue !== undefined ? Number(raw.discountValue) || 0 : dType === 'fixed' ? dAmount : dPercent;

  const tier = String(raw?.tier || fallback?.tier || 'basic').trim();
  const sampleMedia: PhotographySampleMedia[] = Array.isArray(raw?.sampleMedia)
    ? raw.sampleMedia
        .filter((m: any) => m && m.url)
        .map((m: any, idx: number) => ({
          id: String(m.id || `media-${idx}-${Date.now()}`),
          type: m.type === 'video' ? 'video' : 'image',
          url: String(m.url),
          thumbnailUrl: m.thumbnailUrl ? String(m.thumbnailUrl) : '',
          title: m.title ? String(m.title) : '',
          caption: m.caption ? String(m.caption) : '',
          addedAt: m.addedAt || new Date().toISOString(),
        }))
    : fallback?.sampleMedia || [];

  const deliverables: string[] = Array.isArray(raw?.deliverables)
    ? raw.deliverables.map((d: any) => String(d).trim()).filter(Boolean)
    : fallback?.deliverables || [];

  return {
    id: String(raw?.id || fallback?.id || `pkg-${Date.now()}`),
    tier,
    tierLabel: raw?.tierLabel || fallback?.tierLabel || getTierDisplayName(tier),
    title: String(raw?.title || fallback?.title || `${getTierDisplayName(tier)} Package`),
    description: String(raw?.description ?? fallback?.description ?? ''),
    imageCount: Math.max(0, Number(raw?.imageCount !== undefined ? raw.imageCount : fallback?.imageCount ?? 0) || 0),
    videoCount: Math.max(0, Number(raw?.videoCount !== undefined ? raw.videoCount : fallback?.videoCount ?? 0) || 0),
    price: Math.max(0, Number(raw?.price !== undefined ? raw.price : fallback?.price ?? 0) || 0),
    isNegotiable:
      raw?.isNegotiable !== undefined ? Boolean(raw.isNegotiable) : fallback?.isNegotiable ?? true,
    discountType: dType,
    discountValue: dValue,
    discountPercent: dPercent,
    discountAmount: dAmount,
    discountLabel: String(raw?.discountLabel ?? fallback?.discountLabel ?? ''),
    deliverables,
    sampleMedia,
    isActive: raw?.isActive !== undefined ? Boolean(raw.isActive) : fallback?.isActive ?? true,
    isDeleted: Boolean(raw?.isDeleted),
    order: Number(raw?.order !== undefined ? raw.order : fallback?.order ?? 99) || 99,
    createdAt: raw?.createdAt || fallback?.createdAt,
    updatedAt: raw?.updatedAt || fallback?.updatedAt,
  };
}

export function getTierDisplayName(tier: string): string {
  const clean = String(tier || '').trim().toLowerCase();
  if (clean === 'basic') return 'Basic';
  if (clean === 'secondary') return 'Secondary';
  if (clean === 'tertiary') return 'Tertiary';
  return tier ? tier.charAt(0).toUpperCase() + tier.slice(1) : 'Package';
}

export function getTierSortWeight(tier: string, fallbackOrder: number = 99): number {
  const clean = String(tier || '').trim().toLowerCase();
  if (clean === 'basic') return 1;
  if (clean === 'secondary') return 2;
  if (clean === 'tertiary') return 3;
  return fallbackOrder >= 4 ? fallbackOrder : 10 + fallbackOrder;
}

/**
 * Merges Firestore photography_packages docs with canonical Basic, Secondary, Tertiary defaults
 * while respecting admin deletions and active state filters.
 */
export function mergePhotographyPackagesWithDefaults(
  firestoreDocs: any[],
  options?: { includeInactive?: boolean }
): PhotographyPackage[] {
  const includeInactive = Boolean(options?.includeInactive);
  const byId = new Map<string, any>();
  const matchedDefaultIds = new Set<string>();
  const deletedKeys = new Set<string>(
    getLocallyDeletedPhotoPackageKeys().flatMap((k) => [k, k.toLowerCase()])
  );

  for (const doc of firestoreDocs || []) {
    if (!doc) continue;
    byId.set(doc.id, doc);
    if (doc.isDeleted) {
      if (doc.id) {
        deletedKeys.add(String(doc.id));
        deletedKeys.add(String(doc.id).toLowerCase());
      }
      if (doc.tier) {
        deletedKeys.add(String(doc.tier).toLowerCase());
      }
    }
  }

  const isDeletedPkg = (item: any): boolean => {
    if (!item) return true;
    if (item.isDeleted) return true;
    const idStr = item.id ? String(item.id).trim() : '';
    if (idStr && (deletedKeys.has(idStr) || deletedKeys.has(idStr.toLowerCase()))) return true;
    return false;
  };

  const result: PhotographyPackage[] = [];

  for (const def of DEFAULT_PHOTOGRAPHY_PACKAGES) {
    let match = byId.get(def.id);
    if (!match) {
      match = (firestoreDocs || []).find(
        (d) =>
          d &&
          String(d.tier || '').trim().toLowerCase() === def.tier.toLowerCase() &&
          !d.isDeleted
      );
    }

    if (match) {
      matchedDefaultIds.add(match.id);
    }

    if (isDeletedPkg(def) || (match && isDeletedPkg(match))) {
      continue;
    }

    const normalized = match ? normalizePhotographyPackage(match, def) : { ...def };
    if (includeInactive || normalized.isActive) {
      result.push(normalized);
    }
  }

  for (const doc of firestoreDocs || []) {
    if (!doc || matchedDefaultIds.has(doc.id) || isDeletedPkg(doc)) continue;
    const normalized = normalizePhotographyPackage(doc);
    if (includeInactive || normalized.isActive) {
      result.push(normalized);
    }
  }

  return result.sort((a, b) => {
    const orderDiff = (a.order || 99) - (b.order || 99);
    if (orderDiff !== 0) return orderDiff;
    return getTierSortWeight(a.tier, a.order) - getTierSortWeight(b.tier, b.order);
  });
}

export function getPhotographyPackagePricing(pkg: PhotographyPackage): ServicePricingBreakdown {
  return getServicePricing({
    price: pkg.price,
    discountType: pkg.discountType,
    discountValue: pkg.discountValue,
    discountPercent: pkg.discountPercent,
    discountAmount: pkg.discountAmount,
    discountLabel: pkg.discountLabel,
    isNegotiable: pkg.isNegotiable,
  });
}

export interface ParsedVideoInfo {
  kind: 'youtube' | 'vimeo' | 'direct';
  embedUrl: string;
  thumbnailUrl?: string;
}

export function parseVideoEmbedUrl(rawUrl: string): ParsedVideoInfo {
  const url = String(rawUrl || '').trim();
  if (!url) {
    return { kind: 'direct', embedUrl: '' };
  }

  // YouTube standard, share, shorts, embed
  const ytMatch = url.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/
  );
  if (ytMatch && ytMatch[1]) {
    const videoId = ytMatch[1];
    return {
      kind: 'youtube',
      embedUrl: `https://www.youtube.com/embed/${videoId}?rel=0`,
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    };
  }

  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeoMatch && vimeoMatch[1]) {
    return {
      kind: 'vimeo',
      embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}`,
    };
  }

  return {
    kind: 'direct',
    embedUrl: url,
  };
}

export function estimateMediaPayloadKb(sampleMedia: PhotographySampleMedia[]): number {
  try {
    const bytes = new Blob([JSON.stringify(sampleMedia || [])]).size;
    return Math.round(bytes / 1024);
  } catch {
    return 0;
  }
}
