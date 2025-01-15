import { describe, beforeAll, afterAll, beforeEach, afterEach, it, expect } from '@jest/globals';
import supertest from 'supertest';
import { IDataset } from '../../../backend/src/interfaces/IDataset';
import { 
  setupTestEnvironment, 
  teardownTestEnvironment,
  createTestDataset,
  waitForProcessing
} from '../../utils/testHelpers';
import { ProcessingStatus } from '../../../backend/src/types/common';
import { VideoResolutionImpl } from '../../../backend/src/types/common';
import { SafetyCheckType, SafetyStatus } from '../../../backend/src/types/safety';

// Constants
const API_BASE_URL = '/api/datasets';
const TEST_TIMEOUT = 60000;
const QUALITY_METRICS_THRESHOLD = {
  psnr: 30,
  ssim: 0.95,
  fid: 50,
  fvd: 150
};
const PERFORMANCE_THRESHOLDS = {
  creation: 5000,
  processing: 30000,
  retrieval: 1000
};

describe('Dataset API Integration Tests', () => {
  let request: supertest.SuperTest<supertest.Test>;

  beforeAll(async () => {
    await setupTestEnvironment({
      gpuDevices: 2,
      gpuMemory: 80 * 1024 * 1024 * 1024, // 80GB
      enableProfiling: true
    });
    request = supertest(process.env.API_URL || 'http://localhost:3000');
  });

  afterAll(async () => {
    await teardownTestEnvironment();
  });

  beforeEach(async () => {
    // Reset test state before each test
    jest.resetAllMocks();
    jest.clearAllTimers();
  });

  it('should create a new dataset with quality metrics and safety checks', async () => {
    const testDataset = {
      name: 'test-dataset-1',
      description: 'Test dataset for integration testing',
      version: '1.0.0',
      resolution: new VideoResolutionImpl(1920, 1080),
      metrics: {
        psnr: 35.0,
        ssim: 0.98,
        fid: 25.0,
        fvd: 100.0
      },
      storageConfig: {
        provider: 'hybrid',
        locations: ['aws', 'gcp']
      },
      safetyChecks: {
        contentSafetyThreshold: 0.9,
        faceDetectionThreshold: 0.95
      }
    };

    const startTime = Date.now();
    const response = await request
      .post(API_BASE_URL)
      .send(testDataset)
      .expect(201);

    // Verify response structure
    expect(response.body).toHaveProperty('id');
    expect(response.body.name).toBe(testDataset.name);
    expect(response.body.status).toBe(ProcessingStatus.PENDING);

    // Verify quality metrics
    expect(response.body.metrics.psnr).toBeGreaterThan(QUALITY_METRICS_THRESHOLD.psnr);
    expect(response.body.metrics.ssim).toBeGreaterThan(QUALITY_METRICS_THRESHOLD.ssim);
    expect(response.body.metrics.fid).toBeLessThan(QUALITY_METRICS_THRESHOLD.fid);
    expect(response.body.metrics.fvd).toBeLessThan(QUALITY_METRICS_THRESHOLD.fvd);

    // Verify multi-cloud storage
    expect(response.body.storageConfig.provider).toBe('hybrid');
    expect(response.body.storageConfig.locations).toContain('aws');
    expect(response.body.storageConfig.locations).toContain('gcp');

    // Verify performance
    expect(Date.now() - startTime).toBeLessThan(PERFORMANCE_THRESHOLDS.creation);
  });

  it('should process dataset with quality validation', async () => {
    // Create test dataset
    const dataset = await createTestDataset({
      name: 'test-dataset-2',
      resolution: new VideoResolutionImpl(1280, 720),
      metrics: {
        psnr: 32.0,
        ssim: 0.96,
        fid: 30.0,
        fvd: 120.0
      }
    });

    const startTime = Date.now();
    const response = await request
      .post(`${API_BASE_URL}/${dataset.id}/process`)
      .expect(202);

    // Wait for processing completion
    await waitForProcessing(PERFORMANCE_THRESHOLDS.processing);

    // Verify final status
    const finalResponse = await request
      .get(`${API_BASE_URL}/${dataset.id}`)
      .expect(200);

    expect(finalResponse.body.status).toBe(ProcessingStatus.COMPLETED);
    expect(finalResponse.body.metrics).toBeDefined();
    expect(finalResponse.body.safetyChecks).toContainEqual({
      type: SafetyCheckType.CONTENT_SAFETY,
      status: SafetyStatus.PASS
    });

    // Verify processing time
    expect(Date.now() - startTime).toBeLessThan(PERFORMANCE_THRESHOLDS.processing);
  });

  it('should retrieve dataset with complete metrics', async () => {
    const dataset = await createTestDataset({
      name: 'test-dataset-3',
      resolution: new VideoResolutionImpl(1920, 1080),
      metrics: {
        psnr: 35.0,
        ssim: 0.97,
        fid: 28.0,
        fvd: 110.0
      }
    });

    const startTime = Date.now();
    const response = await request
      .get(`${API_BASE_URL}/${dataset.id}`)
      .expect(200);

    // Verify response data
    expect(response.body.id).toBe(dataset.id);
    expect(response.body.metrics).toEqual(dataset.metrics);
    expect(response.body.resolution).toEqual({
      width: 1920,
      height: 1080
    });

    // Verify retrieval performance
    expect(Date.now() - startTime).toBeLessThan(PERFORMANCE_THRESHOLDS.retrieval);
  });

  it('should update dataset with metrics and storage', async () => {
    const dataset = await createTestDataset({
      name: 'test-dataset-4'
    });

    const updatePayload = {
      metrics: {
        psnr: 36.0,
        ssim: 0.99,
        fid: 22.0,
        fvd: 95.0
      },
      storageConfig: {
        provider: 'aws',
        region: 'us-west-2'
      }
    };

    const response = await request
      .patch(`${API_BASE_URL}/${dataset.id}`)
      .send(updatePayload)
      .expect(200);

    // Verify updated fields
    expect(response.body.metrics).toEqual(updatePayload.metrics);
    expect(response.body.storageConfig).toEqual(updatePayload.storageConfig);
    expect(response.body.updatedAt).not.toBe(dataset.updatedAt);
  });

  it('should delete dataset and all resources', async () => {
    const dataset = await createTestDataset({
      name: 'test-dataset-5',
      storageConfig: {
        provider: 'hybrid',
        locations: ['aws', 'gcp', 'azure']
      }
    });

    await request
      .delete(`${API_BASE_URL}/${dataset.id}`)
      .expect(204);

    // Verify dataset is deleted
    const getResponse = await request
      .get(`${API_BASE_URL}/${dataset.id}`)
      .expect(404);

    // Verify storage cleanup
    const storageResponse = await request
      .get(`${API_BASE_URL}/${dataset.id}/storage`)
      .expect(404);
  });
});