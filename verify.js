import http from 'http';

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
  console.log('=== Starting Auth Service Verification Tests ===\n');
  console.log(`Target server: ${BASE_URL}\n`);

  const testEmail = `test_${Date.now()}@example.com`;
  const testPassword = 'securepassword123';
  let accessToken = '';
  let refreshTokenCookie = '';

  try {
    // 1. POST /auth/signup - Valid Data
    console.log('Test 1: POST /auth/signup with valid data...');
    const signupRes = await request('POST', '/auth/signup', {
      name: 'Test User',
      email: testEmail,
      password: testPassword,
    });

    if (signupRes.status === 201 && signupRes.body.accessToken && signupRes.body.user) {
      console.log('  [PASS] Status is 201.');
      console.log('  [PASS] User ID:', signupRes.body.user.id);
      console.log('  [PASS] Access token returned.');
      
      const setCookie = signupRes.headers['set-cookie'];
      if (setCookie && setCookie.some(c => c.includes('refreshToken'))) {
        console.log('  [PASS] Refresh token set in cookie.');
        refreshTokenCookie = setCookie.find(c => c.includes('refreshToken')).split(';')[0];
        console.log('         Cookie attributes:', setCookie[0]);
      } else {
        console.log('  [FAIL] Refresh token cookie missing.');
      }
      accessToken = signupRes.body.accessToken;
    } else {
      console.log('  [FAIL] Signup failed:', signupRes.status, signupRes.body);
    }
    console.log();

    // 2. POST /auth/signup - Already Registered
    console.log('Test 2: POST /auth/signup with duplicate email...');
    const dupRes = await request('POST', '/auth/signup', {
      name: 'Duplicate User',
      email: testEmail,
      password: testPassword,
    });
    if (dupRes.status === 409) {
      console.log('  [PASS] Correctly returned 409 Conflict.');
    } else {
      console.log('  [FAIL] Expected 409, got:', dupRes.status, dupRes.body);
    }
    console.log();

    // 3. POST /auth/signup - Password too short
    console.log('Test 3: POST /auth/signup with password < 6 characters...');
    const shortPassRes = await request('POST', '/auth/signup', {
      name: 'Weak User',
      email: `weak_${Date.now()}@example.com`,
      password: '1235',
    });
    if (shortPassRes.status === 400) {
      console.log('  [PASS] Correctly returned 400 Bad Request.');
    } else {
      console.log('  [FAIL] Expected 400, got:', shortPassRes.status, shortPassRes.body);
    }
    console.log();

    // 4. POST /auth/login - Correct credentials
    console.log('Test 4: POST /auth/login with correct credentials...');
    const loginRes = await request('POST', '/auth/login', {
      email: testEmail,
      password: testPassword,
    });
    if (loginRes.status === 200 && loginRes.body.accessToken) {
      console.log('  [PASS] Status is 200.');
      console.log('  [PASS] Access token returned.');
    } else {
      console.log('  [FAIL] Expected 200, got:', loginRes.status, loginRes.body);
    }
    console.log();

    // 5. POST /auth/login - Incorrect credentials
    console.log('Test 5: POST /auth/login with wrong password...');
    const wrongLoginRes = await request('POST', '/auth/login', {
      email: testEmail,
      password: 'wrongpassword',
    });
    if (wrongLoginRes.status === 401 && wrongLoginRes.body.error === 'Invalid email or password') {
      console.log('  [PASS] Correctly returned 401 and generic error message.');
    } else {
      console.log('  [FAIL] Expected 401 with generic error, got:', wrongLoginRes.status, wrongLoginRes.body);
    }
    console.log();

    // 6. GET /auth/me - Without Authorization Header
    console.log('Test 6: GET /auth/me without authorization header...');
    const noAuthRes = await request('GET', '/auth/me');
    if (noAuthRes.status === 401) {
      console.log('  [PASS] Correctly returned 401 Unauthorized.');
    } else {
      console.log('  [FAIL] Expected 401, got:', noAuthRes.status, noAuthRes.body);
    }
    console.log();

    // 7. GET /auth/me - With Valid Authorization Header (Check Password Exclusions)
    console.log('Test 7: GET /auth/me with valid Bearer token...');
    const authRes = await request('GET', '/auth/me', null, {
      'Authorization': `Bearer ${accessToken}`,
    });
    if (authRes.status === 200) {
      console.log('  [PASS] Status is 200.');
      const userObj = authRes.body.user;
      if (userObj && userObj.email === testEmail) {
        console.log('  [PASS] User email matches.');
      } else {
        console.log('  [FAIL] User email mismatch or missing:', userObj);
      }

      if (userObj && userObj.password === undefined) {
        console.log('  [PASS] Password field is excluded from JSON response.');
      } else {
        console.log('  [FAIL] Password field found in response:', userObj);
      }
    } else {
      console.log('  [FAIL] Expected 200, got:', authRes.status, authRes.body);
    }
    console.log();

    // 8. POST /auth/refresh - Without Refresh Cookie
    console.log('Test 8: POST /auth/refresh without refresh cookie...');
    const noCookieRes = await request('POST', '/auth/refresh');
    if (noCookieRes.status === 401) {
      console.log('  [PASS] Correctly returned 401 Unauthorized.');
    } else {
      console.log('  [FAIL] Expected 401, got:', noCookieRes.status, noCookieRes.body);
    }
    console.log();

    // 9. POST /auth/refresh - With Refresh Cookie
    console.log('Test 9: POST /auth/refresh with valid refresh cookie...');
    if (refreshTokenCookie) {
      const refreshRes = await request('POST', '/auth/refresh', null, {}, refreshTokenCookie);
      if (refreshRes.status === 200 && refreshRes.body.accessToken) {
        console.log('  [PASS] Status is 200.');
        console.log('  [PASS] New access token generated.');
      } else {
        console.log('  [FAIL] Expected 200, got:', refreshRes.status, refreshRes.body);
      }
    } else {
      console.log('  [SKIP] Skipping test 9: refreshTokenCookie is empty from Test 1.');
    }
    console.log();

    console.log('=== Verification Finished ===');
  } catch (error) {
    console.error('Error conducting verification tests:', error.message);
    console.log('Please ensure that the server is running on port ' + PORT + ' and is connected to MongoDB before running this script.');
  }
}

runTests();
