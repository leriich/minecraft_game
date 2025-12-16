// --- КОНФІГУРАЦІЯ ТА КОНСТАНТИ ---
const TILE_SIZE = 32;
const CHUNK_SIZE = 16;
const WORLD_CHUNKS_X = 100; // Величезний світ
const GAME_FPS = 60;

// Ресурси та ID блоків
const BlockType = {
    AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, COAL_ORE: 4, WOOD: 5, LEAVES: 6, 
    CRAFTING_TABLE: 10, FURNACE: 11, WATER: 20, SAND: 21,
    DIAMOND_ORE: 50,
};

// --- КЛАСИ ТА СИСТЕМИ ---

// 1. КЛАС ГЕНЕРАТОРА СВІТУ (Procedural Generation, Biomes, Caves)
class WorldGenerator {
    constructor() {
        this.worldData = {}; // Зберігання блоків: {chunkX: {chunkY: [data]}}
        this.perlinNoise = this.initializePerlinNoise(); // Імітація Перліна для рельєфу
    }

    initializePerlinNoise() {
        // ... (Тут була б складна реалізація алгоритму Перліна)
        return { getHeight: (x) => Math.floor(5 + Math.sin(x * 0.1) * 3 + Math.random() * 2) };
    }

    generateChunk(chunkX) {
        // Створення нового чанку 
        const chunk = [];
        for (let x = 0; x < CHUNK_SIZE; x++) {
            const tileX = chunkX * CHUNK_SIZE + x;
            const surfaceY = this.perlinNoise.getHeight(tileX);
            
            for (let y = 0; y < CHUNK_SIZE * 5; y++) { // Глибокий світ
                let block = BlockType.AIR;
                if (y === surfaceY) {
                    block = BlockType.GRASS;
                } else if (y < surfaceY && y > surfaceY - 5) {
                    block = BlockType.DIRT;
                } else if (y <= surfaceY - 5) {
                    block = BlockType.STONE;
                    // Генерація руд (простий шанс)
                    if (Math.random() < 0.05) block = BlockType.COAL_ORE;
                    if (Math.random() < 0.005) block = BlockType.DIAMOND_ORE;
                }
                chunk.push({ type: block, x: tileX, y: y });
            }
        }
        return chunk;
    }
    
    getBlock(x, y) {
        // Логіка завантаження чанка, якщо його немає
        // ...
        return { type: BlockType.AIR }; // Повертаємо блок
    }
    
    setBlock(x, y, type) {
        // Логіка зміни блоку та збереження даних
        // ...
    }
}

// 2. КЛАС СИСТЕМИ ФІЗИКИ (Gravity, Collision)
class PhysicsEngine {
    constructor(world) {
        this.world = world;
        this.gravity = 0.5;
        this.terminalVelocity = 10;
    }
    
    applyPhysics(entity) {
        // Застосування гравітації
        entity.velocityY = Math.min(entity.velocityY + this.gravity, this.terminalVelocity);
        entity.y += entity.velocityY;

        // Перевірка колізій з блоками світу
        this.checkCollisions(entity);
    }
    
    checkCollisions(entity) {
        // ... (Складна логіка перевірки колізії гравця з блоками)
        // Якщо гравець зіткнувся знизу: entity.y = newY; entity.velocityY = 0; entity.onGround = true;
    }
    
    applyBlockPhysics() {
        // Логіка падіння піску та гравію
        // ...
    }
}

// 3. КЛАС СУТНОСТЕЙ (Гравець та Вороги)
class Entity {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = TILE_SIZE;
        this.height = TILE_SIZE * 2;
        this.velocityX = 0;
        this.velocityY = 0;
        this.health = 10;
        this.maxHealth = 10;
        this.onGround = false;
        this.facing = 'right';
    }
    
    takeDamage(amount) {
        this.health -= amount;
        if (this.health <= 0) this.die();
    }
    
    die() {
        // ... (Логіка смерті та дропу предметів)
    }
}

class Player extends Entity {
    constructor(x, y) {
        super(x, y);
        this.hunger = 20;
        this.maxHunger = 20;
        this.inventory = new Inventory();
        this.currentTool = 'Pickaxe';
    }
    
    // Рух та дія
    move(direction) {
        this.velocityX = direction * 5;
        this.facing = direction > 0 ? 'right' : 'left';
    }
    
    jump() {
        if (this.onGround) {
            this.velocityY = -10;
            this.onGround = false;
        }
    }
    
    mine(targetBlock) {
        // ... (Логіка часу видобутку, залежно від інструменту)
        // world.setBlock(targetBlock.x, targetBlock.y, BlockType.AIR);
    }
    
    placeBlock(type) {
        // ... (Логіка розміщення блоку, перевірка інвентарю)
    }
}

class Mob extends Entity {
    constructor(x, y, type) {
        super(x, y);
        this.type = type; // SLIME, SKELETON, ZOMBIE
        this.aiState = 'idle';
    }
    
    updateAI(player) {
        // ... (Складна логіка AI: пошук шляху, напад, уникнення)
    }
}

