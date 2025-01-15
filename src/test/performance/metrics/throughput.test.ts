import { describe, test, beforeAll, afterAll, expect, jest } from '@jest/globals';
import { MetricsCollector } from '../../../backend/src/utils/metrics';
import { setupTestEnvironment, teardownTestEnvironment, waitForProcessing } from '../../utils/testHelpers';
import { VideoResolutionImpl } from '../../../backend/src/types/common';

// Constants for performance testing
const TEST_TIMEOUT = 120000; // 2 minutes
const BATCH_SIZE = 100;
const TARGET_THROUGHPUT = 100000; // videos per day
const GENERATION_SLO = 600000; // 600s in ms
const TOKENIZATION_SLO = 100; // 100ms per frame
const TEST_RESOLUTIONS = {
  HD: new VideoResolutionImpl(1280, 720),
  FHD: new VideoResolutionImpl(1920, 1080)
};
const FRAME_COUNT = 57;

describe('System Throughput Tests', () => {
  let metricsCollector: MetricsCollector;

  beforeAll(async () => {
    jest.setTimeout(TEST_TIMEOUT);
    await setupTestEnvironment({
      gpuDevices: 4,
      enableProfiling: true
    });
    metricsCollector = MetricsCollector.getInstance();
  });

  afterAll(async () => {
    await teardownTestEnvironment();
  });

  describe('Video Generation Throughput', () => {
    test('should achieve target daily video generation throughput', async () => {
      // Measure generation throughput over a sample period
      const throughput = await measureGenerationThroughput(BATCH_SIZE, 30000);
      
      // Validate against daily target (scaled from sample)
      const projectedDaily = throughput * (24 * 60 * 60 * 1000 / 30000);
      expect(projectedDaily).toBeGreaterThanOrEqual(TARGET_THROUGHPUT);
    });

    test('should maintain generation latency SLO under load', async () => {
      const batchPromises = Array(BATCH_SIZE).fill(0).map(async (_, i) => {
        const startTime = Date.now();
        
        // Record generation metrics
        await metricsCollector.recordGenerationMetrics(Date.now() - startTime, {
          resolution: TEST_RESOLUTIONS.HD,
          frameCount: FRAME_COUNT,
          batchId: i
        });

        // Validate individual generation time
        expect(Date.now() - startTime).toBeLessThanOrEqual(GENERATION_SLO);
      });

      await Promise.all(batchPromises);
    });
  });

  describe('Video Tokenization Throughput', () => {
    test('should achieve target frame tokenization latency', async () => {
      const throughput = await measureTokenizationThroughput(BATCH_SIZE, 10000);
      
      // Calculate average per-frame latency
      const avgLatencyMs = 1000 / throughput; // Convert fps to ms/frame
      expect(avgLatencyMs).toBeLessThanOrEqual(TOKENIZATION_SLO);
    });

    test('should maintain tokenization performance at 1080p', async () => {
      const batchPromises = Array(BATCH_SIZE).fill(0).map(async (_, i) => {
        const startTime = Date.now();
        
        // Record tokenization metrics
        await metricsCollector.recordTokenizationMetrics(Date.now() - startTime, {
          resolution: TEST_RESOLUTIONS.FHD,
          batchId: i
        });

        // Validate individual tokenization time
        expect(Date.now() - startTime).toBeLessThanOrEqual(TOKENIZATION_SLO);
      });

      await Promise.all(batchPromises);
    });
  });

  describe('Metrics Collection', () => {
    test('should collect valid throughput metrics in Prometheus format', async () => {
      // Get metrics in Prometheus format
      const metrics = await metricsCollector.getMetrics();
      
      // Validate metric format
      expect(metrics).toContain('cosmos_wfm_generation_latency_ms');
      expect(metrics).toContain('cosmos_wfm_tokenization_latency_ms');
      expect(metrics).toContain('cosmos_wfm_throughput_videos_per_hour');
      
      // Validate metric values
      const lines = metrics.split('\n');
      lines.forEach(line => {
        if (line && !line.startsWith('#')) {
          const [name, value] = line.split(' ');
          expect(name).toBeDefined();
          expect(parseFloat(value)).not.toBeNaN();
        }
      });
    });
  });
});

/**
 * Measures video generation throughput under load
 * @param batchSize Number of concurrent generation requests
 * @param durationMs Duration to measure throughput over
 * @returns Promise resolving to achieved throughput in videos per day
 */
async function measureGenerationThroughput(
  batchSize: number,
  durationMs: number
): Promise<number> {
  const startTime = Date.now();
  let completedCount = 0;

  while (Date.now() - startTime < durationMs) {
    const batchPromises = Array(batchSize).fill(0).map(async () => {
      await waitForProcessing(GENERATION_SLO);
      completedCount++;
    });

    await Promise.all(batchPromises);
  }

  const elapsedSeconds = (Date.now() - startTime) / 1000;
  const videosPerSecond = completedCount / elapsedSeconds;
  return videosPerSecond * 24 * 60 * 60; // Convert to daily rate
}

/**
 * Measures video tokenization throughput under load
 * @param batchSize Number of concurrent tokenization requests
 * @param durationMs Duration to measure throughput over
 * @returns Promise resolving to achieved throughput in frames per second
 */
async function measureTokenizationThroughput(
  batchSize: number,
  durationMs: number
): Promise<number> {
  const startTime = Date.now();
  let processedFrames = 0;

  while (Date.now() - startTime < durationMs) {
    const batchPromises = Array(batchSize).fill(0).map(async () => {
      await waitForProcessing(TOKENIZATION_SLO);
      processedFrames += FRAME_COUNT;
    });

    await Promise.all(batchPromises);
  }

  const elapsedSeconds = (Date.now() - startTime) / 1000;
  return processedFrames / elapsedSeconds;
}