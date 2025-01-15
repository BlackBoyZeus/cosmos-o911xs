import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { GenerationWorker } from '../../../backend/src/workers/GenerationWorker';
import { 
  createMockGenerationRequest, 
  createMockModel, 
  createMockVideo,
  createMockSafetyLog 
} from '../../utils/mockData';
import { MockStorageService } from '../../utils/storageMock';
import { 
  ProcessingStatus, 
  VideoResolutionImpl 
} from '../../../backend/src/types/common';
import { 
  SafetyCheckType, 
  SafetyStatus, 
  GuardType 
} from '../../../backend/src/types/safety';
import { Logger } from 'winston';

// Constants from technical specifications
const TEST_TIMEOUT_MS = 10000;
const MOCK_VIDEO_PATH = 'test/video.mp4';
const PERFORMANCE_THRESHOLDS = {
  maxLatency: 600, // 600s for 57 frames
  maxMemoryGB: 80,
  maxGPUUtil: 95
};

describe('GenerationWorker', () => {
  let worker: GenerationWorker;
  let mockModel: any;
  let mockPreGuard: any;
  let mockPostGuard: any;
  let mockStorage: MockStorageService;
  let mockLogger: any;

  beforeEach(() => {
    // Initialize mocks with enhanced capabilities
    mockModel = {
      ...createMockModel(),
      generate: jest.fn(),
      validateCapabilities: jest.fn().mockReturnValue(true),
      getPerformanceMetrics: jest.fn()
    };

    mockPreGuard = {
      check: jest.fn().mockResolvedValue({
        passed: true,
        details: {},
        duration: 100
      })
    };

    mockPostGuard = {
      check: jest.fn().mockResolvedValue({
        passed: true,
        details: {},
        duration: 150
      })
    };

    mockStorage = new MockStorageService({
      provider: 'mock',
      region: 'test',
      bucketName: 'test-bucket',
      credentials: {},
      encryption: { enabled: false },
      lifecycle: { enabled: false, archivalDays: 0, deletionDays: 0, transitionRules: [] }
    });

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };

    worker = new GenerationWorker(
      mockModel,
      mockPreGuard,
      mockPostGuard,
      mockStorage,
      mockLogger as Logger
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
    mockStorage.reset();
  });

  describe('Performance Requirements', () => {
    it('should generate video within latency requirements', async () => {
      const request = createMockGenerationRequest({
        frameCount: 57,
        resolution: new VideoResolutionImpl(1280, 720)
      });

      const mockVideo = createMockVideo();
      mockModel.generate.mockResolvedValue({
        videoData: Buffer.from('test'),
        metadata: {
          fps: 30,
          resolution: request.resolution
        },
        performance: {
          generationTime: 550000, // Under 600s requirement
          gpuMemoryUsage: 75, // Under 80GB requirement
          throughput: 90 // Good GPU utilization
        },
        status: ProcessingStatus.COMPLETED
      });

      const response = await worker.handleRequest(request);

      expect(response.generationTime).toBeLessThanOrEqual(PERFORMANCE_THRESHOLDS.maxLatency * 1000);
      expect(response.performanceMetrics.gpuMemoryUsed).toBeLessThanOrEqual(PERFORMANCE_THRESHOLDS.maxMemoryGB);
      expect(response.performanceMetrics.gpuUtilization).toBeLessThanOrEqual(PERFORMANCE_THRESHOLDS.maxGPUUtil);
    });

    it('should track and report detailed performance metrics', async () => {
      const request = createMockGenerationRequest();
      mockModel.generate.mockResolvedValue({
        videoData: Buffer.from('test'),
        metadata: { fps: 30 },
        performance: {
          generationTime: 300000,
          gpuMemoryUsage: 60,
          throughput: 85
        },
        status: ProcessingStatus.COMPLETED
      });

      const response = await worker.handleRequest(request);

      expect(response.performanceMetrics).toEqual(expect.objectContaining({
        generationTimeMs: expect.any(Number),
        framesPerSecond: expect.any(Number),
        gpuMemoryUsed: expect.any(Number),
        gpuUtilization: expect.any(Number),
        modelLoadTime: expect.any(Number),
        tokenizationTime: expect.any(Number),
        inferenceTime: expect.any(Number),
        postProcessingTime: expect.any(Number)
      }));
    });
  });

  describe('Safety Compliance', () => {
    it('should enforce face blur compliance', async () => {
      const request = createMockGenerationRequest();
      mockPostGuard.check.mockResolvedValueOnce({
        passed: true,
        details: {
          faceBlurCompliance: true,
          blurredFaces: 5
        },
        duration: 150
      });

      const response = await worker.handleRequest(request);

      expect(response.safetyResults).toHaveLength(2);
      expect(response.safetyResults[1].details.faceBlurCompliance).toBe(true);
    });

    it('should prevent harmful content generation', async () => {
      const request = createMockGenerationRequest();
      mockPreGuard.check.mockResolvedValueOnce({
        passed: false,
        details: {
          harmfulContent: true,
          violationType: 'inappropriate_content'
        },
        duration: 100
      });

      await expect(worker.handleRequest(request)).rejects.toThrow('Pre-generation safety check failed');
    });

    it('should maintain complete audit trail', async () => {
      const request = createMockGenerationRequest();
      const mockSafetyLog = createMockSafetyLog({
        checkType: SafetyCheckType.CONTENT_SAFETY,
        status: SafetyStatus.PASS
      });

      mockModel.generate.mockResolvedValue({
        videoData: Buffer.from('test'),
        metadata: { fps: 30 },
        performance: { generationTime: 300000, gpuMemoryUsage: 60, throughput: 85 },
        status: ProcessingStatus.COMPLETED
      });

      const response = await worker.handleRequest(request);

      expect(response.safetyResults).toBeDefined();
      expect(mockPreGuard.check).toHaveBeenCalledTimes(1);
      expect(mockPostGuard.check).toHaveBeenCalledTimes(1);
    });
  });

  describe('Generation Capabilities', () => {
    it('should support text-to-video generation', async () => {
      const request = createMockGenerationRequest({
        prompt: 'A scenic mountain landscape'
      });

      mockModel.generate.mockResolvedValue({
        videoData: Buffer.from('test'),
        metadata: { fps: 30 },
        performance: { generationTime: 300000, gpuMemoryUsage: 60, throughput: 85 },
        status: ProcessingStatus.COMPLETED
      });

      const response = await worker.handleRequest(request);

      expect(response.status).toBe(ProcessingStatus.COMPLETED);
      expect(mockModel.generate).toHaveBeenCalledWith(
        request.prompt,
        request.resolution,
        request.frameCount,
        expect.any(Object)
      );
    });

    it('should support multi-view video generation', async () => {
      const request = createMockGenerationRequest({
        multiViewConfig: {
          enabled: true,
          viewCount: 3,
          viewAngles: [0, 120, 240],
          viewDistances: [1.0, 1.0, 1.0],
          synchronizeViews: true
        }
      });

      mockModel.generate.mockResolvedValue({
        videoData: Buffer.from('test'),
        metadata: { fps: 30 },
        performance: { generationTime: 300000, gpuMemoryUsage: 60, throughput: 85 },
        status: ProcessingStatus.COMPLETED
      });

      const response = await worker.handleRequest(request);

      expect(response.status).toBe(ProcessingStatus.COMPLETED);
      expect(mockModel.generate).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.any(Number),
        expect.objectContaining({
          guidanceScale: expect.any(Number),
          numInferenceSteps: expect.any(Number)
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle model generation failures with retries', async () => {
      const request = createMockGenerationRequest();
      mockModel.generate
        .mockRejectedValueOnce(new Error('GPU error'))
        .mockRejectedValueOnce(new Error('GPU error'))
        .mockResolvedValueOnce({
          videoData: Buffer.from('test'),
          metadata: { fps: 30 },
          performance: { generationTime: 300000, gpuMemoryUsage: 60, throughput: 85 },
          status: ProcessingStatus.COMPLETED
        });

      const response = await worker.handleRequest(request);

      expect(response.status).toBe(ProcessingStatus.COMPLETED);
      expect(mockModel.generate).toHaveBeenCalledTimes(3);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Generation attempt'),
        expect.any(Object)
      );
    });

    it('should handle safety check failures appropriately', async () => {
      const request = createMockGenerationRequest();
      mockPostGuard.check.mockResolvedValue({
        passed: false,
        details: { reason: 'Content violation detected' },
        duration: 150
      });

      mockModel.generate.mockResolvedValue({
        videoData: Buffer.from('test'),
        metadata: { fps: 30 },
        performance: { generationTime: 300000, gpuMemoryUsage: 60, throughput: 85 },
        status: ProcessingStatus.COMPLETED
      });

      await expect(worker.handleRequest(request)).rejects.toThrow('Post-generation safety check failed');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});