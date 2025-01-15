import { benchmark, expect } from '@jest/benchmark';
import { GPUMetricsCollector } from '@nvidia/gpu-metrics';
import { DataCurator } from '../../../backend/src/core/curator/DataCurator';
import { BenchmarkConfig } from '../../fixtures/configs/benchmark_config.json';
import { IVideo } from '../../../backend/src/interfaces/IVideo';
import { ProcessingStatus } from '../../../backend/src/types/common';

// Constants for benchmark configuration
const WARMUP_ITERATIONS = 2;
const BENCHMARK_ITERATIONS = 10;
const SAMPLE_VIDEO_PATH = '../../fixtures/videos/sample_720p.mp4';
const GPU_MEMORY_THRESHOLD = '80GB';
const TARGET_DAILY_THROUGHPUT = 100000;
const MAX_GPU_UTILIZATION = 0.95;
const BATCH_SIZE_RANGE = { min: 16, max: 128 };

// Interfaces for benchmark results
interface BenchmarkResult {
  durationMs: number;
  gpuMetrics: {
    utilizationPercent: number;
    memoryUsed: number;
    memoryTotal: number;
    temperature: number;
  };
  processingMetrics: {
    throughput: number;
    successRate: number;
    latencyP99: number;
  };
}

interface BatchBenchmarkResult extends BenchmarkResult {
  batchSize: number;
  videosProcessed: number;
  videosPerSecond: number;
}

/**
 * Comprehensive test suite for benchmarking data curation pipeline performance
 * with resource monitoring and performance validation
 */
@benchmark.describe('Data Curation Pipeline Benchmarks')
export class DataCurationBenchmark {
  private curator: DataCurator;
  private metricsCollector: GPUMetricsCollector;
  private config: typeof BenchmarkConfig;
  private results: Map<string, BenchmarkResult>;

  constructor() {
    this.curator = new DataCurator({
      gpuDeviceId: 0,
      batchSize: BATCH_SIZE_RANGE.min,
      maxConcurrent: 4,
      qualityThresholds: {
        minPSNR: 30.0,
        minSSIM: 0.9,
        maxFID: 100.0,
        maxFVD: 150.0
      },
      retryPolicies: {
        processingError: {
          maxAttempts: 3,
          backoff: 1000,
          timeout: 300000
        }
      }
    });

    this.metricsCollector = new GPUMetricsCollector();
    this.config = BenchmarkConfig;
    this.results = new Map();
  }

  /**
   * Setup before running benchmarks including GPU initialization
   */
  async beforeAll(): Promise<void> {
    // Initialize GPU monitoring
    await this.metricsCollector.initialize();

    // Perform warmup iterations
    const warmupVideo = this.createTestVideo();
    for (let i = 0; i < WARMUP_ITERATIONS; i++) {
      await this.curator.processVideo(warmupVideo);
    }

    // Clear GPU cache
    await this.metricsCollector.clearCache();
  }

  /**
   * Cleanup after benchmarks
   */
  async afterAll(): Promise<void> {
    await this.metricsCollector.stop();
    await this.generateBenchmarkReport();
  }

  /**
   * Benchmarks single video processing performance with GPU metrics
   */
  @benchmark.it('Single Video Processing Performance')
  async benchmarkSingleVideoProcessing(): Promise<BenchmarkResult> {
    const video = this.createTestVideo();
    const results: number[] = [];
    const gpuMetrics: any[] = [];

    // Start metrics collection
    await this.metricsCollector.startCollection();

    // Run benchmark iterations
    for (let i = 0; i < BENCHMARK_ITERATIONS; i++) {
      const startTime = Date.now();
      
      try {
        const processedVideo = await this.curator.processVideo(video);
        expect(processedVideo.status).toBe(ProcessingStatus.COMPLETED);
        
        const duration = Date.now() - startTime;
        results.push(duration);
        
        // Collect GPU metrics
        const metrics = await this.metricsCollector.getMetrics();
        gpuMetrics.push(metrics);

      } catch (error) {
        console.error(`Iteration ${i} failed:`, error);
      }

      // Clear GPU cache between iterations
      await this.metricsCollector.clearCache();
    }

    // Calculate benchmark metrics
    const avgDuration = results.reduce((a, b) => a + b, 0) / results.length;
    const p99Latency = this.calculateP99(results);
    const avgGpuMetrics = this.calculateAverageGpuMetrics(gpuMetrics);

    // Validate against performance targets
    expect(avgDuration).toBeLessThan(this.config.performanceTargets.generationLatency['720p']);
    expect(avgGpuMetrics.utilizationPercent).toBeLessThan(MAX_GPU_UTILIZATION * 100);

    return {
      durationMs: avgDuration,
      gpuMetrics: avgGpuMetrics,
      processingMetrics: {
        throughput: (24 * 3600 * 1000) / avgDuration, // Videos per day
        successRate: results.length / BENCHMARK_ITERATIONS,
        latencyP99: p99Latency
      }
    };
  }

