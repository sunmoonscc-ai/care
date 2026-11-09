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

const DEBUG = import.meta.env.MODE === 'development';

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

if (DEBUG) {
  console.log("🔥 [firebase.js] 초기화 시작", {
    projectId: firebaseConfig.projectId,
    authDomain: firebaseConfig.authDomain,
    mode: import.meta.env.MODE
  });
}

try {
  // Firebase App 초기화
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

  if (DEBUG) console.log("✅ [firebase.js] Firebase App 초기화 완료");

  // Firestore 초기화
  db = getFirestore(app);

  if (!db) {
    throw new Error("Firestore 인스턴스 생성 실패");
  }

  isOfflineFallback = false;

  if (DEBUG) {
    console.log("✅ [firebase.js] Firestore 초기화 완료");
    console.log("✅ [firebase.js] 상태: 온라인 모드 (데이터 동기화 활성)");
  }
} catch (error) {
  console.error("❌ [firebase.js] Firebase 초기화 실패:", {
    code: error.code,
    message: error.message
  });

  isOfflineFallback = true;

  if (DEBUG) {
    console.warn("⚠️ [firebase.js] 오프라인 폴백 모드 활성화 (로컬 스토리지만 사용)");
  }
}

export { app, db, isOfflineFallback, DEBUG };
