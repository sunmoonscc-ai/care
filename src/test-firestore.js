import { initializeApp } from 'firebase/app';
import { getFirestore, collection, setDoc, doc, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyD_zh-kmFVZ6WgRgadZPNsfhS1jxe79F9Y",
  authDomain: "care-798f1.firebaseapp.com",
  projectId: "care-798f1",
  storageBucket: "care-798f1.firebasestorage.app",
  messagingSenderId: "494524801008",
  appId: "1:494524801008:web:34f47702f75cdd4c0cc735"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

console.log("🔥 테스트 시작: Firestore 데이터 저장");

const testUsers = [
  {
    email: "admin@test.com",
    displayName: "관리자 테스트",
    role: "ADMIN",
    status: "APPROVED",
    appliedAt: "2026-11-09"
  },
  {
    email: "user1@test.com",
    displayName: "일반 사용자1",
    role: "PENDING",
    status: "PENDING",
    appliedAt: "2026-11-09"
  },
  {
    email: "user2@test.com",
    displayName: "승인된 사용자",
    role: "REGULAR",
    status: "APPROVED",
    appliedAt: "2026-11-08",
    approvedAt: "2026-11-09"
  }
];

for (const user of testUsers) {
  try {
    await setDoc(doc(db, "users", user.email), user);
    console.log(`✅ 저장: ${user.email}`);
  } catch (e) {
    console.error(`❌ 실패: ${user.email} -`, e.message);
  }
}

// 확인
console.log("\n📖 저장된 데이터 확인:");
try {
  const snap = await getDocs(collection(db, "users"));
  console.log(`✅ 총 ${snap.size}건 발견`);
  snap.forEach(d => {
    console.log(`  - ${d.data().email}: ${d.data().status}`);
  });
} catch (e) {
  console.error("❌ 조회 실패:", e.message);
}

process.exit(0);
