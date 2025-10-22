# Rail Ops: USA - Design Guidelines

## Design Approach

**Selected Approach: Reference-Based (Simulation Game Aesthetic)**

Drawing inspiration from professional simulation games like Euro Truck Simulator 2, Train Simulator, and management games like Cities: Skylines and Transport Tycoon. The design emphasizes functionality, data clarity, and industrial authenticity while maintaining dark-themed gaming aesthetics.

**Key Design Principles:**
- Industrial Realism: Railroad-inspired color schemes and authentic UI elements
- Data-First Hierarchy: Critical information (cash, XP, level, locomotive stats) immediately visible
- Efficient Navigation: Quick access to inventory, jobs, shop, and company management
- Professional Simulation Feel: Clean, serious interface befitting a management simulator

---

## Core Design Elements

### A. Color Palette

**Dark Mode Foundation:**
- Primary Background: 220 15% 8% (Deep charcoal, almost black)
- Secondary Background: 220 12% 12% (Elevated surface color)
- Tertiary Background: 220 10% 16% (Card/panel backgrounds)

**Railroad Industrial Colors:**
- Primary Brand: 210 80% 45% (Railroad blue - inspired by classic diesel locomotives)
- Primary Hover: 210 80% 55%
- Secondary Accent: 25 70% 50% (Industrial orange - safety stripe color)
- Success/Completion: 142 70% 45% (Railroad green signal)
- Warning/Maintenance: 45 90% 55% (Caution yellow)
- Danger/Critical: 0 70% 50% (Red signal)

**Text Colors:**
- Primary Text: 220 10% 95% (Nearly white for high contrast)
- Secondary Text: 220 8% 70% (Muted for less critical info)
- Tertiary/Disabled: 220 6% 50%

**Status Indicators:**
- Available Job: 142 70% 45%
- In Progress: 45 90% 55%
- Locked Content: 220 6% 50%

### B. Typography

**Font Families:**
- Primary: 'Inter' or 'DM Sans' (Google Fonts) - Clean, technical feel for UI and data
- Accent/Headers: 'Rajdhani' or 'Orbitron' (Google Fonts) - Industrial, slightly technical for company names and major headings
- Monospace Data: 'JetBrains Mono' (Google Fonts) - For locomotive IDs (#0001) and technical specifications

**Font Sizes & Weights:**
- Hero/Company Name: text-4xl to text-5xl, font-bold (Accent font)
- Section Headers: text-2xl to text-3xl, font-semibold
- Card Titles: text-lg to text-xl, font-semibold
- Body/Stats: text-base, font-normal
- Labels/Meta: text-sm, font-medium
- Small Data: text-xs, font-normal

### C. Layout System

**Spacing Primitives:**
Use Tailwind units of **2, 4, 6, and 8** for consistent spacing:
- Component padding: p-4, p-6
- Section spacing: space-y-4, space-y-6
- Container margins: m-4, m-8
- Grid gaps: gap-4, gap-6

**Grid System:**
- Main dashboard: 12-column grid with sidebars
- Locomotive cards: grid-cols-1 md:grid-cols-2 lg:grid-cols-3
- Job listings: Single column with horizontal stat display
- Stat panels: grid-cols-2 md:grid-cols-4 for key metrics

**Container Widths:**
- Main content area: max-w-7xl mx-auto
- Card max-width: w-full within grid
- Modals/Popups: max-w-2xl for locomotive details, max-w-md for confirmations

### D. Component Library

**Navigation & Header:**
- Fixed top navigation bar with logo, company name, and primary stats (Cash, XP, Level)
- Icon-based sidebar navigation: Dashboard, Inventory, Jobs, Shop, Company, News
- Use Heroicons for consistent iconography throughout

**Dashboard Cards:**
- Locomotive Cards: Dark background (tertiary), border with primary accent when selected, display unit number prominently
- Job Cards: Horizontal layout with origin→destination flow, HP requirement badge, tier indicator
- Stats Cards: Elevated background, large numbers with icon, label underneath

**Data Display Components:**
- Locomotive Stats Table: Two-column layout (label: value) with dividers
- Progress Bars: For reliability, paint condition, fuel level (primary color fill)
- Badges: Rounded pills for tier, status (available/in progress/locked)

**Interactive Elements:**
- Primary Buttons: Railroad blue background, white text, hover state brightens
- Secondary Buttons: Outline style with railroad blue border
- Danger Buttons: Red background for sell/scrap actions
- Icon Buttons: Subtle hover with background highlight

**Modals & Popups:**
- Google Auth Popup: Clean, centered modal with Google branding
- Locomotive Detail Modal: Full stat display, customization options, action buttons
- Level Up Notification: Celebratory overlay with unlocked content display
- Confirmation Dialogs: Clear action description with confirm/cancel

**Forms:**
- Company Creation: Multi-step wizard with city dropdown, text inputs for name, color pickers
- Locomotive Customization: Unit number input with validation, future livery selector
- Dark input backgrounds (secondary) with primary border on focus

**Icons & Imagery:**
- Use Heroicons CDN for UI elements (train, currency, chart, cog, etc.)
- No custom locomotives images initially - rely on typography and stats
- Railroad crossing, signal, and track icons for decorative elements

### E. Animations

**Minimal Motion:**
- Button hover: Subtle brightness increase (150ms ease)
- Modal entry: Fade in with slight scale (200ms ease-out)
- Level up notification: Scale bounce effect (300ms)
- Job completion: Success checkmark animation (simple)
- No automatic carousels or sliding elements
- Avoid distracting locomotive or track animations

---

## Specific Screen Guidelines

**Authentication Screen:**
- Centered layout with game logo and title
- Dark background with subtle railroad imagery or gradient
- Google Sign In button prominent, follows Google's brand guidelines

**Company Creation:**
- Step-by-step flow with progress indicator
- City selection: Searchable dropdown with major US cities
- Color pickers: Visual swatches for primary and secondary company colors
- Preview panel showing how colors will appear

**Main Dashboard:**
- Top bar: Cash, XP bar with current level, company name
- Left sidebar: Navigation icons with labels
- Main area: Quick stats (active jobs, total locomotives), recent activity feed
- Call-to-action cards: "Assign a Job", "Visit Shop", "Check News"

**Locomotive Inventory:**
- Grid of locomotive cards with key stats visible
- Filtering by tier, status (available/assigned)
- Sort by: Unit number, HP, purchase date
- Click card to open detailed modal with sell/scrap/customize options

**Job Board:**
- Tabbed interface: Local Freight (unlocked), Mainline Freight (level 10+), Special Freight (level 50+)
- Each job displays: route map visual, distance, freight type, car count, HP requirement, payout, XP
- "Assign Locomotive" button opens selector modal
- Color-coded availability status

**Shop:**
- Locomotive catalog with tier grouping
- Each listing shows purchase cost, key specs preview
- Filter by tier, HP range, price range
- Purchase button with confirmation modal

**News Feed:**
- Simple chronological list of updates
- Each entry: date, title, description
- Subtle railroad-themed dividers between entries

---

## Images

**No hero images required** - this is a utility-focused game interface. All screens should be functional dashboards and data displays. 

**Icon Usage:**
- Locomotive icon in navigation and empty states
- Currency icon next to cash values
- Star/XP icon next to experience points
- Map pin for city/location references
- Wrench for maintenance, gauge for reliability
- Signal icons for status indicators

The design prioritizes data clarity and efficient interaction over decorative imagery, befitting a professional railroad management simulation.