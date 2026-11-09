// Firebase 인증 및 구글 소셜 로그인 + 관리자 권한 서비스
import { app, DEBUG } from './firebase';
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
  if (!email || typeof email !== 'string') {
    return false;
  }

  const cleanEmail = email.trim().toLowerCase();
  const isAdmin = ADMIN_EMAILS.includes(cleanEmail);

  if (DEBUG && isAdmin) {
    console.log(`✅ [checkIsAdmin] 관리자 인증: ${cleanEmail}`);
  }

  return isAdmin;
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

    if (DEBUG) console.log("🔐 [loginWithGoogle] 로그인 시도");

    const result = await signInWithPopupImmediate(auth, authProvider);
    const user = result.user;
    const isAdmin = checkIsAdmin(user.email);

    if (DEBUG) {
      console.log("✅ [loginWithGoogle] 로그인 성공", {
        email: user.email,
        uid: user.uid,
        isAdmin
      });
    }

    return { success: true, user, isAdmin };
  } catch (error) {
    const code = error?.code || '';
    const isCancelled =
      code === 'auth/popup-closed-by-user' ||
      code === 'auth/cancelled-popup-request' ||
      code === 'auth/user-cancelled';

    if (!isCancelled) {
      console.error("❌ [loginWithGoogle] 로그인 실패:", {
        code,
        message: error.message
      });
    }

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
    if (DEBUG) console.log("🔓 [logoutUser] 로그아웃 시도");

    await signOut(auth);

    if (DEBUG) console.log("✅ [logoutUser] 로그아웃 성공");

    return { success: true };
  } catch (error) {
    console.error("❌ [logoutUser] 로그아웃 실패:", {
      code: error.code,
      message: error.message
    });

    return { success: false, error: error.message };
  }
}

// 인증 상태 감시 리스너
export function subscribeAuth(callback) {
  if (!callback || typeof callback !== 'function') {
    console.error("❌ [subscribeAuth] 콜백 함수 필요");
    return () => {};
  }

  if (DEBUG) console.log("👂 [subscribeAuth] 인증 상태 감시 시작");

  return onAuthStateChanged(auth, (user) => {
    try {
      if (user) {
        const isAdmin = checkIsAdmin(user.email);

        const authInfo = {
          isLoggedIn: true,
          user: {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || user.email.split('@')[0],
            photoURL: user.photoURL || null
          },
          isAdmin
        };

        if (DEBUG) {
          console.log("✅ [subscribeAuth] 로그인 상태 감지", {
            email: user.email,
            isAdmin
          });
        }

        callback(authInfo);
      } else {
        if (DEBUG) console.log("🔓 [subscribeAuth] 로그아웃 상태 감지");

        callback({
          isLoggedIn: false,
          user: null,
          isAdmin: false
        });
      }
    } catch (error) {
      console.error("❌ [subscribeAuth] 콜백 실행 오류:", error.message);
    }
  }, (error) => {
    console.error("❌ [subscribeAuth] 감시 오류:", {
      code: error.code,
      message: error.message
    });
  });
}

export { auth };

