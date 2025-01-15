// typeorm version: ^0.3.0
import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

/**
 * Migration to add extended metadata fields to models table for tracking
 * capabilities, performance metrics and training history
 */
export class AddModelMetadataMigration implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add capabilities JSONB column
    await queryRunner.addColumn('models', new TableColumn({
      name: 'capabilities',
      type: 'jsonb',
      isNullable: false,
      default: JSON.stringify({
        maxFrames: 0,
        minFrames: 0,
        maxVideoDuration: 0,
        supportedFormats: [],
        supportsMultiView: false,
        supportsCameraControl: false,
        supportsActionControl: false,
        supportsTrajectoryControl: false
      })
    }));

    // Add performance metrics JSONB column
    await queryRunner.addColumn('models', new TableColumn({
      name: 'performance_metrics',
      type: 'jsonb',
      isNullable: false,
      default: JSON.stringify({
        videoQualityMetrics: {
          psnr: 0,
          ssim: 0,
          fid: 0,
          fvd: 0
        },
        throughput: 0
      })
    }));

    // Add GPU memory usage column
    await queryRunner.addColumn('models', new TableColumn({
      name: 'gpu_memory_usage',
      type: 'decimal',
      precision: 6,
      scale: 2,
      isNullable: false,
      default: 0
    }));

    // Add generation time column
    await queryRunner.addColumn('models', new TableColumn({
      name: 'generation_time',
      type: 'integer',
      isNullable: false,
      default: 0,
      comment: 'Generation time in milliseconds'
    }));

    // Add training history JSONB column
    await queryRunner.addColumn('models', new TableColumn({
      name: 'training_history',
      type: 'jsonb',
      isNullable: true,
      comment: 'Epoch-wise training metrics and checkpoints'
    }));

    // Add version column
    await queryRunner.addColumn('models', new TableColumn({
      name: 'version',
      type: 'varchar',
      length: '50',
      isNullable: false,
      default: "'0.0.1'"
    }));

    // Create index on version
    await queryRunner.createIndex('models', new TableIndex({
      name: 'idx_models_version',
      columnNames: ['version']
    }));

    // Create index on GPU memory usage
    await queryRunner.createIndex('models', new TableIndex({
      name: 'idx_models_gpu_memory',
      columnNames: ['gpu_memory_usage']
    }));

    // Create index on generation time
    await queryRunner.createIndex('models', new TableIndex({
      name: 'idx_models_generation_time',
      columnNames: ['generation_time']
    }));

    // Create partial index on capabilities for feature queries
    await queryRunner.createIndex('models', new TableIndex({
      name: 'idx_models_capabilities',
      columnNames: ['capabilities'],
      where: "capabilities->>'supportsMultiView' = 'true'",
      using: 'gin'
    }));

    // Create index on performance metrics for quality filtering
    await queryRunner.createIndex('models', new TableIndex({
      name: 'idx_models_performance',
      columnNames: ['performance_metrics'],
      using: 'gin'
    }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes first
    await queryRunner.dropIndex('models', 'idx_models_performance');
    await queryRunner.dropIndex('models', 'idx_models_capabilities');
    await queryRunner.dropIndex('models', 'idx_models_generation_time');
    await queryRunner.dropIndex('models', 'idx_models_gpu_memory');
    await queryRunner.dropIndex('models', 'idx_models_version');

    // Drop columns
    await queryRunner.dropColumn('models', 'version');
    await queryRunner.dropColumn('models', 'training_history');
    await queryRunner.dropColumn('models', 'generation_time');
    await queryRunner.dropColumn('models', 'gpu_memory_usage');
    await queryRunner.dropColumn('models', 'performance_metrics');
    await queryRunner.dropColumn('models', 'capabilities');
  }
}