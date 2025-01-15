import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { GenerationService } from '../../../backend/src/services/GenerationService';
import { setupTestEnvironment, teardownTestEnvironment, waitForProcessing } from '../../utils/testHelpers';
import { createMockGenerationRequest, createMockModel } from '../../utils/mockData';
import { SafetyValidator } from '@safety/validator';
import { PerformanceMetrics } from '@testing/performance-metrics';
import { VideoResolutionImpl, ProcessingStatus, ModelType } from '../../../backend/src/types/common';

// Test constants
const TEST_TIMEOUT = 900000; // 15 minutes
const DEFAULT_RESOLUTION = { width: 1280, height: 720 };
const DEFAULT_FRAME_COUNT = 57;
const PERFORMANCE_THRESHOLD_MS = 600000; // 600s per technical specs
const SAFETY_SCORE_THRESHOLD = 0.95;

describe('Video Generation Pipeline Integration Tests', () => {
  let generationService: GenerationService;
  let safetyValidator: SafetyValidator;
  let performanceMetrics: PerformanceMetrics;

  beforeAll(async () => {
    // Setup test environment with GPU simulation
    await setupTestEnvironment({
      gpuDevices: 2,
      gpuMemory: 80 * 1024 * 1024 * 1024, // 80GB
      enableProfiling: true
    });

    // Initialize mock model
    const mockModel = createMockModel({
      architecture: {
        type: ModelType.DIFFUSION_7B,
        parameters: 7e9,
        contextLength: 1024,
        maxBatchSize: 8,
        supportedResolutions: [
          new VideoResolutionImpl(1280, 720),
          new VideoResolutionImpl(1920, 1080)
        ]
      }
    });

    // Initialize services
    generationService = new GenerationService(
      mockModel,
      new SafetyValidator({ threshold: SAFETY_SCORE_THRESHOLD }),
      new SafetyValidator({ threshold: SAFETY_SCORE_THRESHOLD }),
      {} as any // Storage service mock
    );

    safetyValidator = new SafetyValidator({ threshold: SAFETY_SCORE_THRESHOLD });
    performanceMetrics = new PerformanceMetrics();
  }, TEST_TIMEOUT);

  afterAll(async () => {
    await teardownTestEnvironment();
  });

  test('Text-to-video generation meets performance and safety requirements', async () => {
    // Create generation request
    const request = createMockGenerationRequest({
      modelType: ModelType.DIFFUSION_7B,
      prompt: 'A car driving down a city street at night with neon signs',
      resolution: new VideoResolutionImpl(DEFAULT_RESOLUTION.width, DEFAULT_RESOLUTION.height),
      frameCount: DEFAULT_FRAME_COUNT,
      safetyConfig: {
        contentSafetyThreshold: SAFETY_SCORE_THRESHOLD,
        faceDetectionThreshold: SAFETY_SCORE_THRESHOLD,
        harmfulContentThreshold: SAFETY_SCORE_THRESHOLD
      }
    });

    // Start performance measurement
    const startTime = Date.now();

    // Generate video
    const response = await generationService.generateVideo(request);
    
    // Wait for processing completion
    await waitForProcessing();

    // Verify generation completed successfully
    expect(response.status).toBe(ProcessingStatus.COMPLETED);
    expect(response.outputPath).toBeTruthy();

    // Verify performance requirements
    const generationTime = Date.now() - startTime;
    expect(generationTime).toBeLessThanOrEqual(PERFORMANCE_THRESHOLD_MS);
    expect(response.performanceMetrics.framesPerSecond).toBeGreaterThan(0);
    expect(response.performanceMetrics.gpuMemoryUsed).toBeLessThanOrEqual(80);

    // Verify video properties
    expect(response.outputPath).toMatch(/\.mp4$/);
    
    // Verify safety compliance
    expect(response.safetyResults).toHaveLength(2); // Pre and post checks
    response.safetyResults.forEach(result => {
      expect(result.passed).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(SAFETY_SCORE_THRESHOLD);
    });
  }, TEST_TIMEOUT);

  test('Video-to-video generation maintains quality and consistency', async () => {
    // Create source video path
    const sourceVideoPath = 'test-assets/source-video.mp4';

    // Create generation request
    const request = createMockGenerationRequest({
      modelType: ModelType.DIFFUSION_7B,
      prompt: 'Convert to nighttime scene with rain',
      resolution: new VideoResolutionImpl(DEFAULT_RESOLUTION.width, DEFAULT_RESOLUTION.height),
      frameCount: DEFAULT_FRAME_COUNT,
      inputVideoPath: sourceVideoPath
    });

    // Generate video
    const response = await generationService.generateVideo(request);
    await waitForProcessing();

    // Verify generation status
    expect(response.status).toBe(ProcessingStatus.COMPLETED);

    // Verify temporal consistency
    expect(response.performanceMetrics.videoQualityMetrics.temporalConsistency).toBeGreaterThan(0.8);

    // Verify style transfer quality
    expect(response.performanceMetrics.videoQualityMetrics.styleTransferScore).toBeGreaterThan(0.7);
  }, TEST_TIMEOUT);

  test('Multi-view video generation maintains 3D consistency', async () => {
    // Create generation request with multiple views
    const request = createMockGenerationRequest({
      modelType: ModelType.DIFFUSION_7B,
      prompt: 'A robot assembling electronic components on a workbench',
      resolution: new VideoResolutionImpl(DEFAULT_RESOLUTION.width, DEFAULT_RESOLUTION.height),
      frameCount: DEFAULT_FRAME_COUNT,
      multiViewConfig: {
        enabled: true,
        viewCount: 3,
        viewAngles: [0, 120, 240],
        viewDistances: [1.0, 1.0, 1.0],
        synchronizeViews: true
      }
    });

    // Generate video
    const response = await generationService.generateVideo(request);
    await waitForProcessing();

    // Verify generation status
    expect(response.status).toBe(ProcessingStatus.COMPLETED);

    // Verify 3D consistency across views
    expect(response.performanceMetrics.videoQualityMetrics.sampsonError).toBeLessThan(2.0);
    expect(response.performanceMetrics.videoQualityMetrics.poseAccuracy).toBeGreaterThan(0.8);
  }, TEST_TIMEOUT);

  test('Safety guardrails prevent harmful content generation', async () => {
    // Create generation request with harmful prompt
    const request = createMockGenerationRequest({
      modelType: ModelType.DIFFUSION_7B,
      prompt: 'Violent or harmful content that should be blocked',
      resolution: new VideoResolutionImpl(DEFAULT_RESOLUTION.width, DEFAULT_RESOLUTION.height),
      frameCount: DEFAULT_FRAME_COUNT
    });

    // Attempt generation
    await expect(generationService.generateVideo(request))
      .rejects
      .toThrow('Pre-generation safety check failed');
  });

  test('Face blur compliance in generated content', async () => {
    // Create generation request with human faces
    const request = createMockGenerationRequest({
      modelType: ModelType.DIFFUSION_7B,
      prompt: 'People walking in a crowded street',
      resolution: new VideoResolutionImpl(DEFAULT_RESOLUTION.width, DEFAULT_RESOLUTION.height),
      frameCount: DEFAULT_FRAME_COUNT
    });

    // Generate video
    const response = await generationService.generateVideo(request);
    await waitForProcessing();

    // Verify face detection and blur application
    const safetyResults = response.safetyResults.find(r => r.checkType === 'FACE_DETECTION');
    expect(safetyResults).toBeDefined();
    expect(safetyResults?.passed).toBe(true);
    expect(safetyResults?.details.facesDetected).toBeGreaterThan(0);
    expect(safetyResults?.details.facesBlurred).toBe(safetyResults?.details.facesDetected);
  });
});