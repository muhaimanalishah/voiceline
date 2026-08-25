import { useRef, useCallback } from "react";

export interface UseWaveformVisualizerOptions {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

export function useWaveformVisualizer({ canvasRef }: UseWaveformVisualizerOptions) {
  const animationFrameRef = useRef<number | null>(null);

  const stopVisualizer = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const startVisualizer = useCallback((analyser: AnalyserNode) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.45;
    analyser.minDecibels = -85;
    analyser.maxDecibels = -10;
    const bufferLength = analyser.frequencyBinCount;
    const freqData = new Uint8Array(bufferLength);
    const timeData = new Uint8Array(bufferLength);

    // Maintain a rolling history buffer of columns moving left-to-right
    const numBars = 45;
    const history = new Array<number>(numBars).fill(0.08);

    const render = () => {
      animationFrameRef.current = requestAnimationFrame(render);
      analyser.getByteFrequencyData(freqData);
      analyser.getByteTimeDomainData(timeData);

      // Human speech core frequency range (roughly bins 1 to 24)
      let energy = 0;
      const startBin = 1;
      const endBin = Math.min(bufferLength, 24);
      for (let i = startBin; i < endBin; i++) {
        energy += freqData[i];
      }
      const avgEnergy = energy / (endBin - startBin); // 0 - 255

      // Calculate time-domain peak variation (deviation from 128)
      let peak = 0;
      for (let i = 0; i < bufferLength; i++) {
        const val = Math.abs(timeData[i] - 128);
        if (val > peak) peak = val;
      }

      // High-sensitivity normalization curve for voice
      const freqNorm = Math.min(1.0, avgEnergy / 80);
      const peakNorm = Math.min(1.0, peak / 30);
      const combined = Math.max(freqNorm * 1.35, peakNorm * 1.2);
      const boosted = Math.pow(combined, 0.72) * 1.2;
      const amp = Math.max(0.08, Math.min(1.0, boosted));

      // Shift history leftwards and push newest amplitude to the right
      history.shift();
      history.push(amp);

      // Handle Retina / dynamic scaling
      const width = canvas.width;
      const height = canvas.height;
      const centerY = height / 2;

      ctx.clearRect(0, 0, width, height);

      // Draw subtle center baseline
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.stroke();

      // Render moving frequency vertical rounded bars
      const barSpacing = width / numBars;
      const barWidth = Math.max(2, barSpacing - 2.5);

      for (let i = 0; i < numBars; i++) {
        const x = i * barSpacing + 1;
        const barAmp = history[i];

        // Animated organic modulation
        const wave = Math.sin((i / 4) + Date.now() / 180) * 0.04;
        const currentAmp = Math.max(0.08, Math.min(1.0, barAmp + wave));

        const barHeight = Math.max(4, currentAmp * (height - 4));
        const y = centerY - barHeight / 2;

        // Gradient from dim on left to vibrant red on recent (right)
        const progress = i / numBars;
        const alpha = 0.35 + progress * 0.65;

        const grad = ctx.createLinearGradient(0, y, 0, y + barHeight);
        grad.addColorStop(0, `rgba(248, 113, 113, ${alpha})`);
        grad.addColorStop(0.5, `rgba(239, 68, 68, ${alpha})`);
        grad.addColorStop(1, `rgba(220, 38, 38, ${alpha})`);

        ctx.fillStyle = grad;
        ctx.beginPath();
        const r = Math.min(barWidth / 2, barHeight / 2);
        ctx.roundRect(x, y, barWidth, barHeight, r);
        ctx.fill();
      }
    };

    render();
  }, [canvasRef]);

  return {
    startVisualizer,
    stopVisualizer,
  };
}
