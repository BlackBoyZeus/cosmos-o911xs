// jest version: ^29.0.0

import { describe, beforeEach, afterEach, test, expect, jest } from '@jest/globals';
import { Buffer } from 'buffer';

// Internal imports
import { SafetyClassifier } from '../../../backend/src/core/safety/SafetyClassifier';
import { SafetyCheckType, SafetyThresholds, SafetyMetrics } from '../../../backend/src/types/safety';
import { createMockSafetyLog, createMockImage, createMockVideo } from '../../utils/mockData';
import { ProcessingStatus } from '../../../backend/src/types/common';
import { SafetyStatus } from '../../../backend/src/interfaces/ISafetyLog';

describe('SafetyClassifier', () => {
  let classifier: SafetyClassifier | null;
  let mockThresholds: SafetyThresholds;
  let mockTestData: { images: Buffer[], videos: Buffer[] };
  let testMetrics: SafetyMetrics;

  beforeEach(() => {
    // Initialize strict safety thresholds
    mockThresholds = {
      contentSafetyThreshold: 0.95,
      faceDetectionThreshold: 0.98,
      harmfulContentThreshold: 0.95,
      biasCheckThreshold: 0.90,
      privacyThreshold: 0.95,
      complianceThreshold: 0.95,
      validate: () => true,
      checkThreshold: (type: SafetyCheckType, score: number) => score >= 0.9
    };

    // Initialize test data
    mockTestData = {
      images: [
        Buffer.from('mock-image-1'),
        Buffer.from('mock-image-2')
      ],
      videos: [
        Buffer.from('mock-video-1'),
        Buffer.from('mock-video-2')
      ]
    };

    // Initialize metrics tracking
    testMetrics = {
      totalChecks: 0,
      passedChecks: 0,
      failedChecks: 0,
      warningChecks: 0,
      averageProcessingTime: 0,
      checkTimestamps: new Map(),
      checkDurations: new Map(),
      auditTrail: new Map(),
      getPassRate: () => 0,
      getAverageProcessingTime: () => 0,
      getAuditTrailInRange: () => []
    };

    // Initialize classifier with mock configuration
    classifier = new SafetyClassifier(mockThresholds, {
      contentSafetyPath: 'models/content_safety.pt',
      faceDetectionPath: 'models/face_detection.pt',
      harmfulContentPath: 'models/harmful_content.pt',
      biasCheckPath: 'models/bias_check.pt'
    });
  });

  afterEach(() => {
    classifier = null;
    jest.clearAllMocks();
  });

  test('checkContent should detect unsafe content', async () => {
    expect(classifier).toBeTruthy();

    // Test safe content
    const safeContent = mockTestData.images[0];
    const safeResult = await classifier!.checkContent(safeContent);
    expect(safeResult.score).toBeGreaterThanOrEqual(mockThresholds.contentSafetyThreshold);
    expect(safeResult.metadata.checkId).toBeDefined();
    expect(safeResult.metadata.duration).toBeGreaterThan(0);

    // Test unsafe content
    const unsafeContent = mockTestData.images[1];
    const unsafeResult = await classifier!.checkContent(unsafeContent);
    expect(unsafeResult.score).toBeLessThan(mockThresholds.contentSafetyThreshold);
    
    // Verify metrics update
    const metrics = classifier!.getMetrics();
    expect(metrics.totalChecks).toBe(2);
    expect(metrics.passedChecks + metrics.failedChecks).toBe(2);
  });

  test('detectFaces should identify and protect faces', async () => {
    expect(classifier).toBeTruthy();

    // Test image with faces
    const imageWithFaces = mockTestData.images[0];
    const faceResult = await classifier!.detectFaces(imageWithFaces);
    expect(faceResult.metadata.faceCount).toBeGreaterThan(0);
    expect(faceResult.metadata.faceLocations).toBeDefined();
    expect(faceResult.score).toBeGreaterThanOrEqual(mockThresholds.faceDetectionThreshold);

    // Test image without faces
    const imageWithoutFaces = mockTestData.images[1];
    const noFaceResult = await classifier!.detectFaces(imageWithoutFaces);
    expect(noFaceResult.metadata.faceCount).toBe(0);
    
    // Verify face blur compliance
    const metrics = classifier!.getMetrics();
    expect(metrics.passedChecks).toBeGreaterThan(0);
  });

  test('checkHarmfulContent should detect harmful content', async () => {
    expect(classifier).toBeTruthy();

    // Test safe content
    const safeContent = mockTestData.videos[0];
    const safeResult = await classifier!.checkHarmfulContent(safeContent);
    expect(safeResult.score).toBeGreaterThanOrEqual(mockThresholds.harmfulContentThreshold);
    expect(safeResult.metadata.categoryScores).toBeDefined();

    // Test harmful content
    const harmfulContent = mockTestData.videos[1];
    const harmfulResult = await classifier!.checkHarmfulContent(harmfulContent);
    expect(harmfulResult.score).toBeLessThan(mockThresholds.harmfulContentThreshold);
    
    // Verify audit trail
    const metrics = classifier!.getMetrics();
    expect(metrics.auditTrail.size).toBeGreaterThan(0);
  });

  test('checkBias should detect biased content', async () => {
    expect(classifier).toBeTruthy();

    // Test unbiased content
    const unbiasedContent = mockTestData.videos[0];
    const unbiasedResult = await classifier!.checkBias(unbiasedContent);
    expect(unbiasedResult.score).toBeGreaterThanOrEqual(mockThresholds.biasCheckThreshold);
    expect(unbiasedResult.metadata.biasCategories).toBeDefined();

    // Test biased content
    const biasedContent = mockTestData.videos[1];
    const biasedResult = await classifier!.checkBias(biasedContent);
    expect(biasedResult.score).toBeLessThan(mockThresholds.biasCheckThreshold);
    
    // Verify bias detection accuracy
    const metrics = classifier!.getMetrics();
    expect(metrics.totalChecks).toBe(2);
  });

  test('getMetrics should return accurate safety metrics', async () => {
    expect(classifier).toBeTruthy();

    // Perform multiple safety checks
    await classifier!.checkContent(mockTestData.images[0]);
    await classifier!.detectFaces(mockTestData.images[0]);
    await classifier!.checkHarmfulContent(mockTestData.videos[0]);
    await classifier!.checkBias(mockTestData.videos[0]);

    // Get and verify metrics
    const metrics = classifier!.getMetrics();
    expect(metrics.totalChecks).toBe(4);
    expect(metrics.passedChecks + metrics.failedChecks).toBe(4);
    expect(metrics.averageProcessingTime).toBeGreaterThan(0);
    expect(metrics.checkTimestamps.size).toBe(4);
    expect(metrics.checkDurations.size).toBe(4);
    expect(metrics.auditTrail.size).toBe(4);
  });

  test('should handle invalid input gracefully', async () => {
    expect(classifier).toBeTruthy();

    // Test null input
    await expect(classifier!.checkContent(null as any)).rejects.toThrow();

    // Test empty buffer
    await expect(classifier!.detectFaces(Buffer.from(''))).rejects.toThrow();

    // Test invalid content type
    await expect(classifier!.checkHarmfulContent({} as any)).rejects.toThrow();

    // Verify error handling doesn't affect metrics
    const metrics = classifier!.getMetrics();
    expect(metrics.totalChecks).toBe(0);
  });

  test('should maintain complete audit trail', async () => {
    expect(classifier).toBeTruthy();

    // Perform checks that should be logged
    await classifier!.checkContent(mockTestData.images[0]);
    await classifier!.detectFaces(mockTestData.images[0]);

    // Verify audit trail completeness
    const metrics = classifier!.getMetrics();
    const auditTrail = Array.from(metrics.auditTrail.values());

    expect(auditTrail.length).toBe(2);
    auditTrail.forEach(record => {
      expect(record.checkId).toBeDefined();
      expect(record.timestamp).toBeInstanceOf(Date);
      expect(record.details).toBeDefined();
    });
  });
});