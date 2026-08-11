import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

// Catches render/lifecycle errors anywhere below it — a bad AI response
// shape, an unexpected null, etc. — so one crash doesn't blank the whole
// app. Does NOT catch errors in event handlers or async code (React's
// error boundaries never do); those are handled by existing try/catch +
// toast patterns throughout the app.
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled render error:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
          <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 text-center shadow-lg">
            <div className="w-12 h-12 mx-auto rounded-full bg-red-50 dark:bg-red-950/40 flex items-center justify-center text-red-500">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 dark:text-slate-100">Something went wrong</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                An unexpected error occurred. Your data is saved — reloading should fix this.
              </p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reload App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
