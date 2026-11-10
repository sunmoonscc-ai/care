// 캐시 TTL 관리 시스템 (메모리 누수 방지)

class CacheManager {
  constructor() {
    this.caches = new Map();
  }

  // 캐시 설정 (TTL: 밀리초)
  set(key, value, ttl = 5 * 60 * 1000) {
    // 기존 타이머 정리
    if (this.caches.has(key)) {
      clearTimeout(this.caches.get(key).timer);
    }

    const timer = setTimeout(() => {
      this.caches.delete(key);
    }, ttl);

    this.caches.set(key, { value, timer, createdAt: Date.now() });
    return value;
  }

  // 캐시 조회
  get(key) {
    const cached = this.caches.get(key);
    return cached ? cached.value : null;
  }

  // 캐시 존재 여부 확인
  has(key) {
    return this.caches.has(key);
  }

  // 캐시 삭제
  delete(key) {
    const cached = this.caches.get(key);
    if (cached) {
      clearTimeout(cached.timer);
      this.caches.delete(key);
      return true;
    }
    return false;
  }

  // 전체 캐시 초기화
  clear() {
    for (const [, cached] of this.caches) {
      clearTimeout(cached.timer);
    }
    this.caches.clear();
  }

  // 캐시 상태 조회
  getStats() {
    return {
      totalCaches: this.caches.size,
      cacheKeys: Array.from(this.caches.keys())
    };
  }
}

export const cacheManager = new CacheManager();

// 기본 TTL 상수들
export const CACHE_TTL = {
  SHORT: 1 * 60 * 1000,      // 1분
  MEDIUM: 5 * 60 * 1000,     // 5분
  LONG: 15 * 60 * 1000,      // 15분
  VERY_LONG: 30 * 60 * 1000  // 30분
};

// 캐시 데코레이터 (함수에 자동 캐싱 적용)
export function withCache(fn, ttl = CACHE_TTL.MEDIUM) {
  return async (...args) => {
    const cacheKey = `${fn.name}_${JSON.stringify(args)}`;

    if (cacheManager.has(cacheKey)) {
      return cacheManager.get(cacheKey);
    }

    const result = await fn(...args);
    cacheManager.set(cacheKey, result, ttl);
    return result;
  };
}
