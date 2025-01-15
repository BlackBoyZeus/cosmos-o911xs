// External imports
import axios from 'axios'; // ^1.4.0

// Internal imports
import { IGenerationRequest, IGenerationResponse, GenerationSafetyConfig } from '../interfaces/IGeneration';
import { makeRequest } from '../utils/api';
import { ENDPOINTS, TIMEOUTS } from '../constants/apiEndpoints';
import { Status } from '../types/common';
import { getStoredToken } from '../utils/auth';

/**
 * Constants for generation service
 */
const GENERATION_CONSTANTS = {
  MAX_RETRIES: 3,
  POLL_INTERVAL: 5000, // 5 seconds
  TIMEOUT: TIMEOUTS.GENERATION,
  MIN_PROGRESS_INCREMENT: 0.5,
  MAX_CONCURRENT_REQUESTS: 5
} as const;

/**
 * Validates safety configuration against platform requirements
 * @param config Safety configuration to validate
 * @returns Promise resolving to validation result
 */
async function validateSafetyConfig(config: GenerationSafetyConfig): Promise<boolean> {
  try {
    // Ensure required safety features are enabled
    if (!config.enableFaceBlur || !config.contentFiltering) {
      throw new Error('Face blur and content filtering must be enabled');
    }

    // Validate against safety policies
    const response = await makeRequest({
      endpoint: ENDPOINTS.SAFETY.PRE_CHECK,
      method: 'POST',
      params: { config },
      headers: {},
      timeout: TIMEOUTS.DEFAULT,
      retryConfig: { maxRetries: GENERATION_CONSTANTS.MAX_RETRIES }
    });

    return response.success;
  } catch (error) {
    console.error('Safety config validation failed:', error);
    throw error;
  }
}

/**
 * Checks request rate limits and resource availability
 * @param subscriptionTier User's subscription tier
 * @returns Promise resolving to rate limit check result
 */
async function checkRateLimit(subscriptionTier: string): Promise<boolean> {
  try {
    // Check GPU resource availability
    const gpuMetrics = await makeRequest({
      endpoint: ENDPOINTS.MONITORING.GPU_METRICS,
      method: 'GET',
      params: {},
      headers: {},
      timeout: TIMEOUTS.DEFAULT,
      retryConfig: { maxRetries: 2 }
    });

    if (!gpuMetrics.success || gpuMetrics.data.utilization > 90) {
      throw new Error('GPU resources currently unavailable');
    }

    // Check rate limits for subscription tier
    const response = await makeRequest({
      endpoint: ENDPOINTS.USERS.USAGE,
      method: 'GET',
      params: { tier: subscriptionTier },
      headers: {},
      timeout: TIMEOUTS.DEFAULT,
      retryConfig: { maxRetries: 2 }
    });

    return response.success && response.data.remainingRequests > 0;
  } catch (error) {
    console.error('Rate limit check failed:', error);
    throw error;
  }
}

/**
 * Submits a new video generation request
 * @param request Generation request parameters
 * @returns Promise resolving to generation response
 */
export async function submitGenerationRequest(
  request: IGenerationRequest
): Promise<IGenerationResponse> {
  try {
    // Validate authentication
    const token = getStoredToken();
    if (!token) {
      throw new Error('Authentication required');
    }

    // Validate safety configuration
    await validateSafetyConfig(request.safetySettings);

    // Check rate limits
    await checkRateLimit(request.subscriptionTier);

    // Submit generation request
    const response = await makeRequest({
      endpoint: ENDPOINTS.GENERATION.CREATE_JOB,
      method: 'POST',
      params: request,
      headers: {
        'X-Request-Priority': request.priority || 'normal',
        'X-Model-Type': request.modelType
      },
      timeout: GENERATION_CONSTANTS.TIMEOUT,
      retryConfig: { maxRetries: GENERATION_CONSTANTS.MAX_RETRIES }
    });

    if (!response.success) {
      throw new Error(response.error?.message || 'Generation request failed');
    }

    return response.data;
  } catch (error) {
    console.error('Generation request submission failed:', error);
    throw error;
  }
}

/**
 * Retrieves generation status and progress
 * @param requestId Generation request ID
 * @returns Promise resolving to generation status
 */
export async function getGenerationStatus(requestId: string): Promise<IGenerationResponse> {
  try {
    const response = await makeRequest({
      endpoint: ENDPOINTS.GENERATION.JOB_STATUS.replace(':id', requestId),
      method: 'GET',
      params: {},
      headers: {},
      timeout: TIMEOUTS.DEFAULT,
      retryConfig: { maxRetries: 2 }
    });

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch generation status');
    }

    // Enhance response with performance metrics
    if (response.data.status === Status.PROCESSING) {
      const metrics = await makeRequest({
        endpoint: ENDPOINTS.MONITORING.GPU_METRICS,
        method: 'GET',
        params: { jobId: requestId },
        headers: {},
        timeout: TIMEOUTS.DEFAULT,
        retryConfig: { maxRetries: 1 }
      });

      if (metrics.success) {
        response.data.resourceUtilization = metrics.data;
      }
    }

    return response.data;
  } catch (error) {
    console.error('Failed to fetch generation status:', error);
    throw error;
  }
}

/**
 * Cancels an active generation request
 * @param requestId Generation request ID
 * @returns Promise resolving when cancellation is complete
 */
export async function cancelGeneration(requestId: string): Promise<void> {
  try {
    const response = await makeRequest({
      endpoint: ENDPOINTS.GENERATION.CANCEL_JOB.replace(':id', requestId),
      method: 'POST',
      params: {},
      headers: {},
      timeout: TIMEOUTS.DEFAULT,
      retryConfig: { maxRetries: 2 }
    });

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to cancel generation');
    }

    // Clean up resources
    await makeRequest({
      endpoint: ENDPOINTS.MONITORING.RESOURCES,
      method: 'DELETE',
      params: { jobId: requestId },
      headers: {},
      timeout: TIMEOUTS.DEFAULT,
      retryConfig: { maxRetries: 1 }
    });
  } catch (error) {
    console.error('Generation cancellation failed:', error);
    throw error;
  }
}