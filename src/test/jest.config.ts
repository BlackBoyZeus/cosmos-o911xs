import type { Config } from '@jest/types';

/**
 * Jest configuration for Cosmos World Foundation Model Platform test suite
 * Version: @jest/types ^29.0.0
 * 
 * Configures comprehensive test environment including:
 * - Unit tests
 * - Integration tests
 * - Performance tests
 * - GPU-accelerated tests
 * - Coverage reporting
 */

const config: Config.InitialOptions = {
  // Use ts-jest preset for TypeScript support
  preset: 'ts-jest',

  // Set Node.js as test environment
  testEnvironment: 'node',

  // Define test root directories
  roots: ['<rootDir>'],

  // Module name mapping for path aliases
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/../src/$1',
    '^@test/(.*)$': '<rootDir>/$1',
    '^@fixtures/(.*)$': '<rootDir>/fixtures/$1',
    '^@utils/(.*)$': '<rootDir>/utils/$1',
    '^@perf/(.*)$': '<rootDir>/performance/$1'
  },

  // TypeScript and file transformations
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
    '^.+\\.jsx?$': 'babel-jest'
  },

  // Test pattern matching
  testRegex: [
    // Unit tests
    '(/tests/.*|(\\.|/)(test|spec))\\.[jt]sx?$',
    // Integration tests
    '/integration/.*\\.test\\.[jt]sx?$',
    // Performance tests
    '/performance/.*\\.perf\\.[jt]sx?$'
  ],

  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.[jt]s?(x)',
    '**/?(*.)+(spec|test|perf).[jt]s?(x)'
  ],

  // Coverage collection configuration
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/types/**',
    '!src/**/index.{js,ts}',
    '!src/test/**'
  ],

  // Coverage output directory
  coverageDirectory: '<rootDir>/coverage',

  // Coverage report formats
  coverageReporters: [
    'json',
    'lcov',
    'text',
    'clover',
    'cobertura'
  ],

  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    './src/models/': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    }
  },

  // Setup files to run before tests
  setupFilesAfterEnv: [
    '<rootDir>/setup/jest.setup.ts',
    '<rootDir>/setup/gpu.setup.ts'
  ],

  // Extended timeout for performance tests
  testTimeout: 600000, // 10 minutes

  // Configure test parallelization
  maxWorkers: '50%',

  // Global setup/teardown
  globalSetup: '<rootDir>/setup/global-setup.ts',
  globalTeardown: '<rootDir>/setup/global-teardown.ts',

  // Performance test specific settings
  globals: {
    'ts-jest': {
      isolatedModules: true,
      diagnostics: {
        warnOnly: true
      }
    },
    __PERFORMANCE_TEST__: true
  },

  // Module resolution
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],

  // Test environment configuration for GPU tests
  testEnvironmentOptions: {
    gpu: {
      enabled: true,
      requiredMemoryMB: 8192 // 8GB minimum GPU memory
    }
  },

  // Reporters for test results
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: 'reports/junit',
      outputName: 'jest-junit.xml',
      classNameTemplate: '{classname}',
      titleTemplate: '{title}'
    }],
    ['./performance-reporter.ts', {
      outputDirectory: 'reports/performance',
      includeMetrics: ['executionTime', 'memoryUsage', 'gpuUtilization']
    }]
  ]
};

export default config;