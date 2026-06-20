import { Game } from './game';
import type { LevelData, LevelSummary } from './types';
import { healthCheck, getLevelList } from './api';

const STORAGE_KEY_COMPLETED = 'star_map_completed';

const creatureIcons: Record<string, string> = {
  '苍龙': '🐉',
  '朱雀': '🔥',
  '麒麟': '✨'
};

const hallEl = document.getElementById('star-map-hall')!;
const cardsContainer = document.getElementById('star-cards-container')!;
const hallStarsBg = document.getElementById('hall-stars-bg')!;

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const game = new Game(canvas);

const uiLayer = document.getElementById('ui-layer')!;
const levelNumEl = document.getElementById('level-num')!;
const creatureNameEl = document.getElementById('creature-name')!;
const connectedCountEl = document.getElementById('connected-count')!;
const totalCountEl = document.getElementById('total-count')!;
const progressFillEl = document.getElementById('progress-fill')!;
const hintTitleEl = document.getElementById('hint-title')!;
const hintTextEl = document.getElementById('hint-text')!;
const completeModal = document.getElementById('complete-modal')!;
const modalTitleEl = document.getElementById('modal-title')!;
const modalDescEl = document.getElementById('modal-desc')!;

const btnUndo = document.getElementById('btn-undo') as HTMLButtonElement;
const btnReset = document.getElementById('btn-reset') as HTMLButtonElement;
const btnHint = document.getElementById('btn-hint') as HTMLButtonElement;
const btnNext = document.getElementById('btn-next') as HTMLButtonElement;
const btnBack = document.getElementById('btn-back') as HTMLButtonElement;

let allLevels: LevelSummary[] = [];
let maxLevels = 3;

function generateHallStars(): void {
  hallStarsBg.innerHTML = '';
  for (let i = 0; i < 120; i++) {
    const star = document.createElement('div');
    star.className = 'hall-star';
    const size = Math.random() * 3 + 1;
    star.style.width = `${size}px`;
    star.style.height = `${size}px`;
    star.style.left = `${Math.random() * 100}%`;
    star.style.top = `${Math.random() * 100}%`;
    star.style.animationDelay = `${Math.random() * 3}s`;
    star.style.animationDuration = `${2 + Math.random() * 3}s`;
    const colors = ['#fff', '#a0c4ff', '#ffd700', '#ffb6c1'];
    star.style.background = colors[Math.floor(Math.random() * colors.length)];
    star.style.boxShadow = `0 0 ${size * 2}px ${star.style.background}`;
    hallStarsBg.appendChild(star);
  }
}

function getCompletedLevels(): Set<number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_COMPLETED);
    if (raw) {
      const arr = JSON.parse(raw) as number[];
      return new Set(arr);
    }
  } catch {
  }
  return new Set();
}

function saveCompletedLevel(levelId: number): void {
  const completed = getCompletedLevels();
  completed.add(levelId);
  localStorage.setItem(STORAGE_KEY_COMPLETED, JSON.stringify([...completed]));
}

function isLevelUnlocked(levelId: number): boolean {
  if (levelId === 1) return true;
  const completed = getCompletedLevels();
  return completed.has(levelId - 1);
}

function renderDifficultyStars(difficulty: number): string {
  const maxDifficulty = 3;
  let html = '<div class="difficulty-container">';
  html += '<span class="difficulty-label">难度</span>';
  for (let i = 1; i <= maxDifficulty; i++) {
    const active = i <= difficulty ? 'active' : '';
    html += `<span class="difficulty-star ${active}">★</span>`;
  }
  html += '</div>';
  return html;
}

function renderCards(levels: LevelSummary[]): void {
  cardsContainer.innerHTML = '';
  const completed = getCompletedLevels();

  levels.forEach((level) => {
    const unlocked = isLevelUnlocked(level.id);
    const isCompleted = completed.has(level.id);
    const icon = creatureIcons[level.creatureName] || '⭐';

    const classes = ['star-card'];
    if (!unlocked) classes.push('locked');
    if (isCompleted) classes.push('completed');

    let card = `
      <div class="${classes.join(' ')}" data-level-id="${level.id}">
        <div class="card-level-id">关卡 ${level.id}</div>
        <div class="card-icon">${icon}</div>
        <div class="card-title">${level.name}</div>
        <div class="card-creature">— ${level.creatureName} —</div>
        <div class="card-stats">
          <div class="stat-item">
            <div class="stat-label">星点数</div>
            <div class="stat-value star">${level.starPointCount}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">星脉数</div>
            <div class="stat-value pulse">${level.starPulseCount}</div>
          </div>
        </div>
        ${renderDifficultyStars(level.difficulty)}
        <button class="card-action">
          ${!unlocked ? '🔒 未解锁' : isCompleted ? '✦ 再次挑战' : '✧ 点亮星图'}
        </button>
        ${!unlocked ? '<div class="locked-overlay">🔒</div>' : ''}
      </div>
    `;
    cardsContainer.innerHTML += card;
  });

  function handleCardClick(levelId: number): void {
    if (levelId && isLevelUnlocked(levelId)) {
      enterLevel(levelId);
    }
  }

  cardsContainer.querySelectorAll('.star-card').forEach(card => {
    const levelId = parseInt(card.getAttribute('data-level-id') || '0');
    card.addEventListener('click', () => handleCardClick(levelId));
    const btn = card.querySelector('.card-action');
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        handleCardClick(levelId);
      });
    }
  });
}

