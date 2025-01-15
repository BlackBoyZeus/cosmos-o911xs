import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, Typography, Skeleton, Alert } from '@mui/material';
import { useTheme } from '@mui/material';
import { ErrorBoundary } from 'react-error-boundary';

// Internal imports
import { IModelMetrics } from '../../interfaces/IMetrics';
import { useMetrics } from '../../hooks/useMetrics';
import Chart from '../common/Chart';

// Constants for metric display and thresholds
const DEFAULT_POLLING_INTERVAL = 30000; // 30 seconds

const METRIC_THRESHOLDS = {
  generationTime: { warning: 500, critical: 1000 },
  gpuMemoryPeak: { warning: 75, critical: 90 },
  psnrScore: { warning: 28, critical: 25 },
  fidScore: { warning: 150, critical: 200 }
};

const METRIC_CONFIGS = {
  generationTime: { unit: 'ms', precision: 0, label: 'Generation Time' },
  gpuMemoryPeak: { unit: 'GB', precision: 1, label: 'GPU Memory Peak' },
  psnrScore: { unit: '', precision: 2, label: 'PSNR Score' },
  fidScore: { unit: '', precision: 1, label: 'FID Score' }
};

// Props interface
interface ModelMetricsProps {
  modelId: string;
  pollingInterval?: number;
  className?: string;
  onError?: (error: Error) => void;
}

// Helper functions
const formatMetricValue = (value: number, metricType: keyof typeof METRIC_CONFIGS): string => {
  const config = METRIC_CONFIGS[metricType];
  const formattedValue = value.toFixed(config.precision);
  return `${formattedValue}${config.unit ? ` ${config.unit}` : ''}`;
};

const getThresholdColor = (value: number, metricType: keyof typeof METRIC_THRESHOLDS, theme: any): string => {
  const thresholds = METRIC_THRESHOLDS[metricType];
  if (value >= thresholds.critical) {
    return theme.palette.error.main;
  }
  if (value >= thresholds.warning) {
    return theme.palette.warning.main;
  }
  return theme.palette.success.main;
};

// Error Fallback Component
const ErrorFallback: React.FC<{ error: Error; resetErrorBoundary: () => void }> = ({ 
  error, 
  resetErrorBoundary 
}) => (
  <Alert 
    severity="error" 
    onClose={resetErrorBoundary}
    sx={{ mb: 2 }}
  >
    Failed to load model metrics: {error.message}
  </Alert>
);

// Main Component
const ModelMetrics: React.FC<ModelMetricsProps> = ({
  modelId,
  pollingInterval = DEFAULT_POLLING_INTERVAL,
  className,
  onError
}) => {
  const theme = useTheme();

  // Fetch metrics using custom hook
  const { 
    modelMetrics, 
    isLoading, 
    error, 
    temperatureHistory 
  } = useMetrics({
    modelId,
    pollingInterval,
    enabled: true
  });

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!modelMetrics || !temperatureHistory) return null;

    return {
      label: 'Model Performance',
      data: temperatureHistory.map((temp, index) => ({
        timestamp: Date.now() - (temperatureHistory.length - index) * pollingInterval,
        value: temp,
        label: `Temperature: ${temp}°C`
      })),
      borderColor: theme.palette.primary.main,
      backgroundColor: theme.palette.primary.light,
      fill: true
    };
  }, [modelMetrics, temperatureHistory, pollingInterval, theme]);

  // Handle error state
  if (error) {
    onError?.(new Error(error));
    return <ErrorFallback error={new Error(error)} resetErrorBoundary={() => {}} />;
  }

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={onError}
      resetKeys={[modelId]}
    >
      <Card className={className}>
        <CardHeader 
          title="Model Performance Metrics" 
          titleTypographyProps={{ variant: 'h6' }}
          aria-label="Model performance metrics card"
        />
        <CardContent>
          {isLoading ? (
            <Skeleton variant="rectangular" height={400} />
          ) : modelMetrics ? (
            <>
              {/* Metrics Grid */}
              <div role="grid" aria-label="Performance metrics grid">
                {Object.entries(METRIC_CONFIGS).map(([key, config]) => {
                  const value = modelMetrics[key as keyof IModelMetrics];
                  const color = getThresholdColor(value, key as keyof typeof METRIC_THRESHOLDS, theme);
                  
                  return (
                    <div 
                      key={key}
                      role="row"
                      style={{ marginBottom: theme.spacing(2) }}
                    >
                      <Typography 
                        variant="subtitle2" 
                        color="textSecondary"
                        role="rowheader"
                      >
                        {config.label}
                      </Typography>
                      <Typography 
                        variant="h6" 
                        style={{ color }}
                        role="cell"
                        aria-label={`${config.label}: ${formatMetricValue(value, key as keyof typeof METRIC_CONFIGS)}`}
                      >
                        {formatMetricValue(value, key as keyof typeof METRIC_CONFIGS)}
                      </Typography>
                    </div>
                  );
                })}
              </div>

              {/* Performance Chart */}
              {chartData && (
                <div style={{ height: 200, marginTop: theme.spacing(2) }}>
                  <Chart
                    dataset={chartData}
                    type="line"
                    options={{
                      scales: {
                        y: {
                          beginAtZero: true,
                          title: {
                            display: true,
                            text: 'Temperature (°C)'
                          }
                        }
                      }
                    }}
                    accessibilityConfig={{
                      ariaLabel: 'Model temperature history chart',
                      description: 'Line chart showing GPU temperature over time',
                      keyboardNavigation: true
                    }}
                    thresholds={{
                      warning: METRIC_THRESHOLDS.gpuMemoryPeak.warning,
                      critical: METRIC_THRESHOLDS.gpuMemoryPeak.critical,
                      warningColor: theme.palette.warning.main,
                      criticalColor: theme.palette.error.main
                    }}
                  />
                </div>
              )}
            </>
          ) : (
            <Alert severity="info">No metrics available</Alert>
          )}
        </CardContent>
      </Card>
    </ErrorBoundary>
  );
};

export default ModelMetrics;