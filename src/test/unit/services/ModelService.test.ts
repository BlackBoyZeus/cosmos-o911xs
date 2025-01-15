import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { mock, mockReset } from 'jest-mock-extended';

// Internal imports
import { ModelService } from '../../../backend/src/services/ModelService';
import { createMockModel } from '../../utils/mockData';
import { setupTestEnvironment, teardownTestEnvironment } from '../../utils/testHelpers';
import { mockInitializeGPU, mockGetGPUMetrics } from '../../utils/gpuMock';

// Types
import { ModelType, ProcessingStatus, VideoResolutionImpl } from '../../../backend/src/types/common';
import { SafetyCheckType, SafetyStatus } from '../../../backend/src/types/safety';
import { IModel } from '../../../backend/src/interfaces/IModel';
import { ITrainer } from '../../../backend/src/core/models/interfaces/ITrainer';

// Constants
const TEST_TIMEOUT = 30000;
const MOCK_VIDEO_PROMPT = "A test video generation prompt";
const MOCK_RESOLUTION = new VideoResolutionImpl(1280, 720);
const MOCK_FRAME_COUNT = 57;
const GPU_MEMORY_THRESHOLD = 80_000_000_000; // 80GB
const MAX_GENERATION_TIME = 600_000; // 600s
const DISTRIBUTED_NODE_COUNT = 4;

describe('ModelService', () => {
  let modelService: ModelService;
  let mockModel: IModel;
  let mockTrainer: jest.Mocked<ITrainer>;
  let mockGPUManager: jest.Mocked<any>;

  beforeEach(async () => {
    // Set up test environment
    await setupTestEnvironment({
      gpuDevices: DISTRIBUTED_NODE_COUNT,
      gpuMemory: GPU_MEMORY_THRESHOLD
    });

    // Initialize mocks
    mockModel = createMockModel({
      architecture: {
        type: ModelType.DIFFUSION_7B,
        parameterCount: 7e9,
        contextLength: 1024,
        maxBatchSize: 8,
        supportedResolutions: [MOCK_RESOLUTION]
      }
    });

    mockTrainer = mock<ITrainer>();
    mockGPUManager = {
      getAvailableMemory: jest.fn(),
      monitorUtilization: jest.fn(),
      cleanup: jest.fn()
    };

    // Initialize ModelService
    modelService = new ModelService(mockModel, mockTrainer, mockGPUManager);
  });

  afterEach(async () => {
    mockReset(mockTrainer);
    mockReset(mockGPUManager);
    await teardownTestEnvironment();
  });

  describe('generateVideo', () => {
    it('should successfully generate video within latency requirements', async () => {
      // Setup
      const startTime = Date.now();
      mockGPUManager.getAvailableMemory.mockResolvedValue(GPU_MEMORY_THRESHOLD);
      mockGPUManager.monitorUtilization.mockResolvedValue(40);

      // Execute
      const result = await modelService.generateVideo(
        MOCK_VIDEO_PROMPT,
        MOCK_RESOLUTION,
        MOCK_FRAME_COUNT,
        { guidanceScale: 7.5, numInferenceSteps: 50 }
      );

      // Verify
      const generationTime = Date.now() - startTime;
      expect(generationTime).toBeLessThan(MAX_GENERATION_TIME);
      expect(result.status).toBe(ProcessingStatus.COMPLETED);
      expect(result.performance.psnrScore).toBeGreaterThan(30.0);
    });

    it('should handle GPU memory constraints appropriately', async () => {
      // Setup
      mockGPUManager.getAvailableMemory.mockResolvedValue(GPU_MEMORY_THRESHOLD * 0.9);
      mockGPUManager.monitorUtilization.mockResolvedValue(75);

      // Execute & Verify
      await expect(modelService.generateVideo(
        MOCK_VIDEO_PROMPT,
        MOCK_RESOLUTION,
        MOCK_FRAME_COUNT,
        { guidanceScale: 7.5, numInferenceSteps: 50 }
      )).resolves.not.toThrow();

      expect(mockGPUManager.cleanup).toHaveBeenCalled();
    });

    it('should enforce safety guardrails during generation', async () => {
      // Setup
      const safetyConfig = {
        contentSafetyThreshold: 0.9,
        faceDetectionThreshold: 0.95
      };

      // Execute
      const result = await modelService.generateVideo(
        MOCK_VIDEO_PROMPT,
        MOCK_RESOLUTION,
        MOCK_FRAME_COUNT,
        { 
          guidanceScale: 7.5,
          numInferenceSteps: 50,
          safetyChecks: true
        }
      );

      // Verify
      expect(result.safetyResults).toBeDefined();
      expect(result.safetyResults[0].checkType).toBe(SafetyCheckType.CONTENT_SAFETY);
      expect(result.safetyResults[0].status).toBe(SafetyStatus.PASS);
    });
  });

  describe('trainModel', () => {
    it('should support distributed training configuration', async () => {
      // Setup
      const distributedConfig = {
        worldSize: DISTRIBUTED_NODE_COUNT,
        rank: 0,
        backend: 'nccl' as const,
        masterAddr: 'localhost',
        masterPort: 29500,
        useShardedDDP: true,
        useFSDP: true,
        gradientSyncInterval: 16
      };

      // Execute
      await modelService.trainModel(
        {
          batchSize: 32,
          learningRate: 1e-4,
          epochs: 100
        },
        '/path/to/dataset',
        distributedConfig
      );

      // Verify
      expect(mockTrainer.initializeDistributedTraining)
        .toHaveBeenCalledWith(distributedConfig);
      expect(mockTrainer.train).toHaveBeenCalled();
    });

    it('should monitor GPU resources during training', async () => {
      // Setup
      mockGPUManager.monitorUtilization.mockResolvedValue(60);

      // Execute
      await modelService.trainModel(
        {
          batchSize: 32,
          learningRate: 1e-4,
          epochs: 100
        },
        '/path/to/dataset',
        {
          worldSize: DISTRIBUTED_NODE_COUNT,
          rank: 0,
          backend: 'nccl' as const,
          masterAddr: 'localhost',
          masterPort: 29500,
          useShardedDDP: true,
          useFSDP: true,
          gradientSyncInterval: 16
        }
      );

      // Verify
      expect(mockGPUManager.monitorUtilization).toHaveBeenCalled();
      const metrics = modelService.getPerformanceMetrics();
      expect(metrics.gpuMemoryUsage).toBeLessThan(GPU_MEMORY_THRESHOLD);
    });
  });

  describe('getPerformanceMetrics', () => {
    it('should track comprehensive performance metrics', async () => {
      // Setup
      mockGPUManager.monitorUtilization.mockResolvedValue(50);

      // Execute generation to populate metrics
      await modelService.generateVideo(
        MOCK_VIDEO_PROMPT,
        MOCK_RESOLUTION,
        MOCK_FRAME_COUNT,
        { guidanceScale: 7.5, numInferenceSteps: 50 }
      );

      // Get and verify metrics
      const metrics = modelService.getPerformanceMetrics();
      expect(metrics).toEqual(expect.objectContaining({
        generationTime: expect.any(Number),
        gpuMemoryUsage: expect.any(Number),
        throughput: expect.any(Number),
        psnrScore: expect.any(Number)
      }));

      // Verify thresholds
      expect(metrics.generationTime).toBeLessThan(MAX_GENERATION_TIME);
      expect(metrics.gpuMemoryUsage).toBeLessThan(GPU_MEMORY_THRESHOLD);
      expect(metrics.throughput).toBeGreaterThan(0);
      expect(metrics.psnrScore).toBeGreaterThan(27.5);
    });
  });
});