export interface ServiceItem {
  id: string;
  title: string;
  slug?: string;
  category: string;
  description: string;
  price: number;
  iconName: string;
  color?: string;
  imageUrl?: string;
  intakeOnly?: boolean;
  isNegotiable?: boolean;
  discountType?: 'percentage' | 'fixed';
  discountValue?: number;
  discountPercent?: number;
  discountAmount?: number;
  discountLabel?: string;
  isDeleted?: boolean;
}

export interface NegotiationMessage {
  sender: 'client' | 'admin';
  senderName?: string;
  amount: number;
  note?: string;
  timestamp: string;
}

export const DEFAULT_SERVICES: ServiceItem[] = [
  {
    id: 'default-1',
    title: 'Audition Casting Form',
    slug: 'audition-casting-form',
    category: 'Entertainment',
    description: 'Official actor & crew registration for upcoming Grefas feature films, comedy skits, and commercial casting calls across Ghana.',
    price: 200,
    iconName: 'Clapperboard',
    color: 'bg-orange-100 text-orange-600',
    intakeOnly: true,
    isNegotiable: true,
    discountPercent: 0,
    discountAmount: 0,
    discountLabel: ''
  },
  {
    id: 'default-2',
    title: 'Talent Management',
    slug: 'talent-management',
    category: 'Entertainment',
    description: 'Comprehensive career representation, brand partnerships, contract negotiation, and PR positioning for actors, musicians, and creators.',
    price: 500,
    iconName: 'Star',
    color: 'bg-orange-100 text-orange-600',
    intakeOnly: true,
    isNegotiable: true,
    discountPercent: 0,
    discountAmount: 0,
    discountLabel: ''
  },
  {
    id: 'default-3',
    title: 'Business Strategy Consulting',
    slug: 'business-strategy-consulting',
    category: 'Consulting',
    description: 'Tailored corporate strategy, market entry planning, operational restructuring, and financial advisory for SMEs and enterprises.',
    price: 350,
    iconName: 'Briefcase',
    color: 'bg-orange-100 text-orange-600',
    intakeOnly: true,
    isNegotiable: true,
    discountPercent: 0,
    discountAmount: 0,
    discountLabel: ''
  },
  {
    id: 'default-4',
    title: 'Event Planning & Production',
    slug: 'event-planning-production',
    category: 'Entertainment',
    description: 'End-to-end event conceptualization, stage design, pro-audio & lighting deployment, and live multi-camera coverage.',
    price: 1500,
    iconName: 'Music',
    color: 'bg-orange-100 text-orange-600',
    intakeOnly: true,
    isNegotiable: true,
    discountPercent: 0,
    discountAmount: 0,
    discountLabel: ''
  },
  {
    id: 'default-5',
    title: 'Corporate Branding & Identity',
    slug: 'corporate-branding-identity',
    category: 'Consulting',
    description: 'Complete visual identity systems, brand guidelines, commercial video production, and digital positioning strategies.',
    price: 800,
    iconName: 'Sparkles',
    color: 'bg-orange-100 text-orange-600',
    intakeOnly: true,
    isNegotiable: true,
    discountPercent: 0,
    discountAmount: 0,
    discountLabel: ''
  }
];

/**
 * Merges Firestore service documents with the 5 canonical DEFAULT_SERVICES
 * so that all default services remain available and editable by Admin
 * alongside any custom services added to Firestore.
 */
