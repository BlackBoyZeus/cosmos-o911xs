import { describe, test, expect, beforeAll, afterAll, jest } from '@jest/globals';
import * as tf from '@tensorflow/tfjs-node-gpu';

// Internal imports
import { AutomaticAnnotator } from '../../../../backend/src/core/curator/annotators/AutomaticAnnotator';
import { createMockVideo } from '../../../utils/mockData';
import { setupTestEnvironment, teardownTestEnvironment } from '../../../utils/testHelpers';
import { ProcessingStatus } from '../../../../backend/src/types/common';
import { SafetyCheckType } from '../../../../backend/src/types/safety';

// Test configuration constants
const TEST_TIMEOUT = 30000;
const MOCK_VIDEO_CONFIG = {
  resolution: { width: 1280, height: 720 },
  frameCount: 57,
  format: 'mp4',
  batchSize: 10,
  gpuMemoryLimit: '16GB'
};
const PERFORMANCE_THRESHOLDS = {
  maxProcessingTime: 100,
  minFPS: 30,
  maxGPUMemory: '14GB',
  maxBatchLatency: 600
};
const SAFETY_CONFIG = {
  faceDetectionThreshold: 0.95,
  contentFilteringLevel: 'strict',
  blurIntensity: 25
};

describe('AutomaticAnnotator', () => {
  let annotator: AutomaticAnnotator;

  beforeAll(async () => {
    // Initialize test environment with GPU support
    await setupTestEnvironment({
      gpuDevices: 2,
      gpuMemory: 16 * 1024 * 1024 * 1024, // 16GB
      enableProfiling: true
    });

    // Initialize annotator with test configuration
    annotator = new AutomaticAnnotator({
      batchSize: MOCK_VIDEO_CONFIG.batchSize,
      modelPath: './models/annotator',
      safetyThresholds: SAFETY_CONFIG,
      gpuMemoryLimit: MOCK_VIDEO_CONFIG.gpuMemoryLimit
    });
  });

  afterAll(async () => {
    // Clean up test environment and GPU resources
    await teardownTestEnvironment();
  });

  test('should successfully annotate video with GPU acceleration', async () => {
    // Create mock video for testing
    const mockVideo = createMockVideo({
      resolution: MOCK_VIDEO_CONFIG.resolution,
      frameCount: MOCK_VIDEO_CONFIG.frameCount,
      format: MOCK_VIDEO_CONFIG.format
    });

    // Start performance monitoring
    const startTime = Date.now();
    const memoryBefore = await tf.memory();

    // Process video
    const annotatedVideo = await annotator.annotateVideo(mockVideo);

    // Verify processing time
    const processingTime = Date.now() - startTime;
    expect(processingTime).toBeLessThan(PERFORMANCE_THRESHOLDS.maxProcessingTime);

    // Verify GPU memory usage
    const memoryAfter = await tf.memory();
    const memoryUsed = memoryAfter.numBytes - memoryBefore.numBytes;
    expect(memoryUsed).toBeLessThan(parseInt(PERFORMANCE_THRESHOLDS.maxGPUMemory));

    // Verify annotation results
    expect(annotatedVideo.status).toBe(ProcessingStatus.COMPLETED);
    expect(annotatedVideo.annotations).toBeDefined();
    expect(annotatedVideo.annotations.length).toBeGreaterThan(0);
    expect(annotatedVideo.metadata.processingMetrics).toBeDefined();
  }, TEST_TIMEOUT);

  test('should perform comprehensive safety analysis', async () => {
    const mockVideo = createMockVideo();

    // Process video with safety checks
    const result = await annotator.analyzeSafety(mockVideo);

    // Verify face detection
    expect(result.faceDetection).toBeDefined();
    expect(result.faceDetection.confidence).toBeGreaterThanOrEqual(
      SAFETY_CONFIG.faceDetectionThreshold
    );

    // Verify content filtering
    expect(result.contentSafety).toBeDefined();
    expect(result.contentSafety.status).toBe('PASS');
    expect(result.contentSafety.checkType).toBe(SafetyCheckType.CONTENT_SAFETY);

    // Verify metadata
    expect(result.metadata).toBeDefined();
    expect(result.metadata.safetyChecks).toHaveLength(2);
    expect(result.metadata.remediationApplied).toBeDefined();
  });

  test('should handle batch processing efficiently', async () => {
    // Create batch of mock videos
    const mockVideos = Array(MOCK_VIDEO_CONFIG.batchSize)
      .fill(null)
      .map(() => createMockVideo());

    // Process batch
    const startTime = Date.now();
    const results = await Promise.all(
      mockVideos.map(video => annotator.annotateVideo(video))
    );

    // Verify batch processing time
    const batchTime = Date.now() - startTime;
    expect(batchTime).toBeLessThan(PERFORMANCE_THRESHOLDS.maxBatchLatency);

    // Verify all videos processed successfully
    results.forEach(result => {
      expect(result.status).toBe(ProcessingStatus.COMPLETED);
      expect(result.annotations).toBeDefined();
    });

    // Verify batch performance metrics
    const avgProcessingTime = batchTime / mockVideos.length;
    expect(avgProcessingTime).toBeLessThan(PERFORMANCE_THRESHOLDS.maxProcessingTime);
  });

  test('should generate comprehensive metadata', async () => {
    const mockVideo = createMockVideo();

    // Generate metadata
    const metadata = await annotator.generateMetadata(mockVideo);

    // Verify metadata structure
    expect(metadata).toBeDefined();
    expect(metadata.videoQuality).toBeDefined();
    expect(metadata.processingMetrics).toBeDefined();
    expect(metadata.safetyMetrics).toBeDefined();

    // Verify quality metrics
    expect(metadata.videoQuality.psnr).toBeGreaterThan(0);
    expect(metadata.videoQuality.ssim).toBeGreaterThan(0);
    expect(metadata.videoQuality.fid).toBeGreaterThan(0);
    expect(metadata.videoQuality.fvd).toBeGreaterThan(0);

    // Verify processing metrics
    expect(metadata.processingMetrics.frameCount).toBe(MOCK_VIDEO_CONFIG.frameCount);
    expect(metadata.processingMetrics.fps).toBeGreaterThanOrEqual(PERFORMANCE_THRESHOLDS.minFPS);
  });

  test('should handle errors gracefully', async () => {
    // Test with invalid video
    const invalidVideo = createMockVideo({
      path: 'invalid/path.mp4'
    });

    await expect(annotator.annotateVideo(invalidVideo)).rejects.toThrow();

    // Test with corrupted video data
    const corruptedVideo = createMockVideo({
      status: ProcessingStatus.FAILED
    });

    await expect(annotator.annotateVideo(corruptedVideo)).rejects.toThrow();

    // Verify error handling in batch processing
    const mixedBatch = [
      createMockVideo(),
      invalidVideo,
      createMockVideo(),
      corruptedVideo
    ];

    const results = await Promise.allSettled(
      mixedBatch.map(video => annotator.annotateVideo(video))
    );

    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(2);
    expect(results.filter(r => r.status === 'rejected')).toHaveLength(2);
  });
});