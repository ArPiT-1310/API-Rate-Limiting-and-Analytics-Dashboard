import http from 'http';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Project from './src/models/Project.js';

dotenv.config();

const PORT = process.env.PORT || 5000;
const BASE_URL = `http://localhost:${PORT}`;

// Helper function to make HTTP requests and parse response and headers
function request(method, path, body = null, headers = {}, cookie = null) {
  return new Promise((resolve, reject) => {
    const url = `${BASE_URL}${path}`;
    const defaultHeaders = {
      'Content-Type': 'application/json',
    };

    if (cookie) {
      defaultHeaders['Cookie'] = cookie;
    }

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

// Main verification suite
async function runTests() {
  console.log('=== Starting Auth & Projects Verification Tests ===\n');
  console.log(`Target server: ${BASE_URL}\n`);

  // User A credentials
  const emailA = `user_a_${Date.now()}@example.com`;
  const passwordA = 'password123';
  let tokenA = '';
  let cookieA = '';

  // User B credentials (for cross-user testing)
  const emailB = `user_b_${Date.now()}@example.com`;
  const passwordB = 'password123';
  let tokenB = '';

  try {
    // ----------------------------------------------------
    // AUTH SERVICE TESTS (PART 1 RE-VERIFICATION)
    // ----------------------------------------------------
    console.log('--- Phase 1: Authentication Tests ---');
    
    // 1. Signup User A
    const signupARes = await request('POST', '/auth/signup', {
      name: 'User A',
      email: emailA,
      password: passwordA,
    });
    if (signupARes.status === 201 && signupARes.body.accessToken) {
      console.log('  [PASS] Signup User A: Status 201 and token received.');
      tokenA = signupARes.body.accessToken;
      const setCookie = signupARes.headers['set-cookie'];
      if (setCookie && setCookie.some(c => c.includes('refreshToken'))) {
        cookieA = setCookie.find(c => c.includes('refreshToken')).split(';')[0];
      }
    } else {
      throw new Error(`Signup User A failed: ${JSON.stringify(signupARes.body)}`);
    }

    // 2. Signup with duplicate email
    const dupRes = await request('POST', '/auth/signup', {
      name: 'Duplicate A',
      email: emailA,
      password: passwordA,
    });
    if (dupRes.status === 409) {
      console.log('  [PASS] Signup Duplicate Check: Correctly returned 409.');
    } else {
      console.log('  [FAIL] Signup Duplicate Check: Expected 409, got', dupRes.status);
    }

    // 3. Signup with password too short
    const shortPassRes = await request('POST', '/auth/signup', {
      name: 'Short Pass',
      email: `short_${Date.now()}@example.com`,
      password: '123',
    });
    if (shortPassRes.status === 400) {
      console.log('  [PASS] Signup Password Validation: Correctly returned 400.');
    } else {
      console.log('  [FAIL] Signup Password Validation: Expected 400, got', shortPassRes.status);
    }

    // 4. Login User A
    const loginARes = await request('POST', '/auth/login', {
      email: emailA,
      password: passwordA,
    });
    if (loginARes.status === 200 && loginARes.body.accessToken) {
      console.log('  [PASS] Login User A: Status 200 and token received.');
    } else {
      console.log('  [FAIL] Login User A: Expected 200, got', loginARes.status);
    }

    // 5. Login wrong password
    const wrongLoginRes = await request('POST', '/auth/login', {
      email: emailA,
      password: 'wrongpassword',
    });
    if (wrongLoginRes.status === 401) {
      console.log('  [PASS] Login Security: Correctly returned 401 on wrong password.');
    } else {
      console.log('  [FAIL] Login Security: Expected 401, got', wrongLoginRes.status);
    }

    // 6. Get profile /me without token
    const noTokenRes = await request('GET', '/auth/me');
    if (noTokenRes.status === 401) {
      console.log('  [PASS] Profile Auth Gate: Correctly returned 401 without token.');
    } else {
      console.log('  [FAIL] Profile Auth Gate: Expected 401, got', noTokenRes.status);
    }

    // 7. Get profile /me with token
    const profileRes = await request('GET', '/auth/me', null, {
      'Authorization': `Bearer ${tokenA}`,
    });
    if (profileRes.status === 200) {
      const user = profileRes.body.user;
      if (user && user.password === undefined) {
        console.log('  [PASS] Profile Access & Leak Prevention: Status 200, password excluded.');
      } else {
        console.log('  [FAIL] Profile Access: User has password field or details missing.', user);
      }
    } else {
      console.log('  [FAIL] Profile Access: Expected 200, got', profileRes.status);
    }

    // 8. Refresh Token without Cookie
    const noCookieRes = await request('POST', '/auth/refresh');
    if (noCookieRes.status === 401) {
      console.log('  [PASS] Refresh Gate: Correctly returned 401 without cookie.');
    } else {
      console.log('  [FAIL] Refresh Gate: Expected 401, got', noCookieRes.status);
    }

    // 9. Refresh Token with Cookie
    if (cookieA) {
      const refreshRes = await request('POST', '/auth/refresh', null, {}, cookieA);
      if (refreshRes.status === 200 && refreshRes.body.accessToken) {
        console.log('  [PASS] Refresh Flow: Status 200 and new access token received.');
      } else {
        console.log('  [FAIL] Refresh Flow: Expected 200, got', refreshRes.status);
      }
    }

    // Register User B for ownership testing
    const signupBRes = await request('POST', '/auth/signup', {
      name: 'User B',
      email: emailB,
      password: passwordB,
    });
    if (signupBRes.status === 201 && signupBRes.body.accessToken) {
      tokenB = signupBRes.body.accessToken;
    } else {
      throw new Error(`Signup User B failed: ${JSON.stringify(signupBRes.body)}`);
    }

    console.log('\n--- Phase 2: Project Management CRUD Tests ---');

    // Project Test 1: Creating a project without an Authorization header returns 401
    const pNoAuth = await request('POST', '/projects', { name: 'Proj', targetBaseUrl: 'http://test.com' });
    if (pNoAuth.status === 401) {
      console.log('  [PASS] Project Auth Check: POST without header returns 401.');
    } else {
      console.log('  [FAIL] Project Auth Check: Expected 401, got', pNoAuth.status);
    }

    // Project Test 2: Creating a project with missing name or targetBaseUrl returns 400
    const pMissingField = await request('POST', '/projects', { targetBaseUrl: 'http://test.com' }, {
      'Authorization': `Bearer ${tokenA}`,
    });
    if (pMissingField.status === 400) {
      console.log('  [PASS] Project Validation Check: POST with missing name returns 400.');
    } else {
      console.log('  [FAIL] Project Validation Check: Expected 400, got', pMissingField.status);
    }

    // Project Test 3: Creating a project with an invalid targetBaseUrl returns 400
    const pInvalidUrl = await request('POST', '/projects', { name: 'My Proj', targetBaseUrl: 'not-a-url' }, {
      'Authorization': `Bearer ${tokenA}`,
    });
    if (pInvalidUrl.status === 400) {
      console.log('  [PASS] Project URL Check: POST with invalid URL pattern returns 400.');
    } else {
      console.log('  [FAIL] Project URL Check: Expected 400, got', pInvalidUrl.status);
    }

    // Project Test 4: Creating a project with valid auth and valid body returns 201 with generated apiKey
    let projA1 = null;
    const pValidA1 = await request('POST', '/projects', {
      name: 'Project A1',
      targetBaseUrl: 'https://service1.com',
      rateLimit: { windowMs: 30000, maxRequests: 50 },
    }, {
      'Authorization': `Bearer ${tokenA}`,
    });
    if (pValidA1.status === 201 && pValidA1.body.apiKey) {
      projA1 = pValidA1.body;
      console.log('  [PASS] Project Creation: Status 201, apiKey generated:', projA1.apiKey);
    } else {
      console.log('  [FAIL] Project Creation: Expected 201 with apiKey, got', pValidA1.status, pValidA1.body);
    }

    // Project Test 5: Creating a second project for User A
    let projA2 = null;
    const pValidA2 = await request('POST', '/projects', {
      name: 'Project A2',
      targetBaseUrl: 'https://service2.com',
    }, {
      'Authorization': `Bearer ${tokenA}`,
    });
    if (pValidA2.status === 201 && pValidA2.body.apiKey) {
      projA2 = pValidA2.body;
      console.log('  [PASS] Second Project Creation: Status 201.');
    } else {
      console.log('  [FAIL] Second Project Creation: Expected 201, got', pValidA2.status);
    }

    // Project Test 6: GET /projects returns exactly the projects owned by the user
    const getProjARes = await request('GET', '/projects', null, {
      'Authorization': `Bearer ${tokenA}`,
    });
    if (getProjARes.status === 200 && Array.isArray(getProjARes.body)) {
      const ownedIds = getProjARes.body.map(p => p.id);
      const isExactlyTwo = ownedIds.length === 2 && ownedIds.includes(projA1.id) && ownedIds.includes(projA2.id);
      if (isExactlyTwo) {
        console.log('  [PASS] Get Projects: Returned exactly User A\'s two projects.');
      } else {
        console.log('  [FAIL] Get Projects: Returned wrong project array:', ownedIds);
      }
    } else {
      console.log('  [FAIL] Get Projects: Expected 200 array, got', getProjARes.status);
    }

    // Project Test 7: Create project for User B
    let projB1 = null;
    const pValidB1 = await request('POST', '/projects', {
      name: 'Project B1',
      targetBaseUrl: 'https://b-service.com',
    }, {
      'Authorization': `Bearer ${tokenB}`,
    });
    if (pValidB1.status === 201) {
      projB1 = pValidB1.body;
    } else {
      throw new Error(`Project creation for User B failed: ${pValidB1.status}`);
    }

    // Project Test 8: As User A, trying GET /projects/:id on User B's project returns 403
    const getBByA = await request('GET', `/projects/${projB1.id}`, null, {
      'Authorization': `Bearer ${tokenA}`,
    });
    if (getBByA.status === 403) {
      console.log('  [PASS] Cross-user Access Gate: GET User B\'s project by User A returns 403.');
    } else {
      console.log('  [FAIL] Cross-user Access Gate: Expected 403, got', getBByA.status, getBByA.body);
    }

    // Project Test 9: As User A, GET /projects/:id on non-existent ID returns 404
    const nonExistentId = new mongoose.Types.ObjectId().toString();
    const getNonExistent = await request('GET', `/projects/${nonExistentId}`, null, {
      'Authorization': `Bearer ${tokenA}`,
    });
    if (getNonExistent.status === 404) {
      console.log('  [PASS] Project Presence Gate: GET non-existent project returns 404.');
    } else {
      console.log('  [FAIL] Project Presence Gate: Expected 404, got', getNonExistent.status);
    }

    // Project Test 10: PATCH /projects/:id with fields filters apiKey and userId modifications
    const oldApiKey = projA1.apiKey;
    const oldUserId = projA1.userId;
    const fakeUserId = new mongoose.Types.ObjectId().toString();

    const patchRes = await request('PATCH', `/projects/${projA1.id}`, {
      name: 'Updated Project A1',
      apiKey: 'modifiedapikey123',
      userId: fakeUserId,
      rateLimit: { windowMs: 10000, maxRequests: 200 },
    }, {
      'Authorization': `Bearer ${tokenA}`,
    });

    if (patchRes.status === 200) {
      const updated = patchRes.body;
      const filtered = updated.apiKey === oldApiKey && updated.userId === oldUserId && updated.name === 'Updated Project A1' && updated.rateLimit.windowMs === 10000;
      if (filtered) {
        console.log('  [PASS] Update Filter: Safely ignored apiKey and userId mutations, updated permitted fields.');
      } else {
        console.log('  [FAIL] Update Filter: API key or User ID mutated! API Key:', updated.apiKey, 'UserID:', updated.userId);
      }
    } else {
      console.log('  [FAIL] Update Project: Expected 200, got', patchRes.status, patchRes.body);
    }

    // Project Test 11: POST /projects/:id/regenerate-key returns a different apiKey
    const regenRes = await request('POST', `/projects/${projA1.id}/regenerate-key`, null, {
      'Authorization': `Bearer ${tokenA}`,
    });
    if (regenRes.status === 200) {
      const newApiKey = regenRes.body.apiKey;
      if (newApiKey !== oldApiKey) {
        console.log('  [PASS] Key Regeneration: Generated new key:', newApiKey);
      } else {
        console.log('  [FAIL] Key Regeneration: Key remained identical.');
      }
    } else {
      console.log('  [FAIL] Key Regeneration: Expected 200, got', regenRes.status);
    }

    // Project Test 12: DELETE /projects/:id removes it
    const deleteRes = await request('DELETE', `/projects/${projA1.id}`, null, {
      'Authorization': `Bearer ${tokenA}`,
    });
    if (deleteRes.status === 204) {
      console.log('  [PASS] Delete Project: Returns 204 Empty Body.');
    } else {
      console.log('  [FAIL] Delete Project: Expected 204, got', deleteRes.status);
    }

    // Project Test 13: Subsequent GET /projects/:id returns 404
    const getDeleted = await request('GET', `/projects/${projA1.id}`, null, {
      'Authorization': `Bearer ${tokenA}`,
    });
    if (getDeleted.status === 404) {
      console.log('  [PASS] Deleted Project Lookup: Returns 404 Not Found.');
    } else {
      console.log('  [FAIL] Deleted Project Lookup: Expected 404, got', getDeleted.status);
    }

    // Project Test 14: Unique index database constraints verification
    console.log('\n--- Phase 3: Database Unique Constraint verification ---');
    
    // Connect mongoose to database directly to test index constraint
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/api_rate_limiting_analytics';
    await mongoose.connect(uri);
    
    const duplicateKey = 'shared_secret_api_key_xyz_123';
    const randUser1 = new mongoose.Types.ObjectId();
    const randUser2 = new mongoose.Types.ObjectId();

    // Remove any leftover duplicate from database before insert
    await Project.deleteOne({ apiKey: duplicateKey });

    // Save first project
    const p1 = new Project({
      userId: randUser1,
      name: 'Dup Project 1',
      targetBaseUrl: 'http://test1.com',
      apiKey: duplicateKey,
    });
    await p1.save();

    // Attempt saving second project with the same apiKey
    const p2 = new Project({
      userId: randUser2,
      name: 'Dup Project 2',
      targetBaseUrl: 'http://test2.com',
      apiKey: duplicateKey,
    });

    try {
      await p2.save();
      console.log('  [FAIL] Unique API Key Index: Allowed two documents to share the same apiKey.');
    } catch (dbError) {
      // Expect index collision error (code 11000 or duplicate key error)
      if (dbError.code === 11000 || dbError.message.includes('duplicate key')) {
        console.log('  [PASS] Unique API Key Index: Blocked insert of duplicate API Key.');
      } else {
        console.log('  [FAIL] Unique API Key Index: Blocked with unexpected error:', dbError.message);
      }
    } finally {
      // Clean up test documents
      await Project.deleteOne({ apiKey: duplicateKey });
      await mongoose.disconnect();
    }

    console.log('\n--- Phase 4: Reverse Proxy Tests ---');

    // ── Setup: create a proxy test project pointing at jsonplaceholder ──────
    // We reuse tokenA from Phase 1 — the user is still authenticated.
    let proxyProject = null;
    const createProxyProj = await request('POST', '/projects', {
      name: 'Proxy Test Project',
      targetBaseUrl: 'https://jsonplaceholder.typicode.com',
    }, { 'Authorization': `Bearer ${tokenA}` });

    if (createProxyProj.status === 201 && createProxyProj.body.apiKey) {
      proxyProject = createProxyProj.body;
      console.log(`  [INFO] Proxy project created. apiKey: ${proxyProject.apiKey}`);
    } else {
      throw new Error(`Failed to create proxy project: ${JSON.stringify(createProxyProj.body)}`);
    }

    const KEY = proxyProject.apiKey;

    // ── Test P1: GET a single post — valid proxy, expect 200 ─────────────────
    const pp1 = await request('GET', `/proxy/${KEY}/posts/1`);
    if (pp1.status === 200 && pp1.body.id === 1) {
      console.log('  [PASS] Proxy GET /posts/1: Status 200, body matches upstream.');
    } else {
      console.log('  [FAIL] Proxy GET /posts/1: Got', pp1.status, JSON.stringify(pp1.body).slice(0, 80));
    }

    // ── Test P2: GET /posts — returns an array of 100 posts ──────────────────
    const pp2 = await request('GET', `/proxy/${KEY}/posts`);
    if (pp2.status === 200 && Array.isArray(pp2.body) && pp2.body.length > 0) {
      console.log(`  [PASS] Proxy GET /posts: Status 200, array of ${pp2.body.length} posts.`);
    } else {
      console.log('  [FAIL] Proxy GET /posts: Got', pp2.status, JSON.stringify(pp2.body).slice(0, 80));
    }

    // ── Test P3: POST with JSON body — jsonplaceholder echoes back 201 ───────
    const pp3 = await request('POST', `/proxy/${KEY}/posts`, {
      title: 'Proxy Test',
      body: 'Hello from the proxy',
      userId: 1,
    });
    if (pp3.status === 201 && pp3.body.title === 'Proxy Test') {
      console.log('  [PASS] Proxy POST /posts: Status 201, body echoed correctly.');
    } else {
      console.log('  [FAIL] Proxy POST /posts: Got', pp3.status, JSON.stringify(pp3.body).slice(0, 80));
    }

    // ── Test P4: Invalid apiKey → 404 ────────────────────────────────────────
    const pp4 = await request('GET', '/proxy/invalid_key_does_not_exist/posts/1');
    if (pp4.status === 404 && pp4.body.error === 'Invalid API key') {
      console.log('  [PASS] Invalid API Key: Returned 404 { error: "Invalid API key" }.');
    } else {
      console.log('  [FAIL] Invalid API Key: Got', pp4.status, pp4.body);
    }

    // ── Test P5: Upstream returns 404 — must pass through, not become 502 ────
    const pp5 = await request('GET', `/proxy/${KEY}/posts/999999999`);
    if (pp5.status === 404) {
      console.log('  [PASS] Upstream 404 Pass-Through: Returned 404 (not 502).');
    } else {
      console.log('  [FAIL] Upstream 404 Pass-Through: Got', pp5.status, pp5.body);
    }

    // ── Test P6: Unreachable upstream → 502 ──────────────────────────────────
    // Temporarily update the project to point at a non-existent domain,
    // then restore it afterwards.
    await request('PATCH', `/projects/${proxyProject.id}`, {
      targetBaseUrl: 'https://this-domain-does-not-exist-99999.com',
    }, { 'Authorization': `Bearer ${tokenA}` });

    const pp6 = await request('GET', `/proxy/${KEY}/anything`);
    if (pp6.status === 502 && pp6.body.error === 'Upstream API unreachable') {
      console.log('  [PASS] Unreachable Upstream: Returned 502 { error: "Upstream API unreachable" }.');
    } else {
      console.log('  [FAIL] Unreachable Upstream: Got', pp6.status, pp6.body);
    }

    // Restore targetBaseUrl to jsonplaceholder for remaining tests
    await request('PATCH', `/projects/${proxyProject.id}`, {
      targetBaseUrl: 'https://jsonplaceholder.typicode.com',
    }, { 'Authorization': `Bearer ${tokenA}` });

    // ── Test P7: Double-slash prevention ─────────────────────────────────────
    // Create a project with a trailing slash on targetBaseUrl
    const trailingSlashProj = await request('POST', '/projects', {
      name: 'Trailing Slash Project',
      targetBaseUrl: 'https://jsonplaceholder.typicode.com/',  // trailing slash
    }, { 'Authorization': `Bearer ${tokenA}` });

    if (trailingSlashProj.status === 201) {
      const tsKey = trailingSlashProj.body.apiKey;
      const pp7 = await request('GET', `/proxy/${tsKey}/posts/1`);
      if (pp7.status === 200 && pp7.body.id === 1) {
        console.log('  [PASS] Double-Slash Prevention: Trailing slash base URL proxied correctly, status 200.');
      } else {
        console.log('  [FAIL] Double-Slash Prevention: Got', pp7.status, JSON.stringify(pp7.body).slice(0, 80));
      }
    } else {
      console.log('  [SKIP] Double-Slash Prevention: Could not create trailing-slash project.');
    }

    // ── Test P8: Query string preservation ───────────────────────────────────
    // GET /proxy/<key>/comments?postId=1 should forward ?postId=1 upstream
    // and return only the 5 comments for postId=1 (not all 500 comments).
    const pp8 = await request('GET', `/proxy/${KEY}/comments?postId=1`);
    if (pp8.status === 200 && Array.isArray(pp8.body) && pp8.body.every(c => c.postId === 1)) {
      console.log(`  [PASS] Query String Preservation: Returned ${pp8.body.length} comments all with postId=1.`);
    } else {
      console.log('  [FAIL] Query String Preservation: Got', pp8.status,
        Array.isArray(pp8.body) ? `array of ${pp8.body.length}` : pp8.body);
    }

    console.log('\n=== All Verification Tests Completed ===');
  } catch (error) {
    console.error('\nError conducting verification tests:', error);
  }
}

runTests();

