// winston version: 3.8.0
// ioredis version: 5.3.0
// @cosmos/metrics version: 1.0.0

import { UUID } from 'crypto';
import { IGuard } from './interfaces/IGuard';
import { SafetyClassifier } from './SafetyClassifier';
import { 
  SafetyCheckType, 
  SafetyThresholds, 
  SafetyMetrics,
  SafetyThresholdsImpl 
} from '../../types/safety';
import { 
  GuardType, 
  SafetyStatus, 
  SafetyCheckDetails 
} from '../../interfaces/ISafetyLog';
import { Logger, createLogger, format, transports } from 'winston';
import Redis from 'ioredis';
import { MetricsCollector } from '@cosmos/metrics';

/**
 * PreGuard implementation for pre-generation content safety checks
 * Provides caching, metrics collection and comprehensive safety validation
 */
export class PreGuard implements IGuard {
  private readonly classifier: SafetyClassifier;
  private readonly thresholds: SafetyThresholds;
  private readonly logger: Logger;
  private readonly cache: Redis;
  private readonly metrics: MetricsCollector;
  public readonly guardType = GuardType.PRE_GUARD;

  constructor(
    thresholds: SafetyThresholds = new SafetyThresholdsImpl(),
    classifierConfig: Record<string, any> = {},
    cacheConfig: Record<string, any> = {},
    metricsConfig: Record<string, any> = {}
  ) {
    // Validate configurations
    if (!thresholds.validate()) {
      throw new Error('Invalid safety thresholds configuration');
    }

    // Initialize components
    this.thresholds = thresholds;
    this.classifier = new SafetyClassifier(thresholds, classifierConfig);
    
    // Configure Redis cache
    this.cache = new Redis({
      host: cacheConfig.host || 'localhost',
      port: cacheConfig.port || 6379,
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => Math.min(times * 50, 2000),
      ...cacheConfig
    });

    // Configure logger
    this.logger = createLogger({
      level: 'info',
      format: format.combine(
        format.timestamp(),
        format.json()
      ),
      defaultMeta: { service: 'pre-guard' },
      transports: [
        new transports.Console(),
        new transports.File({ filename: 'pre-guard.log' })
      ]
    });

    // Initialize metrics collector
    this.metrics = new MetricsCollector({
      namespace: 'cosmos_safety',
      subsystem: 'pre_guard',
      ...metricsConfig
    });
  }

  /**
   * Performs cached pre-generation safety checks on input content
   */
  async check(
    content: any,
    options: Record<string, any> = {}
  ): Promise<SafetyStatus> {
    const startTime = Date.now();
    const contentHash = this.generateContentHash(content);

    try {
      // Check cache first
      const cachedResult = await this.checkCache(contentHash);
      if (cachedResult) {
        this.metrics.increment('cache_hits');
        return cachedResult;
      }

      // Perform comprehensive safety checks
      const [contentSafety, harmfulContent] = await Promise.all([
        this.classifier.checkContent(content, options),
        this.classifier.checkHarmfulContent(content, options)
      ]);

      // Evaluate results against thresholds
      const status = this.evaluateResults(contentSafety, harmfulContent);

      // Cache results
      await this.cacheResults(contentHash, status, options.cacheTTL || 3600);

      // Record metrics
      this.recordMetrics(status, Date.now() - startTime);

      return status;

    } catch (error) {
      this.logger.error('Safety check failed', { error, content: contentHash });
      this.metrics.increment('check_failures');
      throw error;
    }
  }

  /**
   * Logs safety check results with detailed audit trail
   */
  async logCheck(
    generationId: UUID,
    modelId: UUID,
    status: SafetyStatus,
    details: SafetyCheckDetails
  ): Promise<void> {
    try {
      const logEntry = {
        timestamp: new Date(),
        generationId,
        modelId,
        guardType: this.guardType,
        status,
        details,
        environment: process.env.NODE_ENV,
        version: process.env.APP_VERSION
      };

      // Log to storage
      this.logger.info('Safety check completed', logEntry);

      // Record metrics
      this.metrics.histogram('check_score', details.score);
      this.metrics.gauge('check_latency', details.metadata.duration);

      // Update safety dashboard
      await this.updateSafetyDashboard(logEntry);

      // Trigger alerts if needed
      if (status === SafetyStatus.FAIL) {
        await this.triggerSafetyAlert(logEntry);
      }

    } catch (error) {
      this.logger.error('Failed to log safety check', { error, generationId });
      throw error;
    }
  }

  /**
   * Performs health check of PreGuard components
   */
  async healthCheck(): Promise<Record<string, boolean>> {
    const health = {
      classifier: await this.checkClassifierHealth(),
      cache: await this.checkCacheHealth(),
      metrics: await this.checkMetricsHealth()
    };

    this.logger.info('Health check completed', { health });
    return health;
  }

  private generateContentHash(content: any): string {
    return Buffer.from(JSON.stringify(content)).toString('base64');
  }

  private async checkCache(contentHash: string): Promise<SafetyStatus | null> {
    try {
      const cached = await this.cache.get(contentHash);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      this.logger.warn('Cache check failed', { error });
      return null;
    }
  }

  private async cacheResults(
    contentHash: string,
    status: SafetyStatus,
    ttl: number
  ): Promise<void> {
    try {
      await this.cache.setex(contentHash, ttl, JSON.stringify(status));
    } catch (error) {
      this.logger.warn('Cache update failed', { error });
    }
  }

  private evaluateResults(
    contentSafety: SafetyCheckDetails,
    harmfulContent: SafetyCheckDetails
  ): SafetyStatus {
    const contentPass = this.thresholds.checkThreshold(
      SafetyCheckType.CONTENT_SAFETY,
      contentSafety.score
    );
    const harmfulPass = this.thresholds.checkThreshold(
      SafetyCheckType.HARMFUL_CONTENT,
      harmfulContent.score
    );

    if (contentPass && harmfulPass) {
      return SafetyStatus.PASS;
    } else if (!contentPass && !harmfulPass) {
      return SafetyStatus.FAIL;
    }
    return SafetyStatus.WARNING;
  }

  private recordMetrics(status: SafetyStatus, duration: number): void {
    this.metrics.increment(`check_status_${status.toLowerCase()}`);
    this.metrics.histogram('check_duration', duration);
  }

  private async updateSafetyDashboard(logEntry: any): Promise<void> {
    // Implementation would connect to dashboard service
    this.metrics.gauge('safety_score', logEntry.details.score);
  }

  private async triggerSafetyAlert(logEntry: any): Promise<void> {
    this.logger.warn('Safety check failed - triggering alert', logEntry);
    // Implementation would connect to alert service
  }

  private async checkClassifierHealth(): Promise<boolean> {
    try {
      await this.classifier.getMetrics();
      return true;
    } catch {
      return false;
    }
  }

  private async checkCacheHealth(): Promise<boolean> {
    try {
      await this.cache.ping();
      return true;
    } catch {
      return false;
    }
  }

  private async checkMetricsHealth(): Promise<boolean> {
    try {
      return this.metrics.isHealthy();
    } catch {
      return false;
    }
  }
}