# Rail Ops: USA - Railroad Management Simulator

A comprehensive railroad management game built with React, Firebase, and TypeScript. Players create their own railroad company, manage locomotives, assign freight jobs, and expand their operations across America.

## Recent Changes

**October 27, 2025 (Latest):**
- ✅ **Increased starting cash from $500k to $1.5 million** for better early game experience
- ✅ **Implemented comprehensive stock system** for locomotive dealership
  - Main dealership stock: 0-17 units randomly per locomotive model
  - Loaner trains: Each unit is unique with stock=1 (removed after purchase)
  - Stock refreshes every 30 minutes with job refresh (XX:00 and XX:30)
  - Stock displayed in shop UI with availability badges
  - Purchase validation enforces stock limits
  - Stock automatically decrements after successful purchases
- ✅ **Added XP rewards to achievement system** alongside cash and points
  - Some achievements now grant XP in addition to monetary rewards
  - Achievement UI displays all three reward types when applicable
  - Claiming achievements properly awards XP to player stats
  
**October 27, 2025:**
- ✅ Implemented comprehensive achievement progress tracking on job completion
  - Tracks job count achievements (total jobs, job type specific, freight type specific)
  - Tracks distance-based achievements (total miles traveled)
  - Tracks value-based achievements (cash balance, player level, locomotives owned)
  - All achievement updates handled atomically within job completion transaction
- ✅ Updated alpha achievement to remove livery reward mention (cash/points only)
- ✅ Fixed self-healing stats system to properly initialize missing player stats fields
- ✅ Fixed shop bulk purchases to correctly increment locomotive unit numbers using field-path updates

**October 22, 2025:**
- ✅ Added dedicated Cash stat card to dashboard for clear visibility of actual cash balance
- ✅ Fixed shop purchase validation to use correct stats.cash field
- ✅ Removed heritage schemes system entirely (feature not aligned with game design)
- ✅ Preserved Alpha livery as a special livery (challenge-only reward, not heritage)
- ✅ Implemented safe migration logic for legacy users who had Alpha unlocked in old heritage system

## Project Overview

**Tech Stack:**
- **Frontend:** React 18, TypeScript, Tailwind CSS, Shadcn UI
- **Backend:** Firebase (Authentication, Firestore)
- **State Management:** TanStack Query, React Context
- **Routing:** Wouter
- **Styling:** Tailwind CSS with custom railroad-themed design tokens

## Architecture

### Authentication Flow
1. User signs in with Google via Firebase Auth (popup)
2. On first sign-in, creates initial player document in Firestore
3. Session persists until manual sign-out
4. Auth state managed via React Context (`AuthContext`)

### Data Structure (Firestore)

**Collection: `players/{userId}`**
```typescript
{
  player: {
    id: string,
    email: string,
    displayName: string,
    photoURL?: string,
    createdAt: number
  },
  company?: {
    name: string,
    city: string,
    primaryColor: string,
    secondaryColor: string,
    createdAt: number
  },
  stats: {
    cash: number (starts at $1,500,000),
    xp: number,
    level: number,
    nextLocoId: number (for automatic numbering)
  },
  locomotives: Locomotive[],
  jobs: Job[],
  dealershipStock: DealershipStock[] (0-17 units per model, refreshes every 30 min),
  loanerTrains: LoanerTrain[] (unique units, removed after purchase)
}
```

### Game Mechanics

