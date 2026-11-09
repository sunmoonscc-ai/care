// Firestore 테스트 데이터 설정 스크립트
// 실행: node setup-firestore-test-data.js

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

console.log('🔧 Firestore 테스트 데이터 설정 시작\n');

// 설정할 테스트 사용자들
const testUsers = [
  {
    email: 'hdcc6th@gmail.com',
    displayName: '관리자',
    role: 'ADMIN',
    status: 'APPROVED',
    staffId: 'admin',
    approvedAt: new Date().toLocaleString('ko-KR')
  },
  {
    email: 'sunmoon.scc@gmail.com',
    displayName: '관리자2',
    role: 'ADMIN',
    status: 'APPROVED',
    staffId: 'admin2',
    approvedAt: new Date().toLocaleString('ko-KR')
  },
  {
    email: 'test-user@example.com',
    displayName: '테스트 사용자',
    role: 'REGULAR',
    status: 'APPROVED',
    staffId: 'test-001',
    appliedAt: '2026-11-01',
    approvedAt: '2026-11-09'
  },
  {
    email: 'pending-user@example.com',
    displayName: '대기중인 사용자',
    role: 'PENDING',
    status: 'PENDING',
    staffId: null,
    appliedAt: new Date().toLocaleString('ko-KR')
  }
];

// 각 사용자 데이터 저장
for (const user of testUsers) {
  try {
    await setDoc(doc(db, 'users', user.email), user);
    console.log(`✅ 저장 완료: ${user.email} (${user.status})`);
  } catch (e) {
    console.error(`❌ 저장 실패: ${user.email} -`, e.message);
  }
}

console.log('\n📊 저장된 데이터 확인:\n');

// 저장 확인
try {
  const snap = await getDocs(collection(db, 'users'));
  console.log(`총 ${snap.size}건의 사용자 데이터:\n`);

  snap.forEach(d => {
    const u = d.data();
    console.log(`📌 ${u.email}`);
    console.log(`   이름: ${u.displayName}`);
    console.log(`   권한: ${u.role}`);
    console.log(`   상태: ${u.status}`);
    console.log(`   직원ID: ${u.staffId || '(없음)'}\n`);
  });

  console.log('✅ 테스트 데이터 설정 완료!');
} catch (e) {
  console.error('❌ 데이터 확인 실패:', e.message);
}

process.exit(0);
