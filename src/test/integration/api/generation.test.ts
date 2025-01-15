import { describe, beforeAll, afterAll, it, expect } from '@jest/globals';
import supertest from 'supertest';
import winston from 'winston';
import { GenerationController } from '../../../backend/src/api/controllers/GenerationController';
import { IGenerationRequest, IGenerationResponse } from '../../../backend/src/interfaces/IGeneration';
import { setupTestEnvironment, teardownTestEnvironment, waitForProcessing, mockGPUOperations } from '../../utils/testHelpers';
import { VideoResolutionImpl } from '../../../backend/src/types/common';
import { SafetyCheckType, SafetyStatus } from '../../../backend/src/types/safety';

// Initialize test logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()]
});

// Test app and request handler
let request: supertest.SuperTest<supertest.Test>;
let app: any;

describe('Video Generation API Integration Tests', () => {
  beforeAll(async () => {
    // Set up test environment
    await setupTestEnvironment({
      gpuDevices: 2,
      gpuMemory: 80 * 1024 * 1024 * 1024, // 80GB for H100
      enableProfiling: true
    });

    // Initialize app and supertest
    app = await initializeTestApp();
    request = supertest(app);
  });

  afterAll(async () => {
    await teardownTestEnvironment();
    logger.close();
  });

  describe('Text-to-Video Generation', () => {
    it('should generate video from text prompt with performance validation', async () => {
      const generationRequest: IGenerationRequest = {
        id: crypto.randomUUID(),
        modelType: 'DIFFUSION_7B',
        prompt: 'A car driving through a city at night',
        resolution: new VideoResolutionImpl(1280, 720),
        frameCount: 57,
        safetyConfig: {
          enableFaceBlur: true,
          contentFiltering: true,
          safetyThreshold: 0.95
        },
        multiViewConfig: {
          enabled: false,
          viewCount: 1,
          viewAngles: [0],
          viewDistances: [1.0],
          synchronizeViews: false
        },
        performanceConfig: {
          maxGenerationTime: 600000,
          targetFPS: 30,
          gpuMemoryLimit: 80,
          enableProfiling: true,
          priorityLevel: 5
        }
      };

      const response = await request
        .post('/api/v1/generate')
        .send(generationRequest)
        .expect(202);

      expect(response.body.requestId).toBeDefined();
      
      // Wait for generation to complete
      const generationId = response.body.requestId;
      await waitForProcessing(600000); // 600s SLO

      // Verify generation result
      const statusResponse = await request
        .get(`/api/v1/generate/${generationId}/status`)
        .expect(200);

      const result = statusResponse.body as IGenerationResponse;
      
      // Validate performance metrics
      expect(result.generationTime).toBeLessThan(600000); // 600s SLO
      expect(result.performanceMetrics.framesPerSecond).toBeGreaterThan(1.0);
      expect(result.performanceMetrics.gpuMemoryUsed).toBeLessThan(80);

      // Validate safety compliance
      expect(result.safetyResults).toContainEqual(
        expect.objectContaining({
          checkType: SafetyCheckType.FACE_DETECTION,
          passed: true,
          score: expect.any(Number)
        })
      );
    });
  });

  describe('Video-to-Video Generation', () => {
    it('should generate video from source video with quality validation', async () => {
      // Upload source video
      const sourceVideoResponse = await request
        .post('/api/v1/upload')
        .attach('video', 'src/test/fixtures/videos/sample_720p.mp4')
        .expect(200);

      const generationRequest: IGenerationRequest = {
        id: crypto.randomUUID(),
        modelType: 'DIFFUSION_7B',
        prompt: 'Extend the video with similar style',
        resolution: new VideoResolutionImpl(1280, 720),
        frameCount: 57,
        inputVideoPath: sourceVideoResponse.body.path,
        safetyConfig: {
          enableFaceBlur: true,
          contentFiltering: true,
          safetyThreshold: 0.95
        },
        multiViewConfig: {
          enabled: false,
          viewCount: 1,
          viewAngles: [0],
          viewDistances: [1.0],
          synchronizeViews: false
        },
        performanceConfig: {
          maxGenerationTime: 600000,
          targetFPS: 30,
          gpuMemoryLimit: 80,
          enableProfiling: true,
          priorityLevel: 5
        }
      };

      const response = await request
        .post('/api/v1/generate')
        .send(generationRequest)
        .expect(202);

      const generationId = response.body.requestId;
      await waitForProcessing(600000);

      const result = await request
        .get(`/api/v1/generate/${generationId}/status`)
        .expect(200);

      // Validate video quality metrics
      expect(result.body.performanceMetrics.videoQualityMetrics).toEqual(
        expect.objectContaining({
          psnr: expect.any(Number),
          ssim: expect.any(Number),
          fid: expect.any(Number),
          fvd: expect.any(Number)
        })
      );

      expect(result.body.performanceMetrics.videoQualityMetrics.psnr).toBeGreaterThan(27.5);
    });
  });

  describe('Multi-View Generation', () => {
    it('should generate synchronized multi-view videos', async () => {
      const generationRequest: IGenerationRequest = {
        id: crypto.randomUUID(),
        modelType: 'DIFFUSION_7B',
        prompt: 'A rotating object on a pedestal',
        resolution: new VideoResolutionImpl(1280, 720),
        frameCount: 57,
        safetyConfig: {
          enableFaceBlur: true,
          contentFiltering: true,
          safetyThreshold: 0.95
        },
        multiViewConfig: {
          enabled: true,
          viewCount: 3,
          viewAngles: [0, 120, 240],
          viewDistances: [1.0, 1.0, 1.0],
          synchronizeViews: true
        },
        performanceConfig: {
          maxGenerationTime: 600000,
          targetFPS: 30,
          gpuMemoryLimit: 80,
          enableProfiling: true,
          priorityLevel: 5
        }
      };

      const response = await request
        .post('/api/v1/generate')
        .send(generationRequest)
        .expect(202);

      const generationId = response.body.requestId;
      await waitForProcessing(600000);

      const result = await request
        .get(`/api/v1/generate/${generationId}/status`)
        .expect(200);

      // Validate multi-view output
      expect(result.body.outputPaths).toHaveLength(3);
      expect(result.body.performanceMetrics.viewSynchronization).toBeDefined();
    });
  });

  describe('Safety Checks', () => {
    it('should enforce safety guardrails and content filtering', async () => {
      // Load unsafe content test data
      const unsafePrompts = require('../../fixtures/safety/unsafe_content.json').unsafePrompts;

      for (const unsafePrompt of unsafePrompts) {
        const generationRequest: IGenerationRequest = {
          id: crypto.randomUUID(),
          modelType: 'DIFFUSION_7B',
          prompt: unsafePrompt,
          resolution: new VideoResolutionImpl(1280, 720),
          frameCount: 57,
          safetyConfig: {
            enableFaceBlur: true,
            contentFiltering: true,
            safetyThreshold: 0.95
          },
          multiViewConfig: {
            enabled: false,
            viewCount: 1,
            viewAngles: [0],
            viewDistances: [1.0],
            synchronizeViews: false
          },
          performanceConfig: {
            maxGenerationTime: 600000,
            targetFPS: 30,
            gpuMemoryLimit: 80,
            enableProfiling: true,
            priorityLevel: 5
          }
        };

        const response = await request
          .post('/api/v1/generate')
          .send(generationRequest)
          .expect(400);

        expect(response.body.error).toEqual(
          expect.objectContaining({
            code: 'SAFETY_CHECK_FAILED',
            details: expect.objectContaining({
              checkType: SafetyCheckType.CONTENT_SAFETY
            })
          })
        );
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid requests appropriately', async () => {
      const invalidRequests = [
        // Missing required fields
        { prompt: 'Test prompt' },
        // Invalid resolution
        {
          ...createValidRequest(),
          resolution: { width: 8000, height: 8000 }
        },
        // Invalid frame count
        {
          ...createValidRequest(),
          frameCount: 1001
        },
        // Invalid model type
        {
          ...createValidRequest(),
          modelType: 'INVALID_MODEL'
        }
      ];

      for (const invalidRequest of invalidRequests) {
        const response = await request
          .post('/api/v1/generate')
          .send(invalidRequest)
          .expect(400);

        expect(response.body.error).toBeDefined();
        expect(response.body.error.code).toBe('ValidationError');
      }
    });
  });
});

// Helper function to create valid request
function createValidRequest(): Partial<IGenerationRequest> {
  return {
    id: crypto.randomUUID(),
    modelType: 'DIFFUSION_7B',
    prompt: 'Test prompt',
    resolution: new VideoResolutionImpl(1280, 720),
    frameCount: 57,
    safetyConfig: {
      enableFaceBlur: true,
      contentFiltering: true,
      safetyThreshold: 0.95
    },
    multiViewConfig: {
      enabled: false,
      viewCount: 1,
      viewAngles: [0],
      viewDistances: [1.0],
      synchronizeViews: false
    },
    performanceConfig: {
      maxGenerationTime: 600000,
      targetFPS: 30,
      gpuMemoryLimit: 80,
      enableProfiling: true,
      priorityLevel: 5
    }
  };
}

// Helper function to initialize test app
async function initializeTestApp() {
  // Implementation would initialize Express app with test configuration
  return {}; 
}