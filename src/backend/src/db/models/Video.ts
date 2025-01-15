// typeorm version: ^0.3.0
// uuid version: ^9.0.0

import { 
  Entity, 
  Column, 
  PrimaryGeneratedColumn, 
  CreateDateColumn, 
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  Check
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { IVideo } from '../../interfaces/IVideo';
import { VideoResolution, ProcessingStatus } from '../../types/common';

/**
 * Database model for video data storage and management
 * Implements comprehensive quality metrics tracking and data validation
 */
@Entity('videos')
@Index(['status', 'createdAt'])
@Index(['path'], { unique: true })
@Check(`"duration" >= 0`)
@Check(`"fps" >= 0`)
@Check(`"size" >= 0`)
export class Video implements IVideo {
  @PrimaryGeneratedColumn('uuid')
  readonly id: string = uuidv4();

  @Column({ type: 'varchar', length: 1024 })
  readonly path: string;

  @Column({ type: 'varchar', length: 255 })
  readonly filename: string;

  @Column({ type: 'float' })
  readonly duration: number;

  @Column('jsonb')
  readonly resolution: VideoResolution;

  @Column({ type: 'float' })
  readonly fps: number;

  @Column({ type: 'varchar', length: 50 })
  readonly format: string;

  @Column({ type: 'varchar', length: 50 })
  readonly codec: string;

  @Column({ type: 'bigint' })
  readonly size: number;

  @Column({ type: 'varchar', length: 64 })
  readonly checksum: string;

  @Column({
    type: 'enum',
    enum: ProcessingStatus,
    default: ProcessingStatus.PENDING
  })
  status: ProcessingStatus;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @Column('jsonb')
  metadata: Record<string, any>;

  @Column('jsonb')
  quality: {
    psnr: number;
    ssim: number;
    fid: number;
    fvd: number;
    sampsonError: number;
    poseAccuracy: number;
  };

  @Column('text', { array: true })
  annotations: string[];

  @Column('jsonb')
  segments: Array<{
    start: number;
    end: number;
  }>;

  @Column({ type: 'int', default: 1 })
  readonly version: number;

  @CreateDateColumn()
  readonly createdAt: Date;

  @UpdateDateColumn()
  readonly updatedAt: Date;

  @DeleteDateColumn()
  readonly deletedAt: Date;

  constructor() {
    // Initialize with default values
    this.id = uuidv4();
    this.path = '';
    this.filename = '';
    this.duration = 0;
    this.resolution = { width: 0, height: 0 };
    this.fps = 0;
    this.format = '';
    this.codec = '';
    this.size = 0;
    this.checksum = '';
    this.status = ProcessingStatus.PENDING;
    this.errorMessage = null;
    this.metadata = {};
    this.quality = {
      psnr: 0,
      ssim: 0,
      fid: 0,
      fvd: 0,
      sampsonError: 0,
      poseAccuracy: 0
    };
    this.annotations = [];
    this.segments = [];
    this.version = 1;
  }

  /**
   * Converts video entity to plain JSON object with data sanitization
   * @returns Sanitized video data as plain object
   */
  toJSON(): Record<string, any> {
    const {
      id,
      path,
      filename,
      duration,
      resolution,
      fps,
      format,
      codec,
      size,
      checksum,
      status,
      errorMessage,
      metadata,
      quality,
      annotations,
      segments,
      version,
      createdAt,
      updatedAt
    } = this;

    // Validate resolution
    if (!resolution || typeof resolution.width !== 'number' || typeof resolution.height !== 'number') {
      throw new Error('Invalid resolution format');
    }

    // Validate quality metrics
    if (!quality || Object.values(quality).some(v => typeof v !== 'number')) {
      throw new Error('Invalid quality metrics format');
    }

    // Sanitize metadata by removing any sensitive fields
    const sanitizedMetadata = { ...metadata };
    delete sanitizedMetadata.apiKey;
    delete sanitizedMetadata.credentials;
    delete sanitizedMetadata.token;

    return {
      id,
      path,
      filename,
      duration,
      resolution,
      fps,
      format,
      codec,
      size,
      checksum,
      status,
      errorMessage,
      metadata: sanitizedMetadata,
      quality,
      annotations,
      segments,
      version,
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString()
    };
  }
}