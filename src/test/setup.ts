import { jest } from '@jest/globals'; // ^29.0.0
import dotenv from 'dotenv'; // ^16.0.0
import winston from 'winston'; // ^3.8.0

// Internal imports
import { createMockDataset } from './utils/mockData';
import { MockDataset } from './utils/databaseMock';
import { mockInitializeGPU } from './utils/gpuMock';

// Initialize logger for test debugging
const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'test.log' })
  ]
});

/**
 * Configures the test environment with comprehensive setup including GPU mocks and logging
 */
export async function setupTestEnvironment(): Promise<void> {
  try {
    // Load test environment variables
    const result = dotenv.config({ path: '.env.test' });
    if (result.error) {
      throw new Error('Failed to load test environment variables');
    }

    // Configure Jest timeout for long-running tests
    jest.setTimeout(30000);

    // Set test environment
    process.env.NODE_ENV = 'test';

    // Configure GPU mock settings
    process.env.GPU_MOCK_MEMORY = '80000'; // 80GB GPU memory
    process.env.GPU_MOCK_COMPUTE = '100'; // 100% compute capability

    // Initialize GPU mocks
    const gpuConfig = {
      deviceCount: 4,
      memoryLimit: parseInt(process.env.GPU_MOCK_MEMORY),
      computeCapability: '8.0',
      deviceType: 'H100',
      parallelization: {
        modelParallel: true,
        dataParallel: true,
        pipelineParallel: true,
        tensorParallel: true,
        deviceMapping: { 0: 0, 1: 1, 2: 2, 3: 3 }
      }
    };

    const gpuInitialized = await mockInitializeGPU(gpuConfig);
    if (!gpuInitialized) {
      throw new Error('Failed to initialize GPU mocks');
    }

    // Initialize thread-safe mock databases
    const mockDataset = new MockDataset();
    
    // Create initial test dataset
    const testDataset = createMockDataset({
      name: 'test_dataset',
      videoCount: 100,
      size: 1024 * 1024 * 1024 // 1GB
    });
    await mockDataset.create(testDataset);

    logger.info('Test environment setup completed successfully', {
      gpuConfig,
      testDataset: testDataset.id
    });

    // Validate environment setup
    if (!validateEnvironment()) {
      throw new Error('Environment validation failed');
    }
  } catch (error) {
    logger.error('Test environment setup failed', { error });
    throw error;
  }
}

/**
 * Performs comprehensive cleanup of test environment and resources
 */
export async function teardownTestEnvironment(): Promise<void> {
  try {
    // Clear all mock databases
    const mockDataset = new MockDataset();
    await mockDataset.clearAll();

    // Reset GPU mock state
    await mockInitializeGPU({
      deviceCount: 0,
      memoryLimit: 0,
      computeCapability: '0.0',
      deviceType: 'H100',
      parallelization: {
        modelParallel: false,
        dataParallel: false,
        pipelineParallel: false,
        tensorParallel: false,
        deviceMapping: {}
      }
    });

    // Clear environment variables
    process.env.GPU_MOCK_MEMORY = '';
    process.env.GPU_MOCK_COMPUTE = '';

    // Reset Jest configuration
    jest.setTimeout(5000);

    // Clear test logs
    logger.clear();

    logger.info('Test environment teardown completed successfully');
  } catch (error) {
    logger.error('Test environment teardown failed', { error });
    throw error;
  }
}

/**
 * Validates required test environment configuration
 */
export function validateEnvironment(): boolean {
  try {
    // Check required environment variables
    const requiredEnvVars = [
      'NODE_ENV',
      'GPU_MOCK_MEMORY',
      'GPU_MOCK_COMPUTE'
    ];

    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        logger.error(`Missing required environment variable: ${envVar}`);
        return false;
      }
    }

    // Validate GPU mock configuration
    if (parseInt(process.env.GPU_MOCK_MEMORY) <= 0) {
      logger.error('Invalid GPU mock memory configuration');
      return false;
    }

    if (parseInt(process.env.GPU_MOCK_COMPUTE) <= 0 || 
        parseInt(process.env.GPU_MOCK_COMPUTE) > 100) {
      logger.error('Invalid GPU mock compute configuration');
      return false;
    }

    // Validate NODE_ENV
    if (process.env.NODE_ENV !== 'test') {
      logger.error('NODE_ENV must be set to "test"');
      return false;
    }

    logger.info('Environment validation completed successfully');
    return true;
  } catch (error) {
    logger.error('Environment validation failed', { error });
    return false;
  }
}