import { jest, describe, beforeEach, afterEach, test, expect } from '@jest/globals';
import { UUID } from 'crypto';
import { GenerationService } from '../../../backend/src/services/GenerationService';
import { 
  createMockModel, 
  createMockGenerationRequest, 
  createMockSafetyLog 
} from '../../utils/mockData';
import { MockStorageService } from '../../utils/storageMock';
import { MetricsCollector } from '../../../backend/src/utils/metrics';
import { 
  ProcessingStatus, 
  ModelType,
  VideoResolutionImpl 
} from '../../../backend/src/types/common';
import { 
  SafetyCheckType,
  SafetyStatus,
  GuardType 
} from '../../../backend/src/types/safety';
import { PERFORMANCE_THRESHOLDS } from '../../../backend/src/types/models';

describe('GenerationService', () => {
  // Mock instances
  let mockModel: jest.Mocked<any>;
  let mockPreGuard: jest.Mocked<any>;
  let mockPostGuard: jest.Mocked<any>;
  let mockStorageService: MockStorageService;
  let mockMetricsCollector: jest.Mocked<MetricsCollector>;
  let generationService: GenerationService;

  beforeEach(() => {
    // Initialize mock model with timing simulation
    mockModel = createMockModel();
    mockModel.generate = jest.fn().mockImplementation(async () => ({
      videoData: Buffer.from('mock-video-data'),
      metadata: {
        resolution: new VideoResolutionImpl(1920, 1080),
        frameCount: 57,
        fps: 30
      },
      performance: {
        gpuMemoryUsage: 45.5,
        throughput: 2.5
      },
      status: ProcessingStatus.COMPLETED
    }));

    // Initialize mock guards
    mockPreGuard = {
      check: jest.fn().mockResolvedValue(SafetyStatus.PASS),
      logCheck: jest.fn().mockResolvedValue(undefined)
    };

    mockPostGuard = {
      check: jest.fn().mockResolvedValue(SafetyStatus.PASS),
      logCheck: jest.fn().mockResolvedValue(undefined)
    };

    // Initialize mock storage service
    mockStorageService = new MockStorageService({
      provider: 'aws',
      region: 'us-east-1',
      bucketName: 'test-bucket',
      credentials: {},
      encryption: { enabled: true },
      lifecycle: { enabled: false, archivalDays: 0, deletionDays: 0, transitionRules: [] }
    });

    // Initialize mock metrics collector
    mockMetricsCollector = {
      recordGenerationMetrics: jest.fn(),
      getInstance: jest.fn().mockReturnThis()
    } as any;

    // Initialize generation service
    generationService = new GenerationService(
      mockModel,
      mockPreGuard,
      mockPostGuard,
      mockStorageService as any
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
    mockStorageService.reset();
  });

  test('should successfully generate video with safety checks and performance tracking', async () => {
    // Create test request
    const request = createMockGenerationRequest({
      modelType: ModelType.DIFFUSION_7B,
      resolution: new VideoResolutionImpl(1920, 1080),
      frameCount: 57
    });

    // Execute generation
    const startTime = Date.now();
    const result = await generationService.generateVideo(request);
    const generationTime = Date.now() - startTime;

    // Verify pre-guard safety checks
    expect(mockPreGuard.check).toHaveBeenCalledWith(request, {
      modelType: request.modelType,
      resolution: request.resolution,
      prompt: request.prompt
    });

    // Verify model generation
    expect(mockModel.generate).toHaveBeenCalledWith(
      request.prompt,
      request.resolution,
      request.frameCount,
      expect.any(Object)
    );

    // Verify post-guard safety checks
    expect(mockPostGuard.check).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.objectContaining({
        modelType: request.modelType,
        resolution: request.resolution
      })
    );

    // Verify storage upload
    expect(mockStorageService.getMockFunction('upload')).toHaveBeenCalled();

    // Verify performance metrics
    expect(result.generationTime).toBeLessThanOrEqual(PERFORMANCE_THRESHOLDS.MAX_GENERATION_TIME);
    expect(result.performanceMetrics).toEqual(expect.objectContaining({
      generationTimeMs: expect.any(Number),
      framesPerSecond: expect.any(Number),
      gpuMemoryUsed: expect.any(Number),
      gpuUtilization: expect.any(Number)
    }));

    // Verify metrics collection
    expect(mockMetricsCollector.recordGenerationMetrics).toHaveBeenCalledWith(
      expect.any(Number),
      expect.objectContaining({
        modelType: request.modelType,
        resolution: `${request.resolution.width}x${request.resolution.height}`,
        frameCount: request.frameCount,
        success: true
      })
    );
  });

  test('should handle pre-guard safety check failures', async () => {
    // Configure pre-guard to fail
    mockPreGuard.check.mockResolvedValueOnce(SafetyStatus.FAIL);

    const request = createMockGenerationRequest();

    await expect(generationService.generateVideo(request))
      .rejects.toThrow('Pre-generation safety check failed');

    expect(mockModel.generate).not.toHaveBeenCalled();
    expect(mockPostGuard.check).not.toHaveBeenCalled();
  });

  test('should handle post-guard safety check failures', async () => {
    // Configure post-guard to fail
    mockPostGuard.check.mockResolvedValueOnce(SafetyStatus.FAIL);

    const request = createMockGenerationRequest();

    await expect(generationService.generateVideo(request))
      .rejects.toThrow('Post-generation safety check failed');

    expect(mockModel.generate).toHaveBeenCalled();
    expect(mockStorageService.getMockFunction('upload')).not.toHaveBeenCalled();
  });

  test('should validate request parameters', async () => {
    const invalidRequest = createMockGenerationRequest({
      frameCount: 0,
      resolution: new VideoResolutionImpl(0, 0)
    });

    await expect(generationService.generateVideo(invalidRequest))
      .rejects.toThrow(/Invalid resolution|Frame count must be between/);
  });

  test('should track performance metrics and warnings', async () => {
    // Configure model to simulate slow generation
    mockModel.generate.mockImplementationOnce(async () => {
      await new Promise(resolve => setTimeout(resolve, 700)); // Exceed threshold
      return {
        videoData: Buffer.from('mock-video-data'),
        metadata: { resolution: new VideoResolutionImpl(1920, 1080), frameCount: 57 },
        performance: { gpuMemoryUsage: 45.5, throughput: 2.5 },
        status: ProcessingStatus.COMPLETED
      };
    });

    const request = createMockGenerationRequest();
    const result = await generationService.generateVideo(request);

    expect(result.warnings).toContain('Generation time exceeded target threshold');
    expect(mockMetricsCollector.recordGenerationMetrics).toHaveBeenCalledWith(
      expect.any(Number),
      expect.objectContaining({ success: true })
    );
  });

  test('should handle model generation errors', async () => {
    mockModel.generate.mockRejectedValueOnce(new Error('GPU memory exceeded'));

    const request = createMockGenerationRequest();

    await expect(generationService.generateVideo(request))
      .rejects.toThrow('GPU memory exceeded');

    expect(mockMetricsCollector.recordGenerationMetrics).toHaveBeenCalledWith(
      expect.any(Number),
      expect.objectContaining({
        success: false,
        error: 'GPU memory exceeded'
      })
    );
  });

  test('should support multi-view generation', async () => {
    const request = createMockGenerationRequest({
      multiViewConfig: {
        enabled: true,
        viewCount: 3,
        viewAngles: [0, 120, 240],
        viewDistances: [1.0, 1.0, 1.0],
        synchronizeViews: true
      }
    });

    const result = await generationService.generateVideo(request);

    expect(mockModel.generate).toHaveBeenCalledWith(
      request.prompt,
      request.resolution,
      request.frameCount,
      expect.objectContaining({
        batchSize: 1,
        guidanceScale: 7.5,
        numInferenceSteps: 50
      })
    );

    expect(result.status).toBe(ProcessingStatus.COMPLETED);
  });
});