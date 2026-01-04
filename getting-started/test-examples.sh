#!/bin/bash

# Test script for NLAP getting started examples
# This script helps verify all examples work correctly

set -e  # Exit on error

echo "========================================"
echo "NLAP Getting Started - Example Tester"
echo "========================================"
echo ""

# Check Node version
echo "Checking Node.js version..."
NODE_VERSION=$(node --version)
echo "✓ Node.js $NODE_VERSION"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found"
    echo ""
    echo "Please create a .env file with:"
    echo "  ANTHROPIC_API_KEY=your_key_here"
    echo ""
    echo "You can copy from .env.example:"
    echo "  cp .env.example .env"
    echo ""
    exit 1
fi

# Check if API key is set
source .env
if [ -z "$ANTHROPIC_API_KEY" ] || [ "$ANTHROPIC_API_KEY" = "your_api_key_here" ]; then
    echo "❌ Error: ANTHROPIC_API_KEY not set in .env"
    echo ""
    echo "Please edit .env and add your API key:"
    echo "  ANTHROPIC_API_KEY=sk-ant-..."
    echo ""
    exit 1
fi

echo "✓ Environment configured"
echo ""

# Install dependencies if needed
if [ ! -d node_modules ]; then
    echo "Installing dependencies..."
    npm install
    echo ""
fi

echo "✓ Dependencies installed"
echo ""

# Test 1: Minimal Example
echo "========================================"
echo "Test 1: Minimal Example"
echo "========================================"
echo ""
echo "Running minimal-example.ts..."
echo ""

if npx tsx minimal-example.ts; then
    echo ""
    echo "✅ Minimal example passed!"
else
    echo ""
    echo "❌ Minimal example failed"
    exit 1
fi

echo ""
echo "Press Enter to continue to next test..."
read

# Test 2: Simple Task Example
echo ""
echo "========================================"
echo "Test 2: Simple Task Example"
echo "========================================"
echo ""
echo "Running simple-task-example.ts..."
echo ""

if npx tsx simple-task-example.ts; then
    echo ""
    echo "✅ Simple task example passed!"
else
    echo ""
    echo "❌ Simple task example failed"
    exit 1
fi

echo ""
echo "========================================"
echo "All Tests Passed! 🎉"
echo "========================================"
echo ""
echo "Next steps:"
echo "1. Try the complete example: cd complete-example && npm install && npm start"
echo "2. Modify the examples to fit your use case"
echo "3. Read GETTING_STARTED.md for more information"
echo ""
