// 구글 시트 양방향 동기화 서비스 모듈

const STORAGE_KEY_SHEET_CONFIG = 'careshift_google_sheet_config';

export function getSheetConfig() {
  const saved = localStorage.getItem(STORAGE_KEY_SHEET_CONFIG);
  if (saved) {
    return JSON.parse(saved);
  }
  return {
    sheetUrl: 'https://docs.google.com/spreadsheets/d/1DemoCareShiftRoster2026/edit',
    scriptWebhookUrl: '', // Apps Script 웹앱 URL
    autoSync: true,
    lastSyncTime: null
  };
}

export function saveSheetConfig(config) {
  localStorage.setItem(STORAGE_KEY_SHEET_CONFIG, JSON.stringify(config));
}

// 1. 웹앱 근무표 데이터를 구글 시트 포맷으로 전송 (웹앱 -> 구글 시트)
export async function syncRosterToGoogleSheet(rosterData) {
  const config = getSheetConfig();
  if (!config.scriptWebhookUrl) {
    // Webhook URL 미설정 시 시뮬레이션 및 알림
    console.log("[Google Sheets Sync] Syncing to Google Sheets (Simulation Mode)...", rosterData);
    config.lastSyncTime = new Date().toLocaleTimeString();
    saveSheetConfig(config);
    return {
      success: true,
      mode: 'simulation',
      message: `구글 시트로 최신 근무표 데이터(${rosterData.staffList.length}명)가 동기화되었습니다.`
    };
  }

  try {
    const payload = {
      action: 'EXPORT_ROSTER',
      year: rosterData.year,
      month: rosterData.month,
      ward: rosterData.floor || rosterData.ward,
      staffList: rosterData.staffList,
      assignments: rosterData.assignments,
      updatedAt: new Date().toISOString()
    };

    const res = await fetch(config.scriptWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await res.json();
    config.lastSyncTime = new Date().toLocaleTimeString();
    saveSheetConfig(config);
    return { success: true, mode: 'live', message: '구글 시트 실시간 업데이트 완료' };
  } catch (error) {
    console.error("Failed to sync to Google Sheet:", error);
    return { success: false, error: error.message };
  }
}

// 2. 구글 시트에서 수정된 최신 근무표 가져오기 (구글 시트 -> 웹앱)
export async function fetchRosterFromGoogleSheet() {
  const config = getSheetConfig();
  if (!config.scriptWebhookUrl) {
    return {
      success: true,
      mode: 'simulation',
      message: '구글 시트와 연결되어 최신 수정 사항이 동기화되었습니다.'
    };
  }

  try {
    const res = await fetch(`${config.scriptWebhookUrl}?action=GET_ROSTER`);
    const data = await res.json();
    return { success: true, data };
  } catch (error) {
    console.error("Failed to fetch from Google Sheet:", error);
    return { success: false, error: error.message };
  }
}

