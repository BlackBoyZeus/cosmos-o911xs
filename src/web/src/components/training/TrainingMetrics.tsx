import React, { useMemo, useCallback } from 'react';
import { Box, Grid, Typography } from '@mui/material';
import Chart from '../common/Chart';
import { useMetrics } from '../../hooks/useMetrics';
import { ModelMetrics } from '../../types/metrics';

// Constants for chart configuration
const CHART_HEIGHT = 300;
const TEMPERATURE_WARNING = 75;
const TEMPERATURE_CRITICAL = 85;
const CHART_COLORS = {
  primary: '#4F46E5',
  warning: '#F59E0B',
  critical: '#DC2626',
  success: '#10B981'
};

interface TrainingMetricsProps {
  modelId: string;
  pollingInterval?: number;
  showGpuMetrics?: boolean;
  showTemperature?: boolean;
  historyDuration?: number;
  temperatureThreshold?: number;
  enableAlerts?: boolean;
}

const TrainingMetrics: React.FC<TrainingMetricsProps> = ({
  modelId,
  pollingInterval = 30000,
  showGpuMetrics = true,
  showTemperature = true,
  historyDuration = 3600000, // 1 hour
  temperatureThreshold = TEMPERATURE_WARNING,
  enableAlerts = true
}) => {
  // Initialize metrics hook with configuration
  const {
    gpuUtilization,
    gpuTemperature,
    isOverheating,
    temperatureHistory,
    modelMetrics,
    isLoading,
    error
  } = useMetrics({
    pollingInterval,
    modelId,
    enabled: true,
    temperatureThreshold
  });

  // Format GPU utilization data for charts
  const utilizationDataset = useMemo(() => ({
    label: 'GPU Utilization',
    data: temperatureHistory.map((temp, index) => ({
      timestamp: Date.now() - (temperatureHistory.length - index) * pollingInterval,
      value: gpuUtilization || 0,
      temperature: temp,
      label: new Date().toISOString()
    })),
    borderColor: CHART_COLORS.primary,
    backgroundColor: `${CHART_COLORS.primary}20`,
    fill: true,
    tension: 0.4
  }), [temperatureHistory, gpuUtilization, pollingInterval]);

  // Format temperature data for charts
  const temperatureDataset = useMemo(() => ({
    label: 'GPU Temperature',
    data: temperatureHistory.map((temp, index) => ({
      timestamp: Date.now() - (temperatureHistory.length - index) * pollingInterval,
      value: temp,
      label: new Date().toISOString()
    })),
    borderColor: temp => 
      temp >= TEMPERATURE_CRITICAL ? CHART_COLORS.critical :
      temp >= TEMPERATURE_WARNING ? CHART_COLORS.warning :
      CHART_COLORS.success,
    backgroundColor: 'transparent',
    fill: false
  }), [temperatureHistory, pollingInterval]);

  // Format model performance metrics
  const performanceDataset = useMemo(() => {
    if (!modelMetrics) return null;
    return {
      label: 'Model Performance',
      data: [{
        timestamp: Date.now(),
        value: modelMetrics.psnrScore,
        label: 'PSNR Score'
      }],
      borderColor: CHART_COLORS.primary,
      backgroundColor: `${CHART_COLORS.primary}20`
    };
  }, [modelMetrics]);

  // Handle temperature alerts
  const handleTemperatureAlert = useCallback((temperature: number) => {
    if (!enableAlerts) return;
    
    if (temperature >= TEMPERATURE_CRITICAL) {
      console.error(`Critical GPU temperature: ${temperature}°C`);
    } else if (temperature >= TEMPERATURE_WARNING) {
      console.warn(`High GPU temperature: ${temperature}°C`);
    }
  }, [enableAlerts]);

  // Render loading state
  if (isLoading) {
    return (
      <Box p={2} textAlign="center">
        <Typography>Loading metrics...</Typography>
      </Box>
    );
  }

  // Render error state
  if (error) {
    return (
      <Box p={2} textAlign="center" color="error.main">
        <Typography>Error loading metrics: {error}</Typography>
      </Box>
    );
  }

  return (
    <Box p={2}>
      <Grid container spacing={3}>
        {/* GPU Utilization Chart */}
        {showGpuMetrics && (
          <Grid item xs={12} md={6}>
            <Box p={2} bgcolor="background.paper" borderRadius={1}>
              <Typography variant="h6" gutterBottom>
                GPU Utilization
              </Typography>
              <Chart
                dataset={utilizationDataset}
                type="line"
                height={CHART_HEIGHT}
                options={{
                  scales: {
                    y: {
                      beginAtZero: true,
                      max: 100,
                      title: {
                        display: true,
                        text: 'Utilization (%)'
                      }
                    }
                  }
                }}
                accessibilityConfig={{
                  ariaLabel: 'GPU utilization chart',
                  description: 'Real-time GPU utilization metrics',
                  keyboardNavigation: true
                }}
              />
            </Box>
          </Grid>
        )}

        {/* Temperature Chart */}
        {showTemperature && (
          <Grid item xs={12} md={6}>
            <Box p={2} bgcolor="background.paper" borderRadius={1}>
              <Typography variant="h6" gutterBottom>
                GPU Temperature
              </Typography>
              <Chart
                dataset={temperatureDataset}
                type="line"
                height={CHART_HEIGHT}
                options={{
                  scales: {
                    y: {
                      beginAtZero: true,
                      max: 100,
                      title: {
                        display: true,
                        text: 'Temperature (°C)'
                      }
                    }
                  }
                }}
                thresholds={{
                  warning: TEMPERATURE_WARNING,
                  critical: TEMPERATURE_CRITICAL,
                  warningColor: CHART_COLORS.warning,
                  criticalColor: CHART_COLORS.critical
                }}
                accessibilityConfig={{
                  ariaLabel: 'GPU temperature chart',
                  description: 'Real-time GPU temperature monitoring',
                  keyboardNavigation: true
                }}
              />
            </Box>
          </Grid>
        )}

        {/* Model Performance Metrics */}
        {modelMetrics && (
          <Grid item xs={12}>
            <Box p={2} bgcolor="background.paper" borderRadius={1}>
              <Typography variant="h6" gutterBottom>
                Model Performance
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6} md={3}>
                  <Typography variant="subtitle2">Generation Time</Typography>
                  <Typography>{modelMetrics.generationTime.toFixed(2)}s</Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="subtitle2">GPU Memory</Typography>
                  <Typography>{modelMetrics.gpuMemoryUsage.toFixed(1)} GB</Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="subtitle2">PSNR Score</Typography>
                  <Typography>{modelMetrics.psnrScore.toFixed(2)}</Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="subtitle2">FID Score</Typography>
                  <Typography>{modelMetrics.fidScore.toFixed(2)}</Typography>
                </Grid>
              </Grid>
            </Box>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default TrainingMetrics;