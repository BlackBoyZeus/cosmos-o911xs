// @types/node version: ^18.0.0
import { UUID } from 'crypto';
import { ProcessingStatus } from '../types/common';
import { SafetyCheckType } from '../types/safety';

/**
 * Enum defining types of safety guards in the system
 * Used for comprehensive monitoring of pre and post processing checks
 */
export enum GuardType {
  PRE_GUARD = 'PRE_GUARD',   // Input filtering and validation
  POST_GUARD = 'POST_GUARD'  // Output safety verification
}

/**
 * Enhanced enum for safety check status including warning state
 * Enables fine-grained tracking of check results
 */
export enum SafetyStatus {
  PASS = 'PASS',       // Check passed successfully
  FAIL = 'FAIL',       // Check failed - content blocked
  WARNING = 'WARNING'  // Check passed with warnings
}

/**
 * Interface for detailed safety check results and metadata
 * Supports complete audit trail requirements
 */
export interface SafetyCheckDetails {
  score: number;                    // Safety check score (0-1)
  threshold: number;                // Threshold for pass/fail
  metadata: Record<string, any>;    // Additional check-specific data
}

/**
 * Comprehensive interface for safety check logging
 * Implements complete audit trail capabilities per technical specifications
 */
export interface ISafetyLog {
  /**
   * Unique identifier for the safety log entry
   */
  id: UUID;

  /**
   * Reference to the content generation request
   */
  generationId: UUID;

  /**
   * Reference to the model used for generation
   */
  modelId: UUID;

  /**
   * Type of guard (pre/post processing)
   */
  guardType: GuardType;

  /**
   * Specific type of safety check performed
   */
  checkType: SafetyCheckType;

  /**
   * Result status of the safety check
   */
  status: SafetyStatus;

  /**
   * Detailed results and metadata from the check
   */
  details: SafetyCheckDetails;

  /**
   * Current processing status of the check
   */
  processingStatus: ProcessingStatus;

  /**
   * Timestamp when the check was performed
   */
  timestamp: Date;
}