import { jest, describe, beforeEach, afterEach, test, expect } from '@jest/globals'; // ^29.0.0
import supertest from 'supertest'; // ^6.3.0
import { getGPUMetrics } from '../../../backend/src/utils/gpu';
import { MetricsCollector } from '../../../backend/src/utils/metrics';
import { mockGetGPUMetrics, mockSimulateGPUStress } from '../../utils/gpuMock';

// Constants for test configuration
const METRICS_COLLECTION_INTERVAL = 1000; // 1 second
const GPU_UTILIZATION_THRESHOLD = 90; // 90% max utilization
const GPU_MEMORY_THRESHOLD = 85; // 85% max memory usage
const METRIC_SAMPLE_COUNT = 20;
const ERROR_RETRY_ATTEMPTS = 3;

// Mock GPU metrics collector
jest.mock('../../../backend/src/utils/gpu', () => ({
  getGPUMetrics: jest.fn()
}));

describe('GPU Utilization Metrics Tests', () => {
  let metricsCollector: MetricsCollector;
  let collectionInterval: NodeJS.Timer;

  beforeEach(() => {
    metricsCollector = MetricsCollector.getInstance();
    // Reset mock implementations
    (getGPUMetrics as jest.Mock).mockImplementation(mockGetGPUMetrics);
  });

  afterEach(() => {
    if (collectionInterval) {
      clearInterval(collectionInterval);
    }
    jest.clearAllMocks();
  });

  test('Basic GPU metrics collection validates format and thresholds', async () => {
    // Start metrics collection
    const metrics = await getGPUMetrics(0);

    // Validate metric format
    expect(metrics).toHaveProperty('deviceId');
    expect(metrics).toHaveProperty('utilizationPercent');
    expect(metrics).toHaveProperty('memoryUsed');
    expect(metrics).toHaveProperty('memoryTotal');
    expect(metrics).toHaveProperty('temperature');

    // Validate threshold compliance
    expect(metrics.utilizationPercent).toBeLessThanOrEqual(GPU_UTILIZATION_THRESHOLD);
    expect((metrics.memoryUsed / metrics.memoryTotal) * 100).toBeLessThanOrEqual(GPU_MEMORY_THRESHOLD);
  });

  test('Continuous GPU utilization tracking under simulated workload', async () => {
    const samples: any[] = [];
    let sampleCount = 0;

    // Configure collection interval
    collectionInterval = setInterval(async () => {
      const metrics = await getGPUMetrics(0);
      samples.push(metrics);
      sampleCount++;

      if (sampleCount >= METRIC_SAMPLE_COUNT) {
        clearInterval(collectionInterval);
      }
    }, METRICS_COLLECTION_INTERVAL);

    // Simulate varying GPU load
    await mockSimulateGPUStress(0, 60); // 60% load
    await new Promise(resolve => setTimeout(resolve, 2000));
    await mockSimulateGPUStress(0, 80); // 80% load

    // Wait for sample collection
    await new Promise(resolve => setTimeout(resolve, METRICS_COLLECTION_INTERVAL * METRIC_SAMPLE_COUNT));

    // Validate utilization trends
    expect(samples.length).toBe(METRIC_SAMPLE_COUNT);
    samples.forEach(metric => {
      expect(metric.utilizationPercent).toBeLessThanOrEqual(GPU_UTILIZATION_THRESHOLD);
      expect(metric.timestamp).toBeGreaterThan(Date.now() - 60000); // Within last minute
    });

    // Verify utilization progression
    const utilizationTrend = samples.map(s => s.utilizationPercent);
    expect(Math.max(...utilizationTrend)).toBeGreaterThan(60); // Peak load check
  });

  test('GPU memory monitoring and limit enforcement', async () => {
    const metrics = await getGPUMetrics(0);
    const initialMemory = metrics.memoryUsed;

    // Track memory allocation
    const memoryMetrics = await Promise.all([
      getGPUMetrics(0),
      getGPUMetrics(0),
      getGPUMetrics(0)
    ]);

    // Validate memory usage tracking
    memoryMetrics.forEach(metric => {
      expect(metric.memoryUsed).toBeGreaterThanOrEqual(0);
      expect(metric.memoryUsed).toBeLessThanOrEqual(metric.memoryTotal);
      expect((metric.memoryUsed / metric.memoryTotal) * 100).toBeLessThanOrEqual(GPU_MEMORY_THRESHOLD);
    });

    // Verify memory reporting consistency
    const memoryVariation = Math.max(...memoryMetrics.map(m => m.memoryUsed)) - 
                           Math.min(...memoryMetrics.map(m => m.memoryUsed));
    expect(memoryVariation).toBeLessThan(metrics.memoryTotal * 0.1); // Max 10% variation
  });

  test('Error handling in GPU metrics collection', async () => {
    // Mock error condition
    (getGPUMetrics as jest.Mock).mockImplementationOnce(() => {
      throw new Error('GPU device not responding');
    });

    let errorCount = 0;
    let successfulRetry = false;

    // Test error recovery
    for (let i = 0; i < ERROR_RETRY_ATTEMPTS; i++) {
      try {
        const metrics = await getGPUMetrics(0);
        successfulRetry = true;
        break;
      } catch (error) {
        errorCount++;
        await new Promise(resolve => setTimeout(resolve, 1000)); // Retry delay
      }
    }

    // Validate error handling
    expect(errorCount).toBeGreaterThan(0);
    expect(successfulRetry).toBe(true);

    // Verify metrics collection resumes
    const metricsAfterError = await getGPUMetrics(0);
    expect(metricsAfterError).toHaveProperty('utilizationPercent');
    expect(metricsAfterError.errorCondition).toBeNull();
  });

  test('Performance metrics reporting through MetricsCollector', async () => {
    // Start metrics collection
    await metricsCollector.startCollection();

    // Generate load and collect metrics
    await mockSimulateGPUStress(0, 70);
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Get collected metrics
    const collectedMetrics = await metricsCollector.getMetrics();
    
    // Validate Prometheus format
    expect(collectedMetrics).toContain('cosmos_wfm_gpu_utilization');
    expect(collectedMetrics).toContain('cosmos_wfm_gpu_memory_usage');
    expect(collectedMetrics).toContain('device_id="0"');

    // Stop collection
    await metricsCollector.stopCollection();
  });
});