import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
  componentName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    alert(error);
    this.setState({ errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center p-6 bg-rose-500/10 border border-rose-500/20 rounded-2xl m-4 backdrop-blur-sm shadow-xl">
          <AlertCircle className="w-12 h-12 text-rose-500 mb-4 animate-bounce" />
          <h2 className="text-lg font-black text-white uppercase tracking-wider mb-2 font-mono">
            {this.props.componentName ? `${this.props.componentName} Crashed` : "Component Error"}
          </h2>
          <p className="text-sm text-rose-200/80 max-w-sm text-center mb-6 font-sans">
            A critical error occurred while rendering this interface. Our resilient UI system caught it to prevent full application collapse.
          </p>
          <div className="bg-black/40 p-4 rounded-xl text-left w-full overflow-x-auto mb-6 text-[10px] text-rose-400 font-mono">
            <strong>Error:</strong> {this.state.error?.toString()}
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
            className="flex items-center gap-2 px-6 py-2 bg-rose-600 hover:bg-rose-500 text-white font-black rounded-full uppercase tracking-widest text-xs transition-colors shadow-lg shadow-rose-900/50"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Remount Interface
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
