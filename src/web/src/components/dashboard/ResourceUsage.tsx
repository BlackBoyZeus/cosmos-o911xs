import React, { memo, useMemo } from 'react';
import { Grid, Typography } from '@mui/material';
import Chart from '../common/Chart';
import Card from '../common/Card';
import { useMetrics } from '../../hooks/useMetrics';
import { MetricType, TimeRange } from '../../types/charts';

// Interface definitions
interface ResourceUsageProps {
  pollingInterval?: number;
  className?: string;
  timeRange?: TimeRange;
  showTemperature?: boolean;
  thresholds?: ResourceThresholds;
}

interface ResourceThresholds {
  temperature: {
    warning: number;
    critical: number;
  };
  memory: {
    warning: number;
    critical: number;
  };
  storage: {
    warning: number;
    critical: number;
  };
}

// Constants
const DEFAULT_POLLING_INTERVAL = 30000;
const DEFAULT_WARNING_TEMP = 75;
const DEFAULT_CRITICAL_TEMP = 85;
const DEFAULT_TIME_RANGE = TimeRange.HOUR;

// Chart color configuration
const CHART_COLORS = {
  normal: '#10b981',
  warning: '#f59e0b',
  critical: '#ef4444',
  background: '#f8fafc'
};

/**
 * ResourceUsage component for displaying system resource metrics
 * with enhanced temperature monitoring and accessibility
 */
const ResourceUsage: React.FC<ResourceUsageProps> = memo(({
  pollingInterval = DEFAULT_POLLING_INTERVAL,
  className,
  timeRange = DEFAULT_TIME_RANGE,
  showTemperature = true,
  thresholds = {
    temperature: { warning: DEFAULT_WARNING_TEMP, critical: DEFAULT_CRITICAL_TEMP },
    memory: { warning: 80, critical: 90 },
    storage: { warning: 85, critical: 95 }
  }
}) => {
  // Initialize metrics hook with polling
  const {
    gpuUtilization,
    gpuTemperature,
    temperatureHistory,
    modelMetrics,
    isLoading,
    error
  } = useMetrics({
    pollingInterval,
    enabled: true,
    temperatureThreshold: thresholds.temperature.critical
  });

  // Format GPU metrics for chart display
  const gpuMetrics = useMemo(() => ({
    label: 'GPU Utilization',
    data: gpuUtilization?.map(point => ({
      timestamp: point.timestamp,
      value: point.utilization,
      temperature: point.temperature,
      label: `${point.utilization.toFixed(1)}% @ ${point.temperature}°C`
    })) || [],
    borderColor: gpuTemperature > thresholds.temperature.critical
      ? CHART_COLORS.critical
      : gpuTemperature > thresholds.temperature.warning
        ? CHART_COLORS.warning
        : CHART_COLORS.normal,
    backgroundColor: `${CHART_COLORS.normal}20`,
    fill: true
  }), [gpuUtilization, gpuTemperature, thresholds]);

  // Format memory metrics
  const memoryMetrics = useMemo(() => ({
    label: 'Memory Usage',
    data: modelMetrics?.map(metric => ({
      timestamp: metric.timestamp,
      value: metric.gpuMemoryPeak,
      label: `${metric.gpuMemoryPeak.toFixed(1)}GB`
    })) || [],
    borderColor: CHART_COLORS.normal,
    backgroundColor: `${CHART_COLORS.normal}20`,
    fill: true
  }), [modelMetrics]);

  // Chart configuration with accessibility
  const chartConfig = useMemo(() => ({
    height: 200,
    options: {
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          title: {
            display: true,
            text: 'Utilization (%)'
          }
        }
      },
      plugins: {
        tooltip: {
          enabled: true,
          mode: 'index',
          intersect: false
        }
      }
    },
    accessibilityConfig: {
      ariaLabel: 'Resource utilization chart',
      description: 'Graph showing GPU and memory utilization over time',
      keyboardNavigation: true
    }
  }), []);

  // Error handling with retry option
  if (error) {
    return (
      <Card className={className}>
        <Typography color="error" align="center">
          Error loading metrics: {error}
        </Typography>
      </Card>
    );
  }

  return (
    <Grid container spacing={3} className={className}>
      {/* GPU Utilization Card */}
      <Grid item xs={12} md={6}>
        <Card>
          <Typography variant="h6" gutterBottom>
            GPU Utilization
            {showTemperature && (
              <Typography
                component="span"
                color={
                  gpuTemperature > thresholds.temperature.critical
                    ? 'error'
                    : gpuTemperature > thresholds.temperature.warning
                      ? 'warning'
                      : 'success'
                }
                sx={{ ml: 2 }}
              >
                {gpuTemperature}°C
              </Typography>
            )}
          </Typography>
          <Chart
            dataset={gpuMetrics}
            type="line"
            height={chartConfig.height}
            options={chartConfig.options}
            accessibilityConfig={chartConfig.accessibilityConfig}
            thresholds={{
              warning: thresholds.temperature.warning,
              critical: thresholds.temperature.critical,
              warningColor: CHART_COLORS.warning,
              criticalColor: CHART_COLORS.critical
            }}
          />
        </Card>
      </Grid>

      {/* Memory Usage Card */}
      <Grid item xs={12} md={6}>
        <Card>
          <Typography variant="h6" gutterBottom>
            Memory Usage
          </Typography>
          <Chart
            dataset={memoryMetrics}
            type="line"
            height={chartConfig.height}
            options={chartConfig.options}
            accessibilityConfig={{
              ...chartConfig.accessibilityConfig,
              ariaLabel: 'Memory usage chart'
            }}
            thresholds={{
              warning: thresholds.memory.warning,
              critical: thresholds.memory.critical,
              warningColor: CHART_COLORS.warning,
              criticalColor: CHART_COLORS.critical
            }}
          />
        </Card>
      </Grid>

      {/* Loading overlay */}
      {isLoading && (
        <div
          role="progressbar"
          aria-label="Loading metrics"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(255, 255, 255, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Typography>Loading metrics...</Typography>
        </div>
      )}
    </Grid>
  );
});

// Display name for debugging
ResourceUsage.displayName = 'ResourceUsage';

export default ResourceUsage;