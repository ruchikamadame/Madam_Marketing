#!/bin/bash
# Setup script for Madam Marketing backend
# Run this after cloning the repository

echo "Madam Marketing Backend Setup"
echo "=============================="

# Check if node is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16+"
    exit 1
fi

echo "✅ Node.js found: $(node --version)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm"
    exit 1
fi

echo "✅ npm found: $(npm --version)"

# Navigate to backend directory
cd "$(dirname "$0")"

# Check if .env exists
if [ ! -f ".env" ]; then
    echo ""
    echo "⚠️  .env file not found"
    echo "Please create .env file based on .env.example before running the server"
    echo ""
    read -p "Would you like to create a sample .env file? (y/N) " response
    if [ "$response" = "y" ] || [ "$response" = "Y" ]; then
        cp .env.example .env
        echo "Created .env file"
    else
        echo "Continuing without .env file"
    fi
fi

# Check if service account key exists
if [ -z "$GOOGLE_CALENDAR_CLIENT_EMAIL" ] || [ -z "$GOOGLE_CALENDAR_PRIVATE_KEY" ]; then
    echo ""
    echo "⚠️  Google Calendar credentials not configured"
    echo "Please follow the setup guide: backend/GOOGLE_CALENDAR_SETUP.md"
    echo ""
fi

# Install dependencies
echo ""
echo "Installing dependencies..."
npm install

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Setup complete!"
    echo ""
    echo "To start the server:"
    echo "  cd backend"
    echo "  node server.js"
    echo ""
    echo "For development with auto-reload:"
    echo "  cd backend"
    echo "  npm run dev"
else
    echo "❌ Failed to install dependencies"
    exit 1
fi
