import { jest } from '@jest/globals';
import { Mutex } from 'async-mutex';
import { psnr } from 'psnr';
import { DiscreteTokenizer } from '../../../backend/src/core/tokenizers/DiscreteTokenizer';
import { TokenizerConfig } from '../../../backend/src/core/tokenizers/TokenizerConfig';
import { setupTestEnvironment, teardownTestEnvironment } from '../../utils/testHelpers';
import { MockGPUManager } from '../../utils/gpuMock';
import { TokenizerType } from '../../../backend/src/types/tokenizer';
import { ProcessingStatus, VideoResolutionImpl } from '../../../backend/src/types/common';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('DiscreteTokenizer Unit Tests', () => {
  let tokenizer: DiscreteTokenizer;
  let mockGPU: MockGPUManager;
  let mutex: Mutex;
  let testVideo: Buffer;

  // Test configuration constants
  const TEST_VIDEO_PATH = '../../fixtures/videos/sample_720p.mp4';
  const TEST_COMPRESSION_RATIOS = [256, 512, 1024, 2048];
  const TEST_RESOLUTIONS = [
    { width: 1280, height: 720 },
    { width: 1920, height: 1080 }
  ];
  const PSNR_THRESHOLDS = {
    DV8x8x8: 32.80,
    DV8x16x16: 28.81,
    DV4x8x8: 35.45
  };
  const GPU_MEMORY_LIMITS = [4096, 8192, 16384];
  const PERFORMANCE_THRESHOLDS = {
    tokenization: 100,
    detokenization: 150
  };

  beforeAll(async () => {
    // Initialize test environment
    await setupTestEnvironment();
    mockGPU = new MockGPUManager();
    await mockGPU.setupGPU();
    mutex = new Mutex();

    // Load test video fixture
    testVideo = readFileSync(join(__dirname, TEST_VIDEO_PATH));
  });

  afterAll(async () => {
    await mutex.release();
    await mockGPU.cleanupGPU();
    await teardownTestEnvironment();
  });

  beforeEach(async () => {
    await mutex.acquire();
  });

  afterEach(async () => {
    mutex.release();
  });

  describe('Initialization Tests', () => {
    test('should initialize with valid configuration', () => {
      const config = new TokenizerConfig(
        TokenizerType.DISCRETE,
        512,
        new VideoResolutionImpl(1280, 720)
      );

      expect(() => new DiscreteTokenizer(config)).not.toThrow();
      const instance = new DiscreteTokenizer(config);
      expect(instance).toBeInstanceOf(DiscreteTokenizer);
    });

    test('should throw error with invalid tokenizer type', () => {
      const config = new TokenizerConfig(
        TokenizerType.CONTINUOUS,
        512,
        new VideoResolutionImpl(1280, 720)
      );

      expect(() => new DiscreteTokenizer(config)).toThrow('Invalid tokenizer type');
    });

    test('should validate compression ratios', () => {
      TEST_COMPRESSION_RATIOS.forEach(ratio => {
        const config = new TokenizerConfig(
          TokenizerType.DISCRETE,
          ratio,
          new VideoResolutionImpl(1280, 720)
        );
        expect(() => new DiscreteTokenizer(config)).not.toThrow();
      });
    });
  });

  describe('Tokenization Tests', () => {
    let baseConfig: TokenizerConfig;

    beforeEach(() => {
      baseConfig = new TokenizerConfig(
        TokenizerType.DISCRETE,
        512,
        new VideoResolutionImpl(1280, 720)
      );
      tokenizer = new DiscreteTokenizer(baseConfig);
    });

    test('should tokenize video successfully', async () => {
      const result = await tokenizer.tokenize(testVideo);
      expect(result.status).toBe(ProcessingStatus.COMPLETED);
      expect(result.tokens).toBeInstanceOf(Buffer);
      expect(result.metrics.compressionRatio).toBe(512);
    });

    test('should maintain PSNR above threshold', async () => {
      const result = await tokenizer.tokenize(testVideo);
      expect(result.metrics.psnr).toBeGreaterThanOrEqual(PSNR_THRESHOLDS.DV8x8x8);
    });

    test('should handle different resolutions', async () => {
      await Promise.all(TEST_RESOLUTIONS.map(async resolution => {
        const config = new TokenizerConfig(
          TokenizerType.DISCRETE,
          512,
          new VideoResolutionImpl(resolution.width, resolution.height)
        );
        const localTokenizer = new DiscreteTokenizer(config);
        const result = await localTokenizer.tokenize(testVideo);
        expect(result.status).toBe(ProcessingStatus.COMPLETED);
      }));
    });

    test('should respect performance thresholds', async () => {
      const startTime = Date.now();
      const result = await tokenizer.tokenize(testVideo);
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.tokenization);
    });
  });

  describe('Detokenization Tests', () => {
    let tokenizedData: Buffer;

    beforeEach(async () => {
      const config = new TokenizerConfig(
        TokenizerType.DISCRETE,
        512,
        new VideoResolutionImpl(1280, 720)
      );
      tokenizer = new DiscreteTokenizer(config);
      const result = await tokenizer.tokenize(testVideo);
      tokenizedData = result.tokens;
    });

    test('should detokenize to original dimensions', async () => {
      const reconstructed = await tokenizer.detokenize(tokenizedData);
      expect(reconstructed.length).toBeGreaterThan(0);
      const psnrValue = psnr(testVideo, reconstructed);
      expect(psnrValue).toBeGreaterThanOrEqual(PSNR_THRESHOLDS.DV8x8x8);
    });

    test('should validate quality during detokenization', async () => {
      const result = await tokenizer.detokenize(tokenizedData, { validateQuality: true });
      expect(result).toBeInstanceOf(Buffer);
    });

    test('should handle detokenization errors gracefully', async () => {
      const invalidTokens = Buffer.from([0, 1, 2, 3]);
      await expect(tokenizer.detokenize(invalidTokens)).rejects.toThrow();
    });
  });

  describe('GPU Resource Management Tests', () => {
    test('should handle GPU memory limits', async () => {
      await Promise.all(GPU_MEMORY_LIMITS.map(async limit => {
        const config = new TokenizerConfig(
          TokenizerType.DISCRETE,
          512,
          new VideoResolutionImpl(1280, 720),
          { gpuMemoryLimit: limit }
        );
        const localTokenizer = new DiscreteTokenizer(config);
        const result = await localTokenizer.tokenize(testVideo);
        expect(result.status).toBe(ProcessingStatus.COMPLETED);
      }));
    });

    test('should release GPU resources after processing', async () => {
      const config = new TokenizerConfig(
        TokenizerType.DISCRETE,
        512,
        new VideoResolutionImpl(1280, 720)
      );
      const localTokenizer = new DiscreteTokenizer(config);
      await localTokenizer.tokenize(testVideo);
      const metrics = await mockGPU.getMetrics(0);
      expect(metrics.memoryUsed).toBe(0);
    });
  });

  describe('Thread Safety Tests', () => {
    test('should handle concurrent tokenization requests', async () => {
      const config = new TokenizerConfig(
        TokenizerType.DISCRETE,
        512,
        new VideoResolutionImpl(1280, 720)
      );
      const localTokenizer = new DiscreteTokenizer(config);
      const requests = Array(5).fill(null).map(() => localTokenizer.tokenize(testVideo));
      const results = await Promise.all(requests);
      results.forEach(result => {
        expect(result.status).toBe(ProcessingStatus.COMPLETED);
      });
    });
  });

  describe('Metrics and Configuration Tests', () => {
    test('should track performance metrics', async () => {
      const config = new TokenizerConfig(
        TokenizerType.DISCRETE,
        512,
        new VideoResolutionImpl(1280, 720)
      );
      const localTokenizer = new DiscreteTokenizer(config);
      await localTokenizer.tokenize(testVideo);
      const metrics = await localTokenizer.getMetrics();
      expect(metrics.compressionRatio).toBe(512);
      expect(metrics.psnr).toBeGreaterThan(0);
      expect(metrics.throughput).toBeGreaterThan(0);
      expect(metrics.latencyMs).toBeGreaterThan(0);
    });

    test('should validate configuration changes', async () => {
      const config = new TokenizerConfig(
        TokenizerType.DISCRETE,
        512,
        new VideoResolutionImpl(1280, 720)
      );
      const localTokenizer = new DiscreteTokenizer(config);
      const validation = await localTokenizer.validateConfig(config);
      expect(validation.isValid).toBe(true);
    });
  });
});