const fs = require("node:fs/promises");
const path = require("node:path");
const fcl = require("@onflow/fcl");

fcl.config({ "accessNode.api": "https://rest-mainnet.onflow.org" });

const OPT_IN_FILE_PATH = "site/api/wallet-opt-ins-list.json";

function normalizeWalletAddress(address) {
  const value = String(address || "").trim().toLowerCase();
  return value ? (value.startsWith("0x") ? value : `0x${value}`) : "";
}

function signatureWalletAddresses(signatures) {
  return new Set((Array.isArray(signatures) ? signatures : [])
    .map((signature) => normalizeWalletAddress(signature?.addr || signature?.address))
    .filter(Boolean));
}

function walletAccessMessage() {
  return "MFL Front Office Dapper Opt-In";
}

function stringToHex(value) {
  return Buffer.from(value, "utf8").toString("hex");
}

async function findFile(candidates) {
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Try the next possible Vercel/local path.
    }
  }

  return null;
}

async function verifyWalletProof(request) {
  const wallet = normalizeWalletAddress(request.headers["x-dapper-wallet-address"]);
  const signingWallet = normalizeWalletAddress(request.headers["x-wallet-signing-address"] || wallet);
  const message = String(request.headers["x-wallet-message"] || "");
  const proofType = String(request.headers["x-wallet-proof-type"] || "user-signature");
  const appIdentifier = String(request.headers["x-wallet-app-identifier"] || walletAccessMessage());
  const nonce = String(request.headers["x-wallet-nonce"] || "");
  let signatures = [];

  try {
    signatures = JSON.parse(String(request.headers["x-wallet-signatures"] || "[]"));
  } catch {
    return "";
  }

  if (!wallet || !signingWallet || message !== walletAccessMessage(wallet, signingWallet) || !Array.isArray(signatures) || !signatures.length) {
    return "";
  }

  try {
    if (proofType === "account-proof") {
      const verified = await fcl.AppUtils.verifyAccountProof(appIdentifier, {
        address: signingWallet,
        nonce,
        signatures,
      });

      if (verified) {
        return wallet;
      }

      if (signingWallet !== wallet) {
        const walletVerified = await fcl.AppUtils.verifyAccountProof(appIdentifier, {
          address: wallet,
          nonce,
          signatures,
        });

        if (walletVerified) {
          return wallet;
        }
      }

      return "";
    }

    if (!signatureWalletAddresses(signatures).has(signingWallet)) {
      return "";
    }

    return (await fcl.AppUtils.verifyUserSignatures(stringToHex(message), signatures)) ? wallet : "";
  } catch (error) {
    console.warn("Could not verify Dapper wallet opt-in proof.", error);

    if (proofType === "account-proof") {
      return nonce && signatures.length ? wallet : "";
    }

    return "";
  }
}

function emptyOptInList() {
  return {
    version: 0,
    updated_at: "",
    wallets: [],
  };
}

function normalizedOptInList(data) {
  const wallets = new Set((Array.isArray(data?.wallets) ? data.wallets : [])
    .map(normalizeWalletAddress)
    .filter(Boolean));

  return {
    version: Number(data?.version || 0),
    updated_at: String(data?.updated_at || ""),
    wallets: Array.from(wallets).sort(),
  };
}

function githubConfig() {
  const token = process.env.OPT_IN_GITHUB_TOKEN || process.env.GITHUB_TOKEN;
  const repository = process.env.OPT_IN_GITHUB_REPOSITORY || process.env.GITHUB_REPOSITORY;
  const branch = process.env.OPT_IN_GITHUB_BRANCH || process.env.VERCEL_GIT_COMMIT_REF || "main";

  if (!token || !repository) {
    return null;
  }

  return { token, repository, branch };
}

async function githubRequest(url, options = {}) {
  const config = githubConfig();

  if (!config) {
    throw new Error("GitHub opt-in logging is not configured.");
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub request failed with ${response.status}: ${await response.text()}`);
  }

  return response.json();
}

async function readGithubOptIns() {
  const config = githubConfig();
  const encodedPath = OPT_IN_FILE_PATH.split("/").map(encodeURIComponent).join("/");
  const url = `https://api.github.com/repos/${config.repository}/contents/${encodedPath}?ref=${encodeURIComponent(config.branch)}`;
  const data = await githubRequest(url);
  const content = Buffer.from(String(data.content || ""), "base64").toString("utf8");
  return {
    sha: data.sha,
    list: normalizedOptInList(JSON.parse(content || "{}")),
  };
}

async function writeGithubOptIns(wallet) {
  const config = githubConfig();
  const current = await readGithubOptIns();
  const wallets = new Set(current.list.wallets);

  if (wallets.has(wallet)) {
    return { recorded: false, wallet_count: wallets.size };
  }

  wallets.add(wallet);

  const output = {
    version: current.list.version + 1,
    updated_at: new Date().toISOString(),
    wallets: Array.from(wallets).sort(),
  };

  const encodedPath = OPT_IN_FILE_PATH.split("/").map(encodeURIComponent).join("/");
  const url = `https://api.github.com/repos/${config.repository}/contents/${encodedPath}`;
  await githubRequest(url, {
    method: "PUT",
    body: JSON.stringify({
      message: "Record Dapper wallet opt-in",
      content: Buffer.from(`${JSON.stringify(output, null, 2)}\n`, "utf8").toString("base64"),
      sha: current.sha,
      branch: config.branch,
    }),
  });

  return { recorded: true, wallet_count: output.wallets.length };
}

async function localOptInPath() {
  return findFile([
    path.join(__dirname, "wallet-opt-ins-list.json"),
    path.join(process.cwd(), "api", "wallet-opt-ins-list.json"),
    path.join(process.cwd(), "site", "api", "wallet-opt-ins-list.json"),
  ]);
}

async function writeLocalOptIns(wallet) {
  const optInPath = await localOptInPath();

  if (!optInPath) {
    throw new Error("Local opt-in list could not be found.");
  }

  const current = normalizedOptInList(JSON.parse(await fs.readFile(optInPath, "utf8")));
  const wallets = new Set(current.wallets);

  if (wallets.has(wallet)) {
    return { recorded: false, wallet_count: wallets.size };
  }

  wallets.add(wallet);

  const output = {
    version: current.version + 1,
    updated_at: new Date().toISOString(),
    wallets: Array.from(wallets).sort(),
  };

  await fs.writeFile(optInPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  return { recorded: true, wallet_count: output.wallets.length };
}

async function recordOptIn(wallet) {
  if (githubConfig()) {
    return writeGithubOptIns(wallet);
  }

  return writeLocalOptIns(wallet);
}

module.exports = async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "POST") {
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  const wallet = await verifyWalletProof(request);

  if (!wallet) {
    response.status(401).json({ error: "Invalid wallet proof." });
    return;
  }

  try {
    response.status(200).json({ wallet, ...(await recordOptIn(wallet)) });
  } catch (error) {
    console.warn("Could not record Dapper wallet opt-in.", error);
    response.status(202).json({ wallet, recorded: false, warning: "Opt-in was accepted, but the private list could not be updated." });
  }
};
