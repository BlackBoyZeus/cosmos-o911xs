// External imports
import { z } from 'zod'; // v3.0.0 - Runtime type validation and schema definition

// Storage provider type definition
export type StorageProvider = 'aws' | 'gcp' | 'azure' | 'hybrid';

// GPU device type definition
export type GPUDeviceType = 'H100' | 'A100' | 'V100' | 'T4';

// Storage credentials interface with optional provider-specific fields
export interface StorageCredentials {
  accessKeyId?: string;
  secretAccessKey?: string;
  serviceAccountKey?: string;
  connectionString?: string;
  encryptionKey?: string;
}

// SSL configuration interface
export interface SSLConfig {
  enabled: boolean;
  cert?: string;
  key?: string;
  ca?: string;
}

// Encryption configuration interface
export interface EncryptionConfig {
  enabled: boolean;
  keyId?: string;
  algorithm?: string;
}

// Replication configuration interface
export interface ReplicationConfig {
  enabled: boolean;
  mode: 'primary' | 'secondary';
  nodes: string[];
  readPreference: 'primary' | 'primaryPreferred' | 'secondary';
}

// Parallelization configuration interface
export interface ParallelizationConfig {
  modelParallel: boolean;
  dataParallel: boolean;
  pipelineParallel: boolean;
  tensorParallel: boolean;
  deviceMapping: Record<number, number>;
}

// Lifecycle configuration interface
export interface LifecycleConfig {
  enabled: boolean;
  archivalDays: number;
  deletionDays: number;
  transitionRules: {
    days: number;
    storageClass: string;
  }[];
}

// Database configuration interface
export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  ssl: SSLConfig;
  replication: ReplicationConfig;
}

// GPU configuration interface
export interface GPUConfig {
  deviceCount: number;
  memoryLimit: number;
  computeCapability: string;
  deviceType: GPUDeviceType;
  parallelization: ParallelizationConfig;
}

// Storage configuration interface
export interface StorageConfig {
  provider: StorageProvider;
  region: string;
  credentials: StorageCredentials;
  bucketName: string;
  encryption: EncryptionConfig;
  lifecycle: LifecycleConfig;
}

// Zod schema for database configuration validation
const databaseConfigSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  username: z.string().min(1),
  password: z.string().min(8),
  database: z.string().min(1),
  ssl: z.object({
    enabled: z.boolean(),
    cert: z.string().optional(),
    key: z.string().optional(),
    ca: z.string().optional()
  }),
  replication: z.object({
    enabled: z.boolean(),
    mode: z.enum(['primary', 'secondary']),
    nodes: z.array(z.string()),
    readPreference: z.enum(['primary', 'primaryPreferred', 'secondary'])
  })
});

// Zod schema for GPU configuration validation
const gpuConfigSchema = z.object({
  deviceCount: z.number().int().min(1),
  memoryLimit: z.number().min(0),
  computeCapability: z.string().regex(/^\d+\.\d+$/),
  deviceType: z.enum(['H100', 'A100', 'V100', 'T4']),
  parallelization: z.object({
    modelParallel: z.boolean(),
    dataParallel: z.boolean(),
    pipelineParallel: z.boolean(),
    tensorParallel: z.boolean(),
    deviceMapping: z.record(z.number(), z.number())
  })
});

// Zod schema for storage configuration validation
const storageConfigSchema = z.object({
  provider: z.enum(['aws', 'gcp', 'azure', 'hybrid']),
  region: z.string().min(1),
  credentials: z.object({
    accessKeyId: z.string().optional(),
    secretAccessKey: z.string().optional(),
    serviceAccountKey: z.string().optional(),
    connectionString: z.string().optional(),
    encryptionKey: z.string().optional()
  }),
  bucketName: z.string().min(1),
  encryption: z.object({
    enabled: z.boolean(),
    keyId: z.string().optional(),
    algorithm: z.string().optional()
  }),
  lifecycle: z.object({
    enabled: z.boolean(),
    archivalDays: z.number().int().min(0),
    deletionDays: z.number().int().min(0),
    transitionRules: z.array(z.object({
      days: z.number().int().min(0),
      storageClass: z.string()
    }))
  })
});

// Validation function for database configuration
export function validateDatabaseConfig(config: DatabaseConfig): Result<boolean, ValidationError> {
  try {
    databaseConfigSchema.parse(config);
    return { success: true, data: true };
  } catch (error) {
    return {
      success: false,
      error: {
        message: 'Database configuration validation failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        path: error instanceof z.ZodError ? error.issues[0].path : []
      }
    };
  }
}

// Validation function for GPU configuration
export function validateGPUConfig(config: GPUConfig): Result<boolean, ValidationError> {
  try {
    gpuConfigSchema.parse(config);
    return { success: true, data: true };
  } catch (error) {
    return {
      success: false,
      error: {
        message: 'GPU configuration validation failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        path: error instanceof z.ZodError ? error.issues[0].path : []
      }
    };
  }
}

// Validation function for storage configuration
export function validateStorageConfig(config: StorageConfig): Result<boolean, ValidationError> {
  try {
    storageConfigSchema.parse(config);
    return { success: true, data: true };
  } catch (error) {
    return {
      success: false,
      error: {
        message: 'Storage configuration validation failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        path: error instanceof z.ZodError ? error.issues[0].path : []
      }
    };
  }
}

// Result type for validation functions
interface Result<T, E> {
  success: boolean;
  data?: T;
  error?: E;
}

// Validation error interface
interface ValidationError {
  message: string;
  details: string;
  path: (string | number)[];
}