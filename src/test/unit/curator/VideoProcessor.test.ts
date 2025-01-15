import { describe, test, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { VideoProcessor } from '../../../backend/src/core/curator/VideoProcessor';
import { createMockVideo } from '../../utils/mockData';
import { setupTestEnvironment, teardownTestEnvironment } from '../../utils/testHelpers';
import { GPUMock } from '../../utils/gpuMock';
import { MetricsCollector } from '../../../backend/src/utils/metrics';
import { SecurityUtils } from '@cosmos/security-utils';
import { GPUUtils } from 'nvidia-smi';
import { ProcessingStatus, VideoResolutionImpl } from '../../../backend/src/types/common';
import * as ffmpeg from 'ffmpeg-static';

// Test configuration constants
const TEST_TIMEOUT = 60000;
const TEST_VIDEO_PATH = '../../fixtures/videos/sample_720p.mp4';
const PERFORMANCE_THRESHOLD = 600000; // 600s max processing time
const QUALITY_THRESHOLD = 30.0; // Minimum PSNR
const GPU_MEMORY_LIMIT = 8192; // 8GB
const TEST_FRAME_COUNT = 57;

// Mock instances
let videoProcessor: VideoProcessor;
let metricsCollector: jest.Mocked<MetricsCollector>;
let securityUtils: jest.Mocked<SecurityUtils>;
let gpuUtils: jest.Mocked<GPUUtils>;

beforeAll(async () => {
  // Setup test environment
  await setupTestEnvironment();

  // Initialize mocks
  metricsCollector = {
    recordProcessingMetrics: jest.fn(),
    recordGPUMetrics: jest.fn(),
  } as any;

  securityUtils = {
    validateFileIntegrity: jest.fn().mockResolvedValue({ valid: true }),
  } as any;

  gpuUtils = {
    getCurrentDevice: jest.fn().mockResolvedValue(0),
    getUtilization: jest.fn().mockResolvedValue(50),
    getMemoryInfo: jest.fn().mockResolvedValue({ used: 4096, total: 8192 }),
    allocateMemory: jest.fn().mockResolvedValue(true),
    releaseMemory: jest.fn().mockResolvedValue(undefined),
  } as any;

  // Initialize VideoProcessor with test configuration
  videoProcessor = new VideoProcessor(
    {
      maxConcurrent: 2,
      gpuMemoryLimit: GPU_MEMORY_LIMIT,
      targetResolution: new VideoResolutionImpl(1280, 720),
      outputQuality: 90
    },
    metricsCollector,
    securityUtils,
    gpuUtils
  );
});

afterAll(async () => {
  await teardownTestEnvironment();
});

describe('VideoProcessor', () => {
  describe('processVideo', () => {
    test('should process video within performance requirements', async () => {
      // Create test video
      const testVideo = createMockVideo({
        path: TEST_VIDEO_PATH,
        format: 'mp4',
        resolution: new VideoResolutionImpl(1280, 720),
        fps: 30
      });

      const startTime = Date.now();
      const processedVideo = await videoProcessor.processVideo(testVideo);
      const processingTime = Date.now() - startTime;

      // Verify performance requirements
      expect(processingTime).toBeLessThan(PERFORMANCE_THRESHOLD);
      expect(processedVideo.quality.psnr).toBeGreaterThan(QUALITY_THRESHOLD);
      expect(processedVideo.status).toBe(ProcessingStatus.COMPLETED);
    }, TEST_TIMEOUT);

    test('should handle GPU resource allocation correctly', async () => {
      const testVideo = createMockVideo({
        path: TEST_VIDEO_PATH,
        format: 'mp4'
      });

      await videoProcessor.processVideo(testVideo);

      // Verify GPU resource management
      expect(gpuUtils.allocateMemory).toHaveBeenCalledWith(GPU_MEMORY_LIMIT);
      expect(gpuUtils.releaseMemory).toHaveBeenCalled();
      expect(metricsCollector.recordGPUMetrics).toHaveBeenCalled();
    });

    test('should validate input video integrity', async () => {
      const testVideo = createMockVideo({
        path: TEST_VIDEO_PATH,
        format: 'mp4'
      });

      await videoProcessor.processVideo(testVideo);

      expect(securityUtils.validateFileIntegrity).toHaveBeenCalledWith(testVideo.path);
    });

    test('should handle processing errors gracefully', async () => {
      const invalidVideo = createMockVideo({
        path: 'invalid/path.mp4',
        format: 'invalid'
      });

      await expect(videoProcessor.processVideo(invalidVideo))
        .rejects.toThrow();

      expect(invalidVideo.status).toBe(ProcessingStatus.FAILED);
    });
  });

  describe('standardizeFormat', () => {
    test('should convert video to target format with correct resolution', async () => {
      const testVideo = createMockVideo({
        path: TEST_VIDEO_PATH,
        format: 'avi'
      });

      const standardizedPath = await videoProcessor['standardizeFormat'](testVideo);

      expect(standardizedPath).toMatch(/\.mp4$/);
      expect(metricsCollector.recordProcessingMetrics).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'format_standardization'
        })
      );
    });

    test('should reject unsupported formats', async () => {
      const invalidVideo = createMockVideo({
        path: TEST_VIDEO_PATH,
        format: 'unsupported'
      });

      await expect(videoProcessor['standardizeFormat'](invalidVideo))
        .rejects.toThrow('Unsupported video format');
    });
  });

  describe('extractFrames', () => {
    test('should extract correct number of frames with GPU optimization', async () => {
      const frames = await videoProcessor['extractFrames'](
        TEST_VIDEO_PATH,
        30,
        { batchSize: 32, gpuMemoryLimit: GPU_MEMORY_LIMIT }
      );

      expect(frames.length).toBe(TEST_FRAME_COUNT);
      expect(gpuUtils.getMemoryInfo).toHaveBeenCalled();
    });

    test('should handle GPU memory limits during frame extraction', async () => {
      // Mock GPU memory pressure
      gpuUtils.getMemoryInfo.mockResolvedValueOnce({ used: 7168, total: 8192 });

      await videoProcessor['extractFrames'](
        TEST_VIDEO_PATH,
        30,
        { batchSize: 32, gpuMemoryLimit: GPU_MEMORY_LIMIT }
      );

      // Verify memory management
      expect(gpuUtils.releaseMemory).toHaveBeenCalled();
      expect(gpuUtils.allocateMemory).toHaveBeenCalledTimes(2);
    });
  });

  describe('processFramesInParallel', () => {
    test('should process frames in batches with GPU acceleration', async () => {
      const mockFrames = Array(TEST_FRAME_COUNT).fill(Buffer.from('mock-frame'));

      const processedFrames = await videoProcessor['processFramesInParallel'](mockFrames);

      expect(processedFrames.length).toBe(TEST_FRAME_COUNT);
      expect(metricsCollector.recordProcessingMetrics).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'frame_processing'
        })
      );
    });
  });
});