import asyncio
import json
from typing import Dict, List, Tuple
from fastapi import WebSocket
import random

class Snake:
    def __init__(self, player_id: str, player_name: str, start_x: int = 10, start_y: int = 10):
        self.player_id = player_id
        self.player_name = player_name
        self.body = [(start_x, start_y)]
        self.direction = "RIGHT"
        self.score = 0
        self.alive = True
        self.color = self._generate_color()
    
    def _generate_color(self):
        colors = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7", "#DDA0DD", "#98D8C8"]
        return random.choice(colors)
    
    def move(self):
        if not self.alive:
            return
            
        head_x, head_y = self.body[0]
        
        if self.direction == "UP":
            new_head = (head_x, head_y - 1)
        elif self.direction == "DOWN":
            new_head = (head_x, head_y + 1)
        elif self.direction == "LEFT":
            new_head = (head_x - 1, head_y)
        elif self.direction == "RIGHT":
            new_head = (head_x + 1, head_y)
        
        self.body.insert(0, new_head)
        self.body.pop()
    
    def grow(self):
        if self.body:
            tail = self.body[-1]
            self.body.append(tail)
            self.score += 10
    
    def change_direction(self, new_direction: str):
        opposite_directions = {
            "UP": "DOWN",
            "DOWN": "UP", 
            "LEFT": "RIGHT",
            "RIGHT": "LEFT"
        }
        
        if new_direction != opposite_directions.get(self.direction):
            self.direction = new_direction
    
    def check_collision(self, board_width: int, board_height: int, other_snakes: List['Snake']) -> bool:
        head_x, head_y = self.body[0]
        
        if head_x < 0 or head_x >= board_width or head_y < 0 or head_y >= board_height:
            return True
        
        if (head_x, head_y) in self.body[1:]:
            return True
        
        for snake in other_snakes:
            if snake.player_id != self.player_id and snake.alive:
                if (head_x, head_y) in snake.body:
                    return True
        
        return False

class GameManager:
    def __init__(self):
        self.players: Dict[str, WebSocket] = {}
        self.snakes: Dict[str, Snake] = {}
        self.food: List[Tuple[int, int]] = []
        self.board_width = 40
        self.board_height = 30
        self.game_running = False
        self.game_loop_task = None
        
        self._generate_food()
    
    def _generate_food(self):
        while len(self.food) < 3:
            x = random.randint(0, self.board_width - 1)
            y = random.randint(0, self.board_height - 1)
            
            occupied = False
            for snake in self.snakes.values():
                if (x, y) in snake.body:
                    occupied = True
                    break
            
            if not occupied and (x, y) not in self.food:
                self.food.append((x, y))
    
    async def add_player(self, player_id: str, player_name: str, websocket: WebSocket):
        self.players[player_id] = websocket
        
        start_x = random.randint(5, self.board_width - 5)
        start_y = random.randint(5, self.board_height - 5)
        
        self.snakes[player_id] = Snake(player_id, player_name, start_x, start_y)
        
        await self._broadcast_game_state()
        
        if not self.game_running:
            await self._start_game_loop()
    
    async def remove_player(self, player_id: str):
        if player_id in self.players:
            del self.players[player_id]
        if player_id in self.snakes:
            del self.snakes[player_id]
        
        await self._broadcast_game_state()
        
        if len(self.players) == 0:
            await self._stop_game_loop()
    
    async def handle_message(self, player_id: str, message: dict):
        if message.get("type") == "direction" and player_id in self.snakes:
            direction = message.get("direction")
            if direction in ["UP", "DOWN", "LEFT", "RIGHT"]:
                self.snakes[player_id].change_direction(direction)
    
    async def _start_game_loop(self):
        if self.game_running:
            return
        
        self.game_running = True
        self.game_loop_task = asyncio.create_task(self._game_loop())
    
    async def _stop_game_loop(self):
        self.game_running = False
        if self.game_loop_task:
            self.game_loop_task.cancel()
            try:
                await self.game_loop_task
            except asyncio.CancelledError:
                pass
    
    async def _game_loop(self):
        while self.game_running and len(self.players) > 0:
            for snake in self.snakes.values():
                if snake.alive:
                    snake.move()
            
            for snake in self.snakes.values():
                if snake.alive and snake.check_collision(self.board_width, self.board_height, list(self.snakes.values())):
                    snake.alive = False
            
            for snake in self.snakes.values():
                if snake.alive:
                    head = snake.body[0]
                    if head in self.food:
                        self.food.remove(head)
                        snake.grow()
                        self._generate_food()
            
            await self._broadcast_game_state()
            await asyncio.sleep(0.15)  # Game speed
    
    async def _broadcast_game_state(self):
        if not self.players:
            return
        
        game_state = {
            "type": "game_state",
            "snakes": [
                {
                    "player_id": snake.player_id,
                    "player_name": snake.player_name,
                    "body": snake.body,
                    "score": snake.score,
                    "alive": snake.alive,
                    "color": snake.color
                }
                for snake in self.snakes.values()
            ],
            "food": self.food,
            "board_width": self.board_width,
            "board_height": self.board_height
        }
        
        message = json.dumps(game_state)
        
        disconnected_players = []
        for player_id, websocket in self.players.items():
            try:
                await websocket.send_text(message)
            except Exception:
                disconnected_players.append(player_id)
        
        for player_id in disconnected_players:
            await self.remove_player(player_id)
