import { jest } from '@jest/globals';
import { DataCurator } from '../../../backend/src/core/curator/DataCurator';
import { createMockVideo } from '../../utils/mockData';
import { setupTestEnvironment, teardownTestEnvironment, waitForProcessing } from '../../utils/testHelpers';
import { ProcessingStatus, VideoResolutionImpl } from '../../../backend/src/types/common';
import { SafetyCheckType, SafetyStatus } from '../../../backend/src/types/safety';
import { MetricsCollector } from '../../../backend/src/utils/metrics';
import { GPUUtils } from '../../../backend/src/utils/gpu';

describe('Data Curation Pipeline Integration Tests', () => {
  let dataCurator: DataCurator;
  let metricsCollector: MetricsCollector;
  let gpuUtils: GPUUtils;

  beforeAll(async () => {
    // Set up test environment with GPU simulation
    await setupTestEnvironment({
      gpuDevices: 2,
      gpuMemory: 80 * 1024 * 1024 * 1024, // 80GB
      enableProfiling: true
    });

    // Initialize metrics collector
    metricsCollector = MetricsCollector.getInstance();

    // Initialize data curator with test configuration
    dataCurator = new DataCurator({
      gpuDeviceId: 0,
      batchSize: 32,
      maxConcurrent: 4,
      qualityThresholds: {
        minPSNR: 25.0,
        minSSIM: 0.8,
        maxFID: 50.0,
        maxFVD: 150.0
      },
      retryPolicies: {
        ProcessingError: { maxAttempts: 3, backoff: 1000, timeout: 30000 },
        QualityError: { maxAttempts: 2, backoff: 2000, timeout: 20000 }
      }
    });
  });

  afterAll(async () => {
    await teardownTestEnvironment();
  });

  describe('Single Video Processing', () => {
    it('should successfully process a single video with quality validation', async () => {
      // Create test video with specific quality parameters
      const testVideo = createMockVideo({
        resolution: new VideoResolutionImpl(1920, 1080),
        fps: 30,
        duration: 10,
        quality: {
          psnr: 35.0,
          ssim: 0.95,
          fid: 25.0,
          fvd: 100.0,
          sampsonError: 0.5,
          poseAccuracy: 0.9
        }
      });

      // Start metrics collection
      const startTime = Date.now();

      // Process video
      const processedVideo = await dataCurator.processVideo(testVideo);

      // Verify processing time
      const processingTime = Date.now() - startTime;
      expect(processingTime).toBeLessThan(600000); // 600s threshold

      // Verify video status and quality metrics
      expect(processedVideo.status).toBe(ProcessingStatus.COMPLETED);
      expect(processedVideo.quality.psnr).toBeGreaterThanOrEqual(25.0);
      expect(processedVideo.quality.ssim).toBeGreaterThanOrEqual(0.8);
      expect(processedVideo.quality.fid).toBeLessThanOrEqual(50.0);
      expect(processedVideo.quality.fvd).toBeLessThanOrEqual(150.0);

      // Verify face blur compliance
      const safetyResults = await dataCurator.checkSafetyCompliance(processedVideo);
      expect(safetyResults.some(r => 
        r.checkType === SafetyCheckType.FACE_DETECTION && 
        r.status === SafetyStatus.PASS
      )).toBe(true);

      // Verify resource utilization
      const gpuMetrics = await gpuUtils.getGPUMetrics(0);
      expect(gpuMetrics.memoryUsed).toBeLessThan(gpuMetrics.memoryTotal);
      expect(gpuMetrics.utilizationPercent).toBeLessThan(95);
    });

    it('should handle invalid video input appropriately', async () => {
      const invalidVideo = createMockVideo({
        resolution: new VideoResolutionImpl(8000, 8000), // Invalid resolution
        quality: {
          psnr: 15.0, // Below threshold
          ssim: 0.5,  // Below threshold
          fid: 100.0, // Above threshold
          fvd: 200.0, // Above threshold
          sampsonError: 2.0,
          poseAccuracy: 0.5
        }
      });

      await expect(dataCurator.processVideo(invalidVideo))
        .rejects
        .toThrow('Video quality below acceptable thresholds');

      // Verify error metrics were recorded
      const metrics = metricsCollector.getMetrics();
      expect(metrics.errorCounter.labels('QualityError').inc).toHaveBeenCalled();
    });
  });

  describe('Batch Processing', () => {
    it('should process multiple videos in parallel efficiently', async () => {
      // Create batch of test videos
      const testVideos = Array.from({ length: 100 }, () => 
        createMockVideo({
          resolution: new VideoResolutionImpl(1280, 720),
          duration: 5,
          quality: {
            psnr: 30.0,
            ssim: 0.9,
            fid: 30.0,
            fvd: 120.0,
            sampsonError: 0.8,
            poseAccuracy: 0.85
          }
        })
      );

      // Start metrics collection
      const startTime = Date.now();

      // Process batch
      const processedVideos = await dataCurator.processBatch(testVideos);

      // Verify processing time and throughput
      const processingTime = Date.now() - startTime;
      const videosPerDay = (processedVideos.length / processingTime) * 86400000;
      expect(videosPerDay).toBeGreaterThan(100000); // 100k/day requirement

      // Verify all videos were processed successfully
      expect(processedVideos.length).toBe(testVideos.length);
      expect(processedVideos.every(v => v.status === ProcessingStatus.COMPLETED)).toBe(true);

      // Verify quality metrics across batch
      const qualityMetrics = processedVideos.map(v => v.quality);
      expect(Math.min(...qualityMetrics.map(m => m.psnr))).toBeGreaterThanOrEqual(25.0);
      expect(Math.min(...qualityMetrics.map(m => m.ssim))).toBeGreaterThanOrEqual(0.8);
      expect(Math.max(...qualityMetrics.map(m => m.fid))).toBeLessThanOrEqual(50.0);
      expect(Math.max(...qualityMetrics.map(m => m.fvd))).toBeLessThanOrEqual(150.0);

      // Verify GPU utilization during batch processing
      const gpuMetrics = await gpuUtils.getGPUMetrics(0);
      expect(gpuMetrics.utilizationPercent).toBeGreaterThan(50); // Ensure GPU was utilized
    });
  });

  describe('Error Recovery', () => {
    it('should handle and recover from GPU memory errors', async () => {
      // Simulate GPU memory pressure
      await gpuUtils.allocateMemory(0, 75 * 1024 * 1024 * 1024); // 75GB

      const testVideo = createMockVideo({
        resolution: new VideoResolutionImpl(1920, 1080),
        duration: 30 // Longer duration to stress memory
      });

      // Process should succeed with retry mechanism
      const processedVideo = await dataCurator.processVideo(testVideo);
      expect(processedVideo.status).toBe(ProcessingStatus.COMPLETED);

      // Verify retry metrics
      const metrics = metricsCollector.getMetrics();
      expect(metrics.retryCounter.labels('gpu_memory').inc).toHaveBeenCalled();
    });

    it('should maintain data consistency during parallel processing failures', async () => {
      // Create mix of valid and invalid videos
      const testVideos = [
        createMockVideo({ quality: { psnr: 35.0, ssim: 0.95, fid: 25.0, fvd: 100.0 }}),
        createMockVideo({ quality: { psnr: 15.0, ssim: 0.5, fid: 100.0, fvd: 200.0 }}), // Invalid
        createMockVideo({ quality: { psnr: 30.0, ssim: 0.9, fid: 30.0, fvd: 120.0 }})
      ];

      const processedVideos = await dataCurator.processBatch(testVideos);

      // Verify only valid videos were processed
      expect(processedVideos.length).toBe(2);
      expect(processedVideos.every(v => v.quality.psnr >= 25.0)).toBe(true);

      // Verify error handling metrics
      const metrics = metricsCollector.getMetrics();
      expect(metrics.failedVideosCounter.inc).toHaveBeenCalledTimes(1);
    });
  });
});