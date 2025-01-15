import { Request, Response } from 'express'; // ^4.18.0
import asyncHandler from 'express-async-handler'; // ^1.2.0
import correlator from 'express-correlation-id'; // ^1.0.0
import { 
  IGenerationRequest, 
  IGenerationResponse, 
  IGenerationMetrics, 
  IGenerationError 
} from '../../interfaces/IGeneration';
import { GenerationService } from '../../services/GenerationService';
import { validateGenerationRequestMiddleware } from '../middleware/validator';
import { MetricsService } from '@cosmos/metrics'; // ^1.0.0
import { Logger } from '../../utils/logger';

/**
 * Controller handling video generation API endpoints
 * Implements comprehensive request validation, error handling, metrics tracking, and safety checks
 */
export class GenerationController {
  private readonly logger: Logger;

  constructor(
    private readonly generationService: GenerationService,
    private readonly metricsService: MetricsService
  ) {
    this.logger = Logger.getInstance();
  }

  /**
   * Handle POST request for video generation with comprehensive validation and safety checks
   */
  @asyncHandler
  @validateGenerationRequestMiddleware
  public async generateVideo(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const correlationId = correlator.getId();

    try {
      const request = req.body as IGenerationRequest;

      // Log request details
      this.logger.info('Video generation request received', {
        correlationId,
        requestId: request.id,
        modelType: request.modelType,
        resolution: `${request.resolution.width}x${request.resolution.height}`,
        frameCount: request.frameCount
      });

      // Start generation process
      const generationResponse = await this.generationService.generateVideo(request);

      // Calculate metrics
      const duration = Date.now() - startTime;
      this.metricsService.recordGenerationMetrics(duration, {
        modelType: request.modelType,
        resolution: `${request.resolution.width}x${request.resolution.height}`,
        frameCount: request.frameCount,
        success: true
      });

      // Check generation time against SLO
      if (duration > 600000) { // 600s SLO
        this.logger.warn('Generation time exceeded SLO', {
          correlationId,
          requestId: request.id,
          duration,
          sloThreshold: 600000
        });
      }

      // Send response
      res.status(202).json({
        requestId: request.id,
        status: generationResponse.status,
        correlationId,
        outputPath: generationResponse.outputPath,
        generationTime: duration,
        safetyResults: generationResponse.safetyResults,
        performanceMetrics: generationResponse.performanceMetrics
      });

    } catch (error) {
      // Record error metrics
      this.metricsService.recordGenerationMetrics(Date.now() - startTime, {
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false
      });

      // Log error details
      this.logger.error('Video generation failed', {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });

      // Send error response
      const statusCode = error.name === 'ValidationError' ? 400 : 500;
      res.status(statusCode).json({
        error: {
          message: error instanceof Error ? error.message : 'Internal server error',
          code: error.name || 'INTERNAL_ERROR',
          correlationId,
          timestamp: new Date().toISOString(),
          details: error.details || {},
          remediation: this.getRemediationSuggestion(error)
        }
      });
    }
  }

  /**
   * Handle GET request for checking generation status with detailed metrics
   */
  @asyncHandler
  public async getGenerationStatus(req: Request, res: Response): Promise<void> {
    const correlationId = correlator.getId();
    const requestId = req.params.requestId;

    try {
      // Validate request ID
      if (!requestId) {
        throw new Error('Request ID is required');
      }

      // Get generation status
      const status = await this.generationService.getGenerationStatus(requestId);

      // Log status check
      this.logger.info('Generation status checked', {
        correlationId,
        requestId,
        status: status.status
      });

      // Send response
      res.status(200).json({
        requestId,
        status: status.status,
        correlationId,
        outputPath: status.outputPath,
        generationTime: status.generationTime,
        safetyResults: status.safetyResults,
        performanceMetrics: status.performanceMetrics,
        warnings: status.warnings
      });

    } catch (error) {
      // Log error
      this.logger.error('Failed to get generation status', {
        correlationId,
        requestId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Send error response
      const statusCode = error.name === 'NotFoundError' ? 404 : 500;
      res.status(statusCode).json({
        error: {
          message: error instanceof Error ? error.message : 'Internal server error',
          code: error.name || 'INTERNAL_ERROR',
          correlationId,
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * Get remediation suggestion based on error type
   */
  private getRemediationSuggestion(error: Error): string {
    switch (error.name) {
      case 'ValidationError':
        return 'Please check the request parameters and ensure they meet the requirements';
      case 'ResourceExhaustedError':
        return 'Try reducing the frame count or resolution, or try again later';
      case 'SafetyCheckError':
        return 'Please review the content safety guidelines and adjust your request';
      default:
        return 'Please try again later or contact support if the issue persists';
    }
  }
}