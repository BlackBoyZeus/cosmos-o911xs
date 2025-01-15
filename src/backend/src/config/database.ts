// External imports
import { z } from 'zod'; // v3.0.0
import { config } from 'dotenv'; // v16.0.0
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'; // v1.0.0

// Internal imports
import { DatabaseConfig } from '../types/config';

// Load environment variables
config();

// Constants
const DEFAULT_DB_PORT = 27017;
const DEFAULT_DB_HOST = 'localhost';
const ENCRYPTION_KEY = process.env.DB_ENCRYPTION_KEY;
const CONFIG_VERSION = '1.0.0';

// Enhanced Zod schema for database configuration with cloud provider support
const databaseConfigSchema = z.object({
  host: z.string().min(1).refine(
    (val) => {
      const urlPattern = /^(mongodb(\+srv)?:\/\/)?[^\s]+$/;
      return urlPattern.test(val);
    },
    { message: 'Invalid database host URL format' }
  ),
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
  replicaSet: z.string().optional()
});

/**
 * Encrypts sensitive configuration values
 * @param value Value to encrypt
 * @returns Encrypted value
 */
function encryptValue(value: string): string {
  if (!ENCRYPTION_KEY) {
    throw new Error('Database encryption key not found in environment');
  }

  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${encrypted.toString('hex')}:${authTag.toString('hex')}`;
}

/**
 * Decrypts sensitive configuration values
 * @param encryptedValue Encrypted value
 * @returns Decrypted value
 */
function decryptValue(encryptedValue: string): string {
  if (!ENCRYPTION_KEY) {
    throw new Error('Database encryption key not found in environment');
  }

  const [ivHex, encryptedHex, authTagHex] = encryptedValue.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final()
  ]).toString('utf8');
}

/**
 * Validates database configuration against enhanced schema with cloud provider support
 * @param config Database configuration object
 * @returns True if valid, throws ValidationError with detailed context if invalid
 */
export function validateDatabaseConfig(config: DatabaseConfig): boolean {
  try {
    databaseConfigSchema.parse(config);

    // Additional validation for cloud-specific configurations
    if (config.host.includes('documentdb.amazonaws.com')) {
      if (!config.ssl.enabled) {
        throw new Error('SSL must be enabled for DocumentDB connections');
      }
    }

    if (config.host.includes('cosmos.azure.com')) {
      if (!config.ssl.enabled || !config.ssl.cert) {
        throw new Error('SSL with certificate required for Cosmos DB connections');
      }
    }

    return true;
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Configuration validation failed: ${error.errors[0].message}`);
    }
    throw error;
  }
}

/**
 * Loads and validates database configuration from environment variables
 * @returns Validated and decrypted database configuration object
 */
export function loadDatabaseConfig(): DatabaseConfig {
  const deploymentEnv = process.env.DEPLOYMENT_ENV || 'development';

  // Load configuration based on deployment environment
  const config: DatabaseConfig = {
    host: process.env.DB_HOST || DEFAULT_DB_HOST,
    port: parseInt(process.env.DB_PORT || DEFAULT_DB_PORT.toString(), 10),
    username: process.env.DB_USERNAME || '',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || '',
    ssl: {
      enabled: process.env.DB_SSL_ENABLED === 'true',
      cert: process.env.DB_SSL_CERT,
      key: process.env.DB_SSL_KEY,
      ca: process.env.DB_SSL_CA
    },
    replicaSet: process.env.DB_REPLICA_SET
  };

  // Decrypt sensitive values if encrypted
  if (process.env.DB_CREDENTIALS_ENCRYPTED === 'true') {
    config.username = decryptValue(config.username);
    config.password = decryptValue(config.password);
  }

  // Validate configuration
  if (!validateDatabaseConfig(config)) {
    throw new Error('Invalid database configuration');
  }

  // Apply environment-specific settings
  switch (deploymentEnv) {
    case 'production':
      if (!config.ssl.enabled) {
        throw new Error('SSL must be enabled in production environment');
      }
      break;
    case 'staging':
      if (!config.replicaSet) {
        throw new Error('Replica set configuration required in staging environment');
      }
      break;
  }

  return config;
}

// Export validated database configuration
export const databaseConfig = loadDatabaseConfig();