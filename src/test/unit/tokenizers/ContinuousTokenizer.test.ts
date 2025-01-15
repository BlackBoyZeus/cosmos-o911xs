// jest version: ^29.0.0
// @types/node version: ^18.0.0

import { describe, expect, beforeAll, afterAll, test } from '@jest/globals';
import { Buffer } from '@types/node';
import { ContinuousTokenizer } from '../../../backend/src/core/tokenizers/ContinuousTokenizer';
import { TokenizerConfig } from '../../../backend/src/core/tokenizers/TokenizerConfig';
import { TokenizerType } from '../../../backend/src/types/tokenizer';
import { VideoResolutionImpl } from '../../../backend/src/types/common';
import { TestUtils } from '../../utils/testHelpers';

// Test constants from globals
const TEST_VIDEO_PATH = '../../fixtures/videos/sample_720p.mp4';
const TEST_COMPRESSION_RATIO = 512;
const TARGET_PSNR = 32.80;
const TARGET_THROUGHPUT_MS = 34.8;
const MAX_GPU_MEMORY_MB = 8192;

describe('ContinuousTokenizer Tests', () => {
  let tokenizer: ContinuousTokenizer;
  let testVideo: Buffer;

  beforeAll(async () => {
    // Initialize test environment with GPU simulation
    await TestUtils.setupTestEnvironment({
      gpuDevices: 2,
      gpuMemory: MAX_GPU_MEMORY_MB * 1024 * 1024, // Convert to bytes
      enableProfiling: true
    });

    // Load test video fixture
    testVideo = await loadTestVideo(TEST_VIDEO_PATH);
  });

  afterAll(async () => {
    // Cleanup and validate resource usage
    await TestUtils.validateMemoryUsage();
    await TestUtils.teardownTestEnvironment();
  });

  test('should initialize tokenizer with valid configuration', async () => {
    // Create tokenizer config
    const config = new TokenizerConfig(
      TokenizerType.CONTINUOUS,
      TEST_COMPRESSION_RATIO,
      new VideoResolutionImpl(1280, 720)
    );

    // Initialize tokenizer
    tokenizer = new ContinuousTokenizer(config);
    expect(tokenizer).toBeDefined();

    // Validate initial metrics
    const metrics = await tokenizer.getMetrics();
    expect(metrics).toBeDefined();
    expect(metrics.compressionRatio).toBe(TEST_COMPRESSION_RATIO);
    expect(metrics.validate()).toBe(true);
  });

  test('should reject invalid tokenizer configuration', async () => {
    // Test invalid compression ratio
    await expect(async () => {
      const invalidConfig = new TokenizerConfig(
        TokenizerType.CONTINUOUS,
        123, // Invalid compression ratio
        new VideoResolutionImpl(1280, 720)
      );
      new ContinuousTokenizer(invalidConfig);
    }).rejects.toThrow();

    // Test invalid resolution
    await expect(async () => {
      const invalidConfig = new TokenizerConfig(
        TokenizerType.CONTINUOUS,
        TEST_COMPRESSION_RATIO,
        new VideoResolutionImpl(0, 0) // Invalid resolution
      );
      new ContinuousTokenizer(invalidConfig);
    }).rejects.toThrow();
  });

  test('should tokenize video with target performance metrics', async () => {
    // Track performance metrics
    const startTime = Date.now();

    // Perform tokenization
    const result = await tokenizer.tokenize(testVideo, {
      trackMetrics: true,
      batchSize: 32
    });

    // Validate result
    expect(result.status).toBe('COMPLETED');
    expect(result.tokens).toBeDefined();
    expect(result.tokens.length).toBeGreaterThan(0);

    // Validate compression ratio
    const compressionRatio = testVideo.length / result.tokens.length;
    expect(compressionRatio).toBeCloseTo(TEST_COMPRESSION_RATIO, -1);

    // Validate performance metrics
    const metrics = result.metrics;
    expect(metrics.psnr).toBeGreaterThanOrEqual(TARGET_PSNR);
    expect(metrics.latencyMs / (testVideo.length / (1280 * 720 * 3))).toBeLessThanOrEqual(TARGET_THROUGHPUT_MS);
  });

  test('should detokenize with high reconstruction quality', async () => {
    // First tokenize
    const tokenizeResult = await tokenizer.tokenize(testVideo);
    expect(tokenizeResult.status).toBe('COMPLETED');

    // Then detokenize
    const reconstructed = await tokenizer.detokenize(tokenizeResult.tokens);
    expect(reconstructed).toBeDefined();
    expect(reconstructed.length).toBe(testVideo.length);

    // Validate reconstruction quality
    const metrics = await tokenizer.getMetrics();
    expect(metrics.psnr).toBeGreaterThanOrEqual(TARGET_PSNR);
  });

  test('should handle GPU memory efficiently', async () => {
    // Get initial GPU memory state
    const initialMemory = await tokenizer.getGPUMemoryUsage();

    // Perform tokenization
    await tokenizer.tokenize(testVideo);

    // Get final GPU memory state
    const finalMemory = await tokenizer.getGPUMemoryUsage();

    // Validate memory cleanup
    expect(finalMemory.used).toBeLessThanOrEqual(initialMemory.used + 100); // Allow small overhead
    expect(finalMemory.used).toBeLessThan(MAX_GPU_MEMORY_MB * 0.9); // Should use less than 90% of GPU memory
  });

  test('should handle errors gracefully', async () => {
    // Test with invalid video data
    const invalidVideo = Buffer.from('invalid data');
    await expect(tokenizer.tokenize(invalidVideo)).rejects.toThrow();

    // Test with empty buffer
    const emptyBuffer = Buffer.alloc(0);
    await expect(tokenizer.tokenize(emptyBuffer)).rejects.toThrow();

    // Test with oversized video
    const hugeVideo = Buffer.alloc(MAX_GPU_MEMORY_MB * 1024 * 1024 * 2); // 2x max memory
    await expect(tokenizer.tokenize(hugeVideo)).rejects.toThrow();
  });

  test('should maintain performance under load', async () => {
    // Perform multiple tokenizations in parallel
    const iterations = 5;
    const promises = Array(iterations).fill(null).map(() => 
      tokenizer.tokenize(testVideo)
    );

    // Wait for all tokenizations to complete
    const results = await Promise.all(promises);

    // Validate all results
    results.forEach(result => {
      expect(result.status).toBe('COMPLETED');
      expect(result.metrics.psnr).toBeGreaterThanOrEqual(TARGET_PSNR);
    });

    // Validate GPU memory cleanup
    const finalMemory = await tokenizer.getGPUMemoryUsage();
    expect(finalMemory.used).toBeLessThan(MAX_GPU_MEMORY_MB * 0.9);
  });
});

// Helper function to load test video
async function loadTestVideo(path: string): Promise<Buffer> {
  try {
    // Implementation would load video file from test fixtures
    // For this example, we'll create a mock video buffer
    const mockVideoSize = 1280 * 720 * 3 * 30; // 30 frames of 720p RGB
    return Buffer.alloc(mockVideoSize);
  } catch (error) {
    throw new Error(`Failed to load test video: ${error}`);
  }
}