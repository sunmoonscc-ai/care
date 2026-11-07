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

// 구글 로그인 실행
export async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    const isAdmin = checkIsAdmin(user.email);
    return { success: true, user, isAdmin };
  } catch (error) {
    console.error("Google Sign-In Error:", error);
    return { success: false, error: error.message };
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

