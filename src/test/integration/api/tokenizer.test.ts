import { describe, it, beforeAll, afterAll, expect, jest } from '@jest/globals';
import supertest from 'supertest';
import { Buffer } from '@types/node';

// Internal imports
import { ITokenizer } from '../../../backend/src/core/tokenizers/interfaces/ITokenizer';
import { TokenizerController } from '../../../backend/src/api/controllers/TokenizerController';
import { TokenizerType, TokenizerConfigImpl } from '../../../backend/src/types/tokenizer';
import { VideoResolutionImpl, ProcessingStatus } from '../../../backend/src/types/common';
import { setupTestEnvironment, teardownTestEnvironment, waitForProcessing, simulateGPU, trackResources } from '../../utils/testHelpers';

// Test constants based on technical specifications
const TEST_CONFIG = {
  CONTINUOUS: {
    type: TokenizerType.CONTINUOUS,
    compressionRatio: 512,
    resolution: new VideoResolutionImpl(1920, 1080),
    targetPSNR: 32.80,
    maxLatency: 100 // ms per frame at 1080p
  },
  DISCRETE: {
    type: TokenizerType.DISCRETE,
    compressionRatio: 2048,
    resolution: new VideoResolutionImpl(1280, 720),
    targetPSNR: 28.81,
    maxLatency: 64.2 // ms per frame
  }
};

