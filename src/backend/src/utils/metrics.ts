import { EventEmitter } from 'events'; // ^1.0.0
import * as prometheus from 'prom-client'; // ^14.0.0
import { Logger } from './logger';
import { getGPUMetrics } from './gpu';

// Constants for metrics configuration
const DEFAULT_METRICS_INTERVAL = 15000; // 15 seconds
const METRICS_PREFIX = 'cosmos_wfm_';
const GENERATION_LATENCY_BUCKETS = [10, 50, 100, 200, 300, 400, 500, 600];
const TOKENIZATION_LATENCY_BUCKETS = [10, 25, 50, 75, 100, 150, 200];

/**
 * Singleton class for collecting and managing system-wide metrics
 * Provides comprehensive monitoring for the Cosmos WFM Platform
 */
export class MetricsCollector extends EventEmitter {
  private static instance: MetricsCollector;
  private readonly logger: Logger;
  private readonly registry: prometheus.Registry;
  
  // Request metrics
  private readonly requestCounter: prometheus.Counter;
  private readonly errorCounter: prometheus.Counter;
  
  // Resource metrics
  private readonly gpuUtilization: prometheus.Gauge;
  private readonly gpuMemoryUsage: prometheus.Gauge;
  private readonly queueLength: prometheus.Gauge;
  
  // Performance metrics
  private readonly generationLatency: prometheus.Histogram;
  private readonly tokenizationLatency: prometheus.Histogram;
  private readonly throughputSummary: prometheus.Summary;

  private constructor() {
    super();
    this.logger = Logger.getInstance();
    this.registry = new prometheus.Registry();

    // Initialize default metrics
    prometheus.collectDefaultMetrics({
      prefix: METRICS_PREFIX,
      register: this.registry,
      labels: { service: 'cosmos-wfm' }
    });

    // Initialize request metrics
    this.requestCounter = new prometheus.Counter({
      name: `${METRICS_PREFIX}requests_total`,
      help: 'Total number of API requests',
      labelNames: ['endpoint', 'method', 'status']
    });

    this.errorCounter = new prometheus.Counter({
      name: `${METRICS_PREFIX}errors_total`,
      help: 'Total number of errors',
      labelNames: ['type', 'code']
    });

    // Initialize resource metrics
    this.gpuUtilization = new prometheus.Gauge({
      name: `${METRICS_PREFIX}gpu_utilization`,
      help: 'GPU utilization percentage',
      labelNames: ['device_id']
    });

    this.gpuMemoryUsage = new prometheus.Gauge({
      name: `${METRICS_PREFIX}gpu_memory_usage`,
      help: 'GPU memory usage in bytes',
      labelNames: ['device_id']
    });

    this.queueLength = new prometheus.Gauge({
      name: `${METRICS_PREFIX}queue_length`,
      help: 'Number of requests in processing queue',
      labelNames: ['type']
    });

    // Initialize performance metrics
    this.generationLatency = new prometheus.Histogram({
      name: `${METRICS_PREFIX}generation_latency_ms`,
      help: 'Video generation latency in milliseconds',
      buckets: GENERATION_LATENCY_BUCKETS,
      labelNames: ['model_type']
    });

    this.tokenizationLatency = new prometheus.Histogram({
      name: `${METRICS_PREFIX}tokenization_latency_ms`,
      help: 'Video tokenization latency in milliseconds',
      buckets: TOKENIZATION_LATENCY_BUCKETS,
      labelNames: ['resolution']
    });

    this.throughputSummary = new prometheus.Summary({
      name: `${METRICS_PREFIX}throughput_videos_per_hour`,
      help: 'Video processing throughput per hour',
      percentiles: [0.5, 0.9, 0.99]
    });

    // Register all metrics
    this.registry.registerMetric(this.requestCounter);
    this.registry.registerMetric(this.errorCounter);
    this.registry.registerMetric(this.gpuUtilization);
    this.registry.registerMetric(this.gpuMemoryUsage);
    this.registry.registerMetric(this.queueLength);
    this.registry.registerMetric(this.generationLatency);
    this.registry.registerMetric(this.tokenizationLatency);
    this.registry.registerMetric(this.throughputSummary);

    // Start GPU metrics collection
    this.startGPUMetricsCollection();
  }

  public static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }

  /**
   * Record API request metrics with enhanced labeling
   */
  public recordRequest(endpoint: string, method: string, statusCode: number, metadata: Record<string, any> = {}): void {
    try {
      this.requestCounter.labels(endpoint, method, statusCode.toString()).inc();
      
      if (statusCode >= 400) {
        this.errorCounter.labels('api', statusCode.toString()).inc();
      }

      this.logger.info('Request metrics recorded', {
        endpoint,
        method,
        statusCode,
        ...metadata
      });
    } catch (error) {
      this.logger.error('Failed to record request metrics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        endpoint,
        method
      });
    }
  }

  /**
   * Record video generation performance metrics
   */
  public recordGenerationMetrics(durationMs: number, metadata: Record<string, any> = {}): void {
    try {
      const { modelType = 'default' } = metadata;
      this.generationLatency.labels(modelType).observe(durationMs);
      
      // Update throughput metrics
      const videosPerHour = 3600000 / durationMs;
      this.throughputSummary.observe(videosPerHour);

      // Check SLO compliance
      if (durationMs > 600000) { // 600s SLO
        this.logger.warn('Generation latency exceeded SLO', {
          durationMs,
          sloThreshold: 600000,
          ...metadata
        });
      }

      this.emit('generationMetrics', { durationMs, ...metadata });
    } catch (error) {
      this.logger.error('Failed to record generation metrics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        durationMs
      });
    }
  }

  /**
   * Record video tokenization performance metrics
   */
  public recordTokenizationMetrics(durationMs: number, metadata: Record<string, any> = {}): void {
    try {
      const { resolution = '720p' } = metadata;
      this.tokenizationLatency.labels(resolution).observe(durationMs);

      // Check SLO compliance
      if (durationMs > 100) { // 100ms SLO
        this.logger.warn('Tokenization latency exceeded SLO', {
          durationMs,
          sloThreshold: 100,
          ...metadata
        });
      }

      this.emit('tokenizationMetrics', { durationMs, ...metadata });
    } catch (error) {
      this.logger.error('Failed to record tokenization metrics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        durationMs
      });
    }
  }

  /**
   * Get current metrics in Prometheus format
   */
  public async getMetrics(): Promise<string> {
    try {
      return await this.registry.metrics();
    } catch (error) {
      this.logger.error('Failed to get metrics', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Start collecting GPU metrics at regular intervals
   */
  private async startGPUMetricsCollection(): Promise<void> {
    const collectGPUMetrics = async () => {
      try {
        const metrics = await getGPUMetrics(0); // Assuming device ID 0
        
        this.gpuUtilization.labels('0').set(metrics.utilizationPercent);
        this.gpuMemoryUsage.labels('0').set(metrics.memoryUsed);
        this.queueLength.labels('gpu').set(metrics.scalingMetrics.queueLength);

        this.emit('gpuMetrics', metrics);
      } catch (error) {
        this.logger.error('Failed to collect GPU metrics', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    };

    setInterval(collectGPUMetrics, DEFAULT_METRICS_INTERVAL);
  }
}