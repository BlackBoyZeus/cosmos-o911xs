import { z } from 'zod'; // v3.22.0
import { 
  VideoResolution, 
  ProcessingStatus, 
  ModelType 
} from './common';

/**
 * Core model architecture interface defining structure and capabilities
 * of World Foundation Models (WFM)
 */
export interface ModelArchitecture {
  type: ModelType;
  parameters: number; // Billions of parameters
  variant: string; // Model variant identifier
}

/**
 * Model capabilities interface defining operational limits
 * and supported features
 */
export interface ModelCapabilities {
  maxResolution: VideoResolution;
  maxFrames: number; // Maximum frames per video
  maxBatchSize: number; // Maximum batch size for inference
}

/**
 * Comprehensive model performance metrics interface
 * for tracking and optimization
 */
export interface ModelPerformance {
  generationTime: number; // Milliseconds
  gpuMemoryUsage: number; // GB
  throughput: number; // Frames per second
  psnrScore: number; // Peak Signal-to-Noise Ratio
}

/**
 * Training configuration interface with validation rules
 * and resource requirements
 */
export interface TrainingConfig {
  batchSize: number;
  learningRate: number;
  epochs: number;
  status: ProcessingStatus;
  gpuMemoryRequired: number; // GB
  checkpointInterval: number; // Steps between checkpoints
  earlyStoppingPatience: number; // Epochs before early stopping
}

/**
 * Model validation constraints type definition
 */
type ModelValidation = {
  batchSizeRange: [number, number];
  learningRateRange: [number, number];
  memoryThreshold: number;
  performanceThreshold: number;
};

// Zod schema for ModelArchitecture validation
const modelArchitectureSchema = z.object({
  type: z.nativeEnum(ModelType),
  parameters: z.number().positive(),
  variant: z.string().min(1)
});

// Zod schema for ModelCapabilities validation
const modelCapabilitiesSchema = z.object({
  maxResolution: z.object({
    width: z.number().int().positive().max(7680),
    height: z.number().int().positive().max(7680)
  }),
  maxFrames: z.number().int().positive().max(1000),
  maxBatchSize: z.number().int().positive().max(128)
});

// Zod schema for ModelPerformance validation
const modelPerformanceSchema = z.object({
  generationTime: z.number().positive(),
  gpuMemoryUsage: z.number().positive(),
  throughput: z.number().positive(),
  psnrScore: z.number().positive().max(100)
});

// Zod schema for TrainingConfig validation
const trainingConfigSchema = z.object({
  batchSize: z.number().int().positive().max(512),
  learningRate: z.number().positive().max(1),
  epochs: z.number().int().positive(),
  status: z.nativeEnum(ProcessingStatus),
  gpuMemoryRequired: z.number().positive(),
  checkpointInterval: z.number().int().positive(),
  earlyStoppingPatience: z.number().int().positive()
});

/**
 * Type guard for validating ModelArchitecture objects
 * @param object - Object to validate
 * @returns boolean indicating if object is valid ModelArchitecture
 */
export function isValidModelArchitecture(object: unknown): object is ModelArchitecture {
  try {
    modelArchitectureSchema.parse(object);
    return true;
  } catch {
    return false;
  }
}

// Default validation constraints
export const DEFAULT_MODEL_VALIDATION: ModelValidation = {
  batchSizeRange: [1, 512],
  learningRateRange: [1e-6, 1e-3],
  memoryThreshold: 80, // GB
  performanceThreshold: 30 // PSNR threshold
};

// Model architecture constants based on technical specifications
export const MODEL_ARCHITECTURES = {
  DIFFUSION_7B: {
    type: ModelType.DIFFUSION,
    parameters: 7,
    variant: 'base'
  },
  DIFFUSION_14B: {
    type: ModelType.DIFFUSION,
    parameters: 14,
    variant: 'large'
  },
  AUTOREGRESSIVE_4B: {
    type: ModelType.AUTOREGRESSIVE,
    parameters: 4,
    variant: 'base'
  },
  AUTOREGRESSIVE_13B: {
    type: ModelType.AUTOREGRESSIVE,
    parameters: 13,
    variant: 'large'
  }
} as const;

// Performance thresholds based on technical specifications
export const PERFORMANCE_THRESHOLDS = {
  MAX_GENERATION_TIME: 600000, // 600s for 57 frames at 720p
  MIN_THROUGHPUT: 1.0, // frames per second
  MIN_PSNR: 27.5, // minimum acceptable PSNR score
  MAX_GPU_MEMORY: 80 // GB
} as const;