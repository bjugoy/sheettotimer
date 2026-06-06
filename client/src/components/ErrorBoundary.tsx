import React from 'react';
import * as Sentry from '@sentry/react';
import { Radio } from 'lucide-react';

interface State { error: Error | null; }

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-warm-950 gap-4 px-4 text-center">
        <Radio className="w-8 h-8 text-crimson-600" />
        <h1 className="text-warm-200 font-semibold text-lg">Something went wrong</h1>
        <p className="text-warm-500 text-sm max-w-sm">
          {this.state.error.message || 'An unexpected error occurred.'}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 px-4 py-2 bg-warm-800 hover:bg-warm-700 border border-warm-700
            text-warm-200 text-sm rounded-lg transition-colors">
          Reload page
        </button>
      </div>
    );
  }
}
