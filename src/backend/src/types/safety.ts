// @types/node version: ^18.0.0
import { UUID } from 'crypto';
import { ProcessingStatus } from './common';

/**
 * Enum defining comprehensive types of safety checks performed by the system
 * Maps to safety requirements from technical specifications
 */
export enum SafetyCheckType {
  CONTENT_SAFETY = 'CONTENT_SAFETY',       // General content safety screening
  FACE_DETECTION = 'FACE_DETECTION',       // Face detection for blur compliance
  HARMFUL_CONTENT = 'HARMFUL_CONTENT',     // Harmful content detection
  BIAS_CHECK = 'BIAS_CHECK',              // AI bias detection
  PRIVACY_CHECK = 'PRIVACY_CHECK',        // Privacy compliance verification
  COMPLIANCE_CHECK = 'COMPLIANCE_CHECK'    // Regulatory compliance check
}

/**
 * Interface defining configurable thresholds for different safety checks
 * Enables fine-tuning of safety parameters based on requirements
 */
export interface SafetyThresholds {
  readonly contentSafetyThreshold: number;    // 0-1 threshold for content safety
  readonly faceDetectionThreshold: number;    // 0-1 threshold for face detection confidence
  readonly harmfulContentThreshold: number;   // 0-1 threshold for harmful content
  readonly biasCheckThreshold: number;        // 0-1 threshold for bias detection
  readonly privacyThreshold: number;          // 0-1 threshold for privacy compliance
  readonly complianceThreshold: number;       // 0-1 threshold for regulatory compliance

  /**
   * Validates all threshold values are within valid range
   */
  validate(): boolean;

  /**
   * Checks if a score passes the corresponding threshold
   */
  checkThreshold(type: SafetyCheckType, score: number): boolean;
}

/**
 * Interface for tracking comprehensive safety check metrics
 * Supports audit trail and performance monitoring requirements
 */
export interface SafetyMetrics {
  readonly totalChecks: number;              // Total number of safety checks performed
  readonly passedChecks: number;             // Number of checks that passed
  readonly failedChecks: number;             // Number of checks that failed
  readonly warningChecks: number;            // Number of checks with warnings
  readonly averageProcessingTime: number;    // Average time per check in ms
  readonly checkTimestamps: Map<UUID, Date>; // Timestamps for each check
  readonly checkDurations: Map<UUID, number>; // Duration of each check in ms
  readonly auditTrail: Map<UUID, SafetyAuditRecord>; // Complete audit trail

  /**
   * Calculate pass rate percentage
   */
  getPassRate(): number;

  /**
   * Calculate average processing time
   */
  getAverageProcessingTime(): number;

  /**
   * Get audit trail for a specific time range
   */
  getAuditTrailInRange(startDate: Date, endDate: Date): SafetyAuditRecord[];
}

/**
 * Interface for detailed safety check audit records
 * Ensures complete audit trail coverage per technical requirements
 */
export interface SafetyAuditRecord {
  readonly checkId: UUID;                    // Unique identifier for the check
  readonly checkType: SafetyCheckType;       // Type of safety check performed
  readonly timestamp: Date;                  // When the check was performed
  readonly result: ProcessingStatus;         // Result of the check
  readonly details: Record<string, any>;     // Detailed check results and metadata

  /**
   * Validates audit record completeness
   */
  validate(): boolean;

  /**
   * Converts audit record to string format
   */
  toString(): string;
}

/**
 * Implementation of SafetyThresholds interface
 */
export class SafetyThresholdsImpl implements SafetyThresholds {
  constructor(
    public readonly contentSafetyThreshold: number = 0.8,
    public readonly faceDetectionThreshold: number = 0.9,
    public readonly harmfulContentThreshold: number = 0.9,
    public readonly biasCheckThreshold: number = 0.7,
    public readonly privacyThreshold: number = 0.9,
    public readonly complianceThreshold: number = 0.95
  ) {}

  validate(): boolean {
    return [
      this.contentSafetyThreshold,
      this.faceDetectionThreshold,
      this.harmfulContentThreshold,
      this.biasCheckThreshold,
      this.privacyThreshold,
      this.complianceThreshold
    ].every(threshold => threshold >= 0 && threshold <= 1);
  }

  checkThreshold(type: SafetyCheckType, score: number): boolean {
    const thresholdMap = {
      [SafetyCheckType.CONTENT_SAFETY]: this.contentSafetyThreshold,
      [SafetyCheckType.FACE_DETECTION]: this.faceDetectionThreshold,
      [SafetyCheckType.HARMFUL_CONTENT]: this.harmfulContentThreshold,
      [SafetyCheckType.BIAS_CHECK]: this.biasCheckThreshold,
      [SafetyCheckType.PRIVACY_CHECK]: this.privacyThreshold,
      [SafetyCheckType.COMPLIANCE_CHECK]: this.complianceThreshold
    };
    return score >= thresholdMap[type];
  }
}

/**
 * Implementation of SafetyMetrics interface
 */
export class SafetyMetricsImpl implements SafetyMetrics {
  constructor(
    public readonly totalChecks: number = 0,
    public readonly passedChecks: number = 0,
    public readonly failedChecks: number = 0,
    public readonly warningChecks: number = 0,
    public readonly averageProcessingTime: number = 0,
    public readonly checkTimestamps: Map<UUID, Date> = new Map(),
    public readonly checkDurations: Map<UUID, number> = new Map(),
    public readonly auditTrail: Map<UUID, SafetyAuditRecord> = new Map()
  ) {}

  getPassRate(): number {
    return this.totalChecks > 0 ? (this.passedChecks / this.totalChecks) * 100 : 0;
  }

  getAverageProcessingTime(): number {
    return this.averageProcessingTime;
  }

  getAuditTrailInRange(startDate: Date, endDate: Date): SafetyAuditRecord[] {
    return Array.from(this.auditTrail.values()).filter(record => 
      record.timestamp >= startDate && record.timestamp <= endDate
    );
  }
}

/**
 * Implementation of SafetyAuditRecord interface
 */
export class SafetyAuditRecordImpl implements SafetyAuditRecord {
  constructor(
    public readonly checkId: UUID,
    public readonly checkType: SafetyCheckType,
    public readonly timestamp: Date,
    public readonly result: ProcessingStatus,
    public readonly details: Record<string, any>
  ) {}

  validate(): boolean {
    return (
      this.checkId !== undefined &&
      Object.values(SafetyCheckType).includes(this.checkType) &&
      this.timestamp instanceof Date &&
      Object.values(ProcessingStatus).includes(this.result) &&
      this.details !== undefined
    );
  }

  toString(): string {
    return JSON.stringify({
      checkId: this.checkId,
      checkType: this.checkType,
      timestamp: this.timestamp.toISOString(),
      result: this.result,
      details: this.details
    }, null, 2);
  }
}