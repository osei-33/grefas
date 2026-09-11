declare module '@paystack/inline-js' {
  export interface PaystackTransactionOptions {
    key: string;
    email: string;
    amount: number;
    currency?: string;
    ref?: string;
    reference?: string;
    access_code?: string;
    metadata?: Record<string, any>;
    channels?: string[];
    callback?: (response: any) => void;
    onSuccess?: (response: any) => void;
    onCancel?: () => void;
    onClose?: () => void;
    onError?: (error: any) => void;
    subaccount?: string;
    bearer?: string;
  }

  export interface PaystackPopInstance {
    newTransaction: (options: PaystackTransactionOptions) => void;
    resumeTransaction: (accessCode: string, options?: { onSuccess?: (data: any) => void; onCancel?: () => void; onError?: (err: any) => void }) => void;
  }

  export default class PaystackPop {
    constructor();
    newTransaction(options: PaystackTransactionOptions): void;
    resumeTransaction(accessCode: string, options?: { onSuccess?: (data: any) => void; onCancel?: () => void; onError?: (err: any) => void }): void;
    static setup(options: PaystackTransactionOptions): {
      openIframe: () => void;
    };
  }
}
