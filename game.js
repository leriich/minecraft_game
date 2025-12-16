// === КОНСТАНТИ ГРИ ===
const TILE_SIZE = 32;
const GAME_FPS = 60;
const WORLD_WIDTH = 200;

// Типи блоків та їх кольори
const BlockType = {
    0: { name: 'Air', color: 'transparent', mineable: false, drop: null, isSolid: false },
    1: { name: 'Grass', color: '#4CAF50', mineable: true, drop: 2, isSolid: true },
    2: { name: 'Dirt', color: '#8B4513', mineable: true, drop: 2, isSolid: true },
    3: { name: 'Stone', color: '#808080', mineable: true, drop: 3, isSolid: true },
    4: { name: 'Coal Ore', color: '#333333', mineable: true, drop: 4, isSolid: true },
    5: { name: 'Wood', color: '#654321', mineable: true, drop: 5, isSolid: true },
};

// --- ЗМІННІ ГРИ ---
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const player = {
    x: 10 * TILE_SIZE,
    y: 0,
    width: TILE_SIZE,
    height: TILE_SIZE * 2,
    velX: 0,
    velY: 0,
    speed: 4,
    jumpStrength: 10,
    onGround: false,
    health: 10,
    maxHealth: 10,
    inventory: Array(9).fill({ type: 0, count: 0 }),
    activeSlot: 0,
};

let world = [];
let cameraX = 0;
let isMovingLeft = false;
let isMovingRight = false;
let gravity = 0.5;

// --- ДОМ ЕЛЕМЕНТИ ---
const lightOverlay = document.getElementById('light-overlay');
const healthBar = document.getElementById('health-bar');
const hotbarElement = document.getElementById('hotbar');

// === МЕХАНІКА ГЕНЕРАЦІЇ СВІТУ ===
function generateWorld() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight - 120;
    
    const groundLevel = Math.floor(canvas.height / TILE_SIZE) - 4;
    
    for (let x = 0; x < WORLD_WIDTH; x++) {
        world[x] = [];
        const heightOffset = Math.floor(Math.sin(x * 0.2) * 2) + 1;
        
        for (let y = 0; y < canvas.height / TILE_SIZE; y++) {
            world[x][y] = BlockType[0];
            
            if (y === groundLevel - heightOffset) {
                world[x][y] = BlockType[1];
            } else if (y > groundLevel - heightOffset && y < groundLevel + 4) {
                world[x][y] = BlockType[2];
            } else if (y >= groundLevel + 4) {
                world[x][y] = BlockType[3];
                if (y > groundLevel + 6 && Math.random() < 0.02) {
                    world[x][y] = BlockType[4];
                }
            }
            
            // Просте дерево
            if (x % 15 === 5 && y > groundLevel - heightOffset && y < groundLevel + 4) {
                if (y === groundLevel - heightOffset + 3 || y === groundLevel - heightOffset + 4) {
                    world[x][y] = BlockType[5];
                }
            }
        }
    }
    player.y = (groundLevel - Math.floor(Math.sin(10 * 0.2) * 2) - 1) * TILE_SIZE;
}

// === МЕХАНІКА РУХУ ТА ФІЗИКИ ===
function checkCollision(x, y) {
    const tileX = Math.floor(x / TILE_SIZE);
    // Коригування Y: обчислюємо індекс Y знизу вгору
    const tileY = world[0] ? Math.floor((canvas.height - y) / TILE_SIZE) : 0; 
    
    if (tileX < 0 || tileX >= WORLD_WIDTH || !world[tileX] || tileY < 0 || tileY >= world[tileX].length) {
        return false;
    }
    
    // Перевіряємо, чи блок є твердим
    const block = world[tileX][tileY];
    return block && block.isSolid;
}

function updatePhysics() {
    // 1. Горизонтальний рух
    player.velX = 0;
    if (isMovingLeft) player.velX = -player.speed;
    if (isMovingRight) player.velX = player.speed;
    
    let newX = player.x + player.velX;
    
    // Перевірка горизонтальної колізії
    // Перевіряємо обидві ноги гравця
    if (!checkCollision(newX, player.y + 1) &&
        !checkCollision(newX + player.width - 1, player.y + 1) &&
        !checkCollision(newX, player.y + player.height - 1) &&
        !checkCollision(newX + player.width - 1, player.y + player.height - 1)) {
        
        player.x = newX;
    }

    // 2. Гравітація та вертикальний рух
    player.velY += gravity;
    if (player.velY > 10) player.velY = 10;
    
    let newY = player.y + player.velY;
    player.onGround = false;

    // Перевірка вертикальної колізії (Падаємо)
    if (player.velY > 0) {
        // Перевіряємо нижній край гравця
        if (checkCollision(player.x + 1, newY + player.height) ||
            checkCollision(player.x + player.width - 2, newY + player.height)) {
            
            player.velY = 0;
            // Корекція Y: вирівнюємося по верхньому краю блоку під нами
            const tileY = Math.floor((canvas.height - newY - player.height) / TILE_SIZE);
            player.y = canvas.height - ((tileY + 1) * TILE_SIZE) - player.height;
            player.onGround = true;
        } else {
            player.y = newY;
        }
    } else if (player.velY < 0) { // Стрибаємо вгору
        // Перевіряємо верхній край гравця
        if (checkCollision(player.x + 1, newY) ||
            checkCollision(player.x + player.width - 2, newY)) {
            
            player.velY = 0;
            // Корекція Y: вирівнюємося по нижньому краю блоку над нами
            const tileY = Math.floor((canvas.height - newY) / TILE_SIZE);
            player.y = canvas.height - (tileY * TILE_SIZE);
        } else {
            player.y = newY;
        }
    }
    
    cameraX = player.x - canvas.width / 2;
}


