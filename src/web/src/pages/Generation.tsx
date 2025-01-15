import React, { useState, useCallback, useEffect } from 'react';
import { Box, Grid, Alert } from '@mui/material';
import { withErrorBoundary } from 'react-error-boundary';

// Internal imports
import GenerationForm from '../components/generation/GenerationForm';
import GenerationList from '../components/generation/GenerationList';
import useGeneration from '../hooks/useGeneration';
import { Status } from '../types/common';
import { IGenerationResponse } from '../interfaces/IGeneration';

// Decorators for enhanced functionality
const withMetricsTracking = (Component: React.ComponentType) => {
  return (props: any) => {
    useEffect(() => {
      // Initialize performance monitoring
      const startTime = performance.now();
      
      return () => {
        // Log performance metrics on unmount
        const duration = performance.now() - startTime;
        console.info('Generation Page Performance:', {
          totalDuration: duration,
          timestamp: new Date().toISOString()
        });
      };
    }, []);

    return <Component {...props} />;
  };
};

const Generation: React.FC = () => {
  // Local state
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Generation hook with enhanced metrics tracking
  const {
    submitRequest,
    loading,
    progress,
    generationStatus,
    performanceMetrics,
    currentRequest
  } = useGeneration();

  // Success handler with metrics logging
  const handleGenerationSuccess = useCallback((response: IGenerationResponse) => {
    setSuccessMessage('Video generation completed successfully');
    setError(null);

    // Log generation metrics
    console.info('Generation Success Metrics:', {
      generationId: response.requestId,
      duration: response.generationTime,
      resourceUtilization: response.resourceUtilization,
      quality: {
        psnr: response.metadata?.psnr,
        fid: response.metadata?.fid
      }
    });
  }, []);

  // Error handler with retry logic
  const handleGenerationError = useCallback((error: Error) => {
    setError(error.message);
    setSuccessMessage(null);

    // Log error for monitoring
    console.error('Generation Error:', {
      error: error.message,
      timestamp: new Date().toISOString(),
      currentRequest
    });
  }, [currentRequest]);

  // Clear messages on status change
  useEffect(() => {
    if (generationStatus === Status.PROCESSING) {
      setError(null);
      setSuccessMessage(null);
    }
  }, [generationStatus]);

  return (
    <Box
      component="main"
      role="main"
      aria-label="Video Generation Interface"
      sx={{ p: 3, width: '100%', maxWidth: 1200, mx: 'auto' }}
    >
      <Grid container spacing={3}>
        {/* Form Section */}
        <Grid item xs={12} md={6}>
          <GenerationForm
            onSuccess={handleGenerationSuccess}
            onError={handleGenerationError}
            telemetryEnabled={true}
          />

          {/* Status Messages */}
          {error && (
            <Alert 
              severity="error" 
              sx={{ mt: 2 }}
              role="alert"
            >
              {error}
            </Alert>
          )}
          
          {successMessage && (
            <Alert 
              severity="success" 
              sx={{ mt: 2 }}
              role="status"
            >
              {successMessage}
            </Alert>
          )}

          {/* Performance Metrics */}
          {performanceMetrics && generationStatus === Status.PROCESSING && (
            <Box 
              sx={{ mt: 2 }} 
              role="region" 
              aria-label="Performance metrics"
            >
              <Alert 
                severity="info"
                icon={false}
              >
                GPU Utilization: {performanceMetrics.gpuUtilization}% |
                Memory Usage: {performanceMetrics.memoryUsage}GB |
                Processing Latency: {performanceMetrics.processingLatency}ms
              </Alert>
            </Box>
          )}
        </Grid>

        {/* Generations List Section */}
        <Grid item xs={12} md={6}>
          <GenerationList
            generations={[]}
            loading={loading}
            onSort={(column, direction) => {
              console.log('Sorting:', column, direction);
              // Implement sorting logic
            }}
            onPageChange={(page) => {
              console.log('Page changed:', page);
              // Implement pagination logic
            }}
            onError={handleGenerationError}
            virtualizationEnabled={true}
            accessibilityLabels={{
              [Status.PENDING]: 'Generation pending',
              [Status.PROCESSING]: 'Generation in progress',
              [Status.COMPLETED]: 'Generation completed',
              [Status.FAILED]: 'Generation failed',
              [Status.CANCELLED]: 'Generation cancelled'
            }}
          />
        </Grid>
      </Grid>
    </Box>
  );
};

// Export wrapped component with error boundary and metrics tracking
export default withErrorBoundary(
  withMetricsTracking(Generation),
  {
    fallback: ({ error, resetErrorBoundary }) => (
      <Box sx={{ p: 3 }}>
        <Alert 
          severity="error"
          action={
            <button onClick={resetErrorBoundary}>
              Retry
            </button>
          }
        >
          An error occurred in the generation interface: {error.message}
        </Alert>
      </Box>
    ),
    onError: (error) => {
      // Log error to monitoring system
      console.error('Generation Page Error:', {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
    }
  }
);