import { jest } from '@jest/globals'; // ^29.0.0
import { GPUConfig } from '../../backend/src/types/config';

// Mock GPU state interface
interface GPUDeviceState {
  allocated: number;
  utilization: number;
  memoryFragmentation: number;
  errorCondition: string | null;
  lastOperationTime: number;
  temperature: number;
}

// Global mock state
const mockGPUState: {
  deviceStates: Map<number, GPUDeviceState>;
  globalConfig: GPUConfig | null;
} = {
  deviceStates: new Map(),
  globalConfig: null
};

// Constants for realistic simulation
const SIMULATION_CONSTANTS = {
  MIN_UTILIZATION: 50,
  MAX_UTILIZATION: 80,
  BASE_TEMPERATURE: 45,
  MAX_TEMPERATURE: 85,
  FRAGMENTATION_RATE: 0.05,
  OPERATION_LATENCY: 50, // ms
  STRESS_THRESHOLD: 85
};

/**
 * Mock implementation of GPU initialization
 * @param config GPU configuration object
 * @returns Promise resolving to initialization success status
 */
export const mockInitializeGPU = async (config: GPUConfig): Promise<boolean> => {
  try {
    // Validate device count
    if (config.deviceCount <= 0) {
      throw new Error('Invalid device count specified');
    }

    // Initialize device states
    mockGPUState.deviceStates.clear();
    mockGPUState.globalConfig = config;

    for (let i = 0; i < config.deviceCount; i++) {
      mockGPUState.deviceStates.set(i, {
        allocated: 0,
        utilization: SIMULATION_CONSTANTS.MIN_UTILIZATION,
        memoryFragmentation: 0,
        errorCondition: null,
        lastOperationTime: Date.now(),
        temperature: SIMULATION_CONSTANTS.BASE_TEMPERATURE
      });
    }

    await simulateLatency();
    return true;
  } catch (error) {
    console.error('GPU initialization failed:', error);
    return false;
  }
};

/**
 * Enhanced mock implementation of GPU metrics collection
 * @param deviceId GPU device identifier
 * @returns Promise resolving to GPU metrics object
 */
export const mockGetGPUMetrics = async (deviceId: number): Promise<object> => {
  const deviceState = validateAndGetDeviceState(deviceId);
  await simulateLatency();

  const utilizationVariation = Math.random() * 10 - 5; // +/- 5%
  deviceState.utilization = Math.min(
    Math.max(
      deviceState.utilization + utilizationVariation,
      SIMULATION_CONSTANTS.MIN_UTILIZATION
    ),
    SIMULATION_CONSTANTS.MAX_UTILIZATION
  );

  deviceState.temperature = SIMULATION_CONSTANTS.BASE_TEMPERATURE + 
    (deviceState.utilization / 100) * (SIMULATION_CONSTANTS.MAX_TEMPERATURE - SIMULATION_CONSTANTS.BASE_TEMPERATURE);

  return {
    deviceId,
    memoryUsed: deviceState.allocated,
    memoryTotal: mockGPUState.globalConfig?.memoryLimit || 0,
    utilization: deviceState.utilization,
    temperature: deviceState.temperature,
    memoryFragmentation: deviceState.memoryFragmentation,
    errorCondition: deviceState.errorCondition,
    timestamp: Date.now()
  };
};

/**
 * Advanced mock implementation of GPU memory allocation
 * @param deviceId GPU device identifier
 * @param memorySize Memory size to allocate in bytes
 * @returns Promise resolving to allocation success status
 */
export const mockAllocateGPUMemory = async (
  deviceId: number,
  memorySize: number
): Promise<boolean> => {
  const deviceState = validateAndGetDeviceState(deviceId);
  const memoryLimit = mockGPUState.globalConfig?.memoryLimit || 0;

  await simulateLatency();

  // Check memory limits including fragmentation
  const effectiveMemorySize = memorySize * (1 + deviceState.memoryFragmentation);
  if (deviceState.allocated + effectiveMemorySize > memoryLimit) {
    deviceState.errorCondition = 'OUT_OF_MEMORY';
    return false;
  }

  // Update device state
  deviceState.allocated += memorySize;
  deviceState.memoryFragmentation += SIMULATION_CONSTANTS.FRAGMENTATION_RATE;
  deviceState.lastOperationTime = Date.now();

  return true;
};

/**
 * Enhanced mock implementation of GPU memory release
 * @param deviceId GPU device identifier
 */
export const mockReleaseGPUMemory = async (deviceId: number): Promise<void> => {
  const deviceState = validateAndGetDeviceState(deviceId);
  await simulateLatency();

  deviceState.allocated = 0;
  deviceState.memoryFragmentation = Math.max(0, deviceState.memoryFragmentation - 0.1);
  deviceState.errorCondition = null;
  deviceState.lastOperationTime = Date.now();
};

/**
 * GPU stress simulation for testing edge cases
 * @param deviceId GPU device identifier
 * @param stressLevel Stress level (0-100)
 */
export const mockSimulateGPUStress = async (
  deviceId: number,
  stressLevel: number
): Promise<void> => {
  const deviceState = validateAndGetDeviceState(deviceId);

  if (stressLevel < 0 || stressLevel > 100) {
    throw new Error('Invalid stress level specified');
  }

  await simulateLatency();

  deviceState.utilization = Math.min(100, stressLevel);
  deviceState.temperature = SIMULATION_CONSTANTS.BASE_TEMPERATURE +
    (stressLevel / 100) * (SIMULATION_CONSTANTS.MAX_TEMPERATURE - SIMULATION_CONSTANTS.BASE_TEMPERATURE);

  if (stressLevel > SIMULATION_CONSTANTS.STRESS_THRESHOLD) {
    deviceState.errorCondition = 'THERMAL_THROTTLING';
  }

  deviceState.lastOperationTime = Date.now();
};

// Helper function to validate device ID and get device state
function validateAndGetDeviceState(deviceId: number): GPUDeviceState {
  if (!mockGPUState.globalConfig) {
    throw new Error('GPU not initialized');
  }

  const deviceState = mockGPUState.deviceStates.get(deviceId);
  if (!deviceState) {
    throw new Error(`Invalid device ID: ${deviceId}`);
  }

  return deviceState;
}

// Helper function to simulate operation latency
async function simulateLatency(): Promise<void> {
  await new Promise(resolve => 
    setTimeout(resolve, SIMULATION_CONSTANTS.OPERATION_LATENCY)
  );
}