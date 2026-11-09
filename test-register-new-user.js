// registerNewUserRequest 함수 직접 테스트
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyD_zh-kmFVZ6WgRgadZPNsfhS1jxe79F9Y",
  authDomain: "care-798f1.firebaseapp.com",
  projectId: "care-798f1",
  storageBucket: "care-798f1.firebasestorage.app",
  messagingSenderId: "494524801008",
  appId: "1:494524801008:web:34f47702f75cdd4c0cc735"
};

console.log('🧪 registerNewUserRequest 함수 테스트\n');

try {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  // 테스트 신규 사용자 데이터
  const testUser = {
    email: 'testuser@example.com',
    displayName: '테스트 사용자',
    photoURL: null
  };

  console.log('📝 등록할 사용자:', testUser.email);

  const cleanEmail = testUser.email.trim().toLowerCase();
  const profile = {
    email: cleanEmail,
    displayName: testUser.displayName || cleanEmail.split('@')[0],
    photoURL: testUser.photoURL || null,
    role: 'PENDING',
    status: 'PENDING',
    staffId: null,
    appliedAt: new Date().toLocaleString('ko-KR')
  };

  console.log('📊 생성할 프로필:\n', profile, '\n');

  console.log('🔍 Firestore에 저장 중...');

  // setDoc 실행
  await setDoc(doc(db, 'users', cleanEmail), profile);

  console.log('✅ Firestore 저장 성공!\n');

  // 저장 확인
  console.log('✔️ 저장된 데이터:');
  console.log(`   이메일: ${profile.email}`);
  console.log(`   상태: ${profile.status}`);
  console.log(`   권한: ${profile.role}`);
  console.log(`   신청일: ${profile.appliedAt}`);
} catch (error) {
  console.error('❌ 오류 발생');
  console.error('   코드:', error.code);
  console.error('   메시지:', error.message);
  console.error('   이름:', error.name);
}

process.exit(0);
