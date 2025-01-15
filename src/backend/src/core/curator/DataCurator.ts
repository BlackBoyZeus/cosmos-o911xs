import { IVideo } from '../../interfaces/IVideo';
import { VideoProcessor } from './VideoProcessor';
import { VideoQualityAssessor } from './VideoQualityAssessor';
import { AutomaticAnnotator } from './annotators/AutomaticAnnotator';
import { Deduplicator } from './deduplication/Deduplicator';
import { Logger } from 'winston'; // v3.8.0
import { Queue } from 'bull'; // v4.10.0
import * as prometheus from 'prom-client'; // v14.0.0
import { ProcessingStatus } from '../../types/common';

interface RetryPolicy {
  maxAttempts: number;
  backoff: number;
  timeout: number;
}

interface DataCuratorConfig {
  gpuDeviceId: number;
  batchSize: number;
  maxConcurrent: number;
  qualityThresholds: {
    minPSNR: number;
    minSSIM: number;
    maxFID: number;
    maxFVD: number;
  };
  retryPolicies: Record<string, RetryPolicy>;
}

/**
 * Core data curation component that orchestrates the video processing pipeline
 * with GPU acceleration and high-throughput batch processing capabilities
 */
export class DataCurator {
  private readonly videoProcessor: VideoProcessor;
  private readonly qualityAssessor: VideoQualityAssessor;
  private readonly annotator: AutomaticAnnotator;
  private readonly deduplicator: Deduplicator;
  private readonly processingQueue: Queue;
  private readonly logger: Logger;
  private readonly retryPolicies: Map<string, RetryPolicy>;

  // Prometheus metrics
  private readonly processedVideosCounter: prometheus.Counter;
  private readonly processingDuration: prometheus.Histogram;
  private readonly batchSizeGauge: prometheus.Gauge;
  private readonly queueLengthGauge: prometheus.Gauge;
  private readonly errorCounter: prometheus.Counter;

  constructor(config: DataCuratorConfig) {
    // Initialize logger
    this.logger = new Logger({
      level: 'info',
      format: Logger.format.json(),
      defaultMeta: { service: 'data-curator' }
    });

    // Initialize components
    this.videoProcessor = new VideoProcessor({
      maxConcurrent: config.maxConcurrent,
      gpuDeviceId: config.gpuDeviceId,
      outputQuality: 90
    });

    this.qualityAssessor = new VideoQualityAssessor({
      minPSNR: config.qualityThresholds.minPSNR,
      minSSIM: config.qualityThresholds.minSSIM,
      maxFID: config.qualityThresholds.maxFID,
      maxFVD: config.qualityThresholds.maxFVD,
      gpuDeviceId: config.gpuDeviceId
    });

    this.annotator = new AutomaticAnnotator({
      batchSize: config.batchSize,
      gpuDeviceId: config.gpuDeviceId
    });

    this.deduplicator = new Deduplicator({
      similarityThreshold: 0.95,
      batchSize: config.batchSize,
      maxCacheSize: 10000,
      retryAttempts: 3,
      deviceId: config.gpuDeviceId
    });

    // Initialize processing queue
    this.processingQueue = new Queue('video-processing', {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379')
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000
        }
      }
    });

    // Initialize retry policies
    this.retryPolicies = new Map(Object.entries(config.retryPolicies));

    // Initialize Prometheus metrics
    this.processedVideosCounter = new prometheus.Counter({
      name: 'cosmos_wfm_processed_videos_total',
      help: 'Total number of processed videos',
      labelNames: ['status']
    });

    this.processingDuration = new prometheus.Histogram({
      name: 'cosmos_wfm_processing_duration_seconds',
      help: 'Video processing duration in seconds',
      buckets: [60, 120, 300, 600, 900]
    });

    this.batchSizeGauge = new prometheus.Gauge({
      name: 'cosmos_wfm_batch_size_current',
      help: 'Current batch processing size'
    });

    this.queueLengthGauge = new prometheus.Gauge({
      name: 'cosmos_wfm_queue_length_current',
      help: 'Current processing queue length'
    });

    this.errorCounter = new prometheus.Counter({
      name: 'cosmos_wfm_processing_errors_total',
      help: 'Total number of processing errors',
      labelNames: ['type']
    });
  }

  /**
   * Process a single video through the complete curation pipeline
   */
  public async processVideo(video: IVideo): Promise<IVideo> {
    const startTime = Date.now();
    const end = this.processingDuration.startTimer();

    try {
      this.logger.info('Starting video processing', { videoId: video.id });
      video.status = ProcessingStatus.PROCESSING;

      // Add to processing queue
      await this.processingQueue.add('process', { videoId: video.id });
      this.queueLengthGauge.inc();

      // Process video with GPU acceleration
      video = await this.videoProcessor.processVideo(video);

      // Assess video quality
      const qualityMetrics = await this.qualityAssessor.assessQuality(video);
      video.quality = qualityMetrics;

      if (!this.qualityAssessor.isQualityAcceptable(qualityMetrics)) {
        throw new Error('Video quality below acceptable thresholds');
      }

      // Generate annotations
      video = await this.annotator.annotateVideo(video);

      // Check for duplicates
      const isDuplicate = await this.deduplicator.isDuplicate(video);
      if (isDuplicate) {
        throw new Error('Duplicate video detected');
      }

      // Update status and metrics
      video.status = ProcessingStatus.COMPLETED;
      this.processedVideosCounter.labels('success').inc();

      this.logger.info('Video processing completed', {
        videoId: video.id,
        duration: Date.now() - startTime
      });

      return video;

    } catch (error) {
      await this.handleProcessingError(error, video);
      throw error;

    } finally {
      end();
      this.queueLengthGauge.dec();
    }
  }

  /**
   * Process a batch of videos in parallel with GPU acceleration
   */
  public async processBatch(videos: IVideo[]): Promise<IVideo[]> {
    const startTime = Date.now();
    this.batchSizeGauge.set(videos.length);

    try {
      this.logger.info('Starting batch processing', { batchSize: videos.length });

      // Process videos in parallel batches
      const processedVideos = await Promise.all(
        videos.map(video => this.processVideo(video))
      );

      // Filter out failed videos
      const successfulVideos = processedVideos.filter(
        video => video.status === ProcessingStatus.COMPLETED
      );

      this.logger.info('Batch processing completed', {
        totalVideos: videos.length,
        successfulVideos: successfulVideos.length,
        duration: Date.now() - startTime
      });

      return successfulVideos;

    } catch (error) {
      this.logger.error('Batch processing failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        batchSize: videos.length
      });
      this.errorCounter.labels('batch_processing').inc();
      throw error;

    } finally {
      this.batchSizeGauge.set(0);
    }
  }

  /**
   * Handle processing errors with retry policies
   */
  private async handleProcessingError(error: Error, video: IVideo): Promise<void> {
    this.logger.error('Processing error occurred', {
      error: error.message,
      videoId: video.id
    });

    video.status = ProcessingStatus.FAILED;
    video.errorMessage = error.message;

    this.processedVideosCounter.labels('error').inc();
    this.errorCounter.labels(error.name).inc();

    // Apply retry policy if available
    const retryPolicy = this.retryPolicies.get(error.name);
    if (retryPolicy && video.metadata.attempts < retryPolicy.maxAttempts) {
      video.metadata.attempts = (video.metadata.attempts || 0) + 1;
      await this.processingQueue.add(
        'retry',
        { videoId: video.id },
        {
          delay: retryPolicy.backoff * video.metadata.attempts,
          timeout: retryPolicy.timeout
        }
      );
    }
  }
}