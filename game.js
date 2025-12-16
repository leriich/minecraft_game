// === КОНСТАНТИ ГРИ ===
const TILE_SIZE = 32;
const GAME_FPS = 60;
const WORLD_WIDTH = 200; 

// Типи блоків та їх кольори
const BlockType = {
    0: { name: 'Air', color: 'transparent', mineable: false, drop: null },
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
    const tileY = Math.floor((canvas.height - y) / TILE_SIZE); // Коригування Y
    
    if (tileX < 0 || tileX >= WORLD_WIDTH || tileY < 0 || tileY >= world[0].length) {
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
    if (!checkCollision(newX, player.y) && 
        !checkCollision(newX + player.width - 1, player.y)) { 
         player.x = newX;
    }

    // 2. Гравітація та вертикальний рух
    player.velY += gravity;
    if (player.velY > 10) player.velY = 10;
    
    let newY = player.y + player.velY;
    player.onGround = false;

    // Перевірка вертикальної колізії (Падаємо)
    if (player.velY > 0) { 
        if (checkCollision(player.x, newY + player.height) || 
            checkCollision(player.x + player.width - 1, newY + player.height)) {
            
            player.velY = 0;
            // Корекція Y
            const tileY = Math.floor((canvas.height - newY - player.height) / TILE_SIZE);
            player.y = canvas.height - (tileY * TILE_SIZE) - player.height;
            player.onGround = true;
        } else {
            player.y = newY;
        }
    } else if (player.velY < 0) { // Стрибаємо вгору
        if (checkCollision(player.x, newY) || 
            checkCollision(player.x + player.width - 1, newY)) {
            player.velY = 0;
            // Корекція Y
            const tileY = Math.floor((canvas.height - newY) / TILE_SIZE) + 1;
            player.y = canvas.height - (tileY * TILE_SIZE);

        } else {
            player.y = newY;
        }
    }
    
    cameraX = player.x - canvas.width / 2;
}

// === МЕХАНІКА ВИДОБУТКУ/БУДІВНИЦТВА ===
function handleAction() {
    // Припустимо, що гравець націлюється на блок перед собою
    const facingRight = player.velX >= 0;
    const offsetX = facingRight ? player.width : -TILE_SIZE;
    
    const targetX = Math.floor((player.x + offsetX) / TILE_SIZE);
    const targetY = Math.floor(player.y / TILE_SIZE); 

    if (targetX < 0 || targetX >= WORLD_WIDTH || targetY < 0 || targetY >= world[0].length) return;

    const blockIndexY = Math.floor((canvas.height - player.y - TILE_SIZE) / TILE_SIZE);
    const targetBlockIndexY = facingRight ? blockIndexY : blockIndexY; // Спрощення

    const block = world[targetX][targetBlockIndexY];
    
    if (block.mineable) {
        const dropType = block.drop;
        world[targetX][targetBlockIndexY] = BlockType[0]; 
        
        let currentItem = player.inventory[0];
        if (currentItem.type === dropType || currentItem.type === 0) {
            player.inventory[0] = { type: dropType, count: (currentItem.count || 0) + 1 };
        } 
        
        updateHUD();
    } else if (player.inventory[player.activeSlot].type !== 0 && block.type === 0) {
        // БУДІВНИЦТВО
        const itemId = player.inventory[player.activeSlot].type;
        world[targetX][targetBlockIndexY] = { ...BlockType[itemId] }; 
        player.inventory[player.activeSlot].count -= 1;
        if (player.inventory[player.activeSlot].count <= 0) {
            player.inventory[player.activeSlot] = { type: 0, count: 0 };
        }
        updateHUD();
    }
}

// === МЕХАНІКА ЦИКЛУ ДЕНЬ/НІЧ ===
let globalTime = 0;

function updateDayNight() {
    globalTime += 10; 
    if (globalTime >= 24000) globalTime = 0;
    
    let darkness = 0; 
    if (globalTime > 18000 || globalTime < 6000) {
        darkness = 0.6;
    } else if (globalTime >= 6000 && globalTime < 9000) {
        darkness = 0.6 - (globalTime - 6000) / 3000 * 0.6;
    } else if (globalTime >= 15000 && globalTime < 18000) {
        darkness = (globalTime - 15000) / 3000 * 0.6;
    }

    lightOverlay.style.backgroundColor = `rgba(0, 0, 0, ${darkness})`;
    document.body.style.backgroundColor = darkness < 0.4 ? '#5555FF' : '#1A1A50';
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
            if (block.type !== 0) {
                ctx.fillStyle = block.color;
                
                // Координати для рендерингу
                const renderX = x * TILE_SIZE - cameraX;
                const renderY = canvas.height - (y * TILE_SIZE); 
                
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
        canvas.height - player.y - player.height, 
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

// === ІНІЦІАЛІЗАЦІЯ КЕРУВАННЯ ===
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
                btn.addEventListener('touchstart', (e) => { e.preventDefault(); action(true); });
                btn.addEventListener('click', (e) => { e.preventDefault(); action(true); }); 
            } else {
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
    Telegram.WebApp.ready();
    Telegram.WebApp.expand(); 
    window.addEventListener('resize', generateWorld); 
    
    generateWorld();
    updateHUD(); 
    setupControls(); 
    
    gameLoop(); 
}

initGame();
