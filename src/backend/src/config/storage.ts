// External imports
import { z } from 'zod'; // v3.0.0
import * as dotenv from 'dotenv'; // v16.0.0
import * as winston from 'winston'; // v3.8.0
import * as crypto from 'crypto'; // v1.0.0

// Internal imports
import { 
  StorageConfig, 
  StorageProvider, 
  StorageCredentials, 
  EncryptionConfig 
} from '../types/config';

// Constants
export const DEFAULT_REGION = 'us-east-1';
export const DEFAULT_STORAGE_PROVIDER = 'aws';
export const ENCRYPTION_ALGORITHM = 'AES-256-GCM';
export const KEY_ROTATION_INTERVAL = 90; // days

// Logger configuration
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'storage-audit.log' })
  ]
});

// Enhanced storage configuration schema with security validations
const STORAGE_CONFIG_SCHEMA = z.object({
  provider: z.enum(['aws', 'gcp', 'azure', 'hybrid']),
  region: z.string().min(1),
  credentials: z.object({
    accessKeyId: z.string().optional(),
    secretAccessKey: z.string().optional(),
    serviceAccountKey: z.string().optional(),
    connectionString: z.string().optional(),
    encryptionKey: z.string().optional()
  }),
  bucketName: z.string().min(3),
  encryption: z.object({
    enabled: z.boolean(),
    keyId: z.string().optional(),
    algorithm: z.string().optional()
  }).refine(data => {
    if (data.enabled && !data.keyId) {
      return false;
    }
    return true;
  }, { message: "Encryption key ID is required when encryption is enabled" }),
  replication: z.object({
    enabled: z.boolean(),
    regions: z.array(z.string()).min(1),
    mode: z.enum(['sync', 'async']),
    retentionPeriod: z.number().min(1)
  })
});

/**
 * Loads and validates storage configuration with enhanced security features
 * @returns {StorageConfig} Validated storage configuration
 */
export function loadStorageConfig(): StorageConfig {
  // Load environment variables securely
  dotenv.config();
  
  const config: StorageConfig = {
    provider: (process.env.STORAGE_PROVIDER as StorageProvider) || DEFAULT_STORAGE_PROVIDER,
    region: process.env.STORAGE_REGION || DEFAULT_REGION,
    credentials: loadStorageCredentials(),
    bucketName: process.env.STORAGE_BUCKET_NAME || '',
    encryption: loadEncryptionConfig(),
    replication: {
      enabled: process.env.STORAGE_REPLICATION_ENABLED === 'true',
      regions: process.env.STORAGE_REPLICATION_REGIONS?.split(',') || [],
      mode: (process.env.STORAGE_REPLICATION_MODE || 'async') as 'sync' | 'async',
      retentionPeriod: parseInt(process.env.STORAGE_RETENTION_PERIOD || '30', 10)
    }
  };

  // Validate configuration
  const validationResult = validateStorageConfig(config);
  if (!validationResult) {
    throw new Error('Invalid storage configuration');
  }

  logger.info('Storage configuration loaded successfully', { 
    provider: config.provider,
    region: config.region,
    encryptionEnabled: config.encryption.enabled
  });

  return config;
}

/**
 * Validates storage configuration with security checks
 * @param {StorageConfig} config Storage configuration to validate
 * @returns {boolean} Validation result
 */
export function validateStorageConfig(config: StorageConfig): boolean {
  try {
    STORAGE_CONFIG_SCHEMA.parse(config);
    
    // Additional security validations
    if (config.encryption.enabled) {
      validateEncryptionSettings(config.encryption);
    }
    
    if (config.replication.enabled) {
      validateReplicationSettings(config.replication);
    }
    
    return true;
  } catch (error) {
    logger.error('Storage configuration validation failed', { error });
    return false;
  }
}

/**
 * Handles secure credential rotation
 * @param {StorageConfig} config Current storage configuration
 * @returns {StorageConfig} Updated configuration with new credentials
 */
export function rotateStorageCredentials(config: StorageConfig): StorageConfig {
  const newCredentials = generateSecureCredentials(config.provider);
  
  const updatedConfig = {
    ...config,
    credentials: newCredentials,
    encryption: {
      ...config.encryption,
      keyId: crypto.randomBytes(32).toString('hex')
    }
  };

  logger.info('Storage credentials rotated successfully', {
    provider: config.provider,
    timestamp: new Date().toISOString()
  });

  return updatedConfig;
}

// Helper functions
function loadStorageCredentials(): StorageCredentials {
  return {
    accessKeyId: process.env.STORAGE_ACCESS_KEY_ID,
    secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY,
    serviceAccountKey: process.env.STORAGE_SERVICE_ACCOUNT_KEY,
    connectionString: process.env.STORAGE_CONNECTION_STRING,
    encryptionKey: process.env.STORAGE_ENCRYPTION_KEY
  };
}

function loadEncryptionConfig(): EncryptionConfig {
  return {
    enabled: process.env.STORAGE_ENCRYPTION_ENABLED === 'true',
    keyId: process.env.STORAGE_ENCRYPTION_KEY_ID,
    algorithm: process.env.STORAGE_ENCRYPTION_ALGORITHM || ENCRYPTION_ALGORITHM
  };
}

function validateEncryptionSettings(encryption: EncryptionConfig): void {
  if (!encryption.algorithm || !encryption.keyId) {
    throw new Error('Invalid encryption configuration');
  }
}

function validateReplicationSettings(replication: any): void {
  if (!replication.regions.length) {
    throw new Error('At least one replication region is required');
  }
}

function generateSecureCredentials(provider: StorageProvider): StorageCredentials {
  // Provider-specific secure credential generation
  switch (provider) {
    case 'aws':
      return {
        accessKeyId: crypto.randomBytes(32).toString('hex'),
        secretAccessKey: crypto.randomBytes(64).toString('hex')
      };
    case 'gcp':
      return {
        serviceAccountKey: crypto.randomBytes(64).toString('base64')
      };
    case 'azure':
      return {
        connectionString: crypto.randomBytes(64).toString('base64')
      };
    default:
      throw new Error('Unsupported storage provider');
  }
}

// Export storage configuration
export const storageConfig = loadStorageConfig();