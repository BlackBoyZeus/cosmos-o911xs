// mongoose version: ^6.0.0
import { Schema, model, Document } from 'mongoose';
import { IGenerationRequest, IGenerationResponse } from '../../interfaces/IGeneration';
import { UUID } from 'crypto';

/**
 * Interface extending Document for MongoDB type safety
 */
interface GenerationDocument extends Document {
  id: UUID;
  modelType: string;
  prompt: string;
  resolution: {
    width: number;
    height: number;
  };
  frameCount: number;
  safetyConfig: {
    contentSafetyThreshold: number;
    faceDetectionThreshold: number;
    harmfulContentThreshold: number;
    biasCheckThreshold: number;
    privacyThreshold: number;
    complianceThreshold: number;
  };
  multiViewConfig: {
    enabled: boolean;
    viewCount: number;
    viewAngles: number[];
    viewDistances: number[];
    synchronizeViews: boolean;
  };
  status: string;
  outputPath: string;
  generationTime: number;
  error?: {
    code: string;
    message: string;
    details: Record<string, any>;
    timestamp: Date;
    recoverable: boolean;
  };
  safetyResults: Array<{
    checkType: string;
    passed: boolean;
    score: number;
    details: Record<string, any>;
    remediationApplied: boolean;
    remediationDetails?: Record<string, any>;
  }>;
  performanceMetrics: {
    generationTimeMs: number;
    framesPerSecond: number;
    gpuMemoryUsed: number;
    gpuUtilization: number;
    modelLoadTime: number;
    tokenizationTime: number;
    inferenceTime: number;
    postProcessingTime: number;
  };
  auditTrail: Array<{
    action: string;
    timestamp: Date;
    details: Record<string, any>;
  }>;
  schemaVersion: number;
  createdAt: Date;
  updatedAt: Date;
  toGenerationResponse(): IGenerationResponse;
  validateSafetyCompliance(): boolean;
}

/**
 * MongoDB schema definition for video generation
 */
const GenerationSchema = new Schema<GenerationDocument>({
  id: { type: String, required: true, unique: true },
  modelType: { type: String, required: true, index: true },
  prompt: { type: String, required: true },
  resolution: {
    width: { type: Number, required: true },
    height: { type: Number, required: true }
  },
  frameCount: { type: Number, required: true },
  safetyConfig: {
    contentSafetyThreshold: { type: Number, required: true, min: 0, max: 1 },
    faceDetectionThreshold: { type: Number, required: true, min: 0, max: 1 },
    harmfulContentThreshold: { type: Number, required: true, min: 0, max: 1 },
    biasCheckThreshold: { type: Number, required: true, min: 0, max: 1 },
    privacyThreshold: { type: Number, required: true, min: 0, max: 1 },
    complianceThreshold: { type: Number, required: true, min: 0, max: 1 }
  },
  multiViewConfig: {
    enabled: { type: Boolean, required: true, default: false },
    viewCount: { type: Number, required: true, min: 1, max: 8 },
    viewAngles: [{ type: Number }],
    viewDistances: [{ type: Number }],
    synchronizeViews: { type: Boolean, required: true, default: true }
  },
  status: { 
    type: String, 
    required: true, 
    index: true,
    enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED']
  },
  outputPath: { type: String },
  generationTime: { type: Number },
  error: {
    code: String,
    message: String,
    details: Schema.Types.Mixed,
    timestamp: Date,
    recoverable: Boolean
  },
  safetyResults: [{
    checkType: { type: String, required: true },
    passed: { type: Boolean, required: true },
    score: { type: Number, required: true },
    details: Schema.Types.Mixed,
    remediationApplied: { type: Boolean, required: true },
    remediationDetails: Schema.Types.Mixed
  }],
  performanceMetrics: {
    generationTimeMs: Number,
    framesPerSecond: Number,
    gpuMemoryUsed: Number,
    gpuUtilization: Number,
    modelLoadTime: Number,
    tokenizationTime: Number,
    inferenceTime: Number,
    postProcessingTime: Number
  },
  auditTrail: [{
    action: { type: String, required: true },
    timestamp: { type: Date, required: true },
    details: Schema.Types.Mixed
  }],
  schemaVersion: { type: Number, required: true, default: 1 }
}, {
  timestamps: true,
  versionKey: false,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance optimization
GenerationSchema.index({ createdAt: 1 });
GenerationSchema.index({ status: 1, createdAt: 1 });
GenerationSchema.index({ 'safetyResults.passed': 1 });
GenerationSchema.index({ 'performanceMetrics.generationTimeMs': 1 });

/**
 * Converts schema to IGenerationResponse format
 */
GenerationSchema.methods.toGenerationResponse = function(): IGenerationResponse {
  return {
    requestId: this.id,
    status: this.status,
    outputPath: this.outputPath,
    generationTime: this.generationTime,
    error: this.error,
    safetyResults: this.safetyResults,
    performanceMetrics: this.performanceMetrics,
    outputMetadata: {
      multiView: this.multiViewConfig,
      resolution: this.resolution,
      frameCount: this.frameCount
    },
    debugInfo: {
      schemaVersion: this.schemaVersion,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    },
    warnings: this.safetyResults
      .filter(result => !result.passed && result.remediationApplied)
      .map(result => `Safety check '${result.checkType}' required remediation`)
  };
};

/**
 * Validates safety compliance against requirements
 */
GenerationSchema.methods.validateSafetyCompliance = function(): boolean {
  // Check face blur compliance
  const faceDetectionResults = this.safetyResults
    .filter(result => result.checkType === 'FACE_DETECTION');
  const faceBlurCompliance = faceDetectionResults.every(result => 
    result.passed || result.remediationApplied
  );

  // Check harmful content prevention
  const harmfulContentResults = this.safetyResults
    .filter(result => result.checkType === 'HARMFUL_CONTENT');
  const harmfulContentCompliance = harmfulContentResults.every(result => 
    result.passed
  );

  // Validate all guard results
  const allGuardsCompliance = this.safetyResults.every(result =>
    result.passed || result.remediationApplied
  );

  return faceBlurCompliance && harmfulContentCompliance && allGuardsCompliance;
};

// Create and export the model
export const Generation = model<GenerationDocument>('Generation', GenerationSchema);