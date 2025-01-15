// @jest/globals version: ^29.0.0
// @jest/bench version: ^29.0.0
// simple-statistics version: ^7.8.0

import { describe, beforeAll, afterAll, it, expect } from '@jest/globals';
import { benchmark, BenchmarkResult } from '@jest/bench';
import * as stats from 'simple-statistics';

// Internal imports
import { ContinuousTokenizer } from '../../../backend/src/core/tokenizers/ContinuousTokenizer';
import { DiscreteTokenizer } from '../../../backend/src/core/tokenizers/DiscreteTokenizer';
import { TokenizerConfig } from '../../../backend/src/core/tokenizers/TokenizerConfig';
import { TokenizerType } from '../../../backend/src/types/tokenizer';
import { VideoResolutionImpl } from '../../../backend/src/types/common';
import { setupTestEnvironment, teardownTestEnvironment, mockSimulateGPUStress } from '../../utils/testHelpers';
import { readFileSync } from 'fs';
import { join } from 'path';

// Constants for benchmark configuration
const BENCHMARK_ITERATIONS = 1000;
const COMPRESSION_RATIOS = [256, 512, 1024, 2048];
const TARGET_PSNR = 32.80;
const TARGET_LATENCY_MS = 100;
const CONFIDENCE_LEVEL = 0.95;
const GPU_MEMORY_THRESHOLD = 0.9;
const STATISTICAL_SIGNIFICANCE = 0.05;

// Test video fixtures
const TEST_VIDEOS = {
  '720p': readFileSync(join(__dirname, '../../fixtures/videos/sample_720p.mp4')),
  '1080p': readFileSync(join(__dirname, '../../fixtures/videos/sample_1080p.mp4'))
};

describe('Tokenizer Performance Benchmarks', () => {
  beforeAll(async () => {
    await setupTestEnvironment({
      gpuDevices: 2,
      gpuMemory: 80 * 1024 * 1024 * 1024, // 80GB
      enableProfiling: true
    });
  });

  afterAll(async () => {
    await teardownTestEnvironment();
  });

  describe('Continuous Tokenizer Benchmarks', () => {
    for (const resolution of ['720p', '1080p'] as const) {
      for (const ratio of COMPRESSION_RATIOS) {
        it(`should meet performance targets at ${resolution} with ${ratio}:1 compression`, async () => {
          const config = new TokenizerConfig(
            TokenizerType.CONTINUOUS,
            ratio,
            new VideoResolutionImpl(
              resolution === '720p' ? 1280 : 1920,
              resolution === '720p' ? 720 : 1080
            )
          );

          const results = await benchmarkContinuousTokenizer(
            config,
            TEST_VIDEOS[resolution],
            { utilizationTarget: 0.8 }
          );

          // Statistical validation
          const latencyStats = {
            mean: stats.mean(results.latencies),
            stdDev: stats.standardDeviation(results.latencies),
            ci: stats.confidenceInterval(results.latencies, CONFIDENCE_LEVEL)
          };

          // Validate performance requirements
          expect(results.psnr).toBeGreaterThanOrEqual(TARGET_PSNR);
          expect(latencyStats.mean).toBeLessThanOrEqual(TARGET_LATENCY_MS);
          expect(results.gpuMemoryUsage).toBeLessThanOrEqual(GPU_MEMORY_THRESHOLD);
          
          // Statistical significance test
          const pValue = stats.tTest(results.latencies, [TARGET_LATENCY_MS]);
          expect(pValue).toBeGreaterThan(STATISTICAL_SIGNIFICANCE);
        });
      }
    }
  });

  describe('Discrete Tokenizer Benchmarks', () => {
    for (const resolution of ['720p', '1080p'] as const) {
      for (const ratio of COMPRESSION_RATIOS) {
        it(`should meet performance targets at ${resolution} with ${ratio}:1 compression`, async () => {
          const config = new TokenizerConfig(
            TokenizerType.DISCRETE,
            ratio,
            new VideoResolutionImpl(
              resolution === '720p' ? 1280 : 1920,
              resolution === '720p' ? 720 : 1080
            )
          );

          const results = await benchmarkDiscreteTokenizer(
            config,
            TEST_VIDEOS[resolution],
            { utilizationTarget: 0.8 }
          );

          // Statistical validation
          const latencyStats = {
            mean: stats.mean(results.latencies),
            stdDev: stats.standardDeviation(results.latencies),
            ci: stats.confidenceInterval(results.latencies, CONFIDENCE_LEVEL)
          };

          // Validate performance requirements
          expect(results.psnr).toBeGreaterThanOrEqual(TARGET_PSNR);
          expect(latencyStats.mean).toBeLessThanOrEqual(TARGET_LATENCY_MS);
          expect(results.gpuMemoryUsage).toBeLessThanOrEqual(GPU_MEMORY_THRESHOLD);

          // Statistical significance test
          const pValue = stats.tTest(results.latencies, [TARGET_LATENCY_MS]);
          expect(pValue).toBeGreaterThan(STATISTICAL_SIGNIFICANCE);
        });
      }
    }
  });
});

