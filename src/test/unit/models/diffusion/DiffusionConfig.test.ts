import { describe, it, expect, beforeEach } from '@jest/globals'; // v29.0.0
import {
  DiffusionConfig,
  DEFAULT_DIFFUSION_CONFIG,
  validateConfig
} from '../../../../backend/src/core/models/diffusion/DiffusionConfig';
import { ModelType } from '../../../../backend/src/types/common';

describe('DiffusionConfig', () => {
  let config: DiffusionConfig;

  beforeEach(() => {
    // Start with default config before each test
    config = { ...DEFAULT_DIFFUSION_CONFIG };
  });

  describe('Default Configuration', () => {
    it('should provide valid default configuration', () => {
      expect(validateConfig(DEFAULT_DIFFUSION_CONFIG)).toBe(true);
    });

    it('should have correct version', () => {
      expect(config.version).toBe('1.0.0');
    });

    it('should have valid default architecture settings', () => {
      expect(config.architecture.type).toBe(ModelType.DIFFUSION_7B);
      expect(config.architecture.parameters).toBe(7_000_000_000);
      expect(config.architecture.variant).toBe('base');
    });
  });

  describe('Architecture Validation', () => {
    it('should validate 7B model configuration', () => {
      expect(config.validate()).toBe(true);
    });

    it('should validate 14B model configuration', () => {
      config.architecture.type = ModelType.DIFFUSION_14B;
      config.architecture.parameters = 14_000_000_000;
      expect(config.validate()).toBe(true);
    });

    it('should reject invalid model type', () => {
      config.architecture.type = 'INVALID_MODEL' as ModelType;
      expect(config.validate()).toBe(false);
    });

    it('should reject parameters outside valid range', () => {
      config.architecture.parameters = 20_000_000_000; // 20B exceeds max
      expect(config.validate()).toBe(false);
    });
  });

  describe('Denoising Configuration', () => {
    it('should validate default denoising settings', () => {
      expect(config.denoising.validateDenoising()).toBe(true);
    });

    it('should validate steps within range', () => {
      config.denoising.steps = 20;
      expect(config.denoising.validateDenoising()).toBe(true);
      
      config.denoising.steps = 100;
      expect(config.denoising.validateDenoising()).toBe(true);
    });

    it('should reject steps outside valid range', () => {
      config.denoising.steps = 15;
      expect(config.denoising.validateDenoising()).toBe(false);
      
      config.denoising.steps = 101;
      expect(config.denoising.validateDenoising()).toBe(false);
    });

    it('should validate guidance scale within range', () => {
      config.denoising.guidanceScale = 1.0;
      expect(config.denoising.validateDenoising()).toBe(true);
      
      config.denoising.guidanceScale = 20.0;
      expect(config.denoising.validateDenoising()).toBe(true);
    });

    it('should validate supported noise schedules', () => {
      const validSchedules = ['linear', 'cosine', 'quadratic'];
      validSchedules.forEach(schedule => {
        config.denoising.noiseSchedule = schedule;
        expect(config.denoising.validateDenoising()).toBe(true);
      });
    });

    it('should reject invalid noise schedule', () => {
      config.denoising.noiseSchedule = 'invalid';
      expect(config.denoising.validateDenoising()).toBe(false);
    });
  });

  describe('Generation Configuration', () => {
    it('should validate default generation settings', () => {
      expect(config.generation.validateGeneration()).toBe(true);
    });

    it('should validate 720p resolution', () => {
      config.generation.resolution = {
        width: 1280,
        height: 720,
        getAspectRatio: () => 1280/720,
        validate: () => true
      };
      expect(config.generation.validateGeneration()).toBe(true);
    });

    it('should validate 57 frames requirement', () => {
      config.generation.numFrames = 57;
      expect(config.generation.validateGeneration()).toBe(true);
    });

    it('should reject invalid frame count', () => {
      config.generation.numFrames = 0;
      expect(config.generation.validateGeneration()).toBe(false);
      
      config.generation.numFrames = 1001;
      expect(config.generation.validateGeneration()).toBe(false);
    });

    it('should validate batch size within limits', () => {
      config.generation.batchSize = 1;
      expect(config.generation.validateGeneration()).toBe(true);
      
      config.generation.batchSize = 128;
      expect(config.generation.validateGeneration()).toBe(true);
    });

    it('should reject invalid batch size', () => {
      config.generation.batchSize = 0;
      expect(config.generation.validateGeneration()).toBe(false);
      
      config.generation.batchSize = 129;
      expect(config.generation.validateGeneration()).toBe(false);
    });
  });

  describe('Performance Requirements', () => {
    it('should validate generation time under 600s', () => {
      // 50 steps * 10ms * 57 frames = 28.5s
      config.denoising.steps = 50;
      config.generation.numFrames = 57;
      expect(config.validate()).toBe(true);
    });

    it('should reject configurations exceeding 600s', () => {
      // 200 steps * 10ms * 57 frames = 114s
      config.denoising.steps = 200;
      config.generation.numFrames = 100;
      expect(config.validate()).toBe(false);
    });

    it('should validate GPU memory requirements for 7B model', () => {
      // 7B parameters * 10 = 70GB (within 80GB limit)
      config.architecture.parameters = 7_000_000_000;
      expect(config.validate()).toBe(true);
    });

    it('should validate GPU memory requirements for 14B model', () => {
      // 14B parameters * 10 = 140GB (exceeds 80GB limit)
      config.architecture.parameters = 14_000_000_000;
      expect(config.validate()).toBe(false);
    });
  });

  describe('Configuration Schema', () => {
    it('should validate complete configuration object', () => {
      const validConfig: DiffusionConfig = {
        version: '1.0.0',
        architecture: {
          type: ModelType.DIFFUSION_7B,
          parameters: 7_000_000_000,
          variant: 'base'
        },
        denoising: {
          steps: 50,
          guidanceScale: 7.5,
          noiseSchedule: 'linear',
          validateDenoising: () => true
        },
        generation: {
          resolution: {
            width: 1280,
            height: 720,
            getAspectRatio: () => 1280/720,
            validate: () => true
          },
          numFrames: 57,
          batchSize: 1,
          validateGeneration: () => true
        },
        validate: () => true
      };
      expect(validateConfig(validConfig)).toBe(true);
    });

    it('should reject invalid schema version', () => {
      config.version = '2.0.0';
      expect(validateConfig(config)).toBe(false);
    });

    it('should handle validation of null/undefined config', () => {
      expect(validateConfig(null as unknown as DiffusionConfig)).toBe(false);
      expect(validateConfig(undefined as unknown as DiffusionConfig)).toBe(false);
    });
  });
});