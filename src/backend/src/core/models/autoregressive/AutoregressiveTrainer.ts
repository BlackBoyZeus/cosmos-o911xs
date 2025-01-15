import { injectable } from 'inversify';
import * as torch from 'torch'; // v2.0.0
import * as cuda from '@nvidia/cuda-toolkit'; // v12.0.0
import { fsdp } from 'torch.distributed.fsdp'; // v2.0.0

import { ITrainer, TrainingMetrics, DistributedConfig } from '../interfaces/ITrainer';
import { AutoregressiveModel } from './AutoregressiveModel';
import { AutoregressiveConfig } from './AutoregressiveConfig';
import { TrainingConfig } from '../../../types/models';

// Constants for training configuration
const DEFAULT_LEARNING_RATE = 1e-4;
const CHECKPOINT_INTERVAL = 1000;
const VALIDATION_INTERVAL = 5000;
const MAX_GRADIENT_NORM = 1.0;

@injectable()
export class AutoregressiveTrainer implements ITrainer {
  private model: AutoregressiveModel;
  private optimizer: torch.optim.Optimizer;
  private dataLoader: torch.utils.data.DataLoader;
  private metrics: TrainingMetrics;
  private distributedSetup: boolean = false;

  constructor(private config: AutoregressiveConfig) {
    this.metrics = {
      loss: 0,
      learningRate: DEFAULT_LEARNING_RATE,
      epochProgress: 0,
      samplesProcessed: 0,
      throughputSamplesPerSecond: 0,
      gpuMemoryUsed: {
        current: 0,
        peak: 0,
        allocated: 0
      },
      gradientNorm: 0,
      distributedMetrics: {
        syncTime: 0,
        replicationFactor: 0,
        communicationOverhead: 0
      }
    };
  }

