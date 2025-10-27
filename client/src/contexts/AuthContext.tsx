import { createContext, useContext, useEffect, useState } from "react";
import {
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from "firebase/auth";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { getAuthOrThrow, getGoogleProviderOrThrow, getDbOrThrow, firebaseConfigured, safeUpdateDoc } from "@/lib/firebase";
import type { PlayerData, Achievement } from "@shared/schema";
import { generateWeeklyAchievements, generateCareerAchievements, generateEventAchievements, SPECIAL_LIVERIES_CATALOG, getNextFriday, shouldRefreshWeeklyAchievements } from "@shared/schema";

interface AuthContextType {
  user: FirebaseUser | null;
  playerData: PlayerData | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshPlayerData: () => Promise<PlayerData | null>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

// Normalize PlayerData to ensure all fields exist with proper defaults
// CRITICAL: Only provide defaults for truly missing fields - never overwrite existing values
function normalizePlayerData(data: Partial<PlayerData>, userId: string): PlayerData {
  const now = Date.now();
  
  // Deep merge stats to preserve all existing Firebase values
  const defaultStats = {
    cash: 500000,
    xp: 0,
    level: 1,
    nextLocoId: 2,
    points: 10,
    totalJobsCompleted: 0,
  };
  
  const mergedStats = data.stats ? {
    cash: data.stats.cash !== undefined ? data.stats.cash : defaultStats.cash,
    xp: data.stats.xp !== undefined ? data.stats.xp : defaultStats.xp,
    level: data.stats.level !== undefined ? data.stats.level : defaultStats.level,
    nextLocoId: data.stats.nextLocoId !== undefined ? data.stats.nextLocoId : defaultStats.nextLocoId,
    points: data.stats.points !== undefined ? data.stats.points : defaultStats.points,
    totalJobsCompleted: data.stats.totalJobsCompleted !== undefined ? data.stats.totalJobsCompleted : defaultStats.totalJobsCompleted,
  } : defaultStats;
  
  return {
    player: data.player || {
      id: userId,
      email: "",
      displayName: "Player",
      createdAt: now,
    },
    company: data.company,
    stats: mergedStats,
    locomotives: data.locomotives || [],
    jobs: data.jobs || [],
    paintSchemes: data.paintSchemes || [],
    specialLiveries: (() => {
      const legacyHeritage = (data as any).heritagePaintSchemes;
      const legacyAlpha = legacyHeritage?.find((s: any) => s.id === "alpha_livery");
      
      if (data.specialLiveries) {
        if (legacyAlpha?.isPurchased) {
          return data.specialLiveries.map((s: any) => 
            s.id === "alpha_livery" && !s.isUnlocked
              ? { ...s, isUnlocked: true, appliedToLocoId: legacyAlpha.appliedToLocoId, unlockedAt: legacyAlpha.createdAt }
              : s
          );
        }
        return data.specialLiveries;
      }
      
      return SPECIAL_LIVERIES_CATALOG.map(livery => ({
        ...livery,
        isUnlocked: livery.id === "alpha_livery" && legacyAlpha?.isPurchased ? true : false,
        appliedToLocoId: livery.id === "alpha_livery" ? legacyAlpha?.appliedToLocoId : undefined,
        unlockedAt: livery.id === "alpha_livery" ? legacyAlpha?.createdAt : undefined,
      }));
    })(),
    achievements: data.achievements || [
      ...generateWeeklyAchievements(),
      ...generateCareerAchievements(),
      ...generateEventAchievements(),
    ],
    weeklyAchievementsRefreshAt: data.weeklyAchievementsRefreshAt ?? getNextFriday(),
    loanerTrains: data.loanerTrains || [],
    loanerTrainsRefreshAt: data.loanerTrainsRefreshAt,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [playerData, setPlayerData] = useState<PlayerData | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshPlayerData = async (): Promise<PlayerData | null> => {
    // Real-time sync is handled by onSnapshot, this is just for manual refresh if needed
    if (!firebaseConfigured) return null;
    if (user) {
      const db = getDbOrThrow();
      const docRef = doc(db, "players", user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const rawData = docSnap.data();
        const normalizedData = normalizePlayerData(rawData, user.uid);
        setPlayerData(normalizedData);
        return normalizedData;
      }
    }
    return null;
  };

  useEffect(() => {
    if (!firebaseConfigured) {
      setLoading(false);
      return;
    }

    const auth = getAuthOrThrow();
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Real-time sync: Subscribe to player document changes
  useEffect(() => {
    if (!firebaseConfigured) return;
    if (!user) {
      setPlayerData(null);
      return;
    }

    const db = getDbOrThrow();
    const docRef = doc(db, "players", user.uid);
    const unsubscribe = onSnapshot(docRef, async (docSnap) => {
      if (docSnap.exists()) {
        const rawData = docSnap.data();
        const normalizedData = normalizePlayerData(rawData, user.uid);
        
        const needsStatsUpdate = !rawData.stats || 
          rawData.stats.cash === undefined ||
          rawData.stats.xp === undefined ||
          rawData.stats.level === undefined ||
          rawData.stats.nextLocoId === undefined ||
          rawData.stats.points === undefined ||
          rawData.stats.totalJobsCompleted === undefined;

        if (needsStatsUpdate) {
          try {
            await safeUpdateDoc(docRef, {
              stats: normalizedData.stats,
            });
          } catch (error) {
            console.error("Failed to update missing stats:", error);
          }
        }
        
        setPlayerData(normalizedData);
      } else {
        setPlayerData(null);
      }
    });

    return unsubscribe;
  }, [user]);

  const signInWithGoogle = async () => {
    if (!firebaseConfigured) {
      throw new Error("Firebase is not configured. Please contact support.");
    }

    try {
      const auth = getAuthOrThrow();
      const googleProvider = getGoogleProviderOrThrow();
      const db = getDbOrThrow();
      
      const result = await signInWithPopup(auth, googleProvider);
      const userDoc = doc(db, "players", result.user.uid);
      const userSnap = await getDoc(userDoc);

      if (!userSnap.exists()) {
        // Create initial player document
        const now = Date.now();
        const initialData: PlayerData = {
          player: {
            id: result.user.uid,
            email: result.user.email!,
            displayName: result.user.displayName!,
            photoURL: result.user.photoURL || undefined,
            createdAt: now,
          },
          stats: {
            cash: 500000,
            xp: 0,
            level: 1,
            nextLocoId: 2,
            points: 10, // Starting points
            totalJobsCompleted: 0,
          },
          locomotives: [],
          jobs: [],
          paintSchemes: [],
          specialLiveries: SPECIAL_LIVERIES_CATALOG.map(livery => ({
            ...livery,
            isUnlocked: false,
          })),
          achievements: [
            ...generateWeeklyAchievements(),
            ...generateCareerAchievements(),
            ...generateEventAchievements(),
          ],
          weeklyAchievementsRefreshAt: getNextFriday(),
          loanerTrains: [],
          loanerTrainsRefreshAt: undefined,
        };

        await setDoc(userDoc, initialData);
        setPlayerData(initialData);
      }
    } catch (error) {
      console.error("Error signing in with Google:", error);
      throw error;
    }
  };

  const signOut = async () => {
    if (!firebaseConfigured) return;
    
    try {
      const auth = getAuthOrThrow();
      await firebaseSignOut(auth);
      setPlayerData(null);
    } catch (error) {
      console.error("Error signing out:", error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        playerData,
        loading,
        signInWithGoogle,
        signOut,
        refreshPlayerData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
