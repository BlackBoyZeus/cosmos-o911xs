import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import supertest from 'supertest';
import { StatusCodes } from 'http-status-codes';

// Internal imports
import { IModel } from '../../../backend/src/interfaces/IModel';
import { setupTestEnvironment, teardownTestEnvironment, createTestDataset } from '../../utils/testHelpers';
import { VideoResolutionImpl, ModelType, ProcessingStatus } from '../../../backend/src/types/common';
import { SafetyCheckType, SafetyStatus } from '../../../backend/src/types/safety';

// Constants
const TEST_TIMEOUT = 120000;
const API_BASE_URL = '/api/v1/models';
const DEFAULT_TEST_PROMPT = 'a car driving down a city street at night';
const PERFORMANCE_THRESHOLDS = {
  generationTime: 600, // 600s max per technical spec
  gpuMemory: 80,      // 80GB max per GPU
  psnr: 30            // Minimum PSNR quality threshold
};
const SAFETY_CONFIG = {
  preGuard: true,
  postGuard: true,
  faceBlur: true
};

// Test suite
describe('Model API Integration Tests', () => {
  let request: supertest.SuperTest<supertest.Test>;
  let testDatasetId: string;

  // Setup test environment
  beforeAll(async () => {
    await setupTestEnvironment({
      gpuDevices: 2,
      gpuMemory: 80 * 1024 * 1024 * 1024, // 80GB per GPU
      timeout: TEST_TIMEOUT,
      enableProfiling: true
    });

    // Create test dataset
    const testDataset = await createTestDataset({
      name: 'test-video-dataset',
      resolution: new VideoResolutionImpl(1920, 1080),
      metrics: {
        psnr: 35.0,
        ssim: 0.95,
        fid: 25.0,
        fvd: 100.0
      }
    });
    testDatasetId = testDataset.id;
  });

  // Cleanup test environment
  afterAll(async () => {
    await teardownTestEnvironment();
  });

  // Test video generation with comprehensive validation
  test('should generate video with safety checks and performance monitoring', async () => {
    const response = await request
      .post(`${API_BASE_URL}/generate`)
      .send({
        modelType: ModelType.DIFFUSION_7B,
        prompt: DEFAULT_TEST_PROMPT,
        resolution: new VideoResolutionImpl(1280, 720),
        frameCount: 57,
        safetyConfig: SAFETY_CONFIG,
        performanceConfig: {
          maxGenerationTime: PERFORMANCE_THRESHOLDS.generationTime * 1000,
          gpuMemoryLimit: PERFORMANCE_THRESHOLDS.gpuMemory,
          enableProfiling: true
        }
      });

    // Validate response
    expect(response.status).toBe(StatusCodes.OK);
    expect(response.type).toBe('application/json');

    // Validate generation results
    const result = response.body;
    expect(result.status).toBe(ProcessingStatus.COMPLETED);
    expect(result.outputPath).toBeTruthy();
    expect(result.generationTime).toBeLessThan(PERFORMANCE_THRESHOLDS.generationTime * 1000);

    // Validate performance metrics
    expect(result.performanceMetrics).toBeDefined();
    expect(result.performanceMetrics.gpuMemoryUsed).toBeLessThan(PERFORMANCE_THRESHOLDS.gpuMemory);
    expect(result.performanceMetrics.videoQualityMetrics.psnr).toBeGreaterThan(PERFORMANCE_THRESHOLDS.psnr);

    // Validate safety compliance
    expect(result.safetyResults).toHaveLength(2); // Pre and Post guard
    expect(result.safetyResults[0].checkType).toBe(SafetyCheckType.CONTENT_SAFETY);
    expect(result.safetyResults[0].status).toBe(SafetyStatus.PASS);
  });

  // Test model training with performance monitoring
  test('should train model with performance tracking', async () => {
    const response = await request
      .post(`${API_BASE_URL}/train`)
      .send({
        modelType: ModelType.DIFFUSION_7B,
        datasetId: testDatasetId,
        trainingConfig: {
          batchSize: 8,
          learningRate: 1e-4,
          maxEpochs: 10,
          validationSplit: 0.2,
          checkpointFrequency: 2,
          mixedPrecision: true
        },
        performanceConfig: {
          gpuMemoryLimit: PERFORMANCE_THRESHOLDS.gpuMemory,
          enableProfiling: true
        }
      });

    // Validate response
    expect(response.status).toBe(StatusCodes.OK);
    expect(response.type).toBe('application/json');

    // Validate training initialization
    const result = response.body;
    expect(result.status).toBe(ProcessingStatus.COMPLETED);
    expect(result.checkpoints).toHaveLength(5); // Based on epochs/frequency

    // Validate training metrics
    expect(result.metrics).toBeDefined();
    expect(result.metrics.finalLoss).toBeLessThan(result.metrics.initialLoss);
    expect(result.metrics.gpuUtilization).toBeGreaterThan(50);
  });

  // Test performance metrics collection
  test('should retrieve comprehensive performance metrics', async () => {
    const response = await request
      .get(`${API_BASE_URL}/metrics`)
      .query({
        modelType: ModelType.DIFFUSION_7B,
        timeRange: '24h'
      });

    // Validate response
    expect(response.status).toBe(StatusCodes.OK);
    expect(response.type).toBe('application/json');

    // Validate metrics structure
    const metrics = response.body;
    expect(metrics.generationMetrics).toBeDefined();
    expect(metrics.trainingMetrics).toBeDefined();
    expect(metrics.resourceMetrics).toBeDefined();

    // Validate required metrics
    expect(metrics.generationMetrics.averageGenerationTime).toBeDefined();
    expect(metrics.generationMetrics.averageQualityScores).toEqual(
      expect.objectContaining({
        psnr: expect.any(Number),
        fid: expect.any(Number),
        fvd: expect.any(Number)
      })
    );

    // Validate resource metrics
    expect(metrics.resourceMetrics.gpuUtilization).toBeGreaterThanOrEqual(0);
    expect(metrics.resourceMetrics.gpuUtilization).toBeLessThanOrEqual(100);
    expect(metrics.resourceMetrics.gpuMemoryUsage).toBeLessThan(PERFORMANCE_THRESHOLDS.gpuMemory);
  });
});