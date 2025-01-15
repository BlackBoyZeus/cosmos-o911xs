import { Worker } from 'worker_threads';
import { Logger } from 'winston'; // v3.8.0
import { ITrainer, DistributedConfig, TrainingMetrics } from '../../core/models/interfaces/ITrainer';
import { ModelService } from '../../services/ModelService';
import { 
  initializeGPU, 
  getGPUMetrics, 
  allocateGPUMemory, 
  releaseGPUMemory 
} from '../../utils/gpu';
import { GPUConfig } from '../../types/config';
import { ProcessingStatus } from '../../types/common';

// Constants for resource management and monitoring
const DEFAULT_WORKER_OPTIONS = {
  workerData: {
    gpuIndex: 0,
    memoryLimit: 0.9,
    optimizationStrategy: 'dynamic'
  }
};

const CHECKPOINT_INTERVAL_MS = 300000; // 5 minutes
const GPU_HEALTH_CHECK_INTERVAL_MS = 60000; // 1 minute
const MEMORY_OPTIMIZATION_THRESHOLD = 0.85;
const DISTRIBUTED_SYNC_INTERVAL_MS = 5000;

/**
 * Enhanced worker class for handling distributed model training tasks
 * with advanced GPU resource management and monitoring
 */
export class TrainingWorker {
  private worker: Worker | null = null;
  private logger: Logger;
  private gpuMetrics: Map<number, any>;
  private memoryOptimizer: NodeJS.Timeout | null = null;
  private healthMonitor: NodeJS.Timeout | null = null;
  private trainingStatus: ProcessingStatus = ProcessingStatus.PENDING;

  constructor(
    private readonly modelService: ModelService,
    private readonly trainer: ITrainer,
    private readonly distributedConfig: DistributedConfig
  ) {
    // Initialize logger
    this.logger = new Logger({
      level: 'info',
      format: Logger.format.combine(
        Logger.format.timestamp(),
        Logger.format.json()
      ),
      transports: [
        new Logger.transports.Console(),
        new Logger.transports.File({ filename: 'training-worker.log' })
      ]
    });

    this.gpuMetrics = new Map();
  }

  /**
   * Start distributed model training process with GPU optimization
   */
  public async startTraining(
    config: TrainingConfig,
    datasetPath: string,
    gpuStrategy: GPUConfig
  ): Promise<void> {
    try {
      this.trainingStatus = ProcessingStatus.PROCESSING;
      this.logger.info('Initializing training worker', { 
        distributedConfig: this.distributedConfig,
        gpuStrategy 
      });

      // Initialize GPU resources
      await this.initializeGPUResources(gpuStrategy);

      // Start GPU monitoring
      this.startResourceMonitoring();

      // Initialize distributed training environment
      await this.trainer.initializeDistributedTraining(this.distributedConfig);

      // Create worker thread for training
      this.worker = new Worker('./training.worker.js', {
        ...DEFAULT_WORKER_OPTIONS,
        workerData: {
          ...DEFAULT_WORKER_OPTIONS.workerData,
          distributedConfig: this.distributedConfig,
          gpuStrategy
        }
      });

      // Setup worker message handling
      this.setupWorkerHandlers();

      // Start training process
      await this.modelService.trainModel(
        config,
        datasetPath,
        this.distributedConfig
      );

      this.trainingStatus = ProcessingStatus.COMPLETED;
      this.logger.info('Training completed successfully');
    } catch (error) {
      this.trainingStatus = ProcessingStatus.FAILED;
      this.logger.error('Training failed', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Stop training process and cleanup resources
   */
  public async stopTraining(): Promise<void> {
    try {
      this.logger.info('Stopping training worker');
      this.trainingStatus = ProcessingStatus.CANCELLED;

      if (this.worker) {
        this.worker.terminate();
        this.worker = null;
      }

      await this.cleanup();
      this.logger.info('Training worker stopped successfully');
    } catch (error) {
      this.logger.error('Error stopping training worker', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get comprehensive training status with GPU metrics
   */
  public async getTrainingStatus(): Promise<{
    status: ProcessingStatus;
    metrics: TrainingMetrics;
    gpuMetrics: Map<number, any>;
  }> {
    const metrics = this.trainer.getTrainingMetrics();
    return {
      status: this.trainingStatus,
      metrics,
      gpuMetrics: this.gpuMetrics
    };
  }

  /**
   * Initialize GPU resources with optimization settings
   */
  private async initializeGPUResources(gpuStrategy: GPUConfig): Promise<void> {
    try {
      await initializeGPU(gpuStrategy);
      
      // Allocate memory for each GPU
      for (let deviceId = 0; deviceId < gpuStrategy.deviceCount; deviceId++) {
        const memoryLimit = gpuStrategy.memoryLimit * 1024 * 1024 * 1024; // Convert to bytes
        await allocateGPUMemory(deviceId, memoryLimit);
      }
    } catch (error) {
      this.logger.error('GPU initialization failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Start GPU resource monitoring and optimization
   */
  private startResourceMonitoring(): void {
    // Monitor GPU health
    this.healthMonitor = setInterval(async () => {
      try {
        for (let deviceId = 0; deviceId < this.distributedConfig.worldSize; deviceId++) {
          const metrics = await getGPUMetrics(deviceId);
          this.gpuMetrics.set(deviceId, metrics);

          // Check for memory optimization needs
          if (metrics.utilizationPercent > MEMORY_OPTIMIZATION_THRESHOLD * 100) {
            await this.optimizeMemoryUsage(deviceId);
          }
        }
      } catch (error) {
        this.logger.error('GPU monitoring error', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }, GPU_HEALTH_CHECK_INTERVAL_MS);
  }

  /**
   * Optimize GPU memory usage for given device
   */
  private async optimizeMemoryUsage(deviceId: number): Promise<void> {
    try {
      await releaseGPUMemory(deviceId);
      const metrics = await getGPUMetrics(deviceId);
      const memoryLimit = metrics.memoryTotal * MEMORY_OPTIMIZATION_THRESHOLD;
      await allocateGPUMemory(deviceId, memoryLimit);
    } catch (error) {
      this.logger.error('Memory optimization failed', {
        deviceId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Setup worker thread message handlers
   */
  private setupWorkerHandlers(): void {
    if (!this.worker) return;

    this.worker.on('message', (message: any) => {
      this.logger.info('Worker message received', { message });
    });

    this.worker.on('error', (error: Error) => {
      this.logger.error('Worker error', { error: error.message });
      this.trainingStatus = ProcessingStatus.FAILED;
    });

    this.worker.on('exit', (code: number) => {
      this.logger.info('Worker exited', { code });
      if (code !== 0) {
        this.trainingStatus = ProcessingStatus.FAILED;
      }
    });
  }

  /**
   * Cleanup resources and monitoring
   */
  private async cleanup(): Promise<void> {
    if (this.healthMonitor) {
      clearInterval(this.healthMonitor);
      this.healthMonitor = null;
    }

    if (this.memoryOptimizer) {
      clearInterval(this.memoryOptimizer);
      this.memoryOptimizer = null;
    }

    // Release GPU resources
    for (let deviceId = 0; deviceId < this.distributedConfig.worldSize; deviceId++) {
      try {
        await releaseGPUMemory(deviceId);
      } catch (error) {
        this.logger.error('Error releasing GPU memory', {
          deviceId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    this.gpuMetrics.clear();
  }
}