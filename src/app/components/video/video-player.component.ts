import {
  Component, ElementRef, Input, OnChanges, OnDestroy, OnInit,
  SimpleChanges, ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import videojs from 'video.js';
import Player from 'video.js/dist/types/player';
import { VideoService } from '@services/video/video.service';

/**
 * Self-hosted video playback (video-1). Wraps Video.js — fully
 * open-source, MIT-ecosystem player with adaptive streaming (HLS/DASH
 * via its built-in VHS) already available should a given asset opt in.
 *
 * Two ways to use it:
 *   - [assetName]="'my-clip'"        resolves stream URLs itself via
 *                                     VideoService (status polling while
 *                                     converting, then webm/mp4/poster,
 *                                     and an hls attempt for the adaptive
 *                                     path — falls back to progressive
 *                                     silently if no HLS rendition exists).
 *   - [webmUrl]/[mp4Url]/[posterUrl]/[hlsUrl]  direct URLs, when already
 *                                     known (bypasses asset resolution).
 */
@Component({
  standalone: true,
  selector: 'video-player',
  templateUrl: './video-player.component.html',
  styleUrls: ['./video-player.component.scss'],
  imports: [CommonModule],
})
export class VideoPlayerComponent implements OnInit, OnChanges, OnDestroy {
  @Input() assetName: string = '';
  @Input() webmUrl: string = '';
  @Input() mp4Url: string = '';
  @Input() posterUrl: string = '';
  @Input() hlsUrl: string = '';
  @Input() title: string = '';

  @ViewChild('videoEl', { static: true }) videoElRef!: ElementRef<HTMLVideoElement>;

  player: Player | null = null;
  loading = false;
  converting = false;
  error = '';

  private statusPollHandle: ReturnType<typeof setTimeout> | null = null;
  private initialized = false;

  constructor(private videoService: VideoService) {}

  ngOnInit(): void {
    this.initialized = true;
    this.resolveAndPlay();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.initialized) return;
    if (changes['assetName'] || changes['webmUrl'] || changes['mp4Url']
      || changes['hlsUrl'] || changes['posterUrl']) {
      this.resolveAndPlay();
    }
  }

  ngOnDestroy(): void {
    this.clearPoll();
    this.player?.dispose();
    this.player = null;
  }

  private clearPoll(): void {
    if (this.statusPollHandle) {
      clearTimeout(this.statusPollHandle);
      this.statusPollHandle = null;
    }
  }

  private resolveAndPlay(): void {
    this.clearPoll();
    this.error = '';

    if (this.webmUrl || this.mp4Url || this.hlsUrl) {
      this.playSources(this.webmUrl, this.mp4Url, this.hlsUrl, this.posterUrl);
      return;
    }
    if (!this.assetName) {
      this.error = 'No video source provided.';
      return;
    }
    this.loading = true;
    this.pollStatus();
  }

  private pollStatus(): void {
    this.videoService.getStatus(this.assetName).subscribe({
      next: (status) => {
        if (status.status === 'ready') {
          this.loading = false;
          this.converting = false;
          this.fetchStreamUrlsAndPlay();
        } else if (status.status === 'failed') {
          this.loading = false;
          this.converting = false;
          this.error = status.errorMessage || 'Conversion failed.';
        } else {
          // pending / converting — keep polling.
          this.converting = status.status === 'converting';
          this.statusPollHandle = setTimeout(() => this.pollStatus(), 4000);
        }
      },
      error: (err) => {
        this.loading = false;
        this.error = `Could not load video status: ${err?.message || err}`;
      },
    });
  }

  private fetchStreamUrlsAndPlay(): void {
    // Progressive renditions are expected once status is 'ready'.
    this.videoService.getStreamUrl(this.assetName, 'mp4').subscribe({
      next: (mp4) => {
        this.videoService.getStreamUrl(this.assetName, 'webm').subscribe({
          next: (webm) => this.fetchOptionalHlsThenPlay(webm.url, mp4.url),
          error: () => this.fetchOptionalHlsThenPlay('', mp4.url),
        });
      },
      error: (err) => {
        this.error = `Could not resolve playback URL: ${err?.message || err}`;
      },
    });
  }

  private fetchOptionalHlsThenPlay(webmUrl: string, mp4Url: string): void {
    this.videoService.getStreamUrl(this.assetName, 'poster').subscribe({
      next: (poster) => this.tryHlsThenPlay(webmUrl, mp4Url, poster.url),
      error: () => this.tryHlsThenPlay(webmUrl, mp4Url, ''),
    });
  }

  private tryHlsThenPlay(webmUrl: string, mp4Url: string, posterUrl: string): void {
    // Adaptive is opt-in per asset — a 404 here just means it wasn't
    // enabled (or hasn't finished), so progressive-only is the normal,
    // expected outcome, not an error.
    this.videoService.getStreamUrl(this.assetName, 'hls').subscribe({
      next: (hls) => this.playSources(webmUrl, mp4Url, hls.url, posterUrl),
      error: () => this.playSources(webmUrl, mp4Url, '', posterUrl),
    });
  }

  private playSources(webmUrl: string, mp4Url: string, hlsUrl: string, posterUrl: string): void {
    const sources: { src: string; type: string }[] = [];
    if (hlsUrl) {
      sources.push({ src: hlsUrl, type: 'application/x-mpegURL' });
    } else {
      if (webmUrl) sources.push({ src: webmUrl, type: 'video/webm' });
      if (mp4Url) sources.push({ src: mp4Url, type: 'video/mp4' });
    }
    if (!sources.length) {
      this.error = 'No playable rendition available.';
      return;
    }

    if (!this.player) {
      this.player = videojs(this.videoElRef.nativeElement, {
        controls: true,
        preload: 'metadata',
        fluid: true,
        responsive: true,
      });
    }
    if (posterUrl) {
      this.player.poster(posterUrl);
    }
    this.player.src(sources);
  }
}
