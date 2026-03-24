import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let errorMessage = 'An unexpected error occurred. Please try refreshing the page.';
      let errorDetails: any = null;

      try {
        if (this.state.error?.message.startsWith('{')) {
          errorDetails = JSON.parse(this.state.error.message);
          errorMessage = `Database error during ${errorDetails.operationType} on ${errorDetails.path}.`;
        }
      } catch (e) {
        // Fallback if parsing fails
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-zinc-50 dark:bg-zinc-950">
          <div className="max-w-md w-full bg-white dark:bg-zinc-900 p-8 rounded-3xl shadow-xl border border-zinc-200 dark:border-zinc-800 text-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <h2 className="text-2xl font-bold mb-4">Something went wrong</h2>
            <div className="text-zinc-500 mb-6 text-sm space-y-2">
              <p>{errorMessage}</p>
              {errorDetails && (
                <div className="mt-4 p-4 bg-zinc-50 dark:bg-zinc-800 rounded-xl text-left overflow-auto max-h-40 font-mono text-[10px]">
                  <p className="font-bold text-red-500 mb-1">Error: {errorDetails.error}</p>
                  <p>Path: {errorDetails.path}</p>
                  <p>Op: {errorDetails.operationType}</p>
                  <p>User: {errorDetails.authInfo.userId || 'Not logged in'}</p>
                </div>
              )}
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
