// redis version: ^4.0.0
// @monitoring/metrics-collector version: ^1.0.0

import { UUID } from 'crypto';
import { Redis } from 'redis';
import { MetricsCollector } from '@monitoring/metrics-collector';
import { IGuard } from './interfaces/IGuard';
import { SafetyClassifier } from './SafetyClassifier';
import { 
  GuardType, 
  SafetyStatus, 
  SafetyCheckDetails, 
  SafetyError 
} from '../../../interfaces/ISafetyLog';
import { SafetyCheckType } from '../../../types/safety';

/**
 * PostGuard implements post-generation safety checks with enhanced error handling,
 * metrics tracking, and caching capabilities per technical specifications
 */
export class PostGuard implements IGuard {
  private readonly classifier: SafetyClassifier;
  private readonly metricsCollector: MetricsCollector;
  private readonly cache: Redis;
  public readonly guardType: GuardType = GuardType.POST_GUARD;

  constructor(
    private readonly thresholds: Record<string, number>,
    classifierConfig: Record<string, any>,
    cacheConfig: Record<string, any>
  ) {
    // Initialize safety classifier with provided configuration
    this.classifier = new SafetyClassifier(thresholds, classifierConfig);

    // Initialize metrics collector
    this.metricsCollector = new MetricsCollector({
      namespace: 'cosmos_wfm',
      subsystem: 'safety',
      component: 'post_guard'
    });

    // Initialize Redis cache
    this.cache = new Redis(cacheConfig);
  }

  /**
   * Performs comprehensive safety checks on generated content
   * Implements caching and metrics tracking for performance optimization
   */
  public async check(
    content: any,
    options: Record<string, any> = {}
  ): Promise<SafetyStatus> {
    const startTime = Date.now();
    const contentHash = this.generateContentHash(content);

    try {
      // Check cache first
      const cachedResult = await this.cache.get(contentHash);
      if (cachedResult) {
        await this.metricsCollector.incrementCounter('cache_hits');
        return JSON.parse(cachedResult).status;
      }

      // Start metrics tracking
      await this.metricsCollector.startTimer('safety_check_duration');

      // Perform content safety classification
      const safetyResult = await this.classifier.checkContent(content, options);
      
      // Perform face detection and privacy checks
      const faceResult = await this.classifier.detectFaces(content, options);
      
      // Check for harmful content
      const harmfulResult = await this.classifier.checkHarmfulContent(content, options);

      // Aggregate results
      const aggregateScore = this.calculateAggregateScore([
        safetyResult.score,
        faceResult.score,
        harmfulResult.score
      ]);

      // Determine final status
      const status = this.determineStatus(aggregateScore);

      // Cache results
      await this.cacheResults(contentHash, {
        status,
        safetyResult,
        faceResult,
        harmfulResult
      });

      // Record metrics
      await this.recordMetrics(status, Date.now() - startTime);

      return status;

    } catch (error) {
      await this.handleError(error as SafetyError);
      throw error;
    }
  }

  /**
   * Logs safety check results with enhanced metadata and metrics
   */
  public async logCheck(
    generationId: UUID,
    modelId: UUID,
    status: SafetyStatus,
    details: SafetyCheckDetails
  ): Promise<void> {
    try {
      const logEntry = {
        id: generationId,
        modelId,
        guardType: this.guardType,
        status,
        details,
        timestamp: new Date(),
        metadata: {
          thresholds: this.thresholds,
          processingTime: details.metadata.duration
        }
      };

      // Record metrics for logging operation
      await this.metricsCollector.incrementCounter('safety_logs_total');
      await this.metricsCollector.recordHistogram(
        'safety_check_duration',
        details.metadata.duration
      );

      // Store log entry
      await this.storeLogEntry(logEntry);

      // Update metrics dashboard
      await this.updateMetricsDashboard(status, details);

    } catch (error) {
      await this.handleError(error as SafetyError);
      throw error;
    }
  }

  /**
   * Handles safety check errors with proper categorization and reporting
   */
  private async handleError(error: SafetyError): Promise<void> {
    try {
      // Categorize error
      const errorCategory = this.categorizeError(error);

      // Record error metrics
      await this.metricsCollector.incrementCounter('safety_errors_total', {
        category: errorCategory
      });

      // Log error details
      console.error('Safety check error:', {
        category: errorCategory,
        message: error.message,
        stack: error.stack,
        timestamp: new Date()
      });

      // Trigger alerts if necessary
      if (this.shouldTriggerAlert(errorCategory)) {
        await this.triggerAlert(error);
      }

    } catch (innerError) {
      console.error('Error handling failed:', innerError);
    }
  }

  /**
   * Generates a unique hash for content caching
   */
  private generateContentHash(content: any): string {
    return Buffer.from(JSON.stringify(content)).toString('base64');
  }

  /**
   * Calculates aggregate safety score from individual check results
   */
  private calculateAggregateScore(scores: number[]): number {
    const weights = {
      safety: 0.4,
      face: 0.3,
      harmful: 0.3
    };
    
    return scores.reduce((acc, score, index) => {
      const weight = Object.values(weights)[index];
      return acc + (score * weight);
    }, 0);
  }

  /**
   * Determines final safety status based on aggregate score
   */
  private determineStatus(score: number): SafetyStatus {
    if (score >= this.thresholds.highThreshold) {
      return SafetyStatus.PASS;
    } else if (score >= this.thresholds.lowThreshold) {
      return SafetyStatus.WARNING;
    }
    return SafetyStatus.FAIL;
  }

  /**
   * Caches check results for future use
   */
  private async cacheResults(
    hash: string, 
    results: Record<string, any>
  ): Promise<void> {
    await this.cache.set(
      hash,
      JSON.stringify(results),
      'EX',
      3600 // 1 hour expiration
    );
  }

  /**
   * Records metrics from safety check
   */
  private async recordMetrics(
    status: SafetyStatus,
    duration: number
  ): Promise<void> {
    await this.metricsCollector.incrementCounter('safety_checks_total', {
      status
    });
    await this.metricsCollector.recordHistogram(
      'safety_check_duration',
      duration
    );
  }

  /**
   * Stores safety check log entry
   */
  private async storeLogEntry(entry: Record<string, any>): Promise<void> {
    // Implementation would depend on storage backend
    console.log('Storing safety log entry:', entry);
  }

  /**
   * Updates metrics dashboard with latest check results
   */
  private async updateMetricsDashboard(
    status: SafetyStatus,
    details: SafetyCheckDetails
  ): Promise<void> {
    await this.metricsCollector.updateGauge('safety_score', details.score);
    await this.metricsCollector.updateGauge('check_duration', details.metadata.duration);
  }

  /**
   * Categorizes safety check errors
   */
  private categorizeError(error: SafetyError): string {
    if (error.message.includes('classifier')) return 'CLASSIFIER_ERROR';
    if (error.message.includes('cache')) return 'CACHE_ERROR';
    if (error.message.includes('metrics')) return 'METRICS_ERROR';
    return 'UNKNOWN_ERROR';
  }

  /**
   * Determines if an alert should be triggered based on error category
   */
  private shouldTriggerAlert(category: string): boolean {
    const criticalCategories = ['CLASSIFIER_ERROR', 'UNKNOWN_ERROR'];
    return criticalCategories.includes(category);
  }

  /**
   * Triggers alert for critical errors
   */
  private async triggerAlert(error: SafetyError): Promise<void> {
    // Implementation would depend on alerting system
    console.error('Critical safety error:', error);
  }
}