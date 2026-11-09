// 사용자 회원 관리 및 권한 승인 서비스 (Firestore users 컬렉션 연동)
import { db, isOfflineFallback } from './firebase';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  getDocs,
  onSnapshot
} from 'firebase/firestore';

const STORAGE_KEY_USERS = 'careshift_users_directory';
const DEBUG = import.meta.env.MODE === 'development'; // 개발 모드에서만 로그

// 관리자 2인 고정
export const ADMIN_EMAILS = [
  'hdcc6th@gmail.com',
  'sunmoon.scc@gmail.com'
];

export async function getUserProfile(email) {
  if (!email || typeof email !== 'string') {
    if (DEBUG) console.warn("⚠️ [getUserProfile] 잘못된 이메일:", email);
    return null;
  }

  const cleanEmail = email.trim().toLowerCase();

  if (DEBUG) {
    console.log("👤 [getUserProfile] 시작", {
      email: cleanEmail,
      offline: isOfflineFallback,
      dbReady: !!db
    });
  }

  // 1️⃣ 관리자 확인 - 영구 승인 상태
  if (ADMIN_EMAILS.includes(cleanEmail)) {
    const adminProfile = {
      email: cleanEmail,
      displayName: '관리자',
      role: 'ADMIN',
      status: 'APPROVED',
      staffId: 'admin',
      approvedAt: '2026-01-01'
    };
    if (DEBUG) console.log("✅ [getUserProfile] 관리자 계정 감지:", cleanEmail);
    return adminProfile;
  }

  // 2️⃣ Firestore에서 조회
  if (!isOfflineFallback && db) {
    try {
      if (DEBUG) console.log("🔍 [getUserProfile] Firestore 조회 중...", cleanEmail);
      const userDoc = await getDoc(doc(db, 'users', cleanEmail));

      if (userDoc.exists()) {
        const profileData = userDoc.data();

        // 데이터 검증
        if (!profileData || typeof profileData !== 'object') {
          console.error("❌ [getUserProfile] 잘못된 데이터 형식:", profileData);
          return null;
        }

        // 로컬 캐시 갱신
        const localDir = getLocalUsers();
        localDir[cleanEmail] = profileData;
        saveLocalUsers(localDir);

        if (DEBUG) console.log("✅ [getUserProfile] Firestore에서 찾음:", profileData);
        return profileData;
      } else {
        if (DEBUG) console.log("ℹ️ [getUserProfile] Firestore에 프로필 없음");
      }
    } catch (error) {
      console.error("❌ [getUserProfile] Firestore 오류:", {
        code: error.code,
        message: error.message
      });
      // Firestore 오류 시 로컬 캐시로 폴백
    }
  } else if (isOfflineFallback) {
    if (DEBUG) console.warn("⚠️ [getUserProfile] Firestore 오프라인 모드");
  }

  // 3️⃣ 로컬 스토리지 폴백
  const localUsers = getLocalUsers();
  const cachedProfile = localUsers[cleanEmail] || null;

  if (DEBUG) {
    if (cachedProfile) {
      console.log("💾 [getUserProfile] 로컬 캐시에서 조회:", cachedProfile);
    } else {
      console.log("⚠️ [getUserProfile] 프로필 없음 (신규 사용자)");
    }
  }

  return cachedProfile;
}

