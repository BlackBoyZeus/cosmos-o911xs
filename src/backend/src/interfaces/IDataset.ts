import { VideoResolution, ProcessingStatus, VideoMetrics } from '../types/common';

/**
 * Interface defining the structure and properties of datasets in the Cosmos WFM Platform.
 * Provides comprehensive type safety and validation for dataset management throughout 
 * the data curation pipeline.
 */
export interface IDataset {
  /**
   * Unique identifier for the dataset
   */
  readonly id: string;

  /**
   * Human-readable name of the dataset
   */
  name: string;

  /**
   * Detailed description of the dataset contents and purpose
   */
  description: string;

  /**
   * Semantic version of the dataset (e.g. "1.0.0")
   */
  version: string;

  /**
   * Total size of the dataset in bytes
   */
  size: number;

  /**
   * Number of video samples in the dataset
   */
  videoCount: number;

  /**
   * Target resolution for videos in the dataset
   * @see VideoResolution for validation rules
   */
  resolution: VideoResolution;

  /**
   * Quality metrics for the dataset including PSNR, SSIM, FID and FVD scores
   * Used for quality assessment and comparison
   */
  metrics: VideoMetrics;

  /**
   * Current processing status of the dataset
   * Tracks progress through the data curation pipeline
   */
  status: ProcessingStatus;

  /**
   * Cloud storage location where dataset files are stored
   * Format: "s3://bucket-name/path" or similar cloud storage URI
   */
  storageLocation: string;

  /**
   * Timestamp when the dataset was initially created
   */
  readonly createdAt: Date;

  /**
   * Timestamp of the last modification to the dataset
   */
  updatedAt: Date;

  /**
   * Validates all dataset properties according to platform requirements
   * @returns boolean indicating if the dataset is valid
   */
  validate(): boolean;

  /**
   * Calculates the average video duration in the dataset
   * @returns number representing average duration in seconds
   */
  getAverageDuration(): number;

  /**
   * Checks if the dataset meets minimum quality thresholds
   * @returns boolean indicating if quality metrics are acceptable
   */
  meetsQualityThresholds(): boolean;

  /**
   * Gets the dataset processing progress as a percentage
   * @returns number between 0-100 indicating progress
   */
  getProcessingProgress(): number;

  /**
   * Generates a summary of the dataset properties and metrics
   * @returns string containing formatted dataset summary
   */
  getSummary(): string;
}

/**
 * Implementation of IDataset interface with validation logic
 */
export class Dataset implements IDataset {
  constructor(
    public readonly id: string,
    public name: string,
    public description: string,
    public version: string,
    public size: number,
    public videoCount: number,
    public resolution: VideoResolution,
    public metrics: VideoMetrics,
    public status: ProcessingStatus,
    public storageLocation: string,
    public readonly createdAt: Date = new Date(),
    public updatedAt: Date = new Date()
  ) {}

  validate(): boolean {
    // Validate required string fields are non-empty
    if (!this.id || !this.name || !this.description || !this.version || !this.storageLocation) {
      return false;
    }

    // Validate numeric fields are positive
    if (this.size <= 0 || this.videoCount <= 0) {
      return false;
    }

    // Validate resolution
    if (!this.resolution.validate()) {
      return false;
    }

    // Validate dates
    if (!(this.createdAt instanceof Date) || !(this.updatedAt instanceof Date)) {
      return false;
    }

    // Validate storage location format
    const validStoragePattern = /^(s3|gs|azure):\/\/[\w-]+\/.+/;
    if (!validStoragePattern.test(this.storageLocation)) {
      return false;
    }

    return true;
  }

  getAverageDuration(): number {
    // Calculate average duration based on total size and video count
    // Assuming average bitrate of 8 Mbps for HD video
    const BITS_PER_SECOND = 8_000_000;
    const totalSeconds = (this.size * 8) / (this.videoCount * BITS_PER_SECOND);
    return Math.round(totalSeconds);
  }

  meetsQualityThresholds(): boolean {
    // Quality thresholds based on technical specifications
    const MIN_PSNR = 25.0;
    const MIN_SSIM = 0.8;
    const MAX_FID = 50.0;
    const MAX_FVD = 150.0;

    return (
      this.metrics.psnr >= MIN_PSNR &&
      this.metrics.ssim >= MIN_SSIM &&
      this.metrics.fid <= MAX_FID &&
      this.metrics.fvd <= MAX_FVD
    );
  }

  getProcessingProgress(): number {
    switch (this.status) {
      case ProcessingStatus.PENDING:
        return 0;
      case ProcessingStatus.PROCESSING:
        return 50;
      case ProcessingStatus.COMPLETED:
        return 100;
      case ProcessingStatus.FAILED:
        return -1;
      default:
        return 0;
    }
  }

  getSummary(): string {
    return `Dataset: ${this.name} (v${this.version})
Videos: ${this.videoCount}
Resolution: ${this.resolution.width}x${this.resolution.height}
Size: ${(this.size / 1024 / 1024 / 1024).toFixed(2)} GB
Quality Metrics:
  PSNR: ${this.metrics.psnr.toFixed(2)}
  SSIM: ${this.metrics.ssim.toFixed(2)}
  FID: ${this.metrics.fid.toFixed(2)}
  FVD: ${this.metrics.fvd.toFixed(2)}
Status: ${this.status}`;
  }
}