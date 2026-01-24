#!/bin/bash

# Rifah Platform - Start Script (Bash/Mac/Linux)
# Starts all services: Docker, Backend, Frontend

echo "🚀 Starting Rifah Platform..."
echo ""

# Check if Docker is running
echo "📦 Checking Docker..."
if ! docker ps > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi
echo "✅ Docker is running"

# Start Docker services
echo ""
echo "🐳 Starting Docker services (PostgreSQL, Redis)..."
docker-compose up -d

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
sleep 5

# Check if node_modules exist, install if not
if [ ! -d "server/node_modules" ]; then
    echo ""
    echo "📦 Installing server dependencies..."
    cd server
    npm install
    cd ..
fi

if [ ! -d "client/node_modules" ]; then
    echo ""
    echo "📦 Installing client dependencies..."
    cd client
    npm install
    cd ..
fi

# Start backend in background
echo ""
echo "🔧 Starting backend server..."
cd server
npm run dev > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
cd ..

# Wait a bit for backend to start
sleep 3

# Start frontend in background
echo ""
echo "🎨 Starting frontend server..."
cd client
npm run dev > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

# Create logs directory if it doesn't exist
mkdir -p logs

# Save PIDs to file for stop script
echo $BACKEND_PID > logs/backend.pid
echo $FRONTEND_PID > logs/frontend.pid

echo ""
echo "✅ All services started!"
echo ""
echo "📍 Services:"
echo "   - Backend:  http://localhost:5000"
echo "   - Frontend: http://localhost:3000"
echo "   - Database: localhost:5434"
echo ""
echo "💡 Run './stop.sh' to stop all services"
echo "💡 Check logs in ./logs/ directory"
echo ""

