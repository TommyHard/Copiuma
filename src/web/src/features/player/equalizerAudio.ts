/**
 * Эквалайзер на WebAudio
 * Создаёт цепочку:
 *   <audio> -> MediaElementSource -> Preamp -> [BiquadPeaking ...] -> Destination
 *
 * Граф создаётся при первом включении эквалайзера
 * Если EQ выключен и граф уже создан — все полосы и preamp ставятся в 0
 */

import { EQ_FREQUENCIES, type EqualizerState } from './store';

let audioContext: AudioContext | null = null;
let sourceNode: MediaElementAudioSourceNode | null = null;
let preampNode: GainNode | null = null;
let bandNodes: BiquadFilterNode[] = [];
let attachedAudio: HTMLAudioElement | null = null;

export function ensureEqualizerGraph(audio: HTMLAudioElement) {
    if (audioContext && attachedAudio === audio) return;
    if (attachedAudio && attachedAudio !== audio) {
        try { audioContext?.close(); } catch { }
        audioContext = null;
        sourceNode = null;
        preampNode = null;
        bandNodes = [];
    }

    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;

    try {
        audioContext = new Ctx();
        sourceNode = audioContext!.createMediaElementSource(audio);
        preampNode = audioContext!.createGain();
        preampNode.gain.value = 1;

        bandNodes = EQ_FREQUENCIES.map((freq) => {
            const node = audioContext!.createBiquadFilter();
            node.type = 'peaking';
            node.frequency.value = freq;
            node.Q.value = 1.0;
            node.gain.value = 0;
            return node;
        });

        let prev: AudioNode = sourceNode!;
        prev.connect(preampNode!);
        prev = preampNode!;
        for (const b of bandNodes) {
            prev.connect(b);
            prev = b;
        }
        prev.connect(audioContext!.destination);

        attachedAudio = audio;
    } catch (e) {
        console.warn('[equalizer] init failed', e);
        audioContext = null;
        sourceNode = null;
        preampNode = null;
        bandNodes = [];
        attachedAudio = null;
    }
}

export function applyEqualizer(state: EqualizerState) {
    if (!audioContext || !preampNode) return;

    if (audioContext.state === 'suspended') {
        void audioContext.resume();
    }

    if (!state.enabled) {
        preampNode.gain.value = 1;
        for (const b of bandNodes) b.gain.value = 0;
        return;
    }

    // dB линейное усиление
    preampNode.gain.value = Math.pow(10, state.preamp / 20);
    state.bands.forEach((band, i) => {
        const node = bandNodes[i];
        if (node) node.gain.value = band.gain;
    });
}

export function isEqualizerSupported(): boolean {
    return typeof window !== 'undefined' && (!!(window as any).AudioContext || !!(window as any).webkitAudioContext);
}