import { z } from "zod";

// ============================================================================
// UUID GENERATION (CROSS-PLATFORM)
// ============================================================================

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  if (typeof self !== 'undefined' && self.crypto && self.crypto.randomUUID) {
    return self.crypto.randomUUID();
  }
  
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// ============================================================================
// PLAYER & COMPANY SCHEMAS
// ============================================================================

export const playerSchema = z.object({
  id: z.string(), // Firebase UID
  email: z.string().email(),
  displayName: z.string(),
  photoURL: z.string().optional(),
  createdAt: z.number(),
});

export const companySchema = z.object({
  name: z.string().min(1).max(50),
  city: z.string().min(1),
  primaryColor: z.string(), // hex color
  secondaryColor: z.string(), // hex color
  defaultPaintScheme: z.string().optional(), // ID of paint scheme to auto-apply to new locomotives
  createdAt: z.number(),
});

export const playerStatsSchema = z.object({
  cash: z.number().default(1500000),
  xp: z.number().default(0),
  level: z.number().default(1),
  nextLocoId: z.number().default(2), // starts at 2 since starter loco is #0001
  points: z.number().default(10), // New Points currency for achievements
  totalJobsCompleted: z.number().default(0), // Track total jobs for career achievements
});

// ============================================================================
// LOCOMOTIVE SCHEMAS
// ============================================================================

export const locomotiveSchema = z.object({
  id: z.string(), // Firestore document ID
  unitNumber: z.string(), // e.g. "#0001"
  model: z.string(),
  manufacturer: z.string(),
  tier: z.number().int().min(1).max(3), // 1=Local, 2=Mainline, 3=Special (kept for backwards compatibility)
  tags: z.array(z.enum(["Local / Yard", "Long Haul"])).default([]), // New tag system
  horsepower: z.number().int().positive(),
  topSpeed: z.number().int().positive(), // mph
  weight: z.number().positive(), // tons
  tractiveEffort: z.number().int().positive(), // lbs
  fuelCapacity: z.number().int().positive(), // gallons
  fuelEfficiency: z.number().positive(), // gallons per hour
  reliability: z.number().min(0).max(100), // percentage
  maintenanceCost: z.number().positive(), // dollars per mile
  purchaseCost: z.number().int().positive(),
  resaleValue: z.number().int().positive(),
  scrapValue: z.number().int().positive(), // 30% of purchase
  mileage: z.number().default(0),
  health: z.number().min(0).max(100).default(100), // 100 = perfect, 0 = needs scrapping
  paintCondition: z.number().min(0).max(100).default(100),
  paintSchemeId: z.string().optional(), // Reference to paint scheme
  specialLiveryId: z.string().optional(), // Reference to special livery (challenge-only, like Alpha livery)
  previousOwnerName: z.string().optional(), // For used locomotives - previous company name
  isPatched: z.boolean().optional(), // True if paint was patched instead of fully repainted
  status: z.enum(["available", "assigned", "needs_repair", "in_paint_shop", "stored"]).default("available"),
  assignedJobId: z.string().optional(),
  paintCompleteAt: z.number().optional(), // Timestamp when paint job will be complete
  purchasedAt: z.number(),
  notes: z.string().optional(),
  isUsed: z.boolean().optional(), // True if purchased as used/loaner
});

// ============================================================================
// PAINT SCHEME SCHEMAS
// ============================================================================

export const paintSchemeSchema = z.object({
  id: z.string(), // Firestore document ID
  name: z.string().min(1).max(50),
  primaryColor: z.string(), // hex color
  secondaryColor: z.string(), // hex color
  accentColor: z.string().optional(), // hex color
  stripePattern: z.enum(["solid", "striped", "checkered", "custom"]).default("solid"),
  createdAt: z.number(),
});

export const insertPaintSchemeSchema = paintSchemeSchema.omit({ id: true, createdAt: true });
export type PaintScheme = z.infer<typeof paintSchemeSchema>;
export type InsertPaintScheme = z.infer<typeof insertPaintSchemeSchema>;

// Paint application costs
export const PAINT_COSTS = {
  SINGLE_LOCO: 5000, // $5,000 to paint one locomotive
  ALL_LOCOS_PER_UNIT: 3500, // $3,500 per loco when painting all (bulk discount)
  PATCH_COST: 800, // $800 to patch logos/numbers (cheap alternative)
  DOWNTIME_MINUTES: 10, // 10 minutes out of service for full paint
  PATCH_DOWNTIME_MINUTES: 2, // 2 minutes for patching
};

// ============================================================================
// SPECIAL LIVERIES (CHALLENGE-ONLY)
// ============================================================================

export const specialLiverySchema = z.object({
  id: z.string(), // e.g., "alpha_livery"
  name: z.string().min(1).max(50),
  description: z.string(),
  primaryColor: z.string(), // hex color
  secondaryColor: z.string(), // hex color
  accentColor: z.string().optional(), // hex color
  stripePattern: z.enum(["solid", "striped", "checkered", "custom"]).default("custom"),
  isUnlocked: z.boolean().default(false), // Unlocked through challenge
  appliedToLocoId: z.string().optional(), // Which single locomotive has this livery
  unlockedAt: z.number().optional(), // When it was unlocked
});

export type SpecialLivery = z.infer<typeof specialLiverySchema>;

// Special liveries catalog (challenge-only rewards)
export const SPECIAL_LIVERIES_CATALOG: Omit<SpecialLivery, 'isUnlocked' | 'appliedToLocoId' | 'unlockedAt'>[] = [
  {
    id: "alpha_livery",
    name: "Alpha Livery",
    description: "Exclusive paint scheme for alpha testers who completed 250 jobs",
    primaryColor: "#9333ea", // Purple
    secondaryColor: "#fbbf24", // Gold
    accentColor: "#1e293b", // Dark slate
    stripePattern: "custom",
  },
];

// ============================================================================
// ACHIEVEMENT SYSTEM
// ============================================================================

export const achievementSchema = z.object({
  id: z.string(),
  type: z.enum(["weekly", "career", "event"]),
  title: z.string(),
  description: z.string(),
  requirement: z.string(), // e.g., "complete_intermodal_jobs_5"
  targetValue: z.number().int().positive(), // e.g., 5 jobs
  currentProgress: z.number().int().default(0),
  isCompleted: z.boolean().default(false),
  completedAt: z.number().optional(),
  rewards: z.object({
    cash: z.number().int().default(0),
    points: z.number().int().default(0),
    xp: z.number().int().default(0),
  }),
  expiresAt: z.number().optional(), // For weekly and event achievements
  createdAt: z.number(),
});

