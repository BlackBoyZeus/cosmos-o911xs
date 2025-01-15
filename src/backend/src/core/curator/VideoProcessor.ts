import { IVideo } from '../../interfaces/IVideo';
import { MetricsCollector } from '../../utils/metrics';
import { Logger } from 'winston';
import * as cv2 from 'opencv-python';
import * as ffmpeg from 'fluent-ffmpeg';
import { GPUUtils } from 'nvidia-smi';
import { SecurityUtils } from '@cosmos/security-utils';
import { ProcessingStatus, VideoResolution } from '../../types/common';

// Constants for video processing
const BATCH_SIZE = 32;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;
const SUPPORTED_FORMATS = ['mp4', 'mov', 'avi'];
const TARGET_FORMAT = 'mp4';
const DEFAULT_CODEC = 'h264';

/**
 * Enhanced video processor with GPU optimization and performance monitoring
 */
export class VideoProcessor {
  private readonly logger: Logger;
  private readonly metricsCollector: MetricsCollector;
  private readonly securityUtils: SecurityUtils;
  private readonly gpuUtils: GPUUtils;
  private readonly processingQueue: Map<string, Promise<void>>;

  constructor(
    private readonly config: {
      maxConcurrent: number;
      gpuMemoryLimit: number;
      targetResolution: VideoResolution;
      outputQuality: number;
    },
    metricsCollector: MetricsCollector,
    securityUtils: SecurityUtils,
    gpuUtils: GPUUtils
  ) {
    this.logger = Logger.getInstance();
    this.metricsCollector = metricsCollector;
    this.securityUtils = securityUtils;
    this.gpuUtils = gpuUtils;
    this.processingQueue = new Map();
  }

  /**
   * Process video with GPU acceleration and performance monitoring
   */
  public async processVideo(video: IVideo): Promise<IVideo> {
    const startTime = Date.now();
    let gpuAllocated = false;

    try {
      // Validate input video
      await this.validateVideo(video);

      // Update status to processing
      video.status = ProcessingStatus.PROCESSING;

      // Allocate GPU resources
      await this.allocateGPUResources();
      gpuAllocated = true;

      // Start metrics collection
      const processingMetrics = {
        videoId: video.id,
        startTime,
        gpuDevice: await this.gpuUtils.getCurrentDevice(),
      };

      // Standardize video format
      const standardizedPath = await this.standardizeFormat(video);
      video.path = standardizedPath;

      // Extract and process frames in batches
      const frames = await this.extractFrames(video.path, video.fps, {
        batchSize: BATCH_SIZE,
        gpuMemoryLimit: this.config.gpuMemoryLimit
      });

      // Process frames with GPU acceleration
      const processedFrames = await this.processFramesInParallel(frames);

      // Update video metadata
      video.metadata = {
        ...video.metadata,
        processingDuration: Date.now() - startTime,
        gpuUtilization: await this.gpuUtils.getUtilization(),
        frameCount: frames.length,
        outputQuality: this.config.outputQuality
      };

      // Update status to completed
      video.status = ProcessingStatus.COMPLETED;

      // Record metrics
      await this.recordProcessingMetrics(video, processingMetrics);

      return video;

    } catch (error) {
      // Handle processing failure
      video.status = ProcessingStatus.FAILED;
      video.errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.logger.error('Video processing failed', {
        videoId: video.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      });

      throw error;

    } finally {
      // Release GPU resources
      if (gpuAllocated) {
        await this.releaseGPUResources();
      }
    }
  }

