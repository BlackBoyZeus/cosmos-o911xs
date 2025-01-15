// External imports
import { z } from 'zod'; // v3.21.4
import sanitizeHtml from 'sanitize-html'; // v2.11.0

// Internal imports
import { ModelType, IModel } from '../interfaces/IModel';
import { Status } from '../types/common';

// Constants for validation limits
const MAX_RESOLUTION = {
  width: 1920,
  height: 1080
} as const;

const MAX_FRAMES = 120;
const MAX_BATCH_SIZE = 32;
const GUIDANCE_SCALE_RANGE = {
  min: 1.0,
  max: 20.0
} as const;

const VALIDATION_RATE_LIMIT = {
  max_attempts: 100,
  window_ms: 60000
} as const;

// Validation schemas
const modelSchema = z.object({
  architecture: z.object({
    type: z.enum([ModelType.DIFFUSION, ModelType.AUTOREGRESSIVE]),
    parameters: z.number().positive().max(100), // Max 100B parameters
    version: z.string().regex(/^v\d+\.\d+\.\d+$/)
  }),
  capabilities: z.object({
    maxResolution: z.object({
      width: z.number().int().min(64).max(MAX_RESOLUTION.width),
      height: z.number().int().min(64).max(MAX_RESOLUTION.height)
    }),
    maxFrames: z.number().int().min(1).max(MAX_FRAMES),
    maxBatchSize: z.number().int().min(1).max(MAX_BATCH_SIZE)
  }),
  performance: z.object({
    generationTime: z.number().positive(),
    gpuMemoryUsage: z.number().positive(),
    throughput: z.number().positive(),
    psnr: z.number().positive(),
    fid: z.number().nonnegative()
  }).optional()
});

const generationParamsSchema = z.object({
  resolution: z.object({
    width: z.number().int().min(64).max(MAX_RESOLUTION.width),
    height: z.number().int().min(64).max(MAX_RESOLUTION.height)
  }),
  frameCount: z.number().int().min(1).max(MAX_FRAMES),
  batchSize: z.number().int().min(1).max(MAX_BATCH_SIZE),
  guidanceScale: z.number().min(GUIDANCE_SCALE_RANGE.min).max(GUIDANCE_SCALE_RANGE.max)
});

// Rate limiting for validation attempts
const validationAttempts = new Map<string, number[]>();

/**
 * Validates model configuration against schema with performance checks
 * @param model - Model configuration to validate
 * @returns Validation result with detailed error information
 */
export function validateModel(model: IModel): ValidationResult {
  try {
    // Parse and validate against schema
    const validatedModel = modelSchema.parse(model);

    // Additional validation checks
    if (validatedModel.architecture.type === ModelType.DIFFUSION) {
      if (validatedModel.performance && validatedModel.performance.gpuMemoryUsage > 80) {
        return {
          isValid: false,
          errors: ['GPU memory usage exceeds recommended limit of 80GB'],
          sanitizedValue: null
        };
      }
    }

    // Validate status transitions
    if (!isValidStatusTransition(model.status)) {
      return {
        isValid: false,
        errors: ['Invalid status transition'],
        sanitizedValue: null
      };
    }

    return {
      isValid: true,
      errors: [],
      sanitizedValue: validatedModel
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        isValid: false,
        errors: error.errors.map(e => e.message),
        sanitizedValue: null
      };
    }
    return {
      isValid: false,
      errors: ['Unexpected validation error'],
      sanitizedValue: null
    };
  }
}

/**
 * Validates video generation parameters with enhanced security
 * @param params - Generation parameters to validate
 * @returns Validation result with detailed error information
 */
export function validateGenerationParams(params: GenerationParams): ValidationResult {
  try {
    // Check rate limiting
    if (!checkRateLimit('generation_validation')) {
      return {
        isValid: false,
        errors: ['Rate limit exceeded for validation attempts'],
        sanitizedValue: null
      };
    }

    // Parse and validate against schema
    const validatedParams = generationParamsSchema.parse(params);

    // Additional validation checks
    const aspectRatio = validatedParams.resolution.width / validatedParams.resolution.height;
    if (aspectRatio < 0.5 || aspectRatio > 2.0) {
      return {
        isValid: false,
        errors: ['Invalid aspect ratio. Must be between 0.5 and 2.0'],
        sanitizedValue: null
      };
    }

    return {
      isValid: true,
      errors: [],
      sanitizedValue: validatedParams
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        isValid: false,
        errors: error.errors.map(e => e.message),
        sanitizedValue: null
      };
    }
    return {
      isValid: false,
      errors: ['Unexpected validation error'],
      sanitizedValue: null
    };
  }
}

/**
 * Validates and sanitizes form input with security measures
 * @param value - Input value to validate
 * @param type - Type of input for validation rules
 * @returns Validation result with sanitized value
 */
export function validateFormInput(value: string, type: InputType): ValidationResult {
  try {
    // Check rate limiting
    if (!checkRateLimit('form_validation')) {
      return {
        isValid: false,
        errors: ['Rate limit exceeded for validation attempts'],
        sanitizedValue: null
      };
    }

    // Sanitize input
    const sanitizedValue = sanitizeHtml(value, {
      allowedTags: [],
      allowedAttributes: {},
      disallowedTagsMode: 'recursiveEscape'
    });

    // Type-specific validation
    switch (type) {
      case 'text':
        if (sanitizedValue.length > 1000) {
          return {
            isValid: false,
            errors: ['Text exceeds maximum length of 1000 characters'],
            sanitizedValue: null
          };
        }
        break;
      case 'number':
        if (!/^\d+$/.test(sanitizedValue)) {
          return {
            isValid: false,
            errors: ['Input must contain only numbers'],
            sanitizedValue: null
          };
        }
        break;
      case 'email':
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitizedValue)) {
          return {
            isValid: false,
            errors: ['Invalid email format'],
            sanitizedValue: null
          };
        }
        break;
    }

    return {
      isValid: true,
      errors: [],
      sanitizedValue
    };
  } catch (error) {
    return {
      isValid: false,
      errors: ['Input validation failed'],
      sanitizedValue: null
    };
  }
}

// Helper functions
function isValidStatusTransition(status: Status): boolean {
  const validTransitions = {
    [Status.PENDING]: [Status.PROCESSING],
    [Status.PROCESSING]: [Status.COMPLETED, Status.FAILED],
    [Status.COMPLETED]: [],
    [Status.FAILED]: [Status.PENDING]
  };
  return validTransitions[status]?.length >= 0;
}

function checkRateLimit(validationType: string): boolean {
  const now = Date.now();
  const attempts = validationAttempts.get(validationType) || [];
  
  // Clean up old attempts
  const recentAttempts = attempts.filter(
    timestamp => now - timestamp < VALIDATION_RATE_LIMIT.window_ms
  );
  
  if (recentAttempts.length >= VALIDATION_RATE_LIMIT.max_attempts) {
    return false;
  }
  
  recentAttempts.push(now);
  validationAttempts.set(validationType, recentAttempts);
  return true;
}

// Types
interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedValue: any;
}

interface GenerationParams {
  resolution: {
    width: number;
    height: number;
  };
  frameCount: number;
  batchSize: number;
  guidanceScale: number;
}

type InputType = 'text' | 'number' | 'email';