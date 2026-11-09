// Authentication → Firestore 사용자 정보 조회 테스트
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, getDoc, setDoc, getDocs } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';

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
const auth = getAuth(app);

console.log("🧪 === 테스트 시작: Authentication → Firestore 사용자 정보 조회 ===\n");

// 테스트 1: Firestore 연결 확인
console.log("📋 테스트 1: Firestore 연결 확인");
try {
  const snap = await getDocs(collection(db, "users"));
  console.log(`✅ Firestore 연결 성공 - 현재 사용자 수: ${snap.size}명`);
  snap.forEach(d => {
    const u = d.data();
    console.log(`   - ${u.email}: ${u.status} (role: ${u.role})`);
  });
} catch (e) {
  console.error(`❌ Firestore 연결 실패:`, e.message);
}

// 테스트 2: 관리자 계정 프로필 조회
console.log("\n📋 테스트 2: 관리자 계정 프로필 조회");
const adminEmail = "hdcc6th@gmail.com";
try {
  const adminDoc = await getDoc(doc(db, "users", adminEmail));
  if (adminDoc.exists()) {
    console.log(`✅ 관리자 프로필 찾음:`, adminDoc.data());
  } else {
    console.log(`⚠️  관리자 프로필이 Firestore에 없음. 수동으로 생성하시겠습니까?`);
    // 관리자 프로필 자동 생성
    const adminProfile = {
      email: adminEmail,
      displayName: "관리자",
      role: "ADMIN",
      status: "APPROVED",
      staffId: "admin",
      createdAt: new Date().toLocaleString('ko-KR')
    };
    await setDoc(doc(db, "users", adminEmail), adminProfile);
    console.log(`✅ 관리자 프로필 생성 완료:`, adminProfile);
  }
} catch (e) {
  console.error(`❌ 오류:`, e.message);
}

// 테스트 3: 일반 사용자 프로필 조회
console.log("\n📋 테스트 3: 일반 사용자 프로필 조회");
const testEmail = "test@example.com";
try {
  const userDoc = await getDoc(doc(db, "users", testEmail));
  if (userDoc.exists()) {
    console.log(`✅ 사용자 프로필 찾음:`, userDoc.data());
  } else {
    console.log(`ℹ️  테스트 사용자 프로필이 없음 (정상 - 신규 사용자는 등록 신청 시 생성)`);
  }
} catch (e) {
  console.error(`❌ 오류:`, e.message);
}

// 테스트 4: 신규 사용자 등록 시뮬레이션
console.log("\n📋 테스트 4: 신규 사용자 등록 신청 시뮬레이션");
const newUserEmail = "newuser@test.com";
try {
  const newUserProfile = {
    email: newUserEmail,
    displayName: "새 사용자",
    role: "PENDING",
    status: "PENDING",
    appliedAt: new Date().toLocaleString('ko-KR')
  };
  await setDoc(doc(db, "users", newUserEmail), newUserProfile);
  console.log(`✅ 신규 사용자 등록 신청 완료:`, newUserProfile);
} catch (e) {
  console.error(`❌ 오류:`, e.message);
}

// 테스트 5: 로컬 스토리지 시뮬레이션
console.log("\n📋 테스트 5: 로컬 스토리지 캐시 동작 확인");
console.log("(브라우저에서만 실행 가능)");
console.log("❌ Node.js 환경이므로 localStorage 테스트 불가");

console.log("\n✅ === 테스트 완료 ===\n");
process.exit(0);
