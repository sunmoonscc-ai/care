// Firebase 인증 및 구글 소셜 로그인 + 관리자 권한 서비스
import { app, DEBUG } from './firebase';
import {
  getAuth,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
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

// 모바일 기기 감지 (iOS, Android 등)
export function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || (window.innerWidth <= 768);
}

// 구글 로그인 실행 (PC는 팝업, 모바일은 안정적인 표준 팝업/리디렉트 처리)
export async function loginWithGoogle({ promptSelectAccount = false } = {}) {
  try {
    const authProvider = new GoogleAuthProvider();

    if (promptSelectAccount) {
      authProvider.setCustomParameters({
        prompt: 'select_account'
      });
    }

    if (DEBUG) console.log("🔐 [loginWithGoogle] 로그인 시도 (모바일 여부:", isMobileDevice(), ")");

    // 팝업 차단 위험이 높은 모바일 브라우저를 고려하여 순수 signInWithPopup 호출 (외부 창 감시 간섭 제거)
    const result = await signInWithPopup(auth, authProvider);
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

    console.error("❌ [loginWithGoogle] 로그인 에러:", {
      code,
      message: error.message
    });

    // 팝업이 차단된 모바일 환경인 경우 signInWithRedirect로 자동 폴백
    if (code === 'auth/popup-blocked' || (isMobileDevice() && !isCancelled)) {
      console.log("🔄 모바일 팝업 차단 감지 -> signInWithRedirect로 자동 전환");
      try {
        const authProvider = new GoogleAuthProvider();
        if (promptSelectAccount) {
          authProvider.setCustomParameters({ prompt: 'select_account' });
        }
        await signInWithRedirect(auth, authProvider);
        return { success: true, redirecting: true };
      } catch (redirectError) {
        console.error("❌ redirect 로그인 실패:", redirectError);
      }
    }

    return {
      success: false,
      error: error.message,
      code: code,
      isCancelled: isCancelled
    };
  }
}

// 리디렉션 로그인 결과 확인 (페이지 로드 시)
export async function checkRedirectLoginResult() {
  try {
    const result = await getRedirectResult(auth);
    if (result && result.user) {
      console.log("✅ [checkRedirectLoginResult] 모바일 리디렉션 로그인 성공:", result.user.email);
      return { success: true, user: result.user };
    }
  } catch (e) {
    console.warn("리디렉션 로그인 확인 중 오류/미해당:", e.message);
  }
  return null;
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
