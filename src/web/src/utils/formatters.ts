// External imports
import { format } from 'date-fns';
import { memoize } from 'lodash';

// Internal imports
import { ResourceType } from '../types/common';
import { ResourceMetrics } from '../types/metrics';

/**
 * Formats Unix timestamps into human-readable date/time strings
 * @version date-fns ^2.30.0
 */
export const formatTimestamp = memoize((
  timestamp: number,
  formatStr: string = 'yyyy-MM-dd HH:mm:ss',
  locale: string = 'en-US'
): string => {
  if (!timestamp) {
    return '-';
  }
  try {
    const date = new Date(timestamp);
    return format(date, formatStr);
  } catch (error) {
    console.error('Error formatting timestamp:', error);
    return '-';
  }
});

/**
 * Converts bytes to appropriate unit (KB, MB, GB, TB)
 */
const formatBytes = memoize((bytes: number, decimals: number = 2): string => {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
});

/**
 * Formats resource values with appropriate units based on resource type
 */
export const formatResourceValue = memoize((
  value: number,
  resourceType: ResourceType,
  locale: string = 'en-US'
): string => {
  if (value === undefined || value === null) {
    return '-';
  }

  const formatter = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0
  });

  switch (resourceType) {
    case ResourceType.GPU:
      return `${formatter.format(value)}%`;
      
    case ResourceType.MEMORY:
      return formatBytes(value);
      
    case ResourceType.STORAGE:
      return formatBytes(value);
      
    default:
      return formatter.format(value);
  }
});

/**
 * Formats model performance metric values with type-specific precision
 */
export const formatMetricValue = memoize((
  value: number,
  metricType: string,
  options: { precision?: number; showUnit?: boolean } = {}
): string => {
  if (value === undefined || value === null) {
    return '-';
  }

  const { precision = 2, showUnit = true } = options;
  const formattedValue = value.toFixed(precision);

  switch (metricType.toLowerCase()) {
    case 'psnr':
      return showUnit ? `${formattedValue} dB` : formattedValue;
      
    case 'fid':
    case 'fvd':
      return formattedValue;
      
    case 'sampsonerror':
      return showUnit ? `${formattedValue} px` : formattedValue;
      
    case 'generationtime':
      return showUnit ? `${formattedValue}s` : formattedValue;
      
    case 'gpumemory':
      return showUnit ? `${formattedValue} GB` : formattedValue;
      
    default:
      return formattedValue;
  }
});

/**
 * Formats complete resource metrics object including temperature and utilization
 */
export const formatResourceMetrics = memoize((
  metrics: ResourceMetrics,
  locale: string = 'en-US'
): {
  utilization: string;
  used: string;
  total: string;
  temperature?: string;
} => {
  const formatter = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0
  });

  const result = {
    utilization: `${formatter.format(metrics.utilization)}%`,
    used: formatResourceValue(metrics.used, metrics.resourceType, locale),
    total: formatResourceValue(metrics.total, metrics.resourceType, locale)
  };

  if (metrics.temperature !== undefined) {
    return {
      ...result,
      temperature: `${formatter.format(metrics.temperature)}°C`
    };
  }

  return result;
});

/**
 * Formats percentage values with consistent precision
 */
export const formatPercentage = memoize((
  value: number,
  precision: number = 1,
  locale: string = 'en-US'
): string => {
  if (value === undefined || value === null) {
    return '-';
  }

  const formatter = new Intl.NumberFormat(locale, {
    maximumFractionDigits: precision,
    minimumFractionDigits: 0
  });

  return `${formatter.format(value)}%`;
});