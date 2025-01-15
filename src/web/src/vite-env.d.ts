/// <reference types="vite/client" />

/**
 * Type definitions for Cosmos WFM Platform environment variables
 * Extends Vite's ImportMetaEnv interface to include platform-specific configuration
 * @version ^4.1.0
 */
interface ImportMetaEnv extends Vite.ImportMetaEnv {
  /** Base API endpoint URL for the Cosmos platform */
  readonly COSMOS_API_URL: string;

  /** Authentication service endpoint URL */
  readonly COSMOS_AUTH_URL: string;

  /** Storage service endpoint URL for video and model artifacts */
  readonly COSMOS_STORAGE_URL: string;

  /** Metrics and monitoring service endpoint URL */
  readonly COSMOS_METRICS_URL: string;

  /** Model management API endpoint URL */
  readonly COSMOS_MODEL_API_URL: string;

  /** Model inference API endpoint URL */
  readonly COSMOS_INFERENCE_API_URL: string;

  /** Model training API endpoint URL */
  readonly COSMOS_TRAINING_API_URL: string;

  /** WebSocket endpoint URL for real-time updates */
  readonly COSMOS_WEBSOCKET_URL: string;
}

/**
 * Augments the ImportMeta interface to include properly typed env property
 * Ensures type safety when accessing import.meta.env in the application
 */
interface ImportMeta {
  readonly env: ImportMetaEnv;
}