import "dotenv/config";
import cors from "cors";
import express from "express";
import multer from "multer";
import OpenAI from "openai";
import crypto from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const app = express();
const port = Number(process.env.PORT || 8787);

const EBAY_ENV =
  String(process.env.EBAY_ENV || "sandbox").toLowerCase() === "production"
    ? "production"
    : "sandbox";

const EBAY_CLIENT_ID = process.env.EBAY_CLIENT_ID || "";
const EBAY_CLIENT_SECRET = process.env.EBAY_CLIENT_SECRET || "";
const EBAY_RUNAME = process.env.EBAY_RUNAME || "";
const EBAY_MARKETPLACE_ID = process.env.EBAY_MARKETPLACE_ID || "EBAY_DE";
const PUBLIC_BASE_URL = String(process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "");
const EBAY_NOTIFICATION_VERIFICATION_TOKEN =
  process.env.EBAY_NOTIFICATION_VERIFICATION_TOKEN || "";
const EBAY_NOTIFICATION_ENDPOINT = PUBLIC_BASE_URL
  ? `${PUBLIC_BASE_URL}/webhooks/ebay/messages`
  : "";
const PUSH_TOKEN_STORE_PATH =
  process.env.PUSH_TOKEN_STORE_PATH ||
  path.resolve(process.cwd(), "data/push-tokens.json");
const PUSH_PAIRING_CODE =
  process.env.PUSH_PAIRING_CODE || "";

const EBAY_AUTH_BASE =
  EBAY_ENV === "production"
    ? "https://auth.ebay.com"
    : "https://auth.sandbox.ebay.com";

const EBAY_API_BASE =
  EBAY_ENV === "production"
    ? "https://api.ebay.com"
    : "https://api.sandbox.ebay.com";

const EBAY_SCOPES = [
  "https://api.ebay.com/oauth/api_scope",
  "https://api.ebay.com/oauth/api_scope/sell.account",
  "https://api.ebay.com/oauth/api_scope/sell.inventory",
  "https://api.ebay.com/oauth/api_scope/commerce.message",
];

const ebayOauthStates = new Map();
let ebayTokenStore = null;

const expoPushTokens = new Map();
const ebayNotificationKeyCache = new Map();
const recentEbayNotificationEvents = [];
let pushStoreLoaded = false;


async function ensurePushStoreLoaded() {
  if (pushStoreLoaded) return;
  pushStoreLoaded = true;

  try {
    const raw = await readFile(PUSH_TOKEN_STORE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      for (const entry of parsed) {
        if (entry?.token && typeof entry.token === "string") {
          expoPushTokens.set(entry.token, {
            token: entry.token,
            platform: String(entry.platform || "unknown"),
            registeredAt: String(
              entry.registeredAt || new Date().toISOString()
            ),
          });
        }
      }
    }
  } catch {
    // First run or ephemeral filesystem: no persisted token file yet.
  }
}

async function persistPushTokens() {
  try {
    await mkdir(path.dirname(PUSH_TOKEN_STORE_PATH), { recursive: true });
    await writeFile(
      PUSH_TOKEN_STORE_PATH,
      JSON.stringify(Array.from(expoPushTokens.values()), null, 2),
      "utf8"
    );
  } catch (error) {
    console.warn("Push token store could not be persisted:", error);
  }
}

function isExpoPushToken(value) {
  return (
    typeof value === "string" &&
    /^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/.test(value)
  );
}

async function sendExpoPush(message) {
  await ensurePushStoreLoaded();
  const tokens = Array.from(expoPushTokens.keys());
  if (!tokens.length) {
    return { sent: 0, receipts: [] };
  }

  const messages = tokens.map((to) => ({
    to,
    sound: "default",
    channelId: "buyer-messages",
    title: message.title,
    body: message.body,
    badge: 1,
    data: message.data || {},
  }));

  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify(messages),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      payload?.errors?.[0]?.message ||
        payload?.error ||
        `Expo Push Fehler ${response.status}`
    );
  }

  const receipts = Array.isArray(payload?.data) ? payload.data : [];
  let changed = false;

  receipts.forEach((receipt, index) => {
    if (
      receipt?.status === "error" &&
      receipt?.details?.error === "DeviceNotRegistered"
    ) {
      const token = tokens[index];
      if (token) {
        expoPushTokens.delete(token);
        changed = true;
      }
    }
  });

  if (changed) {
    await persistPushTokens();
  }

  return {
    sent: messages.length,
    receipts,
  };
}


function requirePushPairing(req, res, next) {
  if (
    !PUSH_PAIRING_CODE ||
    PUSH_PAIRING_CODE.length < 8
  ) {
    return res.status(503).json({
      error:
        "PUSH_PAIRING_CODE ist serverseitig noch nicht konfiguriert.",
    });
  }

  const supplied = String(
    req.headers["x-push-pairing-code"] || ""
  );

  const expected = Buffer.from(PUSH_PAIRING_CODE);
  const actual = Buffer.from(supplied);

  if (
    actual.length !== expected.length ||
    !crypto.timingSafeEqual(actual, expected)
  ) {
    return res.status(401).json({
      error: "Push-Pairing-Code ist ungültig.",
    });
  }

  next();
}

function ebayNotificationConfigReady() {
  return Boolean(
    EBAY_NOTIFICATION_ENDPOINT.startsWith("https://") &&
      /^[A-Za-z0-9_-]{32,80}$/.test(
        EBAY_NOTIFICATION_VERIFICATION_TOKEN
      )
  );
}

function ebayNotificationChallenge(challengeCode) {
  const hash = crypto.createHash("sha256");
  hash.update(String(challengeCode));
  hash.update(EBAY_NOTIFICATION_VERIFICATION_TOKEN);
  hash.update(EBAY_NOTIFICATION_ENDPOINT);
  return hash.digest("hex");
}

function formatEbayPublicKey(key) {
  const normalized = String(key || "").trim();
  if (!normalized) throw new Error("eBay lieferte keinen Public Key.");
  if (normalized.includes("\n")) return normalized;

  return normalized
    .replace(
      "-----BEGIN PUBLIC KEY-----",
      "-----BEGIN PUBLIC KEY-----\n"
    )
    .replace(
      "-----END PUBLIC KEY-----",
      "\n-----END PUBLIC KEY-----"
    );
}

async function ebayNotificationPublicKey(kid) {
  const cached = ebayNotificationKeyCache.get(kid);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.payload;
  }

  const { payload } = await ebayApiJson(
    `/commerce/notification/v1/public_key/${encodeURIComponent(kid)}`
  );

  ebayNotificationKeyCache.set(kid, {
    payload,
    expiresAt: Date.now() + 60 * 60 * 1000,
  });

  return payload;
}

async function validateEbayNotificationSignature(message, signatureHeader) {
  if (!signatureHeader) return false;

  let decoded;
  try {
    decoded = JSON.parse(
      Buffer.from(String(signatureHeader), "base64").toString("ascii")
    );
  } catch {
    return false;
  }

  if (!decoded?.kid || !decoded?.signature) return false;

  const publicKey = await ebayNotificationPublicKey(String(decoded.kid));
  const digest = String(publicKey?.digest || "SHA1")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  const verifier = crypto.createVerify(digest || "sha1");
  verifier.update(JSON.stringify(message));
  verifier.end();

  return verifier.verify(
    formatEbayPublicKey(publicKey?.key),
    String(decoded.signature),
    "base64"
  );
}

function findCollection(payload, key) {
  return Array.isArray(payload?.[key]) ? payload[key] : [];
}

function topicName(topic) {
  return String(
    topic?.topic ||
      topic?.name ||
      topic?.topicName ||
      ""
  ).toUpperCase();
}

function topicId(topic) {
  return String(topic?.topicId || topic?.id || "");
}

function destinationId(destination) {
  return String(destination?.destinationId || destination?.id || "");
}

function subscriptionId(subscription) {
  return String(subscription?.subscriptionId || subscription?.id || "");
}

function idFromLocation(response) {
  const location = response?.headers?.get?.("location") || "";
  if (!location) return "";
  return decodeURIComponent(location.split("/").filter(Boolean).pop() || "");
}

async function ebayNotificationInventory() {
  const [
    topicsResponse,
    destinationsResponse,
    subscriptionsResponse,
  ] = await Promise.all([
    ebayApiJson("/commerce/notification/v1/topic?limit=100"),
    ebayApiJson("/commerce/notification/v1/destination?limit=100"),
    ebayApiJson("/commerce/notification/v1/subscription?limit=100"),
  ]);

  const topics = findCollection(topicsResponse.payload, "topics");
  const destinations = findCollection(
    destinationsResponse.payload,
    "destinations"
  );
  const subscriptions = findCollection(
    subscriptionsResponse.payload,
    "subscriptions"
  );

  const topic =
    topics.find((entry) => topicName(entry) === "NEW_MESSAGE") || null;

  const destination =
    destinations.find(
      (entry) =>
        String(entry?.deliveryConfig?.endpoint || "") ===
        EBAY_NOTIFICATION_ENDPOINT
    ) || null;

  const destinationKey = destinationId(destination);
  const topicKey = topicId(topic);

  const subscription =
    subscriptions.find(
      (entry) =>
        String(entry?.destinationId || "") === destinationKey &&
        String(entry?.topicId || "") === topicKey
    ) || null;

  return {
    topic,
    destination,
    subscription,
  };
}

async function ensureEbayNewMessageSubscription() {
  if (!ebayNotificationConfigReady()) {
    throw new Error(
      "Webhook-Konfiguration fehlt: PUBLIC_BASE_URL muss HTTPS sein und EBAY_NOTIFICATION_VERIFICATION_TOKEN muss 32–80 erlaubte Zeichen haben."
    );
  }

  if (!ebayTokenStore) {
    throw new Error(
      "eBay ist nicht verbunden. Wegen des commerce.message Scopes bitte eBay neu per OAuth verbinden."
    );
  }

  let inventory = await ebayNotificationInventory();
  const topic = inventory.topic;

  if (!topic) {
    throw new Error(
      "eBay liefert das NEW_MESSAGE Notification Topic derzeit nicht für diesen OAuth-Zugang."
    );
  }

  let destination = inventory.destination;
  let destinationKey = destinationId(destination);

  if (!destinationKey) {
    const created = await ebayApiJson(
      "/commerce/notification/v1/destination",
      {
        method: "POST",
        body: JSON.stringify({
          name: "Verkaufsassistent NEW_MESSAGE",
          status: "ENABLED",
          deliveryConfig: {
            endpoint: EBAY_NOTIFICATION_ENDPOINT,
            verificationToken:
              EBAY_NOTIFICATION_VERIFICATION_TOKEN,
          },
        }),
      }
    );

    destinationKey =
      String(created.payload?.destinationId || "") ||
      idFromLocation(created.response);
  }

  if (!destinationKey) {
    inventory = await ebayNotificationInventory();
    destination = inventory.destination;
    destinationKey = destinationId(destination);
  }

  if (!destinationKey) {
    throw new Error(
      "eBay Destination konnte nicht eindeutig ermittelt werden."
    );
  }

  let subscription = inventory.subscription;
  let subscriptionKey = subscriptionId(subscription);

  if (!subscriptionKey) {
    const supportedPayloads = Array.isArray(topic?.supportedPayloads)
      ? topic.supportedPayloads
      : [];
    const payloadDetail =
      supportedPayloads.find(
        (entry) => !entry?.deprecated
      ) || supportedPayloads[0];

    if (!payloadDetail?.schemaVersion) {
      throw new Error(
        "eBay NEW_MESSAGE Topic enthält keine unterstützte Payload-Version."
      );
    }

    const created = await ebayApiJson(
      "/commerce/notification/v1/subscription",
      {
        method: "POST",
        body: JSON.stringify({
          destinationId: destinationKey,
          topicId: topicId(topic),
          status: "ENABLED",
          payload: {
            deliveryProtocol: "HTTPS",
            format: "JSON",
            schemaVersion: String(payloadDetail.schemaVersion),
          },
        }),
      }
    );

    subscriptionKey =
      String(created.payload?.subscriptionId || "") ||
      idFromLocation(created.response);
  }

  if (!subscriptionKey) {
    inventory = await ebayNotificationInventory();
    subscription = inventory.subscription;
    subscriptionKey = subscriptionId(subscription);
  }

  if (!subscriptionKey) {
    throw new Error(
      "eBay NEW_MESSAGE Subscription konnte nicht eindeutig ermittelt werden."
    );
  }

  return {
    destinationId: destinationKey,
    subscriptionId: subscriptionKey,
    topicId: topicId(topic),
  };
}

