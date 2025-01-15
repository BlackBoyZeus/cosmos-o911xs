import { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import { IDataset } from '../../interfaces/IDataset';
import { DatasetService } from '../../services/DatasetService';
import { Logger } from '../../utils/logger';
import { ProcessingStatus } from '../../types/common';

// Rate limiting configuration
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: 'Too many requests from this IP, please try again later'
});

/**
 * Controller handling dataset-related HTTP endpoints with comprehensive validation,
 * monitoring and error handling capabilities
 */
export class DatasetController {
  private readonly logger: Logger;
  private readonly correlationIdKey = 'x-correlation-id';

  constructor(private readonly datasetService: DatasetService) {
    this.logger = Logger.getInstance();
  }

  /**
   * Creates a new dataset with enhanced validation and monitoring
   * @route POST /api/v1/datasets
   */
  public async createDataset(req: Request, res: Response): Promise<void> {
    const correlationId = req.headers[this.correlationIdKey] || crypto.randomUUID();
    const startTime = Date.now();

    try {
      this.logger.info('Creating dataset', {
        correlationId,
        body: req.body
      });

      // Validate request body
      if (!req.body.name || !req.body.version) {
        throw new Error('Missing required fields: name and version');
      }

      // Create dataset
      const dataset = await this.datasetService.createDataset({
        name: req.body.name,
        description: req.body.description,
        version: req.body.version,
        resolution: req.body.resolution,
        status: ProcessingStatus.PENDING
      });

      // Log success
      this.logger.info('Dataset created successfully', {
        correlationId,
        datasetId: dataset.id,
        duration: Date.now() - startTime
      });

      res.status(201).json({
        success: true,
        data: dataset
      });

    } catch (error) {
      this.logger.error('Dataset creation failed', {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      });

      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Dataset creation failed'
      });
    }
  }

  /**
   * Processes a dataset with enhanced batch support and monitoring
   * @route POST /api/v1/datasets/:id/process
   */
  public async processDataset(req: Request, res: Response): Promise<void> {
    const correlationId = req.headers[this.correlationIdKey] || crypto.randomUUID();
    const startTime = Date.now();

    try {
      const datasetId = req.params.id;
      
      this.logger.info('Processing dataset', {
        correlationId,
        datasetId,
        options: req.body
      });

      // Validate dataset ID
      if (!datasetId) {
        throw new Error('Dataset ID is required');
      }

      // Configure processing options
      const options = {
        batchSize: req.body.batchSize || 32,
        maxConcurrent: req.body.maxConcurrent || 4,
        qualityThresholds: req.body.qualityThresholds || {
          minPSNR: 25.0,
          minSSIM: 0.8,
          maxFID: 50.0,
          maxFVD: 150.0
        }
      };

      // Start processing
      const dataset = await this.datasetService.processDataset(datasetId, options);

      this.logger.info('Dataset processing initiated', {
        correlationId,
        datasetId,
        status: dataset.status,
        duration: Date.now() - startTime
      });

      res.status(202).json({
        success: true,
        data: {
          id: dataset.id,
          status: dataset.status,
          trackingUrl: `/api/v1/datasets/${dataset.id}/status`
        }
      });

    } catch (error) {
      this.logger.error('Dataset processing failed', {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      });

      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Dataset processing failed'
      });
    }
  }

  /**
   * Retrieves dataset information with caching
   * @route GET /api/v1/datasets/:id
   */
  public async getDataset(req: Request, res: Response): Promise<void> {
    const correlationId = req.headers[this.correlationIdKey] || crypto.randomUUID();
    const startTime = Date.now();

    try {
      const datasetId = req.params.id;

      this.logger.info('Retrieving dataset', {
        correlationId,
        datasetId
      });

      const dataset = await this.datasetService.getDataset(datasetId, {
        forceFresh: req.query.forceFresh === 'true'
      });

      this.logger.info('Dataset retrieved successfully', {
        correlationId,
        datasetId,
        duration: Date.now() - startTime
      });

      res.status(200).json({
        success: true,
        data: dataset
      });

    } catch (error) {
      this.logger.error('Dataset retrieval failed', {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      });

      res.status(404).json({
        success: false,
        error: error instanceof Error ? error.message : 'Dataset not found'
      });
    }
  }

  /**
   * Updates dataset information with validation
   * @route PUT /api/v1/datasets/:id
   */
  public async updateDataset(req: Request, res: Response): Promise<void> {
    const correlationId = req.headers[this.correlationIdKey] || crypto.randomUUID();
    const startTime = Date.now();

    try {
      const datasetId = req.params.id;

      this.logger.info('Updating dataset', {
        correlationId,
        datasetId,
        updates: req.body
      });

      const dataset = await this.datasetService.updateDataset(datasetId, req.body);

      this.logger.info('Dataset updated successfully', {
        correlationId,
        datasetId,
        duration: Date.now() - startTime
      });

      res.status(200).json({
        success: true,
        data: dataset
      });

    } catch (error) {
      this.logger.error('Dataset update failed', {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      });

      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Dataset update failed'
      });
    }
  }

  /**
   * Deletes a dataset with cleanup
   * @route DELETE /api/v1/datasets/:id
   */
  public async deleteDataset(req: Request, res: Response): Promise<void> {
    const correlationId = req.headers[this.correlationIdKey] || crypto.randomUUID();
    const startTime = Date.now();

    try {
      const datasetId = req.params.id;

      this.logger.info('Deleting dataset', {
        correlationId,
        datasetId
      });

      await this.datasetService.deleteDataset(datasetId);

      this.logger.info('Dataset deleted successfully', {
        correlationId,
        datasetId,
        duration: Date.now() - startTime
      });

      res.status(204).send();

    } catch (error) {
      this.logger.error('Dataset deletion failed', {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      });

      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Dataset deletion failed'
      });
    }
  }

  /**
   * Health check endpoint
   * @route GET /api/v1/datasets/health
   */
  public async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Health check failed'
      });
    }
  }
}