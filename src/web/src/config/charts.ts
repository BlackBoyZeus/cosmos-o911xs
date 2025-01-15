// External imports
import { Chart } from 'chart.js';
import { merge } from 'lodash';

// Internal imports
import { ChartType, ChartOptions } from '../types/charts';
import { ResourceMetrics } from '../types/common';

/**
 * Extended color palette constants including temperature gradients
 */
export const CHART_COLORS = {
  PRIMARY: '#4F46E5',
  SECONDARY: '#10B981',
  WARNING: '#F59E0B',
  DANGER: '#EF4444',
  GRAY: '#6B7280',
  TEMP_GRADIENT: ['#10B981', '#F59E0B', '#EF4444'],
  HEALTH_STATUS: {
    HEALTHY: '#10B981',
    WARNING: '#F59E0B',
    CRITICAL: '#EF4444'
  }
} as const;

/**
 * Enhanced default chart configuration with real-time and accessibility support
 */
export const CHART_DEFAULTS: ChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: {
    duration: 250,
    easing: 'easeInOutQuad'
  },
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        usePointStyle: true,
        padding: 20,
        font: {
          size: 12
        }
      }
    },
    tooltip: {
      enabled: true,
      mode: 'index',
      intersect: false,
      padding: 12,
      backgroundColor: 'rgba(17, 24, 39, 0.95)',
      titleFont: {
        size: 13,
        weight: 'bold'
      },
      bodyFont: {
        size: 12
      },
      callbacks: {
        label: (context: any) => {
          const value = context.raw;
          if (value.healthStatus) {
            return `${context.dataset.label}: ${value.value} (${value.healthStatus})`;
          }
          return `${context.dataset.label}: ${value.value}`;
        }
      }
    }
  },
  interaction: {
    mode: 'nearest',
    axis: 'x',
    intersect: false
  }
};

/**
 * Creates configuration for line charts with enhanced real-time update support
 */
const createLineChartConfig = (customOptions: Partial<ChartOptions> = {}): ChartOptions => {
  const lineDefaults = {
    scales: {
      x: {
        type: 'time',
        time: {
          unit: 'minute',
          displayFormats: {
            minute: 'HH:mm'
          }
        },
        grid: {
          display: false
        }
      },
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(107, 114, 128, 0.1)'
        }
      }
    },
    elements: {
      line: {
        tension: 0.4,
        borderWidth: 2
      },
      point: {
        radius: 0,
        hoverRadius: 4
      }
    },
    decimation: {
      enabled: true,
      algorithm: 'min-max'
    }
  };

  return merge({}, CHART_DEFAULTS, lineDefaults, customOptions);
};

/**
 * Creates configuration for bar charts with resource utilization indicators
 */
const createBarChartConfig = (customOptions: Partial<ChartOptions> = {}): ChartOptions => {
  const barDefaults = {
    scales: {
      x: {
        grid: {
          display: false
        }
      },
      y: {
        beginAtZero: true,
        max: 100,
        ticks: {
          callback: (value: number) => `${value}%`
        }
      }
    },
    elements: {
      bar: {
        borderWidth: 2,
        borderRadius: 4
      }
    },
    plugins: {
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const metrics: ResourceMetrics = context.raw;
            return [
              `Utilization: ${metrics.utilization}%`,
              `Temperature: ${metrics.temperature}°C`,
              `Status: ${metrics.status}`
            ];
          }
        }
      }
    }
  };

  return merge({}, CHART_DEFAULTS, barDefaults, customOptions);
};

/**
 * Creates configuration for gauge charts with temperature visualization
 */
const createGaugeChartConfig = (customOptions: Partial<ChartOptions> = {}): ChartOptions => {
  const gaugeDefaults = {
    circumference: 180,
    rotation: -90,
    cutout: '75%',
    scales: {
      r: {
        display: false
      }
    },
    plugins: {
      tooltip: {
        enabled: true,
        callbacks: {
          label: (context: any) => {
            const value = context.raw;
            return `Temperature: ${value}°C`;
          }
        }
      }
    }
  };

  return merge({}, CHART_DEFAULTS, gaugeDefaults, customOptions);
};

/**
 * Factory function to create chart configurations based on chart type
 */
export const createChartConfig = (
  type: ChartType,
  customOptions: Partial<ChartOptions> = {}
): ChartOptions => {
  switch (type) {
    case ChartType.Line:
      return createLineChartConfig(customOptions);
    case ChartType.Bar:
      return createBarChartConfig(customOptions);
    case ChartType.Gauge:
      return createGaugeChartConfig(customOptions);
    default:
      return merge({}, CHART_DEFAULTS, customOptions);
  }
};

/**
 * Helper function to get color based on temperature thresholds
 */
export const getTemperatureColor = (temperature: number): string => {
  if (temperature >= 80) return CHART_COLORS.DANGER;
  if (temperature >= 60) return CHART_COLORS.WARNING;
  return CHART_COLORS.SECONDARY;
};

/**
 * Helper function to get color based on health status
 */
export const getHealthStatusColor = (status: string): string => {
  switch (status.toUpperCase()) {
    case 'CRITICAL':
      return CHART_COLORS.DANGER;
    case 'WARNING':
      return CHART_COLORS.WARNING;
    default:
      return CHART_COLORS.SECONDARY;
  }
};