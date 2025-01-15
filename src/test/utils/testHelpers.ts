import { jest } from '@jest/globals'; // ^29.0.0
import { faker } from '@faker-js/faker'; // ^8.0.0

// Internal imports
import { createMockDataset, createMockModel } from './mockData';
import { MockDataset } from './databaseMock';
import { mockInitializeGPU, mockSimulateGPUStress } from './gpuMock';
import { ProcessingStatus, VideoResolutionImpl } from '../../backend/src/types/common';
import { SafetyCheckType, SafetyStatus } from '../../backend/src/types/safety';
import { IDataset } from '../../backend/src/interfaces/IDataset';

// Global test configuration constants
export const DEFAULT_TIMEOUT = 30000;
export const DEFAULT_POLL_INTERVAL = 100;

/**
 * Sets up enhanced test environment with thread-safe mock implementations,
 * GPU simulation, quality metrics, and safety checks
 */
export async function setupTestEnvironment(config: TestConfig = {}): Promise<void> {
  try {
    // Initialize GPU simulation
    await mockInitializeGPU({
      deviceCount: config.gpuDevices ?? 2,
      memoryLimit: config.gpuMemory ?? 80 * 1024 * 1024 * 1024, // 80GB default
      computeCapability: '8.0',
      deviceType: 'H100',
      parallelization: {
        modelParallel: true,
        dataParallel: true,
        pipelineParallel: true,
        tensorParallel: true,
        deviceMapping: { 0: 0, 1: 1 }
      }
    });

    // Set up mock database with thread safety
    const mockDb = new MockDataset();
    
    // Create initial test datasets with quality metrics
    const baseDataset = createMockDataset({
      name: 'test-dataset',
      resolution: new VideoResolutionImpl(1920, 1080),
      metrics: {
        psnr: 35.0,
        ssim: 0.95,
        fid: 25.0,
        fvd: 100.0
      }
    });
    await mockDb.create(baseDataset);

    // Configure test timeouts
    jest.setTimeout(config.timeout ?? DEFAULT_TIMEOUT);

    // Initialize performance tracking
    if (config.enableProfiling) {
      jest.spyOn(global.performance, 'now');
    }

    // Set up safety check mocks
    jest.spyOn(global, 'fetch').mockImplementation(async () => {
      return {
        ok: true,
        json: async () => ({
          status: SafetyStatus.PASS,
          checkType: SafetyCheckType.CONTENT_SAFETY,
          score: 0.95
        })
      } as Response;
    });

  } catch (error) {
    console.error('Test environment setup failed:', error);
    throw error;
  }
}

/**
 * Performs comprehensive cleanup of test environment with validation
 * and resource verification
 */
export async function teardownTestEnvironment(): Promise<void> {
  try {
    // Release GPU resources
    for (let deviceId = 0; deviceId < 2; deviceId++) {
      await mockSimulateGPUStress(deviceId, 0);
    }

    // Clear mock databases
    const mockDb = new MockDataset();
    await Promise.all([
      mockDb['data'].clear()
    ]);

    // Reset all mocks
    jest.restoreAllMocks();
    jest.clearAllTimers();

    // Clear performance metrics
    if (global.performance) {
      delete (global as any).performance;
    }

  } catch (error) {
    console.error('Test environment teardown failed:', error);
    throw error;
  }
}

/**
 * Creates a test dataset with comprehensive quality metrics and validation
 */
export async function createTestDataset(config: DatasetConfig): Promise<IDataset> {
  try {
    const dataset = createMockDataset({
      name: config.name,
      resolution: new VideoResolutionImpl(
        config.resolution?.width ?? 1920,
        config.resolution?.height ?? 1080
      ),
      metrics: {
        psnr: config.metrics?.psnr ?? 35.0,
        ssim: config.metrics?.ssim ?? 0.95,
        fid: config.metrics?.fid ?? 25.0,
        fvd: config.metrics?.fvd ?? 100.0
      },
      status: ProcessingStatus.COMPLETED
    });

    const mockDb = new MockDataset();
    return await mockDb.create(dataset);

  } catch (error) {
    console.error('Test dataset creation failed:', error);
    throw error;
  }
}

/**
 * Enhanced utility to wait for async processing with progress tracking
 * and timeout management
 */
export async function waitForProcessing(timeoutMs: number = DEFAULT_TIMEOUT): Promise<void> {
  const startTime = Date.now();
  let elapsed = 0;

  try {
    while (elapsed < timeoutMs) {
      // Check processing status
      const status = await checkProcessingStatus();
      
      if (status === ProcessingStatus.COMPLETED) {
        return;
      } else if (status === ProcessingStatus.FAILED) {
        throw new Error('Processing failed');
      }

      // Wait before next check
      await new Promise(resolve => setTimeout(resolve, DEFAULT_POLL_INTERVAL));
      elapsed = Date.now() - startTime;
    }

    throw new Error(`Processing timed out after ${timeoutMs}ms`);

  } catch (error) {
    console.error('Wait for processing failed:', error);
    throw error;
  }
}

// Helper Types
interface TestConfig {
  gpuDevices?: number;
  gpuMemory?: number;
  timeout?: number;
  enableProfiling?: boolean;
}

interface DatasetConfig {
  name: string;
  resolution?: {
    width: number;
    height: number;
  };
  metrics?: {
    psnr: number;
    ssim: number;
    fid: number;
    fvd: number;
  };
}

// Helper function to check processing status
async function checkProcessingStatus(): Promise<ProcessingStatus> {
  // Simulate processing check
  const random = Math.random();
  if (random < 0.7) {
    return ProcessingStatus.PROCESSING;
  } else if (random < 0.9) {
    return ProcessingStatus.COMPLETED;
  }
  return ProcessingStatus.FAILED;
}