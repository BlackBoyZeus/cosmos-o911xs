import { jest } from '@jest/globals';
import { Suite } from 'benchmark';
import { 
  GenerationService 
} from '../../../backend/src/services/GenerationService';
import {
  setupTestEnvironment,
  teardownTestEnvironment,
  waitForProcessing
} from '../../utils/testHelpers';
import {
  createMockGenerationRequest,
  createMockModel
} from '../../utils/mockData';
import { 
  VideoResolutionImpl,
  ModelType,
  ProcessingStatus 
} from '../../../backend/src/types/common';
import { 
  PERFORMANCE_THRESHOLDS,
  MODEL_ARCHITECTURES 
} from '../../../backend/src/types/models';

// Benchmark configuration constants
const BENCHMARK_TIMEOUT = 1200000; // 20 minutes
const BENCHMARK_ITERATIONS = 10;
const BENCHMARK_RESOLUTIONS = ['720p', '1080p'];
const BENCHMARK_FRAME_COUNTS = [30, 57, 120];

/**
 * Initialize benchmark environment with required models and services
 */
async function setupBenchmarkSuite(): Promise<void> {
  try {
    // Initialize test environment with GPU isolation
    await setupTestEnvironment({
      gpuDevices: 2,
      gpuMemory: 80 * 1024 * 1024 * 1024, // 80GB
      enableProfiling: true
    });

    // Create mock models
    const diffusionModel = createMockModel({
      architecture: MODEL_ARCHITECTURES.DIFFUSION_7B
    });

    const autoregressiveModel = createMockModel({
      architecture: MODEL_ARCHITECTURES.AUTOREGRESSIVE_4B
    });

    // Initialize generation services
    const diffusionService = new GenerationService(
      diffusionModel,
      { check: async () => 'PASS' }, // Mock pre-guard
      { check: async () => 'PASS' }, // Mock post-guard
      {} as any // Mock storage service
    );

    const arService = new GenerationService(
      autoregressiveModel,
      { check: async () => 'PASS' },
      { check: async () => 'PASS' },
      {} as any
    );

    return {
      diffusionService,
      arService
    };
  } catch (error) {
    console.error('Benchmark setup failed:', error);
    throw error;
  }
}

/**
 * Benchmark diffusion model video generation performance
 */
async function benchmarkDiffusionGeneration(suite: Suite): Promise<void> {
  const { diffusionService } = await setupBenchmarkSuite();

  for (const resolution of BENCHMARK_RESOLUTIONS) {
    for (const frameCount of BENCHMARK_FRAME_COUNTS) {
      suite.add(`Diffusion 7B - ${resolution} - ${frameCount} frames`, {
        defer: true,
        fn: async (deferred: { resolve: () => void }) => {
          try {
            const request = createMockGenerationRequest({
              modelType: ModelType.DIFFUSION_7B,
              resolution: new VideoResolutionImpl(
                resolution === '720p' ? 1280 : 1920,
                resolution === '720p' ? 720 : 1080
              ),
              frameCount,
              performanceConfig: {
                maxGenerationTime: PERFORMANCE_THRESHOLDS.MAX_GENERATION_TIME,
                targetFPS: 30,
                gpuMemoryLimit: 80,
                enableProfiling: true,
                priorityLevel: 5
              }
            });

            const startTime = performance.now();
            const result = await diffusionService.generateVideo(request);
            const duration = performance.now() - startTime;

            // Validate against SLAs
            if (duration > PERFORMANCE_THRESHOLDS.MAX_GENERATION_TIME) {
              throw new Error(`Generation time ${duration}ms exceeded threshold ${PERFORMANCE_THRESHOLDS.MAX_GENERATION_TIME}ms`);
            }

            if (result.status !== ProcessingStatus.COMPLETED) {
              throw new Error(`Generation failed with status: ${result.status}`);
            }

            deferred.resolve();
          } catch (error) {
            console.error('Diffusion benchmark failed:', error);
            throw error;
          }
        },
        maxTime: BENCHMARK_TIMEOUT,
        minSamples: BENCHMARK_ITERATIONS
      });
    }
  }
}

/**
 * Benchmark autoregressive model video generation performance
 */
