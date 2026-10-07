"use client";
import { Component, type ReactNode } from "react";

/**
 * Keeps one failing panel (the 3D view, the chat) from blanking the whole station: the panel
 * shows what went wrong and a retry button; everything else keeps working. The error is logged.
 */
export class ErrorBoundary extends Component<{ label: string; children: ReactNode }, { error: Error | null; attempt: number }> {
  state = { error: null as Error | null, attempt: 0 };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error(`[${this.props.label}]`, error);
  }
  render() {
    const { error, attempt } = this.state;
    if (!error) return <div key={attempt} className="contents">{this.props.children}</div>;
    return (
      <div role="alert" className="flex min-h-[160px] flex-1 flex-col items-center justify-center gap-2 rounded-md border border-red-200 bg-red-50 p-4 text-center text-sm text-red-900" data-testid="panel-error">
        <p className="font-medium">The {this.props.label} stopped working.</p>
        <p className="max-w-md text-xs break-words text-red-800">{error.message || String(error)}</p>
        <button type="button" onClick={() => this.setState({ error: null, attempt: attempt + 1 })} className="rounded-md bg-red-700 px-3 py-1.5 text-xs font-medium text-white">
          Try again
        </button>
      </div>
    );
  }
}
