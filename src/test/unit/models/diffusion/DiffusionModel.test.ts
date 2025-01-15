import { jest, describe, beforeAll, afterAll, beforeEach, it, expect } from '@jest/globals';
import { DiffusionModel } from '../../../../backend/src/core/models/diffusion/DiffusionModel';
import { DiffusionConfig } from '../../../../backend/src/core/models/diffusion/DiffusionConfig';
import { TestUtils } from '../../../utils/testHelpers';
import { GPUMock } from '../../../utils/gpuMock';
import { ProcessingStatus, VideoResolutionImpl } from '../../../../backend/src/types/common';
import { SafetyCheckType, SafetyStatus } from '../../../../backend/src/types/safety';
import { PERFORMANCE_THRESHOLDS, MODEL_ARCHITECTURES } from '../../../../backend/src/types/models';

describe('DiffusionModel', () => {
  let model: DiffusionModel;
  let defaultConfig: DiffusionConfig;

  beforeAll(async () => {
    await TestUtils.setupTestEnvironment({
      gpuDevices: 2,
      gpuMemory: 80 * 1024 * 1024 * 1024, // 80GB
      enableProfiling: true
    });

    defaultConfig = {
      version: '1.0.0',
      architecture: MODEL_ARCHITECTURES.DIFFUSION_7B,
      denoising: {
        steps: 50,
        guidanceScale: 7.5,
        noiseSchedule: 'linear',
        validateDenoising: () => true
      },
      generation: {
        resolution: new VideoResolutionImpl(1280, 720),
        numFrames: 57,
        batchSize: 1,
        validateGeneration: () => true
      },
      validate: () => true
    };
  });

  afterAll(async () => {
    await TestUtils.teardownTestEnvironment();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    GPUMock.mockInitializeGPU.mockClear();
    GPUMock.mockGetGPUMetrics.mockClear();
  });

  describe('Model Initialization', () => {
    it('should initialize with valid configuration including safety settings', async () => {
      const model = new DiffusionModel(defaultConfig, {
        deviceCount: 2,
        memoryLimit: 80 * 1024 * 1024 * 1024,
        computeCapability: '8.0',
        deviceType: 'H100'
      });

      expect(model).toBeDefined();
      expect(model.architecture).toEqual(MODEL_ARCHITECTURES.DIFFUSION_7B);
      expect(GPUMock.mockInitializeGPU).toHaveBeenCalledTimes(1);
    });

    it('should throw error with invalid configuration', () => {
      const invalidConfig = {
        ...defaultConfig,
        validate: () => false
      };

      expect(() => new DiffusionModel(invalidConfig, {
        deviceCount: 2,
        memoryLimit: 80 * 1024 * 1024 * 1024,
        computeCapability: '8.0',
        deviceType: 'H100'
      })).toThrow('Invalid diffusion model configuration');
    });

    it('should initialize GPU resources with proper allocation', async () => {
      const model = new DiffusionModel(defaultConfig, {
        deviceCount: 2,
        memoryLimit: 80 * 1024 * 1024 * 1024,
        computeCapability: '8.0',
        deviceType: 'H100'
      });

      expect(GPUMock.mockInitializeGPU).toHaveBeenCalledWith(expect.objectContaining({
        deviceCount: 2,
        memoryLimit: 80 * 1024 * 1024 * 1024
      }));
    });
  });

  describe('Video Generation', () => {
    it('should generate video within performance thresholds', async () => {
      const startTime = performance.now();
      const result = await model.generate(
        'test prompt',
        new VideoResolutionImpl(1280, 720),
        57,
        {
          guidanceScale: 7.5,
          numInferenceSteps: 50,
          safetyChecks: true
        }
      );

      const generationTime = performance.now() - startTime;
      expect(generationTime).toBeLessThan(PERFORMANCE_THRESHOLDS.MAX_GENERATION_TIME);
      expect(result.status).toBe(ProcessingStatus.COMPLETED);
    });

    it('should enforce safety constraints', async () => {
      const result = await model.generate(
        'test prompt',
        new VideoResolutionImpl(1280, 720),
        57,
        {
          guidanceScale: 7.5,
          numInferenceSteps: 50,
          safetyChecks: true
        }
      );

      expect(result.safetyResults).toBeDefined();
      expect(result.safetyResults[0].checkType).toBe(SafetyCheckType.CONTENT_SAFETY);
      expect(result.safetyResults[0].status).toBe(SafetyStatus.PASS);
    });

    it('should handle resource allocation/cleanup properly', async () => {
      await model.generate(
        'test prompt',
        new VideoResolutionImpl(1280, 720),
        57,
        {
          guidanceScale: 7.5,
          numInferenceSteps: 50,
          safetyChecks: true
        }
      );

      expect(GPUMock.mockAllocateGPUMemory).toHaveBeenCalled();
      expect(GPUMock.mockReleaseGPUMemory).toHaveBeenCalled();
    });
  });

  describe('Performance Metrics', () => {
    it('should track detailed GPU metrics', async () => {
      await model.generate(
        'test prompt',
        new VideoResolutionImpl(1280, 720),
        57,
        {
          guidanceScale: 7.5,
          numInferenceSteps: 50,
          safetyChecks: true
        }
      );

      const metrics = model.getPerformanceMetrics();
      expect(metrics.gpuMemoryUsage).toBeDefined();
      expect(metrics.generationTime).toBeDefined();
      expect(metrics.throughput).toBeGreaterThan(0);
    });

    it('should monitor memory fragmentation', async () => {
      GPUMock.simulateMemoryFragmentation(0, 0.2);
      
      const metrics = await model.getPerformanceMetrics();
      expect(metrics.gpuMemoryUsage).toBeLessThan(PERFORMANCE_THRESHOLDS.MAX_GPU_MEMORY);
    });

    it('should measure generation latency accurately', async () => {
      const startTime = performance.now();
      await model.generate(
        'test prompt',
        new VideoResolutionImpl(1280, 720),
        57,
        {
          guidanceScale: 7.5,
          numInferenceSteps: 50,
          safetyChecks: true
        }
      );
      const endTime = performance.now();

      const metrics = model.getPerformanceMetrics();
      expect(metrics.generationTime).toBeLessThanOrEqual(endTime - startTime);
    });
  });

  describe('Resource Management', () => {
    it('should handle memory fragmentation', async () => {
      GPUMock.simulateMemoryFragmentation(0, 0.3);
      
      const result = await model.generate(
        'test prompt',
        new VideoResolutionImpl(1280, 720),
        57,
        {
          guidanceScale: 7.5,
          numInferenceSteps: 50,
          safetyChecks: true
        }
      );

      expect(result.status).toBe(ProcessingStatus.COMPLETED);
    });

    it('should manage concurrent operations', async () => {
      GPUMock.simulateConcurrentOperations(0, 5);
      
      const promises = Array(3).fill(null).map(() => model.generate(
        'test prompt',
        new VideoResolutionImpl(1280, 720),
        57,
        {
          guidanceScale: 7.5,
          numInferenceSteps: 50,
          safetyChecks: true
        }
      ));

      const results = await Promise.all(promises);
      expect(results.every(r => r.status === ProcessingStatus.COMPLETED)).toBe(true);
    });

    it('should cleanup resources properly', async () => {
      await model.generate(
        'test prompt',
        new VideoResolutionImpl(1280, 720),
        57,
        {
          guidanceScale: 7.5,
          numInferenceSteps: 50,
          safetyChecks: true
        }
      );

      const metrics = await GPUMock.mockGetGPUMetrics(0);
      expect(metrics.memoryUsed).toBe(0);
    });
  });

  describe('Safety Compliance', () => {
    it('should validate content safety', async () => {
      const result = await model.generate(
        'test prompt',
        new VideoResolutionImpl(1280, 720),
        57,
        {
          guidanceScale: 7.5,
          numInferenceSteps: 50,
          safetyChecks: true
        }
      );

      expect(result.safetyResults).toContainEqual(
        expect.objectContaining({
          checkType: SafetyCheckType.CONTENT_SAFETY,
          status: SafetyStatus.PASS
        })
      );
    });

    it('should enforce face protection', async () => {
      const result = await model.generate(
        'test prompt with people',
        new VideoResolutionImpl(1280, 720),
        57,
        {
          guidanceScale: 7.5,
          numInferenceSteps: 50,
          safetyChecks: true
        }
      );

      expect(result.safetyResults).toContainEqual(
        expect.objectContaining({
          checkType: SafetyCheckType.FACE_DETECTION,
          status: SafetyStatus.PASS
        })
      );
    });

    it('should maintain audit trail', async () => {
      const result = await model.generate(
        'test prompt',
        new VideoResolutionImpl(1280, 720),
        57,
        {
          guidanceScale: 7.5,
          numInferenceSteps: 50,
          safetyChecks: true
        }
      );

      expect(result.safetyResults.every(r => r.timestamp instanceof Date)).toBe(true);
    });
  });
});