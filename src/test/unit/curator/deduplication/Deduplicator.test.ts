import { describe, test, expect, beforeAll, afterAll, jest } from '@jest/globals';
import memwatch from 'memwatch-next';

// Internal imports
import { Deduplicator } from '../../../../backend/src/core/curator/deduplication/Deduplicator';
import { createMockVideo } from '../../../utils/mockData';
import { setupTestEnvironment, teardownTestEnvironment } from '../../../utils/testHelpers';
import { ProcessingStatus } from '../../../../backend/src/types/common';

// Test constants
const TEST_TIMEOUT = 30000;
const SIMILARITY_THRESHOLD = 0.95;
const BATCH_SIZES = [100, 1000, 10000, 100000];
const MEMORY_THRESHOLD = 1024 * 1024 * 1024; // 1GB

// Test configuration
jest.setTimeout(TEST_TIMEOUT);

describe('Deduplicator', () => {
  let deduplicator: Deduplicator;
  let heapDiff: any;

  beforeAll(async () => {
    // Setup test environment with GPU simulation
    await setupTestEnvironment({
      gpuDevices: 2,
      gpuMemory: 80 * 1024 * 1024 * 1024, // 80GB
      enableProfiling: true
    });

    // Initialize deduplicator with test configuration
    deduplicator = new Deduplicator({
      similarityThreshold: SIMILARITY_THRESHOLD,
      batchSize: 1000,
      maxCacheSize: 10000,
      retryAttempts: 3,
      deviceId: 0
    });

    // Start memory monitoring
    heapDiff = new memwatch.HeapDiff();
  });

  afterAll(async () => {
    // Cleanup test environment
    await teardownTestEnvironment();

    // Check memory leaks
    const heapStats = heapDiff.end();
    expect(heapStats.change.size_bytes).toBeLessThan(MEMORY_THRESHOLD);
  });

  describe('isDuplicate', () => {
    test('should detect exact duplicates with identical perceptual hashes', async () => {
      // Create two identical videos
      const video1 = createMockVideo({
        checksum: 'abc123',
        status: ProcessingStatus.COMPLETED
      });
      const video2 = createMockVideo({
        checksum: 'abc123',
        status: ProcessingStatus.COMPLETED
      });

      // First video should not be a duplicate
      const result1 = await deduplicator.isDuplicate(video1);
      expect(result1).toBeFalsy();

      // Second identical video should be detected as duplicate
      const result2 = await deduplicator.isDuplicate(video2);
      expect(result2).toBeTruthy();
    });

    test('should detect near-duplicates with similar feature vectors', async () => {
      // Create similar videos with slight variations
      const video1 = createMockVideo({
        quality: {
          psnr: 35.0,
          ssim: 0.98,
          fid: 20.0,
          fvd: 100.0,
          sampsonError: 0.5,
          poseAccuracy: 0.95
        }
      });

      const video2 = createMockVideo({
        quality: {
          psnr: 34.8,
          ssim: 0.97,
          fid: 21.0,
          fvd: 102.0,
          sampsonError: 0.52,
          poseAccuracy: 0.94
        }
      });

      await deduplicator.isDuplicate(video1);
      const result = await deduplicator.isDuplicate(video2);
      expect(result).toBeTruthy();
    });

    test('should handle edge cases with empty or corrupted videos', async () => {
      // Test empty video
      const emptyVideo = createMockVideo({
        size: 0,
        duration: 0
      });

      await expect(deduplicator.isDuplicate(emptyVideo))
        .rejects.toThrow('Invalid video data');

      // Test corrupted video
      const corruptedVideo = createMockVideo({
        status: ProcessingStatus.FAILED,
        errorMessage: 'Corrupted video data'
      });

      await expect(deduplicator.isDuplicate(corruptedVideo))
        .rejects.toThrow('Invalid video status');
    });

    test('should maintain performance with large video files', async () => {
      // Create large test video
      const largeVideo = createMockVideo({
        size: 5 * 1024 * 1024 * 1024, // 5GB
        duration: 3600 // 1 hour
      });

      const startTime = Date.now();
      await deduplicator.isDuplicate(largeVideo);
      const duration = Date.now() - startTime;

      // Check performance meets requirements
      expect(duration).toBeLessThan(1000); // Max 1 second for hash computation
    });
  });

  describe('deduplicateBatch', () => {
    test.each(BATCH_SIZES)('should handle batch size of %i videos efficiently', async (batchSize) => {
      // Create test batch
      const videos = Array.from({ length: batchSize }, () => 
        createMockVideo({
          status: ProcessingStatus.COMPLETED
        })
      );

      // Measure batch processing performance
      const startTime = Date.now();
      const uniqueVideos = await deduplicator.deduplicateBatch(videos);
      const duration = Date.now() - startTime;

      // Verify results
      expect(uniqueVideos.length).toBeLessThan(videos.length);
      expect(duration).toBeLessThan(batchSize * 10); // Max 10ms per video average

      // Check memory usage
      const memoryUsage = process.memoryUsage();
      expect(memoryUsage.heapUsed).toBeLessThan(MEMORY_THRESHOLD);
    });

    test('should handle concurrent batch processing', async () => {
      // Create multiple batches
      const batch1 = Array.from({ length: 1000 }, () => createMockVideo());
      const batch2 = Array.from({ length: 1000 }, () => createMockVideo());
      const batch3 = Array.from({ length: 1000 }, () => createMockVideo());

      // Process batches concurrently
      const results = await Promise.all([
        deduplicator.deduplicateBatch(batch1),
        deduplicator.deduplicateBatch(batch2),
        deduplicator.deduplicateBatch(batch3)
      ]);

      // Verify all batches processed successfully
      results.forEach(uniqueVideos => {
        expect(uniqueVideos).toBeDefined();
        expect(Array.isArray(uniqueVideos)).toBeTruthy();
      });
    });

    test('should maintain high throughput for 100k+ daily videos', async () => {
      // Calculate required throughput for 100k videos per day
      const videosPerDay = 100000;
      const secondsPerDay = 86400;
      const requiredThroughput = videosPerDay / secondsPerDay;

      // Create large test batch
      const testBatch = Array.from({ length: 10000 }, () => createMockVideo());

      // Measure throughput
      const startTime = Date.now();
      await deduplicator.deduplicateBatch(testBatch);
      const duration = (Date.now() - startTime) / 1000; // Convert to seconds
      const actualThroughput = testBatch.length / duration;

      // Verify throughput meets requirements
      expect(actualThroughput).toBeGreaterThan(requiredThroughput);
    });

    test('should handle error recovery in batch processing', async () => {
      // Create batch with some invalid videos
      const mixedBatch = [
        createMockVideo({ status: ProcessingStatus.COMPLETED }),
        createMockVideo({ status: ProcessingStatus.FAILED }),
        createMockVideo({ status: ProcessingStatus.COMPLETED }),
        createMockVideo({ size: 0 }) // Invalid video
      ];

      // Process batch and verify error handling
      const results = await deduplicator.deduplicateBatch(mixedBatch);
      
      // Should skip invalid videos but process valid ones
      expect(results.length).toBeLessThan(mixedBatch.length);
      results.forEach(video => {
        expect(video.status).toBe(ProcessingStatus.COMPLETED);
        expect(video.size).toBeGreaterThan(0);
      });
    });
  });
});