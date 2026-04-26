#!/bin/bash
export PATH=/home/user/.bun/bin:/usr/local/bin:/usr/bin:/bin
cd /mnt/c/AgentQA/omni
exec bun packages/api/src/index.ts