export async function registerNewUserRequest(user) {
  if (!user || !user.email) {
    console.error("❌ [registerNewUserRequest] 잘못된 사용자 정보");
    return null;
  }

  const cleanEmail = user.email.trim().toLowerCase();
  const profile = {
    email: cleanEmail,
    displayName: user.displayName || cleanEmail.split('@')[0],
    photoURL: user.photoURL || null,
    role: 'PENDING',
    status: 'PENDING',
    staffId: null,
    appliedAt: new Date().toLocaleString('ko-KR')
  };

  try {
    // 로컬 저장
    const localDir = getLocalUsers();
    localDir[cleanEmail] = profile;
    saveLocalUsers(localDir);

    if (DEBUG) {
      console.log("💾 [registerNewUserRequest] 로컬 저장 완료:", cleanEmail);
    }

    // Firestore 영구 저장
    if (!isOfflineFallback && db) {
      try {
        await setDoc(doc(db, 'users', cleanEmail), profile);
        if (DEBUG) {
          console.log("✅ [registerNewUserRequest] Firestore 저장 완료:", cleanEmail);
        }
      } catch (error) {
        console.error("❌ [registerNewUserRequest] Firestore 저장 실패:", {
          code: error.code,
          message: error.message
        });
        // 로컬 저장은 성공했으므로 계속 진행
      }
    }

    return profile;
  } catch (error) {
    console.error("❌ [registerNewUserRequest] 예상치 못한 오류:", error.message);
    return null;
  }
}

export async function approveUser({ email, role, staffId }) {
  const cleanEmail = email.trim().toLowerCase();
  const updates = {
    role: role,
    status: 'APPROVED',
    staffId: staffId || null,
    approvedAt: new Date().toLocaleString('ko-KR')
  };

  const localDir = getLocalUsers();
  if (localDir[cleanEmail]) {
    localDir[cleanEmail] = { ...localDir[cleanEmail], ...updates };
    saveLocalUsers(localDir);
  }

  if (!isOfflineFallback && db) {
    try {
      await updateDoc(doc(db, 'users', cleanEmail), updates);
    } catch (e) {
      console.error("Firestore user approve error:", e);
    }
  }
}

export async function rejectOrRevokeUser(email, reason = '가입 거절 또는 권한 취소') {
  const cleanEmail = email.trim().toLowerCase();
  const updates = {
    role: 'REJECTED',
    status: 'REJECTED',
    rejectReason: reason,
    revokedAt: new Date().toLocaleString('ko-KR')
  };

  const localDir = getLocalUsers();
  if (localDir[cleanEmail]) {
    localDir[cleanEmail] = { ...localDir[cleanEmail], ...updates };
    saveLocalUsers(localDir);
  }

  if (!isOfflineFallback && db) {
    try {
      await updateDoc(doc(db, 'users', cleanEmail), updates);
    } catch (e) {
      console.error("Firestore user revoke error:", e);
    }
  }
}

export async function listAllUsers() {
  if (DEBUG) console.log("📋 [listAllUsers] 사용자 목록 조회 시작");

  let usersMap = {};

  // 1️⃣ Firestore에서 최신 데이터 우선 조회 (캐시 무시)
  if (!isOfflineFallback && db) {
    try {
      if (DEBUG) console.log("🔍 [listAllUsers] Firestore 조회 중...");

      const snap = await getDocs(collection(db, 'users'));

      if (!snap.empty) {
        let validCount = 0;

        snap.docs.forEach(d => {
          const userData = d.data();

          // 데이터 검증
          if (!userData || typeof userData !== 'object' || !userData.email) {
            console.error("❌ [listAllUsers] 잘못된 데이터:", userData);
            return;
          }

          usersMap[userData.email] = userData;
          validCount++;
        });

        // Firestore 데이터를 로컬 스토리지 갱신
        saveLocalUsers(usersMap);

        if (DEBUG) {
          console.log(`✅ [listAllUsers] Firestore에서 로드: ${snap.size}명 (유효: ${validCount}명)`);
        }
      } else {
        if (DEBUG) {
          console.warn("ℹ️ [listAllUsers] Firestore users 컬렉션이 비어있음");
        }
      }
    } catch (error) {
      console.error("❌ [listAllUsers] Firestore 조회 실패:", {
        code: error.code,
        message: error.message
      });

      // Firestore 실패 시에만 로컬 캐시 폴백
      if (DEBUG) console.log("💾 [listAllUsers] Firestore 실패 → 로컬 캐시 폴백");
      usersMap = { ...getLocalUsers() };
    }
  } else if (isOfflineFallback) {
    // 오프라인 모드: 로컬 캐시만 사용
    if (DEBUG) console.warn("⚠️ [listAllUsers] Firestore 오프라인 모드 → 로컬 캐시만 사용");
    usersMap = { ...getLocalUsers() };
  }

  const result = Object.values(usersMap);

  if (DEBUG) {
    console.log(`✅ [listAllUsers] 최종 결과: ${result.length}명`, result.map(u => u.email));
  }

  return result;
}

