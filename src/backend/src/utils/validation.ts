// zod version: ^3.22.0
import { z } from 'zod';
import { VideoResolution, ModelType } from '../types/common';
import { IGenerationRequest } from '../interfaces/IGeneration';

// System constraints based on technical specifications
const MAX_FRAME_COUNT = 120;
const MIN_RESOLUTION = 128;
const MAX_WIDTH = 1920;
const MAX_HEIGHT = 1080;
const SUPPORTED_ASPECT_RATIOS = [16/9, 4/3];
const GPU_MEMORY_LIMITS = {
  H100: 80, // GB
  A100: 40  // GB
};
const MODEL_MEMORY_REQUIREMENTS = {
  DIFFUSION_7B: 74,    // GB
  DIFFUSION_14B: 140,  // GB
  AUTOREGRESSIVE_4B: 32 // GB
};

/**
 * Custom error class for validation failures
 */
export class ValidationError extends Error {
  constructor(message: string, public details?: Record<string, any>) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validates video resolution parameters against system constraints
 * @param resolution VideoResolution object containing width and height
 * @returns boolean if valid, throws ValidationError otherwise
 */
export function validateResolution(resolution: VideoResolution): boolean {
  // Create zod schema for resolution validation
  const resolutionSchema = z.object({
    width: z.number()
      .int()
      .min(MIN_RESOLUTION)
      .max(MAX_WIDTH)
      .positive(),
    height: z.number()
      .int()
      .min(MIN_RESOLUTION)
      .max(MAX_HEIGHT)
      .positive()
  });

  try {
    // Validate basic constraints
    resolutionSchema.parse(resolution);

    // Validate aspect ratio
    const aspectRatio = resolution.width / resolution.height;
    const isValidRatio = SUPPORTED_ASPECT_RATIOS.some(
      ratio => Math.abs(aspectRatio - ratio) < 0.01
    );

    if (!isValidRatio) {
      throw new ValidationError(
        'Invalid aspect ratio. Supported ratios: 16:9, 4:3',
        { provided: aspectRatio, supported: SUPPORTED_ASPECT_RATIOS }
      );
    }

    return true;
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError('Invalid resolution parameters', error.errors);
    }
    throw error;
  }
}

/**
 * Validates complete generation request parameters
 * @param request IGenerationRequest object
 * @returns boolean if valid, throws ValidationError otherwise
 */
export function validateGenerationRequest(request: IGenerationRequest): boolean {
  // Create zod schema for request validation
  const requestSchema = z.object({
    modelType: z.nativeEnum(ModelType),
    prompt: z.string()
      .min(1)
      .max(1000),
    frameCount: z.number()
      .int()
      .min(1)
      .max(MAX_FRAME_COUNT),
    resolution: z.custom<VideoResolution>(),
    safetyConfig: z.object({
      enableFaceBlur: z.boolean(),
      contentFiltering: z.boolean(),
      safetyThreshold: z.number().min(0).max(1)
    })
  });

  try {
    // Validate basic schema
    requestSchema.parse(request);

    // Validate resolution
    validateResolution(request.resolution);

    // Validate memory requirements
    const memoryRequired = calculateMemoryRequirement(
      request.modelType,
      request.resolution,
      request.frameCount
    );

    const availableMemory = GPU_MEMORY_LIMITS.H100; // Assume H100 for max capacity
    if (memoryRequired > availableMemory) {
      throw new ValidationError(
        'Request exceeds available GPU memory',
        {
          required: memoryRequired,
          available: availableMemory,
          modelType: request.modelType
        }
      );
    }

    return true;
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError('Invalid generation request', error.errors);
    }
    throw error;
  }
}

/**
 * Validates model configuration parameters
 * @param config ModelConfig object
 * @returns boolean if valid, throws ValidationError otherwise
 */
export function validateModelConfig(config: Record<string, any>): boolean {
  // Create zod schema for model config validation
  const configSchema = z.object({
    modelType: z.nativeEnum(ModelType),
    batchSize: z.number()
      .int()
      .positive()
      .max(32),
    learningRate: z.number()
      .optional()
      .positive()
      .max(1),
    epochs: z.number()
      .optional()
      .int()
      .positive()
      .max(1000)
  });

  try {
    // Validate basic schema
    configSchema.parse(config);

    // Validate model-specific memory requirements
    const modelMemory = MODEL_MEMORY_REQUIREMENTS[config.modelType];
    if (!modelMemory) {
      throw new ValidationError(
        'Unsupported model type',
        { supported: Object.keys(MODEL_MEMORY_REQUIREMENTS) }
      );
    }

    // Validate batch size against memory limits
    const batchMemory = modelMemory * config.batchSize;
    if (batchMemory > GPU_MEMORY_LIMITS.H100) {
      throw new ValidationError(
        'Batch size exceeds GPU memory capacity',
        {
          batchSize: config.batchSize,
          modelMemory,
          totalRequired: batchMemory,
          available: GPU_MEMORY_LIMITS.H100
        }
      );
    }

    return true;
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError('Invalid model configuration', error.errors);
    }
    throw error;
  }
}

/**
 * Helper function to calculate memory requirements for a generation request
 * @param modelType Model architecture type
 * @param resolution Video resolution
 * @param frameCount Number of frames
 * @returns Required memory in GB
 */
function calculateMemoryRequirement(
  modelType: ModelType,
  resolution: VideoResolution,
  frameCount: number
): number {
  const baseMemory = MODEL_MEMORY_REQUIREMENTS[modelType];
  const pixelCount = resolution.width * resolution.height;
  const memoryPerFrame = (pixelCount * 4) / (1024 * 1024 * 1024); // 4 bytes per pixel, convert to GB
  const frameMemory = memoryPerFrame * frameCount;
  
  return baseMemory + frameMemory;
}