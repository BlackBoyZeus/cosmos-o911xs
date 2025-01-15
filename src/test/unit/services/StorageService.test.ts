import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import { Buffer } from 'buffer';
import crypto from 'crypto';
import { StorageService } from '../../../backend/src/services/StorageService';
import { StorageConfig } from '../../../backend/src/types/config';
import { MockStorageService } from '../../utils/storageMock';

// Test configurations for different providers
const mockConfigs = {
  aws: {
    provider: 'aws' as const,
    region: 'us-west-2',
    bucketName: 'cosmos-test-bucket',
    credentials: {
      accessKeyId: 'mock-key',
      secretAccessKey: 'mock-secret'
    },
    encryption: {
      enabled: true,
      keyId: 'test-key-1',
      algorithm: 'AES-256'
    },
    lifecycle: {
      enabled: true,
      archivalDays: 30,
      deletionDays: 90,
      transitionRules: [
        { days: 30, storageClass: 'GLACIER' }
      ]
    }
  },
  gcp: {
    provider: 'gcp' as const,
    region: 'us-central1',
    bucketName: 'cosmos-test-bucket',
    credentials: {
      serviceAccountKey: 'mock-key.json'
    },
    encryption: {
      enabled: true,
      keyId: 'test-key-1',
      algorithm: 'AES-256'
    },
    lifecycle: {
      enabled: true,
      archivalDays: 30,
      deletionDays: 90,
      transitionRules: [
        { days: 30, storageClass: 'COLDLINE' }
      ]
    }
  },
  azure: {
    provider: 'azure' as const,
    region: 'eastus',
    bucketName: 'cosmos-test-container',
    credentials: {
      connectionString: 'mock-connection-string'
    },
    encryption: {
      enabled: true,
      keyId: 'test-key-1',
      algorithm: 'AES-256'
    },
    lifecycle: {
      enabled: true,
      archivalDays: 30,
      deletionDays: 90,
      transitionRules: [
        { days: 30, storageClass: 'ARCHIVE' }
      ]
    }
  }
};

// Test file configurations
const testFiles = {
  small: {
    path: 'test/small.mp4',
    size: 1024 * 1024 // 1MB
  },
  medium: {
    path: 'test/medium.mp4',
    size: 100 * 1024 * 1024 // 100MB
  },
  large: {
    path: 'test/large.mp4',
    size: 1024 * 1024 * 1024 // 1GB
  }
};

// Performance thresholds
const performanceThresholds = {
  uploadLatency: 500, // ms
  downloadLatency: 400, // ms
  listLatency: 200, // ms
  deleteLatency: 300 // ms
};

