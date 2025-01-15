import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import { Suite } from 'benchmark';

// Internal imports
import { AutoregressiveModel } from '../../../backend/src/core/models/autoregressive/AutoregressiveModel';
import { setupTestEnvironment, cleanupTestEnvironment } from '../../utils/testHelpers';
import { mockInitializeGPU, mockGPUMemoryTracking } from '../../utils/gpuMock';
import { ModelType, VideoResolutionImpl } from '../../../backend/src/types/common';
import { PERFORMANCE_THRESHOLDS } from '../../../backend/src/types/models';

// Constants for benchmark configuration
const TEST_PROMPTS = [
  "A car driving on a city street",
  "People walking in a park",
  "Aerial view of urban landscape"
];

const TEST_RESOLUTIONS = [
  new VideoResolutionImpl(1280, 720),
  new VideoResolutionImpl(1920, 1080),
  new VideoResolutionImpl(3840, 2160)
];

const FRAME_COUNTS = [30, 57, 120, 240];
const WARMUP_ITERATIONS = 3;
const MEMORY_THRESHOLDS = {
  baseline: 2048,  // 2GB baseline memory usage
  peak: 81920,     // 80GB peak memory limit
  warning: 75      // 75% utilization warning threshold
};

interface BenchmarkMetrics {
  generationTime: number;
  gpuMemoryUsage: number;
  throughput: number;
  psnrScore: number;
  memoryProfile: {
    baseline: number;
    peak: number;
    average: number;
    timeline: Array<{
      timestamp: number;
      allocated: number;
      utilization: number;
    }>;
  };
}

/**
 * Comprehensive benchmark suite for Autoregressive WFM performance testing
 */
class AutoregressiveModelBenchmark {
  private model: AutoregressiveModel;
  private metrics: BenchmarkMetrics[];
  private suite: Suite;

  constructor() {
    this.metrics = [];
    this.suite = new Suite();
  }

  /**
   * Initialize benchmark environment and resources
   */
  async setup(): Promise<void> {
    // Setup test environment with GPU simulation
    await setupTestEnvironment({
      gpuDevices: 2,
      gpuMemory: MEMORY_THRESHOLDS.peak * 1024 * 1024, // Convert to bytes
      enableProfiling: true
    });

    // Initialize model with base configuration
    this.model = new AutoregressiveModel({
      architecture: {
        type: ModelType.AUTOREGRESSIVE_4B,
        parameters: 4e9,
        variant: 'base'
      },
      maxResolution: TEST_RESOLUTIONS[0],
      maxFrames: Math.max(...FRAME_COUNTS),
      batchSize: 16
    });

    // Configure benchmark suite
    this.configureBenchmarkSuite();
  }

  /**
   * Clean up resources and verify state
   */
  async teardown(): Promise<void> {
    await cleanupTestEnvironment();
    this.metrics = [];
  }

  /**
   * Configure comprehensive benchmark test cases
   */
  private configureBenchmarkSuite(): void {
    // Generation latency benchmarks
    TEST_PROMPTS.forEach(prompt => {
      TEST_RESOLUTIONS.forEach(resolution => {
        FRAME_COUNTS.forEach(frameCount => {
          this.suite.add(`Generation_${resolution.width}x${resolution.height}_${frameCount}frames`, {
            defer: true,
            fn: async (deferred: { resolve: () => void }) => {
              await this.benchmarkGeneration(prompt, resolution, frameCount);
              deferred.resolve();
            }
          });
        });
      });
    });

    // Memory usage benchmarks
    this.suite.add('Memory_Profile', {
      defer: true,
      fn: async (deferred: { resolve: () => void }) => {
        await this.benchmarkMemoryUsage();
        deferred.resolve();
      }
    });
  }

  /**
   * Execute generation benchmark with comprehensive metrics collection
   */
  private async benchmarkGeneration(
    prompt: string,
    resolution: VideoResolutionImpl,
    frameCount: number
  ): Promise<void> {
    // Perform warmup iterations
    for (let i = 0; i < WARMUP_ITERATIONS; i++) {
      await this.model.generate(prompt, resolution, frameCount);
    }

    // Start performance monitoring
    const startTime = performance.now();
    const memoryStart = await this.model.getMemoryUsage();

    // Execute generation with memory tracking
    const result = await this.model.generate(prompt, resolution, frameCount);
    
    // Collect comprehensive metrics
    const endTime = performance.now();
    const memoryEnd = await this.model.getMemoryUsage();
    const performanceMetrics = this.model.getPerformanceMetrics();

    this.metrics.push({
      generationTime: endTime - startTime,
      gpuMemoryUsage: memoryEnd.allocated - memoryStart.allocated,
      throughput: frameCount / ((endTime - startTime) / 1000),
      psnrScore: performanceMetrics.psnrScore,
      memoryProfile: {
        baseline: memoryStart.allocated,
        peak: memoryEnd.peak,
        average: (memoryStart.allocated + memoryEnd.allocated) / 2,
        timeline: memoryEnd.timeline
      }
    });

    // Validate against performance requirements
    expect(endTime - startTime).toBeLessThan(PERFORMANCE_THRESHOLDS.MAX_GENERATION_TIME);
    expect(performanceMetrics.psnrScore).toBeGreaterThan(PERFORMANCE_THRESHOLDS.MIN_PSNR);
  }

  /**
   * Execute memory usage benchmark with detailed profiling
   */
  private async benchmarkMemoryUsage(): Promise<void> {
    const memoryTimeline: Array<{
      timestamp: number;
      allocated: number;
      utilization: number;
    }> = [];

    // Monitor memory usage over time
    const monitorInterval = setInterval(async () => {
      const metrics = await this.model.getMemoryUsage();
      memoryTimeline.push({
        timestamp: Date.now(),
        allocated: metrics.allocated,
        utilization: metrics.utilization
      });
    }, 100);

    // Execute standard workload
    await this.model.generate(
      TEST_PROMPTS[0],
      TEST_RESOLUTIONS[0],
      FRAME_COUNTS[1]
    );

    clearInterval(monitorInterval);

    // Analyze memory usage patterns
    const memoryMetrics = {
      baseline: memoryTimeline[0].allocated,
      peak: Math.max(...memoryTimeline.map(m => m.allocated)),
      average: memoryTimeline.reduce((sum, m) => sum + m.allocated, 0) / memoryTimeline.length,
      timeline: memoryTimeline
    };

    // Validate memory usage
    expect(memoryMetrics.peak).toBeLessThan(MEMORY_THRESHOLDS.peak);
    expect(memoryMetrics.average / MEMORY_THRESHOLDS.peak).toBeLessThan(MEMORY_THRESHOLDS.warning / 100);
  }

  /**
   * Run complete benchmark suite
   */
  async runBenchmarks(): Promise<BenchmarkMetrics[]> {
    await this.setup();

    return new Promise((resolve, reject) => {
      this.suite
        .on('complete', () => {
          resolve(this.metrics);
        })
        .on('error', (error: Error) => {
          reject(error);
        })
        .run({ async: true });
    });
  }

  /**
   * Get detailed benchmark metrics
   */
  getDetailedMetrics(): BenchmarkMetrics[] {
    return this.metrics;
  }
}

export { AutoregressiveModelBenchmark, BenchmarkMetrics };