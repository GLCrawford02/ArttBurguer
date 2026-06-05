import { StrictMode, Component, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import DeliveryApp from './DeliveryApp';
import './index.css';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: 'monospace', color: '#fff', background: '#1a1a1a', minHeight: '100vh' }}>
          <h2 style={{ color: '#f97316' }}>Erro no App</h2>
          <p style={{ color: '#ff6b6b', marginBottom: 8 }}>{this.state.error.message}</p>
          <pre style={{ fontSize: 11, color: '#aaa', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {this.state.error.stack}
          </pre>
          <button
            onClick={() => { localStorage.clear(); window.location.reload(); }}
            style={{ marginTop: 16, padding: '10px 20px', background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, fontSize: 16 }}
          >
            Limpar dados e reabrir
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <DeliveryApp />
    </ErrorBoundary>
  </StrictMode>
);
