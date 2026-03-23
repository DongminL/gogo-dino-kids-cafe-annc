import React from 'react';
import { Download, RefreshCw, X, AlertCircle } from 'lucide-react';
import type { UpdateStatus } from '../../hooks/useUpdater';
import './UpdateNotification.scss';

interface Props {
  status: UpdateStatus;
  updateInfo: { version: string } | null;
  downloadProgress: { percent: number } | null;
  errorMessage: string | null;
  onDownload: () => void;
  onInstall: () => void;
  onDismiss: () => void;
}

export function UpdateNotification(
  {
    status, updateInfo, downloadProgress, errorMessage,
    onDownload, onInstall, onDismiss
  }: Props
) {
  if (status === 'idle' || status === 'checking' || status === 'not-available') return null;

  if (status === 'available' && updateInfo) {
    return (
      <div className="update-notification">
        <div className="update-icon-wrapper">
          <Download size={18} />
        </div>
        <span>새 버전 <strong>{updateInfo.version}</strong>이 출시되었습니다.</span>
        <button className="update-action-btn" onClick={onDownload}>업데이트</button>
        <button className="update-dismiss-btn" onClick={onDismiss}><X size={14} /></button>
      </div>
    );
  }

  if (status === 'downloading') {
    const percent = Math.round(downloadProgress?.percent ?? 0);
    return (
      <div className="update-notification downloading">
        <div className="downloading-header">
          <div className="update-icon-wrapper rotating">
            <RefreshCw size={18} />
          </div>
          <span>다운로드 중... {percent}%</span>
        </div>
        <div className="update-progress-bg">
          <div className="update-progress-fill" style={{ width: `${percent}%` }} />
        </div>
      </div>
    );
  }

  if (status === 'downloaded') {
    return (
      <div className="update-notification downloaded">
        <div className="update-icon-wrapper">
          <RefreshCw size={18} />
        </div>
        <span>업데이트 준비 완료. 재시작하면 설치됩니다.</span>
        <button className="update-action-btn" onClick={onInstall}>지금 재시작</button>
        <button className="update-dismiss-btn" onClick={onDismiss}><X size={14} /></button>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="update-notification error">
        <div className="update-icon-wrapper">
          <AlertCircle size={18} />
        </div>
        <span>업데이트 실패{errorMessage ? `: ${errorMessage}` : ''}</span>
        <button className="update-dismiss-btn" onClick={onDismiss}><X size={14} /></button>
      </div>
    );
  }

  return null;
}
