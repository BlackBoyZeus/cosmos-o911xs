import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';
import { GuardType, SafetyStatus } from '../../interfaces/ISafetyLog';
import { ProcessingStatus } from '../../types/common';
import { SafetyCheckType } from '../../types/safety';

export class AddSafetyLogsMigration implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create safety_logs table with comprehensive structure
    await queryRunner.createTable(
      new Table({
        name: 'safety_logs',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'generation_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'model_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'guard_type',
            type: 'enum',
            enum: Object.values(GuardType),
            isNullable: false,
          },
          {
            name: 'check_type',
            type: 'enum',
            enum: Object.values(SafetyCheckType),
            isNullable: false,
          },
          {
            name: 'status',
            type: 'enum',
            enum: Object.values(SafetyStatus),
            isNullable: false,
          },
          {
            name: 'details',
            type: 'jsonb',
            isNullable: false,
          },
          {
            name: 'processing_status',
            type: 'enum',
            enum: Object.values(ProcessingStatus),
            isNullable: false,
          },
          {
            name: 'timestamp',
            type: 'timestamptz',
            isNullable: false,
            default: 'NOW()',
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            isNullable: false,
            default: 'NOW()',
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            isNullable: false,
            default: 'NOW()',
          }
        ],
        foreignKeys: [
          {
            columnNames: ['generation_id'],
            referencedTableName: 'generations',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            columnNames: ['model_id'],
            referencedTableName: 'models',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          }
        ],
        checks: [
          {
            name: 'safety_logs_details_check',
            expression: "jsonb_typeof(details) = 'object'",
          }
        ],
      }),
      true
    );

    // Create optimized indexes for efficient querying
    await queryRunner.createIndex(
      'safety_logs',
      new TableIndex({
        name: 'idx_safety_logs_timestamp',
        columnNames: ['timestamp'],
        isUnique: false,
      })
    );

    await queryRunner.createIndex(
      'safety_logs',
      new TableIndex({
        name: 'idx_safety_logs_guard_check_type',
        columnNames: ['guard_type', 'check_type'],
        isUnique: false,
      })
    );

    await queryRunner.createIndex(
      'safety_logs',
      new TableIndex({
        name: 'idx_safety_logs_processing_status',
        columnNames: ['processing_status'],
        isUnique: false,
      })
    );

    await queryRunner.createIndex(
      'safety_logs',
      new TableIndex({
        name: 'idx_safety_logs_status',
        columnNames: ['status'],
        isUnique: false,
      })
    );

    await queryRunner.createIndex(
      'safety_logs',
      new TableIndex({
        name: 'idx_safety_logs_generation_id',
        columnNames: ['generation_id'],
        isUnique: false,
      })
    );

    // Create trigger for updated_at timestamp
    await queryRunner.query(`
      CREATE TRIGGER update_safety_logs_updated_at
      BEFORE UPDATE ON safety_logs
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.dropIndex('safety_logs', 'idx_safety_logs_timestamp');
    await queryRunner.dropIndex('safety_logs', 'idx_safety_logs_guard_check_type');
    await queryRunner.dropIndex('safety_logs', 'idx_safety_logs_processing_status');
    await queryRunner.dropIndex('safety_logs', 'idx_safety_logs_status');
    await queryRunner.dropIndex('safety_logs', 'idx_safety_logs_generation_id');

    // Drop trigger
    await queryRunner.query('DROP TRIGGER IF EXISTS update_safety_logs_updated_at ON safety_logs');

    // Drop table (this will automatically drop foreign keys and check constraints)
    await queryRunner.dropTable('safety_logs', true, true, true);

    // Drop enum types if they were created specifically for this table
    await queryRunner.query('DROP TYPE IF EXISTS safety_logs_guard_type_enum');
    await queryRunner.query('DROP TYPE IF EXISTS safety_logs_check_type_enum');
    await queryRunner.query('DROP TYPE IF EXISTS safety_logs_status_enum');
    await queryRunner.query('DROP TYPE IF EXISTS safety_logs_processing_status_enum');
  }
}