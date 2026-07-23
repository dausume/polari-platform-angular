import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { CRUDEservicesManager } from '@services/crude-services-manager';
import { CRUDEclassService } from '@services/crude-class-service';
import { VideoService, VideoCapability } from '@services/video/video.service';
import { VideoPlayerComponent } from './video-player.component';

interface VideoAssetRow {
  id: string;
  name: string;
  display_name: string;
  status: 'pending' | 'converting' | 'ready' | 'failed';
  error_message: string;
  adaptive_enabled: boolean;
  duration_seconds: number;
  width: number;
  height: number;
}

const CLASS_NAME = 'VideoAsset';

/**
 * video-1 admin page: create a VideoAsset, upload its source file via a
 * presigned PUT, trigger ffmpeg conversion, watch it become ready, and
 * preview it inline. A thin UI over video.service.ts + generic CRUDE —
 * VideoAsset rows themselves are plain CRUDE, nothing bespoke there.
 */
@Component({
  standalone: true,
  selector: 'video-assets-page',
  templateUrl: './video-assets-page.component.html',
  styleUrls: ['./video-assets-page.component.scss'],
  imports: [
    CommonModule, FormsModule, MatButtonModule, MatIconModule,
    MatInputModule, MatFormFieldModule, MatCheckboxModule, MatProgressSpinnerModule,
    VideoPlayerComponent,
  ],
})
export class VideoAssetsPageComponent implements OnInit {
  assets: VideoAssetRow[] = [];
  loading = false;
  capability: VideoCapability | null = null;

  newName = '';
  newDisplayName = '';
  newAdaptiveEnabled = false;
  selectedFile: File | null = null;
  creating = false;
  createError = '';
  previewAssetName: string | null = null;

  private statusPollHandle: ReturnType<typeof setTimeout> | null = null;
  private crudeService!: CRUDEclassService;

  constructor(
    private crudeManager: CRUDEservicesManager,
    private videoService: VideoService,
  ) {}

  ngOnInit(): void {
    this.crudeService = this.crudeManager.getCRUDEclassService(CLASS_NAME);
    this.videoService.getCapability().subscribe({
      next: (cap) => (this.capability = cap),
      error: () => (this.capability = { ok: false, ffmpegAvailable: false }),
    });
    this.refresh();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFile = input.files?.[0] ?? null;
    if (this.selectedFile && !this.newDisplayName) {
      this.newDisplayName = this.selectedFile.name.replace(/\.[^.]+$/, '');
    }
  }

  createAndUpload(): void {
    if (!this.newName.trim() || !this.selectedFile) {
      this.createError = 'A name and a file are both required.';
      return;
    }
    this.creating = true;
    this.createError = '';

    this.crudeService.create({
      name: this.newName.trim(),
      display_name: this.newDisplayName.trim() || this.newName.trim(),
      adaptive_enabled: this.newAdaptiveEnabled,
    }).subscribe({
      next: () => this.uploadAfterCreate(this.newName.trim(), this.selectedFile!),
      error: (err) => {
        this.creating = false;
        this.createError = `Could not create video asset: ${err?.message || err}`;
      },
    });
  }

  private uploadAfterCreate(assetName: string, file: File): void {
    const ext = (file.name.split('.').pop() || 'mp4').toLowerCase();
    this.videoService.requestUploadUrl(assetName, ext).subscribe({
      next: (uploadInfo) => {
        this.videoService.uploadToPresignedUrl(uploadInfo.uploadUrl, file).subscribe({
          next: () => this.startConversion(assetName),
          error: (err) => {
            this.creating = false;
            this.createError = `Upload failed: ${err?.message || err}`;
          },
        });
      },
      error: (err) => {
        this.creating = false;
        this.createError = `Could not get an upload URL: ${err?.message || err}`;
      },
    });
  }

  private startConversion(assetName: string): void {
    this.videoService.triggerConversion(assetName).subscribe({
      next: () => {
        this.creating = false;
        this.newName = '';
        this.newDisplayName = '';
        this.newAdaptiveEnabled = false;
        this.selectedFile = null;
        this.refresh();
        this.pollUntilSettled();
      },
      error: (err) => {
        this.creating = false;
        this.createError = `Could not start conversion: ${err?.message || err}`;
      },
    });
  }

  private pollUntilSettled(): void {
    if (this.statusPollHandle) clearTimeout(this.statusPollHandle);
    this.statusPollHandle = setTimeout(() => {
      this.refresh();
      const stillWorking = this.assets.some(
        (a) => a.status === 'pending' || a.status === 'converting');
      if (stillWorking) this.pollUntilSettled();
    }, 4000);
  }

  refresh(): void {
    this.loading = true;
    this.crudeService.readAll().subscribe({
      next: (envelope: any) => {
        const rows = envelope?.[0]?.[CLASS_NAME]?.[0]?.data ?? [];
        this.assets = rows.map((r: any) => ({
          id: r.id, name: r.name, display_name: r.display_name,
          status: r.status, error_message: r.error_message,
          adaptive_enabled: !!r.adaptive_enabled,
          duration_seconds: r.duration_seconds, width: r.width, height: r.height,
        }));
        this.loading = false;
      },
      error: () => (this.loading = false),
    });
  }

  deleteAsset(row: VideoAssetRow): void {
    // Goes through video.service's delete (storage cleanup + row delete),
    // NOT crudeService.delete — that would orphan the asset's S3 objects.
    this.videoService.deleteAsset(row.name).subscribe({
      next: () => {
        if (this.previewAssetName === row.name) this.previewAssetName = null;
        this.refresh();
      },
      error: (err) => {
        this.createError = `Could not delete ${row.name}: ${err?.message || err}`;
      },
    });
  }

  togglePreview(row: VideoAssetRow): void {
    this.previewAssetName = this.previewAssetName === row.name ? null : row.name;
  }
}