export const insertAchievementSchema = achievementSchema.omit({ id: true, createdAt: true, currentProgress: true, isCompleted: true, completedAt: true });
export type Achievement = z.infer<typeof achievementSchema>;
export type InsertAchievement = z.infer<typeof insertAchievementSchema>;

// Points redemption costs
export const POINTS_COSTS = {
  AUTO_COMPLETE_JOB: 10, // Auto-complete a single job
  AUTO_COMPLETE_PAINT: 5, // Auto-complete all paint jobs
};

// ============================================================================
// JOB SCHEMAS
// ============================================================================

export const carManifestSchema = z.object({
  carType: z.string(), // e.g. "Boxcar", "Hopper", "Tank Car", "Gondola", "Intermodal"
  content: z.string(), // what's in the car
  count: z.number().int().positive(),
  weight: z.number().positive(), // tons per car
});

export const jobSchema = z.object({
  id: z.string(),
  jobId: z.string(), // e.g. "LCL-001", "YRD-005"
  tier: z.number().int().min(1).max(3), // 1=Local, 2=Mainline, 3=Special
  jobType: z.enum(["local_freight", "yard_switching", "mainline_freight", "special_freight"]).default("local_freight"),
  origin: z.string(),
  destination: z.string(),
  distance: z.number().positive(), // miles (0 for yard switching)
  freightType: z.string(), // e.g. "Coal", "Intermodal", "Grain", "Chemicals"
  demandLevel: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  carCount: z.number().int().positive(),
  manifest: z.array(carManifestSchema).default([]), // detailed breakdown of cars
  hpRequired: z.number().int().positive(),
  payout: z.number().int().positive(),
  timeMinutes: z.number().positive().optional(), // new field, optional for backward compatibility
  timeHours: z.number().positive().optional(), // legacy field, optional for backward compatibility
  xpReward: z.number().int().positive(),
  status: z.enum(["available", "in_progress", "completed"]).default("available"),
  assignedLocos: z.array(z.string()).optional(), // array of loco IDs
  startedAt: z.number().optional(),
  completesAt: z.number().optional(),
  progressPercent: z.number().min(0).max(100).optional(), // for UI display
  generatedAt: z.number().default(() => Date.now()), // when the job was created (for hourly refresh)
}).transform((data) => {
  // Backward compatibility: convert timeHours to timeMinutes if needed
  if (data.timeMinutes === undefined && data.timeHours !== undefined) {
    data.timeMinutes = data.timeHours * 60;
  }
  // Default timeMinutes if neither exists
  if (data.timeMinutes === undefined) {
    data.timeMinutes = 60;
  }
  // Generate default manifest if empty
  if (data.manifest.length === 0) {
    data.manifest = [{
      carType: "Boxcar",
      content: "General Freight",
      count: data.carCount,
      weight: 80,
    }];
  }
  return data;
});

export type CarManifest = z.infer<typeof carManifestSchema>;
export type Job = z.infer<typeof jobSchema>;

// ============================================================================
// SUPPLY & DEMAND SYSTEM
// ============================================================================

export const freightDemandSchema = z.object({
  freightType: z.string(),
  demandLevel: z.enum(["low", "medium", "high", "critical"]),
  payoutMultiplier: z.number().positive(), // affects job payout
  lastUpdated: z.number(),
});

export const marketDataSchema = z.object({
  demands: z.array(freightDemandSchema),
  lastRefreshed: z.number(),
});

export type FreightDemand = z.infer<typeof freightDemandSchema>;
export type MarketData = z.infer<typeof marketDataSchema>;

// Freight types and their base characteristics
export const FREIGHT_TYPES = [
  { type: "Coal", basePayoutPerMile: 85, baseDemand: "high", description: "Unit trains of coal from mines to power plants" },
  { type: "Intermodal", basePayoutPerMile: 95, baseDemand: "high", description: "Container and trailer on flatcar traffic" },
  { type: "Grain", basePayoutPerMile: 70, baseDemand: "medium", description: "Agricultural products in covered hoppers" },
  { type: "Chemicals", basePayoutPerMile: 110, baseDemand: "medium", description: "Hazmat tank cars requiring special handling" },
  { type: "Steel", basePayoutPerMile: 80, baseDemand: "medium", description: "Steel coils and plates in gondolas" },
  { type: "Lumber", basePayoutPerMile: 65, baseDemand: "low", description: "Forest products in centerbeam flatcars" },
  { type: "Automotive", basePayoutPerMile: 100, baseDemand: "medium", description: "Finished vehicles in autorack cars" },
  { type: "Mixed Manifest", basePayoutPerMile: 75, baseDemand: "medium", description: "Various commodities in mixed train" },
] as const;

// ============================================================================
// NEWS SCHEMAS
// ============================================================================

export const newsItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  date: z.number(),
});

// ============================================================================
// PLAYER DATA (FIRESTORE DOCUMENT)
// ============================================================================

export const loanerTrainSchema = z.object({
  id: z.string(), // Unique identifier for this loaner train
  catalogItem: z.custom<LocomotiveCatalogItem>(), // The catalog item this is based on
  usedPrice: z.number().positive(), // Discounted price for used condition
  mileage: z.number().min(0), // Miles on the odometer
  health: z.number().min(0).max(100), // Current condition (0-100)
  paintCondition: z.number().min(0).max(100), // Paint condition (0-100)
  previousOwner: z.string(), // Name of previous railroad company
  previousOwnerColors: z.object({ // Previous owner's paint scheme
    primaryColor: z.string(),
    secondaryColor: z.string(),
  }),
});

export type LoanerTrain = z.infer<typeof loanerTrainSchema>;

