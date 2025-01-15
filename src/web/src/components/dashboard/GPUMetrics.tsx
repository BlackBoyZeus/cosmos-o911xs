// External imports - versions from package.json
import React, { useCallback, useMemo } from 'react'; // ^18.2.0

// Internal imports
import { ISystemMetrics } from '../../interfaces/IMetrics';
import { useMetrics } from '../../hooks/useMetrics';
import Chart from '../common/Chart';

/**
 * Props interface for GPUMetrics component with enhanced monitoring capabilities
 */
interface GPUMetricsProps {
  pollingInterval?: number;
  showTemperature?: boolean;
  height?: string;
  width?: string;
  selectedGPUs?: number[];
  temperatureWarningThreshold?: number;
  temperatureCriticalThreshold?: number;
  ariaLabel?: string;
}

/**
 * Constants for GPU monitoring
 */
const DEFAULT_POLLING_INTERVAL = 30000; // 30 seconds
const DEFAULT_WARNING_THRESHOLD = 75; // Celsius
const DEFAULT_CRITICAL_THRESHOLD = 85; // Celsius
const MAX_DATA_POINTS = 100;

/**
 * Chart color configuration
 */
const CHART_COLORS = {
  NORMAL: '#22C55E',
  WARNING: '#F59E0B',
  CRITICAL: '#DC2626',
  BACKGROUND: '#4F46E520'
};

/**
 * GPUMetrics component for real-time GPU monitoring with temperature alerts
 */
const GPUMetrics: React.FC<GPUMetricsProps> = React.memo(({
  pollingInterval = DEFAULT_POLLING_INTERVAL,
  showTemperature = true,
  height = '300px',
  width = '100%',
  selectedGPUs = [0],
  temperatureWarningThreshold = DEFAULT_WARNING_THRESHOLD,
  temperatureCriticalThreshold = DEFAULT_CRITICAL_THRESHOLD,
  ariaLabel = 'GPU Metrics Chart'
}) => {
  // Fetch GPU metrics using custom hook
  const {
    gpuUtilization,
    gpuTemperature,
    isOverheating,
    error,
    isLoading
  } = useMetrics({
    pollingInterval,
    enabled: true,
    temperatureThreshold: temperatureCriticalThreshold
  });

  /**
   * Format GPU metrics data for chart visualization
   */
  const formatGpuData = useCallback((metrics: ISystemMetrics) => {
    if (!metrics) return null;

    const selectedMetrics = selectedGPUs.map(gpuIndex => ({
      utilization: metrics.gpuUtilization[gpuIndex] || 0,
      temperature: metrics.gpuTemperature[gpuIndex] || 0,
      timestamp: Date.now()
    }));

    return selectedMetrics.map((metric, index) => ({
      label: `GPU ${selectedGPUs[index]}`,
      data: [{
        timestamp: metric.timestamp,
        value: metric.utilization,
        temperature: metric.temperature,
        label: new Date(metric.timestamp).toLocaleTimeString()
      }],
      borderColor: getTemperatureColor(metric.temperature),
      backgroundColor: CHART_COLORS.BACKGROUND,
      fill: true,
      tension: 0.4,
      pointRadius: 2,
      borderWidth: 2
    }));
  }, [selectedGPUs]);

  /**
   * Get color based on temperature thresholds
   */
  const getTemperatureColor = (temperature: number): string => {
    if (temperature >= temperatureCriticalThreshold) {
      return CHART_COLORS.CRITICAL;
    }
    if (temperature >= temperatureWarningThreshold) {
      return CHART_COLORS.WARNING;
    }
    return CHART_COLORS.NORMAL;
  };

  /**
   * Memoized chart options with temperature monitoring
   */
  const chartOptions = useMemo(() => ({
    scales: {
      x: {
        type: 'time',
        display: true,
        title: {
          display: true,
          text: 'Time'
        }
      },
      y: {
        type: 'linear',
        display: true,
        beginAtZero: true,
        max: 100,
        title: {
          display: true,
          text: 'Utilization (%)'
        },
        ticks: {
          callback: (value: number) => `${value}%`
        }
      }
    },
    plugins: {
      tooltip: {
        enabled: true,
        mode: 'index',
        intersect: false,
        callbacks: {
          label: (context: any) => {
            const point = context.raw;
            return [
              `Utilization: ${point.value.toFixed(1)}%`,
              showTemperature ? `Temperature: ${point.temperature}°C` : null
            ].filter(Boolean);
          }
        }
      }
    }
  }), [showTemperature]);

  /**
   * Render loading or error states
   */
  if (isLoading) {
    return <div aria-busy="true">Loading GPU metrics...</div>;
  }

  if (error) {
    return <div role="alert">Error loading GPU metrics: {error}</div>;
  }

  /**
   * Render GPU metrics chart with temperature monitoring
   */
  return (
    <div 
      style={{ height, width }} 
      className="gpu-metrics-container"
      role="region" 
      aria-label={ariaLabel}
    >
      <Chart
        dataset={formatGpuData({
          gpuUtilization,
          gpuTemperature,
          timestamp: Date.now()
        } as ISystemMetrics)}
        type="line"
        height={height}
        width={width}
        options={chartOptions}
        optimizationConfig={{
          downsampleThreshold: MAX_DATA_POINTS,
          targetPoints: MAX_DATA_POINTS
        }}
        accessibilityConfig={{
          ariaLabel,
          description: 'Real-time GPU utilization and temperature metrics',
          keyboardNavigation: true
        }}
        thresholds={{
          warning: temperatureWarningThreshold,
          critical: temperatureCriticalThreshold,
          warningColor: CHART_COLORS.WARNING,
          criticalColor: CHART_COLORS.CRITICAL
        }}
      />
      {isOverheating && (
        <div 
          role="alert" 
          className="temperature-warning"
          style={{ color: CHART_COLORS.CRITICAL }}
        >
          Warning: GPU temperature exceeds critical threshold
        </div>
      )}
    </div>
  );
});

// Display name for debugging
GPUMetrics.displayName = 'GPUMetrics';

export default GPUMetrics;