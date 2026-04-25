# Genie & Omni Docker Compose Setup

Created two Docker Compose configurations to run both self-hosted frameworks.

## Genie Compose (`docker-compose-genie.yml`)

Runs the core infrastructure for Genie:
- **PostgreSQL** on port 5432
- **NATS JetStream** on port 4222/8222

To start:
```bash
docker compose -f docker-compose-genie.yml up -d
```

Clone the Genie repository and run:
```bash
git clone https://github.com/automagik-dev/genie.git
cd genie
npm install
npm run dev
```

Access via port 3000 once running.

## Omni Compose (`docker-compose-omni.yml`)

Runs the core infrastructure for Omni:
- **PostgreSQL** on port 5432
- **NATS JetStream** on port 4222/8222

To start:
```bash
docker compose -f docker-compose-omni.yml up -d
```

Clone the Omni repository and run:
```bash
git clone https://github.com/automagik-dev/omni.git
cd omni
make setup    # Installs deps + initializes DB
make dev      # Starts API on port 8882
```

Access API Swagger docs at `http://localhost:8882/api/v2/docs`.

## Environment Variables

Both configurations use default passwords for local development:
- **PostgreSQL user**: `genie`/`omni`
- **PostgreSQL password**: `genie_password_change_me` / `omni_password_change_me`
- **DATABASE_URL**: `postgresql://user:password@localhost:5432/dbname`
- **NATS_URL**: `nats://localhost:4222`

For production, update the passwords in the compose files and your app configs.

## Stopping Services

```bash
docker compose -f docker-compose-genie.yml down
docker compose -f docker-compose-omni.yml down
```

Both frameworks are now ready to containerize with their own Node.js/Bun services.
