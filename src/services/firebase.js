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

const DEBUG = true; // 항상 로그 활성화 (프로덕션에서는 false로 변경)

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

console.log("🔥 [firebase.js] === 초기화 시작 ===");

try {
  // Firebase App 초기화
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  console.log("✅ [firebase.js] Firebase App 초기화 완료");

  // Firestore 초기화
  db = getFirestore(app);
  console.log("✅ [firebase.js] Firestore 초기화 완료");
  console.log(`   db 객체: ${!!db ? '있음' : '없음'}`);

  if (!db) {
    throw new Error("Firestore 인스턴스 생성 실패");
  }

  isOfflineFallback = false;
  console.log("✅ [firebase.js] === 초기화 성공 ===");
  console.log("   상태: 온라인 모드");
  console.log("   Firestore: 준비 완료");

} catch (error) {
  console.error("❌ [firebase.js] === 초기화 실패 ===");
  console.error("   코드:", error.code);
  console.error("   메시지:", error.message);
  console.error("   상세:", error);

  isOfflineFallback = true;
  console.warn("⚠️ [firebase.js] 오프라인 폴백 모드 활성화");
  console.warn("   로컬 스토리지만 사용합니다");
}

// 전역 확인 함수
window.__firebaseStatus = () => ({
  dbReady: !!db,
  offline: isOfflineFallback,
  configValid: firebaseConfig.projectId === 'care-798f1'
});

export { app, db, isOfflineFallback, DEBUG };
