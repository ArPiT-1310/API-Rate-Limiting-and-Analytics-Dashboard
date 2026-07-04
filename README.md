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
