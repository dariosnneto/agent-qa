#!/bin/bash
curl -s -X POST http://localhost:3001 -H 'Content-Type: application/json' -d @/mnt/c/AgentQA/scripts/test-payload.json
