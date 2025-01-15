// @types/node version: ^18.0.0
import { Buffer } from '@types/node';
import { 
  TokenizerConfig, 
  TokenizationResult, 
  TokenizerMetrics 
} from '../../../types/tokenizer';
import { VideoResolution, ProcessingStatus } from '../../../types/common';

/**
 * Options for tokenization process configuration
 */
export interface TokenizeOptions {
  /**
   * Whether to track detailed performance metrics during tokenization
   */
  trackMetrics?: boolean;

  /**
   * Custom batch size override for this tokenization operation
   */
  batchSize?: number;

  /**
   * Target resolution for tokenization
   */
  targetResolution?: VideoResolution;
}

/**
 * Options for detokenization process configuration
 */
export interface DetokenizeOptions {
  /**
   * Target resolution for reconstructed video
   */
  targetResolution?: VideoResolution;

  /**
   * Whether to validate reconstruction quality
   */
  validateQuality?: boolean;
}

/**
 * Result of configuration validation
 */
export interface ValidationResult {
  /**
   * Whether the configuration is valid
   */
  isValid: boolean;

  /**
   * List of validation errors if any
   */
  errors?: Array<{
    code: number;
    message: string;
    field?: string;
  }>;

  /**
   * System resource requirements for this configuration
   */
  resourceRequirements?: {
    estimatedGpuMemory: number;
    estimatedThroughput: number;
  };
}

/**
 * Core interface for video tokenization in the Cosmos WFM Platform
 * Provides unified interface for both continuous and discrete tokenization approaches
 */
export interface ITokenizer {
  /**
   * Returns the current tokenizer configuration with validation status
   * @returns Promise resolving to current TokenizerConfig
   */
  getConfig(): Promise<TokenizerConfig>;

  /**
   * Converts raw video data into tokens using configured compression method
   * Supports both continuous tokenization for diffusion models and discrete for autoregressive
   * 
   * @param video - Raw video data buffer to tokenize
   * @param options - Optional tokenization configuration
   * @returns Promise resolving to TokenizationResult containing tokens and metrics
   * @throws TokenizationError if process fails
   */
  tokenize(video: Buffer, options?: TokenizeOptions): Promise<TokenizationResult>;

  /**
   * Reconstructs video data from tokens with quality validation
   * 
   * @param tokens - Token buffer to reconstruct video from
   * @param options - Optional detokenization configuration
   * @returns Promise resolving to reconstructed video buffer
   * @throws DetokenizationError if process fails
   */
  detokenize(tokens: Buffer, options?: DetokenizeOptions): Promise<Buffer>;

  /**
   * Returns comprehensive tokenizer performance metrics
   * Tracks compression ratio, PSNR, throughput and resource utilization
   * 
   * @returns Promise resolving to TokenizerMetrics
   */
  getMetrics(): Promise<TokenizerMetrics>;

  /**
   * Validates tokenizer configuration against system constraints
   * Checks compression ratios, resolution support and resource requirements
   * 
   * @param config - TokenizerConfig to validate
   * @returns Promise resolving to ValidationResult
   */
  validateConfig(config: TokenizerConfig): Promise<ValidationResult>;
}