// 4. КЛАС ІНВЕНТАРЮ ТА КРАФТИНГУ
class Inventory {
    constructor() {
        this.slots = new Array(30).fill(null); // 30 слотів інвентарю
        this.hotbarSlots = 9;
    }
    
    addItem(item, count) {
        // ... (Логіка додавання, стекування предметів)
    }
    
    removeItem(slotIndex, count) {
        // ... (Логіка видалення)
    }
}

class CraftingSystem {
    constructor() {
        this.recipes = this.loadRecipes();
    }
    
    loadRecipes() {
        // ... (Тут буде ТИСЯЧА РЯДКІВ рецептів:
        // { output: {id: 101, count: 1}, required: [{id: 5, count: 3}, {id: 6, count: 2}] }
        // )
        return {
            'A1B1C1D1': { output: { id: 10, count: 1 }, name: "Crafting Table" }, // 4x Wood Planks
            // ... сотні рецептів
        };
    }
    
    craft(inputItems, workbenchType) {
        // ... (Логіка перевірки введених елементів за рецептами)
    }
}

// 5. КЛАС СИСТЕМИ РЕНДЕРИНГУ
class Renderer {
    constructor(canvas, world, player) {
        this.ctx = canvas.getContext('2d');
        this.world = world;
        this.player = player;
        this.canvas = canvas;
    }
    
    render() {
        // 1. Очистка
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 2. Розрахунок зміщення (Camera follow)
        const offsetX = this.canvas.width / 2 - this.player.x;
        
        // 3. Рендеринг світу
        this.ctx.save();
        this.ctx.translate(offsetX, 0);
        this.renderBlocks();
        this.renderMobs();
        
        // 4. Рендеринг гравця
        this.renderPlayer();
        this.ctx.restore();
        
        // 5. Рендеринг HUD (незалежно від прокрутки)
        this.renderHUD();
    }
    
    renderBlocks() {
        // ... (Логіка малювання блоків з world.worldData)
        // ... (Логіка освітлення від факелів)
    }
    
    renderPlayer() {
        // ... (Логіка малювання персонажа з анімацією ходьби/стрибка)
    }
    
    renderHUD() {
        // ... (Оновлення DOM елементів для здоров'я, голоду, hotbar)
    }
}

// 6. КЛАС ЦИКЛУ ДЕНЬ/НІЧ
class DayNightCycle {
    constructor() {
        this.time = 0; // 0 до 24000 (один день)
        this.skyColor = '';
    }
    
    update() {
        this.time += 10; // Швидкість часу
        if (this.time >= 24000) this.time = 0;
        
        // Зміна кольору неба та інтенсивності накладання
        if (this.time < 6000 || this.time > 18000) {
            // Ніч: темний фон, поява монстрів
            this.skyColor = '#1A1A50';
            // ... Логіка спауну монстрів
        } else {
            // День
            this.skyColor = '#5555FF';
        }
        document.body.style.backgroundColor = this.skyColor;
        // ... Логіка оновлення освітлення (light-overlay)
    }
}


// --- ІГРОВИЙ КОНТРОЛЕР (ГОЛОВНИЙ ЦИКЛ) ---
class GameController {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight - 80; // Мінус HUD
        
        this.worldGenerator = new WorldGenerator();
        this.physicsEngine = new PhysicsEngine(this.worldGenerator);
        this.dayNightCycle = new DayNightCycle();
        this.craftingSystem = new CraftingSystem();
        
        this.player = new Player(500, 300);
        this.renderer = new Renderer(this.canvas, this.worldGenerator, this.player);
        this.mobs = [];
        
        this.initializeControls();
        this.worldGenerator.generateChunk(0); // Початкова генерація
    }
    
    initializeControls() {
        // ... (Прив'язка touchstart/touchend до this.player.move та this.player.jump)
        // ... (Прив'язка кліку по екрану до this.player.mine та this.player.placeBlock)
        
        // Прив'язка кнопки інвентарю/крафтингу
        // document.getElementById('inventory-button').addEventListener('click', () => {
        //     // ... Логіка відкриття/закриття інвентарю
        // });
    }
    
    gameLoop() {
        // 1. Оновлення вводу (Controls handled by event listeners)

        // 2. Оновлення фізики та сутностей
        this.physicsEngine.applyPhysics(this.player);
        this.mobs.forEach(mob => {
            mob.updateAI(this.player);
            this.physicsEngine.applyPhysics(mob);
        });
        
        // 3. Оновлення світу
        this.physicsEngine.applyBlockPhysics();
        this.dayNightCycle.update();
        
        // 4. Рендеринг
        this.renderer.render();
        
        setTimeout(() => this.gameLoop(), 1000 / GAME_FPS);
    }
    
    start() {
        console.log("Survival Terraria 2D запущено. Готуйтеся до виживання!");
        this.gameLoop();
    }
}

// Запуск гри
window.onload = () => {
    // Ініціалізація Telegram WebApp SDK
    Telegram.WebApp.ready();
    Telegram.WebApp.expand();
    
    const game = new GameController();
    game.start();
};