function rememberEbayNotificationEvent(payload) {
  const event = {
    notificationId: String(
      payload?.notification?.notificationId || ""
    ),
    topic: String(payload?.metadata?.topic || ""),
    receivedAt: new Date().toISOString(),
    conversationId: String(
      payload?.notification?.data?.conversationId || ""
    ),
  };

  recentEbayNotificationEvents.unshift(event);
  if (recentEbayNotificationEvents.length > 25) {
    recentEbayNotificationEvents.length = 25;
  }

  return event;
}

function ebayConfigured() {
  return Boolean(EBAY_CLIENT_ID && EBAY_CLIENT_SECRET && EBAY_RUNAME);
}

function ebayBasicAuth() {
  return Buffer.from(`${EBAY_CLIENT_ID}:${EBAY_CLIENT_SECRET}`).toString("base64");
}


async function ebayTestApplicationKeys() {
  if (!EBAY_CLIENT_ID || !EBAY_CLIENT_SECRET) {
    return { ok: false, detail: "Client ID oder Client Secret fehlt." };
  }

  try {
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      scope: "https://api.ebay.com/oauth/api_scope",
    });

    const response = await fetch(`${EBAY_API_BASE}/identity/v1/oauth2/token`, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        authorization: `Basic ${ebayBasicAuth()}`,
      },
      body,
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        ok: false,
        detail:
          payload?.error_description ||
          payload?.error ||
          `eBay Key-Test fehlgeschlagen (${response.status}).`,
      };
    }

    return {
      ok: Boolean(payload?.access_token),
      detail: payload?.access_token
        ? "Sandbox/Production Application Keys wurden von eBay akzeptiert."
        : "eBay lieferte keinen Application Access Token.",
    };
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : "Key-Test fehlgeschlagen.",
    };
  }
}

async function refreshEbayAccessTokenIfNeeded() {
  if (!ebayTokenStore) return null;

  if (
    ebayTokenStore.accessToken &&
    ebayTokenStore.expiresAt &&
    ebayTokenStore.expiresAt > Date.now() + 60_000
  ) {
    return ebayTokenStore.accessToken;
  }

  if (!ebayTokenStore.refreshToken) return null;

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: ebayTokenStore.refreshToken,
    scope: EBAY_SCOPES.join(" "),
  });

  const response = await fetch(`${EBAY_API_BASE}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      authorization: `Basic ${ebayBasicAuth()}`,
    },
    body,
  });

  const payload = await response.json();

  if (!response.ok) {
    ebayTokenStore = null;
    throw new Error(
      payload?.error_description || "eBay-Token konnte nicht erneuert werden."
    );
  }

  ebayTokenStore = {
    ...ebayTokenStore,
    accessToken: payload.access_token,
    expiresAt: Date.now() + Number(payload.expires_in || 7200) * 1000,
  };

  return ebayTokenStore.accessToken;
}

async function ebayPolicyStatus() {
  const token = await refreshEbayAccessTokenIfNeeded();
  if (!token) {
    return {
      checked: false,
      fulfillmentPolicies: null,
      paymentPolicies: null,
      returnPolicies: null,
    };
  }

  const headers = { authorization: `Bearer ${token}` };
  const endpoints = [
    ["fulfillmentPolicies", "fulfillment_policy", "fulfillmentPolicies"],
    ["paymentPolicies", "payment_policy", "paymentPolicies"],
    ["returnPolicies", "return_policy", "returnPolicies"],
  ];

  const result = {
    checked: true,
    fulfillmentPolicies: null,
    paymentPolicies: null,
    returnPolicies: null,
  };

  await Promise.all(
    endpoints.map(async ([resultKey, resource, responseKey]) => {
      try {
        const response = await fetch(
          `${EBAY_API_BASE}/sell/account/v1/${resource}?marketplace_id=${encodeURIComponent(
            EBAY_MARKETPLACE_ID
          )}`,
          { headers }
        );
        const payload = await response.json();
        if (response.ok && Array.isArray(payload?.[responseKey])) {
          result[resultKey] = payload[responseKey].length;
        }
      } catch {
        result[resultKey] = null;
      }
    })
  );

  return result;
}


const CONDITION_ENUM_BY_ID = {
  "1000": "NEW",
  "1500": "NEW_OTHER",
  "1750": "NEW_WITH_DEFECTS",
  "2000": "CERTIFIED_REFURBISHED",
  "2010": "EXCELLENT_REFURBISHED",
  "2020": "VERY_GOOD_REFURBISHED",
  "2030": "GOOD_REFURBISHED",
  "2500": "SELLER_REFURBISHED",
  "2750": "LIKE_NEW",
  "2990": "PRE_OWNED_EXCELLENT",
  "3000": "USED_EXCELLENT",
  "3010": "PRE_OWNED_FAIR",
  "4000": "USED_VERY_GOOD",
  "5000": "USED_GOOD",
  "6000": "USED_ACCEPTABLE",
  "7000": "FOR_PARTS_OR_NOT_WORKING",
};

function ebayErrorMessage(payload, fallback) {
  const errors = Array.isArray(payload?.errors) ? payload.errors : [];
  const details = errors
    .map((error) => [error?.message, error?.longMessage].filter(Boolean).join(" – "))
    .filter(Boolean);
  return details.length ? details.join(" | ") : fallback;
}

async function ebayApiJson(path, options = {}) {
  const token = await refreshEbayAccessTokenIfNeeded();
  if (!token) throw new Error("eBay-Konto ist nicht verbunden.");

  const response = await fetch(`${EBAY_API_BASE}${path}`, {
    ...options,
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/json",
      ...(options.body && !(options.body instanceof FormData)
        ? { "content-type": "application/json" }
        : {}),
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let payload = null;
  if (text) {
    try { payload = JSON.parse(text); } catch { payload = { raw: text }; }
  }

  if (!response.ok) {
    throw new Error(
      ebayErrorMessage(payload, `eBay API Fehler ${response.status}`)
    );
  }

  return { payload, response };
}

async function ebayGetPolicies() {
  const token = await refreshEbayAccessTokenIfNeeded();
  if (!token) throw new Error("eBay-Konto ist nicht verbunden.");
  const headers = { authorization: `Bearer ${token}`, accept: "application/json" };

  const specs = [
    ["fulfillmentPolicies", "fulfillment_policy", "fulfillmentPolicies", "fulfillmentPolicyId"],
    ["paymentPolicies", "payment_policy", "paymentPolicies", "paymentPolicyId"],
    ["returnPolicies", "return_policy", "returnPolicies", "returnPolicyId"],
  ];

  const result = {
    fulfillmentPolicies: [],
    paymentPolicies: [],
    returnPolicies: [],
  };

  await Promise.all(specs.map(async ([target, resource, arrayKey, idKey]) => {
    const response = await fetch(
      `${EBAY_API_BASE}/sell/account/v1/${resource}?marketplace_id=${encodeURIComponent(EBAY_MARKETPLACE_ID)}`,
      { headers }
    );
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(ebayErrorMessage(payload, `eBay Richtlinienfehler ${response.status}`));
    }
    result[target] = (Array.isArray(payload?.[arrayKey]) ? payload[arrayKey] : [])
      .map((policy) => ({ id: String(policy?.[idKey] || ""), name: String(policy?.name || policy?.[idKey] || "") }))
      .filter((policy) => policy.id);
  }));

  return result;
}

async function ebayGetLocations() {
  const { payload } = await ebayApiJson("/sell/inventory/v1/location?limit=100");
  return (Array.isArray(payload?.locations) ? payload.locations : []).map((entry) => ({
    merchantLocationKey: String(entry?.merchantLocationKey || ""),
    name: entry?.name || "",
    postalCode: entry?.location?.address?.postalCode || "",
    city: entry?.location?.address?.city || "",
    country: entry?.location?.address?.country || "",
  })).filter((entry) => entry.merchantLocationKey);
}

async function ebayGetCategoryTreeId() {
  const { payload } = await ebayApiJson(
    `/commerce/taxonomy/v1/get_default_category_tree_id?marketplace_id=${encodeURIComponent(EBAY_MARKETPLACE_ID)}`
  );
  const id = String(payload?.categoryTreeId || "");
  if (!id) throw new Error("eBay-Kategoriebaum konnte nicht ermittelt werden.");
  return id;
}

async function ebayGetCategorySuggestions(query, treeId) {
  const { payload } = await ebayApiJson(
    `/commerce/taxonomy/v1_beta/category_tree/${encodeURIComponent(treeId)}/get_category_suggestions?q=${encodeURIComponent(query)}`
  );
  return (Array.isArray(payload?.categorySuggestions) ? payload.categorySuggestions : [])
    .slice(0, 5)
    .map((entry) => {
      const ancestors = Array.isArray(entry?.categoryTreeNodeAncestors)
        ? entry.categoryTreeNodeAncestors.map((node) => node?.categoryName).filter(Boolean)
        : [];
      const name = String(entry?.category?.categoryName || "");
      return {
        categoryId: String(entry?.category?.categoryId || ""),
        categoryName: name,
        breadcrumb: [...ancestors, name].filter(Boolean).join(" › "),
      };
    })
    .filter((entry) => entry.categoryId);
}

function prefillAspect(name, draft) {
  const normalized = String(name || "").toLowerCase();
  const brand = String(draft?.brand || "").trim();
  const model = String(draft?.model || "").trim();
  const category = String(draft?.category || "").trim();

  if (["marke", "brand"].includes(normalized) && brand && !brand.toLowerCase().includes("nicht sicher")) return brand;
  if (["modell", "model", "modellnummer"].includes(normalized) && model && !model.toLowerCase().includes("nicht sicher")) return model;
  if (["produktart", "type", "produktgruppe"].includes(normalized) && category) return category;
  return "";
}

async function ebayGetCategoryAspects(categoryId, treeId, draft) {
  const { payload } = await ebayApiJson(
    `/commerce/taxonomy/v1_beta/category_tree/${encodeURIComponent(treeId)}/get_item_aspects_for_category?category_id=${encodeURIComponent(categoryId)}`
  );
  return (Array.isArray(payload?.aspects) ? payload.aspects : []).map((aspect) => ({
    name: String(aspect?.localizedAspectName || aspect?.aspectLocalizedName || ""),
    required: Boolean(aspect?.aspectConstraint?.aspectRequired),
    mode: String(aspect?.aspectConstraint?.aspectMode || "FREE_TEXT"),
    values: (Array.isArray(aspect?.aspectValues) ? aspect.aspectValues : [])
      .map((value) => String(value?.localizedValue || ""))
      .filter(Boolean)
      .slice(0, 40),
    prefilledValue: prefillAspect(
      String(aspect?.localizedAspectName || aspect?.aspectLocalizedName || ""),
      draft
    ),
  })).filter((aspect) => aspect.name);
}

async function ebayGetConditions(categoryId) {
  const filter = encodeURIComponent(`categoryIds:{${categoryId}}`);
  const { payload } = await ebayApiJson(
    `/sell/metadata/v1/marketplace/${encodeURIComponent(EBAY_MARKETPLACE_ID)}/get_item_condition_policies?filter=${filter}`
  );
  const policy = (Array.isArray(payload?.itemConditionPolicies) ? payload.itemConditionPolicies : [])
    .find((entry) => String(entry?.categoryId || "") === String(categoryId))
    || payload?.itemConditionPolicies?.[0];
  const conditions = Array.isArray(policy?.itemConditions) ? policy.itemConditions : [];
  return conditions.map((condition) => {
    const conditionId = String(condition?.conditionId || "");
    return {
      conditionId,
      conditionEnum: CONDITION_ENUM_BY_ID[conditionId] || "USED_GOOD",
      name: String(condition?.conditionDescription || condition?.conditionId || "Zustand"),
      helpText: String(condition?.conditionHelpText || ""),
    };
  }).filter((entry) => entry.conditionId);
}

function defaultConditionFromDraft(draft, conditions) {
  const text = `${draft?.condition || ""} ${draft?.description || ""}`.toLowerCase();
  const preferred = text.includes("neu") && !text.includes("gebraucht")
    ? "NEW"
    : text.includes("defekt") || text.includes("ersatzteil")
      ? "FOR_PARTS_OR_NOT_WORKING"
      : text.includes("sehr gut")
        ? "USED_VERY_GOOD"
        : text.includes("akzeptabel") || text.includes("stark")
          ? "USED_ACCEPTABLE"
          : "USED_GOOD";
  return conditions.find((entry) => entry.conditionEnum === preferred)?.conditionEnum
    || conditions[0]?.conditionEnum
    || "USED_GOOD";
}

function makeSku(draft) {
  const base = String(draft?.brand || draft?.analysis?.itemName || "ARTIKEL")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 16) || "ARTIKEL";
  return `VA-${base}-${Date.now().toString(36).toUpperCase()}`.slice(0, 50);
}

function makeLocationKey(profile) {
  const country = String(profile?.country || "DE").toLowerCase();
  const postal = String(profile?.postalCode || "00000").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  return `va-${country}-${postal}`.slice(0, 50);
}

async function ensureEbayLocation(key, sellerProfile) {
  const locations = await ebayGetLocations();
  if (locations.some((location) => location.merchantLocationKey === key)) {
    return key;
  }

  const address = {
    postalCode: String(sellerProfile?.postalCode || "").trim(),
    country: String(sellerProfile?.country || "DE").trim(),
  };
  if (sellerProfile?.city) address.city = String(sellerProfile.city).trim();

  if (!address.postalCode || !address.country) {
    throw new Error("Für den eBay-Verkäuferstandort fehlen PLZ oder Land.");
  }

  const body = {
    name: `Verkaufsassistent ${address.postalCode || address.city}`,
    merchantLocationStatus: "ENABLED",
    locationTypes: ["WAREHOUSE"],
    location: { address },
  };
  await ebayApiJson(`/sell/inventory/v1/location/${encodeURIComponent(key)}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return key;
}

