import { GameLoop }     from './engine/GameLoop.js';
import { RenderEngine } from './engine/RenderEngine.js';
import { SoundEngine }  from './engine/SoundEngine.js';
import { InputEngine }  from './engine/InputEngine.js';

const canvas   = document.getElementById('gameCanvas');
const renderer = new RenderEngine(canvas);
const sound    = new SoundEngine();
const input    = new InputEngine();

// 사용자 첫 상호작용 시 AudioContext 활성화
document.addEventListener('pointerdown', () => sound.init(), { once: true });
document.addEventListener('keydown',     () => sound.init(), { once: true });

const loop = new GameLoop({
  onUpdate(dt) {
    const snapshot = input.flush();
    // world.update(dt, snapshot) → World 레이어 구현 후 연결
  },
  onRender() {
    renderer.clear();
    renderer.draw(null); // world 구현 후 교체
  },
});

loop.start();
