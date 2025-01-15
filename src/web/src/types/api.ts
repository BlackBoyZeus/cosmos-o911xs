// External imports
import { UUID } from 'uuid'; // v9.0.0

// Internal imports
import { Status, PaginationParams } from './common';

/**
 * Type for HTTP methods used in API requests
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

/**
 * Enum for API response cache status
 */
export enum CacheStatus {
  HIT = 'HIT',
  MISS = 'MISS',
  STALE = 'STALE'
}

/**
 * Enhanced type for API response metadata with performance tracking
 */
export interface ApiResponseMetadata {
  timestamp: number;
  requestId: UUID;
  processingTime: number;
  serverRegion: string;
  cacheStatus: CacheStatus;
}

/**
 * Configuration type for API retry behavior
 */
export interface ApiRetryConfig {
  maxRetries: number;
  retryDelay: number;
  retryableStatuses: number[];
}

/**
 * Enhanced API error response interface with request tracking
 */
export interface ApiError {
  code: string;
  message: string;
  details: Record<string, unknown>;
  requestId: UUID;
  timestamp: number;
}

/**
 * Enhanced API request configuration interface with timeout and retry support
 */
export interface ApiRequestConfig {
  endpoint: string;
  method: HttpMethod;
  params: Record<string, unknown>;
  headers: Record<string, string>;
  timeout: number;
  retryConfig: ApiRetryConfig;
}

/**
 * Enhanced generic API response wrapper interface with metadata
 */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: ApiError | null;
  metadata: ApiResponseMetadata;
}

/**
 * Interface for model generation request parameters
 */
export interface GenerationRequest {
  prompt: string;
  modelType: 'diffusion' | 'autoregressive';
  modelSize: '4B' | '7B' | '12B' | '14B';
  numFrames: number;
  resolution: {
    width: number;
    height: number;
  };
  status: Status;
}

/**
 * Interface for model generation response
 */
export interface GenerationResponse {
  jobId: UUID;
  status: Status;
  progress: number;
  estimatedTimeRemaining: number;
  outputUrl?: string;
  error?: ApiError;
}

/**
 * Interface for system resource monitoring response
 */
export interface SystemMetricsResponse {
  gpuUtilization: number;
  gpuTemperature: number;
  memoryUsage: number;
  storageUsage: number;
  activeJobs: number;
  queuedJobs: number;
  timestamp: number;
}

/**
 * Interface for paginated API responses
 */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    totalItems: number;
    totalPages: number;
    currentPage: number;
    itemsPerPage: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

/**
 * Interface for API authentication request
 */
export interface AuthRequest {
  apiKey: string;
  timestamp: number;
  signature: string;
}

/**
 * Interface for API authentication response
 */
export interface AuthResponse {
  token: string;
  expiresAt: number;
  permissions: string[];
}

/**
 * Type for API rate limit information
 */
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
  retryAfter?: number;
}

/**
 * Interface for batch processing request
 */
export interface BatchProcessingRequest {
  jobs: GenerationRequest[];
  batchId: UUID;
  priority: 'low' | 'medium' | 'high';
  callbackUrl?: string;
  maxConcurrentJobs?: number;
}

/**
 * Interface for batch processing status
 */
export interface BatchProcessingStatus {
  batchId: UUID;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  status: Status;
  startTime: number;
  estimatedCompletionTime: number;
  errors: ApiError[];
}