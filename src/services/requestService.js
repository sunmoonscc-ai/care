import { db, isOfflineFallback } from './firebase';
import { 
  collection, 
  doc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  query, 
  orderBy, 
  onSnapshot 
} from 'firebase/firestore';

const STORAGE_KEY_REQUESTS = 'careshift_shift_requests';

// 기본 초기 신청 데이터
const initialRequests = [
  {
    id: 'req_1',
    type: 'SWAP', // 맞교환
    typeName: '근무 맞교환',
    requesterId: 'st_7',
    requesterName: '김현자',
    targetId: 'st_8',
    targetName: '남기현',
    date: '2026-09-15',
    fromShift: 'N',
    toShift: 'B',
    reason: '집안 경조사로 인해 오후 근무로 변경 희망',
    status: 'PENDING_TARGET', // 동료 수락 대기
    statusText: '동료(남기현) 수락 대기중',
    createdAt: '2026-09-02 14:20'
  },
  {
    id: 'req_2',
    type: 'OFF', // 희망 휴무
    typeName: '희망 휴무(OFF)',
    requesterId: 'st_1',
    requesterName: '한애순',
    targetId: '',
    targetName: '-',
    date: '2026-09-17',
    fromShift: 'B',
    toShift: 'X',
    reason: '정기 종합병원 검진 예약',
    status: 'PENDING_ADMIN', // 관리자 최종 승인 대기
    statusText: '관리자 승인 대기중',
    createdAt: '2026-09-03 09:10'
  },
  {
    id: 'req_3',
    type: 'OFF',
    typeName: '희망 휴무(OFF)',
    requesterId: 'st_3',
    requesterName: '윤인국',
    targetId: '',
    targetName: '-',
    date: '2026-09-10',
    fromShift: 'X',
    toShift: 'N',
    reason: '석기호 요청에 따른 대체 야간 투입 (빨간색 N)',
    status: 'APPROVED', // 승인 완료
    statusText: '승인 완료 (근무표 반영됨)',
    createdAt: '2026-09-01 18:00'
  }
];

export async function loadRequests() {
  if (!isOfflineFallback && db) {
    try {
      const q = query(collection(db, 'requests'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      if (!snap.empty) {
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
    } catch (e) {
      console.warn("Firestore requests load error (fallback):", e);
    }
  }

  const local = localStorage.getItem(STORAGE_KEY_REQUESTS);
  if (local) {
    return JSON.parse(local);
  }

  localStorage.setItem(STORAGE_KEY_REQUESTS, JSON.stringify(initialRequests));
  return initialRequests;
}

export async function saveRequest(newReq) {
  const list = await loadRequests();
  const item = {
    id: `req_${Date.now()}`,
    ...newReq,
    createdAt: new Date().toLocaleString('ko-KR')
  };
  list.unshift(item);
  localStorage.setItem(STORAGE_KEY_REQUESTS, JSON.stringify(list));

  if (!isOfflineFallback && db) {
    try {
      await addDoc(collection(db, 'requests'), item);
    } catch (e) {
      console.warn("Firestore request add error:", e);
    }
  }

  return item;
}

export async function updateRequestStatus(reqId, newStatus, newStatusText) {
  const list = await loadRequests();
  const target = list.find(r => r.id === reqId);
  if (target) {
    target.status = newStatus;
    target.statusText = newStatusText;
    localStorage.setItem(STORAGE_KEY_REQUESTS, JSON.stringify(list));
  }

  if (!isOfflineFallback && db) {
    try {
      await updateDoc(doc(db, 'requests', reqId), {
        status: newStatus,
        statusText: newStatusText
      });
    } catch (e) {
      console.warn("Firestore request update error:", e);
    }
  }

  return target;
}