function showHall(): void {
  hallEl.classList.remove('hidden');
  uiLayer.classList.add('hidden');
  game.stop();
  renderCards(allLevels);
}

async function enterLevel(levelId: number): Promise<void> {
  hallEl.classList.add('hidden');
  uiLayer.classList.remove('hidden');

  hintTitleEl.textContent = '加载中...';
  hintTextEl.textContent = '正在连接星界数据库...';

  const loaded = await game.loadLevel(levelId);
  if (!loaded) {
    hintTitleEl.textContent = '⚠️ 加载失败';
    hintTextEl.textContent = '无法加载关卡数据，请确保后端服务器已启动 (npm run dev:backend)';
    showHall();
    return;
  }

  game.start();
}

game.setCallbacks({
  onLevelChange: (level: LevelData) => {
    levelNumEl.textContent = String(level.id);
    creatureNameEl.textContent = level.creatureName;
    totalCountEl.textContent = String(level.edges.length);
    connectedCountEl.textContent = '0';
    progressFillEl.style.width = '0%';
    completeModal.classList.remove('show');

    hintTitleEl.textContent = `关卡 ${level.id}: ${level.name}`;
    hintTextEl.textContent = '寻找闪烁频率成倍数关系的恒星，从一颗星拖动到另一颗星连接它们';
  },
  onProgressChange: (current: number, total: number) => {
    connectedCountEl.textContent = String(current);
    const pct = total > 0 ? (current / total) * 100 : 0;
    progressFillEl.style.width = `${pct}%`;

    if (current < total) {
      if (current === 0) {
        hintTitleEl.textContent = '观察星空';
        hintTextEl.textContent = '仔细观察星星的闪烁节奏，找到频率相同或成倍数的恒星';
      } else if (current < total * 0.3) {
        hintTitleEl.textContent = '初见端倪';
        hintTextEl.textContent = '做得好！继续寻找，你会发现恒星间的谐波共振关系';
      } else if (current < total * 0.6) {
        hintTitleEl.textContent = '星脉初现';
        hintTextEl.textContent = '神话生物的轮廓正在浮现，耐心连接剩余的星脉';
      } else if (current < total) {
        hintTitleEl.textContent = '即将完成';
        hintTextEl.textContent = '只剩最后几颗星了！神话生物即将显现';
      }
    }
  },
  onComplete: (desc: string) => {
    const currentLevelId = game.getCurrentLevel();
    saveCompletedLevel(currentLevelId);

    hintTitleEl.textContent = '✨ 星座完成 ✨';
    hintTextEl.textContent = '星界神话生物已显现！仔细欣赏它的光辉吧';

    modalTitleEl.textContent = `✨ ${creatureNameEl.textContent} 降临 ✨`;
    modalDescEl.textContent = desc;
    completeModal.classList.add('show');

    if (currentLevelId >= maxLevels) {
      btnNext.textContent = '返回星图大厅';
    } else {
      btnNext.textContent = '下一关';
    }
  }
});

btnUndo.addEventListener('click', () => {
  game.undoLastConnection();
});

btnReset.addEventListener('click', () => {
  if (confirm('确定要重置本关吗？所有连线将被清除。')) {
    game.resetLevel();
  }
});

btnHint.addEventListener('click', () => {
  const showing = game.toggleFrequencies();
  btnHint.textContent = showing ? '隐藏频率' : '显示频率';
});

btnNext.addEventListener('click', async () => {
  const currentLevel = game.getCurrentLevel();
  completeModal.classList.remove('show');
  btnHint.textContent = '显示频率';

  if (currentLevel >= maxLevels) {
    showHall();
    return;
  }

  const nextLevel = currentLevel + 1;
  await game.loadLevel(nextLevel);
});

btnBack.addEventListener('click', () => {
  showHall();
});

async function init(): Promise<void> {
  generateHallStars();

  try {
    const backendOk = await healthCheck();
    if (!backendOk) {
      console.warn('后端未启动，尝试使用嵌入数据...');
    }
  } catch {
    console.warn('后端健康检查失败');
  }

  allLevels = await getLevelList();
  maxLevels = allLevels.length > 0 ? allLevels.length : 3;

  if (allLevels.length === 0) {
    allLevels = [
      { id: 1, name: '苍穹神龙', creatureName: '苍龙', difficulty: 1, starPointCount: 14, starPulseCount: 7 },
      { id: 2, name: '涅槃凤凰', creatureName: '朱雀', difficulty: 2, starPointCount: 16, starPulseCount: 11 },
      { id: 3, name: '祥瑞麒麟', creatureName: '麒麟', difficulty: 3, starPointCount: 20, starPulseCount: 15 }
    ];
  }

  renderCards(allLevels);
}

init().catch(err => {
  console.error('初始化失败:', err);
  cardsContainer.innerHTML = `<div style="text-align:center;color:#ff6b6b;padding:40px;">加载失败: ${String(err)}</div>`;
});
