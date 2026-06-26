# 🌪️ Hurricane Street Cricket

A full-stack web application for managing and live-scoring street cricket tournaments. Built for organizers who want a professional-grade cricket management experience — from team registration and fixture generation to ball-by-ball live scoring, real-time match viewing, and player analytics.

---

## ✨ Features

### 🏏 Tournament Management
- **Multi-Format Support** — Create League (round-robin), Knockout (single-elimination), or Test Match (4 innings) tournaments
- **Automatic League Fixtures** — Round-robin fixtures auto-generated for all registered teams
- **Knockout Bracket Generation** — Auto-generated tournament trees with dynamic byes and auto-advancing winners
- **Playoff & Final Generation** — Semi-finals and finals created from the league points table standings
- **Points Table** — Auto-calculated with wins, losses, NRR (Net Run Rate), and tiebreakers for League formats

### 📋 Team Management
- **Format-Specific Player Limits** — Register 2–3 players for League, or up to 11 players for Knockout and Test matches
- Teams scoped per tournament (same team name allowed across different tournaments)
- Full CRUD operations on teams with dynamic player arrays

### 🎯 Live Scoring Engine
- **Ball-by-ball scoring** — Record runs, wides, no-balls, wickets, and extras
- **Striker & bowler tracking** — Per-ball attribution for individual stats
- **Undo support** — Revert the last delivery if a mistake is made
- **Super Over support** — Automatic super over flow for tied limited-overs matches
- **Test Match Dynamics** — Support for 4 innings, unlimited overs, voluntary Declarations, and Follow-On enforcement
- **Toss management** — Record toss winner and decision (bat/bowl)
- **Innings transitions** — Automatic detection of innings completion (all out / overs done / declared)

### 📺 Live Match Viewing (Public)
- **Real-time scorecard** — Watch live matches with auto-refreshing scores
- **Full scorecard breakdown** — Batting and bowling stats per innings
- **AI match predictions** — Win probability predictions powered by a built-in prediction engine

### 📊 Analytics & Leaderboards
- **Orange Cap** — Top run scorers with strike rate, fours, and sixes
- **Purple Cap** — Top wicket takers with economy rate and dot balls
- **Player Stats** — Detailed batting and bowling breakdowns per tournament
- **Global leaderboard** — Cross-tournament career stats

### 🔒 Admin System
- JWT-based authentication with single-session enforcement
- Protected admin routes for scoring, fixture management, and team operations
- Dedicated admin layout with all management tools

### 📱 Responsive Design
- Mobile-first with a bottom navigation bar on small screens
- Desktop navigation header with full menu
- Dark theme with cricket-inspired color palette (greens, golds, blacks)

---

## 🏗️ Tech Stack

| Layer      | Technology                                                     |
|------------|----------------------------------------------------------------|
| Frontend   | React 18, React Router v6, Vite, Tailwind CSS 3               |
| Backend    | Express 5, Node.js                                             |
| Database   | Supabase (PostgreSQL)                                          |
| Auth       | JWT (jsonwebtoken)                                             |
| Icons      | Lucide React                                                   |
| Export     | html2canvas + jsPDF (scorecard PDF export)                     |
| Deployment | Vercel (frontend), any Node host (backend)                     |

---

## 📁 Project Structure

