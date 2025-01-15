import { Queue, Job } from 'bull';
import { CircuitBreaker } from 'opossum';
import { DataCurator } from '../core/curator/DataCurator';
import { DatasetService } from '../services/DatasetService';
import { Logger } from '../utils/logger';
import { MetricsCollector } from '../utils/metrics';
import { GPUManager } from '../utils/gpu';
import { ProcessingStatus } from '../types/common';
import { IVideo } from '../interfaces/IVideo';

/**
 * Worker class that handles asynchronous data curation tasks with GPU acceleration,
 * comprehensive error handling, and performance monitoring
 */
export class DataCurationWorker {
  private readonly curationQueue: Queue;
  private readonly logger: Logger;
  private readonly circuitBreaker: CircuitBreaker;
  private isProcessing: boolean = false;
  private readonly maxRetries: number = 3;
  private readonly batchSize: number = 32;

  constructor(
    private readonly dataCurator: DataCurator,
    private readonly datasetService: DatasetService,
    private readonly metricsCollector: MetricsCollector,
    private readonly gpuManager: GPUManager,
    private readonly config: {
      queueName?: string;
      redisUrl?: string;
      concurrency?: number;
      timeout?: number;
    } = {}
  ) {
    // Initialize logger
    this.logger = Logger.getInstance();

    // Initialize job queue
    this.curationQueue = new Queue(config.queueName || 'data-curation', {
      redis: config.redisUrl || process.env.REDIS_URL,
      defaultJobOptions: {
        attempts: this.maxRetries,
        backoff: {
          type: 'exponential',
          delay: 1000
        },
        timeout: config.timeout || 3600000, // 1 hour default
        removeOnComplete: true,
        removeOnFail: false
      }
    });

    // Initialize circuit breaker
    this.circuitBreaker = new CircuitBreaker(this.processCurationJob.bind(this), {
      timeout: 300000, // 5 minutes
      resetTimeout: 30000, // 30 seconds
      errorThresholdPercentage: 50,
      volumeThreshold: 10
    });

    // Set up queue event handlers
    this.setupQueueHandlers();
  }

