import React, { Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { ErrorBoundary } from 'react-error-boundary';

// Internal imports
import Layout from './components/common/Layout';
import Loading from './components/common/Loading';
import { useAuth } from './hooks/useAuth';
import theme from './assets/styles/theme';
import routes from './config/routes';

/**
 * Error fallback component for global error boundary
 */
const ErrorFallback = ({ error, resetErrorBoundary }: any) => (
  <div role="alert" style={{ padding: '20px' }}>
    <h2>Application Error</h2>
    <pre style={{ color: 'red' }}>{error.message}</pre>
    <button onClick={resetErrorBoundary}>Try Again</button>
  </div>
);

/**
 * Root application component implementing secure routing, authentication,
 * and global error handling
 */
const App: React.FC = () => {
  const { 
    isAuthenticated, 
    user, 
    loading, 
    error,
    refreshToken,
    sessionMetrics
  } = useAuth();

  // Monitor session activity and refresh token when needed
  useEffect(() => {
    if (isAuthenticated) {
      const currentTime = Date.now();
      const idleTime = currentTime - sessionMetrics.lastActive;

      // Refresh token if approaching expiration
      if (sessionMetrics.tokenRefreshCount < 24) { // Limit refreshes to 24 per day
        refreshToken();
      }

      // Log security metrics
      console.info('Session metrics:', {
        idleTime,
        tokenRefreshCount: sessionMetrics.tokenRefreshCount,
        lastActive: new Date(sessionMetrics.lastActive).toISOString()
      });
    }
  }, [isAuthenticated, sessionMetrics, refreshToken]);

  // Handle authentication loading state
  if (loading) {
    return (
      <Loading 
        message="Initializing secure session..." 
        size="large"
        fullScreen
      />
    );
  }

  // Handle authentication error state
  if (error) {
    return (
      <div role="alert" style={{ padding: '20px' }}>
        <h2>Authentication Error</h2>
        <pre style={{ color: 'red' }}>{error}</pre>
      </div>
    );
  }

  return (
    <ErrorBoundary 
      FallbackComponent={ErrorFallback}
      onReset={() => window.location.reload()}
    >
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>
          <Layout>
            <Suspense 
              fallback={
                <Loading 
                  message="Loading application..." 
                  size="large" 
                />
              }
            >
              <Routes>
                {/* Map configured routes with role-based access control */}
                {routes.map(route => (
                  <Route
                    key={route.path}
                    path={route.path}
                    element={
                      <ErrorBoundary FallbackComponent={ErrorFallback}>
                        {route.element}
                      </ErrorBoundary>
                    }
                  />
                ))}

                {/* Redirect unauthenticated users to login */}
                <Route
                  path="/login"
                  element={
                    isAuthenticated ? (
                      <Navigate to="/" replace />
                    ) : (
                      <Navigate to="/auth/login" replace />
                    )
                  }
                />

                {/* Catch-all route for 404s */}
                <Route
                  path="*"
                  element={
                    <Navigate 
                      to="/404" 
                      replace 
                      state={{ from: window.location.pathname }}
                    />
                  }
                />
              </Routes>
            </Suspense>
          </Layout>
        </BrowserRouter>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;