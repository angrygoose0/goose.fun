const { Worker, isMainThread, parentPort } = require("worker_threads");
const { PublicKey } = require("@solana/web3.js");
const crypto = require("crypto");
const fs = require("fs");

// Configuration
const MINT_SUFFIX = "goos"; // Change to your desired suffix
const programId = new PublicKey("goosN8rYWnXxiPH9JqvRdu8eKYn2z2Y2B1P6GHaZsvk");
const JSON_FILE = "found_mints.json";
const NUM_WORKERS = require("os").cpus().length; // Use all CPU cores

if (isMainThread) {
  console.log(`🚀 Spawning ${NUM_WORKERS} workers...`);
  let workers = [];
  let found = false;

  for (let i = 0; i < NUM_WORKERS; i++) {
    const worker = new Worker(__filename);
    workers.push(worker);

    worker.on("message", (mintData) => {
      if (!found) {
        found = true;
        console.log(`✅ Found: ${mintData.mint} (Attempts: ${mintData.attempts})`);
        saveFoundMint(mintData);

        // Terminate all workers
        workers.forEach((w) => w.terminate());
        console.log("🛑 Stopping all workers...");
      }
    });

    worker.on("error", (err) => console.error(`Worker error:`, err));
  }
} else {
  findMatchingMint();
}

function findMatchingMint() {
  let attempts = 0;

  while (true) {
    const randomSeed = crypto.randomBytes(16).toString("hex");
    const mintSeeds = [Buffer.from("mint"), Buffer.from(randomSeed)];

    try {
      const mint = PublicKey.findProgramAddressSync(mintSeeds, programId)[0];
      const mintBase58 = mint.toBase58();
      attempts++;

      if (mintBase58.endsWith(MINT_SUFFIX)) {
        parentPort.postMessage({ mint: mintBase58, seed: randomSeed, attempts, timestamp: new Date().toISOString() });
        return; // Stop worker after finding one
      }
    } catch (error) {
      console.error("Error generating mint:", error);
    }
  }
}

// Function to save found mint
function saveFoundMint(mintData) {
  let foundMints = [];

  if (fs.existsSync(JSON_FILE)) {
    try {
      foundMints = JSON.parse(fs.readFileSync(JSON_FILE));
    } catch (error) {
      console.error("Error reading JSON file:", error);
    }
  }

  foundMints.push(mintData);
  fs.writeFileSync(JSON_FILE, JSON.stringify(foundMints, null, 2));
}