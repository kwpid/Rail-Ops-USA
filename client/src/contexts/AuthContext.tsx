import { createContext, useContext, useEffect, useState } from "react";
import {
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from "firebase/auth";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { auth, googleProvider, db } from "@/lib/firebase";
import type { PlayerData } from "@shared/schema";

interface AuthContextType {
  user: FirebaseUser | null;
  playerData: PlayerData | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshPlayerData: () => Promise<void>;
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

  const refreshPlayerData = async () => {
    // Real-time sync is handled by onSnapshot, this is just for manual refresh if needed
    if (user) {
      const docRef = doc(db, "players", user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setPlayerData(docSnap.data() as PlayerData);
      }
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Real-time sync: Subscribe to player document changes
  useEffect(() => {
    if (!user) {
      setPlayerData(null);
      return;
    }

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
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const userDoc = doc(db, "players", result.user.uid);
      const userSnap = await getDoc(userDoc);

      if (!userSnap.exists()) {
        // Create initial player document
        const initialData: PlayerData = {
          player: {
            id: result.user.uid,
            email: result.user.email!,
            displayName: result.user.displayName!,
            photoURL: result.user.photoURL || undefined,
            createdAt: Date.now(),
          },
          stats: {
            cash: 500000,
            xp: 0,
            level: 1,
            nextLocoId: 2,
          },
          locomotives: [],
          jobs: [],
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
    try {
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
