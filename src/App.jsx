import { useEffect, useRef, useState } from "react";
import "./App.css";

export default function App() {
  const canvasRef = useRef(null);
  const audioRef = useRef(null);
  const [file, setFile] = useState(null);
  const graphRef = useRef(null);
  const [analyser, setAnalyser] = useState(null);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState("waveform");
  const [particlesEnabled, setParticlesEnabled] = useState(true);

  async function connectAudio() {
    try {
      setError("");

      if (!graphRef.current) {
        const context = new AudioContext();
        const source = context.createMediaElementSource(audioRef.current);
        const node = context.createAnalyser();

        node.fftSize = 2048;

        source.connect(node);
        node.connect(context.destination);

        graphRef.current = { context, source, node };
        setAnalyser(node);
      }

      await graphRef.current.context.resume();
    } catch (err) {
      console.error("Audio wayy too slop for me bruv *-*, try refreshing", err);
      setError(`${err.name}: ${err.message}`);
    }
  }


  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    let frameId;

    const samples = new Uint8Array(analyser ? analyser.fftSize : 2048);
    const frequencies = new Uint8Array(analyser ?
      analyser.frequencyBinCount : 1024);

    const dots = Array.from({ length: 40 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      radius: 1 + Math.random() * 2,
      speed: 20 + Math.random() * 30,
    }));

    let previousTime = 0;

    function draw(time) {
      const delta = previousTime
        ? Math.min((time - previousTime) / 1000, 0.05) : 0;
      previousTime = time;

      samples.fill(128);

      const audio = audioRef.current;
      if (analyser && !audio.paused && !audio.ended) {
        analyser.getByteTimeDomainData(samples);
      }

      let energy = 0;
      for (const sample of samples) {
        const amplitude = (sample - 128) / 128;
        energy += amplitude * amplitude;
      }

      energy = Math.sqrt(energy / samples.length);

      const barCount = 48;
      const slotWidth = canvas.width / barCount;

      ctx.clearRect(0, 0, canvas.width, canvas.height);


      ctx.fillStyle = "#aa80ff";
      ctx.globalAlpha = 0.5;

      for (const dot of particlesEnabled? dots : []) {
        if (!audio.paused && !audio.ended) {
          dot.y -= dot.speed * (1 + energy * 8) * delta;

          if (dot.y < -10) {
            dot.y = canvas.height + 10;
            dot.x = Math.random() * canvas.width;
          }
        }

        ctx.beginPath();
        ctx.arc(
          dot.x, dot.y, dot.radius * (1 + energy * 3), 0, Math.PI * 2
        );
        ctx.fill();
      }

      ctx.globalAlpha = 1;

      if (mode === "spectrum") {
        frequencies.fill(0);

        if (analyser && !audio.paused && !audio.ended) {
          analyser.getByteFrequencyData(frequencies);
        }


        ctx.fillStyle = "#c499ff";
        for (let bar = 0; bar < barCount; bar++) {
          const start = Math.floor(
            (bar / barCount) * frequencies.length
          );

          const end = Math.floor(
            ((bar + 1) / barCount) * frequencies.length
          );

          let total = 0;
          for (let i = start; i < end; i++) {
            total += frequencies[i];

          }

          const strength = total / (end - start) / 255;
          const barHeight = Math.max(2, strength * (canvas.height - 30)
          );

          ctx.fillRect(
            bar * slotWidth + 3,
            canvas.height - barHeight - 10,
            slotWidth - 6,
            barHeight
          );
        }
        frameId = requestAnimationFrame(draw);
        return;

      }
      ctx.strokeStyle = "#750150";
      ctx.lineWidth = 2;
      ctx.beginPath();

      for (let i = 0; i < samples.length; i++) {
        const x =
          (i / (samples.length - 1)) * canvas.width;

        const amplitude = (samples[i] - 128) / 128;

        const y =
          canvas.height / 2 + amplitude * canvas.height * 0.4;





        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.stroke();


      frameId = requestAnimationFrame(draw);
    }

    frameId = requestAnimationFrame(draw);

    return () => cancelAnimationFrame(frameId);
  }, [analyser, mode, particlesEnabled]);


  useEffect(() => {
    if (!file) return;

    const audio = audioRef.current;
    const url = URL.createObjectURL(file);

    audio.src = url;

    audio.load();

    return () => {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      URL.revokeObjectURL(url);
    };
  }, [file]);



  return (
    <main>
      <h1>Music go be wave cause why not ?</h1>
      <label>
        Visuals:{""}
        <select value={mode}
          onChange={(event) =>
            setMode(event.target.value)}
        >
          <option value="waveform">Waveform</option>
          <option value="spectrum">Specturm</option>
        </select>
      </label>
      <canvas
        ref={canvasRef}
        width="1000"
        height="400"
        aria-label="Visualizer?"

      />

      <input
        type="file"
        accept="audio/*"
        onChange={(event) => {
          const selectedFile = event.target.files?.[0];

          if (selectedFile) {
            setFile(selectedFile);
          }

          event.target.value = "";
        }}
      />

      <p> {file ? file.name : "Choose your Slop "} </p>
      <audio ref={audioRef} controls onPlay={connectAudio} />
      {error && <p role="alert">{error}</p>}
    </main>
  );
}