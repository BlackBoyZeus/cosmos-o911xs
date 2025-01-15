import { check, sleep } from 'k6'; // ^0.45.0
import http from 'k6/http'; // ^0.45.0
import { Trend, Rate, Counter, Gauge } from 'k6/metrics'; // ^0.45.0

// Internal imports
import { API_ENDPOINTS } from '../../../web/src/constants/apiEndpoints';
import { TestConfig } from '../../fixtures/configs/test_config.json';
import { setupTestEnvironment } from '../../utils/testHelpers';

// Custom metrics for detailed performance tracking
const metrics = {
  generation_duration: new Trend('generation_duration'),
  tokenization_duration: new Trend('tokenization_duration'),
  safety_check_duration: new Trend('safety_check_duration'),
  gpu_utilization: new Gauge('gpu_utilization'),
  queue_length: new Gauge('queue_length'),
  error_rate: new Rate('error_rate'),
  system_availability: new Rate('system_availability')
};

// Load test configuration
export const options = {
  vus: 100, // Virtual users
  duration: '5m',
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
    iteration_duration: ['p(95)<1000', 'p(99)<2000'],
    'generation_duration': ['p(95)<600000'], // 600s max for video generation
    'tokenization_duration': ['p(95)<100'], // 100ms max for tokenization
    'safety_check_duration': ['p(95)<200'], // 200ms max for safety checks
    'gpu_utilization': ['value<90'],
    'queue_length': ['value<1000'],
    'error_rate': ['rate<0.01'],
    'system_availability': ['rate>0.999']
  }
};

// Test environment setup
export function setup() {
  return setupTestEnvironment({
    gpuDevices: 4,
    gpuMemory: 80 * 1024 * 1024 * 1024, // 80GB per GPU
    enableProfiling: true
  });
}

// Main test execution
export default function() {
  testDatasetEndpoints();
  testGenerationEndpoints();
  testTokenizerEndpoints();
  testSafetyEndpoints();
  testMetricsEndpoints();
}

// Dataset API load tests
function testDatasetEndpoints() {
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${__ENV.API_TOKEN}`
    }
  };

  // List datasets
  const listResponse = http.get(`${API_ENDPOINTS.DATASETS.LIST}`, params);
  check(listResponse, {
    'dataset list status 200': (r) => r.status === 200,
    'dataset list response time': (r) => r.timings.duration < 500
  });
  metrics.system_availability.add(listResponse.status === 200);

  // Create dataset
  const createPayload = {
    name: `test-dataset-${Date.now()}`,
    resolution: { width: 1280, height: 720 },
    format: 'mp4'
  };
  const createResponse = http.post(
    `${API_ENDPOINTS.DATASETS.CREATE}`,
    JSON.stringify(createPayload),
    params
  );
  check(createResponse, {
    'dataset create status 201': (r) => r.status === 201,
    'dataset create response time': (r) => r.timings.duration < 1000
  });
  metrics.error_rate.add(createResponse.status !== 201);
}

// Generation API load tests
function testGenerationEndpoints() {
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${__ENV.API_TOKEN}`
    }
  };

  // Create generation job
  const generationPayload = {
    prompt: 'Test video generation',
    modelType: 'DIFFUSION_7B',
    resolution: { width: 1280, height: 720 },
    frameCount: 57,
    safetyConfig: {
      contentSafetyThreshold: 0.9,
      faceDetectionThreshold: 0.95
    }
  };

  const startTime = Date.now();
  const generateResponse = http.post(
    `${API_ENDPOINTS.GENERATION.CREATE_JOB}`,
    JSON.stringify(generationPayload),
    params
  );

  check(generateResponse, {
    'generation create status 202': (r) => r.status === 202,
    'generation response time': (r) => r.timings.duration < 1000
  });

  if (generateResponse.status === 202) {
    const jobId = JSON.parse(generateResponse.body).jobId;
    let completed = false;
    let attempts = 0;
    const maxAttempts = 60;

    // Poll job status
    while (!completed && attempts < maxAttempts) {
      const statusResponse = http.get(
        `${API_ENDPOINTS.GENERATION.JOB_STATUS.replace(':id', jobId)}`,
        params
      );
      const status = JSON.parse(statusResponse.body).status;
      
      if (status === 'COMPLETED' || status === 'FAILED') {
        completed = true;
        const duration = Date.now() - startTime;
        metrics.generation_duration.add(duration);
      } else {
        sleep(10);
        attempts++;
      }
    }
  }
}

// Tokenizer API load tests
function testTokenizerEndpoints() {
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${__ENV.API_TOKEN}`
    }
  };

  // Test tokenization
  const tokenizePayload = {
    videoPath: 'test-videos/sample_720p.mp4',
    tokenizer: 'CV8x8x8'
  };

  const startTime = Date.now();
  const tokenizeResponse = http.post(
    `${API_ENDPOINTS.TOKENIZER.ENCODE}`,
    JSON.stringify(tokenizePayload),
    params
  );

  check(tokenizeResponse, {
    'tokenize status 200': (r) => r.status === 200,
    'tokenize response time': (r) => r.timings.duration < 100
  });

  metrics.tokenization_duration.add(Date.now() - startTime);
}

// Safety API load tests
function testSafetyEndpoints() {
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${__ENV.API_TOKEN}`
    }
  };

  // Test pre-check
  const safetyPayload = {
    content: 'Test content for safety validation',
    checkTypes: ['CONTENT_SAFETY', 'FACE_DETECTION']
  };

  const startTime = Date.now();
  const safetyResponse = http.post(
    `${API_ENDPOINTS.SAFETY.PRE_CHECK}`,
    JSON.stringify(safetyPayload),
    params
  );

  check(safetyResponse, {
    'safety check status 200': (r) => r.status === 200,
    'safety check response time': (r) => r.timings.duration < 200
  });

  metrics.safety_check_duration.add(Date.now() - startTime);
}

// Metrics API load tests
function testMetricsEndpoints() {
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${__ENV.API_TOKEN}`
    }
  };

  // Get GPU metrics
  const metricsResponse = http.get(`${API_ENDPOINTS.MONITORING.GPU_METRICS}`, params);
  
  check(metricsResponse, {
    'metrics status 200': (r) => r.status === 200,
    'metrics response time': (r) => r.timings.duration < 500
  });

  if (metricsResponse.status === 200) {
    const gpuMetrics = JSON.parse(metricsResponse.body);
    metrics.gpu_utilization.add(gpuMetrics.utilization);
    metrics.queue_length.add(gpuMetrics.queueLength);
  }
}