export function mergeServicesWithDefaults(firestoreDocs: any[]): ServiceItem[] {
  const byId = new Map<string, any>();
  const matchedDefaultIds = new Set<string>();

  for (const doc of firestoreDocs) {
    if (!doc) continue;
    byId.set(doc.id, doc);
  }

  const result: ServiceItem[] = [];

  for (const def of DEFAULT_SERVICES) {
    // Match by exact id first, or by slug/title if admin created an override with a different id
    let match = byId.get(def.id);
    if (!match) {
      match = firestoreDocs.find(
        (d) =>
          (d.slug && d.slug === def.slug) ||
          (d.title && String(d.title).trim().toLowerCase() === def.title.toLowerCase())
      );
    }

    if (match) {
      matchedDefaultIds.add(match.id);
      if (match.isDeleted) {
        continue;
      }
      const dPercent = match.discountPercent !== undefined ? Number(match.discountPercent) : (match.discountType === 'percentage' ? Number(match.discountValue || 0) : 0);
      const dAmount = match.discountAmount !== undefined ? Number(match.discountAmount) : (match.discountType === 'fixed' ? Number(match.discountValue || 0) : 0);
      const dType: 'percentage' | 'fixed' = match.discountType === 'fixed' || (dAmount > 0 && dPercent === 0) ? 'fixed' : 'percentage';
      const dVal = match.discountValue !== undefined ? Number(match.discountValue) : (dType === 'fixed' ? dAmount : dPercent);
      result.push({
        ...def,
        ...match,
        id: match.id || def.id,
        price: match.price !== undefined && match.price !== '' ? Number(match.price) : def.price,
        isNegotiable: match.isNegotiable !== undefined ? Boolean(match.isNegotiable) : Boolean(def.isNegotiable),
        discountType: dType,
        discountValue: dVal,
        discountPercent: dPercent,
        discountAmount: dAmount,
        discountLabel: match.discountLabel || ''
      });
    } else {
      result.push({ ...def, discountType: 'percentage', discountValue: 0 });
    }
  }

  // Append any custom services from Firestore that were not matched to defaults
  for (const doc of firestoreDocs) {
    if (!doc || matchedDefaultIds.has(doc.id) || doc.isDeleted) continue;
    const dPercent = doc.discountPercent !== undefined ? Number(doc.discountPercent) : (doc.discountType === 'percentage' ? Number(doc.discountValue || 0) : 0);
    const dAmount = doc.discountAmount !== undefined ? Number(doc.discountAmount) : (doc.discountType === 'fixed' ? Number(doc.discountValue || 0) : 0);
    const dType: 'percentage' | 'fixed' = doc.discountType === 'fixed' || (dAmount > 0 && dPercent === 0) ? 'fixed' : 'percentage';
    const dVal = doc.discountValue !== undefined ? Number(doc.discountValue) : (dType === 'fixed' ? dAmount : dPercent);
    result.push({
      id: doc.id,
      title: doc.title || 'Untitled Service',
      slug: doc.slug || '',
      category: doc.category || 'Consulting',
      description: doc.description || '',
      price: doc.price !== undefined && doc.price !== '' ? Number(doc.price) : 150,
      iconName: doc.iconName || 'Briefcase',
      color: doc.color || 'bg-orange-100 text-orange-600',
      imageUrl: doc.imageUrl || '',
      intakeOnly: doc.intakeOnly !== undefined ? Boolean(doc.intakeOnly) : false,
      isNegotiable: doc.isNegotiable !== undefined ? Boolean(doc.isNegotiable) : true,
      discountType: dType,
      discountValue: dVal,
      discountPercent: dPercent,
      discountAmount: dAmount,
      discountLabel: doc.discountLabel || ''
    });
  }

  return result;
}

export interface ServicePricingBreakdown {
  basePrice: number;
  originalPrice: number;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  discountPercent: number;
  discountAmount: number;
  discountLabel: string;
  discountBadgeText: string;
  effectivePrice: number;
  savingsAmount: number;
  hasDiscount: boolean;
  isNegotiable: boolean;
}

/**
 * Calculates the effective price after applying any Admin-configured discount
 * (percentage or fixed GH₵ discount) and whether the service is marked negotiable.
 */
export function getServicePricing(service: any): ServicePricingBreakdown {
  if (!service) {
    return {
      basePrice: 150,
      originalPrice: 150,
      discountType: 'percentage',
      discountValue: 0,
      discountPercent: 0,
      discountAmount: 0,
      discountLabel: '',
      discountBadgeText: '',
      effectivePrice: 150,
      savingsAmount: 0,
      hasDiscount: false,
      isNegotiable: false
    };
  }

  const basePrice = Math.max(0, Number(service.price !== undefined ? service.price : 150) || 0);
  const explicitType = service.discountType === 'fixed' ? 'fixed' : service.discountType === 'percentage' ? 'percentage' : null;
  const rawValue = Math.max(0, Number(service.discountValue) || 0);
  const rawPercent = Math.max(
    0,
    Math.min(100, explicitType === 'percentage' && rawValue > 0 ? rawValue : Number(service.discountPercent) || 0)
  );
  const rawFixed = Math.max(
    0,
    explicitType === 'fixed' && rawValue > 0 ? rawValue : Number(service.discountAmount) || 0
  );

  let effectivePrice = basePrice;
  let activeType: 'percentage' | 'fixed' = explicitType || (rawFixed > 0 && rawPercent === 0 ? 'fixed' : 'percentage');

  if (activeType === 'percentage' && rawPercent > 0) {
    effectivePrice = Math.max(0, Math.round(basePrice * (1 - rawPercent / 100) * 100) / 100);
  } else if (activeType === 'fixed' && rawFixed > 0) {
    effectivePrice = Math.max(0, Math.round((basePrice - rawFixed) * 100) / 100);
  } else if (rawPercent > 0) {
    activeType = 'percentage';
    effectivePrice = Math.max(0, Math.round(basePrice * (1 - rawPercent / 100) * 100) / 100);
  } else if (rawFixed > 0) {
    activeType = 'fixed';
    effectivePrice = Math.max(0, Math.round((basePrice - rawFixed) * 100) / 100);
  }

  const savingsAmount = Math.max(0, Math.round((basePrice - effectivePrice) * 100) / 100);
  const hasDiscount = savingsAmount > 0 && basePrice > 0;
  const computedPercent =
    activeType === 'percentage' && rawPercent > 0
      ? rawPercent
      : hasDiscount && basePrice > 0
      ? Math.round((savingsAmount / basePrice) * 100)
      : 0;
  const discountValue = activeType === 'fixed' ? rawFixed : computedPercent;
  const defaultBadge =
    activeType === 'fixed' && hasDiscount
      ? `GH₵ ${savingsAmount.toLocaleString()} OFF`
      : hasDiscount
      ? `${computedPercent}% OFF`
      : '';
  const label = service.discountLabel || defaultBadge;

  return {
    basePrice,
    originalPrice: basePrice,
    discountType: activeType,
    discountValue,
    discountPercent: computedPercent,
    discountAmount: savingsAmount,
    discountLabel: label,
    discountBadgeText: label,
    effectivePrice,
    savingsAmount,
    hasDiscount,
    isNegotiable: service.isNegotiable !== undefined ? Boolean(service.isNegotiable) : true
  };
}

