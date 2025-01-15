// External imports
import { cuda } from '@nvidia/cuda'; // v12.0.0
import { Logger } from 'winston'; // v3.8.0

// Internal imports
import { GPUConfig } from '../types/config';

// Initialize logger
const logger = new Logger({
  level: 'info',
  format: Logger.format.json(),
  transports: [
    new Logger.transports.Console(),
    new Logger.transports.File({ filename: 'gpu-operations.log' })
  ]
});

// Performance tracking interface
interface GPUMetrics {
  deviceId: number;
  utilizationPercent: number;
  memoryUsed: number;
  memoryTotal: number;
  temperature: number;
  powerUsage: number;
  computeProcesses: number;
  latencyMs: number;
  scalingMetrics: {
    queueLength: number;
    activeWorkers: number;
    pendingRequests: number;
  };
}

// Retry decorator implementation
function retryable(options: { maxAttempts: number; backoff: number }) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = async function (...args: any[]) {
      let attempt = 0;
      while (attempt < options.maxAttempts) {
        try {
          return await originalMethod.apply(this, args);
        } catch (error) {
          attempt++;
          if (attempt === options.maxAttempts) throw error;
          await new Promise(resolve => setTimeout(resolve, options.backoff * attempt));
          logger.warn(`Retrying ${propertyKey}, attempt ${attempt}/${options.maxAttempts}`);
        }
      }
    };
    return descriptor;
  };
}

// Monitoring decorator implementation
function monitor(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  descriptor.value = async function (...args: any[]) {
    const start = process.hrtime();
    try {
      const result = await originalMethod.apply(this, args);
      const [seconds, nanoseconds] = process.hrtime(start);
      const duration = seconds * 1000 + nanoseconds / 1e6;
      logger.info(`Operation ${propertyKey} completed in ${duration}ms`, {
        operation: propertyKey,
        duration,
        success: true
      });
      return result;
    } catch (error) {
      const [seconds, nanoseconds] = process.hrtime(start);
      const duration = seconds * 1000 + nanoseconds / 1e6;
      logger.error(`Operation ${propertyKey} failed after ${duration}ms`, {
        operation: propertyKey,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false
      });
      throw error;
    }
  };
  return descriptor;
}

/**
 * Initialize GPU devices with enhanced error handling and scaling support
 */
@retryable({ maxAttempts: 3, backoff: 1000 })
export async function initializeGPU(config: GPUConfig): Promise<boolean> {
  try {
    logger.info('Initializing GPU devices', { config });

    // Validate device count
    if (cuda.getDeviceCount() < config.deviceCount) {
      throw new Error(`Required ${config.deviceCount} GPU devices, but only ${cuda.getDeviceCount()} available`);
    }

    // Initialize each device
    for (let deviceId = 0; deviceId < config.deviceCount; deviceId++) {
      const device = cuda.getDevice(deviceId);
      const deviceProps = device.getProperties();

      // Validate compute capability
      const [major, minor] = deviceProps.computeCapability.split('.');
      const requiredCapability = config.computeCapability.split('.');
      if (parseInt(major) < parseInt(requiredCapability[0]) ||
          (parseInt(major) === parseInt(requiredCapability[0]) && parseInt(minor) < parseInt(requiredCapability[1]))) {
        throw new Error(`Device ${deviceId} compute capability ${deviceProps.computeCapability} below required ${config.computeCapability}`);
      }

      // Configure memory limits
      await cuda.setMemoryLimit(deviceId, config.memoryLimit);
      
      // Initialize scaling metrics
      await initializeScalingMetrics(deviceId);
    }

    logger.info('GPU initialization completed successfully');
    return true;
  } catch (error) {
    logger.error('GPU initialization failed', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}

/**
 * Retrieve comprehensive GPU metrics including latency and utilization tracking
 */
@monitor
export async function getGPUMetrics(deviceId: number): Promise<GPUMetrics> {
  try {
    const device = cuda.getDevice(deviceId);
    const memInfo = device.getMemoryInfo();
    const utilization = device.getUtilization();
    
    const metrics: GPUMetrics = {
      deviceId,
      utilizationPercent: utilization.gpu,
      memoryUsed: memInfo.used,
      memoryTotal: memInfo.total,
      temperature: device.getTemperature(),
      powerUsage: device.getPowerUsage(),
      computeProcesses: device.getComputeProcessCount(),
      latencyMs: await measureLatency(deviceId),
      scalingMetrics: await getScalingMetrics(deviceId)
    };

    // Log performance alerts
    if (metrics.utilizationPercent > 90 || metrics.temperature > 80) {
      logger.warn('High GPU utilization or temperature detected', { metrics });
    }

    return metrics;
  } catch (error) {
    logger.error('Failed to retrieve GPU metrics', {
      deviceId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}

/**
 * Allocate GPU memory with optimization and scaling support
 */
@monitor
@retryable({ maxAttempts: 2 })
export async function allocateGPUMemory(deviceId: number, memorySize: number): Promise<boolean> {
  try {
    const device = cuda.getDevice(deviceId);
    const memInfo = device.getMemoryInfo();

    // Check available memory
    if (memInfo.free < memorySize) {
      throw new Error(`Insufficient GPU memory. Required: ${memorySize}, Available: ${memInfo.free}`);
    }

    // Perform memory allocation
    await cuda.allocateMemory(deviceId, memorySize);
    
    // Update scaling metrics
    await updateScalingMetrics(deviceId, { allocatedMemory: memorySize });

    return true;
  } catch (error) {
    logger.error('Memory allocation failed', {
      deviceId,
      memorySize,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}

/**
 * Release GPU memory with enhanced cleanup and monitoring
 */
@monitor
export async function releaseGPUMemory(deviceId: number): Promise<void> {
  try {
    const device = cuda.getDevice(deviceId);
    
    // Clear all allocations
    await cuda.clearMemory(deviceId);
    
    // Reset device if needed
    if (device.getComputeProcessCount() > 0) {
      await cuda.resetDevice(deviceId);
    }
    
    // Update scaling metrics
    await updateScalingMetrics(deviceId, { allocatedMemory: 0 });
    
    logger.info('GPU memory released successfully', { deviceId });
  } catch (error) {
    logger.error('Failed to release GPU memory', {
      deviceId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}

// Helper functions
async function measureLatency(deviceId: number): Promise<number> {
  const start = process.hrtime();
  await cuda.synchronize(deviceId);
  const [seconds, nanoseconds] = process.hrtime(start);
  return seconds * 1000 + nanoseconds / 1e6;
}

async function initializeScalingMetrics(deviceId: number): Promise<void> {
  // Initialize scaling metrics in shared memory or cache
  await cuda.setDeviceFlags(deviceId, cuda.DeviceFlags.ScheduleAuto);
}

async function getScalingMetrics(deviceId: number): Promise<{
  queueLength: number;
  activeWorkers: number;
  pendingRequests: number;
}> {
  const device = cuda.getDevice(deviceId);
  return {
    queueLength: device.getQueueLength(),
    activeWorkers: device.getActiveWorkers(),
    pendingRequests: device.getPendingRequests()
  };
}

async function updateScalingMetrics(deviceId: number, metrics: { allocatedMemory: number }): Promise<void> {
  await cuda.updateDeviceMetrics(deviceId, metrics);
}