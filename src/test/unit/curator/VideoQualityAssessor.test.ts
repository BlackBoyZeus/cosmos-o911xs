import { describe, beforeAll, beforeEach, afterEach, afterAll, test, expect } from '@jest/globals';
import { cuda } from '@nvidia/cuda-mock';
import * as tf from '@tensorflow/tfjs-node-gpu';

import { VideoQualityAssessor } from '../../../backend/src/core/curator/VideoQualityAssessor';
import { createMockVideo } from '../../utils/mockData';
import { IVideo } from '../../../backend/src/interfaces/IVideo';
import { ProcessingStatus } from '../../../backend/src/types/common';

describe('VideoQualityAssessor', () => {
  let assessor: VideoQualityAssessor;
  let mockVideo: IVideo;

  // Configure test thresholds based on technical specifications
  const QUALITY_THRESHOLDS = {
    minPSNR: 30.0, // Technical spec requires PSNR > 30dB
    minSSIM: 0.95, // Technical spec requires SSIM > 0.95
    maxFID: 50.0,  // Technical spec requires FID < 50
    maxFVD: 100.0  // Technical spec requires FVD < 100
  };

  // Configure performance thresholds
  const PERFORMANCE_THRESHOLDS = {
    maxLatencyMs: 100, // Technical spec requires < 100ms per frame at 1080p
    maxMemoryUsageGB: 16 // Reasonable GPU memory limit
  };

  beforeAll(async () => {
    // Initialize GPU environment
    await tf.setBackend('cuda');
    await cuda.initialize({ deviceId: 0 });

    // Configure GPU memory growth
    tf.engine().configureDeviceId(0);
    tf.engine().enableGrowthMode();
  });

  beforeEach(() => {
    // Create VideoQualityAssessor instance with test configuration
    assessor = new VideoQualityAssessor({
      ...QUALITY_THRESHOLDS,
      gpuDeviceId: 0
    });

    // Create mock video for testing
    mockVideo = createMockVideo({
      resolution: { width: 1920, height: 1080 },
      status: ProcessingStatus.PENDING,
      quality: {
        psnr: 0,
        ssim: 0,
        fid: 0,
        fvd: 0,
        sampsonError: 0,
        poseAccuracy: 0
      }
    });
  });

  afterEach(async () => {
    // Clean up GPU memory
    await tf.engine().endScope();
    await tf.engine().disposeVariables();
    cuda.clearMemory(0);
  });

  afterAll(async () => {
    // Release GPU resources
    await tf.engine().dispose();
    await cuda.shutdown();
  });

  test('should correctly calculate GPU-accelerated PSNR score', async () => {
    // Arrange
    const startTime = Date.now();

    // Act
    const metrics = await assessor.assessQuality(mockVideo);

    // Assert
    expect(metrics.psnr).toBeGreaterThanOrEqual(QUALITY_THRESHOLDS.minPSNR);
    expect(Date.now() - startTime).toBeLessThanOrEqual(PERFORMANCE_THRESHOLDS.maxLatencyMs);
  });

  test('should handle batch SSIM calculation efficiently', async () => {
    // Arrange
    const batchSize = 32;
    const mockVideos = Array(batchSize).fill(null).map(() => createMockVideo());
    const startTime = Date.now();

    // Act
    const results = await Promise.all(mockVideos.map(video => assessor.assessQuality(video)));

    // Assert
    results.forEach(metrics => {
      expect(metrics.ssim).toBeGreaterThanOrEqual(QUALITY_THRESHOLDS.minSSIM);
    });

    const avgLatency = (Date.now() - startTime) / batchSize;
    expect(avgLatency).toBeLessThanOrEqual(PERFORMANCE_THRESHOLDS.maxLatencyMs);
  });

  test('should optimize FID calculation with tensor operations', async () => {
    // Arrange
    const startMemory = await assessor.getGPUMemoryUsage();

    // Act
    const metrics = await assessor.assessQuality(mockVideo);

    // Assert
    expect(metrics.fid).toBeLessThanOrEqual(QUALITY_THRESHOLDS.maxFID);
    
    const endMemory = await assessor.getGPUMemoryUsage();
    const memoryUsage = endMemory - startMemory;
    expect(memoryUsage).toBeLessThanOrEqual(PERFORMANCE_THRESHOLDS.maxMemoryUsageGB * 1024 * 1024 * 1024);
  });

  test('should handle GPU memory efficiently during FVD calculation', async () => {
    // Arrange
    const initialMemory = await assessor.getGPUMemoryUsage();
    
    // Act
    const metrics = await assessor.assessQuality(mockVideo);
    const peakMemory = await assessor.getGPUMemoryUsage();
    
    // Assert
    expect(metrics.fvd).toBeLessThanOrEqual(QUALITY_THRESHOLDS.maxFVD);
    expect(peakMemory - initialMemory).toBeLessThanOrEqual(PERFORMANCE_THRESHOLDS.maxMemoryUsageGB * 1024 * 1024 * 1024);
  });

  test('should gracefully handle GPU errors', async () => {
    // Arrange
    jest.spyOn(cuda, 'allocateMemory').mockImplementationOnce(() => {
      throw new Error('GPU out of memory');
    });

    // Act & Assert
    await expect(assessor.assessQuality(mockVideo)).rejects.toThrow('GPU out of memory');
  });

  test('should validate quality metrics against technical specifications', async () => {
    // Arrange
    const mockHighQualityVideo = createMockVideo({
      quality: {
        psnr: 35.0,
        ssim: 0.98,
        fid: 25.0,
        fvd: 75.0,
        sampsonError: 0.5,
        poseAccuracy: 0.95
      }
    });

    // Act
    const isAcceptable = assessor.isQualityAcceptable(mockHighQualityVideo.quality);

    // Assert
    expect(isAcceptable).toBe(true);
  });

  test('should process 1080p video within latency requirements', async () => {
    // Arrange
    const mockHDVideo = createMockVideo({
      resolution: { width: 1920, height: 1080 }
    });
    const startTime = Date.now();

    // Act
    await assessor.assessQuality(mockHDVideo);
    const processingTime = Date.now() - startTime;

    // Assert
    expect(processingTime).toBeLessThanOrEqual(PERFORMANCE_THRESHOLDS.maxLatencyMs);
  });

  test('should handle batch processing with multiple GPUs', async () => {
    // Arrange
    const batchSize = 64;
    const mockVideos = Array(batchSize).fill(null).map(() => createMockVideo());
    const startTime = Date.now();

    // Act
    const results = await assessor.assessBatchQuality(mockVideos);
    const totalTime = Date.now() - startTime;

    // Assert
    expect(results.length).toBe(batchSize);
    expect(totalTime / batchSize).toBeLessThanOrEqual(PERFORMANCE_THRESHOLDS.maxLatencyMs);
    results.forEach(metrics => {
      expect(metrics.psnr).toBeGreaterThanOrEqual(QUALITY_THRESHOLDS.minPSNR);
      expect(metrics.ssim).toBeGreaterThanOrEqual(QUALITY_THRESHOLDS.minSSIM);
      expect(metrics.fid).toBeLessThanOrEqual(QUALITY_THRESHOLDS.maxFID);
      expect(metrics.fvd).toBeLessThanOrEqual(QUALITY_THRESHOLDS.maxFVD);
    });
  });
});