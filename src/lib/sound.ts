// A short, pleasant two-note chime synthesized with the Web Audio API — no audio
// asset needed (keeps the bundle small and avoids CSP/asset issues). Used to draw
// attention to the redeem prompt on the kiosk.
//
// Note: browsers require a user gesture before audio can play. On the kiosk the
// chime fires right after the customer taps NEXT, which counts as a gesture.
export function playChime(): void {
  try {
    const AudioCtx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return

    const ctx = new AudioCtx()
    const now = ctx.currentTime

    // Two ascending notes (C6, then E6).
    const notes = [
      { freq: 1046.5, start: 0, dur: 0.18 },
      { freq: 1318.5, start: 0.16, dur: 0.28 },
    ]

    for (const n of notes) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = n.freq
      // Soft attack/decay so it sounds like a chime, not a beep.
      gain.gain.setValueAtTime(0, now + n.start)
      gain.gain.linearRampToValueAtTime(0.25, now + n.start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, now + n.start + n.dur)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now + n.start)
      osc.stop(now + n.start + n.dur)
    }

    // Release the context shortly after the sound finishes.
    setTimeout(() => void ctx.close(), 800)
  } catch {
    // Audio is best-effort; never let it break the flow.
  }
}
