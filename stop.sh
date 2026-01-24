#!/bin/bash

# Rifah Platform - Stop Script (Bash/Mac/Linux)
# Stops all services

echo "🛑 Stopping Rifah Platform..."
echo ""

# Stop backend and frontend if PIDs exist
if [ -f "logs/backend.pid" ]; then
    BACKEND_PID=$(cat logs/backend.pid)
    if ps -p $BACKEND_PID > /dev/null 2>&1; then
        echo "🔧 Stopping backend server (PID: $BACKEND_PID)..."
        kill $BACKEND_PID
        rm logs/backend.pid
    fi
fi

if [ -f "logs/frontend.pid" ]; then
    FRONTEND_PID=$(cat logs/frontend.pid)
    if ps -p $FRONTEND_PID > /dev/null 2>&1; then
        echo "🎨 Stopping frontend server (PID: $FRONTEND_PID)..."
        kill $FRONTEND_PID
        rm logs/frontend.pid
    fi
fi

# Stop Docker services
echo "🐳 Stopping Docker services..."
docker-compose down

echo ""
echo "✅ All services stopped!"
echo ""

