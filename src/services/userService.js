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

const STORAGE_KEY_USERS = 'careshift_users_directory';

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
    return {
      email: cleanEmail,
      displayName: cleanEmail === 'sunmoon.scc@gmail.com' ? 'Jun (관리자)' : '관리자',
      role: 'ADMIN',
      status: 'APPROVED',
      staffId: 'admin',
      approvedAt: '2026-01-01'
    };
  }

  // 1. Firestore에서 조회
  if (!isOfflineFallback && db) {
    try {
      let userDoc = await getDoc(doc(db, 'users', cleanEmail));
      if (!userDoc.exists() && uid) {
        userDoc = await getDoc(doc(db, 'users', uid));
      }

      if (userDoc.exists()) {
        const data = userDoc.data();
        const localDir = getLocalUsers();
        localDir[cleanEmail] = data;
        saveLocalUsers(localDir);
        return data;
      }
    } catch (e) {
      console.warn("⚠️ [getUserProfile] Firestore 조회 실패:", e.message);
    }
  }

  // 2. 로컬 스토리지 확인
  const localDir = getLocalUsers();
  return localDir[cleanEmail] || null;
}

export async function registerNewUserRequest(user) {
  const cleanEmail = user.email.trim().toLowerCase();
  const uid = user.uid || null;

  const profile = {
    uid: uid,
    email: cleanEmail,
    displayName: user.displayName || cleanEmail.split('@')[0],
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

  // 2. Firestore 저장 실행 (에러 발생 시 즉시 화면에 원인 노출)
  if (!isOfflineFallback && db) {
    try {
      console.log(`🔥 [Firestore] users/${cleanEmail} 문서 저장 시도...`);
      await setDoc(doc(db, 'users', cleanEmail), profile, { merge: true });
      console.log("✅ [Firestore] 신규 가입 신청 Firestore 저장 완료:", cleanEmail);
      return profile;
    } catch (e) {
      console.error("❌ [Firestore] users/" + cleanEmail + " 저장 실패:", e.code, e.message);

      // UID로 대체 저장 시도
      if (uid) {
        try {
          console.log(`🔄 [Firestore] users/${uid} (UID 키)로 대체 저장 시도...`);
          await setDoc(doc(db, 'users', uid), profile, { merge: true });
          console.log("✅ [Firestore] UID 키로 Firestore 저장 성공:", uid);
          return profile;
        } catch (uidErr) {
          console.error("❌ [Firestore] UID 키 저장도 실패:", uidErr.code, uidErr.message);
        }
      }

      // 🚨 사용자 화면에 왜 Firestore에 안 들어갔는지 명확하게 Alert 알림!
      let alertMsg = `⚠️ [Firestore 저장 실패 안내]\n원인: ${e.code || '알 수 없음'} (${e.message})\n\n`;
      if (e.code === 'permission-denied') {
        alertMsg += `👉 해결 방법: Firebase 콘솔의 Firestore 규칙(Rules)이 쓰기를 차단하고 있습니다.\n콘솔에서 'allow read, write: if true;'로 변경 후 게시(Publish)해야 저장됩니다.`;
      } else if (e.code === 'unavailable' || e.message.includes('offline')) {
        alertMsg += `👉 해결 방법: Firestore 데이터베이스가 활성화되지 않았거나 네트워크 차단 상태입니다.`;
      } else {
        alertMsg += `👉 콘솔 에러를 확인해주세요.`;
      }
      alert(alertMsg);
    }
  } else {
    alert("⚠️ Firestore 데이터베이스 객체(db)가 연결되지 않아 로컬 모드로만 동작 중입니다.\nFirebase 콘솔에서 Firestore Database 생성을 확인해주세요.");
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
      console.log("✅ [Firestore] 사용자 승인 상태 업데이트 완료:", cleanEmail);
    } catch (e) {
      console.error("Firestore user approve error:", e);
      try {
        await setDoc(doc(db, 'users', cleanEmail), updates, { merge: true });
      } catch (err2) {}
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
      console.error("Firestore user revoke error:", e);
      try {
        await setDoc(doc(db, 'users', cleanEmail), updates, { merge: true });
      } catch (err2) {}
    }
  }
}

export async function listAllUsers() {
  console.log("🔥 [listAllUsers] Firestore에서 사용자 조회 시작...");

  let usersMap = { ...getLocalUsers() };

  ADMIN_EMAILS.forEach(adminEmail => {
    if (!usersMap[adminEmail]) {
      usersMap[adminEmail] = {
        email: adminEmail,
        displayName: adminEmail === 'sunmoon.scc@gmail.com' ? 'Jun (관리자)' : '관리자',
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
      console.log("🔥 [listAllUsers] Firestore 조회 성공:", snap.size, "건");

      if (!snap.empty) {
        snap.docs.forEach(d => {
          const u = d.data();
          if (u && u.email) {
            usersMap[u.email.toLowerCase()] = u;
          }
        });
        saveLocalUsers(usersMap);
      }
    } catch (e) {
      console.error("🔥 [listAllUsers] Firestore 오류:", e.code, e.message);
    }
  }

  return Object.values(usersMap);
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
