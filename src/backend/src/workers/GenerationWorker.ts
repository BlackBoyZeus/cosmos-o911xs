import { Worker } from 'worker_threads'; // latest
import { Logger } from 'winston'; // ^3.8.0
import { Counter, Histogram, Registry } from 'prom-client'; // ^14.0.0
import { UUID } from 'crypto';

import { 
  IGenerationRequest, 
  IGenerationResponse, 
  isValidGenerationRequest 
} from '../../interfaces/IGeneration';

import { 
  IModel, 
  GenerationConfig, 
  GenerationResult 
} from '../../core/models/interfaces/IModel';

import {
  VideoResolution,
  ProcessingStatus,
  ModelType
} from '../../types/common';

import {
  SafetyCheckType,
  SafetyThresholds,
  SafetyMetrics,
  SafetyAuditRecord
} from '../../types/safety';

// Performance constants from technical specifications
const MAX_GENERATION_TIME_MS = 600000; // 600s for 57 frames
const MAX_FRAME_COUNT = 57;
const DEFAULT_RESOLUTION = { width: 1280, height: 720 };
const MAX_VIEWS = 4;
const PERFORMANCE_SLO_MS = 550000; // SLO threshold
const RETRY_ATTEMPTS = 3;

/**
 * Worker implementation for handling video generation requests
 * Includes performance tracking and multi-view support
 */
export class GenerationWorker {
  private readonly metrics: Registry;
  private readonly generationDuration: Histogram;
  private readonly safetyCheckDuration: Histogram;
  private readonly generationCounter: Counter;
  private readonly failureCounter: Counter;

  constructor(
    private readonly model: IModel,
    private readonly preGuard: IGuard,
    private readonly postGuard: IGuard,
    private readonly storage: StorageService,
    private readonly logger: Logger
  ) {
    // Initialize Prometheus metrics
    this.metrics = new Registry();
    
    this.generationDuration = new Histogram({
      name: 'generation_duration_seconds',
      help: 'Video generation duration in seconds',
      buckets: [60, 120, 300, 450, 600],
      registers: [this.metrics]
    });

    this.safetyCheckDuration = new Histogram({
      name: 'safety_check_duration_seconds',
      help: 'Safety check duration in seconds',
      buckets: [1, 5, 15, 30, 60],
      registers: [this.metrics]
    });

    this.generationCounter = new Counter({
      name: 'generation_requests_total',
      help: 'Total number of generation requests',
      registers: [this.metrics]
    });

    this.failureCounter = new Counter({
      name: 'generation_failures_total',
      help: 'Total number of generation failures',
      registers: [this.metrics]
    });
  }

