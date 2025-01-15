import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

/**
 * Initial database schema migration for the Cosmos WFM Platform
 * Implements comprehensive schema for videos, datasets, models and associated metadata
 * @version 1.0.0
 */
export class InitialSchemaMigration1234567890123 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create videos table
    await queryRunner.createTable(
      new Table({
        name: 'videos',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()'
          },
          {
            name: 'path',
            type: 'varchar',
            length: '1024',
            isNullable: false
          },
          {
            name: 'filename',
            type: 'varchar',
            length: '255',
            isNullable: false
          },
          {
            name: 'duration',
            type: 'float',
            isNullable: false
          },
          {
            name: 'width',
            type: 'integer',
            isNullable: false
          },
          {
            name: 'height',
            type: 'integer',
            isNullable: false
          },
          {
            name: 'fps',
            type: 'float',
            isNullable: false
          },
          {
            name: 'format',
            type: 'varchar',
            length: '32',
            isNullable: false
          },
          {
            name: 'codec',
            type: 'varchar',
            length: '32',
            isNullable: false
          },
          {
            name: 'size',
            type: 'bigint',
            isNullable: false
          },
          {
            name: 'checksum',
            type: 'varchar',
            length: '64',
            isNullable: false
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'],
            default: "'PENDING'"
          },
          {
            name: 'error_message',
            type: 'text',
            isNullable: true
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true
          },
          {
            name: 'quality_metrics',
            type: 'jsonb',
            isNullable: true
          },
          {
            name: 'annotations',
            type: 'text[]',
            isNullable: true
          },
          {
            name: 'segments',
            type: 'jsonb',
            isNullable: true
          },
          {
            name: 'version',
            type: 'integer',
            default: 1
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP'
          },
          {
            name: 'updated_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP'
          },
          {
            name: 'deleted_at',
            type: 'timestamp with time zone',
            isNullable: true
          }
        ]
      }),
      true
    );

    // Create datasets table
    await queryRunner.createTable(
      new Table({
        name: 'datasets',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()'
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
            isNullable: false
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true
          },
          {
            name: 'version',
            type: 'varchar',
            length: '32',
            isNullable: false
          },
          {
            name: 'size',
            type: 'bigint',
            isNullable: false
          },
          {
            name: 'video_count',
            type: 'integer',
            isNullable: false
          },
          {
            name: 'resolution',
            type: 'jsonb',
            isNullable: false
          },
          {
            name: 'metrics',
            type: 'jsonb',
            isNullable: true
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'],
            default: "'PENDING'"
          },
          {
            name: 'storage_location',
            type: 'varchar',
            length: '1024',
            isNullable: false
          },
          {
            name: 'retention_period',
            type: 'integer',
            default: 90 // 90 days default retention
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP'
          },
          {
            name: 'updated_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP'
          },
          {
            name: 'deleted_at',
            type: 'timestamp with time zone',
            isNullable: true
          }
        ]
      }),
      true
    );

    // Create models table
    await queryRunner.createTable(
      new Table({
        name: 'models',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()'
          },
          {
            name: 'type',
            type: 'enum',
            enum: ['DIFFUSION_7B', 'DIFFUSION_14B', 'AUTOREGRESSIVE_4B', 'AUTOREGRESSIVE_13B'],
            isNullable: false
          },
          {
            name: 'architecture',
            type: 'jsonb',
            isNullable: false
          },
          {
            name: 'capabilities',
            type: 'jsonb',
            isNullable: false
          },
          {
            name: 'performance',
            type: 'jsonb',
            isNullable: true
          },
          {
            name: 'checkpoint_path',
            type: 'varchar',
            length: '1024',
            isNullable: true
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP'
          },
          {
            name: 'updated_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP'
          }
        ]
      }),
      true
    );

    // Create dataset_videos junction table
    await queryRunner.createTable(
      new Table({
        name: 'dataset_videos',
        columns: [
          {
            name: 'dataset_id',
            type: 'uuid',
            isPrimary: true
          },
          {
            name: 'video_id',
            type: 'uuid',
            isPrimary: true
          },
          {
            name: 'added_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP'
          }
        ]
      }),
      true
    );

    // Create indexes
    await queryRunner.createIndex(
      'videos',
      new TableIndex({
        name: 'IDX_VIDEOS_STATUS',
        columnNames: ['status']
      })
    );

    await queryRunner.createIndex(
      'videos',
      new TableIndex({
        name: 'IDX_VIDEOS_CREATED_AT',
        columnNames: ['created_at']
      })
    );

    await queryRunner.createIndex(
      'datasets',
      new TableIndex({
        name: 'IDX_DATASETS_NAME_VERSION',
        columnNames: ['name', 'version'],
        isUnique: true
      })
    );

    // Add foreign key constraints
    await queryRunner.createForeignKey(
      'dataset_videos',
      new TableForeignKey({
        columnNames: ['dataset_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'datasets',
        onDelete: 'CASCADE'
      })
    );

    await queryRunner.createForeignKey(
      'dataset_videos',
      new TableForeignKey({
        columnNames: ['video_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'videos',
        onDelete: 'CASCADE'
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign keys
    await queryRunner.dropTable('dataset_videos');
    
    // Drop indexes
    await queryRunner.dropIndex('videos', 'IDX_VIDEOS_STATUS');
    await queryRunner.dropIndex('videos', 'IDX_VIDEOS_CREATED_AT');
    await queryRunner.dropIndex('datasets', 'IDX_DATASETS_NAME_VERSION');
    
    // Drop tables
    await queryRunner.dropTable('models');
    await queryRunner.dropTable('datasets');
    await queryRunner.dropTable('videos');
  }
}