  /**
   * Benchmarks batch processing performance with resource monitoring
   */
  @benchmark.it('Batch Processing Performance')
  async benchmarkBatchProcessing(): Promise<BatchBenchmarkResult> {
    const batchSizes = this.generateBatchSizes();
    const results = new Map<number, BatchBenchmarkResult>();

    for (const batchSize of batchSizes) {
      const videos = Array(batchSize).fill(null).map(() => this.createTestVideo());
      const batchResults: number[] = [];
      const gpuMetrics: any[] = [];

      // Start metrics collection
      await this.metricsCollector.startCollection();

      // Run benchmark iterations
      for (let i = 0; i < BENCHMARK_ITERATIONS; i++) {
        const startTime = Date.now();
        
        try {
          const processedVideos = await this.curator.processBatch(videos);
          expect(processedVideos.length).toBeGreaterThan(0);
          
          const duration = Date.now() - startTime;
          batchResults.push(duration);
          
          // Collect GPU metrics
          const metrics = await this.metricsCollector.getMetrics();
          gpuMetrics.push(metrics);

        } catch (error) {
          console.error(`Batch iteration ${i} failed:`, error);
        }

        // Clear GPU cache between iterations
        await this.metricsCollector.clearCache();
      }

      // Calculate batch metrics
      const avgDuration = batchResults.reduce((a, b) => a + b, 0) / batchResults.length;
      const avgGpuMetrics = this.calculateAverageGpuMetrics(gpuMetrics);
      const videosPerSecond = (batchSize * 1000) / avgDuration;

      results.set(batchSize, {
        batchSize,
        durationMs: avgDuration,
        gpuMetrics: avgGpuMetrics,
        processingMetrics: {
          throughput: videosPerSecond * 24 * 3600, // Videos per day
          successRate: batchResults.length / BENCHMARK_ITERATIONS,
          latencyP99: this.calculateP99(batchResults)
        },
        videosProcessed: batchSize,
        videosPerSecond
      });
    }

    // Find optimal batch size
    const optimalResult = this.findOptimalBatchSize(results);
    expect(optimalResult.processingMetrics.throughput).toBeGreaterThan(TARGET_DAILY_THROUGHPUT);

    return optimalResult;
  }

  // Helper methods
  private createTestVideo(): IVideo {
    return {
      id: crypto.randomUUID(),
      path: SAMPLE_VIDEO_PATH,
      filename: 'sample_720p.mp4',
      duration: 10,
      resolution: { width: 1280, height: 720 },
      fps: 30,
      format: 'mp4',
      codec: 'h264',
      size: 1024 * 1024, // 1MB
      checksum: 'test-checksum',
      status: ProcessingStatus.PENDING,
      errorMessage: null,
      metadata: {},
      quality: {
        psnr: 0,
        ssim: 0,
        fid: 0,
        fvd: 0,
        sampsonError: 0,
        poseAccuracy: 0
      },
      annotations: [],
      segments: [],
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  private generateBatchSizes(): number[] {
    const sizes: number[] = [];
    for (let size = BATCH_SIZE_RANGE.min; size <= BATCH_SIZE_RANGE.max; size *= 2) {
      sizes.push(size);
    }
    return sizes;
  }

  private calculateP99(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.floor(sorted.length * 0.99);
    return sorted[index];
  }

  private calculateAverageGpuMetrics(metrics: any[]): any {
    return {
      utilizationPercent: metrics.reduce((a, b) => a + b.utilizationPercent, 0) / metrics.length,
      memoryUsed: metrics.reduce((a, b) => a + b.memoryUsed, 0) / metrics.length,
      memoryTotal: metrics.reduce((a, b) => a + b.memoryTotal, 0) / metrics.length,
      temperature: metrics.reduce((a, b) => a + b.temperature, 0) / metrics.length
    };
  }

  private findOptimalBatchSize(results: Map<number, BatchBenchmarkResult>): BatchBenchmarkResult {
    let optimal: BatchBenchmarkResult | null = null;
    let maxThroughput = 0;

    for (const result of results.values()) {
      if (result.processingMetrics.throughput > maxThroughput &&
          result.gpuMetrics.utilizationPercent < MAX_GPU_UTILIZATION * 100) {
        maxThroughput = result.processingMetrics.throughput;
        optimal = result;
      }
    }

    return optimal!;
  }

  private async generateBenchmarkReport(): Promise<void> {
    // Implementation for generating detailed benchmark reports
    // Would include metrics visualization and performance analysis
  }
}