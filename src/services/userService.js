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

// 관리자 2인 고정
export const ADMIN_EMAILS = [
  'hdcc6th@gmail.com',
  'sunmoon.scc@gmail.com'
];

export async function getUserProfile(email) {
  if (!email) return null;
  const cleanEmail = email.trim().toLowerCase();

  // 관리자는 영구 승인 상태
  if (ADMIN_EMAILS.includes(cleanEmail)) {
    return {
      email: cleanEmail,
      displayName: '관리자',
      role: 'ADMIN',
      status: 'APPROVED',
      staffId: 'admin',
      approvedAt: '2026-01-01'
    };
  }

  // 1. Firestore에서 조회
  if (!isOfflineFallback && db) {
    try {
      const userDoc = await getDoc(doc(db, 'users', cleanEmail));
      if (userDoc.exists()) {
        const data = userDoc.data();
        // 로컬 캐시 갱신
        const localDir = getLocalUsers();
        localDir[cleanEmail] = data;
        saveLocalUsers(localDir);
        return data;
      }
    } catch (e) {
      console.warn("Firestore getUserProfile error:", e);
    }
  }

  // 2. 로컬 스토리지 확인
  const localDir = getLocalUsers();
  return localDir[cleanEmail] || null;
}

export async function registerNewUserRequest(user) {
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

  // 로컬 저장
  const localDir = getLocalUsers();
  localDir[cleanEmail] = profile;
  saveLocalUsers(localDir);

  // Firestore 영구 저장
  if (!isOfflineFallback && db) {
    try {
      await setDoc(doc(db, 'users', cleanEmail), profile);
      console.log("🔥 [Firestore] 신규 가입 신청 등록 완료:", cleanEmail);
    } catch (e) {
      console.error("Firestore register user error:", e);
    }
  }

  return profile;
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
  console.log("🔥 [listAllUsers] Firestore에서 사용자 조회 시작...");

  // 1. 로컬 스토리지에서 먼저 읽기
  let usersMap = { ...getLocalUsers() };
  console.log("🔥 [listAllUsers] 로컬 스토리지 데이터:", Object.keys(usersMap).length, "건");

  // 2. Firestore에서 최신 데이터 조회
  if (!isOfflineFallback && db) {
    try {
      const snap = await getDocs(collection(db, 'users'));
      console.log("🔥 [listAllUsers] Firestore 조회 성공:", snap.size, "건");

      if (!snap.empty) {
        snap.docs.forEach(d => {
          const u = d.data();
          if (u && u.email) {
            usersMap[u.email] = u;
            console.log("🔥 [listAllUsers] Firestore 데이터 추가:", u.email, u.status);
          }
        });
        // Firestore 데이터로 로컬 스토리지 갱신
        saveLocalUsers(usersMap);
      } else {
        console.warn("🔥 [listAllUsers] Firestore users 컬렉션이 비어있음");
      }
    } catch (e) {
      console.error("🔥 [listAllUsers] Firestore 오류:", e.code, e.message);
    }
  } else {
    console.warn("🔥 [listAllUsers] Firestore 사용 불가 (오프라인 모드 또는 db 미초기화)");
  }

  const result = Object.values(usersMap);
  console.log("🔥 [listAllUsers] 최종 결과:", result.length, "명");
  return result;
}

// 실시간 사용자 변경 감시 리스너 (Firestore users 컬렉션 구독)
export function subscribeUsersList(callback) {
  if (isOfflineFallback || !db) {
    console.warn("🔥 [subscribeUsersList] Firestore 사용 불가");
    return () => {};
  }

  try {
    console.log("🔥 [subscribeUsersList] Firestore users 컬렉션 구독 시작...");
    return onSnapshot(collection(db, 'users'), (snap) => {
      console.log("🔥 [subscribeUsersList] Firestore 업데이트 감지:", snap.size, "건");

      // Firestore 데이터 → 로컬 스토리지
      let usersMap = { ...getLocalUsers() };

      snap.docs.forEach(d => {
        const u = d.data();
        if (u && u.email) {
          usersMap[u.email] = u;
        }
      });

      saveLocalUsers(usersMap);
      const result = Object.values(usersMap);
      console.log("🔥 [subscribeUsersList] 콜백 실행:", result.length, "명");
      if (callback) callback(result);
    }, (err) => {
      console.error("🔥 [subscribeUsersList] 구독 오류:", err.code, err.message);
    });
  } catch (e) {
    console.error("🔥 [subscribeUsersList] 예외:", e);
    return () => {};
  }
}

function getLocalUsers() {
  const saved = localStorage.getItem(STORAGE_KEY_USERS);
  if (saved) {
    try { return JSON.parse(saved); } catch(e){}
  }
  return {};
}

function saveLocalUsers(data) {
  localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(data));
}
