// winston version: ^3.8.0
// prom-client version: ^14.0.0
// @types/node version: ^18.0.0

import { Logger, createLogger, format, transports } from 'winston';
import { Registry, Counter, Histogram, Gauge } from 'prom-client';
import { Buffer } from '@types/node';

import { ITokenizer } from '../core/tokenizers/interfaces/ITokenizer';
import { TokenizerConfig } from '../core/tokenizers/TokenizerConfig';
import { ContinuousTokenizer } from '../core/tokenizers/ContinuousTokenizer';
import { DiscreteTokenizer } from '../core/tokenizers/DiscreteTokenizer';
import { TokenizerType, TokenizationResult } from '../types/tokenizer';

/**
 * Resource monitoring configuration
 */
interface ResourceLimits {
  maxGpuMemoryGB: number;
  maxTokenizers: number;
  timeoutMs: number;
}

/**
 * Service configuration interface
 */
interface TokenizerServiceConfig {
  resourceLimits: ResourceLimits;
  cleanupIntervalMs: number;
  metricsPrefix: string;
}

/**
 * Service class for managing video tokenization operations with comprehensive 
 * resource management and monitoring
 */
export class TokenizerService {
  private readonly tokenizers: Map<string, ITokenizer>;
  private readonly logger: Logger;
  private readonly metrics: Registry;
  private readonly cleanupInterval: NodeJS.Timer;

  // Prometheus metrics
  private readonly tokenizationCounter: Counter;
  private readonly tokenizationLatency: Histogram;
  private readonly tokenizationErrors: Counter;
  private readonly activeTokenizers: Gauge;
  private readonly gpuMemoryUsage: Gauge;

  constructor(private readonly config: TokenizerServiceConfig) {
    // Initialize tokenizer map
    this.tokenizers = new Map<string, ITokenizer>();

    // Setup production logging
    this.logger = createLogger({
      level: 'info',
      format: format.combine(
        format.timestamp(),
        format.json()
      ),
      transports: [
        new transports.Console(),
        new transports.File({ filename: 'tokenizer-service.log' })
      ]
    });

    // Initialize Prometheus metrics
    this.metrics = new Registry();
    const { metricsPrefix } = config;

    this.tokenizationCounter = new Counter({
      name: `${metricsPrefix}_tokenizations_total`,
      help: 'Total number of tokenization operations',
      labelNames: ['type', 'status']
    });

    this.tokenizationLatency = new Histogram({
      name: `${metricsPrefix}_tokenization_latency_seconds`,
      help: 'Tokenization operation latency',
      labelNames: ['type'],
      buckets: [0.1, 0.5, 1, 2, 5]
    });

    this.tokenizationErrors = new Counter({
      name: `${metricsPrefix}_tokenization_errors_total`,
      help: 'Total number of tokenization errors',
      labelNames: ['type', 'error']
    });

    this.activeTokenizers = new Gauge({
      name: `${metricsPrefix}_active_tokenizers`,
      help: 'Number of active tokenizer instances',
      labelNames: ['type']
    });

    this.gpuMemoryUsage = new Gauge({
      name: `${metricsPrefix}_gpu_memory_usage_bytes`,
      help: 'GPU memory usage in bytes',
      labelNames: ['type']
    });

    // Register metrics
    this.metrics.registerMetric(this.tokenizationCounter);
    this.metrics.registerMetric(this.tokenizationLatency);
    this.metrics.registerMetric(this.tokenizationErrors);
    this.metrics.registerMetric(this.activeTokenizers);
    this.metrics.registerMetric(this.gpuMemoryUsage);

    // Start cleanup interval
    this.cleanupInterval = setInterval(
      () => this.cleanup(),
      config.cleanupIntervalMs
    );
  }

  /**
   * Creates a new tokenizer instance with resource management and monitoring
   */
  public async createTokenizer(config: TokenizerConfig): Promise<ITokenizer> {
    try {
      // Validate system resources
      if (this.tokenizers.size >= this.config.resourceLimits.maxTokenizers) {
        throw new Error('Maximum number of tokenizers reached');
      }

      // Create appropriate tokenizer type
      const tokenizer = config.type === TokenizerType.CONTINUOUS
        ? new ContinuousTokenizer(config)
        : new DiscreteTokenizer(config);

      // Validate configuration
      const validation = await tokenizer.validateConfig(config);
      if (!validation.isValid) {
        throw new Error('Invalid tokenizer configuration');
      }

      // Generate unique ID and store tokenizer
      const tokenizerId = this.generateTokenizerId(config.type);
      this.tokenizers.set(tokenizerId, tokenizer);

      // Update metrics
      this.activeTokenizers.inc({ type: config.type });
      this.logger.info('Created new tokenizer', { 
        id: tokenizerId, 
        type: config.type 
      });

      return tokenizer;

    } catch (error) {
      this.logger.error('Failed to create tokenizer', { error });
      this.tokenizationErrors.inc({ 
        type: config.type, 
        error: 'creation_failed' 
      });
      throw error;
    }
  }

