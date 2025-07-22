from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
import json
import asyncio
from typing import Dict, List
import uuid
from .game import GameManager

app = FastAPI(title="Multi-user Snake Game")

app.mount("/static", StaticFiles(directory="static"), name="static")

game_manager = GameManager()

@app.get("/", response_class=HTMLResponse)
async def get_game():
    with open("templates/index.html", "r") as f:
        return HTMLResponse(content=f.read())

@app.websocket("/ws/{player_name}")
async def websocket_endpoint(websocket: WebSocket, player_name: str):
    await websocket.accept()
    player_id = str(uuid.uuid4())
    
    try:
        await game_manager.add_player(player_id, player_name, websocket)
        
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            await game_manager.handle_message(player_id, message)
            
    except WebSocketDisconnect:
        await game_manager.remove_player(player_id)
    except Exception as e:
        print(f"Error in websocket: {e}")
        await game_manager.remove_player(player_id)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
