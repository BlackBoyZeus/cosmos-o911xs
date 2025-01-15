// External imports - with versions
import React from 'react'; // ^18.2.0
import ReactDOM from 'react-dom/client'; // ^18.2.0
import { Provider } from 'react-redux'; // ^8.1.3
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.11
import { createGlobalStyle } from 'styled-components'; // ^5.3.0

// Internal imports
import App from './App';
import store from './store';
import { initializeMonitoring } from '@cosmos/monitoring';

// Global styles
const GlobalStyles = createGlobalStyle`
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  html, body {
    height: 100%;
    width: 100%;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  #root {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    border: 0;
  }
`;

// Error fallback component
const ErrorFallback = ({ error, resetErrorBoundary }: any) => (
  <div role="alert" style={{ padding: '20px' }}>
    <h2>Application Error</h2>
    <pre style={{ color: 'red' }}>{error.message}</pre>
    <button onClick={resetErrorBoundary}>Try Again</button>
  </div>
);

/**
 * Initialize application monitoring and performance tracking
 */
const initializeApp = (): void => {
  // Initialize performance monitoring
  initializeMonitoring({
    enableMetrics: true,
    metricsEndpoint: '/api/v1/monitoring/metrics',
    sampleRate: 0.1,
    gpuMetrics: true
  });

  // Development mode warnings and checks
  if (process.env.NODE_ENV === 'development') {
    console.info('Running in development mode');
    
    // Enable React strict mode checks
    const reactDevTools = (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (reactDevTools) {
      reactDevTools.inject({ reloadAndProfile: true });
    }
  }
};

/**
 * Initialize and render the React application with all providers
 * and error boundaries
 */
const renderApp = (): void => {
  const rootElement = document.getElementById('root');
  if (!rootElement) throw new Error('Failed to find root element');

  const root = ReactDOM.createRoot(rootElement);

  // Initialize app monitoring
  initializeApp();

  root.render(
    <React.StrictMode>
      <ErrorBoundary
        FallbackComponent={ErrorFallback}
        onReset={() => window.location.reload()}
        onError={(error) => {
          console.error('Application error:', error);
          // Log error to monitoring service
          if (process.env.NODE_ENV === 'production') {
            initializeMonitoring().logError(error);
          }
        }}
      >
        <Provider store={store}>
          <GlobalStyles />
          <App />
        </Provider>
      </ErrorBoundary>
    </React.StrictMode>
  );
};

// Initialize application
renderApp();

// Enable hot module replacement in development
if (process.env.NODE_ENV === 'development' && module.hot) {
  module.hot.accept('./App', () => {
    renderApp();
  });
}