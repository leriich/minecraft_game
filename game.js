<script src="https://telegram.org/js/telegram-web-app.js"></script>

    <script>
        // === КОНСТАНТИ ГРИ ===
        const TILE_SIZE = 32;
        const GAME_FPS = 60;
        const WORLD_WIDTH = 200; // 200 блоків
        
        // Типи блоків та їх кольори
        const BlockType = {
            0: { name: 'Air', color: 'transparent', mineable: false, drop: null },
            1: { name: 'Grass', color: '#4CAF50', mineable: true, drop: 2 },
            2: { name: 'Dirt', color: '#8B4513', mineable: true, drop: 2 },
            3: { name: 'Stone', color: '#808080', mineable: true, drop: 3 },
            4: { name: 'Coal Ore', color: '#333333', mineable: true, drop: 4 },
            5: { name: 'Wood', color: '#654321', mineable: true, drop: 5 },
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
            inventory: Array(9).fill({ type: 0, count: 0 }), // 9 слотів hotbar
            activeSlot: 0,
        };
        
        let world = []; // 2D масив блоків
        let cameraX = 0;
        let isMovingLeft = false;
        let isMovingRight = false;
        let gravity = 0.5;
        
        // --- ДОМ ЕЛЕМЕНТИ ---
        const lightOverlay = document.getElementById('light-overlay');
        const healthBar = document.getElementById('health-bar');
        const hotbarElement = document.getElementById('hotbar');

        // === МЕХАНІКА ГЕНЕРАЦІЇ СВІТУ (Спрощена) ===
        function generateWorld() {
            // Встановлюємо розмір світу
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight - 120; // Мінус HUD/Controls
            
            // Базова лінія ґрунту
            const groundLevel = Math.floor(canvas.height / TILE_SIZE) - 4; 
            
            for (let x = 0; x < WORLD_WIDTH; x++) {
                world[x] = [];
                // Генерація рельєфу (хвилястий)
                const heightOffset = Math.floor(Math.sin(x * 0.2) * 2) + 1;
                
                for (let y = 0; y < canvas.height / TILE_SIZE; y++) {
                    world[x][y] = BlockType[0]; // Повітря
                    
                    if (y === groundLevel - heightOffset) {
                        world[x][y] = BlockType[1]; // Трава
                    } else if (y > groundLevel - heightOffset && y < groundLevel + 4) {
                        world[x][y] = BlockType[2]; // Земля
                    } else if (y >= groundLevel + 4) {
                        world[x][y] = BlockType[3]; // Камінь
                        // Імітація руди
                        if (y > groundLevel + 6 && Math.random() < 0.02) {
                            world[x][y] = BlockType[4]; // Вугілля
                        }
                    }
                }
                
                // Просте дерево
                if (x % 15 === 5) {
                    for(let y = groundLevel - heightOffset - 1; y < groundLevel - heightOffset + 3; y++) {
                        world[x][y] = BlockType[5]; // Стовбур
                    }
                }
            }
            player.y = (groundLevel - Math.floor(Math.sin(10 * 0.2) * 2) - 1) * TILE_SIZE; 
        }

        // === МЕХАНІКА РУХУ ТА ФІЗИКИ ===
        function checkCollision(x, y) {
            const tileX = Math.floor(x / TILE_SIZE);
            const tileY = Math.floor(y / TILE_SIZE);
            
            if (tileX < 0 || tileX >= WORLD_WIDTH || tileY < 0 || tileY >= world[0].length) {
                return false; // За межами світу
            }
            
            // Якщо блок існує і він не повітря, вважаємо його твердим
            return world[tileX][tileY] && world[tileX][tileY].mineable; 
        }
        
        function updatePhysics() {
            // 1. Горизонтальний рух
            player.velX = 0;
            if (isMovingLeft) player.velX = -player.speed;
            if (isMovingRight) player.velX = player.speed;
            
            let newX = player.x + player.velX;
            
            // Перевірка горизонтальної колізії (вгорі та внизу)
            if (!checkCollision(newX, player.y) && 
                !checkCollision(newX, player.y + player.height - 1)) {
                 player.x = newX;
            }

            // 2. Гравітація та вертикальний рух
            player.velY += gravity;
            if (player.velY > 10) player.velY = 10; // Обмеження швидкості
            
            let newY = player.y + player.velY;
            player.onGround = false;

            // Перевірка вертикальної колізії
            if (player.velY > 0) { // Падаємо
                if (checkCollision(player.x, newY + player.height) || 
                    checkCollision(player.x + player.width - 1, newY + player.height)) {
                    // Зіткнення з землею
                    player.velY = 0;
                    // Точна корекція позиції
                    player.y = Math.floor((newY + player.height) / TILE_SIZE) * TILE_SIZE - player.height;
                    player.onGround = true;
                } else {
                    player.y = newY;
                }
            } else if (player.velY < 0) { // Стрибаємо вгору
                if (checkCollision(player.x, newY) || 
                    checkCollision(player.x + player.width - 1, newY)) {
                    // Зіткнення головою
                    player.velY = 0;
                    player.y = Math.floor(newY / TILE_SIZE) * TILE_SIZE + TILE_SIZE;
                } else {
                    player.y = newY;
                }
            }
            
            // Оновлення камери (Центрування гравця)
            cameraX = player.x - canvas.width / 2;
        }

        // === МЕХАНІКА ВИДОБУТКУ/БУДІВНИЦТВА ===
        function handleAction() {
            // Розрахунок блоку, на який націлився гравець (наприклад, + 2 блоки від центру)
            const targetX = Math.floor((player.x + player.width / 2 + (player.velX > 0 ? TILE_SIZE : -TILE_SIZE)) / TILE_SIZE);
            const targetY = Math.floor(player.y / TILE_SIZE) + 1; // Блок перед гравцем

            if (targetX < 0 || targetX >= WORLD_WIDTH || targetY >= world[0].length || targetY < 0) return;

            const block = world[targetX][targetY];
            
            if (block.mineable) {
                // ВИДОБУТОК: Змінюємо блок на Повітря та додаємо ресурс
                const dropType = block.drop;
                world[targetX][targetY] = BlockType[0]; // Видаляємо блок
                
                // Додаємо ресурс в інвентар (спрощена логіка: завжди в слот 0)
                let currentItem = player.inventory[0];
                if (currentItem.type === dropType || currentItem.type === 0) {
                    player.inventory[0] = { type: dropType, count: (currentItem.count || 0) + 1 };
                } else {
                    // Ускладнити логіку пошуку вільного слота тут
                }
                
                updateHUD();
                console.log(`Видобуто: ${block.name} at ${targetX}, ${targetY}`);

            } else if (player.inventory[player.activeSlot].type !== 0) {
                // БУДІВНИЦТВО: Якщо є активний предмет, розміщуємо його
                const itemId = player.inventory[player.activeSlot].type;
                if (world[targetX][targetY].type === 0) { // Перевірка, чи це повітря
                    // Створюємо новий об'єкт блоку, щоб не посилатися на BlockType напряму
                    world[targetX][targetY] = { ...BlockType[itemId] }; 
                    player.inventory[player.activeSlot].count -= 1; // Витрачаємо
                    if (player.inventory[player.activeSlot].count <= 0) {
                        player.inventory[player.activeSlot] = { type: 0, count: 0 };
                    }
                    updateHUD();
                    console.log(`Розміщено блок: ${BlockType[itemId].name} at ${targetX}, ${targetY}`);
                }
            }
        }
        
        // === МЕХАНІКА ЦИКЛУ ДЕНЬ/НІЧ ===
        let globalTime = 0;

        function updateDayNight() {
            globalTime += 10; // Швидкість часу
            if (globalTime >= 24000) globalTime = 0;
            
            // Інтенсивність темряви
            let darkness = 0; 
            if (globalTime > 18000 || globalTime < 6000) {
                // Ніч (Макс. темрява)
                darkness = 0.6;
            } else if (globalTime >= 6000 && globalTime < 9000) {
                // Світанок (від 0.6 до 0)
                darkness = 0.6 - (globalTime - 6000) / 3000 * 0.6;
            } else if (globalTime >= 15000 && globalTime < 18000) {
                // Сутінки (від 0 до 0.6)
                darkness = (globalTime - 15000) / 3000 * 0.6;
            }

            // Оновлення накладання освітлення
            lightOverlay.style.backgroundColor = `rgba(0, 0, 0, ${darkness})`;
            
            // Зміна кольору неба (Body)
            document.body.style.backgroundColor = darkness < 0.4 ? '#5555FF' : '#1A1A50';

            // ... Тут була б логіка спауну монстрів, якщо darkness > 0.5
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
                        ctx.fillRect(
                            x * TILE_SIZE - cameraX, 
                            canvas.height - (y * TILE_SIZE), // Інвертуємо Y
                            TILE_SIZE, 
                            TILE_SIZE
                        );
                        // Лінії сітки
                        ctx.strokeStyle = '#00000044';
                        ctx.strokeRect(x * TILE_SIZE - cameraX, canvas.height - (y * TILE_SIZE), TILE_SIZE, TILE_SIZE);
                    }
                }
            }

            // 2. Рендеринг гравця (персонаж з зображення)
            // Тимчасово малюємо прямокутник як персонажа
            ctx.fillStyle = '#C16A3C'; // Колір шкіри/одягу
            ctx.fillRect(
                player.x - cameraX, 
                canvas.height - player.y - player.height, 
                player.width, 
                player.height
            );
            // Імітація бороди з зображення
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
                    heart.style.backgroundColor = '#333'; // Пусте серце
                }
                healthBar.appendChild(heart);
            }
            
            // Оновлення Hotbar
            hotbarElement.innerHTML = '';
            player.inventory.forEach((item, index) => {
                const slot = document.createElement('div');
                slot.className = `slot ${index === player.activeSlot ? 'active' : ''}`;
                
                // Відображення предмета/блоку
                if (item.type !== 0) {
                     const blockInfo = BlockType[item.type];
                     slot.style.backgroundColor = blockInfo.color;
                     slot.style.color = 'white';
                     slot.textContent = `x${item.count}`;
                } else {
                     slot.textContent = index + 1; // Номер слоту
                }
                
                // Функція кліку для зміни активного слота
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
                        // Одиничний клік/тап для стрибка та дії
                        btn.addEventListener('touchstart', (e) => { e.preventDefault(); action(true); });
                        btn.addEventListener('click', (e) => { e.preventDefault(); action(true); }); 
                        // Вимикаємо безперервний рух для стрибка та дії
                    } else {
                        // Тривале утримання для руху
                        btn.addEventListener('touchstart', (e) => { e.preventDefault(); action(true); });
                        btn.addEventListener('touchend', (e) => { e.preventDefault(); action(false); });
                        
                        // Підтримка десктопу для тесту
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
            window.addEventListener('resize', generateWorld); // Адаптивність
            
            generateWorld();
            updateHUD(); // Ініціалізація HUD
            setupControls(); // Ініціалізація кнопок
            
            gameLoop(); // Запускаємо основний цикл
        }

        initGame();
    </script>
