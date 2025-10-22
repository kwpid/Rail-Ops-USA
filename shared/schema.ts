import { z } from "zod";

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
  createdAt: z.number(),
});

export const playerStatsSchema = z.object({
  cash: z.number().default(500000),
  xp: z.number().default(0),
  level: z.number().default(1),
  nextLocoId: z.number().default(2), // starts at 2 since starter loco is #0001
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
  status: z.enum(["available", "assigned", "needs_repair", "in_paint_shop", "stored"]).default("available"),
  assignedJobId: z.string().optional(),
  purchasedAt: z.number(),
  notes: z.string().optional(),
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
  DOWNTIME_MINUTES: 10, // 10 minutes out of service
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

export const playerDataSchema = z.object({
  player: playerSchema,
  company: companySchema.optional(),
  stats: playerStatsSchema,
  locomotives: z.array(locomotiveSchema).default([]),
  jobs: z.array(jobSchema).default([]),
  marketData: marketDataSchema.optional(), // supply/demand tracking
  paintSchemes: z.array(paintSchemeSchema).default([]), // custom paint schemes
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
  // TIER 1: LOCAL FREIGHT
  {
    model: "EMD GP38-2",
    manufacturer: "Electro-Motive Division (EMD)",
    tier: 1,
    tags: ["Local / Yard"],
    horsepower: 2000,
    topSpeed: 65,
    weight: 125,
    tractiveEffort: 61000,
    fuelCapacity: 2000,
    fuelEfficiency: 48,
    reliability: 95,
    maintenanceCost: 1.15,
    purchaseCost: 250000,
    resaleValue: 180000,
    notes: "Reliable 4-axle road switcher; ideal for shortline and local freight operations.",
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
    purchaseCost: 220000,
    resaleValue: 160000,
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
    reliability: 90,
    maintenanceCost: 1.25,
    purchaseCost: 275000,
    resaleValue: 195000,
    notes: "Powerful 4-axle unit with good fuel economy.",
  },
  
  // TIER 2: MAINLINE FREIGHT
  {
    model: "EMD SD40-2",
    manufacturer: "Electro-Motive Division (EMD)",
    tier: 2,
    tags: ["Long Haul"],
    horsepower: 3000,
    topSpeed: 70,
    weight: 185,
    tractiveEffort: 83000,
    fuelCapacity: 3000,
    fuelEfficiency: 68,
    reliability: 94,
    maintenanceCost: 1.45,
    purchaseCost: 450000,
    resaleValue: 320000,
    notes: "Legendary 6-axle workhorse; backbone of mainline freight.",
  },
  {
    model: "GE C30-7",
    manufacturer: "General Electric (GE)",
    tier: 2,
    tags: ["Long Haul"],
    horsepower: 3000,
    topSpeed: 70,
    weight: 195,
    tractiveEffort: 85000,
    fuelCapacity: 3200,
    fuelEfficiency: 70,
    reliability: 91,
    maintenanceCost: 1.50,
    purchaseCost: 475000,
    resaleValue: 335000,
    notes: "Heavy-duty 6-axle unit for demanding mainline service.",
  },
  {
    model: "EMD GP50",
    manufacturer: "Electro-Motive Division (EMD)",
    tier: 2,
    tags: ["Long Haul"],
    horsepower: 3500,
    topSpeed: 75,
    weight: 145,
    tractiveEffort: 70000,
    fuelCapacity: 2800,
    fuelEfficiency: 72,
    reliability: 88,
    maintenanceCost: 1.55,
    purchaseCost: 500000,
    resaleValue: 360000,
    notes: "High-horsepower 4-axle for fast mainline work.",
  },
  
  // TIER 3: SPECIAL FREIGHT
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
    maintenanceCost: 1.80,
    purchaseCost: 750000,
    resaleValue: 540000,
    notes: "Modern AC traction locomotive for heavy-haul operations.",
  },
  {
    model: "GE AC4400CW",
    manufacturer: "General Electric (GE)",
    tier: 3,
    tags: ["Long Haul"],
    horsepower: 4400,
    topSpeed: 75,
    weight: 215,
    tractiveEffort: 145000,
    fuelCapacity: 4200,
    fuelEfficiency: 92,
    reliability: 95,
    maintenanceCost: 1.85,
    purchaseCost: 800000,
    resaleValue: 575000,
    notes: "Powerful AC traction unit for coal and intermodal trains.",
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
    fuelEfficiency: 105,
    reliability: 93,
    maintenanceCost: 2.10,
    purchaseCost: 1200000,
    resaleValue: 860000,
    notes: "Ultimate heavy-haul locomotive with exceptional tractive effort.",
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
  0, 1000, 2500, 4500, 7000, 10000, 13500, 17500, 22000, 27000, // Levels 1-10
  35000, 44000, 54000, 65000, 77000, 90000, 104000, 119000, 135000, 152000, // Levels 11-20
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
    return XP_PER_LEVEL[XP_PER_LEVEL.length - 1] + (currentLevel - XP_PER_LEVEL.length + 1) * 20000;
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
