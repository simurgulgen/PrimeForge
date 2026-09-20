import { publishAllVariantsForPackage, publishJobToPrimeStore } from './lib/store-publish';

async function main() {
  console.log('--- Publishing all variants for SmartTube ---');
  // First publish stable jobs, then beta jobs
  const jobIds = [
    '6db7dcb6-2048-454a-ab69-e7739f61e912', // Universal Stable
    '54a61a12-d708-410e-9971-4a3cad03e882', // Arm64 Stable
    '68847af5-736a-45d9-9e9d-13d17f759d50', // Armeabi Stable
    '797bbad8-8023-4461-bc02-9fa525983af0', // X86 Stable
    'be39a5ae-9291-4ce0-8a87-3a8fc77ac6f7', // Arm64 Beta
    'dae86545-2d6f-4143-9056-d868a4d85fa1', // Armeabi Beta
  ];

  for (const jid of jobIds) {
    console.log(`Publishing job ${jid}...`);
    const res = await publishJobToPrimeStore(jid);
    console.log(`Result for ${jid}:`, res.success, res.message || res.error);
  }
}

main().catch(console.error);
