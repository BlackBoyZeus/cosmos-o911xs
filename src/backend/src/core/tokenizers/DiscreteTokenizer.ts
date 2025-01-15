// @types/node version: ^18.0.0
// torch version: 2.0.0
// numpy version: 1.24.0

import { Buffer } from '@types/node';
import { ITokenizer, TokenizeOptions, DetokenizeOptions, ValidationResult } from './interfaces/ITokenizer';
import { TokenizerConfig } from './TokenizerConfig';
import { TokenizerType, TokenizationResult, TokenizerMetrics, TokenizerMetricsImpl } from '../../types/tokenizer';
import { ProcessingStatus } from '../../types/common';
import * as torch from 'torch';
import * as np from 'numpy';

/**
 * Memory management for codebook optimization
 */
class CodebookMemoryManager {
  private memoryUsage: number = 0;
  private readonly MAX_MEMORY_GB = 80;

  allocateMemory(sizeGB: number): boolean {
    if (this.memoryUsage + sizeGB > this.MAX_MEMORY_GB) {
      return false;
    }
    this.memoryUsage += sizeGB;
    return true;
  }

  releaseMemory(sizeGB: number): void {
    this.memoryUsage = Math.max(0, this.memoryUsage - sizeGB);
  }
}

/**
 * Error handler for tokenization process
 */
class TokenizationErrorHandler {
  handleError(error: Error, phase: string): void {
    console.error(`Tokenization error during ${phase}:`, error);
    if (error instanceof torch.cuda.CUDAError) {
      torch.cuda.empty_cache();
    }
    throw error;
  }
}

/**
 * Implements discrete video tokenization using FSQ with GPU acceleration
 * Supports configurable compression ratios and provides comprehensive metrics
 */
export class DiscreteTokenizer implements ITokenizer {
  private readonly config: TokenizerConfig;
  private readonly metrics: TokenizerMetricsImpl;
  private codebook: torch.Tensor;
  private readonly gpuAvailable: boolean;
  private readonly memoryManager: CodebookMemoryManager;
  private readonly errorHandler: TokenizationErrorHandler;

  constructor(config: TokenizerConfig) {
    if (config.type !== TokenizerType.DISCRETE) {
      throw new Error('Invalid tokenizer type. Expected DISCRETE tokenizer.');
    }

    this.config = config;
    this.memoryManager = new CodebookMemoryManager();
    this.errorHandler = new TokenizationErrorHandler();
    this.metrics = new TokenizerMetricsImpl(
      config.compressionRatio,
      0, // Initial PSNR
      0, // Initial throughput
      0  // Initial latency
    );

    // Check GPU availability
    this.gpuAvailable = torch.cuda.is_available();
    if (this.gpuAvailable) {
      console.log('CUDA available, using GPU acceleration');
    }

    this.initializeCodebook();
  }

  /**
   * Converts video frames into discrete tokens using FSQ
   */
  async tokenize(video: Buffer, options?: TokenizeOptions): Promise<TokenizationResult> {
    const startTime = Date.now();
    try {
      // Convert buffer to tensor
      const videoTensor = this.bufferToTensor(video);
      const device = this.gpuAvailable ? 'cuda' : 'cpu';
      
      // Move data to GPU if available
      const videoData = this.gpuAvailable ? 
        videoTensor.to(device) : videoTensor;

      // Apply FSQ tokenization
      const tokens = await this.applyFSQ(videoData, options?.batchSize || 32);

      // Calculate metrics
      const endTime = Date.now();
      const latencyMs = endTime - startTime;
      const psnr = this.calculatePSNR(videoData, tokens);
      const throughput = videoData.size(0) / (latencyMs / 1000);

      // Update metrics
      this.metrics = new TokenizerMetricsImpl(
        this.config.compressionRatio,
        psnr,
        throughput,
        latencyMs / videoData.size(0)
      );

      // Clean up GPU memory
      if (this.gpuAvailable) {
        videoData.free();
        torch.cuda.empty_cache();
      }

      return {
        tokens: this.tensorToBuffer(tokens),
        metrics: this.metrics,
        status: ProcessingStatus.COMPLETED
      };

    } catch (error) {
      this.errorHandler.handleError(error as Error, 'tokenization');
      return {
        tokens: Buffer.alloc(0),
        metrics: this.metrics,
        status: ProcessingStatus.FAILED
      };
    }
  }

