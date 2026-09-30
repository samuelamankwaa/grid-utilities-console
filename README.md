# ⚡ Power Grid Utilities Console

An enterprise web application for utility contractors to manage **Coupa Invoices**, **Fulcrum Work Orders**, and **Connecteam Labor Timesheets**, providing real-time gross margin tracking, role classification, and crew performance analytics.

---

## 📖 Documentation

* **[Calculations & Data Guide (`GUIDE_ME.md`)](./GUIDE_ME.md)**: Plain-English guide explaining every metric, dollar amount, labor calculation, and chart formula without technical jargon.
* **[Developer Guide (`DEVELOPER_GUIDE.md`)](./DEVELOPER_GUIDE.md)**: Detailed file-by-file mapping, system architecture, Redux data flow, and role classification logic.
* **[Database Schema (`supabase_schema.sql`)](./supabase_schema.sql)**: PostgreSQL schema definitions, table constraints, and indexes for Supabase.

---

## 🚀 Quick Start

### 1. Prerequisites
* Node.js (v18+)
* Supabase Account & Project

### 2. Environment Setup
Create a `.env` file in the project root:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Installation & Run
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

---

## 🛠️ Tech Stack
* **Frontend**: React 18, TypeScript, Vite
* **State Management**: Redux Toolkit (`@reduxjs/toolkit`, `react-redux`)
* **Styling**: Tailwind CSS, Lucide Icons, Framer Motion
* **Database**: Supabase (PostgreSQL)
* **Data Processing**: SheetJS (`xlsx`)
