// @types/node version: ^18.0.0

import { TokenizerType } from '../../../types/tokenizer';
import { VideoResolution } from '../../../types/common';

/**
 * Configuration class for video tokenizers in the Cosmos WFM Platform.
 * Provides configuration options and validation for both continuous and discrete tokenization
 * with configurable compression ratios and resolutions.
 */
export class TokenizerConfig {
  private readonly performanceMetrics: Map<string, number>;
  private static readonly SUPPORTED_COMPRESSION_RATIOS = {
    [TokenizerType.CONTINUOUS]: [256, 512, 1024],
    [TokenizerType.DISCRETE]: [256, 512, 2048]
  };

  /**
   * Creates a new tokenizer configuration instance with validation
   * @param type - Tokenizer architecture type (CONTINUOUS or DISCRETE)
   * @param compressionRatio - Target compression ratio (e.g., 512:1)
   * @param resolution - Target video resolution
   * @throws Error if configuration parameters are invalid
   */
  constructor(
    public readonly type: TokenizerType,
    public readonly compressionRatio: number,
    public readonly resolution: VideoResolution
  ) {
    this.performanceMetrics = new Map<string, number>();
    
    if (!this.validateConfig()) {
      throw new Error(
        `Invalid tokenizer configuration: type=${type}, ` +
        `compressionRatio=${compressionRatio}, ` +
        `resolution=${resolution.width}x${resolution.height}`
      );
    }
  }

  /**
   * Validates the configuration parameters against technical specifications
   * @returns boolean indicating if configuration is valid
   */
  public validateConfig(): boolean {
    // Validate tokenizer type
    if (!Object.values(TokenizerType).includes(this.type)) {
      return false;
    }

    // Validate compression ratio
    const validRatios = TokenizerConfig.SUPPORTED_COMPRESSION_RATIOS[this.type];
    if (!validRatios.includes(this.compressionRatio)) {
      return false;
    }

    // Validate resolution
    if (!this.resolution.validate()) {
      return false;
    }

    // Validate memory requirements based on resolution and compression
    const estimatedMemoryGB = this.estimateMemoryRequirement();
    if (estimatedMemoryGB > 80) { // Max GPU memory threshold
      return false;
    }

    return true;
  }

  /**
   * Validates configuration against performance requirements
   * @returns boolean indicating if performance metrics are met
   */
  public validatePerformance(): boolean {
    const MIN_THROUGHPUT = 10; // frames per second
    const MAX_LATENCY = 100; // ms per frame at 1080p
    const MIN_PSNR = 25.0;

    const throughput = this.performanceMetrics.get('throughput') || 0;
    const latency = this.performanceMetrics.get('latency') || Infinity;
    const psnr = this.performanceMetrics.get('psnr') || 0;

    return (
      throughput >= MIN_THROUGHPUT &&
      latency <= MAX_LATENCY &&
      psnr >= MIN_PSNR
    );
  }

  /**
   * Returns the current configuration with performance metrics
   * @returns Complete configuration object with metrics
   */
  public getConfig(): Record<string, unknown> {
    return {
      type: this.type,
      compressionRatio: this.compressionRatio,
      resolution: {
        width: this.resolution.width,
        height: this.resolution.height
      },
      performanceMetrics: Object.fromEntries(this.performanceMetrics)
    };
  }

  /**
   * Updates runtime performance metrics
   * @param metrics - Map of performance metric updates
   */
  public updatePerformanceMetrics(metrics: Map<string, number>): void {
    const validMetricKeys = ['throughput', 'latency', 'psnr', 'memoryUsage'];
    
    for (const [key, value] of metrics.entries()) {
      if (validMetricKeys.includes(key) && typeof value === 'number') {
        const previousValue = this.performanceMetrics.get(key);
        this.performanceMetrics.set(key, value);

        // Log significant performance changes
        if (previousValue && Math.abs(value - previousValue) / previousValue > 0.1) {
          console.warn(
            `Significant change in ${key}: ${previousValue} -> ${value}`
          );
        }
      }
    }
  }

  /**
   * Estimates memory requirement for current configuration
   * @returns Estimated GPU memory requirement in GB
   * @private
   */
  private estimateMemoryRequirement(): number {
    const pixelCount = this.resolution.width * this.resolution.height;
    const bitsPerPixel = this.type === TokenizerType.CONTINUOUS ? 32 : 16;
    const compressionFactor = this.compressionRatio;
    
    // Calculate memory in GB with overhead factor
    const overheadFactor = 1.5;
    return (pixelCount * bitsPerPixel) / (8 * 1024 * 1024 * 1024 * compressionFactor) * overheadFactor;
  }
}