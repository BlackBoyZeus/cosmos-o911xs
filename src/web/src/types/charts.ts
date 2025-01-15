// External imports
import { ChartConfiguration } from 'chart.js';

// Internal imports
import { ResourceMetrics } from './common';

/**
 * Interface for individual data points in charts
 */
export interface ChartDataPoint {
  timestamp: number;
  value: number;
  label: string;
}

/**
 * Interface for chart datasets containing multiple data points
 */
export interface ChartDataset {
  label: string;
  data: ChartDataPoint[];
  borderColor: string;
  backgroundColor: string;
  fill?: boolean;
  tension?: number;
  pointRadius?: number;
  borderWidth?: number;
}

/**
 * Interface for chart configuration options extending Chart.js config
 */
export interface ChartOptions extends Omit<ChartConfiguration['options'], 'scales'> {
  responsive: boolean;
  maintainAspectRatio: boolean;
  scales: {
    x: {
      type: 'time' | 'linear';
      display: boolean;
      title?: {
        display: boolean;
        text: string;
      };
      time?: {
        unit: 'hour' | 'day' | 'week' | 'month';
      };
    };
    y: {
      type: 'linear';
      display: boolean;
      beginAtZero: boolean;
      title?: {
        display: boolean;
        text: string;
      };
      ticks?: {
        callback?: (value: number) => string;
      };
    };
  };
  plugins: {
    legend: {
      position: 'top' | 'bottom' | 'left' | 'right';
      display: boolean;
    };
    tooltip: {
      enabled: boolean;
      mode: 'index' | 'nearest' | 'point';
      intersect: boolean;
    };
    title?: {
      display: boolean;
      text: string;
    };
  };
}

/**
 * Enumeration for chart time range options
 */
export enum TimeRange {
  HOUR = '1h',
  DAY = '24h',
  WEEK = '7d',
  MONTH = '30d'
}

/**
 * Enumeration for different types of metrics that can be visualized
 */
export enum MetricType {
  GPU_UTILIZATION = 'gpu_utilization',
  GPU_MEMORY = 'gpu_memory',
  GPU_TEMPERATURE = 'gpu_temperature',
  MEMORY_USAGE = 'memory_usage',
  STORAGE_USAGE = 'storage_usage',
  NETWORK_THROUGHPUT = 'network_throughput'
}

/**
 * Interface for chart axis configuration
 */
export interface ChartAxis {
  label: string;
  unit?: string;
  min?: number;
  max?: number;
  stepSize?: number;
  format?: (value: number) => string;
}

/**
 * Interface for resource monitoring chart data
 */
export interface ResourceChartData {
  metrics: ResourceMetrics[];
  timeRange: TimeRange;
  metricType: MetricType;
  chartOptions?: Partial<ChartOptions>;
}

/**
 * Default chart configuration options
 */
export const DEFAULT_CHART_OPTIONS: ChartOptions = {
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
      }
    },
    y: {
      type: 'linear',
      display: true,
      beginAtZero: true,
      title: {
        display: true,
        text: 'Value'
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
      intersect: false
    }
  }
};

/**
 * Type for chart color configuration
 */
export interface ChartColors {
  borderColor: string;
  backgroundColor: string;
  pointBackgroundColor?: string;
  pointBorderColor?: string;
}

/**
 * Interface for chart theme configuration
 */
export interface ChartTheme {
  backgroundColor: string;
  gridColor: string;
  textColor: string;
  colors: ChartColors[];
}