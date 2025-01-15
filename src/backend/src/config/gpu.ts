// External imports
import { z } from 'zod'; // v3.0.0 - Runtime schema validation

// Internal imports
import { GPUConfig } from '../types/config';

/**
 * Default GPU configuration optimized for the Cosmos WFM Platform
 * Configured for H100/A100 GPU clusters with horizontal scaling support
 */
export const DEFAULT_GPU_CONFIG = {
  deviceCount: 8, // Optimal number of GPUs for distributed training
  memoryLimit: 80000, // 80GB for H100 GPUs
  computeCapability: '8.0', // Minimum for H100/A100 support
  queueLength: 100, // Maximum pending jobs in queue
  scalingThreshold: 0.8, // 80% utilization triggers scaling
  deviceType: 'H100' as const,
  parallelization: {
    modelParallel: true,
    dataParallel: true,
    pipelineParallel: true,
    tensorParallel: true,
    deviceMapping: {} // Will be populated during initialization
  }
} as const;

/**
 * Enhanced Zod schema for GPU configuration validation
 * Includes comprehensive validation rules for all GPU parameters
 */
const gpuConfigSchema = z.object({
  deviceCount: z.number()
    .int()
    .min(2, 'Minimum 2 GPUs required for redundancy')
    .max(32, 'Maximum 32 GPUs supported per cluster')
    .refine(n => n % 2 === 0, 'Device count must be even for balanced distribution'),
    
  memoryLimit: z.number()
    .min(40000, 'Minimum 40GB memory required')
    .max(80000, 'Maximum 80GB memory supported')
    .refine(n => n % 1000 === 0, 'Memory limit must be in GB units'),
    
  computeCapability: z.string()
    .regex(/^\d+\.\d+$/, 'Invalid compute capability format')
    .refine(cc => parseFloat(cc) >= 7.0, 'Minimum compute capability 7.0 required'),
    
  queueLength: z.number()
    .int()
    .min(10, 'Minimum queue length of 10 required')
    .max(1000, 'Maximum queue length of 1000 supported'),
    
  scalingThreshold: z.number()
    .min(0.5, 'Minimum scaling threshold of 0.5 required')
    .max(0.95, 'Maximum scaling threshold of 0.95 supported'),

  deviceType: z.enum(['H100', 'A100', 'V100', 'T4']),
  
  parallelization: z.object({
    modelParallel: z.boolean(),
    dataParallel: z.boolean(),
    pipelineParallel: z.boolean(),
    tensorParallel: z.boolean(),
    deviceMapping: z.record(z.number(), z.number())
  })
});

/**
 * Validates GPU configuration using enhanced Zod schema
 * Throws detailed validation errors for invalid configurations
 * @param config GPU configuration to validate
 * @throws ValidationError with detailed message if validation fails
 */
export function validateGPUConfig(config: GPUConfig): boolean {
  try {
    gpuConfigSchema.parse(config);
    
    // Additional validation rules
    if (config.deviceType === 'H100' && config.memoryLimit < 60000) {
      throw new Error('H100 GPUs require minimum 60GB memory');
    }
    
    if (config.parallelization.modelParallel && config.deviceCount < 4) {
      throw new Error('Model parallelism requires minimum 4 GPUs');
    }
    
    // Validate performance requirements
    const estimatedLatency = calculateEstimatedLatency(config);
    if (estimatedLatency > 600) { // 600s max latency requirement
      throw new Error('Configuration cannot meet latency requirements');
    }
    
    return true;
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`GPU Config Validation Error: ${error.errors[0].message}`);
    }
    throw error;
  }
}

/**
 * Returns optimized default GPU configuration
 * Includes platform-specific optimizations and scaling parameters
 */
export function getDefaultGPUConfig(): GPUConfig {
  const config = { ...DEFAULT_GPU_CONFIG };
  
  // Initialize device mapping
  for (let i = 0; i < config.deviceCount; i++) {
    config.parallelization.deviceMapping[i] = i;
  }
  
  return config;
}

/**
 * Merges user GPU configuration with defaults
 * Performs deep merge and validates final configuration
 * @param userConfig User-provided GPU configuration
 */
export function mergeGPUConfig(userConfig: Partial<GPUConfig>): GPUConfig {
  const defaultConfig = getDefaultGPUConfig();
  
  const mergedConfig = {
    ...defaultConfig,
    ...userConfig,
    parallelization: {
      ...defaultConfig.parallelization,
      ...userConfig.parallelization,
      deviceMapping: {
        ...defaultConfig.parallelization.deviceMapping,
        ...userConfig.parallelization?.deviceMapping
      }
    }
  };
  
  // Validate merged configuration
  validateGPUConfig(mergedConfig);
  
  return mergedConfig;
}

/**
 * Helper function to estimate video generation latency
 * Based on GPU configuration and platform benchmarks
 */
function calculateEstimatedLatency(config: GPUConfig): number {
  const baseLatency = 100; // Base latency in seconds
  const gpuSpeedup = config.deviceCount * (
    config.deviceType === 'H100' ? 2.5 :
    config.deviceType === 'A100' ? 2.0 :
    config.deviceType === 'V100' ? 1.5 : 1.0
  );
  
  const parallelizationBoost = 
    (config.parallelization.modelParallel ? 1.2 : 1.0) *
    (config.parallelization.dataParallel ? 1.3 : 1.0) *
    (config.parallelization.pipelineParallel ? 1.1 : 1.0) *
    (config.parallelization.tensorParallel ? 1.2 : 1.0);
  
  return baseLatency / (gpuSpeedup * parallelizationBoost);
}