async function uploadImageToEbay(file) {
  const token = await refreshEbayAccessTokenIfNeeded();
  if (!token) throw new Error("eBay-Konto ist nicht verbunden.");

  const form = new FormData();
  form.append(
    "file",
    new Blob([file.buffer], { type: file.mimetype || "image/jpeg" }),
    file.originalname || "artikel.jpg"
  );

  const response = await fetch(
    `${EBAY_API_BASE}/commerce/media/v1_beta/image/create_image_from_file`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, accept: "application/json" },
      body: form,
    }
  );
  const text = await response.text();
  let payload = null;
  if (text) {
    try { payload = JSON.parse(text); } catch { payload = { raw: text }; }
  }
  if (!response.ok) {
    throw new Error(ebayErrorMessage(payload, `eBay Bild-Upload Fehler ${response.status}`));
  }

  if (payload?.imageUrl) return payload.imageUrl;

  const location = response.headers.get("location") || "";
  const imageId = location.split("/").filter(Boolean).pop();
  if (imageId) {
    const { payload: imagePayload } = await ebayApiJson(
      `/commerce/media/v1_beta/image/${encodeURIComponent(imageId)}`
    );
    if (imagePayload?.imageUrl) return imagePayload.imageUrl;
  }

  throw new Error("eBay hat für ein Bild keine EPS-URL zurückgegeben.");
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 12,
    fileSize: 8 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Es sind nur Bilddateien erlaubt."));
      return;
    }
    cb(null, true);
  },
});

const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 1,
    fileSize: 20 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("audio/")) {
      cb(new Error("Es sind nur Audiodateien erlaubt."));
      return;
    }
    cb(null, true);
  },
});


app.use(cors());
app.use(
  express.json({
    limit: "1mb",
    verify: (req, _res, buffer) => {
      req.rawJsonBody = buffer.toString("utf8");
    },
  })
);

const PROVIDERS = {
  openai: {
    id: "openai",
    name: "OpenAI",
    description: "Bildanalyse und strukturierte Anzeigenerstellung",
    configured: Boolean(process.env.OPENAI_API_KEY),
    model: process.env.OPENAI_MODEL || "gpt-5.4",
  },
  anthropic: {
    id: "anthropic",
    name: "Claude",
    description: "Alternative multimodale Bildanalyse",
    configured: Boolean(process.env.ANTHROPIC_API_KEY),
    model: process.env.ANTHROPIC_MODEL || "claude-opus-5",
  },
  gemini: {
    id: "gemini",
    name: "Gemini",
    description: "Alternative multimodale Bildanalyse",
    configured: Boolean(process.env.GEMINI_API_KEY),
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
  },
};

const analysisSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    itemName: { type: "string" },
    title: { type: "string" },
    description: { type: "string" },
    category: { type: "string" },
    brand: { type: "string" },
    model: { type: "string" },
    condition: { type: "string" },
    accessories: { type: "array", items: { type: "string" } },
    visibleDefects: { type: "array", items: { type: "string" } },
    recognizedText: { type: "array", items: { type: "string" } },
    searchTerms: { type: "array", items: { type: "string" } },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    questions: { type: "array", items: { type: "string" } },
  },
  required: [
    "itemName",
    "title",
    "description",
    "category",
    "brand",
    "model",
    "condition",
    "accessories",
    "visibleDefects",
    "recognizedText",
    "searchTerms",
    "confidence",
    "questions",
  ],
};

const promptText = `Du analysierst mehrere Fotos DESSELBEN Verkaufsartikels für eine deutsche Secondhand-Verkaufs-App.

Liefere ausschließlich belastbare Angaben, die aus den Fotos ableitbar sind.

Regeln:
- Werte ALLE Bilder gemeinsam aus.
- Erfinde niemals Marke, Modell, Material, Größe, Funktion, Zubehör oder technischen Zustand.
- Wenn Marke oder Modell nicht eindeutig sind, schreibe "Nicht sicher erkannt".
- Beschreibe sichtbare Gebrauchsspuren/Schäden sachlich.
- Behaupte nicht "voll funktionsfähig", wenn das aus Bildern nicht feststellbar ist.
- Seriennummern, persönliche Daten, Adressen oder andere sensible Texte dürfen NICHT in den öffentlichen Verkaufstext.
- recognizedText darf relevante Produkttexte wie Marke, Modellbezeichnung, Größe oder EAN enthalten; private Daten aus Bildern auslassen.
- title soll für Kleinanzeigen/eBay brauchbar, klar und nicht reißerisch sein.
- description soll natürliches Deutsch verwenden, keine erfundenen Angaben und keine übertriebene Werbesprache.
- Formuliere den Zustand vorsichtig.
- questions enthält kurze Rückfragen, wenn ein zusätzliches Foto oder eine Nutzereingabe die Anzeige deutlich verbessern würde.
- confidence ist die Gesamtsicherheit von 0 bis 1.
- searchTerms enthält 2 bis 6 kurze Suchbegriffe, die später für Preisvergleich/Marktrecherche geeignet sind.
- Antworte ausschließlich mit einem JSON-Objekt, das exakt zum vorgegebenen Schema passt.`;


function buildUserMetadataContext(metadata = {}) {
  const lines = [];
  if (metadata.barcode) {
    lines.push(`Vom Nutzer gescannter Barcode/EAN: ${metadata.barcode}`);
  }
  if (metadata.voiceNotes) {
    lines.push(`Vom Nutzer ausdrücklich angegebene Zusatzinformationen: ${metadata.voiceNotes}`);
  }
  if (Array.isArray(metadata.photoRoles) && metadata.photoRoles.length) {
    lines.push(
      `Rollen der Bilder in Reihenfolge: ${metadata.photoRoles.join(", ")}. ` +
      `Ein Bild mit Rolle "typeplate" soll besonders für Marke/Modell/Typenschildtext ausgewertet werden.`
    );
  }
  return lines.length
    ? `\n\nZUSÄTZLICHER NUTZERKONTEXT:\n${lines.join("\n")}`
    : "";
}

function asDataUrl(file) {
  return `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
}

function base64(file) {
  return file.buffer.toString("base64");
}

function parseJsonText(text) {
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("Die KI hat kein auswertbares Ergebnis geliefert.");
  }

  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed);
  } catch {}

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return JSON.parse(fenced[1].trim());
  }

  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) {
    return JSON.parse(trimmed.slice(first, last + 1));
  }

  throw new Error("Die KI-Ausgabe war kein gültiges JSON.");
}

function validateResult(result) {
  const requiredStrings = [
    "itemName",
    "title",
    "description",
    "category",
    "brand",
    "model",
    "condition",
  ];

  for (const key of requiredStrings) {
    if (typeof result?.[key] !== "string") {
      throw new Error(`Ungültige KI-Ausgabe: ${key} fehlt.`);
    }
  }

  for (const key of [
    "accessories",
    "visibleDefects",
    "recognizedText",
    "searchTerms",
    "questions",
  ]) {
    if (!Array.isArray(result?.[key])) {
      throw new Error(`Ungültige KI-Ausgabe: ${key} fehlt.`);
    }
  }

  if (typeof result?.confidence !== "number") {
    result.confidence = 0;
  }

  result.confidence = Math.max(0, Math.min(1, result.confidence));
  return result;
}

async function analyzeWithOpenAI(files, metadata = {}) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OpenAI ist auf dem Server nicht konfiguriert.");
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const response = await openai.responses.create({
    model: PROVIDERS.openai.model,
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: promptText + buildUserMetadataContext(metadata) },
          ...files.map((file) => ({
            type: "input_image",
            image_url: asDataUrl(file),
            detail: "high",
          })),
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "listing_photo_analysis",
        strict: true,
        schema: analysisSchema,
      },
    },
  });

  return validateResult(parseJsonText(response.output_text));
}

async function analyzeWithAnthropic(files, metadata = {}) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("Claude ist auf dem Server nicht konfiguriert.");
  }

  const content = [];

  files.forEach((file, index) => {
    content.push({ type: "text", text: `Bild ${index + 1}:` });
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: file.mimetype,
        data: base64(file),
      },
    });
  });

  content.push({
    type: "text",
    text:
      promptText +
      buildUserMetadataContext(metadata) +
      "\n\nJSON-Schema:\n" +
      JSON.stringify(analysisSchema),
  });

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: PROVIDERS.anthropic.model,
      max_tokens: 2500,
      messages: [{ role: "user", content }],
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(
      payload?.error?.message || `Claude-Fehler ${response.status}`
    );
  }

  const text = Array.isArray(payload?.content)
    ? payload.content
        .filter((block) => block?.type === "text")
        .map((block) => block.text)
        .join("\n")
    : "";

  return validateResult(parseJsonText(text));
}

async function analyzeWithGemini(files, metadata = {}) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Gemini ist auf dem Server nicht konfiguriert.");
  }

  const parts = [
    { text: promptText + buildUserMetadataContext(metadata) },
    ...files.map((file) => ({
      inlineData: {
        mimeType: file.mimetype,
        data: base64(file),
      },
    })),
  ];

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${encodeURIComponent(PROVIDERS.gemini.model)}:generateContent?key=` +
    encodeURIComponent(process.env.GEMINI_API_KEY);

  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: analysisSchema,
      },
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(
      payload?.error?.message || `Gemini-Fehler ${response.status}`
    );
  }

  const text =
    payload?.candidates?.[0]?.content?.parts
      ?.map((part) => part?.text || "")
      .join("\n") || "";

  return validateResult(parseJsonText(text));
}




