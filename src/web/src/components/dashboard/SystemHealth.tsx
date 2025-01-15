// External imports
import React, { useEffect, useMemo } from 'react';
import { styled } from '@mui/material/styles';
import { Grid, Typography } from '@mui/material';

// Internal imports
import { ISystemMetrics } from '../../interfaces/IMetrics';
import { useMetrics } from '../../hooks/useMetrics';
import Card from '../common/Card';
import Chart from '../common/Chart';
import { formatChartData, createChartOptions } from '../../utils/charts';
import { MetricType } from '../../types/charts';

// Constants for health status thresholds
const HEALTH_THRESHOLDS = {
  GPU_UTILIZATION: { warning: 85, critical: 95 },
  GPU_TEMPERATURE: { warning: 75, critical: 85 },
  MEMORY_USAGE: { warning: 80, critical: 90 },
  STORAGE_USAGE: { warning: 85, critical: 95 }
} as const;

// Status colors for visual indicators
const STATUS_COLORS = {
  healthy: '#10b981',
  warning: '#f59e0b',
  critical: '#ef4444'
} as const;

// Styled components
const StatusIndicator = styled('div')<{ status: keyof typeof STATUS_COLORS }>(
  ({ theme, status }) => ({
    width: 12,
    height: 12,
    borderRadius: '50%',
    backgroundColor: STATUS_COLORS[status],
    marginRight: theme.spacing(1),
    transition: theme.transitions.create(['background-color'], {
      duration: theme.transitions.duration.short
    })
  })
);

const MetricValue = styled(Typography)(({ theme }) => ({
  fontSize: '1.5rem',
  fontWeight: 600,
  color: theme.palette.text.primary,
  marginBottom: theme.spacing(1)
}));

const MetricLabel = styled(Typography)(({ theme }) => ({
  fontSize: '0.875rem',
  color: theme.palette.text.secondary,
  marginBottom: theme.spacing(0.5)
}));

// Interface for component props
interface SystemHealthProps {
  pollingInterval?: number;
  chartHeight?: string;
  errorRetryCount?: number;
  temperatureUnit?: 'C' | 'F';
  locale?: string;
}

/**
 * Determines system health status based on metrics thresholds
 */
const getHealthStatus = (metrics: ISystemMetrics): 'healthy' | 'warning' | 'critical' => {
  if (!metrics) return 'healthy';

  if (
    metrics.gpuUtilization >= HEALTH_THRESHOLDS.GPU_UTILIZATION.critical ||
    metrics.gpuTemperature >= HEALTH_THRESHOLDS.GPU_TEMPERATURE.critical ||
    metrics.ramUsage >= HEALTH_THRESHOLDS.MEMORY_USAGE.critical ||
    metrics.storageUsage >= HEALTH_THRESHOLDS.STORAGE_USAGE.critical
  ) {
    return 'critical';
  }

  if (
    metrics.gpuUtilization >= HEALTH_THRESHOLDS.GPU_UTILIZATION.warning ||
    metrics.gpuTemperature >= HEALTH_THRESHOLDS.GPU_TEMPERATURE.warning ||
    metrics.ramUsage >= HEALTH_THRESHOLDS.MEMORY_USAGE.warning ||
    metrics.storageUsage >= HEALTH_THRESHOLDS.STORAGE_USAGE.warning
  ) {
    return 'warning';
  }

  return 'healthy';
};

/**
 * Formats metric values with appropriate units and localization
 */
const formatMetricValue = (value: number, metricType: string, locale: string): string => {
  const formatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  
  switch (metricType) {
    case 'temperature':
      return `${formatter.format(value)}°C`;
    case 'memory':
    case 'storage':
      return `${formatter.format(value)}%`;
    default:
      return `${formatter.format(value)}%`;
  }
};

/**
 * SystemHealth Component
 * Displays real-time system health metrics with enhanced temperature monitoring
 */
