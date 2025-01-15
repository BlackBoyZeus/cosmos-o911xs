import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import { DataCurator } from '../../../backend/src/core/curator/DataCurator';
import { createMockVideo } from '../../utils/mockData';
import { ProcessingStatus } from '../../../backend/src/types/common';
import { MetricsCollector } from '../../../backend/src/utils/metrics';
import { IVideo } from '../../../backend/src/interfaces/IVideo';

describe('DataCurator', () => {
  let curator: DataCurator;
  let metricsCollector: MetricsCollector;
  let mockVideo: IVideo;

  beforeEach(() => {
    // Initialize metrics collector
    metricsCollector = MetricsCollector.getInstance();
    jest.spyOn(metricsCollector, 'recordProcessingMetrics');
    jest.spyOn(metricsCollector, 'recordTokenizationMetrics');

    // Initialize curator with test configuration
    curator = new DataCurator({
      gpuDeviceId: 0,
      batchSize: 32,
      maxConcurrent: 4,
      qualityThresholds: {
        minPSNR: 25.0,
        minSSIM: 0.7,
        maxFID: 50.0,
        maxFVD: 150.0
      },
      retryPolicies: {
        ProcessingError: {
          maxAttempts: 3,
          backoff: 1000,
          timeout: 30000
        }
      }
    });

    // Create mock video for testing
    mockVideo = createMockVideo({
      status: ProcessingStatus.PENDING,
      quality: {
        psnr: 30.0,
        ssim: 0.85,
        fid: 35.0,
        fvd: 120.0,
        sampsonError: 1.2,
        poseAccuracy: 0.85
      }
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Video Processing', () => {
    it('should successfully process a single video', async () => {
      const processedVideo = await curator.processVideo(mockVideo);

      expect(processedVideo.status).toBe(ProcessingStatus.COMPLETED);
      expect(processedVideo.quality).toBeDefined();
      expect(processedVideo.metadata.processingDuration).toBeDefined();
      expect(metricsCollector.recordProcessingMetrics).toHaveBeenCalled();
    });

    it('should handle video processing failures', async () => {
      const failedVideo = createMockVideo({
        path: 'invalid/path.mp4',
        status: ProcessingStatus.PENDING
      });

      await expect(curator.processVideo(failedVideo))
        .rejects.toThrow('Video processing failed');
      expect(failedVideo.status).toBe(ProcessingStatus.FAILED);
    });

    it('should respect retry policies for processing errors', async () => {
      const retriableVideo = createMockVideo();
      jest.spyOn(curator['videoProcessor'], 'processVideo')
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValueOnce(retriableVideo);

      const processedVideo = await curator.processVideo(retriableVideo);
      expect(processedVideo.status).toBe(ProcessingStatus.COMPLETED);
      expect(processedVideo.metadata.attempts).toBe(1);
    });
  });

  describe('Batch Processing', () => {
    it('should process multiple videos in parallel', async () => {
      const videos = Array(5).fill(null).map(() => createMockVideo());
      const processedVideos = await curator.processBatch(videos);

      expect(processedVideos).toHaveLength(5);
      expect(processedVideos.every(v => v.status === ProcessingStatus.COMPLETED)).toBe(true);
      expect(metricsCollector.recordProcessingMetrics).toHaveBeenCalledTimes(5);
    });

    it('should handle partial batch failures', async () => {
      const videos = [
        createMockVideo(),
        createMockVideo({ path: 'invalid/path.mp4' }),
        createMockVideo()
      ];

      const processedVideos = await curator.processBatch(videos);
      expect(processedVideos).toHaveLength(2);
      expect(processedVideos.every(v => v.status === ProcessingStatus.COMPLETED)).toBe(true);
    });

    it('should maintain processing order within batch', async () => {
      const videos = Array(3).fill(null).map((_, i) => 
        createMockVideo({ metadata: { sequence: i } })
      );

      const processedVideos = await curator.processBatch(videos);
      processedVideos.forEach((video, i) => {
        expect(video.metadata.sequence).toBe(i);
      });
    });
  });

  describe('Quality Assessment', () => {
    it('should assess video quality against thresholds', async () => {
      const processedVideo = await curator.processVideo(mockVideo);
      
      expect(processedVideo.quality.psnr).toBeGreaterThanOrEqual(25.0);
      expect(processedVideo.quality.ssim).toBeGreaterThanOrEqual(0.7);
      expect(processedVideo.quality.fid).toBeLessThanOrEqual(50.0);
      expect(processedVideo.quality.fvd).toBeLessThanOrEqual(150.0);
    });

    it('should reject videos below quality thresholds', async () => {
      const lowQualityVideo = createMockVideo({
        quality: {
          psnr: 20.0,
          ssim: 0.5,
          fid: 60.0,
          fvd: 200.0,
          sampsonError: 3.0,
          poseAccuracy: 0.5
        }
      });

      await expect(curator.processVideo(lowQualityVideo))
        .rejects.toThrow('Video quality below acceptable thresholds');
      expect(lowQualityVideo.status).toBe(ProcessingStatus.FAILED);
    });
  });

  describe('Annotation', () => {
    it('should generate accurate video annotations', async () => {
      const processedVideo = await curator.processVideo(mockVideo);
      
      expect(processedVideo.annotations).toBeDefined();
      expect(processedVideo.annotations.length).toBeGreaterThan(0);
      expect(processedVideo.metadata.annotationTimestamp).toBeDefined();
    });

    it('should apply safety checks during annotation', async () => {
      const processedVideo = await curator.processVideo(mockVideo);
      
      expect(processedVideo.metadata.safetyScore).toBeDefined();
      expect(processedVideo.metadata.safetyDetails).toBeDefined();
    });
  });

  describe('Deduplication', () => {
    it('should detect duplicate videos', async () => {
      const originalVideo = await curator.processVideo(mockVideo);
      const duplicateVideo = createMockVideo({
        path: originalVideo.path,
        checksum: originalVideo.checksum
      });

      await expect(curator.processVideo(duplicateVideo))
        .rejects.toThrow('Duplicate video detected');
    });

    it('should handle near-duplicate detection', async () => {
      const originalVideo = await curator.processVideo(mockVideo);
      const similarVideo = createMockVideo({
        quality: originalVideo.quality,
        metadata: { ...originalVideo.metadata, slight_variation: true }
      });

      await expect(curator.processVideo(similarVideo))
        .rejects.toThrow('Duplicate video detected');
    });
  });

  describe('Performance', () => {
    it('should meet processing throughput requirements', async () => {
      const startTime = Date.now();
      const videos = Array(10).fill(null).map(() => createMockVideo());
      
      await curator.processBatch(videos);
      
      const duration = Date.now() - startTime;
      const throughput = (videos.length / duration) * 86400000; // Videos per day
      expect(throughput).toBeGreaterThan(100000); // 100k+ videos per day
    });

    it('should meet latency requirements', async () => {
      const startTime = Date.now();
      const processedVideo = await curator.processVideo(mockVideo);
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(600000); // Less than 600s for processing
    });

    it('should track GPU resource utilization', async () => {
      const processedVideo = await curator.processVideo(mockVideo);
      
      expect(processedVideo.metadata.gpuUtilization).toBeDefined();
      expect(processedVideo.metadata.gpuUtilization).toBeLessThanOrEqual(100);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid video data', async () => {
      const invalidVideo = createMockVideo({ path: '' });
      
      await expect(curator.processVideo(invalidVideo))
        .rejects.toThrow();
      expect(invalidVideo.status).toBe(ProcessingStatus.FAILED);
    });

    it('should handle processing queue errors', async () => {
      jest.spyOn(curator['processingQueue'], 'add')
        .mockRejectedValueOnce(new Error('Queue error'));

      await expect(curator.processVideo(mockVideo))
        .rejects.toThrow('Queue error');
    });

    it('should handle GPU resource allocation failures', async () => {
      jest.spyOn(curator['videoProcessor'], 'processVideo')
        .mockRejectedValueOnce(new Error('GPU allocation failed'));

      await expect(curator.processVideo(mockVideo))
        .rejects.toThrow('GPU allocation failed');
      expect(mockVideo.status).toBe(ProcessingStatus.FAILED);
    });
  });
});