// 관리자 2명을 Firestore에 저장
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, setDoc, doc } from 'firebase/firestore';

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

console.log('👑 관리자 계정 설정 시작\n');

const admins = [
  {
    email: 'hdcc6th@gmail.com',
    displayName: '관리자 1',
    role: 'ADMIN',
    status: 'APPROVED',
    staffId: 'admin-1'
  },
  {
    email: 'sunmoon.scc@gmail.com',
    displayName: '관리자 2',
    role: 'ADMIN',
    status: 'APPROVED',
    staffId: 'admin-2'
  }
];

for (const admin of admins) {
  try {
    const profile = {
      ...admin,
      approvedAt: new Date().toLocaleString('ko-KR')
    };

    await setDoc(doc(db, 'users', admin.email), profile);
    console.log(`✅ 저장 완료: ${admin.email}`);
    console.log(`   - 이름: ${admin.displayName}`);
    console.log(`   - 권한: ${admin.role}`);
    console.log();
  } catch (e) {
    console.error(`❌ 저장 실패: ${admin.email} - ${e.message}`);
  }
}

console.log('✅ 관리자 계정 설정 완료');
process.exit(0);
