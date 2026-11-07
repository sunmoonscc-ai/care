import { db, isOfflineFallback } from './firebase';
import { doc, onSnapshot } from 'firebase/firestore';

/**
 * Firestore의 'rosters/202609_2fl' 문서 변경 사항을 실시간 감시하는 리스너
 * PC 구글 시트에서 수정되었거나 다른 관리자가 수정했을 때 즉각 로컬 state와 UI 갱신
 */
export function subscribeRosterChanges(onUpdate) {
  if (isOfflineFallback || !db) {
    return () => {};
  }

  try {
    const docRef = doc(db, 'rosters', '202609_2fl');
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const remoteData = docSnap.data();
        console.log("🔥 [Firestore Realtime Sync] 원격 근무표 변경 감지:", remoteData.version);
        onUpdate(remoteData);
      }
    }, (error) => {
      console.warn("Firestore 실시간 구독 오류:", error);
    });

    return unsubscribe;
  } catch (error) {
    console.warn("실시간 리스너 연결 실패:", error);
    return () => {};
  }
}

