import { db, isOfflineFallback } from './firebase';
import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { logger } from './loggerService';
import { STORAGE_KEYS, MAX_OFF_DAYS } from '../constants';

const STORAGE_KEY_REQUESTS = STORAGE_KEYS.REQUESTS;

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
    date: '2026-12-15',
    fromShift: 'N',
    toShift: 'B',
    reason: '집안 경조사로 인해 오후 근무로 변경 희망',
    status: 'PENDING_TARGET', // 동료 수락 대기
    statusText: '동료(남기현) 수락 대기중',
    createdAt: '2026-11-02 14:20'
  }
];

export async function loadRequests() {
  let firestoreList = [];
  if (!isOfflineFallback && db) {
    try {
      const q = query(collection(db, 'requests'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      if (!snap.empty) {
        firestoreList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
    } catch (e) {
      console.warn("Firestore 로드 실패:", e.message);
    }
  }

  let localList = [];
  const local = localStorage.getItem(STORAGE_KEY_REQUESTS);
  if (local) {
    try {
      localList = JSON.parse(local);
    } catch (e) {
      console.warn("localStorage 파싱 실패:", e.message);
    }
  }

  // Firestore 데이터와 로컬스토리지 데이터를 ID 기준으로 병합 (Firestore가 최신)
  const combinedMap = new Map();
  localList.forEach(item => {
    if (item?.id) combinedMap.set(item.id, item);
  });
  firestoreList.forEach(item => {
    if (item?.id) combinedMap.set(item.id, item);
  });

  const merged = Array.from(combinedMap.values());
  if (merged.length > 0) {
    localStorage.setItem(STORAGE_KEY_REQUESTS, JSON.stringify(merged));
    return merged;
  }

  localStorage.setItem(STORAGE_KEY_REQUESTS, JSON.stringify(initialRequests));
  return initialRequests;
}

export async function saveRequest(newReq) {
  const list = await loadRequests();
  const item = {
    id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    ...newReq,
    createdAt: new Date().toLocaleString('ko-KR')
  };
  list.unshift(item);
  localStorage.setItem(STORAGE_KEY_REQUESTS, JSON.stringify(list));

  if (!isOfflineFallback && db) {
    // UI 지연 방지를 위해 비동기 백그라운드 저장
    addDoc(collection(db, 'requests'), item).catch(e => {
      console.warn("Firestore request add background warning:", e);
    });
  }

  return item;
}

// 특정 직원의 특정 월 기존 희망휴무 신청 건 전체 일괄 삭제/교체
export async function replaceStaffMonthlyOffRequests(staffId, staffName, monthPrefix, newRequestItems = []) {
  // 1. 현재 로컬 및 DB에 등록된 전체 목록 로드
  const all = await loadRequests();

  // 2. 삭제 대상 필터링: 해당 월의 모든 OFF 신청 중 staffId 또는 staffName 일치
  const inputStaffId = (staffId || '').trim().toLowerCase();
  const inputStaffName = (staffName || '').trim().toLowerCase();
  const inputEmail = newRequestItems.length > 0 ? (newRequestItems[0].requesterEmail || '').trim().toLowerCase() : '';

  const toDelete = all.filter(r => {
    if (r.type !== 'OFF' || !r.date || !r.date.startsWith(monthPrefix)) return false;

    const rStaffId = (r.requesterId || '').trim().toLowerCase();
    const rStaffName = (r.requesterName || '').trim().toLowerCase();
    const rEmail = (r.requesterEmail || '').trim().toLowerCase();

    return (inputStaffId && rStaffId === inputStaffId) ||
           (inputStaffName && rStaffName === inputStaffName) ||
           (inputEmail && rEmail === inputEmail);
  });

  const deleteIds = new Set(toDelete.map(d => d.id));
  const remaining = all.filter(r => !deleteIds.has(r.id));

  // 3. 새 신청 건 생성 (MAX_OFF_DAYS 초과 방지)
  const validatedItems = newRequestItems.map(item => ({
    ...item,
    requesterEmail: (item.requesterEmail || '').toLowerCase().trim(),
    requesterPhone: (item.requesterPhone || '').replace(/[^0-9]/g, '')
  }));

  // 각 rank 별로 최대 MAX_OFF_DAYS개만 유지
  const rank1Items = validatedItems.filter(i => i.rank === 1).slice(0, MAX_OFF_DAYS);
  const rank2Items = validatedItems.filter(i => i.rank === 2).slice(0, MAX_OFF_DAYS);
  const rank3Items = validatedItems.filter(i => i.rank === 3).slice(0, MAX_OFF_DAYS);

  const preparedNew = [...rank1Items, ...rank2Items, ...rank3Items].map((item, idx) => ({
    id: `req_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 4)}`,
    ...item,
    createdAt: new Date().toLocaleString('ko-KR')
  }));

  // 4. 로컬 캐시 즉시 갱신
  const updatedList = [...preparedNew, ...remaining];
  localStorage.setItem(STORAGE_KEY_REQUESTS, JSON.stringify(updatedList));

  // 5. Firestore 동기화
  if (!isOfflineFallback && db) {
    try {
      const q = query(collection(db, 'requests'));
      const snap = await getDocs(q);
      const deletePromises = [];

      snap.forEach(docSnap => {
        const data = docSnap.data();
        if (data.type !== 'OFF' || !data.date || !data.date.startsWith(monthPrefix)) return;

        const rStaffId = (data.requesterId || '').trim().toLowerCase();
        const rStaffName = (data.requesterName || '').trim().toLowerCase();
        const rEmail = (data.requesterEmail || '').trim().toLowerCase();

        if ((inputStaffId && rStaffId === inputStaffId) ||
            (inputStaffName && rStaffName === inputStaffName) ||
            (inputEmail && rEmail === inputEmail)) {
          deletePromises.push(deleteDoc(doc(db, 'requests', docSnap.id)));
        }
      });

      if (deletePromises.length > 0) {
        await Promise.all(deletePromises);
      }

      if (preparedNew.length > 0) {
        const addPromises = preparedNew.map(item => addDoc(collection(db, 'requests'), item));
        await Promise.all(addPromises);
      }
    } catch (e) {
      logger.error('RequestService', 'Firestore 동기화 실패', e);
    }
  }

  return preparedNew;
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
