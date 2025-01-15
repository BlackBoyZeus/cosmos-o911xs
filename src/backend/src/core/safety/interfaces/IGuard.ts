// @types/node version: ^18.0.0
import { UUID } from 'crypto';
import { GuardType, SafetyStatus, SafetyCheckDetails } from '../../../interfaces/ISafetyLog';

/**
 * Interface defining the contract for safety guard implementations (PreGuard and PostGuard)
 * Provides comprehensive safety checks, audit logging, and error handling capabilities
 * per technical specifications requirements for the Cosmos WFM platform's safety system
 */
export interface IGuard {
  /**
   * Type of guard (PRE_GUARD or POST_GUARD)
   * Used to determine appropriate safety checks and thresholds
   */
  readonly guardType: GuardType;

  /**
   * Performs comprehensive safety checks on content with enhanced error handling 
   * and metadata tracking capabilities
   * 
   * @param content - Content to be checked (can be input text/params for PreGuard 
   *                 or generated content for PostGuard)
   * @param options - Additional check options and configuration parameters
   * @returns Promise resolving to SafetyStatus (PASS/FAIL/WARNING) with detailed error information
   * @throws Error if check cannot be performed or critical error occurs
   */
  check(
    content: any,
    options: Record<string, any>
  ): Promise<SafetyStatus>;

  /**
   * Logs safety check results with enhanced audit trail capabilities and detailed metadata
   * Ensures complete audit trail coverage per technical specifications
   * 
   * @param generationId - Unique identifier for the content generation request
   * @param modelId - Identifier of the model used for generation
   * @param status - Result status of the safety check (PASS/FAIL/WARNING)
   * @param details - Detailed results and metadata from the check
   * @returns Promise that resolves when logging is complete
   * @throws Error if logging fails or audit trail cannot be maintained
   */
  logCheck(
    generationId: UUID,
    modelId: UUID,
    status: SafetyStatus,
    details: SafetyCheckDetails
  ): Promise<void>;
}