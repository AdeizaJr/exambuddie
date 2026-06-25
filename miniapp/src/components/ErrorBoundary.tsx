import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
          <p className="text-4xl mb-3">😵</p>
          <h2 className="text-lg font-bold text-[var(--tg-text)] mb-2">Something went wrong</h2>
          <p className="text-sm text-[var(--tg-hint)] mb-4">{this.state.error.message}</p>
          <button
            onClick={() => this.setState({ error: null })}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-full"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
