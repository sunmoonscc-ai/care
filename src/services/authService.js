// Firebase 인증 및 구글 소셜 로그인 + 관리자 권한 서비스
import { app } from './firebase';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';

const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// 지정된 관리자 이메일 목록
export const ADMIN_EMAILS = [
  'hdcc6th@gmail.com',
  'sunmoon.scc@gmail.com'
];

export function checkIsAdmin(email) {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

// 팝업 창 즉각 닫힘 감지 래퍼 함수 (Firebase 고유 7~8초 지연을 100ms로 단축)
async function signInWithPopupImmediate(authInstance, providerInstance) {
  let popupWindow = null;
  const originalOpen = window.open;

  window.open = function (...args) {
    popupWindow = originalOpen.apply(window, args);
    window.open = originalOpen;
    return popupWindow;
  };

  let pollInterval = null;

  try {
    const popupClosedPromise = new Promise((_, reject) => {
      pollInterval = setInterval(() => {
        if (popupWindow && popupWindow.closed) {
          clearInterval(pollInterval);
          reject({
            code: 'auth/popup-closed-by-user',
            message: '사용자가 로그인 팝업 창을 닫았습니다.'
          });
        }
      }, 100);
    });

    const signInPromise = signInWithPopup(authInstance, providerInstance);
    return await Promise.race([signInPromise, popupClosedPromise]);
  } finally {
    if (pollInterval) clearInterval(pollInterval);
    window.open = originalOpen;
  }
}

// 구글 로그인 실행 (promptSelectAccount: true면 항상 계정 선택 창 표시)
export async function loginWithGoogle({ promptSelectAccount = false } = {}) {
  try {
    const authProvider = new GoogleAuthProvider();
    if (promptSelectAccount) {
      authProvider.setCustomParameters({
        prompt: 'select_account'
      });
    }
    const result = await signInWithPopupImmediate(auth, authProvider);
    const user = result.user;
    const isAdmin = checkIsAdmin(user.email);
    return { success: true, user, isAdmin };
  } catch (error) {
    const code = error?.code || '';
    const isCancelled = 
      code === 'auth/popup-closed-by-user' || 
      code === 'auth/cancelled-popup-request' ||
      code === 'auth/user-cancelled';

    return { 
      success: false, 
      error: error.message,
      code: code,
      isCancelled: isCancelled
    };
  }
}

// 로그아웃 실행
export async function logoutUser() {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    console.error("Logout Error:", error);
    return { success: false, error: error.message };
  }
}

// 인증 상태 감시 리스너
export function subscribeAuth(callback) {
  return onAuthStateChanged(auth, (user) => {
    if (user) {
      const isAdmin = checkIsAdmin(user.email);
      callback({
        isLoggedIn: true,
        user: {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || user.email.split('@')[0],
          photoURL: user.photoURL || null
        },
        isAdmin
      });
    } else {
      callback({
        isLoggedIn: false,
        user: null,
        isAdmin: false
      });
    }
  });
}

export { auth };

