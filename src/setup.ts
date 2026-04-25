import { createOmniClient } from '@omni/sdk';

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

const INSTANCE_NAME = 'qa-agent-eugenia';
const QR_POLL_MS = 3_000;
const QR_TIMEOUT_MS = 120_000;

export async function setupInstance(baseUrl: string, apiKey: string, existingId?: string): Promise<string> {
  const omni = createOmniClient({ baseUrl, apiKey });

  let instanceId: string;

  if (existingId) {
    // Verify the stored instance still exists
    try {
      await omni.instances.get(existingId);
      instanceId = existingId;
      console.log(`♻️  Usando instância: ${instanceId}`);
    } catch {
      console.warn(`⚠️  Instância ${existingId} não encontrada. Criando nova...`);
      instanceId = await createInstance(omni);
    }
  } else {
    // Reuse by name if it already exists, otherwise create
    const { items } = await omni.instances.list();
    const existing = items.find(i => i.name === INSTANCE_NAME);
    if (existing) {
      instanceId = existing.id;
      console.log(`♻️  Instância existente encontrada: ${instanceId}`);
    } else {
      instanceId = await createInstance(omni);
    }
  }

  // Check if already connected — skip QR if so
  const status = await omni.instances.status(instanceId);
  if (status.isConnected) {
    console.log(`✅ WhatsApp já conectado${status.profileName ? ` (${status.profileName})` : ''}`);
    return instanceId;
  }

  // Show QR code and wait for the user to scan
  console.log('\n📱 Escaneie o QR code com o celular do agente QA. Aguardando...\n');
  const deadline = Date.now() + QR_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const { qr, message } = await omni.instances.qr(instanceId);

    if (qr) {
      // Omni returns the raw QR string — display it and let the Omni web UI show the image
      process.stdout.write(`\r📲 QR disponível. Acesse http://localhost:8882 para escanear.`);
    } else {
      process.stdout.write(`\r⏳ ${message}`);
    }

    await sleep(QR_POLL_MS);

    const current = await omni.instances.status(instanceId);
    if (current.isConnected) {
      console.log(`\n✅ WhatsApp conectado${current.profileName ? ` (${current.profileName})` : ''}!`);
      return instanceId;
    }
  }

  throw new Error('Timeout: QR code não foi escaneado em 2 minutos.');
}

async function createInstance(omni: ReturnType<typeof createOmniClient>): Promise<string> {
  const instance = await omni.instances.create({
    name: INSTANCE_NAME,
    channel: 'whatsapp-baileys',
  });
  console.log(`✅ Instância criada: ${instance.id}`);
  console.log(`\n💡 Adicione ao .env:\n   OMNI_INSTANCE_ID=${instance.id}\n`);
  return instance.id;
}
