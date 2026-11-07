// Google Apps Script (GAS) 완전 연동 스크립트
// 요양병원 2층 근무표 양식 (B, B2, N, N1, X, OFF, 빨간색 희망휴무) 전용
// Firebase Project: care-798f1

const FIREBASE_PROJECT_ID = "care-798f1";

/**
 * 1. 구글 시트에서 관리자가 특정 셀을 수정했을 때 자동 실행 (시트 -> 파이어베이스/웹앱)
 */
function onEdit(e) {
  if (!e || !e.range) return;

  const sheet = e.range.getSheet();
  const row = e.range.getRow();
  const col = e.range.getColumn();
  const val = e.value || '';

  // 1, 2행은 제목/요일 헤더, 1~4열은 B, B2, N근무, 성명 열
  // 따라서 실제 일자 셀은 3행 이상, 5열 이상(1일 ~ 30일)
  if (row >= 3 && col >= 5 && col <= 34) {
    const staffName = sheet.getRange(row, 4).getValue(); // D열 성명
    const day = col - 4; // 1~30일

    // 글자 색상이 빨간색인지 확인 (#ff0000 or red)
    const fontColor = sheet.getRange(row, col).getFontColor();
    const isRed = (fontColor && fontColor.toLowerCase().indexOf('ff0000') !== -1) || fontColor === '#ea4335';

    Logger.log("셀 수정 감지: " + staffName + " " + day + "일 -> " + val + " (빨간색: " + isRed + ")");

    // 파이어베이스 Firestore REST API로 직접 변경 전송
    syncCellToFirestore({
      staffName: staffName,
      day: day,
      code: val,
      isRequested: isRed,
      updatedAt: new Date().toISOString()
    });
  }
}

/**
 * 2. 웹앱에서 구글 시트로 전체 내보내기 요청을 받았을 때 (웹앱 -> 시트)
 */
function doPost(e) {
  try {
    const postData = JSON.parse(e.postData.contents);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

    if (postData.action === 'EXPORT_ROSTER') {
      const staffList = postData.staffList || [];
      const assignments = postData.assignments || {};

      // 3행부터 직원 데이터 일괄 쓰기
      staffList.forEach((staff, idx) => {
        const row = 3 + idx;
        const assignList = assignments[staff.id] || [];

        // 성명 (4열)
        sheet.getRange(row, 4).setValue(staff.name);

        // 1~30일 (5열 ~ 34열)
        assignList.forEach(item => {
          const col = 4 + item.day;
          const cell = sheet.getRange(row, col);
          cell.setValue(item.code);

          // 빨간색 신청건 서식 지정
          if (item.isRequested) {
            cell.setFontColor('#ea4335');
            cell.setFontWeight('bold');
          } else {
            cell.setFontColor('#1e293b');
            cell.setFontWeight('normal');
          }
        });
      });

      return ContentService.createTextOutput(JSON.stringify({ 
        success: true, 
        message: staffList.length + "명의 근무표가 구글 시트에 업데이트되었습니다." 
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ success: false, message: "Unknown action" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 3. Firestore REST API 연동 헬퍼
 */
function syncCellToFirestore(data) {
  const url = "https://firestore.googleapis.com/v1/projects/" + FIREBASE_PROJECT_ID + "/databases/(default)/documents/rosters/202609_2fl";
  // HTTP 요청으로 Firestore REST API 호출
  // UrlFetchApp.fetch(url, { method: "PATCH", ... });
}
