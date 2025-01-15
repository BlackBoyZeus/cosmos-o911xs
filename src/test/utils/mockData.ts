import { v4 as uuidv4 } from 'uuid';
import { faker } from '@faker-js/faker';

// Internal imports
import { IDataset } from '../../backend/src/interfaces/IDataset';
import { IModel } from '../../backend/src/interfaces/IModel';
import { IGenerationRequest } from '../../backend/src/interfaces/IGeneration';
import { ISafetyLog } from '../../backend/src/interfaces/ISafetyLog';
import { IVideo } from '../../backend/src/interfaces/IVideo';
import { 
  VideoResolution,
  ProcessingStatus,
  ModelType,
  VideoResolutionImpl
} from '../../backend/src/types/common';
import {
  SafetyCheckType,
  SafetyStatus,
  GuardType
} from '../../backend/src/types/safety';

/**
 * Creates a mock dataset with realistic metadata and enhanced quality metrics
 * @param overrides - Optional partial dataset properties to override defaults
 * @returns IDataset - Complete mock dataset object
 */
export function createMockDataset(overrides: Partial<IDataset> = {}): IDataset {
  return {
    id: overrides.id ?? uuidv4(),
    name: overrides.name ?? faker.word.words(3),
    description: overrides.description ?? faker.lorem.paragraph(),
    version: overrides.version ?? '1.0.0',
    size: overrides.size ?? faker.number.int({ min: 1e9, max: 1e12 }), // 1GB-1TB
    videoCount: overrides.videoCount ?? faker.number.int({ min: 100, max: 10000 }),
    resolution: overrides.resolution ?? new VideoResolutionImpl(1920, 1080),
    metrics: overrides.metrics ?? {
      psnr: faker.number.float({ min: 25, max: 45 }),
      ssim: faker.number.float({ min: 0.8, max: 0.99 }),
      fid: faker.number.float({ min: 10, max: 50 }),
      fvd: faker.number.float({ min: 50, max: 150 })
    },
    status: overrides.status ?? ProcessingStatus.COMPLETED,
    storageLocation: overrides.storageLocation ?? `s3://cosmos-datasets/${uuidv4()}`,
    createdAt: overrides.createdAt ?? faker.date.past(),
    updatedAt: overrides.updatedAt ?? faker.date.recent(),
    validate: () => true,
    getAverageDuration: () => faker.number.int({ min: 10, max: 60 }),
    meetsQualityThresholds: () => true,
    getProcessingProgress: () => 100,
    getSummary: () => 'Mock Dataset Summary'
  };
}

/**
 * Creates a mock model implementation with enhanced performance tracking
 * @param overrides - Optional partial model properties to override defaults
 * @returns IModel - Complete mock model object
 */
export function createMockModel(overrides: Partial<IModel> = {}): IModel {
  return {
    architecture: overrides.architecture ?? {
      type: ModelType.DIFFUSION_7B,
      parameterCount: 7e9,
      contextLength: 1024,
      maxBatchSize: 8,
      supportedResolutions: [
        new VideoResolutionImpl(1280, 720),
        new VideoResolutionImpl(1920, 1080)
      ]
    },
    capabilities: overrides.capabilities ?? {
      maxFrames: 120,
      minFrames: 16,
      maxVideoDuration: 10,
      supportedFormats: ['mp4', 'webm'],
      supportsMultiView: true,
      supportsCameraControl: true,
      supportsActionControl: true,
      supportsTrajectoryControl: true
    },
    performance: overrides.performance ?? {
      generationTime: faker.number.int({ min: 100, max: 600 }) * 1000,
      gpuMemoryUsage: faker.number.float({ min: 20, max: 80 }),
      videoQualityMetrics: {
        psnr: faker.number.float({ min: 25, max: 45 }),
        ssim: faker.number.float({ min: 0.8, max: 0.99 }),
        fid: faker.number.float({ min: 10, max: 50 }),
        fvd: faker.number.float({ min: 50, max: 150 })
      },
      throughput: faker.number.float({ min: 1, max: 10 }),
      trainingProgress: faker.number.float({ min: 0, max: 1 }),
      trainingLoss: faker.number.float({ min: 0.1, max: 2.0 })
    },
    generate: async () => Buffer.from([]),
    train: async () => {},
    getPerformanceMetrics: () => ({
      generationTime: 0,
      gpuMemoryUsage: 0,
      videoQualityMetrics: { psnr: 0, ssim: 0, fid: 0, fvd: 0 },
      throughput: 0
    })
  };
}

/**
 * Creates a mock generation request with multi-view support
 * @param overrides - Optional partial request properties to override defaults
 * @returns IGenerationRequest - Complete mock generation request
 */
