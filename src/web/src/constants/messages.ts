// Internal imports
import { Status } from '../types/common';
import { ApiError } from '../types/api';

/**
 * Default messages for common scenarios
 */
export const DEFAULT_ERROR_MESSAGE = 'An unexpected error occurred. Please try again or contact support if the issue persists.';
export const DEFAULT_SUCCESS_MESSAGE = 'Operation completed successfully.';
export const DEFAULT_LOADING_MESSAGE = 'Please wait while we process your request...';
export const DEFAULT_TIMEOUT_MESSAGE = 'The operation timed out. Please try again with a smaller request or contact support.';

/**
 * Status messages mapping for process states
 */
export const STATUS_MESSAGES: Record<Status, string> = {
  [Status.PENDING]: 'Request is pending processing...',
  [Status.PROCESSING]: 'Processing your request...',
  [Status.COMPLETED]: 'Processing completed successfully',
  [Status.FAILED]: 'Processing failed. Please try again',
  [Status.CANCELLED]: 'Operation was cancelled by user'
};

/**
 * Error messages for different scenarios
 */
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Unable to connect to the server. Please check your internet connection.',
  UNAUTHORIZED: 'Your session has expired. Please log in again.',
  FORBIDDEN: 'You do not have permission to perform this action.',
  NOT_FOUND: 'The requested resource was not found.',
  SERVER_ERROR: 'An internal server error occurred. Our team has been notified.',
  MODEL_LOAD_ERROR: 'Failed to load the selected model. Please try a different model or contact support.',
  GENERATION_ERROR: 'Video generation failed. Please check your parameters and try again.',
  RESOURCE_EXCEEDED: 'System resources exceeded. Please try again with reduced parameters.',
  RATE_LIMIT: 'Rate limit exceeded. Please wait before making more requests.',
  INVALID_PARAMETERS: 'Invalid parameters provided. Please check your input.',
  TIMEOUT: 'Request timed out. Please try again with a smaller workload.'
} as const;

/**
 * Success messages for completed operations
 */
export const SUCCESS_MESSAGES = {
  GENERATION_STARTED: 'Video generation has started. You will be notified when it completes.',
  GENERATION_COMPLETED: 'Video generation completed successfully.',
  MODEL_LOADED: 'Model loaded successfully and ready for generation.',
  DATASET_UPLOADED: 'Dataset uploaded successfully.',
  SETTINGS_SAVED: 'Settings have been saved successfully.',
  EXPORT_COMPLETED: 'Export completed. Your file is ready for download.',
  BATCH_SUBMITTED: 'Batch processing request submitted successfully.',
  CONFIG_UPDATED: 'Configuration updated successfully.'
} as const;

/**
 * Validation messages for form inputs
 */
export const VALIDATION_MESSAGES = {
  REQUIRED_FIELD: 'This field is required.',
  INVALID_FORMAT: 'Invalid format. Please check the input requirements.',
  FILE_SIZE_EXCEEDED: 'File size exceeds the maximum limit.',
  INVALID_RESOLUTION: 'Invalid resolution. Please use supported dimensions.',
  INVALID_FRAME_COUNT: 'Frame count must be between 1 and 1000.',
  INVALID_MODEL_CONFIG: 'Invalid model configuration. Please check parameters.',
  INVALID_PROMPT: 'Please enter a valid generation prompt.',
  UNSUPPORTED_FORMAT: 'Unsupported file format.',
  INVALID_RANGE: 'Value is outside the acceptable range.',
  INVALID_DIMENSIONS: 'Invalid dimensions. Please use supported values.'
} as const;

/**
 * Helper function to get API error message
 */
export const getApiErrorMessage = (error: ApiError): string => {
  switch (error.code) {
    case '401':
      return ERROR_MESSAGES.UNAUTHORIZED;
    case '403':
      return ERROR_MESSAGES.FORBIDDEN;
    case '404':
      return ERROR_MESSAGES.NOT_FOUND;
    case '429':
      return ERROR_MESSAGES.RATE_LIMIT;
    case '500':
      return ERROR_MESSAGES.SERVER_ERROR;
    default:
      return error.message || DEFAULT_ERROR_MESSAGE;
  }
};

/**
 * Progress messages for long-running operations
 */
export const PROGRESS_MESSAGES = {
  INITIALIZING: 'Initializing...',
  LOADING_MODEL: 'Loading model...',
  PROCESSING_INPUT: 'Processing input...',
  GENERATING_FRAMES: 'Generating frames...',
  FINALIZING: 'Finalizing output...',
  SAVING_RESULTS: 'Saving results...',
  CLEANING_UP: 'Cleaning up temporary files...'
} as const;

/**
 * Confirmation messages for user actions
 */
export const CONFIRMATION_MESSAGES = {
  DELETE_CONFIRM: 'Are you sure you want to delete this item?',
  CANCEL_CONFIRM: 'Are you sure you want to cancel this operation?',
  DISCARD_CHANGES: 'You have unsaved changes. Are you sure you want to discard them?',
  RESET_SETTINGS: 'Are you sure you want to reset all settings to default?'
} as const;