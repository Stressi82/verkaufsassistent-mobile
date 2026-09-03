import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { StatusBar } from "expo-status-bar";
import { PhotoTile } from "./src/components/PhotoTile";
import { SalesCenter } from "./src/components/SalesCenter";
import { UserPreferencesScreen } from "./src/components/UserPreferencesScreen";
import { CrosspostingStatusPanel } from "./src/components/CrosspostingStatusPanel";
import { ShippingAssistant } from "./src/components/ShippingAssistant";
import { LifecyclePanel } from "./src/components/LifecyclePanel";
import { PlatformCleanupPanel } from "./src/components/PlatformCleanupPanel";
import { InboxScreen } from "./src/components/InboxScreen";
import { BarcodeScanner } from "./src/components/BarcodeScanner";
import { VoiceNoteInput } from "./src/components/VoiceNoteInput";
import { BatchSelling } from "./src/components/BatchSelling";
import { PhotoAuditPanel } from "./src/components/PhotoAuditPanel";
import { BatchItem } from "./src/types/batch";
import { PhotoAuditResult } from "./src/types/photoAudit";
import { auditPhotos, demoPhotoAudit } from "./src/services/photoAudit";
import {
  ListingRecord,
  PlatformListingStatus,
} from "./src/types/salesCenter";
import { canTransition, ListingStatus } from "./src/types/lifecycle";
import {
  createInitialLifecycle,
  createLifecycleForStatus,
  transitionListing,
} from "./src/services/lifecycle";
import { loadListings, removeListing, upsertListing } from "./src/services/listingStore";
import { PlatformCopyCard } from "./src/components/PlatformCopyCard";
import { EbayPublishPanel } from "./src/components/EbayPublishPanel";
import { EbayDiagnosticsPanel } from "./src/components/EbayDiagnosticsPanel";
import { analyzePhotos } from "./src/services/analyze";
import { suggestPrice } from "./src/services/pricing";
import { getProviders } from "./src/services/providers";
import {
  listingReadiness,
  SALES_PLATFORMS,
  shareListingDraft,
} from "./src/services/platforms";
import { recommendPlatforms } from "./src/services/platformRecommendations";
import { generatePlatformCopies } from "./src/services/platformCopy";
import { AIProviderId, AIProviderInfo } from "./src/types/ai";
import {
  ComparableListing,
  ListingDraft,
  PhotoItem,
  PriceSuggestion,
} from "./src/types/listing";
import { SalesPlatformId } from "./src/types/platform";
import { PlatformPublication } from "./src/types/platformCleanup";
import { RecommendationResult } from "./src/types/recommendation";
import { PlatformCopy } from "./src/types/platformCopy";
import {
  DEFAULT_SELLER_PROFILE,
  PAYMENT_LABELS,
  PaymentMethod,
  SellerProfile,
  SHIPPING_LABELS,
} from "./src/types/seller";
import { EbayPublishResult, EbayStatus } from "./src/types/ebay";
import {
  DEFAULT_SHIPPING_PACKAGE,
  ShippingPackageInput,
  ShippingQuote,
} from "./src/types/shipping";
import {
  SALES_GOAL_LABELS,
  UserPreferences,
} from "./src/types/userPreferences";
import {
  DEFAULT_PREFERENCES,
  loadPreferences,
  savePreferences,
} from "./src/services/preferencesStore";
import { goalPriceFromSuggestion } from "./src/services/salesIntelligence";
import { observePushNavigation } from "./src/services/pushNotifications";
import { sellerProfileReadiness } from "./src/services/seller";
import { connectEbay, disconnectEbay, getEbayStatus } from "./src/services/ebay";
import {
  DEMO_DRAFT,
  DEMO_PHOTOS,
  DEMO_PRICE,
  DEMO_SELLER,
} from "./src/services/demoData";

type Step = "home" | "inbox" | "settings" | "cleanup" | "batch" | "photos" | "scanner" | "analyzing" | "draft" | "pricing" | "seller" | "platforms";