```
street-cricket/
├── frontend/                   # React + Vite SPA
│   ├── src/
│   │   ├── App.jsx             # Root component with routing
│   │   ├── main.jsx            # Entry point
│   │   ├── supabase.js         # Supabase client config
│   │   ├── index.css           # Global styles
│   │   ├── pages/
│   │   │   ├── Home.jsx        # Tournament dashboard (admin/public)
│   │   │   ├── Teams.jsx       # Team registration & management
│   │   │   ├── Fixtures.jsx    # Fixture list & generation
│   │   │   ├── Toss.jsx        # Toss management page
│   │   │   ├── Scoring.jsx     # Live ball-by-ball scoring UI
│   │   │   ├── Watch.jsx       # Public live match view
│   │   │   ├── Points.jsx      # Points table display
│   │   │   ├── History.jsx     # Completed match history
│   │   │   ├── Leaderboard.jsx # Batting & bowling leaderboards
│   │   │   ├── PlayerStats.jsx # Orange/Purple cap analytics
│   │   │   ├── Login.jsx       # Admin login page
│   │   │   └── AdminLayout.jsx # Protected admin wrapper
│   │   └── components/
│   │       ├── FullScorecard.jsx     # Detailed scorecard view
│   │       ├── LivePlayerStats.jsx   # Real-time player stats
│   │       └── MatchPrediction.jsx   # AI win probability display
│   ├── tailwind.config.js      # Custom cricket theme colors
│   ├── vite.config.js          # Vite configuration
│   ├── vercel.json             # Vercel SPA rewrites
│   └── .env                    # Frontend env vars
│
├── backend/                    # Express REST API
│   ├── server.js               # App entry point
│   ├── src/
│   │   ├── routes/
│   │   │   ├── authRoutes.js       # Login, logout, verify
│   │   │   ├── teamRoutes.js       # Team CRUD
│   │   │   ├── matchRoutes.js      # Toss, scoring, undo, predict
│   │   │   └── tournamentRoutes.js # Fixtures, points, leaderboard
│   │   ├── services/
│   │   │   ├── matchService.js       # Core match logic
│   │   │   ├── scoringEngine.js      # Ball-by-ball scoring engine
│   │   │   ├── tournamentService.js  # Fixture gen, points calc
│   │   │   └── predictionService.js  # AI match prediction engine
│   │   ├── middleware/
│   │   │   └── authMiddleware.js     # JWT auth guard
│   │   ├── db/
│   │   │   └── supabase.js          # Supabase client
│   │   └── utils/                    # Shared utilities
│   ├── schema.sql                    # Base database schema
│   ├── migration_full_tournaments.sql # Tournament support migration
│   ├── migration_player_stats.sql     # Player tracking migration
│   ├── migration_multi_format.sql     # Knockout & Test match formats migration
│   ├── test_e2e.js                   # End-to-end tests
│   ├── test_playoffs_e2e.js          # Playoff flow tests
│   └── .env                          # Backend env vars
│
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** v18 or higher
- **npm** v9 or higher
- A **Supabase** project (free tier works)

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/street-cricket.git
cd street-cricket
```

### 2. Set Up the Database

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard) → SQL Editor
2. Run the base schema:
   ```sql
   -- Copy and execute the contents of backend/schema.sql
   ```
3. Run the tournament migration:
   ```sql
   -- Copy and execute the contents of backend/migration_full_tournaments.sql
   ```
4. Run the player stats migration:
   ```sql
   -- Copy and execute the contents of backend/migration_player_stats.sql
   ```
5. Run the multi-format migration:
   ```sql
   -- Copy and execute the contents of backend/migration_multi_format.sql
   ```

### 3. Configure Environment Variables

**Backend** (`backend/.env`):
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
JWT_SECRET=your-secret-key
PORT=5001
```

**Frontend** (`frontend/.env`):
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_URL=http://localhost:5001
```

### 4. Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 5. Start Development Servers

```bash
# Terminal 1 — Backend
cd backend
node server.js
# → API running on http://localhost:5001

# Terminal 2 — Frontend
cd frontend
npm run dev
# → App running on http://localhost:5173
```

---

## 🔐 Admin Access

The admin panel is accessible at `/admin/leagues` and requires login.

| Field    | Value                     |
|----------|---------------------------|
| Username | `admin`                   |
| Password | *(Check your environment)*|

> **Note:** Only one admin session is active at a time. A new login will invalidate the previous session.

---

## 📡 API Reference

All endpoints are prefixed with the backend URL (default: `http://localhost:5001`).

### Auth — `/api/auth`

| Method | Endpoint   | Auth | Description              |
|--------|------------|------|--------------------------|
| POST   | `/login`   | ❌   | Login with credentials   |
| POST   | `/logout`  | ✅   | Invalidate current token |
| GET    | `/verify`  | ✅   | Verify token validity    |

### Teams — `/api/teams`

| Method | Endpoint | Auth | Description            |
|--------|----------|------|------------------------|
| GET    | `/`      | ❌   | List all teams         |
| POST   | `/`      | ✅   | Create a new team      |
| PUT    | `/:id`   | ✅   | Update a team          |
| DELETE | `/:id`   | ✅   | Delete a team          |

### Matches — `/api/matches`

| Method | Endpoint      | Auth | Description                  |
|--------|---------------|------|------------------------------|
| POST   | `/toss/:id`   | ✅   | Record toss result           |
| POST   | `/start/:id`  | ✅   | Start match (begin scoring)  |
| POST   | `/ball/:id`   | ✅   | Record a ball delivery       |
| POST   | `/undo/:id`   | ✅   | Undo last ball               |
| GET    | `/predict/:id`| ❌   | Get AI match prediction      |

