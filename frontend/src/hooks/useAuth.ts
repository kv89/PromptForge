import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { useEffect } from "react";

import { auth } from "@/config/firebase";
import { useAuthStore } from "@/store/authStore";

/**
 * Subscribes to Firebase auth state and exposes auth actions.
 *
 * Mount this once near the root of the app so the global auth store stays in
 * sync with Firebase's session.
 */
export function useAuth() {
  const { user, isAuthenticated, isLoading, setUser, clearUser } =
    useAuthStore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
      } else {
        clearUser();
      }
    });
    return unsubscribe;
  }, [setUser, clearUser]);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  return { user, isAuthenticated, isLoading, signInWithGoogle, signOut };
}
