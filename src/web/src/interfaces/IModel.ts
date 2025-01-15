// External imports
import { UUID } from 'uuid'; // v9.0.0

// Internal imports
import { VideoResolution, Status, ResourceMetrics } from '../types/common';

/**
 * Enum defining supported model types in the Cosmos WFM platform
 */
export enum ModelType {
  DIFFUSION = 'DIFFUSION',
  AUTOREGRESSIVE = 'AUTOREGRESSIVE'
}

/**
 * Interface defining model architecture details including type and scale
 */
export interface ModelArchitecture {
  type: ModelType;
  parameters: number; // Number of parameters in billions
  version: string;
}

/**
 * Interface defining model capabilities and resource limits
 */
export interface ModelCapabilities {
  maxResolution: VideoResolution;
  maxFrames: number;
  maxBatchSize: number;
}

/**
 * Interface for tracking and displaying model performance metrics
 */
export interface ModelPerformance {
  generationTime: number; // In seconds
  gpuMemoryUsage: number; // In GB
  throughput: number; // Frames per second
  psnr: number; // Peak Signal-to-Noise Ratio
  fid: number; // Fréchet Inception Distance
}

/**
 * Type definition for model filtering options in UI
 */
export type ModelFilter = {
  searchTerm?: string;
  type?: ModelType;
  status?: Status;
};

/**
 * Main interface for World Foundation Models (WFM) in the web frontend
 * Provides comprehensive model information for UI display and management
 */
export interface IModel {
  // Core identifiers
  id: UUID;
  name: string;
  description: string;

  // Technical specifications
  architecture: ModelArchitecture;
  capabilities: ModelCapabilities;
  performance: ModelPerformance;

  // Operational status
  status: Status;
  resourceMetrics?: ResourceMetrics;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}