### Tournament — `/api/tournament`

| Method | Endpoint             | Auth | Description                    |
|--------|----------------------|------|--------------------------------|
| POST   | `/create`            | ✅   | Create new tournament          |
| GET    | `/list`              | ❌   | List all tournaments           |
| DELETE | `/:id`               | ✅   | Delete tournament & all data   |
| POST   | `/generate-league`   | ✅   | Generate round-robin fixtures  |
| POST   | `/generate-playoffs` | ✅   | Generate semi-final fixtures   |
| POST   | `/generate-final`    | ✅   | Generate the final fixture     |
| GET    | `/fixtures`          | ❌   | Get fixtures for a tournament  |
| GET    | `/fixtures/:id`      | ❌   | Get full fixture details       |
| GET    | `/points-table`      | ❌   | Get league points table        |
| GET    | `/player-stats`      | ❌   | Get Orange/Purple cap stats    |
| GET    | `/leaderboard`       | ❌   | Get batting/bowling leaderboard|

### Knockout — `/api/knockout`

| Method | Endpoint                | Auth | Description                    |
|--------|-------------------------|------|--------------------------------|
| POST   | `/generate-bracket`     | ✅   | Generate elimination bracket   |
| GET    | `/bracket/:tournament_id`| ❌  | Get full bracket hierarchy     |

---

## 🗄️ Database Schema

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  tournaments │     │    teams     │     │   fixtures   │
├──────────────┤     ├──────────────┤     ├──────────────┤
│ id (PK)      │◄────│ tournament_id│     │ id (PK)      │
│ name         │     │ id (PK)      │◄──┐ │ tournament_id│
│ ground       │     │ team_name    │   │ │ team_a_id    │──►teams
│ format       │     │ players (JSON)│   │ │ team_b_id    │──►teams
│ status       │     │ player1_name │   │ │ total_overs  │
│ created_at   │     │ player2_name │   │ │ innings_count│
└──────────────┘     │ player3_name │   │ │ status       │
                     │ created_at   │   │ │ match_type   │
                     └──────────────┘   │ │ bracket_round│
                                        │ │ next_fixture │
                                        │ └──────────────┘
                                        │        │
                              ┌─────────┘        │
                              │                  │
                     ┌────────┴─────┐   ┌────────┴─────┐
                     │ match_scores │   │ ball_by_ball │
                     ├──────────────┤   ├──────────────┤
                     │ id (PK)      │   │ id (PK)      │
                     │ fixture_id   │   │ fixture_id   │
                     │ team_id      │   │ innings      │
                     │ innings      │   │ over_number  │
                     │ runs         │   │ ball_number  │
                     │ wickets      │   │ runs_scored  │
                     │ balls_bowled │   │ extras       │
                     │ extras       │   │ is_wide      │
                     │ is_completed │   │ is_no_ball   │
                     │ is_declared  │   │ is_wicket    │
                     └──────────────┘   │ wicket_type  │
                                        │ striker_name │
                                        │ bowler_name  │
                                        └──────────────┘
```

---

## 🎮 Usage Workflow

1. **Create a Tournament** — Go to Admin → create a new tournament (name + ground)
2. **Register Teams** — Add teams with 2–3 players each
3. **Generate Fixtures** — Auto-generate round-robin league fixtures
4. **Conduct Toss** — Select toss winner and their decision for each match
5. **Live Score** — Use the scoring interface to record each ball
6. **Watch Live** — Share the public URL for spectators to follow along
7. **View Points Table** — Track standings as matches complete
8. **Generate Playoffs** — Once league is done, generate semis & final
9. **Check Leaderboards** — View Orange/Purple cap winners and player stats

---

## 🧪 Testing

```bash
cd backend

# Run end-to-end tests
node test_e2e.js

# Run playoff flow tests
node test_playoffs_e2e.js
```

---

## 🚢 Deployment

### Frontend (Vercel)
```bash
cd frontend
npm run build
# Deploy the dist/ folder to Vercel
# vercel.json handles SPA client-side routing
```

### Backend
Deploy `server.js` to any Node.js hosting platform (Render, Railway, Fly.io, etc.) with the environment variables configured.

---

## 👨‍💻 Author

**Ajith Rajendiran**

---

## 📄 License

ISC
