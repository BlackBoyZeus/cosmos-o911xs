// jest version: ^29.0.0
// psnr version: ^1.0.0

import { describe, it, expect, beforeEach, afterEach, jest } from 'jest';
import { psnr } from 'psnr';

import { TokenizerService } from '../../../backend/src/services/TokenizerService';
import { TokenizerConfig } from '../../../backend/src/core/tokenizers/TokenizerConfig';
import { createMockVideo } from '../../utils/mockData';
import { TokenizerType } from '../../../backend/src/types/tokenizer';
import { VideoResolutionImpl } from '../../../backend/src/types/common';

describe('TokenizerService', () => {
  let tokenizerService: TokenizerService;
  let mockVideo: Buffer;
  let mockConfig: TokenizerConfig;

  beforeEach(async () => {
    // Initialize TokenizerService with test configuration
    tokenizerService = new TokenizerService({
      resourceLimits: {
        maxGpuMemoryGB: 80,
        maxTokenizers: 10,
        timeoutMs: 30000
      },
      cleanupIntervalMs: 60000,
      metricsPrefix: 'test_tokenizer'
    });

    // Create mock video data
    const videoData = createMockVideo({
      resolution: new VideoResolutionImpl(1920, 1080),
      duration: 10,
      fps: 30
    });
    mockVideo = Buffer.from(videoData.path);

    // Setup test tokenizer configuration
    mockConfig = new TokenizerConfig(
      TokenizerType.CONTINUOUS,
      512, // 512:1 compression ratio
      new VideoResolutionImpl(1920, 1080)
    );
  });

  afterEach(async () => {
    // Cleanup resources
    await tokenizerService.cleanup();
    jest.clearAllMocks();
  });

  describe('Tokenizer Creation', () => {
    it('should create continuous tokenizer with valid compression ratio', async () => {
      const tokenizer = await tokenizerService.createTokenizer(mockConfig);
      expect(tokenizer).toBeDefined();
      
      const config = await tokenizer.getConfig();
      expect(config.type).toBe(TokenizerType.CONTINUOUS);
      expect(config.compressionRatio).toBe(512);
    });

    it('should create discrete tokenizer with valid block size', async () => {
      const discreteConfig = new TokenizerConfig(
        TokenizerType.DISCRETE,
        256, // 256:1 compression ratio
        new VideoResolutionImpl(1280, 720)
      );
      
      const tokenizer = await tokenizerService.createTokenizer(discreteConfig);
      expect(tokenizer).toBeDefined();
      
      const config = await tokenizer.getConfig();
      expect(config.type).toBe(TokenizerType.DISCRETE);
      expect(config.compressionRatio).toBe(256);
    });

    it('should throw error for invalid compression ratio', async () => {
      const invalidConfig = new TokenizerConfig(
        TokenizerType.CONTINUOUS,
        100, // Invalid ratio
        new VideoResolutionImpl(1920, 1080)
      );
      
      await expect(tokenizerService.createTokenizer(invalidConfig))
        .rejects.toThrow('Invalid tokenizer configuration');
    });

    it('should throw error when max tokenizers limit reached', async () => {
      // Create max number of tokenizers
      for (let i = 0; i < 10; i++) {
        await tokenizerService.createTokenizer(mockConfig);
      }
      
      await expect(tokenizerService.createTokenizer(mockConfig))
        .rejects.toThrow('Maximum number of tokenizers reached');
    });
  });

  describe('Video Tokenization', () => {
    let tokenizerId: string;

    beforeEach(async () => {
      const tokenizer = await tokenizerService.createTokenizer(mockConfig);
      tokenizerId = tokenizer.id;
    });

    it('should tokenize 720p video within latency requirements', async () => {
      const video720p = createMockVideo({
        resolution: new VideoResolutionImpl(1280, 720)
      });
      
      const startTime = Date.now();
      const result = await tokenizerService.tokenize(tokenizerId, Buffer.from(video720p.path));
      const duration = Date.now() - startTime;
      
      expect(result.status).toBe('COMPLETED');
      expect(duration).toBeLessThan(100); // 100ms per frame requirement
      expect(result.metrics.latencyMs).toBeLessThan(100);
    });

    it('should maintain target PSNR for continuous tokenization', async () => {
      const result = await tokenizerService.tokenize(tokenizerId, mockVideo);
      const reconstructed = await tokenizerService.detokenize(tokenizerId, result.tokens);
      
      const psnrValue = psnr(mockVideo, reconstructed);
      expect(psnrValue).toBeGreaterThan(32.80); // Target PSNR from specs
      expect(result.metrics.psnr).toBeGreaterThan(32.80);
    });

    it('should handle batch processing efficiently', async () => {
      const batchSize = 32;
      const results = await Promise.all(
        Array(batchSize).fill(null).map(() => 
          tokenizerService.tokenize(tokenizerId, mockVideo)
        )
      );
      
      results.forEach(result => {
        expect(result.status).toBe('COMPLETED');
        expect(result.metrics.throughput).toBeGreaterThan(0);
      });
    });

    it('should throw error for invalid tokenizer ID', async () => {
      await expect(tokenizerService.tokenize('invalid-id', mockVideo))
        .rejects.toThrow('Tokenizer not found');
    });
  });

  describe('Performance Metrics', () => {
    let tokenizerId: string;

    beforeEach(async () => {
      const tokenizer = await tokenizerService.createTokenizer(mockConfig);
      tokenizerId = tokenizer.id;
    });

    it('should track frame-level processing times', async () => {
      const result = await tokenizerService.tokenize(tokenizerId, mockVideo);
      const metrics = await tokenizerService.getMetrics(tokenizerId);
      
      expect(metrics.latencyMs).toBeDefined();
      expect(metrics.latencyMs).toBeLessThan(100);
      expect(metrics.throughput).toBeGreaterThan(0);
    });

    it('should measure compression ratio accuracy', async () => {
      const result = await tokenizerService.tokenize(tokenizerId, mockVideo);
      const metrics = await tokenizerService.getMetrics(tokenizerId);
      
      const expectedRatio = mockConfig.compressionRatio;
      const actualRatio = metrics.compressionRatio;
      
      expect(Math.abs(actualRatio - expectedRatio) / expectedRatio).toBeLessThan(0.1);
    });

    it('should monitor GPU memory usage', async () => {
      const result = await tokenizerService.tokenize(tokenizerId, mockVideo);
      const metrics = await tokenizerService.getMetrics(tokenizerId);
      
      expect(metrics.getEfficiency()).toBeDefined();
      expect(metrics.getEfficiency()).toBeLessThanOrEqual(100);
      expect(metrics.getEfficiency()).toBeGreaterThan(0);
    });

    it('should detect performance degradation', async () => {
      // Perform multiple tokenizations
      const iterations = 5;
      const results = [];
      
      for (let i = 0; i < iterations; i++) {
        const result = await tokenizerService.tokenize(tokenizerId, mockVideo);
        results.push(result.metrics.latencyMs);
      }
      
      // Check for performance stability
      const maxDeviation = Math.max(...results) - Math.min(...results);
      expect(maxDeviation).toBeLessThan(50); // Max 50ms deviation
    });
  });

  describe('Resource Management', () => {
    it('should release resources after cleanup', async () => {
      const tokenizer = await tokenizerService.createTokenizer(mockConfig);
      await tokenizerService.tokenize(tokenizer.id, mockVideo);
      
      await tokenizerService.cleanup();
      
      await expect(tokenizerService.getMetrics(tokenizer.id))
        .rejects.toThrow('Tokenizer not found');
    });

    it('should handle concurrent resource allocation', async () => {
      const concurrentTokenizers = 5;
      const tokenizers = await Promise.all(
        Array(concurrentTokenizers).fill(null).map(() =>
          tokenizerService.createTokenizer(mockConfig)
        )
      );
      
      const results = await Promise.all(
        tokenizers.map(tokenizer =>
          tokenizerService.tokenize(tokenizer.id, mockVideo)
        )
      );
      
      results.forEach(result => {
        expect(result.status).toBe('COMPLETED');
      });
    });
  });
});