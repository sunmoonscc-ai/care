import { CURRENT_LOG_LEVEL, LOG_LEVEL } from '../constants';

class Logger {
  error(tag, msg, data = null) {
    if (CURRENT_LOG_LEVEL >= LOG_LEVEL.ERROR) {
      console.error(`❌ [${tag}] ${msg}`, data || '');
    }
  }

  warn(tag, msg, data = null) {
    if (CURRENT_LOG_LEVEL >= LOG_LEVEL.WARN) {
      console.warn(`⚠️ [${tag}] ${msg}`, data || '');
    }
  }

  info(tag, msg, data = null) {
    if (CURRENT_LOG_LEVEL >= LOG_LEVEL.INFO) {
      console.log(`ℹ️ [${tag}] ${msg}`, data || '');
    }
  }

  debug(tag, msg, data = null) {
    if (CURRENT_LOG_LEVEL >= LOG_LEVEL.DEBUG) {
      console.log(`🔍 [${tag}] ${msg}`, data || '');
    }
  }

  success(tag, msg, data = null) {
    if (CURRENT_LOG_LEVEL >= LOG_LEVEL.INFO) {
      console.log(`✅ [${tag}] ${msg}`, data || '');
    }
  }
}

export const logger = new Logger();
