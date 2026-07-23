import { registerDisplayComponent } from '@models/dashboards/ComponentRegistry';
import { VideoPlayerComponent } from './video-player.component';

let registered = false;

/**
 * Registers the video-1 player with the Display component registry
 * (same lazy pattern as registerAquaponicsDisplayComponents /
 * registerMsciDisplayComponents — called from the display-page surface
 * so video.js stays out of the main bundle until a page actually uses it).
 */
export function registerVideoDisplayComponents(): void {
  if (registered) return;
  registered = true;

  registerDisplayComponent(
    'videoPlayer', VideoPlayerComponent, {
      displayName: 'Video Player',
      description: 'Self-hosted video playback (video-1) — Video.js over '
        + 'WebM/MP4 progressive streaming, with adaptive HLS used '
        + 'automatically when the bound VideoAsset has adaptive_enabled '
        + 'turned on (input: assetName, or direct webmUrl/mp4Url/'
        + 'posterUrl/hlsUrl)',
      defaultInputs: { assetName: '', title: '' },
    });
}
