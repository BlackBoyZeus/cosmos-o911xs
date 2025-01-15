import { IDataset } from '../../backend/src/interfaces/IDataset';
import { IModel } from '../../backend/src/interfaces/IModel';
import { IGenerationRequest } from '../../backend/src/interfaces/IGeneration';
import { ProcessingStatus } from '../../backend/src/types/common';

/**
 * Mutex implementation for thread-safe operations
 */
class Mutex {
  private locked: boolean = false;
  private queue: Array<() => void> = [];

  async acquire(): Promise<void> {
    const unlock = () => {
      if (this.queue.length > 0) {
        const next = this.queue.shift();
        next?.();
      } else {
        this.locked = false;
      }
    };

    if (this.locked) {
      return new Promise(resolve => {
        this.queue.push(() => {
          this.locked = true;
          resolve();
        });
      });
    }

    this.locked = true;
    return Promise.resolve();
  }

  release(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      next?.();
    } else {
      this.locked = false;
    }
  }
}

/**
 * Thread-safe mock implementation of Dataset model for testing
 */
export class MockDataset {
  private data: Map<string, IDataset>;
  private mutex: Mutex;

  constructor() {
    this.data = new Map<string, IDataset>();
    this.mutex = new Mutex();
  }

  /**
   * Thread-safe mock findByName implementation with validation
   */
  async findByName(name: string): Promise<IDataset | null> {
    try {
      await this.mutex.acquire();

      if (!name || typeof name !== 'string') {
        throw new Error('Invalid name parameter');
      }

      for (const dataset of this.data.values()) {
        if (dataset.name === name) {
          return dataset;
        }
      }

      return null;
    } catch (error) {
      console.error(`Error in findByName: ${error}`);
      throw error;
    } finally {
      this.mutex.release();
    }
  }

  /**
   * Thread-safe mock status update implementation with validation
   */
  async updateStatus(id: string, status: ProcessingStatus): Promise<IDataset> {
    try {
      await this.mutex.acquire();

      if (!id || typeof id !== 'string') {
        throw new Error('Invalid id parameter');
      }

      const dataset = this.data.get(id);
      if (!dataset) {
        throw new Error(`Dataset with id ${id} not found`);
      }

      const updatedDataset = {
        ...dataset,
        status,
        updatedAt: new Date()
      };

      this.data.set(id, updatedDataset);
      return updatedDataset;
    } catch (error) {
      console.error(`Error in updateStatus: ${error}`);
      throw error;
    } finally {
      this.mutex.release();
    }
  }

  /**
   * Thread-safe mock create implementation
   */
  async create(dataset: IDataset): Promise<IDataset> {
    try {
      await this.mutex.acquire();

      if (!dataset.validate()) {
        throw new Error('Invalid dataset object');
      }

      this.data.set(dataset.id, {
        ...dataset,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      return dataset;
    } catch (error) {
      console.error(`Error in create: ${error}`);
      throw error;
    } finally {
      this.mutex.release();
    }
  }

  /**
   * Thread-safe mock delete implementation
   */
  async delete(id: string): Promise<void> {
    try {
      await this.mutex.acquire();

      if (!this.data.has(id)) {
        throw new Error(`Dataset with id ${id} not found`);
      }

      this.data.delete(id);
    } catch (error) {
      console.error(`Error in delete: ${error}`);
      throw error;
    } finally {
      this.mutex.release();
    }
  }
}

/**
 * Thread-safe mock implementation of Model model for testing
 */
export class MockModel {
  private data: Map<string, IModel>;
  private mutex: Mutex;

  constructor() {
    this.data = new Map<string, IModel>();
    this.mutex = new Mutex();
  }

  async findByArchitecture(architecture: string): Promise<IModel | null> {
    try {
      await this.mutex.acquire();

      for (const model of this.data.values()) {
        if (model.architecture.type === architecture) {
          return model;
        }
      }

      return null;
    } finally {
      this.mutex.release();
    }
  }
}

/**
 * Thread-safe mock implementation of Generation model for testing
 */
export class MockGeneration {
  private data: Map<string, IGenerationRequest>;
  private mutex: Mutex;

  constructor() {
    this.data = new Map<string, IGenerationRequest>();
    this.mutex = new Mutex();
  }

  async findById(id: string): Promise<IGenerationRequest | null> {
    try {
      await this.mutex.acquire();
      return this.data.get(id) || null;
    } finally {
      this.mutex.release();
    }
  }
}

/**
 * Clear all mock data stores with thread safety
 */
export async function clearMocks(): Promise<void> {
  const mockDataset = new MockDataset();
  const mockModel = new MockModel();
  const mockGeneration = new MockGeneration();

  try {
    await Promise.all([
      mockDataset['mutex'].acquire(),
      mockModel['mutex'].acquire(),
      mockGeneration['mutex'].acquire()
    ]);

    mockDataset['data'].clear();
    mockModel['data'].clear();
    mockGeneration['data'].clear();

    console.log('All mock stores cleared successfully');
  } catch (error) {
    console.error(`Error clearing mock stores: ${error}`);
    throw error;
  } finally {
    mockDataset['mutex'].release();
    mockModel['mutex'].release();
    mockGeneration['mutex'].release();
  }
}