export const playerDataSchema = z.object({
  player: playerSchema,
  company: companySchema.optional(),
  stats: playerStatsSchema,
  locomotives: z.array(locomotiveSchema).default([]),
  jobs: z.array(jobSchema).default([]),
  marketData: marketDataSchema.optional(), // supply/demand tracking
  paintSchemes: z.array(paintSchemeSchema).default([]), // custom paint schemes
  specialLiveries: z.array(specialLiverySchema).default([]), // Challenge-only special liveries (Alpha, etc.)
  achievements: z.array(achievementSchema).default([]), // All achievements (weekly, career, event)
  weeklyAchievementsRefreshAt: z.number().optional(), // Timestamp for next weekly achievements refresh
  loanerTrains: z.array(loanerTrainSchema).default([]), // Dynamic used locomotive marketplace
  loanerTrainsRefreshAt: z.number().optional(), // Timestamp for next loaner refresh (synced with jobs)
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type Player = z.infer<typeof playerSchema>;
export type Company = z.infer<typeof companySchema>;
export type PlayerStats = z.infer<typeof playerStatsSchema>;
export type Locomotive = z.infer<typeof locomotiveSchema>;
export type NewsItem = z.infer<typeof newsItemSchema>;
export type PlayerData = z.infer<typeof playerDataSchema>;

// ============================================================================
// LOCOMOTIVE CATALOG (STATIC DATA)
// ============================================================================

export interface LocomotiveCatalogItem {
  model: string;
  manufacturer: string;
  tier: 1 | 2 | 3; // kept for backwards compatibility
  tags: ("Local / Yard" | "Long Haul")[]; // New tag system
  horsepower: number;
  topSpeed: number;
  weight: number;
  tractiveEffort: number;
  fuelCapacity: number;
  fuelEfficiency: number;
  reliability: number;
  maintenanceCost: number;
  purchaseCost: number;
  resaleValue: number;
  notes: string;
}

export const LOCOMOTIVE_CATALOG: LocomotiveCatalogItem[] = [
  // CLASSIC ERA (1950s-1970s) - TIER 1
  {
    model: "EMD GP7",
    manufacturer: "Electro-Motive Division (EMD)",
    tier: 1,
    tags: ["Local / Yard"],
    horsepower: 1500,
    topSpeed: 65,
    weight: 125,
    tractiveEffort: 56500,
    fuelCapacity: 1200,
    fuelEfficiency: 45,
    reliability: 88,
    maintenanceCost: 0.95,
    purchaseCost: 850000,
    resaleValue: 450000,
    notes: "Classic first-generation road switcher from 1949. Proven reliability but outdated technology.",
  },
  {
    model: "EMD GP9",
    manufacturer: "Electro-Motive Division (EMD)",
    tier: 1,
    tags: ["Local / Yard"],
    horsepower: 1750,
    topSpeed: 65,
    weight: 125,
    tractiveEffort: 57000,
    fuelCapacity: 1200,
    fuelEfficiency: 47,
    reliability: 90,
    maintenanceCost: 1.00,
    purchaseCost: 950000,
    resaleValue: 520000,
    notes: "Improved GP7 with better horsepower. Popular for branch line and shortline service.",
  },
  {
    model: "ALCO RS-3",
    manufacturer: "American Locomotive Company (ALCO)",
    tier: 1,
    tags: ["Local / Yard"],
    horsepower: 1600,
    topSpeed: 60,
    weight: 115,
    tractiveEffort: 54000,
    fuelCapacity: 1100,
    fuelEfficiency: 52,
    reliability: 82,
    maintenanceCost: 1.35,
    purchaseCost: 780000,
    resaleValue: 380000,
    notes: "ALCO road switcher with distinctive sound. Higher maintenance but cheaper to buy.",
  },
  {
    model: "EMD MP15DC",
    manufacturer: "Electro-Motive Division (EMD)",
    tier: 1,
    tags: ["Local / Yard"],
    horsepower: 1500,
    topSpeed: 65,
    weight: 124,
    tractiveEffort: 64500,
    fuelCapacity: 1600,
    fuelEfficiency: 38,
    reliability: 94,
    maintenanceCost: 0.90,
    purchaseCost: 1200000,
    resaleValue: 750000,
    notes: "Purpose-built switcher with excellent tractive effort for yard work.",
  },
  
  // TRANSITION ERA (1980s-1990s) - TIER 1
  {
    model: "EMD GP38-2",
    manufacturer: "Electro-Motive Division (EMD)",
    tier: 1,
    tags: ["Local / Yard"],
    horsepower: 2000,
    topSpeed: 71,
    weight: 125,
    tractiveEffort: 61000,
    fuelCapacity: 2000,
    fuelEfficiency: 48,
    reliability: 95,
    maintenanceCost: 1.15,
    purchaseCost: 1600000,
    resaleValue: 980000,
    notes: "Reliable 4-axle road switcher; ideal for shortline and local freight operations.",
  },
  {
    model: "EMD GP40-2",
    manufacturer: "Electro-Motive Division (EMD)",
    tier: 1,
    tags: ["Local / Yard", "Long Haul"],
    horsepower: 3000,
    topSpeed: 71,
    weight: 133,
    tractiveEffort: 68200,
    fuelCapacity: 2900,
    fuelEfficiency: 65,
    reliability: 94,
    maintenanceCost: 1.30,
    purchaseCost: 1850000,
    resaleValue: 1150000,
    notes: "Higher horsepower 4-axle unit. Great for branchline mainline work.",
  },
  {
    model: "EMD SW1500",
    manufacturer: "Electro-Motive Division (EMD)",
    tier: 1,
    tags: ["Local / Yard"],
    horsepower: 1500,
    topSpeed: 60,
    weight: 115,
    tractiveEffort: 58000,
    fuelCapacity: 1800,
    fuelEfficiency: 42,
    reliability: 92,
    maintenanceCost: 1.05,
    purchaseCost: 1350000,
    resaleValue: 820000,
    notes: "Versatile switcher for yard and light road work.",
  },
  {
    model: "GE B23-7",
    manufacturer: "General Electric (GE)",
    tier: 1,
    tags: ["Local / Yard", "Long Haul"],
    horsepower: 2250,
    topSpeed: 70,
    weight: 130,
    tractiveEffort: 63000,
    fuelCapacity: 2200,
    fuelEfficiency: 52,
    reliability: 89,
    maintenanceCost: 1.40,
    purchaseCost: 1700000,
    resaleValue: 1050000,
    notes: "GE's answer to EMD's GP38-2. Solid performance with typical GE ruggedness.",
  },
  {
    model: "GE B30-7",
    manufacturer: "General Electric (GE)",
    tier: 1,
    tags: ["Local / Yard", "Long Haul"],
    horsepower: 3000,
    topSpeed: 70,
    weight: 133,
    tractiveEffort: 70000,
    fuelCapacity: 2800,
    fuelEfficiency: 68,
    reliability: 90,
    maintenanceCost: 1.38,
    purchaseCost: 1950000,
    resaleValue: 1200000,
    notes: "Powerful 4-axle unit capable of mainline service.",
  },
  
  // CLASSIC 6-AXLE ERA (1970s-1980s) - TIER 2
  {
    model: "EMD SD40",
    manufacturer: "Electro-Motive Division (EMD)",
    tier: 2,
    tags: ["Long Haul"],
    horsepower: 3000,
    topSpeed: 70,
    weight: 182,
    tractiveEffort: 90000,
    fuelCapacity: 3000,
    fuelEfficiency: 70,
    reliability: 92,
    maintenanceCost: 1.35,
    purchaseCost: 2100000,
    resaleValue: 1350000,
    notes: "Original SD40 model. Predecessor to the legendary SD40-2.",
  },
  {
    model: "EMD SD40-2",
    manufacturer: "Electro-Motive Division (EMD)",
    tier: 2,
    tags: ["Long Haul"],
    horsepower: 3000,
    topSpeed: 71,
    weight: 184,
    tractiveEffort: 91000,
    fuelCapacity: 3000,
    fuelEfficiency: 68,
    reliability: 96,
    maintenanceCost: 1.28,
    purchaseCost: 2400000,
    resaleValue: 1550000,
    notes: "Legendary 6-axle workhorse; backbone of North American railroading for decades.",
  },
  {
    model: "EMD SD45",
    manufacturer: "Electro-Motive Division (EMD)",
    tier: 2,
    tags: ["Long Haul"],
    horsepower: 3600,
    topSpeed: 71,
    weight: 194,
    tractiveEffort: 96000,
    fuelCapacity: 3600,
    fuelEfficiency: 88,
    reliability: 87,
    maintenanceCost: 1.75,
    purchaseCost: 2250000,
    resaleValue: 1400000,
    notes: "Higher horsepower but temperamental 20-cylinder engine. Thirsty but powerful.",
  },
  {
    model: "GE C30-7",
    manufacturer: "General Electric (GE)",
    tier: 2,
    tags: ["Long Haul"],
    horsepower: 3000,
    topSpeed: 70,
    weight: 195,
    tractiveEffort: 93000,
    fuelCapacity: 3200,
    fuelEfficiency: 72,
    reliability: 90,
    maintenanceCost: 1.42,
    purchaseCost: 2300000,
    resaleValue: 1480000,
    notes: "GE's competitive 6-axle unit. Reliable but less popular than SD40-2.",
  },
  {
    model: "GE U30C",
    manufacturer: "General Electric (GE)",
    tier: 2,
    tags: ["Long Haul"],
    horsepower: 3000,
    topSpeed: 70,
    weight: 195,
    tractiveEffort: 88000,
    fuelCapacity: 3000,
    fuelEfficiency: 75,
    reliability: 85,
    maintenanceCost: 1.65,
    purchaseCost: 1950000,
    resaleValue: 1250000,
    notes: "Earlier GE universal series. Somewhat maintenance-intensive.",
  },
  
  // MODERN TRANSITION ERA (1990s-2000s) - TIER 2
  {
    model: "EMD GP50",
    manufacturer: "Electro-Motive Division (EMD)",
    tier: 2,
    tags: ["Long Haul"],
    horsepower: 3500,
    topSpeed: 70,
    weight: 138,
    tractiveEffort: 78000,
    fuelCapacity: 2900,
    fuelEfficiency: 75,
    reliability: 91,
    maintenanceCost: 1.48,
    purchaseCost: 2650000,
    resaleValue: 1720000,
    notes: "Powerful 4-axle with microprocessor controls. Good for intermodal service.",
  },
  {
    model: "EMD SD60",
    manufacturer: "Electro-Motive Division (EMD)",
    tier: 2,
    tags: ["Long Haul"],
    horsepower: 3800,
    topSpeed: 72,
    weight: 190,
    tractiveEffort: 103000,
    fuelCapacity: 4000,
    fuelEfficiency: 82,
    reliability: 93,
    maintenanceCost: 1.55,
    purchaseCost: 2850000,
    resaleValue: 1850000,
    notes: "Improved SD40-2 design with more power. Last of the DC traction mainstream units.",
  },
  {
    model: "GE C40-8W",
    manufacturer: "General Electric (GE)",
    tier: 2,
    tags: ["Long Haul"],
    horsepower: 4000,
    topSpeed: 70,
    weight: 207,
    tractiveEffort: 110000,
    fuelCapacity: 4200,
    fuelEfficiency: 85,
    reliability: 92,
    maintenanceCost: 1.58,
    purchaseCost: 2950000,
    resaleValue: 1920000,
    notes: "GE's 'Dash 8' series with wide cab. Transitional design before AC traction.",
  },
  
  // MODERN AC TRACTION ERA (2000s-2010s) - TIER 3
  {
    model: "EMD SD70MAC",
    manufacturer: "Electro-Motive Division (EMD)",
    tier: 3,
    tags: ["Long Haul"],
    horsepower: 4000,
    topSpeed: 75,
    weight: 210,
    tractiveEffort: 137000,
    fuelCapacity: 4000,
    fuelEfficiency: 88,
    reliability: 96,
    maintenanceCost: 1.65,
    purchaseCost: 2950000,
    resaleValue: 1920000,
    notes: "First widespread AC traction locomotive. Revolutionary for heavy-haul operations.",
  },
  {
    model: "EMD SD70ACe",
    manufacturer: "Electro-Motive Division (EMD)",
    tier: 3,
    tags: ["Long Haul"],
    horsepower: 4300,
    topSpeed: 75,
    weight: 207,
    tractiveEffort: 145000,
    fuelCapacity: 4700,
    fuelEfficiency: 90,
    reliability: 95,
    maintenanceCost: 1.72,
    purchaseCost: 3150000,
    resaleValue: 2050000,
    notes: "Enhanced SD70MAC with improved electronics and EPA Tier 2 compliance.",
  },
  {
    model: "EMD SD70M-2",
    manufacturer: "Electro-Motive Division (EMD)",
    tier: 3,
    tags: ["Long Haul"],
    horsepower: 4300,
    topSpeed: 70,
    weight: 207,
    tractiveEffort: 145000,
    fuelCapacity: 4700,
    fuelEfficiency: 92,
    reliability: 94,
    maintenanceCost: 1.70,
    purchaseCost: 3100000,
    resaleValue: 2020000,
    notes: "DC traction version of SD70ACe. Preferred by some railroads for simplicity.",
  },
  {
    model: "GE AC4400CW",
    manufacturer: "General Electric (GE)",
    tier: 3,
    tags: ["Long Haul"],
    horsepower: 4400,
    topSpeed: 70,
    weight: 212,
    tractiveEffort: 145000,
    fuelCapacity: 4200,
    fuelEfficiency: 92,
    reliability: 95,
    maintenanceCost: 1.68,
    purchaseCost: 3050000,
    resaleValue: 1980000,
    notes: "GE's most successful AC traction model. Workhorse of coal and intermodal trains.",
  },
  {
    model: "GE AC6000CW",
    manufacturer: "General Electric (GE)",
    tier: 3,
    tags: ["Long Haul"],
    horsepower: 6000,
    topSpeed: 75,
    weight: 216,
    tractiveEffort: 166000,
    fuelCapacity: 5500,
    fuelEfficiency: 118,
    reliability: 88,
    maintenanceCost: 2.15,
    purchaseCost: 3500000,
    resaleValue: 2280000,
    notes: "Most powerful single-engine diesel. Reliability issues led to many being derated.",
  },
  {
    model: "EMD SD90MAC",
    manufacturer: "Electro-Motive Division (EMD)",
    tier: 3,
    tags: ["Long Haul"],
    horsepower: 6000,
    topSpeed: 75,
    weight: 230,
    tractiveEffort: 160000,
    fuelCapacity: 5000,
    fuelEfficiency: 112,
    reliability: 86,
    maintenanceCost: 2.25,
    purchaseCost: 3600000,
    resaleValue: 2340000,
    notes: "Designed for 6000hp H-engine that never materialized. Most built with 4300hp 16-710.",
  },
  
  // LATEST GENERATION (2010s-2020s) - TIER 3
  {
    model: "GE ES44AC",
    manufacturer: "General Electric (GE)",
    tier: 3,
    tags: ["Long Haul"],
    horsepower: 4400,
    topSpeed: 70,
    weight: 213,
    tractiveEffort: 166000,
    fuelCapacity: 5000,
    fuelEfficiency: 85,
    reliability: 97,
    maintenanceCost: 1.58,
    purchaseCost: 3200000,
    resaleValue: 2080000,
    notes: "GE Evolution Series with EPA Tier 2 compliance. Excellent fuel economy and reliability.",
  },
  {
    model: "GE ET44AC",
    manufacturer: "General Electric (GE)",
    tier: 3,
    tags: ["Long Haul"],
    horsepower: 4400,
    topSpeed: 70,
    weight: 216,
    tractiveEffort: 166000,
    fuelCapacity: 5000,
    fuelEfficiency: 80,
    reliability: 96,
    maintenanceCost: 1.62,
    purchaseCost: 3350000,
    resaleValue: 2180000,
    notes: "Latest GE Evolution with EPA Tier 4 emissions. Advanced diagnostics and fuel efficiency.",
  },
  {
    model: "EMD SD70ACe-T4",
    manufacturer: "Progress Rail (EMD)",
    tier: 3,
    tags: ["Long Haul"],
    horsepower: 4500,
    topSpeed: 75,
    weight: 214,
    tractiveEffort: 152000,
    fuelCapacity: 4900,
    fuelEfficiency: 82,
    reliability: 95,
    maintenanceCost: 1.68,
    purchaseCost: 3400000,
    resaleValue: 2210000,
    notes: "EMD's Tier 4 compliant locomotive. Modern EPA-friendly design with proven AC traction.",
  },
  {
    model: "Wabtec FLXdrive",
    manufacturer: "Wabtec (GE Transportation)",
    tier: 3,
    tags: ["Long Haul"],
    horsepower: 4400,
    topSpeed: 70,
    weight: 230,
    tractiveEffort: 166000,
    fuelCapacity: 0, // Battery electric
    fuelEfficiency: 15, // kWh equivalent representation
    reliability: 92,
    maintenanceCost: 0.95,
    purchaseCost: 5500000,
    resaleValue: 3575000,
    notes: "Battery-electric locomotive. Zero emissions, lower operating costs, but high upfront price.",
  },
];

// ============================================================================
// US CITIES (for company creation)
// ============================================================================

export const US_CITIES = [
  "Atlanta, GA",
  "Baltimore, MD",
  "Birmingham, AL",
  "Boston, MA",
  "Buffalo, NY",
  "Charlotte, NC",
  "Chicago, IL",
  "Cincinnati, OH",
  "Cleveland, OH",
  "Columbus, OH",
  "Dallas, TX",
  "Denver, CO",
  "Detroit, MI",
  "Houston, TX",
  "Indianapolis, IN",
  "Jacksonville, FL",
  "Kansas City, MO",
  "Los Angeles, CA",
  "Louisville, KY",
  "Memphis, TN",
  "Miami, FL",
  "Milwaukee, WI",
  "Minneapolis, MN",
  "Nashville, TN",
  "New Orleans, LA",
  "New York, NY",
  "Norfolk, VA",
  "Oakland, CA",
  "Oklahoma City, OK",
  "Omaha, NE",
  "Philadelphia, PA",
  "Phoenix, AZ",
  "Pittsburgh, PA",
  "Portland, OR",
  "Raleigh, NC",
  "Richmond, VA",
  "Sacramento, CA",
  "Salt Lake City, UT",
  "San Antonio, TX",
  "San Diego, CA",
  "San Francisco, CA",
  "Seattle, WA",
  "St. Louis, MO",
  "Tampa, FL",
  "Washington, DC",
];

// ============================================================================
// XP & LEVEL SYSTEM
// ============================================================================

export const XP_PER_LEVEL = [
  0, 200, 450, 750, 1100, 1500, 1950, 2450, 3000, 3600, // Levels 1-10
  4250, 5000, 5800, 6700, 7700, 8800, 10000, 11300, 12700, 14200, // Levels 11-20
];

export function calculateLevel(xp: number): number {
  for (let i = XP_PER_LEVEL.length - 1; i >= 0; i--) {
    if (xp >= XP_PER_LEVEL[i]) {
      return i + 1;
    }
  }
  return 1;
}

export function getXpForNextLevel(currentLevel: number): number {
  if (currentLevel >= XP_PER_LEVEL.length) {
    return XP_PER_LEVEL[XP_PER_LEVEL.length - 1] + (currentLevel - XP_PER_LEVEL.length + 1) * 2000;
  }
  return XP_PER_LEVEL[currentLevel];
}

export function getUnlocksForLevel(level: number): string[] {
  const unlocks: string[] = [];
  if (level === 10) unlocks.push("Mainline Freight Jobs");
  if (level === 50) unlocks.push("Special Freight Jobs");
  return unlocks;
}

// ============================================================================
// LOCOMOTIVE DEGRADATION SYSTEM
// ============================================================================

export const DEGRADATION_THRESHOLDS = {
  MINOR_REPAIR_MILES: 200000, // Start showing wear after 200K miles
  MAJOR_REPAIR_MILES: 500000, // Needs major repairs after 500K miles
  SCRAP_CONSIDERATION_MILES: 1000000, // Consider scrapping after 1M miles
  HEALTH_DEGRADATION_RATE: 0.00001, // Health reduces by 1% per 10K miles
};

export function calculateLocomotiveHealth(mileage: number, baseReliability: number): number {
  // Calculate health based on mileage
  // Locomotives lose health gradually, but very slowly
  const mileagePenalty = mileage * DEGRADATION_THRESHOLDS.HEALTH_DEGRADATION_RATE;
  const health = Math.max(0, Math.min(100, 100 - mileagePenalty));
  return Math.round(health);
}

export function getLocomotiveConditionStatus(mileage: number, health: number): {
  status: "excellent" | "good" | "fair" | "needs_minor_repair" | "needs_major_repair" | "critical";
  label: string;
} {
  if (health >= 90 && mileage < DEGRADATION_THRESHOLDS.MINOR_REPAIR_MILES) {
    return { status: "excellent", label: "Excellent Condition" };
  } else if (health >= 75) {
    return { status: "good", label: "Good Condition" };
  } else if (health >= 50) {
    return { status: "fair", label: "Fair Condition" };
  } else if (health >= 30) {
    return { status: "needs_minor_repair", label: "Needs Minor Repair" };
  } else if (health >= 10) {
    return { status: "needs_major_repair", label: "Needs Major Repair" };
  } else {
    return { status: "critical", label: "Critical - Consider Scrapping" };
  }
}

// ============================================================================
// USED LOCOMOTIVE MARKET
// ============================================================================

const FICTIONAL_RAILROAD_NAMES = [
  "Burlington Northern",
  "Chesapeake Western",
  "Dakota Plains Railway",
  "Eastern Mountain Lines",
  "Great Lakes Transportation",
  "Midwest Freight Co.",
  "Northern Pacific Lines",
  "Pacific Coast Rail",
  "Rocky Mountain Rail",
  "Southern Freight Lines",
  "Texas & Western",
  "Union Central Railroad",
];

export interface UsedLocomotiveItem extends LocomotiveCatalogItem {
  usedPrice: number;
  mileage: number;
  health: number;
  previousOwner: string;
  needsRepair: boolean;
}

export function generateUsedLocomotive(catalogItem: LocomotiveCatalogItem): UsedLocomotiveItem {
  const mileage = Math.floor(Math.random() * 600000) + 400000;
  const health = calculateLocomotiveHealth(mileage, catalogItem.reliability);
  const needsRepair = health < 60;
  const depreciation = 0.25 + (mileage / 1000000) * 0.35;
  const usedPrice = Math.floor(catalogItem.purchaseCost * (1 - depreciation));
  const previousOwner = FICTIONAL_RAILROAD_NAMES[Math.floor(Math.random() * FICTIONAL_RAILROAD_NAMES.length)];
  
  return {
    ...catalogItem,
    usedPrice,
    mileage,
    health,
    previousOwner,
    needsRepair,
  };
}

// Railroad company paint schemes for loaner trains
const RAILROAD_PAINT_SCHEMES = [
  { primaryColor: "#1e3a8a", secondaryColor: "#fbbf24" }, // Blue & Gold
  { primaryColor: "#7f1d1d", secondaryColor: "#d1d5db" }, // Maroon & Silver
  { primaryColor: "#14532d", secondaryColor: "#fef3c7" }, // Dark Green & Cream
  { primaryColor: "#78350f", secondaryColor: "#fef08a" }, // Brown & Yellow
  { primaryColor: "#991b1b", secondaryColor: "#f3f4f6" }, // Red & Light Gray
  { primaryColor: "#1e40af", secondaryColor: "#fca5a5" }, // Royal Blue & Light Red
  { primaryColor: "#064e3b", secondaryColor: "#fed7aa" }, // Forest Green & Peach
  { primaryColor: "#6b21a8", secondaryColor: "#fde047" }, // Purple & Yellow
  { primaryColor: "#92400e", secondaryColor: "#e5e7eb" }, // Burnt Orange & Gray
  { primaryColor: "#047857", secondaryColor: "#fef9c3" }, // Emerald & Light Yellow
];

export function generateLoanerTrain(catalogItem: LocomotiveCatalogItem): LoanerTrain {
  // Generate mileage based on era (older trains have more miles)
  const baseYear = catalogItem.model.includes("GP7") || catalogItem.model.includes("GP9") || catalogItem.model.includes("ALCO") ? 1960 : 
                   catalogItem.model.includes("SD40") || catalogItem.model.includes("GP38") || catalogItem.model.includes("SW") ? 1980 :
                   catalogItem.model.includes("ES44") || catalogItem.model.includes("ET44") || catalogItem.model.includes("T4") ? 2015 : 1995;
  
  const age = 2025 - baseYear;
  const avgMilesPerYear = 30000 + Math.random() * 40000; // 30K-70K miles per year
  const baseMileage = age * avgMilesPerYear;
  const mileage = Math.floor(baseMileage * (0.7 + Math.random() * 0.6)); // ±30% variation
  
  // Calculate health based on mileage
  const health = calculateLocomotiveHealth(mileage, catalogItem.reliability);
  
  // Paint condition degrades faster than mechanical health
  const paintCondition = Math.max(20, Math.min(100, health - Math.random() * 30));
  
  // Price based on condition
  const healthFactor = health / 100;
  const paintFactor = paintCondition / 100;
  const depreciation = 0.20 + ((100 - health) / 100) * 0.45; // 20-65% off based on health
  const usedPrice = Math.floor(catalogItem.resaleValue * (1 - depreciation));
  
  // Random previous owner and paint scheme
  const previousOwner = FICTIONAL_RAILROAD_NAMES[Math.floor(Math.random() * FICTIONAL_RAILROAD_NAMES.length)];
  const previousOwnerColors = RAILROAD_PAINT_SCHEMES[Math.floor(Math.random() * RAILROAD_PAINT_SCHEMES.length)];
  
  return {
    id: generateUUID(),
    catalogItem,
    usedPrice,
    mileage,
    health: Math.round(health),
    paintCondition: Math.round(paintCondition),
    previousOwner,
    previousOwnerColors,
  };
}

// Generate 2-7 random loaner trains from catalog
export function generateLoanerTrainMarket(count?: number): LoanerTrain[] {
  const numTrains = count || (Math.floor(Math.random() * 6) + 2); // 2-7 trains
  const loanerTrains: LoanerTrain[] = [];
  
  // Randomly select locomotives from catalog
  const availableCatalog = [...LOCOMOTIVE_CATALOG];
  
  for (let i = 0; i < numTrains && availableCatalog.length > 0; i++) {
    const randomIndex = Math.floor(Math.random() * availableCatalog.length);
    const catalogItem = availableCatalog.splice(randomIndex, 1)[0];
    loanerTrains.push(generateLoanerTrain(catalogItem));
  }
  
  // Sort by price (cheapest first)
  return loanerTrains.sort((a, b) => a.usedPrice - b.usedPrice);
}

// ============================================================================
// ACHIEVEMENT GENERATION
// ============================================================================

// Weekly Achievements (10 challenges, resets every Friday @ 12 PM)
export function generateWeeklyAchievements(): Achievement[] {
  const now = Date.now();
  const nextFriday = getNextFriday();
  
  const weeklyTasks: Omit<Achievement, 'id' | 'createdAt'>[] = [
    {
      type: "weekly",
      title: "Intermodal Specialist",
      description: "Complete 5 Intermodal Jobs",
      requirement: "complete_intermodal_jobs",
      targetValue: 5,
      currentProgress: 0,
      isCompleted: false,
      rewards: { cash: 7500, points: 5, xp: 500 },
      expiresAt: nextFriday,
    },
    {
      type: "weekly",
      title: "Local Hero",
      description: "Complete 15 Local Freight Jobs",
      requirement: "complete_local_freight_jobs",
      targetValue: 15,
      currentProgress: 0,
      isCompleted: false,
      rewards: { cash: 10000, points: 0, xp: 1000 },
      expiresAt: nextFriday,
    },
    {
      type: "weekly",
      title: "Mainline Master",
      description: "Complete 5 Mainline Jobs",
      requirement: "complete_mainline_jobs",
      targetValue: 5,
      currentProgress: 0,
      isCompleted: false,
      rewards: { cash: 15000, points: 0, xp: 800 },
      expiresAt: nextFriday,
    },
    {
      type: "weekly",
      title: "Coal Runner",
      description: "Complete 3 Coal Jobs",
      requirement: "complete_coal_jobs",
      targetValue: 3,
      currentProgress: 0,
      isCompleted: false,
      rewards: { cash: 8000, points: 3, xp: 0 },
      expiresAt: nextFriday,
    },
    {
      type: "weekly",
      title: "Chemical Hauler",
      description: "Complete 2 Chemical Jobs",
      requirement: "complete_chemical_jobs",
      targetValue: 2,
      currentProgress: 0,
      isCompleted: false,
      rewards: { cash: 12000, points: 5, xp: 600 },
      expiresAt: nextFriday,
    },
    {
      type: "weekly",
      title: "Quick Turnaround",
      description: "Complete 10 Jobs in total",
      requirement: "complete_total_jobs",
      targetValue: 10,
      currentProgress: 0,
      isCompleted: false,
      rewards: { cash: 20000, points: 10, xp: 1500 },
      expiresAt: nextFriday,
    },
    {
      type: "weekly",
      title: "Distance Driver",
      description: "Complete jobs totaling 500 miles",
      requirement: "complete_miles_total",
      targetValue: 500,
      currentProgress: 0,
      isCompleted: false,
      rewards: { cash: 15000, points: 8, xp: 0 },
      expiresAt: nextFriday,
    },
    {
      type: "weekly",
      title: "Grain Hauler",
      description: "Complete 4 Grain Jobs",
      requirement: "complete_grain_jobs",
      targetValue: 4,
      currentProgress: 0,
      isCompleted: false,
      rewards: { cash: 9000, points: 4, xp: 400 },
      expiresAt: nextFriday,
    },
    {
      type: "weekly",
      title: "Yard Master",
      description: "Complete 8 Yard Switching Jobs",
      requirement: "complete_yard_switching_jobs",
      targetValue: 8,
      currentProgress: 0,
      isCompleted: false,
      rewards: { cash: 6000, points: 3, xp: 0 },
      expiresAt: nextFriday,
    },
    {
      type: "weekly",
      title: "Big Week",
      description: "Complete 25 Jobs this week",
      requirement: "complete_total_jobs",
      targetValue: 25,
      currentProgress: 0,
      isCompleted: false,
      rewards: { cash: 50000, points: 25, xp: 2500 },
      expiresAt: nextFriday,
    },
  ];
  
  return weeklyTasks.map(task => ({
    ...task,
    id: generateUUID(),
    createdAt: now,
  }));
}

// Career Achievements (20+ permanent milestones)
export function generateCareerAchievements(): Achievement[] {
  const now = Date.now();
  
  const careerMilestones: Omit<Achievement, 'id' | 'createdAt'>[] = [
    {
      type: "career",
      title: "Getting Started",
      description: "Complete your first job",
      requirement: "total_jobs_completed",
      targetValue: 1,
      currentProgress: 0,
      isCompleted: false,
      rewards: { cash: 5000, points: 5, xp: 500 },
    },
    {
      type: "career",
      title: "Small Business",
      description: "Have $100,000 or more in your account",
      requirement: "cash_balance",
      targetValue: 100000,
      currentProgress: 0,
      isCompleted: false,
      rewards: { cash: 0, points: 10, xp: 1000 },
    },
    {
      type: "career",
      title: "Millionaire",
      description: "Have $1,000,000 or more in your account",
      requirement: "cash_balance",
      targetValue: 1000000,
      currentProgress: 0,
      isCompleted: false,
      rewards: { cash: 0, points: 50, xp: 5000 },
    },
    {
      type: "career",
      title: "Tycoon",
      description: "Have $10,000,000 or more in your account",
      requirement: "cash_balance",
      targetValue: 10000000,
      currentProgress: 0,
      isCompleted: false,
      rewards: { cash: 0, points: 250, xp: 10000 },
    },
    {
      type: "career",
      title: "Veteran Railroader",
      description: "Complete 100 jobs total",
      requirement: "total_jobs_completed",
      targetValue: 100,
      currentProgress: 0,
      isCompleted: false,
      rewards: { cash: 100000, points: 50, xp: 8000 },
    },
    {
      type: "career",
      title: "Master Railroader",
      description: "Complete 500 jobs total",
      requirement: "total_jobs_completed",
      targetValue: 500,
      currentProgress: 0,
      isCompleted: false,
      rewards: { cash: 500000, points: 150, xp: 20000 },
    },
    {
      type: "career",
      title: "Legendary Railroader",
      description: "Complete 1000 jobs total",
      requirement: "total_jobs_completed",
      targetValue: 1000,
      currentProgress: 0,
      isCompleted: false,
      rewards: { cash: 1000000, points: 300, xp: 50000 },
    },
    {
      type: "career",
      title: "Small Fleet",
      description: "Own 5 locomotives",
      requirement: "locomotives_owned",
      targetValue: 5,
      currentProgress: 0,
      isCompleted: false,
      rewards: { cash: 50000, points: 20, xp: 2000 },
    },
    {
      type: "career",
      title: "Large Fleet",
      description: "Own 10 locomotives",
      requirement: "locomotives_owned",
      targetValue: 10,
      currentProgress: 0,
      isCompleted: false,
      rewards: { cash: 100000, points: 50, xp: 5000 },
    },
    {
      type: "career",
      title: "Mega Fleet",
      description: "Own 25 locomotives",
      requirement: "locomotives_owned",
      targetValue: 25,
      currentProgress: 0,
      isCompleted: false,
      rewards: { cash: 250000, points: 100, xp: 15000 },
    },
    {
      type: "career",
      title: "Rising Star",
      description: "Reach level 10",
      requirement: "player_level",
      targetValue: 10,
      currentProgress: 0,
      isCompleted: false,
      rewards: { cash: 25000, points: 15, xp: 0 },
    },
    {
      type: "career",
      title: "Expert",
      description: "Reach level 25",
      requirement: "player_level",
      targetValue: 25,
      currentProgress: 0,
      isCompleted: false,
      rewards: { cash: 100000, points: 50, xp: 0 },
    },
    {
      type: "career",
      title: "Legend",
      description: "Reach level 50",
      requirement: "player_level",
      targetValue: 50,
      currentProgress: 0,
      isCompleted: false,
      rewards: { cash: 500000, points: 200, xp: 0 },
    },
    {
      type: "career",
      title: "Road Warrior",
      description: "Complete 100 Mainline Freight Jobs",
      requirement: "complete_mainline_freight_jobs",
      targetValue: 100,
      currentProgress: 0,
      isCompleted: false,
      rewards: { cash: 150000, points: 60, xp: 10000 },
    },
    {
      type: "career",
      title: "Intermodal Expert",
      description: "Complete 50 Intermodal Jobs",
      requirement: "complete_intermodal_jobs",
      targetValue: 50,
      currentProgress: 0,
      isCompleted: false,
      rewards: { cash: 100000, points: 50, xp: 8000 },
    },
    {
      type: "career",
      title: "Distance Champion",
      description: "Travel 10,000 miles total",
      requirement: "total_miles_traveled",
      targetValue: 10000,
      currentProgress: 0,
      isCompleted: false,
      rewards: { cash: 200000, points: 75, xp: 12000 },
    },
    {
      type: "career",
      title: "Paint Collector",
      description: "Own 10 custom paint schemes",
      requirement: "paint_schemes_owned",
      targetValue: 10,
      currentProgress: 0,
      isCompleted: false,
      rewards: { cash: 50000, points: 30, xp: 0 },
    },
    {
      type: "career",
      title: "Heritage Hunter",
      description: "Purchase 1 Heritage Paint Scheme",
      requirement: "heritage_schemes_owned",
      targetValue: 1,
      currentProgress: 0,
      isCompleted: false,
      rewards: { cash: 100000, points: 50, xp: 0 },
    },
    {
      type: "career",
      title: "Coal Baron",
      description: "Complete 50 Coal Jobs",
      requirement: "complete_coal_jobs",
      targetValue: 50,
      currentProgress: 0,
      isCompleted: false,
      rewards: { cash: 100000, points: 40, xp: 7000 },
    },
    {
      type: "career",
      title: "Chemical Specialist",
      description: "Complete 30 Chemical Jobs",
      requirement: "complete_chemical_jobs",
      targetValue: 30,
      currentProgress: 0,
      isCompleted: false,
      rewards: { cash: 120000, points: 50, xp: 8000 },
    },
  ];
  
  return careerMilestones.map(milestone => ({
    ...milestone,
    id: generateUUID(),
    createdAt: now,
  }));
}

// Event Achievements (Alpha Challenge for testers)
export function generateEventAchievements(): Achievement[] {
  const now = Date.now();
  const alphaEndDate = new Date('2025-12-01T12:00:00').getTime();
  
  const eventChallenges: Omit<Achievement, 'id' | 'createdAt'>[] = [
    {
      type: "event",
      title: "Alpha Tester - First Steps",
      description: "Complete 5 Intermodal Jobs during alpha testing",
      requirement: "complete_intermodal_jobs",
      targetValue: 5,
      currentProgress: 0,
      isCompleted: false,
      rewards: { cash: 7500, points: 5, xp: 500 },
      expiresAt: alphaEndDate,
    },
    {
      type: "event",
      title: "Alpha Tester - Local Expert",
      description: "Complete 15 Local Freight Jobs during alpha testing",
      requirement: "complete_local_freight_jobs",
      targetValue: 15,
      currentProgress: 0,
      isCompleted: false,
      rewards: { cash: 10000, points: 0, xp: 1000 },
      expiresAt: alphaEndDate,
    },
    {
      type: "event",
      title: "Alpha Tester - Mainline Pro",
      description: "Complete 5 Mainline Jobs during alpha testing",
      requirement: "complete_mainline_jobs",
      targetValue: 5,
      currentProgress: 0,
      isCompleted: false,
      rewards: { cash: 15000, points: 0, xp: 800 },
      expiresAt: alphaEndDate,
    },
    {
      type: "event",
      title: "ALPHA CHALLENGE",
      description: "Complete 250 Total Jobs during alpha testing to earn massive rewards!",
      requirement: "total_jobs_completed",
      targetValue: 250,
      currentProgress: 0,
      isCompleted: false,
      rewards: { cash: 500000, points: 200, xp: 50000 },
      expiresAt: alphaEndDate,
    },
  ];
  
  return eventChallenges.map(challenge => ({
    ...challenge,
    id: generateUUID(),
    createdAt: now,
  }));
}

// Helper function to get next Friday at 12 PM
export function getNextFriday(): number {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7; // 5 = Friday
  const nextFriday = new Date(now);
  nextFriday.setDate(now.getDate() + daysUntilFriday);
  nextFriday.setHours(12, 0, 0, 0);
  return nextFriday.getTime();
}

// Check if weekly achievements need to be refreshed
export function shouldRefreshWeeklyAchievements(refreshAt?: number): boolean {
  if (!refreshAt) return true;
  return Date.now() >= refreshAt;
}
