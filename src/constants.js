// 애플리케이션 전역 상수

// 시간 관련 상수
export const ROSTER_SYNC_INTERVAL = 2 * 60 * 1000; // 2분
export const FIRESTORE_TIMEOUT = 3500; // 3.5초

// 근무표 상수
export const DEFAULT_YEAR = 2026;
export const DEFAULT_MONTH = 12;
export const FLOOR_NAME = '2층 요양보호사';

// 근무 관련 상수
export const MAX_OFF_DAYS = 2; // 월간 최대 휴무일
export const DEFAULT_STAFF_COUNT = 10;

// 캐시 키
export const STORAGE_KEYS = {
  ROSTER: 'careshift_roster',
  REQUESTS: 'careshift_shift_requests',
  SETTINGS: 'careshift_app_settings',
  USERS: 'careshift_users',
  MONTHLY_OFF_REQUESTS: 'careshift_monthly_off_requests'
};

// Firestore 컬렉션 이름
export const COLLECTIONS = {
  USERS: 'users',
  ROSTERS: 'rosters',
  REQUESTS: 'requests',
  MONTHLY_OFF_REQUESTS: 'monthly_off_requests',
  SETTINGS: 'settings'
};

// 사용자 상태
export const USER_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED'
};

// 직원 역할
export const STAFF_ROLES = {
  REGULAR: 'REGULAR',
  ASSOCIATE: 'ASSOCIATE',
  GUEST: 'GUEST',
  ADMIN: 'ADMIN'
};

// 환경 변수 (콘솔 로그 제어)
export const ENV = {
  isDev: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production'
};

// 로그 레벨
export const LOG_LEVEL = {
  NONE: 0,
  ERROR: 1,
  WARN: 2,
  INFO: 3,
  DEBUG: 4
};

// 프로덕션에서는 WARNING 이상만, 개발에서는 DEBUG까지 출력
export const CURRENT_LOG_LEVEL = ENV.isDev ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN;
