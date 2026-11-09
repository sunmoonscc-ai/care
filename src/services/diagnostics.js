// Firebase 연결 및 사용자 정보 조회 진단 도구
import { db, isOfflineFallback, DEBUG } from './firebase';
import { getDoc, collection, getDocs, doc } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { ADMIN_EMAILS, getUserProfile, listAllUsers } from './userService';

export const DIAGNOSTICS = {
  // 1. Firebase 초기화 상태
  async checkFirebaseInit() {
    console.log('\n🔍 === 진단 1: Firebase 초기화 상태 ===');
    const result = {
      dbReady: !!db,
      offline: isOfflineFallback,
      debugMode: DEBUG
    };
    console.log('✅ Firebase 상태:', result);
    return result;
  },

  // 2. 관리자 이메일 설정 확인
  checkAdminConfig() {
    console.log('\n🔍 === 진단 2: 관리자 설정 ===');
    console.log('✅ 관리자 이메일:', ADMIN_EMAILS);
    return ADMIN_EMAILS;
  },

  // 3. 현재 로그인 사용자 확인
  async checkCurrentUser() {
    console.log('\n🔍 === 진단 3: 현재 로그인 사용자 ===');
    return new Promise((resolve) => {
      const auth = getAuth();
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        unsubscribe();
        if (user) {
          console.log('✅ 로그인 사용자:', {
            email: user.email,
            uid: user.uid,
            displayName: user.displayName
          });
          resolve({
            isLoggedIn: true,
            email: user.email,
            uid: user.uid
          });
        } else {
          console.log('⚠️ 로그인하지 않음');
          resolve({ isLoggedIn: false });
        }
      });
    });
  },

  // 4. Firestore users 컬렉션 상태
  async checkFirestoreUsers() {
    console.log('\n🔍 === 진단 4: Firestore users 컬렉션 ===');

    if (isOfflineFallback || !db) {
      console.warn('⚠️ Firestore 사용 불가 (오프라인 모드)');
      return { available: false };
    }

    try {
      const snap = await getDocs(collection(db, 'users'));
      console.log(`✅ 총 ${snap.size}명의 사용자:`, );

      const users = [];
      snap.forEach(d => {
        const u = d.data();
        console.log(`   📌 ${u.email}: ${u.status} (role: ${u.role})`);
        users.push({
          email: u.email,
          status: u.status,
          role: u.role
        });
      });

      return {
        available: true,
        count: snap.size,
        users
      };
    } catch (error) {
      console.error('❌ Firestore 조회 실패:', {
        code: error.code,
        message: error.message
      });
      return {
        available: false,
        error: error.message
      };
    }
  },

  // 5. 특정 사용자 프로필 조회 테스트
  async testGetUserProfile(email) {
    console.log(`\n🔍 === 진단 5: 사용자 프로필 조회 (${email}) ===`);

    try {
      const profile = await getUserProfile(email);

      if (profile) {
        console.log('✅ 프로필 조회 성공:', profile);
        return { success: true, profile };
      } else {
        console.log('⚠️ 프로필 없음 (신규 사용자)');
        return { success: false, message: '프로필 없음' };
      }
    } catch (error) {
      console.error('❌ 프로필 조회 실패:', error.message);
      return { success: false, error: error.message };
    }
  },

  // 6. 전체 사용자 목록 조회
  async testListAllUsers() {
    console.log('\n🔍 === 진단 6: 전체 사용자 목록 조회 ===');

    try {
      const users = await listAllUsers();
      console.log(`✅ 조회된 사용자: ${users.length}명`);

      users.forEach(u => {
        console.log(`   👤 ${u.email} - ${u.status}`);
      });

      return { success: true, count: users.length, users };
    } catch (error) {
      console.error('❌ 사용자 목록 조회 실패:', error.message);
      return { success: false, error: error.message };
    }
  },

  // 7. 로컬 스토리지 캐시 상태
  checkLocalStorage() {
    console.log('\n🔍 === 진단 7: 로컬 스토리지 캐시 ===');

    try {
      const cached = localStorage.getItem('careshift_users_directory');

      if (!cached) {
        console.log('⚠️ 캐시 없음');
        return { available: false };
      }

      const parsed = JSON.parse(cached);
      const userCount = Object.keys(parsed).length;

      console.log(`✅ 캐시된 사용자: ${userCount}명`);
      Object.keys(parsed).forEach(email => {
        console.log(`   💾 ${email}`);
      });

      return {
        available: true,
        count: userCount,
        users: Object.keys(parsed)
      };
    } catch (error) {
      console.error('❌ 캐시 확인 실패:', error.message);
      return { available: false, error: error.message };
    }
  },

  // 8. 관리자 이메일로 테스트
  async testAdminAccess() {
    console.log('\n🔍 === 진단 8: 관리자 접근 테스트 ===');

    const adminEmail = ADMIN_EMAILS[0];
    console.log(`테스트 이메일: ${adminEmail}`);

    try {
      const profile = await getUserProfile(adminEmail);

      if (profile && profile.role === 'ADMIN') {
        console.log('✅ 관리자 프로필 정상:', profile);
        return { success: true, isAdmin: true };
      } else {
        console.warn('⚠️ 관리자 프로필 이상:', profile);
        return { success: false };
      }
    } catch (error) {
      console.error('❌ 관리자 테스트 실패:', error.message);
      return { success: false, error: error.message };
    }
  },

  // 9. 전체 진단 실행
  async runFullDiagnostics() {
    console.clear();
    console.log('🏥 === Firebase 연결 및 사용자 정보 조회 전체 진단 ===\n');

    const results = {
      firebase: await this.checkFirebaseInit(),
      admin: this.checkAdminConfig(),
      currentUser: await this.checkCurrentUser(),
      firestore: await this.checkFirestoreUsers(),
      localStorage: this.checkLocalStorage(),
      adminTest: await this.testAdminAccess(),
      allUsers: await this.testListAllUsers()
    };

    console.log('\n🔍 === 진단 완료 ===');
    console.table(results);

    return results;
  }
};

// 전역 접근용
window.DIAG = DIAGNOSTICS;

console.log('💡 팁: 콘솔에서 DIAG.runFullDiagnostics() 실행하면 전체 진단 가능');