function mapEbayConversationSummary(conversation) {
  const latest = conversation?.latestMessage || {};
  return {
    id: `ebay:${String(conversation?.conversationId || "")}`,
    platformId: "ebay",
    externalConversationId: String(conversation?.conversationId || ""),
    listingExternalId: conversation?.referenceId
      ? String(conversation.referenceId)
      : undefined,
    listingTitle: conversation?.conversationTitle
      ? String(conversation.conversationTitle)
      : undefined,
    sender: String(
      latest?.senderUsername ||
      latest?.senderUserName ||
      conversation?.otherPartyUsername ||
      "eBay-Mitglied"
    ),
    subject: String(
      latest?.subject ||
      conversation?.conversationTitle ||
      "eBay-Nachricht"
    ),
    preview: String(latest?.messageBody || ""),
    lastMessageAt: String(
      latest?.createdDate ||
      conversation?.lastModifiedDate ||
      conversation?.createdDate ||
      new Date(0).toISOString()
    ),
    unreadCount: Number(conversation?.unreadCount || 0),
    sourceMode: "api",
  };
}

function mapEbayMessage(message) {
  const sender = String(
    message?.senderUsername ||
    message?.senderUserName ||
    "eBay-Mitglied"
  );

  const ownUsername = ebayTokenStore?.username || "";
  return {
    id: String(message?.messageId || `${Date.now()}-${Math.random()}`),
    direction:
      ownUsername && sender === ownUsername
        ? "outbound"
        : "inbound",
    body: String(message?.messageBody || ""),
    sender,
    sentAt: String(message?.createdDate || new Date(0).toISOString()),
    read: Boolean(message?.readStatus),
  };
}

function inboxConnectors(ebayState = {}) {
  return [
    {
      platformId: "ebay",
      name: "eBay",
      mode: "api",
      connected: Boolean(ebayState.connected),
      canReceive: Boolean(ebayState.connected && !ebayState.error),
      canReply: Boolean(ebayState.connected && !ebayState.error),
      detail: ebayState.error
        ? String(ebayState.error)
        : ebayState.connected
          ? "Offizielle eBay Message API verbunden."
          : "eBay-Konto noch nicht verbunden.",
    },
    {
      platformId: "kleinanzeigen",
      name: "Kleinanzeigen",
      mode: "email_bridge_ready",
      connected: false,
      canReceive: false,
      canReply: false,
      detail:
        "Connector vorbereitet; keine verifizierte Nachrichten-API verbunden.",
    },
    {
      platformId: "facebook",
      name: "Facebook Marketplace",
      mode: "handoff",
      connected: false,
      canReceive: false,
      canReply: false,
      detail:
        "Noch keine verifizierte Marketplace-Inbox-API verbunden.",
    },
    {
      platformId: "vinted",
      name: "Vinted",
      mode: "handoff",
      connected: false,
      canReceive: false,
      canReply: false,
      detail: "Noch keine verifizierte Nachrichten-API verbunden.",
    },
    {
      platformId: "willhaben",
      name: "willhaben",
      mode: "handoff",
      connected: false,
      canReceive: false,
      canReply: false,
      detail: "Noch keine verifizierte Nachrichten-API verbunden.",
    },
    {
      platformId: "shpock",
      name: "Shpock",
      mode: "handoff",
      connected: false,
      canReceive: false,
      canReply: false,
      detail: "Noch keine verifizierte Nachrichten-API verbunden.",
    },
    {
      platformId: "quoka",
      name: "Quoka",
      mode: "handoff",
      connected: false,
      canReceive: false,
      canReply: false,
      detail: "Noch keine verifizierte Nachrichten-API verbunden.",
    },
    {
      platformId: "hood",
      name: "Hood.de",
      mode: "handoff",
      connected: false,
      canReceive: false,
      canReply: false,
      detail: "Noch keine verifizierte Nachrichten-API verbunden.",
    },
    {
      platformId: "markt",
      name: "markt.de",
      mode: "handoff",
      connected: false,
      canReceive: false,
      canReply: false,
      detail: "Noch keine verifizierte Nachrichten-API verbunden.",
    },
  ];
}

async function ebayGetConversations() {
  const { payload } = await ebayApiJson(
    "/commerce/message/v1/conversation?conversation_type=FROM_MEMBERS&limit=50&offset=0"
  );
  return Array.isArray(payload?.conversations) ? payload.conversations : [];
}

async function ebayGetConversation(conversationId) {
  const { payload } = await ebayApiJson(
    `/commerce/message/v1/conversation/${encodeURIComponent(conversationId)}?conversation_type=FROM_MEMBERS&limit=50&offset=0`
  );
  return payload;
}

const photoAuditSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    source: { type: "string", enum: ["ai"] },
    privacyScanComplete: { type: "boolean" },
    overallQualityScore: { type: "integer", minimum: 0, maximum: 100 },
    recommendedCoverIndex: { type: "integer", minimum: 0 },
    hasBlockingPrivacyRisk: { type: "boolean" },
    blockingIssues: { type: "array", items: { type: "string" } },
    improvementTips: { type: "array", items: { type: "string" } },
    photos: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          photoIndex: { type: "integer", minimum: 0 },
          qualityScore: { type: "integer", minimum: 0, maximum: 100 },
          coverScore: { type: "integer", minimum: 0, maximum: 100 },
          usable: { type: "boolean" },
          issues: {
            type: "array",
            items: {
              type: "string",
              enum: [
                "blur",
                "too_dark",
                "overexposed",
                "cropped_product",
                "busy_background",
                "low_detail",
                "watermark",
                "face",
                "address",
                "license_plate",
                "personal_document",
                "serial_number",
                "other"
              ],
            },
          },
          notes: { type: "array", items: { type: "string" } },
          privacyRisks: { type: "array", items: { type: "string" } },
          blockingPrivacyRisk: { type: "boolean" },
        },
        required: [
          "photoIndex",
          "qualityScore",
          "coverScore",
          "usable",
          "issues",
          "notes",
          "privacyRisks",
          "blockingPrivacyRisk"
        ],
      },
    },
  },
  required: [
    "source",
    "privacyScanComplete",
    "overallQualityScore",
    "recommendedCoverIndex",
    "hasBlockingPrivacyRisk",
    "blockingIssues",
    "improvementTips",
    "photos"
  ],
};

const photoAuditPrompt = `
Du bist ein Foto-Preflight für eine mobile Secondhand-Verkaufsapp.
Prüfe JEDES Bild einzeln und die Bildserie gemeinsam.

Ziele:
1. Bildqualität für eine Verkaufsanzeige bewerten.
2. Das beste TITELBILD bestimmen.
3. Vor potenziell privaten/sensiblen sichtbaren Inhalten warnen.
4. Sichtbare Schäden niemals als Problem der Bildqualität abwerten, nur weil
   sie den Artikel weniger attraktiv machen. Schäden sollen im Verkauf sichtbar bleiben.

QUALITÄT:
- Unschärfe
- zu dunkel / überbelichtet
- Produkt abgeschnitten
- unruhiger Hintergrund
- zu wenig Detail
- Wasserzeichen
- Artikel schlecht erkennbar
Bewerte qualityScore 0-100.

TITELBILD:
- Produkt vollständig und klar sichtbar
- gute Perspektive
- ruhiger Hintergrund
- keine unnötig privaten Inhalte
- ein Typenschild-/Schadens-/Zubehörfoto ist normalerweise NICHT das Titelbild,
  außer es ist ausnahmsweise die einzige brauchbare Aufnahme.
Bewerte coverScore 0-100.

PRIVATSPHÄRE:
Erkenne nur, OB etwas sichtbar ist; identifiziere keine Person.
Warnungen für:
- deutlich sichtbares Gesicht
- private Adresse / Namensschild / Brief
- Kennzeichen
- persönliches Dokument
- Seriennummer/Gerätekennung als Hinweis
Gesicht, private Adresse, Kennzeichen und persönliche Dokumente sind
blockingPrivacyRisk=true.
Eine reine Produkt-Seriennummer ist nur Warnung, nicht automatisch Blocker.

WICHTIG:
- Keine Gesichter beschreiben oder identifizieren.
- Keine vollständigen privaten Daten abschreiben.
- Keine Schäden wegretuschieren oder Verschönerung empfehlen.
- Ausgabe nur im vorgegebenen JSON.
`;

async function photoAuditWithOpenAI(files, roles) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OpenAI ist auf dem Server nicht konfiguriert.");
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await openai.responses.create({
    model: PROVIDERS.openai.model,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text:
              photoAuditPrompt +
              `\nBildrollen in Reihenfolge: ${roles.join(", ")}. ` +
              `Es sind genau ${files.length} Bilder; liefere genau ${files.length} Photo-Einträge mit photoIndex 0 bis ${Math.max(0, files.length - 1)}.`,
          },
          ...files.map((file) => ({
            type: "input_image",
            image_url: asDataUrl(file),
            detail: "high",
          })),
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "photo_audit",
        strict: true,
        schema: photoAuditSchema,
      },
    },
  });

  return parseJsonText(response.output_text);
}

