// Quick test for Google Cloud Speech-to-Text API
// Run with: npx ts-node scripts/test-google-stt.ts

const GOOGLE_API_KEY = process.env.GOOGLE_CLOUD_STT_API_KEY;

if (!GOOGLE_API_KEY) {
  console.error('ERROR: Set GOOGLE_CLOUD_STT_API_KEY environment variable');
  console.log('Usage: GOOGLE_CLOUD_STT_API_KEY=your_key npx ts-node scripts/test-google-stt.ts');
  process.exit(1);
}

async function testGoogleSTT() {
  console.log('Testing Google Cloud Speech-to-Text API...\n');

  // Use Google's sample audio (short "how old is the Brooklyn Bridge" clip)
  const testAudioUrl = 'https://storage.googleapis.com/cloud-samples-data/speech/brooklyn_bridge.flac';

  try {
    // Test 1: Simple synchronous recognition with Google's sample
    console.log('Test 1: Synchronous recognition with sample audio');
    const response = await fetch(
      `https://speech.googleapis.com/v1/speech:recognize?key=${GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: {
            encoding: 'FLAC',
            sampleRateHertz: 16000,
            languageCode: 'en-US',
          },
          audio: {
            uri: 'gs://cloud-samples-data/speech/brooklyn_bridge.flac',
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error(`FAILED: ${response.status}`);
      console.error(error);
      return false;
    }

    const result = await response.json();
    const transcript = result.results?.[0]?.alternatives?.[0]?.transcript;

    console.log(`Status: ${response.status} OK`);
    console.log(`Transcript: "${transcript}"`);
    console.log('\n✅ Google STT API is working!\n');
    return true;

  } catch (error) {
    console.error('ERROR:', error);
    return false;
  }
}

testGoogleSTT();
