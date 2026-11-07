# 케어시프트 (CareShift) - 요양보호사 근무일정표 웹앱 프로그램

구글 Stitch 디자인 시스템 및 요양보호사 근무일정표 프로그램 기획안을 바탕으로 구축된 **규칙 기반 간병인력 근무 스케줄 관리 웹 애플리케이션**입니다.

## 1. 주요 기능
- **월간 근무표 편집 (`roster-editor`)**: 
  - 직원별 세로축, 날짜별 가로축 격자 스프레드시트
  - 단축키 (`D`: 데이, `E`: 이브닝, `N`: 나이트, `O`: 휴무, `Y`: 연차)
  - 하단 일자별 D/E/N 최소 인원 충족 집계 행
  - 실시간 법정/운영 규칙 위반 검증 사이드바
- **운영 대시보드 (`dashboard`)**:
  - 오늘의 병동 간병인력 시간대별 배치 현황
  - 결근 및 대체 근무 모니터링, D-day 알림, 미처리 신청 건수 표시
- **근무표 자동 생성 및 비교 (`autogen`)**:
  - 제약 충족 기반 3대 초안(균형안전형, 선호우선형, 숙련안정형) 시뮬레이션 및 원클릭 적용
- **휴무 및 근무 교환 관리 (`requests`)**:
  - 희망 휴무 신청, 연차, 동료 간 1:1 맞교환 승인 워크플로우

## 2. 기술 스택 & 데이터베이스
- **Frontend**: Vite, Vanilla JavaScript (ES Modules), Tailwind CSS, Material Symbols Outlined
- **Database / Cloud**: Firebase Firestore (구글 클라우드 인프라 연동 지원 및 오프라인/로컬 자동 폴백 탑재)
- **Design System**: Google Stitch `CareShift Clinical Roster` 토큰 및 컬러 팔레트 준수

## 3. 실행 방법
```bash
# 개발 서버 실행
npm run dev

# 빌드
npm run build
```

## 4. 파이어베이스 설정 연동
`.env` 파일에 사용하실 Firebase 콘솔의 웹앱 설정 키를 입력하시면 Firestore 실시간 동기화가 활성화됩니다:
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

