import { db, isOfflineFallback } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const STORAGE_KEY_SETTINGS = 'careshift_app_settings';

// 기본 근무 형태 및 정의 (선택 및 해제 가능)
export const SHIFT_DEFINITION_PRESETS = [
  {
    code: 'D',
    name: 'Day (낮 근무)',
    time: '07:00 ~ 15:00 (8시간)',
    description: '아침 식사 수발, 투약, 회진 보조, 각종 처치 집중 시간대',
    category: '3교대',
    enabled: true
  },
  {
    code: 'E',
    name: 'Evening (저녁 근무)',
    time: '15:00 ~ 23:00 (8시간)',
    description: '저녁 식사 수발, 취침 준비, 야간 당직 보고',
    category: '3교대',
    enabled: true
  },
  {
    code: 'N',
    name: 'Night (밤 근무)',
    time: '23:00 ~ 다음 날 07:00 (8시간)',
    description: '수면 취침 상태 확인, 야간 순찰, 낙상 예방, 새벽 투약',
    category: '3교대',
    enabled: true
  },
  {
    code: 'B',
    name: 'B (주간 12시간/종일)',
    time: '08:00 ~ 20:00 (12시간)',
    description: '요양보호사 종일 주간 케어 (낮 전담)',
    category: '2교대/요양원형',
    enabled: false
  },
  {
    code: 'N1',
    name: 'N1 (야간 후반/분담)',
    time: '23:00 ~ 07:00 (4시간 수면분담)',
    description: '전후반 4시간씩 교대 수면 및 낙상 방지 분담',
    category: '요양병원 분담형',
    enabled: false
  },
  {
    code: 'MID',
    name: 'Mid (미드 근무)',
    time: '10:00 ~ 18:00 (8시간)',
    description: '낮과 저녁 사이 일손 집중 투입 변칙 근무',
    category: '피크 집중형',
    enabled: false
  },
  {
    code: 'OFF',
    name: 'Off (휴무/비번)',
    time: '근무 없음 (충분한 휴식)',
    description: '기본 쉬는 날 (X 또는 OFF)',
    category: '휴무',
    enabled: true,
    locked: true
  }
];

// 기본 관리자 설정값
export const DEFAULT_SETTINGS = {
  patientCount: 60,           // 병동 총 입원 환자(어르신) 수
  targetRatio: 4.5,           // 목표 인력 등급 비율 (예: 환자 4.5명당 1명)
  totalStaffCount: 14,        // 필요 채용 인원 (환자수 / 비율, 60 / 4.5 ≒ 14명)
  dailyStaffCount: 10,        // 하루 총 출근 인원 (채용인원 * 22/30 ≒ 10명)
  shiftRatio: {
    dayRatio: 50,             // Day(주간) 50% -> 5명
    eveningRatio: 30,         // Evening(저녁) 30% -> 3명
    nightRatio: 20            // Night(밤샘) 20% -> 2명 (최소 2인 보장)
  },
  monthlyOffLimit: 2,         // 월 희망 휴무 신청 가능 일수 (기본 2일)
  requireConsecutiveOff: true,// 연속 일자로만 신청 필수 (예: 27~28일)
  activeShiftTypes: ['D', 'E', 'N', 'OFF'], // 활성화된 근무 형태 코드 목록
  shiftDefinitions: SHIFT_DEFINITION_PRESETS,
  rosterRules: {
    noReverseDuty: true,      // 역듀티 금지 (E -> D 금지)
    maxConsecutiveNight: 2,   // 연속 야간(N) 상한 (2~3일 권장)
    nightOffRestDays: 2,      // N근무 후 48시간(2일) 휴식 보장 권장
    balanceWeekendShifts: true// 주말 및 야간 근무 균등 분배
  }
};

// 환자 수와 목표 등급에 따른 일일 필요 인력 수학적 계산 헬퍼 함수
export function calculateStaffingRequirements(patientCount = 60, targetRatio = 4.5, customRatios = null) {
  const pCount = Math.max(1, parseInt(patientCount, 10) || 60);
  const ratio = Math.max(1, parseFloat(targetRatio) || 4.5);

  // 1단계: 전체 필요한 채용 인원 = 환자수 ÷ 등급비율 (올림/반올림)
  const totalStaff = Math.max(1, Math.round(pCount / ratio));

  // 2단계: 하루 동안 출근할 인원 (주 5일제 기준, 월 22일 근무 / 30일) = 전체인원 * 0.733
  const dailyStaff = Math.max(1, Math.round(totalStaff * (22 / 30)));

  // 3단계: 시간대별 배분 (기본 5 : 3 : 2 비율)
  const dRatio = customRatios?.dayRatio ?? 50;
  const eRatio = customRatios?.eveningRatio ?? 30;
  const nRatio = customRatios?.nightRatio ?? 20;

  // 야간(Night)은 의료법 및 응급 대처를 위해 최소 2인 이상 강제
  let nightCount = Math.max(2, Math.round(dailyStaff * (nRatio / 100)));
  let remain = Math.max(0, dailyStaff - nightCount);

  let dayCount = Math.max(1, Math.round(remain * (dRatio / (dRatio + eRatio))));
  let eveningCount = Math.max(1, remain - dayCount);

  // 재검증
  if (dayCount + eveningCount + nightCount < dailyStaff) {
    dayCount += (dailyStaff - (dayCount + eveningCount + nightCount));
  }

  const offCount = Math.max(0, totalStaff - dailyStaff);

  return {
    patientCount: pCount,
    targetRatio: ratio,
    totalStaff,
    dailyStaff,
    dayCount,
    eveningCount,
    nightCount,
    offCount
  };
}

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

