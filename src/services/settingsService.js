import { db, isOfflineFallback } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const STORAGE_KEY_SETTINGS = 'careshift_app_settings';

// 기본 관리자 설정값
export const DEFAULT_SETTINGS = {
  totalStaffCount: 10,        // 2층 필요 전체 직원 수 (기본 10명)
  monthlyOffLimit: 2,         // 월 희망 휴무 신청 가능 일수 (기본 2일)
  requireConsecutiveOff: true // 연속 일자로만 신청 필수 (예: 27~28일)
};

let cachedSettings = null;

// 로컬 캐시 또는 기본 설정값 즉시 반환
export function getAppSettings() {
  if (cachedSettings) return cachedSettings;

  const local = localStorage.getItem(STORAGE_KEY_SETTINGS);
  if (local) {
    try {
      cachedSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(local) };
      return cachedSettings;
    } catch (e) {
      console.warn("로컬 설정 파싱 실패:", e);
    }
  }

  cachedSettings = { ...DEFAULT_SETTINGS };
  localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(cachedSettings));
  return cachedSettings;
}

// Firestore 및 로컬 캐시에 설정값 저장
export async function saveAppSettings(newSettings) {
  cachedSettings = { ...getAppSettings(), ...newSettings };
  localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(cachedSettings));

  if (!isOfflineFallback && db) {
    try {
      await setDoc(doc(db, 'settings', 'hospital_config'), cachedSettings, { merge: true });
      console.log("✅ [saveAppSettings] Firestore에 설정값 저장 완료:", cachedSettings);
    } catch (e) {
      console.warn("⚠️ [saveAppSettings] Firestore 저장 실패 (오프라인):", e.message);
    }
  }

  return cachedSettings;
}

// Firestore에서 최신 설정값 동기화
export async function syncAppSettingsFromFirestore() {
  if (isOfflineFallback || !db) return getAppSettings();

  try {
    const snap = await getDoc(doc(db, 'settings', 'hospital_config'));
    if (snap.exists()) {
      cachedSettings = { ...DEFAULT_SETTINGS, ...snap.data() };
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(cachedSettings));
      console.log("🔥 [syncAppSettingsFromFirestore] 최신 설정값 동기화 완료:", cachedSettings);
      return cachedSettings;
    }
  } catch (e) {
    console.warn("⚠️ [syncAppSettingsFromFirestore] 동기화 실패:", e.message);
  }

  return getAppSettings();
}

