export type SponsorType = 'individual' | 'organization';

export interface Sponsorship {
  id?: string;
  sponsorType: SponsorType;
  sponsorName: string;
  contactPerson?: string;
  email: string;
  phone?: string;
  amount: number;
  currency: string;
  tier?: 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Custom';
  message?: string;
  isAnonymous?: boolean;
  paymentMethod: string;
  paymentStatus: 'completed' | 'pending' | 'failed';
  paymentReference?: string;
  thankYouSent?: boolean;
  thankYouSentAt?: string | null;
  thankYouMessage?: string;
  adminNotes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface DonationTier {
  id: string;
  name: string;
  amount: number;
  description: string;
  impact: string;
  badgeColor: string;
  popular?: boolean;
}
