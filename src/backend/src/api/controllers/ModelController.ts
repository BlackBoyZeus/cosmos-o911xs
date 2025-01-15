import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { IModel, ModelArchitecture } from '../../interfaces/IModel';
import { ModelService } from '../../services/ModelService';
import { authenticate } from '../middleware/auth';
import { logger } from '../../utils/logger';
import { validateGenerationRequest, ValidationError } from '../../utils/validation';
import { VideoResolution, ProcessingStatus, ModelType } from '../../types/common';
import { IGenerationRequest, IGenerationResponse } from '../../interfaces/IGeneration';
import { SafetyCheckType, SafetyThresholds, SafetyMetrics } from '../../types/safety';

// Constants from technical specifications
const DEFAULT_RESOLUTION = { width: 1280, height: 720 };
const DEFAULT_NUM_FRAMES = 57;
const MAX_GENERATION_TIME = 600000; // 600s
const MIN_GPU_MEMORY = 32; // GB

/**
 * Controller class for handling World Foundation Model (WFM) operations
 * Implements comprehensive API endpoints with security and monitoring
 */
export class ModelController {
  constructor(
    private readonly modelService: ModelService,
    private readonly logger: typeof logger
  ) {
    if (!modelService) {
      throw new Error('ModelService is required');
    }
  }

  /**
   * Generate synthetic video with enhanced validation and monitoring
   */
  @authenticate(['researcher', 'admin'])
  public async generateVideo(req: Request, res: Response): Promise<void> {
    const correlationId = req.headers['x-correlation-id'] as string;
    
    try {
      // Validate request parameters
      const request: IGenerationRequest = {
        id: req.body.id,
        modelType: req.body.modelType,
        prompt: req.body.prompt,
        resolution: req.body.resolution || DEFAULT_RESOLUTION,
        frameCount: req.body.frameCount || DEFAULT_NUM_FRAMES,
        safetyConfig: req.body.safetyConfig,
        multiViewConfig: req.body.multiViewConfig,
        performanceConfig: {
          maxGenerationTime: MAX_GENERATION_TIME,
          ...req.body.performanceConfig
        }
      };

      await validateGenerationRequest(request);

      // Log request details
      this.logger.info('Starting video generation', {
        correlationId,
        userId: req.user?.id,
        modelType: request.modelType,
        resolution: request.resolution,
        frameCount: request.frameCount
      });

      // Generate video with performance tracking
      const startTime = Date.now();
      const result = await this.modelService.generateVideo(
        request.prompt,
        request.resolution,
        request.frameCount,
        {
          batchSize: 1,
          guidanceScale: 7.5,
          numInferenceSteps: 50,
          safetyChecks: true
        }
      );

      // Validate generation time
      const generationTime = Date.now() - startTime;
      if (generationTime > MAX_GENERATION_TIME) {
        this.logger.warn('Generation time exceeded threshold', {
          correlationId,
          generationTime,
          threshold: MAX_GENERATION_TIME
        });
      }

      // Prepare response with detailed metrics
      const response: IGenerationResponse = {
        requestId: request.id,
        status: ProcessingStatus.COMPLETED,
        outputPath: result.outputPath,
        generationTime,
        safetyResults: result.safetyResults,
        performanceMetrics: {
          generationTimeMs: generationTime,
          framesPerSecond: request.frameCount / (generationTime / 1000),
          gpuMemoryUsed: result.performance.gpuMemoryUsage,
          gpuUtilization: result.performance.gpuUtilization,
          modelLoadTime: result.performance.modelLoadTime,
          tokenizationTime: result.performance.tokenizationTime,
          inferenceTime: result.performance.inferenceTime,
          postProcessingTime: result.performance.postProcessingTime
        }
      };

      res.status(StatusCodes.OK).json(response);

    } catch (error) {
      const errorResponse = {
        error: error instanceof ValidationError ? 'Validation Error' : 'Generation Error',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        correlationId
      };

      this.logger.error('Video generation failed', {
        correlationId,
        error: errorResponse,
        stack: error instanceof Error ? error.stack : undefined
      });

      res.status(
        error instanceof ValidationError ? 
        StatusCodes.BAD_REQUEST : 
        StatusCodes.INTERNAL_SERVER_ERROR
      ).json(errorResponse);
    }
  }

  /**
   * Handle model training request with distributed support
   */
  @authenticate(['admin'])
  public async trainModel(req: Request, res: Response): Promise<void> {
    const correlationId = req.headers['x-correlation-id'] as string;

    try {
      // Validate training configuration
      const config = {
        modelType: req.body.modelType,
        batchSize: req.body.batchSize || 32,
        learningRate: req.body.learningRate || 1e-4,
        epochs: req.body.epochs || 100
      };

      const datasetPath = req.body.datasetPath;
      if (!datasetPath) {
        throw new ValidationError('Dataset path is required');
      }

      // Initialize distributed training
      const distributedConfig = {
        worldSize: req.body.worldSize || 1,
        rank: req.body.rank || 0,
        backend: 'nccl',
        masterAddr: req.body.masterAddr || 'localhost',
        masterPort: req.body.masterPort || 29500,
        useShardedDDP: true,
        useFSDP: true,
        gradientSyncInterval: 16
      };

      const result = await this.modelService.trainModel(
        config,
        datasetPath,
        distributedConfig
      );

      res.status(StatusCodes.OK).json({
        status: ProcessingStatus.COMPLETED,
        trainingMetrics: result.performance,
        checkpoints: result.checkpoints
      });

    } catch (error) {
      const errorResponse = {
        error: error instanceof ValidationError ? 'Validation Error' : 'Training Error',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        correlationId
      };

      this.logger.error('Model training failed', {
        correlationId,
        error: errorResponse,
        stack: error instanceof Error ? error.stack : undefined
      });

      res.status(
        error instanceof ValidationError ? 
        StatusCodes.BAD_REQUEST : 
        StatusCodes.INTERNAL_SERVER_ERROR
      ).json(errorResponse);
    }
  }

  /**
   * Get detailed model performance metrics
   */
  @authenticate(['researcher', 'admin'])
  public async getPerformanceMetrics(req: Request, res: Response): Promise<void> {
    const correlationId = req.headers['x-correlation-id'] as string;

    try {
      const startTime = req.query.startTime ? new Date(req.query.startTime as string) : undefined;
      const endTime = req.query.endTime ? new Date(req.query.endTime as string) : undefined;

      const metrics = await this.modelService.getPerformanceMetrics();

      res.status(StatusCodes.OK).json({
        metrics,
        timeRange: {
          start: startTime,
          end: endTime
        }
      });

    } catch (error) {
      this.logger.error('Failed to retrieve performance metrics', {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });

      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: 'Metrics Retrieval Error',
        message: error instanceof Error ? error.message : 'Failed to retrieve metrics',
        correlationId
      });
    }
  }
}