  /**
   * Reconstructs video from discrete tokens
   */
  async detokenize(tokens: Buffer, options?: DetokenizeOptions): Promise<Buffer> {
    try {
      const tokensTensor = this.bufferToTensor(tokens);
      const device = this.gpuAvailable ? 'cuda' : 'cpu';

      // Move data to GPU if available
      const tokensData = this.gpuAvailable ?
        tokensTensor.to(device) : tokensTensor;

      // Apply inverse FSQ
      const reconstructed = await this.applyInverseFSQ(tokensData);

      // Validate reconstruction quality if requested
      if (options?.validateQuality) {
        const psnr = this.calculatePSNR(tokensData, reconstructed);
        if (psnr < 25.0) {
          throw new Error(`Poor reconstruction quality: PSNR ${psnr}`);
        }
      }

      // Clean up GPU memory
      if (this.gpuAvailable) {
        tokensData.free();
        torch.cuda.empty_cache();
      }

      return this.tensorToBuffer(reconstructed);

    } catch (error) {
      this.errorHandler.handleError(error as Error, 'detokenization');
      return Buffer.alloc(0);
    }
  }

  async getConfig(): Promise<TokenizerConfig> {
    return this.config;
  }

  async getMetrics(): Promise<TokenizerMetrics> {
    return this.metrics;
  }

  async validateConfig(config: TokenizerConfig): Promise<ValidationResult> {
    const isValid = config.validateConfig() && config.validatePerformance();
    const memoryRequired = this.estimateMemoryRequirement(config);

    return {
      isValid,
      resourceRequirements: {
        estimatedGpuMemory: memoryRequired,
        estimatedThroughput: 1000 / this.metrics.latencyMs
      }
    };
  }

  /**
   * Initializes FSQ codebook with memory optimization
   */
  private initializeCodebook(): void {
    try {
      const codebookSize = Math.pow(2, Math.log2(this.config.compressionRatio));
      const device = this.gpuAvailable ? 'cuda' : 'cpu';

      // Allocate memory for codebook
      const memoryRequired = (codebookSize * 4) / (1024 * 1024 * 1024); // Size in GB
      if (!this.memoryManager.allocateMemory(memoryRequired)) {
        throw new Error('Insufficient memory for codebook initialization');
      }

      // Initialize codebook with uniform distribution
      this.codebook = torch.randn([codebookSize, 3], { device });
      
      // Optimize memory layout
      if (this.gpuAvailable) {
        this.codebook = this.codebook.contiguous();
      }

    } catch (error) {
      this.errorHandler.handleError(error as Error, 'codebook initialization');
    }
  }

  /**
   * Applies FSQ tokenization to video frames
   */
  private async applyFSQ(video: torch.Tensor, batchSize: number): Promise<torch.Tensor> {
    const numFrames = video.size(0);
    const tokens = [];

    for (let i = 0; i < numFrames; i += batchSize) {
      const batch = video.narrow(0, i, Math.min(batchSize, numFrames - i));
      const distances = torch.cdist(batch.view(-1, 3), this.codebook);
      const batchTokens = torch.argmin(distances, 1);
      tokens.push(batchTokens);
    }

    return torch.cat(tokens);
  }

  /**
   * Applies inverse FSQ to reconstruct video
   */
  private async applyInverseFSQ(tokens: torch.Tensor): Promise<torch.Tensor> {
    return torch.index_select(this.codebook, 0, tokens);
  }

  /**
   * Calculates PSNR between original and reconstructed video
   */
  private calculatePSNR(original: torch.Tensor, reconstructed: torch.Tensor): number {
    const mse = torch.mean(torch.pow(original - reconstructed, 2));
    return 10 * Math.log10(1 / mse.item());
  }

  /**
   * Estimates memory requirement for given configuration
   */
  private estimateMemoryRequirement(config: TokenizerConfig): number {
    const { width, height } = config.resolution;
    const pixelCount = width * height;
    const bitsPerPixel = 16; // For discrete tokenization
    return (pixelCount * bitsPerPixel) / (8 * 1024 * 1024 * 1024);
  }

  /**
   * Converts Buffer to torch Tensor
   */
  private bufferToTensor(buffer: Buffer): torch.Tensor {
    const array = new Uint8Array(buffer);
    return torch.from_numpy(np.frombuffer(array, dtype='uint8'));
  }

  /**
   * Converts torch Tensor to Buffer
   */
  private tensorToBuffer(tensor: torch.Tensor): Buffer {
    const array = tensor.cpu().numpy();
    return Buffer.from(array);
  }
}

export default DiscreteTokenizer;