**Company Creation:**
1. Player selects US city as home base
2. Chooses company name
3. Selects color scheme from presets
4. Receives starter locomotive (EMD GP38-2 #0001)

**Locomotive System:**
- Automatic unit numbering (#0001, #0002, etc.)
- Manual renaming for $10,000 (must be unique)
- Full stat tracking (HP, speed, weight, reliability, etc.)
- Buy, sell, or scrap options
- Status: available or assigned to jobs
- **Stock system**: Main dealership has 0-17 units per model (refreshes every 30 min)
- **Loaner trains**: Pre-owned locomotives, each unique unit available once

**Job System:**
- Three tiers:
  - Tier 1 (Local Freight + Yard Switching): Unlocked from start
    - Local freight: Jobs within the same city (e.g., "Chicago, IL Yard" → "Chicago, IL Industrial Park")
    - Distance: 5-15 miles, Duration: 8-15 minutes
    - Yard switching: In-yard operations (distance: 0 mi, Duration: 6-10 minutes)
  - Tier 2 (Mainline Freight): Unlocked at Level 10
    - Distance: 80-200 miles, Duration: 45-90 minutes
  - Tier 3 (Special Freight): Unlocked at Level 50
    - Distance: 200-500 miles, Duration: 120-300 minutes
- Jobs require minimum HP (can assign multiple locomotives)
- Completing jobs earns cash and XP
- **Auto-refresh system**: Jobs refresh every 30 minutes (at XX:00 and XX:30)
  - Only available jobs refresh; ongoing jobs (with assigned locomotives) are preserved
  - Dealership stock also refreshes on the same 30-minute cadence
- **Detailed manifests**: Each job includes breakdown of car types, contents, and weights
- **Current Jobs tab**: Track ongoing jobs with real-time progress indicators

**Leveling System:**
- Gain XP by completing jobs
- Level thresholds defined in XP_PER_LEVEL array
- Level ups unlock new job tiers
- Level-up notification shows unlocks

### File Structure

```
client/src/
├── components/
│   ├── ui/ (Shadcn components)
│   ├── main-layout.tsx (Sidebar + top stats bar)
│   └── level-up-notification.tsx
├── contexts/
│   └── AuthContext.tsx (Firebase auth + player data)
├── lib/
│   ├── firebase.ts (Firebase config)
│   └── queryClient.ts
├── pages/
│   ├── auth-page.tsx (Google sign-in)
│   ├── company-creation.tsx (3-step wizard)
│   ├── dashboard.tsx (Overview + quick actions)
│   ├── inventory.tsx (Locomotive management)
│   ├── jobs.tsx (Job board with tier tabs)
│   ├── shop.tsx (Purchase locomotives)
│   └── news.tsx (Updates feed)
├── App.tsx (Route + auth orchestration)
└── index.css (Design tokens)

shared/
└── schema.ts (All TypeScript types, locomotive catalog, cities list)
```

### Design System

**Colors:**
- Primary: Railroad Blue (210 80% 45%)
- Secondary: Industrial Orange (25 70% 50%)
- Success: Railroad Green (142 70% 45%)
- Warning: Caution Yellow (45 90% 55%)
- Dark theme by default

**Typography:**
- Sans: Inter (UI text)
- Accent: Rajdhani (Headers, company names)
- Mono: JetBrains Mono (Unit numbers, stats)

**Icons:**
- Lucide React for all UI icons
- Railroad-themed: Train, MapPin, Gauge, etc.

## Key Features

✅ Google Authentication with popup
✅ Persistent sessions
✅ Company creation wizard
✅ Locomotive inventory with detailed stats
✅ Automatic locomotive numbering system
✅ Manual unit renaming ($10k cost)
✅ Three-tier job system with level gating
  - Local freight (city-specific, 5-15 mi, 8-15 min)
  - Yard switching (in-yard operations, 6-10 min)
  - Mainline freight (80-200 mi, 45-90 min)
  - Special freight (200-500 mi, 120-300 min)
✅ Detailed job manifests (car types, contents, weights)
✅ Current Jobs tab with real-time progress tracking
✅ Auto-refresh jobs every 30 minutes (XX:00, XX:30)
✅ Multi-locomotive job assignments
✅ XP and leveling system
✅ Level-up notifications with unlock display
✅ Shop with tier-based locomotive catalog
✅ Dynamic stock system (0-17 units per model)
✅ Stock refreshes every 30 minutes with job market
✅ Stock availability displayed with badges
✅ Buy/sell/scrap locomotive options
✅ Loaner trains with unique pre-owned units
✅ News feed for updates
✅ Responsive dark-themed UI

## Environment Variables

Required Firebase secrets (already configured):
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_API_KEY`

## Future Enhancements

- Display time-to-refresh countdown for stock/jobs
- Livery customization system
- Locomotive degradation (mileage, paint condition)
- Maintenance and repair mechanics
- Dynamic job generation based on player level
- Company statistics dashboard
- Real-time job completion countdown
- Multiple save slots
- Leaderboards
- Automated test coverage for stock and purchase flows

## Firebase Security Rules

The Firestore security rules are defined in `firestore.rules` at the project root. 

**To deploy these rules to your Firebase project:**

1. Install Firebase CLI: `npm install -g firebase-tools`
2. Login to Firebase: `firebase login`
3. Initialize Firebase in your project: `firebase init firestore`
   - Select your existing Firebase project
   - Use `firestore.rules` as your rules file
   - Skip indexes file or use default
4. Deploy rules: `firebase deploy --only firestore:rules`

**Rules Overview:**
- Each player document is scoped to the authenticated user's UID
- Users can only read/write their own player document (`/players/{userId}`)
- Data validation ensures cash, XP, and level are always valid values
- All other paths are explicitly denied

See `firestore.rules` for the complete rule set.

## Development

The app runs on port 5000 with Vite dev server. All Firebase operations are scoped to the authenticated user's document for data isolation.