  /**
   * Starts the worker to process curation jobs
   */
  public async start(): Promise<void> {
    try {
      this.logger.info('Starting data curation worker', {
        queueName: this.curationQueue.name,
        concurrency: this.config.concurrency
      });

      // Initialize GPU resources
      await this.gpuManager.initializeGPU({
        deviceCount: 1,
        memoryLimit: 8 * 1024 * 1024 * 1024, // 8GB
        computeCapability: '7.0'
      });

      // Start processing jobs
      this.isProcessing = true;
      await this.curationQueue.process(
        this.config.concurrency || 1,
        async (job: Job) => {
          return this.circuitBreaker.fire(job);
        }
      );

      // Start metrics collection
      this.startMetricsCollection();

    } catch (error) {
      this.logger.error('Failed to start worker', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Gracefully stops the worker
   */
  public async stop(): Promise<void> {
    try {
      this.logger.info('Stopping data curation worker');
      this.isProcessing = false;

      // Wait for current jobs to complete
      await this.curationQueue.pause(true);
      await this.curationQueue.clean(0, 'active');

      // Release GPU resources
      await this.gpuManager.releaseGPUMemory(0);

      // Close queue connection
      await this.curationQueue.close();

      this.logger.info('Worker stopped successfully');
    } catch (error) {
      this.logger.error('Failed to stop worker', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Processes a single data curation job with GPU acceleration
   */
  private async processCurationJob(job: Job): Promise<void> {
    const startTime = Date.now();
    let gpuAllocated = false;

    try {
      this.logger.info('Processing curation job', { jobId: job.id });

      // Allocate GPU resources
      await this.gpuManager.allocateGPUMemory(0, 8 * 1024 * 1024 * 1024); // 8GB
      gpuAllocated = true;

      // Extract video and dataset info
      const { videoId, datasetId } = job.data;

      // Update dataset status
      await this.datasetService.updateDataset(datasetId, {
        status: ProcessingStatus.PROCESSING
      });

      // Process video through curator
      const result = await this.dataCurator.processVideo(job.data.video);

      // Update dataset with results
      await this.datasetService.updateDataset(datasetId, {
        status: ProcessingStatus.COMPLETED,
        metrics: result.quality
      });

      // Record metrics
      this.metricsCollector.recordGenerationMetrics(Date.now() - startTime, {
        jobId: job.id,
        videoId,
        datasetId
      });

      this.logger.info('Job completed successfully', {
        jobId: job.id,
        duration: Date.now() - startTime
      });

    } catch (error) {
      await this.handleError(error, job);
      throw error;

    } finally {
      // Release GPU resources
      if (gpuAllocated) {
        await this.gpuManager.releaseGPUMemory(0);
      }
    }
  }

  /**
   * Processes multiple curation jobs in a batch for efficiency
   */
  private async processBatch(jobs: Job[]): Promise<void> {
    const startTime = Date.now();
    let gpuAllocated = false;

    try {
      this.logger.info('Processing job batch', { batchSize: jobs.length });

      // Allocate GPU resources
      await this.gpuManager.allocateGPUMemory(0, 8 * 1024 * 1024 * 1024);
      gpuAllocated = true;

      // Group videos by dataset
      const videosByDataset = this.groupJobsByDataset(jobs);

      // Process each dataset's videos
      for (const [datasetId, videos] of videosByDataset.entries()) {
        await this.dataCurator.processBatch(videos);
        
        // Update dataset status
        await this.datasetService.updateBatchStatus(datasetId, {
          status: ProcessingStatus.COMPLETED,
          processedCount: videos.length
        });
      }

      // Record batch metrics
      this.metricsCollector.recordGenerationMetrics(Date.now() - startTime, {
        batchSize: jobs.length,
        datasetCount: videosByDataset.size
      });

    } catch (error) {
      this.logger.error('Batch processing failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        batchSize: jobs.length
      });
      throw error;

    } finally {
      if (gpuAllocated) {
        await this.gpuManager.releaseGPUMemory(0);
      }
    }
  }

  /**
   * Handles errors during job processing with retry logic
   */
  private async handleError(error: Error, job: Job): Promise<void> {
    this.logger.error('Job processing failed', {
      jobId: job.id,
      error: error.message,
      attempt: job.attemptsMade
    });

    // Update dataset status if needed
    if (job.data.datasetId) {
      await this.datasetService.updateDataset(job.data.datasetId, {
        status: ProcessingStatus.FAILED,
        error: error.message
      });
    }

    // Record error metrics
    this.metricsCollector.recordRequest('curation', 'process', 500, {
      jobId: job.id,
      error: error.message
    });

    // Implement retry logic
    if (job.attemptsMade < this.maxRetries) {
      const delay = Math.pow(2, job.attemptsMade) * 1000;
      await job.retry({ delay });
    }
  }

  /**
   * Sets up queue event handlers for monitoring
   */
  private setupQueueHandlers(): void {
    this.curationQueue.on('completed', (job) => {
      this.logger.info('Job completed', { jobId: job.id });
    });

    this.curationQueue.on('failed', (job, error) => {
      this.logger.error('Job failed', {
        jobId: job.id,
        error: error.message
      });
    });

    this.curationQueue.on('error', (error) => {
      this.logger.error('Queue error', {
        error: error.message
      });
    });
  }

  /**
   * Starts collecting performance metrics
   */
  private startMetricsCollection(): void {
    setInterval(async () => {
      const metrics = await this.gpuManager.getGPUMetrics(0);
      this.metricsCollector.recordGPUMetrics(metrics);
    }, 15000); // Every 15 seconds
  }

  /**
   * Groups jobs by dataset for batch processing
   */
  private groupJobsByDataset(jobs: Job[]): Map<string, IVideo[]> {
    const groups = new Map<string, IVideo[]>();
    
    for (const job of jobs) {
      const { datasetId, video } = job.data;
      if (!groups.has(datasetId)) {
        groups.set(datasetId, []);
      }
      groups.get(datasetId)!.push(video);
    }

    return groups;
  }
}