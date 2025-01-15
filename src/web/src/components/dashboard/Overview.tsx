import React, { useCallback, useState } from 'react';
import { Grid, Typography, useMediaQuery, useTheme } from '@mui/material';
import { ErrorBoundary } from 'react-error-boundary';

// Internal component imports
import GPUMetrics from './GPUMetrics';
import JobQueue from './JobQueue';
import SystemHealth from './SystemHealth';
import ModelMetrics from './ModelMetrics';
import ResourceUsage from './ResourceUsage';

// Default refresh interval in milliseconds
const DEFAULT_REFRESH_INTERVAL = 30000;
const GRID_SPACING = 3;
const MIN_COMPONENT_HEIGHT = 200;

// Interface for component props
interface OverviewProps {
  refreshInterval?: number;
  onError?: (error: Error, componentId: string) => void;
}

/**
 * Main dashboard overview component that displays system health, resource utilization,
 * job queue status, and model performance metrics in a responsive grid layout
 */
const Overview: React.FC<OverviewProps> = React.memo(({
  refreshInterval = DEFAULT_REFRESH_INTERVAL,
  onError
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [activeModelId] = useState<string>('default');

  // Error handling callbacks for each component
  const handleGPUMetricsError = useCallback((error: Error) => {
    onError?.(error, 'gpu-metrics');
  }, [onError]);

  const handleJobQueueError = useCallback((error: Error) => {
    onError?.(error, 'job-queue');
  }, [onError]);

  const handleSystemHealthError = useCallback((error: Error) => {
    onError?.(error, 'system-health');
  }, [onError]);

  const handleModelMetricsError = useCallback((error: Error) => {
    onError?.(error, 'model-metrics');
  }, [onError]);

  const handleResourceUsageError = useCallback((error: Error) => {
    onError?.(error, 'resource-usage');
  }, [onError]);

  return (
    <Grid 
      container 
      spacing={GRID_SPACING}
      role="main"
      aria-label="System dashboard overview"
    >
      {/* System Health Overview */}
      <Grid item xs={12}>
        <ErrorBoundary
          FallbackComponent={({ error }) => (
            <Typography color="error">Error loading system health: {error.message}</Typography>
          )}
          onError={handleSystemHealthError}
        >
          <SystemHealth
            pollingInterval={refreshInterval}
            errorRetryCount={3}
            temperatureUnit="C"
          />
        </ErrorBoundary>
      </Grid>

      {/* GPU Metrics and Resource Usage */}
      <Grid item xs={12} md={6}>
        <ErrorBoundary
          FallbackComponent={({ error }) => (
            <Typography color="error">Error loading GPU metrics: {error.message}</Typography>
          )}
          onError={handleGPUMetricsError}
        >
          <GPUMetrics
            pollingInterval={refreshInterval}
            showTemperature={true}
            height={isMobile ? `${MIN_COMPONENT_HEIGHT}px` : '300px'}
            temperatureWarningThreshold={75}
            temperatureCriticalThreshold={85}
            ariaLabel="GPU utilization and temperature metrics"
          />
        </ErrorBoundary>
      </Grid>

      <Grid item xs={12} md={6}>
        <ErrorBoundary
          FallbackComponent={({ error }) => (
            <Typography color="error">Error loading resource usage: {error.message}</Typography>
          )}
          onError={handleResourceUsageError}
        >
          <ResourceUsage
            pollingInterval={refreshInterval}
            showTemperature={true}
            thresholds={{
              temperature: { warning: 75, critical: 85 },
              memory: { warning: 80, critical: 90 },
              storage: { warning: 85, critical: 95 }
            }}
          />
        </ErrorBoundary>
      </Grid>

      {/* Job Queue Status */}
      <Grid item xs={12}>
        <ErrorBoundary
          FallbackComponent={({ error }) => (
            <Typography color="error">Error loading job queue: {error.message}</Typography>
          )}
          onError={handleJobQueueError}
        >
          <JobQueue />
        </ErrorBoundary>
      </Grid>

      {/* Model Performance Metrics */}
      <Grid item xs={12}>
        <ErrorBoundary
          FallbackComponent={({ error }) => (
            <Typography color="error">Error loading model metrics: {error.message}</Typography>
          )}
          onError={handleModelMetricsError}
        >
          <ModelMetrics
            modelId={activeModelId}
            pollingInterval={refreshInterval}
            onError={handleModelMetricsError}
          />
        </ErrorBoundary>
      </Grid>
    </Grid>
  );
});

// Display name for debugging
Overview.displayName = 'Overview';

export default Overview;