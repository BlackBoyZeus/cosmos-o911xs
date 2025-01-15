// express version: ^4.18.0
// zod version: ^3.22.0
import { Request, Response, NextFunction } from 'express';
import { ValidationError } from 'zod';
import {
  validateGenerationRequest,
  validateModelConfig
} from '../../utils/validation';
import { IGenerationRequest } from '../../interfaces/IGeneration';
import { SafetyCheckType } from '../../types/safety';

// Performance constraints from technical specifications
const MAX_GENERATION_TIME_MS = 600000; // 600s for 57 frames at 720p
const MIN_FPS = 1;
const MAX_BATCH_SIZE = 32;

// Safety compliance thresholds
const SAFETY_THRESHOLDS = {
  faceBlur: 1.0, // 100% compliance required
  contentSafety: 0.95,
  harmfulContent: 0.99
};

/**
 * Middleware to validate video generation request parameters
 * Ensures compliance with performance constraints and safety requirements
 */
export const validateGenerationRequestMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const request = req.body as IGenerationRequest;

    // Track validation start time for performance monitoring
    const validationStart = Date.now();

    // Validate basic request structure and parameters
    validateGenerationRequest(request);

    // Validate performance constraints
    validatePerformanceRequirements(request);

    // Validate safety configurations
    validateSafetyRequirements(request);

    // Track validation metrics
    const validationTime = Date.now() - validationStart;
    req.app.locals.metrics?.recordValidationTime(validationTime);

    next();
  } catch (error) {
    const errorResponse = formatValidationError(error);
    res.status(400).json(errorResponse);
  }
};

/**
 * Middleware to validate model configuration parameters
 * Ensures compliance with resource constraints and safety settings
 */
export const validateModelConfigMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const config = req.body;

    // Track validation start time
    const validationStart = Date.now();

    // Validate basic config structure
    validateModelConfig(config);

    // Validate resource allocation
    validateResourceRequirements(config);

    // Validate safety guardrail settings
    validateGuardrailSettings(config);

    // Track validation metrics
    const validationTime = Date.now() - validationStart;
    req.app.locals.metrics?.recordValidationTime(validationTime);

    next();
  } catch (error) {
    const errorResponse = formatValidationError(error);
    res.status(400).json(errorResponse);
  }
};

/**
 * Validates performance-related requirements for generation requests
 */
function validatePerformanceRequirements(request: IGenerationRequest): void {
  const {
    frameCount,
    resolution,
    performanceConfig
  } = request;

  // Validate frame count and FPS requirements
  if (performanceConfig.targetFPS < MIN_FPS) {
    throw new ValidationError('Target FPS below minimum requirement', {
      min: MIN_FPS,
      provided: performanceConfig.targetFPS
    });
  }

  // Validate estimated generation time
  const estimatedTime = calculateEstimatedGenerationTime(
    frameCount,
    resolution,
    request.modelType
  );

  if (estimatedTime > MAX_GENERATION_TIME_MS) {
    throw new ValidationError('Estimated generation time exceeds maximum allowed', {
      maxAllowed: MAX_GENERATION_TIME_MS,
      estimated: estimatedTime,
      recommendation: 'Consider reducing frame count or resolution'
    });
  }
}

/**
 * Validates safety-related requirements for generation requests
 */
function validateSafetyRequirements(request: IGenerationRequest): void {
  const { safetyConfig } = request;

  // Validate face blur compliance
  if (!safetyConfig.enableFaceBlur) {
    throw new ValidationError('Face blur must be enabled for compliance', {
      requirement: '100% face blur compliance',
      provided: safetyConfig
    });
  }

  // Validate content safety thresholds
  if (safetyConfig.safetyThreshold < SAFETY_THRESHOLDS.contentSafety) {
    throw new ValidationError('Content safety threshold below requirement', {
      required: SAFETY_THRESHOLDS.contentSafety,
      provided: safetyConfig.safetyThreshold
    });
  }

  // Validate harmful content prevention
  if (!safetyConfig.contentFiltering) {
    throw new ValidationError('Content filtering must be enabled', {
      requirement: 'Zero harmful content generation',
      provided: safetyConfig
    });
  }
}

/**
 * Validates resource allocation requirements for model configurations
 */
function validateResourceRequirements(config: Record<string, any>): void {
  // Validate batch size constraints
  if (config.batchSize > MAX_BATCH_SIZE) {
    throw new ValidationError('Batch size exceeds maximum allowed', {
      max: MAX_BATCH_SIZE,
      provided: config.batchSize
    });
  }

  // Validate memory requirements
  const memoryRequired = calculateMemoryRequirement(
    config.modelType,
    config.batchSize
  );

  if (!isMemoryAvailable(memoryRequired)) {
    throw new ValidationError('Insufficient GPU memory for configuration', {
      required: memoryRequired,
      recommendation: 'Reduce batch size or use smaller model'
    });
  }
}

/**
 * Validates safety guardrail settings for model configurations
 */
function validateGuardrailSettings(config: Record<string, any>): void {
  // Validate pre-guard settings
  if (!config.preGuard?.enabled) {
    throw new ValidationError('Pre-guard must be enabled', {
      requirement: 'Input filtering required',
      provided: config.preGuard
    });
  }

  // Validate post-guard settings
  if (!config.postGuard?.enabled) {
    throw new ValidationError('Post-guard must be enabled', {
      requirement: 'Output safety verification required',
      provided: config.postGuard
    });
  }

  // Validate safety thresholds
  Object.entries(config.safetyThresholds || {}).forEach(([check, threshold]) => {
    const requiredThreshold = SAFETY_THRESHOLDS[check];
    if (threshold < requiredThreshold) {
      throw new ValidationError(`Safety threshold below requirement for ${check}`, {
        required: requiredThreshold,
        provided: threshold
      });
    }
  });
}

/**
 * Formats validation errors into a standardized response structure
 */
function formatValidationError(error: any): Record<string, any> {
  return {
    error: {
      type: 'ValidationError',
      message: error.message,
      details: error.details || {},
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * Helper function to calculate estimated generation time
 */
function calculateEstimatedGenerationTime(
  frameCount: number,
  resolution: { width: number; height: number },
  modelType: string
): number {
  // Implementation based on model benchmarks and resolution scaling
  const baseTimePerFrame = 600000 / 57; // Base time for 720p
  const resolutionFactor = (resolution.width * resolution.height) / (1280 * 720);
  return baseTimePerFrame * frameCount * resolutionFactor;
}

/**
 * Helper function to calculate memory requirements
 */
function calculateMemoryRequirement(
  modelType: string,
  batchSize: number
): number {
  // Implementation based on model memory profiles
  const baseMemory = {
    DIFFUSION_7B: 74,
    DIFFUSION_14B: 140,
    AUTOREGRESSIVE_4B: 32
  }[modelType] || 74;
  
  return baseMemory * batchSize;
}

/**
 * Helper function to check memory availability
 */
function isMemoryAvailable(required: number): boolean {
  const AVAILABLE_MEMORY = 80; // H100 GPU memory in GB
  return required <= AVAILABLE_MEMORY;
}