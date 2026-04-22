import * as React from 'react';
import { Button } from '@/components/ui/button';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: any;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  static getDerivedStateFromError(error: any): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let message = "Something went wrong.";
      try {
        const errObj = JSON.parse(this.state.error.message);
        if (errObj.error && errObj.error.includes("Missing or insufficient permissions")) {
          message = "You do not have permission to perform this action. Please make sure you are logged in as an authorized admin.";
        }
      } catch (e) {
        // Not a JSON error
      }

      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 p-4 text-center">
          <h1 className="text-2xl font-bold text-zinc-900">Oops!</h1>
          <p className="mt-2 text-zinc-600">{message}</p>
          <Button onClick={() => window.location.href = '/'} className="mt-6 bg-orange-600">
            Go to Home
          </Button>
        </div>
      );
    }

    return (this as any).props.children;
  }
}
