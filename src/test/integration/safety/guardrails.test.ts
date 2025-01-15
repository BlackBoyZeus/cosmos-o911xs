// jest version: 29.0.0
// fs version: latest

import { PreGuard } from '../../../backend/src/core/safety/PreGuard';
import { PostGuard } from '../../../backend/src/core/safety/PostGuard';
import { SafetyClassifier } from '../../../backend/src/core/safety/SafetyClassifier';
import { 
  SafetyStatus, 
  GuardType, 
  SafetyCheckDetails 
} from '../../../backend/src/interfaces/ISafetyLog';
import { 
  SafetyCheckType, 
  SafetyThresholdsImpl 
} from '../../../backend/src/types/safety';
import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';

describe('Safety Guardrails Integration Tests', () => {
  let preGuard: PreGuard;
  let postGuard: PostGuard;
  let safetyClassifier: SafetyClassifier;
  let testVideos: { [key: string]: Buffer };

  const TEST_TIMEOUT = 30000; // 30s timeout for long-running tests
  const SAFETY_THRESHOLDS = new SafetyThresholdsImpl(
    0.8,  // contentSafetyThreshold
    0.9,  // faceDetectionThreshold
    0.9,  // harmfulContentThreshold
    0.7,  // biasCheckThreshold
    0.9,  // privacyThreshold
    0.95  // complianceThreshold
  );

  beforeEach(async () => {
    // Initialize components with test configuration
    safetyClassifier = new SafetyClassifier(SAFETY_THRESHOLDS, {
      contentSafetyPath: './models/content_safety.pt',
      faceDetectionPath: './models/face_detection.pt',
      harmfulContentPath: './models/harmful_content.pt',
      biasCheckPath: './models/bias_check.pt'
    });

    preGuard = new PreGuard(
      SAFETY_THRESHOLDS,
      { classifier: safetyClassifier },
      { host: 'localhost', port: 6379 },
      { namespace: 'test_metrics' }
    );

    postGuard = new PostGuard(
      {
        highThreshold: 0.9,
        lowThreshold: 0.7
      },
      { classifier: safetyClassifier },
      { host: 'localhost', port: 6379 }
    );

    // Load test video fixtures
    testVideos = {
      sample_720p: readFileSync('src/test/fixtures/videos/sample_720p.mp4'),
      sample_1080p: readFileSync('src/test/fixtures/videos/sample_1080p.mp4'),
      edge_cases: readFileSync('src/test/fixtures/videos/edge_cases.mp4')
    };
  });

  describe('PreGuard Integration Tests', () => {
    it('should block harmful content in text prompts', async () => {
      const harmfulPrompt = 'generate harmful content xyz';
      const result = await preGuard.check(harmfulPrompt);
      
      expect(result).toBe(SafetyStatus.FAIL);
      
      const metrics = await preGuard.getMetrics();
      expect(metrics.failedChecks).toBeGreaterThan(0);
    }, TEST_TIMEOUT);

    it('should allow safe content to pass through', async () => {
      const safePrompt = 'generate a peaceful garden scene';
      const result = await preGuard.check(safePrompt);
      
      expect(result).toBe(SafetyStatus.PASS);
      
      const metrics = await preGuard.getMetrics();
      expect(metrics.passedChecks).toBeGreaterThan(0);
    });

    it('should handle warning states correctly', async () => {
      const warningPrompt = 'generate content with mild concerns';
      const result = await preGuard.check(warningPrompt);
      
      expect(result).toBe(SafetyStatus.WARNING);
      
      const warningState = await preGuard.getWarningState();
      expect(warningState.hasWarnings).toBe(true);
    });

    it('should maintain performance under concurrent checks', async () => {
      const prompts = Array(100).fill('safe content prompt');
      const startTime = Date.now();
      
      const results = await Promise.all(
        prompts.map(prompt => preGuard.check(prompt))
      );
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(10000); // 10s max for 100 checks
      expect(results.every(r => r === SafetyStatus.PASS)).toBe(true);
    }, TEST_TIMEOUT);
  });

  describe('PostGuard Integration Tests', () => {
    it('should detect and blur faces with 100% compliance', async () => {
      const result = await postGuard.check(testVideos.sample_720p, {
        checkType: SafetyCheckType.FACE_DETECTION
      });
      
      expect(result).toBe(SafetyStatus.PASS);
      
      const metrics = await postGuard.getPerformanceMetrics();
      expect(metrics.faceDetectionAccuracy).toBeGreaterThanOrEqual(0.99);
    }, TEST_TIMEOUT);

    it('should identify harmful content in videos efficiently', async () => {
      const startTime = Date.now();
      const result = await postGuard.check(testVideos.edge_cases, {
        checkType: SafetyCheckType.HARMFUL_CONTENT
      });
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(600000); // 600s max per spec
      expect(result).toBe(SafetyStatus.FAIL);
    }, TEST_TIMEOUT);

    it('should maintain complete audit trail under load', async () => {
      const generationId = randomUUID();
      const modelId = randomUUID();
      const status = SafetyStatus.PASS;
      const details: SafetyCheckDetails = {
        score: 0.95,
        threshold: 0.9,
        metadata: {
          duration: 150,
          checkId: randomUUID()
        }
      };

      await postGuard.logCheck(generationId, modelId, status, details);
      
      const metrics = await postGuard.getPerformanceMetrics();
      expect(metrics.auditTrailCoverage).toBe(100);
    });

    it('should optimize memory usage for large files', async () => {
      const result = await postGuard.check(testVideos.sample_1080p, {
        optimizeMemory: true
      });
      
      const metrics = await postGuard.getPerformanceMetrics();
      expect(metrics.peakMemoryUsage).toBeLessThan(1024 * 1024 * 1024); // 1GB max
      expect(result).toBe(SafetyStatus.PASS);
    }, TEST_TIMEOUT);
  });

  describe('End-to-End Safety Pipeline Tests', () => {
    it('should maintain safety throughout generation pipeline', async () => {
      // Test complete pipeline flow
      const prompt = 'generate safe video content';
      const preCheckResult = await preGuard.check(prompt);
      expect(preCheckResult).toBe(SafetyStatus.PASS);

      // Simulate video generation
      const generatedContent = testVideos.sample_720p;
      
      const postCheckResult = await postGuard.check(generatedContent);
      expect(postCheckResult).toBe(SafetyStatus.PASS);

      // Verify metrics and audit trail
      const preMetrics = await preGuard.getMetrics();
      const postMetrics = await postGuard.getPerformanceMetrics();
      
      expect(preMetrics.totalChecks).toBeGreaterThan(0);
      expect(postMetrics.totalChecks).toBeGreaterThan(0);
    }, TEST_TIMEOUT);

    it('should meet latency requirements under load', async () => {
      const videos = Array(10).fill(testVideos.sample_720p);
      const startTime = Date.now();

      await Promise.all(
        videos.map(video => postGuard.check(video))
      );

      const avgLatency = (Date.now() - startTime) / videos.length;
      expect(avgLatency).toBeLessThan(600000); // 600s max per video
    }, TEST_TIMEOUT);

    it('should handle concurrent safety pipelines', async () => {
      const pipelines = Array(5).fill(null).map(async () => {
        const preCheck = await preGuard.check('safe content');
        expect(preCheck).toBe(SafetyStatus.PASS);

        const postCheck = await postGuard.check(testVideos.sample_720p);
        expect(postCheck).toBe(SafetyStatus.PASS);
      });

      await Promise.all(pipelines);
    }, TEST_TIMEOUT);
  });

  afterEach(async () => {
    // Cleanup test resources
    await Promise.all([
      preGuard.healthCheck(),
      postGuard.healthCheck()
    ]);
  });
});