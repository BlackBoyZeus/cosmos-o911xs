// External imports
import { jest } from '@jest/globals'; // ^29.0.0

// Internal imports
import { StorageService } from '../../backend/src/services/StorageService';
import { StorageConfig } from '../../backend/src/types/config';

// Constants
const MOCK_STORAGE_URL_PREFIX = 'https://mock-storage.cosmos.ai/';
const DEFAULT_MOCK_CONFIG = {
  latencyMs: 50,
  errorRate: 0,
  quotaLimit: 1024 * 1024 * 1024, // 1GB
  providerBehavior: 'standard'
};

// Types
type StorageErrorType = 'quota_exceeded' | 'network_error' | 'permission_denied' | 'not_found';
type ProviderBehaviorType = 'standard' | 'aws' | 'gcp' | 'azure';

interface StorageOptions {
  encryption?: boolean;
  metadata?: Record<string, string>;
  contentType?: string;
  simulateLatency?: boolean;
  simulateError?: StorageErrorType;
  quotaLimit?: number;
}

interface MockConfig {
  latencyMs: number;
  errorRate: number;
  quotaLimit: number;
  providerBehavior: ProviderBehaviorType;
}

/**
 * Thread-safe mock implementation of StorageService for testing
 */
export class MockStorageService implements StorageService {
  private mockStorage: Map<string, Buffer>;
  private currentUsage: number;
  private readonly uploadFileMock: jest.Mock;
  private readonly downloadFileMock: jest.Mock;
  private readonly deleteFileMock: jest.Mock;
  private readonly listFilesMock: jest.Mock;

  constructor(
    private readonly config: StorageConfig,
    private mockConfig: MockConfig = DEFAULT_MOCK_CONFIG
  ) {
    this.mockStorage = new Map();
    this.currentUsage = 0;
    
    // Initialize mock functions
    this.uploadFileMock = jest.fn();
    this.downloadFileMock = jest.fn();
    this.deleteFileMock = jest.fn();
    this.listFilesMock = jest.fn();
  }

  /**
   * Mock implementation of file upload with error simulation
   */
  public async uploadFile(
    data: Buffer,
    path: string,
    options: StorageOptions = {}
  ): Promise<string> {
    await this.simulateLatency(options.simulateLatency);
    
    // Simulate errors if configured
    if (options.simulateError) {
      throw this.generateError(options.simulateError);
    }

    // Check quota limits
    const newSize = this.currentUsage + data.length;
    if (newSize > (options.quotaLimit || this.mockConfig.quotaLimit)) {
      throw this.generateError('quota_exceeded');
    }

    // Store file with thread-safe access
    this.mockStorage.set(path, Buffer.from(data));
    this.currentUsage = newSize;

    // Track mock call
    this.uploadFileMock(path, data.length, options);

    // Return provider-specific URL
    return this.generateMockUrl(path);
  }

  /**
   * Mock implementation of file download with network simulation
   */
  public async downloadFile(path: string): Promise<Buffer> {
    await this.simulateLatency();

    // Simulate random errors based on error rate
    if (Math.random() < this.mockConfig.errorRate) {
      throw this.generateError('network_error');
    }

    const data = this.mockStorage.get(path);
    if (!data) {
      throw this.generateError('not_found');
    }

    // Track mock call
    this.downloadFileMock(path);

    return Buffer.from(data);
  }

  /**
   * Mock implementation of file deletion with error cases
   */
  public async deleteFile(path: string): Promise<void> {
    await this.simulateLatency();

    if (!this.mockStorage.has(path)) {
      throw this.generateError('not_found');
    }

    // Update storage state
    const data = this.mockStorage.get(path)!;
    this.currentUsage -= data.length;
    this.mockStorage.delete(path);

    // Track mock call
    this.deleteFileMock(path);
  }

  /**
   * Mock implementation of file listing with filtering
   */
  public async listFiles(prefix: string = ''): Promise<string[]> {
    await this.simulateLatency();

    const files = Array.from(this.mockStorage.keys())
      .filter(path => path.startsWith(prefix));

    // Track mock call
    this.listFilesMock(prefix);

    return files;
  }

  /**
   * Reset mock state and configurations
   */
  public reset(): void {
    this.mockStorage.clear();
    this.currentUsage = 0;
    this.uploadFileMock.mockClear();
    this.downloadFileMock.mockClear();
    this.deleteFileMock.mockClear();
    this.listFilesMock.mockClear();
  }

  /**
   * Update mock behavior configuration
   */
  public configureMock(newConfig: Partial<MockConfig>): void {
    this.mockConfig = {
      ...this.mockConfig,
      ...newConfig
    };
  }

  /**
   * Get mock function for verification
   */
  public getMockFunction(name: 'upload' | 'download' | 'delete' | 'list'): jest.Mock {
    switch (name) {
      case 'upload': return this.uploadFileMock;
      case 'download': return this.downloadFileMock;
      case 'delete': return this.deleteFileMock;
      case 'list': return this.listFilesMock;
    }
  }

  // Private helper methods
  private async simulateLatency(override?: boolean): Promise<void> {
    if (override === false) return;
    await new Promise(resolve => setTimeout(resolve, this.mockConfig.latencyMs));
  }

  private generateError(type: StorageErrorType): Error {
    switch (type) {
      case 'quota_exceeded':
        return new Error('Storage quota exceeded');
      case 'network_error':
        return new Error('Network error occurred');
      case 'permission_denied':
        return new Error('Permission denied');
      case 'not_found':
        return new Error('File not found');
    }
  }

  private generateMockUrl(path: string): string {
    switch (this.mockConfig.providerBehavior) {
      case 'aws':
        return `https://${this.config.bucketName}.s3.${this.config.region}.amazonaws.com/${path}`;
      case 'gcp':
        return `https://storage.googleapis.com/${this.config.bucketName}/${path}`;
      case 'azure':
        return `https://${this.config.bucketName}.blob.core.windows.net/${path}`;
      default:
        return `${MOCK_STORAGE_URL_PREFIX}${path}`;
    }
  }
}