  /**
   * Standardize video format with GPU acceleration
   */
  private async standardizeFormat(video: IVideo): Promise<string> {
    const startTime = Date.now();

    try {
      if (!SUPPORTED_FORMATS.includes(video.format)) {
        throw new Error(`Unsupported video format: ${video.format}`);
      }

      const outputPath = `${video.path}.${TARGET_FORMAT}`;

      await new Promise<void>((resolve, reject) => {
        ffmpeg(video.path)
          .videoCodec(DEFAULT_CODEC)
          .size(`${this.config.targetResolution.width}x${this.config.targetResolution.height}`)
          .outputOptions(['-hwaccel cuda', '-preset fast'])
          .output(outputPath)
          .on('end', () => resolve())
          .on('error', (err) => reject(err))
          .run();
      });

      this.metricsCollector.recordProcessingMetrics({
        operation: 'format_standardization',
        duration: Date.now() - startTime,
        inputFormat: video.format,
        outputFormat: TARGET_FORMAT
      });

      return outputPath;

    } catch (error) {
      this.logger.error('Format standardization failed', {
        videoId: video.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Extract frames with parallel processing and GPU optimization
   */
  private async extractFrames(
    videoPath: string,
    frameRate: number,
    options: { batchSize: number; gpuMemoryLimit: number }
  ): Promise<Buffer[]> {
    const frames: Buffer[] = [];
    const cap = new cv2.VideoCapture(videoPath);
    const totalFrames = cap.get(cv2.CAP_PROP_FRAME_COUNT);
    const batches = Math.ceil(totalFrames / options.batchSize);

    for (let i = 0; i < batches; i++) {
      const batchFrames = await this.extractFrameBatch(
        cap,
        i * options.batchSize,
        Math.min(options.batchSize, totalFrames - i * options.batchSize)
      );
      frames.push(...batchFrames);

      // Monitor GPU memory
      const gpuMemory = await this.gpuUtils.getMemoryInfo();
      if (gpuMemory.used > options.gpuMemoryLimit) {
        await this.releaseGPUResources();
        await this.allocateGPUResources();
      }
    }

    cap.release();
    return frames;
  }

  /**
   * Process frames in parallel with GPU acceleration
   */
  private async processFramesInParallel(frames: Buffer[]): Promise<Buffer[]> {
    const processedFrames: Buffer[] = [];
    const batches = this.chunkArray(frames, BATCH_SIZE);

    for (const batch of batches) {
      const batchPromises = batch.map(frame =>
        this.processFrame(frame, {
          quality: this.config.outputQuality,
          gpuAcceleration: true
        })
      );

      const batchResults = await Promise.all(batchPromises);
      processedFrames.push(...batchResults);
    }

    return processedFrames;
  }

  /**
   * Process individual frame with GPU optimization
   */
  private async processFrame(
    frameData: Buffer,
    options: { quality: number; gpuAcceleration: boolean }
  ): Promise<Buffer> {
    const startTime = Date.now();

    try {
      const frame = cv2.imdecode(frameData);
      
      // Apply GPU-accelerated processing
      if (options.gpuAcceleration) {
        frame.uploadToGpu();
        
        // Apply processing operations
        cv2.cuda.fastNlMeansDenoisingColored(frame, null, 10, 10, 7, 21);
        cv2.cuda.resize(frame, frame, this.config.targetResolution);
        
        frame.downloadFromGpu();
      }

      const processed = cv2.imencode(
        '.jpg',
        frame,
        [cv2.IMWRITE_JPEG_QUALITY, options.quality]
      );

      this.metricsCollector.recordProcessingMetrics({
        operation: 'frame_processing',
        duration: Date.now() - startTime,
        gpuAccelerated: options.gpuAcceleration
      });

      return Buffer.from(processed);

    } catch (error) {
      this.logger.error('Frame processing failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      });
      throw error;
    }
  }

  // Helper methods
  private async validateVideo(video: IVideo): Promise<void> {
    if (!video.path || !video.format) {
      throw new Error('Invalid video data: missing path or format');
    }

    const integrity = await this.securityUtils.validateFileIntegrity(video.path);
    if (!integrity.valid) {
      throw new Error(`Video integrity check failed: ${integrity.reason}`);
    }
  }

  private async allocateGPUResources(): Promise<void> {
    await this.gpuUtils.allocateMemory(this.config.gpuMemoryLimit);
    this.metricsCollector.recordGPUMetrics({
      operation: 'allocate',
      memoryAllocated: this.config.gpuMemoryLimit
    });
  }

  private async releaseGPUResources(): Promise<void> {
    await this.gpuUtils.releaseMemory();
    this.metricsCollector.recordGPUMetrics({
      operation: 'release'
    });
  }

  private async recordProcessingMetrics(
    video: IVideo,
    metrics: Record<string, any>
  ): Promise<void> {
    this.metricsCollector.recordProcessingMetrics({
      videoId: video.id,
      duration: Date.now() - metrics.startTime,
      gpuUtilization: await this.gpuUtils.getUtilization(),
      memoryUsage: await this.gpuUtils.getMemoryInfo(),
      status: video.status
    });
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    return Array.from({ length: Math.ceil(array.length / size) }, (_, i) =>
      array.slice(i * size, i * size + size)
    );
  }
}