import os
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_anthropic import ChatAnthropic
from langchain_community.vectorstores import Chroma
from langchain_community.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.chains import ConversationalRetrievalChain
from langchain.memory import ConversationBufferMemory
import json
import asyncio
from typing import List
from fastapi_limiter import FastAPILimiter
from fastapi_limiter.depends import RateLimiter
import redis.asyncio as redis
from redis.exceptions import ConnectionError as RedisConnectionError

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

openai_llm = ChatOpenAI(model_name="gpt-3.5-turbo")
anthropic_llm = ChatAnthropic(model="claude-3-sonnet-20240229")

embeddings = OpenAIEmbeddings()

def load_documents():
    documents = []
    for file in os.listdir("data"):
        if file.endswith(".pdf"):
            loader = PyPDFLoader(os.path.join("data", file))
            documents.extend(loader.load())
    
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    return text_splitter.split_documents(documents)

documents = load_documents()
vectorstore = Chroma.from_documents(documents, embeddings)

retriever = vectorstore.as_retriever()

memory = ConversationBufferMemory(memory_key="chat_history", return_messages=True)

openai_chain = ConversationalRetrievalChain.from_llm(
    openai_llm, 
    retriever=retriever, 
    memory=memory
)
anthropic_chain = ConversationalRetrievalChain.from_llm(
    anthropic_llm, 
    retriever=retriever, 
    memory=memory
)

class Query(BaseModel):
    text: str
    use_anthropic: bool = True

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.broadcast_queue: asyncio.Queue = asyncio.Queue()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast_worker(self):
        while True:
            message = await self.broadcast_queue.get()
            await self._broadcast(message)
            self.broadcast_queue.task_done()

    async def _broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except WebSocketDisconnect:
                self.active_connections.remove(connection)

    async def broadcast(self, message: str):
        await self.broadcast_queue.put(message)

manager = ConnectionManager()

@app.on_event("startup")
async def startup():
    try:
        r = redis.from_url("redis://localhost", encoding="utf-8", decode_responses=True)
        await FastAPILimiter.init(r)
        print("Redis connection established. Rate limiting is active.")
    except Exception as e:
        print(f"Could not connect to Redis. Rate limiting is disabled. Error: {str(e)}")
    
    asyncio.create_task(manager.broadcast_worker())

@app.post("/chat")
async def chat(query: Query):
    try:
        print("Received query:", query.text)
        
        # Split the text into lines
        lines = query.text.split("\n")
        
        # The last line that starts with "USER:" is the current query
        user_query = next((line.split("USER: ", 1)[1] for line in reversed(lines) if line.startswith("USER: ")), "")
        
        # Everything before the last "USER:" line is the context
        context = "\n".join(lines[:lines.index(f"USER: {user_query}")])

        print("Parsed context:", context)
        print("User query:", user_query)

        # Use the context to set up the conversation
        for line in lines:
            if line.startswith("USER:"):
                memory.chat_memory.add_user_message(line[5:].strip())
            elif line.startswith("ASSISTANT:"):
                memory.chat_memory.add_ai_message(line[10:].strip())

        # Generate the response
        response = chain({"question": user_query})
        
        print("Generated response:", response["answer"])
        return {"response": response["answer"]}
    except Exception as e:
        print(f"Error in chat function: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                query = json.loads(data)
                chain = anthropic_chain if query.get('use_anthropic', True) else openai_chain
                
                # Parse the formatted prompt
                prompt_parts = query['text'].split("ASSISTANT: ")
                context = prompt_parts[0]
                user_query = prompt_parts[-1].strip()

                # Use the context to set up the conversation
                memory.chat_memory.add_user_message(context)
                
                # Generate the response
                response = chain({"question": user_query})
                
                await manager.broadcast(json.dumps({
                    "client_id": client_id,
                    "message": response["answer"]
                }))
            except json.JSONDecodeError:
                await websocket.send_json({"error": "Invalid JSON"})
            except KeyError:
                await websocket.send_json({"error": "Missing required fields"})
            except Exception as e:
                await websocket.send_json({"error": str(e)})
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        await manager.broadcast(json.dumps({
            "client_id": client_id,
            "message": "Client disconnected"
        }))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8088)