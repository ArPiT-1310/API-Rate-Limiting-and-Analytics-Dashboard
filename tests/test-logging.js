import http from 'http';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Project from '../src/models/Project.js';
import RequestLog from '../src/models/RequestLog.js';
import { DB_NAME } from '../src/constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const PORT = process.env.PORT || 5000;
const BASE_URL = `http://localhost:${PORT}`;

// Helper to make HTTP requests
function request(method, pathUrl, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = `${BASE_URL}${pathUrl}`;
    const defaultHeaders = {
      'Content-Type': 'application/json',
    };
    const mergedHeaders = { ...defaultHeaders, ...headers };
    const payload = body ? JSON.stringify(body) : '';

    const options = {
      method: method,
      headers: mergedHeaders,
    };

    const req = http.request(url, options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => {
        responseBody += chunk;
      });

      res.on('end', () => {
        let json = {};
        try {
          if (responseBody) {
            json = JSON.parse(responseBody);
          }
        } catch (e) {
          json = { raw: responseBody };
        }

        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: json,
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (body) {
      req.write(payload);
    }
    req.end();
  });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runTests() {
  console.log('=== Starting Request Logging Module Verification Tests ===\n');

  // Connect to DB directly to verify logs and indexes
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  let connectionString = uri;

  if (connectionString) {
    if (!connectionString.includes(DB_NAME)) {
      const qIndex = connectionString.indexOf('?');
      if (qIndex !== -1) {
        const beforeQ = connectionString.substring(0, qIndex);
        const afterQ = connectionString.substring(qIndex);
        const slash = beforeQ.endsWith('/') ? '' : '/';
        connectionString = `${beforeQ}${slash}${DB_NAME}${afterQ}`;
      } else {
        const slash = connectionString.endsWith('/') ? '' : '/';
        connectionString = `${connectionString}${slash}${DB_NAME}`;
      }
    }
  } else {
    connectionString = `mongodb://127.0.0.1:27017/${DB_NAME}`;
  }

  await mongoose.connect(connectionString);
  console.log(`Connected to MongoDB directly at ${connectionString} for verification.\n`);

  // User credentials
  const email = `logger_test_${Date.now()}@example.com`;
  const password = 'password123';
  let token = '';

  try {
    // 0. Signup and authenticate test user
    const signupRes = await request('POST', '/auth/signup', {
      name: 'Logger Tester',
      email,
      password,
    });
    if (signupRes.status === 201 && signupRes.body.accessToken) {
      token = signupRes.body.accessToken;
      console.log('  [SETUP] Signed up test user successfully.');
    } else {
      throw new Error(`Signup failed: ${JSON.stringify(signupRes.body)}`);
    }

    // ----------------------------------------------------
    // AC 1: Normal Successful Proxy Call & Exactly One Log
    // ----------------------------------------------------
    console.log('\n--- Test 1: Normal Successful Proxy Call & Exactly One Log ---');
    
    // Create Project A (within limit: 3 requests per 10s)
    const createProjectRes = await request('POST', '/projects', {
      name: 'Logging Project A',
      targetBaseUrl: 'https://jsonplaceholder.typicode.com',
      rateLimit: { windowMs: 10000, maxRequests: 3 }
    }, {
      'Authorization': `Bearer ${token}`
    });

    if (createProjectRes.status !== 201 || !createProjectRes.body.apiKey) {
      throw new Error(`Failed to create test project A: ${JSON.stringify(createProjectRes.body)}`);
    }

    const projectA = createProjectRes.body;
    console.log(`  [INFO] Created Project A with ID: ${projectA.id}`);

    // Clean any pre-existing logs just in case (should be empty for new project)
    await RequestLog.deleteMany({ projectId: projectA.id });

    // Make a normal successful proxy call
    const res1 = await request('GET', `/proxy/${projectA.apiKey}/posts/1`);
    console.log(`  [INFO] Proxy response code: ${res1.status}`);

    // Wait a brief moment to allow fire-and-forget database write to finish
    await sleep(200);

    const logs1 = await RequestLog.find({ projectId: projectA.id });
    if (logs1.length === 1) {
      const log = logs1[0];
      const validTime = typeof log.responseTimeMs === 'number' && log.responseTimeMs > 0;
      if (!log.wasRateLimited && log.statusCode === 200 && log.endpoint === '/posts/1' && log.method === 'GET' && validTime) {
        console.log(`  [PASS] Exactly one correct log written. wasRateLimited: false, statusCode: 200, endpoint: "/posts/1", responseTimeMs: ${log.responseTimeMs}ms`);
      } else {
        console.log('  [FAIL] Log contents incorrect:', log);
      }
    } else {
      console.log(`  [FAIL] Expected exactly 1 log, found ${logs1.length}`);
    }

    // ----------------------------------------------------
    // AC 2: Rate Limited Request Log
    // ----------------------------------------------------
    console.log('\n--- Test 2: Rate Limited Request Log ---');

    // Make 2 more requests to reach the limit (total 3 successes)
    await request('GET', `/proxy/${projectA.apiKey}/posts/1`);
    await request('GET', `/proxy/${projectA.apiKey}/posts/1`);

    // Make the 4th request which should be rate limited
    const resBlocked = await request('GET', `/proxy/${projectA.apiKey}/posts/1`);
    console.log(`  [INFO] Blocked request response code: ${resBlocked.status}`);

    // Wait for write to database
    await sleep(200);

    const logs2 = await RequestLog.find({ projectId: projectA.id }).sort({ timestamp: -1 });
    // Total should be 4 logs now
    if (logs2.length === 4) {
      const blockedLog = logs2[0]; // Sorted by timestamp desc, so latest is blocked request
      const validTime = typeof blockedLog.responseTimeMs === 'number' && blockedLog.responseTimeMs >= 0;
      if (blockedLog.wasRateLimited && blockedLog.statusCode === 429 && blockedLog.endpoint === '/posts/1' && validTime) {
        console.log(`  [PASS] Blocked request successfully logged. wasRateLimited: true, statusCode: 429, responseTimeMs: ${blockedLog.responseTimeMs}ms`);
      } else {
        console.log('  [FAIL] Blocked request log contents incorrect:', blockedLog);
      }
    } else {
      console.log(`  [FAIL] Expected exactly 4 logs in total, found ${logs2.length}`);
    }

    // ----------------------------------------------------
    // AC 3: Unreachable Upstream logs 502
    // ----------------------------------------------------
    console.log('\n--- Test 3: Unreachable Upstream logs 502 ---');

    // Create Project B (with unreachable targetBaseUrl)
    const createProjectBRes = await request('POST', '/projects', {
      name: 'Logging Project B',
      targetBaseUrl: 'https://unreachable-address-9999.invalid',
      rateLimit: { windowMs: 10000, maxRequests: 5 }
    }, {
      'Authorization': `Bearer ${token}`
    });

    if (createProjectBRes.status !== 201 || !createProjectBRes.body.apiKey) {
      throw new Error(`Failed to create test project B: ${JSON.stringify(createProjectBRes.body)}`);
    }

    const projectB = createProjectBRes.body;
    await RequestLog.deleteMany({ projectId: projectB.id });

    // Make proxy call to unreachable upstream
    const res502 = await request('GET', `/proxy/${projectB.apiKey}/some-path`);
    console.log(`  [INFO] Proxy response code for unreachable host: ${res502.status}`);

    await sleep(200);

    const logs3 = await RequestLog.find({ projectId: projectB.id });
    if (logs3.length === 1) {
      const log = logs3[0];
      const validTime = typeof log.responseTimeMs === 'number' && log.responseTimeMs > 0;
      if (!log.wasRateLimited && log.statusCode === 502 && log.endpoint === '/some-path' && validTime) {
        console.log(`  [PASS] Unreachable upstream successfully logged. wasRateLimited: false, statusCode: 502, responseTimeMs: ${log.responseTimeMs}ms`);
      } else {
        console.log('  [FAIL] 502 log contents incorrect:', log);
      }
    } else {
      console.log(`  [FAIL] Expected exactly 1 log, found ${logs3.length}`);
    }

    // ----------------------------------------------------
    // AC 5: Fire and Forget (Non-blocking Logging)
    // ----------------------------------------------------
    console.log('\n--- Test 5: Fire-and-forget Non-blocking latency check ---');
    console.log('  [INFO] Enabling artificial 500ms delay in logRequest via custom header...');

    // We will make a proxy call to Project C with the delay header
    const createProjectCRes = await request('POST', '/projects', {
      name: 'Logging Project C',
      targetBaseUrl: 'https://jsonplaceholder.typicode.com',
      rateLimit: { windowMs: 10000, maxRequests: 5 }
    }, {
      'Authorization': `Bearer ${token}`
    });

    const projectC = createProjectCRes.body;
    await RequestLog.deleteMany({ projectId: projectC.id });

    const startTime = Date.now();
    const resLatency = await request(
      'GET',
      `/proxy/${projectC.apiKey}/posts/1`,
      null,
      { 'x-test-delay-logging': 'true' }
    );
    const duration = Date.now() - startTime;

    console.log(`  [INFO] Proxy call returned in ${duration}ms with status ${resLatency.status}`);
    
    if (duration < 600) {
      console.log('  [PASS] Logging did not block the response! Client received response immediately.');
    } else {
      console.log(`  [FAIL] Proxy response was delayed! Taken: ${duration}ms`);
    }

    // ----------------------------------------------------
    // AC 6: Logging Failure Safety
    // ----------------------------------------------------
    console.log('\n--- Test 6: Logging Failure Safety ---');
    console.log('  [INFO] Triggering a proxy call that will fail to save log via custom header...');

    const resFailureSafety = await request(
      'GET',
      `/proxy/${projectC.apiKey}/posts/1`,
      null,
      { 'x-test-fail-logging': 'true' }
    );
    console.log(`  [INFO] Proxy call status during simulated logging failure: ${resFailureSafety.status}`);

    if (resFailureSafety.status === 200) {
      console.log('  [PASS] Proxy request succeeded and did not crash despite logging failure.');
    } else {
      console.log('  [FAIL] Proxy request failed or crashed.');
    }

    // ----------------------------------------------------
    // AC 7: 10 Sequential Proxy Calls Verification
    // ----------------------------------------------------
    console.log('\n--- Test 7: 10 Sequential Proxy Calls Verification ---');
    
    // Create Project D (rate limit: 5 requests per 10s)
    const createProjectDRes = await request('POST', '/projects', {
      name: 'Logging Project D',
      targetBaseUrl: 'https://jsonplaceholder.typicode.com',
      rateLimit: { windowMs: 20000, maxRequests: 5 }
    }, {
      'Authorization': `Bearer ${token}`
    });

    const projectD = createProjectDRes.body;
    await RequestLog.deleteMany({ projectId: projectD.id });

    console.log('  [INFO] Making 10 sequential proxy calls...');
    let successes = 0;
    let rateLimits = 0;

    for (let i = 0; i < 10; i++) {
      const res = await request('GET', `/proxy/${projectD.apiKey}/posts/1`);
      if (res.status === 200) successes++;
      if (res.status === 429) rateLimits++;
    }

    console.log(`  [INFO] HTTP results: ${successes} Success, ${rateLimits} Rate limited`);

    await sleep(500); // Wait for logs to finish saving

    const logsD = await RequestLog.find({ projectId: projectD.id });
    console.log(`  [INFO] Total request logs written to DB: ${logsD.length}`);
    if (logsD.length === 10) {
      console.log('  [PASS] Exactly 10 RequestLog documents exist in MongoDB. No duplicates or missing entries.');
    } else {
      console.log(`  [FAIL] Expected 10 logs, found ${logsD.length}`);
    }

    // ----------------------------------------------------
    // AC 8: Compound Index Validation
    // ----------------------------------------------------
    console.log('\n--- Test 8: Compound Index Validation ---');
    const indexes = await RequestLog.collection.indexes();
    console.log('  [INFO] Existing indexes:', JSON.stringify(indexes, null, 2));

    const compoundIndexExists = indexes.some(idx => {
      const keys = Object.keys(idx.key);
      return keys.length === 2 && idx.key.projectId === 1 && idx.key.timestamp === -1;
    });

    if (compoundIndexExists) {
      console.log('  [PASS] Compound index on { projectId: 1, timestamp: -1 } exists and is active.');
    } else {
      console.log('  [FAIL] Compound index on { projectId: 1, timestamp: -1 } was not found.');
    }

  } catch (error) {
    console.error('Test run failed with error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB.');
    console.log('=== Request Logging Tests Execution Done ===');
  }
}

runTests();
