import React, { useCallback, useEffect, useState } from 'react';
import { Container, Box, Typography, Grid, useMediaQuery } from '@mui/material';
import { ErrorBoundary } from 'react-error-boundary';

// Internal imports
import Navbar from '../components/common/Navbar';
import Overview from '../components/dashboard/Overview';
import GPUMetrics from '../components/dashboard/GPUMetrics';
import { useMetrics } from '../hooks/useMetrics';

// Constants for metrics monitoring
const DEFAULT_REFRESH_INTERVAL = 30000; // 30 seconds
const TEMPERATURE_THRESHOLDS = {
  warning: 75,
  critical: 85
};
const RETRY_ATTEMPTS = 3;

/**
 * Main dashboard page component with enhanced system monitoring
 * and temperature tracking capabilities
 */
const Dashboard: React.FC = () => {
  // Media query for responsive design
  const isSmallScreen = useMediaQuery('(max-width:600px)');
  
  // State for error handling
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialize metrics hook with temperature monitoring
  const {
    gpuUtilization,
    gpuTemperature,
    isOverheating,
    error: metricsError,
    isLoading
  } = useMetrics({
    pollingInterval: DEFAULT_REFRESH_INTERVAL,
    enabled: true,
    temperatureThreshold: TEMPERATURE_THRESHOLDS.critical
  });

  // Set up visibility change listener for polling optimization
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Pause or slow down polling when tab is not visible
        console.debug('Dashboard: Tab hidden, adjusting polling rate');
      } else {
        // Resume normal polling when tab becomes visible
        console.debug('Dashboard: Tab visible, resuming normal polling');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Error handling callback for child components
  const handleComponentError = useCallback((error: Error, componentId: string) => {
    console.error(`Error in ${componentId}:`, error);
    setErrors(prev => ({
      ...prev,
      [componentId]: error.message
    }));
  }, []);

  // Error boundary fallback component
  const ErrorFallback = ({ error, resetErrorBoundary }: any) => (
    <Box 
      role="alert" 
      sx={{ 
        p: 3, 
        bgcolor: 'error.light',
        borderRadius: 1,
        color: 'error.contrastText'
      }}
    >
      <Typography variant="h6" gutterBottom>
        Error Loading Dashboard
      </Typography>
      <Typography paragraph>
        {error.message}
      </Typography>
      <button onClick={resetErrorBoundary}>
        Retry
      </button>
    </Box>
  );

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => setErrors({})}
      resetKeys={[gpuUtilization, gpuTemperature]}
    >
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
        {/* Navigation */}
        <Navbar title="Cosmos WFM Platform" />

        {/* Main Content */}
        <Container 
          maxWidth={false} 
          sx={{ 
            pt: isSmallScreen ? 2 : 3,
            pb: isSmallScreen ? 2 : 3,
            mt: 8 // Account for fixed navbar
          }}
        >
          {/* Page Title */}
          <Typography 
            variant="h4" 
            component="h1" 
            gutterBottom
            sx={{ mb: 4 }}
          >
            System Dashboard
          </Typography>

          {/* System Overview */}
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Overview
                refreshInterval={DEFAULT_REFRESH_INTERVAL}
                onError={(error) => handleComponentError(error, 'overview')}
              />
            </Grid>

            {/* GPU Metrics with Temperature Monitoring */}
            <Grid item xs={12} md={6}>
              <GPUMetrics
                pollingInterval={DEFAULT_REFRESH_INTERVAL}
                showTemperature={true}
                height={isSmallScreen ? '300px' : '400px'}
                temperatureWarningThreshold={TEMPERATURE_THRESHOLDS.warning}
                temperatureCriticalThreshold={TEMPERATURE_THRESHOLDS.critical}
                ariaLabel="GPU utilization and temperature metrics"
              />
            </Grid>
          </Grid>

          {/* Loading State */}
          {isLoading && (
            <Box 
              role="status" 
              aria-label="Loading dashboard data"
              sx={{ 
                display: 'flex', 
                justifyContent: 'center',
                mt: 4 
              }}
            >
              <Typography>Loading dashboard data...</Typography>
            </Box>
          )}

          {/* Error Display */}
          {metricsError && (
            <Box 
              role="alert" 
              sx={{ 
                mt: 4,
                p: 2,
                bgcolor: 'error.light',
                borderRadius: 1
              }}
            >
              <Typography color="error">
                Error loading metrics: {metricsError}
              </Typography>
            </Box>
          )}

          {/* Temperature Warning */}
          {isOverheating && (
            <Box 
              role="alert" 
              sx={{ 
                mt: 4,
                p: 2,
                bgcolor: 'warning.light',
                borderRadius: 1
              }}
            >
              <Typography color="warning.dark">
                Warning: GPU temperature exceeds critical threshold
              </Typography>
            </Box>
          )}
        </Container>
      </Box>
    </ErrorBoundary>
  );
};

export default Dashboard;