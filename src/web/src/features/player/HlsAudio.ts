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

        hls.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
                switch (data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR:
                        if (data.response && data.response.code === 425) {
                            console.warn("HLS segments are not ready yet (425 Too Early). Waiting for processing...");
                            this.detach();
                        } else {
                            console.error('Fatal network error encountered, try to recover');
                            hls.startLoad();
                        }
                        break;
                    case Hls.ErrorTypes.MEDIA_ERROR:
                        console.error('Fatal media error encountered, try to recover');
                        hls.recoverMediaError();
                        break;
                    default:
                        this.detach();
                        break;
                }
            }
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