// === МЕХАНІКА ВИДОБУТКУ/БУДІВНИЦТВА ===
function handleAction() {
    // Обчислення центральної точки для націлювання
    const centerX = player.x + player.width / 2;
    const centerY = player.y + player.height / 2;
    
    // Націлюємося на блок ПЕРЕД гравцем
    const facingRight = isMovingRight || (!isMovingLeft && player.velX >= 0);
    const offsetX = facingRight ? player.width : -TILE_SIZE;
    
    // Координати кліка/націлювання
    const targetX = Math.floor((player.x + offsetX) / TILE_SIZE);
    
    // Використовуємо центр гравця для Y, щоб цілити на рівні очей/корпусу
    const targetYWorld = centerY - TILE_SIZE / 2;
    const targetY = Math.floor((canvas.height - targetYWorld) / TILE_SIZE); 

    if (targetX < 0 || targetX >= WORLD_WIDTH || targetY < 0 || !world[targetX] || targetY >= world[targetX].length) return;

    const block = world[targetX][targetY];
    
    if (block.mineable) {
        // ВИДОБУТОК
        const dropType = block.drop;
        world[targetX][targetY] = BlockType[0];
        
        // Спрощений підбір в перший слот
        let currentItem = player.inventory[0];
        if (currentItem.type === dropType || currentItem.type === 0) {
            player.inventory[0] = { type: dropType, count: (currentItem.count || 0) + 1 };
        }
        
        updateHUD();
    } else if (player.inventory[player.activeSlot].type !== 0 && block.name === 'Air') {
        // БУДІВНИЦТВО
        const itemId = player.inventory[player.activeSlot].type;
        const blockToPlace = BlockType[itemId];

        // Додаткова перевірка: не можна будувати на місці гравця
        const playerTileX = Math.floor(player.x / TILE_SIZE);
        const playerTileY1 = Math.floor((canvas.height - player.y) / TILE_SIZE);
        const playerTileY2 = Math.floor((canvas.height - (player.y + player.height - TILE_SIZE)) / TILE_SIZE);

        if (targetX === playerTileX && (targetY === playerTileY1 || targetY === playerTileY2)) {
            // Не можна будувати прямо на собі
            return; 
        }

        // Перевірка, чи сусідній блок є твердим (для реалістичності)
        const neighborSolid = 
            checkCollision((targetX * TILE_SIZE) + TILE_SIZE / 2, (canvas.height - (targetY + 1) * TILE_SIZE) + TILE_SIZE * 1.5) || // Під
            checkCollision((targetX * TILE_SIZE) + TILE_SIZE / 2, (canvas.height - (targetY + 1) * TILE_SIZE) - TILE_SIZE / 2) ||  // Над
            checkCollision((targetX * TILE_SIZE) + TILE_SIZE * 1.5, (canvas.height - (targetY + 1) * TILE_SIZE) + TILE_SIZE / 2) || // Праворуч
            checkCollision((targetX * TILE_SIZE) - TILE_SIZE / 2, (canvas.height - (targetY + 1) * TILE_SIZE) + TILE_SIZE / 2);  // Ліворуч
        
        if (neighborSolid) {
            world[targetX][targetY] = blockToPlace;
            player.inventory[player.activeSlot].count -= 1;
            if (player.inventory[player.activeSlot].count <= 0) {
                player.inventory[player.activeSlot] = { type: 0, count: 0 };
            }
            updateHUD();
        }
    }
}

// === МЕХАНІКА ЦИКЛУ ДЕНЬ/НІЧ ===
let globalTime = 0;

function updateDayNight() {
    // Час прискорений для демонстрації
    globalTime += 10;
    if (globalTime >= 24000) globalTime = 0;
    
    let darkness = 0;
    
    // Ніч: 18000 до 6000 (0.6 прозорість)
    if (globalTime > 18000 || globalTime < 6000) {
        darkness = 0.6;
    } 
    // Світанок: 6000 до 9000 (з 0.6 до 0)
    else if (globalTime >= 6000 && globalTime < 9000) {
        darkness = 0.6 - (globalTime - 6000) / 3000 * 0.6;
    } 
    // День: 9000 до 15000 (0 прозорість)
    else if (globalTime >= 9000 && globalTime < 15000) {
        darkness = 0;
    }
    // Захід: 15000 до 18000 (з 0 до 0.6)
    else if (globalTime >= 15000 && globalTime < 18000) {
        darkness = (globalTime - 15000) / 3000 * 0.6;
    }

    lightOverlay.style.backgroundColor = `rgba(0, 0, 0, ${darkness})`;
    document.body.style.backgroundColor = darkness < 0.4 ? '#5555FF' : '#1A1A50'; // Зміна кольору неба
}

