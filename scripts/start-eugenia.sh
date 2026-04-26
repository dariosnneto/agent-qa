#!/bin/bash
# Loads ANTHROPIC_API_KEY and other vars from /mnt/c/AgentQA/.env
set -a; source /mnt/c/AgentQA/.env; set +a
pkill -f eugenia-webhook 2>/dev/null || true
sleep 1
nohup /home/user/.bun/bin/bun /mnt/c/AgentQA/src/eugenia-webhook.ts > /tmp/eugenia.log 2>&1 &
echo PID=$!
