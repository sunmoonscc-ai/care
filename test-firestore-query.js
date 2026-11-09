// Firestore 쿼리 직접 테스트
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyD_zh-kmFVZ6WgRgadZPNsfhS1jxe79F9Y",
  authDomain: "care-798f1.firebaseapp.com",
  projectId: "care-798f1",
  storageBucket: "care-798f1.firebasestorage.app",
  messagingSenderId: "494524801008",
  appId: "1:494524801008:web:34f47702f75cdd4c0cc735"
};

console.log('🧪 Firestore 쿼리 테스트 시작\n');

try {
  const app = initializeApp(firebaseConfig);
  console.log('✅ Firebase App 초기화 완료\n');

  const db = getFirestore(app);
  console.log('✅ Firestore 초기화 완료\n');

  console.log('🔍 users 컬렉션 쿼리 실행 중...\n');

  const snap = await getDocs(collection(db, 'users'));

  console.log(`✅ 쿼리 완료\n`);
  console.log(`📊 응답 건수: ${snap.size}\n`);

  if (snap.empty) {
    console.log('⚠️ 컬렉션이 비어있음\n');
  } else {
    console.log('📋 저장된 데이터:\n');

    const users = [];
    snap.forEach((doc, index) => {
      const data = doc.data();
      console.log(`${index + 1}. ${data.email}`);
      console.log(`   - status: ${data.status}`);
      console.log(`   - role: ${data.role}`);
      console.log(`   - displayName: ${data.displayName}`);
      console.log();

      users.push({
        email: data.email,
        status: data.status,
        role: data.role
      });
    });

    console.log('\n📊 요약:');
    const pending = users.filter(u => u.status === 'PENDING');
    const approved = users.filter(u => u.status === 'APPROVED');
    console.log(`   총 ${users.length}명`);
    console.log(`   - 대기중: ${pending.length}명`);
    console.log(`   - 승인됨: ${approved.length}명`);

    if (pending.length > 0) {
      console.log(`\n⏳ 대기중인 사용자:`);
      pending.forEach(u => console.log(`   - ${u.email}`));
    }

    if (approved.length > 0) {
      console.log(`\n✅ 승인된 사용자:`);
      approved.forEach(u => console.log(`   - ${u.email} (${u.role})`));
    }
  }
} catch (error) {
  console.error('❌ 오류 발생');
  console.error('   코드:', error.code);
  console.error('   메시지:', error.message);
  console.error('   스택:', error.stack);
}

process.exit(0);
