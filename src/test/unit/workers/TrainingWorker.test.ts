import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import { TrainingWorker } from '../../../backend/src/workers/TrainingWorker';
import { GPUMockUtils } from '../../utils/gpuMock';
import { TestDataGenerator } from '../../utils/mockData';
import { ProcessingStatus } from '../../../backend/src/types/common';
import { ModelType } from '../../../backend/src/types/common';
import { DistributedConfig } from '../../../backend/src/core/models/interfaces/ITrainer';
import { GPUConfig } from '../../../backend/src/types/config';

describe('TrainingWorker', () => {
  let trainingWorker: TrainingWorker;
  let mockModelService: any;
  let mockTrainer: any;
  let mockGPU: typeof GPUMockUtils;
  let mockDistributedConfig: DistributedConfig;
  let mockGPUConfig: GPUConfig;

  beforeEach(() => {
    // Initialize mock GPU utilities
    mockGPU = {
      mockInitializeGPU: jest.fn(),
      mockGetGPUMetrics: jest.fn(),
      mockAllocateGPUMemory: jest.fn(),
      mockReleaseGPUMemory: jest.fn(),
      mockSimulateNetworkLatency: jest.fn(),
      mockMemoryFragmentation: jest.fn()
    };

    // Setup mock distributed configuration
    mockDistributedConfig = {
      worldSize: 4,
      rank: 0,
      backend: 'nccl',
      masterAddr: 'localhost',
      masterPort: 29500,
      useShardedDDP: true,
      useFSDP: true,
      gradientSyncInterval: 16
    };

    // Setup mock GPU configuration
    mockGPUConfig = {
      deviceCount: 8,
      memoryLimit: 80 * 1024 * 1024 * 1024, // 80GB
      computeCapability: '8.0',
      deviceType: 'H100',
      parallelization: {
        modelParallel: true,
        dataParallel: true,
        pipelineParallel: true,
        tensorParallel: true,
        deviceMapping: { 0: 0, 1: 1, 2: 2, 3: 3 }
      }
    };

    // Setup mock model service and trainer
    mockModelService = {
      trainModel: jest.fn(),
      getPerformanceMetrics: jest.fn()
    };

    mockTrainer = {
      initializeDistributedTraining: jest.fn(),
      getTrainingMetrics: jest.fn(),
      train: jest.fn()
    };

    // Initialize training worker
    trainingWorker = new TrainingWorker(mockModelService, mockTrainer, mockDistributedConfig);
  });

  describe('Distributed Training Initialization', () => {
    it('should initialize distributed training environment correctly', async () => {
      const config = TestDataGenerator.createDistributedConfig({
        modelType: ModelType.DIFFUSION_7B
      });

      await trainingWorker.startTraining(config, '/data/training', mockGPUConfig);

      expect(mockGPU.mockInitializeGPU).toHaveBeenCalledWith(mockGPUConfig);
      expect(mockTrainer.initializeDistributedTraining).toHaveBeenCalledWith(mockDistributedConfig);
      expect(trainingWorker.getTrainingStatus()).resolves.toMatchObject({
        status: ProcessingStatus.PROCESSING
      });
    });

    it('should handle initialization failures gracefully', async () => {
      mockGPU.mockInitializeGPU.mockRejectedValue(new Error('GPU initialization failed'));

      await expect(trainingWorker.startTraining(
        TestDataGenerator.createDistributedConfig(),
        '/data/training',
        mockGPUConfig
      )).rejects.toThrow('GPU initialization failed');

      expect(trainingWorker.getTrainingStatus()).resolves.toMatchObject({
        status: ProcessingStatus.FAILED
      });
    });
  });

  describe('Memory Management', () => {
    it('should optimize memory usage during training', async () => {
      const memoryMetrics = {
        allocated: 60 * 1024 * 1024 * 1024, // 60GB
        utilization: 75,
        temperature: 65
      };

      mockGPU.mockGetGPUMetrics.mockResolvedValue(memoryMetrics);

      await trainingWorker.startTraining(
        TestDataGenerator.createDistributedConfig(),
        '/data/training',
        mockGPUConfig
      );

      expect(mockGPU.mockAllocateGPUMemory).toHaveBeenCalledWith(0, expect.any(Number));
      expect(mockGPU.mockGetGPUMetrics).toHaveBeenCalled();
    });

    it('should handle memory fragmentation', async () => {
      mockGPU.mockMemoryFragmentation.mockResolvedValue(0.15); // 15% fragmentation

      await trainingWorker.startTraining(
        TestDataGenerator.createDistributedConfig(),
        '/data/training',
        mockGPUConfig
      );

      const metrics = await trainingWorker.getTrainingStatus();
      expect(metrics.gpuMetrics.get(0)).toHaveProperty('memoryFragmentation');
      expect(mockGPU.mockReleaseGPUMemory).toHaveBeenCalled();
    });
  });

  describe('Network Resilience', () => {
    it('should handle network latency gracefully', async () => {
      mockGPU.mockSimulateNetworkLatency.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 100))
      );

      await trainingWorker.startTraining(
        TestDataGenerator.createDistributedConfig(),
        '/data/training',
        mockGPUConfig
      );

      expect(mockTrainer.initializeDistributedTraining).toHaveBeenCalled();
      expect(trainingWorker.getTrainingStatus()).resolves.not.toMatchObject({
        status: ProcessingStatus.FAILED
      });
    });

    it('should recover from temporary network issues', async () => {
      let networkFailures = 0;
      mockTrainer.train.mockImplementation(() => {
        if (networkFailures++ < 2) {
          throw new Error('Network timeout');
        }
        return Promise.resolve();
      });

      await trainingWorker.startTraining(
        TestDataGenerator.createDistributedConfig(),
        '/data/training',
        mockGPUConfig
      );

      expect(mockTrainer.train).toHaveBeenCalledTimes(3);
      expect(trainingWorker.getTrainingStatus()).resolves.toMatchObject({
        status: ProcessingStatus.COMPLETED
      });
    });
  });

  describe('Performance Monitoring', () => {
    it('should track training performance metrics', async () => {
      const performanceMetrics = TestDataGenerator.generatePerformanceMetrics();
      mockTrainer.getTrainingMetrics.mockResolvedValue(performanceMetrics);

      await trainingWorker.startTraining(
        TestDataGenerator.createDistributedConfig(),
        '/data/training',
        mockGPUConfig
      );

      const status = await trainingWorker.getTrainingStatus();
      expect(status.metrics).toMatchObject({
        loss: expect.any(Number),
        learningRate: expect.any(Number),
        throughputSamplesPerSecond: expect.any(Number)
      });
    });

    it('should validate performance against thresholds', async () => {
      const metrics = {
        throughputSamplesPerSecond: 950, // Below 1000 threshold
        gpuMemoryUsed: {
          current: 85 * 1024 * 1024 * 1024 // Above 80GB threshold
        }
      };

      mockTrainer.getTrainingMetrics.mockResolvedValue(metrics);

      await trainingWorker.startTraining(
        TestDataGenerator.createDistributedConfig(),
        '/data/training',
        mockGPUConfig
      );

      const status = await trainingWorker.getTrainingStatus();
      expect(status.status).toBe(ProcessingStatus.COMPLETED);
      expect(console.warn).toHaveBeenCalled();
    });
  });

  describe('Cleanup and Resource Management', () => {
    it('should cleanup resources on training completion', async () => {
      await trainingWorker.startTraining(
        TestDataGenerator.createDistributedConfig(),
        '/data/training',
        mockGPUConfig
      );
      await trainingWorker.stopTraining();

      expect(mockGPU.mockReleaseGPUMemory).toHaveBeenCalled();
      expect(trainingWorker.getTrainingStatus()).resolves.toMatchObject({
        status: ProcessingStatus.CANCELLED
      });
    });

    it('should handle cleanup failures gracefully', async () => {
      mockGPU.mockReleaseGPUMemory.mockRejectedValue(new Error('Cleanup failed'));

      await trainingWorker.startTraining(
        TestDataGenerator.createDistributedConfig(),
        '/data/training',
        mockGPUConfig
      );
      await trainingWorker.stopTraining();

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Cleanup failed')
      );
    });
  });
});