'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Icon from './ui/Icon';
import styles from './OffWorkCelebration.module.css';

const ENCOURAGEMENTS = [
  { title: "You crushed it today!", sub: "Time to log off and recharge." },
  { title: "Another day, another ship!", sub: "Go enjoy your evening." },
  { title: "Bugs squashed, PRs merged.", sub: "You've earned a break." },
  { title: "Code complete. Human time.", sub: "Close the laptop. Open a beer." },
  { title: "CI is green. You are free.", sub: "Let the machines work the night shift." },
  { title: "Ship it and forget it.", sub: "Tomorrow's problems can wait." },
  { title: "10x engineer? More like 100x.", sub: "Now go touch some grass." },
  { title: "All tasks done. Boss is happy.", sub: "More importantly, YOU should be happy." },
  { title: "Production is stable. For now.", sub: "Run before something breaks." },
  { title: "Great work today!", sub: "Even Claude needs a nap. See you tomorrow!" },
];

const EMOJIS = ['🎉', '🚀', '🎊', '⭐', '🌟', '💫', '🏆', '🎯', '🔥', '✨', '🎆', '🎇', '💪', '🍻', '🥳'];

interface Particle {
  id: number;
  emoji: string;
  x: number;
  delay: number;
  duration: number;
  size: number;
  swayAmount: number;
}

function generateParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
    x: Math.random() * 100,
    delay: Math.random() * 2,
    duration: 2 + Math.random() * 3,
    size: 16 + Math.random() * 24,
    swayAmount: 20 + Math.random() * 40,
  }));
}

interface Props {
  onClose: () => void;
}

export default function OffWorkCelebration({ onClose }: Props) {
  const [msg] = useState(() => ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)]);
  const [particles] = useState(() => generateParticles(40));
  const [showContent, setShowContent] = useState(false);
  const [closing, setClosing] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Small delay so fade-in animation plays
    const t = setTimeout(() => setShowContent(true), 100);
    return () => clearTimeout(t);
  }, []);

  // Play a fun little "ta-da" sound using Web Audio API
  useEffect(() => {
    try {
      const ctx = new AudioContext();
      const playNote = (freq: number, start: number, dur: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.15, ctx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + dur);
      };
      // C-E-G-C arpeggio
      playNote(523, 0, 0.3);
      playNote(659, 0.15, 0.3);
      playNote(784, 0.3, 0.3);
      playNote(1047, 0.45, 0.6);
    } catch {
      // Audio not available, no big deal
    }
  }, []);

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(onClose, 400);
  }, [onClose]);

  return (
    <div
      className={`${styles.overlay} ${closing ? styles.fadeOut : ''}`}
      onClick={handleClose}
    >
      {/* Falling particles */}
      {particles.map(p => (
        <span
          key={p.id}
          className={styles.particle}
          style={{
            left: `${p.x}%`,
            fontSize: `${p.size}px`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            '--sway': `${p.swayAmount}px`,
          } as React.CSSProperties}
        >
          {p.emoji}
        </span>
      ))}

      {/* Center content */}
      <div
        className={`${styles.content} ${showContent ? styles.contentVisible : ''}`}
        onClick={e => e.stopPropagation()}
      >
        <div className={styles.starBurst}>
          <Icon name="star" size={48} />
        </div>
        <h1 className={styles.title}>{msg.title}</h1>
        <p className={styles.subtitle}>{msg.sub}</p>
        <div className={styles.clock}>
          {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
        </div>
        <button className={styles.closeBtn} onClick={handleClose}>
          See you tomorrow!
        </button>
      </div>
    </div>
  );
}
