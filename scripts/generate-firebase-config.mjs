import fs from "fs";
import path from "path";

const inputPath = process.argv[2];

if (!inputPath) {
  console.error("Usage: node scripts/generate-firebase-config.mjs <path-to-json>");
  process.exit(1);
}

let inputData;
try {
  const raw = fs.readFileSync(inputPath, "utf8");
  inputData = JSON.parse(raw);
} catch (error) {
  console.error("Failed to read/parse input JSON:", error.message);
  process.exit(1);
}

const keyMap = {
  apiKey: "VITE_FIREBASE_API_KEY",
  authDomain: "VITE_FIREBASE_AUTH_DOMAIN",
  projectId: "VITE_FIREBASE_PROJECT_ID",
  storageBucket: "VITE_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "VITE_FIREBASE_MESSAGING_SENDER_ID",
  appId: "VITE_FIREBASE_APP_ID",
};

const missingKeys = Object.values(keyMap).filter((key) => !inputData[key]);
if (missingKeys.length > 0) {
  console.error("Missing required keys in input JSON:");
  missingKeys.forEach((key) => console.error(`- ${key}`));
  process.exit(1);
}

const firebaseConfig = Object.fromEntries(
  Object.entries(keyMap).map(([targetKey, sourceKey]) => [targetKey, inputData[sourceKey]])
);

const outputDir = path.resolve("scripts", "generated");
fs.mkdirSync(outputDir, { recursive: true });

const outputPath = path.join(
  outputDir,
  `firebaseConfig-${firebaseConfig.projectId}.json`
);

fs.writeFileSync(outputPath, JSON.stringify(firebaseConfig, null, 2) + "\n", "utf8");
console.log(`Generated ${outputPath}`);
