import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import { performance } from 'perf_hooks';

// Internal imports
import { DatasetService } from '../../../backend/src/services/DatasetService';
import { createMockDataset } from '../../utils/mockData';
import { MockDataset } from '../../utils/databaseMock';
import { MockStorageService } from '../../utils/storageMock';
import { MockGPUService } from '../../utils/gpuMock';
import { ProcessingStatus } from '../../../backend/src/types/common';

describe('DatasetService', () => {
  let datasetService: DatasetService;
  let mockDataset: MockDataset;
  let mockStorage: MockStorageService;
  let mockGPU: MockGPUService;

  beforeEach(() => {
    // Initialize mocks
    mockDataset = new MockDataset();
    mockStorage = new MockStorageService({
      provider: 'aws',
      region: 'us-east-1',
      credentials: {
        accessKeyId: 'mock-key',
        secretAccessKey: 'mock-secret'
      },
      bucketName: 'mock-bucket',
      encryption: { enabled: true },
      lifecycle: {
        enabled: true,
        archivalDays: 30,
        deletionDays: 90,
        transitionRules: []
      }
    });
    mockGPU = new MockGPUService();

    // Initialize service with mocks
    datasetService = new DatasetService(mockStorage, mockDataset, {
      storage: { maxSize: 1e12 }, // 1TB
      processing: { maxConcurrent: 4 }
    });

    // Reset all mock function calls
    jest.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up resources
    await mockStorage.reset();
    await mockDataset.delete('test-dataset');
  });

  describe('createDataset', () => {
    it('should create a new dataset with valid parameters', async () => {
      const mockDatasetData = createMockDataset({
        name: 'test-dataset',
        description: 'Test dataset for unit tests',
        version: '1.0.0',
        resolution: { width: 1920, height: 1080 }
      });

      const result = await datasetService.createDataset(mockDatasetData);

      expect(result).toBeDefined();
      expect(result.name).toBe('test-dataset');
      expect(result.status).toBe(ProcessingStatus.PENDING);
      expect(mockStorage.getMockFunction('upload')).toHaveBeenCalled();
    });

    it('should reject duplicate dataset names', async () => {
      const mockDatasetData = createMockDataset({ name: 'test-dataset' });
      await datasetService.createDataset(mockDatasetData);

      await expect(datasetService.createDataset(mockDatasetData))
        .rejects.toThrow('Dataset with name test-dataset already exists');
    });

    it('should validate dataset parameters', async () => {
      const invalidDataset = createMockDataset({
        name: '',
        resolution: { width: -1, height: -1 }
      });

      await expect(datasetService.createDataset(invalidDataset))
        .rejects.toThrow();
    });

    it('should handle storage initialization failures', async () => {
      mockStorage.configureMock({ errorRate: 1.0 });
      const mockDatasetData = createMockDataset();

      await expect(datasetService.createDataset(mockDatasetData))
        .rejects.toThrow();
    });

    it('should meet performance requirements', async () => {
      const start = performance.now();
      const mockDatasetData = createMockDataset();
      
      await datasetService.createDataset(mockDatasetData);
      
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(1000); // 1 second max
    });
  });

  describe('processDataset', () => {
    it('should process dataset with default options', async () => {
      const mockDatasetData = createMockDataset();
      const dataset = await datasetService.createDataset(mockDatasetData);
      
      const result = await datasetService.processDataset(dataset.id);

      expect(result.status).toBe(ProcessingStatus.COMPLETED);
      expect(result.metrics).toBeDefined();
    });

    it('should handle batch processing with GPU acceleration', async () => {
      const mockDatasetData = createMockDataset();
      const dataset = await datasetService.createDataset(mockDatasetData);
      
      const result = await datasetService.processDataset(dataset.id, {
        batchSize: 32,
        maxConcurrent: 4
      });

      expect(result.status).toBe(ProcessingStatus.COMPLETED);
      expect(mockGPU.checkUtilization()).toBeGreaterThan(0);
    });

    it('should enforce quality thresholds', async () => {
      const mockDatasetData = createMockDataset();
      const dataset = await datasetService.createDataset(mockDatasetData);
      
      const result = await datasetService.processDataset(dataset.id, {
        qualityThresholds: {
          minPSNR: 30,
          minSSIM: 0.9,
          maxFID: 30,
          maxFVD: 100
        }
      });

      expect(result.metrics.psnr).toBeGreaterThanOrEqual(30);
      expect(result.metrics.ssim).toBeGreaterThanOrEqual(0.9);
      expect(result.metrics.fid).toBeLessThanOrEqual(30);
      expect(result.metrics.fvd).toBeLessThanOrEqual(100);
    });

    it('should handle processing failures gracefully', async () => {
      const mockDatasetData = createMockDataset();
      const dataset = await datasetService.createDataset(mockDatasetData);
      
      mockGPU.simulateProcessing = jest.fn().mockRejectedValue(new Error('GPU error'));
      
      await expect(datasetService.processDataset(dataset.id))
        .rejects.toThrow('GPU error');
      
      const failedDataset = await mockDataset.findByName(dataset.name);
      expect(failedDataset?.status).toBe(ProcessingStatus.FAILED);
    });

    it('should meet throughput requirements', async () => {
      const datasets = await Promise.all(
        Array(10).fill(null).map(() => 
          datasetService.createDataset(createMockDataset())
        )
      );

      const start = performance.now();
      await Promise.all(
        datasets.map(dataset => 
          datasetService.processDataset(dataset.id)
        )
      );
      const duration = performance.now() - start;

      // Should process 10 datasets in under 10 seconds
      expect(duration).toBeLessThan(10000);
    });
  });

  describe('getDataset', () => {
    it('should retrieve dataset with caching', async () => {
      const mockDatasetData = createMockDataset();
      const dataset = await datasetService.createDataset(mockDatasetData);
      
      const result1 = await datasetService.getDataset(dataset.id);
      const result2 = await datasetService.getDataset(dataset.id);

      expect(result1).toEqual(result2);
      expect(mockDataset.findByName).toHaveBeenCalledTimes(1);
    });

    it('should force fresh data when requested', async () => {
      const mockDatasetData = createMockDataset();
      const dataset = await datasetService.createDataset(mockDatasetData);
      
      await datasetService.getDataset(dataset.id);
      await datasetService.getDataset(dataset.id, { forceFresh: true });

      expect(mockDataset.findByName).toHaveBeenCalledTimes(2);
    });
  });

  describe('updateDataset', () => {
    it('should update dataset metadata', async () => {
      const mockDatasetData = createMockDataset();
      const dataset = await datasetService.createDataset(mockDatasetData);
      
      const updatedDataset = await datasetService.updateDataset(dataset.id, {
        description: 'Updated description'
      });

      expect(updatedDataset.description).toBe('Updated description');
      expect(updatedDataset.updatedAt).toBeInstanceOf(Date);
    });

    it('should validate updates', async () => {
      const mockDatasetData = createMockDataset();
      const dataset = await datasetService.createDataset(mockDatasetData);
      
      await expect(datasetService.updateDataset(dataset.id, {
        resolution: { width: -1, height: -1 }
      })).rejects.toThrow();
    });
  });

  describe('deleteDataset', () => {
    it('should delete dataset and clean up storage', async () => {
      const mockDatasetData = createMockDataset();
      const dataset = await datasetService.createDataset(mockDatasetData);
      
      await datasetService.deleteDataset(dataset.id);

      expect(mockStorage.getMockFunction('delete')).toHaveBeenCalled();
      await expect(mockDataset.findByName(dataset.name))
        .resolves.toBeNull();
    });

    it('should handle deletion failures', async () => {
      const mockDatasetData = createMockDataset();
      const dataset = await datasetService.createDataset(mockDatasetData);
      
      mockStorage.configureMock({ errorRate: 1.0 });
      
      await expect(datasetService.deleteDataset(dataset.id))
        .rejects.toThrow();
    });
  });
});