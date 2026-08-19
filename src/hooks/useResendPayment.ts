import { useState, useCallback } from 'react';
import { toast } from 'sonner';

export interface BookingPaymentEmailParams {
  email: string;
  userName: string;
  phone?: string;
  serviceTitle: string;
  date: string;
  time?: string;
  orderNumber?: string;
  amountPaid: number;
  paystackReference: string;
  paymentChannel?: string;
  serviceDescription?: string;
  teamMemberName?: string;
  currency?: string;
}

export function useResendPayment() {
  const [isSending, setIsSending] = useState(false);

  const sendBookingPaymentConfirmation = useCallback(
    async (params: BookingPaymentEmailParams) => {
      setIsSending(true);
      try {
        const res = await fetch('/api/notify-booking-payment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(params)
        });

        const data = await res.json();
        if (data.status === 'ok') {
          if (data.results?.email === 'sent') {
            toast.success('Payment receipt & confirmation email sent to ' + params.email);
          }
          return data;
        } else {
          console.warn('Payment confirmation notification notice:', data);
          return data;
        }
      } catch (err: any) {
        console.error('Failed to trigger payment confirmation email hook:', err);
        // Don't crash payment flow if email delivery encountered network glitch
        return { status: 'error', error: err.message };
      } finally {
        setIsSending(false);
      }
    },
    []
  );

  return {
    sendBookingPaymentConfirmation,
    isSending
  };
}
