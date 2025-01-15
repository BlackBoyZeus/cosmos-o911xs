// External imports - v18.0.0+
import React, { useRef, useEffect, useMemo } from 'react';
// Chart.js v4.0.0+
import { Chart as ChartJS } from 'chart.js/auto';
// React-ChartJS-2 v5.0.0+
import { Line, Bar } from 'react-chartjs-2';

// Internal imports
import { 
  ChartDataPoint, 
  ChartDataset, 
  ChartOptions 
} from '../../types/charts';
import { 
  formatChartData, 
  createChartOptions 
} from '../../utils/charts';

/**
 * Interface for chart component props with enhanced accessibility and optimization
 */
interface ChartProps {
  dataset: ChartDataset;
  type: 'line' | 'bar' | 'gauge';
  height?: number | string;
  width?: number | string;
  options?: Partial<ChartOptions>;
  optimizationConfig?: {
    downsampleThreshold: number;
    targetPoints: number;
  };
  accessibilityConfig?: {
    ariaLabel: string;
    description: string;
    keyboardNavigation: boolean;
  };
  thresholds?: {
    warning: number;
    critical: number;
    warningColor: string;
    criticalColor: string;
  };
}

/**
 * Enhanced React hook for chart lifecycle management with accessibility
 */
const useChartEffect = (
  canvasRef: React.RefObject<HTMLCanvasElement>,
  dataset: ChartDataset,
  options: ChartOptions,
  optimizationConfig?: ChartProps['optimizationConfig']
) => {
  useEffect(() => {
    if (!canvasRef.current) return;

    // Performance optimization for large datasets
    const optimizedData = useMemo(() => {
      if (optimizationConfig && 
          dataset.data.length > optimizationConfig.downsampleThreshold) {
        return dataset.data.filter((_, index) => 
          index % Math.ceil(dataset.data.length / optimizationConfig.targetPoints) === 0
        );
      }
      return dataset.data;
    }, [dataset.data, optimizationConfig]);

    // Configure chart instance with accessibility support
    const chart = new ChartJS(canvasRef.current, {
      type: 'line',
      data: {
        ...dataset,
        data: optimizedData
      },
      options: {
        ...options,
        plugins: {
          ...options.plugins,
          accessibility: {
            enabled: true,
            announceNewData: true,
            descriptions: {
              axis: 'Time series data showing resource utilization and temperature metrics'
            },
            keyboardNavigation: {
              enabled: true,
              mode: 'xy'
            }
          }
        }
      }
    });

    // Cleanup on unmount
    return () => {
      chart.destroy();
    };
  }, [canvasRef, dataset, options, optimizationConfig]);
};

/**
 * Enhanced chart component with accessibility and performance optimizations
 */
const Chart: React.FC<ChartProps> = ({
  dataset,
  type = 'line',
  height = 300,
  width = '100%',
  options = {},
  optimizationConfig = {
    downsampleThreshold: 1000,
    targetPoints: 500
  },
  accessibilityConfig = {
    ariaLabel: 'Resource utilization chart',
    description: 'Visualization of system metrics over time',
    keyboardNavigation: true
  },
  thresholds
}) => {
  const chartRef = useRef<HTMLCanvasElement>(null);

  // Merge custom options with defaults and accessibility settings
  const chartOptions = useMemo(() => {
    return createChartOptions({
      ...options,
      plugins: {
        ...options.plugins,
        tooltip: {
          enabled: true,
          mode: 'index',
          intersect: false,
          callbacks: {
            label: (context: any) => {
              const point = context.raw as ChartDataPoint;
              return [
                `Value: ${point.value.toFixed(1)}%`,
                `Temperature: ${point.temperature}°C`
              ];
            }
          }
        }
      }
    });
  }, [options]);

  // Apply threshold-based styling
  const styledDataset = useMemo(() => {
    if (!thresholds) return dataset;

    return {
      ...dataset,
      borderColor: dataset.data.map(point => {
        if (point.value >= thresholds.critical) return thresholds.criticalColor;
        if (point.value >= thresholds.warning) return thresholds.warningColor;
        return dataset.borderColor;
      })
    };
  }, [dataset, thresholds]);

  // Initialize chart with accessibility and optimization
  useChartEffect(chartRef, styledDataset, chartOptions, optimizationConfig);

  // Render appropriate chart type with accessibility attributes
  const renderChart = () => {
    const commonProps = {
      ref: chartRef,
      data: styledDataset,
      options: chartOptions,
      height,
      width,
      'aria-label': accessibilityConfig.ariaLabel,
      role: 'img',
      tabIndex: accessibilityConfig.keyboardNavigation ? 0 : -1
    };

    switch (type) {
      case 'bar':
        return <Bar {...commonProps} />;
      case 'gauge':
        // Implement gauge chart rendering if needed
        return null;
      default:
        return <Line {...commonProps} />;
    }
  };

  return (
    <div 
      style={{ height, width }} 
      role="region" 
      aria-label={accessibilityConfig.ariaLabel}
    >
      {renderChart()}
      {/* Hidden description for screen readers */}
      <span className="sr-only">
        {accessibilityConfig.description}
      </span>
    </div>
  );
};

export default Chart;