// @types/node version: ^18.0.0
import { Buffer } from '@types/node';
import { VideoResolution, ProcessingStatus } from './common';

/**
 * Enum defining supported tokenizer architectures for the Cosmos WFM Platform
 * Supports both continuous tokenization for diffusion models and discrete for autoregressive
 */
export enum TokenizerType {
  CONTINUOUS = 'CONTINUOUS', // For diffusion models
  DISCRETE = 'DISCRETE'      // For autoregressive models
}

/**
 * Interface for advanced tokenizer configuration options
 * Provides fine-grained control over tokenization process
 */
interface TokenizerAdvancedConfig {
  batchSize: number;         // Number of frames to process in parallel
  precision: 'fp32' | 'fp16' | 'bf16'; // Numerical precision
  optimizationLevel: number; // 0-3, higher means more optimization
  maxTokenLength: number;    // Maximum sequence length for tokenization
}

/**
 * Interface defining tokenizer configuration with validation
 * Controls tokenization parameters and architecture selection
 */
export interface TokenizerConfig {
  type: TokenizerType;
  compressionRatio: number;  // e.g., 512:1, 2048:1
  resolution: VideoResolution;
  advancedConfig?: TokenizerAdvancedConfig;

  /**
   * Validates configuration parameters
   * @returns boolean indicating if config is valid
   */
  validate(): boolean;
}

/**
 * Interface for tokenizer performance metrics with validation
 * Tracks key performance indicators for tokenization process
 */
export interface TokenizerMetrics {
  compressionRatio: number;  // Achieved compression ratio
  psnr: number;             // Peak Signal-to-Noise Ratio
  throughput: number;       // Frames per second
  latencyMs: number;        // Processing latency in milliseconds

  /**
   * Validates metric values are within acceptable ranges
   * @returns boolean indicating if metrics are valid
   */
  validate(): boolean;

  /**
   * Calculates tokenizer efficiency score
   * @returns number between 0-100 indicating efficiency
   */
  getEfficiency(): number;
}

/**
 * Interface for tokenization validation errors
 * Provides structured error information for debugging
 */
interface TokenizerValidationError {
  code: number;
  message: string;
  details: Record<string, unknown>;
}

/**
 * Interface for tokenization result including metrics
 * Contains tokenized data and associated performance metrics
 */
export interface TokenizationResult {
  tokens: Buffer;           // Binary token data
  metrics: TokenizerMetrics;
  status: ProcessingStatus;
}

/**
 * Implementation of TokenizerConfig interface
 */
export class TokenizerConfigImpl implements TokenizerConfig {
  constructor(
    public readonly type: TokenizerType,
    public readonly compressionRatio: number,
    public readonly resolution: VideoResolution,
    public readonly advancedConfig?: TokenizerAdvancedConfig
  ) {}

  validate(): boolean {
    // Validate compression ratio based on tokenizer type
    const validCompressionRatios = {
      [TokenizerType.CONTINUOUS]: [256, 512, 1024],
      [TokenizerType.DISCRETE]: [256, 512, 2048]
    };

    const isValidCompression = validCompressionRatios[this.type].includes(this.compressionRatio);
    const isValidResolution = this.resolution.validate();
    
    // Validate advanced config if present
    const isValidAdvancedConfig = !this.advancedConfig || (
      this.advancedConfig.batchSize > 0 &&
      this.advancedConfig.batchSize <= 128 &&
      this.advancedConfig.optimizationLevel >= 0 &&
      this.advancedConfig.optimizationLevel <= 3 &&
      this.advancedConfig.maxTokenLength > 0
    );

    return isValidCompression && isValidResolution && isValidAdvancedConfig;
  }
}

/**
 * Implementation of TokenizerMetrics interface
 */
export class TokenizerMetricsImpl implements TokenizerMetrics {
  constructor(
    public readonly compressionRatio: number,
    public readonly psnr: number,
    public readonly throughput: number,
    public readonly latencyMs: number
  ) {}

  validate(): boolean {
    const MIN_PSNR = 25.0;
    const MAX_LATENCY = 100; // ms per frame at 1080p
    
    return (
      this.compressionRatio > 0 &&
      this.psnr >= MIN_PSNR &&
      this.throughput > 0 &&
      this.latencyMs > 0 &&
      this.latencyMs <= MAX_LATENCY
    );
  }

  getEfficiency(): number {
    // Efficiency calculation based on compression and quality
    const compressionWeight = 0.4;
    const qualityWeight = 0.3;
    const speedWeight = 0.3;

    const normalizedCompression = Math.min(this.compressionRatio / 2048, 1) * 100;
    const normalizedQuality = Math.min(this.psnr / 40, 1) * 100;
    const normalizedSpeed = Math.max(0, 1 - (this.latencyMs / 100)) * 100;

    return (
      normalizedCompression * compressionWeight +
      normalizedQuality * qualityWeight +
      normalizedSpeed * speedWeight
    );
  }
}