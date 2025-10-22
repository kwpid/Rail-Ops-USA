/**
 * Seed Script: Populate News Collection
 * 
 * This script seeds the Firestore 'news' collection with initial news items.
 * Run this once to populate the news feed with default content.
 * 
 * Usage:
 * 1. Ensure Firebase credentials are configured
 * 2. Run: tsx scripts/seed-news.ts
 */

import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc } from "firebase/firestore";

const firebaseConfig = {
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
  apiKey: process.env.VITE_FIREBASE_API_KEY,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const NEWS_ITEMS = [
  {
    id: "welcome-2025-01-15",
    date: new Date("2025-01-15").getTime(),
    title: "Welcome to Rail Ops: USA",
    description: "Build your railroad empire from the ground up! Start with a single locomotive and $500,000 in capital. Haul freight across America, upgrade your fleet, and expand your operations.",
  },
  {
    id: "tier-system-2025-01-10",
    date: new Date("2025-01-10").getTime(),
    title: "Tier System Introduced",
    description: "Jobs are now organized into three tiers: Local Freight (unlocked), Mainline Freight (Level 10+), and Special Freight (Level 50+). Each tier offers bigger payouts and more challenging routes.",
  },
  {
    id: "customization-2025-01-05",
    date: new Date("2025-01-05").getTime(),
    title: "Locomotive Customization",
    description: "Customize your locomotives! Change unit numbers for $10,000. Make sure each ID is unique across your fleet. Future updates will include livery customization options.",
  },
  {
    id: "launch-2025-01-01",
    date: new Date("2025-01-01").getTime(),
    title: "Game Launch",
    description: "Rail Ops: USA is now live! Experience authentic railroad management with detailed locomotive stats, realistic freight jobs, and a comprehensive leveling system. Good luck, railroader!",
  },
];

async function seedNews() {
  console.log("🚂 Seeding news collection...");

  try {
    for (const item of NEWS_ITEMS) {
      const newsRef = doc(db, "news", item.id);
      await setDoc(newsRef, {
        title: item.title,
        description: item.description,
        date: item.date,
      });
      console.log(`✅ Added: ${item.title}`);
    }

    console.log("\n🎉 News seeding complete!");
    console.log(`📰 Added ${NEWS_ITEMS.length} news items`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding news:", error);
    process.exit(1);
  }
}

seedNews();