async function photoAuditWithAnthropic(files, roles) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("Claude ist auf dem Server nicht konfiguriert.");
  }

  const content = [];
  files.forEach((file, index) => {
    content.push({
      type: "text",
      text: `Bild ${index + 1}, Rolle ${roles[index] || "general"}:`,
    });
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: file.mimetype,
        data: base64(file),
      },
    });
  });

  content.push({
    type: "text",
    text:
      photoAuditPrompt +
      `\nEs sind ${files.length} Bilder; liefere genau ${files.length} Photo-Einträge mit photoIndex 0 bis ${Math.max(0, files.length - 1)}.` +
      `\nJSON-Schema:\n${JSON.stringify(photoAuditSchema)}`,
  });

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: PROVIDERS.anthropic.model,
      max_tokens: 4000,
      messages: [{ role: "user", content }],
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Claude-Fehler ${response.status}`);
  }

  const text = Array.isArray(payload?.content)
    ? payload.content
        .filter((block) => block?.type === "text")
        .map((block) => block.text)
        .join("\n")
    : "";

  return parseJsonText(text);
}

async function photoAuditWithGemini(files, roles) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Gemini ist auf dem Server nicht konfiguriert.");
  }

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${encodeURIComponent(PROVIDERS.gemini.model)}:generateContent?key=` +
    encodeURIComponent(process.env.GEMINI_API_KEY);

  const parts = [
    {
      text:
        photoAuditPrompt +
        `\nBildrollen: ${roles.join(", ")}. ` +
        `Es sind ${files.length} Bilder; liefere genau ${files.length} Photo-Einträge mit photoIndex 0 bis ${Math.max(0, files.length - 1)}.`,
    },
    ...files.map((file) => ({
      inlineData: {
        mimeType: file.mimetype,
        data: base64(file),
      },
    })),
  ];

  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: photoAuditSchema,
      },
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Gemini-Fehler ${response.status}`);
  }

  const text =
    payload?.candidates?.[0]?.content?.parts
      ?.map((part) => part?.text || "")
      .join("\n") || "";

  return parseJsonText(text);
}

function validatePhotoAudit(result, fileCount) {
  const photos = Array.isArray(result?.photos) ? result.photos : [];
  if (photos.length !== fileCount) {
    throw new Error("Foto-Check lieferte eine unvollständige Bildliste.");
  }

  const recommended = Number(result?.recommendedCoverIndex);
  if (!Number.isInteger(recommended) || recommended < 0 || recommended >= fileCount) {
    result.recommendedCoverIndex = 0;
  }

  return {
    ...result,
    source: "ai",
    privacyScanComplete: true,
  };
}

const platformCopySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    copies: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          platformId: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          priceText: { type: "string" },
          titleLimit: { type: "integer", minimum: 0 },
          tips: { type: "array", items: { type: "string" } },
        },
        required: [
          "platformId",
          "title",
          "description",
          "priceText",
          "titleLimit",
          "tips",
        ],
      },
    },
  },
  required: ["copies"],
};

async function structuredTextWithOpenAI(prompt, schema, schemaName) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OpenAI ist auf dem Server nicht konfiguriert.");
  }
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await openai.responses.create({
    model: PROVIDERS.openai.model,
    input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }],
    text: {
      format: {
        type: "json_schema",
        name: schemaName,
        strict: true,
        schema,
      },
    },
  });
  return parseJsonText(response.output_text);
}

async function structuredTextWithAnthropic(prompt, schema) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("Claude ist auf dem Server nicht konfiguriert.");
  }
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: PROVIDERS.anthropic.model,
      max_tokens: 5000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `${prompt}\n\nAntworte nur als JSON nach diesem Schema:\n${JSON.stringify(schema)}`,
            },
          ],
        },
      ],
    }),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Claude-Fehler ${response.status}`);
  }
  const text = Array.isArray(payload?.content)
    ? payload.content
        .filter((block) => block?.type === "text")
        .map((block) => block.text)
        .join("\n")
    : "";
  return parseJsonText(text);
}

async function structuredTextWithGemini(prompt, schema) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Gemini ist auf dem Server nicht konfiguriert.");
  }
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${encodeURIComponent(PROVIDERS.gemini.model)}:generateContent?key=` +
    encodeURIComponent(process.env.GEMINI_API_KEY);
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    }),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Gemini-Fehler ${response.status}`);
  }
  const text =
    payload?.candidates?.[0]?.content?.parts
      ?.map((part) => part?.text || "")
      .join("\n") || "";
  return parseJsonText(text);
}

async function generateStructuredText(provider, prompt, schema, schemaName) {
  if (provider === "openai") {
    return structuredTextWithOpenAI(prompt, schema, schemaName);
  }
  if (provider === "anthropic") {
    return structuredTextWithAnthropic(prompt, schema);
  }
  if (provider === "gemini") {
    return structuredTextWithGemini(prompt, schema);
  }
  throw new Error("Unbekannter KI-Anbieter.");
}

function platformCopyPrompt(draft, platformIds, sellerProfile) {
  const platformRules = {
    kleinanzeigen:
      "Kleinanzeigen: natürliches, direktes Deutsch. Titel, Preis und Beschreibung klar. Keine erfundenen Versand-/Abholangaben.",
    ebay:
      "eBay: Titel MAXIMAL 80 Zeichen. Marke, Modell, Produkttyp und wichtige Suchmerkmale priorisieren; keine irrelevanten Sonderzeichen. Beschreibung präzise und strukturiert.",
    facebook:
      "Facebook Marketplace: kurzer, schnell scanbarer Titel und kompakte, freundliche Beschreibung. Keine erfundenen lokalen Angaben.",
    vinted:
      "Vinted: genaue Artikelmerkmale, Zustand und erkennbare Mängel nennen. Keine irrelevanten Markennamen oder Marken-Hashtags. Elektronik: Modell/Zubehör/erkennbare Defekte konkret, falls belegt.",
    willhaben:
      "willhaben: klares, sachliches Deutsch für den österreichischen Privatmarkt. Keine Versand-/Abholangabe erfinden.",
    shpock:
      "Shpock: kurze lokale Secondhand-Anzeige mit klaren Fakten.",
    quoka:
      "Quoka: sachliche klassische Kleinanzeige, übersichtlich und ohne Werbeübertreibung.",
    hood:
      "Hood.de: suchbarer Produkttitel und strukturierte Produktbeschreibung.",
    markt:
      "markt.de: regionale Kleinanzeige, klar und sachlich formuliert.",
  };

  const rules = platformIds
    .map((id) => platformRules[id] || `${id}: neutrale sachliche Marktplatz-Version.`)
    .join("\n");

  return `Du erstellst aus EINEM Master-Verkaufsentwurf mehrere plattformspezifische Versionen.

WICHTIGE REGELN:
- Erfinde KEINE Fakten, Funktionen, Maße, Materialien, Versandarten, Abholorte, Garantie, Funktionsfähigkeit oder Zubehör.
- Nutze nur Informationen aus dem Master-Entwurf und der Fotoanalyse.
- Sichtbare Mängel dürfen nicht verschwiegen oder beschönigt werden.
- Persönliche Daten, Seriennummern und private Informationen nicht ergänzen.
- Rechtliche Klauseln nur beibehalten, wenn sie bereits im Mastertext stehen; keine neuen Rechtsbehauptungen erfinden.
- Jede Plattformversion soll sich erkennbar unterscheiden, aber inhaltlich wahr bleiben.
- priceText basiert ausschließlich auf dem vorhandenen Preis und der Preisart.
- titleLimit: eBay = 80. Andere Plattformen = 0, sofern keine harte Grenze vorgegeben wird.

PLATTFORMREGELN:
${rules}

MASTERDATEN:
${JSON.stringify(draft, null, 2)}

VOM NUTZER FESTGELEGTE VERKAUFSBEDINGUNGEN:
${JSON.stringify(sellerProfile || {}, null, 2)}

Nutze Versand, Abholung, PLZ/Ort, Versandkosten und Zahlungsarten nur dann,
wenn sie in diesen Verkaufsbedingungen ausdrücklich gesetzt sind.
Keine vollständige Straßenadresse ausgeben.
Keine rechtlichen Garantie-/Gewährleistungs-/Rückgabeklauseln erfinden.

GEWÜNSCHTE PLATTFORMEN:
${JSON.stringify(platformIds)}

Gib genau eine Version je gewünschter Plattform zurück.`;
}

app.get("/ebay/diagnostics", async (_req, res) => {
  try {
    const checks = [];
    const callbackUrl = PUBLIC_BASE_URL
      ? `${PUBLIC_BASE_URL}/ebay/oauth/callback`
      : null;

    checks.push({
      id: "environment",
      label: "eBay-Umgebung",
      status: "ok",
      detail: `${EBAY_ENV === "sandbox" ? "Sandbox" : "Produktion"} · ${EBAY_MARKETPLACE_ID}`,
    });

    const envMissing = [];
    if (!EBAY_CLIENT_ID) envMissing.push("EBAY_CLIENT_ID");
    if (!EBAY_CLIENT_SECRET) envMissing.push("EBAY_CLIENT_SECRET");
    if (!EBAY_RUNAME) envMissing.push("EBAY_RUNAME");

    checks.push({
      id: "config",
      label: "Developer-Konfiguration",
      status: envMissing.length ? "error" : "ok",
      detail: envMissing.length
        ? `Fehlt: ${envMissing.join(", ")}`
        : "Client ID, Client Secret und RuName sind gesetzt.",
    });

    if (!PUBLIC_BASE_URL) {
      checks.push({
        id: "callback",
        label: "OAuth Accept URL",
        status: "warning",
        detail:
          "PUBLIC_BASE_URL fehlt. Die App kann deshalb nicht anzeigen, welche Accept URL im eBay Developer Portal hinterlegt werden muss.",
      });
    } else {
      checks.push({
        id: "callback",
        label: "OAuth Accept URL",
        status: "ok",
        detail: callbackUrl,
      });
    }

    const keyTest = envMissing.includes("EBAY_CLIENT_ID") ||
      envMissing.includes("EBAY_CLIENT_SECRET")
      ? { ok: false, detail: "Key-Test übersprungen, da Zugangsdaten fehlen." }
      : await ebayTestApplicationKeys();

    checks.push({
      id: "keys",
      label: "Application Keys",
      status: keyTest.ok ? "ok" : "error",
      detail: keyTest.detail,
    });

    checks.push({
      id: "oauth",
      label: "Verkäufer-OAuth",
      status: ebayTokenStore ? "ok" : "warning",
      detail: ebayTokenStore
        ? `Verkäuferkonto verbunden${
            ebayTokenStore.expiresAt
              ? ` · Access Token bis ${new Date(ebayTokenStore.expiresAt).toISOString()}`
              : ""
          }.`
        : "Noch kein Verkäuferkonto per Authorization Code Flow verbunden.",
    });

    let inventoryApiReachable = null;
    let inventoryApiVersion = null;
    let categoryTreeId = null;
    let fulfillmentPolicies = null;
    let paymentPolicies = null;
    let returnPolicies = null;
    let locationCount = null;

    if (ebayTokenStore) {
      try {
        const { payload } = await ebayApiJson("/sell/inventory/v1/getVersion");
        inventoryApiReachable = true;
        inventoryApiVersion =
          String(payload?.version || payload?.instance?.version || "") || "erreichbar";
        checks.push({
          id: "inventory",
          label: "Inventory API",
          status: "ok",
          detail: `Erreichbar · Version ${inventoryApiVersion}`,
        });
      } catch (error) {
        inventoryApiReachable = false;
        checks.push({
          id: "inventory",
          label: "Inventory API",
          status: "error",
          detail: error instanceof Error ? error.message : "Inventory API nicht erreichbar.",
        });
      }

      try {
        categoryTreeId = await ebayGetCategoryTreeId();
        checks.push({
          id: "taxonomy",
          label: "Kategoriebaum",
          status: "ok",
          detail: `Kategoriebaum ${categoryTreeId} für ${EBAY_MARKETPLACE_ID} erreichbar.`,
        });
      } catch (error) {
        checks.push({
          id: "taxonomy",
          label: "Kategoriebaum",
          status: "error",
          detail: error instanceof Error ? error.message : "Taxonomy API nicht erreichbar.",
        });
      }

      try {
        const policies = await ebayGetPolicies();
        fulfillmentPolicies = policies.fulfillmentPolicies.length;
        paymentPolicies = policies.paymentPolicies.length;
        returnPolicies = policies.returnPolicies.length;

        const policyComplete =
          fulfillmentPolicies > 0 &&
          paymentPolicies > 0 &&
          returnPolicies > 0;

        checks.push({
          id: "policies",
          label: "Business Policies",
          status: policyComplete ? "ok" : "warning",
          detail:
            `Versand ${fulfillmentPolicies} · Zahlung ${paymentPolicies} · Rückgabe ${returnPolicies}` +
            (policyComplete
              ? ""
              : " · Für publishOffer wird je mindestens eine Richtlinie benötigt."),
        });
      } catch (error) {
        checks.push({
          id: "policies",
          label: "Business Policies",
          status: "warning",
          detail: error instanceof Error ? error.message : "Richtlinien konnten nicht geprüft werden.",
        });
      }

      try {
        const locations = await ebayGetLocations();
        locationCount = locations.length;
        checks.push({
          id: "locations",
          label: "Inventory Locations",
          status: "ok",
          detail:
            locationCount > 0
              ? `${locationCount} Verkäuferstandort(e) vorhanden.`
              : "Noch kein Standort vorhanden; die App kann beim Publish einen aus PLZ/Land anlegen.",
        });
      } catch (error) {
        checks.push({
          id: "locations",
          label: "Inventory Locations",
          status: "warning",
          detail: error instanceof Error ? error.message : "Standorte konnten nicht geprüft werden.",
        });
      }
    } else {
      for (const [id, label] of [
        ["inventory", "Inventory API"],
        ["taxonomy", "Kategoriebaum"],
        ["policies", "Business Policies"],
        ["locations", "Inventory Locations"],
      ]) {
        checks.push({
          id,
          label,
          status: "pending",
          detail: "Wird geprüft, sobald ein eBay-Verkäuferkonto verbunden ist.",
        });
      }
    }

    const readyForPreflight =
      ebayConfigured() &&
      Boolean(ebayTokenStore) &&
      inventoryApiReachable === true &&
      Boolean(categoryTreeId);

    const readyForPublish =
      readyForPreflight &&
      Number(fulfillmentPolicies || 0) > 0 &&
      Number(paymentPolicies || 0) > 0 &&
      Number(returnPolicies || 0) > 0;

    res.json({
      environment: EBAY_ENV,
      marketplaceId: EBAY_MARKETPLACE_ID,
      configured: ebayConfigured(),
      connected: Boolean(ebayTokenStore),
      callbackUrl,
      runameConfigured: Boolean(EBAY_RUNAME),
      applicationKeysValid: keyTest.ok,
      tokenExpiresAt: ebayTokenStore?.expiresAt
        ? new Date(ebayTokenStore.expiresAt).toISOString()
        : null,
      inventoryApiReachable,
      inventoryApiVersion,
      categoryTreeId,
      fulfillmentPolicies,
      paymentPolicies,
      returnPolicies,
      locations: locationCount,
      readyForPreflight,
      readyForPublish,
      checks,
      statusUrl: "https://developer.ebay.com/support/api-status/sandbox",
      sandboxHelpUrl: "https://developer.ebay.com/develop/tools/sandbox",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "eBay-Diagnose fehlgeschlagen.",
    });
  }
});

