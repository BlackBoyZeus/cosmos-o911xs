import { describe, test, expect, jest, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { faker } from '@faker-js/faker';
import { PreGuard } from '../../../backend/src/core/safety/PreGuard';
import { IGuard } from '../../../backend/src/core/safety/interfaces/IGuard';
import { SafetyCheckType, SafetyThresholds, SafetyThresholdsImpl } from '../../../backend/src/types/safety';
import { setupTestEnvironment, teardownTestEnvironment } from '../../utils/testHelpers';
import { SafetyClassifier } from '../../../backend/src/core/safety/SafetyClassifier';
import { SafetyStatus } from '../../../backend/src/interfaces/ISafetyLog';
import { UUID, randomUUID } from 'crypto';

// Mock SafetyClassifier
jest.mock('../../../backend/src/core/safety/SafetyClassifier');

// Mock logger
jest.mock('winston');

// Default test thresholds
const defaultThresholds: SafetyThresholds = new SafetyThresholdsImpl(
  0.8, // contentSafetyThreshold
  0.9, // faceDetectionThreshold
  0.9, // harmfulContentThreshold
  0.7, // biasCheckThreshold
  0.9, // privacyThreshold
  0.95 // complianceThreshold
);

describe('PreGuard', () => {
  let preGuard: PreGuard;
  let mockClassifier: jest.Mocked<SafetyClassifier>;

  beforeAll(async () => {
    await setupTestEnvironment();
    mockClassifier = new SafetyClassifier(defaultThresholds, {}) as jest.Mocked<SafetyClassifier>;
  });

  afterAll(async () => {
    await teardownTestEnvironment();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    preGuard = new PreGuard(defaultThresholds);
  });

  describe('Initialization', () => {
    test('should implement IGuard interface with PRE_GUARD type', () => {
      expect(preGuard).toBeDefined();
      expect(preGuard.guardType).toBe('PRE_GUARD');
    });

    test('should initialize with provided thresholds and validate ranges', () => {
      const customThresholds = new SafetyThresholdsImpl(0.85, 0.95, 0.92);
      const guard = new PreGuard(customThresholds);
      expect(guard['thresholds'].contentSafetyThreshold).toBe(0.85);
      expect(guard['thresholds'].faceDetectionThreshold).toBe(0.95);
      expect(guard['thresholds'].harmfulContentThreshold).toBe(0.92);
    });

    test('should throw error for invalid threshold configuration', () => {
      const invalidThresholds = {
        ...defaultThresholds,
        contentSafetyThreshold: 1.5 // Invalid value > 1
      };
      expect(() => new PreGuard(invalidThresholds)).toThrow('Invalid safety thresholds configuration');
    });
  });

  describe('Content Safety Checks', () => {
    test('should pass content above safety threshold', async () => {
      const content = faker.lorem.paragraph();
      mockClassifier.checkContent.mockResolvedValue({
        score: 0.95,
        threshold: defaultThresholds.contentSafetyThreshold,
        metadata: { checkId: randomUUID() }
      });

      const result = await preGuard.check(content);
      expect(result).toBe(SafetyStatus.PASS);
    });

    test('should fail content below safety threshold', async () => {
      const content = faker.lorem.paragraph();
      mockClassifier.checkContent.mockResolvedValue({
        score: 0.6,
        threshold: defaultThresholds.contentSafetyThreshold,
        metadata: { checkId: randomUUID() }
      });

      const result = await preGuard.check(content);
      expect(result).toBe(SafetyStatus.FAIL);
    });

    test('should respect custom thresholds in options', async () => {
      const content = faker.lorem.paragraph();
      const customThreshold = 0.75;
      mockClassifier.checkContent.mockResolvedValue({
        score: 0.8,
        threshold: customThreshold,
        metadata: { checkId: randomUUID() }
      });

      const result = await preGuard.check(content, { contentSafetyThreshold: customThreshold });
      expect(result).toBe(SafetyStatus.PASS);
    });

    test('should cache check results for configured duration', async () => {
      const content = faker.lorem.paragraph();
      const contentHash = Buffer.from(JSON.stringify(content)).toString('base64');
      
      mockClassifier.checkContent.mockResolvedValue({
        score: 0.9,
        threshold: defaultThresholds.contentSafetyThreshold,
        metadata: { checkId: randomUUID() }
      });

      // First check should use classifier
      await preGuard.check(content);
      expect(mockClassifier.checkContent).toHaveBeenCalledTimes(1);

      // Second check should use cache
      await preGuard.check(content);
      expect(mockClassifier.checkContent).toHaveBeenCalledTimes(1);

      // Verify cache entry
      const cached = await preGuard['cache'].get(contentHash);
      expect(cached).toBeDefined();
    });
  });

  describe('Harmful Content Detection', () => {
    test('should detect and block harmful content', async () => {
      const content = faker.lorem.paragraph();
      mockClassifier.checkHarmfulContent.mockResolvedValue({
        score: 0.95, // High harmful content score
        threshold: defaultThresholds.harmfulContentThreshold,
        metadata: { checkId: randomUUID() }
      });

      const result = await preGuard.check(content);
      expect(result).toBe(SafetyStatus.FAIL);
    });

    test('should handle multiple harmful content types', async () => {
      const content = faker.lorem.paragraph();
      mockClassifier.checkHarmfulContent.mockResolvedValue({
        score: 0.92,
        threshold: defaultThresholds.harmfulContentThreshold,
        metadata: {
          checkId: randomUUID(),
          categoryScores: {
            violence: 0.95,
            hate: 0.90,
            explicit: 0.85
          }
        }
      });

      const result = await preGuard.check(content);
      expect(result).toBe(SafetyStatus.FAIL);
    });
  });

  describe('Safety Logging', () => {
    test('should log successful checks with audit fields', async () => {
      const generationId = randomUUID();
      const modelId = randomUUID();
      const status = SafetyStatus.PASS;
      const details = {
        score: 0.95,
        threshold: defaultThresholds.contentSafetyThreshold,
        metadata: {
          checkId: randomUUID(),
          duration: 50
        }
      };

      await preGuard.logCheck(generationId, modelId, status, details);

      expect(preGuard['logger'].info).toHaveBeenCalledWith(
        'Safety check completed',
        expect.objectContaining({
          generationId,
          modelId,
          guardType: 'PRE_GUARD',
          status,
          details
        })
      );
    });

    test('should log failed checks with detailed reasons', async () => {
      const generationId = randomUUID();
      const modelId = randomUUID();
      const status = SafetyStatus.FAIL;
      const details = {
        score: 0.6,
        threshold: defaultThresholds.contentSafetyThreshold,
        metadata: {
          checkId: randomUUID(),
          duration: 45,
          failureReason: 'Content safety score below threshold'
        }
      };

      await preGuard.logCheck(generationId, modelId, status, details);

      expect(preGuard['logger'].info).toHaveBeenCalledWith(
        'Safety check completed',
        expect.objectContaining({
          status: SafetyStatus.FAIL,
          details: expect.objectContaining({
            metadata: expect.objectContaining({
              failureReason: 'Content safety score below threshold'
            })
          })
        })
      );
    });

    test('should maintain complete audit coverage', async () => {
      const content = faker.lorem.paragraph();
      mockClassifier.checkContent.mockResolvedValue({
        score: 0.95,
        threshold: defaultThresholds.contentSafetyThreshold,
        metadata: { checkId: randomUUID() }
      });

      const result = await preGuard.check(content);
      
      expect(preGuard['metrics'].increment).toHaveBeenCalledWith('check_status_pass');
      expect(preGuard['metrics'].histogram).toHaveBeenCalledWith('check_duration', expect.any(Number));
    });
  });

  describe('Error Handling', () => {
    test('should handle classifier errors gracefully', async () => {
      const content = faker.lorem.paragraph();
      mockClassifier.checkContent.mockRejectedValue(new Error('Classifier error'));

      await expect(preGuard.check(content)).rejects.toThrow('Safety check failed');
      expect(preGuard['metrics'].increment).toHaveBeenCalledWith('check_failures');
    });

    test('should handle concurrent check requests safely', async () => {
      const content = faker.lorem.paragraph();
      mockClassifier.checkContent.mockResolvedValue({
        score: 0.9,
        threshold: defaultThresholds.contentSafetyThreshold,
        metadata: { checkId: randomUUID() }
      });

      // Perform multiple concurrent checks
      const checks = Array(5).fill(null).map(() => preGuard.check(content));
      const results = await Promise.all(checks);

      expect(results).toHaveLength(5);
      results.forEach(result => expect(result).toBe(SafetyStatus.PASS));
    });
  });
});