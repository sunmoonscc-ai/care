# Firebase 사용자 정보 조회 디버그 가이드

## 🔍 현재 상황

- ✅ Firebase Authentication: Google OAuth 로그인
- ✅ Firestore: users 컬렉션에서 사용자 정보 저장/조회
- ❓ 문제: 사용자 정보가 제대로 불러와지지 않음

---

## 🚀 즉시 테스트 방법

### 1. 앱 실행 및 로그인

```bash
# 개발 서버 실행 (이미 실행 중)
npm run dev

# 브라우저: http://localhost:5175
```

### 2. 개발자 도구 콘솔 열기

- **F12** 또는 **우클릭 > 검사** → **Console** 탭

### 3. 로그인 후 콘솔 확인

**예상 로그 (정상)**:
```
🔐 [auth] 인증 상태 변경: {isLoggedIn: true, email: "hdcc6th@gmail.com", isAdmin: true}
👤 [auth] 사용자 프로필 조회 시작: hdcc6th@gmail.com
✅ [auth] 프로필 조회 성공: {email: "hdcc6th@gmail.com", role: "ADMIN", status: "APPROVED"}
👑 [auth] 관리자 계정 - editor 화면 전환
```

**예상 로그 (신규 사용자)**:
```
🔐 [auth] 인증 상태 변경: {isLoggedIn: true, email: "newuser@example.com", isAdmin: false}
👤 [auth] 사용자 프로필 조회 시작: newuser@example.com
ℹ️ [getUserProfile] Firestore에 프로필 없음
📝 [auth] 신규 사용자 - 가입 신청 생성
✅ [auth] 가입 신청 생성 완료: {email: "newuser@example.com", role: "PENDING", status: "PENDING"}
⏳ [auth] 승인 대기 사용자 - pending 화면 전환
```

---

## 🔧 전체 진단 실행

### 콘솔에서 다음 명령 실행:

```javascript
// 1. Firebase 초기화 상태 확인
DIAG.checkFirebaseInit()

// 2. 현재 로그인 사용자 확인
DIAG.checkCurrentUser()

// 3. Firestore users 컬렉션 확인
DIAG.checkFirestoreUsers()

// 4. 로컬 스토리지 캐시 확인
DIAG.checkLocalStorage()

// 5. 관리자 이메일 테스트
DIAG.testAdminAccess()

// 6. 특정 사용자 프로필 조회
DIAG.testGetUserProfile('hdcc6th@gmail.com')

// 7. 전체 진단 실행
DIAG.runFullDiagnostics()
```

---

## ❌ 문제 해결

### 1️⃣ "Firebase 초기화 실패" 오류

```
❌ [firebase.js] Firebase 초기화 실패: {code: "...", message: "..."}
```

**원인**: Firebase 설정이 잘못됨

**해결**:
```javascript
// src/services/firebase.js 확인
// apiKey, projectId, authDomain 등 설정 확인
console.log("설정:", firebaseConfig)
```

### 2️⃣ "Firestore 조회 실패" 오류

```
❌ [getUserProfile] Firestore 오류: {code: "permission-denied", message: "..."}
```

**원인**: Firestore 보안 규칙 문제

**확인**:
1. Firebase Console → Firestore → Rules
2. 현재 규칙 확인:
```javascript
match /users/{email} {
  allow read: if isAuthenticated();
  allow create, update, delete: if isAdmin();
}
```

### 3️⃣ "프로필이 계속 null"

```
⚠️ [getUserProfile] 프로필 없음 (신규 사용자)
```

**원인**: 사용자가 Firestore에 없음 (정상, 신규 사용자)

**해결**: 
- 관리자가 users 컬렉션에서 수동으로 승인
- 또는 신규 사용자가 자동 가입 신청되기를 기다림

### 4️⃣ "로컬 스토리지 에러"

```
❌ [saveLocalUsers] 저장 실패: {name: "...", message: "..."}
```

**원인**: 브라우저 저장소 부족

**해결**:
1. 브라우저 캐시 삭제
2. 또는 private/incognito 모드로 테스트

---

## 📊 데이터 흐름 확인

### 정상 흐름:

```
로그인
  ↓
Firebase Auth 사용자 정보 획득
  ├─ uid: "..."
  ├─ email: "hdcc6th@gmail.com"
  ├─ displayName: "..."
  └─ photoURL: "..."
  ↓
Firestore 'users' 컬렉션 조회
  ├─ users/hdcc6th@gmail.com (EXISTS)
  │   ├─ email
  │   ├─ role
  │   ├─ status
  │   └─ ...
  ↓
로컬 스토리지 캐시 저장
  ├─ careshift_users_directory
  │   └─ hdcc6th@gmail.com: {...}
  ↓
화면 렌더링
  ├─ 관리자 → editor 화면
  ├─ 대기 사용자 → pending 화면
  └─ 승인된 사용자 → mobile 화면
```

---

## 🔐 Firestore 보안 규칙 (현재 설정)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // 인증 확인
    function isAuthenticated() {
      return request.auth != null;
    }

    // 관리자 확인
    function isAdmin() {
      return isAuthenticated() && request.auth.token.email in [
        'hdcc6th@gmail.com',
        'sunmoon.scc@gmail.com'
      ];
    }

    // users 컬렉션
    match /users/{email} {
      allow read: if isAuthenticated();         // 모든 인증 사용자 읽기
      allow create, update, delete: if isAdmin(); // 관리자만 수정
    }

    // 기본 규칙: 모든 다른 접근 거부
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

---

## 📋 체크리스트

로그인 후 다음을 확인하세요:

- [ ] Console 탭에 에러 없음
- [ ] `[auth] 인증 상태 변경` 로그 표시됨
- [ ] `[auth] 프로필 조회 성공` 로그 표시됨
- [ ] 화면이 정상적으로 변환됨 (login → editor/mobile/pending)
- [ ] `DIAG.runFullDiagnostics()` 실행 시 모두 ✅ 표시됨

---

## 💡 추가 팁

### 1. Firebase 콘솔에서 직접 확인

1. Firebase Console → Firestore Database
2. `users` 컬렉션 선택
3. 문서 목록에 사용자 이메일 있는지 확인
4. 각 문서의 데이터 확인

### 2. Network 탭에서 Firestore 요청 확인

1. F12 → Network 탭
2. 로그인 후 요청 필터링
3. `firestore.googleapis.com` 요청 확인
4. 응답 상태 코드 확인 (200이 정상)

### 3. 강제 새로고침

```
Ctrl + Shift + R (Windows)
Cmd + Shift + R (Mac)
```

캐시를 무시하고 새로 로드합니다.

---

## 🆘 여전히 문제가 있으면

다음 정보를 수집해서 보고하세요:

1. `DIAG.runFullDiagnostics()` 결과
2. Console 탭의 모든 에러 메시지
3. Network 탭의 실패한 요청
4. Firebase Console의 rules 설정
5. Firestore 'users' 컬렉션 데이터

---

**마지막 업데이트**: 2026-11-09
