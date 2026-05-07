import { useState, useEffect } from 'react';

export function useAverageColor(imageUrl?: string | null) {
    const [color, setColor] = useState<string | null>(null);

    useEffect(() => {
        if (!imageUrl) {
            setColor(null);
            return;
        }

        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.src = imageUrl;

        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) return;

            const size = 16;
            canvas.width = size;
            canvas.height = size;

            ctx.drawImage(img, 0, 0, size, size);

            try {
                const data = ctx.getImageData(0, 0, size, size).data;

                let rSum = 0, gSum = 0, bSum = 0, count = 0;
                let fallbackR = 0, fallbackG = 0, fallbackB = 0, fallbackCount = 0;

                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];
                    const a = data[i + 3];

                    if (a < 128) continue;

                    fallbackR += r; fallbackG += g; fallbackB += b; fallbackCount++;

                    const max = Math.max(r, g, b);
                    const min = Math.min(r, g, b);
                    const saturation = max === 0 ? 0 : (max - min) / max;
                    const lightness = (max + min) / 2;

                    if (lightness > 20 && lightness < 235 && saturation > 0.15) {
                        rSum += r;
                        gSum += g;
                        bSum += b;
                        count++;
                    }
                }

                if (count === 0) {
                    rSum = fallbackR;
                    gSum = fallbackG;
                    bSum = fallbackB;
                    count = fallbackCount;
                }

                if (count > 0) {
                    const finalR = Math.round(rSum / count);
                    const finalG = Math.round(gSum / count);
                    const finalB = Math.round(bSum / count);

                    setColor(`rgb(${finalR}, ${finalG}, ${finalB})`);
                }

            } catch (e) {
                console.error("Ошибка извлечения цвета:", e);
                setColor(null);
            }
        };

        img.onerror = () => setColor(null);
    }, [imageUrl]);

    return color;
}