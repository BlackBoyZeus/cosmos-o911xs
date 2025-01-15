// External imports
import { merge, memoize } from 'lodash';
import { format } from 'date-fns';

// Internal imports
import { ChartDataPoint, ChartDataset, TimeRange, ChartOptions } from '../types/charts';
import { ResourceMetrics } from '../types/common';

// Constants for time ranges in milliseconds
const DEFAULT_TIME_RANGES = {
  HOUR: 3600000,
  DAY: 86400000,
  WEEK: 604800000,
  MONTH: 2592000000
};

// Chart color configuration
const CHART_COLORS = {
  PRIMARY: '#4F46E5',
  SECONDARY: '#10B981',
  WARNING: '#F59E0B',
  DANGER: '#EF4444',
  TEMPERATURE_NORMAL: '#22C55E',
  TEMPERATURE_WARNING: '#F59E0B',
  TEMPERATURE_CRITICAL: '#DC2626'
};

// Temperature thresholds for GPU monitoring
const TEMPERATURE_THRESHOLDS = {
  WARNING: 75,
  CRITICAL: 85
};

/**
 * Formats raw metric data into chart-compatible format with temperature support
 * @param data Array of metric data points
 * @param timeRange Selected time range for filtering
 * @param timezone User's timezone for date formatting
 * @returns Formatted chart dataset
 */
export const formatChartData = memoize((
  data: ResourceMetrics[],
  timeRange: TimeRange,
  timezone: string
): ChartDataset => {
  const now = Date.now();
  const rangeMs = DEFAULT_TIME_RANGES[timeRange];
  const cutoffTime = now - rangeMs;

  // Filter and transform data points
  const filteredData = data
    .filter(metric => metric.timestamp >= cutoffTime)
    .map(metric => ({
      timestamp: metric.timestamp,
      value: metric.utilization,
      temperature: metric.temperature,
      label: format(metric.timestamp, 'PPpp', { timeZone: timezone })
    }));

  // Optimize data density for large datasets
  const optimizedData = filteredData.length > 1000 
    ? downsampleDataPoints(filteredData, 1000)
    : filteredData;

  // Apply temperature-based styling
  const getTemperatureColor = (temp: number): string => {
    if (temp >= TEMPERATURE_THRESHOLDS.CRITICAL) return CHART_COLORS.TEMPERATURE_CRITICAL;
    if (temp >= TEMPERATURE_THRESHOLDS.WARNING) return CHART_COLORS.TEMPERATURE_WARNING;
    return CHART_COLORS.TEMPERATURE_NORMAL;
  };

  return {
    label: 'GPU Utilization',
    data: optimizedData,
    borderColor: optimizedData.map(d => getTemperatureColor(d.temperature)),
    backgroundColor: CHART_COLORS.PRIMARY + '20', // 20% opacity
    fill: true,
    tension: 0.4,
    pointRadius: 2,
    borderWidth: 2
  };
});

/**
 * Aggregates multiple datasets with support for weighted averaging
 * @param datasets Array of chart datasets to aggregate
 * @param aggregationType Type of aggregation to perform
 * @returns Aggregated dataset with interpolated values
 */
export const aggregateMetrics = memoize((
  datasets: ChartDataset[],
  aggregationType: 'avg' | 'max' | 'min' = 'avg'
): ChartDataset => {
  // Collect all unique timestamps
  const timestamps = new Set<number>();
  datasets.forEach(dataset => {
    dataset.data.forEach(point => timestamps.add(point.timestamp));
  });

  // Sort timestamps chronologically
  const sortedTimestamps = Array.from(timestamps).sort((a, b) => a - b);

  // Interpolate missing values and aggregate
  const aggregatedData = sortedTimestamps.map(timestamp => {
    const values = datasets.map(dataset => {
      const point = dataset.data.find(p => p.timestamp === timestamp);
      if (point) return point.value;
      
      // Interpolate missing values
      const nearestPoints = findNearestPoints(dataset.data, timestamp);
      return interpolateValue(nearestPoints, timestamp);
    });

    // Calculate aggregated value based on type
    let value: number;
    switch (aggregationType) {
      case 'max':
        value = Math.max(...values);
        break;
      case 'min':
        value = Math.min(...values);
        break;
      default:
        value = values.reduce((sum, val) => sum + val, 0) / values.length;
    }

    return {
      timestamp,
      value,
      label: format(timestamp, 'PPpp')
    };
  });

  return {
    label: `${aggregationType.toUpperCase()} Metrics`,
    data: aggregatedData,
    borderColor: CHART_COLORS.PRIMARY,
    backgroundColor: CHART_COLORS.PRIMARY + '20',
    fill: true,
    tension: 0.4
  };
});

/**
 * Creates customized chart options with enhanced GPU monitoring support
 * @param customOptions Custom chart configuration options
 * @param locale User's locale for formatting
 * @returns Merged chart configuration with accessibility support
 */
export const createChartOptions = memoize((
  customOptions: Partial<ChartOptions> = {},
  locale: string = 'en-US'
): ChartOptions => {
  const defaultOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 250
    },
    scales: {
      x: {
        type: 'time',
        display: true,
        title: {
          display: true,
          text: 'Time'
        },
        time: {
          unit: 'hour'
        }
      },
      y: {
        type: 'linear',
        display: true,
        beginAtZero: true,
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
      legend: {
        position: 'bottom',
        display: true
      },
      tooltip: {
        enabled: true,
        mode: 'index',
        intersect: false,
        callbacks: {
          label: (context: any) => {
            const dataset = context.dataset;
            const point = dataset.data[context.dataIndex];
            return [
              `Utilization: ${point.value.toFixed(1)}%`,
              `Temperature: ${point.temperature}°C`
            ];
          }
        }
      }
    }
  };

  return merge({}, defaultOptions, customOptions);
});

/**
 * Helper function to downsample data points for performance
 * @param data Array of data points
 * @param targetCount Target number of points
 * @returns Downsampled array of points
 */
const downsampleDataPoints = (data: ChartDataPoint[], targetCount: number): ChartDataPoint[] => {
  if (data.length <= targetCount) return data;
  
  const factor = Math.floor(data.length / targetCount);
  return data.filter((_, index) => index % factor === 0);
};

/**
 * Helper function to find nearest data points for interpolation
 * @param data Array of data points
 * @param timestamp Target timestamp
 * @returns Tuple of nearest points
 */
const findNearestPoints = (
  data: ChartDataPoint[],
  timestamp: number
): [ChartDataPoint, ChartDataPoint] | null => {
  const before = [...data]
    .reverse()
    .find(point => point.timestamp <= timestamp);
  const after = data
    .find(point => point.timestamp >= timestamp);

  if (!before || !after) return null;
  return [before, after];
};

/**
 * Helper function to interpolate value between two points
 * @param points Tuple of points to interpolate between
 * @param timestamp Target timestamp
 * @returns Interpolated value
 */
const interpolateValue = (
  points: [ChartDataPoint, ChartDataPoint] | null,
  timestamp: number
): number => {
  if (!points) return 0;
  const [before, after] = points;
  
  const timeDiff = after.timestamp - before.timestamp;
  const valueDiff = after.value - before.value;
  const ratio = (timestamp - before.timestamp) / timeDiff;
  
  return before.value + (valueDiff * ratio);
};