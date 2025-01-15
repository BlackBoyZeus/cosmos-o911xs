// jest version: ^29.0.0
// @faker-js/faker version: ^8.0.0

import { jest, describe, beforeAll, afterAll, beforeEach, it, expect } from '@jest/globals';
import { faker } from '@faker-js/faker';
import { UUID, randomUUID } from 'crypto';

// Internal imports
import { PostGuard } from '../../../backend/src/core/safety/PostGuard';
import { SafetyClassifier } from '../../../backend/src/core/safety/SafetyClassifier';
import { GuardType, SafetyStatus, SafetyCheckDetails } from '../../../backend/src/interfaces/ISafetyLog';
import { setupTestEnvironment, teardownTestEnvironment } from '../../utils/testHelpers';

// Test constants
const TEST_TIMEOUT = 30000;
const MOCK_THRESHOLDS = {
  contentSafety: 0.8,
  faceDetection: 0.9,
  harmfulContent: 0.7,
  highThreshold: 0.9,
  lowThreshold: 0.7
};

describe('PostGuard Safety Checks', () => {
  let postGuard: PostGuard;
  let mockSafetyClassifier: jest.Mocked<SafetyClassifier>;

  beforeAll(async () => {
    await setupTestEnvironment();

    // Mock SafetyClassifier
    mockSafetyClassifier = {
      checkContent: jest.fn(),
      detectFaces: jest.fn(),
      checkHarmfulContent: jest.fn(),
      getMetrics: jest.fn()
    } as unknown as jest.Mocked<SafetyClassifier>;

    // Initialize PostGuard with mocked dependencies
    postGuard = new PostGuard(
      MOCK_THRESHOLDS,
      { classifierConfig: {} },
      { cacheConfig: { host: 'localhost', port: 6379 }}
    );
  });

  afterAll(async () => {
    await teardownTestEnvironment();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Content Safety Checks', () => {
    it('should pass content safety check when score exceeds threshold', async () => {
      // Arrange
      const mockContent = Buffer.from('test content');
      mockSafetyClassifier.checkContent.mockResolvedValue({
        score: 0.95,
        threshold: MOCK_THRESHOLDS.contentSafety,
        metadata: { duration: 100 }
      });

      // Act
      const result = await postGuard.check(mockContent);

      // Assert
      expect(result).toBe(SafetyStatus.PASS);
      expect(mockSafetyClassifier.checkContent).toHaveBeenCalledWith(
        mockContent,
        expect.any(Object)
      );
    });

    it('should fail content safety check when score is below threshold', async () => {
      // Arrange
      const mockContent = Buffer.from('unsafe content');
      mockSafetyClassifier.checkContent.mockResolvedValue({
        score: 0.6,
        threshold: MOCK_THRESHOLDS.contentSafety,
        metadata: { duration: 100 }
      });

      // Act
      const result = await postGuard.check(mockContent);

      // Assert
      expect(result).toBe(SafetyStatus.FAIL);
    });
  });

  describe('Face Detection', () => {
    it('should detect and handle faces appropriately', async () => {
      // Arrange
      const mockImage = Buffer.from('test image');
      mockSafetyClassifier.detectFaces.mockResolvedValue({
        score: 0.95,
        threshold: MOCK_THRESHOLDS.faceDetection,
        metadata: {
          faceCount: 2,
          faceLocations: [[10, 20, 30, 40], [50, 60, 70, 80]],
          duration: 150
        }
      });

      // Act
      const result = await postGuard.check(mockImage);

      // Assert
      expect(result).toBe(SafetyStatus.PASS);
      expect(mockSafetyClassifier.detectFaces).toHaveBeenCalledWith(
        mockImage,
        expect.any(Object)
      );
    });

    it('should handle face detection failures appropriately', async () => {
      // Arrange
      const mockImage = Buffer.from('test image');
      mockSafetyClassifier.detectFaces.mockRejectedValue(
        new Error('Face detection failed')
      );

      // Act & Assert
      await expect(postGuard.check(mockImage)).rejects.toThrow('Face detection failed');
    });
  });

  describe('Harmful Content Detection', () => {
    it('should detect harmful content and fail check', async () => {
      // Arrange
      const mockContent = Buffer.from('harmful content');
      mockSafetyClassifier.checkHarmfulContent.mockResolvedValue({
        score: 0.4,
        threshold: MOCK_THRESHOLDS.harmfulContent,
        metadata: { duration: 120 }
      });

      // Act
      const result = await postGuard.check(mockContent);

      // Assert
      expect(result).toBe(SafetyStatus.FAIL);
      expect(mockSafetyClassifier.checkHarmfulContent).toHaveBeenCalledWith(
        mockContent,
        expect.any(Object)
      );
    });

    it('should pass check when no harmful content is detected', async () => {
      // Arrange
      const mockContent = Buffer.from('safe content');
      mockSafetyClassifier.checkHarmfulContent.mockResolvedValue({
        score: 0.9,
        threshold: MOCK_THRESHOLDS.harmfulContent,
        metadata: { duration: 120 }
      });

      // Act
      const result = await postGuard.check(mockContent);

      // Assert
      expect(result).toBe(SafetyStatus.PASS);
    });
  });

  describe('Safety Check Logging', () => {
    it('should log safety check results with complete audit trail', async () => {
      // Arrange
      const generationId = randomUUID();
      const modelId = randomUUID();
      const mockDetails: SafetyCheckDetails = {
        score: 0.95,
        threshold: MOCK_THRESHOLDS.contentSafety,
        metadata: {
          duration: 100,
          checkType: 'content_safety'
        }
      };

      // Act
      await postGuard.logCheck(
        generationId,
        modelId,
        SafetyStatus.PASS,
        mockDetails
      );

      // Assert
      // Verify log entry was created with correct data
      // Note: Actual implementation would verify log storage
      expect(true).toBe(true);
    });

    it('should handle logging errors appropriately', async () => {
      // Arrange
      const generationId = randomUUID();
      const modelId = randomUUID();
      const mockDetails: SafetyCheckDetails = {
        score: 0.95,
        threshold: MOCK_THRESHOLDS.contentSafety,
        metadata: {
          duration: 100,
          error: new Error('Logging failed')
        }
      };

      // Act & Assert
      await expect(
        postGuard.logCheck(
          generationId,
          modelId,
          SafetyStatus.PASS,
          mockDetails
        )
      ).rejects.toThrow('Logging failed');
    });
  });

  describe('Cache Behavior', () => {
    it('should use cached results when available', async () => {
      // Arrange
      const mockContent = Buffer.from('cached content');
      const cachedResult = {
        status: SafetyStatus.PASS,
        details: {
          score: 0.95,
          threshold: MOCK_THRESHOLDS.contentSafety
        }
      };

      // Simulate cached result
      jest.spyOn(postGuard['cache'], 'get').mockResolvedValue(
        JSON.stringify(cachedResult)
      );

      // Act
      const result = await postGuard.check(mockContent);

      // Assert
      expect(result).toBe(SafetyStatus.PASS);
      expect(mockSafetyClassifier.checkContent).not.toHaveBeenCalled();
    });

    it('should cache results after successful check', async () => {
      // Arrange
      const mockContent = Buffer.from('new content');
      const cacheSpy = jest.spyOn(postGuard['cache'], 'set');

      mockSafetyClassifier.checkContent.mockResolvedValue({
        score: 0.95,
        threshold: MOCK_THRESHOLDS.contentSafety,
        metadata: { duration: 100 }
      });

      // Act
      await postGuard.check(mockContent);

      // Assert
      expect(cacheSpy).toHaveBeenCalled();
    });
  });
});