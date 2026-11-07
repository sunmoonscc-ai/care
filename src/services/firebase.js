import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc,
  getDocs, 
  setDoc, 
  updateDoc, 
  onSnapshot 
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyD_zh-kmFVZ6WgRgadZPNsfhS1jxe79F9Y",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "care-798f1.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "care-798f1",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "care-798f1.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "494524801008",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:494524801008:web:34f47702f75cdd4c0cc735",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-N7MXQ4JWXS"
};

let app;
let db;
let isOfflineFallback = false;

try {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  db = getFirestore(app);
  console.log("🔥 Firebase initialized successfully for project:", firebaseConfig.projectId);
} catch (error) {
  console.warn("Firebase initialization warning (using local fallback mode):", error);
  isOfflineFallback = true;
}

export { app, db, isOfflineFallback };
