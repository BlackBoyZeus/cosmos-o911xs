// External imports
import { describe, test, expect } from '@jest/globals';

// Internal imports
import { 
  formatTimestamp,
  formatResourceValue,
  formatPercentage,
  formatMetricValue,
  formatResourceMetrics
} from '../../src/utils/formatters';
import { ResourceType } from '../../src/types/common';

// Test constants
const TEST_TIMESTAMP = 1633027200000; // 2021-10-01 00:00:00 UTC
const TEST_GPU_METRICS = {
  resourceType: ResourceType.GPU,
  utilization: 0.75,
  used: 12288,
  total: 16384,
  temperature: 78.5
};
const TEST_MEMORY_METRICS = {
  resourceType: ResourceType.MEMORY,
  utilization: 0.82,
  used: 209715200,
  total: 262144000
};
const TEST_MODEL_METRICS = {
  psnr: 32.8,
  fid: 18.45,
  fvd: 128.92
};
const TEST_LOCALES = ['en-US', 'de-DE', 'ja-JP'];

describe('formatTimestamp', () => {
  test('formats timestamp with default format', () => {
    const result = formatTimestamp(TEST_TIMESTAMP);
    expect(result).toBe('2021-10-01 00:00:00');
  });

  test('formats timestamp with custom format', () => {
    const result = formatTimestamp(TEST_TIMESTAMP, 'MM/dd/yyyy HH:mm');
    expect(result).toBe('10/01/2021 00:00');
  });

  test('handles invalid timestamp', () => {
    const result = formatTimestamp(NaN);
    expect(result).toBe('-');
  });

  test('handles null timestamp', () => {
    const result = formatTimestamp(null as any);
    expect(result).toBe('-');
  });
});

describe('formatResourceValue', () => {
  test('formats GPU memory values', () => {
    const result = formatResourceValue(TEST_GPU_METRICS.used, ResourceType.GPU);
    expect(result).toBe('12 GB');
  });

  test('formats system memory values', () => {
    const result = formatResourceValue(TEST_MEMORY_METRICS.used, ResourceType.MEMORY);
    expect(result).toBe('200 MB');
  });

  test('formats zero values', () => {
    const result = formatResourceValue(0, ResourceType.STORAGE);
    expect(result).toBe('0 B');
  });

  test('handles null values', () => {
    const result = formatResourceValue(null as any, ResourceType.GPU);
    expect(result).toBe('-');
  });

  TEST_LOCALES.forEach(locale => {
    test(`formats values with ${locale} locale`, () => {
      const result = formatResourceValue(1234.56, ResourceType.GPU, locale);
      expect(result).toMatch(/[\d,.]+%/);
    });
  });
});

describe('formatPercentage', () => {
  test('formats decimal to percentage', () => {
    const result = formatPercentage(0.756);
    expect(result).toBe('75.6%');
  });

  test('formats percentage with custom precision', () => {
    const result = formatPercentage(0.756, 2);
    expect(result).toBe('75.60%');
  });

  test('handles boundary values', () => {
    expect(formatPercentage(0)).toBe('0%');
    expect(formatPercentage(1)).toBe('100%');
  });

  test('handles invalid values', () => {
    expect(formatPercentage(null as any)).toBe('-');
    expect(formatPercentage(undefined as any)).toBe('-');
  });

  TEST_LOCALES.forEach(locale => {
    test(`formats percentage with ${locale} locale`, () => {
      const result = formatPercentage(0.756, 1, locale);
      expect(result).toMatch(/[\d,.]+%/);
    });
  });
});

describe('formatMetricValue', () => {
  test('formats PSNR scores', () => {
    const result = formatMetricValue(TEST_MODEL_METRICS.psnr, 'psnr');
    expect(result).toBe('32.80 dB');
  });

  test('formats FID scores', () => {
    const result = formatMetricValue(TEST_MODEL_METRICS.fid, 'fid');
    expect(result).toBe('18.45');
  });

  test('formats FVD scores', () => {
    const result = formatMetricValue(TEST_MODEL_METRICS.fvd, 'fvd');
    expect(result).toBe('128.92');
  });

  test('formats values without units', () => {
    const result = formatMetricValue(TEST_MODEL_METRICS.psnr, 'psnr', { showUnit: false });
    expect(result).toBe('32.80');
  });

  test('formats values with custom precision', () => {
    const result = formatMetricValue(TEST_MODEL_METRICS.psnr, 'psnr', { precision: 1 });
    expect(result).toBe('32.8 dB');
  });

  test('handles invalid values', () => {
    expect(formatMetricValue(null as any, 'psnr')).toBe('-');
    expect(formatMetricValue(undefined as any, 'fid')).toBe('-');
  });
});

describe('formatResourceMetrics', () => {
  test('formats GPU metrics with temperature', () => {
    const result = formatResourceMetrics(TEST_GPU_METRICS);
    expect(result).toEqual({
      utilization: '75%',
      used: '12 GB',
      total: '16 GB',
      temperature: '78.5°C'
    });
  });

  test('formats memory metrics without temperature', () => {
    const result = formatResourceMetrics(TEST_MEMORY_METRICS);
    expect(result).toEqual({
      utilization: '82%',
      used: '200 MB',
      total: '250 MB'
    });
  });

  test('handles missing temperature', () => {
    const metricsWithoutTemp = { ...TEST_GPU_METRICS };
    delete metricsWithoutTemp.temperature;
    const result = formatResourceMetrics(metricsWithoutTemp);
    expect(result.temperature).toBeUndefined();
  });

  TEST_LOCALES.forEach(locale => {
    test(`formats metrics with ${locale} locale`, () => {
      const result = formatResourceMetrics(TEST_GPU_METRICS, locale);
      expect(result.utilization).toMatch(/[\d,.]+%/);
      expect(result.temperature).toMatch(/[\d,.]+°C/);
    });
  });
});