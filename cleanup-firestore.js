// Firestore 정리 스크립트: 더미 데이터 삭제 및 신규 데이터만 유지
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, deleteDoc, doc, getDocs } from 'firebase/firestore';

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

console.log('🧹 Firestore 정리 시작\n');

// 삭제할 더미 데이터 이메일들
const dummyEmails = [
  'test-user@example.com',      // 더미 정상 사용자
  'pending-user@example.com',   // 더미 대기 사용자
  'sunmoon.scc@gmail.com'       // 관리자 2 (더미 아님, 유지할 수도)
];

// users 컬렉션 확인
console.log('📋 현재 Firestore users 컬렉션:');
const snap = await getDocs(collection(db, 'users'));

const users = [];
snap.forEach(d => {
  const u = d.data();
  users.push(u.email);
  console.log(`   📧 ${u.email} (${u.status})`);
});

console.log(`\n총 ${snap.size}건\n`);

// 더미 데이터 삭제 여부 확인
const toDelete = dummyEmails.filter(email => users.includes(email));

if (toDelete.length === 0) {
  console.log('✅ 더미 데이터가 없습니다.');
  console.log('\n현재 유지할 데이터:');
  users.forEach(email => {
    console.log(`   ✓ ${email}`);
  });
} else {
  console.log(`🗑️ 삭제할 더미 데이터 (${toDelete.length}건):\n`);

  for (const email of toDelete) {
    try {
      await deleteDoc(doc(db, 'users', email));
      console.log(`✅ 삭제: ${email}`);
    } catch (e) {
      console.error(`❌ 삭제 실패: ${email} - ${e.message}`);
    }
  }

  console.log('\n✅ 정리 완료\n');

  // 남은 데이터 확인
  const snap2 = await getDocs(collection(db, 'users'));
  console.log('📋 정리 후 Firestore users 컬렉션:');
  snap2.forEach(d => {
    const u = d.data();
    console.log(`   ✓ ${u.email} (${u.status})`);
  });
  console.log(`\n남은 데이터: ${snap2.size}건`);
}

process.exit(0);
