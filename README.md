# Magnetic — Tape Echo Studio

A local-first, installable four-track tape studio with an original hardware-inspired interface. Built for desktop and touch screens; prepared for Cloudflare Workers static assets. No account, backend, audio uploads, or external media services.

## Run

```sh
npm install
npm run dev
```

Open the local URL. New sessions start with four empty lanes. Open a lane’s Library to choose an original sound, drop your own sample directly onto a lane, or record your microphone. Existing saved sessions are restored. Use Record master to capture the performance and export stereo WAV files.

## Build and deploy later

```sh
npm run build
npm run preview
# When ready to publish to your Cloudflare account:
npx wrangler login
npm run deploy
```

`wrangler.jsonc` serves `dist` with Workers static assets. Change the Worker name before deploying if desired. No secrets, database, or storage bindings are required. Microphone and AudioWorklet need HTTPS or localhost. For testing on a physical phone use a secure preview URL; a plain HTTP LAN address cannot access microphone/audio worklets.

## What works

- Four stereo tracks, original demo sounds, multi-file import, waveform seeking, individual mute/solo/level, loop, rewind, reverse, variable tape speed, eight levels of track-edit undo.
- Microphone recording to the selected track, optional overdub and headphone monitoring. Recording is inserted at the current tape position, with tape-speed resampling. Overdubs extend the tape; they do not wrap across the loop boundary. Monitoring starts off.
- Three separately selectable playback heads with independent times (presets begin at 1×/2×/3×), smoothed rate changes with pitch bending, feedback, saturation, age/tone filtering, wow/flutter, and spring-inspired reverb. The free-running processing continues after playback pauses, keeping the effect tail alive.
- Independent master recorder captures the post-volume/post-compressor stereo signal as uncompressed PCM, streams directly to a background encoder and saves a 16-bit stereo WAV at the AudioContext sample rate, without concatenating a full take’s PCM on the interface thread. Takes can be previewed, exported, deleted, or bounced back onto a track (subject to the sample duration limit).
- IndexedDB saves the session and takes on this browser/device. Export important takes as files. Storage errors are shown; clearing browser data removes saved sessions.
- Autosaving keeps control settings separate from large sample arrays, preserves existing sessions, and flushes pending edits when the app is hidden. Live speed changes ramp smoothly and reuse the existing audio buffers.
- Production build precaches all app assets, icons, and audio processors for offline operation. Native install prompt when available; Safari installation through Share → Add to Home Screen.
- Keyboard: Space play/pause, R master record, L selected track loop, Shift+L whole tape loop, T tap tempo, H echo hold, B bypass, 1–4 track select, Escape echo reset. Knobs support dragging, arrows, Home/End, Shift for finer control, and double-click reset.

## Practical limits

Imports: 60 MB per file, 3 minutes decoded audio. Codec support follows the browser. Master capture stops and saves at 30 minutes; microphone capture stops at 10 minutes. Audio remains in memory while working and is saved locally; device memory and browser storage determine practical capacity. Keep the app foregrounded during a performance, particularly on mobile. Browser audio suspension/OS interruptions may interrupt recording; this is not a background recorder.

