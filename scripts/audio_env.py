# Print loudness envelope (dB RMS per window) and sub/high balance for audio files.
import subprocess, sys, numpy as np
def load(p):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", p, "-ac", "1", "-ar", "22050", "-f", "f32le", "-"], capture_output=True).stdout
    return np.frombuffer(raw, np.float32)
win = float(sys.argv[1]); 
for p in sys.argv[2:]:
    x = load(p); n = int(22050 * win)
    env = [20 * np.log10(np.sqrt(np.mean(x[i:i + n] ** 2)) + 1e-9) for i in range(0, len(x), n)]
    print(p.split("/")[-1], f"{len(x)/22050:.2f}s", " ".join(f"{v:5.0f}" for v in env))
