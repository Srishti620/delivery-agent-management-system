# Delivery Agent Management System

A full-stack web application for managing delivery agents. The application allows users to create, view, update and delete agent records through a REST API, with a React frontend, Node.js backend, MongoDB for persistent storage and Redis for caching.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, React Router, Vite |
| Backend | Node.js, Express.js |
| Database | MongoDB, Mongoose |
| Caching | Redis, ioredis |
| Testing | Jest, Supertest, mongodb-memory-server |

## Table of Contents

1. Features
2. Project Structure
3. Prerequisites
4. Installation and Setup
5. Environment Variables
6. Database Setup
7. API Documentation
8. Redis Caching Strategy
9. Testing
10. Manual API Testing
11. Design Decisions
12. Troubleshooting

## 1. Features

### Agent Management
- Create new delivery agents.
- View all delivery agents.
- View individual agent details.
- Update existing agent information.
- Delete delivery agents.
- Activate or deactivate agents.

### Agent Information

Each delivery agent record contains:

- Agent ID (automatically generated).
- Full Name.
- Indian Mobile Number.
- Email Address.
- Service Area.
- Status (Active, Inactive or On Leave).
- Vehicle Type.
- Created At timestamp.
- Updated At timestamp.

### Additional Features

- Search agents by name, email, phone number or agent ID.
- Filter agents by status and service area.
- Pagination and sorting.
- Unique email and phone number validation.
- Server-side input validation.
- Appropriate HTTP response codes and error handling.
- Redis caching for frequently accessed API responses.
- Automatic cache invalidation after data changes.
- Graceful fallback to MongoDB when Redis is unavailable.
- Responsive React user interface.

## 2. Project Structure

```text
delivery-agent-management/
│
├── docker-compose.yml
│
├── backend/
│   ├── .env.example
│   ├── package.json
│   │
│   ├── scripts/
│   │   ├── syncIndexes.js
│   │   └── seed.js
│   │
│   ├── src/
│   │   ├── server.js
│   │   ├── app.js
│   │   │
│   │   ├── config/
│   │   ├── models/
│   │   ├── validators/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── routes/
│   │   ├── middleware/
│   │   └── utils/
│   │
│   └── tests/
│       ├── unit/
│       └── integration/
│
└── frontend/
    ├── .env.example
    ├── package.json
    ├── vite.config.js
    │
    └── src/
        ├── components/
        ├── pages/
        ├── services/
        └── ...
```

## 3. Prerequisites

Before running the project, make sure the following are installed:

- Node.js 18 or above.
- npm.
- MongoDB 6 or above.
- Redis 6 or above.
- Docker and Docker Compose (optional).

## 4. Installation and Setup

### Step 1: Clone the Repository

```bash
git clone <your-repository-url>
cd delivery-agent-management
```

### Step 2: Start MongoDB and Redis

Using Docker Compose:

```bash
docker compose up -d
```

This starts:

- MongoDB on port 27017.
- Redis on port 6379.

Alternatively, you can use locally installed MongoDB and Redis instances.

### Step 3: Backend Setup

Open a terminal:

```bash
cd backend
```

Install dependencies:

```bash
npm install
```

Create the environment file:

```bash
cp .env.example .env
```

Configure the environment variables according to your local setup.

Create database indexes:

```bash
npm run db:indexes
```

Optional: Insert sample delivery agents:

```bash
npm run seed
```

Start the backend server:

```bash
npm run dev
```

Backend API:

http://localhost:5000

Health check:

http://localhost:5000/health

### Step 4: Frontend Setup

Open another terminal:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Create the environment file:

```bash
cp .env.example .env
```

Start the React development server:

```bash
npm run dev
```

Frontend:

http://localhost:5173

### Step 5: Production Build

To create a production build of the frontend:

```bash
cd frontend
npm run build
```

The generated production files will be available inside:

```text
frontend/dist/
```

## 5. Environment Variables

