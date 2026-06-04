import { useEffect, useRef } from 'react';
import { createGame } from './game/index.js';
import './App.css';

export default function App() {
  const containerRef = useRef(null);
  const gameRef = useRef(null);

  useEffect(() => {
    if (gameRef.current) return;
    gameRef.current = createGame(containerRef.current);
    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return (
    <div className="app-wrapper">
      <div className="title-bar">
        <span className="title-word">I</span>
        <span className="title-word dim">N</span>
        <span className="title-word">S</span>
        <span className="title-word dim">I</span>
        <span className="title-word">D</span>
        <span className="title-word dim">E</span>
        <span className="subtitle">— a demo —</span>
      </div>
      <div ref={containerRef} className="game-container" />
      <div className="footer-bar">
        <span>avoid guards · reach the end</span>
      </div>
    </div>
  );
}

