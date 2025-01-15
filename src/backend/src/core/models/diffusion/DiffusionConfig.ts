import { ModelType, VideoResolution } from '../../../types/common';
import { ModelArchitecture } from '../../../types/models';

/**
 * Interface for configuring the denoising process in diffusion models
 * Defines parameters for controlling the generation quality and speed
 */
export interface DenoisingConfig {
  /** Number of denoising steps (20-100) */
  steps: number;
  
  /** Classifier-free guidance scale (1.0-20.0) */
  guidanceScale: number;
  
  /** Noise schedule type ('linear', 'cosine', 'quadratic') */
  noiseSchedule: string;

  /**
   * Validates denoising configuration parameters
   * @returns boolean indicating if configuration is valid
   */
  validateDenoising(): boolean;
}

/**
 * Interface for video generation settings with performance constraints
 * Based on technical specifications for frame count and resolution
 */
export interface GenerationConfig {
  /** Target video resolution (max 7680x7680) */
  resolution: VideoResolution;
  
  /** Number of frames to generate (max 1000) */
  numFrames: number;
  
  /** Batch size for parallel generation (1-128) */
  batchSize: number;

  /**
   * Validates generation parameters against system capabilities
   * @returns boolean indicating if configuration is valid
   */
  validateGeneration(): boolean;
}

/**
 * Main configuration interface for Diffusion World Foundation Model
 * Implements comprehensive settings for model architecture and generation
 */
export interface DiffusionConfig {
  /** Configuration version for compatibility tracking */
  version: string;
  
  /** Model architecture specifications */
  architecture: ModelArchitecture;
  
  /** Denoising process configuration */
  denoising: DenoisingConfig;
  
  /** Video generation settings */
  generation: GenerationConfig;

  /**
   * Validates complete configuration including resource requirements
   * @returns boolean indicating if configuration is valid
   */
  validate(): boolean;
}

/**
 * Default configuration values based on technical specifications
 * Optimized for 7B parameter model with 720p video generation
 */
export const DEFAULT_DIFFUSION_CONFIG: DiffusionConfig = {
  version: '1.0.0',
  architecture: {
    type: ModelType.DIFFUSION_7B,
    parameters: 7_000_000_000,
    variant: 'base'
  },
  denoising: {
    steps: 50,
    guidanceScale: 7.5,
    noiseSchedule: 'linear',
    validateDenoising(): boolean {
      return (
        this.steps >= 20 &&
        this.steps <= 100 &&
        this.guidanceScale >= 1.0 &&
        this.guidanceScale <= 20.0 &&
        ['linear', 'cosine', 'quadratic'].includes(this.noiseSchedule)
      );
    }
  },
  generation: {
    resolution: {
      width: 1280,
      height: 720,
      getAspectRatio(): number {
        return this.width / this.height;
      },
      validate(): boolean {
        return (
          this.width >= 256 &&
          this.width <= 7680 &&
          this.height >= 256 &&
          this.height <= 7680
        );
      }
    },
    numFrames: 57,
    batchSize: 1,
    validateGeneration(): boolean {
      return (
        this.resolution.validate() &&
        this.numFrames > 0 &&
        this.numFrames <= 1000 &&
        this.batchSize >= 1 &&
        this.batchSize <= 128
      );
    }
  },
  validate(): boolean {
    // Validate architecture
    const isValidArchitecture = 
      this.architecture.type === ModelType.DIFFUSION_7B ||
      this.architecture.type === ModelType.DIFFUSION_14B;

    // Validate memory requirements (based on technical specs)
    const estimatedMemoryGB = (this.architecture.parameters / 1_000_000_000) * 10;
    const isMemoryValid = estimatedMemoryGB <= 80; // Max 80GB GPU memory

    // Validate generation time constraints
    const estimatedTimePerFrame = (this.denoising.steps * 10); // ~10ms per step
    const totalEstimatedTime = estimatedTimePerFrame * this.generation.numFrames;
    const isTimeValid = totalEstimatedTime <= 600000; // Max 600s per generation

    return (
      isValidArchitecture &&
      isMemoryValid &&
      isTimeValid &&
      this.denoising.validateDenoising() &&
      this.generation.validateGeneration()
    );
  }
};

/** Current configuration schema version */
export const CONFIG_SCHEMA_VERSION = '1.0.0';

/**
 * Validates a diffusion configuration object
 * @param config DiffusionConfig object to validate
 * @returns boolean indicating if configuration is valid
 */
export function validateConfig(config: DiffusionConfig): boolean {
  try {
    return (
      config.version === CONFIG_SCHEMA_VERSION &&
      config.validate()
    );
  } catch {
    return false;
  }
}