  public async train(
    model: AutoregressiveModel,
    datasetPath: string,
    config: TrainingConfig,
    distributedConfig: DistributedConfig
  ): Promise<void> {
    try {
      this.model = model;
      await this.initializeDistributedTraining(distributedConfig);
      await this.setupOptimizer(config);
      await this.setupDataLoader(datasetPath, config.batchSize);

      const gradScaler = new torch.cuda.amp.GradScaler();
      const scheduler = this.setupLRScheduler();

      for (let epoch = 0; epoch < config.epochs; epoch++) {
        await this.trainEpoch(
          epoch,
          config,
          gradScaler,
          scheduler,
          distributedConfig
        );

        if (distributedConfig.rank === 0 && epoch % VALIDATION_INTERVAL === 0) {
          await this.validateAndSaveCheckpoint(epoch, datasetPath);
        }

        this.metrics.epochProgress = (epoch + 1) / config.epochs;
        await this.synchronizeDistributed(distributedConfig);
      }
    } catch (error) {
      console.error('Training failed:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  private async trainEpoch(
    epoch: number,
    config: TrainingConfig,
    gradScaler: torch.cuda.amp.GradScaler,
    scheduler: torch.optim.lr_scheduler._LRScheduler,
    distributedConfig: DistributedConfig
  ): Promise<void> {
    this.model.train();
    let epochLoss = 0;
    const startTime = Date.now();

    for (const [i, batch] of this.dataLoader.enumerate()) {
      try {
        this.optimizer.zero_grad();

        const { input_ids, attention_mask, labels } = batch;
        
        torch.cuda.amp.autocast(async () => {
          const outputs = await this.model.forward(
            input_ids,
            attention_mask
          );
          
          const loss = torch.nn.functional.cross_entropy(
            outputs.logits.view(-1, outputs.logits.size(-1)),
            labels.view(-1)
          );

          gradScaler.scale(loss).backward();
          
          if (distributedConfig.useShardedDDP) {
            await this.reduceGradients(distributedConfig);
          }

          const gradNorm = torch.nn.utils.clip_grad_norm_(
            this.model.parameters(),
            MAX_GRADIENT_NORM
          );

          this.metrics.gradientNorm = gradNorm.item();
          epochLoss += loss.item();

          gradScaler.step(this.optimizer);
          gradScaler.update();
        });

        if (i % distributedConfig.gradientSyncInterval === 0) {
          await this.updateMetrics(startTime, i, epoch, config);
        }

      } catch (error) {
        console.error(`Error in batch ${i} of epoch ${epoch}:`, error);
        throw error;
      }
    }

    scheduler.step();
    this.metrics.loss = epochLoss / this.dataLoader.length;
  }

  private async setupOptimizer(config: TrainingConfig): Promise<void> {
    this.optimizer = new torch.optim.AdamW(
      this.model.parameters(),
      {
        lr: config.learningRate || DEFAULT_LEARNING_RATE,
        weight_decay: 0.01,
        betas: [0.9, 0.999],
        eps: 1e-8
      }
    );
  }

  private setupLRScheduler(): torch.optim.lr_scheduler._LRScheduler {
    return torch.optim.lr_scheduler.CosineAnnealingWarmRestarts(
      this.optimizer,
      T_0=5,
      T_mult=2,
      eta_min=1e-6
    );
  }

  public async evaluate(
    model: AutoregressiveModel,
    validationDatasetPath: string,
    distributedConfig: DistributedConfig
  ): Promise<ModelPerformance> {
    this.model = model;
    this.model.eval();
    
    let totalLoss = 0;
    let samples = 0;

    const validationLoader = await this.setupDataLoader(
      validationDatasetPath,
      this.config.batchSize
    );

    torch.no_grad(async () => {
      for (const batch of validationLoader) {
        const { input_ids, attention_mask, labels } = batch;
        
        const outputs = await this.model.forward(
          input_ids,
          attention_mask
        );
        
        const loss = torch.nn.functional.cross_entropy(
          outputs.logits.view(-1, outputs.logits.size(-1)),
          labels.view(-1)
        );

        totalLoss += loss.item() * input_ids.size(0);
        samples += input_ids.size(0);
      }
    });

    if (distributedConfig.useShardedDDP) {
      [totalLoss, samples] = await this.reduceMetrics(
        [totalLoss, samples],
        distributedConfig
      );
    }

    return {
      loss: totalLoss / samples,
      ...this.model.getPerformanceMetrics()
    };
  }

  public async initializeDistributedTraining(
    config: DistributedConfig
  ): Promise<void> {
    if (this.distributedSetup) return;

    torch.distributed.init_process_group({
      backend: config.backend,
      init_method: `tcp://${config.masterAddr}:${config.masterPort}`,
      world_size: config.worldSize,
      rank: config.rank
    });

    if (config.useFSDP) {
      this.model = fsdp.FullyShardedDataParallel(
        this.model,
        {
          mixed_precision: true,
          flatten_parameters: true,
          reshard_after_forward: true
        }
      );
    }

    this.distributedSetup = true;
  }

  public getTrainingMetrics(): TrainingMetrics {
    return { ...this.metrics };
  }

  private async cleanup(): Promise<void> {
    if (this.distributedSetup) {
      await torch.distributed.destroy_process_group();
      this.distributedSetup = false;
    }
    torch.cuda.empty_cache();
  }

  private async setupDataLoader(
    datasetPath: string,
    batchSize: number
  ): Promise<torch.utils.data.DataLoader> {
    const dataset = await torch.data.Dataset.from_file(datasetPath);
    
    return new torch.utils.data.DataLoader(
      dataset,
      {
        batch_size: batchSize,
        shuffle: true,
        num_workers: 4,
        pin_memory: true,
        drop_last: true
      }
    );
  }

  private async updateMetrics(
    startTime: number,
    iteration: number,
    epoch: number,
    config: TrainingConfig
  ): Promise<void> {
    const elapsed = (Date.now() - startTime) / 1000;
    const samplesProcessed = (epoch * this.dataLoader.length + iteration) * config.batchSize;
    
    this.metrics.samplesProcessed = samplesProcessed;
    this.metrics.throughputSamplesPerSecond = samplesProcessed / elapsed;
    this.metrics.learningRate = this.optimizer.param_groups[0].lr;
    
    const memoryStats = torch.cuda.memory_stats();
    this.metrics.gpuMemoryUsed = {
      current: memoryStats.allocated_bytes.all.current / (1024 ** 3),
      peak: memoryStats.allocated_bytes.all.peak / (1024 ** 3),
      allocated: memoryStats.allocated_bytes.all.allocated / (1024 ** 3)
    };
  }

  private async validateAndSaveCheckpoint(
    epoch: number,
    validationDatasetPath: string
  ): Promise<void> {
    const performance = await this.evaluate(
      this.model,
      validationDatasetPath,
      { rank: 0, worldSize: 1, backend: 'nccl' } as DistributedConfig
    );

    if (epoch % CHECKPOINT_INTERVAL === 0) {
      await torch.save({
        epoch,
        model_state_dict: this.model.state_dict(),
        optimizer_state_dict: this.optimizer.state_dict(),
        metrics: this.metrics,
        performance
      }, `checkpoints/model_epoch_${epoch}.pt`);
    }
  }

  private async synchronizeDistributed(
    config: DistributedConfig
  ): Promise<void> {
    if (config.useShardedDDP) {
      const syncStart = Date.now();
      await torch.distributed.barrier();
      this.metrics.distributedMetrics.syncTime = Date.now() - syncStart;
      this.metrics.distributedMetrics.replicationFactor = config.worldSize;
    }
  }

  private async reduceGradients(
    config: DistributedConfig
  ): Promise<void> {
    const syncStart = Date.now();
    await fsdp.reduce_gradients(this.model);
    this.metrics.distributedMetrics.communicationOverhead = Date.now() - syncStart;
  }

  private async reduceMetrics(
    metrics: number[],
    config: DistributedConfig
  ): Promise<number[]> {
    const tensor = torch.tensor(metrics).cuda();
    await torch.distributed.all_reduce(tensor);
    return tensor.div(config.worldSize).cpu().tolist();
  }
}