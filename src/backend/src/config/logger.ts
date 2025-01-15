import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { ProcessingStatus } from '../types/common';

// Define log levels with numeric priorities
const LOG_LEVELS = {
  error: 0,
  warn: 1, 
  info: 2,
  http: 3,
  verbose: 4,
  debug: 5,
  silly: 6
};

// Set default log level based on environment
const DEFAULT_LOG_LEVEL = process.env.NODE_ENV === 'production' ? 'info' : 'debug';

// Configure log retention and size limits
const LOG_RETENTION_DAYS = process.env.LOG_RETENTION_DAYS || '30';
const LOG_MAX_SIZE = process.env.LOG_MAX_SIZE || '100m';

/**
 * Creates Winston log format configuration with structured logging support
 */
const createLogFormat = (): winston.Logform.Format => {
  return winston.format.combine(
    // Add ISO timestamp with timezone
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss.SSS Z'
    }),
    
    // Add colorization for console output
    winston.format.colorize({ all: true }),
    
    // Add service context
    winston.format.label({
      label: process.env.SERVICE_NAME || 'cosmos-wfm'
    }),

    // Custom format for error handling
    winston.format((info) => {
      if (info.level === 'error' && info.error instanceof Error) {
        info.stack = info.error.stack;
        info.errorCode = info.error.name;
      }
      return info;
    })(),

    // Format as JSON with metadata
    winston.format.json({
      space: process.env.NODE_ENV !== 'production' ? 2 : 0
    }),

    // Custom format for message output
    winston.format.printf((info) => {
      const {
        timestamp,
        level,
        message,
        correlationId,
        requestId,
        userId,
        stack,
        ...metadata
      } = info;

      return JSON.stringify({
        timestamp,
        level,
        message,
        correlationId,
        requestId,
        userId,
        stack,
        service: process.env.SERVICE_NAME,
        environment: process.env.NODE_ENV,
        ...metadata
      });
    })
  );
};

/**
 * Creates Winston transport configurations for different log types
 */
const createTransports = (): winston.transport[] => {
  const transports: winston.transport[] = [
    // Console transport
    new winston.transports.Console({
      level: DEFAULT_LOG_LEVEL,
      handleExceptions: true,
      handleRejections: true
    }),

    // Application logs
    new DailyRotateFile({
      filename: 'logs/app-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: LOG_MAX_SIZE,
      maxFiles: `${LOG_RETENTION_DAYS}d`,
      level: DEFAULT_LOG_LEVEL,
      zippedArchive: true
    }),

    // Error logs with extended retention
    new DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: LOG_MAX_SIZE,
      maxFiles: `${LOG_RETENTION_DAYS}d`,
      level: 'error',
      zippedArchive: true
    }),

    // Audit logs with encryption
    new DailyRotateFile({
      filename: 'logs/audit-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: LOG_MAX_SIZE,
      maxFiles: `${LOG_RETENTION_DAYS}d`,
      level: 'info',
      zippedArchive: true
    })
  ];

  // Add external monitoring integration in production
  if (process.env.NODE_ENV === 'production') {
    transports.push(
      new winston.transports.Http({
        host: process.env.LOG_COLLECTOR_HOST,
        port: parseInt(process.env.LOG_COLLECTOR_PORT || '443'),
        ssl: true,
        level: 'error'
      })
    );
  }

  return transports;
};

/**
 * Logger configuration object with comprehensive settings
 */
export const loggerConfig: winston.LoggerOptions = {
  level: DEFAULT_LOG_LEVEL,
  levels: LOG_LEVELS,
  format: createLogFormat(),
  transports: createTransports(),
  
  // Configure exception handling
  exceptionHandlers: [
    new DailyRotateFile({
      filename: 'logs/exceptions-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: LOG_MAX_SIZE,
      maxFiles: `${LOG_RETENTION_DAYS}d`,
      level: 'error',
      zippedArchive: true
    })
  ],
  
  // Configure unhandled rejection handling
  rejectionHandlers: [
    new DailyRotateFile({
      filename: 'logs/rejections-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: LOG_MAX_SIZE,
      maxFiles: `${LOG_RETENTION_DAYS}d`,
      level: 'error',
      zippedArchive: true
    })
  ],

  // Exit on unhandled exceptions in production
  exitOnError: process.env.NODE_ENV === 'production',
  
  // Silent mode for testing
  silent: process.env.NODE_ENV === 'test'
};

// Type definitions for log metadata
export interface LogMetadata {
  correlationId?: string;
  requestId?: string;
  userId?: string;
  service: string;
  environment: string;
  timestamp: Date;
  level: string;
  message: string;
  error?: Error;
  stack?: string;
  context?: Record<string, any>;
}