  /**
   * Handles video generation requests with performance tracking
   * @param request Generation request with parameters
   * @returns Generation response with results or error
   */
  public async handleRequest(request: IGenerationRequest): Promise<IGenerationResponse> {
    const startTime = Date.now();
    this.generationCounter.inc();
    
    try {
      // Validate request parameters
      const validationResult = await this.validateRequest(request);
      if (!validationResult.isValid) {
        throw new Error(`Invalid request: ${validationResult.error}`);
      }

      // Pre-generation safety check
      const preCheckStart = Date.now();
      const preCheckResult = await this.preGuard.check(request);
      this.safetyCheckDuration.observe((Date.now() - preCheckStart) / 1000);

      if (!preCheckResult.passed) {
        this.failureCounter.inc();
        throw new Error(`Pre-generation safety check failed: ${preCheckResult.details}`);
      }

      // Configure generation parameters
      const generationConfig: GenerationConfig = {
        batchSize: 1,
        guidanceScale: 7.5,
        numInferenceSteps: 50,
        progressCallback: (progress: number) => {
          this.logger.debug(`Generation progress: ${progress}%`, {
            requestId: request.id,
            progress
          });
        }
      };

      // Generate video with retries
      let result: GenerationResult | null = null;
      for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
        try {
          result = await this.model.generate(
            request.prompt,
            request.resolution,
            request.frameCount,
            generationConfig
          );
          break;
        } catch (error) {
          if (attempt === RETRY_ATTEMPTS) throw error;
          this.logger.warn(`Generation attempt ${attempt} failed, retrying...`, {
            requestId: request.id,
            error
          });
        }
      }

      if (!result) {
        throw new Error('Generation failed after all retry attempts');
      }

      // Post-generation safety check
      const postCheckStart = Date.now();
      const postCheckResult = await this.postGuard.check(result.videoData);
      this.safetyCheckDuration.observe((Date.now() - postCheckStart) / 1000);

      if (!postCheckResult.passed) {
        this.failureCounter.inc();
        throw new Error(`Post-generation safety check failed: ${postCheckResult.details}`);
      }

      // Store generated video
      const outputPath = await this.storage.store(result.videoData, {
        requestId: request.id,
        metadata: result.metadata
      });

      // Track generation duration
      const duration = Date.now() - startTime;
      this.generationDuration.observe(duration / 1000);

      // Check SLO compliance
      if (duration > PERFORMANCE_SLO_MS) {
        this.logger.warn('Generation exceeded SLO threshold', {
          requestId: request.id,
          duration,
          threshold: PERFORMANCE_SLO_MS
        });
      }

      // Prepare response
      const response: IGenerationResponse = {
        requestId: request.id,
        status: ProcessingStatus.COMPLETED,
        outputPath,
        generationTime: duration,
        safetyResults: [preCheckResult, postCheckResult],
        performanceMetrics: {
          generationTimeMs: duration,
          framesPerSecond: result.metadata.fps,
          gpuMemoryUsed: result.performance.gpuMemoryUsage,
          gpuUtilization: result.performance.throughput,
          modelLoadTime: 0, // Set by model implementation
          tokenizationTime: 0, // Set by model implementation
          inferenceTime: duration,
          postProcessingTime: postCheckResult.duration
        }
      };

      return response;

    } catch (error) {
      this.failureCounter.inc();
      this.logger.error('Generation failed', {
        requestId: request.id,
        error
      });

      throw error;
    }
  }

  /**
   * Validates generation request parameters
   * @param request Request to validate
   * @returns Validation result with details
   */
  private async validateRequest(request: IGenerationRequest): Promise<ValidationResult> {
    if (!isValidGenerationRequest(request)) {
      return { isValid: false, error: 'Invalid request format' };
    }

    // Validate frame count
    if (request.frameCount > MAX_FRAME_COUNT) {
      return { 
        isValid: false, 
        error: `Frame count ${request.frameCount} exceeds maximum ${MAX_FRAME_COUNT}` 
      };
    }

    // Validate resolution
    if (!request.resolution.validate()) {
      return { isValid: false, error: 'Invalid resolution' };
    }

    // Validate model capabilities
    if (!this.model.validateCapabilities(
      request.resolution,
      request.frameCount,
      1 // batch size
    )) {
      return { isValid: false, error: 'Request exceeds model capabilities' };
    }

    // Validate multi-view configuration
    if (request.multiViewConfig.enabled) {
      if (request.multiViewConfig.viewCount > MAX_VIEWS) {
        return {
          isValid: false,
          error: `View count ${request.multiViewConfig.viewCount} exceeds maximum ${MAX_VIEWS}`
        };
      }
    }

    return { isValid: true };
  }

  /**
   * Retrieves current performance metrics
   * @returns Object containing performance metrics
   */
  public async getMetrics(): Promise<Record<string, number>> {
    return this.metrics.getMetricsAsJSON();
  }
}

interface ValidationResult {
  isValid: boolean;
  error?: string;
}

interface IGuard {
  check(data: any): Promise<SafetyCheckResult>;
}

interface SafetyCheckResult {
  passed: boolean;
  details: Record<string, any>;
  duration: number;
}

interface StorageService {
  store(data: Uint8Array, options: StorageOptions): Promise<string>;
}

interface StorageOptions {
  requestId: UUID;
  metadata: Record<string, any>;
}