async function benchmarkContinuousTokenizer(
  config: TokenizerConfig,
  testVideo: Buffer,
  stressOptions: { utilizationTarget: number }
): Promise<BenchmarkResult> {
  const tokenizer = new ContinuousTokenizer(config);
  const latencies: number[] = [];
  let totalPsnr = 0;
  let maxGpuMemory = 0;

  try {
    // Simulate GPU load
    await mockSimulateGPUStress(0, stressOptions.utilizationTarget * 100);

    for (let i = 0; i < BENCHMARK_ITERATIONS; i++) {
      const startTime = performance.now();
      
      // Tokenization
      const tokenizeResult = await tokenizer.tokenize(testVideo, {
        trackMetrics: true,
        batchSize: 32
      });

      // Detokenization for quality validation
      const reconstructed = await tokenizer.detokenize(tokenizeResult.tokens);
      
      const endTime = performance.now();
      latencies.push(endTime - startTime);
      
      // Track metrics
      totalPsnr += tokenizeResult.metrics.psnr;
      maxGpuMemory = Math.max(maxGpuMemory, tokenizeResult.metrics.gpuMemoryUsage || 0);
    }

    return {
      latencies,
      psnr: totalPsnr / BENCHMARK_ITERATIONS,
      gpuMemoryUsage: maxGpuMemory,
      compressionRatio: config.compressionRatio,
      resolution: config.resolution
    };
  } finally {
    await tokenizer.cleanup();
  }
}

async function benchmarkDiscreteTokenizer(
  config: TokenizerConfig,
  testVideo: Buffer,
  stressOptions: { utilizationTarget: number }
): Promise<BenchmarkResult> {
  const tokenizer = new DiscreteTokenizer(config);
  const latencies: number[] = [];
  let totalPsnr = 0;
  let maxGpuMemory = 0;

  try {
    // Simulate GPU load
    await mockSimulateGPUStress(1, stressOptions.utilizationTarget * 100);

    for (let i = 0; i < BENCHMARK_ITERATIONS; i++) {
      const startTime = performance.now();
      
      // Tokenization
      const tokenizeResult = await tokenizer.tokenize(testVideo, {
        trackMetrics: true,
        batchSize: 32
      });

      // Detokenization for quality validation
      const reconstructed = await tokenizer.detokenize(tokenizeResult.tokens);
      
      const endTime = performance.now();
      latencies.push(endTime - startTime);
      
      // Track metrics
      totalPsnr += tokenizeResult.metrics.psnr;
      maxGpuMemory = Math.max(maxGpuMemory, tokenizeResult.metrics.gpuMemoryUsage || 0);
    }

    return {
      latencies,
      psnr: totalPsnr / BENCHMARK_ITERATIONS,
      gpuMemoryUsage: maxGpuMemory,
      compressionRatio: config.compressionRatio,
      resolution: config.resolution
    };
  } finally {
    await tokenizer.cleanup();
  }
}