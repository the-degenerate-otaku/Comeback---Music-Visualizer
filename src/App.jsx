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

    function draw() {
      samples.fill(128);

      const audio = audioRef.current;
      if (analyser && !audio.paused && !audio.ended) {
        analyser.getByteTimeDomainData(samples);
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (mode === "spectrum") {
        frequencies.fill(0);

        if (analyser && !audio.paused && !audio.ended) {
          analyser.getByteFrequencyData(frequencies);
        }

        const barCount = 48;
        const slotWidth = canvas.width / barCount;


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
  }, [analyser, mode]);


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