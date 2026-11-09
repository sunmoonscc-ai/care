# 신규 사용자 가입신청 테스트 가이드

## 📋 개요

신규 사용자가 로그인하면 자동으로 Firestore에 가입신청이 생성되고, 관리자가 이를 승인/거절할 수 있습니다.

---

## 🔄 전체 플로우

```
1. 신규 사용자 로그인
   ↓
2. Firestore에 프로필 조회 → 없음
   ↓
3. registerNewUserRequest() → Firestore 저장 (status: PENDING)
   ↓
4. 사용자: pending 화면 (대기 중)
   ↓
5. 관리자: 회원 승인 관리 페이지에서 신청 확인
   ↓
6. 관리자: 승인 (REGULAR/ASSOCIATE/GUEST) 또는 거절
   ↓
7. 사용자: 로그아웃 후 재로그인 → 화면 변경
```

---

## 🧪 테스트 단계

### **Step 1: 2개 브라우저 탭 준비**

**탭 1 (사용자 역할)**:
- http://localhost:5175 열기
- Google 로그인: 새 계정 또는 테스트 이메일

**탭 2 (관리자 역할)**:
- http://localhost:5175 열기
- Google 로그인: `hdcc6th@gmail.com` (관리자 계정)

---

### **Step 2: 탭 1에서 신규 사용자 로그인**

1. "로그인" 버튼 클릭
2. Google 계정 선택 (예: `newuser@example.com`)
3. 로그인 완료

**예상 화면**:
- "승인 대기 중..." 메시지
- "관리자의 승인을 기다리고 있습니다"

**콘솔 로그 (F12 → Console)**:
```
🔐 [auth] 인증 상태 변경: {isLoggedIn: true, email: "newuser@example.com", isAdmin: false}
👤 [auth] 사용자 프로필 조회 시작: newuser@example.com
ℹ️ [getUserProfile] Firestore에 프로필 없음
📝 [auth] 신규 사용자 - 가입 신청 생성
💾 [registerNewUserRequest] 로컬 저장 완료: newuser@example.com
✅ [registerNewUserRequest] Firestore 저장 완료: newuser@example.com
✅ [auth] 가입 신청 생성 완료: {...}
⏳ [auth] 승인 대기 사용자 - pending 화면 전환
```

---

### **Step 3: 탭 2에서 신청 확인 (관리자)**

1. 관리자 탭에서 "회원 승인·관리" 클릭
2. 좌측 상단 "가입 승인 대기" 탭 확인

**예상 표시**:
```
가입 승인 대기 [1]  ← 신규 신청 1건 표시
```

**신규 사용자 카드 표시**:
```
📌 newuser@example.com
이름: newuser
신청일: 2026-11-09 HH:MM:SS

[정회원 승인] [준회원 승인] [임시회원 (둘러보기)] [가입 거절]
```

**콘솔 로그**:
```
👂 [listenToPendingUsers] 시작
📡 [listenToPendingUsers] 업데이트: 대기중 1명
✅ [listenToPendingUsers] 초기 로드: 대기중 1명, [{email: "newuser@example.com", ...}]
```

---

### **Step 4: 관리자가 승인**

1. 신규 사용자 카드에서 "정회원 승인" 클릭
2. 직원명 선택 (필요시)
3. 승인

**예상 결과**:
```
✅ [newuser@example.com] 사용자가 [정회원]으로 승인되었습니다.
```

**Firestore 변경**:
```
users/newuser@example.com
- status: "PENDING" → "APPROVED"
- role: "PENDING" → "REGULAR"
- approvedAt: "2026-11-09 HH:MM:SS"
```

---

### **Step 5: 사용자 화면 자동 갱신**

**탭 1 (사용자 브라우저)**:
1. 페이지 자동 갱신 또는 F5 새로고침
2. 화면이 "내 근무" (mobile)로 변경

**또는 수동으로 확인**:
```javascript
// 콘솔에서 실행
DIAG.testGetUserProfile('newuser@example.com')
```

**예상 로그**:
```
✅ 프로필 조회 성공: {
  email: "newuser@example.com",
  role: "REGULAR",
  status: "APPROVED",
  approvedAt: "2026-11-09 HH:MM:SS"
}
```

---

## 🔍 문제 해결

### 1️⃣ "신청이 관리자 페이지에 표시되지 않음"

**확인 사항**:
```javascript
// 콘솔에서 실행
DIAG.checkFirestoreUsers()
// newuser@example.com이 포함되어야 함
```

**가능한 원인**:
- Firestore 보안 규칙 오류
- 네트워크 문제
- 캐시 문제 (Ctrl+Shift+R)

**해결책**:
1. F5 새로고침
2. 관리자 페이지에서 "가입 승인 대기" 탭 재클릭
3. 5초 대기 (자동 갱신)

### 2️⃣ "신청 저장이 안 됨"

**콘솔 로그 확인**:
```
❌ [registerNewUserRequest] Firestore 저장 실패: {code: "...", message: "..."}
```

**해결책**:
1. Firestore 보안 규칙 확인
2. 네트워크 연결 확인
3. Firestore 상태 확인 (Firebase Console)

### 3️⃣ "승인 후 사용자 화면이 안 바뀜"

**해결책**:
1. 사용자 브라우저에서 F5 새로고침
2. 또는 로그아웃 후 재로그인
3. 콘솔에서 `DIAG.testGetUserProfile(email)` 확인

---

## 📊 테스트 체크리스트

- [ ] 신규 사용자 로그인 가능
- [ ] pending 화면 표시됨
- [ ] 콘솔에 "신규 사용자 - 가입 신청 생성" 로그 표시
- [ ] 콘솔에 "Firestore 저장 완료" 로그 표시
- [ ] 관리자 페이지에 신청 1건 표시됨 (5초 이내)
- [ ] 관리자가 승인 가능
- [ ] Firestore에 status가 PENDING → APPROVED로 변경
- [ ] 사용자 페이지 새로고침 후 화면 변경됨

---

## 🔧 수동 테스트 (콘솔)

```javascript
// 신규 사용자 데이터 생성 및 저장
await DIAG.testGetUserProfile('test-new-user@example.com')

// 전체 사용자 목록 확인
await DIAG.testListAllUsers()

// Firestore 데이터 직접 확인
DIAG.checkFirestoreUsers()

// 로컬 캐시 확인
DIAG.checkLocalStorage()
```

---

## 📝 시나리오별 테스트

### 시나리오 1: 신규 사용자 가입 → 승인
1. 신규 이메일로 로그인
2. pending 화면 확인
3. 관리자에서 "정회원 승인"
4. 사용자 페이지 갱신 → mobile 화면 확인 ✓

### 시나리오 2: 신규 사용자 가입 → 거절
1. 신규 이메일로 로그인
2. pending 화면 확인
3. 관리자에서 "가입 거절" (이유 입력)
4. 사용자 페이지 갱신 → pending 화면 유지 (거절 메시지) ✓

### 시나리오 3: 여러 신청 동시 처리
1. 여러 신규 사용자 동시 로그인
2. 관리자 페이지에 모두 표시되는지 확인
3. 일부만 승인, 일부는 거절 ✓

---

**마지막 업데이트**: 2026-11-09
