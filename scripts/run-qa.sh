#!/bin/bash
# Loads ANTHROPIC_API_KEY and other vars from /mnt/c/AgentQA/.env
set -a; source /mnt/c/AgentQA/.env; set +a
cd /mnt/c/AgentQA
/home/user/.bun/bin/bun run src/index.ts 2>&1
