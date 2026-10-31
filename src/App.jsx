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
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [waveformPeaks, setWaveformPeaks] = useState([]);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [playlist, setPlaylist] = useState([]);
  const graphRef = useRef(null);
  const [analyser, setAnalyser] = useState(null);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState("waveform");


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

  function formatTime(sec) {
    if (!Number.isFinite(sec)) return "0:00";

    const min = Math.floor(sec / 60);
    const remainder = Math.floor(sec % 60);

    return min + ":" + String(remainder).padStart(2, "0");

  }

  useEffect(() => {
    function handleKeydown(event) {
      if (
        event.target instanceof HTMLElement && event.target.closest(
          "input, textarea, select,button, a, audio, [contenteditable]"
        )
      ) {
        return
      }
      if (event.ctrlKey || event.altkey || event.metaKey) return;
      const audio = audioRef.current;
      if (!audio || !audio.getAttribute("src")) return;

      if (event.code === "Space") {
        event.preventDefault();
        if (event.repeat) return;

        if (audio.paused) {
          audio.play().catch((err) =>
            setError(err.message));
        } else {
          audio.pause();
        }
      }

      if (
        event.code === "ArrowLeft" || event.code === "ArrowRight"
      ) {
        if (!Number.isFinite(audio.duration))
          return;

        event.preventDefault();

        const seconds = event.code === "ArrowRight" ? 5 : -5;

        audio.currentTime = Math.max(
          0,
          Math.min(audio.duration, audio.currentTime + seconds)
        );
      }
    }

    window.addEventListener("keydown", handleKeydown);

    return () => {
      window.removeEventListener("keydown", handleKeydown);
    };
  }, []);


  useEffect(() => {
    let cancelled = false;
    setWaveformPeaks([]);

    if (!file) return;

    async function readWaveform() {
      const context = new AudioContext();

      try {
        const bytes = await file.arrayBuffer();
        const buffer = await
          context.decodeAudioData(bytes);
        const channel = buffer.getChannelData(0);

        const count = Math.min(160, channel.length);
        const peaks = [];

        for (let bar = 0; bar < count; bar++) {
          const start = Math.floor(bar * channel.length / count);
          const end = Math.floor((bar + 1) * channel.length / count);

          let peak = 0;

          for (let i = start; i < end; i++) {
            peak = Math.max(peak, Math.abs(channel[i]));
          }

          peaks.push(peak);

        }

        if (!cancelled) {
          setWaveformPeaks(peaks);
        }
      } catch (err) {
        if (!cancelled) {
          setError("Waveform preview unavailable: " + err.message);
        }
      } finally {
        await context.close();
      }
    }

    readWaveform();

    return () => {
      cancelled = true;
    };
  }, [file]);

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

    function draw() {

      samples.fill(128);

      const audio = audioRef.current;
      if (analyser && !audio.paused && !audio.ended) {
        analyser.getByteTimeDomainData(samples);
      }

      const barCount = 48;
      const slotWidth = canvas.width / barCount;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (mode === "spectrum") {
        frequencies.fill(0);

        if (analyser && !audio.paused && !audio.ended) {
          analyser.getByteFrequencyData(frequencies);
        }


        ctx.fillStyle = "#5c0808";
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
      ctx.strokeStyle = "#150458f0";
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
    <main ref={playerRef}>
      <div className="player-pane">
        <header className="Flaghead">
          <h1>WaveGarden</h1>
          <button onClick={toggleFullScreen}>
            FullScreen
          </button>
        </header>
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

          onTimeUpdate={(event) => {
            setCurrentTime(event.currentTarget.currentTime);
          }}
          onDurationChange={(event) => {
            const length = event.currentTarget.duration;
            setDuration(Number.isFinite(length) ? length : 0);
          }}
          onEmptied={() => {
            setCurrentTime(0);
            setDuration(0);
          }}
          onPause={() => setIsPlaying(false)}
          onCanPlay={playLoadedTrack} onEnded={() => {
            setIsPlaying(false);
            handleTrackEnded();
          }}

          onVolumeChange={(event) => {
            setVolume(event.currentTarget.volume);
            setMuted(event.currentTarget.muted);
          }}
        />


        <button
          type="button"
          onClick={togglePlayback}
          disabled={!file}>
          {isPlaying ? "Pause" : "Play"}
        </button>

        <label>
          Volume


          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(event) => {
              const level = Number(event.target.value);
              audioRef.current.volume = level;

              setVolume(level);
              audioRef.current.volume = level;

              if (level > 0) {
                setMuted(false);
                audioRef.current.muted = false;
              }
            }}
          />
        </label>

        <span>{Math.round(volume * 100)}%</span>

        <button
          type="button"
          onClick={() => {
            const audio = audioRef.current;

            if (audio.muted || audio.volume === 0) {
              if (audio.volume === 0) {
                audio.volume = 0.5;
              }
              audio.muted = false;
            } else {
              audio.muted = true;
            }
          }}
        >
          {muted || volume === 0 ? "Unmute" : "Mute"}
        </button>
        <div className="Seeker">
          <span>{formatTime(currentTime)}</span>

          <div className="waveform-progress-seaker">

            <svg
              viewBox="0 0 800 60"
              preserveAspectRatio="none"
              width="100%"
              height="60"
              aria-hidden="true"
            >
              {waveformPeaks.map((peak, index) => {
                const slot = 800 / waveformPeaks.length
                const height = Math.max(2, peak * 56);
                const played = duration > 0 && index / waveformPeaks.length < currentTime / duration;

                return (
                  <rect
                    key={index}
                    x={index * slot}
                    y={(60 - height) / 2}
                    width={slot * 0.7}
                    height={height}
                    rx="1"
                    fill={played ? "#fefefe" : "#ff0000fe"}
                  />
                );
              })}
            </svg>

            <input
              className="waveform-progress-seaker-input"
              type="range"
              aria-label="Playback"
              min="0"
              max={duration || 1}
              step={0.1}
              value={Math.min(currentTime, duration || 0)}
              disabled={!file || duration <= 0}
              onChange={(event) => {
                const position = Number(event.target.value);
                audioRef.current.currentTime = position;
                setCurrentTime(position);
              }
              }
            />
          </div>
          <span>{formatTime(duration)}</span>
        </div>

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
      </div>
      <section className="Playlist-pane">
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