// Firebase 사용자 정보 조회 디버그 스크립트
// 브라우저 콘솔에서 사용:
// import('./src/services/diagnostics.js').then(m => m.DIAGNOSTICS.runFullDiagnostics())

console.log(`
╔════════════════════════════════════════════════════════════════╗
║  Firebase 사용자 정보 조회 디버그 도구                        ║
╚════════════════════════════════════════════════════════════════╝

🔍 실행 방법:

1. 브라우저 개발자 도구 열기 (F12)
2. Console 탭에서 다음 명령 실행:

   DIAG.checkFirebaseInit()      // Firebase 초기화 상태
   DIAG.checkCurrentUser()       // 현재 로그인 사용자
   DIAG.checkFirestoreUsers()    // Firestore users 컬렉션 확인
   DIAG.checkLocalStorage()      // 로컬 캐시 상태
   DIAG.testAdminAccess()        // 관리자 테스트
   DIAG.runFullDiagnostics()     // 전체 진단 실행

📊 예상 결과:

✅ Firebase 초기화 완료
✅ 현재 로그인 사용자 확인
✅ Firestore users 컬렉션 조회
✅ 로컬 스토리지 캐시 확인
✅ 관리자 이메일 확인

❌ 문제 발생 시:
- Firestore 초기화 실패
- 네트워크 오류
- 권한 거부
- 데이터 형식 오류
`);
