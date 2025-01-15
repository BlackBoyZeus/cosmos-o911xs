// External imports
// uuid v9.0.0
import { UUID } from 'uuid';

// Internal imports
import { VideoResolution, Status } from '../types/common';

/**
 * Interface defining comprehensive video quality and performance metrics for datasets
 */
export interface DatasetMetrics {
  /** Peak Signal-to-Noise Ratio - Higher values indicate better quality */
  psnr: number;
  
  /** Structural Similarity Index Measure - Range 0-1, higher is better */
  ssim: number;
  
  /** Fréchet Inception Distance - Lower values indicate better quality */
  fid: number;
  
  /** Fréchet Video Distance - Lower values indicate better temporal consistency */
  fvd: number;
  
  /** Sampson Error for 3D consistency - Lower values indicate better geometric accuracy */
  sampsonError: number;
  
  /** Pose Estimation Error in degrees - Lower values indicate better pose accuracy */
  poseEstimationError: number;
  
  /** Trajectory Following Accuracy - Range 0-1, higher indicates better physics alignment */
  trajectoryAccuracy: number;
}

/**
 * Core interface defining the structure and properties of datasets for the web frontend
 * Provides comprehensive type definitions for dataset management, monitoring, and quality metrics tracking
 */
export interface IDataset {
  /** Unique identifier for the dataset */
  id: UUID;
  
  /** Human-readable name for the dataset */
  name: string;
  
  /** Detailed description of the dataset contents and purpose */
  description: string;
  
  /** Dataset version following semantic versioning */
  version: string;
  
  /** Total size of the dataset in bytes */
  size: number;
  
  /** Total number of video samples in the dataset */
  videoCount: number;
  
  /** Standard resolution specification for videos in the dataset */
  resolution: VideoResolution;
  
  /** Current processing status of the dataset */
  status: Status;
  
  /** Comprehensive quality and performance metrics */
  metrics: DatasetMetrics;
  
  /** Dataset creation timestamp */
  createdAt: Date;
  
  /** Last modification timestamp */
  updatedAt: Date;
  
  /** Processing completion percentage (0-100) */
  processingProgress: number;
  
  /** Error details if processing failed, null otherwise */
  errorDetails: string | null;
}