Environment files are not committed to GitHub. Use the provided `.env.example` files as templates.

### Backend Environment Variables

Location: `backend/.env`

| Variable | Default Value | Description |
|---|---|---|
| NODE_ENV | development | Application environment |
| PORT | 5000 | Backend server port |
| MONGODB_URI | mongodb://127.0.0.1:27017/delivery_agents | MongoDB connection |
| REDIS_URL | redis://127.0.0.1:6379 | Redis connection |
| CORS_ORIGIN | http://localhost:5173 | Allowed frontend origin |
| CACHE_ENABLED | true | Enable or disable Redis caching |
| CACHE_PREFIX | dams | Redis key prefix |
| CACHE_DETAIL_TTL_SECONDS | 300 | Individual agent cache duration |
| CACHE_LIST_TTL_SECONDS | 60 | Agent list cache duration |

### Frontend Environment Variables

Location: `frontend/.env`

| Variable | Default Value | Description |
|---|---|---|
| VITE_PROXY_TARGET | http://localhost:5000 | Backend proxy target |
| VITE_API_BASE_URL | /api | API base URL |

### Testing Environment Variable

| Variable | Description |
|---|---|
| MONGODB_TEST_URI | Optional MongoDB connection string for integration tests |

The test database name must contain `test` because the integration test suite clears agent records.

**Important:** Never commit actual passwords, database credentials, API keys or other secret values to GitHub.

## 6. Database Setup

MongoDB is used as the primary persistent database.

The application uses Mongoose to define the agent schema and manage database operations.

No manual migrations are required.

### Creating Database Indexes

Run:

```bash
cd backend
npm run db:indexes
```

The application creates indexes for:

- Agent ID.
- Email address.
- Phone number.

Email, phone number and agent ID have unique indexes to prevent duplicate records.

### Sample Agent Document

```json
{
  "agentId": "DA-1A2B3C4D",
  "fullName": "Asha Rao",
  "phoneNumber": "+919876543210",
  "email": "asha@example.com",
  "serviceArea": "Jaipur - Malviya Nagar",
  "status": "active",
  "vehicleType": "motorbike",
  "createdAt": "2026-11-02T07:00:00.000Z",
  "updatedAt": "2026-11-02T07:00:00.000Z"
}
```

### Phone Number Validation

The application accepts valid Indian mobile numbers only.

Validation rules:

- Must contain exactly 10 mobile digits.
- The first digit must be between 6 and 9.
- Supports the optional Indian country code (+91 or 91).
- Supports an optional leading 0.
- Spaces, hyphens, brackets and parentheses are allowed.
- International mobile numbers are not supported.

**Valid examples:**

```text
9876543210
8765432109
7654321098
+919876543210
+91 9876543210
919876543210
09876543210
```

**Invalid examples:**

```text
1234567890
987654321
98765432100
+14155552671
```

All accepted phone numbers are normalized and stored in the following format:

```text
+91XXXXXXXXXX
```

This ensures that the same Indian mobile number cannot be stored multiple times using different formats.

## 7. API Documentation

Base URL:

```text
http://localhost:5000
```

All request and response bodies use JSON.

### CRUD Endpoints

| Method | Endpoint | Description | Success Status |
|---|---|---|---|
| POST | /api/agents | Create an agent | 201 |
| GET | /api/agents | Get all agents | 200 |
| GET | /api/agents/:agentId | Get individual agent | 200 |
| PUT | /api/agents/:agentId | Replace agent information | 200 |
| PATCH | /api/agents/:agentId | Partially update agent | 200 |
| DELETE | /api/agents/:agentId | Delete an agent | 204 |
| GET | /health | Check server health | 200 |

### Create Agent

**POST** `/api/agents`

Request body:

```json
{
  "fullName": "Asha Rao",
  "phoneNumber": "9876543210",
  "email": "asha@example.com",
  "serviceArea": "Jaipur - Malviya Nagar",
  "status": "active",
  "vehicle