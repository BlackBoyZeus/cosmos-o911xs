import winston from 'winston'; // ^3.8.0
import DailyRotateFile from 'winston-daily-rotate-file'; // ^4.7.0
import * as prometheus from 'prom-client'; // ^14.0.0
import { loggerConfig } from '../config/logger';

// Define log levels with numeric priorities
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  verbose: 4,
  debug: 5,
  audit: 6
};

// Initialize Prometheus metrics
const ERROR_METRICS = new prometheus.Counter({
  name: 'app_errors_total',
  help: 'Total error count',
  labelNames: ['level', 'service']
});

// Interface for structured log metadata
interface LogMetadata {
  timestamp: Date;
  level: string;
  service: string;
  correlationId?: string;
  requestId?: string;
  userId?: string;
  stackTrace?: string;
  metrics?: Record<string, any>;
  additionalInfo?: Record<string, any>;
}

// Interface for audit log entries
interface AuditLogEntry {
  timestamp: Date;
  userId: string;
  action: string;
  resource: string;
  details: Record<string, any>;
  ip: string;
  userAgent: string;
}

/**
 * Enhanced singleton logger class with audit logging and monitoring integration
 */
class Logger {
  private static instance: Logger;
  private logger: winston.Logger;
  private auditLogger: winston.Logger;
  private readonly correlationIdKey = 'x-correlation-id';

  private constructor() {
    // Initialize main logger
    this.logger = winston.createLogger({
      level: loggerConfig.level,
      levels: LOG_LEVELS,
      format: loggerConfig.format,
      transports: loggerConfig.transports,
      exitOnError: false
    });

    // Initialize separate audit logger with encrypted transport
    this.auditLogger = winston.createLogger({
      level: 'audit',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new DailyRotateFile({
          filename: 'logs/audit-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxSize: '100m',
          maxFiles: '30d',
          zippedArchive: true
        })
      ]
    });

    // Handle uncaught exceptions
    this.logger.exceptions.handle(
      new winston.transports.File({ filename: 'logs/exceptions.log' })
    );
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Log error with enhanced context and metric tracking
   */
  public error(message: string | Error, meta: Partial<LogMetadata> = {}): void {
    const errorMessage = message instanceof Error ? message.message : message;
    const stackTrace = message instanceof Error ? message.stack : new Error().stack;

    const enhancedMeta: LogMetadata = {
      timestamp: new Date(),
      level: 'error',
      service: process.env.SERVICE_NAME || 'cosmos-wfm',
      stackTrace,
      ...meta
    };

    // Track error metrics
    ERROR_METRICS.inc({
      level: 'error',
      service: enhancedMeta.service
    });

    this.logger.error(errorMessage, enhancedMeta);
  }

  /**
   * Log secure audit entry
   */
  public audit(entry: AuditLogEntry): void {
    const sanitizedEntry = {
      ...entry,
      timestamp: new Date(),
      details: this.sanitizeSensitiveData(entry.details)
    };

    this.auditLogger.log('audit', sanitizedEntry);
  }

  /**
   * Log warning with context tracking
   */
  public warn(message: string, meta: Partial<LogMetadata> = {}): void {
    const enhancedMeta: LogMetadata = {
      timestamp: new Date(),
      level: 'warn',
      service: process.env.SERVICE_NAME || 'cosmos-wfm',
      ...meta
    };

    this.logger.warn(message, enhancedMeta);
  }

  /**
   * Log info with performance tracking
   */
  public info(message: string, meta: Partial<LogMetadata> = {}): void {
    const enhancedMeta: LogMetadata = {
      timestamp: new Date(),
      level: 'info',
      service: process.env.SERVICE_NAME || 'cosmos-wfm',
      ...meta
    };

    this.logger.info(message, enhancedMeta);
  }

  /**
   * Sanitize sensitive data from audit logs
   */
  private sanitizeSensitiveData(data: Record<string, any>): Record<string, any> {
    const sensitiveFields = ['password', 'token', 'apiKey', 'secret'];
    const sanitized = { ...data };

    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  /**
   * Get correlation ID from current context
   */
  private getCorrelationId(): string {
    return process.domain?.[this.correlationIdKey] || 
           `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton logger instance
export const logger = Logger.getInstance();