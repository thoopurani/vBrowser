#!/bin/bash

# Qdrant Browser Startup Script

echo "🚀 Starting Qdrant Browser..."

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.8+ first."
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "📦 Installing backend dependencies..."
cd backend
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

source venv/bin/activate
echo "Installing Python dependencies..."
pip install -r requirements.txt

echo "📦 Installing frontend dependencies..."
cd ../frontend
npm install

echo "🔧 Starting services..."

# Start backend in background
cd ../backend
source venv/bin/activate
echo "🌐 Starting backend server on http://localhost:7500"
python main.py &
BACKEND_PID=$!

# Start frontend in background
cd ../frontend
echo "🎨 Starting frontend server on http://localhost:5173"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ Qdrant Browser is starting up!"
echo "📊 Backend API: http://localhost:7500"
echo "🎨 Frontend: http://localhost:5173"
echo ""
echo "🌐 Opening frontend in default browser..."

# Wait a moment for services to start up, then open browser
sleep 3

# Open frontend URL in default browser
if command -v open &> /dev/null; then
    # macOS
    open http://localhost:5173
elif command -v xdg-open &> /dev/null; then
    # Linux
    xdg-open http://localhost:5173
elif command -v start &> /dev/null; then
    # Windows (Git Bash)
    start http://localhost:5173
else
    echo "⚠️  Could not automatically open browser. Please manually navigate to: http://localhost:5173"
fi

echo "Press Ctrl+C to stop all services"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping services..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    echo "✅ Services stopped"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Wait for both processes
wait 