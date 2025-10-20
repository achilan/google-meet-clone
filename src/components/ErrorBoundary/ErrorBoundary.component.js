import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // You can log the error to an external service here
    console.error('Captured error in ErrorBoundary:', error, info);
  }

  render() {
    if (this.state.hasError) {
      // Render a user-friendly fallback UI without exposing stack traces
      return (
        <div style={{padding: 20, textAlign: 'center'}}>
          <h2>Ha ocurrido un error</h2>
          <p>Estamos trabajando para solucionarlo. Por favor recargue la página o intente más tarde.</p>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
