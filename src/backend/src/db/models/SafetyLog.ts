// mongoose version: ^6.0.0
import { Schema, model } from 'mongoose';
import { UUID } from 'crypto';
import { ISafetyLog, GuardType, SafetyStatus, SafetyCheckDetails } from '../../interfaces/ISafetyLog';
import { ProcessingStatus } from '../../types/common';
import { SafetyCheckType } from '../../types/safety';

// Schema definition for safety check details
const safetyCheckDetailsSchema = new Schema<SafetyCheckDetails>({
  score: {
    type: Number,
    required: true,
    min: 0,
    max: 1,
    validate: {
      validator: (value: number) => value >= 0 && value <= 1,
      message: 'Score must be between 0 and 1'
    }
  },
  threshold: {
    type: Number,
    required: true,
    min: 0,
    max: 1,
    validate: {
      validator: (value: number) => value >= 0 && value <= 1,
      message: 'Threshold must be between 0 and 1'
    }
  },
  metadata: {
    type: Map,
    of: Schema.Types.Mixed,
    default: {}
  }
});

// Enhanced schema for safety logs with comprehensive validation
const safetyLogSchema = new Schema<ISafetyLog>({
  id: {
    type: 'UUID',
    required: true,
    unique: true,
    index: true
  },
  generationId: {
    type: 'UUID',
    required: true,
    index: true
  },
  modelId: {
    type: 'UUID',
    required: true,
    index: true
  },
  guardType: {
    type: String,
    enum: Object.values(GuardType),
    required: true,
    index: true
  },
  checkType: {
    type: String,
    enum: Object.values(SafetyCheckType),
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: Object.values(SafetyStatus),
    required: true,
    index: true,
    validate: {
      validator: async function(this: any, status: SafetyStatus) {
        if (this.isNew) return true;
        const currentDoc = await this.constructor.findById(this._id);
        return validateStatusTransition(currentDoc?.status, status);
      },
      message: 'Invalid status transition'
    }
  },
  details: {
    type: safetyCheckDetailsSchema,
    required: true
  },
  processingStatus: {
    type: String,
    enum: Object.values(ProcessingStatus),
    required: true,
    default: ProcessingStatus.PENDING,
    index: true
  },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now,
    expires: 2592000 // 30 days TTL
  }
}, {
  timestamps: true, // Enable automatic timestamps
  strict: true // Enforce strict schema
});

// Create compound indexes for efficient querying
safetyLogSchema.index({ generationId: 1, checkType: 1 });
safetyLogSchema.index({ modelId: 1, timestamp: -1 });
safetyLogSchema.index({ guardType: 1, status: 1 });

// Validate status transitions
function validateStatusTransition(currentStatus: SafetyStatus, newStatus: SafetyStatus): boolean {
  if (!currentStatus) return true;
  
  const allowedTransitions = {
    [SafetyStatus.PASS]: [SafetyStatus.WARNING, SafetyStatus.FAIL],
    [SafetyStatus.WARNING]: [SafetyStatus.PASS, SafetyStatus.FAIL],
    [SafetyStatus.FAIL]: [SafetyStatus.WARNING]
  };
  
  return allowedTransitions[currentStatus]?.includes(newStatus) || false;
}

// Pre-save middleware for additional validation
safetyLogSchema.pre('save', async function(next) {
  if (this.isNew) {
    // Validate UUID fields
    if (!isValidUUID(this.id) || !isValidUUID(this.generationId) || !isValidUUID(this.modelId)) {
      next(new Error('Invalid UUID format'));
    }
  }
  next();
});

// Helper function to validate UUID
function isValidUUID(uuid: UUID): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid.toString());
}

// Static methods for safety log operations
safetyLogSchema.statics.findByGenerationId = async function(generationId: UUID) {
  return this.find({ generationId }).sort({ timestamp: -1 });
};

safetyLogSchema.statics.aggregateSafetyMetrics = async function(startDate: Date, endDate: Date) {
  return this.aggregate([
    {
      $match: {
        timestamp: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: '$checkType',
        totalChecks: { $sum: 1 },
        passedChecks: {
          $sum: { $cond: [{ $eq: ['$status', SafetyStatus.PASS] }, 1, 0] }
        },
        failedChecks: {
          $sum: { $cond: [{ $eq: ['$status', SafetyStatus.FAIL] }, 1, 0] }
        },
        warningChecks: {
          $sum: { $cond: [{ $eq: ['$status', SafetyStatus.WARNING] }, 1, 0] }
        },
        averageScore: { $avg: '$details.score' }
      }
    }
  ]);
};

// Create and export the model
const SafetyLog = model<ISafetyLog>('SafetyLog', safetyLogSchema);
export default SafetyLog;