/**
 * Example usage of the @xhrdev/sdk package
 * This demonstrates how to import and use the SDK types and OpenAPI spec
 */

// Import the SDK types and functions
import type {
  DatadomeCaptchaRequest,
  DatadomeInterstitialRequest,
  DatadomeTagsRequest,
} from '../sdk/sdk.js';
import { openApiSpec } from '../sdk/sdk.js';

// Example 1: Using the OpenAPI spec as a string
console.log('OpenAPI Spec Version:', openApiSpec.split('\n')[0]);

// Example 2: Using the generated types
const captchaRequest: DatadomeCaptchaRequest = {
  cid: 'dd_challenge_123456789',
};

const interstitialRequest: DatadomeInterstitialRequest = {
  challenge_url: 'https://example.com/challenge?dd_challenge=123456789',
  cookies: {
    preferences: 'dark_mode',
    session_id: 'abc123',
  },
  referer: 'https://example.com/protected-page',
  user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
};

const tagsRequest: DatadomeTagsRequest = {
  challenge_id: 'dd_challenge_123456789',
  referer: 'https://example.com/protected-page',
  tags: ['dd_challenge', 'dd_bypass', 'dd_token'],
  user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
};

// Use the variables to avoid unused warnings
console.log('Captcha request:', captchaRequest);
console.log('Interstitial request:', interstitialRequest);
console.log('Tags request:', tagsRequest);

// Example 3: Using the raw OpenAPI types
// (Available in sdk namespace)

// Example 4: Accessing specific operation types
// (Types are available in ApiOperations)

// Use the types to avoid unused warnings
console.log('SDK types loaded successfully!');
