import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';

import { AutoregressiveModel } from '../../../../backend/src/core/models/autoregressive/AutoregressiveModel';
import { AutoregressiveConfig } from '../../../../backend/src/core/models/autoregressive/AutoregressiveConfig';
import { setupTestEnvironment, teardownTestEnvironment } from '../../../utils/testHelpers';
import { createMockModel } from '../../../utils/mockData';
import { ModelType, ProcessingStatus, VideoResolutionImpl } from '../../../../backend/src/types/common';
import { PERFORMANCE_THRESHOLDS } from '../../../../backend/src/types/models';

// Test constants based on technical specifications
const TEST_TIMEOUT = 60000; // 60s timeout for generation tests
const DEFAULT_TEST_RESOLUTION = new VideoResolutionImpl(1280, 720);
const DEFAULT_TEST_FRAMES = 57; // From technical spec
const PERFORMANCE_THRESHOLD_MS = 600000; // 600s max generation time
const MIN_QUALITY_SCORE = 0.85;

describe('AutoregressiveModel', () => {
  let model: AutoregressiveModel;
  let mockConfig: AutoregressiveConfig;

  beforeAll(async () => {
    // Setup test environment with GPU simulation
    await setupTestEnvironment({
      gpuDevices: 2,
      gpuMemory: 80 * 1024 * 1024 * 1024, // 80GB
      enableProfiling: true
    });
  });

  afterAll(async () => {
    await teardownTestEnvironment();
  });

  beforeEach(() => {
    // Initialize fresh model instance before each test
    mockConfig = {
      architecture: {
        type: ModelType.AUTOREGRESSIVE_4B,
        parameters: 4e9, // 4B parameters
        variant: 'base'
      },
      maxResolution: DEFAULT_TEST_RESOLUTION,
      maxFrames: DEFAULT_TEST_FRAMES,
      batchSize: 16,
      temperature: 0.8,
      topK: 50,
      topP: 0.9,
      configVersion: '1.0.0'
    };
    model = createMockModel() as unknown as AutoregressiveModel;
  });

  afterEach(() => {
    // Cleanup after each test
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should initialize with valid configuration', () => {
      expect(() => new AutoregressiveModel(mockConfig)).not.toThrow();
      expect(model.architecture.type).toBe(ModelType.AUTOREGRESSIVE_4B);
      expect(model.architecture.parameters).toBe(4e9);
    });

    test('should throw error for invalid parameter count', () => {
      const invalidConfig = {
        ...mockConfig,
        architecture: {
          ...mockConfig.architecture,
          parameters: 2e9 // Below 4B minimum
        }
      };
      expect(() => new AutoregressiveModel(invalidConfig)).toThrow('Model parameters must be between 4B and 13B');
    });

    test('should validate GPU memory requirements', () => {
      const model = new AutoregressiveModel(mockConfig);
      expect(model['validateConfig']()).toBe(true);
      expect(model['memoryManager']).toBeDefined();
    });

    test('should initialize CUDA resources correctly', () => {
      const model = new AutoregressiveModel(mockConfig);
      expect(model['stream']).toBeDefined();
      expect(model['stream'].priority).toBe(0);
    });
  });

  describe('generate', () => {
    test('should generate video within performance requirements', async () => {
      const prompt = 'Test video generation';
      const startTime = Date.now();

      const result = await model.generate(
        prompt,
        DEFAULT_TEST_RESOLUTION,
        DEFAULT_TEST_FRAMES
      );

      const generationTime = Date.now() - startTime;
      expect(generationTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
      expect(result).toBeInstanceOf(Buffer);
    });

    test('should enforce frame count limits', async () => {
      const prompt = 'Test video generation';
      const invalidFrameCount = DEFAULT_TEST_FRAMES + 100;

      await expect(
        model.generate(prompt, DEFAULT_TEST_RESOLUTION, invalidFrameCount)
      ).rejects.toThrow('Generation parameters exceed model capabilities');
    });

    test('should handle batch processing correctly', async () => {
      const prompt = 'Test batch processing';
      const metrics = model.getPerformanceMetrics();
      
      await model.generate(prompt, DEFAULT_TEST_RESOLUTION, DEFAULT_TEST_FRAMES);
      
      expect(metrics.throughput).toBeGreaterThan(0);
      expect(metrics.gpuMemoryUsage).toBeLessThan(PERFORMANCE_THRESHOLDS.MAX_GPU_MEMORY);
    });

    test('should maintain quality metrics above thresholds', async () => {
      const prompt = 'Test quality metrics';
      await model.generate(prompt, DEFAULT_TEST_RESOLUTION, DEFAULT_TEST_FRAMES);
      
      const metrics = model.getPerformanceMetrics();
      expect(metrics.psnrScore).toBeGreaterThan(PERFORMANCE_THRESHOLDS.MIN_PSNR);
    });

    test('should handle GPU memory management', async () => {
      const prompt = 'Test memory management';
      const initialMemory = model.getPerformanceMetrics().gpuMemoryUsage;
      
      await model.generate(prompt, DEFAULT_TEST_RESOLUTION, DEFAULT_TEST_FRAMES);
      
      const finalMemory = model.getPerformanceMetrics().gpuMemoryUsage;
      expect(finalMemory).toBeGreaterThanOrEqual(initialMemory);
      expect(finalMemory).toBeLessThan(PERFORMANCE_THRESHOLDS.MAX_GPU_MEMORY);
    });

    test('should handle errors gracefully', async () => {
      const prompt = 'Test error handling';
      // Simulate GPU error
      jest.spyOn(model['stream'], 'synchronize').mockRejectedValueOnce(new Error('GPU Error'));
      
      await expect(
        model.generate(prompt, DEFAULT_TEST_RESOLUTION, DEFAULT_TEST_FRAMES)
      ).rejects.toThrow('GPU Error');
    });
  });

  describe('getPerformanceMetrics', () => {
    test('should track GPU memory usage accurately', async () => {
      const metrics = model.getPerformanceMetrics();
      expect(metrics.gpuMemoryUsage).toBeGreaterThanOrEqual(0);
      expect(metrics.gpuMemoryUsage).toBeLessThan(PERFORMANCE_THRESHOLDS.MAX_GPU_MEMORY);
    });

    test('should track generation time accurately', async () => {
      const prompt = 'Test performance tracking';
      await model.generate(prompt, DEFAULT_TEST_RESOLUTION, DEFAULT_TEST_FRAMES);
      
      const metrics = model.getPerformanceMetrics();
      expect(metrics.generationTime).toBeGreaterThan(0);
      expect(metrics.generationTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
    });

    test('should track quality metrics accurately', async () => {
      const prompt = 'Test quality tracking';
      await model.generate(prompt, DEFAULT_TEST_RESOLUTION, DEFAULT_TEST_FRAMES);
      
      const metrics = model.getPerformanceMetrics();
      expect(metrics.psnrScore).toBeGreaterThan(0);
      expect(metrics.psnrScore).toBeLessThan(100);
    });

    test('should track throughput accurately', async () => {
      const prompt = 'Test throughput tracking';
      await model.generate(prompt, DEFAULT_TEST_RESOLUTION, DEFAULT_TEST_FRAMES);
      
      const metrics = model.getPerformanceMetrics();
      expect(metrics.throughput).toBeGreaterThan(0);
      expect(metrics.throughput).toBeDefined();
    });
  });
});