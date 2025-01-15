// @types/node version: ^18.0.0
import { VideoResolution, VideoMetrics, ProcessingStatus } from '../types/common';

/**
 * Core interface defining comprehensive video data structure and metadata
 * for the Cosmos World Foundation Model Platform
 */
export interface IVideo {
  /**
   * Unique identifier for the video
   */
  readonly id: string;

  /**
   * Full storage path to video file
   */
  readonly path: string;

  /**
   * Original filename of the video
   */
  readonly filename: string;

  /**
   * Video duration in seconds
   */
  readonly duration: number;

  /**
   * Video resolution containing width and height
   * @see VideoResolution
   */
  readonly resolution: VideoResolution;

  /**
   * Frames per second
   */
  readonly fps: number;

  /**
   * Video container format (e.g., 'mp4', 'mov')
   */
  readonly format: string;

  /**
   * Video codec (e.g., 'h264', 'vp9')
   */
  readonly codec: string;

  /**
   * File size in bytes
   */
  readonly size: number;

  /**
   * SHA-256 checksum for data integrity verification
   */
  readonly checksum: string;

  /**
   * Current processing status
   * @see ProcessingStatus
   */
  status: ProcessingStatus;

  /**
   * Error message if processing failed, null otherwise
   */
  errorMessage: string | null;

  /**
   * Extensible metadata key-value store
   * Supports arbitrary metadata for different processing stages
   */
  metadata: Record<string, any>;

  /**
   * Video quality assessment metrics
   * @see VideoMetrics
   */
  quality: VideoMetrics;

  /**
   * List of semantic annotations describing video content
   */
  annotations: string[];

  /**
   * Time segments for video chunking and processing
   * Each segment contains start and end timestamps in seconds
   */
  segments: Array<{
    start: number;
    end: number;
  }>;

  /**
   * Schema version for data structure evolution
   */
  readonly version: number;

  /**
   * Timestamp when video was initially created
   */
  readonly createdAt: Date;

  /**
   * Timestamp of last modification
   */
  readonly updatedAt: Date;
}

/**
 * Type guard to validate IVideo objects
 * @param video - Object to validate
 * @returns boolean indicating if object matches IVideo interface
 */
export function isIVideo(video: any): video is IVideo {
  return (
    typeof video === 'object' &&
    typeof video.id === 'string' &&
    typeof video.path === 'string' &&
    typeof video.filename === 'string' &&
    typeof video.duration === 'number' &&
    video.resolution instanceof Object &&
    typeof video.fps === 'number' &&
    typeof video.format === 'string' &&
    typeof video.codec === 'string' &&
    typeof video.size === 'number' &&
    typeof video.checksum === 'string' &&
    Object.values(ProcessingStatus).includes(video.status) &&
    (video.errorMessage === null || typeof video.errorMessage === 'string') &&
    video.metadata instanceof Object &&
    video.quality instanceof Object &&
    Array.isArray(video.annotations) &&
    Array.isArray(video.segments) &&
    typeof video.version === 'number' &&
    video.createdAt instanceof Date &&
    video.updatedAt instanceof Date
  );
}

/**
 * Factory function to create new IVideo instances with defaults
 * @param params - Partial IVideo parameters
 * @returns IVideo - New video instance with default values
 */
export function createVideo(params: Partial<IVideo>): IVideo {
  return {
    id: params.id ?? crypto.randomUUID(),
    path: params.path ?? '',
    filename: params.filename ?? '',
    duration: params.duration ?? 0,
    resolution: params.resolution ?? { width: 0, height: 0 },
    fps: params.fps ?? 0,
    format: params.format ?? '',
    codec: params.codec ?? '',
    size: params.size ?? 0,
    checksum: params.checksum ?? '',
    status: params.status ?? ProcessingStatus.PENDING,
    errorMessage: params.errorMessage ?? null,
    metadata: params.metadata ?? {},
    quality: params.quality ?? {
      psnr: 0,
      ssim: 0,
      fid: 0,
      fvd: 0,
      sampsonError: 0,
      poseAccuracy: 0
    },
    annotations: params.annotations ?? [],
    segments: params.segments ?? [],
    version: params.version ?? 1,
    createdAt: params.createdAt ?? new Date(),
    updatedAt: params.updatedAt ?? new Date()
  };
}