export function createMockGenerationRequest(overrides: Partial<IGenerationRequest> = {}): IGenerationRequest {
  return {
    id: overrides.id ?? uuidv4(),
    modelType: overrides.modelType ?? ModelType.DIFFUSION_7B,
    prompt: overrides.prompt ?? faker.lorem.sentence(),
    resolution: overrides.resolution ?? new VideoResolutionImpl(1920, 1080),
    frameCount: overrides.frameCount ?? faker.number.int({ min: 30, max: 120 }),
    safetyConfig: overrides.safetyConfig ?? {
      contentSafetyThreshold: 0.9,
      faceDetectionThreshold: 0.95,
      harmfulContentThreshold: 0.95
    },
    multiViewConfig: overrides.multiViewConfig ?? {
      enabled: true,
      viewCount: 3,
      viewAngles: [0, 120, 240],
      viewDistances: [1.0, 1.0, 1.0],
      synchronizeViews: true
    },
    performanceConfig: overrides.performanceConfig ?? {
      maxGenerationTime: 600000,
      targetFPS: 30,
      gpuMemoryLimit: 80,
      enableProfiling: true,
      priorityLevel: 5
    }
  };
}

/**
 * Creates a mock safety check log with comprehensive audit trail
 * @param overrides - Optional partial safety log properties to override defaults
 * @returns ISafetyLog - Complete mock safety log
 */
export function createMockSafetyLog(overrides: Partial<ISafetyLog> = {}): ISafetyLog {
  return {
    id: overrides.id ?? uuidv4(),
    generationId: overrides.generationId ?? uuidv4(),
    modelId: overrides.modelId ?? uuidv4(),
    guardType: overrides.guardType ?? GuardType.POST_GUARD,
    checkType: overrides.checkType ?? SafetyCheckType.CONTENT_SAFETY,
    status: overrides.status ?? SafetyStatus.PASS,
    details: overrides.details ?? {
      score: faker.number.float({ min: 0.8, max: 1.0 }),
      threshold: 0.8,
      metadata: {
        checkDuration: faker.number.int({ min: 10, max: 100 }),
        confidence: faker.number.float({ min: 0.9, max: 1.0 })
      }
    },
    processingStatus: overrides.processingStatus ?? ProcessingStatus.COMPLETED,
    timestamp: overrides.timestamp ?? faker.date.recent()
  };
}

/**
 * Creates a mock video object with 3D consistency metrics
 * @param overrides - Optional partial video properties to override defaults
 * @returns IVideo - Complete mock video object
 */
export function createMockVideo(overrides: Partial<IVideo> = {}): IVideo {
  return {
    id: overrides.id ?? uuidv4(),
    path: overrides.path ?? `s3://cosmos-videos/${uuidv4()}/output.mp4`,
    filename: overrides.filename ?? 'output.mp4',
    duration: overrides.duration ?? faker.number.int({ min: 5, max: 60 }),
    resolution: overrides.resolution ?? new VideoResolutionImpl(1920, 1080),
    fps: overrides.fps ?? 30,
    format: overrides.format ?? 'mp4',
    codec: overrides.codec ?? 'h264',
    size: overrides.size ?? faker.number.int({ min: 1e6, max: 1e9 }),
    checksum: overrides.checksum ?? faker.string.hexadecimal({ length: 64 }),
    status: overrides.status ?? ProcessingStatus.COMPLETED,
    errorMessage: overrides.errorMessage ?? null,
    metadata: overrides.metadata ?? {
      bitrate: faker.number.int({ min: 1e6, max: 1e7 }),
      colorSpace: 'yuv420p',
      audioCodec: 'aac'
    },
    quality: overrides.quality ?? {
      psnr: faker.number.float({ min: 25, max: 45 }),
      ssim: faker.number.float({ min: 0.8, max: 0.99 }),
      fid: faker.number.float({ min: 10, max: 50 }),
      fvd: faker.number.float({ min: 50, max: 150 }),
      sampsonError: faker.number.float({ min: 0.1, max: 2.0 }),
      poseAccuracy: faker.number.float({ min: 0.7, max: 0.99 })
    },
    annotations: overrides.annotations ?? [
      faker.lorem.sentence(),
      faker.lorem.sentence()
    ],
    segments: overrides.segments ?? [
      { start: 0, end: 10 },
      { start: 10, end: 20 }
    ],
    version: overrides.version ?? 1,
    createdAt: overrides.createdAt ?? faker.date.past(),
    updatedAt: overrides.updatedAt ?? faker.date.recent()
  };
}