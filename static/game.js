class SnakeGame {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.websocket = null;
        this.playerName = '';
        this.gameState = null;
        this.cellSize = 20;
        
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
            
            let direction = null;
            
            switch(e.key.toLowerCase()) {
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
            }
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
        
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        const cellWidth = this.canvas.width / board_width;
        const cellHeight = this.canvas.height / board_height;
        this.cellSize = Math.min(cellWidth, cellHeight);
        
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 1;
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
        
        this.ctx.fillStyle = '#FF6B6B';
        food.forEach(([x, y]) => {
            this.ctx.fillRect(
                x * this.cellSize + 2,
                y * this.cellSize + 2,
                this.cellSize - 4,
                this.cellSize - 4
            );
        });
        
        snakes.forEach(snake => {
            if (!snake.alive) return;
            
            this.ctx.fillStyle = snake.color;
            snake.body.forEach(([x, y], index) => {
                if (index === 0) {
                    this.ctx.fillRect(
                        x * this.cellSize + 1,
                        y * this.cellSize + 1,
                        this.cellSize - 2,
                        this.cellSize - 2
                    );
                    
                    this.ctx.fillStyle = '#000';
                    const eyeSize = 3;
                    this.ctx.fillRect(
                        x * this.cellSize + 5,
                        y * this.cellSize + 5,
                        eyeSize,
                        eyeSize
                    );
                    this.ctx.fillRect(
                        x * this.cellSize + this.cellSize - 8,
                        y * this.cellSize + 5,
                        eyeSize,
                        eyeSize
                    );
                    this.ctx.fillStyle = snake.color;
                } else {
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
