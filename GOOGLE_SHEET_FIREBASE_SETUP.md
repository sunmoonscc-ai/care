# 파이어베이스 & 구글 시트 양방향 동기화 연동 가이드

본 프로젝트는 **Firebase Firestore**를 주 데이터 저장소로 사용하면서, 현장 관리자가 익숙한 **Google Sheets(구글 시트)**에서도 자유롭게 열고 편집할 수 있는 양방향 브릿지를 기본 탑재하고 있습니다.

---

## 1. Firebase 콘솔 설정 방법 (준비되시면 입력)

1. [Firebase Console](https://console.firebase.google.com/)에서 프로젝트 생성
2. **Firestore Database** 생성 (테스트 모드로 시작 또는 읽기/쓰기 허용 규칙)
3. **프로젝트 설정 > 웹 앱(</>) 추가** 후 발급된 키를 `.env` 파일에 복사:

```env
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

---

## 2. 구글 시트(Google Sheets) 양방향 연동 설정 (3분 소요)

1. 사용하실 **구글 시트**를 새로 만들거나 기존 2층 근무표 시트를 엽니다.
2. 시트 상단 메뉴의 **[확장 프로그램] > [Apps Script]**를 클릭합니다.
3. 프로젝트 내 [google-apps-script-sync.js](file:///c:/Users/mcbm1/project/20261107_Care/google-apps-script-sync.js) 파일의 코드를 복사하여 Apps Script 편집기에 붙여넣고 저장합니다.
4. 우측 상단의 **[배포] > [새 배포]** 클릭:
   - 유형: **웹 앱**
   - 다음 사용자 권한으로 실행: **나**
   - 액세스 권한이 있는 사용자: **모든 사용자(Anyone)**
5. 생성된 **웹 앱 URL (`https://script.google.com/macros/s/.../exec`)**을 복사합니다.
6. 케어시프트 웹앱 상단의 **[구글 시트 설정]** 또는 로컬 스토리지 키(`careshift_google_sheet_config`)에 해당 URL과 시트 링크를 등록하면 즉시 양방향 실시간 동기화가 가동됩니다!

---

## 3. 작동 시나리오

| 작업 위치 | 동작 내용 |
| :--- | :--- |
| **PC 구글 시트에서 수정 시** | 관리자가 시트에서 특정 셀(`한애순 15일 B -> N`)을 타이핑하고 엔터를 치면 `onEdit`이 트리거되어 파이어베이스에 즉시 동기화되고, 웹앱 화면도 실시간으로 바뀝니다. |
| **케어시프트 웹앱에서 수정 시** | 관리자가 웹앱에서 셀을 클릭하거나 모바일로 요양보호사 신청을 승인하면, **[구글 시트 실시간 동기화]**를 통해 구글 시트의 해당 셀과 글자색(빨간색)이 자동 갱신됩니다. |
| **요양보호사 모바일 화면** | 복잡한 엑셀을 볼 필요 없이, `[모바일] 내 근무·신청` 화면에서 오늘/내일 근무를 큰 글씨로 확인하고 희망 휴무/교환을 신청합니다. |

