import { useEffect, useRef, useState } from "react";
import "./App.css";


export default function App() {
  const canvasRef = useRef(null);
  const playerRef = useRef(null);
  const playOnLoadRef = useRef(false);
  const audioRef = useRef(null);
  const [file, setFile] = useState(null);
  const [search, setSearch] = useState("");
  const [repeat, setRepeat] = useState("off");
  const [isPlaying, setIsPlaying] = useState(false);
  const [playlist, setPlaylist] = useState([]);
  const graphRef = useRef(null);
  const [analyser, setAnalyser] = useState(null);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState("waveform");
  const [particlesEnabled, setParticlesEnabled] = useState(true);


  const filteredPlaylist = playlist.filter((track) => {
    const query = search.trim().toLowerCase();
    return query === "" ||
      track.name.toLowerCase().includes(query);
  });

  function moveTrack(track, direction) {
    const index = playlist.indexOf(track);
    const destination = index + direction;

    if (
      index === -1 ||
      destination < 0 ||
      destination >= playlist.length
    ) {
      return;
    }

    const reordered = [...playlist];
    const movedTrack = reordered[index];
    reordered[index] = reordered[destination];
    reordered[destination] = movedTrack;

    setPlaylist(reordered);
  }




  function removeTrack(track) {
    const index = playlist.indexOf(track);
    if (index === -1) return;

    const remaining = playlist.filter((item) =>
      item !== track);
    setPlaylist(remaining);

    if (track === file) {
      const audio = audioRef.current;

      playOnLoadRef.current =
        remaining.length > 0 && !audio.paused && !audio.ended;

      const nextTrack = remaining[Math.min(index, remaining.length - 1)] ?? null

      audio.pause();
      setError("");
      setFile(nextTrack);
    }
  }


  function selecTrack(track) {
    if (!track) return;

    setError("")

    if (track === file) {
      audioRef.current.currentTime = 0;

      audioRef.current.play().catch((err) => {
        setError(err.message)
      });

      return;
    }

    playOnLoadRef.current = true;
    setFile(track);
  }

  function handleTrackEnded() {
    if (!file || playlist.length === 0) return;

    if (repeat === "one") {
      selecTrack(file);
      return;
    }

    const index = playlist.indexOf(file);

    if (index === -1) return;

    if (index < playlist.length - 1) {
      selecTrack(playlist[index + 1]);
    } else if (repeat === "all") {
      selecTrack(playlist[0]);
    }
  }


  function changeTrack(direction) {
    const currentIndex = playlist.indexOf(file);
    if (currentIndex === -1) return;

    const nextIndex = currentIndex + direction;

    if (nextIndex >= 0 && nextIndex < playlist.length) {
      selecTrack(playlist[nextIndex]);
    }
  }

  function playLoadedTrack() {
    if (!playOnLoadRef.current) return;

    playOnLoadRef.current = false;

    audioRef.current.play().catch((err) => {
      setError(`Start the track goddamit ${err.message}`);
    });
  }

  async function toggleFullScreen() {

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await playerRef.current.requestFullscreen();
      }
    } catch (err) {
      setError(`Fullscreen unavailable: ${err.message}`);
    }
  }

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!file || !audio) return;

    try {
      setError("")

      if (audio.paused) {
        await audio.play();
      } else {
        audio.pause();
      }
    } catch (err) {
      setError(`Playback aint workking: ${err.message}`);

    }

  }



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

      for (const dot of particlesEnabled ? dots : []) {
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
    <main ref={playerRef}>
      <button
        type="button"
        onClick={toggleFullScreen}>
        Toggle FullScreen
      </button>
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

      <label>
        <input
          type="checkbox"
          checked={particlesEnabled}
          onChange={(event) =>
            setParticlesEnabled(event.target.checked)
          }
        />
        Particles
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
        multiple
        onChange={(event) => {
          const selectedFiles = Array.from(event.target.files ?? []);


          if (selectedFiles.length > 0) {
            playOnLoadRef.current = false;
            setPlaylist(selectedFiles);
            setFile(selectedFiles[0]);
          }

          event.target.value = "";
        }}
      />

      <p> {file ? file.name : "Choose your Slop "} </p>
      <audio ref={audioRef} controls onPlay={() => {
        setIsPlaying(true);
        connectAudio();
      }}
        onPause={() => setIsPlaying(false)}
        onCanPlay={playLoadedTrack} onEnded={() => {
          setIsPlaying(false);
          handleTrackEnded();
        }} />

      <button
        type="button"
        onClick={togglePlayback}
        disabled={!file}>
        {isPlaying ? "Pause" : "Play"}
      </button>

      <div>
        <button
          type="button"
          disabled={playlist.indexOf(file) <= 0}
          onClick={() => changeTrack(-1)}>
          Previous
        </button>

        <button
          type="button"
          disabled={playlist.indexOf(file) === -1 ||
            playlist.indexOf(file) >= playlist.length - 1
          }
          onClick={() => changeTrack(1)} >
          Next
        </button>
      </div>
      <section>
        <h2>Playlist</h2>
        <label>
          Repeat
          <select
            value={repeat}
            onChange={(event) =>
              setRepeat(event.target.value)}>
            <option value="off">Off</option>
            <option value="one">This Track</option>
            <option value="all">Full Playlist</option>
          </select>
        </label>
        <label>
          Search Playlist
          <input
            type="search"
            placeholder="Search By filename"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)}
          />
        </label>


        {filteredPlaylist.length === 0 ? (
          <p>{playlist.length === 0 ? "Add some tunes gng" : "Couldnt find em"}</p>
        ) : (
          <ol>
            {filteredPlaylist.map((track, index) => (
              <li key={index}>
                <button
                  type="buttton"
                  onClick={() => setFile(track)}
                  aria-current={file === track ? "true" : undefined}>
                  {file === track ? " > " : ""}
                  {track.name}
                </button>
                <button
                  type="button"
                  onClick={() => removeTrack(track)}
                  aria-label={`Remove ${track.name} from playlist?`}>
                  Remove
                </button>
                <button
                  type="button"
                  onClick={() => moveTrack(track, -1)}
                  disabled={playlist.indexOf(track) === 0}
                  aria-label={`Move ${track.name} up`}>
                  ↑
                </button>

                <button
                  type="button"
                  onClick={() => moveTrack(track, 1)}
                  disabled={playlist.indexOf(track) === playlist.length - 1}
                  aria-label={`Move ${track.name} down`}>
                  ↓
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>
      {error && <p role="alert">{error}</p>}
    </main>
  );
}