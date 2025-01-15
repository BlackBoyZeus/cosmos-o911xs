import { describe, beforeAll, afterAll, it, expect, jest } from '@jest/globals';
import { DataCurator } from '../../../backend/src/core/curator/DataCurator';
import { DatasetService } from '../../../backend/src/services/DatasetService';
import { GPUMockService } from '../../utils/gpuMock';
import { TestHelpers } from '../../utils/testHelpers';
import { ProcessingStatus, VideoResolutionImpl } from '../../../backend/src/types/common';
import { createMockVideo } from '../../utils/mockData';

// Test configuration constants
const TEST_TIMEOUT = 600000; // 10 minutes
const BATCH_SIZE = 100;
const VIDEO_COUNT = 1000;
const MAX_PARALLEL_PROCESSES = 8;
const GPU_MEMORY_LIMIT = 32768; // 32GB
const SAFETY_THRESHOLD = 0.95;

describe('Data Pipeline E2E Tests', () => {
  let dataCurator: DataCurator;
  let datasetService: DatasetService;
  let gpuMock: GPUMockService;

  beforeAll(async () => {
    // Initialize test environment with enhanced configuration
    await TestHelpers.setupTestEnvironment({
      gpuDevices: 2,
      gpuMemory: GPU_MEMORY_LIMIT,
      timeout: TEST_TIMEOUT,
      enableProfiling: true
    });

    // Initialize services with mock implementations
    dataCurator = new DataCurator({
      maxConcurrent: MAX_PARALLEL_PROCESSES,
      gpuDeviceId: 0,
      batchSize: BATCH_SIZE,
      qualityThresholds: {
        minPSNR: 25.0,
        minSSIM: 0.8,
        maxFID: 50.0,
        maxFVD: 150.0
      },
      retryPolicies: {
        'ProcessingError': {
          maxAttempts: 3,
          backoff: 1000,
          timeout: 300000
        }
      }
    });

    datasetService = new DatasetService({
      storageConfig: {
        provider: 'mock',
        region: 'test',
        bucketName: 'test-bucket'
      }
    });

    gpuMock = new GPUMockService();
  });

  afterAll(async () => {
    await TestHelpers.teardownTestEnvironment();
  });

  it('should process complete video pipeline with quality validation', async () => {
    // Create test video with specific quality metrics
    const testVideo = createMockVideo({
      resolution: new VideoResolutionImpl(1920, 1080),
      quality: {
        psnr: 35.0,
        ssim: 0.95,
        fid: 25.0,
        fvd: 100.0,
        sampsonError: 0.5,
        poseAccuracy: 0.9
      }
    });

    // Process video through pipeline
    const processedVideo = await dataCurator.processVideo(testVideo);

    // Validate processing results
    expect(processedVideo.status).toBe(ProcessingStatus.COMPLETED);
    expect(processedVideo.quality.psnr).toBeGreaterThanOrEqual(25.0);
    expect(processedVideo.quality.ssim).toBeGreaterThanOrEqual(0.8);
    expect(processedVideo.quality.fid).toBeLessThanOrEqual(50.0);
    expect(processedVideo.quality.fvd).toBeLessThanOrEqual(150.0);
    expect(processedVideo.annotations.length).toBeGreaterThan(0);
  }, TEST_TIMEOUT);

  it('should handle batch processing with parallel execution', async () => {
    // Create batch of test videos
    const testVideos = Array.from({ length: BATCH_SIZE }, () => 
      createMockVideo({
        resolution: new VideoResolutionImpl(1280, 720)
      })
    );

    // Simulate GPU load
    await gpuMock.simulateGPULoad(0, 50); // 50% initial load

    // Process batch
    const processedVideos = await dataCurator.processBatch(testVideos);

    // Validate batch results
    expect(processedVideos.length).toBe(BATCH_SIZE);
    expect(processedVideos.every(v => v.status === ProcessingStatus.COMPLETED)).toBe(true);

    // Validate GPU resource management
    const gpuMetrics = await gpuMock.getMetrics(0);
    expect(gpuMetrics.memoryUsed).toBeLessThan(GPU_MEMORY_LIMIT);
  }, TEST_TIMEOUT);

  it('should enforce safety compliance and quality thresholds', async () => {
    const testVideo = createMockVideo();
    
    // Process with strict safety checks
    const result = await dataCurator.checkSafetyCompliance(testVideo, {
      threshold: SAFETY_THRESHOLD,
      enforceBlur: true
    });

    expect(result.passed).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(SAFETY_THRESHOLD);
  });

  it('should handle large-scale dataset processing', async () => {
    // Create test dataset
    const dataset = await TestHelpers.createTestDataset({
      name: 'large-scale-test',
      resolution: {
        width: 1920,
        height: 1080
      }
    });

    // Process dataset with parallel execution
    await TestHelpers.simulateParallelLoad(async () => {
      const result = await datasetService.processDataset(dataset.id, {
        batchSize: BATCH_SIZE,
        maxConcurrent: MAX_PARALLEL_PROCESSES
      });

      expect(result.status).toBe(ProcessingStatus.COMPLETED);
      expect(result.videoCount).toBe(VIDEO_COUNT);
    });

    // Validate dataset integrity
    const validation = await datasetService.validateDatasetIntegrity(dataset.id);
    expect(validation.valid).toBe(true);
  }, TEST_TIMEOUT);

  it('should recover from processing failures', async () => {
    // Create video that will trigger processing error
    const errorVideo = createMockVideo({
      quality: {
        psnr: 15.0, // Below threshold
        ssim: 0.5,  // Below threshold
        fid: 100.0, // Above threshold
        fvd: 200.0  // Above threshold
      }
    });

    // Attempt processing with retry policy
    let finalStatus: ProcessingStatus;
    try {
      const result = await dataCurator.processVideo(errorVideo);
      finalStatus = result.status;
    } catch (error) {
      finalStatus = ProcessingStatus.FAILED;
    }

    // Validate error handling
    expect(finalStatus).toBe(ProcessingStatus.FAILED);
    
    // Verify metrics were recorded
    const metrics = await TestHelpers.validateMetrics();
    expect(metrics.errorCount).toBeGreaterThan(0);
  });
});