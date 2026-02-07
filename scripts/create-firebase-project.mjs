import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import readline from "readline/promises";
import { stdin as input, stdout as output } from "process";

// ── Defaults ────────────────────────────────────────────────
const DEFAULT_ADMIN_EMAIL = "sertacekici@gmail.com";
const DEFAULT_ADMIN_PASSWORD = "Sertac1987";
const REGION = "europe-west1";
const STORAGE_LOCATION = "US-CENTRAL1";

// ── Helpers ─────────────────────────────────────────────────
const rl = readline.createInterface({ input, output });

const ask = async (question) => {
  const answer = await rl.question(question);
  return answer.trim();
};

const log = (msg) => console.log(`\n>>> ${msg}`);
const logOk = (msg) => console.log(`  ✔ ${msg}`);
const logErr = (msg) => console.error(`  ✖ ${msg}`);

const slugify = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const run = (command, { capture = false, silent = false } = {}) => {
  if (capture) {
    return execSync(command, { encoding: "utf8" }).trim();
  }
  execSync(command, { stdio: silent ? "pipe" : "inherit" });
  return "";
};

const tryRun = (command, opts) => {
  try {
    return run(command, opts);
  } catch {
    return null;
  }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const readJsonSafe = (filePath) => {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
};

const writeJson = (filePath, value) => {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
};

// ── gcloud helpers ──────────────────────────────────────────
const getAccessToken = () => {
  try {
    return run("gcloud auth print-access-token", { capture: true });
  } catch {
    return null;
  }
};

const fetchJson = async (url, options = {}) => {
  const res = await fetch(url, options);
  const body = await res.json();
  if (!res.ok) {
    const msg = body?.error?.message || JSON.stringify(body);
    throw new Error(`API error (${res.status}): ${msg}`);
  }
  return body;
};

// ── Project number ──────────────────────────────────────────
const getProjectNumber = (projectId) => {
  try {
    const raw = run(
      `gcloud projects describe ${projectId} --format="value(projectNumber)"`,
      { capture: true }
    );
    return raw || "";
  } catch {
    // fallback: firebase projects:list
    try {
      const raw = run("firebase projects:list --json", { capture: true });
      const parsed = JSON.parse(raw);
      const projects = parsed.result?.projects || parsed.projects || [];
      const match = projects.find((p) => p.projectId === projectId);
      return match?.projectNumber || "";
    } catch {
      return "";
    }
  }
};

// ── Auth: enable Email/Password via REST ────────────────────
const enableEmailPassword = async (projectId, token) => {
  // Enable Identity Toolkit API first
  tryRun(
    `gcloud services enable identitytoolkit.googleapis.com --project=${projectId}`,
    { silent: true }
  );

  const url =
    `https://identitytoolkit.googleapis.com/v2/projects/${projectId}/config` +
    `?updateMask=signIn.email.enabled,signIn.email.passwordRequired`;

  await fetchJson(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      signIn: { email: { enabled: true, passwordRequired: true } },
    }),
  });
};

// ── Auth: create user via REST (with retry) ─────────────────
const createUser = async (projectId, token, email, password, retries = 3) => {
  const url = `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts`;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password, emailVerified: false, disabled: false }),
      });
      const body = await res.json();
      // accounts endpoint returns { kind, localId } on success
      if (body.localId || body.kind) return body;
      // If error but retryable, wait and try again
      const errMsg = body?.error?.message || JSON.stringify(body);
      if (attempt < retries) {
        logErr(`Deneme ${attempt}/${retries} basarisiz: ${errMsg}. ${5 * attempt}s bekleniyor...`);
        await sleep(5000 * attempt);
      } else {
        throw new Error(errMsg);
      }
    } catch (error) {
      if (attempt < retries && !error.message?.includes("API error")) {
        logErr(`Deneme ${attempt}/${retries} hata: ${error.message}. ${5 * attempt}s bekleniyor...`);
        await sleep(5000 * attempt);
      } else {
        throw error;
      }
    }
  }
};

