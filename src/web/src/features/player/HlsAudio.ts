import Hls from 'hls.js';
import { tokenStore } from '@/shared/lib/tokenStore';

export class HlsAudio {
  private hls: Hls | null = null;
  private audio: HTMLAudioElement;

  constructor(audio: HTMLAudioElement) {
    this.audio = audio;
  }

  load(masterUrl: string) {
    this.detach();

    if (!Hls.isSupported()) {
      this.audio.src = masterUrl;
      return;
    }

    const hls = new Hls({
      xhrSetup(xhr) {
        const token = tokenStore.getAccess();
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      },
      lowLatencyMode: false,
      maxBufferLength: 30,
      maxMaxBufferLength: 60,
    });

    hls.loadSource(masterUrl);
    hls.attachMedia(this.audio);
    this.hls = hls;
  }

  detach() {
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
    this.audio.removeAttribute('src');
    this.audio.load();
  }
}