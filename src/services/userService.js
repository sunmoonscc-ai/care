// 사용자 회원 관리 및 권한 승인 서비스 (Firestore users 컬렉션 연동)
import { db, isOfflineFallback, app } from './firebase';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  getDocs,
  onSnapshot
} from 'firebase/firestore';
import { logger } from './loggerService';
import { STORAGE_KEYS } from '../constants';

const STORAGE_KEY_USERS = STORAGE_KEYS.USERS;

// 관리자 2인 고정
export const ADMIN_EMAILS = [
  'hdcc6th@gmail.com',
  'sunmoon.scc@gmail.com'
];

export async function getUserProfile(email, uid = null) {
  if (!email) return null;
  const cleanEmail = email.trim().toLowerCase();

  // 관리자는 영구 승인 상태
  if (ADMIN_EMAILS.includes(cleanEmail)) {
    const localDir = getLocalUsers();
    const adminCustom = localDir[cleanEmail] || {};
    return {
      email: cleanEmail,
      displayName: adminCustom.realName || (cleanEmail === 'sunmoon.scc@gmail.com' ? 'Jun (관리자)' : '관리자'),
      realName: adminCustom.realName || '관리자',
      phoneNumber: adminCustom.phoneNumber || '',
      role: 'ADMIN',
      status: 'APPROVED',
      staffId: 'admin',
      approvedAt: '2026-01-01'
    };
  }

  // 1. Firestore에서 실시간 최신 정보 직접 조회
  if (!isOfflineFallback && db) {
    try {
      let userDoc = await getDoc(doc(db, 'users', cleanEmail));
      if (!userDoc.exists() && uid) {
        userDoc = await getDoc(doc(db, 'users', uid));
      }

      if (userDoc.exists()) {
        const data = userDoc.data();
        // 최신 Firestore 데이터로 로컬 캐시 동기화
        const localDir = getLocalUsers();
        localDir[cleanEmail] = data;
        saveLocalUsers(localDir);
        return data;
      } else {
        // Firestore에 없으면 로컬 캐시에서도 제거
        const localDir = getLocalUsers();
        delete localDir[cleanEmail];
        saveLocalUsers(localDir);
        return null;
      }
    } catch (e) {
      logger.warn('UserService', 'Firestore 조회 실패', e.message);
    }
  }

  // 2. Firestore 조회가 네트워크 오류 등으로 불가능할 때만 비상용 로컬 스토리지 확인
  const localDir = getLocalUsers();
  return localDir[cleanEmail] || null;
}

// 사용자 프로필 정보 (이름, 휴대전화번호 등) 업데이트
export async function updateUserProfileInfo({ email, uid, realName, displayName, phoneNumber }) {
  if (!email) throw new Error("이메일 정보가 없습니다.");
  const cleanEmail = email.trim().toLowerCase();

  const updates = {
    realName: realName || displayName,
    displayName: realName || displayName,
    phoneNumber: phoneNumber || '',
    updatedAt: new Date().toISOString()
  };

  // 1. 로컬 캐시 갱신
  const localDir = getLocalUsers();
  localDir[cleanEmail] = { ...(localDir[cleanEmail] || { email: cleanEmail, role: 'PENDING', status: 'PENDING' }), ...updates };
  saveLocalUsers(localDir);

  // 2. Firestore 동기화
  if (!isOfflineFallback && db) {
    try {
      await setDoc(doc(db, 'users', cleanEmail), updates, { merge: true });
      if (uid) {
        try {
          await setDoc(doc(db, 'users', uid), updates, { merge: true });
        } catch (e) {
          logger.warn('UserService', 'UID 대체 저장 실패', e.message);
        }
      }
    } catch (e) {
      logger.error('UserService', '사용자 정보 수정 실패', e);
      throw new Error(`Firestore 저장 실패 (${e.code}): ${e.message}`);
    }
  }

  return localDir[cleanEmail];
}

export async function registerNewUserRequest(user, additionalInfo = {}) {
  const cleanEmail = user.email.trim().toLowerCase();
  const uid = user.uid || null;

  const realName = additionalInfo.realName || user.displayName || cleanEmail.split('@')[0];
  const phoneNumber = additionalInfo.phoneNumber || '';

  const profile = {
    uid: uid,
    email: cleanEmail,
    displayName: realName,
    realName: realName,
    phoneNumber: phoneNumber,
    photoURL: user.photoURL || null,
    role: 'PENDING',
    status: 'PENDING',
    staffId: null,
    appliedAt: new Date().toLocaleString('ko-KR'),
    updatedAt: new Date().toISOString()
  };

  // 1. 로컬 스토리지에 즉시 반영
  const localDir = getLocalUsers();
  localDir[cleanEmail] = profile;
  saveLocalUsers(localDir);

  // 2. Firestore 저장 실행
  if (!isOfflineFallback && db) {
    try {
      await setDoc(doc(db, 'users', cleanEmail), profile, { merge: true });
      return profile;
    } catch (e) {
      if (uid) {
        try {
          await setDoc(doc(db, 'users', uid), profile, { merge: true });
          return profile;
        } catch (uidErr) {
          logger.error('UserService', 'Firestore 저장 실패 (이메일/UID 모두)', uidErr);
        }
      }

      const alertMsg = `⚠️ [Firestore 저장 실패]\n${e.code || '알 수 없음'}: ${e.message}`;
      alert(alertMsg);
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
    approvedAt: new Date().toLocaleString('ko-KR'),
    updatedAt: new Date().toISOString()
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
      try {
        await setDoc(doc(db, 'users', cleanEmail), updates, { merge: true });
      } catch (err2) {
        logger.warn('UserService', '사용자 승인 상태 업데이트 실패', err2);
      }
    }
  }
}

