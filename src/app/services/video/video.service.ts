import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PolariService } from '@services/polari-service';

export interface VideoCapability {
  ok: boolean;
  ffmpegAvailable: boolean;
}

export interface VideoAssetStatus {
  ok: boolean;
  status: 'pending' | 'converting' | 'ready' | 'failed';
  errorMessage: string;
  durationSeconds: number;
  width: number;
  height: number;
}

export interface VideoUploadUrl {
  ok: boolean;
  uploadUrl: string;
  sourceKey: string;
}

export interface VideoStreamUrl {
  ok: boolean;
  url: string;
  format: 'webm' | 'mp4' | 'poster' | 'hls';
}

/**
 * Thin wrapper over video-1's custom API surface (video_api.py).
 * VideoAsset rows themselves are plain CRUDE — create/list/delete via
 * CRUDEservicesManager like any other class; this service only covers
 * what CRUDE can't: capability reporting, presigned upload, conversion
 * triggering, and stream URL resolution.
 */
@Injectable({ providedIn: 'root' })
export class VideoService {
  constructor(private http: HttpClient, private polariService: PolariService) {}

  private get baseUrl(): string {
    return this.polariService.getBackendBaseUrl();
  }

  getCapability(): Observable<VideoCapability> {
    return this.http.get<VideoCapability>(
      `${this.baseUrl}/api/video/capability`,
      this.polariService.backendRequestOptions
    );
  }

  getStatus(assetName: string): Observable<VideoAssetStatus> {
    return this.http.get<VideoAssetStatus>(
      `${this.baseUrl}/api/video/assets/${encodeURIComponent(assetName)}/status`,
      this.polariService.backendRequestOptions
    );
  }

  requestUploadUrl(assetName: string, ext: string): Observable<VideoUploadUrl> {
    return this.http.get<VideoUploadUrl>(
      `${this.baseUrl}/api/video/assets/${encodeURIComponent(assetName)}/upload-url`
      + `?ext=${encodeURIComponent(ext)}`,
      this.polariService.backendRequestOptions
    );
  }

  triggerConversion(assetName: string): Observable<{ ok: boolean; status: string }> {
    return this.http.post<{ ok: boolean; status: string }>(
      `${this.baseUrl}/api/video/assets/${encodeURIComponent(assetName)}/convert`,
      {},
      this.polariService.backendRequestOptions
    );
  }

  getStreamUrl(assetName: string, format: 'webm' | 'mp4' | 'poster' | 'hls'): Observable<VideoStreamUrl> {
    return this.http.get<VideoStreamUrl>(
      `${this.baseUrl}/api/video/assets/${encodeURIComponent(assetName)}/stream-url`
      + `?format=${encodeURIComponent(format)}`,
      this.polariService.backendRequestOptions
    );
  }

  /**
   * THE way to delete a VideoAsset — removes its storage objects (source/
   * webm/mp4/poster/HLS segments) then the row. The generic CRUDE
   * `DELETE /VideoAsset` skips storage cleanup entirely (the framework has
   * no per-class delete hook), so always delete through this, not CRUDE.
   */
  deleteAsset(assetName: string): Observable<{ ok: boolean; objectsRemoved: number }> {
    return this.http.delete<{ ok: boolean; objectsRemoved: number }>(
      `${this.baseUrl}/api/video/assets/${encodeURIComponent(assetName)}`,
      this.polariService.backendRequestOptions
    );
  }

  /**
   * Uploads a File directly to object storage via a presigned PUT URL
   * (bytes never pass through the Polari backend).
   */
  uploadToPresignedUrl(uploadUrl: string, file: File): Observable<void> {
    return new Observable((subscriber) => {
      fetch(uploadUrl, { method: 'PUT', body: file })
        .then((res) => {
          if (!res.ok) {
            subscriber.error(new Error(`upload failed: HTTP ${res.status}`));
            return;
          }
          subscriber.next();
          subscriber.complete();
        })
        .catch((err) => subscriber.error(err));
    });
  }
}