describe('StorageService', () => {
  let mockStorage: MockStorageService;
  let testFiles: Map<string, Buffer>;

  beforeEach(() => {
    // Initialize mock storage with default configuration
    mockStorage = new MockStorageService(mockConfigs.aws);
    testFiles = new Map();

    // Generate test files with random data
    Object.entries(testFiles).forEach(([key, config]) => {
      testFiles.set(
        config.path,
        crypto.randomBytes(config.size)
      );
    });
  });

  afterEach(() => {
    mockStorage.reset();
    testFiles.clear();
  });

  describe('Provider Configuration Tests', () => {
    it('should initialize AWS S3 provider correctly', async () => {
      const storage = new StorageService(mockConfigs.aws);
      expect(storage).toBeDefined();
      expect(mockStorage.getMockFunction('upload')).not.toHaveBeenCalled();
    });

    it('should initialize GCP Storage provider correctly', async () => {
      const storage = new StorageService(mockConfigs.gcp);
      expect(storage).toBeDefined();
      expect(mockStorage.getMockFunction('upload')).not.toHaveBeenCalled();
    });

    it('should initialize Azure Blob provider correctly', async () => {
      const storage = new StorageService(mockConfigs.azure);
      expect(storage).toBeDefined();
      expect(mockStorage.getMockFunction('upload')).not.toHaveBeenCalled();
    });

    it('should throw error for invalid provider configuration', () => {
      expect(() => new StorageService({
        ...mockConfigs.aws,
        provider: 'invalid' as any
      })).toThrow('Unsupported storage provider');
    });
  });

  describe('File Operation Tests', () => {
    it('should upload small file successfully', async () => {
      const file = testFiles.get(testFiles.small.path)!;
      const url = await mockStorage.uploadFile(file, testFiles.small.path, {
        contentType: 'video/mp4',
        metadata: { test: 'metadata' }
      });

      expect(url).toMatch(/^https:\/\//);
      expect(mockStorage.getMockFunction('upload')).toHaveBeenCalledWith(
        testFiles.small.path,
        file.length,
        expect.any(Object)
      );
    });

    it('should handle large file uploads with streaming', async () => {
      const file = testFiles.get(testFiles.large.path)!;
      const url = await mockStorage.uploadFile(file, testFiles.large.path, {
        contentType: 'video/mp4',
        metadata: { size: 'large' }
      });

      expect(url).toMatch(/^https:\/\//);
      expect(mockStorage.getMockFunction('upload')).toHaveBeenCalled();
    });

    it('should download file successfully', async () => {
      const file = testFiles.get(testFiles.small.path)!;
      await mockStorage.uploadFile(file, testFiles.small.path);
      
      const downloaded = await mockStorage.downloadFile(testFiles.small.path);
      expect(downloaded).toEqual(file);
      expect(mockStorage.getMockFunction('download')).toHaveBeenCalled();
    });

    it('should list files with prefix filtering', async () => {
      await Promise.all([
        mockStorage.uploadFile(testFiles.get(testFiles.small.path)!, testFiles.small.path),
        mockStorage.uploadFile(testFiles.get(testFiles.medium.path)!, testFiles.medium.path)
      ]);

      const files = await mockStorage.listFiles('test/');
      expect(files).toHaveLength(2);
      expect(files).toContain(testFiles.small.path);
      expect(files).toContain(testFiles.medium.path);
    });

    it('should delete file successfully', async () => {
      const file = testFiles.get(testFiles.small.path)!;
      await mockStorage.uploadFile(file, testFiles.small.path);
      
      await mockStorage.deleteFile(testFiles.small.path);
      expect(mockStorage.getMockFunction('delete')).toHaveBeenCalled();
      
      await expect(mockStorage.downloadFile(testFiles.small.path))
        .rejects.toThrow('File not found');
    });
  });

  describe('Security Tests', () => {
    it('should handle encrypted uploads correctly', async () => {
      const file = testFiles.get(testFiles.small.path)!;
      await mockStorage.uploadFile(file, testFiles.small.path, {
        encryption: true
      });

      const downloaded = await mockStorage.downloadFile(testFiles.small.path);
      expect(downloaded).toEqual(file);
    });

    it('should enforce access controls', async () => {
      mockStorage.configureMock({
        errorRate: 0.5
      });

      await expect(mockStorage.downloadFile('restricted.mp4'))
        .rejects.toThrow(/network_error|permission_denied/);
    });

    it('should validate file paths for security', async () => {
      const file = testFiles.get(testFiles.small.path)!;
      await expect(mockStorage.uploadFile(file, '../unsafe/path.mp4'))
        .rejects.toThrow();
    });
  });

  describe('Performance Tests', () => {
    it('should meet upload latency SLO', async () => {
      const file = testFiles.get(testFiles.medium.path)!;
      const start = Date.now();
      
      await mockStorage.uploadFile(file, testFiles.medium.path);
      
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(performanceThresholds.uploadLatency);
    });

    it('should handle concurrent operations efficiently', async () => {
      const files = Array.from(testFiles.values());
      const paths = Object.values(testFiles).map(f => f.path);
      
      const start = Date.now();
      
      await Promise.all(
        files.map((file, i) => mockStorage.uploadFile(file, paths[i]))
      );
      
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(performanceThresholds.uploadLatency * 2);
    });

    it('should maintain performance under load', async () => {
      const file = testFiles.get(testFiles.small.path)!;
      const operations = Array(10).fill(null).map((_, i) => 
        mockStorage.uploadFile(file, `load-test-${i}.mp4`)
      );
      
      const start = Date.now();
      await Promise.all(operations);
      const duration = Date.now() - start;
      
      expect(duration / operations.length).toBeLessThan(performanceThresholds.uploadLatency);
    });
  });

  describe('Error Handling Tests', () => {
    it('should handle network errors gracefully', async () => {
      mockStorage.configureMock({
        errorRate: 1.0
      });

      await expect(mockStorage.downloadFile('test.mp4'))
        .rejects.toThrow('Network error occurred');
    });

    it('should handle quota exceeded errors', async () => {
      mockStorage.configureMock({
        quotaLimit: 1024 // 1KB
      });

      const file = testFiles.get(testFiles.medium.path)!;
      await expect(mockStorage.uploadFile(file, testFiles.medium.path))
        .rejects.toThrow('Storage quota exceeded');
    });

    it('should retry failed operations', async () => {
      mockStorage.configureMock({
        errorRate: 0.5
      });

      const file = testFiles.get(testFiles.small.path)!;
      await expect(mockStorage.uploadFile(file, testFiles.small.path))
        .resolves.toMatch(/^https:\/\//);
    });

    it('should handle file not found errors', async () => {
      await expect(mockStorage.downloadFile('nonexistent.mp4'))
        .rejects.toThrow('File not found');
    });
  });
});