describe('Tokenizer API Integration Tests', () => {
  let app: any;
  let request: supertest.SuperTest<supertest.Test>;
  let tokenizerIds: { continuous?: string; discrete?: string } = {};

  beforeAll(async () => {
    // Initialize test environment with GPU simulation
    await setupTestEnvironment({
      gpuDevices: 2,
      gpuMemory: 80 * 1024 * 1024 * 1024, // 80GB H100
      enableProfiling: true
    });

    // Initialize test app and supertest instance
    app = {}; // Replace with actual app initialization
    request = supertest(app);
  });

  afterAll(async () => {
    // Cleanup resources and validate memory release
    await teardownTestEnvironment();
  });

  describe('Tokenizer Creation', () => {
    it('should create continuous tokenizer with valid configuration', async () => {
      const response = await request
        .post('/api/v1/tokenizers')
        .send({
          type: TEST_CONFIG.CONTINUOUS.type,
          compressionRatio: TEST_CONFIG.CONTINUOUS.compressionRatio,
          resolution: TEST_CONFIG.CONTINUOUS.resolution
        })
        .expect(201);

      expect(response.body.status).toBe('success');
      expect(response.body.data.type).toBe(TEST_CONFIG.CONTINUOUS.type);
      tokenizerIds.continuous = response.body.data.id;

      // Validate resource allocation
      const metrics = await trackResources();
      expect(metrics.gpuMemoryUsed).toBeLessThan(80); // GB
    });

    it('should create discrete tokenizer with valid configuration', async () => {
      const response = await request
        .post('/api/v1/tokenizers')
        .send({
          type: TEST_CONFIG.DISCRETE.type,
          compressionRatio: TEST_CONFIG.DISCRETE.compressionRatio,
          resolution: TEST_CONFIG.DISCRETE.resolution
        })
        .expect(201);

      expect(response.body.status).toBe('success');
      expect(response.body.data.type).toBe(TEST_CONFIG.DISCRETE.type);
      tokenizerIds.discrete = response.body.data.id;
    });

    it('should reject invalid compression ratios', async () => {
      await request
        .post('/api/v1/tokenizers')
        .send({
          type: TEST_CONFIG.CONTINUOUS.type,
          compressionRatio: 123, // Invalid ratio
          resolution: TEST_CONFIG.CONTINUOUS.resolution
        })
        .expect(400);
    });

    it('should handle concurrent tokenizer creation', async () => {
      const requests = Array(5).fill(null).map(() => 
        request
          .post('/api/v1/tokenizers')
          .send({
            type: TEST_CONFIG.CONTINUOUS.type,
            compressionRatio: TEST_CONFIG.CONTINUOUS.compressionRatio,
            resolution: TEST_CONFIG.CONTINUOUS.resolution
          })
      );

      const responses = await Promise.all(requests);
      expect(responses.every(r => r.status === 201 || r.status === 429)).toBe(true);
    });
  });

  describe('Video Tokenization', () => {
    let testVideoBuffer: Buffer;

    beforeAll(async () => {
      // Prepare test video data
      testVideoBuffer = Buffer.from([]); // Replace with actual test video
    });

    it('should tokenize video with continuous tokenizer', async () => {
      const response = await request
        .post(`/api/v1/tokenizers/${tokenizerIds.continuous}/tokenize`)
        .send({ videoData: testVideoBuffer })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.metrics.psnr).toBeGreaterThanOrEqual(TEST_CONFIG.CONTINUOUS.targetPSNR);
      expect(response.body.data.metrics.latencyMs).toBeLessThanOrEqual(TEST_CONFIG.CONTINUOUS.maxLatency);
    });

    it('should tokenize video with discrete tokenizer', async () => {
      const response = await request
        .post(`/api/v1/tokenizers/${tokenizerIds.discrete}/tokenize`)
        .send({ videoData: testVideoBuffer })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.metrics.psnr).toBeGreaterThanOrEqual(TEST_CONFIG.DISCRETE.targetPSNR);
      expect(response.body.data.metrics.latencyMs).toBeLessThanOrEqual(TEST_CONFIG.DISCRETE.maxLatency);
    });

    it('should handle concurrent tokenization requests', async () => {
      const requests = Array(3).fill(null).map(() =>
        request
          .post(`/api/v1/tokenizers/${tokenizerIds.continuous}/tokenize`)
          .send({ videoData: testVideoBuffer })
      );

      const responses = await Promise.all(requests);
      expect(responses.every(r => r.status === 200 || r.status === 429)).toBe(true);
    });

    it('should maintain PSNR requirements under load', async () => {
      // Simulate GPU stress
      await simulateGPU({ utilization: 80 });

      const response = await request
        .post(`/api/v1/tokenizers/${tokenizerIds.continuous}/tokenize`)
        .send({ videoData: testVideoBuffer })
        .expect(200);

      expect(response.body.data.metrics.psnr).toBeGreaterThanOrEqual(TEST_CONFIG.CONTINUOUS.targetPSNR);
    });
  });

  describe('Detokenization', () => {
    let tokenBuffer: Buffer;

    beforeAll(async () => {
      // Get tokens from previous tokenization
      const response = await request
        .post(`/api/v1/tokenizers/${tokenizerIds.continuous}/tokenize`)
        .send({ videoData: Buffer.from([]) });
      tokenBuffer = Buffer.from(response.body.data.tokens);
    });

    it('should reconstruct video from tokens', async () => {
      const response = await request
        .post(`/api/v1/tokenizers/${tokenizerIds.continuous}/detokenize`)
        .send({ tokens: tokenBuffer })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.video).toBeDefined();
    });

    it('should validate reconstruction quality', async () => {
      const response = await request
        .post(`/api/v1/tokenizers/${tokenizerIds.continuous}/detokenize`)
        .send({ 
          tokens: tokenBuffer,
          validateQuality: true
        })
        .expect(200);

      expect(response.body.data.metrics.psnr).toBeGreaterThanOrEqual(TEST_CONFIG.CONTINUOUS.targetPSNR);
    });
  });

  describe('Performance Metrics', () => {
    it('should retrieve comprehensive tokenizer metrics', async () => {
      const response = await request
        .get(`/api/v1/tokenizers/${tokenizerIds.continuous}/metrics`)
        .expect(200);

      expect(response.body.data.metrics).toMatchObject({
        compressionRatio: expect.any(Number),
        psnr: expect.any(Number),
        throughput: expect.any(Number),
        latencyMs: expect.any(Number)
      });
    });

    it('should track resource utilization', async () => {
      const response = await request
        .get(`/api/v1/tokenizers/${tokenizerIds.continuous}/metrics`)
        .expect(200);

      expect(response.body.data.metrics.gpuMemoryUsage).toBeDefined();
      expect(response.body.data.metrics.gpuMemoryUsage).toBeLessThan(80); // GB
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid tokenizer ID', async () => {
      await request
        .post('/api/v1/tokenizers/invalid-id/tokenize')
        .send({ videoData: Buffer.from([]) })
        .expect(404);
    });

    it('should handle invalid video data', async () => {
      await request
        .post(`/api/v1/tokenizers/${tokenizerIds.continuous}/tokenize`)
        .send({ videoData: 'invalid' })
        .expect(400);
    });

    it('should recover from GPU memory exhaustion', async () => {
      // Simulate memory pressure
      await simulateGPU({ memoryUsed: 75 });

      const response = await request
        .post(`/api/v1/tokenizers/${tokenizerIds.continuous}/tokenize`)
        .send({ videoData: Buffer.from([]) });

      expect(response.status).toBe(200);
      expect(response.body.data.metrics.gpuMemoryUsage).toBeLessThan(80);
    });
  });
});