app.get("/ebay/oauth/start", (_req, res) => {
  if (!ebayConfigured()) {
    return res.status(503).json({
      error:
        "eBay OAuth ist noch nicht konfiguriert. EBAY_CLIENT_ID, EBAY_CLIENT_SECRET und EBAY_RUNAME fehlen.",
    });
  }

  const state = crypto.randomBytes(24).toString("hex");
  ebayOauthStates.set(state, Date.now() + 10 * 60 * 1000);

  const params = new URLSearchParams({
    client_id: EBAY_CLIENT_ID,
    response_type: "code",
    redirect_uri: EBAY_RUNAME,
    scope: EBAY_SCOPES.join(" "),
    state,
    locale: "de-DE",
  });

  res.json({
    authUrl: `${EBAY_AUTH_BASE}/oauth2/authorize?${params.toString()}`,
    environment: EBAY_ENV,
  });
});

app.get("/ebay/oauth/callback", async (req, res) => {
  try {
    const code = String(req.query?.code || "");
    const state = String(req.query?.state || "");
    const stateExpiry = ebayOauthStates.get(state);

    if (!code || !state || !stateExpiry || stateExpiry < Date.now()) {
      return res.status(400).send(
        "<h2>eBay-Verknüpfung fehlgeschlagen</h2><p>Ungültiger oder abgelaufener OAuth-Status.</p>"
      );
    }

    ebayOauthStates.delete(state);

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: EBAY_RUNAME,
    });

    const response = await fetch(`${EBAY_API_BASE}/identity/v1/oauth2/token`, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        authorization: `Basic ${ebayBasicAuth()}`,
      },
      body,
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(
        payload?.error_description ||
          payload?.error ||
          "eBay-Tokenaustausch fehlgeschlagen."
      );
    }

    ebayTokenStore = {
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token || null,
      expiresAt: Date.now() + Number(payload.expires_in || 7200) * 1000,
      scope: payload.scope || EBAY_SCOPES.join(" "),
    };

    res.send(`<!doctype html>
<html lang="de">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:system-ui;padding:32px;max-width:560px;margin:auto">
<h2>eBay ist verbunden ✓</h2>
<p>Du kannst jetzt zum Verkaufsassistenten zurückkehren und dort „Status aktualisieren“ wählen.</p>
<p>Dieses MVP speichert den Token nur im laufenden Backend-Prozess. Für Produktion gehört er verschlüsselt in einen nutzerbezogenen Datenspeicher.</p>
</body></html>`);
  } catch (error) {
    console.error(error);
    res.status(500).send(
      `<h2>eBay-Verknüpfung fehlgeschlagen</h2><p>${
        error instanceof Error ? error.message : "Unbekannter Fehler"
      }</p>`
    );
  }
});

app.get("/ebay/status", async (_req, res) => {
  let policyStatus = {
    checked: false,
    fulfillmentPolicies: null,
    paymentPolicies: null,
    returnPolicies: null,
  };

  if (ebayTokenStore) {
    try {
      policyStatus = await ebayPolicyStatus();
    } catch {
      ebayTokenStore = null;
    }
  }

  res.json({
    configured: ebayConfigured(),
    connected: Boolean(ebayTokenStore),
    environment: EBAY_ENV,
    expiresAt: ebayTokenStore?.expiresAt
      ? new Date(ebayTokenStore.expiresAt).toISOString()
      : null,
    policyStatus,
    message: ebayConfigured()
      ? "eBay OAuth ist serverseitig vorbereitet."
      : "eBay Developer-Zugangsdaten fehlen.",
  });
});

app.post("/ebay/disconnect", (_req, res) => {
  ebayTokenStore = null;
  res.json({ ok: true });
});



app.post("/ebay/offer/:offerId/withdraw", async (req, res) => {
  try {
    const offerId = String(req.params?.offerId || "").trim();
    if (!offerId) {
      return res.status(400).json({ error: "eBay Offer-ID fehlt." });
    }

    const { payload } = await ebayApiJson(
      `/sell/inventory/v1/offer/${encodeURIComponent(offerId)}/withdraw`,
      { method: "POST" }
    );

    res.json({
      ok: true,
      listingId: payload?.listingId ? String(payload.listingId) : undefined,
      warnings: Array.isArray(payload?.warnings)
        ? payload.warnings.map((warning) =>
            String(
              warning?.message ||
              warning?.longMessage ||
              warning?.errorId ||
              "eBay-Warnung"
            )
          )
        : [],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "eBay-Angebot konnte nicht beendet werden.",
    });
  }
});



app.post("/push/register", requirePushPairing, async (req, res) => {
  try {
    await ensurePushStoreLoaded();

    const expoPushToken = String(
      req.body?.expoPushToken || ""
    ).trim();

    if (!isExpoPushToken(expoPushToken)) {
      return res.status(400).json({
        error: "Ungültiger Expo Push Token.",
      });
    }

    expoPushTokens.set(expoPushToken, {
      token: expoPushToken,
      platform: String(req.body?.platform || "unknown"),
      registeredAt: new Date().toISOString(),
    });

    await persistPushTokens();

    res.json({
      ok: true,
      registeredDevices: expoPushTokens.size,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Push-Gerät konnte nicht registriert werden.",
    });
  }
});

app.delete("/push/register", requirePushPairing, async (req, res) => {
  await ensurePushStoreLoaded();
  const expoPushToken = String(
    req.body?.expoPushToken || ""
  ).trim();

  if (expoPushToken) {
    expoPushTokens.delete(expoPushToken);
    await persistPushTokens();
  }

  res.json({
    ok: true,
    registeredDevices: expoPushTokens.size,
  });
});

app.get("/push/status", requirePushPairing, async (_req, res) => {
  await ensurePushStoreLoaded();
  res.json({
    registeredDevices: expoPushTokens.size,
    storagePath: PUSH_TOKEN_STORE_PATH,
  });
});

app.post("/push/test", requirePushPairing, async (_req, res) => {
  try {
    const result = await sendExpoPush({
      title: "Verkaufsassistent",
      body: "Push funktioniert. Neue Käuferanfragen können dich jetzt direkt erreichen.",
      data: {
        screen: "inbox",
        type: "push_test",
      },
    });

    res.json({
      ok: true,
      sent: result.sent,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Test-Push fehlgeschlagen.",
    });
  }
});

app.get("/webhooks/ebay/messages", (req, res) => {
  const challengeCode = String(
    req.query?.challenge_code || ""
  ).trim();

  if (!challengeCode) {
    return res.status(400).json({
      error: "challenge_code fehlt.",
    });
  }

  if (!ebayNotificationConfigReady()) {
    return res.status(503).json({
      error: "eBay Webhook ist noch nicht vollständig konfiguriert.",
    });
  }

  res
    .status(200)
    .type("application/json")
    .json({
      challengeResponse:
        ebayNotificationChallenge(challengeCode),
    });
});

app.post("/webhooks/ebay/messages", async (req, res) => {
  try {
    const signature = req.headers["x-ebay-signature"];

    const valid = await validateEbayNotificationSignature(
      req.body,
      signature
    );

    if (!valid) {
      return res.status(412).send();
    }

    const event = rememberEbayNotificationEvent(req.body);
    const topic = String(
      req.body?.metadata?.topic || ""
    ).toUpperCase();

    if (topic === "NEW_MESSAGE") {
      const data = req.body?.notification?.data || {};

      await sendExpoPush({
        title: "Neue eBay-Anfrage",
        body:
          "Eine neue Käufernachricht ist eingegangen.",
        data: {
          screen: "inbox",
          type: "new_message",
          platform: "ebay",
          conversationId: String(
            data?.conversationId || ""
          ),
          notificationId: event.notificationId,
        },
      }).catch((error) => {
        console.error(
          "Expo push delivery failed:",
          error
        );
      });
    }

    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).send();
  }
});

app.get("/notifications/ebay/status", requirePushPairing, async (_req, res) => {
  const base = {
    configured: ebayNotificationConfigReady(),
    connected: Boolean(ebayTokenStore),
    endpoint:
      EBAY_NOTIFICATION_ENDPOINT || null,
    verificationTokenConfigured:
      /^[A-Za-z0-9_-]{32,80}$/.test(
        EBAY_NOTIFICATION_VERIFICATION_TOKEN
      ),
    destinationId: null,
    subscriptionId: null,
    topicId: null,
    enabled: false,
    recentEvents:
      recentEbayNotificationEvents.length,
    lastEventAt:
      recentEbayNotificationEvents[0]?.receivedAt ||
      null,
    detail: "",
  };

  if (!base.configured) {
    return res.json({
      ...base,
      detail:
        "PUBLIC_BASE_URL oder EBAY_NOTIFICATION_VERIFICATION_TOKEN fehlt.",
    });
  }

  if (!base.connected) {
    return res.json({
      ...base,
      detail:
        "eBay muss mit dem commerce.message Scope neu verbunden werden.",
    });
  }

  try {
    const inventory =
      await ebayNotificationInventory();

    const destinationKey =
      destinationId(inventory.destination);
    const subscriptionKey =
      subscriptionId(inventory.subscription);
    const topicKey = topicId(inventory.topic);
    const enabled =
      String(
        inventory.subscription?.status || ""
      ).toUpperCase() === "ENABLED";

    return res.json({
      ...base,
      destinationId: destinationKey || null,
      subscriptionId:
        subscriptionKey || null,
      topicId: topicKey || null,
      enabled,
      detail:
        destinationKey &&
        subscriptionKey &&
        enabled
          ? "eBay NEW_MESSAGE Webhook ist aktiv."
          : "Webhook ist vorbereitet, aber Destination/Subscription noch nicht vollständig aktiv.",
    });
  } catch (error) {
    return res.json({
      ...base,
      detail:
        error instanceof Error
          ? error.message
          : "eBay Notification Status konnte nicht geprüft werden.",
    });
  }
});

