import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'; // v29.0.0
import { 
  AutoregressiveConfig,
  validateAutoregressiveConfig,
  DEFAULT_AUTOREGRESSIVE_CONFIG 
} from '../../../../backend/src/core/models/autoregressive/AutoregressiveConfig';
import { ModelType } from '../../../../backend/src/types/common';

describe('AutoregressiveConfig Validation', () => {
  let validConfig: AutoregressiveConfig;

  beforeEach(() => {
    // Set up valid test configuration
    validConfig = {
      architecture: {
        type: ModelType.AUTOREGRESSIVE,
        parameters: 7e9, // 7B parameters
        variant: 'base'
      },
      maxResolution: {
        width: 1280,
        height: 720
      },
      maxFrames: 57,
      batchSize: 16,
      temperature: 0.8,
      topK: 50,
      topP: 0.9,
      configVersion: '1.0.0'
    };
  });

  describe('Model Architecture Validation', () => {
    it('should validate valid parameter count within 4B-13B range', () => {
      expect(() => validateAutoregressiveConfig.parse(validConfig)).not.toThrow();
    });

    it('should reject parameter count below 4B', () => {
      const invalidConfig = {
        ...validConfig,
        architecture: {
          ...validConfig.architecture,
          parameters: 3e9
        }
      };
      expect(() => validateAutoregressiveConfig.parse(invalidConfig))
        .toThrow('Model must have at least 4B parameters');
    });

    it('should reject parameter count above 13B', () => {
      const invalidConfig = {
        ...validConfig,
        architecture: {
          ...validConfig.architecture,
          parameters: 14e9
        }
      };
      expect(() => validateAutoregressiveConfig.parse(invalidConfig))
        .toThrow('Model cannot exceed 13B parameters');
    });

    it('should validate correct model type', () => {
      const invalidConfig = {
        ...validConfig,
        architecture: {
          ...validConfig.architecture,
          type: 'DIFFUSION'
        }
      };
      expect(() => validateAutoregressiveConfig.parse(invalidConfig))
        .toThrow();
    });

    it('should require valid version string', () => {
      const invalidConfig = {
        ...validConfig,
        configVersion: 'invalid'
      };
      expect(() => validateAutoregressiveConfig.parse(invalidConfig))
        .toThrow('Config version must follow semantic versioning');
    });
  });

  describe('Resolution Constraints', () => {
    it('should validate 720p resolution', () => {
      expect(() => validateAutoregressiveConfig.parse(validConfig)).not.toThrow();
    });

    it('should reject resolution above 1080p', () => {
      const invalidConfig = {
        ...validConfig,
        maxResolution: {
          width: 1920,
          height: 1440
        }
      };
      expect(() => validateAutoregressiveConfig.parse(invalidConfig))
        .toThrow('Maximum supported height is 1080px');
    });

    it('should validate pixel count constraint', () => {
      const invalidConfig = {
        ...validConfig,
        maxResolution: {
          width: 1920,
          height: 1080
        }
      };
      expect(() => validateAutoregressiveConfig.parse(invalidConfig))
        .not.toThrow();
    });

    it('should reject negative dimensions', () => {
      const invalidConfig = {
        ...validConfig,
        maxResolution: {
          width: -1280,
          height: 720
        }
      };
      expect(() => validateAutoregressiveConfig.parse(invalidConfig))
        .toThrow();
    });
  });

  describe('Frame and Batch Settings', () => {
    it('should validate frame count within limit', () => {
      expect(() => validateAutoregressiveConfig.parse(validConfig)).not.toThrow();
    });

    it('should reject frame count above 57', () => {
      const invalidConfig = {
        ...validConfig,
        maxFrames: 58
      };
      expect(() => validateAutoregressiveConfig.parse(invalidConfig))
        .toThrow('Maximum frames limited to 57');
    });

    it('should validate power of 2 batch sizes', () => {
      const validBatchSizes = [1, 2, 4, 8, 16, 32];
      validBatchSizes.forEach(size => {
        const config = {
          ...validConfig,
          batchSize: size
        };
        expect(() => validateAutoregressiveConfig.parse(config)).not.toThrow();
      });
    });

    it('should reject non-power of 2 batch sizes', () => {
      const invalidConfig = {
        ...validConfig,
        batchSize: 3
      };
      expect(() => validateAutoregressiveConfig.parse(invalidConfig))
        .toThrow('Batch size must be a power of 2');
    });
  });

  describe('Generation Settings', () => {
    it('should validate temperature within 0-1 range', () => {
      const validTemps = [0, 0.5, 1];
      validTemps.forEach(temp => {
        const config = {
          ...validConfig,
          temperature: temp
        };
        expect(() => validateAutoregressiveConfig.parse(config)).not.toThrow();
      });
    });

    it('should reject invalid temperature values', () => {
      const invalidConfig = {
        ...validConfig,
        temperature: 1.5
      };
      expect(() => validateAutoregressiveConfig.parse(invalidConfig))
        .toThrow('Temperature must not exceed 1.0');
    });

    it('should validate topK within range', () => {
      const validTopKs = [1, 50, 100];
      validTopKs.forEach(k => {
        const config = {
          ...validConfig,
          topK: k
        };
        expect(() => validateAutoregressiveConfig.parse(config)).not.toThrow();
      });
    });

    it('should reject invalid topK values', () => {
      const invalidConfig = {
        ...validConfig,
        topK: 101
      };
      expect(() => validateAutoregressiveConfig.parse(invalidConfig))
        .toThrow('Top-K must not exceed 100');
    });

    it('should validate topP within 0-1 range', () => {
      const validTopPs = [0, 0.5, 1];
      validTopPs.forEach(p => {
        const config = {
          ...validConfig,
          topP: p
        };
        expect(() => validateAutoregressiveConfig.parse(config)).not.toThrow();
      });
    });

    it('should reject invalid topP values', () => {
      const invalidConfig = {
        ...validConfig,
        topP: -0.1
      };
      expect(() => validateAutoregressiveConfig.parse(invalidConfig))
        .toThrow('Top-P must be non-negative');
    });
  });

  describe('Default Configuration', () => {
    it('should validate default configuration', () => {
      expect(() => validateAutoregressiveConfig.parse(DEFAULT_AUTOREGRESSIVE_CONFIG))
        .not.toThrow();
    });

    it('should have correct default values', () => {
      expect(DEFAULT_AUTOREGRESSIVE_CONFIG).toMatchObject({
        architecture: {
          type: ModelType.AUTOREGRESSIVE,
          parameters: 4e9,
          variant: 'base'
        },
        maxResolution: {
          width: 1280,
          height: 720
        },
        maxFrames: 57,
        batchSize: 16,
        temperature: 0.8,
        topK: 50,
        topP: 0.9
      });
    });
  });
});