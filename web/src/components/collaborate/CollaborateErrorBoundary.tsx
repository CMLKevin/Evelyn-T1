import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackComponent?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary for Collaborate Panel components
 * Catches React errors and displays a friendly fallback UI
 */
export class CollaborateErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[CollaborateErrorBoundary] Caught error:', error);
    console.error('[CollaborateErrorBoundary] Component stack:', errorInfo.componentStack);
    
    this.setState({ errorInfo });
    
    // Could send to error reporting service here
  }

  handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  handleGoHome = (): void => {
    window.location.hash = '#/';
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Custom fallback if provided
      if (this.props.fallbackComponent) {
        return this.props.fallbackComponent;
      }

      // Default error UI
      return (
        <div className="flex items-center justify-center h-full bg-terminal-black p-8">
          <div className="max-w-md text-center">
            {/* Error Icon */}
            <div className="mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-red-500/20 border-2 border-red-500/50">
                <AlertTriangle className="w-8 h-8 text-red-400" />
              </div>
            </div>

            {/* Error Title */}
            <h2 className="text-xl font-mono font-bold text-white mb-3">
              Something went wrong
            </h2>

            {/* Error Description */}
            <p className="text-terminal-400 text-sm mb-6">
              An unexpected error occurred in the Collaborate panel. 
              Your document changes should be saved, but you may need to refresh.
            </p>

            {/* Error Details (open by default for better debugging) */}
            <details className="mb-6 text-left" open>
              <summary className="text-xs text-terminal-500 cursor-pointer hover:text-terminal-400 transition-colors">
                Error details
              </summary>
              <div className="mt-3 p-3 bg-black border border-red-500/30 overflow-auto max-h-40">
                <pre className="text-xs text-red-400 whitespace-pre-wrap font-mono">
                  {this.state.error?.message || 'Unknown error'}
                </pre>
                {this.state.errorInfo && (
                  <pre className="text-xs text-terminal-600 whitespace-pre-wrap font-mono mt-2">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </div>
            </details>

            {/* Action Buttons */}
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleRetry}
                className="px-4 py-2 bg-orange/20 border-2 border-orange text-orange 
                         text-sm font-mono font-medium
                         hover:bg-orange/30 transition-colors
                         flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </button>
              
              <button
                onClick={this.handleGoHome}
                className="px-4 py-2 bg-white/5 border-2 border-white/20 text-terminal-300 
                         text-sm font-mono
                         hover:bg-white/10 hover:border-white/30 transition-colors
                         flex items-center gap-2"
              >
                <Home className="w-4 h-4" />
                Go Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default CollaborateErrorBoundary;
