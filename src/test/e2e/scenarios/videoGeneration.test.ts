import { describe, beforeAll, afterAll, it, expect, jest } from '@jest/globals';
import {
  setupTestEnvironment,
  teardownTestEnvironment,
  waitForProcessing,
  validateVideoMetrics,
  checkSafetyCompliance
} from '../../utils/testHelpers';
import {
  GenerationService,
  VideoMetrics,
  SafetyReport
} from '../../../backend/src/services/GenerationService';
import { ModelType, ProcessingStatus, VideoResolutionImpl } from '../../../backend/src/types/common';
import { SafetyCheckType, SafetyStatus } from '../../../backend/src/types/safety';

// Global test configuration
const TEST_TIMEOUT = 600000; // 600s timeout per technical specs
const DEFAULT_VIDEO_CONFIG = {
  width: 1280,
  height: 720,
  frameCount: 57,
  fps: 30,
  quality: {
    minPSNR: 30,
    maxFID: 50,
    maxFVD: 100
  },
  safety: {
    faceBlurThreshold: 0.99,
    contentSafetyScore: 0.95
  }
};

describe('Video Generation End-to-End Tests', () => {
  let generationService: GenerationService;

  beforeAll(async () => {
    // Initialize test environment with GPU resources
    await setupTestEnvironment({
      gpuDevices: 2,
      gpuMemory: 80 * 1024 * 1024 * 1024, // 80GB for H100
      enableProfiling: true,
      timeout: TEST_TIMEOUT
    });

    // Initialize generation service with safety checks
    generationService = new GenerationService(
      /* service dependencies injected by test helpers */
    );

    // Configure test timeouts
    jest.setTimeout(TEST_TIMEOUT);
  });

  afterAll(async () => {
    // Validate collected metrics and cleanup resources
    await teardownTestEnvironment();
  });

  it('should generate video from text prompt within performance requirements', async () => {
    // Test configuration
    const prompt = 'A car driving through a city at night with dynamic lighting';
    const resolution = new VideoResolutionImpl(
      DEFAULT_VIDEO_CONFIG.width,
      DEFAULT_VIDEO_CONFIG.height
    );

    // Start performance timer
    const startTime = Date.now();

    // Generate video
    const response = await generationService.generateVideo({
      id: crypto.randomUUID(),
      modelType: ModelType.DIFFUSION_7B,
      prompt,
      resolution,
      frameCount: DEFAULT_VIDEO_CONFIG.frameCount,
      safetyConfig: {
        contentSafetyThreshold: DEFAULT_VIDEO_CONFIG.safety.contentSafetyScore,
        faceDetectionThreshold: DEFAULT_VIDEO_CONFIG.safety.faceBlurThreshold,
        harmfulContentThreshold: 0.95
      },
      multiViewConfig: {
        enabled: false,
        viewCount: 1,
        viewAngles: [0],
        viewDistances: [1.0],
        synchronizeViews: true
      },
      performanceConfig: {
        maxGenerationTime: TEST_TIMEOUT,
        targetFPS: DEFAULT_VIDEO_CONFIG.fps,
        gpuMemoryLimit: 80,
        enableProfiling: true,
        priorityLevel: 1
      }
    });

    // Calculate generation time
    const generationTime = Date.now() - startTime;

    // Validate performance requirements
    expect(generationTime).toBeLessThan(TEST_TIMEOUT);
    expect(response.status).toBe(ProcessingStatus.COMPLETED);
    expect(response.performanceMetrics.framesPerSecond).toBeGreaterThan(0.1);
    expect(response.performanceMetrics.gpuMemoryUsed).toBeLessThan(80);

    // Validate video quality metrics
    const videoMetrics = await validateVideoMetrics(response.outputPath);
    expect(videoMetrics.psnr).toBeGreaterThan(DEFAULT_VIDEO_CONFIG.quality.minPSNR);
    expect(videoMetrics.fid).toBeLessThan(DEFAULT_VIDEO_CONFIG.quality.maxFID);
    expect(videoMetrics.fvd).toBeLessThan(DEFAULT_VIDEO_CONFIG.quality.maxFVD);

    // Validate safety compliance
    const safetyReport = await checkSafetyCompliance(response.outputPath);
    expect(safetyReport.faceDetection.passed).toBe(true);
    expect(safetyReport.contentSafety.score).toBeGreaterThan(
      DEFAULT_VIDEO_CONFIG.safety.contentSafetyScore
    );
  });

  it('should generate video-to-video with consistent quality', async () => {
    const sourceVideoPath = 'test/fixtures/source_video_720p.mp4';
    const resolution = new VideoResolutionImpl(
      DEFAULT_VIDEO_CONFIG.width,
      DEFAULT_VIDEO_CONFIG.height
    );

    const response = await generationService.generateVideo({
      id: crypto.randomUUID(),
      modelType: ModelType.DIFFUSION_7B,
      prompt: 'Transform the driving scene to a rainy night setting',
      resolution,
      frameCount: DEFAULT_VIDEO_CONFIG.frameCount,
      safetyConfig: {
        contentSafetyThreshold: DEFAULT_VIDEO_CONFIG.safety.contentSafetyScore,
        faceDetectionThreshold: DEFAULT_VIDEO_CONFIG.safety.faceBlurThreshold,
        harmfulContentThreshold: 0.95
      },
      multiViewConfig: {
        enabled: false,
        viewCount: 1,
        viewAngles: [0],
        viewDistances: [1.0],
        synchronizeViews: true
      },
      performanceConfig: {
        maxGenerationTime: TEST_TIMEOUT,
        targetFPS: DEFAULT_VIDEO_CONFIG.fps,
        gpuMemoryLimit: 80,
        enableProfiling: true,
        priorityLevel: 1
      },
      inputVideoPath: sourceVideoPath
    });

    // Validate generation completed successfully
    expect(response.status).toBe(ProcessingStatus.COMPLETED);

    // Validate temporal consistency
    const metrics = await validateVideoMetrics(response.outputPath, sourceVideoPath);
    expect(metrics.temporalConsistency).toBeGreaterThan(0.8);
    expect(metrics.poseAccuracy).toBeGreaterThan(0.85);
  });

  it('should generate multi-view video with 3D consistency', async () => {
    const resolution = new VideoResolutionImpl(
      DEFAULT_VIDEO_CONFIG.width,
      DEFAULT_VIDEO_CONFIG.height
    );

    const response = await generationService.generateVideo({
      id: crypto.randomUUID(),
      modelType: ModelType.DIFFUSION_7B,
      prompt: 'A car performing a 360-degree turn in an urban environment',
      resolution,
      frameCount: DEFAULT_VIDEO_CONFIG.frameCount,
      safetyConfig: {
        contentSafetyThreshold: DEFAULT_VIDEO_CONFIG.safety.contentSafetyScore,
        faceDetectionThreshold: DEFAULT_VIDEO_CONFIG.safety.faceBlurThreshold,
        harmfulContentThreshold: 0.95
      },
      multiViewConfig: {
        enabled: true,
        viewCount: 3,
        viewAngles: [0, 120, 240],
        viewDistances: [1.0, 1.0, 1.0],
        synchronizeViews: true
      },
      performanceConfig: {
        maxGenerationTime: TEST_TIMEOUT,
        targetFPS: DEFAULT_VIDEO_CONFIG.fps,
        gpuMemoryLimit: 80,
        enableProfiling: true,
        priorityLevel: 1
      }
    });

    // Validate generation completed successfully
    expect(response.status).toBe(ProcessingStatus.COMPLETED);

    // Validate 3D consistency across views
    const metrics = await validateVideoMetrics(response.outputPath);
    expect(metrics.sampsonError).toBeLessThan(2.0);
    expect(metrics.poseAccuracy).toBeGreaterThan(0.8);

    // Validate safety compliance for all views
    const safetyReport = await checkSafetyCompliance(response.outputPath);
    expect(safetyReport.multiView.viewConsistency).toBeGreaterThan(0.9);
    expect(safetyReport.multiView.safetyScores.every(score => score > 0.95)).toBe(true);
  });
});