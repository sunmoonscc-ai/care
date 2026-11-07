// 사용자 회원 관리 및 권한 승인 서비스 (Firestore 연동)
import { db, isOfflineFallback } from './firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  getDocs, 
  query, 
  where 
} from 'firebase/firestore';

const STORAGE_KEY_USERS = 'careshift_users_directory';

// 관리자 2인 고정
export const ADMIN_EMAILS = [
  'hdcc6th@gmail.com',
  'sunmoon.scc@gmail.com'
];

/**
 * 회원 등급 정의:
 * - 'ADMIN': 시스템 관리자 (모든 권한)
 * - 'REGULAR': 정회원 (본인 근무 조회, 휴무/교환 신청 및 자동 승인 연동)
 * - 'ASSOCIATE': 준회원 (정회원에 준하나 관리자가 언제든 가입취소 가능)
 * - 'GUEST': 임시회원 (둘러보기만 가능, 신청 불가)
 * - 'PENDING': 가입 승인 대기중 (접속 대기 화면)
 * - 'REJECTED': 가입 거절됨 (접속 불가 화면)
 */

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

  // 1. Firestore에서 사용자 조회
  if (!isOfflineFallback && db) {
    try {
      const userDoc = await getDoc(doc(db, 'users', cleanEmail));
      if (userDoc.exists()) {
        return userDoc.data();
      }
    } catch (e) {
      console.warn("Firestore user profile fetch warning:", e);
    }
  }

  // 2. 로컬 스토리지 확인
  const localDirectory = getLocalUsers();
  return localDirectory[cleanEmail] || null;
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

  const localDir = getLocalUsers();
  localDir[cleanEmail] = profile;
  saveLocalUsers(localDir);

  if (!isOfflineFallback && db) {
    try {
      await setDoc(doc(db, 'users', cleanEmail), profile);
    } catch (e) {
      console.warn("Firestore register user warning:", e);
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
      console.warn("Firestore user approve error:", e);
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
      console.warn("Firestore user revoke error:", e);
    }
  }
}

export async function listAllUsers() {
  if (!isOfflineFallback && db) {
    try {
      const snap = await getDocs(collection(db, 'users'));
      if (!snap.empty) {
        return snap.docs.map(d => d.data());
      }
    } catch (e) {
      console.warn("Firestore list all users error:", e);
    }
  }

  const localDir = getLocalUsers();
  return Object.values(localDir);
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
