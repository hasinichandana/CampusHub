# CampusHub: Smart College Management Platform

Centralized web-based college management platform for Students, Faculty, Department Staff, and Administrators.

## Project Overview

CampusHub replaces fragmented college workflows (WhatsApp groups, Google Forms, paper applications, manual complaint tracking, unorganized announcements) into a unified, role-based web platform.

## Technology Stack

- **Frontend**: HTML5, Vanilla CSS3 (Custom Glassmorphism Design System), JavaScript (Fetch API), Chart.js
- **Backend**: Node.js, Express.js (REST APIs)
- **Database**: MongoDB & Mongoose ORM
- **Authentication**: JWT & bcrypt password hashing
- **File Storage**: Multer (local development upload)

## Project Structure

```
CampusHub/
│
├── frontend/
│   ├── index.html
│   ├── css/
│   │   └── global.css
│   └── js/
│       └── main.js
│
├── backend/
│   ├── server.js
│   ├── package.json
│   ├── .env
│   ├── .env.example
│   ├── .gitignore
│   └── config/
│       └── db.js
│
└── README.md
```

## Phase 1 Checklist (Completed)

- [x] Project Folder Structure Setup
- [x] Express Server Initialization
- [x] Environment Configuration (.env)
- [x] MongoDB Connection Module (Mongoose)
- [x] Health-Check API Endpoint (`GET /api/health`)
- [x] Centralized Error Handling Middleware & 404 Route Handler
- [x] Frontend Health Check Dashboard UI

## Quick Start Instructions

1. Navigate to backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start development server:
   ```bash
   npm run dev
   ```

4. Verify health endpoint:
   Open `http://localhost:5000/api/health` or open `frontend/index.html` in your browser.
