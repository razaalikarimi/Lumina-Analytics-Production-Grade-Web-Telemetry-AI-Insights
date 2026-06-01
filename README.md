# 🌌 Lumina Analytics: Production-Grade Web Telemetry & AI Insights

Lumina Analytics is a highly scalable, production-ready web analytics dashboard (similar to Google Analytics). It tracks user page views, sessions, and custom clicks in real-time, buffering ingestion logs through a queue to handle spikes without crashing the database, and integrates the **Google Gemini API** to generate traffic forecasts, detect anomalies, and compile executive weekly PDF reports.

---

## 🛠️ Tech Stack

*   **Frontend**: Next.js (App Router), React, TypeScript, Recharts, Tailwind CSS.
*   **Ingestion API & Worker**: Node.js, Express, TypeScript, BullMQ, Redis, Prisma ORM.
*   **Database**: MySQL (with optimized composite indexes).
*   **AI Engine**: Google Gemini API (`@google/genai` client).
*   **Reporting**: PDFKit (for styled executive report streaming).

---

## 🏗️ Architecture & System Design

To prevent database write lockups during heavy traffic, the system separates telemetry ingestion from database writes:
1.  **Browser SDK (`tracker.js`)**: A lightweight script embedded in websites. It generates session UUIDs and captures page loads, SPA routing shifts, and custom button clicks asynchronously using modern beacon delivery.
2.  **Ingestion Server**: A lightweight Express API that receives events, performs rate-limiting, and immediately pushes payloads onto a **Redis-backed BullMQ queue**, returning `202 Accepted` to the client.
3.  **Background Worker**: Processes queued events in batches (every 500ms or when the queue hits 100 events) and executes bulk writes into the **MySQL** database.
4.  **Admin Dashboard**: A secure glassmorphic Next.js portal fetching aggregated database statistics, streaming live active visitors, and rendering AI predictions.

```mermaid
graph TD
    Client[Browser SDK / tracker.js] -->|Telemetry JSON| Ingestion[Express Ingestion API]
    Ingestion -->|Queue Job| Queue[(Redis / BullMQ)]
    Queue -->|Batch Dequeue 100/500ms| Worker[BullMQ Worker]
    Worker -->|Bulk Writes| DB[(MySQL Database)]
    
    Dashboard[Next.js Admin Dashboard] -->|Aggregated Queries| DB
    Dashboard -->|Real-time counts| SSE[SSE Live Visitor Stream]
    Ingestion -->|Publishes to| SSE
    Dashboard -->|Analytics Data| Gemini[Google Gemini API]
    Gemini -->|Predictions & Summaries| Dashboard
```

---

## 📂 Project Directory Structure

```text
├── dashboard/               # Next.js Frontend Dashboard & Aggregation APIs
│   ├── prisma/              # Prisma schema definition
│   ├── src/
│   │   ├── app/             # App Router pages and API routes
│   │   ├── components/      # UI Dashboard Widgets
│   │   └── lib/             # Database connection & Gemini API wrappers
│   └── .env                 # Next.js configurations
│
├── ingestion-api/           # Express Server & Queue Background Worker
│   ├── prisma/              # Database migrations configuration
│   ├── src/
│   │   ├── index.ts         # Ingestion endpoints & SSE streams
│   │   ├── worker.ts        # BullMQ write-back worker thread
│   │   ├── batch-processor.ts# SQL Batch inserting logic
│   │   └── seed.ts          # Database 30-day traffic seeding script
│   └── .env                 # Ingestion port and MySQL configurations
│
└── sdk/                     # Telemetry Client SDK
    ├── tracker.js           # Client-side tracking script
    └── test-tracker.html    # Local sandbox test webpage
```

---

## 🚀 Quick-Start Guide

### Prerequisites
*   Node.js (v20+ recommended)
*   MySQL Server active on port `3306`

---

### Step 1: Database Initialization
Update the `DATABASE_URL` in both `ingestion-api/.env` and `dashboard/.env` with your MySQL credentials:
```env
DATABASE_URL="mysql://root:password2root@localhost:3306/analytics_db"
```
Then, push the Prisma schema to compile database tables and indexes:
```bash
cd ingestion-api
npx prisma db push
```

### Step 2: Seed Mock Analytics Data
Populate the database with 30 days of realistic traffic history (including weekly cycles, browser breakdowns, and a traffic spike anomaly on May 20):
```bash
npx ts-node src/seed.ts
```

### Step 3: Run Both Services (API & Dashboard)
Configure your `GEMINI_API_KEY` inside `dashboard/.env` to unlock AI forecast models. Then, start both the Ingestion API and Dashboard concurrently with a single command from the project root:
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.
*   **Username**: `admin`
*   **Password**: `adminpassword`

---

## 📊 Live Testing
Open the sandbox test client **[http://localhost:3001/test-tracker.html](http://localhost:3001/test-tracker.html)**.
*   Navigating the routes or clicking the **"Fire Click Event"** button will immediately send telemetry pings to port `3001`.
*   Open the Dashboard at `http://localhost:3000` to watch the **Live Active Visitors** card update in real-time.

---

## 💡 Key Features Tour

*   **Real-time Visitor Counting**: Tracks active users in the last 5 minutes via a Server-Sent Events (SSE) stream.
*   **Segmentation Engine**: Filter the entire dashboard dynamically by specific browsers, countries, devices, and date ranges.
*   **AI Traffic Forecasting**: Overlay Gemini's 7-day predicted traffic cycles over your current metrics to forecast future resource demands.
*   **AI System Anomalies**: Detect major spikes or steep drops (such as server downtime, viral posts, or DDoS flags) with severity indicators.
*   **Executive PDF Summaries**: Generates a professional 2-page report detailing weekly strengths, opportunities, and strategic growth blueprints in PDF format.
