// Internal imports
import { ApiEndpoint } from '../types/api';

/**
 * Current API version for all endpoints
 */
export const API_VERSION = 'v1';

/**
 * Base URL for all API requests including version
 */
export const API_BASE_URL = `/api/${API_VERSION}`;

/**
 * Core API endpoints for the Cosmos WFM Platform
 * All paths are relative to API_BASE_URL
 */
export const ENDPOINTS = {
  // Dataset management endpoints
  DATASETS: {
    LIST: '/datasets',
    CREATE: '/datasets/create',
    GET: '/datasets/:id',
    UPDATE: '/datasets/:id',
    DELETE: '/datasets/:id',
    VALIDATE: '/datasets/validate',
    METRICS: '/datasets/:id/metrics',
  },

  // Model management endpoints
  MODELS: {
    LIST: '/models',
    GET: '/models/:id',
    STATUS: '/models/:id/status',
    METRICS: '/models/:id/metrics',
    WEIGHTS: '/models/:id/weights',
    CHECKPOINTS: '/models/:id/checkpoints',
  },

  // Generation pipeline endpoints
  GENERATION: {
    CREATE_JOB: '/generation/jobs',
    JOB_STATUS: '/generation/jobs/:id',
    CANCEL_JOB: '/generation/jobs/:id/cancel',
    BATCH_CREATE: '/generation/batch',
    BATCH_STATUS: '/generation/batch/:id',
    RESULTS: '/generation/results/:id',
  },

  // Tokenizer endpoints
  TOKENIZER: {
    ENCODE: '/tokenizer/encode',
    DECODE: '/tokenizer/decode',
    CONFIG: '/tokenizer/config',
    METRICS: '/tokenizer/metrics',
  },

  // Safety guardrail endpoints
  SAFETY: {
    PRE_CHECK: '/safety/pre-check',
    POST_CHECK: '/safety/post-check',
    POLICIES: '/safety/policies',
    AUDIT_LOG: '/safety/audit',
    UPDATE_POLICY: '/safety/policies/:id',
  },

  // Training pipeline endpoints
  TRAINING: {
    CREATE_JOB: '/training/jobs',
    JOB_STATUS: '/training/jobs/:id',
    CANCEL_JOB: '/training/jobs/:id/cancel',
    METRICS: '/training/jobs/:id/metrics',
    HYPERPARAMETERS: '/training/hyperparameters',
    FINE_TUNE: '/training/fine-tune',
  },

  // System monitoring endpoints
  MONITORING: {
    RESOURCES: '/monitoring/resources',
    GPU_METRICS: '/monitoring/gpu',
    QUEUE_STATUS: '/monitoring/queue',
    ALERTS: '/monitoring/alerts',
  },

  // Authentication endpoints
  AUTH: {
    LOGIN: '/auth/login',
    REFRESH: '/auth/refresh',
    LOGOUT: '/auth/logout',
    VERIFY: '/auth/verify',
  },

  // User management endpoints
  USERS: {
    PROFILE: '/users/profile',
    PREFERENCES: '/users/preferences',
    API_KEYS: '/users/api-keys',
    USAGE: '/users/usage',
  },
} as const;

/**
 * Helper function to build full API URLs
 * @param endpoint - Endpoint path from ENDPOINTS
 * @param params - URL parameters to replace in path
 * @returns Full API URL with parameters replaced
 */
export const buildApiUrl = (endpoint: string, params?: Record<string, string>): string => {
  let url = `${API_BASE_URL}${endpoint}`;
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url = url.replace(`:${key}`, value);
    });
  }
  
  return url;
};

/**
 * Rate limiting constants
 */
export const RATE_LIMITS = {
  DEFAULT: 100, // requests per minute
  TRAINING: 10,
  GENERATION: 50,
  SAFETY: 200,
} as const;

/**
 * Timeout constants (in milliseconds)
 */
export const TIMEOUTS = {
  DEFAULT: 30000,
  GENERATION: 600000, // 10 minutes
  TRAINING: 3600000, // 1 hour
  UPLOAD: 300000, // 5 minutes
} as const;