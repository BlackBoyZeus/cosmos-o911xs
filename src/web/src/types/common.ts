// External imports
// uuid v9.0.0
import { UUID } from 'uuid';

/**
 * Common status enum for tracking process states including user cancellations
 */
export enum Status {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING', 
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

/**
 * Enum for different resource types in monitoring including temperature metrics
 */
export enum ResourceType {
  GPU = 'GPU',
  MEMORY = 'MEMORY',
  STORAGE = 'STORAGE',
  TEMPERATURE = 'TEMPERATURE'
}

/**
 * Sort order enum for pagination
 */
export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC'
}

/**
 * Extended pagination parameters interface with search and filtering capabilities
 */
export interface PaginationParams {
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: SortOrder;
  search: string;
  filters: Record<string, any>;
}

/**
 * Extended error response interface with timestamp and request tracking
 */
export interface ErrorResponse {
  code: string;
  message: string;
  details: Record<string, any>;
  timestamp: number;
  requestId: UUID;
}

/**
 * Type alias for unique identifiers
 */
export type ID = UUID;

/**
 * Type alias for timestamps
 */
export type Timestamp = number;

/**
 * Extended type for resource utilization metrics including temperature and health status
 */
export type ResourceMetrics = {
  type: ResourceType;
  utilization: number;
  total: number;
  used: number;
  temperature: number;
  timestamp: Timestamp;
  status: string;
}