const SystemHealth: React.FC<SystemHealthProps> = ({
  pollingInterval = 30000,
  chartHeight = '300px',
  errorRetryCount = 3,
  temperatureUnit = 'C',
  locale = 'en-US'
}) => {
  const {
    gpuUtilization,
    gpuTemperature,
    isOverheating,
    temperatureHistory,
    isLoading,
    error
  } = useMetrics({
    pollingInterval,
    enabled: true,
    temperatureThreshold: HEALTH_THRESHOLDS.GPU_TEMPERATURE.warning
  });

  // Memoize chart data and options
  const chartData = useMemo(() => {
    if (!temperatureHistory.length) return null;
    
    return formatChartData(
      temperatureHistory.map((temp, index) => ({
        timestamp: Date.now() - (temperatureHistory.length - index) * pollingInterval,
        value: temp,
        temperature: temp,
        type: MetricType.GPU_TEMPERATURE
      })),
      'HOUR',
      locale
    );
  }, [temperatureHistory, pollingInterval, locale]);

  const chartOptions = useMemo(() => 
    createChartOptions({
      scales: {
        y: {
          title: {
            text: `Temperature (°${temperatureUnit})`
          }
        }
      }
    }, locale),
    [temperatureUnit, locale]
  );

  // Handle loading and error states
  if (isLoading) {
    return (
      <Card>
        <Typography>Loading system metrics...</Typography>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <Typography color="error">
          Error loading system metrics: {error}
        </Typography>
      </Card>
    );
  }

  const healthStatus = getHealthStatus({
    gpuUtilization,
    gpuTemperature,
    gpuMemoryUsage: 0,
    ramUsage: 0,
    storageUsage: 0,
    timestamp: Date.now()
  });

  return (
    <Grid container spacing={3}>
      {/* System Status Overview */}
      <Grid item xs={12}>
        <Card>
          <Grid container alignItems="center" spacing={2}>
            <Grid item>
              <StatusIndicator status={healthStatus} />
            </Grid>
            <Grid item>
              <Typography variant="h6">
                System Status: {healthStatus.charAt(0).toUpperCase() + healthStatus.slice(1)}
              </Typography>
            </Grid>
          </Grid>
        </Card>
      </Grid>

      {/* GPU Metrics */}
      <Grid item xs={12} md={6}>
        <Card>
          <MetricLabel>GPU Utilization</MetricLabel>
          <MetricValue>
            {formatMetricValue(gpuUtilization, 'utilization', locale)}
          </MetricValue>
          <Chart
            dataset={chartData!}
            type="line"
            height={chartHeight}
            options={chartOptions}
            thresholds={{
              warning: HEALTH_THRESHOLDS.GPU_UTILIZATION.warning,
              critical: HEALTH_THRESHOLDS.GPU_UTILIZATION.critical,
              warningColor: STATUS_COLORS.warning,
              criticalColor: STATUS_COLORS.critical
            }}
            accessibilityConfig={{
              ariaLabel: 'GPU utilization chart',
              description: 'Time series chart showing GPU utilization over time',
              keyboardNavigation: true
            }}
          />
        </Card>
      </Grid>

      {/* Temperature Monitoring */}
      <Grid item xs={12} md={6}>
        <Card>
          <MetricLabel>GPU Temperature</MetricLabel>
          <MetricValue>
            {formatMetricValue(gpuTemperature, 'temperature', locale)}
          </MetricValue>
          {isOverheating && (
            <Typography color="error" sx={{ mt: 1 }}>
              Warning: GPU temperature exceeds recommended threshold
            </Typography>
          )}
          <Chart
            dataset={chartData!}
            type="line"
            height={chartHeight}
            options={chartOptions}
            thresholds={{
              warning: HEALTH_THRESHOLDS.GPU_TEMPERATURE.warning,
              critical: HEALTH_THRESHOLDS.GPU_TEMPERATURE.critical,
              warningColor: STATUS_COLORS.warning,
              criticalColor: STATUS_COLORS.critical
            }}
            accessibilityConfig={{
              ariaLabel: 'GPU temperature chart',
              description: 'Time series chart showing GPU temperature over time',
              keyboardNavigation: true
            }}
          />
        </Card>
      </Grid>
    </Grid>
  );
};

export default SystemHealth;