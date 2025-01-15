import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Queue } from 'bull';
import { DataCurationWorker } from '../../../backend/src/workers/DataCurationWorker';
import { createMockDataset, createMockVideo } from '../../utils/mockData';
import { ProcessingStatus } from '../../../backend/src/types/common';

// Mock dependencies
jest.mock('bull');
jest.mock('../../../backend/src/core/curator/DataCurator');
jest.mock('../../../backend/src/services/DatasetService');
jest.mock('../../../backend/src/utils/metrics');
jest.mock('../../../backend/src/utils/gpu');

describe('DataCurationWorker', () => {
  let worker: DataCurationWorker;
  let mockQueue: jest.Mocked<Queue>;
  let mockDataCurator: jest.Mock;
  let mockDatasetService: jest.Mock;
  let mockMetricsCollector: jest.Mock;
  let mockGPUManager: jest.Mock;

  beforeEach(() => {
    // Initialize mocks
    mockQueue = {
      process: jest.fn(),
      pause: jest.fn(),
      clean: jest.fn(),
      close: jest.fn(),
      on: jest.fn(),
      add: jest.fn(),
      getJobCounts: jest.fn()
    } as unknown as jest.Mocked<Queue>;

    mockDataCurator = {
      processVideo: jest.fn(),
      processBatch: jest.fn(),
      validateVideo: jest.fn(),
      annotateVideo: jest.fn(),
      deduplicateVideo: jest.fn()
    };

    mockDatasetService = {
      updateDataset: jest.fn(),
      getDatasetStatus: jest.fn(),
      logProcessingMetrics: jest.fn()
    };

    mockMetricsCollector = {
      recordGenerationMetrics: jest.fn(),
      recordRequest: jest.fn()
    };

    mockGPUManager = {
      initializeGPU: jest.fn(),
      allocateGPUMemory: jest.fn(),
      releaseGPUMemory: jest.fn(),
      getGPUMetrics: jest.fn()
    };

    // Initialize worker with mocks
    worker = new DataCurationWorker(
      mockDataCurator,
      mockDatasetService,
      mockMetricsCollector,
      mockGPUManager,
      {
        queueName: 'test-queue',
        redisUrl: 'redis://localhost:6379',
        concurrency: 2,
        timeout: 3600000
      }
    );
  });

  afterEach(async () => {
    await worker.stop();
    jest.clearAllMocks();
  });

  test('should initialize worker with correct configuration', async () => {
    expect(worker).toBeDefined();
    expect(mockQueue.on).toHaveBeenCalledTimes(3); // completed, failed, error handlers
  });

  test('should start worker and initialize GPU resources', async () => {
    await worker.start();

    expect(mockGPUManager.initializeGPU).toHaveBeenCalledWith({
      deviceCount: 1,
      memoryLimit: 8 * 1024 * 1024 * 1024,
      computeCapability: '7.0'
    });
    expect(mockQueue.process).toHaveBeenCalledWith(2, expect.any(Function));
  });

  test('should gracefully stop worker and release resources', async () => {
    await worker.start();
    await worker.stop();

    expect(mockQueue.pause).toHaveBeenCalledWith(true);
    expect(mockQueue.clean).toHaveBeenCalledWith(0, 'active');
    expect(mockGPUManager.releaseGPUMemory).toHaveBeenCalledWith(0);
    expect(mockQueue.close).toHaveBeenCalled();
  });

  test('should process single video curation job successfully', async () => {
    const mockVideo = createMockVideo();
    const mockDataset = createMockDataset();
    const mockJob = {
      id: 'job-1',
      data: {
        videoId: mockVideo.id,
        datasetId: mockDataset.id,
        video: mockVideo
      }
    };

    mockDataCurator.processVideo.mockResolvedValue({
      ...mockVideo,
      status: ProcessingStatus.COMPLETED,
      quality: {
        psnr: 35.0,
        ssim: 0.95,
        fid: 25.0,
        fvd: 100.0
      }
    });

    await worker.start();
    await worker['processCurationJob'](mockJob as any);

    expect(mockGPUManager.allocateGPUMemory).toHaveBeenCalledWith(0, 8 * 1024 * 1024 * 1024);
    expect(mockDataCurator.processVideo).toHaveBeenCalledWith(mockVideo);
    expect(mockDatasetService.updateDataset).toHaveBeenCalledWith(
      mockDataset.id,
      expect.objectContaining({
        status: ProcessingStatus.COMPLETED
      })
    );
    expect(mockMetricsCollector.recordGenerationMetrics).toHaveBeenCalled();
  });

  test('should handle batch processing of videos', async () => {
    const mockVideos = [createMockVideo(), createMockVideo()];
    const mockDataset = createMockDataset();
    const mockJobs = mockVideos.map(video => ({
      id: `job-${video.id}`,
      data: {
        videoId: video.id,
        datasetId: mockDataset.id,
        video
      }
    }));

    mockDataCurator.processBatch.mockResolvedValue(
      mockVideos.map(video => ({
        ...video,
        status: ProcessingStatus.COMPLETED
      }))
    );

    await worker.start();
    await worker['processBatch'](mockJobs as any);

    expect(mockDataCurator.processBatch).toHaveBeenCalledWith(
      expect.arrayContaining(mockVideos)
    );
    expect(mockDatasetService.updateBatchStatus).toHaveBeenCalledWith(
      mockDataset.id,
      expect.objectContaining({
        status: ProcessingStatus.COMPLETED,
        processedCount: 2
      })
    );
  });

  test('should handle processing errors and implement retry logic', async () => {
    const mockVideo = createMockVideo();
    const mockJob = {
      id: 'job-1',
      data: {
        videoId: mockVideo.id,
        datasetId: 'dataset-1',
        video: mockVideo
      },
      attemptsMade: 1,
      retry: jest.fn()
    };

    const error = new Error('Processing failed');
    mockDataCurator.processVideo.mockRejectedValue(error);

    await worker.start();
    await expect(worker['processCurationJob'](mockJob as any)).rejects.toThrow(error);

    expect(mockDatasetService.updateDataset).toHaveBeenCalledWith(
      'dataset-1',
      expect.objectContaining({
        status: ProcessingStatus.FAILED,
        error: error.message
      })
    );
    expect(mockJob.retry).toHaveBeenCalledWith({ delay: 2000 });
  });

  test('should enforce processing SLAs and timeouts', async () => {
    const mockVideo = createMockVideo();
    const mockJob = {
      id: 'job-1',
      data: {
        videoId: mockVideo.id,
        datasetId: 'dataset-1',
        video: mockVideo
      }
    };

    // Simulate slow processing
    mockDataCurator.processVideo.mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 700))
    );

    await worker.start();
    await worker['processCurationJob'](mockJob as any);

    const metricsCall = mockMetricsCollector.recordGenerationMetrics.mock.calls[0][1];
    expect(metricsCall.duration).toBeLessThan(600000); // 600s SLA
  });

  test('should properly manage GPU resources', async () => {
    const mockVideo = createMockVideo();
    const mockJob = {
      id: 'job-1',
      data: {
        videoId: mockVideo.id,
        datasetId: 'dataset-1',
        video: mockVideo
      }
    };

    await worker.start();
    await worker['processCurationJob'](mockJob as any);

    expect(mockGPUManager.allocateGPUMemory).toHaveBeenCalledWith(0, 8 * 1024 * 1024 * 1024);
    expect(mockGPUManager.releaseGPUMemory).toHaveBeenCalledWith(0);
  });
});