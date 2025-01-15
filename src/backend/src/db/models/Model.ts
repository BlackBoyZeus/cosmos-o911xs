import { Schema, model } from 'mongoose'; // v6.0.0
import { IModel } from '../../interfaces/IModel';
import { ModelType } from '../../types/models';
import { 
  PERFORMANCE_THRESHOLDS, 
  MODEL_ARCHITECTURES, 
  DEFAULT_MODEL_VALIDATION 
} from '../../types/models';

// Collection name constant
const MODEL_COLLECTION = 'models';

// Schema definition for World Foundation Models
const ModelSchema = new Schema<IModel>({
  name: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  version: {
    type: String,
    required: true,
    trim: true
  },
  architecture: {
    type: {
      type: String,
      required: true,
      enum: Object.values(ModelType)
    },
    parameterCount: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: (count: number) => count <= 100, // Max 100B parameters
        message: 'Parameter count exceeds maximum limit'
      }
    },
    contextLength: {
      type: Number,
      required: true,
      min: 1
    },
    maxBatchSize: {
      type: Number,
      required: true,
      min: 1,
      max: DEFAULT_MODEL_VALIDATION.batchSizeRange[1]
    },
    supportedResolutions: [{
      width: {
        type: Number,
        required: true,
        min: 32,
        max: 7680 // 8K max resolution
      },
      height: {
        type: Number,
        required: true,
        min: 32,
        max: 7680
      }
    }]
  },
  capabilities: {
    maxFrames: {
      type: Number,
      required: true,
      min: 1,
      max: 1000
    },
    minFrames: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: function(min: number) {
          return min <= this.capabilities.maxFrames;
        },
        message: 'minFrames must be less than or equal to maxFrames'
      }
    },
    maxVideoDuration: {
      type: Number,
      required: true,
      min: 1,
      max: 3600 // Max 1 hour
    },
    supportedFormats: [{
      type: String,
      required: true,
      enum: ['mp4', 'webm', 'gif']
    }],
    supportsMultiView: Boolean,
    supportsCameraControl: Boolean,
    supportsActionControl: Boolean,
    supportsTrajectoryControl: Boolean
  },
  performance: {
    generationTime: {
      type: Number,
      required: true,
      min: 0,
      max: PERFORMANCE_THRESHOLDS.MAX_GENERATION_TIME
    },
    gpuMemoryUsage: {
      type: Number,
      required: true,
      min: 0,
      max: PERFORMANCE_THRESHOLDS.MAX_GPU_MEMORY
    },
    videoQualityMetrics: {
      psnr: {
        type: Number,
        required: true,
        min: PERFORMANCE_THRESHOLDS.MIN_PSNR
      },
      ssim: {
        type: Number,
        required: true,
        min: 0,
        max: 1
      },
      fid: Number,
      fvd: Number
    },
    throughput: {
      type: Number,
      required: true,
      min: PERFORMANCE_THRESHOLDS.MIN_THROUGHPUT
    },
    trainingProgress: {
      type: Number,
      min: 0,
      max: 1
    },
    trainingLoss: {
      type: Number,
      min: 0
    }
  },
  checkpointPath: {
    type: String,
    required: true
  }
}, {
  timestamps: true,
  collection: MODEL_COLLECTION
});

// Indexes for efficient querying
ModelSchema.index({ 'architecture.type': 1 });
ModelSchema.index({ 'performance.generationTime': 1 });
ModelSchema.index({ 'performance.gpuMemoryUsage': 1 });
ModelSchema.index({ 'performance.videoQualityMetrics.psnr': 1 });

// Static methods
ModelSchema.statics.findByType = async function(
  type: ModelType,
  performanceFilter?: {
    minPSNR?: number;
    maxGenerationTime?: number;
    maxGPUMemory?: number;
  }
): Promise<IModel[]> {
  const query = this.find({ 'architecture.type': type });

  if (performanceFilter) {
    if (performanceFilter.minPSNR) {
      query.where('performance.videoQualityMetrics.psnr').gte(performanceFilter.minPSNR);
    }
    if (performanceFilter.maxGenerationTime) {
      query.where('performance.generationTime').lte(performanceFilter.maxGenerationTime);
    }
    if (performanceFilter.maxGPUMemory) {
      query.where('performance.gpuMemoryUsage').lte(performanceFilter.maxGPUMemory);
    }
  }

  return query.sort({ 'performance.videoQualityMetrics.psnr': -1 }).exec();
};

ModelSchema.statics.updatePerformance = async function(
  modelId: string,
  performance: IModel['performance']
): Promise<IModel> {
  // Validate performance metrics
  if (performance.generationTime > PERFORMANCE_THRESHOLDS.MAX_GENERATION_TIME) {
    throw new Error('Generation time exceeds maximum threshold');
  }
  if (performance.gpuMemoryUsage > PERFORMANCE_THRESHOLDS.MAX_GPU_MEMORY) {
    throw new Error('GPU memory usage exceeds maximum threshold');
  }
  if (performance.videoQualityMetrics.psnr < PERFORMANCE_THRESHOLDS.MIN_PSNR) {
    throw new Error('PSNR score below minimum threshold');
  }

  return this.findByIdAndUpdate(
    modelId,
    { $set: { performance } },
    { new: true, runValidators: true }
  );
};

ModelSchema.statics.updateCapabilities = async function(
  modelId: string,
  capabilities: IModel['capabilities']
): Promise<IModel> {
  // Validate capabilities
  if (capabilities.maxFrames <= 0 || capabilities.maxFrames > 1000) {
    throw new Error('Invalid maxFrames value');
  }
  if (capabilities.minFrames <= 0 || capabilities.minFrames > capabilities.maxFrames) {
    throw new Error('Invalid minFrames value');
  }

  return this.findByIdAndUpdate(
    modelId,
    { $set: { capabilities } },
    { new: true, runValidators: true }
  );
};

// Helper function for model type validation
function validateModelType(
  type: ModelType,
  architecture: IModel['architecture']
): boolean {
  const validArchitecture = MODEL_ARCHITECTURES[type];
  if (!validArchitecture) return false;

  return (
    architecture.parameterCount === validArchitecture.parameters &&
    architecture.type === validArchitecture.type
  );
}

// Export the model with type safety
export const Model = model<IModel>('Model', ModelSchema);

// Export type-safe static methods
export type ModelType = typeof Model;