async function benchmarkAutoregressiveGeneration(suite: Suite): Promise<void> {
  const { arService } = await setupBenchmarkSuite();

  for (const resolution of BENCHMARK_RESOLUTIONS) {
    for (const frameCount of BENCHMARK_FRAME_COUNTS) {
      suite.add(`Autoregressive 4B - ${resolution} - ${frameCount} frames`, {
        defer: true,
        fn: async (deferred: { resolve: () => void }) => {
          try {
            const request = createMockGenerationRequest({
              modelType: ModelType.AUTOREGRESSIVE_4B,
              resolution: new VideoResolutionImpl(
                resolution === '720p' ? 1280 : 1920,
                resolution === '720p' ? 720 : 1080
              ),
              frameCount,
              performanceConfig: {
                maxGenerationTime: PERFORMANCE_THRESHOLDS.MAX_GENERATION_TIME,
                targetFPS: 30,
                gpuMemoryLimit: 80,
                enableProfiling: true,
                priorityLevel: 5
              }
            });

            const startTime = performance.now();
            const result = await arService.generateVideo(request);
            const duration = performance.now() - startTime;

            // Validate performance metrics
            if (result.performanceMetrics.gpuMemoryUsed > PERFORMANCE_THRESHOLDS.MAX_GPU_MEMORY) {
              throw new Error(`GPU memory usage ${result.performanceMetrics.gpuMemoryUsed}GB exceeded threshold ${PERFORMANCE_THRESHOLDS.MAX_GPU_MEMORY}GB`);
            }

            if (result.performanceMetrics.framesPerSecond < PERFORMANCE_THRESHOLDS.MIN_THROUGHPUT) {
              throw new Error(`Throughput ${result.performanceMetrics.framesPerSecond}fps below threshold ${PERFORMANCE_THRESHOLDS.MIN_THROUGHPUT}fps`);
            }

            deferred.resolve();
          } catch (error) {
            console.error('Autoregressive benchmark failed:', error);
            throw error;
          }
        },
        maxTime: BENCHMARK_TIMEOUT,
        minSamples: BENCHMARK_ITERATIONS
      });
    }
  }
}

/**
 * Benchmark multi-GPU scaling performance
 */
async function benchmarkMultiGPUScaling(suite: Suite): Promise<void> {
  const { diffusionService } = await setupBenchmarkSuite();

  const gpuCounts = [1, 2];
  const resolution = '720p';
  const frameCount = 57;

  for (const gpuCount of gpuCounts) {
    suite.add(`Multi-GPU Scaling - ${gpuCount} GPUs`, {
      defer: true,
      fn: async (deferred: { resolve: () => void }) => {
        try {
          const requests = Array(gpuCount).fill(null).map(() => 
            createMockGenerationRequest({
              modelType: ModelType.DIFFUSION_7B,
              resolution: new VideoResolutionImpl(1280, 720),
              frameCount,
              performanceConfig: {
                maxGenerationTime: PERFORMANCE_THRESHOLDS.MAX_GENERATION_TIME,
                targetFPS: 30,
                gpuMemoryLimit: 80 / gpuCount, // Split memory across GPUs
                enableProfiling: true,
                priorityLevel: 5
              }
            })
          );

          const startTime = performance.now();
          const results = await Promise.all(
            requests.map(request => diffusionService.generateVideo(request))
          );
          const duration = performance.now() - startTime;

          // Calculate scaling efficiency
          const singleGPUTime = duration / gpuCount;
          const scalingEfficiency = (singleGPUTime / duration) * 100;

          if (scalingEfficiency < 80) {
            throw new Error(`Poor scaling efficiency: ${scalingEfficiency.toFixed(2)}%`);
          }

          deferred.resolve();
        } catch (error) {
          console.error('Multi-GPU benchmark failed:', error);
          throw error;
        }
      },
      maxTime: BENCHMARK_TIMEOUT,
      minSamples: BENCHMARK_ITERATIONS
    });
  }
}

// Export benchmark suite
export const videoGenerationBenchmarks = {
  benchmarkDiffusionGeneration,
  benchmarkAutoregressiveGeneration,
  benchmarkMultiGPUScaling
};