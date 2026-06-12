#!/bin/bash
set -e

# Start the API server in the background
PORT=3000 pnpm --filter @workspace/api-server run dev &
API_PID=$!

# Start the frontend (foreground, this is what waitForPort watches)
pnpm --filter @workspace/pw-clone run dev &
FRONTEND_PID=$!

# Wait for both processes; exit if either dies
wait $API_PID $FRONTEND_PID