The tape and spring character are creative approximations, not a circuit-accurate Roland emulation. Inspired by the [RE-201 multi-head signal path](https://articles.roland.com/tips-and-tricks-roland-cloud-re-201-space-echo/) and the [OP-1 four-track workflow](https://teenage.engineering/guides/op-1/original/tape-mode). Original branding, graphics, and synthesized demo audio; no affiliation with either manufacturer.

## Verification

```sh
npm run build
npm run preview -- --port 4173
npm run test:e2e
# Check the actual published host, including its offline document cache:
TEST_URL=https://your-worker.workers.dev npm run test:release
```

Browser checks use the locally installed Chrome by default (set `CHROME_PATH` to override). They verify desktop/mobile layout, actual audio output and echo tails, import, microphone capture using Chrome’s synthetic microphone, master WAV contents, reverse/speed, session restoration, and offline reload. Screenshots are saved in `test-results/`.

## Play the machine

- Every track has Follow tape, Own loop, and One shot playback. Its own A–B loop repeats independently of the other clips and the global loop switch. Set boundaries in seconds, drag the two markers, capture A/B at the playhead, or choose 1/2/4/8 beats or the full clip. Short splice fades soften loop clicks. Beat lengths refer to source time at 1× speed. Undo restores loop edits too.
- Delay time is explicit: 40–1500 ms, editable numeric input, BPM sync (40–240), straight/dotted/triplet subdivisions, averaged tap tempo, and independent Free/Sync and note division for each head (head 1: up to 1.5 seconds; heads 2/3: up to 4.5 seconds). Out-of-range tempo combinations show their 1500 ms limit. Turning delay time returns to Free mode and bends the echo pitch.
- Per-track pan and post-fader Echo send, plus a momentary Dub throw to send individual phrases at full level. Mute/solo stop new input while existing echoes continue.
- Tape saturation, age, independent wow/flutter, irregular crinkles/dropouts and signal-following hiss also colour the dry tape. Low cut and tone shape repeat decay; Stereo spread pans heads and crosses the feedback between channels.
- Separate spring and ambient reverb amounts; an eight-line diffuse stereo room has a 1–20 second nominal decay. Damping follows tape age.
- Hold Feedback swell for rising feedback, hold Tape brake for a motor slowdown, latch Echo hold to repeat a captured echo fragment, or latch Send cut to stop feeding the delay. Momentary controls release on pointer cancellation, focus loss or leaving the tab. Clear echo releases hold and clears both reverb tails. Normal Stop keeps the tails.
- Additional presets: Kingston after dark, Endless shoreline, Disintegrating loops, Empty cathedral. New original sounds: Slow cloud and Dub chord.
- New shortcuts: L loops the selected track; Shift+L loops the whole tape; T taps tempo; H latches Echo hold. Old recordings and session settings remain compatible; newly added settings are saved locally.

The compact cabinet keeps the reel transport, four tape lanes, splice/send station, echo controls, tape character, room, performance keys and master recorder together on desktop. Wander gently varies the current sound without changing levels or feedback; Return recalls the previous sound. On smaller screens the same banks fold into one column, with tape and tracks first.

## Granular memory and live recording

- Tape and echo output continuously fill a 12-second stereo memory. Dissolve moves from tape to a cloud of windowed grains. Grain size, Look back, Scatter and Memory wander shape its time, stereo and pitch. Back to tape returns the cloud into the magnetic echo, which becomes new memory.
- Hold moment freezes the memory while the tape, echoes and master keep running. The memory display shows recorded amplitude and the actual active grains. Clear echo clears memory, releases both holds and stops motion.
- Record motion captures the six granular knobs for up to 16 seconds. Finish & loop plays the gesture on the audio thread; Stop motion or a manual edit returns to the manual settings. Frozen audio and motion are temporary performance state; export a master take to keep their sound. Granular settings and all independent head timings are saved with the session.
- File drops target only the lane under the pointer, without changing the selected lane. A multi-file lane drop uses only the first file; the Import audio chooser can distribute multiple files from its captured target. Every lane has a delete button with undo.
- Live edits prepare buffers before an audio-clock crossfade. Only affected tracks are replaced; independent loops keep running when another clip changes the total tape length. Imported native audio buffers are reused when possible.
- Master PCM travels directly from the audio worklet to a dedicated worker. Recycled capture buffers and incremental WAV encoding reduce allocation spikes. Session autosaves wait until master recording finishes. The 30-minute boundary is enforced on the audio thread, even when the interface is busy.
- A 30-minute 48 kHz take uses about 346 MB of WAV data. Capture remains in memory until saved/exported; browser suspension and device resource exhaustion can still interrupt a performance. The app reports audio suspension and resumes capture with the audio clock.