const MAX_PHOTOS = 12;
const newId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export default function App() {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [step, setStep] = useState<Step>("home");
  const [draft, setDraft] = useState<ListingDraft | null>(null);

  const [providers, setProviders] = useState<AIProviderInfo[]>([]);
  const [providerLoading, setProviderLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState<AIProviderId>("openai");

  const [priceSuggestion, setPriceSuggestion] = useState<PriceSuggestion | null>(null);
  const [comparables, setComparables] = useState<ComparableListing[]>([]);
  const [comparableTitle, setComparableTitle] = useState("");
  const [comparablePrice, setComparablePrice] = useState("");
  const [comparablePlatform, setComparablePlatform] = useState<
    "kleinanzeigen" | "ebay" | "other"
  >("kleinanzeigen");
  const [pricingBusy, setPricingBusy] = useState(false);

  const [selectedPlatforms, setSelectedPlatforms] = useState<SalesPlatformId[]>([
    "kleinanzeigen",
    "ebay",
    "facebook",
  ]);
  const [platformCountry, setPlatformCountry] = useState<"DE" | "AT" | "ALL">("DE");
  const [showMorePlatforms, setShowMorePlatforms] = useState(false);
  const [platformRecommendation, setPlatformRecommendation] =
    useState<RecommendationResult | null>(null);

  const [platformCopies, setPlatformCopies] = useState<
    Partial<Record<SalesPlatformId, PlatformCopy>>
  >({});
  const [platformCopyBusy, setPlatformCopyBusy] = useState(false);
  const [sellerProfile, setSellerProfile] = useState<SellerProfile>(
    DEFAULT_SELLER_PROFILE
  );
  const [ebayStatus, setEbayStatus] = useState<EbayStatus | null>(null);
  const [ebayBusy, setEbayBusy] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [savedListings, setSavedListings] = useState<ListingRecord[]>([]);
  const [currentListingId, setCurrentListingId] = useState<string | null>(null);
  const [barcode, setBarcode] = useState("");
  const [voiceNotes, setVoiceNotes] = useState("");
  const [photoAudit, setPhotoAudit] = useState<PhotoAuditResult | null>(null);
  const [photoAuditBusy, setPhotoAuditBusy] = useState(false);
  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false);
  const [batchBusy, setBatchBusy] = useState(false);
  const [batchProgress, setBatchProgress] = useState("");
  const [preferences, setPreferences] =
    useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [preferencesDraft, setPreferencesDraft] =
    useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [currentPlatformStatuses, setCurrentPlatformStatuses] = useState<
    Partial<Record<SalesPlatformId, PlatformListingStatus>>
  >({});
  const [shippingPackage, setShippingPackage] =
    useState<ShippingPackageInput>(DEFAULT_SHIPPING_PACKAGE);
  const [shippingSelection, setShippingSelection] =
    useState<ShippingQuote | null>(null);
  const [cleanupRecordId, setCleanupRecordId] = useState<string | null>(null);
  const [pushConversationId, setPushConversationId] = useState<string | null>(null);

  useEffect(() => {
    loadListings().then(setSavedListings).catch(() => setSavedListings([]));
  }, []);

  useEffect(() => {
    return observePushNavigation((conversationId) => {
      setPushConversationId(conversationId || null);
      setStep("inbox");
    });
  }, []);

  useEffect(() => {
    loadPreferences()
      .then((loaded) => {
        setPreferences(loaded);
        setPreferencesDraft(loaded);
        setSelectedProvider(loaded.preferredProvider);
        setSelectedPlatforms(loaded.preferredPlatforms);
        setSellerProfile(loaded.sellerProfile);
        setPlatformCountry(loaded.sellerProfile.country);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    let active = true;

    getProviders()
      .then((result) => {
        if (!active) return;
        setProviders(result);

        const preferred = result.find(
          (provider) =>
            provider.id === preferences.preferredProvider &&
            provider.configured
        );
        const firstConfigured = result.find((provider) => provider.configured);
        if (preferred) {
          setSelectedProvider(preferred.id);
        } else if (firstConfigured) {
          setSelectedProvider(firstConfigured.id);
        }
      })
      .finally(() => {
        if (active) setProviderLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (step !== "platforms" || !draft) return;

    const result = recommendPlatforms(draft, platformCountry);
    setPlatformRecommendation(result);
    const recommendedPlatforms = result.recommendations
      .filter((entry) => entry.recommended)
      .map((entry) => entry.platformId);

    setSelectedPlatforms(recommendedPlatforms);
    setCurrentPlatformStatuses((current) => {
      const next: Partial<Record<SalesPlatformId, PlatformListingStatus>> = {};
      recommendedPlatforms.forEach((id) => {
        next[id] = current[id] || "prepared";
      });
      return next;
    });
  }, [step, draft?.title, draft?.category, draft?.brand, draft?.model, platformCountry]);

  const remaining = MAX_PHOTOS - photos.length;
  const coverPhoto = useMemo(() => photos[0], [photos]);
  const selectedProviderInfo = providers.find(
    (provider) => provider.id === selectedProvider
  );

  const privacyBlocked = Boolean(
    photoAudit &&
      (!photoAudit.privacyScanComplete || photoAudit.hasBlockingPrivacyRisk) &&
      !privacyAcknowledged
  );

  const appendUris = (
    uris: string[],
    role: "general" | "typeplate" | "damage" | "accessories" = "general"
  ) => {
    const available = Math.max(0, MAX_PHOTOS - photos.length);
    const next = uris
      .slice(0, available)
      .map((uri) => ({ id: newId(), uri, role }));
    setPhotos((current) => [...current, ...next]);
    setPhotoAudit(null);
    setPrivacyAcknowledged(false);
  };

  const takePhoto = async () => {
    if (remaining <= 0) return;
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Kamerazugriff fehlt",
        "Bitte erlaube den Kamerazugriff in den Einstellungen."
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.9,
      cameraType: ImagePicker.CameraType.back,
    });

    if (!result.canceled) appendUris(result.assets.map((asset) => asset.uri));
  };

  const takeTypeplatePhoto = async () => {
    if (remaining <= 0) return;

    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Kamerazugriff fehlt", "Bitte erlaube den Kamerazugriff.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 1,
      cameraType: ImagePicker.CameraType.back,
    });

    if (!result.canceled) {
      appendUris(
        result.assets.map((asset) => asset.uri),
        "typeplate"
      );
    }
  };

  const choosePhotos = async () => {
    if (remaining <= 0) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      orderedSelection: true,
      selectionLimit: remaining,
      quality: 0.9,
    });

    if (!result.canceled) appendUris(result.assets.map((asset) => asset.uri));
  };

  const removePhoto = (id: string) => {
    setPhotos((current) => current.filter((photo) => photo.id !== id));
    setPhotoAudit(null);
    setPrivacyAcknowledged(false);
  };

  const makeCover = (id: string) => {
    setPhotos((current) => {
      const target = current.find((photo) => photo.id === id);
      if (!target) return current;
      return [target, ...current.filter((photo) => photo.id !== id)];
    });
  };

  const runPhotoAudit = async () => {
    if (!photos.length) {
      Alert.alert("Foto-Check", "Füge zuerst mindestens ein Foto hinzu.");
      return;
    }

    setPhotoAuditBusy(true);
    setPrivacyAcknowledged(false);
    try {
      const result = demoMode
        ? demoPhotoAudit(photos.length)
        : await auditPhotos(photos, selectedProvider);
      setPhotoAudit(result);

      const recommended = photos[result.recommendedCoverIndex];
      if (recommended) {
        setPhotos((current) => [
          { ...recommended, role: "cover" },
          ...current
            .filter((photo) => photo.id !== recommended.id)
            .map((photo) =>
              photo.role === "cover"
                ? { ...photo, role: "general" as const }
                : photo
            ),
        ]);
      }
    } catch (error) {
      Alert.alert(
        "Foto-Check",
        error instanceof Error ? error.message : "Foto-Check fehlgeschlagen."
      );
    } finally {
      setPhotoAuditBusy(false);
    }
  };

  const applyRecommendedCover = () => {
    if (!photoAudit || !photos.length) return;
    const target = photos[photoAudit.recommendedCoverIndex];
    if (!target) return;

    setPhotos((current) => [
      { ...target, role: "cover" },
      ...current
        .filter((photo) => photo.id !== target.id)
        .map((photo) =>
          photo.role === "cover" ? { ...photo, role: "general" as const } : photo
        ),
    ]);
    Alert.alert(
      "Titelbild",
      `Foto ${photoAudit.recommendedCoverIndex + 1} wurde als Titelbild übernommen.`
    );
  };

  const resetCurrentListing = () => {
    setCurrentListingId(null);
    setPhotos([]);
    setDraft(null);
    setPriceSuggestion(null);
    setComparables([]);
    setSellerProfile(preferences.sellerProfile);
    setSelectedProvider(preferences.preferredProvider);
    setSelectedPlatforms(preferences.preferredPlatforms);
    setPlatformCountry(preferences.sellerProfile.country);
    setCurrentPlatformStatuses(
      Object.fromEntries(
        preferences.preferredPlatforms.map((id) => [id, "prepared"])
      ) as Partial<Record<SalesPlatformId, PlatformListingStatus>>
    );
    setPlatformCopies({});
    setBarcode("");
    setVoiceNotes("");
    setPhotoAudit(null);
    setPrivacyAcknowledged(false);
    setShippingPackage(DEFAULT_SHIPPING_PACKAGE);
    setShippingSelection(null);
    setDemoMode(false);
  };

  const startNewListing = () => {
    resetCurrentListing();
    setStep("photos");
  };

  const openSavedListing = (record: ListingRecord) => {
    setCurrentListingId(record.id);
    setPhotos(record.photos);
    setDraft(record.draft);
    setSellerProfile(record.sellerProfile);
    setSelectedProvider(record.selectedProvider);
    setBarcode(record.draft.barcode || "");
    setVoiceNotes(record.draft.voiceNotes || "");
    setPhotoAudit(record.photoAudit || null);
    setPrivacyAcknowledged(Boolean(record.privacyAcknowledged));
    setShippingPackage(record.shippingPackage || DEFAULT_SHIPPING_PACKAGE);
    setShippingSelection(record.shippingSelection || null);
    setSelectedPlatforms(
      Object.entries(record.platformStatuses)
        .filter(([, status]) => status !== "not_selected")
        .map(([id]) => id as SalesPlatformId)
    );
    setCurrentPlatformStatuses(record.platformStatuses || {});
    setPlatformCopies({});
    setStep("draft");
  };

  const saveCurrentListing = async (
    status: ListingStatus = "draft"
  ): Promise<void> => {
    if (!draft) {
      Alert.alert("Entwurf", "Noch keine Anzeige vorhanden.");
      return;
    }

    const now = new Date().toISOString();
    const id = currentListingId || `listing-${Date.now()}`;
    const existing = savedListings.find((record) => record.id === id);

    if (
      status === "online" &&
      !selectedPlatforms.some(
        (platformId) => currentPlatformStatuses[platformId] === "online"
      )
    ) {
      Alert.alert(
        "Crossposting",
        "Markiere im Crossposting-Bereich mindestens eine Plattform als „Online“."
      );
      return;
    }

    const platformStatuses = Object.fromEntries(
      selectedPlatforms.map((platformId) => {
        const current = currentPlatformStatuses[platformId] || "prepared";
        const nextStatus = current;
        return [platformId, nextStatus];
      })
    ) as ListingRecord["platformStatuses"];

    const previousPrice = existing?.draft.price || "";
    const priceChanged =
      Boolean(draft.price) &&
      (!existing || previousPrice !== draft.price || existing.draft.priceType !== draft.priceType);

    const priceHistory = [
      ...(existing?.priceHistory || []),
      ...(priceChanged
        ? [
            {
              value: draft.price,
              priceType: draft.priceType,
              changedAt: now,
            },
          ]
        : []),
    ];

    const firstOnlineAt =
      existing?.firstOnlineAt ||
      (status === "online" ? now : null);

    const baseStatus = existing?.status || status;
    let next: ListingRecord = {
      id,
      draft: {
        ...draft,
        barcode,
        voiceNotes,
      },
      photos,
      status: baseStatus,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      soldAt: existing?.soldAt || null,
      firstOnlineAt,
      priceHistory,
      selectedProvider,
      sellerProfile,
      platformStatuses,
      photoAudit,
      privacyAcknowledged,
      shippingPackage,
      shippingSelection,
      lifecycleHistory:
        existing?.lifecycleHistory ||
        createLifecycleForStatus(baseStatus, existing?.createdAt || now),
      platformPublications: existing?.platformPublications || {},
      saleSource: existing?.saleSource || null,
    };

    if (existing && existing.status !== status) {
      if (!canTransition(existing.status, status)) {
        Alert.alert(
          "Statuswechsel",
          `Der direkte Wechsel von ${existing.status} zu ${status} ist nicht vorgesehen.`
        );
        return;
      }

      next = transitionListing(
        next,
        status,
        "Status im Verkaufsablauf geändert"
      );
    } else if (!existing) {
      next = {
        ...next,
        status,
        soldAt: status === "sold" ? now : null,
      };
    }

    const records = await upsertListing(savedListings, next);
    setSavedListings(records);
    setCurrentListingId(id);
    setCurrentPlatformStatuses(platformStatuses);
  };

  const updateSavedStatus = async (
    record: ListingRecord,
    status: ListingStatus
  ) => {
    try {
      let next = transitionListing(record, status);

      if (status === "online") {
        const currentOnline = Object.values(next.platformStatuses).some(
          (entry) => entry === "online"
        );

        if (!currentOnline) {
          const firstPlatform = Object.keys(next.platformStatuses)[0] as
            | SalesPlatformId
            | undefined;

          if (firstPlatform) {
            next = {
              ...next,
              platformStatuses: {
                ...next.platformStatuses,
                [firstPlatform]: "online",
              },
            };
          }
        }
      }


      if (status === "removed") {
        next = {
          ...next,
          platformStatuses: Object.fromEntries(
            Object.entries(next.platformStatuses).map(([id, platformStatus]) => [
              id,
              platformStatus === "online" ? "removed" : platformStatus,
            ])
          ) as ListingRecord["platformStatuses"],
        };
      }

      setSavedListings(await upsertListing(savedListings, next));
    } catch (error) {
      Alert.alert(
        "Statuswechsel",
        error instanceof Error ? error.message : "Status konnte nicht geändert werden."
      );
    }
  };

  const deleteSavedListing = async (record: ListingRecord) => {
    setSavedListings(await removeListing(savedListings, record.id));
  };

  const loadSalesCenterDemo = async () => {
    const now = new Date();
    const create = (
      id: string,
      title: string,
      price: string,
      status: ListingStatus,
      offsetDays: number,
      platforms: SalesPlatformId[]
    ): ListingRecord => {
      const date = new Date(now.getTime() - offsetDays * 86400000).toISOString();
      return {
        id,
        draft: {
          ...DEMO_DRAFT,
          title,
          price,
          barcode: "3165140000000",
        },
        photos: DEMO_PHOTOS,
        status,
        createdAt: date,
        updatedAt: date,
        soldAt: status === "sold" ? date : null,
        firstOnlineAt: status === "online" ? date : null,
        priceHistory: price
          ? [{ value: price, priceType: "VB", changedAt: date }]
          : [],
        selectedProvider: "openai",
        sellerProfile: DEMO_SELLER,
        photoAudit: demoPhotoAudit(DEMO_PHOTOS.length),
        privacyAcknowledged: false,
        shippingPackage: null,
        shippingSelection: null,
        lifecycleHistory: createLifecycleForStatus(status, date),
        platformStatuses: Object.fromEntries(
          platforms.map((platform) => [
            platform,
            status === "sold" || status === "online" ? "online" : "prepared",
          ])
        ),
      };
    };

    const demoRecords = [
      create(
        "demo-center-1",
        "Bosch Professional 18V Akkuschrauber",
        "69",
        "online",
        9,
        ["kleinanzeigen", "ebay", "facebook"]
      ),
      create(
        "demo-center-2",
        "Kaffeemaschine – Entwurf",
        "45",
        "draft",
        0,
        ["kleinanzeigen"]
      ),
      create(
        "demo-center-3",
        "LEGO Konvolut",
        "35",
        "sold",
        8,
        ["kleinanzeigen", "vinted"]
      ),
    ] as ListingRecord[];

    await Promise.all([]);
    const records = [...demoRecords, ...savedListings.filter(
      (item) => !item.id.startsWith("demo-center-")
    )];
    // Direct save through upsert to keep implementation simple.
    let current = savedListings.filter((item) => !item.id.startsWith("demo-center-"));
    for (const record of demoRecords) {
      current = await upsertListing(current, record);
    }
    setSavedListings(current);
  };

  const processBatchItems = async (items: BatchItem[]) => {
    if (!items.length) return;

    if (!selectedProviderInfo?.configured && !demoMode) {
      Alert.alert(
        "KI noch nicht verbunden",
        "Für den automatischen Stapelverkauf muss mindestens eine KI auf dem Backend verbunden sein."
      );
      return;
    }

    setBatchBusy(true);
    try {
      let records = savedListings;

      for (const [index, item] of items.entries()) {
        setBatchProgress(
          `Artikel ${index + 1} von ${items.length}: ${item.label || "wird analysiert"}`
        );

        let batchAudit: PhotoAuditResult | null = null;
        let batchPhotos = item.photos;

        try {
          batchAudit = await auditPhotos(item.photos, selectedProvider);
          const recommended = item.photos[batchAudit.recommendedCoverIndex];
          if (recommended) {
            batchPhotos = [
              { ...recommended, role: "cover" },
              ...item.photos
                .filter((photo) => photo.id !== recommended.id)
                .map((photo) =>
                  photo.role === "cover"
                    ? { ...photo, role: "general" as const }
                    : photo
                ),
            ];
          }
        } catch {
          batchAudit = null;
        }

        let batchDraft: ListingDraft;
        try {
          batchDraft = await analyzePhotos(
            batchPhotos,
            selectedProvider,
            {
              barcode: item.barcode,
              voiceNotes: item.voiceNotes,
            }
          );
        } catch (error) {
          batchDraft = {
            title: item.label || `Artikel ${index + 1}`,
            description:
              "Automatische Analyse war nicht verfügbar. Bitte diesen Entwurf später öffnen und erneut analysieren.",
            category: "",
            brand: "",
            model: "",
            condition: "",
            price: "",
            priceType: "VB",
          };
        }

        if (
          item.label &&
          (!batchDraft.title.trim() ||
            batchDraft.title.toLowerCase().includes("nicht sicher"))
        ) {
          batchDraft.title = item.label;
        }

        const now = new Date().toISOString();
        const record: ListingRecord = {
          id: `batch-${Date.now()}-${index}`,
          draft: batchDraft,
          photos: batchPhotos,
          status: "draft",
          createdAt: now,
          updatedAt: now,
          soldAt: null,
          selectedProvider,
          sellerProfile,
          platformStatuses: {},
          photoAudit: batchAudit,
          privacyAcknowledged: false,
          shippingPackage: null,
          shippingSelection: null,
          lifecycleHistory: createInitialLifecycle("draft", now),
        };

        records = await upsertListing(records, record);
      }

      setSavedListings(records);
      setBatchProgress("");
      setStep("home");
      Alert.alert(
        "Stapel gespeichert",
        `${items.length} Artikel wurden als Entwürfe in der Verkaufszentrale angelegt.`
      );
    } finally {
      setBatchBusy(false);
      setBatchProgress("");
    }
  };

  const loadBatchDemo = async () => {
    const labels = [
      "Bosch Akkuschrauber",
      "Kaffeemaschine",
      "LEGO Konvolut",
    ];
    const items: BatchItem[] = labels.map((label, index) => ({
      id: `batch-demo-${index}`,
      label,
      photos: DEMO_PHOTOS.map((photo, photoIndex) => ({
        ...photo,
        id: `batch-demo-${index}-${photoIndex}`,
      })),
    }));

    setBatchBusy(true);
    try {
      let records = savedListings;
      for (const [index, item] of items.entries()) {
        setBatchProgress(`Demo ${index + 1} von ${items.length}`);
        const now = new Date().toISOString();
        const record: ListingRecord = {
          id: `batch-demo-record-${index}`,
          draft: {
            ...DEMO_DRAFT,
            title: item.label,
            price: index === 0 ? "69" : index === 1 ? "45" : "35",
          },
          photos: item.photos,
          status: "draft",
          createdAt: now,
          updatedAt: now,
          soldAt: null,
          selectedProvider,
          sellerProfile: DEMO_SELLER,
          platformStatuses: {},
          photoAudit: demoPhotoAudit(item.photos.length),
          privacyAcknowledged: false,
          shippingPackage: null,
          shippingSelection: null,
          lifecycleHistory: createInitialLifecycle("draft", now),
        };
        records = await upsertListing(records, record);
      }
      setSavedListings(records);
      setStep("home");
      Alert.alert("Demo-Stapel", "3 Beispielartikel wurden als Entwürfe angelegt.");
    } finally {
      setBatchBusy(false);
      setBatchProgress("");
    }
  };

  const openCleanup = (record: ListingRecord) => {
    setCleanupRecordId(record.id);
    setStep("cleanup");
  };

  const updateCleanupRecord = async (record: ListingRecord) => {
    const records = await upsertListing(savedListings, record);
    setSavedListings(records);
  };

  const handleEbayPublished = async (result: EbayPublishResult) => {
    if (!draft) return;

    const now = new Date().toISOString();
    const id = currentListingId || `listing-${Date.now()}`;
    const existing = savedListings.find((record) => record.id === id);

    const publication: PlatformPublication = {
      platformId: "ebay",
      externalListingId: result.listingId,
      externalOfferId: result.offerId,
      externalSku: result.sku,
      listingUrl: result.listingUrl,
      publishedAt: now,
      state: "online",
      removedAt: null,
    };

    const nextStatuses = {
      ...(existing?.platformStatuses || currentPlatformStatuses),
      ebay: "online" as const,
    };

    const baseStatus = existing?.status || "online";
    let next: ListingRecord = {
      id,
      draft: { ...draft, barcode, voiceNotes },
      photos,
      status: baseStatus,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      soldAt: existing?.soldAt || null,
      firstOnlineAt: existing?.firstOnlineAt || now,
      priceHistory:
        existing?.priceHistory ||
        (draft.price
          ? [{ value: draft.price, priceType: draft.priceType, changedAt: now }]
          : []),
      selectedProvider,
      sellerProfile,
      platformStatuses: nextStatuses,
      photoAudit,
      privacyAcknowledged,
      shippingPackage,
      shippingSelection,
      lifecycleHistory:
        existing?.lifecycleHistory ||
        createLifecycleForStatus("online", now),
      platformPublications: {
        ...(existing?.platformPublications || {}),
        ebay: publication,
      },
      saleSource: existing?.saleSource || null,
    };

    if (existing && existing.status !== "online") {
      if (existing.status === "draft") {
        next = transitionListing(next, "prepared", "eBay-Veröffentlichung vorbereitet");
        next = transitionListing(next, "online", "eBay veröffentlicht");
      } else if (canTransition(existing.status, "online")) {
        next = transitionListing(next, "online", "eBay veröffentlicht");
      }
    }

    const records = await upsertListing(savedListings, next);
    setSavedListings(records);
    setCurrentListingId(id);
    setCurrentPlatformStatuses(nextStatuses);
  };

  const openSettings = () => {
    setPreferencesDraft(preferences);
    setStep("settings");
  };

  const persistPreferences = async () => {
    if (preferencesDraft.preferredPlatforms.length === 0) {
      Alert.alert(
        "Plattformen",
        "Wähle mindestens eine bevorzugte Verkaufsplattform."
      );
      return;
    }

    await savePreferences(preferencesDraft);
    setPreferences(preferencesDraft);
    setSelectedProvider(preferencesDraft.preferredProvider);
    setSellerProfile(preferencesDraft.sellerProfile);
    setSelectedPlatforms(preferencesDraft.preferredPlatforms);
    setPlatformCountry(preferencesDraft.sellerProfile.country);
    setStep("home");
    Alert.alert("Gespeichert", "Deine persönlichen Standards wurden gespeichert.");
  };

  const updateCurrentPlatformStatus = (
    platformId: SalesPlatformId,
    status: PlatformListingStatus
  ) => {
    setCurrentPlatformStatuses((current) => ({
      ...current,
      [platformId]: status,
    }));
  };

  const startDemo = () => {
    setDemoMode(true);
    setPhotos(DEMO_PHOTOS);
    setDraft(null);
    setPriceSuggestion(null);
    setComparables([
      { title: "Bosch 18V Set", price: 59, platform: "kleinanzeigen" },
      { title: "Bosch Professional 18V", price: 65, platform: "ebay" },
      { title: "Bosch Akkuschrauber Set", price: 69, platform: "kleinanzeigen" },
      { title: "Bosch 18V gebraucht", price: 75, platform: "ebay" },
      { title: "Bosch Professional Set", price: 79, platform: "other" },
    ]);
    setSellerProfile(DEMO_SELLER);
    setSelectedProvider("openai");
    setSelectedPlatforms(["kleinanzeigen", "ebay", "facebook"]);
    setPlatformCopies({});
    setPhotoAudit(demoPhotoAudit(DEMO_PHOTOS.length));
    setPrivacyAcknowledged(false);
    Alert.alert(
      "Demo geladen",
      "Ein Beispiel-Akkuschrauber mit 3 Fotos wurde geladen. Tippe jetzt auf „3 Fotos mit Demo-KI analysieren“."
    );
  };

  const resetDemo = () => {
    setDemoMode(false);
    setPhotos([]);
    setDraft(null);
    setPriceSuggestion(null);
    setComparables([]);
    setSellerProfile(DEFAULT_SELLER_PROFILE);
    setPlatformCopies({});
    setStep("home");
  };

  const startAnalysis = async () => {
    if (!photoAudit && photos.length > 0 && !demoMode) {
      setPhotoAuditBusy(true);
      try {
        const result = await auditPhotos(photos, selectedProvider);
        setPhotoAudit(result);
        setPrivacyAcknowledged(false);

        const recommended = photos[result.recommendedCoverIndex];
        if (recommended) {
          setPhotos((current) => [
            { ...recommended, role: "cover" },
            ...current
              .filter((photo) => photo.id !== recommended.id)
              .map((photo) =>
                photo.role === "cover"
                  ? { ...photo, role: "general" as const }
                  : photo
              ),
          ]);
        }
      } finally {
        setPhotoAuditBusy(false);
      }
    }

    if (demoMode) {
      setStep("analyzing");
      await new Promise((resolve) => setTimeout(resolve, 650));
      setDraft({
        ...DEMO_DRAFT,
        barcode: barcode || "3165140000000",
        voiceNotes:
          voiceNotes ||
          "Funktioniert. Akku und Ladegerät sind dabei. Leichte Gebrauchsspuren rechts am Gehäuse.",
      });
      setPriceSuggestion(null);
      setPlatformCopies({});
      setStep("draft");
      return;
    }

    if (!photos.length) {
      Alert.alert("Noch kein Foto", "Fotografiere oder wähle mindestens ein Bild.");
      return;
    }

    if (selectedProviderInfo && !selectedProviderInfo.configured) {
      Alert.alert(
        "KI noch nicht verbunden",
        `${selectedProviderInfo.name} ist auf dem Server noch nicht eingerichtet. Hinterlege den passenden API-Schlüssel oder wähle eine andere KI.`
      );
      return;
    }

    setStep("analyzing");
    try {
      const result = await analyzePhotos(photos, selectedProvider, { barcode, voiceNotes });
      setDraft(result);
      setPriceSuggestion(null);
      setComparables([]);
      setPlatformCopies({});
      setStep("draft");
    } catch (error) {
      setStep("photos");
      const message =
        error instanceof Error ? error.message : "Bitte versuche es erneut.";
      Alert.alert("Analyse fehlgeschlagen", message);
    }
  };

  const addComparable = () => {
    const normalized = comparablePrice.replace(",", ".").trim();
    const price = Number(normalized);

    if (!Number.isFinite(price) || price <= 0) {
      Alert.alert("Ungültiger Preis", "Bitte einen gültigen Vergleichspreis eingeben.");
      return;
    }

    setComparables((current) => [
      ...current,
      {
        title: comparableTitle.trim() || undefined,
        price,
        platform: comparablePlatform,
      },
    ]);

    setComparableTitle("");
    setComparablePrice("");
    setComparablePlatform("kleinanzeigen");
  };

  const removeComparable = (index: number) => {
    setComparables((current) => current.filter((_, i) => i !== index));
  };

  const runPricing = async () => {
    if (!draft) return;
    if (demoMode) {
      setPricingBusy(true);
      await new Promise((resolve) => setTimeout(resolve, 450));
      setPriceSuggestion(DEMO_PRICE);
      setPricingBusy(false);
      return;
    }
    setPricingBusy(true);

    try {
      const suggestion = await suggestPrice(draft, comparables);
      setPriceSuggestion(suggestion);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Preisvorschlag konnte nicht berechnet werden.";
      Alert.alert("Preisassistent", message);
    } finally {
      setPricingBusy(false);
    }
  };

  const applySuggestedPrice = (
    price: number,
    priceType: "VB" | "Festpreis"
  ) => {
    if (!draft) return;
    setDraft({
      ...draft,
      price: String(price),
      priceType,
    });
    Alert.alert(
      "Preis übernommen",
      `${price} € ${priceType} wurde in den Entwurf übernommen.`
    );
  };

  const openUrl = async (url: string) => {
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert("Link nicht möglich", "Der Link konnte nicht geöffnet werden.");
      return;
    }
    await Linking.openURL(url);
  };

  const togglePlatform = (id: SalesPlatformId) => {
    setSelectedPlatforms((current) => {
      const selected = current.includes(id);
      const next = selected
        ? current.filter((entry) => entry !== id)
        : [...current, id];

      setCurrentPlatformStatuses((statuses) => {
        const updated = { ...statuses };
        if (selected) {
          delete updated[id];
        } else {
          updated[id] = statuses[id] || "prepared";
        }
        return updated;
      });

      return next;
    });
  };

  const recommendationFor = (id: SalesPlatformId) =>
    platformRecommendation?.recommendations.find(
      (entry) => entry.platformId === id
    );

  const applyPlatformRecommendations = () => {
    if (!draft) return;
    const result = recommendPlatforms(draft, platformCountry);
    setPlatformRecommendation(result);
    const recommended = result.recommendations
      .filter((entry) => entry.recommended)
      .map((entry) => entry.platformId);
    setSelectedPlatforms(recommended);
    setCurrentPlatformStatuses((current) => {
      const next: Partial<Record<SalesPlatformId, PlatformListingStatus>> = {};
      recommended.forEach((id) => {
        next[id] = current[id] || "prepared";
      });
      return next;
    });
  };

  const updateShippingPackage = (next: ShippingPackageInput) => {
    if (shippingSelection) {
      setSellerProfile((current) => ({
        ...current,
        carrier: "",
        shippingCost:
          current.shippingCostMode === "fixed" ? "" : current.shippingCost,
        shippingCostMode:
          current.shippingCostMode === "fixed"
            ? "buyer_pays"
            : current.shippingCostMode,
      }));
    }
    setShippingSelection(null);
    setShippingPackage(next);
  };

  const applyShippingQuote = (quote: ShippingQuote) => {
    const price = quote.price.toFixed(2).replace(".", ",");
    setShippingSelection(quote);
    setSellerProfile((current) => ({
      ...current,
      shippingCostMode: "fixed",
      shippingCost: price,
      carrier: `${quote.carrier} · ${quote.product}`,
    }));
    Alert.alert(
      "Versand übernommen",
      `${quote.carrier} · ${quote.product}\n${price} € wurden für diesen Artikel übernommen.`
    );
  };

  const runPlatformCopyGeneration = async () => {
    if (!draft || selectedPlatforms.length === 0) return;

    setPlatformCopyBusy(true);
    try {
      const result = await generatePlatformCopies(
        draft,
        selectedPlatforms,
        selectedProvider,
        sellerProfile
      );
      const next: Partial<Record<SalesPlatformId, PlatformCopy>> = {};
      result.copies.forEach((copy) => {
        next[copy.platformId] = copy;
      });
      setPlatformCopies(next);
    } catch (error) {
      Alert.alert(
        "Plattformtexte",
        error instanceof Error
          ? error.message
          : "Plattformtexte konnten nicht erstellt werden."
      );
    } finally {
      setPlatformCopyBusy(false);
    }
  };

  const updatePlatformCopy = (copy: PlatformCopy) => {
    setPlatformCopies((current) => ({
      ...current,
      [copy.platformId]: copy,
    }));
  };

  const togglePaymentMethod = (method: PaymentMethod) => {
    setSellerProfile((current) => ({
      ...current,
      paymentMethods: current.paymentMethods.includes(method)
        ? current.paymentMethods.filter((entry) => entry !== method)
        : [...current.paymentMethods, method],
    }));
  };

  const refreshEbayStatus = async () => {
    setEbayBusy(true);
    try {
      setEbayStatus(await getEbayStatus());
    } finally {
      setEbayBusy(false);
    }
  };

  const startEbayConnect = async () => {
    setEbayBusy(true);
    try {
      await connectEbay();
      Alert.alert(
        "eBay geöffnet",
        "Melde dich bei eBay an und erlaube den Zugriff. Kehre danach zurück und tippe auf „Status aktualisieren“."
      );
    } catch (error) {
      Alert.alert(
        "eBay-Verknüpfung",
        error instanceof Error
          ? error.message
          : "Verknüpfung konnte nicht gestartet werden."
      );
    } finally {
      setEbayBusy(false);
    }
  };

  const removeEbayConnection = async () => {
    setEbayBusy(true);
    try {
      await disconnectEbay();
      setEbayStatus(await getEbayStatus());
    } finally {
      setEbayBusy(false);
    }
  };

  const openKleinanzeigen = async () => {
    await openUrl("https://www.kleinanzeigen.de/");
  };

  const openPlatform = async (url: string) => {
    await openUrl(url);
  };

  const filteredPlatforms = SALES_PLATFORMS.filter((platform) => {
    const countryMatch =
      platformCountry === "ALL" || platform.countries.includes(platformCountry);
    const priorityMatch =
      showMorePlatforms || platform.priority === "primary";
    return countryMatch && priorityMatch;
  });

  if (step === "home") {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="auto" />
        <SalesCenter
          listings={savedListings}
          onNew={startNewListing}
          onBatch={() => setStep("batch")}
          onInbox={() => {
            setPushConversationId(null);
            setStep("inbox");
          }}
          onSettings={openSettings}
          onCleanup={openCleanup}
          onOpen={openSavedListing}
          onSetStatus={updateSavedStatus}
          onDelete={deleteSavedListing}
          onLoadDemo={loadSalesCenterDemo}
        />
      </SafeAreaView>
    );
  }

  if (step === "inbox") {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="auto" />
        <InboxScreen
          listings={savedListings}
          onBack={() => {
            setPushConversationId(null);
            setStep("home");
          }}
          onConnectEbay={connectEbay}
          initialConversationId={pushConversationId}
        />
      </SafeAreaView>
    );
  }

  if (step === "settings") {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="auto" />
        <UserPreferencesScreen
          value={preferencesDraft}
          providers={providers}
          onChange={setPreferencesDraft}
          onSave={persistPreferences}
          onCancel={() => setStep("home")}
        />
      </SafeAreaView>
    );
  }

  if (step === "cleanup") {
    const record = savedListings.find((item) => item.id === cleanupRecordId);

    if (!record) {
      return (
        <SafeAreaView style={styles.safe}>
          <StatusBar style="auto" />
          <View style={styles.center}>
            <Text style={styles.title}>Artikel nicht gefunden</Text>
            <Pressable style={styles.secondary} onPress={() => setStep("home")}>
              <Text style={styles.secondaryText}>Zur Verkaufszentrale</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      );
    }

    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="auto" />
        <PlatformCleanupPanel
          record={record}
          onUpdate={updateCleanupRecord}
          onBack={() => {
            setCleanupRecordId(null);
            setStep("home");
          }}
        />
      </SafeAreaView>
    );
  }

  if (step === "batch") {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="auto" />
        <BatchSelling
          busy={batchBusy}
          progressText={batchProgress}
          onCancel={() => setStep("home")}
          onProcess={processBatchItems}
          onLoadDemo={loadBatchDemo}
        />
      </SafeAreaView>
    );
  }

  if (step === "scanner") {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />
        <BarcodeScanner
          onCancel={() => setStep("photos")}
          onScanned={(value, type) => {
            setBarcode(value);
            setStep("photos");
            Alert.alert("Barcode erkannt", `${value}\nTyp: ${type}`);
          }}
        />
      </SafeAreaView>
    );
  }

  if (step === "analyzing") {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="auto" />
        <View style={styles.center}>
          <ActivityIndicator size="large" />
          <Text style={styles.analysisTitle}>Artikel wird analysiert …</Text>
          <Text style={styles.muted}>
            {selectedProviderInfo?.name ?? selectedProvider} wertet alle{" "}
            {photos.length} Fotos gemeinsam aus.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (step === "seller" && draft) {
    const sellerMissing = sellerProfileReadiness(sellerProfile);

    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="auto" />
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView contentContainerStyle={styles.container}>
            <Text style={styles.eyebrow}>SCHRITT 4</Text>
            <Text style={styles.title}>Versand, Abholung & Zahlung</Text>
            <Text style={styles.muted}>
              Diese Angaben gelten als Basis für alle Marktplätze und werden in
              die jeweiligen Verkaufstexte übernommen.
            </Text>

            <View style={styles.analysisCard}>
              <Text style={styles.analysisCardTitle}>Land & Standort</Text>
              <View style={styles.platformRow}>
                {(["DE", "AT"] as const).map((country) => (
                  <Pressable
                    key={country}
                    onPress={() => {
                      setSellerProfile({ ...sellerProfile, country });
                      setPlatformCountry(country);
                    }}
                    style={[
                      styles.platformChip,
                      sellerProfile.country === country && styles.platformChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.platformChipText,
                        sellerProfile.country === country &&
                          styles.platformChipTextActive,
                      ]}
                    >
                      {country === "DE" ? "Deutschland" : "Österreich"}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.twoCols}>
                <View style={{ flex: 1 }}>
                  <Field
                    label="PLZ"
                    value={sellerProfile.postalCode}
                    onChangeText={(postalCode) =>
                      setSellerProfile({ ...sellerProfile, postalCode })
                    }
                    placeholder="z. B. 09111"
                  />
                </View>
                <View style={{ width: 12 }} />
                <View style={{ flex: 1 }}>
                  <Field
                    label="Ort"
                    value={sellerProfile.city}
                    onChangeText={(city) =>
                      setSellerProfile({ ...sellerProfile, city })
                    }
                    placeholder="z. B. Chemnitz"
                  />
                </View>
              </View>
            </View>

            <View style={styles.analysisCard}>
              <Text style={styles.analysisCardTitle}>Übergabe</Text>
              <View style={styles.optionStack}>
                {(["pickup", "shipping", "both"] as const).map((mode) => (
                  <Pressable
                    key={mode}
                    onPress={() => {
                      if (mode === "pickup") {
                        setShippingSelection(null);
                        setSellerProfile({
                          ...sellerProfile,
                          shippingMode: mode,
                          carrier: "",
                          shippingCost: "",
                          shippingCostMode: "buyer_pays",
                        });
                      } else {
                        setSellerProfile({ ...sellerProfile, shippingMode: mode });
                      }
                    }}
                    style={[
                      styles.selectRow,
                      sellerProfile.shippingMode === mode && styles.selectRowActive,
                    ]}
                  >
                    <View style={styles.radioOuter}>
                      {sellerProfile.shippingMode === mode && (
                        <View style={styles.radioInner} />
                      )}
                    </View>
                    <Text style={styles.selectRowText}>
                      {SHIPPING_LABELS[mode]}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {(sellerProfile.shippingMode === "shipping" ||
                sellerProfile.shippingMode === "both") && (
                <>
                  <Text style={[styles.label, { marginTop: 16 }]}>
                    Versandkosten
                  </Text>
                  <View style={styles.platformRow}>
                    {([
                      ["buyer_pays", "Käufer zahlt"],
                      ["free", "Kostenlos"],
                      ["fixed", "Fester Betrag"],
                    ] as const).map(([value, label]) => (
                      <Pressable
                        key={value}
                        onPress={() =>
                          setSellerProfile({
                            ...sellerProfile,
                            shippingCostMode: value,
                          })
                        }
                        style={[
                          styles.platformChip,
                          sellerProfile.shippingCostMode === value &&
                            styles.platformChipActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.platformChipText,
                            sellerProfile.shippingCostMode === value &&
                              styles.platformChipTextActive,
                          ]}
                        >
                          {label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  {sellerProfile.shippingCostMode === "fixed" && (
                    <Field
                      label="Versandkosten in €"
                      value={sellerProfile.shippingCost}
                      onChangeText={(shippingCost) =>
                        setSellerProfile({ ...sellerProfile, shippingCost })
                      }
                      keyboardType="decimal-pad"
                      placeholder="z. B. 6,99"
                    />
                  )}

                  <Field
                    label="Versanddienst optional"
                    value={sellerProfile.carrier}
                    onChangeText={(carrier) =>
                      setSellerProfile({ ...sellerProfile, carrier })
                    }
                    placeholder="z. B. DHL, Hermes"
                  />

                  <ShippingAssistant
                    value={shippingPackage}
                    itemValue={Number(
                      String(draft.price || "0").replace(",", ".")
                    ) || 0}
                    selectedId={shippingSelection?.id}
                    onChange={updateShippingPackage}
                    onApply={applyShippingQuote}
                  />
                </>
              )}
            </View>

            <View style={styles.analysisCard}>
              <Text style={styles.analysisCardTitle}>Zahlungsarten</Text>
              <Text style={styles.analysisLine}>
                Wähle nur Zahlungsarten, die du wirklich akzeptieren möchtest.
              </Text>
              <View style={styles.paymentGrid}>
                {(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map((method) => {
                  const active = sellerProfile.paymentMethods.includes(method);
                  return (
                    <Pressable
                      key={method}
                      onPress={() => togglePaymentMethod(method)}
                      style={[
                        styles.paymentOption,
                        active && styles.paymentOptionActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.paymentOptionText,
                          active && styles.paymentOptionTextActive,
                        ]}
                      >
                        {active ? "✓ " : ""}
                        {PAYMENT_LABELS[method]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.ebayCard}>
              <View style={styles.rowBetweenCompact}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ebayTitle}>eBay-Konto</Text>
                  <Text style={styles.ebayText}>
                    Für späteres Direkt-Posting wird eBay per OAuth verbunden.
                    Passwort und Token liegen nicht in der Handy-App.
                  </Text>
                </View>
                <Text
                  style={[
                    styles.ebayStatusBadge,
                    ebayStatus?.connected
                      ? styles.ebayConnected
                      : styles.ebayDisconnected,
                  ]}
                >
                  {ebayStatus?.connected ? "VERBUNDEN" : "NICHT VERBUNDEN"}
                </Text>
              </View>

              {ebayStatus && (
                <View style={styles.ebayDetails}>
                  <Text style={styles.smallMuted}>
                    Umgebung:{" "}
                    {ebayStatus.environment === "production"
                      ? "Produktion"
                      : "Sandbox"}
                  </Text>
                  {ebayStatus.policyStatus?.checked && (
                    <Text style={styles.smallMuted}>
                      Richtlinien: Versand{" "}
                      {ebayStatus.policyStatus.fulfillmentPolicies ?? "?"} · Zahlung{" "}
                      {ebayStatus.policyStatus.paymentPolicies ?? "?"} · Rückgabe{" "}
                      {ebayStatus.policyStatus.returnPolicies ?? "?"}
                    </Text>
                  )}
                </View>
              )}

              {!ebayStatus?.connected ? (
                <Pressable
                  style={[styles.primary, ebayBusy && styles.disabled]}
                  disabled={ebayBusy}
                  onPress={startEbayConnect}
                >
                  <Text style={styles.primaryText}>
                    {ebayBusy ? "eBay wird geöffnet …" : "eBay verbinden"}
                  </Text>
                </Pressable>
              ) : (
                <Pressable
                  style={styles.secondary}
                  onPress={removeEbayConnection}
                  disabled={ebayBusy}
                >
                  <Text style={styles.secondaryText}>
                    eBay-Verbindung trennen
                  </Text>
                </Pressable>
              )}

              <Pressable
                style={styles.secondary}
                onPress={refreshEbayStatus}
                disabled={ebayBusy}
              >
                <Text style={styles.secondaryText}>Status aktualisieren</Text>
              </Pressable>
            </View>

            <EbayDiagnosticsPanel />

            {sellerMissing.length > 0 && (
              <View style={styles.warningBox}>
                <Text style={styles.warningTitle}>Noch erforderlich:</Text>
                <Text style={styles.warningLine}>{sellerMissing.join(" · ")}</Text>
              </View>
            )}

            <View style={styles.specialNote}>
              <Text style={styles.specialNoteTitle}>
                Keine automatische Rechtsklausel
              </Text>
              <Text style={styles.specialNoteText}>
                Die App erfindet keine Garantie-, Gewährleistungs- oder
                Rückgabeausschlüsse. Rechtliche Texte werden nur übernommen,
                wenn der Nutzer sie selbst vorgibt.
              </Text>
            </View>

            <Pressable
              style={[
                styles.primary,
                sellerMissing.length > 0 && styles.disabled,
              ]}
              disabled={sellerMissing.length > 0}
              onPress={() => {
                setPlatformCopies({});
                setStep("platforms");
              }}
            >
              <Text style={styles.primaryText}>
                Weiter zu Verkaufsplattformen
              </Text>
            </Pressable>

            <Pressable
              style={styles.secondary}
              onPress={() => setStep("pricing")}
            >
              <Text style={styles.secondaryText}>
                Zurück zum Preisassistenten
              </Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  if (step === "platforms" && draft) {
    const missing = listingReadiness(draft);
    if (privacyBlocked) missing.push("Foto-Privatsphäre prüfen");

    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="auto" />
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.eyebrow}>SCHRITT 5</Text>
          <Text style={styles.title}>Wo möchtest du verkaufen?</Text>
          <Text style={styles.muted}>
            Wähle beliebig viele Plattformen. Die App hält einen gemeinsamen
            Verkaufsentwurf und bereitet ihn für die gewählten Marktplätze vor.
          </Text>

          <View style={styles.countryChooser}>
            <Text style={styles.analysisCardTitle}>Region</Text>
            <View style={styles.platformRow}>
              {([
                ["DE", "Deutschland"],
                ["AT", "Österreich"],
                ["ALL", "Alle"],
              ] as const).map(([value, label]) => (
                <Pressable
                  key={value}
                  onPress={() => setPlatformCountry(value)}
                  style={[
                    styles.platformChip,
                    platformCountry === value && styles.platformChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.platformChipText,
                      platformCountry === value && styles.platformChipTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {platformRecommendation && (
            <View style={styles.recommendationHero}>
              <View style={styles.rowBetweenCompact}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.recommendationEyebrow}>
                    INTELLIGENTE EMPFEHLUNG
                  </Text>
                  <Text style={styles.recommendationTitle}>
                    {platformRecommendation.productGroupLabel}
                  </Text>
                </View>
                <Text style={styles.recommendationCount}>
                  {platformRecommendation.recommendations.filter(
                    (entry) => entry.recommended
                  ).length} empfohlen
                </Text>
              </View>

              <Text style={styles.recommendationText}>
                {platformRecommendation.localPickupLikely
                  ? "Der Artikel wirkt eher lokal/abholungsgeeignet. Lokale Marktplätze werden deshalb höher gewichtet."
                  : platformRecommendation.shippingFriendlyLikely
                    ? "Der Artikel wirkt gut versendbar. Überregionale Marktplätze werden deshalb stärker berücksichtigt."
                    : "Die Empfehlung basiert auf Artikelart, Region und Marktplatz-Eignung."}
              </Text>

              <Pressable
                style={styles.reapplyButton}
                onPress={applyPlatformRecommendations}
              >
                <Text style={styles.reapplyButtonText}>
                  Empfehlungen erneut übernehmen
                </Text>
              </Pressable>
            </View>
          )}

          {privacyBlocked && (
            <View style={styles.privacyBlocker}>
              <Text style={styles.privacyBlockerTitle}>
                PRIVATSPHÄRE-BLOCKER
              </Text>
              <Text style={styles.privacyBlockerText}>
                Mindestens ein Foto wurde noch nicht vollständig auf sensible
                Inhalte geprüft oder enthält eine Warnung. Veröffentlichung bleibt
                blockiert, bis du die Fotos im Schritt 1 überprüfst oder bewusst
                bestätigst.
              </Text>
              <Pressable
                style={styles.secondary}
                onPress={() => setStep("photos")}
              >
                <Text style={styles.secondaryText}>Fotos prüfen</Text>
              </Pressable>
            </View>
          )}

          {missing.length > 0 && (
            <View style={styles.warningBox}>
              <Text style={styles.warningTitle}>
                Vor Veröffentlichung fehlt noch:
              </Text>
              <Text style={styles.warningLine}>{missing.join(" · ")}</Text>
            </View>
          )}

          {filteredPlatforms.map((platform) => {
            const selected = selectedPlatforms.includes(platform.id);
            const recommendation = recommendationFor(platform.id);

            return (
              <Pressable
                key={platform.id}
                onPress={() => togglePlatform(platform.id)}
                style={[
                  styles.platformCard,
                  selected && styles.platformCardSelected,
                ]}
              >
                <View style={styles.platformCheck}>
                  <Text style={styles.platformCheckText}>
                    {selected ? "✓" : ""}
                  </Text>
                </View>

                <View style={{ flex: 1 }}>
                  <View style={styles.rowBetweenCompact}>
                    <Text style={styles.platformCardTitle}>
                      {platform.name}
                    </Text>
                    <View style={styles.badgeRow}>
                      {recommendation?.recommended && (
                        <Text style={styles.recommendedBadge}>EMPFOHLEN</Text>
                      )}
                      {recommendation && (
                        <Text style={styles.scoreBadge}>
                          {recommendation.score} %
                        </Text>
                      )}
                    </View>
                  </View>

                  <Text style={styles.platformCardNote}>
                    {platform.note}
                  </Text>

                  {recommendation && recommendation.reasons.length > 0 && (
                    <View style={styles.reasonBox}>
                      {recommendation.reasons.slice(0, 3).map((reason, index) => (
                        <Text
                          key={`${platform.id}-${reason}-${index}`}
                          style={styles.reasonText}
                        >
                          • {reason}
                        </Text>
                      ))}
                    </View>
                  )}

                  {platform.categoryHint && (
                    <Text style={styles.categoryHint}>
                      {platform.categoryHint}
                    </Text>
                  )}

                  <Text style={styles.countryLine}>
                    {platform.countries.join(" · ")}
                  </Text>
                </View>
              </Pressable>
            );
          })}

          <Pressable
            style={styles.morePlatformsButton}
            onPress={() => setShowMorePlatforms((current) => !current)}
          >
            <Text style={styles.morePlatformsText}>
              {showMorePlatforms
                ? "Weniger Plattformen anzeigen"
                : "Weitere Plattformen anzeigen"}
            </Text>
          </Pressable>

          <View style={styles.selectionInfo}>
            <Text style={styles.selectionInfoTitle}>
              {selectedPlatforms.length} Plattform
              {selectedPlatforms.length === 1 ? "" : "en"} ausgewählt
            </Text>
            <Text style={styles.selectionInfoText}>
              Die Empfehlung ist nur ein Vorschlag. Du kannst jede Plattform
              jederzeit an- oder abwählen.
            </Text>
          </View>

          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Master-Entwurf</Text>
            <Text style={styles.previewTitle}>{draft.title}</Text>
            <Text style={styles.previewMeta}>
              {draft.price || "—"} € {draft.priceType} · {draft.condition}
            </Text>
            <Text style={styles.previewDescription}>{draft.description}</Text>
          </View>

          <View style={styles.selectionInfo}>
            <Text style={styles.selectionInfoTitle}>Versand & Zahlung</Text>
            <Text style={styles.selectionInfoText}>
              {SHIPPING_LABELS[sellerProfile.shippingMode]} ·{" "}
              {sellerProfile.postalCode} {sellerProfile.city} ·{" "}
              {sellerProfile.paymentMethods
                .map((method) => PAYMENT_LABELS[method])
                .join(", ")}
            </Text>
          </View>

          <View style={styles.copyGeneratorBox}>
            <Text style={styles.copyGeneratorTitle}>
              Texte für jede Plattform optimieren
            </Text>
            <Text style={styles.copyGeneratorText}>
              {selectedProviderInfo?.name ?? selectedProvider} erstellt aus dem
              Master-Entwurf eigene Versionen für die ausgewählten Marktplätze.
              Danach kannst du jeden Titel und jede Beschreibung separat ändern.
            </Text>

            <Pressable
              style={[
                styles.primary,
                (missing.length > 0 ||
                  selectedPlatforms.length === 0 ||
                  platformCopyBusy) && styles.disabled,
              ]}
              disabled={
                missing.length > 0 ||
                selectedPlatforms.length === 0 ||
                platformCopyBusy
              }
              onPress={runPlatformCopyGeneration}
            >
              <Text style={styles.primaryText}>
                {platformCopyBusy
                  ? "Plattformtexte werden erstellt …"
                  : `Mit ${selectedProviderInfo?.name ?? selectedProvider} optimieren`}
              </Text>
            </Pressable>
          </View>

          {selectedPlatforms.includes("ebay") && (
            <EbayPublishPanel
              draft={draft}
              sellerProfile={sellerProfile}
              photos={photos}
              platformCopy={platformCopies.ebay}
              privacyBlocked={privacyBlocked}
              onPublished={handleEbayPublished}
            />
          )}

          {SALES_PLATFORMS.filter((platform) =>
            selectedPlatforms.includes(platform.id)
          ).map((platform) => {
            const copy = platformCopies[platform.id];

            if (copy) {
              return (
                <PlatformCopyCard
                  key={platform.id}
                  platform={platform}
                  copy={copy}
                  onChange={updatePlatformCopy}
                />
              );
            }

            return (
              <View key={platform.id} style={styles.actionCard}>
                <View style={styles.rowBetweenCompact}>
                  <Text style={styles.actionTitle}>{platform.name}</Text>
                  <Text style={styles.modeBadge}>
                    {platform.mode === "api" ? "API" : "Übergabe"}
                  </Text>
                </View>
                <Text style={styles.actionText}>
                  Noch keine eigene Plattformversion erzeugt. Du kannst den
                  Master-Entwurf verwenden oder oben die Texte optimieren lassen.
                </Text>
                <Pressable
                  style={styles.secondary}
                  onPress={() => openPlatform(platform.sellUrl)}
                >
                  <Text style={styles.secondaryText}>{platform.name} öffnen</Text>
                </Pressable>
              </View>
            );
          })}

          <View style={styles.specialNote}>
            <Text style={styles.specialNoteTitle}>Spezialportale</Text>
            <Text style={styles.specialNoteText}>
              meinestadt.de behandeln wir nicht als allgemeinen
              Waren-Marktplatz. Aktuell ist dort vor allem privates
              Immobilien-Inserieren relevant. Solche Spezialportale können
              später automatisch je nach Artikelkategorie erscheinen.
            </Text>
          </View>

          <CrosspostingStatusPanel
            selectedPlatforms={selectedPlatforms}
            statuses={currentPlatformStatuses}
            onChange={updateCurrentPlatformStatus}
          />

          <View style={styles.publishStatusCard}>
            <Text style={styles.analysisCardTitle}>Verkaufszentrale</Text>
            <Text style={styles.analysisLine}>
              Speichere den Artikel als Entwurf, online oder verkauft. Die Plattform-Status werden mitgeführt.
            </Text>
            <Pressable
              style={styles.secondary}
              onPress={async () => {
                await saveCurrentListing("prepared");
                setStep("home");
              }}
            >
              <Text style={styles.secondaryText}>Als vorbereitet speichern</Text>
            </Pressable>

            <View style={styles.saveRow}>
              <Pressable
                style={[styles.secondary, { flex: 1 }]}
                onPress={async () => {
                  await saveCurrentListing("online");
                  setStep("home");
                }}
              >
                <Text style={styles.secondaryText}>Als online speichern</Text>
              </Pressable>
              <View style={{ width: 10 }} />
              <Pressable
                style={[styles.primary, { flex: 1, marginTop: 12 }]}
                onPress={async () => {
                  await saveCurrentListing("sold");
                  setStep("home");
                }}
              >
                <Text style={styles.primaryText}>Als verkauft markieren</Text>
              </Pressable>
            </View>
          </View>

          <Pressable
            style={styles.secondary}
            onPress={() => setStep("seller")}
          >
            <Text style={styles.secondaryText}>
              Zurück zu Versand & Zahlung
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (step === "pricing" && draft) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="auto" />
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView contentContainerStyle={styles.container}>
            <Text style={styles.eyebrow}>SCHRITT 3</Text>
            <Text style={styles.title}>Preisassistent</Text>
            <Text style={styles.muted}>
              Suche vergleichen, Vergleichspreise eintragen und daraus den Zielpreis ableiten.
            </Text>

            <View style={styles.analysisCard}>
              <Text style={styles.analysisCardTitle}>Vorgeschlagene Suchbegriffe</Text>
              <View style={styles.tagsWrap}>
                {(draft.analysis?.searchTerms?.length ?? 0) > 0 ? (
                  draft.analysis!.searchTerms.map((term, index) => (
                    <View key={`${term}-${index}`} style={styles.tag}>
                      <Text style={styles.tagText}>{term}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.analysisLine}>
                    Noch keine Suchbegriffe vorhanden. Es werden Titel und Marke/Modell verwendet.
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.analysisCard}>
              <Text style={styles.analysisCardTitle}>Marktsuche öffnen</Text>
              <Text style={styles.analysisLine}>
                Damit kannst du direkt ähnliche Angebote prüfen.
              </Text>

              <View style={styles.twoCols}>
                <Pressable
                  style={[styles.secondary, { flex: 1, marginTop: 14 }]}
                  onPress={() =>
                    openUrl(
                      priceSuggestion?.searchQueries.find((q) => q.platform === "kleinanzeigen")
                        ?.url ??
                        `https://www.kleinanzeigen.de/s-suchanfrage.html?keywords=${encodeURIComponent(
                          draft.analysis?.searchTerms?.join(" ") ||
                            [draft.brand, draft.model, draft.title].filter(Boolean).join(" ")
                        )}`
                    )
                  }
                >
                  <Text style={styles.secondaryText}>Kleinanzeigen-Suche</Text>
                </Pressable>
                <View style={{ width: 12 }} />
                <Pressable
                  style={[styles.secondary, { flex: 1, marginTop: 14 }]}
                  onPress={() =>
                    openUrl(
                      priceSuggestion?.searchQueries.find((q) => q.platform === "ebay")?.url ??
                        `https://www.ebay.de/sch/i.html?_nkw=${encodeURIComponent(
                          draft.analysis?.searchTerms?.join(" ") ||
                            [draft.brand, draft.model, draft.title].filter(Boolean).join(" ")
                        )}`
                    )
                  }
                >
                  <Text style={styles.secondaryText}>eBay-Suche</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.analysisCard}>
              <Text style={styles.analysisCardTitle}>Vergleichspreis eintragen</Text>
              <Field
                label="Kurznotiz / Artikel"
                value={comparableTitle}
                onChangeText={setComparableTitle}
                placeholder="z. B. Makita DDF482 mit Akku"
              />
              <View style={styles.twoCols}>
                <View style={{ flex: 1 }}>
                  <Field
                    label="Preis in €"
                    value={comparablePrice}
                    keyboardType="decimal-pad"
                    onChangeText={setComparablePrice}
                    placeholder="z. B. 59"
                  />
                </View>
                <View style={{ width: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Plattform</Text>
                  <View style={styles.platformRow}>
                    {(["kleinanzeigen", "ebay", "other"] as const).map((platformValue) => (
                      <Pressable
                        key={platformValue}
                        onPress={() => setComparablePlatform(platformValue)}
                        style={[
                          styles.platformChip,
                          comparablePlatform === platformValue && styles.platformChipActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.platformChipText,
                            comparablePlatform === platformValue &&
                              styles.platformChipTextActive,
                          ]}
                        >
                          {platformValue === "other"
                            ? "Sonstiges"
                            : platformValue === "ebay"
                              ? "eBay"
                              : "Kleinanzeigen"}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>

              <Pressable style={styles.secondary} onPress={addComparable}>
                <Text style={styles.secondaryText}>Vergleich hinzufügen</Text>
              </Pressable>

              {comparables.length === 0 ? (
                <Text style={[styles.smallMuted, { marginTop: 12 }]}>
                  Noch keine Vergleichspreise eingetragen.
                </Text>
              ) : (
                <View style={{ marginTop: 12 }}>
                  {comparables.map((entry, index) => (
                    <View
                      key={`${entry.platform}-${entry.price}-${index}`}
                      style={styles.comparableRow}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.comparableTitle}>
                          {entry.title || "Vergleichsangebot"}
                        </Text>
                        <Text style={styles.smallMuted}>
                          {entry.platform === "other"
                            ? "Sonstiges"
                            : entry.platform === "ebay"
                              ? "eBay"
                              : "Kleinanzeigen"}{" "}
                          · {entry.price} €
                        </Text>
                      </View>
                      <Pressable onPress={() => removeComparable(index)}>
                        <Text style={styles.removeInline}>Entfernen</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}

              <Pressable
                style={[styles.primary, pricingBusy && styles.disabled]}
                onPress={runPricing}
                disabled={pricingBusy}
              >
                <Text style={styles.primaryText}>
                  {pricingBusy ? "Preis wird berechnet …" : "Preisvorschlag berechnen"}
                </Text>
              </Pressable>
            </View>

            {priceSuggestion && (() => {
              const goalPrice = goalPriceFromSuggestion(
                priceSuggestion,
                preferences.salesGoal
              );

              return (
                <View style={styles.goalCard}>
                  <Text style={styles.goalEyebrow}>DEIN VERKAUFSZIEL</Text>
                  <Text style={styles.goalTitle}>
                    {SALES_GOAL_LABELS[preferences.salesGoal]}
                  </Text>
                  <Text style={styles.goalText}>{goalPrice.explanation}</Text>
                  <View style={styles.goalPriceRow}>
                    <Text style={styles.goalPrice}>
                      {goalPrice.value} € {goalPrice.priceType}
                    </Text>
                    <Pressable
                      style={styles.goalApply}
                      onPress={() =>
                        applySuggestedPrice(
                          goalPrice.value,
                          goalPrice.priceType
                        )
                      }
                    >
                      <Text style={styles.goalApplyText}>Zielpreis übernehmen</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })()}

            {priceSuggestion && (
              <View style={styles.resultCard}>
                <Text style={styles.resultTitle}>Dein Preisrahmen</Text>
                <Text style={styles.resultReasoning}>{priceSuggestion.reasoning}</Text>
                <Text style={styles.smallMuted}>
                  Basis:{" "}
                  {priceSuggestion.basedOn === "manual_comparables"
                    ? "manuelle Vergleichspreise"
                    : "vorsichtige Schätzung"}{" "}
                  · Quellen: {priceSuggestion.sourceCount} · Sicherheit:{" "}
                  {Math.round(priceSuggestion.confidence * 100)} %
                </Text>

                <PriceRow
                  label="Schnell verkaufen"
                  value={priceSuggestion.sellFast}
                  actionLabel="Übernehmen"
                  onPress={() =>
                    applySuggestedPrice(priceSuggestion.sellFast, "Festpreis")
                  }
                />
                <PriceRow
                  label="Marktüblich"
                  value={priceSuggestion.marketTypical}
                  actionLabel="Übernehmen"
                  onPress={() =>
                    applySuggestedPrice(priceSuggestion.marketTypical, "VB")
                  }
                />
                <PriceRow
                  label="Höher ansetzen"
                  value={priceSuggestion.startHigh}
                  actionLabel="Übernehmen"
                  onPress={() =>
                    applySuggestedPrice(priceSuggestion.startHigh, "VB")
                  }
                />
              </View>
            )}

            <Pressable style={styles.primary} onPress={() => setStep("seller")}>
              <Text style={styles.primaryText}>Weiter zu Versand & Zahlung</Text>
            </Pressable>

            <Pressable style={styles.secondary} onPress={() => setStep("draft")}>
              <Text style={styles.secondaryText}>Zurück zum Entwurf</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  if (step === "draft" && draft) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="auto" />
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView contentContainerStyle={styles.container}>
            <Text style={styles.eyebrow}>SCHRITT 2</Text>
            <Text style={styles.title}>Anzeige prüfen</Text>
            <Text style={styles.muted}>
              Erstellt mit {demoMode ? "Demo-KI" : selectedProviderInfo?.name ?? selectedProvider}. Vor dem
              Posten bleibt alles bearbeitbar.
            </Text>
            {demoMode && (
              <View style={styles.demoInline}>
                <Text style={styles.demoInlineText}>
                  Demo aktiv · Alle Daten sind Beispielwerte und werden nicht veröffentlicht.
                </Text>
              </View>
            )}

            {currentListingId && (() => {
              const saved = savedListings.find(
                (record) => record.id === currentListingId
              );
              return saved ? (
                <LifecyclePanel
                  record={saved}
                  onChange={(status) => updateSavedStatus(saved, status)}
                />
              ) : null;
            })()}

            {draft.analysis && (
              <View style={styles.analysisCard}>
                <View style={styles.rowBetweenCompact}>
                  <Text style={styles.analysisCardTitle}>Fotoanalyse</Text>
                  <Text style={styles.confidence}>
                    {Math.round(draft.analysis.confidence * 100)} % sicher
                  </Text>
                </View>

                {(draft.barcode || barcode) && (
                  <Text style={styles.analysisLine}>
                    Barcode/EAN: {draft.barcode || barcode}
                  </Text>
                )}

                {(draft.voiceNotes || voiceNotes) && (
                  <Text style={styles.analysisLine}>
                    Deine Zusatzangaben: {draft.voiceNotes || voiceNotes}
                  </Text>
                )}

                {draft.analysis.accessories.length > 0 && (
                  <Text style={styles.analysisLine}>
                    Zubehör erkannt: {draft.analysis.accessories.join(", ")}
                  </Text>
                )}

                {draft.analysis.visibleDefects.length > 0 && (
                  <Text style={styles.warningLine}>
                    Sichtbare Mängel: {draft.analysis.visibleDefects.join(", ")}
                  </Text>
                )}

                {draft.analysis.questions.length > 0 && (
                  <View style={styles.questionBox}>
                    <Text style={styles.questionTitle}>Noch zu klären</Text>
                    {draft.analysis.questions.map((question, index) => (
                      <Text key={`${question}-${index}`} style={styles.questionText}>
                        • {question}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            )}

            <Field
              label="Titel"
              value={draft.title}
              onChangeText={(title) => setDraft({ ...draft, title })}
            />
            <Field
              label="Kategorie"
              value={draft.category}
              onChangeText={(category) => setDraft({ ...draft, category })}
            />
            <View style={styles.twoCols}>
              <View style={{ flex: 1 }}>
                <Field
                  label="Marke"
                  value={draft.brand}
                  onChangeText={(brand) => setDraft({ ...draft, brand })}
                />
              </View>
              <View style={{ width: 12 }} />
              <View style={{ flex: 1 }}>
                <Field
                  label="Modell"
                  value={draft.model}
                  onChangeText={(model) => setDraft({ ...draft, model })}
                />
              </View>
            </View>

            <Field
              label="Zustand"
              value={draft.condition}
              onChangeText={(condition) => setDraft({ ...draft, condition })}
            />

            <View style={styles.twoCols}>
              <View style={{ flex: 1 }}>
                <Field
                  label="Preis in €"
                  value={draft.price}
                  keyboardType="decimal-pad"
                  placeholder="z. B. 65"
                  onChangeText={(price) => setDraft({ ...draft, price })}
                />
              </View>
              <View style={{ width: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Preisart</Text>
                <View style={styles.platformRow}>
                  {(["VB", "Festpreis"] as const).map((typeValue) => (
                    <Pressable
                      key={typeValue}
                      onPress={() => setDraft({ ...draft, priceType: typeValue })}
                      style={[
                        styles.platformChip,
                        draft.priceType === typeValue && styles.platformChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.platformChipText,
                          draft.priceType === typeValue &&
                            styles.platformChipTextActive,
                        ]}
                      >
                        {typeValue}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>

            <Field
              label="Beschreibung"
              value={draft.description}
              multiline
              onChangeText={(description) => setDraft({ ...draft, description })}
            />

            <View style={styles.saveRow}>
              <Pressable
                style={[styles.secondary, { flex: 1 }]}
                onPress={async () => {
                  await saveCurrentListing("draft");
                  Alert.alert("Gespeichert", "Der Entwurf liegt jetzt in der Verkaufszentrale.");
                }}
              >
                <Text style={styles.secondaryText}>Entwurf speichern</Text>
              </Pressable>
              <View style={{ width: 10 }} />
              <Pressable
                style={[styles.secondary, { flex: 1 }]}
                onPress={() => setStep("home")}
              >
                <Text style={styles.secondaryText}>Verkaufszentrale</Text>
              </Pressable>
            </View>

            <Pressable style={styles.primary} onPress={() => setStep("pricing")}>
              <Text style={styles.primaryText}>Weiter zum Preisassistenten</Text>
            </Pressable>

            <Pressable style={styles.secondary} onPress={() => setStep("photos")}>
              <Text style={styles.secondaryText}>Fotos noch einmal ändern</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="auto" />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.eyebrow}>SCHRITT 1</Text>
        <Text style={styles.title}>Was möchtest du verkaufen?</Text>
        <Text style={styles.muted}>
          Fotografiere den Artikel aus mehreren Perspektiven. Bis zu {MAX_PHOTOS} Fotos.
        </Text>

        <View style={styles.demoCard}>
          <View style={styles.rowBetweenCompact}>
            <View style={{ flex: 1 }}>
              <Text style={styles.demoEyebrow}>DEMO-MODUS</Text>
              <Text style={styles.demoTitle}>App sofort testen</Text>
              <Text style={styles.demoText}>
                Lädt einen Beispielartikel mit drei Fotos. Keine API, kein eBay-Konto
                und kein KI-Schlüssel nötig.
              </Text>
            </View>
            <Text style={styles.demoBadge}>{demoMode ? "AKTIV" : "TEST"}</Text>
          </View>

          {!demoMode ? (
            <Pressable style={styles.demoButton} onPress={startDemo}>
              <Text style={styles.demoButtonText}>Demo-Artikel laden</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.secondary} onPress={resetDemo}>
              <Text style={styles.secondaryText}>Demo zurücksetzen</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.aiChooser}>
          <Text style={styles.aiChooserTitle}>Welche KI möchtest du verwenden?</Text>
          <Text style={styles.aiChooserText}>
            {demoMode
              ? "Im Demo-Modus wird die gewählte KI nur simuliert. Du kannst den kompletten Ablauf trotzdem testen."
              : "Die Auswahl ist providerunabhängig gebaut und kann später auch im Bewerbungstrainer verwendet werden."}
          </Text>

          {providerLoading ? (
            <ActivityIndicator style={{ marginTop: 14 }} />
          ) : (
            <View style={{ marginTop: 10 }}>
              {providers.map((provider) => {
                const selected = provider.id === selectedProvider;

                return (
                  <Pressable
                    key={provider.id}
                    onPress={() => setSelectedProvider(provider.id)}
                    style={[styles.aiOption, selected && styles.aiOptionSelected]}
                  >
                    <View style={styles.radioOuter}>
                      {selected && <View style={styles.radioInner} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.rowBetweenCompact}>
                        <Text style={styles.aiOptionTitle}>{provider.name}</Text>
                        <Text
                          style={[
                            styles.providerStatus,
                            provider.configured
                              ? styles.providerReady
                              : styles.providerMissing,
                          ]}
                        >
                          {provider.configured ? "bereit" : "nicht verbunden"}
                        </Text>
                      </View>
                      <Text style={styles.aiOptionText}>{provider.description}</Text>
                      <Text style={styles.modelText}>{provider.model}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.captureTools}>
          <Text style={styles.captureToolsTitle}>Schneller erkennen</Text>

          <Pressable
            style={styles.captureTool}
            onPress={() => setStep("scanner")}
          >
            <Text style={styles.captureToolIcon}>▥</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.captureToolTitle}>Barcode / EAN scannen</Text>
              <Text style={styles.captureToolText}>
                Für verpackte Produkte, Elektronik und eindeutig gekennzeichnete Artikel.
              </Text>
              {barcode ? (
                <Text style={styles.captureValue}>Erkannt: {barcode}</Text>
              ) : null}
            </View>
          </Pressable>

          <Pressable style={styles.captureTool} onPress={takeTypeplatePhoto}>
            <Text style={styles.captureToolIcon}>🏷️</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.captureToolTitle}>Typenschild fotografieren</Text>
              <Text style={styles.captureToolText}>
                Das Foto wird für Marke, Modell und technische Daten besonders gewichtet.
              </Text>
            </View>
          </Pressable>
        </View>

        <VoiceNoteInput
          provider={selectedProvider}
          value={voiceNotes}
          onChange={setVoiceNotes}
        />

        <PhotoAuditPanel
          result={photoAudit}
          busy={photoAuditBusy}
          privacyAcknowledged={privacyAcknowledged}
          onRun={runPhotoAudit}
          onApplyCover={applyRecommendedCover}
          onAcknowledgePrivacy={() => setPrivacyAcknowledged(true)}
        />

        <Pressable style={styles.cameraButton} onPress={takePhoto}>
          <Text style={styles.cameraIcon}>📸</Text>
          <Text style={styles.cameraTitle}>Foto aufnehmen</Text>
          <Text style={styles.cameraSubtitle}>
            Weitere Fotos kannst du direkt danach ergänzen.
          </Text>
        </Pressable>

        <Pressable style={styles.secondary} onPress={choosePhotos}>
          <Text style={styles.secondaryText}>Fotos aus Galerie hinzufügen</Text>
        </Pressable>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>Gute Erkennung mit:</Text>
          <Text style={styles.infoText}>
            Vorderseite · Rückseite · Typenschild · Zubehör · vorhandene Schäden
          </Text>
        </View>

        <View style={styles.rowBetween}>
          <Text style={styles.sectionTitle}>
            Fotos ({photos.length}/{MAX_PHOTOS})
          </Text>
          {coverPhoto && <Text style={styles.smallMuted}>Tippen = Titelbild</Text>}
        </View>

        {photos.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Noch keine Bilder vorhanden.</Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {photos.map((photo, index) => (
              <PhotoTile
                key={photo.id}
                photo={photo}
                isCover={index === 0}
                onMakeCover={() => makeCover(photo.id)}
                onRemove={() => removePhoto(photo.id)}
              />
            ))}
          </ScrollView>
        )}

        <Pressable
          style={[
            styles.primary,
            (photos.length === 0 || photoAuditBusy) && styles.disabled,
          ]}
          disabled={photos.length === 0 || photoAuditBusy}
          onPress={startAnalysis}
        >
          <Text style={styles.primaryText}>
            {photos.length > 0
              ? `${photos.length} Foto${photos.length === 1 ? "" : "s"} mit ${
                  demoMode ? "Demo-KI" : selectedProviderInfo?.name ?? selectedProvider
                } analysieren`
              : "Mindestens 1 Foto hinzufügen"}
          </Text>
        </Pressable>

        <Pressable style={styles.secondary} onPress={() => setStep("home")}>
          <Text style={styles.secondaryText}>Zur Verkaufszentrale</Text>
        </Pressable>

        <Text style={styles.privacy}>
          API-Schlüssel bleiben ausschließlich auf dem Backend. Die Handy-App erhält
          nur die ausgewählte KI und das Analyseergebnis.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  multiline?: boolean;
  keyboardType?: "default" | "decimal-pad";
  placeholder?: string;
};

function Field({
  label,
  value,
  onChangeText,
  multiline = false,
  keyboardType = "default",
  placeholder,
}: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        multiline={multiline}
        style={[styles.input, multiline && styles.multiline]}
      />
    </View>
  );
}

type PriceRowProps = {
  label: string;
  value: number;
  actionLabel: string;
  onPress: () => void;
};

function PriceRow({ label, value, actionLabel, onPress }: PriceRowProps) {
  return (
    <View style={styles.priceRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.priceLabel}>{label}</Text>
        <Text style={styles.priceValue}>{value} €</Text>
      </View>
      <Pressable style={styles.inlineButton} onPress={onPress}>
        <Text style={styles.inlineButtonText}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f6f6f4" },
  container: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28 },
  eyebrow: { fontSize: 12, fontWeight: "800", letterSpacing: 1.5, color: "#666" },
  title: { fontSize: 30, lineHeight: 36, fontWeight: "800", marginTop: 6, color: "#171717" },
  muted: { fontSize: 16, lineHeight: 23, color: "#646464", marginTop: 8 },
  smallMuted: { fontSize: 12, color: "#777" },

  aiChooser: {
    backgroundColor: "#fff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#dedede",
    padding: 16,
    marginTop: 22,
  },
  aiChooserTitle: { fontSize: 18, fontWeight: "800", color: "#171717" },
  aiChooserText: { color: "#666", lineHeight: 20, marginTop: 5 },
  aiOption: {
    flexDirection: "row",
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e4e4e4",
    marginTop: 10,
  },
  aiOptionSelected: { borderColor: "#171717", backgroundColor: "#f6f6f4" },
  aiOptionTitle: { fontSize: 16, fontWeight: "800", color: "#222" },
  aiOptionText: { color: "#555", marginTop: 3, lineHeight: 19 },
  modelText: { color: "#8a8a8a", fontSize: 12, marginTop: 5 },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#333",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#171717" },
  providerStatus: { fontSize: 11, fontWeight: "800", paddingHorizontal: 7, paddingVertical: 3, borderRadius: 99 },
  providerReady: { backgroundColor: "#e9f4e9", color: "#295c2e" },
  providerMissing: { backgroundColor: "#f4ece9", color: "#8a301d" },

  cameraButton: {
    backgroundColor: "#171717",
    borderRadius: 22,
    padding: 24,
    alignItems: "center",
    marginTop: 20,
  },
  cameraIcon: { fontSize: 42 },
  cameraTitle: { color: "#fff", fontWeight: "800", fontSize: 20, marginTop: 10 },
  cameraSubtitle: { color: "#cfcfcf", textAlign: "center", marginTop: 6, lineHeight: 20 },
  primary: {
    backgroundColor: "#171717",
    borderRadius: 15,
    paddingVertical: 16,
    paddingHorizontal: 18,
    alignItems: "center",
    marginTop: 24,
  },
  primaryText: { color: "#fff", fontWeight: "800", fontSize: 16, textAlign: "center" },
  disabled: { opacity: 0.35 },
  secondary: {
    borderWidth: 1,
    borderColor: "#c9c9c9",
    backgroundColor: "#fff",
    borderRadius: 15,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: "center",
    marginTop: 12,
  },
  secondaryText: { color: "#222", fontWeight: "700", fontSize: 15, textAlign: "center" },
  infoBox: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: "#e3e3e3",
  },
  infoTitle: { fontWeight: "800", marginBottom: 5, color: "#222" },
  infoText: { color: "#606060", lineHeight: 21 },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginTop: 24,
    marginBottom: 12,
  },
  rowBetweenCompact: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: "#222" },
  empty: {
    minHeight: 110,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#bbb",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: { color: "#777" },
  privacy: { color: "#777", fontSize: 12, lineHeight: 17, marginTop: 18 },
  analysisTitle: { fontSize: 22, fontWeight: "800", marginTop: 18 },
  field: { marginTop: 18 },
  label: { fontSize: 13, fontWeight: "800", color: "#444", marginBottom: 7 },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d7d7d7",
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    color: "#171717",
  },
  multiline: { minHeight: 170, textAlignVertical: "top" },
  twoCols: { flexDirection: "row" },
  analysisCard: {
    marginTop: 18,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#dedede",
    borderRadius: 16,
    padding: 15,
  },
  analysisCardTitle: { fontSize: 16, fontWeight: "800", color: "#222" },
  confidence: { fontSize: 13, fontWeight: "700", color: "#555" },
  analysisLine: { marginTop: 10, color: "#444", lineHeight: 20 },
  warningBox: {
    marginTop: 18,
    backgroundColor: "#fff5ed",
    borderWidth: 1,
    borderColor: "#e7c6a8",
    borderRadius: 14,
    padding: 14,
  },
  warningTitle: { fontWeight: "800", color: "#71401b" },
  warningLine: { marginTop: 6, color: "#8a301d", fontWeight: "700", lineHeight: 20 },
  questionBox: {
    marginTop: 12,
    backgroundColor: "#f4f4f2",
    borderRadius: 12,
    padding: 12,
  },
  questionTitle: { fontWeight: "800", marginBottom: 5, color: "#333" },
  questionText: { color: "#555", lineHeight: 20, marginTop: 2 },
  tagsWrap: { flexDirection: "row", flexWrap: "wrap", marginTop: 12 },
  tag: {
    backgroundColor: "#f1f1ef",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginRight: 8,
    marginBottom: 8,
  },
  tagText: { color: "#333", fontWeight: "600" },
  platformRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 2 },
  platformChip: {
    borderWidth: 1,
    borderColor: "#cfcfcf",
    backgroundColor: "#fff",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginRight: 8,
    marginTop: 2,
  },
  platformChipActive: { backgroundColor: "#171717", borderColor: "#171717" },
  platformChipText: { color: "#333", fontWeight: "700", fontSize: 13 },
  platformChipTextActive: { color: "#fff" },
  comparableRow: {
    backgroundColor: "#f7f7f6",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#ebebeb",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  comparableTitle: { fontWeight: "700", color: "#222" },
  removeInline: { color: "#9f1d1d", fontWeight: "700" },
  resultCard: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d8d8d8",
    borderRadius: 18,
    padding: 16,
    marginTop: 20,
  },
  resultTitle: { fontSize: 20, fontWeight: "800", color: "#171717" },
  resultReasoning: { color: "#444", lineHeight: 21, marginTop: 8, marginBottom: 8 },
  priceRow: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#ececec",
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  priceLabel: { fontSize: 14, fontWeight: "700", color: "#444" },
  priceValue: { fontSize: 26, fontWeight: "800", color: "#171717", marginTop: 4 },
  inlineButton: {
    backgroundColor: "#171717",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  inlineButtonText: { color: "#fff", fontWeight: "700" },

  platformCard: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#dedede",
    borderRadius: 16,
    padding: 15,
    marginTop: 14,
  },
  platformCardSelected: { borderColor: "#171717" },
  platformCheck: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#333",
    alignItems: "center",
    justifyContent: "center",
  },
  platformCheckText: { fontWeight: "900", fontSize: 16 },
  platformCardTitle: { fontSize: 17, fontWeight: "800", color: "#222" },
  platformCardNote: { color: "#555", lineHeight: 20, marginTop: 4 },
  previewTitle: { fontWeight: "800", fontSize: 17, marginTop: 12 },
  previewMeta: { color: "#555", marginTop: 5 },
  previewDescription: { color: "#444", lineHeight: 21, marginTop: 12 },
  actionCard: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#dedede",
    borderRadius: 16,
    padding: 15,
    marginTop: 16,
  },
  actionTitle: { fontSize: 17, fontWeight: "800", color: "#222" },
  actionText: { color: "#555", lineHeight: 20, marginTop: 6 },
  countryChooser: {
    marginTop: 18,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#dedede",
    borderRadius: 16,
    padding: 14,
  },
  modeBadge: {
    fontSize: 11,
    fontWeight: "800",
    color: "#555",
    backgroundColor: "#efefed",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 99,
    marginLeft: 8,
  },
  categoryHint: {
    color: "#6b5a32",
    backgroundColor: "#f6f1e6",
    padding: 9,
    borderRadius: 10,
    marginTop: 9,
    lineHeight: 18,
  },
  countryLine: {
    fontSize: 11,
    color: "#8b8b8b",
    fontWeight: "700",
    marginTop: 8,
  },
  morePlatformsButton: {
    alignItems: "center",
    paddingVertical: 14,
    marginTop: 6,
  },
  morePlatformsText: {
    fontWeight: "800",
    color: "#333",
  },
  copyGeneratorBox: {
    marginTop: 18,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d8d8d8",
    borderRadius: 18,
    padding: 16,
  },
  copyGeneratorTitle: {
    fontSize: 19,
    fontWeight: "900",
    color: "#171717",
  },
  copyGeneratorText: {
    color: "#555",
    lineHeight: 20,
    marginTop: 6,
  },
  specialNote: {
    marginTop: 18,
    backgroundColor: "#f1f1ef",
    borderRadius: 14,
    padding: 14,
  },
  specialNoteTitle: {
    fontWeight: "800",
    color: "#333",
  },
  specialNoteText: {
    color: "#626262",
    lineHeight: 20,
    marginTop: 5,
  },
  recommendationHero: {
    marginTop: 18,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#171717",
    borderRadius: 18,
    padding: 16,
  },
  recommendationEyebrow: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
    color: "#666",
  },
  recommendationTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#171717",
    marginTop: 4,
  },
  recommendationCount: {
    fontSize: 12,
    fontWeight: "900",
    backgroundColor: "#171717",
    color: "#fff",
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 99,
    marginLeft: 10,
  },
  recommendationText: {
    color: "#4e4e4e",
    lineHeight: 20,
    marginTop: 10,
  },
  reapplyButton: {
    alignSelf: "flex-start",
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#c9c9c9",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  reapplyButtonText: { fontWeight: "800", color: "#333" },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 6, marginLeft: 8 },
  recommendedBadge: {
    fontSize: 10,
    fontWeight: "900",
    backgroundColor: "#171717",
    color: "#fff",
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 99,
  },
  scoreBadge: {
    fontSize: 10,
    fontWeight: "900",
    backgroundColor: "#efefed",
    color: "#444",
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 99,
  },
  reasonBox: { marginTop: 9, backgroundColor: "#f5f5f3", borderRadius: 10, padding: 9 },
  reasonText: { color: "#555", lineHeight: 18, fontSize: 12, marginTop: 2 },
  selectionInfo: { marginTop: 12, backgroundColor: "#f1f1ef", borderRadius: 13, padding: 13 },
  selectionInfoTitle: { fontWeight: "800", color: "#333" },
  selectionInfoText: { color: "#626262", lineHeight: 19, marginTop: 4 },

  optionStack: { marginTop: 10 },
  selectRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#dedede",
    backgroundColor: "#fff",
    borderRadius: 13,
    padding: 12,
    marginTop: 8,
  },
  selectRowActive: {
    borderColor: "#171717",
    backgroundColor: "#f6f6f4",
  },
  selectRowText: { fontWeight: "700", color: "#333" },
  paymentGrid: { marginTop: 10 },
  paymentOption: {
    borderWidth: 1,
    borderColor: "#d8d8d8",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  paymentOptionActive: {
    borderColor: "#171717",
    backgroundColor: "#171717",
  },
  paymentOptionText: { color: "#333", fontWeight: "700" },
  paymentOptionTextActive: { color: "#fff" },
  ebayCard: {
    marginTop: 18,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d8d8d8",
    borderRadius: 18,
    padding: 16,
  },
  ebayTitle: { fontSize: 19, fontWeight: "900", color: "#171717" },
  ebayText: { color: "#555", lineHeight: 20, marginTop: 5 },
  ebayStatusBadge: {
    fontSize: 10,
    fontWeight: "900",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 99,
    marginLeft: 10,
  },
  ebayConnected: { backgroundColor: "#e7f3e8", color: "#285c30" },
  ebayDisconnected: { backgroundColor: "#f5e9e6", color: "#8a301d" },
  ebayDetails: {
    backgroundColor: "#f5f5f3",
    borderRadius: 11,
    padding: 10,
    marginTop: 12,
    gap: 4,
  },

  demoCard: {
    marginTop: 20,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#171717",
    borderRadius: 18,
    padding: 16,
  },
  demoEyebrow: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
    color: "#666",
  },
  demoTitle: {
    fontSize: 21,
    fontWeight: "900",
    color: "#171717",
    marginTop: 4,
  },
  demoText: {
    color: "#5a5a5a",
    lineHeight: 20,
    marginTop: 5,
  },
  demoBadge: {
    backgroundColor: "#171717",
    color: "#fff",
    fontSize: 10,
    fontWeight: "900",
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 99,
    marginLeft: 10,
  },
  demoButton: {
    marginTop: 14,
    backgroundColor: "#171717",
    borderRadius: 13,
    padding: 13,
    alignItems: "center",
  },
  demoButtonText: {
    color: "#fff",
    fontWeight: "900",
  },
  demoInline: {
    marginTop: 12,
    backgroundColor: "#f2f2ef",
    borderRadius: 11,
    padding: 10,
  },
  demoInlineText: {
    color: "#555",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
  },

  saveRow: { flexDirection: "row", alignItems: "center", marginTop: 14 },
  publishStatusCard: {
    marginTop: 18,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#dedede",
    borderRadius: 16,
    padding: 15,
  },
  captureTools: {
    marginTop: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#dedede",
    borderRadius: 18,
    padding: 15,
  },
  captureToolsTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: "#171717",
  },
  captureTool: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
    marginTop: 11,
    backgroundColor: "#f6f6f4",
    borderRadius: 13,
    padding: 12,
  },
  captureToolIcon: {
    fontSize: 23,
    fontWeight: "900",
    color: "#222",
    width: 30,
    textAlign: "center",
  },
  captureToolTitle: {
    fontWeight: "900",
    color: "#222",
  },
  captureToolText: {
    color: "#666",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  captureValue: {
    color: "#222",
    fontSize: 12,
    fontWeight: "900",
    marginTop: 6,
  },

  privacyBlocker: {
    marginTop: 16,
    backgroundColor: "#fff1ed",
    borderWidth: 2,
    borderColor: "#a54c3d",
    borderRadius: 15,
    padding: 13,
  },
  privacyBlockerTitle: {
    color: "#8b2d21",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.1,
  },
  privacyBlockerText: {
    color: "#70463f",
    lineHeight: 19,
    marginTop: 5,
  },

  goalCard: {
    marginTop: 16,
    backgroundColor: "#171717",
    borderRadius: 17,
    padding: 15,
  },
  goalEyebrow: {
    color: "#bdbdbd",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  goalTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "900",
    marginTop: 4,
  },
  goalText: {
    color: "#d1d1d1",
    lineHeight: 18,
    fontSize: 12,
    marginTop: 5,
  },
  goalPriceRow: {
    marginTop: 13,
  },
  goalPrice: {
    color: "#fff",
    fontSize: 27,
    fontWeight: "900",
  },
  goalApply: {
    backgroundColor: "#fff",
    borderRadius: 11,
    padding: 11,
    alignItems: "center",
    marginTop: 9,
  },
  goalApplyText: {
    color: "#171717",
    fontWeight: "900",
  },
});
