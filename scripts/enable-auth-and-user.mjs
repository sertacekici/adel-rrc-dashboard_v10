import fs from "fs";
import readline from "readline/promises";
import { stdin as input, stdout as output } from "process";
import { execSync } from "child_process";

const ENV_FILE_NAME = ".env";

const rl = readline.createInterface({ input, output });

const ask = async (question) => {
  const answer = await rl.question(question);
  return answer.trim();
};

const askHidden = async (question) => {
  return new Promise((resolve) => {
    output.write(question);
    input.setRawMode(true);
    input.resume();
    input.setEncoding("utf8");

    let value = "";
    const onData = (char) => {
      const code = char.charCodeAt(0);
      if (code === 13 || code === 10) {
        output.write("\n");
        input.setRawMode(false);
        input.pause();
        input.removeListener("data", onData);
        resolve(value.trim());
        return;
      }

      if (code === 3) {
        process.exit(1);
      }

      if (code === 127 || code === 8) {
        if (value.length > 0) {
          value = value.slice(0, -1);
          output.write("\b \b");
        }
        return;
      }

      value += char;
      output.write("*");
    };

    input.on("data", onData);
  });
};

const readProjectIdFromEnv = () => {
  const envPath = ENV_FILE_NAME;
  if (!fs.existsSync(envPath)) return "";

  const envContent = fs.readFileSync(envPath, "utf8");
  const line = envContent
    .split(/\r?\n/)
    .find((row) => row.trim().startsWith("VITE_FIREBASE_PROJECT_ID="));

  if (!line) return "";

  const value = line.split("=").slice(1).join("=").trim();
  return value.replace(/^['"]|['"]$/g, "");
};

const resolveProjectId = async () => {
  const projectIdFromArg = process.argv[2]?.trim();
  if (projectIdFromArg) return projectIdFromArg;

  const projectIdFromEnv = readProjectIdFromEnv();
  if (projectIdFromEnv) {
    console.log(`Project ID .env dosyasindan alindi: ${projectIdFromEnv}`);
    return projectIdFromEnv;
  }

  const projectIdFromPrompt = await ask("Project ID (ornek: rrc-gyutootm): ");
  return projectIdFromPrompt;
};

const getAccessToken = () => {
  try {
    return execSync("gcloud auth print-access-token", { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
};

const fetchJson = async (url, options = {}) => {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = body?.error?.message || JSON.stringify(body) || response.statusText;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return body;
};

const assertProjectExists = async (projectId, token) => {
  const url = `https://cloudresourcemanager.googleapis.com/v1/projects/${projectId}`;

  try {
    await fetchJson(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "x-goog-user-project": projectId,
      },
    });
  } catch (error) {
    const status = error?.status;
    if (status === 404) {
      throw new Error(
        `PROJECT_NOT_FOUND: ${projectId} bulunamadi. Once projeyi olusturun (npm run create:firebase:auto) veya dogru Project ID kullanin.`
      );
    }

    if (status === 403) {
      throw new Error(
        `Erisim reddedildi (403). Service account anahtari bu proje icin yetkili olmayabilir: ${projectId}`
      );
    }

    throw error;
  }
};

const enableEmailPasswordSignIn = async (projectId, token) => {
  const url = `https://identitytoolkit.googleapis.com/v2/projects/${projectId}/config?updateMask=signIn.email.enabled,signIn.email.passwordRequired`;

  await fetchJson(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "x-goog-user-project": projectId,
    },
    body: JSON.stringify({
      signIn: {
        email: {
          enabled: true,
          passwordRequired: true,
        },
      },
    }),
  });
};

const createAuthUser = async (projectId, token, email, password) => {
  const url = `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts`;

  await fetchJson(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "x-goog-user-project": projectId,
    },
    body: JSON.stringify({
      email,
      password,
      emailVerified: false,
      disabled: false,
    }),
  });
};

const main = async () => {
  const projectId = await resolveProjectId();
  if (!projectId) {
    throw new Error("Project ID gerekli.");
  }

  const accessToken = getAccessToken();
  if (!accessToken) {
    throw new Error("gcloud access token alinamadi. Once 'gcloud auth login' komutunu calistirin.");
  }

  await assertProjectExists(projectId, accessToken);

  console.log("Email/Password sign-in etkinlestiriliyor...");
  try {
    await enableEmailPasswordSignIn(projectId, accessToken);
  } catch (error) {
    const status = error?.status;
    const message = error?.message;

    if (String(message).toLowerCase().includes("quota project")) {
      throw new Error(
        `Quota project hatasi. Sirasiyla su komutlari calistirin:\n1) gcloud auth application-default login\n2) gcloud auth application-default set-quota-project ${projectId}`
      );
    }

    if (status === 404 || String(message).includes("PROJECT_NOT_FOUND")) {
      throw new Error(
        `PROJECT_NOT_FOUND: ${projectId} bulunamadi. Once projeyi olusturun (npm run create:firebase:auto) veya dogru Project ID kullanin.`
      );
    }

    throw error;
  }
  console.log("Email/Password sign-in etkinlestirildi.");

  const userEmail = await ask("Olusturulacak kullanici e-postasi (bos birak: gec): ");
  if (!userEmail) {
    console.log("Kullanici olusturma atlandi.");
    return;
  }

  const userPassword = await askHidden("Sifre: ");
  if (!userPassword) {
    console.log("Sifre bos oldugu icin kullanici olusturma atlandi.");
    return;
  }

  await createAuthUser(projectId, accessToken, userEmail, userPassword);
  console.log("Kullanici olusturuldu.");
};

main()
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  })
  .finally(() => {
    rl.close();
  });