  /**
   * Tokenizes video data with performance monitoring and error handling
   */
  public async tokenize(
    tokenizerId: string, 
    videoData: Buffer
  ): Promise<TokenizationResult> {
    const tokenizer = this.tokenizers.get(tokenizerId);
    if (!tokenizer) {
      throw new Error(`Tokenizer not found: ${tokenizerId}`);
    }

    const startTime = Date.now();
    const config = await tokenizer.getConfig();

    try {
      // Execute tokenization with timeout protection
      const result = await Promise.race([
        tokenizer.tokenize(videoData),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Tokenization timeout')), 
          this.config.resourceLimits.timeoutMs)
        )
      ]);

      // Update metrics
      const duration = (Date.now() - startTime) / 1000;
      this.tokenizationLatency.observe({ type: config.type }, duration);
      this.tokenizationCounter.inc({ 
        type: config.type, 
        status: result.status 
      });

      // Log performance metrics
      this.logger.info('Tokenization completed', {
        id: tokenizerId,
        duration,
        status: result.status,
        metrics: result.metrics
      });

      return result;

    } catch (error) {
      this.logger.error('Tokenization failed', { 
        id: tokenizerId, 
        error 
      });
      this.tokenizationErrors.inc({ 
        type: config.type, 
        error: 'tokenization_failed' 
      });
      throw error;
    }
  }

  /**
   * Reconstructs video from tokens with quality validation
   */
  public async detokenize(
    tokenizerId: string, 
    tokens: Buffer
  ): Promise<Buffer> {
    const tokenizer = this.tokenizers.get(tokenizerId);
    if (!tokenizer) {
      throw new Error(`Tokenizer not found: ${tokenizerId}`);
    }

    const startTime = Date.now();
    const config = await tokenizer.getConfig();

    try {
      // Execute detokenization with timeout protection
      const result = await Promise.race([
        tokenizer.detokenize(tokens),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Detokenization timeout')), 
          this.config.resourceLimits.timeoutMs)
        )
      ]);

      // Update metrics
      const duration = (Date.now() - startTime) / 1000;
      this.tokenizationLatency.observe({ type: config.type }, duration);

      this.logger.info('Detokenization completed', {
        id: tokenizerId,
        duration
      });

      return result;

    } catch (error) {
      this.logger.error('Detokenization failed', { 
        id: tokenizerId, 
        error 
      });
      this.tokenizationErrors.inc({ 
        type: config.type, 
        error: 'detokenization_failed' 
      });
      throw error;
    }
  }

  /**
   * Retrieves comprehensive performance and resource metrics
   */
  public async getMetrics(tokenizerId: string): Promise<TokenizerMetrics> {
    const tokenizer = this.tokenizers.get(tokenizerId);
    if (!tokenizer) {
      throw new Error(`Tokenizer not found: ${tokenizerId}`);
    }

    try {
      const metrics = await tokenizer.getMetrics();
      const config = await tokenizer.getConfig();

      // Update GPU memory usage metric
      this.gpuMemoryUsage.set(
        { type: config.type },
        metrics.getEfficiency()
      );

      return metrics;

    } catch (error) {
      this.logger.error('Failed to get metrics', { 
        id: tokenizerId, 
        error 
      });
      throw error;
    }
  }

  /**
   * Performs resource cleanup and optimization
   */
  private async cleanup(): Promise<void> {
    try {
      const now = Date.now();
      let cleanedCount = 0;

      for (const [id, tokenizer] of this.tokenizers.entries()) {
        const metrics = await tokenizer.getMetrics();
        const config = await tokenizer.getConfig();

        // Remove inactive tokenizers
        if (metrics.latencyMs === 0) {
          this.tokenizers.delete(id);
          this.activeTokenizers.dec({ type: config.type });
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        this.logger.info('Cleanup completed', { 
          cleanedTokenizers: cleanedCount 
        });
      }

    } catch (error) {
      this.logger.error('Cleanup failed', { error });
    }
  }

  /**
   * Generates unique tokenizer ID
   */
  private generateTokenizerId(type: TokenizerType): string {
    return `${type.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}