export async function rejectOrRevokeUser(email, reason = '가입 거절 또는 권한 취소') {
  const cleanEmail = email.trim().toLowerCase();
  const updates = {
    role: 'REJECTED',
    status: 'REJECTED',
    rejectReason: reason,
    revokedAt: new Date().toLocaleString('ko-KR'),
    updatedAt: new Date().toISOString()
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
      try {
        await setDoc(doc(db, 'users', cleanEmail), updates, { merge: true });
      } catch (err2) {
        logger.warn('UserService', '사용자 권한 취소 실패', err2);
      }
    }
  }
}

export async function listAllUsers(forceRefresh = false) {
  let usersMap = { ...getLocalUsers() };

  ADMIN_EMAILS.forEach(adminEmail => {
    if (!usersMap[adminEmail]) {
      usersMap[adminEmail] = {
        email: adminEmail,
        displayName: adminEmail === 'sunmoon.scc@gmail.com' ? 'Jun (관리자)' : '관리자',
        realName: '관리자',
        phoneNumber: '',
        role: 'ADMIN',
        status: 'APPROVED',
        staffId: 'admin',
        appliedAt: '2026-11-07'
      };
    }
  });

  if (!isOfflineFallback && db) {
    try {
      const snap = await getDocs(collection(db, 'users'));

      // Firestore 결과로 완전 최신 맵 구성
      const freshMap = {};
      ADMIN_EMAILS.forEach(adminEmail => {
        freshMap[adminEmail] = usersMap[adminEmail];
      });

      snap.docs.forEach(d => {
        const u = d.data();
        if (u && u.email) {
          freshMap[u.email.toLowerCase()] = u;
        }
      });

      // 캐시와 Firestore가 다르면 캐시 완전 덮어쓰기 업데이트
      saveLocalUsers(freshMap);
      return Object.values(freshMap);
    } catch (e) {
      logger.error('UserService', 'Firestore 사용자 조회 실패', e.message);
    }
  }

  return Object.values(usersMap);
}

// 로컬 캐시와 원격 Firestore 데이터베이스를 명시적으로 비교하여 동기화
export async function syncUsersWithFirestore() {
  if (isOfflineFallback || !db) return { updated: false, users: Object.values(getLocalUsers()) };

  try {
    const localDir = getLocalUsers();
    const snap = await getDocs(collection(db, 'users'));
    
    const remoteMap = {};
    snap.docs.forEach(docSnap => {
      const data = docSnap.data();
      if (data && data.email) {
        remoteMap[data.email.toLowerCase()] = data;
      }
    });

    // 관리자 기본 정보 병합
    ADMIN_EMAILS.forEach(adminEmail => {
      if (!remoteMap[adminEmail]) {
        remoteMap[adminEmail] = localDir[adminEmail] || {
          email: adminEmail,
          displayName: adminEmail === 'sunmoon.scc@gmail.com' ? 'Jun (관리자)' : '관리자',
          realName: '관리자',
          phoneNumber: '',
          role: 'ADMIN',
          status: 'APPROVED',
          staffId: 'admin',
          appliedAt: '2026-11-07'
        };
      }
    });

    const localStr = JSON.stringify(localDir);
    const remoteStr = JSON.stringify(remoteMap);

    const isDifferent = localStr !== remoteStr;
    if (isDifferent) {
      console.log("🔄 [syncUsersWithFirestore] 로컬 캐시와 Firestore DB 차이 감지 -> 로컬 캐시 갱신 완료");
      saveLocalUsers(remoteMap);
    } else {
      console.log("✅ [syncUsersWithFirestore] 로컬 캐시와 Firestore DB 일치함");
    }

    return {
      updated: isDifferent,
      users: Object.values(remoteMap)
    };
  } catch (err) {
    console.warn("⚠️ [syncUsersWithFirestore] 동기화 중 오류 발생:", err);
    return { updated: false, users: Object.values(getLocalUsers()) };
  }
}

export function subscribeUsersList(callback) {
  if (isOfflineFallback || !db) {
    return () => {};
  }

  try {
    return onSnapshot(collection(db, 'users'), (snap) => {
      let usersMap = { ...getLocalUsers() };

      ADMIN_EMAILS.forEach(adminEmail => {
        if (!usersMap[adminEmail]) {
          usersMap[adminEmail] = {
            email: adminEmail,
            displayName: adminEmail === 'sunmoon.scc@gmail.com' ? 'Jun (관리자)' : '관리자',
            realName: '관리자',
            phoneNumber: '',
            role: 'ADMIN',
            status: 'APPROVED',
            staffId: 'admin',
            appliedAt: '2026-11-07'
          };
        }
      });

      snap.docs.forEach(d => {
        const u = d.data();
        if (u && u.email) {
          usersMap[u.email.toLowerCase()] = u;
        }
      });

      saveLocalUsers(usersMap);
      if (callback) callback(Object.values(usersMap));
    }, (err) => {
      console.error("🔥 [subscribeUsersList] 구독 오류:", err.code, err.message);
    });
  } catch (e) {
    return () => {};
  }
}

export function getLocalUsers() {
  const saved = localStorage.getItem(STORAGE_KEY_USERS);
  if (saved) {
    try { return JSON.parse(saved); } catch(e){}
  }
  return {};
}

export function saveLocalUsers(data) {
  localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(data));
}

// 가입된 일반 회원(관리자 제외) 목록 조회
export function getRegisteredMembers() {
  const users = Object.values(getLocalUsers());
  return users.filter(u => !ADMIN_EMAILS.includes(u.email.toLowerCase()));
}
