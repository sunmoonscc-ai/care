// 데이터 검증 유틸리티

import { logger } from './loggerService';

class Validator {
  // 이메일 검증
  static isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim().toLowerCase());
  }

  // 전화번호 검증 (한국)
  static isValidPhone(phone) {
    if (!phone || typeof phone !== 'string') return false;
    const cleaned = phone.replace(/[^0-9]/g, '');
    return cleaned.length >= 10 && cleaned.length <= 11;
  }

  // 이름 검증
  static isValidName(name) {
    if (!name || typeof name !== 'string') return false;
    return name.trim().length >= 2 && name.trim().length <= 50;
  }

  // 근무표 데이터 검증
  static isValidRoster(roster) {
    if (!roster || typeof roster !== 'object') {
      logger.warn('Validation', '근무표 객체 구조 오류');
      return false;
    }

    const requiredFields = ['year', 'month', 'staffList', 'assignments'];
    for (const field of requiredFields) {
      if (!(field in roster)) {
        logger.warn('Validation', `필수 필드 누락: ${field}`);
        return false;
      }
    }

    if (!Array.isArray(roster.staffList) || !roster.staffList.length) {
      logger.warn('Validation', '직원 목록 오류');
      return false;
    }

    if (typeof roster.assignments !== 'object') {
      logger.warn('Validation', '근무 배정 데이터 오류');
      return false;
    }

    return true;
  }

  // 휴무 신청 데이터 검증
  static isValidRequest(request) {
    if (!request || typeof request !== 'object') return false;

    const requiredFields = ['type', 'requesterId', 'requesterName', 'date'];
    for (const field of requiredFields) {
      if (!(field in request)) {
        logger.warn('Validation', `휴무 신청 필드 누락: ${field}`);
        return false;
      }
    }

    // 날짜 형식 검증 (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(request.date)) {
      logger.warn('Validation', `날짜 형식 오류: ${request.date}`);
      return false;
    }

    return true;
  }

  // 숫자 범위 검증
  static isInRange(value, min, max) {
    const num = parseInt(value, 10);
    return !isNaN(num) && num >= min && num <= max;
  }

  // 일자 검증 (1-31)
  static isValidDay(day) {
    return this.isInRange(day, 1, 31);
  }

  // 월 검증 (1-12)
  static isValidMonth(month) {
    return this.isInRange(month, 1, 12);
  }

  // 배열 요소 검증
  static validateArray(arr, validator) {
    if (!Array.isArray(arr)) return false;
    return arr.every(item => validator(item));
  }
}

export const validator = Validator;