// 실시간 사용자 변경 감시 리스너 (Firestore users 컬렉션 구독)
export function subscribeUsersList(callback) {
  if (!callback || typeof callback !== 'function') {
    console.error("❌ [subscribeUsersList] 콜백 함수 필요");
    return () => {};
  }

  if (isOfflineFallback || !db) {
    console.warn("⚠️ [subscribeUsersList] Firestore 사용 불가 (오프라인 모드)");
    return () => {};
  }

  try {
    if (DEBUG) console.log("👂 [subscribeUsersList] 실시간 구독 시작");

    return onSnapshot(
      collection(db, 'users'),
      (snap) => {
        try {
          if (DEBUG) console.log(`📡 [subscribeUsersList] Firestore 변경 감지: ${snap.size}건`);

          // ⚠️ Firestore 데이터가 절대 진실 (single source of truth)
          // 로컬 캐시는 완전히 Firestore 데이터로 대체
          let usersMap = {}; // 기존 로컬 데이터 무시
          let validCount = 0;

          snap.docs.forEach(d => {
            const userData = d.data();

            // 데이터 검증
            if (userData && typeof userData === 'object' && userData.email) {
              usersMap[userData.email] = userData;
              validCount++;
            } else {
              console.error("❌ [subscribeUsersList] 잘못된 데이터:", userData);
            }
          });

          // Firestore 데이터로 로컬 캐시 완전 갱신
          saveLocalUsers(usersMap);
          const result = Object.values(usersMap);

          if (DEBUG) {
            console.log(`✅ [subscribeUsersList] 콜백 실행: 총 ${result.length}명 (새로운: ${validCount}명)`);
            if (validCount > 0) {
              console.log(`   📧 이메일:`, result.map(u => u.email).join(', '));
            }
          }

          callback(result);
        } catch (error) {
          console.error("❌ [subscribeUsersList] 처리 오류:", error.message);
        }
      },
      (error) => {
        console.error("❌ [subscribeUsersList] 구독 오류:", {
          code: error.code,
          message: error.message
        });
      }
    );
  } catch (error) {
    console.error("❌ [subscribeUsersList] 예상치 못한 오류:", error.message);
    return () => {};
  }
}

function getLocalUsers() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_USERS);

    if (!saved) {
      if (DEBUG) console.log("💾 [getLocalUsers] 캐시 없음 (새로 시작)");
      return {};
    }

    const parsed = JSON.parse(saved);

    // 캐시 데이터 검증
    if (!parsed || typeof parsed !== 'object') {
      console.error("❌ [getLocalUsers] 잘못된 캐시 형식");
      localStorage.removeItem(STORAGE_KEY_USERS);
      return {};
    }

    if (DEBUG) {
      console.log(`💾 [getLocalUsers] 로드됨: ${Object.keys(parsed).length}명`);
    }

    return parsed;
  } catch (error) {
    console.error("❌ [getLocalUsers] localStorage 오류:", {
      name: error.name,
      message: error.message
    });
    // 데이터가 손상된 경우 초기화
    try {
      localStorage.removeItem(STORAGE_KEY_USERS);
    } catch {}
    return {};
  }
}

function saveLocalUsers(data) {
  try {
    if (!data || typeof data !== 'object') {
      console.error("❌ [saveLocalUsers] 잘못된 데이터:", data);
      return;
    }

    localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(data));

    if (DEBUG) {
      console.log(`💾 [saveLocalUsers] 저장: ${Object.keys(data).length}명`);
    }
  } catch (error) {
    console.error("❌ [saveLocalUsers] 저장 실패:", {
      name: error.name,
      message: error.message
    });
  }
}
