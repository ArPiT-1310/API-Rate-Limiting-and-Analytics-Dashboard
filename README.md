# Auth Service (Node.js, Express, MongoDB, JWT)

This is the Authentication Service part of the API Rate Limiter & Analytics Platform. It is built using Node.js, Express, MongoDB (Mongoose), and JSON Web Tokens (JWT) for secure authentication.

---

## Folder Structure

```text
/src
  /models
    User.js
  /routes
    auth.routes.js
  /controllers
    auth.controller.js
  /middleware
    verifyToken.js
  /utils
    generateTokens.js
  server.js
.env
.env.example
package.json
verify.js
```

---

## Getting Started

### 1. Installation

Install project dependencies:
```bash
npm install
```

### 2. Environment Setup

Create a `.env` file in the root directory (based on `.env.example`):

```env
MONGODB_URI=mongodb://127.0.0.1:27017/auth_service_db
JWT_ACCESS_SECRET=your_super_secret_access_key
JWT_REFRESH_SECRET=your_super_secret_refresh_key
PORT=5000
CLIENT_URL=http://localhost:5173
```

Make sure your MongoDB server is running on the specified `MONGODB_URI`.

### 3. Running the Server

Start in development mode (with hot reloading via `nodemon`):
```bash
npm run dev
```

Start in production mode:
```bash
npm start
```

---

## API Endpoints Reference & Examples

### 1. Register User (POST `/auth/signup`)

Registers a new user, hashes the password using `bcrypt` (salt rounds = 10), generates tokens, sets the `refreshToken` as an `httpOnly`, `secure`, `sameSite=strict` cookie, and returns the user object and `accessToken`.

*   **URL:** `/auth/signup`
*   **Method:** `POST`
*   **Request Body:**
    ```json
    {
      "name": "Jane Doe",
      "email": "jane@example.com",
      "password": "securepassword123"
    }
    ```
*   **Response (201 Created):**
    ```json
    {
      "user": {
        "id": "64bfec1dfc13ae32a6000101",
        "name": "Jane Doe",
        "email": "jane@example.com"
      },
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
    ```
*   **Response (400 Bad Request - Validation Failed):**
    ```json
    {
      "error": "Password must be at least 6 characters long"
    }
    ```
*   **Response (409 Conflict - Duplicate Email):**
    ```json
    {
      "error": "Email is already registered"
    }
    ```

---

### 2. Login User (POST `/auth/login`)

Verifies the user's email and password, signs new tokens, sets the `refreshToken` cookie, and returns the user object and `accessToken`.

*   **URL:** `/auth/login`
*   **Method:** `POST`
*   **Request Body:**
    ```json
    {
      "email": "jane@example.com",
      "password": "securepassword123"
    }
    ```
*   **Response (200 OK):**
    ```json
    {
      "user": {
        "id": "64bfec1dfc13ae32a6000101",
        "name": "Jane Doe",
        "email": "jane@example.com"
      },
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
    ```
*   **Response (401 Unauthorized - Generic message for security):**
    ```json
    {
      "error": "Invalid email or password"
    }
    ```

---

### 3. Refresh Access Token (POST `/auth/refresh`)

Reads the `refreshToken` from the HTTP cookie and issues a new access token (15m duration).

*   **URL:** `/auth/refresh`
*   **Method:** `POST`
*   **Headers:** (Requires cookie parser, automatically reads cookie: `refreshToken=<token>`)
*   **Response (200 OK):**
    ```json
    {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
    ```
*   **Response (401 Unauthorized - Missing or invalid/expired refresh token):**
    ```json
    {
      "error": "Invalid refresh token"
    }
    ```

---

### 4. Fetch Profile (GET `/auth/me`)

Retrieves the current authenticated user's profile information. This endpoint is protected by `verifyToken` middleware and uses the `req.userId` attached by the token check.

*   **URL:** `/auth/me`
*   **Method:** `GET`
*   **Headers:**
    `Authorization: Bearer <accessToken>`
*   **Response (200 OK):**
    ```json
    {
      "user": {
        "id": "64bfec1dfc13ae32a6000101",
        "name": "Jane Doe",
        "email": "jane@example.com"
      }
    }
    ```
*   **Response (401 Unauthorized - Missing or expired header token):**
    ```json
    {
      "error": "Invalid or expired token"
    }
    ```

---

## Verification Testing

You can run our automated HTTP verification script to test all 10 acceptance criteria specified in the instructions:

1.  Make sure your MongoDB server is active.
2.  Start the application server:
    ```bash
    npm run dev
    ```
3.  In another terminal, run:
    ```bash
    node verify.js
    ```

This script will run sequential requests verifying: signup, duplicate registration, validation, login success/failure, protected route authentication, refresh flow, cookie attributes, and ensuring the password field is never leaked in JSON responses.

---

## Part 3 — Reverse Proxy

The reverse proxy allows external consumers of a Project to route their API calls through the platform using just the Project's `apiKey`. No JWT is required — the apiKey embedded in the URL is the sole authentication mechanism.

### Endpoint

```
ALL /proxy/:apiKey/*
```

| Component | Description |
|---|---|
| `:apiKey` | The Project's auto-generated API key |
| `/*` | Wildcard — any path, forwarded verbatim to `targetBaseUrl` |

### How It Works

1. Validates the `apiKey` against the database (`Project.findOne({ apiKey })`).
2. Builds the target URL: `project.targetBaseUrl + forwardedPath + ?queryString`.
3. Strips sensitive headers before forwarding: `host`, `authorization`, `content-length`, `connection`.
4. Forwards the request via `axios` with a **10-second timeout**.
5. Relays the upstream response (status + body + content-type) back to the caller unchanged — including 4xx/5xx.
6. Returns **502** if the upstream is unreachable (DNS failure, timeout, etc.).

### Postman / curl Testing with JSONPlaceholder

**Step 1 — Create a proxy project** (requires Bearer token from login/signup):

```
POST http://localhost:5000/projects
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "name": "JSONPlaceholder Proxy",
  "targetBaseUrl": "https://jsonplaceholder.typicode.com"
}
```

Copy the `apiKey` from the response. Use `<KEY>` below.

---

**GET a single post (AC #2):**
```
GET http://localhost:5000/proxy/<KEY>/posts/1
```
Expected: **200**, same JSON as `https://jsonplaceholder.typicode.com/posts/1`

---

**GET all posts (AC #3):**
```
GET http://localhost:5000/proxy/<KEY>/posts
```
Expected: **200**, array of 100 posts

---

**POST with body (AC #4):**
```
POST http://localhost:5000/proxy/<KEY>/posts
Content-Type: application/json

{
  "title": "Hello Proxy",
  "body": "Test body",
  "userId": 1
}
```
Expected: **201**, jsonplaceholder echoes back the created object

---

**Invalid API key (AC #5):**
```
GET http://localhost:5000/proxy/invalid_key/posts/1
```
Expected: **404** `{ "error": "Invalid API key" }`

---

**Upstream 404 pass-through (AC #6):**
```
GET http://localhost:5000/proxy/<KEY>/posts/999999999
```
Expected: **404** from jsonplaceholder (not 502 — proves 4xx are passed through)

---

**Query string preservation (AC #9):**
```
GET http://localhost:5000/proxy/<KEY>/comments?postId=1
```
Expected: **200**, array of 5 comments all with `postId: 1`

---

**502 on unreachable upstream (AC #7):**
Update the project's `targetBaseUrl` to `https://this-domain-does-not-exist-99999.com` via `PATCH /projects/:id`, then call any proxy route. Expected: **502** `{ "error": "Upstream API unreachable" }`

