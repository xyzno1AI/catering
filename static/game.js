class SnakeGame {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.websocket = null;
        this.playerName = '';
        this.gameState = null;
        this.cellSize = 20;
        this.lastKeyTime = 0;
        this.keyDelay = 100;
        this.pressedKeys = new Set();
        
        this.initializeEventListeners();
    }
    
    initializeEventListeners() {
        document.getElementById('join-game').addEventListener('click', () => {
            const nameInput = document.getElementById('player-name');
            const name = nameInput.value.trim();
            if (name) {
                this.playerName = name;
                this.connectToGame();
            } else {
                alert('请输入昵称！');
            }
        });
        
        document.getElementById('player-name').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('join-game').click();
            }
        });
        
        document.getElementById('leave-game').addEventListener('click', () => {
            this.disconnectFromGame();
        });
        
        document.addEventListener('keydown', (e) => {
            if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
                return;
            }
            
            const currentTime = Date.now();
            if (currentTime - this.lastKeyTime < this.keyDelay) {
                return;
            }
            
            let direction = null;
            const key = e.key.toLowerCase();
            
            if (this.pressedKeys.has(key)) {
                return;
            }
            
            this.pressedKeys.add(key);
            
            switch(key) {
                case 'w':
                case 'arrowup':
                    direction = 'UP';
                    break;
                case 's':
                case 'arrowdown':
                    direction = 'DOWN';
                    break;
                case 'a':
                case 'arrowleft':
                    direction = 'LEFT';
                    break;
                case 'd':
                case 'arrowright':
                    direction = 'RIGHT';
                    break;
            }
            
            if (direction) {
                e.preventDefault();
                this.sendDirection(direction);
                this.lastKeyTime = currentTime;
            }
        });
        
        document.addEventListener('keyup', (e) => {
            this.pressedKeys.delete(e.key.toLowerCase());
        });
    }
    
    connectToGame() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/${encodeURIComponent(this.playerName)}`;
        
        this.websocket = new WebSocket(wsUrl);
        
        this.websocket.onopen = () => {
            console.log('Connected to game server');
            this.updateConnectionStatus(true);
            this.showGameScreen();
        };
        
        this.websocket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'game_state') {
                this.gameState = data;
                this.updateGame();
            }
        };
        
        this.websocket.onclose = () => {
            console.log('Disconnected from game server');
            this.updateConnectionStatus(false);
        };
        
        this.websocket.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.updateConnectionStatus(false);
            alert('连接游戏服务器失败，请稍后重试！');
        };
    }
    
    disconnectFromGame() {
        if (this.websocket) {
            this.websocket.close();
            this.websocket = null;
        }
        this.showLoginScreen();
    }
    
    sendDirection(direction) {
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            this.websocket.send(JSON.stringify({
                type: 'direction',
                direction: direction
            }));
        }
    }
    
    updateGame() {
        if (!this.gameState) return;
        
        this.drawGame();
        this.updateScoreboard();
    }
    
    drawGame() {
        const { snakes, food, board_width, board_height } = this.gameState;
        
        const gradient = this.ctx.createLinearGradient(0, 0, this.canvas.width, this.canvas.height);
        gradient.addColorStop(0, '#0a0a0a');
        gradient.addColorStop(1, '#1a1a1a');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        const cellWidth = this.canvas.width / board_width;
        const cellHeight = this.canvas.height / board_height;
        this.cellSize = Math.min(cellWidth, cellHeight);
        
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.lineWidth = 0.5;
        for (let x = 0; x <= board_width; x++) {
            this.ctx.beginPath();
            this.ctx.moveTo(x * this.cellSize, 0);
            this.ctx.lineTo(x * this.cellSize, board_height * this.cellSize);
            this.ctx.stroke();
        }
        for (let y = 0; y <= board_height; y++) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y * this.cellSize);
            this.ctx.lineTo(board_width * this.cellSize, y * this.cellSize);
            this.ctx.stroke();
        }
        
        food.forEach(([x, y]) => {
            const centerX = x * this.cellSize + this.cellSize / 2;
            const centerY = y * this.cellSize + this.cellSize / 2;
            const radius = this.cellSize / 3;
            
            const foodGradient = this.ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
            foodGradient.addColorStop(0, '#FF6B6B');
            foodGradient.addColorStop(0.7, '#FF4757');
            foodGradient.addColorStop(1, '#C44569');
            
            this.ctx.fillStyle = foodGradient;
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
            this.ctx.fill();
            
            this.ctx.shadowColor = '#FF6B6B';
            this.ctx.shadowBlur = 10;
            this.ctx.fill();
            this.ctx.shadowBlur = 0;
        });
        
        snakes.forEach(snake => {
            if (!snake.alive) return;
            
            snake.body.forEach(([x, y], index) => {
                const centerX = x * this.cellSize + this.cellSize / 2;
                const centerY = y * this.cellSize + this.cellSize / 2;
                
                if (index === 0) {
                    const headGradient = this.ctx.createRadialGradient(
                        centerX, centerY, 0,
                        centerX, centerY, this.cellSize / 2
                    );
                    headGradient.addColorStop(0, this.lightenColor(snake.color, 20));
                    headGradient.addColorStop(1, snake.color);
                    
                    this.ctx.fillStyle = headGradient;
                    this.ctx.fillRect(
                        x * this.cellSize + 1,
                        y * this.cellSize + 1,
                        this.cellSize - 2,
                        this.cellSize - 2
                    );
                    
                    this.ctx.shadowColor = snake.color;
                    this.ctx.shadowBlur = 8;
                    this.ctx.fillRect(
                        x * this.cellSize + 1,
                        y * this.cellSize + 1,
                        this.cellSize - 2,
                        this.cellSize - 2
                    );
                    this.ctx.shadowBlur = 0;
                    
                    this.ctx.fillStyle = '#FFF';
                    const eyeSize = 4;
                    this.ctx.fillRect(
                        x * this.cellSize + 4,
                        y * this.cellSize + 4,
                        eyeSize,
                        eyeSize
                    );
                    this.ctx.fillRect(
                        x * this.cellSize + this.cellSize - 8,
                        y * this.cellSize + 4,
                        eyeSize,
                        eyeSize
                    );
                    
                    this.ctx.fillStyle = '#000';
                    this.ctx.fillRect(
                        x * this.cellSize + 5,
                        y * this.cellSize + 5,
                        2,
                        2
                    );
                    this.ctx.fillRect(
                        x * this.cellSize + this.cellSize - 7,
                        y * this.cellSize + 5,
                        2,
                        2
                    );
                } else {
                    const bodyGradient = this.ctx.createRadialGradient(
                        centerX, centerY, 0,
                        centerX, centerY, this.cellSize / 2
                    );
                    bodyGradient.addColorStop(0, this.lightenColor(snake.color, 10));
                    bodyGradient.addColorStop(1, this.darkenColor(snake.color, 10));
                    
                    this.ctx.fillStyle = bodyGradient;
                    this.ctx.fillRect(
                        x * this.cellSize + 2,
                        y * this.cellSize + 2,
                        this.cellSize - 4,
                        this.cellSize - 4
                    );
                }
            });
        });
    }
    
    lightenColor(color, percent) {
        const num = parseInt(color.replace("#",""), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) + amt;
        const G = (num >> 8 & 0x00FF) + amt;
        const B = (num & 0x0000FF) + amt;
        return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
            (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
            (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
    }
    
    darkenColor(color, percent) {
        const num = parseInt(color.replace("#",""), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) - amt;
        const G = (num >> 8 & 0x00FF) - amt;
        const B = (num & 0x0000FF) - amt;
        return "#" + (0x1000000 + (R > 255 ? 255 : R < 0 ? 0 : R) * 0x10000 +
            (G > 255 ? 255 : G < 0 ? 0 : G) * 0x100 +
            (B > 255 ? 255 : B < 0 ? 0 : B)).toString(16).slice(1);
    }
    
    updateScoreboard() {
        const scoreboard = document.getElementById('scoreboard');
        const { snakes } = this.gameState;
        
        const sortedSnakes = [...snakes].sort((a, b) => b.score - a.score);
        
        scoreboard.innerHTML = '';
        sortedSnakes.forEach(snake => {
            const playerDiv = document.createElement('div');
            playerDiv.className = 'player-score';
            
            const nameSpan = document.createElement('span');
            nameSpan.className = 'player-name';
            nameSpan.textContent = snake.player_name;
            nameSpan.style.color = snake.color;
            
            const scoreSpan = document.createElement('span');
            scoreSpan.textContent = snake.score;
            
            const statusSpan = document.createElement('span');
            statusSpan.className = `player-status ${snake.alive ? 'alive' : 'dead'}`;
            statusSpan.textContent = snake.alive ? '存活' : '死亡';
            
            playerDiv.appendChild(nameSpan);
            playerDiv.appendChild(scoreSpan);
            playerDiv.appendChild(statusSpan);
            
            scoreboard.appendChild(playerDiv);
        });
    }
    
    updateConnectionStatus(connected) {
        const statusDiv = document.getElementById('connection-status');
        if (connected) {
            statusDiv.textContent = '连接状态: 已连接';
            statusDiv.className = 'connected';
        } else {
            statusDiv.textContent = '连接状态: 断开';
            statusDiv.className = 'disconnected';
        }
    }
    
    showLoginScreen() {
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('game-screen').classList.add('hidden');
    }
    
    showGameScreen() {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('game-screen').classList.remove('hidden');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new SnakeGame();
});
