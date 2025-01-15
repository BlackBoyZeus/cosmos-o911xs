import { z } from 'zod'; // v3.0.0
import { ModelType, VideoResolution } from '../../../types/common';
import { ModelArchitecture } from '../../../types/models';

// Constants for configuration validation
const DEFAULT_MAX_FRAMES = 57; // Maximum frames per video based on technical spec
const DEFAULT_TEMPERATURE = 0.8; // Default sampling temperature
const DEFAULT_TOP_K = 50; // Default top-k sampling parameter
const DEFAULT_TOP_P = 0.9; // Default top-p sampling parameter
const MAX_BATCH_SIZE = 32; // Maximum batch size for inference
const MIN_PARAMETERS = 4e9; // 4B parameters minimum
const MAX_PARAMETERS = 13e9; // 13B parameters maximum
const CONFIG_VERSION = '1.0.0'; // Current configuration version

/**
 * Interface defining configuration parameters for Autoregressive World Foundation Models
 * Includes architecture, resolution, sampling and generation settings
 */
export interface AutoregressiveConfig {
  // Model architecture specification
  architecture: ModelArchitecture;
  
  // Video generation constraints
  maxResolution: VideoResolution;
  maxFrames: number;
  batchSize: number;
  
  // Sampling parameters
  temperature: number;
  topK: number;
  topP: number;
  
  // Version tracking
  configVersion: string;
}

/**
 * Zod schema for validating AutoregressiveConfig
 * Enforces strict validation with detailed error messages
 */
export const validateAutoregressiveConfig = z.object({
  // Validate model architecture
  architecture: z.object({
    type: z.literal(ModelType.AUTOREGRESSIVE),
    parameters: z.number()
      .min(MIN_PARAMETERS, 'Model must have at least 4B parameters')
      .max(MAX_PARAMETERS, 'Model cannot exceed 13B parameters'),
    variant: z.string().min(1)
  }),

  // Validate resolution constraints
  maxResolution: z.object({
    width: z.number()
      .int()
      .min(1)
      .max(1920, 'Maximum supported width is 1920px'),
    height: z.number()
      .int()
      .min(1)
      .max(1080, 'Maximum supported height is 1080px')
  }),

  // Validate frame and batch settings
  maxFrames: z.number()
    .int()
    .min(1)
    .max(DEFAULT_MAX_FRAMES, `Maximum frames limited to ${DEFAULT_MAX_FRAMES}`),
  
  batchSize: z.number()
    .int()
    .min(1)
    .max(MAX_BATCH_SIZE, `Maximum batch size is ${MAX_BATCH_SIZE}`)
    .refine(
      (val) => (val & (val - 1)) === 0, 
      'Batch size must be a power of 2'
    ),

  // Validate sampling parameters
  temperature: z.number()
    .min(0, 'Temperature must be non-negative')
    .max(1, 'Temperature must not exceed 1.0')
    .default(DEFAULT_TEMPERATURE),
  
  topK: z.number()
    .int()
    .min(1, 'Top-K must be positive')
    .max(100, 'Top-K must not exceed 100')
    .default(DEFAULT_TOP_K),
  
  topP: z.number()
    .min(0, 'Top-P must be non-negative')
    .max(1, 'Top-P must not exceed 1.0')
    .default(DEFAULT_TOP_P),

  // Validate configuration version
  configVersion: z.string()
    .regex(
      /^\d+\.\d+\.\d+$/, 
      'Config version must follow semantic versioning'
    )
    .default(CONFIG_VERSION)
}).strict().refine(
  (config) => {
    // Additional validation for performance requirements
    const pixelCount = config.maxResolution.width * config.maxResolution.height;
    const maxPixels = 1920 * 1080;
    return pixelCount <= maxPixels || 
      'Resolution exceeds maximum supported pixel count';
  },
  {
    message: 'Configuration fails performance requirements'
  }
);

/**
 * Default configuration for Autoregressive WFM
 * Provides sensible defaults while maintaining performance requirements
 */
export const DEFAULT_AUTOREGRESSIVE_CONFIG: AutoregressiveConfig = {
  architecture: {
    type: ModelType.AUTOREGRESSIVE,
    parameters: 4e9, // 4B parameters
    variant: 'base'
  },
  maxResolution: {
    width: 1280,
    height: 720
  },
  maxFrames: DEFAULT_MAX_FRAMES,
  batchSize: 16,
  temperature: DEFAULT_TEMPERATURE,
  topK: DEFAULT_TOP_K,
  topP: DEFAULT_TOP_P,
  configVersion: CONFIG_VERSION
};