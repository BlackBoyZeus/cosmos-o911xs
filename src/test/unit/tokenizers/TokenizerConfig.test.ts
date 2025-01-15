import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TokenizerConfig } from '../../../backend/src/core/tokenizers/TokenizerConfig';
import { TokenizerType } from '../../../backend/src/types/tokenizer';

describe('TokenizerConfig', () => {
  let validContinuousConfig: TokenizerConfig;
  let validDiscreteConfig: TokenizerConfig;
  let performanceMetrics: Map<string, number>;

  beforeEach(() => {
    // Initialize valid configurations for testing
    validContinuousConfig = new TokenizerConfig(
      TokenizerType.CONTINUOUS,
      512,
      { width: 1280, height: 720, validate: () => true }
    );

    validDiscreteConfig = new TokenizerConfig(
      TokenizerType.DISCRETE,
      2048,
      { width: 1920, height: 1080, validate: () => true }
    );

    // Initialize performance metrics
    performanceMetrics = new Map<string, number>([
      ['throughput', 34.8],
      ['latency', 28.7],
      ['psnr', 32.8],
      ['memoryUsage', 74.0]
    ]);
  });

  afterEach(() => {
    // Clean up after each test
    performanceMetrics.clear();
  });

  describe('constructor validation', () => {
    it('should create valid continuous tokenizer config', () => {
      expect(() => {
        new TokenizerConfig(
          TokenizerType.CONTINUOUS,
          512,
          { width: 1280, height: 720, validate: () => true }
        )
      }).not.toThrow();
    });

    it('should create valid discrete tokenizer config', () => {
      expect(() => {
        new TokenizerConfig(
          TokenizerType.DISCRETE,
          2048,
          { width: 1920, height: 1080, validate: () => true }
        )
      }).not.toThrow();
    });

    it('should reject invalid tokenizer type', () => {
      expect(() => {
        new TokenizerConfig(
          'INVALID_TYPE' as TokenizerType,
          512,
          { width: 1280, height: 720, validate: () => true }
        )
      }).toThrow();
    });

    it('should reject invalid compression ratio for continuous tokenizer', () => {
      expect(() => {
        new TokenizerConfig(
          TokenizerType.CONTINUOUS,
          4096,
          { width: 1280, height: 720, validate: () => true }
        )
      }).toThrow();
    });

    it('should reject invalid compression ratio for discrete tokenizer', () => {
      expect(() => {
        new TokenizerConfig(
          TokenizerType.DISCRETE,
          128,
          { width: 1280, height: 720, validate: () => true }
        )
      }).toThrow();
    });

    it('should reject invalid resolution', () => {
      expect(() => {
        new TokenizerConfig(
          TokenizerType.CONTINUOUS,
          512,
          { width: 8192, height: 4320, validate: () => false }
        )
      }).toThrow();
    });
  });

  describe('validateConfig', () => {
    it('should validate supported compression ratios for continuous tokenizer', () => {
      const validRatios = [256, 512, 1024];
      validRatios.forEach(ratio => {
        const config = new TokenizerConfig(
          TokenizerType.CONTINUOUS,
          ratio,
          { width: 1280, height: 720, validate: () => true }
        );
        expect(config.validateConfig()).toBe(true);
      });
    });

    it('should validate supported compression ratios for discrete tokenizer', () => {
      const validRatios = [256, 512, 2048];
      validRatios.forEach(ratio => {
        const config = new TokenizerConfig(
          TokenizerType.DISCRETE,
          ratio,
          { width: 1280, height: 720, validate: () => true }
        );
        expect(config.validateConfig()).toBe(true);
      });
    });

    it('should validate memory requirements', () => {
      const config = new TokenizerConfig(
        TokenizerType.CONTINUOUS,
        512,
        { width: 7680, height: 4320, validate: () => true }
      );
      expect(config.validateConfig()).toBe(false); // Should exceed 80GB memory threshold
    });
  });

  describe('validatePerformance', () => {
    it('should validate performance metrics within thresholds', () => {
      validContinuousConfig['performanceMetrics'] = performanceMetrics;
      expect(validContinuousConfig.validatePerformance()).toBe(true);
    });

    it('should reject low throughput', () => {
      performanceMetrics.set('throughput', 5);
      validContinuousConfig['performanceMetrics'] = performanceMetrics;
      expect(validContinuousConfig.validatePerformance()).toBe(false);
    });

    it('should reject high latency', () => {
      performanceMetrics.set('latency', 150);
      validContinuousConfig['performanceMetrics'] = performanceMetrics;
      expect(validContinuousConfig.validatePerformance()).toBe(false);
    });

    it('should reject low PSNR', () => {
      performanceMetrics.set('psnr', 24.0);
      validContinuousConfig['performanceMetrics'] = performanceMetrics;
      expect(validContinuousConfig.validatePerformance()).toBe(false);
    });
  });

  describe('getConfig', () => {
    it('should return complete configuration with metrics', () => {
      validContinuousConfig['performanceMetrics'] = performanceMetrics;
      const config = validContinuousConfig.getConfig();
      
      expect(config).toEqual({
        type: TokenizerType.CONTINUOUS,
        compressionRatio: 512,
        resolution: {
          width: 1280,
          height: 720
        },
        performanceMetrics: {
          throughput: 34.8,
          latency: 28.7,
          psnr: 32.8,
          memoryUsage: 74.0
        }
      });
    });
  });

  describe('updatePerformanceMetrics', () => {
    it('should update valid performance metrics', () => {
      const updates = new Map<string, number>([
        ['throughput', 40.0],
        ['psnr', 33.5]
      ]);
      
      validContinuousConfig.updatePerformanceMetrics(updates);
      const config = validContinuousConfig.getConfig();
      
      expect(config.performanceMetrics).toMatchObject({
        throughput: 40.0,
        psnr: 33.5
      });
    });

    it('should ignore invalid metric keys', () => {
      const updates = new Map<string, number>([
        ['invalidMetric', 100],
        ['throughput', 40.0]
      ]);
      
      validContinuousConfig.updatePerformanceMetrics(updates);
      const config = validContinuousConfig.getConfig();
      
      expect(config.performanceMetrics).not.toHaveProperty('invalidMetric');
      expect(config.performanceMetrics).toMatchObject({
        throughput: 40.0
      });
    });

    it('should log significant performance changes', () => {
      const consoleSpy = jest.spyOn(console, 'warn');
      
      // Initial metrics
      validContinuousConfig.updatePerformanceMetrics(new Map([
        ['throughput', 34.8]
      ]));
      
      // Significant change (>10%)
      validContinuousConfig.updatePerformanceMetrics(new Map([
        ['throughput', 25.0]
      ]));
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Significant change in throughput')
      );
      
      consoleSpy.mockRestore();
    });
  });
});