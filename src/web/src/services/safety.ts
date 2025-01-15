// External imports
import { UUID } from 'uuid'; // v9.0.0

// Internal imports
import { makeRequest } from '../utils/api';
import { apiConfig } from '../config/api';
import { 
  GuardType, 
  ISafetyCheckConfig, 
  IGuardConfig, 
  ISafetyLog,
  SafetyCheckType,
  SafetyStatus,
  ISafetyMetrics,
  ISafetyCheckResult
} from '../interfaces/ISafety';
import { ENDPOINTS } from '../constants/apiEndpoints';

/**
 * Rate limiting configuration for safety checks
 */
const SAFETY_RATE_LIMITS = {
  PRE_GUARD: 200,  // Pre-guard checks per minute
  POST_GUARD: 150  // Post-guard checks per minute
} as const;

/**
 * Cache TTL configuration (in milliseconds)
 */
const CACHE_TTL = {
  GUARD_CONFIG: 300000,   // 5 minutes
  SAFETY_METRICS: 60000,  // 1 minute
  SAFETY_LOGS: 120000     // 2 minutes
} as const;

/**
 * Enhanced service class for managing safety guardrails with real-time monitoring
 */
export class SafetyService {
  private baseUrl: string;
  private cache: Map<string, { data: any; timestamp: number }>;
  private rateLimiters: Map<GuardType, { count: number; resetTime: number }>;

  constructor() {
    this.baseUrl = apiConfig.baseURL;
    this.cache = new Map();
    this.rateLimiters = new Map();
    this.initializeRateLimiters();
  }

  /**
   * Initializes rate limiters for different guard types
   */
  private initializeRateLimiters(): void {
    Object.values(GuardType).forEach(guardType => {
      this.rateLimiters.set(guardType, {
        count: 0,
        resetTime: Date.now() + 60000
      });
    });
  }

  /**
   * Checks if operation is within rate limits
   * @param guardType Type of guard to check rate limit for
   * @returns Boolean indicating if operation is allowed
   */
  private checkRateLimit(guardType: GuardType): boolean {
    const limiter = this.rateLimiters.get(guardType);
    if (!limiter) return false;

    const now = Date.now();
    if (now >= limiter.resetTime) {
      limiter.count = 0;
      limiter.resetTime = now + 60000;
    }

    const limit = SAFETY_RATE_LIMITS[guardType === GuardType.PRE_GUARD ? 'PRE_GUARD' : 'POST_GUARD'];
    return limiter.count < limit;
  }

  /**
   * Updates rate limit counter for a guard type
   * @param guardType Guard type to update counter for
   */
  private updateRateLimit(guardType: GuardType): void {
    const limiter = this.rateLimiters.get(guardType);
    if (limiter) {
      limiter.count++;
    }
  }

  /**
   * Retrieves guard configuration with caching
   * @param guardType Type of guard to get configuration for
   * @returns Promise resolving to guard configuration
   */
  public async getGuardConfig(guardType: GuardType): Promise<IGuardConfig> {
    const cacheKey = `guard_config_${guardType}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL.GUARD_CONFIG) {
      return cached.data;
    }

    const response = await makeRequest<IGuardConfig>({
      endpoint: ENDPOINTS.SAFETY.POLICIES,
      method: 'GET',
      params: { guardType }
    });

    if (response.success) {
      this.cache.set(cacheKey, {
        data: response.data,
        timestamp: Date.now()
      });
      return response.data;
    }

    throw new Error(`Failed to fetch guard config: ${response.error?.message}`);
  }

  /**
   * Updates guard configuration with validation
   * @param guardType Type of guard to update
   * @param config New guard configuration
   * @returns Promise resolving to updated configuration
   */
  public async updateGuardConfig(guardType: GuardType, config: IGuardConfig): Promise<IGuardConfig> {
    if (!this.checkRateLimit(guardType)) {
      throw new Error('Rate limit exceeded for configuration updates');
    }

    const response = await makeRequest<IGuardConfig>({
      endpoint: ENDPOINTS.SAFETY.UPDATE_POLICY.replace(':id', guardType),
      method: 'PUT',
      params: config
    });

    if (response.success) {
      this.updateRateLimit(guardType);
      this.cache.delete(`guard_config_${guardType}`);
      return response.data;
    }

    throw new Error(`Failed to update guard config: ${response.error?.message}`);
  }

  /**
   * Retrieves safety check logs with pagination
   * @param params Query parameters for log retrieval
   * @returns Promise resolving to paginated safety logs
   */
  public async getSafetyLogs(params: {
    page: number;
    limit: number;
    guardType?: GuardType;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{ logs: ISafetyLog[]; total: number }> {
    const response = await makeRequest<{ logs: ISafetyLog[]; total: number }>({
      endpoint: ENDPOINTS.SAFETY.AUDIT_LOG,
      method: 'GET',
      params
    });

    if (response.success) {
      return response.data;
    }

    throw new Error(`Failed to fetch safety logs: ${response.error?.message}`);
  }

  /**
   * Retrieves real-time safety metrics
   * @returns Promise resolving to current safety metrics
   */
  public async getSafetyMetrics(): Promise<ISafetyMetrics> {
    const cacheKey = 'safety_metrics';
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL.SAFETY_METRICS) {
      return cached.data;
    }

    const response = await makeRequest<ISafetyMetrics>({
      endpoint: ENDPOINTS.SAFETY.POLICIES,
      method: 'GET',
      params: { type: 'metrics' }
    });

    if (response.success) {
      this.cache.set(cacheKey, {
        data: response.data,
        timestamp: Date.now()
      });
      return response.data;
    }

    throw new Error(`Failed to fetch safety metrics: ${response.error?.message}`);
  }

  /**
   * Performs safety check with auto-remediation
   * @param checkType Type of safety check to perform
   * @param content Content to check
   * @returns Promise resolving to check result
   */
  public async performSafetyCheck(
    checkType: SafetyCheckType,
    content: any
  ): Promise<ISafetyCheckResult> {
    const guardType = checkType === SafetyCheckType.CONTENT_SAFETY ? 
      GuardType.PRE_GUARD : GuardType.POST_GUARD;

    if (!this.checkRateLimit(guardType)) {
      throw new Error('Rate limit exceeded for safety checks');
    }

    const response = await makeRequest<ISafetyCheckResult>({
      endpoint: guardType === GuardType.PRE_GUARD ? 
        ENDPOINTS.SAFETY.PRE_CHECK : ENDPOINTS.SAFETY.POST_CHECK,
      method: 'POST',
      params: { checkType, content }
    });

    if (response.success) {
      this.updateRateLimit(guardType);
      return response.data;
    }

    throw new Error(`Safety check failed: ${response.error?.message}`);
  }

  /**
   * Handles automatic remediation for safety violations
   * @param violation Safety violation log entry
   * @returns Promise resolving to remediation success status
   */
  public async handleAutoRemediation(violation: ISafetyLog): Promise<boolean> {
    if (violation.status !== SafetyStatus.FAIL) {
      return true;
    }

    const response = await makeRequest<{ success: boolean }>({
      endpoint: `${ENDPOINTS.SAFETY.POST_CHECK}/remediate`,
      method: 'POST',
      params: { violation }
    });

    return response.success;
  }
}