app.post("/notifications/ebay/setup", requirePushPairing, async (_req, res) => {
  try {
    const setup =
      await ensureEbayNewMessageSubscription();

    const inventory =
      await ebayNotificationInventory();

    res.json({
      configured: true,
      connected: true,
      endpoint: EBAY_NOTIFICATION_ENDPOINT,
      verificationTokenConfigured: true,
      destinationId: setup.destinationId,
      subscriptionId: setup.subscriptionId,
      topicId: setup.topicId,
      enabled:
        String(
          inventory.subscription?.status || ""
        ).toUpperCase() === "ENABLED",
      recentEvents:
        recentEbayNotificationEvents.length,
      lastEventAt:
        recentEbayNotificationEvents[0]?.receivedAt ||
        null,
      detail:
        "eBay NEW_MESSAGE Webhook wurde eingerichtet.",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "eBay Notification Setup fehlgeschlagen.",
    });
  }
});

app.post("/notifications/ebay/test", requirePushPairing, async (_req, res) => {
  try {
    const inventory =
      await ebayNotificationInventory();

    const id =
      subscriptionId(inventory.subscription);

    if (!id) {
      return res.status(409).json({
        error:
          "Noch keine NEW_MESSAGE Subscription vorhanden.",
      });
    }

    await ebayApiJson(
      `/commerce/notification/v1/subscription/${encodeURIComponent(id)}/test`,
      { method: "POST" }
    );

    res.json({
      ok: true,
      subscriptionId: id,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "eBay Notification Test fehlgeschlagen.",
    });
  }
});

app.get("/messages/inbox", async (_req, res) => {
  const connected = Boolean(ebayTokenStore);
  let conversations = [];
  let ebayError = null;

  if (connected) {
    try {
      conversations = (await ebayGetConversations())
        .map(mapEbayConversationSummary)
        .filter((conversation) => conversation.externalConversationId)
        .sort((a, b) =>
          String(b.lastMessageAt).localeCompare(String(a.lastMessageAt))
        );
    } catch (error) {
      ebayError =
        error instanceof Error ? error.message : "eBay-Nachrichtenfehler";
    }
  }

  res.json({
    total: conversations.length,
    unread: conversations.reduce(
      (sum, conversation) => sum + Number(conversation.unreadCount || 0),
      0
    ),
    conversations,
    connectors: inboxConnectors({
      connected,
      error: ebayError,
    }),
  });
});

app.get("/messages/ebay/conversation/:conversationId", async (req, res) => {
  try {
    const conversationId = String(req.params?.conversationId || "").trim();
    if (!conversationId) {
      return res.status(400).json({ error: "Conversation-ID fehlt." });
    }

    const payload = await ebayGetConversation(conversationId);
    const summary = mapEbayConversationSummary(payload);
    const rawMessages =
      payload?.messages ||
      payload?.messageDetails ||
      payload?.conversationMessages ||
      [];

    res.json({
      ...summary,
      id: `ebay:${conversationId}`,
      externalConversationId: conversationId,
      listingExternalId: payload?.referenceId
        ? String(payload.referenceId)
        : summary.listingExternalId,
      messages: Array.isArray(rawMessages)
        ? rawMessages.map(mapEbayMessage)
        : [],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "eBay-Konversation konnte nicht geladen werden.",
    });
  }
});

app.post("/messages/ebay/send", async (req, res) => {
  try {
    const conversationId = String(req.body?.conversationId || "").trim();
    const messageText = String(req.body?.messageText || "").trim();

    if (!conversationId) {
      return res.status(400).json({ error: "Conversation-ID fehlt." });
    }
    if (!messageText) {
      return res.status(400).json({ error: "Nachricht ist leer." });
    }
    if (messageText.length > 2000) {
      return res.status(400).json({
        error: "eBay-Nachrichten dürfen maximal 2000 Zeichen enthalten.",
      });
    }

    const { payload } = await ebayApiJson(
      "/commerce/message/v1/send_message",
      {
        method: "POST",
        body: JSON.stringify({
          conversationId,
          messageText,
          emailCopyToSender: false,
        }),
      }
    );

    res.status(201).json({
      ok: true,
      messageId: payload?.messageId
        ? String(payload.messageId)
        : undefined,
      conversationId:
        payload?.conversationId
          ? String(payload.conversationId)
          : conversationId,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "eBay-Nachricht konnte nicht gesendet werden.",
    });
  }
});

app.post("/messages/ebay/read", async (req, res) => {
  try {
    const conversationId = String(req.body?.conversationId || "").trim();
    if (!conversationId) {
      return res.status(400).json({ error: "Conversation-ID fehlt." });
    }

    await ebayApiJson(
      "/commerce/message/v1/update_conversation",
      {
        method: "POST",
        body: JSON.stringify({
          conversationId,
          conversationType: "FROM_MEMBERS",
          read: true,
        }),
      }
    );

    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "eBay-Konversation konnte nicht als gelesen markiert werden.",
    });
  }
});

app.post("/ebay/preflight", async (req, res) => {
  try {
    if (!ebayTokenStore) {
      return res.status(401).json({ error: "eBay-Konto ist nicht verbunden." });
    }

    const { draft, sellerProfile, categoryId } = req.body ?? {};
    if (!draft?.title || !sellerProfile?.postalCode || !sellerProfile?.country) {
      return res.status(400).json({ error: "Artikel oder Verkäuferstandort ist unvollständig." });
    }

    const [treeId, policies, locations] = await Promise.all([
      ebayGetCategoryTreeId(),
      ebayGetPolicies(),
      ebayGetLocations(),
    ]);

    const query = [draft?.brand, draft?.model, draft?.title]
      .filter(Boolean)
      .join(" ")
      .slice(0, 350);
    const categories = await ebayGetCategorySuggestions(query, treeId);
    const selectedCategoryId = String(categoryId || categories[0]?.categoryId || "");
    if (!selectedCategoryId) {
      throw new Error("eBay konnte keine passende Kategorie vorschlagen.");
    }

    const [aspects, conditions] = await Promise.all([
      ebayGetCategoryAspects(selectedCategoryId, treeId, draft),
      ebayGetConditions(selectedCategoryId),
    ]);

    const matchingLocation = locations.find((location) =>
      String(location.postalCode || "") === String(sellerProfile.postalCode || "") &&
      String(location.country || "") === String(sellerProfile.country || "")
    );

    const warnings = [];
    if (!policies.fulfillmentPolicies.length) warnings.push("Keine eBay-Versandrichtlinie vorhanden.");
    if (!policies.paymentPolicies.length) warnings.push("Keine eBay-Zahlungsrichtlinie vorhanden.");
    if (!policies.returnPolicies.length) warnings.push("Keine eBay-Rückgaberichtlinie vorhanden.");
    if (!conditions.length) warnings.push("Für diese Kategorie wurden keine Zustände geliefert; eBay kann die Veröffentlichung ablehnen.");

    res.json({
      connected: true,
      marketplaceId: EBAY_MARKETPLACE_ID,
      categoryTreeId: treeId,
      categories,
      selectedCategoryId,
      aspects,
      conditions,
      paymentPolicies: policies.paymentPolicies,
      fulfillmentPolicies: policies.fulfillmentPolicies,
      returnPolicies: policies.returnPolicies,
      locations,
      defaults: {
        sku: makeSku(draft),
        merchantLocationKey: matchingLocation?.merchantLocationKey || makeLocationKey(sellerProfile),
        paymentPolicyId: policies.paymentPolicies[0]?.id || "",
        fulfillmentPolicyId: policies.fulfillmentPolicies[0]?.id || "",
        returnPolicyId: policies.returnPolicies[0]?.id || "",
        condition: defaultConditionFromDraft(draft, conditions),
      },
      warnings,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error instanceof Error ? error.message : "eBay-Vorbereitung fehlgeschlagen." });
  }
});

app.post("/ebay/category-details", async (req, res) => {
  try {
    const { categoryId, draft } = req.body ?? {};
    if (!categoryId) return res.status(400).json({ error: "Kategorie-ID fehlt." });
    const treeId = await ebayGetCategoryTreeId();
    const [aspects, conditions] = await Promise.all([
      ebayGetCategoryAspects(String(categoryId), treeId, draft || {}),
      ebayGetConditions(String(categoryId)),
    ]);
    res.json({ aspects, conditions });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Kategorie-Metadaten fehlgeschlagen." });
  }
});

app.post("/ebay/media/images", upload.array("photos", 12), async (req, res) => {
  try {
    const files = Array.isArray(req.files) ? req.files : [];
    if (!files.length) return res.status(400).json({ error: "Mindestens ein Foto ist erforderlich." });

    const imageUrls = [];
    for (const file of files) {
      imageUrls.push(await uploadImageToEbay(file));
    }
    res.json({ imageUrls });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error instanceof Error ? error.message : "eBay-Bild-Upload fehlgeschlagen." });
  }
});

app.post("/ebay/publish", async (req, res) => {
  try {
    const { draft, platformCopy, sellerProfile, config, imageUrls } = req.body ?? {};
    if (!ebayTokenStore) return res.status(401).json({ error: "eBay-Konto ist nicht verbunden." });
    if (!draft?.price || Number(String(draft.price).replace(",", ".")) <= 0) {
      return res.status(400).json({ error: "Gültiger Verkaufspreis fehlt." });
    }
    if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
      return res.status(400).json({ error: "Mindestens ein eBay-Bild ist erforderlich." });
    }

    const required = [
      ["categoryId", config?.categoryId],
      ["sku", config?.sku],
      ["merchantLocationKey", config?.merchantLocationKey],
      ["paymentPolicyId", config?.paymentPolicyId],
      ["fulfillmentPolicyId", config?.fulfillmentPolicyId],
      ["returnPolicyId", config?.returnPolicyId],
      ["condition", config?.condition],
    ];
    const missing = required.filter(([, value]) => !String(value || "").trim()).map(([name]) => name);
    if (missing.length) {
      return res.status(400).json({ error: `eBay-Pflichtdaten fehlen: ${missing.join(", ")}` });
    }

    await ensureEbayLocation(config.merchantLocationKey, sellerProfile || {});

    const title = String(platformCopy?.title || draft.title || "").trim().slice(0, 80);
    const description = String(platformCopy?.description || draft.description || "").trim();
    const quantity = Math.max(1, Number(config?.quantity || 1));
    const price = Number(String(draft.price).replace(",", "."));
    const aspects = config?.aspects && typeof config.aspects === "object" ? config.aspects : {};
    const nonEmptyAspects = Object.fromEntries(
      Object.entries(aspects).filter(([, values]) =>
        Array.isArray(values) && values.some((value) => String(value || "").trim())
      )
    );
    if (Object.keys(nonEmptyAspects).length === 0) {
      return res.status(400).json({
        error: "eBay verlangt mindestens ein Artikelmerkmal (Aspect).",
      });
    }

    const conditionDescriptionParts = [
      String(draft?.condition || "").trim(),
      ...(Array.isArray(draft?.analysis?.visibleDefects) ? draft.analysis.visibleDefects : []),
    ].filter(Boolean);

    const inventoryBody = {
      availability: { shipToLocationAvailability: { quantity } },
      condition: String(config.condition),
      ...(conditionDescriptionParts.length
        ? { conditionDescription: conditionDescriptionParts.join(" · ").slice(0, 1000) }
        : {}),
      product: {
        title,
        description,
        aspects: nonEmptyAspects,
        imageUrls: imageUrls.slice(0, 24),
      },
    };

    await ebayApiJson(`/sell/inventory/v1/inventory_item/${encodeURIComponent(config.sku)}`, {
      method: "PUT",
      headers: { "Content-Language": sellerProfile?.country === "AT" ? "de-AT" : "de-DE" },
      body: JSON.stringify(inventoryBody),
    });

    const offerBody = {
      sku: String(config.sku),
      marketplaceId: EBAY_MARKETPLACE_ID,
      format: "FIXED_PRICE",
      availableQuantity: quantity,
      categoryId: String(config.categoryId),
      listingDescription: description,
      listingDuration: "GTC",
      listingPolicies: {
        paymentPolicyId: String(config.paymentPolicyId),
        fulfillmentPolicyId: String(config.fulfillmentPolicyId),
        returnPolicyId: String(config.returnPolicyId),
      },
      merchantLocationKey: String(config.merchantLocationKey),
      pricingSummary: {
        price: { value: price.toFixed(2), currency: "EUR" },
      },
    };

    const { payload: offerPayload } = await ebayApiJson("/sell/inventory/v1/offer", {
      method: "POST",
      headers: { "Content-Language": sellerProfile?.country === "AT" ? "de-AT" : "de-DE" },
      body: JSON.stringify(offerBody),
    });

    const offerId = String(offerPayload?.offerId || "");
    if (!offerId) throw new Error("eBay hat keine Offer-ID zurückgegeben.");

    const { payload: publishPayload } = await ebayApiJson(
      `/sell/inventory/v1/offer/${encodeURIComponent(offerId)}/publish`,
      { method: "POST" }
    );
    const listingId = String(publishPayload?.listingId || "");
    if (!listingId) throw new Error("eBay hat keine Listing-ID zurückgegeben.");

    const listingUrl = EBAY_ENV === "production"
      ? `https://www.ebay.de/itm/${listingId}`
      : `https://www.sandbox.ebay.com/itm/${listingId}`;

    res.json({
      ok: true,
      listingId,
      offerId,
      sku: String(config.sku),
      listingUrl,
      imageUrls,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error instanceof Error ? error.message : "eBay-Veröffentlichung fehlgeschlagen." });
  }
});


