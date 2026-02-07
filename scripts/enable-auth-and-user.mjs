import fs from "fs";
import path from "path";
import readline from "readline/promises";
import { stdin as input, stdout as output } from "process";
import { GoogleAuth } from "google-auth-library";
import admin from "firebase-admin";

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

const readJsonSafe = (filePath) => {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
};

const enableEmailPasswordSignIn = async (projectId, credentials) => {
  const auth = new GoogleAuth({
    credentials,
    scopes: [
      "https://www.googleapis.com/auth/identitytoolkit",
      "https://www.googleapis.com/auth/cloud-platform",
    ],
  });
  const client = await auth.getClient();
  const url = `https://identitytoolkit.googleapis.com/v2/projects/${projectId}/config?updateMask=signIn.email.enabled,signIn.email.passwordRequired`;
  await client.request({
    url,
    method: "PATCH",
    data: {
      signIn: {
        email: {
          enabled: true,
          passwordRequired: true,
        },
      },
    },
  });
};

const createAuthUser = async (projectId, credentials, email, password) => {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(credentials),
      projectId,
    });
  }

  await admin.auth().createUser({
    email,
    password,
  });
};

const main = async () => {
  const projectId = await ask("Project ID (ornek: rrc-gyutootm): ");
  if (!projectId) {
    throw new Error("Project ID gerekli.");
  }

  const serviceAccountPath = await ask("Service account JSON yolu: ");
  if (!serviceAccountPath) {
    throw new Error("Service account JSON gerekli.");
  }

  const resolvedPath = path.resolve(serviceAccountPath);
  const credentials = readJsonSafe(resolvedPath);
  if (!credentials) {
    throw new Error("Service account JSON okunamadi.");
  }
  if (!credentials.client_email) {
    throw new Error("Service account JSON gecersiz (client_email yok).");
  }

  console.log("Email/Password sign-in etkinlestiriliyor...");
  await enableEmailPasswordSignIn(projectId, credentials);
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

  await createAuthUser(projectId, credentials, userEmail, userPassword);
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
