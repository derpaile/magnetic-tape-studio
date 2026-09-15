# Magnetic — Tape Echo Studio

A four-track instrument for layering audio, shaping tape echoes and recording the result. Everything happens on your device: no account, backend or audio uploads. Installable and usable offline after the first complete visit.

## Make a first recording

1. **Play starter mix** loads four balanced original sounds onto an empty tape and starts playback at 96 BPM. Alternatively, use the sound library, import audio, drop a file directly onto a lane, or record a microphone.
2. Select a track to adjust its pan and echo send. Use **Follow tape**, **Own loop · A–B**, or **One shot**. The splice editor appears when Own loop is selected. Turning the lane loop off returns it to Follow tape.
3. Choose an echo preset. Adjust the independent playback heads, feedback, echo mix, tape wear, reverb and granular memory. All sound tools stay visible.
4. **Record master** captures the current output. **Record from start** rewinds, starts recording, and plays the tape. **Stop & save take** finishes immediately; **Finish with tail** pauses the tape, captures the decay and saves automatically.
5. Export a take as WAV, FLAC or M4A. Rename, preview, or copy it back onto a track. Deleted takes can be restored with **Undo delete** until the page is closed or another session is opened.

The output knob sits beside the master recorder and affects both listening and recording. The **All effects** switch bypasses tape colour, echo, memory and reverb. The transport's Stop button stops the tape and leaves existing effect tails ringing.

## Save and move sessions

Tracks, settings and master takes autosave in this browser. **Session files** provides:

- **Download session backup**: one `.magnetic` file containing exact sample audio, original master recordings, sound settings, loops and saved export trims.
- **Open a session backup**: validates the complete file and shows its name, track count and take count before replacing the current session. Download a backup of current work first if you need it.
- **Start a new tape**: clears tracks and resets the instrument while keeping your master takes.

Backups move between browsers and devices. Microphone devices are local settings and do not transfer. Frozen moments and recorded knob motion are temporary performance state; record a master take to preserve their sound. Clearing browser data removes autosaved sessions, so keep backups of important work. Existing sessions and original WAV takes remain compatible.

## Sound and recording tools

- Four stereo tracks with level, mute, solo, pan, post-fader echo send, reverse, variable speed and eight track-edit undo steps. Dub throw temporarily raises one track's send to 100%.
- Follow tape tracks repeat when Full tape loop is enabled; independent A–B loops repeat on their own. One shots finish even with the global loop on. Beat lengths refer to source time at 1× speed.
- Three independently timed playback heads, each with free time or tempo sync, straight/dotted/triplet divisions and pitch bending when time changes. Tape saturation, age, wow, flutter, crinkle and signal-following hiss. Separate spring-inspired and diffuse ambient reverbs.
- Tape brake and per-track Dub throw are momentary controls.
- Granular memory listens to the last 12 seconds. Dissolve, Grain size, Look back, Scatter, Memory wander and Back to tape shape fragments of that sound. Hold moment freezes the memory. Record motion captures those six knobs for up to 16 seconds and loops them on the audio clock.
- Live microphone input with device/channel choice, ±24 dB gain and a four-beat count-in. Optional monitoring follows the assigned track's level, pan, mute, solo and send. Use headphones. Mic recordings stay dry; master recordings include effects. Overdub layers onto existing tape. Mic access and monitoring never restart automatically after reload.
- Tape, Spectrum and History share the reel window. Analysis can show the input, selected track before effects, or master after effects. Freeze and Reference aid comparison. A/B auditions the original mix at measured RMS matching, bounded to ±12 dB; disabled during master capture. Analysis uses the mono sum, a logarithmic frequency axis and a fixed −96 to 0 dBFS scale.
- WAV and FLAC support 16/24-bit output; M4A supports 128/192/256 kb/s AAC. Export trims preserve the original take. The local converter downloads on first compressed export (about 31 MB), then works offline. Conversion failures leave the original intact.

## Limits

Audio imports: 60 MB per file, 3 minutes decoded duration, browser-supported codecs. Microphone recording stops at 10 minutes; master recording stops and saves at 30 minutes. Copying a master onto a track has the same 3-minute limit; export a shorter range and import it for longer takes. Tail capture ends after 1.5 seconds of quiet (minimum 2 seconds), or 30 seconds for sustained/frozen effects.

Keep the app foregrounded during a performance. Browser/OS interruptions can suspend audio. A 30-minute 48 kHz master uses about 691 MB raw PCM; browser memory and storage determine practical capacity. An eight-second shared buffer protects capture from short worker stalls; a recycled MessagePort pool handles non-isolated browsers. Buffer exhaustion saves the captured portion and reports the interruption. WAV preparation and compressed conversion run in workers; large takes never require a full PCM join on the interface thread.

Tape and spring character are creative approximations, not a circuit-accurate hardware emulation. Original branding, graphics and synthesized audio; no affiliation with Roland or teenage engineering. FFmpeg and its dependencies retain their licenses; converter source/build and license links ship in `/codecs/ffmpeg-0.12.10/NOTICE.txt`.

## Keyboard

Space: play/pause. R: master record/stop. L: selected track loop. Shift+L: full tape loop. T: tap tempo. B: effects bypass. 1–4: select track. Knobs support arrows, Home/End, Shift for finer adjustments, drag, and double-click reset. Focus a waveform to seek with arrows or Home/End. Space/Enter operates focused buttons. Repeated key events do not repeatedly toggle recording.

## Run, verify and manually release

```sh
npm install
npm run dev
npm run build
npm run preview -- --port 4173
TEST_URL=http://localhost:4173 npm run test:e2e
npx wrangler deploy
TEST_URL=https://your-worker.workers.dev npm run test:release
```

Use the actual preview port printed by Vite if 4173 is occupied. Browser tests use local Chrome; set `CHROME_PATH` to override. Coverage includes actual audio, independent loops and timing, recording under stalls, synthetic mic routing/count-in, backups, master exports with decoding, saved-session migration, desktop/mobile layout and offline operation. Screenshots and WAV fixtures go to `test-results/`.

`wrangler.jsonc` publishes `dist` as Cloudflare Workers static assets. No database bindings or application secrets are needed. Cloudflare login must already be available to Wrangler. COOP/COEP headers enable shared-memory recording, including offline. Build generates versioned offline assets and splits the FFmpeg converter into files below Cloudflare's asset limit. Microphone and AudioWorklet require HTTPS or localhost.
