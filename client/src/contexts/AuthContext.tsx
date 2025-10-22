import { createContext, useContext, useEffect, useState } from "react";
import {
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from "firebase/auth";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { getAuthOrThrow, getGoogleProviderOrThrow, getDbOrThrow, firebaseConfigured } from "@/lib/firebase";
import type { PlayerData, Achievement } from "@shared/schema";
import { generateWeeklyAchievements, generateCareerAchievements, generateEventAchievements, HERITAGE_PAINT_SCHEMES_CATALOG, getNextFriday, shouldRefreshWeeklyAchievements } from "@shared/schema";

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
        const data = docSnap.data() as PlayerData;
        setPlayerData(data);
        return data;
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
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setPlayerData(docSnap.data() as PlayerData);
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
          heritagePaintSchemes: HERITAGE_PAINT_SCHEMES_CATALOG.map(scheme => ({
            ...scheme,
            createdAt: now,
            isPurchased: false,
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