app.post("/voice-note/transcribe", audioUpload.single("audio"), async (req, res) => {
  try {
    const provider = String(req.body?.provider || "openai");
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: "Keine Sprachaufnahme erhalten." });
    }

    if (provider === "anthropic") {
      return res.status(422).json({
        error:
          "Für Claude ist in diesem MVP keine direkte Audio-Transkription aktiviert. Bitte OpenAI oder Gemini wählen oder die Zusatzangabe manuell eintippen.",
      });
    }

    if (provider === "openai") {
      if (!process.env.OPENAI_API_KEY) {
        return res.status(503).json({ error: "OpenAI ist nicht konfiguriert." });
      }

      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const nativeFile = new File([file.buffer], file.originalname || "voice.m4a", {
        type: file.mimetype || "audio/mp4",
      });

      const result = await openai.audio.transcriptions.create({
        file: nativeFile,
        model: process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe",
        language: "de",
      });

      return res.json({ text: result.text || "" });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ error: "Gemini ist nicht konfiguriert." });
    }

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/` +
      `${encodeURIComponent(PROVIDERS.gemini.model)}:generateContent?key=` +
      encodeURIComponent(process.env.GEMINI_API_KEY);

    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text:
                  "Transkribiere diese deutsche Sprachaufnahme wortgetreu als kurzen Klartext. " +
                  "Keine Kommentare, keine Zusammenfassung.",
              },
              {
                inlineData: {
                  mimeType: file.mimetype || "audio/mp4",
                  data: file.buffer.toString("base64"),
                },
              },
            ],
          },
        ],
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.error?.message || `Gemini-Fehler ${response.status}`);
    }

    const text =
      payload?.candidates?.[0]?.content?.parts
        ?.map((part) => part?.text || "")
        .join("\n")
        .trim() || "";

    res.json({ text });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error:
        error instanceof Error ? error.message : "Sprachtranskription fehlgeschlagen.",
    });
  }
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/providers", (_req, res) => {
  res.json({
    providers: Object.values(PROVIDERS),
  });
});


app.post("/photo-audit", upload.array("photos", 12), async (req, res) => {
  try {
    const files = Array.isArray(req.files) ? req.files : [];
    const provider = String(req.body?.provider || "openai");
    const roles = (() => {
      try {
        const parsed = JSON.parse(String(req.body?.photoRoles || "[]"));
        return Array.isArray(parsed)
          ? files.map((_, index) => String(parsed[index] || "general"))
          : files.map(() => "general");
      } catch {
        return files.map(() => "general");
      }
    })();

    if (!files.length) {
      return res.status(400).json({ error: "Keine Fotos für den Foto-Check erhalten." });
    }

    let result;
    if (provider === "openai") {
      result = await photoAuditWithOpenAI(files, roles);
    } else if (provider === "anthropic") {
      result = await photoAuditWithAnthropic(files, roles);
    } else if (provider === "gemini") {
      result = await photoAuditWithGemini(files, roles);
    } else {
      return res.status(400).json({ error: "Unbekannter KI-Anbieter." });
    }

    res.json(validatePhotoAudit(result, files.length));
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error:
        error instanceof Error ? error.message : "Foto-Check fehlgeschlagen.",
    });
  }
});

app.post("/analyze", upload.array("photos", 12), async (req, res) => {
  try {
    const files = Array.isArray(req.files) ? req.files : [];
    const provider = String(req.body?.provider || "openai");
    const metadata = {
      barcode: String(req.body?.barcode || "").trim(),
      voiceNotes: String(req.body?.voiceNotes || "").trim(),
      photoRoles: (() => {
        try {
          const parsed = JSON.parse(String(req.body?.photoRoles || "[]"));
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      })(),
    };

    if (files.length === 0) {
      return res.status(400).json({
        error: "Mindestens ein Foto ist erforderlich.",
      });
    }

    if (!Object.prototype.hasOwnProperty.call(PROVIDERS, provider)) {
      return res.status(400).json({
        error: "Unbekannter KI-Anbieter.",
      });
    }

    let result;

    if (provider === "openai") {
      result = await analyzeWithOpenAI(files, metadata);
    } else if (provider === "anthropic") {
      result = await analyzeWithAnthropic(files, metadata);
    } else {
      result = await analyzeWithGemini(files, metadata);
    }

    res.json({
      ...result,
      aiProvider: provider,
      aiModel: PROVIDERS[provider].model,
    });
  } catch (error) {
    console.error(error);

    if (error instanceof multer.MulterError) {
      const message =
        error.code === "LIMIT_FILE_SIZE"
          ? "Ein Foto ist größer als 8 MB."
          : error.code === "LIMIT_FILE_COUNT"
            ? "Maximal 12 Fotos sind erlaubt."
            : "Fehler beim Hochladen der Fotos.";

      return res.status(400).json({ error: message });
    }

    const message =
      error instanceof Error ? error.message : "Unbekannter Analysefehler.";

    res.status(500).json({ error: message });
  }
});

function buildSearchQueries(analysis, fallbackTitle = "") {
  const terms =
    Array.isArray(analysis?.searchTerms) && analysis.searchTerms.length > 0
      ? analysis.searchTerms.filter(Boolean).join(" ")
      : fallbackTitle;

  const encoded = encodeURIComponent(terms);

  return [
    {
      platform: "kleinanzeigen",
      query: terms,
      url: `https://www.kleinanzeigen.de/s-suchanfrage.html?keywords=${encoded}`,
    },
    {
      platform: "ebay",
      query: terms,
      url: `https://www.ebay.de/sch/i.html?_nkw=${encoded}`,
    },
  ];
}

function calculatePriceSuggestion({ analysis, title, comparables }) {
  const validPrices = (Array.isArray(comparables) ? comparables : [])
    .map((entry) => Number(entry?.price))
    .filter((price) => Number.isFinite(price) && price > 0)
    .sort((a, b) => a - b);

  const searchQueries = buildSearchQueries(
    analysis,
    title || analysis?.title || ""
  );

  if (validPrices.length === 0) {
    return {
      sellFast: 0,
      marketTypical: 0,
      startHigh: 0,
      currency: "EUR",
      confidence: 0.2,
      basedOn: "ai_estimate",
      sourceCount: 0,
      reasoning:
        "Noch keine Vergleichspreise vorhanden. Nutze zuerst die Suchlinks und trage einige ähnliche Angebote manuell ein.",
      suggestedPriceType: "VB",
      searchQueries,
    };
  }

  const median =
    validPrices.length % 2 === 1
      ? validPrices[(validPrices.length - 1) / 2]
      : (validPrices[validPrices.length / 2 - 1] +
          validPrices[validPrices.length / 2]) /
        2;

  const sellFast = Math.max(1, Math.round(median * 0.85));
  const marketTypical = Math.max(1, Math.round(median));
  const startHigh = Math.max(1, Math.round(median * 1.12));

  return {
    sellFast,
    marketTypical,
    startHigh,
    currency: "EUR",
    confidence: Math.min(0.9, 0.45 + validPrices.length * 0.08),
    basedOn: "manual_comparables",
    sourceCount: validPrices.length,
    reasoning:
      `Empfehlung aus ${validPrices.length} Vergleichspreis` +
      `${validPrices.length === 1 ? "" : "en"}: Median ${marketTypical} €. ` +
      `Für schnellen Verkauf eher ${sellFast} €, marktüblich ${marketTypical} €, höher ansetzen ${startHigh} € VB.`,
    suggestedPriceType: "VB",
    searchQueries,
  };
}


app.post("/platform-copies", async (req, res) => {
  try {
    const { provider = "openai", platformIds, draft, sellerProfile } = req.body ?? {};

    if (!Object.prototype.hasOwnProperty.call(PROVIDERS, provider)) {
      return res.status(400).json({ error: "Unbekannter KI-Anbieter." });
    }
    if (!Array.isArray(platformIds) || platformIds.length === 0) {
      return res.status(400).json({ error: "Mindestens eine Plattform ist erforderlich." });
    }
    if (!draft?.title || !draft?.description) {
      return res.status(400).json({ error: "Master-Entwurf ist unvollständig." });
    }

    const result = await generateStructuredText(
      provider,
      platformCopyPrompt(draft, platformIds, sellerProfile),
      platformCopySchema,
      "platform_listing_copies"
    );

    const copies = Array.isArray(result?.copies)
      ? result.copies.filter((copy) => platformIds.includes(copy?.platformId))
      : [];

    if (copies.length === 0) {
      throw new Error("Die KI hat keine Plattformtexte geliefert.");
    }

    res.json({ copies, provider, model: PROVIDERS[provider].model });
  } catch (error) {
    console.error(error);
    const message =
      error instanceof Error
        ? error.message
        : "Fehler beim Erstellen der Plattformtexte.";
    res.status(500).json({ error: message });
  }
});

app.post("/price-suggest", async (req, res) => {
  try {
    const { analysis, title, comparables } = req.body ?? {};

    if (!analysis && !title) {
      return res.status(400).json({
        error: "Es fehlen Artikeldaten für die Preisermittlung.",
      });
    }

    const result = calculatePriceSuggestion({
      analysis,
      title,
      comparables,
    });

    res.json(result);
  } catch (error) {
    console.error(error);
    const message =
      error instanceof Error
        ? error.message
        : "Fehler bei der Preisermittlung.";
    res.status(500).json({ error: message });
  }
});

app.use((error, _req, res, _next) => {
  const message =
    error instanceof Error ? error.message : "Ungültige Anfrage.";
  res.status(400).json({ error: message });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Verkaufsassistent-Backend läuft auf Port ${port}`);
});
