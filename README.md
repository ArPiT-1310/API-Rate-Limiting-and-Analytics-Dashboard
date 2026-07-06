# 🚀 API Rate Limiting & Analytics Dashboard

A full-stack platform that lets you manage APIs behind a secure **reverse proxy** with built-in **rate limiting**, **request logging**, and an **interactive analytics dashboard**.

---

## ✨ Features

- 🔐 **JWT Authentication** — Secure signup / login with HTTP-only cookies
- 📁 **Project Management** — Create projects, each with its own API key and a configurable upstream URL
- 🔁 **Reverse Proxy** — All requests go through `/proxy/:apiKey/*` and are forwarded to your target API
- 🚦 **Redis Rate Limiting** — Fixed-window rate limiting enforced per API key (fails open if Redis is down)
- 📝 **Request Logging** — Every proxied request is saved to MongoDB with status code, latency, and path
- 📊 **Analytics Dashboard** — Visualise requests over time, status code breakdown, and recent logs — with time-range filtering
- 🛡️ **Ownership Gating** — Users can only access their own projects

---

## 🛠️ Tech Stack

| Layer | Tech |
|-------|------|
| **Backend** | Node.js, Express |
| **Database** | MongoDB (Mongoose) |
| **Cache / Rate Limit** | Redis (ioredis) |
| **Auth** | JWT + bcrypt |
| **Frontend** | React (Vite), React Router |
| **Charts** | Recharts |
| **HTTP Client** | Axios |

---

## 📁 Project Structure

```
├── src/                    # Backend source
│   ├── controllers/        # Route handlers (auth, projects, proxy, analytics)
│   ├── middleware/         # JWT auth, ownership verification, rate limiter
│   ├── models/             # Mongoose schemas (User, Project, RequestLog)
│   ├── routes/             # Express routers
│   ├── services/           # Redis client, proxy logic
│   └── server.js           # App entry point
│
├── frontend/               # React frontend (Vite)
│   └── src/
│       ├── pages/          # Login, Signup, Projects, Dashboard, Settings
│       ├── components/     # Charts, stat cards, logs table
│       ├── api/            # Axios instance + API calls
│       └── context/        # AuthContext (global auth state)
│
└── tests/                  # Automated test suites
```

---

## ⚙️ Getting Started

### Prerequisites

Make sure you have the following installed:
- [Node.js](https://nodejs.org/) (v18+)
- [MongoDB](https://www.mongodb.com/) (local or Atlas)
- [Redis](https://redis.io/) (local or cloud)

---

### 1. Clone the repository

```bash
git clone https://github.com/ArPiT-1310/API-Rate-Limiting-and-Analytics-Dashboard.git
cd API-Rate-Limiting-and-Analytics-Dashboard
```

---

### 2. Configure environment variables

Create a `.env` file in the project root:

```env
PORT=3000
MONGO_URI=mongodb://localhost:27017/api-dashboard
JWT_SECRET=your_super_secret_key
REDIS_URL=redis://localhost:6379
```

---

### 3. Install & run the backend

```bash
npm install
npm run dev
```

The backend starts at `http://localhost:3000`.

---

### 4. Install & run the frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend starts at `http://localhost:5173`.

---

## 🔌 API Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/signup` | Register a new user |
| `POST` | `/auth/login` | Login and receive JWT cookie |
| `POST` | `/auth/logout` | Clear session |
| `GET` | `/projects` | List all projects for the logged-in user |
| `POST` | `/projects` | Create a new project |
| `GET` | `/projects/:id` | Get a single project |
| `PUT` | `/projects/:id` | Update project name / target URL |
| `DELETE` | `/projects/:id` | Delete a project |
| `POST` | `/projects/:id/rotate-key` | Rotate the API key |
| `ANY` | `/proxy/:apiKey/*` | Reverse proxy (rate limited + logged) |
| `GET` | `/analytics/:projectId/overview` | Stats overview |
| `GET` | `/analytics/:projectId/requests-over-time` | Time-series data |
| `GET` | `/analytics/:projectId/status-breakdown` | Status code counts |
| `GET` | `/analytics/:projectId/recent-logs` | Latest request logs |

---

## 🧪 Running Tests

```bash
# Auth & project management
npm run test:auth

# Rate limiter (requires Redis)
npm run test:rate-limit

# Request logging
npm run test:logging

# Analytics endpoints
npm run test:analytics
```

---

## 📸 Screenshots

> _Add screenshots here once you deploy or run the app locally._

---

## 🤝 Contributing

Contributions are welcome! Feel free to open an issue or submit a pull request.

---

## 📄 License

This project is open-source under the [MIT License](LICENSE).