/**
 * Computes the effective agreed/payable price for a booking or service intake record.
 */
export function getRecordNegotiationSummary(record: any, fallbackPrice: number = 0) {
  const originalPrice = Number(
    record?.originalPrice ?? record?.standardPrice ?? record?.servicePrice ?? record?.price ?? record?.totalPrice ?? fallbackPrice
  ) || 0;
  const listedPrice = Number(
    record?.servicePrice ?? record?.originalPrice ?? record?.standardPrice ?? record?.price ?? record?.totalPrice ?? fallbackPrice
  ) || originalPrice || 0;
  const agreedPrice =
    record?.agreedPrice !== undefined && record?.agreedPrice !== null && Number(record?.agreedPrice) > 0
      ? Number(record.agreedPrice)
      : null;
  const negotiatedPrice =
    record?.negotiatedPrice !== undefined && record?.negotiatedPrice !== null && Number(record?.negotiatedPrice) > 0
      ? Number(record.negotiatedPrice)
      : agreedPrice;
  const proposedPrice =
    record?.proposedPrice !== undefined && record?.proposedPrice !== null && Number(record?.proposedPrice) > 0
      ? Number(record.proposedPrice)
      : record?.status === 'Negotiation' && negotiatedPrice !== null && agreedPrice === null
      ? negotiatedPrice
      : null;
  const adminCounterPrice =
    record?.adminCounterPrice !== undefined && record?.adminCounterPrice !== null && Number(record?.adminCounterPrice) > 0
      ? Number(record.adminCounterPrice)
      : record?.adminCounterOffer !== undefined && record?.adminCounterOffer !== null && Number(record?.adminCounterOffer) > 0
      ? Number(record.adminCounterOffer)
      : null;

  const discountPercent = Math.max(0, Number(record?.discountPercent || 0));
  const rawDiscountAmount = Math.max(0, Number(record?.discountAmount || 0));

  const effectiveTotal =
    agreedPrice !== null
      ? agreedPrice
      : adminCounterPrice !== null && (record?.negotiationStatus === 'countered_by_admin' || record?.negotiationStatus === 'admin_countered')
      ? adminCounterPrice
      : negotiatedPrice !== null && (record?.negotiationStatus === 'agreed' || record?.status === 'confirmed')
      ? negotiatedPrice
      : Number(record?.totalPrice ?? record?.price ?? listedPrice ?? originalPrice ?? fallbackPrice) || 0;

  const discountAmount =
    rawDiscountAmount > 0
      ? rawDiscountAmount
      : originalPrice > effectiveTotal
      ? Math.max(0, Math.round((originalPrice - effectiveTotal) * 100) / 100)
      : 0;

  const amountPaid = Math.max(0, Number(record?.amountPaid ?? record?.paidAmount ?? 0));
  const balanceDue = Math.max(0, Math.round((effectiveTotal - amountPaid) * 100) / 100);
  const negotiationStatus: string =
    record?.negotiationStatus ||
    (agreedPrice !== null
      ? 'agreed'
      : record?.status === 'Negotiation' || proposedPrice !== null
      ? 'pending_admin'
      : 'none');

  const negotiationLabel =
    negotiationStatus === 'agreed'
      ? 'Price Agreed'
      : negotiationStatus === 'countered_by_admin' || negotiationStatus === 'admin_countered'
      ? 'Admin Counter-Offer'
      : negotiationStatus === 'pending_admin' || record?.status === 'Negotiation'
      ? 'Under Negotiation'
      : negotiationStatus === 'rejected'
      ? 'Offer Declined'
      : 'Standard Pricing';

  const paymentStatus: string =
    record?.paymentStatus ||
    (balanceDue <= 0 && effectiveTotal > 0
      ? 'Paid'
      : amountPaid > 0
      ? 'Part Paid'
      : record?.status === 'Negotiation'
      ? 'Negotiating'
      : 'Unpaid');

  return {
    originalPrice,
    listedPrice,
    agreedPrice,
    negotiatedPrice: negotiatedPrice ?? proposedPrice ?? adminCounterPrice ?? effectiveTotal,
    proposedPrice,
    adminCounterPrice,
    discountPercent,
    discountAmount,
    effectiveTotal,
    finalTotal: effectiveTotal,
    amountPaid,
    balanceDue,
    negotiationStatus,
    negotiationLabel,
    paymentStatus,
    negotiationNote: record?.negotiationNote || record?.negotiationNotes || record?.clientNegotiationNote || '',
    negotiationHistory: Array.isArray(record?.negotiationHistory) ? record.negotiationHistory : []
  };
}
