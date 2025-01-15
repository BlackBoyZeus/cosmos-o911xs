// External imports
import { describe, test, expect, beforeEach, jest } from '@jest/globals'; // ^29.0.0
import MockAdapter from 'axios-mock-adapter'; // ^1.22.0
import axios from 'axios';

// Internal imports
import { apiService } from '../../src/services/api';
import { ApiResponse, ApiError, GenerationResponse, SystemMetricsResponse } from '../../src/types/api';
import { Status } from '../../src/types/common';
import { AUTH_CONFIG } from '../../src/config/auth';

// Test constants
const TEST_ENDPOINT = '/api/test';
const TEST_TIMEOUT = 5000;
const GPU_TEMP_THRESHOLD = 80;
const GPU_UTIL_THRESHOLD = 0.9;
const GPU_MEM_THRESHOLD = 0.95;

// Mock axios instance
const mockAxios = new MockAdapter(axios);

// Mock GPU metrics response
const mockGpuMetrics: SystemMetricsResponse = {
  gpuUtilization: 0.75,
  gpuTemperature: 65,
  memoryUsage: 0.8,
  storageUsage: 0.6,
  activeJobs: 5,
  queuedJobs: 2,
  timestamp: Date.now()
};

describe('API Service Tests', () => {
  beforeEach(() => {
    mockAxios.reset();
    mockAxios.onGet('/api/v1/monitoring/gpu').reply(200, mockGpuMetrics);
    jest.clearAllMocks();
  });

  describe('GPU Metrics Integration', () => {
    test('should fetch and validate GPU metrics', async () => {
      const metrics = await apiService.getGpuMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics.utilization).toBeLessThan(GPU_UTIL_THRESHOLD);
      expect(metrics.temperature).toBeLessThan(GPU_TEMP_THRESHOLD);
      expect(metrics.memoryUsage).toBeLessThan(GPU_MEM_THRESHOLD);
      expect(metrics.timestamp).toBeDefined();
    });

    test('should handle GPU metrics fetch failure', async () => {
      mockAxios.onGet('/api/v1/monitoring/gpu').networkError();
      
      const metrics = await apiService.getGpuMetrics();
      expect(metrics).toBeNull();
    });

    test('should include GPU metrics in request headers', async () => {
      mockAxios.onGet(TEST_ENDPOINT).reply(config => {
        expect(config.headers['X-GPU-Utilization']).toBeDefined();
        expect(config.headers['X-GPU-Temperature']).toBeDefined();
        return [200, { data: 'success' }];
      });

      await apiService.get(TEST_ENDPOINT);
    });
  });

  describe('Temperature-based Retry Logic', () => {
    test('should retry when temperature is below threshold', async () => {
      let attempts = 0;
      mockAxios.onGet(TEST_ENDPOINT).reply(() => {
        attempts++;
        return attempts < 3 ? [503, {}] : [200, { data: 'success' }];
      });

      const response = await apiService.get(TEST_ENDPOINT);
      expect(response.success).toBe(true);
      expect(attempts).toBe(3);
    });

    test('should not retry when temperature exceeds threshold', async () => {
      mockAxios.onGet('/api/v1/monitoring/gpu').reply(200, {
        ...mockGpuMetrics,
        gpuTemperature: 85
      });

      mockAxios.onGet(TEST_ENDPOINT).reply(503);

      const response = await apiService.get(TEST_ENDPOINT);
      expect(response.success).toBe(false);
      expect(response.error.code).toBe('503');
    });
  });

  describe('GPU-Aware Rate Limiting', () => {
    test('should adjust rate limits based on GPU utilization', async () => {
      mockAxios.onGet('/api/v1/monitoring/gpu').reply(200, {
        ...mockGpuMetrics,
        gpuUtilization: 0.95
      });

      const promises = Array(5).fill(null).map(() => 
        apiService.get(TEST_ENDPOINT)
      );

      const responses = await Promise.all(promises);
      const failedRequests = responses.filter(r => !r.success);
      expect(failedRequests.length).toBeGreaterThan(0);
    });

    test('should enforce cooling period when GPU is stressed', async () => {
      mockAxios.onGet('/api/v1/monitoring/gpu').reply(200, {
        ...mockGpuMetrics,
        gpuTemperature: 78,
        gpuUtilization: 0.88
      });

      const response = await apiService.get(TEST_ENDPOINT);
      expect(response.gpuMetrics).toBeDefined();
      expect(response.gpuMetrics.temperature).toBeLessThan(GPU_TEMP_THRESHOLD);
    });
  });

  describe('GPU-Aware Authentication', () => {
    test('should include GPU permissions in auth token validation', async () => {
      const mockToken = 'mock-token';
      mockAxios.onGet(TEST_ENDPOINT).reply(config => {
        expect(config.headers.Authorization).toBe(`Bearer ${mockToken}`);
        expect(config.headers['X-GPU-Access']).toBeDefined();
        return [200, { data: 'success' }];
      });

      localStorage.setItem(AUTH_CONFIG.token.storageKey, mockToken);
      await apiService.get(TEST_ENDPOINT);
    });

    test('should handle GPU permission denied errors', async () => {
      mockAxios.onGet(TEST_ENDPOINT).reply(403, {
        error: {
          code: 'GPU_ACCESS_DENIED',
          message: 'Insufficient GPU permissions'
        }
      });

      const response = await apiService.get(TEST_ENDPOINT);
      expect(response.success).toBe(false);
      expect(response.error.code).toBe('GPU_ACCESS_DENIED');
    });
  });

  describe('Generation Pipeline Integration', () => {
    test('should handle model generation requests with GPU context', async () => {
      const generationRequest = {
        prompt: 'test prompt',
        modelType: 'diffusion' as const,
        modelSize: '7B' as const,
        numFrames: 57,
        resolution: { width: 1280, height: 720 },
        status: Status.PENDING
      };

      const mockResponse: GenerationResponse = {
        jobId: '123',
        status: Status.PROCESSING,
        progress: 0,
        estimatedTimeRemaining: 300,
      };

      mockAxios.onPost('/api/v1/generation/jobs').reply(config => {
        expect(config.headers['X-GPU-Metrics-Enabled']).toBe('true');
        return [200, mockResponse];
      });

      const response = await apiService.post<GenerationResponse>(
        '/api/v1/generation/jobs',
        generationRequest
      );

      expect(response.success).toBe(true);
      expect(response.data.jobId).toBe('123');
      expect(response.gpuMetrics).toBeDefined();
    });

    test('should handle generation errors with GPU context', async () => {
      mockAxios.onPost('/api/v1/generation/jobs').reply(500, {
        error: {
          code: 'GPU_OVERLOAD',
          message: 'GPU resources exhausted'
        }
      });

      const response = await apiService.post('/api/v1/generation/jobs', {});
      expect(response.success).toBe(false);
      expect(response.error.code).toBe('GPU_OVERLOAD');
      expect(response.gpuMetrics).toBeDefined();
    });
  });
});