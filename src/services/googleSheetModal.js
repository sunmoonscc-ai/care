// 구글 시트 웹훅 URL 설정 팝업 및 연동 컴포넌트
import { getSheetConfig, saveSheetConfig, syncRosterToGoogleSheet } from '../services/googleSheetService';

export function setupGoogleSheetModal(container, rosterData) {
  let modal = document.getElementById('modal-gsheet-config');
  if (!modal) {
    const modalHtml = `
      <div id="modal-gsheet-config" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs hidden">
        <div class="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div class="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-emerald-700 text-[22px]">table_view</span>
              <h3 class="font-bold text-slate-900 text-sm">구글 시트(Google Sheets) 양방향 연동 설정</h3>
            </div>
            <button id="btn-close-gsheet-modal" class="text-slate-400 hover:text-slate-600 p-1">
              <span class="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>

          <div class="p-5 space-y-4 text-xs">
            <div>
              <label class="block font-bold text-slate-700 mb-1">1. 연동할 구글 시트 URL</label>
              <input id="input-gsheet-url" type="url" placeholder="https://docs.google.com/spreadsheets/d/.../edit" class="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:border-teal-600"/>
              <p class="text-[11px] text-slate-400 mt-1">실제 병원에서 작성 중인 구글 시트 링크를 입력하세요.</p>
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">2. 구글 Apps Script 웹앱 배포 URL (Webhook)</label>
              <input id="input-gsheet-webhook" type="url" placeholder="https://script.google.com/macros/s/.../exec" class="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:border-teal-600 font-mono text-[11px]"/>
              <p class="text-[11px] text-slate-500 mt-1">
                💡 구글 시트의 [확장 프로그램] > [Apps Script]에 <code>google-apps-script-sync.js</code> 내용을 붙여넣고 배포한 웹앱 URL을 입력하시면 실시간 양방향 저장이 작동합니다.
              </p>
            </div>

            <div class="p-3 bg-emerald-50 rounded-lg border border-emerald-200 space-y-1">
              <div class="font-bold text-emerald-900 flex items-center gap-1">
                <span class="material-symbols-outlined text-[16px]">sync</span>
                현재 상태: <span id="gsheet-status-text">시뮬레이션 모드 (로컬 가상 연동)</span>
              </div>
              <p class="text-[11px] text-emerald-800">
                파이어베이스 프로젝트 <b>care-798f1</b>과 완벽히 연계되어 있으며, 배포 URL을 입력하면 실제 구글 시트 파일로 직접 데이터가 즉시 전달됩니다.
              </p>
            </div>
          </div>

          <div class="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
            <button id="btn-cancel-gsheet" class="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded font-semibold text-xs transition">
              닫기
            </button>
            <button id="btn-save-gsheet-config" class="px-4 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded font-bold text-xs shadow-sm transition">
              설정 저장 & 즉시 동기화
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    modal = document.getElementById('modal-gsheet-config');
  }

  const inputUrl = modal.querySelector('#input-gsheet-url');
  const inputWebhook = modal.querySelector('#input-gsheet-webhook');
  const statusText = modal.querySelector('#gsheet-status-text');

  // 오픈 함수
  const openModal = () => {
    const config = getSheetConfig();
    inputUrl.value = config.sheetUrl || '';
    inputWebhook.value = config.scriptWebhookUrl || '';
    statusText.innerText = config.scriptWebhookUrl ? '실시간 구글 시트 Webhook 연결됨' : '시뮬레이션 모드 (URL 미입력)';
    modal.classList.remove('hidden');
  };

  modal.querySelector('#btn-close-gsheet-modal')?.addEventListener('click', () => modal.classList.add('hidden'));
  modal.querySelector('#btn-cancel-gsheet')?.addEventListener('click', () => modal.classList.add('hidden'));

  modal.querySelector('#btn-save-gsheet-config')?.addEventListener('click', async () => {
    const config = getSheetConfig();
    config.sheetUrl = inputUrl.value.trim();
    config.scriptWebhookUrl = inputWebhook.value.trim();
    saveSheetConfig(config);

    // 시트 링크 갱신
    const linkEl = document.getElementById('link-open-gsheet');
    if (linkEl && config.sheetUrl) {
      linkEl.href = config.sheetUrl;
    }

    modal.classList.add('hidden');
    const res = await syncRosterToGoogleSheet(rosterData);
    alert(`✅ 설정이 저장되었습니다.\n${res.message}`);
  });

  return openModal;
}

