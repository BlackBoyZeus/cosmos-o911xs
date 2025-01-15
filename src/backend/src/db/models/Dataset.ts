import { Schema, model, Document } from 'mongoose'; // mongoose v7.0.0
import { encrypt } from 'mongoose-field-encryption'; // mongoose-field-encryption v4.0.0
import { IDataset } from '../../interfaces/IDataset';
import { VideoResolution, ProcessingStatus } from '../../types/common';

/**
 * Interface for audit log entries to track dataset changes
 */
interface AuditEntry {
  action: string;
  timestamp: Date;
  userId: string;
  details: string;
}

/**
 * Enhanced Mongoose schema for Dataset with comprehensive validation and security
 */
const DatasetSchema = new Schema<IDataset>({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    validate: {
      validator: (name: string) => /^[a-zA-Z0-9-_]+$/.test(name),
      message: 'Dataset name must be alphanumeric with optional hyphens/underscores'
    }
  },
  description: {
    type: String,
    required: true,
    maxlength: 1000,
    encrypt: true // Field-level encryption for sensitive descriptions
  },
  version: {
    type: String,
    required: true,
    validate: {
      validator: (version: string) => /^\d+\.\d+\.\d+$/.test(version),
      message: 'Version must follow semantic versioning (x.y.z)'
    }
  },
  size: {
    type: Number,
    required: true,
    min: 0,
    validate: {
      validator: (size: number) => size <= Number.MAX_SAFE_INTEGER,
      message: 'Size exceeds maximum allowed value'
    }
  },
  videoCount: {
    type: Number,
    required: true,
    min: 1,
    validate: {
      validator: (count: number) => Number.isInteger(count),
      message: 'Video count must be a positive integer'
    }
  },
  resolution: {
    width: {
      type: Number,
      required: true,
      min: 480,
      max: 3840
    },
    height: {
      type: Number,
      required: true,
      min: 360,
      max: 2160
    }
  },
  metrics: {
    psnr: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    ssim: {
      type: Number,
      required: true,
      min: 0,
      max: 1
    },
    fid: {
      type: Number,
      required: true,
      min: 0
    },
    fvd: {
      type: Number,
      required: true,
      min: 0
    }
  },
  status: {
    type: String,
    required: true,
    enum: Object.values(ProcessingStatus),
    default: ProcessingStatus.PENDING
  },
  storageLocation: {
    type: String,
    required: true,
    validate: {
      validator: (location: string) => /^(s3|gs|azure):\/\/[\w-]+\/.+/.test(location),
      message: 'Invalid storage location format'
    }
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  lastAccessedAt: {
    type: Date,
    default: Date.now
  },
  auditLog: [{
    action: String,
    timestamp: Date,
    userId: String,
    details: String
  }]
}, {
  timestamps: true,
  collection: 'datasets'
});

// Indexes for optimized queries
DatasetSchema.index({ name: 1 }, { unique: true });
DatasetSchema.index({ version: 1 });
DatasetSchema.index({ status: 1 });
DatasetSchema.index({ 'metrics.psnr': 1 });

// Configure field encryption
DatasetSchema.plugin(encrypt, {
  secret: process.env.ENCRYPTION_KEY,
  fields: ['description'],
  saltGenerator: (secret: string) => secret.slice(0, 16)
});

// Pre-save middleware for validation and audit logging
DatasetSchema.pre('save', async function(next) {
  // Update lastAccessedAt
  this.lastAccessedAt = new Date();

  // Log changes to audit trail
  if (this.isModified()) {
    this.auditLog.push({
      action: this.isNew ? 'CREATE' : 'UPDATE',
      timestamp: new Date(),
      userId: 'system', // Should be replaced with actual user ID
      details: `Modified fields: ${this.modifiedPaths().join(', ')}`
    });
  }

  next();
});

// Static methods for dataset operations
DatasetSchema.statics.findByName = async function(name: string): Promise<IDataset | null> {
  return this.findOne({ name }).exec();
};

DatasetSchema.statics.findByVersion = async function(version: string): Promise<IDataset | null> {
  return this.findOne({ version }).exec();
};

DatasetSchema.statics.updateMetrics = async function(
  id: string,
  metrics: { psnr: number; ssim: number; fid: number; fvd: number }
): Promise<IDataset | null> {
  return this.findByIdAndUpdate(
    id,
    { 
      $set: { metrics },
      $push: {
        auditLog: {
          action: 'UPDATE_METRICS',
          timestamp: new Date(),
          userId: 'system',
          details: `Updated quality metrics: PSNR=${metrics.psnr}, SSIM=${metrics.ssim}`
        }
      }
    },
    { new: true, runValidators: true }
  ).exec();
};

DatasetSchema.statics.updateStatus = async function(
  id: string,
  status: ProcessingStatus
): Promise<IDataset | null> {
  return this.findByIdAndUpdate(
    id,
    {
      $set: { status },
      $push: {
        auditLog: {
          action: 'UPDATE_STATUS',
          timestamp: new Date(),
          userId: 'system',
          details: `Status changed to ${status}`
        }
      }
    },
    { new: true, runValidators: true }
  ).exec();
};

DatasetSchema.statics.getAuditLog = async function(id: string): Promise<AuditEntry[]> {
  const dataset = await this.findById(id).select('auditLog').exec();
  return dataset?.auditLog || [];
};

// Export the Dataset model
export const Dataset = model<IDataset>('Dataset', DatasetSchema);