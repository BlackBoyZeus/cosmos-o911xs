import { ChartConfiguration } from 'chart.js'; // ^4.0.0

// Chart type enumerations
export enum ChartType {
  Line = 'line',
  Bar = 'bar',
  Gauge = 'gauge',
  Area = 'area'
}

// Color constants
const CHART_COLORS = {
  PRIMARY: '#4F46E5',
  SECONDARY: '#10B981',
  WARNING: '#F59E0B',
  DANGER: '#EF4444',
  GRAY: '#6B7280',
  BACKGROUND: '#FFFFFF',
  TEXT: '#111827',
  GRID: '#E5E7EB'
} as const;

// Default chart configuration
const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  animation: {
    duration: 250,
    easing: 'easeInOutQuad'
  },
  plugins: {
    legend: {
      position: 'bottom' as const,
      labels: {
        usePointStyle: true,
        padding: 20
      }
    },
    tooltip: {
      enabled: true,
      mode: 'index' as const,
      intersect: false,
      position: 'nearest' as const,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      padding: 12,
      cornerRadius: 4
    }
  },
  interaction: {
    mode: 'nearest' as const,
    axis: 'x' as const,
    intersect: false
  }
} as const;

// Helper functions for creating chart options
const createLineChartOptions = (customOptions: Partial<ChartConfiguration['options']> = {}): ChartConfiguration['options'] => ({
  ...CHART_DEFAULTS,
  scales: {
    x: {
      grid: {
        color: CHART_COLORS.GRID,
        drawBorder: false
      },
      ticks: {
        color: CHART_COLORS.TEXT
      }
    },
    y: {
      beginAtZero: true,
      grid: {
        color: CHART_COLORS.GRID,
        drawBorder: false
      },
      ticks: {
        color: CHART_COLORS.TEXT
      }
    }
  },
  elements: {
    line: {
      tension: 0.4
    },
    point: {
      radius: 2,
      hoverRadius: 4
    }
  },
  ...customOptions
});

const createBarChartOptions = (customOptions: Partial<ChartConfiguration['options']> = {}): ChartConfiguration['options'] => ({
  ...CHART_DEFAULTS,
  scales: {
    x: {
      grid: {
        display: false
      },
      ticks: {
        color: CHART_COLORS.TEXT
      }
    },
    y: {
      beginAtZero: true,
      grid: {
        color: CHART_COLORS.GRID
      },
      ticks: {
        color: CHART_COLORS.TEXT
      }
    }
  },
  ...customOptions
});

const createGaugeChartOptions = (customOptions: Partial<ChartConfiguration['options']> = {}): ChartConfiguration['options'] => ({
  ...CHART_DEFAULTS,
  rotation: -90,
  circumference: 180,
  cutout: '80%',
  elements: {
    arc: {
      borderWidth: 0
    }
  },
  ...customOptions
});

// Exported chart configurations
export const GPU_UTILIZATION_OPTIONS: ChartConfiguration = {
  type: ChartType.Line,
  options: createLineChartOptions({
    plugins: {
      title: {
        display: true,
        text: 'GPU Utilization',
        color: CHART_COLORS.TEXT
      }
    },
    scales: {
      y: {
        max: 100,
        ticks: {
          callback: (value) => `${value}%`
        }
      }
    }
  })
};

export const MEMORY_USAGE_OPTIONS: ChartConfiguration = {
  type: ChartType.Bar,
  options: createBarChartOptions({
    plugins: {
      title: {
        display: true,
        text: 'Memory Usage',
        color: CHART_COLORS.TEXT
      }
    },
    scales: {
      y: {
        max: 100,
        ticks: {
          callback: (value) => `${value}%`
        }
      }
    }
  })
};

export const MODEL_METRICS_OPTIONS: ChartConfiguration = {
  type: ChartType.Line,
  options: createLineChartOptions({
    plugins: {
      title: {
        display: true,
        text: 'Model Performance Metrics',
        color: CHART_COLORS.TEXT
      }
    },
    scales: {
      y: {
        ticks: {
          precision: 2
        }
      }
    }
  })
};

export const STORAGE_METRICS_OPTIONS: ChartConfiguration = {
  type: ChartType.Gauge,
  options: createGaugeChartOptions({
    plugins: {
      title: {
        display: true,
        text: 'Storage Usage',
        color: CHART_COLORS.TEXT
      }
    },
    layout: {
      padding: {
        bottom: 30
      }
    }
  })
};

// Accessibility configurations
Object.values([
  GPU_UTILIZATION_OPTIONS,
  MEMORY_USAGE_OPTIONS,
  MODEL_METRICS_OPTIONS,
  STORAGE_METRICS_OPTIONS
]).forEach(config => {
  if (config.options && config.options.plugins) {
    config.options.plugins.tooltip = {
      ...config.options.plugins.tooltip,
      callbacks: {
        label: (context: any) => {
          return `${context.dataset.label}: ${context.formattedValue}`;
        }
      },
      displayColors: true,
      titleFont: {
        weight: 'bold'
      },
      bodyFont: {
        size: 14
      },
      titleMarginBottom: 8,
      padding: {
        x: 12,
        y: 8
      }
    };
  }
});