// ── Storage: create default bucket via gcloud ───────────────
const createStorageBucket = async (projectId, token) => {
  // Enable required APIs
  tryRun(`gcloud services enable storage.googleapis.com --project=${projectId}`, { silent: true });
  tryRun(`gcloud services enable firebasestorage.googleapis.com --project=${projectId}`, { silent: true });

  const bucketName = `${projectId}.firebasestorage.app`;

  // Create bucket via gcloud
  try {
    run(
      `gcloud storage buckets create gs://${bucketName} --location=${STORAGE_LOCATION} --project=${projectId} --default-storage-class=STANDARD --uniform-bucket-level-access`,
      { silent: true }
    );
    logOk(`Storage bucket olusturuldu: gs://${bucketName} (${STORAGE_LOCATION})`);
  } catch (e) {
    // Bucket might already exist
    if (e.message?.includes("409") || e.message?.includes("already exists")) {
      logOk(`Storage bucket zaten mevcut: gs://${bucketName}`);
    } else {
      throw e;
    }
  }

  // Link bucket to Firebase via REST API
  try {
    const addUrl = `https://firebasestorage.googleapis.com/v1beta/projects/${projectId}/buckets/${bucketName}:addFirebase`;
    await fetchJson(addUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    logOk("Bucket Firebase'e baglandi.");
  } catch (e) {
    // May already be linked
    if (!e.message?.includes("already")) {
      logErr(`Firebase baglantisi: ${e.message} (manuel kontrol edin)`);
    }
  }
};

// ── Main ────────────────────────────────────────────────────
const main = async () => {
  const argName = process.argv.slice(2).join(" ").trim();
  const projectName = argName || (await ask("Proje adi: "));

  if (!projectName) throw new Error("Gecersiz proje adi.");

  const alias = slugify(projectName);
  if (!alias) throw new Error("Gecersiz proje adi.");

  const projectId = `rrc-${alias}`;

  console.log("╔════════════════════════════════════════════╗");
  console.log(`║  Proje: ${projectName}`);
  console.log(`║  ID:    ${projectId}`);
  console.log(`║  Alias: ${alias}`);
  console.log("╚════════════════════════════════════════════╝");

  // ── 1. Create Firebase project ────────────────────────────
  log("Firebase projesi olusturuluyor...");
  run(`firebase projects:create ${projectId} --display-name "${projectName}"`);
  logOk("Proje olusturuldu.");

  // ── 2. PAUSE: Billing (tek zorunlu manuel adim) ───────────
  console.log("\n╔═══════════════════════════════════════════════════════════╗");
  console.log("║  Firebase Console'da su adimi tamamla:                    ║");
  console.log("║  Billing > Blaze (Pay as you go) plan sec                 ║");
  console.log("║  (Storage otomatik olusturulacak - US-CENTRAL1)           ║");
  console.log("║  Sonra Enter'a bas.                                       ║");
  console.log("╚═══════════════════════════════════════════════════════════╝");
  await ask("Hazir olunca Enter: ");

  // ── 3. .firebaserc alias kaydi ────────────────────────────
  log(".firebaserc guncelleniyor...");
  const repoRoot = path.resolve(".");
  const rcPath = path.join(repoRoot, ".firebaserc");
  const rc = readJsonSafe(rcPath) || {};
  if (!rc.projects) rc.projects = {};
  rc.projects[alias] = projectId;
  if (!rc.projects.default) rc.projects.default = projectId;
  writeJson(rcPath, rc);
  logOk(".firebaserc guncellendi.");

  // ── 4. Web app olustur + SDK config al ────────────────────
  log("Web app olusturuluyor...");
  const appCreateRaw = run(
    `firebase apps:create web "${projectName}" --project ${projectId} --json`,
    { capture: true }
  );
  const appCreate = JSON.parse(appCreateRaw);
  const appId = appCreate.result?.appId || appCreate.appId;
  if (!appId) throw new Error("Web app ID bulunamadi.");
  logOk(`Web app olusturuldu (${appId}).`);

  log("SDK config aliniyor...");
  const sdkRaw = run(
    `firebase apps:sdkconfig web ${appId} --project ${projectId} --json`,
    { capture: true }
  );
  const sdkParsed = JSON.parse(sdkRaw);
  const sdkConfig = sdkParsed.result?.sdkConfig || sdkParsed.sdkConfig;
  if (!sdkConfig) throw new Error("SDK config bulunamadi.");
  logOk("SDK config alindi.");

  // ── 5. Project number ─────────────────────────────────────
  log("Project number aliniyor...");
  let projectNumber = getProjectNumber(projectId);
  if (!projectNumber) {
    projectNumber = await ask("Project number bulunamadi. Manuel gir: ");
  }
  if (!projectNumber) throw new Error("Project number gerekli.");
  logOk(`Project number: ${projectNumber}`);

  // ── 6. API URL hesapla ────────────────────────────────────
  const serviceName = `${projectId}_rrcapi`;
  const apiUrl = `https://${serviceName}-${projectNumber}.${REGION}.run.app`;
  logOk(`API URL: ${apiUrl}`);

  // ── 7. Config dosyalarini olustur ─────────────────────────
  log("Config dosyalari olusturuluyor...");
  const genDir = path.join(repoRoot, "scripts", "generated");
  fs.mkdirSync(genDir, { recursive: true });

  const configPath = path.join(genDir, `firebaseConfig-${alias}.json`);
  writeJson(configPath, sdkConfig);
  logOk(`JSON: ${configPath}`);

  const envPath = path.join(genDir, `.env.${alias}`);
  const envLines = [
    `VITE_FIREBASE_API_KEY=${sdkConfig.apiKey}`,
    `VITE_FIREBASE_AUTH_DOMAIN=${sdkConfig.authDomain}`,
    `VITE_FIREBASE_PROJECT_ID=${sdkConfig.projectId}`,
    `VITE_FIREBASE_STORAGE_BUCKET=${sdkConfig.storageBucket}`,
    `VITE_FIREBASE_MESSAGING_SENDER_ID=${sdkConfig.messagingSenderId}`,
    `VITE_FIREBASE_APP_ID=${sdkConfig.appId}`,
    `VITE_API_URL=${apiUrl}`,
    "SECRETS_SCAN_ENABLED=false",
    "",
  ];
  fs.writeFileSync(envPath, envLines.join("\n"), "utf8");
  logOk(`ENV: ${envPath}`);

  // ── 7b. Root .env dosyasini olustur (Vite icin) ──────────
  const rootEnvPath = path.join(repoRoot, ".env");
  fs.copyFileSync(envPath, rootEnvPath);
  logOk(`Root .env kopyalandi: ${rootEnvPath}`);

  // ── 8a. Storage bucket olustur (US-CENTRAL1) ─────────────
  log("Storage bucket olusturuluyor (US-CENTRAL1)...");
  const storageToken = getAccessToken();
  if (storageToken) {
    try {
      await createStorageBucket(projectId, storageToken);
    } catch (e) {
      logErr(`Storage bucket olusturulamadi: ${e.message}`);
      logErr("Console > Storage > 'Get Started' ile manuel olusturun.");
    }
  } else {
    logErr("gcloud token alinamadi. Storage bucket manuel olusturun.");
  }

  // ── 8b. Deploy: indexes + rules + storage + functions ─────
  log("Firestore indexes + rules deploy ediliyor...");
  run(`firebase deploy --only firestore:indexes,firestore:rules --project ${projectId}`);
  logOk("Firestore indexes + rules deploy edildi.");

  log("Storage rules deploy ediliyor...");
  try {
    run(`firebase deploy --only storage --project ${projectId}`);
    logOk("Storage rules deploy edildi.");
  } catch {
    logErr("Storage rules deploy basarisiz. Devam ediliyor...");
  }

  log("Functions deploy ediliyor...");
  try {
    run(`firebase deploy --only functions --project ${projectId}`);
    logOk("Functions deploy edildi.");
  } catch {
    logErr("Functions deploy basarisiz (billing veya functions kaynaklı olabilir). Devam ediliyor...");
  }

  // ── 9. Auth: Email/Password + admin kullanici ─────────────
  log("Email/Password auth etkinlestiriliyor...");
  const authToken = getAccessToken();
  if (!authToken) {
    logErr("gcloud token alinamadi. 'gcloud auth login' yapip tekrar deneyin.");
    logErr("Auth adimi atlandi.");
  } else {
    try {
      await enableEmailPassword(projectId, authToken);
      logOk("Email/Password sign-in etkinlestirildi.");

      // API propagation icin bekle
      log("Auth API aktif olması bekleniyor (10s)...");
      await sleep(10000);

      log(`Admin kullanici olusturuluyor (${DEFAULT_ADMIN_EMAIL})...`);
      await createUser(projectId, authToken, DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD);
      logOk("Admin kullanici olusturuldu.");
    } catch (error) {
      logErr(`Auth hatasi: ${error.message}`);
      logErr("Auth adimini manuel tamamlamaniz gerekebilir.");
    }
  }

  // ── Done ──────────────────────────────────────────────────
  console.log("\n╔════════════════════════════════════════════╗");
  console.log("║            SETUP TAMAMLANDI               ║");
  console.log("╠════════════════════════════════════════════╣");
  console.log(`║  Project ID : ${projectId}`);
  console.log(`║  API URL    : ${apiUrl}`);
  console.log(`║  Admin      : ${DEFAULT_ADMIN_EMAIL}`);
  console.log(`║  JSON Config: firebaseConfig-${alias}.json`);
  console.log(`║  ENV File   : .env.${alias}`);
  console.log("╚════════════════════════════════════════════╝");
};

main()
  .catch((error) => {
    console.error(`\nHATA: ${error.message}`);
    process.exit(1);
  })
  .finally(() => {
    rl.close();
  });
