// External imports
import { UUID } from 'uuid'; // v9.0.0

// Internal imports
import { Status } from '../types/common';

/**
 * Enum defining types of safety guards in the system
 */
export enum GuardType {
  PRE_GUARD = 'PRE_GUARD',   // Input filtering guard
  POST_GUARD = 'POST_GUARD'  // Output safety guard
}

/**
 * Enum defining possible safety check statuses
 */
export enum SafetyStatus {
  PASS = 'PASS',       // Check passed successfully
  FAIL = 'FAIL',       // Check failed - content blocked
  WARNING = 'WARNING'  // Check passed with warnings
}

/**
 * Enum defining types of safety checks performed
 */
export enum SafetyCheckType {
  CONTENT_SAFETY = 'CONTENT_SAFETY',           // Harmful content detection
  FACE_DETECTION = 'FACE_DETECTION',           // Face detection for blurring
  PHYSICAL_CONSISTENCY = 'PHYSICAL_CONSISTENCY' // Physics/trajectory validation
}

/**
 * Interface for configuring individual safety checks
 */
export interface ISafetyCheckConfig {
  checkType: SafetyCheckType;     // Type of safety check
  enabled: boolean;               // Whether check is enabled
  threshold: number;              // Confidence threshold (0-1)
  autoRemediate: boolean;         // Auto-fix issues if possible
}

/**
 * Interface for configuring pre/post guards
 */
export interface IGuardConfig {
  guardType: GuardType;           // Type of guard (pre/post)
  enabled: boolean;               // Whether guard is enabled
  checks: ISafetyCheckConfig[];   // Array of safety checks
}

/**
 * Interface for safety check log entries providing complete audit trail
 */
export interface ISafetyLog {
  id: UUID;                       // Unique log entry ID
  generationId: UUID;             // ID of generation job
  guardType: GuardType;           // Type of guard that performed check
  checkType: SafetyCheckType;     // Type of check performed
  status: SafetyStatus;           // Result status
  details: Record<string, any>;   // Detailed check results
  timestamp: Date;                // When check was performed
}

/**
 * Interface for safety check results with remediation info
 */
export interface ISafetyCheckResult {
  status: SafetyStatus;           // Check status
  checkType: SafetyCheckType;     // Type of check
  confidence: number;             // Confidence score (0-1) 
  remediated: boolean;            // Whether issues were auto-fixed
  details: Record<string, any>;   // Detailed results
  processingStatus: Status;       // Check processing status
}

/**
 * Interface for safety metrics reporting
 */
export interface ISafetyMetrics {
  totalChecks: number;            // Total checks performed
  passRate: number;               // Percentage of passed checks
  faceBlurCompliance: number;     // Face blur compliance rate
  contentBlockRate: number;       // Harmful content block rate
  averageLatency: number;         // Average check latency (ms)
  checksByType: Record<SafetyCheckType, number>; // Checks by type
}