// === СИСТЕМА РЕНДЕРИНГУ ===
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const startTileX = Math.max(0, Math.floor(cameraX / TILE_SIZE));
    const endTileX = Math.min(WORLD_WIDTH, startTileX + Math.ceil(canvas.width / TILE_SIZE) + 1);

    // 1. Рендеринг блоків
    for (let x = startTileX; x < endTileX; x++) {
        for (let y = 0; y < world[x].length; y++) {
            const block = world[x][y];
            if (block.name !== 'Air') {
                ctx.fillStyle = block.color;
                
                // Координати для рендерингу
                const renderX = x * TILE_SIZE - cameraX;
                // canvas.height - (y * TILE_SIZE) обертає координати Y (початок від низу)
                const renderY = canvas.height - ((y + 1) * TILE_SIZE); 
                
                ctx.fillRect(renderX, renderY, TILE_SIZE, TILE_SIZE);
                
                ctx.strokeStyle = '#00000044';
                ctx.strokeRect(renderX, renderY, TILE_SIZE, TILE_SIZE);
            }
        }
    }

    // 2. Рендеринг гравця
    ctx.fillStyle = '#C16A3C';
    ctx.fillRect(
        player.x - cameraX,
        canvas.height - player.y - player.height, // Коригування Y для рендерингу
        player.width,
        player.height
    );
    // Імітація бороди/обличчя
    ctx.fillStyle = '#333333';
    ctx.fillRect(player.x - cameraX + 8, canvas.height - player.y - player.height + 10, 16, 8);
}

// === ОНОВЛЕННЯ HUD ===
function updateHUD() {
    // Оновлення сердечок
    healthBar.innerHTML = '';
    for (let i = 0; i < player.maxHealth; i++) {
        const heart = document.createElement('div');
        heart.className = 'heart';
        if (i >= player.health) {
            heart.style.backgroundColor = '#333';
            heart.style.borderColor = '#111';
        }
        healthBar.appendChild(heart);
    }
    
    // Оновлення Hotbar
    hotbarElement.innerHTML = '';
    player.inventory.forEach((item, index) => {
        const slot = document.createElement('div');
        slot.className = `slot ${index === player.activeSlot ? 'active' : ''}`;
        
        if (item.type !== 0) {
            const blockInfo = BlockType[item.type];
            slot.style.backgroundColor = blockInfo.color;
            slot.style.color = 'white';
            slot.textContent = `x${item.count}`;
        } else {
            slot.textContent = index + 1;
        }
        
        slot.onclick = () => { player.activeSlot = index; updateHUD(); };
        hotbarElement.appendChild(slot);
    });
}

// === ІГРОВИЙ ЦИКЛ ===
function gameLoop() {
    updatePhysics();
    updateDayNight();
    draw();
    setTimeout(gameLoop, 1000 / GAME_FPS);
}

// === ІНІЦІАЛІЗАЦІЯ КЕРУВАННЯ (ВИПРАВЛЕНО) ===
function setupControls() {
    const controls = {
        'btn-left': (isDown) => isMovingLeft = isDown,
        'btn-right': (isDown) => isMovingRight = isDown,
        'btn-jump': () => { if (player.onGround) player.velY = -player.jumpStrength; },
        'btn-action': () => handleAction(),
    };

    Object.entries(controls).forEach(([id, action]) => {
        const btn = document.getElementById(id);
        if (btn) {
            if (id === 'btn-jump' || id === 'btn-action') {
                // Тільки одиничний виклик (клік/дотик), без встановлення стану
                btn.addEventListener('touchstart', (e) => { e.preventDefault(); action(); }); 
                btn.addEventListener('click', (e) => { e.preventDefault(); action(); });      
            } else {
                // Для Left/Right використовуємо стан (down/up)
                btn.addEventListener('touchstart', (e) => { e.preventDefault(); action(true); });
                btn.addEventListener('touchend', (e) => { e.preventDefault(); action(false); });
                
                btn.addEventListener('mousedown', (e) => { e.preventDefault(); action(true); });
                btn.addEventListener('mouseup', (e) => { e.preventDefault(); action(false); });
            }
        }
    });
}

// === ЗАПУСК ГРИ ===
function initGame() {
    // Telegram WebApp обов'язкові виклики
    if (typeof Telegram !== 'undefined' && Telegram.WebApp) {
        Telegram.WebApp.ready();
        Telegram.WebApp.expand();
    }
    
    window.addEventListener('resize', generateWorld);
    
    generateWorld();
    updateHUD();
    setupControls();
    
    gameLoop();
}

initGame();
